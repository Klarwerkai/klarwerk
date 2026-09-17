// ================================================================================================
// JOB 4263 · EINE FRÜHERE FASSUNG WIRKLICH PER TASTATUR ZURÜCKHOLEN — DER WEG, GENAU EINMAL.
// ================================================================================================
//
// WAS HIER ANDERS IST ALS IM BESTAND, und es steht wörtlich in der Datei, die es bisher misst:
// `tests/wiki-nachvollziehen/uebernahme-in-der-flaeche-chromium.test.tsx:1` beginnt mit
// `// @vitest-environment jsdom`, und `:12-18` sagt selbst „der Auftrag verlangt sie unter diesem
// Namen … — und das ist jsdom, kein Chromium"; `:21-22` ersetzen `apps/web/src/api/endpoints` und
// `…/auth` durch Doppel. Dort gibt es also keinen HTTP-Weg, keine Datenbank und keinen gedrückten
// Tastendruck — und damit auch keine Aussage über „nach Neustart noch da".
//
// DIESER ORDNER LÖST NICHTS AB. Die jsdom-Datei bleibt unverändert stehen; sie misst, was in jsdom
// messbar ist (Bauart der Knöpfe, Inhalt des Aufrufs, die vier Zustandssätze), und legt ihre Grenze
// selbst offen. Hier steht die Aussage DANEBEN, die sie ausdrücklich nicht macht: echtes Chromium,
// echte Tasten, echtes HTTP auf die unveränderte gebaute App — und im Integrationslauf echte
// PostgreSQL, frischer Browserkontext, App-Neustart und eine unabhängige Lesung am Pool.
//
// ================================================================================================
// EINMAL BESCHRIEBEN, ZWEIMAL GEFAHREN — die Bauform von `tests/gast-nutzerweg/browserweg.ts:11-17`.
// ================================================================================================
//
//   · `rueckholung-im-echten-browser.test.ts`  → Speicherablagen, läuft im Tor (ohne Docker).
//   · `rueckholung-pg.integration.test.ts`     → `buildPgServices(pool)`, echte PostgreSQL.
//
// Läge der Ablauf zweimal ausgeschrieben da, wären es wieder zwei Aussagen, die nur heute
// übereinstimmen (`browserweg.ts:15-17`). Verschieden ist EIN Argument: der Pool.
//
// ================================================================================================
// DIE TASTATUR WIRD GEDRÜCKT, NICHT NACHGEBILDET.
// ================================================================================================
//
// Es gibt in diesem Ordner GENAU EINEN Weg zu einem Bedienelement: `zuElement` tabbt hin, misst den
// SICHTBAREN Fokus am berechneten Stil nach, und erst dann fällt die Taste. Kein `page.click`, kein
// `click()` aus `page.evaluate`, kein `element.focus()`. Der Grund ist gemessen und nicht vermutet:
// BEN hat an JOB 4223 R1/R2 einen behaupteten Tastaturnachweis mit `tabIndex={-1}` widerlegt, und
// der Fall blieb GRÜN (`browserweg.ts:23-26`). Ein Knopf, den kein Tab erreicht, lässt diesen Weg
// scheitern.
//
// KEINE AUSNAHME IN DIESEM ORDNER. Der eine benannte Sonderfall aus JOB 4223 (die Ziffern einer
// nativen Datumseingabe) kommt hier nicht vor; die Auswahlfelder des Fassungsvergleichs sind native
// `<select>` und werden mit der Pfeiltaste bedient — genau wie die Rollenauswahl dort
// (`browserweg.ts:468-477`).
//
// ================================================================================================
// WAS AUS DEM NACHBARORDNER KOMMT — UND WARUM NICHTS DAVON ABGESCHRIEBEN WIRD.
// ================================================================================================
//
// `tests/gast-nutzerweg/strecke.ts` (echter Socket, getrennte Keksbeutel, Ersteinrichtung) und die
// Chromium-/Tastaturprimitiven aus `tests/gast-nutzerweg/browserweg.ts` werden IMPORTIERT, nicht
// nachgebaut. Zwei Messstrecken nebeneinander wären zwei Aussagen, die nur heute übereinstimmen.
//
// FOLGE FÜR DIE TOR-LAST, ausdrücklich benannt: der Chromium-Start bleibt damit die EINE vorhandene
// Startstelle `tests/gast-nutzerweg/browserweg.ts` (`require("playwright")` über `createRequire`,
// `browserweg.ts:295-299`). Die beiden Testdateien dieses Ordners erreichen Playwright über den
// Importgraphen und fallen dadurch in die serielle Browser-Gruppe des Tors
// (`tests/tor-inventar/browser-gruppe.ts`) — das ist nicht behauptet, sondern in
// `rueckholung-im-echten-browser.test.ts` (Fall G) am Graphen selbst nachgemessen. Ein eigener
// `require("playwright")` HIER hätte die Zahl der Startstellen erhöht und den Pin in
// `tests/tor-inventar/tor-bestand-vollstaendig.test.ts:381` (29) rot gemacht — eine Datei, die
// § 10 des Auftrags ausdrücklich ausserhalb dieses Auftrags stellt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type Browser,
  DIST,
  LIES_TEXT,
  type Seite,
  warte as browserWarte,
  fn,
  mitFlaeche,
  profil,
  tabBisZu,
  tippeMitTastatur,
} from "../gast-nutzerweg/browserweg";
import {
  type Antwort,
  PASSWORT,
  type Sitzung,
  type Strecke,
  mussGelingen,
} from "../gast-nutzerweg/strecke";

const JOB = "JOB 4263";

/** Die Sollwerte kommen aus DEM Katalog des Hauses, nicht aus einer hier eingetippten Abschrift. */
export const T = i18n.getFixedT("de");

/**
 * Die Marken.
 *
 * Jede aus einem eigenen Unicode-Block, den im ganzen Bestand kein anderer Test benutzt (gemessen
 * am Basisstand `a57c83f`: null Treffer für Runen U+16A0–16FF, Ogham U+1680–169F und Tifinagh
 * U+2D30–2D7F unter `tests/`, `services/` und `apps/web/src/`). Eine Marke wie „alt"/„neu" träfe im
 * Seitentext irgendwann auf sich selbst, und der Nachweis hinge am Zufall.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RUNDE 2 · JEDES INHALTSFELD BEKOMMT SEINE EIGENE MARKE — und das ist eine gemessene Korrektur.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * BEN hat an Runde 1 belegt, was passiert, wenn Kernaussage und Bericht DIESELBE Marke tragen: er
 * hat im isolierten Prüfprozess bei jeder Rückholung den erzeugten `bodyHtml` vor dem Speichern auf
 * `null` gesetzt (`"version":4,"vorher":"<p>ᚠᚨᛊᛊᚢᚾᚷᚨᛚᛏ4263</p>","nachher":null`) — der
 * zurückgeholte BERICHT ging also verloren, und dieser Weg blieb GRÜN. Zwei Gründe, beide echt:
 *
 *   1. Die Leseansicht zeichnet bei fehlendem Bericht die KERNAUSSAGE an genau derselben Stelle
 *      (`apps/web/src/components/bibliothek/BibliothekLesen.tsx:2976-3004`, Zweig `: <p>{ko.statement}</p>`).
 *      Mit einer gemeinsamen Marke füllt der Ersatztext den Nachweis des Ersetzten aus.
 *   2. Der Blick auf den gespeicherten Stand las nur Version und `statement`.
 *
 * Deshalb: `MARKE_*` steht AUSSCHLIESSLICH in `statement`, `BERICHT_*` AUSSCHLIESSLICH in
 * `bodyHtml`. Keine der beiden Zeichenfolgen enthält die andere — ein Ersatztext kann den
 * Berichtsnachweis damit nicht mehr erfüllen (BENs Prüffrage, Korrekturpflicht 1).
 */
export const MARKE_ALT = "ᚠᚨᛊᛊᚢᚾᚷᚨᛚᛏ4263";
export const MARKE_MITTE = "᚛ᚋᚔᚈᚈᚓ4263᚜";
export const MARKE_NEU = "ⵏⴻⵓⵊⴻⵙⵜ4263";
export const MARKE_FREMD = "ᚠᚱᛖᛗᛞᛖᚱᛊᚲᚺᚱᛖᛁᛒᛏ4263";

/** Die Berichtsmarken — je eine eigene Zeichenfolge, nie ein Anhängsel der Kernaussage. */
export const BERICHT_ALT = "ᛒᛖᚱᛁᚲᚺᛏᚨᛚᛏ4263";
export const BERICHT_MITTE = "᚛ᚁᚓᚏᚔᚉᚆᚈ4263᚜";
export const BERICHT_NEU = "ⴱⴻⵔⵉⴽⵀⵜ4263";
export const BERICHT_FREMD = "ᛒᛖᚱᛁᚲᚺᛏᚠᚱᛖᛗᛞ4263";

/** Eine Fassung, wie dieser Ordner sie anlegt: Kernaussage und Bericht getrennt markiert. */
export interface Fassungstext {
  /** `statement` — steht in der Liste, im Vergleich UND als Ersatz, wenn der Bericht fehlt. */
  kern: string;
  /** `bodyHtml` — eigene Marke, damit die Kernaussage ihn niemals vertreten kann. */
  bericht: string;
}

export const FASSUNG_ALT: Fassungstext = { kern: MARKE_ALT, bericht: BERICHT_ALT };
export const FASSUNG_MITTE: Fassungstext = { kern: MARKE_MITTE, bericht: BERICHT_MITTE };
export const FASSUNG_NEU: Fassungstext = { kern: MARKE_NEU, bericht: BERICHT_NEU };

/** Breit genug für Liste UND Leseansicht — die Schmalkante ist Gegenstand anderer Aufträge. */
export const BREIT = { width: 1280, height: 900 };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// ------------------------------------------------------------------------------------------------
// DIE GEBAUTE FLÄCHE — Vorbedingung, die HERGESTELLT und nicht still übersprungen wird.
// ------------------------------------------------------------------------------------------------
//
// Bauform und Begründung wie in
// `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:100-115`: Im Tor liegt
// `apps/web/dist` vor, weil `./tools/build` davor läuft (`tools/check:9`) — dann wird hier nichts
// gebaut. Ausserhalb des Tors (Arbeitsprüfung, Integrationslauf) fehlt es, und ein stiller
// Übersprung sähe aus wie ein bestandener Lauf. Gebaut wird mit DEMSELBEN Bündler; gemessen wird
// danach genau das Bündel, das auch ausgeliefert wird.
export function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 900_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

/**
 * Welcher Browser hat wirklich gemessen?
 *
 * Auftrag § 5, Lieferung 6 verlangt die REALE Chromium-Version im Bericht. Sie wird deshalb aus dem
 * laufenden Browser GELESEN und auf stderr gestellt — eine aus `package.json` abgeschriebene Nummer
 * wäre eine Aussage über die Abhängigkeit, nicht über den Prüfstand.
 */
export function browserKennung(browser: Browser): string {
  const roh = browser as unknown as { version?: () => string };
  return typeof roh.version === "function" ? roh.version() : "(Version nicht abfragbar)";
}

// ------------------------------------------------------------------------------------------------
// SIEHT MAN, WORAUF DER FOKUS STEHT?
// ------------------------------------------------------------------------------------------------
//
// Dieselbe Frage und dieselbe Messung wie `browserweg.ts:97-118`; dort sind die beiden Sonden nicht
// exportiert. Sie stehen deshalb hier noch einmal — als MESSPRIMITIVE, nicht als zweiter Weg. Das
// ist im Bestand die Regel und nicht die Ausnahme: zehn Chromium-Dateien messen den Fokus so (u. a.
// `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`,
// `tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts`). Was nicht zweimal dastehen darf,
// ist der WEG — und der steht in diesem Ordner genau einmal, weiter unten.
//
// MIT EINER SCHÄRFUNG GEGENÜBER DER VORLAGE, und sie ist an diesem Produkt gemessen: Tailwinds
// `outline-none` ist KEIN fehlender Umriss, sondern `outline: 2px solid transparent`
// (`apps/web/src/index.css:65` setzt es im selben Atemzug mit dem Ring). Die Vorlage zählte einen
// DURCHSICHTIGEN Umriss als sichtbaren Fokus — an jedem Element, das `outline-none` trägt, hätte sie
// deshalb auch dann grün gemeldet, wenn der Ring fehlte. Hier zählt nur, was ein Mensch sieht: eine
// Farbe, die nicht vollständig durchsichtig ist. Die Gegenprobe dazu ist gefahren (RUECKGABE,
// GEGENPROBEN 2): ohne `ring-2` in der Regel `*:focus-visible` wird dieser Weg rot.
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return false;
  // Eine Farbe zählt, wenn sie nicht vollständig durchsichtig ist.
  const sichtbareFarbe = (farbe) =>
    !/transparent/.test(farbe) && !/,\\s*0\\s*\\)/.test(farbe);
  // Ein Schatten kann MEHRERE Farben tragen (Tailwind legt Ring, Ring-Abstand und Schatten
  // übereinander, und die ungenutzten Lagen stehen als "rgba(0, 0, 0, 0)" darin). Sichtbar ist er,
  // sobald EINE davon sichtbar ist — nicht erst, wenn alle es sind.
  const s = getComputedStyle(a);
  const umriss =
    s.outlineStyle !== "none" &&
    Number.parseFloat(s.outlineWidth || "0") > 0 &&
    sichtbareFarbe(String(s.outlineColor));
  const lagen = String(s.boxShadow).match(/rgba?\\([^)]*\\)/g) || [];
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "" && lagen.some(sichtbareFarbe);
  return umriss || schatten;
}`;

const FOKUS_DIAGNOSE = `() => {
  const a = document.activeElement;
  if (!a) return "aktiv: (nichts)";
  const s = getComputedStyle(a);
  return [
    "aktiv: <" + a.tagName.toLowerCase() + ">",
    "marken=" + JSON.stringify(a.dataset || {}).slice(0, 140),
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "outline=" + s.outlineStyle + " " + s.outlineWidth,
    "boxShadow=" + String(s.boxShadow).slice(0, 80),
  ].join(" · ");
}`;

/** Der Wert eines `<select>` — gelesen, nicht geraten. */
const WAHLWERT = `(sel) => {
  const e = document.querySelector(sel);
  return e ? String(e.value) : "(fehlt)";
}`;

/** Der sichtbare Text eines Elements, auf eine Zeile normalisiert. `null`, wenn es nicht da ist. */
const TEXT_VON = `(sel) => {
  const e = document.querySelector(sel);
  return e === null ? null : (e.textContent || "").replace(/\\s+/g, " ").trim();
}`;

/** Gibt es dieses Element überhaupt? Für Zusagen über ABWESENHEIT. */
const GIBT_ES = "(sel) => !!document.querySelector(sel)";

/** Trägt das Element mit diesem Selektor diesen Text? (`[selektor, text]`) */
const TRAEGT_TEXT = `(a) => {
  const e = document.querySelector(a[0]);
  return !!e && (e.textContent || "").includes(a[1]);
}`;

/** Der Knopf in GENAU der Lage, die `MehrAbschnitte.tsx:2350-2356` beschreibt. */
const LAEUFT_GERADE = `(a) => {
  const e = document.querySelector(a[0]);
  return !!e && e.disabled === true && (e.textContent || "").includes(a[1]);
}`;

/**
 * Ein Schreibversuch AUS DER SEITE HERAUS, mit genau den Keksen dieses Profils.
 *
 * Er misst die zweite Hälfte der Rechtefrage: dass an der Fläche kein Knopf steht, sagt über den
 * Server nichts. Beides gehört gemessen, nicht eines (Auftrag § 5, Lieferung 4a).
 */
const DIREKTER_GRIFF = `(a) => fetch("/api/kos/" + a.id, {
  method: "PUT",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "revise", changes: { restoredFromVersion: a.version } }),
})
  .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t.slice(0, 600) })))
  .catch((e) => ({ status: -1, rumpf: String(e) }))`;

async function warte(
  seite: Seite,
  quelle: string,
  was: string,
  arg?: unknown,
  frist = 45_000,
): Promise<void> {
  try {
    await browserWarte(seite, quelle, was, arg, frist);
  } catch (fehler) {
    throw new Error(`${JOB}: ${was} — nicht eingetreten.\n${String(fehler)}`);
  }
}

// ------------------------------------------------------------------------------------------------
// DER EINE WEG ZU EINEM BEDIENELEMENT.
// ------------------------------------------------------------------------------------------------

/** Tab bis zum Element, SICHTBAREN Fokus nachgemessen. Gibt die Zahl der Anschläge zurück. */
export async function zuElement(
  seite: Seite,
  selektor: string,
  was: string,
  hoechstens = 320,
): Promise<number> {
  let schritte: number;
  try {
    schritte = await tabBisZu(seite, selektor, hoechstens, true);
  } catch (fehler) {
    throw new Error(
      `${JOB}: „${was}" (${selektor}) war in ${hoechstens} Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus".\n${String(fehler)}`,
    );
  }
  const stand = await seite.evaluate<string>(fn(FOKUS_DIAGNOSE));
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `${JOB}: „${was}" zeigt keinen sichtbaren Fokus, obwohl es gerade per Tastatur angesteuert wurde — ${stand}`,
  ).toBe(true);
  return schritte;
}

/** Tab hin, Fokus nachgemessen, ENTER. Es gibt in diesem Ordner keinen zweiten Weg dorthin. */
export async function mitTaste(
  seite: Seite,
  selektor: string,
  was: string,
  tastatur: Record<string, number>,
): Promise<number> {
  const schritte = await zuElement(seite, selektor, was);
  tastatur[was] = schritte;
  await seite.keyboard.press("Enter");
  return schritte;
}

/**
 * Eine Auswahl an einem nativen `<select>` mit der PFEILTASTE treffen.
 *
 * Wie die Rollenauswahl in `browserweg.ts:468-477`. Der Wert wird danach AM FELD gelesen — ein
 * blindes Drücken bewiese nur, dass eine Taste ankam, nicht, was gewählt wurde.
 */
export async function mitPfeilWaehlen(
  seite: Seite,
  selektor: string,
  was: string,
  anschlaege: number,
  erwartet: string,
  tastatur: Record<string, number>,
): Promise<void> {
  tastatur[was] = await zuElement(seite, selektor, was);
  for (let i = 0; i < anschlaege; i += 1) {
    await seite.keyboard.press("ArrowDown");
  }
  expect(
    await seite.evaluate<string>(fn(WAHLWERT), selektor),
    `${JOB}: „${was}" trägt nach ${anschlaege} Pfeilanschlägen nicht die gewählte Fassung`,
  ).toBe(erwartet);
}

/** Anmeldung über die ECHTE Maske, ausschliesslich mit der Tastatur. */
export async function anmelden(
  seite: Seite,
  basis: string,
  email: string,
  marke: string,
  tastatur: Record<string, number>,
): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  tastatur[`${marke}_email`] = await tippeMitTastatur(
    seite,
    "#auth-email",
    email,
    `E-Mail (${marke})`,
  );
  tastatur[`${marke}_passwort`] = await tippeMitTastatur(
    seite,
    "#auth-password",
    PASSWORT,
    `Passwort (${marke})`,
  );
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} trägt`,
    undefined,
    60_000,
  );
}

/**
 * Den Eintrag öffnen und den Fassungsabschnitt AUFMACHEN — beides mit der Tastatur.
 *
 * Zwei Schritte, weil die Fläche zwei hat: `/wissen/:id` legt die dreizehn Abschnitte hinter die
 * EINE Zeile „Mehr" (`BibliothekLesen.tsx:2869-2890`, zugeklappt als Vorgabe), und darin ist
 * „Schnappschüsse" ein `<details>` mit eigenem `<summary>` (`MehrAbschnitte.tsx:152-167`).
 */
export async function oeffneFassungsabschnitt(
  seite: Seite,
  basis: string,
  koId: string,
  titel: string,
  marke: string,
  tastatur: Record<string, number>,
): Promise<void> {
  await seite.goto(`${basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    "(t) => document.body.innerText.includes(t)",
    `die Leseansicht zeigt „${titel}"`,
    titel,
    60_000,
  );
  await warte(seite, GIBT_ES, `die Zeile „Mehr" (${marke})`, '[data-testid="bib-mehr"]');
  await mitTaste(seite, '[data-testid="bib-mehr"]', `${marke}_mehr`, tastatur);
  const kopf = '[data-bib-abschnitt="schnappschuesse"] > summary';
  await warte(seite, GIBT_ES, `der Abschnitt „Schnappschüsse" (${marke})`, kopf);
  await mitTaste(seite, kopf, `${marke}_abschnitt`, tastatur);
  await warte(
    seite,
    GIBT_ES,
    `die Fassungsliste ist geladen (${marke})`,
    `[data-bib-fassung="${koId}:1"]`,
    60_000,
  );
}

// ------------------------------------------------------------------------------------------------
// DIE BREMSE — wie der LADEZUSTAND beobachtbar wird, ohne ihn zu erfinden.
// ------------------------------------------------------------------------------------------------
//
// § 9 des Auftrags verlangt, die Übernahmelage in „laden", „erfolgreich" und „Konflikt" abzulesen.
// Die beiden Endzustände sind ohne Kunstgriff messbar. „Laden" ist es auf `127.0.0.1` nicht:
// zwischen Tastendruck und Antwort liegen wenige Millisekunden, und ein Nachweis, der mal greift
// und mal nicht, wäre ein Zufallsgenerator.
//
// WAS DIE BREMSE IST UND WAS SIE NICHT IST. Sie ist ein `onRequest`-Haken VOR der echten Route, der
// den PUT auf `/api/kos/**` um wenige hundert Millisekunden verzögert — also LAUFZEIT, wie sie jede
// echte Leitung beisteuert. Sie antwortet nicht selbst, ersetzt nichts und verändert weder Anfrage
// noch Antwort. Abgelesen wird danach derselbe Zustand, den ein Mensch an einer langsamen
// Verbindung sieht. Sie ist ausserhalb dieses Fensters AUS (`aktiv: false`).
export interface Bremse {
  aktiv: boolean;
  ms: number;
}

export function neueBremse(ms = 700): Bremse {
  return { aktiv: false, ms };
}

// ------------------------------------------------------------------------------------------------
// DIE MUTATION — NUR für die Kalibrierung, und nur im Prüfstand.
// ------------------------------------------------------------------------------------------------
//
// Sie sitzt als `preHandler` VOR der echten Route und lässt den Produktionscode unberührt (Auftrag
// § 5, Lieferung 5: „eine abgegrenzte Mutation nur in einer isolierten Testkopie"). Zwei Arten,
// beide eng auf EINEN Eintrag begrenzt:
//
//   · `ohne-wirkung`     — die Übernahme findet gar nicht statt, die Antwort sagt trotzdem 200.
//                          Das ist der Fall „der Knopf meldet Erfolg und es passiert nichts".
//   · `falsche-fassung`  — die Fassungsnummer wird unterwegs auf eine andere umgebogen. Das ist
//                          der Fall „es passiert etwas, aber der falsche Inhalt kommt an".
//   · `verlorener-bericht` — RUNDE 2, BENs Korrekturpflicht 2: Kernaussage und Fassungsnummer
//                          bleiben RICHTIG, allein der Bericht (`bodyHtml`) geht verloren. Aus der
//                          Übernahme wird dafür eine gewöhnliche Überarbeitung mit genau der
//                          Kernaussage der Zielfassung und einem geleerten Bericht; die Route
//                          antwortet 200, die Fläche meldet „übernommen", und im Datensatz fehlt
//                          der Fließtext. Das ist der Fall, den Runde 1 nicht sah.
export type Mutationsart = "keine" | "ohne-wirkung" | "falsche-fassung" | "verlorener-bericht";

/**
 * VERÄNDERLICH, und das mit Absicht: die Kennung des betroffenen Eintrags gibt es erst, wenn die
 * Instanz steht und der Eintrag über die echte Route angelegt ist. Der Haken liest sie bei JEDER
 * Anfrage neu — so trägt EIN Prüfstand nacheinander den ungestörten Lauf und beide Mutationen, und
 * es entstehen nicht drei Instanzen für dieselbe Frage.
 */
export interface Mutation {
  art: Mutationsart;
  koId: string;
  /** Auf welche Fassung `falsche-fassung` umbiegt. */
  stattdessen: number;
  /**
   * Welche Kernaussage `verlorener-bericht` schreibt — die RICHTIGE der Zielfassung. Sie wird
   * ausdrücklich korrekt gesetzt: geprüft werden soll, ob der fehlende BERICHT auffällt, nicht ob
   * irgendetwas auffällt.
   */
  kernZiel: string;
}

export function neueMutation(): Mutation {
  return { art: "keine", koId: "", stattdessen: 0, kernZiel: "" };
}

interface Uebernahmerumpf {
  action?: string;
  changes?: { restoredFromVersion?: number; statement?: string; bodyHtml?: string | null };
}

/**
 * Die gebaute Fläche vor das Horchen hängen (wie `server.ts:66`), die Bremse und — falls verlangt —
 * die Mutation davor.
 *
 * `vorListen` ist das einzige Fenster, in dem noch etwas dazukommen darf
 * (`tests/gast-nutzerweg/strecke.ts:160-165`).
 */
export function mitFlaecheBremseMutation(
  bremse: Bremse,
  mutation?: Mutation,
): { vorListen: (app: FastifyInstance) => Promise<void> } {
  const flaeche = mitFlaeche();
  return {
    vorListen: async (app: FastifyInstance): Promise<void> => {
      app.addHook("onRequest", async (request) => {
        if (bremse.aktiv && request.method === "PUT" && request.url.startsWith("/api/kos/")) {
          await new Promise((fertig) => setTimeout(fertig, bremse.ms));
        }
      });
      if (mutation) {
        app.addHook("preHandler", async (request, reply): Promise<FastifyReply | undefined> => {
          if (mutation.art === "keine" || mutation.koId === "") {
            return undefined;
          }
          if (request.method !== "PUT" || !request.url.startsWith(`/api/kos/${mutation.koId}`)) {
            return undefined;
          }
          const rumpf = request.body as Uebernahmerumpf | undefined;
          if (
            rumpf?.action !== "revise" ||
            typeof rumpf.changes?.restoredFromVersion !== "number"
          ) {
            return undefined;
          }
          if (mutation.art === "ohne-wirkung") {
            // Antwortet wie ein Erfolg, ohne dass etwas geschieht — genau der Fall, den Lieferung 5a
            // rot sehen muss.
            return reply.code(200).send({ id: mutation.koId, mutiert: mutation.art });
          }
          if (mutation.art === "verlorener-bericht") {
            // AUS DER ÜBERNAHME WIRD EINE GEWÖHNLICHE ÜBERARBEITUNG mit der richtigen Kernaussage
            // und geleertem Bericht. `restoredFromVersion` muss dabei fallen: eine Übernahme, die
            // Inhaltsfelder mitschickt, weist der Dienst ab (`service.ts:4095` —
            // `pruefeUebernahmeEingabe`), und abgewiesen wäre der falsche Fehler. `expectedVersion`
            // bleibt unangetastet, der Schreibweg ist derselbe, die Antwort ist 200 — an der Fläche
            // sieht diese Rückholung wie eine gelungene aus.
            rumpf.changes = { statement: mutation.kernZiel, bodyHtml: null };
            return undefined;
          }
          rumpf.changes.restoredFromVersion = mutation.stattdessen;
          return undefined;
        });
      }
      await flaeche.vorListen(app);
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DIE VORBEREITUNG — über die echten Routen, aber ausdrücklich KEIN Schritt des Weges.
// ------------------------------------------------------------------------------------------------

/** Ein Eintrag über die echte Route — Kernaussage und Bericht getrennt übergeben. */
export async function legeEintragAn(
  wer: Sitzung,
  titel: string,
  statement: string,
  bodyHtml: string,
): Promise<string> {
  const angelegt = mussGelingen(
    `POST /api/kos (${titel})`,
    await wer.sende("POST", "/api/kos", {
      // Ohne ausdrückliche Einstufung entsteht gar kein Wissensobjekt (`MISSING_CONFIDENTIALITY`).
      confidentiality: "intern",
      title: titel,
      statement,
      type: "technik",
      category: "Produktion",
      bodyHtml,
    }),
    201,
  );
  return (angelegt.json as { id: string }).id;
}

/**
 * Ein Eintrag mit so vielen Fassungen, wie Texte übergeben werden. Text n → Fassung v(n+1).
 *
 * JEDE FASSUNG TRÄGT ZWEI VERSCHIEDENE MARKEN — die Kernaussage ihre, der Bericht seine. Solange
 * beide dieselbe trugen, konnte die Kernaussage den verlorenen Bericht vertreten (s. o. bei den
 * Marken, BENs Befund an Runde 1).
 */
export async function legeFassungenAn(
  wer: Sitzung,
  titel: string,
  fassungen: readonly Fassungstext[],
): Promise<string> {
  const [erste, ...weitere] = fassungen;
  if (erste === undefined) {
    throw new Error(`${JOB}: ein Eintrag ohne erste Fassung ist keiner.`);
  }
  const id = await legeEintragAn(wer, titel, erste.kern, `<p>${erste.bericht}</p>`);
  for (const fassung of weitere) {
    mussGelingen(
      `PUT /api/kos/${id} (${fassung.kern})`,
      await ueberarbeite(wer, id, {
        statement: fassung.kern,
        bodyHtml: `<p>${fassung.bericht}</p>`,
      }),
    );
  }
  return id;
}

export function ueberarbeite(
  wer: Sitzung,
  koId: string,
  changes: Record<string, unknown>,
): Promise<Antwort> {
  return wer.sende("PUT", `/api/kos/${koId}`, { action: "revise", changes });
}

export interface Stand {
  version: number;
  statement: string;
  bodyHtml: string;
}

/** Der gespeicherte Stand — nachgesehen, nicht geraten. Kein Schritt des Weges, nur ein Blick. */
export async function holeStand(wer: Sitzung, koId: string): Promise<Stand> {
  const antwort = mussGelingen(`GET /api/kos/${koId}`, await wer.sende("GET", `/api/kos/${koId}`));
  const roh = antwort.json as { version: number; statement: string; bodyHtml?: string };
  return { version: roh.version, statement: roh.statement, bodyHtml: String(roh.bodyHtml ?? "") };
}

/** Ein Bild hochladen — OHNE eigene Stufe, so wie jeder normale Anhang-Upload es tut. */
export async function ladeBildHoch(wer: Sitzung, name: string): Promise<string> {
  const antwort = mussGelingen(
    `POST /api/objects (${name})`,
    await wer.sende("POST", "/api/objects", {
      name,
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    }),
    201,
  );
  return (antwort.json as { id: string }).id;
}

// ================================================================================================
// DER WEG.
// ================================================================================================

export interface RueckholAufbau {
  browser: Browser;
  strecke: Strecke;
  bremse: Bremse;
  /** Die API-Sitzung der Person, die im Browser sitzt — NUR zum Nachsehen und Vorbereiten. */
  eigeneApi: Sitzung;
  eigeneEmail: string;
  koId: string;
  titel: string;
  /** Welche Fassung zurückgeholt wird und welche Marken danach dastehen MÜSSEN — beide. */
  zielFassung: number;
  /** Die Kernaussage der Zielfassung (`statement`). */
  markeZiel: string;
  /**
   * Der BERICHT der Zielfassung (`bodyHtml`). Eigenes Feld, eigene Marke, eigene Prüfung: fehlt er,
   * zeichnet die Leseansicht die Kernaussage an seiner Stelle (`BibliothekLesen.tsx:2976-3004`) —
   * eine gemeinsame Marke hätte den Verlust zugedeckt (BEN, Runde 1).
   */
  berichtZiel: string;
  /** Die Fassungsnummer des aktuellen Standes VOR dem Weg. */
  standVorher: number;
  /**
   * Den Konfliktzustand (409 `KO_STALE`) unterwegs erzeugen und ablesen. Dafür schreibt zwischen
   * „Fassung angesehen" und „Übernahme ausgelöst" jemand anderes — erzwungen NACHEINANDER, nicht
   * dem Zufall überlassen (dieselbe Regel wie
   * `tests/wiki-nachvollziehen/uebernahme-ueberschreibt-fremdes-nicht.test.ts:9-12`).
   */
  fremderApi?: Sitzung;
}

export interface RueckholBefund {
  /** Je Bedienelement die Zahl der Tab-Anschläge. Eine Null gäbe es nicht — `zuElement` würfe. */
  tastatur: Record<string, number>;
  /** Der Text der Gegenüberstellung „ältere gegen jüngere Fassung". */
  vergleichStatement: string;
  /** Wurde der Ladezustand im echten Browser wirklich GELESEN? */
  ladenGelesen: boolean;
  /** Der Konfliktsatz, wörtlich von der Fläche — `null`, wenn kein Konflikt gefahren wurde. */
  konfliktSatz: string | null;
  /** Der Erfolgssatz, wörtlich von der Fläche. */
  erfolgSatz: string;
  /** Der Stand NACH dem Weg, aus einer erneut geöffneten Leseansicht im FRISCHEN Profil. */
  textImFrischenProfil: string;
  /** Derselbe Stand, unabhängig über die Route nachgesehen. */
  standNachher: Stand;
}

/**
 * DER GANZE WEG, in der Reihenfolge, in der ihn ein Mensch geht.
 *
 * Anmelden (echte Maske, Tastatur) → Eintrag öffnen → „Mehr" → „Schnappschüsse" → zwei Fassungen
 * zum Vergleich wählen (Pfeiltasten) → die alte Fassung aufklappen → [fremder Schreibvorgang] →
 * übernehmen (Enter) → Ladezustand, ggf. Konflikt, Erfolg ablesen → und das Ergebnis in einem
 * FRISCHEN Profil an der neu geöffneten Leseansicht lesen.
 *
 * WAS DIESE FUNKTION AUSDRÜCKLICH NICHT TUT: sie nimmt nichts, was unmittelbar nach dem Tastendruck
 * im DOM steht, als Ergebnis (Auftrag § 5, Lieferung 2d). Der Inhalt zählt erst, wenn er nach
 * erneutem Öffnen wieder dasteht — und im Integrationslauf zusätzlich nach Neustart und aus dem
 * Pool.
 *
 * Welche Ablagen darunter liegen, entscheidet der Aufrufer. Das ist der EINZIGE Unterschied
 * zwischen dem Tor-Lauf und dem PostgreSQL-Lauf.
 */
export async function fahreDieRueckholung(a: RueckholAufbau): Promise<RueckholBefund> {
  const basis = a.strecke.basis;
  const tastatur: Record<string, number> = {};
  const schluessel = `${a.koId}:${a.zielFassung}`;
  const uebernahmeKnopf = `[data-bib-fassung-uebernehmen="${schluessel}"]`;
  const erneutKnopf = `[data-bib-fassung-uebernehmen-erneut="${schluessel}"]`;
  const lageMarke = `[data-bib-fassung-uebernahme-lage="${schluessel}"]`;
  const eigenes = await profil(a.browser, BREIT);
  let ladenGelesen = false;
  let konfliktSatz: string | null = null;
  let vergleichStatement = "";
  let erfolgSatz = "";
  try {
    const seite = eigenes.seite;

    // ══ 1. Anmelden — an der echten Maske, mit der Tastatur. ═══════════════════════════════════
    await anmelden(seite, basis, a.eigeneEmail, "anmeldung", tastatur);
    expect(
      (await eigenes.kontext.cookies()).some((k) => k.name === "kw_session"),
      "die Anmeldung hat keinen eigenen Sitzungskeks gesetzt",
    ).toBe(true);

    // ══ 2. Den Eintrag öffnen und den Fassungsabschnitt aufmachen — zwei Tastendrücke. ═════════
    await oeffneFassungsabschnitt(seite, basis, a.koId, a.titel, "eintrag", tastatur);

    // ══ 3. ZWEI FASSUNGEN VERGLEICHEN, vollständig über die sichtbare Oberfläche. ══════════════
    //
    // Die Auswahlfelder führen die Fassungen NEUESTE ZUERST, davor den leeren Eintrag („noch nicht
    // gewählt" ist ein eigener Zustand, `MehrAbschnitte.tsx:2031-2033`). Vom leeren Eintrag aus ist
    // die ÄLTESTE Fassung damit der letzte: so viele Pfeilanschläge, wie es Fassungen gibt.
    await warte(seite, GIBT_ES, "die Vergleichsfläche", "[data-bib-fassung-vergleich-flaeche]");
    await mitPfeilWaehlen(
      seite,
      '[data-bib-fassung-vergleich="von"]',
      "vergleich_von",
      a.standVorher,
      String(a.zielFassung),
      tastatur,
    );
    await mitPfeilWaehlen(
      seite,
      '[data-bib-fassung-vergleich="bis"]',
      "vergleich_bis",
      1,
      String(a.standVorher),
      tastatur,
    );
    await warte(
      seite,
      GIBT_ES,
      "die Gegenüberstellung der Kernaussage",
      '[data-bib-fassung-vergleich-feld="statement"]',
    );
    vergleichStatement =
      (await seite.evaluate<string | null>(
        fn(TEXT_VON),
        '[data-bib-fassung-vergleich-feld="statement"]',
      )) ?? "";

    // ══ 4. Die alte Fassung aufklappen. ═══════════════════════════════════════════════════════
    await mitTaste(seite, `[data-bib-fassung="${schluessel}"]`, "fassung_aufklappen", tastatur);
    await warte(
      seite,
      GIBT_ES,
      `der Übernahmeknopf der Fassung v${a.zielFassung}`,
      uebernahmeKnopf,
    );

    // ══ 5. ZWISCHEN ANSEHEN UND ÜBERNEHMEN SCHREIBT JEMAND ANDERES. ═══════════════════════════
    if (a.fremderApi) {
      const fremd = await ueberarbeite(a.fremderApi, a.koId, {
        statement: MARKE_FREMD,
        bodyHtml: `<p>${BERICHT_FREMD}</p>`,
      });
      expect(fremd.status, `der fremde Schreibvorgang kam nicht durch: ${fremd.text}`).toBe(200);
    }

    // ══ 6. ÜBERNEHMEN — Tab, sichtbarer Fokus, ENTER. ═════════════════════════════════════════
    a.bremse.aktiv = true;
    await mitTaste(seite, uebernahmeKnopf, "uebernehmen", tastatur);
    ladenGelesen = await lesLadezustand(seite, uebernahmeKnopf);

    if (a.fremderApi) {
      // DER KONFLIKT: es wurde nichts überschrieben, und die Fläche sagt genau das.
      await warte(seite, GIBT_ES, "die Konfliktauskunft", lageMarke, 60_000);
      konfliktSatz = (await seite.evaluate<string | null>(fn(TEXT_VON), lageMarke)) ?? "";
      expect(konfliktSatz, "die Fläche meldet den Konflikt nicht").toContain(
        T("ko.snapshotRestoreStale"),
      );
      // Das Vorhaben bleibt: derselbe Weg steht als AUSDRÜCKLICHER zweiter Griff daneben.
      await warte(seite, GIBT_ES, "der zweite Griff nach dem Konflikt", erneutKnopf);
      await mitTaste(seite, erneutKnopf, "uebernehmen_erneut", tastatur);
      ladenGelesen = (await lesLadezustand(seite, erneutKnopf)) || ladenGelesen;
    }

    await warte(
      seite,
      TRAEGT_TEXT,
      "die Fläche meldet die gelungene Übernahme",
      [lageMarke, T("ko.snapshotRestoreDone", { version: a.zielFassung })],
      90_000,
    );
    erfolgSatz = (await seite.evaluate<string | null>(fn(TEXT_VON), lageMarke)) ?? "";
  } finally {
    a.bremse.aktiv = false;
    await eigenes.kontext.close();
  }

  // ══ 7. UND JETZT ERST ZÄHLT ES. ═══════════════════════════════════════════════════════════
  //
  // ZUERST die billige Frage am gespeicherten Zielobjekt (ist überhaupt etwas passiert, und das
  // Richtige?), DANN die teure am wiedergeöffneten Bildschirm. Die Reihenfolge ist kein Zufall: an
  // ihr hängt, wie schnell die Kalibrierung (`kalibrierung.test.ts`) ihre beiden Mutationen rot
  // sieht — und die Zusage „nach erneutem Öffnen wieder da" bleibt davon unberührt, sie steht
  // darunter und wird in jedem gelungenen Lauf gemessen.
  const standNachher = await holeStand(a.eigeneApi, a.koId);
  expect(
    standNachher.version,
    `die Übernahme hat keine neue Fassung erzeugt (vorher v${a.standVorher}, jetzt v${standNachher.version}) — sie hat NICHT stattgefunden`,
  ).toBeGreaterThan(a.standVorher);
  expect(
    standNachher.statement,
    `gespeichert ist der Inhalt einer ANDEREN Fassung als v${a.zielFassung}`,
  ).toBe(a.markeZiel);
  // ── UND DER BERICHT, ALS EIGENE FRAGE. ────────────────────────────────────────────────────────
  //
  // Eine Rückholung, die nur die Kernaussage rettet, ist keine: der Fließtext IST der Inhalt, den
  // ein Mensch zurückholen will. BEN hat in Runde 1 genau diesen Verlust im Prüfprozess erzeugt
  // (`"vorher":"<p>…</p>","nachher":null`), und dieser Weg blieb grün, weil hier nur Version und
  // `statement` gelesen wurden. Jetzt steht die Frage getrennt da — mit eigener Marke.
  expect(
    standNachher.bodyHtml,
    `der Berichtstext der Fassung v${a.zielFassung} fehlt im gespeicherten Stand (Kernaussage und Fassungsnummer sagen darüber nichts — sie können richtig sein, während der Bericht verloren ist)`,
  ).toContain(a.berichtZiel);
  const textImFrischenProfil = await liesImFrischenProfil(
    a.browser,
    basis,
    a.eigeneEmail,
    a.koId,
    a.titel,
  );
  // WAS DIE LESEANSICHT ZEIGT — GEMESSEN, NICHT ANGENOMMEN.
  //
  // Sie zeichnet den BERICHT; die Kernaussage steht dort NUR als Ersatz, wenn kein Bericht da ist
  // (`BibliothekLesen.tsx:2976-3004`, Zweige `ko.bodyHtml ? … : <p>{ko.statement}</p>`). Der erste
  // Lauf dieser Runde hat das belegt: mit getrennten Marken verlangte diese Stelle die Kernaussage
  // auf der Seite und wurde rot — „expected 'KLARWERK\nStart\n…' to contain 'ᚠᚨᛊᛊᚢᚾᚷᚨᛚᛏ4263'"
  // (Arbeitsprüfung 077e1b3a648b4dcca8f77c5a3de7744e, K1 und R1). Solange beide Felder DIESELBE
  // Marke trugen, sah niemand, welches der beiden die Seite eigentlich zeigte.
  //
  // DARUM STEHT DIE ZUSAGE JETZT DORT, WO SIE HINGEHÖRT: der Bericht wird auf der SEITE geprüft
  // (er ist das, was ein Mensch liest), die Kernaussage am GESPEICHERTEN STAND (oben). Die
  // Gegenrichtung — Kernaussage auf der Seite, sobald der Bericht fehlt — misst
  // `kalibrierung.test.ts`, Fall K4.
  expect(
    textImFrischenProfil,
    `die erneut geöffnete Leseansicht zeigt den BERICHT der Fassung v${a.zielFassung} nicht`,
  ).toContain(a.berichtZiel);

  return {
    tastatur,
    vergleichStatement,
    ladenGelesen,
    konfliktSatz,
    erfolgSatz,
    textImFrischenProfil,
    standNachher,
  };
}

/**
 * Den LADEZUSTAND ablesen — ohne ihn zu behaupten.
 *
 * Wird er nicht erreicht, ist das eine ehrliche Null und keine Aussage „gibt es nicht"
 * (Auftrag § 9). Der Befund trägt sie bis in den Bericht.
 */
async function lesLadezustand(seite: Seite, knopf: string): Promise<boolean> {
  try {
    await browserWarte(
      seite,
      LAEUFT_GERADE,
      "der Ladezustand des Übernahmeknopfes",
      [knopf, T("ko.snapshotRestoreRunning")],
      8_000,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Ein FRISCHES Browserprofil liest denselben Eintrag noch einmal.
 *
 * `browser.newContext()` gibt einen eigenen Keks- und Speicherzustand — die technische Entsprechung
 * zu „ein frisches, getrenntes Browserprofil" (`gastweg-im-echten-browser.test.ts:18-20`). Dass
 * hier neu angemeldet werden MUSS, ist Teil der Zusage: nichts wird aus dem alten Profil geerbt.
 */
export async function liesImFrischenProfil(
  browser: Browser,
  basis: string,
  email: string,
  koId: string,
  titel: string,
): Promise<string> {
  const frisch = await profil(browser, BREIT);
  try {
    expect(
      (await frisch.kontext.cookies()).some((k) => k.name === "kw_session"),
      "ein frisches Profil trägt bereits einen Sitzungskeks",
    ).toBe(false);
    await anmelden(frisch.seite, basis, email, "frischesProfil", {});
    await frisch.seite.goto(`${basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
    await warte(
      frisch.seite,
      "(t) => document.body.innerText.includes(t)",
      `die Leseansicht im frischen Profil zeigt „${titel}"`,
      titel,
      60_000,
    );
    return await frisch.seite.evaluate<string>(fn(LIES_TEXT));
  } finally {
    await frisch.kontext.close();
  }
}

// ================================================================================================
// DIE NEGATIVKONTROLLEN — im selben Weg, mit denselben Handgriffen.
// ================================================================================================

export interface RechteBefund {
  knopfDa: boolean;
  satzAmInhalt: string;
  direkterGriff: { status: number; rumpf: string };
  standDanach: Stand;
}

/**
 * OHNE ÜBERNAHMERECHT: der Knopf ist nicht da UND der Server weist ab.
 *
 * BEIDES, nicht eines (Auftrag § 8, Prüfpunkt 4): dass an der Fläche kein Knopf steht, sagt über
 * den Server nichts — und ein abgewiesener Aufruf sagt nichts darüber, ob jemand vergeblich einen
 * Knopf drückt. Der direkte Griff geht deshalb AUS DER SEITE HERAUS, mit genau den Keksen dieses
 * Profils.
 */
export async function fahreRechtekontrolle(
  browser: Browser,
  strecke: Strecke,
  leserEmail: string,
  leserApi: Sitzung,
  koId: string,
  titel: string,
  zielFassung: number,
): Promise<RechteBefund> {
  const tastatur: Record<string, number> = {};
  const leser = await profil(browser, BREIT);
  try {
    await anmelden(leser.seite, strecke.basis, leserEmail, "leser", tastatur);
    await oeffneFassungsabschnitt(leser.seite, strecke.basis, koId, titel, "leser", tastatur);
    await mitTaste(
      leser.seite,
      `[data-bib-fassung="${koId}:${zielFassung}"]`,
      "leser_fassung",
      tastatur,
    );
    const inhalt = `[data-bib-fassung-inhalt="${koId}:${zielFassung}"]`;
    await warte(leser.seite, GIBT_ES, "der aufgeklappte Inhalt der alten Fassung", inhalt);
    const knopfDa = await leser.seite.evaluate<boolean>(
      fn(GIBT_ES),
      `[data-bib-fassung-uebernehmen="${koId}:${zielFassung}"]`,
    );
    const satzAmInhalt = (await leser.seite.evaluate<string | null>(fn(TEXT_VON), inhalt)) ?? "";
    const direkterGriff = await leser.seite.evaluate<{ status: number; rumpf: string }>(
      fn(DIREKTER_GRIFF),
      { id: koId, version: zielFassung },
    );
    return { knopfDa, satzAmInhalt, direkterGriff, standDanach: await holeStand(leserApi, koId) };
  } finally {
    await leser.kontext.close();
  }
}

export interface AnhangBefund {
  lageSatz: string;
  bildVorher: number;
  bildNachher: number;
  standDanach: Stand;
}

/**
 * EIN ANHANG, DER AUS EINER ÄLTEREN FASSUNG ENTFERNT WURDE, BLEIBT GESPERRT.
 *
 * VERHÄLTNIS ZU `tests/wiki-nachvollziehen/uebernahme-belebt-keinen-anhang.test.ts`: dort wird
 * dieselbe Kette am DIENST gefahren (`app.inject`, kein Socket, keine Fläche, kein Tastendruck) und
 * der Rückgabewert der Route gelesen. Hier wird sie AM ECHTEN WEG gefahren: die Person drückt den
 * Knopf mit der Tastatur in echtem Chromium und liest die Absage auf der Fläche; der Dritte holt
 * die Rohbytes davor und danach über seine eigene Sitzung. Keine der beiden Aussagen ersetzt die
 * andere.
 */
export async function fahreAnhangkontrolle(
  browser: Browser,
  strecke: Strecke,
  eigeneEmail: string,
  eigeneApi: Sitzung,
  dritterApi: Sitzung,
  koId: string,
  titel: string,
  bildId: string,
  zielFassung: number,
): Promise<AnhangBefund> {
  const tastatur: Record<string, number> = {};
  const rohbytes = async (): Promise<number> =>
    (await dritterApi.sende("GET", `/api/objects/${bildId}/raw`)).status;
  const bildVorher = await rohbytes();
  const eigenes = await profil(browser, BREIT);
  try {
    await anmelden(eigenes.seite, strecke.basis, eigeneEmail, "anhangweg", tastatur);
    await oeffneFassungsabschnitt(eigenes.seite, strecke.basis, koId, titel, "anhang", tastatur);
    await mitTaste(
      eigenes.seite,
      `[data-bib-fassung="${koId}:${zielFassung}"]`,
      "anhang_fassung",
      tastatur,
    );
    const knopf = `[data-bib-fassung-uebernehmen="${koId}:${zielFassung}"]`;
    await warte(eigenes.seite, GIBT_ES, "der Übernahmeknopf am Anhangsfall", knopf);
    await mitTaste(eigenes.seite, knopf, "anhang_uebernehmen", tastatur);
    const lageMarke = `[data-bib-fassung-uebernahme-lage="${koId}:${zielFassung}"]`;
    await warte(
      eigenes.seite,
      GIBT_ES,
      "die Auskunft zur abgewiesenen Übernahme",
      lageMarke,
      60_000,
    );
    const lageSatz = (await eigenes.seite.evaluate<string | null>(fn(TEXT_VON), lageMarke)) ?? "";
    return {
      lageSatz,
      bildVorher,
      bildNachher: await rohbytes(),
      standDanach: await holeStand(eigeneApi, koId),
    };
  } finally {
    await eigenes.kontext.close();
  }
}
