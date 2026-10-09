import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-01 · DIE VERWALTUNGSÜBERSICHT IN DER ECHTEN APP — Bedienbeleg, Ladefehler, Tastatur.
// ================================================================================================
//
// produkt:20261009:admin-verwaltung-uebersicht. Geklickt wird im echten Browser gegen den echten
// Smoke-Server; die Bilder hängen am nativen Bericht.
//
//   Lieferbeleg · Verwaltung (über das Zahnrad) → offene Prüfung → zurück → Nutzerübergabe →
//                 Vorschau. Die Übergabe wird NICHT ausgeführt; vor und nach der Vorschau ist die
//                 Verantwortung unverändert (vom Server bestätigt).
//   K1          · Der Einstieg öffnet die Übersicht; jede der sieben Gruppen nennt ihren Zweck.
//   K2          · Zähler und Liste dahinter zeigen dieselbe Zahl (Prüfungen, Lücken, Freigaben).
//   K3          · Ein Ladefehler (503) und eine ausstehende Antwort zeigen „nicht abrufbar" bzw.
//                 „wird ermittelt …" — nie eine Null; die übrigen Wege bleiben.
//   K4          · Zurück und Neuladen behalten Thema, Konto und Filter.
//   K6          · 390 × 844 und 1280 × 800: ohne Überbreite, per Tastatur mit sichtbarem Fokusring,
//                 hin und zurück.
//
// WAS HIER NICHT GEMESSEN IST: der Versionswechsel (der eigene Beleg dafür ist
// `tests/ladefehler-alter-tab/admin-bibliothek-chromium.test.ts`, Route /admin), ein zweites Konto
// mit anderen Rechten (die Smoke-Suite kennt genau ein Admin-Konto) und K5 — ein unvertrauter
// Mensch, den keine Sonde ersetzt.
//
// JEDER LAUF HAT SEINE EIGENEN NAMEN; alle Konten und Inhalte sind erfundene Testdaten.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function kontoAnlegen(
  request: APIRequestContext,
  name: string,
  email: string,
): Promise<string> {
  const res = await request.post("/api/users", {
    data: { name, email, password: SMOKE_PASS, role: "experte" },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

/** Ein Beitrag, für den `owner` hauptverantwortlich ist (Autor bleibt das Smoke-Konto). */
async function beitragFuer(request: APIRequestContext, titel: string, owner: string) {
  const angelegt = await request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} wird vor jeder Schicht geprüft.`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const ko = (await angelegt.json()) as { id: string };
  const gesetzt = await request.put(`/api/kos/${ko.id}`, {
    data: { action: "ownership", ownership: { owner } },
  });
  expect(gesetzt.status(), await gesetzt.text()).toBe(200);
  return ko;
}

async function verantwortlich(request: APIRequestContext, koId: string): Promise<string | null> {
  const res = await request.get(`/api/kos/${koId}`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { ownership?: { owner?: string } }).ownership?.owner ?? null;
}

const GRUPPEN = [
  "menschen",
  "spaces",
  "qualitaet",
  "ki",
  "kommunikation",
  "berichte",
  "betrieb",
] as const;

/** Warten, bis ein Zähler eine Antwort hat, und seine Zahl lesen. */
async function zaehler(page: Page, id: string): Promise<number> {
  const zeile = page.getByTestId(`aufgabe-${id}`);
  await expect(zeile).toHaveAttribute("data-art", /^(wert|leer)$/, { timeout: 15_000 });
  const text = (await zeile.locator('[data-einst="wert"]').innerText()).trim();
  const m = /^(\d+)/.exec(text);
  expect(m, `Zähler ${id} trägt keine Zahl: „${text}"`).not.toBeNull();
  // Frisch: „erhoben 10:42:07"; während einer Auffrischung nennt das Zustandsmodell „Stand von …".
  expect(text, `Zähler ${id} nennt keine Erhebungszeit`).toMatch(/(erhoben|Stand von) \d{2}:\d{2}/);
  return Number(m?.[1]);
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

const nutzerZeilen = (page: Page) =>
  page.locator('[data-testid="flaeche-nutzer"] button[data-einst="zeile"]');

test.describe("ADMIN-01 · Verwaltung mit Aufgabenübersicht", () => {
  test("Lieferbeleg: Verwaltung → offene Prüfung → zurück → Nutzerübergabe → Vorschau (K1/K2/K4)", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const paulaName = `Paula ${m}`;
    const noraName = `Nora ${m}`;
    const paula = await kontoAnlegen(page.request, paulaName, `paula-${m}@verwaltung.test`);
    const nora = await kontoAnlegen(page.request, noraName, `nora-${m}@verwaltung.test`);
    const ko = await beitragFuer(page.request, `Lehrdorn ${m}`, paula);

    // K1 · der Einstieg ist der Menüpunkt, nicht eine getippte Adresse.
    await page.goto("/start");
    await page.getByTestId("kopfband-zahnrad").click();
    await page.getByTestId("zahnrad-einstellungen").click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("reiter-uebersicht")).toHaveAttribute("aria-pressed", "true");
    for (const g of GRUPPEN) {
      const gruppe = page.getByTestId(`gruppe-${g}`);
      await expect(gruppe.locator("h3")).not.toBeEmpty();
      await expect(gruppe.locator('[data-einst="zweck"]')).not.toBeEmpty();
    }
    const offen = await zaehler(page, "pruefungen");
    await bild(page, "1-verwaltung-uebersicht");

    // K2 · Zähler → Prüf-Board: dieselbe Zahl.
    await page.getByTestId("aufgabe-pruefungen").click();
    await expect(page).toHaveURL(/\/validierung$/);
    await expect(page.getByTestId("page-validierung")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => page.getByTestId("validation-row").count(), { timeout: 15_000 })
      .toBe(offen);
    await bild(page, "2-offene-pruefung");

    // K4 · Browser-Zurück landet wieder auf der Übersicht.
    await page.goBack();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible();

    // Nutzerübergabe: aus der Gruppe „Menschen und Rechte" in die Kontenliste, Konto öffnen.
    await page.getByTestId("ziel-uebergabe").click();
    await expect(page).toHaveURL(/\/admin\?bereich=konten$/);
    await nutzerZeilen(page).filter({ hasText: paulaName }).click();
    await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("verantwortung-oeffnen").click();
    await expect(page.getByTestId("verantwortung-flaeche")).toBeVisible({ timeout: 15_000 });
    await page
      .locator(`[data-testid="verantwortung-zeile"][data-ko="${ko.id}"]`)
      .getByTestId("verantwortung-auswahl")
      .check();
    await page.getByTestId("verantwortung-ziel").selectOption({ label: noraName });
    await page.getByTestId("verantwortung-zuteilen").click();
    await page.getByTestId("verantwortung-vorschau-holen").click();
    const vorschau = page.getByTestId("verantwortung-vorschau");
    await expect(vorschau).toBeVisible({ timeout: 15_000 });
    await expect(vorschau.locator(`[data-an="${nora}"]`)).toContainText(`${noraName}: 1 Beiträge`);
    await bild(page, "3-nutzeruebergabe-vorschau");
    // Die Vorschau ändert nichts.
    expect(await verantwortlich(page.request, ko.id)).toBe(paula);

    // K4 · Neuladen behält Thema und Konto.
    await page.reload();
    await expect(page).toHaveURL(/bereich=konten&detail=nutzer%3A/);
    await expect(page.getByTestId("detail-nutzer")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("detail-nutzer")).toContainText(paulaName);
    expect(await verantwortlich(page.request, ko.id)).toBe(paula);
  });

  test("K2/K4: Lücken- und Freigabezähler öffnen ihre gefilterte Liste — auch nach Neuladen", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    await page.goto("/admin");
    await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible({ timeout: 15_000 });

    const luecken = await zaehler(page, "luecken");
    await page.getByTestId("aufgabe-luecken").click();
    await expect(page).toHaveURL(/\/risiko\?luecken=offen$/);
    await expect(page.getByTestId("filter-luecken")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => page.getByTestId("luecke-zeile").count(), { timeout: 15_000 })
      .toBe(luecken);
    await page.reload();
    await expect(page.getByTestId("filter-luecken")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => page.getByTestId("luecke-zeile").count(), { timeout: 15_000 })
      .toBe(luecken);
    await bild(page, "luecken-gefiltert");
    await page.goBack();
    await expect(page).toHaveURL(/\/admin$/);

    const wartend = await zaehler(page, "freigaben");
    await page.getByTestId("aufgabe-freigaben").click();
    await expect(page).toHaveURL(/bereich=konten&filter=wartet$/);
    await expect(page.getByTestId("zeile-filter-wartet")).toBeVisible();
    await expect.poll(() => nutzerZeilen(page).count(), { timeout: 15_000 }).toBe(wartend);
    await page.reload();
    await expect(page.getByTestId("zeile-filter-wartet")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => nutzerZeilen(page).count(), { timeout: 15_000 }).toBe(wartend);
    await bild(page, "freigaben-gefiltert");
    await page.getByTestId("knopf-filter-aufheben").click();
    await expect(page).toHaveURL(/\/admin\?bereich=konten$/);
    await expect.poll(() => nutzerZeilen(page).count()).toBeGreaterThanOrEqual(wartend);
  });

  test("K3: Ladefehler und ausstehende Antwort — unbekannt statt null, die Wege bleiben", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    // Die Lücken-Quelle antwortet mit 503, das Prüf-Board hält seine Antwort zurück.
    await page.route("**/api/gaps", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    );
    let freigeben: () => void = () => undefined;
    const gehalten = new Promise<void>((weiter) => {
      freigeben = weiter;
    });
    await page.route("**/api/validation/board", async (route) => {
      await gehalten;
      await route.continue();
    });

    await page.goto("/admin");
    await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible({ timeout: 15_000 });
    const pruefungen = page.getByTestId("aufgabe-pruefungen");
    await expect(pruefungen).toHaveAttribute("data-art", "laedt");
    await expect(pruefungen.locator('[data-einst="wert"]')).toHaveText("wird ermittelt …");
    const luecken = page.getByTestId("aufgabe-luecken");
    await expect(luecken).toHaveAttribute("data-art", "fehler", { timeout: 15_000 });
    await expect(luecken.locator('[data-einst="wert"]')).toHaveText("nicht abrufbar");
    // Die übrigen Zahlen stehen trotzdem.
    await zaehler(page, "freigaben");
    await bild(page, "ladefehler-teilbereich");

    freigeben();
    await zaehler(page, "pruefungen");
    await expect(luecken).toHaveAttribute("data-art", "fehler");

    // Und jede Gruppe bleibt bedienbar.
    for (const g of GRUPPEN) {
      await expect(page.getByTestId(`gruppe-${g}`)).toBeVisible();
    }
    await page.getByTestId("ziel-system").click();
    await expect(page).toHaveURL(/\/admin\?bereich=system$/);
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`K6: ${breite} × ${hoehe} — Tastatur, sichtbarer Fokus, hin und zurück`, async ({
      page,
      browserName,
    }) => {
      // Safari/WebKit führt Links erst mit Option+Tab in die Tabfolge — so bedienen es dort auch
      // Menschen; Chromium und Firefox mit Tab.
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      await page.goto("/admin");
      await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible({ timeout: 15_000 });
      await zaehler(page, "pruefungen");

      const ueberbreit = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(ueberbreit, "die Übersicht ist breiter als das Fenster").toBe(false);
      await bild(page, `uebersicht-${breite}`);

      /** Mit Tab vorwärts, bis das Ziel den Fokus hat — höchstens `max` Schritte. */
      const tabBis = async (testId: string, max = 60): Promise<void> => {
        for (let i = 0; i < max; i += 1) {
          const aktiv = await page.evaluate(
            () => document.activeElement?.getAttribute("data-testid") ?? "",
          );
          if (aktiv === testId) {
            return;
          }
          await page.keyboard.press(tab);
        }
        throw new Error(`${testId} ist per Tab nicht erreichbar`);
      };
      const fokusLage = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) {
            return null;
          }
          const r = el.getBoundingClientRect();
          return {
            ring: getComputedStyle(el).boxShadow,
            sichtbar: el.matches(":focus-visible"),
            imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
          };
        });

      // Von der Übersicht per Tab zur offenen Prüfung — der Fokus ist sichtbar.
      await page.getByTestId("reiter-uebersicht").focus();
      await tabBis("aufgabe-pruefungen");
      const lage = await fokusLage();
      expect(lage?.sichtbar, "kein :focus-visible").toBe(true);
      expect(lage?.ring, "kein sichtbarer Fokusring").not.toBe("none");
      expect(lage?.imFenster, "der Fokus liegt ausserhalb des Fensters").toBe(true);
      await bild(page, `fokus-aufgabe-${breite}`);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/validierung$/);

      // Rückweg: Browser-Zurück, dann per Tastatur in die Nutzerübergabe.
      await page.goBack();
      await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("reiter-uebersicht").focus();
      await tabBis("ziel-uebergabe");
      expect((await fokusLage())?.ring).not.toBe("none");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin\?bereich=konten$/);
      await expect(page.getByTestId("flaeche-nutzer")).toBeVisible({ timeout: 15_000 });

      // Und per Tastatur zurück auf die Übersicht.
      await page.getByTestId("reiter-uebersicht").focus();
      expect((await fokusLage())?.imFenster).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible();
    });
  }
});
