// ================================================================================================
// R-0711 · DIE TEXTE DES WISSENSNETZ-EXPORTS (offenes Format GraphML).
// ================================================================================================
//
// Wer sie liest: `pages/Stufe2.tsx` (`WissensnetzExport` am Wissensgraphen `/graph`). Die Datei
// selbst entsteht in `lib/wissensnetzExport.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "netzexport.",
  legacySchluessel: [],
  de: {
    "netzexport.knopf": "Wissensnetz herunterladen (GraphML)",
    "netzexport.erklaerung":
      "Speichert alle Einträge, die Sie sehen dürfen, mit ihren Schlagwortverbindungen und gesetzten Fachbeziehungen als Datei im offenen Format GraphML. Sie lässt sich ohne Klarwerk weiterverwenden, zum Beispiel mit Gephi, yEd oder Cytoscape.",
    "netzexport.gekuerzt":
      "Der Server hat die Verbindungen gekürzt. Die Datei enthält dieselbe gekürzte Menge und nennt darin die Gesamtzahl.",
  },
  en: {
    "netzexport.knopf": "Download knowledge network (GraphML)",
    "netzexport.erklaerung":
      "Saves all entries you are allowed to see, with their keyword connections and curated subject-matter relations, as a file in the open GraphML format. It can be used without Klarwerk, for example with Gephi, yEd or Cytoscape.",
    "netzexport.gekuerzt":
      "The server shortened the connections. The file contains the same shortened set and states the total number.",
  },
  nl: {
    "netzexport.knopf": "Kennisnetwerk downloaden (GraphML)",
    "netzexport.erklaerung":
      "Slaat alle items op die u mag zien, met hun trefwoordverbindingen en gelegde vakrelaties, als bestand in het open formaat GraphML. Het is zonder Klarwerk te gebruiken, bijvoorbeeld met Gephi, yEd of Cytoscape.",
    "netzexport.gekuerzt":
      "De server heeft de verbindingen ingekort. Het bestand bevat dezelfde ingekorte set en noemt het totaal.",
  },
} satisfies Textmodul;
