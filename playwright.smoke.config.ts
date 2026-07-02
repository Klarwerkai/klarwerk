// SCRUM-381 (Entscheidung 02.07.2026, Pedi: „wir arbeiten von 1 nach 4"): MINIMALER UI-Smoke.
// Zweck: genau die Fehlerklasse fangen, die Logik-Tests nicht sehen (weiße Seite, kaputtes
// Bundle, tote Kernflüsse). Bewusst klein: 1 Browser (Chromium), 1 Spec, ~1 Minute.
// NICHT Teil von tools/check (kein Browser-Zwang für jeden Lauf) — Aufruf: npm run smoke:ui
// (erwartet gebautes apps/web/dist; Erstlauf einmalig: npx playwright install chromium).
import { defineConfig } from "@playwright/test";

const PORT = 3123;

export default defineConfig({
  testDir: "./tests-smoke",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    // In-Memory-Backend (keine DATABASE_URL, kein Dev-Persist) → jeder Lauf startet jungfräulich
    // mit Ersteinrichtung; deterministischer Reasoner (kein API-Key nötig, ehrliche Entwürfe).
    command: "npm start",
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT) },
  },
});
