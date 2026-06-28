import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  MATURITY_FILTERS,
  countByMaturity,
  filterByMaturity,
  libraryMaturity,
  libraryUseCta,
  maturityFilterLabelKey,
} from "../../apps/web/src/lib/libraryMaturity";

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
  // SCRUM-293: Labels kommen jetzt aus der geteilten Use-Readiness-Sprache (use.*), identisch zu KO-Detail.
  it("validiertes KO → nutzbar (pos)", () => {
    const m = libraryMaturity(ko({ status: "validiert", trust: 100 }));
    expect(m.usability).toBe("ready");
    expect(m.labelKey).toBe("use.ready.label");
    expect(m.tone).toBe("pos");
  });

  it("zugewiesenes offenes KO → in Prüfung (warn)", () => {
    const m = libraryMaturity(ko({ status: "offen", assignments: ["u-2"] }));
    expect(m.usability).toBe("in-review");
    expect(m.labelKey).toBe("use.review.label");
    expect(m.tone).toBe("warn");
  });

  it("offenes KO → zu prüfen (neutral) und NIE nutzbar", () => {
    const m = libraryMaturity(ko({ status: "offen", assignments: [] }));
    expect(m.usability).toBe("needs-work");
    expect(m.labelKey).toBe("use.open.label");
    expect(m.labelKey).not.toBe("use.ready.label");
  });
});

// SCRUM-267: Reife-Filter über die gerankte Trefferliste.
describe("SCRUM-267: filterByMaturity / countByMaturity", () => {
  const scored = [
    { ko: ko({ id: "a", status: "validiert", trust: 100 }) }, // ready
    { ko: ko({ id: "b", status: "validiert", trust: 80 }) }, // ready
    { ko: ko({ id: "c", status: "offen", assignments: ["u-2"] }) }, // in-review
    { ko: ko({ id: "d", status: "offen", assignments: [] }) }, // needs-work
  ];

  it("bietet Alle plus die drei Reifearten", () => {
    expect(MATURITY_FILTERS).toEqual(["all", "ready", "in-review", "needs-work"]);
  });

  it("'all' lässt die Liste unverändert", () => {
    expect(filterByMaturity(scored, "all")).toHaveLength(4);
  });

  it("'ready' (nutzbar) zeigt nur validierte, nie offene/ungeprüfte KOs", () => {
    const ready = filterByMaturity(scored, "ready");
    expect(ready.map((s) => s.ko.id)).toEqual(["a", "b"]);
    expect(ready.every((s) => s.ko.status === "validiert")).toBe(true);
  });

  it("'in-review' und 'needs-work' sind unterscheidbar", () => {
    expect(filterByMaturity(scored, "in-review").map((s) => s.ko.id)).toEqual(["c"]);
    expect(filterByMaturity(scored, "needs-work").map((s) => s.ko.id)).toEqual(["d"]);
  });

  it("countByMaturity zählt ehrlich je Reife; all = Gesamtzahl", () => {
    expect(countByMaturity(scored)).toEqual({
      all: 4,
      ready: 2,
      "in-review": 1,
      "needs-work": 1,
    });
  });

  it("maturityFilterLabelKey: all eigener Key, sonst geteiltes Use-Readiness-Label", () => {
    expect(maturityFilterLabelKey("all")).toBe("lib.maturity.all");
    expect(maturityFilterLabelKey("ready")).toBe("use.ready.label");
    expect(maturityFilterLabelKey("in-review")).toBe("use.review.label");
    expect(maturityFilterLabelKey("needs-work")).toBe("use.open.label");
  });
});

// SCRUM-288: Bibliothek trennt Nutzung (Ask) von Review: nur validierte KOs direkt fragen.
describe("SCRUM-288: libraryUseCta", () => {
  it("validiertes/nutzbares KO führt in Ask mit KO-Titel als Startfrage", () => {
    const cta = libraryUseCta(
      ko({ title: "Ventil X bei Überdruck schließen", status: "validiert" }),
    );
    expect(cta.kind).toBe("ask");
    expect(cta.labelKey).toBe("lib.ask");
    expect(cta.href).toContain("/fragen?q=");
    expect(decodeURIComponent(cta.href)).toContain("Ventil X");
  });

  it("offenes KO führt nicht in Ask, sondern zur Validierung", () => {
    const cta = libraryUseCta(ko({ status: "offen", assignments: [] }));
    expect(cta).toEqual({ labelKey: "lib.review", href: "/validierung", kind: "review" });
  });

  it("KO in Prüfung führt ebenfalls zur Validierung statt Ask", () => {
    const cta = libraryUseCta(ko({ status: "offen", assignments: ["controller"] }));
    expect(cta).toEqual({ labelKey: "lib.review", href: "/validierung", kind: "review" });
  });
});
