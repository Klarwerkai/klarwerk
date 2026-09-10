import { defineConfig, mergeConfig } from "vitest/config";
import basis from "../../vitest.config";

// Private Cloud-Schnappschüsse enthalten kein dist. Nur dieser gezielte Browserlauf baut vorab;
// im vollständigen Tor übernimmt tools/build das bereits vor allen Tests.
export default mergeConfig(
  basis,
  defineConfig({
    test: {
      globalSetup: ["tests/bibliothek-scope-sprache/browser-vorbau.ts"],
      fileParallelism: false,
    },
  }),
);
