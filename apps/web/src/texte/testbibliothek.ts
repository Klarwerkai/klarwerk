// ================================================================================================
// gesamt-nutzerverwaltung · Frage 6 — der SharePoint-Import eines Fachkontos aus seiner EIGENEN
// Testbibliothek, auf der Erfassungsseite.
// ================================================================================================
//
// Die Sätze sagen, WOHER importiert wird (nur die eigene Testbibliothek) und was danach geschieht
// (jemand mit Prüfrecht nimmt an). Die übrigen Sätze des Bereichs kommen unverändert aus
// `imp.sharepoint.*` — dieselbe Fläche, kein zweiter Wortschatz.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "testbibliothek.",
  legacySchluessel: [],
  de: {
    "testbibliothek.titel": "Aus deiner SharePoint-Testbibliothek importieren",
    "testbibliothek.hinweis":
      "Du siehst nur die Dateien deiner eigenen Testbibliothek. Was du übernimmst, wird nicht sofort Wissen: Es wartet in der Prüfung, bis jemand mit Prüfrecht es annimmt.",
    "testbibliothek.nichtBereit":
      "Deine Testbibliothek ist zugeordnet, aber der SharePoint-Zugang dieser Instanz ist gerade nicht eingerichtet. Bitte wende dich an die Verwaltung.",
  },
  en: {
    "testbibliothek.titel": "Import from your SharePoint test library",
    "testbibliothek.hinweis":
      "You only see the files in your own test library. What you import does not become knowledge right away: it waits in review until someone with review rights accepts it.",
    "testbibliothek.nichtBereit":
      "Your test library is assigned, but this instance's SharePoint access is not set up right now. Please contact your administrator.",
  },
  nl: {
    "testbibliothek.titel": "Importeren uit je SharePoint-testbibliotheek",
    "testbibliothek.hinweis":
      "Je ziet alleen de bestanden in je eigen testbibliotheek. Wat je importeert, wordt niet meteen kennis: het wacht in de controle tot iemand met controlerecht het aanneemt.",
    "testbibliothek.nichtBereit":
      "Je testbibliotheek is toegewezen, maar de SharePoint-toegang van deze omgeving is nu niet ingericht. Neem contact op met het beheer.",
  },
} satisfies Textmodul;
