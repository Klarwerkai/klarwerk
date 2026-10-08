// Prüfer-Zuweisung (aufnahme:20260922:gesamt-pruefer-zuweisung):
//   · R-0265 — Prüfer-Vorschlag aus der Historie beim Einreichen.
//   · R-0756 — offene und erledigte Prüfaufträge je Person in Auswertung und Adminbereich.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "prueferzuweisung.",
  legacySchluessel: [],
  de: {
    "prueferzuweisung.vorschlag.titel": "Vorgeschlagen",
    "prueferzuweisung.vorschlag.hinweis":
      "Abgeleitet aus Autorenschaft, früheren Prüfungen und Nähe im Wissensnetz zu Kategorie und Schlagworten. Zugewiesen wird erst, wenn du jemanden auswählst.",
    "prueferzuweisung.vorschlag.keiner": "Zu diesem Thema gibt es noch keinen Vorschlag.",
    "prueferzuweisung.vorschlag.fehler": "Der Vorschlag ist gerade nicht verfügbar.",
    "prueferzuweisung.grund.autorschaft": "schreibt zum Thema",
    "prueferzuweisung.grund.pruefungen": "hat zum Thema geprüft",
    "prueferzuweisung.grund.netznaehe": "nah im Wissensnetz",
    "prueferzuweisung.person.titel": "Prüfaufträge je Person",
    "prueferzuweisung.person.person": "Person",
    "prueferzuweisung.person.offen": "Offen",
    "prueferzuweisung.person.erledigt": "Erledigt",
    "prueferzuweisung.person.leer": "Noch keine Prüfaufträge zugewiesen.",
    "prueferzuweisung.person.unbekannt": "Unbekannte Person",
  },
  en: {
    "prueferzuweisung.vorschlag.titel": "Suggested",
    "prueferzuweisung.vorschlag.hinweis":
      "Derived from authorship, earlier reviews and closeness in the knowledge network to the category and tags. Nobody is assigned until you select them.",
    "prueferzuweisung.vorschlag.keiner": "No suggestion for this topic yet.",
    "prueferzuweisung.vorschlag.fehler": "The suggestion is not available right now.",
    "prueferzuweisung.grund.autorschaft": "writes on the topic",
    "prueferzuweisung.grund.pruefungen": "has reviewed the topic",
    "prueferzuweisung.grund.netznaehe": "close in the knowledge network",
    "prueferzuweisung.person.titel": "Review tasks per person",
    "prueferzuweisung.person.person": "Person",
    "prueferzuweisung.person.offen": "Open",
    "prueferzuweisung.person.erledigt": "Done",
    "prueferzuweisung.person.leer": "No review tasks assigned yet.",
    "prueferzuweisung.person.unbekannt": "Unknown person",
  },
  nl: {
    "prueferzuweisung.vorschlag.titel": "Voorgesteld",
    "prueferzuweisung.vorschlag.hinweis":
      "Afgeleid uit auteurschap, eerdere beoordelingen en nabijheid in het kennisnetwerk tot categorie en tags. Er wordt pas toegewezen als je iemand selecteert.",
    "prueferzuweisung.vorschlag.keiner": "Voor dit onderwerp is er nog geen voorstel.",
    "prueferzuweisung.vorschlag.fehler": "Het voorstel is op dit moment niet beschikbaar.",
    "prueferzuweisung.grund.autorschaft": "schrijft over het onderwerp",
    "prueferzuweisung.grund.pruefungen": "heeft het onderwerp beoordeeld",
    "prueferzuweisung.grund.netznaehe": "dichtbij in het kennisnetwerk",
    "prueferzuweisung.person.titel": "Beoordelingstaken per persoon",
    "prueferzuweisung.person.person": "Persoon",
    "prueferzuweisung.person.offen": "Open",
    "prueferzuweisung.person.erledigt": "Afgerond",
    "prueferzuweisung.person.leer": "Nog geen beoordelingstaken toegewezen.",
    "prueferzuweisung.person.unbekannt": "Onbekende persoon",
  },
} satisfies Textmodul;
