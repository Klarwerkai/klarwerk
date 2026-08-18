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

// Injizierbarer Engine-Vertrag (Muster PdfEngine in ./pdf): Tests nutzen einen Fake,
// der Browser-Wrapper lädt das echte mammoth lazy.
export interface DocxEngine {
  convertToHtml(input: MammothInput): Promise<MammothResult>;
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
export function wrapImagesInFigures(
  html: string,
  _captionPlaceholder: string,
  runToken: string = newImageRunToken(),
): string {
  let n = 0;
  return html.replace(IMG_WRAP_RE, (imgTag) => {
    if (/\bdata-image-id\s*=/i.test(imgTag)) {
      return imgTag;
    }
    n += 1;
    const id = `${IMAGE_ID_PREFIX}${runToken}-${n}`;
    // Dieselbe ID zusätzlich am <img> verankern (beidseitig auffindbar).
    const anchoredImg = imgTag.replace(/^<img/i, `<img data-image-id="${id}"`);
    return `<figure>${anchoredImg}<figcaption data-image-id="${id}"></figcaption></figure>`;
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
  const htmlResult = await engine.convertToHtml(input);
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
  if (opts.mapImage) {
    // WP-BILD-1a: VOR dem Budget umhüllen, damit das Budget die figure/figcaption-Bytes mitzählt und
    // eine Notbremse das ganze figure-Element droppt (Bild + Fußnote gemeinsam).
    if (opts.imageCaptionPlaceholder) {
      html = wrapImagesInFigures(
        html,
        opts.imageCaptionPlaceholder,
        opts.imageRunToken ?? newImageRunToken(),
      );
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
