import type { Textmodul } from "./intern/pruefung";
export default {
  praefix: "klarabesprechung.",
  legacySchluessel: [],
  de: {
    "klarabesprechung.segmentiert":
      "PCM-WAV in fortsetzbaren Teilen verarbeiten (16 Bit, 1–2 Kanäle, 8–48 kHz).",
    "klarabesprechung.fortschritt": "{{fertig}} von {{gesamt}} Audioteilen gespeichert",
    "klarabesprechung.fortsetzen": "Nächsten offenen Audioteil verarbeiten",
    "klarabesprechung.pausieren": "Verarbeitung pausieren",
    "klarabesprechung.abbrechen": "Verarbeitung endgültig abbrechen",
    "klarabesprechung.grund.keine_ki":
      "Keine KI ist aktiv. Bereits gespeicherte Teile bleiben erhalten.",
    "klarabesprechung.grund.anbieterfehler":
      "Dieser Teil wurde nicht abgeschlossen. Nach Klärung nur den offenen Rest erneut verarbeiten.",
    "klarabesprechung.grund.angefordert": "Verarbeitung auf deinen Auftrag gestoppt.",
    "klarabesprechung.teilHilfe":
      "Jeder Aufruf verarbeitet einen echten Audioabschnitt. Erst die vollständige Fassung kann als Übergabe, Aufgabe oder gemeinsames Wissen übernommen werden.",
    "klarabesprechung.stand.bereit": "Noch nicht verarbeitet",
    "klarabesprechung.stand.teilweise": "Teilfassung gespeichert",
    "klarabesprechung.stand.laeuft": "Ein Audioteil wird verarbeitet",
    "klarabesprechung.stand.pausiert": "Fortsetzbare Pause",
    "klarabesprechung.stand.fehlgeschlagen": "Teilfehler – Rest offen",
    "klarabesprechung.stand.abgebrochen": "Endgültig abgebrochen – unvollständig",
    "klarabesprechung.stand.abgeschlossen": "Alle Audioteile vollständig gespeichert",
    "klarabesprechung.fristquelle": "Gewählte Originalstellen für Fristen berücksichtigen",
    "klarabesprechung.fristGespeichert":
      "Quelle gespeichert; aktive Regel angewendet. Der tatsächliche Stand steht unten und in Mein Kalender.",
    "klarabesprechung.fristRegelNoetig":
      "Quelle gespeichert. Wähle sie in Mein Kalender aus und richte dort deine Fristenregel ein.",
    "klarabesprechung.fristNurQuelle":
      "Quelle gespeichert; Regelanbindung noch nicht abgeschlossen. Bei Fehler über diesen Weg nachholen.",
    "klarabesprechung.fristenOeffnen": "Fristen in Mein Kalender öffnen",
    "klarabesprechung.transkription":
      "Die Audiodatei mit dem eingerichteten, freigegebenen Transkriptionsdienst verarbeiten.",
    "klarabesprechung.zeit": "{{von}}–{{bis}} ms",
    "klarabesprechung.import": "Berechtigte Besprechung privat importieren",
    "klarabesprechung.hilfe":
      "Notiz oder berechtigte VTT-Fassung, optional mit Originalaudio. Keine Aufnahme. Audio kann auf deinen Verarbeitungsauftrag über den vorhandenen freigegebenen Dienst zeitgebunden transkribiert werden. Fehlende Zeitsegmente bleiben offen. Kennzeichne Beschluss:, Vorschlag:, Abgelehnt:, Widerspruch:, Offen: oder Aufgabe: ausdrücklich.",
    "klarabesprechung.text": "Bereitgestellte Notiz",
    "klarabesprechung.vtt": "Berechtigte VTT-Datei",
    "klarabesprechung.audio": "Berechtigte Audiodatei (optional)",
    "klarabesprechung.datum": "Tatsächliche Meetingzeit mit Offset (optional)",
    "klarabesprechung.zone": "Tatsächliche Zeitzone (optional)",
    "klarabesprechung.berechtigt": "Ich darf genau diesen Inhalt importieren.",
    "klarabesprechung.auswertung": "Besprechungsergebnisse",
    "klarabesprechung.kennzeichnung":
      "Manuelle Quellbindung: keine KI-Auswertung oder fachliche Bestätigung. Ungeklärte Zuständigkeiten bleiben offen.",
    "klarabesprechung.quelle": "Transkriptfassung {{fassung}}",
    "klarabesprechung.zeile": "Quellzeile {{nr}}",
    "klarabesprechung.unsicher": "Unsicher / überlappend – Klärung nötig",
    "klarabesprechung.anhoeren": "An dieser Stelle anhören",
    "klarabesprechung.wiedergabeFehler": "Audio konnte nicht wiedergegeben werden.",
    "klarabesprechung.korrektur": "Hörfehler korrigieren",
    "klarabesprechung.korrekturSpeichern": "Neue Transkriptfassung speichern",
    "klarabesprechung.eigene":
      "Gewählte Folgeaufgaben bewusst selbst übernehmen (keine aus dem Meeting erfundene Zuweisung).",
    "klarabesprechung.fristen":
      "Gewählte Originalstellen als private Fristquelle speichern und einer vorhandenen aktiven Fristenregel hinzufügen. Deren Arten, Zeitzone und Änderungsregel bleiben gültig. Ohne aktive Regel richtet Mein Kalender sie ein. Relative Termine und Normphasen bleiben Klärung.",
    "klarabesprechung.uebernehmen": "Auswahl privat als Übergabe und Aufgaben übernehmen",
    "klarabesprechung.art.entscheidung": "Entscheidung",
    "klarabesprechung.art.vorschlag": "Vorschlag",
    "klarabesprechung.art.abgelehnt": "Abgelehnter Vorschlag",
    "klarabesprechung.art.widerspruch": "Ungelöster Widerspruch",
    "klarabesprechung.art.offen": "Offener Punkt",
    "klarabesprechung.art.aufgabe": "Folgeaufgabe – Zuständigkeit klären",
    "klarabesprechung.art.klaerung": "Klärung / unbestätigter Inhalt",
  },
  en: {
    "klarabesprechung.segmentiert":
      "Process PCM WAV in resumable parts (16-bit, 1–2 channels, 8–48 kHz).",
    "klarabesprechung.fortschritt": "{{fertig}} of {{gesamt}} audio parts saved",
    "klarabesprechung.fortsetzen": "Process the next pending audio part",
    "klarabesprechung.pausieren": "Pause processing",
    "klarabesprechung.abbrechen": "Cancel processing permanently",
    "klarabesprechung.grund.keine_ki": "No AI is active. Previously saved parts are retained.",
    "klarabesprechung.grund.anbieterfehler":
      "This part did not complete. Retry only the pending remainder after resolving the issue.",
    "klarabesprechung.grund.angefordert": "Processing stopped on your instruction.",
    "klarabesprechung.teilHilfe":
      "Each request processes one actual audio section. Only a complete transcript can become a handover, task or shared knowledge.",
    "klarabesprechung.stand.bereit": "Not yet processed",
    "klarabesprechung.stand.teilweise": "Partial transcript saved",
    "klarabesprechung.stand.laeuft": "An audio part is being processed",
    "klarabesprechung.stand.pausiert": "Resumable pause",
    "klarabesprechung.stand.fehlgeschlagen": "Part failed – remainder pending",
    "klarabesprechung.stand.abgebrochen": "Permanently cancelled – incomplete",
    "klarabesprechung.stand.abgeschlossen": "All audio parts saved completely",
    "klarabesprechung.fristquelle": "Consider selected original passages for deadlines",
    "klarabesprechung.fristGespeichert":
      "Source saved; active rule applied. See the actual results below and in My Calendar.",
    "klarabesprechung.fristRegelNoetig":
      "Source saved. Select it in My Calendar and configure your deadline rule there.",
    "klarabesprechung.fristNurQuelle":
      "Source saved; rule connection is not complete. Retry this action after an error.",
    "klarabesprechung.fristenOeffnen": "Open deadlines in My Calendar",
    "klarabesprechung.transkription":
      "Process the audio file with the configured and authorised transcription service.",
    "klarabesprechung.zeit": "{{von}}–{{bis}} ms",
    "klarabesprechung.import": "Import an authorised meeting privately",
    "klarabesprechung.hilfe":
      "Note or authorised VTT transcript, optionally with original audio. No recording. Audio can be transcribed with timestamps by the configured authorised service on your instruction. Missing time segments remain open. Use explicit labels: Beschluss:, Vorschlag:, Abgelehnt:, Widerspruch:, Offen: or Aufgabe:.",
    "klarabesprechung.text": "Provided note",
    "klarabesprechung.vtt": "Authorised VTT file",
    "klarabesprechung.audio": "Authorised audio file (optional)",
    "klarabesprechung.datum": "Actual meeting time with offset (optional)",
    "klarabesprechung.zone": "Actual time zone (optional)",
    "klarabesprechung.berechtigt": "I am authorised to import this content.",
    "klarabesprechung.auswertung": "Meeting results",
    "klarabesprechung.kennzeichnung":
      "Manual source binding: no AI analysis or subject validation. Unclear responsibilities stay open.",
    "klarabesprechung.quelle": "Transcript version {{fassung}}",
    "klarabesprechung.zeile": "Source line {{nr}}",
    "klarabesprechung.unsicher": "Uncertain / overlapping – clarification needed",
    "klarabesprechung.anhoeren": "Listen at this point",
    "klarabesprechung.wiedergabeFehler": "Audio could not be played.",
    "klarabesprechung.korrektur": "Correct a transcription error",
    "klarabesprechung.korrekturSpeichern": "Save a new transcript version",
    "klarabesprechung.eigene":
      "Consciously take selected follow-up tasks yourself (no inferred meeting assignment).",
    "klarabesprechung.fristen":
      "Save selected original passages as a private deadline source and add it to an existing active deadline rule. Its types, time zone and change policy remain in effect. Set up a missing rule in My Calendar. Relative dates and standards phases still need clarification.",
    "klarabesprechung.uebernehmen": "Save selected results privately as handover and tasks",
    "klarabesprechung.art.entscheidung": "Decision",
    "klarabesprechung.art.vorschlag": "Proposal",
    "klarabesprechung.art.abgelehnt": "Rejected proposal",
    "klarabesprechung.art.widerspruch": "Unresolved conflict",
    "klarabesprechung.art.offen": "Open point",
    "klarabesprechung.art.aufgabe": "Follow-up task – clarify responsibility",
    "klarabesprechung.art.klaerung": "Clarification / unconfirmed content",
  },
  nl: {
    "klarabesprechung.segmentiert":
      "PCM-WAV in hervatbare delen verwerken (16 bit, 1–2 kanalen, 8–48 kHz).",
    "klarabesprechung.fortschritt": "{{fertig}} van {{gesamt}} audiodelen opgeslagen",
    "klarabesprechung.fortsetzen": "Volgend open audiodeel verwerken",
    "klarabesprechung.pausieren": "Verwerking pauzeren",
    "klarabesprechung.abbrechen": "Verwerking definitief afbreken",
    "klarabesprechung.grund.keine_ki":
      "Geen AI is actief. Eerder opgeslagen delen blijven behouden.",
    "klarabesprechung.grund.anbieterfehler":
      "Dit deel is niet voltooid. Verwerk na oplossing alleen de open rest opnieuw.",
    "klarabesprechung.grund.angefordert": "Verwerking op jouw verzoek gestopt.",
    "klarabesprechung.teilHilfe":
      "Elke aanvraag verwerkt één echt audiodeel. Alleen een volledig transcript kan als overdracht, taak of gedeelde kennis worden overgenomen.",
    "klarabesprechung.stand.bereit": "Nog niet verwerkt",
    "klarabesprechung.stand.teilweise": "Deeltranscript opgeslagen",
    "klarabesprechung.stand.laeuft": "Een audiodeel wordt verwerkt",
    "klarabesprechung.stand.pausiert": "Hervatbare pauze",
    "klarabesprechung.stand.fehlgeschlagen": "Deelfout – rest open",
    "klarabesprechung.stand.abgebrochen": "Definitief afgebroken – onvolledig",
    "klarabesprechung.stand.abgeschlossen": "Alle audiodelen volledig opgeslagen",
    "klarabesprechung.fristquelle": "Gekozen originele passages voor termijnen gebruiken",
    "klarabesprechung.fristGespeichert":
      "Bron opgeslagen; actieve regel toegepast. Bekijk de werkelijke resultaten hieronder en in Mijn agenda.",
    "klarabesprechung.fristRegelNoetig":
      "Bron opgeslagen. Selecteer deze in Mijn agenda en stel daar je termijnregel in.",
    "klarabesprechung.fristNurQuelle":
      "Bron opgeslagen; regelkoppeling is nog niet voltooid. Herhaal deze actie na een fout.",
    "klarabesprechung.fristenOeffnen": "Termijnen in Mijn agenda openen",
    "klarabesprechung.transkription":
      "Het audiobestand met de ingestelde en toegestane transcriptiedienst verwerken.",
    "klarabesprechung.zeit": "{{von}}–{{bis}} ms",
    "klarabesprechung.import": "Een bevoegd gesprek privé importeren",
    "klarabesprechung.hilfe":
      "Notitie of bevoegd VTT-transcript, eventueel met originele audio. Geen opname. Audio kan in jouw opdracht met tijdstempels door de ingestelde toegestane dienst worden getranscribeerd. Ontbrekende tijdsegmenten blijven open. Gebruik expliciete labels: Beschluss:, Vorschlag:, Abgelehnt:, Widerspruch:, Offen: of Aufgabe:.",
    "klarabesprechung.text": "Aangeleverde notitie",
    "klarabesprechung.vtt": "Bevoegd VTT-bestand",
    "klarabesprechung.audio": "Bevoegd audiobestand (optioneel)",
    "klarabesprechung.datum": "Werkelijke vergadertijd met offset (optioneel)",
    "klarabesprechung.zone": "Werkelijke tijdzone (optioneel)",
    "klarabesprechung.berechtigt": "Ik mag deze inhoud importeren.",
    "klarabesprechung.auswertung": "Vergaderresultaten",
    "klarabesprechung.kennzeichnung":
      "Handmatige bronbinding: geen AI-analyse of inhoudelijke bevestiging. Onduidelijke verantwoordelijkheden blijven open.",
    "klarabesprechung.quelle": "Transcriptversie {{fassung}}",
    "klarabesprechung.zeile": "Bronregel {{nr}}",
    "klarabesprechung.unsicher": "Onzeker / overlappend – verduidelijking nodig",
    "klarabesprechung.anhoeren": "Op deze plek beluisteren",
    "klarabesprechung.wiedergabeFehler": "Audio kon niet worden afgespeeld.",
    "klarabesprechung.korrektur": "Een transcriptiefout corrigeren",
    "klarabesprechung.korrekturSpeichern": "Nieuwe transcriptversie opslaan",
    "klarabesprechung.eigene":
      "Gekozen vervolgtaken bewust zelf overnemen (geen afgeleide vergadertoewijzing).",
    "klarabesprechung.fristen":
      "Gekozen originele passages als privétermijnbron opslaan en aan een bestaande actieve termijnregel toevoegen. Soorten, tijdzone en wijzigingsregel blijven gelden. Stel een ontbrekende regel in Mijn agenda in. Relatieve datums en normfasen blijven onduidelijk.",
    "klarabesprechung.uebernehmen": "Gekozen resultaten privé als overdracht en taken opslaan",
    "klarabesprechung.art.entscheidung": "Besluit",
    "klarabesprechung.art.vorschlag": "Voorstel",
    "klarabesprechung.art.abgelehnt": "Afgewezen voorstel",
    "klarabesprechung.art.widerspruch": "Onopgeloste tegenspraak",
    "klarabesprechung.art.offen": "Open punt",
    "klarabesprechung.art.aufgabe": "Vervolgtaak – verantwoordelijkheid verduidelijken",
    "klarabesprechung.art.klaerung": "Verduidelijking / onbevestigde inhoud",
  },
} satisfies Textmodul;
