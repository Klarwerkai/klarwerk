// ================================================================================================
// R-0179 / FR-EXT-01 (Aufnahme 20260922 · import-gesamtvertrag) · DIE BEFUNDÜBERSICHT DES IMPORTS.
// ================================================================================================
//
// Die sechs Befundarten unter den Pipeline-Schritten der Import-Seite
// (`components/ImportFindingsOverview.tsx`). Die Schlüssel der Arten sind die Werte von
// `IMPORT_FINDING_KINDS` (`lib/extConcept.ts`). „nicht ermittelt" steht für ein Signal, das nicht
// abrufbar war; „nicht bewertet" zählt Kandidaten, die für eine Art nicht bewertet werden konnten
// (Nacharbeit 3) — beides ist nie dasselbe wie 0.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "importbefunde.",
  legacySchluessel: [],
  de: {
    "importbefunde.title": "Befunde",
    "importbefunde.candidates": "Kandidaten",
    "importbefunde.conflicts": "Widersprüche",
    "importbefunde.missing": "Angaben fehlen",
    "importbefunde.outdated": "Veraltet",
    "importbefunde.duplicates": "Dubletten",
    "importbefunde.protected": "Schützenswert",
    "importbefunde.notDetermined": "nicht ermittelt",
    "importbefunde.notAssessed": "{{n}} nicht bewertet",
    "importbefunde.hint":
      "Veraltet: Der Stand der Quelle liegt über ein Jahr zurück, oder das übernommene Wissen muss erneut geprüft werden. Schützenswert: Die Quelle stuft vertraulich ein oder beschränkt das Lesen, der Text enthält Personalnummern oder Kontodaten, oder er trägt eine Kennzeichnung wie „vertraulich“ oder „Betriebsgeheimnis“. Widersprüche zählen nur übernommene Beiträge. „Nicht bewertet“ heißt: Für diesen Beitrag fehlte die Grundlage, etwa der Stand der Quelle.",
  },
  en: {
    "importbefunde.title": "Findings",
    "importbefunde.candidates": "Candidates",
    "importbefunde.conflicts": "Contradictions",
    "importbefunde.missing": "Missing details",
    "importbefunde.outdated": "Outdated",
    "importbefunde.duplicates": "Duplicates",
    "importbefunde.protected": "Sensitive",
    "importbefunde.notDetermined": "not determined",
    "importbefunde.notAssessed": "{{n}} not assessed",
    "importbefunde.hint":
      "Outdated: the source was last changed more than a year ago, or the accepted knowledge is due for review again. Sensitive: the source classifies it as confidential or restricts reading, the text contains personnel numbers or bank details, or it carries a marking such as “confidential” or “trade secret”. Contradictions only count accepted items. “Not assessed” means the basis was missing for this item, for example the source date.",
  },
  nl: {
    "importbefunde.title": "Bevindingen",
    "importbefunde.candidates": "Kandidaten",
    "importbefunde.conflicts": "Tegenstrijdigheden",
    "importbefunde.missing": "Gegevens ontbreken",
    "importbefunde.outdated": "Verouderd",
    "importbefunde.duplicates": "Duplicaten",
    "importbefunde.protected": "Beschermenswaardig",
    "importbefunde.notDetermined": "niet bepaald",
    "importbefunde.notAssessed": "{{n}} niet beoordeeld",
    "importbefunde.hint":
      "Verouderd: de bron is meer dan een jaar geleden voor het laatst gewijzigd, of de overgenomen kennis moet opnieuw gecontroleerd worden. Beschermenswaardig: de bron stuft het als vertrouwelijk in of beperkt het lezen, de tekst bevat personeelsnummers of bankgegevens, of draagt een Duitse of Engelse markering zoals „vertraulich”, „confidential” of „trade secret”. Tegenstrijdigheden tellen alleen overgenomen bijdragen. „Niet beoordeeld” betekent: voor deze bijdrage ontbrak de basis, bijvoorbeeld de datum van de bron.",
  },
} satisfies Textmodul;
