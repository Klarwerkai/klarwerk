import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ADMIN-16 · DEMO UND TESTDATEN GETRENNT VON DER TÄGLICHEN VERWALTUNG — Bedienbeleg in der echten App.
// ================================================================================================
//
// produkt:20261009:admin-demo-diagnose. Geklickt wird im echten Browser gegen den echten
// Smoke-Server; die Bilder hängen am nativen Bericht.
//
//   K1 · Die Startseite der Verwaltung führt Pakete und Testimporte nur unter „Organisation und
//        Betrieb"; „Menschen", „Spaces" und „Qualität" bieten keinen Vorführweg an.
//   K2 · /import zeigt weder Beispiel-/Demopakete noch das Aufräumen von Testdaten.
//   K5 · Der alte Direktlink /import#demopakete landet auf der neuen Karte; Pfad und „Zurück"
//        tragen den Kontext.
//   Gemeinsame Anforderung · 390 × 844 und 1280 × 800: ohne Überbreite, per Tastatur mit sichtbarem
//        Fokus in die Karte und zurück.
//
// DIESE SONDE SCHREIBT NICHTS. Der Smoke-Server teilt EINEN Bestand mit allen Sonden
// (`playwright.smoke.config.ts`, AUFTRAG-163). Laden, Vorschau und begrenztes Entfernen eines
// Demopakets sind deshalb NICHT hier belegt, sondern in einem eigenen, isolierten Bestand:
// `tests/admin-demo-diagnose/betrieb-demo-chromium.test.ts` (Chromium) und
// `tests/admin-demo-diagnose/zwei-pakete-isoliert.test.ts` (zwei Pakete plus unabhängiger Beitrag).
// Auch die Aufräum-Vorschau wird hier nicht ausgelöst.

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function stufe2An(page: Page): Promise<void> {
  // Der Schalter „Erweiterte Module" ist eine lokale Sicht des Admins (`lib/stufe2Storage.ts`);
  // ohne ihn steht /import gar nicht offen.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("kw.stufe2.v1", "1");
    } catch {
      // ohne Speicher bleibt der Schalter aus — dann scheitert der Fall laut an /import
    }
  });
}

test.describe("ADMIN-16 · Betrieb und Demo getrennt", () => {
  test("K1 · Startseite: Vorführwege nur unter „Organisation und Betrieb“", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/admin");
    await expect(page.getByTestId("verwaltung-uebersicht")).toBeVisible({ timeout: 15_000 });
    for (const taeglich of ["menschen", "spaces", "qualitaet"]) {
      await expect(
        page.getByTestId(`gruppe-${taeglich}`).locator('[data-testid^="ziel-vorfuehrdaten"]'),
      ).toHaveCount(0);
    }
    const betrieb = page.getByTestId("gruppe-betrieb");
    await expect(betrieb.getByTestId("ziel-vorfuehrdaten-pakete")).toBeVisible();
    await expect(betrieb.getByTestId("ziel-vorfuehrdaten-testimporte")).toBeVisible();
    await bild(page, "nachher-startseite-betrieb");

    await betrieb.getByTestId("ziel-vorfuehrdaten-pakete").click();
    await expect(page).toHaveURL(/\/admin\?bereich=vorfuehrdaten&detail=pakete$/);
    await expect(page.getByTestId("detail-pakete")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-einst="pfad"]')).toHaveText(
      "Verwaltung › Vorführdaten › Beispiel- und Demopakete",
    );
    await bild(page, "nachher-karte-pakete");

    await page.locator('[data-testid="detail-pakete"] [data-einst="zurueck"]').click();
    await expect(page).toHaveURL(/\/admin\?bereich=vorfuehrdaten$/);
    await expect(page.getByTestId("zeile-testimporte")).toContainText("betrifft alle Importe");
    await bild(page, "nachher-thema-vorfuehrdaten");
  });

  test("K2/K5 · /import ohne Vorführkästen; der alte Anker führt in die Verwaltung", async ({
    page,
  }) => {
    await stufe2An(page);
    await ensureLoggedIn(page);
    await page.goto("/import");
    await expect(page.getByRole("heading", { level: 1, name: "Import & Quellen" })).toBeVisible({
      timeout: 15_000,
    });
    for (const alt of ["Beispielpakete", "Demopakete", "Testdaten aufräumen"]) {
      await expect(page.getByText(alt, { exact: true })).toHaveCount(0);
    }
    await expect(page.locator("#beispielpakete, #demopakete")).toHaveCount(0);
    await bild(page, "nachher-import");

    await page.goto("/import#demopakete");
    await expect(page).toHaveURL(/\/admin\?bereich=vorfuehrdaten&detail=pakete$/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("detail-pakete")).toBeVisible();
  });

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`${breite} × ${hoehe} — Tastatur in die Paketkarte und zurück, ohne Überbreite`, async ({
      page,
      browserName,
    }) => {
      const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
      await page.setViewportSize({ width: breite, height: hoehe });
      await ensureLoggedIn(page);
      await page.goto("/admin?bereich=vorfuehrdaten");
      await expect(page.getByTestId("zeile-demopakete")).toBeVisible({ timeout: 15_000 });

      const ueberbreit = () =>
        page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(await ueberbreit(), "das Thema ist breiter als das Fenster").toBe(false);

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
      await page.getByTestId("reiter-uebersicht").focus();
      await tabBis("zeile-demopakete");
      const lage = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) {
          return null;
        }
        const r = el.getBoundingClientRect();
        return {
          sichtbar: el.matches(":focus-visible"),
          imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
        };
      });
      expect(lage?.sichtbar, "kein :focus-visible auf der Zeile").toBe(true);
      expect(lage?.imFenster, "der Fokus liegt ausserhalb des Fensters").toBe(true);
      await bild(page, `fokus-zeile-pakete-${breite}`);

      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin\?bereich=vorfuehrdaten&detail=pakete$/);
      await expect(page.getByTestId("detail-pakete")).toBeVisible();
      expect(await ueberbreit(), "die Paketkarte ist breiter als das Fenster").toBe(false);
      await bild(page, `karte-pakete-${breite}`);

      await page.locator('[data-testid="detail-pakete"] [data-einst="zurueck"]').focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin\?bereich=vorfuehrdaten$/);
      await expect(page.getByTestId("zeile-demopakete")).toBeVisible();
    });
  }
});
