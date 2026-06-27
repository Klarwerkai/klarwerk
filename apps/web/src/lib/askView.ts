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
}

// Quellen-IDs in handlungsnahe Referenzen (Titel + Link-ID) auflösen; Reihenfolge bleibt erhalten.
export function sourceRefs(
  sourceIds: readonly string[],
  kos: readonly KnowledgeObject[],
): SourceRef[] {
  const titleById = new Map(kos.map((k) => [k.id, k.title]));
  return sourceIds.map((id) => {
    const title = titleById.get(id);
    return { id, label: title ?? id, known: title !== undefined };
  });
}
