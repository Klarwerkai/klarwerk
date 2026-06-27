// Reine, DOM-freie Logik fürs Conflict Board (SCRUM-127 / SCRUM-128).
// Keine Backend-Änderung, keine KO-Mutation: nur Auflösung von IDs zu echten KOs
// und die fachliche Definition der (Nicht-)Wirkung einer Konfliktauflösung.
import type { Conflict, KnowledgeObject } from "../api/types";

export interface ConflictKoPair {
  a: KnowledgeObject | null;
  b: KnowledgeObject | null;
}

// SCRUM-127: koA/koB zu echten Wissensobjekten auflösen (null, wenn nicht gefunden — kein Fake).
export function conflictKoPair(
  conflict: Pick<Conflict, "koA" | "koB">,
  kos: readonly KnowledgeObject[],
): ConflictKoPair {
  const byId = (koId: string): KnowledgeObject | null => kos.find((k) => k.id === koId) ?? null;
  return { a: byId(conflict.koA), b: byId(conflict.koB) };
}

// SCRUM-128: Fachliche Definition der Auflösungswirkung.
// Eine Freitext-Entscheidung bestimmt keinen maschinell eindeutigen Gewinner →
// daher KEINE automatische KO-Status-/Trust-Mutation (kein stilles Überschreiben).
// Wirkung ist dokumentierend (Entscheidung + Audit) und hinweisend (Revalidierung).
export interface ResolutionEffect {
  documented: boolean; // Entscheidung + Audit auf Konfliktebene
  koStatusChanged: boolean; // immer false — keine automatische Statusänderung am KO
  koTrustChanged: boolean; // immer false — keine automatische Trust-Änderung am KO
  revalidationRecommended: boolean; // bei Wahrheitskonflikten manuelle Re-Validierung empfehlen
}

export function resolutionEffect(conflict: Pick<Conflict, "type">): ResolutionEffect {
  return {
    documented: true,
    koStatusChanged: false,
    koTrustChanged: false,
    revalidationRecommended: conflict.type === "truth",
  };
}

// SCRUM-252: genau EINE sinnvolle nächste Handlung aus Art + Status ableiten.
// Verweist nur auf bestehende echte Aktionen (escalate/secondOpinion/resolve) — keine neue Logik,
// keine automatische Lösung. Spiegelt die Aktionsverfügbarkeit der Konfliktseite wider:
//  - gelöst                       → keine offene Handlung (done)
//  - Wahrheitskonflikt, offen     → an einen Menschen eskalieren
//  - Wahrheitskonflikt, eskaliert → Zweitmeinung einholen
//  - Wahrheitskonflikt, Zweitm.   → entscheiden/lösen
//  - Nicht-Wahrheit (nicht eskalierbar): offen → Zweitmeinung, Zweitm. → entscheiden/lösen.
export type ConflictNextStep = "escalate" | "secondOpinion" | "resolve" | "done";

export function conflictNextStep(conflict: Pick<Conflict, "type" | "status">): ConflictNextStep {
  if (conflict.status === "geloest") {
    return "done";
  }
  if (conflict.type === "truth") {
    if (conflict.status === "offen") {
      return "escalate";
    }
    if (conflict.status === "eskaliert") {
      return "secondOpinion";
    }
    return "resolve"; // zweitmeinung
  }
  // Nicht-Wahrheitskonflikte sind nicht eskalierbar: erst Zweitmeinung, dann entscheiden.
  return conflict.status === "zweitmeinung" ? "resolve" : "secondOpinion";
}
