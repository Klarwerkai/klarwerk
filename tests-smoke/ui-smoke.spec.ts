// SCRUM-381: UI-Smoke — der Kernkreislauf einmal durch echte Browser-Klicks.
// Fängt: weiße Seite, kaputtes Bundle, tote Buttons im Hauptweg, kaputtes Routing.
// Bewusst robuste Selektoren (Feldtypen + sichtbare deutsche Texte aus i18n.ts).
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const MAIL = "smoke@klarwerk.test";
const PASS = "smoke-Passwort-1";

// Jeder Test startet mit frischem Browser-Kontext → einloggen, falls das Gate erscheint.
async function ensureLoggedIn(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  if (await pw.count()) {
    // Frischer Server zeigt die Ersteinrichtung (mit Name-Feld) — sonst das Login-Formular.
    const nameField = page.locator('form input:not([type="email"]):not([type="password"])');
    if (await nameField.count()) {
      await nameField.first().fill("Smoke Tester");
    }
    await page.locator('input[type="email"]').fill(MAIL);
    // Ersteinrichtung/Registrierung hat jetzt ein Passwort-Bestätigungsfeld — alle füllen.
    const pwCount = await pw.count();
    for (let i = 0; i < pwCount; i++) {
      await pw.nth(i).fill(PASS);
    }
    await page.locator('button[type="submit"]').click();
  }
  await expect(page.getByText("Wissen erfassen").first()).toBeVisible({ timeout: 15_000 });
}

test("Ersteinrichtung legt den Admin an und landet im Arbeitsbereich", async ({ page }) => {
  await page.goto("/");
  // Frischer In-Memory-Server → Ersteinrichtungs-Formular (Name + E-Mail + Passwort).
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  const textInputs = page.locator('form input:not([type="email"]):not([type="password"])');
  if (await textInputs.count()) {
    await textInputs.first().fill("Smoke Tester");
  }
  await page.locator('input[type="email"]').fill(MAIL);
  // Passwort + Bestätigung (SCRUM: Vertipper-Schutz bei der Account-Erstellung).
  const setupPw = page.locator('input[type="password"]');
  const setupPwCount = await setupPw.count();
  for (let i = 0; i < setupPwCount; i++) {
    await setupPw.nth(i).fill(PASS);
  }
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Wissen erfassen").first()).toBeVisible({ timeout: 15_000 });
});

test("Kernfluss: Erzählen → Wissensseite → Einreichen", async ({ page }) => {
  await ensureLoggedIn(page);
  await page.goto("/erfassen");
  await page
    .locator("textarea")
    .first()
    .fill(
      "Beim Anfahren der Linie L4 nach dem Schichtwechsel den Dosierwert erst nach zehn Minuten " +
        "anpassen, sonst schwankt die Qualität. Vorher Druck am Ventil V2 prüfen.",
    );
  await page.getByRole("button", { name: "Mit KI strukturieren" }).click();
  // Wissensseite (Wizard-Schritt 2) erscheint mit Titel-Feld + Dokument.
  await expect(page.getByText("Wissensseite bearbeiten").first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Prüfen & einreichen →" }).click();
  await expect(page.getByText("Wissensobjekt gespeichert.").first()).toBeVisible({
    timeout: 15_000,
  });
});

test("Fragen antwortet ehrlich (Antwort oder Wissenslücke, nie erfunden)", async ({ page }) => {
  await ensureLoggedIn(page);
  await page.goto("/fragen");
  // Das Frage-Feld ist über seinen Beispiel-Platzhalter eindeutig; Enter sendet das Formular.
  const input = page.getByPlaceholder(/Ventil X/);
  await input.fill("Wie stelle ich den Dosierwert an Linie L4 nach Schichtwechsel ein?");
  await input.press("Enter");
  // Ehrliches Ergebnis: entweder Antwort aus validiertem Wissen ODER Wissenslücken-Rettung —
  // beide Marker existieren NUR im Ergebnisbereich (nicht im statischen Seitentext).
  await expect(
    page.getByText("Aus validiertem Wissen").or(page.getByText("Wissenslücke retten")).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test("Alle Kernrouten rendern (keine weiße Seite)", async ({ page }) => {
  await ensureLoggedIn(page);
  const routes = [
    "/start",
    "/aufgaben",
    "/bibliothek",
    "/extern",
    "/validierung",
    "/konflikte",
    "/risiko",
    "/lebenszyklus",
    "/analytics",
    "/admin",
    "/hilfe",
    "/profil",
  ];
  for (const r of routes) {
    await page.goto(r);
    // Jede Seite hat eine sichtbare Hauptüberschrift — weiße Seite/Crash fällt hier sofort auf.
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  }
});
