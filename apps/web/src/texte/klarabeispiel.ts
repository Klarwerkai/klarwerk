// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0941 — DIE BESCHRIFTUNG DES BEISPIELS IN KLARAS ELEMENTERKLÄRUNG.
// ================================================================================================
//
// Die Beispiele selbst hängen an der Kennung des Elements und liegen in `lib/klaraBeispiele.ts`.
// Hier steht nur das Wort davor — es wird auch vorgelesen („… Beispiel: …").
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klarabeispiel.",
  legacySchluessel: [],
  de: {
    "klarabeispiel.titel": "Beispiel",
  },
  en: {
    "klarabeispiel.titel": "Example",
  },
  nl: {
    "klarabeispiel.titel": "Voorbeeld",
  },
} satisfies Textmodul;
