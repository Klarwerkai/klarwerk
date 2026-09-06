import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ImportParseError,
  importParseNotice,
  parseImportItems,
} from "../../apps/web/src/lib/importReview";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

function errorFor(text: string): ImportParseError {
  try {
    parseImportItems(text);
  } catch (error) {
    expect(error).toBeInstanceOf(ImportParseError);
    return error as ImportParseError;
  }
  throw new Error("Datei wurde unerwartet angenommen");
}

const valid = { title: "A", statement: "B", category: "C", type: "technik" };

describe("UX-20: Ablehnungsgrund", () => {
  it("R1 Syntax hat keinen Eintragsindex", () => {
    expect(errorFor('[{"title":"A",')).toMatchObject({ kind: "syntax", index: null, fields: [] });
  });

  it("R2 kein Array unterscheidet sich von Syntax, auch im Textschluessel", () => {
    const structure = errorFor('{"title":"A"}');
    expect(structure).toMatchObject({ kind: "not-array", index: null });
    expect(importParseNotice(structure).key).not.toBe(importParseNotice(errorFor("[")).key);
  });

  it("R3 unbekannter Typ benennt type und Eintrag 1", () => {
    const error = errorFor(JSON.stringify([{ ...valid, type: "unfug" }]));
    expect(error).toMatchObject({ kind: "fields", index: 0, fields: ["type"] });
    expect(importParseNotice(error).params).toMatchObject({ n: 1, fields: "type" });
  });

  it("R4 alle fehlenden Felder, keine intakten Felder", () => {
    expect(errorFor('[{"title":"A","statement":"B"}]').fields).toEqual(["category", "type"]);
  });

  it("R5 Eintrag ist kein Objekt", () => {
    expect(errorFor("[1]")).toMatchObject({ kind: "not-object", index: 0, fields: [] });
  });

  it("erster Fehler und menschliche Eintragsnummer auch nach gueltigem Eintrag", () => {
    const error = errorFor(
      JSON.stringify([valid, { title: 3, statement: null, category: false, type: 1 }, null]),
    );
    expect(error).toMatchObject({ index: 1, fields: ["title", "statement", "category", "type"] });
    expect(importParseNotice(error).params).toMatchObject({ n: 2 });
  });

  it("R6 alle fuenf Bestandstypen und optionale Felder bleiben kompatibel", () => {
    // Absichtlich unabhaengiger Vertrags-Pin: G4 muss auch bei geaenderter Prueftabelle rot werden.
    const types = ["bauchgefuehl", "best_practice", "lernkurve", "technik", "negativwissen"];
    const items = types.map((type) => ({
      ...valid,
      type,
      tags: ["a", 1, null, "b"],
      author: "Anna",
      extra: "ignorieren",
    }));
    expect(parseImportItems(JSON.stringify(items))).toEqual(
      types.map((type) => ({ ...valid, type, tags: ["a", "b"], author: "Anna" })),
    );
    expect(
      parseImportItems(
        JSON.stringify([
          { ...valid, title: "", statement: "", category: "", tags: "a", author: 1 },
        ]),
      ),
    ).toEqual([{ ...valid, title: "", statement: "", category: "" }]);
    expect(parseImportItems("[]")).toEqual([]);
  });

  it.each([
    ['[{"title":"A",', "invalid-json"],
    ['{"title":"A"}', "not-array"],
    ["[1]", "item-0-not-object"],
    ["[null]", "item-0-not-object"],
    ["[[]]", "item-0-fields"],
    ['[{"title":"A","statement":"B"}]', "item-0-fields"],
    [JSON.stringify([{ ...valid, type: "unfug" }]), "item-0-fields"],
  ])("R6 unveraenderte message fuer %s", (input, message) => {
    expect(errorFor(input).message).toBe(message);
  });

  it.each(["de", "en", "nl"])("Ursachen und naechster Schritt in %s, ohne Dateiinhalt", (lng) => {
    const t = i18n.getFixedT(lng);
    const errors = [
      errorFor("["),
      errorFor("{}"),
      errorFor("[1]"),
      errorFor('[{"title":"GEHEIMER DATEIINHALT","statement":"B"}]'),
    ];
    const notices = errors.map(importParseNotice);
    expect(new Set(notices.map(({ key }) => key)).size).toBe(4);
    const texts = notices.map(({ key, params }) => {
      expect(i18n.getResource(lng, "translation", key)).toBeTypeOf("string");
      const text = String(t(key, params));
      expect(text).not.toMatch(/GEHEIMER DATEIINHALT|item-\d|not-array|\{\{|imp\./);
      return text;
    });
    expect(texts[0]).toMatch(/Editor|editor/);
    expect(texts[1]).toMatch(/Liste|list|lijst/);
    expect(texts[2]).toContain("1");
    expect(texts[3]).toContain("category, type");
    expect(texts[3]).toMatch(/ergänze|correct|corrigeer/);
    expect(texts[3]).toContain("negativwissen");
  });

  it("L6 echter Bibliotheks-JSON-Export wird vom unveraenderten Importvertrag angenommen", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const item = {
      ...valid,
      type: "technik" as const,
      author: "Anna",
      tags: ["a"],
      confidentiality: "intern" as const,
    };
    const ko = await koService.create(item);
    await koService.setValidationState(ko.id, { trust: 80, status: "validiert" });
    const exported = await new LibraryService({ koService }).exportJson();
    expect(exported).toHaveLength(1);
    expect(parseImportItems(JSON.stringify(exported))).toEqual([
      { ...valid, author: "Anna", tags: ["a"] },
    ]);
  });
});
