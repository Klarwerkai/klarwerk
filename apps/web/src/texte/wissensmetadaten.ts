// ================================================================================================
// AUFNAHME 20260922 · WISSENSARTEN, METADATEN UND KANONISCHE ANLAGENBEZÜGE
// (aufnahme:20260922:gesamt-wissen-metadaten) — die Texte dieses Auftrags.
// ================================================================================================
//
// Das Fachgebiet beim Erfassen und nachträglich in der Leseansicht (R-0034, R-0056, R-0465,
// FR-CAP-08), die Art der Aussage — Tatsache oder Handlungsanweisung (R-0086) —, der
// Re-Validierungstermin beim Erfassen (R-1690) sowie die Anlagen: mehrere je Objekt, als Facette
// der Bibliothek, als kanonische Liste im Abschnitt „Kopplung und Anlagen" und als Matrix
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
    "wissensmetadaten.anlage.keine": "Keine Anlage angegeben",
    "wissensmetadaten.anlage.kopplungen": "Für Änderungsmeldungen gekoppelt",
    "wissensmetadaten.aussageart.feld": "Art der Aussage",
    "wissensmetadaten.aussageart.ohne": "Nicht angegeben",
    "wissensmetadaten.aussageart.tatsache": "Tatsache",
    "wissensmetadaten.aussageart.handlungsanweisung": "Handlungsanweisung",
    "wissensmetadaten.anlage.mehrere": "Mehrere Anlagen mit ; trennen (; in einer Kennung: \\;)",
    "wissensmetadaten.anlage.liste": "Anlagen am Wissensobjekt",
    "wissensmetadaten.anlage.speichern": "Anlagen speichern",
    "wissensmetadaten.revalidierung.feld": "Re-Validierung bis",
    "wissensmetadaten.revalidierung.keine": "Kein Re-Validierungstermin",
    "wissensmetadaten.matrix.oeffnen": "Anlagen-Matrix",
    "wissensmetadaten.matrix.titel": "Anlagen und Wissensobjekte",
    "wissensmetadaten.matrix.hinweis":
      "Gezeigt werden die aktuellen Treffer, die eine Anlage tragen. Ein Punkt heißt: das Wissensobjekt hängt an dieser Anlage.",
    "wissensmetadaten.matrix.leer": "Keiner der aktuellen Treffer trägt eine Anlage.",
    "wissensmetadaten.matrix.objekt": "Wissensobjekt",
    "wissensmetadaten.matrix.zelle": "„{{titel}}“ hängt an {{anlage}}",
    "wissensmetadaten.matrix.anzahl": "Objekte je Anlage",
  },
  en: {
    "wissensmetadaten.fachgebiet.feld": "Domain",
    "wissensmetadaten.fachgebiet.platzhalter": "e.g. maintenance, quality",
    "wissensmetadaten.fachgebiet.keins": "No domain given",
    "wissensmetadaten.fachgebiet.speichern": "Save domain",
    "wissensmetadaten.anlage.facette": "Equipment",
    "wissensmetadaten.anlage.keine": "No equipment given",
    "wissensmetadaten.anlage.kopplungen": "Coupled for change notices",
    "wissensmetadaten.aussageart.feld": "Kind of statement",
    "wissensmetadaten.aussageart.ohne": "Not specified",
    "wissensmetadaten.aussageart.tatsache": "Fact",
    "wissensmetadaten.aussageart.handlungsanweisung": "Instruction",
    "wissensmetadaten.anlage.mehrere":
      "Separate several pieces of equipment with ; (; inside a name: \\;)",
    "wissensmetadaten.anlage.liste": "Equipment of this knowledge object",
    "wissensmetadaten.anlage.speichern": "Save equipment",
    "wissensmetadaten.revalidierung.feld": "Revalidate by",
    "wissensmetadaten.revalidierung.keine": "No revalidation date",
    "wissensmetadaten.matrix.oeffnen": "Equipment matrix",
    "wissensmetadaten.matrix.titel": "Equipment and knowledge objects",
    "wissensmetadaten.matrix.hinweis":
      "Shows the current results that carry equipment. A dot means: the knowledge object is attached to this equipment.",
    "wissensmetadaten.matrix.leer": "None of the current results carries equipment.",
    "wissensmetadaten.matrix.objekt": "Knowledge object",
    "wissensmetadaten.matrix.zelle": "“{{titel}}” is attached to {{anlage}}",
    "wissensmetadaten.matrix.anzahl": "Objects per equipment",
  },
  nl: {
    "wissensmetadaten.fachgebiet.feld": "Vakgebied",
    "wissensmetadaten.fachgebiet.platzhalter": "bijv. onderhoud, kwaliteit",
    "wissensmetadaten.fachgebiet.keins": "Geen vakgebied opgegeven",
    "wissensmetadaten.fachgebiet.speichern": "Vakgebied opslaan",
    "wissensmetadaten.anlage.facette": "Installatie",
    "wissensmetadaten.anlage.keine": "Geen installatie opgegeven",
    "wissensmetadaten.anlage.kopplungen": "Gekoppeld voor wijzigingsmeldingen",
    "wissensmetadaten.aussageart.feld": "Soort uitspraak",
    "wissensmetadaten.aussageart.ohne": "Niet opgegeven",
    "wissensmetadaten.aussageart.tatsache": "Feit",
    "wissensmetadaten.aussageart.handlungsanweisung": "Handelingsinstructie",
    "wissensmetadaten.anlage.mehrere": "Meerdere installaties scheiden met ; (; in een naam: \\;)",
    "wissensmetadaten.anlage.liste": "Installaties van dit kennisobject",
    "wissensmetadaten.anlage.speichern": "Installaties opslaan",
    "wissensmetadaten.revalidierung.feld": "Opnieuw valideren voor",
    "wissensmetadaten.revalidierung.keine": "Geen datum voor hervalidatie",
    "wissensmetadaten.matrix.oeffnen": "Installatiematrix",
    "wissensmetadaten.matrix.titel": "Installaties en kennisobjecten",
    "wissensmetadaten.matrix.hinweis":
      "Toont de huidige resultaten met een installatie. Een punt betekent: het kennisobject hoort bij deze installatie.",
    "wissensmetadaten.matrix.leer": "Geen van de huidige resultaten heeft een installatie.",
    "wissensmetadaten.matrix.objekt": "Kennisobject",
    "wissensmetadaten.matrix.zelle": "‘{{titel}}’ hoort bij {{anlage}}",
    "wissensmetadaten.matrix.anzahl": "Objecten per installatie",
  },
} satisfies Textmodul;
