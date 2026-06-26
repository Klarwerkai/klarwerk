// SCRUM-171 (Knowledge-OS-Foundation): KO-übergreifender, read-only Provenance-/Lineage-Index
// für Stufe 2/QM. Aggregiert AUSSCHLIESSLICH vorhandene Signale (author/originalAuthor,
// version/history, sources/attachments, EvidenceRecords) — KEIN neues Lineage-Modell, kein
// gerichteter Graph, kein Backend-Endpoint, keine Datenänderung. Fehlende Signale werden
// ehrlich markiert.
import type { EvidenceRecord, KnowledgeObject } from "../api/types";

export type ProvenanceWarningKind = "no-evidence" | "transferred-author" | "multi-version";

export interface ProvenanceIndexRow {
  koId: string;
  title: string;
  author: string;
  originalAuthor: string;
  transferred: boolean;
  version: number;
  historyCount: number;
  sourceCount: number;
  attachmentCount: number;
  evidenceCount: number;
  multiVersion: boolean;
  warningKinds: ProvenanceWarningKind[];
}

export interface ProvenanceIndexSummary {
  totalKOs: number;
  withTransfer: number;
  withSources: number;
  withAttachments: number;
  withEvidence: number;
  withoutEvidence: number; // hat Quellen/Anhänge, aber keine Evidence (nur wenn Evidence bekannt)
  multiVersion: number;
  warningCount: number; // KOs mit mindestens einem Warning
}

export interface ProvenanceIndexResult {
  summary: ProvenanceIndexSummary;
  rows: ProvenanceIndexRow[];
}

export interface ProvenanceIndexInput {
  kos: readonly KnowledgeObject[];
  // Optional: KO-übergreifende EvidenceRecords (z. B. aus dem Evidence-Index). Wird er NICHT
  // übergeben, bleibt der Evidence-Stand „unbekannt" und no-evidence wird nicht behauptet.
  evidence?: readonly EvidenceRecord[];
}

export function buildProvenanceIndex(input: ProvenanceIndexInput): ProvenanceIndexResult {
  const evidenceKnown = input.evidence !== undefined;
  const evidenceByKo = new Map<string, number>();
  for (const ev of input.evidence ?? []) {
    evidenceByKo.set(ev.koId, (evidenceByKo.get(ev.koId) ?? 0) + 1);
  }

  const rows: ProvenanceIndexRow[] = input.kos.map((ko) => {
    const transferred = ko.author !== ko.originalAuthor;
    const historyCount = ko.history.length;
    const sourceCount = ko.sources?.length ?? 0;
    const attachmentCount = ko.attachments?.length ?? 0;
    const evidenceCount = evidenceByKo.get(ko.id) ?? 0;
    const multiVersion = ko.version > 1 || historyCount > 1;

    const warningKinds: ProvenanceWarningKind[] = [];
    // no-evidence nur behaupten, wenn der Evidence-Stand bekannt ist UND das KO
    // provenance-relevante Signale (Quellen/Anhänge) trägt, aber keine Evidence existiert.
    if (evidenceKnown && evidenceCount === 0 && (sourceCount > 0 || attachmentCount > 0)) {
      warningKinds.push("no-evidence");
    }
    if (transferred) {
      warningKinds.push("transferred-author");
    }
    if (multiVersion) {
      warningKinds.push("multi-version");
    }

    return {
      koId: ko.id,
      title: ko.title,
      author: ko.author,
      originalAuthor: ko.originalAuthor,
      transferred,
      version: ko.version,
      historyCount,
      sourceCount,
      attachmentCount,
      evidenceCount,
      multiVersion,
      warningKinds,
    };
  });

  // Deterministisch: meiste Warnungen zuerst, dann höchste Version, dann Titel, dann koId.
  rows.sort(
    (a, b) =>
      b.warningKinds.length - a.warningKinds.length ||
      b.version - a.version ||
      a.title.localeCompare(b.title) ||
      a.koId.localeCompare(b.koId),
  );

  const summary: ProvenanceIndexSummary = {
    totalKOs: rows.length,
    withTransfer: rows.filter((r) => r.transferred).length,
    withSources: rows.filter((r) => r.sourceCount > 0).length,
    withAttachments: rows.filter((r) => r.attachmentCount > 0).length,
    withEvidence: rows.filter((r) => r.evidenceCount > 0).length,
    withoutEvidence: rows.filter((r) => r.warningKinds.includes("no-evidence")).length,
    multiVersion: rows.filter((r) => r.multiVersion).length,
    warningCount: rows.filter((r) => r.warningKinds.length > 0).length,
  };

  return { summary, rows };
}
