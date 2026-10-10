// SCRUM-384 / AG-12 / KG-UX-001/002/003/010: DOM-freier Einstiegs-Helfer für die Erfassung.
// Der Erstkontakt darf nicht formularartig überfordern: der geführte Erzähl-Einstieg (Freitext,
// Diktat, geführtes Interview → Studio) ist der Standardweg; das klassische Formular bleibt als
// Expertenpfad einen bewussten Klick entfernt erhalten (progressive disclosure, NICHTS entfernt).

// PMO-FEA-0006: „datei" = Wissen aus Datei extrahieren (vierter Erzähl-Modus).
export const CAPTURE_MODES = ["freitext", "formular", "diktat", "interview", "datei"] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

// Der Expertenpfad ist GENAU das klassische Formular; alles andere gehört zum Erzähl-Einstieg.
export const EXPERT_MODE: CaptureMode = "formular";

// Erzähl-Modi in fester Reihenfolge (Standardweg zuerst). Bewusst OHNE das Formular.
export const NARRATE_MODES: readonly CaptureMode[] = ["freitext", "diktat", "interview", "datei"];

export function isExpertMode(mode: CaptureMode): boolean {
  return mode === EXPERT_MODE;
}

// R-1349 · HIER STANDEN DIE BAUSTEINE DER ALTEN ERFASSUNGSSEITE, die seit JOB 3062 (das Blatt)
// keinen Produktaufrufer mehr hatten und deshalb entfernt sind: Empfehlungs-Badge der Modus-Leiste
// (`isRecommendedMode`), eingeklappter Arbeitsraum (`initialCaptureWorkspaceOpen`), die Schlüssel-
// tabelle der Modus-Leiste (`CAPTURE_ENTRY_TEXT`), die Erstnutzer-Führung (`isCaptureFirstRun`,
// `markCaptureIntroSeen`) und die Optionsliste der Vordertür (`FRONT_DOOR_OPTION_MODES`,
// `FRONT_DOOR_OPTIONS_TEXT`, `frontDoorOption*`, `frontDoorOptionsOpen`,
// `rememberFrontDoorOptionsOpen`). Ihre Wege trägt heute das Menü „Datei ▾" des Blattes
// (`components/erfassen/wege.ts`), abgeleitet aus `NARRATE_MODES` und `EXPERT_MODE`.
