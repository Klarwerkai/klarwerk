// SCRUM-384 / AG-12 / KG-UX-001/002/003/010: DOM-freier Einstiegs-Helfer für die Erfassung.
// Der Erstkontakt darf nicht formularartig überfordern: der geführte Erzähl-Einstieg (Freitext,
// Diktat, geführtes Interview → Studio) ist der Standardweg; das klassische Formular bleibt als
// Expertenpfad einen bewussten Klick entfernt erhalten (progressive disclosure, NICHTS entfernt).
// Die Erstnutzer-Führung wird pro Browser gemerkt — über ein schmales Storage-Interface statt
// direktem localStorage-Zugriff, damit die Logik ohne DOM testbar bleibt.

// PMO-FEA-0006: „datei" = Wissen aus Datei extrahieren (vierter Erzähl-Modus).
export const CAPTURE_MODES = ["freitext", "formular", "diktat", "interview", "datei"] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

// Der Expertenpfad ist GENAU das klassische Formular; alles andere gehört zum Erzähl-Einstieg.
export const EXPERT_MODE: CaptureMode = "formular";

// Erzähl-Modi in fester Reihenfolge (Standardweg zuerst). Bewusst OHNE das Formular.
export const NARRATE_MODES: readonly CaptureMode[] = ["freitext", "diktat", "interview", "datei"];

// ================================================================================================
// AUFTRAG-mega51 BLOCK B — EINE PRIMÄRE HANDLUNG BEIM ERFASSEN.
// ================================================================================================
// Die Modus-Leiste zeigte vier Erzählwege plus den Expertenmodus als GLEICHFÖRMIGE Knopfreihe,
// unterschieden nur durch Aktiv-Zustand und einen gestrichelten Rand. Fünf gleichrangige Angebote
// sind kein Angebot — eine Erstnutzerin muss raten, wo sie anfängt.
//
// WELCHER IST DER EMPFOHLENE (B1): `freitext`. Das ist keine neue Entscheidung, sondern die, die
// der Bestand an drei Stellen schon getroffen hat und die hier nur noch sichtbar wird:
//   · Es ist der Anfangszustand der Seite (`useState<Mode>("freitext")`, Capture.tsx).
//   · Es ist der Rückweg: wer den Expertenmodus verlässt, landet auf `freitext` — die Ruhelage.
//   · Es steht in dieser Liste an erster Stelle, und der Kommentar darüber nennt sie „Standardweg
//     zuerst".
// Deshalb wird die Empfehlung ABGELEITET und nicht als zweites Literal danebengeschrieben: eine
// Umsortierung der Liste zieht sie ohne Nacharbeit mit.
//
// KEINE FÄHIGKEIT VERSCHWINDET (B2): Diktat, Interview und Datei bleiben genau da, wo sie waren,
// mit demselben `switchMode`-Aufruf. Sie werden nur ruhiger gezeichnet.
export const RECOMMENDED_NARRATE_MODE: CaptureMode = NARRATE_MODES[0] as CaptureMode;

export function isRecommendedMode(mode: CaptureMode): boolean {
  return mode === RECOMMENDED_NARRATE_MODE;
}

export function isExpertMode(mode: CaptureMode): boolean {
  return mode === EXPERT_MODE;
}

// SCRUM-458 (Nullschulung): Der klassische Erfassungs-Arbeitsraum (Schritt-Leiste · Erzähl-Modi ·
// Formular) startet EINGEKLAPPT — beim Betreten zeigt Schritt 1 nur einen ruhigen Aufklapp-Einstieg
// statt eines vollen Formulars. Defensiv AUFGEKLAPPT, wenn schon ein aktiver Kontext vorliegt, der sonst
// verdeckt wäre: ein Lücken-Kontext (?gap=) oder ein Deep-Link/fortgesetzter Entwurf mit vorbefülltem
// Rohtext. Reine Sichtbarkeit — kein Funktionsverlust, alle Wege bleiben einen Klick entfernt. Ist der
// Arbeitsraum aufgeklappt, zeigt die Modus-Leiste ALLE Erzähl-Modi direkt (keine zweite Ebene mehr).
export function initialCaptureWorkspaceOpen(context: {
  hasGapContext: boolean;
  hasPrefilledRaw: boolean;
}): boolean {
  return context.hasGapContext || context.hasPrefilledRaw;
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (kein Doppel-Literal).
// - narrateKicker: ruhige Überschrift über den Erzähl-Modi („Erzähl dein Wissen").
// - expertToggle: bewusster Einstieg in den Expertenpfad (Formular direkt ausfüllen).
// - expertHint: ehrliche Einordnung des Expertenpfads (gleiche Felder, kein Extra-Feature).
// - expertActive: Hinweis IM Expertenmodus + Rückweg auf den geführten Standardweg.
// - backToGuided: Rückweg-Button zurück zum Erzähl-Einstieg.
// - recommendedBadge: die sichtbare Kennzeichnung des empfohlenen Erzählwegs (mega51 B1).
export const CAPTURE_ENTRY_TEXT = {
  recommendedBadge: "capture.entry.recommendedBadge",
  narrateKicker: "capture.entry.narrateKicker",
  expertToggle: "capture.entry.expertToggle",
  expertHint: "capture.entry.expertHint",
  expertActive: "capture.entry.expertActive",
  backToGuided: "capture.entry.backToGuided",
} as const;

// ---- Erstnutzer-Führung (pro Browser) -------------------------------------------------------

// Schmales Interface statt direktem localStorage → DOM-frei testbar; defensiv gegen
// Storage-Fehler (Private Mode, volle Quota): Lesen/Schreiben darf NIE die Seite kippen.
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CAPTURE_INTRO_SEEN_KEY = "kw.capture.introSeen.v1";

// true = Erstbesuch in diesem Browser → geführte Einführung ausgeklappt zeigen.
export function isCaptureFirstRun(store: KeyValueStore | null | undefined): boolean {
  if (!store) {
    return true;
  }
  try {
    return store.getItem(CAPTURE_INTRO_SEEN_KEY) === null;
  } catch {
    return true;
  }
}

// Nach dem ersten Rendern merken — beim nächsten Besuch startet die Einführung eingeklappt
// (bleibt aber jederzeit wieder aufklappbar; es wird keine Funktion entfernt).
export function markCaptureIntroSeen(store: KeyValueStore | null | undefined): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(CAPTURE_INTRO_SEEN_KEY, "1");
  } catch {
    // bewusst still: Persistenz ist ein Komfort, kein Funktionsbestandteil.
  }
}

// ================================================================================================
// JOB 530 — WEITERE EINGABEOPTIONEN AN DER VORDERTÜR.
// ================================================================================================
// Die Vordertür (`/capture/frontdoor`) ist der schnelle Einstieg: ein Titel, ein Dokument. Die
// übrigen Eingabeoptionen standen dort bisher NUR als Prosa („der vollständige Erfassen-Bereich hat
// alle Wege"). Ein Satz ist kein Weg: wer Diktat, Interview, Dateiimport oder das Expertenformular
// wollte, musste den Bereich erst betreten und dort selbst suchen.
//
// Sie werden hier einzeln erreichbar — ohne den Erfassungsstart wieder zuzustellen. Dafür dient
// GENAU das Aufklappmuster, das der Erfassen-Bereich für „Weitere Wege" schon benutzt
// (Knopf + `aria-expanded`/`aria-controls`, standardmäßig eingeklappt). Kein zweites Muster.
//
// ABGELEITET STATT ZWEITGESCHRIEBEN: die Liste ist `NARRATE_MODES` plus der Expertenpfad — also
// alle bekannten Modi, in der Reihenfolge des Bestands. Eine Umsortierung oder ein neuer Modus zieht
// die Vordertür ohne Nacharbeit mit; dieselbe Regel wie bei `RECOMMENDED_NARRATE_MODE`.
export const FRONT_DOOR_OPTION_MODES: readonly CaptureMode[] = [...NARRATE_MODES, EXPERT_MODE];

// Flache Copy-Schlüssel für den Aufklapp-Knopf — EINE Quelle für Komponente + Test.
export const FRONT_DOOR_OPTIONS_TEXT = {
  show: "fd.options.show",
  hide: "fd.options.hide",
} as const;

// Beschriftung eines Wegs: DIESELBEN Modus-Namen wie in der Erfassen-Modusleiste. Ein zweiter
// Textbestand für dieselben fünf Wege würde nur auseinanderlaufen.
export function frontDoorOptionLabelKey(mode: CaptureMode): string {
  return `capture.mode.${mode}`;
}

// Ein Satz je Weg — wofür er da ist. Das ist die eigentliche Entlastung: die Wahl fällt VOR dem
// Seitenwechsel, nicht erst durch Ausprobieren im Erfassen-Bereich.
export function frontDoorOptionHintKey(mode: CaptureMode): string {
  return `fd.options.hint.${mode}`;
}

export const CAPTURE_FRONT_DOOR_OPTIONS_OPEN_KEY = "kw.capture.frontDoorOptionsOpen.v1";

// Zustandsstabil heißt hier zweierlei, und beides hängt an dieser einen Quelle:
//  · innerhalb eines Besuchs überlebt der Aufklappzustand jeden Zustandswechsel der Seite
//    (Tippen, KI-Vorschlag, Entwurf laden) — er ist eigener Seitenzustand, kein Nebeneffekt;
//  · über Besuche hinweg wird er pro Browser gemerkt, mit demselben schmalen Storage-Vertrag und
//    derselben Defensive wie die Erstnutzer-Führung oben: Lesen/Schreiben darf NIE die Seite kippen.
// Vorgabe ist EINGEKLAPPT — das ist der entlastete Erfassungsstart. Wer aufklappt, bekommt seine
// Wahl beim nächsten Besuch zurück.
export function frontDoorOptionsOpen(store: KeyValueStore | null | undefined): boolean {
  if (!store) {
    return false;
  }
  try {
    return store.getItem(CAPTURE_FRONT_DOOR_OPTIONS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberFrontDoorOptionsOpen(
  store: KeyValueStore | null | undefined,
  open: boolean,
): void {
  if (!store) {
    return;
  }
  try {
    store.setItem(CAPTURE_FRONT_DOOR_OPTIONS_OPEN_KEY, open ? "1" : "0");
  } catch {
    // bewusst still: Persistenz ist ein Komfort, kein Funktionsbestandteil.
  }
}
