// ================================================================================================
// AUFNAHME 20260922 · BILDBESCHREIBUNG-BEDIENUNG (R-0899) — der Ladezustand der Großansicht.
// ================================================================================================
//
// R-0899: „Die Galerie zeigt ihren Ladezustand und lässt sich mit der Tastatur bedienen." Die
// Tastatur war belegt (Pfeiltasten, Escape, Fokusrückkehr); einen Ladezustand gab es nicht — die
// Großansicht stand leer, bis das Bild da war, und ein Bild, das nie kam, sah genauso aus.
// Diese zwei Texte nennen genau diese beiden Zustände (`components/BodyImageGallery.tsx`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bildergalerie.",
  legacySchluessel: [],
  de: {
    "bildergalerie.laedt": "Bild wird geladen …",
    "bildergalerie.ladefehler": "Das Bild konnte nicht geladen werden.",
  },
  en: {
    "bildergalerie.laedt": "Loading image …",
    "bildergalerie.ladefehler": "The image could not be loaded.",
  },
  nl: {
    "bildergalerie.laedt": "Afbeelding wordt geladen …",
    "bildergalerie.ladefehler": "De afbeelding kon niet worden geladen.",
  },
} satisfies Textmodul;
