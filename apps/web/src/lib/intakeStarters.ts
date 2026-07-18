// SCRUM-527 (Design-Batch B): die vier Starter-Chips des Leerzustands. Sie zeigen die ART Wissen (nicht
// Feldlabels) und geben beim Antippen einen warmen Satzanfang vor — Reagieren ist leichter als Erschaffen.
// Rein deklarativ (i18n-Keys, DOM-frei); die Vorbefüllung (prefillKey) ist der „passende Anfang".
export interface IntakeStarter {
  id: "decision" | "mistake" | "howItWorks" | "changed";
  labelKey: string;
  prefillKey: string;
}

export const INTAKE_STARTERS: readonly IntakeStarter[] = [
  { id: "decision", labelKey: "intake.starter.decision", prefillKey: "intake.prefill.decision" },
  { id: "mistake", labelKey: "intake.starter.mistake", prefillKey: "intake.prefill.mistake" },
  {
    id: "howItWorks",
    labelKey: "intake.starter.howItWorks",
    prefillKey: "intake.prefill.howItWorks",
  },
  { id: "changed", labelKey: "intake.starter.changed", prefillKey: "intake.prefill.changed" },
];
