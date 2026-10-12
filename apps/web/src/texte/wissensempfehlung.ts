// ================================================================================================
// R-1656 · „DU SOLLTEST AUCH WISSEN…" — die Texte der Empfehlung in der Lesespalte.
// ================================================================================================
//
// Jede Empfehlung nennt ihren Grund. „Zusammen gelesen" sagt ausdrücklich, dass nur das Paar
// gezählt wird und nicht die Person — dieselbe Zusage wie `services/app/src/wissensempfehlung.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissensempfehlung.",
  legacySchluessel: [],
  de: {
    "wissensempfehlung.titel": "Du solltest auch wissen…",
    "wissensempfehlung.hinweis":
      "Verwandte Einträge, jeweils mit dem Grund, warum sie hier stehen.",
    "wissensempfehlung.grund.mitgelesen_one": "{{count}}-mal zusammen mit diesem Eintrag gelesen",
    "wissensempfehlung.grund.mitgelesen_other": "{{count}}-mal zusammen mit diesem Eintrag gelesen",
    "wissensempfehlung.grund.thema": "Gemeinsame Schlagwörter: {{schlagwoerter}}",
    "wissensempfehlung.grund.konfliktOffen": "Offener Konflikt mit diesem Eintrag",
    "wissensempfehlung.grund.konfliktEntschieden": "Entschiedener Konflikt mit diesem Eintrag",
    "wissensempfehlung.oeffnen": "Öffnen",
    "wissensempfehlung.mehr": "Die {{shown}} stärksten von {{total}} Empfehlungen",
    "wissensempfehlung.datenschutz":
      "„Zusammen gelesen“ zählt nur, welche Einträge nacheinander geöffnet wurden — nicht von wem.",
  },
  en: {
    "wissensempfehlung.titel": "You should also know…",
    "wissensempfehlung.hinweis": "Related entries, each with the reason it appears here.",
    "wissensempfehlung.grund.mitgelesen_one": "Read together with this entry {{count}} time",
    "wissensempfehlung.grund.mitgelesen_other": "Read together with this entry {{count}} times",
    "wissensempfehlung.grund.thema": "Shared tags: {{schlagwoerter}}",
    "wissensempfehlung.grund.konfliktOffen": "Open conflict with this entry",
    "wissensempfehlung.grund.konfliktEntschieden": "Resolved conflict with this entry",
    "wissensempfehlung.oeffnen": "Open",
    "wissensempfehlung.mehr": "The {{shown}} strongest of {{total}} recommendations",
    "wissensempfehlung.datenschutz":
      "“Read together” only counts which entries were opened one after another — not by whom.",
  },
  nl: {
    "wissensempfehlung.titel": "Dit moet je ook weten…",
    "wissensempfehlung.hinweis": "Verwante items, elk met de reden waarom ze hier staan.",
    "wissensempfehlung.grund.mitgelesen_one": "{{count}} keer samen met dit item gelezen",
    "wissensempfehlung.grund.mitgelesen_other": "{{count}} keer samen met dit item gelezen",
    "wissensempfehlung.grund.thema": "Gedeelde tags: {{schlagwoerter}}",
    "wissensempfehlung.grund.konfliktOffen": "Open conflict met dit item",
    "wissensempfehlung.grund.konfliktEntschieden": "Beslist conflict met dit item",
    "wissensempfehlung.oeffnen": "Openen",
    "wissensempfehlung.mehr": "De {{shown}} sterkste van {{total}} aanbevelingen",
    "wissensempfehlung.datenschutz":
      "„Samen gelezen” telt alleen welke items na elkaar zijn geopend — niet door wie.",
  },
} satisfies Textmodul;
