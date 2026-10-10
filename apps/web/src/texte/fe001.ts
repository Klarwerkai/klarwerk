// ================================================================================================
// FE-001 · DIE TEXTE DER ARBEITSANLEITUNGEN — Orientierung, Auswahl, Rückmeldungen, Hilfe.
// ================================================================================================
//
// WAS HIER STEHT: jeder NEUE Satz, den FE-001 für `/gesamtanweisungen` und `/gesamtanweisungen/:id`
// braucht — die vier Antworten vor der ersten Eingabe (wofür, was mitbringen, was entsteht, erster
// Schritt), die menschliche Suche und Fassungswahl, die Kopfbearbeitung, die Erklärung des
// Vorlegens und die statische Seitenhilfe, die ohne jedes Modell funktioniert.
//
// WAS NICHT HIER STEHT: die bestehenden Schlüssel `ga.*` und `help.gesamtanweisungen.*`. Ihre
// Werte hat FE-001 an Ort und Stelle in `i18n.ts` geändert (nutzerseitig „Arbeitsanleitungen",
// „Abschnitte" statt „Bausteine", Hilfe ohne die überholte Behauptung „es gibt keine Liste"); der
// Nachtrag steht in `tests/i18n-textmodule/werte-vorher.json`. Deshalb ist `legacySchluessel` leer.
//
// ANREDE „du", wie die Hilfekapitel und Hauptseiten des Produkts.
// BEISPIELE SIND ALS BEISPIELE GEKENNZEICHNET — sie behaupten keinen vorhandenen Demobestand.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "fe001.",
  legacySchluessel: [],
  de: {
    "fe001.einstieg.mitbringen.frage": "Was bringe ich mit?",
    "fe001.einstieg.mitbringen.antwort":
      "Vorhandenes Wissen aus der Bibliothek, zum Beispiel Einträge wie „Arbeitsplatz einrichten“ oder „Sicher anmelden“. Du schreibst hier nichts neu, sondern wählst Vorhandenes aus.",
    "fe001.einstieg.ergebnis.frage": "Was erhalte ich?",
    "fe001.einstieg.ergebnis.antwort":
      "Eine lesbare Arbeitsanleitung mit Zweck, Geltungsbereich, Voraussetzungen und geordneten Abschnitten. Jeder Abschnitt bleibt an die Fassung gebunden, die du ausgewählt hast.",
    "fe001.einstieg.ersterSchritt.frage": "Wie fange ich an?",
    "fe001.einstieg.ersterSchritt.antwort":
      "Gib unten bei „Neue Arbeitsanleitung erstellen“ einen Titel ein. Danach beschreibst du den Zweck und fügst Abschnitte hinzu.",
    "fe001.einstieg.beispiel":
      "Beispiel zur Veranschaulichung: Eine Teamleitung stellt „Start im Homeoffice“ aus Anleitungen zu „Arbeitsplatz einrichten“, „Sicher anmelden“ und „Hilfe bei Problemen“ zusammen; neue Mitarbeitende lesen danach eine geordnete Anleitung. Solche Einträge sind nicht automatisch vorhanden.",
    "fe001.anlegen.titelLabel": "Titel der Arbeitsanleitung",
    "fe001.anlegen.titelHinweis":
      "Ein kurzer Name, unter dem andere die Anleitung wiederfinden, z. B. „Start im Homeoffice“. Nach dem Erstellen öffnet sich die Anleitung; dort ergänzt du Zweck, Geltungsbereich und Abschnitte.",
    "fe001.anlegen.titelFehlt":
      "Gib zuerst einen Titel ein – dann kannst du die Anleitung erstellen.",
    "fe001.anlegen.laeuft": "Wird erstellt …",
    "fe001.zeitUnbekannt": "Zeitpunkt unbekannt",
    "fe001.zurUebersicht": "← Alle Arbeitsanleitungen",
    "fe001.meta.erstelltVon": "Erstellt von {{name}}",
    "fe001.meta.geaendert": "Zuletzt geändert {{zeit}}",
    "fe001.schritte.titel": "So entsteht deine Arbeitsanleitung",
    "fe001.schritte.eins":
      "1. Beschreiben: Titel, Zweck, Geltungsbereich und Voraussetzungen festhalten.",
    "fe001.schritte.zwei":
      "2. Hinzufügen: vorhandene Einträge suchen und je eine feste Fassung als Abschnitt aufnehmen.",
    "fe001.schritte.drei":
      "3. Lesen und ordnen: die Lesefassung prüfen und die Reihenfolge anpassen.",
    "fe001.schritte.vier": "4. Vorlegen: die ganze Anleitung zur Entscheidung einreichen.",
    "fe001.kopf.titel": "Worum geht es?",
    "fe001.kopf.einleitung":
      "Beschreibe kurz, wofür die Anleitung da ist und für wen sie gilt. Das steht später oben in der Lesefassung.",
    "fe001.kopf.hinweis.titel": "Der Name der Anleitung. Er darf nicht leer sein.",
    "fe001.kopf.hinweis.zweck":
      "Was soll jemand nach dem Lesen können? Z. B. „Neue Mitarbeitende richten ihren Arbeitsplatz im Homeoffice selbst ein.“",
    "fe001.kopf.hinweis.geltungsbereich":
      "Für wen oder wo gilt die Anleitung? Z. B. „Alle Teams am Standort Köln“.",
    "fe001.kopf.hinweis.voraussetzungen":
      "Was muss vorher erledigt sein oder bereitliegen? Z. B. „Dienstlaptop erhalten“.",
    "fe001.kopf.speichern": "Angaben speichern",
    "fe001.kopf.gespeichert": "Gespeichert.",
    "fe001.kopf.ungespeichert":
      "Noch nicht gespeichert – deine Änderungen stehen bisher nur in diesem Formular.",
    "fe001.kopf.titelPflicht": "Der Titel darf nicht leer sein.",
    "fe001.kopf.nichtsGeaendert": "Ändere ein Feld, um zu speichern.",
    "fe001.auswahl.einleitung":
      "Suche nach einem vorhandenen Eintrag, prüfe die Vorschau und wähle die Fassung, die in deine Anleitung soll. Kennungen brauchst du dafür nicht.",
    "fe001.auswahl.sucheLabel": "Vorhandenes Wissen suchen",
    "fe001.auswahl.sucheHinweis":
      "Titel oder Begriff eingeben, z. B. „Anmeldung“, und mit Enter oder „Suchen“ bestätigen. Du siehst nur Einträge, die du lesen darfst.",
    "fe001.auswahl.suchen": "Suchen",
    "fe001.auswahl.zuKurz": "Bitte mindestens {{anzahl}} Zeichen eingeben.",
    "fe001.auswahl.sucheLaeuft": "Suche läuft …",
    "fe001.auswahl.sucheFehler":
      "Die Suche hat nicht geantwortet. Versuche es erneut; dein Suchbegriff bleibt stehen.",
    "fe001.auswahl.erneutSuchen": "Erneut suchen",
    "fe001.auswahl.keineTreffer":
      "Keine Einträge zu „{{begriff}}“ gefunden. Versuche einen anderen Begriff. Fehlt der Inhalt ganz, lege ihn zuerst über „Wissen erfassen“ an.",
    "fe001.auswahl.trefferAnzahl_one": "1 Treffer – wähle den passenden Eintrag aus.",
    "fe001.auswahl.trefferAnzahl_other": "{{count}} Treffer – wähle den passenden Eintrag aus.",
    "fe001.auswahl.mehrTreffer":
      "Gezeigt werden die ersten 20; verfeinere den Begriff, um weitere zu finden.",
    "fe001.auswahl.gewaehlt": "Ausgewählt – wähle unten die Fassung.",
    "fe001.auswahl.gewaehltGesperrt": "Ausgewählt – für dich nicht zugänglich.",
    "fe001.auswahl.aktuelleFassung": "Aktuelle Fassung {{version}}",
    "fe001.auswahl.fassungenLaden": "Fassungen werden geladen …",
    "fe001.auswahl.fassungenVerborgen":
      "Dieser Eintrag ist für dich nicht (mehr) zugänglich. Wähle einen anderen Eintrag.",
    "fe001.auswahl.fassungenFehler":
      "Die Fassungen konnten nicht geladen werden. Versuche es erneut.",
    "fe001.auswahl.erneutLaden": "Erneut laden",
    "fe001.auswahl.keineFassung":
      "Zu diesem Eintrag ist noch keine feste Fassung gespeichert. Er kann deshalb noch nicht aufgenommen werden – wähle einen anderen Eintrag.",
    "fe001.auswahl.fassungFrage": "Welche Fassung von „{{titel}}“ soll in die Anleitung?",
    "fe001.auswahl.fassungErklaerung":
      "Die Anleitung übernimmt genau diese Fassung. Spätere Änderungen am Eintrag ersetzen sie nicht still; du siehst dann einen Hinweis auf die neuere Fassung.",
    "fe001.auswahl.fassungNummer": "Fassung {{version}}",
    "fe001.auswahl.aktuell": "(aktuell)",
    "fe001.auswahl.schonEnthalten": "bereits in dieser Anleitung",
    "fe001.auswahl.vorschau": "Vorschau der gewählten Fassung",
    "fe001.auswahl.vorschauVon": "Vorschau · Fassung {{version}}",
    "fe001.auswahl.nochNichts": "Noch kein Eintrag ausgewählt. Suche oben und wähle einen Treffer.",
    "fe001.auswahl.fachleute": "Für Fachleute: Inhaltsnachweis angeben (optional)",
    "fe001.auswahl.nachweisHinweis":
      "Nur ausfüllen, wenn dir ein Prüfwert zu genau dieser Fassung vorliegt. Er belegt beim Vergleich, dass der Inhalt unverändert ist – nicht, dass er richtig ist.",
    "fe001.auswahl.aufnehmen": "Als Abschnitt aufnehmen",
    "fe001.auswahl.aufnehmenMit": "Fassung {{version}} als Abschnitt aufnehmen",
    "fe001.auswahl.sperreEintrag": "Wähle zuerst einen Eintrag aus der Suche.",
    "fe001.auswahl.sperreFassung": "Wähle jetzt die Fassung, die aufgenommen werden soll.",
    "fe001.auswahl.sperreZugriff":
      "Aufnehmen ist gesperrt: Die Fassungen dieses Eintrags sind für dich nicht zugänglich. Wähle einen anderen Eintrag oder lade erneut.",
    "fe001.auswahl.aufgenommen":
      "„{{titel}}“ (Fassung {{version}}) wurde als Abschnitt aufgenommen und steht unten in der Lesefassung.",
    "fe001.abschnitt.ueberschrift": "{{nummer}}. {{titel}}",
    "fe001.abschnitt.ohneHerkunft": "Abschnitt ohne auffindbare Herkunft",
    "fe001.ordnen.hochAria": "„{{titel}}“ nach oben verschieben",
    "fe001.ordnen.runterAria": "„{{titel}}“ nach unten verschieben",
    "fe001.lesestand.titel": "Lesefassung",
    "fe001.lesestand.einleitung":
      "So lesen andere deine Anleitung. Jeder Abschnitt nennt den Eintrag und die Fassung, aus der er stammt.",
    "fe001.lesestand.nichtBeschrieben": "Noch nicht beschrieben.",
    "fe001.sperre.entschieden":
      "Diese Arbeitsanleitung ist angenommen und wird nicht mehr geändert.",
    "fe001.vergleich.einleitung":
      "Vergleiche zwei gespeicherte Stände dieser Anleitung. Jede gespeicherte Änderung – Abschnitt hinzugefügt, Reihenfolge, Angaben – ergibt einen neuen Stand.",
    "fe001.vergleich.bitteWaehlen": "Stand wählen …",
    "fe001.vergleich.stand": "Stand {{nummer}}",
    "fe001.vergleich.standAktuell": "Stand {{nummer}} (aktuell)",
    "fe001.vergleich.standErster": "Stand {{nummer}} (erster)",
    "fe001.vergleich.staendeOffline":
      "Keine Verbindung – die gespeicherten Stände können gerade nicht geladen werden. Sobald du wieder online bist, werden sie nachgeladen.",
    "fe001.sperre.kopfUngespeichert":
      "Vorlegen ist gesperrt: Unter „Worum geht es?“ stehen noch nicht gespeicherte Änderungen. Speichere sie zuerst – oder lade die Seite neu, um sie zu verwerfen.",
    "fe001.sperre.voraussetzungUngespeichert":
      "Vorlegen ist gesperrt: Bei einem Abschnitt steht eine noch nicht übernommene Voraussetzung. Übernimm sie zuerst – oder lade die Seite neu, um sie zu verwerfen.",
    "fe001.voraussetzung.ungespeichert":
      "Noch nicht übernommen – diese Voraussetzung steht bisher nur in diesem Feld.",
    "fe001.vergleich.staendeAuffrischungFehler":
      "Die gespeicherten Stände konnten nicht neu geladen werden. Unten steht der zuletzt geladene Stand; er kann veraltet sein. Lade sie erneut oder lade die Seite neu.",
    "fe001.auswahl.sucheAuffrischungFehler":
      "Die Suche konnte nicht aktualisiert werden. Die Treffer unten stammen von der letzten erfolgreichen Suche und sind vielleicht nicht mehr aktuell.",
    "fe001.sperre.unvollstaendig":
      "Vorlegen ist gesperrt: Du siehst nicht alle Abschnitte dieser Arbeitsanleitung. Vorlegen kann nur, wer die ganze Anleitung lesen darf – wende dich an die Person, die sie angelegt hat.",
    "fe001.vergleich.staendeLaden": "Die gespeicherten Stände werden geladen …",
    "fe001.vergleich.staendeFehler":
      "Die gespeicherten Stände liegen gerade nicht vor. Lade sie erneut oder lade die Seite neu.",
    "fe001.vergleich.zuWenige_one":
      "Noch kein Vergleich möglich: Es gibt erst einen gespeicherten Stand. Sobald du etwas änderst, entsteht ein zweiter.",
    "fe001.vergleich.zuWenige_other":
      "Noch kein Vergleich möglich: Es gibt noch keine zwei gespeicherten Stände. Sobald du etwas änderst, entsteht ein neuer.",
    "fe001.vergleich.waehlen":
      "Wähle einen älteren und einen neueren Stand – oder nimm „Letzte Änderung zeigen“.",
    "fe001.vergleich.gleicherStand":
      "Wähle zwei verschiedene Stände; ein Stand wird nicht mit sich selbst verglichen.",
    "fe001.vergleich.letzteAenderung": "Letzte Änderung zeigen",
    "fe001.entscheidung.bedeutung":
      "Vorlegen heißt: Du reichst diese Fassung der ganzen Anleitung zur Entscheidung ein. Danach wird sie angenommen oder abgelehnt.",
    "fe001.entscheidung.wartet":
      "Vorgelegt – die Anleitung wartet auf die Entscheidung einer Person mit Prüfrecht. Du musst gerade nichts weiter tun.",
    "fe001.entscheidung.wartetAufDich":
      "Vorgelegt – du hast das Prüfrecht und kannst die ganze Anleitung jetzt annehmen oder ablehnen.",
    "fe001.entscheidung.angenommen":
      "Angenommen. Diese Fassung der Anleitung gilt und wird nicht mehr geändert.",
    "fe001.entscheidung.abgelehnt":
      "Abgelehnt. Du kannst die Anleitung überarbeiten und erneut vorlegen.",
    "fe001.entscheidung.wer":
      "Entscheiden können Personen mit Prüfrecht – nach den bestehenden Rollen Controller und Administrator.",
    "fe001.entscheidung.teileNichtGanzes":
      "Freigaben einzelner Einträge zählen nicht als Freigabe dieser Anleitung; entschieden wird über das Ganze.",
    "fe001.entscheidung.keinVersand":
      "Eine Benachrichtigung ist hier nicht angebunden – sag der entscheidenden Person bei Bedarf selbst Bescheid.",
    "fe001.entscheidung.pruefungOffen":
      "Eine automatische fachliche Prüfung ist noch nicht angebunden. Über die Anleitung entscheiden allein Menschen.",
    "fe001.status.fassung": "Stand {{nummer}}",
    "fe001.status.naechsterSchritt": "Nächster Schritt:",
    "fe001.sperre.keinErfassungsrecht":
      "Nur lesen: Ändern und Vorlegen können Personen, die Wissen erfassen dürfen.",
    "fe001.status.bedeutung.entwurf":
      "Gespeichert, aber noch nicht zur Entscheidung vorgelegt – nicht freigegeben.",
    "fe001.status.bedeutung.vorgelegt":
      "Zur Entscheidung vorgelegt, aber noch nicht freigegeben. Vorgelegt heißt eingereicht – über diese Vorlage ist noch nicht entschieden.",
    "fe001.status.bedeutung.entschieden":
      "Freigegeben: Eine Person mit Prüfrecht hat diese Fassung angenommen. Sie gilt und wird nicht mehr geändert.",
    "fe001.status.bedeutung.abgelehnt":
      "Abgelehnt – nicht freigegeben. Eine Person mit Prüfrecht hat die vorgelegte Fassung nicht angenommen.",
    "fe001.status.pruefung.freigegeben":
      "Freigegeben wurde Stand {{nummer}} am {{zeit}}. Wer freigegeben hat, ist für diese ältere Freigabe nicht festgehalten.",
    "fe001.status.pruefung.abgelehnt":
      "Wer abgelehnt hat und wann, ist für diese ältere Entscheidung nicht festgehalten.",
    "fe001.status.schritt.vorlegen":
      "Lesefassung prüfen und die Anleitung mit „Vorlegen“ zur Entscheidung einreichen.",
    "fe001.status.schritt.abschnitteFehlen":
      "Abschnitte aus vorhandenem Wissen hinzufügen – ohne Abschnitte kann die Anleitung nicht vorgelegt werden.",
    "fe001.status.schritt.ueberarbeiten":
      "Anleitung überarbeiten und mit „Vorlegen“ erneut zur Entscheidung einreichen.",
    "fe001.status.schritt.nurLesen":
      "Du kannst die Anleitung lesen. Vorlegen und überarbeiten können Personen, die Wissen erfassen dürfen.",
    "fe001.status.schritt.unvollstaendigVorlegen":
      "Vorlegen ist für dich nicht möglich, weil du nicht alle Abschnitte siehst. Wende dich an die Person, die die Anleitung angelegt hat.",
    "fe001.status.schritt.warten":
      "Für dich ist nichts zu tun: Die Anleitung wartet auf die Entscheidung einer Person mit Prüfrecht (Controller oder Administrator). Eine Benachrichtigung ist nicht angebunden.",
    "fe001.status.schritt.entscheiden":
      "Du hast das Prüfrecht und kannst selbst entscheiden: Anleitung lesen, dann „Annehmen“ oder „Ablehnen“.",
    "fe001.status.schritt.unvollstaendigEntscheiden":
      "Entscheiden ist für dich nicht möglich, weil du nicht alle Abschnitte siehst. Entscheiden kann nur, wer die ganze Anleitung lesen darf.",
    "fe001.status.schritt.gilt":
      "Nichts mehr zu tun: Die Anleitung gilt in dieser Fassung und wird nicht mehr geändert. Für Änderungen braucht es eine neue Arbeitsanleitung.",
    "fe001.hilfe.uebersichtTitel": "Arbeitsanleitungen – Übersicht",
    "fe001.hilfe.uebersicht":
      "Hier siehst du die Arbeitsanleitungen, die du lesen darfst, und legst neue an. Eine Arbeitsanleitung stellst du aus vorhandenem Wissen zusammen: Titel eingeben, „Neue Arbeitsanleitung erstellen“ wählen, danach Zweck beschreiben und Abschnitte hinzufügen. Ein Klick auf einen Titel öffnet die Anleitung. Dafür wird keine KI gebraucht.",
    "fe001.hilfe.detailTitel": "Arbeitsanleitung bearbeiten",
    "fe001.hilfe.detail":
      "Unter „Worum geht es?“ beschreibst du Zweck, Geltungsbereich und Voraussetzungen. Unter „Abschnitt aus vorhandenem Wissen hinzufügen“ suchst du einen Eintrag nach Titel, prüfst die Vorschau und wählst eine feste Fassung. Die Lesefassung zeigt das entstehende Dokument; mit „Nach oben“ und „Nach unten“ änderst du die Reihenfolge. „Zur Entscheidung vorlegen“ reicht die ganze Anleitung ein – entscheiden können Personen mit Prüfrecht. „Was hat sich geändert?“ vergleicht zwei gespeicherte Stände. Eine automatische fachliche Prüfung ist noch nicht angebunden. Dafür wird keine KI gebraucht.",
  },
  en: {
    "fe001.einstieg.mitbringen.frage": "What do I bring?",
    "fe001.einstieg.mitbringen.antwort":
      "Existing knowledge from the library, for example entries such as “Set up your workplace” or “Sign in securely”. You don’t write anything new here; you choose what already exists.",
    "fe001.einstieg.ergebnis.frage": "What do I get?",
    "fe001.einstieg.ergebnis.antwort":
      "A readable work instruction with purpose, scope, prerequisites and ordered sections. Each section stays bound to the version you chose.",
    "fe001.einstieg.ersterSchritt.frage": "How do I start?",
    "fe001.einstieg.ersterSchritt.antwort":
      "Enter a title below under “Create new work instruction”. Then describe the purpose and add sections.",
    "fe001.einstieg.beispiel":
      "Example for illustration: a team lead assembles “Starting in the home office” from instructions on “Set up your workplace”, “Sign in securely” and “Getting help”; new colleagues then read one ordered instruction. Such entries do not exist automatically.",
    "fe001.anlegen.titelLabel": "Title of the work instruction",
    "fe001.anlegen.titelHinweis":
      "A short name others will find it by, e.g. “Starting in the home office”. After creating it, the instruction opens; there you add purpose, scope and sections.",
    "fe001.anlegen.titelFehlt": "Enter a title first – then you can create the instruction.",
    "fe001.anlegen.laeuft": "Creating …",
    "fe001.zeitUnbekannt": "time unknown",
    "fe001.zurUebersicht": "← All work instructions",
    "fe001.meta.erstelltVon": "Created by {{name}}",
    "fe001.meta.geaendert": "Last changed {{zeit}}",
    "fe001.schritte.titel": "How your work instruction comes together",
    "fe001.schritte.eins": "1. Describe: record title, purpose, scope and prerequisites.",
    "fe001.schritte.zwei":
      "2. Add: search existing entries and add one fixed version of each as a section.",
    "fe001.schritte.drei": "3. Read and order: check the reading view and adjust the order.",
    "fe001.schritte.vier": "4. Submit: hand in the whole instruction for a decision.",
    "fe001.kopf.titel": "What is it about?",
    "fe001.kopf.einleitung":
      "Briefly describe what the instruction is for and whom it applies to. This appears at the top of the reading view.",
    "fe001.kopf.hinweis.titel": "The name of the instruction. It must not be empty.",
    "fe001.kopf.hinweis.zweck":
      "What should someone be able to do after reading? E.g. “New colleagues set up their home office workplace on their own.”",
    "fe001.kopf.hinweis.geltungsbereich":
      "Whom or where does it apply to? E.g. “All teams at the Cologne site”.",
    "fe001.kopf.hinweis.voraussetzungen":
      "What must be done or at hand beforehand? E.g. “Company laptop received”.",
    "fe001.kopf.speichern": "Save details",
    "fe001.kopf.gespeichert": "Saved.",
    "fe001.kopf.ungespeichert": "Not saved yet – your changes exist only in this form so far.",
    "fe001.kopf.titelPflicht": "The title must not be empty.",
    "fe001.kopf.nichtsGeaendert": "Change a field to save.",
    "fe001.auswahl.einleitung":
      "Search for an existing entry, check the preview and choose the version that should go into your instruction. You don’t need any IDs for this.",
    "fe001.auswahl.sucheLabel": "Search existing knowledge",
    "fe001.auswahl.sucheHinweis":
      "Enter a title or term, e.g. “sign in”, and confirm with Enter or “Search”. You only see entries you are allowed to read.",
    "fe001.auswahl.suchen": "Search",
    "fe001.auswahl.zuKurz": "Please enter at least {{anzahl}} characters.",
    "fe001.auswahl.sucheLaeuft": "Searching …",
    "fe001.auswahl.sucheFehler":
      "The search did not respond. Try again; your search term stays in place.",
    "fe001.auswahl.erneutSuchen": "Search again",
    "fe001.auswahl.keineTreffer":
      "No entries found for “{{begriff}}”. Try another term. If the content does not exist yet, create it first via “Capture Knowledge”.",
    "fe001.auswahl.trefferAnzahl_one": "1 result – choose the matching entry.",
    "fe001.auswahl.trefferAnzahl_other": "{{count}} results – choose the matching entry.",
    "fe001.auswahl.mehrTreffer": "Showing the first 20; refine the term to find others.",
    "fe001.auswahl.gewaehlt": "Selected – choose the version below.",
    "fe001.auswahl.gewaehltGesperrt": "Selected – not accessible to you.",
    "fe001.auswahl.aktuelleFassung": "Current version {{version}}",
    "fe001.auswahl.fassungenLaden": "Loading versions …",
    "fe001.auswahl.fassungenVerborgen":
      "This entry is not (or no longer) accessible to you. Choose another entry.",
    "fe001.auswahl.fassungenFehler": "The versions could not be loaded. Try again.",
    "fe001.auswahl.erneutLaden": "Load again",
    "fe001.auswahl.keineFassung":
      "No fixed version of this entry has been saved yet, so it cannot be added – choose another entry.",
    "fe001.auswahl.fassungFrage": "Which version of “{{titel}}” should go into the instruction?",
    "fe001.auswahl.fassungErklaerung":
      "The instruction takes exactly this version. Later changes to the entry do not silently replace it; you will see a note about the newer version instead.",
    "fe001.auswahl.fassungNummer": "Version {{version}}",
    "fe001.auswahl.aktuell": "(current)",
    "fe001.auswahl.schonEnthalten": "already in this instruction",
    "fe001.auswahl.vorschau": "Preview of the chosen version",
    "fe001.auswahl.vorschauVon": "Preview · version {{version}}",
    "fe001.auswahl.nochNichts": "No entry selected yet. Search above and choose a result.",
    "fe001.auswahl.fachleute": "For specialists: provide a content record (optional)",
    "fe001.auswahl.nachweisHinweis":
      "Only fill this in if you have a check value for exactly this version. In a comparison it shows that the content is unchanged – not that it is correct.",
    "fe001.auswahl.aufnehmen": "Add as section",
    "fe001.auswahl.aufnehmenMit": "Add version {{version}} as section",
    "fe001.auswahl.sperreEintrag": "First choose an entry from the search.",
    "fe001.auswahl.sperreFassung": "Now choose the version to add.",
    "fe001.auswahl.sperreZugriff":
      "Adding is blocked: the versions of this entry are not accessible to you. Choose another entry or load again.",
    "fe001.auswahl.aufgenommen":
      "“{{titel}}” (version {{version}}) was added as a section and appears below in the reading view.",
    "fe001.abschnitt.ueberschrift": "{{nummer}}. {{titel}}",
    "fe001.abschnitt.ohneHerkunft": "Section whose origin cannot be found",
    "fe001.ordnen.hochAria": "Move “{{titel}}” up",
    "fe001.ordnen.runterAria": "Move “{{titel}}” down",
    "fe001.lesestand.titel": "Reading view",
    "fe001.lesestand.einleitung":
      "This is how others read your instruction. Each section names the entry and the version it comes from.",
    "fe001.lesestand.nichtBeschrieben": "Not described yet.",
    "fe001.sperre.entschieden": "This work instruction has been accepted and is no longer changed.",
    "fe001.vergleich.einleitung":
      "Compare two saved states of this instruction. Every saved change – a section added, the order, the details – creates a new state.",
    "fe001.vergleich.bitteWaehlen": "Choose a state …",
    "fe001.vergleich.stand": "State {{nummer}}",
    "fe001.vergleich.standAktuell": "State {{nummer}} (current)",
    "fe001.vergleich.standErster": "State {{nummer}} (first)",
    "fe001.vergleich.staendeOffline":
      "No connection – the saved states cannot be loaded right now. They will be loaded as soon as you are back online.",
    "fe001.sperre.kopfUngespeichert":
      "Submitting is blocked: “What is it about?” contains unsaved changes. Save them first – or reload the page to discard them.",
    "fe001.sperre.voraussetzungUngespeichert":
      "Submitting is blocked: a section has a precondition that has not been applied yet. Apply it first – or reload the page to discard it.",
    "fe001.voraussetzung.ungespeichert":
      "Not applied yet – this precondition exists only in this field so far.",
    "fe001.vergleich.staendeAuffrischungFehler":
      "The saved states could not be reloaded. Below is the last loaded state; it may be out of date. Load them again or reload the page.",
    "fe001.auswahl.sucheAuffrischungFehler":
      "The search could not be refreshed. The results below come from the last successful search and may be out of date.",
    "fe001.sperre.unvollstaendig":
      "Submitting is blocked: you cannot see all sections of this work instruction. Only someone who may read the whole instruction can submit it – contact the person who created it.",
    "fe001.vergleich.staendeLaden": "Loading the saved states …",
    "fe001.vergleich.staendeFehler":
      "The saved states are not available right now. Load them again or reload the page.",
    "fe001.vergleich.zuWenige_one":
      "No comparison possible yet: there is only one saved state. As soon as you change something, a second one is created.",
    "fe001.vergleich.zuWenige_other":
      "No comparison possible yet: there are not two saved states yet. As soon as you change something, a new one is created.",
    "fe001.vergleich.waehlen": "Choose an older and a newer state – or use “Show last change”.",
    "fe001.vergleich.gleicherStand":
      "Choose two different states; a state is not compared with itself.",
    "fe001.vergleich.letzteAenderung": "Show last change",
    "fe001.entscheidung.bedeutung":
      "Submitting means: you hand in this version of the whole instruction for a decision. It is then accepted or rejected.",
    "fe001.entscheidung.wartet":
      "Submitted – the instruction is waiting for a decision by a person with review rights. You don’t need to do anything right now.",
    "fe001.entscheidung.wartetAufDich":
      "Submitted – you have review rights and can now accept or reject the whole instruction.",
    "fe001.entscheidung.angenommen":
      "Accepted. This version of the instruction applies and is no longer changed.",
    "fe001.entscheidung.abgelehnt": "Rejected. You can revise the instruction and submit it again.",
    "fe001.entscheidung.wer":
      "People with review rights can decide – under the existing roles, Controller and Administrator.",
    "fe001.entscheidung.teileNichtGanzes":
      "Approvals of individual entries do not count as approval of this instruction; the decision is about the whole.",
    "fe001.entscheidung.keinVersand":
      "No notification is connected here – let the deciding person know yourself if needed.",
    "fe001.entscheidung.pruefungOffen":
      "An automatic expert review is not connected yet. Only people decide on the instruction.",
    "fe001.status.fassung": "State {{nummer}}",
    "fe001.sperre.keinErfassungsrecht":
      "Read only: people who may capture knowledge can change and submit it.",
    "fe001.status.naechsterSchritt": "Next step:",
    "fe001.status.bedeutung.entwurf": "Saved, but not yet submitted for decision – not approved.",
    "fe001.status.bedeutung.vorgelegt":
      "Submitted for decision, but not approved yet. Submitted means handed in – this submission has not been decided yet.",
    "fe001.status.bedeutung.entschieden":
      "Approved: a person with review rights accepted this version. It applies and is no longer changed.",
    "fe001.status.bedeutung.abgelehnt":
      "Rejected – not approved. A person with review rights did not accept the submitted version.",
    "fe001.status.pruefung.freigegeben":
      "State {{nummer}} was approved on {{zeit}}. Who approved it is not recorded for this earlier approval.",
    "fe001.status.pruefung.abgelehnt":
      "Who rejected it and when is not recorded for this earlier decision.",
    "fe001.status.schritt.vorlegen":
      "Check the reading version and hand in the instruction for decision with “Submit”.",
    "fe001.status.schritt.abschnitteFehlen":
      "Add sections from existing knowledge – without sections the instruction cannot be submitted.",
    "fe001.status.schritt.ueberarbeiten":
      "Revise the instruction and hand it in again for decision with “Submit”.",
    "fe001.status.schritt.nurLesen":
      "You can read the instruction. People who may capture knowledge can submit and revise it.",
    "fe001.status.schritt.unvollstaendigVorlegen":
      "You cannot submit because you do not see all sections. Contact the person who created the instruction.",
    "fe001.status.schritt.warten":
      "Nothing to do for you: the instruction is waiting for a decision by a person with review rights (Controller or Administrator). No notification is connected.",
    "fe001.status.schritt.entscheiden":
      "You have review rights and can decide yourself: read the instruction, then “Accept” or “Reject”.",
    "fe001.status.schritt.unvollstaendigEntscheiden":
      "You cannot decide because you do not see all sections. Only someone who may read the whole instruction can decide.",
    "fe001.status.schritt.gilt":
      "Nothing left to do: the instruction applies in this version and is no longer changed. Changes need a new work instruction.",
    "fe001.hilfe.uebersichtTitel": "Work instructions – overview",
    "fe001.hilfe.uebersicht":
      "Here you see the work instructions you may read and create new ones. You assemble a work instruction from existing knowledge: enter a title, choose “Create new work instruction”, then describe the purpose and add sections. Clicking a title opens the instruction. No AI is needed for this.",
    "fe001.hilfe.detailTitel": "Editing a work instruction",
    "fe001.hilfe.detail":
      "Under “What is it about?” you describe purpose, scope and prerequisites. Under “Add a section from existing knowledge” you search an entry by title, check the preview and choose a fixed version. The reading view shows the resulting document; “Move up” and “Move down” change the order. “Submit for decision” hands in the whole instruction – people with review rights decide. “What has changed?” compares two saved states. An automatic expert review is not connected yet. No AI is needed for this.",
  },
  nl: {
    "fe001.einstieg.mitbringen.frage": "Wat breng ik mee?",
    "fe001.einstieg.mitbringen.antwort":
      "Bestaande kennis uit de bibliotheek, bijvoorbeeld items zoals „Werkplek inrichten” of „Veilig aanmelden”. Je schrijft hier niets nieuws, maar kiest wat er al is.",
    "fe001.einstieg.ergebnis.frage": "Wat krijg ik?",
    "fe001.einstieg.ergebnis.antwort":
      "Een leesbare werkinstructie met doel, toepassingsgebied, voorwaarden en geordende onderdelen. Elk onderdeel blijft gekoppeld aan de versie die je hebt gekozen.",
    "fe001.einstieg.ersterSchritt.frage": "Hoe begin ik?",
    "fe001.einstieg.ersterSchritt.antwort":
      "Vul hieronder bij „Nieuwe werkinstructie maken” een titel in. Daarna beschrijf je het doel en voeg je onderdelen toe.",
    "fe001.einstieg.beispiel":
      "Voorbeeld ter illustratie: een teamleider stelt „Starten in het thuiskantoor” samen uit instructies over „Werkplek inrichten”, „Veilig aanmelden” en „Hulp bij problemen”; nieuwe collega’s lezen daarna één geordende instructie. Zulke items zijn niet automatisch aanwezig.",
    "fe001.anlegen.titelLabel": "Titel van de werkinstructie",
    "fe001.anlegen.titelHinweis":
      "Een korte naam waaronder anderen de instructie terugvinden, bijv. „Starten in het thuiskantoor”. Na het maken opent de instructie; daar vul je doel, toepassingsgebied en onderdelen aan.",
    "fe001.anlegen.titelFehlt": "Vul eerst een titel in – dan kun je de instructie maken.",
    "fe001.anlegen.laeuft": "Wordt gemaakt …",
    "fe001.zeitUnbekannt": "tijdstip onbekend",
    "fe001.zurUebersicht": "← Alle werkinstructies",
    "fe001.meta.erstelltVon": "Gemaakt door {{name}}",
    "fe001.meta.geaendert": "Laatst gewijzigd {{zeit}}",
    "fe001.schritte.titel": "Zo ontstaat je werkinstructie",
    "fe001.schritte.eins":
      "1. Beschrijven: titel, doel, toepassingsgebied en voorwaarden vastleggen.",
    "fe001.schritte.zwei":
      "2. Toevoegen: bestaande items zoeken en van elk één vaste versie als onderdeel opnemen.",
    "fe001.schritte.drei":
      "3. Lezen en ordenen: de leesversie controleren en de volgorde aanpassen.",
    "fe001.schritte.vier": "4. Voorleggen: de hele instructie ter beslissing indienen.",
    "fe001.kopf.titel": "Waar gaat het om?",
    "fe001.kopf.einleitung":
      "Beschrijf kort waarvoor de instructie is en voor wie ze geldt. Dit staat later bovenaan in de leesversie.",
    "fe001.kopf.hinweis.titel": "De naam van de instructie. Die mag niet leeg zijn.",
    "fe001.kopf.hinweis.zweck":
      "Wat moet iemand na het lezen kunnen? Bijv. „Nieuwe collega’s richten hun thuiswerkplek zelf in.”",
    "fe001.kopf.hinweis.geltungsbereich":
      "Voor wie of waar geldt de instructie? Bijv. „Alle teams op de locatie Keulen”.",
    "fe001.kopf.hinweis.voraussetzungen":
      "Wat moet vooraf geregeld zijn of klaarliggen? Bijv. „Laptop van de zaak ontvangen”.",
    "fe001.kopf.speichern": "Gegevens opslaan",
    "fe001.kopf.gespeichert": "Opgeslagen.",
    "fe001.kopf.ungespeichert":
      "Nog niet opgeslagen – je wijzigingen staan tot nu toe alleen in dit formulier.",
    "fe001.kopf.titelPflicht": "De titel mag niet leeg zijn.",
    "fe001.kopf.nichtsGeaendert": "Wijzig een veld om op te slaan.",
    "fe001.auswahl.einleitung":
      "Zoek een bestaand item, bekijk het voorbeeld en kies de versie die in je instructie moet. Je hebt daarvoor geen ID’s nodig.",
    "fe001.auswahl.sucheLabel": "Bestaande kennis zoeken",
    "fe001.auswahl.sucheHinweis":
      "Vul een titel of begrip in, bijv. „aanmelden”, en bevestig met Enter of „Zoeken”. Je ziet alleen items die je mag lezen.",
    "fe001.auswahl.suchen": "Zoeken",
    "fe001.auswahl.zuKurz": "Vul minstens {{anzahl}} tekens in.",
    "fe001.auswahl.sucheLaeuft": "Bezig met zoeken …",
    "fe001.auswahl.sucheFehler":
      "De zoekopdracht gaf geen antwoord. Probeer het opnieuw; je zoekterm blijft staan.",
    "fe001.auswahl.erneutSuchen": "Opnieuw zoeken",
    "fe001.auswahl.keineTreffer":
      "Geen items gevonden voor „{{begriff}}”. Probeer een ander begrip. Bestaat de inhoud nog niet, leg hem dan eerst vast via „Kennis vastleggen”.",
    "fe001.auswahl.trefferAnzahl_one": "1 resultaat – kies het passende item.",
    "fe001.auswahl.trefferAnzahl_other": "{{count}} resultaten – kies het passende item.",
    "fe001.auswahl.mehrTreffer":
      "De eerste 20 worden getoond; verfijn het begrip om andere te vinden.",
    "fe001.auswahl.gewaehlt": "Gekozen – kies hieronder de versie.",
    "fe001.auswahl.gewaehltGesperrt": "Gekozen – voor jou niet toegankelijk.",
    "fe001.auswahl.aktuelleFassung": "Huidige versie {{version}}",
    "fe001.auswahl.fassungenLaden": "Versies worden geladen …",
    "fe001.auswahl.fassungenVerborgen":
      "Dit item is voor jou niet (meer) toegankelijk. Kies een ander item.",
    "fe001.auswahl.fassungenFehler": "De versies konden niet worden geladen. Probeer het opnieuw.",
    "fe001.auswahl.erneutLaden": "Opnieuw laden",
    "fe001.auswahl.keineFassung":
      "Van dit item is nog geen vaste versie opgeslagen. Het kan daarom nog niet worden opgenomen – kies een ander item.",
    "fe001.auswahl.fassungFrage": "Welke versie van „{{titel}}” moet in de instructie?",
    "fe001.auswahl.fassungErklaerung":
      "De instructie neemt precies deze versie over. Latere wijzigingen aan het item vervangen haar niet stilzwijgend; je ziet dan een melding over de nieuwere versie.",
    "fe001.auswahl.fassungNummer": "Versie {{version}}",
    "fe001.auswahl.aktuell": "(huidig)",
    "fe001.auswahl.schonEnthalten": "al in deze instructie",
    "fe001.auswahl.vorschau": "Voorbeeld van de gekozen versie",
    "fe001.auswahl.vorschauVon": "Voorbeeld · versie {{version}}",
    "fe001.auswahl.nochNichts": "Nog geen item gekozen. Zoek hierboven en kies een resultaat.",
    "fe001.auswahl.fachleute": "Voor specialisten: inhoudsbewijs opgeven (optioneel)",
    "fe001.auswahl.nachweisHinweis":
      "Alleen invullen als je een controlewaarde voor precies deze versie hebt. Bij een vergelijking toont die dat de inhoud ongewijzigd is – niet dat hij juist is.",
    "fe001.auswahl.aufnehmen": "Als onderdeel opnemen",
    "fe001.auswahl.aufnehmenMit": "Versie {{version}} als onderdeel opnemen",
    "fe001.auswahl.sperreEintrag": "Kies eerst een item uit de zoekresultaten.",
    "fe001.auswahl.sperreFassung": "Kies nu de versie die moet worden opgenomen.",
    "fe001.auswahl.sperreZugriff":
      "Opnemen is geblokkeerd: de versies van dit item zijn voor jou niet toegankelijk. Kies een ander item of laad opnieuw.",
    "fe001.auswahl.aufgenommen":
      "„{{titel}}” (versie {{version}}) is als onderdeel opgenomen en staat hieronder in de leesversie.",
    "fe001.abschnitt.ueberschrift": "{{nummer}}. {{titel}}",
    "fe001.abschnitt.ohneHerkunft": "Onderdeel zonder vindbare herkomst",
    "fe001.ordnen.hochAria": "„{{titel}}” omhoog verplaatsen",
    "fe001.ordnen.runterAria": "„{{titel}}” omlaag verplaatsen",
    "fe001.lesestand.titel": "Leesversie",
    "fe001.lesestand.einleitung":
      "Zo lezen anderen je instructie. Elk onderdeel noemt het item en de versie waaruit het komt.",
    "fe001.lesestand.nichtBeschrieben": "Nog niet beschreven.",
    "fe001.sperre.entschieden": "Deze werkinstructie is aangenomen en wordt niet meer gewijzigd.",
    "fe001.vergleich.einleitung":
      "Vergelijk twee opgeslagen standen van deze instructie. Elke opgeslagen wijziging – onderdeel toegevoegd, volgorde, gegevens – levert een nieuwe stand op.",
    "fe001.vergleich.bitteWaehlen": "Stand kiezen …",
    "fe001.vergleich.stand": "Stand {{nummer}}",
    "fe001.vergleich.standAktuell": "Stand {{nummer}} (huidig)",
    "fe001.vergleich.standErster": "Stand {{nummer}} (eerste)",
    "fe001.vergleich.staendeOffline":
      "Geen verbinding – de opgeslagen standen kunnen nu niet worden geladen. Zodra je weer online bent, worden ze geladen.",
    "fe001.sperre.kopfUngespeichert":
      "Voorleggen is geblokkeerd: onder „Waar gaat het om?” staan nog niet opgeslagen wijzigingen. Sla ze eerst op – of laad de pagina opnieuw om ze te verwerpen.",
    "fe001.sperre.voraussetzungUngespeichert":
      "Voorleggen is geblokkeerd: bij een onderdeel staat een nog niet overgenomen voorwaarde. Neem die eerst over – of laad de pagina opnieuw om haar te verwerpen.",
    "fe001.voraussetzung.ungespeichert":
      "Nog niet overgenomen – deze voorwaarde staat tot nu toe alleen in dit veld.",
    "fe001.vergleich.staendeAuffrischungFehler":
      "De opgeslagen standen konden niet opnieuw worden geladen. Hieronder staat de laatst geladen stand; die kan verouderd zijn. Laad ze opnieuw of laad de pagina opnieuw.",
    "fe001.auswahl.sucheAuffrischungFehler":
      "De zoekopdracht kon niet worden bijgewerkt. De resultaten hieronder komen van de laatste geslaagde zoekopdracht en zijn misschien niet meer actueel.",
    "fe001.sperre.unvollstaendig":
      "Voorleggen is geblokkeerd: je ziet niet alle onderdelen van deze werkinstructie. Alleen wie de hele instructie mag lezen, kan haar voorleggen – neem contact op met de persoon die haar heeft gemaakt.",
    "fe001.vergleich.staendeLaden": "De opgeslagen standen worden geladen …",
    "fe001.vergleich.staendeFehler":
      "De opgeslagen standen zijn nu niet beschikbaar. Laad ze opnieuw of laad de pagina opnieuw.",
    "fe001.vergleich.zuWenige_one":
      "Nog geen vergelijking mogelijk: er is pas één opgeslagen stand. Zodra je iets wijzigt, ontstaat er een tweede.",
    "fe001.vergleich.zuWenige_other":
      "Nog geen vergelijking mogelijk: er zijn nog geen twee opgeslagen standen. Zodra je iets wijzigt, ontstaat er een nieuwe.",
    "fe001.vergleich.waehlen":
      "Kies een oudere en een nieuwere stand – of gebruik „Laatste wijziging tonen”.",
    "fe001.vergleich.gleicherStand":
      "Kies twee verschillende standen; een stand wordt niet met zichzelf vergeleken.",
    "fe001.vergleich.letzteAenderung": "Laatste wijziging tonen",
    "fe001.entscheidung.bedeutung":
      "Voorleggen betekent: je dient deze versie van de hele instructie ter beslissing in. Daarna wordt ze aangenomen of afgewezen.",
    "fe001.entscheidung.wartet":
      "Voorgelegd – de instructie wacht op de beslissing van iemand met beoordelingsrecht. Je hoeft nu niets meer te doen.",
    "fe001.entscheidung.wartetAufDich":
      "Voorgelegd – je hebt beoordelingsrecht en kunt de hele instructie nu aannemen of afwijzen.",
    "fe001.entscheidung.angenommen":
      "Aangenomen. Deze versie van de instructie geldt en wordt niet meer gewijzigd.",
    "fe001.entscheidung.abgelehnt":
      "Afgewezen. Je kunt de instructie bewerken en opnieuw voorleggen.",
    "fe001.entscheidung.wer":
      "Beslissen kunnen personen met beoordelingsrecht – volgens de bestaande rollen Controller en Administrator.",
    "fe001.entscheidung.teileNichtGanzes":
      "Goedkeuringen van afzonderlijke items gelden niet als goedkeuring van deze instructie; er wordt over het geheel beslist.",
    "fe001.entscheidung.keinVersand":
      "Een melding is hier niet aangesloten – laat het de beslissende persoon zo nodig zelf weten.",
    "fe001.entscheidung.pruefungOffen":
      "Een automatische inhoudelijke controle is nog niet aangesloten. Alleen mensen beslissen over de instructie.",
    "fe001.status.fassung": "Stand {{nummer}}",
    "fe001.status.naechsterSchritt": "Volgende stap:",
    "fe001.sperre.keinErfassungsrecht":
      "Alleen lezen: wijzigen en voorleggen kunnen personen die kennis mogen vastleggen.",
    "fe001.status.bedeutung.entwurf":
      "Opgeslagen, maar nog niet ter beslissing voorgelegd – niet goedgekeurd.",
    "fe001.status.bedeutung.vorgelegt":
      "Ter beslissing voorgelegd, maar nog niet goedgekeurd. Voorgelegd betekent ingediend – over deze indiening is nog niet beslist.",
    "fe001.status.bedeutung.entschieden":
      "Goedgekeurd: een persoon met beoordelingsrecht heeft deze versie aangenomen. Ze geldt en wordt niet meer gewijzigd.",
    "fe001.status.bedeutung.abgelehnt":
      "Afgewezen – niet goedgekeurd. Een persoon met beoordelingsrecht heeft de voorgelegde versie niet aangenomen.",
    "fe001.status.pruefung.freigegeben":
      "Stand {{nummer}} is goedgekeurd op {{zeit}}. Wie heeft goedgekeurd, is voor deze eerdere goedkeuring niet vastgelegd.",
    "fe001.status.pruefung.abgelehnt":
      "Wie heeft afgewezen en wanneer, is voor deze eerdere beslissing niet vastgelegd.",
    "fe001.status.schritt.vorlegen":
      "Leesversie controleren en de instructie met „Voorleggen” ter beslissing indienen.",
    "fe001.status.schritt.abschnitteFehlen":
      "Onderdelen uit bestaande kennis toevoegen – zonder onderdelen kan de instructie niet worden voorgelegd.",
    "fe001.status.schritt.ueberarbeiten":
      "Instructie herzien en met „Voorleggen” opnieuw ter beslissing indienen.",
    "fe001.status.schritt.nurLesen":
      "Je kunt de instructie lezen. Voorleggen en herzien kunnen personen die kennis mogen vastleggen.",
    "fe001.status.schritt.unvollstaendigVorlegen":
      "Voorleggen is voor jou niet mogelijk, omdat je niet alle onderdelen ziet. Neem contact op met de persoon die de instructie heeft gemaakt.",
    "fe001.status.schritt.warten":
      "Voor jou is er niets te doen: de instructie wacht op de beslissing van een persoon met beoordelingsrecht (Controller of Administrator). Een melding is niet aangesloten.",
    "fe001.status.schritt.entscheiden":
      "Je hebt beoordelingsrecht en kunt zelf beslissen: instructie lezen, dan „Aannemen” of „Afwijzen”.",
    "fe001.status.schritt.unvollstaendigEntscheiden":
      "Beslissen is voor jou niet mogelijk, omdat je niet alle onderdelen ziet. Alleen wie de hele instructie mag lezen, kan beslissen.",
    "fe001.status.schritt.gilt":
      "Niets meer te doen: de instructie geldt in deze versie en wordt niet meer gewijzigd. Voor wijzigingen is een nieuwe werkinstructie nodig.",
    "fe001.hilfe.uebersichtTitel": "Werkinstructies – overzicht",
    "fe001.hilfe.uebersicht":
      "Hier zie je de werkinstructies die je mag lezen en maak je nieuwe. Een werkinstructie stel je samen uit bestaande kennis: titel invullen, „Nieuwe werkinstructie maken” kiezen, daarna het doel beschrijven en onderdelen toevoegen. Een klik op een titel opent de instructie. Hiervoor is geen AI nodig.",
    "fe001.hilfe.detailTitel": "Werkinstructie bewerken",
    "fe001.hilfe.detail":
      "Onder „Waar gaat het om?” beschrijf je doel, toepassingsgebied en voorwaarden. Onder „Onderdeel uit bestaande kennis toevoegen” zoek je een item op titel, bekijk je het voorbeeld en kies je een vaste versie. De leesversie toont het ontstaande document; met „Omhoog” en „Omlaag” wijzig je de volgorde. „Ter beslissing voorleggen” dient de hele instructie in – personen met beoordelingsrecht beslissen. „Wat is er veranderd?” vergelijkt twee opgeslagen standen. Een automatische inhoudelijke controle is nog niet aangesloten. Hiervoor is geen AI nodig.",
  },
} satisfies Textmodul;
