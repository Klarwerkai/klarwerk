import { describe, expect, it } from "vitest";
import type { Conflict, Gap, KnowledgeObject } from "../../apps/web/src/api/types";
import {
  type WorkOverviewItem,
  buildWorkOverview,
  groupTasks,
  learningOpenSteps,
  primaryWorkItem,
  severityForType,
  workSignalsFrom,
} from "../../apps/web/src/lib/workCenter";

const gap = (o: Partial<Gap>): Gap => ({
  id: "g",
  question: "?",
  status: "offen",
  assignee: null,
  priority: "mittel",
  createdAt: "2026-06-26T10:00:00.000Z",
  ...o,
});

const conflict = (o: Partial<Conflict>): Conflict => ({
  id: "c",
  koA: "a",
  koB: "b",
  type: "truth",
  description: "x",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-06-26T10:00:00.000Z",
  ...o,
});

const ko = (id: string): KnowledgeObject =>
  ({ id, title: id, status: "offen" }) as unknown as KnowledgeObject;

describe("SCRUM-247: workCenter — Start-Übersicht", () => {
  it("zeigt nur Kategorien mit echtem Signal (count>0), getrennt und geordnet", () => {
    const items = buildWorkOverview({
      validationOpen: 2,
      conflictsOpen: 1,
      revalidationPending: 0,
      criticalGaps: 3,
      learningOpenSteps: 0,
    });
    // Reihenfolge: kritisch (conflicts, criticalGaps) → heute (validation); revalidation/learning=0 raus.
    expect(items.map((i) => i.key)).toEqual(["conflicts", "criticalGaps", "validation"]);
    expect(items.map((i) => i.severity)).toEqual(["critical", "critical", "today"]);
    expect(items.find((i) => i.key === "conflicts")?.to).toBe("/konflikte");
  });

  it("leere Signale → leere Übersicht (ehrlicher Leerzustand)", () => {
    expect(
      buildWorkOverview({
        validationOpen: 0,
        conflictsOpen: 0,
        revalidationPending: 0,
        criticalGaps: 0,
        learningOpenSteps: 0,
      }),
    ).toEqual([]);
  });

  it("workSignalsFrom leitet die Signale aus echten Rohdaten ab", () => {
    const s = workSignalsFrom({
      board: [ko("k1"), ko("k2")],
      conflicts: [conflict({ status: "offen" }), conflict({ status: "geloest" })],
      revalidation: ["r1"],
      gaps: [
        gap({ status: "offen", priority: "hoch" }),
        gap({ status: "offen", priority: "mittel" }),
        gap({ status: "geschlossen", priority: "hoch" }),
      ],
      learningOpenSteps: 2,
    });
    expect(s).toEqual({
      validationOpen: 2,
      conflictsOpen: 1, // geloest zählt nicht
      revalidationPending: 1,
      criticalGaps: 1, // nur offen+hoch
      learningOpenSteps: 2,
    });
  });

  it("learningOpenSteps = Schritte − erledigte, nie negativ", () => {
    expect(learningOpenSteps({ steps: [1, 2, 3, 4] }, ["a", "b"])).toBe(2);
    expect(learningOpenSteps({ steps: [1, 2] }, ["a", "b", "c"])).toBe(0);
    expect(learningOpenSteps(null, [])).toBe(0);
    expect(learningOpenSteps(undefined, undefined)).toBe(0);
  });
});

describe("SCRUM-247: workCenter — MyTasks-Gruppierung", () => {
  it("severityForType ordnet Quellen nachvollziehbar zu", () => {
    expect(severityForType("task.returned")).toBe("critical");
    expect(severityForType("task.conflict")).toBe("critical");
    expect(severityForType("task.validation")).toBe("today");
    expect(severityForType("task.revalidation")).toBe("today");
    expect(severityForType("task.gap")).toBe("later");
    expect(severityForType("task.unbekannt")).toBe("later"); // sicherer Default
  });

  it("groupTasks partitioniert stabil nach Severity, Reihenfolge je Gruppe bleibt", () => {
    const tasks = [
      { id: "1", severity: "today" as const },
      { id: "2", severity: "critical" as const },
      { id: "3", severity: "later" as const },
      { id: "4", severity: "critical" as const },
      { id: "5", severity: "today" as const },
    ];
    const g = groupTasks(tasks);
    expect(g.critical.map((t) => t.id)).toEqual(["2", "4"]);
    expect(g.today.map((t) => t.id)).toEqual(["1", "5"]);
    expect(g.later.map((t) => t.id)).toEqual(["3"]);
  });

  it("leere Eingabe → drei leere Gruppen (ehrlicher Leerzustand)", () => {
    const g = groupTasks<{ id: string; severity: "critical" | "today" | "later" }>([]);
    expect(g).toEqual({ critical: [], today: [], later: [] });
  });
});

describe("SCRUM-271: primaryWorkItem", () => {
  const item = (key: string, severity: WorkOverviewItem["severity"]): WorkOverviewItem => ({
    key,
    to: `/${key}`,
    severity,
    count: 1,
  });

  it("leere Übersicht → null (Leerzustand bleibt)", () => {
    expect(primaryWorkItem([])).toBeNull();
  });

  it("wählt kritisch vor heute vor später", () => {
    const picked = primaryWorkItem([
      item("validation", "today"),
      item("learning", "later"),
      item("conflicts", "critical"),
    ]);
    expect(picked?.key).toBe("conflicts");
  });

  it("innerhalb derselben Dringlichkeit bleibt die bestehende Reihenfolge (stabil)", () => {
    const picked = primaryWorkItem([
      item("criticalGaps", "critical"),
      item("conflicts", "critical"),
    ]);
    expect(picked?.key).toBe("criticalGaps");
  });

  it("nutzt das vorhandene Ziel des Items", () => {
    const picked = primaryWorkItem([item("revalidation", "today")]);
    expect(picked?.to).toBe("/revalidation");
  });
});
