import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "offen",
    version: 1,
    originalAuthor: "u-1",
    author: "u-1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    history: [],
    ...overrides,
  };
}

// SCRUM-262: Reife/Nutzbarkeit je Treffer ehrlich aus dem KO ableiten.
describe("SCRUM-262: libraryMaturity", () => {
  it("validiertes KO → nutzbar (pos)", () => {
    const m = libraryMaturity(ko({ status: "validiert", trust: 100 }));
    expect(m.usability).toBe("ready");
    expect(m.labelKey).toBe("lib.maturity.usable");
    expect(m.tone).toBe("pos");
  });

  it("zugewiesenes offenes KO → in Prüfung (warn)", () => {
    const m = libraryMaturity(ko({ status: "offen", assignments: ["u-2"] }));
    expect(m.usability).toBe("in-review");
    expect(m.labelKey).toBe("lib.maturity.review");
    expect(m.tone).toBe("warn");
  });

  it("offenes KO → zu prüfen (neutral) und NIE nutzbar", () => {
    const m = libraryMaturity(ko({ status: "offen", assignments: [] }));
    expect(m.usability).toBe("needs-work");
    expect(m.labelKey).toBe("lib.maturity.open");
    expect(m.labelKey).not.toBe("lib.maturity.usable");
  });
});
