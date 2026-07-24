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

// PAKET 2 — Dateien (der „Underdog"-Punkt). aktiv: JSON. bald: Word (.docx) · PDF.
// geplant: Excel (.xlsx) · PowerPoint (.pptx) · Text/CSV · OCR (Scan/Bild) · Audio/Video-Transkript.
export const FILE_SOURCES: readonly GallerySource[] = orderByState([
  { id: "json-file", labelKey: "imp.gallery.file.json", state: "active" },
  { id: "docx", labelKey: "imp.gallery.file.docx", state: "soon" },
  { id: "pdf", labelKey: "imp.gallery.file.pdf", state: "soon" },
  { id: "xlsx", labelKey: "imp.gallery.file.xlsx", state: "planned" },
  { id: "pptx", labelKey: "imp.gallery.file.pptx", state: "planned" },
  { id: "csv", labelKey: "imp.gallery.file.csv", state: "planned" },
  { id: "ocr", labelKey: "imp.gallery.file.ocr", state: "planned" },
  { id: "avtranscript", labelKey: "imp.gallery.file.avtranscript", state: "planned" },
]);
