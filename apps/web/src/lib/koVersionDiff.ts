import type { KnowledgeObject, KoVersionSnapshot } from "../api/types";

export type KoVersionDiffField =
  | "title"
  | "statement"
  | "conditions"
  | "measures"
  | "type"
  | "status";

export interface KoVersionDiff {
  fromVersion: number | null;
  toVersion: number;
  changed: KoVersionDiffField[];
}

function norm(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join("\n");
  }
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function changedFields(prev: KnowledgeObject, next: KnowledgeObject): KoVersionDiffField[] {
  const fields: KoVersionDiffField[] = [
    "title",
    "statement",
    "conditions",
    "measures",
    "type",
    "status",
  ];
  return fields.filter((field) => norm(prev[field]) !== norm(next[field]));
}

export function versionDiffs(snapshots: readonly KoVersionSnapshot[]): KoVersionDiff[] {
  const asc = [...snapshots].sort((a, b) => a.version - b.version || a.at.localeCompare(b.at));
  return asc.map((snap, index) => {
    const prev = asc[index - 1];
    return {
      fromVersion: prev?.version ?? null,
      toVersion: snap.version,
      changed: prev ? changedFields(prev.snapshot, snap.snapshot) : [],
    };
  });
}

export function diffForVersion(
  snapshots: readonly KoVersionSnapshot[],
  version: number,
): KoVersionDiff | undefined {
  return versionDiffs(snapshots).find((diff) => diff.toVersion === version);
}
