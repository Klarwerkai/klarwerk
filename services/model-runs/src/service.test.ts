import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "./repo";
import {
  DEFAULT_MODEL_RUN_LIMIT,
  MAX_MODEL_RUN_LIMIT,
  ModelRunService,
  normalizeModelRunLimit,
} from "./service";
import type { ModelRunRecord } from "./types";

function record(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
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

describe("SCRUM-165: normalizeModelRunLimit (defensiv)", () => {
  it("Default bei undefined/ungültig/negativ", () => {
    expect(normalizeModelRunLimit()).toBe(DEFAULT_MODEL_RUN_LIMIT);
    expect(normalizeModelRunLimit(0)).toBe(DEFAULT_MODEL_RUN_LIMIT);
    expect(normalizeModelRunLimit(-5)).toBe(DEFAULT_MODEL_RUN_LIMIT);
    expect(normalizeModelRunLimit(Number.NaN)).toBe(DEFAULT_MODEL_RUN_LIMIT);
  });

  it("kappt auf Maximum und floored", () => {
    expect(normalizeModelRunLimit(10)).toBe(10);
    expect(normalizeModelRunLimit(12.9)).toBe(12);
    expect(normalizeModelRunLimit(1000)).toBe(MAX_MODEL_RUN_LIMIT);
  });
});

describe("SCRUM-165: ModelRunService.recent", () => {
  async function seeded(n: number): Promise<ModelRunService> {
    const repo = new InMemoryModelRunRepo();
    for (let i = 0; i < n; i += 1) {
      await repo.append(
        record({ id: `r${i}`, startedAt: `2026-06-26T10:00:${String(i).padStart(2, "0")}.000Z` }),
      );
    }
    return new ModelRunService({ repo });
  }

  it("liefert read-only die jüngsten Records (Default-Limit)", async () => {
    const svc = await seeded(3);
    const recent = await svc.recent();
    expect(recent).toHaveLength(3);
    // jüngste zuerst
    expect(recent[0]?.id).toBe("r2");
  });

  it("respektiert ein gültiges Limit", async () => {
    const svc = await seeded(5);
    expect(await svc.recent(2)).toHaveLength(2);
  });

  it("kappt überzogene Limits auf das Maximum", async () => {
    const repo = new InMemoryModelRunRepo();
    for (let i = 0; i < MAX_MODEL_RUN_LIMIT + 10; i += 1) {
      await repo.append(record({ id: `r${i}`, startedAt: `2026-06-26T10:00:00.${i}Z` }));
    }
    const svc = new ModelRunService({ repo });
    expect(await svc.recent(10_000)).toHaveLength(MAX_MODEL_RUN_LIMIT);
  });

  it("liefert nur Metadaten — keine Prompt-/Antwortfelder", async () => {
    const svc = await seeded(1);
    const [rec] = await svc.recent();
    expect(rec && "prompt" in rec).toBe(false);
    expect(rec && "answer" in rec).toBe(false);
    expect(rec && "text" in rec).toBe(false);
    expect(rec && "input" in rec).toBe(false);
    expect(Object.keys(rec ?? {}).sort()).toEqual(
      [
        "demo",
        "fallback",
        "finishedAt",
        "id",
        "locale",
        "provider",
        "startedAt",
        "status",
        "task",
      ].sort(),
    );
  });
});
