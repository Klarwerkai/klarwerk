import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { expect, it } from "vitest";
import { createServer } from "../../apps/web/node_modules/vite";

// Echte Chromium-Bedienung, synthetische API/Speech-Daten. Keine Mikrofon-/Tabletprobe.
it("R-1648 · gesperrter Einstieg, Sprach-Leseablauf, Quellen, Tastatur und schmale Ansicht", async () => {
  const out = resolve(process.env.KIOSK_BELEGE ?? ".local/kiosk-browser");
  await mkdir(out, { recursive: true });
  const server = await createServer({
    root: resolve("apps/web"),
    configFile: resolve("apps/web/vite.config.ts"),
    server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false },
    logLevel: "error",
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const begin = new Date().toISOString();
  let browserEnde = false;
  let erfolgreich = false;
  let port = 0;
  try {
    await server.listen();
    const adresse = server.httpServer?.address();
    if (!adresse || typeof adresse === "string") throw new Error("Eigener Listener fehlt");
    port = adresse.port;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const fehler: string[] = [];
    page.on("pageerror", (e) => fehler.push(e.message));
    await page.route("**/*", (route) =>
      route.request().url().startsWith(`http://127.0.0.1:${port}/`)
        ? route.continue()
        : route.abort(),
    );
    let frei = false;
    let fragen = 0;
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/kiosk/profil")
        return route.fulfill({
          status: frei ? 200 : 403,
          json: frei
            ? { profilId: "fiktiv", revision: 1, zugang: "sitzung" }
            : { error: "KIOSK_GESPERRT" },
        });
      if (url.pathname === "/api/kiosk/fragen") {
        fragen += 1;
        return route.fulfill({
          json: {
            result: {
              answered: true,
              answer: "Fiktive Testpumpe KX42 vor dem Öffnen entlasten.",
              evidence: { grade: "unverified", sourcesConflicted: false, conflictsUnproven: false },
            },
            kiosk: { quellen: [{ koId: "fiktive-testquelle", fassung: 3 }] },
          },
        });
      }
      return route.fulfill({ status: 401, json: { error: "UNAUTHENTICATED" } });
    });
    await page.addInitScript({
      content: `
      window.__kioskProbe = { recorder: null, output: null };
      window.SpeechRecognition = class {
        start() { window.__kioskProbe.recorder = this; }
        stop() { this.onend?.(); }
      };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices() { return []; }, cancel() {}, speak(u) { window.__kioskProbe.output = u; }
      }});
    `,
    });
    await page.goto(`http://127.0.0.1:${port}/kiosk`);
    await page.getByText(/zulässiges Zugangsprofil fehlt/).waitFor();
    expect(await page.locator("main button, main input, main textarea, main nav").count()).toBe(0);
    await page.screenshot({ path: resolve(out, "gesperrt.png"), fullPage: true });
    frei = true;
    await page.reload();
    const start = page.getByRole("button", { name: "Sprachbedienung starten", exact: true });
    await start.waitFor();
    await start.focus();
    await page.keyboard.press("Enter");
    await page.evaluate(
      `window.__kioskProbe.recorder.onresult({resultIndex:0, results:[[{transcript:'Testpumpe KX42'}]]})`,
    );
    await page
      .getByText("Fiktive Testpumpe KX42 vor dem Öffnen entlasten.", { exact: false })
      .waitFor();
    expect(fragen).toBe(1);
    expect(await page.evaluate("window.__kioskProbe.output.text")).toContain(
      "vollständige Prüfung",
    );
    const details = page.locator("summary");
    await details.focus();
    await page.keyboard.press("Enter");
    await page.getByText("fiktive-testquelle · Fassung 3").waitFor();
    expect(await page.locator("details").getAttribute("open")).not.toBeNull();
    await page.screenshot({ path: resolve(out, "breit.png"), fullPage: true });
    await page.setViewportSize({ width: 320, height: 780 });
    expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
      true,
    );
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.screenshot({ path: resolve(out, "schmal-dark-system.png"), fullPage: true });
    await page.getByRole("button", { name: "Sprachbedienung stoppen", exact: true }).click();
    await page.getByText("Bereit für Ihre Frage", { exact: true }).waitFor();
    expect(fehler).toEqual([]);
    await page.close();
    erfolgreich = true;
  } finally {
    if (browser) {
      await browser.close();
      browserEnde = true;
    }
    await server.close();
    await writeFile(
      resolve(out, "ENDE.json"),
      JSON.stringify(
        {
          begin,
          ende: new Date().toISOString(),
          port,
          erfolgreich,
          browserEnde,
          serverEnde: !server.httpServer?.listening,
          echteChromiumBedienung: true,
          apiUndSpeech: "synthetische Adapter",
          echteAudioTabletProbe: false,
        },
        null,
        2,
      ),
    );
  }
}, 60_000);
