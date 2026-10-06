// ================================================================================================
// KENNTNISNAHME · die Texte der Kenntnisnahme einer gültigen Fassung.
// ================================================================================================
//
// Das Ergebnis heisst durchgehend KENNTNISNAHME. Die Texte sagen ausdrücklich, was sie NICHT ist:
// keine Freigabe des Inhalts, kein Nachweis von Verständnis oder Ausführung und keine elektronische
// Signatur. Und sie sagen, dass erst der Klick des Empfängers bestätigt — nicht das Öffnen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "kenntnisnahme.",
  legacySchluessel: [],
  de: {
    "kenntnisnahme.titel": "Kenntnisnahme",
    "kenntnisnahme.hinweis":
      "Eine Kenntnisnahme hält nur fest, dass die genannte Fassung gelesen wurde. Sie ist keine Freigabe des Inhalts, kein Nachweis von Verständnis oder Ausführung und keine elektronische Signatur.",
    "kenntnisnahme.status.ausstehend": "Ausstehend",
    "kenntnisnahme.status.bestaetigt": "Zur Kenntnis genommen",
    "kenntnisnahme.status.ueberfaellig": "Überfällig",
    "kenntnisnahme.status.ueberholt": "Durch neue Fassung überholt",
    "kenntnisnahme.frist": "Frist: {{datum}}",
    "kenntnisnahme.ohneFrist": "Ohne Frist",
    "kenntnisnahme.eigen.angefordert":
      "{{name}} hat am {{datum}} deine Kenntnisnahme von Fassung V{{fassung}} angefordert.",
    "kenntnisnahme.eigen.nichtAutomatisch":
      "Das Öffnen oder Lesen dieser Seite bestätigt nichts — erst dein Klick.",
    "kenntnisnahme.eigen.bestaetigen":
      "Ich habe Fassung V{{fassung}} gelesen und nehme sie zur Kenntnis",
    "kenntnisnahme.eigen.laeuft": "Wird gespeichert …",
    "kenntnisnahme.eigen.bestaetigt":
      "Du hast Fassung V{{fassung}} am {{datum}} zur Kenntnis genommen.",
    "kenntnisnahme.eigen.ueberholt":
      "Inzwischen gibt es Fassung V{{aktuell}}. Fassung V{{fassung}} kann nicht mehr bestätigt werden.",
    "kenntnisnahme.anfordern.titel": "Kenntnisnahme anfordern",
    "kenntnisnahme.anfordern.empfaenger":
      "Empfänger — nur Personen, die diesen Eintrag lesen dürfen",
    "kenntnisnahme.anfordern.keineEmpfaenger":
      "Es gibt keine Personen, die diesen Eintrag lesen dürfen.",
    "kenntnisnahme.anfordern.frist": "Frist (optional)",
    "kenntnisnahme.anfordern.absenden": "Kenntnisnahme von Fassung V{{fassung}} anfordern",
    "kenntnisnahme.anfordern.laeuft": "Wird angefordert …",
    "kenntnisnahme.anfordern.angelegt": "Angefordert bei {{anzahl}} Person(en).",
    "kenntnisnahme.anfordern.bereits":
      "{{anzahl}} Person(en) hatten diese Fassung bereits angefordert bekommen — es wurde nichts doppelt verschickt.",
    "kenntnisnahme.fehler.keine_gueltige_fassung":
      "Nur eine gültige (geprüfte) Fassung kann zur Kenntnisnahme verteilt werden. Ein Entwurf wird nicht als Pflichtlektüre verschickt.",
    "kenntnisnahme.fehler.fassung_veraltet":
      "Der Eintrag hat sich inzwischen geändert. Bitte neu laden und die aktuelle Fassung anfordern.",
    "kenntnisnahme.fehler.empfaenger_ohne_zugriff":
      "Mindestens eine ausgewählte Person darf diesen Eintrag nicht lesen. Eine Anforderung gibt keinen Zugriff.",
    "kenntnisnahme.fehler.frist_ungueltig": "Die Frist muss in der Zukunft liegen.",
    "kenntnisnahme.fehler.keine_empfaenger": "Bitte mindestens eine Person auswählen.",
    "kenntnisnahme.fehler.ueberholt": "Diese Fassung ist inzwischen durch eine neuere ersetzt.",
    "kenntnisnahme.fehler.fassung_abweichend":
      "Die angezeigte Fassung ist nicht die angeforderte. Bitte neu laden.",
    "kenntnisnahme.fehler.nicht_haltbar":
      "Diese Instanz kann Kenntnisnahmen nicht dauerhaft speichern; deshalb wird nichts angenommen.",
    "kenntnisnahme.fehler.allgemein": "Das hat nicht geklappt. Bitte erneut versuchen.",
    "kenntnisnahme.uebersicht.titel": "Angeforderte Kenntnisnahmen",
    "kenntnisnahme.uebersicht.leer":
      "Für diesen Eintrag wurde noch keine Kenntnisnahme angefordert.",
    "kenntnisnahme.uebersicht.kopf": "Fassung V{{fassung}} · angefordert von {{name}} am {{datum}}",
    "kenntnisnahme.uebersicht.zaehlung":
      "{{bestaetigt}} zur Kenntnis genommen · {{ausstehend}} ausstehend · {{ueberfaellig}} überfällig · {{ueberholt}} überholt",
    "kenntnisnahme.uebersicht.bestaetigtAm": "am {{datum}}",
    "kenntnisnahme.uebersicht.nachFrist": "nach Ablauf der Frist",
    "kenntnisnahme.uebersicht.keinZugriff": "kein Zugriff mehr",
    "kenntnisnahme.uebersicht.erinnern": "Offene erinnern",
    "kenntnisnahme.uebersicht.erinnert": "Zuletzt erinnert am {{datum}}",
    "kenntnisnahme.uebersicht.erinnertAnzahl": "{{anzahl}} Person(en) erinnert.",
    "kenntnisnahme.meldung": "Kenntnisnahme angefordert",
    "kenntnisnahme.meldungErinnerung": "Erinnerung zur Kenntnisnahme",
    "kenntnisnahme.meldungUeberfaellig": "Kenntnisnahme überfällig",
    "kenntnisnahme.meldungArt": "Kenntnisnahme",
  },
  en: {
    "kenntnisnahme.titel": "Acknowledgement",
    "kenntnisnahme.hinweis":
      "An acknowledgement only records that the named version was read. It is not an approval of the content, not proof of understanding or execution, and not an electronic signature.",
    "kenntnisnahme.status.ausstehend": "Pending",
    "kenntnisnahme.status.bestaetigt": "Acknowledged",
    "kenntnisnahme.status.ueberfaellig": "Overdue",
    "kenntnisnahme.status.ueberholt": "Superseded by a new version",
    "kenntnisnahme.frist": "Due: {{datum}}",
    "kenntnisnahme.ohneFrist": "No due date",
    "kenntnisnahme.eigen.angefordert":
      "{{name}} asked you on {{datum}} to acknowledge version V{{fassung}}.",
    "kenntnisnahme.eigen.nichtAutomatisch":
      "Opening or reading this page confirms nothing — only your click does.",
    "kenntnisnahme.eigen.bestaetigen": "I have read version V{{fassung}} and acknowledge it",
    "kenntnisnahme.eigen.laeuft": "Saving …",
    "kenntnisnahme.eigen.bestaetigt": "You acknowledged version V{{fassung}} on {{datum}}.",
    "kenntnisnahme.eigen.ueberholt":
      "Version V{{aktuell}} now exists. Version V{{fassung}} can no longer be acknowledged.",
    "kenntnisnahme.anfordern.titel": "Request acknowledgement",
    "kenntnisnahme.anfordern.empfaenger": "Recipients — only people who may read this entry",
    "kenntnisnahme.anfordern.keineEmpfaenger": "Nobody may read this entry.",
    "kenntnisnahme.anfordern.frist": "Due date (optional)",
    "kenntnisnahme.anfordern.absenden": "Request acknowledgement of version V{{fassung}}",
    "kenntnisnahme.anfordern.laeuft": "Requesting …",
    "kenntnisnahme.anfordern.angelegt": "Requested from {{anzahl}} person(s).",
    "kenntnisnahme.anfordern.bereits":
      "{{anzahl}} person(s) had already been asked for this version — nothing was sent twice.",
    "kenntnisnahme.fehler.keine_gueltige_fassung":
      "Only a valid (reviewed) version can be distributed for acknowledgement. A draft is not sent out as required reading.",
    "kenntnisnahme.fehler.fassung_veraltet":
      "The entry has changed in the meantime. Please reload and request the current version.",
    "kenntnisnahme.fehler.empfaenger_ohne_zugriff":
      "At least one selected person may not read this entry. A request does not grant access.",
    "kenntnisnahme.fehler.frist_ungueltig": "The due date must be in the future.",
    "kenntnisnahme.fehler.keine_empfaenger": "Please select at least one person.",
    "kenntnisnahme.fehler.ueberholt": "This version has since been replaced by a newer one.",
    "kenntnisnahme.fehler.fassung_abweichend":
      "The version shown is not the requested one. Please reload.",
    "kenntnisnahme.fehler.nicht_haltbar":
      "This instance cannot store acknowledgements durably; nothing is accepted.",
    "kenntnisnahme.fehler.allgemein": "That did not work. Please try again.",
    "kenntnisnahme.uebersicht.titel": "Requested acknowledgements",
    "kenntnisnahme.uebersicht.leer": "No acknowledgement has been requested for this entry yet.",
    "kenntnisnahme.uebersicht.kopf": "Version V{{fassung}} · requested by {{name}} on {{datum}}",
    "kenntnisnahme.uebersicht.zaehlung":
      "{{bestaetigt}} acknowledged · {{ausstehend}} pending · {{ueberfaellig}} overdue · {{ueberholt}} superseded",
    "kenntnisnahme.uebersicht.bestaetigtAm": "on {{datum}}",
    "kenntnisnahme.uebersicht.nachFrist": "after the due date",
    "kenntnisnahme.uebersicht.keinZugriff": "no access anymore",
    "kenntnisnahme.uebersicht.erinnern": "Remind open ones",
    "kenntnisnahme.uebersicht.erinnert": "Last reminded on {{datum}}",
    "kenntnisnahme.uebersicht.erinnertAnzahl": "{{anzahl}} person(s) reminded.",
    "kenntnisnahme.meldung": "Acknowledgement requested",
    "kenntnisnahme.meldungErinnerung": "Reminder to acknowledge",
    "kenntnisnahme.meldungUeberfaellig": "Acknowledgement overdue",
    "kenntnisnahme.meldungArt": "Acknowledgement",
  },
  nl: {
    "kenntnisnahme.titel": "Kennisname",
    "kenntnisnahme.hinweis":
      "Een kennisname legt alleen vast dat de genoemde versie is gelezen. Het is geen goedkeuring van de inhoud, geen bewijs van begrip of uitvoering en geen elektronische handtekening.",
    "kenntnisnahme.status.ausstehend": "Openstaand",
    "kenntnisnahme.status.bestaetigt": "Kennis genomen",
    "kenntnisnahme.status.ueberfaellig": "Te laat",
    "kenntnisnahme.status.ueberholt": "Vervangen door een nieuwe versie",
    "kenntnisnahme.frist": "Termijn: {{datum}}",
    "kenntnisnahme.ohneFrist": "Zonder termijn",
    "kenntnisnahme.eigen.angefordert":
      "{{name}} heeft je op {{datum}} gevraagd kennis te nemen van versie V{{fassung}}.",
    "kenntnisnahme.eigen.nichtAutomatisch":
      "Het openen of lezen van deze pagina bevestigt niets — pas je klik.",
    "kenntnisnahme.eigen.bestaetigen": "Ik heb versie V{{fassung}} gelezen en neem er kennis van",
    "kenntnisnahme.eigen.laeuft": "Wordt opgeslagen …",
    "kenntnisnahme.eigen.bestaetigt": "Je hebt op {{datum}} kennisgenomen van versie V{{fassung}}.",
    "kenntnisnahme.eigen.ueberholt":
      "Er is inmiddels versie V{{aktuell}}. Versie V{{fassung}} kan niet meer worden bevestigd.",
    "kenntnisnahme.anfordern.titel": "Kennisname aanvragen",
    "kenntnisnahme.anfordern.empfaenger": "Ontvangers — alleen personen die dit item mogen lezen",
    "kenntnisnahme.anfordern.keineEmpfaenger": "Niemand mag dit item lezen.",
    "kenntnisnahme.anfordern.frist": "Termijn (optioneel)",
    "kenntnisnahme.anfordern.absenden": "Kennisname van versie V{{fassung}} aanvragen",
    "kenntnisnahme.anfordern.laeuft": "Wordt aangevraagd …",
    "kenntnisnahme.anfordern.angelegt": "Aangevraagd bij {{anzahl}} persoon/personen.",
    "kenntnisnahme.anfordern.bereits":
      "{{anzahl}} persoon/personen hadden deze versie al aangevraagd gekregen — er is niets dubbel verstuurd.",
    "kenntnisnahme.fehler.keine_gueltige_fassung":
      "Alleen een geldige (gecontroleerde) versie kan ter kennisname worden verspreid. Een concept wordt niet als verplichte lectuur verstuurd.",
    "kenntnisnahme.fehler.fassung_veraltet":
      "Het item is intussen gewijzigd. Laad opnieuw en vraag de actuele versie aan.",
    "kenntnisnahme.fehler.empfaenger_ohne_zugriff":
      "Minstens één gekozen persoon mag dit item niet lezen. Een aanvraag geeft geen toegang.",
    "kenntnisnahme.fehler.frist_ungueltig": "De termijn moet in de toekomst liggen.",
    "kenntnisnahme.fehler.keine_empfaenger": "Kies minstens één persoon.",
    "kenntnisnahme.fehler.ueberholt": "Deze versie is intussen vervangen door een nieuwere.",
    "kenntnisnahme.fehler.fassung_abweichend":
      "De getoonde versie is niet de aangevraagde. Laad opnieuw.",
    "kenntnisnahme.fehler.nicht_haltbar":
      "Deze instantie kan kennisnames niet duurzaam opslaan; daarom wordt niets aangenomen.",
    "kenntnisnahme.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",
    "kenntnisnahme.uebersicht.titel": "Aangevraagde kennisnames",
    "kenntnisnahme.uebersicht.leer": "Voor dit item is nog geen kennisname aangevraagd.",
    "kenntnisnahme.uebersicht.kopf": "Versie V{{fassung}} · aangevraagd door {{name}} op {{datum}}",
    "kenntnisnahme.uebersicht.zaehlung":
      "{{bestaetigt}} kennis genomen · {{ausstehend}} openstaand · {{ueberfaellig}} te laat · {{ueberholt}} vervangen",
    "kenntnisnahme.uebersicht.bestaetigtAm": "op {{datum}}",
    "kenntnisnahme.uebersicht.nachFrist": "na afloop van de termijn",
    "kenntnisnahme.uebersicht.keinZugriff": "geen toegang meer",
    "kenntnisnahme.uebersicht.erinnern": "Openstaande herinneren",
    "kenntnisnahme.uebersicht.erinnert": "Laatst herinnerd op {{datum}}",
    "kenntnisnahme.uebersicht.erinnertAnzahl": "{{anzahl}} persoon/personen herinnerd.",
    "kenntnisnahme.meldung": "Kennisname aangevraagd",
    "kenntnisnahme.meldungErinnerung": "Herinnering voor kennisname",
    "kenntnisnahme.meldungUeberfaellig": "Kennisname te laat",
    "kenntnisnahme.meldungArt": "Kennisname",
  },
} satisfies Textmodul;
