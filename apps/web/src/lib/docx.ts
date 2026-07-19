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

// WP-D1b (Fix d): das GESAMTE <img data:image>-Element (nicht nur die src) — damit ein Bild bei
// Budget-Überschreitung KONTROLLIERT weggelassen werden kann (das ganze Tag entfällt). Nicht-data:-
// Quellen (Object-Store-/raw) bleiben unberührt.
const IMG_TAG_DATA_RE = /<img\b[^>]*\bsrc="(data:image\/[a-zA-Z0-9.+-]+;base64,[^"]*)"[^>]*>/gi;

export interface InlineImageBudgetResult {
  html: string;
  dropped: number; // Bilder, die wegen des Byte-Budgets NICHT ins bodyHtml übernommen wurden
}

// WP-D1b (Fix d): hartes GESAMT-Byte-Budget für die eingebetteten data:image-Bilder. Jedes Bild wird
// (dimensions- UND byte-getrieben) über `encode` re-encodiert und über ein laufendes Budget summiert;
// passt es nicht mehr, wird das GANZE <img>-Element weggelassen (kein Absturz, kein 413). Verlustarm:
// das ORIGINAL bleibt über WP-D2 als Anhang erhalten. DOM-frei (encode injiziert) → unit-testbar.
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
    matches.push({ full: m[0], src: m[1] ?? "", start: m.index, end: IMG_TAG_DATA_RE.lastIndex });
  }
  if (matches.length === 0) {
    return { html, dropped: 0 };
  }
  const parts: string[] = [];
  let last = 0;
  let used = 0;
  let dropped = 0;
  for (const match of matches) {
    parts.push(html.slice(last, match.start));
    const encoded = await encode(match.src);
    if (used + encoded.length <= budgetBytes) {
      used += encoded.length;
      parts.push(match.full.replace(match.src, encoded));
    } else {
      dropped += 1; // Bild weglassen — Original bleibt als Anhang (WP-D2).
    }
    last = match.end;
  }
  parts.push(html.slice(last));
  return { html: parts.join(""), dropped };
}

export interface DocxRichResult {
  html: string; // strukturerhaltendes HTML (h2/h3, Listen, Tabellen, strong/em, data:image-Bilder)
  text: string; // Klartext — weiterhin nötig für die KI-Punkte-Extraktion
  droppedImages: number; // WP-D1b: Bilder, die wegen des Byte-Budgets NICHT ins bodyHtml kamen
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
  } = {},
): Promise<DocxRichResult> {
  const engine = opts.engine ?? (await defaultEngine());
  const input = mammothInput(buffer);
  const htmlResult = await engine.convertToHtml(input);
  const textResult = await engine.extractRawText(input);
  let html = mapDocxHeadings(htmlResult.value.trim());
  let droppedImages = 0;
  if (opts.mapImage) {
    if (opts.imageBudgetBytes !== undefined) {
      const budgeted = await applyInlineImageBudget(html, opts.mapImage, opts.imageBudgetBytes);
      html = budgeted.html;
      droppedImages = budgeted.dropped;
    } else {
      html = await mapInlineImages(html, opts.mapImage);
    }
  }
  return { html, text: textResult.value.trim(), droppedImages };
}

// Reiner Klartext-Extraktionskern (ArrayBuffer → Klartext) — bestehender Vertrag für die
// Punkte-/Text-Pfade (BodyExtractPanel, „Text aus Datei einfügen").
export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const engine = await defaultEngine();
  const result = await engine.extractRawText(mammothInput(buffer));
  return result.value.trim();
}
