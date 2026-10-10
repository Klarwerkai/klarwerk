// SCRUM-384 (Pedi-Review 02.07.): Wizard-Zustand der Erfassung — EIN Fokus je Schritt statt
// zweispaltiger Info-Wand. DOM-frei und damit ohne Browser testbar.
//
// Schritte:
//   tell   → Erzählen (Freitext/Diktat/Interview; Details hinter „Erweitert")
//   refine → Wissensseite prüfen & verfeinern (Dokument-Editor, EINE KI-Palette)
//   done   → eingereicht (bestehende „gespeichert"-Karte)
// Der Expertenmodus (Formular direkt) bleibt bewusst außerhalb des Wizards erhalten.
// Die sichtbare Schritt-Leiste (`wizardChips`) ist seit JOB 3062 von der Fläche genommen und mit
// R-1349 entfernt; der Zustand selbst bleibt über `resolveWizardStep` verdrahtet.

export type CaptureWizardStep = "tell" | "refine";

// Der Wizard erlaubt „refine" nur mit vorhandenem Entwurf — sonst ehrlich zurück zu „tell".
export function resolveWizardStep(
  requested: CaptureWizardStep,
  hasDraft: boolean,
): CaptureWizardStep {
  if (requested === "refine" && !hasDraft) return "tell";
  return requested;
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
  // Runde 5 (Pedi): Verwerfen auf der Wissensseite + Upload direkt beim Erzählen.
  discard: "capture.wizard.discard",
  discardQ: "capture.wizard.discardQ",
  discardKeep: "capture.wizard.discardKeep",
  discardYes: "capture.wizard.discardYes",
  discardDone: "capture.wizard.discardDone",
  upload: "capture.wizard.upload",
  uploadCount: "capture.wizard.uploadCount",
  // Pedi 04.07.: eigener „beifügen"-Knopf — Datei/Bild NUR anhängen (kein Text ins Feld).
  attach: "capture.wizard.attach",
  attached: "capture.wizard.attached",
} as const;
