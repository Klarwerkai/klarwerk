// ================================================================================================
// JOB 4362 · DER MENÜWEG ZUR GESAMTANWEISUNG OHNE MAUS — DIE STATIONEN, GENAU EINMAL.
// ================================================================================================
//
// DIE FRAGE DIESES AUFTRAGS ist der Rest, den JOB 4309 selbst benannt hat (4309 R1, REST Punkt 2):
// der Menüweg zur Gesamtanweisung war ausschliesslich per KLICK belegt. Sie lautet:
//
//     Erreicht ein Mensch, der nur die Tastatur benutzt, ab `/start` nacheinander das Zahnrad,
//     „Bereiche“ und den Punkt „Gesamtanweisungen“ — mit sichtbarem Fokus — und steht danach die
//     Seite? Und schliesst Escape das Menü mit Fokusrückgabe?
//
// FE-002 (HEADER TEIL 1, 26.09.2026) HAT DEN WEG VERKÜRZT, nicht die Frage: die weiteren Bereiche
// stehen seither unter dem beschrifteten Einstieg „Arbeitsbereiche“ im Kopfband, OFFEN statt in
// einem Untermenü des Zahnrads. Der Weg heisst jetzt „Arbeitsbereiche“ → „Gesamtanweisungen“ →
// die Seite steht. Die Stationen bleiben, ihr Gegenstand ist nachgeführt:
//   1  „Arbeitsbereiche“ per Tab erreichen (sichtbarer Fokus), mit Enter öffnen
//   2  der Einstieg SAGT sein Öffnen an (`aria-expanded=true` am Auslöser) — vorher das Untermenü
//   3  der Menüpunkt per Tab und Enter
//   4  die Seite steht
// K2 fragt jetzt, ob der Punkt NOCH hinter dem Zahnrad liegt (er darf es nicht — FE-002), K3 misst
// Escape und Fokusrückgabe am neuen Einstieg und die Nachbarn in beiden Menüs.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ECHT IST — und was ein Nachweis aus diesen Stationen deshalb behaupten darf.
// ------------------------------------------------------------------------------------------------
//   · DIE GEBAUTE FLÄCHE (`apps/web/dist`), ausgeliefert von einer ECHTEN Fastify-Instanz auf einem
//     echten Port (`mitFlaeche()` → `registerWebStatic`, derselbe Aufruf wie `server.ts:66`).
//   · EIN ECHTES CHROMIUM. Keine `page.route`-Abfangung, kein vorgesetzter Bearer: es trägt die
//     echte Sitzung aus der echten Anmeldemaske.
//   · ECHTE TASTENDRÜCKE. In dieser Datei und in ihren beiden Aufrufern kommt `.click(` NICHT vor;
//     jedes Bedienelement wird über Tab erreicht, sein SICHTBARER Fokus am berechneten Stil
//     nachgemessen und mit Enter ausgelöst.
//
// WAS SIE NICHT BELEGT und deshalb nirgends behauptet wird: andere Browser, den Word-Add-in-Host,
// Bildschirmleser, echte PostgreSQL (das misst der Schwesterlauf
// `tests/gesamtanweisung-nutzerweg/menueweg-tastatur-sprachen-prozess.integration.test.ts` gegen
// einen echten Serverprozess) und die Bedienung der Gesamtanweisungsseite SELBST. Diese Stationen
// enden an ihrer Schwelle.
//
// ------------------------------------------------------------------------------------------------
// WARUM KEIN TESTMARKER DER GESAMTANWEISUNGSSEITE FESTGESCHRIEBEN WIRD
// ------------------------------------------------------------------------------------------------
// JOB 4323 endete seinen Menüweg auf `[data-testid="ga-bereich-anlegen"]` — dem ANLEGEFORMULAR. Das
// war am Tag seiner Entstehung richtig und ist eine Fessel: JOB 4357 hat dem Einstieg eine
// Bestandsliste vorangestellt, und jeder weitere Umbau dieser Seite machte einen Menüweg rot, an
// dem nichts fehlt. Der Nachweis hier endet deshalb an dem, was der Auftrag zusagt und was ein
// Mensch wirklich sieht: die ADRESSE steht auf `/gesamtanweisungen`, und der ausgelieferte
// Seitenhauptbereich (`<main>`, `AppShell.tsx:102`/`:142`) trägt SICHTBAR die Überschrift des
// Bereichs in der Sprache der Anwenderin. Das gilt im Formular- wie im Listenzustand.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIE STATIONEN HIER UND NICHT IN DER TESTDATEI STEHEN
// ------------------------------------------------------------------------------------------------
// Die Kalibrierungsdatei daneben fährt DIESELBEN Stationen mit einer gezielten Verstellung. Stünden
// sie zweimal ausgeschrieben da, wäre die Kalibrierung eine Aussage über ihre eigene Kopie und
// nicht über den Nachweis — dasselbe Argument, mit dem `tests/gast-nutzerweg/browserweg.ts:7-17`
// seinen einen Weg begründet.
import { expect } from "vitest";
import type { Sprache } from "../../services/auth/src/meldungen";
import {
  type Browser,
  type Kontext,
  type Seite,
  fn,
  profil,
  tabBisText,
  warte,
} from "../gast-nutzerweg/browserweg";
import {
  fokusMussSichtbarSein,
  mussSichtbarTragen,
  sichtbefund,
  tabBisBeschriftungUndEnter,
  tabUndEnter,
} from "../gesamtanweisung-nutzerweg/weg";
import { sprachbestand } from "../support/i18nBestand";

export const MARKE = "JOB 4362 TASTATURWEG";

/** Die drei Sprachen, die der Auftrag verlangt. */
export const SPRACHEN = ["de", "en", "nl"] as const;

/**
 * Ein Schreibtischgerät. NICHT die schmale Kante (390 px) des Hausprofils: dort ersetzt die Hülle
 * das Kopfband durch den Off-Canvas-Drawer (`MobileNavDrawer`), und dann führe dieser Weg über ein
 * anderes Bedienelement als das, von dem der Auftrag spricht.
 */
export const BREIT = { width: 1280, height: 900 } as const;

/** FE-002: der beschriftete Einstieg „Arbeitsbereiche“ — er trägt auch `aria-expanded`. */
export const AUSLOESER = '[data-testid="kopfband-arbeitsbereiche"]';
export const MENUEFLAECHE = '[data-testid="arbeitsbereiche-menue"]';
/** Das Zahnrad („Einstellungen und Hilfe“) — K2 misst, dass der Punkt dort NICHT mehr liegt. */
export const ZAHNRAD = '[data-testid="kopfband-zahnrad"]';
export const ZAHNRAD_MENUE = '[data-testid="zahnrad-menue"]';
export const EINTRAG = '[data-testid="bereich-gesamtanweisungen"]';
export const GESAMTANWEISUNG_PFAD = "/gesamtanweisungen";

/**
 * Der Seitenhauptbereich — `<main>` der Hülle, und seine erste Überschrift.
 *
 * KEIN `[data-testid="ga-…"]`: die Begründung steht im Kopf dieser Datei. `<main>` ist der Anker,
 * den die Hülle an beiden Kanten baut (`AppShell.tsx:102` und `:142`), und die Seite legt genau
 * eine `<h1>` hinein (`GesamtanweisungBereich.tsx:337`).
 */
export const HAUPTBEREICH = "main";
export const HAUPTUEBERSCHRIFT = "main h1";

/** Die Sprache, auf die die gebaute Fläche wirklich steht (`<html lang>`). */
export const FLAECHENSPRACHE = "() => document.documentElement.lang";

/**
 * Dieselbe Frage als Wartebedingung.
 *
 * RUNDE 2: Bis hierher wurde `FLAECHENSPRACHE` unmittelbar nach dem Seitenaufbau EINMAL gelesen.
 * `i18n` setzt `<html lang>` aber erst beim Anlauf der Fläche; unter Last ist ein einzelner Blick
 * darauf ein Wettlauf — derselbe Fehlerbau, der die Überschrift der nachgeladenen Route rot gemacht
 * hat. Gewartet wird jetzt, und erst danach wird zugesichert.
 */
export const FLAECHE_STEHT_AUF = "(s) => document.documentElement.lang === s";

/** Die Sollwerte kommen aus dem Sprachkatalog der Oberfläche — nicht aus einer Abschrift hier. */
export interface Sollwerte {
  bereiche: string;
  eintrag: string;
  seitenhilfe: string;
  schnellnavigation: string;
  hilfe: string;
}

/**
 * Die erwarteten Beschriftungen einer Sprache.
 *
 * Jeder Wert wird auf NICHTLEERE geprüft: ein `includes("")` wäre immer wahr, und der ganze
 * Nachweis darunter bliebe grün, während die Beschriftung aus dem Katalog verschwände.
 */
export function sollwerte(sprache: string): Sollwerte {
  const bestand = sprachbestand(sprache);
  const hole = (schluessel: string): string => {
    const wert = bestand[schluessel];
    expect(
      wert,
      `${MARKE}: der Sprachkatalog „${sprache}" führt „${schluessel}" nicht — dann misst dieser Nachweis nichts`,
    ).toBeTruthy();
    return wert as string;
  };
  return {
    bereiche: hole("fe002.arbeitsbereiche"),
    eintrag: hole("ga.bereich.titel"),
    seitenhilfe: hole("menue.seitenhilfe"),
    schnellnavigation: hole("fe002.seiteFindenMenue"),
    hilfe: hole("nav.help"),
  };
}

// ------------------------------------------------------------------------------------------------
// DIE SKRIPTE, DIE IM BROWSER LAUFEN
// ------------------------------------------------------------------------------------------------

const AKTIV_IST = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";

/** Woran der Fokus gerade hängt — für Meldungen, die auf den Schuldigen zeigen. */
const AKTIV_BESCHREIBUNG = `() => {
  const a = document.activeElement;
  if (!a) return "(nichts)";
  const marke = a.getAttribute("data-testid");
  return [
    "<" + a.tagName.toLowerCase() + ">",
    marke ? "[" + marke + "]" : "",
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "„" + (a.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60) + "“",
  ].join(" ");
}`;

const FLAECHE_HAT_FOKUS = `(sel) => {
  const f = document.querySelector(sel);
  return !!f && !!document.activeElement && f.contains(document.activeElement);
}`;

const ARIA_AUFGEKLAPPT = `(sel) => document.querySelector(sel)?.getAttribute("aria-expanded") === "true"`;

export const ARIA_STAND = `(sel) => document.querySelector(sel)?.getAttribute("aria-expanded") ?? "(kein Attribut)"`;

export const IM_DOKUMENT = "(sel) => !!document.querySelector(sel)";

const HREF_VON = `(sel) => document.querySelector(sel)?.getAttribute("href") ?? "(kein href)"`;

/** Ein einzelner Tab-Halt: wo er liegt, wie er heisst und ob er IM Zahnrad-Menü liegt. */
const TABHALT = `(arg) => {
  const a = document.activeElement;
  const flaeche = document.querySelector(arg.flaeche);
  if (!a) return { marke: "(nichts)", text: "", imMenue: false };
  const marke = a.getAttribute("data-testid");
  return {
    marke: a.tagName.toLowerCase() + (marke ? "[" + marke + "]" : ""),
    text: (a.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80),
    imMenue: !!flaeche && a !== flaeche && flaeche.contains(a),
  };
}`;

const PFAD_STEHT = "(p) => window.location.pathname === p";

const NICHT_IM_DOKUMENT = "(sel) => !document.querySelector(sel)";

const PFAD_JETZT = "() => window.location.pathname";

/**
 * RUNDE 2 · IST DIE NACHGELADENE ROUTE WIRKLICH GEZEICHNET?
 *
 * DER FEHLER, GEGEN DEN DIESE BEDINGUNG STEHT, hat das Tor der Runde 1 rot gemacht — und er war
 * meiner: gewartet wurde auf die blosse ANWESENHEIT von `main h1`. Die Routen dieser App werden
 * aber nachgeladen (`routes.tsx:226`, `<Suspense fallback={<Splash />}>`), und React hält den alten
 * Teilbaum währenddessen mit `display: none` im Dokument. Die Überschrift der STARTSEITE erfüllte
 * das Warten also sofort, während sichtbar noch „Lädt …" dastand. Unter der Last des Tors traf das
 * jedes Mal:
 *
 *     der ausgelieferte Seitenhauptbereich zeigt in „de" nicht „Gesamtanweisungen"
 *     — sichtbar steht dort „Lädt …" (verborgen: Was möchtest du wissen? | Meine Entwürfe | …)
 *
 * WAS DAS WAR UND WAS NICHT: kein Produktfehler und auch kein Falschgrün, sondern ein WETTLAUF IM
 * PRÜFSTAND. Der Fall wurde rot, obwohl am Menüweg nichts fehlte — und seine Meldung zeigte auf die
 * falsche Stelle („der Seitenhauptbereich zeigt nicht ‚Gesamtanweisungen'"), während die wahre
 * Ursache „die Route ist noch nicht da" hiess. Ein Nachweis, der bei Last das Falsche misst, ist
 * unbrauchbar, auch wenn er in Ruhe zehnmal grün war.
 *
 * Ein Warten, das ein STEHENGEBLIEBENES Element als Ziel annimmt, ist kein Warten. Diese Bedingung
 * ist deshalb STRUKTURELL und nicht inhaltlich: sie fragt, ob die erste Überschrift des
 * Seitenhauptbereichs GEZEICHNET wird (`checkVisibility` samt Deckkraft, eigene Fläche, nichtleerer
 * `innerText`) — und nicht, ob dort der erwartete Titel steht. Genau deshalb ist sie nicht
 * zirkulär: WAS dort steht, sichern erst die Zusicherungen danach zu, und die messen wieder je
 * Textknoten (`sichtbefund`).
 *
 * `innerText` und nicht `textContent`: Lehre 9 des Hauses — der Rückfall der Ladefläche hat gar
 * keine Überschrift, die verborgene der Startseite hat `textContent`, aber keinen `innerText`.
 */
const UEBERSCHRIFT_GEZEICHNET = `(sel) => {
  const kopf = document.querySelector(sel);
  if (!kopf) return false;
  if (typeof kopf.checkVisibility !== "function") return false;
  if (!kopf.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
  const r = kopf.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  return (kopf.innerText || "").trim().length > 0;
}`;

// ------------------------------------------------------------------------------------------------
// DIE STATIONEN
// ------------------------------------------------------------------------------------------------

/**
 * Ein frisches Browserprofil in DIESER Sprache, auf einem Schreibtischgerät.
 *
 * Die Sprache wird GESETZT (`kw.sprache`, gelesen beim Start von `i18n.ts`) und nicht über den
 * Schalter gewählt: Gegenstand dieses Auftrags ist der MENÜWEG in Anwendersprache, nicht der
 * Sprachschalter — den misst JOB 4323 (`spracheWechseln`). Das Gebietsschema des Profils bleibt
 * dabei `de-DE` (Hausregel `browserweg.ts:387-404`), damit eine fremdsprachige Fläche nicht schon
 * aus `Accept-Language` entstehen kann.
 */
export function profilFuer(
  browser: Browser,
  sprache: Sprache,
): Promise<{ kontext: Kontext; seite: Seite }> {
  return profil(browser, BREIT, sprache);
}

/**
 * STATION 1 · „Arbeitsbereiche“ per Tab erreichen, sichtbaren Fokus nachmessen, mit Enter öffnen.
 *
 * FE-002: bis hierher war Station 1 das Zahnrad (Selektorweg, es trug nur ein `aria-label`). Der
 * neue Einstieg trägt sein Wort sichtbar; erreicht wird er trotzdem über den Selektor, damit die
 * Zählung der Tab-Schritte dieselbe Bauart behält.
 *
 * Nach dem Öffnen wird nachgemessen, dass der Fokus WIRKLICH im Menü steht — sonst führte jeder
 * Tab-Weg darunter an ihm vorbei, und die Zahlen sagten etwas über die Seite statt über das Menü.
 */
export async function oeffneArbeitsbereiche(
  seite: Seite,
  sprache: string,
  frist = 30_000,
): Promise<number> {
  await warte(
    seite,
    IM_DOKUMENT,
    `das Kopfband mit „Arbeitsbereiche“ (${sprache})`,
    AUSLOESER,
    45_000,
  );
  const schritte = await tabUndEnter(seite, AUSLOESER, `Arbeitsbereiche (${sprache})`, 250, true);
  await warte(
    seite,
    IM_DOKUMENT,
    `das geöffnete Menü „Arbeitsbereiche“ (${sprache})`,
    MENUEFLAECHE,
    frist,
  );
  await warte(
    seite,
    FLAECHE_HAT_FOKUS,
    `der Fokus steht nach dem Öffnen IM Menü „Arbeitsbereiche“ (${sprache})`,
    MENUEFLAECHE,
    frist,
  );
  return schritte;
}

/** Das Zahnrad-Menü („Einstellungen und Hilfe“) per Tab und Enter öffnen — für K2 und K3. */
export async function oeffneZahnrad(
  seite: Seite,
  sprache: string,
  frist = 30_000,
): Promise<number> {
  await warte(seite, IM_DOKUMENT, `das Kopfband mit dem Zahnrad (${sprache})`, ZAHNRAD, 45_000);
  const schritte = await tabUndEnter(seite, ZAHNRAD, `Zahnrad (${sprache})`, 250, true);
  await warte(seite, IM_DOKUMENT, `das geöffnete Zahnrad-Menü (${sprache})`, ZAHNRAD_MENUE, frist);
  await warte(
    seite,
    FLAECHE_HAT_FOKUS,
    `der Fokus steht nach dem Öffnen IM Zahnrad-Menü (${sprache})`,
    ZAHNRAD_MENUE,
    frist,
  );
  return schritte;
}

/**
 * STATION 2 · Der Einstieg trägt sein Wort SICHTBAR und SAGT sein Öffnen an.
 *
 * `aria-expanded=true` ist die ZUSAGE an die Tastatur- und Vorlesebedienung und wird deshalb
 * eigens nachgemessen; ein Menü, das sichtbar aufgeht und es nicht ansagt, ist für einen
 * Bildschirmleser zu. (Bis FE-002 stand diese Zusage am Untermenü „Bereiche“ im Zahnrad.)
 */
export async function arbeitsbereicheSagenOeffnenAn(
  seite: Seite,
  sollBereiche: string,
  sprache: string,
  frist = 30_000,
): Promise<void> {
  await mussSichtbarTragen(
    seite,
    AUSLOESER,
    sollBereiche,
    `der Einstieg heisst in „${sprache}" nicht „${sollBereiche}"`,
  );
  try {
    await warte(
      seite,
      ARIA_AUFGEKLAPPT,
      `der geöffnete Einstieg „${sollBereiche}" sagt es an (${sprache})`,
      AUSLOESER,
      frist,
    );
  } catch (fehler) {
    // Der STAND wird erst JETZT gelesen — er unterscheidet „false" (falsch angesagt) von „(kein
    // Attribut)" (gar nicht angesagt).
    throw new Error(
      `${MARKE}: ${String(fehler)}\naria-expanded an ${AUSLOESER} steht auf „${await seite.evaluate<string>(fn(ARIA_STAND), AUSLOESER)}"`,
    );
  }
}

/**
 * STATION 3 · Der Menüpunkt: erst DA, SICHTBAR und richtig beschriftet, dann per Tab und Enter.
 *
 * Über die BESCHRIFTUNG und nicht über die Marke: ein Mensch sucht den Namen. Und es ist der Weg,
 * der eine zerstörte Bedienbarkeit auch benennt — `tabBisText` sagt bei einem Element ausserhalb
 * der Tab-Reihenfolge wörtlich „das ist die Halbheit ‚nur mit der Maus'". Dass der Tab-Weg dabei
 * beim gemeinten Element landet, misst `tabBisBeschriftungUndEnter` danach am Selektor nach.
 */
export async function waehleGesamtanweisungen(
  seite: Seite,
  sollEintrag: string,
  sprache: string,
  frist = 30_000,
): Promise<{ schritte: number; beschriftung: string; href: string }> {
  await warte(
    seite,
    IM_DOKUMENT,
    `der Menüpunkt „${sollEintrag}" im geöffneten Menü „Arbeitsbereiche“ (${sprache})`,
    EINTRAG,
    frist,
  );
  const beschriftung = await mussSichtbarTragen(
    seite,
    EINTRAG,
    sollEintrag,
    `der Menüpunkt trägt in „${sprache}" nicht die Beschriftung „${sollEintrag}"`,
  );
  const href = await seite.evaluate<string>(fn(HREF_VON), EINTRAG);
  expect(href, `${MARKE}: der Menüpunkt zeigt nicht auf ${GESAMTANWEISUNG_PFAD} (${sprache})`).toBe(
    GESAMTANWEISUNG_PFAD,
  );
  const schritte = await tabBisBeschriftungUndEnter(
    seite,
    sollEintrag,
    EINTRAG,
    `Menüpunkt „${sollEintrag}" (${sprache})`,
    120,
  );
  return { schritte, beschriftung, href };
}

export interface Seitenbefund {
  pfad: string;
  /** Der SICHTBARE Text des Seitenhauptbereichs — nicht sein `textContent`. */
  hauptbereich: string;
  /** Die SICHTBARE erste Überschrift darin. */
  ueberschrift: string;
}

/**
 * STATION 4 · Und die Seite steht wirklich da.
 *
 * ZWEI GETRENNTE AUSSAGEN, und beide werden gebraucht: die ADRESSE (`location.pathname`) sagt, dass
 * der Menüpunkt wirklich dorthin geführt hat; der SICHTBARE Hauptbereich sagt, dass dort auch etwas
 * steht. Eine Adresse allein trüge auch eine weisse Seite.
 *
 * `sichtbefund` misst je TEXTKNOTEN (`checkVisibility`, Deckkraft, Fläche eines `Range`) und nicht
 * `textContent` — Lehre 9 des Hauses: DOM-Anwesenheit ist kein Sehen.
 */
export async function seiteMussStehen(
  seite: Seite,
  sollTitel: string,
  sprache: string,
  frist = 45_000,
): Promise<Seitenbefund> {
  await warte(
    seite,
    PFAD_STEHT,
    `die Adresse ${GESAMTANWEISUNG_PFAD} nach dem Menüweg (${sprache})`,
    GESAMTANWEISUNG_PFAD,
    frist,
  );
  // Die Route wird NACHGELADEN — erst wenn ihre Überschrift wirklich gezeichnet ist, sagt der
  // Seitenhauptbereich etwas über DIESE Seite. Vorher stünde dort die Ladefläche, und die
  // Zusicherungen darunter würden sie messen statt die Seite (Runde 1, Tor rot).
  try {
    await warte(
      seite,
      UEBERSCHRIFT_GEZEICHNET,
      `die gezeichnete Überschrift des Seitenhauptbereichs (${sprache}) — die Route wird nachgeladen`,
      HAUPTUEBERSCHRIFT,
      frist,
    );
  } catch (fehler) {
    // Der Befund wird erst JETZT gelesen und unterscheidet die Lagen, die sonst gleich aussähen:
    // „Lädt …" (die Route kam nie an), leerer Text (gezeichnet, aber ohne Überschrift) oder eine
    // verborgene Überschrift (sie steht da und wird nicht gezeichnet).
    const stand = await sichtbefund(seite, HAUPTBEREICH);
    throw new Error(
      `${MARKE}: ${String(fehler)}\nsichtbar im Seitenhauptbereich: „${stand.text}" · verborgen: ${stand.verborgen.join(" | ")}`,
    );
  }
  const hauptbereich = await mussSichtbarTragen(
    seite,
    HAUPTBEREICH,
    sollTitel,
    `der ausgelieferte Seitenhauptbereich zeigt in „${sprache}" nicht „${sollTitel}"`,
  );
  const ueberschrift = await mussSichtbarTragen(
    seite,
    HAUPTUEBERSCHRIFT,
    sollTitel,
    `die Überschrift der Seite lautet in „${sprache}" nicht „${sollTitel}"`,
  );
  return {
    pfad: await seite.evaluate<string>(fn(PFAD_JETZT)),
    hauptbereich,
    ueberschrift,
  };
}

export interface Menuebefund {
  /** Tab-Schritte bis „Arbeitsbereiche“ (FE-002; bis dahin: bis zum Zahnrad). */
  arbeitsbereiche: number;
  eintrag: number;
  beschriftung: string;
  href: string;
  seite: Seitenbefund;
}

/** DER GANZE MENÜWEG: Arbeitsbereiche → Gesamtanweisungen → die Seite steht (FE-002). */
export async function menuewegOhneMaus(
  seite: Seite,
  soll: Sollwerte,
  sprache: string,
): Promise<Menuebefund> {
  const arbeitsbereiche = await oeffneArbeitsbereiche(seite, sprache);
  await arbeitsbereicheSagenOeffnenAn(seite, soll.bereiche, sprache);
  const punkt = await waehleGesamtanweisungen(seite, soll.eintrag, sprache);
  const befund = await seiteMussStehen(seite, soll.eintrag, sprache);
  return {
    arbeitsbereiche,
    eintrag: punkt.schritte,
    beschriftung: punkt.beschriftung,
    href: punkt.href,
    seite: befund,
  };
}

export interface Tabstoppbefund {
  /** Jeder Halt des Gangs, der IM Zahnrad-Menü lag — der Beleg, dass der Gang etwas gemessen hat. */
  imMenue: string[];
  /** Halte, die den gesuchten Namen trugen. Leer zu sein ist die Zusage. */
  treffer: string[];
  /** Stand der Menüpunkt überhaupt im Dokument? */
  imDokument: boolean;
}

/**
 * K2 · Der Menüpunkt liegt NICHT (mehr) hinter dem Zahnrad — kein versteckter Tab-Stopp dort.
 *
 * FE-002: Pedis Befund war, dass Arbeitsseiten hinter einem Zahnrad liegen. Bis hierher fragte K2,
 * ob der Punkt VOR dem Aufklappen von „Bereiche“ schon ertabbar sei; seither gibt es dieses
 * Untermenü nicht mehr, und die Frage lautet: steht „Gesamtanweisungen“ im geöffneten Zahnrad-Menü
 * („Einstellungen und Hilfe“) — als Tab-Halt oder überhaupt im Dokument? Beides darf nicht sein.
 *
 * WARUM ZWEI MESSUNGEN UND NICHT EINE: „steht nicht im Dokument" allein liesse einen Punkt durch,
 * der ausserhalb des Menüs vorgehalten wird; „kein Tab-Halt im Menü" allein liesse einen durch, der
 * im Dokument steht und nur gerade nicht erreicht wurde. Beides zusammen ist die Zusage.
 *
 * UND DER GANG BELEGT SICH SELBST: er muss mindestens drei Halte IM Zahnrad-Menü gehabt haben.
 *
 * VORBEDINGUNG: das Zahnrad-Menü ist offen, „Arbeitsbereiche“ ist zu. Beides wird nachgemessen.
 */
export async function keinVersteckterTabstopp(
  seite: Seite,
  sollEintrag: string,
  sprache: string,
  anschlaege = 40,
): Promise<Tabstoppbefund> {
  expect(
    await seite.evaluate<boolean>(fn(IM_DOKUMENT), ZAHNRAD_MENUE),
    `${MARKE}: das Zahnrad-Menü ist nicht offen (${sprache}) — dann misst dieser Gang nichts`,
  ).toBe(true);
  expect(
    await seite.evaluate<string>(fn(ARIA_STAND), AUSLOESER),
    `${MARKE}: „Arbeitsbereiche“ ist offen (${sprache}) — dann misst dieser Gang nicht das Zahnrad allein`,
  ).toBe("false");

  const imDokument = await seite.evaluate<boolean>(fn(IM_DOKUMENT), EINTRAG);
  const imMenue: string[] = [];
  const treffer: string[] = [];
  for (let schritt = 1; schritt <= anschlaege; schritt += 1) {
    await seite.keyboard.press("Tab");
    const halt = await seite.evaluate<{ marke: string; text: string; imMenue: boolean }>(
      fn(TABHALT),
      { flaeche: ZAHNRAD_MENUE },
    );
    if (!halt.imMenue) {
      continue;
    }
    imMenue.push(`${halt.marke} „${halt.text}"`);
    if (halt.text.includes(sollEintrag)) {
      treffer.push(`${halt.marke} „${halt.text}"`);
    }
  }

  expect(
    imMenue.length,
    `${MARKE}: der Gang über ${anschlaege} Tab-Anschläge hat in „${sprache}" das Zahnrad-Menü nie betreten — er könnte einen versteckten Tab-Stopp gar nicht sehen`,
  ).toBeGreaterThanOrEqual(3);
  expect(
    treffer,
    `${MARKE}: „${sollEintrag}" ist in „${sprache}" ein Tab-Stopp im Zahnrad-Menü — die Arbeitsseite liegt wieder hinter dem Zahnrad (FE-002)`,
  ).toEqual([]);
  expect(
    imDokument,
    `${MARKE}: „${sollEintrag}" steht in „${sprache}" bei offenem Zahnrad-Menü im Dokument — besucht: ${imMenue.join(" · ")}`,
  ).toBe(false);
  return { imMenue, treffer, imDokument };
}

/**
 * K3 · Escape schliesst das Menü „Arbeitsbereiche“, und der Fokus liegt wieder SICHTBAR auf dem
 * Einstieg (FE-002; bis dahin: auf dem Zahnrad).
 *
 * Der sichtbare Fokus wird auch hier am berechneten Stil nachgemessen und nicht aus dem Quelltext
 * geschlossen: `schliessen(true)` ruft `focus()` programmatisch (`Menue.tsx:62-67`), und ob ein
 * Browser danach seinen Tastaturring zeichnet, entscheidet SEINE `:focus-visible`-Heuristik. Genau
 * die kann jsdom nicht — `tests/start-mehr-tastatur/esc-schliesst.test.tsx` misst das Schliessen,
 * nicht das Sehen.
 */
export async function escapeSchliesstUndGibtFokusZurueck(
  seite: Seite,
  sprache: string,
  frist = 30_000,
): Promise<void> {
  expect(
    await seite.evaluate<boolean>(fn(FLAECHE_HAT_FOKUS), MENUEFLAECHE),
    `${MARKE}: der Fokus steht vor dem Escape nicht im Menü (${sprache}) — dann misst dieser Fall nicht die Fokusrückgabe`,
  ).toBe(true);
  await seite.keyboard.press("Escape");
  await warte(
    seite,
    NICHT_IM_DOKUMENT,
    `das geschlossene Menü „Arbeitsbereiche“ nach Escape (${sprache})`,
    MENUEFLAECHE,
    frist,
  );
  expect(
    await seite.evaluate<boolean>(fn(AKTIV_IST), AUSLOESER),
    `${MARKE}: nach Escape liegt der Fokus in „${sprache}" nicht auf „Arbeitsbereiche“ — aktiv: ${await seite.evaluate<string>(fn(AKTIV_BESCHREIBUNG))}`,
  ).toBe(true);
  await fokusMussSichtbarSein(seite, `„Arbeitsbereiche“ nach Escape (${sprache})`);
}

/** Ein Menüpunkt, der unverändert erreichbar bleiben muss. */
export interface Nachbarpunkt {
  text: string;
  selektor: string;
}

/**
 * K3 · Die übrigen Menüpunkte bleiben per Tastatur erreichbar — mit sichtbarem Fokus.
 *
 * ES WIRD NICHT AUSGELÖST, nur erreicht: ein Enter auf „Hilfe" verliesse die Seite, und der
 * nächste Punkt der Liste wäre danach nicht mehr messbar. Gegenstand der Zusage ist die
 * ERREICHBARKEIT.
 *
 * Die Reihenfolge der Liste ist die des Menüs — `tabBisText` geht vorwärts und beginnt beim
 * aktuellen Fokus.
 */
export async function nachbarpunkteBleibenErreichbar(
  seite: Seite,
  punkte: readonly Nachbarpunkt[],
  sprache: string,
): Promise<Record<string, number>> {
  const schritte: Record<string, number> = {};
  for (const punkt of punkte) {
    schritte[punkt.text] = await tabBisText(seite, punkt.text, 80, false);
    expect(
      await seite.evaluate<boolean>(fn(AKTIV_IST), punkt.selektor),
      `${MARKE}: der Tab-Weg zu „${punkt.text}" (${sprache}) endete nicht auf ${punkt.selektor} — aktiv: ${await seite.evaluate<string>(fn(AKTIV_BESCHREIBUNG))}`,
    ).toBe(true);
    await fokusMussSichtbarSein(seite, `Menüpunkt „${punkt.text}" (${sprache})`);
  }
  return schritte;
}

/** Der sichtbare Text eines offenen Menüs — für den Befund, den ein Mensch in der Rückgabe liest. */
export async function menuetext(seite: Seite, flaeche = MENUEFLAECHE): Promise<string> {
  return (await sichtbefund(seite, flaeche)).text;
}
