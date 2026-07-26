// AUFTRAG-mega10 Block A: ERST MESSEN, DANN BAUEN.
//
// Im Code stand seit nacht24 der Vertrag „10.000+ flüssig“ (libraryFacets.ts Kopfkommentar) — als
// Behauptung, nie nachgemessen. Diese Datei misst ihn. Sie erzeugt den Bestand SYNTHETISCH und NUR
// hier (kein Demo-Seed, keine Datenbank) und ruft exakt die Funktionen auf, die `Library.tsx` je
// Datenlauf bzw. je Render aufruft:
//
//   1. facetBase      — libraryFilterValues je KO, EINMAL je Datenlauf (useMemo auf query.data)
//   2. buildFacetGroups — ein voller Durchlauf über ALLE Dimensionen (Kontext-Zähler + Universum)
//   3. applyFacetSelection + sortLibrary — die Treffermenge filtern und sortieren
//   4. „ein Häkchen bis zum neu gezeichneten Ergebnis“ — die VOLLE Render-Kette, die ein Klick
//      auslöst: searchLibrary → buildFacetGroups → applyFacetSelection → sortLibrary → windowList
//
// Die Zahlen werden GEDRUCKT (der Bericht zitiert sie). Als Zusicherung stehen hier bewusst nur
// (a) die KORREKTHEIT bei großem Bestand und (b) eine sehr großzügige Obergrenze — eine enge
// Zeitschranke im Gate wäre auf fremder Hardware flatterig und würde eine ehrliche Messung in eine
// unehrliche Zusicherung verwandeln.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { buildFacetGroups } from "../../apps/web/src/lib/facetFilter";
import { type FacetSelection, applyFacetSelection } from "../../apps/web/src/lib/facets";
import { windowList } from "../../apps/web/src/lib/libraryDisplay";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { searchLibrary } from "../../apps/web/src/lib/librarySearch";
import { sortLibrary } from "../../apps/web/src/lib/librarySort";

// Dieselbe Dimensionsliste, die die Bibliothek anzeigt (Block C) — inklusive der in mega10
// hinzugekommenen Vertraulichkeit. Bewusst hier dupliziert und NICHT aus der Seite importiert:
// die Seite ist ein .tsx-Modul mit React-Abhängigkeiten; die Messung soll die reine Rechenlast
// messen, nicht den Import einer Komponente.
const DIMENSIONS = [
  { key: "maturity", labelKey: "lib.facet.maturity" },
  { key: "category", labelKey: "lib.facet.category" },
  { key: "tag", labelKey: "lib.facet.tag" },
  { key: "confidentiality", labelKey: "lib.facet.confidentiality" },
  { key: "author", labelKey: "lib.facet.author" },
  { key: "origin", labelKey: "lib.facet.origin" },
  { key: "type", labelKey: "lib.facet.type" },
  { key: "language", labelKey: "lib.facet.language" },
  { key: "age", labelKey: "lib.facet.age" },
  { key: "trust", labelKey: "lib.facet.trust" },
] as const;

// --- Synthetischer Bestand: deterministisch (LCG mit fester Saat, kein Math.random) ------------
// Die Verteilungen sind bewusst REALISTISCH GEMEIN: viele Autoren (der teure Fall — hunderte
// Facettenwerte in EINER Dimension), Mehrfach-Tags je KO, ein Zehntel der KOs ohne Kategorie.
let seed = 20260725;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(values: readonly T[]): T {
  return values[Math.floor(rnd() * values.length)] as T;
}

const CATEGORIES = [
  "Produktion",
  "Arbeitssicherheit",
  "IT & Systeme",
  "Personal",
  "Einkauf",
  "Vertrieb",
  "Finanzen",
  "Recht & Compliance",
  "Instandhaltung",
  "Umwelt & Energie",
];
const TAGS = [
  "sicherheitsrelevant",
  "auditpflichtig",
  "kundenspezifisch",
  "gesetzlich",
  "ISO 9001",
  "ISO 45001",
  "Erstunterweisung",
  "Nachtschicht",
  "Winterbetrieb",
  "Fremdfirma",
  "Gefahrgut",
  "Notfall",
  "Erstmuster",
  "Serienanlauf",
  "Altbestand",
];
const TYPES = ["bauchgefuehl", "best_practice", "lernkurve", "technik", "negativwissen"] as const;
const CONF = ["intern", "vertraulich", "streng_vertraulich"] as const;
const LANG_PREFIX = ["", "[DE] ", "[EN] ", "[NL] "];
const NOW = Date.parse("2026-07-25T00:00:00.000Z");
const DAY = 86_400_000;
// 400 Autoren — genau der Fall, den Block B Punkt 1 adressiert („der gesuchte Autor ist fast immer
// im Rest, und dort ist er nicht anwählbar").
const AUTHORS = Array.from({ length: 400 }, (_, i) => `u${i}`);

function buildStock(n: number): KnowledgeObject[] {
  seed = 20260725;
  const out: KnowledgeObject[] = [];
  for (let i = 0; i < n; i++) {
    const tagCount = rnd() < 0.45 ? 0 : rnd() < 0.7 ? 1 : 2;
    const tags: string[] = [];
    for (let k = 0; k < tagCount; k++) {
      const tag = pick(TAGS);
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
    const ageDays = Math.floor(rnd() ** 1.8 * 1450);
    out.push({
      id: `ko-${i}`,
      title: `${pick(LANG_PREFIX)}Vorgehen bei Freigabe ${i}`,
      statement: "Der Grenzwert wurde 2024 gesenkt; ältere Aushänge nennen noch den alten Wert.",
      conditions: [],
      measures: [],
      type: pick(TYPES),
      // Ein Zehntel ohne Kategorie — die Facette muss den leeren Wert ehrlich verkraften.
      category: rnd() < 0.1 ? "" : pick(CATEGORIES),
      tags,
      confidence: Math.floor(rnd() * 100),
      trust: Math.floor(rnd() * 100),
      status: rnd() < 0.4 ? "validiert" : "offen",
      version: 1,
      originalAuthor: pick(AUTHORS),
      author: pick(AUTHORS),
      neededValidations: 2,
      assignments: rnd() < 0.3 ? ["u1"] : [],
      confidentiality: pick(CONF),
      asset: null,
      createdAt: new Date(NOW - ageDays * DAY).toISOString(),
      history: [],
    } as unknown as KnowledgeObject);
  }
  return out;
}

// --- Messhilfen --------------------------------------------------------------------------------
// Mehrfach messen und den MEDIAN nehmen: ein einzelner Lauf misst auf einer geteilten Maschine
// genauso oft die Nachbarlast wie den Code.
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
}
function measure(runs: number, fn: () => unknown): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}
const ms = (v: number): string => `${v.toFixed(1)} ms`;

interface Row {
  size: number;
  facetBase: number;
  groups: number;
  filterSort: number;
  click: number;
}

describe("Block A · Messung: trägt der client-seitige Facetten-Weg 10.000 Beiträge?", () => {
  const rows: Row[] = [];

  for (const size of [1_000, 10_000, 50_000]) {
    it(`misst ${size.toLocaleString("de-DE")} Wissensobjekte`, () => {
      const stock = buildStock(size);
      // Eine Auswahl, wie sie beim Filtern real entsteht (zwei Dimensionen aktiv) — der teure
      // Fall für die Kontext-Zähler, weil buildFacetGroups je Dimension über den Bestand läuft.
      const selection: FacetSelection = {
        maturity: ["ready"],
        category: ["Produktion", "Arbeitssicherheit"],
      };

      // 1 · facetBase — die teure Wert-Ableitung, EINMAL je Datenlauf.
      let base = new Map<string, ReturnType<typeof libraryFilterValues>>();
      const tBase = measure(3, () => {
        const now = NOW;
        base = new Map(stock.map((k) => [k.id, libraryFilterValues(k, now)]));
      });

      const valuesOf = (item: { ko: { id: string } }) => base.get(item.ko.id) ?? {};
      const ranked = searchLibrary(stock, "");

      // 2 · buildFacetGroups — ein voller Durchlauf über ALLE Dimensionen.
      const tGroups = measure(3, () =>
        buildFacetGroups(ranked.map(valuesOf), DIMENSIONS, selection),
      );

      // 3 · applyFacetSelection + sortLibrary.
      const tFilterSort = measure(3, () =>
        sortLibrary(applyFacetSelection(ranked, valuesOf, selection), "recent", (i) => i.ko),
      );

      // 4 · ein Häkchen bis zum neu gezeichneten Ergebnis — die VOLLE Kette eines Renders.
      //     (facetBase bleibt memoisiert, deshalb NICHT Teil dieser Messung — genau wie in der Seite.)
      const tClick = measure(5, () => {
        const r = searchLibrary(stock, "");
        buildFacetGroups(r.map(valuesOf), DIMENSIONS, selection);
        return windowList(
          sortLibrary(applyFacetSelection(r, valuesOf, selection), "recent", (i) => i.ko),
        );
      });

      rows.push({
        size,
        facetBase: tBase,
        groups: tGroups,
        filterSort: tFilterSort,
        click: tClick,
      });

      // KORREKTHEIT bei großem Bestand — das ist die eigentliche Zusicherung dieser Datei.
      const groups = buildFacetGroups(ranked.map(valuesOf), DIMENSIONS, selection);
      const faceted = applyFacetSelection(ranked, valuesOf, selection);
      expect(base.size).toBe(size);
      expect(groups).toHaveLength(DIMENSIONS.length);
      // Jeder Treffer erfüllt beide aktiven Dimensionen (ODER innerhalb, UND zwischen den Gruppen).
      expect(
        faceted.every((item) => {
          const v = valuesOf(item);
          return (
            v.maturity?.includes("ready") === true &&
            (v.category?.includes("Produktion") === true ||
              v.category?.includes("Arbeitssicherheit") === true)
          );
        }),
      ).toBe(true);
      // Die Autoren-Dimension hat bei diesem Bestand hunderte Werte — der Anzeige-Deckel greift
      // und weist den Rest ehrlich aus (das ist der Befund, den Block B Punkt 1 behebt).
      const authorGroup = groups.find((g) => g.key === "author");
      expect(authorGroup?.hiddenCount).toBeGreaterThan(0);

      // Sehr großzügige Obergrenze — nur ein Reißleinen-Schutz gegen eine echte Explosion
      // (z. B. eine versehentlich quadratische Änderung), keine Leistungszusage.
      expect(tClick).toBeLessThan(30_000);
    });
  }

  it("druckt die Messtabelle für den Bericht", () => {
    const lines = [
      "",
      "  Block A · Messung (Median aus mehreren Läufen, jsdom/Node auf der Entwicklungsmaschine)",
      "  ┌──────────┬───────────────┬──────────────────┬───────────────────┬────────────────────┐",
      "  │  Bestand │  facetBase    │  buildFacetGroups│  Filter + Sort    │  Häkchen → Ergebnis│",
      "  ├──────────┼───────────────┼──────────────────┼───────────────────┼────────────────────┤",
      ...rows.map(
        (r) =>
          `  │ ${String(r.size.toLocaleString("de-DE")).padStart(8)} │ ${ms(r.facetBase).padStart(13)} │ ${ms(r.groups).padStart(16)} │ ${ms(r.filterSort).padStart(17)} │ ${ms(r.click).padStart(18)} │`,
      ),
      "  └──────────┴───────────────┴──────────────────┴───────────────────┴────────────────────┘",
      "",
    ];
    // Block A verlangt ausdrücklich gemeldete Messzahlen — deshalb hier bewusst eine Ausgabe.
    console.log(lines.join("\n"));
    expect(rows).toHaveLength(3);
  });
});
