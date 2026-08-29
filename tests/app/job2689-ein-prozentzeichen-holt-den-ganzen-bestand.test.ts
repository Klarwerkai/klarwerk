import { describe, expect, it } from "vitest";
import { LIBRARY_RESULT_LIMIT } from "../../apps/web/src/lib/libraryDisplay";
import type { KoService } from "../../services/knowledge-object";
import {
  PgKoSearchProjectionRepo,
  maskiereLikeMuster,
} from "../../services/knowledge-object/src/search-projection-repo-pg";
import {
  LIBRARY_SEARCH_HIT_LIMIT,
  LibraryService,
} from "../../services/library-analytics/src/service";
import { type Suchzeile, ilikeMitEscape, likePool } from "./job2689-like-doppel";

// ================================================================================================
// JOB 2689 D1 — EIN PROZENTZEICHEN HOLT DEN GANZEN BESTAND (Befund R2-37)
// ================================================================================================
//
// Gegenprobe zuerst (Auftrag §2): Im Klon auf 71d3c2b stand `params.push(\`%${term}%\`)` in
// search-projection-repo-pg.ts:569 und die Bibliotheksabfrage in library-analytics/src/service.ts
// rief `findSearchHits({ terms: [q] })` ohne `limit` (Z.1240). repo-pg.ts:482 traegt dasselbe
// Muster im Ask-Kandidatenpfad — dort kommt kein `%` an (Tokenizer), und die Datei ist gesperrt.
// Diese Datei misst die zwei Stellen, die 2689 aendert; die gemountete Bibliothek steht daneben.

// Sechzehn Objekte ohne ein einziges Prozentzeichen — der heutige Beispielbestand (Auftrag §1).
const ZEILEN_OHNE: Suchzeile[] = Array.from({ length: 16 }, (_, i) => ({
  ko_id: `ko-${i + 1}`,
  title_text: `Ventil ${i + 1} warten`,
  statement_text: "Quartalsweise pruefen.",
  caption_text: "",
  category_text: "Wartung",
  tag_text: "",
  status: "validiert",
}));

// Fuenfzehn davon plus EIN Objekt, das wirklich ein Prozentzeichen traegt.
const ZEILEN: Suchzeile[] = [
  ...ZEILEN_OHNE.slice(0, 15),
  {
    ko_id: "ko-auslastung",
    title_text: "80 % Auslastung als Grenze",
    statement_text: "Ab 80 % Auslastung wird die zweite Linie zugeschaltet.",
    caption_text: "",
    category_text: "Betrieb",
    tag_text: "",
    status: "validiert",
  },
];

describe("JOB 2689 D1 · A · die Maskierung meint den Begriff woertlich", () => {
  it("A1 · Prozent, Unterstrich und Rueckstrich werden maskiert, alles andere bleibt", () => {
    expect(maskiereLikeMuster("%")).toBe("\\%");
    expect(maskiereLikeMuster("80 % auslastung")).toBe("80 \\% auslastung");
    expect(maskiereLikeMuster("a_b")).toBe("a\\_b");
    expect(maskiereLikeMuster("c:\\pfad")).toBe("c:\\\\pfad");
    expect(maskiereLikeMuster("ventil warten")).toBe("ventil warten");
  });

  it("A2 · der Auswerter des Doppels unterscheidet Muster von Zeichen (sonst misst er nichts)", () => {
    // Unmaskiert: `%` trifft alles — das war der Befund.
    expect(ilikeMitEscape("Ventil 1 warten", "%%%")).toBe(true);
    // Maskiert: `\%` trifft nur ein echtes Prozentzeichen.
    expect(ilikeMitEscape("Ventil 1 warten", "%\\%%")).toBe(false);
    expect(ilikeMitEscape("80 % Auslastung", "%\\%%")).toBe(true);
    expect(ilikeMitEscape("a_b", "%a\\_b%")).toBe(true);
    expect(ilikeMitEscape("axb", "%a\\_b%")).toBe(false);
    expect(ilikeMitEscape("axb", "%a_b%")).toBe(true);
  });
});

describe("JOB 2689 D1 · B · das SQL des Pg-Adapters", () => {
  it("B1 · `%` reist als `%\\%%` und jede ILIKE-Klausel traegt ESCAPE", async () => {
    const { pool, suchabfragen } = likePool(ZEILEN_OHNE);
    const repo = new PgKoSearchProjectionRepo(pool);
    const treffer = await repo.findActive({ terms: ["%"] });
    const [abfrage] = suchabfragen();
    expect(abfrage?.params[2]).toBe("%\\%%");
    const ilikes = abfrage?.sql.match(/ILIKE \$\d+/g) ?? [];
    const mitEscape = abfrage?.sql.match(/ILIKE \$\d+ ESCAPE '\\'/g) ?? [];
    expect(ilikes.length).toBeGreaterThan(0);
    expect(mitEscape.length).toBe(ilikes.length);
    // Und die Sache selbst: null von sechzehn statt sechzehn von sechzehn.
    expect(treffer).toHaveLength(0);
  });

  it("B1b · traegt EIN Objekt ein echtes Prozentzeichen, trifft `%` genau dieses — nicht alle", async () => {
    // Das ist der Unterschied zwischen Maskieren und Wegwerfen: `%` ist jetzt ein Zeichen.
    const { pool } = likePool(ZEILEN);
    const repo = new PgKoSearchProjectionRepo(pool);
    expect((await repo.findActive({ terms: ["%"] })).map((t) => t.koId)).toEqual(["ko-auslastung"]);
  });

  it("B2 · Gegenprobe: „80 % auslastung“ FINDET das Objekt mit dem Prozentzeichen — und nur das", async () => {
    const { pool } = likePool(ZEILEN);
    const repo = new PgKoSearchProjectionRepo(pool);
    const treffer = await repo.findActive({ terms: ["80 % auslastung"] });
    expect(treffer.map((t) => t.koId)).toEqual(["ko-auslastung"]);
    expect(treffer[0]?.matched.title).toBe(true);
  });

  it("B3 · ein gewoehnlicher Begriff trifft wie vorher", async () => {
    const { pool } = likePool(ZEILEN);
    const repo = new PgKoSearchProjectionRepo(pool);
    expect(await repo.findActive({ terms: ["ventil"] })).toHaveLength(15);
  });

  it("B4 · mit `limit` steht LIMIT als letzter Parameter im SQL", async () => {
    const { pool, suchabfragen } = likePool(ZEILEN);
    const repo = new PgKoSearchProjectionRepo(pool);
    const treffer = await repo.findActive({ terms: ["ventil"], limit: 3 });
    const [abfrage] = suchabfragen();
    expect(abfrage?.sql.trimEnd()).toMatch(/LIMIT \$\d+$/);
    expect(abfrage?.params[abfrage.params.length - 1]).toBe(3);
    expect(treffer).toHaveLength(3);
  });
});

describe("JOB 2689 D1 · C · die Bibliotheksabfrage hat einen Deckel", () => {
  it("C1 · der Deckel ist die Zahl, die die Flaeche zeigt: 200", () => {
    expect(LIBRARY_SEARCH_HIT_LIMIT).toBe(200);
    expect(LIBRARY_SEARCH_HIT_LIMIT).toBe(LIBRARY_RESULT_LIMIT);
  });

  it("C2 · LibraryService.search reicht den Deckel an findSearchHits — bis 2689 stand dort keiner", async () => {
    const gesehen: Array<{ terms: readonly string[]; limit: number | undefined }> = [];
    const koService = {
      listForSearch: async () => ZEILEN.map((z) => ({ id: z.ko_id, title: z.title_text })),
      findSearchHits: async (query: { terms: readonly string[]; limit?: number }) => {
        gesehen.push({ terms: query.terms, limit: query.limit });
        return [];
      },
    } as unknown as KoService;
    const dienst = new LibraryService({ koService });
    await dienst.search("%");
    expect(gesehen).toEqual([{ terms: ["%"], limit: 200 }]);
  });

  it("C3 · die ganze Kette gegen das Doppel: `%` liefert nur das Prozent-Objekt, „80 % Auslastung“ liefert es auch, LIMIT 200 im SQL", async () => {
    const { pool, suchabfragen } = likePool(ZEILEN);
    const repo = new PgKoSearchProjectionRepo(pool);
    const koService = {
      listForSearch: async () => ZEILEN.map((z) => ({ id: z.ko_id, title: z.title_text })),
      findSearchHits: (query: { terms: readonly string[]; limit?: number }) =>
        repo.findActive(query),
    } as unknown as KoService;
    const dienst = new LibraryService({ koService });

    // Im Bestand mit einem echten Prozentzeichen trifft `%` genau dieses eine Objekt.
    expect((await dienst.search("%")).map((k) => k.id)).toEqual(["ko-auslastung"]);
    const prozent = await dienst.search("80 % Auslastung");
    expect(prozent.map((k) => k.id)).toEqual(["ko-auslastung"]);
    for (const a of suchabfragen()) {
      expect(a.params[a.params.length - 1]).toBe(200);
    }
  });
});
