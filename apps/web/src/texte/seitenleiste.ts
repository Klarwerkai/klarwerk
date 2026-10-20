// ================================================================================================
// MACOS-20261014 · MAC-03 (produkt:20261011:assistenz-minimalistische-oberflaeche r2) — DIE
// AUSBLENDBARE ARBEITSBEREICHSLEISTE DES HAUPTFENSTERS.
// ================================================================================================
//
// Texte der Leiste `shell/Arbeitsbereichsleiste.tsx`: ihr Name für Hilfstechnik und die beiden
// Knöpfe zum Aus- und Einblenden. Die Punkte selbst tragen die Namen aus `app/navigation.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "seitenleiste.",
  legacySchluessel: [],
  de: {
    "seitenleiste.navigation": "Arbeitsbereiche",
    "seitenleiste.ausblenden": "Seitenleiste ausblenden",
    "seitenleiste.einblenden": "Seitenleiste einblenden",
  },
  en: {
    "seitenleiste.navigation": "Work areas",
    "seitenleiste.ausblenden": "Hide sidebar",
    "seitenleiste.einblenden": "Show sidebar",
  },
  nl: {
    "seitenleiste.navigation": "Werkgebieden",
    "seitenleiste.ausblenden": "Zijbalk verbergen",
    "seitenleiste.einblenden": "Zijbalk tonen",
  },
} satisfies Textmodul;
