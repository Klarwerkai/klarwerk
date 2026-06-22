import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "services/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "docs/generated/coverage",
      thresholds: { lines: 80, functions: 80 },
    },
    testTimeout: 60_000,
  },
});
