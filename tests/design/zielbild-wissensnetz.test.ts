// ================================================================================================
// JOB 3052 · D6 „Wissensnetz" — AUS DEM RING MIT BESCHRIFTUNG DARUNTER WIRD DAS NETZ DES ZIELBILDS
// MIT SEITENLEISTE, gemessen an der in Chromium GEMOUNTETEN echten Anwendung, ein Vergleich je Wert.
// ================================================================================================
//
// PEDIS FRAGE: „Sieht das Wissensnetz jetzt so aus, wie ich es gezeichnet habe — Knoten mit dem
// Namen im Kreis, Kanten, Legenden-Karte, und rechts die Leiste, die sagt, was zu einem Thema
// gehoert? Gemessen an der echten Seite, nicht an einem Nachbau."
//
// WIE DIE ECHTE SEITE HIER LAEUFT (Muster: tests/design/zielbild-h5-start.test.ts, JOB 3015 D5):
//   NACHGEZOGEN, JOB 3064: bis dahin stand hier der abgeloeste `zielbild-konsole-start.test.ts`. Er
//   ist mit dem Konsole-Zielbild ABGELOEST und geloescht (JOB 3064 Lieferung 7, das Zielbild
//   `design/klarwerk/Main.dc.html` hat es ersetzt); der Verweis zeigte danach ins Leere und
//   `tests/structure/testverweise-aufloesbar.test.ts` hat ihn gefangen. Der Name steht hier deshalb
//   OHNE Pfadform — ein toter Pfad im Kommentar behauptet eine Deckung, die es nicht gibt. Das
//   MESSMUSTER, um das es geht, ist unveraendert in den Nachfolger uebergegangen: Mount der echten
//   Anwendung in Chromium, Sollwerte aus dem Zielbild, ein Vergleich je Wert, Selektor rueckwaerts
//   aufloesbar.
//   · Die ECHTE Anwendung (`apps/web/dist`, das Ergebnis von `./tools/build`) wird in Chromium unter
//     `http://klarwerk.test/wissensnetz` geladen; Playwright bedient `/assets/*` aus `dist` und reicht
//     JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App (`buildApp`, echte Dienste, echter Bestand)
//     weiter — mit dem Bearer der echten Anmeldung. React mountet `Wissensnetz.tsx` selbst.
//   · DER BESTAND entsteht ueber die echte App: acht Wissensobjekte mit Schlagwoertern, jedes ueber
//     den authentifizierten oeffentlichen Erstellungsendpunkt `POST /api/kos` (Runde 2, BEN — ein
//     Zaehler belegt acht 201-Antworten, Fall K), so gesetzt, dass alle drei Knotenfarben vorkommen,
//     das groesste Thema vier Traeger hat (unter der Ubiquitaetsschwelle, `UBIQUITY_MIN_COUNT` 5),
//     genau ein freigegebenes Objekt zwei Themen teilt — eine Kante — und ein Thema einen langen
//     Namen ohne Trennstelle traegt. Freigabe entsteht wie in themenkarte-kette-mounted.test.tsx
//     ueber `neededValidations: 1` plus `rate`. NUR die Quellen (fuer „belegt") reicht danach der
//     Dienst nach (`services.ko.addSource`) — die oeffentliche Route verwirft Client-`sources`
//     (SCRUM-470), und einen oeffentlichen Quellen-Endpunkt gibt es nicht.
//   · Das THEME ist ausdruecklich `modern` (`localStorage["kw.designTheme"]`); das Zielbild ist die
//     Werkbank-Palette. Das Fenster ist exakt 1280×800 (canvas.json Z.9; Lehre JOB 3015).
//   · Gemessen wird per `getComputedStyle` bzw. Attribut an den REALEN Elementen, je Zeile der
//     Wertetabelle `WERTE_WISSENSNETZ` (tools/design-vergleich/werte.ts) an ihrem Messpunkt. Der
//     Beleg ist der SELEKTOR: je Messpunkt wird ein CSS-Pfad erzeugt und rueckwaerts aufgeloest.
//   · ZUSAETZLICH laeuft `vergleiche()` statisch ueber das gerenderte Dokument (Inline-Stile und
//     SVG-Attribute, Tokens ueber styles/themes.css aufgeloest) — dieselbe Tabelle, zweiter Leseweg.
//
// SOLLWERTE: aus dem Zielbild gelesen (Anker in werte.ts), nicht abgeschrieben. Ein FEHLENDES
// Zielbild ist rot (Lehre JOB 3015 R4), ein leerer Knotenbestand ist rot (Kalibrierung, Fall v).
//
// VERHALTEN (Auftrag §5 Lieferung 8): (i) Vorgabe-Auswahl = groesstes Thema, Leiste gefuellt;
// (ii) Klick auf einen anderen Knoten wechselt Auswahl, Farbe und Leiste — auch per Tastatur (Enter);
// (iii) der Link fuehrt nach `/bibliothek?tag=…`; (iv) Leiste bei Thema ohne sichtbare Objekte zeigt
// den Leersatz — dazu Ladefall (Platzhalter) und Fehlerfall (Fehlersatz), je ueber die Routenweiche;
// (v) Kalibrierung gegen den stillen Null-Treffer. Dazu die RAUMWIRKUNG (Lehre JOB 3046 R1): die
// Leiste ist 340 breit, die Zeichenflaeche fuellt den Rest mit positivem freien Raum, das SVG haelt
// das Seitenverhaeltnis 880:660 und steht mit 16px Polster in der Flaeche. Und die drei Sprachen am
// echten Umschalter der Topbar.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { WERTE_WISSENSNETZ, farbeKanon, vergleiche } from "../../tools/design-vergleich/werte";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const THEMES = resolve(WURZEL, "apps/web/src/styles/themes.css");
const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/Wissensnetz.dc.html";
const ORIGIN = "http://klarwerk.test";

// ---- Der Bestand: Themen so gesetzt, dass jede Farbe, eine Kante und ein klarer Groesster entstehen --
/**
 * JOB 3070 D3 (Korrekturpflicht 2): eine Kategorie, die KEINES der Schlagworte dieser Datei ist.
 * Sie wird in T2 gebraucht — dort steht der Bestand, in dem `category` ausdruecklich von allen
 * `tags` verschieden ist, und genau daran misst sich, was die Seite dann sagt. Der AUFBAU-Bestand
 * bleibt beim Basisstand („Hygienic Design"), damit die 114 Altfaelle dieser Datei denselben
 * Bestand messen wie bisher.
 */
const KATEGORIE_OHNE_WIRKUNG = "Kategorie ohne Wirkung";
const THEMA_GROSS = "Hygienic Design"; // 4 Traeger, freigegeben und belegt → gruen, groesster, Vorgabe
const THEMA_ZWEIT = "Reinigung"; // 2 Traeger, freigegeben und belegt → gruen (nicht gewaehlt)
const THEMA_OFFEN = "Dichtungen"; // 1 Traeger, nicht freigegeben → gelb „in Pruefung"
const THEMA_OHNE_QUELLE = "CIP"; // 1 Traeger, freigegeben ohne Quelle → weiss
/** Runde 2 (BEN): ein langer Name OHNE Trennstelle — er muss trotzdem ganz im Kreis liegen (r 22). */
const THEMA_LANG = "Werkstoffkennzeichnung"; // 1 Traeger, nicht freigegeben → gelb
/**
 * Runde 6–8 (BEN): 40 lange, gleich beginnende Namen — unterscheidbar nur tief hinten (G4). Runde 8:
 * EIN Thema weicht frueh ab („…Sektor Sonderzweig"), die 39 uebrigen unterscheiden sich erst hinter
 * einem langen gemeinsamen Gruppenrest („…SegmentGemeinsamerUnterscheidungsblock01…39") — ein
 * globales Praefix allein machte alle 39 zu „…gme…".
 */
const THEMA_LANG_PRAEFIX = "Ventilanlage Produktionsbereich SegmentGemeinsamerUnterscheidungsblock";
const THEMA_SONDERZWEIG = "Ventilanlage Produktionsbereich Sektor Sonderzweig";
interface Wunsch {
  titel: string;
  tags: string[];
  freigeben: boolean;
  quelle: boolean;
}
const BESTAND: readonly Wunsch[] = [
  { titel: "Design Guide Rev. 0.91", tags: [THEMA_GROSS], freigeben: true, quelle: true },
  { titel: "HD Handbook Q1-2025 (Auszug)", tags: [THEMA_GROSS], freigeben: true, quelle: true },
  { titel: "Totraum-Checkliste Montage", tags: [THEMA_GROSS], freigeben: true, quelle: true },
  // der gemeinsame Traeger: EIN freigegebenes Objekt mit zwei Themen → die Kante
  {
    titel: "CIP-faehige Reinigung im HD",
    tags: [THEMA_ZWEIT, THEMA_GROSS],
    freigeben: true,
    quelle: true,
  },
  { titel: "Reinigungsplan Linie 4", tags: [THEMA_ZWEIT], freigeben: true, quelle: true },
  { titel: "Dichtungswerkstoffe Entwurf", tags: [THEMA_OFFEN], freigeben: false, quelle: false },
  { titel: "CIP-Ablauf Kurzfassung", tags: [THEMA_OHNE_QUELLE], freigeben: true, quelle: false },
  { titel: "Kennzeichnung nach DIN", tags: [THEMA_LANG], freigeben: false, quelle: false },
];
const ERWARTET_GROSS = BESTAND.filter((w) => w.tags.includes(THEMA_GROSS)).length;
const ERWARTET_ZWEIT = BESTAND.filter((w) => w.tags.includes(THEMA_ZWEIT)).length;

// ---- Das Zielbild lesen ---------------------------------------------------------------------------
const ziel = existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";
/** Die zwei Zeilen des gewaehlten Knotens im Zielbild (Z.38–39): „Hygienic" / „Design". */
function zielGewaehlteZeilen(z: string): string[] {
  const re = /<text [^>]*fill="#9C5009">([^<]*)<\/text>/g;
  const out: string[] = [];
  for (let m = re.exec(z); m !== null; m = re.exec(z)) {
    out.push((m[1] ?? "").trim());
  }
  return out;
}
/**
 * Token-Definitionen fuer den statischen Leseweg: der moderne BLOCK vor dem klassischen — gesucht
 * wird die Regel `[data-theme="modern"] {`, nicht die erste Nennung (die steht im Kopfkommentar).
 */
function tokenBlock(): string {
  const css = existsSync(THEMES) ? readFileSync(THEMES, "utf8") : "";
  const i = css.search(/\[data-theme="modern"\]\s*\{/);
  return i < 0 ? css : css.slice(i) + css.slice(0, i);
}

// ---- Die echte App in Chromium -------------------------------------------------------------------
type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): {
    url(): string;
    method(): string;
    postData(): string | null;
    headers(): Record<string, string>;
  };
  fulfill(r: {
    status: number;
    body: string | Buffer;
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
  click(selector: string): Promise<void>;
  focus(selector: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  url(): string;
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let browser: Browser | null = null;
let seite: Seite | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let fehler: string | null = null;
let version = "";
let theme = "";
let dom = "";
/**
 * Die Routenweiche fuer die Objektsuche EINES Themas (Fall iv): `leer` antwortet mit `[]` (fuer
 * diese Nutzerin ist nichts sichtbar — die Rechte-Naht der Suche), `fehler` mit 500, `haengt` nie.
 */
let suchWeiche: { tag: string; modus: "leer" | "fehler" | "haengt" } | null = null;

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
/** In der Seite: je Messpunkt Element finden, Pfad bilden, rueckwaerts pruefen, Wert lesen. */
const MESSEN = `([punkte, pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  return punkte.map((p) => {
    const el = document.querySelector(p.selektor);
    if (!el) return { name: p.name, fehlt: true, pfad: null, aufgeloest: false, wert: null };
    const pf = pfad(el);
    const wert = p.art === 'attribut' ? el.getAttribute(p.eigenschaft) : getComputedStyle(el).getPropertyValue(p.eigenschaft);
    return { name: p.name, fehlt: false, pfad: pf, aufgeloest: document.querySelector(pf) === el, wert };
  });
}`;
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const ATTRIBUT =
  "([sel, name]) => { const el = document.querySelector(sel); return el ? el.getAttribute(name) : null; }";
const ANZAHL = "(sel) => document.querySelectorAll(sel).length";
/**
 * Die Sonde (Muster D5): ein leeres Element mit dem Zielbild-Stil, nur fuer die Serialisierung des
 * Renderers — Chromium rastert Randbreiten auf ganze Geraetepixel (`1.5px` → `1px`), auf beiden
 * Seiten gleich. Sie misst nichts an der Seite.
 */
const SONDE =
  "([stil, eig]) => { const d = document.createElement('div'); d.setAttribute('style', stil); document.body.appendChild(d); const v = getComputedStyle(d).getPropertyValue(eig); d.remove(); return v; }";
/** In der Seite: die Lage der Leiste — Auswahl, Titel, Zaehlung, Karten, Link, Zustandssaetze. */
const LAGE = `() => {
  const t = (s) => { const e = document.querySelector(s); return e ? (e.textContent || '').trim() : null; };
  const g = document.querySelector('[data-testid="themenknoten"][aria-pressed="true"]');
  const link = document.querySelector('[data-testid="leiste-alle"]');
  return {
    gewaehlt: g ? g.getAttribute('data-thema') : null,
    gewaehlteAnzahl: document.querySelectorAll('[data-testid="themenknoten"][aria-pressed="true"]').length,
    titel: t('[data-testid="leiste-titel"]'),
    zaehlung: t('[data-testid="leiste-zaehlung"]'),
    karten: [...document.querySelectorAll('[data-testid="leiste-objekt"]')].map((k) => ({
      titel: (k.querySelector('[data-testid="leiste-objekt-titel"]') || {}).textContent || null,
      unterzeile: (k.querySelector('[data-testid="leiste-objekt-unterzeile"]') || {}).textContent || null,
    })),
    platzhalter: document.querySelectorAll('[data-testid="leiste-platzhalter"]').length,
    leer: t('[data-testid="leiste-leer"]'),
    fehlerSatz: t('[data-testid="leiste-fehler"]'),
    link: link ? { text: (link.textContent || '').trim(), href: link.getAttribute('href') } : null,
  };
}`;
/** In der Seite: jeder Knoten mit Radius, Schriftgrad, Zeilen und Farbe — fuer die Skalenregeln. */
const KNOTEN = `() => [...document.querySelectorAll('[data-testid="themenknoten"]')].map((g) => {
  const c = g.querySelector('circle');
  const tx = g.querySelector('text');
  const zeilen = [...tx.querySelectorAll('tspan')].map((s) => (s.textContent || '').trim());
  return {
    thema: g.getAttribute('data-thema'), farbe: g.getAttribute('data-farbe'), objekte: Number(g.getAttribute('data-objekte')),
    gewaehlt: g.getAttribute('aria-pressed') === 'true', role: g.getAttribute('role'), tabindex: g.getAttribute('tabindex'),
    r: Number(c.getAttribute('r')), cx: Number(c.getAttribute('cx')), cy: Number(c.getAttribute('cy')),
    schrift: getComputedStyle(tx).getPropertyValue('font-size'), gewicht: getComputedStyle(tx).getPropertyValue('font-weight'),
    zeilen: zeilen.length > 0 ? zeilen : [(tx.textContent || '').trim()],
    // Runde 2 (BEN): das GANZE Text-Rechteck liegt im Kreis-Rechteck — links, rechts, oben, unten.
    textInnen: (() => { const cb = c.getBoundingClientRect(); const tb = tx.getBoundingClientRect(); return tb.left >= cb.left - 0.5 && tb.right <= cb.right + 0.5 && tb.top >= cb.top - 0.5 && tb.bottom <= cb.bottom + 0.5; })(),
    textRand: (() => { const cb = c.getBoundingClientRect(); const tb = tx.getBoundingClientRect(); return { links: tb.left - cb.left, rechts: cb.right - tb.right, oben: tb.top - cb.top, unten: cb.bottom - tb.bottom }; })(),
    // Runde 5: die sichtbaren Rechtecke von Kreis und Text (getBoundingClientRect, CSS-Pixel).
    kreisRect: (() => { const b = c.getBoundingClientRect(); return { links: b.left, oben: b.top, rechts: b.right, unten: b.bottom, breite: b.width, hoehe: b.height }; })(),
    textRect: (() => { const b = tx.getBoundingClientRect(); return { links: b.left, oben: b.top, rechts: b.right, unten: b.bottom, breite: b.width, hoehe: b.height }; })(),
    label: g.getAttribute('aria-label'),
    titel: (g.querySelector('title') || {}).textContent || null,
    strich: c.getAttribute('stroke-dasharray'),
    strichBreite: c.getAttribute('stroke-width'),
  };
})`;
/** In der Seite: die Raumwirkung (Lehre JOB 3046 R1) — Rahmen, Zeichenflaeche, SVG, Leiste. */
const GEOMETRIE = `() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const rahmen = document.querySelector('[data-testid="netz-zeichenflaeche"]').parentElement.getBoundingClientRect();
  const z = r('[data-testid="netz-zeichenflaeche"]');
  const svg = r('[data-testid="themenkarte"]');
  const l = r('[data-testid="netz-seitenleiste"]');
  const main = document.querySelector('main').getBoundingClientRect();
  return {
    fenster: [window.innerWidth, window.innerHeight],
    rahmenBreite: rahmen.width, mainBreite: main.width,
    zeichenBreite: z.width, zeichenLinks: z.left - rahmen.left, zeichenRechts: l.left - z.right,
    svgBreite: svg.width, svgHoehe: svg.height, svgLinks: svg.left - z.left, svgRechts: z.right - svg.right, svgOben: svg.top - z.top,
    leisteBreite: l.width, leisteRechts: rahmen.right - l.right,
    kanten: [...document.querySelectorAll('[data-testid="themenkante"]')].length,
    // Runde 2 (BEN, Pruefluecke): die Legenden-Karte darf keinen Knoten (Kreis oder Name) verdecken.
    legendeUeberlappt: (() => {
      const lg = r('[data-testid="netz-legende"]');
      const schneidet = (a) => !(a.right <= lg.left || a.left >= lg.right || a.bottom <= lg.top || a.top >= lg.bottom);
      return [...document.querySelectorAll('[data-testid="themenknoten"]')]
        .filter((g) => schneidet(g.querySelector('circle').getBoundingClientRect()) || schneidet(g.querySelector('text').getBoundingClientRect()))
        .map((g) => g.getAttribute('data-thema'));
    })(),
    legendeInFlaeche: (() => { const lg = r('[data-testid="netz-legende"]'); return lg.left >= z.left && lg.right <= z.right && lg.top >= z.top && lg.bottom <= z.bottom; })(),
    // Runde 3 (BEN): die Karte beginnt UNTER der Unterkante des Bildes — die Reserve traegt ihre Hoehe.
    legendeHoehe: r('[data-testid="netz-legende"]').height,
    legendeUnterSvg: r('[data-testid="netz-legende"]').top - svg.bottom,
    reserveHoehe: r('[data-testid="netz-legende-reserve"]').height,
    legendeEintraege: document.querySelectorAll('[data-testid="netz-legende"] > span').length,
    // Runde 6 (BEN): die Skalierung des Bildes — sichtbare Breite geteilt durch die viewBox-Breite.
    viewBoxBreite: Number((document.querySelector('[data-testid="themenkarte"]').getAttribute('viewBox') || '0 0 0 0').split(' ')[2]),
    viewBoxHoehe: Number((document.querySelector('[data-testid="themenkarte"]').getAttribute('viewBox') || '0 0 0 0').split(' ')[3]),
    skala: svg.width / Number((document.querySelector('[data-testid="themenkarte"]').getAttribute('viewBox') || '0 0 1 1').split(' ')[2]),
  };
}`;

/**
 * JOB 3070 V6 · In der Seite: die Lage auf dem Telefon — was im Seiteninhalt an SVG steht, ob etwas
 * seitlich herausragt, und wo jede Themenzeile wirklich liegt (getBoundingClientRect, CSS-Pixel).
 */
const TELEFON = `() => {
  const main = document.querySelector('main');
  const anzahl = (sel) => document.querySelectorAll(sel).length;
  const alleSvg = [...document.querySelectorAll('svg')];
  return {
    fenster: [window.innerWidth, window.innerHeight],
    svgGesamt: alleSvg.length,
    svgImInhalt: main ? [...main.querySelectorAll('svg')].length : -1,
    svgAusserhalb: alleSvg.filter((s) => !main || !main.contains(s)).length,
    themenkarte: anzahl('[data-testid="themenkarte"]'),
    seitenleiste: anzahl('[data-testid="netz-seitenleiste"]'),
    umschalter: anzahl('[data-testid="netz-umschalter"]'),
    zustandsworte: anzahl('[data-testid="metrik-thema-zustand"]'),
    zusammen: anzahl('[data-testid="metrik-thema-zusammen"]'),
    // JOB 3070 D3: die Ansage der zweiten Themenachse — steht nur, wenn die Zeichnung Themen
    // fuehrt, zu denen die Liste keine Zeile hat.
    zweiteAchse: (() => { const e = document.querySelector('[data-testid="metrik-themen-zweite-achse"]'); return e ? (e.textContent || '') : null; })(),
    dokumentScrollBreite: document.documentElement.scrollWidth,
    dokumentSichtBreite: document.documentElement.clientWidth,
    mainScrollBreite: main ? main.scrollWidth : -1,
    mainSichtBreite: main ? main.clientWidth : -1,
    zeilen: [...document.querySelectorAll('[data-testid="metrik-thema"]')].map((z) => {
      const b = z.getBoundingClientRect();
      return {
        thema: z.getAttribute('data-thema'),
        links: b.left,
        rechts: b.right,
        breite: b.width,
        // JOB 3070 D2 (Korrekturpflicht 3): der vollstaendige zugaengliche Zeilentext — das, was
        // ein Vorleser wirklich vorliest. Nicht einzelne Traeger.
        text: (z.textContent || ''),
      };
    }),
  };
}`;

interface Telefon {
  fenster: number[];
  svgGesamt: number;
  svgImInhalt: number;
  svgAusserhalb: number;
  themenkarte: number;
  seitenleiste: number;
  umschalter: number;
  zustandsworte: number;
  zusammen: number;
  zweiteAchse: string | null;
  dokumentScrollBreite: number;
  dokumentSichtBreite: number;
  mainScrollBreite: number;
  mainSichtBreite: number;
  zeilen: { thema: string | null; links: number; rechts: number; breite: number; text: string }[];
}

/** JOB 3070 D2: die gezeichneten Knoten und die in Worten wiedergegebenen Themen — EINE Messung. */
const ACHSEN = `() => ({
  gezeichnet: [...document.querySelectorAll('[data-testid="themenknoten"]')].map((g) => g.getAttribute('data-thema')),
  gesprochen: [...document.querySelectorAll('[data-testid="metrik-thema"]')].map((z) => z.getAttribute('data-thema')),
})`;
interface Achsen {
  gezeichnet: (string | null)[];
  gesprochen: (string | null)[];
}

interface Messwert {
  name: string;
  fehlt: boolean;
  pfad: string | null;
  aufgeloest: boolean;
  wert: string | null;
}
interface Lage {
  gewaehlt: string | null;
  gewaehlteAnzahl: number;
  titel: string | null;
  zaehlung: string | null;
  karten: { titel: string | null; unterzeile: string | null }[];
  platzhalter: number;
  leer: string | null;
  fehlerSatz: string | null;
  link: { text: string; href: string | null } | null;
}
interface Knoten {
  thema: string;
  farbe: string;
  objekte: number;
  gewaehlt: boolean;
  role: string | null;
  tabindex: string | null;
  r: number;
  cx: number;
  cy: number;
  schrift: string;
  gewicht: string;
  zeilen: string[];
  textInnen: boolean;
  textRand: { links: number; rechts: number; oben: number; unten: number };
  label: string | null;
  titel: string | null;
  strich: string | null;
  strichBreite: string | null;
  kreisRect: Rect;
  textRect: Rect;
}
interface Rect {
  links: number;
  oben: number;
  rechts: number;
  unten: number;
  breite: number;
  hoehe: number;
}
/** Zwei Rechtecke sind disjunkt, wenn eines ganz links/rechts/oben/unten vom anderen liegt. */
function disjunkt(a: Rect, b: Rect): boolean {
  return a.rechts <= b.links || b.rechts <= a.links || a.unten <= b.oben || b.unten <= a.oben;
}
function schnittpaare(knoten: Knoten[], wahl: (k: Knoten) => Rect): string[] {
  const out: string[] = [];
  for (let i = 0; i < knoten.length; i++) {
    for (let j = i + 1; j < knoten.length; j++) {
      const a = knoten[i] as Knoten;
      const b = knoten[j] as Knoten;
      if (!disjunkt(wahl(a), wahl(b))) {
        out.push(`${a.thema}/${b.thema}`);
      }
    }
  }
  return out;
}
interface Geometrie {
  fenster: number[];
  rahmenBreite: number;
  mainBreite: number;
  zeichenBreite: number;
  zeichenLinks: number;
  zeichenRechts: number;
  svgBreite: number;
  svgHoehe: number;
  svgLinks: number;
  svgRechts: number;
  svgOben: number;
  leisteBreite: number;
  leisteRechts: number;
  kanten: number;
  legendeUeberlappt: string[];
  legendeInFlaeche: boolean;
  legendeHoehe: number;
  legendeUnterSvg: number;
  reserveHoehe: number;
  legendeEintraege: number;
  viewBoxBreite: number;
  viewBoxHoehe: number;
  skala: number;
}
/** Runde 2: die Zahl der erfolgreichen `POST /api/kos` beim Anlegen des Bestands (Fall K). */
let posts = 0;
let messwerte: Messwert[] = [];

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

/** Kanonisch fuer den Vergleich: Farben → `#rrggbb`, sonst getrimmt. */
function kanon(wert: string | null): string | null {
  return wert === null ? null : (farbeKanon(wert) ?? wert.trim());
}

const S = (fall: string): Seite => {
  expect(fehler, `${fall}: Seite nicht gemountet`).toBeNull();
  return seite as Seite;
};
const WARTE_KARTE = `() => !!document.querySelector('[data-testid="themenkarte"]')`;
const WARTE_LEISTE_FERTIG = `() => !!document.querySelector('[data-testid="leiste-zaehlung"], [data-testid="leiste-leer"], [data-testid="leiste-fehler"]')`;
/** Die Legendenreserve ist gesetzt, sobald sie die gemessene Hoehe der Karte traegt (Runde 3). */
const WARTE_RESERVE = `() => { const l = document.querySelector('[data-testid="netz-legende"]'); const r = document.querySelector('[data-testid="netz-legende-reserve"]'); return !!l && !!r && r.getBoundingClientRect().height >= l.getBoundingClientRect().height; }`;
/** Runde 6: das Bild hat seine Breite gemessen — viewBox-Breite = sichtbare Breite (Skalierung 1). */
const WARTE_MASS = `() => { const s = document.querySelector('[data-testid="themenkarte"]'); if (!s) return false; const vb = Number((s.getAttribute('viewBox') || '0 0 0 0').split(' ')[2]); return vb > 0 && Math.abs(s.getBoundingClientRect().width - vb) < 0.5 && Number(s.getAttribute('data-breite')) === vb; }`;
async function ladeSeite(s: Seite): Promise<void> {
  await s.goto(`${ORIGIN}/wissensnetz`, { waitUntil: "load", timeout: 60_000 });
  await s.waitForFunction(fn(WARTE_KARTE), undefined, { timeout: 30_000 });
  await s.waitForFunction(fn(WARTE_LEISTE_FERTIG), undefined, { timeout: 30_000 });
  // Dem gemessenen Mass und der Reserve ZEIT geben, nicht sie hier voraussetzen: ob sie stimmen,
  // entscheiden R/G/G4 bzw. G2/G3/G4 — so faellt ein Rueckfall dort als benannter Fall, nicht hier
  // als Timeout fuer alles.
  try {
    await s.waitForFunction(fn(WARTE_MASS), undefined, { timeout: 3_000 });
  } catch {
    // R/G/G4 melden den Befund.
  }
  // Der Reserve ZEIT geben, nicht sie hier voraussetzen: ob sie stimmt, entscheiden G2/G3/G4 — so
  // faellt eine fehlende Reserve dort als benannter Fall, nicht hier als Timeout fuer alles.
  try {
    await s.waitForFunction(fn(WARTE_RESERVE), undefined, { timeout: 3_000 });
  } catch {
    // G2/G3/G4 melden den Befund.
  }
}
/** Ein Objekt ueber den authentifizierten `POST /api/kos` anlegen — derselbe Weg wie im Aufbau. */
async function objektAnlegen(
  a: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
  titel: string,
  tags: string[],
  // JOB 3070 (Fall T): die KATEGORIE ist frei waehlbar. Sie ist die Achse, nach der die Sichtmetrik
  // ihre `themen` gruppiert (`lesemodell.ts:210`) — die Themenkarte gruppiert dagegen nach TAGS
  // (`themenkarte.ts`). Der Vorgabewert bleibt „Hygienic Design", also alles wie im Basisstand.
  kategorie = "Hygienic Design",
): Promise<string> {
  const res = await a.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: titel,
      statement: `${titel} — Kurzfassung fuer den Pruefstand.`,
      type: "best_practice",
      category: kategorie,
      tags,
      neededValidations: 1,
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Anlage von „${titel}" scheiterte: ${res.statusCode} ${res.body}`);
  }
  posts += 1;
  return (res.json() as { id: string }).id;
}

/** Freigabe ueber die echte `rate`-Aktion (neededValidations 1) — derselbe Weg wie im Aufbau. */
async function freigeben(
  a: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
  id: string,
): Promise<void> {
  const res = await a.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Freigabe von ${id} scheiterte: ${res.statusCode} ${res.body}`);
  }
}
let zugang: Record<string, string> = {};
/**
 * Runde 5 (BEN): die Routenweiche reicht `/api/*` an DIESE App mit DIESEM Bearer — beim Aufbau die
 * Hauptapp; G4 tauscht sie gegen eine zweite, frisch bestueckte App (40 Themen mit je genau einem
 * Objekt), damit der Bestand exakt der zulaessige Grenzfall ist und nichts aus dem Aufbau hineinragt.
 */
let zielApp: ReturnType<typeof buildApp> | null = null;
let zielToken = "";
/** Eine frische App mit Nutzerin, quittiertem Rechtshinweis und Bearer — der Aufbauweg, wiederverwendbar. */
async function frischeApp(email: string): Promise<{
  a: ReturnType<typeof buildApp>;
  token: string;
  headers: Record<string, string>;
  autorId: string;
}> {
  const a = buildApp(buildServices());
  await a.ready();
  await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email, password: "geheim12345" },
  });
  const login = await a.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  const token = (login.json() as { token: string }).token;
  const headers = { authorization: `Bearer ${token}` };
  const me = await a.inject({ method: "GET", url: "/api/auth/me", headers });
  await a.inject({ method: "POST", url: "/api/auth/notice", headers });
  return { a, token, headers, autorId: (me.json() as { id: string }).id };
}
async function lage(s: Seite): Promise<Lage> {
  return s.evaluate<Lage>(fn(LAGE));
}
const knotenSel = (thema: string): string => `[data-testid="themenknoten"][data-thema="${thema}"]`;

describe("JOB 3052 · D6 · das Wissensnetz des Zielbilds — die echte Seite, gemountet in Chromium (Theme modern)", () => {
  beforeAll(async () => {
    try {
      // Lehre JOB 3015 R4: ein fehlendes Zielbild ist ROT, kein gruener Ersatzfall.
      if (!existsSync(ZIELBILD)) {
        throw new Error(`Zielbild nicht lesbar: ${ZIELBILD}`);
      }
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
      }
      const services = buildServices();
      app = buildApp(services);
      await app.ready();
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job3052.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3052.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const headers = { authorization: `Bearer ${token}` };
      zugang = headers;
      const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
      const autorId = (me.json() as { id: string }).id;
      // Der Rechtshinweis wird quittiert wie in D5 — sonst kuerzt das Band den freien Bereich.
      await app.inject({ method: "POST", url: "/api/auth/notice", headers });

      // DER BESTAND ueber die echte App (Runde 2, BEN): jedes Objekt ueber den authentifizierten
      // `POST /api/kos` — der Weg, den auch die Oberflaeche geht; Freigabe ueber die echte
      // `rate`-Aktion (neededValidations 1). NUR die Quelle reicht danach der Dienst nach
      // (`addSource`, derselbe Weg wie die Quellen-Route fuer Menschen): die Erstellungsroute
      // verwirft Client-`sources` (SCRUM-470, ko-routes.ts), also gibt es dafuer keinen POST.
      for (const w of BESTAND) {
        const angelegt = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: {
            title: w.titel,
            statement: `${w.titel} — Kurzfassung fuer den Pruefstand.`,
            type: "best_practice",
            category: "Hygienic Design",
            tags: [...w.tags],
            neededValidations: 1,
          },
        });
        if (angelegt.statusCode !== 201) {
          throw new Error(
            `Anlage von „${w.titel}" scheiterte: ${angelegt.statusCode} ${angelegt.body}`,
          );
        }
        posts += 1;
        const ko = angelegt.json() as { id: string };
        if (w.quelle) {
          await services.ko.addSource(ko.id, autorId, { label: "Werksnorm" });
        }
        if (w.freigeben) {
          const rate = await app.inject({
            method: "PUT",
            url: `/api/kos/${ko.id}`,
            headers,
            payload: { action: "rate", verdict: "up" },
          });
          if (rate.statusCode !== 200) {
            throw new Error(
              `Freigabe von „${w.titel}" scheiterte: ${rate.statusCode} ${rate.body}`,
            );
          }
        }
      }

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      version = browser.version();
      seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await seite.addInitScript(
        `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
      );
      zielApp = app;
      zielToken = token;
      await seite.route(`${ORIGIN}/**`, async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (
          suchWeiche !== null &&
          url.pathname === "/api/library/search" &&
          url.searchParams.get("tag") === suchWeiche.tag
        ) {
          if (suchWeiche.modus === "haengt") {
            await new Promise<void>(() => undefined);
            return;
          }
          if (suchWeiche.modus === "fehler") {
            await route.fulfill({
              status: 500,
              body: JSON.stringify({ error: "Pruefstand: Suche gestoert" }),
              headers: { "content-type": "application/json" },
            });
            return;
          }
          await route.fulfill({
            status: 200,
            body: "[]",
            headers: { "content-type": "application/json" },
          });
          return;
        }
        if (url.pathname.startsWith("/api/")) {
          const kopf: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers())) {
            if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) kopf[k] = v;
          }
          kopf.authorization = `Bearer ${zielToken}`;
          const body = req.postData();
          const res = await (zielApp as ReturnType<typeof buildApp>).inject({
            method: req.method() as "GET",
            url: url.pathname + url.search,
            headers: kopf,
            ...(body !== null ? { payload: body } : {}),
          });
          await route.fulfill({
            status: res.statusCode,
            body: res.body,
            headers: {
              "content-type": (res.headers["content-type"] as string) ?? "application/json",
            },
          });
          return;
        }
        const d = distDatei(url.pathname);
        await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
      });
      await ladeSeite(seite);
      theme = await seite.evaluate<string>(
        fn(
          `() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`,
        ),
      );
      dom = await seite.evaluate<string>(fn("() => document.body.outerHTML"));
      messwerte = await seite.evaluate<Messwert[]>(fn(MESSEN), [
        WERTE_WISSENSNETZ.map((w) => ({
          name: w.name,
          selektor: w.messpunkt?.selektor ?? "",
          eigenschaft: w.messpunkt?.eigenschaft ?? "",
          art: w.messpunkt?.art ?? "stil",
        })),
        PFAD_FN,
      ]);
      console.info(
        `JOB 3052 D6 · Chromium ${version} · ${ORIGIN}/wissensnetz · Theme ${theme} · ${WERTE_WISSENSNETZ.length} Messpunkte · ${messwerte.filter((m) => !m.fehlt).length} gefunden`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  it("Z · das Zielbild liefert jeden Sollwert — keine Zeile ohne gelesenen Wert", () => {
    const ohne = WERTE_WISSENSNETZ.filter((w) => w.ziel(ziel) === null).map((w) => w.name);
    expect(ohne, "Zielbild-Anker ohne Treffer").toEqual([]);
    expect(zielGewaehlteZeilen(ziel)).toEqual(["Hygienic", "Design"]);
  });

  // ---- Red-first (§6): heute kein 880×660, keine Leiste, kein gewaehlter Knoten, Namen aussen ----
  it("R · die Seite traegt das Netz des Zielbilds: svg 880×660, eine Seitenleiste, ein gewaehlter Knoten, der Name IM Kreis", async () => {
    expect(fehler).toBeNull();
    const s = S("R");
    // Runde 6: das Bild traegt seine sichtbare Groesse als viewBox (Skalierung 1), hoechstens 880×660.
    const g0 = await s.evaluate<Geometrie>(fn(GEOMETRIE));
    expect(Math.abs(g0.skala - 1)).toBeLessThan(0.002);
    expect(g0.viewBoxBreite).toBeLessThanOrEqual(880);
    expect(g0.viewBoxHoehe).toBeLessThanOrEqual(660);
    expect(await s.evaluate<number>(fn(ANZAHL), '[data-testid="netz-seitenleiste"]')).toBe(1);
    expect(
      await s.evaluate<number>(fn(ANZAHL), '[data-testid="themenknoten"][aria-pressed="true"]'),
    ).toBe(1);
    const knoten = await s.evaluate<Knoten[]>(fn(KNOTEN));
    expect(knoten.length).toBeGreaterThan(0);
    expect(
      knoten.every((k) => k.textInnen),
      "jeder Name steht im Kreis",
    ).toBe(true);
  });

  it("S · die echte Seite steht: Theme modern, jeder Messpunkt gefunden, Selektoren rueckwaerts aufloesbar", () => {
    expect(fehler).toBeNull();
    expect(theme).toBe("modern");
    const fehlend = messwerte.filter((m) => m.fehlt).map((m) => m.name);
    expect(fehlend, "Messpunkte ohne reales Element").toEqual([]);
    expect(messwerte.every((m) => m.aufgeloest && m.pfad?.startsWith("body > "))).toBe(true);
  });

  // ---- Ein Vergleich je Wert: Zielbild-Sollwert gegen den WIRKSAMEN Wert am realen Element ------
  for (const w of WERTE_WISSENSNETZ) {
    it(`V · ${w.name} — ${w.messpunkt?.eigenschaft ?? "?"} an ${w.messpunkt?.selektor ?? "?"}`, async () => {
      expect(fehler).toBeNull();
      let soll = kanon(w.ziel(ziel));
      expect(soll, "Sollwert im Zielbild nicht lesbar").not.toBeNull();
      if (/^border-.*-width$/.test(w.messpunkt?.eigenschaft ?? "") && /px$/.test(soll ?? "")) {
        // CSS-Randbreiten: der Sollwert geht durch die Sonde desselben Renderers (1.5px → 1px).
        // SVG-Strichstaerken (`stroke-width`) rastert Chromium NICHT — sie bleiben 1.5px/2.5px.
        soll = kanon(
          await S(w.name).evaluate<string | null>(fn(SONDE), [
            `border: ${soll} solid #000`,
            "border-top-width",
          ]),
        );
      }
      const m = messwerte.find((x) => x.name === w.name);
      expect(m, "kein Messwert").toBeDefined();
      const mess = m as Messwert;
      expect(mess.fehlt, "kein reales Element").toBe(false);
      const ist = kanon(mess.wert);
      console.info(
        `JOB 3052 D6 · ${w.name} · ${w.messpunkt?.selektor} → ${mess.pfad} · soll ${soll} · ist ${ist}`,
      );
      expect(ist).toBe(soll);
    });
  }

  it("V-STATISCH · dieselbe Tabelle ueber das gerenderte Dokument (Inline-Stile, SVG-Attribute, Tokens): jede Zeile gleich", () => {
    expect(fehler).toBeNull();
    const befunde = vergleiche(ziel, `${dom}\n${tokenBlock()}`, WERTE_WISSENSNETZ);
    const ungleich = befunde
      .filter((b) => !b.gleich)
      .map((b) => `${b.name}: ${b.ziel} ≠ ${b.gebaut}`);
    expect(ungleich).toEqual([]);
    expect(befunde.length).toBe(WERTE_WISSENSNETZ.length);
  });

  // ---- Kalibrierung (v): kein stiller Null-Treffer ---------------------------------------------
  it("K · KALIBRIERUNG: mindestens drei Knoten, mindestens eine Kante, alle drei Farben — sonst misst alles oben ein leeres Bild", async () => {
    const s = S("K");
    const knoten = await s.evaluate<Knoten[]>(fn(KNOTEN));
    expect(knoten.length).toBeGreaterThanOrEqual(3);
    expect(new Set(knoten.map((k) => k.farbe))).toEqual(
      new Set(["belegt", "offen", "freigegeben"]),
    );
    expect(
      await s.evaluate<number>(fn(ANZAHL), '[data-testid="themenkante"]'),
    ).toBeGreaterThanOrEqual(1);
    expect(knoten.find((k) => k.thema === THEMA_GROSS)?.objekte).toBe(ERWARTET_GROSS);
    // Runde 2 (BEN): jedes Objekt des Bestands kam ueber `POST /api/kos` — der Zaehler sagt, wie viele.
    expect(posts).toBe(BESTAND.length);
    expect(posts).toBe(8);
    expect(knoten.length).toBe(5);
  });

  // ---- Die Knoten: Radius 22…46 nach Wurzelskala, Schriftgrad nach Radius, Umbruch, Tastatur ----
  it("N1 · Radius 22…46: der groesste Knoten hat 46, der kleinste 22, die Ordnung folgt der Traegerzahl", async () => {
    const knoten = await S("N1").evaluate<Knoten[]>(fn(KNOTEN));
    const nachGroesse = [...knoten].sort((a, b) => b.objekte - a.objekte);
    expect(nachGroesse[0]?.r).toBe(46);
    expect(nachGroesse[nachGroesse.length - 1]?.r).toBe(22);
    for (let i = 1; i < nachGroesse.length; i++) {
      expect((nachGroesse[i - 1]?.r ?? 0) >= (nachGroesse[i]?.r ?? 0)).toBe(true);
    }
    // Das Gewicht der Kante ist messbar geblieben (Lieferung 1), die Breite ist eine.
    expect(
      await S("N1").evaluate<string | null>(fn(ATTRIBUT), [
        '[data-testid="themenkante"]',
        "data-gewicht",
      ]),
    ).toMatch(/^\d+$/);
  });
  it("N2 · Schriftgrad nach Radius (≥40: 13 · ≥34: 12 · ≥30: 11.5 · ≥24: 11 · sonst 10.5) und Schnitt 600 — am realen Text", async () => {
    const knoten = await S("N2").evaluate<Knoten[]>(fn(KNOTEN));
    const regel = (r: number): string =>
      r >= 40 ? "13px" : r >= 34 ? "12px" : r >= 30 ? "11.5px" : r >= 24 ? "11px" : "10.5px";
    for (const k of knoten) {
      // Runde 7: die Schrift faellt nie unter 10,5 px — auch der lange Name traegt die Stufe seines
      // Radius (r 22 → 10,5) und wird stattdessen gekuerzt (N3c).
      expect(k.schrift, `${k.thema} r=${k.r}`).toBe(regel(k.r));
      expect(k.gewicht, `${k.thema}`).toBe(k.gewaehlt ? "700" : "600");
    }
  });
  it("N3 · der Name bricht am Leerzeichen um, wenn er breiter ist als der Kreis — wie Z.38/39 im Zielbild", async () => {
    const knoten = await S("N3").evaluate<Knoten[]>(fn(KNOTEN));
    expect(knoten.find((k) => k.thema === THEMA_GROSS)?.zeilen).toEqual(zielGewaehlteZeilen(ziel));
    // Ein kurzer Name bleibt eine Zeile.
    expect(knoten.find((k) => k.thema === THEMA_OHNE_QUELLE)?.zeilen).toEqual([THEMA_OHNE_QUELLE]);
  });
  it("N3b · JEDER Name liegt mit seinem ganzen Text-Rechteck im Kreis-Rechteck — links, rechts, oben, unten (Runde 2)", async () => {
    const knoten = await S("N3b").evaluate<Knoten[]>(fn(KNOTEN));
    console.info(
      `JOB 3052 D6 · N3b · ${knoten.map((k) => `${k.thema} r=${k.r} ${k.schrift} ${JSON.stringify(k.zeilen)} Rand ${JSON.stringify(k.textRand)}`).join(" | ")}`,
    );
    for (const k of knoten) {
      expect(k.textInnen, `${k.thema}: Rand ${JSON.stringify(k.textRand)}`).toBe(true);
    }
    // Kalibrierung: „Dichtungen" (r 22) und der lange Name sind dabei — sonst prueft die Schleife nichts Enges.
    expect(knoten.map((k) => k.thema)).toEqual(expect.arrayContaining([THEMA_OFFEN, THEMA_LANG]));
  });
  it("N3c · ein langer Name ohne Trennstelle: hoechstens zwei Zeilen im Kreis, ehrlich gekuerzt, der volle Name im aria-label und im Tooltip", async () => {
    const knoten = await S("N3c").evaluate<Knoten[]>(fn(KNOTEN));
    const lang = knoten.find((k) => k.thema === THEMA_LANG);
    expect(lang).toBeDefined();
    expect(lang?.r).toBe(22);
    expect(lang?.textInnen).toBe(true);
    expect(lang?.zeilen.length).toBeLessThanOrEqual(2);
    // Die Zeilen sind ein Anfang des echten Namens (Trennstrich/Auslassung abgezogen) — nichts Erfundenes.
    const gezeigt = (lang?.zeilen ?? []).join("").replace(/[-…]/g, "");
    expect(THEMA_LANG.startsWith(gezeigt)).toBe(true);
    expect(gezeigt.length).toBeGreaterThanOrEqual(6);
    expect(lang?.label).toContain(THEMA_LANG);
    if ((lang?.zeilen ?? []).some((z) => z.endsWith("…"))) {
      expect(lang?.titel).toBe(THEMA_LANG);
    }
  });
  it("N4 · der Kreis mittig: der groesste Knoten sitzt in der Mitte der Flaeche, die anderen im Ring darum", async () => {
    const knoten = await S("N4").evaluate<Knoten[]>(fn(KNOTEN));
    const gross = knoten.find((k) => k.thema === THEMA_GROSS);
    // Runde 6: die Mitte ist die Mitte der sichtbaren Flaeche (viewBox = Pixel), nicht 440/330.
    const g = await S("N4").evaluate<Geometrie>(fn(GEOMETRIE));
    expect(Math.abs((gross?.cx ?? 0) - g.viewBoxBreite / 2)).toBeLessThan(0.5);
    expect(Math.abs((gross?.cy ?? 0) - g.viewBoxHoehe / 2)).toBeLessThan(0.5);
    for (const k of knoten.filter((x) => x.thema !== THEMA_GROSS)) {
      expect(
        Math.hypot(k.cx - g.viewBoxBreite / 2, k.cy - g.viewBoxHoehe / 2),
        `${k.thema} liegt auf dem Ring`,
      ).toBeGreaterThan(100);
    }
  });
  it("N5 · jeder Knoten ist ein fokussierbarer Schalter (role=button, tabindex=0, aria-pressed)", async () => {
    const knoten = await S("N5").evaluate<Knoten[]>(fn(KNOTEN));
    for (const k of knoten) {
      expect(k.role, k.thema).toBe("button");
      expect(k.tabindex, k.thema).toBe("0");
    }
  });

  // ---- Die Raumwirkung (Lehre JOB 3046 R1): echte Flex-Geometrie bei 1280×800 -------------------
  it("G · die Leiste ist 340 breit am rechten Rand, die Zeichenflaeche fuellt den Rest mit positivem freien Raum, das SVG haelt 880:660 mit 16px Polster", async () => {
    const g = await S("G").evaluate<Geometrie>(fn(GEOMETRIE));
    console.info(`JOB 3052 D6 · G · Geometrie ${JSON.stringify(g)}`);
    expect(g.fenster).toEqual([1280, 800]);
    expect(Math.abs(g.leisteBreite - 340)).toBeLessThan(0.5);
    expect(Math.abs(g.leisteRechts)).toBeLessThan(1.5);
    // Zeichenflaeche + Leiste (+ Haarlinie) = Rahmen; die Flaeche ist echt gewachsen, nicht fix.
    expect(Math.abs(g.zeichenBreite + g.leisteBreite + 1 - g.rahmenBreite)).toBeLessThan(2);
    expect(g.zeichenBreite).toBeGreaterThan(400);
    expect(Math.abs(g.zeichenRechts)).toBeLessThan(1.5);
    expect(Math.abs(g.svgLinks - 16)).toBeLessThan(0.5);
    expect(Math.abs(g.svgRechts - 16)).toBeLessThan(0.5);
    expect(Math.abs(g.svgOben - 16)).toBeLessThan(0.5);
    expect(Math.abs(g.svgBreite / g.svgHoehe - 880 / 660)).toBeLessThan(0.01);
    // Runde 6 (BEN): Skalierung 1 — die viewBox IST die sichtbare Groesse; das Bild ist so breit wie
    // der Inhaltskasten der Zeichenflaeche (hoechstens 880), bei 1280×800 also 582 px. Radien und
    // Schrift sind damit Pixel, nicht skalierte Einheiten.
    expect(Math.abs(g.skala - 1)).toBeLessThan(0.002);
    expect(Math.abs(g.svgBreite - Math.min(880, Math.floor(g.zeichenBreite - 32)))).toBeLessThan(1);
  });
  it("G2 · die Legenden-Karte liegt in der Zeichenflaeche UNTER dem Bild (Reserve = ihre Hoehe) und verdeckt keinen Knoten — weder Kreis noch Name (Runde 2/3)", async () => {
    const g = await S("G2").evaluate<Geometrie>(fn(GEOMETRIE));
    console.info(
      `JOB 3052 D6 · G2 · Legende ${g.legendeHoehe}px hoch, ${g.legendeEintraege} Eintraege, Reserve ${g.reserveHoehe}px, Abstand zur SVG-Unterkante ${g.legendeUnterSvg}px`,
    );
    expect(g.legendeInFlaeche).toBe(true);
    expect(g.legendeUeberlappt).toEqual([]);
    // Runde 3: die Reserve traegt die gemessene Hoehe der Karte; die Karte beginnt ≥ 8px unter dem Bild.
    expect(g.reserveHoehe).toBeGreaterThanOrEqual(g.legendeHoehe + 16 - 1);
    expect(g.legendeUnterSvg).toBeGreaterThanOrEqual(7.5);
  });

  // ---- (i) Vorgabe-Auswahl = groesstes Thema, Leiste gefuellt aus der echten Suche ---------------
  it("F1 · beim Laden ist das groesste Thema gewaehlt und die Leiste zeigt seine Objekte: Titel, Zaehlsatz, drei Karten, Link mit echter Zahl", async () => {
    const l = await lage(S("F1"));
    expect(l.gewaehlteAnzahl).toBe(1);
    expect(l.gewaehlt).toBe(THEMA_GROSS);
    expect(l.titel).toBe(THEMA_GROSS);
    const t = i18n.getFixedT("de");
    expect(l.zaehlung).toBe(
      t("wissensnetz.leiste.zaehlung", { frei: ERWARTET_GROSS, pruefung: 0 }),
    );
    expect(l.karten.length).toBe(3);
    for (const k of l.karten) {
      expect(k.titel, "Titel aus dem Bestand").toBeTruthy();
      expect(k.unterzeile).toMatch(
        new RegExp(`^${t("wissensnetz.leiste.status.validiert")} · \\d{2}\\.\\d{2}\\.\\d{4}$`),
      );
    }
    expect(l.link).toEqual({
      text: t("wissensnetz.leiste.alle", { count: ERWARTET_GROSS }),
      href: `/bibliothek?tag=${encodeURIComponent(THEMA_GROSS)}`,
    });
    expect(l.platzhalter).toBe(0);
    expect(l.leer).toBeNull();
    expect(l.fehlerSatz).toBeNull();
  });

  // ---- (ii) Klick wechselt Auswahl, Farbe und Leiste; Enter ebenso --------------------------------
  it("F2 · ein echter Klick auf einen anderen Knoten wechselt Auswahl, Farbe (orange) und Leiste", async () => {
    const s = S("F2");
    const vorher = await s.evaluate<string | null>(fn(LESEN), [
      `${knotenSel(THEMA_ZWEIT)} circle`,
      "stroke",
    ]);
    await s.click(knotenSel(THEMA_ZWEIT));
    await s.waitForFunction(
      fn(
        `(t) => (document.querySelector('[data-testid="leiste-titel"]') || {}).textContent === t && !!document.querySelector('[data-testid="leiste-zaehlung"]')`,
      ),
      THEMA_ZWEIT,
      { timeout: 15_000 },
    );
    const l = await lage(s);
    expect(l.gewaehlt).toBe(THEMA_ZWEIT);
    expect(l.gewaehlteAnzahl).toBe(1);
    expect(l.titel).toBe(THEMA_ZWEIT);
    expect(l.karten.length).toBe(ERWARTET_ZWEIT);
    expect(l.link?.href).toBe(`/bibliothek?tag=${encodeURIComponent(THEMA_ZWEIT)}`);
    const nachher = await s.evaluate<string | null>(fn(LESEN), [
      `${knotenSel(THEMA_ZWEIT)} circle`,
      "stroke",
    ]);
    expect(kanon(vorher)).toBe("#116b3c");
    expect(kanon(nachher)).toBe("#c2500a");
    // Der vorher gewaehlte Knoten traegt wieder seine Grundfarbe.
    expect(
      kanon(
        await s.evaluate<string | null>(fn(LESEN), [`${knotenSel(THEMA_GROSS)} circle`, "stroke"]),
      ),
    ).toBe("#116b3c");
  });
  it("F3 · Enter auf dem fokussierten Knoten waehlt ihn — Tastaturweg", async () => {
    const s = S("F3");
    await s.focus(knotenSel(THEMA_OFFEN));
    await s.keyboard.press("Enter");
    await s.waitForFunction(
      fn(`(t) => (document.querySelector('[data-testid="leiste-titel"]') || {}).textContent === t`),
      THEMA_OFFEN,
      { timeout: 15_000 },
    );
    await s.waitForFunction(fn(WARTE_LEISTE_FERTIG), undefined, { timeout: 15_000 });
    const l = await lage(s);
    expect(l.gewaehlt).toBe(THEMA_OFFEN);
    const t = i18n.getFixedT("de");
    expect(l.zaehlung).toBe(t("wissensnetz.leiste.zaehlung", { frei: 0, pruefung: 1 }));
    expect(l.karten[0]?.unterzeile).toMatch(
      new RegExp(`^${t("wissensnetz.leiste.status.offen")} · \\d{2}\\.\\d{2}\\.\\d{4}$`),
    );
  });

  // ---- (iv) Leer, Laden, Fehler — je ueber die Routenweiche, nie eine leere Leiste ohne Wort ------
  it("F4 · Thema ohne sichtbare Objekte: die Leiste sagt den Leersatz, keine Karten, kein Zaehlsatz, der Link bleibt", async () => {
    const s = S("F4");
    suchWeiche = { tag: THEMA_OHNE_QUELLE, modus: "leer" };
    try {
      await s.click(knotenSel(THEMA_OHNE_QUELLE));
      await s.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="leiste-leer"]')`),
        undefined,
        { timeout: 15_000 },
      );
      const l = await lage(s);
      expect(l.gewaehlt).toBe(THEMA_OHNE_QUELLE);
      expect(l.leer).toBe(i18n.getFixedT("de")("wissensnetz.leiste.leer"));
      expect(l.karten).toEqual([]);
      expect(l.zaehlung).toBeNull();
      expect(l.link?.href).toBe(`/bibliothek?tag=${encodeURIComponent(THEMA_OHNE_QUELLE)}`);
    } finally {
      suchWeiche = null;
    }
  });
  it("F5 · solange die Suche nicht antwortet: drei Platzhalterkarten ohne Text, kein Leersatz, keine erfundene Zahl", async () => {
    const s = S("F5");
    suchWeiche = { tag: THEMA_ZWEIT, modus: "haengt" };
    try {
      await ladeSeite(s); // frische Seite, damit kein Cache der Auswahl von F2 antwortet
      await s.click(knotenSel(THEMA_ZWEIT));
      await s.waitForFunction(
        fn(
          `(t) => (document.querySelector('[data-testid="leiste-titel"]') || {}).textContent === t`,
        ),
        THEMA_ZWEIT,
        { timeout: 15_000 },
      );
      await s.evaluate(fn("() => new Promise((r) => setTimeout(r, 600))"));
      const l = await lage(s);
      expect(l.platzhalter).toBe(3);
      expect(l.karten).toEqual([]);
      expect(l.zaehlung).toBeNull();
      expect(l.leer).toBeNull();
      expect(l.fehlerSatz).toBeNull();
      expect(l.link?.text).toBe(i18n.getFixedT("de")("wissensnetz.leiste.oeffnen"));
    } finally {
      suchWeiche = null;
    }
  });
  it("F6 · antwortet die Suche mit einem Fehler: der Fehlersatz steht, die Karte bleibt, keine Karten", async () => {
    const s = S("F6");
    suchWeiche = { tag: THEMA_OFFEN, modus: "fehler" };
    try {
      await ladeSeite(s);
      await s.click(knotenSel(THEMA_OFFEN));
      await s.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="leiste-fehler"]')`),
        undefined,
        { timeout: 15_000 },
      );
      const l = await lage(s);
      expect(l.fehlerSatz).toBe(i18n.getFixedT("de")("wissensnetz.leiste.fehler"));
      expect(l.karten).toEqual([]);
      expect(await s.evaluate<number>(fn(ANZAHL), '[data-testid="themenknoten"]')).toBeGreaterThan(
        0,
      );
    } finally {
      suchWeiche = null;
      await ladeSeite(s);
    }
  });

  // ---- Die Legenden-Karte: nur, was im Bild vorkommt, plus der feste Satz ------------------------
  it("L · die Legende nennt genau die drei vorkommenden Farben und den festen Groessen-/Kantensatz — keinen Kantenlos-Satz, weil eine Kante da ist", async () => {
    const s = S("L");
    const eintraege = await s.evaluate<string[]>(
      fn(
        `() => [...document.querySelectorAll('[data-testid="netz-legende-eintrag"]')].map((e) => (e.textContent || '').trim())`,
      ),
    );
    const t = i18n.getFixedT("de");
    expect(eintraege).toEqual([
      t("wissensnetz.farbe.belegt"),
      t("wissensnetz.farbe.offen"),
      t("wissensnetz.farbe.freigegeben"),
      t("wissensnetz.legende.groesse"),
    ]);
    expect(await s.evaluate<number>(fn(ANZAHL), '[data-testid="legende-keine-kanten"]')).toBe(0);
    expect(await s.evaluate<number>(fn(ANZAHL), '[data-testid="legende-ubiquitaer"]')).toBe(0);
  });

  // ---- Dreisprachig: der echte Umschalter des Produkts -------------------------------------------
  // JOB 3060 · H1: die Sprach-Pille der Kopfzeile ist mit Absicht weg; der Umschalter wohnt auf
  // /profil (Zeile „Sprache"). Der Weg dorthin und zurueck geht ueber die Huelle selbst — Konto-Menue
  // → Profil, dann Zahnrad → „Weitere Bereiche" → Themenkarte — ohne Neuladen, damit die Sprache
  // dieselbe Sitzung traegt. Die drei Zusicherungen (Legendensatz, Zaehlsatz, Statuswort, Link)
  // bleiben unveraendert.
  for (const lng of ["en", "nl", "de"] as const) {
    it(`SPRACHE · ${lng}: Legendensatz, Zaehlsatz, Statuswort und Link kommen aus dem ${lng}-Woerterbuch`, async () => {
      const s = S(`SPRACHE ${lng}`);
      await s.click('[data-testid="kopfband-konto"]');
      await s.click('[data-testid="konto-profil"]');
      // Die Profilseite laedt ihre Daten nach — erst wenn der Sprachknopf steht, wird gemessen.
      await s.waitForFunction(
        fn(
          `(l) => location.pathname === '/profil' && [...document.querySelectorAll('main button')].some((x) => (x.textContent || '').trim().toLowerCase() === l)`,
        ),
        lng,
        { timeout: 10_000 },
      );
      const knopf = await s.evaluate<string | null>(
        fn(
          `([l, pfadFnSrc]) => { const pfad = eval('(' + pfadFnSrc + ')'); const b = [...document.querySelectorAll('main button')].find((x) => (x.textContent || '').trim().toLowerCase() === l); return b ? pfad(b) : null; }`,
        ),
        [lng, PFAD_FN],
      );
      expect(knopf, `kein Sprachknopf „${lng}“ auf /profil`).toBeTruthy();
      await s.click(knopf as string);
      // Zurueck zur Themenkarte ueber das Zahnrad-Menue (Weitere Bereiche) — SPA-Navigation.
      await s.click('[data-testid="kopfband-zahnrad"]');
      await s.click('[data-testid="zahnrad-weitere-bereiche"]');
      await s.click('[data-testid="bereich-wissensnetz"]');
      await s.waitForFunction(fn("() => location.pathname === '/wissensnetz'"), undefined, {
        timeout: 10_000,
      });
      await s.waitForFunction(fn(WARTE_KARTE), undefined, { timeout: 30_000 });
      await s.waitForFunction(fn(WARTE_LEISTE_FERTIG), undefined, { timeout: 30_000 });
      const t = i18n.getFixedT(lng);
      await s.waitForFunction(
        fn(
          `(x) => [...document.querySelectorAll('[data-testid="netz-legende-eintrag"]')].some((e) => (e.textContent || '').trim() === x)`,
        ),
        t("wissensnetz.legende.groesse"),
        { timeout: 10_000 },
      );
      const l = await lage(s);
      expect(l.gewaehlt).toBe(THEMA_GROSS);
      expect(l.zaehlung).toBe(
        t("wissensnetz.leiste.zaehlung", { frei: ERWARTET_GROSS, pruefung: 0 }),
      );
      expect(
        l.karten[0]?.unterzeile?.startsWith(`${t("wissensnetz.leiste.status.validiert")} · `),
      ).toBe(true);
      expect(l.link?.text).toBe(t("wissensnetz.leiste.alle", { count: ERWARTET_GROSS }));
    });
  }

  // ---- Runde 3 (BEN): der MAXIMALE Legendenzustand — drei Farben, Ubiquitaetssatz, Kantensatz ----
  // Zwei weitere Objekte mit dem groessten Thema ueber `POST /api/kos`: „Hygienic Design" traegt dann
  // 6 von 10 sichtbaren Objekten (> 50 %, ≥ 5) und ist ubiquitaer. Seine Kante zu „Reinigung" wird
  // unterdrueckt, die Karte hat KEINE Kante mehr, und weil das freigegebene Objekt beide Themen
  // weiterhin traegt, steht der Unterdrueckungssatz (JOB 2600 D7) — zusammen mit dem
  // Ubiquitaetssatz, dem festen Satz und den drei Farbmarken: sechs Eintraege, die Karte ist so hoch
  // wie sie ueberhaupt werden kann. Der gewaehlte Vorgabeknoten ist zugleich ubiquitaer (K5c im
  // Browser). Steht vor F7, weil F7 die Seite verlaesst; veraendert den Bestand fuer G4 mit.
  it("G3 · MAXIMALER Legendenzustand (ubiquitaeres Thema, unterdrueckte Kante): sechs Eintraege, und die Karte verdeckt trotzdem keinen Knoten; der gewaehlte ubiquitaere Knoten traegt Orange, 2.5 und die Strichelung", async () => {
    const s = S("G3");
    const a = app as ReturnType<typeof buildApp>;
    const vorher = await s.evaluate<Geometrie>(fn(GEOMETRIE));
    await objektAnlegen(a, zugang, "HD Schulungsunterlage", [THEMA_GROSS]);
    await objektAnlegen(a, zugang, "HD Audit-Protokoll", [THEMA_GROSS]);
    await ladeSeite(s);
    const g = await s.evaluate<Geometrie>(fn(GEOMETRIE));
    console.info(
      `JOB 3052 D6 · G3 · Legende ${g.legendeHoehe}px (vorher ${vorher.legendeHoehe}px), ${g.legendeEintraege} Eintraege, Reserve ${g.reserveHoehe}px, Abstand ${g.legendeUnterSvg}px, ueberlappt ${JSON.stringify(g.legendeUeberlappt)}`,
    );
    // Der Zustand ist wirklich der maximale: keine Kante, beide bedingten Saetze, drei Farben.
    expect(g.kanten).toBe(0);
    expect(await s.evaluate<number>(fn(ANZAHL), '[data-testid="legende-ubiquitaer"]')).toBe(1);
    expect(
      await s.evaluate<number>(fn(ANZAHL), '[data-testid="legende-kanten-unterdrueckt"]'),
    ).toBe(1);
    expect(await s.evaluate<number>(fn(ANZAHL), '[data-testid="legende-keine-kanten"]')).toBe(0);
    expect(g.legendeEintraege).toBe(6);
    expect(g.legendeHoehe).toBeGreaterThan(vorher.legendeHoehe);
    // DER KERN (Korrekturpflicht 1): auch jetzt liegt kein Kreis und kein Name unter der Karte.
    expect(g.legendeUeberlappt).toEqual([]);
    expect(g.legendeInFlaeche).toBe(true);
    expect(g.reserveHoehe).toBeGreaterThanOrEqual(g.legendeHoehe + 16 - 1);
    expect(g.legendeUnterSvg).toBeGreaterThanOrEqual(7.5);
    // Die Namen liegen weiterhin im Kreis, und der gewaehlte Knoten ist ubiquitaer mit Auswahlstil.
    const knoten = await s.evaluate<Knoten[]>(fn(KNOTEN));
    for (const k of knoten) {
      expect(k.textInnen, `${k.thema}: Rand ${JSON.stringify(k.textRand)}`).toBe(true);
    }
    const gross = knoten.find((k) => k.thema === THEMA_GROSS);
    expect(gross?.gewaehlt).toBe(true);
    expect(gross?.strich).toBe("4 3");
    expect(gross?.strichBreite).toBe("2.5");
    expect(
      kanon(
        await s.evaluate<string | null>(fn(LESEN), [`${knotenSel(THEMA_GROSS)} circle`, "stroke"]),
      ),
    ).toBe("#c2500a");
  });

  // ---- Runde 5 (BEN, Korrekturpflicht 1): der zulaessige Grenzfall — 40 gleich haeufige Themen ----
  // Eine ZWEITE, frische App: 40 Objekte mit je genau einem eigenen Schlagwort ueber `POST /api/kos`.
  // Der Server zeichnet dann 40 Knoten mit `objekte: 1` — alle gleich gross. Ohne Platzfaktor bekaeme
  // jeder Radius 46, und 53 Kreispaare schnitten sich (BENs Messung). Die Routenweiche zeigt fuer
  // diesen Fall auf die zweite App; danach wieder auf die Hauptapp (F7 braucht deren Bestand).
  it("G4 · vierzig gleich haeufige Themen aus einem echten Serverbestand: Kreis- UND Text-Rechtecke paarweise disjunkt, jeder Name im Kreis, Legende unter dem Bild, jeder Knoten waehlbar", async () => {
    const s = S("G4");
    const hauptApp = zielApp as ReturnType<typeof buildApp>;
    const hauptToken = zielToken;
    const zweite = await frischeApp("pedi-vierzig@job3052.test");
    try {
      let angelegt = 0;
      const vorherSonder = posts;
      await objektAnlegen(zweite.a, zweite.headers, "Objekt Sonderzweig Kurzfassung", [
        THEMA_SONDERZWEIG,
      ]);
      angelegt += posts - vorherSonder;
      for (let i = 1; i <= 39; i++) {
        const vorher = posts;
        await objektAnlegen(zweite.a, zweite.headers, `Objekt ${i} Kurzfassung`, [
          `${THEMA_LANG_PRAEFIX}${String(i).padStart(2, "0")}`,
        ]);
        angelegt += posts - vorher;
      }
      expect(angelegt).toBe(40);
      zielApp = zweite.a;
      zielToken = zweite.token;
      await ladeSeite(s);
      const knoten = await s.evaluate<Knoten[]>(fn(KNOTEN));
      expect(knoten.length, "der Deckel: genau 40 gezeichnete Themen").toBe(40);
      // Der Bestand ist wirklich der Grenzfall: jedes Thema traegt genau ein Objekt.
      expect(new Set(knoten.map((k) => k.objekte))).toEqual(new Set([1]));
      const radien = new Set(knoten.map((k) => k.r.toFixed(2)));
      expect(radien.size, "alle Radien gleich").toBe(1);
      console.info(
        `JOB 3052 D6 · G4 · 40 gleiche Themen: Radius ${[...radien][0]} (SVG-Einheiten), Kreis ${knoten[0]?.kreisRect.breite.toFixed(1)}px, Schrift ${knoten[0]?.schrift}`,
      );
      // DER KERN: kein Kreis-Rechteck und kein Text-Rechteck schneidet ein anderes.
      expect(
        schnittpaare(knoten, (k) => k.kreisRect),
        "Kreis-Rechtecke",
      ).toEqual([]);
      expect(
        schnittpaare(knoten, (k) => k.textRect),
        "Text-Rechtecke",
      ).toEqual([]);
      // Runde 6/7 (BEN): 40 lange, gleich beginnende Namen („…Segment01…40", das Unterscheidende
      // mitten im Wort) — jeder sichtbare Text ist ein anderer, der Schriftgrad ist EFFEKTIV
      // (Skalierung 1: viewBox = Pixel) mindestens 10,5 px und der Radius mindestens 22 px (Kreis-
      // Rechteck ≥ 44 px) — die Zielbild-Masse des kleinsten Knotens, ohne Verkleinerung.
      const g0 = await s.evaluate<Geometrie>(fn(GEOMETRIE));
      expect(Math.abs(g0.skala - 1), "Skalierung 1 — viewBox = sichtbare Groesse").toBeLessThan(
        0.002,
      );
      const sichtbar = knoten.map((k) => k.zeilen.join(" "));
      expect(new Set(sichtbar).size, `sichtbare Texte: ${sichtbar.join(" | ")}`).toBe(40);
      for (const k of knoten) {
        expect(Number.parseFloat(k.schrift), `${k.thema}: ${k.schrift}`).toBeGreaterThanOrEqual(
          10.5,
        );
        expect(k.r, `${k.thema}: r`).toBeGreaterThanOrEqual(22);
        expect(k.kreisRect.breite, `${k.thema}: Kreis`).toBeGreaterThanOrEqual(43.5);
        // Das Unterscheidende steht sichtbar: bei den Segmenten ihre Nummer, beim Sonderzweig die
        // Stelle, an der er von den Segmenten abweicht („…ktor…").
        expect(k.zeilen.join(" ")).toContain(
          k.thema === THEMA_SONDERZWEIG ? "ktor" : k.thema.slice(-2),
        );
      }
      console.info(
        `JOB 3052 D6 · G4 · sichtbare Namen ${new Set(sichtbar).size}/40 · z. B. ${sichtbar.slice(0, 3).join(" · ")} · Bild ${g0.viewBoxBreite}×${g0.viewBoxHoehe}px`,
      );
      for (const k of knoten) {
        expect(k.textInnen, `${k.thema}: Rand ${JSON.stringify(k.textRand)}`).toBe(true);
      }
      const g = await s.evaluate<Geometrie>(fn(GEOMETRIE));
      expect(g.legendeUeberlappt).toEqual([]);
      expect(g.legendeUnterSvg).toBeGreaterThanOrEqual(7.5);
      // Bedienbar: ein Klick auf einen Knoten der innersten Bahn waehlt ihn und fuellt die Leiste.
      await s.click(knotenSel(`${THEMA_LANG_PRAEFIX}39`));
      // (der Sonderzweig ist als Knoten da und waehlbar — sein Name steht voll im aria-label)
      expect(knoten.find((k) => k.thema === THEMA_SONDERZWEIG)?.label).toContain(THEMA_SONDERZWEIG);
      await s.waitForFunction(
        fn(
          `(t) => (document.querySelector('[data-testid="leiste-titel"]') || {}).textContent === t`,
        ),
        `${THEMA_LANG_PRAEFIX}39`,
        { timeout: 15_000 },
      );
      expect((await lage(s)).gewaehlt).toBe(`${THEMA_LANG_PRAEFIX}39`);
    } finally {
      zielApp = hauptApp;
      zielToken = hauptToken;
      await zweite.a.close();
      await ladeSeite(s);
    }
  });

  // ---- Runde 5 (BEN, Pruefluecke): die sichtbaren Masse — bei 1600×900 erreicht das Bild 880×660 ----
  // Bei 1280×800 nimmt die App-Huelle (Navigation 252px, main-Polster 72px) und die Leiste (340px)
  // so viel, dass das SVG auf 582×436,5 skaliert (Fall G). Das Zielbild ist ein Artboard OHNE
  // Navigation. Sobald das Fenster den Platz hergibt, MUSS das Bild die Zielbild-Masse haben —
  // gemessen mit getBoundingClientRect, nicht ueber viewBox: SVG 880×660, ein Kreis mit r 46 misst
  // 92×92px, und der Text skaliert mit dem Bild (Verhaeltnis der Textbreiten = Verhaeltnis der
  // SVG-Breiten).
  it("G5 · bei 1600×900 misst das SVG sichtbar 880×660px, der groesste Kreis 92×92px, und der Text skaliert mit dem Bild", async () => {
    const s = S("G5");
    const schmal = await s.evaluate<Knoten[]>(fn(KNOTEN));
    const schmalSvg = await s.evaluate<{ breite: number; hoehe: number }>(
      fn(
        `() => { const b = document.querySelector('[data-testid="themenkarte"]').getBoundingClientRect(); return { breite: b.width, hoehe: b.height }; }`,
      ),
    );
    await s.setViewportSize({ width: 1600, height: 900 });
    try {
      await s.waitForFunction(
        fn(
          `() => Math.abs(document.querySelector('[data-testid="themenkarte"]').getBoundingClientRect().width - 880) < 1`,
        ),
        undefined,
        { timeout: 10_000 },
      );
      const svg = await s.evaluate<{ breite: number; hoehe: number }>(
        fn(
          `() => { const b = document.querySelector('[data-testid="themenkarte"]').getBoundingClientRect(); return { breite: b.width, hoehe: b.height }; }`,
        ),
      );
      const breit = await s.evaluate<Knoten[]>(fn(KNOTEN));
      console.info(
        `JOB 3052 D6 · G5 · SVG ${svg.breite}×${svg.hoehe}px (bei 1280×800: ${schmalSvg.breite}×${schmalSvg.hoehe}px)`,
      );
      expect(Math.abs(svg.breite - 880)).toBeLessThan(1);
      expect(Math.abs(svg.hoehe - 660)).toBeLessThan(1);
      const gross = breit.find((k) => k.gewaehlt) as Knoten;
      expect(gross.r).toBe(46);
      expect(Math.abs(gross.kreisRect.breite - 92)).toBeLessThan(1);
      expect(Math.abs(gross.kreisRect.hoehe - 92)).toBeLessThan(1);
      const schmalGross = schmal.find((k) => k.gewaehlt) as Knoten;
      // Runde 6: der Text skaliert NICHT mehr mit dem Bild — er ist in beiden Fenstern gleich gross
      // (Pixel sind Pixel); nur die Flaeche und die Bahnen wachsen.
      expect(Math.abs(gross.textRect.breite - schmalGross.textRect.breite)).toBeLessThan(1);
      expect(Math.abs(gross.kreisRect.breite - schmalGross.kreisRect.breite)).toBeLessThan(1);
      for (const k of breit) {
        expect(k.textInnen, `${k.thema}: Rand ${JSON.stringify(k.textRand)}`).toBe(true);
      }
    } finally {
      await s.setViewportSize({ width: 1280, height: 800 });
      await ladeSeite(s);
    }
  });

  // ---- JOB 3070 · V6 (Fall T): DAS TELEFON — 390×844, Saetze statt der Zeichnung ------------------
  // DER AUSGANGSFEHLER war geometrisch und bis hierher UNGEMESSEN: diese Datei kannte nur 1280×800
  // (Z.25) und 1600×900 (G5). Die Zeile der `Karte` braucht aber mindestens 200 px Zeichenflaeche
  // (Wissensnetz.tsx:746) + 340 px Leiste (:630) + 32 px Polster = 572 px, und `overflow-hidden`
  // (:793) schneidet darunter ab. Auf 390 px stand also eine abgeschnittene Zeichnung.
  // GEMESSEN WIRD JETZT: (1) im Seiteninhalt steht kein SVG mehr, (2) nichts ragt seitlich heraus,
  // (3) jede Themenzeile liegt mit ihrem echten DOMRect ganz in der Fensterbreite.
  // ZUR EINGRENZUNG AUF `main`: die Huelle traegt ihr eigenes SVG (das Logo der Topbar,
  // `shell/Logo.tsx:17`) und ist nicht Gegenstand dieses Auftrags. „Kein SVG auf der Seite" heisst
  // deshalb: keines im Seiteninhalt — und der Beleg dafuer ist mitgemessen (`svgAusserhalb`).
  // DER BESTAND FUER T ist ein EIGENER (dritte App, wie G4 ihn fuer 40 Themen baut): der Aufbau-
  // Bestand ist nach G3 ubiquitaer und traegt deshalb gar keine Kante mehr (G3 misst `kanten: 0`) —
  // der Zusammen-Satz waere dort nicht messbar. Hier stehen drei Themen, zwei Zustaende und genau
  // eine Kante.
  //
  // T1 UND T2 SIND ZWEI BESTAENDE, und der Unterschied ist der Gegenstand von Codex' Befund:
  //   T1  Kategorie GLEICH dem Schlagwort → die Liste nennt dieselben Themen wie die Zeichnung.
  //       Das ist der Fall, der heute traegt, und er misst den ganzen Leseweg.
  //   T2  Kategorie VERSCHIEDEN von allen Schlagworten (Korrekturpflicht 2) → die Liste nennt
  //       andere Themen als die Zeichnung, weil der Server zwei Achsen fuehrt
  //       (`lesemodell.ts` nach `category`, `themenkarte.ts` nach `tags`; gemessen in
  //       `tests/wissensnetz-leseweg/namensraum-kette.test.tsx`). Diese Seite kann das nicht
  //       heilen — `services/**` ist kein Zielpfad —, aber sie muss es ANSAGEN. Genau das misst T2.
  it("T1 · TELEFON 390×844 (Kategorie = Schlagwort): kein SVG im Seiteninhalt, nichts ragt seitlich heraus, jede Themenzeile liegt ganz im Fenster — und sagt Zustand und gemeinsames Vorkommen in Worten", async () => {
    const s = S("T");
    const hauptApp = zielApp as ReturnType<typeof buildApp>;
    const hauptToken = zielToken;
    const dritte = await frischeApp("pedi-telefon@job3070.test");
    try {
      // Ein freigegebenes Objekt mit ZWEI Schlagworten — daraus entsteht die Kante.
      const geteilt = await objektAnlegen(
        dritte.a,
        dritte.headers,
        "CIP-Reinigung mit Dichtungswechsel",
        ["Reinigung", "Dichtungen"],
        "Reinigung",
      );
      await freigeben(dritte.a, dritte.headers, geteilt);
      const zweitesReinigung = await objektAnlegen(
        dritte.a,
        dritte.headers,
        "Reinigungsplan Linie 4",
        ["Reinigung"],
        "Reinigung",
      );
      await freigeben(dritte.a, dritte.headers, zweitesReinigung);
      const dichtung = await objektAnlegen(
        dritte.a,
        dritte.headers,
        "Dichtungswerkstoffe Uebersicht",
        ["Dichtungen"],
        "Dichtungen",
      );
      await freigeben(dritte.a, dritte.headers, dichtung);
      // Nicht freigegeben — sein Thema steht damit im Zustand „in Pruefung".
      await objektAnlegen(
        dritte.a,
        dritte.headers,
        "Ventilwartung Entwurf",
        ["Ventile"],
        "Ventile",
      );
      zielApp = dritte.a;
      zielToken = dritte.token;

      // ── ZUERST BEI 1280 px, wo Zeichnung und Worte NEBENEINANDER stehen: hier tragen beide
      //    Achsen dieselben NAMEN, weil jede Kategorie zugleich Schlagwort ist. Deshalb nennt die
      //    Liste genau die gezeichneten Themen — und deshalb ist der Leseweg unten vollstaendig.
      await ladeSeite(s);
      const achsen = await s.evaluate<Achsen>(fn(ACHSEN));
      console.info(`JOB 3070 D3 · T1/Achsen · ${JSON.stringify(achsen)}`);
      expect(achsen.gezeichnet.length, "die Karte zeichnet drei Knoten").toBe(3);
      expect([...achsen.gesprochen].sort()).toEqual([...achsen.gezeichnet].sort());
      expect([...achsen.gezeichnet].sort()).toEqual(["Dichtungen", "Reinigung", "Ventile"]);
      // Und weil hier nichts anzusagen ist, steht der Satz der zweiten Achse NICHT da.
      expect(
        await s.evaluate<number>(fn(ANZAHL), '[data-testid="metrik-themen-zweite-achse"]'),
        "nichts anzusagen, also kein Satz",
      ).toBe(0);

      await s.setViewportSize({ width: 390, height: 844 });
      // Kein `ladeSeite` — das wartet auf die Zeichnung und die Seitenleiste, und genau die darf es
      // hier nicht geben. Gewartet wird auf den Leseweg.
      await s.goto(`${ORIGIN}/wissensnetz`, { waitUntil: "load", timeout: 60_000 });
      await s.waitForFunction(
        fn(
          `() => document.querySelectorAll('[data-testid="metrik-thema"]').length >= 3 && document.querySelector('main svg') === null`,
        ),
        undefined,
        { timeout: 30_000 },
      );
      const b = await s.evaluate<Telefon>(fn(TELEFON));
      console.info(`JOB 3070 D3 · T1 · ${JSON.stringify(b)}`);
      expect(b.fenster).toEqual([390, 844]);
      // (1) Die Zeichnung und ihre 340-px-Leiste sind aus dem DOM — nicht bloss verkleinert.
      expect(b.svgImInhalt, "kein SVG im Seiteninhalt").toBe(0);
      expect(b.themenkarte).toBe(0);
      expect(b.seitenleiste).toBe(0);
      expect(b.umschalter, "auf schmal gibt es nichts zu waehlen").toBe(0);
      // KALIBRIERUNG: der Vergleich ist nicht deshalb erfuellt, weil die Seite leer waere — die drei
      // Zeilen stehen, jede mit ihrem Zustandswort, und die Kante ist als Satz da (beide Enden).
      expect(b.zeilen.map((z) => z.thema).sort()).toEqual(["Dichtungen", "Reinigung", "Ventile"]);
      expect(b.zustandsworte, "der Zustand steht in Worten").toBe(3);
      expect(b.zusammen, "das gemeinsame Vorkommen steht in Worten").toBe(2);
      // (2) Nichts ragt heraus — weder im Dokument noch in der Inhaltsflaeche selbst.
      expect(b.dokumentScrollBreite).toBeLessThanOrEqual(b.dokumentSichtBreite);
      expect(b.mainScrollBreite).toBeLessThanOrEqual(b.mainSichtBreite);
      // (3) Jede Zeile liegt mit ihrem echten Rechteck ganz in der Fensterbreite.
      const heraus = b.zeilen.filter((z) => z.links < -0.5 || z.rechts > 390.5);
      expect(heraus, `Zeilen ausserhalb des Fensters: ${JSON.stringify(heraus)}`).toEqual([]);
      // Der Beleg zur Eingrenzung auf `main`: die uebrigen SVG des Dokuments liegen samt und
      // sonders in der Huelle (das Logo der Topbar), nicht im Seiteninhalt.
      expect(b.svgAusserhalb).toBe(b.svgGesamt);
      // (4) KORREKTURPFLICHT 3, an der echten Seite: jede Zeile ist EIN vorlesbarer Satz. Gemessen
      //     am vollstaendigen `textContent` — dem, was ein Vorleser wirklich liest.
      const t = i18n.getFixedT("de");
      const reinigung = b.zeilen.find((z) => z.thema === "Reinigung");
      expect(reinigung?.text, "der ganze Zeilentext von „Reinigung“").toBe(
        [
          `Reinigung: ${t("wissensnetz.metrik.zeile.objekte", { count: 2 })}`,
          `, ${t("wissensnetz.metrik.zeile.beitragende", { count: 1 })}.`,
          ` ${t("wissensnetz.lesen.zustand", { wort: t("wissensnetz.farbe.freigegeben") })}`,
          ` ${t("wissensnetz.lesen.zusammen", { themen: "Dichtungen" })}`,
        ].join(""),
      );
      for (const z of b.zeilen) {
        expect(z.text, `„${z.text}" endet nicht auf einen Punkt`).toMatch(/\.$/);
        expect(z.text, `Buchstabe direkt an Ziffer in „${z.text}"`).not.toMatch(
          /\p{L}\p{N}|\p{N}\p{L}/u,
        );
        expect(z.text, `keine Kategorie in der Zeile: „${z.text}"`).not.toContain(
          KATEGORIE_OHNE_WIRKUNG,
        );
      }
      expect(b.svgGesamt, "die Huelle hat ihr eigenes SVG — daran misst sich die Eingrenzung").toBe(
        b.svgAusserhalb,
      );
    } finally {
      zielApp = hauptApp;
      zielToken = hauptToken;
      await dritte.a.close();
      await s.setViewportSize({ width: 1280, height: 800 });
      await ladeSeite(s);
    }
  });

  // ---- JOB 3070 · D3 (Fall T2): KATEGORIE ≠ SCHLAGWORT — die Seite sagt die Differenz an ----------
  // KORREKTURPFLICHT 2 von Codex, wörtlich: „Unit- und Chromium-Bestand so ändern, dass `category`
  // ausdrücklich von allen `tags` verschieden ist." Genau das ist dieser Bestand — und er zeigt,
  // was der HEUTIGE Server daraus macht: `metrik.themen` entsteht aus `ko.category`
  // (`services/wissensnetz/src/lesemodell.ts`), die Knoten aus `ko.tags`
  // (`services/wissensnetz/src/themenkarte.ts`). Die Liste nennt EIN Thema, die Zeichnung zeichnet
  // DREI andere.
  //
  // Der von Codex erwartete Beleg („die Mengen sind gleich") ist damit HEUTE NICHT ERFUELLBAR, ohne
  // die Achsen im Server zusammenzuführen — und `services/**` ist für JOB 3070 kein Zielpfad (D2 ist
  // an genau diesem Riegel gescheitert). Was hier gemessen wird, ist deshalb das, was die
  // Oberfläche schuldet, solange die Frage offen ist: Sie VERSCHWEIGT die Differenz nicht. Der
  // Ansagesatz steht mit der gemessenen Zahl, und keine Zeile behauptet einen Zustand, den die
  // Antwort für ihren Namen nicht hergibt.
  it("T2 · TELEFON 390×844 (Kategorie ≠ Schlagwort): die Seite sagt an, dass die Zeichnung Themen fuehrt, zu denen keine Zeile steht", async () => {
    const s = S("T2");
    const hauptApp = zielApp as ReturnType<typeof buildApp>;
    const hauptToken = zielToken;
    const vierte = await frischeApp("pedi-telefon2@job3070.test");
    try {
      // Dieselben drei Schlagworte wie in T1 — nur traegt JEDES Objekt jetzt eine Kategorie, die
      // keines seiner Schlagworte ist.
      const geteilt = await objektAnlegen(
        vierte.a,
        vierte.headers,
        "CIP-Reinigung mit Dichtungswechsel",
        ["Reinigung", "Dichtungen"],
        KATEGORIE_OHNE_WIRKUNG,
      );
      await freigeben(vierte.a, vierte.headers, geteilt);
      await objektAnlegen(
        vierte.a,
        vierte.headers,
        "Ventilwartung Entwurf",
        ["Ventile"],
        KATEGORIE_OHNE_WIRKUNG,
      );
      zielApp = vierte.a;
      zielToken = vierte.token;

      await s.setViewportSize({ width: 390, height: 844 });
      await s.goto(`${ORIGIN}/wissensnetz`, { waitUntil: "load", timeout: 60_000 });
      await s.waitForFunction(
        fn(
          `() => document.querySelector('[data-testid="metrik-themen-zweite-achse"]') !== null && document.querySelector('main svg') === null`,
        ),
        undefined,
        { timeout: 30_000 },
      );
      const b = await s.evaluate<Telefon>(fn(TELEFON));
      console.info(`JOB 3070 D3 · T2 · ${JSON.stringify(b)}`);

      // DIE LAGE, gemessen: eine Zeile (die Kategorie), drei gezeichnete Themen — die es auf dem
      // Telefon gar nicht zu sehen gibt.
      expect(b.zeilen.map((z) => z.thema)).toEqual([KATEGORIE_OHNE_WIRKUNG]);
      expect(b.zustandsworte, "die Kategorie hat keinen Knoten, also kein Zustandswort").toBe(0);
      expect(b.zusammen, "und erst recht keinen Zusammen-Satz").toBe(0);

      // DER KERN: die Seite verschweigt es nicht. Der Satz steht, mit der Zahl der gezeichneten
      // Themen ohne Zeile (Reinigung, Dichtungen, Ventile) und dem Grund.
      const t = i18n.getFixedT("de");
      expect(b.zweiteAchse).toBe(t("wissensnetz.lesen.nichtInListe", { count: 3 }));
      expect(b.zweiteAchse).toContain("3");

      // Und die Geometrie haelt auch hier: kein SVG im Inhalt, nichts ragt heraus.
      expect(b.svgImInhalt).toBe(0);
      expect(b.dokumentScrollBreite).toBeLessThanOrEqual(b.dokumentSichtBreite);
      expect(b.mainScrollBreite).toBeLessThanOrEqual(b.mainSichtBreite);
      const heraus = b.zeilen.filter((z) => z.links < -0.5 || z.rechts > 390.5);
      expect(heraus, `Zeilen ausserhalb des Fensters: ${JSON.stringify(heraus)}`).toEqual([]);
    } finally {
      zielApp = hauptApp;
      zielToken = hauptToken;
      await vierte.a.close();
      await s.setViewportSize({ width: 1280, height: 800 });
      await ladeSeite(s);
    }
  });

  // ---- (iii) Der Link fuehrt in die BESTEHENDE Bibliothek — steht am Ende, weil er die Seite verlaesst
  it("F7 · „Alle N Objekte oeffnen“ fuehrt auf /bibliothek?tag=<Thema> — der belegte Weg des Produkts", async () => {
    const s = S("F7");
    await s.click('[data-testid="leiste-alle"]');
    await s.waitForFunction(fn(`() => location.pathname === '/bibliothek'`), undefined, {
      timeout: 15_000,
    });
    const url = new URL(s.url());
    expect(url.pathname).toBe("/bibliothek");
    expect(url.searchParams.get("tag")).toBe(THEMA_GROSS);
  });
});
