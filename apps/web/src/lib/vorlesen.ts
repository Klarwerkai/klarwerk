// ================================================================================================
// VORLESEN ÜBER DIE SPRACHAUSGABE DES BROWSERS — eine Quelle für Klara und das Seitentutorial.
// ================================================================================================
//
// Bis FE-003 standen beide Hilfen in `components/KlaraAssistant.tsx`. Das Seitentutorial (FE-003)
// liest seine Schritte auf Wunsch vor — mit derselben Stimmwahl und derselben Textbereinigung,
// nicht mit einer zweiten Abschrift. Es ist ausschliesslich `window.speechSynthesis`: kein
// externer, kein kostenpflichtiger Sprachdienst, und nichts startet ohne Klick.

/** Kann dieser Browser überhaupt vorlesen? Ohne Sprachausgabe bleibt jeder Inhalt als Text da. */
export function vorlesenMoeglich(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

// Ausschließlich ausdrücklich lokale Stimmen; keine Browser-Vorgabe und kein Netzfallback.
export function pickVoice(langPrefix: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const matching = voices.filter(
    (v) => v.localService === true && v.lang.toLowerCase().startsWith(langPrefix),
  );
  if (matching.length === 0) {
    return null;
  }
  const score = (v: SpeechSynthesisVoice): number =>
    /premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0;
  return [...matching].sort((a, b) => score(b) - score(a))[0] ?? null;
}

// Text fürs Vorlesen bereinigen: Satzzeichen-Symbole und Pfeile werden gesprochen scheußlich.
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[„“”«»]/g, "")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*→\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jede tatsächliche Ausgabe muss eine ausdrücklich lokale Stimme tragen. */
export function sprecheLokal(u: SpeechSynthesisUtterance): boolean {
  const voice = pickVoice(u.lang.slice(0, 2).toLowerCase());
  if (!voice) {
    window.alert("Keine lokale Stimme verfügbar. Der Text bleibt zum Lesen verfügbar.");
    return false;
  }
  u.voice = voice;
  window.speechSynthesis.speak(u);
  return true;
}
