import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ADVANCED_FIELDS_KEYS,
  ADVANCED_FIELDS_TOTAL,
  advancedFieldsSummary,
} from "../../apps/web/src/lib/captureAdvancedFields";

// SCRUM-375 / AG-12 / KG-UX-001/003/010: erweiterte/technische Capture-Felder als Progressive Disclosure.
// Der Helfer zählt nur ehrlich die schon ausgefüllten Felder (für Badge + Auto-Aufklappen). DOM-frei.
describe("SCRUM-375: captureAdvancedFields", () => {
  it("leer → filledCount 0, hasAny false", () => {
    expect(advancedFieldsSummary({})).toEqual({ filledCount: 0, hasAny: false });
    expect(
      advancedFieldsSummary({
        category: "",
        asset: "",
        neededValidations: "",
        tags: [],
        documentCount: 0,
        imageCount: 0,
      }),
    ).toEqual({ filledCount: 0, hasAny: false });
  });

  it("jedes ausgefüllte Feld zählt genau einmal", () => {
    expect(advancedFieldsSummary({ category: "Anlage 3" }).filledCount).toBe(1);
    expect(advancedFieldsSummary({ asset: "Pumpe P7" }).filledCount).toBe(1);
    expect(advancedFieldsSummary({ neededValidations: "2" }).filledCount).toBe(1);
    expect(advancedFieldsSummary({ tags: ["riemen"] }).filledCount).toBe(1);
    expect(advancedFieldsSummary({ documentCount: 1 }).filledCount).toBe(1);
    expect(advancedFieldsSummary({ imageCount: 3 }).filledCount).toBe(1);
    // R-0922: auch was sonst hinter dem Aufklapper liegt, zählt — sonst verschweigt der Kopf es.
    expect(advancedFieldsSummary({ confidentialityDeclared: true }).filledCount).toBe(1);
    expect(advancedFieldsSummary({ reviewerCount: 2 }).filledCount).toBe(1);
    expect(advancedFieldsSummary({ sourceCount: 4 }).filledCount).toBe(1);
  });

  it("R-0922: nicht gewählte Vertraulichkeit, keine Prüfer, keine Quellen zählen NICHT", () => {
    expect(
      advancedFieldsSummary({ confidentialityDeclared: false, reviewerCount: 0, sourceCount: 0 }),
    ).toEqual({ filledCount: 0, hasAny: false });
  });

  it("alle Felder gefüllt → filledCount = ADVANCED_FIELDS_TOTAL, hasAny true", () => {
    expect(ADVANCED_FIELDS_TOTAL).toBe(9);
    expect(
      advancedFieldsSummary({
        category: "A",
        asset: "B",
        neededValidations: "2",
        tags: ["t"],
        documentCount: 1,
        imageCount: 1,
        confidentialityDeclared: true,
        reviewerCount: 1,
        sourceCount: 1,
      }),
    ).toEqual({ filledCount: ADVANCED_FIELDS_TOTAL, hasAny: true });
  });

  it("defensiv: reiner Whitespace / leere Tags zählen NICHT", () => {
    expect(advancedFieldsSummary({ category: "   " }).filledCount).toBe(0);
    expect(advancedFieldsSummary({ tags: ["", "  "] }).filledCount).toBe(0);
    expect(advancedFieldsSummary({ category: null, asset: null }).filledCount).toBe(0);
  });

  it("Copy ist DE und EN vorhanden (keine leeren Keys)", () => {
    for (const key of Object.values(ADVANCED_FIELDS_KEYS)) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: erweiterte Felder sind optional (nichts wird zur Pflicht gemacht) (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", ADVANCED_FIELDS_KEYS.title) ?? "")).toMatch(
      /optional/i,
    );
    expect(String(i18n.getResource("de", "translation", ADVANCED_FIELDS_KEYS.hint) ?? "")).toMatch(
      /nichts davon ist Pflicht|jederzeit/i,
    );
    expect(String(i18n.getResource("en", "translation", ADVANCED_FIELDS_KEYS.hint) ?? "")).toMatch(
      /none of these is required|anytime/i,
    );
  });
});
