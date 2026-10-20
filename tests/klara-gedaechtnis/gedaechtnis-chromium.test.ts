import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { registerWebStatic } from "../../services/app/src/web-static";
process.env.KLARWERK_SKIP_KEYCHAIN = "1";
const services = buildServices();
const app = buildApp(services);
let browser: Browser;
let page: Page;
let origin = "";
const fehler: string[] = [];
const out = process.env.KLARA_E_BELEGE ?? join(process.cwd(), "test-results/klara-e");
const password = "fiktiv-browser-e-2026";
const antwort =
  "Fiktive vollständige Antwort. Alle Quellen und Prüfstände bleiben beim Einklappen erhalten.";
let kontoId = "";
beforeAll(async () => {
  await mkdir(out, { recursive: true });
  await registerWebStatic(app, join(process.cwd(), "apps/web/dist"));
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Anna Fiktiv", email: "anna@e-browser.test", password },
      })
    ).statusCode,
  ).toBe(201);
  const l = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "anna@e-browser.test", password },
  });
  expect(l.statusCode).toBe(200);
  kontoId = l.json().user.id;
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: { authorization: `Bearer ${l.json().token}` },
        payload: { name: "Bert Fiktiv", email: "bert@e-browser.test", password, role: "viewer" },
      })
    ).statusCode,
  ).toBe(201);
  const jetzt = new Date().toISOString();
  const bezug = { pfad: "/profil", seitenName: "Persönliche Einstellungen", objekt: "Gedächtnis" };
  await services.klaraGespraeche.lege({
    id: "gespraech-fiktiv-e",
    kontoId,
    objektbezug: bezug,
    nachrichten: [
      {
        id: "antwort-fiktiv-e",
        von: "klara",
        modus: "ohne_ki",
        text: antwort,
        objektbezug: bezug,
        antwortId: "antwort-e",
        quellen: ["quelle-e"],
        quellenAngaben: [
          { koId: "quelle-e", titel: "Fiktive Quelle E", fassung: 7, geprueft: true },
        ],
        wissensklasse: "confirmed",
        grund: null,
        angelegtAm: jetzt,
      },
    ],
    letzterSchritt: null,
    einwilligungAm: null,
    angelegtAm: jetzt,
    geaendertAm: jetzt,
    fassung: 1,
  });
  origin = await app.listen({ host: "127.0.0.1", port: 0 });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    locale: "de-DE",
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => fehler.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("kw.lang", "de");
  });
}, 120000);
afterAll(async () => {
  await browser?.close();
  await app.close();
});
async function login(email: string): Promise<void> {
  await page.goto(`${origin}/profil?bereich=klara`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.getByTestId("detail-assistenz").waitFor({ timeout: 20000 });
}
describe("Klara09 · eigene HTTP-Anwendung in echtem Chromium, fiktive Konten", () => {
  it("korrigiert und löscht mit Tastatur/Reload, trennt Konten, erhält Antwort und Quellen", async () => {
    await login("anna@e-browser.test");
    const g = page.getByTestId("klara-setup-gedaechtnis");
    await g.getByText("Noch keine Einträge gespeichert.").waitFor();
    await page.getByTestId("gedaechtnis-neu").fill("Fiktive kurze Antworten");
    await page.getByTestId("gedaechtnis-darstellung").selectOption("kurz");
    await g.getByRole("button", { name: "Vorliebe merken", exact: true }).focus();
    await page.keyboard.press("Enter");
    const entry = g.getByTestId("gedaechtnis-eintrag");
    await entry.waitFor();
    expect(await entry.textContent()).toContain("eigene Eingabe");
    await page.reload();
    await entry.waitFor();
    expect(await entry.locator("textarea").inputValue()).toBe("Fiktive kurze Antworten");
    await page.getByTestId("klara-figur").click();
    const kurz = page.getByTestId("klara-antwort-kurz");
    await kurz.waitFor();
    const n = page.getByTestId("klara-nachricht");
    expect(await n.textContent()).toContain("Fiktive Quelle E");
    expect(await n.textContent()).toContain("7");
    expect(await kurz.getAttribute("open")).toBe(null);
    await kurz.locator("summary").focus();
    await page.keyboard.press("Enter");
    expect(await kurz.innerText()).toContain(antwort);
    await page.getByTestId("klara-schliessen").click();
    await entry.locator("textarea").fill("Fiktive Korrektur ausführlich");
    await entry.getByLabel("Antwortdarstellung").selectOption("ausfuehrlich");
    await entry.getByRole("button", { name: "Änderung speichern" }).click();
    await g.getByText("Gespeichert. Der Serverstand wurde erneut gelesen.").waitFor();
    await page.reload();
    await entry.waitFor();
    expect(await entry.locator("textarea").inputValue()).toBe("Fiktive Korrektur ausführlich");
    await page.getByTestId("klara-figur").click();
    await n.waitFor();
    expect(await kurz.count()).toBe(0);
    expect(await n.innerText()).toContain(antwort);
    expect(await n.innerText()).toContain("Fiktive Quelle E");
    await page.getByTestId("klara-schliessen").click();
    await g.screenshot({ path: join(out, "09-gedaechtnis-korrektur.png") });
    await entry.getByRole("button", { name: "Eintrag löschen" }).click();
    await g.getByText("Noch keine Einträge gespeichert.").waitFor();
    await page.reload();
    await g.getByText("Noch keine Einträge gespeichert.").waitFor();
    expect(
      (await services.klaraGespraeche.hole(kontoId, "gespraech-fiktiv-e"))?.nachrichten[0]?.text,
    ).toBe(antwort);
    await page.context().clearCookies();
    await login("bert@e-browser.test");
    await g.getByText("Noch keine Einträge gespeichert.").waitFor();
    expect(await entry.count()).toBe(0);
    expect(
      await page.evaluate<boolean>('matchMedia("(prefers-reduced-motion: reduce)").matches'),
    ).toBe(true);
    expect(fehler).toEqual([]);
  }, 90000);
});
