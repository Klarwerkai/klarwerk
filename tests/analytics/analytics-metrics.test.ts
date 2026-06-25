import { describe, expect, it } from "vitest";
import type { AuditEntry, KnowledgeObject } from "../../apps/web/src/api/types";
import {
  auditActions,
  auditActors,
  averageTrust,
  filterAudit,
  formatRate,
  validationRate,
  weeklyValidated,
  workloadSummary,
} from "../../apps/web/src/lib/analyticsMetrics";

const ko = (confidence: number): KnowledgeObject => ({ confidence }) as KnowledgeObject;
const entry = (p: Partial<AuditEntry>): AuditEntry =>
  ({ actor: "a", action: "x", target: "t", ...p }) as AuditEntry;

describe("SCRUM-139: Trust- & Arbeitslast-Kennzahlen", () => {
  it("averageTrust mittelt confidence, leere Liste → 0", () => {
    expect(averageTrust([ko(80), ko(60)])).toBe(70);
    expect(averageTrust([])).toBe(0);
  });

  it("validationRate als Prozent, null-sicher", () => {
    expect(validationRate(4, 1)).toBe(25);
    expect(validationRate(0, 0)).toBe(0);
  });

  it("workloadSummary summiert offen/erledigt und zählt aktive Experten", () => {
    const w = workloadSummary([
      { userId: "u1", open: 3, done: 2 },
      { userId: "u2", open: 0, done: 5 },
      { userId: "u3", open: 1, done: 0 },
    ]);
    expect(w).toEqual({ openTotal: 4, doneTotal: 7, experts: 2 });
  });
});

describe("SCRUM-140: Impact-Aufbereitung", () => {
  it("formatRate → Prozent", () => {
    expect(formatRate(0.75)).toBe("75%");
    expect(formatRate(0)).toBe("0%");
  });

  it("weeklyValidated sortiert chronologisch und begrenzt", () => {
    const out = weeklyValidated({ "2026-06-15": 2, "2026-06-01": 1, "2026-06-08": 3 }, 2);
    expect(out).toEqual([
      { week: "2026-06-08", count: 3 },
      { week: "2026-06-15", count: 2 },
    ]);
  });
});

describe("SCRUM-143: Audit-Filter über echte Daten", () => {
  const entries = [
    entry({ actor: "anna", action: "ko.create", target: "ko-1" }),
    entry({ actor: "bob", action: "auth.login", target: "user-9" }),
    entry({ actor: "anna", action: "ko.validate", target: "ko-2" }),
  ];

  it("distinkte Actor-/Action-Listen", () => {
    expect(auditActors(entries)).toEqual(["anna", "bob"]);
    expect(auditActions(entries)).toEqual(["auth.login", "ko.create", "ko.validate"]);
  });

  it("leerer Filter → unveränderte Liste", () => {
    expect(filterAudit(entries, {})).toHaveLength(3);
  });

  it("filtert nach Actor, Action und Target (contains, AND)", () => {
    expect(filterAudit(entries, { actor: "anna" })).toHaveLength(2);
    expect(filterAudit(entries, { action: "auth.login" })).toHaveLength(1);
    expect(filterAudit(entries, { target: "ko-" })).toHaveLength(2);
    expect(filterAudit(entries, { actor: "anna", action: "ko.validate" })).toHaveLength(1);
  });
});
