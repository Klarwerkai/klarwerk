// ================================================================================================
// produkt:20261010:fragen-pruefen-einstieg — DER LEERE FRAGENZUSTAND SAGT, WAS ALS ERSTES ZU TUN IST.
// ================================================================================================
//
// Live beobachtet (Auftrag, user_value): die leere Fragenansicht erklärte ihren Einstieg kaum, und
// die zugeklappten Angaben „Ich frage für" und „Was wäre, wenn" standen gleichrangig vor dem Feld.
// Diese Datei entscheidet DOM-frei zwei Dinge:
//
//   · WANN der Einstieg steht: nur solange die Fläche leer ist — keine Antwort, kein Abruf, kein
//     Fehler, kein Gesprächsfaden, keine aufgenommene Arbeit. Sobald etwas davon da ist, trägt die
//     Fläche ihren eigenen nächsten Schritt (Antwortvertrag), und ein zweiter Satz wäre die
//     Doppelung, die `tests/app/mega54-ein-naechster-schritt-sammler.test.ts` ausschliesst.
//   · WELCHES Beispiel fiktiv ist: die festen Beispiele aus `askExamples.ts` (Ventil X, Pflege,
//     Verein) sind erfundene Lagen; Vorschläge aus dem validierten Bestand sind es NICHT und werden
//     deshalb nicht so gekennzeichnet — „fiktiv" an einer echten Bestandsfrage wäre falsch.
//
// Nichts hier sendet, schaltet die KI frei oder ändert einen Prüfstand.
import type { AskExampleChip } from "./askExampleChips";

export interface FragenEinstiegLage {
  /** Eine Antwort oder Lücke steht auf der Fläche. */
  hatErgebnis: boolean;
  /** Ein Abruf läuft (auch pausiert/offline). */
  wartet: boolean;
  /** Der letzte Abruf ist gescheitert — der Fehlerkasten steht. */
  fehler: boolean;
  /** Anzahl der Fragen im Gesprächsfaden. */
  fadenLaenge: number;
  /** Aufgenommene Arbeit (Entwurf/Antwort) wird oben schon benannt. */
  wiederaufnahme: boolean;
}

export function zeigeFragenEinstieg(lage: FragenEinstiegLage): boolean {
  return (
    !lage.hatErgebnis &&
    !lage.wartet &&
    !lage.fehler &&
    lage.fadenLaenge === 0 &&
    !lage.wiederaufnahme
  );
}

/** Fest hinterlegte Beispiele sind erfundene Lagen; Bestandsvorschläge nicht. */
export function beispielIstFiktiv(chip: AskExampleChip): boolean {
  return chip.kind === "example";
}

/** Gibt es unter den angebotenen Beispielen mindestens ein fiktives? */
export function hatFiktiveBeispiele(chips: readonly AskExampleChip[]): boolean {
  return chips.some(beispielIstFiktiv);
}

export const FRAGEN_EINSTIEG_KEYS = {
  erklaerung: "fragenEinstieg.erklaerung",
  ersterSchritt: "fragenEinstieg.ersterSchritt",
  beispieleZeigen: "fragenEinstieg.beispieleZeigen",
  beispieleVerbergen: "fragenEinstieg.beispieleVerbergen",
  fiktiv: "fragenEinstieg.fiktiv",
  fiktivTitel: "fragenEinstieg.fiktivTitel",
  optionalTitel: "fragenEinstieg.optionalTitel",
} as const;
