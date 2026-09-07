// ==================================================================================================
// JOB 3194 · M6b R1 — DIE ERKLÄRSEITE OHNE `:has()`: MEHR STATT NICHTS.
// ==================================================================================================
//
// AUSGANGSLAGE. Die ganze Anzeige von `apps/web/public/demonstration/importwege.html` hing an zehn
// Regeln, die alle mit `body:has(` beginnen: Sprache, Quelle und die sechs Schrittflächen. Ohne
// `:has()`-Unterstützung blieb es bei `.step-panel { display: none }` und `.en, .source-jira
// { display: none }` — keine Schrittfläche, kein Englisch, kein Jira-Beispiel. Übrig blieb eine
// Hülle aus Überschrift und Auswahlknöpfen ohne Inhalt.
// Codex' Lehre zu 3138 R2: „Trägt eine statische Seite ihre Funktion allein über CSS (`:has`,
// `:checked`), gehört ein `@supports`-Rückfall dazu, der bei fehlender Unterstützung MEHR zeigt
// statt nichts — plus eine Probe, die den Rückfall misst."
//
// WIE HIER GEMESSEN WIRD, UND WARUM SO. Chromium KANN `:has()` — der Rückfall würde in ihm nie
// greifen. Diese Probe stellt deshalb genau die zwei Dinge nach, die ein Browser OHNE `:has()` mit
// denselben ausgelieferten Bytes täte, und nichts sonst:
//   (1) Jede Stilregel, deren Selektor `:has(` enthält, ist für ihn ungültig und fällt weg.
//   (2) `@supports not selector(:has(*))` ist für ihn WAHR — der Block greift.
// Beides wird an den AUSGELIEFERTEN Bytes vorgenommen (aus `rawPayload` mit dem gemeldeten
// `content-type` dekodiert, Lehre 3138 R2), nicht an einer nachgebauten Seite. Die Umformung selbst
// ist abgesichert: die Probe zählt die entfernten Regeln und besteht auf genau einer
// `@supports`-Bedingung — eine still wirkungslose Umformung fällt auf.
import { resolve } from "node:path";
import Fastify from "fastify";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { registerWebStatic } from "../../services/app/src/web-static";

const origin = "https://klarwerk.test";
const pfad = "/demonstration/importwege.html";
const rueckfallPfad = "/ohne-has.html";
const BEDINGUNG = "@supports not selector(:has(*))";

const app = Fastify();
let browser: Browser;
let context: BrowserContext;
let page: Page;
const anfragen: string[] = [];
const fehler: string[] = [];

/** Die Bytes, wie der Browser sie bekommt — Kopfzeile entscheidet über die Dekodierung. */
let ausgeliefert = "";
/** Dieselben Bytes, gelesen von einem Browser ohne `:has()`. */
let ohneHas = "";
let entfernteRegeln = 0;

/**
 * Trennt das Stylesheet an der obersten Ebene in Vorspann + Block und lässt jeden Block weg, dessen
 * Vorspann `:has(` enthält — genau das tut ein Browser, der den Selektor nicht kennt. Verschachtelte
 * Regeln (in `@media`/`@supports`) bleiben unangetastet; sie tragen kein `:has(`.
 */
function ohneHasRegeln(css: string): { css: string; entfernt: number } {
  let heraus = "";
  let vorspann = "";
  let entfernt = 0;
  let i = 0;
  while (i < css.length) {
    if (css[i] !== "{") {
      vorspann += css[i];
      i += 1;
      continue;
    }
    let tiefe = 1;
    let koerper = "";
    i += 1;
    while (i < css.length && tiefe > 0) {
      const z = css[i] as string;
      if (z === "{") tiefe += 1;
      if (z === "}") {
        tiefe -= 1;
        if (tiefe === 0) {
          i += 1;
          break;
        }
      }
      koerper += z;
      i += 1;
    }
    if (vorspann.includes(":has(")) {
      entfernt += 1;
    } else {
      heraus += `${vorspann}{${koerper}}`;
    }
    vorspann = "";
  }
  return { css: heraus + vorspann, entfernt };
}

beforeAll(async () => {
  await registerSecurityHeaders(app);
  await registerWebStatic(app, resolve("apps/web/public"));
  await app.ready();

  const antwort = await app.inject({ method: "GET", url: pfad });
  expect(antwort.statusCode).toBe(200);
  const typ = String(antwort.headers["content-type"]);
  const zeichensatz = /charset=([\w-]+)/i.exec(typ)?.[1] ?? "utf-8";
  ausgeliefert = new TextDecoder(zeichensatz).decode(antwort.rawPayload);

  // (0) CSS-Kommentare weg. Sie sind keine Regeln, aber sie erklären den Rückfall und nennen dabei
  // `:has()` — ohne diesen Schritt wäre „keine `:has()`-Regel mehr übrig" nicht messbar.
  const ohneKommentare = ausgeliefert.replace(/\/\*[\s\S]*?\*\//g, "");
  // (2) Die Bedingung, die ein Browser ohne `:has()` als WAHR liest, hier als wahre Bedingung.
  const mitWahrerBedingung = ohneKommentare.split(BEDINGUNG).join("@supports (display: block)");
  // (1) Alle Regeln mit `:has(` fallen weg.
  const umgeformt = ohneHasRegeln(mitWahrerBedingung);
  ohneHas = umgeformt.css;
  entfernteRegeln = umgeformt.entfernt;

  browser = await chromium.launch({
    headless: true,
    // Dieselben Sparflaggen wie der gemeinsame Prüfstand (`tests/design/h6-chromium.ts`): im
    // Gesamttor laufen mehrere Browsermessungen gleichzeitig.
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  context = await browser.newContext();
  await context.route("**/*", async (route) => {
    const anfrage = route.request();
    anfragen.push(`${anfrage.method()} ${anfrage.url()}`);
    const url = new URL(anfrage.url());
    if (url.origin !== origin || ![pfad, rueckfallPfad].includes(url.pathname)) {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      body: url.pathname === pfad ? ausgeliefert : ohneHas,
      headers: { "content-type": typ },
    });
  });
  page = await context.newPage();
  page.on("pageerror", (e) => fehler.push(e.message));
}, 60_000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await app.close();
}, 60_000);

const SCHRITTE = {
  de: [
    "Auswählen",
    "Ansehen",
    "Herkunft erhalten",
    "Vergleichen",
    "Fachlich prüfen",
    "Mit Klara nutzen",
  ],
  en: ["Select", "Preview", "Keep provenance", "Compare", "Review", "Use with Klara"],
};

describe("M6b R1 · Rückfall ohne :has()", () => {
  it("die ausgelieferten Bytes tragen genau eine @supports-Bedingung und zehn :has()-Regeln", () => {
    expect(ausgeliefert.split(BEDINGUNG)).toHaveLength(2);
    // Die zehn Schaltregeln aus JOB 3138 (Sprache 2, Quelle 2, Schritte 6) — der `@supports`-
    // Vorspann selbst zählt hier nicht mehr mit, er wurde vorher ersetzt.
    expect(entfernteRegeln).toBe(10);
    expect(ohneHas).not.toContain(":has(");
  });

  it("Chromium KANN :has() — deshalb ist die Nachstellung nötig und nicht bequem", async () => {
    await page.goto(`${origin}${pfad}`);
    expect(await page.evaluate(() => CSS.supports("selector(:has(*))"))).toBe(true);
    // Die echte Seite trägt die Bedingung als echte @supports-Regel (CSSOM, nicht Textsuche).
    const bedingungen = await page.evaluate(() => {
      const blatt = document.styleSheets[0];
      if (!blatt) throw new Error("kein Stylesheet");
      return [...blatt.cssRules]
        .filter((r) => r.constructor.name === "CSSSupportsRule")
        .map((r) => (r as CSSSupportsRule).conditionText);
    });
    expect(bedingungen).toEqual(["not selector(:has(*))"]);
  });

  for (const fenster of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    it(`${fenster.width}×${fenster.height}: alle sechs Schritte, beide Sprachen, beide Quellen — lesbar`, async () => {
      await page.setViewportSize(fenster);
      await page.goto(`${origin}${rueckfallPfad}`);

      for (let schritt = 1; schritt <= 6; schritt++) {
        expect(
          await page.locator(`#step-panel-${schritt}`).isVisible(),
          `Schrittfläche ${schritt} ist im Rückfall sichtbar`,
        ).toBe(true);
        for (const sprache of ["de", "en"] as const) {
          expect(await page.locator(`#step-title-${schritt} .${sprache}`).innerText()).toBe(
            SCHRITTE[sprache][schritt - 1],
          );
        }
      }
      expect(await page.locator(".step-panel:visible").count()).toBe(6);
      // Beide Sprachfassungen UND beide Quellenfassungen stehen gleichzeitig.
      expect(await page.locator(".en:visible").count()).toBeGreaterThan(40);
      expect(await page.locator(".de:visible").count()).toBeGreaterThan(40);
      expect(await page.locator(".source-jira:visible").count()).toBeGreaterThan(0);
      expect(await page.locator(".source-confluence:visible").count()).toBeGreaterThan(0);
      expect(await page.locator("#step-panel-2").innerText()).toContain("DEMO-42");
      expect(await page.locator("#step-panel-2").innerText()).toContain("Checklist.pdf");

      // Der Rückfall erklärt sich selbst — in beiden Sprachen, keine Fehlermeldung.
      const hinweis = page.locator("[data-fallback-notice]");
      expect(await hinweis.isVisible()).toBe(true);
      expect(await hinweis.locator(".de").innerText()).toBe(
        "Dieser Browser kann die Auswahl nicht umschalten. Deshalb stehen alle sechs Schritte, beide Sprachen und beide Beispiele gleichzeitig untereinander.",
      );
      expect(await hinweis.locator(".en").innerText()).toBe(
        "This browser cannot switch the selection. All six steps, both languages and both examples are therefore shown at once, one after another.",
      );
      // Die Kennzeichnung des Ablaufbeispiels bleibt unberührt.
      expect(await page.locator("[data-example-notice]").innerText()).toContain(
        "Fiktive Demonstrationsdaten",
      );

      // Kein abgeschnittener Text, kein waagerechter Überlauf, keine Kleinschrift.
      const geometrie = await page.evaluate(() => {
        const sichtbar = [
          ...document.querySelectorAll<HTMLElement>("label, h1, h2, p, dt, dd, a, legend, code"),
        ].filter(
          (el) => el.getClientRects().length > 0 && getComputedStyle(el).clipPath !== "inset(50%)",
        );
        return {
          ueberlauf: document.documentElement.scrollWidth - innerWidth,
          abgeschnitten: sichtbar
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.left < 0 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1;
            })
            .map((el) => el.textContent),
          kleinschrift: sichtbar
            .filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
            .map((el) => el.textContent),
        };
      });
      expect(geometrie).toEqual({ ueberlauf: 0, abgeschnitten: [], kleinschrift: [] });
      expect(fehler).toEqual([]);
      // Kein Skript, kein Netzaufruf: die Seite hat nichts nachgeladen.
      expect(anfragen.filter((a) => !a.endsWith(rueckfallPfad) && !a.endsWith(pfad))).toEqual([]);
    }, 60_000);
  }
});
