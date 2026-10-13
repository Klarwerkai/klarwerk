// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) — Ergebnis, Nachweis, Rücknahme.
// ================================================================================================
//
// Die Texte zur Auftragskarte von Klara 05: der Ergebnisstand aus den festgehaltenen Schritten, je
// Schritt der Nachweis (Aktionskennung, Vorgang, Zeitpunkt, ausführende Identität, vorheriger und
// neuer Stand, Prüfprotokoll), der Aktionsvertrag (Wirkung, Recht, Rücknahme) und die erklärte
// Ablehnung einer Rücknahme mit dem Weg zum Korrigieren.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "assistenzverlauf.",
  legacySchluessel: [],
  de: {
    "assistenzverlauf.ergebnis.titel": "Ergebnis",
    "assistenzverlauf.ergebnis.entwurf": "Entwurf – noch nichts ausgeführt",
    "assistenzverlauf.ergebnis.vorschlag": "Vorschlag – noch nichts ausgeführt",
    "assistenzverlauf.ergebnis.laeuft": "Ausführung läuft",
    "assistenzverlauf.ergebnis.unklar": "Ergebnis unklar – noch nicht nachgelesen",
    "assistenzverlauf.ergebnis.ausgefuehrt": "Ausgeführt",
    "assistenzverlauf.ergebnis.teilweise": "Teilweise ausgeführt",
    "assistenzverlauf.ergebnis.fehlgeschlagen": "Fehlgeschlagen",
    "assistenzverlauf.ergebnis.zurueckgenommen": "Zurückgenommen",
    "assistenzverlauf.ergebnis.teilweise_zurueckgenommen": "Teilweise zurückgenommen",
    "assistenzverlauf.ergebnis.abgebrochen": "Abgebrochen – nichts ausgeführt",
    "assistenzverlauf.ergebnis.hinweis":
      "Dieser Stand stammt aus den am Server festgehaltenen Schritten. Was Klara schreibt, gilt nicht als Ausführung.",
    "assistenzverlauf.nachweis.titel": "Nachweis",
    "assistenzverlauf.nachweis.aktionskennung": "Aktionskennung",
    "assistenzverlauf.nachweis.vorgang": "Vorgang",
    "assistenzverlauf.nachweis.vorgangWert": "{{aktion}} · Schritt {{nr}} · Auftrag {{auftrag}}",
    "assistenzverlauf.nachweis.zeitpunkt": "Zeitpunkt",
    "assistenzverlauf.nachweis.ausfuehrend": "Ausgeführt von",
    "assistenzverlauf.nachweis.ausfuehrendWert":
      "Klarwerk im Auftrag von {{person}} – ohne KI, mit deren Rechten",
    "assistenzverlauf.nachweis.ergebnis": "Ergebnis",
    "assistenzverlauf.nachweis.vorher": "Vorher",
    "assistenzverlauf.nachweis.neu": "Neu",
    "assistenzverlauf.nachweis.nachRuecknahme": "Nach der Rücknahme",
    "assistenzverlauf.nachweis.wirkung": "Wirkung",
    "assistenzverlauf.nachweis.recht": "Recht",
    "assistenzverlauf.nachweis.ruecknahme": "Rücknahme",
    "assistenzverlauf.feld.titel": "Titel",
    "assistenzverlauf.feld.kernaussage": "Kernaussage",
    "assistenzverlauf.feld.geaendert": "geändert",
    "assistenzverlauf.stand.fassung": "Fassung vom {{zeit}}",
    "assistenzverlauf.stand.neu": "gab es noch nicht",
    "assistenzverlauf.stand.papierkorb": "im Papierkorb (dort wiederherstellbar)",
    "assistenzverlauf.stand.unbekannt": "nicht festgehalten",
    "assistenzverlauf.stand.prioritaet": "Priorität {{wert}}",
    "assistenzverlauf.stand.zugewiesen": "jemandem zugewiesen",
    "assistenzverlauf.stand.zugewiesenAn": "{{person}} zugewiesen",
    "assistenzverlauf.stand.nichtZugewiesen": "niemandem zugewiesen",
    "assistenzverlauf.stand.status": "Status „{{status}}“",
    "assistenzverlauf.stand.eskaliert": "eskaliert",
    "assistenzverlauf.vertrag.oeffnen.wirkung": "Öffnet nur – ändert nichts.",
    "assistenzverlauf.vertrag.oeffnen.recht": "Leserecht am Ziel",
    "assistenzverlauf.vertrag.oeffnen.ruecknahme": "Nicht nötig – nichts geändert.",
    "assistenzverlauf.vertrag.entwurf_erstellen.wirkung":
      "Legt einen Entwurf an, den nur du siehst.",
    "assistenzverlauf.vertrag.entwurf_erstellen.recht": "Entwürfe anlegen (ko.create)",
    "assistenzverlauf.vertrag.entwurf_erstellen.ruecknahme":
      "Rücknehmbar: der Entwurf geht in den Papierkorb und ist dort wiederherstellbar.",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.wirkung":
      "Ändert Titel oder Kernaussage deines Entwurfs.",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.recht":
      "Entwürfe bearbeiten (ko.create), mit Fassungsvergleich",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.ruecknahme":
      "Rücknehmbar: die vorherigen Felder kommen als neue Fassung zurück – nur, solange niemand weiter geändert hat.",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.wirkung": "Öffnet die Aufgabe – entscheidet nichts.",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.recht": "Aufgabe ist für dich verfügbar",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.ruecknahme": "Nicht nötig – nichts geändert.",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.wirkung":
      "Setzt die Priorität einer Wissenslücke – sichtbar für alle, die an ihr arbeiten.",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.recht": "Aufgaben zuweisen (ko.assign)",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.ruecknahme":
      "Nicht rücknehmbar durch Klara: andere sehen die neue Priorität bereits. Ändern kannst du sie an der Wissenslücke.",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.wirkung":
      "Weist eine Wissenslücke einer Person zu – sie sieht die Aufgabe.",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.recht": "Aufgaben zuweisen (ko.assign)",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.ruecknahme":
      "Nicht rücknehmbar durch Klara: die Person sieht die Aufgabe bereits. Neu zuweisen kannst du an der Wissenslücke.",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.wirkung":
      "Eskaliert einen Konflikt an die Verantwortlichen.",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.recht": "Konflikte bearbeiten (conflict.resolve)",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.ruecknahme":
      "Nicht rücknehmbar durch Klara: die Eskalation ist bei den Verantwortlichen angekommen. Weiter geht es am Konflikt.",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.wirkung":
      "Legt eine persönliche Aufgabe an, die nur du siehst.",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.recht":
      "Anmeldung – nur dein eigenes Konto",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.ruecknahme":
      "Nicht rücknehmbar durch Klara: ändern, erledigen oder löschen kannst du die Aufgabe selbst.",
    "assistenzverlauf.korrigieren.persoenliche_aufgabe": "Zur Aufgabe",
    "assistenzverlauf.hinderung.fremdstand":
      "Nicht rücknehmbar: der Entwurf wurde nach Klaras Änderung weiter geändert. Korrigiere im Entwurf selbst.",
    "assistenzverlauf.hinderung.nicht_gespeichert":
      "Nichts zurückzunehmen – dieser Schritt hat nichts gespeichert.",
    "assistenzverlauf.korrigieren.entwurf": "Im Entwurf korrigieren",
    "assistenzverlauf.korrigieren.luecke": "Zur Wissenslücke",
    "assistenzverlauf.korrigieren.konflikt": "Zum Konflikt",
    "assistenzverlauf.protokoll.titel": "Prüfprotokoll",
    "assistenzverlauf.protokoll.laden": "Einträge laden",
    "assistenzverlauf.protokoll.laedt": "Lädt …",
    "assistenzverlauf.protokoll.leer": "Keine Einträge zu diesem Schritt.",
    "assistenzverlauf.protokoll.fehler": "Das Prüfprotokoll ist gerade nicht erreichbar.",
    "assistenzverlauf.protokoll.eintrag": "Nr. {{seq}} · {{zeit}} · {{ereignis}}",
    "assistenzverlauf.protokoll.ereignis.begonnen": "begonnen",
    "assistenzverlauf.protokoll.ereignis.gespeichert": "gespeichert",
    "assistenzverlauf.protokoll.ereignis.abgeschlossen": "abgeschlossen",
    "assistenzverlauf.protokoll.ereignis.fehlgeschlagen": "fehlgeschlagen",
    "assistenzverlauf.protokoll.ereignis.zurueckgenommen": "zurückgenommen",
    "assistenzverlauf.protokoll.ereignis.abgelehnt": "Rücknahme abgelehnt",
    "assistenzverlauf.protokoll.hinweis":
      "Einträge der unveränderlichen Prüfkette – mit Kennungen und Fassungszeiten, ohne Titel oder Inhalt.",
    "assistenzverlauf.konflikt.titel": "Rücknahme abgelehnt",
    "assistenzverlauf.konflikt.staende":
      "Klaras Fassung: {{eigen}} · jetzt: {{aktuell}}. Die neuere Fassung bleibt unverändert.",
    "assistenzverlauf.konflikt.andere": "Diese Wirkung sehen bereits andere.",
    "assistenzverlauf.ruecknahme.zielFehlt":
      "Rückgängig nicht möglich: der Entwurf ist für dich nicht (mehr) erreichbar. Nichts geändert.",
  },
  en: {
    "assistenzverlauf.ergebnis.titel": "Result",
    "assistenzverlauf.ergebnis.entwurf": "Draft – nothing carried out yet",
    "assistenzverlauf.ergebnis.vorschlag": "Proposal – nothing carried out yet",
    "assistenzverlauf.ergebnis.laeuft": "Running",
    "assistenzverlauf.ergebnis.unklar": "Result unclear – not yet read back",
    "assistenzverlauf.ergebnis.ausgefuehrt": "Carried out",
    "assistenzverlauf.ergebnis.teilweise": "Partly carried out",
    "assistenzverlauf.ergebnis.fehlgeschlagen": "Failed",
    "assistenzverlauf.ergebnis.zurueckgenommen": "Undone",
    "assistenzverlauf.ergebnis.teilweise_zurueckgenommen": "Partly undone",
    "assistenzverlauf.ergebnis.abgebrochen": "Stopped – nothing carried out",
    "assistenzverlauf.ergebnis.hinweis":
      "This status comes from the steps recorded on the server. What Klara writes does not count as carrying something out.",
    "assistenzverlauf.nachweis.titel": "Record",
    "assistenzverlauf.nachweis.aktionskennung": "Action ID",
    "assistenzverlauf.nachweis.vorgang": "Operation",
    "assistenzverlauf.nachweis.vorgangWert": "{{aktion}} · step {{nr}} · task {{auftrag}}",
    "assistenzverlauf.nachweis.zeitpunkt": "Time",
    "assistenzverlauf.nachweis.ausfuehrend": "Carried out by",
    "assistenzverlauf.nachweis.ausfuehrendWert":
      "Klarwerk on behalf of {{person}} – without AI, with their permissions",
    "assistenzverlauf.nachweis.ergebnis": "Result",
    "assistenzverlauf.nachweis.vorher": "Before",
    "assistenzverlauf.nachweis.neu": "New",
    "assistenzverlauf.nachweis.nachRuecknahme": "After undo",
    "assistenzverlauf.nachweis.wirkung": "Effect",
    "assistenzverlauf.nachweis.recht": "Permission",
    "assistenzverlauf.nachweis.ruecknahme": "Undo",
    "assistenzverlauf.feld.titel": "Title",
    "assistenzverlauf.feld.kernaussage": "Key statement",
    "assistenzverlauf.feld.geaendert": "changed",
    "assistenzverlauf.stand.fassung": "Version of {{zeit}}",
    "assistenzverlauf.stand.neu": "did not exist yet",
    "assistenzverlauf.stand.papierkorb": "in the trash (can be restored there)",
    "assistenzverlauf.stand.unbekannt": "not recorded",
    "assistenzverlauf.stand.prioritaet": "Priority {{wert}}",
    "assistenzverlauf.stand.zugewiesen": "assigned to someone",
    "assistenzverlauf.stand.zugewiesenAn": "assigned to {{person}}",
    "assistenzverlauf.stand.nichtZugewiesen": "not assigned",
    "assistenzverlauf.stand.status": "Status “{{status}}”",
    "assistenzverlauf.stand.eskaliert": "escalated",
    "assistenzverlauf.vertrag.oeffnen.wirkung": "Only opens – changes nothing.",
    "assistenzverlauf.vertrag.oeffnen.recht": "Read access to the target",
    "assistenzverlauf.vertrag.oeffnen.ruecknahme": "Not needed – nothing changed.",
    "assistenzverlauf.vertrag.entwurf_erstellen.wirkung": "Creates a draft that only you can see.",
    "assistenzverlauf.vertrag.entwurf_erstellen.recht": "Create drafts (ko.create)",
    "assistenzverlauf.vertrag.entwurf_erstellen.ruecknahme":
      "Can be undone: the draft moves to the trash and can be restored there.",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.wirkung":
      "Changes the title or key statement of your draft.",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.recht":
      "Edit drafts (ko.create), with version check",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.ruecknahme":
      "Can be undone: the previous fields return as a new version – only as long as nobody changed it further.",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.wirkung": "Opens the task – decides nothing.",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.recht": "Task is available to you",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.ruecknahme": "Not needed – nothing changed.",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.wirkung":
      "Sets the priority of a knowledge gap – visible to everyone working on it.",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.recht": "Assign tasks (ko.assign)",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.ruecknahme":
      "Klara cannot undo this: others already see the new priority. You can change it at the knowledge gap.",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.wirkung":
      "Assigns a knowledge gap to a person – they see the task.",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.recht": "Assign tasks (ko.assign)",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.ruecknahme":
      "Klara cannot undo this: the person already sees the task. You can reassign it at the knowledge gap.",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.wirkung":
      "Escalates a conflict to the people responsible.",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.recht": "Work on conflicts (conflict.resolve)",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.ruecknahme":
      "Klara cannot undo this: the escalation has reached the people responsible. Continue at the conflict.",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.wirkung":
      "Creates a personal task that only you can see.",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.recht":
      "Signed in – only your own account",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.ruecknahme":
      "Klara cannot undo this: you can change, complete or delete the task yourself.",
    "assistenzverlauf.korrigieren.persoenliche_aufgabe": "Go to the task",
    "assistenzverlauf.hinderung.fremdstand":
      "Cannot be undone: the draft was changed further after Klara's change. Correct it in the draft itself.",
    "assistenzverlauf.hinderung.nicht_gespeichert":
      "Nothing to undo – this step did not save anything.",
    "assistenzverlauf.korrigieren.entwurf": "Correct in the draft",
    "assistenzverlauf.korrigieren.luecke": "Go to the knowledge gap",
    "assistenzverlauf.korrigieren.konflikt": "Go to the conflict",
    "assistenzverlauf.protokoll.titel": "Audit log",
    "assistenzverlauf.protokoll.laden": "Load entries",
    "assistenzverlauf.protokoll.laedt": "Loading …",
    "assistenzverlauf.protokoll.leer": "No entries for this step.",
    "assistenzverlauf.protokoll.fehler": "The audit log cannot be reached right now.",
    "assistenzverlauf.protokoll.eintrag": "No. {{seq}} · {{zeit}} · {{ereignis}}",
    "assistenzverlauf.protokoll.ereignis.begonnen": "started",
    "assistenzverlauf.protokoll.ereignis.gespeichert": "saved",
    "assistenzverlauf.protokoll.ereignis.abgeschlossen": "completed",
    "assistenzverlauf.protokoll.ereignis.fehlgeschlagen": "failed",
    "assistenzverlauf.protokoll.ereignis.zurueckgenommen": "undone",
    "assistenzverlauf.protokoll.ereignis.abgelehnt": "undo rejected",
    "assistenzverlauf.protokoll.hinweis":
      "Entries of the unchangeable audit chain – with IDs and version times, without titles or content.",
    "assistenzverlauf.konflikt.titel": "Undo rejected",
    "assistenzverlauf.konflikt.staende":
      "Klara's version: {{eigen}} · now: {{aktuell}}. The newer version stays unchanged.",
    "assistenzverlauf.konflikt.andere": "Others already see this effect.",
    "assistenzverlauf.ruecknahme.zielFehlt":
      "Cannot undo: the draft is not (or no longer) available to you. Nothing changed.",
  },
  nl: {
    "assistenzverlauf.ergebnis.titel": "Resultaat",
    "assistenzverlauf.ergebnis.entwurf": "Concept – nog niets uitgevoerd",
    "assistenzverlauf.ergebnis.vorschlag": "Voorstel – nog niets uitgevoerd",
    "assistenzverlauf.ergebnis.laeuft": "Wordt uitgevoerd",
    "assistenzverlauf.ergebnis.unklar": "Resultaat onduidelijk – nog niet nagelezen",
    "assistenzverlauf.ergebnis.ausgefuehrt": "Uitgevoerd",
    "assistenzverlauf.ergebnis.teilweise": "Gedeeltelijk uitgevoerd",
    "assistenzverlauf.ergebnis.fehlgeschlagen": "Mislukt",
    "assistenzverlauf.ergebnis.zurueckgenommen": "Teruggedraaid",
    "assistenzverlauf.ergebnis.teilweise_zurueckgenommen": "Gedeeltelijk teruggedraaid",
    "assistenzverlauf.ergebnis.abgebrochen": "Afgebroken – niets uitgevoerd",
    "assistenzverlauf.ergebnis.hinweis":
      "Deze stand komt uit de stappen die op de server zijn vastgelegd. Wat Klara schrijft, telt niet als uitvoering.",
    "assistenzverlauf.nachweis.titel": "Bewijs",
    "assistenzverlauf.nachweis.aktionskennung": "Actie-ID",
    "assistenzverlauf.nachweis.vorgang": "Handeling",
    "assistenzverlauf.nachweis.vorgangWert": "{{aktion}} · stap {{nr}} · opdracht {{auftrag}}",
    "assistenzverlauf.nachweis.zeitpunkt": "Tijdstip",
    "assistenzverlauf.nachweis.ausfuehrend": "Uitgevoerd door",
    "assistenzverlauf.nachweis.ausfuehrendWert":
      "Klarwerk namens {{person}} – zonder AI, met diens rechten",
    "assistenzverlauf.nachweis.ergebnis": "Resultaat",
    "assistenzverlauf.nachweis.vorher": "Voorheen",
    "assistenzverlauf.nachweis.neu": "Nieuw",
    "assistenzverlauf.nachweis.nachRuecknahme": "Na het terugdraaien",
    "assistenzverlauf.nachweis.wirkung": "Effect",
    "assistenzverlauf.nachweis.recht": "Recht",
    "assistenzverlauf.nachweis.ruecknahme": "Terugdraaien",
    "assistenzverlauf.feld.titel": "Titel",
    "assistenzverlauf.feld.kernaussage": "Kernuitspraak",
    "assistenzverlauf.feld.geaendert": "gewijzigd",
    "assistenzverlauf.stand.fassung": "Versie van {{zeit}}",
    "assistenzverlauf.stand.neu": "bestond nog niet",
    "assistenzverlauf.stand.papierkorb": "in de prullenbak (daar te herstellen)",
    "assistenzverlauf.stand.unbekannt": "niet vastgelegd",
    "assistenzverlauf.stand.prioritaet": "Prioriteit {{wert}}",
    "assistenzverlauf.stand.zugewiesen": "aan iemand toegewezen",
    "assistenzverlauf.stand.zugewiesenAn": "toegewezen aan {{person}}",
    "assistenzverlauf.stand.nichtZugewiesen": "aan niemand toegewezen",
    "assistenzverlauf.stand.status": "Status ‘{{status}}’",
    "assistenzverlauf.stand.eskaliert": "geëscaleerd",
    "assistenzverlauf.vertrag.oeffnen.wirkung": "Opent alleen – verandert niets.",
    "assistenzverlauf.vertrag.oeffnen.recht": "Leesrecht op het doel",
    "assistenzverlauf.vertrag.oeffnen.ruecknahme": "Niet nodig – niets veranderd.",
    "assistenzverlauf.vertrag.entwurf_erstellen.wirkung":
      "Maakt een concept aan dat alleen jij ziet.",
    "assistenzverlauf.vertrag.entwurf_erstellen.recht": "Concepten aanmaken (ko.create)",
    "assistenzverlauf.vertrag.entwurf_erstellen.ruecknahme":
      "Terug te draaien: het concept gaat naar de prullenbak en is daar te herstellen.",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.wirkung":
      "Wijzigt titel of kernuitspraak van je concept.",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.recht":
      "Concepten bewerken (ko.create), met versievergelijking",
    "assistenzverlauf.vertrag.entwurf_bearbeiten.ruecknahme":
      "Terug te draaien: de vorige velden komen terug als nieuwe versie – alleen zolang niemand verder heeft gewijzigd.",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.wirkung": "Opent de taak – beslist niets.",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.recht": "Taak is voor jou beschikbaar",
    "assistenzverlauf.vertrag.aufgabe_oeffnen.ruecknahme": "Niet nodig – niets veranderd.",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.wirkung":
      "Zet de prioriteit van een kennislacune – zichtbaar voor iedereen die eraan werkt.",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.recht": "Taken toewijzen (ko.assign)",
    "assistenzverlauf.vertrag.aufgabe_prioritaet.ruecknahme":
      "Klara kan dit niet terugdraaien: anderen zien de nieuwe prioriteit al. Wijzigen kan bij de kennislacune.",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.wirkung":
      "Wijst een kennislacune toe aan een persoon – die ziet de taak.",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.recht": "Taken toewijzen (ko.assign)",
    "assistenzverlauf.vertrag.aufgabe_zuweisen.ruecknahme":
      "Klara kan dit niet terugdraaien: de persoon ziet de taak al. Opnieuw toewijzen kan bij de kennislacune.",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.wirkung":
      "Escaleert een conflict naar de verantwoordelijken.",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.recht": "Conflicten behandelen (conflict.resolve)",
    "assistenzverlauf.vertrag.aufgabe_eskalieren.ruecknahme":
      "Klara kan dit niet terugdraaien: de escalatie is bij de verantwoordelijken aangekomen. Verder gaat het bij het conflict.",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.wirkung":
      "Maakt een persoonlijke taak aan die alleen jij ziet.",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.recht":
      "Aangemeld – alleen je eigen account",
    "assistenzverlauf.vertrag.persoenliche_aufgabe_anlegen.ruecknahme":
      "Klara kan dit niet terugdraaien: wijzigen, afronden of verwijderen doe je zelf bij de taak.",
    "assistenzverlauf.korrigieren.persoenliche_aufgabe": "Naar de taak",
    "assistenzverlauf.hinderung.fremdstand":
      "Niet terug te draaien: het concept is na Klara's wijziging verder gewijzigd. Corrigeer in het concept zelf.",
    "assistenzverlauf.hinderung.nicht_gespeichert":
      "Niets terug te draaien – deze stap heeft niets opgeslagen.",
    "assistenzverlauf.korrigieren.entwurf": "In het concept corrigeren",
    "assistenzverlauf.korrigieren.luecke": "Naar de kennislacune",
    "assistenzverlauf.korrigieren.konflikt": "Naar het conflict",
    "assistenzverlauf.protokoll.titel": "Auditlog",
    "assistenzverlauf.protokoll.laden": "Vermeldingen laden",
    "assistenzverlauf.protokoll.laedt": "Laden …",
    "assistenzverlauf.protokoll.leer": "Geen vermeldingen bij deze stap.",
    "assistenzverlauf.protokoll.fehler": "Het auditlog is nu niet bereikbaar.",
    "assistenzverlauf.protokoll.eintrag": "Nr. {{seq}} · {{zeit}} · {{ereignis}}",
    "assistenzverlauf.protokoll.ereignis.begonnen": "gestart",
    "assistenzverlauf.protokoll.ereignis.gespeichert": "opgeslagen",
    "assistenzverlauf.protokoll.ereignis.abgeschlossen": "afgerond",
    "assistenzverlauf.protokoll.ereignis.fehlgeschlagen": "mislukt",
    "assistenzverlauf.protokoll.ereignis.zurueckgenommen": "teruggedraaid",
    "assistenzverlauf.protokoll.ereignis.abgelehnt": "terugdraaien geweigerd",
    "assistenzverlauf.protokoll.hinweis":
      "Vermeldingen uit de onveranderlijke auditketen – met ID's en versietijden, zonder titels of inhoud.",
    "assistenzverlauf.konflikt.titel": "Terugdraaien geweigerd",
    "assistenzverlauf.konflikt.staende":
      "Versie van Klara: {{eigen}} · nu: {{aktuell}}. De nieuwere versie blijft ongewijzigd.",
    "assistenzverlauf.konflikt.andere": "Anderen zien dit effect al.",
    "assistenzverlauf.ruecknahme.zielFehlt":
      "Terugdraaien niet mogelijk: het concept is voor jou niet (meer) bereikbaar. Niets veranderd.",
  },
} satisfies Textmodul;
