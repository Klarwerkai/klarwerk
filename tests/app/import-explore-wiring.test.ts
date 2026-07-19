import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

// IC-2: Source-Inspektion (Muster capture-from-file) — ImportReview bindet die READ-ONLY Erkundung
// oben ein, die Komponente verdrahtet den explore-Client + das pure View-Model, und die neuen
// i18n-Keys sind in DE/EN/NL vorhanden.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("IC-2: ImportReview bindet die Erkundungs-Ansicht ein", () => {
  it("Stufe2.tsx rendert <ImportExplore/> und importiert die Komponente", () => {
    const src = read("apps/web/src/pages/Stufe2.tsx");
    expect(src).toContain('import { ImportExplore } from "../components/ImportExplore"');
    expect(src).toContain("<ImportExplore />");
  });

  it("ImportExplore verdrahtet den explore-Client und das pure View-Model", () => {
    const src = read("apps/web/src/components/ImportExplore.tsx");
    expect(src).toContain("endpoints.admin.import.explore()");
    expect(src).toContain("toExploreView(");
    // Read-only: keine Kandidaten-/Schreib-Aufrufe in der Erkundungs-Komponente.
    expect(src).not.toContain("importCandidates");
    expect(src).not.toContain(".review(");
    // Quellen-Kacheln Confluence (aktiv) + Jira (bald).
    expect(src).toContain("Confluence");
    expect(src).toContain("Jira");
  });

  it("endpoints.ts stellt admin.import.explore auf den READ-ONLY Explore-Pfad", () => {
    const src = read("apps/web/src/api/endpoints.ts");
    expect(src).toContain("/admin/import/confluence/explore");
    expect(src).toContain("ImportExploreResponse");
  });

  it("die neuen imp.explore-Texte sind in DE/EN/NL vorhanden", () => {
    const keys = [
      "imp.explore.title",
      "imp.explore.cta",
      "imp.explore.pages",
      "imp.explore.period",
      "imp.explore.more",
      "imp.explore.truncated",
      "imp.explore.noAuthor",
      "imp.explore.noTheme",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    // Interpolations-Platzhalter bleiben erhalten.
    expect(String(i18n.getResource("en", "translation", "imp.explore.more"))).toContain("{{n}}");
  });
});
