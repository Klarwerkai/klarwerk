// SCRUM-168 (Knowledge-OS-Foundation): read-only Konsistenzanalyse zwischen KO-Quellen,
// -Anhängen und EvidenceRecords. Rein ableitend — KEINE Datenänderung, kein Backfill, kein
// Auto-Fix. DOM-frei, keine Links/HTML. Spiegelt die Backend-Evidence-Logik:
//   - Source-Evidence trägt sourceId (Fallback: url/label).
//   - Attachment-Evidence trägt attachmentId + objectId und entsteht NUR bei objectId.
//   - Legacy-Inline-Anhänge (dataUrl ohne objectId) sind bewusst ohne Evidence → neutraler Hinweis.
import type { EvidenceRecord, KnowledgeObject, KoAttachment, KoSource } from "../api/types";

export type EvidenceConsistencyStatus = "ok" | "warning";

export type EvidenceFindingKind =
  | "source-without-evidence"
  | "attachment-without-evidence"
  | "evidence-without-source"
  | "evidence-without-attachment"
  | "legacy-inline-attachment";

export type EvidenceFindingSeverity = "warning" | "info";

export interface EvidenceFinding {
  kind: EvidenceFindingKind;
  ref: string; // id des betroffenen Source-/Attachment-/Evidence-Eintrags
  label: string; // menschenlesbares Label (reiner Text, kein HTML/Link)
  severity: EvidenceFindingSeverity;
}

export interface EvidenceConsistencyResult {
  status: EvidenceConsistencyStatus;
  sourceCount: number;
  attachmentCount: number;
  evidenceCount: number;
  findings: EvidenceFinding[];
}

function sourceMatchesEvidence(source: KoSource, ev: EvidenceRecord): boolean {
  if (ev.kind !== "source") {
    return false;
  }
  if (ev.sourceId && ev.sourceId === source.id) {
    return true;
  }
  // Fallback für Altdaten ohne sourceId: url (falls beidseitig vorhanden) bzw. Label.
  if (ev.url && source.url && ev.url === source.url) {
    return true;
  }
  return !ev.sourceId && ev.label === source.label;
}

function attachmentMatchesEvidence(att: KoAttachment, ev: EvidenceRecord): boolean {
  if (ev.kind !== "attachment") {
    return false;
  }
  if (ev.attachmentId && ev.attachmentId === att.id) {
    return true;
  }
  return Boolean(ev.objectId && att.objectId && ev.objectId === att.objectId);
}

// Analysiert Quellen/Anhänge gegen die EvidenceRecords eines KO. Reine Lesesicht.
export function analyzeEvidenceConsistency(
  ko: Pick<KnowledgeObject, "sources" | "attachments">,
  evidence: readonly EvidenceRecord[],
): EvidenceConsistencyResult {
  const sources = ko.sources ?? [];
  const attachments = ko.attachments ?? [];
  const findings: EvidenceFinding[] = [];

  // 1) Jede Quelle braucht ein Evidence-Gegenstück.
  for (const source of sources) {
    if (!evidence.some((ev) => sourceMatchesEvidence(source, ev))) {
      findings.push({
        kind: "source-without-evidence",
        ref: source.id,
        label: source.label,
        severity: "warning",
      });
    }
  }

  // 2) Object-Store-Anhänge brauchen Evidence; Legacy-Inline-Anhänge (dataUrl ohne objectId)
  //    sind bewusst ohne Evidence → neutraler Hinweis, KEIN Fehler.
  for (const att of attachments) {
    if (!att.objectId) {
      if (att.dataUrl) {
        findings.push({
          kind: "legacy-inline-attachment",
          ref: att.id,
          label: att.name,
          severity: "info",
        });
      }
      continue;
    }
    if (!evidence.some((ev) => attachmentMatchesEvidence(att, ev))) {
      findings.push({
        kind: "attachment-without-evidence",
        ref: att.id,
        label: att.name,
        severity: "warning",
      });
    }
  }

  // 3) Evidence ohne sichtbares Gegenstück (Quelle bzw. Anhang entfernt o. Ä.).
  for (const ev of evidence) {
    if (ev.kind === "source") {
      if (!sources.some((source) => sourceMatchesEvidence(source, ev))) {
        findings.push({
          kind: "evidence-without-source",
          ref: ev.id,
          label: ev.label,
          severity: "warning",
        });
      }
    } else if (!attachments.some((att) => attachmentMatchesEvidence(att, ev))) {
      findings.push({
        kind: "evidence-without-attachment",
        ref: ev.id,
        label: ev.label,
        severity: "warning",
      });
    }
  }

  const status: EvidenceConsistencyStatus = findings.some((f) => f.severity === "warning")
    ? "warning"
    : "ok";

  return {
    status,
    sourceCount: sources.length,
    attachmentCount: attachments.length,
    evidenceCount: evidence.length,
    findings,
  };
}
