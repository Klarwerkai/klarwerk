// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · der gemeinsame Ablauf der Browserabnahme
// „sichtbare Kennzeichnung über alle Aufrufer, DE/EN, Tastatur und nach Reload" (R-0177/R-1703).
// ================================================================================================
//
// Übernommen aus der Prüfvorbereitung (HILFE/189b55ce…/externe-quellen-browserhilfe.ts) und hier an
// die echten Flächen angeschlossen. Die Regeln des Ablaufs, unverändert:
//   · Bedienung NUR mit echten Tab-/Eingabetasten — kein focus()/click() als Ersatz.
//   · Nach dem Neuladen DERSELBEN Adresse wird derselbe gespeicherte Datensatz erneut erschlossen;
//     es entsteht keine neue Quelle.
//   · Keine `page.route`-Antwort: was angezeigt wird, kommt vom Server.
import { type Locator, type Page, expect, test } from "@playwright/test";

import { stelleSpracheEin } from "./import-json-kasten";

export const KENNZEICHNUNG = {
  de: {
    pruefstand: "extern · nicht peer-validiert",
    stufe: "Stufe 2",
    herkunft: "Extern · ungeprüft",
  },
  en: {
    pruefstand: "external · not peer-validated",
    stufe: "Level 2",
    herkunft: "External · unchecked",
  },
} as const;

export type Sprache = keyof typeof KENNZEICHNUNG;

/** Obergrenze der Tab-Schritte — eine Abbruchbedingung mit Meldung, keine geratene Zahl. */
const MAX_TABS = 400;

/**
 * Drückt Tab, bis der Fokus AUF oder IN `ziel` steht. Der Aufrufer sorgt für den Startpunkt (nach
 * `goto`/`reload` der Dokumentanfang, nach einer Eingabetaste das gerade bediente Element).
 */
export async function tabBisIn(page: Page, ziel: Locator, wofuer: string): Promise<void> {
  await expect(ziel, `${wofuer}: das Ziel ist nicht eindeutig`).toHaveCount(1);
  await expect(ziel, `${wofuer}: das Ziel ist nicht sichtbar`).toBeVisible({ timeout: 15_000 });
  for (let schritt = 0; schritt < MAX_TABS; schritt++) {
    await page.keyboard.press("Tab");
    if (await ziel.evaluate((element) => element.contains(document.activeElement))) {
      return;
    }
  }
  throw new Error(`${wofuer}: nicht innerhalb von ${MAX_TABS} Tab-Schritten erreichbar`);
}

/** Tab bis GENAU auf das Bedienelement, dann die Eingabetaste. */
export async function tabUndEnter(page: Page, ziel: Locator, wofuer: string): Promise<void> {
  await tabBisIn(page, ziel, wofuer);
  await expect(ziel, `${wofuer}: der Fokus steht nicht auf dem Bedienelement`).toBeFocused();
  await page.keyboard.press("Enter");
}

/** Prüfstand, Etikett „Stufe 2" und Herkunfts-Hinweis — sichtbar, an GENAU diesem Eintrag. */
export async function kennzeichnung(eintrag: Locator, sprache: Sprache): Promise<void> {
  const soll = KENNZEICHNUNG[sprache];
  await expect(eintrag).toHaveCount(1);
  await expect(eintrag).toBeVisible();
  await expect(eintrag).toContainText(soll.pruefstand);
  const stufe = eintrag.getByTestId("quelle-stufe2");
  const herkunft = eintrag.getByTestId("quelle-extern-ungeprueft");
  await expect(stufe).toHaveCount(1);
  await expect(stufe).toBeVisible();
  await expect(stufe).toHaveText(soll.stufe);
  await expect(herkunft).toHaveCount(1);
  await expect(herkunft).toBeVisible();
  await expect(herkunft).toHaveText(soll.herkunft);
}

/**
 * Je Sprache: Adresse öffnen, Quellenbereich per Tastatur erschliessen, Kennzeichnung lesen —
 * dann DIESELBE Adresse neu laden und dasselbe noch einmal. Am Ende steht die Sprache wieder auf DE.
 */
export async function pruefeDeEnTastaturReload(
  page: Page,
  url: string,
  erschliesse: (page: Page) => Promise<void>,
  quellen: (page: Page) => Locator[],
): Promise<void> {
  try {
    for (const sprache of ["de", "en"] as const) {
      await test.step(`${sprache}: Tastatur und sichtbare Quellenkennzeichnung`, async () => {
        await stelleSpracheEin(page, sprache);
        await page.goto(url);
        await erschliesse(page);
        for (const quelle of quellen(page)) {
          await kennzeichnung(quelle, sprache);
        }
      });
      await test.step(`${sprache}: dieselbe Quelle nach Reload`, async () => {
        await page.reload();
        await erschliesse(page);
        for (const quelle of quellen(page)) {
          await kennzeichnung(quelle, sprache);
        }
      });
    }
  } finally {
    await stelleSpracheEin(page, "de");
  }
}
