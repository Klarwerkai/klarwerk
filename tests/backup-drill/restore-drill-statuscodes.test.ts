import { describe, expect, it } from "vitest";
import { run } from "./drill-probe";

describe("Restore-Drill: Statuscodes beim Wiederanlauf", () => {
  it.each([
    ["restore-error", 21],
    ["login-error", 60],
    ["forbidden", 61],
    ["linkage", 70],
    ["unresolved", 71],
    ["unchecked", 72],
  ] as const)(
    "bestehendes Gate %s behält Exit %i",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
    },
    120_000,
  );
});
