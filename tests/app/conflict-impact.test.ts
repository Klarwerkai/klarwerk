import { describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { conflictAwareSourceRefs, sourceRefs } from "../../apps/web/src/lib/askView";
import {
  conflictImpact,
  conflictLimitedUsability,
  conflictNotice,
  effectiveUsability,
  unresolvedConflictsForKo,
} from "../../apps/web/src/lib/conflictImpact";
import { koOverview } from "../../apps/web/src/lib/koOverview";

// SCRUM-357 / AG-14 / VC-P1-1 / FR-VAL-01: Konflikt-Wirkung auf Nutzbarkeit/Trust-Ehrlichkeit.
// Zentrale, DOM-freie Ableitung — KO-Detail/Library/Ask sagen für denselben Zustand dasselbe.

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Hydraulik HZ7 entlüften",
    statement: "…",
    type: "best_practice",
    status: "validiert",
    trust: 100,
    version: 1,
    confidence: 0.9,
    category: "Anlage 2",
    tags: [],
    sources: [],
    attachments: [],
    author: "u1",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  } as KnowledgeObject;
}

function conflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    id: "c-1",
    koA: "ko-1",
    koB: "ko-2",
    type: "truth",
    description: "Widerspruch zur Druckablass-Reihenfolge",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("SCRUM-357: conflictImpact — Wirkung aus der Konfliktliste", () => {
  it("kein Konflikt → keine Wirkung", () => {
    const impact = conflictImpact("ko-1", []);
    expect(impact).toEqual({
      affected: false,
      unresolvedCount: 0,
      hasTruth: false,
      severity: "none",
      limited: false,
    });
  });

  it("offener Truth-Konflikt am KO → limited + truth (stärkstes Signal)", () => {
    const impact = conflictImpact("ko-1", [conflict()]);
    expect(impact.affected).toBe(true);
    expect(impact.limited).toBe(true);
    expect(impact.hasTruth).toBe(true);
    expect(impact.severity).toBe("truth");
  });

  it("eskaliert/zweitmeinung gelten weiter als ungelöst; gelöst wirkt NICHT", () => {
    expect(conflictImpact("ko-1", [conflict({ status: "eskaliert" })]).limited).toBe(true);
    expect(conflictImpact("ko-1", [conflict({ status: "zweitmeinung" })]).limited).toBe(true);
    expect(conflictImpact("ko-1", [conflict({ status: "geloest" })]).limited).toBe(false);
  });

  it("Nicht-Wahrheitskonflikt → limited, aber nicht truth", () => {
    const impact = conflictImpact("ko-1", [conflict({ type: "experience" })]);
    expect(impact.limited).toBe(true);
    expect(impact.hasTruth).toBe(false);
    expect(impact.severity).toBe("limited");
  });

  it("zählt nur Konflikte, die das KO referenzieren (koA ODER koB)", () => {
    const matchA = conflict({ id: "a", koA: "ko-1", koB: "ko-9" });
    const matchB = conflict({ id: "b", koA: "ko-9", koB: "ko-1" });
    const other = conflict({ id: "c", koA: "ko-8", koB: "ko-9" });
    expect(unresolvedConflictsForKo("ko-1", [matchA, matchB, other]).map((c) => c.id)).toEqual([
      "a",
      "b",
    ]);
    expect(conflictImpact("ko-1", [matchA, matchB, other]).unresolvedCount).toBe(2);
  });
});

describe("SCRUM-357: conflictLimitedUsability — ehrliche Begrenzung ohne Fake-Wahrheit", () => {
  it("ready → in-review bei wirksamem Konflikt; sonst unverändert", () => {
    const limited = conflictImpact("ko-1", [conflict()]);
    const none = conflictImpact("ko-1", []);
    expect(conflictLimitedUsability("ready", limited)).toBe("in-review");
    expect(conflictLimitedUsability("ready", none)).toBe("ready");
    // bereits offene/in-Prüfung-KOs sind ohnehin nicht ready und bleiben.
    expect(conflictLimitedUsability("needs-work", limited)).toBe("needs-work");
    expect(conflictLimitedUsability("in-review", limited)).toBe("in-review");
  });

  it("effectiveUsability: validiertes KO wirkt mit offenem Konflikt NICHT mehr ready", () => {
    const validated = ko();
    expect(koOverview(validated).usability).toBe("ready"); // Rohzustand
    expect(effectiveUsability(validated, [conflict()])).toBe("in-review"); // konfliktbegrenzt
    // gelöster Konflikt blockiert nicht weiter → wieder ready.
    expect(effectiveUsability(validated, [conflict({ status: "geloest" })])).toBe("ready");
  });
});

describe("SCRUM-357: conflictNotice — Banner-/Chip-Hinweis", () => {
  it("null ohne Wirkung; Truth-Konflikt erhält die deutlichere Copy + Konfliktlink", () => {
    expect(conflictNotice(conflictImpact("ko-1", []))).toBeNull();
    const truth = conflictNotice(conflictImpact("ko-1", [conflict()]));
    expect(truth?.severity).toBe("truth");
    expect(truth?.titleKey).toBe("conflict.impact.truthTitle");
    expect(truth?.to).toBe("/konflikte");
    const nonTruth = conflictNotice(conflictImpact("ko-1", [conflict({ type: "context" })]));
    expect(nonTruth?.severity).toBe("limited");
    expect(nonTruth?.titleKey).toBe("conflict.impact.title");
  });
});

describe("SCRUM-357: conflictAwareSourceRefs — Ask zeigt konfliktbetroffene Quelle nicht als ready", () => {
  it("downgradet die effektive Nutzbarkeit + markiert conflictLimited/Truth, Roh-sourceRefs unverändert", () => {
    const validated = ko();
    const conflicts = [conflict()];
    // Roh: Ask hätte das KO als ready/validiert gezeigt.
    expect(sourceRefs(["ko-1"], [validated])[0]?.usability).toBe("ready");
    // Konfliktbewusst: nicht mehr ready, klar als konfliktbegrenzt markiert.
    const ref = conflictAwareSourceRefs(["ko-1"], [validated], conflicts)[0];
    expect(ref?.usability).toBe("in-review");
    expect(ref?.conflictLimited).toBe(true);
    expect(ref?.conflictTruth).toBe(true);
    expect(ref?.validated).toBe(true); // Roh-Status bleibt ehrlich (validiert), Nutzbarkeit begrenzt
  });

  it("unbekannte Quelle bleibt unkonflikt-markiert (kein Fake-Zustand)", () => {
    const ref = conflictAwareSourceRefs(["unknown"], [], [conflict({ koA: "unknown" })])[0];
    expect(ref?.known).toBe(false);
    expect(ref?.usability).toBeNull();
    expect(ref?.conflictLimited).toBe(false);
  });
});
