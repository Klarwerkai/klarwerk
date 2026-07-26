import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  DOCUMENT_APPEND_OP_MEMORY,
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
  normalizeAppendOperationId,
  requireDocumentEvidence,
} from "../../services/knowledge-object";

// ==============================================================================================
// AUFTRAG-mega18 Block A — DIE VERBUND-OPERATION, UND ALLE WEGE GEHEN HINDURCH.
// ==============================================================================================
//
// Die Zahl der Ship-Blocker ist über die Runden 3 → 3 → 3 → 1 → 5 gegangen, und der Grund war nie
// eine falsche Reparatur, sondern der ORT der Reparatur: dreimal wurden Aufrufreihenfolgen im
// Browser sortiert, wo eine Server-Aufgabe lag. Diese Datei belegt die Server-Aufgabe.
//
// Die vier von ben belegten Ist-Zustände und der Mechanismus, der sie jetzt UNMÖGLICH macht:
//
//  (1) Der unklare Revisionsausgang  → IDEMPOTENZ (derselbe Aufruf, ein Ergebnis)
//  (2) Der speicherbare Zwischenstand → EIN Commit für Inhalt UND Herkunft
//  (3) Der parallele Compare-and-Set  → GENAU EIN repo.update je Vorgang
//  (4) Die geschluckte Ankerlücke     → requireDocumentEvidence WIRFT, stufenunabhängig
//
// Und der Befund, der die Wurzel von bens SB-3 ist: die INTERNE BELEGPFLICHT war stillschweigend
// an die EXTERNE STUFENREGEL delegiert. Deshalb war auf `search_attach` und `open` gar kein Anker
// gefordert. Zwei verschiedene Regeln — hier wird belegt, dass sie jetzt getrennt sind.

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

/** Legt ein echtes Objekt im Objektspeicher an — über die ECHTE Route, kein Bestands-Schreiben. */
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

const ZWEI_PUNKTE = [
  { label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." },
  { label: "Pruefbericht.pdf", excerpt: "Drehmoment 42 Nm einhalten." },
];

// ----------------------------------------------------------------------------------------------
// 1. INHALT UND HERKUNFT KOMMEN GEMEINSAM AN — der Kernvertrag, an der echten Route.
// ----------------------------------------------------------------------------------------------
describe("mega18 A-1: ein Aufruf, ein Commit — Inhalt UND Herkunft", () => {
  it("bindet Anker, alle Belegstellen und die Revision und meldet EINDEUTIG, was gilt", async () => {
    const { app, headers, koId } = await setup();
    const objectId = await objektAnlegen(app, headers);

    const res = await uebernehmen(app, headers, koId, {
      operationId: "append-vorgang-1",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: ZWEI_PUNKTE,
      changes: { bodyHtml: "<p>Alter Stand.</p><p>Dichtung nach 500 h tauschen.</p>" },
    });

    expect(res.statusCode).toBe(200);
    const commit = res.json();
    // DAS EINDEUTIGE COMMIT-ERGEBNIS: der Aufrufer erfährt OHNE RÜCKFRAGE, was gilt.
    expect(commit.committed).toBe(true);
    expect(commit.replayed).toBe(false);
    expect(commit.koVersion).toBe(2); // Revision hat stattgefunden
    expect(commit.sourceIds).toHaveLength(2);
    expect(typeof commit.attachmentId).toBe("string");

    // Und der BESTAND — nicht die Aufrufreihenfolge — trägt beides.
    const ko = await koLesen(app, headers, koId);
    expect(ko.version).toBe(2);
    expect(ko.bodyHtml).toContain("Dichtung nach 500 h tauschen.");
    expect(ko.sources).toHaveLength(2);
    // JEDE Belegstelle ist adresslos (Dokumentauszug) und trägt ihren Auszug.
    for (const source of ko.sources) {
      expect(source.url).toBeNull();
      expect(source.peerValidated).toBe(false);
      expect(source.kind).toBe("external");
    }
    expect(ko.sources.map((s: { excerpt: string }) => s.excerpt)).toEqual([
      "Dichtung nach 500 h tauschen.",
      "Drehmoment 42 Nm einhalten.",
    ]);
    // DER ANKER liegt wirklich am Objekt — die Referenz hat Deckung, sie ist keine Behauptung.
    const anker = ko.attachments.find((a: { id: string }) => a.id === commit.attachmentId);
    expect(anker.objectId).toBe(objectId);
    // Die Revisions-Semantik bleibt unverändert: neu zu prüfen, Trust zurückgesetzt.
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    // Und die Historie benennt den Vorgang, statt ihn rekonstruieren zu lassen.
    expect(ko.history.at(-1).note).toContain("Dokumentinhalt übernommen");
  });

  it("ohne `changes` (Erfassen) bindet sie NUR Anker + Belege — keine zweite Version", async () => {
    const { app, headers, koId } = await setup();
    const objectId = await objektAnlegen(app, headers);

    const res = await uebernehmen(app, headers, koId, {
      operationId: "append-erfassen-1",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: ZWEI_PUNKTE,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().koVersion).toBe(1); // Inhalt kam mit `create`, kein Versions-Bump
    const ko = await koLesen(app, headers, koId);
    expect(ko.version).toBe(1);
    expect(ko.sources).toHaveLength(2);
    expect(ko.attachments).toHaveLength(1);
    // Kein Status-Reset: es gab keine Revision, also darf auch nichts entwertet werden.
    expect(ko.history).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 2. DIE IDEMPOTENZ — die Antwort auf den unklaren Revisionsausgang.
// ----------------------------------------------------------------------------------------------
describe("mega18 A-1: Idempotenz — zweimal derselbe Aufruf, EIN Ergebnis", () => {
  it("liefert beim zweiten Aufruf dasselbe Ergebnis, ohne ein zweites Mal zu schreiben", async () => {
    const { app, headers, koId } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const payload = {
      operationId: "append-wiederholt-1",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: ZWEI_PUNKTE,
      changes: { bodyHtml: "<p>Neu.</p>" },
    };

    const erst = await uebernehmen(app, headers, koId, payload);
    const nochmal = await uebernehmen(app, headers, koId, payload);

    expect(erst.statusCode).toBe(200);
    expect(nochmal.statusCode).toBe(200);
    // EIN Ergebnis — und die Wiederholung sagt ehrlich, dass sie eine war.
    expect(erst.json().replayed).toBe(false);
    expect(nochmal.json().replayed).toBe(true);
    expect(nochmal.json().koVersion).toBe(erst.json().koVersion);
    expect(nochmal.json().sourceIds).toEqual(erst.json().sourceIds);
    expect(nochmal.json().attachmentId).toBe(erst.json().attachmentId);

    // Kein doppelter Anhang, keine doppelten Quellen, KEINE zweite Revision.
    const ko = await koLesen(app, headers, koId);
    expect(ko.version).toBe(2);
    expect(ko.sources).toHaveLength(2);
    expect(ko.attachments).toHaveLength(1);
  });

  it("eine ANDERE Kennung ist ein anderer Vorgang und wird vollzogen (kein Über-Deduplizieren)", async () => {
    const { app, headers, koId } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const anchor = { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" };

    await uebernehmen(app, headers, koId, {
      operationId: "append-a",
      anchor,
      points: [ZWEI_PUNKTE[0]],
      changes: { bodyHtml: "<p>Eins.</p>" },
    });
    const zweiter = await uebernehmen(app, headers, koId, {
      operationId: "append-b",
      anchor,
      points: [ZWEI_PUNKTE[1]],
      changes: { bodyHtml: "<p>Eins.</p><p>Zwei.</p>" },
    });

    expect(zweiter.json().replayed).toBe(false);
    const ko = await koLesen(app, headers, koId);
    expect(ko.version).toBe(3);
    expect(ko.sources).toHaveLength(2);
  });

  it("eine unbrauchbare Kennung wird ehrlich abgelehnt — nie durch eine erfundene ersetzt", async () => {
    const { app, headers, koId } = await setup();
    const objectId = await objektAnlegen(app, headers);
    for (const operationId of ["", "kurz", "hat leerzeichen und ist lang genug", "a".repeat(200)]) {
      const res = await uebernehmen(app, headers, koId, {
        operationId,
        anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
        points: ZWEI_PUNKTE,
        changes: { bodyHtml: "<p>Neu.</p>" },
      });
      expect(res.statusCode, operationId).toBe(400);
      expect(res.json().error, operationId).toBe("INVALID_OPERATION_ID");
    }
    // Und der Bestand ist unberührt: eine abgelehnte Kennung schreibt nichts.
    const ko = await koLesen(app, headers, koId);
    expect(ko.version).toBe(1);
    expect(ko.sources).toHaveLength(0);
    expect(ko.attachments).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------------------------------
// 3. DIE INTERNE BELEGPFLICHT — auf ALLEN VIER STUFEN, unabhängig von der externen Stufenregel.
// ----------------------------------------------------------------------------------------------
describe("mega18 A-2: die Belegpflicht ist eine EIGENE Regel — alle vier Stufen", () => {
  // DER EIGENTLICHE BEFUND. Bis mega17 war auf `search_attach` und `open` gar kein Anker gefordert,
  // weil dort die EXTERNE Stufenregel nichts zu prüfen hatte — und wir hatten die INTERNE
  // Belegpflicht stillschweigend an sie delegiert. Diese Tabelle ist der Beleg, dass die Delegation
  // aufgelöst ist: alle vier Stufen, dasselbe Urteil.
  for (const stage of ["blocked", "search_on_click", "search_attach", "open"]) {
    it(`Stufe "${stage}": ohne Anker bricht die Übernahme ab, Bestand unberührt`, async () => {
      const { app, headers, koId } = await setup(stage);

      const res = await uebernehmen(app, headers, koId, {
        operationId: `append-ohne-anker-${stage}`,
        // Kein `anchor` — genau der Fall, den `composeAppendToArticle` bis mega17 mit
        // `anchor = undefined` weitergeführt hat.
        points: ZWEI_PUNKTE,
        changes: { bodyHtml: "<p>Text ohne Beleg.</p>" },
      });

      expect(res.statusCode).toBe(400);
      // Der Bestand: KEINE Revision, KEINE Quelle, KEIN Anhang.
      const ko = await koLesen(app, headers, koId);
      expect(ko.version).toBe(1);
      expect(ko.bodyHtml).not.toContain("Text ohne Beleg");
      expect(ko.sources).toHaveLength(0);
      expect(ko.attachments).toHaveLength(0);
    });

    it(`Stufe "${stage}": eine ERFUNDENE objectId belegt nichts`, async () => {
      const { app, headers, koId } = await setup(stage);

      const res = await uebernehmen(app, headers, koId, {
        operationId: `append-erfunden-${stage}`,
        anchor: { objectId: "obj-gibt-es-nicht", name: "Fake.pdf", mime: "application/pdf" },
        points: ZWEI_PUNKTE,
        changes: { bodyHtml: "<p>Text ohne Beleg.</p>" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("Unbekannte objectId");
      const ko = await koLesen(app, headers, koId);
      expect(ko.version).toBe(1);
      expect(ko.sources).toHaveLength(0);
    });
  }

  it("die reine Regel kennt die Stufe GAR NICHT — sie ist nicht erweichbar", () => {
    // Der Beleg steht in der SIGNATUR: `requireDocumentEvidence` nimmt keine Stufe. Wer sie später
    // von der Stufe abhängig machen wollte, müsste den Parameter hinzufügen — und würde damit
    // sichtbar die Delegation wiederherstellen, die mega18 aufgelöst hat.
    expect(requireDocumentEvidence.length).toBe(1);
    expect(requireDocumentEvidence({ anchorObjectId: "obj-1" })).toBe("obj-1");
    for (const leer of [undefined, null, "", "   "]) {
      // WIRFT — kein `false`, das ein Aufrufer ignorieren könnte, kein Ersatzwert.
      expect(() => requireDocumentEvidence({ anchorObjectId: leer })).toThrowError(
        /Original als Beleg/,
      );
    }
  });

  it("die Stufenregel bleibt daneben in Kraft: öffentliche Adresse scheitert auf blocked", async () => {
    // Zwei Regeln, zwei Gründe. Die Belegpflicht ist erfüllt (echter Anker) — und die EXTERNE
    // Stufenregel greift trotzdem, weil die Belegstelle eine öffentliche Adresse trägt.
    const { app, headers, koId } = await setup("blocked");
    const objectId = await objektAnlegen(app, headers);

    const res = await uebernehmen(app, headers, koId, {
      operationId: "append-oeffentliche-adresse",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: [{ label: "Wikipedia", url: "https://de.wikipedia.org/wiki/Dichtung", excerpt: "x" }],
      changes: { bodyHtml: "<p>Neu.</p>" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("EXTERNAL_ATTACH_BLOCKED");
    expect(res.json().reason).toBe("public-source");
    const ko = await koLesen(app, headers, koId);
    expect(ko.version).toBe(1);
    expect(ko.sources).toHaveLength(0);
  });

  it("eine Übernahme OHNE Belegstelle ist ein Fehler, keine leere Übernahme", async () => {
    const { app, headers, koId } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const res = await uebernehmen(app, headers, koId, {
      operationId: "append-ohne-punkte",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: [],
      changes: { bodyHtml: "<p>Text.</p>" },
    });
    expect(res.statusCode).toBe(400);
    expect((await koLesen(app, headers, koId)).version).toBe(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 4. DER PARALLELE COMPARE-AND-SET — strukturell gelöst, nicht bloß serialisiert.
// ----------------------------------------------------------------------------------------------
describe("mega18 A-1: zwei Punkte gleichzeitig — kein STALE_WRITE-Verlust", () => {
  it("zwei Belegstellen landen in EINEM Schreibvorgang; keine verliert", async () => {
    // Bis mega17 liefen die Punktquellen als NICHT abgewartete Einzelmutationen gegen einen
    // Vollobjekt-CAS: bei gleicher gelesener rowVersion verlor einer mit STALE_WRITE, ein TEIL der
    // Quellen kam an, und der Nutzer speicherte trotzdem ALLE Punkte.
    //
    // Jetzt ist die Zahl der Schreibvorgänge unabhängig von der Zahl der Punkte. Das wird hier
    // GEZÄHLT, nicht behauptet: ein echtes Repo mit einem Spion auf `update`.
    const repo = new InMemoryKoRepo();
    const updates = vi.spyOn(repo, "update");
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
    updates.mockClear();

    const commit = await service.appendDocumentExtract(ko.id, "u1", {
      operationId: "append-fuenf-punkte",
      anchor: { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" },
      sources: [
        { label: "P.pdf", excerpt: "eins" },
        { label: "P.pdf", excerpt: "zwei" },
        { label: "P.pdf", excerpt: "drei" },
        { label: "P.pdf", excerpt: "vier" },
        { label: "P.pdf", excerpt: "fuenf" },
      ],
      changes: { bodyHtml: "<p>Neu.</p>" },
    });

    // FÜNF Belegstellen, EIN Schreibvorgang. Es gibt keine zweite gelesene rowVersion, gegen die
    // etwas verlieren könnte — der Wettlauf ist nicht gewonnen, er existiert nicht mehr.
    expect(updates).toHaveBeenCalledTimes(1);
    expect(commit.sourceIds).toHaveLength(5);
    const nachher = await service.get(ko.id);
    expect(nachher?.sources).toHaveLength(5);
    expect(nachher?.attachments).toHaveLength(1);
  });

  it("zwei GLEICHZEITIGE Vorgänge am selben Objekt kommen BEIDE an (per-KO serialisiert)", async () => {
    const repo = new InMemoryKoRepo();
    const service = new KoService({ repo, evidence: new InMemoryEvidenceRepo() });
    const ko = await service.create({
      title: "Dichtung",
      statement: "x",
      type: "technik",
      category: "Instandhaltung",
      author: "u1",
    });
    const anchor = { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" };

    const [a, b] = await Promise.all([
      service.appendDocumentExtract(ko.id, "u1", {
        operationId: "append-parallel-a",
        anchor,
        sources: [{ label: "P.pdf", excerpt: "a1" }],
      }),
      service.appendDocumentExtract(ko.id, "u1", {
        operationId: "append-parallel-b",
        anchor,
        sources: [{ label: "P.pdf", excerpt: "b1" }],
      }),
    ]);

    expect(a.committed).toBe(true);
    expect(b.committed).toBe(true);
    const nachher = await service.get(ko.id);
    expect(nachher?.sources.map((s) => s.excerpt).sort()).toEqual(["a1", "b1"]);
  });
});

// ----------------------------------------------------------------------------------------------
// 5. DIE VERTEILTE FEHLERKANTE — ein Fehler NACH dem Commit entfernt keine Quellen mehr.
// ----------------------------------------------------------------------------------------------
describe("mega18 A-1: die verteilte Fehlerkante", () => {
  it("scheitert ein FOLGESCHRITT nach dem Commit, bleibt der Commit gültig und wird BENANNT", async () => {
    // DIES ist die Kante, die der reine Ablauftest aus mega17 nicht traf (tests/capture/
    // mega18-verbund-teilfehler.test.ts, vormals mega17-append-teilfehler). Bis mega17 lief es so: die Route
    // persistierte `ko.revise` und führte DANACH conflicts.onKoRevised / overlaps.onKoRevised /
    // markAiCheckPending aus. Wirft dort etwas, lehnte der Fetch ab — obwohl der Body gespeichert
    // war — und `composeAppendToArticle` nahm daraufhin die Quellen ZURÜCK.
    //
    // Jetzt: der Folgeschritt darf scheitern, die Antwort bleibt ein COMMIT-Ergebnis, und der
    // Fehlschlag wird als ehrlicher Teilbefund mitgeliefert.
    const services = buildServices();
    vi.spyOn(services.conflicts, "onKoRevised").mockRejectedValue(new Error("conflicts kaputt"));
    vi.spyOn(services.overlaps, "onKoRevised").mockRejectedValue(new Error("overlaps kaputt"));
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const headers = await login(app, "a@x.de", "secret123");
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Dichtung",
        statement: "x",
        type: "technik",
        category: "Instandhaltung",
        bodyHtml: "<p>Alt.</p>",
      },
    });
    const koId = ko.json().id as string;
    const objectId = await objektAnlegen(app, headers);

    const res = await uebernehmen(app, headers, koId, {
      operationId: "append-folgeschritt-kaputt",
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      points: ZWEI_PUNKTE,
      changes: { bodyHtml: "<p>Alt.</p><p>Neu mit Beleg.</p>" },
    });

    // KEIN Gesamtfehler: die Antwort sagt, was GILT.
    expect(res.statusCode).toBe(200);
    expect(res.json().committed).toBe(true);
    // Und sie verschweigt den Teilbefund nicht.
    expect(res.json().followUpsFailed).toEqual(["conflicts", "overlaps"]);

    // Der entscheidende Punkt: die Quellen stehen NOCH DA. Kein blindes Kompensieren.
    const nachher = await koLesen(app, headers, koId);
    expect(nachher.version).toBe(2);
    expect(nachher.bodyHtml).toContain("Neu mit Beleg.");
    expect(nachher.sources).toHaveLength(2);
    expect(nachher.attachments).toHaveLength(1);
  });

  it("scheitert ein BELEG-Schritt VOR dem Antworten, wird der Commit VOLLSTÄNDIG zurückgenommen", async () => {
    // Die andere Seite derselben Kante: schlägt innerhalb der Operation ein nachgelagerter Beleg
    // (Versions-Snapshot) fehl, gilt NICHTS — Inhalt, Anker und Quellen gehen gemeinsam zurück.
    const repo = new InMemoryKoRepo();
    const versions = new InMemoryKoVersionRepo();
    const service = new KoService({ repo, versions, evidence: new InMemoryEvidenceRepo() });
    const ko = await service.create({
      title: "Dichtung",
      statement: "x",
      type: "technik",
      category: "Instandhaltung",
      author: "u1",
      bodyHtml: "<p>Alt.</p>",
    });
    vi.spyOn(versions, "append").mockRejectedValue(new Error("snapshot kaputt"));

    await expect(
      service.appendDocumentExtract(ko.id, "u1", {
        operationId: "append-snapshot-kaputt",
        anchor: { objectId: "obj-1", name: "P.pdf", mime: "application/pdf" },
        sources: [{ label: "P.pdf", excerpt: "eins" }],
        changes: { bodyHtml: "<p>Alt.</p><p>Neu.</p>" },
      }),
    ).rejects.toThrow(/snapshot kaputt/);

    const nachher = await service.get(ko.id);
    // Kein Teilzustand in KEINE Richtung: kein Inhalt, kein Anker, keine Quelle, keine Version.
    expect(nachher?.version).toBe(1);
    expect(nachher?.bodyHtml).toBe("<p>Alt.</p>");
    expect(nachher?.sources).toHaveLength(0);
    expect(nachher?.attachments).toHaveLength(0);
    // Und der Vorgang ist NICHT als erledigt vermerkt — eine Wiederholung führt ihn wirklich aus.
    expect(nachher?.appendOps ?? []).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------------------------------
// 6. DIE GEGENPROBE — im Wortlaut, damit die Zusagen nicht bloß behauptet sind.
// ----------------------------------------------------------------------------------------------
// Die Gegenproben greifen den CODE, nicht die Prosa. Die Kommentare dieses Auftrags nennen die
// abgeschafften Konstruktionen absichtlich beim Namen (sonst wüsste niemand, was hier weg ist und
// warum) — eine Suche über die Rohdatei würde deshalb ausgerechnet die gute Dokumentation als
// Verstoß lesen. Also werden Kommentare vorher entfernt.
function codeOhneKommentare(pfad: string): string {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  return readFileSync(pfad, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .map((line) => line.replace(/\s\/\/[^"'`]*$/, ""))
    .join("\n");
}

describe("mega18 A: Gegenprobe", () => {
  it("GEGENPROBE 1 — die Kompensation per remove-source ist RESTLOS verschwunden", async () => {
    const src = codeOhneKommentare("apps/web/src/lib/appendToArticle.ts");
    // Kein Rücknahme-Griff, kein Rollback-Zähler, kein „wie viele Quellen stehen noch da".
    expect(src).not.toContain("removeSource");
    expect(src).not.toContain("rollback");
    expect(src).not.toContain("sourcesLeft");
    // Und der frühere Einstiegspunkt existiert nicht mehr (kein zweiter, alter Weg daneben).
    expect(src).not.toContain("composeAppendToArticle");
    // Der Ersatz ist da, und er ist dreiwertig.
    expect(src).toContain("commitDocumentAppend");
    for (const ausgang of ['"committed"', '"rejected"', '"unknown"']) {
      expect(src).toContain(ausgang);
    }
  });

  it("GEGENPROBE 2 — kein Produktionsweg erzeugt den Anker noch selbst", async () => {
    // Die drei Wege des Auftrags. Keiner darf noch den Griff „hochladen UND anhängen" fahren.
    for (const datei of [
      "apps/web/src/components/AppendToArticleModal.tsx",
      "apps/web/src/pages/KnowledgeDetail.tsx",
      "apps/web/src/components/BodyExtractPanel.tsx",
      "apps/web/src/pages/Capture.tsx",
    ]) {
      expect(codeOhneKommentare(datei), datei).not.toContain("attachOriginalDocument");
    }
    // Das Panel hängt GAR NICHTS mehr an und kennt keine objectId — es reicht das Dokument nach
    // oben, und das war die Stelle, an der bis mega17 auch ohne Anker weitergemacht wurde.
    const panel = codeOhneKommentare("apps/web/src/components/BodyExtractPanel.tsx");
    expect(panel).not.toContain('action: "attach"');
    expect(panel).not.toContain('action: "add-source"');
    expect(panel).not.toContain("objectId");
    // Die Wege an einem BESTEHENDEN Wissensobjekt gehen durch DIE EINE Verbund-Operation.
    for (const datei of [
      "apps/web/src/components/AppendToArticleModal.tsx",
      "apps/web/src/pages/KnowledgeDetail.tsx",
    ]) {
      expect(codeOhneKommentare(datei), datei).toContain("appendDocument(");
    }
    // AUFTRAG-mega19 Block B: das frische ERFASSEN nicht mehr — dort gibt es kein bestehendes
    // Objekt, an das etwas angefügt werden könnte. Der Body wurde bis mega18 zuerst committet und
    // die Herkunft danach nachgereicht; genau dieses Fenster ist geschlossen. Capture geht jetzt
    // durch die Erstanlage-Komposition, in der Inhalt, Anker und Belegstellen GEMEINSAM entstehen.
    const capture = codeOhneKommentare("apps/web/src/pages/Capture.tsx");
    expect(capture).toContain("createFromDocument(");
    // Und der alte Nachreich-Weg ist dort restlos weg — kein zweiter, alter Pfad daneben.
    expect(capture).not.toContain("appendDocument(");
    expect(capture).not.toContain("commitDocumentAppend");
  });

  it("GEGENPROBE 3 — die interne Belegpflicht steht in ihrer EIGENEN Datei, nicht in attach-policy", async () => {
    const { readFileSync } = await import("node:fs");
    const pflichtRoh = readFileSync("services/knowledge-object/src/document-append.ts", "utf8");
    const pflichtCode = codeOhneKommentare("services/knowledge-object/src/document-append.ts");
    const stufeRoh = readFileSync("services/external-search/src/attach-policy.ts", "utf8");
    // Die Belegpflicht benennt die Trennung ausdrücklich und zeigt auf die andere Regel — DAS ist
    // die Auflage „schreib die Trennung sichtbar in den Code".
    expect(pflichtRoh).toContain("attach-policy.ts");
    expect(pflichtRoh).toContain("INTERNE BELEGPFLICHT");
    expect(pflichtRoh).toContain("EXTERNE STUFENREGEL");
    // Im CODE kommt keine Stufe vor: sie kann die Stufe nicht sehen, also nicht von ihr abhängen.
    for (const stufenname of [
      "blocked",
      "search_on_click",
      "search_attach",
      "ExternalKnowledgeStage",
    ]) {
      expect(pflichtCode, stufenname).not.toContain(stufenname);
    }
    // Und sie importiert nichts aus dem Modul der Stufenregel.
    expect(pflichtCode).not.toContain("external-search");
    // Die Stufenregel ist UNANGETASTET geblieben (mega16-Wortlaut steht noch drin, kein mega18).
    expect(stufeRoh).toContain("DIE STUFE IST EINE GRENZE, FAIL-CLOSED");
    expect(stufeRoh).not.toContain("mega18");
  });

  it("GEGENPROBE 4 — die Kennung ist reiner Dedup-Schlüssel, keine Autorität", () => {
    // Sie wird streng geprüft (Zeichensatz/Länge) …
    expect(normalizeAppendOperationId(" append-1234 ")).toBe("append-1234");
    expect(() => normalizeAppendOperationId("kurz")).toThrow();
    expect(() => normalizeAppendOperationId({})).toThrow();
    // … und die Erinnerung ist gedeckelt (die Grenze steht ausgeschrieben, nicht versteckt).
    expect(DOCUMENT_APPEND_OP_MEMORY).toBeGreaterThan(1);
    expect(Number.isInteger(DOCUMENT_APPEND_OP_MEMORY)).toBe(true);
  });

  it("GEGENPROBE 5 — die Reihenfolge im Inneren ist Anker → Belege → Inhalt", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("services/knowledge-object/src/service.ts", "utf8");
    // Hier ist die PROSA der Beleg (die Abschnittsmarken), deshalb bewusst die Rohdatei.
    const anker = src.indexOf("---- 1. ANKER SICHERN");
    const belege = src.indexOf("---- 2. BELEGE VOLLSTÄNDIG");
    const inhalt = src.indexOf("---- 3. ERST DANACH DER INHALT");
    const commit = src.indexOf("---- DER COMMIT: GENAU EIN SCHREIBVORGANG");
    expect(anker).toBeGreaterThan(0);
    expect(belege).toBeGreaterThan(anker);
    expect(inhalt).toBeGreaterThan(belege);
    expect(commit).toBeGreaterThan(inhalt);
  });
});
