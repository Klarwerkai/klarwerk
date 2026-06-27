// SCRUM-251: DOM-freie Handlungs-/Statusübersicht fürs KO-Detail. Leitet „auf einen Blick"
// AUSSCHLIESSLICH aus bereits geladenen KO-Feldern ab (Status, Trust, Version, Quellen, Anhänge)
// und empfiehlt genau EINE sinnvolle nächste Handlung, die auf vorhandene echte Aktionen zeigt.
// KEIN neues KO-Modell, KEINE Mutation, KEINE falsche Validierungs-/Evidence-Behauptung.
import type { KnowledgeObject } from "../api/types";
import type { DisplayStatus } from "../components/trust/types";
import { type TrustBand, reviewSignals } from "./reviewSignals";

// Produktionsnähe: nutzbar (validiert) · in Prüfung (zugewiesen/Reval) · noch in Arbeit (offen).
export type KoUsability = "ready" | "in-review" | "needs-work";

// Nächste Handlung — verweist nur auf bestehende echte Aktionen des KO-Detail/Validierungsflows.
export type KoNextAction = "use" | "review" | "addSource" | "validate";

export interface KoOverview {
  usability: KoUsability;
  status: DisplayStatus;
  trust: number;
  trustBand: TrustBand;
  version: number;
  sourceCount: number;
  attachmentCount: number;
  hasEvidence: boolean;
  nextAction: KoNextAction;
}

function usabilityOf(status: DisplayStatus): KoUsability {
  if (status === "validiert") {
    return "ready";
  }
  if (status === "pruefung" || status === "revalidierung") {
    return "in-review";
  }
  return "needs-work";
}

// Ehrliche Empfehlung: validiert → nutzbar; in Prüfung → Bewertung abschließen; offen ohne Belege
// → erst Quelle/Beleg ergänzen; offen mit Belegen → zur Freigabe bewerten lassen.
function nextActionOf(usability: KoUsability, evidenceCount: number): KoNextAction {
  if (usability === "ready") {
    return "use";
  }
  if (usability === "in-review") {
    return "review";
  }
  return evidenceCount === 0 ? "addSource" : "validate";
}

export function koOverview(ko: KnowledgeObject): KoOverview {
  const sig = reviewSignals(ko);
  const sourceCount = ko.sources?.length ?? 0;
  const attachmentCount = ko.attachments?.length ?? 0;
  const usability = usabilityOf(sig.status);
  return {
    usability,
    status: sig.status,
    trust: sig.trust,
    trustBand: sig.trustBand,
    version: sig.version,
    sourceCount,
    attachmentCount,
    hasEvidence: sourceCount + attachmentCount > 0,
    nextAction: nextActionOf(usability, sourceCount + attachmentCount),
  };
}
