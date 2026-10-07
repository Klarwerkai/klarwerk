// R-1327: der Prüfstand für `tests/pg-laufbeleg/melder.test.ts`. Er fährt die Probedateien dieses
// Verzeichnisses mit GENAU der Melder-Verdrahtung des Integrationslaufs — Setup-Datei und Reporter
// kommen aus `vitest.integration.config.ts`, nicht aus einer Abschrift.
//
// Der Dateiname enthält bewusst nicht `vitest.integration.config`: dieser Lauf braucht keine
// Datenbank, und der Prüfplatz soll ihn nicht dafür halten.
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { UEBERSPRUNGEN_LAUT, integrationsReporter } from "../../../vitest.integration.config";

const WURZEL = resolve(import.meta.dirname, "../../..");

export default defineConfig({
  root: WURZEL,
  cacheDir: ".local/run/vite-cache",
  test: {
    include: ["tests/pg-laufbeleg/probe/*.probe.ts"],
    setupFiles: [UEBERSPRUNGEN_LAUT],
    reporters: integrationsReporter(),
  },
});
