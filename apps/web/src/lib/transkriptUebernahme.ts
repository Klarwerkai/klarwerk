// R-0165 (Bens Befund 10.10.) — DAS TRANSKRIPT LANDET DORT, WO DER MENSCH SCHREIBT.
//
// Bis hierher hängte `onTranscribe` (pages/Capture.tsx) das Transkript IMMER an den Rohtext und
// meldete danach „übernommen". Im Formular ist der Rohtext aber gar nicht zu sehen — dort steht das
// Feld „Aussage" (`draft.statement`). Gemessen mit einem echten Anbieter: Erfolgsmeldung, leeres
// Formular. Diese Datei entscheidet an EINER Stelle, welches Feld das Ziel ist, und wie angehängt
// wird; die Fläche koppelt ihre Meldung an genau diese Übernahme.
import type { CaptureMode } from "./captureEntry";
import { isExpertMode } from "./captureEntry";

/** Welches sichtbare Feld das Transkript aufnimmt. */
export type TranskriptZiel = "aussage" | "rohtext";

/**
 * Formular (Expertenweg) → Feld „Aussage". Jeder Erzählmodus → Rohtext, wie bisher; dort ist der
 * Rohtext das Schreibfeld (Freitext, Diktat) bzw. die Eingabe, aus der strukturiert wird.
 */
export function transkriptZiel(mode: CaptureMode): TranskriptZiel {
  return isExpertMode(mode) ? "aussage" : "rohtext";
}

/**
 * Hängt erkannten Text mit Quellvermerk `[<art>: <quelle>]` an vorhandenen Text an. Vorhandener
 * Inhalt bleibt Zeichen für Zeichen stehen; ein leeres Feld beginnt direkt mit dem Quellvermerk.
 */
function mitQuellvermerk(vorher: string, art: string, quelle: string, text: string): string {
  const block = `[${art}: ${quelle}]\n${text}`;
  return vorher.trim() ? `${vorher}\n\n${block}` : block;
}

/** Transkript aus Audio/Video (SCRUM-382). */
export function mitTranskript(vorher: string, quelle: string, transkript: string): string {
  return mitQuellvermerk(vorher, "Transkript", quelle, transkript);
}

// R-1688/R-1733 (Bens Befund 10.10., Nacharbeit 2): die Bild-OCR hatte denselben Fehler — sie
// schrieb nur in den Rohtext und meldete im Formular eine Übernahme bei unveränderter Aussage. Sie
// nimmt jetzt dasselbe Ziel (`transkriptZiel`) und denselben Anhängeweg; nur der Vermerk heißt `OCR`.
/** Erkannter Bildtext (SCRUM-123). */
export function mitOcrText(vorher: string, quelle: string, text: string): string {
  return mitQuellvermerk(vorher, "OCR", quelle, text);
}
