// Der gemeinsame Browserlauf braucht seinen Bau vor dem Start der Testdateien.
import { loadConfigFromFile } from "vite";
import { defineConfig, mergeConfig } from "vitest/config";

export default defineConfig(async (umgebung) => {
  const basis = await loadConfigFromFile(umgebung, "vitest.config.ts");
  if (!basis) throw new Error("Vitest-Basiskonfiguration fehlt");
  return mergeConfig(basis.config, {
    test: { globalSetup: ["tests/review26-pruefen-schmal/bau.ts"] },
  });
});
