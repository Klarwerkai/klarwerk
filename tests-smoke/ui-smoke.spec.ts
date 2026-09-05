// SCRUM-381: UI-Smoke — der Kernkreislauf einmal durch echte Browser-Klicks.
// Fängt: weiße Seite, kaputtes Bundle, tote Buttons im Hauptweg, kaputtes Routing.
// Bewusst robuste Selektoren (Feldtypen + sichtbare deutsche Texte aus i18n.ts).
import { expect, test } from "@playwright/test";
// AUFTRAG-mega59 BLOCK H4: die geteilte Verkehrsmessung — bis hierher zählte im Browser-Smoke kein
// einziger Fall Anfragen, und genau das war die Lücke hinter S1.
import { RUHEFRIST_MS, zaehleAnfragen } from "./support/anfragezaehler";
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
// ------------------------------------------------------------------------------------------------
// JOB 3062 (H3) — DERSELBE KERNFLUSS, AM NEUEN BLATT.
// ------------------------------------------------------------------------------------------------
//
// Seit JOB 3062 ist `/erfassen` das Blatt (`apps/web/src/components/erfassen/Blatt.tsx`): eine
// Werkzeugzeile, ein weisses Blatt mit Titel und Text, zwei Knöpfe. Der Disclosure „Weitere Wege",
// das `textarea` des Erzähl-Arbeitsraums und der Wizard-Schritt „Wissensseite bearbeiten" stehen
// nicht mehr auf der Fläche — der Weg dieses Falls ist deshalb umgezogen, nicht abgeschwächt:
// schreiben → KI ▾ → „Struktur vorschlagen" → „Übernehmen" → Vertraulichkeit → „Einreichen".
//
// DER TITEL BLEIBT WÖRTLICH STEHEN, auch wenn „Wissensseite" jetzt „Blatt" heisst: er ist der
// Schlüssel des Mengen-Pins `tests/smoke/tor-ausnahme.test.ts:59`. Ihn zu schönen hiesse, die
// Ausnahmeliste des Tors anzufassen — das ist keine Aufgabe dieses Falls.
//
// DIE MARKE `@modell` BLEIBT EBENFALLS, und zwar aus dem Grund, der auch schon vorher trug: dieser
// Fall LEGT EIN WISSENSOBJEKT AN. Im hermetischen Tor sichert `ui-smoke.spec.ts` (mega49, s. u.) zu,
// dass das Prüf-Board leer ist; ein eingereichtes Objekt füllt es. Die Marke hält ihn deshalb
// weiterhin aus `smoke:ui:gate` heraus. Was sich geändert hat und hier ehrlich benannt sei: der
// KI-Weg des Blattes ist NICHT mehr hart ausgegraut, wenn kein Modell aktiv ist (`canStructure`
// hängt am Text, nicht an `aiModelUsable`) — der harte Riegel sass am Wizard-Knopf „Mit KI
// strukturieren" in `Capture.tsx`, den dieser Fall nicht mehr betritt.
test("Kernfluss: Erzählen → Wissensseite → Einreichen @modell", async ({ page }) => {
  await ensureLoggedIn(page);
  await page.goto("/erfassen");

  // KALIBRIERUNG: erst wenn das Schreibfeld des Blattes wirklich steht, sagt alles Weitere etwas
  // über das Produkt statt über einen Selektor. Adressiert über den ZUGÄNGLICHEN NAMEN des
  // Fließtextfeldes (`RichTextEditor`, `editor.bodyLabel`) — ein `textarea`-Selektor träfe hier
  // nichts mehr, das Blatt schreibt in ein `contenteditable`.
  const blattText = page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first();
  await expect(blattText).toBeVisible({ timeout: 15_000 });
  await blattText.fill(
    "Beim Anfahren der Linie L4 nach dem Schichtwechsel den Dosierwert erst nach zehn Minuten " +
      "anpassen, sonst schwankt die Qualität. Vorher Druck am Ventil V2 prüfen.",
  );

  // KI ▾ → „Struktur vorschlagen". Der Vorschlag wird NIE automatisch übernommen (Auftrag JOB 3062
  // §5.2): er erscheint als Karte mit „Übernehmen"/„Verwerfen", und erst der Klick wirkt.
  await page.getByTestId("blatt-werkzeug-ki").click();
  await page.getByRole("menuitem", { name: "Struktur vorschlagen" }).click();
  await expect(page.getByTestId("blatt-ki-vorschlag")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();

  // Vertraulichkeit ist Pflicht vor dem Einreichen (§5.4 / §8.5 — Egress).
  await page.getByTestId("blatt-werkzeug-vertraulichkeit").click();
  await page.getByRole("menuitem", { name: "Öffentlich-intern" }).click();

  await page.getByRole("button", { name: "Einreichen", exact: true }).click();
  await expect(page.getByText("Eingereicht:").first()).toBeVisible({ timeout: 20_000 });
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
//
// ================================================================================================
// AUFTRAG-mega58 BLOCK B — WARUM EIN LAUF MIT MODELLSCHLÜSSEL DIESEN FALL NICHT BELEGEN KANN.
// ================================================================================================
//
// DER BEFUND (Ship 6): `npm run smoke:ui` war in allen drei Engines an genau dieser Zeile rot. Das
// Produkt war dabei die ganze Zeit richtig — die VORBEDINGUNG des Falls war es nicht.
//
// Der Fall behauptet in seinem Titel „ohne Modell". Ist im Lauf ein Modell aktiv, ist der Fragen-
// Knopf ZU RECHT bedienbar (`Ask.tsx` → `disabled={… || !answerAi.available …}`), und die Erwartung
// `toBeDisabled()` fällt. Der Fall prüft dann nicht mehr das Produkt, sondern nur noch, ob der Lauf
// zufällig modellfrei war.
//
// UND GENAU DAS IST IM VOLLEN SMOKE NIE DER FALL, nicht bloß manchmal: `playwright.smoke.config.ts`
// bricht einen Nicht-Tor-Lauf OHNE Zugangsdatum absichtlich hart ab („LAUTER ABBRUCH statt stillem
// Rückfall"). Ein `smoke:ui`, das überhaupt bis zu den Tests kommt, trägt also IMMER einen
// Modellschlüssel. Der Fall war dort nicht wackelig, sondern strukturell unerfüllbar.
//
// DIE HÄRTUNG, und sie ist bewusst ein SICHTBARES Überspringen und kein Aufweichen der Erwartung:
//   · Trägt der Lauf einen Modellschlüssel, steigt der Fall mit benanntem Grund aus. Playwright
//     meldet ihn als „skipped" samt Begründung — nie stumm grün.
//   · In den hermetischen Torläufen (`smoke:ui:gate`, `:gate:daten`, `:gate:drei`) erzwingt
//     `package.json` einen LEEREN Schlüssel. Dort läuft der Fall vollständig, und die Sperre wird
//     mit voller Strenge geprüft. Das Tor verliert durch diese Härtung keine einzige Zusicherung.
//
// Die Abfrage steht auf DERSELBEN Variablen, die auch der Smoke-Server liest — nicht auf
// `KLARWERK_SHIP_SMOKE_API_KEY`. Das ist der Unterschied, an dem die Härtung hängt: die Ship-
// Variable bleibt in der Shell auch während eines Torlaufs gesetzt, weitergereicht wird sie dort
// aber nicht. Läge die Abfrage auf ihr, überspränge sich der Fall ausgerechnet im Tor selbst weg.
const MODELLSCHLUESSEL_IM_LAUF = (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;

test("Fragen ohne Modell: der Weg ist gesperrt und sagt warum", async ({ page }) => {
  test.skip(
    MODELLSCHLUESSEL_IM_LAUF,
    "Dieser Lauf traegt einen Modellschluessel: das Modell ist aktiv, der Fragen-Knopf ist zu " +
      "Recht bedienbar, und die Vorbedingung eines modellfreien Laufs ist damit nicht " +
      "herstellbar. Die Sperre wird im hermetischen Tor geprueft: npm run smoke:ui:gate bzw. " +
      "smoke:ui:gate:drei.",
  );
  await ensureLoggedIn(page);
  await page.goto("/fragen");
  // ================================================================================================
  // AUFTRAG-mega59 BLOCK H4 — DIESER FALL PRÜFTE NACH DEM ABSENDEN NUR ABWESENHEITEN.
  // ================================================================================================
  //
  // Nach `press("Enter")` folgten zwei `toHaveCount(0)` auf Zustände, die VORHER schon galten, und
  // ohne jede Frist. Sendet `Enter` durch eine Regression trotz gesperrtem Knopf doch — der Fall
  // wäre grün, weil die Antwort im Moment der Prüfung noch nicht da ist. Eine Abwesenheit im DOM ist
  // keine Aussage über einen VORGANG.
  //
  // Repariert ohne jede Produktänderung: der Verkehr wird gezählt. Das ist genau die Messung, die S1
  // unmittelbar gefangen hätte (dort war das Problem die andere Richtung: nie ein Aufruf, trotzdem
  // grün) — deshalb liegt sie als geteilte Hilfe unter `support/` und nicht als Einzelfall hier.
  const askZaehler = zaehleAnfragen(page, /\/api\/ask/);
  const input = page.getByPlaceholder(/Ventil X/);
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill("Wie stelle ich den Dosierwert an Linie L4 nach Schichtwechsel ein?");

  // Kein stiller deterministischer Fallback, der „KI läuft" vortäuscht: der Knopf ist deaktiviert …
  await expect(page.getByRole("button", { name: /^Fragen$/ })).toBeDisabled();
  // … und der Grund steht als Satz daneben (AiUnavailableHint, `ai.unavailable.hint`).
  await expect(page.getByText(/kein Modell aktiv/i).first()).toBeVisible();
  // … und es entsteht folgerichtig KEIN Ergebnisbereich (weder Antwort noch Lücke).
  await input.press("Enter");
  // DIE EIGENTLICHE ZUSICHERUNG: nach einer festen Ruhefrist ist NICHTS an /api/ask gegangen.
  await askZaehler.ruhefrist(RUHEFRIST_MS);
  expect(
    askZaehler.anzahl(),
    `Enter hat trotz gesperrtem Knopf gesendet: ${askZaehler.adressen().join(", ")}`,
  ).toBe(0);
  // ================================================================================================
  // AUFTRAG-smoketor BLOCK A — EINE ZUSICHERUNG, DIE NICHT SCHEITERN KANN, IST KEINE.
  // ================================================================================================
  //
  // Die beiden `toHaveCount(0)` unten waren bis smoketor STRUKTURELL erfüllt und haben nichts
  // geprüft: `ask-answer` und `ask-gap` stehen im Quelltext an `<Card>` (Ask.tsx:712 und 1080), und
  // `Card` reichte keine Restattribute ans DOM durch. Die beiden Anker existierten damit in KEINEM
  // Zustand der Seite — auch nicht in dem, den dieser Fall ausschließen will. Die Zeilen konnten
  // nicht rot werden, egal was das Produkt tat.
  //
  // Die Durchreichung ist repariert (`apps/web/src/components/ui.tsx`), damit KÖNNEN sie es jetzt.
  // Weil eine Abwesenheit für sich genommen aber nie von „der Selektor greift ohnehin ins Leere" zu
  // unterscheiden ist, wird sie hier KALIBRIERT: `ask-result-anchor` (Ask.tsx:606) ist die immer
  // gemountete Ergebnisfläche an einem echten `<div>`. Findet der Lauf sie, steht fest, dass die
  // Seite geladen, die Ergebnisfläche gemountet ist und `getByTestId` auf dieser Fläche trägt — die
  // beiden Nullen sind dann eine Aussage über den ZUSTAND statt über die Mechanik. Die
  // Gegenrichtung — dass diese beiden Anker überhaupt entstehen KÖNNEN — belegt der @modell-Fall
  // unten, der sie sichtbar erwartet.
  await expect(
    page.getByTestId("ask-result-anchor"),
    "die Ergebnisflaeche ist nicht gemountet — die beiden Nullen darunter waeren dann eine Aussage ueber den Selektor und nicht ueber das Produkt",
  ).toHaveCount(1);
  await expect(page.getByTestId("ask-answer")).toHaveCount(0);
  await expect(page.getByTestId("ask-gap")).toHaveCount(0);
  askZaehler.stoppen();
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

// ==================================================================================================
// AUFTRAG-mega59 BLOCK H1 — DIESER FALL KONNTE GRÜN WERDEN, OHNE ETWAS ZU BELEGEN.
// ==================================================================================================
//
// Sein einziger Anker war `page.locator("h1, h2").first()`. VIER Wege führten damit zu falschem Grün,
// und der erste ist genau der Absturz, den der Name fangen soll:
//
//   1 JEDE Route steckt in einer Fehlergrenze (routes.tsx), deren Karte ein `<h2>` rendert
//     (ErrorBoundary.tsx). Eine abgestürzte Seite hatte also eine sichtbare Überschrift.
//   2 Fehlt der Eintrag in `PAGES`, rendert `PlaceholderPage` ein `<h1>` mit DEMSELBEN Titel wie die
//     echte Seite — eine nie gebaute Seite war nicht von einer gebauten zu unterscheiden.
//   3 Ein Rollen-Gate leitet auf `/start` um (routes.tsx), und `/start` hat eine `h1`.
//   4 Der Auffangpfad `*` tut dasselbe — ein TIPPFEHLER in der Routenliste wäre grün gewesen.
//
// DIE REPARATUR schließt alle vier, und zwar mit zwei Zusicherungen statt einer:
//   · `toHaveURL` schließt Loch 3 und 4 sofort: wer umgeleitet wurde, steht nicht mehr auf seiner
//     Route. Das kostet keine Produktänderung und ist die stärkere der beiden Aussagen.
//   · ein NAMENTLICHER Anker je Seite (`page-<schlüssel>`, gesetzt an `PageHeader`) schließt 1 und 2:
//     weder die Fehlerkarte noch `PlaceholderPage` rendern einen `PageHeader`, sie können ihn also
//     nicht liefern. Ein Titel genügt dafür nicht — deswegen ist es eine Kennung.
//
// Der Nachweis, dass die neue Fassung den alten hohlen Zustand ERKENNT, steht im Bericht: mit einer
// absichtlich fehlerhaften Route (Eintrag aus `PAGES` entfernt bzw. Route verschrieben) wird sie rot,
// wo die alte Fassung grün blieb.
const KERNROUTEN: ReadonlyArray<{ pfad: string; schluessel: string }> = [
  { pfad: "/start", schluessel: "start" },
  { pfad: "/aufgaben", schluessel: "aufgaben" },
  { pfad: "/bibliothek", schluessel: "bibliothek" },
  { pfad: "/extern", schluessel: "extern" },
  { pfad: "/validierung", schluessel: "validierung" },
  { pfad: "/konflikte", schluessel: "konflikte" },
  { pfad: "/risiko", schluessel: "risiko" },
  { pfad: "/lebenszyklus", schluessel: "lebenszyklus" },
  { pfad: "/analytics", schluessel: "analytics" },
  { pfad: "/admin", schluessel: "admin" },
  { pfad: "/hilfe", schluessel: "hilfe" },
  { pfad: "/profil", schluessel: "profil" },
];

test("Alle Kernrouten rendern (keine weiße Seite)", async ({ page }) => {
  await ensureLoggedIn(page);
  for (const { pfad, schluessel } of KERNROUTEN) {
    await page.goto(pfad);
    // 1. Wir sind noch dort, wo wir hinwollten — keine stille Umleitung auf /start.
    await expect(page, `Umleitung von ${pfad}`).toHaveURL(new RegExp(`${pfad}$`), {
      timeout: 10_000,
    });
    // 2. Die ECHTE Seite steht da — nicht die Fehlerkarte, nicht der Platzhalter.
    await expect(
      page.getByTestId(`page-${schluessel}`),
      `kein Seitenanker auf ${pfad} — Fehlerkarte, Platzhalter oder fehlender pageKey`,
    ).toBeVisible({ timeout: 10_000 });
    // 3. Und die Fehlerkarte ist AUSDRÜCKLICH nicht da. Ohne diese Zeile könnte eine Seite ihren
    //    Kopf rendern und darunter abstürzen — der Anker allein sagt nichts über den Rest.
    await expect(
      page.getByRole("heading", { name: /konnte nicht geladen werden/i }),
      `Fehlerkarte auf ${pfad}`,
    ).toHaveCount(0);
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
  //
  // JOB 3061 · H2: Die vier Prüfseiten stehen unter EINEM Reiterkopf; die Überschrift heisst jetzt
  // „Prüfen", der Reiter „Offen". Gewartet wird deshalb auf den ROUTENANKER dieser Seite — er ist
  // ohnehin die härtere Zusage (die Fehlerkarte und der Platzhalter tragen ihn nicht, eine
  // Überschrift schon; genau darum prüft ihn auch der Fall „Alle Kernrouten rendern").
  await expect(page.getByTestId("page-validierung")).toBeVisible({ timeout: 10_000 });

  const leerText = page.getByText("Keine offenen Objekte.");
  const geseedet = process.env.KLARWERK_SMOKE_SEED === "1";
  const ohneModell = process.env.KLARWERK_SMOKE_OHNE_MODELL === "1";

  // ================================================================================================
  // AUFTRAG-mega59 BLOCK H3 — DER GESEEDETE ZWEIG PRÜFTE EINE ABWESENHEIT.
  // ================================================================================================
  //
  // `await expect(leerText).toHaveCount(0)` ist auch im LADEZUSTAND und im FEHLERZUSTAND erfüllt
  // (QueryState rendert den Leer-Text nur im geladenen, leeren Fall). Ein Lauf mit leerem oder
  // fehlgeschlagenem Prüf-Board war damit grün — die Kalibrierung wurde nicht eingelöst, sie wurde
  // behauptet. Und genau diese Kalibrierung ist die Deckung dafür, dass `smoke:ui:gate:daten` eine
  // ZWEITE Datenlage ist und nicht eine Wiederholung der ersten.
  //
  // Repariert mit einer POSITIVEN Zusicherung, und mit dem Ausschluss der beiden Zwischenzustände
  // BEVOR eine Aussage über die Datenlage fällt — sonst misst man wieder den Ladezustand.
  if (geseedet) {
    // Erst Lade- und Fehlerzustand ausschließen (QueryState: `state.loading` / `state.error`) …
    await expect(page.getByText("Lädt …")).toHaveCount(0);
    await expect(page.getByText("Etwas ist schiefgelaufen.")).toHaveCount(0);
    // … dann die eigentliche Aussage: es sind wirklich Prüf-Einträge DA.
    await expect(
      page.getByTestId("validation-row").first(),
      "geseedeter Lauf ohne einen einzigen Prüf-Eintrag — die zweite Datenlage ist keine",
    ).toBeVisible({ timeout: 15_000 });
    // Und die alte Abwesenheitsprüfung bleibt als Zusatz stehen (sie ist nicht falsch, nur zu schwach).
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
