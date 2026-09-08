// JOB 3235 (UX-18-R2) — DER KERN EINES KACHELNAMENS. Geteilt von den zwei Waechtern in diesem
// Ordner (Woerterbuch-Fall und gemounteter Fall), damit beide DIESELBE Regel messen und nicht zwei
// leicht auseinanderlaufende Fassungen davon.
//
// WOZU ER SCHAERFER IST ALS EIN ZEICHENVERGLEICH: „Word-Datei" und „Word (.docx)" waren nie
// zeichengleich und trotzdem verwechselbar — beide benannten eine WORD-DATEI. Gemessen wird
// deshalb, was von einem Namen uebrig bleibt, wenn man den Klammerzusatz und das Dateiwort abzieht.
// Bleibt derselbe Rest, meinen beide Kacheln dasselbe Ding.
//
// DER KLAMMERZUSATZ ZAEHLT BEWUSST NICHT MIT: „Word (Anbindung)" gegenueber „Word (.docx)" waere
// keine Unterscheidung, sondern eine Fussnote. Der Unterschied muss im NAMEN stehen.

// Woerter, die eine Kachel nur als DATEI ausweisen und deshalb nicht als Unterscheidung zaehlen.
// Sprachuebergreifend in EINER Menge: eine neue Sprache wird dadurch hoechstens milder geprueft,
// nie faelschlich rot.
const DATEIWORT = new Set(["datei", "dateien", "file", "files", "bestand", "bestanden"]);

/**
 * Der Kern eines Anzeigenamens: klein geschrieben, ohne Klammerzusatz, ohne Dateiwort, ohne
 * Trennzeichen. „Word-Datei" → „word" · „Word (.docx)" → „word" · „Word-Dokumentquelle
 * (Anbindung)" → „worddokumentquelle" · „MS Teams" → „msteams".
 */
export function kernDesNamens(name: string): string {
  return name
    .replace(/\([^()]*\)/g, " ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((wort) => wort.length > 0 && !DATEIWORT.has(wort))
    .join("");
}
