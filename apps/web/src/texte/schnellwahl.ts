// ================================================================================================
// R-0893 / R-1669 · SCHNELLWAHL — DIE WÖRTER DER WISSENSEINTRÄGE IN DER PALETTE (⌘K/Strg+K).
// ================================================================================================
//
// Auftrag aufnahme:20260922:gesamt-schnellwahl. Die Palette (`shell/CommandPalette.tsx`) zeigt ab
// zwei getippten Zeichen unter den Seiten bis zu fünf Wissenseinträge der Bibliothekssuche und als
// letzte Zeile die Schnellaktion „alle Treffer in der Bibliothek".
//   · wissenGruppe — Überschrift der Gruppe und erster Teil des Zielkontexts („Wissen › Kategorie")
//   · alleTreffer  — die Schnellaktion; `{{q}}` ist die Eingabe
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "schnellwahl.",
  legacySchluessel: [],
  de: {
    "schnellwahl.wissenGruppe": "Wissen",
    "schnellwahl.alleTreffer": "Alle Treffer zu „{{q}}“ in der Bibliothek",
  },
  en: {
    "schnellwahl.wissenGruppe": "Knowledge",
    "schnellwahl.alleTreffer": "All results for “{{q}}” in the library",
  },
  nl: {
    "schnellwahl.wissenGruppe": "Kennis",
    "schnellwahl.alleTreffer": "Alle resultaten voor „{{q}}” in de bibliotheek",
  },
} satisfies Textmodul;
