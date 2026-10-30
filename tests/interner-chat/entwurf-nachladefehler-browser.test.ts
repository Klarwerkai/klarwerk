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
  ADMIN_MAIL,
  ALTMARKE,
  type EntwurfWelt,
  LESER_MAIL,
  entwurfWelt,
} from "./entwurf-pruefstand";

let browser: Browser | undefined;
let kontext: Kontext | undefined;
let w: EntwurfWelt | undefined;
afterEach(async () => {
  try {
    await kontext?.close();
  } finally {
    try {
      await browser?.close();
    } finally {
      await w?.schliessen();
    }
  }
  kontext = undefined;
  browser = undefined;
  w = undefined;
});

async function anmelden(seite: Page, email: string) {
  await seite.locator("#auth-email").fill(email);
  await seite.locator("#auth-password").fill(PASSWORT);
  const antwort = seite.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
  await seite.locator("#auth-password").press("Enter");
  expect((await antwort).status()).toBe(200);
  await seite.locator("#auth-email").waitFor({ state: "hidden" });
}

describe("WEBB-4: eigener Chatentwurf bei Hintergrundfehler", () => {
  it("bewahrt drei Entwurfsfelder und sperrt Inhalte nach Rechteentzug", async () => {
    w = await entwurfWelt(mitFlaeche().vorListen);
    const x = w;
    browser = await starteChromium();
    const p = await profil(browser, { width: 1280, height: 900 });
    kontext = p.kontext;
    const seite = p.seite as unknown as Page;
    const belege = resolve(".local/run/webb4-chat-entwurf1069");
    mkdirSync(belege, { recursive: true });
    try {
      await seite.goto(x.basis, { waitUntil: "domcontentloaded" });
      await anmelden(seite, LESER_MAIL);
      expect((await kontext.cookies()).some((k) => k.name === "kw_session" && k.value)).toBe(true);
      const url = `${x.basis}/chat/${x.gespraechId}?nachricht=${x.alteId}`;
      await seite.goto(url, { waitUntil: "domcontentloaded" });
      await seite.getByTestId("chat-ladefehler").waitFor({ timeout: 15_000 });
      expect(await seite.getByTestId("chat-nicht-gefunden").count()).toBe(0);
      expect(await seite.getByTestId("chat-verfassen").count()).toBe(0);
      expect(x.lage.ausfaelle).toBeGreaterThan(0);
      await seite.screenshot({ path: resolve(belege, "initialfehler.png") });
      x.lage.ausfall = false;
      await seite.getByTestId("chat-laden-erneut").click();
      const eingabe = seite.getByTestId("chat-eingabe");
      await eingabe.waitFor();
      const alt = seite.locator(`[data-testid="chat-nachricht"][data-nachricht="${x.alteId}"]`);
      await alt.waitFor();
      await seite.getByTestId("chat-aeltere").click();
      await seite.locator('[data-testid="chat-verlauf"]').locator(alt).waitFor();
      await eingabe.fill("Fiktiver ungesendeter Entwurf");
      const name = await seite
        .getByTestId("chat-erwaehnen")
        .locator(`option[value="${x.adminId}"]`)
        .innerText();
      await seite.getByTestId("chat-erwaehnen").selectOption(x.adminId);
      await seite.getByTestId("chat-anhang-waehlen").check();
      const text = `Fiktiver ungesendeter Entwurf @${name} `;
      expect(await eingabe.inputValue()).toBe(text);
      await seite.screenshot({ path: resolve(belege, "entwurf-vorher.png") });
      x.lage.ausfall = true;
      await seite.getByTestId("chat-ladefehler").waitFor({ timeout: 15_000 });
      expect(await seite.getByTestId("chat-verfassen").count()).toBe(0);
      expect(await seite.getByTestId("chat-gespraech").count()).toBe(0);
      expect(await seite.getByTestId("chat-artikel-ruecklink").count()).toBe(0);
      expect(await seite.getByTestId("chat-nicht-gefunden").count()).toBe(0);
      await seite.screenshot({ path: resolve(belege, "hintergrundfehler.png") });
      x.lage.ausfall = false;
      await seite.getByTestId("chat-laden-erneut").click();
      await eingabe.waitFor();
      expect(await eingabe.inputValue()).toBe(text);
      expect(await seite.getByTestId("chat-erwaehnt-chip").innerText()).toContain(name);
      expect(await seite.getByTestId("chat-anhang-waehlen").isChecked()).toBe(true);
      await seite.screenshot({ path: resolve(belege, "entwurf-erholt.png") });
      const sendung = seite.waitForResponse(
        (r) =>
          r.url().endsWith(`/gespraeche/${x.gespraechId}/nachrichten`) &&
          r.request().method() === "POST",
      );
      await seite.getByTestId("chat-senden").click();
      const gesendet = await sendung;
      expect(gesendet.status()).toBe(201);
      const eingabeAmDraht = gesendet.request().postDataJSON();
      expect(eingabeAmDraht).toMatchObject({
        text: text.trim(),
        erwaehnungen: [x.adminId],
        anhaenge: [{ koId: x.koId, anhangId: x.anhangId }],
      });
      expect(x.sendungen).toHaveLength(1);
      const bestand = mussGelingen(
        "Nach bewusster Sendung normal zurücklesen",
        await x.leser.sende("GET", `/api/chat/gespraeche/${x.gespraechId}`),
      ).json as { nachrichten: { text: string; sendeKennung: string }[] };
      expect(
        bestand.nachrichten.filter((n) => n.sendeKennung === eingabeAmDraht.sendeKennung),
      ).toHaveLength(1);
      await expect.poll(() => eingabe.inputValue()).toBe("");
      expect(await seite.getByTestId("chat-erwaehnt-chip").count()).toBe(0);
      expect(await seite.getByTestId("chat-anhang-waehlen").isChecked()).toBe(false);
      await eingabe.fill("Nur für dieses Gespräch");
      await seite
        .locator(`[data-testid="chat-gespraech-eintrag"][data-gespraech="${x.anderesId}"]`)
        .click();
      await expect.poll(() => eingabe.inputValue()).toBe("");
      await seite
        .locator(`[data-testid="chat-gespraech-eintrag"][data-gespraech="${x.gespraechId}"]`)
        .click();
      await eingabe.waitFor();
      expect(await eingabe.inputValue()).toBe("");
      await eingabe.fill("Privater Kontoentwurf WEBB4");
      await seite.getByTestId("chat-erwaehnen").selectOption(x.adminId);
      await seite.getByTestId("chat-anhang-waehlen").check();
      await x.sperreRolle();
      expect((await x.leser.sende("GET", `/api/chat/gespraeche/${x.gespraechId}`)).status).toBe(
        403,
      );
      await seite.getByTestId("chat-nicht-gefunden").waitFor({ timeout: 15_000 });
      expect(await seite.getByTestId("chat-verfassen").count()).toBe(0);
      expect(await seite.getByTestId("chat-gespraech").count()).toBe(0);
      expect(await seite.getByTestId("chat-ladefehler").count()).toBe(0);
      await x.stelleRolleWiederHer();
      await eingabe.waitFor({ timeout: 15_000 });
      await x.services.ko.setQuellrechte(
        x.koId,
        { stufe: "intern", leser: [x.adminId] },
        x.adminId,
      );
      expect((await x.leser.sende("GET", `/api/chat/gespraeche/${x.gespraechId}`)).status).toBe(
        404,
      );
      expect((await x.leser.sende("GET", `/api/chat/nachrichten/${x.alteId}`)).status).toBe(404);
      const aeltere = `/api/chat/gespraeche/${x.gespraechId}?vor=${x.alteId}`;
      expect((await x.leser.sende("GET", aeltere)).status).toBe(404);
      await seite.getByTestId("chat-nicht-gefunden").waitFor({ timeout: 15_000 });
      for (const testid of [
        "chat-gespraech",
        "chat-verfassen",
        "chat-senden",
        "chat-artikel-ruecklink",
        "chat-ausschnitt",
        "chat-anhang",
      ]) {
        expect(await seite.getByTestId(testid).count()).toBe(0);
      }
      expect(await seite.locator("body").innerText()).not.toContain(ALTMARKE);
      await seite.screenshot({ path: resolve(belege, "rechteentzug.png") });
      await seite.getByTestId("kopfband-konto").click();
      await seite.getByTestId("konto-abmelden").click();
      await seite.locator("#auth-email").waitFor();
      expect(
        (await seite.request.get(`${x.basis}/api/chat/gespraeche/${x.gespraechId}`)).status(),
      ).toBe(401);
      await anmelden(seite, ADMIN_MAIL);
      await seite.goto(url, { waitUntil: "domcontentloaded" });
      await eingabe.waitFor();
      expect(await eingabe.inputValue()).toBe("");
      expect(await seite.getByTestId("chat-erwaehnt-chip").count()).toBe(0);
      expect(await seite.getByTestId("chat-anhang-waehlen").isChecked()).toBe(false);
      expect(x.sendungen).toHaveLength(1);
    } catch (error) {
      await seite.screenshot({ path: resolve(belege, "fehler.png") });
      throw error;
    }
  }, 60_000);
});
