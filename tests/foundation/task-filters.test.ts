import { describe, expect, it } from "vitest";
import {
  type TaskLike,
  countTasksByFilter,
  filterTasks,
  matchesTaskFilter,
} from "../../apps/web/src/lib/taskFilters";

const tasks: TaskLike[] = [
  { typeKey: "task.validation" },
  { typeKey: "task.validation" },
  { typeKey: "task.returned" },
  { typeKey: "task.conflict" },
  { typeKey: "task.gap" },
  { typeKey: "task.revalidation" },
];

describe("SCRUM-158: taskFilters", () => {
  it("matchesTaskFilter: all zeigt alles, sonst nur passenden Typ", () => {
    expect(matchesTaskFilter({ typeKey: "task.gap" }, "all")).toBe(true);
    expect(matchesTaskFilter({ typeKey: "task.gap" }, "gap")).toBe(true);
    expect(matchesTaskFilter({ typeKey: "task.gap" }, "conflict")).toBe(false);
  });

  it("filterTasks reduziert auf den gewählten Typ", () => {
    expect(filterTasks(tasks, "all")).toHaveLength(6);
    expect(filterTasks(tasks, "validation")).toHaveLength(2);
    expect(filterTasks(tasks, "returned")).toHaveLength(1);
    expect(filterTasks(tasks, "conflict")).toHaveLength(1);
    expect(filterTasks(tasks, "gap")).toHaveLength(1);
    expect(filterTasks(tasks, "revalidation")).toHaveLength(1);
  });

  it("countTasksByFilter: ehrliche Zähler je Filter (all = Gesamtzahl)", () => {
    const c = countTasksByFilter(tasks);
    expect(c.all).toBe(6);
    expect(c.validation).toBe(2);
    expect(c.returned).toBe(1);
    expect(c.conflict).toBe(1);
    expect(c.gap).toBe(1);
    expect(c.revalidation).toBe(1);
    // Summe der Typ-Filter = Gesamt (keine Aufgabe verschwindet unerklärt).
    expect(c.validation + c.returned + c.conflict + c.gap + c.revalidation).toBe(c.all);
  });
});
