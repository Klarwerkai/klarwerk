// ================================================================================================
// AUFNAHME 20260922 · WISSENSARTEN, METADATEN UND KANONISCHE ANLAGENBEZÜGE
// (aufnahme:20260922:gesamt-wissen-metadaten) — die Texte dieses Auftrags.
// ================================================================================================
//
// Das Fachgebiet beim Erfassen und nachträglich in der Leseansicht (R-0034, R-0056, R-0465,
// FR-CAP-08), die Art der Aussage — Tatsache oder Handlungsanweisung (R-0086) — sowie die Anlage
// als Facette der Bibliothek und als kanonische Angabe im Abschnitt „Kopplung und Anlagen"
// (R-0082, R-0477). Das Fachgebiet steht NEBEN der Kategorie; die
// Facettenbezeichnung „Fachgebiet" (`lib.facet.domain`) wohnt unverändert in `suchraum.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissensmetadaten.",
  legacySchluessel: [],
  de: {
    "wissensmetadaten.fachgebiet.feld": "Fachgebiet",
    "wissensmetadaten.fachgebiet.platzhalter": "z. B. Instandhaltung, Qualität",
    "wissensmetadaten.fachgebiet.keins": "Kein Fachgebiet angegeben",
    "wissensmetadaten.fachgebiet.speichern": "Fachgebiet speichern",
    "wissensmetadaten.anlage.facette": "Anlage",
    "wissensmetadaten.anlage.kanonisch": "Anlage am Wissensobjekt",
    "wissensmetadaten.anlage.keine": "Keine Anlage angegeben",
    "wissensmetadaten.anlage.kopplungen": "Für Änderungsmeldungen gekoppelt",
    "wissensmetadaten.aussageart.feld": "Art der Aussage",
    "wissensmetadaten.aussageart.ohne": "Nicht angegeben",
    "wissensmetadaten.aussageart.tatsache": "Tatsache",
    "wissensmetadaten.aussageart.handlungsanweisung": "Handlungsanweisung",
  },
  en: {
    "wissensmetadaten.fachgebiet.feld": "Domain",
    "wissensmetadaten.fachgebiet.platzhalter": "e.g. maintenance, quality",
    "wissensmetadaten.fachgebiet.keins": "No domain given",
    "wissensmetadaten.fachgebiet.speichern": "Save domain",
    "wissensmetadaten.anlage.facette": "Equipment",
    "wissensmetadaten.anlage.kanonisch": "Equipment of this knowledge object",
    "wissensmetadaten.anlage.keine": "No equipment given",
    "wissensmetadaten.anlage.kopplungen": "Coupled for change notices",
    "wissensmetadaten.aussageart.feld": "Kind of statement",
    "wissensmetadaten.aussageart.ohne": "Not specified",
    "wissensmetadaten.aussageart.tatsache": "Fact",
    "wissensmetadaten.aussageart.handlungsanweisung": "Instruction",
  },
  nl: {
    "wissensmetadaten.fachgebiet.feld": "Vakgebied",
    "wissensmetadaten.fachgebiet.platzhalter": "bijv. onderhoud, kwaliteit",
    "wissensmetadaten.fachgebiet.keins": "Geen vakgebied opgegeven",
    "wissensmetadaten.fachgebiet.speichern": "Vakgebied opslaan",
    "wissensmetadaten.anlage.facette": "Installatie",
    "wissensmetadaten.anlage.kanonisch": "Installatie van dit kennisobject",
    "wissensmetadaten.anlage.keine": "Geen installatie opgegeven",
    "wissensmetadaten.anlage.kopplungen": "Gekoppeld voor wijzigingsmeldingen",
    "wissensmetadaten.aussageart.feld": "Soort uitspraak",
    "wissensmetadaten.aussageart.ohne": "Niet opgegeven",
    "wissensmetadaten.aussageart.tatsache": "Feit",
    "wissensmetadaten.aussageart.handlungsanweisung": "Handelingsinstructie",
  },
} satisfies Textmodul;
