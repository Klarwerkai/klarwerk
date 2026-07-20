import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportSelectCriteria } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { summarizeSelectCriteria } from "../../apps/web/src/lib/importExplore";

// IC-3: pures Auswahl-Kriterien-View-Model + Verdrahtung (Source-Inspektion, Muster capture-from-file).

const LABELS = {
  themes: "Themen",
  authors: "Autoren",
  keywords: "Stichworte",
  years: "Jahre",
  limit: "Limit",
  // WP-IC-PAKET-1 (Teil 3): Space-Filter-Zeile.
  spaces: "Bereiche",
};

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("IC-3: summarizeSelectCriteria", () => {
  it("leere Kriterien → leere Liste (die Komponente zeigt alles)", () => {
    expect(summarizeSelectCriteria({}, LABELS)).toEqual([]);
  });

  it("bildet gesetzte Felder auf lesbare Zeilen ab", () => {
    const criteria: ImportSelectCriteria = {
      themes: ["wartung", "safety"],
      authors: ["Anna"],
      keywords: ["e5"],
      yearFrom: 2020,
      yearTo: 2026,
      limit: 50,
    };
    expect(summarizeSelectCriteria(criteria, LABELS)).toEqual([
      "Themen: wartung, safety",
      "Autoren: Anna",
      "Stichworte: e5",
      "Jahre: 2020–2026",
      "Limit: 50",
    ]);
  });

  it("WP-IC-PAKET-1 (Teil 3): Space-Filter erscheint als eigene Zeile", () => {
    expect(summarizeSelectCriteria({ spaces: ["OPS", "DOKU"] }, LABELS)).toEqual([
      "Bereiche: OPS, DOKU",
    ]);
  });

  it("offene Jahres-Grenze wird mit … dargestellt", () => {
    expect(summarizeSelectCriteria({ yearFrom: 2024 }, LABELS)).toEqual(["Jahre: 2024–…"]);
    expect(summarizeSelectCriteria({ yearTo: 2024 }, LABELS)).toEqual(["Jahre: …–2024"]);
  });
});

describe("IC-3: Verdrahtung im Import-Cockpit", () => {
  it("ImportExplore rendert die Auswahl-Komponente ImportSelect (Chips der Landkarte als Filter)", () => {
    const src = read("apps/web/src/components/ImportExplore.tsx");
    expect(src).toContain('import { ImportSelect } from "./ImportSelect"');
    // WP-IC-PAKET-1 (Teil 3): die Landkarten-Chips (Themen/Autoren/Spaces) speisen die Auswahl.
    expect(src).toContain(
      "<ImportSelect chip={{ themes: selThemes, authors: selAuthors, spaces: selSpaces }} />",
    );
  });

  it("ImportSelect verdrahtet den READ-ONLY select-Client und das View-Model", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    expect(src).toContain("endpoints.admin.import.select(");
    expect(src).toContain("summarizeSelectCriteria(");
    // Noch KEIN Übernahme-Button (das ist IC-4) und kein Schreib-/Kandidaten-Aufruf.
    expect(src).not.toContain("importCandidates");
    expect(src).not.toContain(".review(");
  });

  it("endpoints.ts stellt admin.import.select auf den READ-ONLY select-Pfad", () => {
    const src = read("apps/web/src/api/endpoints.ts");
    expect(src).toContain("/admin/import/confluence/select");
    expect(src).toContain("ImportSelectResponse");
  });

  it("die neuen imp.select-Texte sind in DE/EN/NL vorhanden", () => {
    const keys = [
      "imp.select.title",
      "imp.select.promptPlaceholder",
      "imp.select.previewCta",
      "imp.select.matched",
      "imp.select.critThemes",
      "imp.select.critAll",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("en", "translation", "imp.select.matched"))).toContain(
      "{{matched}}",
    );
  });
});
