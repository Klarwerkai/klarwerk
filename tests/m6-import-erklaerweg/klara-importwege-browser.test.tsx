// Reales Chromium: CSS-Sichtbarkeit, Geometrie, native Tasten und History; kein jsdom-Layoutbeweis.
// Stilquelle: apps/web/public/demonstration/importwege.html.
// Die Galerie wird aus dem echten Bauteil gerendert. Ihre Callbacks prüft der gemountete DOM-Test.
import { resolve } from "node:path";
import Fastify from "fastify";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { registerWebStatic } from "../../services/app/src/web-static";

const origin = "https://klarwerk.test";
const path = "/demonstration/importwege.html";
const app = Fastify();
let browser: Browser;
let context: BrowserContext;
let page: Page;
const requests: string[] = [];
const errors: string[] = [];

beforeAll(async () => {
  await registerSecurityHeaders(app);
  await registerWebStatic(app, resolve("apps/web/public"));
  await app.ready();
  browser = await chromium.launch({
    // JOB 3194: dieselben Sparflaggen wie der gemeinsame Prüfstand (`tests/design/h6-chromium.ts`).
    // Im Gesamttor laufen mehrere Browsermessungen gleichzeitig; ohne sie startet dieser Browser in
    // der Bahn-Sandkiste gar nicht erst (Mach-Port verweigert).
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  context = await browser.newContext();
  // Alle Requests werden erfasst, unbekannte Ziele abgebrochen; kein Socket/echter API-Dienst.
  await context.route("**/*", async (route) => {
    const request = route.request();
    requests.push(`${request.method()} ${request.url()}`);
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname !== path) {
      await route.abort();
      return;
    }
    const response = await app.inject({ method: "GET", url: url.pathname });
    await route.fulfill({
      status: response.statusCode,
      body: response.rawPayload,
      headers: {
        "content-type": String(response.headers["content-type"]),
        "content-security-policy": String(response.headers["content-security-policy"]),
      },
    });
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
}, 60_000);
afterAll(async () => {
  await context?.close();
  await browser?.close();
  await app.close();
}, 60_000);

async function select(id: string) {
  await page.locator(`label[for="${id}"]`).click();
  expect(await page.locator(`#${id}`).isChecked()).toBe(true);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  describe(`M6 · Chromium ${viewport.width}×${viewport.height}`, () => {
    it("alle sechs Schritte und beide Beispiele in DE/EN lesbar, ohne Mischsprache oder Netzaufruf", async () => {
      await page.setViewportSize(viewport);
      await page.goto(`${origin}${path}`);
      const before = requests.length;
      for (const lang of ["de", "en"]) {
        await select(`language-${lang}`);
        for (const source of ["jira", "confluence"]) {
          await select(`source-${source}`);
          for (let step = 1; step <= 6; step++) {
            await select(`step-${step}`);
            const panel = page.locator(`#step-panel-${step}`);
            expect(await panel.isVisible()).toBe(true);
            expect(await page.locator(".step-panel:visible").count()).toBe(1);
            expect(await page.locator(`.${lang === "en" ? "de" : "en"}:visible`).count()).toBe(0);
            expect(
              await page
                .locator(`.source-${source === "jira" ? "confluence" : "jira"}:visible`)
                .count(),
            ).toBe(0);
            expect(await page.locator("[data-example-notice]").innerText()).toContain(
              lang === "de" ? "Fiktive Demonstrationsdaten" : "Fictional demonstration data",
            );
            // JOB 3194 (M6b): Der Rückfall-Hinweis gehört NUR dem Browser ohne `:has()`. Hier kann
            // der Browser umschalten — die Auskunft „alles steht gleichzeitig" wäre schlicht falsch.
            expect(await page.locator("[data-fallback-notice]").isVisible()).toBe(false);
            const geometry = await page.evaluate(() => {
              const visible = [
                ...document.querySelectorAll<HTMLElement>(
                  "label, h1, h2, p, dt, dd, a, legend, code",
                ),
              ].filter(
                (el) =>
                  el.getClientRects().length > 0 && getComputedStyle(el).clipPath !== "inset(50%)",
              );
              return {
                overflow: document.documentElement.scrollWidth - innerWidth,
                clipped: visible
                  .filter((el) => {
                    const rect = el.getBoundingClientRect();
                    return (
                      rect.left < 0 ||
                      rect.right > innerWidth + 1 ||
                      el.scrollWidth > el.clientWidth + 1
                    );
                  })
                  .map((el) => el.textContent),
                smallText: visible
                  .filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
                  .map((el) => el.textContent),
              };
            });
            expect(geometry).toEqual({ overflow: 0, clipped: [], smallText: [] });
            await panel.scrollIntoViewIfNeeded();
            expect(await panel.locator("h2").innerText()).not.toBe("");
          }
        }
      }
      expect(requests.slice(before)).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

it("native Tastatur: Tab, Pfeile und sichtbarer Fokus; Schritte/Quelle bleiben beim Sprachwechsel erhalten", async () => {
  await page.goto(`${origin}${path}`);
  await page.keyboard.press("Tab");
  expect(await page.locator("a[data-return]").evaluate((el) => el === document.activeElement)).toBe(
    true,
  );
  await page.keyboard.press("Tab");
  expect(await page.locator("#language-de").evaluate((el) => el === document.activeElement)).toBe(
    true,
  );
  await page.keyboard.press("ArrowRight");
  expect(await page.locator("#language-en").isChecked()).toBe(true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  expect(await page.locator("#source-jira").isChecked()).toBe(true);
  await page.keyboard.press("Tab");
  for (let step = 1; step <= 6; step++) {
    expect(await page.locator(`#step-${step}`).isChecked()).toBe(true);
    expect(await page.locator(`#step-panel-${step}`).isVisible()).toBe(true);
    const focus = await page.locator(`label[for="step-${step}"]`).evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(focus.style).toBe("solid");
    expect(focus.width).toBeGreaterThanOrEqual(2);
    if (step < 6) await page.keyboard.press("ArrowRight");
  }
  await select("language-de");
  expect(await page.locator("#step-6").isChecked()).toBe(true);
  expect(await page.locator("#source-jira").isChecked()).toBe(true);
  expect(await page.locator("#step-panel-6 h2").innerText()).toBe("Mit Klara nutzen");
});

// JOB 3194 (M6b) — HIER STAND DER RUNDWEG GEGEN DIE SSR-FIXTURE.
//
// Der Fall „Galerie → Erklärweg → Browser-Zurück sowie expliziter Rückweg treffen den Galerie-Anker"
// (bis 07.09.2026 an dieser Stelle) prüfte den Rückweg gegen `gallery-fixture.tsx` — eine Seite, die
// NUR den Zielabschnitt ausliefert und nichts nachlädt. Dort traf der Anker immer, auch als die echte
// Route ihn verfehlte (gemessen: Anker 982 px unter dem Fenster, Fokus auf `body`). Zwei Wahrheiten
// über denselben Weg bleiben nicht stehen: den Rückweg belegen jetzt AUSSCHLIESSLICH
// `rueckweg-echte-route-chromium.test.ts` und `rundweg-tastatur-chromium.test.ts` an der ECHTEN,
// gebauten Route. Diese Datei misst weiterhin die statische Erklärseite selbst.
