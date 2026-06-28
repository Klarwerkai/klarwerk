// SCRUM-284: Gespeicherte Gap-Fragen datensparsam, lesbar und handhabbar halten.
// Reiner, deterministischer Helper — KEIN DOM, KEIN Service-State, KEINE PII-Erkennung/
// Schwärzung, KEINE semantische Analyse. Er trimmt, normalisiert Whitespace (inkl.
// Zeilenumbrüchen) und begrenzt sehr lange Freitexte/Kontext-Blobs auf eine lesbare
// Maximallänge mit Ellipse. Kurze, normale Fragen bleiben unverändert. Angewandt an EINER
// Stelle (createGap) → Risk und Capture erben automatisch den begrenzten gespeicherten Text.

export const MAX_GAP_QUESTION_LENGTH = 200;

const ELLIPSIS = "…";

// Whitespace zusammenziehen + trimmen; bei Überlänge deterministisch an Wortgrenze kürzen
// (letztes Leerzeichen im Fenster, sonst harter Schnitt) und Ellipse anhängen.
export function normalizeGapQuestion(
  question: string,
  maxLength: number = MAX_GAP_QUESTION_LENGTH,
): string {
  const collapsed = question.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  const window = collapsed.slice(0, maxLength);
  const lastSpace = window.lastIndexOf(" ");
  // Wortgrenze nur nutzen, wenn sie nicht zu früh liegt (sonst würde ein sehr langes Wort
  // die Frage zu stark verkürzen) — dann hart schneiden. Beides deterministisch.
  const cut = lastSpace > Math.floor(maxLength * 0.6) ? window.slice(0, lastSpace) : window;
  return `${cut.trimEnd()}${ELLIPSIS}`;
}
