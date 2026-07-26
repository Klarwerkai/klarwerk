// SCRUM-381: UI-Smoke — der Kernkreislauf einmal durch echte Browser-Klicks.
// Fängt: weiße Seite, kaputtes Bundle, tote Buttons im Hauptweg, kaputtes Routing.
// Bewusst robuste Selektoren (Feldtypen + sichtbare deutsche Texte aus i18n.ts).
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.describe.configure({ mode: "serial" });

// AUFTRAG-mega24 Block A: Zugangsdaten und Anmeldung liegen jetzt in `support/auth.ts` — alle drei
// Sonden teilen sich EIN Konto. Vorher trug jede Datei ihr eigenes Paar, und weil der In-Memory-
// Server nur EINE Ersteinrichtung hat, konnte sich nur die alphabetisch erste davon anmelden.
//
// Der frühere erste Test dieser Datei („Ersteinrichtung legt den Admin an und landet im
// Arbeitsbereich") steht nicht mehr hier, sondern in `tests-smoke/ersteinrichtung.setup.ts`. Er ist
// nicht entfallen, sondern umgezogen und dabei STRENGER geworden: als Setup-Projekt läuft er
// garantiert als erstes gegen einen frischen Server und darf die Ersteinrichtung deshalb hart
// zusichern. Hier war er nur so lange echt, wie diese Datei zufällig zuerst lief — sonst durchlief
// er still das Anmeldeformular und war grün, ohne das zu prüfen, was sein Name behauptet.

// AUFTRAG-mega24 Block A, DRITTER Befund — die Marke `@modell` und warum sie nötig ist:
//
// Dieser Test klickt „Mit KI strukturieren". Seit „KI-Ehrlichkeit" (AI-STATE V1-V5, Commit c4a6a5b)
// wird dieser Knopf HART AUSGEGRAUT, wenn kein echtes Modell aktiv ist — statt still in den
// deterministischen Fallback zu laufen und „KI läuft" vorzutäuschen (`lib/aiAvailability.ts:29-49`,
// `Capture.tsx:3904-3906`). Das ist gewolltes, richtiges Produktverhalten.
//
// Folge, gemessen: dieser Test braucht ein ECHTES, aktives Modell. Mit `KLARWERK_SKIP_KEYCHAIN=1`
// — der hermetischen Einstellung, die `tools/test` erzwingt — ist der Knopf `disabled` und der Test
// läuft in den Timeout. Ohne die Variable zieht der Server echte Cloud-Zugangsdaten aus dem
// Schlüsselbund: `npm run smoke:ui` macht dann ECHTE Modell-Läufe und damit echten Egress.
//
// Deshalb die Marke: der Tor-Lauf (`smoke:ui:gate`, hermetisch, in `tools/check`) schliesst genau
// diesen einen Test über `--grep-invert @modell` aus und SAGT DAS LAUT. Der vollständige
// `npm run smoke:ui` fährt ihn mit. Das ist bewusst KEIN stilles Überspringen — die Ausnahme ist
// benannt, begründet und auf genau einen Test begrenzt; die übrigen 11 laufen hermetisch im Tor.
test("Kernfluss: Erzählen → Wissensseite → Einreichen @modell", async ({ page }) => {
  await ensureLoggedIn(page);
  await page.goto("/erfassen");

  // AUFTRAG-mega24 Block A, ZWEITER Befund: dieser Test war seit SCRUM-458 kaputt und hat es nie
  // gemeldet. Die Erfassen-Seite hat inzwischen einen Disclosure-Einstieg (Capture.tsx:3255-3265):
  // der Erzähl-Arbeitsraum ist standardmäßig EINGEKLAPPT, die Vordertür ist der Hauptweg. Das
  // Erzählfeld liegt dadurch zwar im DOM, ist aber UNSICHTBAR — `fill` lief 60 s in den Timeout
  // („element is not visible", in allen drei Engines gemessen).
  //
  // Gesehen hat das niemand, weil der erste Test dieser Datei an der Anmeldung scheiterte und
  // `mode: "serial"` alle nachfolgenden Tests übersprang. Der Anmelde-Defekt hat den hier
  // MASKIERT — ein zweiter Grund, warum ein Tor, das diese Suite nicht fährt, zu wenig sieht.
  //
  // Das ist KEIN Produktfehler: der Weg ist vollständig erreichbar, der Knopf ist sichtbar und
  // korrekt ausgezeichnet. Stale war der Test, der die alte Seitenstruktur unterstellte.
  const disclosure = page.getByRole("button", { name: /Weitere Wege (anzeigen|einklappen)/ });
  await expect(disclosure).toBeVisible({ timeout: 10_000 });
  // Über `aria-expanded` statt über den Beschriftungstext: idempotent, egal in welchem Zustand.
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }

  const narrateField = page.locator("textarea").first();
  await expect(narrateField).toBeVisible({ timeout: 10_000 });
  await narrateField.fill(
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
