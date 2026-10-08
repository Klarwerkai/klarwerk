// ================================================================================================
// R-0179 / FR-EXT-01 (Aufnahme 20260922 · import-gesamtvertrag) · DIE BEFUNDÜBERSICHT DES IMPORTS.
// ================================================================================================
//
// Die sechs Befundarten unter den Pipeline-Schritten der Import-Seite
// (`components/ImportFindingsOverview.tsx`). Die Schlüssel der Arten sind die Werte von
// `IMPORT_FINDING_KINDS` (`lib/extConcept.ts`). „nicht ermittelt" steht für ein Signal, das nicht
// abrufbar war — nie für 0.
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
    "importbefunde.hint":
      "Widersprüche und Veraltet zählen nur übernommene Beiträge, deren Wissensobjekt in einem offenen Widerspruch steht oder erneut geprüft werden muss. Schützenswert heißt: Die Quelle meldet „vertraulich“ oder „streng vertraulich“ — eine eigene Bewertung von Firmenwissen gibt es nicht.",
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
    "importbefunde.hint":
      "Contradictions and outdated only count accepted items whose knowledge object is in an open contradiction or due for review again. Sensitive means: the source reports “confidential” or “strictly confidential” — there is no separate assessment of company know-how.",
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
    "importbefunde.hint":
      "Tegenstrijdigheden en verouderd tellen alleen overgenomen bijdragen waarvan het kennisobject in een open tegenstrijdigheid staat of opnieuw gecontroleerd moet worden. Beschermenswaardig betekent: de bron meldt „vertrouwelijk” of „strikt vertrouwelijk” — een eigen beoordeling van bedrijfskennis is er niet.",
  },
} satisfies Textmodul;
