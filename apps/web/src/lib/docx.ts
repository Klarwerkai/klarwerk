// DOM-freier DOCX-Kern (FR-CAP-06, KW-W2-02/WP-D1).
// Bewusst OHNE File/Image/document/FileReader, damit dieses Modul auch im
// Node-/Root-Typecheck und in Tests ohne DOM-lib geprüft werden kann.
// Der Browser-Wrapper liegt in `files.ts`.
//
// WP-D1 (Pedi/VIP): DOCX wird nicht mehr zu Klartext destilliert, sondern STRUKTURERHALTEND als
// HTML übernommen (mammoth.convertToHtml: Überschriften, Listen, Tabellen, Fett/Kursiv; eingebettete
// Bilder als data:image-URLs — mammoth-Standard). Der Klartext bleibt ZUSÄTZLICH verfügbar, weil die
// KI-Punkte-Extraktion Text braucht. Autoritativ sanitisiert der Server (services/structure) jedes
// bodyHtml; das hiesige h1→h2-Mapping richtet das HTML nur vorab am erlaubten Subset aus.

// mammoth liefert keine verlässlichen Typen; schlanke lokale Vertragsdefinition statt `any`.
// mammoth wird je Umgebung unterschiedlich aufgelöst: Browser-Build akzeptiert
// `arrayBuffer`, Node-Build `buffer`. Beide Schlüssel zulassen → läuft in beiden.
type MammothInput = { arrayBuffer: ArrayBuffer; buffer?: Uint8Array };
type MammothResult = { value: string; messages: unknown[] };

// JOB 3210/M5c: die EINZIGE Option, die dieses Modul der Engine mitgibt — die Stilkarte, mit der
// Word-Beschriftungsabsätze überhaupt erst unterscheidbar werden (s. DOCX_CAPTION_STYLE_MAP).
// mammoth HÄNGT eine übergebene Karte an seine Standardkarte an (`includeDefaultStyleMap`, Vorgabe
// an) — Überschriften, Listen und Links bleiben also unberührt. Gemessen, nicht angenommen: der
// Sondenlauf 07.09. lieferte mit derselben Karte weiterhin `<h1>Kapitel eins</h1>`.
export interface DocxConvertOptions {
  styleMap?: readonly string[];
}

// Injizierbarer Engine-Vertrag (Muster PdfEngine in ./pdf): Tests nutzen einen Fake,
// der Browser-Wrapper lädt das echte mammoth lazy.
export interface DocxEngine {
  convertToHtml(input: MammothInput, options?: DocxConvertOptions): Promise<MammothResult>;
  extractRawText(input: MammothInput): Promise<MammothResult>;
}

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// DOM-freie Erkennung über Dateiname/MIME (ohne File-Objekt).
// Altes Binärformat .doc wird NICHT unterstützt (mammoth liest nur .docx).
export function isDocxDocumentLike(input: { name: string; type?: string }): boolean {
  return input.type === WORD_MIME || input.name.toLowerCase().endsWith(".docx");
}

let enginePromise: Promise<DocxEngine> | null = null;

// CJS/ESM-Interop robust auflösen (mammoth ist CommonJS, ohne Typen); lazy, damit es
// nicht ins Haupt-Bundle wandert.
async function defaultEngine(): Promise<DocxEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const mod = (await import("mammoth")) as unknown as DocxEngine & { default?: DocxEngine };
      return mod.default ?? mod;
    })();
  }
  return enginePromise;
}

function mammothInput(buffer: ArrayBuffer): MammothInput {
  // Browser-Build nutzt `arrayBuffer`, Node-Build `buffer` — beide übergeben.
  return { arrayBuffer: buffer, buffer: new Uint8Array(buffer) };
}

// WP-D1: h1 → h2 und h4–h6 → h3, passend zum Sanitizer-Subset (services/structure erlaubt nur
// h2/h3). Der Server mappt identisch (TAG_MAP) — hier vorab, damit Vorschau/Editor dieselbe
// Struktur sehen wie das Persistierte.
export function mapDocxHeadings(html: string): string {
  return html.replace(/<(\/?)h1\b/gi, "<$1h2").replace(/<(\/?)h[4-6]\b/gi, "<$1h3");
}

// ================================================================================================
// JOB 1115 / D-042 + D-043 — ZWEI NACHBEARBEITUNGSSCHRITTE DERSELBEN KETTE
// ================================================================================================
//
// Beide stammen aus demselben Live-Import („Project equipment design guide Rev. 0.91 b short.docx",
// Weg *Ganzes Dokument*, DESIGN_AN_CHEF/LIEFERUNG-20260815-BLOCK3.md) und sitzen deshalb hier
// nebeneinander, direkt hinter `mapDocxHeadings`:
//
//   D-042  Der Entwurf begann mit fünf Absätzen, die kein Wissen sind, sondern Dokumentenrahmen —
//          „BAADER" · „Design guide" · „Project equipment" · „en" · „BAADER project equipment
//          design guide | Rev. 0.9 | EN". Die Zeile „en" ist ein Sprachkürzel als eigener Absatz.
//          Wer diesen Entwurf einreicht, veröffentlicht Kopfzeilen als Wissen.
//   D-043  Derselbe Import erzeugte 116 Links auf Word-interne Sprungmarken (`href="#_Toc…"`) samt
//          Seitenzahlen, die es im Web nicht gibt; zwei Links trugen gar kein Ziel. Ein
//          Inhaltsverzeichnis, das klickbar aussieht und nichts tut.
//
// Bis hierher reichte dieses Modul die mammoth-Ausgabe durch und bearbeitete sie nur an definierten
// Stellen nach — eine Bereinigung von Rahmenzeilen und eine Nachbearbeitung der Anker gab es nicht.

// D-042, KONSERVATIV: eine Rahmenzeile ist ein ETIKETT, kein Satz. Die Grenze ist bewusst großzügig
// gesetzt — sie allein entfernt nichts. Erst die Konjunktion aus vier Bedingungen tut das (s. u.).
const FRAME_LINE_MAX_CHARS = 80;

/** Vergleichsform einer Zeile: Weißraum vereinheitlicht, Groß-/Kleinschreibung egal. */
function normalizeFrameLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// Die Wiederkehr wird ZEILENWEISE gezählt, nicht als Teilzeichenkette — und das ist kein Detail:
// „en" steckt als Teilkette in „Foreword information", „Ventil" und Dutzenden weiterer Wörter. Eine
// Teilkettensuche hielte deshalb praktisch jede kurze Zeile für wiederkehrend und würde echtes
// Wissen entfernen. Gezählt werden ganze Zeilen des Klartextes, den dieselbe Engine liefert.
function countFrameLineOccurrences(documentText: string, text: string): number {
  const needle = normalizeFrameLine(text);
  if (needle === "") {
    return 0;
  }
  let found = 0;
  for (const line of documentText.split(/\r\n?|\n/)) {
    if (normalizeFrameLine(line) === needle) {
      found += 1;
    }
  }
  return found;
}

/**
 * Ist dieser Absatz ein Dokumentenrahmen? Vier Bedingungen, alle nötig — im Zweifel bleibt der
 * Absatz stehen. D-042 wörtlich: „lieber eine Kopfzeile zu viel als ein Satz Wissen zu wenig."
 *
 *  1. nicht leer;
 *  2. kurz (≤ FRAME_LINE_MAX_CHARS) — ein Etikett, kein Absatz;
 *  3. endet NICHT auf ein Satzendezeichen — wer einen Satz schreibt, schließt ihn;
 *  4. die Zeile kommt im Dokument MEHRFACH vor. Das ist die eigentliche Evidenz: eine Kopf-/
 *     Fußzeile wiederholt sich, ein Satz Wissen nicht. Ohne sie wäre alles Übrige Vermutung.
 */
export function isDocxFrameLine(text: string, documentText: string): boolean {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.length > FRAME_LINE_MAX_CHARS) {
    return false;
  }
  if (/[.!?:;]$/.test(trimmed)) {
    return false;
  }
  return countFrameLineOccurrences(documentText, trimmed) >= 2;
}

export interface DocxFrameStripResult {
  html: string;
  /**
   * Die entfernten Zeilen in ihrer Reihenfolge, als ROHER HTML-Text (so, wie mammoth sie geliefert
   * hat — Entitäten bleiben also Entitäten). Nichts wird verworfen: der Aufrufer bewahrt sie.
   */
  frameLines: string[];
}

// Ein führender reiner Textabsatz. `[^<]*` ist Absicht: ein Absatz mit Auszeichnung, Bild oder Link
// ist kein Rahmenetikett und beendet die Suche — genau dadurch bleibt ein Word-Inhaltsverzeichnis
// (`<p><a …>…</a></p>`) strukturell außer Reichweite dieses Schritts.
const LEADING_TEXT_P_RE = /^\s*<p(?:\s[^>]*)?>([^<]*)<\/p>/i;

/**
 * D-042: entfernt den zusammenhängenden Block von Rahmenzeilen AM ANFANG des Wissenskörpers.
 *
 * Nur der führende Block, und er endet beim ersten Absatz, der die Prüfung nicht besteht — bei einer
 * Überschrift, einem Bild, einer Tabelle oder einem echten Satz ist Schluss. Was weiter unten im
 * Fließtext erneut auftaucht, bleibt unangetastet: dort ist es Inhalt, nicht Rahmen.
 *
 * Ohne Fund wird die Eingabe UNVERÄNDERT zurückgegeben (dieselbe Zeichenkette, kein Neuaufbau) —
 * ein Dokument ohne Rahmenzeilen bleibt damit zeichengleich.
 */
export function stripDocxFrameLines(html: string, documentText: string): DocxFrameStripResult {
  const frameLines: string[] = [];
  let rest = html;
  for (;;) {
    const match = LEADING_TEXT_P_RE.exec(rest);
    if (!match) {
      break;
    }
    const inner = match[1] ?? "";
    if (!isDocxFrameLine(inner, documentText)) {
      break;
    }
    frameLines.push(inner.trim());
    rest = rest.slice(match[0].length);
  }
  if (frameLines.length === 0) {
    return { html, frameLines: [] };
  }
  return { html: rest, frameLines };
}

const A_TAG_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_ATTR_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/**
 * D-043: verwandelt Inhaltsverzeichnis-Links in reinen Text — Linkoptik weg, Text bleibt.
 *
 * Erkennungsregel wörtlich aus D-043: `href` beginnt mit `#_Toc` oder fehlt ganz. Alles andere wird
 * NICHT angefasst; ein behaltener Link wird nicht neu zusammengesetzt, sondern als exakt dieselbe
 * Zeichenkette zurückgegeben (sonst wäre „unverändert" eine Behauptung statt einer Tatsache).
 *
 * Ausdrücklich unberührt: echte externe Links (`http…`) und die Fußnoten-Anker der Bilder — Letztere
 * sind `figcaption`/`figure` mit `data-image-id` und keine `<a>`; dieser Schritt sieht sie nie.
 *
 * Warum umschreiben und nicht in echte Sprungmarken verwandeln: die Zielüberschriften verlieren beim
 * Import ihre Anker, echte Sprungziele gäbe es also gar nicht. Die Seitenzahlen bleiben stehen als
 * das, was sie sind — eine Spur des Originals (D-043, empfohlener Weg (b)).
 */
export function neutralizeDocxTocLinks(html: string): string {
  return html.replace(A_TAG_RE, (match, attrs: string, inner: string) => {
    const href = HREF_ATTR_RE.exec(attrs);
    if (!href) {
      return inner; // gar kein Ziel — sah klickbar aus, tat nichts
    }
    const value = (href[1] ?? href[2] ?? "").trim();
    return /^#_Toc/i.test(value) ? inner : match;
  });
}

/**
 * Die bewahrten Rahmenzeilen als Quellenvermerk-Block.
 *
 * Er wird dem Körper VORANGESTELLT und landet damit unmittelbar hinter dem Quelle-Blockquote, das
 * `wholeDocumentBodyHtml` (captureFromFile.ts) davorsetzt — beide lesen sich als eine Vermerkfläche.
 * `blockquote` ist im Server-Sanitizer erlaubt (services/structure/sanitize.ts:18); Attribute trägt
 * es bewusst keine, denn für `blockquote` führt der Sanitizer keine Attribut-Allowlist und würde
 * jede Markierung ersatzlos verwerfen. Eine Markierung zu setzen, die das Speichern nicht überlebt,
 * wäre eine Zusage ohne Deckung.
 */
function frameLinesNote(frameLines: readonly string[]): string {
  return `<blockquote><p>${frameLines.join(" · ")}</p></blockquote>`;
}

// WP-D1: eingebettete data:image-Quellen asynchron abbilden (im Browser: Downscale auf max.
// Kantenlänge, s. files.ts) — DOM-frei, mapFn injizierbar. Nicht-data:-Quellen bleiben unberührt.
const IMG_DATA_SRC_RE = /(<img\b[^>]*?\bsrc=")(data:image\/[a-zA-Z0-9.+-]+;base64,[^"]*)(")/gi;

export async function mapInlineImages(
  html: string,
  map: (src: string) => Promise<string>,
): Promise<string> {
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = IMG_DATA_SRC_RE.exec(html)) !== null) {
    parts.push(html.slice(last, m.index), m[1] ?? "", await map(m[2] ?? ""), m[3] ?? "");
    last = IMG_DATA_SRC_RE.lastIndex;
  }
  parts.push(html.slice(last));
  return parts.join("");
}

// WP-D1b/WP-BILD-1a: die droppbare/messbare BILD-EINHEIT. Entweder ein <figure> mit data:image-<img>
// — dann ist das GANZE figure-Element (inkl. <figcaption>-Fußnote) die Einheit, sodass bei Budget-
// Notbremse Bild UND Fußnote zusammen entfallen — ODER (Paste-/Alt-Pfad) ein bare <img data:image>.
// Nicht-data:-Quellen (Object-Store-/raw) bleiben unberührt.
const IMG_TAG_DATA_RE =
  /<figure\b[^>]*>\s*<img\b[^>]*\bsrc="(data:image\/[a-zA-Z0-9.+-]+;base64,[^"]*)"[^>]*>[\s\S]*?<\/figure>|<img\b[^>]*\bsrc="(data:image\/[a-zA-Z0-9.+-]+;base64,[^"]*)"[^>]*>/gi;

// WP-BILD-1a (Pedi 20.07., Bild-Fußnoten): stabiler ID-Präfix für den Fußnoten-Anker
// (figcaption[data-image-id]).
export const IMAGE_ID_PREFIX = "kw-img-";

// WP-BILD-1b (bens BILD-1a-Auflage 1): kw-img-N allein ist nur PRO IMPORT eindeutig — ein zweiter
// Import/Einfüge-Vorgang in DENSELBEN Body würde kw-img-1, kw-img-2 … kollidieren lassen. Deshalb bekommt
// jeder Import-Lauf ein eigenes, kurzes Token: kw-img-<runToken>-N. Das Token bleibt bewusst im
// Sanitizer-Zeichenvorrat [a-z0-9] (Teilmenge von [\w-]) → verletzt den Token-Vertrag der Sanitizer nie.
const IMAGE_RUN_TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const IMAGE_RUN_TOKEN_LEN = 6;

export function newImageRunToken(): string {
  const chars: string[] = [];
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(IMAGE_RUN_TOKEN_LEN);
    cryptoObj.getRandomValues(buf);
    for (const b of buf) {
      chars.push(IMAGE_RUN_TOKEN_ALPHABET[b % IMAGE_RUN_TOKEN_ALPHABET.length] ?? "0");
    }
    return chars.join("");
  }
  // Fallback (Browser-Code darf Date.now — hier nur Kollisions-Streuung, keine Krypto-Anforderung).
  let seed = Date.now();
  for (let i = 0; i < IMAGE_RUN_TOKEN_LEN; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    chars.push(IMAGE_RUN_TOKEN_ALPHABET[seed % IMAGE_RUN_TOKEN_ALPHABET.length] ?? "0");
  }
  return chars.join("");
}

// Bare data:image-<img> (mammoth-Ausgabe) — zum Umhüllen in <figure> mit Fußnoten-Anker.
const IMG_WRAP_RE = /<img\b[^>]*\bsrc="data:image\/[a-zA-Z0-9.+-]+;base64,[^"]*"[^>]*>/gi;

// ================================================================================================
// JOB 3210 · M5c — WORD-BILDUNTERSCHRIFTEN ÜBERLEBEN DEN DOCX-IMPORT
// ================================================================================================
//
// DER BEFUND (Codex, Paket M5-DOCX-BILDUNTERSCHRIFTEN-20260907, gemessen an der freigegebenen
// BAADER-Arbeitskopie, Entwurf 35605815-…): zehn Bilder kamen an, die Beschriftungen „Figure 1:
// Profiles" bis „Figure 9: Transitions, key surfaces" ebenfalls — aber als GEWÖHNLICHE NACHBAR-
// ABSÄTZE, und alle zehn `figcaption` waren LEER. Damit findet die Bildsuche (M5/JOB 3095), die
// ihre Suchtexte aus `figcaption` ableitet (`services/structure/src/captions.ts`), kein einziges
// dieser Bilder über seine Originalbeschriftung.
//
// WARUM DIE BESCHRIFTUNG BIS HIERHER VERLORENGING, und zwar schon eine Stufe früher als in
// `wrapImagesInFigures`: mammoths Standard-Stilkarte kennt Überschriften, Listen und Links — die
// Word-Beschriftungsvorlage kennt sie NICHT. Ein Beschriftungsabsatz kommt deshalb als nacktes
// `<p>Figure 1: Profiles</p>` an, ununterscheidbar von jedem anderen Satz. GEMESSEN im Sondenlauf
// 07.09. an einer echten .docx mit `w:pStyle` auf einen Stil mit `w:name="caption"`:
//
//     ohne Stilkarte   <p><img …/></p><p> </p><p>Figure 1: Profiles</p>
//     mit  Stilkarte   <p><img …/></p><p> </p><p class="kw-docx-caption">Figure 1: Profiles</p>
//
// Ohne diese Karte bliebe nur Ratewerk am Fliesstext. Mit ihr steht die WORD-STRUKTUR da, und die
// Zuordnung wird eine Frage der Nachbarschaft statt eine Frage der Textähnlichkeit.

/** Die Marke, die die Stilkarte auf einen Word-Beschriftungsabsatz setzt. Verlässt das Modul nie. */
const CAPTION_MARKER_CLASS = "kw-docx-caption";

/**
 * Die Stilkarte für mammoth: welche Word-Formatvorlage ist eine Bildbeschriftung.
 *
 * `p[style-name='…']` trifft den NAMEN aus `word/styles.xml`, `p.…` die KENNUNG (`w:styleId`).
 * Beide stehen hier, weil beide vorkommen: Word schreibt für die eingebaute Beschriftungsvorlage
 * den kanonischen OOXML-Namen `caption` — auch in einer deutschen Oberfläche, wo der Anwender
 * „Beschriftung" liest —, während fremd erzeugte Dokumente (Konverter, Vorlagensammlungen) eigene
 * Vorlagen mitbringen.
 *
 * GROSS-/KLEINSCHREIBUNG IST NICHT EGAL: mammoths Namensvergleich ist zeichengenau — die
 * Standardkarte führt `p[style-name='Heading 1']` UND `p[style-name='heading 1']` nebeneinander,
 * genau deshalb. Beide Schreibweisen stehen hier ebenso.
 *
 * EHRLICHE GRENZE, sie gehört in die Rückgabe und nicht in eine Fussnote: Diese Liste ist
 * ABSCHLIESSEND. Eine Vorlage mit einem hier nicht genannten Namen (etwa eine hauseigene
 * „FigTitle") wird NICHT als Beschriftung erkannt. Für sie greift nur noch der zweite Weg unten
 * (der nummerierte „Figure n:"-Absatz), und wo auch der nicht greift, bleibt die Fussnote leer —
 * wie heute. Erfunden wird nichts.
 */
const DOCX_CAPTION_STYLE_MAP: readonly string[] = [
  // Die eingebaute Word-Vorlage, über ihren OOXML-Namen (beide Schreibweisen).
  `p[style-name='caption'] => p.${CAPTION_MARKER_CLASS}:fresh`,
  `p[style-name='Caption'] => p.${CAPTION_MARKER_CLASS}:fresh`,
  // Dieselbe Vorlage über ihre Kennung — und die lokalisierten Kennungen, die ältere Word-Fassungen
  // wirklich schreiben.
  `p.Caption => p.${CAPTION_MARKER_CLASS}:fresh`,
  `p.Beschriftung => p.${CAPTION_MARKER_CLASS}:fresh`,
  `p.Bildunterschrift => p.${CAPTION_MARKER_CLASS}:fresh`,
  `p.Onderschrift => p.${CAPTION_MARKER_CLASS}:fresh`,
  // Und dieselben Namen, falls ein Dokument sie als eigene Vorlage führt.
  `p[style-name='Beschriftung'] => p.${CAPTION_MARKER_CLASS}:fresh`,
  `p[style-name='Bildunterschrift'] => p.${CAPTION_MARKER_CLASS}:fresh`,
  `p[style-name='Onderschrift'] => p.${CAPTION_MARKER_CLASS}:fresh`,
];

/**
 * Der ZWEITE Erkennungsweg: der nummerierte Beschriftungsabsatz, den Word beim Einfügen einer
 * Beschriftung erzeugt („Figure 1: Profiles", „Abbildung 2 – Schraubverbindung").
 *
 * WAS HIER BEWUSST GEFORDERT WIRD, und warum jede Lockerung schadet: nach der Nummer MUSS ein
 * Beschriftungstrenner stehen — Doppelpunkt, Punkt, Gedankenstrich, Tabulator — oder der Absatz
 * endet. EIN LEERZEICHEN GENÜGT NICHT. Sonst wäre der Fliesstextsatz „Figure 4 shows the profile
 * of the frame." eine Beschriftung, und der Satz landete als erfundene Bildunterschrift in der
 * Fussnote. Das ist der Unterschied zwischen „Beschriftung erkannt" und „Nachbartext übernommen",
 * und §5.2 des Auftrags verbietet Letzteres ausdrücklich.
 *
 * DIE NUMMER WIRD NIE ZUR ZUORDNUNG BENUTZT — nur zur ERKENNUNG, dass dieser Absatz eine
 * Beschriftung ist. Welches Bild sie meint, entscheidet allein die Nachbarschaft (s. u.). Das
 * Demodokument hat zehn Bilder und neun Legenden; „Bildnummer gleich Figure-Nummer" wäre dort ab
 * dem zehnten Bild schlicht falsch.
 */
const NUMBERED_CAPTION_RE =
  /^(?:figure|fig\.?|abbildung|abb\.?|bild|afbeelding|afb\.?)\s*\d+(?:[.-]\d+)*[a-z]?\s*(?:[:.\t–—-]|$)/i;

/** Elemente ohne Schlusskante — der Blockgang darf für sie keine suchen. */
const VOID_TAGS = new Set(["img", "br", "hr", "input", "meta", "link", "source", "col", "area"]);

type BlockArt = "bild" | "leer" | "beschriftung" | "anderes";

interface HtmlBlock {
  readonly tag: string;
  /** Anfang der Öffnungskante im Rumpf. */
  readonly start: number;
  /** Hinter der Schlusskante. */
  readonly end: number;
  readonly art: BlockArt;
  /** Bei `art === "bild"`: die 1-basierten Bildnummern dieses Blocks (Zählung wie `wrapImagesInFigures`). */
  readonly bilder: readonly number[];
  /** Bei `art === "beschriftung"`: der Inhalt der Beschriftung, im Wortlaut samt Auszeichnung. */
  readonly beschriftung: string;
}

/** Der sichtbare Text eines Ausschnitts: Marken raus, Leerraum vereinheitlicht. */
function blockText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Die Blöcke der OBERSTEN Ebene, in Dokumentreihenfolge.
 *
 * Warum eigenhändig und nicht über einen Parser: dieses Modul ist ausdrücklich DOM-frei (Kopf der
 * Datei) und muss im Node-Typecheck ohne DOM-lib laufen. Gleichnamige Verschachtelung wird
 * mitgezählt (`<ul><li><ul>…`), damit eine innere Liste den Block nicht vorzeitig schliesst.
 *
 * Die Annahme „`<` und `>` kommen in Attributwerten nicht vor" ist im Werk bereits die tragende
 * (`services/structure/src/captions.ts`: „base64 kann kein `<` enthalten"): mammoth maskiert
 * `&<>"` in Attributwerten, und base64 kennt beide Zeichen nicht.
 */
function topLevelBlocks(html: string): { tag: string; start: number; end: number }[] {
  const raus: { tag: string; start: number; end: number }[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      break;
    }
    const kante = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(lt, lt + 24));
    const tag = kante?.[1]?.toLowerCase();
    if (tag === undefined) {
      i = lt + 1;
      continue;
    }
    const openEnd = html.indexOf(">", lt);
    if (openEnd < 0) {
      break;
    }
    if (VOID_TAGS.has(tag) || html[openEnd - 1] === "/") {
      raus.push({ tag, start: lt, end: openEnd + 1 });
      i = openEnd + 1;
      continue;
    }
    const kanten = new RegExp(`</?${tag}\\b`, "gi");
    kanten.lastIndex = openEnd + 1;
    let tiefe = 1;
    let ende = -1;
    let treffer: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
    while ((treffer = kanten.exec(html)) !== null) {
      tiefe += treffer[0][1] === "/" ? -1 : 1;
      if (tiefe === 0) {
        const schluss = html.indexOf(">", treffer.index);
        ende = schluss < 0 ? html.length : schluss + 1;
        break;
      }
    }
    if (ende < 0) {
      // Unabgeschlossen — der Rest ist ein Block, und die Schleife endet. Nichts wird geraten.
      raus.push({ tag, start: lt, end: html.length });
      break;
    }
    raus.push({ tag, start: lt, end: ende });
    i = ende;
  }
  return raus;
}

/** Trägt die Öffnungskante dieses Absatzes die Beschriftungsmarke der Stilkarte? */
function hasCaptionMarker(openTag: string): boolean {
  return new RegExp(`\\bclass\\s*=\\s*"[^"]*\\b${CAPTION_MARKER_CLASS}\\b`, "i").test(openTag);
}

/**
 * Die Marke wieder entfernen — sie ist Werkzeug dieses Schrittes und kein Inhalt des Rumpfes.
 * Bleibt nach dem Streichen keine Klasse übrig, fällt das Attribut ganz weg; `<p >` wird wieder
 * `<p>`, damit ein Rumpf ohne Beschriftungen zeichengleich zur mammoth-Ausgabe bleibt.
 */
function stripCaptionMarker(openTag: string): string {
  return openTag
    .replace(/\bclass\s*=\s*"([^"]*)"/i, (_ganz: string, wert: string): string => {
      const rest = wert
        .split(/\s+/)
        .filter((c) => c !== "" && c !== CAPTION_MARKER_CLASS)
        .join(" ");
      return rest === "" ? "" : `class="${rest}"`;
    })
    .replace(/\s+>/, ">")
    .replace(/\s{2,}/g, " ");
}

// ================================================================================================
// DIE ZUORDNUNGSREGEL — sie steht hier ganz, weil sie die eigentliche Leistung dieses Jobs ist.
// ================================================================================================
//
// EIN BILDLAUF ist eine ununterbrochene Folge aus Bildblöcken und Leerabsätzen mit mindestens einem
// Bild. Leerabsätze trennen also NICHT (Auftrag §5.2, gemessener BAADER-Fall: Bild, Leerabsatz,
// „Figure 1: Profiles"); jeder andere Absatz trennt sehr wohl.
//
// EINE BESCHRIFTUNG hat höchstens zwei Anwärter: den Bildlauf unmittelbar davor und den unmittelbar
// danach. Beide zählen IMMER. Es gibt keine Vorzugsseite und keine dokumentweite „Ausrichtung", aus
// der eine Seite gewönne.
//
// WARUM NICHT (Korrekturpflicht 1 des Prüfers zu Runde 1, und Präzisierung der Steuerung vom
// 07.09. 08:35/08:51): Runde 1 zählte, auf welcher Seite ihres Bildes die EINDEUTIGEN Beschriftungen
// eines Dokuments stehen, und liess diese Mehrheit eine Legende ZWISCHEN zwei Bildern entscheiden.
// Der Prüfer hat den Fall nachgestellt — drei eindeutige Beschriftungen, danach Bild–Legende–Bild —
// und bekam eine gefüllte Fussnote und `ambiguous: 0`, wo beide Fussnoten leer und zwei Bilder offen
// hätten sein müssen. Eine Konvention, die anderswo im Dokument gilt, ist KEIN Beleg dafür, zu
// welchem Bild DIESE Legende gehört: sie ist eine Vermutung, und §5.2 verbietet Vermutungen. Das
// BAADER-Original enthält solche Folgen wirklich (Bild–Legende–Bild bei „Bolted connection" und bei
// Figure 7–9), und dort wäre die Mehrheitsantwort in der Bildsuche eine falsche Herkunftsangabe —
// teurer als gar keine.
//
// ZUGEORDNET WIRD NUR BEI DREIFACHER EINDEUTIGKEIT:
//   · die Beschriftung hat GENAU EINEN Anwärter (auf der anderen Seite steht kein Bildlauf),
//   · dieser Lauf trägt GENAU EIN Bild,
//   · und GENAU EINE Beschriftung wählt ihn.
// Sonst bleibt die Fussnote leer, und die betroffenen Bilder werden als `captionsAmbiguous`
// gezählt. Zwei Bilder unter einer gemeinsamen Legende laufen genau hier auf — beide bleiben leer.
//
// WAS AUSDRÜCKLICH NICHT GESCHIEHT: keine Zuordnung über die Figure-NUMMER, keine über blosse
// Textähnlichkeit, keine über die dokumentweite Konvention, keine erfundene Beschriftung. Zehn
// Bilder mit neun Legenden bleiben zehn Bilder mit neun Legenden.
//
// DER PREIS, offen benannt: eine ununterbrochene Kette Bild–Legende–Bild–Legende ohne trennenden
// Fliesstext liefert GAR KEINE Zuordnung, obwohl ein Mensch sie läse. Das ist gewollt. Der ehrliche
// Zustand ist „unklar, Fussnote leer" (sichtbar am Platzhalter des Editors und an
// `captionsAmbiguous`), nicht „wahrscheinlich dieses Bild".

interface Bildlauf {
  readonly bilder: readonly number[];
  /** Blockindex des ersten und letzten Blocks dieses Laufs. */
  readonly von: number;
  readonly bis: number;
}

export interface DocxCaptionPlan {
  /** Der Rumpf ohne die zugeordneten Beschriftungsabsätze und ohne die Stilmarke. */
  readonly html: string;
  /** Bildnummer (1-basiert, Zählung von `wrapImagesInFigures`) → Beschriftung im Wortlaut. */
  readonly captions: ReadonlyMap<number, string>;
  /** Bilder, die eine Originalbeschriftung bekommen haben. */
  readonly assigned: number;
  /**
   * JOB 3254/M5c-UI: WELCHE Bilder das sind, nicht nur WIE VIELE. Die Zahl allein konnte nur eine
   * Bilanz tragen; die Fläche am einzelnen Bild braucht die Menge. Sie entsteht an DERSELBEN Stelle
   * wie der Zähler (ein Lauf, der die dreifache Eindeutigkeit verfehlt) — eine zweite Erhebung wäre
   * eine zweite Wahrheit über denselben Sachverhalt. `ambiguous` ist ab jetzt ihre Größe.
   */
  readonly ambiguousImages: ReadonlySet<number>;
  /** Bilder mit Beschriftungs-Anwärter, die mangels Eindeutigkeit LEER bleiben. */
  readonly ambiguous: number;
}

/**
 * Ordnet Word-Beschriftungsabsätze ihren Bildern zu und nimmt sie aus dem Fliesstext.
 *
 * ENTFERNT ODER VERSCHOBEN? Verschoben. Der Auftrag verlangt beides zugleich (§5.1): der Absatz
 * darf weder DOPPELT dastehen (Fussnote und Absatz) noch STILL VERSCHWINDEN. Eine zugeordnete
 * Beschriftung verlässt deshalb den Fliesstext und steht im Wortlaut in der `figcaption` desselben
 * Bildes — an derselben Stelle des Dokuments, sichtbar, einmal. Eine NICHT zugeordnete
 * Beschriftung bleibt unangetastet, wo sie ist.
 *
 * Läuft auf der ROHEN mammoth-Ausgabe, VOR `wrapImagesInFigures` — die Bildnummern sind exakt die,
 * die dort vergeben werden (dieselbe Marke `IMG_WRAP_RE`, dieselbe Regel „bereits verankerte Bilder
 * überspringen").
 */
export function planDocxImageCaptions(html: string): DocxCaptionPlan {
  // Eigene Regex-Instanz: `IMG_WRAP_RE` wird anderswo mit `replace` gefahren, ein geteilter
  // `lastIndex` zwischen zwei Lesern wäre ein Fehler, den niemand sucht.
  const bildMarke = new RegExp(IMG_WRAP_RE.source, "gi");
  // Bildnummer je Fundstelle im Rumpf — die Zählung von `wrapImagesInFigures`, zeichengleich.
  const bildStellen: { start: number; nummer: number }[] = [];
  let n = 0;
  let treffer: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((treffer = bildMarke.exec(html)) !== null) {
    if (/\bdata-image-id\s*=/i.test(treffer[0])) {
      continue; // schon verankert — `wrapImagesInFigures` zählt es ebenfalls nicht
    }
    n += 1;
    bildStellen.push({ start: treffer.index, nummer: n });
  }

  const roh = topLevelBlocks(html);
  const bloecke: HtmlBlock[] = roh.map((b) => {
    const inhalt = html.slice(b.start, b.end);
    const bilder = bildStellen
      .filter((s) => s.start >= b.start && s.start < b.end)
      .map((s) => s.nummer);
    if (bilder.length > 0) {
      return { ...b, art: "bild" as const, bilder, beschriftung: "" };
    }
    const text = blockText(inhalt);
    if (b.tag !== "p") {
      return { ...b, art: "anderes" as const, bilder: [], beschriftung: "" };
    }
    if (text === "") {
      return { ...b, art: "leer" as const, bilder: [], beschriftung: "" };
    }
    const openEnd = html.indexOf(">", b.start);
    const openTag = html.slice(b.start, openEnd + 1);
    const istBeschriftung = hasCaptionMarker(openTag) || NUMBERED_CAPTION_RE.test(text);
    if (!istBeschriftung) {
      return { ...b, art: "anderes" as const, bilder: [], beschriftung: "" };
    }
    const schlussAnfang = html.lastIndexOf("<", b.end - 1);
    return {
      ...b,
      art: "beschriftung" as const,
      bilder: [],
      beschriftung: html.slice(openEnd + 1, schlussAnfang),
    };
  });

  // ── Die Bildläufe: maximale Folgen aus Bild- und Leerblöcken mit mindestens einem Bild. ────────
  const laeufe: Bildlauf[] = [];
  const laufJeBlock = new Map<number, number>(); // Blockindex → Laufindex
  for (let i = 0; i < bloecke.length; ) {
    if (bloecke[i]?.art !== "bild" && bloecke[i]?.art !== "leer") {
      i += 1;
      continue;
    }
    let j = i;
    const bilder: number[] = [];
    while (j < bloecke.length && (bloecke[j]?.art === "bild" || bloecke[j]?.art === "leer")) {
      bilder.push(...(bloecke[j]?.bilder ?? []));
      j += 1;
    }
    if (bilder.length > 0) {
      const index = laeufe.length;
      laeufe.push({ bilder, von: i, bis: j - 1 });
      for (let k = i; k < j; k += 1) {
        laufJeBlock.set(k, index);
      }
    }
    i = j;
  }

  const laufVor = (blockIndex: number): number | undefined => laufJeBlock.get(blockIndex - 1);
  const laufNach = (blockIndex: number): number | undefined => laufJeBlock.get(blockIndex + 1);

  // ── Die Anwärter je Beschriftung: beide Nachbarläufe, ungewichtet. ────────────────────────────
  // Keine Einengung, keine Vorzugsseite. Eine Beschriftung zwischen zwei Bildläufen behält BEIDE
  // Anwärter und fällt damit unten durch die Eindeutigkeitsprüfung. Das ist gewollt: „ich weiss es
  // nicht" ist eine ehrliche Antwort, eine geratene Herkunft ist es nicht.
  const beschriftungen = bloecke
    .map((b, i) => ({ block: b, index: i }))
    .filter((e) => e.block.art === "beschriftung");
  const anwaerter = new Map<number, number[]>(); // Beschriftungs-Blockindex → Laufindizes
  for (const e of beschriftungen) {
    const liste = [laufVor(e.index), laufNach(e.index)].filter((x): x is number => x !== undefined);
    if (liste.length > 0) {
      anwaerter.set(e.index, liste);
    }
  }

  // ── Die Zuordnung: dreifache Eindeutigkeit, sonst nichts. ─────────────────────────────────────
  const waehlerJeLauf = new Map<number, number[]>(); // Laufindex → Beschriftungs-Blockindizes
  for (const [blockIndex, laufIndizes] of anwaerter) {
    for (const l of laufIndizes) {
      waehlerJeLauf.set(l, [...(waehlerJeLauf.get(l) ?? []), blockIndex]);
    }
  }

  const captions = new Map<number, string>();
  const verbraucht = new Set<number>(); // Beschriftungs-Blockindizes, die in eine figcaption wandern
  // JOB 3254: die MENGE statt eines Summanden. Die Läufe dieser Schleife sind paarweise verschieden
  // (`waehlerJeLauf` ist nach Laufindex geschlüsselt) und ihre Bildnummern damit disjunkt — die Größe
  // dieser Menge ist zeichengleich die Summe, die hier bis JOB 3210 gezählt wurde.
  const ambiguousImages = new Set<number>();
  for (const [laufIndex, waehler] of waehlerJeLauf) {
    const lauf = laeufe[laufIndex];
    const bildNummer = lauf?.bilder[0];
    const einzigerWaehler = waehler[0];
    const eindeutig =
      lauf !== undefined &&
      lauf.bilder.length === 1 &&
      bildNummer !== undefined &&
      waehler.length === 1 &&
      einzigerWaehler !== undefined &&
      (anwaerter.get(einzigerWaehler) ?? []).length === 1;
    if (eindeutig && einzigerWaehler !== undefined && bildNummer !== undefined) {
      const text = bloecke[einzigerWaehler]?.beschriftung ?? "";
      captions.set(bildNummer, text);
      verbraucht.add(einzigerWaehler);
    } else {
      for (const nummer of lauf?.bilder ?? []) {
        ambiguousImages.add(nummer);
      }
    }
  }

  // ── Der neue Rumpf: zugeordnete Beschriftungsabsätze raus, Stilmarke überall weg. ─────────────
  const teile: string[] = [];
  let cursor = 0;
  for (let i = 0; i < bloecke.length; i += 1) {
    const b = bloecke[i];
    if (b === undefined || b.art !== "beschriftung") {
      continue;
    }
    teile.push(html.slice(cursor, b.start));
    if (!verbraucht.has(i)) {
      const openEnd = html.indexOf(">", b.start);
      const openTag = html.slice(b.start, openEnd + 1);
      teile.push(stripCaptionMarker(openTag), html.slice(openEnd + 1, b.end));
    }
    cursor = b.end;
  }
  teile.push(html.slice(cursor));

  return {
    html: teile.join(""),
    captions,
    assigned: captions.size,
    ambiguousImages,
    ambiguous: ambiguousImages.size,
  };
}

// WP-BILD-1a/1b: jedes eingebettete Inline-Bild bekommt eine Bild-Fußnote. Aus <img> wird
//   <figure><img … data-image-id="kw-img-<runToken>-N"><figcaption data-image-id="kw-img-<runToken>-N">…
// WP-BILD-1b (bens Auflage 2, beidseitige Verankerung): NICHT nur die figcaption trägt die ID, sondern auch
// das <img> selbst — so sind Bild und Fußnote gegenseitig auffindbar (Galerie/Suche brauchen das später).
// WP-BILD-1b (bens Auflage 1): der runToken macht die IDs bodyweit kollisionsfest (ein frischer Token je
// Import-Lauf). Ohne explizites Token wird pro Aufruf/Import EIN Token erzeugt → alle Bilder eines Imports
// teilen den Token, nummeriert mit N.
// WP-D10 (Pedis Live-Befund): die Fußnote startet LEER. Ein Platzhalter ist KEIN Inhalt — der frühere
// injizierte Text („Noch keine Bildbeschreibung") stand als ECHTER figcaption-Text im Body und musste
// manuell gelöscht werden. Die Einlade-Affordanz ist jetzt rein visuell (Editor: data-kw-placeholder +
// CSS :empty::before, s. editorFigures.ts/index.css) und wird NIE gespeichert. Der Parameter
// `captionPlaceholder` bleibt als Enable-Signal/API-Stabilität erhalten, sein Text landet nicht im Body.
// Läuft auf der ROH-mammoth-Ausgabe (noch keine <figure>) VOR dem Byte-Budget, damit das Budget die
// zusätzlichen Tags mitzählt und bei Notbremse das GANZE figure-Element (Bild + Fußnote) droppt.
// AUFTRAG-mega69 Block A: bereits VERANKERTE Bilder (data-image-id) werden übersprungen. Auf dem
// DOCX-Weg (rohe mammoth-Ausgabe) gibt es sie nie — aber die Funktion läuft jetzt zusätzlich beim
// LADEN eines Vordertür-Entwurfs (frontDoorBodyFromDraft): dort können DOCX-/PPTX-verankerte
// figures neben unverankerten Klara-Bildern stehen, und ein zweiter Anker um einen ersten wäre
// eine geschachtelte figure mit doppelter Kennung.
// JOB 3210/M5c: `captions` ist die einzige Quelle für einen NICHT leeren Fussnoteninhalt beim
// Umhüllen — die Originalbeschriftung aus Word, zugeordnet von `planDocxImageCaptions`, geschlüsselt
// nach genau der Nummer `n`, die hier vergeben wird. OHNE dieses Argument bleibt jede Fussnote leer,
// wie seit WP-D10. Das ist keine Feinheit: `frontDoorBodyFromDraft` (captureFrontDoor.ts) ruft diese
// Funktion beim LADEN eines gespeicherten Entwurfs ohne `captions` — von Hand gepflegte Fussnoten
// werden dadurch nie überschrieben, und ein bereits verankertes Bild wird ohnehin übersprungen.
// ================================================================================================
// JOB 3254/M5c-UI (RUNDE 2) — DIE MEHRDEUTIGKEIT VERLÄSST DIESES MODUL ALS KENNUNG, NICHT ALS TEXT
// ================================================================================================
//
// RUNDE 1 hat hier ein data-Attribut mit dem lokalisierten Kennzeichnungstext IN DEN RUMPF
// geschrieben — dieselbe Bauform wie `data-kw-placeholder`. Gemessen wurde damals nur, dass beide
// Sanitizer es strippen; nicht gemessen wurde, dass der reale Weg /erfassen GENAU DURCH sie führt:
// das importierte HTML geht zuerst an den Server (`Capture.tsx` → `services/capture/src/service.ts`)
// und der Editor sanitisiert jede Fassung von aussen ein zweites Mal (`RichTextEditor.tsx:632`).
// Die Marke erreichte den Menschen also nie. Ein Rumpf, der sie überlebt, gäbe es nur ohne
// Sanitizer — und das ist kein Ausweg, sondern der Schaden.
//
// DESHALB TRÄGT DER RUMPF SIE NICHT MEHR. Was dieses Modul liefert, ist die Menge der BILDKENNUNGEN
// (`captionsAmbiguousImageIds`) — dieselben `data-image-id`-Werte, die es hier unten vergibt. Sie
// stehen in der Sanitizer-Allowlist für `figcaption` und überleben deshalb Speichern, Laden und
// beide Sanitizer unverändert. Der Text dazu entsteht erst im Editor (`editorFigures.ts`,
// `CAPTION_AMBIGUOUS_ATTR`), am lebenden DOM, an genau der Fussnote mit dieser Kennung.
//
// Der Rumpf bleibt damit BUCHSTÄBLICH zeichengleich zu vor diesem Auftrag — nicht „solange ein
// Argument fehlt", sondern immer. Es gibt keinen zweiten Zeichenketten-Eingang mehr.
export function wrapImagesInFigures(
  html: string,
  _captionPlaceholder: string,
  runToken: string = newImageRunToken(),
  captions?: ReadonlyMap<number, string>,
  // JOB 3254 R2: WELCHE Kennung diese Funktion dem wievielten Bild gegeben hat. Der Aufrufer leitet
  // die Kennung damit nicht selbst ab (`kw-img-<token>-N` ein zweites Mal zusammenzusetzen wäre eine
  // zweite Wahrheit, die bei jedem übersprungenen, schon verankerten Bild auseinanderliefe) —
  // sie kommt aus der einen Stelle, die sie vergibt. Ohne Rückruf ändert sich nichts.
  jeBild?: (bildNummer: number, bildkennung: string) => void,
): string {
  let n = 0;
  return html.replace(IMG_WRAP_RE, (imgTag) => {
    if (/\bdata-image-id\s*=/i.test(imgTag)) {
      return imgTag;
    }
    n += 1;
    const id = `${IMAGE_ID_PREFIX}${runToken}-${n}`;
    jeBild?.(n, id);
    // Dieselbe ID zusätzlich am <img> verankern (beidseitig auffindbar).
    const anchoredImg = imgTag.replace(/^<img/i, `<img data-image-id="${id}"`);
    const caption = captions?.get(n) ?? "";
    return `<figure>${anchoredImg}<figcaption data-image-id="${id}">${caption}</figcaption></figure>`;
  });
}

// JOB 513/D3B (BEN2-D2 Mangel 1, Ownerauflage): PPTX besitzt DREI reale Budgetkanten, nicht eine. Wer
// alle drei in denselben Zaehler schreibt und danach pauschal die HTML-Grenze meldet, nennt bei zwei von
// drei Faellen die FALSCHE wirkende Grenze. Die Grenzart ist deshalb ein eigener, stabiler Maschinenwert.
export type ImageBudgetLimitKind =
  // Das finale bodyHtml in echten UTF-8-Bytes (MAX_INLINE_BODY_HTML_BYTES bzw. der uebergebene Wert).
  // Gilt fuer DOCX UND PPTX — es ist die einzige Grenze, die der DOCX-Weg kennt.
  | "body-html"
  // Ein EINZELNES PPTX-Rohbild gegen PPTX_MAX_IMAGE_BYTES (Vorfilter vor der Base64-Kodierung).
  | "pptx-single-image"
  // Die SUMME der eingebetteten PPTX-Rohbilder gegen PPTX_MAX_TOTAL_IMAGE_BYTES.
  | "pptx-total-images";

// Ein budgetbedingter Verlust mit seiner Grenzart, dem REALEN Grenzwert und dem ausloesenden Wert.
// `actualBytes` ist der groesste gemessene Ausloeser dieser Art — nie ein Mittelwert und nie geraten.
export interface ImageBudgetDrop {
  kind: ImageBudgetLimitKind;
  limitBytes: number;
  actualBytes: number;
  count: number;
}

// Sammelt Drops je Grenzart: gleiche Art wird gezaehlt, der ausloesende Wert bleibt der groesste
// gemessene. Rein und ohne Seiteneffekt auf die Eingabe — der Aufrufer nimmt das Ergebnis entgegen.
export function addImageBudgetDrop(
  drops: readonly ImageBudgetDrop[],
  kind: ImageBudgetLimitKind,
  limitBytes: number,
  actualBytes: number,
): ImageBudgetDrop[] {
  const next = drops.map((d) => ({ ...d }));
  const hit = next.find((d) => d.kind === kind && d.limitBytes === limitBytes);
  if (hit) {
    hit.count += 1;
    hit.actualBytes = Math.max(hit.actualBytes, actualBytes);
    return next;
  }
  next.push({ kind, limitBytes, actualBytes, count: 1 });
  return next;
}

export interface InlineImageBudgetResult {
  html: string;
  total: number; // gesamte data:image-Bilder im Ausgangs-HTML
  kept: number; // im finalen HTML behaltene Bilder (kept = total - dropped)
  compressed: number; // Bilder, die TATSÄCHLICH re-encodiert wurden (encode änderte die src)
  dropped: number; // Bilder, die als Notbremse (Budget erschöpft) NICHT ins bodyHtml kamen
  bytes: number; // ECHTE UTF-8-Bytes des FINALEN HTML (Struktur + Text + Tail + behaltene Bilder)
  // WP-D1d: true, wenn schon der NICHT-BILD-Anteil (Text/Struktur/Tail) allein das Budget übersteigt —
  // dann ist das HTML NICHT garantiert unter dem Budget (Text ist nicht droppbar); der Aufrufer muss
  // ehrlich reagieren (Client-JSON-Guard refust den Request), kein stiller 413.
  overflow: boolean;
  // JOB 513/D3B/D3C: die `body-html`-Drops dieses Laufs mit Grenzwert und ausloesendem Bedarf.
  // BEWUSST OPTIONAL und nur gesetzt, wenn wirklich etwas budgetbedingt weggefallen ist: ein leeres
  // Feld waere eine Aussage ueber nichts. Der VERTRAG normalisiert danach auf ein Array
  // (imageTransferContract), sodass Konsumenten immer eine Liste sehen — hier steht die Rohmessung.
  budgetDrops?: ImageBudgetDrop[];
}

// WP-D1c: ECHTE UTF-8-Bytes (nicht String.length, das UTF-16-Codeeinheiten misst). Zentrale Messung
// für das Byte-Budget — Umlaute/Emoji im Text werden korrekt gezählt.
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

// WP-D1d: Byte-Deckel für das gesamte bodyHtml, vom Server-Ceiling (DRAFTS_BODY_LIMIT 5 MiB) mit Puffer
// für JSON-Envelope/Escaping abgeleitet. 3,5 MiB lässt komfortablen Rand zum 5-MiB-Ceiling (Blockquote,
// Titel/Statement, Quote-Escaping). DOM-frei, damit Node-Tests es ohne DOM-Globals importieren können;
// files.ts (DOM-Wrapper) re-exportiert es.
export const MAX_INLINE_BODY_HTML_BYTES = 3_500_000;

// JOB 513/D2 (BILDBUDGET-/TRANSFERVERTRAG): EIN gemeinsamer, maschinenlesbarer Vertrag ueber den
// tatsaechlichen Bildtransfer der dateibasierten Importkante — DOCX und PPTX liefern ihn identisch.
// EHRLICH heisst hier: es gibt im Produkt KEINE feste "erlaubte Bildzahl"; wie viele Bilder ankommen,
// ist eine Funktion der Bildgroessen gegen das BESTEHENDE Bytebudget (MAX_INLINE_BODY_HTML_BYTES bzw.
// das je Lauf uebergebene budgetBytes). Der Vertrag nennt deshalb die WIRKSAME Bytegrenze und die
// REALEN Ergebniszaehler — er erfindet keine Grenze und definiert keine zweite Zahl daneben.
export interface ImageTransferContract {
  // Wurde ueberhaupt ein Bildtransfer versucht? false = die Bilder wurden nur GEZAEHLT (PPTX-Altpfad
  // ohne imageCaptionPlaceholder); dann sind alle Transferzaehler ehrlich 0 und kein Grund gilt.
  attempted: boolean;
  // Tatsaechlich in der QUELLE erkannte Bilder.
  totalImages: number;
  // Davon real im finalen bodyHtml angekommene Bilder.
  embeddedImages: number;
  // Davon tatsaechlich re-encodiert (nur der DOCX-Weg komprimiert; PPTX kodiert Rohbytes direkt).
  compressedImages: number;
  // Wegen des Bytebudgets weggelassene Bilder (Drop-to-fit).
  droppedImageBudget: number;
  // Wegen nicht darstellbaren Formats weggelassene Bilder (PPTX: EMF/WMF/TIFF/BMP …).
  droppedImageFormat: number;
  // Wegen defekter/unaufloesbarer Referenz weggelassene Bilder (Rels-Ziel oder Mediendatei fehlt).
  droppedImageUnresolved: number;
  // JOB 513/D3B (BEN2-D2 Mangel 2): Bildverweise AUSSERHALB des ausgewerteten Bildpfads (PPTX: ein
  // `a:blip`, das nicht in einem `p:pic` steht — typisch ein Hintergrundbild). Sie sind weder Budget-
  // noch Format- noch Defektverlust: sie wurden nie versucht. Bis D2 fielen sie zaehlerlos heraus, und
  // genau dadurch konnte eine unausgeglichene Bilanz als vollstaendiger Erfolg erscheinen.
  droppedImageOutsidePath: number;
  // Mehrfachverweise auf DIESELBE Mediendatei (jenseits des ersten Verweises) — KEIN Verlustgrund,
  // sondern eine getrennt gefuehrte Eigenschaft der Quelle.
  duplicateImageRefs: number;
  // JOB 513/D3B: je budgetbedingtem Verlust die tatsaechlich zuerst ausloesende Grenzart, ihr REALER
  // Wert und der ausloesende Bedarf. Leer = kein budgetbedingter Verlust.
  budgetDrops: ImageBudgetDrop[];
  // Die WIRKSAME UTF-8-Bytegrenze dieses Laufs; null = es wirkte ueberhaupt keine Bytegrenze.
  bodyBudgetBytes: number | null;
  // Echte UTF-8-Bytes des finalen bodyHtml.
  bodyBytes: number;
  // true, wenn schon der NICHT-BILD-Anteil das Budget uebersteigt (Text ist nicht droppbar).
  bodyOverflow: boolean;
}

// Baut den Vertrag aus den REALEN Zaehlern; nicht belegte Ursachen bleiben 0 (statt geraten zu werden).
export function imageTransferContract(input: {
  attempted: boolean;
  totalImages: number;
  embeddedImages: number;
  bodyBytes: number;
  bodyBudgetBytes: number | null;
  bodyOverflow: boolean;
  compressedImages?: number;
  droppedImageBudget?: number;
  droppedImageFormat?: number;
  droppedImageUnresolved?: number;
  droppedImageOutsidePath?: number;
  duplicateImageRefs?: number;
  budgetDrops?: readonly ImageBudgetDrop[];
}): ImageTransferContract {
  return {
    attempted: input.attempted,
    totalImages: input.totalImages,
    embeddedImages: input.embeddedImages,
    compressedImages: input.compressedImages ?? 0,
    droppedImageBudget: input.droppedImageBudget ?? 0,
    droppedImageFormat: input.droppedImageFormat ?? 0,
    droppedImageUnresolved: input.droppedImageUnresolved ?? 0,
    droppedImageOutsidePath: input.droppedImageOutsidePath ?? 0,
    duplicateImageRefs: input.duplicateImageRefs ?? 0,
    budgetDrops: (input.budgetDrops ?? []).map((d) => ({ ...d })),
    bodyBudgetBytes: input.bodyBudgetBytes,
    bodyBytes: input.bodyBytes,
    bodyOverflow: input.bodyOverflow,
  };
}

// Geht die Bilanz auf? uebernommen + Budget + Format + Defekt + ausserhalb des Bildpfads === tatsaechlich
// erkannt. JOB 513/D3B: `droppedImageOutsidePath` ist neu in dieser Summe. Bis D2 fehlte er, und ein
// Hintergrund-`a:blip` machte die Bilanz still unausgeglichen — der Vertrag meldete trotzdem
// `all-transferred`. Ein `false` hier ist ab jetzt ein HARTES Rot (s. imageTransferOutcome), kein Hinweis.
// Bei attempted === false ist die Frage gegenstandslos (es wurde nichts uebertragen).
export function imageTransferBalanced(contract: ImageTransferContract): boolean {
  if (!contract.attempted) {
    return contract.embeddedImages === 0;
  }
  return (
    contract.embeddedImages +
      contract.droppedImageBudget +
      contract.droppedImageFormat +
      contract.droppedImageUnresolved +
      contract.droppedImageOutsidePath ===
    contract.totalImages
  );
}

// JOB 513/D2: reine Zaehlung der data:image-Bildeinheiten (figure-Block oder blankes <img>) — dieselbe
// Einheit, die das Byte-Budget droppt. Ohne Budgetlauf ist sie die ehrliche Gesamtzahl.
export function countInlineImages(html: string): number {
  return html.match(IMG_TAG_DATA_RE)?.length ?? 0;
}

// WP-D1d (bens ROT-Fix 1): hartes Byte-Budget für das GESAMTE finale bodyHtml (Struktur + Text + Tail +
// alle behaltenen Bilder), in ECHTEN UTF-8-Bytes. Vorgehen: erst den NICHT-BILD-Anteil (alle Literale
// inkl. Tail = das HTML OHNE die <img>-Tags) vorab messen, dann Bilder nur behalten, solange
// nonImageBytes + Bild-Bytes ≤ Budget bleiben — so ist das FINALE HTML (Tail eingerechnet) garantiert
// ≤ Budget. Übersteigt schon der Nicht-Bild-Anteil allein das Budget, werden ALLE Bilder als Notbremse
// entfernt und `overflow: true` gesetzt (Text ist nicht droppbar; der Aufrufer refust ehrlich). Auch der
// Kein-Bild-Pfad wird hart geprüft (kein ungeprüftes Rückgeben). Kern-Use-Case (Pedi): viele Bilder →
// über `encode` AGGRESSIV komprimiert und BEHALTEN; Wegwerfen nur als letzte Notbremse.
export async function applyInlineImageBudget(
  html: string,
  encode: (src: string) => Promise<string>,
  budgetBytes: number,
): Promise<InlineImageBudgetResult> {
  // Treffer zuerst synchron sammeln (Regex-Zustand), dann sequenziell encoden + Budget prüfen.
  const matches: { full: string; src: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = IMG_TAG_DATA_RE.exec(html)) !== null) {
    // src steht je nach Alternation in Gruppe 1 (figure-umhüllt) oder 2 (bare <img>).
    matches.push({
      full: m[0],
      src: m[1] ?? m[2] ?? "",
      start: m.index,
      end: IMG_TAG_DATA_RE.lastIndex,
    });
  }
  // Nicht-Bild-Anteil = alle Literale zwischen/um die Bilder INKL. Tail (das HTML ohne die <img>-Tags).
  const literals: string[] = [];
  let cursor = 0;
  for (const match of matches) {
    literals.push(html.slice(cursor, match.start));
    cursor = match.end;
  }
  literals.push(html.slice(cursor)); // Tail nach dem letzten Bild — MUSS mitgezählt werden.
  const nonImageBytes = literals.reduce((sum, lit) => sum + utf8ByteLength(lit), 0);

  // Kein-Bild-Pfad (bens Fix 1): NICHT ungeprüft zurückgeben — hart gegen das Budget prüfen.
  if (matches.length === 0) {
    return {
      html,
      total: 0,
      kept: 0,
      compressed: 0,
      dropped: 0,
      bytes: nonImageBytes,
      overflow: nonImageBytes > budgetBytes,
    };
  }

  // Übersteigt schon der reine Text/Struktur-Anteil das Budget → alle Bilder weg, overflow.
  if (nonImageBytes > budgetBytes) {
    return {
      html: literals.join(""),
      total: matches.length,
      kept: 0,
      compressed: 0,
      dropped: matches.length,
      bytes: nonImageBytes,
      overflow: true,
      // JOB 513/D3B: auch dieser Notbremsen-Zweig nennt die wirkende Grenzart und den ausloesenden
      // Bedarf — hier ist es der nicht droppbare Text/Struktur-Anteil selbst.
      budgetDrops: [
        {
          kind: "body-html",
          limitBytes: budgetBytes,
          actualBytes: nonImageBytes,
          count: matches.length,
        },
      ],
    };
  }

  const parts: string[] = [];
  let usedBytes = nonImageBytes; // der Nicht-Bild-Anteil ist gesetzt und nicht droppbar
  let kept = 0;
  let compressed = 0;
  let dropped = 0;
  let budgetDrops: ImageBudgetDrop[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match) {
      continue;
    }
    parts.push(literals[i] ?? "");
    const encodedSrc = await encode(match.src);
    const keptTag = match.full.replace(match.src, encodedSrc);
    const tagBytes = utf8ByteLength(keptTag);
    if (usedBytes + tagBytes <= budgetBytes) {
      parts.push(keptTag);
      usedBytes += tagBytes;
      kept += 1;
      if (encodedSrc !== match.src) {
        compressed += 1; // tatsächlich re-encodiert (nicht unverändert)
      }
    } else {
      dropped += 1; // Notbremse: Bild weglassen — Original bleibt als Anhang (WP-D2).
      // JOB 513/D3B: der ausloesende Wert ist der Bedarf, der die Grenze gerissen haette — der bereits
      // belegte Anteil plus dieses Bild. Damit ist rekonstruierbar, WIE weit es darueber lag.
      budgetDrops = addImageBudgetDrop(budgetDrops, "body-html", budgetBytes, usedBytes + tagBytes);
    }
  }
  parts.push(literals[matches.length] ?? ""); // Tail
  const finalHtml = parts.join("");
  // Harte Endprüfung (bens Fix 1): die tatsächliche Byte-Größe des FINALEN HTML ist die Wahrheit.
  const bytes = utf8ByteLength(finalHtml);
  return {
    html: finalHtml,
    total: matches.length,
    kept,
    compressed,
    dropped,
    bytes,
    overflow: bytes > budgetBytes,
    ...(budgetDrops.length > 0 ? { budgetDrops } : {}),
  };
}

export interface DocxRichResult {
  html: string; // strukturerhaltendes HTML (h2/h3, Listen, Tabellen, strong/em, data:image-Bilder)
  text: string; // Klartext — weiterhin nötig für die KI-Punkte-Extraktion
  totalImages: number; // eingebettete Bilder insgesamt
  compressedImages: number; // WP-D1d: tatsächlich re-encodierte (komprimierte) Bilder
  droppedImages: number; // Bilder, die als Notbremse NICHT ins bodyHtml kamen
  htmlOverflow: boolean; // WP-D1d: true, wenn das bodyHtml das Budget trotz Notbremse übersteigt (Text)
  // JOB 1115/D-042: die aus dem Wissenskörper entfernten Rahmenzeilen, in ihrer Reihenfolge. Leer,
  // wenn nichts entfernt wurde. Sie sind zusätzlich im HTML als Quellenvermerk-Block bewahrt — dieses
  // Feld ist die maschinenlesbare Fassung derselben Wahrheit, damit ein Aufrufer sie später auch in
  // den EINEN Quelle-Blockquote (captureFromFile.ts) einfügen kann, ohne sie erneut zu parsen.
  frameLines: string[];
  // JOB 513/D2: der gemeinsame, maschinenlesbare Bildtransfer-Vertrag (identisch im PPTX-Weg). Die
  // bestehenden Felder darueber bleiben unveraendert bedient — der Vertrag ist rein additiv.
  imageTransfer: ImageTransferContract;
  // ── JOB 3210/M5c ──────────────────────────────────────────────────────────────────────────────
  // Bilder, die eine vorhandene Word-Beschriftung im Wortlaut in ihre `figcaption` bekommen haben.
  captionsAssigned: number;
  // Bilder, zu denen ein Beschriftungs-Anwärter danebenstand, deren Zuordnung aber NICHT eindeutig
  // war — sie bleiben leer. Bilder ganz OHNE Anwärter stehen hier ausdrücklich NICHT drin: „keine
  // Beschriftung vorhanden" und „Beschriftung vorhanden, aber mehrdeutig" sind zwei verschiedene
  // Wahrheiten, und nur die zweite ist eine offene Frage.
  //
  // BEIDE ZÄHLER WERDEN ANGEZEIGT (JOB 3254/M5c-UI — die Zeile, auf die dieser Kommentar bis heute
  // als „nicht Teil dieses Auftrags" verwies; die frühere Aussage „KEINE Nutzeranzeige" gilt nicht
  // mehr). Sie bilden die Beschriftungsbilanz der Import-Quittung (`captureFromFile.ts`,
  // `beschriftungsBilanzBausteine`) und sind damit eine UI-Abnahme: wer sie ändert, ändert einen
  // sichtbaren Satz. Gemessen werden sie unverändert am Ergebnis der Zuordnung, also VOR der
  // Byte-Notbremse — ein Bild, das das Budget später fallen lässt, nimmt seine Beschriftung mit und
  // bleibt hier gezählt.
  captionsAmbiguous: number;
  // JOB 3254/M5c-UI (R2): WELCHE Bilder das sind — die `data-image-id`-Werte ihrer Fussnoten, in
  // Dokumentreihenfolge. Die Zahl darüber trägt die Bilanz der Quittung, diese Liste trägt die
  // Aussage AM EINZELNEN BILD; ohne sie wäre „zwei sind unklar" eine Angabe, die der Mensch keinem
  // Bild zuordnen kann.
  //
  // KENNUNGEN UND KEIN TEXT, und das ist der Kern der Runde 2: die Kennung steht in der
  // Sanitizer-Allowlist für `figcaption` und überlebt Speichern und Laden; ein Anzeigetext täte das
  // nicht und dürfte es auch nicht (er ist eine Ansicht auf einen Zustand, nie Inhalt). Wer sie
  // anzeigt, ist der Editor (`editorFigures.ts`) — dieses Modul kennt weder DOM noch i18n.
  //
  // Leer bei jedem Lauf ohne Bild-Fussnoten und bei jedem Dokument ohne mehrdeutige Beschriftung.
  // Ein Bild, das die Byte-Notbremse danach fallen lässt, steht weiter drin: die Liste ist eine
  // Aussage über die ZUORDNUNG, nicht über den Verbleib im Rumpf — findet der Editor die Kennung
  // nicht, zeigt er nichts.
  captionsAmbiguousImageIds: readonly string[];
}

// WP-D1: strukturerhaltende Extraktion (HTML + Klartext in EINEM Durchgang über die Engine).
// WP-D1b: mit `imageBudgetBytes` gilt ein hartes Gesamt-Byte-Budget für die Inline-Bilder
// (überzählige werden weggelassen; `droppedImages` meldet ehrlich, wie viele).
export async function extractDocxRich(
  buffer: ArrayBuffer,
  opts: {
    engine?: DocxEngine;
    mapImage?: (src: string) => Promise<string>;
    imageBudgetBytes?: number;
    // WP-BILD-1a: gesetzt → jedes Inline-Bild wird in <figure> mit leerem/Platzhalter-<figcaption>
    // (Bild-Fußnote) gehüllt. Der lokalisierte Platzhalter-Text wird injiziert (DOM-frei, kein i18n hier).
    imageCaptionPlaceholder?: string;
    // WP-BILD-1b: optionales, festes Import-Token für die Bild-IDs (kw-img-<token>-N). Ohne Angabe wird pro
    // Import ein frisches Token erzeugt — nur Tests setzen es für deterministische IDs.
    imageRunToken?: string;
  } = {},
): Promise<DocxRichResult> {
  const engine = opts.engine ?? (await defaultEngine());
  const input = mammothInput(buffer);
  // JOB 3210/M5c: Die Stilkarte wird GENAU DANN mitgegeben, wenn dieser Lauf auch Bild-Fussnoten
  // baut — nur dann gibt es eine `figcaption`, in die eine Beschriftung wandern könnte, und nur
  // dann räumt `planDocxImageCaptions` die Marke danach wieder weg. Ein Lauf ohne Fussnoten sieht
  // die Marke also nie und bleibt zeichengleich zu vorher.
  const beschriftungenErkennen = Boolean(opts.mapImage) && Boolean(opts.imageCaptionPlaceholder);
  const htmlResult = await engine.convertToHtml(
    input,
    beschriftungenErkennen ? { styleMap: DOCX_CAPTION_STYLE_MAP } : undefined,
  );
  const textResult = await engine.extractRawText(input);
  let html = mapDocxHeadings(htmlResult.value.trim());
  const documentText = textResult.value.trim();
  // JOB 1115: D-042 und D-043 als zwei Schritte DERSELBEN Kette, unmittelbar hinter der
  // Überschriften-Abbildung — sie braucht D-042, um „vor der ersten Überschrift" überhaupt bestimmen
  // zu können (h1 ist an dieser Stelle bereits h2).
  //
  // REIHENFOLGE, und sie ist nicht beliebig: erst die Rahmenzeilen, dann die Anker. Solange die
  // Inhaltsverzeichnis-Absätze noch ihr `<a>` tragen, sind sie für D-042 keine reinen Textabsätze und
  // damit strukturell geschützt. Andersherum stünden sie nach D-043 als nackte kurze Absätze vor der
  // ersten Überschrift und hingen allein an der Wiederkehrprüfung.
  const entrahmt = stripDocxFrameLines(html, documentText);
  const frameLines = entrahmt.frameLines;
  html = neutralizeDocxTocLinks(entrahmt.html);
  // Bewahren statt wegwerfen: der Vermerk wird VOR den Körper gesetzt. Ohne Fund passiert hier
  // nichts — ein Dokument ohne Rahmenzeilen bleibt zeichengleich.
  if (frameLines.length > 0) {
    html = `${frameLinesNote(frameLines)}${html}`;
  }
  let droppedImages = 0;
  let totalImages = 0;
  let compressedImages = 0;
  let htmlOverflow = false;
  // JOB 513/D2: die Vertragszahlen entstehen aus den REALEN Zaehlern dieses Laufs. `totalImages` oben
  // bleibt aus Rueckwaertskompatibilitaet an den Budgetlauf gebunden; der Vertrag zaehlt IMMER ehrlich.
  let transferTotal = 0;
  let transferEmbedded = 0;
  let bodyBudgetBytes: number | null = null;
  // JOB 513/D3B: der DOCX-Weg kennt genau EINE Budgetkante — `body-html`. Das ist keine Vereinfachung,
  // sondern die Wahrheit dieses Pfads: mammoth liefert bereits eingebettete data:image-Quellen, es gibt
  // hier weder Rohbyte-Vorfilter noch eine Summengrenze. Genau deshalb ist die Grenzart wichtig.
  let budgetDrops: ImageBudgetDrop[] = [];
  let captionsAssigned = 0;
  let captionsAmbiguous = 0;
  // JOB 3254 R2: die Kennungen der mehrdeutig leer gebliebenen Fussnoten. Sie entstehen erst beim
  // Umhüllen — vorher gibt es die Fussnote und damit ihre Kennung noch gar nicht.
  let captionsAmbiguousImageIds: string[] = [];
  if (opts.mapImage) {
    // WP-BILD-1a: VOR dem Budget umhüllen, damit das Budget die figure/figcaption-Bytes mitzählt und
    // eine Notbremse das ganze figure-Element droppt (Bild + Fußnote gemeinsam).
    if (opts.imageCaptionPlaceholder) {
      // JOB 3210/M5c: erst zuordnen, dann umhüllen. Der Plan nimmt die zugeordneten
      // Beschriftungsabsätze aus dem Fliesstext und reicht sie nach Bildnummer weiter — die
      // Fussnote entsteht damit gleich GEFÜLLT und nicht leer und später nachgetragen.
      const plan = planDocxImageCaptions(html);
      html = plan.html;
      captionsAssigned = plan.assigned;
      captionsAmbiguous = plan.ambiguous;
      // JOB 3254 R2: die Bildnummern des Plans werden hier zu Bildkennungen — an derselben Stelle,
      // die sie vergibt, und für dieselbe Menge, aus der auch `captionsAmbiguous` entsteht. Die
      // Unterscheidung „kein Anwärter" gegen „Anwärter, nicht eindeutig" wird NICHT neu getroffen.
      const ambiguousIds: string[] = [];
      html = wrapImagesInFigures(
        html,
        opts.imageCaptionPlaceholder,
        opts.imageRunToken ?? newImageRunToken(),
        plan.captions,
        (bildNummer, bildkennung) => {
          if (plan.ambiguousImages.has(bildNummer)) {
            ambiguousIds.push(bildkennung);
          }
        },
      );
      captionsAmbiguousImageIds = ambiguousIds;
    }
    if (opts.imageBudgetBytes !== undefined) {
      const budgeted = await applyInlineImageBudget(html, opts.mapImage, opts.imageBudgetBytes);
      html = budgeted.html;
      droppedImages = budgeted.dropped;
      totalImages = budgeted.total;
      compressedImages = budgeted.compressed;
      htmlOverflow = budgeted.overflow;
      transferTotal = budgeted.total;
      transferEmbedded = budgeted.kept;
      budgetDrops = budgeted.budgetDrops ?? [];
      // Die wirksame Grenze ist genau der uebergebene Wert der autoritativen Quelle — kein Echo, keine
      // zweite Zahl (das oeffentliche Ergebnisobjekt von applyInlineImageBudget bleibt unveraendert).
      bodyBudgetBytes = opts.imageBudgetBytes;
    } else {
      // Ohne Bytebudget wirkt KEINE Grenze — alle erkannten Bilder bleiben im HTML (bodyBudgetBytes
      // bleibt null; eine Grenze zu behaupten, die nicht wirkte, waere unehrlich).
      transferTotal = countInlineImages(html);
      transferEmbedded = transferTotal;
      html = await mapInlineImages(html, opts.mapImage);
    }
  } else {
    // Ohne mapImage werden die Rohbilder unveraendert uebernommen: kein Budget, kein Drop.
    transferTotal = countInlineImages(html);
    transferEmbedded = transferTotal;
  }
  return {
    html,
    // Der Klartext bleibt VOLLSTÄNDIG — er trägt die KI-Punkte-Extraktion, und dort ist eine
    // Kopfzeile harmlos. Entfernt wird ausschliesslich aus dem Wissenskörper, den ein Mensch
    // einreicht. Zwei verschiedene Zwecke, zwei verschiedene Wahrheiten — bewusst nicht angeglichen.
    text: documentText,
    frameLines,
    totalImages,
    compressedImages,
    droppedImages,
    htmlOverflow,
    captionsAssigned,
    captionsAmbiguous,
    captionsAmbiguousImageIds,
    // Format- und Defektverluste kennt der DOCX-Weg nicht: mammoth liefert bereits eingebettete
    // data:image-Quellen, es gibt keine Rels-Aufloesung und keine Formatablehnung beim Import (der
    // Sanitizer entscheidet spaeter serverseitig). Diese realen Unterschiede zum PPTX-Weg werden mit 0
    // ausgewiesen, nicht versteckt.
    imageTransfer: imageTransferContract({
      attempted: true,
      totalImages: transferTotal,
      embeddedImages: transferEmbedded,
      compressedImages,
      droppedImageBudget: droppedImages,
      budgetDrops,
      bodyBudgetBytes,
      bodyBytes: utf8ByteLength(html),
      bodyOverflow: htmlOverflow,
    }),
  };
}

// Reiner Klartext-Extraktionskern (ArrayBuffer → Klartext) — bestehender Vertrag für die
// Punkte-/Text-Pfade (BodyExtractPanel, „Text aus Datei einfügen").
export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const engine = await defaultEngine();
  const result = await engine.extractRawText(mammothInput(buffer));
  return result.value.trim();
}
