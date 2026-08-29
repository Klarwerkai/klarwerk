import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

// ==============================================================================================
// AUFTRAG-mega20 Block A — DER VORGANG MUSS DEN ANTWORTVERLUST ÜBERLEBEN.
// ==============================================================================================
//
// DER BEFUND. mega19 hat den KO-INSERT atomar gemacht. Der REQUEST war es nicht: nach dem
// gelungenen `createWithDocuments` liefen auf Route-Ebene noch Entwurfs-Rücknahme,
// Prüfer-Zuweisung, Benachrichtigung und KI-Prüf-Vermerk — und ERST danach ging die 201 raus.
// Jeder dieser Schritte konnte werfen, während das Wissensobjekt BEREITS EXISTIERTE; die Route
// antwortete dann mit Fehler, und der Client las das als „nicht gespeichert".
//
// Dazu fehlte der Erstanlage jede Erzeugungs-Operationskennung. Ein Browser-Retry nach
// Antwortverlust erzeugte deshalb EIN ZWEITES VOLLSTÄNDIGES WISSENSOBJEKT — derselbe Fehler wie
// in mega18 beim Append, nur teurer: dort eine doppelte Quelle, hier ein doppeltes Objekt.
//
// Und drittens verschluckte die Rücknahme ihren eigenen Fehler (`repo.delete(...).catch(() =>
// undefined)`). Scheiterte sie, blieb ein vollständiges Wissensobjekt im kanonischen Bestand —
// möglicherweise ohne Snapshot, ohne Evidence, ohne Audit — und der Aufrufer erfuhr davon nichts.
//
// Diese Datei belegt alle drei Reparaturen UND ihre Kalibrierung: dass eine NEUE Kennung
// weiterhin durch jedes einzelne Tor läuft.

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
};

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(stage?: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const headers = await login(app, "a@x.de", "secret123");
  if (stage) {
    const put = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers,
      payload: { stage },
    });
    expect(put.statusCode).toBe(200);
  }
  return { app, headers };
}

async function objektAnlegen(app: App, headers: Record<string, string>, name = "Pruefbericht.pdf") {
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name, mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  return obj.json().id as string;
}

// JOB 2684 D4: der Dokumentweg mit `draftId` verlangt den beim Laden gesehenen Stand
// (`expectedUpdatedAt`, sonst 400 DRAFT_STAND_FEHLT). Der Test holt ihn wie der Client — über
// `GET /api/drafts/:id` — sofern der Aufruf keinen mitbringt und der Entwurf noch da ist. Ist er
// schon verbraucht (Wiederholung nach Erfolg), reist kein Stand: der Nachschlag entscheidet zuerst.
async function ausDokument(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) {
  let body = payload;
  if (typeof payload.draftId === "string" && payload.expectedUpdatedAt === undefined) {
    const d = await app.inject({ method: "GET", url: `/api/drafts/${payload.draftId}`, headers });
    if (d.statusCode === 200) {
      body = { ...payload, expectedUpdatedAt: (d.json() as { updatedAt: string }).updatedAt };
    }
  }
  return app.inject({ method: "POST", url: "/api/kos/from-document", headers, payload: body });
}

async function bestand(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode).toBe(200);
  return res.json() as Record<string, unknown>[];
}

function bündel(objectId: string, label = "Pruefbericht.pdf") {
  return [
    {
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: [{ label, excerpt: "Dichtung nach 500 h tauschen." }],
    },
  ];
}

// ----------------------------------------------------------------------------------------------
// 1. DER RETRY-BELEG — die Wiederholung liefert das VORHANDENE Objekt, nicht ein zweites.
// ----------------------------------------------------------------------------------------------
describe("mega20 A: der Wiederholschlüssel überlebt den Antwortverlust", () => {
  it("derselbe Vorgang zweimal ⇒ EIN Wissensobjekt, beim zweiten Mal 200 statt 201", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "vorgang-antwortverlust-1",
      create: INHALT,
      documents: bündel(objectId),
    };

    // Aufruf 1: das Objekt entsteht. In der Wirklichkeit erreicht diese Antwort den Browser nicht.
    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    const ersterKo = erst.json();

    // Aufruf 2: BYTE-IDENTISCH derselbe Request — genau das, was ein Browser-Retry schickt.
    const zweit = await ausDokument(app, headers, payload);
    expect(zweit.statusCode).toBe(200);
    const zweiterKo = zweit.json();

    // DIE ZUSAGE: dasselbe Objekt, nicht ein zweites mit gleichem Inhalt.
    expect(zweiterKo.id).toBe(ersterKo.id);
    expect(zweiterKo.version).toBe(1);
    expect(await bestand(app, headers)).toHaveLength(1);
  });

  it("die Wiederholung erzeugt auch keine zweiten Anker, Belegstellen oder Evidence-Records", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "vorgang-antwortverlust-2",
      create: INHALT,
      documents: bündel(objectId),
    };

    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    await ausDokument(app, headers, payload);
    await ausDokument(app, headers, payload);

    const id = erst.json().id as string;
    const ko = (await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })).json();
    expect(ko.attachments).toHaveLength(1);
    expect(ko.sources).toHaveLength(1);
    const ev = await app.inject({ method: "GET", url: `/api/kos/${id}/evidence`, headers });
    const records = ev.json() as { kind: string }[];
    expect(records.filter((r) => r.kind === "attachment")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "source")).toHaveLength(1);
  });

  it("DIE HÄRTESTE KANTE: die Wiederholung eines ENTWURFS-Vorgangs findet ihren Entwurf nicht mehr — und gelingt trotzdem", async () => {
    // Der erste Aufruf LÖSCHT den Entwurf nach dem Commit. Läge der Nachschlag hinter der
    // Entwurfs-Ladung, bekäme die Wiederholung 404 „Entwurf nicht gefunden" — für einen Vorgang,
    // der GELUNGEN ist. Der Client würde daraus „nicht gespeichert" lesen. Genau deshalb steht der
    // Nachschlag VOR der Entwurfs-Ladung.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: INHALT,
    });
    const draftId = draft.json().id as string;
    // AUFTRAG-mega22 Block C: `draftPayload` ist bei gesetztem `draftId` Pflicht.
    const payload = {
      operationId: "vorgang-entwurf-1",
      draftId,
      draftPayload: {},
      documents: bündel(objectId),
    };

    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    // Der Entwurf ist weg — die Wiederholung kann ihn nicht mehr laden.
    expect((await app.inject({ method: "GET", url: "/api/drafts", headers })).json()).toHaveLength(
      0,
    );

    const zweit = await ausDokument(app, headers, payload);
    expect(zweit.statusCode).toBe(200);
    expect(zweit.json().id).toBe(erst.json().id);
    expect(await bestand(app, headers)).toHaveLength(1);
  });

  it("KALIBRIERUNG: eine NEUE Kennung läuft weiterhin durch JEDES Tor", async () => {
    // Der Nachschlag darf für eine unbekannte Kennung KEIN Tor überspringen. Dieselbe Disziplin
    // wie bei `lookupDocumentAppend` in mega19 — hier Tor für Tor nachgewiesen.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);

    // TOR: die interne Belegpflicht (fehlender Anker).
    const ohneAnker = await ausDokument(app, headers, {
      operationId: "kalibrierung-belegpflicht",
      create: INHALT,
      documents: [{ points: [{ label: "x", excerpt: "y" }] }],
    });
    expect(ohneAnker.statusCode).toBe(400);
    expect(ohneAnker.json().message).toContain("braucht sein Original");

    // TOR: die Existenz des Ankerobjekts im Objektspeicher.
    const unbekanntesObjekt = await ausDokument(app, headers, {
      operationId: "kalibrierung-objektspeicher",
      create: INHALT,
      documents: bündel("gibt-es-nicht"),
    });
    expect(unbekanntesObjekt.statusCode).toBe(400);
    expect(unbekanntesObjekt.json().message).toContain("Unbekannte objectId");

    // TOR: das Label jeder Belegstelle.
    const ohneLabel = await ausDokument(app, headers, {
      operationId: "kalibrierung-label",
      create: INHALT,
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "   ", excerpt: "x" }],
        },
      ],
    });
    expect(ohneLabel.statusCode).toBe(400);

    // Nach drei abgewiesenen NEUEN Kennungen: nichts entstanden.
    expect(await bestand(app, headers)).toHaveLength(0);

    // Und der gute Fall mit einer NEUEN Kennung legt ganz normal an.
    const gut = await ausDokument(app, headers, {
      operationId: "kalibrierung-guter-fall",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(gut.statusCode).toBe(201);
    expect(await bestand(app, headers)).toHaveLength(1);
  });

  it("KALIBRIERUNG: auch die externe Stufenregel steht weiter VOR der Anlage", async () => {
    const { app, headers } = await setup("blocked");
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, {
      operationId: "kalibrierung-stufe",
      create: INHALT,
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Herstellerhinweis", url: "https://example.org/x", excerpt: "y" }],
        },
      ],
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("EXTERNAL_ATTACH_BLOCKED");
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("ohne Kennung gibt es die Erstanlage aus Dokumenten NICHT (ehrlicher Formfehler statt stiller Duplikat-Gefahr)", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, { create: INHALT, documents: bündel(objectId) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("INVALID_OPERATION_ID");
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("eine FREMDE Kennung liefert KEIN fremdes Wissensobjekt — und blockiert den Fremden auch nicht", async () => {
    // ==========================================================================================
    // AUFTRAG-mega22 Block G — UMGEDREHTE ZUSICHERUNG (Statuscode), UNVERÄNDERTE SICHERHEIT.
    // ==========================================================================================
    //
    // Bis mega21 pinnte dieser Fall zusätzlich:
    //     expect(res.statusCode).toBe(409);
    //     expect(res.json().error).toBe("CREATE_ANCHOR_TAKEN");
    //
    // Die Erzeugungskennung war DB-WEIT eindeutig, und genau das war die Denial-Kante, die ben
    // benannt hat: ein Nutzer mit `ko.create` konnte vorhersehbare Kennungen besetzen und einen
    // anderen dauerhaft aus seinem Vorgang drängen. Seit Block G ist der Kennungsraum PRO
    // ANFRAGENDEM privat — eine fremde Kennung ist keine Kollision mehr, sondern eine andere
    // Adresse. Bea bekommt deshalb IHR eigenes Objekt (201) statt einer Absage.
    //
    // WAS DIESER TEST WEITERHIN — und schärfer — BEWEIST: aus dem fremden Vorgang sickert NICHTS.
    // Bea sieht das Objekt der ersten Anlage nie, weder als Inhalt noch als Kennung. Das war die
    // eigentliche Zusage; sie steht unverändert. Was WEGGEFALLEN ist, ist nur die Nebenwirkung,
    // dass ein Fremder den Vorgang eines anderen unbrauchbar machen konnte.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const erst = await ausDokument(app, headers, {
      operationId: "vorgang-der-anderen-person",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(erst.statusCode).toBe(201);

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Bea", email: "b@x.de", password: "secret123", role: "experte" },
    });
    expect(angelegt.statusCode).toBe(201);
    const fremd = await login(app, "b@x.de", "secret123");

    const res = await ausDokument(app, fremd, {
      operationId: "vorgang-der-anderen-person",
      create: INHALT,
      documents: bündel(objectId),
    });
    // Bea ist NICHT blockiert: ihr Vorgang läuft, weil er ihrer ist.
    expect(res.statusCode).toBe(201);
    // Und sie hat NICHT das Objekt der ersten Anlage bekommen, sondern ein eigenes.
    expect(res.json().id).not.toBe(erst.json().id);
    // Ihr Objekt trägt SIE als Autorin, nicht den Admin des ersten Vorgangs.
    expect(res.json().author).not.toBe(erst.json().author);
    // Es gibt jetzt zwei Objekte — je EINES pro Vorgang, und das ist die Zusage: höchstens eines
    // je (Vorgang, Eigentümer). Der Wiederholversuch BEAS liefert weiterhin ihr eigenes zurück.
    expect(await bestand(app, headers)).toHaveLength(2);
    const beaWieder = await ausDokument(app, fremd, {
      operationId: "vorgang-der-anderen-person",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(beaWieder.statusCode).toBe(200);
    expect(beaWieder.json().id).toBe(res.json().id);
    expect(await bestand(app, headers)).toHaveLength(2);
  });
});

// ----------------------------------------------------------------------------------------------
// 2. DER POST-COMMIT-BELEG — ein geworfener Folgeschritt lässt den Vorgang NICHT scheitern.
// ----------------------------------------------------------------------------------------------
describe("mega20 A: Folgeschritte sind Nacharbeit, nicht Erfolgsdefinition", () => {
  it("wirft die Prüfer-Zuweisung, ist der Vorgang trotzdem gelungen — und der Fehlschlag wird BENANNT", async () => {
    const services = buildServices();
    // Der Folgeschritt bricht. Bis mega19 hätte die Route daraufhin einen Fehler geantwortet,
    // obwohl das Wissensobjekt vollständig und vollständig belegt im Bestand stand.
    vi.spyOn(services.validation, "assign").mockRejectedValue(new Error("Zuweisung kaputt"));
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const headers = await login(app, "a@x.de", "secret123");
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Bea", email: "b@x.de", password: "secret123", role: "experte" },
    });
    const pruefer = angelegt.json().id as string;
    const objectId = await objektAnlegen(app, headers);

    const res = await ausDokument(app, headers, {
      operationId: "vorgang-folgeschritt-1",
      create: INHALT,
      documents: bündel(objectId),
      reviewerIds: [pruefer],
    });

    // WAS DER AUFRUFER ERFÄHRT: Erfolg — und ehrlich, was NICHT lief.
    expect(res.statusCode).toBe(201);
    expect(res.json().followUpsFailed).toContain("validation-assign");
    // WAS IM BESTAND STEHT: das vollständige Wissensobjekt mit Anker und Belegstelle.
    const liste = await bestand(app, headers);
    expect(liste).toHaveLength(1);
    const ko = (liste[0] ?? {}) as { attachments?: unknown[]; sources?: unknown[] };
    expect(ko.attachments).toHaveLength(1);
    expect(ko.sources).toHaveLength(1);
  });

  it("wirft die Entwurfs-Rücknahme, bleibt der Entwurf stehen — sichtbar, nicht verschwiegen", async () => {
    const services = buildServices();
    vi.spyOn(services.capture, "deleteDraft").mockRejectedValue(
      new Error("Entwurf-Löschen kaputt"),
    );
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const headers = await login(app, "a@x.de", "secret123");
    const objectId = await objektAnlegen(app, headers);
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: INHALT,
    });
    const draftId = draft.json().id as string;

    const res = await ausDokument(app, headers, {
      operationId: "vorgang-folgeschritt-2",
      draftId,
      draftPayload: {},
      documents: bündel(objectId),
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().followUpsFailed).toContain("draft-discard");
    // Das Wissensobjekt steht. Der Entwurf auch — als offene Nacharbeit, die sein Autor sieht.
    expect(await bestand(app, headers)).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/api/drafts", headers })).json()).toHaveLength(
      1,
    );
  });

  it("die WIEDERHOLUNG führt die Folgeschritte nicht erneut aus", async () => {
    const services = buildServices();
    const assign = vi.spyOn(services.validation, "assign");
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const headers = await login(app, "a@x.de", "secret123");
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Bea", email: "b@x.de", password: "secret123", role: "experte" },
    });
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "vorgang-folgeschritt-3",
      create: INHALT,
      documents: bündel(objectId),
      reviewerIds: [angelegt.json().id as string],
    };

    expect((await ausDokument(app, headers, payload)).statusCode).toBe(201);
    expect(assign).toHaveBeenCalledTimes(1);
    expect((await ausDokument(app, headers, payload)).statusCode).toBe(200);
    // Sie liefen beim ersten Mal. Sie hier zu wiederholen wäre kein Fehler, aber auch keine Wahrheit.
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 3. DER `delete`-FEHLERBELEG — die Rücknahme verschluckt ihren eigenen Fehler NICHT mehr.
// ----------------------------------------------------------------------------------------------
describe("mega20 A: eine gescheiterte Rücknahme wird sichtbar und reparierbar", () => {
  function dienst() {
    const repo = new InMemoryKoRepo();
    const evidence = new InMemoryEvidenceRepo();
    const auditRepo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo: auditRepo });
    const service = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      evidence,
      audit,
    });
    return { repo, evidence, audit, auditRepo, service };
  }

  const EIN_BÜNDEL = [
    {
      anchor: { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" },
      sources: [{ label: "P.pdf", excerpt: "eins" }],
    },
  ];

  it("scheitert der Beleg UND die Rücknahme, erfährt der Aufrufer die Kennung des Restobjekts", async () => {
    const { repo, evidence, service } = dienst();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));
    vi.spyOn(repo, "delete").mockRejectedValue(new Error("delete kaputt"));

    const fehler = await service
      .createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, {
        id: "rollback-1",
        actor: "u1",
        fingerprint: "fp-rollback-1",
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    // WAS DER AUFRUFER ERFÄHRT: nicht mehr nur „evidence kaputt", sondern der EIGENE Fehler der
    // Rücknahme — mit der Kennung des Objekts, das zurückgeblieben ist.
    expect(fehler).toMatchObject({ code: "CREATE_ROLLBACK_FAILED" });
    const details = (fehler as { details?: { koId?: string; cause?: unknown } }).details;
    expect(typeof details?.koId).toBe("string");
    expect((details?.cause as Error)?.message).toBe("evidence kaputt");
    expect(String((fehler as Error).message)).toContain(details?.koId as string);

    // WAS IM BESTAND STEHT: das Objekt — und es ist als reparaturbedürftig MARKIERT.
    const rest = await repo.list({});
    expect(rest).toHaveLength(1);
    expect(rest[0]?.id).toBe(details?.koId);
    expect(rest[0]?.needsRepair).toMatchObject({ rollbackFailure: "Error", failedStep: "Error" });
    expect(typeof rest[0]?.needsRepair?.at).toBe("string");
  });

  it("der Reparaturvermerk steht AUCH im Audit — und sagt, ob die Markierung durchkam", async () => {
    const { repo, evidence, auditRepo, service } = dienst();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));
    vi.spyOn(repo, "delete").mockRejectedValue(new Error("delete kaputt"));

    await service
      .createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, {
        id: "rollback-2",
        actor: "u1",
        fingerprint: "fp-rollback-2",
      })
      .catch(() => undefined);

    const eintraege = await auditRepo.all();
    const beleg = eintraege.find((e) => e.action === "ko.create-rollback-failed");
    expect(beleg).toBeDefined();
    expect(beleg?.payload).toMatchObject({
      marked: true,
      failedStep: "Error",
      rollbackFailure: "Error",
    });
  });

  it("scheitert die MARKIERUNG ebenfalls, wirft der Vorgang trotzdem seinen eigenen Fehler", async () => {
    // Der Vermerk ist best effort und darf nie der einzige Kanal sein. Fällt er aus, bleiben der
    // geworfene Fehler mit der Kennung und der Audit-Beleg (mit `marked: false`).
    const { repo, evidence, auditRepo, service } = dienst();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));
    vi.spyOn(repo, "delete").mockRejectedValue(new Error("delete kaputt"));
    vi.spyOn(repo, "update").mockRejectedValue(new Error("update kaputt"));

    const fehler = await service
      .createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, {
        id: "rollback-3",
        actor: "u1",
        fingerprint: "fp-rollback-3",
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(fehler).toMatchObject({ code: "CREATE_ROLLBACK_FAILED" });
    const beleg = (await auditRepo.all()).find((e) => e.action === "ko.create-rollback-failed");
    expect(beleg?.payload).toMatchObject({ marked: false });
    // Das Objekt steht ohne Vermerk im Bestand — genau das sagt `marked: false` aus. Niemand darf
    // aus einem fehlenden Vermerk auf ein gesundes Objekt schließen.
    const rest = await repo.list({});
    expect(rest).toHaveLength(1);
    expect(rest[0]?.needsRepair).toBeUndefined();
  });

  it("GELINGT die Rücknahme, bleibt es beim URSPRÜNGLICHEN Fehler und es bleibt NICHTS zurück", async () => {
    // Die Gegenprobe zur Verschärfung: der gute Kompensationsfall aus mega19 ist unverändert.
    const { evidence, repo, service } = dienst();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));

    await expect(
      service.createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, {
        id: "rollback-4",
        actor: "u1",
        fingerprint: "fp-rollback-4",
      }),
    ).rejects.toThrow("evidence kaputt");
    expect(await repo.list({})).toHaveLength(0);
  });

  it("nach einer sauberen Rücknahme ist der Schlüssel WIEDER FREI — die Wiederholung legt neu an", async () => {
    // Wichtige Eigenschaft: der Anker verschwindet mit dem Objekt. Sonst wäre ein einmal
    // gescheiterter Vorgang für immer blockiert und der Nutzer käme nie zu seinem Objekt.
    const { evidence, repo, service } = dienst();
    const kaputt = vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));
    await service
      .createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, {
        id: "rollback-5",
        actor: "u1",
        fingerprint: "fp-rollback-5",
      })
      .catch(() => undefined);
    kaputt.mockRestore();

    const ko = await service.createWithDocuments(
      { ...INHALT, type: "best_practice", author: "u1" },
      EIN_BÜNDEL,
      { id: "rollback-5", actor: "u1", fingerprint: "fp-rollback-5" },
    );
    expect(ko.createOperationId).toBe("rollback-5");
    expect(await repo.list({})).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 4. DIE GEGENPROBE IM WORTLAUT.
// ----------------------------------------------------------------------------------------------
describe("mega20 A: die Gegenprobe", () => {
  it("der Erzeugungs-Anker ist über die öffentliche Schreibroute NICHT setzbar", async () => {
    // Dieselbe Grenze wie bei `sources` und `importCandidateId` (SCRUM-470, WP-SHIP8-CLOSE-3):
    // wäre er dort setzbar, könnte sich jemand mit `ko.create` an einen fremden Vorgang hängen.
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { ...INHALT, createOperationId: "fremder-vorgang-1" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().createOperationId).toBeUndefined();
  });

  it("auch über die NEUE Route ist er nicht unterschiebbar — nur `operationId` zählt", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, {
      operationId: "echter-vorgang-1",
      create: { ...INHALT, createOperationId: "untergeschoben-1" },
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().createOperationId).toBe("echter-vorgang-1");
  });

  it("der Nachschlag SCHREIBT NICHT — eine unbekannte Kennung hinterlässt nichts", async () => {
    const services = buildServices();
    const insert = vi.spyOn(services.ko, "createWithDocuments");
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const headers = await login(app, "a@x.de", "secret123");

    // Eine unbekannte Kennung mit einem UNGÜLTIGEN Bündel: der Nachschlag liefert null, das Tor
    // greift, und es entsteht weder ein Objekt noch ein Vorgangsvermerk.
    const res = await ausDokument(app, headers, {
      operationId: "niemals-benutzt-1",
      create: INHALT,
      documents: bündel("gibt-es-nicht"),
    });
    expect(res.statusCode).toBe(400);
    expect(insert).not.toHaveBeenCalled();
    expect(await bestand(app, headers)).toHaveLength(0);

    // Und derselbe Schlüssel ist danach frei: er hat nichts angefasst.
    const objectId = await objektAnlegen(app, headers);
    const gut = await ausDokument(app, headers, {
      operationId: "niemals-benutzt-1",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(gut.statusCode).toBe(201);
  });

  it("die Kennung erweitert kein Recht — ohne `ko.create` bleibt die Route zu", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Leser", email: "l@x.de", password: "secret123", role: "viewer" },
    });
    expect(angelegt.statusCode).toBe(201);
    const leser = await login(app, "l@x.de", "secret123");
    const res = await ausDokument(app, leser, {
      operationId: "vorgang-ohne-recht-1",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(res.statusCode).toBe(403);
    expect(await bestand(app, headers)).toHaveLength(0);
  });
});
