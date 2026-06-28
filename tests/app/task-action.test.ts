import { describe, expect, it } from "vitest";
import { taskAction } from "../../apps/web/src/lib/taskAction";

// SCRUM-260: Jede Aufgabe zeigt zusätzlich zu Typ und Titel eine klare nächste Handlung.
describe("SCRUM-260: taskAction", () => {
  it("bildet jeden bekannten Aufgaben-Typ auf eine handlungsnahe nächste Handlung ab", () => {
    expect(taskAction("task.returned")).toEqual({
      actionLabelKey: "task.action.returned",
      tone: "crit",
    });
    expect(taskAction("task.conflict")).toEqual({
      actionLabelKey: "task.action.conflict",
      tone: "crit",
    });
    expect(taskAction("task.validation")).toEqual({
      actionLabelKey: "task.action.validation",
      tone: "warn",
    });
    expect(taskAction("task.revalidation")).toEqual({
      actionLabelKey: "task.action.revalidation",
      tone: "warn",
    });
    expect(taskAction("task.gap")).toEqual({
      actionLabelKey: "task.action.gap",
      tone: "neutral",
    });
  });

  it("fällt für unbekannte Typen sicher auf neutrales Öffnen zurück", () => {
    expect(taskAction("task.unknown")).toEqual({
      actionLabelKey: "task.action.open",
      tone: "neutral",
    });
  });
});
