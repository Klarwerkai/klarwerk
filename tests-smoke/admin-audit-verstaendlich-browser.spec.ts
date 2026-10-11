import { type Page, expect, test } from "@playwright/test";

import { SMOKE_NAME, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DAS PRÜFPROTOKOLL IM ECHTEN BROWSER.
// ================================================================================================
//
// Geklickt und getippt gegen den echten Smoke-Server, auf dem Desktop UND auf 390 × 844:
//   K1/K3 · die Anmeldung des Smoke-Kontos steht mit NAMEN da — als heute aufgelöster Name
//           gekennzeichnet, weil der Anmeldeeintrag selbst keinen Namen speichert;
//   K2    · der Vorgang heißt nicht `auth.login`; Rohaktion und UTC-Zeitpunkt stehen in den Details,
//           die Spalte zeigt Datum und Uhrzeit mit Zeitzone;
//   K4    · Filter per Tastatur (Fokus, Tab, Enter), Neuladen und Zurück/Vorwärts erhalten ihn;
//   K6    · der Prüfknopf zeigt den Haken nur zusammen mit dem Prüfzeitpunkt.
//
// WAS HIER NICHT GEMESSEN IST: mehrere echte Konten mit verschiedenen Rechten, gelöschte Konten
// und Beiträge in geschlossenen Spaces. Die Smoke-Suite kennt genau ein Konto (Admin) — diese
// Fälle misst `tests/admin-audit-verstaendlich/` am Draht und an der gemounteten Fläche.

const PROTOKOLL = "/admin?bereich=sicherheit&detail=protokoll";

const BILDSCHIRME = [
  { name: "Desktop", viewport: { width: 1280, height: 900 } },
  { name: "390x844", viewport: { width: 390, height: 844 } },
] as const;

async function protokollOeffnen(page: Page): Promise<void> {
  await page.goto(PROTOKOLL);
  await expect(page.getByTestId("detail-pruefprotokoll")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-audit-tabelle]")).toBeVisible({ timeout: 15_000 });
}

for (const bildschirm of BILDSCHIRME) {
  test.describe(`ADMIN-03 · Prüfprotokoll verständlich · ${bildschirm.name}`, () => {
    test("Filter per Tastatur; Namen, Vorgang, Zeitzone; Neuladen und Zurück erhalten den Filter", async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(bildschirm.viewport);
      await ensureLoggedIn(page);
      await protokollOeffnen(page);

      // K4 · Tastatur: Fokus in „Vorgang“, Auswahl, Tab ins nächste Feld, Enter schickt ab.
      const aktion = page.locator("#pruefprotokoll-filter-aktion");
      await aktion.focus();
      await expect(aktion).toBeFocused();
      await aktion.selectOption("auth.login");
      await page.keyboard.press("Tab");
      await expect(page.locator("#pruefprotokoll-filter-ziel")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/a_aktion=auth\.login/, { timeout: 15_000 });

      const zeilen = page.locator("[data-audit-eintrag]");
      await expect(zeilen.first()).toBeVisible({ timeout: 15_000 });
      const anzahl = await zeilen.count();
      expect(anzahl, "keine Anmeldung im Protokoll").toBeGreaterThan(0);
      // Seitenweise: nie mehr als eine Seite auf einmal.
      expect(anzahl).toBeLessThanOrEqual(25);

      // K1/K2/K3 an der jüngsten Anmeldung — der des Smoke-Kontos.
      const zeile = zeilen.first();
      const ereignis = zeile.locator('[data-audit-zeile="audit.detail.event"]');
      await expect(ereignis).not.toHaveText("");
      await expect(ereignis).not.toContainText("auth.login");
      const akteur = zeile.locator('[data-audit-zeile="audit.detail.actor"]');
      await expect(akteur).toContainText(SMOKE_NAME);
      await expect(akteur.locator('[data-audit-herkunft="verzeichnis"]')).toHaveCount(1);
      await expect(zeile.locator("time")).toHaveText(/\d{2}:\d{2}:\d{2}/);
      // Die Details öffnen sich per Tastatur und nennen Rohaktion und UTC-Zeitpunkt.
      await zeile.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(zeile.locator('[data-audit-kennung="action"]')).toHaveText("auth.login");
      await expect(zeile.locator('[data-audit-kennung="at"]')).toHaveText(/Z$/);

      // Jede Zeile der gefilterten Seite ist eine Anmeldung.
      for (let i = 0; i < anzahl; i += 1) {
        await expect(
          zeilen.nth(i).locator('[data-audit-kennung="action"]'),
          `Zeile ${i} ist keine Anmeldung`,
        ).toHaveText("auth.login");
      }

      // K4 · Neuladen erhält den Filter …
      await page.reload();
      await expect(page.locator("#pruefprotokoll-filter-aktion")).toHaveValue("auth.login", {
        timeout: 15_000,
      });
      // … und Zurück/Vorwärts führen durch die Filterstände.
      await page.goBack();
      await expect(page).not.toHaveURL(/a_aktion=/);
      await expect(page.locator("#pruefprotokoll-filter-aktion")).toHaveValue("");
      await page.goForward();
      await expect(page).toHaveURL(/a_aktion=auth\.login/);
      await expect(page.locator("#pruefprotokoll-filter-aktion")).toHaveValue("auth.login");

      // Auf 390 × 844 schiebt die Karte die Seite nicht in die Breite (die Tabelle rollt in sich).
      const ueberstand = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(ueberstand, "die Seite läuft seitlich über").toBeLessThanOrEqual(1);

      // K6 · der Haken erscheint nur mit dem Prüfzeitpunkt.
      await page
        .getByTestId("detail-pruefprotokoll")
        .getByRole("button", { name: /Integrität prüfen|Verify integrity|Integriteit/ })
        .click();
      const ergebnis = page.getByTestId("audit-verify-result");
      await expect(ergebnis).toBeVisible({ timeout: 15_000 });
      await expect(ergebnis).toHaveAttribute("data-tone", "ok");
      await expect(ergebnis).toContainText("✓");
      await expect(ergebnis).toContainText(/\d{2}:\d{2}:\d{2}/);

      await testInfo.attach(`pruefprotokoll-${bildschirm.name}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    });
  });
}
