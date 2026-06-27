// SCRUM-177: DOM-freie Ableitung der „Fenster"-Transparenz für limitierte QM-Indizes.
// Mehrere Stufe-2-Karten beruhen bewusst auf einem geladenen Datenfenster (z. B. 50 jüngste
// ModelRuns, 500 jüngste EvidenceRecords). Dieser Helper sagt ehrlich, ob das Fenster
// möglicherweise abgeschnitten ist. Das ist KEIN Fehler und zählt nicht in kritische QM-Hints.

export type QmWindowStatus = "withinWindow" | "potentiallyLimited";

export interface QmDataWindow {
  status: QmWindowStatus;
  loaded: number;
  limit: number;
  source: string; // stabiler Token für i18n (z. B. "modelRuns", "evidence")
}

export function evaluateDataWindow(input: {
  loaded: number;
  limit: number;
  source: string;
}): QmDataWindow {
  const loaded = Number.isFinite(input.loaded) ? Math.max(0, Math.floor(input.loaded)) : 0;
  const limit = Number.isFinite(input.limit) ? Math.floor(input.limit) : 0;
  // Defensiv: ohne positives Limit gilt kein Fenster als abgeschnitten.
  const status: QmWindowStatus =
    limit > 0 && loaded >= limit ? "potentiallyLimited" : "withinWindow";
  return { status, loaded, limit, source: input.source };
}
