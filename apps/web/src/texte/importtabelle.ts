// ================================================================================================
// R-0179 / FR-EXT-01 (Nacharbeit 3) · EXCEL-TABELLEN IM IMPORTKASTEN.
// ================================================================================================
//
// Der Importkasten (`components/ImportJsonUpload.tsx`) nimmt seit dieser Nacharbeit neben JSON
// auch Excel (.xlsx) an (`lib/xlsxImport.ts`). Die früheren Sätze „Import derzeit nur als JSON"
// (`imp.jsonOnlyReason`, `imp.dropReject` im Grundbestand) wären damit falsch; der Kasten nennt
// stattdessen diese Texte. Der Grundbestand bleibt unverändert.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "importtabelle.",
  legacySchluessel: [],
  de: {
    "importtabelle.hinweis":
      "JSON-Datei oder Excel-Tabelle (.xlsx) wählen — die Einträge landen als Beiträge in der Prüfliste (keine stille Übernahme).",
    "importtabelle.grund":
      "Import als JSON oder Excel-Tabelle (.xlsx). Office-Dokumente (DOCX, PDF, PPTX) bitte über „Wissen erfassen → aus Datei“ aufnehmen — dort werden sie real gelesen.",
    "importtabelle.format":
      "Excel: Gelesen wird das erste Arbeitsblatt. Die erste Zeile trägt die Feldnamen wie im JSON-Format ({{fields}}; optional author, tags, provider, externalId, sourceVersion, url, updatedAt, confidentiality). Jede weitere Zeile ist ein Eintrag; mehrere Schlagworte durch Komma trennen. confidentiality: intern, vertraulich oder streng vertraulich — ein anderer Wert gilt als vertraulich.",
    "importtabelle.dropHint":
      "JSON-Datei oder Excel-Tabelle hierher ziehen und ablegen — oder unten auswählen.",
    "importtabelle.dropActive": "Datei hier ablegen …",
    "importtabelle.dropReject":
      "„{{name}}“ ist weder eine JSON-Datei noch eine Excel-Tabelle (.xlsx) — nur diese beiden Formate werden hier importiert.",
    "importtabelle.unreadable":
      "Die Excel-Datei ließ sich nicht lesen. Bitte als .xlsx speichern und erneut versuchen.",
    "importtabelle.tooLarge": "Die Excel-Datei ist zu groß für den Import.",
    "importtabelle.empty":
      "Das erste Arbeitsblatt enthält keine Einträge unter der Kopfzeile — es wurde nichts eingereiht.",
    "importtabelle.weitereBlaetter":
      "Nur das erste Arbeitsblatt wurde gelesen; {{n}} weitere Blätter blieben unberücksichtigt.",
  },
  en: {
    "importtabelle.hinweis":
      "Choose a JSON file or an Excel spreadsheet (.xlsx) — the entries land as items in the review list (no silent adoption).",
    "importtabelle.grund":
      "Import as JSON or Excel spreadsheet (.xlsx). Please add Office documents (DOCX, PDF, PPTX) via “Capture knowledge → from file” — they are actually read there.",
    "importtabelle.format":
      "Excel: the first worksheet is read. Its first row carries the field names as in the JSON format ({{fields}}; optional author, tags, provider, externalId, sourceVersion, url, updatedAt, confidentiality). Every further row is one entry; separate several tags with commas. confidentiality: intern, vertraulich or streng vertraulich — any other value counts as confidential.",
    "importtabelle.dropHint":
      "Drag and drop a JSON file or an Excel spreadsheet here — or choose one below.",
    "importtabelle.dropActive": "Drop the file here …",
    "importtabelle.dropReject":
      "“{{name}}” is neither a JSON file nor an Excel spreadsheet (.xlsx) — only these two formats are imported here.",
    "importtabelle.unreadable":
      "The Excel file could not be read. Please save it as .xlsx and try again.",
    "importtabelle.tooLarge": "The Excel file is too large to import.",
    "importtabelle.empty":
      "The first worksheet has no entries below the header row — nothing was queued.",
    "importtabelle.weitereBlaetter":
      "Only the first worksheet was read; {{n}} further sheets were not considered.",
  },
  nl: {
    "importtabelle.hinweis":
      "Kies een JSON-bestand of een Excel-tabel (.xlsx) — de items komen als bijdragen in de controlelijst (geen stille overname).",
    "importtabelle.grund":
      "Import als JSON of Excel-tabel (.xlsx). Office-documenten (DOCX, PDF, PPTX) graag via „Kennis vastleggen → uit bestand” opnemen — daar worden ze echt gelezen.",
    "importtabelle.format":
      "Excel: het eerste werkblad wordt gelezen. De eerste rij bevat de veldnamen zoals in het JSON-formaat ({{fields}}; optioneel author, tags, provider, externalId, sourceVersion, url, updatedAt, confidentiality). Elke volgende rij is één item; meerdere trefwoorden scheiden met komma's. confidentiality: intern, vertraulich of streng vertraulich — elke andere waarde geldt als vertrouwelijk.",
    "importtabelle.dropHint":
      "Sleep een JSON-bestand of Excel-tabel hierheen — of kies er hieronder een.",
    "importtabelle.dropActive": "Laat het bestand hier los …",
    "importtabelle.dropReject":
      "„{{name}}” is geen JSON-bestand en geen Excel-tabel (.xlsx) — alleen deze twee formaten worden hier geïmporteerd.",
    "importtabelle.unreadable":
      "Het Excel-bestand kon niet worden gelezen. Sla het op als .xlsx en probeer het opnieuw.",
    "importtabelle.tooLarge": "Het Excel-bestand is te groot voor de import.",
    "importtabelle.empty":
      "Het eerste werkblad bevat geen items onder de kopregel — er is niets in de wachtrij gezet.",
    "importtabelle.weitereBlaetter":
      "Alleen het eerste werkblad is gelezen; {{n}} andere bladen zijn niet meegenomen.",
  },
} satisfies Textmodul;
