// Mutation: Outcome-Durchgriff im Duplikatweg auf judgeDuplicate verdichten → Gründe fehlen.
import { expect, it } from "vitest";
import { aiCheckFailureReasonKey } from "../../apps/web/src/lib/aiCheckStatusCard";
import { ModelHttpError } from "../../services/reasoner";
import { fixture } from "./fixture";

it("neun Kandidaten, achter Erfolg und neunter 429: Grund bleibt bis zum Abschluss erhalten", async () => {
  const f = await fixture(
    [...Array<undefined>(8).fill(undefined), new ModelHttpError("HTTP 429", 429)],
    false,
    "duplicate",
  );
  const coverage = await f.detect("duplicate");
  expect(coverage.completed).toBe(8);
  expect(coverage.skipped).toBe(1);
  expect(coverage).toHaveProperty("skippedReasons", { "rate-limit": 1 });
  const out = await f.run();
  expect(out.coverage?.completed).toBe(8);
  expect(out.coverage?.skipped).toBe(1);
  expect(out.fallbackReason).toBe("rate-limit");
  expect(aiCheckFailureReasonKey(out.fallbackReason)).toBe("val.aiCheck.reason.rate-limit");
});

it("gültiges neuntes Urteil: kein Ausfall und kein fallbackReason", async () => {
  const f = await fixture(Array<undefined>(9).fill(undefined));
  expect(await f.detect("duplicate")).toHaveProperty("skippedReasons", {});
  const out = await f.run();
  expect(out.coverage?.skipped).toBe(0);
  expect(out.fallbackReason).toBeUndefined();
});
