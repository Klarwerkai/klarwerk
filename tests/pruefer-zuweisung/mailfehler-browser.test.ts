import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Browser,
  type Kontext,
  mitFlaeche,
  profil,
  starteChromium,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, mussGelingen } from "../gast-nutzerweg/strecke";
import { EMAIL, type MailWelt, mailWelt } from "./mailfehler-pruefstand";

let browser: Browser | undefined;
let kontext: Kontext | undefined;
let w: MailWelt | undefined;
afterEach(async () => {
  try {
    await kontext?.close();
  } finally {
    try {
      await browser?.close();
    } finally {
      await w?.schliessen();
      vi.restoreAllMocks();
    }
  }
  kontext = undefined;
  browser = undefined;
  w = undefined;
});

describe("IMP4/M15: gespeicherte Zuweisung im echten Browser", () => {
  it("zeigt Einzel- und Stapelwarnungen, liest zurück und leert erledigte Auswahl", async () => {
    w = await mailWelt(mitFlaeche().vorListen);
    const x = w;
    const [einzel, a, b] = x.objekte;
    if (!einzel || !a || !b) throw new Error("Prüfobjekte fehlen");
    browser = await starteChromium();
    const p = await profil(browser, { width: 1280, height: 900 });
    kontext = p.kontext;
    const seite = p.seite as unknown as Page;
    await seite.goto(x.basis, { waitUntil: "domcontentloaded" });
    await seite.locator("#auth-email").fill(EMAIL);
    await seite.locator("#auth-password").fill(PASSWORT);
    const anmeldung = seite.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
    await seite.locator("#auth-password").press("Enter");
    expect((await anmeldung).status()).toBe(200);
    expect((await kontext.cookies()).some((k) => k.name === "kw_session" && k.value)).toBe(true);
    await seite.goto(`${x.basis}/validierung`, { waitUntil: "domcontentloaded" });
    const zeile = (title: string) =>
      seite.getByTestId("validation-row").filter({ hasText: title });
    await zeile(einzel.title).getByTestId("pruefen-warteschlange-eintrag").click();
    await seite.getByTestId("pruefen-menue-karte").click();
    const auswahl = seite.getByTestId("pruefen-menue-panel-karte").locator("select");
    const antwort = seite.waitForResponse(
      (r) => r.url().endsWith(`/api/kos/${einzel.id}`) && r.request().method() === "PUT",
    );
    await auswahl.selectOption(x.konto.id);
    expect((await antwort).status()).toBe(200);
    const warnung =
      "Zuweisung an Pruefkonto controller gespeichert. Mindestens eine Benachrichtigung konnte nicht bestätigt werden.";
    await seite.getByText(warnung, { exact: true }).waitFor({ state: "visible" });
    const option = auswahl.locator(`option[value="${x.konto.id}"]`);
    await expect.poll(() => option.isDisabled()).toBe(true);
    const belege = resolve(".local/run/imp4-assign-mailfehler");
    mkdirSync(belege, { recursive: true });
    await seite.screenshot({ path: resolve(belege, "einzel.png"), fullPage: true });
    await seite.keyboard.press("Escape");
    await seite.getByTestId("pruefen-stapel-modus").click();
    await zeile(a.title).getByTestId("pruefen-stapel-waehlen").check();
    await zeile(b.title).getByTestId("pruefen-stapel-waehlen").check();
    await seite.getByTestId("pruefen-stapel-zuweisen").selectOption(x.konto.id);
    const ergebnisse = seite.getByTestId("pruefen-stapel-ergebnis-zeile");
    await expect.poll(() => ergebnisse.count()).toBe(2);
    const arten = await ergebnisse.evaluateAll((es) => es.map((e) => e.getAttribute("data-art")));
    expect(arten).toEqual(["zugewiesenWarnung", "zugewiesenWarnung"]);
    for (const title of [a.title, b.title]) {
      const ergebnis = ergebnisse.filter({ hasText: title });
      expect(await ergebnis.innerText()).toContain(
        "Zuweisung gespeichert — mindestens eine Benachrichtigung konnte nicht bestätigt werden",
      );
    }
    await expect.poll(() => seite.getByTestId("pruefen-stapel-anzahl").count()).toBe(0);
    expect(await seite.locator('[data-testid="pruefen-stapel-waehlen"]:checked').count()).toBe(0);
    const gelesen = mussGelingen(
      "Gespeicherte Zuweisungen nach UI",
      await x.admin.sende("GET", "/api/validation/board"),
    );
    for (const ko of [einzel, a, b]) {
      expect(gelesen.json).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: ko.id, assignments: [x.konto.id] })]),
      );
    }
    expect(x.notify).toHaveBeenCalledTimes(3);
    expect(await x.services.validation.openAssignmentsFor(x.konto.id)).toHaveLength(3);
    await seite.screenshot({ path: resolve(belege, "stapel.png"), fullPage: true });
    await seite.reload({ waitUntil: "domcontentloaded" });
    await zeile(a.title).getByTestId("pruefen-warteschlange-eintrag").click();
    await seite.getByTestId("pruefen-menue-karte").click();
    const gelesenOption = seite
      .getByTestId("pruefen-menue-panel-karte")
      .locator(`option[value="${x.konto.id}"]`);
    await expect.poll(() => gelesenOption.isDisabled()).toBe(true);
    expect(x.notify).toHaveBeenCalledTimes(3);
  }, 60_000);
});
