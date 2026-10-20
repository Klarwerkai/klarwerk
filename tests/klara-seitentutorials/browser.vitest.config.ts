import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/klara-seitentutorials/browser.integration.test.ts"],
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    hookTimeout: 900_000,
    testTimeout: 180_000,
    env: { KLARWERK_SKIP_KEYCHAIN: "1" },
  },
});
