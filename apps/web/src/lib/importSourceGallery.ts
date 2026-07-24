// AUFTRAG-ic7-import-vision: EHRLICHE Quellen-Galerie „wo die Reise hingeht". REINES Datenmodell
// (DOM-frei, deterministisch) fuer die Systeme- und Datei-Galerie der Import-Ansicht.
//
// GRUNDSATZ (Ehrlichkeit vor Optik): jede Quelle traegt einen EHRLICHEN Zustand.
//  - "active"  → real nutzbar; loest ueber onActivate den echten, bereits existierenden Fluss aus.
//  - "soon"    → in Arbeit; darf NIE einen Import starten (nur ein ehrlicher Hinweis).
//  - "planned" → Vision, noch nicht begonnen; ebenfalls kein Import, nur Aufklaerung.
// Die Galerie-Komponente ruft onActivate AUSSCHLIESSLICH fuer "active"; "soon"/"planned" zeigen
// einen ruhigen, nicht-modalen Hinweis. Kein neuer Egress-Pfad, kein Konnektor-Aufruf an geplante
// Systeme — das steckt bewusst NICHT in diesem Modell.

import { type FileKind, detectFileKind } from "./extract";

export type SourceState = "active" | "soon" | "planned";

export interface GallerySource {
  /** Stabile ID — steuert bei "active" den echten Fluss (Argument von onActivate). */
  readonly id: string;
  /** i18n-Schluessel des Anzeigenamens (keine hartcodierten Strings im JSX). */
  readonly labelKey: string;
  readonly state: SourceState;
}

// Reihenfolge der Zustaende: aktiv zuerst, dann bald, dann geplant.
const STATE_RANK: Record<SourceState, number> = { active: 0, soon: 1, planned: 2 };

/**
 * Stabile Sortierung aktiv→bald→geplant. Innerhalb eines Zustands bleibt die Eingabereihenfolge
 * erhalten (stabiler Vergleich ueber den Original-Index).
 */
export function orderByState(sources: readonly GallerySource[]): GallerySource[] {
  return sources
    .map((source, index) => ({ source, index }))
    .sort((a, b) => STATE_RANK[a.source.state] - STATE_RANK[b.source.state] || a.index - b.index)
    .map(({ source }) => source);
}

/** Badge-Text je Zustand — IMMER Text (nicht nur Farbe), fuer Barrierefreiheit. */
export const STATE_BADGE_KEY: Record<SourceState, string> = {
  active: "imp.explore.active",
  soon: "imp.explore.soon",
  planned: "imp.gallery.planned",
};

/** Ehrlicher Klick-Hinweis je nicht-aktivem Zustand (kein Import, nur Aufklaerung). */
export const STATE_HINT_KEY: Record<Exclude<SourceState, "active">, string> = {
  soon: "imp.gallery.hintSoon",
  planned: "imp.gallery.hintPlanned",
};

/** i18n-Schluessel des ehrlichen Hinweises fuer einen Zustand; null fuer "active" (kein Hinweis). */
export function hintKeyFor(state: SourceState): string | null {
  return state === "active" ? null : STATE_HINT_KEY[state];
}

// Geteilte ID des bestehenden JSON-Datei-Dialogs — die aktive JSON-Kachel oeffnet genau diesen
// (den echten, bereits existierenden Upload) statt einen neuen Pfad zu erfinden.
export const JSON_UPLOAD_INPUT_ID = "imp-json-upload-input";

// IDs der aktiven JSON-Kacheln (Systeme + Dateien) — beide zeigen auf denselben echten Upload.
export const JSON_SOURCE_IDS = ["json", "json-file"] as const;

// PAKET 1 — Systeme. aktiv: Confluence · JSON-Import (bestehend). bald: Jira · Word · PDF.
// geplant: SharePoint · MS Teams · Google Drive · DMS · PLM · ServiceNow · SAP · Notion · Slack · E-Mail.
export const SYSTEM_SOURCES: readonly GallerySource[] = orderByState([
  { id: "confluence", labelKey: "imp.gallery.src.confluence", state: "active" },
  { id: "json", labelKey: "imp.gallery.src.jsonImport", state: "active" },
  { id: "jira", labelKey: "imp.gallery.src.jira", state: "soon" },
  { id: "word-sys", labelKey: "imp.gallery.src.wordFile", state: "soon" },
  { id: "pdf-sys", labelKey: "imp.gallery.src.pdfFile", state: "soon" },
  { id: "sharepoint", labelKey: "imp.gallery.src.sharepoint", state: "planned" },
  { id: "teams", labelKey: "imp.gallery.src.teams", state: "planned" },
  { id: "gdrive", labelKey: "imp.gallery.src.gdrive", state: "planned" },
  { id: "dms", labelKey: "imp.gallery.src.dms", state: "planned" },
  { id: "plm", labelKey: "imp.gallery.src.plm", state: "planned" },
  { id: "servicenow", labelKey: "imp.gallery.src.servicenow", state: "planned" },
  { id: "sap", labelKey: "imp.gallery.src.sap", state: "planned" },
  { id: "notion", labelKey: "imp.gallery.src.notion", state: "planned" },
  { id: "slack", labelKey: "imp.gallery.src.slack", state: "planned" },
  { id: "email", labelKey: "imp.gallery.src.email", state: "planned" },
]);

// AUFTRAG-uxpol2 (bens Blocker 2.1/2.2): EINE belastbare, pro Oberfläche ableitbare Dateityp-
// Capability. Je Datei-Kachel ein TYPGERECHTES `accept` (die Union der aktiven ist genau der reale
// Dokument-Import-Dialog) und ein REPRÄSENTATIVES Sample, dessen Fähigkeit die ECHTE Importweiche
// `detectFileKind` (Erfassen: onExtractFile) bestimmt — kein blindes Hartkodieren des Zustands.
// `accept: null` = kein echter Importweg (die Kachel öffnet nie einen Dialog).
interface FileSourceDef {
  readonly id: string;
  readonly labelKey: string;
  readonly accept: string | null;
  // Repräsentative Datei, an der detectFileKind die reale Erfassen-Fähigkeit misst.
  readonly sample: { name: string; type?: string };
}

// Typgerechte accept-Fragmente — je Fragment genau EIN Format-Cluster. Die Union der aktiven Kacheln
// deckt exakt die von detectFileKind unterstützten Formate ab (JSON/Text/DOCX/PDF/PPTX/Bild) — so ist
// kein als „geplant" markiertes Format über einen breiten Dialog erreichbar (JSON-Seam geschlossen).
const ACCEPT_JSON = ".json,application/json";
const ACCEPT_TEXT = ".txt,.md,.markdown,.csv,.log";
const ACCEPT_DOCX = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPT_PDF = ".pdf,application/pdf";
const ACCEPT_PPTX =
  ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const ACCEPT_IMAGE = "image/*";

const FILE_SOURCE_DEFS: readonly FileSourceDef[] = [
  {
    id: "json-file",
    labelKey: "imp.gallery.file.json",
    accept: ACCEPT_JSON,
    sample: { name: "a.json" },
  },
  { id: "csv", labelKey: "imp.gallery.file.csv", accept: ACCEPT_TEXT, sample: { name: "a.csv" } },
  {
    id: "docx",
    labelKey: "imp.gallery.file.docx",
    accept: ACCEPT_DOCX,
    sample: { name: "a.docx" },
  },
  { id: "pdf", labelKey: "imp.gallery.file.pdf", accept: ACCEPT_PDF, sample: { name: "a.pdf" } },
  {
    id: "pptx",
    labelKey: "imp.gallery.file.pptx",
    accept: ACCEPT_PPTX,
    sample: { name: "a.pptx" },
  },
  {
    id: "ocr",
    labelKey: "imp.gallery.file.ocr",
    accept: ACCEPT_IMAGE,
    sample: { name: "a.png", type: "image/png" },
  },
  // Wirklich (noch) fehlend: Excel und Audio/Video — kein Extraktionsweg → kein Dialog, ehrlich geplant.
  { id: "xlsx", labelKey: "imp.gallery.file.xlsx", accept: null, sample: { name: "a.xlsx" } },
  {
    id: "avtranscript",
    labelKey: "imp.gallery.file.avtranscript",
    accept: null,
    sample: { name: "a.mp4", type: "video/mp4" },
  },
];

export type ImportSurface = "capture" | "import";

// IC-7 Import-Review (live): ENGERE, ausdrücklich deklarierte Fähigkeit — nur JSON aktiv, Word/PDF
// bald, der Rest geplant. Unangetastet gegenüber uxpol1 (bens IC-7-Zustände bleiben).
const IMPORT_FILE_STATE: Record<string, SourceState> = {
  "json-file": "active",
  docx: "soon",
  pdf: "soon",
  xlsx: "planned",
  pptx: "planned",
  csv: "planned",
  ocr: "planned",
  avtranscript: "planned",
};

// Erfassen: eine Kachel ist AKTIV, wenn ihr Sample über die ECHTE Weiche detectFileKind (die
// onExtractFile nutzt) auf einen unterstützten FileKind fällt UND ein Importweg (accept) existiert.
function captureSupports(def: FileSourceDef): boolean {
  if (def.accept === null) {
    return false;
  }
  const kind: FileKind = detectFileKind(def.sample);
  return kind !== "unsupported";
}

// Die Datei-Galerie EINER Oberfläche — Zustand pro Oberfläche abgeleitet (Erfassen aus der realen
// Fähigkeit, Import-Review aus der engeren IC-7-Deklaration), Reihenfolge aktiv→bald→geplant.
export function fileSourcesForSurface(surface: ImportSurface): GallerySource[] {
  return orderByState(
    FILE_SOURCE_DEFS.map((def) => ({
      id: def.id,
      labelKey: def.labelKey,
      state:
        surface === "capture"
          ? captureSupports(def)
            ? ("active" as const)
            : ("planned" as const)
          : (IMPORT_FILE_STATE[def.id] ?? "planned"),
    })),
  );
}

// Typgerechtes accept einer Datei-Kachel (null = kein echter Importweg → kein Dialog).
export function acceptForFileSource(id: string): string | null {
  return FILE_SOURCE_DEFS.find((def) => def.id === id)?.accept ?? null;
}

// Öffnet den BESTEHENDEN Datei-Dialog des Erfassen-Imports für eine aktive Kachel — mit einem
// `accept`, das GENAU zum angeklickten Typ passt (JSON-Seam geschlossen: nie ein Dialog, der ein als
// inaktiv markiertes Format zulässt). Kacheln ohne echten Importweg (accept === null) tun nichts.
// Rückgabe: true, wenn ein Dialog geöffnet wurde. Kein neuer Egress — es klickt nur den vorhandenen
// versteckten <input>.
export function openCaptureFileDialog(
  id: string,
  input: { accept: string; click: () => void } | null,
): boolean {
  const accept = acceptForFileSource(id);
  if (!accept || !input) {
    return false;
  }
  input.accept = accept;
  input.click();
  return true;
}

// PAKET 2 — Dateien der IC-7 Import-Review (bestehende, engere Fähigkeit). Unverändert: JSON aktiv;
// Word/PDF bald; Excel/PowerPoint/CSV/OCR/Transkript geplant.
export const FILE_SOURCES: readonly GallerySource[] = fileSourcesForSurface("import");
