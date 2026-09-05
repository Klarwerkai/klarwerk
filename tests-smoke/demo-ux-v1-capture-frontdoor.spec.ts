// ================================================================================================
// AUFTRAG-159 (DEMO-UX-V1) — DER MODELLFREIE KERNWEG, ENDLICH IM HERMETISCHEN TOR.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST (BASIC 151 `L1`, gemessen in PRO 157): Der einzige
// Browser-Beleg für den Demo-Kernweg war bisher „Kernfluss: Erzählen → Wissensseite → Einreichen"
// in `ui-smoke.spec.ts` — und der trägt `@modell` und wird vom Tor über `--grep-invert @modell`
// ausgeschlossen (bis JOB 3062, weil er den ohne Modell hart ausgegrauten Knopf „Mit KI
// strukturieren" klickte; seither, weil er ein Wissensobjekt anlegt und damit die zugesagte
// Datenlage des Tor-Laufs bräche — die Begründung steht dort). Ergebnis: genau der Weg, den die
// Demo vorführt, hatte im hermetischen Tor keinen Regressionsschutz.
//
// WARUM DAS HIER OHNE MODELL GEHT — und warum das kein Trick ist: Die Route `/capture/frontdoor`
// trägt einen VOLLSTÄNDIGEN Weg, der auf keiner Stufe ein Modell braucht. Gemessen an
// `components/erfassen/Blatt.tsx` (JOB 3062, s. u.): der Einreich-Knopf hängt an `disabled={busy}`,
// der Entwurfs-Knopf an `disabled={!canSave}` — die KI-Wege hängen an `canStructure` bzw.
// `canAssist` und liegen im Menü „KI ▾", das hier nicht angefasst wird. Der Weg ist also nicht
// „ohne KI nachgebaut", sondern ein eigener, produktiver Pfad.
//
// ================================================================================================
// JOB 3062 (H3) — DIESELBEN ZUSICHERUNGEN, AM NEUEN BLATT GEMESSEN.
// ================================================================================================
//
// Seit JOB 3062 rendern `/erfassen`, `/capture/frontdoor` und `/erfassen/neu` DASSELBE Blatt
// (`apps/web/src/components/erfassen/Blatt.tsx`). Die alte Vordertür — Kopf „Dokument-Editor",
// Hinweis „Schreibe oder füge Inhalt ein …", Sperrkasten `frontdoor-submit-validation`, die Knöpfe
// „Prüfen & einreichen" / „Als Entwurf speichern" — gibt es als FLÄCHE nicht mehr. Diese Datei ist
// deshalb umgezogen, NICHT abgeschwächt: jede der fünf Zusicherungen steht unverändert da, nur an
// ihrem neuen Ort. Was sich sachlich geändert hat, steht bei den betroffenen Fällen als
// GEÄNDERTE ZUSAGE und ist dort begründet — es sind genau zwei:
//
//   · Fall 1: Der Leerpfad NENNT KEINEN GRUND MEHR. Auftrag JOB 3062 §5.4 entscheidet, dass das
//     betroffene Feld markiert und fokussiert wird statt eines Erklärsatzes. Der Fall pinnt jetzt
//     BEIDES: dass etwas Sichtbares passiert (Fokus auf der Pflichtangabe) UND dass die alten
//     Erklärsätze nicht zurückkommen — das ist die schärfere Zusage, nicht die schwächere.
//   · Fall 3: Speichern VERLÄSST DAS BLATT NICHT MEHR. Der alte Sprung nach `/erfassen` hatte nur
//     Sinn, solange die Vordertür eine zweite Fläche neben dem Erfassen-Bereich war; jetzt IST das
//     Blatt beides, und der Sprung wäre eine Bewegung ohne Ziel (Begründung im Produktcode,
//     `Blatt.tsx`, `save.onSuccess`). Der U1-Unterschied „der eine legt beiseite, der andere reicht
//     ein" wird deshalb an der Quittung und am erhaltenen Inhalt gemessen, nicht an der Adresse.
//
// WAS DIESE DATEI IST: ein REGRESSIONSWÄCHTER über heute vorhandenes, grünes Verhalten. Sie nimmt
// ausdrücklich KEINEN menschlichen UX-Befund vorweg, verlangt keine andere Beschriftung als die
// heutige und löst keinen Productwrite aus. Fällt ein Fall, ist der Weg kaputt — nicht die
// Formulierung strittig.
//
// WARUM AUF SICHTBAREN TEXT UND NICHT AUF SCHLÜSSEL geprüft wird: Ein Test gegen `t("fd.…")` wäre
// grün, solange der Schlüssel existiert — auch wenn er nirgends gerendert wird. Geprüft wird
// deshalb, was eine Testperson liest.
//
// GETEILTER ZUSTAND — WARUM DIESE DATEI IN EINEM EIGENEN KONTEXT LÄUFT (AUFTRAG-163).
//
// Der Smoke-Server ist In-Memory und hält den Bestand in EINER `inMemoryRepos()`-Instanz
// (`build-app.ts:564`, über `buildServices()` :597-600). Bei `workers: 1` teilen sich alle Sonden
// und alle Engines diesen einen Bestand, und es gibt KEINEN Reset zwischen ihnen: der Werksreset
// ist ohne Journal `factoryResetUnavailable` (`server.ts:83-86`), eine Testhintertür existiert
// nicht.
//
// In Auftrag 159 hat genau das zugeschlagen. Die Fälle 3 und 4 legen einen Entwurf bzw. ein
// Wissensobjekt an — für sich grün (6/6), im GESAMTTOR aber kippten sie zwei Sonden, und zwar zu
// Recht:
//
//   · `ui-smoke.spec.ts:552` („mega49: die Datenlage dieses Laufs ist die zugesagte") sichert im
//     hermetischen Tor ZU, dass das Prüf-Board leer ist (`:587-588`, Zweig `ohneModell`). Ein
//     eingereichtes Objekt füllt es. Die Kalibrierung deckt ab, dass `smoke:ui:gate:daten` eine
//     ZWEITE Datenlage ist und nicht eine Wiederholung der ersten — sie aufzuweichen hiesse, diese
//     Deckung zu verlieren.
//   · `mega88-bildanker-browser.spec.ts:134` fiel, sobald ein Entwurf aus dieser Datei im Bestand
//     lag.
//
// Gegenprobe gefahren: ohne diese Datei waren beide grün (9/9). Die Ursache lag hier, nicht dort.
//
// AUFTRAG-163 löst das NICHT über den Dateinamen. Eine Umbenennung („läuft zuletzt") wäre genau die
// Bauform, die `support/auth.ts:12-15` als „Mangel der Vorrichtung" protokolliert und die mega24
// abgeschafft hat: unsichtbar, nicht prüfbar, und der Bestand bliebe geteilt. Stattdessen läuft
// diese Datei im Projekt `chromium-zustand` gegen einen ZWEITEN Smoke-Server auf eigenem Port mit
// eigener `inMemoryRepos()`-Instanz und eigener Ersteinrichtung
// (`playwright.smoke.config.ts`). Was hier entsteht, sieht keine andere Sonde — nicht weil die
// Reihenfolge günstig ist, sondern weil es einen anderen Bestand betrifft.
//
// KEIN `mode: "serial"`: Die drei Fälle sind voneinander unabhängig, jeder meldet sich selbst an
// und navigiert selbst. Serielle Kopplung hat in mega49 einen einzigen Timeout in sechs weitere
// Fehlschläge verwandelt — diese Bauform wird hier nicht wiederholt.
//
// KEINE `@modell`-Marke — und das ist die Zusage an `tests/smoke/tor-ausnahme.test.ts`: Der Pin
// vergleicht die DIFFERENZ zwischen vollem Lauf und Tor-Lauf gegen die erlaubte Ausnahmemenge.
// Ein Fall ohne Marke steht in beiden Listen, die Differenz bleibt unverändert, die Ausnahmemenge
// wächst nicht.
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const VORDERTUER = "/capture/frontdoor";

/** Das Inhaltsfeld ist ein `contentEditable` (RichTextEditor), kein `textarea`. */
const EDITOR = '[contenteditable="true"]';

/** Sichtbare Beschriftungen — wörtlich aus `apps/web/src/i18n.ts`, DE-Block. */
const T = {
  einreichen: "Einreichen", // erfassen.einreichen
  entwurf: "Entwurf sichern", // erfassen.entwurfSichern
  entwurfGespeichert: "Entwurf gespeichert.", // fd.toastSaved
  eingereicht: "Eingereicht:", // erfassen.eingereicht
  validierungOeffnen: "Validierung öffnen", // fd.openValidation
  neuerEintrag: "Neuer Eintrag", // fd.newEntry
  intern: "Öffentlich-intern", // conf.level.intern
} as const;

/**
 * Die beiden Erklärsätze der ALTEN Vordertür. Sie stehen hier NICHT, um sie zu erwarten, sondern um
 * in Fall 1 ihr Ausbleiben zu pinnen (Auftrag JOB 3062 §5.4: kein Erklärsatz auf der Fläche).
 */
const ALT = {
  schreibHinweis: "Schreibe oder füge Inhalt ein, dann kannst du prüfen und einreichen.", // fd.writeToSubmit
  sperrKopf: "Einreichen ist so noch nicht möglich:", // fd.validate.lead
} as const;

/**
 * Die beiden Knöpfe des Blattes, über ihren SICHTBAREN Text und `exact` adressiert: ohne `exact`
 * matcht Playwright Teilzeichenketten, und „Einreichen" träfe dann auch jede künftige Beschriftung,
 * die das Wort enthält — der Fall redete über den Selektor statt über den Knopf.
 */
const einreichenKnopf = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: T.einreichen, exact: true });
const entwurfKnopf = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: T.entwurf, exact: true });

async function oeffneBlatt(page: import("@playwright/test").Page): Promise<void> {
  await ensureLoggedIn(page);
  await page.goto(VORDERTUER);
  // KALIBRIERUNG: erst wenn die Seite wirklich steht, sagen die Zusicherungen darunter etwas über
  // das Produkt statt über einen Selektor, der ins Leere greift (Lehre aus smoketor Block A).
  //
  // Kalibriert wird am Einreich-Knopf, nicht an einem Seitentitel: das Blatt trägt bewusst KEINE
  // Überschrift mehr (JOB 3062 §1 und der Textmesser `tests/design/zielbild-h3-kein-erklaertext.test.ts`).
  // Der Knopf ist das, worum es in dieser Datei geht — er ist der ehrliche Anker.
  await expect(
    einreichenKnopf(page),
    "das Blatt ist nicht gemountet — alles Weitere wäre eine Aussage über den Selektor",
  ).toBeVisible({ timeout: 15_000 });
}

// ------------------------------------------------------------------------------------------------
// FALL 1 — DER LEERPFAD BLEIBT FAIL-CLOSED.
// ------------------------------------------------------------------------------------------------
//
// Der Einreich-Knopf ist bei leerem Inhalt BEWUSST nicht deaktiviert (AUFTRAG-mega9 Block A): statt
// eines grauen Knopfes ohne Begründung führt das Produkt den Menschen an die fehlende Angabe.
//
// GEÄNDERTE ZUSAGE (JOB 3062 §5.4): WIE es das tut, ist neu. Bis hierher erschien der Kasten
// `frontdoor-submit-validation` mit zwei Erklärsätzen; jetzt bekommt das betroffene Feld den Rand
// und den FOKUS, und es steht kein Satz da. Gemessen wird deshalb der Fokus — ein Zustand des
// Browsers, kein Klassenname —, und zusätzlich das AUSBLEIBEN der alten Sätze. Beides zusammen ist
// schärfer als die alte Fassung: ein Rückfall in den Erklärkasten fiele hier auf, ein still
// verschluckter Klick ebenso.
test("DEMO-UX-V1 · Einreichen ohne Inhalt führt an die Pflichtangabe und legt nichts an", async ({
  page,
}) => {
  await oeffneBlatt(page);

  // Vor dem Klick: der Knopf ist erreichbar (nicht still gesperrt).
  const einreichen = einreichenKnopf(page);
  await expect(einreichen).toBeEnabled();

  await einreichen.click();

  // Der Klick verpufft NICHT: die Vertraulichkeit ist die erste fehlende Pflichtangabe, ihr Menü
  // bekommt den Fokus. `blatt-werkzeug-vertraulichkeit` ist der Anker des Werkzeugs selbst — sein
  // sichtbares Wort ist der gewählte Stufenname und taugt hier nicht als Adresse.
  await expect(
    page.getByTestId("blatt-werkzeug-vertraulichkeit"),
    "der Einreich-Klick hat den Menschen nicht an die fehlende Pflichtangabe geführt",
  ).toBeFocused({ timeout: 10_000 });

  // Und er tut es OHNE Erklärsatz — die beiden Sätze der alten Vordertür sind nicht zurück.
  await expect(page.getByText(ALT.sperrKopf)).toHaveCount(0);
  await expect(page.getByText(ALT.schreibHinweis)).toHaveCount(0);

  // FAIL-CLOSED: kein Erfolgsbild, keine Weiterleitung, kein angelegtes Objekt.
  await expect(page.getByText(T.eingereicht)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${VORDERTUER}$`));
});

// ------------------------------------------------------------------------------------------------
// FALL 2 — BEIDE HANDLUNGEN SIND DA UND UNTERSCHEIDBAR. DAS IST DER U1-ANTEIL, DER OHNE
// ZUSTANDSÄNDERUNG BELEGBAR IST.
// ------------------------------------------------------------------------------------------------
//
// Was hier NICHT steht und warum: Der vollständige Weg — speichern, einreichen, Status, nächster
// Schritt — ist geschrieben und für sich grün gemessen worden (6/6 im hermetischen Tor), kippt aber
// zwei bestehende Sonden (s. Kopf dieser Datei). Er ist deshalb an den Kopf zurückgegeben, nicht
// abgeschwächt und nicht heimlich weggelassen.
//
// BELEGBAR OHNE ANLEGEN ist der Kern der U1-Beobachtung: dass die beiden Handlungen NEBENEINANDER
// stehen, verschieden heissen und verschieden erreichbar sind. Genau daran ist die Testperson im
// Erstlauf gescheitert („der Einreich-Button wurde leicht übersehen").
test("DEMO-UX-V1 · Entwurf und Einreichen stehen nebeneinander und sind unterscheidbar", async ({
  page,
}) => {
  await oeffneBlatt(page);

  const einreichen = einreichenKnopf(page);
  const entwurf = entwurfKnopf(page);

  // Beide sind da — und zwar gleichzeitig, nicht in zwei Schritten hintereinander.
  await expect(einreichen).toBeVisible();
  await expect(entwurf).toBeVisible();

  // Sie sind verschieden erreichbar, und das ist Absicht: Einreichen bleibt bei leerem Inhalt
  // ERREICHBAR und begründet dann (mega9 Block A), Entwurf-Speichern ist ohne Inhalt gesperrt
  // (`disabled={!canSave}`). Wer diesen Unterschied umdreht, fällt hier auf.
  await expect(einreichen).toBeEnabled();
  await expect(entwurf).toBeDisabled();
});

// ------------------------------------------------------------------------------------------------
// FALL 3 — „ENTWURF SICHERN" LEGT BEISEITE, OHNE DAS BLATT ZU RÄUMEN.
// ------------------------------------------------------------------------------------------------
//
// GEÄNDERTE ZUSAGE (JOB 3062): Bis hierher sprang die Vordertür im `onSuccess` nach `/erfassen`
// (`replace: true`) — die Adresse WAR die messbare Folge. Seit JOB 3062 sind Vordertür und
// Erfassen-Bereich DASSELBE Blatt; ein Sprung wäre eine Bewegung ohne Ziel und ist deshalb
// entfallen (Begründung im Produktcode, `Blatt.tsx`, `save.onSuccess`).
//
// Der U1-Unterschied bleibt und wird jetzt dort gemessen, wo er wirklich liegt: der eine Knopf legt
// etwas beiseite (Quittung des Servers, Inhalt bleibt in der Hand des Menschen), der andere reicht
// ein (Erfolgszeile, Blatt geräumt). Ein Produkt, das nach dem Sichern still den Text verlöre, fiele
// hier auf — das ist die schärfere Zusage als die alte Adressprüfung.
test("DEMO-UX-V1 · Entwurf sichern legt beiseite und hält Blatt und Inhalt", async ({ page }) => {
  await oeffneBlatt(page);

  const editor = page.locator(EDITOR).first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  const probe =
    "DEMO-UX-V1 Entwurfsprobe: Vor dem Anfahren der Linie L4 den Druck am Ventil V2 prüfen.";
  await editor.fill(probe);

  const entwurf = entwurfKnopf(page);
  await expect(entwurf).toBeEnabled({ timeout: 10_000 });
  await entwurf.click();

  // Die Quittung kommt vom Server, nicht vom Klick (Zustandsmodell §9: nie „gespeichert" ohne
  // Serverbestätigung).
  await expect(page.getByText(T.entwurfGespeichert)).toBeVisible({ timeout: 15_000 });
  // Das Blatt steht weiter — mit dem Text darin.
  await expect(page).toHaveURL(new RegExp(`${VORDERTUER}$`), { timeout: 15_000 });
  await expect(editor).toContainText(probe);
  // Und ausdrücklich NICHT das Einreich-Bild — Speichern ist kein Einreichen.
  await expect(page.getByText(T.eingereicht)).toHaveCount(0);
});

// ------------------------------------------------------------------------------------------------
// FALL 4 — EINREICHEN: SICHTBARER STATUS UND NÄCHSTER SCHRITT.
// ------------------------------------------------------------------------------------------------
//
// NEU GEGENÜBER DER VORDERTÜR: Die Vertraulichkeit muss VOR dem Einreichen gewählt sein (JOB 3062
// §5.4 / §8.5 — Egress). Das ist keine Umständlichkeit des Tests, sondern der gemessene Weg: ohne
// diesen Klick bliebe es beim Fall 1 (Fokus auf dem Menü, nichts entsteht). Der Fall fährt damit
// den vollständigen Weg, nicht die halbe Strecke.
test("DEMO-UX-V1 · Einreichen zeigt Status und alle nächsten Schritte", async ({ page }) => {
  await oeffneBlatt(page);

  const editor = page.locator(EDITOR).first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill(
    "DEMO-UX-V1 Regressionsprobe: Beim Anfahren der Linie L4 nach dem Schichtwechsel den " +
      "Dosierwert erst nach zehn Minuten anpassen, sonst schwankt die Qualität.",
  );

  await page.getByTestId("blatt-werkzeug-vertraulichkeit").click();
  await page.getByRole("menuitem", { name: T.intern }).click();

  await einreichenKnopf(page).click();

  // Sichtbarer Status.
  await expect(page.getByText(T.eingereicht)).toBeVisible({ timeout: 20_000 });

  // Die nächsten Schritte stehen ALLE DREI und sind keine leeren Beschriftungen. Der Weg zum Objekt
  // trägt seit JOB 3062 den TITEL des angelegten Objekts als Beschriftung statt des festen Wortes
  // „Objekt ansehen" — er wird deshalb über seine Lage in der Erfolgszeile adressiert und unten über
  // sein Ziel geprüft.
  const objekt = page.getByTestId("blatt-lage").getByRole("link").first();
  await expect(objekt).toBeVisible();
  await expect(page.getByRole("link", { name: T.validierungOeffnen })).toBeVisible();
  await expect(page.getByRole("button", { name: T.neuerEintrag })).toBeVisible();

  // SERVERWAHRHEIT statt Kosmetik: der Weiterweg zeigt auf eine ECHTE Objekt-Route mit einer
  // nicht-leeren Kennung, und sie ist begehbar. Ein bloss gerenderter Erfolgstext ohne auflösbares
  // Ziel käme hier nicht durch.
  const ziel = await objekt.getAttribute("href");
  expect(ziel, "der Weiterweg zum Objekt trägt kein Ziel").toMatch(/\/wissen\/.+/);
  await objekt.click();
  await expect(page).toHaveURL(/\/wissen\/.+/, { timeout: 15_000 });
});

// ------------------------------------------------------------------------------------------------
// FALL 5 — 390 UND 768 PIXEL OHNE WAAGERECHTEN ÜBERLAUF.
// ------------------------------------------------------------------------------------------------
//
// PRO 155/157 haben gemessen, dass `768` im Repository bis hierher AUSSCHLIESSLICH in
// `mobile-drawer-focus-probe.spec.ts:28` vorkam — im Korridor nirgends. Diese Breite hatte damit
// keinen automatisierten Beleg. Gemessen wird die Zahl, nicht der Eindruck: `scrollWidth` gegen
// `clientWidth`, mit einem Pixel Toleranz für Rundung bei fraktionalen Layoutbreiten.
for (const sicht of [
  { name: "390x844 (Telefon)", width: 390, height: 844 },
  { name: "768x1024 (Tablet)", width: 768, height: 1024 },
]) {
  test(`DEMO-UX-V1 · das Blatt läuft bei ${sicht.name} nicht waagerecht über`, async ({ page }) => {
    await page.setViewportSize({ width: sicht.width, height: sicht.height });
    await oeffneBlatt(page);

    // Der Editor muss dabei wirklich da sein — sonst misst der Vergleich eine halbe Seite.
    await expect(page.locator(EDITOR).first()).toBeVisible({ timeout: 10_000 });

    const ueberlauf = await page.evaluate(() => {
      const el = document.documentElement;
      return { scroll: el.scrollWidth, client: el.clientWidth };
    });
    expect(
      ueberlauf.scroll,
      `waagerechter Überlauf: scrollWidth ${ueberlauf.scroll} > clientWidth ${ueberlauf.client}`,
    ).toBeLessThanOrEqual(ueberlauf.client + 1);
  });
}
