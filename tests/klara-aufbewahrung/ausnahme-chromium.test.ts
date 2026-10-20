import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { registerWebStatic } from "../../services/app/src/web-static";
process.env.KLARWERK_SKIP_KEYCHAIN = "1";
it("P10 · vorhandene Gedächtnisfläche speichert die begründete UTC-Ausnahme, behält Fehlerinput und beendet sie ausdrücklich", async () => {
  const app = buildApp(buildServices());
  await registerWebStatic(app, join(process.cwd(), "apps/web/dist"));
  const email = "ausnahme-ui@fiktiv.test";
  const password = "fiktiv-ausnahme-ui";
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password, name: "Ausnahme Fiktiv" },
      })
    ).statusCode,
  ).toBe(201);
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "de-DE" });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/profil?bereich=klara`);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    const g = page.getByTestId("klara-setup-gedaechtnis");
    await g.waitFor();
    await g.getByTestId("gedaechtnis-neu").fill("Fiktive befristete Präferenz");
    await g.locator("form select").first().selectOption("30");
    await g.getByRole("button", { name: "Vorliebe merken", exact: true }).click();
    const e = g.getByTestId("gedaechtnis-eintrag");
    await e.waitFor();
    const ausnahme = e.getByTestId("gedaechtnis-ausnahme");
    await ausnahme.getByRole("checkbox").check();
    await ausnahme.locator("textarea").fill("Fiktive private Klärung");
    await ausnahme.getByLabel("Ende der Ausnahme (UTC)", { exact: true }).fill("2099-01-01T12:00");
    await e.getByRole("button", { name: "Änderung speichern" }).click();
    await g.getByRole("alert").waitFor();
    expect(await ausnahme.getByLabel("Ende der Ausnahme (UTC)", { exact: true }).inputValue()).toBe(
      "2099-01-01T12:00",
    );
    expect(await ausnahme.locator("textarea").inputValue()).toBe("Fiktive private Klärung");
    const bis = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 16);
    await ausnahme.getByLabel("Ende der Ausnahme (UTC)", { exact: true }).fill(bis);
    await e.getByRole("button", { name: "Änderung speichern" }).click();
    await g.getByText("Gespeichert. Der Serverstand wurde erneut gelesen.").waitFor();
    await page.reload();
    await e.waitFor();
    expect(await ausnahme.getByRole("checkbox").isChecked()).toBe(true);
    expect(await ausnahme.getByLabel("Ende der Ausnahme (UTC)", { exact: true }).inputValue()).toBe(
      bis,
    );
    expect(await ausnahme.textContent()).toContain("Verantwortlich: Konto");
    const r = await (await page.request.get(`${origin}/api/me/gedaechtnis`)).json();
    expect(r.eintraege[0].aufbewahrungAusnahme.begruendung).toBe("Fiktive private Klärung");
    expect(r.eintraege[0].verfallAm.startsWith(bis)).toBe(true);
    if (process.env.KLARA_E_P10_BELEGE) {
      await mkdir(process.env.KLARA_E_P10_BELEGE, { recursive: true });
      await ausnahme.screenshot({
        path: join(process.env.KLARA_E_P10_BELEGE, "BEGRUENDETE-AUSNAHME.png"),
      });
    }
    await ausnahme.getByRole("checkbox").uncheck();
    await e.getByRole("button", { name: "Änderung speichern" }).click();
    await g.getByText("Gespeichert. Der Serverstand wurde erneut gelesen.").waitFor();
    const beendet = await (await page.request.get(`${origin}/api/me/gedaechtnis`)).json();
    expect(beendet.eintraege[0].aufbewahrungAusnahme).toBe(null);
    expect(beendet.eintraege[0].verfallAm).toBe(beendet.eintraege[0].regulaerVerfallAm);
  } finally {
    await browser.close();
    await app.close();
  }
}, 90000);
