// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DUBLETTEN-RÜCKZUG — die Texte des Knopfs am eigenen Dublettenhinweis.
// ================================================================================================
//
// Am eigenen Eintrag steht neben dem Dublettenhinweis ein Knopf, mit dem die Autorin ihre EIGENE
// Seite zurückzieht (R-1615). Es ist derselbe Löschweg wie im „…"-Menü (ein Aufruf von
// `endpoints.ko.remove`), nur mit einer Rückfrage, die sagt, was mit dem Befund und mit der
// Gegenseite geschieht. Die Gegenseite wird nicht angefasst; zusammengeführt wird nichts (R-0259).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "rueckzug.",
  legacySchluessel: [],
  de: {
    "rueckzug.knopf": "Eigene Seite zurückziehen",
    "rueckzug.frage":
      "Deinen Eintrag zurückziehen? Er wandert in den Papierkorb, und der Dublettenhinweis wird mit deinem Namen als „selbst zurückgezogen“ geschlossen. Der andere Eintrag bleibt unverändert. Ein Admin kann deinen Eintrag 30 Tage lang wiederherstellen; der Hinweis bleibt dabei geschlossen. Demo-Daten werden sofort endgültig gelöscht.",
    "rueckzug.ja": "Ja, zurückziehen",
    "rueckzug.erledigt": "Eintrag zurückgezogen. Der andere Eintrag bleibt unverändert.",
  },
  en: {
    "rueckzug.knopf": "Withdraw my side",
    "rueckzug.frage":
      "Withdraw your entry? It moves to the recycle bin, and the duplicate notice is closed as “withdrawn by the author” under your name. The other entry stays unchanged. An admin can restore your entry for 30 days; the notice stays closed. Demo data is deleted permanently right away.",
    "rueckzug.ja": "Yes, withdraw",
    "rueckzug.erledigt": "Entry withdrawn. The other entry stays unchanged.",
  },
  nl: {
    "rueckzug.knopf": "Eigen kant intrekken",
    "rueckzug.frage":
      "Je item intrekken? Het gaat naar de prullenbak en de dubbel-melding wordt onder jouw naam gesloten als „zelf ingetrokken”. Het andere item blijft ongewijzigd. Een beheerder kan je item 30 dagen lang herstellen; de melding blijft daarbij gesloten. Demogegevens worden direct definitief verwijderd.",
    "rueckzug.ja": "Ja, intrekken",
    "rueckzug.erledigt": "Item ingetrokken. Het andere item blijft ongewijzigd.",
  },
} satisfies Textmodul;
