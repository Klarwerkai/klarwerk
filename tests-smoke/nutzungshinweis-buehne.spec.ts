import type { Page } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";
import { expect, test } from "./support/nav-diagnose-fixture";

// JOB 3367 R2: Diagnose VOR der Reparatur. Die beiden offenen Zustände sind ausdrücklich
// eingespeiste GET-Antworten; kein erfundener Reset-Endpunkt und kein Löschen des Kontovermerks.
// Der echte Client muss beide Zeitlagen bedienen können. Ein Fehlschlag ist ein Produktbefund,
// der durch eine spätere Bestätigung in ensureLoggedIn NICHT verdeckt werden darf.
const NOTICE = "**/api/auth/notice";
const banner = (page: Page) =>
  page.getByRole("region", {
    name: "Hinweis zur Nutzung dieser Anwendung",
    exact: true,
  });

async function bibliothek(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/start$/);
  await page
    .getByRole("link", { name: /Bibliothek/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/bibliothek$/);
}

async function erfassenKlicken(page: Page): Promise<void> {
  await page.locator('header a[data-kopfband-punkt="erfassen"]').first().click();
}

async function blattSteht(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/erfassen$/);
  await expect(
    page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first(),
  ).toBeVisible();
  await expect(page.locator("[data-navguard-dialog]")).toHaveCount(0);
}

test("Diagnose: offener Nutzungshinweis lässt den Kopfband-Klick navigieren", async ({ page }) => {
  // Vor der Anmeldung ausdrücklich unbestätigt, unabhängig vom geteilten Serverkonto.
  await page.route(NOTICE, async (route) => {
    expect(route.request().method()).toBe("GET");
    const antwort = await route.fetch();
    expect(antwort.status()).toBe(200);
    const data = await antwort.json();
    expect(typeof data.currentVersion).toBe("string");
    await route.fulfill({ json: { currentVersion: data.currentVersion, due: true } });
  });
  await ensureLoggedIn(page);
  await expect(banner(page)).toBeVisible();
  await bibliothek(page);
  await erfassenKlicken(page);
  await blattSteht(page);
  await expect(banner(page)).toBeVisible();
});

test("Diagnose: erst nach dem Kopfband-Klick erscheinender Nutzungshinweis verliert das Ziel nicht", async ({
  page,
}) => {
  let freigeben = () => {};
  const freigabe = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  let antwortWartet = false;
  await page.route(NOTICE, async (route) => {
    expect(route.request().method()).toBe("GET");
    const antwort = await route.fetch();
    expect(antwort.status()).toBe(200);
    const data = await antwort.json();
    expect(typeof data.currentVersion).toBe("string");
    antwortWartet = true;
    await freigabe;
    await route.fulfill({ json: { currentVersion: data.currentVersion, due: true } });
  });
  try {
    await ensureLoggedIn(page);
    await expect.poll(() => antwortWartet).toBe(true);
    await expect(banner(page)).toHaveCount(0);
    await bibliothek(page);
    await erfassenKlicken(page);
    freigeben();
    await expect(banner(page)).toBeVisible();
    await blattSteht(page);
  } finally {
    freigeben();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("Diagnose: serverseitig bestätigter Nutzungshinweis bleibt nach Neuladen erledigt", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  const quittung = await page.request.post("/api/auth/notice");
  expect(quittung.status()).toBe(200);
  expect(await quittung.json()).toMatchObject({ due: false });
  // Neuer Client-Cache: bestätigt den dauerhaften Produktweg, nicht nur die POST-Antwort.
  await page.reload();
  const vermerk = await page.request.get("/api/auth/notice");
  expect(vermerk.status()).toBe(200);
  const data = await vermerk.json();
  expect(data.due).toBe(false);
  expect(data.acknowledgedVersion).toBe(data.currentVersion);
  expect(data.acknowledgedAt).toEqual(expect.any(String));
  await bibliothek(page);
  await expect(banner(page)).toHaveCount(0);
  await erfassenKlicken(page);
  await blattSteht(page);
  await expect(banner(page)).toHaveCount(0);
});
