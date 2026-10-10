// ================================================================================================
// KLARA 05 (Auftrag produkt:20261008:klara-aktionen) — Aufträge ausführen, stoppen, rückgängig machen.
// ================================================================================================
//
// Die Texte der Ausführungsaufträge: die Grenze (Ziel, erlaubte Aktionen und Quellen, verantwortliche
// Person, Ergebnisanforderung, Fassung), die Stände von Auftrag und Schritt, Rückfrage, Abbrechen,
// Korrigieren und Rückgängig, die tatsächlichen Fehlergründe und die Bedienhilfe dieser Fähigkeit.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klaraauftrag.",
  legacySchluessel: [],
  de: {
    "klaraauftrag.titel": "Auftrag an Klara · {{quelle}}",
    "klaraauftrag.wortlaut": "Dein Auftrag: „{{text}}“",
    "klaraauftrag.ohneKi":
      "Ausgeführt von Klarwerk selbst über die vorhandenen Aktionen – ohne KI, mit deinen Rechten.",
    "klaraauftrag.quelleArt.getippt": "getippt",
    "klaraauftrag.quelleArt.gesprochen": "gesprochen",
    "klaraauftrag.feld.ziel": "Ziel",
    "klaraauftrag.feld.aktionen": "Erlaubte Aktionen",
    "klaraauftrag.feld.ziele": "Erlaubte Ziele",
    "klaraauftrag.feld.quellen": "Erlaubte Quellen",
    "klaraauftrag.feld.verantwortlich": "Verantwortlich",
    "klaraauftrag.feld.ergebnis": "Ergebnis",
    "klaraauftrag.feld.fassung": "Grenze",
    "klaraauftrag.feld.stand": "Stand",
    "klaraauftrag.aktion.oeffnen": "Öffnen",
    "klaraauftrag.aktion.entwurf_erstellen": "Entwurf anlegen",
    "klaraauftrag.aktion.entwurf_bearbeiten": "Entwurf bearbeiten",
    "klaraauftrag.aktion.aufgabe_bearbeiten": "Aufgabe bearbeiten",
    "klaraauftrag.zielArt.wissensobjekt": "Artikel",
    "klaraauftrag.zielArt.entwurf": "Entwurf",
    "klaraauftrag.zielArt.aufgabe": "Aufgabe",
    "klaraauftrag.zielArt.neuer_entwurf": "neuer Entwurf",
    "klaraauftrag.zielEintrag": "{{art}} „{{titel}}“",
    "klaraauftrag.zielText.oeffnen": "„{{titel}}“ öffnen",
    "klaraauftrag.zielText.entwurf_erstellen": "Entwurf „{{titel}}“ anlegen",
    "klaraauftrag.zielText.entwurf_bearbeiten": "Entwurf „{{titel}}“ bearbeiten",
    "klaraauftrag.zielText.aufgabe_bearbeiten": "Aufgabe „{{titel}}“ bearbeiten",
    "klaraauftrag.zielText.ergaenzen": "Entwurf „{{titel}}“ ergänzen um „{{text}}“",
    "klaraauftrag.zielText.umbenennen": "Entwurf „{{titel}}“ umbenennen in „{{neu}}“",
    "klaraauftrag.quelle.eingabe": "Deine Eingabe ({{quelle}})",
    "klaraauftrag.quelle.ziel": "„{{titel}}“",
    "klaraauftrag.ergebnisAnforderung.oeffnen": "Ziel geöffnet und auf dem Bildschirm bestätigt",
    "klaraauftrag.ergebnisAnforderung.entwurf_erstellen":
      "Entwurf gespeichert und am Server nachgelesen",
    "klaraauftrag.ergebnisAnforderung.entwurf_bearbeiten":
      "Änderung gespeichert und am Server nachgelesen",
    "klaraauftrag.ergebnisAnforderung.aufgabe_bearbeiten":
      "Nur öffnen: Aufgabe an ihrem Arbeitsort geöffnet – Klara hat daran nichts entschieden",
    "klaraauftrag.ergebnisAnforderung.aufgabenaktion":
      "Aktion an der Aufgabe über ihren vorhandenen Weg ausgeführt und am Server nachgelesen",
    "klaraauftrag.zielText.aufgabe.prioritaet":
      "Priorität der Aufgabe „{{titel}}“ auf {{wert}} setzen",
    "klaraauftrag.zielText.aufgabe.zuweisen": "Aufgabe „{{titel}}“ {{person}} zuweisen",
    "klaraauftrag.zielText.aufgabe.eskalieren": "Aufgabe „{{titel}}“ eskalieren",
    "klaraauftrag.prioritaet.hoch": "hoch",
    "klaraauftrag.prioritaet.mittel": "mittel",
    "klaraauftrag.prioritaet.niedrig": "niedrig",
    "klaraauftrag.aufgabenaktion.prioritaet": "Priorität {{wert}} setzen",
    "klaraauftrag.aufgabenaktion.zuweisen": "{{person}} zuweisen",
    "klaraauftrag.aufgabenaktion.eskalieren": "Eskalieren",
    "klaraauftrag.aufgabenaktion.nur_oeffnen": "Nur öffnen – du bearbeitest sie selbst",
    "klaraauftrag.aufgabenaktion.passtNicht":
      "Diese Aktion gibt es an der Aufgabe „{{titel}}“ nicht. Klara hat nichts ausgeführt.",
    "klaraauftrag.rueckfrageAktion":
      "Was soll Klara an der Aufgabe „{{titel}}“ tun? Noch nichts ausgeführt.",
    "klaraauftrag.rueckfragePerson":
      "Wem soll die Aufgabe „{{titel}}“ zugewiesen werden? Noch nichts ausgeführt.",
    "klaraauftrag.unbekanntePerson":
      "Keine Person „{{name}}“ im Verzeichnis gefunden. Klara hat nichts ausgeführt.",
    "klaraauftrag.schrittStand.ausgefuehrt": "Ausgeführt und nachgelesen: {{stand}}",
    "klaraauftrag.nachgelesen.prioritaet": "Priorität {{wert}}",
    "klaraauftrag.nachgelesen.zugewiesen": "zugewiesen an {{person}}",
    "klaraauftrag.nachgelesen.eskaliert": "eskaliert",
    "klaraauftrag.nichtRuecknehmbar.aufgabe":
      "Diese Aktion an der Aufgabe nimmt Klara nicht zurück – ändere sie bei Bedarf an der Aufgabe selbst.",
    "klaraauftrag.wirkungBekannt": "Gespeichertes Ergebnis öffnen",
    "klaraauftrag.fassungWert": "Fassung {{fassung}}",
    "klaraauftrag.fassungAenderung":
      "Fassung {{von}} → {{nach}}: {{grund}} (vorher: {{aktionen}}, {{schritte}} Schritte)",
    "klaraauftrag.stand.vorgeschlagen": "Vorgeschlagen – noch nichts ausgeführt",
    "klaraauftrag.stand.laeuft": "Läuft",
    "klaraauftrag.stand.abgeschlossen": "Abgeschlossen",
    "klaraauftrag.stand.teilweise": "Teilweise ausgeführt – nicht alles hat geklappt",
    "klaraauftrag.stand.fehlgeschlagen": "Fehlgeschlagen – nichts davon ist gespeichert",
    "klaraauftrag.stand.abgebrochen": "Abgebrochen – keine weiteren Schritte",
    "klaraauftrag.stand.unklar":
      "Stand unklar – die Verbindung brach ab; „Erneut versuchen“ liest den Stand am Server",
    "klaraauftrag.phase.pruefen": "Klara klärt das Ziel …",
    "klaraauftrag.unterbrochen":
      "Dieser Auftrag lief noch, als die Seite neu geladen wurde. Klara führt ihn nicht von selbst weiter – der Stand unten ist der des Servers.",
    "klaraauftrag.rueckfrage": "Rückfrage – noch nichts ausgeführt. Welches Ziel meinst du?",
    "klaraauftrag.rueckfrageZu": "Welches „{{name}}“ meinst du?",
    "klaraauftrag.unbekannt":
      "Kein passendes Ziel gefunden für {{namen}}. Klara hat nichts ausgeführt.",
    "klaraauftrag.schritt": "{{nr}}. {{aktion}}: „{{titel}}“",
    "klaraauftrag.schrittStand.geplant": "Geplant",
    "klaraauftrag.schrittStand.laeuft": "Wird begonnen …",
    "klaraauftrag.schrittStand.begonnen": "Begonnen",
    "klaraauftrag.schrittStand.gespeichert": "Gespeichert",
    "klaraauftrag.schrittStand.abgeschlossen": "Abgeschlossen",
    "klaraauftrag.schrittStand.fehlgeschlagen": "Fehlgeschlagen",
    "klaraauftrag.schrittStand.zurueckgenommen": "Zurückgenommen",
    "klaraauftrag.schrittStand.unklar": "Ergebnis unklar",
    "klaraauftrag.schrittStand.entfallen": "Entfallen",
    "klaraauftrag.schrittStand.nicht_ausgefuehrt": "Nicht ausgeführt",
    "klaraauftrag.schrittStand.geoeffnet.oeffnen": "Geöffnet",
    "klaraauftrag.schrittStand.geoeffnet.aufgabe_bearbeiten":
      "Geöffnet – Klara hat an der Aufgabe nichts entschieden; bearbeitet wird sie von dir",
    "klaraauftrag.zumZiel": "Ziel öffnen",
    "klaraauftrag.zumErgebnis": "Ergebnis „{{titel}}“ öffnen",
    "klaraauftrag.endgueltig":
      "Öffnen ändert nichts und lässt sich nicht zurücknehmen – es gibt nichts rückgängig zu machen.",
    "klaraauftrag.zurueckgenommen.angelegt":
      "Der Entwurf liegt jetzt im Papierkorb der Entwürfe und lässt sich dort wiederherstellen.",
    "klaraauftrag.zurueckgenommen.bearbeitet":
      "Der Entwurf trägt wieder den Stand von vor der Änderung.",
    "klaraauftrag.entfallen":
      "Entfallen – dieser Schritt liegt nicht mehr in der Grenze des Auftrags.",
    "klaraauftrag.knopf.abbrechen": "Abbrechen",
    "klaraauftrag.knopf.rueckgaengig": "Rückgängig",
    "klaraauftrag.knopf.erneut": "Erneut versuchen",
    "klaraauftrag.knopf.korrigieren": "Grenze korrigieren",
    "klaraauftrag.knopf.korrekturSpeichern": "Neue Fassung festhalten",
    "klaraauftrag.knopf.korrekturVerwerfen": "Nicht korrigieren",
    "klaraauftrag.knopf.schliessen": "Schliessen",
    "klaraauftrag.hinweis":
      "Abbrechen hält alle weiteren Schritte an; schon Gespeichertes bleibt gespeichert und sichtbar. Rückgängig nimmt eine gespeicherte Änderung gezielt zurück.",
    "klaraauftrag.verlauf.titel": "Verlauf",
    "klaraauftrag.verlauf.eintrag": "{{zeit}} · {{ereignis}} (Fassung {{fassung}})",
    "klaraauftrag.ereignis.vorgeschlagen": "Vorgeschlagen",
    "klaraauftrag.ereignis.begonnen": "Schritt {{nr}} begonnen",
    "klaraauftrag.ereignis.gespeichert": "Schritt {{nr}} gespeichert",
    "klaraauftrag.ereignis.abgeschlossen": "Schritt {{nr}} abgeschlossen",
    "klaraauftrag.ereignis.fehlgeschlagen": "Schritt {{nr}} fehlgeschlagen",
    "klaraauftrag.ereignis.zurueckgenommen": "Schritt {{nr}} zurückgenommen",
    "klaraauftrag.ereignis.abgebrochen": "Abgebrochen",
    "klaraauftrag.ereignis.korrigiert": "Grenze korrigiert",
    "klaraauftrag.ereignis.auftrag_abgeschlossen": "Auftrag abgeschlossen",
    "klaraauftrag.korrektur.titel": "Grenze korrigieren",
    "klaraauftrag.korrektur.erklaerung":
      "Du kannst offene Schritte weglassen. Mehr Aktionen oder Ziele erweitern die Befugnis – das ist ein eigener Auftrag.",
    "klaraauftrag.korrektur.geschehen":
      "Bereits geschehen und bleibt bestehen: {{anzahl}} Schritt(e).",
    "klaraauftrag.korrektur.grund": "{{weg}} offene(r) Schritt(e) weggelassen",
    "klaraauftrag.grenze.abgebrochen":
      "Der Auftrag wurde abgebrochen – dieser Schritt beginnt nicht.",
    "klaraauftrag.grenze.abgeschlossen": "Der Auftrag ist bereits beendet.",
    "klaraauftrag.grenze.ausserhalb_auftrag":
      "Dieser Schritt liegt ausserhalb der Grenze des Auftrags und wird nicht ausgeführt.",
    "klaraauftrag.grenze.fassung_veraltet":
      "Die Grenze wurde inzwischen korrigiert – Klara beginnt nichts unter der alten Fassung.",
    "klaraauftrag.grenze.erweiterung":
      "Eine Korrektur darf die Befugnis nicht erweitern. Gib dafür einen neuen Auftrag – die bisherige Grenze gilt weiter.",
    "klaraauftrag.fehler.anmeldung": "Deine Anmeldung ist abgelaufen. Klara hat nichts geändert.",
    "klaraauftrag.fehler.recht": "Dir fehlt das Recht dafür. Klara hat nichts geändert.",
    "klaraauftrag.fehler.nichtGefunden":
      "Das Ziel ist nicht (mehr) vorhanden oder für dich nicht sichtbar. Klara hat nichts geändert.",
    "klaraauftrag.fehler.versionGeaendert":
      "Das Ziel wurde seit dem Auftrag geändert. Klara schreibt nicht über einen neueren Stand hinweg und hat nichts geändert.",
    "klaraauftrag.fehler.server": "Der Server hat abgelehnt ({{status}}): {{grund}}",
    "klaraauftrag.fehler.netz": "Keine Verbindung zum Server.",
    "klaraauftrag.fehler.unklar":
      "Die Verbindung brach ab – ob der Schritt gewirkt hat, ist unklar. „Erneut versuchen“ wiederholt ihn ohne Doppelung.",
    "klaraauftrag.fehler.protokoll":
      "Das Ergebnis konnte nicht am Auftrag festgehalten werden – Stand unklar. „Erneut versuchen“ liest nach und meldet es.",
    "klaraauftrag.fehler.unbestaetigt":
      "Gespeichert, aber noch nicht nachgelesen – das Ergebnis ist ungeklärt. „Erneut versuchen“ liest nur nach und schreibt nichts erneut.",
    "klaraauftrag.fehler.klaeren":
      "Klara konnte das Ziel nicht klären: {{grund}} Nichts ausgeführt.",
    "klaraauftrag.fehler.anlegen":
      "Der Auftrag konnte nicht festgehalten werden: {{grund}} Nichts ausgeführt.",
    "klaraauftrag.fehler.nichtNachgelesen":
      "Beim Nachlesen am Server stand die Änderung nicht da – Klara meldet keinen Erfolg.",
    "klaraauftrag.fehler.nichtGeoeffnet": "„{{titel}}“ ist nicht geöffnet worden.",
    "klaraauftrag.fehler.keinZiel": "Kein Ziel für diesen Schritt.",
    "klaraauftrag.fehler.vorschritt":
      "Der vorige Schritt hat kein Ergebnis gespeichert – es gibt nichts zu öffnen.",
    "klaraauftrag.fehler.abbrechen": "Abbrechen am Server nicht bestätigt: {{grund}}",
    "klaraauftrag.fehlerCode.anmeldung":
      "Deine Anmeldung ist abgelaufen. Klara hat nichts geändert.",
    "klaraauftrag.fehlerCode.recht": "Dir fehlt das Recht dafür. Klara hat nichts geändert.",
    "klaraauftrag.fehlerCode.nichtGefunden":
      "Das Ziel ist nicht (mehr) vorhanden oder für dich nicht sichtbar. Klara hat nichts geändert.",
    "klaraauftrag.fehlerCode.versionGeaendert":
      "Das Ziel wurde seit dem Auftrag geändert. Klara schreibt nicht über einen neueren Stand hinweg und hat nichts geändert.",
    "klaraauftrag.fehlerCode.nichtNachgelesen":
      "Beim Nachlesen am Server stand die Änderung nicht da – Klara meldet keinen Erfolg.",
    "klaraauftrag.fehlerCode.nichtVerfuegbar":
      "Die Aufgabe ist für dich nicht (mehr) verfügbar. Klara hat nichts geöffnet.",
    "klaraauftrag.fehlerCode.vorschritt":
      "Der vorige Schritt hat kein Ergebnis gespeichert – es gibt nichts zu öffnen.",
    "klaraauftrag.fehlerCode.server": "Der Server hat den Schritt abgelehnt. Nichts geändert.",
    "klaraauftrag.fehlerCode.fremdstand":
      "Gespeichert – der Entwurf wurde danach weiter geändert oder der eigene Stand ist nicht bestätigt. Klara nimmt nichts über eine spätere Änderung hinweg zurück.",
    "klaraauftrag.ruecknahme.nichtNachgelesen":
      "Beim Nachlesen war die Rücknahme nicht zu sehen – Klara meldet sie nicht als erledigt.",
    "klaraauftrag.ruecknahme.ohneVorher":
      "Den Stand vor der Änderung kennt nur die Sitzung, in der sie geschah. Bitte im Entwurf selbst zurückändern.",
    "klaraauftrag.ruecknahme.geaendert":
      "Der Entwurf wurde seitdem weiter geändert. Klara nimmt nichts über eine spätere Änderung hinweg zurück.",
    "klaraauftrag.ruecknahme.fehler": "Rückgängig ging nicht: {{grund}}",
    "klaraauftrag.belegt":
      "Ein Auftrag läuft noch. Klara nimmt erst danach einen neuen an – nichts wurde gesendet.",
    "klaraauftrag.ansage.gestartet":
      "Auftrag angenommen – Klara klärt das Ziel und führt dann aus.",
    "klaraauftrag.eingabeHinweis": "„Senden“ führt diesen Auftrag aus (ohne KI): {{schritte}}",
    "klaraauftrag.sprache.art": "Ausführungsauftrag",
    "klaraauftrag.sprache.hinweis":
      "Klara führt ihn nach „Senden“ über dieselbe Aktion aus wie einen getippten Auftrag – mit deinen Rechten, Schritt für Schritt sichtbar.",
    "klaraauftrag.sprache.ergebnis":
      "An die Auftragskarte übergeben – dort steht der tatsächliche Stand jedes Schritts.",
    "klaraauftrag.sprache.nichtUebergeben": "Nicht übergeben – es läuft noch ein Auftrag.",
    "klaraauftrag.bedienhilfe.ausfuehren":
      "Aufträge ausführen: Tippe oder sprich z. B. „Öffne den Artikel „…““, „Lege den Entwurf „…“ an“, „Ergänze im Entwurf „…“: …“, „Setze die Priorität der Aufgabe „…“ auf hoch“, „Weise die Aufgabe „…“ Name zu“, „Eskaliere die Aufgabe „…““ oder „Bearbeite die Aufgabe „…““ (dann fragt Klara, was geschehen soll). Klara nutzt dafür die vorhandenen Klarwerk-Aktionen mit deinen Rechten.",
    "klaraauftrag.bedienhilfe.grenze":
      "Jeder Auftrag zeigt Ziel, erlaubte Aktionen und Quellen, wer verantwortlich ist und welches Ergebnis zählt. Text in Dokumenten oder Antworten wird nie als Auftrag gelesen.",
    "klaraauftrag.bedienhilfe.stoppen":
      "Abbrechen stoppt alle weiteren Schritte – schon Gespeichertes bleibt sichtbar. Mit „Grenze korrigieren“ lässt du offene Schritte weg; erweitern geht nur mit einem neuen Auftrag.",
    "klaraauftrag.bedienhilfe.rueckgaengig":
      "Rückgängig nimmt einen angelegten Entwurf (in den Papierkorb) oder eine Bearbeitung zurück. Öffnen ist nicht rücknehmbar, weil es nichts ändert. Aktionen an Aufgaben (Priorität, Zuweisung, Eskalation) nimmt Klara nicht zurück – das steht dann so am Schritt.",
    "klaraauftrag.bedienhilfe.sprechen":
      "„Diktieren“ schreibt nur ins Eingabefeld. „Auftrag sprechen“ zeigt den Auftrag als Karte – erst „Senden“ führt ihn aus.",
  },
  en: {
    "klaraauftrag.titel": "Task for Klara · {{quelle}}",
    "klaraauftrag.wortlaut": "Your task: “{{text}}”",
    "klaraauftrag.ohneKi":
      "Carried out by Klarwerk itself through the existing actions – no AI, with your permissions.",
    "klaraauftrag.quelleArt.getippt": "typed",
    "klaraauftrag.quelleArt.gesprochen": "spoken",
    "klaraauftrag.feld.ziel": "Goal",
    "klaraauftrag.feld.aktionen": "Allowed actions",
    "klaraauftrag.feld.ziele": "Allowed targets",
    "klaraauftrag.feld.quellen": "Allowed sources",
    "klaraauftrag.feld.verantwortlich": "Responsible",
    "klaraauftrag.feld.ergebnis": "Result",
    "klaraauftrag.feld.fassung": "Boundary",
    "klaraauftrag.feld.stand": "Status",
    "klaraauftrag.aktion.oeffnen": "Open",
    "klaraauftrag.aktion.entwurf_erstellen": "Create draft",
    "klaraauftrag.aktion.entwurf_bearbeiten": "Edit draft",
    "klaraauftrag.aktion.aufgabe_bearbeiten": "Work on task",
    "klaraauftrag.zielArt.wissensobjekt": "Article",
    "klaraauftrag.zielArt.entwurf": "Draft",
    "klaraauftrag.zielArt.aufgabe": "Task",
    "klaraauftrag.zielArt.neuer_entwurf": "new draft",
    "klaraauftrag.zielEintrag": "{{art}} “{{titel}}”",
    "klaraauftrag.zielText.oeffnen": "Open “{{titel}}”",
    "klaraauftrag.zielText.entwurf_erstellen": "Create draft “{{titel}}”",
    "klaraauftrag.zielText.entwurf_bearbeiten": "Edit draft “{{titel}}”",
    "klaraauftrag.zielText.aufgabe_bearbeiten": "Work on task “{{titel}}”",
    "klaraauftrag.zielText.ergaenzen": "Add “{{text}}” to draft “{{titel}}”",
    "klaraauftrag.zielText.umbenennen": "Rename draft “{{titel}}” to “{{neu}}”",
    "klaraauftrag.quelle.eingabe": "Your input ({{quelle}})",
    "klaraauftrag.quelle.ziel": "“{{titel}}”",
    "klaraauftrag.ergebnisAnforderung.oeffnen": "Target opened and confirmed on screen",
    "klaraauftrag.ergebnisAnforderung.entwurf_erstellen":
      "Draft saved and read back from the server",
    "klaraauftrag.ergebnisAnforderung.entwurf_bearbeiten":
      "Change saved and read back from the server",
    "klaraauftrag.ergebnisAnforderung.aufgabe_bearbeiten":
      "Open only: task opened at its place of work – Klara decided nothing on it",
    "klaraauftrag.ergebnisAnforderung.aufgabenaktion":
      "Action on the task carried out through its existing route and read back from the server",
    "klaraauftrag.zielText.aufgabe.prioritaet": "Set the priority of task “{{titel}}” to {{wert}}",
    "klaraauftrag.zielText.aufgabe.zuweisen": "Assign task “{{titel}}” to {{person}}",
    "klaraauftrag.zielText.aufgabe.eskalieren": "Escalate task “{{titel}}”",
    "klaraauftrag.prioritaet.hoch": "high",
    "klaraauftrag.prioritaet.mittel": "medium",
    "klaraauftrag.prioritaet.niedrig": "low",
    "klaraauftrag.aufgabenaktion.prioritaet": "Set priority {{wert}}",
    "klaraauftrag.aufgabenaktion.zuweisen": "Assign to {{person}}",
    "klaraauftrag.aufgabenaktion.eskalieren": "Escalate",
    "klaraauftrag.aufgabenaktion.nur_oeffnen": "Open only – you work on it yourself",
    "klaraauftrag.aufgabenaktion.passtNicht":
      "This action does not exist for the task “{{titel}}”. Klara carried out nothing.",
    "klaraauftrag.rueckfrageAktion":
      "What should Klara do with the task “{{titel}}”? Nothing carried out yet.",
    "klaraauftrag.rueckfragePerson":
      "Who should the task “{{titel}}” be assigned to? Nothing carried out yet.",
    "klaraauftrag.unbekanntePerson":
      "No person “{{name}}” found in the directory. Klara carried out nothing.",
    "klaraauftrag.schrittStand.ausgefuehrt": "Carried out and read back: {{stand}}",
    "klaraauftrag.nachgelesen.prioritaet": "priority {{wert}}",
    "klaraauftrag.nachgelesen.zugewiesen": "assigned to {{person}}",
    "klaraauftrag.nachgelesen.eskaliert": "escalated",
    "klaraauftrag.nichtRuecknehmbar.aufgabe":
      "Klara does not undo this action on the task – change it on the task itself if needed.",
    "klaraauftrag.wirkungBekannt": "Open saved result",
    "klaraauftrag.fassungWert": "Version {{fassung}}",
    "klaraauftrag.fassungAenderung":
      "Version {{von}} → {{nach}}: {{grund}} (before: {{aktionen}}, {{schritte}} steps)",
    "klaraauftrag.stand.vorgeschlagen": "Proposed – nothing carried out yet",
    "klaraauftrag.stand.laeuft": "Running",
    "klaraauftrag.stand.abgeschlossen": "Completed",
    "klaraauftrag.stand.teilweise": "Partly carried out – not everything worked",
    "klaraauftrag.stand.fehlgeschlagen": "Failed – none of it is saved",
    "klaraauftrag.stand.abgebrochen": "Cancelled – no further steps",
    "klaraauftrag.stand.unklar":
      "Status unclear – the connection dropped; “Try again” reads the status on the server",
    "klaraauftrag.phase.pruefen": "Klara is clarifying the target …",
    "klaraauftrag.unterbrochen":
      "This task was still running when the page was reloaded. Klara does not continue it on its own – the status below is the server's.",
    "klaraauftrag.rueckfrage": "Question – nothing carried out yet. Which target do you mean?",
    "klaraauftrag.rueckfrageZu": "Which “{{name}}” do you mean?",
    "klaraauftrag.unbekannt": "No matching target found for {{namen}}. Klara carried out nothing.",
    "klaraauftrag.schritt": "{{nr}}. {{aktion}}: “{{titel}}”",
    "klaraauftrag.schrittStand.geplant": "Planned",
    "klaraauftrag.schrittStand.laeuft": "Starting …",
    "klaraauftrag.schrittStand.begonnen": "Started",
    "klaraauftrag.schrittStand.gespeichert": "Saved",
    "klaraauftrag.schrittStand.abgeschlossen": "Completed",
    "klaraauftrag.schrittStand.fehlgeschlagen": "Failed",
    "klaraauftrag.schrittStand.zurueckgenommen": "Undone",
    "klaraauftrag.schrittStand.unklar": "Result unclear",
    "klaraauftrag.schrittStand.entfallen": "Dropped",
    "klaraauftrag.schrittStand.nicht_ausgefuehrt": "Not carried out",
    "klaraauftrag.schrittStand.geoeffnet.oeffnen": "Opened",
    "klaraauftrag.schrittStand.geoeffnet.aufgabe_bearbeiten":
      "Opened – Klara decided nothing on the task; you work on it",
    "klaraauftrag.zumZiel": "Open target",
    "klaraauftrag.zumErgebnis": "Open result “{{titel}}”",
    "klaraauftrag.endgueltig":
      "Opening changes nothing and cannot be undone – there is nothing to reverse.",
    "klaraauftrag.zurueckgenommen.angelegt":
      "The draft is now in the drafts trash and can be restored there.",
    "klaraauftrag.zurueckgenommen.bearbeitet": "The draft is back to the state before the change.",
    "klaraauftrag.entfallen": "Dropped – this step is no longer within the task's boundary.",
    "klaraauftrag.knopf.abbrechen": "Cancel",
    "klaraauftrag.knopf.rueckgaengig": "Undo",
    "klaraauftrag.knopf.erneut": "Try again",
    "klaraauftrag.knopf.korrigieren": "Correct boundary",
    "klaraauftrag.knopf.korrekturSpeichern": "Record new version",
    "klaraauftrag.knopf.korrekturVerwerfen": "Do not correct",
    "klaraauftrag.knopf.schliessen": "Close",
    "klaraauftrag.hinweis":
      "Cancel stops all further steps; whatever is already saved stays saved and visible. Undo reverses one saved change on purpose.",
    "klaraauftrag.verlauf.titel": "History",
    "klaraauftrag.verlauf.eintrag": "{{zeit}} · {{ereignis}} (version {{fassung}})",
    "klaraauftrag.ereignis.vorgeschlagen": "Proposed",
    "klaraauftrag.ereignis.begonnen": "Step {{nr}} started",
    "klaraauftrag.ereignis.gespeichert": "Step {{nr}} saved",
    "klaraauftrag.ereignis.abgeschlossen": "Step {{nr}} completed",
    "klaraauftrag.ereignis.fehlgeschlagen": "Step {{nr}} failed",
    "klaraauftrag.ereignis.zurueckgenommen": "Step {{nr}} undone",
    "klaraauftrag.ereignis.abgebrochen": "Cancelled",
    "klaraauftrag.ereignis.korrigiert": "Boundary corrected",
    "klaraauftrag.ereignis.auftrag_abgeschlossen": "Task completed",
    "klaraauftrag.korrektur.titel": "Correct boundary",
    "klaraauftrag.korrektur.erklaerung":
      "You can leave out open steps. More actions or targets would extend the authority – that is a separate task.",
    "klaraauftrag.korrektur.geschehen": "Already done and kept: {{anzahl}} step(s).",
    "klaraauftrag.korrektur.grund": "{{weg}} open step(s) left out",
    "klaraauftrag.grenze.abgebrochen": "The task was cancelled – this step does not start.",
    "klaraauftrag.grenze.abgeschlossen": "The task has already ended.",
    "klaraauftrag.grenze.ausserhalb_auftrag":
      "This step lies outside the task's boundary and is not carried out.",
    "klaraauftrag.grenze.fassung_veraltet":
      "The boundary has been corrected in the meantime – Klara starts nothing under the old version.",
    "klaraauftrag.grenze.erweiterung":
      "A correction may not extend the authority. Give a new task for that – the previous boundary still applies.",
    "klaraauftrag.fehler.anmeldung": "Your sign-in has expired. Klara changed nothing.",
    "klaraauftrag.fehler.recht": "You do not have the permission for this. Klara changed nothing.",
    "klaraauftrag.fehler.nichtGefunden":
      "The target no longer exists or is not visible to you. Klara changed nothing.",
    "klaraauftrag.fehler.versionGeaendert":
      "The target has changed since the task was given. Klara does not write over a newer state and changed nothing.",
    "klaraauftrag.fehler.server": "The server refused ({{status}}): {{grund}}",
    "klaraauftrag.fehler.netz": "No connection to the server.",
    "klaraauftrag.fehler.unklar":
      "The connection dropped – whether the step took effect is unclear. “Try again” repeats it without duplicates.",
    "klaraauftrag.fehler.protokoll":
      "The result could not be recorded on the task – status unclear. “Try again” reads back and reports it.",
    "klaraauftrag.fehler.unbestaetigt":
      "Saved, but not yet read back – the result is unconfirmed. “Try again” only reads back and writes nothing again.",
    "klaraauftrag.fehler.klaeren":
      "Klara could not clarify the target: {{grund}} Nothing carried out.",
    "klaraauftrag.fehler.anlegen": "The task could not be recorded: {{grund}} Nothing carried out.",
    "klaraauftrag.fehler.nichtNachgelesen":
      "Reading back from the server did not show the change – Klara reports no success.",
    "klaraauftrag.fehler.nichtGeoeffnet": "“{{titel}}” was not opened.",
    "klaraauftrag.fehler.keinZiel": "No target for this step.",
    "klaraauftrag.fehler.vorschritt":
      "The previous step saved no result – there is nothing to open.",
    "klaraauftrag.fehler.abbrechen": "Cancellation not confirmed by the server: {{grund}}",
    "klaraauftrag.fehlerCode.anmeldung": "Your sign-in has expired. Klara changed nothing.",
    "klaraauftrag.fehlerCode.recht":
      "You do not have the permission for this. Klara changed nothing.",
    "klaraauftrag.fehlerCode.nichtGefunden":
      "The target no longer exists or is not visible to you. Klara changed nothing.",
    "klaraauftrag.fehlerCode.versionGeaendert":
      "The target has changed since the task was given. Klara does not write over a newer state and changed nothing.",
    "klaraauftrag.fehlerCode.nichtNachgelesen":
      "Reading back from the server did not show the change – Klara reports no success.",
    "klaraauftrag.fehlerCode.nichtVerfuegbar":
      "The task is no longer available to you. Klara opened nothing.",
    "klaraauftrag.fehlerCode.vorschritt":
      "The previous step saved no result – there is nothing to open.",
    "klaraauftrag.fehlerCode.server": "The server refused the step. Nothing changed.",
    "klaraauftrag.fehlerCode.fremdstand":
      "Saved – the draft was changed further afterwards or its own state is not confirmed. Klara undoes nothing over a later change.",
    "klaraauftrag.ruecknahme.nichtNachgelesen":
      "Reading back did not show the undo – Klara does not report it as done.",
    "klaraauftrag.ruecknahme.ohneVorher":
      "Only the session in which the change happened knows the previous state. Please change it back in the draft itself.",
    "klaraauftrag.ruecknahme.geaendert":
      "The draft has been changed further since then. Klara undoes nothing over a later change.",
    "klaraauftrag.ruecknahme.fehler": "Undo failed: {{grund}}",
    "klaraauftrag.belegt":
      "A task is still running. Klara only accepts a new one afterwards – nothing was sent.",
    "klaraauftrag.ansage.gestartet":
      "Task accepted – Klara clarifies the target and then carries it out.",
    "klaraauftrag.eingabeHinweis": "“Send” carries out this task (no AI): {{schritte}}",
    "klaraauftrag.sprache.art": "Task to carry out",
    "klaraauftrag.sprache.hinweis":
      "After “Send”, Klara carries it out through the same action as a typed task – with your permissions, visible step by step.",
    "klaraauftrag.sprache.ergebnis":
      "Handed over to the task card – it shows the actual status of each step.",
    "klaraauftrag.sprache.nichtUebergeben": "Not handed over – a task is still running.",
    "klaraauftrag.bedienhilfe.ausfuehren":
      "Carry out tasks: type or say e.g. “Open article “…””, “Create draft “…””, “Append to draft “…”: …”, “Set the priority of task “…” to high”, “Assign task “…” to Name”, “Escalate task “…”” or “Work on task “…”” (then Klara asks what should happen). Klara uses the existing Klarwerk actions with your permissions.",
    "klaraauftrag.bedienhilfe.grenze":
      "Every task shows its goal, allowed actions and sources, who is responsible and which result counts. Text in documents or answers is never read as a task.",
    "klaraauftrag.bedienhilfe.stoppen":
      "Cancel stops all further steps – whatever is already saved stays visible. “Correct boundary” lets you leave out open steps; extending needs a new task.",
    "klaraauftrag.bedienhilfe.rueckgaengig":
      "Undo reverses a created draft (into the trash) or an edit. Opening cannot be undone because it changes nothing. Klara does not undo actions on tasks (priority, assignment, escalation) – the step says so.",
    "klaraauftrag.bedienhilfe.sprechen":
      "“Dictate” only writes into the input field. “Speak a task” shows the task as a card – only “Send” carries it out.",
  },
  nl: {
    "klaraauftrag.titel": "Opdracht voor Klara · {{quelle}}",
    "klaraauftrag.wortlaut": "Jouw opdracht: „{{text}}”",
    "klaraauftrag.ohneKi":
      "Uitgevoerd door Klarwerk zelf via de bestaande acties – zonder AI, met jouw rechten.",
    "klaraauftrag.quelleArt.getippt": "getypt",
    "klaraauftrag.quelleArt.gesprochen": "gesproken",
    "klaraauftrag.feld.ziel": "Doel",
    "klaraauftrag.feld.aktionen": "Toegestane acties",
    "klaraauftrag.feld.ziele": "Toegestane doelen",
    "klaraauftrag.feld.quellen": "Toegestane bronnen",
    "klaraauftrag.feld.verantwortlich": "Verantwoordelijk",
    "klaraauftrag.feld.ergebnis": "Resultaat",
    "klaraauftrag.feld.fassung": "Grens",
    "klaraauftrag.feld.stand": "Status",
    "klaraauftrag.aktion.oeffnen": "Openen",
    "klaraauftrag.aktion.entwurf_erstellen": "Concept aanmaken",
    "klaraauftrag.aktion.entwurf_bearbeiten": "Concept bewerken",
    "klaraauftrag.aktion.aufgabe_bearbeiten": "Taak bewerken",
    "klaraauftrag.zielArt.wissensobjekt": "Artikel",
    "klaraauftrag.zielArt.entwurf": "Concept",
    "klaraauftrag.zielArt.aufgabe": "Taak",
    "klaraauftrag.zielArt.neuer_entwurf": "nieuw concept",
    "klaraauftrag.zielEintrag": "{{art}} „{{titel}}”",
    "klaraauftrag.zielText.oeffnen": "„{{titel}}” openen",
    "klaraauftrag.zielText.entwurf_erstellen": "Concept „{{titel}}” aanmaken",
    "klaraauftrag.zielText.entwurf_bearbeiten": "Concept „{{titel}}” bewerken",
    "klaraauftrag.zielText.aufgabe_bearbeiten": "Taak „{{titel}}” bewerken",
    "klaraauftrag.zielText.ergaenzen": "Concept „{{titel}}” aanvullen met „{{text}}”",
    "klaraauftrag.zielText.umbenennen": "Concept „{{titel}}” hernoemen naar „{{neu}}”",
    "klaraauftrag.quelle.eingabe": "Jouw invoer ({{quelle}})",
    "klaraauftrag.quelle.ziel": "„{{titel}}”",
    "klaraauftrag.ergebnisAnforderung.oeffnen": "Doel geopend en op het scherm bevestigd",
    "klaraauftrag.ergebnisAnforderung.entwurf_erstellen":
      "Concept opgeslagen en op de server nagelezen",
    "klaraauftrag.ergebnisAnforderung.entwurf_bearbeiten":
      "Wijziging opgeslagen en op de server nagelezen",
    "klaraauftrag.ergebnisAnforderung.aufgabe_bearbeiten":
      "Alleen openen: taak op haar werkplek geopend – Klara heeft er niets over beslist",
    "klaraauftrag.ergebnisAnforderung.aufgabenaktion":
      "Actie op de taak via haar bestaande weg uitgevoerd en op de server nagelezen",
    "klaraauftrag.zielText.aufgabe.prioritaet":
      "Prioriteit van taak „{{titel}}” op {{wert}} zetten",
    "klaraauftrag.zielText.aufgabe.zuweisen": "Taak „{{titel}}” aan {{person}} toewijzen",
    "klaraauftrag.zielText.aufgabe.eskalieren": "Taak „{{titel}}” escaleren",
    "klaraauftrag.prioritaet.hoch": "hoog",
    "klaraauftrag.prioritaet.mittel": "gemiddeld",
    "klaraauftrag.prioritaet.niedrig": "laag",
    "klaraauftrag.aufgabenaktion.prioritaet": "Prioriteit {{wert}} zetten",
    "klaraauftrag.aufgabenaktion.zuweisen": "Aan {{person}} toewijzen",
    "klaraauftrag.aufgabenaktion.eskalieren": "Escaleren",
    "klaraauftrag.aufgabenaktion.nur_oeffnen": "Alleen openen – je bewerkt haar zelf",
    "klaraauftrag.aufgabenaktion.passtNicht":
      "Deze actie bestaat niet voor de taak „{{titel}}”. Klara heeft niets uitgevoerd.",
    "klaraauftrag.rueckfrageAktion":
      "Wat moet Klara met de taak „{{titel}}” doen? Nog niets uitgevoerd.",
    "klaraauftrag.rueckfragePerson":
      "Aan wie moet de taak „{{titel}}” worden toegewezen? Nog niets uitgevoerd.",
    "klaraauftrag.unbekanntePerson":
      "Geen persoon „{{name}}” in de lijst gevonden. Klara heeft niets uitgevoerd.",
    "klaraauftrag.schrittStand.ausgefuehrt": "Uitgevoerd en nagelezen: {{stand}}",
    "klaraauftrag.nachgelesen.prioritaet": "prioriteit {{wert}}",
    "klaraauftrag.nachgelesen.zugewiesen": "toegewezen aan {{person}}",
    "klaraauftrag.nachgelesen.eskaliert": "geëscaleerd",
    "klaraauftrag.nichtRuecknehmbar.aufgabe":
      "Klara draait deze actie op de taak niet terug – wijzig haar zo nodig op de taak zelf.",
    "klaraauftrag.wirkungBekannt": "Opgeslagen resultaat openen",
    "klaraauftrag.fassungWert": "Versie {{fassung}}",
    "klaraauftrag.fassungAenderung":
      "Versie {{von}} → {{nach}}: {{grund}} (eerder: {{aktionen}}, {{schritte}} stappen)",
    "klaraauftrag.stand.vorgeschlagen": "Voorgesteld – nog niets uitgevoerd",
    "klaraauftrag.stand.laeuft": "Loopt",
    "klaraauftrag.stand.abgeschlossen": "Afgerond",
    "klaraauftrag.stand.teilweise": "Gedeeltelijk uitgevoerd – niet alles is gelukt",
    "klaraauftrag.stand.fehlgeschlagen": "Mislukt – niets daarvan is opgeslagen",
    "klaraauftrag.stand.abgebrochen": "Afgebroken – geen verdere stappen",
    "klaraauftrag.stand.unklar":
      "Status onduidelijk – de verbinding viel weg; „Opnieuw proberen” leest de status op de server",
    "klaraauftrag.phase.pruefen": "Klara verduidelijkt het doel …",
    "klaraauftrag.unterbrochen":
      "Deze opdracht liep nog toen de pagina opnieuw werd geladen. Klara zet hem niet vanzelf voort – de status hieronder is die van de server.",
    "klaraauftrag.rueckfrage": "Wedervraag – nog niets uitgevoerd. Welk doel bedoel je?",
    "klaraauftrag.rueckfrageZu": "Welke „{{name}}” bedoel je?",
    "klaraauftrag.unbekannt":
      "Geen passend doel gevonden voor {{namen}}. Klara heeft niets uitgevoerd.",
    "klaraauftrag.schritt": "{{nr}}. {{aktion}}: „{{titel}}”",
    "klaraauftrag.schrittStand.geplant": "Gepland",
    "klaraauftrag.schrittStand.laeuft": "Wordt gestart …",
    "klaraauftrag.schrittStand.begonnen": "Gestart",
    "klaraauftrag.schrittStand.gespeichert": "Opgeslagen",
    "klaraauftrag.schrittStand.abgeschlossen": "Afgerond",
    "klaraauftrag.schrittStand.fehlgeschlagen": "Mislukt",
    "klaraauftrag.schrittStand.zurueckgenommen": "Teruggedraaid",
    "klaraauftrag.schrittStand.unklar": "Resultaat onduidelijk",
    "klaraauftrag.schrittStand.entfallen": "Vervallen",
    "klaraauftrag.schrittStand.nicht_ausgefuehrt": "Niet uitgevoerd",
    "klaraauftrag.schrittStand.geoeffnet.oeffnen": "Geopend",
    "klaraauftrag.schrittStand.geoeffnet.aufgabe_bearbeiten":
      "Geopend – Klara heeft over de taak niets beslist; het werk doe jij",
    "klaraauftrag.zumZiel": "Doel openen",
    "klaraauftrag.zumErgebnis": "Resultaat „{{titel}}” openen",
    "klaraauftrag.endgueltig":
      "Openen verandert niets en kan niet worden teruggedraaid – er valt niets ongedaan te maken.",
    "klaraauftrag.zurueckgenommen.angelegt":
      "Het concept ligt nu in de prullenbak van de concepten en kan daar worden hersteld.",
    "klaraauftrag.zurueckgenommen.bearbeitet":
      "Het concept heeft weer de stand van vóór de wijziging.",
    "klaraauftrag.entfallen":
      "Vervallen – deze stap valt niet meer binnen de grens van de opdracht.",
    "klaraauftrag.knopf.abbrechen": "Afbreken",
    "klaraauftrag.knopf.rueckgaengig": "Ongedaan maken",
    "klaraauftrag.knopf.erneut": "Opnieuw proberen",
    "klaraauftrag.knopf.korrigieren": "Grens corrigeren",
    "klaraauftrag.knopf.korrekturSpeichern": "Nieuwe versie vastleggen",
    "klaraauftrag.knopf.korrekturVerwerfen": "Niet corrigeren",
    "klaraauftrag.knopf.schliessen": "Sluiten",
    "klaraauftrag.hinweis":
      "Afbreken stopt alle verdere stappen; wat al is opgeslagen blijft opgeslagen en zichtbaar. Ongedaan maken draait één opgeslagen wijziging gericht terug.",
    "klaraauftrag.verlauf.titel": "Verloop",
    "klaraauftrag.verlauf.eintrag": "{{zeit}} · {{ereignis}} (versie {{fassung}})",
    "klaraauftrag.ereignis.vorgeschlagen": "Voorgesteld",
    "klaraauftrag.ereignis.begonnen": "Stap {{nr}} gestart",
    "klaraauftrag.ereignis.gespeichert": "Stap {{nr}} opgeslagen",
    "klaraauftrag.ereignis.abgeschlossen": "Stap {{nr}} afgerond",
    "klaraauftrag.ereignis.fehlgeschlagen": "Stap {{nr}} mislukt",
    "klaraauftrag.ereignis.zurueckgenommen": "Stap {{nr}} teruggedraaid",
    "klaraauftrag.ereignis.abgebrochen": "Afgebroken",
    "klaraauftrag.ereignis.korrigiert": "Grens gecorrigeerd",
    "klaraauftrag.ereignis.auftrag_abgeschlossen": "Opdracht afgerond",
    "klaraauftrag.korrektur.titel": "Grens corrigeren",
    "klaraauftrag.korrektur.erklaerung":
      "Je kunt open stappen weglaten. Meer acties of doelen breiden de bevoegdheid uit – dat is een aparte opdracht.",
    "klaraauftrag.korrektur.geschehen": "Al gebeurd en blijft bestaan: {{anzahl}} stap(pen).",
    "klaraauftrag.korrektur.grund": "{{weg}} open stap(pen) weggelaten",
    "klaraauftrag.grenze.abgebrochen": "De opdracht is afgebroken – deze stap start niet.",
    "klaraauftrag.grenze.abgeschlossen": "De opdracht is al beëindigd.",
    "klaraauftrag.grenze.ausserhalb_auftrag":
      "Deze stap valt buiten de grens van de opdracht en wordt niet uitgevoerd.",
    "klaraauftrag.grenze.fassung_veraltet":
      "De grens is inmiddels gecorrigeerd – Klara start niets onder de oude versie.",
    "klaraauftrag.grenze.erweiterung":
      "Een correctie mag de bevoegdheid niet uitbreiden. Geef daarvoor een nieuwe opdracht – de bestaande grens blijft gelden.",
    "klaraauftrag.fehler.anmeldung": "Je aanmelding is verlopen. Klara heeft niets gewijzigd.",
    "klaraauftrag.fehler.recht": "Je hebt daar geen recht toe. Klara heeft niets gewijzigd.",
    "klaraauftrag.fehler.nichtGefunden":
      "Het doel bestaat niet (meer) of is voor jou niet zichtbaar. Klara heeft niets gewijzigd.",
    "klaraauftrag.fehler.versionGeaendert":
      "Het doel is sinds de opdracht gewijzigd. Klara schrijft niet over een nieuwere stand heen en heeft niets gewijzigd.",
    "klaraauftrag.fehler.server": "De server heeft geweigerd ({{status}}): {{grund}}",
    "klaraauftrag.fehler.netz": "Geen verbinding met de server.",
    "klaraauftrag.fehler.unklar":
      "De verbinding viel weg – of de stap effect had, is onduidelijk. „Opnieuw proberen” herhaalt hem zonder dubbeling.",
    "klaraauftrag.fehler.protokoll":
      "Het resultaat kon niet bij de opdracht worden vastgelegd – status onduidelijk. „Opnieuw proberen” leest na en meldt het.",
    "klaraauftrag.fehler.unbestaetigt":
      "Opgeslagen, maar nog niet nagelezen – het resultaat is onbevestigd. „Opnieuw proberen” leest alleen na en schrijft niets opnieuw.",
    "klaraauftrag.fehler.klaeren":
      "Klara kon het doel niet verduidelijken: {{grund}} Niets uitgevoerd.",
    "klaraauftrag.fehler.anlegen":
      "De opdracht kon niet worden vastgelegd: {{grund}} Niets uitgevoerd.",
    "klaraauftrag.fehler.nichtNachgelesen":
      "Bij het nalezen op de server stond de wijziging er niet – Klara meldt geen succes.",
    "klaraauftrag.fehler.nichtGeoeffnet": "„{{titel}}” is niet geopend.",
    "klaraauftrag.fehler.keinZiel": "Geen doel voor deze stap.",
    "klaraauftrag.fehler.vorschritt":
      "De vorige stap heeft geen resultaat opgeslagen – er is niets te openen.",
    "klaraauftrag.fehler.abbrechen": "Afbreken niet door de server bevestigd: {{grund}}",
    "klaraauftrag.fehlerCode.anmeldung": "Je aanmelding is verlopen. Klara heeft niets gewijzigd.",
    "klaraauftrag.fehlerCode.recht": "Je hebt daar geen recht toe. Klara heeft niets gewijzigd.",
    "klaraauftrag.fehlerCode.nichtGefunden":
      "Het doel bestaat niet (meer) of is voor jou niet zichtbaar. Klara heeft niets gewijzigd.",
    "klaraauftrag.fehlerCode.versionGeaendert":
      "Het doel is sinds de opdracht gewijzigd. Klara schrijft niet over een nieuwere stand heen en heeft niets gewijzigd.",
    "klaraauftrag.fehlerCode.nichtNachgelesen":
      "Bij het nalezen op de server stond de wijziging er niet – Klara meldt geen succes.",
    "klaraauftrag.fehlerCode.nichtVerfuegbar":
      "De taak is voor jou niet (meer) beschikbaar. Klara heeft niets geopend.",
    "klaraauftrag.fehlerCode.vorschritt":
      "De vorige stap heeft geen resultaat opgeslagen – er is niets te openen.",
    "klaraauftrag.fehlerCode.server": "De server heeft de stap geweigerd. Niets gewijzigd.",
    "klaraauftrag.fehlerCode.fremdstand":
      "Opgeslagen – het concept is daarna verder gewijzigd of de eigen stand is niet bevestigd. Klara draait niets terug over een latere wijziging heen.",
    "klaraauftrag.ruecknahme.nichtNachgelesen":
      "Bij het nalezen was het terugdraaien niet te zien – Klara meldt het niet als gedaan.",
    "klaraauftrag.ruecknahme.ohneVorher":
      "Alleen de sessie waarin de wijziging gebeurde kent de vorige stand. Draai het in het concept zelf terug.",
    "klaraauftrag.ruecknahme.geaendert":
      "Het concept is sindsdien verder gewijzigd. Klara draait niets terug over een latere wijziging heen.",
    "klaraauftrag.ruecknahme.fehler": "Ongedaan maken lukte niet: {{grund}}",
    "klaraauftrag.belegt":
      "Er loopt nog een opdracht. Klara neemt pas daarna een nieuwe aan – er is niets verstuurd.",
    "klaraauftrag.ansage.gestartet":
      "Opdracht aangenomen – Klara verduidelijkt het doel en voert hem dan uit.",
    "klaraauftrag.eingabeHinweis": "„Verzenden” voert deze opdracht uit (zonder AI): {{schritte}}",
    "klaraauftrag.sprache.art": "Uitvoeringsopdracht",
    "klaraauftrag.sprache.hinweis":
      "Na „Verzenden” voert Klara hem uit via dezelfde actie als een getypte opdracht – met jouw rechten, stap voor stap zichtbaar.",
    "klaraauftrag.sprache.ergebnis":
      "Doorgegeven aan de opdrachtkaart – daar staat de werkelijke status van elke stap.",
    "klaraauftrag.sprache.nichtUebergeben": "Niet doorgegeven – er loopt nog een opdracht.",
    "klaraauftrag.bedienhilfe.ausfuehren":
      "Opdrachten uitvoeren: typ of zeg bv. „Open het artikel „…””, „Maak een concept „…” aan”, „Vul concept „…” aan: …”, „Zet de prioriteit van taak „…” op hoog”, „Wijs taak „…” toe aan Naam”, „Escaleer taak „…”” of „Bewerk de taak „…”” (dan vraagt Klara wat er moet gebeuren). Klara gebruikt daarvoor de bestaande Klarwerk-acties met jouw rechten.",
    "klaraauftrag.bedienhilfe.grenze":
      "Elke opdracht toont doel, toegestane acties en bronnen, wie verantwoordelijk is en welk resultaat telt. Tekst in documenten of antwoorden wordt nooit als opdracht gelezen.",
    "klaraauftrag.bedienhilfe.stoppen":
      "Afbreken stopt alle verdere stappen – wat al is opgeslagen blijft zichtbaar. Met „Grens corrigeren” laat je open stappen weg; uitbreiden kan alleen met een nieuwe opdracht.",
    "klaraauftrag.bedienhilfe.rueckgaengig":
      "Ongedaan maken draait een aangemaakt concept (naar de prullenbak) of een bewerking terug. Openen kan niet worden teruggedraaid, omdat het niets verandert. Acties op taken (prioriteit, toewijzing, escalatie) draait Klara niet terug – dat staat dan bij de stap.",
    "klaraauftrag.bedienhilfe.sprechen":
      "„Dicteren” schrijft alleen in het invoerveld. „Opdracht inspreken” toont de opdracht als kaart – pas „Verzenden” voert hem uit.",
  },
} satisfies Textmodul;
