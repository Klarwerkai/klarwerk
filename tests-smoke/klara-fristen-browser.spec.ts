import { type Browser, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Fristen-Smoke-Kennwort-1";
const marke = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
async function eigeneSeite(browser: Browser, admin: Page): Promise<Page> {
  await ensureLoggedIn(admin);
  const email = `fristen-${marke()}@klarwerk.test`;
  const r = await admin.request.post("/api/users", {
    data: { name: "Fristen Probe", email, password: KENNWORT, role: "experte" },
  });
  expect(r.status(), await r.text()).toBe(201);
  const kontext = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 1280, height: 900 },
    timezoneId: "Europe/Berlin",
    locale: "de-DE",
  });
  const p = await kontext.newPage();
  await p.goto("/");
  await p.locator('input[type="email"]').fill(email);
  await p.locator('input[type="password"]').first().fill(KENNWORT);
  await p.locator('button[type="submit"]').click();
  await expect(p.getByTestId("kopfband")).toBeVisible();
  // Das eigene neue Prüfkonto bestätigt den regulären Hinweis, sobald er tatsächlich geladen ist.
  await p.getByTestId("notice-ack").click();
  await expect(p.getByTestId("notice-banner")).toHaveCount(0);
  return p;
}
function datum(tage: number): string {
  const jetzt = new Date();
  jetzt.setUTCDate(jetzt.getUTCDate() + tage);
  return jetzt.toISOString().slice(0, 10);
}
async function oeffnen(p: Page) {
  await p.goto("/kalender");
  await expect(p.getByTestId("page-kalender")).toBeVisible();
  const block = p.getByTestId("klara-fristen");
  await block.getByRole("button", { name: "Fristen aus Informationen", exact: true }).click();
  await expect(block.getByTestId("fristen-bestand")).toBeVisible();
  return block;
}

test("AW19 · konfigurierte Quellen: Vorschau ohne Wirkung, automatische eigene Fristen und manuelle Korrektur am selben Vorgang", async ({
  page,
  browser,
}) => {
  const p = await eigeneSeite(browser, page);
  try {
    const titel = `Synthetische Fristen ${marke()}`;
    const n = await p.request.post("/api/me/klara/notizen", {
      data: {
        vorgang: `fristen-${marke()}`,
        weg: "geschrieben",
        titel,
        inhalt: `Lizenz L-17: Ablaufdatum ${datum(4)}.\nZertifikat Z-8: Ablaufdatum ${datum(5)}.`,
        objektbezug: {
          pfad: "/kalender",
          seitenName: "Mein Kalender",
          objekt: "Synthetischer Fristen-Sollbestand",
        },
      },
    });
    expect(n.status(), await n.text()).toBe(201);
    const block = await oeffnen(p);
    await block.getByText("Eigene Notizen auswählen", { exact: true }).click();
    await block.getByRole("checkbox", { name: titel, exact: true }).check();
    await block
      .getByRole("checkbox", {
        name: "Automatische interne Erfassung für diese Auswahl aktivieren",
        exact: true,
      })
      .check();
    await block.getByRole("button", { name: "Vorschau ohne Speichern", exact: true }).click();
    await expect(block.getByTestId("fristen-vorschau")).toContainText("Lizenz L-17");
    await expect(block.getByTestId("fristen-vorschau")).toContainText("Zertifikat Z-8");
    expect((await (await p.request.get("/api/me/klara/fristen")).json()).fristen).toEqual([]);
    const gespeichert = p.waitForResponse(
      (r) => r.url().endsWith("/api/me/klara/fristen/regel") && r.request().method() === "PUT",
    );
    await block.getByRole("button", { name: "Regel speichern", exact: true }).click();
    expect((await gespeichert).status()).toBe(200);
    await expect(block.locator("article[data-frist-id]")).toHaveCount(2);
    const bestand = await (await p.request.get("/api/me/klara/fristen")).json();
    const lizenz = bestand.fristen.find(
      (f: { objekt: { kennung: string } }) => f.objekt.kennung === "L-17",
    );
    const ereignisse = (await (await p.request.get("/api/me/kalender")).json()).eintraege;
    expect(ereignisse).toHaveLength(2);
    const originalEvent = ereignisse.find((e: { fristId: string }) => e.fristId === lizenz.id);
    const zeile = block.locator(`[data-frist-id="${lizenz.id}"]`);
    await zeile.getByRole("button", { name: "Datum korrigieren", exact: true }).click();
    await zeile.getByLabel("Datum", { exact: true }).fill(datum(12));
    const korrigiert = p.waitForResponse((r) =>
      r.url().endsWith(`/api/me/klara/fristen/${lizenz.id}/aktion`),
    );
    await zeile.getByRole("button", { name: "Manuelle Korrektur speichern", exact: true }).click();
    expect((await korrigiert).status()).toBe(200);
    await expect(block.locator(`[data-frist-id="${lizenz.id}"]`)).toContainText(datum(12));
    await expect(block.locator(`[data-frist-id="${lizenz.id}"]`)).toContainText(
      "Manuell festgelegt",
    );
    const nachher = (await (await p.request.get("/api/me/kalender")).json()).eintraege.find(
      (e: { fristId: string }) => e.fristId === lizenz.id,
    );
    expect(nachher.id).toBe(originalEvent.id);
    expect(nachher.beginn).toBe(datum(12));
    await p.getByTestId("kalender-ansicht-agenda").click();
    const chip = p.locator(`[data-testid="kalender-eintrag"][data-event-id="${originalEvent.id}"]`);
    await expect(chip).toContainText("Aus Information erkannt");
    await expect(chip).toContainText("Manuell festgelegt");
    await chip.click();
    await expect
      .poll(() => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await p
      .getByTestId("kalender-detail-herkunft")
      .getByRole("link", { name: "Belege und Fundstellen" })
      .click();
    await expect(block.locator(`[data-frist-id="${lizenz.id}"]`)).toBeFocused();
    await test.info().attach("AW19 tatsächlicher Kalender und Originalfrist", {
      body: await p.screenshot(),
      contentType: "image/png",
    });
    await block.getByRole("button", { name: "Fristen aus Informationen", exact: true }).click();
    await p.getByTestId("kalender-detail-herkunft").scrollIntoViewIfNeeded();
    await test.info().attach("AW19 derselbe Kalendertermin mit Herkunft und Fristart", {
      body: await p.screenshot(),
      contentType: "image/png",
    });
    await p.reload();
    await expect(
      p.getByTestId("klara-fristen").locator(`[data-frist-id="${lizenz.id}"]`),
    ).toContainText(datum(12));
  } finally {
    await p.context().close();
  }
});

test("AW19 · fehlgeschlagener Abruf wird vom echten leeren Fristenbestand unterschieden", async ({
  page,
  browser,
}) => {
  const p = await eigeneSeite(browser, page);
  try {
    await p.route("**/api/me/klara/fristen", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"SYNTHETISCHER_AUSFALL"}',
      }),
    );
    await p.goto("/kalender");
    const block = p.getByTestId("klara-fristen");
    await block.getByRole("button", { name: "Fristen aus Informationen", exact: true }).click();
    await expect(block.getByRole("alert")).toBeVisible();
    await expect(
      block.getByText("Derzeit keine für dich lesbaren Fristvorgänge.", { exact: true }),
    ).toHaveCount(0);
    await p.unroute("**/api/me/klara/fristen");
    await block.getByRole("button", { name: "Neu laden", exact: true }).click();
    await expect(
      block.getByText("Derzeit keine für dich lesbaren Fristvorgänge.", { exact: true }),
    ).toBeVisible();
    await test.info().attach("AW19 echter leerer Bestand nach kontrolliertem Abruffehler", {
      body: await p.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await p.context().close();
  }
});
