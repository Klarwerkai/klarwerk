// ================================================================================================
// produkt:20261011:assistenz-programmadapter (BPA-04) — DIE TEXTE DER FÄHIGKEITSÜBERSICHT.
// ================================================================================================
//
// „Meine Assistenz" zeigt, was die Assistenz in welchem Programm kann — Lesen, Auswahl, Schreiben,
// Ergebnisprüfung, Rücknahme je Programm, die macOS-Fassung und die Grenzen. Die Grenzsätze selbst
// kommen vom Server (`GET /api/klara/programme`); die hier bekannten Registertexte werden auch in Englisch und Niederländisch angezeigt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "programme.",
  legacySchluessel: [],
  de: {
    "programme.register.wordMac": "Word für Mac",
    "programme.register.wordLesen":
      "Liest Auswahl oder ganzes Dokument über Office.js (Word.run, sonst getSelectedDataAsync).",
    "programme.register.wordAuswahl":
      "Übernimmt nur die aktuelle Markierung im Dokument dieser Sitzung; der Server bindet sie an die documentContextId.",
    "programme.register.wordSchreiben":
      "Fügt nur auf ausdrücklichen Klick ein (Word.run zuerst, sonst setSelectedDataAsync) — nach Prüfung, dass Dokument, Auswahl und Konto noch dieselben sind.",
    "programme.register.wordErgebnis":
      "Sollvergleich nach Speichern, Schließen, Wiederöffnen (tools/word-host-wiederoeffnen.ts); je Host getrennt.",
    "programme.register.wordRuecknahme":
      "Klara bietet keine eigene Rücknahme an. Rückgängig machen geht über Word selbst (Bearbeiten → Widerrufen), solange das Dokument offen ist.",
    "programme.register.wordDokument":
      "Nur das Dokument, in dem Klara geöffnet ist; ein anderes offenes Dokument wird nicht gelesen.",
    "programme.register.wordBild":
      "Ein Bildschirmbild ist kein bearbeitbares Word-Dokument und kein Schreibzugriff.",
    "programme.register.wordZiel":
      "Einfügen nur nach Zielprüfung am Server: dieselbe Sitzung, dasselbe Dokument, dieselbe Markierung wie beim Fragen.",
    "programme.register.wordBedienungshilfe":
      "Bedienungshilfe nur zum Lesen der Markierung über den Klara-Begleiter — kein Klick, keine Eingabe. Ohne Bedienungshilfe-Freigabe stoppt dieser Weg; Word über das Add-in läuft weiter.",
    "programme.register.macOS":
      "Unterstützt ab macOS 13 (Ventura); die real geprüfte macOS-Fassung ist offen.",
    "programme.register.wordMacPruefung":
      "Realer Lauf mit diesem Kandidaten offen (M1–M10, MS1–MS4 der Word-Mac-Hostabnahme).",
    "programme.register.wordWeb": "Word im Browser",
    "programme.register.wordWebPruefung":
      "Getrennt von Word für Mac abzunehmen; ein Ergebnis aus einem Host zählt nicht für den anderen.",
    "programme.register.finder": "Finder (gewählte Datei)",
    "programme.register.finderLesen":
      "Liest nur die eine im Systemdialog gewählte Datei und legt sie mit Herkunft und Fassung in der vorhandenen Objektablage ab (Schutzklasse ungeklärt, also geschützt).",
    "programme.register.finderAuswahl":
      "Nur eine ausdrücklich gewählte Datei — kein Ordner, keine Nachbardateien.",
    "programme.register.finderSchreiben":
      "Klara verschiebt, ändert oder löscht keine Datei im Finder.",
    "programme.register.finderErgebnis":
      "Fassung (SHA-256, Größe, Änderungszeit) wird bei der Aufnahme festgehalten; der Server rechnet die Prüfsumme nach und nimmt eine abweichende Datei nicht an.",
    "programme.register.finderRuecknahme":
      "Die Aufnahme ändert die Datei nicht; es gibt nichts zurückzunehmen.",
    "programme.register.finderFreigabe":
      "Ohne Dateifreigabe des Systems stoppt dieser Weg — ein Bildschirmbild ersetzt die Datei nicht.",
    "programme.register.keinHostbeleg":
      "Kein Hostbeleg für dieses Programm. Ein Erfolg in Word zählt hier nicht; das Programm gilt bis zu einem eigenen realen Lauf als nicht geliefert.",
    "programme.titel": "In anderen Programmen",
    "programme.intro":
      "Was {{assistenz}} in welchem Programm kann – Stand dieser Installation. Programme, die hier nicht stehen, werden nicht unterstützt.",
    "programme.laden": "Wird geladen …",
    "programme.fehler": "Die Übersicht konnte gerade nicht gelesen werden.",
    "programme.wiederholen": "Erneut laden",
    "programme.status.geliefert": "Real geprüft",
    "programme.status.gebaut": "Gebaut – noch nicht real geprüft",
    "programme.status.nichtGeliefert": "Nicht geliefert",
    "programme.os": "macOS: ab {{fassung}} · real geprüft: {{geprueft}}",
    "programme.os.offen": "offen",
    "programme.faehigkeit.lesen": "Lesen",
    "programme.faehigkeit.auswahl": "Auswahl",
    "programme.faehigkeit.schreiben": "Schreiben",
    "programme.faehigkeit.ergebnispruefung": "Ergebnisprüfung",
    "programme.faehigkeit.ruecknahme": "Rücknahme",
    "programme.stand.real-belegt": "real geprüft",
    "programme.stand.gebaut-ohne-hostbeleg": "gebaut, ohne realen Lauf",
    "programme.stand.nicht-geliefert": "nicht geliefert",
    "programme.stand.ausgeschlossen": "bewusst ausgeschlossen",
    "programme.bedienungshilfe": "Bedienungshilfe nur zum Lesen der Markierung: {{stand}}",
    "programme.begleiter.titel": "Mac-Begleiter verbinden",
    "programme.begleiter.text":
      "Der Begleiter nimmt eine im Finder gewählte Datei auf und liest auf Wunsch die Markierung in Word. Er nutzt deine bestehende Anmeldung – über einen Code, der zwei Minuten gilt und nur einmal eingelöst werden kann.",
    "programme.begleiter.knopf": "Code für den Begleiter erzeugen",
    "programme.begleiter.code": "Code für den Begleiter: {{code}}",
    "programme.begleiter.fehler": "Es konnte gerade kein Code erzeugt werden.",
  },
  en: {
    "programme.register.wordMac": "Word for Mac",
    "programme.register.wordLesen":
      "Reads the selection or the entire document using Office.js (Word.run, with getSelectedDataAsync as a fallback).",
    "programme.register.wordAuswahl":
      "Uses only the current selection in this session’s document. The server links it to the documentContextId.",
    "programme.register.wordSchreiben":
      "Inserts text only when you click, after verifying that the document, selection and account are still the same (Word.run, with setSelectedDataAsync as a fallback).",
    "programme.register.wordErgebnis":
      "Checks the expected result after saving, closing and reopening the document, separately for each host (tools/word-host-wiederoeffnen.ts).",
    "programme.register.wordRuecknahme":
      "Klara has no undo command of its own. While the document is open, use Edit → Undo in Word.",
    "programme.register.wordDokument":
      "Reads only the document in which Klara is open. Other open documents are outside its scope.",
    "programme.register.wordBild":
      "A screenshot does not provide an editable Word document or grant write access.",
    "programme.register.wordZiel":
      "Before text can be inserted, the server verifies that the session, document and selection match those used for the question.",
    "programme.register.wordBedienungshilfe":
      "The Klara companion uses Accessibility only to read the selection. It cannot click or type. Without Accessibility permission this feature stops. The Word add-in continues to work.",
    "programme.register.macOS":
      "Supports macOS 13 (Ventura) or later. Verification of the macOS version on a real host is pending.",
    "programme.register.wordMacPruefung":
      "A real-host run of this candidate is pending (M1–M10 and MS1–MS4 of the Word for Mac acceptance checks).",
    "programme.register.wordWeb": "Word for the web",
    "programme.register.wordWebPruefung":
      "Requires its own acceptance check, separate from Word for Mac. Each result applies only to the host tested.",
    "programme.register.finder": "Finder (selected file)",
    "programme.register.finderLesen":
      "Reads only the file selected in the system dialog. It stores the file, its origin and its version in the existing object store. Until classified, the file is treated as protected.",
    "programme.register.finderAuswahl":
      "Only the file you explicitly select is included. Folders and neighbouring files are excluded.",
    "programme.register.finderSchreiben": "Klara cannot move, change or delete files in Finder.",
    "programme.register.finderErgebnis":
      "On import, the file version is recorded with its SHA-256 checksum, size and modification time. The server recalculates the checksum and rejects a file that differs.",
    "programme.register.finderRuecknahme":
      "Importing leaves the file untouched, so there is nothing to undo.",
    "programme.register.finderFreigabe":
      "System permission to access the file is required. A screenshot cannot replace the file.",
    "programme.register.keinHostbeleg":
      "There is no host verification for this program. A successful Word test applies only to Word. This program is considered undelivered until it passes its own real-host test.",
    "programme.titel": "In other programs",
    "programme.intro":
      "What {{assistenz}} can do in which program – as installed here. Programs not listed here are not supported.",
    "programme.laden": "Loading …",
    "programme.fehler": "The overview could not be read right now.",
    "programme.wiederholen": "Reload",
    "programme.status.geliefert": "Verified on a real host",
    "programme.status.gebaut": "Built – not yet verified on a real host",
    "programme.status.nichtGeliefert": "Not delivered",
    "programme.os": "macOS: {{fassung}} or later · verified: {{geprueft}}",
    "programme.os.offen": "open",
    "programme.faehigkeit.lesen": "Read",
    "programme.faehigkeit.auswahl": "Selection",
    "programme.faehigkeit.schreiben": "Write",
    "programme.faehigkeit.ergebnispruefung": "Result check",
    "programme.faehigkeit.ruecknahme": "Undo",
    "programme.stand.real-belegt": "verified",
    "programme.stand.gebaut-ohne-hostbeleg": "built, no real run",
    "programme.stand.nicht-geliefert": "not delivered",
    "programme.stand.ausgeschlossen": "deliberately excluded",
    "programme.bedienungshilfe": "Accessibility only for reading the selection: {{stand}}",
    "programme.begleiter.titel": "Connect the Mac companion",
    "programme.begleiter.text":
      "The companion takes in a file you choose in Finder and, on request, reads the selection in Word. It uses your existing sign-in – via a code that is valid for two minutes and can be redeemed only once.",
    "programme.begleiter.knopf": "Create a code for the companion",
    "programme.begleiter.code": "Code for the companion: {{code}}",
    "programme.begleiter.fehler": "No code could be created right now.",
  },
  nl: {
    "programme.register.wordMac": "Word voor Mac",
    "programme.register.wordLesen":
      "Leest de selectie of het hele document via Office.js (Word.run, anders getSelectedDataAsync).",
    "programme.register.wordAuswahl":
      "Gebruikt alleen de huidige selectie in het document van deze sessie. De server koppelt de selectie aan de documentContextId.",
    "programme.register.wordSchreiben":
      "Voegt alleen tekst in wanneer je klikt en nadat is gecontroleerd of het document, de selectie en het account nog dezelfde zijn (Word.run, anders setSelectedDataAsync).",
    "programme.register.wordErgebnis":
      "Controleert per host het verwachte resultaat na opslaan, sluiten en opnieuw openen (tools/word-host-wiederoeffnen.ts).",
    "programme.register.wordRuecknahme":
      "Klara heeft geen eigen functie voor ongedaan maken. Zolang het document open is, kun je in Word Bewerken → Ongedaan maken gebruiken.",
    "programme.register.wordDokument":
      "Leest alleen het document waarin Klara is geopend. Andere geopende documenten vallen daarbuiten.",
    "programme.register.wordBild":
      "Een schermafbeelding levert geen bewerkbaar Word-document of schrijftoegang op.",
    "programme.register.wordZiel":
      "Voor het invoegen controleert de server of de sessie, het document en de selectie overeenkomen met die van de vraag.",
    "programme.register.wordBedienungshilfe":
      "De Klara-begeleider gebruikt Toegankelijkheid alleen om de selectie te lezen. Hij kan niet klikken of typen. Zonder toestemming voor Toegankelijkheid stopt deze functie. De Word-invoegtoepassing blijft werken.",
    "programme.register.macOS":
      "Ondersteunt macOS 13 (Ventura) en hoger. Verificatie van de macOS-versie op een echte host staat nog open.",
    "programme.register.wordMacPruefung":
      "Een test van deze kandidaat op een echte host staat nog open (M1–M10 en MS1–MS4 van de acceptatie voor Word voor Mac).",
    "programme.register.wordWeb": "Word voor het web",
    "programme.register.wordWebPruefung":
      "Vereist een eigen acceptatietest, onafhankelijk van Word voor Mac. Elk resultaat geldt alleen voor de geteste host.",
    "programme.register.finder": "Finder (geselecteerd bestand)",
    "programme.register.finderLesen":
      "Leest alleen het bestand dat in het systeemvenster is gekozen. Het bestand wordt met herkomst en versie opgeslagen in de bestaande objectopslag. Zolang de classificatie onbekend is, geldt het bestand als beschermd.",
    "programme.register.finderAuswahl":
      "Alleen het bestand dat je uitdrukkelijk selecteert wordt opgenomen. Mappen en naastgelegen bestanden vallen erbuiten.",
    "programme.register.finderSchreiben":
      "Klara kan bestanden in Finder niet verplaatsen, wijzigen of verwijderen.",
    "programme.register.finderErgebnis":
      "Bij opname worden de SHA-256-controlesom, grootte en wijzigingstijd van de bestandsversie vastgelegd. De server berekent de controlesom opnieuw en weigert een afwijkend bestand.",
    "programme.register.finderRuecknahme":
      "Bij opname blijft het bestand intact. Er is dus niets om ongedaan te maken.",
    "programme.register.finderFreigabe":
      "Toestemming van het systeem voor toegang tot het bestand is vereist. Een schermafbeelding kan het bestand niet vervangen.",
    "programme.register.keinHostbeleg":
      "Voor dit programma ontbreekt verificatie op de host. Een geslaagde Word-test geldt alleen voor Word. Tot een eigen test op een echte host geldt dit programma als niet geleverd.",
    "programme.titel": "In andere programma's",
    "programme.intro":
      "Wat {{assistenz}} in welk programma kan – stand van deze installatie. Programma's die hier niet staan, worden niet ondersteund.",
    "programme.laden": "Wordt geladen …",
    "programme.fehler": "Het overzicht kon nu niet worden gelezen.",
    "programme.wiederholen": "Opnieuw laden",
    "programme.status.geliefert": "Echt gecontroleerd",
    "programme.status.gebaut": "Gebouwd – nog niet echt gecontroleerd",
    "programme.status.nichtGeliefert": "Niet geleverd",
    "programme.os": "macOS: vanaf {{fassung}} · echt gecontroleerd: {{geprueft}}",
    "programme.os.offen": "open",
    "programme.faehigkeit.lesen": "Lezen",
    "programme.faehigkeit.auswahl": "Selectie",
    "programme.faehigkeit.schreiben": "Schrijven",
    "programme.faehigkeit.ergebnispruefung": "Resultaatcontrole",
    "programme.faehigkeit.ruecknahme": "Ongedaan maken",
    "programme.stand.real-belegt": "echt gecontroleerd",
    "programme.stand.gebaut-ohne-hostbeleg": "gebouwd, zonder echte run",
    "programme.stand.nicht-geliefert": "niet geleverd",
    "programme.stand.ausgeschlossen": "bewust uitgesloten",
    "programme.bedienungshilfe": "Toegankelijkheid alleen om de selectie te lezen: {{stand}}",
    "programme.begleiter.titel": "Mac-begeleider verbinden",
    "programme.begleiter.text":
      "De begeleider neemt een in Finder gekozen bestand op en leest op verzoek de selectie in Word. Hij gebruikt je bestaande aanmelding – via een code die twee minuten geldig is en maar één keer kan worden ingewisseld.",
    "programme.begleiter.knopf": "Code voor de begeleider maken",
    "programme.begleiter.code": "Code voor de begeleider: {{code}}",
    "programme.begleiter.fehler": "Er kon nu geen code worden gemaakt.",
  },
} satisfies Textmodul;
