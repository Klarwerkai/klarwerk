import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { LibraryService } from "../../library-analytics";
import type { DemoLocale } from "./demo-content";
import {
  DEMO_CORPUS,
  DEMO_CORPUS_PAGE_COUNT,
  DEMO_SPACE_KEY,
  corpusConflictPairs,
  corpusImportItems,
} from "./demo-corpus";

const LOCALES = ["de", "en", "nl"] as const;

// Je Sprache wörtliche Streitwerte der beiden Konfliktpaare (Farbe · Rhythmus) — pinnen die
// Übersetzung fest, konsistent mit der Farb-Glossar-Linie des Seeds (blau/blue/blauw · Rot/red/rood).
const COLOR: Record<DemoLocale, { blue: string; red: string }> = {
  de: { blue: "blau", red: "Rot" },
  en: { blue: "blue", red: "red" },
  nl: { blue: "blauw", red: "rood" },
};
const RHYTHM: Record<DemoLocale, { daily: string; weekly: string }> = {
  de: { daily: "täglich", weekly: "wöchentlich" },
  en: { daily: "daily", weekly: "weekly" },
  nl: { daily: "dagelijks", weekly: "wekelijks" },
};

describe("SCRUM-487: Confluence-Demo-Korpus — Vollständigkeit je Sprache", () => {
  it("8 Seiten, alle drei Effekte vertreten (2 Konflikt · 2 stale · 2 unbelegt = 6 + 2 Konflikt-Partner)", () => {
    expect(DEMO_CORPUS_PAGE_COUNT).toBe(8);
    expect(DEMO_CORPUS).toHaveLength(8);
    expect(DEMO_CORPUS.filter((p) => p.effect === "conflict")).toHaveLength(4);
    expect(DEMO_CORPUS.filter((p) => p.effect === "stale")).toHaveLength(2);
    expect(DEMO_CORPUS.filter((p) => p.effect === "unbacked")).toHaveLength(2);
  });

  it("pageIds sind eindeutig und sprach-neutral (dieselbe Seite in allen drei Sprachen)", () => {
    const ids = DEMO_CORPUS.map((p) => p.pageId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const locale of LOCALES) {
      const items = corpusImportItems(locale);
      expect(items.map((i) => i.pageId)).toEqual(ids);
    }
  });

  for (const locale of LOCALES) {
    it(`[${locale}] jede Seite hat vollständigen, nicht-leeren Text + Pflichtfelder`, () => {
      const items = corpusImportItems(locale);
      expect(items).toHaveLength(DEMO_CORPUS_PAGE_COUNT);
      for (const item of items) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.statement.trim().length).toBeGreaterThan(0);
        expect(item.category.trim().length).toBeGreaterThan(0);
        expect(item.spaceKey).toBe(DEMO_SPACE_KEY);
        expect(item.provider).toBe("Confluence");
        expect(item.bodyHtml).toContain("<p>");
      }
    });
  }

  it("die drei Sprachen sind wirklich verschieden (keine Platzhalter-Reste)", () => {
    for (const page of DEMO_CORPUS) {
      expect(page.text.en.statement).not.toBe(page.text.de.statement);
      expect(page.text.nl.statement).not.toBe(page.text.de.statement);
      expect(page.text.en.statement).not.toBe(page.text.nl.statement);
    }
  });
});

describe("SCRUM-487: Streitwerte stehen wörtlich in der Aussage (je Sprache)", () => {
  for (const locale of LOCALES) {
    it(`[${locale}] jeder Konflikt-Streitwert ist Substring von statement UND body`, () => {
      for (const page of DEMO_CORPUS) {
        if (page.effect !== "conflict" || !page.streitwert) {
          continue;
        }
        const wert = page.streitwert[locale];
        expect(page.text[locale].statement).toContain(wert);
        expect(page.text[locale].body).toContain(wert);
      }
    });
  }
});

describe("SCRUM-487: eingebaute Konflikte sind als Konfliktpaare erkennbar (Struktur, kein Modell)", () => {
  it("genau 2 Paare: Farbe (blau ↔ Rot) und Rhythmus (täglich ↔ wöchentlich)", () => {
    const pairs = corpusConflictPairs();
    expect(pairs).toHaveLength(2);
    const keys = pairs.map((p) => p.conflictKey).sort();
    expect(keys).toEqual(["backup", "warnfarbe"]);
  });

  for (const locale of LOCALES) {
    it(`[${locale}] Paar-Streitwerte sind gegensätzlich und beide wörtlich vorhanden`, () => {
      const pairs = corpusConflictPairs();
      const farbe = pairs.find((p) => p.conflictKey === "warnfarbe");
      const backup = pairs.find((p) => p.conflictKey === "backup");
      expect(farbe).toBeDefined();
      expect(backup).toBeDefined();

      // Farbe: blau/blue/blauw ↔ Rot/red/rood — verschieden und je wörtlich in der eigenen Aussage.
      expect(farbe?.a.streitwert?.[locale]).toBe(COLOR[locale].blue);
      expect(farbe?.b.streitwert?.[locale]).toBe(COLOR[locale].red);
      expect(farbe?.a.streitwert?.[locale]).not.toBe(farbe?.b.streitwert?.[locale]);
      expect(farbe?.a.text[locale].statement).toContain(COLOR[locale].blue);
      expect(farbe?.b.text[locale].statement).toContain(COLOR[locale].red);

      // Rhythmus: täglich/daily/dagelijks ↔ wöchentlich/weekly/wekelijks.
      expect(backup?.a.streitwert?.[locale]).toBe(RHYTHM[locale].daily);
      expect(backup?.b.streitwert?.[locale]).toBe(RHYTHM[locale].weekly);
      expect(backup?.a.streitwert?.[locale]).not.toBe(backup?.b.streitwert?.[locale]);
      expect(backup?.a.text[locale].statement).toContain(RHYTHM[locale].daily);
      expect(backup?.b.text[locale].statement).toContain(RHYTHM[locale].weekly);
    });
  }
});

describe("SCRUM-487: stale-date-Seiten (veraltet)", () => {
  for (const locale of LOCALES) {
    it(`[${locale}] Jahres-Token steht wörtlich in der Aussage, Version älter als frische Seiten`, () => {
      const stale = DEMO_CORPUS.filter((p) => p.effect === "stale");
      expect(stale.length).toBeGreaterThan(0);
      const freshMinVersion = Math.min(
        ...DEMO_CORPUS.filter((p) => p.effect !== "stale").map((p) => p.sourceVersion),
      );
      for (const page of stale) {
        expect(page.staleYear).toBeDefined();
        expect(page.text[locale].statement).toContain(page.staleYear ?? "___");
        expect(page.sourceVersion).toBeLessThan(freshMinVersion);
      }
    });
  }
});

describe("SCRUM-487: unbelegte Claims tragen keine Quelle", () => {
  for (const locale of LOCALES) {
    it(`[${locale}] unbacked → kein url, als bauchgefuehl markiert; belegte Seiten haben url`, () => {
      const items = corpusImportItems(locale);
      for (const page of DEMO_CORPUS) {
        const item = items.find((i) => i.pageId === page.pageId);
        expect(item).toBeDefined();
        if (page.effect === "unbacked") {
          expect(item?.url).toBeUndefined();
          expect(page.type).toBe("bauchgefuehl");
        } else {
          expect(item?.url).toBeTruthy();
        }
      }
    });
  }
});

// End-to-End über den echten Kandidaten-Accept-Pfad (KLARWERK_CONFLUENCE_IMPORT=1 → confluenceImport:
// true). KEIN Modell-Lauf — nur: aus dem Korpus werden echte KOs mit lokalisierten Aussagen.
describe("SCRUM-487: Korpus läuft durch den Kandidaten-Accept-Pfad", () => {
  for (const locale of LOCALES) {
    it(`[${locale}] createImportCandidates + accept erzeugt 8 KOs mit wörtlichen Streitwerten`, async () => {
      const koService = new KoService({ repo: new InMemoryKoRepo() });
      const library = new LibraryService({ koService, confluenceImport: true });

      const cands = await library.createImportCandidates(corpusImportItems(locale));
      expect(cands).toHaveLength(DEMO_CORPUS_PAGE_COUNT);
      for (const cand of cands) {
        await library.reviewImportCandidate(cand.id, "accept");
      }

      const kos = await koService.list();
      expect(kos).toHaveLength(DEMO_CORPUS_PAGE_COUNT);

      // Die vier Konflikt-Streitwerte tauchen wörtlich in den erzeugten KO-Aussagen auf.
      const statements = kos.map((k) => k.statement).join("\n");
      expect(statements).toContain(COLOR[locale].blue);
      expect(statements).toContain(COLOR[locale].red);
      expect(statements).toContain(RHYTHM[locale].daily);
      expect(statements).toContain(RHYTHM[locale].weekly);
    });
  }
});
