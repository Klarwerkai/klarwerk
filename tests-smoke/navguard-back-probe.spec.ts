// AUFTRAG-mega13 Block A, Kante 11: die Kanten des Zurück-Wächters in einem ECHTEN Browser.
//
// Warum überhaupt: der Wächter hängt an drei Dingen, die jsdom nur NACHSPIELT — der Reihenfolge der
// popstate-Listener, dem `history.state.idx` einer echten Sitzungs-History und der Asynchronität der
// Traversierung. jsdom hat sich als brauchbare Attrappe erwiesen (der Fähigkeitsnachweis steht in
// tests/app/navguard-pop-mounted.test.tsx), aber eine Attrappe bleibt eine Attrappe.
//
// BROWSER-STAND (Stand AUFTRAG-mega16 Block B): Firefox und WebKit sind nachinstalliert (Pedis
// ausdrückliche Freigabe), die Sonde läuft über `playwright.smoke.config.ts` in DREI Engines.
//
//   Chromium  6/6 grün
//   Firefox   6/6 grün — kein einziger Unterschied zu Chromium, auch nicht bei history.go(-2),
//             beim schnellen Doppel-Zurück oder in der popstate-Reihenfolge.
//   WebKit    6/6 grün.
//
// ZWEI ÜBERHOLTE STÄNDE, damit niemand die alten Sätze weiterträgt:
//
//  (1) Bis mega14 stand hier, WebKit rendere die App über plain HTTP überhaupt nicht (weiße Seite),
//      Ursache sei `upgrade-insecure-requests` in der CSP, und Kante 11 bleibe für WebKit OFFEN.
//      Das war damals richtig. Seit mega15 setzt das Produkt die Direktive nur noch bei erkanntem
//      HTTPS (services/app/src/security-headers.ts) — WebKit rendert vollständig und kommt bis zum
//      Wächter. Der Satz „WebKit kommt wegen der CSP gar nicht bis zum Wächter" gilt NICHT mehr.
//
//  (2) Danach blieb GENAU EINE rote Kante: Kante 6 (erzwungener Speicherfehler) endete in WebKit
//      auf /erfassen statt auf /capture/frontdoor. mega16 hat die Ursache GEMESSEN statt gedeutet,
//      und sie liegt nicht im Wächter:
//
//        Die App registriert im PROD-Build einen Service Worker (apps/web/src/main.tsx:29-31).
//        Sobald er die Seite kontrolliert, greift Playwrights `page.route` in WebKit nicht mehr —
//        gemessen: Route-Handler feuerte in Chromium zweimal, in WebKit KEIN EINZIGES MAL, während
//        die Anfragen laut Request-Mitschnitt gestellt wurden. Der von `route.abort("failed")`
//        erzwungene Fehler trat in WebKit also nie ein: das Speichern GELANG, und der Wächter
//        navigierte danach völlig korrekt. Ausgeschlossen sind damit alle vier zuvor vermuteten
//        Ursachen — WebKits fetch-Abbruch lehnt sehr wohl ab (gemessen: TypeError „Load failed"),
//        und POP-Restauration, Listener-Reihenfolge und Guard-Registrierung arbeiten in WebKit
//        nachweislich richtig: die anderen fünf Kanten waren schon vorher grün.
//
//      Behoben in `playwright.smoke.config.ts` (`serviceWorkers: "block"`) — NICHT hier durch eine
//      Wartezeit oder einen anderen Selektor. Die Testkörper unten sind unverändert.
//
// Als schmutzige Seite dient die Vordertür (`/capture/frontdoor`): eine echte bewachte Seite mit
// einem verlässlich sichtbaren Feld. Die Erfassen-Seite (`/erfassen`) hält ihr Erzählfeld hinter
// „Weitere Wege" verborgen — sie ist deshalb hier die ZWISCHENstation, nicht der Prüfling.
//
// Aufruf: npm run smoke:ui (erwartet gebautes apps/web/dist).
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.describe.configure({ mode: "serial" });

// AUFTRAG-mega24 Block A: diese Sonde trug bis mega23 ein EIGENES Zugangsdatenpaar
// (`navguard@klarwerk.test`). Da der Smoke-Server nur EINE Ersteinrichtung hat und die alphabetisch
// frühere `mobile-drawer-…`-Sonde sie verbrauchte, wurde dieses Konto nie angelegt: die Anmeldung
// scheiterte an „E-Mail oder Passwort falsch." — nicht am Wächter. Alle Sonden benutzen jetzt EIN
// gemeinsames Konto (`support/auth.ts`), unabhängig von der Dateireihenfolge.

const DIRTY_TEXT = "Dieser Text darf durch Browser-Zurueck NICHT verloren gehen";

/**
 * Die Vorgeschichte muss IN DER APP entstehen (Klicks), nicht über page.goto — ein `goto` lädt das
 * Dokument neu und wäre gar kein POP innerhalb der SPA. Ergebnis: drei echte, vom Router gestempelte
 * Einträge: /start → /erfassen → /capture/frontdoor.
 */
async function trailToFrontDoor(page: Page): Promise<void> {
  await page.goto("/start");
  await page
    .getByRole("link", { name: /Wissen erfassen/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/erfassen$/);
  await page
    .getByRole("link", { name: /Dokument-Editor öffnen/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
}

/**
 * Das Fließtext-Feld der Vordertür, über seinen ZUGÄNGLICHEN NAMEN adressiert
 * (`role="textbox"` + aria-label, RichTextEditor.tsx:1375-1381).
 *
 * Ein Selektor wie `form input` wäre hier falsch und hat in der ersten Fassung dieser Sonde still
 * die TOPBAR-SUCHE getroffen (Topbar.tsx:359 ist das erste <form> im Dokument): das Füllen gelang,
 * die Vordertür blieb aber sauber — und die Sonde hätte „kein Dialog" gemeldet, ohne dass am Wächter
 * etwas falsch war. Darum ein Feld, das es nur auf dieser Seite gibt.
 */
const bodyField = (page: Page) =>
  page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first();

async function makeDirty(page: Page, text = DIRTY_TEXT): Promise<void> {
  await bodyField(page).fill(text);
  await expect(bodyField(page)).toContainText(text);
}

/**
 * Browser-Zurück. Ein Schritt über Playwrights `goBack()` (das ist der Knopf); mehrere Schritte über
 * dieselbe Sitzungs-History-API, die der Knopf beim Langdrücken benutzt. Der blockierte POP wird
 * absichtlich verschluckt — es gibt also keine „fertige Navigation", auf die man warten könnte.
 * Darum wird danach auf den SICHTBAREN Zustand gewartet, nicht auf ein Navigationsereignis.
 */
async function browserBack(page: Page, steps = 1): Promise<void> {
  if (steps === 1) {
    await page.goBack({ timeout: 4000 }).catch(() => null);
  } else {
    await page.evaluate((n) => {
      window.history.go(-n);
    }, steps);
  }
  await page.waitForTimeout(600);
}

async function browserForward(page: Page): Promise<void> {
  await page.goForward({ timeout: 4000 }).catch(() => null);
  await page.waitForTimeout(600);
}

const dialogTitle = (page: Page) => page.getByText("Ungespeicherte Eingabe").first();

test("Kante 10 + 4: Zurück hält die Seite, die Adresszeile stimmt, der Inhalt steht noch", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await trailToFrontDoor(page);
  await makeDirty(page);

  await browserBack(page);

  // Der Dialog ist da …
  await expect(dialogTitle(page)).toBeVisible({ timeout: 5000 });
  // … die Adresszeile zeigt NICHT das blockierte Ziel …
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
  // … und der getippte Titel ist unangetastet: die Seite wurde nie ausgehängt.
  await expect(bodyField(page)).toContainText(DIRTY_TEXT);

  // „Hier bleiben": Ort und Inhalt bleiben, der Dialog geht.
  await page.getByRole("button", { name: "Hier bleiben" }).click();
  await expect(dialogTitle(page)).toBeHidden();
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
  await expect(bodyField(page)).toContainText(DIRTY_TEXT);
});

test('Kante 4: Vorwärts nach „Hier bleiben" funktioniert unverändert', async ({ page }) => {
  await ensureLoggedIn(page);
  await trailToFrontDoor(page);
  await makeDirty(page);

  await browserBack(page);
  await page.getByRole("button", { name: "Hier bleiben" }).click();
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);

  // Zurück fragt weiterhin — diesmal wird bewusst verworfen.
  await browserBack(page);
  await expect(dialogTitle(page)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Verwerfen und wechseln" }).click();
  await expect(page).toHaveURL(/\/erfassen$/);

  // Der Verlauf ist NICHT abgeschnitten: vorwärts geht es zurück auf die Vordertür.
  await browserForward(page);
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
});

test("Kante 2: Mehrfach-Zurück wird mit dem exakten Delta behandelt", async ({ page }) => {
  await ensureLoggedIn(page);
  await trailToFrontDoor(page);
  await makeDirty(page);

  // Zwei Einträge auf einmal: ein pauschales go(1) würde hier auf /erfassen landen.
  await browserBack(page, 2);
  await expect(dialogTitle(page)).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
  await expect(bodyField(page)).toContainText(DIRTY_TEXT);

  // Und „Verwerfen" landet auf dem ursprünglichen Ziel ZWEI Schritte zurück, nicht einem.
  await page.getByRole("button", { name: "Verwerfen und wechseln" }).click();
  await expect(page).toHaveURL(/\/start$/);
});

test("Kante 3: schnelles Doppel-Zurück stapelt keine Dialoge und springt nicht weg", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await trailToFrontDoor(page);
  await makeDirty(page);

  // Zwei Traversierungen ohne Atempause dazwischen — das Rennen, um das es in Kante 3 geht.
  await page.evaluate(() => {
    window.history.back();
    window.history.back();
  });
  await page.waitForTimeout(1000);

  await expect(dialogTitle(page)).toBeVisible({ timeout: 5000 });
  // Genau EIN Dialog.
  expect(await page.getByText("Ungespeicherte Eingabe").count()).toBe(1);
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
  await expect(bodyField(page)).toContainText(DIRTY_TEXT);

  await page.getByRole("button", { name: "Hier bleiben" }).click();
  await expect(dialogTitle(page)).toBeHidden();
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
});

test("Kante 6: Speicherfehler bleibt am Ausgangsort, URL und Verlauf unverändert", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  // Das Speichern des Entwurfs wird hart abgewürgt — der echte Fehlerfall, nicht ein nachgestellter.
  await page.route("**/api/drafts**", (route) => route.abort("failed"));

  await trailToFrontDoor(page);
  await makeDirty(page);
  await browserBack(page);
  await expect(dialogTitle(page)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Entwurf speichern und wechseln" }).click();
  await page.waitForTimeout(2000);

  // Nicht gewechselt, Dialog offen, Inhalt da.
  await expect(page).toHaveURL(/\/capture\/frontdoor$/);
  await expect(dialogTitle(page)).toBeVisible();
  await expect(bodyField(page)).toContainText(DIRTY_TEXT);

  // Und der Wächter ist weiter aktiv: „Verwerfen" wechselt danach noch korrekt.
  await page.getByRole("button", { name: "Verwerfen und wechseln" }).click();
  await expect(page).toHaveURL(/\/erfassen$/);
});

test("Kante 7: zwei aufeinanderfolgende bewachte Seiten übergeben die Zuständigkeit sauber", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await trailToFrontDoor(page);
  await makeDirty(page);

  // Erste bewachte Seite (Vordertür) bewusst verlassen.
  await browserBack(page);
  await page.getByRole("button", { name: "Verwerfen und wechseln" }).click();
  await expect(page).toHaveURL(/\/erfassen$/);

  // Zweite, ANDERE bewachte Seite: die Mobil-Erfassung (eigener Wächter, eigenes Formular).
  // Der Mobil-Umschalter ist ein <button> mit navigate() (Topbar.tsx:402-414), kein Link.
  await page.getByRole("button", { name: /Mobil/ }).first().click();
  await expect(page).toHaveURL(/\/mobile$/);
  // Bewusst `textarea`: das Aussage-Feld des Mobil-Formulars (Mobile.tsx:289). Ein `input`-Selektor
  // träfe wieder zuerst die Topbar-Suche — dieselbe Falle wie oben bei `form input`.
  const mobileField = page.locator("textarea").first();
  await mobileField.fill("Mobil-Eingabe, die ebenfalls nicht verloren gehen darf.");

  await browserBack(page);
  // Der Wächter der ZWEITEN Seite greift — kein veralteter, kein abgemeldeter.
  await expect(dialogTitle(page)).toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/\/mobile$/);
  await page.getByRole("button", { name: "Hier bleiben" }).click();
  await expect(dialogTitle(page)).toBeHidden();

  // Nach dem Leeren blockiert NICHTS mehr (kein Zombie-Wächter).
  await mobileField.fill("");
  await browserBack(page);
  await expect(page).not.toHaveURL(/\/mobile$/);
});
