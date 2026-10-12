// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) — FÄHIGKEITEN IM BROWSER, AM ECHTEN PRODUKT.
// ================================================================================================
//
// Eine Sonde am gebündelten Produkt mit echtem Server, echter Anmeldung und einem FIKTIVEN Konto,
// das der Admin der Suite eigens anlegt. Bedienweg AC09 unter Einstellungen → Persönliche
// Einstellungen → „Meine Assistenz" → „Fähigkeiten":
//   Favorit per Klick speichern → bestätigte Routine per Klick speichern → Neuladen und zweites
//   Gerät (frischer Browserkontext) finden beide wieder → Deaktivieren → der Serverstand folgt.
//
// Keine Transport-Attrappe. Ausgeführt wird hier KEINE Fähigkeit: dieser Bedienweg braucht keine
// Anbieterwirkung, und ein realer Aufruf (AC10) ist eine eigene, freigegebene Probe.
import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Faehigkeit-Kennwort-1";
const FAEHIGKEIT = "wikipedia-suche";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function fiktivesKonto(admin: Page): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `faehigkeit-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: "Fiktiv Fähigkeit", email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await kontext.newPage();
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible().catch(() => false)) {
    await weiter.click();
  }
  return page;
}

/** Einstellungen → Persönliche Einstellungen → „Meine Assistenz" → Abschnitt „Fähigkeiten". */
async function faehigkeitenOeffnen(page: Page): Promise<void> {
  await page.goto("/profil");
  await page.getByTestId("zeile-assistenz").click();
  await expect(page.getByTestId("assistenz-faehigkeiten")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(`faehigkeit-${FAEHIGKEIT}`)).toBeVisible();
}

const zeile = (page: Page, art: "favorit" | "routine") =>
  page.getByTestId(`faehigkeit-vormerkung-${FAEHIGKEIT}-${art}`);

async function serverStand(page: Page): Promise<[string, boolean][]> {
  const r = await page.request.get("/api/me/faehigkeiten");
  expect(r.status()).toBe(200);
  const body = (await r.json()) as {
    vormerkungen: { vormerkung: { faehigkeitId: string; art: string; aktiv: boolean } }[];
  };
  return body.vormerkungen
    .filter((v) => v.vormerkung.faehigkeitId === FAEHIGKEIT)
    .map((v) => [v.vormerkung.art, v.vormerkung.aktiv]);
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Fähigkeiten — ${name}`, {
    body: await page.getByTestId("assistenz-faehigkeiten").screenshot(),
    contentType: "image/png",
  });
}

test("Fähigkeiten · Favorit und bestätigte Routine speichern → wiederfinden (Neuladen, zweites Gerät) → deaktivieren", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const email = await fiktivesKonto(page);
  const p = await anmelden(browser, email);
  // Die Ersteinrichtung ist hier nicht Gegenstand (eigene Sonde): Profil vorab einrichten.
  const start = await p.request.put("/api/me/assistenz", {
    data: { name: "Mia", avatar: "eule", einrichtungAbschliessen: true, fassung: 0 },
  });
  expect(start.status(), await start.text()).toBe(200);

  await faehigkeitenOeffnen(p);
  await expect(p.getByTestId("faehigkeiten-keine-vormerkungen")).toBeVisible();
  await beleg(p, info, "1 ohne Vormerkung");

  // Speichern per Klick.
  await p.getByTestId(`faehigkeit-favorit-${FAEHIGKEIT}`).click();
  await expect(zeile(p, "favorit")).toBeVisible();
  await p.getByTestId(`faehigkeit-routine-${FAEHIGKEIT}`).click();
  await expect(zeile(p, "routine")).toBeVisible();
  await expect(zeile(p, "favorit")).toHaveAttribute("data-aktiv", "true");
  await expect(zeile(p, "routine")).toHaveAttribute("data-aktiv", "true");
  expect(await serverStand(p)).toEqual([
    ["favorit", true],
    ["routine", true],
  ]);
  await beleg(p, info, "2 Favorit und Routine gespeichert");

  // Wiederfinden nach Neuladen …
  await p.reload();
  await faehigkeitenOeffnen(p);
  await expect(zeile(p, "favorit")).toHaveAttribute("data-aktiv", "true");
  await expect(zeile(p, "routine")).toHaveAttribute("data-aktiv", "true");

  // … und auf einem zweiten Gerät (frischer Browserkontext, neue Anmeldung).
  const zwei = await anmelden(browser, email);
  await faehigkeitenOeffnen(zwei);
  await expect(zeile(zwei, "favorit")).toHaveAttribute("data-aktiv", "true");
  await expect(zeile(zwei, "routine")).toHaveAttribute("data-aktiv", "true");
  await beleg(zwei, info, "3 zweites Gerät findet beide");

  // Deaktivieren per Klick.
  await zwei.getByTestId(`faehigkeit-deaktivieren-${FAEHIGKEIT}-routine`).click();
  await expect(zeile(zwei, "routine")).toHaveAttribute("data-aktiv", "false");
  await expect(zeile(zwei, "favorit")).toHaveAttribute("data-aktiv", "false");
  await expect(zwei.getByTestId(`faehigkeit-deaktivieren-${FAEHIGKEIT}-routine`)).toHaveCount(0);
  expect(await serverStand(zwei)).toEqual([
    ["favorit", false],
    ["routine", false],
  ]);
  await beleg(zwei, info, "4 deaktiviert");

  // Das erste Gerät sieht den deaktivierten Stand nach Neuladen.
  await p.reload();
  await faehigkeitenOeffnen(p);
  await expect(zeile(p, "routine")).toHaveAttribute("data-aktiv", "false");

  await zwei.context().close();
  await p.context().close();
});
