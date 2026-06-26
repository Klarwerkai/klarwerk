import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "./repo";
import { PgModelRunRepo } from "./repo-pg";
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

// SCRUM-164: Fake-Pool, der model_runs nachbildet (INSERT … ON CONFLICT DO NOTHING / SELECT).
function fakePool() {
  const rows = new Map<string, ModelRunRecord>();
  return {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO model_runs")) {
        const [id, data] = params as [string, string];
        if (!rows.has(id)) {
          rows.set(id, JSON.parse(data) as ModelRunRecord);
        }
        return { rows: [] };
      }
      if (sql.startsWith("SELECT data FROM model_runs")) {
        const [limit] = params as [number];
        const sorted = [...rows.values()]
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, limit);
        return { rows: sorted.map((data) => ({ data })) };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
}

describe("SCRUM-164: InMemoryModelRunRepo", () => {
  it("append + recent (jüngste zuerst)", async () => {
    const repo = new InMemoryModelRunRepo();
    await repo.append(record({ id: "a", startedAt: "2026-06-26T10:00:00.000Z" }));
    await repo.append(record({ id: "b", startedAt: "2026-06-26T11:00:00.000Z" }));
    const recent = await repo.recent();
    expect(recent.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("SCRUM-164: PgModelRunRepo (Fake-Pool)", () => {
  it("insert → frische Repo-Instanz über denselben Pool liefert die Records", async () => {
    const pool = fakePool();
    await new PgModelRunRepo(pool).append(
      record({ id: "a", startedAt: "2026-06-26T10:00:00.000Z" }),
    );
    await new PgModelRunRepo(pool).append(
      record({ id: "b", startedAt: "2026-06-26T11:00:00.000Z" }),
    );
    const recent = await new PgModelRunRepo(pool).recent();
    expect(recent.map((r) => r.id)).toEqual(["b", "a"]);
    expect(recent[0]).toMatchObject({ task: "structure", status: "success" });
  });
});
