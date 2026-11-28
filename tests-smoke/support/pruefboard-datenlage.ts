import { type Page, expect } from "@playwright/test";
import { holeUeberBrowser } from "./import-json-kasten";

/** Gleiche die sichtbare Warteschlange mit dem ungefilterten Board derselben Browsersitzung ab. */
export async function pruefePruefboardDatenlage(page: Page): Promise<number> {
  await page.goto("/validierung");
  await expect(page.getByTestId("page-validierung")).toBeVisible();
  const antwort = await holeUeberBrowser(page, "/api/validation/board");
  expect(antwort.status, "Prüfboard-Antwort am Browser").toBe(200);
  const daten: unknown = JSON.parse(antwort.rumpf);
  if (!Array.isArray(daten) || !daten.every((zeile) => typeof zeile?.title === "string")) {
    throw new Error("Die Board-Antwort enthält keine Liste von Beiträgen mit Titel.");
  }

  const zeilen = page.getByTestId("validation-row");
  const leer = page.getByText("Keine offenen Objekte.", { exact: true });
  if (daten.length === 0) {
    await expect(leer.first()).toBeVisible();
    await expect(zeilen).toHaveCount(0);
  } else {
    await expect(zeilen.first()).toBeVisible({ timeout: 15_000 });
    const soll = daten.map((zeile) => zeile.title as string).sort();
    await expect
      .poll(async () => (await zeilen.locator('[data-text="titel"]').allTextContents()).sort())
      .toEqual(soll);
    await expect(leer).toHaveCount(0);
  }
  await expect(page.getByText("Lädt …", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Etwas ist schiefgelaufen.", { exact: true })).toHaveCount(0);
  return daten.length;
}
