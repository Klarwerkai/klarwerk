// @vitest-environment jsdom
// ================================================================================================
// JOB 3013 · D4 „SchlankesPanel“ — DAS RUHIGE GRUNDPANEL GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
//
// PEDIS ZEILE (PRIORITAETEN.md D4): „das ruhige Grundpanel“ — der Zustand, den jeder Mensch als
// erstes sieht, wenn Klara in Word aufgeht, BEVOR eine Frage gestellt ist.
//
// WAS DIESE DATEI TUT — und was sie ausdruecklich nicht tut:
//   · Sie liest `SchlankesPanel.dc.html` ZEILENWEISE (Z.15-49) und kanonisiert jede tragende Zusage
//     ohne Renderer (Hex → `rgb(r, g, b)`, `px` bleibt). Das ist die Sollwerttabelle (ZUSAGEN).
//   · Sie faehrt das AUSGELIEFERTE Aufgabenfenster (Markup + Inline-Skript, Fixture
//     `createKlaraPanel`) in jsdom und misst den Ruhezustand: welche Flaechen sichtbar sind, in
//     welcher Reihenfolge, mit welchem Text, welcher Reiter aktiv ist, welcher Knopf die
//     Hauptaktion traegt. Kein zweiter Quelltext, kein Nachbau, kein `toContain` am HTML als Beleg
//     fuer Verhalten.
//   · Sie stellt beides nebeneinander (Abweichungstabelle) mit genau drei Urteilen: `erfuellt`,
//     `abweichend`, `nicht messbar (Grund)`.
//   · Sie AENDERT NICHTS am Produkt. `taskpane.html` ist in JOB 3004 gesperrt; `werte.ts` ebenso.
//     Diese Datei ist der Vertrag, gegen den ein spaeterer Umbau baut — und der Waechter, der
//     meldet, wenn ein Traeger des heutigen Ruhezustands unbemerkt faellt.
//
// NACHGEFUEHRT IN JOB 3017 D4 (04.09.2026): der Umbau, gegen den dieser Vertrag gebaut wurde, ist
// gebaut — das Grundpanel traegt jetzt die Fragen-Karte `#ask-karte` mit rundem Sende-Pfeil, die
// Anmeldezeile `#kw-anmeldung` und GENAU EIN `#kw-stand-kopf` im Kopfband, den EINEN Satz
// `#ask-review-notice` unter der Karte, `#ka1-block` UNTER der Karte und die Fusszeile `#kw-fuss`
// mit dem Regelsatz `#ask-rule-note` und dem Schloss. Die Pins unten (Reihenfolge, Textinventar,
// Verlustliste, Urteile) sind GEMESSEN am neuen Stand, nicht abgeschrieben; die Darstellungswerte
// bleiben hier `nicht messbar` — die Chromium-Messung dafuer ist
// tests/design/zielbild-schlankes-panel.test.ts (eine Strecke, keine zweite Wahrheit).
//
// SICHTBARKEIT — WIE SIE HIER GEMESSEN WIRD, UND WO DIE GRENZE LIEGT. Die Fixture baut nur den
// Rumpf auf; das ausgelieferte `<style>` aus dem Kopf der Datei wird hier ZUSAETZLICH in den
// jsdom-Kopf gelegt, damit der Schalter des Panels selbst (`.hidden { display: none; }`,
// taskpane.html:223) als berechneter Wert lesbar ist. Gelesen wird AUSSCHLIESSLICH `display` am
// Element und an seinen Vorfahren. Alles andere — Farbe, Radius, Innenabstand, Schriftgrad,
// Schatten, Lage — rechnet jsdom nicht und wird hier NICHT behauptet: solche Zusagen tragen das
// Urteil `nicht messbar` mit dem Grund „braucht die Chromium-Panelmessung aus JOB 3004“. Eine
// zweite Chromium-Strecke fuer dieselbe Flaeche waere eine zweite Wahrheit; sie entsteht hier nicht.
//
// RED-FIRST-ERSATZ: DIE GEGENPROBE. Ein Messauftrag hat keinen Ausgangsfehler. Stattdessen kann
// die gemessene Stelle IM SPEICHER DER TESTSITZUNG verfaelscht werden — nie in einer Datei:
//   KW_D4_VERFAELSCHUNG=reihenfolge  → #ka1-block wird VOR die Frage-Karte gehaengt (JOB 3017) (R1)
//   KW_D4_VERFAELSCHUNG=text-greet   → der sichtbare Text von [data-t=greetBody] wird ersetzt (R2)
//   KW_D4_VERFAELSCHUNG=text-hilfe   → der sichtbare Text von [data-t=helpCan1] wird ersetzt  (R2)
//   KW_D4_VERFAELSCHUNG=text-ka6     → der sichtbare Text von #ka6-lead wird ersetzt          (R2)
//   KW_D4_VERFAELSCHUNG=text-platzhalter → der sichtbare Platzhalter von #ask-input wird ersetzt (R2)
//   KW_D4_VERFAELSCHUNG=reiter       → die Klasse `active` wandert von #tab-ask zu #tab-capture (R3)
//   KW_D4_VERFAELSCHUNG=hauptaktion  → #ask-btn verliert die Klasse `primary`                (R4)
// und die VORLAGE kann im Speicher verfaelscht werden (die Datei bleibt unberuehrt):
//   KW_D4_VERFAELSCHUNG=zielbild-z28-farbe    → Z.28 color #7E879A wird #000000            (S1)
//   KW_D4_VERFAELSCHUNG=zielbild-z41-groesse  → Z.41 svg width="18" wird width="19"         (S1)
//   KW_D4_VERFAELSCHUNG=zielbild-z49-stroke   → Z.49 svg stroke="#116B3C" wird #000000      (S1)
// Jede Verfaelschung darf GENAU den Fall rot machen, dessen Name den verfaelschten Wert traegt.
// Die DOM-Verfaelschungen greifen nur in dem Fall, der sie in `verfaelschbar` nennt; alle anderen messen
// den unveraenderten Zustand.
//
// TEXT: Fall R2 inventarisiert JEDEN sichtbaren Traeger mit eigenem Text in Dokumentordnung und
// haelt ihn woertlich fest — nicht nur eine Auswahl. Sichtbarer Text ist dabei ALLES, was ein
// Mensch liest: direkte Textknoten UND angezeigte Attributtexte (`placeholder` eines leeren Feldes,
// `value` eines Eingabefelds, `title` als angezeigter Sperrgrund). Sichtbare Elemente ohne
// beides und ohne textfuehrende Nachfahren stehen mit Begruendung in TEXTLOS.
// SOLLWERTDECKUNG: Fall S2 prueft je CSS-Eigenschaft und je SVG-Attribut der Zeilen 15-49, nicht je
// Zeile — jede Deklaration der Vorlage hat eine Zusage oder eine begruendete Auslassung.
//
// KALIBRIERUNG GEGEN DEN STILLEN NULL-TREFFER: `el()` wirft, wenn eine Stelle fehlt; die erwartete
// Flaechenliste ist ausgeschrieben und nicht leer; die Erwartung ist das GEMESSENE (03.09.2026,
// Basis 931c2dc), nicht das Erhoffte — der Test ist gruen gegen den heutigen Stand.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prop } from "../../tools/design-vergleich/werte";
import {
  type KlaraPanel,
  TASKPANE_PATH,
  createKlaraPanel,
  reply,
  splitTaskpane,
} from "../app/klara-panel-fixture";

const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/SchlankesPanel.dc.html";
const WURZEL = join(__dirname, "..", "..");
const SELBST = "tests/design/zielbild-schlankespanel-messung.test.ts";
const NICHT_VORHANDEN = "im Produkt nicht vorhanden";
const NICHT_MESSBAR = "nicht messbar (braucht die Chromium-Panelmessung aus JOB 3004)";

const VERFAELSCHUNG = process.env.KW_D4_VERFAELSCHUNG ?? "";
const ZIELBILD_VERFAELSCHUNGEN: Record<string, { zeile: number; von: string; nach: string }> = {
  "zielbild-z28-farbe": { zeile: 28, von: "#7E879A", nach: "#000000" },
  "zielbild-z41-groesse": { zeile: 41, von: 'width="18"', nach: 'width="19"' },
  "zielbild-z49-stroke": { zeile: 49, von: 'stroke="#116B3C"', nach: 'stroke="#000000"' },
};

/** Die Vorlage im Speicher — und NUR dort — verfaelscht, wenn eine Zielbild-Gegenprobe laeuft. */
function zielbildGelesen(): readonly string[] {
  const zeilen = readFileSync(ZIELBILD, "utf8").split("\n");
  const v = ZIELBILD_VERFAELSCHUNGEN[VERFAELSCHUNG];
  if (v !== undefined) {
    const alt = zeilen[v.zeile - 1] ?? "";
    if (!alt.includes(v.von)) {
      throw new Error(`Zielbild-Gegenprobe: Z.${v.zeile} traegt ${v.von} nicht`);
    }
    zeilen[v.zeile - 1] = alt.replace(v.von, v.nach);
  }
  return zeilen;
}

const DOM_VERFAELSCHUNGEN = [
  "reihenfolge",
  "text-greet",
  "text-hilfe",
  "text-ka6",
  "text-platzhalter",
  "reiter",
  "hauptaktion",
];
if (
  VERFAELSCHUNG !== "" &&
  !DOM_VERFAELSCHUNGEN.includes(VERFAELSCHUNG) &&
  ZIELBILD_VERFAELSCHUNGEN[VERFAELSCHUNG] === undefined
) {
  throw new Error(`unbekannte Verfaelschung: ${VERFAELSCHUNG}`);
}

const zielbildDa = existsSync(ZIELBILD);
const ZIEL_ZEILEN: readonly string[] = zielbildDa ? zielbildGelesen() : [];
const PRODUKT_HTML = readFileSync(resolve(process.cwd(), TASKPANE_PATH), "utf8");

// ------------------------------------------------------------------------------------------------
// DOM-ZUGRIFF OHNE DOM-BIBLIOTHEK (tsconfig.json: lib ES2022; dieselbe Form wie die Fixture).
// ------------------------------------------------------------------------------------------------
interface Knoten {
  nodeType: number;
  textContent: string | null;
}
interface El {
  id: string;
  tagName: string;
  textContent: string | null;
  childNodes: ArrayLike<Knoten>;
  title: string;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  parentElement: El | null;
  nextSibling: unknown;
  children: ArrayLike<El>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  querySelector(selector: string): El | null;
  querySelectorAll(selector: string): ArrayLike<El>;
  closest(selector: string): El | null;
  contains(other: El): boolean;
  insertBefore(node: El, ref: unknown): void;
  appendChild(node: El): void;
  removeChild(node: El): void;
}
interface Dok {
  head: El;
  body: El;
  createElement(tag: string): El;
  getElementById(id: string): El | null;
  querySelectorAll(selector: string): ArrayLike<El>;
}
interface Fenster {
  getComputedStyle(el: El): { display: string };
}
const g = globalThis as unknown as { document: Dok; window: Fenster };

const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

// ------------------------------------------------------------------------------------------------
// KANONISIERUNG OHNE RENDERER: Hex → rgb(r, g, b); px bleibt; Leerraum eingedampft; Kleinschrift.
// ------------------------------------------------------------------------------------------------
function hexZuRgb(hex: string): string {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
  const r = Number.parseInt(h.slice(1, 3), 16);
  const gr = Number.parseInt(h.slice(3, 5), 16);
  const b = Number.parseInt(h.slice(5, 7), 16);
  return `rgb(${r}, ${gr}, ${b})`;
}
function kanon(wert: string | null): string | null {
  if (wert === null) {
    return null;
  }
  return norm(wert)
    .replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi, (m) => hexZuRgb(m))
    .replace(/\s*,\s*/g, ", ")
    .toLowerCase();
}

// ------------------------------------------------------------------------------------------------
// DIE VORLAGE, ZEILENWEISE GELESEN (1-basiert, wie die Zeilenangaben im Auftrag).
// ------------------------------------------------------------------------------------------------
function zeile(n: number): string {
  const z = ZIEL_ZEILEN[n - 1];
  if (z === undefined) {
    throw new Error(`SchlankesPanel.dc.html: Zeile ${n} fehlt`);
  }
  return z;
}
/** Alle `style="…"`-Inhalte einer Zeile, in Reihenfolge. */
function stile(n: number): string[] {
  const raus: string[] = [];
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(zeile(n)); m !== null; m = re.exec(zeile(n))) {
    raus.push(m[1] ?? "");
  }
  return raus;
}
function stilWert(n: number, stilNr: number, eigenschaft: string): string | null {
  return prop(stile(n)[stilNr] ?? null, eigenschaft);
}
/** Sichtbarer Text einer Zeile: Tags entfernt, Leerraum eingedampft. */
function textDerZeile(n: number): string {
  return norm(zeile(n).replace(/<[^>]+>/g, " "));
}
function svgPfadDerZeile(n: number, dAnfang: string): string | null {
  return zeile(n).includes(`d="${dAnfang}`) ? dAnfang : null;
}
type SvgTag = "svg" | "path" | "rect";
/** Die Attribut-Paare des `nr`-ten `<tag …>` einer Zeile (0-basiert), in Reihenfolge. */
function svgTagAttribute(n: number, tag: SvgTag, nr: number): [string, string][] | null {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, "g");
  const treffer = [...zeile(n).matchAll(re)];
  const kopf = treffer[nr]?.[1];
  if (kopf === undefined) {
    return null;
  }
  return [...kopf.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((m) => [m[1] ?? "", m[2] ?? ""]);
}
function svgAttrDerZeile(n: number, tag: SvgTag, nr: number, attr: string): string | null {
  const paare = svgTagAttribute(n, tag, nr);
  return paare?.find(([name]) => name === attr)?.[1] ?? null;
}
/** Alle Eigenschaftsnamen eines Inline-Stils („a: 1; b: 2“ → [a, b]). */
function eigenschaftenVon(stil: string): string[] {
  return stil
    .split(";")
    .map((d) => d.split(":")[0]?.trim() ?? "")
    .filter((p) => p !== "");
}
function einzug(n: number): number {
  return zeile(n).length - zeile(n).trimStart().length;
}
/** Zeilen, die im Bereich (von..bis) ein direktes Kind mit genau diesem Einzug oeffnen. */
function direkteKindZeilen(von: number, bis: number, tiefe: number): number[] {
  const raus: number[] = [];
  for (let n = von; n <= bis; n += 1) {
    if (einzug(n) === tiefe && zeile(n).trimStart().startsWith("<div")) {
      raus.push(n);
    }
  }
  return raus;
}

// ------------------------------------------------------------------------------------------------
// DER RUHEZUSTAND — das ausgelieferte Panel, gefahren und abgefragt.
// ------------------------------------------------------------------------------------------------
interface Ruhezustand {
  panel: KlaraPanel;
  /** Stelle holen; fehlt sie, ist das ein Fehlschlag, kein leerer Wert. */
  el(selector: string): El;
  q(selector: string): El | null;
  alle(selector: string): El[];
  sichtbar(el: El | null): boolean;
  /** Normalisierter sichtbarer Text einer Stelle (Fixture-Semantik: Fehlen wirft). */
  text(selector: string): string;
  t(key: string, vars?: Record<string, string>): string;
  frageKarte(): El;
  hilfeKarte(): El;
  /** Reihenfolge im Dokument: Index in `body.querySelectorAll("*")`. */
  position(el: El): number;
  /** Zustand des Sendeknopfs VOR den Startabrufen (synchron nach dem Skriptlauf). */
  knopfVorStart: { disabled: boolean; title: string; text: string; ariaLabel: string };
  abbauen(): void;
}

interface RuhezustandOptionen {
  /** Die Verfaelschungen (KW_D4_VERFAELSCHUNG), die DIESER Fall an sich heranlaesst. */
  verfaelschbar?: string[];
  routes?: Record<string, ReturnType<typeof reply>>;
}

/** Der EIGENE Text eines Elements: nur direkte Textknoten, normalisiert. */
function eigenerText(e: El): string {
  return norm(
    Array.from(e.childNodes)
      .filter((k) => k.nodeType === 3)
      .map((k) => k.textContent ?? "")
      .join(" "),
  );
}

async function ruhezustand(opt: RuhezustandOptionen = {}): Promise<Ruhezustand> {
  // Das AUSGELIEFERTE Stylesheet in den jsdom-Kopf — nur fuer `display` (s. Kopfkommentar).
  const stylesheet = g.document.createElement("style");
  const von = PRODUKT_HTML.indexOf("<style>");
  const bis = PRODUKT_HTML.indexOf("</style>");
  if (von < 0 || bis < von) {
    throw new Error("taskpane.html: <style>-Block nicht auffindbar");
  }
  stylesheet.textContent = PRODUKT_HTML.slice(von + "<style>".length, bis);
  g.document.head.appendChild(stylesheet);

  const panel = createKlaraPanel(opt.routes ? { routes: opt.routes } : {});
  const knopf = g.document.getElementById("ask-btn");
  if (knopf === null) {
    throw new Error("Panel ohne #ask-btn");
  }
  const knopfVorStart = {
    disabled: knopf.disabled === true,
    title: knopf.title,
    text: norm(knopf.textContent),
    ariaLabel: norm(knopf.getAttribute("aria-label")),
  };
  // Die Startabrufe (Anmeldung, Status, Stand) abwarten — das ist der Ruhezustand, den ein Mensch
  // sieht, nachdem das Fenster „angekommen“ ist.
  await panel.flush();
  await panel.flush();

  const q = (selector: string): El | null => g.document.body.querySelector(selector);
  const el = (selector: string): El => {
    const e = q(selector);
    if (e === null) {
      throw new Error(`Ruhezustand: Stelle ${selector} existiert nicht`);
    }
    return e;
  };
  const sichtbar = (start: El | null): boolean => {
    let e = start;
    if (e === null) {
      return false;
    }
    while (e !== null && e !== g.document.body) {
      if (g.window.getComputedStyle(e).display === "none") {
        return false;
      }
      e = e.parentElement;
    }
    return true;
  };
  const karte = (innen: string): El => {
    const k = el(innen).closest(".card");
    if (k === null) {
      throw new Error(`${innen} liegt in keiner .card`);
    }
    return k;
  };

  if (opt.verfaelschbar?.includes(VERFAELSCHUNG) === true) {
    if (VERFAELSCHUNG === "reihenfolge") {
      // JOB 3017: die Karte steht jetzt VOR dem Begriffsbild — die Verfaelschung dreht es zurueck.
      const ka1 = el("#ka1-block");
      const frage = karte("#ask-input");
      el("#section-ask").insertBefore(ka1, frage);
    } else if (VERFAELSCHUNG === "reiter") {
      el("#tab-ask").setAttribute("class", "");
      el("#tab-capture").setAttribute("class", "active");
    } else if (VERFAELSCHUNG === "hauptaktion") {
      el("#ask-btn").setAttribute("class", "");
    } else if (VERFAELSCHUNG === "text-greet") {
      el("[data-t=greetBody]").textContent = "VERFAELSCHT — dieser Satz steht nicht im Produkt.";
    } else if (VERFAELSCHUNG === "text-hilfe") {
      el("[data-t=helpCan1]").textContent = "VERFAELSCHT — dieser Punkt steht nicht im Produkt.";
    } else if (VERFAELSCHUNG === "text-ka6") {
      el("#ka6-lead").textContent = "VERFAELSCHT — dieser Satz steht nicht im Produkt.";
    } else if (VERFAELSCHUNG === "text-platzhalter") {
      el("#ask-input").setAttribute("placeholder", "VERFAELSCHT — beliebiger anderer Platzhalter");
    } else if (ZIELBILD_VERFAELSCHUNGEN[VERFAELSCHUNG] === undefined) {
      throw new Error(`unbekannte Verfaelschung: ${VERFAELSCHUNG}`);
    }
  }

  let positionen: Map<El, number> | null = null;
  return {
    panel,
    el,
    q,
    alle: (selector) => Array.from(g.document.body.querySelectorAll(selector)),
    sichtbar,
    text: (selector) => norm(el(selector).textContent),
    t: (key, vars) => panel.t(key, vars),
    frageKarte: () => karte("#ask-input"),
    hilfeKarte: () => karte("[data-t=helpTitle]"),
    position: (e) => {
      if (positionen === null) {
        positionen = new Map(
          Array.from(g.document.body.querySelectorAll("*")).map((x, i) => [x, i] as const),
        );
      }
      return positionen.get(e) ?? -1;
    },
    knopfVorStart,
    abbauen: () => {
      panel.restore();
      g.document.head.removeChild(stylesheet);
    },
  };
}

// ------------------------------------------------------------------------------------------------
// LIEFERUNG 1 — DIE SOLLWERTTABELLE. Jede tragende Zusage aus Z.15-49, mit Quelle in der Vorlage.
// ------------------------------------------------------------------------------------------------
type Art = "struktur" | "text" | "darstellung";
type Quelle =
  | { stil: number; eigenschaft: string }
  | { text: "ganz" | "ohneLeerraum" }
  | { svgPfad: string; pathNr: number }
  | { svgAttr: { tag: SvgTag; nr: number; attr: string } }
  | { struktur: () => string; deckt?: string[] };
type Heute = "erfuellt" | "abweichend" | "abweichend (im Produkt nicht vorhanden)";

interface Zusage {
  kennung: string;
  zeile: number;
  art: Art;
  quelle: Quelle;
  /** Kanonisierter Sollwert — gepinnt, und in S1 gegen die gelesene Vorlage gehalten. */
  soll: string;
  /** Kennung/Selektor im Produkt, an dem gemessen wird (oder gemessen wuerde). */
  beleg: string;
  /** Messung am laufenden Fenster; fehlt bei Darstellungswerten (nicht messbar). */
  ist?: (r: Ruhezustand) => string;
  /** Das am 03.09.2026 GEMESSENE Urteil — die Erwartung ist das Gemessene. */
  heute?: Heute;
}

const rgb = (hex: string): string => hexZuRgb(hex).toLowerCase();

/** Darstellungswert: Sollwert aus dem Inline-Stil, im Produkt heute nicht ehrlich messbar. */
function darstellung(
  kennung: string,
  zeileNr: number,
  stil: number,
  eigenschaft: string,
  soll: string,
  beleg: string,
): Zusage {
  return {
    kennung,
    zeile: zeileNr,
    art: "darstellung",
    quelle: { stil, eigenschaft },
    soll,
    beleg,
  };
}

/**
 * SVG-Attribut der Vorlage (Groesse, Strichfarbe, Strichstaerke, Koerpergeometrie). Ein Attribut ist
 * am Markup lesbar, kein Rechenergebnis — deshalb `struktur`, mit Messung am laufenden Fenster.
 */
function svgZusage(
  kennung: string,
  zeileNr: number,
  tag: SvgTag,
  nr: number,
  attr: string,
  soll: string,
  beleg: string,
  symbol: (r: Ruhezustand) => El | null,
  heute: Heute = "erfuellt",
): Zusage {
  return {
    kennung,
    zeile: zeileNr,
    art: "struktur",
    quelle: { svgAttr: { tag, nr, attr } },
    soll,
    beleg,
    ist: (r) => {
      const s = symbol(r);
      const ziel = tag === "svg" ? s : (s?.querySelector(tag) ?? null);
      const wert = ziel === null ? null : kanon(ziel.getAttribute(attr));
      return wert ?? NICHT_VORHANDEN;
    },
    heute,
  };
}
/** Das Pfeil-Symbol im Senden-Knopf (Z.41) — seit JOB 3017 vorhanden. */
const pfeilSvg = (r: Ruhezustand): El | null => r.q("#ask-btn svg");
/** Das Schloss-Symbol der Fusszeile (Z.49) — seit JOB 3017 vorhanden. */
const schlossSvg = (r: Ruhezustand): El | null =>
  r.q('svg path[d^="M8 10V7a4"]')?.closest("svg") ?? null;
/**
 * Die Strichfarbe steht im Produkt NICHT als Literal am SVG (`stroke="currentColor"`, die Farbe
 * kommt vom Token ueber `color`) — am Markup ist deshalb nur das Wort lesbar, der Farbwert selbst
 * ist ein berechneter Stil (Chromium-Messung in tests/design/zielbild-schlankes-panel.test.ts).
 */
const STRICHFARBE_BELEG = "stroke=currentColor am Markup; Farbwert = berechneter Stil (Chromium)";

/** Der Chip/Reiter, den die Vorlage durch eine eigene Eigenschaft als aktiv markiert. */
function aktiverUnter(zeilen: number[], merkmal: string): string {
  const treffer = zeilen.filter((n) => stilWert(n, 0, merkmal) !== null);
  return treffer.length === 1 ? textDerZeile(treffer[0] ?? 0) : `uneindeutig (${treffer.length})`;
}

const HINWEISSATZ_Z44 =
  "Antworten kommen wörtlich aus freigegebenem Firmenwissen — mit Quellen. Markierst du Text in Word, wird die Markierung gefragt.";
const FUSSZEILENSATZ_Z48 = "Nur freigegebenes Wissen · nichts verlässt den Server";

/** Sichtbare direkte Kinder von #section-ask — die „Dinge“ im Inhalt. */
function inhaltsFlaechen(r: Ruhezustand): El[] {
  return Array.from(r.el("#section-ask").children).filter((k) => r.sichtbar(k));
}
const ZUSAGEN: readonly Zusage[] = [
  // — Z.15 Artboard —
  darstellung("Z.15 Artboard Breite", 15, 0, "width", "360px", "body"),
  darstellung("Z.15 Artboard Mindesthoehe", 15, 0, "min-height", "720px", "body"),
  darstellung("Z.15 Grund", 15, 0, "background", rgb("#FAF8F5"), "body"),
  darstellung("Z.15 Textfarbe", 15, 0, "color", rgb("#1A2233"), "body"),
  // — Z.17-30 Kopfband —
  {
    kennung: "Z.17 Kopfband vorhanden",
    zeile: 17,
    art: "struktur",
    quelle: { struktur: () => (stilWert(17, 0, "background") !== null ? "vorhanden" : "fehlt") },
    soll: "vorhanden",
    beleg: "header",
    ist: (r) => (r.sichtbar(r.el("header")) ? "vorhanden" : NICHT_VORHANDEN),
    heute: "erfuellt",
  },
  darstellung("Z.17 Kopfband Grund", 17, 0, "background", rgb("#0E1626"), "header"),
  darstellung("Z.17 Kopfband Textfarbe", 17, 0, "color", rgb("#FAF8F5"), "header"),
  darstellung("Z.17 Kopfband Innenabstand", 17, 0, "padding", "12px 16px 10px", "header"),
  darstellung("Z.17 Kopfband Zeilenabstand", 17, 0, "gap", "6px", "header"),
  {
    kennung: "Z.19 Marke Wortlaut",
    zeile: 19,
    art: "text",
    quelle: { text: "ohneLeerraum" },
    soll: "KlaraKLARWERK",
    beleg: ".brand (Leerraum zwischen Marke und Untertitel ist Darstellung: margin-left)",
    ist: (r) => r.text(".brand").replace(/\s+/g, ""),
    heute: "erfuellt",
  },
  darstellung("Z.19 Marke Schriftgrad", 19, 0, "font-size", "16px", ".brand"),
  darstellung("Z.19 Marke Schriftgewicht", 19, 0, "font-weight", "650", ".brand"),
  darstellung("Z.19 Marke Laufweite", 19, 0, "letter-spacing", "0.2px", ".brand"),
  darstellung("Z.19 Untertitel Schriftgrad", 19, 1, "font-size", "10px", ".brand small"),
  darstellung("Z.19 Untertitel Schriftgewicht", 19, 1, "font-weight", "500", ".brand small"),
  darstellung("Z.19 Untertitel Farbe", 19, 1, "color", rgb("#7E879A"), ".brand small"),
  darstellung("Z.19 Untertitel Laufweite", 19, 1, "letter-spacing", "1.2px", ".brand small"),
  darstellung("Z.20 Sprachchips Abstand", 20, 0, "gap", "2px", ".lang"),
  {
    kennung: "Z.21 Sprachchip DE Wortlaut",
    zeile: 21,
    art: "text",
    quelle: { text: "ganz" },
    soll: "DE",
    beleg: "#lang-de",
    ist: (r) => r.text("#lang-de"),
    heute: "erfuellt",
  },
  {
    kennung: "Z.22 Sprachchip EN Wortlaut",
    zeile: 22,
    art: "text",
    quelle: { text: "ganz" },
    soll: "EN",
    beleg: "#lang-en",
    ist: (r) => r.text("#lang-en"),
    heute: "erfuellt",
  },
  {
    kennung: "Z.23 Sprachchip NL Wortlaut",
    zeile: 23,
    art: "text",
    quelle: { text: "ganz" },
    soll: "NL",
    beleg: "#lang-nl",
    ist: (r) => r.text("#lang-nl"),
    heute: "erfuellt",
  },
  {
    kennung: "Z.21 aktiver Sprachchip",
    zeile: 21,
    art: "struktur",
    // Die Vorlage markiert den aktiven Chip durch einen eigenen Grund (Z.21) — die anderen haben keinen.
    quelle: { struktur: () => aktiverUnter([21, 22, 23], "background") },
    soll: "DE",
    beleg: ".lang button.active",
    ist: (r) => r.text(".lang button.active"),
    heute: "erfuellt",
  },
  darstellung("Z.21 Chip Schriftgrad", 21, 0, "font-size", "11px", ".lang button"),
  darstellung("Z.21 Chip Innenabstand", 21, 0, "padding", "3px 7px", ".lang button"),
  darstellung("Z.21 Chip Radius", 21, 0, "border-radius", "6px", ".lang button"),
  darstellung(
    "Z.21 aktiver Chip Grund",
    21,
    0,
    "background",
    rgb("#FAF8F5"),
    ".lang button.active",
  ),
  darstellung("Z.21 aktiver Chip Textfarbe", 21, 0, "color", rgb("#0E1626"), ".lang button.active"),
  darstellung(
    "Z.21 aktiver Chip Schriftgewicht",
    21,
    0,
    "font-weight",
    "600",
    ".lang button.active",
  ),
  darstellung("Z.22 inaktiver Chip Farbe", 22, 0, "color", rgb("#7E879A"), ".lang button"),
  darstellung("Z.22 Chip EN Schriftgrad", 22, 0, "font-size", "11px", "#lang-en"),
  darstellung("Z.22 Chip EN Innenabstand", 22, 0, "padding", "3px 7px", "#lang-en"),
  darstellung("Z.22 Chip EN Radius", 22, 0, "border-radius", "6px", "#lang-en"),
  darstellung("Z.23 Chip NL Schriftgrad", 23, 0, "font-size", "11px", "#lang-nl"),
  darstellung("Z.23 Chip NL Innenabstand", 23, 0, "padding", "3px 7px", "#lang-nl"),
  darstellung("Z.23 Chip NL Radius", 23, 0, "border-radius", "6px", "#lang-nl"),
  darstellung("Z.23 Chip NL Farbe", 23, 0, "color", rgb("#7E879A"), "#lang-nl"),
  {
    kennung: "Z.27 Anmeldezeile im Kopfband",
    zeile: 27,
    art: "struktur",
    // Der Name ist Beispieldatum der Vorlage; die Zusage ist die Zeile „Angemeldet als …“ IM Kopfband.
    quelle: {
      struktur: () =>
        textDerZeile(27).startsWith("Angemeldet als")
          ? "Zeile „Angemeldet als …“ im Kopfband"
          : "fehlt",
      deckt: ["Z.27:text"],
    },
    soll: "Zeile „Angemeldet als …“ im Kopfband",
    beleg: "#kw-anmeldung im header (JOB 3017: Spiegel von #session-status, Schluessel sessionOk)",
    ist: (r) => {
      const praefix = r.t("sessionOk", { name: "" }).replace(/[\s.]+$/, "");
      const imKopf = r
        .alle("header *")
        .some((e) => r.sichtbar(e) && norm(e.textContent).startsWith(praefix));
      if (imKopf) {
        return "Zeile „Angemeldet als …“ im Kopfband";
      }
      return `im Kopfband nicht vorhanden; sinngleich in #session-status: „${r.text("#session-status")}"`;
    },
    heute: "erfuellt",
  },
  darstellung("Z.27 Anmeldezeile Schriftgrad", 27, 0, "font-size", "11px", "header"),
  darstellung("Z.27 Anmeldezeile Farbe", 27, 0, "color", rgb("#7E879A"), "header"),
  {
    kennung: "Z.28 Zeitstempel im Kopfband",
    zeile: 28,
    art: "struktur",
    quelle: {
      struktur: () =>
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z$/.test(textDerZeile(28))
          ? "vorhanden (Muster JJJJ-MM-TT hh:mmZ)"
          : "fehlt",
      deckt: ["Z.28:text"],
    },
    soll: "vorhanden (Muster JJJJ-MM-TT hh:mmZ)",
    beleg: "header (an dieser Stelle steht heute #kw-stand-kopf mit dem Auslieferungsstand)",
    ist: (r) =>
      /\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z/.test(norm(r.el("header").textContent))
        ? "vorhanden (Muster JJJJ-MM-TT hh:mmZ)"
        : `${NICHT_VORHANDEN} (rechts im Kopfband: #kw-stand-kopf „${r.text("#kw-stand-kopf")}")`,
    heute: "abweichend (im Produkt nicht vorhanden)",
  },
  darstellung("Z.28 Zeitstempel Schriftgrad", 28, 0, "font-size", "10px", "header"),
  darstellung("Z.28 Zeitstempel Farbe", 28, 0, "color", rgb("#7E879A"), "header"),
  // — Z.32-35 Reiterleiste —
  {
    kennung: "Z.32 Reiterleiste vorhanden",
    zeile: 32,
    art: "struktur",
    quelle: { struktur: () => (stilWert(32, 0, "border-bottom") !== null ? "vorhanden" : "fehlt") },
    soll: "vorhanden",
    beleg: ".tabs",
    ist: (r) => (r.sichtbar(r.el(".tabs")) ? "vorhanden" : NICHT_VORHANDEN),
    heute: "erfuellt",
  },
  darstellung(
    "Z.32 Reiterleiste Unterkante",
    32,
    0,
    "border-bottom",
    `1px solid ${rgb("#E9E5DE")}`,
    ".tabs",
  ),
  darstellung("Z.32 Reiterleiste Grund", 32, 0, "background", rgb("#FFFFFF"), ".tabs"),
  {
    kennung: "Z.33 Reiter Fragen Wortlaut",
    zeile: 33,
    art: "text",
    quelle: { text: "ganz" },
    soll: "Fragen",
    beleg: "#tab-ask",
    ist: (r) => r.text("#tab-ask"),
    heute: "erfuellt",
  },
  {
    kennung: "Z.33 aktiver Reiter",
    zeile: 33,
    art: "struktur",
    quelle: { struktur: () => aktiverUnter([33, 34], "border-bottom") },
    soll: "Fragen",
    beleg: ".tabs button.active",
    ist: (r) => r.text(".tabs button.active"),
    heute: "erfuellt",
  },
  darstellung("Z.33 aktiver Reiter Schriftgrad", 33, 0, "font-size", "13px", ".tabs button"),
  darstellung(
    "Z.33 aktiver Reiter Schriftgewicht",
    33,
    0,
    "font-weight",
    "600",
    ".tabs button.active",
  ),
  darstellung("Z.33 aktiver Reiter Farbe", 33, 0, "color", rgb("#9C5009"), ".tabs button.active"),
  darstellung(
    "Z.33 aktiver Reiter Unterstrich",
    33,
    0,
    "border-bottom",
    `2px solid ${rgb("#E8630A")}`,
    ".tabs button.active",
  ),
  darstellung("Z.33 Reiter Innenabstand", 33, 0, "padding", "11px 0 9px", ".tabs button"),
  darstellung("Z.33 Reiter zentriert", 33, 0, "text-align", "center", ".tabs button"),
  {
    kennung: "Z.34 Reiter Wissen erfassen Wortlaut",
    zeile: 34,
    art: "text",
    quelle: { text: "ganz" },
    soll: "Wissen erfassen",
    beleg: "#tab-capture",
    ist: (r) => r.text("#tab-capture"),
    heute: "erfuellt",
  },
  darstellung("Z.34 inaktiver Reiter Schriftgrad", 34, 0, "font-size", "13px", ".tabs button"),
  darstellung("Z.34 inaktiver Reiter Farbe", 34, 0, "color", rgb("#525B6B"), ".tabs button"),
  darstellung("Z.34 inaktiver Reiter Innenabstand", 34, 0, "padding", "11px 0 9px", ".tabs button"),
  darstellung("Z.34 inaktiver Reiter zentriert", 34, 0, "text-align", "center", ".tabs button"),
  // — Z.37-45 Inhalt —
  {
    kennung: "Z.37 Inhalt: Anzahl sichtbarer Flaechen",
    zeile: 37,
    art: "struktur",
    quelle: { struktur: () => String(direkteKindZeilen(38, 44, 4).length) },
    soll: "2",
    beleg: "#section-ask > * (sichtbar)",
    ist: (r) => {
      const fl = inhaltsFlaechen(r);
      return `${fl.length} (${fl.map((e) => (e.id ? `#${e.id}` : "div.card ohne Kennung")).join(", ")})`;
    },
    heute: "abweichend",
  },
  darstellung("Z.37 Inhalt Innenabstand", 37, 0, "padding", "28px 16px 16px", "#section-ask"),
  darstellung("Z.37 Inhalt Zeilenabstand", 37, 0, "gap", "14px", "#section-ask"),
  {
    kennung: "Z.38 Frage-Karte vorhanden",
    zeile: 38,
    art: "struktur",
    quelle: { struktur: () => (stilWert(38, 0, "border-radius") !== null ? "vorhanden" : "fehlt") },
    soll: "vorhanden",
    beleg:
      "die .card, die #ask-input umschliesst — seit JOB 3004 mit Kennung #ask-karte (werte.ts trifft sie jetzt); JOB 3017 baut die Karte auf Feld + rundem Sende-Pfeil um",
    ist: (r) => (r.sichtbar(r.frageKarte()) ? "vorhanden" : NICHT_VORHANDEN),
    heute: "erfuellt",
  },
  {
    kennung: "Z.38 Frage-Karte an erster Stelle im Inhalt",
    zeile: 38,
    art: "struktur",
    quelle: {
      struktur: () => (direkteKindZeilen(38, 44, 4)[0] === 38 ? "erste Flaeche" : "nicht erste"),
    },
    soll: "erste Flaeche",
    beleg: "#section-ask > * (sichtbar), Dokumentordnung",
    ist: (r) => {
      const fl = inhaltsFlaechen(r);
      const i = fl.indexOf(r.frageKarte());
      if (i === 0) {
        return "erste Flaeche";
      }
      return `${i + 1}. Flaeche (davor: ${fl
        .slice(0, i)
        .map((e) => `#${e.id}`)
        .join(", ")})`;
    },
    heute: "erfuellt",
  },
  darstellung("Z.38 Frage-Karte Grund", 38, 0, "background", rgb("#FFFFFF"), ".card"),
  darstellung("Z.38 Frage-Karte Rahmen", 38, 0, "border", `1px solid ${rgb("#E9E5DE")}`, ".card"),
  darstellung("Z.38 Frage-Karte Radius", 38, 0, "border-radius", "12px", ".card"),
  darstellung(
    "Z.38 Frage-Karte Schatten",
    38,
    0,
    "box-shadow",
    "0 1px 2px rgba(14, 22, 38, 0.05), 0 8px 24px -12px rgba(14, 22, 38, 0.12)",
    ".card",
  ),
  {
    kennung: "Z.39 Platzhalter des Eingabefelds",
    zeile: 39,
    art: "text",
    quelle: { text: "ganz" },
    soll: "Frage zu Ihrem Unternehmen",
    beleg:
      "#ask-input[placeholder] — der heutige Wortlaut ist in R2 (TEXTTRAEGER_SICHTBAR) gepinnt",
    ist: (r) => norm(r.el("#ask-input").placeholder),
    heute: "abweichend",
  },
  darstellung(
    "Z.39 Eingabefeld Innenabstand",
    39,
    0,
    "padding",
    "14px 52px 40px 14px",
    "#ask-input",
  ),
  darstellung("Z.39 Eingabefeld Schriftgrad", 39, 0, "font-size", "15px", "#ask-input"),
  darstellung("Z.39 Eingabefeld Zeilenhoehe", 39, 0, "line-height", "1.45", "#ask-input"),
  darstellung(
    "Z.39 Eingabefeld Platzhalterfarbe",
    39,
    0,
    "color",
    rgb("#525B6B"),
    "#ask-input::placeholder",
  ),
  darstellung(
    "Z.39 Eingabefeld Mindesthoehe",
    39,
    0,
    "min-height",
    "96px",
    "#ask-input (heute rows=3)",
  ),
  {
    kennung: "Z.40 Senden-Knopf in der Frage-Karte",
    zeile: 40,
    art: "struktur",
    quelle: { struktur: () => (einzug(40) > einzug(38) ? "in der Karte" : "ausserhalb") },
    soll: "in der Karte",
    beleg:
      "#ask-btn ist Nachfahre der Frage-Karte, Geschwister NACH #ask-input; die Ueberlagerung rechts unten (Z.40 position/right/bottom) ist Darstellung",
    ist: (r) => (r.frageKarte().contains(r.el("#ask-btn")) ? "in der Karte" : "ausserhalb"),
    heute: "erfuellt",
  },
  {
    kennung: "Z.40 Senden-Knopf ohne Wortlaut",
    zeile: 40,
    art: "struktur",
    quelle: {
      struktur: () =>
        [40, 41, 42].map(textDerZeile).join("") === "" ? "ohne Wortlaut" : "mit Wortlaut",
    },
    soll: "ohne Wortlaut",
    beleg: "#ask-btn (JOB 3017: askCta ist das aria-label, kein Textknoten)",
    ist: (r) => {
      const wort = r.text("#ask-btn");
      return wort === "" ? "ohne Wortlaut" : `Wortlaut „${wort}" (askCta)`;
    },
    heute: "erfuellt",
  },
  darstellung("Z.40 Senden-Knopf Lage rechts", 40, 0, "right", "10px", "#ask-btn"),
  darstellung("Z.40 Senden-Knopf Lage unten", 40, 0, "bottom", "10px", "#ask-btn"),
  darstellung("Z.40 Senden-Knopf Breite", 40, 0, "width", "34px", "#ask-btn"),
  darstellung("Z.40 Senden-Knopf Hoehe", 40, 0, "height", "34px", "#ask-btn"),
  darstellung("Z.40 Senden-Knopf rund", 40, 0, "border-radius", "50%", "#ask-btn"),
  darstellung("Z.40 Senden-Knopf Grund", 40, 0, "background", rgb("#C2500A"), "#ask-btn"),
  {
    kennung: "Z.41 Pfeil-Symbol im Senden-Knopf",
    zeile: 41,
    art: "struktur",
    quelle: { svgPfad: "M12 19V5", pathNr: 0 },
    soll: "M12 19V5",
    beleg: '#ask-btn svg path[d^="M12 19V5"]',
    ist: (r) => (r.q('#ask-btn svg path[d^="M12 19V5"]') !== null ? "M12 19V5" : NICHT_VORHANDEN),
    heute: "erfuellt",
  },
  {
    kennung: "Z.41 Pfeil-Spitze im Senden-Knopf",
    zeile: 41,
    art: "struktur",
    quelle: { svgPfad: "M5 12l7-7 7 7", pathNr: 1 },
    soll: "M5 12l7-7 7 7",
    beleg: '#ask-btn svg path[d^="M5 12l7-7"]',
    ist: (r) =>
      r.q('#ask-btn svg path[d^="M5 12l7-7"]') !== null ? "M5 12l7-7 7 7" : NICHT_VORHANDEN,
    heute: "erfuellt",
  },
  svgZusage("Z.41 Pfeil Breite", 41, "svg", 0, "width", "18", "#ask-btn svg[width]", pfeilSvg),
  svgZusage("Z.41 Pfeil Hoehe", 41, "svg", 0, "height", "18", "#ask-btn svg[height]", pfeilSvg),
  svgZusage(
    "Z.41 Pfeil Strichfarbe",
    41,
    "svg",
    0,
    "stroke",
    rgb("#FFFFFF"),
    `#ask-btn svg[stroke] — ${STRICHFARBE_BELEG}`,
    pfeilSvg,
    "abweichend",
  ),
  svgZusage(
    "Z.41 Pfeil Strichstaerke",
    41,
    "svg",
    0,
    "stroke-width",
    "2.2",
    "#ask-btn svg[stroke-width]",
    pfeilSvg,
  ),
  {
    kennung: "Z.44 Hinweissatz unter der Karte",
    zeile: 44,
    art: "text",
    quelle: { text: "ganz" },
    soll: HINWEISSATZ_Z44,
    beleg:
      "#ask-review-notice (JOB 3017: der EINE Satz unter der Karte — askHint und Pruefhinweis zusammengefuehrt; „validiertes KLARWERK-Wissen“ statt „freigegebenes Firmenwissen“)",
    ist: (r) => {
      const satz = r.q("#ask-review-notice");
      return satz !== null && r.sichtbar(satz) ? norm(satz.textContent) : NICHT_VORHANDEN;
    },
    heute: "abweichend",
  },
  darstellung("Z.44 Hinweissatz Schriftgrad", 44, 0, "font-size", "12px", "(kein Traeger)"),
  darstellung("Z.44 Hinweissatz Zeilenhoehe", 44, 0, "line-height", "1.5", "(kein Traeger)"),
  darstellung("Z.44 Hinweissatz Farbe", 44, 0, "color", rgb("#525B6B"), "(kein Traeger)"),
  darstellung("Z.44 Hinweissatz Innenabstand", 44, 0, "padding", "0 2px", "(kein Traeger)"),
  // — Z.47-50 Fusszeile —
  {
    kennung: "Z.47 Fusszeile vorhanden",
    zeile: 47,
    art: "struktur",
    quelle: { struktur: () => (stilWert(47, 0, "border-top") !== null ? "vorhanden" : "fehlt") },
    soll: "vorhanden",
    beleg: "#kw-fuss (JOB 3017: Band mit #ask-rule-note und Schloss, letzte Flaeche des Rumpfs)",
    ist: (r) => {
      const band = r.q("#kw-fuss");
      const schloss = r.q('#kw-fuss svg path[d^="M8 10V7a4"]') !== null;
      return band !== null && r.sichtbar(band) && schloss ? "vorhanden" : NICHT_VORHANDEN;
    },
    heute: "erfuellt",
  },
  darstellung("Z.47 Fusszeile Innenabstand", 47, 0, "padding", "12px 16px", "(kein Traeger)"),
  darstellung(
    "Z.47 Fusszeile Oberkante",
    47,
    0,
    "border-top",
    `1px solid ${rgb("#E9E5DE")}`,
    "(kein Traeger)",
  ),
  {
    kennung: "Z.48 Fusszeilensatz",
    zeile: 48,
    art: "text",
    quelle: { text: "ganz" },
    soll: FUSSZEILENSATZ_Z48,
    beleg:
      "#kw-fuss #ask-rule-note (JOB 3017: der Leitsatz aus askRuleNote; der Halbsatz ueber den Serverstandort bleibt draussen — Betriebszusage, mega77 Block B, Fall F1)",
    ist: (r) => {
      const satz = r.q("#kw-fuss #ask-rule-note");
      return satz !== null && r.sichtbar(satz) ? norm(satz.textContent) : NICHT_VORHANDEN;
    },
    heute: "abweichend",
  },
  darstellung("Z.48 Fusszeilensatz Schriftgrad", 48, 0, "font-size", "11px", "(kein Traeger)"),
  darstellung("Z.48 Fusszeilensatz Farbe", 48, 0, "color", rgb("#525B6B"), "(kein Traeger)"),
  {
    kennung: "Z.49 Schloss-Symbol",
    zeile: 49,
    art: "struktur",
    quelle: { svgPfad: "M8 10V7a4 4 0 0 1 8 0v3", pathNr: 0 },
    soll: "M8 10V7a4 4 0 0 1 8 0v3",
    beleg: 'svg path[d^="M8 10V7a4"]',
    ist: (r) =>
      r.q('svg path[d^="M8 10V7a4"]') !== null ? "M8 10V7a4 4 0 0 1 8 0v3" : NICHT_VORHANDEN,
    heute: "erfuellt",
  },
  svgZusage(
    "Z.49 Schloss Breite",
    49,
    "svg",
    0,
    "width",
    "14",
    "svg[width] am Schloss",
    schlossSvg,
  ),
  svgZusage(
    "Z.49 Schloss Hoehe",
    49,
    "svg",
    0,
    "height",
    "14",
    "svg[height] am Schloss",
    schlossSvg,
  ),
  svgZusage(
    "Z.49 Schloss Strichfarbe",
    49,
    "svg",
    0,
    "stroke",
    rgb("#116B3C"),
    `svg[stroke] am Schloss — ${STRICHFARBE_BELEG} (werte.ts misst stattdessen #kw-fuss color)`,
    schlossSvg,
    "abweichend",
  ),
  svgZusage(
    "Z.49 Schloss Strichstaerke",
    49,
    "svg",
    0,
    "stroke-width",
    "2",
    "svg[stroke-width] am Schloss",
    schlossSvg,
  ),
  {
    kennung: "Z.49 Schloss-Koerper (rect)",
    zeile: 49,
    art: "struktur",
    quelle: {
      struktur: () => (svgTagAttribute(49, "rect", 0) ?? []).map(([k, v]) => `${k}=${v}`).join(" "),
      deckt: [
        "Z.49/rect0:x",
        "Z.49/rect0:y",
        "Z.49/rect0:width",
        "Z.49/rect0:height",
        "Z.49/rect0:rx",
      ],
    },
    soll: "x=4 y=10 width=16 height=10 rx=2",
    beleg: "svg rect am Schloss",
    ist: (r) => {
      const rect = schlossSvg(r)?.querySelector("rect") ?? null;
      if (rect === null) {
        return NICHT_VORHANDEN;
      }
      return ["x", "y", "width", "height", "rx"]
        .map((k) => `${k}=${rect.getAttribute(k)}`)
        .join(" ");
    },
    heute: "erfuellt",
  },
];

/**
 * Bewusst NICHT aufgenommen — je Eigenschaft, mit fachlicher Begruendung, nicht stillschweigend.
 * `eigenschaften` sind CSS-Eigenschaften bzw. SVG-Attribute; sie gelten fuer die genannten Zeilen.
 */
const NICHT_AUFGENOMMEN: readonly {
  was: string;
  zeilen: number[];
  eigenschaften: string[];
  grund: string;
}[] = [
  {
    was: "font-family (Systemschrift-Stack)",
    zeilen: [11],
    eigenschaften: ["font-family"],
    grund: "ausserhalb Z.15-49; ein Stack ohne festen Wert, den erst der Rechner aufloest.",
  },
  {
    was: "Link-Farben a / a:hover",
    zeilen: [12],
    eigenschaften: ["color"],
    grund: "ausserhalb Z.15-49; im Ruhezustand ist kein Link sichtbar.",
  },
  {
    was: "Layout-Mechanik",
    zeilen: [15, 17, 18, 20, 26, 32, 33, 34, 37, 38, 40, 47],
    eigenschaften: [
      "display",
      "flex",
      "flex-direction",
      "flex-grow",
      "align-items",
      "justify-content",
      "position",
    ],
    grund:
      "Bauweise, kein sichtbarer Wert; ihr ERGEBNIS (Lage, Masse) rechnet erst der Browser — JOB 3004.",
  },
  {
    was: "SVG-Zeichentechnik",
    zeilen: [41, 49],
    eigenschaften: ["viewBox", "fill", "stroke-linecap", "stroke-linejoin"],
    grund:
      "technische Zeichenattribute ohne eigene Gestaltzusage (Koordinatenraum, keine Fuellung, Linienenden); sie folgen dem Pfad, der als Zusage steht.",
  },
  {
    was: "Beispieldaten „Peter Kohnert“ und „2026-08-27 15:37Z“",
    zeilen: [27, 28],
    eigenschaften: [],
    grund:
      "die Werte sind Beispiele; die Zusage ist die Zeile bzw. das Muster (als solche aufgenommen — hier nur der Hinweis).",
  },
];

/** Der Sollwert, so wie er JETZT aus der Vorlage gelesen und kanonisiert wird. */
function ausVorlage(z: Zusage): string | null {
  const q = z.quelle;
  if ("stil" in q) {
    return kanon(stilWert(z.zeile, q.stil, q.eigenschaft));
  }
  if ("text" in q) {
    const t = textDerZeile(z.zeile);
    return q.text === "ohneLeerraum" ? t.replace(/\s+/g, "") : t;
  }
  if ("svgPfad" in q) {
    const d = svgAttrDerZeile(z.zeile, "path", q.pathNr, "d");
    return d === q.svgPfad ? svgPfadDerZeile(z.zeile, q.svgPfad) : null;
  }
  if ("svgAttr" in q) {
    return kanon(svgAttrDerZeile(z.zeile, q.svgAttr.tag, q.svgAttr.nr, q.svgAttr.attr));
  }
  return q.struktur();
}

/** Die Deckungsschluessel einer Zusage: `Z.n/stil0:padding`, `Z.n/svg0:width`, `Z.n:text` … */
function deckungsSchluessel(z: Zusage): string[] {
  const q = z.quelle;
  if ("stil" in q) {
    return [`Z.${z.zeile}/stil${q.stil}:${q.eigenschaft}`];
  }
  if ("text" in q) {
    return [`Z.${z.zeile}:text`];
  }
  if ("svgPfad" in q) {
    return [`Z.${z.zeile}/path${q.pathNr}:d`];
  }
  if ("svgAttr" in q) {
    return [`Z.${z.zeile}/${q.svgAttr.tag}${q.svgAttr.nr}:${q.svgAttr.attr}`];
  }
  return q.deckt ?? [];
}

/** Alles, was die Vorlage in Z.15-49 deklariert: jede Inline-Eigenschaft, jedes SVG-Attribut, jeder Text. */
function verlangteSchluessel(): string[] {
  const raus: string[] = [];
  for (let n = 15; n <= 49; n += 1) {
    stile(n).forEach((stil, i) => {
      for (const p of eigenschaftenVon(stil)) {
        raus.push(`Z.${n}/stil${i}:${p}`);
      }
    });
    for (const tag of ["svg", "path", "rect"] as const) {
      for (let nr = 0; ; nr += 1) {
        const paare = svgTagAttribute(n, tag, nr);
        if (paare === null) {
          break;
        }
        for (const [attr] of paare) {
          raus.push(`Z.${n}/${tag}${nr}:${attr}`);
        }
      }
    }
    if (textDerZeile(n) !== "") {
      raus.push(`Z.${n}:text`);
    }
  }
  return raus;
}

function begruendetAusgelassen(schluessel: string): boolean {
  const m = /^Z\.(\d+)\/[a-z]+\d+:(.+)$/.exec(schluessel);
  if (m === null) {
    return false;
  }
  const n = Number(m[1]);
  const p = m[2] ?? "";
  return NICHT_AUFGENOMMEN.some((a) => a.zeilen.includes(n) && a.eigenschaften.includes(p));
}

function urteil(z: Zusage, ist: string | undefined): string {
  if (z.art === "darstellung") {
    return NICHT_MESSBAR;
  }
  if (ist === undefined) {
    throw new Error(`${z.kennung}: messbare Zusage ohne Messung`);
  }
  if (ist.startsWith(NICHT_VORHANDEN)) {
    return "abweichend (im Produkt nicht vorhanden)";
  }
  return ist === z.soll ? "erfuellt" : "abweichend";
}

// ------------------------------------------------------------------------------------------------
// LIEFERUNG 4 — DIE VERLUSTLISTE, UMGEKEHRT GELESEN: was der Ruhezustand heute zeigt und das
// Zielbild nicht kennt. Der Test haelt die Traeger fest, damit ein Umbau sie nicht unbemerkt faellt.
// ------------------------------------------------------------------------------------------------
interface Traeger {
  kennung: string;
  finden: (r: Ruhezustand) => El | null;
  /** Gemessen am 03.09.2026 im Ruhezustand der Fixture (angemeldet, Office da, kein Word.run). */
  sichtbar: boolean;
  platzImZielbild: string | null;
  verlust: string;
  begruendetIn: string;
}

const TRAEGER: readonly Traeger[] = [
  {
    kennung: "#klara-trust-head (Vertrauenskopf: #klara-trust-mode, #klara-trust-detail)",
    finden: (r) => r.q("#klara-trust-head"),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "die dauerhafte Auskunft „arbeitet in KLARWERK eine KI?“ und die Eigenschaft von Klaras Antwortweg (ohne Modell) verschwinden aus dem Kopf.",
    begruendetIn:
      "taskpane.html:370-382 (AUFTRAG-W1-VERTRAUENSKOPF-08 BLOCK A), :546-553 (KW-S4-01 §2 „immer ganz oben im Kopf“); Ort gepinnt in tests/app/w1-klara-vertrauenskopf.test.ts",
  },
  {
    kennung: "#klara-s4 (Sitzungsblock: Etikett, Modus-Pille, Anbieter, Sitzung, Abweichung)",
    finden: (r) => r.q("#klara-s4"),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "Sitzungs-, Zustimmungs- und Sperrstand dieser Klara-Sitzung sind nirgends mehr sichtbar; der Sperrgrund haette keinen Ort.",
    begruendetIn:
      "taskpane.html:384-397 (AUFTRAG-W1-KLARA-KOPF-CONSENT-06), :402-406 (JOB 2621 §2); tests/app/job2621-panel-wahrheiten.test.ts W1/W2",
  },
  {
    kennung:
      "#kw-stand-kopf (Auslieferungsstand im Kopfband — seit JOB 3017 GENAU EINMAL, Fall D1)",
    finden: (r) => r.q("#kw-stand-kopf"),
    sichtbar: true,
    platzImZielbild:
      "Z.28 rechts in der zweiten Kopfzeile: dort ein Zeitstempel (Datum + Uhrzeit), der Auslieferungsstand ist Datum + Kuerzel",
    verlust:
      "Pedi hat den Stand oben rechts gesucht (Befund 1, 26.08.); ohne Spiegel bleibt nur #kw-stand ganz unten.",
    begruendetIn:
      "taskpane.html <header> (JOB 2621 §3, JOB 3017 D4 #kw-kopf-zeile); tests/app/job2621-panel-wahrheiten.test.ts W3",
  },
  {
    kennung: "#kw-anmeldung (Anmeldezeile im Kopfband, Spiegel von #session-status)",
    finden: (r) => r.q("#kw-anmeldung"),
    sichtbar: true,
    platzImZielbild: "Z.27 „Angemeldet als …“ — genau diese Zeile",
    verlust: "keiner; die Zeile ist die Zielbild-Zeile (JOB 3017 D4).",
    begruendetIn: "taskpane.html renderKopfAnmeldung (checkSession/setSessionWarn)",
  },
  {
    kennung: "#session-card (Begruessung greetTitle/greetBody, #session-status, #login-block)",
    finden: (r) => r.q("#session-card"),
    sichtbar: true,
    platzImZielbild:
      "Z.27 „Angemeldet als …“ im Kopfband nimmt die Anmeldeauskunft (#session-status) auf; Begruessung und Login-Knopf haben keinen Platz",
    verlust:
      "der Anmeldeweg des Panels (#login-btn, Warten abbrechen, Kontext-Hinweis) wohnt in dieser Karte — ohne sie gibt es im Fenster keinen Weg zur Anmeldung.",
    begruendetIn: "taskpane.html:457-470 (WP-KLARA-1c), :3346-3382 (checkSession)",
  },
  {
    kennung: "#ka1-block (Dokument-Begriffsbild: ka1Title, ka1Hint, #ka1-terms, #ka1-empty)",
    finden: (r) => r.q("#ka1-block"),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "„Worum es hier geht“ — die hausinterne, KI-freie Begriffsliste des offenen Dokuments faellt weg.",
    begruendetIn: "taskpane.html:484-493 (KW-KA1-TERMS-START, JOB 1149, OFFEN.md KA1)",
  },
  {
    kennung: "#ask-input[aria-label] (frueher [data-t=askTitle], Ueberschrift der Frage-Karte)",
    finden: (r) => r.q("#ask-input"),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "JOB 3017: die Ueberschrift ist vom Bild verschwunden; askTitle ist der zugaengliche Name des Felds (aria-label), der aktive Reiter „Fragen“ traegt die Funktion sichtbar.",
    begruendetIn: "taskpane.html renderStatics (aria-label askTitle)",
  },
  {
    kennung:
      "#ask-source-note (Herkunftszeile: „Gefragt wird: …“, im Ruhezustand leer UND verborgen)",
    finden: (r) => r.q("#ask-source-note"),
    sichtbar: false,
    platzImZielbild: null,
    verlust:
      "keiner: die Zeile bleibt in der Karte und erscheint, sobald sie Inhalt hat (JOB 3017: zustandsgebunden statt leer sichtbar) — der Befund von mega74 Teil 2b bleibt geschlossen.",
    begruendetIn: "taskpane.html #ask-karte (AUFTRAG-mega74 TEIL 2b), updateAskSourceNote",
  },
  {
    kennung:
      "#ask-review-notice (der EINE Satz unter der Karte: woertlich aus validiertem Wissen, Markierung, Pruefauftrag)",
    finden: (r) => r.q("#ask-review-notice"),
    sichtbar: true,
    platzImZielbild: "Z.44 — genau dieser Satz (Wortlaut abweichend, s. A1)",
    verlust:
      "JOB 3017: askHint ist hier aufgegangen; der Halbsatz „Ohne Markierung kannst du unten frei fragen“ ist entfallen (das Feld und sein Platzhalter sagen es).",
    begruendetIn:
      "taskpane.html #section-ask (mega61 Block E, mega81 BLOCK A, JOB 3017 D4); tests/legal/mega61-ki-satz.test.ts",
  },
  {
    kennung:
      "#ask-ai-notice (KI-Kennzeichnung, an das aiGenerated-Signal gebunden; heute verborgen)",
    finden: (r) => r.q("#ask-ai-notice"),
    sichtbar: false,
    platzImZielbild: null,
    verlust:
      "die Kennzeichnung, die von selbst sichtbar wird, sobald diese Flaeche einmal einen Modellweg zeigt, haette keinen Traeger mehr.",
    begruendetIn:
      "taskpane.html:509-524 (mega81 BLOCK A); tests/app/g24-ki-kennzeichnung-laufzeitpruefung.test.ts",
  },
  {
    kennung: "#ask-rule-note (Klara-Regel — seit JOB 3017 in der Fusszeile #kw-fuss)",
    finden: (r) => r.q("#kw-fuss #ask-rule-note"),
    sichtbar: true,
    platzImZielbild:
      "Z.48 — der Fusszeilensatz (Wortlaut abweichend: Leitsatz statt Serverstandort)",
    verlust:
      "keiner: die belegten Halbsaetze („woertlich“, „nicht an eine externe KI gesendet“) bleiben, der Leitsatz kommt dazu; die unbelegte Zusage aus Z.48 kommt NICHT (Fall F1).",
    begruendetIn: "taskpane.html #kw-fuss (mega75 Block C, mega77 Block B, JOB 3017 D4)",
  },
  {
    kennung: "#ask-btn (runder Sende-Pfeil; askCta als aria-label, `title` als Sperrgrund)",
    finden: (r) => r.q("#ask-btn"),
    sichtbar: true,
    platzImZielbild: "Z.40-42: runder Pfeilknopf ohne Wortlaut — genau dieser",
    verlust:
      "der sichtbare Wortlaut „Klara fragen“ ist vom Knopf verschwunden; er steht als aria-label (Screenreader), der Sperrgrund bleibt der title (updateAskState).",
    begruendetIn: "taskpane.html #ask-karte, renderStatics, updateAskState",
  },
  {
    kennung: "#ka6-block („Schreiben auf Zuruf“: Erstellen, Vervollstaendigen, Umformulieren)",
    finden: (r) => r.q("#ka6-block"),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "die drei Zurufe und der Vorschlagsweg (KA6 Stufe 1) haben im Ruhezustand keinen Ort mehr.",
    begruendetIn:
      "taskpane.html:5861-5880 (KW-KA6-SCHREIBEN-START, JOB 1153), :6013-6030 (ka6BlockElement, per Skript erzeugt)",
  },
  {
    kennung: "Hilfe-Karte (helpTitle, helpCan1-3, helpNot1-2)",
    finden: (r) => r.hilfeKarte(),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "„Was kann Klara hier?“ samt „kein Chatbot“ und „noch NICHT: seitenweise“ entfaellt — beide Reiter verlieren sie.",
    begruendetIn:
      "taskpane.html:699-708; tests/design/zielbild-wissen-erfassen-einmal.test.ts liest helpCan1-helpNot2",
  },
  {
    kennung: "#kw-stand (Auslieferungsstand unten)",
    finden: (r) => r.q("#kw-stand"),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "der vom Build gestempelte Stand (mega69 Block E) ist nicht mehr sichtbar; Support-Frage „welche Fassung siehst du?“ bleibt unbeantwortbar.",
    begruendetIn:
      "taskpane.html:710-714 (AUFTRAG-mega69 Block E), :4807-4815; tests/app/job2621-panel-wahrheiten.test.ts W3",
  },
  {
    kennung: "#kw-fassung und #kw-fassung-btn (Fassungsabgleich, Knopf heute verborgen)",
    finden: (r) => r.q("#kw-fassung"),
    sichtbar: true,
    platzImZielbild: null,
    verlust:
      "„ist meine Seite noch die, die ausgeliefert wird?“ — Abgleich und Neu-laden-Knopf entfallen.",
    begruendetIn: "taskpane.html:716-722 (JOB 1077), :4817-4859 (renderKwFassung)",
  },
];

// ------------------------------------------------------------------------------------------------
// LIEFERUNG 2 — DIE FLAECHEN DES RUHEZUSTANDS, in Dokumentordnung, mit Sichtbarkeit.
// ------------------------------------------------------------------------------------------------
interface Flaeche {
  kennung: string;
  finden: (r: Ruhezustand) => El | null;
}
const FLAECHEN: readonly Flaeche[] = [
  { kennung: "header", finden: (r) => r.q("header") },
  { kennung: ".brand", finden: (r) => r.q(".brand") },
  { kennung: ".lang", finden: (r) => r.q(".lang") },
  { kennung: "#kw-anmeldung", finden: (r) => r.q("#kw-anmeldung") },
  { kennung: "#kw-stand-kopf", finden: (r) => r.q("#kw-stand-kopf") },
  { kennung: "#klara-trust-head", finden: (r) => r.q("#klara-trust-head") },
  { kennung: "#klara-s4", finden: (r) => r.q("#klara-s4") },
  { kennung: "#klara-consent-card", finden: (r) => r.q("#klara-consent-card") },
  { kennung: "#session-card", finden: (r) => r.q("#session-card") },
  { kennung: "#session-status", finden: (r) => r.q("#session-status") },
  { kennung: "#login-block", finden: (r) => r.q("#login-block") },
  { kennung: ".tabs", finden: (r) => r.q(".tabs") },
  { kennung: "#tab-ask", finden: (r) => r.q("#tab-ask") },
  { kennung: "#tab-capture", finden: (r) => r.q("#tab-capture") },
  { kennung: "#section-ask", finden: (r) => r.q("#section-ask") },
  { kennung: "#ask-karte", finden: (r) => r.frageKarte() },
  { kennung: "#ask-source-note", finden: (r) => r.q("#ask-source-note") },
  { kennung: "#ask-input", finden: (r) => r.q("#ask-input") },
  { kennung: "#ask-btn", finden: (r) => r.q("#ask-btn") },
  { kennung: "#ask-review-notice", finden: (r) => r.q("#ask-review-notice") },
  { kennung: "#ask-ai-notice", finden: (r) => r.q("#ask-ai-notice") },
  { kennung: "#ask-status", finden: (r) => r.q("#ask-status") },
  { kennung: "#ask-answer-block", finden: (r) => r.q("#ask-answer-block") },
  { kennung: "#ask-gap-block", finden: (r) => r.q("#ask-gap-block") },
  { kennung: "#ka1-block", finden: (r) => r.q("#ka1-block") },
  { kennung: "#ka6-block", finden: (r) => r.q("#ka6-block") },
  { kennung: "#section-capture", finden: (r) => r.q("#section-capture") },
  { kennung: "Hilfe-Karte (div.card ohne Kennung)", finden: (r) => r.hilfeKarte() },
  { kennung: "#kw-stand", finden: (r) => r.q("#kw-stand") },
  { kennung: "#kw-fassung", finden: (r) => r.q("#kw-fassung") },
  { kennung: "#kw-fassung-btn", finden: (r) => r.q("#kw-fassung-btn") },
  { kennung: "#kw-fuss", finden: (r) => r.q("#kw-fuss") },
  { kennung: "#ask-rule-note", finden: (r) => r.q("#ask-rule-note") },
];

/**
 * GEMESSEN am 03.09.2026 (JOB 3004, Antwortkarte nach Zielbild „Main“): #ask-review-notice und
 * #ask-rule-note standen seit dem Umbau UNTER der Antwortflaeche (ausserhalb der Frage-Karte,
 * damit sie auch im Antwortzustand sichtbar bleiben — mega81/mega75); #ask-btn folgte deshalb
 * direkt auf #ask-input. Die Frage-Karte trug bereits die Kennung #ask-karte.
 * NACHZUG JOB 3017 D4 (04.09.2026, SchlankesPanel-Umbau): #ka1-block stand VOR der Frage-Karte,
 * askTitle/askHint/#ask-source-note/#ask-rule-note standen IN der Karte, der Knopf war ein
 * Textknopf, keine Anmeldezeile, keine Fusszeile. Seit dem Umbau: #ka1-block NACH der Karte,
 * #ask-rule-note in #kw-fuss, der Knopf ein runder Sende-Pfeil, Anmeldezeile und Fusszeile gebaut.
 */
const SICHTBAR_IN_REIHENFOLGE: readonly string[] = [
  "header",
  ".brand",
  ".lang",
  "#kw-anmeldung",
  "#kw-stand-kopf",
  "#klara-trust-head",
  "#klara-s4",
  "#session-card",
  "#session-status",
  ".tabs",
  "#tab-ask",
  "#tab-capture",
  "#section-ask",
  "#ask-karte",
  "#ask-input",
  "#ask-btn",
  "#ask-review-notice",
  "#ka1-block",
  "#ka6-block",
  "Hilfe-Karte (div.card ohne Kennung)",
  "#kw-stand",
  "#kw-fassung",
  "#kw-fuss",
  "#ask-rule-note",
];
/** GEMESSEN: vorhanden, aber im Ruhezustand verborgen. */
const VERBORGEN: readonly string[] = [
  "#klara-consent-card",
  "#login-block",
  "#ask-source-note",
  "#ask-ai-notice",
  "#ask-status",
  "#ask-answer-block",
  "#ask-gap-block",
  "#section-capture",
  "#kw-fassung-btn",
];

// ------------------------------------------------------------------------------------------------
// LIEFERUNG 2 (Text) — DAS TEXTINVENTAR DES RUHEZUSTANDS: jeder sichtbare Traeger mit EIGENEM Text
// (direkte Textknoten), in Dokumentordnung, woertlich. GEMESSEN am 03.09.2026 (Sprache DE,
// Fixture angemeldet als „Testnutzer“, Office da, kein Word.run, Stand „dev“).
// Der Wortlaut steht hier ABSICHTLICH als Literal und nicht als `t(key)`: eine Aenderung im
// Woerterbuch des Panels soll diesen Fall rot machen — ueber `t()` gelesen bliebe sie unsichtbar.
// ------------------------------------------------------------------------------------------------
const TEXTTRAEGER_SICHTBAR: readonly [kennung: string, text: string][] = [
  ["div.brand", "Klara"],
  [".brand small", "KLARWERK"],
  ["#lang-de", "DE"],
  ["#lang-en", "EN"],
  ["#lang-nl", "NL"],
  ["#kw-anmeldung", "Angemeldet als Testnutzer."],
  ["#kw-stand-kopf", "dev"],
  ["#klara-trust-mode", "KLARWERK: keine KI"],
  [
    "#klara-trust-detail",
    "In KLARWERK arbeitet für Antworten zurzeit keine KI. Für andere Aufgaben in KLARWERK kann das anders sein. Klaras Antwort in diesem Fenster entsteht ohnehin immer ohne KI-Modell — regelbasiert, mit wörtlichem Zitat aus validiertem Wissen.",
  ],
  ["#klara-s4-label", "In dieser Sitzung"],
  ["#klara-s4-mode", "Für dieses Fenster besteht keine Sitzung."],
  [
    "#klara-s4-session",
    "Nicht angemeldet — dein Zustimmungsstand wird erst nach der Anmeldung sichtbar (er geht dabei nicht verloren).",
  ],
  ["[data-t=greetTitle]", "Hallo, ich bin Klara."],
  [
    "[data-t=greetBody]",
    "Ich verbinde dieses Word-Dokument mit KLARWERK. In diesem ersten Schritt kann ich deine Textauswahl als Entwurf nach KLARWERK bringen — ehrlich, ohne Zauber.",
  ],
  ["#session-status", "Angemeldet als Testnutzer."],
  ["#tab-ask", "Fragen"],
  ["#tab-capture", "Wissen erfassen"],
  // Attributtext: der Platzhalter des leeren Eingabefelds ist fuer den Menschen sichtbarer Text.
  ["#ask-input[placeholder]", "Frage eingeben, wenn nichts markiert ist ..."],
  [
    "#ask-review-notice",
    "Antworten kommen wörtlich aus validiertem KLARWERK-Wissen — mit Quellen. Markierst du Text in Word, wird die Markierung gefragt. Bitte vor Verwendung fachlich prüfen.",
  ],
  ["[data-t=ka1Title]", "Worum es hier geht"],
  [
    "[data-t=ka1Hint]",
    "Aus dem ganzen Dokument gewonnen — im Haus, ohne KI und ohne dass Text das Fenster verlässt.",
  ],
  [
    "#ka1-empty",
    "Noch keine Begriffe: Diese Seite läuft ohne Word, es gibt kein offenes Dokument.",
  ],
  ["#ka6-titel", "Schreiben auf Zuruf"],
  [
    "#ka6-lead",
    "Klara formuliert einen Vorschlag. Er landet im Antwortfeld darüber und geht erst auf deinen Klick ins Dokument.",
  ],
  [
    "#ka6-hinweis",
    "Ob formuliert werden darf, ist noch nicht bekannt — der Sitzungsstand wird abgerufen. Solange wird kein Zuruf angeboten.",
  ],
  ["#ka6-zuruf-erstellen", "Erstellen"],
  ["#ka6-zuruf-vervollstaendigen", "Vervollständigen"],
  ["#ka6-zuruf-umformulieren", "Umformulieren"],
  ["[data-t=helpTitle]", "Was kann Klara hier?"],
  [
    "[data-t=helpCan1]",
    "Auswahl oder ganzes Dokument als KLARWERK-Entwurf anlegen — mit Formatierung und Tabellen (nur Entwurf, kein fertiges Wissensobjekt).",
  ],
  [
    "[data-t=helpCan2]",
    "Ehrlich sagen, ob du angemeldet bist, ob das Senden geklappt hat und was Word NICHT übergeben konnte.",
  ],
  [
    "[data-t=helpCan3]",
    "Fragen quellengebunden aus dem VALIDIERTEN Werkswissen beantworten — und die Antwort mit Quellenangabe ins Dokument einfügen.",
  ],
  [
    "[data-t=helpNot1]",
    "Klara ist kein Chatbot: ohne belastbare Grundlage wird NICHTS erfunden — die Frage bleibt ehrlich offen (Wissenslücke).",
  ],
  [
    "[data-t=helpNot2]",
    "Noch NICHT: seitenweises Senden — Word gibt Seitengrenzen im Taskpane nicht her; markiere stattdessen den Bereich.",
  ],
  ["#kw-stand", "dev"],
  ["#kw-fassung", "Stand dev · Abgleich nicht möglich"],
  [
    "#ask-rule-note",
    "Keine KI-Antwort ohne Beleg · Vertrauliches bleibt vertraulich. Klara zitiert validiertes KLARWERK-Wissen wörtlich; dein markierter Text wird nicht an eine externe KI gesendet.",
  ],
];

/**
 * Sichtbare Elemente OHNE eigenen Text (weder Textknoten noch angezeigter Attributtext) und OHNE
 * textfuehrende Nachfahren — je mit Begruendung. (Container wie header, .card, .tabs tragen ihren
 * Text in den Kindern und stehen deshalb nicht hier.) Seit JOB 3017 sind das die beiden Zeichen
 * des Zielbilds — Pfeil und Schloss samt ihren Pfaden — und der Knopf, der nur den Pfeil traegt.
 */
const TEXTLOS: readonly [kennung: string, grund: string][] = [
  ["#ask-btn", "der runde Sende-Pfeil traegt kein Wort; askCta ist sein aria-label (Z.40)"],
  ["svg", "das Pfeil-Zeichen im Sende-Knopf (Z.41)"],
  ["path", "Pfeil-Schaft M12 19V5 (Z.41)"],
  ["path", "Pfeil-Spitze M5 12l7-7 7 7 (Z.41)"],
  ["#ka1-terms", "leere Begriffsliste — ohne offenes Dokument gibt es keine Begriffe (KA1)"],
  ["#kw-fuss-schloss", "das Schloss-Zeichen der Fusszeile (Z.49)"],
  ["rect", "Schloss-Koerper (Z.49)"],
  ["path", "Schloss-Buegel M8 10V7a4 … (Z.49)"],
];

/**
 * Alle sichtbaren Texte eines Elements: der eigene Textknoten-Text und die angezeigten
 * Attributtexte. `placeholder` zaehlt nur bei leerem Feld (sonst zeigt der Browser den Wert),
 * `title` nur, wenn gesetzt — im Ruhezustand traegt kein sichtbares Element einen Sperrgrund.
 */
function sichtbareTexte(e: El): [kennung: string, text: string][] {
  const raus: [string, string][] = [];
  const kennung = textKennung(e);
  const eigen = eigenerText(e);
  if (eigen !== "") {
    raus.push([kennung, eigen]);
  }
  // Nur Eingabefelder: `value` ist z. B. an <li> eine Zahl, kein sichtbarer Text.
  if (e.tagName === "TEXTAREA" || e.tagName === "INPUT") {
    const wert = typeof e.value === "string" ? norm(e.value) : "";
    const platzhalter = typeof e.placeholder === "string" ? norm(e.placeholder) : "";
    if (wert !== "") {
      raus.push([`${kennung}[value]`, wert]);
    } else if (platzhalter !== "") {
      raus.push([`${kennung}[placeholder]`, platzhalter]);
    }
  }
  const titel = norm(e.getAttribute("title"));
  if (titel !== "") {
    raus.push([`${kennung}[title]`, titel]);
  }
  return raus;
}

/** Kennung eines Elements fuer das Textinventar. */
function textKennung(e: El): string {
  if (e.id !== "") {
    return `#${e.id}`;
  }
  const dt = e.getAttribute("data-t");
  if (dt !== null) {
    return `[data-t=${dt}]`;
  }
  if (e.tagName === "SMALL" && e.parentElement?.getAttribute("class") === "brand") {
    return ".brand small";
  }
  const klasse = e.getAttribute("class");
  return klasse ? `${e.tagName.toLowerCase()}.${klasse}` : e.tagName.toLowerCase();
}

// ------------------------------------------------------------------------------------------------
// LIEFERUNG 6 — die Selektoren von WERTE_SCHLANKES_PANEL. Sie werden aus dem QUELLTEXT von
// tools/design-vergleich/werte.ts abgeleitet (jeder `cssProp(g, "<selektor>", …)`-Aufruf im Block
// der Tabelle), nicht abgeschrieben — sonst waere die Liste eine zweite, driftfaehige Wahrheit.
// Die Tabelle selbst wird NICHT importiert: kein Test liest sie, das ist der Befund (W1).
// Gepinnt ist je Selektor die GEMESSENE Trefferzahl am laufenden Fenster.
// ------------------------------------------------------------------------------------------------
// JOB 3017 D4: `#ask-karte`, `#kw-fuss` und `#kw-fuss p` treffen jetzt (die Flaechen sind gebaut);
// `.ask-hinweise p` bleibt der eine Selektor, den das Produkt nicht kennt.
const WERTE_TREFFER: Readonly<Record<string, number>> = {
  ".tabs": 1,
  ".tabs button": 2,
  // JOB 3004 D1: die Frage-Karte traegt jetzt die Kennung #ask-karte — der Selektor trifft.
  "#ask-karte": 1,
  ".card": 8,
  "#ask-input": 1,
  "#ask-btn": 1,
  // JOB 3046 D2: die Luecke traegt keinen `button.primary` mehr — der Weg „offene Frage" ist ein
  // Textlink (a#ask-gap-send-btn, Zielbild KeinWissen Z.31). Gemessen: 8 -> 7 (R4/W2 meldeten
  // `expected 7 to be 8`, bevor diese Zeile angefasst wurde).
  "button.primary": 7,
  ".ask-hinweise p": 0,
  "#kw-fuss p": 1,
  "#kw-fuss": 1,
};

function selektorenAusWerteTs(): string[] {
  const quelle = readFileSync(join(WURZEL, "tools/design-vergleich/werte.ts"), "utf8");
  const von = quelle.indexOf("export const WERTE_SCHLANKES_PANEL");
  const bis = quelle.indexOf("export const WERTE_WISSEN_ERFASSEN");
  if (von < 0 || bis < von) {
    throw new Error("werte.ts: Block WERTE_SCHLANKES_PANEL nicht auffindbar");
  }
  const block = quelle.slice(von, bis);
  const gefunden = [...block.matchAll(/cssProp\(g, "([^"]+)"/g)].map((m) => m[1] ?? "");
  return [...new Set(gefunden)];
}

function testDateienUnter(dir: string): string[] {
  const raus: string[] = [];
  if (!existsSync(dir)) {
    return raus;
  }
  for (const eintrag of readdirSync(dir)) {
    if (eintrag === "node_modules") {
      continue;
    }
    const pfad = join(dir, eintrag);
    if (statSync(pfad).isDirectory()) {
      raus.push(...testDateienUnter(pfad));
    } else if (/\.test\.tsx?$/.test(eintrag)) {
      raus.push(pfad);
    }
  }
  return raus;
}

// ================================================================================================
let offen: Ruhezustand | null = null;
afterEach(() => {
  offen?.abbauen();
  offen = null;
});

describe("JOB 3013 · D4 · K — Kalibrierung des Messwerkzeugs", () => {
  it("K0 · Kanonisierung: Hex wird rgb(r, g, b), px bleibt, Leerraum faellt", () => {
    expect(kanon("#FAF8F5")).toBe("rgb(250, 248, 245)");
    expect(kanon("#0E1626")).toBe("rgb(14, 22, 38)");
    expect(kanon(" 1px  solid #E9E5DE ")).toBe("1px solid rgb(233, 229, 222)");
    expect(kanon("0 1px 2px rgba(14, 22, 38, 0.05),0 8px 24px -12px rgba(14, 22, 38, 0.12)")).toBe(
      "0 1px 2px rgba(14, 22, 38, 0.05), 0 8px 24px -12px rgba(14, 22, 38, 0.12)",
    );
    expect(kanon(null)).toBeNull();
  });

  it("K1 · kein stiller Null-Treffer: eine fehlende Stelle wirft, Sichtbarkeit trennt verborgen von sichtbar", async () => {
    offen = await ruhezustand();
    const r = offen;
    expect(() => r.el("#diese-stelle-gibt-es-nicht")).toThrow(/existiert nicht/);
    expect(r.sichtbar(r.el("#ask-btn"))).toBe(true);
    expect(r.sichtbar(r.el("#ask-ai-notice")), "class=hidden muss als verborgen gelten").toBe(
      false,
    );
    expect(r.sichtbar(r.el("#send-btn")), "Kind eines verborgenen Abschnitts").toBe(false);
    expect(r.sichtbar(null)).toBe(false);
  });
});

// ================================================================================================
describe("JOB 3013 · D4 · R — der Ruhezustand am laufenden Fenster (vor jeder Frage)", () => {
  it("R1 · Reihenfolge der sichtbaren Flaechen (Dokumentordnung) — und was vorhanden, aber verborgen ist", async () => {
    offen = await ruhezustand({ verfaelschbar: ["reihenfolge"] });
    const r = offen;
    const gefunden = FLAECHEN.map((f) => ({ f, e: f.finden(r) }));
    // Jede Flaeche der Liste existiert — sonst ist der Fall ein Fehlschlag, kein „0 von 0“.
    for (const { f, e } of gefunden) {
      expect(e, `${f.kennung} nicht gefunden`).not.toBeNull();
    }
    const sichtbare = gefunden
      .filter((x): x is { f: Flaeche; e: El } => x.e !== null && r.sichtbar(x.e))
      .sort((a, b) => r.position(a.e) - r.position(b.e))
      .map((x) => x.f.kennung);
    const verborgene = gefunden
      .filter((x) => x.e !== null && !r.sichtbar(x.e))
      .map((x) => x.f.kennung);
    console.info(
      `JOB 3013 D4 · R1 · sichtbar in Reihenfolge:\n  ${sichtbare.join("\n  ")}\n  verborgen: ${verborgene.join(", ")}`,
    );
    expect(sichtbare.length).toBeGreaterThan(0);
    expect(sichtbare).toEqual(SICHTBAR_IN_REIHENFOLGE);
    expect(verborgene).toEqual(VERBORGEN);
  });

  it("R2 · Text: das vollstaendige Inventar jedes sichtbaren Traegers mit eigenem Text (Textknoten und Attributtexte), woertlich und in Dokumentordnung", async () => {
    offen = await ruhezustand({
      verfaelschbar: ["text-greet", "text-hilfe", "text-ka6", "text-platzhalter"],
    });
    const r = offen;
    const sichtbare = r
      .alle("*")
      .filter((e) => e.tagName !== "SCRIPT" && e.tagName !== "STYLE" && r.sichtbar(e));
    // (1) Jeder sichtbare Traeger mit eigenem Text — Textknoten UND angezeigte Attributtexte —
    //     GEMESSEN, dann woertlich gegen das Inventar gehalten.
    const inventar = sichtbare.flatMap((e) => sichtbareTexte(e));
    console.info(
      `JOB 3013 D4 · R2 · Textinventar (${inventar.length} Traeger):\n  ${inventar.map(([k, t]) => `${k} → „${t}"`).join("\n  ")}`,
    );
    expect(inventar.length).toBeGreaterThan(0);
    expect(inventar).toEqual(TEXTTRAEGER_SICHTBAR);
    // (2) Was aus dem Woerterbuch kommt, kommt WIRKLICH aus dem laufenden Woerterbuch (`t()`),
    //     nicht aus dem Markup — der Rendering-Weg renderStatics → data-t.
    for (const e of sichtbare) {
      const key = e.getAttribute("data-t");
      // #session-status traegt data-t=sessionChecking nur als Startwert; checkSession ueberschreibt
      // ihn mit sessionOk — dieser Traeger wird darunter eigens gehalten.
      if (key !== null && e.id !== "session-status" && eigenerText(e) !== "") {
        expect(eigenerText(e), `[data-t=${key}]`).toBe(r.t(key));
      }
    }
    expect(r.text("#session-status")).toBe(r.t("sessionOk", { name: "Testnutzer" }));
    expect(r.text("#kw-fassung")).toBe(r.t("fassungUnbekannt", { geladen: "dev" }));
    // (3) Sichtbar, aber ohne eigenen Text (Textknoten oder Attribut) und ohne textfuehrende
    //     Nachfahren: nur mit Begruendung.
    const textlos = sichtbare
      .filter((e) => sichtbareTexte(e).length === 0)
      .filter((e) => !Array.from(e.querySelectorAll("*")).some((k) => sichtbareTexte(k).length > 0))
      .map((e) => textKennung(e));
    expect(textlos).toEqual(TEXTLOS.map(([k]) => k));
    console.info(
      `JOB 3013 D4 · R2 · textlos (begruendet):\n  ${TEXTLOS.map(([k, gr]) => `${k} — ${gr}`).join("\n  ")}`,
    );
    // (4) Das Eingabefeld: leer (der Platzhalter ist deshalb der sichtbare Text, s. Inventar),
    //     drei Zeilen; kein sichtbares Element traegt im Ruhezustand einen title-Text.
    expect(r.el("#ask-input").value).toBe("");
    expect(r.el("#ask-input").getAttribute("rows")).toBe("3");
    expect(inventar.filter(([k]) => k.endsWith("[title]"))).toEqual([]);
  });

  it("R3 · aktiver Reiter: #tab-ask traegt `active`, #tab-capture nicht; #section-ask sichtbar, #section-capture verborgen", async () => {
    offen = await ruhezustand({ verfaelschbar: ["reiter"] });
    const r = offen;
    expect(r.el("#tab-ask").getAttribute("class")).toBe("active");
    expect(r.el("#tab-capture").getAttribute("class") ?? "").not.toContain("active");
    expect(r.alle(".tabs button.active").map((e) => `#${e.id}`)).toEqual(["#tab-ask"]);
    expect(r.sichtbar(r.el("#section-ask"))).toBe(true);
    expect(r.sichtbar(r.el("#section-capture"))).toBe(false);
  });

  it("R4 · Hauptaktion: genau EIN sichtbarer Knopf traegt `primary`, und es ist #ask-btn — der Pfeil, mit askCta als aria-label", async () => {
    offen = await ruhezustand({ verfaelschbar: ["hauptaktion"] });
    const r = offen;
    const alle = r.alle("button.primary");
    const sichtbare = alle.filter((e) => r.sichtbar(e)).map((e) => `#${e.id}`);
    console.info(
      `JOB 3013 D4 · R4 · button.primary im Markup: ${alle.map((e) => `#${e.id}`).join(", ")} · sichtbar: ${sichtbare.join(", ")}`,
    );
    // Zuerst die Hauptaktion selbst — eine Verfaelschung meldet sich HIER, nicht an der Zaehlung.
    expect(sichtbare, "sichtbare Knoepfe mit `primary`").toEqual(["#ask-btn"]);
    // JOB 3046 D2: 8 -> 7 — der Weg „offene Frage" der Luecke ist ein Textlink, kein
    // `button.primary` mehr (Zielbild KeinWissen Z.31); gemessen `expected 7 to be 8`.
    expect(alle.length).toBe(7);
    // JOB 3017: kein Wortlaut am Knopf (Z.40) — askCta ist der zugaengliche Name; das Pfeil-Zeichen
    // traegt die beiden Pfade des Zielbilds (Z.41).
    expect(r.text("#ask-btn")).toBe("");
    expect(r.el("#ask-btn").getAttribute("aria-label")).toBe(r.t("askCta"));
    expect(r.q('#ask-btn svg path[d^="M12 19V5"]')).not.toBeNull();
    expect(r.q('#ask-btn svg path[d^="M5 12l7-7"]')).not.toBeNull();
  });

  it("R5 · #ask-btn: vor den Startabrufen gesperrt OHNE sichtbaren Grund, nach der Anmeldung frei", async () => {
    offen = await ruhezustand();
    const r = offen;
    // Markup (`disabled`) — synchron nach dem Skriptlauf, bevor /api/auth/me geantwortet hat.
    expect(r.knopfVorStart.disabled).toBe(true);
    expect(r.knopfVorStart.title, "kein title = kein sichtbarer Grund am Knopf").toBe("");
    expect(r.knopfVorStart.text).toBe("");
    expect(r.knopfVorStart.ariaLabel, "aria-label ab dem ersten renderStatics").toBe(r.t("askCta"));
    // Ruhezustand nach den Startabrufen (angemeldet als Testnutzer): frei.
    const knopf = r.el("#ask-btn");
    expect(knopf.disabled).toBe(false);
    expect(knopf.title).toBe("");
    expect(r.sichtbar(r.el("#ask-status")), "keine Statuszeile im Ruhezustand").toBe(false);
  });

  it("R6 · nicht angemeldet: #ask-btn bleibt gesperrt, der Grund steht NICHT am Knopf, sondern in #session-status und #login-block", async () => {
    offen = await ruhezustand({
      routes: { "/api/auth/me": reply(401, { error: "UNAUTHENTICATED" }) },
    });
    const r = offen;
    const knopf = r.el("#ask-btn");
    expect(knopf.disabled).toBe(true);
    expect(knopf.title, "am Knopf selbst steht kein Grund").toBe("");
    expect(r.text("#session-status")).toBe(r.t("sessionOff"));
    expect(r.sichtbar(r.el("#login-block"))).toBe(true);
    expect(r.text("#login-btn")).toBe(r.t("loginCta"));
    // Der einzige serverseitige Sperrgrund, den der Knopf tragen KANN (updateAskState), ist
    // `s4FragenGesperrt` — er greift hier nicht, weil nichts abgerufen ist.
    expect(r.t("s4FragenGesperrt").length).toBeGreaterThan(0);
  });
});

// ================================================================================================
describe("JOB 3013 · D4 · V — die Verlustliste: Traeger, die das Zielbild nicht kennt", () => {
  it("V1 · jeder Traeger existiert im laufenden Fenster, mit der gemessenen Sichtbarkeit — ein Umbau, der einen fallen laesst, wird hier rot", async () => {
    offen = await ruhezustand();
    const r = offen;
    const protokoll: string[] = [];
    for (const tr of TRAEGER) {
      const e = tr.finden(r);
      expect(e, `${tr.kennung}: nicht gefunden`).not.toBeNull();
      expect(r.sichtbar(e), `${tr.kennung}: Sichtbarkeit`).toBe(tr.sichtbar);
      protokoll.push(
        `${tr.sichtbar ? "sichtbar " : "verborgen"} · ${tr.kennung}\n    Platz im Zielbild: ${tr.platzImZielbild ?? "keiner"}\n    Verlust: ${tr.verlust}\n    begruendet in: ${tr.begruendetIn}`,
      );
    }
    expect(TRAEGER.length).toBeGreaterThanOrEqual(13);
    console.info(
      `JOB 3013 D4 · V1 · Verlustliste (${TRAEGER.length} Traeger):\n  ${protokoll.join("\n  ")}`,
    );
  });
});

// ================================================================================================
describe("JOB 3013 · D4 · D — der (bis JOB 3017 doppelte) #kw-stand-kopf", () => {
  // Bis JOB 3017 trugen ZWEI Spans diese Kennung: getElementById traf den ersten (ohne Stil), der
  // zweite (mit Inline-Stil) blieb leer. JOB 3017 D4 hat den Zwilling entfernt: GENAU EIN Element,
  // gestylt durch die EINE Regel `#kw-stand-kopf` im Stilblock (kein Inline-Stil, keine zweite
  // Wahrheit), in der zweiten Kopfzeile neben der Anmeldezeile.
  it("D1 · genau EIN Element traegt die Kennung; getElementById liefert es, es traegt den Stand und keinen Inline-Stil", async () => {
    offen = await ruhezustand();
    const r = offen;
    const alle = Array.from(g.document.querySelectorAll("#kw-stand-kopf"));
    expect(alle.length, "genau ein Element mit dieser Kennung").toBe(1);
    const eines = alle[0];
    if (!eines) {
      throw new Error("kw-stand-kopf: ein Element erwartet");
    }
    expect(g.document.getElementById("kw-stand-kopf")).toBe(eines);
    expect(eines.getAttribute("style")).toBeNull();
    expect(norm(eines.textContent)).toBe("dev");
    expect(r.sichtbar(eines)).toBe(true);
    // In derselben Zeile wie die Anmeldezeile (Z.26-29): beide Kinder von #kw-kopf-zeile.
    expect(eines.parentElement?.id).toBe("kw-kopf-zeile");
    expect(r.el("#kw-anmeldung").parentElement?.id).toBe("kw-kopf-zeile");
    // Am Markup belegt: ein Span, und die Regel im Stilblock traegt Groesse und Farbe.
    const { markup } = splitTaskpane(PRODUKT_HTML);
    expect([...markup.matchAll(/<span id="kw-stand-kopf"[^>]*>/g)]).toHaveLength(1);
    expect(PRODUKT_HTML).toMatch(/#kw-stand-kopf \{ font-size: 10px; color: var\(--shell-muted\)/);
    console.info(
      `JOB 3013 D4 · D1 · #kw-stand-kopf ×1 (JOB 3017): → „${norm(eines.textContent)}", neben #kw-anmeldung „${r.text("#kw-anmeldung")}"`,
    );
  });
});

// ================================================================================================
describe("JOB 3013 · D4 · W — WERTE_SCHLANKES_PANEL ehrlich eingeordnet", () => {
  it("W1 · kein Test liest WERTE_SCHLANKES_PANEL (Dateisuche ueber tests/, services/, apps/)", () => {
    const leser = ["tests", "services", "apps"]
      .flatMap((d) => testDateienUnter(join(WURZEL, d)))
      .map((p) => relative(WURZEL, p))
      .filter((p) => p !== SELBST)
      .filter((p) => readFileSync(join(WURZEL, p), "utf8").includes("WERTE_SCHLANKES_PANEL"));
    expect(leser).toEqual([]);
    // Die Tabelle existiert — der Befund gilt einer ungelesenen, nicht einer fehlenden.
    const werte = readFileSync(join(WURZEL, "tools/design-vergleich/werte.ts"), "utf8");
    expect(werte).toContain("export const WERTE_SCHLANKES_PANEL");
    expect(werte).toContain('cssProp(g, "#ask-karte"');
  });

  it("W2 · je Selektor der Tabelle (aus werte.ts abgeleitet): trifft er am laufenden Fenster ein Element?", async () => {
    offen = await ruhezustand();
    const r = offen;
    const selektoren = selektorenAusWerteTs();
    // Vollstaendigkeit: die abgeleitete Menge ist genau die gepinnte — aendert sich die Tabelle,
    // meldet sich dieser Fall, statt still einen Selektor zu uebersehen.
    expect([...selektoren].sort()).toEqual(Object.keys(WERTE_TREFFER).sort());
    expect(selektoren).toHaveLength(10);
    const zeilen: string[] = [];
    for (const s of selektoren) {
      const n = r.alle(s).length;
      zeilen.push(`${s.padEnd(16)} ${n > 0 ? `trifft (${n})` : "trifft nicht"}`);
      expect(n, s).toBe(WERTE_TREFFER[s]);
    }
    console.info(
      `JOB 3013 D4 · W2 · Selektoren von WERTE_SCHLANKES_PANEL (${selektoren.length}):\n  ${zeilen.join("\n  ")}`,
    );
    // Ein Nulltreffer bleibt: `.ask-hinweise p` — die Tabelle misst eine Flaeche, die das Produkt
    // nicht hat; `.card` trifft acht Karten, nicht die eine Frage-Karte. Dazu misst `cssProp`
    // Quelltext, nicht die gebaute Flaeche (JOB 3017: die Chromium-Messung ist die Wahrheit).
    expect(selektoren.filter((s) => r.alle(s).length === 0)).toEqual([".ask-hinweise p"]);
  });
});

// ================================================================================================
describe.runIf(zielbildDa)(
  "JOB 3013 · D4 · S/A/F — Sollwerte aus der Vorlage, Abweichungstabelle, Fusszeilensatz",
  () => {
    it("S1 · jeder Sollwert der Tabelle ist aus SchlankesPanel.dc.html gelesen und ohne Renderer kanonisiert", () => {
      for (const z of ZUSAGEN) {
        expect(ausVorlage(z), `${z.kennung} (Z.${z.zeile})`).toBe(z.soll);
      }
      // Kennungen eindeutig, jede messbare Zusage traegt ein gemessenes Urteil und eine Messung.
      expect(new Set(ZUSAGEN.map((z) => z.kennung)).size).toBe(ZUSAGEN.length);
      for (const z of ZUSAGEN.filter((z) => z.art !== "darstellung")) {
        expect(z.ist, `${z.kennung}: ohne Messung`).toBeDefined();
        expect(z.heute, `${z.kennung}: ohne gemessenes Urteil`).toBeDefined();
      }
    });

    it("S2 · Z.15-49 sind EIGENSCHAFTSWEISE gedeckt: jede Inline-Eigenschaft, jedes SVG-Attribut und jeder Text hat eine Zusage oder eine begruendete Auslassung", () => {
      const verlangt = verlangteSchluessel();
      const gedeckt = new Set(ZUSAGEN.flatMap(deckungsSchluessel));
      const ohne = verlangt.filter((k) => !gedeckt.has(k) && !begruendetAusgelassen(k));
      const ausgelassen = verlangt.filter((k) => !gedeckt.has(k) && begruendetAusgelassen(k));
      // Kalibrierung des Sammlers: er sieht die Deklarationen wirklich (kein leerer Soll-Raum), und
      // jede Zusage deckt etwas, das die Vorlage auch verlangt (kein toter Schluessel).
      expect(verlangt.length).toBeGreaterThan(100);
      expect(verlangt).toContain("Z.28/stil0:color");
      expect(verlangt).toContain("Z.41/svg0:stroke");
      expect(verlangt).toContain("Z.49/rect0:rx");
      const verlangtMenge = new Set(verlangt);
      for (const z of ZUSAGEN) {
        for (const k of deckungsSchluessel(z)) {
          expect(
            verlangtMenge.has(k),
            `${z.kennung} deckt ${k}, das die Vorlage nicht deklariert`,
          ).toBe(true);
        }
      }
      console.info(
        `JOB 3013 D4 · S2 · ${verlangt.length} Deklarationen in Z.15-49, ${verlangt.length - ohne.length - ausgelassen.length} durch Zusagen gedeckt, ${ausgelassen.length} begruendet ausgelassen:\n  ${ausgelassen.join(", ")}\n  Begruendungen:\n  ${NICHT_AUFGENOMMEN.map((n) => `Z.${n.zeilen.join("/")} ${n.was} [${n.eigenschaften.join(", ")}] — ${n.grund}`).join("\n  ")}`,
      );
      expect(ohne, "Deklarationen der Vorlage ohne Zusage und ohne Begruendung").toEqual([]);
    });

    it("A1 · Abweichungstabelle: je Sollwert Istwert, Beleg und eines von drei Urteilen — die Erwartung ist das Gemessene", async () => {
      offen = await ruhezustand();
      const r = offen;
      const zeilen: string[] = [];
      const zaehler = { erfuellt: 0, abweichend: 0, nichtMessbar: 0 };
      for (const z of ZUSAGEN) {
        const ist = z.ist ? z.ist(r) : undefined;
        const u = urteil(z, ist);
        if (u === NICHT_MESSBAR) {
          zaehler.nichtMessbar += 1;
        } else if (u === "erfuellt") {
          zaehler.erfuellt += 1;
        } else {
          zaehler.abweichend += 1;
        }
        zeilen.push(
          `${z.kennung}\n    Soll: ${z.soll}\n    Ist:  ${ist ?? "—"}\n    Beleg: ${z.beleg}\n    Urteil: ${u}`,
        );
        if (z.art !== "darstellung") {
          expect(u, `${z.kennung}: Urteil hat sich gegen den gemessenen Stand veraendert`).toBe(
            z.heute,
          );
        }
      }
      console.info(
        `JOB 3013 D4 · A1 · Abweichungstabelle (${ZUSAGEN.length} Zusagen: ${zaehler.erfuellt} erfuellt, ${zaehler.abweichend} abweichend, ${zaehler.nichtMessbar} nicht messbar):\n  ${zeilen.join("\n  ")}`,
      );
      // GEMESSEN am 03.09.2026 (12 erfuellt, 21 abweichend, 71 nicht messbar) — und am 04.09.2026
      // nach dem Umbau JOB 3017 D4: 14 Urteile sind von abweichend auf erfuellt gewandert (Z.27
      // Anmeldezeile, Z.38 erste Flaeche, Z.40 ohne Wortlaut, Z.41 Pfeil ×5, Z.47 Fusszeile, Z.49
      // Schloss ×5); abweichend bleiben Z.28 (Stand statt Zeitstempel), Z.37 (mehr Flaechen),
      // Z.39 Platzhalter, Z.44/Z.48 Wortlaut und die beiden Strichfarben (currentColor am Markup).
      // Die Zahlen sind Befund, nicht Ziel.
      expect(zaehler).toEqual({ erfuellt: 26, abweichend: 7, nichtMessbar: 71 });
    });

    it("F1 · der Fusszeilensatz: Z.48 neben der Begruendung im Fusszeilen-Kommentar (mega77 Block B), mit der die sinngleiche Zusage entfernt wurde — kein Urteil", async () => {
      offen = await ruhezustand();
      const r = offen;
      const zielSatz = textDerZeile(48);
      expect(zielSatz).toBe(FUSSZEILENSATZ_Z48);
      // Die Begruendung im Produkt, woertlich aus dem ausgelieferten Markup.
      const { markup } = splitTaskpane(PRODUKT_HTML);
      const von = markup.indexOf("AUFTRAG-mega77 Block B");
      expect(von, "die Begruendung (mega77 Block B) fehlt im Markup").toBeGreaterThan(0);
      const begruendung = norm(markup.slice(von, markup.indexOf("-->", von)));
      expect(begruendung).toContain("und der markierte Text verlaesst das Haus nicht");
      expect(begruendung).toContain("Das ist ENTFERNT");
      expect(begruendung).toContain("BETRIEBSZUSAGE");
      // Kommt der Satz heute irgendwo im Panel vor? Sichtbar (je Sprache) und im Skript.
      const muster =
        /verlässt den Server|verlaesst den Server|leaves the server|verlaat de server/i;
      const funde: string[] = [];
      for (const code of ["de", "en", "nl"]) {
        r.panel.setLang(code);
        await r.panel.flush();
        if (muster.test(norm(g.document.body.textContent))) {
          funde.push(code);
        }
      }
      expect(funde, "Sprachen, in denen der Satz im Panel steht").toEqual([]);
      expect(muster.test(r.panel.scriptSource)).toBe(false);
      console.info(
        `JOB 3013 D4 · F1 · Zielbild Z.48: „${zielSatz}"\n  Produkt (Fusszeilen-Kommentar #kw-fuss): „${begruendung.slice(0, 420)}…"\n  Vorkommen im Panel (de/en/nl, sichtbar oder im Skript): keines`,
      );
    });
  },
);

describe.runIf(!zielbildDa)("JOB 3013 · D4 · Zielbild-Abgleich uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa, `Zielbild nicht lesbar: ${ZIELBILD} — S/A/F hier nicht messbar.`).toBe(
      false,
    );
  });
});
