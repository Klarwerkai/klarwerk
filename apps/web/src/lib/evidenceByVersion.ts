// SCRUM-170 (Knowledge-OS-Foundation): read-only Gruppierung der EvidenceRecords nach
// `koVersion`. Macht nachvollziehbar, welche Quellen/Anhänge zu welcher Wissensversion
// gehören. Reine Lesesicht — keine Datenänderung, kein Backfill, kein neues Modell.
// Matching ausschließlich über EvidenceRecord.koVersion (keine Zeitfenster-Heuristik).
import type { EvidenceRecord } from "../api/types";

export interface EvidenceVersionGroup {
  version: number;
  total: number;
  sourceCount: number;
  attachmentCount: number;
  latestAt?: string;
  items: EvidenceRecord[];
}

export interface EvidenceByVersionResult {
  // Versionen absteigend (wie die Snapshot-/Versions-Card).
  groups: EvidenceVersionGroup[];
  // Nur befüllt, wenn `versions` übergeben wird: bekannte Versionen ohne Evidence (absteigend).
  versionsWithoutEvidence: number[];
}

function sortItems(items: EvidenceRecord[]): EvidenceRecord[] {
  // jüngste Evidence zuerst; id als deterministischer Tiebreaker.
  return [...items].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function groupEvidenceByVersion(
  evidence: readonly EvidenceRecord[],
  versions?: readonly { version: number }[],
): EvidenceByVersionResult {
  const byVersion = new Map<number, EvidenceRecord[]>();
  for (const record of evidence) {
    const bucket = byVersion.get(record.koVersion);
    if (bucket) {
      bucket.push(record);
    } else {
      byVersion.set(record.koVersion, [record]);
    }
  }

  const groups: EvidenceVersionGroup[] = [...byVersion.entries()]
    .map(([version, records]) => {
      const items = sortItems(records);
      return {
        version,
        total: items.length,
        sourceCount: items.filter((r) => r.kind === "source").length,
        attachmentCount: items.filter((r) => r.kind === "attachment").length,
        ...(items[0] ? { latestAt: items[0].createdAt } : {}),
        items,
      };
    })
    .sort((a, b) => b.version - a.version);

  const present = new Set(byVersion.keys());
  const versionsWithoutEvidence = versions
    ? [...new Set(versions.map((v) => v.version))]
        .filter((v) => !present.has(v))
        .sort((a, b) => b - a)
    : [];

  return { groups, versionsWithoutEvidence };
}
