// JOB 3464: gebaute Anwendung, echtes Backend und Chromium nach dem UX-12b-Hausmuster.
// Der letzte Knopf wird vor dem Klick an den unteren Viewportrand gescrollt. So kann
// Playwrights eigener Bildlauf die fehlende Blickführung des Produkts nicht verdecken.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type BrowserFn,
  type Seite,
  type Stand,
  beende,
  fn,
  starte,
  wechsle,
} from "../design/h6-chromium";

import baueFrisch from "./bau";

const KARTE = '[data-testid="pruefen-karte"]';
const ZEILE = '[data-testid="pruefen-warteschlange-eintrag"]';
let stand: Stand;

// Wie im UX-12b-Hausmuster: die bereits gestartete Seite um ihre Bedienmethoden typisieren.
// Ein direkter Playwright-Typimport zählt im Torgraphen als zusätzliche Startstelle;
// tatsächlich startet hier ausschließlich h6-chromium den Browser.
interface Elementgriff {
  count(): Promise<number>;
  last(): Elementgriff;
  evaluate<T>(ausdruck: BrowserFn): Promise<T>;
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  isVisible(): Promise<boolean>;
  click(): Promise<void>;
  waitFor(optionen: { state: "hidden" }): Promise<void>;
}
interface BedienbareSeite extends Seite {
  locator(selektor: string): Elementgriff;
  getByTestId(kennung: string): Elementgriff;
  mouse: { click(x: number, y: number): Promise<void> };
  keyboard: { press(taste: string): Promise<void> };
}

function seite(): BedienbareSeite {
  expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
  return stand.seite as BedienbareSeite;
}
async function oeffnen(): Promise<BedienbareSeite> {
  await wechsle(stand, "/validierung", KARTE);
  const page = seite();
  expect(await page.evaluate(fn("() => window.innerWidth"))).toBe(390);
  await page.waitForFunction(fn("(sel) => document.querySelectorAll(sel).length === 30"), ZEILE);
  expect(await page.locator(ZEILE).count()).toBe(30);
  const hinweis = page.getByTestId("notice-ack");
  if (await hinweis.isVisible()) {
    await hinweis.click();
    await hinweis.waitFor({ state: "hidden" });
  }
  return page;
}
async function sichtbar(page: BedienbareSeite): Promise<void> {
  const box = await page.locator(KARTE).boundingBox();
  expect(box).not.toBeNull();
  console.log(`JOB 3464 · Karte nach Auswahl: ${JSON.stringify(box)} · Viewport 390 × 740`);
  expect(box?.y, "Prüfkarte beginnt oberhalb des Viewports").toBeGreaterThanOrEqual(0);
  expect(box?.y, "Prüfkarte bleibt unterhalb des Viewports").toBeLessThan(740);
}

describe("JOB 3464 · Prüfen bei 390 px in Chromium", () => {
  beforeAll(async () => {
    await baueFrisch();
    stand = await starte("/validierung", KARTE, 390, 740, async (app) => {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3065.test", password: "geheim12345" },
      });
      expect(login.statusCode).toBe(200);
      const headers = { authorization: `Bearer ${login.json<{ token: string }>().token}` };
      for (let i = 0; i < 30; i++) {
        const antwort = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: {
            title: `Prüfeintrag ${String(i).padStart(2, "0")} — Wartung der Druckanlage: Absperrventile kontrollieren und den sicheren Zustand vor Beginn der Arbeiten gemeinsam prüfen`,
            statement: `Prüfanweisung ${i}: Vor der Wartung den Druck am Manometer ablesen.`,
            type: "best_practice",
            category: "Wartung",
            confidentiality: "intern",
            conditions: [],
            measures: [],
            tags: [],
          },
        });
        expect(antwort.statusCode, antwort.body).toBe(201);
      }
    });
  }, 240_000);
  afterAll(async () => {
    await beende(stand);
  }, 60_000);

  it("letzte Zeile antippen bringt die ausgewählte Prüfkarte in den Viewport", async () => {
    const page = await oeffnen();
    expect((await page.locator(KARTE).boundingBox())?.y).toBeGreaterThan(740);
    const letzte = page.locator(ZEILE).last();
    await letzte.evaluate(fn('(el) => el.scrollIntoView({ block: "end", behavior: "instant" })'));
    const vorher = await page.locator(KARTE).boundingBox();
    expect(
      vorher?.y,
      "Vorbedingung: Karte liegt auch vor dem Klick außerhalb",
    ).toBeGreaterThanOrEqual(740);
    const titel = await letzte.textContent();
    const zeile = await letzte.boundingBox();
    expect(zeile).not.toBeNull();
    const punkt = { x: (zeile?.x ?? 0) + 12, y: (zeile?.y ?? 0) + 12 };
    expect(
      await page.evaluate(
        fn(`([sel, punkt]) => {
      const letzte = [...document.querySelectorAll(sel)].at(-1);
      return letzte.contains(document.elementFromPoint(punkt.x, punkt.y));
    }`),
        [ZEILE, punkt],
      ),
      "der Klickpunkt trifft frei die letzte Zeile",
    ).toBe(true);
    // mouse.click führt selbst keinen vorbereitenden Bildlauf aus (anders als locator.click).
    await page.mouse.click(punkt.x, punkt.y);
    expect(await page.locator(`${KARTE} [data-text="titel"]`).textContent()).toBe(titel);
    await sichtbar(page);
    expect(stand.seitenfehler).toEqual([]);
  }, 90_000);

  it("Tab und Enter führen den Fokus in den Prüfbereich, nächstes Tab in die Karte", async () => {
    const page = await oeffnen();
    // Echte Tabfolge ab dem neuen Dokument, ohne programmgesteuerten Fokus auf der Zeile.
    let inListe = false;
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      inListe =
        (await page.evaluate(
          fn("(sel) => document.activeElement?.matches(sel) === true"),
          ZEILE,
        )) === true;
      if (inListe) break;
    }
    expect(inListe, "Tab erreicht die Warteschlange").toBe(true);
    await page.keyboard.press("Tab");
    const titel = await page.evaluate(fn("() => document.activeElement?.textContent"));
    expect(await page.evaluate(fn("(sel) => document.activeElement?.matches(sel)"), ZEILE)).toBe(
      true,
    );
    await page.keyboard.press("Enter");
    expect(await page.locator(`${KARTE} [data-text="titel"]`).textContent()).toBe(titel);
    await sichtbar(page);
    expect(
      await page.evaluate(
        fn(`(sel) => {
        const karte = document.querySelector(sel);
        return document.activeElement === karte || document.activeElement === karte?.parentElement;
      }`),
        KARTE,
      ),
      "Fokus endet am Prüfbereich",
    ).toBe(true);
    expect(await page.locator(KARTE).getAttribute("role")).toBeNull();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        fn("(sel) => document.querySelector(sel)?.contains(document.activeElement)"),
        KARTE,
      ),
      "nächste Tab-Station liegt innerhalb der Prüfkarte",
    ).toBe(true);
    expect(stand.seitenfehler).toEqual([]);
  }, 90_000);
});
