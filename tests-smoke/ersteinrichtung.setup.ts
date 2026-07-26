// AUFTRAG-mega24 Block A: die Ersteinrichtung bekommt einen EIGENTÜMER.
//
// Die Ersteinrichtung ist eine EINMAL-RESSOURCE des geteilten In-Memory-Servers: sie existiert
// genau ein Mal pro `npm run smoke:ui`. Bis mega23 hatte sie keinen Eigentümer — wer alphabetisch
// zuerst lief, verbrauchte sie nebenbei. Das hatte zwei Folgen, und die zweite ist die schlimmere:
//
//   1. Die Nachzügler fielen auf ein Anmeldeformular, in dem ihr Konto nie angelegt war (der rote
//      Lauf, der mega24 ausgelöst hat). Das ist mit gemeinsamen Zugangsdaten behoben — s.
//      `support/auth.ts`.
//   2. Der Test „Ersteinrichtung legt den Admin an" in `ui-smoke.spec.ts` prüfte die Ersteinrichtung
//      nur dann WIRKLICH, wenn er zufällig als erster lief. Sonst durchlief er still das
//      Anmeldeformular und war grün, ohne je gemessen zu haben, was sein Name behauptet.
//
// Punkt 2 wäre durch gemeinsame Zugangsdaten allein NICHT behoben: der Test wäre wieder grün, aber
// seine BEDEUTUNG hinge weiter an der Dateireihenfolge — dieselbe Falle unter anderem Namen. Genau
// das ist in diesem Auftrag ausgeschlossen.
//
// Deshalb läuft die Ersteinrichtung hier: als Playwright-Setup-Projekt, von dem die drei Engines
// über `dependencies` abhängen. Sie läuft damit GENAU EIN MAL, DETERMINISTISCH ALS ERSTES und gegen
// einen garantiert frischen Server — die Zusicherungen unten dürfen deshalb HART sein (kein
// „falls das Formular da ist"). Danach finden alle Sonden verlässlich das Anmeldeformular vor.
//
// EHRLICHE GRENZE, die hier stehen bleiben soll: die Ersteinrichtung wird damit in EINER Engine
// (Chromium) durchlaufen, nicht in dreien. Das ist kein Verlust — vorher war es faktisch ebenfalls
// nur eine (die erste; die beiden anderen sahen schon das Anmeldeformular), nur unausgesprochen.
import { expect, test } from "@playwright/test";
import { SMOKE_MAIL, SMOKE_NAME, SMOKE_PASS, workspaceMarker } from "./support/auth";

test("Ersteinrichtung legt den Admin an und landet im Arbeitsbereich", async ({ page }) => {
  await page.goto("/");

  // HARTE Zusicherung, kein Zweig: dieses Projekt läuft als erstes gegen einen frischen
  // In-Memory-Server (`reuseExistingServer: false`), also MUSS hier die Ersteinrichtung stehen.
  // Steht stattdessen „Anmelden", ist die Reihenfolge-Garantie gebrochen — und das soll krachen.
  await expect(page.getByRole("heading", { name: "Ersteinrichtung" })).toBeVisible({
    timeout: 15_000,
  });

  // Das Namensfeld gibt es nur im Ersteinrichtungs-/Registrierungs-Formular (AuthScreens.tsx:121-125).
  const nameField = page.locator('form input:not([type="email"]):not([type="password"])');
  await expect(nameField.first()).toBeVisible();
  await nameField.first().fill(SMOKE_NAME);

  await page.locator('input[type="email"]').fill(SMOKE_MAIL);

  // Passwort + Bestätigung (Vertipper-Schutz bei der Konto-Erstellung, AuthScreens.tsx:106-109).
  const pw = page.locator('input[type="password"]');
  const pwCount = await pw.count();
  expect(pwCount).toBeGreaterThan(1);
  for (let i = 0; i < pwCount; i++) {
    await pw.nth(i).fill(SMOKE_PASS);
  }

  await page.locator('button[type="submit"]').click();
  await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });

  // „legt den ADMIN an" — die Behauptung im Testnamen wird auch geprüft, nicht nur gemacht:
  // die Verwaltung rendert nur für Admins (erstes Konto = Admin, service.ts:120-125).
  await page.goto("/admin");
  await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
});
