// PMO-FEA-0006: DOM-freie Logik für den Erzähl-Modus „Aus Datei" — Dokument hochladen,
// KI-Punkteliste mit Belegstellen, ausgewählte Punkte als Entwurfs-Warteschlange nacheinander
// im bestehenden Wizard prüfen/einreichen. NICHTS wird automatisch gespeichert; die Quelle
// (Dateiname) wird beim Einreichen als Source am Wissensobjekt vermerkt.
import type { DraftPayload, ExtractedPoint, StructureResult } from "../api/types";
// WP-D1e (Fix 2): der Preflight misst den Payload MIT einem reservierten Object-Link — dieselbe
// (DOM-freie) Link-Erzeugung wie im Ganzdokument-Save, damit die Reserve exakt zum realen Link passt.
// WP-HYG: die Id-Längen-Reserve kommt ZENTRAL aus bodyFileLink (keine lokale Kopie mehr).
import { reservedObjectLinkHtml } from "./bodyFileLink";
// WP-D9b: verankerte figures im sicheren HTML erkennen (gleiche Quelle wie die BILD-1d-Galerie).
import { extractBodyImages } from "./bodyImages";
// JOB 2699 D1: die zentrale Dateiart-Erkennung — Liste UND Pruefung des Text-Einfuege-Weges
// haengen an ihr, nicht an Endungen.
import { type FileKind, detectFileKind } from "./extract";
// JOB 513/D2: der TYP des Bildtransfer-Vertrags. Dieses Modul trifft KEINE Budgetentscheidung und fuehrt
// KEINE eigene Bytegrenze — die wirksame Grenze reist im Vertrag mit (autoritativ bleiben
// MAX_INLINE_BODY_HTML_BYTES in docx.ts und PPTX_MAX_IMAGE_BYTES/PPTX_MAX_TOTAL_IMAGE_BYTES in pptx.ts).
// JOB 513/D3B: dazu kommt EIN Wert-Import — `imageTransferBalanced`. Das ist keine Budgetentscheidung,
// sondern das reine Bilanzpraedikat des Vertrags; es wird hier als fail-closed-Wache vor jedem
// Erfolgsurteil gebraucht und darf deshalb nicht als Kopie danebenliegen (eine zweite Fassung waere
// eine zweite Wahrheit).
import {
  type ImageBudgetDrop,
  type ImageBudgetLimitKind,
  type ImageTransferContract,
  addImageBudgetDrop,
  imageTransferBalanced,
} from "./docx";

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

// WP-D9b/WP-D9c (bens GELB-Fix 2 + ROT-Fix Kombinationsfall): Importierbarkeits-Entscheidung für den
// Datei-Import. Importierbar, wenn Text ODER eine verankerte figure im sicheren HTML steht — ODER die
// QUELLE Bilder hatte (`sourceHadImages`, z. B. imageCount > 0 aus dem Extraktionsergebnis). Letzteres
// deckt den Kombinationsfall: bildreines Deck, dessen figures ALLE am finalen UTF-8-Deckel gedroppt
// wurden — ohne das Quell-Signal sähe das Gate weder Text noch figure und würde ablehnen, womit
// fileOriginal (und damit der Original-Anhang, D2) verloren ginge. Nur die KI-Punkte-Extraktion bleibt
// ohne Text deaktiviert. Weder Text noch Quell-Bilder → weiterhin ehrliche Ablehnung (emptyPptx/empty).
export function fileImportHasContent(
  text: string,
  richHtml: string | null,
  sourceHadImages = false,
): boolean {
  return text.trim().length > 0 || sourceHadImages || extractBodyImages(richHtml ?? "").length > 0;
}

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

// ================================================================================================
// JOB 2699 D1 (Befund R2-27) — DER DIALOG BOT AN, WAS DER WEG DAHINTER ABLEHNTE.
// ================================================================================================
//
// „Text aus Datei einfuegen" (Capture.tsx, onDocs) trug `accept={FILE_CAPTURE_ACCEPT}` — und die
// enthaelt .pptx. Der Weg selbst kann aber Text/Word/PDF/Bild (und Video/Audio als Anhang), KEIN
// PowerPoint: der Mensch waehlte eine .pptx und las „nicht unterstuetzt". Zwei Listen, die
// auseinanderliefen: die des Dialogs und die der Pruefung.
//
// ENTSCHEIDUNG: STREICHEN, nicht aufnehmen. PPTX ueber `readPptxRich(...).text` hier hineinzuholen,
// waere eine zweite Bauart desselben Imports ohne Bild- und Original-Vertrag; der Hauptweg
// (CaptureFileImport, FILE_IMPORT_ACCEPT) beherrscht PPTX vollstaendig. FILE_CAPTURE_ACCEPT selbst
// bleibt, wie es ist — es versorgt auch „Datei oder Bild beifuegen" (onAttach) und den Studio-Anhang,
// die JEDE Datei als Anhang annehmen; dort ist .pptx richtig. Nur der Text-Einfuege-Weg bekommt
// seine eigene Liste, und die ist aus DERSELBEN Tabelle abgeleitet wie seine Pruefung.
export const TEXT_INSERT_KINDS = ["text", "docx", "pdf", "image"] as const satisfies readonly FileKind[];

/** Eine Marke der Accept-Liste je unterstuetzter Art — EINE Tabelle fuer Liste und Pruefung. */
const TEXT_INSERT_ACCEPT_JE_ART: Readonly<Record<(typeof TEXT_INSERT_KINDS)[number], string>> = {
  text: ".txt,.md,.markdown,.csv,.log,.json",
  docx: ".docx",
  pdf: ".pdf,application/pdf",
  image: "image/*",
};

/** Video/Audio werden an diesem Weg als Anhang mitgefuehrt (Transkription auf Klick) — kein Textleser. */
const TEXT_INSERT_MEDIEN = "video/*,audio/*";

export const FILE_TEXT_INSERT_ACCEPT = [
  ...TEXT_INSERT_KINDS.map((art) => TEXT_INSERT_ACCEPT_JE_ART[art]),
  TEXT_INSERT_MEDIEN,
].join(",");

/**
 * Kann „Text aus Datei einfuegen" diese Datei? Entschieden ueber die zentrale Erkennung
 * (detectFileKind: image→pdf→docx→pptx→text) — eine .pptx mit MIME text/plain ist damit PPTX,
 * nicht Text. Video/Audio zaehlen als Anhang-Arten dieses Weges.
 */
export function isTextInsertSupported(input: { name: string; type: string }): boolean {
  if ((TEXT_INSERT_KINDS as readonly FileKind[]).includes(detectFileKind(input))) {
    return true;
  }
  return input.type.startsWith("video/") || input.type.startsWith("audio/");
}

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

// AUFTRAG-mega16 Block A (bens SB-4): `objectId` ist der ANKER dieser Belegstelle — die Referenz
// auf das Originaldokument, das am selben KO als Anhang liegt. Eine Datei-Belegstelle hat keine
// Adresse; ohne Anker ist sie serverseitig nicht von einem externen Treffer zu unterscheiden, dem
// jemand die Adresse weggenommen hat, und wird auf restriktiver Stufe abgelehnt. Der Parameter ist
// optional, weil nicht jeder Weg das Original am ZIEL-KO liegen hat (AppendToArticleModal hängt an
// ein FREMDES KO an) — dort ist die Ablehnung dann die ehrliche Folge, keine Panne.
export function fileSourcePayload(
  fileName: string,
  point: ExtractedPoint,
  objectId?: string,
): { label: string; excerpt: string; objectId?: string } {
  return {
    label: fileName,
    excerpt: point.sourceExcerpt.slice(0, MAX_SOURCE_EXCERPT),
    ...(objectId ? { objectId } : {}),
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

// WP-D1e (bens ROT-Fix 2): Größen-Preflight für den Ganzdokument-Save, der das Original als Body-Link
// mitführt. Der Object-Upload legt die Datei UNWIDERRUFLICH im Store ab — passiert er, BEVOR die
// Gesamtgröße feststeht, entsteht bei Überlauf ein verwaistes Object (kein Entwurf referenziert es) und
// ein Retry lüde erneut hoch. Dieser Preflight misst den finalen Payload MIT einem reservierten Link —
// der reale, kürzere Link wird garantiert nicht größer. false ⇒ der Payload passt auch mit Link nicht:
// der Aufrufer bricht VOR dem Upload ehrlich ab.
// WP-HYG (bens P2 aus D1e): die Id-Längen-Reserve lebt ZENTRAL in bodyFileLink
// (OBJECT_LINK_ID_RESERVE_CHARS / reservedObjectLinkHtml) — hier keine lokale Kopie mehr.
export function wholeDraftFitsWithObjectLink(
  payload: DraftPayload,
  originalName: string,
  limitBytes: number = DRAFT_PAYLOAD_LIMIT_BYTES,
): boolean {
  const withReservedLink: DraftPayload = {
    ...payload,
    bodyHtml: `${payload.bodyHtml ?? ""}${reservedObjectLinkHtml(originalName)}`,
  };
  return draftPayloadWithinLimit(withReservedLink, limitBytes);
}

export function wholeDocumentDraftPayload(input: {
  fileName: string;
  text: string;
  html?: string;
  sourceKind?: WholeDocumentSourceKind;
  locale?: string | null;
  // JOB 512 (R5): die beim Import erhobene Quellbildzahl — VOR jedem Budget-/Formatabzug. Sie muss
  // in die Ladung, weil der Ganzdokument-Weg den Dateizustand direkt nach dem Speichern räumt und
  // die Entwurfsgalerie erst am GELADENEN Entwurf rendert (Capture.tsx:1041-1049, :4322).
  sourceImageCount?: number;
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
    // Nur setzen, wenn der Importweg die Zahl WIRKLICH kennt: ein Feld mit `undefined` ist etwas
    // anderes als eine behauptete `0`, und `0` hiesse „die Quelle hatte keine Bilder".
    ...(input.sourceImageCount !== undefined ? { sourceImageCount: input.sourceImageCount } : {}),
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
  // AUFTRAG-mega1 Block A: Drag&Drop-Zone (zusätzlich zum Dialog). dropReject nennt die abgelehnte
  // Datei ehrlich beim Namen; verarbeitet wird nur, was detectFileKind unterstützt.
  dropHint: "capture.file.dropHint",
  dropActive: "capture.file.dropActive",
  dropReject: "capture.file.dropReject",
  // AUFTRAG-mega34 D1: der sichtbare, benannte Knopf, der den BESTEHENDEN versteckten Eingang
  // öffnet. Kein neuer Importweg — nur der fehlende Wegweiser dorthin.
  pick: "capture.file.pick",
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
  // WP-D9b (Gelb-Fix 2): bildreiner Import — Bilder übernommen, kein Text für KI-Vorschläge.
  imagesOnlyNoText: "capture.file.imagesOnlyNoText",
  // WP-D9c (ROT-Fix): ALLE Bilder gedroppt (Budget/Format) — ehrlich KEIN „übernommen", Original-Hinweis.
  // ACHTUNG: der DE/EN/NL-Text dieses Schluessels SAGT ZU, dass das Original als Anhang mitgeht. Er darf
  // deshalb nur bei originalAttached === true gewaehlt werden (JOB 513/D3B, BEN2-D2 Mangel 3).
  imagesAllDropped: "capture.file.imagesAllDropped",
  // JOB 513/D3B: derselbe Fall OHNE gesichertes Original. Bis D2 wurde hier `imagesAllDropped` gewaehlt
  // und damit ein Anhang behauptet, den es nicht gibt — die teuerste Sorte Unwahrheit in diesem Produkt.
  imagesAllDroppedNoOriginal: "capture.file.imagesAllDroppedNoOriginal",
  // JOB 513/D3B: defekte/unaufloesbare Bildverweise bekommen einen ECHTEN lokalisierbaren Grund
  // (BEN2-D2 Mangel 4). Bis D2 gab es dafuer nur `hasUnlocalizedCause: true` und eine leere Meldung.
  imagesDefect: "capture.file.imagesDefect",
  // JOB 513/D3B: Bildverweise ausserhalb des ausgewerteten Folienbereichs (z. B. Hintergrundbilder).
  imagesOutsidePath: "capture.file.imagesOutsidePath",
  // JOB 513/D3B: je Grenzart ein eigener Satz mit dem REALEN Grenzwert — damit die Oberflaeche nicht
  // laenger fuer alle drei Kanten dieselbe (und in zwei Faellen falsche) Begruendung zeigt.
  imagesBudgetBodyHtml: "capture.file.imagesBudgetBodyHtml",
  imagesBudgetSingleImage: "capture.file.imagesBudgetSingleImage",
  imagesBudgetTotalImages: "capture.file.imagesBudgetTotalImages",
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

// WP-D11b (bens GELB c): PURE Meldungswahl des bildreinen Imports über die GEMEINSAME Bild-Bilanz —
// eingebettete Bilder UND konvertierte Folien (der Aufrufer merged Letztere via mergeSlideImageInfo).
// „Alle Bilder verworfen" erscheint NUR, wenn wirklich nichts im Beitrag gelandet ist; behaltene
// Folien zählen als Bilder. Mit Text → keine Meldung (null).
export function imagesOnlyNoticeKey(
  text: string,
  imageInfo: { total: number; dropped: number } | null,
): string | null {
  if (text.trim().length > 0) {
    return null;
  }
  const keptImages = imageInfo ? imageInfo.total - imageInfo.dropped : 0;
  return keptImages > 0 ? CAPTURE_FILE_TEXT.imagesOnlyNoText : CAPTURE_FILE_TEXT.imagesAllDropped;
}

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

// ---------------------------------------------------------------------------
// JOB 513/D2: der stabile, maschinenlesbare UND lokalisierbare Grund des Bildtransfers.
// ---------------------------------------------------------------------------
// Grundsatz: Dieses Modul entscheidet NICHTS ueber Budgets. Es liest den Vertrag, den die autoritativen
// Budgetquellen (docx.ts/pptx.ts) geliefert haben, und uebersetzt ihn in (a) EINEN stabilen Maschinen-
// grund und (b) die dazu wahrheitsgemaessen, BESTEHENDEN i18n-Meldungen. Es erfindet weder eine
// "erlaubte Bildzahl" noch eine zweite Bytegrenze.

// Stabiler Maschinengrund. `not-attempted` = die Quelle trug Bilder, es wurde aber gar kein Transfer
// versucht (PPTX-Altpfad ohne Bildeinbettung) — ausdruecklich KEIN Verlustgrund.
export type ImageTransferOutcome =
  | "no-images"
  | "not-attempted"
  // JOB 513/D3B: die Bilanz geht NICHT auf — uebernommen plus alle Verlustgruende ergeben nicht die
  // erkannte Gesamtzahl. Das ist der fail-closed-Ausgang: er sagt ehrlich, dass etwas unerklaert bleibt,
  // und er kann NIE `complete` werden.
  | "unbalanced"
  | "all-transferred"
  | "partial-budget"
  | "partial-format"
  | "partial-defect"
  | "partial-outside-path"
  | "partial-mixed"
  | "none-transferred";

export function imageTransferOutcome(contract: ImageTransferContract): ImageTransferOutcome {
  // JOB 513/D3B — DIE FAIL-CLOSED-WACHE STEHT VORNE, und das ist der ganze Punkt (Ownerauflage:
  // „imageTransferBalanced(contract) === false ist hartes ROT und darf nie zu all-transferred/
  // complete=true fuehren"). In D2 wurde die Bilanz hier ueberhaupt nicht geprueft: waren die drei
  // Dropzaehler null, kam `all-transferred` — auch bei embeddedImages < totalImages. Genau so konnte
  // eine sichtbare Uebertragungsluecke als uneingeschraenkter Erfolg erscheinen.
  if (!imageTransferBalanced(contract)) {
    return "unbalanced";
  }
  if (contract.totalImages <= 0) {
    return "no-images";
  }
  if (!contract.attempted) {
    return "not-attempted";
  }
  const causes = [
    contract.droppedImageBudget,
    contract.droppedImageFormat,
    contract.droppedImageUnresolved,
    contract.droppedImageOutsidePath,
  ];
  const dropped = causes.reduce((sum, n) => sum + n, 0);
  if (dropped === 0) {
    return "all-transferred";
  }
  if (contract.embeddedImages <= 0) {
    return "none-transferred";
  }
  if (causes.filter((n) => n > 0).length > 1) {
    return "partial-mixed";
  }
  if (contract.droppedImageBudget > 0) {
    return "partial-budget";
  }
  if (contract.droppedImageFormat > 0) {
    return "partial-format";
  }
  if (contract.droppedImageUnresolved > 0) {
    return "partial-defect";
  }
  return "partial-outside-path";
}

// Eine lokalisierbare Meldung: bestehender i18n-Schluessel plus die realen Zahlen als Platzhalter.
export interface ImageTransferNotice {
  key: string;
  params: Record<string, number>;
}

// JOB 513/D3B: je Grenzart der passende, wahrheitsgemaesse Satz. Eine gemeinsame Meldung fuer alle drei
// Kanten waere in zwei von drei Faellen falsch — genau der Mangel, den BEN2 in D2 beanstandet hat.
const BUDGET_LIMIT_KEY: Record<ImageBudgetLimitKind, string> = {
  "body-html": CAPTURE_FILE_TEXT.imagesBudgetBodyHtml,
  "pptx-single-image": CAPTURE_FILE_TEXT.imagesBudgetSingleImage,
  "pptx-total-images": CAPTURE_FILE_TEXT.imagesBudgetTotalImages,
};

// JOB 513/D3B: die serverseitig konvertierten FOLIENBILDER fliessen in DENSELBEN Vertrag wie die
// eingebetteten Bilder — sonst gaebe es zwei Bilanzen nebeneinander und keine waere die Wahrheit.
// Verlorene Folienbilder sind Drop-to-fit am finalen Beitragsbudget, also `body-html`; eine andere
// Grenzart kennt dieser Weg nicht. `null` bleibt `null` (es gab keinen Bildtransfer).
export function mergeSlideImageTransfer(
  contract: ImageTransferContract | null,
  slidesTotal: number,
  keptSlides: number,
  bodyBytes: number,
): ImageTransferContract | null {
  if (!contract || slidesTotal <= 0) {
    return contract;
  }
  const droppedSlides = Math.max(0, slidesTotal - keptSlides);
  const budgetDrops =
    droppedSlides > 0 && contract.bodyBudgetBytes !== null
      ? addImageBudgetDrop(contract.budgetDrops, "body-html", contract.bodyBudgetBytes, bodyBytes)
      : contract.budgetDrops.map((d) => ({ ...d }));
  return {
    ...contract,
    attempted: true,
    totalImages: contract.totalImages + slidesTotal,
    embeddedImages: contract.embeddedImages + keptSlides,
    droppedImageBudget: contract.droppedImageBudget + droppedSlides,
    budgetDrops,
    bodyBytes,
  };
}

// JOB 513/D3B: NUR die Ursachen — was ist warum nicht angekommen. Diese Saetze sind unabhaengig davon
// wahr, ob das Original spaeter als Anhang gesichert werden konnte, und sie duerfen deshalb schon beim
// LESEN der Datei gezeigt werden. Alles, was eine Aussage ueber den Anhang trifft, gehoert dagegen in
// `imageTransferSummary` und damit an den Speicherzeitpunkt (dort ist `originalAttached` erst bekannt).
export function imageTransferCauseNotices(contract: ImageTransferContract): ImageTransferNotice[] {
  const notices: ImageTransferNotice[] = [];
  if (!contract.attempted || contract.totalImages <= 0) {
    return notices;
  }
  if (contract.droppedImageBudget > 0) {
    notices.push({
      key: CAPTURE_FILE_TEXT.pptxImagesBudget,
      params: { count: contract.droppedImageBudget },
    });
  }
  // Je GRENZART der Satz mit dem REALEN Grenzwert. Erst damit ist rekonstruierbar, WELCHE Grenze
  // gegriffen hat und WIE weit der Bedarf darueber lag.
  for (const drop of contract.budgetDrops) {
    notices.push({
      key: BUDGET_LIMIT_KEY[drop.kind],
      params: {
        count: drop.count,
        limitBytes: drop.limitBytes,
        actualBytes: drop.actualBytes,
      },
    });
  }
  if (contract.droppedImageFormat > 0) {
    notices.push({
      key: CAPTURE_FILE_TEXT.pptxImagesFormat,
      params: { count: contract.droppedImageFormat },
    });
  }
  if (contract.droppedImageUnresolved > 0) {
    notices.push({
      key: CAPTURE_FILE_TEXT.imagesDefect,
      params: { count: contract.droppedImageUnresolved },
    });
  }
  if (contract.droppedImageOutsidePath > 0) {
    notices.push({
      key: CAPTURE_FILE_TEXT.imagesOutsidePath,
      params: { count: contract.droppedImageOutsidePath },
    });
  }
  return notices;
}

export interface ImageTransferSummary {
  outcome: ImageTransferOutcome;
  // Alle wahrheitsgemaessen Meldungen zu diesem Ergebnis, Ursache fuer Ursache getrennt.
  notices: ImageTransferNotice[];
  // true NUR, wenn wirklich jedes erkannte Bild angekommen ist. JOB 513/D3B: haengt allein am Ausgang —
  // und der ist bei unausgeglichener Bilanz `unbalanced`, also niemals `all-transferred`.
  complete: boolean;
  // JOB 513/D3B: geht die Bilanz auf? false = es bleibt etwas unerklaert; der Aufrufer darf dann unter
  // keinen Umstaenden Erfolg melden.
  balanced: boolean;
  // true, sobald das Bytebudget mindestens ein Bild gekostet hat.
  budgetLimited: boolean;
  // JOB 513/D3B: die tatsaechlich ausloesenden Grenzarten mit realem Grenzwert und ausloesendem Bedarf.
  budgetDrops: ImageBudgetDrop[];
  // true, wenn eine reale Ursache vorliegt, fuer die es KEINEN wahrheitsgemaessen Satz gibt.
  // JOB 513/D3B: das ist ab jetzt GENAU der unausgeglichene Rest. Defekte und unaufgeloeste Verweise
  // haben seit dieser Scheibe eigene DE/EN/NL-Schluessel und zaehlen deshalb nicht mehr dazu.
  hasUnlocalizedCause: boolean;
  // Die wirksame Bytegrenze aus der autoritativen Quelle; null = es wirkte keine.
  bodyBudgetBytes: number | null;
}

// PFLICHT (Auftrag 5.4): ein budgetbedingter Drop erscheint NIE als uneingeschraenkter Erfolg —
// `complete` ist dann false, `budgetLimited` true, und die Erfolgsmeldung `imagesKept` wird nicht
// gewaehlt, sondern die Fassung, die die weggelassenen Bilder ausdruecklich beziffert.
export function imageTransferSummary(
  contract: ImageTransferContract,
  opts: { originalAttached: boolean },
): ImageTransferSummary {
  const outcome = imageTransferOutcome(contract);
  const balanced = imageTransferBalanced(contract);
  const notices: ImageTransferNotice[] = [];
  const dropped =
    contract.droppedImageBudget +
    contract.droppedImageFormat +
    contract.droppedImageUnresolved +
    contract.droppedImageOutsidePath;

  if (outcome !== "no-images" && outcome !== "not-attempted") {
    // ------------------------------------------------------------------------------------------
    // KOPFMELDUNG — sie beantwortet zwei Fragen: was ist im Beitrag gelandet, und ist das ORIGINAL
    // gesichert? JOB 513/D3B (BEN2-D2 Mangel 3 / Ownerauflage): `opts.originalAttached` entscheidet in
    // JEDEM Zweig mit. Bis D2 wurde im All-dropped-Fall immer `imagesAllDropped` gewaehlt — ein Text,
    // der ausdruecklich zusagt, das Original werde als Anhang mitgefuehrt. Bei originalAttached === false
    // war das schlicht falsch.
    // ------------------------------------------------------------------------------------------
    if (contract.embeddedImages <= 0) {
      if (dropped > 0) {
        notices.push({
          key: opts.originalAttached
            ? CAPTURE_FILE_TEXT.imagesAllDropped
            : CAPTURE_FILE_TEXT.imagesAllDroppedNoOriginal,
          params: { dropped },
        });
      }
    } else if (contract.droppedImageBudget > 0) {
      // "… {{dropped}} wegen Groesse weggelassen" — hier zaehlt genau der BUDGET-Anteil; Format-,
      // Defekt- und Ausserhalb-Anteile bekommen ihre eigene Meldung.
      notices.push({
        key: opts.originalAttached
          ? CAPTURE_FILE_TEXT.imagesKeptDropped
          : CAPTURE_FILE_TEXT.imagesLost,
        params: {
          kept: contract.embeddedImages,
          compressed: contract.compressedImages,
          dropped: contract.droppedImageBudget,
        },
      });
    } else if (dropped === 0) {
      notices.push({
        key: opts.originalAttached
          ? CAPTURE_FILE_TEXT.imagesKept
          : CAPTURE_FILE_TEXT.imagesNoOriginal,
        params: {
          kept: contract.embeddedImages,
          compressed: contract.compressedImages,
          dropped: 0,
        },
      });
    } else if (!opts.originalAttached) {
      // JOB 513/D3B (BEN2-D2, Korrekturpflicht 5, zweiter Teil): Teilverlust OHNE Budgetanteil — also
      // Format, Defekt oder ausserhalb des Bildpfads — UND ohne gesichertes Original. Bis D2 blieb der
      // fehlende Anhang hier voellig unerwaehnt. Kein Erfolgssatz: nur die ehrliche Tatsache.
      notices.push({
        key: CAPTURE_FILE_TEXT.imagesNoOriginal,
        params: {
          kept: contract.embeddedImages,
          compressed: contract.compressedImages,
          dropped: 0,
        },
      });
    }

    notices.push(...imageTransferCauseNotices(contract));
  }

  return {
    outcome,
    notices,
    // `all-transferred` setzt eine aufgehende Bilanz voraus (s. imageTransferOutcome) — `complete` kann
    // damit strukturell nicht mehr true werden, solange etwas unerklaert ist.
    complete: outcome === "all-transferred",
    balanced,
    budgetLimited: contract.droppedImageBudget > 0,
    budgetDrops: contract.budgetDrops.map((d) => ({ ...d })),
    // JOB 513/D3B: nur noch der unausgeglichene Rest ist unlokalisiert. Defekt und Ausserhalb-Pfad
    // haben jetzt echte DE/EN/NL-Saetze (BEN2-D2 Mangel 4 geschlossen).
    hasUnlocalizedCause: !balanced,
    bodyBudgetBytes: contract.bodyBudgetBytes,
  };
}
