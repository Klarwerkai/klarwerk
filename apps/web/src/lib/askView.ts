// SCRUM-250: DOM-freie Sicht-Ableitung für die Ask-Antwort. Macht ehrlich sichtbar, ob die Antwort
// gesichert ist (aus der Knowledge-Class abgeleitet — KEINE neue Antwortlogik) und löst Quellen-IDs
// in lesbare KO-Titel auf. Keine RAG/Vector-DB, keine neuen Backend-Felder. Reine Funktionen.
import type { KnowledgeClass, KnowledgeObject } from "../api/types";

export type AnswerStatusKey = "verified" | "unverified";

export interface AnswerStatus {
  key: AnswerStatusKey;
  tone: "pos" | "warn";
}

// Nur „gesichert" (validiertes KO) gilt als gesichert; alles andere wird ehrlich als „ungeprüft"
// markiert — kein falsches „Aus validiertem Wissen" mehr für ungeprüfte/Meinungs-/Annahme-Quellen.
export function answerStatus(knowledgeClass: KnowledgeClass): AnswerStatus {
  return knowledgeClass === "gesichert"
    ? { key: "verified", tone: "pos" }
    : { key: "unverified", tone: "warn" };
}

export interface SourceRef {
  id: string;
  label: string; // KO-Titel, sonst die ID als Fallback
  known: boolean; // true, wenn ein KO mit der ID im Bestand gefunden wurde
  validated: boolean | null; // true/false bei bekanntem KO, null bei unbekannter Quelle
}

// Quellen-IDs in handlungsnahe Referenzen (Titel + Link-ID) auflösen; Reihenfolge bleibt erhalten.
export function sourceRefs(
  sourceIds: readonly string[],
  kos: readonly KnowledgeObject[],
): SourceRef[] {
  const byId = new Map(kos.map((k) => [k.id, k]));
  return sourceIds.map((id) => {
    const ko = byId.get(id);
    return {
      id,
      label: ko?.title ?? id,
      known: ko !== undefined,
      validated: ko ? ko.status === "validiert" : null,
    };
  });
}

export interface AnswerReviewGuard {
  labelKey: string;
  hintKey: string;
  ctaKey: string;
  ctaTo: string;
}

// SCRUM-288: Zusätzliche Nutzungs-Leitplanke für ungeprüfte Antworten. Die Antwortlogik bleibt
// unverändert; diese Sicht macht nur klar, dass ungeprüfte/offene Quellen in Review gehören.
export function answerReviewGuard(
  knowledgeClass: KnowledgeClass,
  sources: readonly SourceRef[],
): AnswerReviewGuard | null {
  if (knowledgeClass === "gesichert") {
    return null;
  }
  const hasOpenSource = sources.some((s) => s.validated === false);
  return {
    labelKey: hasOpenSource ? "ask.reviewGuard.openLabel" : "ask.reviewGuard.unverifiedLabel",
    hintKey: hasOpenSource ? "ask.reviewGuard.openHint" : "ask.reviewGuard.unverifiedHint",
    ctaKey: "ask.reviewGuard.cta",
    ctaTo: "/validierung",
  };
}
