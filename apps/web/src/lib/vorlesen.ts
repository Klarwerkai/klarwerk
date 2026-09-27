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

// Pedi 05.07. („die Voice ist furchtbar"): Die Browser-Standardstimme ist oft die schlechteste.
// Wir wählen die beste installierte Stimme je Sprache: Premium/Enhanced/Neural-Stimmen zuerst,
// dann Google-/Netzwerkstimmen, dann der Rest. Gibt es nur die Standardstimme, bleibt sie ehrlich
// die Grenze des Browsers — natürliche Stimmen kommen mit einem lokalen TTS-Server (Folge-Slice).
export function pickVoice(langPrefix: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (matching.length === 0) {
    return null;
  }
  const score = (v: SpeechSynthesisVoice): number =>
    (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) +
    (/google/i.test(v.name) ? 2 : 0) +
    (v.localService ? 0 : 1);
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
