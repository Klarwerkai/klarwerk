// ================================================================================================
// KLARA 07 (Auftrag produkt:20261008:klara-aufgaben) — Persönliche Aufgaben verwalten.
// ================================================================================================
//
// Die Texte der persönlichen Aufgaben: Anlegen aus einer Notiz und aus einem Klara-Auftrag, Öffnen,
// Bearbeiten, Priorisieren, Erledigen, Bezug und Zuständigkeit, Speicherstand und Wiederholung,
// Geltungsbereich und die Bedienhilfe dieser Fähigkeit.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klaraaufgabe.",
  legacySchluessel: [],
  de: {
    "klaraaufgabe.titel": "Meine persönlichen Aufgaben",
    "klaraaufgabe.zahl": "{{offen}} offen · {{alle}} gesamt",
    "klaraaufgabe.privat.hinweis":
      "Nur für dich, zuständig bist du. Gemeinsame Aufgaben wie Prüfungen, Konflikte und Lücken bleiben unter „Meine Aufgaben“ mit ihren eigenen Rechten.",
    "klaraaufgabe.bereich.persoenlich": "Persönlich",
    "klaraaufgabe.zustaendig": "Zuständig: du",
    "klaraaufgabe.status.offen": "Offen",
    "klaraaufgabe.status.erledigt": "Erledigt",
    "klaraaufgabe.statusWort.offen": "offen",
    "klaraaufgabe.statusWort.erledigt": "erledigt",
    "klaraaufgabe.erledigen": "Erledigt",
    "klaraaufgabe.wiederOeffnen": "Wieder öffnen",
    "klaraaufgabe.erledigtAm": "erledigt {{zeit}}",
    "klaraaufgabe.angelegt": "Angelegt {{zeit}}",
    "klaraaufgabe.feld.prioritaet": "Priorität",
    "klaraaufgabe.feld.titel": "Titel",
    "klaraaufgabe.feld.inhalt": "Was ist zu tun?",
    "klaraaufgabe.bezug.notiz": "Aus der Notiz „{{titel}}“",
    "klaraaufgabe.bezug.auftrag.gesprochen": "Aus deinem gesprochenen Auftrag „{{wortlaut}}“",
    "klaraaufgabe.bezug.auftrag.getippt": "Aus deinem geschriebenen Auftrag „{{wortlaut}}“",
    "klaraaufgabe.ruecklink": "Zur Stelle: {{ort}}",
    "klaraaufgabe.speichern": "Änderung speichern",
    "klaraaufgabe.speichertGerade": "Wird gespeichert …",
    "klaraaufgabe.loeschen": "Aufgabe löschen",
    "klaraaufgabe.loeschenBestaetigen": "Ja, Aufgabe löschen",
    "klaraaufgabe.loeschenAbbrechen": "Behalten",
    "klaraaufgabe.nochmal": "Erneut speichern",
    "klaraaufgabe.verwerfen": "Verwerfen",
    "klaraaufgabe.gespeichert": "Aufgabe „{{titel}}“ gespeichert – nur für dich.",
    "klaraaufgabe.schonDa":
      "Die Aufgabe „{{titel}}“ gibt es schon – es wurde keine zweite angelegt.",
    "klaraaufgabe.nichtGespeichert": "Nicht gespeichert: {{grund}}",
    "klaraaufgabe.aenderungNichtGespeichert": "Änderung nicht gespeichert: {{grund}}",
    "klaraaufgabe.geaendert": "Änderung an „{{titel}}“ gespeichert.",
    "klaraaufgabe.erledigtMeldung": "„{{titel}}“ ist erledigt.",
    "klaraaufgabe.wiederOffenMeldung": "„{{titel}}“ ist wieder offen.",
    "klaraaufgabe.geloescht": "Aufgabe gelöscht.",
    "klaraaufgabe.zielNichtGeoeffnet": "Die verlinkte Aufgabe ließ sich nicht öffnen: {{grund}}",
    "klaraaufgabe.fehler.konflikt":
      "Die Aufgabe wurde inzwischen an anderer Stelle geändert. Bitte verwerfen, um den aktuellen Stand zu sehen, und erneut ändern.",
    "klaraaufgabe.fehler.voll":
      "Es sind bereits sehr viele Aufgaben gespeichert. Bitte zuerst erledigte löschen.",
    "klaraaufgabe.fehler.weg": "Die Aufgabe oder ihre Quelle gibt es nicht (mehr).",
    "klaraaufgabe.laden": "Aufgaben werden gelesen …",
    "klaraaufgabe.ladeFehler": "Aufgaben konnten nicht gelesen werden: {{grund}}",
    "klaraaufgabe.nochmalLaden": "Erneut lesen",
    "klaraaufgabe.leer":
      "Noch keine persönlichen Aufgaben. Öffne eine Notiz und wähle „Als Aufgabe“ – oder sag: „Lege mir die Aufgabe … an“.",
    "klaraaufgabe.alsAufgabe": "Als Aufgabe",
    "klaraaufgabe.alsAufgabeHilfe":
      "Legt aus dieser Notiz eine persönliche Aufgabe an – mit Titel, Text und Rücklink der Notiz.",
    "klaraaufgabe.bedienhilfe.notiz":
      "„Als Aufgabe“ an einer geöffneten Notiz legt daraus eine persönliche Aufgabe an; Titel, Text und Stelle übernimmt sie aus der Notiz.",
    "klaraaufgabe.bedienhilfe.auftrag":
      "Gesprochen oder getippt: „Lege mir die Aufgabe „Filter bestellen“ an“ – Klara führt das als Auftrag aus und zeigt, ob die Aufgabe wirklich gespeichert ist.",
    "klaraaufgabe.bedienhilfe.bearbeiten":
      "Unter „Meine persönlichen Aufgaben“ öffnest und änderst du eine Aufgabe, setzt ihre Priorität und hakst sie als erledigt ab – oder öffnest sie wieder.",
    "klaraaufgabe.bedienhilfe.privat":
      "Persönliche Aufgaben sieht nur du. Gemeinsame Aufgaben unter „Meine Aufgaben“ bleiben, was sie sind – Klara macht keine davon zu einer persönlichen.",
    "klaraaufgabe.bedienhilfe.fehler":
      "Scheitert das Speichern, steht der Grund an der Aufgabe. „Erneut speichern“ legt nichts doppelt an und ändert nichts zweimal.",
  },
  en: {
    "klaraaufgabe.titel": "My personal tasks",
    "klaraaufgabe.zahl": "{{offen}} open · {{alle}} in total",
    "klaraaufgabe.privat.hinweis":
      "Only for you, and you are responsible. Shared tasks such as reviews, conflicts and gaps stay under “My tasks” with their own permissions.",
    "klaraaufgabe.bereich.persoenlich": "Personal",
    "klaraaufgabe.zustaendig": "Responsible: you",
    "klaraaufgabe.status.offen": "Open",
    "klaraaufgabe.status.erledigt": "Done",
    "klaraaufgabe.statusWort.offen": "open",
    "klaraaufgabe.statusWort.erledigt": "done",
    "klaraaufgabe.erledigen": "Done",
    "klaraaufgabe.wiederOeffnen": "Reopen",
    "klaraaufgabe.erledigtAm": "done {{zeit}}",
    "klaraaufgabe.angelegt": "Created {{zeit}}",
    "klaraaufgabe.feld.prioritaet": "Priority",
    "klaraaufgabe.feld.titel": "Title",
    "klaraaufgabe.feld.inhalt": "What needs to be done?",
    "klaraaufgabe.bezug.notiz": "From the note “{{titel}}”",
    "klaraaufgabe.bezug.auftrag.gesprochen": "From your spoken instruction “{{wortlaut}}”",
    "klaraaufgabe.bezug.auftrag.getippt": "From your typed instruction “{{wortlaut}}”",
    "klaraaufgabe.ruecklink": "Go to the place: {{ort}}",
    "klaraaufgabe.speichern": "Save change",
    "klaraaufgabe.speichertGerade": "Saving …",
    "klaraaufgabe.loeschen": "Delete task",
    "klaraaufgabe.loeschenBestaetigen": "Yes, delete task",
    "klaraaufgabe.loeschenAbbrechen": "Keep",
    "klaraaufgabe.nochmal": "Save again",
    "klaraaufgabe.verwerfen": "Discard",
    "klaraaufgabe.gespeichert": "Task “{{titel}}” saved – only for you.",
    "klaraaufgabe.schonDa": "The task “{{titel}}” already exists – no second one was created.",
    "klaraaufgabe.nichtGespeichert": "Not saved: {{grund}}",
    "klaraaufgabe.aenderungNichtGespeichert": "Change not saved: {{grund}}",
    "klaraaufgabe.geaendert": "Change to “{{titel}}” saved.",
    "klaraaufgabe.erledigtMeldung": "“{{titel}}” is done.",
    "klaraaufgabe.wiederOffenMeldung": "“{{titel}}” is open again.",
    "klaraaufgabe.geloescht": "Task deleted.",
    "klaraaufgabe.zielNichtGeoeffnet": "The linked task could not be opened: {{grund}}",
    "klaraaufgabe.fehler.konflikt":
      "The task was changed elsewhere in the meantime. Please discard to see the current state and change it again.",
    "klaraaufgabe.fehler.voll":
      "A very large number of tasks is already saved. Please delete completed ones first.",
    "klaraaufgabe.fehler.weg": "The task or its source does not exist (any more).",
    "klaraaufgabe.laden": "Reading tasks …",
    "klaraaufgabe.ladeFehler": "Tasks could not be read: {{grund}}",
    "klaraaufgabe.nochmalLaden": "Read again",
    "klaraaufgabe.leer":
      "No personal tasks yet. Open a note and choose “As task” – or say: “Create a task …”.",
    "klaraaufgabe.alsAufgabe": "As task",
    "klaraaufgabe.alsAufgabeHilfe":
      "Creates a personal task from this note – with the note's title, text and link back.",
    "klaraaufgabe.bedienhilfe.notiz":
      "“As task” on an open note creates a personal task from it; it takes title, text and place from the note.",
    "klaraaufgabe.bedienhilfe.auftrag":
      "Spoken or typed: “Create a task “Order filter”” – Klara carries this out as an instruction and shows whether the task is really saved.",
    "klaraaufgabe.bedienhilfe.bearbeiten":
      "Under “My personal tasks” you open and change a task, set its priority and tick it off as done – or reopen it.",
    "klaraaufgabe.bedienhilfe.privat":
      "Only you see personal tasks. Shared tasks under “My tasks” stay what they are – Klara does not turn any of them into a personal one.",
    "klaraaufgabe.bedienhilfe.fehler":
      "If saving fails, the reason is shown at the task. “Save again” creates nothing twice and changes nothing twice.",
  },
  nl: {
    "klaraaufgabe.titel": "Mijn persoonlijke taken",
    "klaraaufgabe.zahl": "{{offen}} open · {{alle}} in totaal",
    "klaraaufgabe.privat.hinweis":
      "Alleen voor jou, en jij bent verantwoordelijk. Gedeelde taken zoals beoordelingen, conflicten en lacunes blijven onder ‘Mijn taken’ met hun eigen rechten.",
    "klaraaufgabe.bereich.persoenlich": "Persoonlijk",
    "klaraaufgabe.zustaendig": "Verantwoordelijk: jij",
    "klaraaufgabe.status.offen": "Open",
    "klaraaufgabe.status.erledigt": "Afgerond",
    "klaraaufgabe.statusWort.offen": "open",
    "klaraaufgabe.statusWort.erledigt": "afgerond",
    "klaraaufgabe.erledigen": "Afgerond",
    "klaraaufgabe.wiederOeffnen": "Heropenen",
    "klaraaufgabe.erledigtAm": "afgerond {{zeit}}",
    "klaraaufgabe.angelegt": "Aangemaakt {{zeit}}",
    "klaraaufgabe.feld.prioritaet": "Prioriteit",
    "klaraaufgabe.feld.titel": "Titel",
    "klaraaufgabe.feld.inhalt": "Wat moet er gebeuren?",
    "klaraaufgabe.bezug.notiz": "Uit de notitie ‘{{titel}}’",
    "klaraaufgabe.bezug.auftrag.gesprochen": "Uit je ingesproken opdracht ‘{{wortlaut}}’",
    "klaraaufgabe.bezug.auftrag.getippt": "Uit je getypte opdracht ‘{{wortlaut}}’",
    "klaraaufgabe.ruecklink": "Naar de plek: {{ort}}",
    "klaraaufgabe.speichern": "Wijziging opslaan",
    "klaraaufgabe.speichertGerade": "Wordt opgeslagen …",
    "klaraaufgabe.loeschen": "Taak verwijderen",
    "klaraaufgabe.loeschenBestaetigen": "Ja, taak verwijderen",
    "klaraaufgabe.loeschenAbbrechen": "Behouden",
    "klaraaufgabe.nochmal": "Opnieuw opslaan",
    "klaraaufgabe.verwerfen": "Verwerpen",
    "klaraaufgabe.gespeichert": "Taak ‘{{titel}}’ opgeslagen – alleen voor jou.",
    "klaraaufgabe.schonDa": "De taak ‘{{titel}}’ bestaat al – er is geen tweede aangemaakt.",
    "klaraaufgabe.nichtGespeichert": "Niet opgeslagen: {{grund}}",
    "klaraaufgabe.aenderungNichtGespeichert": "Wijziging niet opgeslagen: {{grund}}",
    "klaraaufgabe.geaendert": "Wijziging aan ‘{{titel}}’ opgeslagen.",
    "klaraaufgabe.erledigtMeldung": "‘{{titel}}’ is afgerond.",
    "klaraaufgabe.wiederOffenMeldung": "‘{{titel}}’ is weer open.",
    "klaraaufgabe.geloescht": "Taak verwijderd.",
    "klaraaufgabe.zielNichtGeoeffnet": "De gelinkte taak kon niet worden geopend: {{grund}}",
    "klaraaufgabe.fehler.konflikt":
      "De taak is intussen elders gewijzigd. Verwerp je wijziging om de actuele stand te zien en wijzig opnieuw.",
    "klaraaufgabe.fehler.voll":
      "Er zijn al heel veel taken opgeslagen. Verwijder eerst afgeronde taken.",
    "klaraaufgabe.fehler.weg": "De taak of haar bron bestaat niet (meer).",
    "klaraaufgabe.laden": "Taken worden gelezen …",
    "klaraaufgabe.ladeFehler": "Taken konden niet worden gelezen: {{grund}}",
    "klaraaufgabe.nochmalLaden": "Opnieuw lezen",
    "klaraaufgabe.leer":
      "Nog geen persoonlijke taken. Open een notitie en kies ‘Als taak’ – of zeg: ‘Maak een taak … aan’.",
    "klaraaufgabe.alsAufgabe": "Als taak",
    "klaraaufgabe.alsAufgabeHilfe":
      "Maakt van deze notitie een persoonlijke taak – met titel, tekst en terugverwijzing van de notitie.",
    "klaraaufgabe.bedienhilfe.notiz":
      "‘Als taak’ bij een geopende notitie maakt er een persoonlijke taak van; titel, tekst en plek komen uit de notitie.",
    "klaraaufgabe.bedienhilfe.auftrag":
      "Ingesproken of getypt: ‘Maak een taak ‘Filter bestellen’ aan’ – Klara voert dat uit als opdracht en laat zien of de taak echt is opgeslagen.",
    "klaraaufgabe.bedienhilfe.bearbeiten":
      "Onder ‘Mijn persoonlijke taken’ open en wijzig je een taak, stel je de prioriteit in en vink je haar af als afgerond – of heropen je haar.",
    "klaraaufgabe.bedienhilfe.privat":
      "Persoonlijke taken ziet alleen jij. Gedeelde taken onder ‘Mijn taken’ blijven wat ze zijn – Klara maakt er geen persoonlijke taak van.",
    "klaraaufgabe.bedienhilfe.fehler":
      "Mislukt het opslaan, dan staat de reden bij de taak. ‘Opnieuw opslaan’ maakt niets dubbel aan en wijzigt niets twee keer.",
  },
} satisfies Textmodul;
