import { defineConfig } from "vitest/config";

// Eigener Lauf für Integrationstests gegen echte Infrastruktur (Postgres via Testcontainers).
// Braucht einen laufenden Docker-Daemon. Aufruf: `npm run test:integration`.
export default defineConfig({
  test: {
    include: ["services/**/*.integration.test.ts", "tests/**/*.integration.test.ts"],
    // WP-SHIP8-HOTFIX-ITEST: DASSELBE Dev-/Test-Setup wie die Unit-Suite (setup-env.ts schaltet
    // NUR die Selbstregistrierung frei — build-app.integration.test.ts legt seine Nutzer über
    // POST /api/auth/register an; ohne das Flag antwortet das WP-VIP2-GATE fail-closed 403).
    // Der Produktions-Default bleibt AUS; die Datei berührt keine Infrastruktur/Container.
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
