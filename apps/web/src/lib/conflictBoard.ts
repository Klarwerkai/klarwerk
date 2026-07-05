// Berater-Konzept 04.07. (Stufe 4b): DOM-freie Ableitung der Herkunfts-/Begründungs-Anzeige eines
// Konflikts fürs Board — hält Conflicts.tsx schlank und ist testbar. Zeigt bei automatisch erkannten
// Konflikten Sicherheit (%), Begründung und die zwei wörtlichen Belegzitate; sonst „manuell angelegt".
import type { Conflict } from "../api/types";

export const CONFLICT_BOARD_TEXT = {
  originAuto: "con.origin.auto",
  originManual: "con.origin.manual",
  confidence: "con.autoConfidence",
  why: "con.autoWhy",
  quoteA: "con.autoQuoteA",
  quoteB: "con.autoQuoteB",
  dismiss: "con.dismiss",
} as const;

export interface ConflictOriginInfo {
  isAuto: boolean;
  labelKey: string;
  // Nur bei origin="auto" mit detector-Metadaten gesetzt (sonst weggelassen — kein Fake).
  confidencePercent?: number;
  rationale?: string;
  quoteA?: string;
  quoteB?: string;
}

export function conflictOriginInfo(conflict: Conflict): ConflictOriginInfo {
  const d = conflict.detector;
  if (conflict.origin === "auto" && d) {
    return {
      isAuto: true,
      labelKey: CONFLICT_BOARD_TEXT.originAuto,
      ...(typeof d.confidence === "number"
        ? { confidencePercent: Math.round(Math.min(1, Math.max(0, d.confidence)) * 100) }
        : {}),
      ...(d.rationale ? { rationale: d.rationale } : {}),
      ...(d.quotes ? { quoteA: d.quotes.a, quoteB: d.quotes.b } : {}),
    };
  }
  return { isAuto: false, labelKey: CONFLICT_BOARD_TEXT.originManual };
}

// „Fehlalarm" ist nur bei offenen, automatisch erkannten Konflikten sinnvoll.
export function canDismiss(conflict: Conflict): boolean {
  return conflict.origin === "auto" && conflict.status !== "geloest";
}
