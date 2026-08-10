// WP-BILD-1h (bens sammel15-ROT): Härtung des Caption-Suchfeld-Backfills.
//  1. NEBENLÄUFIGKEIT: setCaptionTexts schreibt atomar NUR-WENN-FELD-FEHLT — ein später
//     ankommender Backfill mit altem Scan kann frische captionTexts eines revise nie clobbern.
//  2. LASTBEGRENZUNG: höchstens SEARCH_BACKFILL_LIMIT_PER_QUERY Vollladungen je Suchanfrage;
//     SINGLE-FLIGHT pro KO-Id (parallele Suchen laden denselben Legacy-KO genau einmal);
//     Backfill-Fehler lassen die Suche NIE umfallen (Kandidat ohne Caption-Match, Feld ungesetzt).
//  3. GRÖSSENDECKEL: captionTexts werden an der EINEN kanonischen Stelle hart gekappt
//     (500 Zeichen je Caption, 50 Captions je KO) — für create, revise UND Backfill.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryKoRepo,
  type KnowledgeObject,
  type KoRepo,
  KoService,
} from "../../services/knowledge-object";
import { LibraryService, SEARCH_BACKFILL_LIMIT_PER_QUERY } from "../../services/library-analytics";
import {
  MAX_CAPTIONS_PER_KO,
  MAX_CAPTION_TEXT_LENGTH,
  searchCaptionTexts,
} from "../../services/structure";

const FIGURE = (caption: string): string =>
  `<figure><img src="/api/objects/x/raw" alt="Bild"><figcaption data-image-id="kw-img-1">${caption}</figcaption></figure>`;

function legacyKo(id: string, bodyHtml: string): KnowledgeObject {
  return {
    id,
    title: `Alt ${id}`,
    statement: "Aussage ohne Suchwort.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    rowVersion: 7,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    history: [],
  } as unknown as KnowledgeObject;
}

// Instrumentierter Repo-Wrapper: zählt Vollladungen (findById) und kann sie verzögern/scheitern lassen.
function countingRepo(inner: InMemoryKoRepo) {
  const findByIdCalls = new Map<string, number>();
  let gate: Promise<void> | null = null;
  let failIds = new Set<string>();
  const repo: KoRepo = {
    insert: (ko) => inner.insert(ko),
    update: (ko) => inner.update(ko),
    delete: (id, tx) => inner.delete(id, tx),
    bumpTrust: (id, step, maxTrust, tx) => inner.bumpTrust(id, step, maxTrust, tx),
    list: (filter) => inner.list(filter),
    listForSearch: (filter) => inner.listForSearch(filter),
    // G27: neue Vertragsmethode (gezielter Mehrfach-Nachschlag) — reines Durchreichen.
    listByIds: (ids) => inner.listByIds(ids),
    setCaptionTexts: (id, captionTexts) => inner.setCaptionTexts(id, captionTexts),
    // WP-SUBMIT-ASYNC: neue Vertragsmethoden — reines Durchreichen (hier nicht instrumentiert).
    setAiCheck: (id, aiCheck) => inner.setAiCheck(id, aiCheck),
    resolveAiCheck: (id, patch, expectedKoVersion) =>
      inner.resolveAiCheck(id, patch, expectedKoVersion),
    findCandidates: (query) => inner.findCandidates(query),
    // AUFTRAG-mega20 Block A: neue Vertragsmethode (Erzeugungs-Anker) — reines Durchreichen.
    findByCreateOperation: (opId, actor) => inner.findByCreateOperation(opId, actor),
    findById: async (id) => {
      findByIdCalls.set(id, (findByIdCalls.get(id) ?? 0) + 1);
      if (failIds.has(id)) {
        throw new Error("Datenbank kurzzeitig nicht erreichbar");
      }
      if (gate) {
        await gate;
      }
      return inner.findById(id);
    },
  };
  return {
    repo,
    findByIdCalls,
    totalLoads: () => [...findByIdCalls.values()].reduce((a, b) => a + b, 0),
    setGate: (g: Promise<void> | null) => {
      gate = g;
    },
    setFailIds: (ids: string[]) => {
      failIds = new Set(ids);
    },
  };
}

function buildStack() {
  const inner = new InMemoryKoRepo();
  const counting = countingRepo(inner);
  const koService = new KoService({ repo: counting.repo });
  const library = new LibraryService({ koService });
  return { inner, counting, koService, library };
}

describe("WP-BILD-1h P1: setCaptionTexts überschreibt NIE (nur-wenn-fehlt)", () => {
  it("Feld fehlt → wird gesetzt; Feld vorhanden → No-Op (der Voll-Write gewinnt immer)", async () => {
    const repo = new InMemoryKoRepo();
    await repo.insert(legacyKo("legacy-1", FIGURE("Verschraubung")));
    // WP-D11b (patches53-GELB): der Rückgabewert sagt ehrlich, ob DIESER Aufruf geschrieben hat.
    expect(await repo.setCaptionTexts("legacy-1", ["Verschraubung"])).toBe(true);
    expect((await repo.findById("legacy-1"))?.captionTexts).toEqual(["Verschraubung"]);
    // bens Szenario: ein nebenläufiger revise hat inzwischen FRISCHE captionTexts persistiert —
    // ein spät ankommender Backfill mit ALTEM Scan darf sie nicht clobbern.
    expect(await repo.setCaptionTexts("legacy-1", ["veralteter Scan"])).toBe(false);
    expect((await repo.findById("legacy-1"))?.captionTexts).toEqual(["Verschraubung"]);
  });

  it("rowVersion/Status/History bleiben in beiden Fällen unverändert (reiner Cache-Write)", async () => {
    const repo = new InMemoryKoRepo();
    await repo.insert(legacyKo("legacy-1", FIGURE("Verschraubung")));
    await repo.setCaptionTexts("legacy-1", ["Verschraubung"]); // Feld fehlt → setzen
    await repo.setCaptionTexts("legacy-1", ["anders"]); // Feld gesetzt → No-Op
    const stored = await repo.findById("legacy-1");
    expect(stored?.rowVersion).toBe(7);
    expect(stored?.version).toBe(1);
    expect(stored?.status).toBe("offen");
    expect(stored?.history).toEqual([]);
  });
});

// ================================================================================================
// G27 R1 — DERSELBE VERTRAG, ABER AM MAINTENANCE-AUSLÖSER STATT AN DER SUCHE
// ================================================================================================
//
// WAS SICH GEÄNDERT HAT UND WARUM. Bis G27 R1 hat dieser Block die Konvergenz DURCH DIE SUCHE
// gemessen: 25 Legacy-Kandidaten, erste Suche 20 Treffer, zweite 25. Genau diese funktionale
// Abhängigkeit hat Entscheidung 04 §5 abgelöst — „Der reguläre Suchpfad darf funktional nicht von
// ihm abhängen"; der Backfill ist Optimierung, nicht Migration und nicht Readiness. Sie war
// zugleich der Träger von BENs Befund: weil nur 20 Objekte je Anfrage fertig wurden, hing das
// Suchergebnis an der Bestandsreihenfolge und alles dahinter blieb in Fassung 1 durchsuchbar.
//
// DER VERTRAG WIRD DESHALB ERSETZT, NICHT GELÖSCHT UND NICHT GELOCKERT. Alle drei Zusagen bleiben
// wörtlich erhalten — harter Deckel, Single-Flight je KO-Id, Fehlertoleranz —, sie hängen nur an
// ihrem neuen, ausdrücklichen Auslöser: dem Wartungslauf. Für den Fußnoten-Nachzug ist das genau
// der von 05 §4 verlangte eigene Auslöser innerhalb der Rebuild-/Reconcile-Aufrufkette.
describe("WP-BILD-1h P2 (G27 R1): Wartungslauf hart gedeckelt, single-flight, fehlertolerant", () => {
  it("25 Legacy-Kandidaten → genau 20 Vollladungen je Wartungsschwung; der Rest folgt (konvergiert)", async () => {
    const { inner, counting, koService } = buildStack();
    for (let i = 1; i <= 25; i++) {
      await inner.insert(legacyKo(`legacy-${String(i).padStart(2, "0")}`, FIGURE("Verschraubung")));
    }
    expect(SEARCH_BACKFILL_LIMIT_PER_QUERY).toBe(20);
    const erster = await koService.backfillSearchProjections({
      limit: SEARCH_BACKFILL_LIMIT_PER_QUERY,
    });
    expect(erster.geschrieben).toBe(20);
    expect(counting.totalLoads()).toBe(20); // harter Deckel — kein stilles Vollladen des Bestands
    // Der ZWEITE Schwung arbeitet den Rest ab: nur noch 5 Vollladungen nötig.
    const zweiter = await koService.backfillSearchProjections({
      limit: SEARCH_BACKFILL_LIMIT_PER_QUERY,
    });
    expect(zweiter.geschrieben).toBe(5);
    expect(counting.totalLoads()).toBe(25);
    // Dritter Schwung: alles fertig — keine einzige weitere Vollladung, und das wird ehrlich gemeldet.
    const dritter = await koService.backfillSearchProjections({
      limit: SEARCH_BACKFILL_LIMIT_PER_QUERY,
    });
    expect(dritter).toEqual({ geprueft: 0, geschrieben: 0, v2Migriert: 0, gescheitert: 0 });
    expect(counting.totalLoads()).toBe(25);
    // Und die Fußnoten sind über DIESEN Weg nachgezogen — ohne dass je eine Suche lief.
    expect((await inner.findById("legacy-01"))?.captionTexts).toEqual(["Verschraubung"]);
  });

  it("SINGLE-FLIGHT: zwei parallele Wartungsläufe laden denselben Legacy-KO genau EINMAL", async () => {
    const { inner, counting, koService } = buildStack();
    for (let i = 1; i <= 3; i++) {
      await inner.insert(legacyKo(`legacy-${i}`, FIGURE("Verschraubung")));
    }
    // Beide Läufe starten, während die Vollladungen am Gate hängen — sie treffen sich im
    // In-Flight-Promise je KO-Id statt doppelt zu laden.
    let open!: () => void;
    counting.setGate(
      new Promise<void>((r) => {
        open = r;
      }),
    );
    const a = koService.backfillSearchProjections({ limit: 20 });
    const b = koService.backfillSearchProjections({ limit: 20 });
    await new Promise((r) => setTimeout(r, 20));
    open();
    counting.setGate(null);
    const [resA, resB] = await Promise.all([a, b]);
    expect(resA.geprueft).toBe(3);
    expect(resB.geprueft).toBe(3);
    for (const [id, count] of counting.findByIdCalls) {
      expect(`${id}:${count}`).toBe(`${id}:1`); // je Legacy-KO genau EINE Vollladung
    }
  });

  it("Wartungsfehler: der Lauf fällt NICHT um, das Feld bleibt ungesetzt, Retry möglich", async () => {
    const { inner, counting, koService } = buildStack();
    await inner.insert(legacyKo("legacy-ok", FIGURE("Verschraubung")));
    await inner.insert(legacyKo("legacy-kaputt", FIGURE("Verschraubung")));
    counting.setFailIds(["legacy-kaputt"]);
    const bilanz = await koService.backfillSearchProjections({ limit: 20 });
    // Der Lauf fällt NIE an einem einzelnen Objekt um — er meldet den Fehlschlag ehrlich.
    expect(bilanz.geschrieben).toBe(1);
    expect(bilanz.gescheitert).toBe(1);
    expect((await inner.findById("legacy-kaputt"))?.captionTexts).toBeUndefined();
    // Fehler behoben → der nächste Lauf füllt nach (Single-Flight-Eintrag wurde abgeräumt).
    counting.setFailIds([]);
    const retry = await koService.backfillSearchProjections({ limit: 20 });
    expect(retry.geschrieben).toBe(1);
    expect((await inner.findById("legacy-kaputt"))?.captionTexts).toEqual(["Verschraubung"]);
  });

  it("KEIN SUCHWEG STÖSST DEN NACHZUG MEHR AN (Entscheidung 04 §5) — Quelltextzusicherung", () => {
    const bibliothek = readFileSync("services/library-analytics/src/service.ts", "utf8");
    const dienst = readFileSync("services/knowledge-object/src/service.ts", "utf8");
    const suche = bibliothek.slice(
      bibliothek.indexOf("async search("),
      bibliothek.indexOf("async search(") + 1600,
    );
    expect(suche).not.toContain("backfillSearchProjections");
    const kandidaten = dienst.slice(
      dienst.indexOf("async findCandidates("),
      dienst.indexOf("async findCandidates(") + 1600,
    );
    expect(kandidaten).not.toContain("backfillSearchProjections");
    // Der Nachzug SELBST bleibt bestehen — er ist Wartung, nicht abgeschafft.
    expect(dienst).toContain("async backfillSearchProjections(");
  });

  it("die Suche lädt selbst NICHTS mehr nach — ein Wartungslauf davor ist die einzige Quelle", async () => {
    const { inner, counting, koService, library } = buildStack();
    await inner.insert(legacyKo("legacy-1", FIGURE("Verschraubung")));
    await koService.backfillSearchProjections({ limit: 20 });
    await koService.activateSearchProjectionV2();
    const geladenVorSuche = counting.totalLoads();
    const treffer = await library.search("Verschraubung");
    expect(treffer.map((k) => k.id)).toEqual(["legacy-1"]);
    // NULL zusätzliche Vollladungen durch die Suche.
    expect(counting.totalLoads()).toBe(geladenVorSuche);
  });
});

describe("WP-D11b patches53-GELB: Race der laufenden Suchantwort (No-op-Fall lädt nach)", () => {
  it("setCaptionTexts no-opt (Voll-Write kam dazwischen) → ensureCaptionTexts liefert die FRISCHEN Werte, nie den alten Scan", async () => {
    const inner = new InMemoryKoRepo();
    await inner.insert(legacyKo("legacy-race", FIGURE("alter Scan")));
    // Wrapper, der den bedingten Backfill-Write an einem Gate parkt — im Fenster zwischen dem
    // Legacy-Read (ohne Feld) und dem Write landet ein nebenläufiger Voll-Write mit FRISCHEN Werten.
    let open!: () => void;
    const gate = new Promise<void>((r) => {
      open = r;
    });
    const repo: KoRepo = {
      insert: (ko) => inner.insert(ko),
      update: (ko) => inner.update(ko),
      delete: (id, tx) => inner.delete(id, tx),
      bumpTrust: (id, step, maxTrust, tx) => inner.bumpTrust(id, step, maxTrust, tx),
      list: (filter) => inner.list(filter),
      listForSearch: (filter) => inner.listForSearch(filter),
      // G27: neue Vertragsmethode (gezielter Mehrfach-Nachschlag) — reines Durchreichen.
      listByIds: (ids) => inner.listByIds(ids),
      findById: (id) => inner.findById(id),
      findCandidates: (query) => inner.findCandidates(query),
      // AUFTRAG-mega20 Block A: neue Vertragsmethode (Erzeugungs-Anker) — reines Durchreichen.
      findByCreateOperation: (opId, actor) => inner.findByCreateOperation(opId, actor),
      setCaptionTexts: async (id, captionTexts) => {
        await gate;
        return inner.setCaptionTexts(id, captionTexts);
      },
      // WP-SUBMIT-ASYNC: neue Vertragsmethoden — reines Durchreichen.
      setAiCheck: (id, aiCheck) => inner.setAiCheck(id, aiCheck),
      resolveAiCheck: (id, patch, expectedKoVersion) =>
        inner.resolveAiCheck(id, patch, expectedKoVersion),
    };
    const koService = new KoService({ repo });
    const pending = koService.ensureCaptionTexts("legacy-race");
    await new Promise((r) => setTimeout(r, 10));
    // Der nebenläufige Voll-Write (z. B. revise) persistiert FRISCHE captionTexts …
    const current = await inner.findById("legacy-race");
    await inner.update({ ...(current as KnowledgeObject), captionTexts: ["frische Fußnote"] });
    open();
    // … der bedingte Backfill-Write no-opt (inserted false) → die laufende Suche bekommt die
    // NACHGELADENEN frischen Werte, nicht den alten Scan des Legacy-Bodys.
    expect(await pending).toEqual(["frische Fußnote"]);
    expect((await inner.findById("legacy-race"))?.captionTexts).toEqual(["frische Fußnote"]);
  });
});

describe("WP-BILD-1h P3: Größendeckel an der EINEN kanonischen Stelle", () => {
  it("600-Zeichen-Caption → hart 500 im Feld (ehrlicher Schnitt, kein Ellipsis-Fake)", () => {
    const long = `${"x".repeat(592)}ZIELWORT`; // exakt 600 Zeichen
    const capped = searchCaptionTexts(FIGURE(long));
    expect(capped.length).toBe(1);
    expect(capped[0]?.length).toBe(MAX_CAPTION_TEXT_LENGTH);
    expect(capped[0]).toBe("x".repeat(500));
    expect(capped[0]?.endsWith("…")).toBe(false);
  });

  it("60 figures → 50 Einträge (Rest weg); gilt identisch für create (Persistenzpfad)", async () => {
    const services = buildServices();
    buildApp(services);
    const body = Array.from(
      { length: 60 },
      (_, i) =>
        `<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-c${i + 1}">Caption ${i + 1}</figcaption></figure>`,
    ).join("");
    const ko = await services.ko.create({
      title: "Bilderflut",
      statement: "s",
      type: "best_practice",
      category: "K",
      author: "anna",
      bodyHtml: body,
    });
    expect(ko.captionTexts?.length).toBe(MAX_CAPTIONS_PER_KO);
    expect(ko.captionTexts?.[0]).toBe("Caption 1");
    expect(ko.captionTexts?.[49]).toBe("Caption 50");
  });

  it("die Suche matcht innerhalb des gekappten Texts — und ehrlich NICHT dahinter", async () => {
    const services = buildServices();
    buildApp(services);
    // G27 R1: eine frische Instanz steht auf `UNINITIALIZED` und beantwortet keine Suche — erst der
    // vollständige Gate-Lauf gibt Fassung 2 frei (05 §1).
    await services.ko.activateSearchProjectionV2();
    // „Verschraubung" endet an Position 500 (innerhalb); „Zielwort" liegt hinter dem Schnitt.
    const inside = `${"x".repeat(500 - 13)}Verschraubung`;
    await services.ko.create({
      title: "Deckel-Test",
      statement: "s",
      type: "best_practice",
      category: "K",
      author: "anna",
      bodyHtml: FIGURE(`${inside}yyyZielwort`),
    });
    expect((await services.library.search("Verschraubung")).length).toBe(1);
    expect(await services.library.search("Zielwort")).toEqual([]);
  });
});
