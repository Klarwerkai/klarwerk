// ================================================================================================
// ADMIN-13 · DIE VIER SCHUTZWEGE IM ECHTEN BROWSER — Desktop und 390 × 844, Tastatur und Rückweg.
// ================================================================================================
//
// Der gemountete Prüfstand (`tests/kundenbetrieb-sicherung/schutzwege-mounted.test.tsx`) misst Text
// und Zuordnung. Was jsdom nicht messen kann, misst dieser Lauf am echten Server und im echten
// Chromium: dass die vier Abschnitte auf dem Telefon nicht über den Rand laufen, dass die Karte mit
// der Tastatur verlassen werden kann und dass der Rückweg in die Übersicht „System" führt.
//
// DER SMOKE-SERVER HAT KEIN SICHERUNGSVERZEICHNIS (kein `BACKUP_DIR`, In-Memory-Bestand). Genau
// das ist hier der gemessene Fall: der Restore-Nachweis steht auf „Unbekannt" — mit Grund und
// nächstem Schritt, nie grün —, und der Satz über den Ort nennt die Vorgabe statt „keine Sicherung".
// Grüne und rote Restore-Befunde misst der gemountete Prüfstand an fiktiven Antworten.
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";
import { schalteStufe2Ein } from "./support/import-json-kasten";

const KARTE = "/admin?bereich=system&detail=sicherung";
const WEGE = ["export", "lauf", "papierkorb", "restore"] as const;
const SICHTFENSTER = [
  { name: "Desktop 1280×800", width: 1280, height: 800 },
  { name: "Telefon 390×844", width: 390, height: 844 },
] as const;

for (const fenster of SICHTFENSTER) {
  test(`ADMIN-13 · Schutzwege in der Sicherungskarte — ${fenster.name}`, async ({ page }) => {
    await page.setViewportSize({ width: fenster.width, height: fenster.height });
    await ensureLoggedIn(page);
    await schalteStufe2Ein(page);
    await page.goto(KARTE);

    const karte = page.getByTestId("detail-sicherung");
    await expect(karte).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("schutzwege")).toBeVisible({ timeout: 15_000 });

    // Vier getrennte Abschnitte, jeder mit Marke — und keiner ragt über das Sichtfenster hinaus.
    for (const weg of WEGE) {
      const abschnitt = page.getByTestId(`schutzweg-${weg}`);
      await expect(abschnitt, `${weg} fehlt`).toBeVisible();
      await expect(abschnitt.getByTestId("weg-zustand")).toBeVisible();
      const rahmen = await abschnitt.boundingBox();
      expect(rahmen, `${weg}: kein Rahmen messbar`).not.toBeNull();
      expect(
        (rahmen?.x ?? 0) + (rahmen?.width ?? 0),
        `${weg} läuft bei ${fenster.width}px über den Rand`,
      ).toBeLessThanOrEqual(fenster.width + 1);
    }
    const dokumentbreite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(dokumentbreite, "die Seite scrollt waagerecht").toBeLessThanOrEqual(fenster.width + 1);

    // Ohne Drillprotokoll: Unbekannt, mit Grund und nächstem Schritt — nie Erfolg.
    const restore = page.getByTestId("schutzweg-restore");
    await expect(restore.getByTestId("weg-zustand")).toHaveAttribute("data-zustand", "unbekannt");
    await expect(restore.getByTestId("weg-grund")).toBeVisible();
    await expect(restore.getByTestId("weg-schritt")).toBeVisible();
    await expect(page.getByTestId("schutzwege-ort")).toBeVisible();

    // Neuladen: dieselbe Karte, derselbe Befund (der Zustand hängt an der Adresse, nicht am Klick).
    await page.reload();
    await expect(page.getByTestId("schutzweg-restore").getByTestId("weg-zustand")).toHaveAttribute(
      "data-zustand",
      "unbekannt",
      { timeout: 15_000 },
    );

    // Rückweg per Tastatur: der Zurück-Knopf der Karte ist fokussierbar und führt nach „System".
    const zurueck = page.getByTestId("detail-sicherung").locator('[data-einst="zurueck"]');
    await zurueck.focus();
    await expect(zurueck).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("detail-sicherung")).toHaveCount(0);
    await expect(page).toHaveURL(/bereich=system/);
    await expect(page.getByTestId("zeile-sicherung")).toBeVisible();
  });
}
