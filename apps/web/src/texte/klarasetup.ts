// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung — DER BEREICH „KLARA“ IM SETUP (AA-02 bis AA-04).
// ================================================================================================
//
// Die Texte des zentralen Bereichs „Klara“ in den persönlichen Einstellungen: Gruppen, Hinweise auf
// Einstellungen anderer Hosts (Verwaltung, Browser-Erweiterung, Word) und der Unterbereich
// „Tastenkürzel“ mit Aktionen, Aufnahme, Speicherstand und den konkreten Ablehnungsgründen.
// Der Bereichsname „Klara“ ist Peters ausdrückliche Wahl; `{{assistenz}}` bleibt der persönliche Name.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klarasetup.",
  legacySchluessel: [],
  de: {
    "klarasetup.titel": "Klara",
    "klarasetup.intro":
      "Alle Einstellungen deiner persönlichen Assistenz an einem Ort. Gespeichert wird für dein Konto, wenn nicht anders angegeben.",
    "klarasetup.gruppe.erscheinung": "Name und Erscheinung",
    "klarasetup.gruppe.unterstuetzung": "Unterstützung",
    "klarasetup.gruppe.faehigkeiten": "Fähigkeiten",
    "klarasetup.gruppe.sprachausgabe": "Sprachausgabe",
    "klarasetup.gruppe.tastenkuerzel": "Tastenkürzel",
    "klarasetup.gruppe.organisation": "Vorgaben der Organisation",
    "klarasetup.gruppe.browser": "Klara im Browser",
    "klarasetup.gruppe.word": "Klara in Word",
    "klarasetup.sprachausgabe.geltung": "Gilt nur für diesen Browser auf diesem Gerät.",
    "klarasetup.hinweise.titel": "Ruhende Hinweise",
    "klarasetup.hinweise.ort": "Hinweise legst du direkt am Hinweis neben der Figur ab.",
    "klarasetup.hinweise.leer": "Zurzeit ruht kein Hinweis.",
    "klarasetup.hinweise.zeile": "{{art}} · {{stand}} · ruht bis {{bis}}",
    "klarasetup.hinweise.art.tutorial": "Anleitung zur Seite",
    "klarasetup.hinweise.art.ungeprueft": "Ungeprüfter Inhalt",
    "klarasetup.hinweise.art.seite": "Seitenerklärung",
    "klarasetup.hinweise.art.andere": "Hinweis",
    "klarasetup.hinweise.stand.geschlossen": "nicht mehr anbieten",
    "klarasetup.hinweise.stand.zurueckgestellt": "später",
    "klarasetup.organisation.text":
      "KI-Freigabe, Modelle und externe Wissensabfrage legt die Verwaltung für alle fest. Sie wirken auf Klara, sind hier aber nicht änderbar.",
    "klarasetup.organisation.admin": "In der Verwaltung öffnen",
    "klarasetup.browser.text":
      "Die Erweiterung „Klara im Browser“ hat eigene Einstellungen: Die Sprache wählst du in ihrer Seitenleiste. Ihr Tastenkürzel (Vorschlag Alt+Umschalt+K) verwaltet Chrome unter chrome://extensions/shortcuts – Klarwerk kann es nicht setzen.",
    "klarasetup.word.text":
      "Das Word-Add-in hat eine eigene Einstellungsfläche, die nur in Word erreichbar ist: Word › Klara › Zahnrad.",
    "klarasetup.word.sprache": "Sprache – gilt nur für das gerade geöffnete Word-Panel.",
    "klarasetup.word.mitlesen": "Text in Word mitlesen – nur für dieses Panel; Vorgabe: an.",
    "klarasetup.word.absatzblick": "Absatzblick – nur für dieses Panel; Vorgabe: aus.",
    "klarasetup.word.zustimmung":
      "Zustimmung zur externen KI – gilt für die Klara-Sitzung dieses Dokuments und erscheint nur, wenn der Server sie verlangt.",
    "klarasetup.word.dokument":
      "Word merkt sich im Dokument, zu welchem Klarwerk-Eintrag es gehört. Das ist keine Einstellung.",
    "klarasetup.kuerzel.beschreibung":
      "Lege fest, mit welcher Tastenkombination du Klara-Funktionen direkt auslöst. Die Kürzel gelten für dein Konto.",
    "klarasetup.kuerzel.geltung":
      "Geltungsbereich: in Klarwerk, solange das Klarwerk-Fenster aktiv ist. In anderen Programmen wie Word, Mail oder Finder wirken sie nicht – das ist für später vorgemerkt.",
    "klarasetup.kuerzel.keineGarantie":
      "Klarwerk prüft bekannte Browser-, macOS- und VoiceOver-Kürzel. Belegungen anderer Programme kann der Browser nicht erkennen.",
    "klarasetup.kuerzel.liste": "Klara-Aktionen und ihre Tastenkürzel",
    "klarasetup.kuerzel.geltungKurz": "In Klarwerk",
    "klarasetup.aktion.oeffnen.name": "Klara öffnen",
    "klarasetup.aktion.oeffnen.text":
      "Öffnet das Gespräch oder holt es nach vorn; Verlauf und Eingabe bleiben erhalten.",
    "klarasetup.aktion.seitenhilfe.name": "Seitenhilfe öffnen",
    "klarasetup.aktion.seitenhilfe.text": "Öffnet die Hilfe zu dieser Seite (?-Knopf).",
    "klarasetup.aktion.diktieren.name": "Diktieren",
    "klarasetup.aktion.diktieren.text":
      "Öffnet das Gespräch und startet das Diktat ins Eingabefeld. Gesendet wird erst auf deinen Klick.",
    "klarasetup.aktion.auftragSprechen.name": "Auftrag sprechen (Aufnahme)",
    "klarasetup.aktion.auftragSprechen.text":
      "Öffnet das Gespräch und nimmt einen gesprochenen Auftrag auf; du prüfst ihn vor dem Senden.",
    "klarasetup.aktion.aufnahmeStoppen.name": "Aufnahme stoppen",
    "klarasetup.aktion.aufnahmeStoppen.text": "Beendet ein laufendes Diktat oder eine Aufnahme.",
    "klarasetup.aktion.vorlesenStoppen.name": "Vorlesen stoppen",
    "klarasetup.aktion.vorlesenStoppen.text": "Beendet das Vorlesen einer Antwort.",
    "klarasetup.voraussetzung.sprache":
      "Braucht die Spracherkennung des Browsers und deine Mikrofonfreigabe. In diesem Browser nicht verfügbar – das Kürzel öffnet dann nur das Gespräch mit dem Hinweis.",
    "klarasetup.wert.unbelegt": "Nicht belegt",
    "klarasetup.quelle.standard": "Standard",
    "klarasetup.quelle.eigen": "Eigene Belegung",
    "klarasetup.quelle.entfernt": "Entfernt",
    "klarasetup.knopf.festlegen": "Festlegen",
    "klarasetup.knopf.aendern": "Ändern",
    "klarasetup.knopf.entfernen": "Entfernen",
    "klarasetup.knopf.standard": "Standard wiederherstellen",
    "klarasetup.knopf.alleStandard": "Alle auf Standard zurücksetzen",
    "klarasetup.knopf.festlegenFuer": "Kürzel für „{{aktion}}“ festlegen",
    "klarasetup.knopf.aendernFuer": "Kürzel für „{{aktion}}“ ändern",
    "klarasetup.knopf.entfernenFuer": "Kürzel für „{{aktion}}“ entfernen",
    "klarasetup.knopf.standardFuer": "Standard wiederherstellen für „{{aktion}}“",
    "klarasetup.aufnahme.titel": "Aufnahme für „{{aktion}}“",
    "klarasetup.aufnahme.hinweis":
      "Drücke jetzt die gewünschte Kombination mit Befehlstaste (⌘) oder Strg. Escape bricht ab.",
    "klarasetup.aufnahme.nurModifikator":
      "Halte die Zusatztasten und drücke dazu einen Buchstaben, eine Ziffer oder F1–F12.",
    "klarasetup.meldung.abgebrochen": "Abgebrochen – es bleibt bei der bisherigen Belegung.",
    "klarasetup.meldung.speichert": "Wird gespeichert …",
    "klarasetup.meldung.gespeichert": "Gespeichert: „{{aktion}}“ mit {{kuerzel}}.",
    "klarasetup.meldung.entfernt": "Entfernt: „{{aktion}}“ hat kein Kürzel mehr.",
    "klarasetup.meldung.standard": "„{{aktion}}“ ist wieder auf dem Standard: {{wert}}.",
    "klarasetup.meldung.alleStandard": "Alle Kürzel sind wieder auf dem Standard.",
    "klarasetup.meldung.fehler":
      "Nicht gespeichert – die Verbindung zum Server ist gestört. Es gilt weiter die bisherige Belegung.",
    "klarasetup.meldung.abgelehnt":
      "Nicht gespeichert – der Server hat die Kombination abgelehnt. Es gilt weiter die bisherige Belegung.",
    "klarasetup.meldung.abgleich":
      "Ausgang unklar – die Antwort des Servers fehlt. Der gespeicherte Stand wird abgeglichen …",
    "klarasetup.meldung.abgeglichen": "Bestätigt durch Abgleich mit dem Server.",
    "klarasetup.meldung.unbekannt":
      "Ausgang unbekannt – weder die Antwort noch der Abgleich kamen an. Ob die Änderung gespeichert wurde, ist offen; angezeigt und wirksam ist der zuletzt bestätigte Stand.",
    "klarasetup.meldung.abgeglichenStand": "Abgeglichen: angezeigt ist der gespeicherte Stand.",
    "klarasetup.knopf.abgleichen": "Erneut abgleichen",
    "klarasetup.konflikt.ohneModifikator":
      "{{kuerzel}} geht nicht: Ein Kürzel braucht die Befehlstaste (⌘) oder Strg, sonst wäre es normales Schreiben.",
    "klarasetup.konflikt.voiceover":
      "{{kuerzel}} geht nicht: Control zusammen mit Option/Alt ist für VoiceOver (Mac) bzw. AltGr (Windows) reserviert.",
    "klarasetup.konflikt.taste":
      "Diese Taste wird nicht unterstützt. Erlaubt sind Buchstaben, Ziffern und F1–F12.",
    "klarasetup.konflikt.palette":
      "{{kuerzel}} geht nicht: Befehlstaste oder Strg mit K öffnet bereits die Befehlspalette „Seite finden“.",
    "klarasetup.konflikt.einfach":
      "{{kuerzel}} geht nicht: Befehlstaste oder Strg mit nur einer Taste ist in Browsern und Textfeldern belegt (z. B. Kopieren, Fett, neuer Tab). Nimm Umschalt, Option/Alt oder Control dazu.",
    "klarasetup.konflikt.browser": "{{kuerzel}} geht nicht: Diese Kombination belegt der Browser.",
    "klarasetup.konflikt.macos":
      "{{kuerzel}} geht nicht: Diese Kombination ist ein Befehl von macOS.",
    "klarasetup.konflikt.doppelt":
      "{{kuerzel}} ist schon „{{aktion}}“ zugeordnet. Entferne es dort zuerst.",
    "klarasetup.konflikt.bleibt": "Es bleibt bei der bisherigen Belegung.",
    "klarasetup.taste.apple.strg": "Control",
    "klarasetup.taste.apple.alt": "Option",
    "klarasetup.taste.apple.umschalt": "Umschalt",
    "klarasetup.taste.apple.meta": "Befehl",
    "klarasetup.taste.andere.strg": "Strg",
    "klarasetup.taste.andere.alt": "Alt",
    "klarasetup.taste.andere.umschalt": "Umschalt",
    "klarasetup.taste.andere.meta": "Windows",
    "klarasetup.stand.laedt": "Kürzel werden geladen …",
    "klarasetup.stand.ladefehler": "Die Kürzel konnten nicht geladen werden.",
    "klarasetup.stand.wiederholen": "Erneut laden",
    "klarasetup.stand.ohneKonto": "Zum Speichern bitte anmelden.",
    "klarasetup.hilfe.titel": "Tastenkürzel",
    "klarasetup.hilfe.text":
      "„Festlegen“ wählen und die Kombination drücken – sie wird sofort für dein Konto gespeichert. Escape bricht ab. „Entfernen“ löscht eine Belegung, „Standard wiederherstellen“ setzt sie zurück; ab Werk ist keine Aktion belegt. Während der Aufnahme und in offenen Dialogen löst kein Kürzel etwas aus; Schreiben und Bearbeitungskürzel in Textfeldern bleiben unverändert.",
  },
  en: {
    "klarasetup.titel": "Klara",
    "klarasetup.intro":
      "All settings of your personal assistant in one place. Saved for your account unless stated otherwise.",
    "klarasetup.gruppe.erscheinung": "Name and appearance",
    "klarasetup.gruppe.unterstuetzung": "Support",
    "klarasetup.gruppe.faehigkeiten": "Skills",
    "klarasetup.gruppe.sprachausgabe": "Speech output",
    "klarasetup.gruppe.tastenkuerzel": "Keyboard shortcuts",
    "klarasetup.gruppe.organisation": "Organisation settings",
    "klarasetup.gruppe.browser": "Klara in the browser",
    "klarasetup.gruppe.word": "Klara in Word",
    "klarasetup.sprachausgabe.geltung": "Applies only to this browser on this device.",
    "klarasetup.hinweise.titel": "Resting hints",
    "klarasetup.hinweise.ort": "You set hints aside directly at the hint next to the figure.",
    "klarasetup.hinweise.leer": "No hint is resting at the moment.",
    "klarasetup.hinweise.zeile": "{{art}} · {{stand}} · resting until {{bis}}",
    "klarasetup.hinweise.art.tutorial": "Page guide",
    "klarasetup.hinweise.art.ungeprueft": "Unreviewed content",
    "klarasetup.hinweise.art.seite": "Page explanation",
    "klarasetup.hinweise.art.andere": "Hint",
    "klarasetup.hinweise.stand.geschlossen": "don't offer again",
    "klarasetup.hinweise.stand.zurueckgestellt": "later",
    "klarasetup.organisation.text":
      "AI approval, models and external knowledge lookup are set by the administration for everyone. They affect Klara but cannot be changed here.",
    "klarasetup.organisation.admin": "Open in administration",
    "klarasetup.browser.text":
      "The “Klara in the browser” extension has its own settings: you choose its language in its side panel. Its shortcut (suggested Alt+Shift+K) is managed by Chrome at chrome://extensions/shortcuts – Klarwerk cannot set it.",
    "klarasetup.word.text":
      "The Word add-in has its own settings area that is only reachable in Word: Word › Klara › gear icon.",
    "klarasetup.word.sprache": "Language – applies only to the Word panel that is currently open.",
    "klarasetup.word.mitlesen": "Read along in Word – only for this panel; default: on.",
    "klarasetup.word.absatzblick": "Paragraph view – only for this panel; default: off.",
    "klarasetup.word.zustimmung":
      "Consent to external AI – applies to the Klara session of this document and only appears when the server requires it.",
    "klarasetup.word.dokument":
      "Word remembers in the document which Klarwerk entry it belongs to. This is not a setting.",
    "klarasetup.kuerzel.beschreibung":
      "Choose the key combination that triggers a Klara function directly. Shortcuts are saved for your account.",
    "klarasetup.kuerzel.geltung":
      "Scope: in Klarwerk, while the Klarwerk window is active. They do not work in other programs such as Word, Mail or Finder – that is planned for later.",
    "klarasetup.kuerzel.keineGarantie":
      "Klarwerk checks known browser, macOS and VoiceOver shortcuts. The browser cannot detect shortcuts of other programs.",
    "klarasetup.kuerzel.liste": "Klara actions and their shortcuts",
    "klarasetup.kuerzel.geltungKurz": "In Klarwerk",
    "klarasetup.aktion.oeffnen.name": "Open Klara",
    "klarasetup.aktion.oeffnen.text":
      "Opens the conversation or brings it to the front; history and input are kept.",
    "klarasetup.aktion.seitenhilfe.name": "Open page help",
    "klarasetup.aktion.seitenhilfe.text": "Opens the help for this page (? button).",
    "klarasetup.aktion.diktieren.name": "Dictate",
    "klarasetup.aktion.diktieren.text":
      "Opens the conversation and starts dictation into the input field. Nothing is sent until you click.",
    "klarasetup.aktion.auftragSprechen.name": "Speak a request (recording)",
    "klarasetup.aktion.auftragSprechen.text":
      "Opens the conversation and records a spoken request; you check it before sending.",
    "klarasetup.aktion.aufnahmeStoppen.name": "Stop recording",
    "klarasetup.aktion.aufnahmeStoppen.text": "Ends a running dictation or recording.",
    "klarasetup.aktion.vorlesenStoppen.name": "Stop reading aloud",
    "klarasetup.aktion.vorlesenStoppen.text": "Stops reading an answer aloud.",
    "klarasetup.voraussetzung.sprache":
      "Needs the browser's speech recognition and your microphone permission. Not available in this browser – the shortcut then only opens the conversation with the notice.",
    "klarasetup.wert.unbelegt": "Not assigned",
    "klarasetup.quelle.standard": "Default",
    "klarasetup.quelle.eigen": "Own assignment",
    "klarasetup.quelle.entfernt": "Removed",
    "klarasetup.knopf.festlegen": "Set",
    "klarasetup.knopf.aendern": "Change",
    "klarasetup.knopf.entfernen": "Remove",
    "klarasetup.knopf.standard": "Restore default",
    "klarasetup.knopf.alleStandard": "Reset all to default",
    "klarasetup.knopf.festlegenFuer": "Set shortcut for “{{aktion}}”",
    "klarasetup.knopf.aendernFuer": "Change shortcut for “{{aktion}}”",
    "klarasetup.knopf.entfernenFuer": "Remove shortcut for “{{aktion}}”",
    "klarasetup.knopf.standardFuer": "Restore default for “{{aktion}}”",
    "klarasetup.aufnahme.titel": "Recording for “{{aktion}}”",
    "klarasetup.aufnahme.hinweis":
      "Now press the combination you want, with Command (⌘) or Ctrl. Escape cancels.",
    "klarasetup.aufnahme.nurModifikator":
      "Hold the modifier keys and press a letter, a digit or F1–F12 as well.",
    "klarasetup.meldung.abgebrochen": "Cancelled – the previous assignment stays.",
    "klarasetup.meldung.speichert": "Saving …",
    "klarasetup.meldung.gespeichert": "Saved: “{{aktion}}” with {{kuerzel}}.",
    "klarasetup.meldung.entfernt": "Removed: “{{aktion}}” no longer has a shortcut.",
    "klarasetup.meldung.standard": "“{{aktion}}” is back to the default: {{wert}}.",
    "klarasetup.meldung.alleStandard": "All shortcuts are back to the default.",
    "klarasetup.meldung.fehler":
      "Not saved – the connection to the server is disrupted. The previous assignment still applies.",
    "klarasetup.meldung.abgelehnt":
      "Not saved – the server rejected the combination. The previous assignment still applies.",
    "klarasetup.meldung.abgleich":
      "Outcome unclear – the server's response is missing. Checking the saved state …",
    "klarasetup.meldung.abgeglichen": "Confirmed by checking with the server.",
    "klarasetup.meldung.unbekannt":
      "Outcome unknown – neither the response nor the check arrived. Whether the change was saved is open; the last confirmed state is shown and active.",
    "klarasetup.meldung.abgeglichenStand": "Checked: the saved state is shown.",
    "klarasetup.knopf.abgleichen": "Check again",
    "klarasetup.konflikt.ohneModifikator":
      "{{kuerzel}} is not possible: a shortcut needs Command (⌘) or Ctrl, otherwise it would be normal typing.",
    "klarasetup.konflikt.voiceover":
      "{{kuerzel}} is not possible: Control together with Option/Alt is reserved for VoiceOver (Mac) or AltGr (Windows).",
    "klarasetup.konflikt.taste":
      "This key is not supported. Letters, digits and F1–F12 are allowed.",
    "klarasetup.konflikt.palette":
      "{{kuerzel}} is not possible: Command or Ctrl with K already opens the “Find page” command palette.",
    "klarasetup.konflikt.einfach":
      "{{kuerzel}} is not possible: Command or Ctrl with a single key is taken in browsers and text fields (e.g. copy, bold, new tab). Add Shift, Option/Alt or Control.",
    "klarasetup.konflikt.browser":
      "{{kuerzel}} is not possible: the browser uses this combination.",
    "klarasetup.konflikt.macos":
      "{{kuerzel}} is not possible: this combination is a macOS command.",
    "klarasetup.konflikt.doppelt":
      "{{kuerzel}} is already assigned to “{{aktion}}”. Remove it there first.",
    "klarasetup.konflikt.bleibt": "The previous assignment stays.",
    "klarasetup.taste.apple.strg": "Control",
    "klarasetup.taste.apple.alt": "Option",
    "klarasetup.taste.apple.umschalt": "Shift",
    "klarasetup.taste.apple.meta": "Command",
    "klarasetup.taste.andere.strg": "Ctrl",
    "klarasetup.taste.andere.alt": "Alt",
    "klarasetup.taste.andere.umschalt": "Shift",
    "klarasetup.taste.andere.meta": "Windows",
    "klarasetup.stand.laedt": "Loading shortcuts …",
    "klarasetup.stand.ladefehler": "The shortcuts could not be loaded.",
    "klarasetup.stand.wiederholen": "Load again",
    "klarasetup.stand.ohneKonto": "Please sign in to save.",
    "klarasetup.hilfe.titel": "Keyboard shortcuts",
    "klarasetup.hilfe.text":
      "Choose “Set” and press the combination – it is saved for your account right away. Escape cancels. “Remove” deletes an assignment, “Restore default” resets it; by default no action is assigned. While recording and in open dialogs no shortcut triggers anything; typing and editing shortcuts in text fields stay unchanged.",
  },
  nl: {
    "klarasetup.titel": "Klara",
    "klarasetup.intro":
      "Alle instellingen van je persoonlijke assistent op één plek. Opgeslagen voor je account, tenzij anders vermeld.",
    "klarasetup.gruppe.erscheinung": "Naam en uiterlijk",
    "klarasetup.gruppe.unterstuetzung": "Ondersteuning",
    "klarasetup.gruppe.faehigkeiten": "Vaardigheden",
    "klarasetup.gruppe.sprachausgabe": "Spraakuitvoer",
    "klarasetup.gruppe.tastenkuerzel": "Sneltoetsen",
    "klarasetup.gruppe.organisation": "Instellingen van de organisatie",
    "klarasetup.gruppe.browser": "Klara in de browser",
    "klarasetup.gruppe.word": "Klara in Word",
    "klarasetup.sprachausgabe.geltung": "Geldt alleen voor deze browser op dit apparaat.",
    "klarasetup.hinweise.titel": "Rustende hints",
    "klarasetup.hinweise.ort": "Hints leg je direct bij de hint naast de figuur weg.",
    "klarasetup.hinweise.leer": "Er rust op dit moment geen hint.",
    "klarasetup.hinweise.zeile": "{{art}} · {{stand}} · rust tot {{bis}}",
    "klarasetup.hinweise.art.tutorial": "Handleiding bij de pagina",
    "klarasetup.hinweise.art.ungeprueft": "Ongecontroleerde inhoud",
    "klarasetup.hinweise.art.seite": "Uitleg van de pagina",
    "klarasetup.hinweise.art.andere": "Hint",
    "klarasetup.hinweise.stand.geschlossen": "niet meer aanbieden",
    "klarasetup.hinweise.stand.zurueckgestellt": "later",
    "klarasetup.organisation.text":
      "AI-vrijgave, modellen en externe kennisopvraging legt het beheer voor iedereen vast. Ze werken op Klara, maar zijn hier niet te wijzigen.",
    "klarasetup.organisation.admin": "Openen in het beheer",
    "klarasetup.browser.text":
      "De extensie ‘Klara in de browser’ heeft eigen instellingen: de taal kies je in haar zijpaneel. Haar sneltoets (voorstel Alt+Shift+K) beheert Chrome onder chrome://extensions/shortcuts – Klarwerk kan die niet instellen.",
    "klarasetup.word.text":
      "De Word-invoegtoepassing heeft een eigen instellingenvlak dat alleen in Word bereikbaar is: Word › Klara › tandwiel.",
    "klarasetup.word.sprache": "Taal – geldt alleen voor het Word-paneel dat nu open is.",
    "klarasetup.word.mitlesen": "Tekst in Word meelezen – alleen voor dit paneel; standaard: aan.",
    "klarasetup.word.absatzblick": "Alineablik – alleen voor dit paneel; standaard: uit.",
    "klarasetup.word.zustimmung":
      "Toestemming voor externe AI – geldt voor de Klara-sessie van dit document en verschijnt alleen als de server erom vraagt.",
    "klarasetup.word.dokument":
      "Word onthoudt in het document bij welk Klarwerk-item het hoort. Dat is geen instelling.",
    "klarasetup.kuerzel.beschreibung":
      "Leg vast met welke toetscombinatie je Klara-functies direct start. De sneltoetsen gelden voor je account.",
    "klarasetup.kuerzel.geltung":
      "Bereik: in Klarwerk, zolang het Klarwerk-venster actief is. In andere programma’s zoals Word, Mail of Finder werken ze niet – dat staat gepland voor later.",
    "klarasetup.kuerzel.keineGarantie":
      "Klarwerk controleert bekende browser-, macOS- en VoiceOver-sneltoetsen. Toewijzingen van andere programma’s kan de browser niet herkennen.",
    "klarasetup.kuerzel.liste": "Klara-acties en hun sneltoetsen",
    "klarasetup.kuerzel.geltungKurz": "In Klarwerk",
    "klarasetup.aktion.oeffnen.name": "Klara openen",
    "klarasetup.aktion.oeffnen.text":
      "Opent het gesprek of haalt het naar voren; geschiedenis en invoer blijven behouden.",
    "klarasetup.aktion.seitenhilfe.name": "Paginahulp openen",
    "klarasetup.aktion.seitenhilfe.text": "Opent de hulp bij deze pagina (?-knop).",
    "klarasetup.aktion.diktieren.name": "Dicteren",
    "klarasetup.aktion.diktieren.text":
      "Opent het gesprek en start het dicteren in het invoerveld. Er wordt pas verzonden als jij klikt.",
    "klarasetup.aktion.auftragSprechen.name": "Opdracht inspreken (opname)",
    "klarasetup.aktion.auftragSprechen.text":
      "Opent het gesprek en neemt een gesproken opdracht op; je controleert die voor het verzenden.",
    "klarasetup.aktion.aufnahmeStoppen.name": "Opname stoppen",
    "klarasetup.aktion.aufnahmeStoppen.text": "Beëindigt lopend dicteren of een opname.",
    "klarasetup.aktion.vorlesenStoppen.name": "Voorlezen stoppen",
    "klarasetup.aktion.vorlesenStoppen.text": "Stopt het voorlezen van een antwoord.",
    "klarasetup.voraussetzung.sprache":
      "Heeft de spraakherkenning van de browser en je microfoontoestemming nodig. In deze browser niet beschikbaar – de sneltoets opent dan alleen het gesprek met de melding.",
    "klarasetup.wert.unbelegt": "Niet toegewezen",
    "klarasetup.quelle.standard": "Standaard",
    "klarasetup.quelle.eigen": "Eigen toewijzing",
    "klarasetup.quelle.entfernt": "Verwijderd",
    "klarasetup.knopf.festlegen": "Vastleggen",
    "klarasetup.knopf.aendern": "Wijzigen",
    "klarasetup.knopf.entfernen": "Verwijderen",
    "klarasetup.knopf.standard": "Standaard herstellen",
    "klarasetup.knopf.alleStandard": "Alles naar standaard terugzetten",
    "klarasetup.knopf.festlegenFuer": "Sneltoets voor ‘{{aktion}}’ vastleggen",
    "klarasetup.knopf.aendernFuer": "Sneltoets voor ‘{{aktion}}’ wijzigen",
    "klarasetup.knopf.entfernenFuer": "Sneltoets voor ‘{{aktion}}’ verwijderen",
    "klarasetup.knopf.standardFuer": "Standaard herstellen voor ‘{{aktion}}’",
    "klarasetup.aufnahme.titel": "Opname voor ‘{{aktion}}’",
    "klarasetup.aufnahme.hinweis":
      "Druk nu de gewenste combinatie met Command (⌘) of Ctrl. Escape annuleert.",
    "klarasetup.aufnahme.nurModifikator":
      "Houd de extra toetsen vast en druk daarbij een letter, een cijfer of F1–F12.",
    "klarasetup.meldung.abgebrochen": "Geannuleerd – de vorige toewijzing blijft.",
    "klarasetup.meldung.speichert": "Wordt opgeslagen …",
    "klarasetup.meldung.gespeichert": "Opgeslagen: ‘{{aktion}}’ met {{kuerzel}}.",
    "klarasetup.meldung.entfernt": "Verwijderd: ‘{{aktion}}’ heeft geen sneltoets meer.",
    "klarasetup.meldung.standard": "‘{{aktion}}’ staat weer op de standaard: {{wert}}.",
    "klarasetup.meldung.alleStandard": "Alle sneltoetsen staan weer op de standaard.",
    "klarasetup.meldung.fehler":
      "Niet opgeslagen – de verbinding met de server is verstoord. De vorige toewijzing blijft gelden.",
    "klarasetup.meldung.abgelehnt":
      "Niet opgeslagen – de server heeft de combinatie geweigerd. De vorige toewijzing blijft gelden.",
    "klarasetup.meldung.abgleich":
      "Uitkomst onduidelijk – het antwoord van de server ontbreekt. De opgeslagen stand wordt gecontroleerd …",
    "klarasetup.meldung.abgeglichen": "Bevestigd door controle bij de server.",
    "klarasetup.meldung.unbekannt":
      "Uitkomst onbekend – het antwoord en de controle kwamen niet aan. Of de wijziging is opgeslagen, is open; getoond en actief is de laatst bevestigde stand.",
    "klarasetup.meldung.abgeglichenStand": "Gecontroleerd: de opgeslagen stand wordt getoond.",
    "klarasetup.knopf.abgleichen": "Opnieuw controleren",
    "klarasetup.konflikt.ohneModifikator":
      "{{kuerzel}} kan niet: een sneltoets heeft Command (⌘) of Ctrl nodig, anders is het gewoon typen.",
    "klarasetup.konflikt.voiceover":
      "{{kuerzel}} kan niet: Control samen met Option/Alt is gereserveerd voor VoiceOver (Mac) of AltGr (Windows).",
    "klarasetup.konflikt.taste":
      "Deze toets wordt niet ondersteund. Toegestaan zijn letters, cijfers en F1–F12.",
    "klarasetup.konflikt.palette":
      "{{kuerzel}} kan niet: Command of Ctrl met K opent al het opdrachtenpalet ‘Pagina zoeken’.",
    "klarasetup.konflikt.einfach":
      "{{kuerzel}} kan niet: Command of Ctrl met één toets is in browsers en tekstvelden bezet (bijv. kopiëren, vet, nieuw tabblad). Neem Shift, Option/Alt of Control erbij.",
    "klarasetup.konflikt.browser": "{{kuerzel}} kan niet: deze combinatie gebruikt de browser.",
    "klarasetup.konflikt.macos": "{{kuerzel}} kan niet: deze combinatie is een opdracht van macOS.",
    "klarasetup.konflikt.doppelt":
      "{{kuerzel}} is al aan ‘{{aktion}}’ toegewezen. Verwijder het daar eerst.",
    "klarasetup.konflikt.bleibt": "De vorige toewijzing blijft.",
    "klarasetup.taste.apple.strg": "Control",
    "klarasetup.taste.apple.alt": "Option",
    "klarasetup.taste.apple.umschalt": "Shift",
    "klarasetup.taste.apple.meta": "Command",
    "klarasetup.taste.andere.strg": "Ctrl",
    "klarasetup.taste.andere.alt": "Alt",
    "klarasetup.taste.andere.umschalt": "Shift",
    "klarasetup.taste.andere.meta": "Windows",
    "klarasetup.stand.laedt": "Sneltoetsen worden geladen …",
    "klarasetup.stand.ladefehler": "De sneltoetsen konden niet worden geladen.",
    "klarasetup.stand.wiederholen": "Opnieuw laden",
    "klarasetup.stand.ohneKonto": "Meld je aan om op te slaan.",
    "klarasetup.hilfe.titel": "Sneltoetsen",
    "klarasetup.hilfe.text":
      "Kies ‘Vastleggen’ en druk de combinatie – die wordt meteen voor je account opgeslagen. Escape annuleert. ‘Verwijderen’ wist een toewijzing, ‘Standaard herstellen’ zet haar terug; standaard is geen actie toegewezen. Tijdens de opname en in open dialogen start geen sneltoets iets; typen en bewerkingssneltoetsen in tekstvelden blijven ongewijzigd.",
  },
} satisfies Textmodul;
