// Explizite historische Diagnose; der normale Integrationsweg bleibt unverändert.
import { defineConfig } from "vitest/config";
import basis from "../../vitest.integration.config";

export default defineConfig({
  ...basis,
  test: {
    ...basis.test,
    include: ["tests/audit-gesamt/vorher-nachher.historisch.ts"],
    allowOnly: false,
    passWithNoTests: false,
    fileParallelism: false,
    pool: "forks",
    minWorkers: 1,
    maxWorkers: 1,
    poolOptions: { forks: { minForks: 1, maxForks: 1 } },
    testTimeout: 60_000,
  },
});
