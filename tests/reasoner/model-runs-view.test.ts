import { describe, expect, it } from "vitest";
import { REASONER_TASKS } from "../../apps/web/src/api/types";
import type { ModelRunRecord, ModelRunTask } from "../../apps/web/src/api/types";
import {
  limitModelRuns,
  modelRunStatusTone,
  summarizeModelRuns,
} from "../../apps/web/src/lib/modelRuns";

function run(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "structure",
    provider: "deterministic",
    demo: true,
    fallback: false,
    locale: "de",
    startedAt: "2026-06-26T10:00:00.000Z",
    finishedAt: "2026-06-26T10:00:00.100Z",
    status: "success",
    ...over,
  };
}

// JOB 3069: die erwartete Zählung wird aus der EINEN Aufgabenliste erzeugt und nur an den
// gemeinten Stellen überschrieben. Vorher stand hier ein Objektliteral mit fünf Schlüsseln — also
// dieselbe zweite Wahrheit, die JOB 3069 im Produktcode abgelöst hat; sie hätte den Test bei jeder
// neuen Aufgabenart erneut rot gemacht, ohne dass am Produkt etwas falsch wäre.
function erwarteteZaehlung(
  treffer: Partial<Record<ModelRunTask, number>>,
): Record<ModelRunTask, number> {
  return {
    ...(Object.fromEntries(REASONER_TASKS.map((task) => [task, 0])) as Record<
      ModelRunTask,
      number
    >),
    ...treffer,
  };
}

describe("SCRUM-165: summarizeModelRuns", () => {
  it("zählt total/success/errors/fallbacks/demo und nach Task", () => {
    const s = summarizeModelRuns([
      run({ id: "a", task: "structure", status: "success", demo: false, fallback: false }),
      run({ id: "b", task: "assist", status: "error", demo: true, fallback: true }),
      run({ id: "c", task: "interview", status: "success", demo: true, fallback: false }),
      run({ id: "d", task: "structure", status: "success", demo: true, fallback: true }),
    ]);
    expect(s.total).toBe(4);
    expect(s.success).toBe(3);
    expect(s.errors).toBe(1);
    expect(s.fallbacks).toBe(2);
    expect(s.demo).toBe(3);
    expect(s.byTask).toEqual(erwarteteZaehlung({ structure: 2, assist: 1, interview: 1 }));
  });

  it("leere Liste → Nullwerte", () => {
    const s = summarizeModelRuns([]);
    expect(s.total).toBe(0);
    expect(s.byTask).toEqual(erwarteteZaehlung({}));
  });
});

describe("SCRUM-165: modelRunStatusTone", () => {
  it("error → crit, success → pos", () => {
    expect(modelRunStatusTone({ status: "error" })).toBe("crit");
    expect(modelRunStatusTone({ status: "success" })).toBe("pos");
  });
});

describe("SCRUM-165: limitModelRuns", () => {
  it("kappt defensiv", () => {
    const recs = [run({ id: "a" }), run({ id: "b" }), run({ id: "c" })];
    expect(limitModelRuns(recs, 2)).toHaveLength(2);
    expect(limitModelRuns(recs, 0)).toHaveLength(0);
    expect(limitModelRuns(recs, -5)).toHaveLength(0);
    expect(limitModelRuns(recs, 99)).toHaveLength(3);
  });
});
