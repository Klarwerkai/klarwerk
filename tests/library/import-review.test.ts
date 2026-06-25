import { describe, expect, it } from "vitest";
import { ImportParseError, parseImportItems } from "../../apps/web/src/lib/importReview";

const valid = JSON.stringify([
  { title: "A", statement: "Inhalt A", type: "technik", category: "X", tags: ["t1"] },
  { title: "B", statement: "Inhalt B", type: "best_practice", category: "Y", author: "anna" },
]);

describe("SCRUM-108: JSON-Import-Parser", () => {
  it("parst eine gültige Kandidatenliste", () => {
    const items = parseImportItems(valid);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "A", type: "technik", category: "X", tags: ["t1"] });
    expect(items[1]?.author).toBe("anna");
  });

  it("wirft bei ungültigem JSON", () => {
    expect(() => parseImportItems("{kein json")).toThrow(ImportParseError);
  });

  it("wirft, wenn kein Array", () => {
    expect(() => parseImportItems('{"title":"A"}')).toThrow(ImportParseError);
  });

  it("wirft bei fehlenden/ungültigen Feldern", () => {
    expect(() => parseImportItems('[{"title":"A"}]')).toThrow(ImportParseError);
    expect(() =>
      parseImportItems('[{"title":"A","statement":"s","category":"c","type":"unknown"}]'),
    ).toThrow(ImportParseError);
  });
});
