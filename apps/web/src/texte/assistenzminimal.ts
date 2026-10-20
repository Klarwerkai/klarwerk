// ================================================================================================
// ASSISTENZ MINIMAL (Auftrag produkt:20261011:assistenz-minimalistische-oberflaeche) — die Texte der
// vier Bereiche, des Menüs und der situativen Hinweise im Produktbetrieb.
// ================================================================================================
//
// Grundansicht: Kopf, eine Kontextzeile, Gespräch, Eingabe. Alles andere steht im Menü (Neues
// Gespräch, Verlauf, Meine Funktionen, Einstellungen, Hilfe) oder erscheint genau dann, wenn der
// nächste Schritt es braucht (Einwilligung vor der ersten Frage, laufender Vorgang mit Stopp).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "assistenzminimal.",
  legacySchluessel: [],
  de: {
    "assistenzminimal.menue.knopf": "Menü",
    "assistenzminimal.menue.label": "Menü der Assistenz",
    "assistenzminimal.menue.neu": "Neues Gespräch",
    "assistenzminimal.menue.verlauf": "Verlauf",
    "assistenzminimal.menue.funktionen": "Meine Funktionen",
    "assistenzminimal.menue.einstellungen": "Einstellungen",
    "assistenzminimal.menue.hilfe": "Hilfe",
    "assistenzminimal.zurueck": "Zurück zum Gespräch",
    "assistenzminimal.einklappen": "Einklappen",
    "assistenzminimal.einklappen.hinweis":
      "Einklappen – die Figur bleibt sichtbar, Gespräch und angefangener Text bleiben erhalten",
    "assistenzminimal.leer": "Wie kann ich helfen?",
    "assistenzminimal.eingabe.label": "Frage oder Auftrag an {{name}}",
    "assistenzminimal.eingabe.platzhalter": "Frage oder Auftrag …",
    "assistenzminimal.senden": "Senden",
    "assistenzminimal.mikrofon.start":
      "Sprechen – der erkannte Text kommt ins Eingabefeld, gesendet wird erst mit „Senden“",
    "assistenzminimal.mikrofon.stopp": "Aufnahme beenden",
    "assistenzminimal.kontext.label": "Bezug und Details",
    "assistenzminimal.kontext.bezug": "Bezug der nächsten Frage",
    "assistenzminimal.kontext.datenweg": "Datenweg",
    "assistenzminimal.kontext.ki": "KI",
    "assistenzminimal.ki.aus": "KI aus",
    "assistenzminimal.ki.ohneModell": "ohne KI",
    "assistenzminimal.einwilligung.frage":
      "Bevor ich deine Frage sende, brauche ich einmal deine Einwilligung für dieses Gespräch.",
    "assistenzminimal.einwilligung.senden": "Einverstanden und senden",
    "assistenzminimal.einwilligung.nichtJetzt": "Nicht jetzt",
    "assistenzminimal.einwilligung.erteilen": "Einwilligung erteilen",
    "assistenzminimal.einwilligung.keine":
      "Noch keine Einwilligung – ohne sie sendet {{assistenz}} keine Frage.",
    "assistenzminimal.einwilligung.wirkung":
      "Nach dem Widerruf geht keine Frage mehr an den Frageweg, bis du erneut einwilligst. Dein gespeichertes Gespräch bleibt.",
    "assistenzminimal.markierung.mehr": "Weitere Möglichkeiten",
    "assistenzminimal.vorgang.label": "Läuft gerade",
    "assistenzminimal.vorgang.vorlesen": "{{assistenz}} liest vor",
    "assistenzminimal.vorgang.begleitung": "Begleitung · Schritt {{nr}} von {{gesamt}}",
    "assistenzminimal.vorgang.begleitungPausiert":
      "Begleitung pausiert · Schritt {{nr}} von {{gesamt}}",
    "assistenzminimal.vorgang.pause": "Pause",
    "assistenzminimal.vorgang.fortsetzen": "Fortsetzen",
    "assistenzminimal.vorgang.beenden": "Beenden",
    "assistenzminimal.vorgang.ausfuehrung": "Auftrag läuft: {{wortlaut}}",
    "assistenzminimal.vorgang.ki": "KI-Auftrag läuft: {{ziel}}",
    "assistenzminimal.vorgang.arbeit":
      "{{assistenz}} arbeitet – das lässt sich nicht abbrechen; geändert wird erst nach deiner Übernahme.",
    "assistenzminimal.vorgang.entscheidung":
      "Deine Entscheidung: Vorschlag übernehmen oder verwerfen",
    "assistenzminimal.vorgang.ansehen": "Ansehen",
    "assistenzminimal.verlauf.anzahl":
      "{{n}} gespeicherte Nachrichten – vollständig im Gespräch, die ältesten oben.",
    "assistenzminimal.verlauf.leer": "Noch kein gespeichertes Gespräch.",
    "assistenzminimal.zumGespraech": "Zum Gespräch",
    "assistenzminimal.neu.frage":
      "Ein neues Gespräch ersetzt hier das bisherige – es ist in dieser Fläche danach nicht mehr aufrufbar. Dein angefangener Text bleibt im Eingabefeld.",
    "assistenzminimal.neu.ja": "Neu beginnen",
    "assistenzminimal.neu.nein": "Abbrechen",
    "assistenzminimal.neu.erledigt":
      "Neues Gespräch begonnen. Dein angefangener Text bleibt im Eingabefeld.",
    "assistenzminimal.funktionen.verfuegbar": "Verfügbar",
    "assistenzminimal.funktionen.geplant": "Geplant – noch nicht verfügbar",
    "assistenzminimal.funktionen.fragen":
      "Fragen stellen – Antworten aus Wissen, das du lesen darfst, mit Quellen.",
    "assistenzminimal.funktionen.markierung":
      "Markierten Text erklären oder zusammenfassen lassen.",
    "assistenzminimal.funktionen.uebersetzen":
      "Markierung aus einem Wissensobjekt in der vorhandenen Leseübersetzung zeigen.",
    "assistenzminimal.funktionen.umformulieren":
      "Umformulieren – Original und Vorschlag nebeneinander, geändert wird erst nach deiner Übernahme im Editor.",
    "assistenzminimal.funktionen.notiz":
      "Notizentwurf mit Herkunft – bleibt nur in dieser Sitzung.",
    "assistenzminimal.funktionen.seitenhilfe":
      "Diese Seite erklären, den nächsten Schritt zeigen oder ein Tutorial begleiten (unter Hilfe).",
    "assistenzminimal.funktionen.sprechen":
      "Sprechen über das Mikrofon am Eingabefeld – der Text kommt ins Feld, gesendet wird erst mit „Senden“.",
    "assistenzminimal.funktionen.sprechenNa": "Sprechen ist in diesem Browser nicht verfügbar.",
    "assistenzminimal.funktionen.auftrag":
      "Gesprochener Auftrag mit Ziel und Rückfragen zu Namen, Zeiten und Bezug – gesendet wird erst nach deiner Bestätigung.",
    "assistenzminimal.funktionen.vorlesen":
      "Antworten vorlesen – einstellbar unter Einstellungen, jederzeit stoppbar.",
    "assistenzminimal.einstellungen.sprache": "Sprache",
    "assistenzminimal.einstellungen.verbindungen": "Verbindungen",
    "assistenzminimal.einstellungen.darstellung": "Darstellung",
    "assistenzminimal.einstellungen.daten": "Daten & Freigaben",
    "assistenzminimal.verbindung.seite":
      "Verbunden mit dieser Klarwerk-Seite: {{seite}}. Gelesen wird nur ihr Zusammenhang und eine Markierung, die du übergibst.",
    "assistenzminimal.hilfe.seite": "Hilfe zu dieser Seite",
    "assistenzminimal.hilfe.bedienung": "So arbeitest du mit {{assistenz}}",
    "assistenzminimal.hilfe.grundansicht":
      "Oben stehen Name, Menü und Einklappen, darunter der Bezug der nächsten Frage. Ein Klick darauf zeigt Ort, Fassung, Datenweg und KI-Lage.",
    "assistenzminimal.hilfe.menue":
      "Im Menü findest du Neues Gespräch, Verlauf, Meine Funktionen, Einstellungen und Hilfe. Escape führt zurück.",
    "assistenzminimal.hilfe.sprechen":
      "Mikrofon: Was du sagst, erscheint als Text im Eingabefeld. Gesendet wird erst mit „Senden“. Ohne Mikrofon funktioniert das Tippen immer.",
    "assistenzminimal.hilfe.vorgaenge":
      "Was gerade läuft – Anfrage, Aufnahme, Vorlesen, Begleitung –, steht über dem Gespräch mit eigenem Stopp, auch bei offenem Menü und an der eingeklappten Figur.",
    "assistenzminimal.figur.vorgaenge": "Laufende Vorgänge",
    "assistenzminimal.quellen.details": "Fassung und Prüfstand",
    "assistenzminimal.ziel.titel": "Ziel des Entwurfs klären",
    "assistenzminimal.ziel.frage":
      "Diesen Text hast du auf „{{ursprung}}“ begonnen, jetzt bist du auf „{{jetzt}}“. Worauf soll sich die Frage beziehen?",
    "assistenzminimal.ziel.ursprung": "Wie begonnen: {{ort}}",
    "assistenzminimal.ziel.jetzt": "Hier: {{ort}}",
    "assistenzminimal.abgewiesen.text":
      "Nicht gesendet: „{{text}}“. Dein neuer Text im Feld bleibt, wie er ist.",
    "assistenzminimal.abgewiesen.zurueck": "Zurückholen",
    "assistenzminimal.abgewiesen.verwerfen": "Verwerfen",
  },
  en: {
    "assistenzminimal.menue.knopf": "Menu",
    "assistenzminimal.menue.label": "Assistant menu",
    "assistenzminimal.menue.neu": "New conversation",
    "assistenzminimal.menue.verlauf": "History",
    "assistenzminimal.menue.funktionen": "My functions",
    "assistenzminimal.menue.einstellungen": "Settings",
    "assistenzminimal.menue.hilfe": "Help",
    "assistenzminimal.zurueck": "Back to the conversation",
    "assistenzminimal.einklappen": "Collapse",
    "assistenzminimal.einklappen.hinweis":
      "Collapse – the figure stays visible, the conversation and your unsent text are kept",
    "assistenzminimal.leer": "How can I help?",
    "assistenzminimal.eingabe.label": "Question or request for {{name}}",
    "assistenzminimal.eingabe.platzhalter": "Question or request …",
    "assistenzminimal.senden": "Send",
    "assistenzminimal.mikrofon.start":
      "Speak – the recognised text goes into the input field, nothing is sent until you choose “Send”",
    "assistenzminimal.mikrofon.stopp": "Stop recording",
    "assistenzminimal.kontext.label": "Reference and details",
    "assistenzminimal.kontext.bezug": "Reference of the next question",
    "assistenzminimal.kontext.datenweg": "Data path",
    "assistenzminimal.kontext.ki": "AI",
    "assistenzminimal.ki.aus": "AI off",
    "assistenzminimal.ki.ohneModell": "without AI",
    "assistenzminimal.einwilligung.frage":
      "Before I send your question, I need your consent for this conversation once.",
    "assistenzminimal.einwilligung.senden": "Agree and send",
    "assistenzminimal.einwilligung.nichtJetzt": "Not now",
    "assistenzminimal.einwilligung.erteilen": "Give consent",
    "assistenzminimal.einwilligung.keine":
      "No consent yet – without it, {{assistenz}} sends no question.",
    "assistenzminimal.einwilligung.wirkung":
      "After withdrawing, no question goes to the question path until you consent again. Your saved conversation stays.",
    "assistenzminimal.markierung.mehr": "More options",
    "assistenzminimal.vorgang.label": "Running now",
    "assistenzminimal.vorgang.vorlesen": "{{assistenz}} is reading aloud",
    "assistenzminimal.vorgang.begleitung": "Guidance · step {{nr}} of {{gesamt}}",
    "assistenzminimal.vorgang.begleitungPausiert": "Guidance paused · step {{nr}} of {{gesamt}}",
    "assistenzminimal.vorgang.pause": "Pause",
    "assistenzminimal.vorgang.fortsetzen": "Resume",
    "assistenzminimal.vorgang.beenden": "End",
    "assistenzminimal.vorgang.ausfuehrung": "Task running: {{wortlaut}}",
    "assistenzminimal.vorgang.ki": "AI task running: {{ziel}}",
    "assistenzminimal.vorgang.arbeit":
      "{{assistenz}} is working – this cannot be cancelled; nothing changes until you apply it.",
    "assistenzminimal.vorgang.entscheidung": "Your decision: apply or discard the suggestion",
    "assistenzminimal.vorgang.ansehen": "View",
    "assistenzminimal.verlauf.anzahl":
      "{{n}} saved messages – complete in the conversation, oldest at the top.",
    "assistenzminimal.verlauf.leer": "No saved conversation yet.",
    "assistenzminimal.zumGespraech": "To the conversation",
    "assistenzminimal.neu.frage":
      "A new conversation replaces the current one here – it can no longer be opened in this panel afterwards. Your unsent text stays in the input field.",
    "assistenzminimal.neu.ja": "Start anew",
    "assistenzminimal.neu.nein": "Cancel",
    "assistenzminimal.neu.erledigt":
      "New conversation started. Your unsent text stays in the input field.",
    "assistenzminimal.funktionen.verfuegbar": "Available",
    "assistenzminimal.funktionen.geplant": "Planned – not available yet",
    "assistenzminimal.funktionen.fragen":
      "Ask questions – answers from knowledge you may read, with sources.",
    "assistenzminimal.funktionen.markierung": "Have selected text explained or summarised.",
    "assistenzminimal.funktionen.uebersetzen":
      "Show a selection from a knowledge object in its existing reading translation.",
    "assistenzminimal.funktionen.umformulieren":
      "Rephrase – original and suggestion side by side, nothing changes until you apply it in the editor.",
    "assistenzminimal.funktionen.notiz": "Note draft with origin – stays in this session only.",
    "assistenzminimal.funktionen.seitenhilfe":
      "Explain this page, show the next step or guide a tutorial (under Help).",
    "assistenzminimal.funktionen.sprechen":
      "Speak via the microphone at the input field – the text goes into the field, nothing is sent until “Send”.",
    "assistenzminimal.funktionen.sprechenNa": "Speaking is not available in this browser.",
    "assistenzminimal.funktionen.auftrag":
      "Spoken request with target and follow-up questions on names, times and reference – sent only after you confirm.",
    "assistenzminimal.funktionen.vorlesen":
      "Read answers aloud – adjustable under Settings, can be stopped at any time.",
    "assistenzminimal.einstellungen.sprache": "Speech",
    "assistenzminimal.einstellungen.verbindungen": "Connections",
    "assistenzminimal.einstellungen.darstellung": "Display",
    "assistenzminimal.einstellungen.daten": "Data & permissions",
    "assistenzminimal.verbindung.seite":
      "Connected to this Klarwerk page: {{seite}}. Only its context and a selection you hand over are read.",
    "assistenzminimal.hilfe.seite": "Help for this page",
    "assistenzminimal.hilfe.bedienung": "How to work with {{assistenz}}",
    "assistenzminimal.hilfe.grundansicht":
      "At the top are the name, the menu and Collapse, below them the reference of the next question. Clicking it shows place, version, data path and AI status.",
    "assistenzminimal.hilfe.menue":
      "The menu holds New conversation, History, My functions, Settings and Help. Escape takes you back.",
    "assistenzminimal.hilfe.sprechen":
      "Microphone: what you say appears as text in the input field. Nothing is sent until “Send”. Typing always works without a microphone.",
    "assistenzminimal.hilfe.vorgaenge":
      "Whatever is running – request, recording, reading aloud, guidance – is shown above the conversation with its own stop, also with the menu open and at the collapsed figure.",
    "assistenzminimal.figur.vorgaenge": "Running activities",
    "assistenzminimal.quellen.details": "Version and review status",
    "assistenzminimal.ziel.titel": "Clarify the draft's target",
    "assistenzminimal.ziel.frage":
      "You started this text on “{{ursprung}}”, now you are on “{{jetzt}}”. What should the question refer to?",
    "assistenzminimal.ziel.ursprung": "As started: {{ort}}",
    "assistenzminimal.ziel.jetzt": "Here: {{ort}}",
    "assistenzminimal.abgewiesen.text":
      "Not sent: “{{text}}”. Your new text in the field stays as it is.",
    "assistenzminimal.abgewiesen.zurueck": "Bring back",
    "assistenzminimal.abgewiesen.verwerfen": "Discard",
  },
  nl: {
    "assistenzminimal.menue.knopf": "Menu",
    "assistenzminimal.menue.label": "Menu van de assistent",
    "assistenzminimal.menue.neu": "Nieuw gesprek",
    "assistenzminimal.menue.verlauf": "Geschiedenis",
    "assistenzminimal.menue.funktionen": "Mijn functies",
    "assistenzminimal.menue.einstellungen": "Instellingen",
    "assistenzminimal.menue.hilfe": "Hulp",
    "assistenzminimal.zurueck": "Terug naar het gesprek",
    "assistenzminimal.einklappen": "Inklappen",
    "assistenzminimal.einklappen.hinweis":
      "Inklappen – de figuur blijft zichtbaar, het gesprek en je begonnen tekst blijven bewaard",
    "assistenzminimal.leer": "Hoe kan ik helpen?",
    "assistenzminimal.eingabe.label": "Vraag of opdracht aan {{name}}",
    "assistenzminimal.eingabe.platzhalter": "Vraag of opdracht …",
    "assistenzminimal.senden": "Versturen",
    "assistenzminimal.mikrofon.start":
      "Spreken – de herkende tekst komt in het invoerveld, er wordt pas verstuurd met „Versturen”",
    "assistenzminimal.mikrofon.stopp": "Opname beëindigen",
    "assistenzminimal.kontext.label": "Verwijzing en details",
    "assistenzminimal.kontext.bezug": "Verwijzing van de volgende vraag",
    "assistenzminimal.kontext.datenweg": "Gegevensroute",
    "assistenzminimal.kontext.ki": "AI",
    "assistenzminimal.ki.aus": "AI uit",
    "assistenzminimal.ki.ohneModell": "zonder AI",
    "assistenzminimal.einwilligung.frage":
      "Voordat ik je vraag verstuur, heb ik eenmalig je toestemming voor dit gesprek nodig.",
    "assistenzminimal.einwilligung.senden": "Akkoord en versturen",
    "assistenzminimal.einwilligung.nichtJetzt": "Niet nu",
    "assistenzminimal.einwilligung.erteilen": "Toestemming geven",
    "assistenzminimal.einwilligung.keine":
      "Nog geen toestemming – zonder toestemming stuurt {{assistenz}} geen vraag.",
    "assistenzminimal.einwilligung.wirkung":
      "Na het intrekken gaat er geen vraag meer naar de vraagroute, tot je opnieuw toestemming geeft. Je opgeslagen gesprek blijft.",
    "assistenzminimal.markierung.mehr": "Meer mogelijkheden",
    "assistenzminimal.vorgang.label": "Loopt nu",
    "assistenzminimal.vorgang.vorlesen": "{{assistenz}} leest voor",
    "assistenzminimal.vorgang.begleitung": "Begeleiding · stap {{nr}} van {{gesamt}}",
    "assistenzminimal.vorgang.begleitungPausiert":
      "Begeleiding gepauzeerd · stap {{nr}} van {{gesamt}}",
    "assistenzminimal.vorgang.pause": "Pauze",
    "assistenzminimal.vorgang.fortsetzen": "Doorgaan",
    "assistenzminimal.vorgang.beenden": "Beëindigen",
    "assistenzminimal.vorgang.ausfuehrung": "Opdracht loopt: {{wortlaut}}",
    "assistenzminimal.vorgang.ki": "AI-opdracht loopt: {{ziel}}",
    "assistenzminimal.vorgang.arbeit":
      "{{assistenz}} werkt – dit kan niet worden afgebroken; er verandert pas iets als jij het overneemt.",
    "assistenzminimal.vorgang.entscheidung": "Jouw beslissing: voorstel overnemen of verwerpen",
    "assistenzminimal.vorgang.ansehen": "Bekijken",
    "assistenzminimal.verlauf.anzahl":
      "{{n}} opgeslagen berichten – volledig in het gesprek, de oudste bovenaan.",
    "assistenzminimal.verlauf.leer": "Nog geen opgeslagen gesprek.",
    "assistenzminimal.zumGespraech": "Naar het gesprek",
    "assistenzminimal.neu.frage":
      "Een nieuw gesprek vervangt hier het huidige – het is daarna in dit venster niet meer op te roepen. Je begonnen tekst blijft in het invoerveld.",
    "assistenzminimal.neu.ja": "Opnieuw beginnen",
    "assistenzminimal.neu.nein": "Annuleren",
    "assistenzminimal.neu.erledigt":
      "Nieuw gesprek begonnen. Je begonnen tekst blijft in het invoerveld.",
    "assistenzminimal.funktionen.verfuegbar": "Beschikbaar",
    "assistenzminimal.funktionen.geplant": "Gepland – nog niet beschikbaar",
    "assistenzminimal.funktionen.fragen":
      "Vragen stellen – antwoorden uit kennis die je mag lezen, met bronnen.",
    "assistenzminimal.funktionen.markierung": "Gemarkeerde tekst laten uitleggen of samenvatten.",
    "assistenzminimal.funktionen.uebersetzen":
      "Een markering uit een kennisobject in de bestaande leesvertaling tonen.",
    "assistenzminimal.funktionen.umformulieren":
      "Herformuleren – origineel en voorstel naast elkaar, er verandert pas iets als je het in de editor overneemt.",
    "assistenzminimal.funktionen.notiz":
      "Notitieconcept met herkomst – blijft alleen in deze sessie.",
    "assistenzminimal.funktionen.seitenhilfe":
      "Deze pagina uitleggen, de volgende stap tonen of een tutorial begeleiden (onder Hulp).",
    "assistenzminimal.funktionen.sprechen":
      "Spreken via de microfoon bij het invoerveld – de tekst komt in het veld, er wordt pas verstuurd met „Versturen”.",
    "assistenzminimal.funktionen.sprechenNa": "Spreken is in deze browser niet beschikbaar.",
    "assistenzminimal.funktionen.auftrag":
      "Gesproken opdracht met doel en wedervragen over namen, tijden en verwijzing – pas verstuurd na jouw bevestiging.",
    "assistenzminimal.funktionen.vorlesen":
      "Antwoorden voorlezen – instelbaar onder Instellingen, altijd te stoppen.",
    "assistenzminimal.einstellungen.sprache": "Spraak",
    "assistenzminimal.einstellungen.verbindungen": "Verbindingen",
    "assistenzminimal.einstellungen.darstellung": "Weergave",
    "assistenzminimal.einstellungen.daten": "Gegevens & vrijgaven",
    "assistenzminimal.verbindung.seite":
      "Verbonden met deze Klarwerk-pagina: {{seite}}. Alleen de context en een markering die jij doorgeeft worden gelezen.",
    "assistenzminimal.hilfe.seite": "Hulp bij deze pagina",
    "assistenzminimal.hilfe.bedienung": "Zo werk je met {{assistenz}}",
    "assistenzminimal.hilfe.grundansicht":
      "Bovenaan staan naam, menu en Inklappen, daaronder de verwijzing van de volgende vraag. Een klik daarop toont plaats, versie, gegevensroute en AI-status.",
    "assistenzminimal.hilfe.menue":
      "In het menu vind je Nieuw gesprek, Geschiedenis, Mijn functies, Instellingen en Hulp. Escape brengt je terug.",
    "assistenzminimal.hilfe.sprechen":
      "Microfoon: wat je zegt verschijnt als tekst in het invoerveld. Er wordt pas verstuurd met „Versturen”. Zonder microfoon werkt typen altijd.",
    "assistenzminimal.hilfe.vorgaenge":
      "Wat er loopt – verzoek, opname, voorlezen, begeleiding – staat boven het gesprek met een eigen stopknop, ook bij geopend menu en bij de ingeklapte figuur.",
    "assistenzminimal.figur.vorgaenge": "Lopende activiteiten",
    "assistenzminimal.quellen.details": "Versie en controlestatus",
    "assistenzminimal.ziel.titel": "Doel van het concept verduidelijken",
    "assistenzminimal.ziel.frage":
      "Je bent deze tekst begonnen op „{{ursprung}}”, nu ben je op „{{jetzt}}”. Waarop moet de vraag betrekking hebben?",
    "assistenzminimal.ziel.ursprung": "Zoals begonnen: {{ort}}",
    "assistenzminimal.ziel.jetzt": "Hier: {{ort}}",
    "assistenzminimal.abgewiesen.text":
      "Niet verstuurd: „{{text}}”. Je nieuwe tekst in het veld blijft zoals hij is.",
    "assistenzminimal.abgewiesen.zurueck": "Terughalen",
    "assistenzminimal.abgewiesen.verwerfen": "Verwerpen",
  },
} satisfies Textmodul;
