// ================================================================================================
// JOB 3046 · D2 „KEIN WISSEN“ — DIE AUSKUNFTSFLAECHE, AM ECHTEN PANEL IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE: „Sieht der Mensch in Word bei einer Luecke das, was ich gezeichnet habe — eine ruhige,
// mittige Auskunft mit Lupe, EINEM Satz, ‚Frage aendern‘ als Hauptaktion und der offenen Frage als
// Textlink — statt des gelben Warnkastens? Und bringt ‚Frage aendern‘ mich zurueck in die Frage?“
//
// WAS DIESE DATEI TUT:
//   · Sie laedt das AUSGELIEFERTE Aufgabenfenster (`apps/web/public/word-addin/taskpane.html`, die
//     buildlose Datei selbst — es gibt keinen zweiten Quelltext) in einem echten Chromium ueber
//     Playwright, unter `http://klarwerk.test/word-addin/taskpane.html`, im Viewport des Zielbilds
//     (360 px breit). Jeder `/api/*`-Abruf wird beantwortet wie in der Panel-Fixture; `POST /api/ask`
//     antwortet mit einer ECHTEN LUECKE (`answered: false`, keine Quellen — dieselbe Form, die die
//     echte App ohne Wissen liefert; JOB 3010 Fall K0). Damit steht das Fenster im Lueckenzustand.
//   · Sie vergleicht JE WERT aus `WERTE_FRAGEWEG_LUECKE` (tools/design-vergleich/werte.ts) den
//     Sollwert aus `KeinWissen.dc.html` mit dem WIRKSAMEN Wert am realen Element (`getComputedStyle`).
//     Der Selektor jedes Messpunkts wird zu einem CSS-Pfad aufgeloest und rueckwaerts geprueft — der
//     Pfad muss dasselbe Element liefern. Selektor, Pfad, Sollwert, Istwert und Quelle stehen je Wert
//     im Protokoll.
//   · Sie belegt das VERHALTEN: (i) im Lueckenzustand ist panelweit genau EIN `primary` sichtbar;
//     (ii) ein echter Chromium-Klick auf „Frage aendern“ schliesst die Flaeche, setzt den Fokus in
//     `#ask-input` mit dem Cursor am Ende und laesst den Text stehen — ohne Serveraufruf; (iii) der
//     Textlink „offene Frage“ loest denselben Sendeweg aus wie bisher (`POST /api/drafts`,
//     `askGapSentOk` erscheint, `#ask-gap-open-block` wird sichtbar) und navigiert NICHT (href="#").
//   · RUNDE 2 (BEN): sie misst die GEOMETRIE bei 360x720 mit Bounding-Rects (Fall G) — die
//     Frage-Karte am oberen Fensterrand, der Lueckenblock bis zum unteren, freier Raum ueber UND
//     unter dem Inhalt der Flaeche (gleich gross: `justify-content: center` wirkt, weil
//     `flex-grow: 1` einen flexiblen Elternraum hat), die Kinder mittig, der Satz im Bild; sie prueft
//     die AHNEN der Flaeche bis zum Panel auf Hintergrund, Rand, Schatten und Kartenklasse (Fall K);
//     und sie fuehrt die UEBERLAPPUNG mit festgehaltener `/api/drafts`-Route aus: offene Frage
//     gesendet → vor dem Ruecklauf „Frage aendern“ → andere Frage → der alte Ruecklauf (Erfolg wie
//     Fehler) darf die neue Oberflaeche nicht veraendern (Faelle iv/v).
//
// DIE MESSSTRECKE (Auftrag §3): die Chromium-Panelmessstrecke aus JOB 3016 liegt im Basisstand
// 9ae6c22 dieses Baums NICHT vor (JOB 3016 ist nach diesem Basisstand eingebaut worden; unter
// `tests/design/` gibt es hier nur die jsdom-Messungen und die Chromium-Laeufe der Validierungsseite
// `zielbild-validierung.test.ts` / `job2935-validierung-fussband.test.ts`). Gebaut ist deshalb — wie der
// Auftrag es fuer diesen Fall vorschreibt — dieselbe Strecke, die JOB 3016 aus
// `zielbild-validierung.test.ts` abgeleitet hat: Playwright-Route statt Server, Panel aus `public/`,
// Office-Stummel in der Form der Panel-Fixture, Sollwerte ohne Renderer kanonisiert
// (Hex → `rgb(r, g, b)`), Selektor als Beleg, ein Vergleich je Wert. Keine zweite Strecke: dieselbe
// Bauform, dieselben Helfer, damit D1/D2/D3/D4 dasselbe Panel auf dieselbe Weise messen.
//
// KEIN OFFENER WERT: jeder aus dem Zielbild gelesene Wert hat hier eine fehlschlagende Assertion.
// Ein Wert, der nur protokolliert wuerde, machte den Lauf nicht rot und waere keine Messung.
//
// KALIBRIERUNG GEGEN DEN STILLEN NULL-TREFFER (Auftrag §6): gemessen wird erst, wenn `POST /api/ask`
// WIRKLICH abgegangen ist und die Lueckenflaeche steht; jeder Messpunkt muss ein Element treffen.
// Fehlt eines davon, ist der Lauf rot — kein „0 von 0 gruen“.
//
// SCHNITTPUNKT MIT DER jsdom-MESSUNG (`zielbild-keinwissen-messung.test.ts`, JOB 3010): dort werden
// Struktur, Wortlaut, Reihenfolge, Verlustliste und die Uebergaenge am laufenden Rumpf gemessen;
// reine Darstellungswerte tragen dort „nicht messbar in jsdom“ und werden HIER gemessen. Kein Wert
// steht in beiden Dateien als Vergleich — eine Wahrheit je Wert.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WERTE_FRAGEWEG_LUECKE } from "../../tools/design-vergleich/werte";

const WURZEL = resolve(process.cwd());
const PANEL_DATEI = join(WURZEL, "apps/web/public/word-addin/taskpane.html");
const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/KeinWissen.dc.html";
const ORIGIN = "http://klarwerk.test";
const PANEL_URL = `${ORIGIN}/word-addin/taskpane.html`;
/** Die Frage aus dem Zielbild (Z.23) — dieselbe Frage geht hier durch das echte Panel. */
const FRAGE = "Wie lagern wir Ersatzteile für Linie 4?";
/** Die Kennung, die der Entwurfs-Stummel vergibt — sie muss im Link zum Entwurf wieder auftauchen. */
const ENTWURF_ID = "draft-3046";
/** Runde 2: die Fragen der Ueberlappungsfaelle — jede anders, damit ein Ruecklauf zuordenbar ist. */
const FRAGE_A = "Was gilt für Linie 8?";
const FRAGE_B = "Neue Frage zu Linie 9?";
const FRAGE_C = "Gibt es eine Regel für Linie 10?";
const FRAGE_D = "Und für Linie 11?";

// ---- Sollwerte: ohne Renderer kanonisiert (dieselbe Form wie zielbild-validierung.test.ts) ------
function hexZuRgb(hex: string): string {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
  const r = Number.parseInt(h.slice(1, 3), 16);
  const g = Number.parseInt(h.slice(3, 5), 16);
  const b = Number.parseInt(h.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
function kanon(wert: string | null): string | null {
  if (wert === null) {
    return null;
  }
  return (
    wert
      .replace(/\s+/g, " ")
      .trim()
      .replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi, (m) => hexZuRgb(m))
      // Eine nackte `0` in einer Kurzschreibweise (Zielbild `0 32px`) serialisiert der Browser
      // als `0px` — dieselbe Laenge, eine Schreibweise.
      .replace(/(^|\s)0(?=\s|$)/g, "$10px")
      .toLowerCase()
  );
}
/** Sichtbarer Text des ersten Elements, dessen style-Attribut `anker` enthaelt (Zielbild-Wortlaute). */
function innentext(z: string, anker: string): string | null {
  const re = /<(?:div|a)(?: href="[^"]*")? style="([^"]*)">([^<]*)<\/(?:div|a)>/g;
  for (let m = re.exec(z); m !== null; m = re.exec(z)) {
    if ((m[1] ?? "").includes(anker)) {
      return (m[2] ?? "").replace(/\s+/g, " ").trim();
    }
  }
  return null;
}
/** Die Lupe des Zielbilds (Z.28): ihre Attribute, aus der Vorlage gelesen. */
function zielLupe(z: string): {
  viewBox: string | null;
  cx: string | null;
  cy: string | null;
  r: string | null;
  pfad: string | null;
} {
  const m = /<svg ([^>]*)><circle ([^>]*)><\/circle><path d="([^"]*)"><\/path><\/svg>/.exec(z);
  const attr = (rumpf: string | undefined, name: string): string | null =>
    rumpf === undefined
      ? null
      : (new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(rumpf)?.[1] ?? null);
  return {
    viewBox: attr(m?.[1], "viewBox"),
    cx: attr(m?.[2], "cx"),
    cy: attr(m?.[2], "cy"),
    r: attr(m?.[2], "r"),
    pfad: m?.[3] ?? null,
  };
}

// ---- Playwright, schmal typisiert (der Gate-tsc hat keine DOM-lib) --------------------------------
type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): { url(): string; method(): string; postData(): string | null };
  fulfill(r: {
    status: number;
    body?: string | Buffer;
    contentType?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  /** Ein ECHTER Klick (Maus in Chromium), kein `dispatchEvent`. */
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  url(): string;
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

// ---- Die Messpunkte, aus der Werte-Tabelle gelesen ----------------------------------------------
interface Messpunkt {
  name: string;
  selektor: string;
  eigenschaft: string;
}
// JOB 3056 K1 (Pedi 04.09., Pages-Massstab): die Fusszeile der Luecke (Zielbild Z.34/35,
// #ask-luecke-fuss, askGapFuss) steht NICHT mehr im Sichtfeld — der Satz lebt unter „Wie Klara
// antwortet" (#kw-hilfe, hinter dem Zahnrad) weiter, im selben Wortlaut (Fall T). Die Zeilen der
// Werte-Tabelle, die an #ask-luecke-fuss messen, haben in der Luecke kein Element mehr; sie werden
// hier BENANNT ausgelassen, nicht still (werte.ts ist nicht Zielpfad von JOB 3056).
const OHNE_ELEMENT_SEIT_3056 = "#ask-luecke-fuss";
const AUSGELASSEN = WERTE_FRAGEWEG_LUECKE.filter(
  (w) => w.messpunkt?.selektor === OHNE_ELEMENT_SEIT_3056,
);
const GEMESSEN = WERTE_FRAGEWEG_LUECKE.filter(
  (w) => w.messpunkt?.selektor !== OHNE_ELEMENT_SEIT_3056,
);
const MESSPUNKTE: Messpunkt[] = GEMESSEN.map((w) => ({
  name: w.name,
  selektor: w.messpunkt?.selektor ?? "",
  eigenschaft: w.messpunkt?.eigenschaft ?? "",
}));

/** In der Seite: CSS-Pfad eines Elements (nth-child-Kette bis body) — der Selektor als Beleg. */
const PFAD_FN = `(el) => {
  const teile = [];
  let e = el;
  while (e && e.nodeType === 1 && e !== document.body) {
    const p = e.parentElement;
    const i = Array.prototype.indexOf.call(p.children, e) + 1;
    teile.unshift(e.tagName.toLowerCase() + ':nth-child(' + i + ')');
    e = p;
  }
  return 'body > ' + teile.join(' > ');
}`;

/**
 * In der Seite: je Messpunkt das reale Element, sein rueckwaerts gepruefter Pfad und der wirksame
 * Wert. Bei `line-height` zusaetzlich das Verhaeltnis zur Schriftgroesse — eine reine Zahl des
 * Zielbilds (1.55) loest der Browser zu Pixeln auf, verglichen wird deshalb der Faktor.
 */
const MESSEN = `([punkte, pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  return punkte.map((p) => {
    const el = p.selektor ? document.querySelector(p.selektor) : null;
    if (!el) return { name: p.name, fehlt: true, treffer: 0, pfad: null, aufgeloest: false, wert: null, faktor: null };
    const weg = pfad(el);
    const cs = getComputedStyle(el);
    let faktor = null;
    if (p.eigenschaft === 'line-height') {
      const lh = parseFloat(cs.lineHeight);
      const fs = parseFloat(cs.fontSize);
      faktor = fs > 0 && lh > 0 ? lh / fs : null;
    }
    return {
      name: p.name,
      fehlt: false,
      treffer: document.querySelectorAll(p.selektor).length,
      pfad: weg,
      aufgeloest: document.querySelector(weg) === el,
      wert: cs.getPropertyValue(p.eigenschaft),
      faktor,
    };
  });
}`;

/** In der Seite: der Zustand, den ein Mensch sieht — Flaeche, Texte, Aktionen, Status, Fokus. */
const ZUSTAND = `() => {
  const sichtbar = (sel) => {
    let e = document.querySelector(sel);
    if (!e) return null;
    while (e && e !== document.body) {
      if (getComputedStyle(e).display === 'none') return false;
      e = e.parentElement;
    }
    return true;
  };
  const text = (sel) => { const e = document.querySelector(sel); return e ? (e.textContent || '').replace(/\\s+/g, ' ').trim() : null; };
  const name = (e) => e.id ? '#' + e.id : (e.getAttribute('data-t') || (e.tagName.toLowerCase() + '›' + (e.textContent || '').trim() + '‹'));
  const primaries = [...document.querySelectorAll('.primary')]
    .filter((e) => { let x = e; while (x && x !== document.body) { if (getComputedStyle(x).display === 'none') return false; x = x.parentElement; } return true; })
    .map(name);
  const flaeche = document.querySelector('#ask-luecke');
  const kinder = flaeche ? [...flaeche.children].map((k) => k.tagName.toLowerCase() + (k.id ? '#' + k.id : '')) : null;
  const svg = document.querySelector('#ask-luecke svg');
  const kreis = svg ? svg.querySelector('circle') : null;
  const pfadEl = svg ? svg.querySelector('path') : null;
  const link = document.querySelector('#ask-gap-send-btn');
  const eingabe = document.querySelector('#ask-input');
  const status = document.querySelector('#ask-status');
  return {
    blockSichtbar: sichtbar('#ask-gap-block'),
    flaecheSichtbar: sichtbar('#ask-luecke'),
    kinder,
    lupe: svg ? {
      viewBox: svg.getAttribute('viewBox'),
      cx: kreis ? kreis.getAttribute('cx') : null,
      cy: kreis ? kreis.getAttribute('cy') : null,
      r: kreis ? kreis.getAttribute('r') : null,
      pfad: pfadEl ? pfadEl.getAttribute('d') : null,
    } : null,
    satzText: text('#ask-luecke-satz'),
    knopfText: text('#ask-luecke-frage-aendern'),
    knopfTag: (document.querySelector('#ask-luecke-frage-aendern') || {}).tagName || null,
    linkText: text('#ask-gap-send-btn'),
    linkTag: link ? link.tagName.toLowerCase() : null,
    linkKlassen: link ? (link.getAttribute('class') || '') : null,
    linkHref: link ? link.getAttribute('href') : null,
    linkGesperrt: link ? link.getAttribute('aria-disabled') : null,
    fussText: text('#kw-hilfe [data-t="askGapFuss"]'),
    fussSichtbar: sichtbar('#kw-hilfe [data-t="askGapFuss"]'),
    fussImBlock: document.querySelectorAll('#ask-gap-block [data-t="askGapFuss"], #ask-luecke-fuss').length,
    warnkastenImBlock: document.querySelectorAll('#ask-gap-block .status').length,
    askGapBodyImBlock: document.querySelectorAll('#ask-gap-block [data-t="askGapBody"]').length,
    regelImBlock: document.querySelectorAll('#ask-gap-block [data-t="askRuleNote"]').length,
    regelUnterAntwort: sichtbar('#ask-rule-note'),
    regelText: text('#ask-rule-note'),
    statusSichtbar: sichtbar('#ask-status'),
    statusText: text('#ask-status'),
    statusKlassen: status ? (status.getAttribute('class') || '') : null,
    antwortSichtbar: sichtbar('#ask-answer-block'),
    openSichtbar: sichtbar('#ask-gap-open-block'),
    openHref: (document.querySelector('#ask-gap-open-link') || {}).href || null,
    primaries,
    eingabeWert: eingabe ? eingabe.value : null,
    eingabeFokus: !!eingabe && document.activeElement === eingabe,
    cursorAmEnde: !!eingabe && eingabe.selectionStart === eingabe.value.length && eingabe.selectionEnd === eingabe.value.length,
    seitenUrl: location.href,
  };
}`;

/**
 * Runde 2 (BEN): die GEOMETRIE der Buehne — Bounding-Rects, nicht nur berechnete Eigenschaften.
 * Gemessen im Lueckenzustand, nachdem das Panel die Frage-Karte an den oberen Fensterrand gerollt
 * hat. Dazu die AHNEN der Flaeche bis zum Panel: was zwischen #ask-luecke und body steht, mit
 * Hintergrund, Randbreiten, Schatten und Klassen.
 */
const GEOMETRIE = `() => {
  const r = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
  const karte = r('#ask-karte'), block = r('#ask-gap-block'), luecke = r('#ask-luecke');
  const feld = r('#ask-feld'), satz = r('#ask-luecke-satz');
  const l = document.querySelector('#ask-luecke');
  const lcs = l ? getComputedStyle(l) : null;
  const kinder = l ? [...l.children].map((k) => k.getBoundingClientRect()) : [];
  const erstes = kinder[0], letztes = kinder[kinder.length - 1];
  const ahnen = [];
  let e = l ? l.parentElement : null;
  while (e && e !== document.body) {
    const cs = getComputedStyle(e);
    ahnen.push({
      kennung: e.id || e.tagName.toLowerCase(),
      klassen: e.getAttribute('class') || '',
      hintergrund: cs.backgroundColor,
      randBreite: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join(' '),
      schatten: cs.boxShadow,
    });
    e = e.parentElement;
  }
  return {
    fensterHoehe: innerHeight,
    fensterBreite: innerWidth,
    polsterUnten: parseFloat(getComputedStyle(document.body).paddingBottom),
    karteOben: karte ? karte.top : null,
    karteUnten: karte ? karte.bottom : null,
    feldOben: feld ? feld.top : null,
    blockOben: block ? block.top : null,
    blockUnten: block ? block.bottom : null,
    blockLinks: block ? block.left : null,
    blockBreite: block ? block.width : null,
    lueckeOben: luecke ? luecke.top : null,
    lueckeUnten: luecke ? luecke.bottom : null,
    lueckeLinks: luecke ? luecke.left : null,
    lueckeRechts: luecke ? luecke.right : null,
    // Die INHALTSKANTEN der Flaeche (Rahmenkante plus Z.27-Polster) — dort beginnt der Inhalt.
    inhaltLinks: luecke && lcs ? luecke.left + parseFloat(lcs.paddingLeft) : null,
    inhaltRechts: luecke && lcs ? luecke.right - parseFloat(lcs.paddingRight) : null,
    lueckeHoehe: luecke ? luecke.height : null,
    inhaltOben: erstes ? erstes.top : null,
    inhaltUnten: letztes ? letztes.bottom : null,
    kinderMittenAbweichung: luecke ? kinder.map((k) => Math.abs((k.left + k.right) / 2 - (luecke.left + luecke.right) / 2)) : [],
    satzOben: satz ? satz.top : null,
    satzUnten: satz ? satz.bottom : null,
    scrollY: window.scrollY,
    ahnen,
  };
}`;

interface Ahne {
  kennung: string;
  klassen: string;
  hintergrund: string;
  randBreite: string;
  schatten: string;
}
interface Geometrie {
  fensterHoehe: number;
  fensterBreite: number;
  polsterUnten: number;
  karteOben: number | null;
  blockOben: number | null;
  blockUnten: number | null;
  blockLinks: number | null;
  blockBreite: number | null;
  lueckeOben: number | null;
  lueckeUnten: number | null;
  lueckeLinks: number | null;
  lueckeRechts: number | null;
  inhaltLinks: number | null;
  inhaltRechts: number | null;
  lueckeHoehe: number | null;
  inhaltOben: number | null;
  inhaltUnten: number | null;
  kinderMittenAbweichung: number[];
  karteUnten: number | null;
  feldOben: number | null;
  satzOben: number | null;
  satzUnten: number | null;
  scrollY: number;
  ahnen: Ahne[];
}
/** Runde 2: die Ueberlappung — Zustaende entlang des Wegs, je ein Bild. */
interface Ueberlappung {
  waehrendAlt: Zustand;
  nachAendern2: Zustand;
  vorRuecklauf: Zustand;
  nachRuecklauf: Zustand;
  nachNeu: Zustand;
  rumpfNeu: string | undefined;
  nachFehler: Zustand;
  fehlerSichtbar: Zustand;
  entwuerfe: number;
}

interface Messwert {
  name: string;
  fehlt: boolean;
  treffer: number;
  pfad: string | null;
  aufgeloest: boolean;
  wert: string | null;
  faktor: number | null;
}
interface Lupe {
  viewBox: string | null;
  cx: string | null;
  cy: string | null;
  r: string | null;
  pfad: string | null;
}
interface Zustand {
  blockSichtbar: boolean | null;
  flaecheSichtbar: boolean | null;
  kinder: string[] | null;
  lupe: Lupe | null;
  satzText: string | null;
  knopfText: string | null;
  knopfTag: string | null;
  linkText: string | null;
  linkTag: string | null;
  linkKlassen: string | null;
  linkHref: string | null;
  linkGesperrt: string | null;
  fussText: string | null;
  fussSichtbar: boolean | null;
  fussImBlock: number;
  warnkastenImBlock: number;
  askGapBodyImBlock: number;
  regelImBlock: number;
  regelUnterAntwort: boolean | null;
  regelText: string | null;
  statusSichtbar: boolean | null;
  statusText: string | null;
  statusKlassen: string | null;
  antwortSichtbar: boolean | null;
  openSichtbar: boolean | null;
  openHref: string | null;
  primaries: string[];
  eingabeWert: string | null;
  eingabeFokus: boolean;
  cursorAmEnde: boolean;
  seitenUrl: string;
}

/**
 * Der Office-Stummel in der Form der Panel-Fixture (onReady, CoercionType, AsyncResultStatus,
 * context.document.getSelectedDataAsync) — er antwortet sofort mit leerer Markierung, damit das
 * Panel den WORD-Weg geht und die Frage aus `#ask-input` nimmt. office.js selbst wird nicht
 * geladen (leere Antwort in der Route).
 */
const OFFICE_STUMMEL = `
  window.Office = {
    onReady: function (cb) { cb(); },
    CoercionType: { Html: "html", Text: "text" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    context: { document: { getSelectedDataAsync: function (typ, cb) {
      cb({ status: "succeeded", value: "" });
    } } }
  };`;

// ---- Der Lauf --------------------------------------------------------------------------------------
let browser: Browser | null = null;
let seite: Seite | null = null;
let fehler: string | null = null;
let version = "";
let askAbgegangen = 0;
let entwuerfeAbgegangen = 0;
let messwerte: Messwert[] = [];
/** Der Lueckenzustand nach der ersten Frage. */
let luecke: Zustand | null = null;
/** Nach dem echten Klick auf „Frage aendern“. */
let nachAendern: Zustand | null = null;
let askNachAendern = -1;
/** Nach dem echten Klick auf den Textlink „offene Frage“. */
let nachSenden: Zustand | null = null;
let entwuerfeNachIii = -1;
let entwurfRumpf: { statement?: string; origin?: string } | null = null;
/** Runde 2: die Geometrie der Buehne im ersten Lueckenzustand. */
let geometrie: Geometrie | null = null;
/** Runde 2: die Ueberlappungsfaelle (iv)/(v). */
let ueberlappung: Ueberlappung | null = null;
/**
 * Runde 2: der Entwurfsversand kann FESTGEHALTEN werden — der Route-Handler wartet dann auf
 * `entwurfFreigeben()`, wie ein langsamer Server — und antwortet mit `entwurfAntwort`.
 */
let entwurfHalten = false;
let entwurfFreigeben: () => void = () => undefined;
let entwurfAntwort: { status: number; body: unknown } = { status: 201, body: { id: ENTWURF_ID } };

const zielbildDa = existsSync(ZIELBILD);
const ziel = zielbildDa ? readFileSync(ZIELBILD, "utf8") : "";

function json(
  status: number,
  body: unknown,
): { status: number; body: string; contentType: string } {
  return { status, body: JSON.stringify(body), contentType: "application/json" };
}

async function warteBis(bedingung: () => boolean, fristMs: number, was: string): Promise<void> {
  const start = Date.now();
  while (!bedingung()) {
    if (Date.now() - start > fristMs) {
      throw new Error(`Frist abgelaufen: ${was}`);
    }
    await new Promise<void>((r) => setTimeout(r, 25));
  }
}

const BLOCK_SICHTBAR = `() => { let e = document.querySelector('#ask-gap-block'); if (!e) return false; while (e && e !== document.body) { if (getComputedStyle(e).display === 'none') return false; e = e.parentElement; } return true; }`;

describe.runIf(zielbildDa)(
  "JOB 3046 · D2 · KeinWissen — die Auskunftsflaeche am echten Panel in Chromium, ein Vergleich je Wert",
  () => {
    beforeAll(async () => {
      try {
        const panelHtml = readFileSync(PANEL_DATEI);
        const require = createRequire(import.meta.url);
        const { chromium } = require("playwright") as {
          chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
        };
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
        });
        version = browser.version();
        // Der Viewport des Zielbilds (KeinWissen.dc.html Z.15: 360 x 720).
        seite = await browser.newPage({ viewport: { width: 360, height: 720 } });
        await seite.route("**/*", async (route) => {
          const req = route.request();
          const url = new URL(req.url());
          if (url.origin !== ORIGIN) {
            await route.fulfill({ status: 200, body: "", contentType: "application/javascript" });
            return;
          }
          if (url.pathname === "/word-addin/taskpane.html") {
            await route.fulfill({
              status: 200,
              body: req.method() === "HEAD" ? "" : panelHtml,
              contentType: "text/html; charset=utf-8",
            });
            return;
          }
          if (url.pathname === "/api/ask" && req.method() === "POST") {
            askAbgegangen += 1;
            // Die echte Luecke: `answered: false`, keine Quellen — die Form der echten App ohne
            // Wissen (Panel-Fixture DEFAULT_ROUTES, JOB 3010 K0).
            await route.fulfill(
              json(200, { result: { answered: false, answer: null, sources: [] } }),
            );
            return;
          }
          if (url.pathname === "/api/drafts" && req.method() === "POST") {
            entwuerfeAbgegangen += 1;
            try {
              entwurfRumpf = JSON.parse(req.postData() ?? "{}") as typeof entwurfRumpf;
            } catch {
              entwurfRumpf = null;
            }
            if (entwurfHalten) {
              entwurfHalten = false;
              await new Promise<void>((r) => {
                entwurfFreigeben = r;
              });
            }
            await route.fulfill(json(entwurfAntwort.status, entwurfAntwort.body));
            return;
          }
          if (url.pathname === "/api/auth/me") {
            await route.fulfill(json(200, { name: "Pedi" }));
            return;
          }
          if (url.pathname === "/api/reasoner/status") {
            await route.fulfill(
              json(200, { active: false, mode: "deterministic", reachable: "ok", tasks: {} }),
            );
            return;
          }
          await route.fulfill(json(404, {}));
        });
        await seite.addInitScript(OFFICE_STUMMEL);
        await seite.goto(PANEL_URL, { waitUntil: "load", timeout: 60_000 });
        // Angemeldet und fragbereit: der Knopf ist frei, sobald /api/auth/me beantwortet ist.
        await seite.waitForFunction(
          fn(
            `() => { const b = document.querySelector('#ask-btn'); return !!b && b.disabled === false; }`,
          ),
          undefined,
          { timeout: 30_000 },
        );
        // Die Frage des Zielbilds eintippen und absenden — ueber den echten Knopf.
        await seite.evaluate(
          fn(`(frage) => {
            const i = document.querySelector('#ask-input');
            i.value = frage;
            i.dispatchEvent(new Event('input'));
            document.querySelector('#ask-btn').click();
          }`),
          FRAGE,
        );
        await warteBis(() => askAbgegangen === 1, 10_000, "POST /api/ask ist nicht abgegangen");
        await seite.waitForFunction(fn(BLOCK_SICHTBAR), undefined, { timeout: 10_000 });
        // Jetzt steht das Fenster in der Luecke. Alles Weitere wird in EINEM Zug gemessen.
        luecke = await seite.evaluate<Zustand>(fn(ZUSTAND));
        messwerte = await seite.evaluate<Messwert[]>(fn(MESSEN), [MESSPUNKTE, PFAD_FN]);
        geometrie = await seite.evaluate<Geometrie>(fn(GEOMETRIE));
        console.info(
          `JOB 3046 D2 · Chromium ${version} · ${PANEL_URL} · Viewport 360x720 · Ask abgegangen ${askAbgegangen} · Luecke sichtbar ${luecke.blockSichtbar}`,
        );
        {
          const g = geometrie;
          const f = (n: number | null): string => (n === null ? "—" : n.toFixed(1));
          console.info(
            `JOB 3046 D2 · G · scrollY ${f(g.scrollY)} · Karte oben ${f(g.karteOben)} · Block ${f(g.blockOben)}–${f(g.blockUnten)} (Fenster ${g.fensterHoehe}, Polster unten ${f(g.polsterUnten)}) · Flaeche ${f(g.lueckeOben)}–${f(g.lueckeUnten)} h=${f(g.lueckeHoehe)} x ${f(g.lueckeLinks)}–${f(g.lueckeRechts)} · Inhalt ${f(g.inhaltOben)}–${f(g.inhaltUnten)} · frei oben ${f((g.inhaltOben ?? 0) - (g.lueckeOben ?? 0))} unten ${f((g.lueckeUnten ?? 0) - (g.inhaltUnten ?? 0))} · Feld oben ${f(g.feldOben)} · Karte unten ${f(g.karteUnten)} · Ahnen ${g.ahnen.map((a) => `${a.kennung}[${a.hintergrund}|${a.randBreite}|${a.schatten}]`).join(" > ")}`,
          );
        }

        // ---- (ii) „Frage aendern“: ein ECHTER Klick. ------------------------------------------
        const askVorAendern = askAbgegangen;
        await seite.click("#ask-luecke-frage-aendern", { timeout: 5_000 });
        await new Promise<void>((r) => setTimeout(r, 200));
        nachAendern = await seite.evaluate<Zustand>(fn(ZUSTAND));
        askNachAendern = askAbgegangen - askVorAendern;
        console.info(
          `JOB 3046 D2 · (ii) nach „Frage aendern“: Block sichtbar ${nachAendern.blockSichtbar} · Fokus im Feld ${nachAendern.eingabeFokus} · Cursor am Ende ${nachAendern.cursorAmEnde} · Wert „${nachAendern.eingabeWert}“ · Status sichtbar ${nachAendern.statusSichtbar} · POST /api/ask ${askNachAendern}`,
        );

        // ---- (iii) erneut fragen (zurueck in die Luecke), dann der Textlink „offene Frage“. ---
        await seite.evaluate(fn(`() => { document.querySelector('#ask-btn').click(); }`));
        await warteBis(
          () => askAbgegangen === 2,
          10_000,
          "zweiter POST /api/ask ist nicht abgegangen",
        );
        await seite.waitForFunction(fn(BLOCK_SICHTBAR), undefined, { timeout: 10_000 });
        await seite.click("#ask-gap-send-btn", { timeout: 5_000 });
        await warteBis(
          () => entwuerfeAbgegangen === 1,
          10_000,
          "der Textlink hat keinen POST /api/drafts ausgeloest",
        );
        await seite.waitForFunction(
          fn(
            `() => { let e = document.querySelector('#ask-gap-open-block'); if (!e) return false; while (e && e !== document.body) { if (getComputedStyle(e).display === 'none') return false; e = e.parentElement; } return true; }`,
          ),
          undefined,
          { timeout: 10_000 },
        );
        nachSenden = await seite.evaluate<Zustand>(fn(ZUSTAND));
        entwuerfeNachIii = entwuerfeAbgegangen;
        if (entwurfRumpf?.statement !== FRAGE) {
          throw new Error(`(iii): der Entwurf traegt nicht die Frage: ${entwurfRumpf?.statement}`);
        }
        console.info(
          `JOB 3046 D2 · (iii) nach dem Textlink: POST /api/drafts ${entwuerfeAbgegangen} · Status „${nachSenden.statusText}“ (${nachSenden.statusKlassen}) · Entwurfs-Link sichtbar ${nachSenden.openSichtbar} → ${nachSenden.openHref} · URL ${nachSenden.seitenUrl}`,
        );

        // ---- (iv) UEBERLAPPUNG (Runde 2, BEN): Senden → vor dem Ruecklauf „Frage aendern“ → andere
        //      Frage → der ALTE Ruecklauf kommt. Er darf die neue Luecke nicht veraendern. -----------
        const s = seite;
        const zustand = (): Promise<Zustand> => s.evaluate<Zustand>(fn(ZUSTAND));
        const frageStellen = async (frage: string, erwartet: number): Promise<void> => {
          await s.evaluate(
            fn(`(frage) => {
              const i = document.querySelector('#ask-input');
              i.value = frage;
              i.dispatchEvent(new Event('input'));
              document.querySelector('#ask-btn').click();
            }`),
            frage,
          );
          await warteBis(() => askAbgegangen === erwartet, 10_000, `POST /api/ask Nr. ${erwartet}`);
          await s.waitForFunction(fn(BLOCK_SICHTBAR), undefined, { timeout: 10_000 });
        };
        const pause = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));
        await s.click("#ask-luecke-frage-aendern", { timeout: 5_000 });
        await frageStellen(FRAGE_A, 3);
        entwurfHalten = true;
        entwurfAntwort = { status: 201, body: { id: "draft-alt" } };
        await s.click("#ask-gap-send-btn", { timeout: 5_000 });
        await warteBis(
          () => entwuerfeAbgegangen === 2,
          10_000,
          "der alte Versand ist nicht abgegangen",
        );
        await pause(100);
        const waehrendAlt = await zustand(); // gesperrt, sendBusy — der Versand haengt.
        await s.click("#ask-luecke-frage-aendern", { timeout: 5_000 });
        await pause(100);
        const nachAendern2 = await zustand(); // Flaeche zu, Sperre geloest.
        await frageStellen(FRAGE_B, 4);
        const vorRuecklauf = await zustand(); // die NEUE Luecke, unberuehrt.
        entwurfFreigeben(); // jetzt kommt der alte Erfolg (draft-alt).
        await pause(400);
        const nachRuecklauf = await zustand(); // muss gleich bleiben.
        entwurfAntwort = { status: 201, body: { id: "draft-neu" } };
        await s.click("#ask-gap-send-btn", { timeout: 5_000 });
        await warteBis(
          () => entwuerfeAbgegangen === 3,
          10_000,
          "der neue Versand ist nicht abgegangen",
        );
        await s.waitForFunction(
          fn(
            `() => { let e = document.querySelector('#ask-gap-open-block'); if (!e) return false; while (e && e !== document.body) { if (getComputedStyle(e).display === 'none') return false; e = e.parentElement; } return true; }`,
          ),
          undefined,
          { timeout: 10_000 },
        );
        const nachNeu = await zustand();
        const rumpfNeu = entwurfRumpf?.statement;
        console.info(
          `JOB 3046 D2 · (iv) Ueberlappung: waehrend alt gesperrt=${waehrendAlt.linkGesperrt} Status „${waehrendAlt.statusText}“ · nach „Frage aendern“ Block ${nachAendern2.blockSichtbar} gesperrt=${nachAendern2.linkGesperrt} · neue Luecke vor Ruecklauf: Status sichtbar ${vorRuecklauf.statusSichtbar}, Entwurfs-Link ${vorRuecklauf.openSichtbar}, gesperrt=${vorRuecklauf.linkGesperrt} · nach altem Erfolg: Status sichtbar ${nachRuecklauf.statusSichtbar} „${nachRuecklauf.statusText}“, Entwurfs-Link ${nachRuecklauf.openSichtbar} (${nachRuecklauf.openHref}), gesperrt=${nachRuecklauf.linkGesperrt} · neuer Versand: „${nachNeu.statusText}“ → ${nachNeu.openHref}, Rumpf „${rumpfNeu}“`,
        );
        // ---- (v) dieselbe Ueberlappung mit einem FEHLER-Ruecklauf (500) der alten Frage. ----------
        await s.click("#ask-luecke-frage-aendern", { timeout: 5_000 });
        await frageStellen(FRAGE_C, 5);
        entwurfHalten = true;
        entwurfAntwort = { status: 500, body: {} };
        await s.click("#ask-gap-send-btn", { timeout: 5_000 });
        await warteBis(
          () => entwuerfeAbgegangen === 4,
          10_000,
          "der alte Fehlversand ist nicht abgegangen",
        );
        await pause(100);
        await s.click("#ask-luecke-frage-aendern", { timeout: 5_000 });
        await frageStellen(FRAGE_D, 6);
        entwurfFreigeben(); // jetzt kommt der alte Fehler.
        await pause(400);
        const nachFehler = await zustand();
        // Kalibrierung: derselbe Fehler OHNE Wechsel erscheint ehrlich als sendError.
        entwurfAntwort = { status: 500, body: {} };
        await s.click("#ask-gap-send-btn", { timeout: 5_000 });
        await warteBis(
          () => entwuerfeAbgegangen === 5,
          10_000,
          "der Kalibrier-Versand ist nicht abgegangen",
        );
        // Fertig ist der Fehlversand, wenn die Sperre wieder geloest ist (sendBusy ist selbst ein
        // warn-Status — auf ihn zu warten waere ein stiller Null-Treffer).
        await s.waitForFunction(
          fn(
            `() => { const l = document.querySelector('#ask-gap-send-btn'); const e = document.querySelector('#ask-status'); return !!l && l.getAttribute('aria-disabled') === null && !!e && getComputedStyle(e).display !== 'none'; }`,
          ),
          undefined,
          { timeout: 10_000 },
        );
        const fehlerSichtbar = await zustand();
        ueberlappung = {
          waehrendAlt,
          nachAendern2,
          vorRuecklauf,
          nachRuecklauf,
          nachNeu,
          rumpfNeu,
          nachFehler,
          fehlerSichtbar,
          entwuerfe: entwuerfeAbgegangen,
        };
        console.info(
          `JOB 3046 D2 · (v) alter Fehler-Ruecklauf: Status sichtbar ${nachFehler.statusSichtbar}, gesperrt=${nachFehler.linkGesperrt}, Luecke ${nachFehler.blockSichtbar} · Kalibrierung ohne Wechsel: „${fehlerSichtbar.statusText}“ (${fehlerSichtbar.statusKlassen}), gesperrt=${fehlerSichtbar.linkGesperrt} · POST /api/drafts gesamt ${entwuerfeAbgegangen}`,
        );
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 3).join(" | ");
      }
    }, 120_000);

    afterAll(async () => {
      await browser?.close();
    }, 60_000);

    it("S · die Strecke steht: Chromium laeuft, das Panel ist geladen, POST /api/ask ging ab und die Luecke ist der Zustand — kein stiller Null-Treffer", () => {
      expect(fehler).toBeNull();
      expect(version).not.toBe("");
      expect(askAbgegangen).toBeGreaterThanOrEqual(1);
      const l = luecke as Zustand;
      expect(l, "Lueckenzustand nicht erreicht").not.toBeNull();
      expect(l.blockSichtbar, "#ask-gap-block fehlt oder ist verborgen").toBe(true);
      expect(l.antwortSichtbar).toBe(false);
      expect(l.statusSichtbar, "#ask-status muss in der Luecke verborgen sein").toBe(false);
      expect(l.eingabeWert).toBe(FRAGE);
    });

    it("F · die Flaeche ist die Auskunft des Zielbilds: #ask-luecke sichtbar, KEIN Warnkasten, KEIN askGapBody, KEINE Zweitkopie der Regel im Block; die Regel steht hinter dem Zahnrad (JOB 3056), nicht im Sichtfeld", () => {
      expect(fehler).toBeNull();
      const l = luecke as Zustand;
      expect(l.flaecheSichtbar, "#ask-luecke fehlt oder ist verborgen").toBe(true);
      expect(l.warnkastenImBlock, "ein .status-Kasten im Lueckenblock").toBe(0);
      expect(l.askGapBodyImBlock, "askGapBody steht noch im Block").toBe(0);
      expect(l.regelImBlock, "die Zweitkopie von askRuleNote steht noch im Block").toBe(0);
      // JOB 3056 K1 (Pedi 04.09., Pages-Massstab): die EINE Stelle der Regel (#ask-rule-note) liegt
      // unter „Wie Klara antwortet" hinter dem Zahnrad — in der Luecke steht KEIN Erklaertext.
      // Der Wortlaut bleibt unveraendert (Leitsatz vor den belegten Halbsaetzen, mega75/mega77).
      expect(l.regelUnterAntwort, "#ask-rule-note steht im Sichtfeld der Luecke").toBe(false);
      expect(l.regelText ?? "").toContain("Keine KI-Antwort ohne Beleg");
      expect(l.regelText ?? "").toContain("nicht an eine externe KI");
    });

    it("O · Reihenfolge und Lupe (Z.28-31): Lupe, Satz, Hauptaktion, Textlink — Auskunft vor Aktion; die Lupe traegt Kreis und Griff des Zielbilds", () => {
      expect(fehler).toBeNull();
      const l = luecke as Zustand;
      expect(l.kinder).toEqual([
        "svg",
        "div#ask-luecke-satz",
        "button#ask-luecke-frage-aendern",
        "a#ask-gap-send-btn",
      ]);
      const soll = zielLupe(ziel);
      expect(soll.pfad, "Lupe im Zielbild nicht lesbar").not.toBeNull();
      expect(l.lupe, "keine Lupe in #ask-luecke").not.toBeNull();
      expect(l.lupe).toEqual(soll);
    });

    it("T · die Wortlaute sind die des Zielbilds: Satz (Z.29), „Frage aendern“ (Z.30), Textlink (Z.31), Fusszeile (Z.35) — gemessen am gerenderten Text", () => {
      expect(fehler).toBeNull();
      const l = luecke as Zustand;
      const satz = innentext(ziel, "font-size: 16px; line-height: 1.55");
      const knopf = innentext(ziel, "padding: 10px 22px");
      const link = innentext(ziel, "font-size: 12px");
      const fuss = innentext(ziel, "font-size: 11px; color: #525B6B");
      for (const [was, wert] of Object.entries({ satz, knopf, link, fuss })) {
        expect(wert, `Zielbild-Wortlaut ›${was}‹ nicht lesbar`).not.toBeNull();
      }
      expect(l.satzText).toBe(satz);
      expect(l.knopfText).toBe(knopf);
      expect(l.knopfTag).toBe("BUTTON");
      expect(l.linkText).toBe(link);
      // JOB 3056 K1: der Fusszeilensatz (Z.35, askGapFuss) steht im selben Wortlaut unter „Wie
      // Klara antwortet" (#kw-hilfe) — hinter dem Zahnrad, nicht in der Luecke.
      expect(l.fussText).toBe(fuss);
      expect(l.fussSichtbar, "askGapFuss ist in der Luecke sichtbar").toBe(false);
      expect(l.fussImBlock, "eine Fusszeile steht noch im Lueckenblock").toBe(0);
    });

    it("(i) · im Lueckenzustand ist panelweit genau EIN primary sichtbar — der Frage-Knopf; der Textlink ist ein <a> ohne primary", () => {
      expect(fehler).toBeNull();
      const l = luecke as Zustand;
      expect(l.primaries).toEqual(["#ask-btn"]);
      expect(l.linkTag).toBe("a");
      expect((l.linkKlassen ?? "").split(/\s+/)).not.toContain("primary");
    });

    it("(ii) · „Frage aendern“ per echtem Klick: Flaeche zu, Fokus in #ask-input, Cursor am Ende, Text unveraendert, kein Reststatus, kein Serveraufruf", () => {
      expect(fehler).toBeNull();
      const n = nachAendern as Zustand;
      expect(n, "Klick nicht ausgefuehrt").not.toBeNull();
      expect(n.blockSichtbar).toBe(false);
      expect(n.eingabeFokus, "document.activeElement ist nicht #ask-input").toBe(true);
      expect(n.cursorAmEnde).toBe(true);
      expect(n.eingabeWert).toBe(FRAGE);
      expect(n.statusSichtbar).toBe(false);
      expect(n.antwortSichtbar).toBe(false);
      expect(askNachAendern).toBe(0);
    });

    it("(iii) · der Textlink „offene Frage“ loest denselben Sendeweg aus: POST /api/drafts mit der Frage, askGapSentOk im Status, #ask-gap-open-block sichtbar mit Entwurfs-Link — und die Seite navigiert nicht", () => {
      expect(fehler).toBeNull();
      const n = nachSenden as Zustand;
      expect(n, "Sendeweg nicht erreicht").not.toBeNull();
      expect(entwuerfeNachIii).toBe(1);
      expect(entwurfRumpf?.origin).toBe("word_addin");
      expect(n.statusSichtbar).toBe(true);
      expect(n.statusKlassen).toBe("status ok");
      expect(n.statusText ?? "").toMatch(/^Offene Frage gesendet: /);
      expect(n.openSichtbar).toBe(true);
      expect(n.openHref).toBe(`${ORIGIN}/capture/frontdoor?draft=${ENTWURF_ID}`);
      expect(n.blockSichtbar).toBe(true);
      expect(n.seitenUrl, "der Link hat navigiert (href='#')").toBe(PANEL_URL);
    });

    it("G · GEOMETRIE 360x720 (JOB 3056): Lueckenblock zwischen Kopf und Frage-Feld, das Feld unten am Fensterrand; die Flaeche traegt freien Raum ueber UND unter dem Inhalt, gleich gross; Kinder mittig; der Satz ist im Bild", () => {
      expect(fehler).toBeNull();
      const g = geometrie as Geometrie;
      expect(g, "keine Geometrie").not.toBeNull();
      expect(g.fensterBreite).toBe(360);
      expect(g.fensterHoehe).toBe(720);
      // JOB 3056 K1 (Ruhe.dc.html Z.33): das Frage-Feld steht UNTEN — die Karte schliesst 16px ueber
      // dem Fensterrand ab; die Frage bleibt darin stehen (askFrageAendern setzt den Cursor).
      expect(Math.abs((g.karteUnten ?? 0) - (g.fensterHoehe - 16))).toBeLessThan(1);
      // Der Block ist die Buehne: er nimmt den Raum bis zum Frage-Feld ein, ueber die volle Breite.
      expect(Math.abs((g.blockUnten ?? 0) - (g.feldOben ?? 999))).toBeLessThan(1);
      expect(Math.abs(g.blockLinks ?? 999)).toBeLessThan(1);
      expect(Math.abs((g.blockBreite ?? 0) - 360)).toBeLessThan(1);
      // Die Flaeche spannt die volle Fensterbreite; Z.27 `padding: 0 32px` — der Inhalt beginnt
      // 32px von der Fensterkante, wie in der Vorlage.
      expect(Math.abs(g.lueckeLinks ?? 999)).toBeLessThan(1);
      expect(Math.abs((g.lueckeRechts ?? 0) - 360)).toBeLessThan(1);
      expect(Math.abs((g.inhaltLinks ?? 0) - 32)).toBeLessThan(1);
      expect(Math.abs((g.inhaltRechts ?? 0) - 328)).toBeLessThan(1);
      // `flex-grow: 1` hat einen flexiblen Elternraum: die Flaeche ist hoeher als ihr Inhalt, und
      // `justify-content: center` wirkt — gleich viel freier Raum oben wie unten.
      const freiOben = (g.inhaltOben ?? 0) - (g.lueckeOben ?? 0);
      const freiUnten = (g.lueckeUnten ?? 0) - (g.inhaltUnten ?? 0);
      expect(freiOben, "kein freier Raum ueber dem Inhalt").toBeGreaterThan(0);
      expect(freiUnten, "kein freier Raum unter dem Inhalt").toBeGreaterThan(0);
      expect(Math.abs(freiOben - freiUnten), "Inhalt nicht mittig").toBeLessThan(1.5);
      // `align-items: center`: jedes Kind steht mittig auf der Querachse.
      expect(g.kinderMittenAbweichung.length).toBe(4);
      for (const a of g.kinderMittenAbweichung) {
        expect(a).toBeLessThan(1);
      }
      // Der Satz (Z.29) ist im Fenster sichtbar. (Die Fusszeile Z.34 steht seit JOB 3056 hinter
      // dem Zahnrad — Fall T.)
      expect(g.satzOben ?? -1).toBeGreaterThanOrEqual(0);
      expect(g.satzUnten ?? 999).toBeLessThanOrEqual(g.fensterHoehe);
    });

    it("K · KEIN KASTEN (Runde 2): die Ahnen von #ask-luecke bis zum Panel sind genau #ask-gap-block und #section-ask — ohne Hintergrund, Rand, Schatten, ohne Kartenklasse", () => {
      expect(fehler).toBeNull();
      const g = geometrie as Geometrie;
      expect(g.ahnen.map((a) => a.kennung)).toEqual(["ask-gap-block", "section-ask"]);
      for (const a of g.ahnen) {
        expect(a.hintergrund, `${a.kennung}: Hintergrund`).toBe("rgba(0, 0, 0, 0)");
        expect(a.randBreite, `${a.kennung}: Rand`).toBe("0px 0px 0px 0px");
        expect(a.schatten, `${a.kennung}: Schatten`).toBe("none");
        expect(a.klassen.split(/\s+/), `${a.kennung}: Kartenklasse`).not.toContain("card");
      }
    });

    it("(iv) · UEBERLAPPUNG (Runde 2): Senden → vor dem Ruecklauf „Frage aendern“ → andere Frage → der alte ERFOLG kommt: die neue Luecke bleibt unberuehrt (kein Status, kein Entwurfs-Link, Textlink frei); der neue Versand traegt die neue Frage", () => {
      expect(fehler).toBeNull();
      const u = ueberlappung as Ueberlappung;
      expect(u, "Ueberlappung nicht erreicht").not.toBeNull();
      // Waehrend der alte Versand haengt: Textlink gesperrt, Status „wird gesendet“.
      expect(u.waehrendAlt.linkGesperrt).toBe("true");
      expect(u.waehrendAlt.statusSichtbar).toBe(true);
      // „Frage aendern“ loest die Sperre — nicht erst ein Ruecklauf, der vielleicht nie kommt.
      expect(u.nachAendern2.blockSichtbar).toBe(false);
      expect(u.nachAendern2.linkGesperrt).toBeNull();
      expect(u.nachAendern2.statusSichtbar).toBe(false);
      // Die neue Luecke (Linie 9): frei bedienbar, ohne Reste.
      expect(u.vorRuecklauf.blockSichtbar).toBe(true);
      expect(u.vorRuecklauf.eingabeWert).toBe(FRAGE_B);
      expect(u.vorRuecklauf.linkGesperrt).toBeNull();
      expect(u.vorRuecklauf.statusSichtbar).toBe(false);
      expect(u.vorRuecklauf.openSichtbar).toBe(false);
      // Der alte Erfolg (draft-alt) kommt — und veraendert NICHTS an der neuen Luecke.
      expect(u.nachRuecklauf.statusSichtbar).toBe(false);
      expect(u.nachRuecklauf.openSichtbar).toBe(false);
      expect(u.nachRuecklauf.linkGesperrt).toBeNull();
      expect(u.nachRuecklauf.openHref ?? "").not.toContain("draft-alt");
      expect(u.nachRuecklauf.blockSichtbar).toBe(true);
      // Der neue Versand gehoert der neuen Frage.
      expect(u.rumpfNeu).toBe(FRAGE_B);
      expect(u.nachNeu.statusKlassen).toBe("status ok");
      expect(u.nachNeu.statusText ?? "").toContain(FRAGE_B);
      expect(u.nachNeu.openHref).toBe(`${ORIGIN}/capture/frontdoor?draft=draft-neu`);
      expect(u.nachNeu.linkGesperrt).toBeNull();
    });

    it("(v) · UEBERLAPPUNG mit FEHLER-Ruecklauf: der verspaetete Fehler der alten Frage zeigt in der neuen Luecke keine Warnung und sperrt nichts — waehrend derselbe Fehler OHNE Wechsel ehrlich als sendError erscheint (Kalibrierung)", () => {
      expect(fehler).toBeNull();
      const u = ueberlappung as Ueberlappung;
      expect(u.nachFehler.blockSichtbar).toBe(true);
      expect(u.nachFehler.eingabeWert).toBe(FRAGE_D);
      expect(u.nachFehler.statusSichtbar).toBe(false);
      expect(u.nachFehler.linkGesperrt).toBeNull();
      expect(u.nachFehler.openSichtbar).toBe(false);
      // Kalibrierung: ohne Wechsel ist der Fehler sichtbar — die Sperre ist keine Stummschaltung.
      expect(u.fehlerSichtbar.statusKlassen).toBe("status warn");
      expect(u.fehlerSichtbar.statusText ?? "").toMatch(/^Senden fehlgeschlagen \(HTTP 500\)/);
      expect(u.fehlerSichtbar.linkGesperrt).toBeNull();
      expect(u.entwuerfe).toBe(5);
    });

    it("M · jede Zeile der Werte-Tabelle traegt einen Messpunkt, und jeder Messpunkt trifft genau ein reales Element mit rueckwaerts aufloesbarem Pfad", () => {
      expect(fehler).toBeNull();
      // JOB 3056: die sechs Fusszeilen-Zeilen sind benannt ausgelassen (Fall X) — es bleiben 27.
      expect(MESSPUNKTE.length).toBe(GEMESSEN.length);
      expect(MESSPUNKTE.length).toBeGreaterThanOrEqual(27);
      for (const p of MESSPUNKTE) {
        expect(p.selektor, `${p.name}: Zeile ohne Messpunkt (Selektor)`).not.toBe("");
        expect(p.eigenschaft, `${p.name}: Zeile ohne Messpunkt (Eigenschaft)`).not.toBe("");
      }
      expect(messwerte.length).toBe(MESSPUNKTE.length);
      for (const m of messwerte) {
        expect(m.fehlt, `${m.name}: kein reales Element`).toBe(false);
        expect(m.treffer, `${m.name}: Selektor trifft nicht genau ein Element`).toBe(1);
        expect(m.aufgeloest, `${m.name}: Pfad loest nicht auf dasselbe Element auf`).toBe(true);
        expect(m.pfad).toMatch(/^body > /);
      }
    });

    it("X · die Fusszeilen-Zeilen der Werte-Tabelle (Z.34/35) sind BENANNT ausgelassen: seit JOB 3056 gibt es #ask-luecke-fuss nicht mehr, der Satz steht hinter dem Zahnrad (Fall T)", () => {
      expect(fehler).toBeNull();
      expect(AUSGELASSEN.length).toBeGreaterThan(0);
      expect(AUSGELASSEN.length + GEMESSEN.length).toBe(WERTE_FRAGEWEG_LUECKE.length);
      for (const w of AUSGELASSEN) {
        console.info(
          `JOB 3056 K1 · AUSGELASSEN · ${w.name} — ${w.messpunkt?.selektor} existiert seit JOB 3056 nicht mehr`,
        );
      }
    });

    // ---- ein Vergleich je Wert, an den realen Elementen ------------------------------------------
    for (const w of GEMESSEN) {
      it(`V · ${w.name} — ${w.messpunkt?.eigenschaft ?? "?"} an ${w.messpunkt?.selektor ?? "?"}`, () => {
        expect(fehler).toBeNull();
        const soll = kanon(w.ziel(ziel));
        expect(soll, "Sollwert im Zielbild nicht lesbar").not.toBeNull();
        const m = messwerte.find((x) => x.name === w.name);
        expect(m, "kein Messwert").toBeDefined();
        const mess = m as Messwert;
        expect(mess.fehlt, "kein reales Element").toBe(false);
        const quelle = `Zielbild ${w.messpunkt?.eigenschaft} · ${w.name}`;
        if (w.messpunkt?.eigenschaft === "line-height" && /^[0-9.]+$/.test(soll as string)) {
          // Eine reine Zahl loest sich im Browser zu Pixeln auf — verglichen wird der Faktor zur
          // Schriftgroesse (Toleranz ein Hundertstel fuer Subpixel).
          const sollFaktor = Number.parseFloat(soll as string);
          expect(mess.faktor, "kein Faktor messbar").not.toBeNull();
          const ist = mess.faktor as number;
          console.info(
            `JOB 3046 D2 · ${w.name} · ${w.messpunkt?.selektor} → ${mess.pfad} · soll ${soll} · ist ${ist.toFixed(3)} (${mess.wert}) · ${quelle}`,
          );
          expect(Math.abs(ist - sollFaktor)).toBeLessThan(0.01);
          return;
        }
        const ist = kanon(mess.wert);
        console.info(
          `JOB 3046 D2 · ${w.name} · ${w.messpunkt?.selektor} → ${mess.pfad} · soll ${soll} · ist ${ist} · ${quelle}`,
        );
        expect(ist).toBe(soll);
      });
    }
  },
);

describe.runIf(!zielbildDa)("JOB 3046 · D2 · KeinWissen-Vergleich uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Messung vorzutaeuschen", () => {
    expect(zielbildDa, `Zielbild nicht lesbar: ${ZIELBILD} — Abgleich hier nicht messbar.`).toBe(
      false,
    );
  });
});
