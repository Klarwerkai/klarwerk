// ================================================================================================
// ADMIN-12 · KOMMUNIKATIONSREGELN — die Texte der Seite „Meldungen und Kanäle“ (`/kommunikation`).
// ================================================================================================
//
// Die Texte halten vier Dinge auseinander: Unternehmensvorgabe, persönliche Einstellung,
// Zusammenfassung und verbindliche Kenntnisnahme. Ein Kanal, der nicht angeschlossen ist, heisst
// so — er wird nie als wählbar beschrieben.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "kommunikation.",
  legacySchluessel: [],
  de: {
    "kommunikation.titel": "Meldungen und Kanäle",
    "kommunikation.lead":
      "Welches Ereignis wen über welchen Kanal wie oft erreicht — und was du selbst einstellen kannst.",
    "kommunikation.laedt": "Wird geladen …",
    "kommunikation.zurueck": "Zurück zur Verwaltung",
    "kommunikation.fehler.allgemein": "Das hat nicht geklappt. Bitte erneut versuchen.",
    "kommunikation.fehler.anmeldung": "Bitte melde dich erneut an.",
    "kommunikation.fehler.veraltet":
      "Die Vorgaben wurden inzwischen von jemand anderem geändert. Lade die Seite neu und prüfe deine Änderung erneut.",
    "kommunikation.fehler.kanal":
      "Mailversand ist in dieser Instanz nicht eingerichtet und kann deshalb nicht aktiviert werden.",
    "kommunikation.fehler.nichtAbwaehlbar":
      "Diese Meldung ist nicht abwählbar — die Unternehmensvorgabe hat es inzwischen geändert. Lade die Seite neu.",
    "kommunikation.fehler.mailNurSofort":
      "Mail gibt es nur bei sofortiger Meldung; die tägliche Zusammenfassung steht in der Glocke.",
    "kommunikation.fehler.nichtHaltbar":
      "Diese Instanz kann Einstellungen nicht dauerhaft speichern. Es wurde nichts geändert.",
    "kommunikation.fehler.berechtigung": "Unternehmensvorgaben darf nur die Verwaltung ändern.",
    "kommunikation.uebersicht.titel": "Ereignisse, Empfänger und Kanäle",
    "kommunikation.spalte.ereignis": "Ereignis",
    "kommunikation.spalte.zielgruppe": "Wer bekommt sie",
    "kommunikation.spalte.kanaele": "Kanäle",
    "kommunikation.spalte.haeufigkeit": "Wie oft",
    "kommunikation.spalte.abwahl": "Persönlich",
    "kommunikation.ereignis.veroeffentlichung": "Veröffentlichung oder Aktualisierung (normal)",
    "kommunikation.ereignis.veroeffentlichung_hervorgehoben":
      "Veröffentlichung oder Aktualisierung (hervorgehoben)",
    "kommunikation.ereignis.kenntnisnahme": "Angeforderte Kenntnisnahme",
    "kommunikation.ereignis.zuweisung": "Prüfauftrag und Rückgabe zur Nacharbeit",
    "kommunikation.ereignis.frische": "Fällige Überprüfung eigenen Wissens",
    "kommunikation.ereignis.reklamation": "Gemeldete Antwort zum eigenen Wissen",
    "kommunikation.ereignis.wirkung": "„Dein Wissen hat geholfen“",
    "kommunikation.ereignis.loeschantrag": "Löschantrag (Datenschutz)",
    "kommunikation.ereignis.qualitaet": "Konflikt, Dublette oder Wissenslücke",
    "kommunikation.zielgruppe.leser_ohne_veroeffentlicher":
      "Alle, die den Eintrag lesen dürfen — außer der veröffentlichenden Person",
    "kommunikation.zielgruppe.ausgewaehlte_empfaenger":
      "Die ausgewählten Empfänger, solange sie den Eintrag lesen dürfen",
    "kommunikation.zielgruppe.zugewiesene_pruefer":
      "Die zugewiesenen Prüfer bzw. die verantwortliche Person",
    "kommunikation.zielgruppe.verantwortliche_person": "Die verantwortliche Person des Eintrags",
    "kommunikation.zielgruppe.autor": "Die Autorin bzw. der Autor des Eintrags",
    "kommunikation.zielgruppe.verwaltung": "Die Verwaltung (Konten verwalten)",
    "kommunikation.zielgruppe.leser_mit_sicht": "Alle, die die beteiligten Einträge sehen dürfen",
    "kommunikation.kanal.glocke": "Glocke",
    "kommunikation.kanal.mail": "Mail",
    "kommunikation.kanal.push": "Push",
    "kommunikation.zustand.aktiv": "aktiv",
    "kommunikation.zustand.aus": "aus",
    "kommunikation.zustand.nicht_eingerichtet": "nicht eingerichtet",
    "kommunikation.zustand.nicht_angeschlossen": "nicht angeschlossen",
    "kommunikation.haeufigkeit.sofort": "sofort",
    "kommunikation.haeufigkeit.taeglich": "tägliche Zusammenfassung",
    "kommunikation.erinnerung": "mit Erinnerung",
    "kommunikation.abwahl.ja": "abwählbar",
    "kommunikation.abwahl.nein": "nicht abwählbar",
    "kommunikation.verbindlich": "verbindlich — muss bestätigt werden",
    "kommunikation.wirkung.titel": "So wirken Veröffentlichung und Aktualisierung",
    "kommunikation.wirkung.still":
      "Still: keine übliche Meldung. Der Eintrag bleibt für Berechtigte auffindbar und steht im Verlauf. Eine angeforderte Kenntnisnahme wird trotzdem gemeldet.",
    "kommunikation.wirkung.normal":
      "Normal: eine Meldung an alle, die den Eintrag lesen dürfen — außer an Personen, die diese Meldung abgewählt haben. Bei täglicher Zusammenfassung kommt sie gebündelt am Folgetag.",
    "kommunikation.wirkung.hervorgehoben":
      "Hervorgehoben: dieselben Personen wie bei „Normal“, sofort, als wichtig markiert und nicht abwählbar. Niemand bekommt dadurch zusätzliche Leserechte.",
    "kommunikation.wirkung.aktualisierung":
      "Aktualisierung: eine neue gültige Fassung wird mit derselben Wahl gemeldet. Offene Kenntnisnahmen einer früheren Fassung nennt die Vorschau vor dem Veröffentlichen.",
    "kommunikation.wirkung.unabhaengig":
      "Wer lesen darf und ob eine Fassung fachlich freigegeben ist, ändert keine dieser Wahlen.",
    "kommunikation.wirkung.zusammenfassung":
      "Zusammenfassung: enthält nur Einträge, die die Person beim Abruf noch lesen darf, und nichts, was sie abgewählt hat.",
    "kommunikation.wirkung.kenntnisnahme":
      "Verbindliche Kenntnisnahme: kommt immer einzeln und sofort, mit Erinnerung, und muss bestätigt werden — weder „still“ noch eine persönliche Abwahl noch die Zusammenfassung ändern das.",
    "kommunikation.meine.titel": "Meine Einstellungen",
    "kommunikation.meine.erklaerung":
      "Abgewählte Meldungen erscheinen nicht in deiner Glocke und kommen nicht per Mail. Deine Leserechte bleiben unverändert — die Einträge bleiben für dich auffindbar.",
    "kommunikation.meine.erhalten": "Erhalten",
    "kommunikation.meine.nichtAbwaehlbar": "Nicht abwählbar (Unternehmensvorgabe)",
    "kommunikation.meine.unwirksam":
      "Von dir abgewählt — die Unternehmensvorgabe erlaubt das derzeit nicht, deshalb kommt die Meldung trotzdem.",
    "kommunikation.meine.gespeichert": "Gespeichert.",
    "kommunikation.vorgabe.titel": "Unternehmensvorgaben",
    "kommunikation.vorgabe.werk": "Werksvorgabe — noch nie geändert.",
    "kommunikation.vorgabe.stand": "Fassung {{version}} · geändert von {{name}} am {{datum}}",
    "kommunikation.vorgabe.nurLesen":
      "Diese Vorgaben gelten für alle. Ändern darf sie nur die Verwaltung.",
    "kommunikation.vorgabe.abwaehlbar": "Persönlich abwählbar",
    "kommunikation.vorgabe.haeufigkeit": "Wie oft",
    "kommunikation.vorgabe.mail": "Zusätzlich per Mail",
    "kommunikation.vorgabe.mailNichtEingerichtet":
      "Mailversand ist in dieser Instanz nicht eingerichtet — Mail kann nicht aktiviert werden.",
    "kommunikation.vorgabe.pushNichtAngeschlossen":
      "Push ist nicht angeschlossen und kann nicht gewählt werden.",
    "kommunikation.vorgabe.speichern": "Vorgaben speichern",
    "kommunikation.vorgabe.speichert": "Wird gespeichert …",
    "kommunikation.vorgabe.gespeichert": "Gespeichert als Fassung {{version}}.",
    "kommunikation.vorgabe.unveraendert": "Nichts geändert — es entsteht keine neue Fassung.",
    "kommunikation.vorgabe.verwerfen": "Änderungen verwerfen",
    "kommunikation.protokoll.titel": "Protokoll der Vorgaben",
    "kommunikation.protokoll.leer": "Noch keine Änderung — es gilt die Werksvorgabe.",
    "kommunikation.protokoll.zeile": "Fassung {{version}} · {{name}} · {{datum}}",
    "kommunikation.glocke.zusammenfassung":
      "Zusammenfassung vom {{datum}} · {{anzahl}} veröffentlicht",
    "kommunikation.profil.zeile": "Meldungen und Kanäle",
    "kommunikation.verwaltung.ziel": "Meldungen und Kanäle",
  },
  en: {
    "kommunikation.titel": "Notifications and channels",
    "kommunikation.lead":
      "Which event reaches whom, through which channel and how often — and what you can set yourself.",
    "kommunikation.laedt": "Loading …",
    "kommunikation.zurueck": "Back to administration",
    "kommunikation.fehler.allgemein": "That did not work. Please try again.",
    "kommunikation.fehler.anmeldung": "Please sign in again.",
    "kommunikation.fehler.veraltet":
      "Someone else has changed the rules in the meantime. Reload the page and check your change again.",
    "kommunikation.fehler.kanal":
      "Email delivery is not set up on this instance, so it cannot be activated.",
    "kommunikation.fehler.nichtAbwaehlbar":
      "This notification cannot be turned off — the company rule has changed. Reload the page.",
    "kommunikation.fehler.mailNurSofort":
      "Email is only available for immediate notifications; the daily summary appears in the bell.",
    "kommunikation.fehler.nichtHaltbar":
      "This instance cannot store settings permanently. Nothing was changed.",
    "kommunikation.fehler.berechtigung": "Only administrators can change company rules.",
    "kommunikation.uebersicht.titel": "Events, recipients and channels",
    "kommunikation.spalte.ereignis": "Event",
    "kommunikation.spalte.zielgruppe": "Who receives it",
    "kommunikation.spalte.kanaele": "Channels",
    "kommunikation.spalte.haeufigkeit": "How often",
    "kommunikation.spalte.abwahl": "Personal",
    "kommunikation.ereignis.veroeffentlichung": "Publication or update (normal)",
    "kommunikation.ereignis.veroeffentlichung_hervorgehoben": "Publication or update (highlighted)",
    "kommunikation.ereignis.kenntnisnahme": "Requested acknowledgement",
    "kommunikation.ereignis.zuweisung": "Review assignment and return for rework",
    "kommunikation.ereignis.frische": "Due review of your own knowledge",
    "kommunikation.ereignis.reklamation": "Reported answer about your knowledge",
    "kommunikation.ereignis.wirkung": "“Your knowledge helped”",
    "kommunikation.ereignis.loeschantrag": "Deletion request (data protection)",
    "kommunikation.ereignis.qualitaet": "Conflict, duplicate or knowledge gap",
    "kommunikation.zielgruppe.leser_ohne_veroeffentlicher":
      "Everyone allowed to read the entry — except the person publishing",
    "kommunikation.zielgruppe.ausgewaehlte_empfaenger":
      "The selected recipients, as long as they may read the entry",
    "kommunikation.zielgruppe.zugewiesene_pruefer":
      "The assigned reviewers or the responsible person",
    "kommunikation.zielgruppe.verantwortliche_person": "The person responsible for the entry",
    "kommunikation.zielgruppe.autor": "The author of the entry",
    "kommunikation.zielgruppe.verwaltung": "Administration (manage accounts)",
    "kommunikation.zielgruppe.leser_mit_sicht": "Everyone allowed to see the entries involved",
    "kommunikation.kanal.glocke": "Bell",
    "kommunikation.kanal.mail": "Email",
    "kommunikation.kanal.push": "Push",
    "kommunikation.zustand.aktiv": "active",
    "kommunikation.zustand.aus": "off",
    "kommunikation.zustand.nicht_eingerichtet": "not set up",
    "kommunikation.zustand.nicht_angeschlossen": "not connected",
    "kommunikation.haeufigkeit.sofort": "immediately",
    "kommunikation.haeufigkeit.taeglich": "daily summary",
    "kommunikation.erinnerung": "with reminder",
    "kommunikation.abwahl.ja": "can be turned off",
    "kommunikation.abwahl.nein": "cannot be turned off",
    "kommunikation.verbindlich": "mandatory — must be confirmed",
    "kommunikation.wirkung.titel": "How publication and update work",
    "kommunikation.wirkung.still":
      "Silent: no usual notification. The entry stays findable for authorised people and appears in the history. A requested acknowledgement is still notified.",
    "kommunikation.wirkung.normal":
      "Normal: one notification to everyone allowed to read the entry — except people who turned this notification off. With a daily summary it arrives bundled the next day.",
    "kommunikation.wirkung.hervorgehoben":
      "Highlighted: the same people as “Normal”, immediately, marked as important and cannot be turned off. Nobody gains additional read access.",
    "kommunikation.wirkung.aktualisierung":
      "Update: a new valid version is notified with the same choice. Open acknowledgements of an earlier version are listed in the preview before publishing.",
    "kommunikation.wirkung.unabhaengig":
      "None of these choices changes who may read or whether a version is approved.",
    "kommunikation.wirkung.zusammenfassung":
      "Summary: contains only entries the person may still read when it is retrieved, and nothing they turned off.",
    "kommunikation.wirkung.kenntnisnahme":
      "Mandatory acknowledgement: always arrives individually and immediately, with reminder, and must be confirmed — neither “silent”, a personal opt-out nor the summary changes that.",
    "kommunikation.meine.titel": "My settings",
    "kommunikation.meine.erklaerung":
      "Notifications you turn off do not appear in your bell and are not emailed. Your read access stays the same — the entries remain findable for you.",
    "kommunikation.meine.erhalten": "Receive",
    "kommunikation.meine.nichtAbwaehlbar": "Cannot be turned off (company rule)",
    "kommunikation.meine.unwirksam":
      "Turned off by you — the company rule does not allow this at the moment, so the notification still arrives.",
    "kommunikation.meine.gespeichert": "Saved.",
    "kommunikation.vorgabe.titel": "Company rules",
    "kommunikation.vorgabe.werk": "Default rules — never changed.",
    "kommunikation.vorgabe.stand": "Version {{version}} · changed by {{name}} on {{datum}}",
    "kommunikation.vorgabe.nurLesen":
      "These rules apply to everyone. Only administrators can change them.",
    "kommunikation.vorgabe.abwaehlbar": "Can be turned off personally",
    "kommunikation.vorgabe.haeufigkeit": "How often",
    "kommunikation.vorgabe.mail": "Also by email",
    "kommunikation.vorgabe.mailNichtEingerichtet":
      "Email delivery is not set up on this instance — email cannot be activated.",
    "kommunikation.vorgabe.pushNichtAngeschlossen": "Push is not connected and cannot be selected.",
    "kommunikation.vorgabe.speichern": "Save rules",
    "kommunikation.vorgabe.speichert": "Saving …",
    "kommunikation.vorgabe.gespeichert": "Saved as version {{version}}.",
    "kommunikation.vorgabe.unveraendert": "Nothing changed — no new version is created.",
    "kommunikation.vorgabe.verwerfen": "Discard changes",
    "kommunikation.protokoll.titel": "Rule history",
    "kommunikation.protokoll.leer": "No change yet — the default rules apply.",
    "kommunikation.protokoll.zeile": "Version {{version}} · {{name}} · {{datum}}",
    "kommunikation.glocke.zusammenfassung": "Summary of {{datum}} · {{anzahl}} published",
    "kommunikation.profil.zeile": "Notifications and channels",
    "kommunikation.verwaltung.ziel": "Notifications and channels",
  },
  nl: {
    "kommunikation.titel": "Meldingen en kanalen",
    "kommunikation.lead":
      "Welke gebeurtenis wie via welk kanaal hoe vaak bereikt — en wat je zelf kunt instellen.",
    "kommunikation.laedt": "Wordt geladen …",
    "kommunikation.zurueck": "Terug naar beheer",
    "kommunikation.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",
    "kommunikation.fehler.anmeldung": "Meld je opnieuw aan.",
    "kommunikation.fehler.veraltet":
      "Iemand anders heeft de regels intussen gewijzigd. Laad de pagina opnieuw en controleer je wijziging.",
    "kommunikation.fehler.kanal":
      "E-mailverzending is op deze instantie niet ingericht en kan daarom niet worden geactiveerd.",
    "kommunikation.fehler.nichtAbwaehlbar":
      "Deze melding kan niet worden uitgezet — de bedrijfsregel is gewijzigd. Laad de pagina opnieuw.",
    "kommunikation.fehler.mailNurSofort":
      "E-mail is er alleen bij directe meldingen; de dagelijkse samenvatting staat in de bel.",
    "kommunikation.fehler.nichtHaltbar":
      "Deze instantie kan instellingen niet blijvend opslaan. Er is niets gewijzigd.",
    "kommunikation.fehler.berechtigung": "Alleen beheerders kunnen bedrijfsregels wijzigen.",
    "kommunikation.uebersicht.titel": "Gebeurtenissen, ontvangers en kanalen",
    "kommunikation.spalte.ereignis": "Gebeurtenis",
    "kommunikation.spalte.zielgruppe": "Wie ontvangt het",
    "kommunikation.spalte.kanaele": "Kanalen",
    "kommunikation.spalte.haeufigkeit": "Hoe vaak",
    "kommunikation.spalte.abwahl": "Persoonlijk",
    "kommunikation.ereignis.veroeffentlichung": "Publicatie of update (normaal)",
    "kommunikation.ereignis.veroeffentlichung_hervorgehoben": "Publicatie of update (uitgelicht)",
    "kommunikation.ereignis.kenntnisnahme": "Gevraagde kennisname",
    "kommunikation.ereignis.zuweisung": "Beoordelingsopdracht en teruggave voor herwerking",
    "kommunikation.ereignis.frische": "Verschuldigde controle van eigen kennis",
    "kommunikation.ereignis.reklamation": "Gemeld antwoord over eigen kennis",
    "kommunikation.ereignis.wirkung": "„Je kennis heeft geholpen”",
    "kommunikation.ereignis.loeschantrag": "Verwijderverzoek (privacy)",
    "kommunikation.ereignis.qualitaet": "Conflict, duplicaat of kennislacune",
    "kommunikation.zielgruppe.leser_ohne_veroeffentlicher":
      "Iedereen die het item mag lezen — behalve de persoon die publiceert",
    "kommunikation.zielgruppe.ausgewaehlte_empfaenger":
      "De gekozen ontvangers, zolang ze het item mogen lezen",
    "kommunikation.zielgruppe.zugewiesene_pruefer":
      "De toegewezen beoordelaars of de verantwoordelijke persoon",
    "kommunikation.zielgruppe.verantwortliche_person": "De verantwoordelijke persoon van het item",
    "kommunikation.zielgruppe.autor": "De auteur van het item",
    "kommunikation.zielgruppe.verwaltung": "Beheer (accounts beheren)",
    "kommunikation.zielgruppe.leser_mit_sicht": "Iedereen die de betrokken items mag zien",
    "kommunikation.kanal.glocke": "Bel",
    "kommunikation.kanal.mail": "E-mail",
    "kommunikation.kanal.push": "Push",
    "kommunikation.zustand.aktiv": "actief",
    "kommunikation.zustand.aus": "uit",
    "kommunikation.zustand.nicht_eingerichtet": "niet ingericht",
    "kommunikation.zustand.nicht_angeschlossen": "niet aangesloten",
    "kommunikation.haeufigkeit.sofort": "direct",
    "kommunikation.haeufigkeit.taeglich": "dagelijkse samenvatting",
    "kommunikation.erinnerung": "met herinnering",
    "kommunikation.abwahl.ja": "kan worden uitgezet",
    "kommunikation.abwahl.nein": "kan niet worden uitgezet",
    "kommunikation.verbindlich": "verplicht — moet worden bevestigd",
    "kommunikation.wirkung.titel": "Zo werken publicatie en update",
    "kommunikation.wirkung.still":
      "Stil: geen gebruikelijke melding. Het item blijft vindbaar voor bevoegden en staat in de geschiedenis. Een gevraagde kennisname wordt toch gemeld.",
    "kommunikation.wirkung.normal":
      "Normaal: één melding aan iedereen die het item mag lezen — behalve aan personen die deze melding hebben uitgezet. Bij een dagelijkse samenvatting komt ze gebundeld de volgende dag.",
    "kommunikation.wirkung.hervorgehoben":
      "Uitgelicht: dezelfde personen als bij „Normaal”, direct, gemarkeerd als belangrijk en niet uit te zetten. Niemand krijgt daardoor extra leesrechten.",
    "kommunikation.wirkung.aktualisierung":
      "Update: een nieuwe geldige versie wordt met dezelfde keuze gemeld. Open kennisnames van een eerdere versie staan in het voorbeeld vóór het publiceren.",
    "kommunikation.wirkung.unabhaengig":
      "Geen van deze keuzes verandert wie mag lezen of of een versie inhoudelijk is goedgekeurd.",
    "kommunikation.wirkung.zusammenfassung":
      "Samenvatting: bevat alleen items die de persoon bij het ophalen nog mag lezen, en niets wat die heeft uitgezet.",
    "kommunikation.wirkung.kenntnisnahme":
      "Verplichte kennisname: komt altijd afzonderlijk en direct, met herinnering, en moet worden bevestigd — „stil”, persoonlijk uitzetten of de samenvatting veranderen dat niet.",
    "kommunikation.meine.titel": "Mijn instellingen",
    "kommunikation.meine.erklaerung":
      "Uitgezette meldingen verschijnen niet in je bel en komen niet per e-mail. Je leesrechten blijven gelijk — de items blijven voor jou vindbaar.",
    "kommunikation.meine.erhalten": "Ontvangen",
    "kommunikation.meine.nichtAbwaehlbar": "Kan niet worden uitgezet (bedrijfsregel)",
    "kommunikation.meine.unwirksam":
      "Door jou uitgezet — de bedrijfsregel staat dat momenteel niet toe, daarom komt de melding toch.",
    "kommunikation.meine.gespeichert": "Opgeslagen.",
    "kommunikation.vorgabe.titel": "Bedrijfsregels",
    "kommunikation.vorgabe.werk": "Standaardregels — nooit gewijzigd.",
    "kommunikation.vorgabe.stand": "Versie {{version}} · gewijzigd door {{name}} op {{datum}}",
    "kommunikation.vorgabe.nurLesen":
      "Deze regels gelden voor iedereen. Alleen beheerders kunnen ze wijzigen.",
    "kommunikation.vorgabe.abwaehlbar": "Persoonlijk uit te zetten",
    "kommunikation.vorgabe.haeufigkeit": "Hoe vaak",
    "kommunikation.vorgabe.mail": "Ook per e-mail",
    "kommunikation.vorgabe.mailNichtEingerichtet":
      "E-mailverzending is op deze instantie niet ingericht — e-mail kan niet worden geactiveerd.",
    "kommunikation.vorgabe.pushNichtAngeschlossen":
      "Push is niet aangesloten en kan niet worden gekozen.",
    "kommunikation.vorgabe.speichern": "Regels opslaan",
    "kommunikation.vorgabe.speichert": "Wordt opgeslagen …",
    "kommunikation.vorgabe.gespeichert": "Opgeslagen als versie {{version}}.",
    "kommunikation.vorgabe.unveraendert": "Niets gewijzigd — er ontstaat geen nieuwe versie.",
    "kommunikation.vorgabe.verwerfen": "Wijzigingen verwerpen",
    "kommunikation.protokoll.titel": "Geschiedenis van de regels",
    "kommunikation.protokoll.leer": "Nog geen wijziging — de standaardregels gelden.",
    "kommunikation.protokoll.zeile": "Versie {{version}} · {{name}} · {{datum}}",
    "kommunikation.glocke.zusammenfassung": "Samenvatting van {{datum}} · {{anzahl}} gepubliceerd",
    "kommunikation.profil.zeile": "Meldingen en kanalen",
    "kommunikation.verwaltung.ziel": "Meldingen en kanalen",
  },
} satisfies Textmodul;
