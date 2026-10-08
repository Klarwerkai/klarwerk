// ================================================================================================
// Aufnahme `gesamt-ocr` (FR-CAP-05) — DER ERKANNTE BILDTEXT ALS KONTEXT DES GEFÜHRTEN INTERVIEWS.
// ================================================================================================
//
// Historisches Abnahmekriterium: „OCR-Text fließt in Strukturierung/Interview ein." In die
// Strukturierung floss er schon (die Erkennung hängt ihn an den Rohtext). Das Interview bekam nur
// die Antworten. Jetzt reist der erkannte Text als Kontext mit — aber nur, was der Mensch AUF KLICK
// erkannt hat, und nur, solange es noch im Rohtext steht: Wer den erkannten Block wieder löscht,
// schickt ihn auch nicht mehr ins Interview.

/** Ein auf Klick im Bild erkannter Text, mit dem Namen des Bildes. */
export interface ErkannterBildtext {
  readonly name: string;
  readonly text: string;
}

/** Der Kontext für das Interview — leer, wenn nichts Erkanntes mehr im Rohtext steht. */
export function interviewKontext(erkannt: readonly ErkannterBildtext[], raw: string): string {
  return erkannt
    .filter((e) => e.text.trim().length > 0 && raw.includes(e.text))
    .map((e) => `[${e.name}]\n${e.text}`)
    .join("\n\n");
}
