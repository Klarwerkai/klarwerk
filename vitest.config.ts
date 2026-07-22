import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // WP-D8b: .test.tsx erlaubt GEMOUNTETE React-Komponenten-Tests (jsdom). Diese Dateien laufen über
    // die esbuild-Transformation von Vitest; der Root-tsc (tools/build, ohne jsx/DOM-lib) schließt sie
    // via tsconfig-exclude aus — die Web-Komponenten selbst typprüft weiterhin der App-Build.
    include: ["tests/**/*.test.{ts,tsx}", "services/**/*.test.ts"],
    // WP-VIP2-GATE (bens P1): Test-Env explizit setzen (Selbstregistrierung ist in Produktion
    // fail-closed AUS; die Suite ist ein Dev-Setup und schaltet sie bewusst frei).
    setupFiles: ["tests/setup-env.ts"],
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
