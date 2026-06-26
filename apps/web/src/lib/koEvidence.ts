import type { EvidenceRecord } from "../api/types";

export interface EvidenceRow {
  key: string;
  kind: EvidenceRecord["kind"];
  title: string;
  meta: string[];
  createdAt: string;
  createdBy: string;
}

export function evidenceKindLabel(kind: EvidenceRecord["kind"]): "source" | "attachment" {
  return kind;
}

export function evidenceRows(records: readonly EvidenceRecord[]): EvidenceRow[] {
  return [...records]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .map((record) => {
      const meta = [
        `v${record.koVersion}`,
        record.provider ?? undefined,
        record.mime ?? undefined,
        record.objectId ? `object:${record.objectId}` : undefined,
        record.url ?? undefined,
      ].filter((value): value is string => Boolean(value));
      return {
        key: record.id,
        kind: record.kind,
        title: record.label,
        meta,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
      };
    });
}
