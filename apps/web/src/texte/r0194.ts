// ================================================================================================
// R-0194 · ÄHNLICHKEITSPRÜFSUMMEN — die Kandidatenquelle auf der Vergleichsseite (DuplicateCompare).
// ================================================================================================
//
// Die Prüfansicht nennt, aus welcher Quelle ein Kandidat stammt (Metadaten, Text, Prüfsumme,
// Abschnitt). Die Quelle schlägt nur vor — sie urteilt nicht; entschieden wird auf dem Brett.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "r0194.",
  legacySchluessel: [],
  de: {
    "r0194.quelle.label": "Kandidatenquelle: {{quellen}}",
    "r0194.quelle.metadaten": "Metadaten",
    "r0194.quelle.text": "Text",
    "r0194.quelle.pruefsumme": "Prüfsumme",
    "r0194.quelle.abschnitt": "Abschnitt",
    "r0194.quelle.manuell": "Kandidatenquelle: von Hand gemeldet",
    "r0194.quelle.hinweis":
      "Die Kandidatenquelle sagt nur, wie das Paar zur Prüfung kam; sie ist kein Urteil. Ob es ein Duplikat ist, entscheidest du auf dem Brett „{{brett}}“.",
  },
  en: {
    "r0194.quelle.label": "Candidate source: {{quellen}}",
    "r0194.quelle.metadaten": "Metadata",
    "r0194.quelle.text": "Text",
    "r0194.quelle.pruefsumme": "Checksum",
    "r0194.quelle.abschnitt": "Section",
    "r0194.quelle.manuell": "Candidate source: reported by hand",
    "r0194.quelle.hinweis":
      "The candidate source only says how the pair came up for review; it is not a verdict. Whether it is a duplicate is decided by you on the “{{brett}}” board.",
  },
  nl: {
    "r0194.quelle.label": "Kandidaatbron: {{quellen}}",
    "r0194.quelle.metadaten": "Metadata",
    "r0194.quelle.text": "Tekst",
    "r0194.quelle.pruefsumme": "Controlesom",
    "r0194.quelle.abschnitt": "Sectie",
    "r0194.quelle.manuell": "Kandidaatbron: handmatig gemeld",
    "r0194.quelle.hinweis":
      "De kandidaatbron zegt alleen hoe het paar ter beoordeling kwam; het is geen oordeel. Of het een duplicaat is, beslis je op het bord „{{brett}}“.",
  },
} satisfies Textmodul;
