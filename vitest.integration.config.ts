import { defineConfig } from "vitest/config";
import { streckeBenannt } from "./tests/neuinstallation/kundeninstallation/pflicht";
import { PgLaufMelder } from "./tests/pg-laufbeleg/melder";

/**
 * R-1327: ein übersprungener Fall meldet sich laut — je Datei über den Testläufer, am Ende als
 * Bilanz über den Reporter (Begründung in `tests/pg-laufbeleg/melder.ts`). Exportiert, weil
 * `tests/pg-laufbeleg/probe/` dieselbe Verdrahtung in einem echten Vitest-Lauf nachmisst.
 */
export const UEBERSPRUNGEN_RUNNER = "./tests/pg-laufbeleg/laut-runner.ts";
export const integrationsReporter = () => ["default" as const, new PgLaufMelder()];

// Die Kundeninstallations-Strecke ist Pflicht, sobald sie ausdruecklich benannt aufgerufen wird
// (Begruendung in tests/neuinstallation/kundeninstallation/pflicht.ts). Nur der Hauptprozess kennt
// die Kommandozeile; die Testarbeiter erben diese Umgebung.
if (streckeBenannt(process.argv.slice(2))) {
  process.env.KLARWERK_KUNDENINSTALLATION ??= "pflicht";
}

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
    // R-1327: der Läufer meldet je Datei — auch eine ganz statisch übersprungene und auch dann,
    // wenn ein Aufrufer `--reporter` selbst setzt (s. tests/pg-laufbeleg/laut-runner.ts).
    runner: UEBERSPRUNGEN_RUNNER,
    reporters: integrationsReporter(),
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
