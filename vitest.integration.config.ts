import { defineConfig } from "vitest/config";

// Eigener Lauf für Integrationstests gegen echte Infrastruktur (Postgres via Testcontainers).
// Braucht einen laufenden Docker-Daemon. Aufruf: `npm run test:integration`.
export default defineConfig({
  test: {
    include: ["services/**/*.integration.test.ts", "tests/**/*.integration.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
