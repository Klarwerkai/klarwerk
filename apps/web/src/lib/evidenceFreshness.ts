// SCRUM-174 (Knowledge-OS-Foundation): read-only Evidence-Freshness je KO. Macht sichtbar, ob
// die AKTUELLE KO-Version Evidence besitzt, ob nur ältere Versionen Evidence haben, oder ob
// Quellen/Object-Anhänge ganz ohne Evidence sind. Matching strikt über `EvidenceRecord.koVersion`
// gegen `KnowledgeObject.version`. KEINE Datenänderung, kein Backfill, kein Auto-Fix.
import type { EvidenceRecord, KnowledgeObject } from "../api/types";

export type EvidenceFreshnessStatus = "current" | "outdated" | "missing" | "neutral";

export interface EvidenceFreshnessRow {
  koId: string;
  title: string;
  version: number;
  currentCount: number; // Evidence mit koVersion === ko.version
  olderCount: number; // Evidence mit koVersion < ko.version
  sourceCount: number;
  objectAttachmentCount: number; // nur Anhänge mit objectId (Legacy-dataUrl zählt nicht)
  expectsEvidence: boolean;
  status: EvidenceFreshnessStatus;
}

export interface EvidenceFreshnessSummary {
  total: number;
  current: number;
  outdated: number;
  missing: number;
  neutral: number;
}

export interface EvidenceFreshnessResult {
  rows: EvidenceFreshnessRow[];
  summary: EvidenceFreshnessSummary;
}

const STATUS_RANK: Record<EvidenceFreshnessStatus, number> = {
  outdated: 0,
  missing: 1,
  current: 2,
  neutral: 3,
};

export function analyzeEvidenceFreshness(input: {
  kos: readonly KnowledgeObject[];
  evidence: readonly EvidenceRecord[];
}): EvidenceFreshnessResult {
  const byKo = new Map<string, EvidenceRecord[]>();
  for (const ev of input.evidence) {
    const bucket = byKo.get(ev.koId);
    if (bucket) {
      bucket.push(ev);
    } else {
      byKo.set(ev.koId, [ev]);
    }
  }

  const rows: EvidenceFreshnessRow[] = input.kos.map((ko) => {
    const records = byKo.get(ko.id) ?? [];
    const currentCount = records.filter((r) => r.koVersion === ko.version).length;
    const olderCount = records.filter((r) => r.koVersion < ko.version).length;
    const sourceCount = ko.sources?.length ?? 0;
    // Legacy-dataUrl-Anhänge ohne objectId sind neutral → kein Evidence-Anlass.
    const objectAttachmentCount = (ko.attachments ?? []).filter((a) => a.objectId).length;
    const expectsEvidence = sourceCount > 0 || objectAttachmentCount > 0;

    let status: EvidenceFreshnessStatus;
    if (currentCount > 0) {
      status = "current";
    } else if (olderCount > 0) {
      status = "outdated";
    } else if (expectsEvidence) {
      status = "missing";
    } else {
      status = "neutral";
    }

    return {
      koId: ko.id,
      title: ko.title,
      version: ko.version,
      currentCount,
      olderCount,
      sourceCount,
      objectAttachmentCount,
      expectsEvidence,
      status,
    };
  });

  // Deterministisch: auffällige Status zuerst, dann höchste Version, dann Titel, dann koId.
  rows.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.version - a.version ||
      a.title.localeCompare(b.title) ||
      a.koId.localeCompare(b.koId),
  );

  const summary: EvidenceFreshnessSummary = {
    total: rows.length,
    current: rows.filter((r) => r.status === "current").length,
    outdated: rows.filter((r) => r.status === "outdated").length,
    missing: rows.filter((r) => r.status === "missing").length,
    neutral: rows.filter((r) => r.status === "neutral").length,
  };

  return { rows, summary };
}
