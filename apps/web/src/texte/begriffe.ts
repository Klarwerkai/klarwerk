// ================================================================================================
// FIRMENWÖRTERBUCH — die Texte der Begriffshinweise im Editor und der Seite `/begriffe`.
// ================================================================================================
//
// Der Auftrag verlangt DE/EN; NL steht hier, weil der Textmodulvertrag jede Sprache der Oberfläche
// verlangt (docs/i18n-textmodule.md) — ohne NL fiele die niederländische Oberfläche still auf
// Deutsch zurück. Geprüft werden Benennungen weiterhin nur in den Sprachfassungen DE und EN.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "begriffe.",
  legacySchluessel: [],
  de: {
    "begriffe.hinweise.titel": "Begriffshinweise",
    "begriffe.hinweise.titelAnzahl": "Begriffshinweise aus dem Firmenwörterbuch: {{anzahl}}",
    "begriffe.hinweise.keineSachaussage":
      "Geprüft wird nur die Benennung nach dem Firmenwörterbuch – nicht, ob die Aussage sachlich stimmt. Fachliche Prüfung und Konflikterkennung bleiben unverändert zuständig.",
    "begriffe.hinweise.stoerung":
      "Begriffshinweise sind gerade nicht verfügbar – das Firmenwörterbuch ist nicht erreichbar.",
    "begriffe.hinweise.veraltet":
      "Der Text hat sich seit der Prüfung geändert. Es wurde nichts ersetzt; die Hinweise werden neu geprüft.",
    "begriffe.hinweise.vorschlag": "„{{gefunden}}“ → im Haus heißt es „{{vorzug}}“",
    "begriffe.hinweise.definition": "Bedeutung: {{definition}}",
    "begriffe.hinweise.herkunft": "Eintrag im Geltungsbereich „{{bereich}}“, Fassung {{version}}.",
    "begriffe.hinweise.eintragOeffnen": "Eintrag ansehen",
    "begriffe.hinweise.mehrdeutig":
      "Dieses Wort ist in mehreren Geltungsbereichen gepflegt. Bitte prüfen, welcher hier gemeint ist.",
    "begriffe.hinweise.uebernehmen": "Übernehmen",
    "begriffe.hinweise.verwerfen": "Verwerfen",
    "begriffe.seite.titel": "Firmenwörterbuch",
    "begriffe.seite.lead":
      "Verbindliche Begriffe des Hauses: Vorzugsbezeichnung, Bedeutung, zulässige Synonyme und Benennungen, die vermieden werden sollen.",
    "begriffe.seite.grenze":
      "Das Firmenwörterbuch prüft Benennungen, keine Sachverhalte. Ein Synonym macht zwei Aussagen nicht inhaltlich gleich; Widersprüche klärt weiterhin die fachliche Prüfung.",
    "begriffe.seite.neu": "Begriff anlegen",
    "begriffe.seite.bearbeiten": "Begriff bearbeiten",
    "begriffe.seite.suche": "Begriffe durchsuchen",
    "begriffe.seite.laedt": "Das Firmenwörterbuch wird geladen …",
    "begriffe.seite.leer": "Im Firmenwörterbuch steht noch kein Begriff.",
    "begriffe.seite.leerPflege":
      "Im Firmenwörterbuch steht noch kein Begriff. Lege den ersten mit „Begriff anlegen“ an.",
    "begriffe.seite.verlauf": "Fassungen",
    "begriffe.feld.geltungsbereich": "Fachlicher Geltungsbereich",
    "begriffe.feld.verantwortlich": "Verantwortliche Pflege",
    "begriffe.feld.vorzug": "Vorzugsbezeichnung",
    "begriffe.feld.definition": "Definition",
    "begriffe.feld.synonyme": "Zulässige Synonyme",
    "begriffe.feld.unerwuenscht": "Unerwünschte Benennungen",
    "begriffe.feld.synonymeEingabe": "Zulässige Synonyme (durch Komma getrennt)",
    "begriffe.feld.unerwuenschtEingabe": "Unerwünschte Benennungen (durch Komma getrennt)",
    "begriffe.sprache.de": "Deutsch",
    "begriffe.sprache.en": "Englisch",
    "begriffe.eintrag.meta":
      "Geltungsbereich: {{bereich}} · Pflege: {{verantwortlich}} · Fassung {{version}}",
    "begriffe.verlauf.laedt": "Fassungen werden geladen …",
    "begriffe.verlauf.fehler": "Die Fassungen konnten nicht geladen werden.",
    "begriffe.verlauf.fassung": "Fassung {{version}} · {{zeit}} · {{wer}}",
    "begriffe.formular.hinweis":
      "Eine Sprachfassung genügt. Sind beide gepflegt, gelten sie als dasselbe Konzept; vorgeschlagen wird trotzdem nur innerhalb derselben Sprache. Jede Änderung wird als neue Fassung gespeichert; bestehende Inhalte werden nicht verändert.",
    "begriffe.formular.speichern": "Speichern",
    "begriffe.formular.abbrechen": "Abbrechen",
    "begriffe.fehler.doppelt":
      "Im selben Geltungsbereich gibt es diesen Begriff schon. Bitte den vorhandenen Eintrag bearbeiten.",
    "begriffe.fehler.veraltet":
      "Der Eintrag wurde inzwischen geändert. Bitte die Seite neu laden und die Änderung erneut vornehmen.",
    "begriffe.fehler.widerspruch":
      "Eine Benennung ist zugleich als zulässig und als unerwünscht eingetragen.",
    "begriffe.fehler.ungueltig":
      "Bitte Geltungsbereich, verantwortliche Pflege, mindestens eine Vorzugsbezeichnung und eine Definition angeben.",
    "begriffe.fehler.recht": "Dafür fehlt dir das Recht. Begriffe pflegen Prüfer und Admins.",
    "begriffe.fehler.anmeldung": "Bitte melde dich erneut an.",
    "begriffe.fehler.allgemein": "Das hat nicht geklappt. Bitte versuche es erneut.",
  },
  en: {
    "begriffe.hinweise.titel": "Term hints",
    "begriffe.hinweise.titelAnzahl": "Term hints from the company glossary: {{anzahl}}",
    "begriffe.hinweise.keineSachaussage":
      "Only the wording is checked against the company glossary – not whether the statement is factually correct. Expert review and conflict detection remain responsible for that.",
    "begriffe.hinweise.stoerung":
      "Term hints are currently unavailable – the company glossary cannot be reached.",
    "begriffe.hinweise.veraltet":
      "The text has changed since the check. Nothing was replaced; the hints are being checked again.",
    "begriffe.hinweise.vorschlag": "“{{gefunden}}” → the company term is “{{vorzug}}”",
    "begriffe.hinweise.definition": "Meaning: {{definition}}",
    "begriffe.hinweise.herkunft": "Entry in the scope “{{bereich}}”, version {{version}}.",
    "begriffe.hinweise.eintragOeffnen": "View entry",
    "begriffe.hinweise.mehrdeutig":
      "This word is maintained in more than one scope. Please check which one is meant here.",
    "begriffe.hinweise.uebernehmen": "Apply",
    "begriffe.hinweise.verwerfen": "Dismiss",
    "begriffe.seite.titel": "Company glossary",
    "begriffe.seite.lead":
      "Binding company terms: preferred term, meaning, permitted synonyms and terms to avoid.",
    "begriffe.seite.grenze":
      "The company glossary checks wording, not facts. A synonym does not make two statements equal in content; contradictions are still resolved by expert review.",
    "begriffe.seite.neu": "Add term",
    "begriffe.seite.bearbeiten": "Edit term",
    "begriffe.seite.suche": "Search terms",
    "begriffe.seite.laedt": "Loading the company glossary …",
    "begriffe.seite.leer": "The company glossary has no terms yet.",
    "begriffe.seite.leerPflege":
      "The company glossary has no terms yet. Add the first one with “Add term”.",
    "begriffe.seite.verlauf": "Versions",
    "begriffe.feld.geltungsbereich": "Subject scope",
    "begriffe.feld.verantwortlich": "Maintained by",
    "begriffe.feld.vorzug": "Preferred term",
    "begriffe.feld.definition": "Definition",
    "begriffe.feld.synonyme": "Permitted synonyms",
    "begriffe.feld.unerwuenscht": "Terms to avoid",
    "begriffe.feld.synonymeEingabe": "Permitted synonyms (comma-separated)",
    "begriffe.feld.unerwuenschtEingabe": "Terms to avoid (comma-separated)",
    "begriffe.sprache.de": "German",
    "begriffe.sprache.en": "English",
    "begriffe.eintrag.meta":
      "Scope: {{bereich}} · Maintained by: {{verantwortlich}} · Version {{version}}",
    "begriffe.verlauf.laedt": "Loading versions …",
    "begriffe.verlauf.fehler": "The versions could not be loaded.",
    "begriffe.verlauf.fassung": "Version {{version}} · {{zeit}} · {{wer}}",
    "begriffe.formular.hinweis":
      "One language is enough. If both are maintained, they count as the same concept; suggestions are still only made within the same language. Every change is saved as a new version; existing content is not changed.",
    "begriffe.formular.speichern": "Save",
    "begriffe.formular.abbrechen": "Cancel",
    "begriffe.fehler.doppelt":
      "This term already exists in the same scope. Please edit the existing entry.",
    "begriffe.fehler.veraltet":
      "The entry has been changed in the meantime. Please reload the page and make your change again.",
    "begriffe.fehler.widerspruch": "A term is listed as both permitted and to be avoided.",
    "begriffe.fehler.ungueltig":
      "Please enter scope, maintainer, at least one preferred term and a definition.",
    "begriffe.fehler.recht":
      "You do not have permission for this. Terms are maintained by reviewers and admins.",
    "begriffe.fehler.anmeldung": "Please sign in again.",
    "begriffe.fehler.allgemein": "That did not work. Please try again.",
  },
  nl: {
    "begriffe.hinweise.titel": "Begripshints",
    "begriffe.hinweise.titelAnzahl": "Begripshints uit het bedrijfswoordenboek: {{anzahl}}",
    "begriffe.hinweise.keineSachaussage":
      "Alleen de benaming wordt getoetst aan het bedrijfswoordenboek – niet of de uitspraak inhoudelijk klopt. Inhoudelijke controle en conflictherkenning blijven daarvoor verantwoordelijk.",
    "begriffe.hinweise.stoerung":
      "Begripshints zijn nu niet beschikbaar – het bedrijfswoordenboek is niet bereikbaar.",
    "begriffe.hinweise.veraltet":
      "De tekst is sinds de controle gewijzigd. Er is niets vervangen; de hints worden opnieuw gecontroleerd.",
    "begriffe.hinweise.vorschlag": "‘{{gefunden}}’ → binnen het bedrijf heet het ‘{{vorzug}}’",
    "begriffe.hinweise.definition": "Betekenis: {{definition}}",
    "begriffe.hinweise.herkunft":
      "Item in het toepassingsgebied ‘{{bereich}}’, versie {{version}}.",
    "begriffe.hinweise.eintragOeffnen": "Item bekijken",
    "begriffe.hinweise.mehrdeutig":
      "Dit woord wordt in meerdere toepassingsgebieden beheerd. Controleer welk hier bedoeld is.",
    "begriffe.hinweise.uebernehmen": "Overnemen",
    "begriffe.hinweise.verwerfen": "Negeren",
    "begriffe.seite.titel": "Bedrijfswoordenboek",
    "begriffe.seite.lead":
      "Bindende begrippen van het bedrijf: voorkeursterm, betekenis, toegestane synoniemen en benamingen die vermeden moeten worden.",
    "begriffe.seite.grenze":
      "Het bedrijfswoordenboek toetst benamingen, geen feiten. Een synoniem maakt twee uitspraken inhoudelijk niet gelijk; tegenstrijdigheden worden nog steeds door de inhoudelijke controle opgelost.",
    "begriffe.seite.neu": "Begrip toevoegen",
    "begriffe.seite.bearbeiten": "Begrip bewerken",
    "begriffe.seite.suche": "Begrippen doorzoeken",
    "begriffe.seite.laedt": "Het bedrijfswoordenboek wordt geladen …",
    "begriffe.seite.leer": "Het bedrijfswoordenboek bevat nog geen begrippen.",
    "begriffe.seite.leerPflege":
      "Het bedrijfswoordenboek bevat nog geen begrippen. Voeg het eerste toe met ‘Begrip toevoegen’.",
    "begriffe.seite.verlauf": "Versies",
    "begriffe.feld.geltungsbereich": "Inhoudelijk toepassingsgebied",
    "begriffe.feld.verantwortlich": "Beheerd door",
    "begriffe.feld.vorzug": "Voorkeursterm",
    "begriffe.feld.definition": "Definitie",
    "begriffe.feld.synonyme": "Toegestane synoniemen",
    "begriffe.feld.unerwuenscht": "Te vermijden benamingen",
    "begriffe.feld.synonymeEingabe": "Toegestane synoniemen (gescheiden door komma's)",
    "begriffe.feld.unerwuenschtEingabe": "Te vermijden benamingen (gescheiden door komma's)",
    "begriffe.sprache.de": "Duits",
    "begriffe.sprache.en": "Engels",
    "begriffe.eintrag.meta":
      "Toepassingsgebied: {{bereich}} · Beheer: {{verantwortlich}} · Versie {{version}}",
    "begriffe.verlauf.laedt": "Versies worden geladen …",
    "begriffe.verlauf.fehler": "De versies konden niet worden geladen.",
    "begriffe.verlauf.fassung": "Versie {{version}} · {{zeit}} · {{wer}}",
    "begriffe.formular.hinweis":
      "Eén taal is genoeg. Als beide worden beheerd, gelden ze als hetzelfde begrip; voorstellen worden toch alleen binnen dezelfde taal gedaan. Elke wijziging wordt als nieuwe versie opgeslagen; bestaande inhoud wordt niet gewijzigd.",
    "begriffe.formular.speichern": "Opslaan",
    "begriffe.formular.abbrechen": "Annuleren",
    "begriffe.fehler.doppelt":
      "Dit begrip bestaat al in hetzelfde toepassingsgebied. Bewerk het bestaande item.",
    "begriffe.fehler.veraltet":
      "Het item is intussen gewijzigd. Laad de pagina opnieuw en voer de wijziging opnieuw uit.",
    "begriffe.fehler.widerspruch":
      "Een benaming staat zowel als toegestaan als als te vermijden vermeld.",
    "begriffe.fehler.ungueltig":
      "Vul toepassingsgebied, beheerder, minstens één voorkeursterm en een definitie in.",
    "begriffe.fehler.recht":
      "Daarvoor heb je geen recht. Begrippen worden beheerd door reviewers en beheerders.",
    "begriffe.fehler.anmeldung": "Meld je opnieuw aan.",
    "begriffe.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",
  },
} satisfies Textmodul;
