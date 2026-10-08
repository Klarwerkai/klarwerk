// ================================================================================================
// ERSTNUTZER-HÜRDE U3 AM GEBAUTEN BILDSCHIRM — Aufnahme 20260922 · Gesamt-Navigation (R-1813).
// ================================================================================================
//
// `OFFEN.md` U3: „die Navigation ist unübersichtlich und nicht selbsterklärend … und ‚Meine
// Aufgaben' sagt nicht, was es meint." Der Fall stand bis zur Gesamt-Navigation in
// `erstnutzer-u2-u3-browser.spec.ts` (R-1507 / R-1609, JOB 3007) und suchte dort den abgelösten Weg
// „Zahnrad → Weitere Bereiche → Meine Aufgaben". FE-002 hat „Weitere Bereiche" aus dem Zahnrad unter
// das beschriftete „Arbeitsbereiche" im Kopfband geholt, R-0962 den Punkt in „Offene Aufgaben"
// umbenannt. Gemessen wird hier der heutige Weg mit dem heutigen Namen — und dass „Meine Aufgaben"
// auf dem Weg nirgends mehr steht.
//
// WARUM EINE EIGENE DATEI: das Smoke-Tor wählt ganze Dateien. Die U2-Fälle der Nachbardatei gehören
// zu R-1507 und bleiben dort unverändert stehen, samt ihrem Befund (Admin-Satz des
// Entwurfssuchraums gegen Pedis Entscheidung `debbb8e8`, Entwürfe privat) — er ist nicht Teil
// dieses Auftrags und wird hier weder behoben noch verdeckt.
//
// DE ist die Standardsprache des Smoke-Browsers; die Sitzung ist der Admin aus der Ersteinrichtung.
// Ob ein Mensch die Hürde nicht mehr spürt, beantwortet nur ein Nachtest mit Menschen.
import { expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

test("U3 · „Offene Aufgaben“ ist über „Arbeitsbereiche“ erreichbar, und die Seitenhilfe sagt, was gemeint ist", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await page.goto("/start");
  const kopfband = page.getByTestId("kopfband");
  await expect(kopfband).toBeVisible({ timeout: 15_000 });

  // Kein nativer Tooltip an den Kopfband-Punkten: der Name ist die Beschriftung.
  const punkte = kopfband.locator("a.kw-kopfband-punkt");
  await expect(punkte.first()).toBeVisible();
  const attribute = await punkte.evaluateAll((links) =>
    links.map((a) => ({
      href: a.getAttribute("href"),
      title: a.hasAttribute("title"),
      beschrieben: a.hasAttribute("aria-describedby"),
    })),
  );
  for (const a of attribute) {
    expect(a.title, `${a.href} trägt einen Tooltip`).toBe(false);
    expect(a.beschrieben, `${a.href} trägt aria-describedby`).toBe(false);
  }

  // Der Weg: „Arbeitsbereiche“ → „Offene Aufgaben“.
  await page.getByTestId("kopfband-arbeitsbereiche").click();
  const bereiche = page.getByTestId("arbeitsbereiche-menue");
  await expect(bereiche).toBeVisible();
  await expect(bereiche).not.toContainText("Meine Aufgaben");
  const aufgaben = page.getByTestId("bereich-aufgaben");
  await expect(aufgaben).toContainText("Offene Aufgaben");
  await aufgaben.click();
  await expect(page).toHaveURL(/\/aufgaben(?:[?#]|$)/);
  const seite = page.getByTestId("page-aufgaben");
  await expect(seite).toBeVisible({ timeout: 15_000 });
  await expect(seite.getByRole("heading", { level: 1 })).toHaveText("Offene Aufgaben");
  // Der Satz unter der Überschrift sagt ohne Klick, was hier landet (R-0962).
  await expect(seite.getByTestId("page-lead")).toContainText("zurückgegebene Entwürfe");

  // Die Erklärung steht nicht im Sichtfeld, sondern auf Abruf in der Seitenhilfe. Der
  // Routenwechsel hat das Menü geschlossen (`ArbeitsbereicheMenue.tsx`).
  await expect(bereiche).toHaveCount(0);
  await expect(page.getByTestId("seitenhilfe-liste")).toHaveCount(0);
  await page.getByTestId("kopfband-zahnrad").click();
  await page.getByTestId("zahnrad-seitenhilfe").click();
  const hilfe = page.getByTestId("seitenhilfe-liste");
  await expect(hilfe).toBeVisible();
  await expect(hilfe).toContainText("Offene Aufgaben");
  await expect(hilfe).not.toContainText("Meine Aufgaben");
  await expect(hilfe).toContainText("Hier steht die offene Arbeit an einer Stelle");
  await expect(hilfe).toContainText("Nächster Schritt: die oberste Zeile anklicken");
});
