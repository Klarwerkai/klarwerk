import type { Textmodul } from "./intern/pruefung";
export default {
  praefix: "officeimport.",
  legacySchluessel: [],
  de: {
    "officeimport.docxGrenze":
      "„{{name}}“ überschreitet die sicheren Word-Importgrenzen: Dateigröße, entpackter Inhalt, Kompression oder Eintragszahl. Bitte verwende ein kleineres Dokument.",
    "officeimport.docxArchiv":
      "„{{name}}“ ist kein lesbares DOCX-Archiv. Bitte wähle eine gültige Word-Datei (.docx).",
  },
  en: {
    "officeimport.docxGrenze":
      "“{{name}}” exceeds the safe Word import limits for file size, unpacked content, compression or entry count. Please use a smaller document.",
    "officeimport.docxArchiv":
      "“{{name}}” is not a readable DOCX archive. Please choose a valid Word file (.docx).",
  },
  nl: {
    "officeimport.docxGrenze":
      "‘{{name}}’ overschrijdt de veilige Word-importgrenzen voor bestandsgrootte, uitgepakte inhoud, compressie of aantal onderdelen. Gebruik een kleiner document.",
    "officeimport.docxArchiv":
      "‘{{name}}’ is geen leesbaar DOCX-archief. Kies een geldig Word-bestand (.docx).",
  },
} satisfies Textmodul;
