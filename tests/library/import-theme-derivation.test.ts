// WP-IC-PAKET-1 (Teil 2, Pedis Screenshot „(ohne Thema) 70"): DETERMINISTISCHE Themen-Ableitung aus
// Seitentiteln als Fallback ohne Quell-Labels. Getestet: die pure Ableitung (Stoppwörter DE/EN,
// Mindestgruppengröße 2, Determinismus, ehrliches „ohne Thema"), die Erkundungs-Integration
// (origin-Kennzeichnung, Label-Vorrang) und die Filterbarkeit abgeleiteter Themen in der Auswahl —
// alles OHNE Modell (der Cloud-Reasoner läuft live im Fallback; dieser Weg ist der Default).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportItem } from "../../services/library-analytics";
import {
  MIN_THEME_GROUP_SIZE,
  NO_THEME_LABEL,
  deriveTitleThemes,
  filterImportItems,
  sanitizeCriteria,
  summarizeImportItems,
} from "../../services/library-analytics";

function item(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: over.title ?? "T",
    statement: over.statement ?? "S",
    type: over.type ?? "best_practice",
    category: over.category ?? "K",
    ...over,
  };
}

describe("WP-IC-PAKET-1 Teil 2: deriveTitleThemes (pure)", () => {
  it("bildet Gruppen aus signifikanten Titel-Wörtern (Mindestgröße 2); Rest ehrlich null", () => {
    const themes = deriveTitleThemes([
      "Onboarding Guide Vertrieb",
      "Onboarding Checkliste neue Mitarbeiter",
      "Wartung Pumpe P7",
      "Wartung Ventile Halle 3",
      "Sicherheitsunterweisung Besucher",
    ]);
    expect(themes[0]).toBe("Onboarding");
    expect(themes[1]).toBe("Onboarding");
    expect(themes[2]).toBe("Wartung");
    expect(themes[3]).toBe("Wartung");
    // Kein geteiltes signifikantes Wort → ehrlich ohne Thema.
    expect(themes[4]).toBeNull();
    expect(MIN_THEME_GROUP_SIZE).toBe(2);
  });

  it("Stoppwörter DE/EN und Kurz-Tokens bilden NIE ein Thema", () => {
    const themes = deriveTitleThemes([
      "Der Plan für die Anlage",
      "Die Checkliste für den Start",
      "How to configure the printer",
      "What to check before the audit",
    ]);
    // Gemeinsame Wörter sind nur Funktionswörter (der/die/für/the/to) → keine Gruppen.
    expect(themes).toEqual([null, null, null, null]);
  });

  it("deterministisch: gleicher Input → identisches Ergebnis; Gleichstand alphabetisch aufgelöst", () => {
    const titles = ["Wartung Onboarding", "Wartung Onboarding", "Anderes"];
    const a = deriveTitleThemes(titles);
    const b = deriveTitleThemes(titles);
    expect(a).toEqual(b);
    // Beide Wörter kommen in 2 Titeln vor → alphabetisch gewinnt „Onboarding".
    expect(a[0]).toBe("Onboarding");
  });

  // WP-IC-PAKET-1b (bens GELB-2): der Gleichstand-Vergleich ist ein FESTER Codepoint-Vergleich (a < b),
  // KEIN localeCompare — localeCompare hängt von ICU/Locale der Laufzeit ab und wäre umgebungsabhängig.
  it("GELB-2: Codepoint-Vergleich statt localeCompare (umgebungsfester Determinismus)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "services/library-analytics/src/themes.ts"),
      "utf8",
    );
    expect(src).not.toContain("localeCompare");
    expect(src).toContain("token < best");
    // Verhaltens-Pin am Codepoint-Rand: „zebra" (z) verliert gegen „ähre"? Codepoint: "z" (0x7A) <
    // "ä" (0xE4) → „zebra" gewinnt den Gleichstand — genau die feste, locale-unabhängige Ordnung.
    const themes = deriveTitleThemes(["Zebra Ähre", "Zebra Ähre"]);
    expect(themes[0]).toBe("Zebra");
  });

  it("Gruppen, die nach der Zuordnung unter die Mindestgröße fallen, werden ehrlich aufgelöst", () => {
    // „bericht" teilt sich mit Titel 1+2, aber beide gehen an die größere Gruppe „wartung" (3 Titel).
    const themes = deriveTitleThemes([
      "Wartung Bericht April",
      "Wartung Bericht Mai",
      "Wartung Plan Juni",
    ]);
    expect(themes).toEqual(["Wartung", "Wartung", "Wartung"]);
  });
});

describe("WP-IC-PAKET-1 Teil 2: Erkundung mit abgeleiteten Themen", () => {
  const UNTAGGED = [
    item({ title: "Onboarding Guide Vertrieb" }),
    item({ title: "Onboarding Checkliste neue Mitarbeiter" }),
    item({ title: "Sicherheitsunterweisung Besucher" }),
  ];

  it("label-lose Items bekommen abgeleitete Themen mit origin=derived; Rest bleibt (ohne Label)", () => {
    const s = summarizeImportItems(UNTAGGED);
    expect(s.themes).toEqual([
      { label: "Onboarding", count: 2, origin: "derived" },
      { label: NO_THEME_LABEL, count: 1 },
    ]);
  });

  it("echte Labels bleiben die Wahrheit (KEIN origin) und haben Vorrang vor der Ableitung", () => {
    const s = summarizeImportItems([
      item({ title: "Onboarding Guide", tags: ["onboarding-label"] }),
      item({ title: "Onboarding Checkliste" }),
      item({ title: "Onboarding FAQ" }),
    ]);
    const labelTheme = s.themes.find((t) => t.label === "onboarding-label");
    expect(labelTheme).toEqual({ label: "onboarding-label", count: 1 });
    // Die beiden label-losen Titel bilden weiterhin ihre abgeleitete Gruppe.
    const derived = s.themes.find((t) => t.label === "Onboarding");
    expect(derived).toEqual({ label: "Onboarding", count: 2, origin: "derived" });
  });

  it("trägt die Quell-Container namentlich (sourceNames) für den Space-Filter", () => {
    const s = summarizeImportItems([
      item({ sourceScope: "OPS" }),
      item({ sourceScope: "OPS" }),
      item({ sourceScope: "DOKU" }),
    ]);
    expect(s.sourceNames).toEqual([
      { name: "OPS", count: 2 },
      { name: "DOKU", count: 1 },
    ]);
    expect(s.distinctSources).toBe(2);
  });
});

describe("WP-IC-PAKET-1 Teil 2/3: Auswahl filtert abgeleitete Themen und Spaces", () => {
  const ITEMS = [
    item({ title: "Onboarding Guide Vertrieb", sourceScope: "OPS" }),
    item({ title: "Onboarding Checkliste neue Mitarbeiter", sourceScope: "DOKU" }),
    item({ title: "Sicherheitsunterweisung Besucher", sourceScope: "OPS" }),
  ];

  it("Klick auf ein ABGELEITETES Thema filtert die label-losen Items (identische Ableitung)", () => {
    const res = filterImportItems(ITEMS, { themes: ["Onboarding"] });
    expect(res.matched).toBe(2);
    expect(res.selected.map((i) => i.title)).toEqual([
      "Onboarding Guide Vertrieb",
      "Onboarding Checkliste neue Mitarbeiter",
    ]);
  });

  it("Space-Filter grenzt auf den Quell-Container ein (case-insensitiv)", () => {
    const res = filterImportItems(ITEMS, { spaces: ["ops"] });
    expect(res.matched).toBe(2);
    expect(res.selected.every((i) => i.sourceScope === "OPS")).toBe(true);
  });

  it("sanitizeCriteria lässt spaces als valides Feld durch (und wirft Müll weg)", () => {
    expect(sanitizeCriteria({ spaces: ["OPS", " ", 7, "OPS"] })).toEqual({ spaces: ["OPS"] });
    expect(sanitizeCriteria({ spaces: "kein-array" })).toEqual({});
  });
});
