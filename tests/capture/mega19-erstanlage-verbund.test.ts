import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

// ==============================================================================================
// AUFTRAG-mega19 Block B — DIE ERSTANLAGE AUS DOKUMENTEN. EIN VORGANG, ODER KEINER.
// ==============================================================================================
//
// DER BEFUND. `Capture` committete zuerst den vollständigen Body (`create`/`promote`) und baute
// erst DANACH je Ankerdokument einen eigenen `append-document`-Aufruf. Drei reale Brüche:
//
//   · lehnt die erste Verbundoperation ab oder bleibt sie unklar, steht der Dokumentinhalt bereits
//     im neuen Wissensobjekt — Inhalt ohne Herkunft;
//   · bei ZWEI Ankerdokumenten kann Job 1 gelingen und Job 2 scheitern, obwohl der Body Inhalt aus
//     BEIDEN trägt;
//   · der Erfolgs-Handler behandelte den Submit weiterhin als gespeichert und zeigte die fehlende
//     Herkunft nur als Teilfehler.
//
// DIE ABWÄGUNG. `POST /api/kos` wieder für Client-`sources` zu öffnen, wäre die billige Reparatur —
// und sie fällt aus: über diese Grenze (SCRUM-470) könnte jeder mit `ko.create` gefälschte,
// peer-validierte Herkunftsanker setzen. Das Restfenster hinzunehmen war aber ebenso falsch.
// Deshalb dieser Weg: die allgemeine Route bleibt streng, die FACHOPERATION kommt DANEBEN
// (`POST /api/kos/from-document`) — dieselbe Bewegung wie bei der Verbund-Operation in mega18.
//
// Diese Datei belegt beides: dass die Komposition hält, UND dass die alte Grenze unberührt steht.

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

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

// AUFTRAG-mega20 Block A: die Route verlangt jetzt einen WIEDERHOLSCHLÜSSEL (`operationId`) — ohne
// ihn erzeugte jeder Antwortverlust ein zweites vollständiges Wissensobjekt. Der Helfer setzt je
// Aufruf einen FRISCHEN, damit jeder Test dieser Datei weiterhin einen NEUEN Vorgang beschreibt;
// die Zusicherungen darunter bleiben unverändert. Ein aufrufseitig gesetzter Schlüssel gewinnt
// (mega20 nutzt das für den Wiederholungs-Beleg).
let vorgangsZaehler = 0;
// JOB 2684 D4: der Dokumentweg mit `draftId` verlangt den beim Laden gesehenen Stand
// (`expectedUpdatedAt`, sonst 400 DRAFT_STAND_FEHLT). Der Test holt ihn wie der Client — über
// `GET /api/drafts/:id` — sofern der Aufruf keinen mitbringt und der Entwurf sichtbar ist. Ist er
// fremd (403/404), reist kein Stand: die Sichtbarkeitsregel entscheidet zuerst, wie bisher.
async function ausDokument(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) {
  let stand: Record<string, unknown> = {};
  if (typeof payload.draftId === "string" && payload.expectedUpdatedAt === undefined) {
    const d = await app.inject({ method: "GET", url: `/api/drafts/${payload.draftId}`, headers });
    if (d.statusCode === 200) {
      stand = { expectedUpdatedAt: (d.json() as { updatedAt: string }).updatedAt };
    }
  }
  return app.inject({
    method: "POST",
    url: "/api/kos/from-document",
    headers,
    payload: { operationId: `mega19-vorgang-${++vorgangsZaehler}`, ...payload, ...stand },
  });
}

async function bestand(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode).toBe(200);
  return res.json() as Record<string, unknown>[];
}

const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
};

// ----------------------------------------------------------------------------------------------
// 1. DER GUTE FALL — Inhalt, Anker und Belegstellen entstehen GEMEINSAM.
// ----------------------------------------------------------------------------------------------
describe("mega19 B: die Erstanlage aus Dokumenten", () => {
  it("ein Vorgang erzeugt Body, Anker und Belegstellen — ohne zweite Version", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);

    const res = await ausDokument(app, headers, {
      create: INHALT,
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [
            { label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." },
            { label: "Pruefbericht.pdf", excerpt: "Sichtprüfung vor jedem Anlauf." },
          ],
        },
      ],
    });

    expect(res.statusCode).toBe(201);
    const ko = res.json();
    // Version 1 — es gab keine Nachreichung, also auch keine zweite Fassung.
    expect(ko.version).toBe(1);
    expect(ko.bodyHtml).toContain("Dichtung nach 500 h tauschen.");
    expect(ko.attachments).toHaveLength(1);
    expect(ko.attachments[0].objectId).toBe(objectId);
    expect(ko.sources).toHaveLength(2);
    // Die Belegstellen tragen den Vertrag der Übernahme: nie peer-validiert.
    expect(ko.sources.every((s: { peerValidated: boolean }) => s.peerValidated === false)).toBe(
      true,
    );

    // Und die Belege stehen: Anker UND Belegstellen als Evidence-Records derselben Version.
    const ev = await app.inject({ method: "GET", url: `/api/kos/${ko.id}/evidence`, headers });
    expect(ev.statusCode).toBe(200);
    const records = ev.json() as { kind: string; koVersion: number }[];
    expect(records.filter((r) => r.kind === "attachment")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "source")).toHaveLength(2);
    expect(records.every((r) => r.koVersion === 1)).toBe(true);
  });

  it("ZWEI Ankerdokumente: beide werden gebunden, jede Belegstelle an ihrem eigenen", async () => {
    const { app, headers } = await setup();
    const ersterId = await objektAnlegen(app, headers, "Pruefbericht.pdf");
    const zweiterId = await objektAnlegen(app, headers, "Wartungsplan.pdf");

    const res = await ausDokument(app, headers, {
      create: INHALT,
      documents: [
        {
          anchor: { objectId: ersterId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Pruefbericht.pdf", excerpt: "aus dem Prüfbericht" }],
        },
        {
          anchor: { objectId: zweiterId, name: "Wartungsplan.pdf", mime: "application/pdf" },
          points: [{ label: "Wartungsplan.pdf", excerpt: "aus dem Wartungsplan" }],
        },
      ],
    });

    expect(res.statusCode).toBe(201);
    const ko = res.json();
    expect(ko.attachments).toHaveLength(2);
    expect(ko.sources).toHaveLength(2);
    // Jede Belegstelle hängt an IHREM Dokument — die Zuordnung steht in den Evidence-Records.
    const ev = await app.inject({ method: "GET", url: `/api/kos/${ko.id}/evidence`, headers });
    const records = ev.json() as {
      kind: string;
      label: string;
      attachmentId?: string;
      objectId?: string;
    }[];
    const anker = new Map(
      records.filter((r) => r.kind === "attachment").map((r) => [r.attachmentId, r.objectId]),
    );
    const belegPruef = records.find((r) => r.kind === "source" && r.label === "Pruefbericht.pdf");
    const belegPlan = records.find((r) => r.kind === "source" && r.label === "Wartungsplan.pdf");
    expect(anker.get(belegPruef?.attachmentId)).toBe(ersterId);
    expect(anker.get(belegPlan?.attachmentId)).toBe(zweiterId);
  });
});

// ----------------------------------------------------------------------------------------------
// 2. DER FEHLSCHLAG — es bleibt NICHTS zurück.
// ----------------------------------------------------------------------------------------------
describe("mega19 B: bei einem Fehlschlag bleibt kein Wissensobjekt mit Dokumentinhalt zurück", () => {
  it("unbekanntes Ankerobjekt ⇒ 400, und der Bestand ist LEER", async () => {
    const { app, headers } = await setup();
    expect(await bestand(app, headers)).toHaveLength(0);

    const res = await ausDokument(app, headers, {
      create: INHALT,
      documents: [
        {
          anchor: { objectId: "gibt-es-nicht", name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Pruefbericht.pdf", excerpt: "x" }],
        },
      ],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Unbekannte objectId");
    // DIE ZUSAGE. Bis mega18 stand hier bereits ein Wissensobjekt mit dem vollen Body und ohne
    // jede Herkunft — der Body ging als ERSTES raus.
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("ZWEI Dokumente, das ZWEITE scheitert ⇒ auch das erste ist NICHT gebunden, nichts bleibt", async () => {
    // Der Fall aus dem Auftrag: „Ein Body aus zwei Dokumenten, von denen nur eines gebunden ist,
    // ist derselbe Fehler in klein." Bis mega18 lief Job 1 durch und Job 2 scheiterte — das
    // Wissensobjekt blieb mit halber Herkunft stehen und der Submit meldete „gespeichert".
    const { app, headers } = await setup();
    const ersterId = await objektAnlegen(app, headers, "Pruefbericht.pdf");

    const res = await ausDokument(app, headers, {
      create: INHALT,
      documents: [
        {
          anchor: { objectId: ersterId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Pruefbericht.pdf", excerpt: "aus dem Prüfbericht" }],
        },
        {
          // Das zweite Original gibt es nicht — der Server schlägt jedes Objekt nach.
          anchor: { objectId: "gibt-es-nicht", name: "Wartungsplan.pdf", mime: "application/pdf" },
          points: [{ label: "Wartungsplan.pdf", excerpt: "aus dem Wartungsplan" }],
        },
      ],
    });

    expect(res.statusCode).toBe(400);
    // Weder ein halb belegtes Wissensobjekt noch ein vollständiges: gar keines.
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("eine Belegstelle OHNE Label ⇒ 400, und nichts entsteht", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, {
      create: INHALT,
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "   ", excerpt: "x" }],
        },
      ],
    });
    expect(res.statusCode).toBe(400);
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("scheitert ein BELEG NACH dem Insert, wird das Wissensobjekt kompensierend ENTFERNT", async () => {
    // Die härtere Kante: die Prüfungen sind durch, der Insert ist geschrieben, und erst der
    // Evidence-Beleg scheitert. `create` bleibt an dieser Stelle bewusst untransaktional
    // (WP-SHIP8-CLOSE-5, mit idempotentem Nachzieh-Pfad); die Dokumentübernahme darf das NICHT —
    // ein halb belegtes Übernahme-KO könnte niemand später richtigstellen, weil niemand mehr
    // wüsste, WORAUS der Inhalt stammte.
    const repo = new InMemoryKoRepo();
    const evidence = new InMemoryEvidenceRepo();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("evidence kaputt"));
    const service = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      evidence,
    });

    await expect(
      service.createWithDocuments(
        { ...INHALT, type: "best_practice", author: "u1" },
        [
          {
            anchor: { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" },
            sources: [{ label: "P.pdf", excerpt: "eins" }],
          },
        ],
        // mega20 Block A: der Vorgangsschlüssel ist jetzt Teil des Vertrags.
        // mega21 Block A: und mit ihm der EIGENTÜMER und der Inhaltsabdruck (Vorgangs-Datensatz).
        { id: "mega19-direktaufruf-1", actor: "u1", fingerprint: "fp-mega19-1" },
      ),
    ).rejects.toThrow("evidence kaputt");

    // KEIN Wissensobjekt. Nicht eines mit fehlenden Belegen, nicht eines mit halber Herkunft.
    expect(await repo.list({})).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------------------------------
// 3. DIE BEIDEN REGELN GELTEN HIER GENAUSO.
// ----------------------------------------------------------------------------------------------
describe("mega19 B: dieselben zwei Regeln wie in der Verbund-Operation", () => {
  it("(II) INTERNE BELEGPFLICHT: ohne Anker keine Übernahme — auch auf der erlaubendsten Stufe", async () => {
    const { app, headers } = await setup("open");
    const res = await ausDokument(app, headers, {
      create: INHALT,
      documents: [{ points: [{ label: "Pruefbericht.pdf", excerpt: "x" }] }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("braucht sein Original");
    expect(await bestand(app, headers)).toHaveLength(0);
  });

  it("(I) EXTERNE STUFENREGEL: eine öffentliche Adresse wird auf `blocked` abgewiesen", async () => {
    const { app, headers } = await setup("blocked");
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, {
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
});

// ----------------------------------------------------------------------------------------------
// 4. DIE ALTE GRENZE STEHT — die allgemeine Create-Route ist unverändert streng.
// ----------------------------------------------------------------------------------------------
describe("mega19 B: SCRUM-470 bleibt unberührt", () => {
  it("POST /api/kos verwirft Client-`sources` weiterhin (die Grenze fällt NICHT)", async () => {
    const { app, headers } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        ...INHALT,
        // Genau das, was die Grenze verhindert: ein selbstgesetzter, peer-validierter
        // Herkunftsanker über den öffentlichen Schreibpfad.
        sources: [
          {
            id: "gefaelscht",
            label: "Confluence-Seite",
            url: "https://confluence.example.org/x",
            kind: "external",
            peerValidated: true,
            author: "u1",
            at: "2026-07-01T10:00:00.000Z",
          },
        ],
        importCandidateId: "kandidat-1",
      },
    });
    expect(res.statusCode).toBe(201);
    // Verworfen — nicht übernommen, nicht teilweise übernommen.
    expect(res.json().sources).toHaveLength(0);
    expect(res.json().importCandidateId).toBeUndefined();
  });

  it("GEGENPROBE: auch die NEUE Route übernimmt keine Client-`sources` und keinen Kandidaten-Anker", async () => {
    // Die Fachoperation ist eine ENGERE Tür, keine zweite Kopie der alten Lücke. Was hier an
    // Quellen entsteht, entsteht aus den geprüften Dokumenten — nicht aus einem Client-Feld.
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const res = await ausDokument(app, headers, {
      create: {
        ...INHALT,
        sources: [
          {
            id: "gefaelscht",
            label: "Confluence-Seite",
            url: "https://confluence.example.org/x",
            kind: "external",
            peerValidated: true,
            author: "u1",
            at: "2026-07-01T10:00:00.000Z",
          },
        ],
        importCandidateId: "kandidat-1",
      },
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Pruefbericht.pdf", excerpt: "eins" }],
        },
      ],
    });
    expect(res.statusCode).toBe(201);
    const ko = res.json();
    // GENAU EINE Quelle: die aus dem Dokument. Die untergeschobene ist weg.
    expect(ko.sources).toHaveLength(1);
    expect(ko.sources[0].label).toBe("Pruefbericht.pdf");
    expect(ko.sources[0].peerValidated).toBe(false);
    expect(ko.importCandidateId).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------------------------
// 5. DER ENTWURFSWEG — Fortsetzen ist derselbe eine Vorgang.
// ----------------------------------------------------------------------------------------------
describe("mega19 B: der fortgesetzte Entwurf", () => {
  it("promotet mit Ankern in EINEM Vorgang und entfernt den Entwurf erst danach", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: INHALT,
    });
    expect(draft.statusCode).toBeLessThan(300);
    const draftId = draft.json().id as string;

    const res = await ausDokument(app, headers, {
      draftId,
      // AUFTRAG-mega22 Block C: bei gesetztem `draftId` ist `draftPayload` PFLICHT. `{}` heisst
      // „am gespeicherten Stand nichts ändern" — der Fall, den dieser Test meint.
      draftPayload: {},
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
        },
      ],
    });

    expect(res.statusCode).toBe(201);
    const ko = res.json();
    expect(ko.attachments).toHaveLength(1);
    expect(ko.sources).toHaveLength(1);
    expect(ko.bodyHtml).toContain("Dichtung nach 500 h tauschen.");
    // Der Entwurf ist weg — aber erst, NACHDEM das Wissensobjekt vollständig stand.
    const drafts = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(drafts.json()).toHaveLength(0);
  });

  it("scheitert die Anlage, BLEIBT der Entwurf erhalten (nichts wird nebenbei vernichtet)", async () => {
    const { app, headers } = await setup();
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: INHALT,
    });
    const draftId = draft.json().id as string;

    const res = await ausDokument(app, headers, {
      draftId,
      draftPayload: {},
      documents: [
        {
          anchor: { objectId: "gibt-es-nicht", name: "P.pdf", mime: "application/pdf" },
          points: [{ label: "P.pdf", excerpt: "x" }],
        },
      ],
    });

    expect(res.statusCode).toBe(400);
    expect(await bestand(app, headers)).toHaveLength(0);
    // Die Arbeit des Nutzers steht noch da. Die umgekehrte Reihenfolge (erst Entwurf löschen, dann
    // anlegen) hätte hier beides vernichtet.
    const drafts = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(drafts.json()).toHaveLength(1);
  });

  it("ein FREMDER Entwurf ist auch auf diesem Weg nicht erreichbar (dieselbe Sichtbarkeitsregel)", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: INHALT,
    });
    const draftId = draft.json().id as string;

    // Ein zweiter, NICHT-administrativer Nutzer (Selbstregistrierung ist nach dem Setup zu).
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Bea", email: "b@x.de", password: "secret123", role: "experte" },
    });
    expect(angelegt.statusCode).toBe(201);
    const fremd = await login(app, "b@x.de", "secret123");

    const res = await ausDokument(app, fremd, {
      draftId,
      draftPayload: {},
      documents: [
        {
          anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
          points: [{ label: "Pruefbericht.pdf", excerpt: "x" }],
        },
      ],
    });

    expect([403, 404]).toContain(res.statusCode);
    expect(await bestand(app, headers)).toHaveLength(0);
    const drafts = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(drafts.json()).toHaveLength(1);
  });
});
