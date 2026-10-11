// SCRUM-370 / AG-12 / AG-13 / AG-P2-4: DOM-freie Produktführung für die Erfassung. Rahmt Capture NICHT
// als technisches Formular, sondern als einfachen geführten Weg: Rohwissen erfassen → im Knowledge
// Studio strukturieren (empfohlener Hauptweg) → prüfen & einreichen. Das Studio ist der große, ruhige
// Arbeitsraum mit KI-Hilfe — es soll als naheliegender nächster Schritt sichtbar sein, nicht versteckt.
//
// KEIN Multi-Step-Wizard mit Backend-State, KEIN Score/Gamification, KEINE neue Architektur, kein RAG.
// Reine i18n-/Datenbeschreibung → testbar ohne DOM. Ehrlichkeit bleibt: erst nach Prüfung gesichert.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier standen zusätzlich die Schritt-Tabelle
// `CAPTURE_FLOW_STEPS` (rohwissen → studio → prüfen, samt Typen) und ihre Zugriffe
// `captureFlowSteps()`, `captureFlowStepLabelKey(id)` und `recommendedFlowStep()`. Keiner davon
// hatte einen Produktleser — die Erfassung führt seit `lib/captureWizard.ts`
// (erzählen/verfeinern/fertig, R-0991 Nr. 12). Sie sind entfernt. Geblieben sind die Texte unten,
// die `pages/Capture.tsx` liest. Die Wörterbuchschlüssel der Schritte bleiben stehen: der
// Textbestand ist durch `tests/i18n-textmodule/bestand-unveraendert.test.ts` Wert für Wert festgehalten.

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (kein Doppel-Literal).
// - railKicker: kurze Überschrift der Weg-Leiste („So gehst du vor").
// - studioRecommended: „Empfohlen"-Chip am Studio-Einstieg.
// - studioLead: ruhiger Hinweis, dass das Studio der empfohlene Strukturier-Schritt ist.
// - submitValue: Beitragswert/Motivation direkt an der Einreich-Entscheidung (AG-P2-4) — ehrlich:
//   gesichert wird das Wissen erst nach der Prüfung, nichts wird automatisch validiert.
export const CAPTURE_FLOW_TEXT = {
  railKicker: "capture.flow.railKicker",
  railKickerHint: "capture.flow.railKickerHint",
  studioRecommended: "capture.flow.studioRecommended",
  studioLead: "capture.flow.studioLead",
  submitValue: "capture.flow.submitValue",
} as const;
