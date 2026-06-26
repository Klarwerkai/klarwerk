// SCRUM-172 (Knowledge-OS-Foundation): bündelt die vorhandenen read-only Foundation-Signale
// (Provenance, Evidence-Index, ModelRuns, Reasoner-Konfiguration, optional KnowledgeHealth)
// zu kompakten QM-Hinweisen. Rein ableitend aus bereits berechneten Helper-Ergebnissen —
// KEIN neues Backend-Modell, kein Alerting, keine Datenänderung. Nicht geladene Signale
// werden als „unbekannt" geführt und NICHT als Fehler gezählt.
import type { ReasonerConfigStatus } from "../api/types";
import type { EvidenceIndexSummary } from "./evidenceIndex";
import type { KnowledgeHealth } from "./knowledgeHealth";
import type { ModelRunSummary } from "./modelRuns";
import type { ProvenanceIndexResult } from "./provenanceIndex";
import { reasonerModeTone } from "./reasonerStatus";

export type KnowledgeOsHintSeverity = "critical" | "warning" | "info" | "ok";
export type KnowledgeOsHintSource =
  | "modelRuns"
  | "reasonerConfig"
  | "provenance"
  | "evidence"
  | "health";

export interface KnowledgeOsHint {
  id: string;
  severity: KnowledgeOsHintSeverity;
  titleKey: string;
  detailKey: string;
  count?: number;
  source: KnowledgeOsHintSource;
}

export interface KnowledgeOsHintSummary {
  total: number;
  critical: number;
  warnings: number;
  info: number;
  ok: number;
}

export interface KnowledgeOsHintsResult {
  hints: KnowledgeOsHint[];
  summary: KnowledgeOsHintSummary;
  // Welche der erwarteten Kernsignale wurden NICHT übergeben (z. B. noch nicht geladen)?
  unknownSources: KnowledgeOsHintSource[];
}

export interface KnowledgeOsHintsInput {
  provenance?: ProvenanceIndexResult;
  evidenceSummary?: EvidenceIndexSummary;
  modelRunSummary?: ModelRunSummary;
  reasonerConfig?: ReasonerConfigStatus;
  knowledgeHealth?: KnowledgeHealth;
}

const SEVERITY_RANK: Record<KnowledgeOsHintSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

export function buildKnowledgeOsHints(input: KnowledgeOsHintsInput): KnowledgeOsHintsResult {
  const hints: KnowledgeOsHint[] = [];

  // Push-Reihenfolge = Priorität innerhalb gleicher Severity (stabiler Sort).
  // 1) ModelRun-Fehler — höchste Aufmerksamkeit.
  if (input.modelRunSummary && input.modelRunSummary.errors > 0) {
    hints.push({
      id: "modelrun-errors",
      severity: "critical",
      titleKey: "kos.hint.modelrun-errors.title",
      detailKey: "kos.hint.modelrun-errors.detail",
      count: input.modelRunSummary.errors,
      source: "modelRuns",
    });
  }
  // 2) KnowledgeHealth kritisch (optional).
  if (input.knowledgeHealth && input.knowledgeHealth.band === "kritisch") {
    hints.push({
      id: "health-critical",
      severity: "critical",
      titleKey: "kos.hint.health-critical.title",
      detailKey: "kos.hint.health-critical.detail",
      count: input.knowledgeHealth.score,
      source: "health",
    });
  }
  // 3) Reasoner läuft im Demo-/Fallback-Modus (kein echtes Modell).
  if (input.reasonerConfig && reasonerModeTone(input.reasonerConfig) === "warn") {
    hints.push({
      id: "reasoner-demo",
      severity: "warning",
      titleKey: "kos.hint.reasoner-demo.title",
      detailKey: "kos.hint.reasoner-demo.detail",
      source: "reasonerConfig",
    });
  }
  // 4) ModelRun-Fallbacks (lief, aber deterministischer Ersatz).
  if (input.modelRunSummary && input.modelRunSummary.fallbacks > 0) {
    hints.push({
      id: "modelrun-fallbacks",
      severity: "warning",
      titleKey: "kos.hint.modelrun-fallbacks.title",
      detailKey: "kos.hint.modelrun-fallbacks.detail",
      count: input.modelRunSummary.fallbacks,
      source: "modelRuns",
    });
  }
  // 5) KOs mit Quellen/Anhängen ohne Evidence.
  if (input.provenance && input.provenance.summary.withoutEvidence > 0) {
    hints.push({
      id: "provenance-no-evidence",
      severity: "warning",
      titleKey: "kos.hint.provenance-no-evidence.title",
      detailKey: "kos.hint.provenance-no-evidence.detail",
      count: input.provenance.summary.withoutEvidence,
      source: "provenance",
    });
  }
  // 6) KnowledgeHealth mittel (optional).
  if (input.knowledgeHealth && input.knowledgeHealth.band === "mittel") {
    hints.push({
      id: "health-mittel",
      severity: "warning",
      titleKey: "kos.hint.health-mittel.title",
      detailKey: "kos.hint.health-mittel.detail",
      count: input.knowledgeHealth.score,
      source: "health",
    });
  }
  // 7) Viele Transfer-/Multi-Version-KOs (rein informativ).
  if (input.provenance) {
    const lineage = input.provenance.summary.withTransfer + input.provenance.summary.multiVersion;
    if (lineage > 0) {
      hints.push({
        id: "provenance-lineage",
        severity: "info",
        titleKey: "kos.hint.provenance-lineage.title",
        detailKey: "kos.hint.provenance-lineage.detail",
        count: lineage,
        source: "provenance",
      });
    }
  }
  // 8) Noch keine Evidence-Records vorhanden (informativ).
  if (input.evidenceSummary && input.evidenceSummary.total === 0) {
    hints.push({
      id: "evidence-empty",
      severity: "info",
      titleKey: "kos.hint.evidence-empty.title",
      detailKey: "kos.hint.evidence-empty.detail",
      source: "evidence",
    });
  }

  // Welche Signale fehlen (unbekannt, NICHT als Fehler werten)?
  const unknownSources: KnowledgeOsHintSource[] = [];
  if (!input.modelRunSummary) {
    unknownSources.push("modelRuns");
  }
  if (!input.reasonerConfig) {
    unknownSources.push("reasonerConfig");
  }
  if (!input.provenance) {
    unknownSources.push("provenance");
  }
  if (!input.evidenceSummary) {
    unknownSources.push("evidence");
  }
  // SCRUM-173: KnowledgeHealth ist optional — fehlt der Score, ehrlich als unbekannt führen.
  if (!input.knowledgeHealth) {
    unknownSources.push("health");
  }

  // OK-Hinweis nur, wenn mindestens ein Signal bekannt ist und keine echten Hinweise anfielen.
  const KNOWN_SOURCE_COUNT = 5;
  const knownCount = KNOWN_SOURCE_COUNT - unknownSources.length;
  if (hints.length === 0 && knownCount > 0) {
    hints.push({
      id: "all-clear",
      severity: "ok",
      titleKey: "kos.hint.all-clear.title",
      detailKey: "kos.hint.all-clear.detail",
      source: "provenance",
    });
  }

  // Stabiler Sort nach Severity-Rang; Reihenfolge innerhalb des Rangs = Push-Reihenfolge.
  const sorted = [...hints].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const summary: KnowledgeOsHintSummary = {
    total: sorted.length,
    critical: sorted.filter((h) => h.severity === "critical").length,
    warnings: sorted.filter((h) => h.severity === "warning").length,
    info: sorted.filter((h) => h.severity === "info").length,
    ok: sorted.filter((h) => h.severity === "ok").length,
  };

  return { hints: sorted, summary, unknownSources };
}
