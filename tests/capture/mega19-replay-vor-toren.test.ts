import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitDocumentAppend } from "../../apps/web/src/lib/appendToArticle";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

// ==============================================================================================
// AUFTRAG-mega19 Block A — DER REPLAY-NACHSCHLAG STEHT VOR DEN VERÄNDERLICHEN TOREN.
// ==============================================================================================
//
// DER BEFUND. Der Service ist idempotent — die Kennung wird validiert und nie ersetzt, der
// Nachschlag liegt innerhalb des per-KO-Locks auf dem frisch gelesenen Objekt, gleiche Kennung
// liefert gleiche IDs und gleiche Version. Nur: die ROUTE kam nie dort an. Vor
// `appendDocumentExtract` las und prüfte sie erneut — Anhangzahl, gespeicherte Objektgröße,
// externe Stufe je Punkt. Alles drei sind VERÄNDERLICHE Tatsachen, und die erste davon ändert der
// erste Aufruf SELBST.
//
// Der deterministische Gegenfall, den dieser Test fährt:
//   das KO hat `maxAttachments - 1` Anhänge
//   · Aufruf 1 besteht die Vorprüfung und committet Anker, Belegstellen und Body
//   · die Antwort erreicht den Browser nicht
//   · der identische Retry mit DERSELBEN Kennung sieht jetzt `maxAttachments` und antwortet
//     BAD_REQUEST — BEVOR der Service die bekannte Kennung sehen kann.
//
// UND DIE FOLGE IST DATENVERLUST, nicht bloß eine hässliche Meldung: der Client führt
// BAD_REQUEST als EINDEUTIGE Ablehnung (apps/web/src/lib/appendToArticle.ts,
// DEFINITE_APPEND_REJECTIONS). Im KO-Detail setzt ein eindeutiger Fehler `appendUnclear` auf
// `false` — der lokale, ALTE Editorstand wird wieder speicherbar, obwohl der Server bereits die
// neue Version trägt. Das nächste Speichern überschreibt den gerade committeten Dokumentinhalt.
//
// DIE GEWÄHLTE FORM. Von bens zwei zulässigen Formen — Nachschlag vorziehen oder getrennter
// authentisierter Status-Endpunkt — ist es die ERSTE. Begründung im Vollzug: siehe den
// ausgeschriebenen Absatz in services/app/src/routes/ko-routes.ts (Block-A-Kommentar vor
// `lookupDocumentAppend`). Kurz: ein Status-Endpunkt verlangt vom Client eine zweite Runde und
// damit einen zweiten Zustand, in dem ein Netzfehler auftreten kann — er verschiebt das Fenster,
// statt es zu schließen; und er wäre eine neue öffentliche Oberfläche mit eigener Rechteprüfung.
//
// bens Auflage wörtlich, und sie ist die Messlatte dieses Tests: „Authentisierung und
// unveraenderliche Formpruefungen duerfen vor dem Replay bleiben; der gespeicherte
// Operationsstatus muss aber vor allen veraenderlichen Kapazitaets- und Policy-Gates abgefragt
// werden."

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

let vorherigeOrigins: string | undefined;
beforeEach(() => {
  vorherigeOrigins = process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = "intranet.werk.local";
});
afterEach(() => {
  if (vorherigeOrigins === undefined) {
    delete process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  } else {
    process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = vorherigeOrigins;
  }
});

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
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
      bodyHtml: "<p>Alter Stand.</p>",
    },
  });
  expect(ko.statusCode).toBe(201);
  return { app, headers, koId: ko.json().id as string };
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

/** Setzt die Admin-Grenze so, dass GENAU EIN Anhang je Objekt erlaubt ist. */
async function anhangsgrenzeAufEins(app: App, headers: Record<string, string>) {
  const res = await app.inject({
    method: "PUT",
    url: "/api/upload-limits",
    headers,
    payload: { maxAttachments: 1, maxAttachmentBytes: 20_000_000 },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().maxAttachments).toBe(1);
}

async function stufeSetzen(app: App, headers: Record<string, string>, stage: string) {
  const res = await app.inject({
    method: "PUT",
    url: "/api/external/policy",
    headers,
    payload: { stage },
  });
  expect(res.statusCode).toBe(200);
}

function uebernehmen(
  app: App,
  headers: Record<string, string>,
  koId: string,
  appendDocument: Record<string, unknown>,
) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "append-document", appendDocument },
  });
}

async function koLesen(app: App, headers: Record<string, string>, koId: string) {
  const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
  expect(res.statusCode).toBe(200);
  return res.json();
}

// ----------------------------------------------------------------------------------------------
// 1. DER GEFÜLLTE LETZTE ANHANGPLATZ — bens deterministischer Gegenfall.
// ----------------------------------------------------------------------------------------------
describe("mega19 A: der Retry mit gefülltem letztem Anhangplatz", () => {
  it("erster Commit füllt den letzten Platz · Antwortverlust · gleicher Retry ⇒ 200 replayed", async () => {
    const { app, headers, koId } = await setup();
    // Die Admin-Grenze auf 1: das KO hat 0 Anhänge, also ist NACH dem ersten Commit der letzte
    // Platz belegt. Genau bens Lage „maxAttachments - 1", nur mit der kleinstmöglichen Grenze.
    await anhangsgrenzeAufEins(app, headers);
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "mega19-letzter-platz-1",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
      changes: { bodyHtml: "<p>Alter Stand.</p><p>Dichtung nach 500 h tauschen.</p>" },
    };

    const erst = await uebernehmen(app, headers, koId, payload);
    expect(erst.statusCode).toBe(200);
    expect(erst.json().replayed).toBe(false);
    // ANTWORTVERLUST: der Browser sieht diese Antwort nie. Für den Server ist das nicht
    // unterscheidbar von einem Erfolg — deshalb wird hier NICHTS simuliert außer dem, was der
    // Client tut: derselbe Aufruf, dieselbe Kennung, noch einmal.

    // Vorbedingung ausgeschrieben, damit der Test nicht aus Versehen an einem leeren Objekt grün ist:
    const zwischen = await koLesen(app, headers, koId);
    expect(zwischen.attachments).toHaveLength(1); // der letzte Platz IST belegt

    const nochmal = await uebernehmen(app, headers, koId, payload);

    // DIE ZUSAGE: niemals BAD_REQUEST. Der Vorgang ist durch, und das erfährt der Aufrufer.
    expect(nochmal.statusCode).not.toBe(400);
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json().replayed).toBe(true);
    expect(nochmal.json().koVersion).toBe(erst.json().koVersion);
    expect(nochmal.json().attachmentId).toBe(erst.json().attachmentId);
    expect(nochmal.json().sourceIds).toEqual(erst.json().sourceIds);

    // Und die Wiederholung hat NICHTS geschrieben — sie hat nachgeschlagen.
    const nachher = await koLesen(app, headers, koId);
    expect(nachher.attachments).toHaveLength(1);
    expect(nachher.sources).toHaveLength(1);
    expect(nachher.version).toBe(zwischen.version);
  });

  it("GEGENPROBE: eine NEUE Kennung am vollen Objekt wird weiterhin abgelehnt (das Tor steht)", async () => {
    // Der Nachschlag darf nur die WIEDERHOLUNG durchlassen, nicht das Tor abschaffen. Wäre das
    // Gate gelockert statt der Nachschlag vorgezogen, ginge dieser Aufruf durch — er darf nicht.
    const { app, headers, koId } = await setup();
    await anhangsgrenzeAufEins(app, headers);
    const objectId = await objektAnlegen(app, headers);
    const anchor = { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" };
    const points = [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }];

    const erst = await uebernehmen(app, headers, koId, {
      operationId: "mega19-gegenprobe-a",
      anchor,
      points,
    });
    expect(erst.statusCode).toBe(200);

    const neuerVorgang = await uebernehmen(app, headers, koId, {
      operationId: "mega19-gegenprobe-b",
      anchor,
      points,
    });
    expect(neuerVorgang.statusCode).toBe(400);
    expect(neuerVorgang.json().message).toContain("Maximal 1 Anhänge");

    const nachher = await koLesen(app, headers, koId);
    expect(nachher.attachments).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 2. DIE ZWISCHENZEITLICH VERSCHÄRFTE STUFE — dasselbe Grundproblem, anderes Tor.
// ----------------------------------------------------------------------------------------------
describe("mega19 A: der Retry nach verschärfter External-Stage", () => {
  it("Commit auf `open` · Antwortverlust · Stufe auf `blocked` · gleicher Retry ⇒ 200 replayed", async () => {
    const { app, headers, koId } = await setup("open");
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "mega19-stufe-verschaerft-1",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      // Eine ÖFFENTLICHE Adresse: auf `open` erlaubt, auf `blocked` verboten. Genau die
      // Belegstelle, an der sich die Stufenverschärfung auswirkt.
      points: [{ label: "Herstellerhinweis", url: "https://example.org/hinweis", excerpt: "x" }],
      changes: { bodyHtml: "<p>Alter Stand.</p><p>Neu.</p>" },
    };

    const erst = await uebernehmen(app, headers, koId, payload);
    expect(erst.statusCode).toBe(200);
    expect(erst.json().replayed).toBe(false);

    // Zwischen Antwortverlust und Wiederholung dreht ein Administrator die Stufe zu.
    await stufeSetzen(app, headers, "blocked");
    // Beleg, dass die Verschärfung WIRKT (sonst wäre der Test unten nichtssagend): eine NEUE
    // Übernahme derselben Belegstelle wird jetzt mit 403 abgelehnt.
    const neuerVorgang = await uebernehmen(app, headers, koId, {
      ...payload,
      operationId: "mega19-stufe-verschaerft-neu",
    });
    expect(neuerVorgang.statusCode).toBe(403);
    expect(neuerVorgang.json().error).toBe("EXTERNAL_ATTACH_BLOCKED");

    // Die WIEDERHOLUNG dagegen ist kein neues Anhängen — sie fragt nach einem abgeschlossenen
    // Vorgang. Sie darf nicht an einer Regel scheitern, die zum Zeitpunkt der Tat nicht galt.
    const nochmal = await uebernehmen(app, headers, koId, payload);
    expect(nochmal.statusCode).not.toBe(403);
    expect(nochmal.statusCode).not.toBe(400);
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json().replayed).toBe(true);
    expect(nochmal.json().sourceIds).toEqual(erst.json().sourceIds);

    // Nichts Neues entstanden — der abgelehnte NEUE Vorgang hat nichts hinterlassen, die
    // Wiederholung auch nicht.
    const nachher = await koLesen(app, headers, koId);
    expect(nachher.attachments).toHaveLength(1);
    expect(nachher.sources).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 3. DIE DATENVERLUSTKANTE IM CLIENT — `appendUnclear` fällt nicht mehr über einen 400.
// ----------------------------------------------------------------------------------------------
describe("mega19 A: der Ausgang, den das KO-Detail zu sehen bekommt", () => {
  it("Antwortverlust am vollen Objekt ⇒ `committed`, NIE `rejected` (kein stiller Freigabe-Schalter)", async () => {
    // Das ist die Naht, an der der Datenverlust entstand. `commitDocumentAppend` (die echte
    // Client-Ablauflogik, ohne DOM) wiederholt bei unklarem Ausgang GENAU EINMAL mit derselben
    // Kennung. Hier läuft diese Wiederholung gegen den ECHTEN Server.
    //
    // Vorher: Versuch 1 committet, die Antwort geht verloren ⇒ `unknown`; Versuch 2 bekommt
    // BAD_REQUEST („Maximal 1 Anhänge") ⇒ `rejected`. Und `rejected` ist im KO-Detail der Zweig,
    // der `setAppendUnclear(false)` ausführt, OHNE den Editor nachzuziehen
    // (apps/web/src/pages/KnowledgeDetail.tsx) — der alte Body wird wieder speicherbar und
    // überschreibt die committete Fassung.
    //
    // Jetzt: Versuch 2 bekommt das Commit-Ergebnis. Der Ausgang ist `committed`, der Zweig, der
    // die Sperre ohne Nachziehen löst, wird NICHT betreten.
    const { app, headers, koId } = await setup();
    await anhangsgrenzeAufEins(app, headers);
    const objectId = await objektAnlegen(app, headers);
    const NEUER_BODY = "<p>Alter Stand.</p><p>Dichtung nach 500 h tauschen.</p>";

    let versuch = 0;
    const outcome = await commitDocumentAppend(
      {
        append: async (operationId: string) => {
          versuch += 1;
          const res = await uebernehmen(app, headers, koId, {
            operationId,
            anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
            points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
            changes: { bodyHtml: NEUER_BODY },
          });
          if (versuch === 1) {
            // DER ANTWORTVERLUST. Der Server hat committet; der Browser erfährt es nicht.
            throw new Error("network down");
          }
          if (res.statusCode >= 400) {
            throw Object.assign(new Error(res.json().message), { code: res.json().error });
          }
          return res.json();
        },
      },
      "mega19-client-antwortverlust",
    );

    expect(versuch).toBe(2); // genau eine Wiederholung, mit derselben Kennung
    // DIE ZUSAGE: kein „rejected". Damit ist der Zweig unerreichbar, der `appendUnclear` auf
    // `false` setzt, während der Editor noch den alten Stand trägt.
    expect(outcome.kind).not.toBe("rejected");
    expect(outcome.kind).toBe("committed");
    expect(outcome.commit?.replayed).toBe(true);

    // Und der Zustand, auf den der Editor gleich nachzieht, IST der committete: derselbe Body,
    // den der Client mitgeschickt hat. Ein anschließendes Speichern schreibt also nichts Altes
    // fest — es gibt keinen Auseinanderlauf mehr.
    const nachher = await koLesen(app, headers, koId);
    expect(nachher.bodyHtml).toContain("Dichtung nach 500 h tauschen.");
    expect(nachher.attachments).toHaveLength(1);
    expect(nachher.sources).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 4. DER NACHSCHLAG SELBST — schreibfrei, und er verrät nichts Fremdes.
// ----------------------------------------------------------------------------------------------
describe("mega19 A: `lookupDocumentAppend` ist eine Abfrage, kein Vollzug", () => {
  it("schreibt NICHTS — weder bei Treffer noch bei Fehlschlag", async () => {
    const repo = new InMemoryKoRepo();
    const service = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      evidence: new InMemoryEvidenceRepo(),
    });
    const ko = await service.create({
      title: "Dichtung",
      statement: "x",
      type: "technik",
      category: "Instandhaltung",
      author: "u1",
    });
    await service.appendDocumentExtract(ko.id, "u1", {
      operationId: "mega19-nachschlag-1",
      anchor: { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" },
      sources: [{ label: "P.pdf", excerpt: "eins" }],
    });

    const updates = vi.spyOn(repo, "update");
    const treffer = await service.lookupDocumentAppend(ko.id, "mega19-nachschlag-1");
    const daneben = await service.lookupDocumentAppend(ko.id, "mega19-nachschlag-unbekannt");

    expect(treffer?.replayed).toBe(true);
    expect(treffer?.committed).toBe(true);
    // Eine unbekannte Kennung ist schlicht `null` — keine Aussage über fremde Vorgänge.
    expect(daneben).toBeNull();
    // KEIN einziger Schreibvorgang. Deshalb ist der vorgezogene Nachschlag kein neues Risiko.
    expect(updates).not.toHaveBeenCalled();
    updates.mockRestore();
  });

  it("eine ungültige Kennung ist ein FORMFEHLER, kein „nicht gefunden“", async () => {
    const service = new KoService({
      repo: new InMemoryKoRepo(),
      evidence: new InMemoryEvidenceRepo(),
    });
    const ko = await service.create({
      title: "Dichtung",
      statement: "x",
      type: "technik",
      category: "Instandhaltung",
      author: "u1",
    });
    // Derselbe Vertrag wie im Vollzug (normalizeAppendOperationId) — sonst hätte der vorgezogene
    // Nachschlag eine EIGENE, laschere Auffassung davon, was eine Kennung ist.
    await expect(service.lookupDocumentAppend(ko.id, "kurz")).rejects.toMatchObject({
      code: "INVALID_OPERATION_ID",
    });
  });
});

// ----------------------------------------------------------------------------------------------
// 5. DIE REIHENFOLGE IN DER ROUTE — statisch gepinnt, damit sie nicht zurückrutscht.
// ----------------------------------------------------------------------------------------------
describe("mega19 A: die Reihenfolge steht fest", () => {
  it("der Nachschlag liegt VOR Anhangzahl, Objektgröße und Stufenprüfung", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("services/app/src/routes/ko-routes.ts", "utf8");
    // Der Abschnitt der Verbund-Operation, nicht die ganze Datei: `attach` weiter oben prüft
    // dieselbe Anhangzahl und würde den Vergleich verfälschen.
    const abschnitt = src.slice(src.indexOf('case "append-document":'));
    expect(abschnitt.length).toBeGreaterThan(0);

    const nachschlag = abschnitt.indexOf("lookupDocumentAppend");
    const anhangzahl = abschnitt.indexOf("limits.maxAttachments");
    const objektgroesse = abschnitt.indexOf("objects.metadata");
    const stufe = abschnitt.indexOf("externalPolicy.getStage");
    const vollzug = abschnitt.indexOf("appendDocumentExtract");

    expect(nachschlag).toBeGreaterThan(0);
    expect(nachschlag).toBeLessThan(anhangzahl);
    expect(nachschlag).toBeLessThan(objektgroesse);
    expect(nachschlag).toBeLessThan(stufe);
    expect(nachschlag).toBeLessThan(vollzug);

    // Was DAVOR bleiben DARF (bens Auflage): Rechteprüfung und unveränderliche Formprüfungen.
    const recht = abschnitt.indexOf('requirePermission("ko.create"');
    const formPunkte = abschnitt.indexOf("appendDocument.points fehlt");
    const formAnker = abschnitt.indexOf("appendDocument.anchor {objectId, name, mime} fehlt");
    expect(recht).toBeGreaterThan(-1);
    expect(recht).toBeLessThan(nachschlag);
    expect(formPunkte).toBeLessThan(nachschlag);
    expect(formAnker).toBeLessThan(nachschlag);
  });
});
