// SCRUM-172 (Knowledge-OS-Foundation): bündelt die vorhandenen read-only Foundation-Signale
// (Provenance, Evidence-Index, ModelRuns, Reasoner-Konfiguration, optional KnowledgeHealth)
// zu kompakten QM-Hinweisen. Rein ableitend aus bereits berechneten Helper-Ergebnissen —
// KEIN neues Backend-Modell, kein Alerting, keine Datenänderung. Nicht geladene Signale
// werden als „unbekannt" geführt und NICHT als Fehler gezählt.
//
// R-0908 (Aufnahme gesamt-sprache-begriffe): Titel und Text jedes Hinweises kommen aus
// `texte/fachwort.ts` (`fachwort.qm.<id>.titel|text`). Die früheren `kos.hint.*`-Texte sagten
// „Reasoner", „ModelRun", „KOs" und „Evidence"; die `id` der Hinweise bleibt unverändert.
import type { ReasonerConfigStatus } from "../api/types";
import type { EvidenceFreshnessResult } from "./evidenceFreshness";
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
  | "evidenceFreshness"
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
  evidenceFreshness?: EvidenceFreshnessResult;
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
      titleKey: "fachwort.qm.modelrun-errors.titel",
      detailKey: "fachwort.qm.modelrun-errors.text",
      count: input.modelRunSummary.errors,
      source: "modelRuns",
    });
  }
  // ==============================================================================================
  // AUFTRAG-mega34 BLOCK G (bens GELB 4) — DER ZUSTAND OHNE BAND HAT JETZT SEINEN EIGENEN HINWEIS.
  // ==============================================================================================
  //
  // Seit mega33 ist `band` bei unbelegter Konflikterkennung `null`, weil sich aus einer Spanne
  // kein ehrlicher Gesundheitsgrad ableiten lässt. Die Abfragen darunter prüfen aber auf
  // `kritisch` bzw. `mittel` — beide sind dann falsch, und zwar in die entwarnende Richtung: der
  // sichtbare Worst-Case-Score konnte kritisch sein, ohne dass ein einziger Hinweis entstand, und
  // die Zusammenfassung leitete daraus sogar „alles in Ordnung" ab.
  //
  // Der Hinweis kommt deshalb aus der Beweislage selbst (`conflictFactor.proven === false`) und
  // nicht aus einem Band, das es in diesem Zustand gar nicht geben kann. Er steht VOR den
  // bandbasierten Abfragen, weil er die schwerere Aussage ist: er sagt nicht „der Wert ist
  // schlecht", sondern „der Wert ist nicht belegt".
  if (input.knowledgeHealth && input.knowledgeHealth.conflictFactor.proven === false) {
    hints.push({
      id: "health-detection-unproven",
      severity: "critical",
      titleKey: "fachwort.qm.health-detection-unproven.titel",
      detailKey: "fachwort.qm.health-detection-unproven.text",
      count: input.knowledgeHealth.score,
      source: "health",
    });
  }
  // 2) KnowledgeHealth kritisch (optional).
  if (input.knowledgeHealth && input.knowledgeHealth.band === "kritisch") {
    hints.push({
      id: "health-critical",
      severity: "critical",
      titleKey: "fachwort.qm.health-critical.titel",
      detailKey: "fachwort.qm.health-critical.text",
      count: input.knowledgeHealth.score,
      source: "health",
    });
  }
  // 3) Reasoner läuft im Demo-/Fallback-Modus (kein echtes Modell).
  if (input.reasonerConfig && reasonerModeTone(input.reasonerConfig) === "warn") {
    hints.push({
      id: "reasoner-demo",
      severity: "warning",
      titleKey: "fachwort.qm.reasoner-demo.titel",
      detailKey: "fachwort.qm.reasoner-demo.text",
      source: "reasonerConfig",
    });
  }
  // 4) ModelRun-Fallbacks (lief, aber deterministischer Ersatz).
  if (input.modelRunSummary && input.modelRunSummary.fallbacks > 0) {
    hints.push({
      id: "modelrun-fallbacks",
      severity: "warning",
      titleKey: "fachwort.qm.modelrun-fallbacks.titel",
      detailKey: "fachwort.qm.modelrun-fallbacks.text",
      count: input.modelRunSummary.fallbacks,
      source: "modelRuns",
    });
  }
  // 5) KOs mit Quellen/Anhängen ohne Evidence.
  if (input.provenance && input.provenance.summary.withoutEvidence > 0) {
    hints.push({
      id: "provenance-no-evidence",
      severity: "warning",
      titleKey: "fachwort.qm.provenance-no-evidence.titel",
      detailKey: "fachwort.qm.provenance-no-evidence.text",
      count: input.provenance.summary.withoutEvidence,
      source: "provenance",
    });
  }
  // 5b) Evidence nur für ältere KO-Versionen (aktuelle Version ohne Evidence).
  if (input.evidenceFreshness && input.evidenceFreshness.summary.outdated > 0) {
    hints.push({
      id: "evidence-outdated",
      severity: "warning",
      titleKey: "fachwort.qm.evidence-outdated.titel",
      detailKey: "fachwort.qm.evidence-outdated.text",
      count: input.evidenceFreshness.summary.outdated,
      source: "evidenceFreshness",
    });
  }
  // 5c) Quellen/Object-Anhänge ganz ohne Evidence (version-aware).
  if (input.evidenceFreshness && input.evidenceFreshness.summary.missing > 0) {
    hints.push({
      id: "evidence-missing",
      severity: "warning",
      titleKey: "fachwort.qm.evidence-missing.titel",
      detailKey: "fachwort.qm.evidence-missing.text",
      count: input.evidenceFreshness.summary.missing,
      source: "evidenceFreshness",
    });
  }
  // 6) KnowledgeHealth mittel (optional).
  if (input.knowledgeHealth && input.knowledgeHealth.band === "mittel") {
    hints.push({
      id: "health-mittel",
      severity: "warning",
      titleKey: "fachwort.qm.health-mittel.titel",
      detailKey: "fachwort.qm.health-mittel.text",
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
        titleKey: "fachwort.qm.provenance-lineage.titel",
        detailKey: "fachwort.qm.provenance-lineage.text",
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
      titleKey: "fachwort.qm.evidence-empty.titel",
      detailKey: "fachwort.qm.evidence-empty.text",
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
  // SCRUM-174: Evidence-Freshness ist optional — fehlt sie, ehrlich als unbekannt führen.
  if (!input.evidenceFreshness) {
    unknownSources.push("evidenceFreshness");
  }
  // SCRUM-173: KnowledgeHealth ist optional — fehlt der Score, ehrlich als unbekannt führen.
  if (!input.knowledgeHealth) {
    unknownSources.push("health");
  }

  // OK-Hinweis nur, wenn mindestens ein Signal bekannt ist und keine echten Hinweise anfielen.
  const KNOWN_SOURCE_COUNT = 6;
  const knownCount = KNOWN_SOURCE_COUNT - unknownSources.length;
  if (hints.length === 0 && knownCount > 0) {
    hints.push({
      id: "all-clear",
      severity: "ok",
      titleKey: "fachwort.qm.all-clear.titel",
      detailKey: "fachwort.qm.all-clear.text",
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
