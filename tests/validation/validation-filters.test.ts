import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  EMPTY_VALIDATION_FILTER,
  type ValidationFilterState,
  applyMineOnlyParam,
  categoryOptions,
  matchesValidationFilter,
  mineQueueEmptyHint,
  readMineOnlyFilter,
  tagOptions,
  typeOptions,
  validationMineHref,
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

  it("WP-SUBMIT-ASYNC: Filter „in KI-Prüfung“ zeigt NUR pending — done/failed/Altbestand fallen heraus", () => {
    const pending = ko({ aiCheck: { status: "pending", requestedAt: "2026-07-21T06:00:00.000Z" } });
    const done = ko({
      aiCheck: {
        status: "done",
        requestedAt: "2026-07-21T06:00:00.000Z",
        finishedAt: "2026-07-21T06:01:00.000Z",
      },
    });
    const failed = ko({
      aiCheck: {
        status: "failed",
        requestedAt: "2026-07-21T06:00:00.000Z",
        fallbackReason: "no-model",
      },
    });
    const legacy = ko({});
    expect(matchesValidationFilter(pending, f({ aiPending: true }), null)).toBe(true);
    expect(matchesValidationFilter(done, f({ aiPending: true }), null)).toBe(false);
    expect(matchesValidationFilter(failed, f({ aiPending: true }), null)).toBe(false);
    expect(matchesValidationFilter(legacy, f({ aiPending: true }), null)).toBe(false);
    // Inaktiver Toggle ändert nichts (Default im leeren Filter = aus).
    expect(EMPTY_VALIDATION_FILTER.aiPending).toBe(false);
    expect(matchesValidationFilter(legacy, f({}), null)).toBe(true);
  });

  it("SCRUM-364: ?mine=1 aktiviert die persönliche Linse, sonst aus", () => {
    expect(readMineOnlyFilter(new URLSearchParams("mine=1"))).toBe(true);
    expect(readMineOnlyFilter(new URLSearchParams(""))).toBe(false);
    expect(readMineOnlyFilter(new URLSearchParams("mine=0"))).toBe(false);
    expect(readMineOnlyFilter(new URLSearchParams("mine=true"))).toBe(false);
  });

  it("SCRUM-364: applyMineOnlyParam setzt/entfernt mine und erhält übrige Query", () => {
    const on = applyMineOnlyParam(new URLSearchParams("origin=non-demo&review=new"), true);
    expect(on.get("mine")).toBe("1");
    expect(on.get("origin")).toBe("non-demo");
    expect(on.get("review")).toBe("new");

    const off = applyMineOnlyParam(new URLSearchParams("mine=1&origin=demo"), false);
    expect(off.has("mine")).toBe(false);
    expect(off.get("origin")).toBe("demo");
  });

  it("SCRUM-364: validationMineHref ist der fokussierte Deep-Link", () => {
    expect(validationMineHref()).toBe("/validierung?mine=1");
    // Round-trip: der Link aktiviert die Linse wieder.
    const url = new URL(`https://x.test${validationMineHref()}`);
    expect(readMineOnlyFilter(url.searchParams)).toBe(true);
  });

  it("SCRUM-364: mineQueueEmptyHint nur bei aktiver Linse ohne Treffer", () => {
    expect(mineQueueEmptyHint({ mineOnly: true, visibleCount: 0 })).toMatchObject({
      titleKey: "val.mineEmpty.title",
      hintKey: "val.mineEmpty.hint",
      ctaKey: "val.mineEmpty.cta",
    });
    // Linse aktiv, aber es gibt persönliche Arbeit → kein Empty-Hint.
    expect(mineQueueEmptyHint({ mineOnly: true, visibleCount: 2 })).toBeNull();
    // Linse aus → nie (normaler Board-Empty-State greift).
    expect(mineQueueEmptyHint({ mineOnly: false, visibleCount: 0 })).toBeNull();
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
