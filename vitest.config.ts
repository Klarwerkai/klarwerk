import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "services/**/*.test.ts"],
    // Integrationstests (Postgres/Testcontainers) laufen getrennt über `test:integration`,
    // damit der schnelle Gate-Lauf kein Docker braucht.
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "docs/generated/coverage",
      thresholds: { lines: 80, functions: 80 },
    },
    testTimeout: 60_000,
  },
});
