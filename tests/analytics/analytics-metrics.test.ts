import { describe, expect, it } from "vitest";
import type { AuditEntry, KnowledgeObject } from "../../apps/web/src/api/types";
import {
  assignmentRows,
  auditActions,
  auditActors,
  averageTrust,
  categoryDistribution,
  filterAudit,
  formatRate,
  validationRate,
  weeklyAnswerRate,
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

  // R-0723/R-0750: die Antwortquote im Wochenverlauf.
  it("weeklyAnswerRate rechnet die Quote je Woche, chronologisch, ohne leere Wochen", () => {
    const out = weeklyAnswerRate(
      {
        "2026-06-15": { asked: 4, answeredWithoutGap: 3 },
        "2026-06-01": { asked: 2, answeredWithoutGap: 0 },
        "2026-06-08": { asked: 0, answeredWithoutGap: 0 },
      },
      8,
    );
    expect(out).toEqual([
      { week: "2026-06-01", asked: 2, answered: 0, rate: 0 },
      { week: "2026-06-15", asked: 4, answered: 3, rate: 0.75 },
    ]);
  });

  it("weeklyAnswerRate: fehlende Wochenreihe (älterer Server) ergibt einen leeren Verlauf", () => {
    expect(weeklyAnswerRate(undefined)).toEqual([]);
  });

  it("weeklyAnswerRate begrenzt auf die jüngsten Wochen", () => {
    const out = weeklyAnswerRate(
      {
        "2026-06-01": { asked: 1, answeredWithoutGap: 1 },
        "2026-06-08": { asked: 1, answeredWithoutGap: 1 },
        "2026-06-15": { asked: 2, answeredWithoutGap: 1 },
      },
      2,
    );
    expect(out.map((w) => w.week)).toEqual(["2026-06-08", "2026-06-15"]);
  });
});

describe("FR-ANA-01: Kategorie-Verteilung", () => {
  it("categoryDistribution: größte zuerst, Gleichstand nach Name, leere Kategorien fallen weg", () => {
    expect(categoryDistribution({ Technik: 2, Betrieb: 5, Anlage: 2, Leer: 0 })).toEqual([
      { category: "Betrieb", count: 5 },
      { category: "Anlage", count: 2 },
      { category: "Technik", count: 2 },
    ]);
    expect(categoryDistribution({})).toEqual([]);
  });
});

describe("FR-VAL-06 / FR-ANA-01: Prüfaufgaben je Person", () => {
  it("assignmentRows: meiste offene zuerst, dann mehr Erledigtes, dann Kennung; 0/0 fällt weg", () => {
    const rows = assignmentRows([
      { userId: "u-c", open: 1, done: 0 },
      { userId: "u-a", open: 3, done: 2 },
      { userId: "u-leer", open: 0, done: 0 },
      { userId: "u-b", open: 1, done: 4 },
      { userId: "u-d", open: 1, done: 0 },
    ]);
    expect(rows.map((r) => r.userId)).toEqual(["u-a", "u-b", "u-c", "u-d"]);
    // Die Summen über die Zeilen bleiben die der Gesamtkacheln — nichts geht verloren.
    expect(workloadSummary(rows)).toEqual({ openTotal: 6, doneTotal: 6, experts: 4 });
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
