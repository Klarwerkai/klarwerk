// ================================================================================================
// LESEN-INHALT-ZUERST · die Texte der neuen Lesereihenfolge in Artikel und Arbeitsanleitung.
// ================================================================================================
//
// Auftrag `produkt:20261007:lesen-inhalt-zuerst`: Titel, Status und Inhalt stehen vorn; Kenntnisnahme,
// Herkunft, Beziehungen und Bearbeitung folgen nachgeordnet. Diese Datei trägt nur die NEUEN Sätze
// dafür — Gruppennamen im Bereich „Mehr", den Verweis auf eine angeforderte Kenntnisnahme, die
// zugeklappte Zeile für Anfordern/Übersicht und die Bearbeitungszeile einer freigegebenen Anleitung.
// Bestehende Schlüssel (`lib.lesen.*`, `ko.mehr.*`, `kenntnisnahme.*`, `fe001.*`) bleiben unverändert.
//
// ANREDE „du", wie die Lesefläche und die Arbeitsanleitungen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "lesereihenfolge.",
  legacySchluessel: [],
  de: {
    "lesereihenfolge.mehr.gruppe.quellen": "Quellen und Nachweise",
    "lesereihenfolge.mehr.gruppe.herkunft": "Herkunft und Verlauf",
    "lesereihenfolge.mehr.gruppe.zusammenarbeit": "Prüfung und Zusammenarbeit",
    "lesereihenfolge.mehr.gruppe.verknuepfungen": "Verknüpfungen",
    "lesereihenfolge.kenntnisnahme.offen": "Für diese Fassung ist deine Kenntnisnahme angefordert.",
    "lesereihenfolge.kenntnisnahme.zumBestaetigen": "Zur Kenntnisnahme unten",
    "lesereihenfolge.kenntnisnahme.verwalten": "Kenntnisnahme: anfordern und Übersicht",
    "lesereihenfolge.anleitung.bearbeiten": "Bearbeiten und Freigabe",
  },
  en: {
    "lesereihenfolge.mehr.gruppe.quellen": "Sources and evidence",
    "lesereihenfolge.mehr.gruppe.herkunft": "Origin and history",
    "lesereihenfolge.mehr.gruppe.zusammenarbeit": "Review and collaboration",
    "lesereihenfolge.mehr.gruppe.verknuepfungen": "Connections",
    "lesereihenfolge.kenntnisnahme.offen":
      "Your acknowledgement of this version has been requested.",
    "lesereihenfolge.kenntnisnahme.zumBestaetigen": "Go to acknowledgement below",
    "lesereihenfolge.kenntnisnahme.verwalten": "Acknowledgement: request and overview",
    "lesereihenfolge.anleitung.bearbeiten": "Edit and approval",
  },
  nl: {
    "lesereihenfolge.mehr.gruppe.quellen": "Bronnen en bewijs",
    "lesereihenfolge.mehr.gruppe.herkunft": "Herkomst en verloop",
    "lesereihenfolge.mehr.gruppe.zusammenarbeit": "Controle en samenwerking",
    "lesereihenfolge.mehr.gruppe.verknuepfungen": "Verbindingen",
    "lesereihenfolge.kenntnisnahme.offen": "Voor deze versie is jouw kennisname aangevraagd.",
    "lesereihenfolge.kenntnisnahme.zumBestaetigen": "Naar de kennisname hieronder",
    "lesereihenfolge.kenntnisnahme.verwalten": "Kennisname: aanvragen en overzicht",
    "lesereihenfolge.anleitung.bearbeiten": "Bewerken en goedkeuring",
  },
} satisfies Textmodul;
