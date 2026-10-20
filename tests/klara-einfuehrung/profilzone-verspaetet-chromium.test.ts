import { join } from "node:path";
import { chromium } from "playwright";
import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { registerWebStatic } from "../../services/app/src/web-static";
process.env.KLARWERK_SKIP_KEYCHAIN = "1";
it("E16 · verspätetes Tokyo-Profil deutet einen offenen ausgefüllten Berliner Entwurf nicht um", async () => {
  const app = buildApp(buildServices());
  await registerWebStatic(app, join(process.cwd(), "apps/web/dist"));
  const email = "zone-spaet@fiktiv.test";
  const password = "fiktiv-zone-spaet";
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password, name: "Zone Fiktiv" },
      })
    ).statusCode,
  ).toBe(201);
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "de-DE", timezoneId: "Europe/Berlin" });
  const page = await context.newPage();
  let freigeben = () => {};
  const gate = new Promise<void>((r) => {
    freigeben = r;
  });
  try {
    await page.goto(`${origin}/kalender`);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.getByTestId("kalender-neu").waitFor();
    const profil = await (await page.request.get(`${origin}/api/me/assistenz`)).json();
    expect(
      (
        await page.request.put(`${origin}/api/me/assistenz`, {
          data: {
            fassung: profil.profil?.fassung ?? 0,
            einfuehrung: {
              schritt: 1,
              begleitung: "kurz",
              zeitzone: "Asia/Tokyo",
              abgeschlossen: false,
            },
          },
        })
      ).status(),
    ).toBe(200);
    await page.route("**/api/me/assistenz", async (route) => {
      if (route.request().method() === "GET") await gate;
      await route.continue();
    });
    await page.goto(`${origin}/kalender`);
    await page.getByTestId("kalender-neu").click();
    expect(await page.getByTestId("kalender-form-zone").textContent()).toContain("Europe/Berlin");
    await page.getByTestId("kalender-form-titel").fill("Fiktiver unveränderter Entwurf");
    await page.getByTestId("kalender-form-beginn").fill("2026-10-26T09:00");
    await page.getByTestId("kalender-form-ende").fill("2026-10-26T10:00");
    freigeben();
    await page.waitForFunction(
      'document.querySelector("[data-testid=kalender-zone]")?.textContent.includes("Asia/Tokyo")',
    );
    expect(await page.getByTestId("kalender-form-zone").textContent()).toContain("Europe/Berlin");
    expect(await page.getByTestId("kalender-form-beginn").inputValue()).toBe("2026-10-26T09:00");
    expect(await page.getByTestId("kalender-form-ende").inputValue()).toBe("2026-10-26T10:00");
    const antwort = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/api/me/kalender/eintraege"),
    );
    await page.getByTestId("kalender-form-speichern").click();
    const gespeichert = await antwort;
    expect(gespeichert.status()).toBe(201);
    expect((await gespeichert.json()).eintrag).toMatchObject({
      zeitzone: "Europe/Berlin",
      beginn: "2026-10-26T08:00:00.000Z",
      ende: "2026-10-26T09:00:00.000Z",
    });
  } finally {
    freigeben();
    await browser.close();
    await app.close();
  }
}, 90000);
