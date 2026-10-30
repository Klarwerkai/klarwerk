import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright-core";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Browser,
  type Kontext,
  mitFlaeche,
  profil,
  starteChromium,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, mussGelingen } from "../gast-nutzerweg/strecke";
import {
  ALT_BODY,
  ALT_LINK,
  EMAIL,
  FOTO,
  type MobileWelt,
  mobileWelt,
} from "./spaete-eingabe-pruefstand";

let browser: Browser | undefined;
let kontext: Kontext | undefined;
let welt: MobileWelt | undefined;
const belege = resolve(".local/run/mobile-spaete-eingabe1070-pruefstand6");
afterEach(async () => {
  welt?.loeseAlle();
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
  kontext = undefined;
  browser = undefined;
  welt = undefined;
  console.log(JSON.stringify({ event: "mobile-fixture-closed", workerPid: process.pid }));
});

async function oeffnen(sprache: "de" | "nl") {
  welt = await mobileWelt(mitFlaeche().vorListen);
  browser = await starteChromium();
  const p = await profil(browser, { width: 390, height: 844 }, sprache);
  kontext = p.kontext;
  const seite = p.seite as unknown as Page;
  await welt.antwortenSteuern(seite);
  await seite.goto(welt.basis, { waitUntil: "domcontentloaded" });
  await seite.locator("#auth-email").fill(EMAIL);
  await seite.locator("#auth-password").fill(PASSWORT);
  const login = seite.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
  await seite.locator("#auth-password").press("Enter");
  expect((await login).status()).toBe(200);
  await seite.locator("#auth-email").waitFor({ state: "hidden" });
  expect((await kontext.cookies()).some((c) => c.name === "kw_session" && c.value)).toBe(true);
  await seite.goto(`${welt.basis}/mobile`, { waitUntil: "domcontentloaded" });
  await seite.getByTestId("mob-primaer").waitFor();
  mkdirSync(belege, { recursive: true });
  return { seite, w: welt };
}

function antwort(seite: Page, methode: "POST" | "PUT") {
  return seite.waitForResponse(
    (r) =>
      r.request().method() === methode &&
      /\/api\/drafts(?:\/[^/?]+)?$/u.test(new URL(r.url()).pathname),
  );
}

async function foto(seite: Page) {
  await seite.getByTestId("mob-foto-mediathek").setInputFiles({
    name: "fiktives-pruefbild.png",
    mimeType: "image/png",
    buffer: Buffer.from(FOTO, "base64"),
  });
  await seite.getByTestId("mob-fotos").getByRole("img").waitFor();
  await seite.getByTestId("mob-foto-in-arbeit").waitFor({ state: "hidden" });
}

async function gespeichertesBild(seite: Page, html: string | undefined, alt: string) {
  const bilder = (html ?? "").match(/<p><img\b[^>]*><\/p>/gu) ?? [];
  expect(bilder).toHaveLength(1);
  const fragment = bilder[0];
  if (!fragment) throw new Error("Das tatsächlich gespeicherte Bildfragment fehlt.");
  expect(fragment).toContain(`alt="${alt}"`);
  const quelle = /\bsrc="([^"]+)"/u.exec(fragment)?.[1] ?? "";
  expect(quelle).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/u);
  const bytes = Buffer.from(quelle.slice("data:image/webp;base64,".length), "base64");
  expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  const masse = await seite.evaluate<{ breite: number; hoehe: number }>(
    `new Promise((resolve) => {
      const bild = new Image();
      bild.onload = () => resolve({ breite: bild.naturalWidth, hoehe: bild.naturalHeight });
      bild.onerror = () => resolve({ breite: 0, hoehe: 0 });
      bild.src = ${JSON.stringify(quelle)};
    })`,
  );
  expect(masse).toEqual({ breite: 1, hoehe: 1 });
  return fragment;
}

describe("Mobile: späte Eingabe nach echtem Speichereffekt", () => {
  it("bindet die Neuanlage und bewahrt spätes Interview und Foto", async () => {
    const { seite, w } = await oeffnen("de");
    try {
      await seite
        .getByTestId("mob-modus")
        .getByRole("button", { name: "Interview", exact: true })
        .click();
      const feld = seite.getByTestId("mob-interview-antwort");
      await feld.fill("Fiktive Kernaussage A26.");
      await seite.getByRole("button", { name: "Nächste Frage", exact: true }).click();
      await feld.fill("Bedingung vor dem Absenden.");
      const halt = w.anhalten("POST");
      const ersteAntwort = antwort(seite, "POST");
      await seite.getByTestId("mob-primaer").click();
      const erster = await halt.erreicht;
      const vorAntwort = await w.lesen(erster.id);
      expect(vorAntwort.updatedAt).toBe(erster.updatedAt);
      expect(vorAntwort.payload.conditions).toEqual(["Bedingung vor dem Absenden."]);
      await feld.fill("Bedingung vor dem Absenden. Später eingegebener Satz bleibt.");
      await foto(seite);
      expect(await seite.getByTestId("mob-primaer").isDisabled()).toBe(true);
      halt.freigeben();
      expect((await ersteAntwort).status()).toBe(201);
      await seite.getByTestId("mob-spaete-eingabe").waitFor();
      expect(await feld.inputValue()).toBe(
        "Bedingung vor dem Absenden. Später eingegebener Satz bleibt.",
      );
      expect(await seite.getByTestId("mob-interview").isVisible()).toBe(true);
      expect(await seite.getByTestId("mob-fotos").getByRole("img").count()).toBe(1);
      expect(await seite.getByTestId("mob-primaer").innerText()).toContain("aktualisieren");
      expect(await seite.getByTestId("mob-spaete-eingabe").innerText()).toBe(
        "Deine späteren Änderungen sind noch nicht gespeichert. Bitte erneut speichern.",
      );
      await seite.screenshot({ path: resolve(belege, "neuanlage-spaet-de.png"), fullPage: true });
      const zweiteAntwort = antwort(seite, "PUT");
      await seite.getByTestId("mob-primaer").click();
      const zweite = await zweiteAntwort;
      expect(zweite.status()).toBe(200);
      expect(zweite.request().postDataJSON().expectedUpdatedAt).toBe(erster.updatedAt);
      const zuletzt = await w.lesen(erster.id);
      expect(zuletzt.id).toBe(erster.id);
      expect(zuletzt.payload.statement).toBe("Fiktive Kernaussage A26.");
      expect(zuletzt.payload.conditions).toEqual([
        "Bedingung vor dem Absenden. Später eingegebener Satz bleibt.",
      ]);
      await gespeichertesBild(seite, zuletzt.payload.bodyHtml, "fiktives-pruefbild.png");
      expect((await w.liste()).map((d) => d.id)).toEqual([erster.id]);
      expect(w.schreibungen.map((s) => s.methode)).toEqual(["POST", "PUT"]);
      await expect.poll(() => feld.inputValue()).toBe("");
      expect(await seite.getByTestId("mob-spaete-eingabe").count()).toBe(0);
      // Eine tatsächliche HTTP-Ablehnung quittiert und leert auch den nächsten Entwurf nicht.
      await feld.fill("Diese Eingabe muss bei Ablehnung bleiben.");
      w.lage.ablehnen = true;
      const abgewiesen = antwort(seite, "POST");
      await seite.getByTestId("mob-primaer").click();
      expect((await abgewiesen).status()).toBe(422);
      await expect.poll(() => seite.getByTestId("mob-primaer").isDisabled()).toBe(false);
      expect(await feld.inputValue()).toBe("Diese Eingabe muss bei Ablehnung bleiben.");
      expect((await w.liste()).length).toBe(1);
      await seite.screenshot({
        path: resolve(belege, "ablehnung-eingabe-bleibt.png"),
        fullPage: true,
      });
      // Derselbe lokale Vorgang bleibt beim späteren bewussten Speichern erhalten, ohne Sync.
      await seite.context().setOffline(true);
      await seite.getByText("offline", { exact: true }).waitFor();
      await feld.fill("Offline erster Satz.");
      await seite.evaluate(() => {
        const w = globalThis as unknown as { bereit?: boolean; freigeben?: () => void };
        void navigator.locks.request("kw.offlineQueue.v1", async () => {
          w.bereit = true;
          await new Promise<void>((resolve) => {
            w.freigeben = resolve;
          });
        });
      });
      await expect.poll(() => seite.evaluate("window.bereit === true")).toBe(true);
      await seite.getByTestId("mob-primaer").click();
      await feld.fill("Offline erster Satz. Späterer lokaler Satz.");
      await seite.evaluate("window.freigeben()");
      await seite.getByTestId("mob-spaete-eingabe").waitFor();
      const lokalLesen = async () =>
        (await seite.evaluate(
          'JSON.parse(localStorage.getItem("kw.offlineQueue.v1") || "[]")',
        )) as {
          id: string;
          eigentuemer: string;
          payload: { statement: string };
        }[];
      const lokal = await lokalLesen();
      expect(lokal).toHaveLength(1);
      expect(lokal[0]?.eigentuemer).toBeTruthy();
      expect(lokal[0]?.payload.statement).toBe("Offline erster Satz.");
      expect(await feld.inputValue()).toBe("Offline erster Satz. Späterer lokaler Satz.");
      await seite.getByTestId("mob-primaer").click();
      await expect.poll(() => feld.inputValue()).toBe("");
      const fortgesetzt = await lokalLesen();
      expect(fortgesetzt).toHaveLength(1);
      expect(fortgesetzt[0]?.id).toBe(lokal[0]?.id);
      expect(fortgesetzt[0]?.eigentuemer).toBe(lokal[0]?.eigentuemer);
      expect(fortgesetzt[0]?.payload.statement).toBe("Offline erster Satz. Späterer lokaler Satz.");
      expect(w.schreibungen.map((s) => s.methode)).toEqual(["POST", "PUT"]);
      await seite.screenshot({
        path: resolve(belege, "offline-vorgang-fortgesetzt.png"),
        fullPage: true,
      });
    } catch (error) {
      await seite.screenshot({ path: resolve(belege, "fehler-neuanlage.png"), fullPage: true });
      throw error;
    }
  }, 60_000);

  it("führt CAS und Altstruktur fort und schützt ein abgelöstes Formular", async () => {
    const { seite, w } = await oeffnen("nl");
    try {
      const alt = mussGelingen(
        "Bestehenden Entwurf über echte Auth-HTTP anlegen",
        await w.admin.sende("POST", "/api/drafts", {
          title: "Fiktiver Altentwurf A26",
          statement: "Gespeicherte Kernaussage bleibt.",
          bodyHtml: ALT_BODY,
        }),
        201,
      ).json as { id: string };
      // Der echte Auth-GET legt VOR dem Fortsetzen den tatsächlich gespeicherten Altbestand fest.
      const altStand = await w.lesen(alt.id);
      expect(altStand.id).toBe(alt.id);
      const altHtml = altStand.payload.bodyHtml ?? "";
      const altLink = /<p><a\b[^>]*>Hand<br><br>buch<\/a><\/p>/u.exec(altHtml)?.[0] ?? "";
      expect(altLink).toBe(ALT_LINK);
      const altBild = await gespeichertesBild(seite, altHtml, "Pumpe");
      const altAbsatz = /<p>Unveränderter Altabsatz\.<\/p>/u.exec(altHtml)?.[0] ?? "";
      expect(altAbsatz).toBe("<p>Unveränderter Altabsatz.</p>");
      console.log(
        JSON.stringify({
          event: "mobile-altbestand-vor-fortsetzen",
          id: altStand.id,
          updatedAt: altStand.updatedAt,
          bodyHtml: altHtml,
          linkFragment: altLink,
          bildFragment: altBild,
          absatzFragment: altAbsatz,
        }),
      );
      await seite.reload({ waitUntil: "domcontentloaded" });
      await seite.getByTestId("mobil-entwurf-fortsetzen").click();
      const body = seite.getByTestId("mob-body");
      await body.waitFor();
      const originalText = await body.inputValue();
      const frueh = `${originalText}\n\nErste mobile Ergänzung.`;
      const spaet = `${frueh}\n\nSpäter eingegebener Satz.`;
      await body.fill(frueh);
      const halt = w.anhalten("PUT");
      const ersteAntwort = antwort(seite, "PUT");
      await seite.getByTestId("mob-primaer").click();
      const erster = await halt.erreicht;
      const ersterGelesen = await w.lesen(alt.id);
      expect(ersterGelesen.updatedAt).toBe(erster.updatedAt);
      expect(erster.id).toBe(alt.id);
      expect(erster.payload.bodyHtml).toContain(altLink);
      expect(erster.payload.bodyHtml).toContain(altBild);
      expect(erster.payload.bodyHtml).toContain(altAbsatz);
      expect(ersterGelesen.payload.bodyHtml).toBe(erster.payload.bodyHtml);
      console.log(
        JSON.stringify({
          event: "mobile-altbestand-erste-antwort",
          id: erster.id,
          updatedAt: erster.updatedAt,
          bodyHtml: erster.payload.bodyHtml,
        }),
      );
      await body.fill(spaet);
      halt.freigeben();
      expect((await ersteAntwort).status()).toBe(200);
      await seite.getByTestId("mob-spaete-eingabe").waitFor();
      expect(await body.inputValue()).toBe(spaet);
      expect(await seite.getByTestId("mob-spaete-eingabe").innerText()).toBe(
        "Je latere wijzigingen zijn nog niet opgeslagen. Sla opnieuw op.",
      );
      await seite.screenshot({ path: resolve(belege, "altentwurf-spaet-nl.png"), fullPage: true });
      const zweiteAntwort = antwort(seite, "PUT");
      await seite.getByTestId("mob-primaer").click();
      const zweite = await zweiteAntwort;
      expect(zweite.status()).toBe(200);
      expect(zweite.request().postDataJSON().expectedUpdatedAt).toBe(erster.updatedAt);
      const zweiteQuittung = (await zweite.json()) as {
        id: string;
        payload: { bodyHtml?: string };
      };
      expect(zweiteQuittung.id).toBe(alt.id);
      expect(zweiteQuittung.payload.bodyHtml).toContain(altLink);
      expect(zweiteQuittung.payload.bodyHtml).toContain(altBild);
      expect(zweiteQuittung.payload.bodyHtml).toContain(altAbsatz);
      const gespeichert = await w.lesen(alt.id);
      expect(gespeichert.payload.bodyHtml).toBe(zweiteQuittung.payload.bodyHtml);
      expect(gespeichert.payload.bodyHtml).toContain(altLink);
      expect(gespeichert.payload.bodyHtml).toContain(altBild);
      expect(gespeichert.payload.bodyHtml).toContain(altAbsatz);
      console.log(
        JSON.stringify({
          event: "mobile-altbestand-zweite-antwort",
          id: gespeichert.id,
          updatedAt: gespeichert.updatedAt,
          bodyHtml: gespeichert.payload.bodyHtml,
        }),
      );
      expect(gespeichert.payload.bodyHtml).toContain("<p>Erste mobile Ergänzung.</p>");
      expect(gespeichert.payload.bodyHtml).toContain("<p>Später eingegebener Satz.</p>");
      expect(gespeichert.payload.statement).toBe("Gespeicherte Kernaussage bleibt.");
      expect((await w.liste()).map((d) => d.id)).toEqual([alt.id]);
      await expect.poll(() => seite.getByTestId("mob-body").count()).toBe(0);
      // Derselbe Nachlauf muss auch eine rein spätere Leerzeicheneingabe erhalten.
      await seite.getByTestId("mobil-entwurf-fortsetzen").click();
      const titel = seite.locator('[data-testid="mob-erfassung"] input:not([type="file"])');
      await titel.fill("Titel vor Bestätigung");
      const leerzeichenHalt = w.anhalten("PUT");
      const leerzeichenAntwort = antwort(seite, "PUT");
      await seite.getByTestId("mob-primaer").click();
      await leerzeichenHalt.erreicht;
      await titel.fill("Titel vor Bestätigung ");
      leerzeichenHalt.freigeben();
      expect((await leerzeichenAntwort).status()).toBe(200);
      await seite.getByTestId("mob-spaete-eingabe").waitFor();
      expect(await titel.inputValue()).toBe("Titel vor Bestätigung ");
      // Ein ausdrücklich neues Formular gehört keiner alten Antwort.
      const wechselHalt = w.anhalten("PUT");
      const wechselAntwort = antwort(seite, "PUT");
      await seite.getByTestId("mob-primaer").click();
      await wechselHalt.erreicht;
      await seite.getByRole("button", { name: "Nieuw", exact: true }).click();
      await titel.fill("Anderes neues Formular");
      await seite.getByTestId("mob-statement").fill("Nur dieses neue Formular darf hier stehen.");
      wechselHalt.freigeben();
      expect((await wechselAntwort).status()).toBe(200);
      await expect.poll(() => seite.getByTestId("mob-primaer").isDisabled()).toBe(false);
      expect(await titel.inputValue()).toBe("Anderes neues Formular");
      expect(await seite.getByTestId("mob-statement").inputValue()).toBe(
        "Nur dieses neue Formular darf hier stehen.",
      );
      expect(await seite.getByTestId("mob-primaer").innerText()).toContain("opslaan");
      expect((await w.liste()).map((d) => d.id)).toEqual([alt.id]);
      await seite.screenshot({
        path: resolve(belege, "formularwechsel-bleibt.png"),
        fullPage: true,
      });
    } catch (error) {
      await seite.screenshot({ path: resolve(belege, "fehler-altentwurf.png"), fullPage: true });
      throw error;
    }
  }, 60_000);
});
