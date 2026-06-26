import type { KoVersionSnapshot } from "../api/types";

export interface KoVersionSnapshotRow {
  key: string;
  version: number;
  at: string;
  author: string;
  note: string;
  title: string;
  status: string;
  excerpt: string;
}

export function snapshotExcerpt(text: string, max = 140): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function koVersionRows(snapshots: readonly KoVersionSnapshot[]): KoVersionSnapshotRow[] {
  return [...snapshots]
    .sort((a, b) => b.version - a.version || b.at.localeCompare(a.at))
    .map((entry) => ({
      key: `${entry.koId}:${entry.version}`,
      version: entry.version,
      at: entry.at,
      author: entry.author,
      note: entry.note,
      title: entry.snapshot.title || `v${entry.version}`,
      status: entry.snapshot.status,
      excerpt: snapshotExcerpt(entry.snapshot.statement || entry.snapshot.title || ""),
    }));
}
