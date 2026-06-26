// SCRUM-169 (Knowledge-OS-Foundation): DOM-freie Auswertung des KO-übergreifenden
// Evidence-Index (nur Metadaten — keine Object-Rohdaten, keine externen Inhalte).
// Rein abgeleitete Zähler/Tones für die kompakte read-only QM-/Stufe-2-Sicht.
import type { EvidenceRecord } from "../api/types";

export interface EvidenceIndexSummary {
  total: number;
  sources: number;
  attachments: number;
  withProvider: number;
  withUrl: number;
  withObject: number;
  distinctKos: number;
}

export function summarizeEvidence(records: readonly EvidenceRecord[]): EvidenceIndexSummary {
  const kos = new Set<string>();
  let sources = 0;
  let attachments = 0;
  let withProvider = 0;
  let withUrl = 0;
  let withObject = 0;
  for (const r of records) {
    kos.add(r.koId);
    if (r.kind === "source") {
      sources += 1;
    } else {
      attachments += 1;
    }
    if (r.provider) {
      withProvider += 1;
    }
    if (r.url) {
      withUrl += 1;
    }
    if (r.objectId) {
      withObject += 1;
    }
  }
  return {
    total: records.length,
    sources,
    attachments,
    withProvider,
    withUrl,
    withObject,
    distinctKos: kos.size,
  };
}

export type EvidenceTone = "source" | "attachment";

// Tone bestimmt die Badge-Farbe in der UI — rein aus dem Evidence-Kind abgeleitet.
export function evidenceKindTone(record: Pick<EvidenceRecord, "kind">): EvidenceTone {
  return record.kind === "source" ? "source" : "attachment";
}

// Defensive Anzeige-Begrenzung (Server begrenzt bereits; FE kappt zusätzlich für die Card).
export function limitEvidence(records: readonly EvidenceRecord[], limit: number): EvidenceRecord[] {
  return records.slice(0, Math.max(0, Math.floor(limit)));
}
