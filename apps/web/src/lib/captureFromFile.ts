// PMO-FEA-0006: DOM-freie Logik für den Erzähl-Modus „Aus Datei" — Dokument hochladen,
// KI-Punkteliste mit Belegstellen, ausgewählte Punkte als Entwurfs-Warteschlange nacheinander
// im bestehenden Wizard prüfen/einreichen. NICHTS wird automatisch gespeichert; die Quelle
// (Dateiname) wird beim Einreichen als Source am Wissensobjekt vermerkt.
import type { ExtractedPoint, StructureResult } from "../api/types";

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

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster CAPTURE_WIZARD_TEXT).
export const CAPTURE_FILE_TEXT = {
  hint: "capture.file.hint",
  upload: "capture.file.upload",
  replace: "capture.file.replace",
  remove: "capture.file.remove",
  extracting: "capture.file.extracting",
  loaded: "capture.file.loaded",
  empty: "capture.file.empty",
  parseError: "capture.file.parseError",
  unsupported: "capture.file.unsupported",
  ocrCta: "capture.file.ocrCta",
  ocrBusy: "capture.file.ocrBusy",
  queryLabel: "capture.file.queryLabel",
  queryPlaceholder: "capture.file.queryPlaceholder",
  queryHelpTitle: "capture.file.queryHelp.title",
  queryHelpBody: "capture.file.queryHelp.body",
  searchCta: "capture.file.searchCta",
  searching: "capture.file.searching",
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
