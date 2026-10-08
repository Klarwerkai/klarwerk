// ================================================================================================
// R-1628 (aufnahme:20260922:gesamt-was-waere-wenn) · WAS WÄRE, WENN SICH EINE BEDINGUNG ÄNDERT?
// ================================================================================================
//
// Die Texte der Gegenüberstellung auf der Fragen-Seite: „statt bisher jetzt neu" — welche
// Wissensobjekte an die bisherige Bedingung gebunden sind, welche beide oder schon die neue nennen
// und welche keine von beiden. Regel: apps/web/src/lib/bedingungswechsel.ts.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bedingungswechsel.",
  legacySchluessel: [],
  de: {
    "bedingungswechsel.titel": "Was wäre, wenn sich eine Bedingung ändert?",
    "bedingungswechsel.zu": "einblenden",
    "bedingungswechsel.offen": "ausblenden",
    "bedingungswechsel.feld.bisher": "Statt (bisher)",
    "bedingungswechsel.feld.neu": "jetzt (neu)",
    "bedingungswechsel.feld.thema": "Nur zum Thema (optional)",
    "bedingungswechsel.beispiel": "z. B. statt 5083-H111 jetzt 6082-T6",
    "bedingungswechsel.hinweis":
      "Ohne KI und ohne Vermutung: verglichen wird nur, was die Wissensobjekte selbst als Bedingung, im Titel, in der Aussage oder als Schlagwort nennen. Die Fundstelle steht dabei — ein Treffer ist eine Textstelle, keine fachliche Bewertung.",
    "bedingungswechsel.laedt": "Der Bestand wird geladen …",
    "bedingungswechsel.fehler":
      "Der Bestand konnte nicht geladen werden — es gibt nichts zu vergleichen.",
    "bedingungswechsel.unvollstaendig": "Bitte die bisherige und die neue Bedingung angeben.",
    "bedingungswechsel.gleich":
      "Bisherige und neue Bedingung sind gleich — es gibt nichts zu vergleichen.",
    "bedingungswechsel.lage.nur_bisher": "An „{{bisher}}“ gebunden — für „{{neu}}“ nicht belegt",
    "bedingungswechsel.lage.beide": "Für beide festgehalten — übertragbar belegt",
    "bedingungswechsel.lage.nur_neu": "Schon für „{{neu}}“ festgehalten",
    "bedingungswechsel.lage.keine":
      "Nennt keine der beiden — ob es unter „{{neu}}“ gilt, hält der Bestand nicht fest",
    "bedingungswechsel.leer": "Keine",
    "bedingungswechsel.ohneNennung_one":
      "{{count}} weiteres Wissensobjekt nennt keine der beiden Bedingungen; ob es unter „{{neu}}“ gilt, hält der Bestand nicht fest. Mit einem Thema wird es einzeln gezeigt.",
    "bedingungswechsel.ohneNennung_other":
      "{{count}} weitere Wissensobjekte nennen keine der beiden Bedingungen; ob sie unter „{{neu}}“ gelten, hält der Bestand nicht fest. Mit einem Thema werden sie einzeln gezeigt.",
    "bedingungswechsel.fundort.bedingung": "Bedingung",
    "bedingungswechsel.fundort.titel": "Titel",
    "bedingungswechsel.fundort.aussage": "Aussage",
    "bedingungswechsel.fundort.schlagwort": "Schlagwort",
  },
  en: {
    "bedingungswechsel.titel": "What if a condition changes?",
    "bedingungswechsel.zu": "show",
    "bedingungswechsel.offen": "hide",
    "bedingungswechsel.feld.bisher": "Instead of (so far)",
    "bedingungswechsel.feld.neu": "now (new)",
    "bedingungswechsel.feld.thema": "Only on the topic (optional)",
    "bedingungswechsel.beispiel": "e.g. instead of 5083-H111 now 6082-T6",
    "bedingungswechsel.hinweis":
      "No AI and no guessing: only what the knowledge objects themselves state as a condition, in the title, in the statement or as a tag is compared. The location is shown — a match is a text passage, not a technical assessment.",
    "bedingungswechsel.laedt": "Loading the knowledge base …",
    "bedingungswechsel.fehler":
      "The knowledge base could not be loaded — there is nothing to compare.",
    "bedingungswechsel.unvollstaendig": "Please enter the current and the new condition.",
    "bedingungswechsel.gleich":
      "The current and the new condition are the same — there is nothing to compare.",
    "bedingungswechsel.lage.nur_bisher": "Tied to “{{bisher}}” — not documented for “{{neu}}”",
    "bedingungswechsel.lage.beide": "Documented for both — transferability documented",
    "bedingungswechsel.lage.nur_neu": "Already documented for “{{neu}}”",
    "bedingungswechsel.lage.keine":
      "Names neither — the knowledge base does not record whether it applies under “{{neu}}”",
    "bedingungswechsel.leer": "None",
    "bedingungswechsel.ohneNennung_one":
      "{{count}} more knowledge object names neither condition; the knowledge base does not record whether it applies under “{{neu}}”. With a topic it is listed individually.",
    "bedingungswechsel.ohneNennung_other":
      "{{count}} more knowledge objects name neither condition; the knowledge base does not record whether they apply under “{{neu}}”. With a topic they are listed individually.",
    "bedingungswechsel.fundort.bedingung": "Condition",
    "bedingungswechsel.fundort.titel": "Title",
    "bedingungswechsel.fundort.aussage": "Statement",
    "bedingungswechsel.fundort.schlagwort": "Tag",
  },
  nl: {
    "bedingungswechsel.titel": "Wat als een voorwaarde verandert?",
    "bedingungswechsel.zu": "tonen",
    "bedingungswechsel.offen": "verbergen",
    "bedingungswechsel.feld.bisher": "In plaats van (tot nu toe)",
    "bedingungswechsel.feld.neu": "nu (nieuw)",
    "bedingungswechsel.feld.thema": "Alleen over het onderwerp (optioneel)",
    "bedingungswechsel.beispiel": "bijv. in plaats van 5083-H111 nu 6082-T6",
    "bedingungswechsel.hinweis":
      "Zonder AI en zonder gissen: vergeleken wordt alleen wat de kennisobjecten zelf als voorwaarde, in de titel, in de bewering of als trefwoord noemen. De vindplaats staat erbij — een treffer is een tekstpassage, geen inhoudelijke beoordeling.",
    "bedingungswechsel.laedt": "De kennisbank wordt geladen …",
    "bedingungswechsel.fehler":
      "De kennisbank kon niet worden geladen — er is niets te vergelijken.",
    "bedingungswechsel.unvollstaendig": "Vul de huidige en de nieuwe voorwaarde in.",
    "bedingungswechsel.gleich":
      "De huidige en de nieuwe voorwaarde zijn gelijk — er is niets te vergelijken.",
    "bedingungswechsel.lage.nur_bisher":
      "Gebonden aan „{{bisher}}” — voor „{{neu}}” niet vastgelegd",
    "bedingungswechsel.lage.beide": "Voor beide vastgelegd — overdraagbaarheid vastgelegd",
    "bedingungswechsel.lage.nur_neu": "Al vastgelegd voor „{{neu}}”",
    "bedingungswechsel.lage.keine":
      "Noemt geen van beide — of het onder „{{neu}}” geldt, legt de kennisbank niet vast",
    "bedingungswechsel.leer": "Geen",
    "bedingungswechsel.ohneNennung_one":
      "{{count}} ander kennisobject noemt geen van beide voorwaarden; of het onder „{{neu}}” geldt, legt de kennisbank niet vast. Met een onderwerp wordt het afzonderlijk getoond.",
    "bedingungswechsel.ohneNennung_other":
      "{{count}} andere kennisobjecten noemen geen van beide voorwaarden; of ze onder „{{neu}}” gelden, legt de kennisbank niet vast. Met een onderwerp worden ze afzonderlijk getoond.",
    "bedingungswechsel.fundort.bedingung": "Voorwaarde",
    "bedingungswechsel.fundort.titel": "Titel",
    "bedingungswechsel.fundort.aussage": "Bewering",
    "bedingungswechsel.fundort.schlagwort": "Trefwoord",
  },
} satisfies Textmodul;
