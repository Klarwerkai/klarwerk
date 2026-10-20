// ================================================================================================
// OCR-E05 · SACHLICHE WIDERSPRÜCHE ZWISCHEN BILDTEXT UND DOKUMENTTEXT (Auftrag
// produkt:20261012:klara-ocr-widersprueche).
// ================================================================================================
//
// Steht für denselben erkennbaren Sachverhalt im Dokumenttext ein anderer Betrag, eine andere Zahl,
// ein anderes Datum oder ein anderer Name als im erkannten Text eines eingebetteten Bildes, zeigt
// Klara BEIDE Angaben mit ihren Fundstellen nebeneinander — als MÖGLICHE Abweichung.
//
// DIESE DATEI IST DOM-FREI. Sie liest den gemeinsamen Kontext aus `lib/klaraBildKontext.ts` (OCR-03):
// nur Bilder der aktuellen Quelle, jedes mit seiner Fundstelle, unsichere Stellen gekennzeichnet.
//
// WAS SIE ZUSAGT:
//   · Derselbe Sachverhalt heißt: dieselbe Art der Angabe, dieselbe Einheit/Währung, derselbe Bezug
//     (Jahr, Quartal, Monat, Version, Plan/Ist …) und Bezugswörter, von denen keine Seite ein eigenes
//     unterscheidendes trägt („Gesamtsumme Projekt Nord“ ≠ „Gesamtsumme Projekt West“).
//   · Vorzeichen (-, −, –, +) bleiben im Wert und im Wortlaut erhalten.
//     Andere Zeiträume, Versionen, Einheiten oder klar verschiedene Sachverhalte sind KEIN Hinweis.
//   · Gleiche Werte in anderer Schreibweise („1.500 €“, „1.500,00 EUR“, „1,5 Tsd. €“) sind gleich.
//   · Ist der Wert im Bild unsicher gelesen (`[?…]` aus `kennzeichneUnsicheres`), heißt der Hinweis
//     „unsichere Erkennung“ — nie „Widerspruch“.
//   · Berichtigter Bildtext (OCR-E02) steht im Befund an der Stelle des Rohtexts; jede Neubewertung
//     liest also den berichtigten Stand. Hier wird nichts gespeichert und nichts überschrieben.
//   · Klara entscheidet nicht, welcher Wert stimmt: ein Hinweis trägt beide Wortlaute unverändert.

import type { BildFundstelle } from "./bildAutomatik";
import type { KlaraBildKontext, Uebersetze } from "./klaraBildKontext";

export type AngabeArt = "betrag" | "zahl" | "datum" | "name";

export type AngabeFundstelle =
  | {
      art: "dokument";
      /** Absatz (Zeile) im Dokumenttext, ab 1. */
      absatz: number;
      /** Satz im Absatz, ab 1. */
      satz: number;
      auszug: string;
    }
  | {
      art: "bild";
      quelle: string;
      /** Die Fundstelle im Wortlaut der Oberfläche, z. B. „Folie 2, Bild 1“. */
      ort: string;
      fundstelle: BildFundstelle;
      /** Zeile im erkannten Bildtext, ab 1. */
      zeile: number;
      auszug: string;
    };

export interface Angabe {
  art: AngabeArt;
  /** Der Wortlaut, wie er dasteht (ohne Unsicherheitsklammern). */
  wortlaut: string;
  /** Der Vergleichswert (Zahl, ISO-Datum, normalisierter Name). */
  wert: string;
  /** Währung bzw. Einheit; leer ohne. */
  einheit: string;
  /** Bezugswörter des Sachverhalts, klein geschrieben. */
  bezugswoerter: string[];
  /** Dieselben Bezugswörter im Wortlaut, für die Anzeige. */
  woerterImWortlaut: string[];
  /** Zeitraum, Version, Plan/Ist … — normalisiert und sortiert. */
  bezug: string[];
  /** Eine Ziffer (bei Namen: ein Zeichen) des Werts war unsicher oder unleserlich gelesen. */
  unsicher: boolean;
  /**
   * Nur gesetzt, wenn `unsicher` ALLEIN von einem unsicheren Nachbarstück der Zahlengruppe kommt
   * (die Ziffern selbst sind sicher): dieses Stück im Wortlaut, z. B. „l.OOO“ oder „BOSS“.
   */
  unsicherDurchNachbar?: string;
  fundstelle: AngabeFundstelle;
}

export type AbweichungsArt = "moeglicher-widerspruch" | "unsichere-erkennung";

export interface BildTextAbweichung {
  art: AbweichungsArt;
  angabeArt: AngabeArt;
  /** Der Sachverhalt im Wortlaut des Dokumenttexts, z. B. „Gesamtsumme“. */
  sachverhalt: string;
  text: Angabe;
  bild: Angabe;
}

// ------------------------------------------------------------------------------------------------
// Unsicherheitsklammern auflösen — mit Maske, welche Zeichen unsicher gelesen sind
// ------------------------------------------------------------------------------------------------

const MARKE_RE = /\[\?([^\]\s]*)\]|\[unleserlich\]/g;

interface Klartext {
  text: string;
  unsicher: boolean[];
}

function ohneMarken(gekennzeichnet: string): Klartext {
  let text = "";
  const unsicher: boolean[] = [];
  let zeiger = 0;
  const anhaengen = (s: string, u: boolean): void => {
    text += s;
    for (let i = 0; i < s.length; i += 1) {
      unsicher.push(u);
    }
  };
  for (const m of gekennzeichnet.matchAll(MARKE_RE)) {
    const start = m.index ?? 0;
    anhaengen(gekennzeichnet.slice(zeiger, start), false);
    anhaengen(m[1] !== undefined ? m[1] : "[unleserlich]", true);
    zeiger = start + m[0].length;
  }
  anhaengen(gekennzeichnet.slice(zeiger), false);
  return { text, unsicher };
}

// ------------------------------------------------------------------------------------------------
// Werte erkennen
// ------------------------------------------------------------------------------------------------

const WAEHRUNG: Record<string, string> = {
  "€": "EUR",
  eur: "EUR",
  euro: "EUR",
  $: "USD",
  usd: "USD",
  chf: "CHF",
};

const EINHEIT: Record<string, string> = {
  "%": "%",
  prozent: "%",
  kg: "kg",
  t: "t",
  g: "g",
  km: "km",
  m: "m",
  cm: "cm",
  mm: "mm",
  l: "l",
  h: "h",
  std: "h",
  stunden: "h",
  min: "min",
  tage: "tage",
  stück: "stk",
  stk: "stk",
  personen: "personen",
};

const SKALA: Record<string, number> = {
  tsd: 1_000,
  tausend: 1_000,
  mio: 1_000_000,
  millionen: 1_000_000,
  mrd: 1_000_000_000,
  milliarden: 1_000_000_000,
};

const ZAHL = String.raw`\d{1,3}(?:[.   ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?`;
const WAEHRUNG_RE = String.raw`€|EUR|Euro|USD|\$|CHF`;
const SKALA_RE = String.raw`Tsd\.?|Tausend|Mio\.?|Millionen|Mrd\.?|Milliarden`;
const EINHEIT_RE = [
  "%",
  "Prozent",
  "kg",
  "km",
  "cm",
  "mm",
  String.raw`Std\.?`,
  "Stunden",
  String.raw`Min\.?`,
  "Tage",
  "Stück",
  String.raw`Stk\.?`,
  "Personen",
  "[tgmlh]",
].join("|");

const DATUM_RE = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?![\d])/g;
/**
 * Ein Vorzeichen, das unmittelbar vor der Zahl (oder der vorangestellten Währung) steht:
 * Bindestrich, typografisches Minus, Halbgeviertstrich, Plus. Davor darf weder Buchstabe noch Ziffer
 * stehen („V-3“, „2025-1.500“ tragen kein Vorzeichen).
 */
const VORZEICHEN_RE = String.raw`[-−–+]`;
const VOR_ANGABE = String.raw`(?<![\p{L}\d.,\-−–+])`;
const BETRAG_RE = new RegExp(
  String.raw`${VOR_ANGABE}(?:(?<v1>${VORZEICHEN_RE})?(?<w1>${WAEHRUNG_RE})\s?(?<v2>${VORZEICHEN_RE})?(?<z1>${ZAHL})(?:,-{1,2})?(?:\s?(?<s1>${SKALA_RE}))?|(?<v3>${VORZEICHEN_RE})?(?<z2>${ZAHL})(?:,-{1,2})?(?:\s?(?<s2>${SKALA_RE}))?\s?(?<w2>${WAEHRUNG_RE})(?![\p{L}]))`,
  "giu",
);
const ZAHL_RE = new RegExp(
  String.raw`${VOR_ANGABE}(?<v>${VORZEICHEN_RE})?(?<z>${ZAHL})(?:\s?(?<e>${EINHEIT_RE})(?![\p{L}]))?`,
  "giu",
);

/** −1 für ein Minuszeichen (Bindestrich, typografisches Minus, Halbgeviertstrich), sonst 1. */
function vorzeichen(roh: string | undefined): number {
  return roh !== undefined && roh !== "+" ? -1 : 1;
}
/** „Ansprechpartner: Max Müller“ — eine Namensangabe hinter ihrer Bezeichnung. */
const NAME_RE =
  /^(.{2,40}?):\s*((?:[A-ZÄÖÜ][\p{Ll}'-]+|[A-ZÄÖÜ]\.)(?:\s+(?:[A-ZÄÖÜ][\p{Ll}'-]+|[A-ZÄÖÜ]\.|von|van|de|zu)){0,3})[.;,]?\s*$/u;

/**
 * „1.500“ → 1500, „1.500,50“ → 1500.5, „1,5“ → 1.5 (deutsche Schreibweise); ein führendes Vorzeichen
 * („-1.500“, „−1.500“, „+1.500“) bleibt erhalten — auch für die Tausenderpunkt-Erkennung.
 */
export function zahlWert(eingabe: string): number | null {
  const minus = /^\s*[-−–]/.test(eingabe);
  const roh = eingabe.replace(/^\s*[-−–+]\s?/, "");
  const s = roh.replace(/[   ]/g, "");
  if (!/^\d/.test(s)) {
    return null;
  }
  let norm: string;
  if (s.includes(",") && s.includes(".")) {
    norm =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    norm = s.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    // Ohne Vorzeichen geprüft: „-1.500“ ist dieselbe Tausenderschreibweise wie „1.500“.
    norm = s.replace(/\./g, "");
  } else {
    norm = s;
  }
  const n = Number(norm);
  if (!Number.isFinite(n)) {
    return null;
  }
  return minus ? -n : n;
}

function zahlText(n: number): string {
  return String(Math.round(n * 1_000_000) / 1_000_000);
}

function skala(roh: string | undefined): number {
  return roh ? (SKALA[roh.toLowerCase().replace(/\.$/, "")] ?? 1) : 1;
}

function isoDatum(t: string, m: string, j: string): string | null {
  const tag = Number(t);
  const monat = Number(m);
  const jahr = j.length === 2 ? 2000 + Number(j) : Number(j);
  if (tag < 1 || tag > 31 || monat < 1 || monat > 12) {
    return null;
  }
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

// ------------------------------------------------------------------------------------------------
// Bezug (Zeitraum, Version, Plan/Ist) und Bezugswörter des Sachverhalts
// ------------------------------------------------------------------------------------------------

const MONATE = [
  "januar",
  "februar",
  "märz",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "dezember",
];
/** Wörter, die einen Bezug nennen (Zeitraum, Plan statt Ist, netto/brutto). */
const BEZUG_WORT = new Map<string, string>([
  ["vorjahr", "vorjahr"],
  ["vormonat", "vormonat"],
  ["plan", "plan"],
  ["geplant", "plan"],
  ["budget", "plan"],
  ["prognose", "prognose"],
  ["hochrechnung", "prognose"],
  ["netto", "netto"],
  ["brutto", "brutto"],
  ...MONATE.map((m) => [m, `monat:${m}`] as [string, string]),
]);

/** Ein Datum hinter diesen Wörtern ist ein Stand, kein Wert der Angabe. */
const STAND_VOR_DATUM = /(?:stand|fassung|gültig ab|per)\s*:?\s*$/i;

const BEZUG_MUSTER: { re: RegExp; schluessel: (m: RegExpMatchArray) => string }[] = [
  { re: /(?<![\d.,])((?:19|20)\d{2})(?![\d.,]\d)/g, schluessel: (m) => `jahr:${m[1]}` },
  { re: /\bQ([1-4])\b/gi, schluessel: (m) => `quartal:${m[1]}` },
  { re: /\b([1-4])\.\s?Quartal\b/gi, schluessel: (m) => `quartal:${m[1]}` },
  {
    re: /\b(?:Version|Fassung|Rev\.?|V)\s?(\d+(?:\.\d+)*)\b/gi,
    schluessel: (m) => `version:${m[1]}`,
  },
];

/** Wörter, die keinen Sachverhalt auszeichnen. */
const FUELL = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "eines",
  "und",
  "oder",
  "ist",
  "sind",
  "war",
  "beträgt",
  "betragen",
  "betrug",
  "liegt",
  "liegen",
  "lag",
  "bei",
  "von",
  "vom",
  "für",
  "mit",
  "auf",
  "insgesamt",
  "rund",
  "circa",
  "ca",
  "etwa",
  "laut",
  "wird",
  "werden",
  "wurde",
  "hat",
  "haben",
  "noch",
  "nur",
  "auch",
  "im",
  "in",
  "am",
  "an",
  "zum",
  "zur",
  "the",
  "and",
  "is",
  "of",
  "stand",
  "jahr",
  "quartal",
  "version",
  "fassung",
  "bild",
  "text",
  // Die Marke einer unleserlichen Stelle ist kein Bezugswort.
  "unleserlich",
]);

const WORT = /[\p{L}][\p{L}\p{N}-]*/gu;

function bezugswoerter(vorher: string): { woerter: string[]; anzeige: string[] } {
  const woerter: string[] = [];
  const anzeige: string[] = [];
  const alle = [...vorher.matchAll(WORT)].map((m) => m[0]);
  for (const w of alle.slice(-6)) {
    const klein = w.toLowerCase();
    if (klein.length < 4 || FUELL.has(klein) || BEZUG_WORT.has(klein)) {
      continue;
    }
    woerter.push(klein);
    anzeige.push(w);
  }
  return { woerter, anzeige };
}

function bezugVon(abschnitt: string, wertBereiche: readonly [number, number][]): string[] {
  const bezug = new Set<string>();
  const imWert = (i: number): boolean => wertBereiche.some(([a, b]) => i >= a && i < b);
  for (const { re, schluessel } of BEZUG_MUSTER) {
    for (const m of abschnitt.matchAll(re)) {
      if (!imWert(m.index ?? 0)) {
        bezug.add(schluessel(m));
      }
    }
  }
  for (const m of abschnitt.matchAll(WORT)) {
    const b = BEZUG_WORT.get(m[0].toLowerCase());
    if (b) {
      bezug.add(b);
    }
  }
  return [...bezug].sort();
}

// ------------------------------------------------------------------------------------------------
// Angaben eines Abschnitts
// ------------------------------------------------------------------------------------------------

interface Fund {
  art: AngabeArt;
  start: number;
  ende: number;
  wert: string;
  einheit: string;
  /** Ein Datum, das einen Stand nennt — Bezug, keine Angabe. */
  stand?: string;
}

function funde(text: string): Fund[] {
  const aus: Fund[] = [];
  const belegt = (a: number, b: number): boolean => aus.some((f) => a < f.ende && b > f.start);
  for (const m of text.matchAll(DATUM_RE)) {
    const start = m.index ?? 0;
    const iso = isoDatum(m[1] ?? "", m[2] ?? "", m[3] ?? "");
    if (!iso) {
      continue;
    }
    const stand = STAND_VOR_DATUM.test(text.slice(0, start));
    aus.push({
      art: "datum",
      start,
      ende: start + m[0].length,
      wert: iso,
      einheit: "",
      ...(stand ? { stand: `stand:${iso}` } : {}),
    });
  }
  for (const m of text.matchAll(BETRAG_RE)) {
    const start = m.index ?? 0;
    const ende = start + m[0].length;
    if (belegt(start, ende)) {
      continue;
    }
    const g = m.groups ?? {};
    const zahl = zahlWert(g.z1 ?? g.z2 ?? "");
    const waehrung = WAEHRUNG[(g.w1 ?? g.w2 ?? "").toLowerCase()];
    if (zahl === null || !waehrung) {
      continue;
    }
    // Das Vorzeichen steht vor der Währung („-€ 1.500“), vor der Zahl („€ -1.500“, „-1.500 €“).
    const faktor = vorzeichen(g.v1 ?? g.v2 ?? g.v3);
    aus.push({
      art: "betrag",
      start,
      ende,
      wert: zahlText(faktor * zahl * skala(g.s1 ?? g.s2)),
      einheit: waehrung,
    });
  }
  for (const m of text.matchAll(ZAHL_RE)) {
    const start = m.index ?? 0;
    const g = m.groups ?? {};
    const roh = g.z ?? "";
    const ende = start + (g.e ? m[0].length : (g.v?.length ?? 0) + roh.length);
    if (belegt(start, ende)) {
      continue;
    }
    // Eine allein stehende Jahreszahl ist ein Bezug, keine Angabe.
    if (!g.e && !g.v && /^(?:19|20)\d{2}$/.test(roh)) {
      continue;
    }
    // Quartal, Version und Fundstellen-Nummern („Q1“, „V2“, „Folie 3“) sind keine Angaben.
    if (/(?:\bQ|\bV|Version|Fassung|Folie|Seite|Bild|Rev\.?)\s?$/i.test(text.slice(0, start))) {
      continue;
    }
    if (/^\.\s?Quartal/i.test(text.slice(ende))) {
      continue;
    }
    const zahl = zahlWert(roh);
    if (zahl === null) {
      continue;
    }
    const einheit = g.e ? (EINHEIT[g.e.toLowerCase().replace(/\.$/, "")] ?? "") : "";
    aus.push({ art: "zahl", start, ende, wert: zahlText(vorzeichen(g.v) * zahl), einheit });
  }
  const name = NAME_RE.exec(text);
  if (name && !/\d/.test(name[2] ?? "")) {
    const wertText = name[2] ?? "";
    const start = text.lastIndexOf(wertText);
    if (!belegt(start, start + wertText.length)) {
      aus.push({
        art: "name",
        start,
        ende: start + wertText.length,
        wert: wertText.toLowerCase().replace(/\s+/g, " "),
        einheit: "",
      });
    }
  }
  return aus.sort((a, b) => a.start - b.start);
}

const AUSZUG_MAX = 200;

function auszug(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > AUSZUG_MAX ? `${t.slice(0, AUSZUG_MAX - 1)}…` : t;
}

/**
 * Das Stück (bis zum nächsten Leerraum), das an `von` in Richtung `schritt` angrenzt — `null`, wenn
 * es nicht unsicher gelesen ist. Dazwischen darf nur Leerraum stehen.
 */
function unsicheresNachbarstueck(klar: Klartext, von: number, schritt: 1 | -1): string | null {
  const leer = (i: number): boolean => /\s/.test(klar.text[i] ?? "");
  let i = von;
  while (i >= 0 && i < klar.text.length && leer(i)) {
    i += schritt;
  }
  if (i < 0 || i >= klar.text.length || !klar.unsicher[i]) {
    return null;
  }
  let a = i;
  let b = i;
  while (a > 0 && !leer(a - 1)) {
    a -= 1;
  }
  while (b + 1 < klar.text.length && !leer(b + 1)) {
    b += 1;
  }
  return klar.text.slice(a, b + 1);
}

/** Ziffern und die Buchstaben, die die Erkennung mit ihnen verwechselt (O/0, l/1, S/5, B/8 …). */
const ZAHLENAEHNLICHE_ZEICHEN = /^[\dOoQDlIi|SsBbZzGg.,'’  -]+$/;
const GRUPPENTRENNER = /[.,'’  ]/;
/** Kleinbuchstaben außer „l“ (das als 1 verlesen wird): Zeichen eines geschriebenen Wortes. */
const WORTBUCHSTABE = /[a-km-z]/;

/**
 * Ein verlesenes Zahlenstück — nicht nur aus verwechselbaren Zeichen, sondern auch in der FORM
 * einer Zahl: mit Gruppentrenner („l.OOO“) oder ohne Kleinbuchstaben außer „l“ („OOO“, „lOO“).
 * Nacharbeit 10 (Ben): ein gewöhnlich geschriebenes Wort wie „Solo“ ist ein eigenständiges
 * Bezugswort, kein Zahlenpräfix — es macht den Betrag daneben nicht unsicher.
 */
function zahlenaehnlich(s: string): boolean {
  return ZAHLENAEHNLICHE_ZEICHEN.test(s) && (GRUPPENTRENNER.test(s) || !WORTBUCHSTABE.test(s));
}

/**
 * Gehört ein unsicher gelesenes Nachbarstück zur Zahlengruppe des Treffers? Das ist es, wenn es
 * unmittelbar angrenzt (nur Leerraum dazwischen) und unleserlich ist, eine Ziffer trägt, höchstens
 * drei Zeichen lang ist (eine verlesene Ziffer wie „O“ oder „l“) oder — Nacharbeit 9 (Ben) — nur
 * aus Zeichen besteht, die die Erkennung mit Ziffern verwechselt, und die Form einer Zahl hat
 * (`zahlenaehnlich`, „l.OOO“). Ein unsicher gelesenes Bezugswort wie „Gesamtsumme“ oder „Solo“
 * macht den Betrag nicht unsicher. Gibt das Stück zurück, sonst `null`. Ob ein so gefundenes
 * Stück in Wahrheit ein eigenständiges Bezugswort ist („BOSS“), entscheidet erst der Vergleich
 * mit dem Text (`eigenstaendigesBezugswort`).
 */
function unsicheresGruppenstueck(klar: Klartext, start: number, ende: number): string | null {
  const davor = unsicheresNachbarstueck(klar, start - 1, -1);
  const danach = unsicheresNachbarstueck(klar, ende, 1);
  const passt = (s: string | null): s is string =>
    s !== null &&
    (s.includes("[unleserlich]") || /\d/.test(s) || s.length <= 3 || zahlenaehnlich(s));
  return [davor, danach].find(passt) ?? null;
}

/**
 * Nacharbeit 11 (Ben): Ist das unsichere Nachbarstück ein eigenständiges Bezugswort? Das ist es,
 * wenn genau dieses Wort auch im verglichenen Dokumenttext als Bezugswort desselben Sachverhalts
 * steht („BOSS 1.500 €“ gegenüber „[?BOSS] 800 €“). Ein verlesenes Zahlenpräfix („l.OOO“, „O“)
 * oder eine unleserliche Stelle steht dort nie — es bleibt Teil der Zahlengruppe.
 */
function eigenstaendigesBezugswort(stueck: string, text: Angabe): boolean {
  const wort = stueck.toLowerCase();
  return /^\p{L}+$/u.test(wort) && text.bezugswoerter.some((w) => gleichesWort(w, wort));
}

/** Die Angaben eines Abschnitts (Satz bzw. Bildzeile). `gekennzeichnet`: mit `[?…]`-Marken. */
export function angabenIn(gekennzeichnet: string, fundstelle: AngabeFundstelle): Angabe[] {
  const klar = ohneMarken(gekennzeichnet);
  const alle = funde(klar.text);
  const werte = alle.filter((f) => !f.stand);
  const bereiche = werte.map((f) => [f.start, f.ende] as [number, number]);
  const bezugBasis = bezugVon(klar.text, bereiche);
  const staende = alle.flatMap((f) => (f.stand ? [f.stand] : []));
  const bezug = [...new Set([...bezugBasis, ...staende])].sort();
  const aus: Angabe[] = [];
  let vorEnde = 0;
  for (const f of werte) {
    let vorher = klar.text.slice(vorEnde, f.start);
    if (bezugswoerter(vorher).woerter.length === 0 && f.art !== "name") {
      // Kein Bezugswort davor („1.500 € Gesamtsumme“): die Wörter danach bis zur nächsten Angabe.
      const naechste = werte.find((x) => x.start >= f.ende);
      vorher = klar.text.slice(f.ende, naechste ? naechste.start : undefined);
    }
    const { woerter, anzeige } = bezugswoerter(vorher);
    vorEnde = f.ende;
    if (woerter.length === 0) {
      continue;
    }
    // Unsicher ist die Angabe, wenn eine ihrer Ziffern (bei Namen: ein Zeichen) unsicher gelesen
    // ist — ein unsicheres „€“ allein macht die Zahl nicht unsicher.
    let unsicher = false;
    for (let i = f.start; i < f.ende; i += 1) {
      if (klar.unsicher[i] && (f.art === "name" || /\d/.test(klar.text[i] ?? ""))) {
        unsicher = true;
      }
    }
    // Nacharbeit 8 (Ben): ein unsicheres Stück DERSELBEN Zahlengruppe („[unleserlich] 800 €“,
    // „[?O] 800 €“) macht auch den sicher gelesenen Teilbetrag unsicher.
    let nachbar: string | null = null;
    if (!unsicher && f.art !== "name" && f.art !== "datum") {
      nachbar = unsicheresGruppenstueck(klar, f.start, f.ende);
      unsicher = nachbar !== null;
    }
    aus.push({
      art: f.art,
      wortlaut: klar.text.slice(f.start, f.ende).trim(),
      wert: f.wert,
      einheit: f.einheit,
      bezugswoerter: woerter,
      woerterImWortlaut: anzeige,
      bezug,
      unsicher,
      ...(nachbar !== null ? { unsicherDurchNachbar: nachbar } : {}),
      fundstelle: { ...fundstelle, auszug: auszug(klar.text) },
    });
  }
  // Ein unleserliches Wort an der Stelle eines Werts: „Gesamtsumme: [unleserlich] €“ — die Angabe
  // ist da, ihr Wert nicht. Sie zählt als unsichere Erkennung.
  const unleserlich = /\[unleserlich\]\s?(€|EUR|Euro|USD|\$|CHF)?/giu;
  for (const m of klar.text.matchAll(unleserlich)) {
    const start = m.index ?? 0;
    const { woerter, anzeige } = bezugswoerter(klar.text.slice(0, start));
    if (woerter.length === 0) {
      continue;
    }
    const waehrung = m[1] ? WAEHRUNG[m[1].toLowerCase()] : undefined;
    aus.push({
      art: waehrung ? "betrag" : "zahl",
      wortlaut: m[0].trim(),
      wert: "?",
      einheit: waehrung ?? "",
      bezugswoerter: woerter,
      woerterImWortlaut: anzeige,
      bezug,
      unsicher: true,
      fundstelle: { ...fundstelle, auszug: auszug(klar.text) },
    });
  }
  return aus;
}

// ------------------------------------------------------------------------------------------------
// Dokumenttext und Bilder in Abschnitte
// ------------------------------------------------------------------------------------------------

/** Satzende — nicht hinter einer Ordnungszahl („im 1. Quartal“). */
const SATZ_RE = /(?<!(?:^|\s)\d{1,2}\.)(?<=[.!?])\s+(?=[A-ZÄÖÜ„"])/u;

export function dokumentAngaben(dokumentText: string): Angabe[] {
  const aus: Angabe[] = [];
  const absaetze = dokumentText.split(/\n+/).filter((a) => a.trim().length > 0);
  for (const [ai, absatz] of absaetze.entries()) {
    for (const [si, satz] of absatz.split(SATZ_RE).entries()) {
      if (satz.trim()) {
        const fundstelle: AngabeFundstelle = {
          art: "dokument",
          absatz: ai + 1,
          satz: si + 1,
          auszug: "",
        };
        aus.push(...angabenIn(satz, fundstelle));
      }
    }
  }
  return aus;
}

export function bildAngaben(k: KlaraBildKontext): Angabe[] {
  const aus: Angabe[] = [];
  for (const e of k.eintraege) {
    if (!e.text) {
      continue;
    }
    for (const [zi, zeile] of e.text.split(/\n+/).entries()) {
      if (zeile.trim()) {
        const fundstelle: AngabeFundstelle = {
          art: "bild",
          quelle: e.quelle,
          ort: e.ort,
          fundstelle: e.fundstelle,
          zeile: zi + 1,
          auszug: "",
        };
        aus.push(...angabenIn(zeile, fundstelle));
      }
    }
  }
  return aus;
}

// ------------------------------------------------------------------------------------------------
// Vergleich
// ------------------------------------------------------------------------------------------------

/** Gleiches Bezugswort — auch in Beugung („Gesamtsumme“/„Gesamtsummen“). */
function gleichesWort(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const kurz = Math.min(a.length, b.length);
  return kurz >= 5 && a.slice(0, kurz) === b.slice(0, kurz) && Math.abs(a.length - b.length) <= 2;
}

/** Steht jedes Bezugswort von `teil` auch in `ganz`? */
function enthalten(teil: readonly string[], ganz: readonly string[]): boolean {
  return teil.length > 0 && teil.every((x) => ganz.some((y) => gleichesWort(x, y)));
}

/**
 * Derselbe Sachverhalt: Art, Einheit, Bezug — und die Bezugswörter der einen Seite stehen alle
 * auch auf der anderen. Trägt JEDE Seite ein eigenes, unterscheidendes Wort („Gesamtsumme Projekt
 * Nord“ gegenüber „Gesamtsumme Projekt West“), sind es verschiedene Sachverhalte. Nennt nur eine
 * Seite mehr („Abrechnung Projekt Nord … Gesamtsumme“ gegenüber „Gesamtsumme“), bleibt es derselbe.
 */
export function derselbeSachverhalt(a: Angabe, b: Angabe): boolean {
  return (
    a.art === b.art &&
    a.einheit === b.einheit &&
    a.bezug.join("|") === b.bezug.join("|") &&
    (enthalten(a.bezugswoerter, b.bezugswoerter) || enthalten(b.bezugswoerter, a.bezugswoerter))
  );
}

function gleicherWert(a: Angabe, b: Angabe): boolean {
  if (a.art === "betrag" || a.art === "zahl") {
    const x = Number(a.wert);
    const y = Number(b.wert);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
  }
  return a.wert === b.wert;
}

/**
 * Die möglichen Abweichungen zwischen Dokumenttext und erkanntem Bildtext. Liest nur; weder Text
 * noch Befund werden verändert.
 */
export function bildWidersprueche(dokumentText: string, k: KlaraBildKontext): BildTextAbweichung[] {
  const text = dokumentAngaben(dokumentText);
  const bild = bildAngaben(k);
  const aus: BildTextAbweichung[] = [];
  const gesehen = new Set<string>();
  for (const d of text) {
    if (d.unsicher) {
      continue;
    }
    for (const roh of bild) {
      // Nacharbeit 11 (Ben): kam die Unsicherheit nur von einem Nachbarstück, das in Wahrheit ein
      // eigenständiges Bezugswort dieses Sachverhalts ist, gelten die sicher gelesenen Ziffern.
      const b =
        roh.unsicherDurchNachbar !== undefined &&
        eigenstaendigesBezugswort(roh.unsicherDurchNachbar, d)
          ? { ...roh, unsicher: false }
          : roh;
      if (!derselbeSachverhalt(d, b) || (!b.unsicher && gleicherWert(d, b))) {
        continue;
      }
      // Ein unsicher gelesener Wert, der zufällig gleich ist, ist kein Hinweis.
      if (b.unsicher && b.wert !== "?" && gleicherWert(d, b)) {
        continue;
      }
      const fb = b.fundstelle;
      const fd = d.fundstelle;
      const schluessel = [
        d.wert,
        b.wert,
        fd.art === "dokument" ? `${fd.absatz}.${fd.satz}` : "",
        fb.art === "bild" ? `${fb.quelle}|${fb.fundstelle.bild}|${fb.zeile}` : "",
      ].join("§");
      if (gesehen.has(schluessel)) {
        continue;
      }
      gesehen.add(schluessel);
      // Der Sachverhalt im Wortlaut des Texts: genau die Bezugswörter, die auch das Bild trägt.
      const gemeinsam = d.woerterImWortlaut.filter((_, i) =>
        b.bezugswoerter.some((y) => gleichesWort(d.bezugswoerter[i] ?? "", y)),
      );
      aus.push({
        art: b.unsicher ? "unsichere-erkennung" : "moeglicher-widerspruch",
        angabeArt: d.art,
        sachverhalt: gemeinsam.join(" "),
        text: d,
        bild: b,
      });
    }
  }
  return aus;
}

/** Wo eine Angabe steht, im Wortlaut der Oberfläche. */
export function angabeOrt(a: Angabe, t: Uebersetze): string {
  const f = a.fundstelle;
  return f.art === "dokument"
    ? t("bildwidersprueche.ort.text", { absatz: f.absatz, satz: f.satz })
    : t("bildwidersprueche.ort.bild", { quelle: f.quelle, ort: f.ort, zeile: f.zeile });
}

/**
 * Der Zusatz zur Anweisung an Klara: beide Angaben mit Fundstelle nennen und nicht entscheiden,
 * welche stimmt. Leer ohne Abweichung.
 */
export function widerspruchsAnweisung(
  abweichungen: readonly BildTextAbweichung[],
  t: Uebersetze,
): string {
  if (abweichungen.length === 0) {
    return "";
  }
  const stellen = abweichungen.map((a) =>
    t(
      a.art === "unsichere-erkennung"
        ? "bildwidersprueche.anweisung.unsicher"
        : "bildwidersprueche.anweisung.stelle",
      {
        sachverhalt: a.sachverhalt,
        text: a.text.wortlaut,
        textOrt: angabeOrt(a.text, t),
        bild: a.bild.wortlaut,
        bildOrt: angabeOrt(a.bild, t),
      },
    ),
  );
  return [t("bildwidersprueche.anweisung.kopf"), ...stellen].join(" ");
}
