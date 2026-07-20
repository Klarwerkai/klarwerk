// PMO-FEA-0006: DOM-freie Logik für den Erzähl-Modus „Aus Datei" — Dokument hochladen,
// KI-Punkteliste mit Belegstellen, ausgewählte Punkte als Entwurfs-Warteschlange nacheinander
// im bestehenden Wizard prüfen/einreichen. NICHTS wird automatisch gespeichert; die Quelle
// (Dateiname) wird beim Einreichen als Source am Wissensobjekt vermerkt.
import type { DraftPayload, ExtractedPoint, StructureResult } from "../api/types";
// WP-D1e (Fix 2): der Preflight misst den Payload MIT einem reservierten Object-Link — dieselbe
// (DOM-freie) Link-Erzeugung wie im Ganzdokument-Save, damit die Reserve exakt zum realen Link passt.
import { fileLinkHtml } from "./bodyFileLink";

// Auswählbarer Punkt in der Liste (Checkbox-Zustand; Default: ausgewählt).
export interface SelectableExtractPoint extends ExtractedPoint {
  id: string;
  selected: boolean;
}

// Sichtbare Warteschlange: ausgewählte Punkte, einer nach dem anderen im Wizard.
export interface FileDraftQueue {
  fileName: string;
  points: ExtractedPoint[];
  index: number; // 0-basiert; zeigt auf den AKTUELL bearbeiteten Punkt
}

export type FileImportMode = "points" | "whole";

// WP-D7 (Befund 1, Pedi-Live-Test): .pptx war im Datei-Dialog ausgegraut, weil MEHRERE file-inputs
// eigene, hartkodierte accept-Listen ohne .pptx trugen. EINE Quelle der Wahrheit statt Duplikate.
// FILE_IMPORT_ACCEPT = Dokument-Import (Text-Extraktion): Text/Markdown/CSV/JSON, Word, PDF, PowerPoint,
// Bilder. Beide PPTX-Formen (Endung UND MIME), damit der Dialog die Datei nicht ausgraut.
export const FILE_IMPORT_ACCEPT =
  ".txt,.md,.markdown,.csv,.log,.json,.docx,.pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*";

// FILE_CAPTURE_ACCEPT = allgemeiner Capture-/Anhang-Upload: wie der Dokument-Import PLUS Video/Audio
// (die per Transkription zu Text werden). Leitet sich aus FILE_IMPORT_ACCEPT ab → pptx bleibt automatisch
// dabei, kein Drift.
export const FILE_CAPTURE_ACCEPT = `${FILE_IMPORT_ACCEPT},video/*,audio/*`;

// Punkte aus der Extraktion in auswählbare Listeneinträge heben (alle vorausgewählt —
// der Experte wählt AB, was nicht gebraucht wird; übernommen wird erst auf Klick).
export function selectablePoints(points: readonly ExtractedPoint[]): SelectableExtractPoint[] {
  return points.map((p, i) => ({ ...p, id: `fp-${i}`, selected: true }));
}

export function togglePoint(
  points: readonly SelectableExtractPoint[],
  id: string,
): SelectableExtractPoint[] {
  return points.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p));
}

export function selectedCount(points: readonly SelectableExtractPoint[]): number {
  return points.filter((p) => p.selected).length;
}

// Pedi 04.07.: Alle Punkte auf einen Auswahlzustand setzen (Alle auswählen / Alle abwählen).
export function setAllSelected(
  points: readonly SelectableExtractPoint[],
  selected: boolean,
): SelectableExtractPoint[] {
  return points.map((p) => ({ ...p, selected }));
}

// Pedi 04.07.: Ausgewählte Punkte zu EINEM zusammenfassen — der verbundene Punkt erscheint an der
// Stelle des ersten Ausgewählten WIEDER in der Liste (kein Sprung in den nächsten Schritt). Nicht
// ausgewählte Punkte bleiben unverändert. Weniger als 2 ausgewählt ⇒ Liste unverändert.
export function mergeSelectedIntoOne(
  points: readonly SelectableExtractPoint[],
): SelectableExtractPoint[] {
  const chosen = points.filter((p) => p.selected);
  if (chosen.length < 2) {
    return [...points];
  }
  const merged: SelectableExtractPoint = {
    id: `merged:${chosen.map((p) => p.id).join("+")}`,
    title: chosen[0]?.title ?? "",
    summary: chosen.map((p) => p.summary).join(" "),
    sourceExcerpt: chosen.map((p) => p.sourceExcerpt).join("\n\n"),
    selected: true,
  };
  const result: SelectableExtractPoint[] = [];
  let inserted = false;
  for (const p of points) {
    if (p.selected) {
      if (!inserted) {
        result.push(merged);
        inserted = true;
      }
    } else {
      result.push(p);
    }
  }
  return result;
}

// Aus einem Wissenspunkt wird EIN Wissensseiten-Entwurf im bekannten StructureResult-Format:
// Titel = Aussage, Statement = Kurzfassung. Bedingungen/Maßnahmen bleiben leer — sie stehen
// nicht belegt im Punkt, und wir erfinden nichts (G-2). Der Experte ergänzt im Wizard.
export function draftFromPoint(point: ExtractedPoint, demo: boolean): StructureResult {
  return {
    title: point.title,
    statement: point.summary,
    conditions: [],
    measures: [],
    tags: [],
    confidence: 0,
    demo,
  };
}

// Warteschlange aus den AUSGEWÄHLTEN Punkten bauen; leer ⇒ null (nichts zu übernehmen).
export function buildFileQueue(
  points: readonly SelectableExtractPoint[],
  fileName: string,
): FileDraftQueue | null {
  const chosen = points
    .filter((p) => p.selected)
    .map(({ title, summary, sourceExcerpt }) => ({ title, summary, sourceExcerpt }));
  if (chosen.length === 0) {
    return null;
  }
  return { fileName, points: chosen, index: 0 };
}

export function currentQueuePoint(queue: FileDraftQueue | null): ExtractedPoint | null {
  if (!queue) {
    return null;
  }
  return queue.points[queue.index] ?? null;
}

// Nächster Punkt (nach Einreichen ODER Überspringen); fertig ⇒ null (Queue beendet).
export function advanceFileQueue(queue: FileDraftQueue): FileDraftQueue | null {
  const next = queue.index + 1;
  if (next >= queue.points.length) {
    return null;
  }
  return { ...queue, index: next };
}

// Sichtbarer Fortschritt „Punkt X von Y" (1-basiert für Menschen).
export function queueProgress(queue: FileDraftQueue): { current: number; total: number } {
  return { current: queue.index + 1, total: queue.points.length };
}

// Quelle am KO: Label = Dateiname, Excerpt = Belegstelle des Punkts (gedeckelt, damit die
// Quelle ein Beleg-Hinweis bleibt und kein zweiter Dokumentkörper wird).
export const MAX_SOURCE_EXCERPT = 400;

export function fileSourcePayload(
  fileName: string,
  point: ExtractedPoint,
): { label: string; excerpt: string } {
  return {
    label: fileName,
    excerpt: point.sourceExcerpt.slice(0, MAX_SOURCE_EXCERPT),
  };
}

const MAX_WHOLE_DOCUMENT_STATEMENT = 500;

// WP-D4: ehrlicher, formatabhängiger Import-Hinweis — er wird Teil des persistierten Quelle-
// Blockquotes, damit der Entwurf NIE wie eine verlustfreie Übernahme aussieht.
export type WholeDocumentSourceKind = "docx" | "pdf" | "pptx" | "text";

interface WholeSourceLabels {
  source: string;
  whole: string;
  fallback: string;
  noteDocx: string;
  notePdf: string;
  // WP-D5: ehrlicher Verlusthinweis für den PowerPoint-Import (Layout/Animationen/Bilder/Notizen).
  notePptx: string;
}

// WP-D1b (Fix c): NL ergänzt — bisher fiel die persistierte Verlust-Quittung für „nl" auf Deutsch
// zurück (SOURCE_LABELS kannte nur de|en). Die Texte spiegeln die UI-i18n-Keys (importNote.docx/pdf,
// wholeSourceNote), damit Quittung und Oberfläche in jeder Sprache konsistent sind.
const SOURCE_LABELS: Record<"de" | "en" | "nl", WholeSourceLabels> = {
  de: {
    source: "Quelle",
    whole: "gesamtes Dokument",
    fallback: "Unbenanntes Dokument",
    noteDocx: "Struktur und Bilder übernommen (Best-Effort) — exaktes Layout kann abweichen.",
    notePdf: "Best-Effort-Textimport — Layout und Bilder wurden nicht übernommen.",
    notePptx:
      "Best-Effort-Import aus PowerPoint — Text und Struktur je Folie übernommen; Layout, Animationen, Übergänge, Bilder und Sprechernotizen gehen verloren.",
  },
  en: {
    source: "Source",
    whole: "whole document",
    fallback: "Untitled document",
    noteDocx: "Structure and images imported (best effort) — exact layout may differ.",
    notePdf: "Best-effort text import — layout and images were not carried over.",
    notePptx:
      "Best-effort import from PowerPoint — text and structure per slide carried over; layout, animations, transitions, images and speaker notes are lost.",
  },
  nl: {
    source: "Bron",
    whole: "volledig document",
    fallback: "Naamloos document",
    noteDocx:
      "Structuur en afbeeldingen overgenomen (best effort) — de exacte layout kan afwijken.",
    notePdf: "Best-effort tekstimport — layout en afbeeldingen zijn niet overgenomen.",
    notePptx:
      "Best-effort import uit PowerPoint — tekst en structuur per dia overgenomen; layout, animaties, overgangen, afbeeldingen en notities gaan verloren.",
  },
};

function localeKey(locale: string | null | undefined): "de" | "en" | "nl" {
  const lower = locale?.toLowerCase() ?? "";
  if (lower.startsWith("en")) {
    return "en";
  }
  if (lower.startsWith("nl")) {
    return "nl";
  }
  return "de";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactText(text: string, max = 90): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.\\/]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wholeDocumentTitle(input: {
  fileName: string;
  text: string;
  locale?: string | null;
}): string {
  const heading = /^\s{0,3}#{1,3}\s+(.+)$/m.exec(input.text);
  const labels = SOURCE_LABELS[localeKey(input.locale)];
  return (
    compactText(heading?.[1] ?? "") ||
    compactText(titleFromFileName(input.fileName)) ||
    compactText(input.text) ||
    labels.fallback
  );
}

function renderTextBlock(block: string): string {
  const trimmed = block.trim();
  const heading = /^\s{0,3}#{1,3}\s+(.+)$/m.exec(trimmed);
  if (heading?.[1] && trimmed.split(/\n/).length === 1) {
    return `<h2>${escapeHtml(heading[1].trim())}</h2>`;
  }

  const lines = trimmed.split(/\n/).map((line) => line.trim());
  const listItems = lines
    .map((line) => /^[-*]\s+(.+)$/.exec(line)?.[1]?.trim() ?? null)
    .filter((line): line is string => Boolean(line));
  if (listItems.length > 0 && listItems.length === lines.length) {
    return `<ul>${listItems.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  }

  return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
}

export function wholeDocumentBodyHtml(input: {
  fileName: string;
  text: string;
  // WP-D1: strukturerhaltendes HTML (DOCX via mammoth, h1→h2 bereits gemappt). Wenn gesetzt, wird es
  // statt der Markdown-Heuristik übernommen — autoritativ sanitisiert der Server (services/structure).
  html?: string;
  // WP-D4: Formatkennung für den ehrlichen Import-Hinweis im Quelle-Blockquote.
  sourceKind?: WholeDocumentSourceKind;
  locale?: string | null;
}): string {
  const labels = SOURCE_LABELS[localeKey(input.locale)];
  const note =
    input.sourceKind === "docx"
      ? `<p>${escapeHtml(labels.noteDocx)}</p>`
      : input.sourceKind === "pdf"
        ? `<p>${escapeHtml(labels.notePdf)}</p>`
        : input.sourceKind === "pptx"
          ? `<p>${escapeHtml(labels.notePptx)}</p>`
          : "";
  const source = `<blockquote><p>${labels.source}: ${escapeHtml(input.fileName)}, ${labels.whole}</p>${note}</blockquote>`;
  if (input.html && input.html.trim().length > 0) {
    return `${source}${input.html.trim()}`;
  }
  const body = input.text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map(renderTextBlock)
    .join("");
  return `${source}${body}`;
}

// WP-D1d (bens ROT-Fix 2): Client-Grenze für den FINALEN, serialisierten Draft-Payload. Liegt mit
// Puffer UNTER dem Server-Ceiling (DRAFTS_BODY_LIMIT = 5 MiB, capture-routes.ts): 4,5 MiB lässt Rand für
// HTTP-Header/Transport, sodass ein clientseitig grün geprüfter Payload den Server-Cap nie überschreitet.
export const DRAFT_PAYLOAD_LIMIT_BYTES = 4_500_000;

// WP-D1d: dedizierter Fehler, wenn der serialisierte Payload die Client-Grenze übersteigt — der Aufrufer
// bricht ehrlich ab (spezifische Meldung) statt in einen stillen Server-413 zu laufen.
export class DraftPayloadTooLargeError extends Error {
  constructor() {
    super("DRAFT_PAYLOAD_TOO_LARGE");
    this.name = "DraftPayloadTooLargeError";
  }
}

// WP-D1d: ECHTE UTF-8-Bytes des serialisierten Payloads (JSON.stringify). Pure, DOM-frei, unit-testbar —
// misst genau das, was Fastify als Body-Bytes gegen DRAFTS_BODY_LIMIT prüft (kein UTF-16-Trugschluss).
export function draftPayloadByteLength(payload: DraftPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

// WP-D1d: bleibt der serialisierte Payload unter der Client-Grenze? true → sicher sendbar.
export function draftPayloadWithinLimit(
  payload: DraftPayload,
  limitBytes: number = DRAFT_PAYLOAD_LIMIT_BYTES,
): boolean {
  return draftPayloadByteLength(payload) <= limitBytes;
}

// WP-D1e (bens ROT-Fix 2): großzügige Obergrenze für die Länge einer Object-Store-Id im Preflight.
// Reale Ids sind UUIDs (36 Zeichen, s. object-store/service.ts genId → randomUUID); 128 liegt weit
// darüber, sodass der reservierte Link nie kürzer ist als der echte — der Preflight ist damit beweisbar
// ausreichend (ein echter Link passt garantiert, wenn der reservierte passt).
export const OBJECT_LINK_ID_RESERVE_CHARS = 128;

// WP-D1e (bens ROT-Fix 2): Größen-Preflight für den Ganzdokument-Save, der das Original als Body-Link
// mitführt. Der Object-Upload legt die Datei UNWIDERRUFLICH im Store ab — passiert er, BEVOR die
// Gesamtgröße feststeht, entsteht bei Überlauf ein verwaistes Object (kein Entwurf referenziert es) und
// ein Retry lüde erneut hoch. Dieser Preflight misst den finalen Payload MIT einem reservierten Link
// (Object-Id auf OBJECT_LINK_ID_RESERVE_CHARS gesetzt) — der reale, kürzere Link wird garantiert nicht
// größer. false ⇒ der Payload passt auch mit Link nicht: der Aufrufer bricht VOR dem Upload ehrlich ab.
export function wholeDraftFitsWithObjectLink(
  payload: DraftPayload,
  originalName: string,
  limitBytes: number = DRAFT_PAYLOAD_LIMIT_BYTES,
): boolean {
  const reservedLink = fileLinkHtml({
    objectId: "x".repeat(OBJECT_LINK_ID_RESERVE_CHARS),
    name: originalName,
  });
  const withReservedLink: DraftPayload = {
    ...payload,
    bodyHtml: `${payload.bodyHtml ?? ""}${reservedLink}`,
  };
  return draftPayloadWithinLimit(withReservedLink, limitBytes);
}

export function wholeDocumentDraftPayload(input: {
  fileName: string;
  text: string;
  html?: string;
  sourceKind?: WholeDocumentSourceKind;
  locale?: string | null;
}): DraftPayload {
  const title = wholeDocumentTitle(input);
  const bodyHtml = wholeDocumentBodyHtml(input);
  const statement = compactText(input.text, MAX_WHOLE_DOCUMENT_STATEMENT) || title;
  return {
    title,
    statement,
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    conditions: [],
    measures: [],
    bodyHtml,
    origin: "frontdoor",
  };
}

export async function createWholeDocumentDraft<TDraft>(
  input: {
    fileName: string;
    text: string;
    html?: string;
    sourceKind?: WholeDocumentSourceKind;
    locale?: string | null;
  },
  create: (payload: DraftPayload) => Promise<TDraft>,
): Promise<TDraft> {
  return create(wholeDocumentDraftPayload(input));
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster CAPTURE_WIZARD_TEXT).
export const CAPTURE_FILE_TEXT = {
  hint: "capture.file.hint",
  upload: "capture.file.upload",
  replace: "capture.file.replace",
  remove: "capture.file.remove",
  extracting: "capture.file.extracting",
  loaded: "capture.file.loaded",
  empty: "capture.file.empty",
  // WP-D4: PDF-spezifische Leermeldung — ehrlich, ohne falsche OCR-Hoffnung (PDF-OCR existiert nicht).
  emptyPdf: "capture.file.emptyPdf",
  // WP-D5: PPTX-spezifische Leermeldung — reine Bild-/Grafik-Präsentation ohne Text.
  emptyPptx: "capture.file.emptyPptx",
  // WP-D3: ehrlicher Hinweis, wenn der Seiten-Cap (MAX_PDF_PAGES) griff — nur die ersten N Seiten gelesen.
  pdfTruncated: "capture.file.pdfTruncated",
  // WP-D5: ehrlicher Hinweis, wenn der Folien-Cap (MAX_PPTX_SLIDES) griff — nur die ersten N Folien gelesen.
  pptxTruncated: "capture.file.pptxTruncated",
  // WP-D5b: ehrlicher Fehler, wenn die PPTX das Archiv-/Dekompressionsbudget sprengt (statt UI-Freeze).
  pptxTooLarge: "capture.file.pptxTooLarge",
  // WP-D9: ehrliche Teilverlust-Hinweise für Folien-Bilder (Format nicht unterstützt / Bild-Budget).
  pptxImagesFormat: "capture.file.pptxImagesFormat",
  pptxImagesBudget: "capture.file.pptxImagesBudget",
  // WP-BILD-1a (Pedi 20.07.): ehrlicher Startwert der Bild-Fußnote — noch keine (KI-)Beschreibung.
  imageCaptionPlaceholder: "capture.file.imageCaptionPlaceholder",
  // WP-D1d: Bilder komprimiert BEHALTEN, Original im Anhang (Anhang WIRKLICH gelungen).
  imagesKept: "capture.file.imagesKept",
  // WP-D1d: einige komprimiert, einige als Notbremse weggelassen — Original im Anhang gesichert.
  imagesKeptDropped: "capture.file.imagesKeptDropped",
  // WP-D1d: komprimiert, aber Anhang FEHLGESCHLAGEN → KEINE „im Anhang"-Behauptung.
  imagesNoOriginal: "capture.file.imagesNoOriginal",
  // WP-D1d: Bilder weggelassen UND Anhang fehlgeschlagen → weggelassene Bilder sind VERLOREN (Zahl nennen).
  imagesLost: "capture.file.imagesLost",
  // WP-D1d: Payload überschreitet die Client-Grenze → ehrlicher Abbruch statt stillem 413.
  tooLargeForImport: "capture.file.tooLargeForImport",
  // WP-D4: formatabhängige Import-Quittung (DOCX: Struktur+Bilder Best-Effort; PDF: nur Text).
  importNoteDocx: "capture.file.importNote.docx",
  importNotePdf: "capture.file.importNote.pdf",
  // WP-D5/WP-D9: PowerPoint-Import-Quittung (Text/Struktur/Bilder je Folie; Layout/Animationen/Notizen verloren).
  importNotePptx: "capture.file.importNote.pptx",
  parseError: "capture.file.parseError",
  unsupported: "capture.file.unsupported",
  ocrCta: "capture.file.ocrCta",
  ocrBusy: "capture.file.ocrBusy",
  queryLabel: "capture.file.queryLabel",
  queryPlaceholder: "capture.file.queryPlaceholder",
  queryHelpTitle: "capture.file.queryHelp.title",
  queryHelpBody: "capture.file.queryHelp.body",
  // SCRUM-451: Ergebnis-Sprache der Extraktion — Systemsprache oder Originalsprache.
  langLabel: "capture.file.langLabel",
  langSystem: "capture.file.langSystem",
  langSource: "capture.file.langSource",
  langHelpTitle: "capture.file.langHelp.title",
  langHelpBody: "capture.file.langHelp.body",
  importModeLabel: "capture.file.importMode.label",
  importModePoints: "capture.file.importMode.points",
  importModePointsDesc: "capture.file.importMode.pointsDesc",
  importModeWhole: "capture.file.importMode.whole",
  importModeWholeDesc: "capture.file.importMode.wholeDesc",
  searchCta: "capture.file.searchCta",
  searching: "capture.file.searching",
  wholeCta: "capture.file.wholeCta",
  wholeSaving: "capture.file.wholeSaving",
  wholeSaved: "capture.file.wholeSaved",
  wholeSourceNote: "capture.file.wholeSourceNote",
  wholeSavedTitle: "capture.file.wholeSavedTitle",
  wholeSavedSource: "capture.file.wholeSavedSource",
  wholeOpenDraft: "capture.file.wholeOpenDraft",
  wholeOpenMissing: "capture.file.wholeOpenMissing",
  wholeImportAnother: "capture.file.wholeImportAnother",
  formatTitle: "capture.file.formatTitle",
  formatHint: "capture.file.formatHint",
  supportedTitle: "capture.file.supportedTitle",
  supportedFormats: "capture.file.supportedFormats",
  unsupportedFormats: "capture.file.unsupportedFormats",
  cancel: "capture.file.cancel",
  pointsTitle: "capture.file.pointsTitle",
  pointsHint: "capture.file.pointsHint",
  excerptLabel: "capture.file.excerptLabel",
  pointCount: "capture.file.pointCount",
  applyCta: "capture.file.applyCta",
  queueBadge: "capture.file.queueBadge",
  queueHint: "capture.file.queueHint",
  queueSkip: "capture.file.queueSkip",
  queueDone: "capture.file.queueDone",
  sourceNote: "capture.file.sourceNote",
  // SCRUM-409 (PMO-FEA-0008-Delta): Import-Quittung + Mehrpunkt-Entwürfe + Zusammenführen.
  loadedStats: "capture.file.loadedStats",
  saveDraftsCta: "capture.file.saveDraftsCta",
  draftsSaved: "capture.file.draftsSaved",
  draftsPartial: "capture.file.draftsPartial",
  mergeCta: "capture.file.mergeCta",
  mergedNote: "capture.file.mergedNote",
  // SCRUM-433 (Pedi 03.07., VIP): Erkenntnisse aus dem Dokument auffindbar verbinden.
  connectHint: "capture.file.connectHint",
  connectDisabledHint: "capture.file.connectDisabledHint",
  // Pedi 04.07.: Alle wählen/abwählen · „Verbinden" bleibt in der Liste · Entwürfe-Löschen-Nachfrage.
  selectAll: "capture.file.selectAll",
  deselectAll: "capture.file.deselectAll",
  mergedInList: "capture.file.mergedInList",
  applyDisabledHint: "capture.file.applyDisabledHint",
  purgeUnselectedQ: "capture.file.purgeUnselectedQ",
  purgeUnselectedYes: "capture.file.purgeUnselectedYes",
  purgeUnselectedKeep: "capture.file.purgeUnselectedKeep",
} as const;

// WP-D1d (Fix 4): PURE Auswahl der ehrlichen Bild-Meldung aus den EXPLIZITEN Zählern. „Original im
// Anhang" wird NUR bei originalAttached === true behauptet (echter Upload-Erfolg). Ohne gesichertes
// Original sind weggelassene Bilder VERLOREN — dann wird das klar benannt. Kein Bild → null.
export interface ImportImageNoticeInput {
  total: number;
  compressed: number;
  dropped: number;
  originalAttached: boolean;
}

export interface ImportImageNotice {
  key: string; // i18n-Schlüssel (aus CAPTURE_FILE_TEXT)
  // WP-D1e (bens Fix 1): die drei Zahlen sauber getrennt. `kept` = tatsächlich übernommene Bilder
  // (= total − dropped); `compressed` = davon re-encodierte; `dropped` = als Notbremse weggelassene.
  // Alle drei reisen als eigene Platzhalter in die Meldung, damit z. B. total=4/compressed=0/dropped=0
  // NICHT irreführend als „0 Bilder komprimiert" erscheint, sondern ehrlich „4 übernommen, davon 0 …".
  params: { kept: number; compressed: number; dropped: number };
}

export function importImageNotice(input: ImportImageNoticeInput): ImportImageNotice | null {
  if (input.total <= 0) {
    return null;
  }
  // WP-D1e (bens Fix 1): `kept` explizit führen — nicht komprimierte, aber unverändert übernommene
  // Bilder (klein/leicht, in files.ts BEHALTEN) zählen so sichtbar mit, statt zu verschwinden.
  const kept = input.total - input.dropped;
  const params = { kept, compressed: input.compressed, dropped: input.dropped };
  if (input.originalAttached) {
    return {
      key: input.dropped > 0 ? CAPTURE_FILE_TEXT.imagesKeptDropped : CAPTURE_FILE_TEXT.imagesKept,
      params,
    };
  }
  return {
    key: input.dropped > 0 ? CAPTURE_FILE_TEXT.imagesLost : CAPTURE_FILE_TEXT.imagesNoOriginal,
    params,
  };
}
