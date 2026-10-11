// ================================================================================================
// produkt:20261010:poc-wiederherstellung-export — DER BEDIENWEG IM ECHTEN BROWSER.
// ================================================================================================
//
// Der gemountete Prüfstand (`tests/wiederherstellung-export/sicherungsumfang-mounted.test.tsx`)
// misst Text und Zuordnung des Umfangs, `wissenspaket.test.ts` den Inhalt des Pakets. Was nur ein
// echter Browser am echten Server zeigt, misst dieser Lauf:
//
//   B1  Verwaltung → System → Sicherung zeigt „Sicherungsumfang je Bereich" auf Desktop und Telefon,
//       ohne über den Rand zu laufen. Der Smoke-Server hat kein Sicherungsverzeichnis und kein
//       Drillprotokoll — die Assistenzbereiche stehen deshalb ehrlich auf „nicht gemessen", die nicht
//       gebauten (eigene Avatare, Aufgaben) auf „nicht vorhanden".
//   B2  Bibliothek → … → Export → „Wissenspaket": der Klick lädt ein ZIP herunter, das sich außerhalb
//       der Anwendung öffnen lässt (LIESMICH, MANIFEST, Zuordnungstabelle) und keine Adresse trägt.
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { ensureLoggedIn } from "./support/auth";
import { schalteStufe2Ein } from "./support/import-json-kasten";

const KARTE = "/admin?bereich=system&detail=sicherung";
const SICHTFENSTER = [
  { name: "Desktop 1280×800", width: 1280, height: 800 },
  { name: "Telefon 390×844", width: 390, height: 844 },
] as const;

for (const fenster of SICHTFENSTER) {
  test(`PV-01 · Sicherungsumfang je Bereich — ${fenster.name}`, async ({ page }) => {
    await page.setViewportSize({ width: fenster.width, height: fenster.height });
    await ensureLoggedIn(page);
    await schalteStufe2Ein(page);
    await page.goto(KARTE);

    const umfang = page.getByTestId("sicherungsumfang");
    await expect(umfang).toBeVisible({ timeout: 15_000 });
    await expect(umfang.getByTestId("umfang-fassung")).toBeVisible();

    for (const id of ["assistenzprofil", "gespraeche", "gedaechtnis", "sitzungen"]) {
      const bereich = umfang.locator(`[data-bereich="${id}"]`);
      await expect(bereich, `${id} fehlt`).toBeVisible();
      await expect(bereich).toHaveAttribute("data-umfang", "im_dump");
      // Ohne Drillprotokoll gibt es keinen Beleg — auch keinen rückwirkenden.
      await expect(bereich).toHaveAttribute("data-beleg", "nicht_gemessen");
    }
    for (const id of ["eigeneavatare", "aufgaben"]) {
      await expect(umfang.locator(`[data-bereich="${id}"]`)).toHaveAttribute(
        "data-umfang",
        "nicht_vorhanden",
      );
    }
    for (const id of ["avatarmotive", "endgeraet"]) {
      await expect(umfang.locator(`[data-bereich="${id}"]`)).toHaveAttribute(
        "data-umfang",
        "ausgeschlossen",
      );
    }

    const rahmen = await umfang.boundingBox();
    expect(rahmen, "kein Rahmen messbar").not.toBeNull();
    expect((rahmen?.x ?? 0) + (rahmen?.width ?? 0)).toBeLessThanOrEqual(fenster.width + 1);
    const dokumentbreite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(dokumentbreite, "die Seite scrollt waagerecht").toBeLessThanOrEqual(fenster.width + 1);
  });
}

test("PV-01 · Bibliothek → Export → Wissenspaket lädt ein lesbares ZIP herunter", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await page.goto("/bibliothek");
  await expect(page.getByTestId("page-bibliothek")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("bib-liste-menue").click();
  // Das Untermenü ist ein `<summary>` mit vorangestelltem, aria-verborgenem Pfeil „›“ — sein
  // Textinhalt beginnt deshalb NICHT mit „Export“. Gesucht wird die Beschriftung selbst, exakt.
  await page
    .locator('[role="menu"] summary')
    .filter({ has: page.getByText("Export", { exact: true }) })
    .click();
  const link = page.getByTestId("bib-export-paket");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /format=paket/);

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const pfad = await download.path();
  expect(pfad, "der Download hat keine Datei hinterlassen").toBeTruthy();
  const zip = await JSZip.loadAsync(await readFile(String(pfad)));
  for (const datei of ["LIESMICH.md", "MANIFEST.json", "zuordnungen.csv"]) {
    expect(zip.file(datei), `${datei} fehlt im Paket`).not.toBeNull();
  }
  const manifest = (await zip.file("MANIFEST.json")?.async("string")) ?? "";
  expect(JSON.parse(manifest).format).toBe("klarwerk-wissenspaket");
  expect(manifest, "eine Adresse steht im Paket").not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  expect(await zip.file("LIESMICH.md")?.async("string")).toContain("Was nicht drin ist");
});
