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

function escapeCaption(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// WP-BILD-1a/1b: jedes eingebettete Inline-Bild bekommt eine Bild-Fußnote. Aus <img> wird
//   <figure><img … data-image-id="kw-img-<runToken>-N"><figcaption data-image-id="kw-img-<runToken>-N">…
// WP-BILD-1b (bens Auflage 2, beidseitige Verankerung): NICHT nur die figcaption trägt die ID, sondern auch
// das <img> selbst — so sind Bild und Fußnote gegenseitig auffindbar (Galerie/Suche brauchen das später).
// WP-BILD-1b (bens Auflage 1): der runToken macht die IDs bodyweit kollisionsfest (ein frischer Token je
// Import-Lauf). Ohne explizites Token wird pro Aufruf/Import EIN Token erzeugt → alle Bilder eines Imports
// teilen den Token, nummeriert mit N.
// Die Fußnote startet mit einem EHRLICHEN, injizierten Platzhalter (KEINE erfundene Beschreibung).
// Läuft auf der ROH-mammoth-Ausgabe (noch keine <figure>) VOR dem Byte-Budget, damit das Budget die
// zusätzlichen Tags mitzählt und bei Notbremse das GANZE figure-Element (Bild + Fußnote) droppt.
export function wrapImagesInFigures(
  html: string,
  captionPlaceholder: string,
  runToken: string = newImageRunToken(),
): string {
  const caption = escapeCaption(captionPlaceholder);
  let n = 0;
  return html.replace(IMG_WRAP_RE, (imgTag) => {
    n += 1;
    const id = `${IMAGE_ID_PREFIX}${runToken}-${n}`;
    // Dieselbe ID zusätzlich am <img> verankern (beidseitig auffindbar).
    const anchoredImg = imgTag.replace(/^<img/i, `<img data-image-id="${id}"`);
    return `<figure>${anchoredImg}<figcaption data-image-id="${id}">${caption}</figcaption></figure>`;
  });
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
    };
  }

  const parts: string[] = [];
  let usedBytes = nonImageBytes; // der Nicht-Bild-Anteil ist gesetzt und nicht droppbar
  let kept = 0;
  let compressed = 0;
  let dropped = 0;
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
  };
}

export interface DocxRichResult {
  html: string; // strukturerhaltendes HTML (h2/h3, Listen, Tabellen, strong/em, data:image-Bilder)
  text: string; // Klartext — weiterhin nötig für die KI-Punkte-Extraktion
  totalImages: number; // eingebettete Bilder insgesamt
  compressedImages: number; // WP-D1d: tatsächlich re-encodierte (komprimierte) Bilder
  droppedImages: number; // Bilder, die als Notbremse NICHT ins bodyHtml kamen
  htmlOverflow: boolean; // WP-D1d: true, wenn das bodyHtml das Budget trotz Notbremse übersteigt (Text)
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
  let droppedImages = 0;
  let totalImages = 0;
  let compressedImages = 0;
  let htmlOverflow = false;
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
    } else {
      html = await mapInlineImages(html, opts.mapImage);
    }
  }
  return {
    html,
    text: textResult.value.trim(),
    totalImages,
    compressedImages,
    droppedImages,
    htmlOverflow,
  };
}

// Reiner Klartext-Extraktionskern (ArrayBuffer → Klartext) — bestehender Vertrag für die
// Punkte-/Text-Pfade (BodyExtractPanel, „Text aus Datei einfügen").
export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const engine = await defaultEngine();
  const result = await engine.extractRawText(mammothInput(buffer));
  return result.value.trim();
}
