import { describe, expect, it } from "vitest";
import { OUTPUT_KIND_OPTIONS, downloadFilename } from "../../apps/web/src/lib/outputDoc";

describe("FE-OUT / SCRUM-109: outputDoc helpers", () => {
  it("bietet genau die fünf Output-Typen", () => {
    expect(OUTPUT_KIND_OPTIONS.map((o) => o.kind)).toEqual([
      "instruction",
      "checklist",
      "troubleshooting",
      "training",
      "management_summary",
    ]);
  });

  it("downloadFilename nutzt Typ + Datum (.md)", () => {
    expect(downloadFilename({ kind: "checklist", generatedAt: "2026-06-26T10:00:00.000Z" })).toBe(
      "klarwerk-checklist-2026-06-26.md",
    );
  });

  // R-1349 (Aufnahme gesamt-aufruferwaechter): Der Fall zu `orderedSelection` ist mit der Funktion
  // entfallen — sie hatte keinen Produktleser; die Factory behält die Nutzer-Reihenfolge
  // (`sanitizeOrder`).
});
