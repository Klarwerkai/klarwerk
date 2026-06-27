import type { EvidenceRecord, KnowledgeObject } from "../api/types";
// SCRUM-176: DOM-freie Index-Ableitung für die Stufe-2-Freshness-Card. Nutzt den bestehenden
// Helper analyzeEvidenceFreshness (SCRUM-174) und filtert die betroffenen KOs (outdated/missing)
// für eine kompakte Liste. current/neutral bleiben nur als Summary-Counts. Reine Lesesicht.
import {
  type EvidenceFreshnessResult,
  type EvidenceFreshnessRow,
  analyzeEvidenceFreshness,
} from "./evidenceFreshness";

export const DEFAULT_FRESHNESS_INDEX_LIMIT = 20;

export interface EvidenceFreshnessIndexResult {
  summary: EvidenceFreshnessResult["summary"];
  affected: EvidenceFreshnessRow[]; // nur outdated/missing, defensiv limitiert
  affectedTotal: number; // Gesamtzahl betroffener KOs (vor dem Limit)
}

export function buildEvidenceFreshnessIndex(
  input: { kos: readonly KnowledgeObject[]; evidence: readonly EvidenceRecord[] },
  limit: number = DEFAULT_FRESHNESS_INDEX_LIMIT,
): EvidenceFreshnessIndexResult {
  const result = analyzeEvidenceFreshness(input);
  // Sortierung kommt deterministisch aus analyzeEvidenceFreshness (outdated < missing < …).
  const affectedAll = result.rows.filter((r) => r.status === "outdated" || r.status === "missing");
  return {
    summary: result.summary,
    affected: affectedAll.slice(0, Math.max(0, Math.floor(limit))),
    affectedTotal: affectedAll.length,
  };
}
