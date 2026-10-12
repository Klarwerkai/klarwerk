// ================================================================================================
// KLARA 06 (Auftrag produkt:20261007:klara-notizen-aufgaben) — Private Notizen aufnehmen und
// wiederfinden.
// ================================================================================================
//
// Die Texte der privaten Notizen: Anlegen aus Eingabe, Diktat, Gespräch und Ausschnitt, Speicherstand
// und Wiederholung, Suche, Öffnen und Bearbeiten mit Rücklink, Arbeitszettel mit offenen Fragen,
// Privatheit und die Bedienhilfe dieser Fähigkeit.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klaranotiz.",
  legacySchluessel: [],
  de: {
    "klaranotiz.titel": "Meine Notizen",
    "klaranotiz.privat.hinweis":
      "Nur für dich: Andere Personen, die Verwaltung und die Suche im Wissen oder in Spaces sehen deine Notizen nicht.",
    "klaranotiz.privat.kennzeichen": "Privat",
    "klaranotiz.weg.geschrieben": "geschrieben",
    "klaranotiz.weg.diktiert": "diktiert",
    "klaranotiz.weg.gespraech": "aus dem Gespräch",
    "klaranotiz.weg.ausschnitt": "aus einem markierten Ausschnitt",
    "klaranotiz.herkunft": "Notiz {{weg}} · angelegt {{zeit}}",
    "klaranotiz.ruecklink": "Zur Stelle: {{ort}}",
    "klaranotiz.absatz": "Absatz {{nr}}",
    "klaranotiz.fassung": "Fassung {{nr}}",
    "klaranotiz.offen.titel": "Notiz",
    "klaranotiz.feld.titel": "Titel",
    "klaranotiz.feld.inhalt": "Notiz",
    "klaranotiz.feld.fragen": "Offene Fragen",
    "klaranotiz.feld.fragenHilfe":
      "Eine Frage je Zeile. Sie bleiben in deinem Arbeitszettel stehen.",
    "klaranotiz.feld.arbeitszettel": "Als persönlichen Arbeitszettel behalten",
    "klaranotiz.art.arbeitszettel": "Arbeitszettel · {{n}} offen",
    "klaranotiz.speichern": "Änderung speichern",
    "klaranotiz.speichertGerade": "Wird gespeichert …",
    "klaranotiz.schliessen": "Schließen",
    "klaranotiz.loeschen": "Notiz löschen",
    "klaranotiz.loeschenBestaetigen": "Ja, Notiz löschen",
    "klaranotiz.loeschenAbbrechen": "Behalten",
    "klaranotiz.nochmal": "Erneut speichern",
    "klaranotiz.verwerfen": "Verwerfen",
    "klaranotiz.ausstehend.laeuft": "Wird gespeichert …",
    "klaranotiz.gespeichert": "Notiz „{{titel}}“ gespeichert – nur für dich.",
    "klaranotiz.nichtGespeichert": "Nicht gespeichert: {{grund}}",
    "klaranotiz.aenderungNichtGespeichert": "Änderung nicht gespeichert: {{grund}}",
    "klaranotiz.geaendert": "Änderung an „{{titel}}“ gespeichert.",
    "klaranotiz.geloescht": "Notiz gelöscht.",
    "klaranotiz.fehler.konflikt":
      "Die Notiz wurde inzwischen an anderer Stelle geändert. Bitte schließen, neu öffnen und erneut ändern.",
    "klaranotiz.fehler.voll":
      "Es sind bereits sehr viele Notizen gespeichert. Bitte zuerst ältere löschen.",
    "klaranotiz.fehler.weg": "Die Notiz oder ihre Quelle gibt es nicht (mehr).",
    "klaranotiz.suche.label": "In meinen Notizen suchen",
    "klaranotiz.suche.platzhalter": "Stichwort, Seite oder Frage",
    "klaranotiz.suche.los": "Suchen",
    "klaranotiz.laden": "Notizen werden gelesen …",
    "klaranotiz.ladeFehler": "Notizen konnten nicht gelesen werden: {{grund}}",
    "klaranotiz.nochmalLaden": "Erneut lesen",
    "klaranotiz.leer":
      "Noch keine Notizen. Tippe oder diktiere unten und wähle „Als Notiz speichern“.",
    "klaranotiz.keinTreffer": "Keine eigene Notiz passt zu dieser Suche.",
    "klaranotiz.alsNotiz": "Als Notiz speichern",
    "klaranotiz.alsNotizHilfe":
      "Speichert den Text im Eingabefeld als private Notiz mit Rücklink zu dieser Stelle – ohne ihn an {{assistenz}} zu senden.",
    "klaranotiz.nachrichtAlsNotiz": "Als Notiz",
    "klaranotiz.entwurfAlsNotiz": "Als private Notiz speichern",
    "klaranotiz.bedienhilfe.anlegen":
      "„Als Notiz speichern“ unter dem Eingabefeld legt eine private Notiz an – getippt oder diktiert, mit Rücklink zur aktuellen Seite bzw. zur markierten Stelle.",
    "klaranotiz.bedienhilfe.gespraech":
      "„Als Notiz“ an einer gespeicherten Nachricht übernimmt genau ihren Wortlaut und ihren Ort in deine Notizen.",
    "klaranotiz.bedienhilfe.ausschnitt":
      "Einen markierten Ausschnitt speicherst du über „Notizentwurf“ und dann „Als private Notiz speichern“.",
    "klaranotiz.bedienhilfe.wiederfinden":
      "Unter „Meine Notizen“ suchst, öffnest, änderst und löschst du deine Notizen; „Zur Stelle“ führt zurück zu Artikel und Absatz.",
    "klaranotiz.bedienhilfe.arbeitszettel":
      "Offene Fragen trägst du je Zeile ein – als persönlicher Arbeitszettel bleiben sie stehen, bis du sie entfernst.",
    "klaranotiz.bedienhilfe.privat":
      "Notizen und Gespräche sind persönlich: andere Personen und die Suche in Wissen und Spaces sehen sie nicht.",
    "klaranotiz.bedienhilfe.fehler":
      "Scheitert das Speichern, steht „Nicht gespeichert“ mit Grund da. „Erneut speichern“ legt keine zweite Notiz an.",
  },
  en: {
    "klaranotiz.titel": "My notes",
    "klaranotiz.privat.hinweis":
      "Only for you: other people, administrators and searches in knowledge or spaces do not see your notes.",
    "klaranotiz.privat.kennzeichen": "Private",
    "klaranotiz.weg.geschrieben": "typed",
    "klaranotiz.weg.diktiert": "dictated",
    "klaranotiz.weg.gespraech": "from the conversation",
    "klaranotiz.weg.ausschnitt": "from a selected passage",
    "klaranotiz.herkunft": "Note {{weg}} · created {{zeit}}",
    "klaranotiz.ruecklink": "Go to the passage: {{ort}}",
    "klaranotiz.absatz": "Paragraph {{nr}}",
    "klaranotiz.fassung": "Version {{nr}}",
    "klaranotiz.offen.titel": "Note",
    "klaranotiz.feld.titel": "Title",
    "klaranotiz.feld.inhalt": "Note",
    "klaranotiz.feld.fragen": "Open questions",
    "klaranotiz.feld.fragenHilfe": "One question per line. They stay on your worksheet.",
    "klaranotiz.feld.arbeitszettel": "Keep as a personal worksheet",
    "klaranotiz.art.arbeitszettel": "Worksheet · {{n}} open",
    "klaranotiz.speichern": "Save change",
    "klaranotiz.speichertGerade": "Saving …",
    "klaranotiz.schliessen": "Close",
    "klaranotiz.loeschen": "Delete note",
    "klaranotiz.loeschenBestaetigen": "Yes, delete note",
    "klaranotiz.loeschenAbbrechen": "Keep",
    "klaranotiz.nochmal": "Save again",
    "klaranotiz.verwerfen": "Discard",
    "klaranotiz.ausstehend.laeuft": "Saving …",
    "klaranotiz.gespeichert": "Note “{{titel}}” saved – only for you.",
    "klaranotiz.nichtGespeichert": "Not saved: {{grund}}",
    "klaranotiz.aenderungNichtGespeichert": "Change not saved: {{grund}}",
    "klaranotiz.geaendert": "Change to “{{titel}}” saved.",
    "klaranotiz.geloescht": "Note deleted.",
    "klaranotiz.fehler.konflikt":
      "The note was changed elsewhere in the meantime. Please close it, open it again and repeat your change.",
    "klaranotiz.fehler.voll":
      "A very large number of notes is already saved. Please delete older ones first.",
    "klaranotiz.fehler.weg": "The note or its source does not exist (any more).",
    "klaranotiz.suche.label": "Search my notes",
    "klaranotiz.suche.platzhalter": "Keyword, page or question",
    "klaranotiz.suche.los": "Search",
    "klaranotiz.laden": "Reading notes …",
    "klaranotiz.ladeFehler": "Notes could not be read: {{grund}}",
    "klaranotiz.nochmalLaden": "Read again",
    "klaranotiz.leer": "No notes yet. Type or dictate below and choose “Save as note”.",
    "klaranotiz.keinTreffer": "None of your notes matches this search.",
    "klaranotiz.alsNotiz": "Save as note",
    "klaranotiz.alsNotizHilfe":
      "Saves the text in the input field as a private note with a link back to this place – without sending it to {{assistenz}}.",
    "klaranotiz.nachrichtAlsNotiz": "As note",
    "klaranotiz.entwurfAlsNotiz": "Save as private note",
    "klaranotiz.bedienhilfe.anlegen":
      "“Save as note” below the input field creates a private note – typed or dictated, with a link back to the current page or the selected passage.",
    "klaranotiz.bedienhilfe.gespraech":
      "“As note” on a saved message takes exactly its wording and its place into your notes.",
    "klaranotiz.bedienhilfe.ausschnitt":
      "To keep a selected passage, use “Note draft” and then “Save as private note”.",
    "klaranotiz.bedienhilfe.wiederfinden":
      "Under “My notes” you search, open, change and delete your notes; “Go to the passage” leads back to article and paragraph.",
    "klaranotiz.bedienhilfe.arbeitszettel":
      "Enter open questions one per line – as a personal worksheet they stay until you remove them.",
    "klaranotiz.bedienhilfe.privat":
      "Notes and conversations are personal: other people and searches in knowledge and spaces do not see them.",
    "klaranotiz.bedienhilfe.fehler":
      "If saving fails, “Not saved” is shown with the reason. “Save again” does not create a second note.",
  },
  nl: {
    "klaranotiz.titel": "Mijn notities",
    "klaranotiz.privat.hinweis":
      "Alleen voor jou: andere personen, beheerders en zoekopdrachten in kennis of spaces zien je notities niet.",
    "klaranotiz.privat.kennzeichen": "Privé",
    "klaranotiz.weg.geschrieben": "getypt",
    "klaranotiz.weg.diktiert": "gedicteerd",
    "klaranotiz.weg.gespraech": "uit het gesprek",
    "klaranotiz.weg.ausschnitt": "uit een gemarkeerde passage",
    "klaranotiz.herkunft": "Notitie {{weg}} · aangemaakt {{zeit}}",
    "klaranotiz.ruecklink": "Naar de passage: {{ort}}",
    "klaranotiz.absatz": "Alinea {{nr}}",
    "klaranotiz.fassung": "Versie {{nr}}",
    "klaranotiz.offen.titel": "Notitie",
    "klaranotiz.feld.titel": "Titel",
    "klaranotiz.feld.inhalt": "Notitie",
    "klaranotiz.feld.fragen": "Open vragen",
    "klaranotiz.feld.fragenHilfe": "Eén vraag per regel. Ze blijven op je werkblad staan.",
    "klaranotiz.feld.arbeitszettel": "Bewaren als persoonlijk werkblad",
    "klaranotiz.art.arbeitszettel": "Werkblad · {{n}} open",
    "klaranotiz.speichern": "Wijziging opslaan",
    "klaranotiz.speichertGerade": "Wordt opgeslagen …",
    "klaranotiz.schliessen": "Sluiten",
    "klaranotiz.loeschen": "Notitie verwijderen",
    "klaranotiz.loeschenBestaetigen": "Ja, notitie verwijderen",
    "klaranotiz.loeschenAbbrechen": "Behouden",
    "klaranotiz.nochmal": "Opnieuw opslaan",
    "klaranotiz.verwerfen": "Verwerpen",
    "klaranotiz.ausstehend.laeuft": "Wordt opgeslagen …",
    "klaranotiz.gespeichert": "Notitie ‘{{titel}}’ opgeslagen – alleen voor jou.",
    "klaranotiz.nichtGespeichert": "Niet opgeslagen: {{grund}}",
    "klaranotiz.aenderungNichtGespeichert": "Wijziging niet opgeslagen: {{grund}}",
    "klaranotiz.geaendert": "Wijziging aan ‘{{titel}}’ opgeslagen.",
    "klaranotiz.geloescht": "Notitie verwijderd.",
    "klaranotiz.fehler.konflikt":
      "De notitie is intussen elders gewijzigd. Sluit haar, open haar opnieuw en wijzig opnieuw.",
    "klaranotiz.fehler.voll": "Er zijn al heel veel notities opgeslagen. Verwijder eerst oudere.",
    "klaranotiz.fehler.weg": "De notitie of haar bron bestaat niet (meer).",
    "klaranotiz.suche.label": "In mijn notities zoeken",
    "klaranotiz.suche.platzhalter": "Trefwoord, pagina of vraag",
    "klaranotiz.suche.los": "Zoeken",
    "klaranotiz.laden": "Notities worden gelezen …",
    "klaranotiz.ladeFehler": "Notities konden niet worden gelezen: {{grund}}",
    "klaranotiz.nochmalLaden": "Opnieuw lezen",
    "klaranotiz.leer": "Nog geen notities. Typ of dicteer hieronder en kies ‘Als notitie opslaan’.",
    "klaranotiz.keinTreffer": "Geen van je notities past bij deze zoekopdracht.",
    "klaranotiz.alsNotiz": "Als notitie opslaan",
    "klaranotiz.alsNotizHilfe":
      "Slaat de tekst in het invoerveld op als privénotitie met een link terug naar deze plek – zonder hem naar {{assistenz}} te sturen.",
    "klaranotiz.nachrichtAlsNotiz": "Als notitie",
    "klaranotiz.entwurfAlsNotiz": "Als privénotitie opslaan",
    "klaranotiz.bedienhilfe.anlegen":
      "‘Als notitie opslaan’ onder het invoerveld maakt een privénotitie – getypt of gedicteerd, met een link terug naar de huidige pagina of de gemarkeerde passage.",
    "klaranotiz.bedienhilfe.gespraech":
      "‘Als notitie’ bij een opgeslagen bericht neemt precies de tekst en de plek ervan over in je notities.",
    "klaranotiz.bedienhilfe.ausschnitt":
      "Een gemarkeerde passage bewaar je via ‘Notitieconcept’ en daarna ‘Als privénotitie opslaan’.",
    "klaranotiz.bedienhilfe.wiederfinden":
      "Onder ‘Mijn notities’ zoek, open, wijzig en verwijder je je notities; ‘Naar de passage’ leidt terug naar artikel en alinea.",
    "klaranotiz.bedienhilfe.arbeitszettel":
      "Open vragen vul je per regel in – als persoonlijk werkblad blijven ze staan tot je ze verwijdert.",
    "klaranotiz.bedienhilfe.privat":
      "Notities en gesprekken zijn persoonlijk: andere personen en zoekopdrachten in kennis en spaces zien ze niet.",
    "klaranotiz.bedienhilfe.fehler":
      "Mislukt het opslaan, dan staat ‘Niet opgeslagen’ er met de reden. ‘Opnieuw opslaan’ maakt geen tweede notitie.",
  },
} satisfies Textmodul;
