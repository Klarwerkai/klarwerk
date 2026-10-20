import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Request, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ensureLoggedIn } from "../../tests-smoke/support/auth";
import {
  type Kandidat,
  aktuellerCommit,
  erwarteterStand,
  kandidatBereitstellen,
  pruefeKandidat,
} from "../fe003-tutorial-fragen/kandidat";

let kandidat: Kandidat;
let browser: Browser;
const belege = join(process.cwd(), ".local/run/klara-i-browser", aktuellerCommit());
const ergebnisse: unknown[] = [];
beforeAll(async () => {
  mkdirSync(belege, { recursive: true });
  kandidat = await kandidatBereitstellen(undefined);
  const bindung = await pruefeKandidat(kandidat.url, erwarteterStand());
  writeFileSync(join(belege, "kandidat.json"), JSON.stringify(bindung, null, 2));
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  if (browser) await browser.close();
  const beendet = kandidat ? await kandidat.beenden() : true;
  writeFileSync(
    join(belege, "ergebnisse.json"),
    JSON.stringify(
      { commit: aktuellerCommit(), ergebnisse, browserUndServerBeendet: beendet },
      null,
      2,
    ),
  );
  expect(beendet).toBe(true);
});

it("bedient Lesen, Arbeiten, Verwaltung und erhaltenes Fragen-Tutorial mit echter Tastatur und ohne Tutorialmutation", async () => {
  // Ein isolierter Browserkontext, normales Wegwerfkonto ausschließlich am eigenen lokalen Server.
  const kontext = await browser.newContext({
    baseURL: kandidat.url,
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await kontext.newPage();
  await ensureLoggedIn(page);
  for (const breite of [1280, 390]) {
    await page.setViewportSize({ width: breite, height: 900 });
    for (const route of ["/bibliothek", "/erfassen", "/admin?bereich=konten", "/fragen"]) {
      await page.goto(route);
      const knopf = page.getByTestId("tutorial-knopf");
      await knopf.waitFor({ state: "visible" });
      await page.waitForTimeout(250);
      if (route === "/erfassen") {
        await page.getByTestId("blatt-titel").fill("Fiktiver ungespeicherter Tutorialentwurf");
        await page.waitForTimeout(1000);
      }
      const anfragen: Request[] = [];
      const sammeln = (r: Request) => anfragen.push(r);
      page.on("request", sammeln);
      await knopf.focus();
      await page.keyboard.press("Enter");
      await page.getByTestId("tutorial-bereich").waitFor({ state: "visible" });
      await page.getByTestId("tutorial-demo").waitFor({ state: "visible" });
      const weiter = page.getByTestId("tutorial-weiter");
      await weiter.focus();
      await page.keyboard.press("Enter");
      expect(await page.getByTestId("tutorial-fortschritt").textContent()).toContain("2");
      if (route !== "/fragen") {
        expect(
          await page.locator("[data-tutorial-ziel-fehlt]").count(),
          `${route}: echtes Kernziel fehlt`,
        ).toBe(0);
        await page.getByTestId("seitentutorial-zeigen").click();
        const echtesZiel = page.locator('[data-tutorial-aktiv="true"]').first();
        expect(await echtesZiel.count()).toBe(1);
        const zielBox = await echtesZiel.boundingBox();
        expect(zielBox).not.toBeNull();
        expect(zielBox?.y).toBeGreaterThanOrEqual(0);
        expect((zielBox?.y ?? 0) + (zielBox?.height ?? 0)).toBeLessThanOrEqual(901);
      }
      await page.getByTestId("tutorial-zurueck").click();
      const masse = await page.evaluate<{
        scroll: number;
        client: number;
        fenster: number;
        dokument: number;
      }>(
        `(() => { const el = document.querySelector('[data-testid="tutorial-bereich"]'); return { scroll: el.scrollWidth, client: el.clientWidth, fenster: innerWidth, dokument: document.documentElement.scrollWidth }; })()`,
      );
      expect(masse.scroll).toBeLessThanOrEqual(masse.client + 1);
      expect(masse.dokument).toBeLessThanOrEqual(masse.fenster + 1);
      await page.screenshot({
        path: join(belege, `${breite}-${route.split("?")[0]?.slice(1)}-offen.png`),
        fullPage: false,
      });
      await page.getByTestId("tutorial-schliessen").focus();
      await page.keyboard.press("Escape");
      expect(await page.getByTestId("tutorial-bereich").count()).toBe(0);
      expect(await knopf.evaluate("el => el === document.activeElement")).toBe(true);
      if (route === "/erfassen")
        expect(await page.getByTestId("blatt-titel").inputValue()).toBe(
          "Fiktiver ungespeicherter Tutorialentwurf",
        );
      const mutation = anfragen
        .filter(
          (r) =>
            new URL(r.url()).pathname.startsWith("/api/") &&
            !["GET", "HEAD", "OPTIONS"].includes(r.method()),
        )
        .map((r) => `${r.method()} ${new URL(r.url()).pathname}`);
      expect(mutation).toEqual([]);
      page.off("request", sammeln);
      ergebnisse.push({ route, breite, masse, mutation, tastatur: true });
      await page.screenshot({
        path: join(belege, `${breite}-${route.split("?")[0]?.slice(1)}.png`),
        fullPage: false,
      });
    }
  }
  // Echter fehlender Artikel: kein erfundenes Kernziel und kein Erfolg.
  await page.goto("/wissen/fiktiv-nicht-vorhanden");
  await page.getByTestId("tutorial-knopf").click();
  await page.locator("[data-tutorial-ziel-fehlt]").waitFor({ state: "visible" });
  expect(await page.locator("[data-tutorial-ziel-fehlt]").textContent()).toContain(
    "nicht bedienbar",
  );
  ergebnisse.push({ fehlenderArtikel: true, keinErfolgBehauptet: true });
  await kontext.close();
});
