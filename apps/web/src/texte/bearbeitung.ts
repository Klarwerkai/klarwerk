// ================================================================================================
// WIKI-BEARBEITUNGSRESERVIERUNG · die Texte des Bearbeitungshinweises.
// ================================================================================================
//
// Wer einen Wissenseintrag bearbeitet, meldet das an; wer ihn lesen darf, sieht den Hinweis und
// dessen Ende. Die Texte sagen drei Dinge, die der Mensch wissen muss: WER gerade bearbeitet, WANN
// der Hinweis von selbst erlischt, und dass Speichern weiterhin durch den Versionskonflikt
// geschützt ist — der Hinweis ist keine Sperre und kein Versprechen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bearbeitung.",
  legacySchluessel: [],
  de: {
    "bearbeitung.titel": "Gerade in Bearbeitung",
    "bearbeitung.fremd": "{{name}} bearbeitet diesen Eintrag gerade (seit {{seit}} Uhr).",
    "bearbeitung.erklaerung":
      "Das ist ein Hinweis, keine Sperre. Er verschwindet, sobald die Bearbeitung gespeichert oder beendet wird — bricht die Verbindung ab, spätestens nach {{minuten}} Minuten. Speichern bleibt geschützt: Wer auf einem inzwischen überholten Stand speichert, bekommt einen Konflikt angezeigt und entscheidet selbst — nichts wird still überschrieben.",
    "bearbeitung.eigenesFenster":
      "Du bearbeitest diesen Eintrag zusätzlich in einem anderen Fenster oder Tab.",
    "bearbeitung.beendet":
      "Die Bearbeitung durch {{name}} ist beendet. Der Eintrag wurde neu vom Server gelesen.",
    "bearbeitung.beendetSchliessen": "Hinweis schliessen",
    "bearbeitung.unbekannt":
      "Ob gerade jemand anderes diesen Eintrag bearbeitet, lässt sich im Moment nicht prüfen.",
    "bearbeitung.eigenUnterbrochen":
      "Die Verbindung ist unterbrochen. Dein Bearbeitungshinweis erlischt nach {{minuten}} Minuten, wenn sie nicht zurückkommt — dein Text bleibt hier erhalten.",
    "bearbeitung.eigenZurueck":
      "Die Verbindung ist wieder da. Der Stand wurde neu vom Server gelesen; dein Text steht unverändert hier.",
    "bearbeitung.eigenOhneRecht":
      "Du darfst diesen Eintrag nicht mehr bearbeiten. Dein Text bleibt hier erhalten, gespeichert werden kann er nicht mehr.",
    "bearbeitung.namenlos": "Ein anderes Konto",
  },
  en: {
    "bearbeitung.titel": "Currently being edited",
    "bearbeitung.fremd": "{{name}} is editing this entry right now (since {{seit}}).",
    "bearbeitung.erklaerung":
      "This is a notice, not a lock. It disappears as soon as the edit is saved or ended — if the connection drops, after {{minuten}} minutes at the latest. Saving stays protected: whoever saves on an outdated state is shown a conflict and decides themselves — nothing is silently overwritten.",
    "bearbeitung.eigenesFenster": "You are also editing this entry in another window or tab.",
    "bearbeitung.beendet":
      "{{name}} has finished editing. The entry was read again from the server.",
    "bearbeitung.beendetSchliessen": "Close notice",
    "bearbeitung.unbekannt":
      "Whether somebody else is editing this entry cannot be checked right now.",
    "bearbeitung.eigenUnterbrochen":
      "The connection is interrupted. Your editing notice expires after {{minuten}} minutes if it does not come back — your text stays here.",
    "bearbeitung.eigenZurueck":
      "The connection is back. The state was read again from the server; your text is unchanged here.",
    "bearbeitung.eigenOhneRecht":
      "You may no longer edit this entry. Your text stays here, but it can no longer be saved.",
    "bearbeitung.namenlos": "Another account",
  },
  nl: {
    "bearbeitung.titel": "Wordt nu bewerkt",
    "bearbeitung.fremd": "{{name}} bewerkt dit item op dit moment (sinds {{seit}}).",
    "bearbeitung.erklaerung":
      "Dit is een melding, geen vergrendeling. Ze verdwijnt zodra de bewerking wordt opgeslagen of beëindigd — valt de verbinding weg, dan uiterlijk na {{minuten}} minuten. Opslaan blijft beschermd: wie op een inmiddels verouderde stand opslaat, krijgt een conflict te zien en beslist zelf — er wordt niets stilzwijgend overschreven.",
    "bearbeitung.eigenesFenster": "Je bewerkt dit item ook in een ander venster of tabblad.",
    "bearbeitung.beendet":
      "De bewerking door {{name}} is beëindigd. Het item is opnieuw van de server gelezen.",
    "bearbeitung.beendetSchliessen": "Melding sluiten",
    "bearbeitung.unbekannt":
      "Of iemand anders dit item op dit moment bewerkt, kan nu niet worden gecontroleerd.",
    "bearbeitung.eigenUnterbrochen":
      "De verbinding is onderbroken. Je bewerkingsmelding verloopt na {{minuten}} minuten als ze niet terugkomt — je tekst blijft hier bewaard.",
    "bearbeitung.eigenZurueck":
      "De verbinding is terug. De stand is opnieuw van de server gelezen; je tekst staat hier onveranderd.",
    "bearbeitung.eigenOhneRecht":
      "Je mag dit item niet meer bewerken. Je tekst blijft hier bewaard, maar kan niet meer worden opgeslagen.",
    "bearbeitung.namenlos": "Een ander account",
  },
} satisfies Textmodul;
