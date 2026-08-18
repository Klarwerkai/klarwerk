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

// ================================================================================================
// JOB 1111 / D-032 — DER VERGLEICHSSCHLÜSSEL: FORM NORMALISIEREN, BEDEUTUNG NIEMALS.
// ================================================================================================
//
// WOZU: Bis hierher entstand für jede gestellte Frage eine eigene Wissenslücke — auch für
// dieselbe Frage in anderer Schreibung. „Wie hoch ist der Wechselkurs?", „wie hoch ist der
// wechselkurs" und „WIE HOCH IST DER WECHSELKURS!!!" waren drei Einträge. Dieser Schlüssel ist
// die einzige Stelle, die darüber entscheidet, was als „dieselbe Frage" gilt.
//
// WAS ER TUT, in genau dieser Reihenfolge:
//   1. `normalizeGapQuestion` — Whitespace und Längenbegrenzung wie am gespeicherten Text. Der
//      Schlüssel erbt damit dieselbe Grenze; eine Frage und ihr Schlüssel driften nie auseinander.
//   2. Kleinschreibung über `toLowerCase()` — bewusst OHNE Locale. Eine gebietsabhängige
//      Umwandlung machte denselben Text je nach Serversprache zu zwei verschiedenen Schlüsseln.
//   3. Satzzeichen (`\p{P}`) werden durch ein LEERZEICHEN ersetzt, nicht ersatzlos gestrichen.
//      Das ist der Unterschied zwischen „Ventil-X" = „Ventil X" (richtig) und „Ventil-X" =
//      „VentilX" (falsch): Streichen verschmilzt Wörter, Ersetzen trennt sie sauber.
//   4. Whitespace erneut zusammenziehen und trimmen.
//
// WAS ER AUSDRÜCKLICH NICHT TUT — die Nicht-Ziele aus D-032, hier als Bauentscheidung:
//   · KEINE Ähnlichkeitssuche. „…beinhaltenm?" bleibt eine andere Frage als „…beinhalten?".
//     Tippfehler-Dubletten brauchen eine Schwellenentscheidung und sind ein eigener Auftrag.
//   · KEINE Mindestlänge. „BBK" behält den Schlüssel „bbk" und damit seine Lücke.
//   · KEINE Stammformen, keine Synonyme, keine Sprachnormierung. Rechenzeichen (`\p{S}`, also
//     `+`, `=`, `€`) bleiben stehen: „C++" und „C" sind verschiedene Fragen.
//   · KEINE Zeichensatzfaltung. „STRASSE" und „Straße" ergeben verschiedene Schlüssel — das ist
//     eine Bedeutungsfrage, keine Formfrage, und wird hier nicht geraten.
//
// DER LEERE SCHLÜSSEL IST KEIN SCHLÜSSEL: Eine Frage ohne Buchstaben („???") ergibt "". Der
// Aufrufer darf darauf NICHT zusammenführen — sonst fielen zwei verschiedene Zeichenfolgen über
// eine gemeinsame Leere zusammen. Die Prüfung darauf steht beim Aufrufer (`createGap`).
const SATZZEICHEN = /\p{P}/gu;

export function gapCompareKey(
  question: string,
  maxLength: number = MAX_GAP_QUESTION_LENGTH,
): string {
  return normalizeGapQuestion(question, maxLength)
    .toLowerCase()
    .replace(SATZZEICHEN, " ")
    .replace(/\s+/g, " ")
    .trim();
}
