// ================================================================================================
// AUFTRAG-159 (DEMO-UX-V1) — DER MODELLFREIE KERNWEG, ENDLICH IM HERMETISCHEN TOR.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST (BASIC 151 `L1`, gemessen in PRO 157): Der einzige
// Browser-Beleg für den Demo-Kernweg war bisher „Kernfluss: Erzählen → Wissensseite → Einreichen"
// in `ui-smoke.spec.ts:45` — und der trägt `@modell`, weil er „Mit KI strukturieren" klickt. Dieser
// Knopf wird ohne aktives Modell bewusst HART ausgegraut (`lib/aiAvailability.ts:29-49`), also
// schliesst ihn das Tor über `--grep-invert @modell` aus. Ergebnis: genau der Weg, den die Demo
// vorführt, hatte im hermetischen Tor keinen Regressionsschutz.
//
// WARUM DAS HIER OHNE MODELL GEHT — und warum das kein Trick ist: Die Vordertür
// (`/capture/frontdoor`) trägt einen VOLLSTÄNDIGEN Weg, der auf keiner Stufe ein Modell braucht.
// Gemessen an `CaptureFrontDoor.tsx`: der Einreich-Knopf hängt an `disabled={busy}` (:1171), der
// Entwurfs-Knopf an `disabled={!canSave}` (:1182) — die KI-Knöpfe hängen an `canStructure` (:872)
// bzw. `canAssist` (:924) und werden hier nicht angefasst. Der Weg ist also nicht „ohne KI
// nachgebaut", sondern ein eigener, produktiver Pfad.
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
  seite: "Dokument-Editor", // fd.title
  einreichen: "Prüfen & einreichen", // fd.submitReview
  entwurf: "Als Entwurf speichern", // fd.saveDraft
  schreibHinweis: "Schreibe oder füge Inhalt ein, dann kannst du prüfen und einreichen.", // fd.writeToSubmit
  sperrKopf: "Einreichen ist so noch nicht möglich:", // fd.validate.lead
  sperrGrund: "Der Inhalt ist leer. Zum Einreichen braucht das Wissensobjekt Text.", // fd.validate.needBody
  entwurfGespeichert: "Entwurf gespeichert.", // fd.toastSaved
  eingereicht: "Zur Prüfung eingereicht:", // fd.submitted
  objektAnsehen: "Objekt ansehen", // fd.viewObject
  validierungOeffnen: "Validierung öffnen", // fd.openValidation
  neuerEintrag: "Neuer Eintrag", // fd.newEntry
} as const;

async function oeffneVordertuer(page: import("@playwright/test").Page): Promise<void> {
  await ensureLoggedIn(page);
  await page.goto(VORDERTUER);
  // KALIBRIERUNG: erst wenn die Seite wirklich steht, sagen die Zusicherungen darunter etwas über
  // das Produkt statt über einen Selektor, der ins Leere greift (Lehre aus smoketor Block A).
  await expect(
    page.getByText(T.seite).first(),
    "die Vordertür ist nicht gemountet — alles Weitere wäre eine Aussage über den Selektor",
  ).toBeVisible({ timeout: 15_000 });
}

// ------------------------------------------------------------------------------------------------
// FALL 1 — DER LEERPFAD BLEIBT FAIL-CLOSED.
// ------------------------------------------------------------------------------------------------
//
// Der Einreich-Knopf ist bei leerem Inhalt BEWUSST nicht deaktiviert (`CaptureFrontDoor.tsx:1168-1171`,
// AUFTRAG-mega9 Block A): statt eines grauen Knopfes ohne Begründung nennt das Produkt die
// Bedingung. Genau das wird hier gepinnt — und dazu, dass dabei NICHTS entsteht.
test("DEMO-UX-V1 · Einreichen ohne Inhalt nennt den Grund und legt nichts an", async ({ page }) => {
  await oeffneVordertuer(page);

  // Vor dem Klick: der Hinweis steht, der Knopf ist erreichbar (nicht still gesperrt).
  await expect(page.getByText(T.schreibHinweis)).toBeVisible();
  const einreichen = page.getByRole("button", { name: T.einreichen });
  await expect(einreichen).toBeEnabled();

  await einreichen.click();

  // Die sichtbare Feldvalidierung — an ihrem eigenen Anker, mit dem echten Grund im Text.
  const sperre = page.getByTestId("frontdoor-submit-validation");
  await expect(sperre).toBeVisible({ timeout: 10_000 });
  await expect(sperre).toContainText(T.sperrKopf);
  await expect(sperre).toContainText(T.sperrGrund);

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
  await oeffneVordertuer(page);

  const einreichen = page.getByRole("button", { name: T.einreichen });
  const entwurf = page.getByRole("button", { name: T.entwurf });

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
// FALL 3 — „ALS ENTWURF SPEICHERN" LEGT BEISEITE UND BEENDET DIE EDITORSITZUNG.
// ------------------------------------------------------------------------------------------------
//
// GEMESSEN, NICHT ANGENOMMEN — ein erster Entwurf dieses Tests lag hier falsch: Nach dem Speichern
// bleibt man NICHT im Editor. `CaptureFrontDoor.tsx:430-438` navigiert im `onSuccess` bewusst nach
// `/erfassen` (`replace: true`); die Begründung steht daneben (AUFTRAG-mega12 Block A): ein Wächter
// an dieser Stelle „könnte den Nutzer nach dem Speichern auf der Vordertür festhalten".
//
// Genau darin liegt der U1-Unterschied: der eine Knopf legt etwas beiseite, der andere reicht ein.
test("DEMO-UX-V1 · Als Entwurf speichern legt beiseite und beendet die Editorsitzung", async ({
  page,
}) => {
  await oeffneVordertuer(page);

  const editor = page.locator(EDITOR).first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill(
    "DEMO-UX-V1 Entwurfsprobe: Vor dem Anfahren der Linie L4 den Druck am Ventil V2 prüfen.",
  );

  const entwurf = page.getByRole("button", { name: T.entwurf });
  await expect(entwurf).toBeEnabled({ timeout: 10_000 });
  await entwurf.click();

  await expect(page.getByText(T.entwurfGespeichert)).toBeVisible({ timeout: 15_000 });
  // Die gemessene Folge: der Editor ist verlassen, der Nutzer steht wieder am Erfassungs-Einstieg.
  await expect(page).toHaveURL(/\/erfassen$/, { timeout: 15_000 });
  // Und ausdrücklich NICHT das Einreich-Bild — Speichern ist kein Einreichen.
  await expect(page.getByText(T.eingereicht)).toHaveCount(0);
});

// ------------------------------------------------------------------------------------------------
// FALL 4 — EINREICHEN: SICHTBARER STATUS UND NÄCHSTER SCHRITT.
// ------------------------------------------------------------------------------------------------
test("DEMO-UX-V1 · Einreichen zeigt Status und alle nächsten Schritte", async ({ page }) => {
  await oeffneVordertuer(page);

  const editor = page.locator(EDITOR).first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill(
    "DEMO-UX-V1 Regressionsprobe: Beim Anfahren der Linie L4 nach dem Schichtwechsel den " +
      "Dosierwert erst nach zehn Minuten anpassen, sonst schwankt die Qualität.",
  );

  await page.getByRole("button", { name: T.einreichen }).click();

  // Sichtbarer Status.
  await expect(page.getByText(T.eingereicht)).toBeVisible({ timeout: 20_000 });

  // Die nächsten Schritte stehen ALLE DREI und sind keine leeren Beschriftungen.
  const objekt = page.getByRole("link", { name: T.objektAnsehen });
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
  test(`DEMO-UX-V1 · die Vordertür läuft bei ${sicht.name} nicht waagerecht über`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: sicht.width, height: sicht.height });
    await oeffneVordertuer(page);

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
