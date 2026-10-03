// SCRUM-236: DOM-freie Feature-Detection für die Web-Speech-API (Diktat). Nimmt ein window-artiges
// Objekt entgegen (testbar ohne echten Browser) und meldet ehrlich, ob SpeechRecognition oder
// webkitSpeechRecognition verfügbar ist. Keine Instanziierung, kein Cloud-STT, kein Backend.

interface SpeechCapableWindow {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  navigator?: { userAgent?: string; maxTouchPoints?: number };
}

/**
 * iPhone, iPad, iPod — auch das iPad, das sich seit iPadOS 13 als „Macintosh" ausgibt und nur an
 * den Touchpunkten zu erkennen ist. Auf iOS sind ALLE Browser WebKit (auch Chrome = „CriOS").
 */
export function istIosGeraet(win: unknown): boolean {
  if (!win || typeof win !== "object") {
    return false;
  }
  const nav = (win as SpeechCapableWindow).navigator;
  const ua = nav?.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return true;
  }
  return /Macintosh/i.test(ua) && (nav?.maxTouchPoints ?? 0) > 1;
}

// Akzeptiert bewusst `unknown`, damit der echte `window` (Window) ohne Cast übergeben werden kann;
// die Prüfung narrowt selbst auf die beiden optionalen Konstruktoren.
//
// FR-CAP-03 („iOS friert nicht ein"): WebKit auf iOS meldet `webkitSpeechRecognition`, die Sitzung
// bleibt dort aber hängen — der Knopf stünde da und das Feld fröre ein. Auf iOS gilt das Diktat im
// Browser deshalb als NICHT verfügbar; die Flächen zeigen den ehrlichen Hinweis und verweisen auf
// das Mikrofon der Bildschirmtastatur (`capture.diktatIosTastatur`), das in jedes Textfeld schreibt.
export function hasSpeechRecognition(win: unknown): boolean {
  if (!win || typeof win !== "object") {
    return false;
  }
  if (istIosGeraet(win)) {
    return false;
  }
  const w = win as SpeechCapableWindow;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
