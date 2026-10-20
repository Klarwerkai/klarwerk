import type { Textmodul } from "./intern/pruefung";
export default {
  praefix: "wissenspflege.",
  legacySchluessel: [],
  de: {
    "wissenspflege.vorlage": "Routinenvorlage",
    "wissenspflege.bericht": "Persönlicher Aufgaben- und Notizenbericht",
    "wissenspflege.offene_pruefungen": "Offene Prüfungen erinnern",
    "wissenspflege.quellaenderung": "Geänderte Quellen melden",
    "wissenspflege.aktualitaet": "Regelmäßige Aktualitätsprüfung",
    "wissenspflege.zweck":
      "Bereitet Prüfunterlagen und Rückfragen für die ausgewählten Wissensquellen vor. Fachliche Gültigkeit, erledigte Wartung oder Einarbeitung werden dadurch nicht bestätigt.",
    "wissenspflege.rahmen":
      "Persönlicher Auftrag: Du bist zuständig und erhältst das Ergebnis intern in deinen Notizen und der Glocke. Zeitpunkt, Zeitzone, Wiederholung und Ende stehen im Terminplan.",
    "wissenspflege.polling":
      "Der Terminplan prüft die ausgewählten Quellenfassungen. Erst eine neue gespeicherte Fassung ergibt einen Änderungshinweis; Zeitablauf allein ist keine Quellenänderung.",
    "wissenspflege.zeitplan":
      "Zum Termin werden der tatsächliche Prüfstand und die vorhandene Klarwerk-Frische gelesen. Es wird keine fachliche Prüfung abgeschlossen.",
    "wissenspflege.suche": "Wissensquelle suchen (mindestens zwei Zeichen)",
    "wissenspflege.leer": "Keine Quelle gefunden.",
    "wissenspflege.quellfehler":
      "Die Quellen konnten nicht vollständig gelesen werden. Bitte erneut versuchen.",
    "wissenspflege.auswahl": "{{anzahl}} Wissensquellen ausgewählt",
    "wissenspflege.entfernen": "Auswahl entfernen",
    "wissenspflege.quelle": "Wissensquelle {{nummer}} öffnen",
    "wissenspflege.vorschau": "Quellenauswahl ohne Wirkung prüfen",
    "wissenspflege.vorschauBereit":
      "Auswahl und aktuelle Rechte geprüft. Die Vorschau legt keinen Auftrag oder Bericht an. Beim Speichern wird der aktuelle Ausgangsstand neu gelesen.",
    "wissenspflege.prueft": "Wird geprüft …",
    "wissenspflege.fehler":
      "Die Auswahl konnte nicht bestätigt werden. Bitte Quellen und aktuellen Stand prüfen.",
    "wissenspflege.aendern": "Wissenspflegevorlage oder Quellen ändern",
    "wissenspflege.speichern": "Geprüfte Änderung übernehmen",
    "wissenspflege.berichtOeffnen": "Originalbericht öffnen",
    "wissenspflege.stand.vorbereitet": "Prüfunterlagen vorbereitet",
    "wissenspflege.stand.ohne_quellaenderung": "Quellen geprüft · keine neue Quellfassung",
    "wissenspflege.stand.ungeprueft": "Quelle ungeprüft",
    "wissenspflege.stand.ergebnis_entfernt":
      "Frühere Unterlagen entfernt · derselbe Quellstand erzeugt keine neue Kopie",
    "wissenspflege.geprueftAm": "Tatsächlicher Prüfversuch: {{zeit}}",
    "wissenspflege.zuletzt": "Letzte erfolgreiche Quellenprüfung: {{zeit}}",
    "wissenspflege.nie": "Bisher kein erfolgreicher Prüfzeitpunkt belegt",
  },
  en: {
    "wissenspflege.vorlage": "Routine template",
    "wissenspflege.bericht": "Personal task and notes report",
    "wissenspflege.offene_pruefungen": "Remind about open reviews",
    "wissenspflege.quellaenderung": "Report changed sources",
    "wissenspflege.aktualitaet": "Regular freshness review",
    "wissenspflege.zweck":
      "Prepares review materials and questions for the selected knowledge sources. This does not confirm professional validity, completed maintenance or onboarding.",
    "wissenspflege.rahmen":
      "Personal commission: you are responsible and receive the internal result in your notes and notification bell. Time, time zone, repetition and end are set in the schedule.",
    "wissenspflege.polling":
      "The schedule checks the selected source versions. Only a new stored version produces a change notice; elapsed time alone is not a source change.",
    "wissenspflege.zeitplan":
      "At the scheduled time, the actual review state and existing Klarwerk freshness are read. No professional review is completed.",
    "wissenspflege.suche": "Find a knowledge source (at least two characters)",
    "wissenspflege.leer": "No source found.",
    "wissenspflege.quellfehler": "The sources could not be fully read. Please try again.",
    "wissenspflege.auswahl": "{{anzahl}} knowledge sources selected",
    "wissenspflege.entfernen": "Remove selection",
    "wissenspflege.quelle": "Open knowledge source {{nummer}}",
    "wissenspflege.vorschau": "Check source selection without effects",
    "wissenspflege.vorschauBereit":
      "Selection and current permissions checked. The preview creates no commission or report. The current baseline is read again when saving.",
    "wissenspflege.prueft": "Checking …",
    "wissenspflege.fehler":
      "The selection could not be confirmed. Please check the sources and current state.",
    "wissenspflege.aendern": "Change knowledge care template or sources",
    "wissenspflege.speichern": "Apply checked change",
    "wissenspflege.berichtOeffnen": "Open original report",
    "wissenspflege.stand.vorbereitet": "Review materials prepared",
    "wissenspflege.stand.ohne_quellaenderung": "Sources checked · no new source version",
    "wissenspflege.stand.ungeprueft": "Source unchecked",
    "wissenspflege.stand.ergebnis_entfernt":
      "Previous materials removed · the same source version creates no new copy",
    "wissenspflege.geprueftAm": "Actual review attempt: {{zeit}}",
    "wissenspflege.zuletzt": "Last successful source check: {{zeit}}",
    "wissenspflege.nie": "No successful check time recorded yet",
  },
  nl: {
    "wissenspflege.vorlage": "Routinesjabloon",
    "wissenspflege.bericht": "Persoonlijk taken- en notitieverslag",
    "wissenspflege.offene_pruefungen": "Herinneren aan open controles",
    "wissenspflege.quellaenderung": "Gewijzigde bronnen melden",
    "wissenspflege.aktualitaet": "Regelmatige actualiteitscontrole",
    "wissenspflege.zweck":
      "Bereidt controlemateriaal en vragen voor de geselecteerde kennisbronnen voor. Dit bevestigt geen vakinhoudelijke geldigheid, uitgevoerd onderhoud of inwerken.",
    "wissenspflege.rahmen":
      "Persoonlijke opdracht: jij bent verantwoordelijk en ontvangt het interne resultaat in je notities en meldingen. Tijdstip, tijdzone, herhaling en einde staan in het tijdschema.",
    "wissenspflege.polling":
      "Het tijdschema controleert de geselecteerde bronversies. Alleen een nieuwe opgeslagen versie geeft een wijzigingsmelding; verstreken tijd is op zichzelf geen bronwijziging.",
    "wissenspflege.zeitplan":
      "Op het geplande tijdstip worden de werkelijke controlestatus en bestaande Klarwerk-actualiteit gelezen. Er wordt geen vakinhoudelijke controle afgerond.",
    "wissenspflege.suche": "Kennisbron zoeken (minstens twee tekens)",
    "wissenspflege.leer": "Geen bron gevonden.",
    "wissenspflege.quellfehler":
      "De bronnen konden niet volledig worden gelezen. Probeer het opnieuw.",
    "wissenspflege.auswahl": "{{anzahl}} kennisbronnen geselecteerd",
    "wissenspflege.entfernen": "Selectie verwijderen",
    "wissenspflege.quelle": "Kennisbron {{nummer}} openen",
    "wissenspflege.vorschau": "Bronselectie zonder gevolgen controleren",
    "wissenspflege.vorschauBereit":
      "Selectie en actuele rechten gecontroleerd. Het voorbeeld maakt geen opdracht of verslag aan. Bij opslaan wordt de actuele uitgangsversie opnieuw gelezen.",
    "wissenspflege.prueft": "Wordt gecontroleerd …",
    "wissenspflege.fehler":
      "De selectie kon niet worden bevestigd. Controleer de bronnen en actuele status.",
    "wissenspflege.aendern": "Sjabloon of bronnen voor kennisonderhoud wijzigen",
    "wissenspflege.speichern": "Gecontroleerde wijziging toepassen",
    "wissenspflege.berichtOeffnen": "Origineel verslag openen",
    "wissenspflege.stand.vorbereitet": "Controlemateriaal voorbereid",
    "wissenspflege.stand.ohne_quellaenderung": "Bronnen gecontroleerd · geen nieuwe bronversie",
    "wissenspflege.stand.ungeprueft": "Bron niet gecontroleerd",
    "wissenspflege.stand.ergebnis_entfernt":
      "Eerder materiaal verwijderd · dezelfde bronversie maakt geen nieuwe kopie",
    "wissenspflege.geprueftAm": "Werkelijke controlepoging: {{zeit}}",
    "wissenspflege.zuletzt": "Laatste geslaagde broncontrole: {{zeit}}",
    "wissenspflege.nie": "Nog geen geslaagd controletijdstip vastgelegd",
  },
} satisfies Textmodul;
