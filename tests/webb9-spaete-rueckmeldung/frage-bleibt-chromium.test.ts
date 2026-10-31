import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright-core";
import { afterEach, describe, expect, it } from "vitest";
import { type Browser, type Kontext, fn, starteChromium } from "../gast-nutzerweg/browserweg";
import { PASSWORT } from "../gast-nutzerweg/strecke";
import {
  ANTWORT,
  EMAIL,
  type FragenWelt,
  RECEIPT,
  RUECKMELDUNG,
  TITEL,
  WEG,
  fragenWelt,
} from "./pruefstand";

let browser: Browser | undefined;
let kontext: Kontext | undefined;
let welt: FragenWelt | undefined;
const belege = resolve(".local/run/webb9-spaete-rueckmeldung1073");
const diagnoseBelege = resolve(".local/run/webb9-spaete-rueckmeldung1073-diagnose1");

afterEach(async () => {
  welt?.freigeben();
  try {
    await welt?.antwortenAbgeschlossen();
  } finally {
    try {
      await kontext?.close();
    } finally {
      try {
        await browser?.close();
      } finally {
        await welt?.schliessen();
      }
    }
  }
  welt = undefined;
  kontext = undefined;
  browser = undefined;
  console.log(JSON.stringify({ event: "webb9-fixture-closed", workerPid: process.pid }));
});

function imBrowser<Ergebnis>(quelle: string): (arg: unknown) => Ergebnis {
  return fn(quelle) as (arg: unknown) => Ergebnis;
}

async function oeffnen(fallId: string) {
  mkdirSync(belege, { recursive: true });
  mkdirSync(diagnoseBelege, { recursive: true });
  welt = await fragenWelt();
  browser = await starteChromium();
  kontext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "de-DE",
    serviceWorkers: "block",
  });
  await kontext.addInitScript('localStorage.setItem("kw.sprache", "de");');
  const seite = (await kontext.newPage()) as unknown as Page;
  seite.setDefaultTimeout(15_000);
  seite.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await seite.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== new URL(welt?.basis ?? "").origin) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await welt.steuern(seite);
  await seite.goto(welt.basis, { waitUntil: "domcontentloaded" });
  await seite.locator("#auth-email").fill(EMAIL);
  await seite.locator("#auth-password").fill(PASSWORT);
  const login = seite.waitForResponse((r) => new URL(r.url()).pathname === "/api/auth/login");
  await seite.locator("#auth-password").press("Enter");
  expect((await login).status()).toBe(200);
  await seite.locator("#auth-email").waitFor({ state: "hidden" });
  expect((await kontext.cookies()).some((c) => c.name === "kw_session" && c.value)).toBe(true);
  await seite.evaluate(
    imBrowser<void>("(d) => localStorage.setItem(d.key, JSON.stringify(d.stand))"),
    {
      key: welt.key,
      stand: welt.stand,
    },
  );
  const direktNachSeed = await seite.evaluate(
    imBrowser<string | null>("(key) => localStorage.getItem(key)"),
    welt.key,
  );
  await seite.goto(`${welt.basis}/fragen`, { waitUntil: "domcontentloaded" });
  const feld = seite.locator('[data-testid="page-fragen"] form input');
  await feld.waitFor();
  try {
    await seite.getByText(ANTWORT, { exact: false }).first().waitFor();
  } catch (error) {
    try {
      const zustand = await seite.evaluate(
        imBrowser<{
          url: string;
          sichtbarerText: string;
          frage: string | null;
          eigenerArbeitsstand: string | null;
        }>(
          "(key) => ({ url: location.origin + location.pathname, sichtbarerText: document.body?.innerText ?? '', frage: document.querySelector('[data-testid=page-fragen] form input')?.value ?? null, eigenerArbeitsstand: localStorage.getItem(key) })",
        ),
        welt.key,
      );
      writeFileSync(
        resolve(diagnoseBelege, `${fallId}-oeffnen-fehler.json`),
        JSON.stringify(
          {
            fall: fallId,
            kontoId: welt.kontoId,
            koId: welt.koId,
            eigenerKey: welt.key,
            direktNachSeed,
            zustand,
          },
          null,
          2,
        ),
      );
      await seite.screenshot({
        path: resolve(diagnoseBelege, `${fallId}-oeffnen-fehler.png`),
        fullPage: true,
        mask: [seite.locator('input[type="password"]')],
      });
    } catch {
      console.log(JSON.stringify({ event: "webb9-diagnose-aufnahmefehler", fall: fallId }));
    }
    throw error;
  }
  return { seite, feld, w: welt };
}

async function entwurf(seite: Page, key: string): Promise<string | null> {
  return seite.evaluate(
    imBrowser<string | null>(
      "(key) => JSON.parse(localStorage.getItem(key) || 'null')?.entwurf ?? null",
    ),
    key,
  );
}

describe("WEBB9: bestätigte Rückmeldung und aktueller Frageentwurf", () => {
  for (const fall of [
    {
      id: "A",
      name: "bewahrt die während der Rückmeldung weitergetippte Frage samt Arbeitsstand und Wiederaufnahme",
      neu: "Meine neue fiktive Frage bleibt erhalten.",
    },
    {
      id: "B",
      name: "leert den unveränderten bestätigten Rückmeldetext samt Arbeitsstand normal",
      neu: null,
    },
  ]) {
    it(fall.name, async () => {
      const { seite, feld, w } = await oeffnen(fall.id);
      try {
        await feld.fill(RUECKMELDUNG);
        await feld.press("Enter");
        const karte = seite.getByTestId("ask-nicht-hilfreich");
        await karte.waitFor();
        expect(await karte.innerText()).toContain(TITEL);
        expect(await seite.getByTestId("ask-nicht-hilfreich-weg").inputValue()).toBe(WEG);
        const bestaetigt = seite.waitForResponse(
          (r) =>
            r.request().method() === "POST" && new URL(r.url()).pathname === "/api/ask/not-helpful",
        );
        await seite.getByTestId("ask-nicht-hilfreich-bestaetigen").click();
        await w.erreicht;
        expect(w.posts).toHaveLength(1);
        expect(await feld.isEditable()).toBe(true);
        if (fall.neu !== null) await feld.fill(fall.neu);
        const vorAntwort = fall.neu ?? RUECKMELDUNG;
        await expect.poll(() => entwurf(seite, w.key)).toBe(vorAntwort);
        expect(await feld.inputValue()).toBe(vorAntwort);
        await seite.screenshot({
          path: resolve(belege, `${fall.id}-vor-bestaetigung.png`),
          fullPage: true,
        });
        w.freigeben();
        expect((await bestaetigt).status()).toBe(200);
        await seite.getByTestId("ask-nicht-hilfreich-erledigt").waitFor();
        const erwartet = fall.neu ?? "";
        await expect.poll(() => feld.inputValue()).toBe(erwartet);
        await expect.poll(() => entwurf(seite, w.key)).toBe(erwartet);
        expect(w.posts).toHaveLength(1);
        expect(w.posts[0]).toMatchObject({ koId: w.koId, receipt: RECEIPT, alternative: WEG });
        expect(Object.keys(w.posts[0] ?? {}).sort()).toEqual([
          "alternative",
          "entwurfTitel",
          "koId",
          "receipt",
        ]);
        expect(w.lage.askAufrufe).toBe(0);
        await seite.screenshot({
          path: resolve(belege, `${fall.id}-bestaetigt.png`),
          fullPage: true,
        });
        await seite.reload({ waitUntil: "domcontentloaded" });
        await feld.waitFor();
        await expect.poll(() => feld.inputValue()).toBe(erwartet);
        await expect.poll(() => entwurf(seite, w.key)).toBe(erwartet);
        expect(w.posts).toHaveLength(1);
        expect(w.lage.askAufrufe).toBe(0);
        await seite.screenshot({
          path: resolve(belege, `${fall.id}-wiederaufnahme.png`),
          fullPage: true,
        });
        writeFileSync(
          resolve(belege, `${fall.id}.json`),
          JSON.stringify(
            {
              fall: fall.id,
              kontoId: w.kontoId,
              koId: w.koId,
              vorAntwort,
              nachAntwort: erwartet,
              wiederaufnahme: await feld.inputValue(),
              arbeitsstand: await entwurf(seite, w.key),
              rueckmeldungen: w.posts,
              askModellAufrufe: w.lage.askAufrufe,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        await seite.screenshot({ path: resolve(belege, `${fall.id}-fehler.png`), fullPage: true });
        throw error;
      }
    }, 60_000);
  }
});
