// SCRUM-236: DOM-freie Feature-Detection für die Web-Speech-API (Diktat). Nimmt ein window-artiges
// Objekt entgegen (testbar ohne echten Browser) und meldet ehrlich, ob SpeechRecognition oder
// webkitSpeechRecognition verfügbar ist. Keine Instanziierung, kein Cloud-STT, kein Backend.

interface SpeechCapableWindow {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

// Akzeptiert bewusst `unknown`, damit der echte `window` (Window) ohne Cast übergeben werden kann;
// die Prüfung narrowt selbst auf die beiden optionalen Konstruktoren.
export function hasSpeechRecognition(win: unknown): boolean {
  if (!win || typeof win !== "object") {
    return false;
  }
  const w = win as SpeechCapableWindow;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
