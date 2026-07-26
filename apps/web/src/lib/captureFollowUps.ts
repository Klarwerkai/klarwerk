// ==============================================================================================
// AUFTRAG-mega21 Block C-1 — DIE NACHARBEITEN BEIM NAMEN NENNEN.
// ==============================================================================================
//
// Der Server trennt seit mega20 die erfolgreiche Kernanlage von den nachgelagerten Best-Effort-
// Schritten und meldet die gescheiterten in `followUpsFailed`. ben nennt diese Trennung
// grundsätzlich vertretbar — was fehlte, war nicht die Trennung, sondern was der Nutzer davon
// erfährt.
//
// WARUM DIE ÜBERSETZUNG HIER LIEGT UND NICHT IN Capture.tsx. Die Schrittnamen sind ein
// SERVERVERTRAG (`ko-routes.ts`: "draft-discard", "validation-assign", "notify-assignment",
// "ai-check"). Sie in einem 5000-Zeilen-Bildschirm zu einer Zeichenkette zu verketten hiesse, den
// Vertrag an einer Stelle zu spiegeln, an der ihn niemand wiederfindet — und beim nächsten neuen
// Schritt fiele er stillschweigend auf „unbekannt" zurück, ohne dass es jemandem auffiele.
//
// ZWEI SCHLÜSSEL JE SCHRITT, und das ist Absicht:
//   · der NAME sagt, WAS nicht lief („die Prüferzuweisung"),
//   · der NÄCHSTE SCHRITT sagt, was der Nutzer TUN kann.
// Eine Warnung ohne den zweiten Teil ist eine Sackgasse — genau das war der Befund.
//
// DER UNBEKANNTE SCHRITT ist ausdrücklich vorgesehen und wird ehrlich als solcher angezeigt. Ein
// Server, der einen neuen Schritt meldet, den diese Fassung der Oberfläche noch nicht kennt, darf
// nicht dazu führen, dass die Warnung ihn verschweigt.

/** Die Schrittnamen, die `POST /api/kos/from-document` in `followUpsFailed` melden kann. */
export const CAPTURE_FOLLOW_UP_STEPS = [
  "draft-discard",
  "validation-assign",
  "notify-assignment",
  "ai-check",
] as const;

export type CaptureFollowUpStep = (typeof CAPTURE_FOLLOW_UP_STEPS)[number];

const NAME_KEYS: Record<CaptureFollowUpStep, string> = {
  "draft-discard": "capture.followUp.draftDiscard",
  "validation-assign": "capture.followUp.validationAssign",
  "notify-assignment": "capture.followUp.notifyAssignment",
  "ai-check": "capture.followUp.aiCheck",
};

const NEXT_KEYS: Record<CaptureFollowUpStep, string> = {
  "draft-discard": "capture.followUp.draftDiscardNext",
  "validation-assign": "capture.followUp.validationAssignNext",
  "notify-assignment": "capture.followUp.notifyAssignmentNext",
  "ai-check": "capture.followUp.aiCheckNext",
};

function bekannt(step: string): step is CaptureFollowUpStep {
  return (CAPTURE_FOLLOW_UP_STEPS as readonly string[]).includes(step);
}

/** Der Name des Schrittes, wie ihn ein Mensch liest. */
export function captureFollowUpStepKey(step: string): string {
  return bekannt(step) ? NAME_KEYS[step] : "capture.followUp.unknown";
}

// ==============================================================================================
// AUFTRAG-mega23 Block B — DIE HANDLUNG WIRD NUR BEHAUPTET, WENN DER ZUSTAND GESCHRIEBEN WURDE.
// ==============================================================================================
//
// bens SB-G. Der Text zu „ai-check" sagt in allen drei Sprachen, die Prüfung SEI als
// fehlgeschlagen vermerkt und lasse sich neu anstoßen. Diese Zusage hängt an einem
// BEST-EFFORT-Schreibvorgang (`markAiCheckFailed`), dessen Fehlschlag der Server bis mega22
// verschluckte. Fiel er aus, gab es GAR KEINEN Prüf-Vermerk — und der Wiederhol-Endpunkt lehnt
// genau dann ab, weil er `failed` oder `pending` verlangt. Der Nutzer bekam eine Zusage, die
// niemand gedeckt hat, und der Knopf auf der Validierungsseite erschien gar nicht erst (das
// Badge rendert ohne `aiCheck` nichts) — eine Sackgasse mit freundlichem Text davor.
//
// SEIT mega23 Block B trägt die Antwort die Tatsache (`followUpsRecorded.aiCheckFailed`), und
// die Auswahl des Textes hängt daran. FAIL-CLOSED: ohne Nachweis wird NICHT versprochen. Ein
// älterer Server ohne das Feld führt damit zur ehrlichen, nicht zur schmeichelhaften Auskunft.
//
// NUR „ai-check" IST BETROFFEN, und das ist kein Vergessen der übrigen: deren Texte versprechen
// keinen serverseitig geschriebenen Zustand, sondern nennen eine Handlung, die der Nutzer selbst
// ausführt („Öffne die Validierung und weise die Prüfer dort erneut zu").

/**
 * Was der Nutzer TUN kann, damit die Warnung keine Sackgasse ist.
 *
 * `aiCheckVermerkt` ist der NACHWEIS aus der Serverantwort, dass der `failed`-Vermerk wirklich
 * steht. Der Parameter ist absichtlich ohne Vorbelegung: ein Default `true` wäre fail-open und
 * brächte genau die Behauptung zurück, die dieser Block beseitigt.
 */
export function captureFollowUpNextKey(step: string, aiCheckVermerkt: boolean): string {
  if (step === "ai-check" && !aiCheckVermerkt) {
    return "capture.followUp.aiCheckUnrecordedNext";
  }
  return bekannt(step) ? NEXT_KEYS[step] : "capture.followUp.unknownNext";
}
