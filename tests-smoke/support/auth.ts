// AUFTRAG-mega24 Block A: EINE Anmeldung für die ganze Smoke-Suite.
//
// WARUM ES DIESE DATEI GIBT (der Defekt, den sie schliesst):
// Bis mega23 trug jede der drei Sonden ihr EIGENES Zugangsdatenpaar — `focusprobe@`, `navguard@`,
// `smoke@`. Der Smoke-Server läuft mit In-Memory-Backend: alle Dateien und alle drei Engines teilen
// sich EINEN Datenbestand und damit GENAU EINE Ersteinrichtung. Diese Ersteinrichtung ist eine
// Einmal-Ressource: wer sie zuerst betritt, legt damit das einzige Konto an, und ab da zeigt der
// Server allen anderen das ANMELDEFORMULAR. Die beiden Nachzügler tippten dort Zugangsdaten ein,
// die nie angelegt worden waren, und bekamen „E-Mail oder Passwort falsch." — gemessen in mega24,
// nicht vermutet (Fehlerkontext: heading „Anmelden", eigene Mail im Feld, obige Servermeldung).
//
// Wer „zuerst" war, entschied allein die ALPHABETISCHE Dateireihenfolge: `mobile-drawer-…` steht vor
// `navguard-…` vor `ui-smoke…`. Der Lauf war damit nicht kaputt, weil eine Sonde falsch war — die
// Sonden sind einzeln grün (navguard allein: 6/6) —, sondern weil sie sich um eine Einmal-Ressource
// stritten. Das ist ein Mangel der Vorrichtung, kein Produktfehler.
//
// DIE REPARATUR: alle Sonden benutzen DASSELBE Konto. Wer die Ersteinrichtung vorfindet, legt es an;
// wer das Anmeldeformular vorfindet, meldet sich damit an. Beide Wege enden im selben Zustand, und
// zwar UNABHÄNGIG DAVON, WELCHE DATEI ZUERST LÄUFT — das ist die eigentliche Bedingung, nicht bloss
// „es ist wieder grün".
//
// AUSDRÜCKLICH VERWORFEN: „anmelden, und bei fehlendem Konto über ‚Noch kein Konto? Registrieren‘
// selbst eines anlegen". Dieser Weg KANN nicht funktionieren, und das ist am Produkt nachgelesen,
// nicht geraten: `services/auth/src/service.ts:130` legt selbstregistrierte Konten mit
// `approved: false` an, und `service.ts:141-143` weist deren Anmeldung mit „Konto ist noch nicht
// freigegeben." (NOT_APPROVED) ab. Eine Sonde, die sich selbst registriert, sperrt sich selbst aus.
// Nur das Ersteinrichtungs-Konto ist von Beginn an Admin und freigegeben — und nur als Admin
// rendern die von `ui-smoke` geprüften Verwaltungsrouten überhaupt.
import { type Page, expect } from "@playwright/test";

// Das EINE Konto der Smoke-Suite. Es entsteht in der Ersteinrichtung und ist damit Admin
// (`service.ts:120-125`: erstes Konto = Admin, `approved: true`).
export const SMOKE_NAME = "Smoke Tester";
export const SMOKE_MAIL = "smoke@klarwerk.test";
export const SMOKE_PASS = "smoke-Passwort-1";

/** Der Marker des Arbeitsbereichs: sichtbar genau dann, wenn die Anmeldung durch ist. */
export const workspaceMarker = (page: Page) => page.getByText("Wissen erfassen").first();

/**
 * Bringt die Seite in den angemeldeten Zustand — egal, in welchem der drei möglichen Zustände der
 * Server gerade steht (Ersteinrichtung / Anmeldung / bereits angemeldet).
 *
 * Bewusst KEIN blosses `if (await pw.count())` direkt nach dem `goto` wie in den alten Fassungen:
 * das war ein stiller Wettlauf. Hätte React beim Zählen noch nicht gerendert, wäre `count()` = 0
 * gewesen, die Anmeldung wäre ÜBERSPRUNGEN worden und der Test danach an einer irreführenden
 * Zusicherung gescheitert. Darum wird hier erst gewartet, bis der Server sich entschieden hat.
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto("/");

  const pw = page.locator('input[type="password"]');
  // Warten, bis ENTWEDER ein Formular (Ersteinrichtung/Anmeldung) ODER der Arbeitsbereich steht.
  await expect(pw.first().or(workspaceMarker(page))).toBeVisible({ timeout: 15_000 });

  if (await pw.count()) {
    // Das Namensfeld gibt es NUR bei Ersteinrichtung/Registrierung (AuthScreens.tsx:121-125) —
    // seine Anwesenheit unterscheidet die beiden Formulare.
    const nameField = page.locator('form input:not([type="email"]):not([type="password"])');
    if (await nameField.count()) {
      await nameField.first().fill(SMOKE_NAME);
    }
    await page.locator('input[type="email"]').fill(SMOKE_MAIL);
    // Ersteinrichtung/Registrierung haben ein Bestätigungsfeld (Vertipper-Schutz) — alle füllen.
    const pwCount = await pw.count();
    for (let i = 0; i < pwCount; i++) {
      await pw.nth(i).fill(SMOKE_PASS);
    }
    await page.locator('button[type="submit"]').click();
  }

  await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });
}
