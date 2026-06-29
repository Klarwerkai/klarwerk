import { describe, expect, it } from "vitest";
import {
  type KoRevisionFields,
  type KoRevisionItemId,
  koRevisionSummary,
} from "../../apps/web/src/lib/koRevisionSummary";

// SCRUM-325: DOM-freier Änderungsüberblick (Feld-/Struktur-Diff, KEIN Text-Diff, keine Validierung).
const BASE: KoRevisionFields = {
  title: "Titel",
  statement: "Aussage",
  bodyHtml: "<p>Inhalt</p>",
  type: "best_practice",
  category: "Montage",
  conditions: ["A", "B"],
  measures: ["M1"],
  tags: ["x", "y"],
};

describe("SCRUM-325: koRevisionSummary", () => {
  it("identischer Edit-State → keine Änderungen", () => {
    const s = koRevisionSummary(BASE, { ...BASE });
    expect(s.hasChanges).toBe(false);
    expect(s.changedCount).toBe(0);
    expect(s.items).toEqual([]);
  });

  it("Statement geändert", () => {
    const s = koRevisionSummary(BASE, { ...BASE, statement: "Neue Aussage" });
    expect(s.statementChanged).toBe(true);
    expect(s.hasChanges).toBe(true);
    expect(s.items.map((i) => i.id)).toEqual<KoRevisionItemId[]>(["statement"]);
  });

  it("Body geändert", () => {
    const s = koRevisionSummary(BASE, { ...BASE, bodyHtml: "<p>Anders</p>" });
    expect(s.bodyChanged).toBe(true);
    expect(s.items.map((i) => i.id)).toEqual(["body"]);
  });

  it("Conditions geändert (Reihenfolge zählt)", () => {
    expect(koRevisionSummary(BASE, { ...BASE, conditions: ["A", "C"] }).conditionsChanged).toBe(
      true,
    );
    // Umsortierung gilt bewusst als Änderung.
    expect(koRevisionSummary(BASE, { ...BASE, conditions: ["B", "A"] }).conditionsChanged).toBe(
      true,
    );
  });

  it("Measures geändert", () => {
    expect(koRevisionSummary(BASE, { ...BASE, measures: ["M1", "M2"] }).measuresChanged).toBe(true);
  });

  it("Tags geändert (Menge, Reihenfolge egal)", () => {
    expect(koRevisionSummary(BASE, { ...BASE, tags: ["x", "z"] }).tagsChanged).toBe(true);
    // gleiche Menge in anderer Reihenfolge → KEINE Änderung.
    expect(koRevisionSummary(BASE, { ...BASE, tags: ["y", "x"] }).tagsChanged).toBe(false);
  });

  it("Typ und Kategorie geändert", () => {
    expect(koRevisionSummary(BASE, { ...BASE, type: "case" }).typeChanged).toBe(true);
    expect(koRevisionSummary(BASE, { ...BASE, category: "Wartung" }).categoryChanged).toBe(true);
  });

  it("Whitespace-only zählt nicht als Änderung", () => {
    const s = koRevisionSummary(BASE, {
      ...BASE,
      statement: "  Aussage  ",
      category: "Montage ",
      bodyHtml: "<p>Inhalt</p>\n",
    });
    expect(s.hasChanges).toBe(false);
  });

  it("leere/whitespace Array-Einträge werden ignoriert", () => {
    expect(
      koRevisionSummary(BASE, { ...BASE, conditions: ["A", "B", "  ", ""] }).conditionsChanged,
    ).toBe(false);
    expect(koRevisionSummary(BASE, { ...BASE, tags: ["x", "y", " ", ""] }).tagsChanged).toBe(false);
  });

  it("changedCount + Item-IDs stabil in fester Reihenfolge", () => {
    const s = koRevisionSummary(BASE, {
      ...BASE,
      type: "case",
      statement: "Neu",
      tags: ["a"],
    });
    expect(s.changedCount).toBe(3);
    expect(s.items.map((i) => i.id)).toEqual<KoRevisionItemId[]>(["statement", "tags", "type"]);
    for (const item of s.items) {
      expect(item.labelKey).toBe(`ko.revision.field.${item.id}`);
    }
  });

  it("robust gegen null/undefined", () => {
    expect(() => koRevisionSummary(null, null)).not.toThrow();
    expect(koRevisionSummary(null, null).hasChanges).toBe(false);
    expect(
      koRevisionSummary(undefined, { statement: "x" } as KoRevisionFields).statementChanged,
    ).toBe(true);
  });
});
