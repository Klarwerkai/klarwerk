// SCRUM-365 / AG-12 / AG-P2-3 / PI-K2: DOM-freie Review-Führung für das Validation Board. Beantwortet
// ruhig und vor der Entscheidung die zwei Beta-Fragen „Was prüfe ich jetzt?" und „Was bewirkt
// Grün/Gelb/Rot?" — OHNE neue Bewertungs-/Statuslogik und ohne Backend. Reine, testbare Funktionen.
//
// Wichtig (Ehrlichkeit, PI-K2): Trust ist ein Review-/Evidenzsignal, KEINE Wahrheitsgarantie. Erst ein
// erfülltes Quorum macht Wissen gesichert — eine einzelne Freigabe gibt nichts automatisch frei.
import type { ReviewContextKind } from "./validationReviewContext";

// „Was prüfe ich jetzt?" — eine kurze, stabile Checkliste (Reihenfolge fest), bewusst nicht-technisch.
// Reine i18n-Keys; die UI rendert sie als kompakte Progressive-Disclosure-Liste (keine Formularwand).
export interface ReviewCheckItem {
  id: string;
  labelKey: string;
  hintKey: string;
}

export const REVIEW_CHECK_ITEMS: readonly ReviewCheckItem[] = [
  { id: "statement", labelKey: "val.guide.statement", hintKey: "val.guide.statement.hint" },
  { id: "evidence", labelKey: "val.guide.evidence", hintKey: "val.guide.evidence.hint" },
  { id: "context", labelKey: "val.guide.context", hintKey: "val.guide.context.hint" },
  { id: "traceable", labelKey: "val.guide.traceable", hintKey: "val.guide.traceable.hint" },
];

// Kontext-Fokus aus VORHANDENEN Signalen (kein neues Feld): revidierte KOs → gezielt auf die Änderung
// schauen; bei Autor-Übertragung → extra Prüfblick. Sonst reicht die Basis-Checkliste (null). Revision
// hat Vorrang vor Autor-Transfer (die Änderung ist der konkretere Prüfanlass).
export function reviewGuidanceFocusKey(input: {
  kind: ReviewContextKind;
  authorTransferred: boolean;
}): string | null {
  if (input.kind === "revision") {
    return "val.guide.focus.revision";
  }
  if (input.authorTransferred) {
    return "val.guide.focus.transfer";
  }
  return null;
}

// PI-K2 / AG-P2-3: ehrliche Quorum-/Trust-Notiz — „Trust ≠ Wahrheit, erst das Quorum sichert".
export const DECISION_TRUST_NOTE_KEY = "val.guide.trustNote";

// „Was bewirkt die Entscheidung?" — die Wirkung VOR dem Klick. Ergänzt `reviewOutcome` (das die
// ehrliche Folge-Aussage NACH dem Klick liefert); hier geht es um die bewusste Erwartung vorher.
// Verdicts/Tönung bleiben identisch zu REVIEW_DECISIONS (up/warn/down · pos/warn/crit); warn/down
// verlangen weiterhin eine Begründung (needsReason) — gerahmt als Hilfe zur Nacharbeit, nicht technisch.
export type ReviewVerdict = "up" | "warn" | "down";
export type ReviewImpactTone = "pos" | "warn" | "crit";

export interface DecisionImpact {
  verdict: ReviewVerdict;
  titleKey: string;
  bodyKey: string;
  needsReason: boolean;
  tone: ReviewImpactTone;
}

const IMPACTS: Record<ReviewVerdict, DecisionImpact> = {
  up: {
    verdict: "up",
    titleKey: "val.impact.up.title",
    bodyKey: "val.impact.up.body",
    needsReason: false,
    tone: "pos",
  },
  warn: {
    verdict: "warn",
    titleKey: "val.impact.warn.title",
    bodyKey: "val.impact.warn.body",
    needsReason: true,
    tone: "warn",
  },
  down: {
    verdict: "down",
    titleKey: "val.impact.down.title",
    bodyKey: "val.impact.down.body",
    needsReason: true,
    tone: "crit",
  },
};

export const DECISION_IMPACTS: readonly DecisionImpact[] = [IMPACTS.up, IMPACTS.warn, IMPACTS.down];

export function decisionImpact(verdict: ReviewVerdict): DecisionImpact {
  return IMPACTS[verdict];
}
