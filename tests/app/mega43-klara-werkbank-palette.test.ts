// ================================================================================================
// AUFTRAG-mega43 BLOCK B — DER SAMMLER GEGEN DIE ZWEITE WAHRHEIT.
// AUFTRAG-mega44 — bens drei Waechter-Auflagen (sammel42, GESAMTVERDIKT GELB) eingearbeitet.
// ================================================================================================
//
// Klara (apps/web/public/word-addin/taskpane.html) ist buildlos: kein Tailwind, kein Import, kein
// Bündler. Sie KANN styles/themes.css nicht laden und muss die Werkbank-Palette deshalb ein zweites
// Mal aufschreiben — als Hex statt als Kanal-Tripel. Genau da entsteht unsere Fehlerklasse: zwei
// Wahrheiten, die auseinanderdriften. Dieser Sammler hält sie zusammen.
//
// Er arbeitet über die BAUFORM, nicht über eine Liste der heutigen Fälle:
//   1. Er liest JEDEN Farbwert aus Klaras <style>-Block UND aus jedem sichtbaren Inline-Stil —
//      Hex, rgb() und rgba() — und verlangt, dass jeder einzelne Ziffer für Ziffer ein Wert der
//      Werkbank-Palette ([data-theme="modern"] in apps/web/src/styles/themes.css) ist.
//   2. Er liest Klaras DEKLARIERTE Zuordnung: jede Farbvariable in :root trägt im Kommentar ein
//      „← --kw-token". Der Sammler löst das Token in themes.css auf und vergleicht. Eine
//      Farbvariable OHNE solche Bindung ist rot — so kann kein unverbundener Wert nachwachsen.
//   3. Er prüft das Schatten-Rezept (--shadow-tile ↔ --kw-shadow-tile) nach derselben Regel.
//   4. Er verlangt, dass das alte Violett #5b50c4 als Akzent verschwunden ist (BLOCK B2) — und
//      pinnt zugleich in themes.css, dass #5b50c4 dort weiterhin die KI-Kennfarbe --kw-ai ist.
//   5. Er MISST den Kontrast der texttragenden Paare (BLOCK B3) mit der Rechenfunktion aus
//      tests/app/mega40-kontrast-modern.test.ts.
//
// mega44 schärft drei Waechter, die enger waren als ihr Anspruch (bens G1/G2/G3):
//   A1 · ALPHA ZAEHLT MIT. Ein Farbwert ist {r,g,b,a}, kanonisch „#RRGGBB" (deckend) bzw.
//        „#RRGGBB/a". Eine reine Alpha-Drift ist damit rot. Legitim sind (a) deckende Paletten-
//        werte und (b) genau die Alpha-Rezepte, die die Werkbank selbst führt (aus themes.css
//        gelesen: `rgb(var(--kw-X) / a)`) — alles andere braucht eine benannte Alpha-Ausnahme.
//   A2 · INLINE-STILE GEHOEREN DAZU. Entscheidung: die Farbwertsuche wird auf sichtbare
//        style="…"-Attribute ausgeweitet, statt Farbliterale dort bloss zu verbieten. Begründung:
//        ein Verbot kennt nur „Literal ja/nein"; die Ausweitung bindet einen Inline-Wert an
//        dieselbe Palette UND liefert ihn zugleich als Kontrastpaar (B1) mit. Der heutige
//        Inline-Stil `style="color: var(--muted)"` enthält kein Literal und bleibt grün — er wird
//        jetzt sogar zusätzlich GEMESSEN.
//   B1 · DIE KONTRASTPAARE ENTSTEHEN AUS DER BAUFORM. Jede Regel, die `color` setzt (und jeder
//        Inline-Stil, der das tut), ist ein texttragendes Paar. Die Fläche kommt aus der eigenen
//        `background`-Deklaration; fehlt sie oder ist sie durchsichtig, aus dem nächsten deckenden
//        Vorfahren — ermittelt über die Regel-Struktur, angewandt auf Klaras Markup. Keine Liste
//        heutiger Paare mehr.
//   C1 · VIOLETT WIRD SELEKTORGEBUNDEN. Jede Violett-Fundstelle muss einem benannten Selektor mit
//        Grund zugeordnet sein — auch bei nichtleerer KI_STELLEN-Liste. Einträge ohne Fundstelle
//        sind Leichen und rot.
//
// BENANNTE GRENZEN (was dieser Sammler NICHT leistet — er behauptet es auch nicht):
//   · Er liest QUELLTEXT, keine berechneten Stile. Browser-Voreinstellungen, Vererbung in
//     Elemente ohne eigene `color`-Regel, Zustands- und Pseudo-Regeln (`:disabled`,
//     `:focus-visible`) bleiben dem vorgemerkten Playwright-Computed-Style-Pin vorbehalten.
//     B1 ERSETZT DIESEN PIN NICHT.
//   · Nicht-Text-Kontraste (Fokusring, Rahmen, Balken) sind nicht Gegenstand; gemessen wird, was
//     `color` setzt.
//   · Benannte CSS-Farbwörter (`red`, `rebeccapurple`, …) und `currentColor` erkennt der Sammler
//     nicht als Farbe — dafür steht der Wortwächter unten: ein unbekanntes Wort in einer
//     farbtragenden Eigenschaft ist rot statt still.
//
// WARUM DIE KONTRAST-FUNKTION EXTRAHIERT UND NICHT IMPORTIERT WIRD (benannte Grenze):
// `contrast` ist in mega40-kontrast-modern.test.ts nicht exportiert, und ein `import` aus einer
// TESTdatei hätte in Vitest eine echte Nebenwirkung: die describe/it-Blöcke der importierten Datei
// würden bei der Sammlung DIESER Datei ein zweites Mal registriert und liefen doppelt. Statt die
// Formel abzuschreiben (das wäre die dritte Wahrheit an einem Auftrag GEGEN zweite Wahrheiten),
// liest dieser Sammler den QUELLTEXT der drei Funktionen aus mega40, lässt ihn vom TypeScript-
// Compiler übersetzen und führt ihn aus. Die Formel wohnt also weiterhin an genau einer Stelle;
// verschwindet oder verrutscht sie dort, ist dieser Test rot statt still.
//
// KALIBRIERUNG: die Sonden entstehen unten IM TEST (mutierte Kopien des Stil-Textes bzw. des
// Markups), nie als Datei im Produktbaum.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const REPO = join(__dirname, "../..");
const TASKPANE = join(REPO, "apps/web/public/word-addin/taskpane.html");
const THEMES_DATEI = join(REPO, "apps/web/src/styles/themes.css");
const MEGA40 = join(REPO, "tests/app/mega40-kontrast-modern.test.ts");

// ================================================================================================
// Quellen lesen
// ================================================================================================

const HTML = readFileSync(TASKPANE, "utf8");

function stilBlock(html: string): string {
  const start = html.indexOf("<style>");
  const end = html.indexOf("</style>", start);
  if (start < 0 || end < 0) {
    throw new Error("taskpane.html: <style>-Block nicht gefunden");
  }
  return html.slice(start + "<style>".length, end);
}

const STIL = stilBlock(HTML);

// Kommentare gehören nicht zur Darstellung: der Erklärtext DARF (und soll) die alten Werte nennen,
// damit die Entscheidung nachlesbar bleibt. Gemessen wird nur, was der Browser sieht.
function ohneKommentare(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const THEMES = ohneKommentare(readFileSync(THEMES_DATEI, "utf8"));

function cssBlock(quelle: string, selektor: string): string {
  const start = quelle.indexOf(`${selektor} {`);
  const end = quelle.indexOf("}", start);
  if (start < 0 || end < 0) {
    throw new Error(`themes.css: Block ${selektor} nicht gefunden`);
  }
  return quelle.slice(start, end);
}

const MODERN_BLOCK = cssBlock(THEMES, '[data-theme="modern"]');
const ROOT_BLOCK = cssBlock(THEMES, ":root");

// ================================================================================================
// A1 — EINE FARBE IST {r,g,b,a}. Kanonisch: „#RRGGBB" deckend, sonst „#RRGGBB/a".
// ================================================================================================

type Rgb = [number, number, number];
type Farbe = { basis: string; alpha: number };

function hexAus(rgb: Rgb): string {
  return `#${rgb.map((k) => k.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function rgbAusHex(hex: string): Rgb {
  const roh = hex.slice(1);
  const voll =
    roh.length === 3
      ? roh
          .split("")
          .map((z) => z + z)
          .join("")
      : roh;
  return [0, 2, 4].map((i) => Number.parseInt(voll.slice(i, i + 2), 16)) as Rgb;
}

/** Eine Alphaangabe in EINER Schreibweise — „0.45", „0.5", nie „0.450" oder „.45". */
function alphaText(a: number): string {
  return String(Number(a.toFixed(4)));
}

/** Die kanonische Form: hier — und nur hier — entscheidet sich, ob Alpha mitzählt. */
function kanonisch(f: Farbe): string {
  return f.alpha >= 1 ? f.basis : `${f.basis}/${alphaText(f.alpha)}`;
}

// Komma-Schreibweise (Klara, buildlos) und Schrägstrich-Schreibweise (themes.css, modern CSS).
const RGB_KOMMA = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
const RGB_SCHRAEG = /rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)/g;
const HEX_LITERAL = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

/** Eine einzelne Farbangabe (#abc, #aabbcc, rgb(…), rgba(…)) als {r,g,b,a}. */
function alsFarbe(wert: string): Farbe | null {
  const roh = wert.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(roh) || /^#[0-9a-fA-F]{6}$/.test(roh)) {
    return { basis: hexAus(rgbAusHex(roh)), alpha: 1 };
  }
  for (const muster of [RGB_KOMMA, RGB_SCHRAEG]) {
    const treffer = new RegExp(`^${muster.source}$`).exec(roh);
    if (treffer) {
      return {
        basis: hexAus([
          Number.parseInt(treffer[1] as string, 10),
          Number.parseInt(treffer[2] as string, 10),
          Number.parseInt(treffer[3] as string, 10),
        ]),
        alpha: treffer[4] === undefined ? 1 : Number.parseFloat(treffer[4]),
      };
    }
  }
  return null;
}

/** Alle Farbangaben in einem beliebigen Textstück, in Fundreihenfolge. */
function farbenIn(text: string): { farbe: Farbe; roh: string }[] {
  const raus: { farbe: Farbe; roh: string }[] = [];
  for (const t of text.matchAll(HEX_LITERAL)) {
    raus.push({ farbe: { basis: hexAus(rgbAusHex(t[0])), alpha: 1 }, roh: t[0] });
  }
  for (const muster of [RGB_KOMMA, RGB_SCHRAEG]) {
    for (const t of text.matchAll(new RegExp(muster.source, "g"))) {
      raus.push({
        farbe: {
          basis: hexAus([
            Number.parseInt(t[1] as string, 10),
            Number.parseInt(t[2] as string, 10),
            Number.parseInt(t[3] as string, 10),
          ]),
          alpha: t[4] === undefined ? 1 : Number.parseFloat(t[4]),
        },
        roh: t[0],
      });
    }
  }
  return raus;
}

/** Alle Farb-Tripel eines themes.css-Blocks: --kw-name → #RRGGBB. */
function tokenKarte(block: string): Map<string, string> {
  const karte = new Map<string, string>();
  for (const treffer of block.matchAll(/--kw-([a-z0-9-]+):\s*(\d+) (\d+) (\d+);/g)) {
    karte.set(
      treffer[1] as string,
      hexAus([
        Number.parseInt(treffer[2] as string, 10),
        Number.parseInt(treffer[3] as string, 10),
        Number.parseInt(treffer[4] as string, 10),
      ]),
    );
  }
  return karte;
}

const MODERN_TOKEN = tokenKarte(MODERN_BLOCK);
const ROOT_TOKEN = tokenKarte(ROOT_BLOCK);

/** Die Werkbank-Palette: die DECKENDEN Werte, die das modern-Thema kennt. */
const PALETTE = new Set(MODERN_TOKEN.values());

/**
 * A1 · Die Alpha-Rezepte der Werkbank — aus themes.css GELESEN, nicht aufgezählt: jedes
 * `rgb(var(--kw-X) / a)` im modern-Block ist ein legitimer halbtransparenter Wert. Klara darf
 * genau diese führen, ohne Ausnahme zu brauchen; alles andere braucht eine benannte.
 */
function alphaRezepte(block: string): Map<string, string> {
  const karte = new Map<string, string>();
  for (const t of block.matchAll(/rgba?\(\s*var\(--kw-([a-z0-9-]+)\)\s*\/\s*([\d.]+)\s*\)/g)) {
    const token = t[1] as string;
    const hex = MODERN_TOKEN.get(token) ?? ROOT_TOKEN.get(token);
    if (hex) {
      karte.set(kanonisch({ basis: hex, alpha: Number.parseFloat(t[2] as string) }), token);
    }
  }
  return karte;
}

const ALPHA_REZEPTE = alphaRezepte(MODERN_BLOCK);

// ================================================================================================
// BENANNTE AUSNAHMEN — jede mit Grund, jede an die Wahrheit gebunden, keine pauschale.
// ================================================================================================
//
// Eine Ausnahme ist KEIN Freibrief: sie nennt das Token, aus dem der Wert kommt, und der Sammler
// prüft (a) dass der :root-Wert genau dieser ist und (b) dass der modern-Block ihn WIRKLICH nicht
// überschreibt. Sobald eine spätere Scheibe das tut, wird diese Ausnahme rot.
type Ausnahme = { wert: string; rootToken: string; grund: string };

const AUSNAHMEN: Ausnahme[] = [
  {
    wert: "#A8560A",
    rootToken: "brand-text",
    grund:
      "Marken-Textton. themes.css überschreibt --kw-brand-text im modern-Block ABSICHTLICH nicht: " +
      "Funke dunkel (#C2500A) misst als Text auf Papier nur 4,45:1 und fiele unter AA. Im " +
      "modern-Thema ist deshalb der :root-Wert #a8560a wirksam (Kaskade) — Klara führt genau ihn " +
      "für Links und den aktiven Reiter.",
  },
];

// A1 · Alpha-Ausnahmen: ein halbtransparenter Wert, den die Werkbank so NICHT führt. Er bleibt an
// ein Paletten-Token gebunden (die FARBE darf nicht driften), nur die Deckung ist eigen — und
// genau das muss benannt und begründet sein.
type AlphaAusnahme = { wert: string; basisToken: string; grund: string };

const ALPHA_AUSNAHMEN: AlphaAusnahme[] = [
  {
    wert: "#E8630A/0.45",
    basisToken: "brand",
    grund:
      "Streulicht unter dem Hauptknopf (button.primary). Die Werkbank führt Alpha-Schatten nur in " +
      "Nacht (--kw-shadow-tile/--kw-shadow-popover, 0.05/0.12/0.16) — für einen farbigen " +
      "Knopfschatten gibt es kein Token. Die FARBE bleibt trotzdem gebunden: es ist der Funke " +
      "(--kw-brand, #E8630A), nicht ein zweiter Orangeton. Nur die Deckung ist mit 0,45 bewusst " +
      "kräftiger als die Kachel-Rezepte, weil ein 10px-Streulicht bei 0,12 unsichtbar wäre.",
  },
];

// B2 · Regel-Ausnahmen: Regeln, die der Kontrast-Sammler nicht als Paar messen KANN oder DARF.
// Auch hier gilt: benannt, begründet, und eine unbenutzte Ausnahme ist rot.
type RegelAusnahme = { selektor: string; grund: string };

const REGEL_AUSNAHMEN: RegelAusnahme[] = [
  {
    selektor: "button.primary:disabled",
    grund:
      "Abschwächung (opacity: 0.5) an einem DEAKTIVIERTEN Bedienelement. WCAG 2.1 SC 1.4.3 nimmt " +
      "inaktive Bedienelemente ausdrücklich von der Kontrastanforderung aus — die Abschwächung IST " +
      "hier das sichtbare Zeichen der Inaktivität, und der Knopf trägt in diesem Zustand keine " +
      "Handlung. Bestandsverhalten, unverändert seit vor mega43 (bens Punkt 5 aus sammel42).",
  },
];

// ================================================================================================
// C1 — VIOLETT BLEIBT DER KI VORBEHALTEN, UND ZWAR SELEKTORGEBUNDEN.
// ================================================================================================
//
// Klaras Oberfläche behauptet an KEINER Stelle, dass eine KI etwas erzeugt hat: die Antwort kommt
// quellengebunden aus validiertem Werkswissen, ohne Grundlage bleibt die Frage offen. Es gibt im
// Panel also keine Fläche mit der Bedeutung „hier hat KI gearbeitet" — die Liste ist LEER, und das
// ist die Entscheidung, nicht ein Versehen.
//
// mega44/C1: Ein Eintrag gibt Violett NICHT global frei, sondern ausschliesslich an seinem
// Selektor. Jede andere Violett-Fundstelle bleibt rot, auch wenn die Liste nicht leer ist; ein
// Eintrag ohne Fundstelle ist eine Leiche und ebenfalls rot.
type KiStelle = { selektor: string; grund: string };

const KI_STELLEN: KiStelle[] = [];

const VIOLETT_TOKEN = "ai";

// ================================================================================================
// DIE BAUFORM — CSS-Regeln und Markup als lesbare Struktur (Grundlage für A2, B1 und C1).
// ================================================================================================

type Teil = { tag: string | null; klassen: string[]; id: string | null; stil: string };

type Regel = {
  selektor: string;
  teile: Teil[];
  lesbar: boolean;
  dekl: Map<string, string>;
};

function teilAusSelektor(roh: string): Teil | null {
  if (roh === "*") {
    return { tag: null, klassen: [], id: null, stil: "" };
  }
  // Pseudo-, Attribut- und Kombinator-Selektoren versteht der Sammler NICHT — er sagt das (unten),
  // statt sie still zu überspringen.
  const teile = roh.match(/^([a-zA-Z][a-zA-Z0-9-]*)?((?:[.#][A-Za-z0-9_-]+)*)$/);
  if (!teile || (teile[1] === undefined && (teile[2] ?? "") === "")) {
    return null;
  }
  const rest = teile[2] ?? "";
  const klassen = [...rest.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1] as string);
  const ids = [...rest.matchAll(/#([A-Za-z0-9_-]+)/g)].map((m) => m[1] as string);
  return {
    tag: teile[1] ? teile[1].toLowerCase() : null,
    klassen,
    id: ids[0] ?? null,
    stil: "",
  };
}

/** Klaras <style>-Block als Regelliste (Quellreihenfolge = Kaskade). Keine at-Regeln erwartet. */
function stilRegeln(stil: string): Regel[] {
  const css = ohneKommentare(stil);
  const regeln: Regel[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selektorListe = (m[1] ?? "").trim();
    const dekl = new Map<string, string>();
    for (const d of (m[2] ?? "").split(";")) {
      const i = d.indexOf(":");
      if (i > 0) {
        dekl.set(d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim());
      }
    }
    for (const einzeln of selektorListe.split(",")) {
      const roh = einzeln.trim();
      if (roh === "") {
        continue;
      }
      const teile = roh.split(/\s+/).map(teilAusSelektor);
      regeln.push({
        selektor: roh,
        teile: teile.filter((t): t is Teil => t !== null),
        lesbar: teile.every((t) => t !== null) && teile.length > 0,
        dekl,
      });
    }
  }
  return regeln;
}

const LEERE_ELEMENTE = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function attribut(roh: string, name: string): string | null {
  const m = roh.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? (m[1] as string) : null;
}

type Elem = { pfad: Teil[]; ort: string };

function ortAus(teil: Teil): string {
  return `${teil.tag ?? "*"}${teil.id ? `#${teil.id}` : ""}${teil.klassen.map((k) => `.${k}`).join("")}`;
}

/** Klaras Markup ab </style>: je Element sein Pfad von <body> abwärts. Skripte/Kommentare raus. */
function markupElemente(html: string): Elem[] {
  const nachStil = html.slice(html.indexOf("</style>") + "</style>".length);
  const rumpf = nachStil
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "");
  const elemente: Elem[] = [];
  const stapel: Teil[] = [];
  for (const m of rumpf.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g)) {
    const tag = (m[1] as string).toLowerCase();
    const rest = m[2] ?? "";
    if ((m[0] as string).startsWith("</")) {
      for (let i = stapel.length - 1; i >= 0; i -= 1) {
        if ((stapel[i] as Teil).tag === tag) {
          stapel.length = i;
          break;
        }
      }
      continue;
    }
    const klassen = (attribut(rest, "class") ?? "").split(/\s+/).filter((k) => k !== "");
    const teil: Teil = {
      tag,
      klassen,
      id: attribut(rest, "id"),
      stil: attribut(rest, "style") ?? "",
    };
    const pfad = [...stapel, teil];
    elemente.push({ pfad, ort: pfad.map(ortAus).join(" > ") });
    if (!LEERE_ELEMENTE.has(tag) && !rest.trim().endsWith("/")) {
      stapel.push(teil);
    }
  }
  return elemente;
}

function teilPasst(muster: Teil, echt: Teil): boolean {
  if (muster.tag !== null && muster.tag !== echt.tag) {
    return false;
  }
  if (muster.id !== null && muster.id !== echt.id) {
    return false;
  }
  return muster.klassen.every((k) => echt.klassen.includes(k));
}

/** Passt eine Regel auf das letzte Element eines Pfades? (Nachkommen-Kombinator, in Reihenfolge.) */
function regelPasst(teile: Teil[], pfad: Teil[]): boolean {
  const ziel = teile[teile.length - 1];
  const letzte = pfad[pfad.length - 1];
  if (!ziel || !letzte || !teilPasst(ziel, letzte)) {
    return false;
  }
  let idx = pfad.length - 2;
  for (let t = teile.length - 2; t >= 0; t -= 1) {
    let gefunden = false;
    while (idx >= 0) {
      const kandidat = pfad[idx] as Teil;
      idx -= 1;
      if (teilPasst(teile[t] as Teil, kandidat)) {
        gefunden = true;
        break;
      }
    }
    if (!gefunden) {
      return false;
    }
  }
  return true;
}

// ================================================================================================
// DAS MODELL — Stil + Markup als eine Eingabe, damit die Kalibrier-Sonden BEIDES verstellen können.
// ================================================================================================

type Inline = { ort: string; pfad: Teil[]; text: string };

type Modell = {
  stil: string;
  regeln: Regel[];
  variablen: Map<string, { wert: string; gebundenAn: string[] }>;
  elemente: Elem[];
  inline: Inline[];
};

/** Klaras :root — Variablenname → { wert, gebundenAn[] } aus der „← --kw-…"-Anschrift. */
function klaraVariablen(stil: string): Map<string, { wert: string; gebundenAn: string[] }> {
  const start = stil.indexOf(":root {");
  const ende = stil.indexOf("}", start);
  if (start < 0 || ende < 0) {
    throw new Error("taskpane.html: :root-Block im <style> nicht gefunden");
  }
  const block = stil.slice(start, ende);
  const karte = new Map<string, { wert: string; gebundenAn: string[] }>();
  for (const zeile of block.split("\n")) {
    const dekl = zeile.match(/^\s*--([a-z0-9-]+):\s*([^;]+);/);
    if (!dekl) {
      continue;
    }
    const wert = (dekl[2] as string).trim();
    const kommentar = zeile.slice(zeile.indexOf(";")).match(/\/\*([\s\S]*?)\*\//);
    const anschrift = kommentar?.[1] ?? "";
    const pfeil = anschrift.indexOf("←");
    const gebundenAn =
      pfeil >= 0
        ? [...anschrift.slice(pfeil).matchAll(/--kw-([a-z0-9-]+)/g)].map((m) => m[1] as string)
        : [];
    karte.set(dekl[1] as string, { wert, gebundenAn });
  }
  return karte;
}

function baue(stil: string = STIL, html: string = HTML): Modell {
  const elemente = markupElemente(html);
  return {
    stil,
    regeln: stilRegeln(stil),
    variablen: klaraVariablen(stil),
    elemente,
    // A2 · sichtbare Inline-Stile sind eine Farbquelle wie jede andere.
    inline: elemente
      .filter((e) => (e.pfad[e.pfad.length - 1] as Teil).stil.trim() !== "")
      .map((e) => ({
        ort: `${e.ort} [style]`,
        pfad: e.pfad,
        text: (e.pfad[e.pfad.length - 1] as Teil).stil,
      })),
  };
}

/** Jede Farbangabe, die der Browser sieht — mit dem ORT, an dem sie steht (Selektor bzw. Inline). */
type Farbfund = { farbe: Farbe; roh: string; ort: string };

function farbfunde(m: Modell): Farbfund[] {
  const raus: Farbfund[] = [];
  for (const regel of m.regeln) {
    for (const [eigenschaft, wert] of regel.dekl) {
      for (const f of farbenIn(wert)) {
        raus.push({ ...f, ort: `${regel.selektor} { ${eigenschaft} }` });
      }
    }
  }
  for (const quelle of m.inline) {
    for (const f of farbenIn(quelle.text)) {
      raus.push({ ...f, ort: quelle.ort });
    }
  }
  return raus;
}

// Farbtragende Eigenschaften: hier darf kein Wort stehen, das der Sammler nicht als Farbe oder als
// bekannte Nicht-Farbe kennt — sonst entwischt eine Farbe (z. B. `red`, `currentColor`) still.
const FARB_EIGENSCHAFTEN = [
  "color",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline",
  "outline-color",
  "box-shadow",
  "text-decoration-color",
  "caret-color",
  "accent-color",
  "fill",
  "stroke",
];

const KEINE_FARBWOERTER = new Set([
  "solid",
  "dashed",
  "dotted",
  "double",
  "none",
  "transparent",
  "inset",
  "hidden",
]);

/** Bleibt in einer farbtragenden Eigenschaft ein unbekanntes Wort stehen? */
function unbekannteFarbwoerter(m: Modell): string[] {
  const raus: string[] = [];
  const pruefe = (eigenschaft: string, wert: string, ort: string): void => {
    if (!FARB_EIGENSCHAFTEN.includes(eigenschaft)) {
      return;
    }
    const rest = wert
      .replace(/var\(\s*--[a-z0-9-]+\s*\)/g, " ")
      .replace(new RegExp(RGB_KOMMA.source, "g"), " ")
      .replace(new RegExp(RGB_SCHRAEG.source, "g"), " ")
      .replace(HEX_LITERAL, " ");
    for (const wort of rest.split(/[\s,/]+/)) {
      const w = wort.trim().toLowerCase();
      if (w === "" || /^-?[\d.]+[a-z%]*$/.test(w)) {
        continue;
      }
      if (!KEINE_FARBWOERTER.has(w)) {
        raus.push(
          `„${w}" steht in ${ort} als Wert von \`${eigenschaft}\` — der Sammler kennt dieses Wort weder als Farbe noch als bekannte Nicht-Farbe. Eine Farbe darf hier nicht still entwischen.`,
        );
      }
    }
  };
  for (const regel of m.regeln) {
    for (const [eigenschaft, wert] of regel.dekl) {
      pruefe(eigenschaft, wert, `${regel.selektor} { … }`);
    }
  }
  for (const quelle of m.inline) {
    for (const d of quelle.text.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) {
        pruefe(d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim(), quelle.ort);
      }
    }
  }
  return raus;
}

function normalisiereRezept(wert: string): string {
  return wert
    .replace(/rgb\(\s*var\(--kw-([a-z0-9-]+)\)\s*\/\s*([\d.]+)\s*\)/g, (_, token: string, a) => {
      const hex = MODERN_TOKEN.get(token);
      if (!hex) {
        return `rgb(var(--kw-${token}) / ${a})`;
      }
      const [r, g, b] = rgbAusHex(hex);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Der Sammler. Liefert die Befunde als Liste von Sätzen; leere Liste = grün.
 * Er bekommt Stil UND Markup als Eingabe, damit die Kalibrierung ihn mit verstellten Kopien prüfen
 * kann — dieselbe Rechnung, andere Eingabe.
 */
function befunde(m: Modell = MODELL, kiStellen: KiStelle[] = KI_STELLEN): string[] {
  const raus: string[] = [];
  const benutzteAusnahmen = new Set<string>();
  const benutzteAlpha = new Set<string>();
  const funde = farbfunde(m);
  const violett = MODERN_TOKEN.get(VIOLETT_TOKEN) ?? ROOT_TOKEN.get(VIOLETT_TOKEN);
  const benutzteKi = new Set<string>();
  // C1 · Eine Freigabe gilt NUR an ihrem Selektor — und nur mit tragfähigem Grund.
  const kiFreigabe = (ort: string): KiStelle | undefined => {
    const stelle = kiStellen.find((k) => ort === k.selektor || ort.startsWith(`${k.selektor} {`));
    return stelle && stelle.grund.trim().length > 40 ? stelle : undefined;
  };

  // (0) Kein Farbwort entwischt dem Sammler.
  raus.push(...unbekannteFarbwoerter(m));

  // (1) Jeder sichtbare Farbwert gehört zur Werkbank-Palette — Ziffer für Ziffer, Alpha inklusive.
  for (const { farbe, roh, ort } of funde) {
    const wert = kanonisch(farbe);
    if (farbe.alpha >= 1 && PALETTE.has(farbe.basis)) {
      continue;
    }
    if (farbe.alpha < 1 && ALPHA_REZEPTE.has(wert)) {
      continue;
    }
    if (violett !== undefined && farbe.basis === violett) {
      const stelle = kiFreigabe(ort);
      if (stelle) {
        benutzteKi.add(stelle.selektor);
        continue;
      }
    }
    const ausnahme = AUSNAHMEN.find((a) => a.wert.toUpperCase() === wert);
    if (ausnahme) {
      benutzteAusnahmen.add(ausnahme.wert.toUpperCase());
      continue;
    }
    const alphaAusnahme = ALPHA_AUSNAHMEN.find((a) => a.wert.toUpperCase() === wert.toUpperCase());
    if (alphaAusnahme) {
      benutzteAlpha.add(alphaAusnahme.wert.toUpperCase());
      continue;
    }
    if (farbe.alpha < 1 && PALETTE.has(farbe.basis)) {
      raus.push(
        `Farbe ${roh} (${wert}) in ${ort}: der Ton ${farbe.basis} gehört zur Werkbank-Palette, die Deckung ${alphaText(farbe.alpha)} aber zu keinem Alpha-Rezept aus themes.css (${[...ALPHA_REZEPTE.keys()].join(", ") || "keins"}) — und hat keine benannte Alpha-Ausnahme.`,
      );
      continue;
    }
    raus.push(
      `Farbe ${roh} (${wert}) steht in ${ort}, aber nicht in der Werkbank-Palette ([data-theme="modern"] in themes.css) — und hat keine benannte Ausnahme.`,
    );
  }

  // (2) Jede Farbvariable in Klaras :root ist an ein Werkbank-Token angeschrieben — und stimmt.
  for (const [name, { wert, gebundenAn }] of m.variablen) {
    const eigen = alsFarbe(wert);
    if (!eigen) {
      continue;
    }
    if (gebundenAn.length === 0) {
      raus.push(
        `--${name}: ${wert} in taskpane.html nennt kein Werkbank-Token („← --kw-…") — ein unverbundener Farbwert ist genau die zweite Wahrheit, die hier nicht entstehen darf.`,
      );
      continue;
    }
    const klara = kanonisch(eigen);
    for (const token of gebundenAn) {
      const ausnahme = AUSNAHMEN.find((a) => a.rootToken === token);
      const soll = MODERN_TOKEN.get(token) ?? (ausnahme ? ROOT_TOKEN.get(token) : undefined);
      if (!soll) {
        raus.push(
          `--${name} beruft sich auf --kw-${token}; dieses Token gibt es im modern-Block nicht (und ohne benannte Ausnahme auch nicht als :root-Rückfall).`,
        );
        continue;
      }
      if (ausnahme) {
        benutzteAusnahmen.add(ausnahme.wert.toUpperCase());
        if (MODERN_TOKEN.has(token)) {
          raus.push(
            `Ausnahme für --kw-${token} ist überholt: der modern-Block überschreibt das Token inzwischen (${MODERN_TOKEN.get(token)}). Die Begründung stimmt nicht mehr.`,
          );
        }
      }
      if (klara !== soll) {
        raus.push(
          `--${name} in taskpane.html ist ${klara}, --kw-${token} in themes.css ist ${soll} — zwei Wahrheiten. Klara wird nachgezogen, nicht themes.css.`,
        );
      }
    }
  }

  // (3) Das Schatten-Rezept: dieselbe Regel, andere Eigenschaft.
  const klaraSchatten = m.variablen.get("shadow-tile");
  const modernSchatten = MODERN_BLOCK.match(/--kw-shadow-tile:\s*([^;]+);/);
  if (!klaraSchatten || !modernSchatten) {
    raus.push(
      "Schatten-Rezept fehlt auf einer der beiden Seiten (--shadow-tile / --kw-shadow-tile).",
    );
  } else if (
    normalisiereRezept(klaraSchatten.wert) !== normalisiereRezept(modernSchatten[1] as string)
  ) {
    raus.push(
      `Schatten-Rezept driftet: Klara „${normalisiereRezept(klaraSchatten.wert)}", themes.css „${normalisiereRezept(modernSchatten[1] as string)}".`,
    );
  }

  // (4) C1 · Violett ist der KI vorbehalten — und zwar an einem BENANNTEN Selektor.
  if (violett === undefined) {
    raus.push("--kw-ai steht weder im modern-Block noch in :root — die KI-Kennfarbe ist weg.");
  } else {
    for (const { farbe, roh, ort } of funde) {
      if (farbe.basis !== violett || kiFreigabe(ort)) {
        continue;
      }
      raus.push(
        `Die KI-Kennfarbe ${roh} (${violett} = --kw-ai) steht in ${ort}. Diese Stelle ist keine benannte KI-Stelle mit tragfähigem Grund — Violett ist ein Signal, keine Marke, und eine Freigabe gilt nur an ihrem Selektor.`,
      );
    }
  }
  for (const k of kiStellen) {
    if (!benutzteKi.has(k.selektor)) {
      raus.push(
        `KI-Stelle „${k.selektor}" hat keine Violett-Fundstelle — eine Freigabe auf Vorrat ist eine Leiche und deshalb rot.`,
      );
    }
  }

  // (5) Unbenutzte Ausnahmen sind rot.
  for (const a of AUSNAHMEN) {
    if (!benutzteAusnahmen.has(a.wert.toUpperCase())) {
      raus.push(
        `Ausnahme ${a.wert} (--kw-${a.rootToken}) wird nicht mehr gebraucht — unbenutzte Ausnahmen sind ein Freibrief auf Vorrat und deshalb rot.`,
      );
    }
  }
  for (const a of ALPHA_AUSNAHMEN) {
    if (!benutzteAlpha.has(a.wert.toUpperCase())) {
      raus.push(
        `Alpha-Ausnahme ${a.wert} (--kw-${a.basisToken}) hat keine Fundstelle mehr — unbenutzte Ausnahmen sind rot.`,
      );
    }
  }

  return raus;
}

const MODELL = baue();

// ================================================================================================
// B1 — DIE KONTRASTPAARE ENTSTEHEN AUS DER BAUFORM (keine Liste heutiger Fälle).
// ================================================================================================
//
// Bauform: JEDE Regel, die `color` setzt — und jeder Inline-Stil, der das tut — ist ein
// texttragendes Paar. Die Fläche kommt in dieser Reihenfolge:
//   (a) die eigene deckende `background`-Deklaration derselben Regel,
//   (b) sonst die des nächsten deckenden Vorfahren, ermittelt über die Regel-Struktur, angewandt
//       auf Klaras Markup (Kaskade = Quellreihenfolge, letzte passende Regel gewinnt),
//   (c) ist die Fläche so nicht eindeutig bestimmbar, gilt die KONSERVATIVE ANNAHME: gemessen wird
//       gegen JEDE deckende Fläche, die der Stilblock überhaupt kennt, und die Annahme steht im
//       Meldungstext. Nie stilles Überspringen.

type Angabe = { name: string; farbe: Farbe };
type Paar = { quellen: string[]; vorn: Angabe; hinten: Angabe; annahmen: string[] };

function angabeAus(wert: string, m: Modell): Angabe | null {
  const roh = wert.trim();
  const v = roh.match(/^var\(\s*--([a-z0-9-]+)\s*\)$/);
  if (v) {
    const eintrag = m.variablen.get(v[1] as string);
    const farbe = eintrag ? alsFarbe(eintrag.wert) : null;
    return farbe ? { name: `--${v[1] as string}`, farbe } : null;
  }
  const farbe = alsFarbe(roh);
  return farbe ? { name: roh, farbe } : null;
}

type Flaeche = Angabe | "durchsichtig" | "unlesbar";

function hintergrundAus(wert: string, m: Modell): Flaeche {
  const roh = wert.trim().toLowerCase();
  if (roh === "transparent" || roh === "none" || roh === "") {
    return "durchsichtig";
  }
  const angabe = angabeAus(wert, m);
  if (!angabe || angabe.farbe.alpha < 1) {
    return "unlesbar";
  }
  return angabe;
}

function hintergrundDerRegel(regel: Regel, m: Modell): Flaeche {
  const wert = regel.dekl.get("background-color") ?? regel.dekl.get("background");
  return wert === undefined ? "durchsichtig" : hintergrundAus(wert, m);
}

function inlineHintergrund(teil: Teil, m: Modell): Flaeche {
  for (const d of teil.stil.split(";")) {
    const i = d.indexOf(":");
    const name = i > 0 ? d.slice(0, i).trim().toLowerCase() : "";
    if (name === "background" || name === "background-color") {
      return hintergrundAus(d.slice(i + 1), m);
    }
  }
  return "durchsichtig";
}

/** Der nächste deckende Vorfahre (einschliesslich des Elements selbst) entlang eines Markup-Pfades. */
function flaecheFuerPfad(pfad: Teil[], m: Modell): Flaeche {
  for (let j = pfad.length - 1; j >= 0; j -= 1) {
    const teilPfad = pfad.slice(0, j + 1);
    const eigen = inlineHintergrund(teilPfad[j] as Teil, m);
    if (eigen !== "durchsichtig") {
      return eigen;
    }
    let letzte: Flaeche | null = null;
    for (const regel of m.regeln) {
      if (!regel.lesbar) {
        continue;
      }
      if (
        (regel.dekl.has("background") || regel.dekl.has("background-color")) &&
        regelPasst(regel.teile, teilPfad)
      ) {
        letzte = hintergrundDerRegel(regel, m);
      }
    }
    if (letzte !== null && letzte !== "durchsichtig") {
      return letzte;
    }
  }
  return "unlesbar";
}

/** Alle deckenden Flächen, die der Stilblock überhaupt kennt — die konservative Rückfallmenge. */
function alleFlaechen(m: Modell): Angabe[] {
  const karte = new Map<string, Angabe>();
  for (const regel of m.regeln) {
    const f = hintergrundDerRegel(regel, m);
    if (typeof f !== "string") {
      karte.set(f.name, f);
    }
  }
  return [...karte.values()];
}

/** Welche Regel gewinnt an diesem Pfad die Textfarbe? (Kaskade = Quellreihenfolge; Inline schlägt alles.) */
function farbregelFuer(pfad: Teil[], m: Modell): string | null {
  const eigen = pfad[pfad.length - 1] as Teil;
  for (const d of eigen.stil.split(";")) {
    const i = d.indexOf(":");
    if (i > 0 && d.slice(0, i).trim().toLowerCase() === "color") {
      return null; // Inline gewinnt — die Regel darf hier kein Paar bilden.
    }
  }
  let letzte: string | null = null;
  for (const regel of m.regeln) {
    if (regel.lesbar && regel.dekl.has("color") && regelPasst(regel.teile, pfad)) {
      letzte = regel.selektor;
    }
  }
  return letzte;
}

type Kontrast = { paare: Paar[]; befunde: string[]; erreicht: Set<string> };

function kontrastPaare(m: Modell): Kontrast {
  const paare: Paar[] = [];
  const raus: string[] = [];
  const erreicht = new Set<string>();
  const benutzteRegelAusnahmen = new Set<string>();
  const merke = (was: string, vorn: Angabe, hinten: Angabe, annahme: string | null): void => {
    erreicht.add(was);
    const vorhanden = paare.find((p) => p.vorn.name === vorn.name && p.hinten.name === hinten.name);
    if (vorhanden) {
      if (!vorhanden.quellen.includes(was)) {
        vorhanden.quellen.push(was);
      }
      if (annahme !== null && !vorhanden.annahmen.includes(annahme)) {
        vorhanden.annahmen.push(annahme);
      }
      return;
    }
    paare.push({ quellen: [was], vorn, hinten, annahmen: annahme === null ? [] : [annahme] });
  };

  const ausnahmeFuer = (selektor: string): RegelAusnahme | undefined => {
    const a = REGEL_AUSNAHMEN.find((r) => r.selektor === selektor);
    if (a) {
      benutzteRegelAusnahmen.add(a.selektor);
    }
    return a;
  };

  // B2 · Abschwächungen (opacity < 1) verändern den wirksamen Kontrast und brauchen eine benannte,
  // begründete Ausnahme — auch wenn WCAG deaktivierte Bedienelemente ausnimmt.
  for (const regel of m.regeln) {
    const o = regel.dekl.get("opacity");
    if (o === undefined || Number.parseFloat(o) >= 1) {
      continue;
    }
    const a = ausnahmeFuer(regel.selektor);
    if (!a || a.grund.trim().length < 60) {
      raus.push(
        `${regel.selektor} schwächt den Text ab (opacity: ${o}) und hat keine benannte, begründete Ausnahme — eine Abschwächung ohne Begründung ist ein stiller Kontrastverlust.`,
      );
    }
  }

  const quellen: { selektor: string; farbe: string; lesbar: boolean; eigen: Flaeche }[] = [];
  for (const regel of m.regeln) {
    const c = regel.dekl.get("color");
    if (c !== undefined) {
      quellen.push({
        selektor: regel.selektor,
        farbe: c,
        lesbar: regel.lesbar,
        eigen: hintergrundDerRegel(regel, m),
      });
    }
  }
  for (const quelle of m.inline) {
    for (const d of quelle.text.split(";")) {
      const i = d.indexOf(":");
      if (i > 0 && d.slice(0, i).trim().toLowerCase() === "color") {
        quellen.push({
          selektor: quelle.ort,
          farbe: d.slice(i + 1),
          lesbar: true,
          eigen: inlineHintergrund(quelle.pfad[quelle.pfad.length - 1] as Teil, m),
        });
      }
    }
  }

  for (const quelle of quellen) {
    const ausnahme = ausnahmeFuer(quelle.selektor);
    if (ausnahme && ausnahme.grund.trim().length >= 60) {
      continue;
    }
    if (!quelle.lesbar) {
      raus.push(
        `${quelle.selektor} setzt \`color\`, aber der Sammler kann diesen Selektor nicht auf das Markup anwenden (Pseudo-/Zustands-/Attributselektor). Ohne benannte Ausnahme ist das rot statt still — Zustandsstile gehören sonst in den vorgemerkten Computed-Style-Pin.`,
      );
      continue;
    }
    const vorn = angabeAus(quelle.farbe, m);
    if (!vorn) {
      raus.push(
        `${quelle.selektor} setzt \`color: ${quelle.farbe.trim()}\` — der Sammler kann daraus keine Farbe lesen und darf sie deshalb nicht ungeprüft passieren lassen.`,
      );
      continue;
    }
    if (typeof quelle.eigen !== "string") {
      merke(quelle.selektor, vorn, quelle.eigen, null);
      continue;
    }
    if (quelle.eigen === "unlesbar") {
      raus.push(
        `${quelle.selektor} bringt eine eigene Fläche mit, die der Sammler nicht als deckende Farbe lesen kann — Mischung mit dem Untergrund rechnet er nicht.`,
      );
      continue;
    }
    // Fläche aus dem Markup: der nächste deckende Vorfahre, an JEDER Fundstelle der Regel.
    const treffer = m.elemente.filter((e) =>
      quelle.selektor.includes("[style]")
        ? e.ort === quelle.selektor.replace(" [style]", "")
        : regelPasst((m.regeln.find((r) => r.selektor === quelle.selektor) as Regel).teile, e.pfad),
    );
    if (treffer.length === 0) {
      // Konservative Annahme (mega41-Regel): lieber gegen alles messen als still überspringen.
      for (const flaeche of alleFlaechen(m)) {
        merke(
          quelle.selektor,
          vorn,
          flaeche,
          `ANNAHME: ${quelle.selektor} hat im Markup von taskpane.html keine Fundstelle (z. B. erst zur Laufzeit gesetzte Klasse). Die Fläche ist damit nicht eindeutig bestimmbar; konservativ wird gegen JEDE deckende Fläche des Stilblocks gemessen.`,
        );
      }
      continue;
    }
    // Nur dort, wo diese Regel die Textfarbe auch GEWINNT — sonst misst der Sammler eine Farbe
    // gegen eine Fläche, auf der sie gar nicht steht (z. B. `.lang button` am aktiven Knopf).
    const gewinner = quelle.selektor.includes("[style]")
      ? treffer
      : treffer.filter((e) => farbregelFuer(e.pfad, m) === quelle.selektor);
    if (gewinner.length === 0) {
      raus.push(
        `${quelle.selektor} setzt \`color\`, wird aber an jeder Fundstelle im Markup überschrieben — eine Regel, die nie gilt, ist tot und wird nicht stillschweigend als geprüft verbucht.`,
      );
      continue;
    }
    const gesehen = new Set<string>();
    for (const e of gewinner) {
      const flaeche = flaecheFuerPfad(e.pfad, m);
      if (flaeche === "durchsichtig" || flaeche === "unlesbar") {
        raus.push(
          `${quelle.selektor} steht bei ${e.ort} auf keiner lesbaren deckenden Fläche — der Sammler nennt das, statt es zu überspringen.`,
        );
        continue;
      }
      if (gesehen.has(flaeche.name)) {
        continue;
      }
      gesehen.add(flaeche.name);
      merke(quelle.selektor, vorn, flaeche, null);
    }
  }

  for (const a of REGEL_AUSNAHMEN) {
    if (!benutzteRegelAusnahmen.has(a.selektor)) {
      raus.push(
        `Regel-Ausnahme „${a.selektor}" hat keine Fundstelle im Stilblock — unbenutzte Ausnahmen sind Leichen und deshalb rot.`,
      );
    }
  }

  return { paare, befunde: raus, erreicht };
}

const KONTRAST_MODELL = kontrastPaare(MODELL);

// ================================================================================================
// Die Kontrast-Rechnung — aus mega40 GEHOLT, nicht nachgebaut (Begründung im Kopf der Datei).
// ================================================================================================

function funktionsQuelle(quelle: string, name: string): string {
  const kopf = quelle.indexOf(`function ${name}(`);
  if (kopf < 0) {
    throw new Error(`mega40-kontrast-modern.test.ts: function ${name} nicht gefunden`);
  }
  let i = quelle.indexOf("{", kopf);
  let tiefe = 0;
  for (; i < quelle.length; i += 1) {
    if (quelle[i] === "{") {
      tiefe += 1;
    } else if (quelle[i] === "}") {
      tiefe -= 1;
      if (tiefe === 0) {
        return quelle.slice(kopf, i + 1);
      }
    }
  }
  throw new Error(`mega40-kontrast-modern.test.ts: function ${name} nicht geschlossen`);
}

function holeKontrastRechnung(): (a: Rgb, b: Rgb) => number {
  const quelle = readFileSync(MEGA40, "utf8");
  const teile = ["channel", "luminance", "contrast"].map((n) => funktionsQuelle(quelle, n));
  const js = ts.transpileModule(`type Rgb = [number, number, number];\n${teile.join("\n\n")}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function(`${js}\nreturn contrast;`)() as (a: Rgb, b: Rgb) => number;
}

const kontrast = holeKontrastRechnung();

function messe(paar: Paar): number {
  return kontrast(rgbAusHex(paar.vorn.farbe.basis), rgbAusHex(paar.hinten.farbe.basis));
}

// ================================================================================================
// TEIL 1 — Eine Palette, zwei Dateien, kein Unterschied.
// ================================================================================================

describe("mega43 B1/B2 · Klara führt die Werkbank-Palette (keine zweite Wahrheit)", () => {
  it("die Werkbank-Palette ist überhaupt lesbar", () => {
    expect(MODERN_TOKEN.size).toBeGreaterThan(15);
    expect(MODERN_TOKEN.get("page")).toBe("#FAF8F5");
    expect(MODERN_TOKEN.get("funke-deep")).toBe("#C2500A");
  });

  it("die Alpha-Rezepte der Werkbank sind aus themes.css gelesen (nicht aufgezählt)", () => {
    expect(ALPHA_REZEPTE.size).toBeGreaterThanOrEqual(2);
    expect(ALPHA_REZEPTE.has("#0E1626/0.05")).toBe(true);
    expect(ALPHA_REZEPTE.has("#0E1626/0.12")).toBe(true);
  });

  it("jeder Farbwert in taskpane.html ist Ziffer für Ziffer ein Werkbank-Wert (Alpha inklusive)", () => {
    expect(befunde()).toEqual([]);
  });

  it("Klara führt überhaupt Farben (der Sammler läuft nicht ins Leere)", () => {
    const werte = new Set(farbfunde(MODELL).map((f) => kanonisch(f.farbe)));
    expect(werte.size).toBeGreaterThanOrEqual(10);
    // Die tragenden Rollen der Werkbank sind wirklich im Panel angekommen.
    for (const pflicht of ["#FAF8F5", "#0E1626", "#C2500A", "#E8630A"]) {
      expect([...werte]).toContain(pflicht);
    }
    // A1: halbtransparente Werte sind jetzt eigene Werte, nicht ihr RGB-Tripel.
    expect([...werte]).toContain("#E8630A/0.45");
  });

  it("A2 · die sichtbaren Inline-Stile sind eine Farbquelle des Sammlers", () => {
    expect(MODELL.inline.length).toBeGreaterThan(0);
    const mitFarbe = MODELL.inline.filter((q) => /(^|;)\s*color\s*:/.test(q.text));
    expect(mitFarbe.map((q) => q.ort)).toContain(
      "body > div#section-capture.hidden > div.card > div.scope > label#scope-pages-label [style]",
    );
    // Der heutige Inline-Stil führt kein Literal, sondern var(--muted) — er ist sauber.
    expect(farbfunde(MODELL).filter((f) => f.ort.includes("[style]"))).toEqual([]);
  });

  it("B2 · das alte Violett #5b50c4 ist als Akzent verschwunden", () => {
    // An der Wahrheit gebunden: #5b50c4 IST in themes.css weiterhin die KI-Kennfarbe.
    expect(ROOT_TOKEN.get("ai")).toBe("#5B50C4");
    expect(MODERN_TOKEN.get("ai")).toBeUndefined(); // modern erbt sie unverändert
    expect(farbfunde(MODELL).map((f) => f.farbe.basis)).not.toContain("#5B50C4");
    // C1: die Liste der KI-Stellen ist leer — und das ist eine Entscheidung mit Grund (s. o.).
    expect(KI_STELLEN).toEqual([]);
  });

  it("jede Ausnahme ist benannt, begründet und gebunden — keine pauschale", () => {
    for (const a of AUSNAHMEN) {
      expect(a.grund.trim().length).toBeGreaterThan(60);
      expect(ROOT_TOKEN.get(a.rootToken)).toBe(a.wert.toUpperCase());
      expect(MODERN_TOKEN.has(a.rootToken)).toBe(false);
    }
    // A1: eine Alpha-Ausnahme darf die DECKUNG eigen wählen, nie die FARBE.
    for (const a of ALPHA_AUSNAHMEN) {
      expect(a.grund.trim().length).toBeGreaterThan(60);
      const basis = a.wert.split("/")[0] as string;
      expect(MODERN_TOKEN.get(a.basisToken) ?? ROOT_TOKEN.get(a.basisToken)).toBe(basis);
      expect(PALETTE.has(basis)).toBe(true);
    }
    // B2: eine Regel-Ausnahme nennt einen Selektor, den es im Stilblock wirklich gibt.
    for (const a of REGEL_AUSNAHMEN) {
      expect(a.grund.trim().length).toBeGreaterThan(60);
      expect(MODELL.regeln.map((r) => r.selektor)).toContain(a.selektor);
    }
  });
});

// ================================================================================================
// TEIL 2 — KALIBRIERUNG. Die Sonden entstehen hier, nicht im Produktbaum.
// ================================================================================================

describe("mega43 B1 · Kalibrierung des Sammlers", () => {
  it("ein absichtlich verstellter Wert schlägt an", () => {
    const verstellt = STIL.replace("--brand-deep: #C2500A;", "--brand-deep: #C2510A;");
    expect(verstellt).not.toBe(STIL);
    const gefunden = befunde(baue(verstellt));
    expect(gefunden.length).toBeGreaterThan(0);
    expect(gefunden.join("\n")).toContain("#C2510A");
  });

  it("derselbe Wert in anderer Schreibweise schlägt NICHT an", () => {
    const anders = STIL.replace("--brand-deep: #C2500A;", "--brand-deep: rgb(194, 80, 10);");
    expect(anders).not.toBe(STIL);
    expect(befunde(baue(anders))).toEqual([]);
  });

  it("ein zurückkehrendes Violett schlägt an", () => {
    const rueckfall = STIL.replace("--brand-deep: #C2500A;", "--brand-deep: #5b50c4;");
    expect(befunde(baue(rueckfall)).join("\n")).toContain("--kw-ai");
  });

  it("ein Farbwert ohne Anschrift an ein Werkbank-Token schlägt an", () => {
    const ohne = STIL.replace(/--page: #FAF8F5;[^\n]*/, "--page: #FAF8F5;");
    expect(ohne).not.toBe(STIL);
    expect(befunde(baue(ohne)).join("\n")).toContain("nennt kein Werkbank-Token");
  });

  it("ein driftendes Schatten-Rezept schlägt an", () => {
    const drift = STIL.replace("0 8px 24px -12px", "0 8px 24px -10px");
    expect(drift).not.toBe(STIL);
    expect(befunde(baue(drift)).join("\n")).toContain("Schatten-Rezept driftet");
  });

  // ---- A1: Alpha ist Teil der Identität --------------------------------------------------------
  it("A1 · eine reine Alpha-Drift am Hauptknopf-Schatten schlägt an", () => {
    const drift = STIL.replace("rgba(232, 99, 10, 0.45)", "rgba(232, 99, 10, 0.05)");
    expect(drift).not.toBe(STIL);
    const gefunden = befunde(baue(drift));
    expect(gefunden.join("\n")).toContain("#E8630A/0.05");
    expect(gefunden.join("\n")).toContain("Alpha-Ausnahme");
  });

  it("A1 · eine reine Alpha-Drift am Kachel-Schatten schlägt an", () => {
    const drift = STIL.replace("rgba(14, 22, 38, 0.05)", "rgba(14, 22, 38, 0.5)");
    expect(drift).not.toBe(STIL);
    expect(befunde(baue(drift)).join("\n")).toContain("#0E1626/0.5");
  });

  it("A1 · derselbe Alphawert in anderer Schreibweise schlägt NICHT an", () => {
    const anders = STIL.replace("rgba(232, 99, 10, 0.45)", "rgba(232, 99, 10, .450)");
    expect(anders).not.toBe(STIL);
    expect(befunde(baue(anders))).toEqual([]);
  });

  // ---- A2: Inline-Stile können nicht entwischen ------------------------------------------------
  it("A2 · ein Farbliteral in einem Inline-Stil schlägt an", () => {
    const verstellt = HTML.replace(
      'id="scope-pages-label" style="color: var(--muted);"',
      'id="scope-pages-label" style="color: #123456;"',
    );
    expect(verstellt).not.toBe(HTML);
    const gefunden = befunde(baue(STIL, verstellt));
    expect(gefunden.join("\n")).toContain("#123456");
    expect(gefunden.join("\n")).toContain("[style]");
  });

  it("A2 · ein unbekanntes Farbwort in einer farbtragenden Eigenschaft schlägt an", () => {
    const verstellt = STIL.replace("color: var(--muted); font-size: 12.5px;", "color: red;");
    expect(verstellt).not.toBe(STIL);
    expect(befunde(baue(verstellt)).join("\n")).toContain('„red"');
  });

  // ---- C1/C2: die Violett-Freigabe ist selektorgebunden ----------------------------------------
  const KI_GRUND =
    "Kalibrier-Sonde: eine gedachte KI-Kennzeichnung am Antwortkopf, die ausdrücklich sagt, dass " +
    "hier ein Reasoner gearbeitet hat. Nur dort ist --kw-ai die richtige Farbe.";

  it("C2 · eine eingetragene KI-Stelle gibt NUR ihren eigenen Selektor frei", () => {
    const sonde = `${STIL}\n.ki-hinweis { color: #5b50c4; }\n.zweite-stelle { border-color: #5b50c4; }\n`;
    const gefunden = befunde(baue(sonde), [{ selektor: ".ki-hinweis", grund: KI_GRUND }]);
    const violett = gefunden.filter((z) => z.includes("--kw-ai"));
    expect(violett.length).toBe(1);
    expect(violett.join("\n")).toContain(".zweite-stelle");
    expect(violett.join("\n")).not.toContain(".ki-hinweis {");
  });

  it("C2 · eine eingetragene KI-Stelle mit ausschliesslich dieser Verwendung bleibt grün", () => {
    const sonde = `${STIL}\n.ki-hinweis { color: #5b50c4; }\n`;
    const gefunden = befunde(baue(sonde), [{ selektor: ".ki-hinweis", grund: KI_GRUND }]);
    expect(gefunden.filter((z) => z.includes("--kw-ai") || z.includes("KI-Stelle"))).toEqual([]);
  });

  it("C1 · eine KI-Stelle ohne Fundstelle ist eine Leiche und schlägt an", () => {
    const gefunden = befunde(MODELL, [{ selektor: ".gibt-es-nicht", grund: KI_GRUND }]);
    expect(gefunden.join("\n")).toContain("Leiche");
  });

  it("C1 · eine KI-Stelle ohne tragfähigen Grund gibt nichts frei", () => {
    const sonde = `${STIL}\n.ki-hinweis { color: #5b50c4; }\n`;
    const gefunden = befunde(baue(sonde), [{ selektor: ".ki-hinweis", grund: "weil" }]);
    expect(gefunden.join("\n")).toContain("--kw-ai");
  });
});

// ================================================================================================
// TEIL 3 — KONTRAST: GEMESSEN, NICHT BEHAUPTET (B3), PAARE AUS DER BAUFORM (mega44 B1).
// ================================================================================================

describe("mega43 B3 / mega44 B1 · Kontrast der Klara-Paare (WCAG AA, ≥ 4,5:1)", () => {
  it("die geholte Rechenfunktion rechnet wirklich (Kalibrierung)", () => {
    expect(kontrast([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 6);
    expect(kontrast([100, 100, 100], [100, 100, 100])).toBeCloseTo(1, 6);
    // Gegenprobe, dass die Messung überhaupt durchfallen KANN: Weiß auf dem hellen Funke ist der
    // bekannte Fehlerfall aus mega41 (3,38:1) — deshalb trägt Klara Text nur auf Funke DUNKEL.
    const brand = MODELL.variablen.get("brand");
    expect(kontrast([255, 255, 255], rgbAusHex(brand?.wert as string))).toBeLessThan(4.5);
  });

  it("die Bauform erreicht JEDE Regel, die `color` setzt (keine stille Lücke)", () => {
    const setztFarbe = MODELL.regeln.filter((r) => r.dekl.has("color")).map((r) => r.selektor);
    const inlineFarbe = MODELL.inline
      .filter((q) => /(^|;)\s*color\s*:/.test(q.text))
      .map((q) => q.ort);
    const erreicht = KONTRAST_MODELL.erreicht;
    const befreit = new Set(REGEL_AUSNAHMEN.map((a) => a.selektor));
    const entwischt = [...setztFarbe, ...inlineFarbe].filter(
      (s) => !erreicht.has(s) && !befreit.has(s),
    );
    expect(entwischt, "Regel mit `color`, die der Sammler nicht gemessen hat").toEqual([]);
    expect(setztFarbe.length).toBeGreaterThanOrEqual(15);
  });

  it("der Sammler meldet nichts Ungeklärtes (Abschwächungen, unlesbare Flächen, Leichen)", () => {
    expect(KONTRAST_MODELL.befunde).toEqual([]);
  });

  it("B1 · die Bauform findet auch die Fläche, die die alte Liste nicht kannte (h2: ink/surface)", () => {
    const h2 = KONTRAST_MODELL.paare.find((p) => p.quellen.includes("h2"));
    expect(h2?.vorn.name).toBe("--ink");
    expect(h2?.hinten.name).toBe("--surface");
    expect(messe(h2 as Paar)).toBeGreaterThan(18);
  });

  it("B1 · keine Annahme greift heute still — der Markup-Weg trägt jede Regel", () => {
    const mitAnnahme = KONTRAST_MODELL.paare.filter((p) => p.annahmen.length > 0);
    expect(mitAnnahme.map((p) => `${p.quellen.join(", ")}: ${p.annahmen.join(" ")}`)).toEqual([]);
  });

  for (const paar of KONTRAST_MODELL.paare) {
    it(`${paar.quellen.join(", ")}: ${paar.vorn.name} auf ${paar.hinten.name} ≥ 4,5:1`, () => {
      const wert = messe(paar);
      expect(
        wert,
        `${paar.quellen.join(", ")}: ${paar.vorn.farbe.basis} auf ${paar.hinten.farbe.basis} = ${wert.toFixed(2)}:1${paar.annahmen.length > 0 ? ` — ${paar.annahmen.join(" ")}` : ""}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("die gemessenen Werte, für den Bericht", () => {
    const zeilen = KONTRAST_MODELL.paare.map(
      (p) =>
        `${p.vorn.name.padEnd(14)} auf ${p.hinten.name.padEnd(12)} ${p.vorn.farbe.basis} auf ${p.hinten.farbe.basis} = ` +
        `${messe(p).toFixed(2).padStart(6)}:1   ${p.quellen.join(", ")}`,
    );
    expect(zeilen.length).toBeGreaterThanOrEqual(11);
    // Sichtbar im Lauf, damit die Zahlen im Bericht belegt und nicht behauptet sind.
    console.log(`\nmega44 B1 — gemessen (${zeilen.length} Paare):\n${zeilen.join("\n")}\n`);
  });

  // ---- Kalibrierung des PAAR-Sammlers ----------------------------------------------------------
  it("B1 · eine texttragende Regel unter AA schlägt an", () => {
    const sonde = STIL.replace(
      "h2 { font-size: 13px; margin: 0 0 6px; color: var(--ink);",
      "h2 { font-size: 13px; margin: 0 0 6px; color: var(--hairline);",
    );
    expect(sonde).not.toBe(STIL);
    const h2 = kontrastPaare(baue(sonde)).paare.find((p) => p.quellen.includes("h2"));
    expect(h2?.vorn.name).toBe("--hairline");
    expect(h2?.hinten.name).toBe("--surface");
    expect(messe(h2 as Paar)).toBeLessThan(4.5);
  });

  it("B1 · eine neue Regel ohne Fundstelle im Markup fällt in die konservative Annahme", () => {
    const sonde = `${STIL}\n.spaeter-erzeugt { color: var(--muted); }\n`;
    const paare = kontrastPaare(baue(sonde)).paare.filter((p) =>
      p.quellen.includes(".spaeter-erzeugt"),
    );
    expect(paare.length).toBeGreaterThan(1);
    expect(paare.every((p) => p.annahmen.some((a) => a.includes("konservativ")))).toBe(true);
    expect(paare.some((p) => messe(p) < 4.5)).toBe(true);
  });

  it("B2 · eine Abschwächung ohne benannte Ausnahme schlägt an", () => {
    const sonde = STIL.replace("button.ghost {", "button.ghost {\n      opacity: 0.6;\n");
    expect(sonde).not.toBe(STIL);
    expect(kontrastPaare(baue(sonde)).befunde.join("\n")).toContain("schwächt den Text ab");
  });
});
