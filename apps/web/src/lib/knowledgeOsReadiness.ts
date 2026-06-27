// SCRUM-178: leitet aus den bereits berechneten QM-Signalen einen knappen Gesamtstatus für den
// Review ab. KEINE neue fachliche Engine — nur Aggregation von KnowledgeOsHintsResult (172/173/174)
// und den Fenster-Stati (177). Reine Lesesicht, deterministisch.
import type { KnowledgeOsHintsResult } from "./knowledgeOsHints";
import type { QmDataWindow } from "./qmDataWindow";

export type KnowledgeOsReadiness = "ready" | "attention" | "critical" | "incomplete";

export type ReadinessReasonId = "critical" | "warning" | "window" | "unknown";

export interface KnowledgeOsReadinessCounts {
  critical: number;
  warnings: number;
  unknown: number;
  windowLimited: number;
}

export interface KnowledgeOsReadinessResult {
  readiness: KnowledgeOsReadiness;
  counts: KnowledgeOsReadinessCounts;
  reasons: ReadinessReasonId[]; // max. 3, deterministisch nach Priorität
}

export interface KnowledgeOsReadinessInput {
  hints: KnowledgeOsHintsResult;
  windows?: readonly QmDataWindow[];
}

export function buildKnowledgeOsReadiness(
  input: KnowledgeOsReadinessInput,
): KnowledgeOsReadinessResult {
  const counts: KnowledgeOsReadinessCounts = {
    critical: input.hints.summary.critical,
    warnings: input.hints.summary.warnings,
    unknown: input.hints.unknownSources.length,
    windowLimited: (input.windows ?? []).filter((w) => w.status === "potentiallyLimited").length,
  };

  // Reasons in fester Prioritätsreihenfolge; nur vorhandene, max. 3.
  const reasons: ReadinessReasonId[] = (
    ["critical", "warning", "window", "unknown"] as ReadinessReasonId[]
  )
    .filter((id) => {
      if (id === "critical") {
        return counts.critical > 0;
      }
      if (id === "warning") {
        return counts.warnings > 0;
      }
      if (id === "window") {
        return counts.windowLimited > 0;
      }
      return counts.unknown > 0;
    })
    .slice(0, 3);

  let readiness: KnowledgeOsReadiness;
  if (counts.critical > 0) {
    readiness = "critical";
  } else if (counts.warnings > 0 || counts.windowLimited > 0) {
    // Fenster-Limit ist kein Fehler, kann aber Aufmerksamkeit auslösen.
    readiness = "attention";
  } else if (counts.unknown > 0) {
    readiness = "incomplete";
  } else {
    readiness = "ready";
  }

  return { readiness, counts, reasons };
}
