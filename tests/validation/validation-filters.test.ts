import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  EMPTY_VALIDATION_FILTER,
  type ValidationFilterState,
  categoryOptions,
  matchesValidationFilter,
  tagOptions,
  typeOptions,
} from "../../apps/web/src/lib/validationFilters";

// Minimaler KO-Builder für die reine Filterlogik (nur relevante Felder gesetzt).
function ko(p: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "id",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u0",
    author: "u0",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...p,
  };
}

const f = (p: Partial<ValidationFilterState>): ValidationFilterState => ({
  ...EMPTY_VALIDATION_FILTER,
  ...p,
});

describe("FE-VAL-02: Validierungsfilter", () => {
  it("leerer Filter lässt alles durch", () => {
    expect(matchesValidationFilter(ko({}), EMPTY_VALIDATION_FILTER, null)).toBe(true);
  });

  it("Volltext trifft über Titel, Aussage, Bedingungen, Maßnahmen, Kategorie und Tags", () => {
    const k = ko({
      title: "Pumpe",
      statement: "Druckabfall",
      conditions: ["bei Frost"],
      measures: ["Ventil prüfen"],
      category: "Instandhaltung",
      tags: ["Winter"],
    });
    for (const term of ["pumpe", "druckabfall", "frost", "ventil", "instandhaltung", "winter"]) {
      expect(matchesValidationFilter(k, f({ search: term }), null)).toBe(true);
    }
    expect(matchesValidationFilter(k, f({ search: "Förderband" }), null)).toBe(false);
  });

  it("Typ-, Kategorie- und Tag-Filter wirken einzeln", () => {
    const k = ko({ type: "technik", category: "Qualität", tags: ["A", "B"] });
    expect(matchesValidationFilter(k, f({ type: "technik" }), null)).toBe(true);
    expect(matchesValidationFilter(k, f({ type: "bauchgefuehl" }), null)).toBe(false);
    expect(matchesValidationFilter(k, f({ category: "Qualität" }), null)).toBe(true);
    expect(matchesValidationFilter(k, f({ category: "Einkauf" }), null)).toBe(false);
    expect(matchesValidationFilter(k, f({ tag: "B" }), null)).toBe(true);
    expect(matchesValidationFilter(k, f({ tag: "C" }), null)).toBe(false);
  });

  it("kombinierte Filter wirken als AND", () => {
    const k = ko({ type: "technik", category: "Qualität", tags: ["A"], title: "Sensor" });
    expect(
      matchesValidationFilter(
        k,
        f({ type: "technik", category: "Qualität", search: "sensor" }),
        null,
      ),
    ).toBe(true);
    expect(
      matchesValidationFilter(
        k,
        f({ type: "technik", category: "Einkauf", search: "sensor" }),
        null,
      ),
    ).toBe(false);
  });

  it("„Mir zugewiesen“ nutzt assignments und ist null-User-sicher", () => {
    const mine = ko({ assignments: ["u1", "u2"] });
    const other = ko({ assignments: ["u9"] });
    expect(matchesValidationFilter(mine, f({ mineOnly: true }), "u1")).toBe(true);
    expect(matchesValidationFilter(other, f({ mineOnly: true }), "u1")).toBe(false);
    // Kein Nutzer geladen → bricht nicht, zeigt aber keine „mir“-Treffer.
    expect(matchesValidationFilter(mine, f({ mineOnly: true }), null)).toBe(false);
  });

  it("leitet Optionen stabil sortiert und dedupliziert ab", () => {
    const items = [
      ko({ category: "Qualität", tags: ["Winter", "Pumpe"], type: "technik" }),
      ko({ category: "Allgemein", tags: ["Pumpe"], type: "best_practice" }),
    ];
    expect(categoryOptions(items)).toEqual(["Allgemein", "Qualität"]);
    expect(tagOptions(items)).toEqual(["Pumpe", "Winter"]);
    expect(typeOptions(items)).toEqual(["best_practice", "technik"]);
  });
});
