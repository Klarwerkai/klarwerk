// Reine, DOM-freie Wissens-Valuation (FE-MGMT-04). KEINE Bilanzbewertung —
// ein transparentes Schätzmodell aus echten Fakten × offengelegten Annahmen.
// Der Nutzer sieht/ändert die Annahmen im UI; die Formel ist sichtbar.
import type { ManagementSnapshot } from "../api/types";

export interface ValuationAssumptions {
  hourlyRate: number; // € pro Stunde (interne Kostenrate)
  hoursSavedPerValidatedKo: number; // gesparte Einarbeitungs-/Suchzeit je validiertem Objekt
  reuseFactor: number; // wie oft ein Objekt im Schnitt wiederverwendet wird
}

// Konservative Default-Annahmen — bewusst sichtbar und anpassbar, keine versteckten Zahlen.
export const DEFAULT_ASSUMPTIONS: ValuationAssumptions = {
  hourlyRate: 60,
  hoursSavedPerValidatedKo: 2,
  reuseFactor: 3,
};

export interface ValuationResult {
  estimateEur: number;
  perKoEur: number;
  formula: string;
}

// Wert = validierteObjekte × €/Std × Std/Objekt × Wiederverwendungsfaktor.
// Trust dämpft als Qualitätsfaktor (Ø-Trust/100), damit schwaches Wissen nicht überbewertet wird.
export function estimateValuation(
  facts: ManagementSnapshot["valuationFacts"],
  assumptions: ValuationAssumptions = DEFAULT_ASSUMPTIONS,
): ValuationResult {
  const qualityFactor = facts.avgTrust / 100;
  const perKoEur =
    assumptions.hourlyRate * assumptions.hoursSavedPerValidatedKo * assumptions.reuseFactor;
  const estimateEur = Math.round(facts.validatedKos * perKoEur * qualityFactor);
  return {
    estimateEur,
    perKoEur: Math.round(perKoEur),
    formula: "validierte Objekte × €/Std × Std/Objekt × Wiederverwendung × (Ø-Trust/100)",
  };
}

export function formatEur(value: number): string {
  return `${value.toLocaleString("de-DE")} €`;
}
