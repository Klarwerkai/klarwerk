// ================================================================================================
// FE-003 · DER RAHMEN FÜR SEITENTUTORIALS — und sein einziger Eintrag: „Fragen“.
// ================================================================================================
//
// Ein Seitentutorial ist eine Unterrichtsfolge für GENAU EINE Seite: Schritte mit Erklärung,
// Vertiefung und einer Vorführung in Teilen, dazu eine Demo aus den echten Bausteinen der Seite.
// Der Rahmen (Knopf, Bereich, Fortschritt, Kapitelwahl, Vorführsteuerung, Vorlesen, Fokus) ist für
// jede Seite derselbe; der INHALT gehört der Seite.
//
// WAS HIER BEWUSST FEHLT: jede andere Seite. Das Ticket beauftragt nur „Fragen“ (Kriterium 7) —
// auf allen anderen Seiten steht deshalb kein Knopf, kein leerer Bereich, kein Platzhalter. Eine
// spätere Seite bekommt ihr Tutorial, indem sie hier einen eigenen, vollständig ausgearbeiteten
// Eintrag erhält; `tests/fe003-tutorial-fragen/` hält fest, dass bis dahin nur `/fragen` einen hat.
import { FRAGEN_LEKTION } from "./fragen/lektion";
import type { TutorialDefinition } from "./typen";

/** Das Register. Ein Eintrag je Seite mit VOLLSTÄNDIG ausgearbeitetem Tutorial — heute einer. */
export const TUTORIALS: readonly TutorialDefinition[] = [FRAGEN_LEKTION];

export function tutorialFuerPfad(pfad: string): TutorialDefinition | null {
  return TUTORIALS.find((t) => t.pfad === pfad) ?? null;
}
