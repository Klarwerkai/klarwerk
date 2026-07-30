import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // WP-D8b: .test.tsx erlaubt GEMOUNTETE React-Komponenten-Tests (jsdom). Diese Dateien laufen über
    // die esbuild-Transformation von Vitest; der Root-tsc (tools/build, ohne jsx/DOM-lib) schließt sie
    // via tsconfig-exclude aus — die Web-Komponenten selbst typprüft der App-Build.
    //
    // ============================================================================================
    // AUFTRAG-mega59 BLOCK G — DAS ZWEITE LOCH AM GLEICHEN ORT.
    // ============================================================================================
    //
    // 19 Testdateien wohnen in `apps/web/src` und liefen im Tor GAR NICHT, weil diese Liste nur
    // `tests/**` und `services/**` einschloss. Der Satz darüber („die Web-Komponenten typprüft der
    // App-Build") begründete das — und war seit `tools/build` FALSCH: dort lief `vite build`, und
    // `vite build` typprüft nicht. Beides ist in dieser Runde geschlossen:
    //   · `tools/build` fährt jetzt `apps/web && npx tsc --noEmit` VOR dem Bündeln. Damit ist der
    //     Typprüfpfad für diese Dateien wirklich da — `apps/web/tsconfig.json` bringt jsx und
    //     DOM-lib mit und deckt `src` samt der 19 Dateien (kein zweiter tsconfig nötig).
    //   · Sie laufen ab jetzt im Tor mit: 19 Dateien, 100 Fälle, alle grün — nachgemessen, nicht
    //     angenommen. Vorher lag in einer davon ein echter Typfehler (s. captionAiSuggest.test.ts),
    //     den niemand sehen konnte.
    include: [
      "tests/**/*.test.{ts,tsx}",
      "services/**/*.test.ts",
      "apps/web/src/**/*.test.{ts,tsx}",
    ],
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
