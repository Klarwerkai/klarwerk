// ================================================================================================
// produkt:20261010:klara-eigener-kalender (AW-16) — „Mein Kalender" (`/kalender`).
// ================================================================================================
//
// DE/EN/NL, weil der Textmodulvertrag jede Sprache der Oberfläche verlangt
// (docs/i18n-textmodule.md). Die Texte trennen Eintrag, Auftrag und Ergebnis und versprechen nichts,
// was nicht geschehen ist: „Erinnerung zugestellt" heisst nicht „verlängert" oder „erledigt".
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "kalender.",
  legacySchluessel: [],
  de: {
    "kalender.konto.menue": "Mein Kalender",
    "kalender.titel": "Mein Kalender",
    "kalender.lead":
      "Eigene Termine, Fristen und Aufgaben in Tages-, Wochen- und Agendaansicht — ohne Outlook oder einen anderen Kalender anzubinden.",
    "kalender.ohneKonto": "Gespeichert in Klarwerk. Ein externes Konto ist nicht nötig.",
    "kalender.zone": "Zeiten in lokaler Zeitzone: {{zone}}",
    "kalender.laedt": "Wird geladen …",
    "kalender.neu": "Neuer Eintrag",
    "kalender.leer": "Keine Einträge.",
    "kalender.agenda.leer": "Keine Einträge in den nächsten 60 Tagen ab dem gewählten Tag.",
    "kalender.ganztaegig": "ganztägig",
    "kalender.unzugeordnet": "unzugeordnet",
    "kalender.ausgeblendet": "aus der eigenen Ansicht entfernt",
    "kalender.ausgeblendeteZeigen": "Aus der Ansicht entfernte Einträge zeigen ({{anzahl}})",
    "kalender.geschuetzt": "Geschützter Eintrag",
    "kalender.geschuetztKurz": "Geschützter Eintrag",
    "kalender.geschuetztErklaerung":
      "Die Quelle dieses Eintrags ist nicht mehr freigegeben. Deshalb bleiben Titel, Notiz und Quellangabe verborgen; Zeit, Status und Kennungen bleiben sichtbar.",
    "kalender.bearbeiten": "Bearbeiten",
    "kalender.loeschen": "Löschen",
    "kalender.loeschenFrage":
      "Diesen Eintrag endgültig löschen? Das lässt sich nicht zurücknehmen. Nur aus der eigenen Ansicht entfernen geht mit „Aus der eigenen Ansicht entfernen“.",
    "kalender.loeschenJa": "Endgültig löschen",

    "kalender.fehler.allgemein": "Das hat nicht geklappt. Bitte erneut versuchen.",
    "kalender.fehler.anmeldung": "Die Anmeldung ist abgelaufen. Bitte neu anmelden.",
    "kalender.fehler.weg": "Diesen Eintrag gibt es nicht (mehr), oder er ist nicht freigegeben.",
    "kalender.fehler.steuerung":
      "Das dürfen nur die Verantwortlichen dieses Eintrags oder des Teams.",
    "kalender.fehler.konflikt":
      "Das geht so nicht: der Eintrag wurde inzwischen geändert, ist unzugeordnet oder seine Quelle ist geschützt. Bitte neu laden.",
    "kalender.fehler.eingabe": "Bitte die Angaben prüfen: Titel, Beginn und Ende sind nötig.",

    "kalender.sicht.legende": "Tägliche Ansicht",
    "kalender.sicht.eigen": "Eigener Kalender",
    "kalender.sicht.vorhanden": "Vorhandener Kalender",
    "kalender.sicht.beide": "Beide",
    "kalender.sicht.hinweis":
      "Die Wahl betrifft nur die Ansicht. Interne Termine, Fristen und Zeitsteuerung bleiben in jedem Fall gespeichert und wirksam.",

    "kalender.vorhanden.titel": "Vorhandener Kalender",
    "kalender.vorhanden.verbunden": "Ein vorhandener Kalender ist verbunden.",
    "kalender.vorhanden.nichtVerbunden":
      "Kein vorhandener Kalender verbunden. Die Anbindung eines externen Kalenders ist ein eigener Schritt; bis dahin zeigt diese Fläche nichts Externes.",
    "kalender.vorhanden.internBleibt":
      "Interne Fristen und zeitgesteuerte Einträge bleiben hier sichtbar: die externe Ansicht ersetzt weder die interne Fristablage noch die interne Zeitsteuerung.",

    "kalender.bereich.legende": "Kalender",
    "kalender.bereich.persoenlich": "Persönlich",
    "kalender.bereich.team": "Team",
    "kalender.bereich.privat":
      "Persönliche Einträge sind privat und erscheinen nicht im Teamkalender.",
    "kalender.bereich.keinTeam": "Teameinträge gibt es erst mit einer Teammitgliedschaft.",
    "kalender.bereich.teamHinweis":
      "Teameinträge sehen die heutigen Mitglieder des Teams; Aufträge steuern nur die Verantwortlichen.",

    "kalender.ansicht.legende": "Ansicht",
    "kalender.ansicht.tag": "Tag",
    "kalender.ansicht.woche": "Woche",
    "kalender.ansicht.agenda": "Agenda",
    "kalender.nav.zurueck": "Zurück",
    "kalender.nav.heute": "Heute",
    "kalender.nav.weiter": "Weiter",
    "kalender.nav.tastatur":
      "Tastatur: Pfeil links/rechts wechselt den Tag (in der Wochenansicht die Woche), Bild auf/ab die Woche, Escape schließt die Einzelansicht.",
    "kalender.zeitraum.woche": "Woche {{von}} – {{bis}}",
    "kalender.zeitraum.agenda": "Agenda ab {{von}}",

    "kalender.art.termin": "Termin",
    "kalender.art.frist": "Frist",
    "kalender.art.aufgabe": "Aufgabe",
    "kalender.status.offen": "offen",
    "kalender.status.erledigt": "erledigt",
    "kalender.status.abgesagt": "abgesagt",
    "kalender.herkunft.eigen": "selbst angelegt",
    "kalender.herkunft.wissensobjekt": "aus einem Wissensobjekt",
    "kalender.serie.pausiert": "pausiert",
    "kalender.serie.aktiv": "aktiv",
    "kalender.lauf.geplant": "geplant",
    "kalender.lauf.laeuft": "läuft",
    "kalender.lauf.abgeschlossen": "abgeschlossen",
    "kalender.lauf.fehlgeschlagen": "fehlgeschlagen",
    "kalender.lauf.abgesagt": "abgesagt",
    "kalender.lauf.abgebrochen": "abgebrochen",

    "kalender.detail.waehlen": "Einen Eintrag wählen, um ihn zu öffnen.",
    "kalender.detail.eintrag": "Kalendereintrag",
    "kalender.detail.schliessen": "Schließen",
    "kalender.detail.kennung": "Kennung (event_id)",
    "kalender.detail.art": "Art",
    "kalender.detail.zeit": "Zeit",
    "kalender.detail.zone": "Zeitzone",
    "kalender.detail.zoneWert": "angezeigt in {{anzeige}}, angelegt in {{angelegt}}",
    "kalender.detail.herkunft": "Herkunft",
    "kalender.detail.team": "Team {{team}}",
    "kalender.detail.status": "Status",
    "kalender.detail.verantwortlich": "Verantwortlich",
    "kalender.detail.verantwortlichIch": "ich",
    "kalender.detail.frist": "Frist (deadline_id)",
    "kalender.detail.serie": "Serie (series_id)",

    "kalender.auftrag.titel": "Auszuführender Auftrag",
    "kalender.auftrag.kennung": "Auftrag (task_id)",
    "kalender.auftrag.zumEintrag": "zum Kalendereintrag",
    "kalender.auftrag.zumErgebnis": "zum tatsächlichen Ergebnis",
    "kalender.auftrag.keiner":
      "Kein Auftrag. Dieser Termin löst weder Modellarbeit noch Einladung, externe Nachricht, Verlängerung oder Systemänderung aus.",
    "kalender.auftrag.unzugeordnet":
      "Unzugeordnet: ohne verantwortliche Person gibt es keinen Ausführungsauftrag.",

    "kalender.ergebnis.titel": "Tatsächliches Ergebnis",
    "kalender.ergebnis.lauf": "Lauf (run_id) {{id}}: {{status}}",
    "kalender.ergebnis.zumAuftrag": "gehört zum Auftrag {{id}}",
    "kalender.ergebnis.keinLauf": "Kein Lauf: hier ist nichts ausgeführt worden.",
    "kalender.ergebnis.keins": "Noch kein Ergebnis festgehalten.",
    "kalender.ergebnis.erinnerung_zugestellt": "Erinnerung zugestellt am {{am}}.",
    "kalender.ergebnis.lauf_abgeschlossen": "Lauf abgeschlossen am {{am}}.",
    "kalender.ergebnis.lauf_fehlgeschlagen": "Lauf fehlgeschlagen am {{am}}.",
    "kalender.ergebnis.erinnerungGrenze":
      "Das heißt nur: die Erinnerung ist angekommen. Eine Verlängerung oder Erledigung der Frist (etwa einer Zertifizierung) ist damit nicht belegt.",

    "kalender.aktion.anzeige_entfernen": "Aus der eigenen Ansicht entfernen",
    "kalender.aktion.anzeige_zeigen": "Wieder anzeigen",
    "kalender.aktion.lauf_absagen": "Diesen Lauf absagen",
    "kalender.aktion.serie_pausieren": "Serie pausieren",
    "kalender.aktion.serie_fortsetzen": "Serie fortsetzen",
    "kalender.aktion.arbeit_abbrechen": "Laufende Arbeit abbrechen",
    "kalender.folgen.titel": "Folgen von „{{aktion}}“ vor der Änderung",
    "kalender.folgen.wirkung.anzeige_entfernen":
      "Der Eintrag verschwindet nur aus der eigenen Ansicht ({{anzahl}} Eintrag).",
    "kalender.folgen.wirkung.anzeige_zeigen":
      "Der Eintrag erscheint wieder in der eigenen Ansicht ({{anzahl}} Eintrag).",
    "kalender.folgen.wirkung.lauf_absagen":
      "Genau dieser eine geplante Lauf wird abgesagt ({{anzahl}} Eintrag).",
    "kalender.folgen.wirkung.serie_pausieren":
      "Die Serie wird pausiert; betroffene Einträge der Serie: {{anzahl}}.",
    "kalender.folgen.wirkung.serie_fortsetzen":
      "Die Pause der Serie wird aufgehoben; betroffene Einträge der Serie: {{anzahl}}.",
    "kalender.folgen.wirkung.arbeit_abbrechen":
      "Die gerade laufende Arbeit dieses Laufs wird abgebrochen ({{anzahl}} Eintrag).",
    "kalender.folgen.bleibtTitel": "Unverändert bleiben:",
    "kalender.folgen.bleibt.eintrag": "der Kalendereintrag selbst",
    "kalender.folgen.bleibt.frist": "die Frist",
    "kalender.folgen.bleibt.auftrag": "der Auftrag",
    "kalender.folgen.bleibt.serie": "die Serie und ihre übrigen Termine",
    "kalender.folgen.bleibt.lauf": "geplante Läufe",
    "kalender.folgen.bleibt.andere_personen": "die Ansicht anderer Personen",
    "kalender.folgen.bleibt.andere_laeufe": "andere Läufe",
    "kalender.folgen.bleibt.ergebnisse": "bereits entstandene Ergebnisse",
    "kalender.folgen.bleibt.eintraege": "alle Einträge (nichts wird gelöscht)",
    "kalender.folgen.bleibt.laufende_arbeit": "bereits laufende Arbeit",
    "kalender.folgen.bleibt.fristen": "Fristen",
    "kalender.folgen.umkehrbar": "Lässt sich zurücknehmen.",
    "kalender.folgen.endgueltig": "Lässt sich nicht zurücknehmen.",
    "kalender.folgen.bestaetigen": "Bestätigen",
    "kalender.folgen.abbrechen": "Nicht ändern",
    "kalender.folgen.nicht.allgemein": "Diese Aktion ist hier nicht möglich.",
    "kalender.folgen.nicht.keine_steuerung":
      "Das dürfen nur die Verantwortlichen dieses Eintrags oder des Teams.",
    "kalender.folgen.nicht.kein_lauf": "Zu diesem Eintrag gibt es keinen Lauf.",
    "kalender.folgen.nicht.lauf_nicht_geplant": "Der Lauf ist nicht mehr geplant.",
    "kalender.folgen.nicht.lauf_laeuft_nicht": "Es läuft gerade keine Arbeit.",
    "kalender.folgen.nicht.keine_serie": "Der Eintrag gehört zu keiner Serie.",
    "kalender.folgen.nicht.serie_bereits_pausiert": "Die Serie ist bereits pausiert.",
    "kalender.folgen.nicht.serie_nicht_pausiert": "Die Serie ist nicht pausiert.",
    "kalender.folgen.nicht.bereits_ausgeblendet":
      "Der Eintrag ist bereits aus der Ansicht entfernt.",
    "kalender.folgen.nicht.nicht_ausgeblendet": "Der Eintrag wird bereits angezeigt.",
    "kalender.folgen.nicht.ausfuehrung_nicht_angebunden":
      "Es ist kein Ausführungsdienst angebunden; der Kalender kann diese Wirkung weder auslösen noch nachweisen.",
    "kalender.folgen.nicht.lauf_nicht_nachgewiesen":
      "Der Ausführungsnachweis kennt diesen Lauf heute nicht.",
    "kalender.folgen.nicht.serie_nicht_nachgewiesen":
      "Der Ausführungsnachweis kennt diese Serie heute nicht.",
    "kalender.folgen.nicht.serie_fremde_verantwortung":
      "Zur Serie gehören Einträge, für die andere verantwortlich sind. Die ganze Serie steuern nur die Teamzuständigen.",
    "kalender.folgen.ausfuehrung":
      "Die Wirkung tritt beim Ausführungsdienst ein. Der Kalender zeigt sie erst, wenn der Dienst sie bestätigt hat.",
    "kalender.nichtNachgewiesen": "Stand nicht nachgewiesen",
    "kalender.auftrag.nichtAufgeloest": "im Ausführungsnachweis nicht auffindbar",
    "kalender.herkunft.vorhanden": "aus dem vorhandenen Kalender",

    "kalender.form.neu": "Neuer Eintrag",
    "kalender.form.bearbeiten": "Eintrag bearbeiten",
    "kalender.form.titel": "Titel",
    "kalender.form.art": "Art",
    "kalender.form.ganztaegig": "Ganztägig (Datum ohne Uhrzeit, etwa eine Frist)",
    "kalender.form.beginn": "Beginn",
    "kalender.form.ende": "Ende (wahlweise)",
    "kalender.form.zone": "Uhrzeiten gelten in der lokalen Zeitzone {{zone}}.",
    "kalender.form.notiz": "Notiz",
    "kalender.form.status": "Status",
    "kalender.form.team": "Team",
    "kalender.form.verantwortlich": "Verantwortlich",
    "kalender.form.verantwortlichIch": "ich",
    "kalender.form.verantwortlichOffen": "noch offen (unzugeordnet)",
    "kalender.form.verantwortlichBleibt": "unverändert (andere verantwortliche Person)",
    "kalender.form.speichern": "Speichern",
    "kalender.form.abbrechen": "Abbrechen",
  },
  en: {
    "kalender.konto.menue": "My calendar",
    "kalender.titel": "My calendar",
    "kalender.lead":
      "Your own appointments, deadlines and tasks in day, week and agenda view — without connecting Outlook or any other calendar.",
    "kalender.ohneKonto": "Stored in Klarwerk. No external account is needed.",
    "kalender.zone": "Times in local time zone: {{zone}}",
    "kalender.laedt": "Loading …",
    "kalender.neu": "New entry",
    "kalender.leer": "No entries.",
    "kalender.agenda.leer": "No entries in the next 60 days from the selected day.",
    "kalender.ganztaegig": "all day",
    "kalender.unzugeordnet": "unassigned",
    "kalender.ausgeblendet": "removed from your own view",
    "kalender.ausgeblendeteZeigen": "Show entries removed from the view ({{anzahl}})",
    "kalender.geschuetzt": "Protected entry",
    "kalender.geschuetztKurz": "Protected entry",
    "kalender.geschuetztErklaerung":
      "The source of this entry is no longer released. Title, note and source therefore stay hidden; time, status and identifiers remain visible.",
    "kalender.bearbeiten": "Edit",
    "kalender.loeschen": "Delete",
    "kalender.loeschenFrage":
      "Delete this entry permanently? This cannot be undone. To remove it only from your own view, use “Remove from your own view”.",
    "kalender.loeschenJa": "Delete permanently",

    "kalender.fehler.allgemein": "That did not work. Please try again.",
    "kalender.fehler.anmeldung": "Your sign-in has expired. Please sign in again.",
    "kalender.fehler.weg": "This entry does not exist (any more) or is not released.",
    "kalender.fehler.steuerung":
      "Only the people responsible for this entry or for the team may do this.",
    "kalender.fehler.konflikt":
      "Not possible like this: the entry has changed in the meantime, is unassigned or its source is protected. Please reload.",
    "kalender.fehler.eingabe": "Please check the details: title, start and end are required.",

    "kalender.sicht.legende": "Daily view",
    "kalender.sicht.eigen": "Own calendar",
    "kalender.sicht.vorhanden": "Existing calendar",
    "kalender.sicht.beide": "Both",
    "kalender.sicht.hinweis":
      "This choice only affects the view. Internal appointments, deadlines and scheduling stay stored and in effect in any case.",

    "kalender.vorhanden.titel": "Existing calendar",
    "kalender.vorhanden.verbunden": "An existing calendar is connected.",
    "kalender.vorhanden.nichtVerbunden":
      "No existing calendar connected. Connecting an external calendar is a separate step; until then this area shows nothing external.",
    "kalender.vorhanden.internBleibt":
      "Internal deadlines and scheduled entries stay visible here: the external view replaces neither the internal deadline record nor internal scheduling.",

    "kalender.bereich.legende": "Calendar",
    "kalender.bereich.persoenlich": "Personal",
    "kalender.bereich.team": "Team",
    "kalender.bereich.privat":
      "Personal entries are private and do not appear in the team calendar.",
    "kalender.bereich.keinTeam": "Team entries are only available with a team membership.",
    "kalender.bereich.teamHinweis":
      "Team entries are visible to the team's current members; only the people responsible control tasks.",

    "kalender.ansicht.legende": "View",
    "kalender.ansicht.tag": "Day",
    "kalender.ansicht.woche": "Week",
    "kalender.ansicht.agenda": "Agenda",
    "kalender.nav.zurueck": "Back",
    "kalender.nav.heute": "Today",
    "kalender.nav.weiter": "Next",
    "kalender.nav.tastatur":
      "Keyboard: left/right arrow changes the day (the week in week view), Page Up/Down changes the week, Escape closes the single view.",
    "kalender.zeitraum.woche": "Week {{von}} – {{bis}}",
    "kalender.zeitraum.agenda": "Agenda from {{von}}",

    "kalender.art.termin": "Appointment",
    "kalender.art.frist": "Deadline",
    "kalender.art.aufgabe": "Task",
    "kalender.status.offen": "open",
    "kalender.status.erledigt": "done",
    "kalender.status.abgesagt": "cancelled",
    "kalender.herkunft.eigen": "created yourself",
    "kalender.herkunft.wissensobjekt": "from a knowledge object",
    "kalender.serie.pausiert": "paused",
    "kalender.serie.aktiv": "active",
    "kalender.lauf.geplant": "planned",
    "kalender.lauf.laeuft": "running",
    "kalender.lauf.abgeschlossen": "completed",
    "kalender.lauf.fehlgeschlagen": "failed",
    "kalender.lauf.abgesagt": "cancelled",
    "kalender.lauf.abgebrochen": "aborted",

    "kalender.detail.waehlen": "Choose an entry to open it.",
    "kalender.detail.eintrag": "Calendar entry",
    "kalender.detail.schliessen": "Close",
    "kalender.detail.kennung": "Identifier (event_id)",
    "kalender.detail.art": "Type",
    "kalender.detail.zeit": "Time",
    "kalender.detail.zone": "Time zone",
    "kalender.detail.zoneWert": "shown in {{anzeige}}, created in {{angelegt}}",
    "kalender.detail.herkunft": "Origin",
    "kalender.detail.team": "Team {{team}}",
    "kalender.detail.status": "Status",
    "kalender.detail.verantwortlich": "Responsible",
    "kalender.detail.verantwortlichIch": "me",
    "kalender.detail.frist": "Deadline (deadline_id)",
    "kalender.detail.serie": "Series (series_id)",

    "kalender.auftrag.titel": "Task to be carried out",
    "kalender.auftrag.kennung": "Task (task_id)",
    "kalender.auftrag.zumEintrag": "to the calendar entry",
    "kalender.auftrag.zumErgebnis": "to the actual result",
    "kalender.auftrag.keiner":
      "No task. This appointment triggers no model work, invitation, external message, renewal or system change.",
    "kalender.auftrag.unzugeordnet":
      "Unassigned: without a responsible person there is no execution task.",

    "kalender.ergebnis.titel": "Actual result",
    "kalender.ergebnis.lauf": "Run (run_id) {{id}}: {{status}}",
    "kalender.ergebnis.zumAuftrag": "belongs to task {{id}}",
    "kalender.ergebnis.keinLauf": "No run: nothing has been carried out here.",
    "kalender.ergebnis.keins": "No result recorded yet.",
    "kalender.ergebnis.erinnerung_zugestellt": "Reminder delivered on {{am}}.",
    "kalender.ergebnis.lauf_abgeschlossen": "Run completed on {{am}}.",
    "kalender.ergebnis.lauf_fehlgeschlagen": "Run failed on {{am}}.",
    "kalender.ergebnis.erinnerungGrenze":
      "This only means the reminder arrived. It does not show that the deadline (for example a certification) was renewed or met.",

    "kalender.aktion.anzeige_entfernen": "Remove from your own view",
    "kalender.aktion.anzeige_zeigen": "Show again",
    "kalender.aktion.lauf_absagen": "Cancel this run",
    "kalender.aktion.serie_pausieren": "Pause series",
    "kalender.aktion.serie_fortsetzen": "Resume series",
    "kalender.aktion.arbeit_abbrechen": "Abort running work",
    "kalender.folgen.titel": "Consequences of “{{aktion}}” before the change",
    "kalender.folgen.wirkung.anzeige_entfernen":
      "The entry disappears only from your own view ({{anzahl}} entry).",
    "kalender.folgen.wirkung.anzeige_zeigen":
      "The entry appears again in your own view ({{anzahl}} entry).",
    "kalender.folgen.wirkung.lauf_absagen":
      "Exactly this one planned run is cancelled ({{anzahl}} entry).",
    "kalender.folgen.wirkung.serie_pausieren":
      "The series is paused; affected entries of the series: {{anzahl}}.",
    "kalender.folgen.wirkung.serie_fortsetzen":
      "The pause of the series is lifted; affected entries of the series: {{anzahl}}.",
    "kalender.folgen.wirkung.arbeit_abbrechen":
      "The work currently running for this run is aborted ({{anzahl}} entry).",
    "kalender.folgen.bleibtTitel": "These stay unchanged:",
    "kalender.folgen.bleibt.eintrag": "the calendar entry itself",
    "kalender.folgen.bleibt.frist": "the deadline",
    "kalender.folgen.bleibt.auftrag": "the task",
    "kalender.folgen.bleibt.serie": "the series and its other dates",
    "kalender.folgen.bleibt.lauf": "planned runs",
    "kalender.folgen.bleibt.andere_personen": "other people's views",
    "kalender.folgen.bleibt.andere_laeufe": "other runs",
    "kalender.folgen.bleibt.ergebnisse": "results already produced",
    "kalender.folgen.bleibt.eintraege": "all entries (nothing is deleted)",
    "kalender.folgen.bleibt.laufende_arbeit": "work already running",
    "kalender.folgen.bleibt.fristen": "deadlines",
    "kalender.folgen.umkehrbar": "Can be undone.",
    "kalender.folgen.endgueltig": "Cannot be undone.",
    "kalender.folgen.bestaetigen": "Confirm",
    "kalender.folgen.abbrechen": "Do not change",
    "kalender.folgen.nicht.allgemein": "This action is not possible here.",
    "kalender.folgen.nicht.keine_steuerung":
      "Only the people responsible for this entry or for the team may do this.",
    "kalender.folgen.nicht.kein_lauf": "There is no run for this entry.",
    "kalender.folgen.nicht.lauf_nicht_geplant": "The run is no longer planned.",
    "kalender.folgen.nicht.lauf_laeuft_nicht": "No work is running at the moment.",
    "kalender.folgen.nicht.keine_serie": "The entry does not belong to a series.",
    "kalender.folgen.nicht.serie_bereits_pausiert": "The series is already paused.",
    "kalender.folgen.nicht.serie_nicht_pausiert": "The series is not paused.",
    "kalender.folgen.nicht.bereits_ausgeblendet": "The entry is already removed from the view.",
    "kalender.folgen.nicht.nicht_ausgeblendet": "The entry is already shown.",
    "kalender.folgen.nicht.ausfuehrung_nicht_angebunden":
      "No execution service is connected; the calendar can neither trigger nor prove this effect.",
    "kalender.folgen.nicht.lauf_nicht_nachgewiesen":
      "The execution record does not know this run today.",
    "kalender.folgen.nicht.serie_nicht_nachgewiesen":
      "The execution record does not know this series today.",
    "kalender.folgen.nicht.serie_fremde_verantwortung":
      "The series contains entries others are responsible for. Only the team owners control the whole series.",
    "kalender.folgen.ausfuehrung":
      "The effect happens in the execution service. The calendar shows it only once the service has confirmed it.",
    "kalender.nichtNachgewiesen": "status not proven",
    "kalender.auftrag.nichtAufgeloest": "not found in the execution record",
    "kalender.herkunft.vorhanden": "from the existing calendar",

    "kalender.form.neu": "New entry",
    "kalender.form.bearbeiten": "Edit entry",
    "kalender.form.titel": "Title",
    "kalender.form.art": "Type",
    "kalender.form.ganztaegig": "All day (date without time, e.g. a deadline)",
    "kalender.form.beginn": "Start",
    "kalender.form.ende": "End (optional)",
    "kalender.form.zone": "Times apply in the local time zone {{zone}}.",
    "kalender.form.notiz": "Note",
    "kalender.form.status": "Status",
    "kalender.form.team": "Team",
    "kalender.form.verantwortlich": "Responsible",
    "kalender.form.verantwortlichIch": "me",
    "kalender.form.verantwortlichOffen": "still open (unassigned)",
    "kalender.form.verantwortlichBleibt": "unchanged (another responsible person)",
    "kalender.form.speichern": "Save",
    "kalender.form.abbrechen": "Cancel",
  },
  nl: {
    "kalender.konto.menue": "Mijn agenda",
    "kalender.titel": "Mijn agenda",
    "kalender.lead":
      "Eigen afspraken, termijnen en taken in dag-, week- en agendaweergave — zonder Outlook of een andere agenda te koppelen.",
    "kalender.ohneKonto": "Opgeslagen in Klarwerk. Een extern account is niet nodig.",
    "kalender.zone": "Tijden in lokale tijdzone: {{zone}}",
    "kalender.laedt": "Wordt geladen …",
    "kalender.neu": "Nieuw item",
    "kalender.leer": "Geen items.",
    "kalender.agenda.leer": "Geen items in de komende 60 dagen vanaf de gekozen dag.",
    "kalender.ganztaegig": "hele dag",
    "kalender.unzugeordnet": "niet toegewezen",
    "kalender.ausgeblendet": "uit de eigen weergave verwijderd",
    "kalender.ausgeblendeteZeigen": "Uit de weergave verwijderde items tonen ({{anzahl}})",
    "kalender.geschuetzt": "Beschermd item",
    "kalender.geschuetztKurz": "Beschermd item",
    "kalender.geschuetztErklaerung":
      "De bron van dit item is niet meer vrijgegeven. Titel, notitie en bronvermelding blijven daarom verborgen; tijd, status en kenmerken blijven zichtbaar.",
    "kalender.bearbeiten": "Bewerken",
    "kalender.loeschen": "Verwijderen",
    "kalender.loeschenFrage":
      "Dit item definitief verwijderen? Dit kan niet ongedaan worden gemaakt. Alleen uit de eigen weergave halen kan met „Uit de eigen weergave verwijderen”.",
    "kalender.loeschenJa": "Definitief verwijderen",

    "kalender.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",
    "kalender.fehler.anmeldung": "De aanmelding is verlopen. Meld je opnieuw aan.",
    "kalender.fehler.weg": "Dit item bestaat niet (meer) of is niet vrijgegeven.",
    "kalender.fehler.steuerung":
      "Alleen de verantwoordelijken voor dit item of voor het team mogen dit.",
    "kalender.fehler.konflikt":
      "Zo lukt het niet: het item is intussen gewijzigd, niet toegewezen of de bron is beschermd. Laad opnieuw.",
    "kalender.fehler.eingabe": "Controleer de gegevens: titel, begin en einde zijn nodig.",

    "kalender.sicht.legende": "Dagelijkse weergave",
    "kalender.sicht.eigen": "Eigen agenda",
    "kalender.sicht.vorhanden": "Bestaande agenda",
    "kalender.sicht.beide": "Beide",
    "kalender.sicht.hinweis":
      "De keuze betreft alleen de weergave. Interne afspraken, termijnen en tijdsturing blijven in elk geval opgeslagen en actief.",

    "kalender.vorhanden.titel": "Bestaande agenda",
    "kalender.vorhanden.verbunden": "Er is een bestaande agenda gekoppeld.",
    "kalender.vorhanden.nichtVerbunden":
      "Geen bestaande agenda gekoppeld. Het koppelen van een externe agenda is een aparte stap; tot die tijd toont dit vlak niets externs.",
    "kalender.vorhanden.internBleibt":
      "Interne termijnen en tijdgestuurde items blijven hier zichtbaar: de externe weergave vervangt noch de interne termijnregistratie noch de interne tijdsturing.",

    "kalender.bereich.legende": "Agenda",
    "kalender.bereich.persoenlich": "Persoonlijk",
    "kalender.bereich.team": "Team",
    "kalender.bereich.privat":
      "Persoonlijke items zijn privé en verschijnen niet in de teamagenda.",
    "kalender.bereich.keinTeam": "Teamitems zijn er pas met een teamlidmaatschap.",
    "kalender.bereich.teamHinweis":
      "Teamitems zijn zichtbaar voor de huidige teamleden; alleen de verantwoordelijken sturen opdrachten.",

    "kalender.ansicht.legende": "Weergave",
    "kalender.ansicht.tag": "Dag",
    "kalender.ansicht.woche": "Week",
    "kalender.ansicht.agenda": "Agenda",
    "kalender.nav.zurueck": "Terug",
    "kalender.nav.heute": "Vandaag",
    "kalender.nav.weiter": "Verder",
    "kalender.nav.tastatur":
      "Toetsenbord: pijl links/rechts wisselt de dag (in de weekweergave de week), Page Up/Down de week, Escape sluit de detailweergave.",
    "kalender.zeitraum.woche": "Week {{von}} – {{bis}}",
    "kalender.zeitraum.agenda": "Agenda vanaf {{von}}",

    "kalender.art.termin": "Afspraak",
    "kalender.art.frist": "Termijn",
    "kalender.art.aufgabe": "Taak",
    "kalender.status.offen": "open",
    "kalender.status.erledigt": "afgerond",
    "kalender.status.abgesagt": "geannuleerd",
    "kalender.herkunft.eigen": "zelf aangemaakt",
    "kalender.herkunft.wissensobjekt": "uit een kennisobject",
    "kalender.serie.pausiert": "gepauzeerd",
    "kalender.serie.aktiv": "actief",
    "kalender.lauf.geplant": "gepland",
    "kalender.lauf.laeuft": "loopt",
    "kalender.lauf.abgeschlossen": "afgerond",
    "kalender.lauf.fehlgeschlagen": "mislukt",
    "kalender.lauf.abgesagt": "geannuleerd",
    "kalender.lauf.abgebrochen": "afgebroken",

    "kalender.detail.waehlen": "Kies een item om het te openen.",
    "kalender.detail.eintrag": "Agenda-item",
    "kalender.detail.schliessen": "Sluiten",
    "kalender.detail.kennung": "Kenmerk (event_id)",
    "kalender.detail.art": "Soort",
    "kalender.detail.zeit": "Tijd",
    "kalender.detail.zone": "Tijdzone",
    "kalender.detail.zoneWert": "getoond in {{anzeige}}, aangemaakt in {{angelegt}}",
    "kalender.detail.herkunft": "Herkomst",
    "kalender.detail.team": "Team {{team}}",
    "kalender.detail.status": "Status",
    "kalender.detail.verantwortlich": "Verantwoordelijk",
    "kalender.detail.verantwortlichIch": "ik",
    "kalender.detail.frist": "Termijn (deadline_id)",
    "kalender.detail.serie": "Reeks (series_id)",

    "kalender.auftrag.titel": "Uit te voeren opdracht",
    "kalender.auftrag.kennung": "Opdracht (task_id)",
    "kalender.auftrag.zumEintrag": "naar het agenda-item",
    "kalender.auftrag.zumErgebnis": "naar het werkelijke resultaat",
    "kalender.auftrag.keiner":
      "Geen opdracht. Deze afspraak start geen modelwerk, uitnodiging, extern bericht, verlenging of systeemwijziging.",
    "kalender.auftrag.unzugeordnet":
      "Niet toegewezen: zonder verantwoordelijke persoon is er geen uitvoeringsopdracht.",

    "kalender.ergebnis.titel": "Werkelijk resultaat",
    "kalender.ergebnis.lauf": "Run (run_id) {{id}}: {{status}}",
    "kalender.ergebnis.zumAuftrag": "hoort bij opdracht {{id}}",
    "kalender.ergebnis.keinLauf": "Geen run: hier is niets uitgevoerd.",
    "kalender.ergebnis.keins": "Nog geen resultaat vastgelegd.",
    "kalender.ergebnis.erinnerung_zugestellt": "Herinnering bezorgd op {{am}}.",
    "kalender.ergebnis.lauf_abgeschlossen": "Run afgerond op {{am}}.",
    "kalender.ergebnis.lauf_fehlgeschlagen": "Run mislukt op {{am}}.",
    "kalender.ergebnis.erinnerungGrenze":
      "Dit betekent alleen: de herinnering is aangekomen. Een verlenging of afronding van de termijn (bijvoorbeeld een certificering) is daarmee niet aangetoond.",

    "kalender.aktion.anzeige_entfernen": "Uit de eigen weergave verwijderen",
    "kalender.aktion.anzeige_zeigen": "Weer tonen",
    "kalender.aktion.lauf_absagen": "Deze run annuleren",
    "kalender.aktion.serie_pausieren": "Reeks pauzeren",
    "kalender.aktion.serie_fortsetzen": "Reeks hervatten",
    "kalender.aktion.arbeit_abbrechen": "Lopend werk afbreken",
    "kalender.folgen.titel": "Gevolgen van „{{aktion}}” vóór de wijziging",
    "kalender.folgen.wirkung.anzeige_entfernen":
      "Het item verdwijnt alleen uit de eigen weergave ({{anzahl}} item).",
    "kalender.folgen.wirkung.anzeige_zeigen":
      "Het item verschijnt weer in de eigen weergave ({{anzahl}} item).",
    "kalender.folgen.wirkung.lauf_absagen":
      "Precies deze ene geplande run wordt geannuleerd ({{anzahl}} item).",
    "kalender.folgen.wirkung.serie_pausieren":
      "De reeks wordt gepauzeerd; betrokken items van de reeks: {{anzahl}}.",
    "kalender.folgen.wirkung.serie_fortsetzen":
      "De pauze van de reeks wordt opgeheven; betrokken items van de reeks: {{anzahl}}.",
    "kalender.folgen.wirkung.arbeit_abbrechen":
      "Het werk dat nu voor deze run loopt, wordt afgebroken ({{anzahl}} item).",
    "kalender.folgen.bleibtTitel": "Ongewijzigd blijven:",
    "kalender.folgen.bleibt.eintrag": "het agenda-item zelf",
    "kalender.folgen.bleibt.frist": "de termijn",
    "kalender.folgen.bleibt.auftrag": "de opdracht",
    "kalender.folgen.bleibt.serie": "de reeks en haar overige data",
    "kalender.folgen.bleibt.lauf": "geplande runs",
    "kalender.folgen.bleibt.andere_personen": "de weergave van andere personen",
    "kalender.folgen.bleibt.andere_laeufe": "andere runs",
    "kalender.folgen.bleibt.ergebnisse": "al ontstane resultaten",
    "kalender.folgen.bleibt.eintraege": "alle items (er wordt niets verwijderd)",
    "kalender.folgen.bleibt.laufende_arbeit": "al lopend werk",
    "kalender.folgen.bleibt.fristen": "termijnen",
    "kalender.folgen.umkehrbar": "Kan ongedaan worden gemaakt.",
    "kalender.folgen.endgueltig": "Kan niet ongedaan worden gemaakt.",
    "kalender.folgen.bestaetigen": "Bevestigen",
    "kalender.folgen.abbrechen": "Niet wijzigen",
    "kalender.folgen.nicht.allgemein": "Deze actie is hier niet mogelijk.",
    "kalender.folgen.nicht.keine_steuerung":
      "Alleen de verantwoordelijken voor dit item of voor het team mogen dit.",
    "kalender.folgen.nicht.kein_lauf": "Bij dit item hoort geen run.",
    "kalender.folgen.nicht.lauf_nicht_geplant": "De run is niet meer gepland.",
    "kalender.folgen.nicht.lauf_laeuft_nicht": "Er loopt op dit moment geen werk.",
    "kalender.folgen.nicht.keine_serie": "Het item hoort bij geen reeks.",
    "kalender.folgen.nicht.serie_bereits_pausiert": "De reeks is al gepauzeerd.",
    "kalender.folgen.nicht.serie_nicht_pausiert": "De reeks is niet gepauzeerd.",
    "kalender.folgen.nicht.bereits_ausgeblendet": "Het item is al uit de weergave verwijderd.",
    "kalender.folgen.nicht.nicht_ausgeblendet": "Het item wordt al getoond.",
    "kalender.folgen.nicht.ausfuehrung_nicht_angebunden":
      "Er is geen uitvoeringsdienst gekoppeld; de agenda kan dit effect niet starten en niet aantonen.",
    "kalender.folgen.nicht.lauf_nicht_nachgewiesen":
      "Het uitvoeringsbewijs kent deze run vandaag niet.",
    "kalender.folgen.nicht.serie_nicht_nachgewiesen":
      "Het uitvoeringsbewijs kent deze reeks vandaag niet.",
    "kalender.folgen.nicht.serie_fremde_verantwortung":
      "Tot de reeks horen items waarvoor anderen verantwoordelijk zijn. Alleen de teamverantwoordelijken sturen de hele reeks.",
    "kalender.folgen.ausfuehrung":
      "Het effect treedt op bij de uitvoeringsdienst. De agenda toont het pas als de dienst het heeft bevestigd.",
    "kalender.nichtNachgewiesen": "stand niet aangetoond",
    "kalender.auftrag.nichtAufgeloest": "niet gevonden in het uitvoeringsbewijs",
    "kalender.herkunft.vorhanden": "uit de bestaande agenda",

    "kalender.form.neu": "Nieuw item",
    "kalender.form.bearbeiten": "Item bewerken",
    "kalender.form.titel": "Titel",
    "kalender.form.art": "Soort",
    "kalender.form.ganztaegig": "Hele dag (datum zonder tijd, bijvoorbeeld een termijn)",
    "kalender.form.beginn": "Begin",
    "kalender.form.ende": "Einde (optioneel)",
    "kalender.form.zone": "Tijden gelden in de lokale tijdzone {{zone}}.",
    "kalender.form.notiz": "Notitie",
    "kalender.form.status": "Status",
    "kalender.form.team": "Team",
    "kalender.form.verantwortlich": "Verantwoordelijk",
    "kalender.form.verantwortlichIch": "ik",
    "kalender.form.verantwortlichOffen": "nog open (niet toegewezen)",
    "kalender.form.verantwortlichBleibt": "ongewijzigd (andere verantwoordelijke persoon)",
    "kalender.form.speichern": "Opslaan",
    "kalender.form.abbrechen": "Annuleren",
  },
} satisfies Textmodul;
