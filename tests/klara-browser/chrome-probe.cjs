// Installation probe only, not live acceptance. No login or draft creation.
// Run explicitly: node tests/klara-browser/chrome-probe.cjs
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const dir = mkdtempSync(resolve("tests/klara-browser/chrome-probe-"));
  process.env.TMPDIR = dir;
  process.env.TMP = dir;
  process.env.TEMP = dir;
  const extension = resolve("extensions/klara-browser");
  let context;
  try {
    context = await chromium.launchPersistentContext(join(dir, "profile"), {
      channel: "chromium",
      headless: true,
      timeout: 15000,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 10000 }));
    const manifest = JSON.parse(readFileSync(join(extension, "manifest.json"), "utf8"));
    const installed = await worker.evaluate(() => chrome.runtime.getManifest());
    assert.equal(installed.version, manifest.version);
    assert.equal(installed.background.service_worker, "worker.js");
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("panel.html", worker.url()).href);
    await page
      .locator("#status")
      .filter({ hasText: /Keine Auswahl|No selection/ })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(`CHROME-PROBE: Paket ${installed.version} geladen; Vorschau ohne Auswahl bereit.`);
  } catch (error) {
    console.log(`CHROME-PROBE: ${String(error.message).split("\n")[0]}`);
    const signal = String(error.message).match(/signal=\w+/)?.[0];
    if (signal) console.log(signal);
    process.exitCode = 1;
  } finally {
    try {
      if (context) await context.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
})();
