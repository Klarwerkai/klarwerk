// Genau ein neuer H04-Fall. Nur durch tools/browserdeckel.sh mit einem Worker ausführen.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect as pwExpect } from "@playwright/test";
import { type Browser, chromium } from "playwright";
import { expect, it } from "vitest";
import type { DatenpunktSicht } from "../../services/app/src/praesentation-daten";
import { PPTX, vorlage } from "./pp05-welt";

it("PP05 · echte Anwendung: Vorschau, Übernahme, Herkunft und Rücknahme per Tastatur, 320px/1440px", async () => {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  const { buildApp, buildServices } = await import("../../services/app/src/build-app");
  const { registerWebStatic } = await import("../../services/app/src/web-static");
  const out = process.env.PP05_BELEGE ?? join(process.cwd(), ".local/run/pp05-browser");
  await mkdir(out, { recursive: true });
  const services = buildServices();
  const app = buildApp(services, { log: { stufe: "silent" } });
  let browser: Browser | undefined;
  let origin = "";
  let fehler: unknown;
  const beginn = new Date().toISOString();
  try {
    await registerWebStatic(app, join(process.cwd(), "apps/web/dist"));
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Anna PP05 Fiktiv",
        email: "anna@pp05.test",
        password: "pp05-fiktiver-test-2026",
      },
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@pp05.test", password: "pp05-fiktiver-test-2026" },
    });
    expect(login.statusCode, login.body).toBe(200);
    const cookie = `kw_session=${login.json().token}`;
    await app.inject({ method: "POST", url: "/api/auth/notice", headers: { cookie } });
    const ko = await services.ko.create({
      title: "PP05 kontrollierter Vertrieb",
      statement: "Fiktiver lokaler Bestand",
      type: "best_practice",
      category: "Test",
      author: reg.json().id,
      confidentiality: "intern",
    });
    const bytes = await vorlage();
    const ref = await services.objects.put({
      name: "Vorlage.pptx",
      mime: PPTX,
      data: `data:${PPTX};base64,${bytes.toString("base64")}`,
      purpose: "attachment",
      confidentiality: "intern",
    });
    const mit = await services.ko.addAttachment(ko.id, reg.json().id, {
      name: ref.name,
      mime: PPTX,
      objectId: ref.id,
      size: ref.size,
    });
    const anhangId = mit.attachments[0]?.id;
    if (!anhangId) throw new Error("Anhang fehlt");
    const punkte: DatenpunktSicht[] = [];
    for (const [wert, bezugsgroesse] of [
      ["400 T€", "Nord"],
      ["600 T€", "Süd"],
    ]) {
      const r = await app.inject({
        method: "POST",
        url: `/api/kos/${ko.id}/datenpunkte`,
        headers: { cookie },
        payload: {
          art: "zahl",
          wert,
          bezugsgroesse,
          einheit: "T€",
          waehrung: "EUR",
          zeitraum: "Q4 2025",
          erfassung: "manuell",
          beleg: "Kontrollierter fiktiver Testwert",
        },
      });
      expect(r.statusCode, r.body).toBe(201);
      punkte.push(r.json());
    }
    origin = await app.listen({ host: "127.0.0.1", port: 0 });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      locale: "de-DE",
      reducedMotion: "reduce",
    });
    await context.addCookies([{ name: "kw_session", value: login.json().token, url: origin }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("kw.lang", "de"));
    await page.goto(`${origin}/wissen/${ko.id}`);
    await page.getByTestId("bib-titel").waitFor();
    const setup = page.getByRole("region", { name: "Wie soll deine Assistenz heißen?" });
    if (await setup.isVisible()) await setup.getByRole("button", { name: "Später" }).click();
    await page.getByTestId("bib-mehr").click();
    await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
    await page.locator(`[data-office-oeffnen="${anhangId}"]`).click();
    const aufbau = page.locator("[data-folienaufbau]");
    await aufbau.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await aufbau.getByLabel("Titel", { exact: true }).fill("Vertrieb Q4");
    await aufbau.getByLabel("Ziel oder gewünschte Entscheidung").fill("Entscheidung über Quartal");
    await aufbau.getByLabel("Publikum", { exact: true }).fill("Geschäftsführung");
    await aufbau.locator("label").filter({ hasText: "400 T€" }).locator("input").check();
    await aufbau.locator("label").filter({ hasText: "600 T€" }).locator("input").check();
    await aufbau.getByRole("button", { name: "Vorschau erstellen", exact: true }).focus();
    await page.keyboard.press("Enter");
    const preview = aufbau.getByRole("region", { name: "Vorschau erstellen" });
    await pwExpect(preview).toBeVisible();
    await pwExpect(preview).toContainText("400 T€");
    await page.screenshot({ path: join(out, "01-vorschau-breit.png") });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await aufbau.scrollIntoViewIfNeeded();
    const bounds = await aufbau.boundingBox();
    expect(bounds).toBeTruthy();
    expect((bounds?.x ?? -1) >= 0).toBe(true);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(321);
    await page.screenshot({ path: join(out, "02-vorschau-schmal-dunkelpraeferenz.png") });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await aufbau.getByRole("button", { name: "Neue Folien übernehmen", exact: true }).focus();
    await page.keyboard.press("Enter");
    await pwExpect(aufbau.locator("output")).toContainText("gespeichert");
    const flaeche = page.locator(`[data-folien-daten="${anhangId}"]`);
    await flaeche.locator(`button[data-datenpunkt="${punkte[0]?.id}"]`).first().click();
    await pwExpect(flaeche.locator("[data-herkunft]")).toContainText(
      "Kontrollierter fiktiver Testwert",
    );
    await page.screenshot({ path: join(out, "03-gespeichert-herkunft.png") });
    await page
      .getByRole("button", { name: `Dokument aus Fassung ${mit.version} zurückholen`, exact: true })
      .click();
    await pwExpect(page.locator("[data-office-fassung]")).toContainText(
      `Artikelfassung ${mit.version + 2}`,
    );
    expect((await services.ko.get(ko.id))?.attachments[0]?.objectId).toBe(ref.id);
    expect(errors).toEqual([]);
    await writeFile(
      join(out, "ERGEBNIS.json"),
      JSON.stringify(
        {
          fall: "PP05-H04",
          status: "bestanden",
          nativePowerPoint: false,
          powerPointWeb: false,
          screenreader: false,
          breiten: [320, 1440],
          kontrollierteWerte: [400, 600],
          begin: beginn,
          origin,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    fehler = e;
    throw e;
  } finally {
    await browser?.close();
    await app.close();
    await writeFile(
      join(out, "RESSOURCEN-ENDE.json"),
      JSON.stringify(
        {
          begin: beginn,
          end: new Date().toISOString(),
          origin,
          browserGeschlossen: true,
          appGeschlossen: true,
          erfolg: !fehler,
          fehler: fehler instanceof Error ? fehler.message : null,
        },
        null,
        2,
      ),
    );
  }
}, 120000);
