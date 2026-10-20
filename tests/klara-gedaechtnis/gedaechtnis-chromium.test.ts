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
let quelleId = "";
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
  const quelle = await services.ko.create({
    title: "Fiktive Quelle Übungen",
    statement: "Fiktive Quellenaussage zum Üben.",
    type: "best_practice",
    category: "Instandhaltung",
    author: kontoId,
    confidentiality: "intern",
  });
  quelleId = quelle.id;
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
  it("Klara16 · bestehendes Setup fortsetzen, echte Quellenübung, Fehler mit erhaltenen Eingaben und persönliche Kalenderzone", async () => {
    await page.context().clearCookies();
    await login("anna@e-browser.test");
    const e = page.getByTestId("klara-setup-einfuehrung");
    await e.getByTestId("einfuehrung-start").click();
    await e.getByRole("img", { name: "Avatar mit Zauberhut" }).waitFor();
    expect(
      await page.evaluate<string>(
        'getComputedStyle(document.querySelector("[data-testid=klara-setup-einfuehrung] svg")).animationName',
      ),
    ).toBe("none");
    await e.getByTestId("einfuehrung-weiter").focus();
    await page.keyboard.press("Enter");
    await e.getByTestId("einfuehrung-zone").waitFor();
    await e.getByTestId("einfuehrung-zone").selectOption("America/New_York");
    await e.getByTestId("einfuehrung-begleitung").selectOption("ausfuehrlich");
    await e.getByTestId("einfuehrung-pause").click();
    await e.getByTestId("einfuehrung-offen").waitFor({ state: "hidden" });
    await page.reload();
    await e.getByTestId("einfuehrung-start").click();
    expect(await e.getByTestId("einfuehrung-zone").inputValue()).toBe("America/New_York");
    expect(await e.getByTestId("einfuehrung-begleitung").inputValue()).toBe("ausfuehrlich");
    await e.getByTestId("einfuehrung-zone").selectOption("Asia/Tokyo");
    await page.route("**/api/me/assistenz", async (route) =>
      route.request().method() === "PUT" ? route.abort("failed") : route.continue(),
    );
    await e.getByTestId("einfuehrung-pause").click();
    await e.getByRole("alert").waitFor();
    expect(await e.getByTestId("einfuehrung-zone").inputValue()).toBe("Asia/Tokyo");
    await page.unroute("**/api/me/assistenz");
    await e.getByRole("button", { name: "Neu laden" }).click();
    expect(await e.getByTestId("einfuehrung-zone").inputValue()).toBe("Asia/Tokyo");
    await e.getByTestId("einfuehrung-weiter").click();
    const u = page.getByTestId("einfuehrung-uebung");
    await u.waitFor();
    await u.getByLabel("Wissensquelle suchen").fill("Fiktive Quelle Übungen");
    await u.getByRole("button", { name: "Fiktive Quelle Übungen", exact: true }).click();
    await u.getByLabel("Nein", { exact: true }).check();
    await u.getByRole("button", { name: "Verständnis prüfen" }).click();
    await u.getByTestId("einfuehrung-rueckmeldung").waitFor();
    expect(await u.getByTestId("einfuehrung-rueckmeldung").textContent()).toContain("Richtig.");
    await u.screenshot({ path: join(out, "16-quellenuebung.png") });
    expect((await page.request.delete(`${origin}/api/kos/${quelleId}`)).status()).toBe(204);
    await u.getByRole("button", { name: "Verständnis prüfen" }).click();
    await u.getByRole("alert").waitFor();
    await u
      .getByText("Keine zugängliche Quelle gefunden. Ändere die Suche oder überspringe die Übung.")
      .waitFor();
    expect(
      await u.getByRole("button", { name: "Fiktive Quelle Übungen", exact: true }).count(),
    ).toBe(0);
    expect(await u.getByTestId("einfuehrung-rueckmeldung").count()).toBe(0);
    await e.getByTestId("einfuehrung-weiter").click();
    await e.getByTestId("einfuehrung-weiter").click();
    await e.getByTestId("einfuehrung-offen").waitFor({ state: "hidden" });
    const profil = await (await page.request.get(`${origin}/api/me/assistenz`)).json();
    expect(profil.profil.einfuehrung).toMatchObject({
      schritt: 3,
      abgeschlossen: true,
      zeitzone: "Asia/Tokyo",
      begleitung: "ausfuehrlich",
    });
    const r = await page.request.post(`${origin}/api/me/kalender/eintraege`, {
      data: {
        art: "termin",
        titel: "Fiktiver Termin mit expliziter Zone",
        ganztaegig: false,
        beginn: "2026-10-26T08:00:00.000Z",
        zeitzone: "Europe/Berlin",
      },
    });
    expect(r.status()).toBe(201);
    const termin = (await r.json()).eintrag;
    await page.goto(`${origin}/kalender`);
    await page.getByTestId("kalender-zone").waitFor();
    expect(await page.getByTestId("kalender-zone").textContent()).toContain("Asia/Tokyo");
    await page.getByTestId("kalender-neu").click();
    expect(await page.getByTestId("kalender-form-zone").textContent()).toContain("Asia/Tokyo");
    await page.getByTestId("kalender-form-titel").fill("Fiktiver Profilzonentermin");
    await page.getByTestId("kalender-form-beginn").fill("2026-10-26T09:00");
    await page.getByTestId("kalender-form-speichern").click();
    await page.getByTestId("kalender-formular").waitFor({ state: "hidden" });
    await page.getByTestId("kalender-ansicht-agenda").click();
    await page.locator(`[data-event-id="${termin.id}"][data-testid="kalender-eintrag"]`).click();
    await page.getByTestId("kalender-bearbeiten").click();
    expect(await page.getByTestId("kalender-form-zone").textContent()).toContain("Europe/Berlin");
    expect(await page.getByTestId("kalender-form-beginn").inputValue()).toBe("2026-10-26T09:00");
    await page.getByTestId("kalender-form-beginn").fill("2026-10-25T02:30");
    await page.getByTestId("kalender-profilzeit-klaeren").waitFor();
    expect(await page.getByTestId("kalender-form-speichern").isDisabled()).toBe(true);
    expect(await page.getByTestId("kalender-form-beginn").inputValue()).toBe("2026-10-25T02:30");
    await page.getByTestId("kalender-form-beginn").fill("2026-03-29T02:30");
    expect(await page.getByTestId("kalender-profilzeit-klaeren").textContent()).toContain("fehlt");
    await page.getByTestId("kalender-form-beginn").fill("2026-10-26T09:00");
    await page.getByTestId("kalender-form-speichern").click();
    await page.getByTestId("kalender-formular").waitFor({ state: "hidden" });
    const back = await (
      await page.request.get(`${origin}/api/me/kalender/eintraege/${termin.id}`)
    ).json();
    expect(back.eintrag).toMatchObject({
      zeitzone: "Europe/Berlin",
      beginn: "2026-10-26T08:00:00.000Z",
    });
    expect(fehler).toEqual([]);
  }, 90000);
});
