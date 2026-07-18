import { describe, expect, it } from "vitest";
import type { CollectResult, ConfluenceSourceAdapter } from "../../confluence";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { type ImportItem, LibraryService } from "../../library-analytics";
import { runConfluenceImport } from "./confluence-import";

// SCRUM-510 WP2: Orchestrierung — dry-run schreibt nichts, Idempotenz (pageId+version), per-Seite-Fehler
// bricht den Lauf nicht ab, REVIEW-INVARIANTE (nur Kandidaten, keine Auto-KOs).

function item(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: "Seite",
    statement: "Inhalt.",
    type: "best_practice",
    category: "K",
    externalId: "P1",
    sourceScope: "K",
    sourceVersion: 1,
    provider: "Confluence",
    ...over,
  };
}

// Fake-Adapter: liefert ein vorgegebenes CollectResult (kein Netz). `truncated` ist optional (Default
// false) — die meisten Tests prüfen den vollständigen Lauf; der Cap-Test setzt es explizit.
function fakeAdapter(
  result: Omit<CollectResult, "truncated"> & { truncated?: boolean },
): ConfluenceSourceAdapter {
  const full: CollectResult = { truncated: false, ...result };
  return {
    source: "Confluence",
    collect: async () => full.items,
    collectAll: async () => full,
  } as unknown as ConfluenceSourceAdapter;
}

function setup() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const library = new LibraryService({ koService, externalUpsert: true });
  return { koService, library };
}

describe("SCRUM-510 WP2: runConfluenceImport", () => {
  it("dry-run: zählt/listet, schreibt NICHTS in die Queue", async () => {
    const { koService, library } = setup();
    const adapter = fakeAdapter({
      items: [item({ externalId: "P1" }), item({ externalId: "P2", title: "Zwei" })],
      failed: [],
    });
    const s = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: true,
      actor: "admin",
    });
    expect(s.dryRun).toBe(true);
    expect(s.found).toBe(2);
    expect(s.imported).toBe(2); // WÜRDE 2 einreihen …
    expect(await library.listImportCandidates()).toHaveLength(0); // … hat aber nichts geschrieben
  });

  it("echt: reiht neue Seiten als Kandidaten ein (KEINE Auto-KOs)", async () => {
    const { koService, library } = setup();
    const adapter = fakeAdapter({
      items: [item({ externalId: "P1" }), item({ externalId: "P2" })],
      failed: [],
    });
    const s = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: false,
      actor: "admin",
    });
    expect(s.imported).toBe(2);
    const cands = await library.listImportCandidates();
    expect(cands).toHaveLength(2);
    expect(cands.every((c) => c.status === "neu")).toBe(true); // nur Kandidaten
    expect(await koService.list()).toHaveLength(0); // keine stillen KOs
  });

  it("Idempotenz: Re-Run mit unveränderter Version → alles übersprungen, keine Duplikate", async () => {
    const { koService, library } = setup();
    const adapter = fakeAdapter({
      items: [item({ externalId: "P1", sourceVersion: 3 })],
      failed: [],
    });
    await runConfluenceImport({ adapter, library, koService, dryRun: false, actor: "admin" });
    expect(await library.listImportCandidates()).toHaveLength(1);
    // Zweiter Lauf, gleiche Version → Kandidat bereits offen → skip.
    const s2 = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: false,
      actor: "admin",
    });
    expect(s2.imported).toBe(0);
    expect(s2.skipped).toBe(1);
    expect(await library.listImportCandidates()).toHaveLength(1); // keine Dublette
  });

  it("Idempotenz: bereits als KO (Version N) importiert → Version N übersprungen, höhere Version neu", async () => {
    const { koService, library } = setup();
    // Ein KO mit Herkunftsanker P9@2 existiert bereits.
    await koService.create({
      title: "Bestand",
      statement: "Alt.",
      type: "best_practice",
      category: "K",
      author: "a",
      sources: [
        {
          id: "s1",
          label: "P9",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          externalId: "P9",
          sourceVersion: 2,
          author: "a",
          at: "2026-01-01",
        },
      ],
    });
    const s = await runConfluenceImport({
      adapter: fakeAdapter({
        items: [
          item({ externalId: "P9", sourceVersion: 2 }),
          item({ externalId: "P9", sourceVersion: 3, title: "Neu" }),
        ],
        failed: [],
      }),
      library,
      koService,
      dryRun: false,
      actor: "admin",
    });
    // v2 (== Bestand) skip; v3 (> Bestand) neu.
    expect(s.skipped).toBe(1);
    expect(s.imported).toBe(1);
  });

  it("per-Seite-Fehler bricht den Lauf NICHT ab (Seite → failed, weiter)", async () => {
    const { koService, library } = setup();
    const adapter = fakeAdapter({
      items: [item({ externalId: "P1" })],
      failed: [{ ref: "P2", error: "Storage-Format defekt" }],
    });
    const s = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: false,
      actor: "admin",
    });
    expect(s.found).toBe(1);
    expect(s.imported).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.perPage.find((p) => p.ref === "P2")?.status).toBe("failed");
    expect(await library.listImportCandidates()).toHaveLength(1); // die gute Seite wurde eingereiht
  });

  // SCRUM-510 (WP3): IN-RUN-Dedup. Liefert die Quelle dieselbe (pageId@version) DOPPELT in EINEM Lauf,
  // wird sie nur EINMAL eingereiht — die zweite ist „Dublette im selben Lauf". Ohne den queuedKeys-Fix
  // würden beide in toQueue landen (Doppel-Kandidat), imported=2 → dieser Test scheitert.
  it("WP3: doppelte Seite im selben Lauf → nur einmal eingereiht (in-run dedup)", async () => {
    const { koService, library } = setup();
    const adapter = fakeAdapter({
      items: [
        item({ externalId: "P1", sourceVersion: 1 }),
        item({ externalId: "P1", sourceVersion: 1, title: "P1 (Kopie)" }),
        item({ externalId: "P2", sourceVersion: 1, title: "Zwei" }),
      ],
      failed: [],
    });
    const s = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: false,
      actor: "admin",
    });
    expect(s.imported).toBe(2); // P1 einmal + P2
    expect(s.skipped).toBe(1); // die P1-Dublette
    expect(s.perPage.filter((p) => p.status === "imported")).toHaveLength(2);
    expect(await library.listImportCandidates()).toHaveLength(2);
  });

  // SCRUM-510 (WP3): ehrlicher Cap. Wird der Space am Seiten-Limit abgeschnitten (truncated), meldet die
  // Zusammenfassung das — der Lauf ist UNVOLLSTÄNDIG, nie still „fertig". Ohne die Weiterreichung des
  // truncated-Flags stünde summary.truncated auf false → dieser Test scheitert.
  it("WP3: abgeschnittener Space-Read → summary.truncated=true (kein stilles fertig)", async () => {
    const { koService, library } = setup();
    const adapter = fakeAdapter({
      items: [item({ externalId: "P1" }), item({ externalId: "P2", title: "Zwei" })],
      failed: [],
      truncated: true,
    });
    const s = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: false,
      actor: "admin",
    });
    expect(s.truncated).toBe(true);
    expect(s.found).toBe(2); // NUR die gesehenen Seiten — nicht der ganze Space
  });

  // Gegenprobe: vollständiger Lauf → truncated=false.
  it("WP3: vollständiger Space-Read → summary.truncated=false", async () => {
    const { koService, library } = setup();
    const s = await runConfluenceImport({
      adapter: fakeAdapter({ items: [item({ externalId: "P1" })], failed: [] }),
      library,
      koService,
      dryRun: true,
      actor: "admin",
    });
    expect(s.truncated).toBe(false);
  });

  // SCRUM-510 (WP2-Batch3): EHRLICHE ZÄHLUNG bei Parallelkonflikt. createImportCandidates persistiert
  // (ON CONFLICT DO NOTHING) evtl. WENIGER als eingereiht. `imported` muss die ECHTEN Inserts zählen,
  // nie blind toQueue.length. Ohne den Fix stünde imported auf 3 → dieser Test scheitert.
  it("WP2: Parallelkonflikt → imported == echte Inserts, Seite als skipped/Parallelkonflikt", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    // Fake-Library: reiht 3 Items ein, persistiert aber nur die ersten 2 (das dritte kollidiert atomar).
    const fakeLibrary = {
      listImportCandidates: async () => [],
      createImportCandidates: async (batch: readonly ImportItem[]) =>
        batch.slice(0, batch.length - 1).map((it, i) => ({
          id: `c-${i}`,
          item: it,
          status: "neu" as const,
          duplicate: false,
          note: null,
          koId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        })),
    } as unknown as LibraryService;
    const adapter = fakeAdapter({
      items: [
        item({ externalId: "P1" }),
        item({ externalId: "P2", title: "Zwei" }),
        item({ externalId: "P3", title: "Drei" }),
      ],
      failed: [],
    });
    const s = await runConfluenceImport({
      adapter,
      library: fakeLibrary,
      koService,
      dryRun: false,
      actor: "admin",
    });
    expect(s.imported).toBe(2); // NICHT 3 (toQueue.length)
    expect(s.skipped).toBe(1); // die nicht-persistierte Seite
    const p3 = s.perPage.find((p) => p.ref === "P3");
    expect(p3?.status).toBe("skipped");
    expect(p3?.note).toContain("Parallelkonflikt");
  });
});
