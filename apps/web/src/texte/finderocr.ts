import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "finderocr.",
  legacySchluessel: [],
  de: {
    "finderocr.herkunft":
      "Die ausgewählte Finder-Datei ist dieser Sitzung nicht bestätigt zugeordnet. Bitte erneut auswählen.",
    "finderocr.nichtLesbar":
      "Die ausgewählte Finder-Datei ist nicht lesbar. Bitte erneut auswählen.",
    "finderocr.fassung":
      "Die Datei stimmt nicht mehr mit der ausgewählten Finder-Fassung überein. Bitte erneut auswählen.",
  },
  en: {
    "finderocr.herkunft":
      "The selected Finder file is not confirmed for this session. Please select it again.",
    "finderocr.nichtLesbar": "The selected Finder file cannot be read. Please select it again.",
    "finderocr.fassung":
      "The file no longer matches the selected Finder version. Please select it again.",
  },
  nl: {
    "finderocr.herkunft":
      "Het geselecteerde Finder-bestand is niet bevestigd voor deze sessie. Selecteer het opnieuw.",
    "finderocr.nichtLesbar":
      "Het geselecteerde Finder-bestand kan niet worden gelezen. Selecteer het opnieuw.",
    "finderocr.fassung":
      "Het bestand komt niet meer overeen met de geselecteerde Finder-versie. Selecteer het opnieuw.",
  },
} satisfies Textmodul;
