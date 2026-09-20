// ================================================================================================
// JOB 4361 — LANGE QUELLENNACHWEISE AM HANDY: GEMESSEN IM ECHTEN CHROMIUM, NICHT IN jsdom.
// ================================================================================================
//
// DER ANLASS (BEN JOB 4013 R1, Punkt 6, `archiv/4013/runde-1/ben.md:24`): der Nachweis je Quelle —
// Zeitpunkt, Adresse, Belegstelle, Datei — ist bisher AUSSCHLIESSLICH in jsdom belegt
// (`nachweis-an-der-pruefkarte.test.tsx`, `@vitest-environment jsdom`). jsdom hat kein Layout: dort
// gibt es keine Textrechtecke, keinen Zeilenumbruch, kein `overflow: hidden` und keine Tabulator-
// Taste. Ein Nachweis, der am Handy zur Hälfte hinter dem Kartenrand liegt, ist dort GRÜN.
//
// WAS DIESE DATEI MISST, und zwar an der GEBAUTEN Fläche in echtem Chromium:
//   K1 · bei 320 × 568 und 390 × 844 sind für JEDE von drei langen Quellen Zeitpunkt, Adresse,
//        Belegstelle und Dateiname SICHTBAR (`Element.checkVisibility` + `innerText`) und liegen
//        VOLLSTÄNDIG im Fenster — in de, en und nl. „Vollständig" heisst hier dreierlei und wird
//        dreifach geprüft: im Fenster (`right <= innerWidth`, `left >= 0`), nicht von einer
//        beschneidenden Hülle abgeschnitten (jede Vorfahrenhülle mit `overflow-x: hidden|clip|
//        auto|scroll`, gemessen an ihrer INNENkante) und ohne eigenen waagerechten Überlauf
//        (`scrollWidth <= clientWidth`). Dazu: die Seite rollt nicht waagerecht.
//   K2 · der Quellenlink JEDER Quelle ist mit der ECHTEN Tabulator-Taste erreichbar, trägt dabei
//        einen sichtbaren Fokus und ein Rechteck im Fenster, und ER LÖST MIT ENTER AUS.
//   K3 · die DREI Entscheidungsknöpfe der Karte (Freigeben, Rückfrage, Ablehnen) bleiben daneben
//        sichtbar, im Fenster UND wirklich erreichbar — mit der Tastatur und mit dem Zeiger.
//   K4 · jede dieser Zusagen ist KALIBRIERT: der Nachweis wird gezielt ausgeblendet, die Adresse
//        über den Rand geschoben und der Link aus der Tabfolge genommen — jedes Mal muss genau
//        diese Messung rot werden und nach der Rücknahme wieder grün.
//
// WARUM `h4-harness` UND KEINE NEUE BÜHNE (Auftrag §3: „vorhandene Chromium-Aufbauten importieren"):
// sie ist die EINZIGE Bühne des Hauses, deren `Seite` sowohl `setViewportSize` als auch `keyboard`
// führt (`tests/design/h4-harness.ts:131/143`, dort seit JOB 3564/3775 bezahlt). Diese Datei reicht
// sich deshalb KEIN Feld selbst nach — kein `interface … extends Seite`, kein Cast; sie taucht in
// `tests/design-vorrichtung/seiten-typ-waechter.test.ts` nicht als Aufweitung auf. Sie startet auch
// keinen eigenen Browser: der Pin der Startstellen (`tor-bestand-vollstaendig.test.ts` B4 = 29)
// bleibt unberührt.
//
// DIE BÜHNE ÖFFNET `/bibliothek` — DAS IST IHR AUFBAU, NICHT DAS MESSZIEL. Gemessen wird auf
// `/validierung`, wohin diese Datei nach dem Aufbau navigiert. Denselben Weg geht
// `tests/bibliothek-mehr-platzhalter/platzhalter-englisch-chromium.test.ts` auf derselben Bühne.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, ORIGIN, fn, h4Stand, spracheSetzen } from "../design/h4-harness";
// Private Cloud-Schnappschüsse enthalten kein `dist`; der Bau ist derselbe wie an der Nachbardatei
// (`tests/review26-pruefen-schmal/bau.ts`, dort ausdrücklich „als globalSetup nutzbar, wenn andere
// Chromium-Dateien denselben Bau benötigen"). Kein zweiter Bauweg.
import baueFrisch from "../review26-pruefen-schmal/bau";

// ==================================================================================================
// DIE KULISSE — DREI LANGE QUELLEN AN EINEM WISSENSOBJEKT.
// ==================================================================================================
//
// Der Auftrag verlangt „mindestens drei Quellen mit langen Adressen (≥120 Zeichen ohne
// Umbruchpunkt) und langen Belegstellen". Die Adressen tragen deshalb je EIN zusammenhängendes
// Wegstück ohne `/`, `-`, `_` oder `.` — genau das, woran ein Umbruch ohne `break-all` scheitert.
// Die Belegstellen sind Fliesstext mit einer langen Dokumentenkennung darin, wie sie in einem
// Normenzitat wirklich vorkommt; auch sie hat keinen Umbruchpunkt.
//
// KEINE ERFUNDENEN FELDER: jede Quelle bekommt genau die vier Angaben, die der Nachweis zeichnet —
// `at` (Zeitpunkt), `url` (Adresse), `excerpt` (Belegstelle) und `objectId` (der Anker, aus dem der
// DATEINAME am Anhang desselben Objekts aufgelöst wird, `lib/koSource.ts`).
const TITEL = "PROBE-KO 4361 · Druckanlage Werk 2 — Abnahme der Absperrventile";

interface Quellkulisse {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly excerpt: string;
  readonly objectId: string;
  readonly datei: string;
  readonly at: string;
}

/** Ein Wegstück ohne jeden Umbruchpunkt — `n` Zeichen, nur Buchstaben und Ziffern. */
function ohneUmbruch(stamm: string, n: number): string {
  let s = "";
  while (s.length < n) {
    s += stamm;
  }
  return s.slice(0, n);
}

const QUELLEN: readonly Quellkulisse[] = [
  {
    id: "job4361-q1",
    label: "DIN EN ISO 19650-2:2018-12 Anhang C",
    url: `https://normenportal.beispiel.de/${ohneUmbruch(
      "abschnittfuenfeinssiebenunterabschnittbnachweisfuehrungpruefprotokollfassungzweitausendsechsundzwanzig",
      124,
    )}`,
    excerpt:
      "Vor dem Öffnen der Absperrarmatur ist der drucklose Zustand am Manometer abzulesen und " +
      "schriftlich zu bestätigen; die Bestätigung trägt die Dokumentenkennung " +
      "DINENISO196502Anhang3CNachweisfuehrungAbschnitt517b und verbleibt in der Anlagenakte.",
    objectId: "job4361-objekt-1",
    datei: "Pruefprotokoll_Druckanlage_Werk2_Linie3_2026-09-14_Abnahme_Revision4.pdf",
    at: "2026-09-14T10:15:00.000Z",
  },
  {
    id: "job4361-q2",
    label: "Betriebsanweisung Druckanlage BA-2026-014",
    url: `https://intranet.beispiel-werk.de/betriebsanweisungen/${ohneUmbruch(
      "druckanlagewerkzweilinjedreiabsperrventileabnahmeundwartungfassungvierzehnseptemberzweitausendsechsundzwanzig",
      132,
    )}`,
    excerpt:
      "Die Wartung beginnt erst, wenn zwei Personen den sicheren Zustand unabhängig voneinander " +
      "geprüft und im Protokoll gegengezeichnet haben; der Vorgang trägt die Kennung " +
      "Betriebsanweisung2026014AbsperrventileAbnahmeschrittZwei und ist nicht delegierbar.",
    objectId: "job4361-objekt-2",
    datei: "Betriebsanweisung_BA-2026-014_Druckanlage_Absperrventile_Stand_2026-08-30.pdf",
    at: "2026-09-15T08:40:00.000Z",
  },
  {
    id: "job4361-q3",
    label: "Prüfbericht Sachverständiger 4711-2026",
    url: `https://pruefstelle.beispiel.de/berichte/${ohneUmbruch(
      "sachverstaendigenberichtviertausendsiebenhundertelfzweitausendsechsundzwanzigdruckbehaelterwiederkehrendepruefung",
      128,
    )}`,
    excerpt:
      "Der Druckbehälter wurde einer wiederkehrenden Prüfung unterzogen; Beanstandungen wurden " +
      "nicht festgestellt. Der Bericht führt den Vorgang unter der Kennung " +
      "Sachverstaendigenbericht47112026DruckbehaelterWiederkehrendePruefung.",
    objectId: "job4361-objekt-3",
    datei: "Pruefbericht_Sachverstaendiger_4711-2026_Druckbehaelter_wiederkehrende_Pruefung.pdf",
    at: "2026-09-16T14:05:00.000Z",
  },
];

/** Die zwei Fenster des Auftrags. */
const FENSTER = [
  { breite: 320, hoehe: 568 },
  { breite: 390, hoehe: 844 },
] as const;

/** Die drei Sprachen des Auftrags — dieselbe Menge, die `h4-harness` führen kann. */
const SPRACHEN = ["de", "en", "nl"] as const;

// ==================================================================================================
// DIE ENTSCHEIDUNGSKNÖPFE — DREI, NICHT ZWEI (RUNDE 3)
// ==================================================================================================
//
// DER FEHLER, DEN DAS TOR IN RUNDE 2 GEFUNDEN HAT. Runde 1 und 2 prüften `up` und `down` und
// hielten das für „beide Knöpfe". Die Prüfkarte trägt aber DREI: `REVIEW_DECISIONS`
// (`apps/web/src/lib/reviewDecision.ts:19-23`) führt Freigeben (`up`), Rückfrage (`warn`) und
// Ablehnen (`down`), und `Validation.tsx:1770-1778` zeichnet jeden davon. Die Tastaturerhebung
// brach nach ZWEI Treffern ab — sie sammelte also `up` und `warn` und meldete dann, `down` sei in
// 200 Anschlägen nicht erreichbar. Der Befund war echt, nur zeigte er auf die Messung und nicht
// aufs Produkt (Tor-Lauf zu Runde 2: „K3 · 320 px … expected [ Array(1) ] to deeply equal []" und
// „K4d … expected [ 'pruefen-entscheidung-warn', …(1) ]").
//
// DIE MENGE STEHT HIER HART und wird NICHT aus `reviewDecision.ts` importiert: ein Sollwert aus
// derselben Laufzeitquelle wie der Istwert vergleicht die Quelle mit sich selbst und bliebe auch
// dann grün, wenn ein Knopf aus dem Produkt verschwindet (dieselbe Doktrin wie
// `tests/support/ortszeileWorte.ts` und wie `sichtbareAdresse` weiter unten). Dass die Karte
// wirklich GENAU diese drei trägt — nicht zwei, nicht vier —, prüft `befunde` bei jeder Lage
// gegen die zur Laufzeit erhobene Menge; sonst könnte die Prüfmenge lautlos schrumpfen
// (Lehre JOB 3489: jede abgeleitete Testmenge braucht ihren festgenagelten Umfang).
const ENTSCHEIDUNGEN = ["up", "warn", "down"] as const;

// ==================================================================================================
// DIE MESSUNG IN DER SEITE
// ==================================================================================================

/**
 * Ein gemessenes Feld der Karte. `da: false` heisst „das Element gibt es gar nicht" und ist
 * ausdrücklich ETWAS ANDERES als „unsichtbar" — die Meldung muss beides auseinanderhalten können.
 */
interface Feld {
  name: string;
  da: boolean;
  sichtbar?: boolean;
  text?: string;
  links?: number;
  rechts?: number;
  breite?: number;
  hoehe?: number;
  /** Die engste beschneidende Innenkante über diesem Element (Fensterbreite, wenn keine da ist). */
  grenzeRechts?: number;
  /** Der eigene waagerechte Überlauf: `scrollWidth - clientWidth`. */
  eigenUeberlauf?: number;
  tag?: string;
  href?: string | null;
  tabindex?: string | null;
}

interface Quellmessung {
  zeit: Feld;
  datei: Feld;
  adresse: Feld;
  auszug: Feld;
}

interface Kartenmessung {
  fehler: string | null;
  fensterBreite: number;
  seitenBreite: number;
  mehrOffen: boolean;
  quellen: Quellmessung[];
  knoepfe: Feld[];
  /** Die Kennungen der Entscheidungsknöpfe, die die Karte wirklich trägt (Reihenfolge im DOM). */
  vorhanden: string[];
}

/**
 * DIE EINE MESSUNG, IN DER SEITE.
 *
 * `checkVisibility` beantwortet die Frage „wird das gezeichnet?" (Anzeige, Sichtbarkeit,
 * Deckkraft) — sie beantwortet ausdrücklich NICHT die Frage „liegt es im Bild?". Ein Element
 * hinter dem Kartenrand ist für `checkVisibility` sichtbar; deshalb steht die Geometrie
 * gleichberechtigt daneben, und zwar in DREI Gestalten, weil es drei Arten gibt, abgeschnitten zu
 * werden: am Fenster, an einer beschneidenden Hülle (die Prüfkarte trägt `overflow-hidden`,
 * `Validation.tsx:1341`) und im Element selbst.
 *
 * `innerText` und nicht `textContent`: gemessen wird, was ein Mensch LIEST (Lehre 9 des
 * Bahn-Regelwerks). Ein zugeklapptes `<details>` gäbe hier den Leerstring.
 */
const MESSEN = `(arg) => {
  const W = window.innerWidth;
  const karte = document.querySelector('[data-testid="pruefen-karte"]');
  if (karte === null) {
    return { fehler: 'keine Prüfkarte auf der Fläche', fensterBreite: W, seitenBreite: document.documentElement.scrollWidth, mehrOffen: false, quellen: [], knoepfe: [], vorhanden: [] };
  }
  const beschnittRechts = (el) => {
    let e = el.parentElement;
    let grenze = W;
    while (e !== null) {
      const s = getComputedStyle(e);
      if (s.overflowX === 'hidden' || s.overflowX === 'clip' || s.overflowX === 'auto' || s.overflowX === 'scroll') {
        const r = e.getBoundingClientRect();
        const innen = r.right - parseFloat(s.borderRightWidth || '0') - parseFloat(s.paddingRight || '0');
        if (innen < grenze) { grenze = innen; }
      }
      e = e.parentElement;
    }
    return grenze;
  };
  const mess = (el, name) => {
    if (el === null || el === undefined) { return { name: name, da: false }; }
    const r = el.getBoundingClientRect();
    return {
      name: name,
      da: true,
      sichtbar: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      text: (el.innerText || '').replace(/\\s+/g, ' ').trim(),
      links: r.left,
      rechts: r.right,
      breite: r.width,
      hoehe: r.height,
      grenzeRechts: beschnittRechts(el),
      eigenUeberlauf: el.scrollWidth - el.clientWidth,
      tag: el.tagName,
      href: el.getAttribute('href'),
      tabindex: el.getAttribute('tabindex')
    };
  };
  const zeiten = [].slice.call(karte.querySelectorAll('[data-testid="pruefen-quelle-zeit"]'));
  const bloecke = [].slice.call(karte.querySelectorAll('[data-testid="pruefen-quellennachweis"]'));
  const mehr = karte.querySelector('[data-testid="pruefen-mehr-karte"]');
  return {
    fehler: null,
    fensterBreite: W,
    seitenBreite: document.documentElement.scrollWidth,
    mehrOffen: mehr !== null && mehr.open === true,
    quellen: bloecke.map(function (b, i) {
      return {
        zeit: mess(zeiten[i], 'Zeitpunkt'),
        datei: mess(b.querySelector('[data-testid="pruefen-quelle-datei"]'), 'Datei'),
        adresse: mess(b.querySelector('[data-testid="pruefen-quelle-adresse"]'), 'Adresse'),
        auszug: mess(b.querySelector('[data-testid="pruefen-quelle-auszug"]'), 'Belegstelle')
      };
    }),
    knoepfe: arg.map(function (v) {
      return mess(karte.querySelector('[data-testid="pruefen-entscheidung-' + v + '"]'), 'Entscheidung ' + v);
    }),
    // Was die Karte WIRKLICH an Entscheidungsknöpfen trägt — gegen die feste Menge gelegt, damit
    // ein vierter Knopf oder ein verschwundener auffällt statt lautlos durchzugehen.
    vorhanden: [].slice.call(karte.querySelectorAll('[data-testid^="pruefen-entscheidung-"]')).map(function (el) {
      return (el.getAttribute('data-testid') || '').replace('pruefen-entscheidung-', '');
    })
  };
}`;

/** Den Hinweisbalken wegklicken, falls er steht — sonst nimmt er der Karte Platz. */
const HINWEIS_WEG = `() => {
  const knopf = document.querySelector('[data-testid="notice-ack"]');
  if (knopf !== null && knopf.checkVisibility()) { knopf.click(); return true; }
  return false;
}`;

/** Die Zeile des Prüfobjekts in der Warteschlange wählen — über ihren Titel, nicht über ihren Rang. */
const WAEHLEN = `(titel) => {
  const knoepfe = [].slice.call(document.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]'));
  for (let i = 0; i < knoepfe.length; i++) {
    const t = knoepfe[i].querySelector('[data-text="titel"]');
    if (t !== null && (t.textContent || '').trim() === titel) { knoepfe[i].click(); return { ok: true, gesehen: [] }; }
  }
  return { ok: false, gesehen: knoepfe.map(function (b) { return (b.textContent || '').trim().slice(0, 60); }) };
}`;

/** Das „Mehr" der Karte öffnen — über die echte Zusammenfassung, nicht über `open = true`. */
const MEHR_OEFFNEN = `() => {
  const d = document.querySelector('[data-testid="pruefen-mehr-karte"]');
  if (d === null) { return false; }
  if (d.open !== true) {
    const s = d.querySelector('summary');
    if (s !== null) { s.click(); }
  }
  return d.open === true;
}`;

// ==================================================================================================
// DIE AUSLÖSEMESSUNG — WIE DAS HAUS EINEN LINK MISST, OHNE EIN FREMDFENSTER ZU ÖFFNEN.
// ==================================================================================================
//
// Der Quellenlink trägt `target="_blank"` (`Validation.tsx:1625`). Ein echtes Enter darauf öffnete
// ein zweites Browserfenster auf eine fremde Adresse — das braucht niemand, und der Prüfstand hat
// dorthin kein Netz. Gemessen wird deshalb dieselbe Sache eine Stufe früher: die AKTIVIERUNG. Ein
// Enter auf einem fokussierten Link erzeugt im Browser ein echtes `click`-Ereignis (die
// Vorgabehandlung des Ankers); ein Mithörer in der EINFANGPHASE schreibt es mit und nimmt genau
// die Vorgabehandlung zurück — sonst nichts.
//
// Das ist derselbe Griff, den die jsdom-Schwesterdatei begründet (`nachweis-an-der-pruefkarte.
// test.tsx:190-195`: „der mitgehörte `preventDefault` unterdrückt allein die Eigenreaktion auf ein
// `<a>`") und den `tests/design/zielbild-k2-erfassen.test.ts:522` für `window.open` benutzt. Die
// React-Handler der Karte laufen davon unberührt weiter: `preventDefault` hält keine Ausbreitung
// auf. Dass die Karte dabei NICHT ins Wissensobjekt springt, wird danach am Pfad nachgelesen.
//
// RUNDE 2 — DERSELBE MITHÖRER TRÄGT JETZT AUCH DIE ENTSCHEIDUNGSKNÖPFE (BENs Korrekturpflicht 2),
// und für sie gilt eine SCHÄRFERE Regel: `stopPropagation` zusätzlich zu `preventDefault`. Der
// Grund ist der Unterschied der beiden Fälle. Beim Link ist die Wirkung, die niemand will, die
// VORGABEHANDLUNG des Browsers (ein zweites Fenster) — die React-Kette der Karte soll weiterlaufen,
// denn genau sie wird mitgemessen (`cardClickOpens` darf den Link nicht ins Objekt führen). Beim
// Knopf ist die Wirkung, die niemand will, der REACT-HANDLER selbst: er gäbe das Wissensobjekt
// frei oder lehnte es ab und veränderte den Bestand, an dem die übrigen Fälle dieser Datei messen.
// `stopPropagation` in der Einfangphase am `document` hält das Ereignis an, BEVOR es den
// React-Wurzelbehälter erreicht (React 18 hängt seinen Zuhörer an die Wurzel, nicht ans Element).
// Was gemessen wird, ist damit genau die Frage der Erreichbarkeit: Kommt ein echter Mausklick an
// dieser Bildschirmkoordinate WIRKLICH am Knopf an? Dass die Entscheidung dabei nicht gelaufen
// ist, wird danach an der Karte nachgelesen, statt es zu behaupten.
const ABFANG = `() => {
  window.__job4361 = { klicks: [], knoepfe: [] };
  document.addEventListener('click', function (e) {
    const ziel = e.target;
    const suche = ziel !== null && typeof ziel.closest === 'function' ? ziel : null;
    if (suche === null) { return; }
    const knopf = suche.closest('[data-testid^="pruefen-entscheidung-"]');
    if (knopf !== null) {
      window.__job4361.knoepfe.push({ testid: knopf.getAttribute('data-testid'), disabled: knopf.disabled === true });
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const a = suche.closest('a');
    if (a !== null) {
      window.__job4361.klicks.push({ href: a.getAttribute('href'), testid: a.getAttribute('data-testid') });
      e.preventDefault();
    }
  }, true);
  return true;
}`;

const ABFANG_LESEN = `() => {
  const s = window.__job4361;
  return { eingebaut: s !== undefined && s !== null, klicks: s ? s.klicks : [], knoepfe: s ? s.knoepfe : [], pfad: location.pathname };
}`;

/**
 * Was gerade den Fokus hat — mit allem, was K2 verlangt: Kennung, Rechteck, Sichtbarkeit und der
 * gezeichnete Fokus. Der Fokusring des Hauses ist ein SCHATTEN und keine Kontur
 * (`apps/web/src/index.css:65`, `ring-2` unter `outline-none`); gemessen wird deshalb `boxShadow`
 * und zusätzlich `:focus-visible` — der Zustand, an dem die Regel überhaupt hängt.
 */
const FOKUS_LESEN = `() => {
  const el = document.activeElement;
  if (el === null || el === document.body) { return null; }
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return {
    testid: el.getAttribute('data-testid'),
    tag: el.tagName,
    href: el.getAttribute('href'),
    text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
    links: r.left,
    rechts: r.right,
    oben: r.top,
    unten: r.bottom,
    sichtbar: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    fokusSichtbar: el.matches(':focus-visible'),
    boxShadow: s.boxShadow,
    outline: s.outlineStyle + ' ' + s.outlineWidth
  };
}`;

interface Fokusstand {
  testid: string | null;
  tag: string;
  href: string | null;
  text: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  sichtbar: boolean;
  fokusSichtbar: boolean;
  boxShadow: string;
  outline: string;
}

// ==================================================================================================
// RUNDE 2 · DIE ZEIGER-ERREICHBARKEIT EINES KNOPFES (BENs Korrekturpflicht 2)
// ==================================================================================================
//
// BENs Satz zu Runde 1: „reine horizontale Feldgeometrie genügt dafür nicht". Er hat recht — ein
// Knopf kann waagerecht im Bild liegen und trotzdem unerreichbar sein: unter dem unteren Fensterrand,
// unter einem Deckel, mit `pointer-events: none` oder gesperrt. Deshalb wird hier gemessen, was
// „erreichbar" WIRKLICH heisst, und zwar NACH dem Bildlauf, den ein Mensch ohnehin machen muss:
//
//   · `scrollIntoView({ block: 'center' })` — der erforderliche Bildlauf, ausdrücklich Teil der
//     Messung und nicht ihre Umgehung.
//   · danach das Rechteck VOLLSTÄNDIG im Fenster, waagerecht UND senkrecht.
//   · `document.elementFromPoint` am Mittelpunkt trifft den Knopf oder einen seiner Nachkommen —
//     das ist die einzige Aussage, die einen Deckel darüber wirklich sieht.
//   · `disabled` und `pointer-events` gelesen, weil beides den Klick verschluckt, ohne dass sich
//     am Rechteck etwas ändert.
//
// Zurückgegeben wird auch der Mittelpunkt — mit ihm führt der Fall danach einen ECHTEN Mausklick
// (`mouse.click(x, y)`), so wie `tests/review26-pruefen-schmal/pruefen-schmal-chromium.test.ts:94-106`
// es für die Warteschlangenzeile tut: erst `elementFromPoint` als Vorbedingung, dann die echte Maus.
const KNOPF_ERREICHEN = `(kennung) => {
  const el = document.querySelector('[data-testid="pruefen-entscheidung-' + kennung + '"]');
  if (el === null) { return { da: false, kennung: kennung }; }
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const getroffen = document.elementFromPoint(x, y);
  return {
    da: true,
    kennung: kennung,
    text: (el.innerText || '').replace(/\\s+/g, ' ').trim(),
    sichtbar: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    links: r.left,
    rechts: r.right,
    oben: r.top,
    unten: r.bottom,
    x: x,
    y: y,
    trifft: getroffen !== null && (getroffen === el || el.contains(getroffen)),
    getroffenVon: getroffen === null ? 'nichts' : (getroffen.tagName + (getroffen.getAttribute('data-testid') === null ? '' : '/' + getroffen.getAttribute('data-testid'))),
    gesperrt: el.disabled === true,
    zeigerAus: s.pointerEvents === 'none',
    fensterBreite: window.innerWidth,
    fensterHoehe: window.innerHeight
  };
}`;

interface Knopflage {
  da: boolean;
  kennung: string;
  text?: string;
  sichtbar?: boolean;
  links?: number;
  rechts?: number;
  oben?: number;
  unten?: number;
  x?: number;
  y?: number;
  trifft?: boolean;
  getroffenVon?: string;
  gesperrt?: boolean;
  zeigerAus?: boolean;
  fensterBreite?: number;
  fensterHoehe?: number;
}

/**
 * Der Zustand der Karte, an dem sich ablesen lässt, ob eine Entscheidung GELAUFEN ist. Er wird vor
 * und nach den Klicks gelesen: der Beleg für „die Messung hat den Bestand nicht verändert" ist ein
 * Vergleich, keine Behauptung. `quittung` ist die Erfolgsmeldung, die das Produkt nach einer
 * Entscheidung zeichnet (`Validation.tsx`, `pruefen-quittung`).
 */
const KARTENZUSTAND = `() => {
  const karte = document.querySelector('[data-testid="pruefen-karte"]');
  return {
    titel: karte === null ? null : ((karte.querySelector('[data-text="titel"]') || {}).textContent || '').trim(),
    nachweise: karte === null ? -1 : karte.querySelectorAll('[data-testid="pruefen-quellennachweis"]').length,
    quittung: document.querySelector('[data-testid="pruefen-quittung"]') !== null,
    pfad: location.pathname
  };
}`;

interface Kartenzustand {
  titel: string | null;
  nachweise: number;
  quittung: boolean;
  pfad: string;
}

/** Einen Deckel GENAU über ein Element legen — die Kalibrierung der Treffer-Messung (K4d). */
const DECKEL = `(arg) => {
  const alt = document.getElementById('job4361-deckel');
  if (alt !== null) { alt.remove(); }
  if (arg === null) { return { ok: true }; }
  const el = document.querySelector(arg);
  if (el === null) { return { ok: false }; }
  const r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.id = 'job4361-deckel';
  d.setAttribute('data-testid', 'job4361-deckel');
  d.style.cssText = 'position:fixed;z-index:99999;background:rgba(0,0,0,0.01);left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
  document.body.appendChild(d);
  return { ok: true };
}`;

// ==================================================================================================
// DIE BEURTEILUNG — IN NODE, DAMIT DIE MELDUNG DEN FELDNAMEN TRÄGT.
// ==================================================================================================

/** Wie viel Messrauschen ein Rechteck haben darf, bevor es als „draussen" gilt (Teilpixel). */
const SPIEL = 0.75;

/**
 * Alles, was an EINEM Feld nicht stimmt — als Liste von Sätzen, jeder mit Feldnamen und Zahl. Eine
 * leere Liste ist die Zusage. Ein `expect(befunde).toEqual([])` nennt bei Rot genau das Feld, den
 * Grund und den gemessenen Wert; genau das verlangt die Kalibrierungspflicht (K4).
 */
function feldbefunde(f: Feld, W: number, erwarteterText: string | null, ort: string): string[] {
  const kopf = `${ort} · ${f.name}`;
  if (!f.da) {
    return [`${kopf}: das Element steht gar nicht auf der Karte`];
  }
  const schlecht: string[] = [];
  if (f.sichtbar !== true) {
    schlecht.push(`${kopf}: checkVisibility() = false — es wird nicht gezeichnet`);
  }
  const text = f.text ?? "";
  if (text.length === 0) {
    schlecht.push(`${kopf}: innerText ist leer — kein lesbarer Text`);
  }
  // RUNDE 2, BENs Prüflücke 6: der gelesene Text muss dem Sollwert GLEICH sein, nicht ihn nur
  // ENTHALTEN. Runde 1 verglich die ersten 40 Zeichen — damit wäre eine Belegstelle, die nach 40
  // Zeichen abbricht (abgeschnitten, gekürzt, mit „…" ersetzt), grün geblieben. Genau das ist die
  // Fehlerklasse dieses Auftrags. Verglichen wird gegen die Leerraum-Normalform, weil der Umbruch
  // am schmalen Rand Zeilen erzeugt und `innerText` sie als Leerraum ausgibt.
  if (erwarteterText !== null && text !== erwarteterText.replace(/\s+/g, " ").trim()) {
    schlecht.push(
      `${kopf}: innerText ist nicht der zugesagte Text — erwartet (${erwarteterText.length} Zeichen) „${erwarteterText.slice(0, 60)}…", gelesen (${text.length} Zeichen) „${text.slice(0, 60)}…"`,
    );
  }
  if ((f.breite ?? 0) <= 0 || (f.hoehe ?? 0) <= 0) {
    schlecht.push(`${kopf}: Rechteck ist ${f.breite} × ${f.hoehe} px — es nimmt keine Fläche ein`);
  }
  if ((f.links ?? 0) < -SPIEL) {
    schlecht.push(
      `${kopf}: beginnt bei x = ${(f.links ?? 0).toFixed(1)} px, also links ausserhalb des Fensters`,
    );
  }
  if ((f.rechts ?? 0) > W + SPIEL) {
    schlecht.push(
      `${kopf}: endet bei x = ${(f.rechts ?? 0).toFixed(1)} px, das Fenster ist ${W} px breit`,
    );
  }
  if ((f.rechts ?? 0) > (f.grenzeRechts ?? W) + SPIEL) {
    schlecht.push(
      `${kopf}: waagerecht abgeschnitten — es endet bei x = ${(f.rechts ?? 0).toFixed(1)} px, die beschneidende Hülle bei ${(f.grenzeRechts ?? W).toFixed(1)} px`,
    );
  }
  if ((f.eigenUeberlauf ?? 0) > 1) {
    schlecht.push(
      `${kopf}: eigener waagerechter Überlauf von ${(f.eigenUeberlauf ?? 0).toFixed(1)} px (scrollWidth > clientWidth)`,
    );
  }
  return schlecht;
}

/**
 * Der sichtbare Text einer Adresse, nach DERSELBEN Regel wie das Produkt: `URL_ECHO_LEN` = 80
 * Zeichen plus Auslassungszeichen (`apps/web/src/lib/koSource.ts`, `kuerzeAdresse`). Die Zahl steht
 * hier HART und wird nicht aus dem Produkt importiert — ein Sollwert aus derselben Quelle wie der
 * Istwert verglichen die Quelle mit sich selbst und bliebe auch dann grün, wenn die Kürzung
 * verrutscht (dieselbe Doktrin wie `tests/support/ortszeileWorte.ts`).
 */
function sichtbareAdresse(url: string): string {
  return url.length > 80 ? `${url.slice(0, 80)}…` : url;
}

/** Was von einer Zeitangabe verlangt wird, ohne die Sprachform vorwegzunehmen. */
function zeitbefunde(f: Feld, ort: string): string[] {
  const text = f.text ?? "";
  const schlecht: string[] = [];
  if (f.da && !text.includes("2026")) {
    schlecht.push(`${ort} · Zeitpunkt: „${text}" nennt das Jahr der Quelle nicht`);
  }
  for (const gift of ["Invalid Date", "NaN"]) {
    if (text.includes(gift)) {
      schlecht.push(`${ort} · Zeitpunkt: „${text}" enthält „${gift}"`);
    }
  }
  return schlecht;
}

/**
 * Die vollständige Beurteilung EINER Lage (ein Fenster, eine Sprache). Sie deckt K1 und K3; K2
 * läuft über die Tastatur und steht getrennt.
 */
function befunde(m: Kartenmessung, ort: string): string[] {
  if (m.fehler !== null) {
    return [`${ort}: ${m.fehler}`];
  }
  const schlecht: string[] = [];
  if (!m.mehrOffen) {
    schlecht.push(
      `${ort}: das „Mehr" der Karte ist zu — der Nachweis wäre gar nicht aufgeschlagen`,
    );
  }
  if (m.quellen.length !== QUELLEN.length) {
    schlecht.push(
      `${ort}: ${m.quellen.length} Nachweise statt ${QUELLEN.length} — die Kulisse steht nicht`,
    );
    return schlecht;
  }
  if (m.seitenBreite > m.fensterBreite + SPIEL) {
    schlecht.push(
      `${ort}: die Seite rollt waagerecht — scrollWidth ${m.seitenBreite} px gegen innerWidth ${m.fensterBreite} px`,
    );
  }
  QUELLEN.forEach((q, i) => {
    const gemessen = m.quellen[i] as Quellmessung;
    const wo = `${ort} · Quelle ${i + 1}`;
    schlecht.push(...feldbefunde(gemessen.zeit, m.fensterBreite, null, wo));
    schlecht.push(...zeitbefunde(gemessen.zeit, wo));
    schlecht.push(...feldbefunde(gemessen.datei, m.fensterBreite, q.datei, wo));
    // Die Adresse wird für die ANZEIGE gekürzt — `URL_ECHO_LEN` = 80 plus Auslassungszeichen
    // (`lib/koSource.ts`, `kuerzeAdresse`). Verlangt wird deshalb GENAU diese Form: 80 Zeichen und
    // „…“, nicht mehr und nicht weniger. Die VOLLE Adresse steht im `href` und wird dort geprüft.
    schlecht.push(...feldbefunde(gemessen.adresse, m.fensterBreite, sichtbareAdresse(q.url), wo));
    if (gemessen.adresse.da) {
      if (gemessen.adresse.tag !== "A") {
        schlecht.push(`${wo} · Adresse: ist ein <${gemessen.adresse.tag}> und kein Link`);
      }
      if (gemessen.adresse.href !== q.url) {
        schlecht.push(`${wo} · Adresse: href trägt nicht die volle Adresse`);
      }
    }
    schlecht.push(...feldbefunde(gemessen.auszug, m.fensterBreite, q.excerpt, wo));
  });
  // RUNDE 3: der Umfang der Knopfmenge wird festgenagelt, BEVOR über sie geurteilt wird. Ohne
  // diese Zeile könnte die Karte einen Entscheidungsknopf verlieren und die Zusage bliebe grün —
  // die Schleife darunter urteilte dann still über zwei statt drei.
  if (m.vorhanden.join(",") !== ENTSCHEIDUNGEN.join(",")) {
    schlecht.push(
      `${ort}: die Karte trägt die Entscheidungsknöpfe [${m.vorhanden.join(", ")}] statt [${ENTSCHEIDUNGEN.join(", ")}]`,
    );
  }
  for (const knopf of m.knoepfe) {
    schlecht.push(...feldbefunde(knopf, m.fensterBreite, null, ort));
  }
  return schlecht;
}

// ==================================================================================================
// DER AUFBAU
// ==================================================================================================

let stand: H4Stand | null = null;
let aufbaufehler: string | null = null;

/** Die Meldung, mit der jeder Fall einen gescheiterten Aufbau anzeigt — nie ein stilles Grün. */
const aufbaumeldung = (): string =>
  aufbaufehler === null
    ? "der Aufbau der Bühne ist gelungen"
    : `die Bühne ist nicht messbereit geworden — kein Fall dieser Datei hat gemessen: ${aufbaufehler}`;

function buehne(): H4Stand {
  expect(aufbaufehler, aufbaumeldung()).toBeNull();
  if (stand === null) {
    throw new Error(aufbaumeldung());
  }
  return stand;
}

/**
 * Die Prüfkarte des Probeobjekts in der verlangten Sprache und Fensterbreite aufschlagen.
 *
 * Die Reihenfolge ist Absicht: erst das Fenster, dann die Sprache (sie lädt die Seite neu), dann
 * `/validierung`. So wird die Fläche EINMAL für die richtige Lage gezeichnet, statt nachträglich
 * umzubrechen.
 */
async function aufschlagen(sprache: (typeof SPRACHEN)[number], breite: number, hoehe: number) {
  const s = buehne();
  await s.seite.setViewportSize({ width: breite, height: hoehe });
  await spracheSetzen(s, sprache);
  await s.seite.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
  await s.seite.waitForFunction(
    fn(
      `() => document.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]').length > 0`,
    ),
    undefined,
    { timeout: 30_000 },
  );
  await s.seite.evaluate(fn(HINWEIS_WEG));
  const gewaehlt = await s.seite.evaluate<{ ok: boolean; gesehen: string[] }>(fn(WAEHLEN), TITEL);
  expect(
    gewaehlt.ok,
    `die Warteschlange führt „${TITEL}" nicht — gesehen: ${JSON.stringify(gewaehlt.gesehen)}`,
  ).toBe(true);
  await s.seite.waitForFunction(
    fn(`() => document.querySelector('[data-testid="pruefen-karte"]') !== null`),
    undefined,
    { timeout: 30_000 },
  );
  expect(
    await s.seite.evaluate<boolean>(fn(MEHR_OEFFNEN)),
    "der Aufklapper der Karte liess sich nicht öffnen",
  ).toBe(true);
  await s.seite.waitForFunction(
    fn(`(n) => document.querySelectorAll('[data-testid="pruefen-quellennachweis"]').length === n`),
    QUELLEN.length,
    { timeout: 30_000 },
  );
  return s;
}

async function messen(): Promise<Kartenmessung> {
  return await buehne().seite.evaluate<Kartenmessung>(fn(MESSEN), [...ENTSCHEIDUNGEN]);
}

/** Eine Verstellung in der Seite setzen und wieder zurücknehmen — für die Kalibrierungen (K4). */
const VERSTELLEN = `(arg) => {
  const wahl = arg[0];
  const eigenschaft = arg[1];
  const wert = arg[2];
  const el = document.querySelectorAll(wahl)[arg[3]];
  if (el === undefined) { return { ok: false, vorher: null }; }
  if (eigenschaft === 'tabindex' || eigenschaft.charAt(0) === '@') {
    const name = eigenschaft === 'tabindex' ? 'tabindex' : eigenschaft.slice(1);
    const vorher = el.getAttribute(name);
    if (wert === null) { el.removeAttribute(name); } else { el.setAttribute(name, wert); }
    return { ok: true, vorher: vorher };
  }
  const vorher = el.style.getPropertyValue(eigenschaft);
  if (wert === null) { el.style.removeProperty(eigenschaft); } else { el.style.setProperty(eigenschaft, wert, 'important'); }
  return { ok: true, vorher: vorher };
}`;

async function verstellen(
  wahl: string,
  eigenschaft: string,
  wert: string | null,
  rang = 0,
): Promise<void> {
  const ergebnis = await buehne().seite.evaluate<{ ok: boolean; vorher: string | null }>(
    fn(VERSTELLEN),
    [wahl, eigenschaft, wert, rang],
  );
  expect(ergebnis.ok, `die Verstellung fand „${wahl}" (Rang ${rang}) nicht`).toBe(true);
}

/** Einen Deckel über das erste Element von `wahl` legen — `null` räumt ihn wieder ab (K4d). */
async function deckeln(wahl: string | null): Promise<void> {
  const ergebnis = await buehne().seite.evaluate<{ ok: boolean }>(fn(DECKEL), wahl);
  expect(ergebnis.ok, `der Deckel fand „${wahl}" nicht`).toBe(true);
}

/** In der Seite: den sichtbaren Text EINES Elements ersetzen — für die Inhalts-Kalibrierung (K4e). */
const TEXT_ERSETZEN = `(arg) => {
  const el = document.querySelectorAll(arg[0])[arg[1]];
  if (el === undefined) { return { ok: false }; }
  el.textContent = arg[2];
  return { ok: true };
}`;

async function textErsetzen(wahl: string, rang: number, text: string): Promise<void> {
  const ergebnis = await buehne().seite.evaluate<{ ok: boolean }>(fn(TEXT_ERSETZEN), [
    wahl,
    rang,
    text,
  ]);
  expect(ergebnis.ok, `die Textersetzung fand „${wahl}" (Rang ${rang}) nicht`).toBe(true);
}

/**
 * Wie viele Tabulatorschritte eine Runde über die Fläche höchstens braucht.
 *
 * Die Zahl ist eine OBERGRENZE und kein Sollwert: die Tabfolge läuft nach der letzten Station der
 * Seite von vorn los, ein Abbruch „alle gefunden" gibt es im Negativfall also nicht. Gemessen am
 * 20.09. in der Cloud (Lauf 5ca7275b8db695a2687a649d): die drei Quellenlinks lagen innerhalb der
 * ersten Runde; 200 Schritte tragen diese Runde mit reichlich Luft und kosten unter einer Sekunde.
 */
const TABLAUF = 200;

/**
 * Die Quellenlinks, die eine Runde über die Tabfolge WIRKLICH erreicht — je Ziel einmal, in der
 * Reihenfolge des ersten Erreichens. Gemeinsam für die Zusage (K2) und ihre Kalibrierung (K4c):
 * zwei Erheber wären zwei Wahrheiten über dieselbe Tabfolge.
 */
async function ertastet(s: H4Stand): Promise<string[]> {
  const gesehen: string[] = [];
  for (let i = 0; i < TABLAUF && gesehen.length < QUELLEN.length; i += 1) {
    await s.seite.keyboard.press("Tab");
    const fokus = await s.seite.evaluate<Fokusstand | null>(fn(FOKUS_LESEN));
    if (
      fokus !== null &&
      fokus.testid === "pruefen-quelle-adresse" &&
      fokus.href !== null &&
      !gesehen.includes(fokus.href)
    ) {
      gesehen.push(fokus.href);
    }
  }
  return gesehen;
}

/**
 * Die Entscheidungsknöpfe, die eine Runde über die Tabfolge WIRKLICH erreicht — je Kennung einmal,
 * mit der Lage, die der Fokus-Bildlauf des Browsers ihnen gegeben hat. Gegenstück zu `ertastet`
 * und aus demselben Grund gemeinsam für Zusage (K3) und Kalibrierung (K4d).
 */
async function ertasteteKnoepfe(s: H4Stand): Promise<Map<string, Fokusstand>> {
  const gesehen = new Map<string, Fokusstand>();
  // ABGEBROCHEN WIRD ERST BEI ALLEN DREI. Bis Runde 2 stand hier `< 2` — die Schleife sammelte
  // `up` und `warn`, hörte auf und meldete `down` als unerreichbar. Der Abbruch hing an einer Zahl,
  // die niemand mit der Fläche verglichen hatte.
  for (let i = 0; i < TABLAUF && gesehen.size < ENTSCHEIDUNGEN.length; i += 1) {
    await s.seite.keyboard.press("Tab");
    const fokus = await s.seite.evaluate<Fokusstand | null>(fn(FOKUS_LESEN));
    const kennung = fokus?.testid ?? "";
    if (fokus !== null && kennung.startsWith("pruefen-entscheidung-") && !gesehen.has(kennung)) {
      gesehen.set(kennung, fokus);
    }
  }
  return gesehen;
}

/** Das Rechteck liegt VOLLSTÄNDIG im Fenster — waagerecht und senkrecht. */
function ausserhalb(
  r: { links: number; rechts: number; oben: number; unten: number },
  breite: number,
  hoehe: number,
): string | null {
  if (r.links < -SPIEL || r.rechts > breite + SPIEL) {
    return `waagerecht ${r.links.toFixed(1)}…${r.rechts.toFixed(1)} px im ${breite} px breiten Fenster`;
  }
  if (r.oben < -SPIEL || r.unten > hoehe + SPIEL) {
    return `senkrecht ${r.oben.toFixed(1)}…${r.unten.toFixed(1)} px im ${hoehe} px hohen Fenster`;
  }
  return null;
}

/**
 * Die ZEIGER-Erreichbarkeit eines Knopfes, von der Verstellung bis zum echten Mausklick — eine
 * Liste von Befunden, leer heisst erreichbar. Gemeinsam für K3 und K4d.
 */
async function zeigerbefunde(s: H4Stand, kennung: string, ort: string): Promise<string[]> {
  const wo = `${ort} · Entscheidung ${kennung}`;
  const lage = await s.seite.evaluate<Knopflage>(fn(KNOPF_ERREICHEN), kennung);
  if (!lage.da) {
    return [`${wo}: der Knopf steht gar nicht auf der Karte`];
  }
  const schlecht: string[] = [];
  if (lage.sichtbar !== true) {
    schlecht.push(`${wo}: checkVisibility() = false`);
  }
  if ((lage.text ?? "").length === 0) {
    schlecht.push(`${wo}: innerText ist leer — der Knopf trägt keine lesbare Beschriftung`);
  }
  const daneben = ausserhalb(
    {
      links: lage.links ?? 0,
      rechts: lage.rechts ?? 0,
      oben: lage.oben ?? 0,
      unten: lage.unten ?? 0,
    },
    lage.fensterBreite ?? 0,
    lage.fensterHoehe ?? 0,
  );
  if (daneben !== null) {
    schlecht.push(`${wo}: liegt nach dem Bildlauf nicht ganz im Bild — ${daneben}`);
  }
  if (lage.gesperrt === true) {
    schlecht.push(`${wo}: ist gesperrt (disabled)`);
  }
  if (lage.zeigerAus === true) {
    schlecht.push(`${wo}: nimmt keine Zeigerereignisse an (pointer-events: none)`);
  }
  if (lage.trifft !== true) {
    schlecht.push(
      `${wo}: der Klickpunkt (${(lage.x ?? 0).toFixed(1)}, ${(lage.y ?? 0).toFixed(1)}) trifft nicht den Knopf, sondern ${lage.getroffenVon} — er ist verdeckt`,
    );
  }
  if (schlecht.length > 0) {
    return schlecht;
  }
  // Erst wenn der Punkt frei ist, wird wirklich geklickt — sonst misst der Klick einen Deckel.
  const vorher = (
    await s.seite.evaluate<{ knoepfe: { testid: string | null }[] }>(fn(ABFANG_LESEN))
  ).knoepfe.length;
  await s.seite.mouse.click(lage.x ?? 0, lage.y ?? 0);
  const nachher = await s.seite.evaluate<{
    eingebaut: boolean;
    knoepfe: { testid: string | null; disabled: boolean }[];
  }>(fn(ABFANG_LESEN));
  if (!nachher.eingebaut) {
    return [`${wo}: die Auslösemessung war gar nicht eingebaut — über den Klick ist nichts gesagt`];
  }
  const neu = nachher.knoepfe.slice(vorher);
  if (neu.length !== 1 || neu[0]?.testid !== `pruefen-entscheidung-${kennung}`) {
    schlecht.push(
      `${wo}: der echte Mausklick kam NICHT am Knopf an — mitgeschrieben: ${JSON.stringify(neu)}`,
    );
  }
  return schlecht;
}

describe("JOB 4361 · lange Quellennachweise auf der Prüfkarte, im echten Chromium", () => {
  beforeAll(async () => {
    try {
      await baueFrisch();
      stand = await h4Stand("/bibliothek", "pedi@job4361.test", async ({ services, autorId }) => {
        const ko = (await services.ko.create({
          title: TITEL,
          statement:
            "Vor jeder Wartung an der Druckanlage wird der drucklose Zustand von zwei Personen bestätigt.",
          type: "best_practice",
          category: "Wartung",
          author: autorId,
          // Die Quellen kommen beim Anlegen mit — derselbe Bestandsweg, den die Bühne für ihre
          // eigene Quelle benutzt (`h4-harness.ts:298-309`). Die öffentliche `add-source`-Aktion
          // liefe gegen das Stufen-Tor, und das ist richtig so und wird nicht aufgeweicht.
          sources: QUELLEN.map((q) => ({
            id: q.id,
            label: q.label,
            url: q.url,
            excerpt: q.excerpt,
            kind: "external",
            peerValidated: false,
            objectId: q.objectId,
            author: autorId,
            at: q.at,
          })),
        } as never)) as { id: string };
        // Der DATEINAME steht nicht an der Quelle, sondern am Anhang desselben Objekts und wird
        // beim Anzeigen aufgelöst (`lib/koSource.ts`, `quellennachweis`). Also muss es die Anhänge
        // wirklich geben — sonst misst K1 einen Nachweis ohne Datei.
        for (const q of QUELLEN) {
          await services.ko.addAttachment(ko.id, autorId, {
            name: q.datei,
            mime: "application/pdf",
            objectId: q.objectId,
          });
        }
      });
    } catch (e) {
      aufbaufehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 300_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  // ================================================================================================
  // K1/K3 · SECHS LAGEN: ZWEI FENSTER × DREI SPRACHEN
  // ================================================================================================
  for (const f of FENSTER) {
    for (const sprache of SPRACHEN) {
      const ort = `${f.breite}×${f.hoehe} · ${sprache}`;
      it(`K1/K3 · ${ort}: jede der drei langen Quellen steht vollständig im Bild`, async () => {
        const s = await aufschlagen(sprache, f.breite, f.hoehe);
        const m = await messen();
        const zeilen = m.quellen
          .map(
            (q, i) =>
              `Q${i + 1} Adresse ${(q.adresse.rechts ?? 0).toFixed(1)}≤${(q.adresse.grenzeRechts ?? 0).toFixed(1)} · ` +
              `Zeit ${(q.zeit.rechts ?? 0).toFixed(1)}≤${(q.zeit.grenzeRechts ?? 0).toFixed(1)} · ` +
              `Beleg ${(q.auszug.rechts ?? 0).toFixed(1)}≤${(q.auszug.grenzeRechts ?? 0).toFixed(1)} · ` +
              `Datei ${(q.datei.rechts ?? 0).toFixed(1)}≤${(q.datei.grenzeRechts ?? 0).toFixed(1)}`,
          )
          .join(" | ");
        console.log(
          `JOB 4361 · ${ort} · Seite ${m.seitenBreite} px / Fenster ${m.fensterBreite} px · ${zeilen}`,
        );
        expect(befunde(m, ort)).toEqual([]);
        expect(s.seitenfehler).toEqual([]);
      }, 180_000);
    }
  }

  // ================================================================================================
  // K3 · DIE ENTSCHEIDUNGSKNÖPFE SIND WIRKLICH ERREICHBAR — Tastatur UND Zeiger (RUNDE 2)
  // ================================================================================================
  //
  // BENs Korrekturpflicht 2 an Runde 1: „K3 durch tatsächliche Erreichbarkeit beider
  // Entscheidungsknöpfe bei langen Quellen belegen; reine horizontale Feldgeometrie genügt dafür
  // nicht." Runde 1 schickte die Knöpfe nur durch dieselbe waagerechte Feldprüfung wie die
  // Nachweisangaben — ein Knopf unter dem Fensterrand, unter einem Deckel oder mit
  // `pointer-events: none` wäre dort grün geblieben.
  //
  // GEMESSEN WIRD JETZT BEIDES, an der geöffneten Karte mit den drei langen Quellen:
  //   Tastatur — echte Tab-Anschläge bis zu ALLEN DREI Knöpfen, sichtbarer Fokus, und das Rechteck
  //              liegt NACH dem Fokus-Bildlauf des Browsers vollständig im Fenster.
  //   Zeiger   — `scrollIntoView({ block: 'center' })`, danach Rechteck im Fenster,
  //              `elementFromPoint` am Mittelpunkt trifft frei den Knopf, und ein ECHTER
  //              Mausklick an diesem Punkt kommt an ihm an.
  //
  // UND DER BESTAND BLEIBT, WIE ER WAR: der mitgehörte Klick wird in der Einfangphase angehalten
  // (s. `ABFANG`), damit die Entscheidung nicht läuft. Das wird nicht behauptet, sondern am
  // Kartenzustand vorher/nachher nachgelesen — sonst hinge der nächste Fall an einem veränderten
  // Wissensobjekt, ohne dass es jemand sähe.
  for (const f of FENSTER) {
    it(`K3 · ${f.breite} px: alle drei Entscheidungsknöpfe sind bei langen Quellen wirklich erreichbar`, async () => {
      const s = await aufschlagen("de", f.breite, f.hoehe);
      await s.seite.evaluate(fn(ABFANG));
      const vorher = await s.seite.evaluate<Kartenzustand>(fn(KARTENZUSTAND));
      expect(vorher.titel, "die Karte des Probeobjekts steht nicht").toBe(TITEL);
      expect(vorher.nachweise).toBe(QUELLEN.length);
      // Der Umfang zuerst: über eine Menge zu urteilen, die man nicht gezählt hat, ist die Lücke,
      // an der Runde 2 gescheitert ist.
      expect(
        (await messen()).vorhanden,
        "die Karte trägt nicht genau die drei bekannten Entscheidungsknöpfe",
      ).toEqual([...ENTSCHEIDUNGEN]);

      // ---- Tastatur -------------------------------------------------------------------------
      const perTaste = await ertasteteKnoepfe(s);
      const schlecht: string[] = [];
      for (const kennung of ENTSCHEIDUNGEN) {
        const wo = `${f.breite} px · Entscheidung ${kennung} · Tastatur`;
        const fokus = perTaste.get(`pruefen-entscheidung-${kennung}`);
        if (fokus === undefined) {
          schlecht.push(`${wo}: in ${TABLAUF} Tab-Anschlägen NICHT erreicht`);
          continue;
        }
        if (!fokus.sichtbar) {
          schlecht.push(`${wo}: checkVisibility() = false`);
        }
        if (!fokus.fokusSichtbar) {
          schlecht.push(`${wo}: :focus-visible greift nicht — kein Tastaturfokus`);
        }
        if (fokus.boxShadow === "none" && fokus.outline.startsWith("none")) {
          schlecht.push(
            `${wo}: kein gezeichneter Fokus (boxShadow none, outline ${fokus.outline})`,
          );
        }
        const daneben = ausserhalb(fokus, f.breite, f.hoehe);
        if (daneben !== null) {
          schlecht.push(`${wo}: nach dem Fokus-Bildlauf nicht ganz im Bild — ${daneben}`);
        }
      }
      expect(schlecht).toEqual([]);

      // ---- Zeiger ---------------------------------------------------------------------------
      for (const kennung of ENTSCHEIDUNGEN) {
        expect(await zeigerbefunde(s, kennung, `${f.breite} px`)).toEqual([]);
      }

      // ---- Der Bestand ist unberührt ----------------------------------------------------------
      const nachher = await s.seite.evaluate<Kartenzustand>(fn(KARTENZUSTAND));
      expect(nachher, "die Messung hat die Prüfkarte verändert").toEqual(vorher);
      const abfang = await s.seite.evaluate<{
        knoepfe: { testid: string | null; disabled: boolean }[];
      }>(fn(ABFANG_LESEN));
      expect(abfang.knoepfe.map((k) => k.testid)).toEqual(
        ENTSCHEIDUNGEN.map((v) => `pruefen-entscheidung-${v}`),
      );
      expect(
        abfang.knoepfe.every((k) => k.disabled === false),
        `ein angeklickter Knopf war gesperrt: ${JSON.stringify(abfang.knoepfe)}`,
      ).toBe(true);
      expect(s.seitenfehler).toEqual([]);
    }, 180_000);
  }

  // ================================================================================================
  // K2 · DER LINK JEDER QUELLE — MIT DER ECHTEN TABULATOR-TASTE UND MIT ENTER
  // ================================================================================================
  for (const f of FENSTER) {
    it(`K2 · ${f.breite} px: jeder Quellenlink ist ertastbar und löst mit Enter aus`, async () => {
      const s = await aufschlagen("de", f.breite, f.hoehe);
      await s.seite.evaluate(fn(ABFANG));

      const gefunden: Fokusstand[] = [];
      const wege: string[] = [];
      for (let i = 0; i < TABLAUF && gefunden.length < QUELLEN.length; i += 1) {
        await s.seite.keyboard.press("Tab");
        const fokus = await s.seite.evaluate<Fokusstand | null>(fn(FOKUS_LESEN));
        if (fokus === null) {
          continue;
        }
        wege.push(`${fokus.tag}${fokus.testid === null ? "" : `/${fokus.testid}`}`);
        if (fokus.testid !== "pruefen-quelle-adresse") {
          continue;
        }
        // Die Tabfolge LÄUFT UM: nach der letzten Station der Seite beginnt sie von vorn. Gezählt
        // wird deshalb je Ziel EINMAL — sonst käme dieselbe Station in der zweiten Runde erneut
        // dazu, und eine Zählung „drei erreicht" sagte nichts über DREI Links.
        if (gefunden.some((g) => g.href === fokus.href)) {
          continue;
        }
        gefunden.push(fokus);
        await s.seite.keyboard.press("Enter");
      }

      expect(
        gefunden.length,
        `die Tabfolge erreichte ${gefunden.length} von ${QUELLEN.length} Quellenlinks — Weg: ${wege.slice(0, 60).join(" → ")}`,
      ).toBe(QUELLEN.length);

      const schlecht: string[] = [];
      gefunden.forEach((fokus, i) => {
        const wo = `${f.breite} px · Quelle ${i + 1} · Link`;
        if (fokus.tag !== "A") {
          schlecht.push(`${wo}: der Fokus sitzt auf <${fokus.tag}> statt auf dem Anker`);
        }
        if (fokus.href !== (QUELLEN[i] as Quellkulisse).url) {
          schlecht.push(`${wo}: href ist „${fokus.href}"`);
        }
        if (!fokus.sichtbar) {
          schlecht.push(`${wo}: checkVisibility() = false`);
        }
        if (!fokus.fokusSichtbar) {
          schlecht.push(`${wo}: :focus-visible greift nicht — kein Tastaturfokus`);
        }
        if (fokus.boxShadow === "none" && fokus.outline.startsWith("none")) {
          schlecht.push(
            `${wo}: kein gezeichneter Fokus (boxShadow none, outline ${fokus.outline})`,
          );
        }
        if (fokus.links < -SPIEL || fokus.rechts > f.breite + SPIEL) {
          schlecht.push(
            `${wo}: Rechteck ${fokus.links.toFixed(1)}…${fokus.rechts.toFixed(1)} px liegt nicht im ${f.breite} px breiten Fenster`,
          );
        }
        if (fokus.oben < -SPIEL || fokus.unten > f.hoehe + SPIEL) {
          schlecht.push(
            `${wo}: Rechteck ${fokus.oben.toFixed(1)}…${fokus.unten.toFixed(1)} px liegt nicht im ${f.hoehe} px hohen Fenster`,
          );
        }
      });
      expect(schlecht).toEqual([]);

      const abfang = await s.seite.evaluate<{
        eingebaut: boolean;
        klicks: { href: string | null; testid: string | null }[];
        pfad: string;
      }>(fn(ABFANG_LESEN));
      expect(abfang.eingebaut, "die Auslösemessung war gar nicht eingebaut").toBe(true);
      expect(abfang.klicks.map((k) => k.href)).toEqual(QUELLEN.map((q) => q.url));
      expect(
        abfang.klicks.every((k) => k.testid === "pruefen-quelle-adresse"),
        `ausgelöst wurde: ${JSON.stringify(abfang.klicks)}`,
      ).toBe(true);
      // Die Gegenrichtung: der Link führt NICHT ins Wissensobjekt (`cardClickOpens` hält ihn).
      expect(abfang.pfad).toBe("/validierung");
      expect(s.seitenfehler).toEqual([]);
    }, 180_000);
  }

  // ================================================================================================
  // K4 · DIE KALIBRIERUNG — JEDE ZUSAGE WIRD GEZIELT ZUM SCHEITERN GEBRACHT
  // ================================================================================================
  //
  // Ohne sie ist kein Nachweis erbracht (Lehre 9 des Bahn-Regelwerks, dreimal am 17.09. bezahlt).
  // Jede Probe verstellt GENAU EINE Sache an sonst unveränderter Fläche, misst mit DERSELBEN
  // Funktion wie die Zusage darüber, verlangt einen Befund, der das betroffene Feld NAMENTLICH
  // nennt, nimmt die Verstellung zurück und verlangt wieder Grün.
  it("K4a · ein ausgeblendeter Nachweis macht genau diese Messung rot", async () => {
    await aufschlagen("de", 320, 568);
    expect(befunde(await messen(), "K4a vorher")).toEqual([]);

    // (1) `display: none` an der Belegstelle der zweiten Quelle.
    await verstellen('[data-testid="pruefen-quelle-auszug"]', "display", "none", 1);
    const ohneAuszug = befunde(await messen(), "K4a");
    expect(ohneAuszug.join(" · ")).toContain("Quelle 2 · Belegstelle");
    await verstellen('[data-testid="pruefen-quelle-auszug"]', "display", null, 1);
    expect(befunde(await messen(), "K4a Rücknahme 1")).toEqual([]);

    // (2) `visibility: hidden` am Dateinamen der dritten Quelle — dieselbe Zusage, andere Gestalt.
    await verstellen('[data-testid="pruefen-quelle-datei"]', "visibility", "hidden", 2);
    const ohneDatei = befunde(await messen(), "K4a");
    expect(ohneDatei.join(" · ")).toContain("Quelle 3 · Datei");
    await verstellen('[data-testid="pruefen-quelle-datei"]', "visibility", null, 2);
    expect(befunde(await messen(), "K4a Rücknahme 2")).toEqual([]);

    // (3) Der Zeitpunkt der ersten Quelle, auf Deckkraft 0 — `checkVisibility({checkOpacity})`.
    await verstellen('[data-testid="pruefen-quelle-zeit"]', "opacity", "0", 0);
    const ohneZeit = befunde(await messen(), "K4a");
    expect(ohneZeit.join(" · ")).toContain("Quelle 1 · Zeitpunkt");
    await verstellen('[data-testid="pruefen-quelle-zeit"]', "opacity", null, 0);
    expect(befunde(await messen(), "K4a Rücknahme 3")).toEqual([]);
  }, 180_000);

  it("K4b · eine Adresse ohne Umbruch läuft über den Rand und wird rot", async () => {
    await aufschlagen("de", 320, 568);
    expect(befunde(await messen(), "K4b vorher")).toEqual([]);

    // GENAU DIE EIGENSCHAFT, DIE DEN FALL TRÄGT: ohne `break-all`/`anywhere` ist die gekürzte
    // Adresse EIN Wort ohne Umbruchpunkt und ragt aus der Karte. Steht die Zusage, muss sie das
    // sehen; sieht sie es nicht, misst sie nichts.
    await verstellen('[data-testid="pruefen-quelle-adresse"]', "word-break", "normal", 0);
    await verstellen('[data-testid="pruefen-quelle-adresse"]', "overflow-wrap", "normal", 0);
    const ueberRand = befunde(await messen(), "K4b");
    expect(ueberRand.join(" · ")).toContain("Quelle 1 · Adresse");
    expect(ueberRand.join(" · ")).toContain("abgeschnitten");

    await verstellen('[data-testid="pruefen-quelle-adresse"]', "word-break", null, 0);
    await verstellen('[data-testid="pruefen-quelle-adresse"]', "overflow-wrap", null, 0);
    expect(befunde(await messen(), "K4b Rücknahme")).toEqual([]);
  }, 180_000);

  it("K4c · ein Link ausserhalb der Tabfolge wird nicht mehr ertastet", async () => {
    const s = await aufschlagen("de", 320, 568);
    await s.seite.evaluate(fn(ABFANG));

    // Der erste Quellenlink verlässt die Tabfolge; die übrigen zwei bleiben, damit die Probe die
    // Lage „einer fehlt" misst und nicht „gar nichts geht".
    await verstellen('[data-testid="pruefen-quelle-adresse"]', "tabindex", "-1", 0);

    const getastet = await ertastet(s);
    expect(
      getastet,
      "der aus der Tabfolge genommene Link durfte NICHT mehr erreichbar sein",
    ).not.toContain((QUELLEN[0] as Quellkulisse).url);
    expect(getastet).toEqual(QUELLEN.slice(1).map((q) => q.url));

    await verstellen('[data-testid="pruefen-quelle-adresse"]', "tabindex", null, 0);
    expect(await ertastet(s)).toEqual(QUELLEN.map((q) => q.url));
  }, 180_000);

  // ------------------------------------------------------------------------------------------------
  // K4d · DIE KALIBRIERUNG DER NEUEN K3-ZUSAGE (Runde 2)
  // ------------------------------------------------------------------------------------------------
  //
  // Beide Wege werden einzeln zum Scheitern gebracht, denn sie messen verschiedene Fehlerklassen:
  // ein Knopf kann für die TASTATUR verschwinden (aus der Tabfolge genommen) und für den ZEIGER
  // (von einem Deckel verdeckt) — und keine der beiden Lagen verändert sein Rechteck. Genau
  // deshalb genügte die Feldgeometrie aus Runde 1 nicht.
  it("K4d · ein unerreichbarer Entscheidungsknopf macht genau diese Messung rot", async () => {
    const s = await aufschlagen("de", 320, 568);
    await s.seite.evaluate(fn(ABFANG));
    expect(await zeigerbefunde(s, "up", "K4d vorher")).toEqual([]);
    const alle = ENTSCHEIDUNGEN.map((v) => `pruefen-entscheidung-${v}`).sort();
    expect(
      [...(await ertasteteKnoepfe(s)).keys()].sort(),
      "vorher sind alle drei Knöpfe ertastbar",
    ).toEqual(alle);

    // (1) TASTATUR: „Freigeben" verlässt die Tabfolge. Rückfrage und Ablehnen bleiben, damit die
    //     Probe die Lage „einer fehlt" misst und nicht „gar nichts geht". Verglichen wird als
    //     MENGE: die Reihenfolge des ersten Erreichens hängt davon ab, wo der Fokus gerade stand,
    //     und wäre als Sollwert eine Zufälligkeit.
    await verstellen('[data-testid="pruefen-entscheidung-up"]', "tabindex", "-1", 0);
    const ohneTab = [...(await ertasteteKnoepfe(s)).keys()].sort();
    expect(
      ohneTab,
      "der aus der Tabfolge genommene Knopf durfte NICHT mehr erreichbar sein",
    ).not.toContain("pruefen-entscheidung-up");
    expect(ohneTab).toEqual(
      ENTSCHEIDUNGEN.filter((v) => v !== "up")
        .map((v) => `pruefen-entscheidung-${v}`)
        .sort(),
    );
    await verstellen('[data-testid="pruefen-entscheidung-up"]', "tabindex", null, 0);
    expect([...(await ertasteteKnoepfe(s)).keys()].sort()).toEqual(alle);

    // (2) ZEIGER: ein Deckel genau über „Ablehnen" — Rechteck, Sichtbarkeit und Beschriftung
    //     bleiben unverändert, nur der Klickpunkt gehört jetzt jemand anderem.
    await deckeln('[data-testid="pruefen-entscheidung-down"]');
    const verdeckt = await zeigerbefunde(s, "down", "K4d");
    expect(verdeckt.join(" · ")).toContain("Entscheidung down");
    expect(verdeckt.join(" · ")).toContain("verdeckt");
    expect(verdeckt.join(" · ")).toContain("job4361-deckel");
    await deckeln(null);
    expect(await zeigerbefunde(s, "down", "K4d Rücknahme")).toEqual([]);

    // (3) ZEIGER: derselbe Knopf, andere Fehlerklasse — er nimmt keine Zeigerereignisse mehr an.
    await verstellen('[data-testid="pruefen-entscheidung-down"]', "pointer-events", "none", 0);
    const ohneZeiger = await zeigerbefunde(s, "down", "K4d");
    expect(ohneZeiger.join(" · ")).toContain("pointer-events: none");
    await verstellen('[data-testid="pruefen-entscheidung-down"]', "pointer-events", null, 0);
    expect(await zeigerbefunde(s, "down", "K4d Rücknahme 3")).toEqual([]);

    // Auch diese Kalibrierung hat die Entscheidung NICHT ausgelöst.
    const zustand = await s.seite.evaluate<Kartenzustand>(fn(KARTENZUSTAND));
    expect(zustand.titel).toBe(TITEL);
    expect(zustand.quittung).toBe(false);
  }, 180_000);

  // ------------------------------------------------------------------------------------------------
  // K4e · DIE KALIBRIERUNG DER INHALTSPRÜFUNG (Runde 2, BENs Prüflücke 6)
  // ------------------------------------------------------------------------------------------------
  //
  // Runde 1 verglich nur die ersten 40 Zeichen. Diese Probe schneidet den REST weg und verlangt,
  // dass die Zusage das sieht — sonst wäre eine gekürzte Belegstelle weiterhin grün.
  it("K4e · eine gekürzte Belegstelle und eine gekürzte Adresse werden rot", async () => {
    await aufschlagen("de", 320, 568);
    expect(befunde(await messen(), "K4e vorher")).toEqual([]);

    // (1) Die Belegstelle der zweiten Quelle verliert ihren Rest — der Anfang bleibt heil.
    const voll = (QUELLEN[1] as Quellkulisse).excerpt;
    await textErsetzen('[data-testid="pruefen-quelle-auszug"]', 1, `${voll.slice(0, 45)}…`);
    const gekuerzt = befunde(await messen(), "K4e");
    expect(gekuerzt.join(" · ")).toContain("Quelle 2 · Belegstelle");
    expect(gekuerzt.join(" · ")).toContain("nicht der zugesagte Text");
    await textErsetzen('[data-testid="pruefen-quelle-auszug"]', 1, voll);
    expect(befunde(await messen(), "K4e Rücknahme 1")).toEqual([]);

    // (2) Dasselbe an der Adresse: die Anzeige kürzt auf 80 Zeichen — 60 sind ein anderer Text.
    const sollAdresse = sichtbareAdresse((QUELLEN[2] as Quellkulisse).url);
    await textErsetzen('[data-testid="pruefen-quelle-adresse"]', 2, `${sollAdresse.slice(0, 60)}…`);
    const kurzeAdresse = befunde(await messen(), "K4e");
    expect(kurzeAdresse.join(" · ")).toContain("Quelle 3 · Adresse");
    expect(kurzeAdresse.join(" · ")).toContain("nicht der zugesagte Text");
    await textErsetzen('[data-testid="pruefen-quelle-adresse"]', 2, sollAdresse);
    expect(befunde(await messen(), "K4e Rücknahme 2")).toEqual([]);
  }, 180_000);

  // ------------------------------------------------------------------------------------------------
  // K4f · DIE KALIBRIERUNG DES UMFANGS (Runde 3)
  // ------------------------------------------------------------------------------------------------
  //
  // DIE ZUSAGE, DIE HIER GEPRÜFT WIRD, IST DIE JÜNGSTE — und sie ist da, weil sie gefehlt hat:
  // Runde 1 und 2 urteilten über „die Entscheidungsknöpfe", ohne je zu zählen, wie viele die Karte
  // trägt. Beide hielten zwei für alle. Seit Runde 3 legt `befunde` die zur Laufzeit erhobene Menge
  // gegen die feste Liste `ENTSCHEIDUNGEN`. Eine Zählung, die man nicht zum Scheitern bringen kann,
  // ist keine — also verschwindet hier ein Knopf aus der Menge, und die Zusage muss das benennen.
  it("K4f · verschwindet ein Entscheidungsknopf, sagt die Messung es", async () => {
    await aufschlagen("de", 320, 568);
    expect(befunde(await messen(), "K4f vorher")).toEqual([]);
    expect((await messen()).vorhanden).toEqual([...ENTSCHEIDUNGEN]);

    // Die Rückfrage verliert ihre Kennung — für jede Erhebung über `data-testid` ist sie damit weg,
    // während sie sichtbar auf der Karte stehen bleibt. Genau diese Lage hat in Runde 2 niemand
    // gesehen, weil gar nicht gezählt wurde.
    await verstellen(
      '[data-testid="pruefen-entscheidung-warn"]',
      "@data-testid",
      "job4361-entfernte-kennung",
      0,
    );
    const ohneWarn = await messen();
    expect(ohneWarn.vorhanden).toEqual(["up", "down"]);
    const gemeldet = befunde(ohneWarn, "K4f").join(" · ");
    expect(gemeldet).toContain("die Karte trägt die Entscheidungsknöpfe [up, down] statt");
    // UND der fehlende Knopf wird zusätzlich einzeln benannt — nicht nur als Zahl.
    expect(gemeldet).toContain("Entscheidung warn: das Element steht gar nicht auf der Karte");

    await verstellen(
      '[data-testid="job4361-entfernte-kennung"]',
      "@data-testid",
      "pruefen-entscheidung-warn",
      0,
    );
    expect(befunde(await messen(), "K4f Rücknahme")).toEqual([]);
  }, 180_000);
});
