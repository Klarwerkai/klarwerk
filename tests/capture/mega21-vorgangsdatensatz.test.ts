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
// AUFTRAG-mega21 Block A — DER VORGANG BRAUCHT EIN GEDÄCHTNIS.
// ==============================================================================================
//
// bens SB-1, SB-3 und SB-4 sind DERSELBE Mangel aus drei Richtungen. mega20 hat einen SCHLÜSSEL
// eingeführt und ihn für einen Vorgang gehalten. Ein Schlüssel weiß aber nicht,
//
//   · WEM er gehört   — er borgte sich den KO-Autor, der beim Entwurfsweg vom ursprünglichen
//                       Verfasser stammt und später über `setAuthor` änderbar ist,
//   · WAS er war      — kein Inhaltsabdruck, also lieferte derselbe Schlüssel nach einer
//                       Textänderung still das alte Objekt,
//   · WIE es ausging  — ein Reparaturrest wurde beim nächsten Versuch als Erfolg adoptiert.
//
// Diese Datei belegt alle drei Tore einzeln, die Kanonisierungsregel des Abdrucks, die
// Unveränderlichkeit der Eigentümerbindung gegen `setAuthor` — und die Gegenprobe: dass ein
// UNBEKANNTER Vorgang weiterhin durch jedes Tor läuft und nichts abkürzt.

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
  expect(res.statusCode).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const headers = await login(app, "a@x.de", "secret123");
  return { app, headers, services };
}

/** Ein zweiter, NICHT-Admin-Nutzer — für den Entwurfs- und den Fremdzugriffs-Fall. */
async function zweiterNutzer(app: App, headers: Record<string, string>) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers,
    payload: { name: "Bea", email: "b@x.de", password: "secret123", role: "experte" },
  });
  expect(angelegt.statusCode).toBe(201);
  return {
    id: angelegt.json().id as string,
    headers: await login(app, "b@x.de", "secret123"),
  };
}

async function objektAnlegen(app: App, headers: Record<string, string>) {
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  return obj.json().id as string;
}

// JOB 2684 D4: der Dokumentweg mit `draftId` verlangt den beim Laden gesehenen Stand
// (`expectedUpdatedAt`, sonst 400 DRAFT_STAND_FEHLT). Der Test holt ihn wie der Client — über
// `GET /api/drafts/:id` — sofern der Aufruf keinen mitbringt und der Entwurf sichtbar ist. Ist er
// verbraucht oder fremd, reist kein Stand: Nachschlag bzw. Sichtbarkeitsregel entscheiden zuerst.
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

function bündel(objectId: string) {
  return [
    {
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
    },
  ];
}

// ----------------------------------------------------------------------------------------------
// 1. DER EIGENTÜMER (bens SB-1) — der rechtmäßige Wiederholversuch eines Admins.
// ----------------------------------------------------------------------------------------------
describe("mega21 A: der Eigentümer des Vorgangs ist der ANFRAGENDE, nicht der KO-Autor", () => {
  it("ADMIN SENDET FREMDEN ENTWURF, Antwortverlust, rechtmäßiger Wiederholversuch ⇒ 200 mit DEMSELBEN Objekt", async () => {
    // DER FALL, den mega20 falsch beantwortete. Bea schreibt einen Entwurf. Der Admin darf ihn
    // absehen und absenden (canSeeDraft). Das entstehende Wissensobjekt trägt BEAS Autorschaft
    // (FR-CAP-07, `draft.originalAuthor`) — der VORGANG aber gehört dem Admin, der ihn gestartet
    // hat. mega20 verglich `known.author === author` und antwortete deshalb dem rechtmäßigen
    // Wiederholversuch des Admins mit 409, für einen Vorgang, den er selbst gefahren hatte.
    const { app, headers } = await setup();
    const bea = await zweiterNutzer(app, headers);
    const objectId = await objektAnlegen(app, headers);

    // Bea legt IHREN Entwurf an.
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: bea.headers,
      payload: { ...INHALT },
    });
    expect(entwurf.statusCode).toBe(201);
    const draftId = entwurf.json().id as string;

    const payload = {
      operationId: "admin-fremder-entwurf-1",
      draftId,
      // AUFTRAG-mega22 Block C: `draftPayload` ist bei gesetztem `draftId` Pflicht.
      draftPayload: {},
      documents: bündel(objectId),
    };

    // Der ADMIN reicht ihn ein. Der Server führt aus — in der Wirklichkeit erreicht die Antwort
    // den Browser nicht.
    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    const ersterKo = erst.json();
    // Der AUTOR ist Bea — genau das ist der Grund, warum `author` als Eigentümer untauglich war.
    expect(ersterKo.author).toBe(bea.id);

    // Der rechtmäßige Wiederholversuch DESSELBEN Admins.
    const zweit = await ausDokument(app, headers, payload);
    expect(zweit.statusCode).toBe(200); // mega20: 409.
    expect(zweit.json().id).toBe(ersterKo.id);
    expect(await bestand(app, headers)).toHaveLength(1);
  });

  it("BEA dagegen bekommt auf DENSELBEN Schlüssel weiterhin einen Konflikt — und nichts vom Inhalt", async () => {
    // Die Kalibrierung der Zeile darüber. Die Bindung ist nicht weicher geworden, sondern nur an
    // die richtige Person geknüpft: Bea ist zwar AUTORIN des Objekts, aber nicht Eigentümerin des
    // Vorgangs. Ein Treffer über eine fremde Kennung liefert ihr nichts.
    const { app, headers } = await setup();
    const bea = await zweiterNutzer(app, headers);
    const objectId = await objektAnlegen(app, headers);
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: bea.headers,
      payload: { ...INHALT },
    });
    const draftId = entwurf.json().id as string;

    const erst = await ausDokument(app, headers, {
      operationId: "admin-fremder-entwurf-2",
      draftId,
      draftPayload: {},
      documents: bündel(objectId),
    });
    expect(erst.statusCode).toBe(201);
    expect(erst.json().author).toBe(bea.id);

    // ==========================================================================================
    // AUFTRAG-mega22 Block G — UMGEDREHTE ZUSICHERUNG (Statuscode), UNVERÄNDERTE SICHERHEIT.
    // ==========================================================================================
    //
    // Bis mega21 stand hier:
    //     expect(res.statusCode).toBe(409);
    //     expect(res.json().error).toBe("CREATE_ANCHOR_TAKEN");
    //
    // Der Titel dieses Falls lautete „BEA bekommt weiterhin einen Konflikt". Der Konflikt war aber
    // nie die Zusage — die Zusage war „und nichts vom Inhalt". Seit Block G ist der Kennungsraum
    // pro Anfragendem privat; Beas gleichlautende Kennung ist eine andere Adresse, kein Zugriff.
    // Sie bekommt IHR Objekt, nie das des Admins.
    const beasObjekt = await objektAnlegen(app, bea.headers);
    const res = await ausDokument(app, bea.headers, {
      operationId: "admin-fremder-entwurf-2",
      create: INHALT,
      documents: bündel(beasObjekt),
    });
    expect(res.statusCode).toBe(201);
    // DIE UNVERÄNDERTE ZUSAGE: es ist NICHT das Objekt aus dem Vorgang des Admins.
    expect(res.json().id).not.toBe(erst.json().id);
    // Und Beas Objekt trägt IHREN Anker, nicht den fremden.
    expect(res.json().attachments[0].objectId).toBe(beasObjekt);
    expect(await bestand(app, headers)).toHaveLength(2);
  });

  it("`setAuthor` NACH der Anlage verschiebt die Eigentümerbindung des Vorgangs NICHT", async () => {
    // `author` ist über die Autor-Übergabe (FR-LIF-02) veränderlich. Eine Eigentümerbindung, die
    // sich nachträglich verschieben lässt, ist keine: der ursprüngliche Anleger verlöre seinen
    // eigenen Wiederholversuch, und der neue Autor erbte einen Vorgang, den er nie gestartet hat.
    const { app, headers, services } = await setup();
    const bea = await zweiterNutzer(app, headers);
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "autor-uebergabe-1",
      create: INHALT,
      documents: bündel(objectId),
    };

    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    const koId = erst.json().id as string;

    // Die Autor-Übergabe an Bea.
    await services.ko.setAuthor(koId, bea.id, "admin");
    expect((await services.ko.get(koId))?.author).toBe(bea.id);

    // Der ursprüngliche Anleger wiederholt: er bekommt SEIN Objekt (die Bindung steht).
    const wieder = await ausDokument(app, headers, payload);
    expect(wieder.statusCode).toBe(200);
    expect(wieder.json().id).toBe(koId);

    // Und der NEUE Autor bekommt es NICHT — er hat den Vorgang nicht gefahren.
    //
    // AUFTRAG-mega22 Block G — UMGEDREHTE ZUSICHERUNG (Statuscode). Bis mega21 stand hier
    // `expect(fremd.statusCode).toBe(409)` mit `CREATE_ANCHOR_TAKEN`. Der Punkt dieses Falls ist
    // aber die EIGENTÜMERBINDUNG, nicht der Statuscode: die Autor-Übergabe darf den Vorgang des
    // ursprünglichen Anlegers nicht verschieben. Genau das steht drei Zeilen höher unverändert
    // (er bekommt SEIN Objekt zurück). Bea erbt ihn nach wie vor nicht — sie fährt jetzt nur ihren
    // eigenen, statt an einem fremden Schlüssel hängenzubleiben (Block G).
    const beasObjekt = await objektAnlegen(app, bea.headers);
    const fremd = await ausDokument(app, bea.headers, {
      operationId: "autor-uebergabe-1",
      create: INHALT,
      documents: bündel(beasObjekt),
    });
    expect(fremd.statusCode).toBe(201);
    expect(fremd.json().id).not.toBe(koId);
    expect(await bestand(app, headers)).toHaveLength(2);
    // DIE KALIBRIERUNG, die den ganzen Fall trägt: der ursprüngliche Anleger bekommt NACH Beas
    // Anlage weiterhin SEIN Objekt — die Bindung hat sich weder durch die Autor-Übergabe noch
    // durch Beas gleichlautende Kennung verschoben.
    const nochmal = await ausDokument(app, headers, payload);
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json().id).toBe(koId);
  });
});

// ----------------------------------------------------------------------------------------------
// 2. DER INHALTSABDRUCK (bens SB-3) — geänderter Text unter altem Schlüssel.
// ----------------------------------------------------------------------------------------------
describe("mega21 A: gleicher Schlüssel mit geändertem Inhalt", () => {
  it("liefert einen AUSDRÜCKLICHEN Fehler statt still das alte Objekt", async () => {
    // DER VERLUSTPFAD. Der Nutzer schickt ab, die Antwort geht verloren, er ändert seinen Text und
    // klickt erneut. mega20 lieferte ihm das ALTE Objekt, die Oberfläche leerte danach die
    // Eingaben und zeigte die generische Erfolgskarte — die Änderung war weg, ohne einen Hinweis.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);

    const erst = await ausDokument(app, headers, {
      operationId: "inhalt-geaendert-1",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(erst.statusCode).toBe(201);

    const geaendert = await ausDokument(app, headers, {
      operationId: "inhalt-geaendert-1",
      create: { ...INHALT, bodyHtml: "<p>Dichtung nach 250 h tauschen.</p>" },
      documents: bündel(objectId),
    });
    expect(geaendert.statusCode).toBe(409);
    expect(geaendert.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    // KEIN stiller Alt-Erfolg: die Antwort ist kein Wissensobjekt.
    expect(geaendert.json().id).toBeUndefined();
    // Und es ist auch kein zweites entstanden.
    expect(await bestand(app, headers)).toHaveLength(1);
  });

  it("eine ANDERE Belegstelle ist ebenfalls ein anderer Inhalt — der Belegvertrag ist Teil des Abdrucks", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const erst = await ausDokument(app, headers, {
      operationId: "beleg-geaendert-1",
      create: INHALT,
      documents: bündel(objectId),
    });
    expect(erst.statusCode).toBe(201);

    const andere = await ausDokument(app, headers, {
      operationId: "beleg-geaendert-1",
      create: INHALT,
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Pruefbericht.pdf", excerpt: "Sichtpruefung vor jedem Anlauf." }],
        },
      ],
    });
    expect(andere.statusCode).toBe(409);
    expect(andere.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
  });

  it("die WIEDERHOLUNG mit unverändertem Inhalt bleibt eine Wiederholung (200, dasselbe Objekt)", async () => {
    // Die wichtigste Kalibrierung dieses Abschnitts: der Abdruck darf den Regelfall nicht kaputt
    // machen, für den der Schlüssel überhaupt existiert.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "unveraendert-1",
      create: INHALT,
      documents: bündel(objectId),
    };
    const erst = await ausDokument(app, headers, payload);
    expect(erst.statusCode).toBe(201);
    const zweit = await ausDokument(app, headers, payload);
    expect(zweit.statusCode).toBe(200);
    expect(zweit.json().id).toBe(erst.json().id);
  });
});

// ----------------------------------------------------------------------------------------------
// 3. DER ZUSTAND (bens SB-4) — ein Reparaturrest ist kein Erfolg.
// ----------------------------------------------------------------------------------------------
describe("mega21 A: der Reparaturrest wird beim Wiederholversuch NICHT als Erfolg geliefert", () => {
  function dienst() {
    const repo = new InMemoryKoRepo();
    const versions = new InMemoryKoVersionRepo();
    const evidence = new InMemoryEvidenceRepo();
    const auditRepo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo: auditRepo });
    const service = new KoService({ repo, versions, evidence, audit });
    return { repo, versions, evidence, auditRepo, service };
  }

  const EIN_BÜNDEL = [
    {
      anchor: { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" },
      sources: [{ label: "P.pdf", excerpt: "eins" }],
    },
  ];
  const VORGANG = { id: "rest-adoption-1", actor: "u1", fingerprint: "fp-rest-1" };

  it("Anlage UND Rücknahme scheitern ⇒ der Rest trägt `repair_required`, und der zweite Versuch bekommt CREATE_REPAIR_REQUIRED", async () => {
    const { repo, evidence, service } = dienst();
    const kaputt = vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));
    const nichtLoeschbar = vi.spyOn(repo, "delete").mockRejectedValue(new Error("delete kaputt"));

    const fehler = await service
      .createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, VORGANG)
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(fehler).toMatchObject({ code: "CREATE_ROLLBACK_FAILED" });

    // DER ZUSTAND STEHT AM VORGANG — nicht nur als Vermerk, sondern als Vorgangs-Zustand.
    const rest = await repo.list({});
    expect(rest).toHaveLength(1);
    expect(rest[0]?.createOperation?.state).toBe("repair_required");
    expect(rest[0]?.createOperation?.actor).toBe("u1");
    expect(rest[0]?.needsRepair).toBeDefined();

    // Die Störung ist vorbei, der Nutzer klickt erneut (der Client behält den Schlüssel bei 5xx).
    kaputt.mockRestore();
    nichtLoeschbar.mockRestore();
    const zweiter = await service
      .createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, VORGANG)
      .then(
        () => null,
        (e: unknown) => e,
      );
    // mega20 hätte hier den unvollständig belegten Rest als ERFOLG zurückgegeben.
    expect(zweiter).toMatchObject({ code: "CREATE_REPAIR_REQUIRED" });
    expect((zweiter as { details?: { koId?: string } }).details?.koId).toBe(rest[0]?.id);
    // Und es ist kein zweites Objekt entstanden.
    expect(await repo.list({})).toHaveLength(1);
  });

  it("scheitert auch die MARKIERUNG, greift die zweite Spur: `needsRepair` fehlt, aber der Rest bleibt unadoptierbar", async () => {
    // Der Vermerk ist best effort — er kann in derselben Störung ausfallen. Genau deshalb liest
    // die Adoption BEIDE Spuren desselben Zustands. Fällt der Write ganz aus, trägt der Rest
    // weder Vermerk noch Zustand; dann ist er von einem gesunden Objekt nicht zu unterscheiden.
    // Diese ehrliche Grenze wird hier festgehalten, damit niemand sie später für einen Bug hält.
    const { repo, evidence, service } = dienst();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));
    vi.spyOn(repo, "delete").mockRejectedValue(new Error("delete kaputt"));
    vi.spyOn(repo, "update").mockRejectedValue(new Error("update kaputt"));

    await service
      .createWithDocuments({ ...INHALT, type: "best_practice", author: "u1" }, EIN_BÜNDEL, {
        ...VORGANG,
        id: "rest-adoption-2",
      })
      .catch(() => undefined);

    const rest = await repo.list({});
    expect(rest).toHaveLength(1);
    expect(rest[0]?.needsRepair).toBeUndefined();
    expect(rest[0]?.createOperation?.state).toBe("committed");
    // Die BENANNTE Grenze: dieser Rest ist adoptierbar, weil beide Spuren fehlen. Der geworfene
    // CREATE_ROLLBACK_FAILED mit der Objektkennung bleibt der dritte, unabhängige Kanal.
  });
});

// ----------------------------------------------------------------------------------------------
// 4. DIE GEGENPROBE IM WORTLAUT — ein unbekannter Vorgang kürzt NICHTS ab.
// ----------------------------------------------------------------------------------------------
describe("mega21 A: die Gegenprobe", () => {
  it("eine UNBEKANNTE Kennung läuft weiterhin durch JEDES Tor — das Original wird unverändert im Bestand nachgeschlagen", async () => {
    // Der Nachschlag steht ganz vorne. Genau deshalb muss belegt sein, dass er nichts ABKÜRZT: eine
    // unbekannte Kennung liefert `null`, und der Ablauf läuft ungekürzt weiter — hier bis in die
    // Objektprüfung, die eine erfundene `objectId` abweist.
    const { app, headers } = await setup();
    const res = await ausDokument(app, headers, {
      operationId: "gegenprobe-unbekannt-1",
      create: INHALT,
      documents: bündel("gibt-es-nicht"),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Unbekannte objectId");
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("der Vorgangs-Datensatz ist über die öffentliche Schreibroute NICHT setzbar", async () => {
    // Dieselbe Gegenprobe wie mega20 für `createOperationId`, jetzt für Eigentümer und Abdruck.
    // Könnte ein Client sie durchreichen, hinge sich jeder an jeden fremden Vorgang.
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        ...INHALT,
        createOperation: { actor: "jemand-anderes", fingerprint: "egal", state: "committed" },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().createOperation).toBeUndefined();
  });

  it("ein Vorgang OHNE Eigentümer wird am Service hart abgelehnt (kein stiller Rückfall auf den Autor)", async () => {
    const repo = new InMemoryKoRepo();
    const service = new KoService({ repo });
    await expect(
      service.createWithDocuments(
        { ...INHALT, type: "best_practice", author: "u1" },
        [
          {
            anchor: { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" },
            sources: [{ label: "P.pdf" }],
          },
        ],
        { id: "ohne-eigentuemer-1", actor: "   ", fingerprint: "fp" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_OPERATION_ID" });
    expect(await repo.list({})).toHaveLength(0);
  });
});
