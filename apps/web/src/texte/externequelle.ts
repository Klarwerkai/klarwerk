// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung (R-0205) · DAS ETIKETT „STUFE 2".
// ================================================================================================
//
// Jede externe Quelle trägt sichtbar das Etikett „Stufe 2": sie stützt das Wissen, ersetzt aber
// keine einzige Prüfstimme. Gezeichnet wird es von `components/ko/ExterneQuelleKennung.tsx`, neben
// dem Herkunfts-Hinweis `ko.sourceExternUnchecked` („Extern · ungeprüft"), der im Grundbestand
// bleibt (F-0205, `tests/app/f0205-extern-ungeprueft-chip.test.tsx`).
//
// „Stufe 2" ist im Haus AUCH der Name der erweiterten Module (`role.stage2`). Die Erklärung sagt
// deshalb ausdrücklich, welche Stufe gemeint ist: die Belegstufe einer Quelle, nicht ein Modul.
// Wortlaut der Sprachen wie `vhelp.sourcesLevel2.title` (Stufe 2 / level 2 / niveau 2).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "externequelle.",
  legacySchluessel: [],
  de: {
    "externequelle.stufe": "Stufe 2",
    "externequelle.erklaerung":
      "Externe Quelle, Belegstufe 2: Sie stützt das Wissen, ersetzt aber keine einzige Prüfstimme.",
  },
  en: {
    "externequelle.stufe": "Level 2",
    "externequelle.erklaerung":
      "External source, evidence level 2: it supports the knowledge but replaces not a single review vote.",
  },
  nl: {
    "externequelle.stufe": "Niveau 2",
    "externequelle.erklaerung":
      "Externe bron, bewijsniveau 2: ondersteunt de kennis, maar vervangt geen enkele beoordelingsstem.",
  },
} satisfies Textmodul;
