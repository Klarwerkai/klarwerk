// ================================================================================================
// R-1034 / FR-I18N-02 — die Texte der Karte „Übersetzungen" unter Verwaltung › System.
// ================================================================================================
//
// Die Karte selbst steht in `components/einstellungen/UebersetzungsPflege.tsx`. Ihre eigenen Texte
// sind — wie jeder andere Text — dort pflegbar; sie liegen hier als mitgelieferter Bestand.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "uebersetzungen.",
  legacySchluessel: [],
  de: {
    "uebersetzungen.titel": "Übersetzungen",
    "uebersetzungen.zeileWert": "Oberflächentexte anpassen",
    "uebersetzungen.hilfe":
      "Hier passt du Texte der Oberfläche im laufenden Betrieb an oder übersetzt sie — ohne Änderung am Code. Eine Anpassung überdeckt den mitgelieferten Text; „Zurücksetzen“ stellt ihn wieder her.",
    "uebersetzungen.sprache": "Sprache",
    "uebersetzungen.suche": "Text oder Schlüssel suchen",
    "uebersetzungen.nurAngepasst": "Nur angepasste Texte",
    "uebersetzungen.treffer": "{{anzahl}} von {{gesamt}} Texten",
    "uebersetzungen.gekuerzt":
      "Gezeigt werden die ersten {{anzahl}} Treffer — grenze die Suche weiter ein.",
    "uebersetzungen.leer": "Kein Text passt zur Suche.",
    "uebersetzungen.vorlage": "Deutsch (Vorlage)",
    "uebersetzungen.mitgeliefert": "Mitgeliefert",
    "uebersetzungen.keinMitgeliefert":
      "Keine mitgelieferte Fassung — die Oberfläche zeigt hier den deutschen Text.",
    "uebersetzungen.angepasst": "Angepasst",
    "uebersetzungen.anpassen": "Anpassen",
    "uebersetzungen.neuerText": "Neuer Text",
    "uebersetzungen.speichern": "Speichern",
    "uebersetzungen.abbrechen": "Abbrechen",
    "uebersetzungen.zuruecksetzen": "Zurücksetzen",
    "uebersetzungen.gespeichert":
      "Gespeichert. Wer die Anwendung neu öffnet oder die Sprache wechselt, sieht den neuen Text.",
    "uebersetzungen.zurueckgesetzt": "Der mitgelieferte Text gilt wieder.",
    "uebersetzungen.fehler": "Nicht gespeichert: {{grund}}",
    "uebersetzungen.platzhalterFehlt": "Diese Platzhalter müssen im Text bleiben: {{liste}}",
    "uebersetzungen.platzhalterFremd": "Diese Platzhalter kennt der Text nicht: {{liste}}",
    "uebersetzungen.neueSprache": "Weitere Sprache anlegen",
    "uebersetzungen.kennung": "Sprachkennung (z. B. fr)",
    "uebersetzungen.name": "Name der Sprache (z. B. Français)",
    "uebersetzungen.anlegen": "Anlegen",
    "uebersetzungen.angelegt": "Sprache „{{name}}“ angelegt.",
    "uebersetzungen.sprachwahlHinweis":
      "Eine angelegte Sprache erscheint sofort in der Sprachwahl im Kontomenü und im Profil. Texte, die hier noch nicht übersetzt sind, zeigt die Oberfläche auf Deutsch.",
  },
  en: {
    "uebersetzungen.titel": "Translations",
    "uebersetzungen.zeileWert": "Adjust interface texts",
    "uebersetzungen.hilfe":
      "Adjust or translate interface texts here while the system is running — without changing code. An adjustment covers the shipped text; “Reset” restores it.",
    "uebersetzungen.sprache": "Language",
    "uebersetzungen.suche": "Search text or key",
    "uebersetzungen.nurAngepasst": "Adjusted texts only",
    "uebersetzungen.treffer": "{{anzahl}} of {{gesamt}} texts",
    "uebersetzungen.gekuerzt": "Showing the first {{anzahl}} matches — narrow your search.",
    "uebersetzungen.leer": "No text matches the search.",
    "uebersetzungen.vorlage": "German (reference)",
    "uebersetzungen.mitgeliefert": "Shipped",
    "uebersetzungen.keinMitgeliefert":
      "No shipped version — the interface shows the German text here.",
    "uebersetzungen.angepasst": "Adjusted",
    "uebersetzungen.anpassen": "Adjust",
    "uebersetzungen.neuerText": "New text",
    "uebersetzungen.speichern": "Save",
    "uebersetzungen.abbrechen": "Cancel",
    "uebersetzungen.zuruecksetzen": "Reset",
    "uebersetzungen.gespeichert":
      "Saved. Anyone who reopens the application or switches language sees the new text.",
    "uebersetzungen.zurueckgesetzt": "The shipped text applies again.",
    "uebersetzungen.fehler": "Not saved: {{grund}}",
    "uebersetzungen.platzhalterFehlt": "These placeholders must stay in the text: {{liste}}",
    "uebersetzungen.platzhalterFremd": "The text does not know these placeholders: {{liste}}",
    "uebersetzungen.neueSprache": "Add another language",
    "uebersetzungen.kennung": "Language code (e.g. fr)",
    "uebersetzungen.name": "Language name (e.g. Français)",
    "uebersetzungen.anlegen": "Add",
    "uebersetzungen.angelegt": "Language “{{name}}” added.",
    "uebersetzungen.sprachwahlHinweis":
      "An added language appears right away in the language choice in the account menu and the profile. Texts not yet translated here are shown in German.",
  },
  nl: {
    "uebersetzungen.titel": "Vertalingen",
    "uebersetzungen.zeileWert": "Teksten van de interface aanpassen",
    "uebersetzungen.hilfe":
      "Pas hier teksten van de interface aan of vertaal ze terwijl het systeem draait — zonder de code te wijzigen. Een aanpassing dekt de meegeleverde tekst af; „Terugzetten” herstelt die.",
    "uebersetzungen.sprache": "Taal",
    "uebersetzungen.suche": "Tekst of sleutel zoeken",
    "uebersetzungen.nurAngepasst": "Alleen aangepaste teksten",
    "uebersetzungen.treffer": "{{anzahl}} van {{gesamt}} teksten",
    "uebersetzungen.gekuerzt":
      "De eerste {{anzahl}} resultaten worden getoond — verfijn je zoekopdracht.",
    "uebersetzungen.leer": "Geen tekst past bij de zoekopdracht.",
    "uebersetzungen.vorlage": "Duits (voorbeeld)",
    "uebersetzungen.mitgeliefert": "Meegeleverd",
    "uebersetzungen.keinMitgeliefert":
      "Geen meegeleverde versie — de interface toont hier de Duitse tekst.",
    "uebersetzungen.angepasst": "Aangepast",
    "uebersetzungen.anpassen": "Aanpassen",
    "uebersetzungen.neuerText": "Nieuwe tekst",
    "uebersetzungen.speichern": "Opslaan",
    "uebersetzungen.abbrechen": "Annuleren",
    "uebersetzungen.zuruecksetzen": "Terugzetten",
    "uebersetzungen.gespeichert":
      "Opgeslagen. Wie de toepassing opnieuw opent of van taal wisselt, ziet de nieuwe tekst.",
    "uebersetzungen.zurueckgesetzt": "De meegeleverde tekst geldt weer.",
    "uebersetzungen.fehler": "Niet opgeslagen: {{grund}}",
    "uebersetzungen.platzhalterFehlt": "Deze plaatshouders moeten in de tekst blijven: {{liste}}",
    "uebersetzungen.platzhalterFremd": "Deze plaatshouders kent de tekst niet: {{liste}}",
    "uebersetzungen.neueSprache": "Nog een taal toevoegen",
    "uebersetzungen.kennung": "Taalcode (bijv. fr)",
    "uebersetzungen.name": "Naam van de taal (bijv. Français)",
    "uebersetzungen.anlegen": "Toevoegen",
    "uebersetzungen.angelegt": "Taal „{{name}}” toegevoegd.",
    "uebersetzungen.sprachwahlHinweis":
      "Een toegevoegde taal verschijnt direct in de taalkeuze in het accountmenu en het profiel. Teksten die hier nog niet vertaald zijn, toont de interface in het Duits.",
  },
} satisfies Textmodul;
