// ================================================================================================
// BEGLEITAPP AUF DEM MAC (Auftrag produkt:20261010:klara-office-mac-maskottchen) — die Texte der
// Fläche, die die Begleitapp zeigt (`pages/Begleiter.tsx`).
// ================================================================================================
//
// Die Figur sagt, was TATSÄCHLICH gerade ist (wartet, Antwort da, Fehler, hört zu, liest vor), und
// der Word-Kontext sagt, woher er stammt (Host, Fassung, Dateiname) und ob er aktuell ist. Ohne
// aktives Word-Fenster behauptet die Fläche keine Auswahl.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "begleiter.",
  legacySchluessel: [],
  de: {
    "begleiter.figur.label":
      "{{name}} – Gespräch öffnen oder schließen. Pfeiltasten verschieben die Figur, mit Umschalt weiter.",
    "begleiter.figur.zustand.ruhe": "bereit",
    "begleiter.figur.zustand.wartet": "wartet auf Antwort",
    "begleiter.figur.zustand.antwortet": "Antwort ist da",
    "begleiter.figur.zustand.fehler": "Fehler – Details im Gespräch",
    "begleiter.figur.zustand.hoert": "hört zu",
    "begleiter.figur.zustand.spricht": "liest vor",
    "begleiter.figur.ohneWord": "kein Word-Fenster verbunden",
    "begleiter.schliessen": "Gespräch schließen",
    "begleiter.kontext.titel": "Word-Kontext",
    "begleiter.kontext.laden": "Word-Kontext wird gelesen …",
    "begleiter.kontext.fehler": "Word-Kontext nicht lesbar: {{grund}}",
    "begleiter.kontext.leer":
      "Kein Word-Fenster verbunden. In Word: Klara öffnen → Einstellungen → „Mit Begleitapp verbinden“.",
    "begleiter.kontext.host.word-mac": "Word für Mac",
    "begleiter.kontext.host.word-web": "Word im Web",
    "begleiter.kontext.host.word-windows": "Word für Windows",
    "begleiter.kontext.host.word-andere": "Word (anderer Host)",
    "begleiter.kontext.fassung": "Fassung {{fassung}}",
    "begleiter.kontext.ohneTitel": "Ungespeichertes Dokument",
    "begleiter.kontext.aktiv": "aktiv",
    "begleiter.kontext.inaktiv": "meldet sich nicht – keine aktuelle Auswahl",
    "begleiter.kontext.binden": "Dieses Fenster verwenden",
    "begleiter.kontext.gebunden": "wird verwendet",
    "begleiter.kontext.auswahl.titel": "Markierung in Word",
    "begleiter.kontext.auswahl.leer": "Nichts markiert.",
    "begleiter.kontext.auswahl.gekuerzt": "gekürzt angezeigt – {{laenge}} Zeichen markiert",
    "begleiter.kontext.frage.hinweis":
      "Eigene Fragen zur Markierung schreibst du unten ins Eingabefeld. Sie laufen im Word-Fenster über dessen eigenen Weg – mit Einwilligung, Rechten und Markierungsregeln von Word.",
    "begleiter.kontext.einfuegen.knopf": "Letzte Antwort hinter der Markierung einfügen",
    "begleiter.kontext.einfuegen.hinweis":
      "Eingefügt wird nur, solange die Markierung in Word unverändert ist.",
    "begleiter.aktion.art.einfuegen": "Einfügen",
    "begleiter.aktion.art.frage": "Frage in Word",
    "begleiter.aktion.stand.offen": "wartet auf Word",
    "begleiter.aktion.stand.uebergeben": "Word führt aus",
    "begleiter.aktion.stand.erledigt": "erledigt",
    "begleiter.aktion.stand.abgelehnt": "abgelehnt",
    "begleiter.aktion.stand.fehler": "fehlgeschlagen",
    "begleiter.aktion.stand.verfallen": "verfallen – Word hat nicht reagiert",
    "begleiter.aktion.grund": "Grund: {{grund}}",
    "begleiter.aktion.antwort": "Antwort aus Word",
    "begleiter.aktion.nichtBeauftragt": "Nicht an Word gegeben: {{grund}}",
    // Nacharbeit 57: Antwort fehlt — der Auftrag kann angenommen sein; kein erneutes Senden.
    "begleiter.aktion.ausgangUnklar":
      "Unklar, ob Word den Auftrag erhalten hat ({{grund}}). Ich prüfe den Stand und sende ihn nicht erneut.",
    // Nacharbeit 59: ein Auftrag braucht die Serverzeit des zuletzt gelesenen Word-Stands.
    "begleiter.aktion.ohneServerzeit": "der aktuelle Word-Stand ist noch nicht geladen",
    // Nacharbeit 64: nach einem Serverneustart — Bestand verloren, kein Ende belegt.
    "begleiter.aktion.ausgangOffenNeustart":
      "Klarwerk wurde neu gestartet. Ob Word diesen Auftrag ausführt, bleibt offen, bis sich das Word-Fenster wieder meldet. Er wird nicht erneut gesendet.",
    "begleiter.aktion.nichtLaufendNachNeustart":
      "Klarwerk wurde neu gestartet. Das Word-Fenster führt diesen Auftrag nicht aus; ob er vorher angenommen war, lässt sich nicht mehr feststellen.",
    // Nacharbeit 63: nicht mehr sicher klärbar — nur das Sichere wird gesagt.
    "begleiter.aktion.ausgangUnbekannt":
      "Ob Word diesen Auftrag erhalten hat, lässt sich nicht mehr sicher klären. Sicher ist: Er wird nicht mehr angenommen, und dazu läuft nichts mehr.",
    // Nacharbeit 58: die Klärung über den Auftragsschlüssel ist endgültig.
    "begleiter.aktion.nichtAngelegtGeklaert":
      "Geklärt: Der Auftrag ist nicht bei Word angekommen und wird auch später nicht mehr angelegt. Nichts wurde erneut gesendet.",
    "begleiter.aktion.stand.gestoppt":
      "gestoppt – Word arbeitet nicht weiter daran; eingefügt wurde dabei nichts",
    "begleiter.aktion.nichtGestoppt": "Nicht gestoppt: {{grund}}",
    "begleiter.gespraech.titel": "Gespräch",
    "begleiter.gespraech.hinweis":
      "Dieses Gespräch sendet keinen Dokumenttext. Fragen zur Markierung laufen über Word.",
    "begleiter.gespraech.bezug": "Begleitapp",
    "begleiter.eingabe.label": "Deine Frage",
    "begleiter.eingabe.platzhalter": "Frag etwas …",
    "begleiter.eingabe.senden": "Senden",
    "begleiter.eingabe.stoppen": "Anfrage stoppen",
    "begleiter.eingabe.laeuft": "Antwort wird erstellt …",
    "begleiter.figur.titel": "Figur",
    "begleiter.figur.reduziert": "Reduzierte Bewegung",
    "begleiter.figur.zuruecksetzen": "Position zurücksetzen",
    "begleiter.figur.links": "Links andocken",
    "begleiter.figur.rechts": "Rechts andocken",
    "begleiter.figur.ausblenden": "Figur ausblenden",
    "begleiter.figur.einblendenHinweis":
      "Wieder einblenden: Klara-Symbol in der Menüleiste oder Control-Option-K.",
    "begleiter.berechtigung.titel": "Berechtigungen",
    "begleiter.berechtigung.text":
      "Die Begleitapp braucht keine Bildschirmaufnahme und keine Bedienungshilfen. Mikrofon und Spracherkennung fragt macOS erst beim ersten Diktieren; „Nicht erlauben“ lässt die Texteingabe unverändert.",
    "begleiter.version.app": "Webfläche {{web}} · Begleitapp {{app}}",
    "begleiter.version.browser":
      "Webfläche {{web}} · im Browser geöffnet – Fensterbedienung gibt es nur in der Begleitapp.",
    // produkt:20261011:assistenz-minimalistische-oberflaeche — Grundansicht der Begleitapp.
    "begleiter.zeile.word": "{{host}} · {{titel}}",
    "begleiter.zeile.markiert": "{{host}} · {{titel}} · Markierung",
    "begleiter.zeile.inaktiv": "{{host}} · {{titel}} · meldet sich nicht",
    "begleiter.vorschlag.erklaeren": "Erklären",
    "begleiter.vorschlag.erklaerenFrage": "Erkläre die markierte Stelle.",
    "begleiter.vorschlag.verbessern": "Verbessern",
    "begleiter.vorschlag.verbessernFrage":
      "Schlage eine verbesserte Formulierung für die markierte Stelle vor.",
    "begleiter.wordhilfe.titel": "Word-Verbindung",
    "begleiter.wordhilfe.text": "Für die Markierung benötige ich die Word-Verbindung.",
    "begleiter.wordhilfe.verbunden":
      "Word ist jetzt verbunden: {{titel}}. Markiere die Stelle in Word, dann sende die Frage dorthin.",
    "begleiter.wordhilfe.allgemein": "Ohne Dokument fragen",
    "begleiter.wordhilfe.senden": "An Word senden: {{titel}}",
    "begleiter.vorgang.wordOffen": "{{art}} wartet auf Word · {{fenster}}",
    "begleiter.vorgang.wordUebergeben":
      "{{art}} · {{fenster}} – Word führt aus. Stoppen beendet die weitere Arbeit; eine schon eingefügte Änderung nimmst du in Word mit „Rückgängig“ zurück.",
    "begleiter.vorgang.wordStoppAngefordert":
      "{{art}} · {{fenster}} – Stopp angefordert, Word hat das Ende noch nicht bestätigt.",
    // Nacharbeit 64: vor einem Serverneustart laufend — Ende nicht bestätigt.
    "begleiter.vorgang.wordNeustartOffen":
      "{{art}} · {{fenster}} – Klarwerk wurde neu gestartet, Ende nicht bestätigt. Wartet auf die Meldung des Word-Fensters.",
    // Nacharbeit 60: das ausführende Word-Fenster meldet sich nicht mehr — Ende unbekannt.
    "begleiter.vorgang.wordVerbindungVerloren":
      "{{art}} · {{fenster}} – Verbindung zu Word verloren, Ende nicht bestätigt. Stopp geht hinaus, sobald sich Word meldet.",
    // Nacharbeit 54 (MAC5-01): der Kanal antwortet gerade nicht — die Aktion lief zuletzt noch.
    "begleiter.vorgang.wordUnbestaetigt":
      "{{art}} · {{fenster}} – lief zuletzt noch; der aktuelle Stand ist gerade nicht abrufbar.",
    // Nacharbeit 56 (MAC5-01-REST): abgeschickt, die Annahme durch den Kanal steht noch aus.
    "begleiter.vorgang.wordWirdUebergeben":
      "Auftrag an Word wird übergeben ({{anzahl}}) – Stopp, sobald der Kanal ihn angenommen hat.",
    "begleiter.vorgang.wordUnklar":
      "{{fenster}}: Auftrag vielleicht angenommen – Stand wird geprüft, Stopp erscheint dann hier.",
    // Nacharbeit 56 (MAC5-04-REST): der zentrale Klara-Bereich in Klarwerk (Profil › Klara).
    "begleiter.einstellungen.zentral.titel": "Alle Klara-Einstellungen",
    "begleiter.einstellungen.zentral.text":
      "Name, Unterstützung, Kürzel und Datenfreigaben stehen zentral in Klarwerk unter Profil › Klara. Hier stehen nur die Einstellungen dieses Begleiters.",
    "begleiter.einstellungen.zentral.link": "Klara-Einstellungen in Klarwerk öffnen",
    "begleiter.vorgang.wordStopp": "Zurückziehen",
    "begleiter.vorgang.wordAbbrechen": "Stoppen",
    "begleiter.ziel.frage":
      "Begonnen hast du diesen Text bei „{{ursprung}}“, jetzt ist „{{jetzt}}“ gebunden. Wohin soll die Frage?",
    "begleiter.ziel.ohneWord": "ohne Word-Dokument",
    "begleiter.ziel.ursprung": "Wie begonnen: {{titel}}",
    "begleiter.ziel.ursprungWeg":
      "Das ursprüngliche Fenster bzw. seine Markierung ist nicht mehr verbunden.",
    "begleiter.ziel.jetzt": "Hierhin: {{titel}}",
    "begleiter.funktionen.fragen":
      "Fragen stellen – Antworten aus Wissen, das du lesen darfst; dieses Gespräch sendet keinen Dokumenttext.",
    "begleiter.funktionen.markierung":
      "Markierung in Word erklären oder verbessern lassen – über das verbundene Word-Fenster.",
    "begleiter.funktionen.einfuegen":
      "Eine Antwort hinter der Markierung in Word einfügen – nur, solange die Markierung unverändert ist.",
    "begleiter.hilfe.grundansicht":
      "Oben Figur, Name, Menü und Einklappen; darunter das verbundene Word-Fenster in einer Zeile. Ein Klick darauf zeigt alle Fenster, Fassungen und den Verbindungsweg.",
    "begleiter.hilfe.word":
      "Markierst du in Word etwas, erscheint es hier mit „Erklären“ und „Verbessern“. Weitere Möglichkeiten stehen darunter.",
  },
  en: {
    "begleiter.figur.label":
      "{{name}} – open or close the conversation. Arrow keys move the figure, with Shift further.",
    "begleiter.figur.zustand.ruhe": "ready",
    "begleiter.figur.zustand.wartet": "waiting for an answer",
    "begleiter.figur.zustand.antwortet": "answer is here",
    "begleiter.figur.zustand.fehler": "error – details in the conversation",
    "begleiter.figur.zustand.hoert": "listening",
    "begleiter.figur.zustand.spricht": "reading aloud",
    "begleiter.figur.ohneWord": "no Word window connected",
    "begleiter.schliessen": "Close conversation",
    "begleiter.kontext.titel": "Word context",
    "begleiter.kontext.laden": "Reading Word context …",
    "begleiter.kontext.fehler": "Word context not readable: {{grund}}",
    "begleiter.kontext.leer":
      "No Word window connected. In Word: open Klara → Settings → “Connect companion app”.",
    "begleiter.kontext.host.word-mac": "Word for Mac",
    "begleiter.kontext.host.word-web": "Word on the web",
    "begleiter.kontext.host.word-windows": "Word for Windows",
    "begleiter.kontext.host.word-andere": "Word (other host)",
    "begleiter.kontext.fassung": "Version {{fassung}}",
    "begleiter.kontext.ohneTitel": "Unsaved document",
    "begleiter.kontext.aktiv": "active",
    "begleiter.kontext.inaktiv": "not responding – no current selection",
    "begleiter.kontext.binden": "Use this window",
    "begleiter.kontext.gebunden": "in use",
    "begleiter.kontext.auswahl.titel": "Selection in Word",
    "begleiter.kontext.auswahl.leer": "Nothing selected.",
    "begleiter.kontext.auswahl.gekuerzt": "shown shortened – {{laenge}} characters selected",
    "begleiter.kontext.frage.hinweis":
      "Type your own questions about the selection in the input field below. They run in the Word window through its own path – with Word's consent, permissions and selection rules.",
    "begleiter.kontext.einfuegen.knopf": "Insert last answer after the selection",
    "begleiter.kontext.einfuegen.hinweis":
      "It is only inserted while the selection in Word is unchanged.",
    "begleiter.aktion.art.einfuegen": "Insert",
    "begleiter.aktion.art.frage": "Question in Word",
    "begleiter.aktion.stand.offen": "waiting for Word",
    "begleiter.aktion.stand.uebergeben": "Word is running it",
    "begleiter.aktion.stand.erledigt": "done",
    "begleiter.aktion.stand.abgelehnt": "declined",
    "begleiter.aktion.stand.fehler": "failed",
    "begleiter.aktion.stand.verfallen": "expired – Word did not respond",
    "begleiter.aktion.grund": "Reason: {{grund}}",
    "begleiter.aktion.antwort": "Answer from Word",
    "begleiter.aktion.nichtBeauftragt": "Not handed to Word: {{grund}}",
    "begleiter.aktion.ausgangUnklar":
      "Unclear whether Word received the task ({{grund}}). Checking the status; it will not be sent again.",
    "begleiter.aktion.ohneServerzeit": "the current Word status has not loaded yet",
    "begleiter.aktion.ausgangOffenNeustart":
      "Klarwerk was restarted. Whether Word is carrying out this task stays open until the Word window reports back. It will not be sent again.",
    "begleiter.aktion.nichtLaufendNachNeustart":
      "Klarwerk was restarted. The Word window is not carrying out this task; whether it had been accepted before can no longer be determined.",
    "begleiter.aktion.ausgangUnbekannt":
      "Whether Word received this task can no longer be determined. What is certain: it will no longer be accepted, and nothing is running for it.",
    "begleiter.aktion.nichtAngelegtGeklaert":
      "Clarified: the task did not reach Word and will not be created later. Nothing was sent again.",
    "begleiter.aktion.stand.gestoppt":
      "stopped – Word is no longer working on it; nothing was inserted",
    "begleiter.aktion.nichtGestoppt": "Not stopped: {{grund}}",
    "begleiter.gespraech.titel": "Conversation",
    "begleiter.gespraech.hinweis":
      "This conversation sends no document text. Questions about the selection run through Word.",
    "begleiter.gespraech.bezug": "Companion app",
    "begleiter.eingabe.label": "Your question",
    "begleiter.eingabe.platzhalter": "Ask something …",
    "begleiter.eingabe.senden": "Send",
    "begleiter.eingabe.stoppen": "Stop request",
    "begleiter.eingabe.laeuft": "Preparing the answer …",
    "begleiter.figur.titel": "Figure",
    "begleiter.figur.reduziert": "Reduced motion",
    "begleiter.figur.zuruecksetzen": "Reset position",
    "begleiter.figur.links": "Dock left",
    "begleiter.figur.rechts": "Dock right",
    "begleiter.figur.ausblenden": "Hide figure",
    "begleiter.figur.einblendenHinweis":
      "Show again: Klara icon in the menu bar or Control-Option-K.",
    "begleiter.berechtigung.titel": "Permissions",
    "begleiter.berechtigung.text":
      "The companion app needs neither screen recording nor accessibility access. macOS asks for microphone and speech recognition only at the first dictation; “Don't allow” leaves text input unchanged.",
    "begleiter.version.app": "Web surface {{web}} · companion app {{app}}",
    "begleiter.version.browser":
      "Web surface {{web}} · opened in the browser – window controls exist only in the companion app.",
    "begleiter.zeile.word": "{{host}} · {{titel}}",
    "begleiter.zeile.markiert": "{{host}} · {{titel}} · selection",
    "begleiter.zeile.inaktiv": "{{host}} · {{titel}} · not responding",
    "begleiter.vorschlag.erklaeren": "Explain",
    "begleiter.vorschlag.erklaerenFrage": "Explain the selected passage.",
    "begleiter.vorschlag.verbessern": "Improve",
    "begleiter.vorschlag.verbessernFrage": "Suggest an improved wording for the selected passage.",
    "begleiter.wordhilfe.titel": "Word connection",
    "begleiter.wordhilfe.text": "For the selection I need the Word connection.",
    "begleiter.wordhilfe.verbunden":
      "Word is now connected: {{titel}}. Select the passage in Word, then send the question there.",
    "begleiter.wordhilfe.allgemein": "Ask without the document",
    "begleiter.wordhilfe.senden": "Send to Word: {{titel}}",
    "begleiter.vorgang.wordOffen": "{{art}} waiting for Word · {{fenster}}",
    "begleiter.vorgang.wordUebergeben":
      "{{art}} · {{fenster}} – Word is running it. Stop ends further work; undo a change already inserted in Word with “Undo”.",
    "begleiter.vorgang.wordStoppAngefordert":
      "{{art}} · {{fenster}} – stop requested, Word has not yet confirmed the end.",
    "begleiter.vorgang.wordVerbindungVerloren":
      "{{art}} · {{fenster}} – connection to Word lost, end not confirmed. Stop is sent as soon as Word reports back.",
    "begleiter.vorgang.wordNeustartOffen":
      "{{art}} · {{fenster}} – Klarwerk was restarted, end not confirmed. Waiting for the Word window to report back.",
    "begleiter.vorgang.wordUnbestaetigt":
      "{{art}} · {{fenster}} – was still running; the current state cannot be retrieved right now.",
    "begleiter.vorgang.wordWirdUebergeben":
      "Task is being handed to Word ({{anzahl}}) – stop is available once the channel accepts it.",
    "begleiter.vorgang.wordUnklar":
      "{{fenster}}: task may have been accepted – checking the status, stop will appear here.",
    "begleiter.einstellungen.zentral.titel": "All Klara settings",
    "begleiter.einstellungen.zentral.text":
      "Name, support mode, shortcuts and data permissions are managed centrally in Klarwerk under Profile › Klara. This page only holds the settings of this companion.",
    "begleiter.einstellungen.zentral.link": "Open Klara settings in Klarwerk",
    "begleiter.vorgang.wordStopp": "Withdraw",
    "begleiter.vorgang.wordAbbrechen": "Stop",
    "begleiter.ziel.frage":
      "You started this text at “{{ursprung}}”; now “{{jetzt}}” is connected. Where should the question go?",
    "begleiter.ziel.ohneWord": "no Word document",
    "begleiter.ziel.ursprung": "As started: {{titel}}",
    "begleiter.ziel.ursprungWeg": "The original window or its selection is no longer connected.",
    "begleiter.ziel.jetzt": "Here: {{titel}}",
    "begleiter.funktionen.fragen":
      "Ask questions – answers from knowledge you may read; this conversation sends no document text.",
    "begleiter.funktionen.markierung":
      "Have a selection in Word explained or improved – via the connected Word window.",
    "begleiter.funktionen.einfuegen":
      "Insert an answer after the selection in Word – only while the selection is unchanged.",
    "begleiter.hilfe.grundansicht":
      "At the top: figure, name, menu and Collapse; below, the connected Word window in one line. Clicking it shows all windows, versions and how to connect.",
    "begleiter.hilfe.word":
      "When you select something in Word, it appears here with “Explain” and “Improve”. More options are below it.",
  },
  nl: {
    "begleiter.figur.label":
      "{{name}} – gesprek openen of sluiten. Pijltoetsen verplaatsen de figuur, met Shift verder.",
    "begleiter.figur.zustand.ruhe": "gereed",
    "begleiter.figur.zustand.wartet": "wacht op antwoord",
    "begleiter.figur.zustand.antwortet": "antwoord is er",
    "begleiter.figur.zustand.fehler": "fout – details in het gesprek",
    "begleiter.figur.zustand.hoert": "luistert",
    "begleiter.figur.zustand.spricht": "leest voor",
    "begleiter.figur.ohneWord": "geen Word-venster verbonden",
    "begleiter.schliessen": "Gesprek sluiten",
    "begleiter.kontext.titel": "Word-context",
    "begleiter.kontext.laden": "Word-context wordt gelezen …",
    "begleiter.kontext.fehler": "Word-context niet leesbaar: {{grund}}",
    "begleiter.kontext.leer":
      "Geen Word-venster verbonden. In Word: Klara openen → Instellingen → „Verbinden met begeleider-app”.",
    "begleiter.kontext.host.word-mac": "Word voor Mac",
    "begleiter.kontext.host.word-web": "Word op het web",
    "begleiter.kontext.host.word-windows": "Word voor Windows",
    "begleiter.kontext.host.word-andere": "Word (andere host)",
    "begleiter.kontext.fassung": "Versie {{fassung}}",
    "begleiter.kontext.ohneTitel": "Niet-opgeslagen document",
    "begleiter.kontext.aktiv": "actief",
    "begleiter.kontext.inaktiv": "reageert niet – geen actuele selectie",
    "begleiter.kontext.binden": "Dit venster gebruiken",
    "begleiter.kontext.gebunden": "in gebruik",
    "begleiter.kontext.auswahl.titel": "Selectie in Word",
    "begleiter.kontext.auswahl.leer": "Niets geselecteerd.",
    "begleiter.kontext.auswahl.gekuerzt": "ingekort weergegeven – {{laenge}} tekens geselecteerd",
    "begleiter.kontext.frage.hinweis":
      "Eigen vragen over de selectie typ je onderaan in het invoerveld. Ze lopen in het Word-venster via de eigen weg – met toestemming, rechten en selectieregels van Word.",
    "begleiter.kontext.einfuegen.knopf": "Laatste antwoord achter de selectie invoegen",
    "begleiter.kontext.einfuegen.hinweis":
      "Er wordt alleen ingevoegd zolang de selectie in Word ongewijzigd is.",
    "begleiter.aktion.art.einfuegen": "Invoegen",
    "begleiter.aktion.art.frage": "Vraag in Word",
    "begleiter.aktion.stand.offen": "wacht op Word",
    "begleiter.aktion.stand.uebergeben": "Word voert uit",
    "begleiter.aktion.stand.erledigt": "klaar",
    "begleiter.aktion.stand.abgelehnt": "geweigerd",
    "begleiter.aktion.stand.fehler": "mislukt",
    "begleiter.aktion.stand.verfallen": "verlopen – Word reageerde niet",
    "begleiter.aktion.grund": "Reden: {{grund}}",
    "begleiter.aktion.antwort": "Antwoord uit Word",
    "begleiter.aktion.nichtBeauftragt": "Niet aan Word gegeven: {{grund}}",
    "begleiter.aktion.ausgangUnklar":
      "Onduidelijk of Word de opdracht heeft ontvangen ({{grund}}). Ik controleer de stand en stuur hem niet opnieuw.",
    "begleiter.aktion.ohneServerzeit": "de actuele Word-stand is nog niet geladen",
    "begleiter.aktion.ausgangOffenNeustart":
      "Klarwerk is opnieuw gestart. Of Word deze opdracht uitvoert, blijft open tot het Word-venster zich weer meldt. Hij wordt niet opnieuw verstuurd.",
    "begleiter.aktion.nichtLaufendNachNeustart":
      "Klarwerk is opnieuw gestart. Het Word-venster voert deze opdracht niet uit; of hij eerder was aangenomen, valt niet meer vast te stellen.",
    "begleiter.aktion.ausgangUnbekannt":
      "Of Word deze opdracht heeft ontvangen, valt niet meer zeker vast te stellen. Zeker is: hij wordt niet meer aangenomen en er loopt niets meer voor.",
    "begleiter.aktion.nichtAngelegtGeklaert":
      "Opgehelderd: de opdracht is niet bij Word aangekomen en wordt ook later niet meer aangemaakt. Er is niets opnieuw verstuurd.",
    "begleiter.aktion.stand.gestoppt":
      "gestopt – Word werkt er niet meer aan; er is niets ingevoegd",
    "begleiter.aktion.nichtGestoppt": "Niet gestopt: {{grund}}",
    "begleiter.gespraech.titel": "Gesprek",
    "begleiter.gespraech.hinweis":
      "Dit gesprek verstuurt geen documenttekst. Vragen over de selectie lopen via Word.",
    "begleiter.gespraech.bezug": "Begeleider-app",
    "begleiter.eingabe.label": "Je vraag",
    "begleiter.eingabe.platzhalter": "Vraag iets …",
    "begleiter.eingabe.senden": "Versturen",
    "begleiter.eingabe.stoppen": "Verzoek stoppen",
    "begleiter.eingabe.laeuft": "Antwoord wordt gemaakt …",
    "begleiter.figur.titel": "Figuur",
    "begleiter.figur.reduziert": "Minder beweging",
    "begleiter.figur.zuruecksetzen": "Positie herstellen",
    "begleiter.figur.links": "Links vastzetten",
    "begleiter.figur.rechts": "Rechts vastzetten",
    "begleiter.figur.ausblenden": "Figuur verbergen",
    "begleiter.figur.einblendenHinweis":
      "Weer tonen: Klara-symbool in de menubalk of Control-Option-K.",
    "begleiter.berechtigung.titel": "Rechten",
    "begleiter.berechtigung.text":
      "De begeleider-app heeft geen schermopname en geen toegankelijkheidsrechten nodig. macOS vraagt microfoon en spraakherkenning pas bij het eerste dicteren; „Niet toestaan” laat tekstinvoer ongewijzigd.",
    "begleiter.version.app": "Weboppervlak {{web}} · begeleider-app {{app}}",
    "begleiter.version.browser":
      "Weboppervlak {{web}} · geopend in de browser – vensterbediening bestaat alleen in de begeleider-app.",
    "begleiter.zeile.word": "{{host}} · {{titel}}",
    "begleiter.zeile.markiert": "{{host}} · {{titel}} · markering",
    "begleiter.zeile.inaktiv": "{{host}} · {{titel}} · reageert niet",
    "begleiter.vorschlag.erklaeren": "Uitleggen",
    "begleiter.vorschlag.erklaerenFrage": "Leg de gemarkeerde passage uit.",
    "begleiter.vorschlag.verbessern": "Verbeteren",
    "begleiter.vorschlag.verbessernFrage":
      "Stel een verbeterde formulering voor de gemarkeerde passage voor.",
    "begleiter.wordhilfe.titel": "Word-verbinding",
    "begleiter.wordhilfe.text": "Voor de markering heb ik de Word-verbinding nodig.",
    "begleiter.wordhilfe.verbunden":
      "Word is nu verbonden: {{titel}}. Markeer de passage in Word en stuur de vraag daarheen.",
    "begleiter.wordhilfe.allgemein": "Zonder document vragen",
    "begleiter.wordhilfe.senden": "Naar Word sturen: {{titel}}",
    "begleiter.vorgang.wordOffen": "{{art}} wacht op Word · {{fenster}}",
    "begleiter.vorgang.wordUebergeben":
      "{{art}} · {{fenster}} – Word voert uit. Stoppen beëindigt het verdere werk; een al ingevoegde wijziging maak je in Word ongedaan met „Ongedaan maken”.",
    "begleiter.vorgang.wordStoppAngefordert":
      "{{art}} · {{fenster}} – stop aangevraagd, Word heeft het einde nog niet bevestigd.",
    "begleiter.vorgang.wordVerbindungVerloren":
      "{{art}} · {{fenster}} – verbinding met Word verloren, einde niet bevestigd. Stoppen wordt verstuurd zodra Word zich meldt.",
    "begleiter.vorgang.wordNeustartOffen":
      "{{art}} · {{fenster}} – Klarwerk is opnieuw gestart, einde niet bevestigd. Wacht op de melding van het Word-venster.",
    "begleiter.vorgang.wordUnbestaetigt":
      "{{art}} · {{fenster}} – liep nog; de actuele stand is nu niet op te halen.",
    "begleiter.vorgang.wordWirdUebergeben":
      "Opdracht wordt aan Word overgedragen ({{anzahl}}) – stoppen kan zodra het kanaal hem aanneemt.",
    "begleiter.vorgang.wordUnklar":
      "{{fenster}}: opdracht mogelijk aangenomen – stand wordt gecontroleerd, stoppen verschijnt dan hier.",
    "begleiter.einstellungen.zentral.titel": "Alle Klara-instellingen",
    "begleiter.einstellungen.zentral.text":
      "Naam, ondersteuning, sneltoetsen en gegevensvrijgaven staan centraal in Klarwerk onder Profiel › Klara. Hier staan alleen de instellingen van deze begeleider.",
    "begleiter.einstellungen.zentral.link": "Klara-instellingen in Klarwerk openen",
    "begleiter.vorgang.wordStopp": "Intrekken",
    "begleiter.vorgang.wordAbbrechen": "Stoppen",
    "begleiter.ziel.frage":
      "Je begon deze tekst bij „{{ursprung}}”, nu is „{{jetzt}}” verbonden. Waar moet de vraag heen?",
    "begleiter.ziel.ohneWord": "geen Word-document",
    "begleiter.ziel.ursprung": "Zoals begonnen: {{titel}}",
    "begleiter.ziel.ursprungWeg":
      "Het oorspronkelijke venster of de selectie is niet meer verbonden.",
    "begleiter.ziel.jetzt": "Hierheen: {{titel}}",
    "begleiter.funktionen.fragen":
      "Vragen stellen – antwoorden uit kennis die je mag lezen; dit gesprek stuurt geen documenttekst.",
    "begleiter.funktionen.markierung":
      "Een markering in Word laten uitleggen of verbeteren – via het verbonden Word-venster.",
    "begleiter.funktionen.einfuegen":
      "Een antwoord achter de markering in Word invoegen – alleen zolang de markering ongewijzigd is.",
    "begleiter.hilfe.grundansicht":
      "Bovenaan figuur, naam, menu en Inklappen; daaronder het verbonden Word-venster op één regel. Een klik daarop toont alle vensters, versies en de verbindingsweg.",
    "begleiter.hilfe.word":
      "Markeer je iets in Word, dan verschijnt het hier met „Uitleggen” en „Verbeteren”. Meer mogelijkheden staan eronder.",
  },
} satisfies Textmodul;
