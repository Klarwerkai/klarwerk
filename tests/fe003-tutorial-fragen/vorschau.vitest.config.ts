// ================================================================================================
// FE-003 · E8 — DER PRÜFPLAN DES KANDIDATEN: ein gebauter, gestarteter Server für beide Dateien.
// ================================================================================================
//
// Aufruf (Prüfserver; nimmt nur Befehle an, die mit `npx vitest run` beginnen):
//
//   npx vitest run --config tests/fe003-tutorial-fragen/vorschau.vitest.config.ts
//
// `vorschau-global.ts` baut den Kandidaten mit `tools/build`, startet ihn ohne Modell auf einem
// freien Port und reicht die Adresse an `vorschau-weg.integration.test.ts` und
// `browser-breiten.integration.test.ts`; am Ende wird er beendet. Belege (JSON + technische
// Prüfbilder, KEIN Tutorial-Inhalt) liegen unter `.local/run/fe003-belege/<commit>/`.
//
// Eigene Konfiguration in den Zielpfaden dieses Auftrags: `vitest.config.ts`,
// `vitest.integration.config.ts`, `tools/test` und `tools/check` bleiben unberührt. Beide Dateien
// laufen zusätzlich unter `npm run test:integration` mit (dann startet jede ihren eigenen Server).
// Der Name enthält bewusst nicht `vitest.integration.config` — dieser Lauf braucht keine Datenbank.
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const WURZEL = resolve(import.meta.dirname, "../..");

export default defineConfig({
  root: WURZEL,
  test: {
    include: [
      "tests/fe003-tutorial-fragen/vorschau-weg.integration.test.ts",
      "tests/fe003-tutorial-fragen/browser-breiten.integration.test.ts",
    ],
    globalSetup: ["tests/fe003-tutorial-fragen/vorschau-global.ts"],
    // Ein Browser, ein Server: nacheinander, nicht parallel.
    fileParallelism: false,
    testTimeout: 180_000,
    // `tools/build` läuft im globalSetup; die Frist deckt Bau und Start.
    hookTimeout: 900_000,
    env: { KLARWERK_SKIP_KEYCHAIN: "1" },
  },
});
