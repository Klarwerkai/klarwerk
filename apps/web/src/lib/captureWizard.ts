// SCRUM-384 (Pedi-Review 02.07.): Wizard-Zustand der Erfassung — EIN Fokus je Schritt statt
// zweispaltiger Info-Wand. DOM-frei und damit ohne Browser testbar.
//
// Schritte (sichtbare Leiste nutzt die bestehenden capture.flow.step.*-Texte):
//   tell   → Erzählen (Freitext/Diktat/Interview; Details hinter „Erweitert")
//   refine → Wissensseite prüfen & verfeinern (Dokument-Editor, EINE KI-Palette)
//   done   → eingereicht (bestehende „gespeichert"-Karte)
// Der Expertenmodus (Formular direkt) bleibt bewusst außerhalb des Wizards erhalten.

import { CAPTURE_FLOW_STEPS, type CaptureFlowStep } from "./captureFlowGuide";

export type CaptureWizardStep = "tell" | "refine";

export interface CaptureWizardChip {
  id: CaptureFlowStep["id"];
  labelKey: string;
  state: "done" | "active" | "todo";
}

// Der Wizard erlaubt „refine" nur mit vorhandenem Entwurf — sonst ehrlich zurück zu „tell".
export function resolveWizardStep(
  requested: CaptureWizardStep,
  hasDraft: boolean,
): CaptureWizardStep {
  if (requested === "refine" && !hasDraft) return "tell";
  return requested;
}

// Sichtbare Schritt-Leiste: bildet die drei Flow-Schritte auf den Wizard-Zustand ab.
// raw ↔ tell, studio ↔ refine, review bleibt Ausblick (wird beim Einreichen erledigt).
export function wizardChips(step: CaptureWizardStep, hasDraft: boolean): CaptureWizardChip[] {
  const active = resolveWizardStep(step, hasDraft);
  return CAPTURE_FLOW_STEPS.map((s) => {
    let state: CaptureWizardChip["state"] = "todo";
    if (s.id === "raw") state = active === "tell" ? "active" : "done";
    if (s.id === "studio") state = active === "refine" ? "active" : hasDraft ? "done" : "todo";
    return { id: s.id, labelKey: s.labelKey, state };
  });
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test.
export const CAPTURE_WIZARD_TEXT = {
  back: "capture.wizard.back",
  structuring: "capture.wizard.structuring",
  condMeasures: "capture.wizard.condMeasures",
  condMeasuresHint: "capture.wizard.condMeasuresHint",
  helpers: "capture.wizard.helpers",
  helpersHint: "capture.wizard.helpersHint",
  docLabel: "capture.wizard.docLabel",
  // Runde 4 (ARGUS-Sollbild): Seitentitel, Titel-Feld-Label, Struktur-Aufklappung.
  pageTitle: "capture.wizard.pageTitle",
  titleLabel: "capture.wizard.titleLabel",
  structData: "capture.wizard.structData",
} as const;
