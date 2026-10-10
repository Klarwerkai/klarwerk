// ================================================================================================
// KLARA 02 (Auftrag produkt:20261008:klara-sprache) — die Texte zu Sprechen, Diktieren und Vorlesen.
// ================================================================================================
//
// Zwei sichtbar getrennte Vorgänge in Klaras Fläche: „Diktieren“ schreibt nur ins Eingabefeld,
// „Auftrag sprechen“ zeigt erkannten Text, Ziel und Rückfragen, bevor etwas gesendet wird. Die Texte
// sagen ehrlich, was im Grundschritt geschieht: Klara beantwortet Fragen; ausgeführt wird nichts.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klarasprache.",
  legacySchluessel: [],
  de: {
    "klarasprache.diktieren": "Diktieren",
    "klarasprache.diktierenHilfe":
      "Gesprochenes wird als Text ins Eingabefeld geschrieben. Es wird nichts gesendet.",
    "klarasprache.auftragSprechen": "Auftrag sprechen",
    "klarasprache.auftragSprechenHilfe":
      "Sprich eine Frage oder einen Auftrag. Klara zeigt dir erkannten Text und Ziel, bevor etwas gesendet wird.",
    "klarasprache.stoppen": "Aufnahme stoppen",
    "klarasprache.laeuft.diktat": "Diktat läuft – der Text kommt ins Eingabefeld.",
    "klarasprache.laeuft.auftrag": "Klara hört zu – sprich deine Frage oder deinen Auftrag.",
    "klarasprache.na":
      "Spracheingabe ist in diesem Browser nicht verfügbar. Tippe deine Frage ins Eingabefeld.",
    "klarasprache.fehler.mikrofon":
      "Das Mikrofon ist nicht erlaubt. Du kannst weiter tippen; freigeben lässt es sich in den Einstellungen des Browsers.",
    "klarasprache.fehler.keinMikrofon": "Kein Mikrofon gefunden. Du kannst weiter tippen.",
    "klarasprache.fehler.nichts": "Es wurde nichts erkannt. Versuch es noch einmal oder tippe.",
    "klarasprache.fehler.andere":
      "Die Spracherkennung wurde beendet ({{grund}}). Du kannst weiter tippen.",
    "klarasprache.fehler.start": "Die Aufnahme ließ sich nicht starten. Du kannst weiter tippen.",
    "klarasprache.auftrag.titel": "Gesprochener Auftrag",
    "klarasprache.auftrag.gehoert": "Gehört: „{{text}}“",
    "klarasprache.auftrag.text": "Erkannter Text – hier korrigieren",
    "klarasprache.auftrag.ziel": "Ziel",
    "klarasprache.auftrag.artLabel": "Erkannt als",
    "klarasprache.auftrag.art.frage": "Frage an Klara",
    "klarasprache.auftrag.art.aktion": "Arbeitsauftrag",
    "klarasprache.auftrag.aktionHinweis":
      "Diese Handlung kann Klara noch nicht selbst ausführen. Beim Senden wird der Text als Frage gestellt; es wird nichts angelegt oder geändert.",
    "klarasprache.auftrag.senden": "Senden",
    "klarasprache.auftrag.verwerfen": "Verwerfen",
    "klarasprache.auftrag.offen": "Bitte zuerst die Rückfragen beantworten.",
    "klarasprache.auftrag.nichtBereit":
      "Senden geht erst, wenn dein Gespräch geladen ist, du eingewilligt hast und keine Anfrage läuft.",
    "klarasprache.auftrag.leer": "Der Text ist leer.",
    "klarasprache.klaerung.titel": "Rückfragen",
    "klarasprache.klaerung.name": "Wen meinst du mit „{{fund}}“?",
    "klarasprache.klaerung.zeit": "Welche Zeit meinst du mit „{{fund}}“?",
    "klarasprache.klaerung.ziel": "Worauf bezieht sich „{{fund}}“?",
    "klarasprache.klaerung.zielUnbekannt":
      "Auf dieser Seite ist kein Objekt erkannt. Nenne es im Text oder sende ohne Bezug.",
    "klarasprache.klaerung.soLassen": "So lassen",
    "klarasprache.klaerung.ohneBezug": "Ohne Bezug",
    "klarasprache.bezug": "(Bezug: {{ziel}})",
    "klarasprache.ergebnis.titel": "Gesprochener Auftrag · gesendet",
    "klarasprache.ergebnis.gehoert": "Gehört",
    "klarasprache.ergebnis.gesendet": "Gesendet als",
    "klarasprache.ergebnis.ziel": "Ziel",
    "klarasprache.ergebnis.ergebnis": "Ergebnis",
    "klarasprache.ergebnis.stand.laeuft": "Klara arbeitet …",
    "klarasprache.ergebnis.stand.beantwortet":
      "Klara hat geantwortet – die Antwort steht im Verlauf.",
    "klarasprache.ergebnis.stand.abgebrochen": "Gestoppt – keine Antwort erhalten.",
    "klarasprache.ergebnis.stand.fehlgeschlagen": "Fehlgeschlagen – der Grund steht im Verlauf.",
    "klarasprache.ergebnis.stand.demo": "Demo-Antwort – vorgefertigt, keine echte Antwort.",
    "klarasprache.ergebnis.stand.nicht_gesendet": "Nicht gesendet – Klara war nicht bereit.",
    "klarasprache.ergebnis.keineAktion": "Ausgeführt wurde keine Handlung.",
    "klarasprache.ergebnis.schliessen": "Schließen",
    "klarasprache.vorlesen": "Vorlesen",
    "klarasprache.vorlesenStop": "Vorlesen stoppen",
    "klarasprache.vorlesenNa":
      "Vorlesen ist in diesem Browser nicht verfügbar. Klaras Antworten stehen vollständig als Text da.",
    "klarasprache.ausgabe.titel": "Sprachausgabe",
    "klarasprache.ausgabe.auto": "Antworten automatisch vorlesen",
    "klarasprache.ausgabe.tempoLabel": "Tempo",
    "klarasprache.ausgabe.tempo.langsam": "Langsam",
    "klarasprache.ausgabe.tempo.normal": "Normal",
    "klarasprache.ausgabe.tempo.schnell": "Schnell",
    "klarasprache.bedienhilfe.diktieren":
      "„Diktieren“ schreibt Gesprochenes ins Eingabefeld. Es wird nichts gesendet – du prüfst, änderst und sendest selbst.",
    "klarasprache.bedienhilfe.auftrag":
      "„Auftrag sprechen“ zeigt den erkannten Text, das Ziel (Seite und Objekt) und Rückfragen zu Namen, Zeiten und Bezug. Gesendet wird erst mit „Senden“, über denselben Weg wie eine getippte Frage. Im Moment beantwortet Klara Fragen; Handlungen führt sie noch nicht aus.",
    "klarasprache.bedienhilfe.stoppen":
      "„Aufnahme stoppen“ beendet das Zuhören, „Vorlesen stoppen“ die Sprachausgabe. Unter „Sprachausgabe“ stellst du automatisches Vorlesen und Tempo ein.",
    "klarasprache.bedienhilfe.datenschutz":
      "Die Spracherkennung übernimmt dein Browser (je nach Browser über dessen Anbieter). Klarwerk speichert keine Tonaufnahme, nur den Text, den du sendest – im Gespräch unter deinem Konto.",
    "klarasprache.bedienhilfe.ohneMikrofon":
      "Ohne Mikrofon oder in Browsern ohne Spracherkennung bleibt das Tippen vollständig verfügbar.",
  },
  en: {
    "klarasprache.diktieren": "Dictate",
    "klarasprache.diktierenHilfe":
      "What you say is written into the input field as text. Nothing is sent.",
    "klarasprache.auftragSprechen": "Speak a request",
    "klarasprache.auftragSprechenHilfe":
      "Say a question or a request. Klara shows you the recognised text and the target before anything is sent.",
    "klarasprache.stoppen": "Stop recording",
    "klarasprache.laeuft.diktat": "Dictation running – the text goes into the input field.",
    "klarasprache.laeuft.auftrag": "Klara is listening – say your question or request.",
    "klarasprache.na":
      "Voice input is not available in this browser. Type your question into the input field.",
    "klarasprache.fehler.mikrofon":
      "The microphone is not allowed. You can keep typing; you can allow it in your browser settings.",
    "klarasprache.fehler.keinMikrofon": "No microphone found. You can keep typing.",
    "klarasprache.fehler.nichts": "Nothing was recognised. Try again or type.",
    "klarasprache.fehler.andere": "Speech recognition ended ({{grund}}). You can keep typing.",
    "klarasprache.fehler.start": "The recording could not be started. You can keep typing.",
    "klarasprache.auftrag.titel": "Spoken request",
    "klarasprache.auftrag.gehoert": "Heard: “{{text}}”",
    "klarasprache.auftrag.text": "Recognised text – correct it here",
    "klarasprache.auftrag.ziel": "Target",
    "klarasprache.auftrag.artLabel": "Recognised as",
    "klarasprache.auftrag.art.frage": "Question to Klara",
    "klarasprache.auftrag.art.aktion": "Work request",
    "klarasprache.auftrag.aktionHinweis":
      "Klara cannot carry out this action herself yet. When sent, the text is asked as a question; nothing is created or changed.",
    "klarasprache.auftrag.senden": "Send",
    "klarasprache.auftrag.verwerfen": "Discard",
    "klarasprache.auftrag.offen": "Please answer the follow-up questions first.",
    "klarasprache.auftrag.nichtBereit":
      "Sending works once your conversation is loaded, you have given consent and no request is running.",
    "klarasprache.auftrag.leer": "The text is empty.",
    "klarasprache.klaerung.titel": "Follow-up questions",
    "klarasprache.klaerung.name": "Who do you mean by “{{fund}}”?",
    "klarasprache.klaerung.zeit": "Which time do you mean by “{{fund}}”?",
    "klarasprache.klaerung.ziel": "What does “{{fund}}” refer to?",
    "klarasprache.klaerung.zielUnbekannt":
      "No object is recognised on this page. Name it in the text or send without a reference.",
    "klarasprache.klaerung.soLassen": "Leave as is",
    "klarasprache.klaerung.ohneBezug": "Without reference",
    "klarasprache.bezug": "(Re: {{ziel}})",
    "klarasprache.ergebnis.titel": "Spoken request · sent",
    "klarasprache.ergebnis.gehoert": "Heard",
    "klarasprache.ergebnis.gesendet": "Sent as",
    "klarasprache.ergebnis.ziel": "Target",
    "klarasprache.ergebnis.ergebnis": "Result",
    "klarasprache.ergebnis.stand.laeuft": "Klara is working …",
    "klarasprache.ergebnis.stand.beantwortet":
      "Klara has answered – the answer is in the conversation.",
    "klarasprache.ergebnis.stand.abgebrochen": "Stopped – no answer received.",
    "klarasprache.ergebnis.stand.fehlgeschlagen": "Failed – the reason is in the conversation.",
    "klarasprache.ergebnis.stand.demo": "Demo answer – prepared, not a real answer.",
    "klarasprache.ergebnis.stand.nicht_gesendet": "Not sent – Klara was not ready.",
    "klarasprache.ergebnis.keineAktion": "No action was carried out.",
    "klarasprache.ergebnis.schliessen": "Close",
    "klarasprache.vorlesen": "Read aloud",
    "klarasprache.vorlesenStop": "Stop reading",
    "klarasprache.vorlesenNa":
      "Reading aloud is not available in this browser. Klara's answers are shown in full as text.",
    "klarasprache.ausgabe.titel": "Speech output",
    "klarasprache.ausgabe.auto": "Read answers aloud automatically",
    "klarasprache.ausgabe.tempoLabel": "Speed",
    "klarasprache.ausgabe.tempo.langsam": "Slow",
    "klarasprache.ausgabe.tempo.normal": "Normal",
    "klarasprache.ausgabe.tempo.schnell": "Fast",
    "klarasprache.bedienhilfe.diktieren":
      "“Dictate” writes what you say into the input field. Nothing is sent – you check, change and send it yourself.",
    "klarasprache.bedienhilfe.auftrag":
      "“Speak a request” shows the recognised text, the target (page and object) and follow-up questions about names, times and references. It is only sent with “Send”, the same way as a typed question. For now Klara answers questions; she does not carry out actions yet.",
    "klarasprache.bedienhilfe.stoppen":
      "“Stop recording” ends listening, “Stop reading” ends speech output. Under “Speech output” you set automatic reading and speed.",
    "klarasprache.bedienhilfe.datenschutz":
      "Speech recognition is done by your browser (depending on the browser, via its vendor). Klarwerk stores no audio, only the text you send – in the conversation under your account.",
    "klarasprache.bedienhilfe.ohneMikrofon":
      "Without a microphone or in browsers without speech recognition, typing stays fully available.",
  },
  nl: {
    "klarasprache.diktieren": "Dicteren",
    "klarasprache.diktierenHilfe":
      "Wat je zegt wordt als tekst in het invoerveld geschreven. Er wordt niets verstuurd.",
    "klarasprache.auftragSprechen": "Opdracht inspreken",
    "klarasprache.auftragSprechenHilfe":
      "Spreek een vraag of opdracht in. Klara toont je de herkende tekst en het doel voordat er iets wordt verstuurd.",
    "klarasprache.stoppen": "Opname stoppen",
    "klarasprache.laeuft.diktat": "Dicteren loopt – de tekst komt in het invoerveld.",
    "klarasprache.laeuft.auftrag": "Klara luistert – spreek je vraag of opdracht in.",
    "klarasprache.na":
      "Spraakinvoer is in deze browser niet beschikbaar. Typ je vraag in het invoerveld.",
    "klarasprache.fehler.mikrofon":
      "De microfoon is niet toegestaan. Je kunt verder typen; toestaan kan in de instellingen van je browser.",
    "klarasprache.fehler.keinMikrofon": "Geen microfoon gevonden. Je kunt verder typen.",
    "klarasprache.fehler.nichts": "Er is niets herkend. Probeer het opnieuw of typ.",
    "klarasprache.fehler.andere":
      "De spraakherkenning is beëindigd ({{grund}}). Je kunt verder typen.",
    "klarasprache.fehler.start": "De opname kon niet worden gestart. Je kunt verder typen.",
    "klarasprache.auftrag.titel": "Ingesproken opdracht",
    "klarasprache.auftrag.gehoert": "Gehoord: “{{text}}”",
    "klarasprache.auftrag.text": "Herkende tekst – hier corrigeren",
    "klarasprache.auftrag.ziel": "Doel",
    "klarasprache.auftrag.artLabel": "Herkend als",
    "klarasprache.auftrag.art.frage": "Vraag aan Klara",
    "klarasprache.auftrag.art.aktion": "Werkopdracht",
    "klarasprache.auftrag.aktionHinweis":
      "Deze handeling kan Klara nog niet zelf uitvoeren. Bij versturen wordt de tekst als vraag gesteld; er wordt niets aangemaakt of gewijzigd.",
    "klarasprache.auftrag.senden": "Versturen",
    "klarasprache.auftrag.verwerfen": "Weggooien",
    "klarasprache.auftrag.offen": "Beantwoord eerst de vervolgvragen.",
    "klarasprache.auftrag.nichtBereit":
      "Versturen kan pas als je gesprek is geladen, je toestemming hebt gegeven en er geen verzoek loopt.",
    "klarasprache.auftrag.leer": "De tekst is leeg.",
    "klarasprache.klaerung.titel": "Vervolgvragen",
    "klarasprache.klaerung.name": "Wie bedoel je met “{{fund}}”?",
    "klarasprache.klaerung.zeit": "Welke tijd bedoel je met “{{fund}}”?",
    "klarasprache.klaerung.ziel": "Waar verwijst “{{fund}}” naar?",
    "klarasprache.klaerung.zielUnbekannt":
      "Op deze pagina is geen object herkend. Noem het in de tekst of verstuur zonder verwijzing.",
    "klarasprache.klaerung.soLassen": "Zo laten",
    "klarasprache.klaerung.ohneBezug": "Zonder verwijzing",
    "klarasprache.bezug": "(Betreft: {{ziel}})",
    "klarasprache.ergebnis.titel": "Ingesproken opdracht · verstuurd",
    "klarasprache.ergebnis.gehoert": "Gehoord",
    "klarasprache.ergebnis.gesendet": "Verstuurd als",
    "klarasprache.ergebnis.ziel": "Doel",
    "klarasprache.ergebnis.ergebnis": "Resultaat",
    "klarasprache.ergebnis.stand.laeuft": "Klara is bezig …",
    "klarasprache.ergebnis.stand.beantwortet":
      "Klara heeft geantwoord – het antwoord staat in het gesprek.",
    "klarasprache.ergebnis.stand.abgebrochen": "Gestopt – geen antwoord ontvangen.",
    "klarasprache.ergebnis.stand.fehlgeschlagen": "Mislukt – de reden staat in het gesprek.",
    "klarasprache.ergebnis.stand.demo": "Demo-antwoord – voorbereid, geen echt antwoord.",
    "klarasprache.ergebnis.stand.nicht_gesendet": "Niet verstuurd – Klara was niet klaar.",
    "klarasprache.ergebnis.keineAktion": "Er is geen handeling uitgevoerd.",
    "klarasprache.ergebnis.schliessen": "Sluiten",
    "klarasprache.vorlesen": "Voorlezen",
    "klarasprache.vorlesenStop": "Voorlezen stoppen",
    "klarasprache.vorlesenNa":
      "Voorlezen is in deze browser niet beschikbaar. Klara's antwoorden staan volledig als tekst.",
    "klarasprache.ausgabe.titel": "Spraakuitvoer",
    "klarasprache.ausgabe.auto": "Antwoorden automatisch voorlezen",
    "klarasprache.ausgabe.tempoLabel": "Tempo",
    "klarasprache.ausgabe.tempo.langsam": "Langzaam",
    "klarasprache.ausgabe.tempo.normal": "Normaal",
    "klarasprache.ausgabe.tempo.schnell": "Snel",
    "klarasprache.bedienhilfe.diktieren":
      "“Dicteren” schrijft wat je zegt in het invoerveld. Er wordt niets verstuurd – je controleert, wijzigt en verstuurt zelf.",
    "klarasprache.bedienhilfe.auftrag":
      "“Opdracht inspreken” toont de herkende tekst, het doel (pagina en object) en vervolgvragen over namen, tijden en verwijzingen. Pas met “Versturen” gaat het weg, via dezelfde route als een getypte vraag. Voorlopig beantwoordt Klara vragen; handelingen voert ze nog niet uit.",
    "klarasprache.bedienhilfe.stoppen":
      "“Opname stoppen” beëindigt het luisteren, “Voorlezen stoppen” de spraakuitvoer. Onder “Spraakuitvoer” stel je automatisch voorlezen en tempo in.",
    "klarasprache.bedienhilfe.datenschutz":
      "De spraakherkenning doet je browser (afhankelijk van de browser via de aanbieder ervan). Klarwerk slaat geen geluidsopname op, alleen de tekst die je verstuurt – in het gesprek onder je account.",
    "klarasprache.bedienhilfe.ohneMikrofon":
      "Zonder microfoon of in browsers zonder spraakherkenning blijft typen volledig beschikbaar.",
  },
} satisfies Textmodul;
