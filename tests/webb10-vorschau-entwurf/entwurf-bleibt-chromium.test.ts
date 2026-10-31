import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright-core";
import { afterEach, describe, expect, it } from "vitest";
import { type Browser, type Kontext, fn, starteChromium } from "../gast-nutzerweg/browserweg";
import { PASSWORT } from "../gast-nutzerweg/strecke";
import { AUSSAGE, EMAIL, FRAGE, NEU, type Pruefwelt, TITEL, pruefwelt } from "./pruefstand";

const belege = resolve(".local/run/webb10-vorschau-entwurf1074");
let welt: Pruefwelt | undefined;
let browser: Browser | undefined;
let kontext: Kontext | undefined;
let seite: Page | undefined;

function imBrowser<T>(quelle: string): (arg: unknown) => T {
  return fn(quelle) as (arg: unknown) => T;
}
interface Entwurf {
  kontoId: string;
  text: string;
  abgewiesen: { text: string }[];
}
async function entwurf(p: Page): Promise<Entwurf | null> {
  return p.evaluate(
    imBrowser<Entwurf | null>(
      "() => JSON.parse(sessionStorage.getItem('klarwerk.assistenz.eingabe') || 'null')",
    ),
  );
}

afterEach(async () => {
  try {
    await welt?.fertig();
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
  browser = undefined;
  kontext = undefined;
  seite = undefined;
  console.log(JSON.stringify({ event: "webb10-fixture-closed", workerPid: process.pid }));
});

async function oeffnen() {
  mkdirSync(belege, { recursive: true });
  welt = await pruefwelt();
  browser = await starteChromium();
  kontext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "de-DE",
    serviceWorkers: "block",
  });
  await kontext.addInitScript('localStorage.setItem("kw.sprache", "de");');
  const p = (await kontext.newPage()) as unknown as Page;
  seite = p;
  p.setDefaultTimeout(15_000);
  await p.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === new URL(welt?.basis ?? "").origin)
      await route.continue();
    else await route.abort();
  });
  await welt.steuern(p);
  await p.goto(welt.basis, { waitUntil: "domcontentloaded" });
  await p.locator("#auth-email").fill(EMAIL);
  await p.locator("#auth-password").fill(PASSWORT);
  const login = p.waitForResponse((r) => new URL(r.url()).pathname === "/api/auth/login");
  await p.locator("#auth-password").press("Enter");
  expect((await login).status()).toBe(200);
  await p.locator("#auth-email").waitFor({ state: "hidden" });
  await p.goto(`${welt.basis}/klara-vorschau`, { waitUntil: "domcontentloaded" });
  await p.getByTestId("page-klara-vorschau").waitFor();
  await expect
    .poll(() =>
      p.evaluate(
        imBrowser<string | null>("() => sessionStorage.getItem('klarwerk.klaraVorschau.aktiv')"),
      ),
    )
    .toBe("1");
  await p.goto(`${welt.basis}/wissen/${welt.koId}`, { waitUntil: "domcontentloaded" });
  const absatz = p.getByTestId("bib-text").locator("p").filter({ hasText: AUSSAGE }).first();
  await absatz.waitFor();
  const figur = p.getByTestId("klara-figur");
  await figur.waitFor();
  expect(await figur.getAttribute("data-betrieb")).toBe("echt");
  await figur.click();
  await p.getByTestId("klara-gespraech").waitFor();
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await p.getByTestId("klara-einwilligung-erteilt").waitFor();
  // Echte Browsermarkierung und bestehender Übernahmeknopf, keine Sender-/Zustandsattrappe.
  await absatz.click({ clickCount: 3 });
  await p.getByTestId("klara-auswahl-knopf").click();
  await p.getByTestId("klara-auswahl-text").waitFor();
  expect(await p.getByTestId("klara-auswahl-text").innerText()).toContain(AUSSAGE);
  expect(await p.getByTestId("klara-auswahl-herkunft").innerText()).toContain(TITEL);
  expect(await p.getByTestId("klara-bezug").getAttribute("data-bezug")).toBe("markierung");
  // Dieser Formanker existiert im zu reparierenden nichtminimalen Zweig.
  const form = p.getByTestId("klara-eingabe-form");
  await form.waitFor();
  const feld = form.getByTestId("klara-eingabe");
  await feld.fill(FRAGE);
  await expect.poll(() => entwurf(p).then((e) => e?.text)).toBe(FRAGE);
  expect((await entwurf(p))?.kontoId).toBe(welt.kontoId);
  expect(await p.getByTestId("klara-senden").isEnabled()).toBe(true);
  return { p, feld, w: welt };
}

async function bild(p: Page, name: string) {
  await p.screenshot({ path: resolve(belege, `${name}.png`), fullPage: true });
}
async function fehlerbeleg(fall: string) {
  if (!seite) return;
  try {
    const zustand = await seite.evaluate(
      imBrowser<{
        url: string;
        text: string;
        eingabe: string | null;
        entwurf: string | null;
      }>(
        "() => ({ url: location.origin + location.pathname, text: document.body.innerText, eingabe: document.querySelector('[data-testid=klara-eingabe]')?.value ?? null, entwurf: sessionStorage.getItem('klarwerk.assistenz.eingabe') })",
      ),
    );
    writeFileSync(resolve(belege, `${fall}-fehler.json`), JSON.stringify(zustand, null, 2));
    await seite.screenshot({
      path: resolve(belege, `${fall}-fehler.png`),
      fullPage: true,
      mask: [seite.locator('input[type="password"]')],
    });
  } catch {
    console.log(JSON.stringify({ event: "webb10-fehlerbeleg-fehlt", fall }));
  }
}
function speichern(fall: string, daten: unknown) {
  writeFileSync(resolve(belege, `${fall}.json`), JSON.stringify(daten, null, 2));
}

describe("WEBB10: echter Vorschau-Textsender und bestehende Entwurfübergabe", () => {
  it("A: verweigert die inzwischen vertrauliche eigene Markierung und behält den Text ohne Frage-POST", async () => {
    try {
      const { p, feld, w } = await oeffnen();
      const vertraulich = await w.vertraulich();
      expect(vertraulich.level).toBe("vertraulich");
      await p.getByTestId("klara-senden").click();
      await p.getByTestId("klara-auswahl-gesperrt").waitFor();
      const grund = await p.getByTestId("klara-auswahl-gesperrt").innerText();
      expect(grund).toMatch(/vertraulich|keinen Zugriff/);
      expect(await feld.inputValue()).toBe(FRAGE);
      await expect.poll(() => entwurf(p).then((e) => e?.text)).toBe(FRAGE);
      expect((await entwurf(p))?.kontoId).toBe(w.kontoId);
      expect(w.fragen).toHaveLength(0);
      expect(await w.gespeicherteFragen()).toEqual([]);
      await bild(p, "A-abgewiesen");
      speichern("A", {
        kontoId: w.kontoId,
        koId: w.koId,
        vertraulich,
        grund,
        eingabe: await feld.inputValue(),
        entwurf: await entwurf(p),
        fragen: w.fragen,
        lesungen: w.lesungen,
      });
    } catch (error) {
      await fehlerbeleg("A");
      throw error;
    }
  }, 60_000);

  it("B: bewahrt neuen Text und zweiten Sendeversuch während der Auswahlprüfung auch bei späterer Übergabe", async () => {
    try {
      const { p, feld, w } = await oeffnen();
      w.halteAuswahl();
      await p.getByTestId("klara-senden").click();
      await w.auswahlErreicht;
      expect(await feld.inputValue()).toBe(FRAGE);
      expect(w.fragen).toHaveLength(0);
      await feld.fill(NEU);
      expect(await p.getByTestId("klara-senden").isEnabled()).toBe(true);
      await feld.press("Enter");
      expect(await feld.inputValue()).toBe(NEU);
      await expect.poll(() => entwurf(p).then((e) => e?.text)).toBe(NEU);
      expect(w.fragen).toHaveLength(0);
      await bild(p, "B-zweiter-versuch");
      w.auswahlFreigeben();
      await w.frageErreicht;
      expect(await feld.inputValue()).toBe(NEU);
      expect(w.fragen).toHaveLength(1);
      expect(w.fragen[0]?.question).toContain(FRAGE);
      expect(w.fragen[0]?.question).toContain(AUSSAGE);
      expect(w.fragen[0]?.question).not.toContain(NEU);
      expect(w.lesungen.filter((r) => r.gehalten)).toHaveLength(1);
      await bild(p, "B-uebergeben");
      const antwort = p.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/ask",
      );
      w.frageFreigeben();
      expect((await antwort).status()).toBe(200);
      await p.getByTestId("klara-stoppen").waitFor({ state: "hidden" });
      expect(await feld.inputValue()).toBe(NEU);
      expect((await entwurf(p))?.text).toBe(NEU);
      expect((await entwurf(p))?.kontoId).toBe(w.kontoId);
      const abgelegt = await w.gespeicherteFragen();
      expect(abgelegt).toHaveLength(1);
      expect(abgelegt[0]).toContain(FRAGE);
      speichern("B", {
        kontoId: w.kontoId,
        koId: w.koId,
        eingabe: await feld.inputValue(),
        entwurf: await entwurf(p),
        fragen: w.fragen,
        lesungen: w.lesungen,
        normalerFrageStatus: w.lage.frageStatus,
        abgelegt,
      });
    } catch (error) {
      await fehlerbeleg("B");
      throw error;
    }
  }, 60_000);

  it("C: behält erlaubten unveränderten Text bis zur Übergabe und leert ihn erst am normalen Frageweg", async () => {
    try {
      const { p, feld, w } = await oeffnen();
      w.halteAuswahl();
      await p.getByTestId("klara-senden").click();
      await w.auswahlErreicht;
      expect(await feld.inputValue()).toBe(FRAGE);
      expect(w.fragen).toHaveLength(0);
      expect((await entwurf(p))?.text).toBe(FRAGE);
      await bild(p, "C-vor-uebergabe");
      w.auswahlFreigeben();
      await w.frageErreicht;
      await expect.poll(() => feld.inputValue()).toBe("");
      expect((await entwurf(p))?.text ?? "").toBe("");
      expect(w.fragen).toHaveLength(1);
      expect(w.fragen[0]?.question).toContain(FRAGE);
      expect(w.fragen[0]?.question).toContain(AUSSAGE);
      await bild(p, "C-uebergeben");
      const antwort = p.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/ask",
      );
      w.frageFreigeben();
      expect((await antwort).status()).toBe(200);
      await p.getByTestId("klara-stoppen").waitFor({ state: "hidden" });
      expect(await feld.inputValue()).toBe("");
      const abgelegt = await w.gespeicherteFragen();
      expect(abgelegt).toHaveLength(1);
      expect(abgelegt[0]).toContain(FRAGE);
      speichern("C", {
        kontoId: w.kontoId,
        koId: w.koId,
        vorUebergabe: FRAGE,
        eingabe: await feld.inputValue(),
        entwurf: await entwurf(p),
        fragen: w.fragen,
        lesungen: w.lesungen,
        normalerFrageStatus: w.lage.frageStatus,
        abgelegt,
      });
    } catch (error) {
      await fehlerbeleg("C");
      throw error;
    }
  }, 60_000);
});
