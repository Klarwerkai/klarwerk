// ================================================================================================
// aufnahme:20260922:gesamt-wissen-export — DER EXPORTUMFANG, VOR DEM DOWNLOAD GENANNT (N-0082).
// ================================================================================================
//
// Die Bibliothek bietet drei Umfänge an (`lib/libraryExport.ts`, `exportUmfang`): den validierten
// Gesamtbestand, die aktuellen Treffer und die markierten Einträge. Der Server lässt in JEDEM Fall
// nur validierte Einträge hinaus, vertrauliche nur mit Prüfrecht (`ko.validate`: Controller, Admin)
// — die Sätze sagen das, damit eine vermeintliche Sicherung des Sichtbaren nicht überrascht.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissenexport.",
  legacySchluessel: [],
  de: {
    "wissenexport.umfang.bestand": "Validierter Gesamtbestand",
    "wissenexport.umfang.treffer": "Aktuelle Treffer ({{anzahl}})",
    "wissenexport.umfang.markiert": "Markierte Einträge ({{anzahl}})",
    "wissenexport.umfang.bestandSatz":
      "Die Datei enthält alle validierten Einträge des Bestands – unabhängig von Suche und Filter. Nicht validierte Einträge sind nie enthalten, vertrauliche nur mit Prüfrecht (Controller, Admin).",
    "wissenexport.umfang.auswahlSatz":
      "Die Datei enthält {{exportierbar}} von {{gewaehlt}} gewählten Einträgen. Nicht enthalten: {{nichtValidiert}} nicht validiert, {{vertraulich}} vertraulich ohne Prüfrecht (Controller, Admin).",
    "wissenexport.umfang.keine":
      "Keiner der {{gewaehlt}} gewählten Einträge geht in die Datei – es gibt nichts zu exportieren. Nicht validiert: {{nichtValidiert}}, vertraulich ohne Prüfrecht (Controller, Admin): {{vertraulich}}.",
    "wissenexport.umfang.zuViele":
      "{{anzahl}} validierte Einträge sind zu viele für eine Auswahl (höchstens {{max}}). Bitte eingrenzen oder den Gesamtbestand exportieren.",
  },
  en: {
    "wissenexport.umfang.bestand": "All validated entries",
    "wissenexport.umfang.treffer": "Current results ({{anzahl}})",
    "wissenexport.umfang.markiert": "Selected entries ({{anzahl}})",
    "wissenexport.umfang.bestandSatz":
      "The file contains all validated entries of the library – regardless of search and filters. Entries that are not validated are never included; confidential ones only with review rights (controller, admin).",
    "wissenexport.umfang.auswahlSatz":
      "The file contains {{exportierbar}} of {{gewaehlt}} chosen entries. Not included: {{nichtValidiert}} not validated, {{vertraulich}} confidential without review rights (controller, admin).",
    "wissenexport.umfang.keine":
      "None of the {{gewaehlt}} chosen entries goes into the file – there is nothing to export. Not validated: {{nichtValidiert}}, confidential without review rights (controller, admin): {{vertraulich}}.",
    "wissenexport.umfang.zuViele":
      "{{anzahl}} validated entries are too many for a selection (at most {{max}}). Please narrow down or export all validated entries.",
  },
  nl: {
    "wissenexport.umfang.bestand": "Alle gevalideerde items",
    "wissenexport.umfang.treffer": "Huidige resultaten ({{anzahl}})",
    "wissenexport.umfang.markiert": "Geselecteerde items ({{anzahl}})",
    "wissenexport.umfang.bestandSatz":
      "Het bestand bevat alle gevalideerde items van de bibliotheek – los van zoekopdracht en filters. Niet-gevalideerde items zijn nooit inbegrepen, vertrouwelijke alleen met beoordelingsrecht (controller, admin).",
    "wissenexport.umfang.auswahlSatz":
      "Het bestand bevat {{exportierbar}} van {{gewaehlt}} gekozen items. Niet inbegrepen: {{nichtValidiert}} niet gevalideerd, {{vertraulich}} vertrouwelijk zonder beoordelingsrecht (controller, admin).",
    "wissenexport.umfang.keine":
      "Geen van de {{gewaehlt}} gekozen items gaat in het bestand – er valt niets te exporteren. Niet gevalideerd: {{nichtValidiert}}, vertrouwelijk zonder beoordelingsrecht (controller, admin): {{vertraulich}}.",
    "wissenexport.umfang.zuViele":
      "{{anzahl}} gevalideerde items zijn te veel voor een selectie (hoogstens {{max}}). Beperk de keuze of exporteer alle gevalideerde items.",
  },
} satisfies Textmodul;
