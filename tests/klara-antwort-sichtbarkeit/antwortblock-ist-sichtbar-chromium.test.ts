// ================================================================================================
// JOB 3919 — DIE KLARA-ANTWORT STEHT IM BAUM. OB EIN MENSCH SIE SIEHT, HAT NIE EIN BROWSER GEMESSEN.
// ================================================================================================
//
// DIE GEMESSENE LUECKE, in einem Satz: `tests/app/f0304-klara-assistenzflaeche.test.tsx` prueft in
// GLIED 4 (`:835-838`), dass der Antwortblock nicht ausgeblendet ist — mit `ausblendung`
// (`f0304:570-588`), die genau drei Mittel kennt: das Attribut `hidden` (`:573`), die Klassen
// `hidden`/`invisible` (`:576`) und den Inline-Stil `display:none`/`visibility:hidden` (`:579`).
// Die Datei sagt ihre Grenze selbst (`f0304:567-568`): „jsdom rechnet kein Layout und wendet keine
// Stylesheet-Regeln an; eine Ausblendung ueber eine CSS-Datei oder ueber Groesse/Ueberdeckung
// faende das hier NICHT". Genau diese Ebene traegt aber die ganze Gestalt des Antwortblocks:
// `KlaraAssistant.tsx:562-565` gibt ihm ausschliesslich Tailwind-Klassen
// (`text-[12px] leading-relaxed text-text`), und die loest erst ein Browser auf.
//
// WAS DIESE DATEI DESHALB TUT: sie sucht die Antwort im ECHTEN, GEBAUTEN Produkt in Chromium auf
// und misst fuenf Dinge, die jsdom nicht messen kann —
//   S0  KALIBRIERUNG: die Antwort ist ueberhaupt erzeugt und steht unter ihrer Frage.
//   S1  die ERRECHNETE Ausblendung (getComputedStyle) am Block und an jedem Vorfahren.
//   S2  die FLAECHE (getBoundingClientRect) im sichtbaren Feld des Panels.
//   S3  die UEBERDECKUNG (document.elementFromPoint) an fuenf Punkten im Block.
//   S4  der sichtbare Text IST der gelieferte Antworttext.
//   S5  der TEXT steht in dieser Flaeche: keine Zeile wird hinter einer harten Kante abgeschnitten.
// S1 bis S5 haengen an S0: ohne erfolgreich gemessene, nichtleere Antwort wird hier keine
// Negativaussage getroffen (Zustandsmodell des Auftrags §9). Die alte jsdom-Vorpruefung bleibt
// gueltig und bleibt stehen — sie ist die schnelle, diese hier die langsame und vollstaendige.
//
// WARUM S5 (Befund des Pruefers an Runde 1, 14.09.2026): S2 bis S4 messen den KASTEN des Blocks und
// seinen `innerText` — und beide bleiben gruen, wenn der Inhalt ABGESCHNITTEN wird. Gegenprobe des
// Pruefers: `h-1 overflow-hidden` am Antwortblock ergab `280.0x4.0` Pixel, `innerText` lieferte
// trotzdem alle 281 Zeichen, `elementFromPoint` traf den verbliebenen Streifen — fuenf von fuenf
// Faellen gruen bei einer auf vier Pixel gestutzten Antwort. Der Kasten allein ist also kein Beleg.
// S5 misst deshalb INHALT UND BEGRENZENDE FLAECHE ZUSAMMEN: die Zeilenkaesten des Textes
// (`Range.getClientRects`) gegen den Kasten des Blocks und gegen den Schnitt aller HARTEN Kanten
// (`overflow: hidden|clip`) darueber. Keine Mindesthoehen-Konstante — gemessen wird, wo der Text
// wirklich liegt.
//
// WAS S5 BEWUSST NICHT ALS VERLUST ZAEHLT: alles hinter einer ROLLBAREN Kante (`overflow: auto |
// scroll` MIT Ueberhang AUF DIESER ACHSE; im Panel ist das der Inhaltsbereich,
// `KlaraAssistant.tsx:373`). Dort kann ein Mensch hinscrollen, und eine lange Antwort, die laenger
// ist als das Panel hoch, ist kein Fehler. Die Kette einer Achse bricht an ihrer ersten rollbaren
// Kante deshalb ab — was darueber liegt, sagt ueber den Verlust auf DIESER Achse nichts mehr.
//
// UND ZWAR JE ACHSE GETRENNT — der Befund des Pruefers an Runde 2 (14.09.2026): dort brach die
// GANZE Kette an der ersten rollbaren Kante ab, gleich welcher Achse. Die Gegenprobe machte die
// Antwortkarte `h-8 overflow-x-auto overflow-y-hidden` und die Antwort 600 Pixel breit: die
// WAAGERECHTE Rollbarkeit beendete die Kette, bevor die harte SENKRECHTE Kante desselben Gliedes
// ueberhaupt gelesen war — eine auf 32 von 58,5 Pixeln gestutzte Antwort ging mit sechs von sechs
// gruenen Faellen durch. Waagerecht rollen macht senkrecht abgeschnittenen Text aber nicht
// erreichbar, und umgekehrt genauso wenig. Seither laeuft jede Achse ihre EIGENE Kette: sie endet
// an IHRER rollbaren Kante, und bis dorthin zaehlt jede schneidende Kante IHRER Achse.
//
// KEIN SCROLLWEG OHNE UEBERHANG: `overflow: auto | scroll` OHNE Ueberhang traegt keinen Rollweg —
// es schneidet auf dieser Achse wie `hidden` und wird deshalb als schneidende Kante gefuehrt (ohne
// Ueberhang faellt hinter ihr zwar nichts weg, aber sie begrenzt das Feld fuer die Zeilen darunter).
//
// WAS ECHT IST — die geteilte Messstrecke `tests/design/h1-chromium.ts` wird IMPORTIERT, nicht
// nachgebaut: die echte gebaute App aus `apps/web/dist` unter `http://klarwerk.test/` (`:22-26`),
// Playwright bedient die Dateien aus `dist` und reicht JEDEN `/api/*`-Aufruf an die ECHTE
// Fastify-App weiter (`:6-10`, `buildApp`/`buildServices` `:20`) — mit dem Bearer der echten
// Anmeldung; das erste Konto ist Admin. Echt sind damit Bestand, Route, Reasoner, Buendel, Layout.
//
// WAS ERSETZT IST, und nur das:
//   (a) DIE MODELLFREIGABE. Ohne nutzbares Modell ist der KI-Knopf HART ausgegraut
//       (`KlaraAssistant.tsx:483`, `useAiAvailable("answer")`) und die Nutzerhandlung gar nicht
//       ausloesbar. Wie in `f0304:44-50` wird deshalb eine RFC-2606-Adresse gesetzt, die nie
//       aufgeloest wird (`KLARWERK_LOCAL_LLM_URL` + `_MODEL` + `_TIMEOUT_MS`). Der Statusabruf
//       meldet die Kante damit als „unverified" — der Knopf ist bedienbar —, die Generierung
//       scheitert, und es antwortet der deterministische Rueckfall (`demo: true`, der Antworttext
//       ist der Wortlaut einer tragenden Quelle; `f0304:771-776`). Das ist der erwartete Normalfall
//       dieser Vorrichtung, und er ist fuer die Frage dieses Auftrags gleichwertig: gemessen wird,
//       wie eine gelieferte Antwort ANGEZEIGT wird, nicht wer sie geschrieben hat.
//   (b) DIE ABLESUNG DER SERVERANTWORT. `window.fetch` wird in der Seite umhuellt und legt den
//       Antwortkoerper von `/api/help/explain` ab (`addInitScript` vor dem ersten Laden). Der
//       Transport selbst bleibt unveraendert — die Antwort kommt aus derselben echten App.
//
// WAS DIESE MESSUNG NICHT SIEHT, ausdruecklich: Farbkontrast und Lesbarkeit (gemessen wird
// Ausblendung, Flaeche, Ueberdeckung — nicht, ob die Schrift sich vom Hintergrund abhebt), den
// Scrollstand ausserhalb des Panels, andere Fensterbreiten (gemessen wird das Fenster der Strecke,
// 1280x800), EN und NL (gemessen wird DE), Markdown-Formatierung und Absatzgrenzen (eigener
// Auftrag; der heute gemessene Rueckfalltext ist unformatiert) und die Frage, ob eine ZWEITE
// Antwort im selben Panel noch sichtbar waere (je Lauf wird genau eine Antwort erzeugt).
//
// KEIN FLACKERN: gewartet wird auf ZUSTAENDE, nie auf Zeit — kein `waitForTimeout`, kein `sleep`.
// Das Zeitlimit fuer das Erscheinen der Antwort steht EINMAL als `ANTWORT_FRIST_MS` (60 s) und ist
// dort begruendet. Grund fuer die Sorgfalt: Chromium-Dateien haben schon Torlaeufe fremder Jobs rot
// gemacht (Zeile TOR-CHROMIUM-ABBAU in PRIORITAETEN.md).
//
// VORAUSSETZUNG: ein frisches `apps/web/dist`. Ohne Bau misst diese Datei einen alten Stand — die
// Strecke bricht dann mit „apps/web/dist fehlt — vorher ./tools/build" ab, und dieser Abbruch wird
// hier zu einem roten Fall (`fehler`), nicht zu einem stillen Uebersprung. Im Tor laeuft der Bau
// immer (`tools/check:9`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type Seite, type Strecke, fn, oeffne, strecke, warteBis } from "../design/h1-chromium";

// ---- Die Modellfreigabe (siehe Kopf, (a)) --------------------------------------------------------
// Gesetzt VOR `buildServices()` (das laeuft in `strecke()`), zurueckgenommen in `afterAll` — ein
// Fork-Arbeiter fuehrt nach dieser Datei weitere Testdateien aus und soll keine fremde Verdrahtung
// erben.
const VORHER = {
  url: process.env.KLARWERK_LOCAL_LLM_URL,
  modell: process.env.KLARWERK_LOCAL_LLM_MODEL,
  frist: process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS,
};
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-job3919.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job3919-nie-erreichbar";
process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "1000";

/**
 * Das Zeitlimit fuer das Erscheinen des Antwortblocks — die EINZIGE Zeitangabe dieser Datei, und
 * sie ist eine OBERGRENZE, keine Wartezeit: gewartet wird auf den Zustand „die Antwortkarte steht",
 * und wer frueher da ist, laeuft frueher weiter. 60 s, weil zwischen Klick und Karte eine echte
 * Kette liegt: Rangliste ueber den ganzen Hilfebestand, HTTP an die echte App, der Modellaufruf in
 * sein Zeitlimit (1 s) und der deterministische Rueckfall darunter. Die 30 s von `warteBis`
 * (h1-chromium `:285`) reichen fuer die kurzen Schritte davor (Panel, Knopf) und bleiben dort.
 */
const ANTWORT_FRIST_MS = 60_000;

/** Die Frage. Sie muss Treffer haben, sonst gibt es ehrlich KEINEN Modellaufruf und keine Karte. */
const FRAGE = "Wie funktioniert die Validierung von Wissen?";

const t = (key: string): string => i18n.getFixedT("de")(key);

/** Das Panel, sein Antwortblock und die Frage davor — alles strukturell, ohne neue Marke. */
const PANEL = 'section[data-klara="1"]';
const FRAGEZEILE = '[data-testid="klara-ai-question"]';

// ------------------------------------------------------------------------------------------------
// DIE MESSUNG. Eine Nutzerhandlung, danach EIN Blick in die Seite — jede Zusage unten liest daraus.
// ------------------------------------------------------------------------------------------------
interface Kasten {
  links: number;
  oben: number;
  breite: number;
  hoehe: number;
}
interface Kettenglied {
  tag: string;
  klasse: string;
  display: string;
  visibility: string;
  opacity: string;
  istPanel: boolean;
  /** Fuer S5: wie dieses Glied mit ueberstehendem Inhalt umgeht und wie viel Inhalt es hat. */
  overflowX: string;
  overflowY: string;
  kasten: Kasten;
  clientBreite: number;
  clientHoehe: number;
  scrollBreite: number;
  scrollHoehe: number;
}
interface Treffer {
  x: number;
  y: number;
  tag: string;
  klasse: string;
  text: string;
  selbst: boolean;
}
interface Messung {
  panelDa: boolean;
  frageDa: boolean;
  frageText: string;
  blockDa: boolean;
  blockTag: string;
  blockKlasse: string;
  sichtbarerText: string;
  baumText: string;
  kette: Kettenglied[];
  kasten: Kasten;
  kastenVorScrollen: Kasten;
  sichtfeld: Kasten;
  schnitt: Kasten;
  fenster: { breite: number; hoehe: number };
  punkte: Treffer[];
  /** Die Zeilenkaesten des Antworttextes selbst (S5) — nicht der Kasten, der sie umgibt. */
  zeilen: Kasten[];
  serverAntworten: string[];
}

/**
 * Das Ablegen der Serverantwort (Kopf, (b)). Laeuft VOR dem ersten Skript der Seite, damit kein
 * Aufruf entgeht; der echte `fetch` bleibt der Transport, es wird nur mitgelesen.
 */
const MITLESER = `(() => {
  window.__kwHilfeAntworten = [];
  const echt = window.fetch;
  window.fetch = async function (...args) {
    const antwort = await echt.apply(this, args);
    try {
      const erstes = args[0];
      const adresse = typeof erstes === "string" ? erstes : erstes && erstes.url ? erstes.url : "";
      if (String(adresse).indexOf("/api/help/explain") !== -1) {
        window.__kwHilfeAntworten.push(await antwort.clone().text());
      }
    } catch (e) {}
    return antwort;
  };
})();`;

/**
 * Der Blick in die Seite. Er scrollt den Block zuerst in den Blick — wie ein Mensch, der im Panel
 * nach unten rollt — und misst DANN; ohne diesen Schritt sagte „ausserhalb des sichtbaren Feldes"
 * nur, dass die Antwort weiter unten steht, und nicht, dass sie unlesbar waere.
 *
 * Das SICHTFELD wird nicht geraten: jeder Vorfahre, der nicht `overflow: visible` traegt, schneidet
 * (`section` traegt `overflow-hidden`, der Inhaltsbereich `overflow-y-auto`), und ganz zuletzt
 * schneidet das Fenster. Der Schnitt aus all diesen Rechtecken ist die Flaeche, auf der ein Auge
 * ueberhaupt etwas finden kann.
 *
 * FUER S5 kommen zwei Rohwerte dazu, ausgewertet wird beides drueben im Test: (1) je Kettenglied
 * `overflow`, Client- und Scrollmass — daraus wird dort unterschieden, welche Kante HART schneidet
 * und welche ROLLBAR ist; (2) die Zeilenkaesten des Textes ueber `Range.getClientRects()` am
 * Blockinhalt. Die Zeilen werden NACH dem Scrollen gemessen, im selben Koordinatenfeld wie alle
 * anderen Kaesten dieser Messung.
 */
const MESSEN = `() => {
  const leer = { links: 0, oben: 0, breite: 0, hoehe: 0 };
  const kasten = (el) => {
    const r = el.getBoundingClientRect();
    return { links: r.left, oben: r.top, breite: r.width, hoehe: r.height };
  };
  const schneide = (a, b) => {
    const links = Math.max(a.links, b.links);
    const oben = Math.max(a.oben, b.oben);
    const rechts = Math.min(a.links + a.breite, b.links + b.breite);
    const unten = Math.min(a.oben + a.hoehe, b.oben + b.hoehe);
    return { links, oben, breite: Math.max(0, rechts - links), hoehe: Math.max(0, unten - oben) };
  };
  const kurz = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120);
  const panel = document.querySelector('section[data-klara="1"]');
  const frage = panel ? panel.querySelector('[data-testid="klara-ai-question"]') : null;
  const block = frage ? frage.nextElementSibling : null;
  const antworten = window.__kwHilfeAntworten || [];
  const fenster = { breite: window.innerWidth, hoehe: window.innerHeight };
  if (!panel || !frage || !block) {
    return {
      panelDa: !!panel, frageDa: !!frage, frageText: frage ? kurz(frage) : "",
      blockDa: false, blockTag: "", blockKlasse: "", sichtbarerText: "", baumText: "",
      kette: [], kasten: leer, kastenVorScrollen: leer, sichtfeld: leer, schnitt: leer,
      fenster, punkte: [], zeilen: [], serverAntworten: antworten,
    };
  }
  const vorher = kasten(block);
  block.scrollIntoView({ block: "center", inline: "nearest" });
  const eigen = kasten(block);
  let sichtfeld = { links: 0, oben: 0, breite: fenster.breite, hoehe: fenster.hoehe };
  const kette = [];
  for (let e = block; e; e = e.parentElement) {
    const s = getComputedStyle(e);
    const k = kasten(e);
    kette.push({
      tag: e.tagName, klasse: String(e.className || ""),
      display: s.display, visibility: s.visibility, opacity: s.opacity, istPanel: e === panel,
      overflowX: s.overflowX, overflowY: s.overflowY, kasten: k,
      clientBreite: e.clientWidth, clientHoehe: e.clientHeight,
      scrollBreite: e.scrollWidth, scrollHoehe: e.scrollHeight,
    });
    if (e !== block && (s.overflowX !== "visible" || s.overflowY !== "visible")) {
      sichtfeld = schneide(sichtfeld, k);
    }
  }
  const schnitt = schneide(eigen, sichtfeld);
  // Die Zeilen des Textes selbst (S5): jedes Rechteck ist eine gesetzte Textzeile im Block. Leere
  // Rechtecke (Umbrueche, leere Knoten) sagen nichts und fliegen raus.
  const zeilen = [];
  const bereich = document.createRange();
  bereich.selectNodeContents(block);
  for (const r of Array.from(bereich.getClientRects())) {
    if (r.width > 0.5 && r.height > 0.5) {
      zeilen.push({ links: r.left, oben: r.top, breite: r.width, hoehe: r.height });
    }
  }
  const punkte = [];
  if (schnitt.breite > 2 && schnitt.hoehe > 2) {
    const anteile = [[0.25, 0.2], [0.75, 0.2], [0.5, 0.5], [0.25, 0.8], [0.75, 0.8]];
    for (const a of anteile) {
      const x = Math.min(schnitt.links + schnitt.breite * a[0], schnitt.links + schnitt.breite - 1);
      const y = Math.min(schnitt.oben + schnitt.hoehe * a[1], schnitt.oben + schnitt.hoehe - 1);
      const el = document.elementFromPoint(x, y);
      punkte.push({
        x, y,
        tag: el ? el.tagName : "(nichts)",
        klasse: el ? String(el.className || "") : "",
        text: el ? kurz(el) : "",
        selbst: !!el && (el === block || block.contains(el)),
      });
    }
  }
  return {
    panelDa: true, frageDa: true, frageText: kurz(frage), blockDa: true,
    blockTag: block.tagName, blockKlasse: String(block.className || ""),
    sichtbarerText: block.innerText || "", baumText: block.textContent || "",
    kette, kasten: eigen, kastenVorScrollen: vorher, sichtfeld, schnitt, fenster,
    punkte, zeilen, serverAntworten: antworten,
  };
}`;

/** Derselbe Text ohne JEDEN Leerraum — Bauform und Begruendung woertlich aus `f0304:553-561`. */
const ohneLeerraum = (text: string): string => text.replace(/\s+/g, "");

// ---- S5: harte Kanten, rollbare Kanten, Zeilen ---------------------------------------------------
/** Schneidet hart ab, was nicht hineinpasst — dahinter fuehrt kein Weg. */
const HART = new Set(["hidden", "clip"]);
/** Schneidet auch ab, aber der Mensch kann hinscrollen — dahinter ist Inhalt erreichbar. */
const ROLLBAR = new Set(["auto", "scroll", "overlay"]);
/**
 * Ein Pixel Spiel fuer die Rundung des Layouts, zwei fuer die Zeilenkaesten: eine Textzeile ist
 * `line-height` hoch, und Chromium rundet ihre Kanten auf Subpixel. Die Groessenordnung, um die es
 * geht, ist eine andere — bei der Gegenprobe des Pruefers standen 4 Pixel Kasten gegen ueber 100
 * Pixel Text. Das Spiel ist also nicht die Grenze zwischen gruen und rot, es haelt nur das Flackern
 * draussen.
 */
const SPIEL = 2;

const kanten = (k: Kasten): { rechts: number; unten: number } => ({
  rechts: k.links + k.breite,
  unten: k.oben + k.hoehe,
});
const zeige = (k: Kasten): string =>
  `${k.breite.toFixed(1)}x${k.hoehe.toFixed(1)} bei ${k.links.toFixed(1)}/${k.oben.toFixed(1)}`;
const zeigeGlied = (g: Kettenglied): string =>
  `${g.tag} „${g.klasse}" (overflow ${g.overflowX}/${g.overflowY}, Kasten ${zeige(g.kasten)}, ` +
  `Inhalt ${g.scrollBreite}x${g.scrollHoehe} in ${g.clientBreite}x${g.clientHoehe})`;

/** Liegt das Rechteck ganz im Feld? Mit SPIEL an jeder Kante. */
function liegtIn(z: Kasten, feld: Kasten): boolean {
  return (
    z.links >= feld.links - SPIEL &&
    z.oben >= feld.oben - SPIEL &&
    kanten(z).rechts <= kanten(feld).rechts + SPIEL &&
    kanten(z).unten <= kanten(feld).unten + SPIEL
  );
}

/** Der umschliessende Kasten aller Zeilen — wie hoch und breit der Text WIRKLICH ist. */
function umschliessend(zeilen: Kasten[]): Kasten {
  const links = Math.min(...zeilen.map((z) => z.links));
  const oben = Math.min(...zeilen.map((z) => z.oben));
  const rechts = Math.max(...zeilen.map((z) => kanten(z).rechts));
  const unten = Math.max(...zeilen.map((z) => kanten(z).unten));
  return { links, oben, breite: rechts - links, hoehe: unten - oben };
}

interface Strecke5 {
  /** Der Schnitt aller schneidenden Kanten vom Block aufwaerts — die Flaeche, aus der nichts entkommt. */
  feld: Kasten;
  /** Die Kanten, die ihn gebildet haben (leer = keine, dann ist `feld` unbegrenzt). */
  kanten: Kettenglied[];
  /** Woran die WAAGERECHTE Kette endete: ihre erste rollbare Kante, oder das Ende des Baums. */
  endeX: string;
  /** Woran die SENKRECHTE Kette endete — sie endet voellig unabhaengig von der waagerechten. */
  endeY: string;
  /** Kanten, deren EIGENER Inhalt nicht hineinpasst und nicht errollbar ist — dort geht er verloren. */
  ueberhang: string[];
}

const OFFENE_KETTE = "das Ende des Baums — keine rollbare Kante ueber dem Antwortblock";

/**
 * Die Kette vom Antwortblock aufwaerts — ZWEIMAL, einmal je Achse, weil eine Achse die andere nicht
 * rettet (Kopf, Befund Runde 2). Jede Achse laeuft bis zu IHRER ersten rollbaren Kante und bricht
 * dort ab, weil ab dort auf DIESER Achse Inhalt erreichbar ist: eine Antwort, die laenger ist als
 * das Panel hoch, ist kein Fehler, sondern der Normalfall — sie steht im Inhaltsbereich, und dort
 * wird gescrollt. Darunter fuehrt kein Weg an einer schneidenden Kante vorbei, und was hinter ihr
 * liegt, liest nie jemand.
 *
 * Schneidend ist dabei nicht nur `hidden|clip`, sondern auch ein `auto|scroll` OHNE Ueberhang auf
 * dieser Achse: ohne Ueberhang gibt es keinen Rollweg, an dem etwas hervorzuholen waere.
 */
function harteStrecke(kette: Kettenglied[]): Strecke5 {
  let links = -1e7;
  let oben = -1e7;
  let rechts = 1e7;
  let unten = 1e7;
  const gefunden: Kettenglied[] = [];
  const ueberhang: string[] = [];
  let endeX = OFFENE_KETTE;
  let endeY = OFFENE_KETTE;
  let xFrei = false;
  let yFrei = false;
  for (const g of kette) {
    // Beide Achsen an ihrer Rollkante angekommen: ueber diesem Glied ist nichts mehr zu holen.
    if (xFrei && yFrei) break;
    let beteiligt = false;
    if (!xFrei) {
      const ueber = g.scrollBreite - g.clientBreite;
      if (ROLLBAR.has(g.overflowX) && ueber > 1) {
        xFrei = true;
        endeX = `die waagerecht rollbare Kante ${zeigeGlied(g)}`;
      } else if (HART.has(g.overflowX) || ROLLBAR.has(g.overflowX)) {
        beteiligt = true;
        links = Math.max(links, g.kasten.links);
        rechts = Math.min(rechts, kanten(g.kasten).rechts);
        if (ueber > 1) {
          ueberhang.push(`${zeigeGlied(g)} — ${ueber} Pixel zu breit, waagerecht ohne Rollweg`);
        }
      }
    }
    if (!yFrei) {
      const ueber = g.scrollHoehe - g.clientHoehe;
      if (ROLLBAR.has(g.overflowY) && ueber > 1) {
        yFrei = true;
        endeY = `die senkrecht rollbare Kante ${zeigeGlied(g)}`;
      } else if (HART.has(g.overflowY) || ROLLBAR.has(g.overflowY)) {
        beteiligt = true;
        oben = Math.max(oben, g.kasten.oben);
        unten = Math.min(unten, kanten(g.kasten).unten);
        if (ueber > 1) {
          ueberhang.push(`${zeigeGlied(g)} — ${ueber} Pixel zu hoch, senkrecht ohne Rollweg`);
        }
      }
    }
    if (beteiligt) gefunden.push(g);
  }
  return {
    feld: {
      links,
      oben,
      breite: Math.max(0, rechts - links),
      hoehe: Math.max(0, unten - oben),
    },
    kanten: gefunden,
    endeX,
    endeY,
    ueberhang,
  };
}

let s: Strecke | null = null;
let fehler: string | null = null;
let m: Messung | null = null;

const seite = (): Seite => (s as Strecke).seite;

/** Was der Server geliefert hat — aus dem mitgelesenen Antwortkoerper, nicht aus dem Bildschirm. */
interface Serverantwort {
  answered: boolean;
  answer?: string;
  demo?: boolean;
  sources?: string[];
}
function serverantwort(): Serverantwort {
  const roh = (m as Messung).serverAntworten.at(-1);
  return JSON.parse(String(roh)) as Serverantwort;
}

/**
 * DIE KALIBRIERUNG ALS ZUSICHERUNG, nicht als Bedingung (Lehre JOB 3891 R1, `f0304:777-783`): jede
 * Aussage ueber Sichtbarkeit steht und faellt damit, dass ueberhaupt eine Antwort gemessen wurde.
 * S1 bis S4 rufen sie zuerst auf — sonst waeren ihre Zusagen Aussagen ueber eine leere Flaeche.
 */
function kalibrierung(): Messung {
  expect(fehler, `die Vorrichtung ist nicht aufgebaut: ${fehler}`).toBeNull();
  const mess = m as Messung;
  expect(mess.panelDa, "das Klara-Panel steht nicht offen").toBe(true);
  expect(
    mess.frageDa,
    "keine KI-Antwortkarte auf der Flaeche — ohne sie ist jede Aussage darunter gegenstandslos",
  ).toBe(true);
  expect(mess.frageText, "die Antwortkarte gehoert nicht zu dieser Frage").toContain(FRAGE);
  expect(mess.blockDa, `unter der Fragezeile steht kein Element (Karte: „${mess.frageText}")`).toBe(
    true,
  );
  expect(
    ohneLeerraum(mess.sichtbarerText).length,
    `der Antwortblock (${mess.blockTag} · „${mess.blockKlasse}") traegt keinen sichtbaren Text`,
  ).toBeGreaterThan(0);
  // Die gelieferte Antwort — sie ist der Massstab, gegen den der Bildschirm gehalten wird.
  expect(
    mess.serverAntworten.length,
    "der Browser hat keine einzige Antwort von /api/help/explain bekommen",
  ).toBeGreaterThan(0);
  const antwort = serverantwort();
  expect(
    antwort.answered,
    `der Server hat nicht geantwortet (${String(mess.serverAntworten.at(-1)).slice(0, 300)})`,
  ).toBe(true);
  expect(
    typeof antwort.answer === "string" && antwort.answer.length > 0,
    `die Antwort traegt keinen Text (answer=${JSON.stringify(antwort.answer)})`,
  ).toBe(true);
  // UND DER BLOCK IST WIRKLICH DIE ANTWORT, nicht irgendein Element unter der Frage: sein Anfang
  // ist der Anfang des gelieferten Textes. Ohne diese Zeile bliebe die Kalibrierung gruen, wenn das
  // Produkt statt der Antwort seinen Leersatz (`klara.aiEmpty`) zeigte.
  const anfang = ohneLeerraum(String(antwort.answer)).slice(0, 40);
  expect(
    ohneLeerraum(mess.sichtbarerText).startsWith(anfang),
    `unter der Frage steht nicht die gelieferte Antwort. Angezeigt (${mess.blockTag} · ` +
      `„${mess.blockKlasse}"): „${mess.sichtbarerText.replace(/\s+/g, " ").trim().slice(0, 200)}" · ` +
      `geliefert: „${String(antwort.answer).slice(0, 200)}"`,
  ).toBe(true);
  return mess;
}

describe("JOB 3919 · der Antwortblock ist im echten Browser sichtbar — nicht nur unausgeblendet", () => {
  beforeAll(async () => {
    try {
      await i18n.changeLanguage("de");
      s = await strecke({ email: "pedi@job3919-sichtbarkeit.test" });
      await seite().addInitScript(MITLESER);
      await oeffne(seite(), "/start");
      // Klara oeffnen — der Knopf unten rechts, an seinem zugaenglichen Namen.
      await seite().click(`button[data-klara="1"][aria-label="${t("klara.open")}"]`);
      await warteBis(seite(), `() => document.querySelector('${PANEL}') !== null`);
      // Die Frage tippen. Das Panel traegt genau EIN Eingabefeld (die Hilfesuche).
      await seite().fill(`${PANEL} input`, FRAGE);
      // Der KI-Knopf muss bedienbar sein — ohne nutzbares Modell ist er hart ausgegraut, und dann
      // waere die Nutzerhandlung gar nicht ausloesbar (Kopf, (a)).
      await warteBis(
        seite(),
        `(name) => { const b = [...document.querySelectorAll('${PANEL} button')].find((x) => (x.textContent || '').trim() === name); return b !== undefined && b.disabled === false; }`,
        t("klara.aiSearch"),
      );
      await seite().click(`${PANEL} button:has-text("${t("klara.aiSearch")}")`);
      // Auf den ZUSTAND warten, nie auf Zeit: die Karte steht erst, wenn die Anfrage zurueck ist.
      await seite().waitForFunction(
        fn(
          `() => { const p = document.querySelector('${PANEL}'); const f = p ? p.querySelector('${FRAGEZEILE}') : null; return f !== null && f.nextElementSibling !== null && (window.__kwHilfeAntworten || []).length > 0; }`,
        ),
        undefined,
        { timeout: ANTWORT_FRIST_MS },
      );
      const mess = await seite().evaluate<Messung>(fn(MESSEN));
      m = mess;
      const antwort = JSON.parse(String(mess.serverAntworten.at(-1))) as Serverantwort;
      console.info(
        `JOB 3919 · Chromium ${s.version} · Fenster ${mess.fenster.breite}x${mess.fenster.hoehe} · ` +
          `Antwort ${String(antwort.answer).length} Zeichen, demo=${String(antwort.demo)} · ` +
          `Block ${mess.blockTag} „${mess.blockKlasse}" ` +
          `${mess.kasten.breite.toFixed(1)}x${mess.kasten.hoehe.toFixed(1)} bei ` +
          `${mess.kasten.links.toFixed(1)}/${mess.kasten.oben.toFixed(1)} · vor dem Scrollen ` +
          `${mess.kastenVorScrollen.links.toFixed(1)}/${mess.kastenVorScrollen.oben.toFixed(1)} · Sichtfeld ` +
          `${mess.sichtfeld.breite.toFixed(1)}x${mess.sichtfeld.hoehe.toFixed(1)} · sichtbarer Anteil ` +
          `${mess.schnitt.breite.toFixed(1)}x${mess.schnitt.hoehe.toFixed(1)} · Kette ${mess.kette.length} Glieder`,
      );
      // S5, offen berichtet: wo der Text wirklich liegt und welche Kante ihn halten koennte.
      const strecke5 = harteStrecke(mess.kette);
      console.info(
        `JOB 3919 S5 · ${mess.zeilen.length} Textzeilen, umschliessend ` +
          `${mess.zeilen.length > 0 ? zeige(umschliessend(mess.zeilen)) : "(keine)"} · Block ` +
          `${zeige(mess.kasten)} · schneidende Kanten: ` +
          `${strecke5.kanten.length === 0 ? "keine" : strecke5.kanten.map(zeigeGlied).join(" | ")} · ` +
          `Feld ${zeige(strecke5.feld)} · waagerechte Kette endet an ${strecke5.endeX} · ` +
          `senkrechte Kette endet an ${strecke5.endeY} · Ueberhang: ` +
          `${strecke5.ueberhang.length === 0 ? "keiner" : strecke5.ueberhang.join(" | ")}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await s?.schliessen();
    for (const [name, wert] of [
      ["KLARWERK_LOCAL_LLM_URL", VORHER.url],
      ["KLARWERK_LOCAL_LLM_MODEL", VORHER.modell],
      ["KLARWERK_LOCAL_LLM_TIMEOUT_MS", VORHER.frist],
    ] as const) {
      if (wert === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = wert;
      }
    }
  }, 60_000);

  it("S0 · KALIBRIERUNG: die Antwort ist erzeugt und steht unter ihrer Frage", () => {
    const mess = kalibrierung();
    const antwort = serverantwort();
    // Der erwartete Normalfall dieser Vorrichtung, benannt statt verschwiegen: geantwortet hat der
    // deterministische Rueckfall (`demo: true`), weil die Modellkante nie aufloest. Fuer die Frage
    // dieses Auftrags — wie wird eine gelieferte Antwort ANGEZEIGT — ist das gleichwertig; er wird
    // deshalb NICHT gepinnt, sondern nur berichtet, damit ein spaeterer Wechsel nicht rot macht.
    console.info(
      `JOB 3919 S0 · geliefert ${String(antwort.answer).length} Zeichen, demo=${String(antwort.demo)}, ` +
        `Quellen ${(antwort.sources ?? []).join(", ")} · angezeigt ${mess.sichtbarerText.length} Zeichen`,
    );
  });

  it("S1 · keine errechnete Ausblendung: kein display:none, visibility:hidden oder opacity 0", () => {
    const mess = kalibrierung();
    // GENAU DIE EBENE, die `ausblendung` in jsdom nicht sehen kann (`f0304:567-568`): hier steht
    // der aufgeloeste Wert der Kaskade, nicht das Attribut im Baum. Gemessen wird am Block UND an
    // jedem Vorfahren — bis ueber das Panel hinaus bis `<html>`, denn ein ausgeblendeter Rumpf
    // macht denselben Menschen genauso blind (der Auftrag verlangt nur bis zum Panel; die Kette
    // weiter zu fuehren kostet nichts und laesst nichts offen).
    expect(
      mess.kette.some((g) => g.istPanel),
      "die Vorfahrenkette enthaelt das Panel nicht — sie misst nicht, was sie behauptet",
    ).toBe(true);
    const befunde = mess.kette
      .filter(
        (g) =>
          g.display === "none" ||
          g.visibility === "hidden" ||
          g.visibility === "collapse" ||
          Number.parseFloat(g.opacity) === 0,
      )
      .map(
        (g) =>
          `${g.tag}${g.istPanel ? " (Panel)" : ""} „${g.klasse}": display=${g.display} ` +
          `visibility=${g.visibility} opacity=${g.opacity}`,
      );
    expect(
      befunde,
      `der Antworttext steht im Baum, wird aber von der Kaskade ausgeblendet: ${befunde.join(" · ")}`,
    ).toEqual([]);
  });

  it("S2 · die Antwort hat Flaeche und liegt im sichtbaren Feld des Panels", () => {
    const mess = kalibrierung();
    // DIESE ZUSAGE GILT DEM KASTEN, nicht dem Text darin: ein Block von 280x4 Pixeln hat Flaeche und
    // liegt im Sichtfeld — und zeigt von einer 105 Pixel hohen Antwort eine Zeilenhaelfte. Genau das
    // hat der Pruefer an Runde 1 vorgefuehrt. Dass der TEXT in diesem Kasten steht, misst S5.
    expect(
      mess.kasten.breite,
      `der Antwortblock ist null Pixel breit (${mess.blockTag} · „${mess.blockKlasse}")`,
    ).toBeGreaterThan(0);
    expect(
      mess.kasten.hoehe,
      `ein Text auf null Hoehe wird nicht gelesen: der Antwortblock ist null Pixel hoch (${mess.blockTag} · „${mess.blockKlasse}")`,
    ).toBeGreaterThan(0);
    // Und er liegt im sichtbaren Feld: entweder ganz, oder er fuellt das Feld (ein Block, der
    // hoeher ist als der Ausschnitt, kann nicht ganz dastehen — dann ist die ehrliche Zusage, dass
    // der Ausschnitt VOLL von ihm ist). Ein halbes Pixel Spiel fuer die Rundung des Layouts.
    const sollBreite = Math.min(mess.kasten.breite, mess.sichtfeld.breite) - 0.5;
    const sollHoehe = Math.min(mess.kasten.hoehe, mess.sichtfeld.hoehe) - 0.5;
    const lage =
      `Block ${mess.kasten.breite.toFixed(1)}x${mess.kasten.hoehe.toFixed(1)} bei ` +
      `${mess.kasten.links.toFixed(1)}/${mess.kasten.oben.toFixed(1)} · Sichtfeld ` +
      `${mess.sichtfeld.breite.toFixed(1)}x${mess.sichtfeld.hoehe.toFixed(1)} bei ` +
      `${mess.sichtfeld.links.toFixed(1)}/${mess.sichtfeld.oben.toFixed(1)} · sichtbar ` +
      `${mess.schnitt.breite.toFixed(1)}x${mess.schnitt.hoehe.toFixed(1)}`;
    expect(
      mess.schnitt.breite,
      `die Antwort steht seitlich ausserhalb. ${lage}`,
    ).toBeGreaterThanOrEqual(sollBreite);
    expect(
      mess.schnitt.hoehe,
      `die Antwort steht ausserhalb des Blicks. ${lage}`,
    ).toBeGreaterThanOrEqual(sollHoehe);
  });

  it("S3 · an ihrer Stelle liegt sie selbst: nichts liegt ueber der Antwort", () => {
    const mess = kalibrierung();
    expect(
      mess.punkte.length,
      "kein einziger Punkt im Antwortblock war messbar — dann sagt dieser Fall nichts",
    ).toBeGreaterThanOrEqual(2);
    const verdeckt = mess.punkte
      .filter((p) => !p.selbst)
      .map(
        (p) =>
          `bei ${p.x.toFixed(0)}/${p.y.toFixed(0)} liegt ${p.tag} „${p.klasse}" mit dem Text ` +
          `„${p.text}" ueber der Antwort`,
      );
    expect(
      verdeckt,
      `die Antwort ist an ${verdeckt.length} von ${mess.punkte.length} Punkten ueberdeckt: ${verdeckt.join(" · ")}`,
    ).toEqual([]);
  });

  it("S4 · der sichtbare Text ist der gelieferte Antworttext", () => {
    const mess = kalibrierung();
    const geliefert = String(serverantwort().answer);
    // `innerText` LIEST AUCH, WAS ABGESCHNITTEN IST: hinter einer Kante mit `overflow: hidden`
    // bleibt der Text im Baum und in `innerText` vollstaendig — der Pruefer hat an Runde 1 „281
    // Zeichen geliefert, 281 angezeigt" bei vier Pixeln Kasten gemessen. Dieser Fall vergleicht also
    // WORTLAUT, nicht Sichtbarkeit; dass der Text auch gesetzt ist, misst S5.
    // Verglichen wird OHNE Leerraum (`f0304:553-561`): der Renderer setzt Blockgrenzen, und
    // `innerText` gibt sie als Umbruch zurueck. WAS DER VERGLEICH NICHT SIEHT, ehrlich benannt:
    // Marken, die der Renderer entfernt (`**fett**` wird `fett`) — die Formatierungsfrage ist
    // ausdruecklich nicht Gegenstand dieses Auftrags. Der heute gemessene Rueckfalltext traegt
    // keine Marken; traegt er eines Tages welche, wird dieser Fall rot und sagt es mit beiden
    // Texten im Klartext, statt still eine Halbwahrheit zu behaupten.
    expect(
      ohneLeerraum(mess.sichtbarerText),
      `der ANGEZEIGTE Antworttext ist nicht der gelieferte. Angezeigt (${mess.blockTag} · ` +
        `„${mess.blockKlasse}", ${mess.sichtbarerText.length} Zeichen): ` +
        `„${mess.sichtbarerText.replace(/\s+/g, " ").trim().slice(0, 300)}" · geliefert ` +
        `(${geliefert.length} Zeichen): „${geliefert.slice(0, 300)}"`,
    ).toBe(ohneLeerraum(geliefert));
  });

  it("S5 · der Text steht in seiner Flaeche: keine Zeile wird hinter einer harten Kante abgeschnitten", () => {
    const mess = kalibrierung();
    const strecke5 = harteStrecke(mess.kette);
    // Ohne gesetzte Zeilen sagt dieser Fall nichts — das waere kein Gruen, sondern eine leere Messung.
    expect(
      mess.zeilen.length,
      `im Antwortblock (${mess.blockTag} · „${mess.blockKlasse}") ist keine einzige Textzeile ` +
        `gesetzt, obwohl er Text traegt (${mess.sichtbarerText.length} Zeichen)`,
    ).toBeGreaterThan(0);
    const text = umschliessend(mess.zeilen);
    const lage =
      `${mess.zeilen.length} Zeilen, umschliessend ${zeige(text)} · Block ${zeige(mess.kasten)} · ` +
      `schneidende Kanten: ${strecke5.kanten.length === 0 ? "keine" : strecke5.kanten.map(zeigeGlied).join(" | ")} · ` +
      `Feld ${zeige(strecke5.feld)} · waagerechte Kette endet an ${strecke5.endeX} · senkrechte an ${strecke5.endeY}`;

    // (i) KEINE SCHNEIDENDE KANTE SCHNEIDET IHREN EIGENEN INHALT AB. `scrollHeight > clientHeight` an
    // einem Element mit `overflow-y: hidden` heisst woertlich: es steht mehr darin, als herausschaut,
    // und es fuehrt kein senkrechter Scrollweg hin. Das ist die Gegenprobe des Pruefers an Runde 1
    // (`h-1 overflow-hidden`: 4 Pixel sichtbar, ueber 100 Pixel Inhalt) — hier wird sie rot. JE ACHSE
    // GETRENNT, das ist die Gegenprobe des Pruefers an Runde 2: dass dasselbe Glied WAAGERECHT rollbar
    // ist (`overflow-x-auto`), holt den senkrecht abgeschnittenen Teil nicht hervor.
    expect(
      strecke5.ueberhang,
      `Inhalt wird abgeschnitten und ist auf keinem Weg erreichbar: ${strecke5.ueberhang.join(" · ")}. ${lage}`,
    ).toEqual([]);

    // (ii) JEDE ZEILE STEHT IM KASTEN DES BLOCKS. Erst das bindet S2 an den Inhalt: der dort
    // gemessene Kasten ist nur dann die Flaeche der Antwort, wenn die Antwort auch darin liegt.
    // Ragt Text darueber hinaus, gelten die Zusagen von S2 und S3 nicht mehr fuer den ganzen Text.
    const ausserhalbBlock = mess.zeilen
      .map((z, i) => ({ z, i }))
      .filter((e) => !liegtIn(e.z, mess.kasten))
      .map((e) => `Zeile ${e.i + 1} (${zeige(e.z)})`);
    expect(
      ausserhalbBlock,
      `${ausserhalbBlock.length} von ${mess.zeilen.length} Textzeilen stehen ausserhalb des ` +
        `gemessenen Antwortkastens (${ausserhalbBlock.join(" · ")}) — dann ist dieser Kasten nicht ` +
        `die Flaeche dieser Antwort. ${lage}`,
    ).toEqual([]);

    // (iii) UND JEDE ZEILE STEHT IM SCHNITT ALLER SCHNEIDENDEN KANTEN — je Achse bis zu deren
    // Rollkante gebildet. Das faengt zusaetzlich, was ein VORFAHRE abschneidet, ohne selbst Ueberhang
    // zu melden: etwa ein Block, der aus einem beschnittenen Vorfahren herausgeschoben wurde, oder
    // eine Zeile unter der harten Unterkante eines Gliedes, das nur WAAGERECHT rollbar ist. Gibt es
    // auf einer Achse keine schneidende Kante, ist das Feld dort unbegrenzt; dann traegt (i)+(ii) die
    // Aussage, und die Kette sagt im Bericht, warum.
    const verloren = mess.zeilen
      .map((z, i) => ({ z, i }))
      .filter((e) => !liegtIn(e.z, strecke5.feld))
      .map((e) => `Zeile ${e.i + 1} (${zeige(e.z)})`);
    expect(
      verloren,
      `${verloren.length} von ${mess.zeilen.length} Textzeilen liegen hinter einer schneidenden Kante ` +
        `(sichtbares Feld ${zeige(strecke5.feld)}): ${verloren.join(" · ")}. ${lage}`,
    ).toEqual([]);
  });
});
