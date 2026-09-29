// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg` · DIE TEXTE DES ERFASSUNGSEINSTIEGS.
// ================================================================================================
//
// · `einstieg.fehler.*` — der Satz im roten Kasten für Formfehler, zu grosse Inhalte und eine
//   abgelaufene Frist (`lib/erfassenFehlersatz.ts`; R-0080, R-1002, R-0101). Jeder sagt, dass
//   nichts gespeichert wurde und die Eingabe noch da ist — beides stimmt, weil der Fehler VOR der
//   Serverbestätigung steht und das Blatt seinen Inhalt dabei nicht anfasst.
// · `einstieg.knopf.*` — die Folge der beiden Knöpfe des Blattes (R-0084). Sie stehen als
//   Beschreibung AM Knopf (`aria-describedby`, `title`), nicht als Absatz auf der Fläche: das
//   freigegebene Zielbild H3 hat den Erklärtext von der Fläche genommen
//   (`tests/design/zielbild-h3-kein-erklaertext.test.ts`).
// · `einstieg.beispiel.*` — die Sicherheitsfrage vor dem Einreichen von Beispieldaten; bis hierher
//   stand sie deutsch im Quelltext (`Capture.tsx`, `BEISPIEL_TOR_TEXT`).
// · `einstieg.formular.*` — die Rückfrage, wenn das Blatt ungesichert vom gesicherten Stand abweicht
//   und der Mensch ins Expertenformular wechselt (N-0068, Bens Befund BEN-1; `Blatt.tsx`,
//   `formularOeffnen`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "einstieg.",
  legacySchluessel: [],
  de: {
    "einstieg.fehler.form":
      "Eine Angabe hat eine Form, die nicht gespeichert werden kann (zum Beispiel eine Zahl, wo Text stehen muss). Nichts wurde gespeichert; deine Eingabe steht noch hier.",
    "einstieg.fehler.zuLang":
      "Der Inhalt ist zu lang, um ihn in einem Zug zu speichern — kaputt ist nichts. Nichts wurde gespeichert; deine Eingabe steht noch hier. Kürze den Text oder verteile ihn auf mehrere Einträge.",
    "einstieg.fehler.frist":
      "Die Antwort des Servers kam nicht rechtzeitig. Er arbeitet vielleicht noch — prüfe Bibliothek oder Entwürfe, bevor du es erneut versuchst.",
    "einstieg.knopf.entwurf":
      "Entwurf sichern: Dein Stand wird gespeichert und bleibt privat. Niemand sonst sieht ihn; du findest ihn unter „Mehr“ → Entwürfe.",
    "einstieg.knopf.einreichen":
      "Einreichen: Dein Eintrag geht zur Prüfung an Kollegen und ist ab dann für andere sichtbar — als „in Prüfung“ markiert, nicht als gesichert.",
    "einstieg.beispiel.frage": "Das sind Beispieldaten. Wirklich als echtes Wissen einreichen?",
    "einstieg.beispiel.bestaetigen": "Ja, Beispiel einreichen",
    "einstieg.formular.sichernFrage":
      "Das Formular arbeitet mit dem gesicherten Stand. Deine ungesicherten Änderungen jetzt als Entwurf sichern und im Formular weiterarbeiten? Abbrechen: Du bleibst auf dem Blatt, nichts geht verloren.",
    "einstieg.formular.nachtragFrage":
      "Während des Sicherns hast du auf dem Blatt weitergeschrieben. Das Formular kennt nur den gerade gesicherten Stand. Auch die neuen Änderungen sichern und dann ins Formular wechseln? Abbrechen: Du bleibst auf dem Blatt, nichts geht verloren.",
    "einstieg.formular.ohneSichernFrage":
      "Deine Änderungen auf dem Blatt lassen sich gerade nicht sichern. Das Formular zeigt deshalb den zuletzt gesicherten Stand — oder ein leeres Formular, wenn noch nichts gesichert ist. Dein Blatt bleibt unverändert und ist beim Zurückkehren wieder da. Trotzdem zum Formular wechseln?",
  },
  en: {
    "einstieg.fehler.form":
      "One of the entries has a form that cannot be saved (for example a number where text is required). Nothing was saved; your input is still here.",
    "einstieg.fehler.zuLang":
      "The content is too long to save in one go — nothing is broken. Nothing was saved; your input is still here. Shorten the text or split it into several entries.",
    "einstieg.fehler.frist":
      "The server did not answer in time. It may still be working — check the library or your drafts before you try again.",
    "einstieg.knopf.entwurf":
      "Save draft: your current state is saved and stays private. Nobody else sees it; you find it under “More” → Drafts.",
    "einstieg.knopf.einreichen":
      "Submit: your entry goes to colleagues for review and is visible to others from then on — marked as “in review”, not as confirmed.",
    "einstieg.beispiel.frage": "This is sample data. Really submit it as real knowledge?",
    "einstieg.beispiel.bestaetigen": "Yes, submit sample",
    "einstieg.formular.sichernFrage":
      "The form works with the saved state. Save your unsaved changes as a draft now and continue in the form? Cancel: you stay on the sheet, nothing is lost.",
    "einstieg.formular.nachtragFrage":
      "You kept writing on the sheet while it was being saved. The form only knows the state that was just saved. Save the new changes too and then switch to the form? Cancel: you stay on the sheet, nothing is lost.",
    "einstieg.formular.ohneSichernFrage":
      "Your changes on the sheet cannot be saved right now. The form therefore shows the last saved state — or an empty form if nothing has been saved yet. Your sheet stays unchanged and is there again when you return. Switch to the form anyway?",
  },
  nl: {
    "einstieg.fehler.form":
      "Een van de gegevens heeft een vorm die niet kan worden opgeslagen (bijvoorbeeld een getal waar tekst moet staan). Er is niets opgeslagen; je invoer staat er nog.",
    "einstieg.fehler.zuLang":
      "De inhoud is te lang om in één keer op te slaan — er is niets kapot. Er is niets opgeslagen; je invoer staat er nog. Maak de tekst korter of verdeel hem over meerdere items.",
    "einstieg.fehler.frist":
      "De server antwoordde niet op tijd. Misschien werkt hij nog — controleer de bibliotheek of je concepten voordat je het opnieuw probeert.",
    "einstieg.knopf.entwurf":
      "Concept opslaan: je stand wordt opgeslagen en blijft privé. Niemand anders ziet hem; je vindt hem onder „Meer” → Concepten.",
    "einstieg.knopf.einreichen":
      "Indienen: je item gaat ter controle naar collega's en is vanaf dan zichtbaar voor anderen — gemarkeerd als „in controle”, niet als bevestigd.",
    "einstieg.beispiel.frage": "Dit zijn voorbeeldgegevens. Echt als echte kennis indienen?",
    "einstieg.beispiel.bestaetigen": "Ja, voorbeeld indienen",
    "einstieg.formular.sichernFrage":
      "Het formulier werkt met de opgeslagen stand. Je niet-opgeslagen wijzigingen nu als concept opslaan en in het formulier verdergaan? Annuleren: je blijft op het blad, er gaat niets verloren.",
    "einstieg.formular.nachtragFrage":
      "Je hebt tijdens het opslaan verder geschreven op het blad. Het formulier kent alleen de zojuist opgeslagen stand. Ook de nieuwe wijzigingen opslaan en dan naar het formulier gaan? Annuleren: je blijft op het blad, er gaat niets verloren.",
    "einstieg.formular.ohneSichernFrage":
      "Je wijzigingen op het blad kunnen nu niet worden opgeslagen. Het formulier toont daarom de laatst opgeslagen stand — of een leeg formulier als er nog niets is opgeslagen. Je blad blijft ongewijzigd en staat er weer als je terugkeert. Toch naar het formulier gaan?",
  },
} satisfies Textmodul;
