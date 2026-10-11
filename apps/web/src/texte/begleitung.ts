// ================================================================================================
// AKTIVE BEGLEITUNG (produkt:20261011:assistenz-aktive-beobachtung · BPA-05) — die Texte.
// ================================================================================================
//
// Die Sätze sagen immer, WAS beobachtet wird, BIS WANN, und dass Mikrofon und Video aus sind. Ein
// Hinweis erklärt den nächsten Schritt; er behauptet nie, etwas eingetragen zu haben.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "begleitung.",
  legacySchluessel: [],
  de: {
    "begleitung.region": "Begleitung durch {{assistenz}}",
    "begleitung.angebot.titel": "{{assistenz}} kann diesen Vorgang begleiten",
    "begleitung.angebot.bereich": "Bereich: {{bereich}}",
    "begleitung.angebot.feld": "Was soll ich begleiten?",
    "begleitung.angebot.platzhalter": "z. B. Produktrecherche, 30 Minuten",
    "begleitung.angebot.erklaerung":
      "Gelesen werden nur die Felder dieses Vorgangs, bis zum Endpunkt. Mikrofon und Video bleiben aus, nichts wird aufgezeichnet.",
    "begleitung.angebot.starten": "Begleitung starten",
    "begleitung.fehler.zweck_fehlt": "Bitte kurz sagen, wobei ich begleiten soll.",
    "begleitung.fehler.dauer_ungueltig": "Die Dauer muss zwischen 1 Minute und 8 Stunden liegen.",
    "begleitung.fehler.medien_nicht_im_begleitmodus":
      "Beim Begleiten bleiben Mikrofon, Ton und Video aus. Eine Aufnahme ist ein eigener Modus.",
    "begleitung.fehler.abgelaufen":
      "Die Freigabe ist abgelaufen. Für eine neue Begleitung bitte neu starten.",
    "begleitung.fehler.anderes_konto":
      "Es ist ein anderes Konto angemeldet. Diese Begleitung gehört nicht dazu – bitte stoppen und neu starten.",
    "begleitung.fehler.keine_rechte":
      "Der Zugriff auf diesen Bereich ist gerade nicht erlaubt. Die Begleitung bleibt pausiert.",
    "begleitung.fehler.nicht_pausiert": "Die Begleitung ist nicht pausiert.",
    "begleitung.status.aktiv": "Begleiten · {{bereich}} · bis {{ende}}",
    "begleitung.status.pausiert": "Pausiert · {{bereich}} · bis {{ende}}",
    "begleitung.status.zweck": "Zweck: {{zweck}}",
    "begleitung.status.medien": "Mikrofon aus · Video aus · keine Aufzeichnung",
    "begleitung.status.ausserhalb":
      "Du bist außerhalb des freigegebenen Bereichs – hier wird nichts gelesen.",
    "begleitung.grund.nutzer": "Von dir pausiert.",
    "begleitung.grund.sperrbildschirm": "Pausiert, weil der Bildschirm gesperrt wurde.",
    "begleitung.grund.kontowechsel": "Pausiert, weil das Konto gewechselt hat.",
    "begleitung.grund.rechteentzug": "Pausiert, weil der Zugriff entzogen wurde.",
    "begleitung.grund.neustart":
      "Nach dem Neuladen pausiert. Fortsetzen liest frischen Kontext; der Endpunkt bleibt gleich.",
    "begleitung.knopf.pause": "Pause",
    "begleitung.knopf.fortsetzen": "Fortsetzen",
    "begleitung.knopf.stopp": "Stopp",
    "begleitung.knopf.schliessen": "Schließen",
    "begleitung.tastatur": "Tastatur: Alt+Umschalt+P Pause/Fortsetzen, Alt+Umschalt+S Stopp.",
    "begleitung.beendet.stopp":
      "Begleitung gestoppt. Der beobachtete Kontext ist verworfen, nichts davon wurde gespeichert.",
    "begleitung.beendet.abgelaufen":
      "Die Begleitung ist am Endpunkt abgelaufen. Der beobachtete Kontext ist verworfen.",
    "begleitung.hinweis.einheit":
      "Im Feld „{{feld}}“ steht „{{wert}}“ ohne Einheit. Nächster Schritt: die Einheit ergänzen ({{einheiten}}).",
    "begleitung.hinweis.einheitOhneVorgabe":
      "Im Feld „{{feld}}“ steht „{{wert}}“ ohne Einheit. Nächster Schritt: die passende Einheit ergänzen.",
    "begleitung.hinweis.selbst": "{{assistenz}} trägt nichts ein – die Änderung machst du.",
    "begleitung.hinweis.verwerfen": "Hinweis verwerfen",
    "begleitung.hinweis.notiz": "Als Notiz übernehmen",
    "begleitung.notiz.titel": "Bewusst übernommene Notizen",
    "begleitung.notiz.loeschen": "Notiz löschen",
    "begleitung.notiz.text": "{{bereich}}: „{{feld}}“ = „{{wert}}“ – Einheit fehlt",
    "begleitung.auskunft.titel": "Was ist gespeichert?",
    "begleitung.auskunft.freigabe":
      "Freigabe (Zweck, Bereich, Endpunkt) im Sitzungsspeicher dieses Tabs: {{wert}}",
    "begleitung.auskunft.notizen": "Bewusst übernommene Notizen: {{anzahl}}",
    "begleitung.auskunft.fluechtig":
      "Nur im Arbeitsspeicher, verfällt bei Pause und Stopp: {{anzahl}} gelesene Felder",
    "begleitung.auskunft.keinVerlauf":
      "Kein Verlauf, keine Aufnahme, keine Auswertung über Personen. Dateiänderungen meldet der getrennte Quellenänderungsdienst.",
    "begleitung.ja": "ja",
    "begleitung.nein": "nein",
  },
  en: {
    "begleitung.region": "{{assistenz}} accompanying you",
    "begleitung.angebot.titel": "{{assistenz}} can accompany this task",
    "begleitung.angebot.bereich": "Area: {{bereich}}",
    "begleitung.angebot.feld": "What should I accompany?",
    "begleitung.angebot.platzhalter": "e.g. product research, 30 minutes",
    "begleitung.angebot.erklaerung":
      "Only the fields of this task are read, until the end time. Microphone and video stay off, nothing is recorded.",
    "begleitung.angebot.starten": "Start accompanying",
    "begleitung.fehler.zweck_fehlt": "Please say briefly what I should accompany.",
    "begleitung.fehler.dauer_ungueltig": "The duration must be between 1 minute and 8 hours.",
    "begleitung.fehler.medien_nicht_im_begleitmodus":
      "While accompanying, microphone, audio and video stay off. Recording is a separate mode.",
    "begleitung.fehler.abgelaufen":
      "The permission has expired. Please start again for a new session.",
    "begleitung.fehler.anderes_konto":
      "A different account is signed in. This session does not belong to it – please stop and start again.",
    "begleitung.fehler.keine_rechte":
      "Access to this area is not allowed right now. The session stays paused.",
    "begleitung.fehler.nicht_pausiert": "The session is not paused.",
    "begleitung.status.aktiv": "Accompanying · {{bereich}} · until {{ende}}",
    "begleitung.status.pausiert": "Paused · {{bereich}} · until {{ende}}",
    "begleitung.status.zweck": "Purpose: {{zweck}}",
    "begleitung.status.medien": "Microphone off · video off · no recording",
    "begleitung.status.ausserhalb": "You are outside the permitted area – nothing is read here.",
    "begleitung.grund.nutzer": "Paused by you.",
    "begleitung.grund.sperrbildschirm": "Paused because the screen was locked.",
    "begleitung.grund.kontowechsel": "Paused because the account changed.",
    "begleitung.grund.rechteentzug": "Paused because access was revoked.",
    "begleitung.grund.neustart":
      "Paused after reloading. Resuming reads fresh context; the end time stays the same.",
    "begleitung.knopf.pause": "Pause",
    "begleitung.knopf.fortsetzen": "Resume",
    "begleitung.knopf.stopp": "Stop",
    "begleitung.knopf.schliessen": "Close",
    "begleitung.tastatur": "Keyboard: Alt+Shift+P pause/resume, Alt+Shift+S stop.",
    "begleitung.beendet.stopp":
      "Accompanying stopped. The observed context was discarded, none of it was saved.",
    "begleitung.beendet.abgelaufen":
      "The session ended at its end time. The observed context was discarded.",
    "begleitung.hinweis.einheit":
      "The field “{{feld}}” contains “{{wert}}” without a unit. Next step: add the unit ({{einheiten}}).",
    "begleitung.hinweis.einheitOhneVorgabe":
      "The field “{{feld}}” contains “{{wert}}” without a unit. Next step: add the matching unit.",
    "begleitung.hinweis.selbst": "{{assistenz}} does not fill anything in – you make the change.",
    "begleitung.hinweis.verwerfen": "Dismiss hint",
    "begleitung.hinweis.notiz": "Keep as note",
    "begleitung.notiz.titel": "Notes you chose to keep",
    "begleitung.notiz.loeschen": "Delete note",
    "begleitung.notiz.text": "{{bereich}}: “{{feld}}” = “{{wert}}” – unit missing",
    "begleitung.auskunft.titel": "What is stored?",
    "begleitung.auskunft.freigabe":
      "Permission (purpose, area, end time) in this tab's session storage: {{wert}}",
    "begleitung.auskunft.notizen": "Notes you chose to keep: {{anzahl}}",
    "begleitung.auskunft.fluechtig":
      "Only in memory, discarded on pause and stop: {{anzahl}} fields read",
    "begleitung.auskunft.keinVerlauf":
      "No history, no recording, no evaluation of people. File changes are reported by the separate source change service.",
    "begleitung.ja": "yes",
    "begleitung.nein": "no",
  },
  nl: {
    "begleitung.region": "Begeleiding door {{assistenz}}",
    "begleitung.angebot.titel": "{{assistenz}} kan deze taak begeleiden",
    "begleitung.angebot.bereich": "Gebied: {{bereich}}",
    "begleitung.angebot.feld": "Wat moet ik begeleiden?",
    "begleitung.angebot.platzhalter": "bijv. productonderzoek, 30 minuten",
    "begleitung.angebot.erklaerung":
      "Alleen de velden van deze taak worden gelezen, tot het eindtijdstip. Microfoon en video blijven uit, er wordt niets opgenomen.",
    "begleitung.angebot.starten": "Begeleiding starten",
    "begleitung.fehler.zweck_fehlt": "Zeg kort waarbij ik moet begeleiden.",
    "begleitung.fehler.dauer_ungueltig": "De duur moet tussen 1 minuut en 8 uur liggen.",
    "begleitung.fehler.medien_nicht_im_begleitmodus":
      "Tijdens begeleiding blijven microfoon, geluid en video uit. Opnemen is een aparte modus.",
    "begleitung.fehler.abgelaufen":
      "De toestemming is verlopen. Start opnieuw voor een nieuwe begeleiding.",
    "begleitung.fehler.anderes_konto":
      "Er is een ander account aangemeld. Deze begeleiding hoort daar niet bij – stop en start opnieuw.",
    "begleitung.fehler.keine_rechte":
      "Toegang tot dit gebied is nu niet toegestaan. De begeleiding blijft gepauzeerd.",
    "begleitung.fehler.nicht_pausiert": "De begeleiding is niet gepauzeerd.",
    "begleitung.status.aktiv": "Begeleiden · {{bereich}} · tot {{ende}}",
    "begleitung.status.pausiert": "Gepauzeerd · {{bereich}} · tot {{ende}}",
    "begleitung.status.zweck": "Doel: {{zweck}}",
    "begleitung.status.medien": "Microfoon uit · video uit · geen opname",
    "begleitung.status.ausserhalb":
      "Je bent buiten het vrijgegeven gebied – hier wordt niets gelezen.",
    "begleitung.grund.nutzer": "Door jou gepauzeerd.",
    "begleitung.grund.sperrbildschirm": "Gepauzeerd omdat het scherm is vergrendeld.",
    "begleitung.grund.kontowechsel": "Gepauzeerd omdat het account is gewisseld.",
    "begleitung.grund.rechteentzug": "Gepauzeerd omdat de toegang is ingetrokken.",
    "begleitung.grund.neustart":
      "Na herladen gepauzeerd. Hervatten leest verse context; het eindtijdstip blijft gelijk.",
    "begleitung.knopf.pause": "Pauze",
    "begleitung.knopf.fortsetzen": "Hervatten",
    "begleitung.knopf.stopp": "Stop",
    "begleitung.knopf.schliessen": "Sluiten",
    "begleitung.tastatur": "Toetsenbord: Alt+Shift+P pauze/hervatten, Alt+Shift+S stop.",
    "begleitung.beendet.stopp":
      "Begeleiding gestopt. De waargenomen context is verworpen, er is niets van opgeslagen.",
    "begleitung.beendet.abgelaufen":
      "De begeleiding is op het eindtijdstip verlopen. De waargenomen context is verworpen.",
    "begleitung.hinweis.einheit":
      "In het veld „{{feld}}” staat „{{wert}}” zonder eenheid. Volgende stap: de eenheid aanvullen ({{einheiten}}).",
    "begleitung.hinweis.einheitOhneVorgabe":
      "In het veld „{{feld}}” staat „{{wert}}” zonder eenheid. Volgende stap: de passende eenheid aanvullen.",
    "begleitung.hinweis.selbst": "{{assistenz}} vult niets in – de wijziging doe jij.",
    "begleitung.hinweis.verwerfen": "Hint verwerpen",
    "begleitung.hinweis.notiz": "Als notitie bewaren",
    "begleitung.notiz.titel": "Bewust bewaarde notities",
    "begleitung.notiz.loeschen": "Notitie verwijderen",
    "begleitung.notiz.text": "{{bereich}}: „{{feld}}” = „{{wert}}” – eenheid ontbreekt",
    "begleitung.auskunft.titel": "Wat is opgeslagen?",
    "begleitung.auskunft.freigabe":
      "Toestemming (doel, gebied, eindtijdstip) in de sessieopslag van dit tabblad: {{wert}}",
    "begleitung.auskunft.notizen": "Bewust bewaarde notities: {{anzahl}}",
    "begleitung.auskunft.fluechtig":
      "Alleen in het werkgeheugen, vervalt bij pauze en stop: {{anzahl}} gelezen velden",
    "begleitung.auskunft.keinVerlauf":
      "Geen geschiedenis, geen opname, geen beoordeling van personen. Bestandswijzigingen meldt de aparte bronwijzigingsdienst.",
    "begleitung.ja": "ja",
    "begleitung.nein": "nee",
  },
} satisfies Textmodul;
