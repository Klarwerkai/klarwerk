// Persönlicher Arbeitsüberblick: echte Anmeldung, Originalobjekte und Weiterbearbeitung am
// gebündelten Produkt. Nur fiktive Daten, eigener isolierter Browserkontext, kein Modell/Office.
import { type Browser, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Ueberblick-Smoke-Kennwort-1";
const marke = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
async function eigeneSeite(browser: Browser, admin: Page): Promise<Page> {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL)
    throw new Error(
      "Für die Überblicksprobe ist eine konfigurierte Browserbasisadresse erforderlich.",
    );
  await ensureLoggedIn(admin);
  const email = `ueberblick-${marke()}@klarwerk.test`;
  const r = await admin.request.post("/api/users", {
    data: { name: "Überblick Probe", email, password: KENNWORT, role: "experte" },
  });
  expect(r.status(), await r.text()).toBe(201);
  const kontext = await browser.newContext({
    baseURL,
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
  if (await p.getByTestId("notice-ack").count()) await p.getByTestId("notice-ack").click();
  return p;
}
async function ueberblick(p: Page) {
  if (!(await p.getByTestId("klara-gespraech").isVisible())) {
    await p.getByTestId("klara-figur").click();
  }
  await expect(p.getByTestId("klara-gespraech")).toHaveAttribute("data-oberflaeche", "minimal");
  const sichtbar = p.getByTestId("klara-funktion-arbeitsueberblick");
  if (!(await sichtbar.isVisible())) {
    await p.getByTestId("klara-menue-knopf").click();
    await p.getByTestId("klara-menue-funktionen").click();
  }
  await expect(sichtbar).toBeVisible();
  const u = sichtbar.getByTestId("klara-arbeitsueberblick");
  const knopf = u.locator('button[aria-expanded="false"]');
  if (await knopf.count()) await knopf.click();
  await expect(u.getByTestId("arbeitsueberblick-aktualisieren")).toBeEnabled();
  return u;
}
async function bild(p: Page, name: string) {
  await test.info().attach(name, { body: await p.screenshot(), contentType: "image/png" });
}

test("Klara 13 · K1-K3: Originalnotiz bearbeiten, Originalaufgabe erledigen und geänderten Termin im Überblick lesen", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const p = await eigeneSeite(browser, page);
  const n = await p.request.post("/api/me/klara/notizen", {
    data: {
      vorgang: `ub-notiz-${marke()}`,
      weg: "geschrieben",
      titel: "Prüfprotokoll P-7",
      inhalt: "Fiktive Prüfung der Werkstatt.",
      objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "Prüfung P-7" },
    },
  });
  expect(n.status(), await n.text()).toBe(201);
  const note = (await n.json()).notiz;
  const a = await p.request.post("/api/me/klara/aufgaben", {
    data: { vorgang: `ub-aufgabe-${marke()}`, weg: "notiz", quelle: { notizId: note.id } },
  });
  expect(a.status(), await a.text()).toBe(201);
  const task = (await a.json()).aufgabe;
  const datum = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const e = await p.request.post("/api/me/klara/erinnerungen", {
    data: {
      vorgang: `ub-termin-${marke()}`,
      titel: "Messung in Halle 7",
      zeitzone: "Europe/Berlin",
      zeitplan: { art: "einmalig", datum, uhrzeit: "09:00" },
    },
  });
  expect(e.status(), await e.text()).toBe(201);
  const reminder = (await e.json()).erinnerung;
  await p.goto("/aufgaben");
  let u = await ueberblick(p);
  const aufgaben = () => u.getByTestId("arbeitsueberblick-aufgaben");
  await expect(aufgaben().getByRole("link", { name: note.titel })).toHaveAttribute(
    "href",
    `/aufgaben?persoenlich=${task.id}`,
  );
  await expect(u.getByTestId("arbeitsueberblick-erinnerungen")).toContainText(
    "09:00 (Europe/Berlin)",
  );
  await u
    .getByTestId("arbeitsueberblick-notizen")
    .getByRole("button", { name: note.titel })
    .click();
  await expect(p.getByTestId("klara-notiz-offen")).toHaveAttribute("data-notiz", note.id);
  await p.getByTestId("klara-notiz-titel").fill("Prüfprotokoll P-7 ergänzt");
  await p.getByTestId("klara-notiz-speichern").click();
  await expect(p.getByTestId("klara-notiz-speichern")).toBeDisabled();
  const gelesen = await p.request.get(`/api/me/klara/notizen/${note.id}`);
  expect((await gelesen.json()).notiz.titel).toBe("Prüfprotokoll P-7 ergänzt");
  await u.getByTestId("arbeitsueberblick-aktualisieren").click();
  await expect(u.getByTestId("arbeitsueberblick-notizen")).toContainText(
    "Prüfprotokoll P-7 ergänzt",
  );
  await bild(p, "Überblick mit Originalobjekten und bearbeiteter Notiz");
  await aufgaben().getByRole("link", { name: note.titel, exact: true }).click();
  await expect(p).toHaveURL(new RegExp(`/aufgaben\\?persoenlich=${task.id}`));
  const zeile = p.getByTestId("aufgaben-persoenlich").locator(`[data-aufgabe="${task.id}"]`);
  await expect(zeile).toBeVisible();
  await zeile.getByTestId("klara-aufgabe-erledigen").click();
  await expect(zeile.getByTestId("klara-aufgabe-status")).toHaveText("Erledigt");
  const zeitNeu = await p.request.put(`/api/me/klara/erinnerungen/${reminder.id}`, {
    data: { fassung: reminder.fassung, zeitplan: { ...reminder.zeitplan, uhrzeit: "11:00" } },
  });
  expect(zeitNeu.status(), await zeitNeu.text()).toBe(200);
  u = await ueberblick(p);
  await u.getByTestId("arbeitsueberblick-aktualisieren").click();
  await expect(aufgaben().getByRole("link")).toHaveCount(0);
  await expect(u.getByTestId("arbeitsueberblick-erinnerungen")).toContainText(
    "11:00 (Europe/Berlin)",
  );
  await u.getByTestId("arbeitsueberblick-erinnerungen").getByRole("link").click();
  await expect(p).toHaveURL(new RegExp(`/aufgaben\\?erinnerung=${reminder.id}`));
  await expect(
    p.getByTestId("aufgaben-erinnerungen").locator(`[data-erinnerung="${reminder.id}"]`),
  ).toBeVisible();
  await bild(p, "Originalerinnerung aus dem Überblick geöffnet");
  await p.context().close();
});

test("Klara 13 · K4: leerer Bestand und absichtlich gestörter Abruf bleiben unterscheidbar", async ({
  page,
  browser,
}) => {
  const p = await eigeneSeite(browser, page);
  await p.goto("/fragen");
  // Kontrollierte Netzwerkstörung einer echten Quelle; kein Live-Ausfall wird behauptet.
  await p.route("**/api/me/klara/aufgaben", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Probe: Abruf nicht verfügbar" }),
    });
  });
  const u = await ueberblick(p);
  const a = u.getByTestId("arbeitsueberblick-aufgaben");
  await expect(a.getByRole("alert")).toBeVisible();
  await expect(a).not.toContainText("Hier liegt derzeit nichts");
  await expect(u.getByTestId("arbeitsueberblick-notizen")).toContainText(
    "Hier liegt derzeit nichts",
  );
  await bild(p, "Abruffehler und echter Leerbestand");
  await p.unroute("**/api/me/klara/aufgaben");
  await u.getByTestId("arbeitsueberblick-aktualisieren").click();
  await expect(a.getByRole("alert")).toHaveCount(0);
  await expect(a).toContainText("Hier liegt derzeit nichts");
  await p.context().close();
});
