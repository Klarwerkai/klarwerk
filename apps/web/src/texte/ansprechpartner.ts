// ================================================================================================
// R-1663 / R-2178 (aufnahme:20260922:gesamt-expertensuche) — BEGRÜNDETE ANSPRECHPARTNER ZU EINER
// WISSENSLÜCKE (components/LueckenAnsprechpartner.tsx).
// ================================================================================================
//
// Ein eigenes Textmodul statt neuer Einträge in `woerterbuch/{de,en,nl}.ts`: diese drei Dateien
// sind seit der Aufteilung Byte für Byte an `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`
// gebunden; neue Texte gehören hierher.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "ansprechpartner.",
  legacySchluessel: [],
  de: {
    "ansprechpartner.zeigen": "Ansprechpartner vorschlagen",
    "ansprechpartner.verbergen": "Vorschläge ausblenden",
    "ansprechpartner.titel": "Passende Ansprechpartner nach vorhandenen Wissensspuren",
    "ansprechpartner.hinweis":
      "Keine Bewertung und keine Rangfolge von Personen — nur, wo vorhandene Wissensspuren auf jemanden zeigen. Reihenfolge alphabetisch.",
    "ansprechpartner.laden": "Wissensspuren werden gelesen …",
    "ansprechpartner.fehler": "Die Vorschläge konnten nicht geladen werden.",
    "ansprechpartner.leer":
      "Zu dieser Frage zeigen keine sichtbaren Wissensspuren auf eine Person.",
    "ansprechpartner.grundlage":
      "Grundlage: passende sichtbare Wissensobjekte {{objekte}} · ähnliche geschlossene Lücken {{luecken}}",
    "ansprechpartner.zuweisen": "Zuweisen",
    "ansprechpartner.spur.originalautor_one": "Originalautor von {{count}} passenden Wissensobjekt",
    "ansprechpartner.spur.originalautor_other":
      "Originalautor von {{count}} passenden Wissensobjekten",
    "ansprechpartner.spur.erfasst_one": "hat {{count}} passendes Wissensobjekt erfasst",
    "ansprechpartner.spur.erfasst_other": "hat {{count}} passende Wissensobjekte erfasst",
    "ansprechpartner.spur.validiert_one": "hat {{count}} passendes Objekt validiert",
    "ansprechpartner.spur.validiert_other": "hat {{count}} passende Objekte validiert",
    "ansprechpartner.spur.pruefung_one":
      "war für {{count}} passendes Objekt zur Prüfung zugewiesen",
    "ansprechpartner.spur.pruefung_other":
      "war für {{count}} passende Objekte zur Prüfung zugewiesen",
    "ansprechpartner.spur.verantwortlich_one": "verantwortet {{count}} passendes Objekt",
    "ansprechpartner.spur.verantwortlich_other": "verantwortet {{count}} passende Objekte",
    "ansprechpartner.spur.aehnlicheLuecken_one":
      "war für {{count}} ähnliche, inzwischen geschlossene Wissenslücke zuständig",
    "ansprechpartner.spur.aehnlicheLuecken_other":
      "war für {{count}} ähnliche, inzwischen geschlossene Wissenslücken zuständig",
  },
  en: {
    "ansprechpartner.zeigen": "Suggest contacts",
    "ansprechpartner.verbergen": "Hide suggestions",
    "ansprechpartner.titel": "Suitable contacts based on existing knowledge traces",
    "ansprechpartner.hinweis":
      "No rating and no ranking of people — only where existing knowledge traces point to someone. Alphabetical order.",
    "ansprechpartner.laden": "Reading knowledge traces …",
    "ansprechpartner.fehler": "The suggestions could not be loaded.",
    "ansprechpartner.leer": "No visible knowledge traces point to a person for this question.",
    "ansprechpartner.grundlage":
      "Basis: matching visible knowledge objects {{objekte}} · similar closed gaps {{luecken}}",
    "ansprechpartner.zuweisen": "Assign",
    "ansprechpartner.spur.originalautor_one":
      "original author of {{count}} matching knowledge object",
    "ansprechpartner.spur.originalautor_other":
      "original author of {{count}} matching knowledge objects",
    "ansprechpartner.spur.erfasst_one": "captured {{count}} matching knowledge object",
    "ansprechpartner.spur.erfasst_other": "captured {{count}} matching knowledge objects",
    "ansprechpartner.spur.validiert_one": "validated {{count}} matching object",
    "ansprechpartner.spur.validiert_other": "validated {{count}} matching objects",
    "ansprechpartner.spur.pruefung_one": "was assigned to review {{count}} matching object",
    "ansprechpartner.spur.pruefung_other": "was assigned to review {{count}} matching objects",
    "ansprechpartner.spur.verantwortlich_one": "is responsible for {{count}} matching object",
    "ansprechpartner.spur.verantwortlich_other": "is responsible for {{count}} matching objects",
    "ansprechpartner.spur.aehnlicheLuecken_one":
      "was in charge of {{count}} similar, since closed knowledge gap",
    "ansprechpartner.spur.aehnlicheLuecken_other":
      "was in charge of {{count}} similar, since closed knowledge gaps",
  },
  nl: {
    "ansprechpartner.zeigen": "Aanspreekpunten voorstellen",
    "ansprechpartner.verbergen": "Voorstellen verbergen",
    "ansprechpartner.titel": "Passende aanspreekpunten op basis van bestaande kennissporen",
    "ansprechpartner.hinweis":
      "Geen beoordeling en geen rangorde van personen — alleen waar bestaande kennissporen naar iemand wijzen. Volgorde alfabetisch.",
    "ansprechpartner.laden": "Kennissporen worden gelezen …",
    "ansprechpartner.fehler": "De voorstellen konden niet worden geladen.",
    "ansprechpartner.leer": "Bij deze vraag wijzen geen zichtbare kennissporen naar een persoon.",
    "ansprechpartner.grundlage":
      "Basis: passende zichtbare kennisobjecten {{objekte}} · vergelijkbare gesloten hiaten {{luecken}}",
    "ansprechpartner.zuweisen": "Toewijzen",
    "ansprechpartner.spur.originalautor_one":
      "oorspronkelijke auteur van {{count}} passend kennisobject",
    "ansprechpartner.spur.originalautor_other":
      "oorspronkelijke auteur van {{count}} passende kennisobjecten",
    "ansprechpartner.spur.erfasst_one": "heeft {{count}} passend kennisobject vastgelegd",
    "ansprechpartner.spur.erfasst_other": "heeft {{count}} passende kennisobjecten vastgelegd",
    "ansprechpartner.spur.validiert_one": "heeft {{count}} passend object gevalideerd",
    "ansprechpartner.spur.validiert_other": "heeft {{count}} passende objecten gevalideerd",
    "ansprechpartner.spur.pruefung_one":
      "was voor {{count}} passend object als beoordelaar toegewezen",
    "ansprechpartner.spur.pruefung_other":
      "was voor {{count}} passende objecten als beoordelaar toegewezen",
    "ansprechpartner.spur.verantwortlich_one": "is verantwoordelijk voor {{count}} passend object",
    "ansprechpartner.spur.verantwortlich_other":
      "is verantwoordelijk voor {{count}} passende objecten",
    "ansprechpartner.spur.aehnlicheLuecken_one":
      "was verantwoordelijk voor {{count}} vergelijkbaar, inmiddels gesloten kennishiaat",
    "ansprechpartner.spur.aehnlicheLuecken_other":
      "was verantwoordelijk voor {{count}} vergelijkbare, inmiddels gesloten kennishiaten",
  },
} satisfies Textmodul;
