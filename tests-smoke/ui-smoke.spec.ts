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
// benannt, begründet und auf genau einen Test begrenzt; alle übrigen laufen hermetisch im Tor.
//
// AUFTRAG-mega47: hier stand „die übrigen 11". Die Zahl war seit mega24 nicht mehr wahr (der Smoke
// ist seither gewachsen, mega47 hat einen weiteren Fall ergänzt) — eine Prosa-Zahl, die niemand
// nachrechnet, ist genau die Sorte stiller Unwahrheit, die dieses Tor eigentlich fängt. Die
// verbindliche Zusage ist der MENGEN-PIN in `tests/smoke/tor-ausnahme.test.ts`: er zählt die
// tatsächliche Differenz und wird rot, sobald das Tor mehr als diesen einen Test auslässt.
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

// ================================================================================================
// AUFTRAG-mega52 — DIESE SONDE WAR GRÜN, OHNE JE EINE ANTWORT GESEHEN ZU HABEN.
// ================================================================================================
//
// DER BEFUND, in mega52 an der Playwright-Spur erhoben (kein einziger `/api/ask`-Aufruf im ganzen
// Lauf). Der Fall behauptete in seinem eigenen Kommentar: „beide Marker existieren NUR im
// Ergebnisbereich (nicht im statischen Seitentext)." Das stimmte nicht, gleich zweifach:
//
//   1. `getByText("Aus validiertem Wissen")` matcht bei Playwright per Vorgabe TEILZEICHENKETTEN
//      und OHNE Beachtung der Groß-/Kleinschreibung. Der statische Einleitungstext der Seite
//      (`ask.intro`) lautete bis mega52: „Antworten kommen ausschließlich AUS VALIDIERTEM WISSEN
//      — mit Quellen und Vertrauen." Die Zusicherung traf sich selbst. Der Fall war grün, sobald
//      die Seite überhaupt lud.
//   2. Im hermetischen Tor (`smoke:ui:gate`, kein Modell) ist der Fragen-Knopf HART gesperrt
//      (`Ask.tsx` → `disabled={… || !answerAi.available …}`, D-AISTATE PAKET 1) — dasselbe gewollte
//      Produktverhalten wie bei „Mit KI strukturieren". `Enter` sendet dort also nichts, und es
//      KANN im Tor weder Antwort noch Wissenslücke geben. Der Fall konnte sein Versprechen dort
//      nie einlösen, auch nicht im Prinzip.
//
// Aufgefallen ist es erst, als mega52 Block C `ask.intro` auf die Wahrheit zog („ausschließlich
// validiert" stand da, obwohl der Session-Weg nicht validiert-exklusiv filtert). Damit fiel das
// falsche Grün weg — nicht das Produkt.
//
// DIE KORREKTUR ist eine Teilung entlang dem, was jeder Lauf WIRKLICH belegen kann:
//   · Im Tor wird geprüft, was im Tor gilt: ohne Modell ist der Weg gesperrt UND der Grund steht
//     sichtbar da. Das ist eine echte Aussage über das Produkt, kein Ersatzgrün.
//   · Der Antwortweg selbst braucht ein Modell und trägt deshalb `@modell` — exakt die Bauform,
//     die `playwright.smoke.config.ts` für den Erfassungs-Kernfluss schon begründet hat.
// Beide hängen jetzt an `data-testid`-Ankern des Ergebnisbereichs statt an Anzeigetext, der sich
// mit jeder Copy-Runde verschiebt.
test("Fragen ohne Modell: der Weg ist gesperrt und sagt warum", async ({ page }) => {
  await ensureLoggedIn(page);
  await page.goto("/fragen");
  const input = page.getByPlaceholder(/Ventil X/);
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill("Wie stelle ich den Dosierwert an Linie L4 nach Schichtwechsel ein?");

  // Kein stiller deterministischer Fallback, der „KI läuft" vortäuscht: der Knopf ist deaktiviert …
  await expect(page.getByRole("button", { name: /^Fragen$/ })).toBeDisabled();
  // … und der Grund steht als Satz daneben (AiUnavailableHint, `ai.unavailable.hint`).
  await expect(page.getByText(/kein Modell aktiv/i).first()).toBeVisible();
  // … und es entsteht folgerichtig KEIN Ergebnisbereich (weder Antwort noch Lücke).
  await input.press("Enter");
  await expect(page.getByTestId("ask-answer")).toHaveCount(0);
  await expect(page.getByTestId("ask-gap")).toHaveCount(0);
});

test("Fragen antwortet ehrlich (Antwort oder Wissenslücke, nie erfunden) @modell", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await page.goto("/fragen");
  const input = page.getByPlaceholder(/Ventil X/);
  await input.fill("Wie stelle ich den Dosierwert an Linie L4 nach Schichtwechsel ein?");
  await input.press("Enter");
  // Ehrliches Ergebnis: entweder eine quellengebundene Antwort ODER die Wissenslücke. Die Anker
  // sind Testids des Ergebnisbereichs — sie können nicht mehr im statischen Seitentext mitmatchen.
  await expect(page.getByTestId("ask-answer").or(page.getByTestId("ask-gap")).first()).toBeVisible({
    timeout: 20_000,
  });
});

// AUFTRAG-mega47 Block C1 — DER BEWEIS IM ECHTEN BROWSER.
//
// bens Ship-Blocker (sammel44): das mobile Filterblatt lag in seinem EIGENEN inerten Hintergrund.
// `pageRef` umfasste die ganze Seite einschließlich des FacetFilter; beim Öffnen wurde genau dieser
// Root inert — und Dialog, Hintergrundfläche, Schließen-Knopf und alle Filter lagen darin. Im echten
// Browser war das Blatt danach weder fokussierbar noch mit Maus oder Tastatur bedienbar und nicht zu
// schließen: die Seite stand.
//
// WARUM DIESER BELEG HIERHER GEHÖRT UND NICHT IN DIE GEMOUNTETEN TESTS: `inert` wirkt nativ. jsdom
// setzt es nicht durch — ein gemounteter Test kann die STRUKTUR belegen (das tut
// `tests/app/mega47-modale-flaechen-sammler.test.tsx`), aber nicht die WIRKUNG. Playwright kann sie.
//
// BENANNTE GRENZE: dieses Tor läuft gegen einen frischen In-Memory-Server ohne Seed, das Prüf-Board
// ist also leer und die Schiene führt keine Facetten-Optionen. Bedient werden deshalb die
// datenunabhängigen Bedienelemente des Blattes („Alle zurücksetzen", der abschließende Zähler) —
// genau die, die im Fehlerbild tot waren. Die Facetten-Optionen selbst deckt der gemountete Test.
//
// AUFTRAG-mega49 BLOCK A — DIESER FALL MUSS BEIDE DATENLAGEN ÜBERLEBEN, nicht nur die des Tors.
// Bis mega48 tat er das nicht: seine Schlusszeile hing an einem Bedienelement, das es NUR im
// Leerzustand gibt (die ausführliche Begründung steht unten an der Zeile selbst). Er war deshalb
// im hermetischen Tor grün und im vollen Lauf in ALLEN DREI Engines rot — die Engine war nie die
// Ursache, die Datenlage war es. Belegt ist der Fall jetzt in beiden Lagen:
//   · leer   — `npm run smoke:ui:gate`        (frischer Server, kein Seed; so läuft `tools/check`)
//   · gefüllt — `npm run smoke:ui:gate:daten` (derselbe Lauf, aber die Ersteinrichtung lädt vorher
//               über den Produktweg „Demodaten laden" den Demo-Bestand — ohne Modell, ohne Egress)
// Die Facetten-Optionen bleiben auch in der gefüllten Lage ungeprüft: sie existieren nur dort, ein
// Fall, der sie bedient, wäre wieder datenabhängig. Sie deckt der gemountete Test.
test("mega47: Filterblatt auf schmalem Gerät ist wirklich bedienbar", async ({ page }) => {
  // 390×844 liegt unter der Schwelle NARROW_QUERY (≤899px) — der Pfad mit dem Filterblatt.
  await page.setViewportSize({ width: 390, height: 844 });
  await ensureLoggedIn(page);
  await page.goto("/validierung");

  const ausloeser = page.getByRole("button", { name: "Filter", exact: true }).first();
  await expect(ausloeser).toBeVisible({ timeout: 10_000 });
  await ausloeser.click();

  const blatt = page.locator('dialog[aria-modal="true"][aria-label="Filter"]');
  await expect(blatt).toBeVisible({ timeout: 5_000 });

  // Erste Hälfte der Anforderung: das Blatt hat KEINEN inerten Vorfahren.
  expect(await blatt.evaluate((el) => el.closest("[inert]") !== null)).toBe(false);
  // Zweite Hälfte, gleichzeitig: der übrige Seiteninhalt IST inert — der Auslöse-Knopf eingeschlossen.
  // Ohne diese Hälfte wäre die Modalität nur behauptet.
  expect(await ausloeser.evaluate((el) => el.closest("[inert]") !== null)).toBe(true);

  // Und die Wirkung, die nur ein echter Browser zeigt: der Fokus sitzt im Blatt.
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);

  // Das Blatt hängt als GESCHWISTER neben dem inerten Seiten-Container — und damit weiterhin
  // INNERHALB der Shell, nicht am <body>. Das ist der Unterschied zwischen „raus aus dem einen
  // inerten Bereich" und „raus aus allen": läge es am <body>, bliebe es beim offenen
  // Navigations-Drawer als einzige Fläche außerhalb DESSEN inertem Hintergrund erreichbar — genau
  // die Modalitätslücke, die bens mega3-Auflage geschlossen hat.
  expect(await blatt.evaluate((el) => el.closest("main") !== null)).toBe(true);

  // Bedienen — beides sind echte Klicks auf echte Bedienelemente im Blatt.
  await blatt.getByRole("button", { name: "Alle zurücksetzen" }).click();
  await blatt.getByRole("button", { name: /Treffer anzeigen/ }).click();

  // Anwenden schließt das Blatt, der Hintergrund lebt wieder, der Fokus kehrt zum Auslöser zurück.
  await expect(blatt).toBeHidden();
  expect(await page.evaluate(() => document.querySelector("[inert]") !== null)).toBe(false);
  await expect(ausloeser).toBeFocused();

  // Zweiter Weg, den nur ein echter Browser belegt: Escape schließt. Im Fehlerbild konnte der Dialog
  // gar keinen Fokus tragen, der Tastendruck landete am Dokument und das Blatt blieb stehen.
  await ausloeser.click();
  await expect(blatt).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press("Escape");
  await expect(blatt).toBeHidden();

  // Und danach greift eine Aktion auf der Validierungsseite wieder — im Fehlerbild stand hier alles,
  // weil der gesamte Seiteninhalt im inerten Teilbaum lag.
  //
  // AUFTRAG-mega49 BLOCK A — WARUM HIER NICHT MEHR „Zu meinen Aufgaben" STEHT:
  // Bis mega48 klickte diese Zeile auf den Weiterweg aus dem LEERZUSTAND des Prüf-Boards. Dieses
  // Bedienelement stammt aus `lib/emptyStateActions.ts` und wird von `Validation.tsx:557`
  // ausschließlich als `emptyExtra` an `QueryState` gereicht — und `QueryState` (ui.tsx:186-193)
  // rendert diesen Zweig NUR bei leerer Liste. Der Fall war damit an eine Datenlage gebunden:
  // im hermetischen Tor (ohne den `@modell`-Fall) blieb das Board leer und er war grün; im vollen
  // Lauf reicht der erste Fall dieser Datei ein Wissensobjekt ein, das Board ist danach gefüllt,
  // der Knopf existiert nicht mehr — und weil `mode: "serial"` gilt, riss der Timeout sechs
  // weitere Fälle mit, darunter den Browser-Beleg für mega48. Gegen diese Bauform steht jetzt
  // `tests/smoke/mega49-leerzustands-anker-sammler.test.ts`.
  //
  // DAS GEWÄHLTE BEDIENELEMENT und warum es das einzig mögliche ist: der Auslöser des Filterblatts.
  // Er ist nicht deshalb datenunabhängig, weil wir es zweimal gemessen hätten, sondern STRUKTURELL:
  // `FacetFilter` steht in `Validation.tsx:526` NEBEN dem `QueryState` (:553), nicht darin. Alles
  // Übrige der Seite — Herkunfts- und Fokus-Filter, Suchfeld, die Prüfkarten selbst — liegt im
  // Datenzweig und ist im leeren Board gar nicht vorhanden. Der Auslöser ist damit das einzige
  // Bedienelement DIESER SEITE, das in beiden Datenlagen existiert. Genau das gehört hierher: im
  // Fehlerbild lag er mit im inerten Teilbaum und war tot.
  //
  // UND WARUM DAS KEINE WIEDERHOLUNG DER ZEILEN DARÜBER IST: dort wird mit der MAUS geklickt. Hier
  // wird ausschließlich die TASTATUR benutzt — auf dem Fokus, den das Blatt beim Schließen
  // zurückgegeben hat. Das ist der zweite Weg, den nur ein echter Browser belegt: im Fehlerbild
  // konnte der Auslöser den Fokus nicht tragen (inert nimmt ihn), ein Tastendruck landete am
  // Dokument und blieb folgenlos. Sichtbare Folge ist beide Male das Blatt selbst.
  await expect(ausloeser).toBeFocused();
  expect(await ausloeser.getAttribute("aria-expanded")).toBe("false");
  await page.keyboard.press("Enter");
  await expect(blatt).toBeVisible({ timeout: 5_000 });
  expect(await ausloeser.getAttribute("aria-expanded")).toBe("true");

  // Und wieder zu — der Fall hinterlässt keine offene Modalfläche.
  await page.keyboard.press("Escape");
  await expect(blatt).toBeHidden();
  expect(await ausloeser.getAttribute("aria-expanded")).toBe("false");
});

// AUFTRAG-mega48 Block C — DIE MODALGRENZE DER SHELL, IM ECHTEN BROWSER.
//
// bens Ship-Blocker 1 (sammel45): das Filterblatt sperrte nur den SEITEN-Root und behauptete mit
// `aria-modal="true"` trotzdem App-Modalität. Klara (z-40), die Toast-Aktionen (z-[60]) und die per
// Cmd/Ctrl+K global öffenbare Command Palette (z-50) liegen als Geschwister der Seite in der Shell
// und blieben erreichbar. mega48 zieht die Grenze deshalb um die SHELL statt um die Seite.
//
// WARUM DIESER BELEG HIERHER GEHÖRT: `inert` wirkt nativ. jsdom setzt es nicht durch — ein
// gemounteter Test kann die STRUKTUR belegen (das tut der Sammler), aber nicht die WIRKUNG. Hier
// wird sie gemessen: ein Fokus-Versuch auf Klara MUSS scheitern, und das Kürzel der Palette MUSS
// ins Leere laufen. Beide Gegenproben laufen mit: nach dem Schließen geht beides wieder.
//
// BENANNTE GRENZEN DIESES FALLS:
//   · Das Tor-Board ist leer (frischer In-Memory-Server, kein Seed) — echte Facetten-Optionen sind
//     hier nicht bedienbar. Sie deckt der gemountete Test ab. Unverändert gegenüber mega47.
//   · Eine echte TOAST-Aktion lässt sich hier nicht erzeugen: bei offener Modalfläche ist jede
//     Aktion, die einen Toast auslösen würde, gesperrt — das ist genau der Punkt. Belegt wird
//     stattdessen, dass Klara und die Palette im selben gesperrten Bereich liegen wie der
//     Toast-Viewport (eine `ModalRegion` in AppShell); dass ein WIRKLICH erzeugter Toast dort
//     landet, pinnt der gemountete Sammler mit dem echten ToastProvider.
//   · Die dritte Fläche (`ImportSelect`) ist im Tor nicht erreichbar — sie setzt eine
//     Import-Quelle und eine Vorschau voraus, die dieser hermetische Lauf nicht hat. Sie ist
//     gemountet abgedeckt (Sammler, Fall „Import-Auswahl · Filterblatt").
test("mega48: bei offenem Filterblatt ist KEINE Shell-Fläche mehr erreichbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ensureLoggedIn(page);
  await page.goto("/validierung");

  const klara = page.locator('[data-klara="1"]').first();
  const hamburger = page.getByRole("button", { name: "Menü öffnen" });
  const ausloeser = page.getByRole("button", { name: "Filter", exact: true }).first();
  const palette = page.getByPlaceholder(/Zu Seite springen/);

  // Ein Fokus-Versuch auf ein Element: gelingt er? Das ist die Frage, die nur ein echter Browser
  // beantwortet — `inert` nimmt einem Element die Fokussierbarkeit, jsdom tut das nicht.
  const fokusGelingt = (sel: string): Promise<boolean> =>
    page.evaluate((s) => {
      const el = document.querySelector<HTMLElement>(s);
      el?.focus();
      return el !== null && document.activeElement === el;
    }, sel);

  // Ein Klick-Versuch mit kurzer Frist: ein gesperrtes/verdecktes Bedienelement nimmt ihn nicht an.
  const klickGelingt = async (locator: ReturnType<typeof page.locator>): Promise<boolean> => {
    try {
      await locator.click({ timeout: 1500 });
      return true;
    } catch {
      return false;
    }
  };

  // VORBEDINGUNG (Kalibrierung): ohne offenes Blatt ist all das erreichbar. Ohne diesen Schritt
  // wäre der Test auch dann grün, wenn Klara oder die Palette schlicht gar nicht existierten.
  await expect(klara).toBeVisible({ timeout: 10_000 });
  expect(await fokusGelingt('[data-klara="1"]')).toBe(true);
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  await expect(ausloeser).toBeVisible({ timeout: 10_000 });
  await ausloeser.click();
  const blatt = page.locator('dialog[aria-modal="true"][aria-label="Filter"]');
  await expect(blatt).toBeVisible({ timeout: 5_000 });

  // (1) Das Blatt selbst ist frei — und liegt weiterhin INNERHALB von <main>, nicht am <body>.
  expect(await blatt.evaluate((el) => el.closest("[inert]") !== null)).toBe(false);
  expect(await blatt.evaluate((el) => el.closest("main") !== null)).toBe(true);

  // (2) KLARA: gesperrt, nicht fokussierbar, nicht klickbar.
  expect(await klara.evaluate((el) => el.closest("[inert]") !== null)).toBe(true);
  expect(await fokusGelingt('[data-klara="1"]')).toBe(false);
  expect(await klickGelingt(klara)).toBe(false);
  // Der Fokus ist dabei nicht irgendwohin gerutscht, sondern im Dialog geblieben.
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);

  // (3) Die COMMAND PALETTE: ihr Kürzel hängt am Fenster, nicht am DOM — `inert` allein hielte es
  //     nicht auf. Genau deshalb fragt sie die Modalgrenze.
  await page.keyboard.press("Control+k");
  await expect(palette).toBeHidden();

  // (4) Der TOAST-VIEWPORT liegt im selben gesperrten Bereich wie Klara (eine ModalRegion) …
  expect(
    await page.evaluate(() => {
      const k = document.querySelector('[data-klara="1"]')?.closest("[data-modal-region]");
      return k?.hasAttribute("inert") === true;
    }),
  ).toBe(true);

  // (5) … und die TOPBAR ebenfalls: der Hamburger nimmt keinen Klick an, es geht KEIN zweiter
  //     Dialog auf. Das ist die Paarung aus Block C2, von der begehbaren Seite her gesehen:
  //     sie ist nach mega48 gar nicht mehr begehbar.
  expect(await hamburger.evaluate((el) => el.closest("[inert]") !== null)).toBe(true);
  expect(await klickGelingt(hamburger)).toBe(false);
  await expect(page.locator('dialog[aria-label="Navigationsmenü"]')).toHaveCount(0);

  // GEGENPROBE: Blatt zu → alles lebt wieder.
  await page.keyboard.press("Escape");
  await expect(blatt).toBeHidden();
  expect(await page.evaluate(() => document.querySelector("[inert]") !== null)).toBe(false);
  expect(await fokusGelingt('[data-klara="1"]')).toBe(true);
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  // UND DIE ANDERE REIHENFOLGE: Drawer offen → das Filterblatt ist von dort aus unerreichbar.
  await hamburger.click();
  await expect(page.locator('dialog[aria-label="Navigationsmenü"]')).toBeVisible({
    timeout: 5_000,
  });
  expect(await ausloeser.evaluate((el) => el.closest("[inert]") !== null)).toBe(true);
  expect(await klickGelingt(ausloeser)).toBe(false);
  await expect(page.locator('dialog[aria-label="Filter"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator('dialog[aria-label="Navigationsmenü"]')).toBeHidden();
  expect(await page.evaluate(() => document.querySelector("[inert]") !== null)).toBe(false);
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

// WARUM DIESER FALL AM ENDE DER DATEI STEHT UND NICHT NEBEN DEM mega47-FALL, ZU DEM ER GEHÖRT:
// `mode: "serial"` — ein roter Fall überspringt ALLE nachfolgenden. Genau daran ist in dieser
// Runde der Browser-Beleg für mega48 verloren gegangen: er lief nie, weil sechs Zeilen weiter oben
// einer scheiterte. Eine Kalibrierung ist eine Zusatzaussage über den Lauf; sie darf die eigentlichen
// Belege nicht verdecken können. Deshalb steht sie hinter allen von ihnen.
// AUFTRAG-mega49 BLOCK A2 — DIE KALIBRIERUNG DER DATENLAGE.
//
// Ohne diesen Fall wäre „der mega47-Fall ist in BEIDEN Datenlagen grün" eine Behauptung ohne
// Deckung. Denn zweimal grün heißt für sich genommen nur zweimal grün — es heißt NICHT, dass die
// zweite Lage sich von der ersten unterschied. Genau diese Sorte ungedeckter Zusage ist der
// Ausgangspunkt dieses Auftrags gewesen.
//
// Deshalb misst dieser Fall, was der Lauf zu sein behauptet, und zwar an DER Seite, um die es geht:
//   · mit `KLARWERK_SMOKE_SEED=1` MUSS das Prüf-Board Einträge tragen (der Leer-Text ist dann weg)
//   · ohne Seed UND in einem hermetischen Lauf MUSS es leer sein („Keine offenen Objekte.")
// Hörte der Demo-Bestand eines Tages auf, das Prüf-Board zu füllen, wäre `smoke:ui:gate:daten`
// keine zweite Datenlage mehr, sondern eine Wiederholung der ersten — und genau dann wird dieser
// Fall rot, statt dass der mega47-Fall still wieder datenabhängig würde.
//
// AUFTRAG-mega50 BLOCK C — DIE AUFLAGE AUS SHIP 3 (SCRUM-557). Die Kalibrierung war bis hierher
// falsch: sie erwartete den Leerzustand IMMER, wenn kein Seed gesetzt war. Das gilt aber nur in den
// hermetischen Skripten. Im vollen Lauf (`npm run smoke:ui`) läuft der Fall „Kernfluss … @modell"
// als ERSTER und legt selbst ein Objekt aufs Prüf-Board — die Kalibrierung meldete dann in allen
// drei Engines rot, obwohl nichts kaputt war. Kein Seed heißt eben nicht „leer": es heißt nur
// „nicht geseedet".
//
// Der Lauf muss also SAGEN können, dass der @modell-Fall nicht dabei war. Das tut
// `KLARWERK_SMOKE_OHNE_MODELL`, gesetzt in genau den beiden hermetischen Skripten, die den
// Leerzustand überhaupt erwarten dürfen (`smoke:ui:gate`, `smoke:ui:gate:drei` — beide fahren mit
// `--grep-invert @modell`). `smoke:ui:gate:daten` braucht es nicht: dort entscheidet der Seed.
//
// KEIN ZWEIG IM PRÜFLING: die Verzweigung sitzt weiterhin hier, in der Kalibrierung. Der
// mega47-Fall selbst kennt die Datenlage nicht und fragt sie nicht ab — er muss sie überleben.
test("mega49: die Datenlage dieses Laufs ist die zugesagte", async ({ page }) => {
  await ensureLoggedIn(page);
  await page.goto("/validierung");
  // Erst auf die Seite warten, sonst misst man den Ladezustand statt der Datenlage.
  await expect(page.getByRole("heading", { name: "Validierung" }).first()).toBeVisible({
    timeout: 10_000,
  });

  const leerText = page.getByText("Keine offenen Objekte.");
  const geseedet = process.env.KLARWERK_SMOKE_SEED === "1";
  const ohneModell = process.env.KLARWERK_SMOKE_OHNE_MODELL === "1";

  if (geseedet) {
    await expect(leerText).toHaveCount(0);
  } else if (ohneModell) {
    await expect(leerText.first()).toBeVisible({ timeout: 10_000 });
  } else {
    // Der volle Lauf: weder Seed noch Hermetik. Der @modell-Fall lief und hat das Board gefüllt.
    // Hier eine Aussage über den Leerzustand zu treffen wäre keine Kalibrierung, sondern eine Wette
    // auf die Reihenfolge der Fälle — und genau so eine Wette war der Fehlalarm aus Ship 3. Sie
    // wird deshalb NICHT behauptet, und das steht laut im Bericht des Laufs statt still grün zu
    // sein.
    test.info().annotations.push({
      type: "Datenlage",
      description:
        "voller Lauf (kein Seed, kein KLARWERK_SMOKE_OHNE_MODELL): der Leerzustand des " +
        "Prüf-Boards wird bewusst NICHT geprüft — der @modell-Fall füllt es selbst.",
    });
  }
});
