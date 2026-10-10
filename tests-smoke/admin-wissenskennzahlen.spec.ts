import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-11 · WISSENSKENNZAHLEN IN DER ECHTEN APP — Detailrückweg, Neuladen, Tastatur, 390 px.
// ================================================================================================
//
// produkt:20261009:admin-wissenskennzahlen. Geklickt wird im echten Browser gegen den echten
// Smoke-Server; die Bilder hängen am nativen Bericht. Alle Titel sind erfundene Testdaten, jeder
// Lauf hat eigene Namen.
//
//   Lieferbeleg · /analytics → Handlungsbedarf steht vor den Zeitraumzahlen → „So gezählt“ öffnen →
//                 Zeitraum wählen (Adresse) → Detailliste → „Bearbeiten“ öffnet genau diesen Beitrag →
//                 Zurück: dieselbe Auswahl → „In der Arbeitsliste öffnen“ zeigt denselben Vorgang →
//                 Zurück → Neuladen: Auswahl bleibt.
//   Bedienung   · 390 × 844 und 1280 × 800: ohne Überbreite, Zeitraum und Detailliste per Tastatur
//                 erreichbar, sichtbarer Fokus, hin und zurück.
//
// WAS HIER NICHT GEMESSEN IST: Space- und Teamfilter mit lesbaren Spaces (der Smoke-Bestand hat
// keine; belegt am Draht in `tests/admin-wissenskennzahlen/kennzahlen-api.test.ts`), ein zweites
// Verwaltungskonto und ein unvertrauter Mensch.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

/** Ein Beitrag, der auf seine Prüfung wartet — Handlungsbedarf „Offene Prüfungen“. */
async function zurPruefung(request: APIRequestContext, titel: string): Promise<string> {
  const angelegt = await request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} gilt nur für diese erfundene Prüfung.`,
      type: "best_practice",
    },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return ((await angelegt.json()) as { id: string }).id;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

const karte = (page: Page, schluessel: string) =>
  page.locator(`[data-testid="wkz-kennzahl"][data-schluessel="${schluessel}"]`);

test.describe("ADMIN-11 · Wissenskennzahlen", () => {
  test("Lieferbeleg: Kennzahl → Details → Beitrag → zurück → Arbeitsliste → zurück → neu laden", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const titel = `Pumpe ${marke()} vor Inbetriebnahme entlüften`;
    const ko = await zurPruefung(page.request, titel);

    await page.goto("/analytics");
    await expect(page.getByTestId("wkz")).toBeVisible({ timeout: 15_000 });
    const pruefung = karte(page, "pruefung");
    await expect(pruefung).toHaveAttribute("data-anzeige", "zahl", { timeout: 15_000 });

    // Handlungsbedarf zuerst: die Zeitraumzahlen und der Qualitätswert stehen darunter.
    const oben = await page.getByTestId("wkz-handlungsbedarf").boundingBox();
    const unten = await page.getByTestId("wkz-nutzung").boundingBox();
    expect(oben && unten && oben.y < unten.y, "Handlungsbedarf steht nicht zuerst").toBe(true);
    await expect(page.getByTestId("wkz-stand")).toContainText("Stand");
    await bild(page, "1-kennzahlen-handlungsbedarf");

    // Die Berechnung ist erreichbar: Bedeutung, Grundmenge, Zeitraum, Datenstand.
    await pruefung.getByTestId("wkz-details").click();
    await expect(pruefung.locator("details").first()).toHaveAttribute("open", "");
    await expect(pruefung).toContainText("Grundmenge");
    await expect(pruefung).toContainText("Datenstand");

    // Zeitraum wählen: die Auswahl steht in der Adresse.
    await page.getByTestId("wkz-filter-tage").selectOption("90");
    await expect(page).toHaveURL(/\/analytics\?tage=90$/);
    await expect(karte(page, "fragen")).toBeVisible({ timeout: 15_000 });
    await bild(page, "2-zeitraum-90-tage");

    // Detailliste: der eigene Beitrag steht darin, „Bearbeiten“ öffnet genau ihn.
    await karte(page, "pruefung").getByTestId("wkz-liste").click();
    const eintrag = page.locator(`[data-testid="wkz-eintrag"][data-schluessel="pruefung:${ko}"]`);
    await expect(eintrag).toHaveCount(1, { timeout: 15_000 });
    await expect(eintrag).toContainText(titel);
    await bild(page, "3-detailliste");
    await eintrag.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/wissen/${ko}$`));
    await bild(page, "4-beitrag");

    // Zurück: dieselbe Auswahl.
    await page.goBack();
    await expect(page).toHaveURL(/\/analytics\?tage=90$/);
    await expect(page.getByTestId("wkz-filter-tage")).toHaveValue("90");

    // In die Arbeitsliste: derselbe Vorgang, dort mit derselben Art gefiltert.
    await karte(page, "pruefung").getByTestId("wkz-liste").click();
    await karte(page, "pruefung").getByTestId("wkz-arbeitsliste").click();
    await expect(page).toHaveURL(/\/qualitaetsaufgaben\?typ=pruefung$/);
    const vorgang = page.locator(`[data-testid="qa-zeile"][data-schluessel="pruefung:${ko}"]`);
    await expect(vorgang).toHaveCount(1, { timeout: 15_000 });
    await bild(page, "5-arbeitsliste");
    await page.goBack();
    await expect(page).toHaveURL(/\/analytics\?tage=90$/);

    // Neuladen: Auswahl und Zahl bleiben.
    await page.reload();
    await expect(page.getByTestId("wkz-filter-tage")).toHaveValue("90", { timeout: 15_000 });
    await expect(karte(page, "pruefung")).toHaveAttribute("data-anzeige", "zahl", {
      timeout: 15_000,
    });
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`Bedienung: ${breite} × ${hoehe} — Tastatur, sichtbarer Fokus, hin und zurück`, async ({
      page,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      const titel = `Lager ${marke()} wöchentlich fetten`;
      const ko = await zurPruefung(page.request, titel);

      await page.goto("/analytics?tage=7");
      await expect(karte(page, "pruefung")).toHaveAttribute("data-anzeige", "zahl", {
        timeout: 15_000,
      });
      const ueberbreit = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(ueberbreit, "die Kennzahlen sind breiter als das Fenster").toBe(false);
      await bild(page, `kennzahlen-${breite}`);

      const fokusLage = () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) {
            return null;
          }
          const r = el.getBoundingClientRect();
          return {
            ring: getComputedStyle(el).boxShadow,
            umriss: getComputedStyle(el).outlineStyle,
            imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
          };
        });
      const tabBis = async (ziel: ReturnType<Page["locator"]>, max: number): Promise<boolean> => {
        for (let i = 0; i < max; i += 1) {
          if (await ziel.evaluate((el) => el === document.activeElement)) {
            return true;
          }
          await page.keyboard.press(tab);
        }
        return ziel.evaluate((el) => el === document.activeElement);
      };

      // Per Tab vom Seitenanfang zur Zeitraumauswahl — der Fokus ist sichtbar.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const zeitraum = page.getByTestId("wkz-filter-tage");
      const zeitraumErreicht = await tabBis(zeitraum, 150);
      expect(zeitraumErreicht, "die Zeitraumauswahl ist per Tab nicht erreichbar").toBe(true);
      const fokus = await fokusLage();
      expect(fokus?.imFenster).toBe(true);
      const fokusSichtbar = fokus?.ring !== "none" || fokus?.umriss !== "none";
      expect(fokusSichtbar, "kein sichtbarer Fokus an der Zeitraumauswahl").toBe(true);

      // Weiter zur Detailliste der Prüfungen; Enter klappt sie auf, Tab erreicht „Bearbeiten“.
      const liste = karte(page, "pruefung").getByTestId("wkz-liste");
      expect(await tabBis(liste, 80), "die Detailliste ist per Tab nicht erreichbar").toBe(true);
      await page.keyboard.press("Enter");
      const meine = page.locator(`[data-testid="wkz-eintrag"][data-schluessel="pruefung:${ko}"]`);
      const link = meine.getByRole("link");
      await expect(link).toBeVisible({ timeout: 15_000 });
      expect(await tabBis(link, 400), "„Bearbeiten“ ist per Tab nicht erreichbar").toBe(true);
      expect((await fokusLage())?.imFenster).toBe(true);
      await bild(page, `fokus-bearbeiten-${breite}`);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/wissen/${ko}$`));

      await page.goBack();
      await expect(page).toHaveURL(/\/analytics\?tage=7$/);
      await expect(page.getByTestId("wkz-filter-tage")).toHaveValue("7");
    });
  }
});
