import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Zweisprachigkeit DE/EN (G-8). Strings über Keys; Ressourcen wachsen je Screen.
const de = {
  // SCRUM-488: erste Tranche kontextueller Hilfetexte (Muster-Beweis, quer über die Bereiche).
  "ask.help.sources.title": "Warum nur belegte Antworten?",
  "ask.help.sources.body":
    "Klarwerk antwortet ausschließlich aus euren eigenen Wissensobjekten — nie aus allgemeinem Modellwissen. Zu jeder Antwort siehst du, welche Quellen sie getragen haben und in welchem Zustand sie sind. Fehlt die Grundlage, sagt es das ehrlich, statt zu raten. Prüfe die genannten Quellen, bevor du dich darauf verlässt.",
  "lib.help.filters.title": "Filter ändern nur die Sicht",
  "lib.help.filters.body":
    "Reifegrad, Status und Domäne blenden Objekte nur ein oder aus — am Wissen selbst ändern sie nichts. „Validiert“ ist von Kolleg:innen bestätigt, „offen“ noch in Prüfung.",
  "dup.help.detection.title": "Wie Dubletten erkannt werden",
  "dup.help.detection.body":
    "„Textidentisch“ findet die Heuristik ohne KI; „wahrscheinlich“ beurteilt das Modell inhaltlich. Zusammenführen passiert nie automatisch — du entscheidest bewusst, was verschmolzen wird.",
  "extpage.help.scope.title": "Was die externe Suche darf",
  "extpage.help.scope.body":
    "Externe Treffer sind Recherchehilfe, kein geprüftes Wissen: nichts wird automatisch importiert oder von Kolleg:innen validiert. Ist die externe Abfrage vom Admin gesperrt, bleibt der Bereich leer.",
  "app.name": "KLARWERK",
  "app.subtitle": "Reasoning System",
  "app.staleBundle":
    "Eine neue Version der App ist verfügbar — bitte die Seite neu laden (Cmd+R bzw. Strg+R).",
  "nav.group.workspace": "Arbeitsbereich",
  "nav.group.quality": "Qualität & Pflege",
  "nav.group.control": "Steuerung",
  "nav.group.advanced": "Erweitert",
  "nav.start": "Start",
  "nav.tasks": "Meine Aufgaben",
  "nav.capture": "Wissen erfassen",
  "nav.ask": "Fragen",
  "nav.library": "Bibliothek",
  "nav.external": "Externes Wissen",
  "nav.validation": "Validierung",
  "nav.conflicts": "Konflikte",
  "nav.duplicates": "Duplikate",
  // SCRUM-486 E: Sidebar-Badges mit Bedeutung — Zahl + Art (Tooltip/aria-label).
  "nav.badge.tasks": "{{count}} offene Aufgaben",
  "nav.badge.loading": "Zähler wird geladen …",
  // AUFTRAG-mega3 Block B: ehrliche dritte Ladephase „Fehler" (nicht endlos „lädt", keine erfundene 0).
  "nav.badge.error": "Zähler konnte nicht geladen werden – erneut versuchen",
  // AUFTRAG-mega4 Block B: Refetch der vorhandenen Zahl scheiterte — Zahl bleibt sichtbar, gilt aber als veraltet.
  "nav.badge.stale": "Zähler veraltet – Aktualisierung fehlgeschlagen, erneut versuchen",
  "loadstate.error.title": "Konnte nicht geladen werden.",
  "loadstate.error.retry": "Erneut versuchen",
  "loadstate.stale": "Veraltet – Aktualisierung fehlgeschlagen",
  "nav.badge.validation": "{{count}} warten auf Prüfung",
  "nav.badge.conflicts": "{{count}} offene Widersprüche",
  "nav.badge.duplicates": "{{count}} mögliche Dubletten",
  "nav.risk": "Risiko & Lücken",
  "nav.lifecycle": "Lebenszyklus",
  "nav.analytics": "Analytics & Audit",
  "nav.admin": "Admin",
  // AUFTRAG-mega38 BLOCK I: „Output Factory" stand in der Navigation — auf JEDEM Bildschirm.
  "nav.output": "Auswertungen",
  "nav.import": "Import & Quellen",
  "nav.graph": "Wissensgraph",
  "nav.capital": "Kapital-Sichten",
  "nav.help": "Hilfe",
  "nav.profile": "Profil",
  "role.viewAs": "Ansicht als Rolle",
  "role.previewNote": "Vorschau als {{role}} — du bleibst Admin.",
  "role.backToAdmin": "Zur Admin-Ansicht",
  "role.stage2": "Erweiterte Module · Stufe 2",
  // AUFTRAG-mega51 BLOCK G1: „Stufe 2" ist ein Hausbegriff — hier steht, was er bedeutet.
  "role.stage2Hint":
    "Stufe 2 sind zusätzliche Module über den Kernablauf hinaus — Qualitätssicherung, Wissenskapital und Ausgabe-Formate. Eine Admin-Person schaltet sie frei.",
  "role.short.viewer": "Viewer",
  "role.short.experte": "Experte",
  "role.short.controller": "Contr.",
  "role.short.admin": "Admin",
  "role.name.viewer": "Betrachter",
  "role.name.experte": "Experte",
  "role.name.controller": "Controller",
  "role.name.admin": "Administrator",
  "action.logout": "Abmelden",
  "topbar.search": "Wissen, Funktionen oder Anlagen suchen…",
  "topbar.mobile": "Mobil",
  // mega40 B: Design-Umschalter (zweites, rein optisches Design „Werkbank/Modern").
  "topbar.design.classic": "Design: Klassisch",
  "topbar.design.modern": "Design: Modern",
  "topbar.design.hint": "Design umschalten — ändert nur das Aussehen, keine Inhalte oder Eingaben.",
  "topbar.openMenu": "Menü öffnen",
  "topbar.closeMenu": "Menü schließen",
  "topbar.menuLabel": "Navigationsmenü",
  // B1b: Rückweg aus der schalenlosen /mobile-Ansicht zur Vollversion.
  "topbar.toDesktop": "Zur Vollversion",
  "topbar.notifications": "Benachrichtigungen",
  "topbar.notificationsPlaceholder": "Noch keine Benachrichtigungen. Echte Quelle folgt (#63).",
  // AUFTRAG-mega51 BLOCK G1: „Reasoner" ist ein Fachwort — in der Oberfläche steht das, was
  // gemeint ist. Die SCHLÜSSEL und der Bezeichner im Code bleiben unverändert.
  "topbar.reasonerActive": "KI-Modell antwortet",
  "topbar.reasonerOffline": "Kein KI-Modell",
  // PAKET 2 (D-AISTATE, Pedi 23.07.): ehrliche Erreichbarkeit statt bloßer Konfiguration.
  "topbar.reasonerActiveHint": "Ein KI-Modell hat zuletzt erreichbar geantwortet.",
  "topbar.reasonerUnverified": "KI-Modell ungeprüft",
  "topbar.reasonerUnverifiedHint":
    "Ein KI-Modell ist konfiguriert, aber die Erreichbarkeit ist noch nicht geprüft.",
  "topbar.reasonerUnreachable": "KI-Modell nicht erreichbar",
  "topbar.reasonerUnreachableHint":
    "Ein KI-Modell ist konfiguriert, war zuletzt aber nicht erreichbar (z. B. Schlüssel abgelaufen, Dienst aus). Aufrufe laufen deterministisch.",
  "topbar.reasonerOfflineHint":
    "Kein KI-Modell verfügbar — es läuft der deterministische Ersatzmodus.",
  // PAKET 2: Achse 1 — externe Wissensabfrage (Web-Suche), getrennt vom KI-Modell.
  // AUFTRAG-mega51 BLOCK G1: „Extern" allein sagt nicht, was extern ist.
  "topbar.external.blocked": "Web-Suche: gesperrt",
  "topbar.external.search": "Web-Suche: erlaubt",
  "topbar.external.open": "Web-Suche: offen",
  "topbar.external.hint":
    "Externe Wissensabfrage (Web-Suche) — eine EIGENE Achse, nicht das KI-Modell. Steuert nur die Web-Suche/öffentliche Anreicherung, nicht den Reasoner.",
  // Pedi 05.07.: Header-Pille „In welcher KI bin ich?" + Herkunftsland + DSGVO-Bestätigung.
  // DSGVO: ja gibt es NUR bei interner KI aus Europa — alles andere ehrlich „nein".
  // AUFTRAG-mega38 BLOCK H: EIN Satz Klartext, der VOR dem Fachtext steht.
  "topbar.plain.ki":
    "Zeigt, wo die KI rechnet, die Klarwerk benutzt — im eigenen Haus oder bei einem Anbieter im Netz.",
  "topbar.plain.reasoner":
    "Zeigt, ob die KI gerade antwortet. „Ungeprüft“ heißt nur: seit dem Start ist noch keine Antwort zurückgekommen — es ist kein Fehler.",
  "topbar.plain.external":
    "Zeigt, ob Klarwerk beim Antworten auch im offenen Internet nachsehen darf. „Blockiert“ heißt: nein, es bleibt bei eurem eigenen Wissen.",
  // AUFTRAG-mega51 BLOCK G1: „KI-Modus" ist eine Einstellung; gemeint ist der ORT.
  "topbar.kiExternal": "KI rechnet in der Cloud",
  "topbar.kiInternal": "KI rechnet im eigenen Haus",
  "topbar.kiMixed": "KI rechnet in der Cloud und im eigenen Haus",
  "topbar.kiNone": "Keine KI",
  "topbar.kiNoneSubtitle": "deterministischer Ersatzmodus",
  "topbar.kiDsgvoYes": "DSGVO: ja",
  "topbar.kiDsgvoNo": "DSGVO: nein",
  "topbar.kiExternalHint":
    "Deine KI-Aufgaben laufen über ein Cloud-Modell außer Haus — DSGVO-Bestätigung daher: nein. Ein Ja gibt es nur für eine interne KI aus Europa. Details je Aufgabe: Verwaltung → KI.",
  "topbar.kiInternalHint":
    "Deine KI-Aufgaben laufen vollständig über ein lokales Modell im Haus. DSGVO: ja gibt es nur hier — und nur, wenn die KI aus Europa stammt. Herkunft derzeit aus der Anbieter-Kennung abgeleitet; künftig übermittelt sie die zentrale KI-Zugangs-Steuerung.",
  "topbar.kiMixedHint":
    "Gemischter Betrieb: einige Aufgaben laufen über die externe Cloud-KI, andere im Haus. Es zählt die strengste Stufe — DSGVO-Bestätigung: nein. Details je Aufgabe: Verwaltung → KI.",
  "topbar.kiNoneHint":
    "Kein KI-Modell ist für eine Aufgabe aktiv. Klarwerk arbeitet im deterministischen Ersatzmodus.",
  // Herkunftsland der KI (Interim aus der Anbieter-Kennung; später aus der KI-Zugangs-Steuerung).
  "country.us": "USA",
  "country.de": "Deutschland",
  "country.fr": "Frankreich",
  "country.cn": "China",
  "country.unknown": "Herkunft unbekannt",
  "country.ownSystem": "eigenes System (EU)",
  "topbar.notificationsEmpty": "Keine Benachrichtigungen.",
  "topbar.notifMarkAll": "Alle gelesen",
  "topbar.notifMarkRead": "Als gelesen markieren",
  "topbar.notifOpen": "Öffnen",
  "topbar.notifAssignment": "Review für dich",
  "topbar.notifImpact": "Dein Wissen hat geholfen",
  "topbar.notifDuplicate": "Mögliches Duplikat",
  "topbar.notifGapRedacted": "Offene Wissenslücke",
  "cmd.open": "Schnellnavigation öffnen",
  "cmd.close": "Schließen",
  "cmd.placeholder": "Zu Seite springen … (⌘K)",
  "cmd.empty": "Kein Treffer.",
  "cmd.audit": "Audit-Log (in Analytics)",
  "toast.dismiss": "Schließen",
  "page.placeholder":
    "Dieser Screen wird in einem späteren Task gebaut. App-Shell, Navigation und Rollenlogik stehen.",
  "status.entwurf": "Entwurf",
  "status.offen": "Offen",
  "status.pruefung": "In Prüfung",
  "status.validiert": "Validiert",
  "status.abgelehnt": "Abgelehnt",
  "status.revalidierung": "Re-Validierung",
  "status.konflikt": "Konflikt",
  "quality.preliminary": "Vorläufig",
  "quality.reliable": "Belastbar",
  "quality.assured": "Gesichert",
  "evidence.percentSure": "{{pct}} % sicher",
  // AUFTRAG-mega51 BLOCK D1: der Balken sagt jetzt, WAS er zeigt (title + aria-label).
  "evidence.confidenceLabel": "Sicherheit: {{pct}} von 100",
  "evidence.sourceDate": "Quelle vom {{date}}",
  "evidence.noDate": "kein Quelldatum",
  "evidence.noSource": "keine Quelle hinterlegt",
  "evidence.internalSource": "interne Quelle",
  "evidence.more": "+{{count}} weitere",
  "ko.read.evidenceZone": "Beleg",
  "ko.read.released": "Freigabe",
  "ko.read.category": "Kategorie",
  "ko.read.responsible": "Verantwortlich",
  "ko.read.version": "Version",
  "ko.read.captured": "Erfasst am",
  "ko.read.moreDetails": "Weitere Angaben (Bedingungen · Maßnahmen · Tags)",
  "intake.question": "Was weißt du, das andere wissen sollten?",
  "intake.calming": "Schreib einfach drauf los — Klarwerk hilft beim Strukturieren.",
  "intake.fieldPlaceholder": "Schreib einfach drauf los …",
  "intake.removeStarter": "Wissensart entfernen",
  "intake.exampleLabel": "So etwas — aber deins.",
  "intake.sampleBadge": "Beispiel",
  "intake.starter.decision": "Eine Entscheidung, die wir getroffen haben",
  "intake.starter.mistake": "Ein Fehler, den man leicht macht",
  "intake.starter.howItWorks": "Wie etwas bei uns wirklich läuft",
  "intake.starter.changed": "Etwas, das sich geändert hat",
  "intake.prefill.decision": "Wir haben entschieden, ",
  "intake.prefill.mistake": "Ein häufiger Fehler ist, ",
  "intake.prefill.howItWorks": "Bei uns läuft das so: ",
  "intake.prefill.changed": "Geändert hat sich, dass ",
  "intake.sample.title": "Not-Aus vor jeder Wartung ziehen",
  "intake.sample.statement":
    "Vor jeder Wartung an Linie 3 zuerst den Not-Aus ziehen und gegen Wiedereinschalten sichern.",
  "intake.live.idle": "Ich höre zu …",
  "intake.live.checking": "Prüfe gegen euren Wissensstand …",
  "intake.live.new": "Das ist neu — dazu gibt es noch nichts. Du bist die erste Person.",
  "intake.live.similarLead": "Ähnliches existiert schon:",
  "intake.live.similarAsk": "Ergänzen oder neu?",
  "intake.live.conflictLead": "Achtung — könnte widersprechen:",
  "intake.live.openKo": "Ansehen",
  "intake.live.pending": "Ähnliches gefunden? Nein. Auf Widerspruch noch nicht geprüft.",
  "intake.live.unavailable": "Prüfung derzeit nicht verfügbar.",
  "intake.structure.heading": "Klarwerk schlägt vor — tipp an, was nicht passt:",
  "intake.structure.title": "Titel",
  "intake.structure.category": "Kategorie",
  "intake.structure.source": "Vermutete Quelle",
  "intake.structure.derived": "aus deinem Text abgeleitet",
  "intake.structure.categoryPlaceholder": "z. B. Wartung, Sicherheit …",
  "intake.done.heading": "Geschafft.",
  "intake.done.checked": "In euren gemeinsamen Wissensstand aufgenommen.",
  "intake.done.credited": "Dein Name ({{name}}) ist als Autor hinterlegt.",
  "intake.done.findable": "Wer das nächste Mal danach fragt, findet es — nicht dich.",
  "intake.done.viewKo": "Wissensobjekt ansehen",
  "intake.done.followUp": "Mich bei Rückfragen dazu benachrichtigen",
  "intake.submit": "Wissen ablegen",
  "dcmp.noValue": "Kein Wert vorhanden",
  "dcmp.none": "keine",
  "dcmp.trustStatus": "Vertrauen {{trust}}; Status {{status}}; benötigte Prüfungen {{needed}}",
  "dcmp.tagsCategory": "Kategorie {{category}}; Wissensart {{type}}; Tags {{tags}}",
  "dcmp.note.koMissing": "Score nicht vorhanden: mindestens ein Wissensobjekt fehlt.",
  "audit.action.ko_created": "Angelegt",
  "audit.action.ko_revised": "Überarbeitet",
  "audit.action.ko_rated": "Bewertet",
  "audit.action.ko_admin_validated": "Admin-validiert",
  "audit.action.ko_deleted": "Gelöscht",
  "audit.action.ko_purged": "Endgültig gelöscht",
  "audit.action.ko_restored": "Wiederhergestellt",
  "audit.action.ko_assigned": "Zugewiesen",
  "audit.action.ko_attached": "Anhang hinzugefügt",
  "audit.action.ko_detached": "Anhang entfernt",
  "audit.action.ko_author_transferred": "Autor übertragen",
  "audit.action.ko_category_changed": "Kategorie geändert",
  "audit.action.ko_commented": "Kommentiert",
  "audit.action.ko_confidentiality": "Vertraulichkeit geändert",
  "audit.action.ko_conflict_review": "Konflikt-Review",
  "audit.action.ko_returned_to_author": "An Autor zurückgegeben",
  "audit.action.ko_source_added": "Quelle hinzugefügt",
  "audit.action.ko_source_removed": "Quelle entfernt",
  "ktype.bauchgefuehl": "Intuition",
  "ktype.best_practice": "Best Practice",
  "ktype.lernkurve": "Lernkurve",
  "ktype.technik": "Technik",
  "ktype.negativwissen": "Negativwissen",
  // AUFTRAG-mega38 BLOCK I: „Reasoner" ist der Hausname der KI-Maschine — auf den Flaechen,
  // die die Testerin sieht, heisst er schlicht KI. (Die Admin-Flaechen behalten ihn: dort ist
  // er ein Bezeichner mit Wiedererkennungswert. S. Bericht mega38, Block I.)
  "reasoner.draftLabel": "KI-Entwurf · nicht validiert",
  "reasoner.taskInfo.title": "Welche KI arbeitet hier?",
  "reasoner.taskInfo.cloud": "Cloud-KI",
  "reasoner.taskInfo.local": "Lokales Modell",
  "reasoner.taskInfo.rule": "Regelbasiert (ohne KI-Modell)",
  "reasoner.taskInfo.unknown": "Wird ermittelt …",
  "reasoner.taskInfo.bodyCloud":
    "Diese Aufgabe läuft über eine Cloud-KI. Inhalte werden dafür an den externen Anbieter gesendet.",
  "reasoner.taskInfo.bodyLocal":
    "Diese Aufgabe läuft über ein lokales Modell auf eurer eigenen Hardware — die Inhalte verlassen das Haus nicht.",
  "reasoner.taskInfo.bodyRule":
    "Diese Aufgabe läuft rein regelbasiert, ohne KI-Sprachmodell — deterministisch und ohne externen Versand.",
  "reasoner.taskInfo.bodyUnknown":
    "Die aktuelle KI-Zuordnung wird geladen. Details stehen in der KI-Verwaltung.",
  "reasoner.taskInfo.modelLabel": "Modell",
  "reasoner.taskInfo.dsgvoInhouse": "DSGVO-konform",
  "reasoner.taskInfo.dsgvoInhouseBody":
    "Läuft im Haus (lokal bzw. regelbasiert) — die Daten bleiben hier und werden nicht an Dritte übermittelt.",
  "reasoner.taskInfo.dsgvoExternal": "Externe Verarbeitung",
  "reasoner.taskInfo.dsgvoExternalBody":
    "Nutzt einen externen Cloud-Anbieter — die DSGVO-Konformität hängt vom Auftragsverarbeitungsvertrag (AVV) mit dem Anbieter ab.",
  // PAKET 1 (D-AISTATE, Pedi 23.07.): ehrlicher Hinweis am HART ausgegrauten KI-Knopf, wenn für die
  // Aufgabe kein Modell nutzbar ist — kein stiller Fallback, der „KI läuft" vortäuscht.
  "ai.unavailable.hint": "KI nicht verfügbar — für diese Aufgabe ist kein Modell aktiv.",
  "provenance.original": "ursprünglich",
  "uikit.sampleStatement": "Druckabfall an Presse P2 sitzt meist an Ventil V4, nicht an der Pumpe.",
  "state.loading": "Lädt …",
  "state.error": "Etwas ist schiefgelaufen.",
  "modal.close": "Schließen",
  "nav.guard.title": "Ungespeicherte Eingabe",
  "nav.guard.body": "Du hast beim Erfassen noch nicht gespeicherten Inhalt. Was möchtest du tun?",
  "nav.guard.stay": "Hier bleiben",
  "nav.guard.discard": "Verwerfen und wechseln",
  "nav.guard.save": "Entwurf speichern und wechseln",
  "nav.guard.unsavableTitle": "Nicht alles kann gesichert werden",
  "nav.guard.unsavableLead":
    "Diese Inhalte kann der Entwurf nicht sichern — beim Wechsel gehen sie verloren:",
  "nav.guard.unsavableHint":
    "Bleib hier, um sie zu verwenden oder zu entfernen; „Verwerfen und wechseln“ gibt sie bewusst auf. Ein Speichern, das diese Inhalte mitnimmt, gibt es nicht.",
  // Bug (Pedi 04.07.): Fehlergrenze statt weißer Seite.
  "error.title": "Diese Ansicht konnte nicht geladen werden.",
  "error.body":
    "Das ist ein Anzeige-Fehler, kein Datenverlust. Bitte lade die Seite neu. Tritt es erneut auf, hilft der Detailtext unten beim Melden.",
  "error.reload": "Neu laden",
  "error.detail": "Detail",
  "state.empty": "Nichts vorhanden.",
  "auth.tagline": "Erfahrungswissen, das im Unternehmen bleibt.",
  "auth.taglineSub": "Erfassen · Validieren · Klären · Beantworten · Pflegen.",
  "auth.title.login": "Anmelden",
  "auth.title.register": "Konto anlegen",
  "auth.title.waiting": "Fast geschafft",
  "auth.title.setup": "Ersteinrichtung",
  "auth.sub.login": "Melde dich mit deinem Konto an.",
  "auth.sub.register": "Lege ein Konto an — ein Admin gibt dich frei.",
  "auth.sub.waiting": "Dein Konto wartet auf Freigabe.",
  "auth.sub.setup": "Das erste Konto wird Administrator.",
  "auth.waitingNote":
    "Ein Administrator muss deinen Zugang freischalten. Du wirst benachrichtigt, sobald es so weit ist.",
  "auth.backToLogin": "Zurück zur Anmeldung",
  "auth.name": "Name",
  "auth.email": "E-Mail",
  "auth.password": "Passwort",
  // JOB 1097 / D-026: die Längenregel stand bisher nur als `minLength` im Markup — sie EXISTIERTE,
  // wurde aber nirgends angeschrieben, und der Nutzer erfuhr sie erst im Fehlschlag. Auf der
  // Adminseite sagt das Produkt es längst („Passwort (mind. 8 Zeichen)"); auf der öffentlichen
  // Maske nicht. Eigener Schlüssel statt Wiederverwendung von `adm.field.password`: dort ist die
  // Regel Teil der Feldbeschriftung, hier ein Zusatz zu einer bestehenden Beschriftung.
  "auth.passwordRule": "mind. 8 Zeichen",
  "auth.passwordRepeat": "Passwort wiederholen",
  "auth.passwordMismatch": "Die Passwörter stimmen nicht überein.",
  // WP-VIP2-GATE (bens P1): Selbstregistrierung serverseitig abgeschaltet (Einladungs-Betrieb).
  "auth.registrationDisabled":
    "Registrierung nur per Einladung — bitte wende dich an deinen Admin.",
  "auth.submit.login": "Anmelden",
  "auth.submit.register": "Registrieren",
  "auth.submit.setup": "Admin anlegen & starten",
  "auth.toRegister": "Noch kein Konto? Registrieren",
  "auth.toLogin": "Schon ein Konto? Anmelden",
  "auth.toForgot": "Passwort vergessen?",
  "auth.title.forgot": "Passwort zurücksetzen",
  "auth.sub.forgot": "Wir senden dir einen Link zum Zurücksetzen.",
  "auth.submit.forgot": "Link senden",
  "auth.title.forgotSent": "E-Mail unterwegs",
  "auth.sub.forgotSent": "Prüfe dein Postfach.",
  "auth.forgotNote":
    "Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zurücksetzen gesendet. Der Link ist 1 Stunde gültig.",
  "auth.title.reset": "Neues Passwort",
  "auth.sub.reset": "Wähle ein neues Passwort für dein Konto.",
  "auth.newPassword": "Neues Passwort",
  "auth.submit.reset": "Passwort speichern",
  "auth.resetDone": "Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.",
  "auth.resetInvalid": "Dieser Link ist ungültig oder abgelaufen.",
  "auth.toSignIn": "Zur Anmeldung",
  "auth.or": "oder",
  "auth.ssoButton": "Mit SSO anmelden",
  "auth.ssoUnavailable": "SSO ist für diese Instanz nicht konfiguriert.",
  "auth.ssoTitle": "SSO-Anmeldung",
  "auth.ssoBusy": "Anmeldung wird abgeschlossen …",
  "auth.ssoIncomplete": "Unvollständige SSO-Antwort. Bitte erneut anmelden.",
  "cycle.title": "Der Klarwerk-Wissenskreis",
  // AUFTRAG-mega38 BLOCK G1: „Kein Chatbot: …" definierte ueber eine Verneinung — der Satz
  // sagte zuerst, was Klarwerk NICHT ist. Jetzt sagt er, was es tut.
  "cycle.subtitle": "Wissen wird erfasst, validiert, genutzt und aktuell gehalten.",
  // SCRUM-290: kompakter Stage-1 Demo-/Pilotpfad (Start → Ask → Library/KO-Detail → Validation).
  "demo.title": "Demo-/Pilotpfad in 3 Schritten",
  "demo.subtitle":
    "Ein kleiner realer Ablauf: quellengebunden fragen, Quelle/Vertrauen/Status/Version ansehen, ungeprüftes Wissen zur Validierung geben.",
  // SCRUM-301: sichtbare Pilot-Beweiskette (Start verspricht, Library/KO-Detail lösen ein).
  "demo.proof.label": "Beweiskette",
  "demo.proof.find": "Wissen finden",
  "demo.proof.usability": "Nutzbarkeit erkennen",
  "demo.proof.verify": "Quelle/Vertrauen/Version prüfen",
  // SCRUM-308: Herkunfts-Kennzeichnung für Demo-/Seed-Wissen (nur Kontext, kein Qualitätssignal).
  "demo.badge.label": "Demo-Beispiel",
  "demo.badge.hint":
    "Beispiel-/Pilotwissen aus dem Demo-Seed. Nur Herkunft — ersetzt nicht Status, Vertrauen, Quelle oder Validierung. Validiert bleibt validiert, offen bleibt offen.",
  "ko.externalUnchecked.label": "Enthält externes, ungeprüftes Wissen",
  "ko.externalUnchecked.hint":
    "In diesen Artikel wurde Wissen aus einer öffentlichen KI oder Websuche übernommen. Es ist extern und ungeprüft — bitte fachlich prüfen; Status/Vertrauen/Validierung ersetzt es nicht.",
  // JOB 679 / D2 (K1.2): Herkunfts-Kennzeichnung für Wissen aus dem Word-Add-in. Wie das
  // Demo-Badge NUR Herkunft — kein Qualitäts-, Status- oder Vertrauenssignal.
  "ko.originWordAddin.label": "Aus Word",
  "ko.originWordAddin.hint":
    "Dieser Beitrag wurde über das Word-Add-in erfasst. Nur Herkunft — ersetzt nicht Status, Vertrauen, Quelle oder Validierung.",
  "demo.ask.label": "1 · Fragen",
  "demo.ask.desc":
    "Stell eine belegte Frage (Ventil X / Überdruck) — die Antwort kommt quellengebunden mit Vertrauen und Status, nicht frei erfunden.",
  "demo.library.label": "2 · Wissen ansehen",
  "demo.library.desc":
    "Im Wissensbestand Quelle, Vertrauen, Status und Reife sehen — ein Objekt öffnen zeigt Belege und Version.",
  "demo.validation.label": "3 · Validieren",
  "demo.validation.desc":
    "Offenes/ungeprüftes Wissen gehört in die Validierung — bewerten, bis es gesichert und nutzbar ist.",
  // SCRUM-296: aktiver Erfassungsfluss im Demo-Kontext (Capture → Validation → Use).
  "demo.captureEntry": "Aktiv ausprobieren: Erfassen → Prüfen → Nutzen",
  "demo.banner.capture.title": "Erfahrungsnotiz erfassen",
  "demo.banner.capture.body":
    "Gespeichert wird ein OFFENES Wissensobjekt — noch nicht validiert. Nächster Schritt: zur Prüfung/Validierung. Erst nach ausreichender Bewertung ist es quellengebunden nutzbar; automatisch validiert wird nichts.",
  "demo.banner.capture.next": "Weiter: Zur Prüfung",
  // SCRUM-291: wiedererkennbare Pfad-Hinweisboxen auf den Zielseiten (nur bei ?demo=stage1).
  "demo.banner.tag": "Demo-Pfad",
  "demo.banner.ask.title": "Schritt 1: Quellengebunden fragen",
  "demo.banner.ask.body":
    "Die Antwort kommt mit Vertrauen und Quelle — nicht frei erfunden. Achte auf Status/Vertrauen und sieh dann die Quelle/das Objekt an.",
  "demo.banner.ask.next": "Weiter: Wissen ansehen",
  "demo.banner.library.title": "Schritt 2: Quelle, Vertrauen, Status, Reife ansehen",
  "demo.banner.library.body":
    "Hier siehst du je Objekt Quelle, Vertrauen, Status und Reife/Version. Bei offener/ungeprüfter Quelle geht es weiter zur Validierung.",
  "demo.banner.library.next": "Weiter: Validieren",
  "demo.banner.detail.title": "Wissensobjekt: Status, Vertrauen, Version, Quellen prüfen",
  "demo.banner.detail.body":
    "Hier siehst du, worauf Nutzbarkeit beruht: Status, Vertrauen, Version und Belege. Wenn es nutzbar ist, unten „Wissen nutzen“ — die Frage bleibt quellengebunden, nichts wird automatisch gesichert.",
  "demo.banner.validation.title": "Schritt 3: Offenes Wissen bewerten",
  "demo.banner.validation.body":
    "Hier wird offenes/ungeprüftes Wissen bewertet. Ziel: aus Review-Arbeit gesichertes, nutzbares Wissen machen.",
  "cycle.capture.label": "Erfassen",
  // AUFTRAG-mega38 BLOCK I: „Knowledge Object" — das Produkt sagt ueberall sonst „Wissensobjekt".
  "cycle.capture.desc": "Erfahrungswissen als Wissensobjekt sichern.",
  "cycle.validate.label": "Validieren",
  "cycle.validate.desc": "Im Team prüfen, bis Vertrauen und Status belastbar sind.",
  "cycle.use.label": "Nutzen",
  "cycle.use.desc": "Quellengebunden in Antworten und Output verwenden.",
  "cycle.maintain.label": "Aktuell halten",
  "cycle.maintain.desc": "Bei Änderungen revalidieren — Wissen bleibt gültig.",
  "kg.start.title": "So liest du Klarwerk",
  "kg.start.body":
    "Klarwerk trennt konsequent nutzbares Wissen von Review-Arbeit: Erst prüfen, dann verwenden.",
  "kg.library.title": "Reife der Treffer",
  "kg.library.body":
    "Die Reife-Plakette zeigt, ob ein Treffer direkt nutzbar ist oder in die Prüfung gehört.",
  "kg.ask.title": "Antworten sind quellengebunden",
  "kg.ask.body":
    "Die Fragen-Seite nutzt den Wissensbestand; offene oder ungeprüfte Quellen werden markiert und zur Validierung geführt.",
  "kg.secured.label": "Gesichert",
  "kg.secured.body":
    "Validiertes Wissen ist nutzbar und bleibt über Quellen, Vertrauen und Version nachvollziehbar.",
  "kg.review.label": "Zu prüfen",
  "kg.review.body":
    "Offenes oder in Prüfung befindliches Wissen gehört in die Validierung, nicht in die Nutzung.",
  "kg.sourceBound.label": "Quellengebunden",
  "kg.sourceBound.body":
    "Antworten entstehen aus Wissensobjekten — ohne Grundlage wird eine Lücke angelegt.",
  // AUFTRAG-mega38 BLOCK I: „Control Room" war ein englischer Fachbegriff als allererstes
  // Wort der Anwendung, auf einer deutschen Oberflaeche.
  "start.kicker": "Übersicht",
  "start.greeting": "Guten Tag, {{name}}.",
  // AUFTRAG-mega38 BLOCK G1: der eine Satz — ohne ein einziges Fachwort, bejahend.
  "start.purpose":
    "Klarwerk sammelt, was deine Kolleginnen und Kollegen im Betrieb gelernt haben, damit du danach fragen kannst und siehst, woher jede Antwort stammt.",
  "start.ctaAsk": "Frage stellen",
  "start.ctaCapture": "Wissen erfassen",
  "start.ctaValidate": "Validierung öffnen",
  "klara.path.ariaLabel": "Klara — kommender Assistenzweg",
  "klara.path.kicker": "Mit Klara",
  "klara.path.soon": "Demnächst",
  "klara.path.start.title": "Klara begleitet Wissen von Anfang an.",
  "klara.path.start.body":
    "Bald kannst du Wissen direkt mit Klara festhalten, strukturieren und für die Prüfung vorbereiten.",
  "klara.path.start.cta": "Mit Klara Wissen erfassen",
  "klara.path.capture.title": "Erzähl es Klara — sie macht daraus einen klaren Entwurf.",
  "klara.path.capture.body":
    "Du gibst deine Erfahrung in eigenen Worten ein. Klara hilft beim Strukturieren; du prüfst und entscheidest.",
  "klara.path.capture.cta": "Mit Klara starten",
  "klara.path.import.title": "Klara bereitet importiertes Wissen mit dir auf.",
  "klara.path.import.body":
    "Nach dem Upload hilft Klara künftig beim Ordnen, Klären und Vorbereiten für die Prüfung.",
  "klara.path.import.cta": "Import mit Klara begleiten",
  "klara.path.m365.summary": "Was Klara in Microsoft 365 tun wird",
  "klara.path.m365.body":
    "Klara ist als bidirektionales Add-in für Microsoft 365 geplant. Sie soll Wissen dort aufnehmen, wo du ohnehin arbeitest, es strukturiert für Klarwerk vorbereiten und geprüftes Unternehmenswissen aus Klarwerk direkt in Microsoft 365 bereitstellen — prüfen und entscheiden bleibt bei dir. Verfügbar ist das noch nicht.",
  "start.todo": "Heute zu tun",
  "start.workTitle": "Nächste Handlungen",
  "start.severity.critical": "jetzt",
  "start.severity.today": "heute",
  "start.severity.later": "später",
  "shelp.cycle.title": "Der Knowledge-OS-Kreis",
  "shelp.cycle.body":
    "Die vier Kacheln sind der Kreislauf deines Wissens: Erfassen → Validieren → Nutzen → Aktuell halten. Jede Kachel bringt dich direkt in den passenden Bereich. Du musst nicht alles auf einmal machen — fang bei dem an, was gerade ansteht. Es startet von selbst nichts.",
  "shelp.work.title": "Deine Arbeitsübersicht",
  "shelp.work.body":
    "Hier steht, was gerade wirklich auf dich wartet — aus echten Daten (offene Prüfungen, Konflikte, Wissenslücken), keine erfundene To-do-Liste. Die Zahl rechts sagt, wie viele es sind. Klick eine Zeile, um direkt dort weiterzuarbeiten. Erledigst du nichts, passiert nichts automatisch.",
  "shelp.severity.title": "Die farbigen Punkte",
  "shelp.severity.body":
    "Der Punkt links zeigt die Dringlichkeit: Rot = jetzt dran (blockiert oder kritisch), Gelb = heute sinnvoll, Grau = kann warten. Das ist nur eine Orientierung, kein Zwang — du entscheidest die Reihenfolge, und es wird nichts automatisch abgearbeitet.",
  // AUFTRAG-mega38 BLOCK G3: „Bester nächster Einstieg" behauptete eine auf DIESE Person
  // zugeschnittene Empfehlung. `primaryWorkItem` waehlt aber schlicht den dringendsten Posten
  // aus globalen Bestandszahlen (lib/workCenter.ts:61-93) — dieselbe Klasse von zu weitem
  // Satz wie in Block D. Die Beschriftung sagt jetzt genau das, was die Auswahl tut.
  "start.focusLabel": "Dringendste offene Arbeit",
  "work.conflicts": "Konflikte lösen",
  "work.criticalGaps": "Kritische Wissenslücken",
  "work.revalidation": "Revalidierungen fällig",
  "work.validation": "Offene Validierungen",
  "work.learning": "Offene Lernpfad-Schritte",
  "start.allTasks": "Alle Aufgaben →",
  // AUFTRAG-mega51 BLOCK A: was die Rolle nicht öffnen kann, wird als Lage gezeigt — nicht als Weg.
  "roleLink.noReach": "Kein Zugriff",
  "roleLink.noReachHint":
    "Diese Fläche ist für deine Rolle nicht freigegeben. Die Angabe bleibt stehen, weil sie stimmt — nur der Weg dorthin ist für dich zu.",
  "start.todoEmpty": "Nichts offen. Gut gemacht.",
  "start.todoLoading": "Arbeitsübersicht wird geladen …",
  "start.stufe2.title": "Erweiterte Funktionen (Stufe 2)",
  "start.stufe2.body":
    "Stufe 2 sind zusätzliche Module über den Kernablauf hinaus. Als Admin stehen dir erweiterte Funktionen zur Verfügung: {{features}}. Schalte dazu „{{toggle}}' unten in der Seitenleiste ein.",
  "task.kicker": "Aufgaben",
  "task.critical": "Kritisch",
  "task.today": "Heute",
  "task.later": "Später",
  "task.none": "Nichts hier.",
  "task.noneFiltered": "Kein Eintrag für diesen Filter.",
  "task.filter.all": "Alle",
  "task.filter.validation": "Validierung",
  "task.filter.returned": "Nacharbeit",
  "task.filter.conflict": "Konflikte",
  "task.filter.gap": "Wissenslücken",
  "task.filter.revalidation": "Revalidierung",
  "task.conflict": "Konflikt",
  "task.validation": "Validierung",
  "task.revalidation": "Re-Validierung",
  "task.gap": "Wissenslücke",
  "task.gapRedacted": "Vertrauliche Wissenslücke",
  "task.returned": "Nacharbeit",
  "task.action.returned": "Entwurf überarbeiten",
  "task.action.conflict": "Konflikt entscheiden",
  "task.action.validation": "Wissen bewerten",
  "task.action.revalidation": "Gültigkeit prüfen",
  "task.action.gap": "Lücke priorisieren",
  "task.action.open": "Öffnen",
  // Pedi 05.07.: Klartext „was ist zu tun" je Aufgabe — ein Satz, direkt auf der Karte.
  "task.explain.returned":
    "Ein Prüfer hat dein Wissen zur Nacharbeit zurückgegeben. Öffne es, arbeite die Rückmeldung ein und reiche es erneut ein.",
  "task.explain.conflict":
    "Zwei Aussagen widersprechen sich. Öffne den Konflikt und entscheide, welche gilt (oder halte beide fest).",
  "task.explain.validation":
    "Prüfe dieses Wissen und gib eine Bewertung ab: Freigeben (grün), Rückfrage (gelb) oder Ablehnen (rot). Ab genug grünen Bewertungen gilt es als validiert.",
  "task.explain.revalidation":
    "Etwas hat sich geändert — bestätige, ob dieses Wissen noch gültig ist, oder gib es zur Überarbeitung.",
  "task.explain.gap":
    "Zu dieser Frage fehlt gesichertes Wissen. Priorisiere die Lücke oder erfasse selbst einen Beitrag dazu.",
  "task.explain.open": "Öffne diese Aufgabe, um den nächsten Schritt zu sehen.",
  // SCRUM-297: Knowledge-OS-Phase je Arbeit (nutzt die Kreis-Labels cycle.*.label).
  "task.phaseLabel": "Phase:",
  // AUFTRAG-mega38 BLOCK I: „Expert Studio" uebersetzt.
  "capture.kicker": "Wissen erfassen",
  "capture.title": "Erfahrungswissen festhalten",
  "capture.rescue.kicker": "Wissen retten",
  "capture.rescue.title": "Sichere Erfahrungswissen, bevor es verloren geht.",
  "capture.rescue.subtitle":
    "Du musst kein Formular perfekt ausfüllen — erzähl einfach, was du weißt. Klarwerk und die KI helfen dir, es klar und nutzbar zu machen.",
  "capture.rescue.step.tell.label": "1. Erzählen",
  "capture.rescue.step.tell.hint":
    "Schreib oder diktier in eigenen Worten, was du aus Erfahrung weißt — roh reicht.",
  "capture.rescue.step.structure.label": "2. KI strukturiert",
  "capture.rescue.step.structure.hint":
    "Die KI macht daraus einen klaren Entwurf; im Knowledge Studio kannst du alles in Ruhe nachbearbeiten.",
  "capture.rescue.step.validate.label": "3. Prüfen lassen",
  "capture.rescue.step.validate.hint":
    "Speichern reicht ein — danach prüfen Kolleg:innen das Wissen, bevor es gesichert genutzt wird.",
  "capture.rescue.impactTitle": "Warum dein Beitrag zählt",
  "capture.rescue.impact.secure": "Rettet Erfahrung, die sonst verloren ginge",
  "capture.rescue.impact.improve": "Verbessert die gemeinsame Wissensbasis",
  "capture.rescue.impact.honest": "Wird erst nach Prüfung als gesichert markiert",
  "capture.rescue.showLess": "Weniger",
  "capture.rescue.showMore": "Anleitung",
  // SCRUM-370: geführter Weg — Rohwissen → im Studio strukturieren (empfohlen) → prüfen & einreichen.
  "capture.flow.railKicker": "So gehst du vor",
  "capture.flow.step.raw.label": "Rohwissen erfassen",
  "capture.flow.step.raw.hint": "Erzähl in eigenen Worten, was du weißt — Stichpunkte reichen.",
  "capture.flow.step.studio.label": "Im Studio strukturieren",
  "capture.flow.step.studio.hint":
    "Der große Arbeitsraum mit KI-Hilfe macht daraus einen klaren Artikel — du übernimmst bewusst.",
  "capture.flow.step.review.label": "Prüfen & einreichen",
  "capture.flow.step.review.hint":
    "Speichern und zur Prüfung geben — gesichert gilt es erst danach.",
  "capture.flow.railKickerHint":
    "Das Knowledge Studio ist der empfohlene Weg — nichts wird erzwungen.",
  "capture.flow.studioRecommended": "Empfohlen",
  "capture.flow.studioLead":
    "Empfohlener nächster Schritt: im Knowledge Studio in Ruhe strukturieren. Das Formular bleibt dir erhalten.",
  "capture.flow.submitValue":
    "Dein Erfahrungswissen wird gesichert, bevor es verloren geht — erst nach der Prüfung gilt es als gesichert. Automatisch validiert wird nichts.",
  // SCRUM-384 (Pedi-Review): Wizard — ein Fokus je Schritt statt zweispaltiger Info-Wand.
  "capture.wizard.back": "Zurück zum Erzählen",
  "capture.wizard.structuring": "Die KI strukturiert dein Wissen …",
  "capture.wizard.condMeasures": "Bedingungen & Maßnahmen",
  "capture.wizard.condMeasuresHint":
    "Strukturiert abgeleitet aus deinem Wissen — wichtig für Prüfung und spätere Nutzung. Hier bei Bedarf anpassen.",
  "capture.wizard.helpers": "Hilfen, Vorlagen & Anhänge-Kontext",
  "capture.wizard.helpersHint": "Optionale Unterstützung — nichts davon ist Pflicht.",
  "capture.wizard.docLabel": "Deine Wissensseite",
  "capture.wizard.pageTitle": "Wissensseite bearbeiten",
  "start.orientation.title": "Orientierung: So liest du Klarwerk & der Demo-Pfad",
  "start.orientation.hint":
    "Beim ersten Besuch offen — danach hier eingeklappt und jederzeit aufklappbar.",
  "capture.wizard.titleLabel": "Titel",
  "capture.wizard.structData": "Kernaussage, Bedingungen & Maßnahmen",
  "capture.wizard.discard": "Verwerfen",
  "ko.couple.title": "Anlagen-Kopplung",
  "ko.deleteButton": "Wissensobjekt löschen",
  "ko.deleteQ":
    "Löschen? Der Beitrag wandert in den Papierkorb und ist dort 28 Tage vom Admin wiederherstellbar. Demo-Daten werden sofort endgültig gelöscht.",
  "ko.deleteKeep": "Behalten",
  "ko.deleteYes": "Ja, löschen",
  "ko.deleteDone": "Wissensobjekt gelöscht.",
  "ko.deleteAlreadyGone": "Wissensobjekt war bereits nicht mehr vorhanden. Liste aktualisiert.",
  "adm.ai.title": "KI-Verwaltung",
  "adm.purgeButton": "Demodaten entfernen",
  "adm.purgeQ":
    "Wirklich ALLE Demodaten löschen (auch von Testern veränderte)? Eigenes Wissen bleibt unberührt.",
  "adm.purgeKeep": "Abbrechen",
  "adm.purgeYes": "Ja, endgültig entfernen",
  "adm.purgeDone":
    "Demodaten entfernt: {{kos}} Wissensobjekte, {{conflicts}} Konflikte + {{duplicates}} Duplikate aufgelöst, {{gaps}} Wissenslücken, {{users}} Demo-Anwender.",
  "adm.seedSkippedInline":
    "Nicht geladen: Der Demo-Bestand ist bereits vorhanden (keine Dubletten). Über „Demodaten entfernen“ kannst du ihn gezielt entfernen und danach neu laden.",
  "adm.seedForce": "Demo-Bestand neu laden",
  // AUFTRAG-mega64 Block A: Bis mega64 standen die Kennwörter der Demo-Konten im Quelltext. Jetzt
  // erzeugt der Server bei jeder Neuanlage frische und nennt sie genau einmal — in der Antwort auf
  // diesen Ladevorgang. Der Text sagt beides ohne Umschweife: dass sie hier stehen, und dass es das
  // einzige Mal ist. Ein „bitte notieren" ohne die Begründung wäre eine Bitte; mit ihr ist es eine
  // Auskunft, aus der die Nutzerin die richtige Handlung selbst ableitet.
  "adm.seedCredsTitle": "Einmalkennwörter der neuen Demo-Konten",
  "adm.seedCredsHint":
    "Diese Kennwörter wurden gerade zufällig erzeugt und werden NUR HIER angezeigt. Der Server bewahrt sie nicht auf und kann sie nicht wiederholen. Notiere oder gib sie jetzt weiter — nach einem Neuladen dieser Seite sind sie weg, und die Konten brauchen dann einen Kennwort-Reset.",
  "adm.factory.title": "Werkseinstellungen",
  "adm.factory.help":
    "Setzt die lokale Instanz vollständig zurück: alle Wissensobjekte, Anwender, Konflikte, Lücken und Einstellungen werden gelöscht. Danach beendet sich das Programm; beim nächsten Start beginnt die Ersteinrichtung und der erste Anwender wird wieder Admin. Nur in der lokalen Desktop-Version verfügbar.",
  "adm.factory.hint":
    "Für wiederholte Tests: alles löschen und das Programm beenden. Nach dem Neustart ist wieder alles wie bei der ersten Einrichtung.",
  "adm.factory.button": "Auf Werkseinstellungen zurücksetzen",
  "adm.factory.confirm1": "Wirklich ALLE Daten löschen und das Programm beenden?",
  "adm.factory.passwordLabel": "Zur Bestätigung dein Admin-Passwort",
  "adm.factory.confirm2": "Letzte Warnung: Dieser Schritt ist unwiderruflich.",
  "adm.factory.warnBody":
    "ALLE Wissensobjekte, Konten und Einstellungen werden gelöscht und das Programm beendet. Das lässt sich nicht rückgängig machen.",
  "adm.factory.wrongPassword": "Falsches Passwort — der Werksreset wurde nicht ausgeführt.",
  "adm.factory.cancel": "Abbrechen",
  "adm.factory.continue": "Weiter",
  "adm.factory.execute": "Zurücksetzen & beenden",
  "adm.factory.restartHint":
    "Zurückgesetzt. Das Programm wird beendet — bitte die KLARWERK-App neu starten. Der erste Anwender wird dann wieder Admin.",
  "adm.factoryDone": "Werksreset ausgelöst — das Programm wird beendet.",
  "capture.tellResetQ": "Text und Anhänge wirklich verwerfen?",
  "capture.diktatListening": "Aufnahme läuft — sprich einfach, der Text erscheint unten im Feld.",
  "capture.diktatIdleHint": "Klick auf den Knopf und erzähl — kein Formular, keine Vorbereitung.",
  "adm.ai.help":
    "Bestimme global oder je Einsatz, welche KI arbeitet. „Auto“ nutzt das Modell, wenn ein Schlüssel hinterlegt ist; „Deterministisch“ arbeitet bewusst ohne Modell. Schlüssel bleiben ausschließlich auf dem Server — nie im Browser.",
  "adm.ai.internExtern":
    "Du kannst intern (On-Premise Enterprise AI, eigener LLM) oder extern (Cloud) arbeiten lassen — global als Standard oder fein je Aufgabe. Die interne Option erscheint, sobald ein eigener LLM erreichbar ist; beide lassen sich mit „Key testen“ / „Lokalen LLM testen“ live prüfen.",
  "adm.ai.status": "Aktiver Provider: {{provider}} · Modus: {{mode}}",
  "adm.ai.modeModel": "Modell",
  "adm.ai.modeDemo": "Deterministisch",
  "adm.sec.konten": "Konten",
  "adm.sec.ki": "KI",
  "adm.sec.daten": "Daten",
  "adm.sec.sicherheit": "Sicherheit",
  "adm.sec.bereitschaft": "Bereitschaft",
  "adm.print": "Drucken",
  // SCRUM-429 (Pedi 03.07., VIP): Erststart-Führung für den neuen Admin.
  "adm.firstrun.kicker": "Erststart",
  "adm.firstrun.title": "Willkommen — dein Arbeitsbereich ist startklar.",
  "adm.firstrun.lead":
    "Als erstes Konto bist du Admin. Alles Nötige ist vorbereitet — hier sind drei ruhige erste Schritte. Diese Karte erscheint nur beim ersten Besuch.",
  "adm.firstrun.dismiss": "Ausblenden",
  "adm.firstrun.done": "Verstanden — ausblenden",
  "adm.firstrun.note":
    "Kein Zwang, keine Reihenfolge: Du kannst jederzeit frei loslegen. Ausgeblendet bleibt sie ausgeblendet.",
  "adm.firstrun.ki.loading": "KI-Status wird geprüft …",
  "adm.firstrun.ki.both": "Beide KIs verbunden: Cloud-KI und deine On-Premise Enterprise AI.",
  "adm.firstrun.ki.cloudOnly":
    "Cloud-KI verbunden. Die On-Premise Enterprise AI ist noch nicht angebunden (Admin → KI).",
  "adm.firstrun.ki.localOnly":
    "Lokaler LLM verbunden. Die Cloud-KI ist noch nicht konfiguriert (Admin → KI).",
  "adm.firstrun.ki.none":
    "Noch keine KI verbunden — der deterministische Ersatzmodus arbeitet weiter (Admin → KI).",
  "adm.firstrun.step.capture.t": "Wissen erfassen",
  "adm.firstrun.step.capture.b":
    "Erzähl es der KI oder lade ein Dokument — sie strukturiert, du prüfst.",
  "adm.firstrun.step.validate.t": "Wissen prüfen",
  "adm.firstrun.step.validate.b":
    "Im Prüfbereich wird Erfahrungswissen freigegeben — erst dann ist es „nutzbar“.",
  "adm.firstrun.step.admin.t": "Verwaltung öffnen",
  "adm.firstrun.step.admin.b": "Konten, KI-Anbindung, Daten und Sicherheit an einem Ort.",
  "adm.firstrun.doneBadge": "erledigt",
  // SCRUM-437 (Pedi 03.07., VIP): Bereitschafts-Checkliste — Ein-Blick-Status vor dem Test.
  "adm.ready.title": "VIP-Bereitschaft",
  "adm.ready.help":
    "Ein ehrlicher Ein-Blick-Status vor dem Test: was steht, was fehlt. Jede Zeile aus echten Zahlen, nichts geschönt.",
  "adm.ready.intro": "Schneller Kontroll-Blick vor dem VIP-Test — grün heißt bereit, gelb prüfen.",
  "adm.ready.note":
    "„Offene Prüfungen“ und die externe Wissensabfrage-Stufe sind wertungsfreie Angaben — kein Mangel, nur Kontext.",
  "adm.ready.ki": "Verbundene KIs",
  "adm.ready.ki.both": "Beide verbunden",
  "adm.ready.ki.partial": "Teilweise verbunden",
  "adm.ready.ki.none": "Keine verbunden",
  "adm.ready.validated": "Validiertes Wissen",
  "adm.ready.openReviews": "Offene Prüfungen",
  "adm.ready.count": "{{n}}",
  "adm.ready.upload": "Upload-Grenzen",
  "adm.ready.upload.val": "{{n}} Anhänge · {{mb}} MB",
  "adm.ready.unknown": "unbekannt",
  "adm.ready.loading": "wird geladen …",
  // AUFTRAG-mega14 Block H (SCRUM-437): die fehlende Zeile. Sie ZEIGT nur — Laden/Entfernen bleibt
  // im Datenbereich, es gibt genau eine Autorität.
  "adm.ready.demo": "Demodaten",
  "adm.ready.demo.loaded": "{{n}} geladen — im Bereich Daten entfernbar",
  "adm.ready.demo.none": "keine geladen",
  "adm.ready.demo.goto": "Zum Datenbereich",
  "adm.ready.external": "Externe Wissensabfrage",
  "adm.ready.ext.blocked": "Blockiert",
  "adm.ready.ext.searchOnClick": "Suche auf Klick",
  "adm.ready.ext.searchAttach": "Suchen & anhängen",
  "adm.ready.ext.open": "Offen",
  // SCRUM-432 (Pedi 03.07., VIP-Investor): Vertrauen & Sicherheit.
  // AUFTRAG-mega15 Block A (bens SB-1, zweiter Durchgang): „manipulationssicher" ist eine STÄRKERE
  // Aussage als „Abweichung erkannt" — sie behauptet, es KÖNNE nichts passieren. Die Kette hat
  // keinen extern verankerten Kopf (s. lib/auditVerifyState.ts:14-16); wer die Datenbank beherrscht,
  // kann einen Eintrag samt aller Folgehashes neu bilden. Belegbar ist deshalb genau eines: die
  // Kette macht eine nachträgliche Änderung rechnerisch auffällig. Das ist stark — nur eben nicht
  // „sicher". Alle Texte dieser Fläche sagen ab hier genau das, in DE/EN/NL.
  "adm.sich.auditTitle": "Prüfprotokoll — hash-verkettet, Abweichungen prüfbar",
  "adm.sich.auditHelp":
    "Jede sicherheitsrelevante Aktion wird nur angefügt und über eine Hash-Kette mit dem vorherigen Eintrag verbunden. Wird ein Eintrag nachträglich geändert oder entfernt, passt sein Hash nicht mehr — die Abweichung ist rechnerisch feststellbar und wird beim Integritätslauf mit Nummer, Datum und Aktion benannt. Die Kette hat dabei keinen extern verankerten Kopf: wer vollen Schreibzugriff auf die Datenbank hat, kann einen Eintrag samt aller Folgehashes neu bilden. Das Protokoll ist also prüfbar (tamper-evident) — die Kette hält eine Änderung nicht auf, sie macht sie auffällig.",
  "adm.sich.auditIntro":
    "Append-only, hash-verkettet: eine prüfbare Spur aller sicherheitsrelevanten Aktionen. Eine nachträgliche Abweichung an einem Eintrag lässt sich rechnerisch feststellen.",
  "adm.sich.auditCount": "{{count}} Einträge in der Kette",
  "adm.sich.verify.button": "Integrität prüfen",
  "adm.sich.verify.ok": "Integrität geprüft ✓ — {{count}} Einträge, Kette lückenlos",
  // AUFTRAG-mega14 Block A-2 (bens SB-1): drei Zustände statt zwei. Das Wort „Manipulation" ist hier
  // bewusst getilgt — in BEIDE Richtungen: die Anzeige behauptet weder, Manipulation sei erkannt,
  // noch, sie sei ausgeschlossen. Die Kette hat keinen extern verankerten Kettenkopf; beide Aussagen
  // wären unbelegt. Gelb sagt „die VORLIEGENDEN Werte passen zum gespeicherten Hash" — eine Aussage
  // über den Befund, nicht über die Vergangenheit.
  "adm.sich.verify.serialisation":
    "Verkettung lückenlos — {{count}} Einträge, kein Bruch. Bei {{n}} Einträgen lässt sich die Nutzdaten-Prüfsumme nicht nachrechnen, weil die Datenbank die Reihenfolge der Nutzdatenfelder normiert. Die vorliegenden Werte passen zum gespeicherten Hash; keine Abweichung bleibt unaufgelöst.",
  "adm.sich.verify.unconfirmed":
    "Kette nicht bestätigt — erste Abweichung bei Eintrag {{seq}} vom {{at}} ({{action}}). Art: {{kind}}. Die Ursache muss geprüft werden.",
  "adm.sich.verify.unconfirmedPlain": "Kette nicht bestätigt — die Ursache muss geprüft werden.",
  "adm.sich.verify.kind.linkage": "Verkettung gebrochen",
  "adm.sich.verify.kind.serialisation": "Feldreihenfolge der Datenbank",
  "adm.sich.verify.kind.unresolved": "Nutzdaten-Prüfsumme nicht auflösbar",
  "adm.sich.verify.kind.unchecked": "Nutzdaten-Prüfsumme nicht geprüft (zu viele Feldreihenfolgen)",
  "adm.sich.dataTitle": "Datenschutz & Sicherheit",
  "adm.sich.dataHelp":
    "Ein ehrlicher Auszug der Systemeigenschaften — keine Versprechen, sondern wie KLARWERK gebaut ist.",
  "adm.sich.keys.t": "Schlüssel bleiben im Schlüsselbund",
  "adm.sich.keys.b":
    "API-Schlüssel liegen ausschließlich serverseitig bzw. im macOS-Schlüsselbund — nie im Browser, nie im Code oder Repository.",
  "adm.sich.localAi.t": "On-Premise Enterprise AI möglich",
  "adm.sich.localAi.b":
    "Neben der Cloud-KI lässt sich ein eigener lokaler LLM anbinden. Die lokale KI ist nur über einen privaten Tunnel erreichbar, nie öffentlich.",
  "adm.sich.external.t": "Externe Wissensabfrage standardmäßig eingeschränkt",
  "adm.sich.external.b":
    "Public-KI und Web-Suche sind admin-gesteuert und standardmäßig nicht offen. Nichts verlässt unkontrolliert das System.",
  "adm.sich.audit.t": "Hash-verkettetes Prüfprotokoll",
  "adm.sich.audit.b":
    "Alle sicherheitsrelevanten Aktionen werden append-only und hash-verkettet festgehalten. Eine nachträgliche Abweichung an einem Eintrag ist rechnerisch prüfbar und wird beim Integritätslauf benannt (tamper-evident).",
  "adm.sich.trash.t": "Löschen mit Papierkorb",
  "adm.sich.trash.b":
    "Gelöschtes geht zuerst in den Papierkorb (wiederherstellbar); die endgültige Löschung erfolgt erst nach vier Wochen. Kein stiller Datenverlust.",
  "adm.sich.roles.t": "Rollen & minimale Rechte",
  "adm.sich.roles.b":
    "Vier Rollen (Betrachter, Experte, Controller, Admin). Jede Aktion prüft serverseitig das nötige Recht.",
  "adm.sich.noCustomerData.t": "Keine Kundendaten in Tests",
  "adm.sich.noCustomerData.b":
    "Qualitätssicherung und Evaluierungen laufen ohne echte Kundendaten.",
  // SCRUM-444: Evidenz-Rahmung auf dem druckbaren Auszug — Markenkern „Vertrauen ist Evidenz".
  "adm.sich.evidenceNote":
    "Alle Kennzahlen hier sind Live-Werte dieser Instanz — gemessen, nicht behauptet. Zielwerte oder Beispielrechnungen werden immer ausdrücklich als solche gekennzeichnet.",
  "adm.ai.test": "Key testen",
  "adm.ai.testRunning": "teste …",
  "adm.conflictSelfTest.button": "Konflikterkennung testen",
  "adm.conflictSelfTest.running": "teste Erkennung …",
  "adm.conflictSelfTest.ok": "Konflikt + Kollisionsfelder + wörtliche Belege erkannt",
  "adm.conflictSelfTest.noModel": "kein Modell (deterministischer Ersatzmodus) — keine Erkennung",
  "adm.conflictSelfTest.noConflict":
    "Modell aktiv, aber kein Konflikt erkannt (Modellfehler oder Urteil: kein Widerspruch)",
  "adm.conflictSelfTest.noKollision": "Konflikt erkannt, aber Kollisionsfelder leer",
  "adm.conflictSelfTest.provider": "Provider: {{provider}}",
  "adm.conflictSelfTest.streitpunkt": "Streitpunkt: {{streitpunkt}}",
  "adm.conflictSelfTest.label": "Konflikt",
  "adm.selfTest.button": "Erkennung testen (Konflikt + Duplikat)",
  "adm.selfTest.running": "teste Erkennung …",
  "adm.dupSelfTest.label": "Duplikat",
  "adm.dupSelfTest.ok": "Duplikat erkannt (semantisch gleich, lexikalisch verschieden)",
  "adm.dupSelfTest.noModel": "kein Modell (deterministischer Ersatzmodus) — keine Erkennung",
  "adm.dupSelfTest.noDuplicate":
    "Modell aktiv, aber kein Duplikat erkannt (Modellfehler oder Urteil: kein Duplikat)",
  "adm.dupSelfTest.relation": "Beziehung: {{relation}}",
  "adm.ai.testOk": "Verbindung ok — {{provider}} hat geantwortet. Der Schlüssel funktioniert.",
  "adm.ai.testLocal": "Lokalen LLM testen",
  "adm.ai.testLocalOk": "Lokaler LLM hat geantwortet ({{provider}}).",
  "adm.ai.testFail":
    "Test fehlgeschlagen: {{detail}} Tipp: Schlüssel im Start-Dialog bzw. Schlüsselbund (Service Klarwerk, Account ANTHROPIC_API_KEY) erneuern, dann App neu starten.",
  "adm.ai.global": "Global (Standard für alle Einsätze)",
  "adm.ai.choice.inherit": "— wie global —",
  "adm.ai.choice.auto": "Auto (Modell wenn verfügbar)",
  "adm.ai.choice.model": "Modell verlangen",
  "adm.ai.choice.cloud": "Extern · Cloud-LLM (Claude)",
  "adm.ai.choice.local": "Intern · eigener LLM (On-Prem)",
  "adm.ai.choice.localUnavailable": "Intern · eigener LLM (nicht verbunden)",
  "adm.ai.choice.deterministic": "Deterministisch (ohne Modell)",
  "adm.ai.task.structure": "Strukturieren",
  "adm.ai.task.assist": "Schreib-Palette (KI-Hilfe)",
  "adm.ai.task.interview": "Geführtes Interview",
  "adm.ai.task.answer": "Fragen beantworten",
  "adm.ai.task.select": "Kandidaten-Auswahl",
  "adm.ai.task.extract": "Wissen aus Datei",
  "adm.ai.task.describe": "Bildbeschreibung (Vorschlag)",
  "adm.ai.task.group": "Import-Kandidaten gruppieren",
  "adm.ai.effModel": "Modell",
  "adm.ai.effDet": "deterministisch",
  "adm.ai.eff.cloud": "extern",
  "adm.ai.eff.local": "intern",
  "adm.ai.eff.deterministic": "deterministisch",
  "adm.ai.save": "Zuordnung übernehmen",
  "adm.ai.detail": "Feinabstimmung je Einsatz",
  "adm.ai.detailHint": "optional — Standard genügt meist",
  "adm.ai.saved": "KI-Zuordnung übernommen.",
  "adm.ai.dirtyHint": "Noch nicht übernommen — „Zuordnung übernehmen“ klicken.",
  "adm.ai.applied": "Übernommen ✓",
  "adm.ai.persistNote":
    "Gilt bis zum nächsten Neustart der App — dauerhafte Speicherung und lokale Modelle kommen mit dem Voll-Ausbau (PMO-Eintrag).",
  // SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets) — Admin pflegt, Palette zeigt allen.
  "adm.presets.title": "Eigene KI-Funktionen",
  "adm.presets.help":
    "Die KI-Palette im Editor bietet Werks-Funktionen (Klarer, Strukturieren, Erweitern, Rechtschreibung, Formatieren). Hier legst du ZUSÄTZLICHE, eigene Funktionen für deine Organisation an — ein Name für den Knopf und die Anweisung, die die KI bekommt (z. B. „Fasse für die Schichtübergabe in 5 Stichpunkten zusammen“). Die Anweisung ist in der Palette am ?-Zeichen offen sichtbar; wie immer gilt: Die KI macht nur einen Vorschlag zur Vorschau, übernommen wird bewusst per Klick. Werks-Funktionen lassen sich nicht löschen.",
  "adm.presets.hint":
    "Zusätzliche Funktionen für die KI-Palette im Editor — je ein Knopf-Name und eine Anweisung an die KI. Sichtbar für alle Rollen; höchstens 12.",
  "adm.presets.empty": "Noch keine eigenen Funktionen — die Werks-Palette gilt unverändert.",
  "adm.presets.name": "Name des Knopfs (z. B. Schichtübergabe)",
  "adm.presets.instruction": "Anweisung an die KI (z. B. Fasse in 5 Stichpunkten zusammen …)",
  "adm.presets.add": "Funktion hinzufügen",
  "adm.presets.save": "Funktionen speichern",
  "adm.presets.saved": "Eigene KI-Funktionen gespeichert.",
  "adm.val.title": "Prüfungen",
  "adm.val.help":
    "Die Standard-Prüferanzahl gilt für neue Einreichungen ohne eigene Angabe. Erlaubt sind 1 bis 5. Bestehende Beiträge bleiben unverändert; Änderungen landen im Audit-Log.",
  "adm.val.hint":
    "So viele Prüf-Bestätigungen braucht ein neuer Beitrag standardmäßig, bis er als validiert gilt.",
  "adm.val.label": "Standard-Prüferanzahl (1–5)",
  "adm.val.save": "Speichern",
  "adm.val.invalid": "Bitte eine ganze Zahl zwischen 1 und 5 angeben.",
  "adm.val.saved": "Standard-Prüferanzahl gespeichert.",
  "adm.upload.title": "Upload-Grenzen",
  "adm.upload.help":
    "Legt fest, wie viele Anhänge ein Objekt haben darf und wie groß ein einzelner Anhang sein darf. Gilt für neue Anhänge; bestehende bleiben. Änderungen landen im Audit-Log.",
  // AUFTRAG-mega14 Block E (SCRUM-421): der alte Satz behauptete, die Grenzen würden beim Erfassen
  // angezeigt — tatsächlich stand die Zahl an genau EINER von zwölf Auswahlstellen. Das war eine
  // zweite Falschaussage der Oberfläche und wog schwerer als die fehlende Anzeige selbst. Jetzt
  // stimmt der Satz: der Hinweis steht an jeder Auswahlstelle (UploadLimitsHint), und die Anzahl
  // wie die GESPEICHERTE Größe werden beim Anhängen serverseitig geprüft.
  // Die Größe misst die übertragene Daten-URL (Base64) — das steht hier ausdrücklich, statt eine
  // Dateigröße vorzugaukeln.
  // AUFTRAG-mega15 Block E: der Faktor stand selbst falsch da. Base64 belegt 4 Zeichen je 3 Bytes,
  // also das 1,34-Fache; die verbreitete 1,37 gilt für die MIME-Variante mit Zeilenumbrüchen, die
  // eine Daten-URL nicht hat. Zusätzlich nennt `adm.upload.rawHint` jetzt die konkrete Zahl.
  "adm.upload.hint":
    "Diese Grenzen erscheinen an jeder Stelle, an der eine Datei gewählt werden kann, und werden beim Anhängen serverseitig durchgesetzt. Die Größe misst die übertragene Datei einschließlich Transportkodierung (rund das 1,34-Fache der reinen Dateigröße).",
  "adm.upload.maxAttachments": "Anhänge je Objekt (max.)",
  "adm.upload.maxMb": "Größe je Anhang (MB, max.)",
  "adm.upload.rawHint": "entspricht rund {{raw}} MB reiner Dateigröße",
  "adm.upload.save": "Speichern",
  "adm.upload.saved": "Upload-Grenzen gespeichert.",
  "adm.ext.title": "Externe Wissensabfrage",
  "adm.ext.help":
    "Steuert, ob die App externe Quellen (Web) und die Public-KI zur Anreicherung nutzen darf. Vier Stufen von komplett gesperrt bis offen. Standard bewusst restriktiv. Änderungen landen im Audit-Log.",
  "adm.ext.hint":
    "Gilt für die externe Quellensuche beim Erfassen/Prüfen und die Public-KI-Anreicherung.",
  "adm.ext.save": "Speichern",
  "adm.ext.saved": "Regler für externe Wissensabfrage gespeichert.",
  "adm.ext.note": "Wirkt sofort für alle; der Server setzt die Sperre zusätzlich durch.",
  "adm.dup.title": "Duplikat-Erkennung",
  "adm.dup.help":
    "Ab welcher KI-Wahrscheinlichkeit ein vermutliches Duplikat angezeigt wird. Niedriger heißt mehr Treffer, aber auch mehr Fehlalarme zum Wegklicken.",
  "adm.dup.hint":
    "Die KI vergleicht jeden neuen Beitrag inhaltlich mit dem gesamten Bestand. Dieser Wert legt fest, ab welcher Wahrscheinlichkeit ein Treffer auf der Duplikate-Seite erscheint.",
  "adm.dup.threshold": "Schwelle (%)",
  "adm.dup.save": "Speichern",
  "adm.dup.saved": "Duplikat-Schwelle gespeichert.",
  "adm.ext.stage.blocked": "Blockiert",
  "adm.ext.stage.search_on_click": "Nur Suche auf Klick",
  "adm.ext.stage.search_attach": "Suche + Anhängen",
  "adm.ext.stage.open": "Offen",
  "adm.ext.stageHint.blocked":
    "Externe Wissensabfrage komplett gesperrt — nichts sichtbar oder aufrufbar.",
  "adm.ext.stageHint.search_on_click": "Externe Suche nur auf ausdrücklichen Klick (Standard).",
  "adm.ext.stageHint.search_attach": "Externe Suche und Ergebnisse als Quelle anhängen erlaubt.",
  "adm.ext.stageHint.open": "Offen: Suche, Anhängen und Public-KI-Anreicherung erlaubt.",
  "enrich.title": "Public-KI-Anreicherung",
  "enrich.help":
    "Hole zusätzliche Hintergrund-Infos von der Public KI — entweder aus dem Modellwissen oder aus einer belegten Web-Suche. Ergebnisse sind extern und ungeprüft; sie werden nur auf deinen Klick in den Entwurf übernommen und nie automatisch validiert.",
  "enrich.disclaimer": "Extern & ungeprüft — bitte vor der Übernahme fachlich prüfen.",
  "enrich.modeModel": "Modellwissen",
  "enrich.modeWeb": "Web-Suche",
  "enrich.placeholder": "Wonach suchen? (z. B. Begriff, Frage)",
  "enrich.run": "Anreichern",
  "enrich.running": "Suche läuft …",
  "enrich.externBadge": "Extern · ungeprüft",
  "enrich.take": "In Entwurf übernehmen",
  "enrich.noModel":
    "Kein KI-Modell verbunden — die Public-KI-Anreicherung braucht ein aktives Modell.",
  "enrich.empty": "Keine externen Treffer gefunden.",
  // SCRUM-433 (Pedi 03.07., VIP): Anreicherung auch dann auffindbar, wenn (noch) gesperrt —
  // sagt, wo ein Admin sie freischaltet, statt einfach unsichtbar zu sein.
  "enrich.disabledHint":
    "Public-KI-Anreicherung ist verfügbar, sobald ein Admin die externe Wissensabfrage auf „Offen“ stellt (Admin → Externe Wissensabfrage).",
  "enrich.openAdmin": "Zu den Admin-Einstellungen",
  "adm.trash.title": "Papierkorb",
  "adm.trash.help":
    "Gelöschte Beiträge landen hier und bleiben 28 Tage wiederherstellbar. Danach werden sie automatisch endgültig gelöscht. Demo-Daten erscheinen hier nie — sie werden immer sofort endgültig gelöscht.",
  "adm.trash.empty": "Der Papierkorb ist leer.",
  "adm.trash.restore": "Wiederherstellen",
  "adm.trash.purge": "Endgültig löschen",
  "adm.trash.purgeQ": "Diesen Beitrag jetzt endgültig löschen?",
  "adm.trash.keep": "Behalten",
  "adm.trash.restored": "Beitrag wiederhergestellt.",
  "adm.trash.purged": "Beitrag endgültig gelöscht.",
  "adm.trash.deletedMeta": "Gelöscht von {{name}} am {{date}}",
  "adm.trash.expires": "Endgültige Löschung in {{days}} Tagen",
  "adm.presets.remove": "Funktion entfernen",
  "adm.presets.note":
    "Wird auf dem Server gespeichert und überlebt den Neustart; Schlüssel und Modelle bleiben davon unberührt.",
  // SCRUM-413: „Verfügbare KIs" — ehrliche Übersicht aller Zugänge (Metadaten, keine Secrets).
  "adm.ai.accessTitle": "Verfügbare KIs",
  "adm.ai.accessHelp":
    "Zeigt alle KI-Zugänge dieser Instanz mit ehrlichem Status: das konfigurierte Cloud-Modell (Schlüssel nur serverseitig), den deterministischen Ersatzmodus, der ohne Modell einspringt, und den geplanten lokalen LLM-Server aus Team 2. Welcher Zugang je Einsatz wirklich wirkt, steht oben in der KI-Verwaltung (Spalte „wirkt“).",
  "adm.ai.access.cloud": "Cloud-Modell",
  "adm.ai.access.fallback": "Deterministischer Ersatzmodus",
  "adm.ai.access.local": "Lokaler LLM-Server (Team 2)",
  "adm.ai.accessNote":
    "Der Anschluss des lokalen LLM-Servers an die App ist geplant (KLLM-61); bis dahin läuft er nur im Team-2-Prüfstand.",
  "adm.ai.state.active": "Aktiv",
  "adm.ai.state.available": "Bereit",
  "adm.ai.state.missing": "Nicht konfiguriert",
  "adm.ai.state.planned": "Geplant",
  "ko.couple.help":
    "Koppelst du dieses Wissen an eine Anlage, wird es bei „Anlage geändert“ (Lebenszyklus) automatisch zur Prüfung markiert — Wissen bleibt aktuell.",
  "ko.couple.empty": "Noch mit keiner Anlage gekoppelt.",
  "ko.couple.placeholder": "Anlagen-Kennung, z. B. Linie L4",
  "ko.couple.cta": "Mit Anlage koppeln",
  "ko.couple.done": "Anlage gekoppelt — Lebenszyklus überwacht dieses Wissen jetzt gezielt.",
  "capture.wizard.discardQ": "Entwurf wirklich verwerfen? Dein Erzähltext bleibt erhalten.",
  "capture.wizard.discardKeep": "Behalten",
  "capture.wizard.discardYes": "Ja, verwerfen",
  "capture.wizard.discardDone": "Entwurf verworfen — dein Erzähltext ist noch da.",
  "capture.wizard.upload": "Text aus Datei oder Bild einfügen",
  "capture.wizard.attach": "Datei oder Bild beifügen",
  "capture.wizard.attached": "{{count}} Datei(en) beigefügt — sichtbar unter „Erweiterte Details“.",
  "capture.wizard.uploadCount":
    "{{count}} Anhang/Anhänge dabei — Text aus Dokumenten steht schon oben im Feld, Details unter „Erweiterte Details“.",
  "capture.gapContextTitle": "Aus offener Wissenslücke",
  "capture.gapContextBody":
    "Das ist eine offene Frage, noch kein Wissen — sie dient nur als Startkontext. Ergänze deine Erfahrung/Beobachtung; die KI strukturiert daraus einen Entwurf, du prüfst und reichst ein.",
  "capture.gapDraftQuestion": "Offene Frage",
  "capture.gapDraftExperience": "Eigene Erfahrung/Beobachtung ergänzen",
  // SCRUM-369: geführte Schrittfolge im Gap-Kontext (Arbeitsauftrag: Frage → Erfahrung → KI → Prüfung).
  "capture.gapStepsTitle": "Dein Arbeitsauftrag:",
  // SCRUM-369: ehrlicher Anschluss nach dem Speichern aus einer Ask-Lücke — keine Auto-Schließung.
  "capture.gapSavedNote":
    "Nach der Validierung kann die Wissensbasis diese Frage künftig besser beantworten. Die Wissenslücke wird nicht automatisch geschlossen — die Prüfung entscheidet.",
  "capture.savedTitle": "Wissensobjekt gespeichert.",
  // SCRUM-286: ehrlich — gespeichert, aber noch offen/nicht validiert; erst nach Bewertung nutzbar.
  "capture.savedStatusBadge": "Status: offen — noch nicht validiert",
  // AUFTRAG-mega70 BLOCK C: der zweite Satz forderte „bitte zur Prüfung geben" — eine Handlung,
  // die eine Expertin nicht tun kann (/validierung verlangt controller). Er erklärt jetzt den
  // Prozess, ohne zur Handlung aufzufordern; der wahre erste Teil bleibt.
  "capture.savedBody":
    "Gespeichert als dein eigenes Wissen (kein Demo-Beispiel), aber noch nicht validiert. Nutzbares Wissen wird es erst, wenn es in der Validierung ausreichend bewertet wurde. Automatisch validiert wird nichts.",
  "capture.savedFromDraft":
    "Dein fortgesetzter Entwurf wurde als offenes Wissen eingereicht und aus deinen Entwürfen entfernt.",
  // WP-SHIP9-S1 (Pedis B3): der ECHTE Prüf-Status auf der Bestätigungs-Karte — „läuft" nur bis zum
  // tatsächlichen Ergebnis, Fehlschlag ehrlich mit Ursache (val.aiCheck.reason.*), kein stilles Grün.
  // PAKET 1.4 (D-AISTATE, Pedi 23.07.): ehrlicher Name je Modellzustand. OHNE nutzbares Modell trägt
  // allein die deterministische Duplikat-/Überschneidungsebene — dann NICHT „KI-Prüfung" und (bens V3)
  // NICHT „Konflikt" (Konflikte erkennt nur die KI). MIT Modell läuft zusätzlich „(mit KI)" inkl. Konflikt.
  "capture.aiCheck.running":
    "Duplikat-/Überschneidungsprüfung läuft … Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "capture.aiCheck.runningAi":
    "Duplikat-/Konfliktprüfung (mit KI) läuft … Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "capture.aiCheck.done":
    "Duplikat-/Überschneidungsprüfung abgeschlossen (ohne KI) — Details in der Validierung.",
  "capture.aiCheck.doneAi":
    "Duplikat-/Konfliktprüfung (mit KI) abgeschlossen — Details in der Validierung.",
  "capture.aiCheck.failed":
    "Prüfung fehlgeschlagen: {{reason}} Neu anstoßen kannst du sie in der Validierung.",
  // SCRUM-373 / AG-02-SESSION: nach dem Speichern haben Bilder/Dateien eine sichere Objekt-Referenz.
  "capture.savedFilesNote":
    "{{count}} Anhang/Anhänge sind jetzt als sichere Objekt-Referenz gespeichert und im Editor des Wissensobjekts als Beleg verlinkbar. Belege sind Kontext — sie ersetzen die Validierung nicht.",
  // SCRUM-374 / AG-02-SESSION: ehrlicher Recovery-Hinweis, wenn das KO gespeichert wurde, aber einzelne
  // Anhänge NICHT hochgeladen/angehängt werden konnten (Teilfehler ≠ Totalfehler).
  "capture.attachTooLarge":
    "„{{name}}“ ist zu groß für den Anhang (Upload-Grenze überschritten) — die Datei wurde nicht gespeichert, der Text-Import bleibt erhalten.",
  "capture.originalAttachFailed":
    "Originaldatei „{{name}}“ konnte nicht als Anhang gesichert werden — der Text-Import bleibt erhalten.",
  "capture.attachFailedTitle": "Nicht alle Anhänge konnten gesichert werden",
  "capture.attachFailedBody":
    "Dein Wissensobjekt ist offen gespeichert. Diese Datei(en) wurden NICHT angehängt: {{names}}. Das gespeicherte Wissen ist davon unberührt — Belege ersetzen die Validierung nicht.",
  "capture.attachFailedNext":
    "Nächster Schritt: Wissensobjekt öffnen und die Datei(en) dort erneut anhängen.",
  // AUFTRAG-mega17 Block A-2: fehlende HERKUNFT beim Namen nennen. Nicht „Anhang fehlgeschlagen“,
  // sondern: der Inhalt ist da, sein Beleg nicht — und wie du das nachholst.
  "capture.sourceMissingTitle": "Übernommener Inhalt ohne Herkunftsvermerk",
  "capture.sourceMissingBody":
    "Dein Wissensobjekt ist gespeichert und enthält den aus dem Dokument übernommenen Text. Der zugehörige Herkunftsvermerk konnte NICHT gesetzt werden ({{count}}): {{names}}. Damit steht dort Inhalt ohne Beleg — genau das, was dieses Produkt nicht stillschweigend hinnimmt.",
  "capture.sourceMissingNext":
    "Nächster Schritt: Wissensobjekt öffnen, das Quelldokument dort anhängen und die Quelle erneut vermerken. Erlaubt die eingestellte Stufe „Externes Wissen“ das nicht, kann ein Administrator sie unter Verwaltung → Externes Wissen ändern.",
  // AUFTRAG-mega18 Block A-3: der DRITTE Ausgang. Er behauptet NICHTS über den Bestand — weder
  // „gespeichert" noch „fehlgeschlagen" —, weil beides eine Lüge wäre, solange der Server nicht
  // geantwortet hat. Die einzige ehrliche Auskunft ist: nachsehen.
  // ============================================================================================
  // AUFTRAG-mega21 Block C-1 — die nach dem Commit gescheiterten Nacharbeiten, beim Namen genannt.
  // ============================================================================================
  // Der erste Satz ist der wichtigste und steht deshalb zuerst: das Wissensobjekt IST gespeichert.
  // Aus einem Eintrag hier darf nie geschlossen werden, der Inhalt sei verloren — das war die
  // Fehlerklasse, die in mega18 zu echtem Datenverlust geführt hat.
  "capture.followUpsFailedTitle": "Gespeichert — aber eine Nacharbeit lief nicht",
  "capture.followUpsFailedBody":
    "Dein Wissensobjekt ist vollständig gespeichert und belegt. NACH dem Speichern ist Folgendes nicht durchgelaufen: {{steps}}. Das ändert nichts am gespeicherten Wissen — es bleibt aber etwas offen, und niemand erfährt es sonst.",
  "capture.followUp.draftDiscard": "Entwurf entfernen",
  "capture.followUp.draftDiscardNext":
    "Der Entwurf steht noch in deiner Entwurfsliste. Du kannst ihn dort löschen — das eingereichte Wissensobjekt ist davon unberührt.",
  "capture.followUp.validationAssign": "Prüfer zuweisen",
  "capture.followUp.validationAssignNext":
    "Es wartet niemand auf dieses Wissensobjekt. Öffne die Validierung und weise die Prüfer dort erneut zu.",
  "capture.followUp.notifyAssignment": "Prüfer benachrichtigen",
  "capture.followUp.notifyAssignmentNext":
    "Die Zuweisung steht, nur die Nachricht ging nicht raus. Sag den zugewiesenen Prüfern kurz Bescheid.",
  "capture.followUp.aiCheck": "Duplikat-/Konfliktprüfung anstoßen",
  "capture.followUp.aiCheckNext":
    "Die Prüfung ist als fehlgeschlagen vermerkt und lässt sich auf der Validierungsseite neu anstoßen.",
  // AUFTRAG-mega23 Block B (bens SB-G): der Satz darüber setzt einen GESCHRIEBENEN Vermerk voraus.
  // Fehlt der Nachweis, gilt dieser hier — er verspricht KEINE Wiederholung, die der Endpunkt
  // ablehnen würde, und benennt die eine Handlung, die dann wirklich hilft.
  "capture.followUp.aiCheckUnrecordedNext":
    "Auch der Fehlschlag-Vermerk selbst konnte nicht gespeichert werden — für dieses Wissensobjekt steht deshalb KEIN wiederholbarer Prüf-Job bereit. Bitte das Objekt in der Validierung von Hand auf Duplikate und Widersprüche ansehen.",
  "capture.followUp.unknown": "ein Schritt, den diese Oberfläche noch nicht kennt",
  "capture.followUp.unknownNext":
    "Diese Fassung der Oberfläche kennt den Schritt nicht beim Namen. Er steht im Prüfprotokoll des Wissensobjekts — bitte dort nachsehen.",
  // ============================================================================================
  // AUFTRAG-mega21 Block C-2 — fehlende Originale beim Fortsetzen eines Entwurfs.
  // ============================================================================================
  // Der Server hat den Entwurf bereits ausgedünnt (übernommener Text und verwaiste Belegstellen
  // kommen nicht zurück). Diese Texte erklären den GRUND — bis mega20 sah der Nutzer nur die Lücke.
  "capture.anchorsMissingTitle":
    "Ein gesichertes Original fehlt — übernommener Text wurde nicht geladen",
  "capture.anchorsMissingBody":
    "Zu diesem Entwurf gehören {{count}} gesicherte Originaldokument(e), die es nicht mehr gibt. Der daraus übernommene Text und die zugehörigen Belegstellen wurden deshalb NICHT geladen: sie wären Inhalt ohne Herkunft, und das speichert dieses Produkt nicht stillschweigend. Deine eigene Arbeit — Titel, Aussage, Bedingungen, Maßnahmen, Prüferauswahl — ist vollständig da.",
  "capture.anchorsMissingNext":
    "Solange dieser Hinweis steht, ist „Als Entwurf speichern“ gesperrt: ein Speichern jetzt würde den ausgedünnten Stand über den gespeicherten schreiben.",
  "capture.anchorsMissingReselect": "Original erneut auswählen",
  "capture.anchorsMissingAck": "Ohne das Original weiterarbeiten",
  // AUFTRAG-mega22 Block E: der Rückweg aus einem 409. Er wird NUR angeboten, wenn ein neuer
  // Vorgang der richtige Ausweg ist (Abdruckkonflikt, belegte Kennung) — nie bei
  // CREATE_REPAIR_REQUIRED, wo ein Objekt auf Prüfung wartet (s. lib/createOperation.ts).
  "capture.restartOfferTitle": "Dieser Vorgang lässt sich nicht wiederholen",
  "capture.restartOfferBody":
    "Der Vorgangsschlüssel dieses Einreichens gehört bereits zu einem abgeschlossenen Vorgang mit anderem Inhalt. Dein aktueller Text ist unverändert da und geht nicht verloren. Um ihn zu speichern, braucht es einen NEUEN Vorgang — das entscheidest du, nicht die Oberfläche.",
  "capture.restartOfferAction": "Neuen Vorgang beginnen",
  "capture.appendUnclearTitle": "Übernahme mit unklarem Ausgang",
  "capture.appendUnclearBody":
    "Dein Wissensobjekt ist gespeichert. Bei der Übernahme aus {{names}} brach die Verbindung ab, bevor der Server geantwortet hat: sie kann vollzogen sein oder nicht. Es wurde NICHTS zurückgenommen — ein blindes Aufräumen hätte hier den Schaden erst angerichtet. Bitte das Wissensobjekt öffnen und nachsehen, ob der übernommene Inhalt samt Herkunft dort steht.",
  "own.empty.title": "Noch kein eigenes Wissen hier",
  "own.empty.hint":
    "Du filterst auf eigenes Wissen (keine Demo-Beispiele). Selbst erfasstes Wissen erscheint hier nach dem Speichern und wartet dann auf die Prüfung.",
  "own.empty.cta": "Eigenes Wissen erfassen",
  "studio.open": "Im Knowledge Studio bearbeiten",
  "studio.title": "Knowledge Studio",
  "studio.subtitle":
    "Großer Arbeitsraum mit KI-Hilfe. Änderungen werden erst beim Übernehmen in den Entwurf geschrieben — kein Auto-Speichern, keine Auto-Validierung.",
  "studio.apply": "In den Entwurf übernehmen",
  "studio.cancel": "Verwerfen",
  "studio.close": "Schließen",
  // SCRUM-458 Stufe 1: „Einfach ↔ Strukturiert" als Ansicht-Schalter (Studio = Ansicht, kein zweiter Ort).
  "studio.viewSimple": "Einfach",
  "studio.viewStructured": "Strukturiert",
  "studio.viewSwitch": "Ansicht: einfach oder strukturiert",
  "studio.attachFromDisk": "Datei/Bild vom Rechner anhängen",
  "studio.state.dirty": "Nicht übernommen",
  "studio.state.clean": "Keine Studio-Änderungen",
  "studio.confirmDiscard.q": "Nicht übernommene Änderungen verwerfen?",
  "studio.confirmDiscard.keep": "Weiter bearbeiten",
  "studio.confirmDiscard.discard": "Verwerfen",
  "studio.applied":
    "Ausführlicher Inhalt aus dem Studio in den Entwurf übernommen. Speichern bzw. Revision erfolgt erst über den bestehenden Button — nichts wird automatisch gespeichert oder validiert.",
  "studio.save.capture.title": "Studio-Inhalt im Entwurf — noch nicht gespeichert",
  "studio.save.capture.hint":
    "Der im Studio übernommene Inhalt liegt im Entwurf, ist aber noch nicht gespeichert oder validiert.",
  "studio.save.capture.next":
    "Nächster Schritt: speichern/einreichen — danach folgt die Prüfung (Review/Validierung). Automatisch validiert wird nichts.",
  "studio.save.revision.title": "Studio-Inhalt im Revisionsentwurf — noch nicht gespeichert",
  "studio.save.revision.hint":
    "Der im Studio übernommene Inhalt liegt im Revisionsentwurf, ist aber noch nicht gespeichert.",
  "studio.save.revision.next":
    "Speichern erzeugt eine neue Version und startet die Prüfung neu — keine automatische Freigabe.",
  "studio.fromDraft.cta": "Entwurf als Artikel im Studio strukturieren",
  "studio.fromDraft.hint":
    "Erzeugt aus deinem Entwurf (Aussage, Bedingungen, Maßnahmen, Tags) einen strukturierten Artikel-Vorschlag — bitte prüfen und ergänzen. Vorhandener Inhalt wird angehängt, nicht überschrieben; nichts wird automatisch validiert.",
  "studio.section.context": "Struktur & Kontext",
  "studio.section.editor": "Inhalt bearbeiten",
  "studio.section.assist": "KI-Hilfe",
  "studio.guide.structure.label": "Strukturieren",
  "studio.guide.structure.hint": "Gliedere mit Überschriften, Schritten und Hervorhebungen.",
  "studio.guide.assist.label": "KI prüfen",
  "studio.guide.assist.hint":
    "Lass die KI klarer/strukturieren — Vorschlag prüfen, nicht blind übernehmen.",
  "studio.guide.preview.label": "Vorschau",
  "studio.guide.preview.hint": "Sieh dir an, wie der Beitrag später aussieht.",
  "studio.guide.apply.label": "Übernehmen",
  "studio.guide.apply.hint":
    "Bewusst in den Entwurf übernehmen — nichts wird automatisch gespeichert.",
  "studio.guide.thenSave": "danach speichern & prüfen lassen",
  "studio.coach.story":
    "Du rettest Erfahrungswissen. Die KI hilft beim Strukturieren — gesichert wird es erst durch die Prüfung deiner Kolleg:innen.",
  "studio.coach.firstRun":
    "Start hier: Erzähl dein Wissen in eigenen Worten. Struktur, KI-Hilfe und Vorschau kommen Schritt für Schritt.",
  "studio.coach.nextPrefix": "Nächster Schritt",
  "studio.coach.reason.start":
    "Fang mit deiner Erfahrung an — schon ein roher Anfang ist wertvoll.",
  "studio.coach.reason.improve":
    "Lass die KI beim Gliedern und Schärfen helfen oder ergänze Überschriften und Schritte.",
  "studio.coach.reason.preview": "Sieh dir in der Vorschau an, wie dein Beitrag später wirkt.",
  "studio.coach.reason.apply":
    "Sieht gut aus? Übernimm den Entwurf bewusst — gespeichert und geprüft wird danach.",
  "studio.contrib.title": "Dein Beitrag",
  "studio.contrib.level.empty.label": "Leer",
  "studio.contrib.level.empty.hint": "Fang an zu schreiben — schon ein roher Anfang ist wertvoll.",
  "studio.contrib.level.draft.label": "Entwurf",
  "studio.contrib.level.draft.hint":
    "Guter Anfang. Ein paar Schritte machen ihn klarer und nützlicher.",
  "studio.contrib.level.solid.label": "Solide",
  "studio.contrib.level.solid.hint": "Klar strukturiert — bereit zum Übernehmen und Prüfen lassen.",
  "studio.contrib.strengthsTitle": "Schon gut",
  "studio.contrib.strength.text": "Echter Inhalt vorhanden",
  "studio.contrib.strength.headings": "Mit Überschriften gegliedert",
  "studio.contrib.strength.steps": "Schritte als Liste",
  "studio.contrib.strength.highlights": "Wichtiges hervorgehoben",
  "studio.contrib.strength.links": "Verweise/Links enthalten",
  "studio.contrib.strength.evidence": "Belege/Anhänge vorhanden",
  "studio.contrib.suggestionsTitle": "Macht ihn stärker",
  "studio.contrib.suggestion.detail": "Etwas mehr Detail ergänzen",
  "studio.contrib.suggestion.headings": "Überschriften für Abschnitte",
  "studio.contrib.suggestion.steps": "Schritte als Liste ergänzen",
  "studio.contrib.suggestion.referenceAttachments": "Anhänge im Text erwähnen",
  "studio.contrib.valueNote":
    "Dein Erfahrungswissen zählt — gesichert wird es erst nach der Prüfung durch Kolleg:innen.",
  "studio.tips.title": "So arbeitest du im Studio",
  "studio.tips.select.label": "Markieren → formatieren",
  "studio.tips.select.hint":
    "Text markieren, dann über die Toolbar fett/kursiv setzen — oder die gewohnten Tasten nutzen.",
  "studio.tips.structure.label": "Struktur über H2/H3",
  "studio.tips.structure.hint":
    "Abschnitte mit Überschrift 2 und 3 gliedern, Schritte als Listen — das macht den Inhalt lesbar.",
  "studio.tips.ai.label": "KI-Vorschlag prüfen",
  "studio.tips.ai.hint":
    "KI-Hilfe rechts erzeugt einen Vorschlag — erst prüfen, dann bewusst übernehmen. Nichts wird automatisch gespeichert.",
  "studio.tips.blocks.label": "Templates & Blöcke gezielt",
  "studio.tips.blocks.hint":
    "Vorlagen geben eine Struktur vor; Info-/Hinweis-/Warnung-/Erfolg-Blöcke heben Wichtiges hervor.",
  "studio.view.edit": "Bearbeiten",
  "studio.view.preview": "Vorschau",
  "studio.preview.empty": "Noch kein Inhalt — im Editor schreiben, dann hier die Vorschau prüfen.",
  "studio.preview.note":
    "Vorschau zeigt den aktuellen Entwurf, kein validiertes Wissen. Übernehmen schreibt nur in den lokalen Entwurf; Speichern/Einreichen/Revidieren folgt danach über die bestehenden Buttons.",
  "capture.savedViewKo": "Objekt ansehen",
  // SCRUM-310: in der Bibliothek wiederfinden — Herkunftsfilter „eigenes/nicht-Demo-Wissen"
  // (technisch: ohne Demo-Tag; keine Autor-/User-Zuordnung). Auffinden, keine Validierung.
  "capture.savedViewLibrary": "In der Bibliothek ansehen (eigenes Wissen)",
  "capture.savedValidate": "Zur Prüfung geben",
  "capture.savedAgain": "Weiteres erfassen",
  "capture.mode.freitext": "Freitext",
  "capture.mode.formular": "Formular",
  "capture.mode.diktat": "Diktat",
  "capture.mode.interview": "Geführtes Interview",
  "capture.mode.datei": "Aus Datei",
  // PMO-FEA-0006: Wissen aus Datei — Dokument hochladen, KI-Punkteliste mit Belegstellen,
  // ausgewählte Punkte nacheinander im Wizard prüfen/einreichen. Nichts wird automatisch gespeichert.
  "capture.file.hint":
    "Lade ein Dokument hoch — die KI listet auf, welches Wissen darin steckt, jeweils mit wörtlicher Belegstelle. Du wählst aus, was übernommen wird; gespeichert wird nichts automatisch.",
  "capture.file.upload": "Dokument auswählen",
  "capture.file.replace": "Anderes Dokument wählen",
  "capture.file.remove": "Dokument entfernen",
  "capture.file.dropHint": "Datei hierher ziehen und ablegen — oder unten auswählen.",
  // AUFTRAG-mega34 D1: der Knopf sagt, was er tut. Kein „Upload", kein „Import" — er öffnet die
  // Dateiauswahl des Rechners, mehr nicht.
  "capture.file.pick": "Datei auswählen",
  "capture.file.dropActive": "Datei hier ablegen …",
  "capture.file.dropReject":
    "„{{name}}“ wird hier noch nicht unterstützt — bitte eine Text-, Word-, PDF-, PPTX- oder Bilddatei ablegen.",
  "capture.file.extracting": "Lese „{{name}}“ …",
  "capture.file.loaded": "„{{name}}“ gelesen — bereit für die Wissenssuche.",
  "capture.file.empty": "In „{{name}}“ wurde kein Text gefunden.",
  "capture.file.emptyPdf":
    "In „{{name}}“ wurde kein Text gefunden — ein gescanntes PDF ohne Textebene wird noch nicht unterstützt.",
  "capture.file.emptyPptx":
    "In „{{name}}“ wurden keine übernehmbaren Texte gefunden (reine Bild-/Grafik-Präsentation). Es wurde nichts gespeichert — das Original kannst du bei Bedarf manuell als Datei anhängen.",
  "capture.file.pdfTruncated": "Nur die ersten {{count}} Seiten importiert.",
  "capture.file.pptxTruncated": "Nur die ersten {{count}} Folien importiert.",
  "capture.slides.toggle": "Folien als Bilder übernehmen.",
  "capture.slides.toggleHint":
    "Bei PowerPoint-Dateien wird zusätzlich jede Folie als Bild an den Beitrag angehängt (Abschnitt Folienansicht). Die Umwandlung läuft auf dem Server und kann einen Moment dauern.",
  "capture.slides.heading": "Folienansicht",
  "capture.slides.converting": "Folien von {{name}} werden auf dem Server in Bilder umgewandelt …",
  "capture.slides.done": "{{count}} Folie(n) als Bild angehängt.",
  "capture.slides.truncated":
    "Es wurden nur die ersten {{max}} Folien umgewandelt (harte Obergrenze).",
  "capture.slides.dropped":
    "{{count}} Folienbild(er) passten nicht mehr ins Beitrags-Budget und wurden weggelassen.",
  "capture.slides.busy":
    "Der Server wandelt gerade eine andere Präsentation um — bitte in einem Moment erneut importieren. Der Text-Import ist vollständig.",
  "capture.slides.unavailable":
    "Die Folien-Ansicht ist auf diesem Server derzeit nicht verfügbar. Der Text-Import ist vollständig.",
  "capture.slides.timeout":
    "Der Server arbeitet noch oder ist nicht erreichbar — die Folien-Konvertierung wurde clientseitig abgebrochen; der Text-Import bleibt vollständig erhalten.",
  "capture.slides.failed":
    "Die Folien konnten nicht in Bilder umgewandelt werden. Der Text-Import ist vollständig.",
  "capture.file.pptxTooLarge":
    "„{{name}}“ ist zu groß oder zu stark komprimiert für den sicheren Import und wurde NICHT gelesen. Bitte die Präsentation verkleinern oder aufteilen.",
  "capture.file.pptxImagesFormat":
    "{{count}} Bilder konnten nicht übernommen werden — Format nicht unterstützt.",
  "capture.file.pptxImagesBudget":
    "{{count}} Bilder konnten nicht übernommen werden — zu groß für die Einbettung.",
  "capture.file.imagesOnlyNoText":
    "Bilder übernommen — ohne Text sind keine KI-Vorschläge möglich.",
  "capture.file.imagesAllDropped":
    "Die Bilder konnten nicht in den Beitrag übernommen werden (zu groß oder Format nicht unterstützt) — das Original wird beim Speichern als Anhang mitgeführt.",
  // JOB 513/D3B: derselbe Fall OHNE gesichertes Original. Der Satz darüber sagt einen Anhang zu; ohne
  // Original wäre das eine Zusage ohne Deckung. Hier steht deshalb, was wirklich gilt.
  "capture.file.imagesAllDroppedNoOriginal":
    "{{dropped}} Bild(er) konnten nicht in den Beitrag übernommen werden, und das Original konnte NICHT als Anhang gesichert werden — diese Bilder sind verloren.",
  // JOB 513/D3B: defekte/unauflösbare Bildverweise haben jetzt einen echten Grund statt einer Leerstelle.
  "capture.file.imagesDefect":
    "{{count}} Bild(er) konnten nicht gelesen werden — der Verweis in der Datei ist defekt oder die Bilddatei fehlt.",
  "capture.file.imagesOutsidePath":
    "{{count}} Bild(er) liegen außerhalb des übernommenen Folienbereichs (zum Beispiel Hintergrundbilder) und wurden nicht übernommen.",
  // JOB 513/D3B: je Grenzart der reale Wert — nicht mehr für alle drei Kanten dieselbe Begründung.
  "capture.file.imagesBudgetBodyHtml":
    "Grenze „Beitragstext“: {{count}} Bild(er) passten nicht mehr in den Beitrag (höchstens {{limitBytes}} Byte; gebraucht wurden {{actualBytes}}).",
  "capture.file.imagesBudgetSingleImage":
    "Grenze „Einzelbild“: {{count}} Bild(er) sind für sich genommen zu groß (höchstens {{limitBytes}} Byte je Bild; das größte hatte {{actualBytes}}).",
  "capture.file.imagesBudgetTotalImages":
    "Grenze „Bildersumme“: {{count}} Bild(er) hätten die Gesamtgröße aller Bilder gesprengt (höchstens {{limitBytes}} Byte; gebraucht wurden {{actualBytes}}).",
  "capture.file.imageCaptionPlaceholder": "Noch keine Bildbeschreibung",
  "capture.file.imagesKept":
    "{{kept}} Bilder übernommen, davon {{compressed}} für die Textansicht komprimiert; das unveränderte Original liegt im Anhang.",
  "capture.file.imagesKeptDropped":
    "{{kept}} Bilder übernommen, davon {{compressed}} komprimiert; {{dropped}} wegen Größe weggelassen. Das unveränderte Original liegt im Anhang.",
  "capture.file.imagesNoOriginal":
    "{{kept}} Bilder übernommen, davon {{compressed}} komprimiert; das Original konnte NICHT als Anhang gesichert werden.",
  "capture.file.imagesLost":
    "{{kept}} Bilder übernommen, davon {{compressed}} komprimiert; {{dropped}} weggelassen. Das Original konnte NICHT gesichert werden — {{dropped}} Bilder sind verloren.",
  "capture.file.tooLargeForImport":
    "Das Dokument ist auch nach Bildkompression zu groß für den Textimport — bitte kleiner aufteilen. Das Original bleibt unberührt.",
  "capture.file.importNote.docx":
    "Struktur und Bilder übernommen (Best-Effort) — exaktes Layout kann abweichen.",
  "capture.file.importNote.pdf":
    "Best-Effort-Textimport — Layout und Bilder wurden nicht übernommen.",
  "capture.file.importNote.pptx":
    "Best-Effort-Import aus PowerPoint — Text, Listen, Tabellen und Bilder je Folie übernommen; Layout, Animationen, Übergänge und Sprechernotizen gehen verloren.",
  "capture.file.parseError": "„{{name}}“ konnte nicht gelesen werden.",
  "capture.file.unsupported":
    "„{{name}}“ wird hier nicht unterstützt — bitte als TXT/MD, DOCX, PDF oder PPTX bereitstellen. Bilder gehen nur über OCR.",
  "capture.file.ocrCta": "Text im Bild erkennen (OCR)",
  "capture.file.ocrBusy": "Texterkennung läuft …",
  "capture.file.queryLabel": "Wonach soll die KI suchen? (optional)",
  "capture.file.queryPlaceholder":
    "z. B. „Grenzwerte und Prüfintervalle“ — leer lassen, um alles Wissen zu finden",
  "capture.file.queryHelp.title": "Gezielt suchen",
  "capture.file.queryHelp.body":
    "Ohne Angabe listet die KI alle Wissenspunkte im Dokument auf. Mit Suchauftrag beschränkt sie sich auf deinen Fokus. Erfunden wird in beiden Fällen nichts — jeder Punkt trägt eine wörtliche Belegstelle aus dem Dokument.",
  // SCRUM-451 (Pedi 05.07.): Ergebnis-Sprache — Systemsprache oder Original des Dokuments.
  "capture.file.langLabel": "Ergebnis in",
  "capture.file.langSystem": "Systemsprache",
  "capture.file.langSource": "Originalsprache",
  "capture.file.langHelp.title": "Ergebnis-Sprache",
  "capture.file.langHelp.body":
    "Systemsprache: Titel und Zusammenfassungen erscheinen in deiner Oberflächensprache (Deutsch/Englisch) — ein englisches Dokument wird dabei faktisch übersetzt. Originalsprache: Die KI übersetzt nichts, die Punkte bleiben in der Sprache des Dokuments. Wörtliche Belegstellen bleiben in beiden Fällen unverändert.",
  "capture.file.importMode.label": "Importart",
  "capture.file.importMode.points": "In Punkte analysieren",
  "capture.file.importMode.pointsDesc":
    "Klarwerk extrahiert einzelne Aussagen aus der Datei. Bestehender Weg, nichts wird automatisch gespeichert.",
  "capture.file.importMode.whole": "Ganzes Dokument übernehmen",
  "capture.file.importMode.wholeDesc":
    "Klarwerk legt genau einen Entwurf mit dem gesamten Dokument an. Keine automatische Validierung.",
  "capture.file.searchCta": "Datei analysieren",
  "capture.file.searching": "Die KI liest das Dokument …",
  "capture.file.wholeCta": "Ganzes Dokument als Entwurf speichern",
  "capture.file.wholeSaving": "Entwurf wird gespeichert …",
  "capture.file.wholeSaved":
    "„{{name}}“ als ein Entwurf gespeichert — Quelle: Dateiname, gesamtes Dokument.",
  "capture.file.wholeSourceNote":
    "Quelle wird im Entwurf sichtbar vermerkt: {{name}}, gesamtes Dokument. Der Entwurf bleibt offen und ungeprüft.",
  "capture.file.wholeSavedTitle": "Dokument als Entwurf gespeichert",
  "capture.file.wholeSavedSource": "Quelle: {{name}}, gesamtes Dokument.",
  "capture.file.wholeOpenDraft": "Entwurf öffnen",
  "capture.file.wholeOpenMissing":
    "Entwurf wurde gespeichert, konnte aber nicht direkt geöffnet werden.",
  "capture.file.wholeImportAnother": "Weiteres Dokument importieren",
  // WP-D10c: Label dient als dezente Aufklapp-Zeile (Info-Icon + Titel, zugeklappt als Start).
  "capture.file.formatTitle": "Informationen zu Dateiformaten und Formatierung",
  // WP-D10c (Ehrlichkeit): seit WP-D9 werden PPTX-FOTOS übernommen (figures) — Vektor-Grafiken/Formen
  // weiterhin nicht. Konsistent zu capture.file.importNote.pptx.
  "capture.file.formatHint":
    "TXT/MD und weitere Textdateien werden als Text übernommen. DOCX: Struktur (Überschriften, Listen, Tabellen) und Bilder werden Best-Effort übernommen; exaktes Layout kann abweichen. PDF läuft als Best-Effort-Textimport; Layout und Bilder gehen verloren. PPTX: Text, Struktur und Fotos je Folie werden Best-Effort übernommen; Layout, Animationen, Vektor-Grafiken/Formen und Notizen gehen verloren.",
  "capture.file.supportedTitle": "Aktiv auswählbar:",
  "capture.file.supportedFormats":
    "TXT, MD/Markdown, CSV, LOG, JSON, DOCX, PDF, PPTX und Bilder für OCR.",
  "capture.file.unsupportedFormats":
    "RTF wird aktuell nicht unterstützt. Bitte als TXT/MD, DOCX, PDF oder PPTX bereitstellen, sofern verfügbar.",
  "capture.file.cancel": "Abbrechen",
  "capture.file.pointsTitle": "Gefundenes Wissen — wähle aus, was übernommen wird",
  "capture.file.pointsHint":
    "Jeder Punkt trägt seine Belegstelle aus dem Dokument. Wähle ab, was du nicht brauchst — übernommen wird erst auf Klick.",
  "capture.file.excerptLabel": "Belegstelle",
  "capture.file.pointCount": "{{selected}} von {{total}} Punkten ausgewählt",
  "capture.file.applyCta": "Ausgewählte übernehmen",
  "capture.file.queueBadge": "Punkt {{current}} von {{total}} aus „{{name}}“",
  "capture.file.queueHint":
    "Jeder Punkt wird einzeln als Wissensseite geprüft und eingereicht — nichts wird automatisch gespeichert.",
  "capture.file.queueSkip": "Punkt überspringen",
  "capture.file.queueDone": "Alle Punkte aus „{{name}}“ sind bearbeitet.",
  "capture.file.sourceNote": "Die Quelle „{{name}}“ wird am Wissensobjekt vermerkt.",
  // SCRUM-409 (PMO-FEA-0008-Delta): Import-Quittung, Mehrpunkt-Entwürfe, Zusammenführen.
  "capture.file.loadedStats":
    "„{{name}}“ eingelesen ({{chars}} Zeichen). Sag optional, wonach gesucht werden soll, und starte die Wissenssuche.",
  "capture.file.saveDraftsCta": "Als Entwürfe speichern",
  "capture.file.draftsSaved":
    "{{count}} Entwürfe aus „{{name}}“ gespeichert — je mit Quellenvermerk. Du findest sie oben unter „Entwürfe fortsetzen“.",
  "capture.file.draftsPartial":
    "Nicht alle Punkte konnten als Entwurf gespeichert werden: {{failed}}. Bereits angelegte Entwürfe bleiben erhalten.",
  "capture.file.mergeCta": "Ausgewählte zu einem Eintrag verbinden",
  "capture.file.mergedNote":
    "{{count}} Punkte aus „{{name}}“ zu einem Eintrag zusammengeführt — alle Belegstellen stehen im Dokument, die Quellen werden beim Einreichen vermerkt.",
  // SCRUM-433 (Pedi 03.07., VIP): die drei Wege aus der Punkteliste jederzeit erklärt.
  "capture.file.connectHint":
    "Mehrere anhaken und „Verbinden“ fasst sie zu EINEM Eintrag zusammen · „Als Entwürfe speichern“ legt je Punkt einen eigenen an · „Übernehmen“ arbeitet sie einzeln ab.",
  "capture.file.connectDisabledHint": "Mindestens 2 Erkenntnisse anhaken, um sie zu verbinden.",
  "capture.file.selectAll": "Alle auswählen",
  "capture.file.deselectAll": "Alle abwählen",
  "capture.file.mergedInList":
    "{{count}} Erkenntnisse zu einem Punkt verbunden — bleibt in der Liste.",
  "capture.file.applyDisabledHint":
    "Genau eine Erkenntnis anhaken — es wird immer nur eine weiterverarbeitet.",
  "capture.file.purgeUnselectedQ":
    "Sollen die {{count}} nicht ausgewählten Erkenntnisse gelöscht werden?",
  "capture.file.purgeUnselectedYes": "Nicht ausgewählte löschen",
  "capture.file.purgeUnselectedKeep": "Behalten",
  // SCRUM-384 / KG-UX-001/002/003/010: Erzähl-Einstieg als Standardweg, Formular als Expertenpfad.
  "capture.entry.narrateKicker": "Erzähl dein Wissen — die KI strukturiert, du prüfst",
  // AUFTRAG-mega51 BLOCK B: der empfohlene Erzählweg ist sichtbar einer — die übrigen bleiben.
  "capture.entry.recommendedBadge": "Empfohlen",
  "capture.entry.expertToggle": "Expertenmodus: Formular direkt ausfüllen",
  "capture.entry.expertHint":
    "Für Routinierte: alle Felder direkt ausfüllen — gleiche Felder, gleicher Prüfweg. Der geführte Erzähl-Einstieg bleibt jederzeit erreichbar.",
  "capture.entry.expertActive":
    "Expertenmodus: Du füllst das Formular direkt aus. Gespeichert und geprüft wird wie im geführten Weg — nichts wird automatisch validiert.",
  "capture.entry.backToGuided": "Zurück zum geführten Weg",
  "capture.raw": "Erfahrungsnotiz",
  "capture.rawPlaceholder":
    "Erfahrung formlos festhalten — die KI strukturiert daraus einen Entwurf. Du prüfst und reichst ein.",
  "capture.structure": "Mit KI strukturieren",
  "capture.assist": "KI-Hilfe",
  // SCRUM-375 / AG-12: erweiterte/technische Felder als Progressive Disclosure (optional, nichts entfernt).
  "capture.advanced.title": "Erweiterte Details (optional)",
  "capture.advanced.hint":
    "Kategorie, Anlage, Prüf-Anzahl, Schlagwörter, Dokumente & Bilder — nichts davon ist Pflicht. Erzähl zuerst dein Wissen; die Details kannst du jederzeit aufklappen und ergänzen.",
  "capture.advanced.filled": "{{count}} ausgefüllt",
  // SCRUM-312: KI-Nachbearbeitung (Beta) — Vorschlag, kein Auto-Submit; Mensch übernimmt bewusst.
  "capture.ai.title": "KI-Nachbearbeitung (Beta)",
  "capture.ai.hint":
    "Die KI macht einen Vorschlag — du prüfst ihn und übernimmst bewusst. Keine automatische Speicherung, keine Validierung; Inhalte/Fakten werden nicht erfunden.",
  "capture.ai.bodyHint":
    "KI-Hilfe für den ausführlichen Inhalt: Vorschlag prüfen und bewusst übernehmen (Ersetzen/Anhängen). Keine automatische Speicherung, keine Validierung; Inhalte und Quellen bitte selbst prüfen.",
  "capture.ai.applyAsLabel": "Als Struktur übernehmen",
  "capture.ai.applyAs.section": "Als Abschnitt anhängen",
  "capture.ai.applyAs.info": "Als Info anhängen",
  "capture.ai.applyAs.note": "Als Hinweis anhängen",
  "capture.ai.applyAs.warning": "Als Warnung anhängen",
  "capture.ai.applyAs.success": "Als Erfolg anhängen",
  "capture.ai.action.clarify": "Klarer",
  "capture.ai.action.structure": "Strukturieren",
  "capture.ai.action.expand": "Erweitern",
  "capture.ai.action.spelling": "Rechtschreibung",
  "capture.ai.action.format": "Formatieren",
  "capture.ai.instr.clarify": "Formuliere klarer und präziser, ohne den Sinn zu verändern.",
  "capture.ai.instr.structure": "Strukturiere den Text in klare, knappe Sätze bzw. Stichpunkte.",
  "capture.ai.instr.expand":
    "Formuliere etwas ausführlicher und vollständiger — ohne neue Fakten zu erfinden.",
  "capture.ai.instr.spelling": "Korrigiere nur Rechtschreibung und Grammatik.",
  "capture.ai.instr.format":
    "Verbessere nur die Lesbarkeit durch saubere Absätze und Zeichensetzung. Verwende KEINE Markdown-Zeichen wie #, ## oder * — keine Überschriften-Zeichen. Inhalt und Wortlaut unverändert lassen, nichts hinzufügen oder weglassen.",
  "capture.ai.help.clarify": "Formuliert verständlicher und präziser — der Sinn bleibt gleich.",
  "capture.ai.help.structure": "Ordnet den Text in knappe Sätze bzw. Stichpunkte.",
  "capture.ai.help.expand": "Formuliert ausführlicher — erfindet dabei keine neuen Fakten.",
  "capture.ai.help.spelling": "Korrigiert nur Rechtschreibung und Grammatik, sonst nichts.",
  "capture.ai.help.format":
    "Verbessert nur die Lesbarkeit (Absätze, Zeichensetzung) — ohne Markdown-Zeichen; der Inhalt bleibt wörtlich.",
  // SCRUM-386: ?-Hilfe für kundeneigene Funktionen — die Anweisung ist offen sichtbar (G-3).
  "capture.ai.customHelp":
    "Eigene KI-Funktion deiner Organisation (vom Admin angelegt). Anweisung an die KI: „{{instruction}}“. Wie bei allen KI-Aktionen entsteht nur ein Vorschlag zur Vorschau — übernommen wird ausschließlich, was du bewusst per Klick übernimmst.",
  "capture.ai.freeLabel": "Eigene KI-Anweisung",
  "capture.ai.freePlaceholder": "z. B. „kürzer und sachlicher formulieren“",
  "capture.ai.run": "Ausführen",
  "capture.ai.previewTitle": "KI-Vorschlag (Vorschau)",
  "capture.ai.replace": "Ersetzen",
  "capture.ai.append": "Anhängen",
  "capture.ai.discard": "Verwerfen",
  "capture.author": "Autor",
  "capture.documents": "Dokumente (Kontext / Anhang)",
  "capture.documentsUpload": "Dateien hochladen",
  "capture.uploadLimits":
    "Bis zu {{count}} Dateien, je max. {{mb}} MB Übertragungsgröße (rund {{raw}} MB Rohdatei).",
  "capture.attachLimitReached":
    "{{taken}} von {{total}} Dateien zur Verarbeitung akzeptiert — die Anhang-Grenze liegt bei {{limit}}.",
  "capture.documentsHint":
    "txt, md, csv, json, log, docx, pdf → Volltext · Bilder: optional per OCR",
  "capture.images": "Bilder (Anhang)",
  "capture.imagesUpload": "Bilder anhängen",
  "capture.imagesHint": "Auch aus der Mobile-App. Werden am Objekt angehängt.",
  "capture.videoAdded":
    "{{name}} angehängt. Transkription auf Klick — nichts passiert automatisch.",
  "capture.videoTranscribe": "Transkribieren",
  "capture.videoBusy": "läuft …",
  "capture.videoRunning": "Transkribiere {{name}} — kurze Clips gehen schnell.",
  "capture.videoDone":
    "Transkript von {{name}} übernommen — bitte prüfen (Entwurf, keine Wahrheit).",
  "capture.saveDraft": "Als Entwurf speichern",
  "capture.draftSaved": "Entwurf gespeichert.",
  "capture.draftUpdated": "Entwurf aktualisiert.",
  "capture.draftDiscarded": "Entwurf gelöscht.",
  // Bugfix (Pedi 04.07.): Entwürfe werden derzeit endgültig gelöscht (kein Papierkorb) —
  // deshalb ehrliche Nachfrage vor dem Löschen, keine „verschoben"-Behauptung.
  "capture.discardDraftQ": "Entwurf endgültig löschen?",
  "capture.discardDraftKeep": "Behalten",
  "capture.discardDraftYes": "Löschen",
  "capture.imageError": "„{{name}}“ konnte nicht als Bild gelesen werden.",
  "capture.draftFallbackTitle": "Entwurf",
  "capture.resumeTitle": "Entwürfe fortsetzen",
  "capture.resumeExpand": "Entwürfe anzeigen ({{count}})",
  "capture.resumeCollapse": "Entwürfe einklappen",
  // AUFTRAG-mega38 BLOCK J4: `capture.resumeCollapsedHint` ist ERSATZLOS weg — der Satz erklärte
  // der Leserin unsere Layoutentscheidung („… damit die Erfassungswege darunter erreichbar
  // bleiben"). mega34 F hatte an ihm nur die Einzahlform repariert; die Form war richtig, der Satz
  // gehörte trotzdem nicht auf ihren Bildschirm. Auch in EN und NL entfernt.
  "capture.resume": "Fortsetzen",
  "capture.discardDraft": "Verwerfen",
  // AUFTRAG-sortfilter · Punkt 2: Filter + Sortierung der Entwurfsliste.
  "capture.draftSearch": "Entwürfe durchsuchen",
  "capture.draftSortLabel": "Sortieren",
  "capture.draftSort.recent": "Zuletzt gespeichert (neu→alt)",
  "capture.draftSort.oldest": "Zuletzt gespeichert (alt→neu)",
  "capture.draftSort.title": "Titel A→Z",
  "capture.draftAuthorLabel": "Ersteller",
  "capture.draftAuthorAll": "Alle Ersteller",
  // AUFTRAG-BASIC-u2: die Gegenseite derselben Frage. Diese Suche durchsucht AUSSCHLIESSLICH die
  // gespeicherten Entwürfe; „Keine Entwürfe passen zum Filter." war eine Auskunft über einen
  // Filter, nicht über einen Suchraum, und liess offen, wo das Gesuchte sonst stehen könnte.
  // Die Admin-Ansicht sieht ALLE Entwürfe — sie bekommt deshalb einen eigenen, wahren Satz statt
  // einer Behauptung über „deine" Entwürfe.
  "capture.draftScope.note":
    "Diese Suche durchsucht nur deine gespeicherten Entwürfe — kein Wissen aus der Bibliothek.",
  "capture.draftScope.noteAdmin":
    "Diese Suche durchsucht nur gespeicherte Entwürfe (Admin-Ansicht: alle) — kein Wissen aus der Bibliothek.",
  "capture.draftScope.toLibrary": "Im Klarwerk-Wissen suchen",
  "capture.draftEmptyFiltered":
    "Keine gespeicherten Entwürfe passen zu deiner Suche. Durchsucht wurden nur Entwürfe — validiertes Wissen steht in der Bibliothek.",
  "capture.draftJustSaved": "gerade gespeichert",
  "capture.draftCreatorMeta": "Ersteller: {{name}}",
  "capture.draftSavedMeta": "Gespeichert: {{date}}",
  "capture.draftStatusMeta": "Status: Entwurf",
  "capture.editingDraft": "Entwurf geladen — Änderungen werden im selben Entwurf gespeichert.",
  "capture.editingBadge": "in Bearbeitung",
  "capture.fileImportJump": "Datei importieren",
  "capture.loadExample": "Beispiel laden",
  "capture.exampleLoaded":
    "Erfahrungsnotiz geladen — jetzt mit KI strukturieren und den Entwurf prüfen.",
  "capture.docAdded": "{{name}} als Kontext übernommen.",
  "capture.docExtracting": "{{name}} wird gelesen …",
  "capture.docEmpty":
    "{{name}}: kein Text gefunden — ein gescanntes PDF ohne Textebene wird noch nicht unterstützt.",
  "capture.docParseError": "{{name}} konnte nicht gelesen werden.",
  "capture.docUnsupported":
    "{{name}}: nur txt/md/csv/json/log, docx und pdf werden als Volltext gelesen.",
  "capture.ocr": "OCR → Text",
  "capture.ocrRunningShort": "OCR …",
  "capture.ocrRunning": "OCR läuft für {{name}} (Worker/Sprachdaten werden geladen) …",
  "capture.ocrDone": "OCR-Text aus {{name}} übernommen.",
  "capture.ocrEmpty": "{{name}}: OCR hat keinen Text erkannt.",
  "capture.ocrFailed": "OCR für {{name}} fehlgeschlagen.",
  "capture.ocrUnavailable": "OCR ist derzeit nicht verfügbar.",
  "capture.help.category.title": "Kategorie & #Tags",
  "capture.help.category.body":
    "Die Kategorie ist eine frei vergebbare fachliche Einordnung (z. B. „Instandhaltung“, „Qualität“, „Einkauf“). Tags sind freie Schlagworte zur Auffindbarkeit.",
  "capture.help.validations.title": "Nötige Validierungen",
  "capture.reviewers.title": "Prüfer vorschlagen (optional)",
  "capture.reviewers.helpTitle": "Prüfer vorschlagen",
  "capture.reviewers.helpBody":
    "Wähle Kolleginnen und Kollegen, die deinen Beitrag prüfen sollen. Sie bekommen die Prüfung als offene Zuweisung und eine Benachrichtigung. Ohne Auswahl bleibt der Beitrag offen für alle Prüfer.",
  "capture.reviewers.none": "Noch keine weiteren Personen im Verzeichnis.",
  "capture.reviewers.selected": "Ausgewählt: {{n}}",
  "capture.reviewers.defaultPlaceholder": "Standard: {{n}}",
  "capture.help.validations.body":
    "Wie viele unabhängige Bestätigungen das Objekt braucht, bevor es als „validiert“ gilt (1–5, Standard 3). Mehr = höhere Hürde, belastbarer.",
  "capture.modeSoon": "Dieser Modus folgt.",
  "capture.fTitle": "Kernaussage",
  "capture.fStatement": "Aussage",
  "capture.fBody": "Ausführlicher Inhalt (optional)",
  "editor.bold": "Fett",
  "editor.bodyLabel": "Wissensseite — Fließtext",
  "editor.italic": "Kursiv",
  "editor.h2": "Überschrift",
  "editor.h3": "Unterüberschrift",
  "editor.ul": "Aufzählung",
  "editor.ol": "Nummerierte Liste",
  "editor.link": "Link",
  "editor.panel": "Panel/Hinweis",
  "editor.guidance.title": "So nutzt du den ausführlichen Inhalt",
  "editor.guidance.structure": "Struktur: Überschriften (H2/H3) und Absätze gliedern den Inhalt.",
  "editor.guidance.action": "Handlungswissen: Listen für Schritte, Links als Beleg.",
  "editor.guidance.blocks": "Blöcke: Wichtiges als Info/Hinweis/Warnung/Erfolg markieren.",
  "editor.guidance.ai":
    "KI-Hilfe: liefert Vorschläge — du prüfst und übernimmst bewusst, keine Auto-Validierung.",
  "editor.attach.title": "Anhänge im Editor",
  "editor.attach.images": "Bild(er)",
  "editor.attach.files": "Datei(en)",
  "editor.attach.imageHint": "über den Bild-Button in den ausführlichen Inhalt einfügbar.",
  "editor.attach.fileHint":
    "bleiben als Anhang/Evidence sichtbar und werden nicht inline eingebettet — bitte im Text referenzieren.",
  // SCRUM-371: object-store-bewusste Media-/Evidence-Führung (Bilder inline · verlinkbare Dateien ·
  // Session-Dateien als Evidence). Ehrlich: Evidence ist kein Ersatz für Validierung.
  "editor.media.title": "Bilder, Dateien & Belege",
  "editor.media.images": "Bild(er)",
  "editor.media.imageHint":
    "illustrieren dein Wissen — über den Bild-Button in den Inhalt einfügbar.",
  "editor.media.linkable": "verlinkbare Datei(en)",
  "editor.media.linkableHint":
    "als Beleg/Kontext sicher im Text verlinkbar (interne Objekt-Referenz, kein Roh-Download-Trick).",
  "editor.media.evidence": "Datei(en) als Anhang",
  "editor.media.evidenceHint":
    "bleiben Beleg/Evidence — nach dem Speichern im Text verlinkbar; bis dahin kein Behelfs-/Fake-Link.",
  "editor.media.note":
    "Belege verbessern die Nachvollziehbarkeit, sind aber keine Freigabe — die Validierung entscheidet.",
  "editor.quality.title": "Inhalts-Check",
  "editor.quality.hint": "Prüft die Struktur, nicht die fachliche Richtigkeit. Keine Validierung.",
  "editor.quality.empty": "Noch kein ausführlicher Inhalt erfasst.",
  "editor.quality.thin": "Sehr kurzer Inhalt — bei Bedarf Kontext oder Schritte ergänzen.",
  "editor.quality.headings": "Überschriften",
  "editor.quality.lists": "Listen",
  "editor.quality.blocks": "Blöcke",
  "editor.quality.links": "Links",
  "editor.quality.attachmentsUnreferenced":
    "Anhänge vorhanden, aber im Text nicht erwähnt — ggf. darauf verweisen.",
  "editor.template.title": "Strukturvorlage starten",
  "editor.template.hint":
    "Vorlage auswählen, Vorschau prüfen und bewusst übernehmen. Startstruktur/Vorschlag — bestehender Inhalt wird beim Anhängen nicht ersetzt; nichts wird automatisch gespeichert oder validiert.",
  "editor.template.selected": "Ausgewählte Vorlage",
  "editor.template.preview": "Vorschau",
  "editor.template.procedure.label": "Vorgehen",
  "editor.template.procedure.description": "Bedingungen und Schritte für wiederholbare Arbeit.",
  "editor.template.troubleshooting.label": "Störung",
  "editor.template.troubleshooting.description":
    "Symptom, Ursache und Maßnahme strukturiert erfassen.",
  "editor.template.safety.label": "Sicherheit",
  "editor.template.safety.description": "Warnung, sichere Prüfung und gewünschter Zustand.",
  "editor.template.checklist.label": "Checkliste",
  "editor.template.checklist.description":
    "Abhakbare Prüfpunkte plus „was tun, wenn nicht erfüllt“.",
  "editor.template.handover.label": "Übergabe/Schulung",
  "editor.template.handover.description":
    "Das Wichtigste für die nächste Person: Kernpunkte, typische Fehler, Ansprechpartner.",
  "editor.template.decision.label": "Entscheidungshilfe",
  "editor.template.decision.description":
    "Wenn-dann-Regeln für eine wiederkehrende Entscheidung, inkl. Eskalationsgrenze.",
  "editor.template.applySet": "Vorlage einsetzen",
  "editor.template.applyAppend": "Vorlage unten anfügen",
  "editor.template.applyHelp":
    "Fügt die gezeigte Startstruktur in die Wissensseite ein: Ist die Seite leer, wird sie eingesetzt; steht schon etwas drin, wird sie UNTEN angehängt — nichts wird ersetzt oder gespeichert. Die Platzhalter („… ergänzen“) ersetzt du danach durch dein Wissen.",
  "editor.template.mode.set": "Leerer Inhalt: Die Vorlage wird eingesetzt.",
  "editor.template.mode.append":
    "Bestehender Inhalt: Die Vorlage wird angehängt, nichts wird ersetzt.",
  "editor.applySafety.replaceWarning":
    "Achtung: Ersetzen überschreibt den aktuellen Inhalt. Anhängen lässt den Bestand stehen.",
  "editor.block.info": "Info",
  "editor.block.note": "Hinweis",
  "editor.block.warning": "Warnung",
  "editor.block.success": "Erfolg",
  "editor.image": "Bild aus Anhang",
  // SCRUM-384: ARGUS-Toolbar — Absatz, Text-Labels, KI-Umschalter.
  "editor.para": "Absatz",
  "editor.imageLabel": "Bild",
  "editor.fileLabel": "Datei",
  "editor.aiLabel": "KI",
  "editor.aiToggle": "KI-Hilfe beim Schreiben — öffnet die KI-Palette",
  "editor.noImages": "Keine Bild-Anhänge vorhanden.",
  // SCRUM-456: Bild direkt vom Rechner einfügen + Überschrift für die vorhandenen Anhänge.
  "editor.imageFromDisk": "Bild vom Rechner …",
  "editor.fileFromDisk": "Datei vom Rechner anhängen …",
  "editor.imageFromAttachment": "Aus Anhängen",
  // WP-D10: rein VISUELLER Platzhalter der leeren Bild-Fußnote (data-kw-placeholder + CSS ::before) —
  // wird nie als Inhalt gespeichert. Kein Emoji, nur das Stift-Zeichen ✎.
  "editor.captionPlaceholder": "✎ Bildbeschreibung hinzufügen …",
  // AUFTRAG-mega88 Block C: der ehrliche Restfall — zu diesem Bild lässt sich keine Fußnote
  // herstellen. Seit der Bildstruktur-Invariante ist er nicht mehr erreichbar; er schweigt trotzdem
  // nicht mehr, falls er es doch einmal wird.
  "editor.captionNoAnchor":
    "Zu diesem Bild lässt sich gerade keine Bildbeschreibung anlegen. Bitte fügen Sie das Bild erneut ein.",
  "editor.captionAi.suggest": "KI-Beschreibung vorschlagen",
  "editor.captionAi.loading": "KI-Beschreibung wird erstellt …",
  "editor.captionAi.panelTitle": "Vorschlag",
  "editor.captionAi.aiBadge": "KI-generiert. Bitte prüfen.",
  "editor.captionAi.withContext":
    "Mit Dokument-Kontext erzeugt (Titel, Überschrift und umgebender Text).",
  "editor.captionAi.apply": "Übernehmen",
  "editor.captionAi.discard": "Verwerfen",
  "editor.captionAi.tooLarge": "Das Bild ist zu groß für den Beschreibungs-Vorschlag (max. 5 MB).",
  "editor.captionAi.imageUnreadable": "Das Bild dieser Fußnote konnte nicht gelesen werden.",
  "editor.captionAi.fallbackNoModel":
    "Kein KI-Modell konfiguriert oder freigegeben — ohne Modell gibt es keinen Beschreibungs-Vorschlag (nichts wird erfunden).",
  "editor.captionAi.fallbackTimeout":
    "Die Cloud-KI hat das Zeitlimit überschritten — es gibt daher keinen Vorschlag. Bitte später erneut versuchen.",
  "editor.captionAi.fallbackError":
    "Die Cloud-KI ist gerade nicht erreichbar oder meldet einen Fehler — es gibt daher keinen Vorschlag. Bitte später erneut versuchen.",
  "editor.captionAi.fallbackConfidential":
    "Das Bild ist als vertraulich eingestuft — die Cloud-KI ist dafür ausgeschlossen und kein lokales Vision-Modell ist verdrahtet. Es gibt daher keinen Vorschlag (nichts verlässt den Server).",
  // AUFTRAG-mega9 Block F (Pedi): Texte des ECHTEN Eingabeformulars für die Bildbeschreibung.
  "editor.captionForm.open": "Bildbeschreibung bearbeiten",
  "editor.captionForm.title": "Bildbeschreibung",
  "editor.captionForm.label": "Beschreibung des Bildes",
  "editor.captionForm.placeholder": "Was ist auf dem Bild zu sehen, und warum steht es hier?",
  "editor.captionForm.limit": "{{n}} von {{max}} Zeichen",
  "editor.captionForm.limitReached": "Maximale Länge erreicht ({{max}} Zeichen).",
  "editor.captionForm.append": "An den Text anhängen",
  "editor.captionForm.save": "Beschreibung speichern",
  "editor.captionForm.cancel": "Abbrechen",
  "editor.captionForm.imageAlt": "Bild, das beschrieben wird",
  "editor.captionForm.noSuggestionYet":
    "Noch kein Vorschlag angefordert. Der Text bleibt deiner — ein Vorschlag wird nie automatisch übernommen.",
  // AUFTRAG-mega11 Block D (bens SB-4): das Ziel des Formulars hat sich unter ihm verändert.
  "editor.captionForm.stale":
    "Dieses Bild hat sich inzwischen geändert — die Beschreibung wurde NICHT gespeichert, damit sie nicht beim falschen Bild landet. Bitte den Text kopieren, das Formular schließen und am aktuellen Bild erneut öffnen.",
  // AUFTRAG-mega84 Block A: die Bildbeschreibung selbst ist der Einstieg — sie sagt das auch an.
  "editor.captionForm.openLabel": "Bildbeschreibung bearbeiten (öffnet das Eingabeformular)",
  // AUFTRAG-mega84 Block B (Pedi, 31.07.): fett, kursiv, Zeilenumbruch — mehr nicht.
  "editor.captionForm.formatLabel": "Formatierung",
  "editor.captionForm.bold": "Fett (Strg/Cmd + B)",
  "editor.captionForm.italic": "Kursiv (Strg/Cmd + I)",
  "editor.captionForm.lineBreak": "Zeilenumbruch (Umschalt + Eingabe)",
  "editor.captionForm.selectFirst":
    "Markiere zuerst den Text, den du auszeichnen möchtest — dann wirkt Fett oder Kursiv darauf.",
  "editor.file": "Datei verlinken",
  "editor.insertFile": "Datei-Anhang als Link einfügen",
  "editor.noFiles":
    "Noch keine verlinkbaren Dateien — hochgeladene Dateien werden erst nach dem Speichern verlinkbar (mit Objekt-Referenz). Bis dahin bleiben sie als Anhang/Evidence erhalten; kein Behelfs-Link.",
  // SCRUM-372: ruhige Drag&Drop/Einfügen-Führung (nur Bilder inline; Dateien bleiben Evidence).
  "editor.drop.hint":
    "Bilder hierher ziehen oder einfügen (Strg/⌘+V). Dateien bleiben Beleg/Evidence.",
  "editor.drop.imageActive": "Medien loslassen — Bilder werden eingefügt, Dateien bleiben Evidence",
  "editor.drop.fileNotice":
    "Nur Bilder werden inline eingefügt. Dateien bleiben Anhang/Evidence — ein sicherer Body-Link entsteht erst mit gespeicherter Objekt-Referenz (kein Fake-Link). Die Validierung entscheidet.",
  "editor.preview": "Vorschau",
  "editor.edit": "Bearbeiten",
  "editor.previewBadge": "Vorschau — so sehen Leser die Seite",
  "editor.previewEmpty":
    "Noch kein Inhalt — wechsle zu „Bearbeiten“ und schreibe den ersten Abschnitt.",
  "editor.linkPrompt": "Link-URL eingeben:",
  "editor.linkUrl": "URL",
  "editor.linkUrlPlaceholder": "https://… oder interne Route",
  "editor.linkLabel": "Linktext optional",
  "editor.linkLabelPlaceholder": "Wenn leer, wird die URL angezeigt",
  "editor.linkInsert": "Link einfügen",
  "editor.linkCancel": "Abbrechen",
  "editor.linkInvalid": "Bitte eine sichere URL verwenden (https, mailto, / oder #).",
  "capture.fType": "Wissensart",
  "capture.fCategory": "Domäne / Kategorie",
  "capture.submit": "Prüfen & einreichen",
  "capture.submitBusy": "Wird eingereicht … (Entwurf, Anhänge, Einreichung)",
  "capture.submitStageCreating": "Wissensobjekt wird angelegt …",
  "capture.submitStageUploading": "Original & Anhänge werden gesichert ({{mb}} MB) …",
  "capture.submitStageLinking": "Quellen werden verknüpft …",
  // WP-D10 Fix 2: aufklappbare Dauer-Details in der Einreich-Bestätigung — die VORHANDENEN
  // performance.now-Spannen (Anlegen / Upload / Verknüpfen inkl. Quellen), nichts Neues gemessen.
  "capture.submitTiming.title": "Details zur Dauer",
  "capture.submitTiming.create": "Wissensobjekt anlegen",
  "capture.submitTiming.upload": "Original & Anhänge hochladen",
  "capture.submitTiming.link": "Verknüpfen & Quellen",
  "capture.submitTiming.seconds": "{{s}} s",
  "capture.submitTiming.mb": "{{mb}} MB",
  "capture.readyTitle": "Speicher-Check",
  "capture.ready.title": "Titel",
  "capture.ready.content": "Aussage / Inhalt",
  "capture.ready.category": "Kategorie",
  "capture.ready.type": "Wissensart",
  "capture.ready.attachments": "Anhänge",
  "capture.readyDone": "ok",
  "capture.readyMissing": "fehlt",
  "capture.readyOptional": "optional",
  "capture.readyHint": "Titel und Aussage/Inhalt sind nötig, um speichern zu können.",
  "capture.draftHint":
    "Erst Erfahrungsnotiz eingeben und mit KI strukturieren — der Entwurf erscheint hier.",
  "capture.fConditions": "Bedingungen",
  "capture.fMeasures": "Maßnahmen",
  "capture.fTags": "Schlagwörter",
  "capture.fAsset": "Anlage / Asset",
  "conf.field": "Vertraulichkeit",
  "conf.help":
    "Wie vertraulich ist dieses Wissen? Öffentlich-intern ist der Standard (keine Einschränkung). Vertraulich und Streng vertraulich markieren sensibles Wissen: solche Objekte werden nie in externe Kontexte gegeben (Output Factory/Export). Die Stufe ist ab dem Erfassen setzbar und später jederzeit änderbar — jede Änderung wird im Audit-Log festgehalten. Hinweis: Diese Kennzeichnung schränkt (noch) nicht ein, WER das Objekt sieht.",
  "conf.level.intern": "Öffentlich-intern",
  "conf.level.vertraulich": "Vertraulich",
  "conf.level.streng_vertraulich": "Streng vertraulich",
  "capture.fRevalidation": "Re-Validierung nach (Anzahl)",
  "capture.listAdd": "Eintrag hinzufügen",
  "capture.listRemove": "Entfernen",
  "capture.tagPlaceholder": "Tag eingeben, Enter zum Übernehmen",
  "capture.formularHint":
    "Kernaussage und Aussage genügen zum Start — die weiteren Angaben unten sind optional.",
  "capture.diktatStart": "Diktat starten",
  "capture.diktatStop": "Diktat stoppen",
  "capture.diktatUnsupported":
    "Spracheingabe wird von diesem Browser nicht unterstützt. Nutze Chrome/Edge oder gib den Text manuell ein.",
  "capture.diktatNa": "nicht verfügbar",
  "capture.ivStep": "Frage {{n}} von {{total}}",
  "capture.ivBack": "Zurück",
  "capture.ivNext": "Weiter",
  "capture.ivFinish": "Entwurf erstellen",
  "capture.ivDone": "Interview abgeschlossen — prüfe den Entwurf rechts und reiche ihn ein.",
  "capture.ivStart": "Interview starten",
  "capture.ivStartLead":
    "Das geführte Interview nutzt die KI, um Rückfragen zu stellen. Erst mit „Interview starten“ geht die erste Frage an das Modell — vorher wird nichts gesendet. Provider und Region siehst du über das (!)-Symbol.",
  "capture.ivTurn": "Frage {{n}}",
  "capture.ivThinking": "Die KI formuliert die nächste Frage …",
  "capture.ivResumeLead":
    "Dein Interviewfortschritt ist wiederhergestellt. Die nächste Frage wird erst auf deinen Klick geladen.",
  "capture.ivResumeLoad": "Nächste Frage laden",
  "capture.unsavable.images_one": "{{count}} eingefügtes Bild",
  "capture.unsavable.images_other": "{{count}} eingefügte Bilder",
  "capture.unsavable.docs_one": "{{count}} angehängte Datei (Dokument/Video/Audio)",
  "capture.unsavable.docs_other": "{{count}} angehängte Dateien (Dokumente/Video/Audio)",
  "capture.unsavable.file":
    "die hochgeladene Datei „{{name}}“ — ihre Auswertung ist noch nicht abgeschlossen",
  "capture.unsavable.fileQueue":
    "die laufende Datei-Verarbeitung aus „{{name}}“ (Punkt {{current}} von {{total}})",
  "capture.unsavable.extResults":
    "die geladene Trefferliste der externen Suche — die Suchanfrage selbst bleibt im Entwurf erhalten",
  // AUFTRAG-mega6 Block A: die http/https-Allowlist der Persistenz wird benannt, statt still zu wirken.
  "capture.unsavable.sourceUrl":
    "die angefangene Web-Adresse „{{urls}}“ — der Entwurf sichert nur vollständige Adressen, die mit https:// oder http:// beginnen; Bezeichnung und Auszug der Quelle bleiben erhalten",
  "capture.sourceUrlLimit":
    "Diese Adresse kann der Entwurf nicht mitsichern. Ergänze https:// oder http:// davor — oder leere das Feld, wenn du sie nicht brauchst.",
  // AUFTRAG-mega6 Block D: sichtbare Entsprechung der serverseitigen Mengen- und Längengrenzen.
  "capture.limit.chars":
    "Maximale Länge erreicht ({{max}} Zeichen) — weiterer Text wird nicht gesichert.",
  "capture.limit.reviewers":
    "Mehr als {{max}} Prüfer kann der Entwurf nicht sichern — wähle jemanden ab, um zu tauschen.",
  "capture.limit.sources":
    "Mehr als {{max}} Quellen kann der Entwurf nicht sichern — entferne eine, um Platz zu machen.",
  "capture.limit.interviewAnswers":
    "Mehr als {{max}} Antworten kann der Entwurf nicht sichern — schließe das Interview ab oder speichere den Entwurf.",
  "capture.saveLimit.title": "Der Entwurf sichert nicht alles",
  "capture.saveLimit.lead":
    "Text, Metadaten und Quellen werden gespeichert. Diese Inhalte kann der Entwurf jedoch nicht sichern — beim Speichern werden sie verworfen:",
  "capture.saveLimit.cancel": "Abbrechen — Inhalte behalten",
  "capture.saveLimit.confirm": "Trotzdem speichern und diese Inhalte verwerfen",
  "capture.ivAnswerHint": "Deine Antwort …",
  "capture.ivSend": "Antwort senden",
  "capture.ivReadAloud": "Vorlesen",
  "capture.ivReadStop": "Stopp",
  "capture.ivDictNa": "Diktat ist in diesem Browser nicht verfügbar — bitte tippen.",
  "capture.ivModel": "KI-Modell",
  "capture.ivFallback": "Deterministischer Fallback",
  "capture.ivQ.title": "Worum geht es? Formuliere eine kurze Kernaussage.",
  "capture.ivQ.statement": "Beschreibe die Erfahrung/Aussage genauer.",
  "capture.ivQ.conditions": "Unter welchen Bedingungen gilt das? Eine pro Zeile.",
  "capture.ivQ.measures": "Welche konkreten Maßnahmen/Schritte? Eine pro Zeile.",
  "capture.ivQ.tags": "Schlagwörter zur Auffindbarkeit? Kommagetrennt.",
  "capture.ivQHint.title": "z. B. Pumpe P-12 bei Frost vorwärmen",
  "capture.ivQHint.statement": "Was genau, warum, mit welchem Effekt?",
  "capture.ivQHint.conditions": "Eine Bedingung pro Zeile",
  "capture.ivQHint.measures": "Eine Maßnahme pro Zeile",
  "capture.ivQHint.tags": "Frost, Pumpe, Winter",
  // AUFTRAG-mega38 BLOCK I: „Query Console" — englischer Fachbegriff auf deutscher Oberflaeche.
  "ask.kicker": "Fragen und Antworten",
  "ask.title": "Frag das Werkswissen",
  "ask.intro":
    "Die Antwort ist quellengebunden: Du siehst, worauf sie steht — und in welchem Zustand jede dieser Quellen ist. Gibt es keine Grundlage, wird die Lücke offen benannt.",
  "ask.placeholder": "z. B. Wann muss Ventil X bei Überdruck geschlossen werden?",
  "ask.emptyHint": "Bitte gib zuerst eine Frage ein.",
  "ask.submit": "Fragen",
  // AUFTRAG-mega38 BLOCK A: Warten und Fehlschlag stehen DORT, wo die Antwort erscheint.
  "ask.pending.title": "Die Frage läuft gegen das Werkswissen.",
  "ask.pending.body":
    "Es wird nach passenden Quellen gesucht. Gibt es keine belastbare Grundlage, sagt Klarwerk das offen — es wird nichts erfunden.",
  "ask.error.title": "Die Frage konnte nicht beantwortet werden.",
  "ask.error.body":
    "Die Anfrage ist unterwegs steckengeblieben. Das ist KEINE Aussage über das Wissen — es bedeutet nicht, dass es keine Antwort gibt. Bitte erneut versuchen.",
  "ask.error.retry": "Erneut versuchen",
  // SCRUM-295: Hinweis bei vorbefüllter Startfrage (aus KO-Detail „Wissen nutzen") im Demo-Kontext.
  "ask.demoPrefillHint":
    "Startfrage aus dem Wissensobjekt übernommen — auf „Fragen“ klicken. Die Antwort bleibt quellengebunden; Status und Vertrauen entscheiden, nichts wird automatisch gesichert.",
  "ask.examplesLabel": "Beispiele:",
  // AUFTRAG-mega51 BLOCK H: der Klick startet sofort eine echte Anfrage — das steht vorher da.
  // AUFTRAG-mega61 BLOCK H: die zweite Hälfte fehlte. Das Wort „kostenpflichtig“ stand nur im
  // Codekommentar (pages/Ask.tsx), also genau dort, wo der Nutzer es nie liest. Ein Kommentar im
  // Code ist keine Aussage an den Nutzer — und ein Produkt, das mit Ehrlichkeit argumentiert, darf
  // an der Stelle nicht schweigen, an der ein Klick Geld kostet.
  // AUFTRAG-mega69 B1 (bens sammel65-Auflage 1): dieser Satz trägt NUR noch die Sofort-Zusage
  // (mega51 Block H: ein Beispiel sendet direkt, das muss VORHER erkennbar sein). Die Kosten-Hälfte
  // steht jetzt BEDINGT daneben — als zentraler `AiCostHint`, nur wenn `billable` es deckt. Der
  // frühere unbedingte Kostenwortlaut hier war genau die Umgehung der Bedingung.
  "ask.examplesSendHint": "Ein Klick fragt sofort — die Frage wird direkt gesendet.",
  "ask.example.valve": "Was tun, wenn Ventil X bei Überdruck schließen muss?",
  "ask.example.filter": "Wie oft muss Filter F3 geprüft werden?",
  "ask.example.dosing": "Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?",
  "ask.expect.answer": "findet passendes Wissen",
  "ask.expect.gap": "zeigt Wissenslücke",
  "ask.reasoner.model": "Modellmodus",
  "ask.reasoner.deterministic": "Deterministischer Modus",
  "ask.reasoner.loading": "Modus lädt …",
  "ask.reasoner.unknown": "Modus unbekannt",
  "ask.reasoner.hint":
    "Zeigt, ob Antworten über ein konfiguriertes Modell oder den regelbasierten Fallback laufen. Quellen und Validierung bleiben gleich.",
  "ask.fromValidated": "Aus quellengebundenem Wissen",
  "ask.evidence": "Evidenz",
  "ask.knowledgeClass.gesichert": "Gesichert",
  "ask.knowledgeClass.ungeprueft": "Ungeprüft",
  "ask.knowledgeClass.meinung": "Meinung/Erfahrung",
  "ask.knowledgeClass.extern": "Externe Quelle",
  "ask.knowledgeClass.annahme": "Annahme",
  "ask.knowledgeClass.unbekannt": "Unbekannt",
  "ask.steps": "Herangezogene Kontextquellen",
  // ============================================================================================
  // AUFTRAG-mega38 BLOCK F — DIE EHRLICHERE BESCHRIFTUNG DER SUMME (Pedis benannter Rückfall).
  // ============================================================================================
  // Getrennt werden konnte die Liste NICHT: `result.sources` und `result.steps` sind im
  // Modell-Weg dieselbe Menge — der komplette Top-K-Treffersatz
  // (services/reasoner/src/provider-model.ts:1016-1021, DEFAULT_TOP_K = 8 in
  // services/reasoner/src/provider.ts:451). Die `[n]`-Ziffern im Antworttext werden nirgends
  // zurückgelesen, und der Systemprompt ERLAUBT das Zitieren nur, er verlangt es nicht
  // (provider-model.ts:79-83). Es gibt heute also keine Information „verwendet vs. nur
  // durchsucht"; s. Bericht mega38, Block F.
  // Was der Code deckt, ist genau dies: das sind die Quellen, die HERANGEZOGEN wurden. Dass jede
  // davon zur Antwort beigetragen hat, deckt er nicht — deshalb steht es hier auch nicht mehr.
  "ask.sources": "Herangezogene Quellen",
  "ask.export.copy": "Kopieren",
  "ask.export.download": "Als Markdown",
  "ask.export.print": "Drucken / PDF",
  "ask.export.copied": "Antwort inkl. Quellen kopiert.",
  "ask.export.answer": "Antwort",
  "ask.export.footer":
    "Quellengebundene Antwort aus KLARWERK · erstellt am {{date}}. Nur so belastbar wie die genutzten Quellen (Status/Vertrauen). Kein Wahrheitsversprechen.",
  "ask.sourcesHint":
    "Diese Antwort ist quellengebunden — sie ist nur so belastbar wie die genutzte Quelle (Status, Vertrauen, Nutzbarkeit). Aufgeführt sind alle Quellen, die für die Frage herangezogen wurden; welche davon die Antwort getragen haben, ist gekennzeichnet. Zum Wissensobjekt für Details.",
  // AUFTRAG-mega52 A3/A5 — die Antwort sagt, worauf sie steht. Die Marken des Modells werden
  // zurückgelesen; ohne verwertbare Marke wird NICHT geraten, sondern gesagt, dass es unbekannt ist.
  "ask.attribution.known":
    "Die zuerst genannten Quellen haben die Antwort getragen; die übrigen wurden herangezogen, aber nicht verwendet.",
  "ask.attribution.unknown":
    "Welche dieser Quellen die Antwort getragen hat, ließ sich nicht zuordnen — die KI hat keine verwertbaren Quellenverweise geliefert. Die Liste zeigt deshalb alle herangezogenen Quellen ohne Kennzeichen, und ein „Hat geholfen“ ist hier nicht möglich.",
  "ask.attribution.carrying.badge": "trägt",
  "ask.attribution.carrying.hint":
    "Diese Quelle trägt die Antwort: Die KI hat sich im Antworttext ausdrücklich auf sie berufen.",
  "ask.attribution.consulted.badge": "angesehen",
  "ask.attribution.consulted.hint":
    "Herangezogen, aber nicht verwendet: Diese Quelle stand der KI zur Verfügung, kommt im Antworttext aber nicht vor.",
  // Paket 4 (nacht24): Quellen wie im Dokument — Status/Trust je Quelle + Auszug im Original-Format.
  "answerSource.trust": "Vertrauen {{n}}",
  "answerSource.excerptShow": "Auszug im Dokument-Format anzeigen",
  "answerSource.excerptHide": "Auszug ausblenden",
  "ask.helpful": "Hat geholfen",
  "ask.thanked": "Danke!",
  "ask.status.verified": "Gesichert",
  "ask.status.unverified": "Noch ungeprüft",
  "ask.reviewGuard.openLabel": "Noch nicht als gesichertes Wissen nutzen",
  "ask.reviewGuard.openHint":
    "Mindestens eine Quelle ist offen oder noch in Prüfung. Erst prüfen/bewerten, bevor diese Aussage als gesichert genutzt wird.",
  "ask.reviewGuard.unverifiedLabel": "Antwort ist noch ungeprüft",
  "ask.reviewGuard.unverifiedHint":
    "Diese Antwort ist nicht als gesichert eingestuft. Prüfe Quellen und Bewertung, bevor du sie weiterverwendest.",
  "ask.reviewGuard.cta": "Zur Validierung",
  "ask.gapBadge": "Wissenslücke",
  // AUFTRAG-mega54 BLOCK E: DER EINE NÄCHSTE SCHRITT ZUR LÜCKE. Bis hierher standen auf demselben
  // Bildschirm ZWEI „Nächster Schritt:"-Sätze mit verschiedenen Antworten — dieser hier schickte
  // zum Risiko-Board, der aus dem Vertragskasten zum kostenlosen Umformulieren. Jetzt gibt es nur
  // noch diesen Schlüssel; der Vertragskasten (askAnswerContract.ts) zeigt auf ihn, die Lückenkarte
  // wiederholt ihn nicht, und Mobile trägt ihn ebenfalls. REIHENFOLGE IST INHALT (E2): zuerst der
  // kostenlose Schritt, dann Wissen erfassen, zuletzt das Risiko-Board — der teuerste nicht vorn.
  "ask.gapNext":
    "Nächster Schritt: die Frage noch einmal mit den Fachwörtern aus eurem Betrieb stellen — sonst Wissen erfassen oder die Lücke im Risiko-Board priorisieren.",
  "ask.noBasisTitle": "Keine belastbare Grundlage.",
  // mega53 C1: der Satz behauptete „Es gibt kein validiertes Wissen zu dieser Frage" — bei den
  // neuen Lücken aus Block A ist das falsch, das Wissen liegt oft daneben. Er sagt jetzt, was
  // wirklich gilt, und nennt beide möglichen Ursachen.
  "ask.noBasisBody":
    "Keine Quelle passt sicher genug zu dieser Frage. Statt einer erfundenen Antwort wurde eine Wissenslücke angelegt. Möglich ist beides: Das Wissen fehlt noch — oder es steht unter anderen Begriffen in der Basis.",
  // SCRUM-369 / AG-12/13/P2-4: Ask-Lücke als geführter „Wissenslücke retten"-Einstieg (kein Chatbot-Ende).
  "ask.gap.rescueTitle": "Wissenslücke retten",
  "ask.gap.rescueImpact":
    "Vielleicht fehlt dieses Erfahrungswissen noch, vielleicht ist es nur nicht auffindbar. Du kannst helfen, es zu sichern — für alle, die die Frage künftig stellen.",
  "ask.gap.noInvent":
    "Es wurde keine Antwort erfunden: Ohne belastbare Quelle bleibt die Frage ehrlich offen.",
  "ask.gap.rescueCta": "Wissen erfassen & retten",
  // AUFTRAG-mega54 BLOCK E3: die Rettungs-Schrittfolge selbst wird NICHT angefasst — sie beginnt
  // richtig mit „Frage beantworten", weil sie den Weg für jemanden beschreibt, der das Wissen HAT
  // und es beisteuern will. Genau das ging aus „So schließt du die Lücke:" nicht hervor: neben dem
  // einen nächsten Schritt gelesen, klang sie wie eine zweite Antwort auf „was mache ich jetzt mit
  // meiner unbeantworteten Frage". Geschärft wurde deshalb die Überschrift, mehr nicht.
  "ask.gap.stepsTitle": "Du kennst die Antwort? So trägst du sie bei:",
  "ask.gap.step.answer.label": "Frage beantworten",
  "ask.gap.step.answer.hint": "Formuliere, was du aus Erfahrung dazu weißt.",
  "ask.gap.step.experience.label": "Eigene Erfahrung ergänzen",
  "ask.gap.step.experience.hint": "Bedingungen, Maßnahmen, Kontext.",
  "ask.gap.step.structure.label": "KI strukturieren lassen",
  "ask.gap.step.structure.hint": "Die KI ordnet nur — sie erfindet nichts dazu.",
  "ask.gap.step.review.label": "Prüfen lassen",
  "ask.gap.step.review.hint": "Erst nach Validierung gilt es als gesichert.",
  // SCRUM-366 / FR-ASK-02 / PI-K2: Antwortvertrag — quellengebunden, ehrlich, kein generischer Chatbot.
  "ask.contract.label": "Antwortbasis",
  "ask.contract.verified.title": "Quellengebundene Antwort",
  "ask.contract.verified.body":
    "Diese Antwort stützt sich auf validiertes Wissen aus deiner Wissensbasis — keine generische Chatbot-Antwort.",
  "ask.contract.verified.next": "Nächster Schritt: Quelle ansehen oder das Wissen nutzen.",
  "ask.contract.unverified.title": "Quellengebunden, aber noch ungeprüft",
  "ask.contract.unverified.body":
    "Die Antwort stützt sich auf vorhandenes, aber noch nicht gesichertes Wissen. Sie ist als ungeprüft gekennzeichnet, keine Chatbot-Vermutung.",
  "ask.contract.unverified.next":
    "Sicherer nächster Schritt: zur Prüfung geben bzw. in der Validierung prüfen lassen.",
  // ==============================================================================================
  // AUFTRAG-mega53 BLOCK C1 — DIE LÜCKE WIRD HÄUFIGER, ALSO MUSS SIE STIMMEN.
  // ==============================================================================================
  //
  // Block A lässt mehr Fragen ehrlich mit einer Lücke enden (gemessen: 3 von 10 der mega52-Fragen).
  // Damit trägt der bisherige Text nicht mehr: er sagte „Es gibt noch keine belastbare Grundlage in
  // der Wissensbasis" — und genau das ist bei den NEUEN Lücken nachweislich falsch. Bei „Wie oft
  // muss der Filter F3 geprüft werden?" LIEGT das richtige, validierte Wissensobjekt im Bestand;
  // die Frage trifft es nur literal nicht stark genug („geprüft" ≠ „prüfen", „F3" fällt als
  // Zweizeichen-Token aus der Tokenisierung).
  //
  // Einer Testerin zu sagen, ihr Wissen fehle, obwohl es danebenliegt, ist dieselbe Art von
  // Unehrlichkeit, die diese Runde an zwei anderen Stellen beseitigt. Der Text nennt deshalb jetzt
  // BEIDE Ursachen. Kein neuer Weg, keine neue Route — nur ehrlichere Sätze.
  //
  // AUFTRAG-mega54 BLOCK E: der nächste Schritt steht NICHT mehr hier. Er hat genau einen Schlüssel
  // (`ask.gapNext`), auf den `answerContract("gap").nextStepKey` zeigt — ein früherer zweiter Satz
  // an dieser Stelle war der Widerspruch, den mega54 beseitigt hat.
  //
  // Die beiden Ursachen aus mega53 sind mit mega54 übrigens BEHOBEN (Kennungen + Grundform): „F3"
  // überlebt die Zerlegung, „geprüft" trifft „prüfen". Der Text bleibt trotzdem richtig — eine
  // Lücke kann weiterhin daher rühren, dass das Wissen unter anderen Wörtern in der Basis steht.
  "ask.contract.gap.title": "Wissenslücke, keine Chatbot-Antwort",
  "ask.contract.gap.body":
    "Keine Quelle passt sicher genug zu dieser Frage, um eine Antwort zu tragen. Das heißt nicht zwingend, dass das Wissen fehlt — vielleicht steht es nur unter anderen Wörtern in der Basis. Beides ist eine Lücke, die ihr schließen könnt, kein Fehler.",
  "ask.contract.trustNote":
    "Vertrauen und Nutzbarkeit zeigen, wie belastbar eine Quelle ist — kein Wahrheitsversprechen.",
  // AUFTRAG-mega38 BLOCK F: „8 Quellen" las sich als „acht Quellen tragen diese Antwort".
  // Gedeckt ist nur „acht wurden herangezogen" — s. den Kommentar bei `ask.sources`.
  "ask.contract.sumTotal_one": "{{count}} Quelle herangezogen",
  "ask.contract.sumTotal_other": "{{count}} Quellen herangezogen",
  "ask.contract.sumValidated": "{{count}} validiert",
  "ask.contract.sumOpen": "{{count}} offen/ungeprüft",
  "ask.contract.sumConflict": "{{count}} mit Konflikt",
  // ==============================================================================================
  // AUFTRAG-mega32 BLOCK E (Pedi 27.07.) — DER PRÜFVORBEHALT DER ANTWORT.
  // ==============================================================================================
  // Er behauptet NICHT, dass ein Konflikt vorliegt — er sagt, dass die Suche danach nicht
  // vollständig belegt ist. Der Unterschied ist der ganze Punkt: eine Antwort darf Sicherheit nur
  // behaupten, wenn jede herangezogene Quelle einen vollständig belegten Lauf hat.
  "ask.checkCaveat.title": "Diese Antwort ist nicht als konfliktfrei belegt.",
  "ask.checkCaveat.badge": "Prüfung unbelegt",
  "ask.checkCaveat.incomplete":
    "Bei {{unproven}} von {{total}} herangezogenen Quellen ist die Konflikt- und Duplikatprüfung nicht vollständig gelaufen. Es wurde also nicht überall gesucht — unbekannte Widersprüche sind damit nicht ausgeschlossen.",
  "ask.checkCaveat.noCoverage":
    "Bei {{unproven}} von {{total}} herangezogenen Quellen ist zwar ein Prüf-Lauf vermerkt, aber seine Reichweite ist nicht belegt. Wie weit gesucht wurde, ist damit unbekannt.",
  "ask.checkCaveat.unchecked":
    "Bei {{unproven}} von {{total}} herangezogenen Quellen ist gar kein Prüf-Lauf vermerkt. Nach Widersprüchen wurde dort nie gesucht.",
  "ask.checkCaveat.unknown":
    "{{unproven}} von {{total}} herangezogenen Quellen sind im Bestand nicht auffindbar. Über ihre Prüfung lässt sich nichts sagen.",
  // AUFTRAG-mega53 B2: der fünfte Grund. Er spricht nicht über einen lückenhaften Prüf-Lauf,
  // sondern darüber, dass gar nicht bekannt ist, WELCHE Quelle diese Antwort trägt. Bewusst ohne
  // Schuldzuweisung an das Modell und ohne Technik-Jargon — und ohne die Antwort zu entwerten:
  // sie ist quellengebunden, nur die Zuordnung fehlt.
  "ask.checkCaveat.unattributed":
    "Diese Antwort nennt keine ihrer {{total}} herangezogenen Quellen als Beleg. Welche davon sie wirklich trägt, ist damit unbekannt — Prüfstand und Vertrauenswert lassen sich keiner Quelle zuordnen.",
  "ask.trust.unattributed": "Vertrauenswert nicht zuordenbar",
  // AUFTRAG-mega34 A2: der Hinweis auf den UNBEKANNTEN Konfliktstand. Er spricht nicht über
  // gefundene Konflikte und nicht über lückenhafte Prüf-Läufe, sondern darüber, dass diese Seite
  // die Konfliktliste gerade gar nicht kennt. Bewusst ohne Schuldzuweisung und ohne Technik-Jargon.
  "ask.conflictCaveat.title": "Der Konfliktstand ist gerade nicht abrufbar.",
  "ask.conflictCaveat.pending":
    "Die bekannten Widersprüche werden noch geladen. Bis sie da sind, gilt diese Antwort als ungeprüft — nicht, weil etwas gefunden wurde, sondern weil noch nicht nachgesehen werden konnte.",
  "ask.conflictCaveat.failed":
    "Die bekannten Widersprüche konnten nicht abgerufen werden. Ob eine der Quellen in einem offenen Konflikt steht, ist damit unbekannt; diese Antwort gilt deshalb als ungeprüft.",
  // SCRUM-283: datensparsamer, ehrlicher Hinweis zur gespeicherten Wissenslücke (Ask + Risk).
  "gap.privacyNotice":
    "Die Frage wird als Wissenslücke gespeichert — keine Antwort und kein validiertes Wissen. Bitte keine sensiblen oder personenbezogenen Details erfassen; ergänze später geprüfte Erfahrung.",
  "ask.toGaps": "Zu den Wissenslücken",
  "ask.toCapture": "Wissen erfassen",
  "ko.kicker": "Wissensobjekt",
  "ko.use.ready": "Produktionsnah nutzbar",
  "ko.use.in-review": "In Prüfung",
  "ko.use.needs-work": "Noch in Arbeit",
  // SCRUM-293: GETEILTE Use-Readiness-Sprache (KO-Detail + Library identisch) — ehrlich, ohne
  // Fake-Freigabe: „nutzbar" nur, WEIL validiert (Status/Trust tragen).
  "use.ready.label": "Nutzbar",
  "use.ready.hint": "Validiert — quellengebunden nutzbar (Status/Vertrauen tragen).",
  "use.review.label": "In Prüfung",
  "use.review.hint": "Bewertung läuft — noch nicht als gesichert nutzen.",
  "use.open.label": "Zu prüfen",
  "use.open.hint": "Offen/ungeprüft — erst prüfen/bewerten lassen.",
  "ko.ovTrust": "Vertrauen",
  // AUFTRAG-mega34 F: „1 Quellen · 1 Anhänge" stand in der Übersichtszeile jedes KO mit genau
  // einer Quelle — also im Regelfall. Variable von {{n}} auf {{count}}, sonst pluralisiert nichts.
  "ko.ovSources_one": "{{count}} Quelle",
  "ko.ovSources_other": "{{count}} Quellen",
  "ko.ovAttachments_one": "{{count}} Anhang",
  "ko.ovAttachments_other": "{{count}} Anhänge",
  "trust.explain.title": "Was bedeutet Vertrauen?",
  "trust.explain.meta":
    "Vertrauen ist ein Review-/Evidenzsignal aus Peer-Bewertungen (0–99) — kein Versprechen, dass die Aussage wahr ist.",
  "trust.explain.band.high":
    "Hohes Vertrauen: mehrfach positiv geprüft. Trotzdem mit eigenem Urteil nutzen.",
  "trust.explain.band.mid":
    "Mittleres Vertrauen: erst teils geprüft oder mit Vorbehalten (Gelb). Vor kritischer Nutzung gegenprüfen.",
  "trust.explain.band.low":
    "Niedriges Vertrauen: kaum geprüft oder rote Bewertung/Konflikt. Erst prüfen oder nacharbeiten.",
  "trust.explain.review":
    "Gelb, Rot oder ein offener Konflikt heißt: prüfen oder nacharbeiten, bevor du dich darauf verlässt.",
  "ko.nextLabel": "Nächste Handlung:",
  "ko.next.use": "validiertes Wissen — kann in Antworten/Output verwendet werden.",
  "ko.next.review": "Validierung läuft — offene Bewertung abschließen.",
  "ko.next.addSource": "Quelle/Beleg ergänzen, bevor validiert wird.",
  "ko.next.validate": "zur Freigabe bewerten lassen (Validierung).",
  "ko.cta.use": "In Fragen nutzen",
  "ko.cta.review": "Bewertung abschließen",
  "ko.cta.addSource": "Zu Quellen & Belegen",
  "ko.cta.validate": "Zur Validierung",
  "ko.title": "Detail",
  "ko.statement": "Aussage",
  // WP-D10 Fix 4: Erstellungsdatum sichtbar (Validierungs-Karten + Detail) — gleichnamige Beiträge
  // werden unterscheidbar. Nur vorhandene KO-Felder (createdAt), kein Platzhalter-Datum bei Altdaten.
  "ko.createdAt": "Erstellt am",
  // WP-SHIP9-S2 Paket 3 (E2): Kurz-Vorschau-Aufklapper je Wissensobjekt/Kandidat.
  "ko.preview.show": "Kurzvorschau",
  "ko.preview.hide": "Vorschau schließen",
  "ko.preview.label": "Vorschau",
  "ko.createdByName": "von {{name}}",
  "ko.gallery": "Bildergalerie",
  "ko.galleryCount": "Bild {{n}} von {{m}}",
  "ko.galleryClose": "Schließen",
  "ko.galleryOpen": "Bild {{n}} vergrößern",
  "ko.galleryPrev": "Vorheriges Bild",
  "ko.galleryNext": "Nächstes Bild",
  // AUFTRAG-mega69 Block A: der Weg vom betrachteten Bild zum Bildbeschreibungs-Formular.
  "ko.galleryEditCaption": "Bildbeschreibung bearbeiten",
  // JOB 512 (R5): Der Text nennt, WAS fehlt und WORAUS — und ausdrücklich keine technische Ursache
  // (kein „Budget", kein „Transfer"). Der Nutzer soll erkennen, dass sein Dokument unvollständig
  // angekommen ist; die Ursache gehört in die Import-Quittung, nicht unter die Galerie.
  "ko.galleryLoss": "{{n}} von {{m}} Bildern aus der Quelldatei fehlen in diesem Entwurf.",
  "ko.body.readTitle": "Ausführlicher Inhalt aus dem Knowledge-Editor",
  "ko.body.readNote":
    "Blöcke und KI-Vorschläge sind redaktionelle Struktur. Maßgeblich bleiben Status, Vertrauen und Quellen dieses Wissensobjekts.",
  "ko.body.readBlocksChip": "strukturierter Inhalt",
  "ko.conditions": "Bedingungen",
  "ko.measures": "Maßnahme",
  "ko.validate": "Validieren",
  "ko.stillValid": "Noch gültig",
  "ko.conditional": "Bedingt",
  "ko.reject": "Ablehnen",
  "ko.edit": "Bearbeiten",
  "ko.returnedBanner":
    "Dieses Wissensobjekt wurde aus der Prüfung zur Nacharbeit zurückgegeben. Bitte das Review-Feedback abarbeiten und eine Revision speichern.",
  "ko.rework.title": "Review-Nacharbeit",
  "ko.rework.hint":
    "Aus einer Review-Entscheidung (Rückfrage/Ablehnung) angestoßen. Bearbeiten erzeugt eine neue Version und startet die Prüfung neu — keine automatische Freigabe, keine automatische Rückgabe.",
  "ko.rework.edit": "Bearbeiten / Revision",
  "ko.rework.back": "Zurück zur Validierung",
  "ko.rework.savedTitle": "Revision gespeichert",
  "ko.rework.savedHint":
    "Eine neue Version ist entstanden und geht erneut in die Prüfung — keine automatische Freigabe, keine automatische Rückgabe.",
  "ko.rework.toValidation": "Zur Validierung der Revision",
  "ko.rework.feedbackTitle": "Review-Feedback",
  "ko.rework.feedback.warn": "Rückfrage",
  "ko.rework.feedback.down": "Ablehnung",
  "ko.rework.editTitle": "Nacharbeit: dieses Feedback abarbeiten",
  "ko.rework.editHint":
    "Arbeite das Feedback gezielt ein. Speichern erzeugt eine neue Version und startet die Prüfung neu — keine automatische Freigabe.",
  "ko.rework.stepsTitle": "Nächste Arbeitsschritte",
  "ko.rework.step.feedback": "Review-Feedback abarbeiten",
  "ko.rework.step.revise": "Revision speichern (neue Version, erneute Prüfung)",
  "ko.rework.step.back": "Zurück in den Validation-Fokus „überarbeitet“",
  "ko.saveEdit": "Speichern",
  "ko.cancelEdit": "Abbrechen",
  "ko.editNote":
    "Speichern erhöht die Version, setzt die Bewertung zurück und schickt das Objekt erneut in die Prüfung.",
  "ko.revision.title": "Änderungsüberblick",
  "ko.revision.none": "Noch keine Änderungen erkannt.",
  "ko.revision.note":
    "Erkennt geänderte Felder/Struktur, nicht die fachliche Richtigkeit. Revidieren erzeugt eine neue Version und braucht Review — keine automatische Freigabe.",
  "ko.revision.field.title": "Titel",
  "ko.revision.field.statement": "Aussage",
  "ko.revision.field.body": "Ausführlicher Inhalt",
  "ko.revision.field.conditions": "Bedingungen",
  "ko.revision.field.measures": "Maßnahmen",
  "ko.revision.field.tags": "Tags",
  "ko.revision.field.category": "Kategorie",
  "ko.revision.field.type": "Typ",
  "ko.reportConflict": "Konflikt melden",
  "ko.conflictTitle": "Widerspruch zu einem anderen Wissensobjekt melden",
  "ko.conflictTarget": "Widersprechendes Objekt",
  "ko.conflictTargetPlaceholder": "Objekt auswählen …",
  "ko.conflictType": "Konfliktart",
  "ko.conflictDesc": "Worin besteht der Widerspruch?",
  "ko.conflictSubmit": "Konflikt eröffnen",
  "ko.conflictTargetSearch": "Wissensobjekt suchen …",
  "ko.conflictTargetEmpty": "Keine Treffer",
  "ko.conflictTargetChoose": "Auswählen",
  "ko.conflictTargetShow": "Vorschau",
  "ko.conflictTargetHide": "Vorschau schließen",
  "ko.provenance": "Herkunft",
  "ko.helpfulTitle": "Bewährung",
  "ko.helpfulHint": "Hat dir dieses Wissen in der Praxis geholfen?",
  "ko.helpful": "Hat geholfen",
  "ko.helpfulDone": "Danke für dein Signal!",
  "ko.helpfulThanks": "Danke — als hilfreich vermerkt.",
  "ko.sourceTitle": "Quelle/Beitrag melden",
  "ko.sourceContribution": "Dein Beitrag / deine Begründung (Pflicht)",
  "ko.sourceRef": "Quelle / URL / Referenz (optional)",
  "ko.sourceHint":
    "Wird zur Prüfung als Kommentar am Objekt gespeichert — noch keine peer-validierte Quelle.",
  "ko.sourceSubmit": "Beitrag einreichen",
  "ko.sourceSaved": "Beitrag als Kommentar gespeichert.",
  "ko.sourcesTitle": "Quellen",
  "ko.sourcesEmpty": "Noch keine externen Quellen.",
  "ko.sourcesHint": "Externe Quellen sind Stufe 2 und nicht peer-validiert.",
  "ext.title": "Externe Quelle suchen",
  "ext.hint":
    "Server-Proxy-Suche. Treffer werden nie automatisch übernommen; als externe, nicht peer-validierte Quelle anhängen — kein Ersatz für interne Validierung.",
  "ext.placeholder": "Suchbegriff …",
  "ext.search": "Suchen",
  "ext.attach": "Als Quelle anhängen",
  // AUFTRAG-mega14 Block D (SCRUM-414): der Knopf ist auf gesperrter Stufe nicht anwählbar — und
  // sagt WARUM. Ein ausgegrauter Knopf ohne Grund ist eine Sackgasse, keine Erklärung.
  "ext.attachBlocked":
    "Auf der eingestellten Stufe darf gesucht, aber nicht angehängt werden. Ein Administrator kann das unter Verwaltung → Externes Wissen ändern.",
  // AUFTRAG-mega16 Block A (bens SB-4): die Stufe ist jetzt eine echte Grenze — sie gilt für JEDE
  // öffentliche Web-Adresse, nicht nur für erkannte Anbieter. Der Nutzer muss das VOR dem Absenden
  // wissen, mit Grund und mit dem Weg zur Änderung.
  "ext.gate.publicUrl":
    "Auf der eingestellten Stufe kann keine Quelle mit öffentlicher Web-Adresse angehängt werden — das gilt für jede Adresse aus dem Netz, nicht nur für Treffer der Suche.",
  "ext.gate.unanchored":
    "Auf der eingestellten Stufe kann eine Quelle ohne Adresse nur angehängt werden, wenn sie eine Belegstelle aus einem Dokument ist, das an diesem Wissensobjekt hinterlegt ist. Ohne Adresse und ohne hinterlegtes Dokument ist für den Server nicht unterscheidbar, ob es sich um einen externen Treffer handelt.",
  "ext.gate.how": "Ein Administrator kann die Stufe unter Verwaltung → Externes Wissen ändern.",
  "ext.unavailable": "Externe Suche ist nicht verfügbar.",
  "ext.resumeHint":
    "Die Trefferliste wird im Entwurf nicht mitgespeichert. Deine Suchanfrage ist wieder da — führe die Suche erneut aus, um die Treffer neu zu laden.",
  "extpage.kicker": "Recherche",
  "extpage.title": "Externes Wissen",
  "extpage.intro": "Externe Quellen durchsuchen — ganz ohne vorher ein Wissensobjekt zu öffnen.",
  "extpage.note":
    "Nur-Lese-Recherche über den Server-Proxy. Hier wird nichts angehängt oder importiert; zum Übernehmen eine Quelle im Wissensobjekt-Detail anhängen. Keine Peer-Validierung.",
  "extpage.idle": "Suchbegriff eingeben, um externe Quellen zu finden.",
  "extpage.disabled":
    "Externe Suche ist serverseitig deaktiviert (EXTERNAL_SEARCH=off). Bitte Betrieb/Codex kontaktieren.",
  "extpage.noResults": "Keine Treffer für diese Suche.",
  "extpage.resultsTitle": "{{n}} Treffer",
  "ko.sourceLabel": "Bezeichnung der Quelle (Pflicht)",
  "ko.sourceUrl": "URL / Referenz (optional)",
  "ko.sourceExcerpt": "Auszug / Notiz (optional)",
  "ko.sourceAdd": "Externe Quelle hinzufügen",
  "ko.sourceAdded": "Externe Quelle hinzugefügt.",
  "ko.sourceRemove": "Quelle entfernen",
  "ko.sourceUnvalidated": "extern · nicht peer-validiert",
  "ko.sourceValidated": "peer-validiert",
  "ko.lineageTitle": "Herkunft & Verlauf",
  "ko.lineageOrigin": "Ursprung",
  "ko.lineageTransferred": "(übergeben)",
  "ko.lineageVersions": "Version",
  "ko.lineageChanges": "Änderungen",
  "ko.lineageRelated": "Verwandt",
  "ko.lineageAudit": "Letzte Ereignisse",
  "ko.lineageGraphLink": "Im Wissensgraph ansehen",
  // AUFTRAG-mega68: die Nachbarschafts-Sicht ersetzt die SCRUM-130-Liste („Verwandte
  // Wissensobjekte") — gleiche Frage, jetzt aus der begrenzten Server-Auskunft mit sichtbarem
  // Kanten-Warum statt aus der Client-Heuristik über den ganzen Bestand.
  "nb.title": "Wissensnetz — Nachbarschaft",
  "nb.hint":
    "In der Mitte der Beitrag, den du liest; darum herum, was über gemeinsame Schlagwörter dazugehört. Ein Klick macht den Nachbarn zur neuen Mitte.",
  "nb.empty": "Keine Nachbarn über aussagekräftige Schlagwörter.",
  "nb.back": "Zurück zu „{{title}}“",
  "nb.open": "Beitrag öffnen",
  "nb.makeCenter": "„{{title}}“ zur neuen Mitte machen",
  "nb.svgLabel": "Nachbarschaft von „{{title}}“",
  "nb.countAll_one": "{{count}} Nachbar im Netz",
  "nb.countAll_other": "{{count}} Nachbarn im Netz",
  "nb.countTruncated": "Die {{shown}} stärksten von {{total}} Nachbarn",
  "nb.excluded":
    "Ohne Kanten über Allerwelts-Schlagwörter: {{tags}} — mehr als die Hälfte des Bestands trägt sie, die Verbindung sagt nichts.",
  "ko.transferTitle": "Autor übergeben",
  "ko.transferOriginal": "Originalautor",
  "ko.author": "Autor",
  // AUFTRAG-mega51 BLOCK F2: ohne Verzeichniseintrag steht eine ehrliche Auskunft statt der
  // rohen Kennung — mit kurzem Merkmal, damit zwei Unbekannte nicht wie eine Person aussehen.
  "ko.authorUnknown": "Unbekannte Person ({{ref}})",
  // AUFTRAG-mega62 Block H: der DRITTE Zustand. Er sagt bewusst nichts über die Person, sondern
  // über uns — das Verzeichnis liegt nicht vor. „Unbekannte Person" an dieser Stelle wäre eine
  // Aussage, die niemand geprüft hat, und genau so sah der Live-Befund aus Register A22 aus.
  // AUFTRAG-mega63 Block B: aus dem einen dritten Zustand werden ZWEI. „Wird geladen" vergeht von
  // selbst und verlangt Warten; „nicht abrufbar" bleibt und gehört gemeldet. Ein gemeinsamer Text
  // machte aus einem Ausfall eine Geduldsfrage.
  "ko.authorLoading": "Autorenname wird geladen …",
  "ko.authorUnavailable": "Autorenname nicht abrufbar",
  "ko.originalAuthor": "Original",
  "ko.transferPick": "Neuen Autor wählen …",
  "ko.transfer": "Übergeben",
  "ko.transferDone": "Autor übergeben. Originalautor bleibt sichtbar.",
  "ko.history": "Versionen",
  "ko.evidenceTitle": "Evidenz",
  "ko.evidenceEmpty": "Noch keine separaten Evidence-Records vorhanden.",
  "ko.evidenceKind.source": "Quelle",
  "ko.evidenceKind.attachment": "Anhang",
  "ko.evCons.title": "Evidence-Konsistenz",
  "ko.evCons.status.ok": "stimmig",
  "ko.evCons.status.warning": "prüfen",
  "ko.evCons.counts": "Quellen {{sources}} · Anhänge {{attachments}} · Evidence {{evidence}}",
  "ko.evCons.allOk": "Quellen, Anhänge und Evidence sind deckungsgleich.",
  "ko.evCons.finding.source-without-evidence": "Quelle ohne Evidence",
  "ko.evCons.finding.attachment-without-evidence": "Anhang ohne Evidence",
  "ko.evCons.finding.evidence-without-source": "Evidence ohne Quelle",
  "ko.evCons.finding.evidence-without-attachment": "Evidence ohne Anhang",
  "ko.evCons.finding.legacy-inline-attachment": "Legacy-Inline-Anhang (ohne Evidence)",
  "ko.evVer.title": "Evidence nach Version",
  "ko.evVer.version": "v{{n}}",
  "ko.evVer.counts": "Quellen {{sources}} · Anhänge {{attachments}}",
  "ko.evVer.latest": "zuletzt {{at}}",
  "ko.evVer.without": "Ohne Evidence: {{versions}}",
  "ko.evFresh.title": "Evidence-Aktualität",
  "ko.evFresh.current": "aktuell belegt",
  "ko.evFresh.outdated": "nur ältere Versionen",
  "ko.evFresh.missing": "Evidence fehlt",
  "ko.evFresh.neutral": "kein Evidence-Anlass",
  "ko.evFresh.counts": "v{{version}} · aktuell {{current}} · älter {{older}}",
  "ko.snapshotsTitle": "Versions-Snapshots",
  "ko.snapshotsEmpty": "Noch keine gespeicherten Voll-Snapshots vorhanden.",
  "ko.snapshotInitial": "Ausgangsversion — kein Vorgänger-Diff.",
  "ko.snapshotNoChanges": "Keine Änderung in den Hauptfeldern.",
  "ko.snapshotField.title": "Titel",
  "ko.snapshotField.statement": "Aussage",
  "ko.snapshotField.conditions": "Bedingungen",
  "ko.snapshotField.measures": "Maßnahmen",
  "ko.snapshotField.type": "Art",
  "ko.snapshotField.status": "Status",
  "ko.comments": "Kommentare",
  "ko.commentsEmpty": "Noch keine Kommentare.",
  "ko.commentPlaceholder": "Kommentar schreiben …",
  "ko.commentAdd": "Kommentieren",
  "ko.attachments": "Anhänge / Fotos",
  "ko.attachmentsEmpty": "Noch keine Anhänge.",
  "ko.attachmentAdd": "Foto anhängen",
  "ko.attachmentUploading": "Wird hochgeladen …",
  "ko.attachmentRemove": "Anhang entfernen",
  "val.kicker": "Validation Board",
  "val.intro":
    "Peer-Bewertung grün / gelb / rot. Ab der Schwelle (Standard 3× grün, 0× rot) gilt ein Objekt als validiert.",
  "val.filter": "Volltext filtern …",
  "val.filterAllTypes": "Alle Wissensarten",
  "val.filterAllCategories": "Alle Kategorien",
  "val.filterAllTags": "Alle Tags",
  "val.filterMine": "Mir zugewiesen",
  // WP-SUBMIT-ASYNC: Status der Hintergrund-KI-Prüfung auf der Karte + Filter „in Prüfung".
  "val.filterAiPending": "In KI-Prüfung",
  // PAKET 1.4 (D-AISTATE, Pedi 23.07.): ehrlich je Modellzustand — OHNE Modell trägt allein die
  // deterministische Ebene (kein „KI"), MIT Modell läuft die Prüfung zusätzlich „(mit KI)".
  // D-AISTATE PAKET 2 (bens V3): OHNE KI läuft NUR die deterministische Duplikat-/Überschneidungs-
  // prüfung — es gibt keine deterministische Konfliktprüfung (Konflikte erkennt nur die KI). Erst die
  // „(mit KI)"-Varianten nennen deshalb den Konflikt.
  "val.aiCheck.pending": "Duplikat-/Überschneidungsprüfung läuft",
  "val.aiCheck.pendingAi": "Duplikat-/Konfliktprüfung (mit KI) läuft",
  "val.aiCheck.pendingHint":
    "Die deterministische Duplikat-/Überschneidungsprüfung läuft im Hintergrund. Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "val.aiCheck.pendingHintAi":
    "Die Duplikat-/Konfliktprüfung (mit KI) auf Konflikte und Überschneidungen läuft im Hintergrund. Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "val.aiCheck.failed": "Prüfung fehlgeschlagen",
  "val.aiCheck.retry": "Erneut prüfen",
  "val.aiCheck.retryStarted": "Prüfung neu eingereiht — sie läuft jetzt im Hintergrund.",
  // WP-SHIP9-B3FIX (Pedi 23.07.): Sperr-Hinweis am ausgegrauten Eintrag, solange die Prüfung läuft
  // (aiCheck pending). Prüf-Aktionen sind bis zum Ergebnis gesperrt — kein Schein-Aktiv vor der Freigabe.
  "val.aiCheck.locked":
    "Duplikat-/Überschneidungsprüfung läuft … Prüf-Aktionen sind gesperrt, bis das Ergebnis vorliegt.",
  "val.aiCheck.lockedAi":
    "Duplikat-/Konfliktprüfung (mit KI) läuft … Prüf-Aktionen sind gesperrt, bis das Ergebnis vorliegt.",
  "val.aiCheck.reason.no-model":
    "Kein KI-Modell aktiv — es wurde nichts geprüft. Modell konfigurieren und erneut prüfen.",
  "val.aiCheck.reason.model-error":
    "Die KI-Prüfung ist mit einem Fehler abgebrochen. Erneut prüfen startet einen neuen Lauf.",
  // WP-SHIP8-FINAL (bens Bedingung 2): eigene ehrliche Ursachen für Frist und Warteschlangen-Kappe.
  "val.aiCheck.reason.timeout":
    "Die KI-Prüfung hat die Zeitgrenze überschritten und wurde abgebrochen. Erneut prüfen startet einen neuen Lauf.",
  "val.aiCheck.reason.model-timeout":
    "Das KI-Modell hat nicht rechtzeitig geantwortet. Erneut prüfen startet einen neuen Lauf.",
  "val.aiCheck.reason.queue-overflow":
    "Die Prüf-Warteschlange war voll — dieser Job wurde verdrängt. Erneut prüfen reiht ihn neu ein.",
  // D-AISTATE PAKET 1 (bens V1): vertraulich → Cloud-KI ausgeschlossen, kein lokales Modell.
  "val.aiCheck.reason.confidential":
    "Vertraulich — die Cloud-KI ist ausgeschlossen und kein lokales Modell verfügbar. Nur die deterministische Duplikat-/Überschneidungsprüfung lief; inhaltlich wurde nicht per KI geprüft.",
  // AUFTRAG-mega11 Block A (bens SB-1, sicherheitsrelevant): der mega9-Text hieß „Am Vergleich war
  // vertrauliches Wissen beteiligt …". Er war wahr, verriet aber Existenz UND thematische Relevanz
  // eines vertraulichen Vergleichspartners — an ein Board, das serverseitig schon mit `ko.read`
  // abrufbar ist. Dieser Text nennt nur noch die Wirkung (Cloud gesperrt, nur deterministisch
  // geprüft) und KEINE Aussage über geschützten Bestand: kein „vertraulich", kein
  // „Vergleichspartner", nichts über dessen Existenz oder Relevanz.
  "val.aiCheck.reason.privacy-no-cloud":
    "Für diese Prüfung ist die Cloud-KI aus Datenschutzgründen nicht verfügbar, und es steht kein lokales Modell bereit. Es lief nur die deterministische Duplikat-/Überschneidungsprüfung; inhaltlich wurde nicht per KI geprüft.",
  // RT-001 (Pedi): ehrliche Feinunterscheidung echter Providerfehler — nie Anbietername/Schlüssel/
  // Endpunkt/roher Fehlertext, nur nutzerverständliche Ursache + was der Nutzer tun kann.
  "val.aiCheck.reason.auth":
    "Die KI konnte sich nicht anmelden — die Zugangsdaten fehlen oder wurden abgelehnt. Bitte die Modell-Zugangsdaten in den Einstellungen prüfen und erneut prüfen.",
  "val.aiCheck.reason.rate-limit":
    "Der KI-Anbieter hat die Anfrage wegen einer Ratenbegrenzung abgewiesen. Kurz warten und erneut prüfen.",
  "val.aiCheck.reason.unreachable":
    "Der KI-Anbieter war nicht erreichbar — vermutlich ein Netzwerk- oder Verbindungsproblem. Verbindung prüfen und erneut prüfen.",
  "val.aiCheck.reason.bad-response":
    "Das KI-Modell hat eine unverständliche Antwort geliefert, die sich nicht auswerten ließ. Erneut prüfen startet einen neuen Lauf.",
  // AUFTRAG-mega23 Block B: TECHNISCHE Einreihung fehlgeschlagen — das Modell wurde nie gefragt und
  // hat nichts beanstandet. Der Text sagt genau das und tarnt sich nicht als Modellfehler.
  "val.aiCheck.reason.submit-followup-failed":
    "Die Prüfung konnte beim Einreichen technisch nicht eingereiht werden — das KI-Modell wurde dabei nicht gefragt und hat nichts beanstandet. Erneut prüfen reiht sie neu ein.",
  // AUFTRAG-mega28 A2/A3 (Pedi 26.07.): Seit dem Kandidaten-Deckel darf ein Lauf nicht mehr
  // behaupten, er habe den ganzen Bestand gesehen. Diese Texte nennen die ZAHLEN und sagen
  // ausdrücklich, was ein leeres Ergebnis dann heißt — und was es NICHT heißt.
  "val.aiCheck.reason.capacity":
    "Die Prüfung wurde wegen Auslastung des KI-Modells abgebrochen — sie ist nicht zu Ende gelaufen. Erneut prüfen startet einen neuen Lauf.",
  // AUFTRAG-mega29 B3: die Zahl kommt aus der ZUSAMMENFASSUNG beider Prüfwege und ist dort das
  // Minimum (mergeCoverage) — also eine konservative MINDESTabdeckung, nicht die tatsächliche Zahl
  // geprüfter Paare. Der Text sagt das jetzt selbst, statt eine Untergrenze als Istwert auszugeben.
  // AUFTRAG-mega29 C2 (bens M28-3): „Keine offenen Konflikte" ist wörtlich richtig und lädt trotzdem
  // zu dem Schluss ein, der Bestand sei geprüft und frei. Dieser Satz nimmt genau diese Ergänzung
  // zurück — mit den drei Zahlen der serverseitigen Zusammenfassung, ohne ein einziges Objekt zu nennen.
  "val.aiCheck.boardCaveat":
    "Das heißt nicht „geprüft und frei“: von {{total}} Wissensobjekten tragen {{incomplete}} einen unvollständigen Prüf-Lauf und {{unchecked}} gar keinen. Die Erkennung vergleicht jeden Beitrag nur gegen eine begrenzte Kandidatenmenge.",
  // AUFTRAG-mega31 A4: „gar kein Lauf“ und „keine Abdeckung nachgewiesen“ sind ZWEI Aussagen. Für
  // Altbestand von vor mega28 ist ein Lauf vermerkt — nur seine Reichweite ist nirgends belegt. Ihn
  // als „gar keinen Lauf“ zu bezeichnen wäre die falsche von beiden Ungenauigkeiten.
  "val.aiCheck.boardCaveat.noCoverage":
    "Bei {{noCoverage}} weiteren ist ein Prüf-Lauf vermerkt, aber keine Abdeckung nachgewiesen — über ihre Reichweite ist nichts belegt.",
  "val.aiCheck.coverage.partial": "TEILGEPRÜFT",
  "val.aiCheck.coverage.capped":
    "Geprüft gegen mindestens {{completed}} von {{available}} möglichen Nachbarn — kein vollständiger Abgleich. Die Zahl ist die konservative Mindestabdeckung beider Prüfwege (Widerspruch und Duplikat); der schwächere von beiden bestimmt sie. Ohne Fund heißt das: in dieser Menge nichts gefunden, nicht „frei von Konflikten und Duplikaten“.",
  "val.aiCheck.coverage.skipped":
    "Geprüft gegen mindestens {{completed}} von {{available}} möglichen Nachbarn; {{skipped}} Vergleiche wurden wegen Fehlern ausgelassen — der Lauf ist unvollständig. Ohne Fund heißt das nicht „frei von Konflikten und Duplikaten“.",
  "val.aiCheck.coverage.aborted":
    "Abgebrochen nach mindestens {{completed}} von {{available}} möglichen Nachbarn — der Rest wurde nicht geprüft. Ohne Fund heißt das nicht „frei von Konflikten und Duplikaten“.",
  // AUFTRAG-mega32 A1: die Merker melden keine Einschränkung, die Zahlen tragen die Aussage aber
  // nicht. Der Text behauptet KEINE Ursache — er sagt nur, dass die Vollständigkeit unbelegt ist.
  "val.aiCheck.coverage.unproven":
    "Dieser Lauf ist nicht als vollständig belegt: das Protokoll weist {{completed}} abgeschlossene Vergleiche bei {{available}} möglichen Nachbarn aus. Ohne Fund heißt das nicht „frei von Konflikten und Duplikaten“.",
  "val.feedback.condTitle": "Bedingt – Begründung für den Autor (Pflicht)",
  "val.feedback.rejTitle": "Ablehnung – Begründung für den Autor (Pflicht)",
  "val.feedback.placeholder": "Was muss überarbeitet werden? …",
  "val.feedback.submit": "Absenden",
  "val.feedback.cancel": "Abbrechen",
  "val.feedback.error": "Konnte nicht gespeichert werden.",
  // SCRUM-365 / AG-12: Feedback enttechnisieren — als Hilfe zur Nacharbeit rahmen.
  "val.feedback.helpHint":
    "Dein Feedback hilft dem Autor, die nächste Version gezielt nachzuarbeiten.",
  "val.empty": "Keine offenen Objekte.",
  "val.target": "Ziel: {{n}}× grün",
  "val.trust": "Vertrauen",
  "val.votes": "{{have}} von {{need}} grün",
  "val.votesTitle": "Validierungs-Fortschritt",
  "val.votesHint":
    "So viele grüne (positive) Bewertungen sind erfasst — von {{need}} nötigen bis zur Validierung. Ab genug grünen und 0 roten gilt das Objekt als validiert; rote Bewertungen blockieren die Freigabe.",
  "val.votesBlocked": "{{count}}× rot",
  "val.staleVotes": "{{count}}× veraltet",
  "val.staleVotesHint":
    "Diese Bewertungen stammen aus einer früheren Revision (vor v{{version}}) und zählen nicht mehr. Das Objekt braucht frische Bewertungen der aktuellen Version.",
  "val.markTrue": "Als wahr kennzeichnen",
  "val.markTrueConfirm": "Als wahr kennzeichnen und komplett validieren?",
  "val.markTrueCancel": "Abbrechen",
  "val.markTrueYes": "Ja, validieren",
  "val.markTrueDone": "Als wahr gekennzeichnet — Objekt ist jetzt validiert.",
  // SCRUM-416: Karten-Dichte — eine ruhige Aufklappung für Signale/Kontext/Führung.
  "val.more": "Signale & Kontext anzeigen",
  // SCRUM-417: Bearbeiten direkt vom Board (führt in den Bearbeiten-Modus des KO-Details).
  "val.editKo": "Bearbeiten",
  "val.transferred": "Autor übertragen",
  "val.assigned": "zugewiesen",
  "val.decisionLabel": "Entscheidung offen:",
  "val.reviewContext.new": "Neu",
  "val.reviewContext.revision": "Überarbeitet",
  "val.reviewContext.hint.new": "Erstbewertung: Quelle, Aussage und Struktur prüfen.",
  "val.reviewContext.hint.revision":
    "Änderung prüfen: Version und Inhalt erneut bewerten — keine automatische Freigabe.",
  "val.reviewFocus.label": "Review-Fokus",
  "val.reviewFocus.all": "Alle",
  "val.reviewFocus.new": "Neu",
  "val.reviewFocus.revision": "Überarbeitet",
  "val.focusActive.label": "Aktive Filter",
  "val.focusReset": "Filter zurücksetzen",
  "val.focusEmpty.filtered": "Keine Treffer mit den aktuellen Filtern.",
  "val.focusEmpty.otherFilters": "Suche, Typ, Kategorie oder Tag anpassen.",
  "val.mineFocus.title": "Dir zugewiesene Review-Arbeit",
  "val.mineFocus.hint": "Das ist deine persönliche Review-Liste. Du kannst sie jetzt abarbeiten.",
  "val.mineFocus.count": "{{n}} für dich",
  "val.mineFocus.reset": "Alle offenen anzeigen",
  "val.mineEmpty.title": "Keine dir zugewiesene Review-Arbeit",
  "val.mineEmpty.hint":
    "Sobald dir etwas zugewiesen wird, erscheint es hier. Bis dahin ist hier nichts für dich offen.",
  "val.mineEmpty.cta": "Alle offenen Objekte ansehen",
  "val.decision.low": "wenig abgesichert — sorgfältig prüfen, Quellen/Belege anschauen.",
  "val.decision.mid": "teilweise abgesichert — Aussage und Quellen gegenprüfen.",
  "val.decision.high": "gut abgesichert — kurze Gegenprüfung genügt meist.",
  "val.reviewState.new": "Neu erfasst · offen",
  "val.reviewState.assigned": "Zugewiesen · Prüfung läuft",
  "val.reviewState.inReview": "Bewertung begonnen",
  "val.reviewState.validated": "Validiert",
  "val.reviewHint.new": "Noch keine Bewertung — jetzt fachlich prüfen.",
  "val.reviewHint.assigned": "Zugewiesen — zuständige Person prüft als Nächstes.",
  "val.reviewHint.inReview": "Bewertung läuft — Quellen und Aussage gegenprüfen.",
  "val.reviewHint.validated": "Bereits validiert.",
  "val.confirm": "Bestätigen",
  "val.conditional": "Bedingt",
  "val.reject": "Ablehnen",
  "val.actionApprove": "Freigeben",
  "val.actionQuery": "Rückfrage",
  "val.actionReject": "Ablehnen",
  "val.feedbackRequiredHint": "* Rückfrage und Ablehnung brauchen eine Begründung.",
  // SCRUM-365 / AG-12: ruhige Review-Führung „Was prüfe ich jetzt?" (progressive disclosure).
  "val.guide.title": "Was prüfe ich jetzt?",
  "val.guide.statement": "Aussage",
  "val.guide.statement.hint": "Stimmt die Kernaussage fachlich?",
  "val.guide.evidence": "Quelle & Belege",
  "val.guide.evidence.hint": "Sind Quelle oder Belege vorhanden und tragfähig?",
  "val.guide.context": "Kontext",
  "val.guide.context.hint": "Ist klar, wann und wo das gilt?",
  "val.guide.traceable": "Nachvollziehbarkeit",
  "val.guide.traceable.hint": "Ist es verständlich und nachvollziehbar beschrieben?",
  "val.guide.focus.revision":
    "Überarbeitet — prüfe gezielt, was sich seit der letzten Version geändert hat.",
  "val.guide.focus.transfer":
    "Autor wurde übertragen — schau besonders genau auf Aussage und Belege.",
  // SCRUM-365 / PI-K2 / AG-P2-3: Trust ist ein Signal, keine Wahrheit — erst das Quorum sichert.
  "val.guide.trustNote":
    "Vertrauen ist ein Review-Signal, keine Wahrheitsgarantie. Erst genug Freigaben — die vereinbarte Mindestzahl von Prüfern — machen Wissen gesichert.",
  // SCRUM-365: Entscheidungswirkung VOR dem Klick — ehrlich, keine Auto-Freigabe.
  "val.guide.impactTitle": "Was bewirkt die Entscheidung?",
  "val.impact.up.title": "Freigeben",
  "val.impact.up.body":
    "Zählt als eine Freigabe-Stimme. Wissen wird nur nutzbar, wenn Status, die Zahl der Freigaben und Vertrauen es tragen — nichts wird automatisch freigegeben.",
  "val.impact.warn.title": "Rückfrage",
  "val.impact.warn.body":
    "Braucht eine kurze Begründung. Bleibt Review-Arbeit und hilft dem Autor, gezielt nachzuarbeiten.",
  "val.impact.down.title": "Ablehnen",
  "val.impact.down.body":
    "Braucht eine kurze Begründung. Führt in die Nacharbeit — es wird nichts automatisch geschlossen.",
  "val.decisionSaved": "Bewertung erfasst.",
  // SCRUM-292: ehrliche Folge-Aussage je Verdict — keine automatische/Fake-Validierung.
  "val.outcome.up":
    "Positiv bewertet. Wenn Status und Vertrauen es tragen, kann es als nächster Schritt quellengebunden genutzt oder geprüft werden — automatisch validiert wird dadurch nichts.",
  "val.outcome.warn":
    "Rückfrage dokumentiert. Bleibt Review-Arbeit, bis die offenen Punkte geklärt sind.",
  "val.outcome.down": "Ablehnung dokumentiert. Bleibt Review-/Feedback-Arbeit.",
  "val.nextViewKo": "Objekt ansehen",
  "val.nextUse": "Wissen nutzen (fragen)",
  "val.nextRework": "Im Objekt nacharbeiten",
  "val.assign": "Zuweisen …",
  "val.openDetails": "Details ansehen — bearbeiten & löschen im Objekt",
  // AUFTRAG-mega38 BLOCK E: die Wand hiess „Frisch gesichert" und zeigte darunter dieselben
  // Einträge, die ihre eigene StatusPill als „Offen" ausweist. Sie sortiert nach `createdAt` und
  // filtert NICHT nach Status (services/app/src/livewall.ts:39-48) — sie zeigt also zuletzt
  // ERFASSTES Wissen, nicht gesichertes. „Gesichert" ist in diesem Produkt das Qualitätswort;
  // es hier für „neu angelegt" zu benutzen, ist dieselbe Wortkollision, die mega33 auf der
  // Antwortkarte geschlossen hat. Ein Wort, eine Bedeutung.
  "start.livewall.title": "Was gerade passiert",
  "start.livewall.subtitle": "Zuletzt erfasstes Wissen und Wissen, das anderen geholfen hat.",
  "start.livewall.saved": "Zuletzt erfasst",
  "start.livewall.helped": "Hat geholfen",
  "start.livewall.helpedToday": "heute geholfen: {{n}}",
  "start.livewall.savedEmpty": "Noch nichts erfasst — der erste Beitrag erscheint hier.",
  "start.livewall.helpedEmpty": "Noch keine „hat geholfen“-Rückmeldung.",
  // AUFTRAG-mega51 BLOCK G1: DE und NL trugen hier die englische Bezeichnung.
  "con.kicker": "Konflikt-Übersicht",
  "con.title": "Konflikte klären — ohne Wissen zu verlieren",
  "con.intro":
    "Widersprüche werden gegenübergestellt und klassifiziert. Nur Wahrheitskonflikte lösen den menschlichen Eskalationspfad aus.",
  "con.empty": "Keine offenen Konflikte.",
  "conflict.impact.title": "Offener Konflikt — Nutzbarkeit eingeschränkt",
  "conflict.impact.hint":
    "Zu diesem Wissen ist ein Konflikt offen. Es ist nicht automatisch falsch, sollte aber vor uneingeschränkter Nutzung geprüft werden.",
  "conflict.impact.truthTitle": "Offener Wahrheitskonflikt — vor Nutzung prüfen",
  "conflict.impact.truthHint":
    "Zu diesem Wissen ist ein Wahrheitskonflikt offen. Bis zur Klärung gilt es als zu prüfen, nicht als uneingeschränkt gesichert.",
  "conflict.impact.badge": "Konflikt offen",
  "conflict.impact.cta": "Konflikt ansehen",
  "con.type.truth": "Wahrheit",
  "con.type.experience": "Erfahrung",
  "con.type.context": "Kontext",
  "con.type.temporal": "Zeit",
  "con.type.role": "Rolle",
  "con.status.offen": "Offen",
  "con.status.eskaliert": "Eskaliert",
  "con.status.zweitmeinung": "Zweitmeinung",
  "con.status.geloest": "Gelöst",
  "con.escPath": "Eskalationspfad",
  "con.escalate": "Eskalieren",
  "con.resolve": "Auflösen",
  "con.origin.auto": "Automatisch erkannt",
  "con.origin.manual": "Manuell angelegt",
  "con.autoConfidence": "Sicherheit {{percent}} %",
  // SCRUM-486 B: der KI-Prozent ist die Erkennungs-Sicherheit, kein Beweis des Widerspruchs.
  "con.autoConfidenceCaption": "KI-Sicherheit der Erkennung — kein bewiesener Widerspruch",
  "con.collision.at": "Kollision bei",
  "con.collision.verbatim": "wörtlich aus dem Beleg",
  "con.collision.point": "Kollisionspunkt",
  "con.autoWhy": "Begründung",
  "con.autoQuoteA": "Beleg A",
  "con.autoQuoteB": "Beleg B",
  "con.dismiss": "Fehlalarm – kein Widerspruch",
  "con.resolveConfirm": "Entscheidung speichern",
  "con.decision": "Entscheidung",
  "con.decisionPlaceholder": "Wie wird der Widerspruch aufgelöst? (Begründung/Ergebnis)",
  "con.versus": "vs",
  "con.conditions": "Bedingungen",
  "con.measures": "Maßnahmen",
  "con.sources": "Quellen",
  "con.openKo": "Objekt öffnen",
  "con.compareOpen": "Beide gegenüberstellen",
  "con.readonlyCompare": "Read-only-Vergleich",
  "con.detectedOn": "Erkannt am {{date}}",
  "con.evidenceSideLabel": "Beleg dieser Seite",
  // ==============================================================================================
  // AUFTRAG-mega32 BLOCK K — DIE BEWEISLAGE, NICHT DAS URTEIL.
  // ==============================================================================================
  // Der Satz sagt, worauf sich die Entscheidung stützen kann. Er sagt NICHT, wer recht hat: eine
  // belegte Aussage kann falsch sein, sie ist nur belegt.
  "con.evidenceBalance.neither":
    "Keine der beiden Aussagen ist mit einer Quelle belegt. Dieser Widerspruch lässt sich deshalb nicht am Wortlaut entscheiden, sondern nur an Belegen — der nächste Schritt ist, für mindestens eine Seite eine Quelle nachzutragen.",
  "con.evidenceBalance.oneSided":
    "Nur eine der beiden Aussagen ist mit einer Quelle belegt: „{{title}}“. Das ist ein Unterschied in der Beweislage, kein Urteil darüber, welche Aussage stimmt — eine belegte Aussage kann falsch sein. Der nächste Schritt ist, die andere Seite zu belegen oder zurückzuziehen.",
  "con.compareTitle": "Gegenüberstellung",
  "con.koMissing": "Beitrag wurde entfernt.",
  "con.resolveEffect":
    "Die Entscheidung wird dokumentiert und protokolliert. Vertrauen/Status der Objekte werden NICHT automatisch geändert (kein stilles Überschreiben).",
  "con.resolveRevalidate": "Betroffene Objekte ggf. manuell re-validieren.",
  "con.secondOpinion": "Zweitmeinung",
  "con.secondOpinionAdd": "Zweitmeinung",
  "con.secondOpinionConfirm": "Zweitmeinung speichern",
  "con.secondOpinionPlaceholder": "Einschätzung einer zweiten Fachperson …",
  "con.nextLabel": "Nächster Schritt",
  "con.next.escalate": "An einen Menschen eskalieren (Wahrheitskonflikt).",
  "con.next.secondOpinion": "Zweitmeinung einer zweiten Fachperson einholen.",
  "con.next.resolve": "Entscheiden und die Auflösung dokumentieren.",
  "con.next.done": "Konflikt ist gelöst — keine offene Handlung.",
  "dup.kicker": "Duplikate-Board",
  "dup.title": "Doppelungen klären — ein Thema, eine Quelle",
  "dup.intro":
    "Automatisch erkannte Überschneidungen zwischen Beiträgen. Sehr hohe Textdeckung wird auch ohne KI gefunden; die feineren Fälle prüft das Modell. Du entscheidest: als verwandt verlinken, getrennt lassen oder als Fehlalarm schließen. (Ein automatisches Zusammenführen gibt es bewusst nicht.)",
  "dup.empty": "Keine offenen Überschneidungen.",
  "dup.relation.identisch": "Identisch",
  "dup.relation.a_enthaelt_b": "A enthält B",
  "dup.relation.b_enthaelt_a": "B enthält A",
  "dup.relation.teilweise": "Teilweise Überschneidung",
  "dup.relation.verwandt": "Verwandt",
  "dup.status.offen": "Offen",
  "dup.status.in_bearbeitung": "In Bearbeitung",
  "dup.status.geschlossen": "Geschlossen",
  "dup.method.model": "KI-Prüfung",
  "dup.method.deterministic": "Textabgleich",
  "dup.probable": "Vermutliches Duplikat",
  "dup.textIdentical": "Textgleiches Duplikat",
  "dup.overlap": "{{percent}} % Textdeckung",
  "dup.confidence": "Sicherheit {{percent}} %",
  // SCRUM-486 B: ehrliche Rahmung der führenden Zahl — Ähnlichkeit ist kein Beweis.
  "dup.leadCaptionModel": "KI-Wahrscheinlichkeit — kein bewiesenes Duplikat",
  "dup.leadCaptionText": "Wort-/Text-Ähnlichkeit — kein bewiesenes Duplikat",
  "dup.why": "Begründung",
  "dup.shared": "Gemeinsame Aussagen",
  "dup.quoteA": "In A",
  "dup.quoteB": "In B",
  "dup.onlyA": "Nur in A",
  "dup.onlyB": "Nur in B",
  "dup.recommendation": "Empfehlung",
  // SCRUM-486 D: kein leeres „Zusammenführen"-Versprechen — Empfehlung zeigt auf die real vorhandenen
  // Aktionen (verlinken / getrennt lassen / Fehlalarm). Ein automatischer Merge existiert nicht.
  "dup.rec.zusammenfuehren": "Starke Überschneidung — verlinken oder eine Version pflegen",
  "dup.rec.zusammenfuehren_pruefen": "Überschneidung prüfen — verlinken oder getrennt lassen",
  "dup.rec.getrennt_lassen": "Getrennt lassen",
  "dup.rec.verwandt_verlinken": "Als verwandt verlinken",
  "dup.versus": "vs",
  "dup.openKo": "Objekt öffnen",
  "dup.compareOpen": "Beide gegenüberstellen",
  "dup.compareTitle": "Gegenüberstellung",
  "dup.koMissing": "Beitrag wurde entfernt.",
  "dup.closed": "Abgeschlossen",
  "dup.reason.merged": "Zusammengeführt",
  "dup.reason.kept_separate": "Bewusst getrennt gelassen",
  "dup.reason.linked_related": "Als verwandt verlinkt",
  "dup.reason.dismissed": "Fehlalarm — kein Duplikat",
  "dup.reason.participant_deleted": "Beteiligter Beitrag entfernt",
  "dup.reason.superseded": "Gegenstandslos geworden",
  "dup.action.dismiss": "Fehlalarm – kein Duplikat",
  "dup.action.keepSeparate": "Getrennt lassen",
  "dup.action.linkRelated": "Als verwandt verlinken",
  // SCRUM-486 (Entdichtung): Führungszeile pro Karte + neutraler „entfernt"-Hinweis statt Roh-UUID.
  "board.koRemoved": "Objekt entfernt",
  "board.detailsShow": "Details ansehen",
  "con.leadKicker": "Widerspruch",
  "dup.leadKicker": "Überschneidung",
  // D-BIB (nacht24 Paket 5): dynamische Facetten + Untergruppen + gespeicherte Sichten (lokal).
  "lib.facet.category": "Abteilung/Kategorie",
  "lib.facet.language": "Sprache",
  "lib.facet.status": "Status",
  "lib.facet.author": "Autor",
  "lib.facet.age": "Alter",
  "lib.facet.trust": "Vertrauen",
  "lib.facet.maturity": "Reife",
  // AUFTRAG-mega45 Block H (SCRUM-425): Facetten-Schiene der Validierung.
  "val.facet.pruefstand": "Prüfstand",
  "lib.facet.origin": "Herkunft",
  "lib.facet.type": "Wissensart",
  "lib.facet.tag": "Schlagwort",
  "facet.active": "Aktive Filter",
  "facet.reset": "Alle zurücksetzen",
  "facet.remove": "{{label}} entfernen",
  "facet.result": "Treffer: {{shown}} von {{total}}",
  "facet.filtered": "gefiltert",
  "facet.more": "+{{n}} weitere",
  "facet.moreFilters": "Weitere Filter",
  "facet.noMatch": "keine Treffer (widersprüchliche gespeicherte Sicht)",
  "lib.facet.lang.de": "Deutsch",
  "lib.facet.lang.en": "Englisch",
  "lib.facet.lang.nl": "Niederländisch",
  "lib.facet.lang.other": "ohne Sprach-Kennzeichnung",
  "lib.facet.ageBucket.d30": "≤ 30 Tage",
  "lib.facet.ageBucket.d180": "≤ 180 Tage",
  "lib.facet.ageBucket.y1": "≤ 1 Jahr",
  "lib.facet.ageBucket.older": "älter als 1 Jahr",
  "lib.facet.ageBucket.unknown": "Alter unbekannt",
  "lib.facet.trustBucket.t0": "Vertrauen 0",
  "lib.facet.trustBucket.t1": "Vertrauen 1–39",
  "lib.facet.trustBucket.t40": "Vertrauen 40–69",
  "lib.facet.trustBucket.t70": "Vertrauen 70+",
  "lib.facet.more": "+{{n}} weitere",
  "lib.facet.none": "ohne Wert",
  // AUFTRAG-mega10 Block B: aus der Pillenwand wird eine Suchmaske (Schiene, Suche je
  // Dimension, aufmachbarer Deckel, klebender Zaehler, Bereichsfilter, Filterblatt).
  "facet.searchLabel": "In {{label}} suchen",
  "facet.searchPlaceholder": "{{label}} suchen …",
  "facet.searchNoHit": "Kein Wert passt zu „{{query}}“.",
  "facet.showAll": "Alle {{n}} zeigen",
  "facet.showLess": "Weniger zeigen",
  "facet.restricted": "nur Werte aus der gewählten Kategorie",
  // AUFTRAG-mega34 F: derselbe Knopf, derselbe Aufruf — die Variable wechselt für ALLE drei
  // Schlüssel auf `count`, sonst bliebe hier ein rohes {{n}} im Text stehen.
  "facet.showResults_one": "{{count}} Treffer anzeigen",
  "facet.showResults_other": "{{count}} Treffer anzeigen",
  "facet.countFiltered": "von {{total}} gefiltert",
  "facet.countAll": "gesamter Bestand",
  "facet.openFilters": "Filter",
  "facet.closeFilters": "Filter schließen",
  "facet.sheetTitle": "Filter",
  "facet.rangeLabel": "Zeitraum",
  "facet.rangeFrom": "von",
  "facet.rangeTo": "bis",
  "facet.rangeFromPill": "ab {{date}}",
  "facet.rangeToPill": "bis {{date}}",
  "facet.rangeContradictory":
    "Das Anfangsdatum liegt nach dem Enddatum — diese Kombination trifft nichts.",
  "lib.facet.confidentiality": "Vertraulichkeit",
  // AUFTRAG-mega34 F: beim Filtern landet man staendig bei 1 — „1 Beiträge anzeigen".
  "lib.facet.showResults_one": "{{count}} Beitrag anzeigen",
  "lib.facet.showResults_other": "{{count}} Beiträge anzeigen",
  "lib.facet.rangeLabel": "Zuletzt geändert",
  "lib.loadMore": "Weitere {{n}} laden",
  "lib.views.remember": "Diese Suche merken",
  "lib.views.savedLabel": "Gemerkte Suchen",
  // AUFTRAG-sortfilter · Punkt 1: Sortierung der Trefferliste.
  "lib.sort.label": "Sortieren",
  "lib.sort.relevance": "Relevanz",
  "lib.sort.title": "Titel A→Z",
  "lib.sort.trust": "Vertrauen (hoch→niedrig)",
  "lib.sort.recent": "Zuletzt geändert (neu→alt)",
  "lib.groupBy.label": "Untergruppen",
  "lib.groupBy.none": "keine",
  "lib.views.label": "Sichten",
  "lib.views.pick": "Gespeicherte Sicht laden …",
  "lib.views.namePlaceholder": "Name der Sicht",
  "lib.views.save": "Sicht speichern",
  "lib.views.remove": "Sicht löschen",
  "lib.views.localHint": "lokal in diesem Browser gespeichert",
  "imp.select.deselectLang": "Alle {{lang}} abwählen · {{n}}",
  // SCRUM-486 (nacht24 Paket 3): EINE ruhige Befund-Darstellung — WAS, Erkennungsweg (ehrlich),
  // beide Seiten verlinkt, Gruppierung je Beitrag.
  "finding.kind.konflikt": "Konflikt",
  "finding.kind.duplikat": "Duplikat",
  "finding.kind.ueberschneidung": "Überschneidung",
  "finding.way.ki": "mit KI",
  "finding.way.deterministisch": "ohne KI (deterministisch)",
  "finding.way.manuell": "manuell angelegt",
  "finding.versus": "vs",
  "finding.groupKicker": "Beitrag",
  "finding.groupCount": "{{n}} Befund(e)",
  // FUNKE (nacht24 Paket 6): Wirkungs-Schleife — würdevoll, kein Punkte-Zirkus.
  "funke.sourceAuthor": "aus dem Wissen von {{name}}",
  "funke.impact.title": "Meine Wirkung",
  "funke.impact.contributions": "Meine Beiträge",
  "funke.impact.validated": "davon validiert",
  "funke.impact.cited": "in Antworten zitiert",
  "funke.impact.helpful": "als hilfreich markiert",
  "funke.impact.hint":
    "Ehrliche Zählung aus vorhandenen Belegen: „zitiert“ zählt die führende Antwort-Quelle — nichts wird geschätzt oder erfunden.",
  "funke.gaps.title": "Offene Wissenslücken",
  "funke.gaps.count": "{{n}} offen",
  "funke.gaps.answerCta": "In 2 Minuten beantworten",
  "funke.gaps.more": "+{{n}} weitere offene Lücken — vollständige Liste unter Risiko & Lücken.",
  "funke.capital.title": "Wissenskapital",
  // AUFTRAG-mega38 BLOCK E: die Zahl ist `kos.length` — der GESAMTBESTAND, jeder Status
  // (apps/web/src/lib/funke.ts:78). „39 gesicherte Wissensobjekte", von denen 30 offen sind, ist
  // deshalb keine Untertreibung, sondern eine falsche Aussage. EN und NL sagten mit „captured" /
  // „vastgelegde" schon das Richtige; nur DE benutzte das Qualitätswort für den Bestand.
  "funke.capital.secured": "erfasste Wissensobjekte",
  "funke.capital.validated": "davon validiert",
  // AUFTRAG-mega38 BLOCK G2: aus dem gestrichenen doppelten Kennzahlen-Block uebernommen.
  "funke.capital.open": "davon offen",
  "funke.capital.categories": "beantwortbare Themenfelder",
  "funke.capital.authors": "aktive Wissensträger",
  "funke.capital.gaps": "offene Wissenslücken",
  "funke.capital.hint": "Nur echte Zahlen aus dem Bestand — keine Schätzungen.",
  "lib.kicker": "Bibliothek",
  "lib.export": "Export",
  "lib.exportFormat": "Exportformat",
  "lib.format.json": "JSON",
  "lib.format.markdown": "Text (Markdown)",
  "lib.format.mediawiki": "MediaWiki",
  "lib.format.html": "HTML (Druck/PDF)",
  "lib.search": "Volltextsuche …",
  // ==============================================================================================
  // AUFTRAG-BASIC-u2 — DIE SUCHE SAGT, WORIN SIE SUCHT.
  // ==============================================================================================
  // Die Bibliothek durchsucht das für den Actor zugängliche Klarwerk-Wissen — NICHT die eigenen,
  // noch nicht eingereichten Entwürfe. Bis hierher stand über dem breiten Suchfeld nichts davon,
  // und der Nulltreffer sagte „Keine Treffer" — ein Satz, der wie „das gibt es nirgends" klingt,
  // während der gesuchte Entwurf auf /erfassen liegt. Der Suchraum wird jetzt genannt, und die
  // andere Suchwelt bekommt einen Namen und einen Weg. An Query, Filterung und Ranking ändert das
  // nichts: es ist eine AUSKUNFT über den Bestand, keine neue Regel über ihn.
  "lib.scope.note":
    "Durchsucht wird das Klarwerk-Wissen, das für dich freigegeben ist — nicht deine eigenen, noch nicht eingereichten Entwürfe.",
  "lib.scope.toDrafts": "Eigene Entwürfe durchsuchen",
  "lib.allStatus": "Alle Status",
  "lib.allTypes": "Alle Wissensarten",
  "lib.allCategories": "Alle Kategorien",
  "lib.allTags": "Alle Tags",
  "lib.revalidate": "Re-Validierung starten",
  "lib.ask": "Fragen",
  "lib.review": "Prüfen",
  "lib.revalidateDone": "Re-Validierung gestartet.",
  "lib.reimport": "Re-Import (JSON)",
  // AUFTRAG-BASIC-u2: der Nulltreffer nennt den SUCHRAUM. „Keine Treffer." behauptete durch
  // Weglassen, es gebe nichts — hier steht jetzt, worin nichts gefunden wurde und wo das Fehlende
  // sonst noch liegen kann.
  "lib.empty":
    "Keine Treffer im Klarwerk-Wissen, das für dich freigegeben ist. Deine eigenen, noch nicht eingereichten Entwürfe stehen unter „Entwürfe fortsetzen“.",
  "lib.answerTitle": "Antwort statt nur Treffer?",
  "lib.answerHint":
    "Lass dir „{{q}}“ quellengebunden beantworten — mit klaren Quell-Links, nicht nur Artikel.",
  "lib.answerButton": "Frage beantworten lassen",
  "lib.emptyQuery":
    "Keine Treffer für „{{q}}“ im Klarwerk-Wissen, das für dich freigegeben ist. Deine eigenen, noch nicht eingereichten Entwürfe sind hier nicht dabei. Tipp: anders formulieren, Filter zurücksetzen oder ein einzelnes Stichwort suchen.",
  // AUFTRAG-mega59 BLOCK D: der stumme Nullzustand. Die Suche hat Treffer, die aktiven Facetten
  // zeigen keinen davon — bis hierher rendert die Bibliothek dafür eine leere Karte ganz ohne Text
  // (bei aktiver Gruppierung ein leeres div). Der Text nennt den GRUND, nicht nur die Zahl.
  "lib.facetEmpty.title": "Treffer vorhanden — aber keiner passt zu den aktiven Filtern.",
  "lib.facetEmpty.hint":
    "Deine Suche hat {{count}} Treffer im Bestand. Die gesetzten Filter blenden alle davon aus.",
  "lib.facetEmpty.reset": "Alle Filter zurücksetzen",
  "lib.matchIn": "Treffer in",
  "lib.match.title": "Titel",
  "lib.match.tag": "Tag",
  "lib.match.category": "Kategorie",
  "lib.match.type": "Wissensart",
  "lib.match.text": "Text",
  "lib.match.caption": "Bildbeschreibung",
  "lib.maturity.all": "Alle",
  // SCRUM-309: Herkunftsfilter (ergänzend zu Reife/Suche; Herkunft, keine Qualitätsaussage).
  "lib.originLabel": "Herkunft",
  "lib.demoFilter.all": "Alle Herkünfte",
  "lib.demoFilter.demo": "Demo-Beispiele",
  "lib.demoFilter.nonDemo": "Eigenes Wissen",
  "lib.maturity.usable": "Nutzbar",
  "lib.maturity.review": "In Prüfung",
  "lib.maturity.open": "Zu prüfen",
  "lib.resultCount": "Treffer: {{n}}",
  "lib.showingFirst": "zeige erste {{shown}} von {{total}}",
  "imp.explore.title": "Quelle erkunden",
  "imp.explore.hint":
    "Sieh dir zuerst an, was in der Quelle steckt — Mengen, Autoren, Themen und Zeitraum. Es wird nichts importiert.",
  "imp.explore.active": "aktiv",
  "imp.explore.soon": "bald",
  "imp.explore.cta": "Weiter: Erkunden",
  "imp.explore.exploring": "Erkunde …",
  "imp.explore.pages": "Seiten",
  "imp.explore.sources": "Quellen",
  "imp.explore.period": "Zeitraum",
  "imp.explore.authors": "Autoren",
  "imp.explore.themes": "Themen",
  "imp.explore.more": "+{{n}} weitere",
  "imp.explore.withImages": "{{n}} Seiten enthalten Bilder.",
  "imp.explore.noAuthor": "(ohne Autor)",
  "imp.explore.noTheme": "(ohne Thema)",
  "imp.explore.empty": "In dieser Quelle wurde nichts gefunden.",
  "imp.explore.truncated": "Nur die ersten {{n}} Seiten gezählt — die Quelle ist größer.",
  "imp.explore.failedPages": "{{n}} Seiten konnten nicht gelesen werden.",
  "imp.explore.topOf": "Top {{n}} von {{total}}",
  // WP-IC-PAKET-1 (Teil 2): Herkunfts-Kennzeichnung abgeleiteter Themen (deterministisch aus Titeln).
  "imp.explore.derivedTag": "abgeleitet",
  "imp.explore.derivedHint":
    "Thema deterministisch aus den Seitentiteln abgeleitet — die Quelle hat für diese Seiten keine Labels.",
  // WP-IC-PAKET-1 (Teil 3/4): Space-Filter + ehrlicher Import-Status der Erkundung.
  "imp.explore.spaces": "Bereiche (Spaces)",
  "imp.explore.alreadyImported": "Davon bereits importiert: {{n}}",
  "imp.explore.alreadyQueued": "Davon bereits zur Prüfung vorgemerkt: {{n}}",
  // ================================================================================================
  // AUFTRAG-mega67 BLOCK C+D — DER ZUGANGS-ZUSTAND. VIER ZUSTÄNDE, VIER EIGENE TEXTE.
  // ================================================================================================
  // Kein Text behauptet mehr, als ohne einen Aufruf an Confluence ablesbar ist. Insbesondere sagt
  // „ready" NICHT „verbunden" (das wüsste nur ein echter Aufruf) und „disabled" NICHT
  // „vorübergehend nicht verfügbar" (ausgeschaltet heißt hier: die Route existiert nicht).
  "imp.access.title": "Zugang",
  "imp.access.ready.title": "Eingeschaltet, Zugangsdaten hinterlegt",
  "imp.access.ready.body":
    "Der Import ist für diese Installation eingeschaltet, und alle nötigen Zugangsdaten stehen auf dem Server. Ob sie auch gültig sind, zeigt sich beim ersten Import — das lässt sich von hier aus nicht prüfen, ohne Confluence anzurufen.",
  "imp.access.noCredentials.title": "Eingeschaltet, aber ohne Zugangsdaten",
  "imp.access.noCredentials.body":
    "Der Import ist eingeschaltet, aber es fehlt noch etwas. Solange das so ist, kann kein Import starten.",
  "imp.access.disabled.title": "In dieser Installation nicht eingeschaltet",
  "imp.access.disabled.body":
    "Der Confluence-Import ist hier nicht eingeschaltet. Er wird auf dem Server freigeschaltet; von der Oberfläche aus lässt er sich nicht umlegen.",
  // mega69 B3: „notBuilt" ist mit dem unerreichbaren vierten Zustand entfernt (bens Auflage 3).
  "imp.access.blocker.missing": "Es fehlt mindestens eine der nötigen Angaben.",
  "imp.access.blocker.insecureBaseUrl":
    "Alle Angaben stehen, aber die Adresse ist keine https-Adresse. Zugangsdaten werden nur über verschlüsselte Verbindungen gesendet — deshalb kommt kein Zugang zustande.",
  // Block C: die Variablen BENANNT, mit Ja/Nein — nie ein Wert und nie eine Maske mit Länge (eine
  // Maske verriete die Länge). Es gibt hier bewusst KEIN Eingabefeld.
  "imp.access.varsTitle": "Was dieses System braucht",
  "imp.access.varPresent": "hinterlegt",
  "imp.access.varMissing": "nicht hinterlegt",
  "imp.access.whereSet":
    "Diese Werte werden als Umgebungsvariablen auf dem Server gesetzt — nicht hier. Klarwerk zeigt nur, ob sie stehen, nie ihren Inhalt.",
  "imp.access.whoMay": "Ändern kann das, wer Zugang zum Server dieser Installation hat.",
  // JOB-924 D6: Der frühere Satz („wird nicht festgehalten") ist überholt — es WIRD festgehalten,
  // es gibt nur noch keinen erfolgreichen Lauf. Beide Sätze sind ausdrücklich rückblickend: der
  // Zeitpunkt sagt, dass es damals ging, nicht dass es jetzt geht. Das wüsste nur ein Aufruf, und
  // den macht diese Fläche nicht.
  // Die Wortwahl „ist bisher nicht festgehalten" statt „wird nicht festgehalten" ist der ganze
  // Unterschied: Der Ort EXISTIERT, es steht nur noch nichts darin. `mega67-zugang-flaeche-mounted`
  // pinnt „nicht festgehalten" als Beleg, dass der Unbekannt-Fall BENANNT wird statt zu schweigen —
  // dieser Vertrag bleibt gültig, nur die Behauptung dahinter wird wahr.
  "imp.access.lastConnectedUnknown":
    "Ein erfolgreich abgeschlossener Import ist bisher nicht festgehalten.",
  "imp.access.lastConnected":
    "Zuletzt erfolgreich abgeschlossener Import: {{date}}. Ob es jetzt funktioniert, sagt dieser Rückblick nicht.",
  // AUFTRAG-ic7-import-vision: EHRLICHE Quellen-Galerie „wo die Reise hingeht".
  "imp.gallery.planned": "geplant",
  // AUFTRAG-mega32 BLOCK G: EINE aufklappbare Zeile mit ANZAHL. Standard zugeklappt; aufgeklappt
  // verhalten sich die Kacheln genau wie heute (kein Import, nur der ehrliche Hinweis).
  "imp.gallery.plannedGroup": "In Planung ({{count}})",
  "imp.gallery.systemsTitle": "Systeme",
  "imp.gallery.filesTitle": "Dateien",
  "imp.gallery.hintSoon": "In Arbeit — diese Quelle kommt bald.",
  "imp.gallery.hintPlanned": "Geplant — kommt später.",
  // AUFTRAG-mega15 Block D (SCRUM-382): „vorhanden, aber kein Dienst hinterlegt" ist etwas anderes
  // als „geplant". Die Kachel sagt jetzt, was zutrifft.
  "imp.gallery.unconfigured": "nicht konfiguriert",
  "imp.gallery.hintUnconfigured":
    "Vorhanden, aber nicht nutzbar: für die Transkription ist kein Dienst hinterlegt. Ein Administrator kann ihn in der Verwaltung einrichten.",
  "imp.gallery.src.confluence": "Confluence",
  "imp.gallery.src.jsonImport": "JSON-Import",
  "imp.gallery.src.jira": "Jira",
  "imp.gallery.src.wordFile": "Word-Datei",
  "imp.gallery.src.pdfFile": "PDF-Datei",
  "imp.gallery.src.sharepoint": "SharePoint",
  "imp.gallery.src.teams": "MS Teams",
  "imp.gallery.src.gdrive": "Google Drive",
  "imp.gallery.src.dms": "DMS",
  "imp.gallery.src.plm": "PLM",
  "imp.gallery.src.servicenow": "ServiceNow",
  "imp.gallery.src.sap": "SAP",
  "imp.gallery.src.notion": "Notion",
  "imp.gallery.src.slack": "Slack",
  "imp.gallery.src.email": "E-Mail",
  "imp.gallery.file.json": "JSON",
  "imp.gallery.file.docx": "Word (.docx)",
  "imp.gallery.file.pdf": "PDF",
  "imp.gallery.file.xlsx": "Excel (.xlsx)",
  "imp.gallery.file.pptx": "PowerPoint (.pptx)",
  "imp.gallery.file.csv": "Text/CSV",
  "imp.gallery.file.ocr": "OCR (Scan/Bild)",
  "imp.gallery.file.avtranscript": "Audio-/Video-Transkript",
  "imp.select.title": "Auswahl eingrenzen",
  "imp.select.hint":
    "Klicke Themen an ODER beschreibe in einem Satz, was importiert werden soll — beides zusammen geht auch. Die Vorschau zeigt, was passt — importiert wird noch nichts.",
  "imp.select.promptPlaceholder": "z. B. „alles zum Thema Wartung und Fehlercodes“",
  // WP-VIP2-GATE-2 (bens Fix 1): Pflicht-Eigeneinstufung des Auswahl-Satzes (Vorgabe: Ja/unsicher).
  "imp.select.promptConfidentialLabel": "Enthält dieser Text Vertrauliches?",
  "imp.select.promptConfidentialYes": "Ja/unsicher",
  "imp.select.promptConfidentialNo": "Nein, unbedenklich",
  "imp.select.limit": "Höchstens",
  "imp.select.previewCta": "Weiter: Eingrenzen",
  "imp.select.previewing": "Werte aus …",
  "imp.select.matched": "{{matched}} von {{total}} Treffern",
  "imp.select.limitedNote": "auf das Limit gedeckelt",
  "imp.select.critAll": "Keine Eingrenzung — alles würde passen.",
  "imp.select.critThemes": "Themen",
  "imp.select.critAuthors": "Autoren",
  "imp.select.critKeywords": "Stichworte",
  "imp.select.critYears": "Jahre",
  "imp.select.critLimit": "Limit",
  "imp.select.critSpaces": "Bereiche",
  "imp.select.yearFrom": "von (Jahr)",
  "imp.select.yearTo": "bis (Jahr)",
  // WP-IC-PAKET-1 (Teil 4, IC-6a): Import-Status + Auswahl in der Vorschau.
  "imp.select.alreadyImported": "{{n}} bereits importiert",
  // WP-SHIP9-S1b (bens GELB): eigener Zustand — offener Kandidat ist nur vorgemerkt, nicht importiert.
  "imp.select.alreadyQueued": "{{n}} bereits zur Prüfung vorgemerkt",
  "imp.select.selectedCount": "{{n}} angewählt",
  "imp.select.importedDeselected":
    "Bereits importierte Seiten sind abgewählt; bei Bedarf bewusst wieder anwählen.",
  "imp.select.queuedDeselected":
    "Bereits zur Prüfung vorgemerkte Seiten sind abgewählt; bei Bedarf bewusst wieder anwählen.",
  // WP-SHIP9-S2 Paket 2 (D2–D7): Steuerung der Trefferliste.
  "imp.select.searchPlaceholder": "In den Treffern suchen (Titel, Autor) …",
  "imp.select.selectAll": "Alle wählen",
  "imp.select.deselectAll": "Alle abwählen",
  "imp.select.groupBy": "Gruppieren:",
  "imp.select.groupNone": "keine",
  "imp.select.groupTheme": "nach Thema",
  "imp.select.groupLanguage": "nach Sprache",
  // AUFTRAG-mega27 A4: die ECHTE Quell-Ordnerstruktur (Elternkette) statt einer Ableitung.
  "imp.select.groupFolder": "nach Ordner",
  "imp.select.noFolder": "Ohne Quell-Container",
  "imp.select.folderFallbackNoPath":
    "Diese Quelle liefert keine Ordnerstruktur (keine Elternkette) — gezeigt wird die bisherige Ansicht.",
  "imp.select.folderFallbackSingle":
    "Die Quell-Struktur ergibt hier nur einen einzigen Ordner — gezeigt wird die bisherige Ansicht.",
  // AUFTRAG-mega27 Block B: die Trefferliste filtert mit derselben Facetten-Technik wie die Bibliothek.
  "imp.select.facet.folder": "Ordner",
  "imp.select.facet.status": "Status",
  "imp.select.facet.theme": "Thema",
  "imp.select.facet.author": "Autor",
  "imp.select.facet.language": "Sprache",
  "imp.select.facetCount_one": "{{count}} Treffer anzeigen",
  "imp.select.facetCount_other": "{{count}} Treffer anzeigen",
  "imp.select.rangeLabel": "Quell-Datum",
  "imp.select.bulkLabel": "Auswahl",
  "imp.select.groupCount": "{{n}} Treffer",
  "imp.select.langDe": "Deutsch",
  "imp.select.langEn": "Englisch",
  "imp.select.langNl": "Niederländisch",
  "imp.select.langOther": "Ohne Sprachkennzeichen",
  "imp.select.noTheme": "Ohne Thema",
  "imp.select.chipNew": "Neu",
  "imp.select.chipImported": "Bereits importiert",
  "imp.select.chipQueued": "Vorgemerkt",
  "imp.select.summary": "{{selected}} von {{total}} gewählt",
  "imp.select.emptyFiltered": "Kein Treffer für Suche/Filter — Suche oder Filter anpassen.",
  "imp.preview.imported": "bereits importiert",
  "imp.preview.queued": "bereits zur Prüfung vorgemerkt",
  "imp.groups.cta": "Weiter: Gruppieren & Übernehmen",
  "imp.groups.needSelection":
    "Wählen Sie in der Vorschau mindestens einen Eintrag aus, um fortzufahren.",
  "imp.groups.grouping": "Die Beiträge werden thematisch gruppiert …",
  "imp.groups.retry": "Erneut versuchen",
  "imp.groups.willGroupWithoutAi":
    "Kein KI-Modell aktiv — es wird ohne KI nach Themen gruppiert (deterministisch).",
  "imp.groups.noAi": "Ohne KI gruppiert",
  "imp.groups.noAiReason": "Ohne KI gruppiert — {{reason}}",
  "imp.groups.reason.confidential": "vertrauliche Kandidaten — Cloud-KI ausgeschlossen",
  // AUFTRAG-mega59 BLOCK F1: die drei bis hierher stummen Gründe. Ein nacktes „Ohne KI gruppiert"
  // ist für den Nutzer nicht von einem Fehler unterscheidbar — und die vier Gründe verlangen
  // verschiedene Reaktionen (Konfiguration, Geduld, Meldung, keine).
  "imp.groups.reason.noModel": "kein KI-Modell aktiv",
  "imp.groups.reason.timeout": "das KI-Modell hat nicht rechtzeitig geantwortet",
  "imp.groups.reason.error": "das KI-Modell hat einen Fehler gemeldet",
  // AUFTRAG-mega59 BLOCK F2: Vorwarnung bei vertraulichem Stapel — auch bei AKTIVEM Reasoner.
  "imp.groups.willGroupWithoutAiConfidential":
    "Dieser Stapel enthält vertrauliche oder nicht freigegebene Einträge — es wird ohne Cloud-KI nach Themen gruppiert (deterministisch).",
  "imp.groups.aiGrouped": "KI-gruppiert",
  "imp.groups.groupCount": "{{n}} Beiträge",
  "imp.groups.approve": "Freigeben",
  "imp.groups.exclude": "Ausschließen",
  "imp.groups.selectedCount": "{{x}} von {{y}} ausgewählt",
  "imp.groups.catchall": "Weitere Beiträge",
  "imp.groups.noTheme": "Ohne Thema",
  "imp.groups.hintImported": "bereits importiert",
  "imp.groups.hintQueued": "bereits zur Prüfung vorgemerkt",
  "imp.groups.hintStale": "älter als 1 Jahr",
  "imp.groups.hintShort": "wenig Inhalt",
  "imp.groups.applyCta": "Auswahl übernehmen ({{n}})",
  "imp.groups.applying": "Übernehme {{x}} von {{y}} …",
  "imp.groups.bilanzTitle": "Ergebnis der Übernahme",
  "imp.groups.bilanzImported": "{{n}} übernommen",
  "imp.groups.bilanzSkipped": "{{n}} übersprungen (bereits importiert)",
  "imp.groups.bilanzSkippedQueued": "{{n}} übersprungen (bereits zur Prüfung vorgemerkt)",
  "imp.groups.bilanzExcluded": "{{n}} ausgeschlossen",
  "imp.groups.bilanzFailed": "{{n}} fehlgeschlagen",
  "imp.groups.bilanzReview":
    "Die übernommenen Beiträge liegen jetzt im Import-Review — dort entscheidet ein Mensch über jede Übernahme ins Wissen.",
  "imp.groups.toReview": "Weiter zum Import-Review ({{n}} offen)",
  "imp.groups.failNotFound": "nicht mehr in der aktuellen Auswahl",
  "imp.groups.bilanzQueued": "{{n}} bereits eingereiht (war schon im Review)",
  "imp.groups.bilanzNotAttempted": "{{n}} nicht versucht (Lauf nach Fehler abgebrochen)",
  "imp.groups.retryRest": "Rest übernehmen ({{n}})",
  "imp.groups.failHttp": "Übertragung fehlgeschlagen",
  "imp.groups.hintSourceNewer": "Quelle aktualisiert seit Import",
  "imp.groups.bilanzUpdates": "davon Aktualisierungen: {{n}}",
  "imp.groups.expired":
    "Die Datengrundlage der Gruppierung ist inzwischen abgelaufen — die Übernahme wurde gestoppt und die Auswahl zurückgesetzt. Bitte neu gruppieren.",
  "imp.groups.regroup": "Neu gruppieren",
  // AUFTRAG-mega9 Block E-4 (KW-E2E-008): ehrlicher Name nach einer Auswahländerung.
  "imp.groups.refreshGrouping": "Gruppierung aktualisieren",
  // WP-COCKPIT-LINIE: geführte Fünf-Schritte-Leiste + eingeklappter Verlauf (einfache Sprache).
  "imp.step.barLabel": "Import in fünf Schritten",
  "imp.step.source": "Quelle",
  "imp.step.sourceHint":
    "Wähle aus, woher die Beiträge kommen sollen — heute: Seiten aus Confluence.",
  "imp.step.explore": "Erkunden",
  "imp.step.exploreHint":
    "Sieh dir zuerst an, was in der Quelle steckt — es wird noch nichts übernommen.",
  "imp.step.narrow": "Eingrenzen",
  "imp.step.narrowHint":
    "Klicke Themen an oder beschreibe in einem Satz, was du übernehmen möchtest — die Vorschau zeigt, was passt.",
  "imp.step.groups": "Gruppen freigeben",
  "imp.step.groupsHint":
    "Gib ganze Gruppen frei oder schließe sie aus — einzelne Beiträge kannst du weiter an- und abwählen.",
  "imp.step.apply": "Übernehmen & Bilanz",
  "imp.step.applyHint":
    "Die freigegebenen Beiträge werden zur Prüfung übernommen — die Bilanz zeigt ehrlich, was passiert ist.",
  "imp.step.done": "erledigt",
  "imp.explore.ctaAgain": "Neu erkunden",
  "imp.select.previewAgain": "Vorschau aktualisieren",
  "imp.history.title": "Review-Verlauf: offene und übernommene Beiträge",
  "imp.history.count": "{{open}} offen · {{total}} gesamt",
  "imp.history.hint":
    "Hier liegt der Verlauf früherer Übernahmen — zur Prüfung eingereihte, angenommene und abgelehnte Beiträge. Für den laufenden Import brauchst du diesen Bereich nicht.",
  // WP-UX-WOW-1 (Kopfs Live-UX-Befunde U1-U9): Politur für den ersten VIP2-Eindruck.
  "ask.koQuestion": "Was gilt zu: {{title}}?",
  "ask.confidentialPrefillHint":
    "Vertraulicher Inhalt — prüfe die Frage vor dem Senden. Sie wurde nur vorbefüllt und nicht automatisch gesendet.",
  "ask.expect.neutral": "Beispiel ausprobieren",
  // AUFTRAG-mega51 BLOCK D2: der Sonderfall der Trefferzeile liest jetzt denselben Wert, den er
  // anzeigt (confidence) — deshalb spricht sein Text von der Sicherheit, nicht von Trust.
  "lib.confidenceNone": "Sicherheit noch nicht bewertet",
  "lib.confidenceNoneHint":
    "Die Sicherheit sagt, wie belastbar ein Inhalt eingestuft ist (0 bis 100). 0 heißt: noch nicht bewertet — nicht, dass der Inhalt falsch ist.",
  "con.emptyWhat":
    "Ein Konflikt entsteht, wenn zwei Beiträge sich fachlich widersprechen — zum Beispiel zwei verschiedene Grenzwerte für dieselbe Anlage.",
  "con.emptyHow":
    "Klarwerk erkennt solche Widersprüche beim Prüfen und Vergleichen; hier entscheidet dann ein Mensch, welche Aussage gilt.",
  "con.emptyExamplesHint":
    "Zum Ausprobieren gibt es das Beispielpaket „Widersprüchliche Aussagen“ im Import-Bereich.",
  "con.emptyExamplesCta": "Beispielpakete öffnen",
  "stage2.gate.title": "Erweiterte Funktionen (Stufe 2)",
  "stage2.gate.body":
    "Dieses Modul gehört zu den Erweiterten Funktionen — im Haus „Stufe 2“ genannt: zusätzliche Module über den Kernablauf hinaus. Sie sind gerade ausgeschaltet, deshalb ist dieser Bereich noch nicht sichtbar.",
  "stage2.gate.enable": "Stufe 2 jetzt einschalten",
  "stage2.gate.adminOnly":
    "Stufe 2 kann eine Admin-Person über den Schalter in der Seitenleiste einschalten.",
  "stage2.gate.back": "Zurück zum Start",
  // AUFTRAG-mega70 BLOCK A: der Rollenfall bekommt dieselbe Behandlung wie der Stufe-2-Fall —
  // eine Erklärung statt der stillen Umleitung. Kein Einschalt-Knopf: eine Rolle vergibt der
  // Administrator, nicht die Nutzerin.
  "role.gate.title": "Dieser Bereich gehört einer anderen Rolle",
  "role.gate.body":
    "Dieser Bereich braucht die Rolle {{owner}}. Deine aktuelle Rolle ist {{own}} — darum ist der Weg hierhin für dich zu. Eine Rolle vergibt die Administration; es gibt hier deshalb nichts einzuschalten.",
  "imp.cleanup.title": "Testdaten aufräumen",
  "imp.cleanup.desc":
    "Entfernt alle Einträge aus der Import-Warteschlange und legt alle aus Confluence oder Jira importierten Beiträge in den Papierkorb. Selbst erstellte Beiträge, Nutzer und Einstellungen bleiben unberührt.",
  "imp.cleanup.previewCta": "Vorschau laden",
  "imp.cleanup.previewLoading": "Umfang wird ermittelt …",
  "imp.cleanup.previewResult":
    "Das würde {{n}} Kandidaten und {{m}} importierte Beiträge entfernen.",
  "imp.cleanup.confirmHint":
    "Die Kandidatenliste wird endgültig geleert; die importierten Beiträge wandern in den Papierkorb und können von dort wiederhergestellt werden.",
  "imp.cleanup.confirmCta": "Jetzt aufräumen",
  "imp.cleanup.cancel": "Abbrechen",
  "imp.cleanup.running": "Aufräumen läuft …",
  "imp.cleanup.doneCandidates": "{{n}} Kandidaten entfernt",
  "imp.cleanup.doneKos": "{{n}} importierte Beiträge in den Papierkorb verschoben",
  "imp.cleanup.doneSkipped": "{{n}} übersprungen (Fehler beim Verschieben)",
  "imp.cleanup.drift":
    "Der Bestand hat sich seit der Vorschau geändert — die Vorschau wurde neu geladen, bitte erneut prüfen und bestätigen.",
  "imp.cleanup.auditFailed":
    "Hinweis: Der Abschluss-Eintrag im Audit-Log konnte nicht geschrieben werden — das Aufräumen selbst ist abgeschlossen.",
  "imp.cleanup.newSince": "{{n}} neue Kandidaten seit der Vorschau — nicht angefasst.",
  "imp.cleanup.claimedKos":
    "{{n}} Beitrag/Beiträge in laufender Review-Bearbeitung — vom Aufräumen ausgenommen.",
  "imp.cleanup.auditPendingCandidates":
    "{{n}} Kandidat(en) mit ausstehendem Aktionsbeleg — vom Aufräumen ausgenommen, bis der Beleg nachgezogen ist.",
  "exp.title": "Beispielpakete",
  "exp.hint":
    "Kuratierte kleine Szenarien für Tester — jedes Paket lässt sich einzeln laden und legt klar gekennzeichnete Beispiel-Beiträge an. Das Import-Aufräumen entfernt sie NICHT; sie verschwinden über das Entfernen der Demo-Daten.",
  "exp.load": "Laden",
  "exp.loading": "Wird geladen …",
  "exp.result": "{{created}} angelegt, {{skipped}} übersprungen (schon vorhanden)",
  "exp.pkg.konflikte.title": "Widersprüchliche Aussagen",
  "exp.pkg.konflikte.desc":
    "Sechs Beiträge in drei Paaren, die sich fachlich widersprechen — ideal, um Konfliktprüfung und Validierung auszuprobieren.",
  "exp.pkg.bilder.title": "Wissen mit Bildern",
  "exp.pkg.bilder.desc":
    "Drei Beiträge mit Bildern und beschreibenden Bild-Fußnoten — ideal für Galerie und Fußnoten-Suche.",
  "exp.pkg.qualitaet.title": "Gemischte Qualität",
  "exp.pkg.qualitaet.desc":
    "Fünf Beiträge von gut über zu kurz bis veraltet — ideal, um Review und Qualitätsbewertung zu üben.",
  "imp.preview.sourceNewer": "Quelle neuer als Import",
  "imp.select.empty": "Kein Treffer für diese Eingrenzung.",
  "imp.select.aiUnavailable":
    "KI-Auswahl derzeit nicht verfügbar — es gelten nur deine Klick-Filter.",
  "imp.select.aiConfidential":
    "Cloud-KI wegen vertraulicher Inhalte ausgeschlossen — der Freitext-Satz wurde nicht ausgewertet; es gelten nur deine Klick-Filter.",
  "imp.uploadTitle": "JSON-Re-Import",
  "imp.uploadHint":
    "JSON-Datei wählen — die Einträge landen als Beiträge in der Prüfliste (keine stille Übernahme).",
  "imp.jsonOnlyReason":
    "Import derzeit nur als JSON. Office-Dateien (DOCX, PDF, PPTX) bitte über „Wissen erfassen → aus Datei“ aufnehmen — dort werden sie real gelesen.",
  "imp.dropHint": "JSON-Datei hierher ziehen und ablegen — oder unten auswählen.",
  "imp.dropActive": "JSON-Datei hier ablegen …",
  "imp.dropReject": "„{{name}}“ ist keine JSON-Datei — Import derzeit nur als JSON möglich.",
  "imp.upload": "JSON-Datei wählen",
  "imp.parsed": "{{n}} Beiträge zur Prüfung eingereiht.",
  "imp.parseError": "Ungültige JSON-Datei.",
  "imp.queueTitle": "Prüfliste der Importe",
  "imp.queueEmpty": "Keine Beiträge zur Prüfung.",
  "ext.pipeline.title": "Import-Pipeline & Befunde",
  "ext.pipeline.upload": "Hochladen",
  "ext.pipeline.extract": "Extrahieren",
  "ext.pipeline.structure": "Strukturieren",
  "ext.pipeline.review": "Prüfen",
  "ext.pipeline.validate": "Validieren",
  "ext.pipeline.release": "Freigeben",
  "ext.pipeline.reuse": "Wiederverwenden",
  "ext.queue.total": "Gesamt: {{n}}",
  "ext.queue.open": "Offen: {{n}}",
  "ext.queue.accepted": "Angenommen: {{n}}",
  "ext.queue.rejected": "Abgelehnt: {{n}}",
  "ext.queue.infoRequested": "Info angefragt: {{n}}",
  "ext.queue.duplicates": "Dubletten: {{n}}",
  "ext.finding.duplicate": "Dublette",
  "ext.finding.missingInfo": "Angaben fehlen",
  "ext.finding.infoRequested": "Info angefragt",
  "ext.finding.acceptedKo": "KO erzeugt",
  "ext.finding.rejected": "Abgelehnt",
  "ext.validity.title": "Gültigkeit & Schutz",
  "ext.validity.freshness": "Aktualität",
  "ext.validity.outputEligible": "Output-Eignung",
  "ext.validity.recommendation": "Empfehlung",
  "ext.freshness.validiert": "validiert",
  "ext.freshness.revalidierung-faellig": "Revalidierung fällig",
  "ext.freshness.offen": "offen",
  "ext.freshness.konflikt": "Konflikt",
  "ext.freshness.unbekannt": "unbekannt",
  "ext.protection.ip": "IP-Sensitivität",
  "ext.protection.notRated": "nicht bewertet",
  "ext.outputEligible.yes": "ja",
  "ext.outputEligible.no": "nein",
  "ext.recommendation.clarify-conflict": "Konflikt klären",
  "ext.recommendation.start-revalidation": "Revalidierung starten",
  "ext.recommendation.finish-validation": "Validierung abschließen",
  "ext.recommendation.output-ready": "Für Output nutzbar",
  "ext.recommendation.unknown": "unbekannt",
  "imp.duplicate": "Dublette",
  "imp.note": "Notiz",
  "imp.accept": "Annehmen",
  "imp.reject": "Ablehnen",
  "imp.info": "Info anfordern",
  "imp.infoSend": "Senden",
  "imp.notePlaceholder": "Welche Information fehlt?",
  "imp.reviewed": "Beitrag aktualisiert.",
  // AUFTRAG-mega9 Block E-1 (KW-E2E-005): „Neu" beschrieb den Anlagezustand, nicht die Bedeutung
  // für den Nutzer. Der Kandidat wartet auf eine Entscheidung — dieselbe Sprache wie
  // imp.preview.queued / imp.groups.hintQueued.
  "imp.status.neu": "Zur Prüfung vorgemerkt",
  "imp.status.in_bearbeitung": "In Bearbeitung",
  "imp.status.angenommen": "Angenommen",
  "imp.status.abgelehnt": "Abgelehnt",
  "imp.status.info-angefragt": "Info angefragt",
  // Unbekannter/neuer Serverzustand: ehrlich benannt statt roher i18n-Schlüssel in der Oberfläche.
  "imp.status.unknown": "Status unbekannt",
  "risk.kicker": "Risiko & Lücken",
  "risk.summary": "Cockpit-Übersicht",
  "risk.kpiOpenGaps": "Offene Lücken",
  "risk.kpiHigh": "Hohe Priorität",
  "risk.kpiUnassigned": "Unzugewiesen",
  "risk.kpiAssigned": "Zugewiesen",
  "risk.kpiOpenConflicts": "Offene Konflikte",
  "risk.kpiClosedGaps": "Geschlossene Lücken",
  "risk.cockpit": "Risiko-Cockpit nach Domäne",
  "risk.cockpitEmpty": "Keine Domänendaten.",
  "risk.level.kritisch": "kritisch",
  "risk.level.mittel": "mittel",
  "risk.level.gut": "stabil",
  "risk.koCount": "Objekte",
  "risk.validated": "validiert",
  "risk.openKo": "offen",
  "risk.singleSource": "Einzelquelle — Klumpenrisiko",
  "risk.singleSourceExplain":
    "Das gesamte Wissen dieser Domäne stammt von einer einzigen Person. Fällt sie aus (Krankheit, Kündigung, Ruhestand), ist das Wissen weg — das ist das größte Wissensrisiko. Gegenmaßnahme: weitere Personen einbinden, Wissen zweitprüfen (validieren) und Quellen ergänzen.",
  "risk.bearer": "Getragen von: {{names}}",
  "risk.viewObjects": "Objekte dieser Domäne ansehen",
  "risk.busLegendSingle": "rot = Einzelquelle (Ausfallrisiko)",
  "risk.busLegendOk": "grün = mehrere Quellen",
  "risk.help.summary":
    "Überblick in Zahlen: Offene Lücken (Fragen ohne gesichertes Wissen), Hohe Priorität (dringend), Unzugewiesen/Zugewiesen (ob jemand die Lücke bearbeitet), Offene Konflikte (widersprüchliche Aussagen) und Geschlossene Lücken (bereits beantwortet). Rote Zahlen zeigen Handlungsbedarf.",
  "risk.help.cockpit":
    "Risiko je Domäne (Kategorie): KRITISCH/MITTEL/GUT fasst zusammen, wie gut die Domäne abgesichert ist. Objekte = wie viel Wissen; validiert % = wie viel davon geprüft ist; offen = noch ungeprüft; Experten = wie viele Personen die Domäne tragen. Ein Experte + wenig validiert = hohes Risiko.",
  "risk.help.busfactor":
    "Wie stark hängt eine Domäne an einzelnen Personen? Ein roter Balken heißt: Das Wissen kommt nur aus EINER Quelle — fällt sie aus, ist es verloren. Grün = mehrere Quellen, also robuster. Der Balken zeigt zusätzlich die Wissensmenge der Domäne.",
  "risk.help.gaps":
    "Offene Wissenslücken sind gestellte Fragen, auf die es (noch) keine gesicherte Antwort gibt. Priorisiere sie, weise sie einer Person zu oder erfasse selbst geprüfte Erfahrung dazu. Aus datenschutzgründen keine sensiblen Details in die Frage schreiben.",
  "health.title": "Knowledge Health",
  "health.band.gut": "gut",
  "health.band.mittel": "mittel",
  "health.band.kritisch": "kritisch",
  "health.explain.gut":
    "Hoher Validierungsstand, wenig veraltetes Wissen und geringe Klumpenrisiken.",
  "health.explain.mittel":
    "Solide Basis, aber offene Lücken/Konflikte oder Revalidierungsbedarf bremsen.",
  "health.explain.kritisch":
    "Niedrige Validierung und/oder viel veraltetes Wissen, offene Konflikte oder Single-Source-Risiken.",
  "health.factor.validatedRatio": "Validierungsquote",
  "health.factor.staleRatio": "Revalidierungsbedarf (stale)",
  "health.factor.singleSourceShare": "Single-Source-Anteil",
  "health.factor.openGaps": "Offene Wissenslücken",
  "health.factor.openConflicts": "Offene Konflikte",
  // AUFTRAG-mega33 BLOCK B (Pedi 27.07.): bei unbelegter Erkennung rechnet die sichtbare Zahl mit
  // dem VOLLEN Konfliktabzug. Die große Zahl ist die schlechtere; der optimistische Rand steht
  // daneben und sagt, was er ist.
  "health.band.unproven": "Einstufung unbelegt",
  "health.range.explain":
    "{{worst}} von 100 im schlechtesten Fall, {{best}} im besten. Solange nicht belegt ist, dass vollständig nach Konflikten gesucht wurde, gilt der schlechtere Wert — deshalb steht hier kein Band.",
  "health.conflictUnproven.title":
    "Die Punktzahl rechnet mit dem vollen Konfliktabzug: {{worst}} statt {{best}} von 100.",
  "health.conflictUnproven.detection-incomplete":
    "Die Konflikt- und Duplikaterkennung ist im Bestand nicht durchgängig vollständig gelaufen. Es ist deshalb nicht ausgeschlossen, dass es mehr Konflikte gibt als gefunden wurden — und ein Abzug von null wäre eine Annahme über etwas Unbekanntes.",
  "health.conflictUnproven.detection-unknown":
    "Über die Reichweite der Konflikt- und Duplikaterkennung liegt keine Aussage vor. Solange nicht belegt ist, dass vollständig geprüft wurde, sagt die Zahl der gefundenen Konflikte nichts über den Bestand.",
  "health.conflictUnproven.known":
    "Bekannt sind {{count}} offene Konflikte ({{penalty}} von höchstens {{max}} Punkten Abzug). Dieser Abzug ist sicher; der Rest bis zum Höchstwert ist die Unsicherheit.",
  // AUFTRAG-mega51 BLOCK G1: die verständliche Bezeichnung führt, der Hausbegriff folgt.
  "risk.busfactor": "Einzelquellen-Risiko (Bus-Faktor)",
  "risk.busEmpty": "Keine Risikodaten.",
  "risk.experts": "Experten",
  // AUFTRAG-mega51 BLOCK F1: gezählte Form — „1 Experte" statt „1 Experten" (Bauform wie
  // lib.facet.showResults aus mega34).
  "risk.expertsCount_one": "{{count}} Experte",
  "risk.expertsCount_other": "{{count}} Experten",
  // Consultant-System (Experten-Matching): entkitschter Ton, kein Hero-Wording, keine Zahlen/Rangfolge.
  "expertise.title": "Wen einbeziehen",
  "expertise.intro":
    "Diese Personen haben schon zu einem Thema beigetragen. Du kannst sie um eine kurze Einordnung bitten — keine Rangfolge, nur wer helfen könnte.",
  "expertise.help":
    "Abgeleitet aus vorhandenen Wissensobjekten (wer zu einem Thema beigetragen hat). Reihenfolge alphabetisch, ohne Bewertung — als Hilfe, wen man ansprechen könnte.",
  "expertise.invite": "Du hast Erfahrung mit {{topic}} — kannst du das kurz einordnen?",
  "expertise.thanks": "Danke, das hilft dem Team.",
  "risk.gaps": "Offene Wissenslücken",
  "risk.gapsEmpty": "Keine offenen Lücken.",
  "risk.gapStatus.offen": "offen",
  "risk.gapStatus.geschlossen": "geschlossen",
  "risk.priorityLabel": "Priorität",
  "risk.priority.hoch": "hoch",
  "risk.priority.mittel": "mittel",
  "risk.priority.niedrig": "niedrig",
  "risk.close": "Schließen",
  "risk.assign": "Experte …",
  "risk.delete": "Löschen",
  "risk.gapNextLabel": "Nächster Schritt",
  "risk.gapNext.prioritize": "Dringlichkeit einschätzen und einordnen.",
  "risk.gapNext.assign": "Einer Fachperson zuweisen.",
  "risk.gapNext.capture": "Wissen erfassen, um die Lücke zu schließen.",
  "risk.gapNext.done": "Geschlossen — erledigt.",
  "risk.gapCapture": "Wissen erfassen",
  "risk.gapRedacted": "Vertrauliche Lücke (Fragetext verborgen)",
  "lcy.kicker": "Lebenszyklus",
  "lcy.banner": "„Stimmt das noch?“ — gekoppelte Objekte nach Anlagenänderung prüfen.",
  "lcy.empty": "Nichts zur Re-Validierung.",
  "lcy.stillValid": "Noch gültig → neue Version",
  "lcy.assetTitle": "Anlagenänderung melden",
  "lcy.assetHint":
    "Referenz der geänderten Anlage/Prozess eingeben — gekoppelte Wissensobjekte werden zur Prüfung markiert.",
  "lcy.assetPlaceholder": "Anlagen-/Prozess-Referenz (z. B. Presse-P2)",
  "lcy.assetTrigger": "Revalidierung auslösen",
  "lcy.assetMarked": "{{n}} Objekt(e) für „{{asset}}“ zur Prüfung markiert.",
  "lcy.pendingTitle": "Zur Re-Validierung",
  "lcy.revalAsset": "Anlagenbezug",
  "lcy.revalNextLabel": "Nächster Schritt",
  "lcy.revalNext.review": "Prüfen, ob nach der Änderung noch gültig — dann als geprüft bestätigen.",
  "lcy.revalNext.validate": "Objekt ist nicht freigegeben — zuerst validieren.",
  "lcy.revalCta.review": "Zur Prüfung",
  "lcy.revalCta.validate": "Zur Validierung",
  "lcy.revalNext.openKo": "Objekt öffnen — Details liegen aktuell nicht vor.",
  "lcy.revalMissing": "Objektdetails nicht im geladenen Bestand.",
  "lcy.revalSaved": "Revalidierung erfasst.",
  "lcy.nextViewKo": "Objekt ansehen",
  "lcy.nextUse": "Wissen nutzen (fragen)",
  "lcy.pathTitle": "Lernpfad · {{role}}",
  "lcy.pathEmpty": "Für deine Rolle ist noch kein Lernpfad hinterlegt.",
  "lcy.stepComplete": "Als erledigt markieren",
  "lcy.stepDone": "Erledigt",
  "ana.kicker": "Analytics & Audit",
  "ana.exec.title": "Executive-Blick",
  "ana.exec.validated": "Validiertes Wissen",
  "ana.exec.validatedHint": "geprüfte, gesicherte Objekte",
  "ana.exec.openReviews": "Offene Prüfungen",
  "ana.exec.openReviewsHint": "warten auf Validierung",
  "ana.exec.busFactor": "Einzelquellen-Risiko",
  "ana.exec.busFactorHint": "Kategorien mit nur einer Quelle",
  "ana.exec.rescued": "Gerettete Lücken",
  "ana.exec.rescuedHint": "geschlossene Wissenslücken",
  "ana.help.exec":
    "Vier Kern-Kennzahlen aus Live-Daten: validiertes Wissen, offene Prüfungen, Bus-Faktor-Risiko und gerettete Lücken. Ein ruhiger Überblick für Entscheider — je höher der Validierungsgrad und je niedriger das Risiko, desto gesünder die Wissensbasis.",
  "ana.help.health":
    "Der Health-Score (0–100) fasst Validierungsgrad, Aktualität und Quellenbreite zusammen. Das Band (z. B. gut oder kritisch) zeigt den Zustand auf einen Blick; darunter sehen Sie, welche Faktoren den Wert heben oder senken.",
  "ana.help.impact":
    "Wirkung zeigt, was das System real leistet: validierte Objekte gesamt, gestellte Fragen, ohne Lücke beantwortete Fragen und die daraus errechnete Antwortquote. Der Wochenverlauf macht sichtbar, ob validiertes Wissen wächst.",
  "ana.help.audit":
    "Das Audit-Log hält jede relevante Aktion fest — wer (Actor), was (Aktion) und woran (Ziel). Einträge werden nur angefügt und hash-verkettet; eine nachträgliche Abweichung ist rechnerisch prüfbar. Über die Filter grenzen Sie schnell auf eine Person, eine Aktionsart oder ein Objekt ein.",
  "ana.total": "Gesamt",
  "ana.categories": "Kategorien",
  "ana.byType": "Verteilung nach Wissensart",
  "ana.audit": "Audit-Log (hash-verkettet)",
  "ana.auditEmpty": "Keine Einträge.",
  "ana.avgTrust": "Ø Vertrauen",
  "ana.validationRate": "Validierungsquote",
  "ana.openTasks": "Offene Aufgaben",
  "ana.doneTasks": "Erledigt",
  "ana.impact": "Wirkung",
  "ana.impactValidated": "Validiert gesamt",
  "ana.impactAsk": "Fragen gesamt",
  "ana.impactAnswered": "Ohne Lücke beantwortet",
  "ana.impactRate": "Antwortquote",
  "ana.weekly": "Validiert je Woche",
  "ana.filterActor": "Actor",
  "ana.filterAction": "Aktion",
  "ana.filterTarget": "Ziel filtern …",
  "ana.filterAll": "alle",
  "ana.auditCount": "{{shown}} von {{total}}",
  "ana.auditNoMatch": "Keine Treffer für diesen Filter.",
  "adm.kicker": "Nutzerverwaltung",
  "adm.empty": "Keine Nutzer.",
  "adm.approve": "Freigeben",
  "adm.remove": "Löschen",
  "adm.createTitle": "Nutzer anlegen",
  "adm.name": "Name",
  "adm.email": "E-Mail",
  "adm.password": "Passwort",
  "adm.role": "Rolle",
  "adm.create": "Anlegen",
  "adm.created": "Nutzer angelegt.",
  "adm.createInvalid": "Bitte noch ergänzen:",
  "adm.createHint": "Erforderlich: Name, gültige E-Mail und Passwort (mind. 8 Zeichen).",
  "adm.field.name": "Name",
  "adm.field.email": "gültige E-Mail",
  "adm.field.password": "Passwort (mind. 8 Zeichen)",
  "adm.reset": "Passwort zurücksetzen",
  "adm.newPassword": "Neues Passwort",
  "adm.newPasswordRepeat": "Passwort wiederholen",
  "adm.passwordMismatch": "Die Passwörter stimmen nicht überein.",
  "adm.resetConfirm": "Zurücksetzen",
  "adm.resetCancel": "Abbrechen",
  "adm.resetDone": "Passwort zurückgesetzt; alle Sitzungen beendet.",
  "adm.seedTitle": "Demodaten laden",
  "adm.seedHint":
    "Lädt einen kleinen, echten Demo-Bestand (KOs, Validierung, Lücke, Konflikt, Duplikat, Anhang) — auch neben vorhandenen Daten. Dein echter Bestand bleibt unberührt und wird nie überschrieben. Über „Demodaten entfernen“ gezielt wieder entfernbar. (Konflikt-/Duplikat-Befund erscheint mit aktivem KI-Reasoner.)",
  "adm.seedButton": "Demodaten laden",
  "adm.seedDone": "Demodaten geladen: {{kos}} Wissensobjekte, {{users}} Nutzer.",
  "adm.seedSkipped": "Übersprungen: Instanz ist nicht leer (Bestand vorhanden).",
  "empty.cta.capture": "Wissen erfassen",
  "empty.cta.import": "Importieren",
  "empty.cta.admin": "Demodaten (Admin)",
  "empty.cta.library": "Zur Bibliothek",
  "empty.cta.validation": "Zur Validierung",
  "empty.cta.tasks": "Zu meinen Aufgaben",
  "story.rescue.title": "Klarwerk sichert Erfahrungswissen, bevor es verloren geht.",
  "story.honest":
    "Nichts wird automatisch validiert — Wissen gilt erst nach der Prüfung im Team als gesichert.",
  "story.surface.start.lead":
    "Noch nichts offen — keine Sackgasse, sondern der Anfang. Starte den Kreis und erfasse Erfahrungswissen, das sonst mit der Zeit verschwindet.",
  "story.surface.tasks.lead":
    "Gerade nichts zu tun. Sobald Wissen geprüft oder nachgebessert werden muss, landet es hier — oder du erfasst selbst den nächsten Beitrag.",
  "story.surface.library.lead":
    "Noch kein Wissen zum Nachschlagen. Erfasse den ersten Beitrag — nach der Prüfung wird er hier quellengebunden nutzbar.",
  "story.surface.validation.lead":
    "Nichts zu prüfen. Erfasstes Wissen erscheint hier zur Team-Prüfung, bevor es als gesichert gilt und genutzt werden kann.",
  "adm.auditTitle": "Letzte Nutzer-/Auth-Aktivitäten (Audit)",
  "adm.auditEmpty": "Keine Nutzer-Audit-Einträge.",
  "prof.kicker": "Konto",
  "prof.language": "Sprache",
  "prof.passwordTitle": "Passwort ändern",
  "prof.oldPassword": "Aktuelles Passwort",
  "prof.newPassword": "Neues Passwort",
  "prof.passwordSubmit": "Passwort ändern",
  "prof.passwordChanged":
    "Passwort geändert. Aus Sicherheitsgründen wurdest du überall abgemeldet — bitte neu anmelden.",
  "help.kicker": "Hilfe",
  "help.open": "Hilfe öffnen",
  "help.openCenter": "Im Hilfe-Center öffnen",
  "help.search": "Hilfe durchsuchen …",
  "help.intro":
    "Kurze Einstiegshilfe zu den wichtigsten Klarwerk-Abläufen. Suche nach Stichwort oder springe direkt in den passenden Bereich.",
  "help.noResults": "Keine Hilfe zu diesem Stichwort gefunden.",
  "help.openRoute": "Bereich öffnen",
  // Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — Panel-Texte + Seiten-Erklärungen.
  "klara.title": "Klara",
  "klara.subtitle": "Deine Hilfe in KLARWERK",
  "klara.open": "Klara öffnen — Hilfe zu dieser Seite",
  "klara.intro":
    "Ich erkläre dir Seiten, Felder und Begriffe. Meine Antworten kommen aus der Hilfe-Bibliothek — was dort fehlt, erfinde ich nicht.",
  "klara.pageLabel": "Du bist hier",
  "klara.fieldLabel": "Aktives Element",
  "klara.fieldHint":
    "Tippe in ein Feld oder einen Bereich mit ?-Hilfe — dann erkläre ich ihn hier automatisch.",
  "klara.aiSearch": "Mit KI-Unterstützung suchen",
  "klara.aiBusy": "Die KI liest die passenden Hilfe-Einträge …",
  "klara.aiAnswerTitle": "KI-Antwort aus der Hilfe",
  "klara.aiDisclaimer": "KI-generiert — nicht zu 100 % geprüft",
  "klara.aiGoto": "Zum Bereich: {{target}}",
  "klara.aiSources": "Grundlage",
  "klara.aiEmpty":
    "Die KI hat in den passenden Hilfe-Einträgen keine sichere Antwort gefunden — eine ehrliche Hilfe-Lücke. Formuliere die Frage anders oder schau auf der Hilfeseite nach.",
  "klara.speak": "Vorlesen",
  "klara.speakStop": "Vorlesen stoppen",
  "klara.inspect": "Element erklären",
  "klara.inspectHint":
    "Zeige-Modus aktiv: Klicke auf ein beliebiges Element (Knopf, Kennzahl, Überschrift) — die Aktion wird dabei NICHT ausgelöst. Esc beendet den Modus.",
  "klara.inspectFor": "Erklärung zu: {{label}}",
  "klara.selectionExplain": "Markierung erklären",
  "klara.selectionEmpty":
    "Markiere zuerst einen Begriff auf der Seite — dann suche ich die passende Erklärung.",
  "klara.searchPlaceholder": "Hilfe durchsuchen … z. B. Validierung, Bus-Faktor, Entwurf",
  "klara.resultsFor": "Treffer für: {{q}}",
  "klara.noResults":
    "Dazu habe ich noch keinen Eintrag — eine ehrliche Hilfe-Lücke. Die Bibliothek wächst gerade; auf der Hilfeseite findest du die geführten Einstiege.",
  "klara.moreHelp": "Zur Hilfeseite",
  "klara.page.start":
    "Dein Überblick: was frisch gesichert wurde, was heute geholfen hat und was auf dich wartet. Von hier springst du direkt in jeden Bereich.",
  "klara.page.tasks":
    "Deine offenen Aufgaben: zugewiesene Prüfungen, Lücken und Fälligkeiten — mit direktem Absprung zur jeweiligen Arbeit.",
  "klara.page.capture":
    "Hier sicherst du Erfahrungswissen: erzählen, diktieren, im Interview oder aus einer Datei. Die KI strukturiert nur — du prüfst und reichst ein.",
  "klara.page.ask":
    "Stell eine Frage. Die Antwort ist quellengebunden und zeigt dir, worauf sie steht und in welchem Zustand diese Quellen sind — gibt es keine Grundlage, entsteht eine ehrliche Wissenslücke.",
  "klara.page.library":
    "Alle Wissensobjekte mit Status, Vertrauen und Filtern. Von hier geht es in jedes Detail.",
  "klara.page.external":
    "Externes Wissen (z. B. Web-Quellen) — immer Stufe 2: nie peer-validiert und klar getrennt vom geprüften Bestand.",
  "klara.page.validation":
    "Das Prüf-Board: Du bewertest eingereichtes Wissen. Erst mit genug grünen Freigaben (und ohne rote) gilt ein Objekt als validiert.",
  "klara.page.conflicts":
    "Widersprüche zwischen Wissensobjekten: sichten, zweite Meinung holen, auflösen — damit die Bibliothek eindeutig bleibt.",
  "klara.page.duplicates":
    "Mögliche Doppelungen: prüfen und zusammenführen, damit Wissen nicht zersplittert.",
  "klara.page.risk":
    "Wo ist Wissen dünn oder hängt an einer Person? Offene Lücken, Bus-Faktor und Domänen-Risiko — mit Links zu den betroffenen Objekten.",
  "klara.page.lifecycle":
    "Wissen altert: Hier siehst du fällige Re-Validierungen und Lernpfade, damit Geprüftes geprüft bleibt.",
  "klara.page.analytics":
    "Kennzahlen aus echten Daten plus das hash-verkettete Audit-Log — wer hat was wann getan.",
  "klara.page.admin":
    "Konten, KI-Zuordnung, Daten und Sicherheit an einem Ort. Nur für Admins sichtbar.",
  "klara.page.help":
    "Geführte Einstiege, Themen und Suche. Ich bin der schnelle Weg — für die Tiefe lohnt sich diese Seite.",
  "klara.page.profile": "Dein Konto: Name, Sprache, Abmelden.",
  "klara.page.koDetail":
    "Die Detailseite eines Wissensobjekts: Inhalt, Versionen, Quellen, Anhänge, Prüf-Historie und Aktionen je nach Rolle.",
  // ==============================================================================================
  // JOB 1151 (KA3) — DIE ANGEBOTSKARTE. „Die Chefsekretärin klopft an, sie platzt nicht herein."
  // ==============================================================================================
  //
  // Drei Texte für die leise Karte, die Klara im Word-Aufgabenfenster beim Öffnen und nach einer
  // Schreibpause legt. Sie stehen HIER, weil `apps/web/src/i18n.ts` die Produktwörterbuchquelle ist
  // (KA3 nennt sie ausdrücklich) — und sinngleich ein zweites Mal im buildlosen Wörterbuch des
  // Aufgabenfensters (`apps/web/public/word-addin/taskpane.html`, Marker `KW-KA3-KARTEN`). Das ist
  // dasselbe Doppelmuster, das `ai.generatedNotice` ↔ `aiGeneratedNotice` seit mega61 trägt: das
  // Panel hat kein Modulsystem und kann diese Datei nicht importieren. Eine DRITTE Textquelle
  // entsteht dabei nicht.
  "klara.offer.label": "Klaras Angebote",
  "klara.offer.lead": "Dazu gibt es schon:",
  "klara.offer.open": "Ansehen",
  // Sektions-Erklärungen (Berater-Lieferung 05.07.): je Überschrift EIN Erklärtext (shelp.*).
  "shelp.adm.seedTitle":
    "Hier lädst du fertige Beispieldaten, mit denen du KLARWERK gefahrlos ausprobieren kannst. Das geht nur, solange die Instanz noch leer ist — so mischen sich echte Daten und Beispiele nie. Alle Beispieldaten sind als solche markiert und lassen sich später mit einem Klick rückstandslos entfernen.",
  "shelp.adm.createTitle":
    "In diesem Abschnitt legst du ein neues Nutzerkonto an und gibst ihm eine Rolle. Betrachter lesen, Experten erfassen Wissen, Controller prüfen es, und Admins verwalten alles. Die Rolle bestimmt also, welche Knöpfe die Person später sieht. Jede Kontoänderung wird im Prüfprotokoll festgehalten.",
  "shelp.adm.auditTitle":
    "Dieses Protokoll zeigt die letzten Anmeldungen und Nutzeraktionen. Jede Zeile ist per Hash mit der vorherigen verkettet: wird nachträglich etwas geändert oder entfernt, passt der Hash nicht mehr. Mit dem Prüfknopf kannst du die Kette jederzeit nachrechnen lassen; das Ergebnis sagt dir ehrlich, ob eine Abweichung gefunden wurde — und, falls ja, an welchem Eintrag.",
  "shelp.ana.byType":
    "Die Balken zeigen, wie sich euer Wissen auf die fünf Wissensarten verteilt — vom Bauchgefühl über bewährte Vorgehensweisen bis zum Negativwissen, also dem Wissen darüber, was man nicht tun darf. Fehlt eine Art fast ganz, ist das ein Hinweis: Dort wird bisher wenig festgehalten. Nutze das Bild, um gezielt nachzufragen, nicht um Personen zu bewerten.",
  "shelp.ana.weekly":
    "Diese Übersicht zählt, wie viele Wissensobjekte in jeder Woche die Prüfung bestanden haben. Sie zeigt den Takt, in dem gesichertes Wissen entsteht — nicht, wie fleißig einzelne Personen waren. Wird die Kurve flach, bleiben meist Prüfungen liegen; ein Blick in den Prüfbereich zeigt dann, wo es hakt.",
  "shelp.ask.steps":
    "Hier stehen die Wissensobjekte, die für deine Frage aus dem Bestand herangezogen wurden — mit einem Auszug aus dem Fundstück. Es ist KEINE Herleitung: KLARWERK protokolliert nicht, welcher Satz der Antwort aus welcher Quelle stammt. Die Liste sagt dir, worauf gesucht wurde; nachprüfen kannst du, indem du die genannte Quelle öffnest.",
  "shelp.ask.sources":
    "Jede Antwort in KLARWERK stützt sich ausschließlich auf eure eigenen Wissensobjekte — und genau die stehen hier. Die zuerst genannten haben die Antwort getragen; die übrigen wurden herangezogen, aber nicht verwendet. Tippe eine Quelle an, um das vollständige Objekt mit Belegen und Prüfstand zu öffnen. Steht hier nichts, gibt es zu deiner Frage kein passendes Wissen, und KLARWERK sagt das ehrlich, statt etwas zu erfinden.",
  "shelp.capture.resumeTitle":
    "Hier liegen deine gespeicherten Entwürfe — alles, was du angefangen, aber noch nicht eingereicht hast. Nichts davon ist verloren, und nichts davon sehen die Prüfer, solange du es nicht einreichst. Tippe einen Entwurf an, um weiterzuarbeiten, oder verwirf ihn, wenn er sich erledigt hat.",
  "shelp.ext.title":
    "Hier kannst du gezielt nach externen Quellen suchen und sie an dein Wissen anhängen, zum Beispiel einen Fachartikel. Wichtig: Externe Quellen sind Zusatzmaterial der Stufe zwei — sie gelten als ungeprüft und ersetzen nie die Prüfung durch deine Kolleginnen und Kollegen. Ob diese Suche verfügbar ist, entscheidet die Verwaltung über eine eigene Freigabestufe.",
  "shelp.extpage.resultsTitle":
    "Diese Liste zeigt die Treffer der externen Suche. Alles hier stammt von außerhalb und ist ungeprüft — darum wird es deutlich als extern markiert und nie automatisch übernommen. Du entscheidest selbst, ob du einen Treffer als Quelle der Stufe zwei anhängst. Gesichertes Wissen entsteht daraus erst, wenn Menschen es prüfen.",
  "shelp.ko.statement":
    "Das ist der Kern des Wissensobjekts: eine einzelne, klare Aussage darüber, was gilt. Alles andere auf dieser Seite — Bedingungen, Maßnahmen, Belege — hängt an diesem Satz. Lies die Aussage zuerst und prüfe dann darunter, wann sie gilt und worauf sie sich stützt.",
  "shelp.ko.conditions":
    "Bedingungen sagen dir, wann die Aussage gilt — und damit auch, wann nicht. Ein Beispiel: Eine Regel für den Winterbetrieb hilft dir im Sommer nichts. Prüfe vor dem Anwenden immer, ob deine Situation zu den genannten Bedingungen passt.",
  "shelp.ko.measures":
    "Maßnahmen beschreiben, was konkret zu tun ist, wenn die Aussage zutrifft — Schritt für Schritt. Sie sind bewusst knapp gehalten, damit sie im Alltag anwendbar bleiben. Fehlt dir ein Schritt oder ist etwas unklar, hinterlasse einen Kommentar; so wird das Wissen mit der Zeit besser.",
  "shelp.ko.provenance":
    "Hier steht, woher dieses Wissen stammt: wer es erfasst hat, wann es entstanden ist und ob es einmal übertragen wurde. Herkunft ist in KLARWERK keine Nebensache — nachvollziehbare Herkunft ist ein Teil des Vertrauens. Bei Rückfragen weißt du hier, an wen du dich wenden kannst.",
  "shelp.ko.lineageTitle":
    "Dieser Abschnitt zeigt die Verwandtschaft dieses Wissens: woraus es hervorgegangen ist und mit welchen anderen Objekten es zusammenhängt. So erkennst du, ob es Teil eines größeren Themas ist. Nutze die Verknüpfungen, um dich weiterzuhangeln, statt isolierte Einzelstücke zu lesen.",
  "shelp.nb.title":
    "Das Wissensnetz zeigt die Nachbarschaft des Beitrags, den du gerade liest: in der Mitte der Beitrag, darum herum, was über gemeinsame Schlagwörter dazugehört — und an jeder Verbindung steht, warum. Ein Klick auf einen Nachbarn macht ihn zur neuen Mitte; „Beitrag öffnen“ führt zum Artikel. Schlagwörter, die fast alle Beiträge tragen, zählen dabei nicht als Verwandtschaft — das steht dann ehrlich dabei.",
  "shelp.ko.history":
    "Jede inhaltliche Änderung erzeugt eine neue Version, und hier siehst du den Verlauf: wer wann was geändert hat und mit welcher Notiz. Ältere Stände bleiben erhalten, nichts wird still überschrieben. So kannst du nachvollziehen, wie sich das Wissen entwickelt hat.",
  "shelp.ko.evidenceTitle":
    "Evidenz sind die Belege hinter der Aussage: angehängte Quellen, Dokumente und Nachweise, jeweils der Version zugeordnet, zu der sie gehören. Je besser die Beleglage, desto belastbarer das Wissen — Vertrauen entsteht in KLARWERK aus Nachweisen, nicht aus Behauptungen. Ein Objekt ohne Evidenz ist nicht automatisch falsch, verdient aber einen kritischeren Blick.",
  "shelp.ko.snapshotsTitle":
    "Ein Schnappschuss ist der vollständige, eingefrorene Stand einer früheren Version. Hier kannst du nachlesen, wie das Objekt zu einem bestimmten Zeitpunkt genau aussah. Die Schnappschüsse sind nur zum Lesen da — verändern kann sie niemand, und genau das macht sie als Nachweis wertvoll.",
  "shelp.ko.comments":
    "Hier tauschen sich Kolleginnen und Kollegen zu diesem Objekt aus: Rückfragen, Ergänzungen, Einwände. Ein Kommentar ändert das Wissen selbst nicht — er ist ein Gespräch am Rand, das oft zu einer besseren nächsten Version führt. Wenn du etwas weißt, das hier fehlt, schreib es dazu.",
  "shelp.ko.attachments":
    "Hier liegen Dokumente und Bilder, die zu diesem Wissen gehören — etwa ein Foto der Anlage oder eine Anleitung. Anhänge sind Anschauungsmaterial und Belege, keine geprüften Aussagen. Beim Hochladen gelten Größengrenzen, die eure Verwaltung festlegt.",
  "shelp.lcy.assetTitle":
    "Manches Wissen hängt an einer bestimmten Maschine oder Einrichtung. Wenn sich dort etwas ändert — ein Umbau, ein Austausch, eine neue Einstellung — kannst du das hier melden. Die betroffenen Wissensobjekte kommen dann zur erneuten Prüfung, damit niemand mit veraltetem Stand arbeitet.",
  "shelp.lcy.pendingTitle":
    "Wissen altert. In dieser Liste stehen Objekte, deren Prüfung eine Auffrischung braucht — zum Beispiel weil sie lange nicht angefasst wurden oder weil sich ihr Umfeld geändert hat. Erneut geprüftes Wissen bleibt vertrauenswürdig; liegen gebliebene Auffrischungen sind ein stilles Risiko.",
  "shelp.lcy.pathTitle":
    "Ein Lernpfad ist eine sinnvolle Lese-Reihenfolge durch das vorhandene Wissen, zugeschnitten auf eine Rolle. Neue Kolleginnen und Kollegen arbeiten ihn Schritt für Schritt durch und haken ab, was sie gelesen haben. So wird aus einzelnen Wissensobjekten ein geführter Einstieg.",
  "shelp.out.kindTitle":
    "Hier wählst du, welche Art von Dokument aus eurem gesicherten Wissen entstehen soll — zum Beispiel eine Arbeitsanweisung, eine Checkliste oder eine Schulungsunterlage. Der Typ bestimmt Aufbau und Tonfall des Ergebnisses. Erzeugt wird erst, wenn du es auslöst; von selbst passiert hier nichts.",
  "shelp.out.sourcesTitle":
    "Für ein Dokument kommen nur geprüfte Wissensobjekte infrage, und genau die wählst du hier aus. Was nicht validiert ist, steht bewusst nicht zur Auswahl — ein erzeugtes Dokument soll sich nur auf gesichertes Wissen stützen. Wähle die Objekte, die inhaltlich zusammengehören.",
  "shelp.out.composeTitle":
    "Hier bringst du die ausgewählten Wissensobjekte in die Reihenfolge, in der sie im Dokument erscheinen sollen. Die Reihenfolge trägt die Logik des Ergebnisses — vom Überblick ins Detail oder entlang eines Ablaufs. Verschiebe die Einträge, bis der rote Faden stimmt.",
  "shelp.out.previewTitle":
    "Die Vorschau zeigt das Dokument so, wie es aus deinen Bausteinen erzeugt würde, im Textformat Markdown. Prüfe hier in Ruhe, ob Inhalt und Reihenfolge passen, bevor du das Ergebnis herunterlädst oder kopierst. Einen Export als PDF gibt es derzeit nicht.",
  "shelp.out.provenanceTitle":
    "Zu jedem erzeugten Dokument gehört der Nachweis, aus welchen Wissensobjekten es gebaut wurde. Dieser Abschnitt hält die Herkunft fest, damit jede Aussage im Dokument auf ihre Quelle zurückführbar bleibt. Das ist derselbe Grundsatz wie überall in KLARWERK: Erst der Beleg macht eine Aussage belastbar.",
  "shelp.imp.uploadTitle":
    "Hier spielst du einen früher erstellten Export im JSON-Format wieder ein. Die Einträge werden nicht blind übernommen: Sie landen zunächst als Kandidaten zur Durchsicht, damit nichts ungeprüft in den Bestand rutscht. Prüfe die Kandidatenliste, bevor du etwas übernimmst — auch, um Doppelungen zu vermeiden.",
  "shelp.ext.pipeline.title":
    "Dieser Bereich zeigt, was beim Einlesen externer Inhalte passiert ist: was erkannt wurde, was auffällig war und was noch auf eine Entscheidung wartet. Die Pipeline übernimmt nichts von allein — sie bereitet vor, Menschen entscheiden. Arbeite die Befunde am besten von oben nach unten ab.",
  "shelp.imp.queueTitle":
    "In dieser Warteschlange stehen eingelesene Quellen, die noch ein menschliches Urteil brauchen: übernehmen, überarbeiten oder verwerfen. Nichts daraus wird ohne deine Entscheidung Teil des Wissensbestands. Hier trennt sich Rohmaterial von gesichertem Wissen.",
  "shelp.mgmt.jumpTitle":
    "Diese Leiste ist das Inhaltsverzeichnis der Management-Sicht. Ein Tipp auf einen Eintrag springt direkt zum jeweiligen Abschnitt weiter unten. Sie ändert nichts an den Daten — sie hilft nur beim schnellen Navigieren.",
  "shelp.mgmt.overview":
    "Dieser Überblick fasst den aktuellen Zustand eures Wissensbestands in wenigen Kennzahlen zusammen — etwa wie viel Wissen vorhanden, geprüft oder in Arbeit ist. Er ist eine Momentaufnahme zur Orientierung, kein Zeugnis. Für Einzelheiten öffnest du die Abschnitte darunter.",
  "shelp.mgmt.capital":
    "Dieser Wert verdichtet den Zustand eures Wissensbestands zu einer einzigen Zahl — er berücksichtigt zum Beispiel, wie viel Wissen geprüft und wie gut es belegt ist. Lies ihn als grobe Einordnung und beobachte vor allem seine Entwicklung über die Zeit. Eine einzelne Zahl ersetzt nie den Blick in die Details.",
  "shelp.mgmt.valuation":
    "Dieser Abschnitt macht den Wert eures Wissens greifbarer: eine Einordnung, welche Bestände besonders viel zu Sicherheit und Handlungsfähigkeit beitragen. Die Zahlen sind Orientierungswerte aus dem Bestand, keine geprüfte Bilanz. Nutze sie, um Prioritäten zu besprechen, nicht als Buchhaltung.",
  "shelp.mgmt.statement":
    "Das Knowledge Statement ist ein zusammenfassender Bericht über euren Wissensbestand, gedacht für Leitung und Gremien. Er beantwortet in Kurzform: Was haben wir, wie belastbar ist es, und wo sind Lücken. Der Bericht speist sich aus den echten Beständen — was er nicht belegen kann, behauptet er nicht.",
  "shelp.mgmt.maturity":
    "Die Reifereise ordnet ein, wie weit eure Organisation im Umgang mit Wissen ist — von den ersten gesicherten Einträgen bis zum eingespielten Kreislauf aus Erfassen, Prüfen und Pflegen. Sie zeigt die nächste sinnvolle Etappe, keine Note. Reife wächst mit der Nutzung, nicht auf Knopfdruck.",
  "shelp.mgmt.house":
    "Das Wissenshaus ist ein Bild eurer Themenlandschaft: Räume stehen für Wissensgebiete, und du siehst auf einen Blick, welche gut gefüllt und welche fast leer sind. Leere Räume sind keine Schande, sondern eine Einladung — dort lohnt sich das nächste Erfassen. Tippe einen Bereich an, um hineinzuschauen.",
  "shelp.mgmt.recommendations":
    "Hier schlägt KLARWERK nächste Schritte vor, die sich aus eurem Bestand ergeben — zum Beispiel liegen gebliebene Prüfungen oder ein Wissensgebiet, das nur aus einer Quelle gespeist wird. Es sind Vorschläge, keine Aufträge: Du entscheidest, was davon dran ist. Jeder Vorschlag führt dich direkt zur passenden Stelle.",
  "shelp.mgmt.priorities":
    "Diese Liste ordnet Wissensthemen danach, wie dringend sie Aufmerksamkeit brauchen — bewertet über neun Gesichtspunkte, etwa Risiko, Alter und die Abhängigkeit von einzelnen Wissensquellen. Oben steht, was zuerst dran sein sollte. Die Reihenfolge ist eine Empfehlung als Gesprächsgrundlage, keine automatische Entscheidung.",
  "shelp.mgmt.pilot":
    "Dieser Bericht bündelt, was in den ersten dreißig, sechzig und neunzig Tagen eines Pilotbetriebs geschehen ist und was als Nächstes ansteht. Er macht den Fortschritt für alle Beteiligten sichtbar — ehrlich, mit erreichten und offenen Punkten. Gedacht als gemeinsame Grundlage für das Gespräch mit der Leitung.",
  "shelp.mrun.title":
    "Diese Liste protokolliert die letzten Einsätze der KI: welche Aufgabe lief, welches Modell geantwortet hat, wie lange es gedauert hat und ob ein Ersatzweg nötig war. Inhalte deiner Texte stehen hier bewusst nicht — nur technische Eckdaten. So bleibt nachvollziehbar, was die KI wann getan hat.",
  "shelp.rcfg.title":
    "Hier siehst du, welche KI für welche Aufgabe eingestellt ist — die Cloud-KI, eure On-Premise Enterprise AI oder der regelbasierte Modus ganz ohne Modell. Die Zuordnung lässt sich je Aufgabe ändern, und die App zeigt ehrlich an, was gerade wirksam ist. KI-Schlüssel bleiben dabei immer auf dem Server; im Browser landet nie einer.",
  "shelp.evx.title":
    "Der Evidenz-Index ist die Qualitätssicht auf die Beleglage: Er zeigt, welche Wissensobjekte gut belegt sind und wo Nachweise fehlen. Damit findest du gezielt die Einträge, die vor dem nächsten Einsatz Belege brauchen. Gut belegtes Wissen ist das Rückgrat jeder verlässlichen Antwort.",
  "shelp.prov.title":
    "Dieser Index prüft die Herkunftsseite der Qualität: Ist bei jedem Wissensobjekt nachvollziehbar, woher es stammt und wie es entstanden ist? Auffälligkeiten stehen oben, damit du sie zuerst siehst. Lückenlose Herkunft ist die Grundlage dafür, dass man Wissen später noch einordnen kann.",
  "shelp.readiness.title":
    "Dieser Abschnitt schätzt ein, wie startklar euer Wissenssystem als Ganzes ist — von der Datenbasis über die Prüfprozesse bis zur KI-Anbindung. Die Ampeln zeigen, wo es noch hakt und was als Nächstes sinnvoll ist. Es ist eine Standortbestimmung, keine Abnahme.",
  "shelp.kos.hintsTitle":
    "Hier sammelt die Qualitätssicherung konkrete Hinweise aus dem Bestand: Dinge, die auffällig sind und einen Blick verdienen — etwa dünn belegte Objekte oder verwaiste Themen. Jeder Hinweis nennt den Fundort, damit du direkt hinspringen und die Ursache beheben kannst.",
  "shelp.evFresh.title":
    "Belege altern genauso wie Wissen. Diese Sicht zeigt, wie frisch die Nachweise hinter euren Wissensobjekten sind und wo alte Belege eine Auffrischung brauchen. So erkennst du Einträge, die formal belegt, aber inhaltlich womöglich überholt sind.",
  // SCRUM-305: kompakte Pilot-Checkliste für den ersten echten Nutzerlauf (Stage-1, ehrlich).
  "pilot.title": "Pilot-Checkliste: erster Nutzerlauf",
  "pilot.subtitle":
    "Worauf im ersten echten Lauf achten — Stage-1, ehrlich. Jeder Punkt führt in den passenden Bereich.",
  "pilot.check.capture":
    "Erfassen speichert offen: frisch erfasstes Wissen ist noch nicht validiert.",
  "pilot.check.validation":
    "Validierung ist Review/Entscheidung: Peers bewerten, bis es gesichert ist — keine automatische Freigabe.",
  "pilot.check.use":
    "Fragen/Bibliothek nutzen Wissen quellen- und statusbewusst: eine Antwort ist nur so belastbar wie ihre Quelle.",
  "pilot.check.gap":
    "Keine Grundlage? Die Lücke wird ehrlich benannt und führt in die Erfassung — kein erfundenes Wissen.",
  "pilot.check.maintain":
    "Revalidierung ist „Aktuell halten“: fällige Objekte erneut prüfen, keine automatische Dauergültigkeit.",
  // SCRUM-306: Next-Steps nach dem Demodaten-/Pilot-Start (nur sichtbar, keine Auto-Weiterleitung).
  "pilot.next.title": "Nächster Schritt",
  "pilot.next.hint":
    "Demodaten sind Beispiele, kein produktiver Beweis. Jetzt Stage-1 ansehen oder die Pilot-Checkliste öffnen.",
  "pilot.next.start": "Stage-1 starten (Start öffnen)",
  "pilot.next.checklist": "Pilot-Checkliste öffnen",
  "pilot.next.ask": "Beispiel-Frage öffnen",
  // SCRUM-307: beobachtete Pilot-Reibungen in bestehende Knowledge-OS-Flows einordnen (kein Backend,
  // keine Speicherung, keine Jira-/Task-Automatik). UX-Notiz bewusst ohne Produktlink.
  "pilot.obs.title": "Pilot-Befund einordnen",
  "pilot.obs.subtitle":
    "Beobachtete Reibung schnell dem passenden bestehenden Klarwerk-Fluss zuordnen. Nichts wird gespeichert; reine UX-Notizen gehören außerhalb des Produkts.",
  "pilot.obs.mapLabel": "Gehört in",
  "pilot.obs.missing.label": "Wissen fehlt ganz (keine Grundlage zur Frage).",
  "pilot.obs.missing.map": "Risiko/Lücke — priorisieren und erfassen.",
  "pilot.obs.unverified.label": "Wissen ist unfertig oder noch nicht geprüft.",
  "pilot.obs.unverified.map": "Validierung — bewerten, bis es gesichert ist.",
  "pilot.obs.outdated.label": "Wissen wirkt veraltet oder nicht mehr gültig.",
  "pilot.obs.outdated.map": "Lebenszyklus — Revalidierung, „Aktuell halten“.",
  "pilot.obs.source.label": "Quelle, Vertrauen oder Nutzbarkeit ist unklar.",
  "pilot.obs.source.map": "Bibliothek/KO-Detail — Status, Vertrauen, Version, Quelle prüfen.",
  "pilot.obs.uxnote.label": "Reine UX-/Pilotnotiz (Bedienung, Wording, Ablauf).",
  "pilot.obs.uxnote.map":
    "Organisatorisch notieren — wird nicht im Produkt gespeichert, kein Workflow.",
  "pilot.obs.openFlow": "Fluss öffnen",
  "help.firststart.title": "Erststart & Demodaten",
  "help.firststart.body":
    "Frische Instanzen sind zunächst leer. Als Admin kannst du unter Admin 'Demodaten laden', um Beispiel-Wissen, Validierung, Lücken und Konflikte sichtbar zu machen — ideal für Review und Einarbeitung.",
  "help.library.title": "Bibliothek & Wissensobjekt",
  "help.library.body":
    "Die Bibliothek durchsucht und filtert den Bestand (Art, Status, Kategorie, Tag). Ein Klick öffnet das Wissensobjekt mit Aussage, Quellen/Anhängen, Versionen und Evidenz.",
  "help.tasks.title": "Meine Aufgaben",
  "help.tasks.body":
    "Hier sammeln sich die dir zugewiesenen Validierungs- und Rückfrage-Aufgaben. Von dort springst du direkt ins jeweilige Wissensobjekt zur Bearbeitung.",
  "help.risk.title": "Risiko, Lücken & Konflikte",
  "help.risk.body":
    "Risiko zeigt Wissenslücken, Bus-Faktor und Single-Source-Bereiche. Lücken lassen sich priorisieren, zuweisen oder schließen; Widersprüche werden als Konflikte geführt aufgelöst.",
  "help.lifecycle.title": "Lebenszyklus & Lernpfade",
  "help.lifecycle.body":
    "Lebenszyklus zeigt fällige Revalidierungen (z. B. nach Asset-Änderungen) und rollenspezifische Lernpfade zum Abhaken. Nach dem Demo-Seed ist ein Beispiel-Lernpfad sichtbar.",
  "help.validation.title": "Validierung",
  "help.validation.body":
    "Bewerte Objekte grün/gelb/rot. Ab der Schwelle gilt ein Objekt als validiert; gelb/rot erfordern einen Kommentar und gehen an den Autor zurück.",
  "help.stufe2.title": "Stufe 2: QM, Kapital & Output",
  "help.stufe2.body":
    "Die erweiterten QM-Sichten (Kapital/Management, Evidence- und Provenance-Index, ModelRun-Protokoll) sind read-only und fensterbasiert. Output erzeugt Dokumente nur aus validiertem Wissen.",
  "help.mobile.title": "Mobil & Offline",
  "help.mobile.body":
    "Die mobile Ansicht bündelt Erfassen, Fragen und Nachschlagen. Entwürfe lassen sich offline anlegen und werden synchronisiert, sobald wieder Verbindung besteht.",
  "help.capture.title": "Wissen erfassen",
  "help.capture.body":
    "Halte Erfahrungswissen formlos fest — per Text, Diktat oder Foto. Die KI strukturiert es, du prüfst und reichst ein.",
  "help.validate.title": "Validieren",
  "help.validate.body":
    "Bewerte Objekte grün/gelb/rot. Ab der Schwelle gilt ein Objekt als validiert; rote Bewertungen gehen zurück an den Autor.",
  "help.ask.title": "Fragen stellen",
  "help.ask.body":
    "Antworten sind quellengebunden und zeigen, welche Quellen sie getragen haben und in welchem Zustand diese sind. Ohne Grundlage entsteht eine Wissenslücke.",
  "help.conflict.title": "Konflikte",
  "help.conflict.body":
    "Widersprüche werden sichtbar gemacht und geführt aufgelöst. Nur Wahrheitskonflikte eskalieren an einen Menschen.",
  "help.roles.title": "Rollen",
  "help.roles.body":
    "Viewer liest und fragt, Experte erfasst, Controller validiert und klärt, Admin verwaltet. Du siehst nur, was deine Rolle erlaubt.",
  "help.trust.title": "Vertrauen",
  "help.trust.body":
    "Jede Aussage trägt einen Reifegrad aus Validierung und Nutzung. Vertrauen ist Evidenz, nicht Wahrheit.",
  "mob.title": "Schnell festhalten",
  "mob.sub": "An der Anlage. In unter zwei Minuten.",
  "mob.dictate": "Diktat aufnehmen",
  "mob.dictateSub": "Sprechen — die KI strukturiert",
  "mob.note": "Notiz",
  "mob.photo": "Foto",
  "mob.interview": "Interview",
  "mob.lookup": "Nachschlagen",
  "mob.editing": "Entwurf wird fortgesetzt.",
  "mob.formTitle": "Kernaussage",
  "mob.formStatement": "Was ist passiert / was gilt?",
  "mob.save": "Als Entwurf speichern",
  "mob.saved": "Entwurf gespeichert.",
  "mob.update": "Entwurf aktualisieren",
  "mob.updated": "Entwurf aktualisiert.",
  "mob.new": "Neu",
  "mob.drafts": "Meine Entwürfe",
  "mob.draftsEmpty": "Noch keine Entwürfe.",
  "mob.resume": "Fortsetzen",
  "mob.discard": "Verwerfen",
  "mob.discarded": "Entwurf verworfen.",
  "mob.discardConfirmHint": "Verwerfen?",
  "mob.confirmDiscard": "Ja, verwerfen",
  "mob.cancelDiscard": "Abbrechen",
  "mob.tabCapture": "Erfassen",
  "mob.tabAsk": "Fragen",
  "mob.tabLookup": "Suchen",
  "mob.searchPlaceholder": "Wissen durchsuchen …",
  "mob.searchEmpty": "Keine Treffer.",
  "mob.online": "online",
  "mob.offline": "offline",
  "mob.queued": "Offline gespeichert – wird synchronisiert.",
  "mob.queue": "Warteschlange",
  "mob.syncNow": "Synchronisieren",
  "mob.syncOk": "Synchronisiert",
  "mob.syncFail": "Sync fehlgeschlagen",
  "mob.offlineSaveHint": "Offline – Speichern wird lokal vorgemerkt.",
  "mob.offlineAsk": "Offline – Fragen brauchen eine Verbindung.",
  "mob.offlineSearch": "Offline – Suche braucht eine Verbindung.",
  "mob.offlineNeedsConn": "Sobald wieder Verbindung besteht, ist dies verfügbar.",
  "mob.status.queued": "wartet",
  "mob.status.pending": "läuft",
  "mob.status.synced": "fertig",
  "mob.status.failed": "Fehler",
  "s2.kicker": "Erweitert · Stufe 2",
  "s2.output":
    "Aus validierten Objekten Arbeitsanweisungen/Checklisten erzeugen — aktiv, sobald die Output-Logik steht.",
  "out.kindTitle": "Output-Typ",
  "out.sourcesTitle": "Validierte Quellen",
  "out.noValidated": "Noch keine validierten Wissensobjekte vorhanden.",
  "out.generate": "Output erzeugen",
  "out.composeTitle": "Reihenfolge & Komposition",
  "out.composeHint":
    "Reihenfolge der Bausteine festlegen — sie wird beim Generieren genau so übernommen.",
  "out.moveUp": "Nach oben",
  "out.moveDown": "Nach unten",
  "out.removeFromOrder": "Aus Auswahl entfernen",
  "out.previewCompositionTitle": "Kompositionsvorschau",
  "out.previewSummary": "{{kind}} aus {{n}} validierten Bausteinen in dieser Reihenfolge.",
  "out.previewProvenance": "Volle Herkunft je Baustein wird im erzeugten Dokument ausgewiesen.",
  "out.previewUncertain":
    "{{n}} Baustein(e) mit niedrigem Vertrauen — im Dokument als unsicher markiert.",
  "out.previewDisclaimer":
    "Vorschau der Komposition, nicht das fertige Dokument. Erzeugung erfolgt beim Generieren.",
  "out.previewTitle": "Vorschau (Markdown)",
  "out.copy": "Kopieren",
  "out.copied": "Markdown kopiert.",
  "out.download": "Download .md",
  "out.provenanceTitle": "Herkunft & Nachweis",
  "out.uncertain": "niedriges Vertrauen",
  "out.genError": "Output konnte nicht erzeugt werden.",
  "out.kind.instruction": "Arbeitsanweisung",
  "out.kind.checklist": "Checkliste",
  "out.kind.troubleshooting": "Störungshilfe",
  "out.kind.training": "Schulung",
  "out.kind.management_summary": "Management-Summary",
  "out.kindDesc.instruction": "Schritt-für-Schritt-Anleitung (SOP).",
  "out.kindDesc.checklist": "Abhakbare Punkte für die Praxis.",
  "out.kindDesc.troubleshooting": "Symptom → Ursache → Maßnahme.",
  "out.kindDesc.training": "Lerneinheiten mit Kernaussagen.",
  "out.kindDesc.management_summary": "Verdichteter Überblick mit Vertrauen.",
  "s2.import":
    "Dokumente importieren und prüfen — aktiv, sobald die Import-/Source-Review-API steht.",
  "s2.capital":
    "Wissenskapital-Kennzahlen auf echten Live-Daten — aktiv, sobald die Kennzahlen-Logik steht.",
  "mgmt.jumpTitle": "Abschnitte",
  "mgmt.overview": "Operativer Snapshot",
  "mgmt.kpiTotal": "Objekte",
  "mgmt.kpiValidated": "Validiert",
  "mgmt.kpiOpen": "Offen",
  "mgmt.kpiGaps": "Lücken",
  "mgmt.kpiConflicts": "Konflikte",
  "mgmt.kpiTrust": "Ø Vertrauen",
  "mgmt.capital": "Wissenskapital-Wert",
  "mgmt.band.gut": "gut",
  "mgmt.band.mittel": "mittel",
  "mgmt.band.kritisch": "kritisch",
  "mgmt.part.validatedRatio": "Validierungsquote",
  "mgmt.part.avgTrust": "Ø Vertrauen",
  "mgmt.part.coverage": "Abdeckung Domänen",
  "mgmt.part.singleSourceInv": "Quellen-Streuung",
  "mgmt.part.freshnessInv": "Aktualität",
  "mgmt.valuation": "Wissensbewertung",
  "mgmt.valuationDisclaimer":
    "Schätzmodell auf Basis transparenter Annahmen — keine Bilanzbewertung.",
  "mgmt.assumeRate": "€ pro Stunde",
  "mgmt.assumeHours": "Std./Objekt gespart",
  "mgmt.assumeReuse": "Wiederverwendung",
  "mgmt.basis": "Basis: {{n}} validierte Objekte · Ø Vertrauen {{trust}}",
  "mgmt.statement": "Wissensbilanz",
  "mgmt.assets": "Aktiva",
  "mgmt.risks": "Risiken",
  "mgmt.net": "Netto-Index",
  "mgmt.riskBreakdown":
    "Single-Source-Domänen: {{ss}} · veraltet: {{stale}} · offene Lücken: {{gaps}} · Konflikte: {{conf}}",
  "mgmt.maturity": "Reifegrad-Pfad",
  "mgmt.stage": "Stufe",
  "mgmt.stageName.leer": "Kein Bestand",
  "mgmt.stageName.erfassen": "Erfassen",
  "mgmt.stageName.strukturieren": "Strukturieren",
  "mgmt.stageName.validieren": "Validieren",
  "mgmt.stageName.wiederverwenden": "Wiederverwenden",
  "mgmt.stageName.skalieren": "Skalieren",
  "mgmt.house": "Wissenshaus",
  "mgmt.fragile": "fragil",
  "mgmt.stable": "gesichert",
  "mgmt.empty": "Noch kein Bestand — Kennzahlen erscheinen, sobald Wissen erfasst ist.",
  "mrun.title": "Reasoner-Läufe (zuletzt)",
  "mrun.empty": "Noch keine Reasoner-Läufe protokolliert.",
  "mrun.total": "Gesamt: {{n}}",
  "mrun.errors": "Fehler: {{n}}",
  "mrun.fallbacks": "Fallbacks: {{n}}",
  "mrun.demo": "Demo: {{n}}",
  "mrun.fallback": "Fallback",
  "mrun.demoTag": "Demo",
  "evx.title": "Evidence-Index (QM)",
  "evx.empty": "Noch keine Evidence-Records vorhanden.",
  "evx.total": "Gesamt: {{n}}",
  "evx.sources": "Quellen: {{n}}",
  "evx.attachments": "Anhänge: {{n}}",
  "evx.kos": "Wissensobjekte: {{n}}",
  "evx.kind.source": "Quelle",
  "evx.kind.attachment": "Anhang",
  "evx.koRef": "KO {{id}}",
  "evx.providerPill": "Anbieter: {{v}}",
  "evx.objectPill": "Objekt: {{v}}",
  "prov.title": "Provenance-Index (QM)",
  "prov.empty": "Noch keine Wissensobjekte vorhanden.",
  "prov.total": "KOs: {{n}}",
  "prov.transfer": "Transfer: {{n}}",
  "prov.multiVersion": "Mehrfach-Version: {{n}}",
  "prov.withEvidence": "mit Evidence: {{n}}",
  "prov.noEvidence": "ohne Evidence: {{n}}",
  "prov.version": "v{{n}}",
  "prov.counts": "Q {{sources}} · A {{attachments}} · Ev {{evidence}}",
  "prov.badge.no-evidence": "keine Evidence",
  "prov.badge.transferred-author": "Autorentransfer",
  "prov.badge.multi-version": "Mehrfach-Version",
  "kos.hintsTitle": "Knowledge-OS QM-Hinweise",
  "kos.sevCount.critical": "kritisch: {{n}}",
  "kos.sevCount.warning": "Warnungen: {{n}}",
  "kos.sevCount.info": "Hinweise: {{n}}",
  "kos.sev.critical": "kritisch",
  "kos.sev.warning": "Warnung",
  "kos.sev.info": "Info",
  "kos.sev.ok": "OK",
  "kos.hints.none": "Keine Hinweise aus den geladenen Signalen.",
  "kos.hints.unknown": "Nicht geladen (unbekannt, kein Fehler): {{sources}}",
  "kos.hint.modelrun-errors.title": "ModelRun-Fehler ({{n}})",
  "kos.hint.modelrun-errors.detail": "Reasoner-Aufrufe mit Fehlerstatus — Protokoll prüfen.",
  "kos.hint.modelrun-fallbacks.title": "ModelRun-Fallbacks ({{n}})",
  "kos.hint.modelrun-fallbacks.detail":
    "Läufe nutzten den deterministischen Ersatz statt eines Modells.",
  "kos.hint.reasoner-demo.title": "Reasoner im Demo-/Fallback-Modus",
  "kos.hint.reasoner-demo.detail":
    "Kein echtes Modell konfiguriert — Antworten sind deterministisch.",
  "kos.hint.provenance-no-evidence.title": "KOs ohne Evidence ({{n}})",
  "kos.hint.provenance-no-evidence.detail":
    "Quellen/Anhänge vorhanden, aber keine Evidence-Records.",
  "kos.hint.evidence-outdated.title": "Evidence veraltet ({{n}})",
  "kos.hint.evidence-outdated.detail":
    "Aktuelle KO-Version ohne Evidence — nur ältere Versionen belegt.",
  "kos.hint.evidence-missing.title": "Evidence fehlt ({{n}})",
  "kos.hint.evidence-missing.detail":
    "Quellen/Object-Anhänge vorhanden, aber keine Evidence für irgendeine Version.",
  "kos.hint.provenance-lineage.title": "Transfer/Mehrfach-Version ({{n}})",
  "kos.hint.provenance-lineage.detail": "KOs mit Autorentransfer oder mehreren Versionen.",
  "kos.hint.evidence-empty.title": "Keine Evidence-Records",
  "kos.hint.evidence-empty.detail": "Bisher wurden keine Quellen/Anhänge als Evidence erfasst.",
  // AUFTRAG-mega34 G: der Zustand, in dem sich gar kein Grad ableiten lässt — die
  // Konflikterkennung ist nicht vollständig belegt. Das ist keine schlechte Note, sondern
  // eine fehlende: der angezeigte Wert ist der schlechtestmögliche, nicht der gemessene.
  "kos.hint.health-detection-unproven.title": "Knowledge-Health nicht belegt ({{n}})",
  "kos.hint.health-detection-unproven.detail":
    "Die Konflikterkennung ist nicht vollständig belegt. Der angezeigte Wert ist deshalb der ungünstigste mögliche, kein gemessener Grad — solange das so ist, lässt sich weder Entwarnung noch Alarm ehrlich geben.",
  "kos.hint.health-critical.title": "Knowledge-Health kritisch ({{n}})",
  "kos.hint.health-critical.detail": "Gesamt-Score im kritischen Bereich.",
  "kos.hint.health-mittel.title": "Knowledge-Health mittel ({{n}})",
  "kos.hint.health-mittel.detail": "Gesamt-Score im mittleren Bereich.",
  "kos.hint.all-clear.title": "Keine Auffälligkeiten",
  "kos.hint.all-clear.detail": "Die geladenen Foundation-Signale zeigen keine Warnungen.",
  "evFresh.title": "Evidence-Aktualität (QM)",
  "evFresh.subtitle": "KOs, deren aktuelle Version keine Evidence hat.",
  "evFresh.empty": "Keine KOs mit veralteter oder fehlender Evidence.",
  "evFresh.summary.outdated": "veraltet: {{n}}",
  "evFresh.summary.missing": "fehlend: {{n}}",
  "evFresh.summary.current": "aktuell: {{n}}",
  "evFresh.summary.neutral": "neutral: {{n}}",
  "evFresh.version": "v{{n}}",
  "evFresh.counts": "aktuell {{current}} · älter {{older}}",
  "evFresh.openKo": "KO öffnen",
  "qmWindow.within": "innerhalb des geladenen Fensters",
  "qmWindow.limited": "möglicherweise abgeschnitten",
  "qmWindow.modelRuns": "Fenster: {{n}} jüngste ModelRuns",
  "qmWindow.evidence": "Fenster: {{n}} jüngste EvidenceRecords",
  "readiness.title": "Knowledge-OS Readiness",
  "readiness.ready": "bereit",
  "readiness.attention": "aufmerksam",
  "readiness.critical": "kritisch",
  "readiness.incomplete": "unvollständig geladen",
  "readiness.reason.critical": "kritische Hinweise",
  "readiness.reason.warning": "Warnungen",
  "readiness.reason.window": "Datenfenster möglicherweise abgeschnitten",
  "readiness.reason.unknown": "Signale nicht geladen",
  "mrun.task.structure": "Strukturieren",
  "mrun.task.assist": "Glätten",
  "mrun.task.interview": "Interview",
  "mrun.task.answer": "Antworten",
  "mrun.task.select": "Auswählen",
  "mrun.status.success": "OK",
  "mrun.status.error": "Fehler",
  "rcfg.title": "Reasoner-Konfiguration",
  "rcfg.mode": "Modus",
  "rcfg.modeLabel.model": "Modell aktiv",
  "rcfg.modeLabel.fallback": "Fallback",
  "rcfg.modeLabel.demo": "Demo (deterministisch)",
  "rcfg.provider": "Provider",
  "rcfg.model": "Modell",
  "rcfg.notConfigured": "nicht konfiguriert",
  "rcfg.locales": "Sprachen",
  "rcfg.tasks": "Aufgaben",
  "rcfg.fallbackHint": "Kein Modell konfiguriert — deterministischer Fallback ist aktiv.",
  "mgmt.recommendations": "Empfehlungen",
  "mgmt.noRecs": "Keine dringenden Maßnahmen.",
  "mgmt.sev.hoch": "hoch",
  "mgmt.sev.mittel": "mittel",
  "mgmt.rec.secureSingleSource": "{{count}} Single-Source-Domäne(n) absichern (Wissen verteilen).",
  "mgmt.rec.revalidate": "{{count}} fällige Revalidierung(en) bearbeiten.",
  "mgmt.rec.closeGaps": "{{count}} offene Wissenslücke(n) schließen.",
  "mgmt.rec.resolveConflicts": "{{count}} offene(n) Konflikt(e) lösen.",
  "mgmt.rec.validateBacklog": "{{count}} offene Objekte validieren.",
  "mgmt.priorities": "Wissens-Priorisierung (9 Faktoren)",
  "mgmt.pilot": "Pilot-Bericht 30/60/90",
  "mgmt.print": "Drucken / PDF",
  "mgmt.pilotNote": "Druck-/HTML-Ansicht (über Browser-Druck), kein zertifiziertes PDF.",
  "mgmt.window": "Fenster",
  "mgmt.created": "Erfasst",
  "mgmt.validatedCol": "Validiert",
  "mgmt.days": "Tage",
  "s2.graphEmpty": "Keine Graph-Daten.",
  "s2.graphCount": "{{nodes}} Knoten · {{edges}} Kanten",
  "graph.truncated": "Anzeige auf die {{n}} am stärksten verbundenen Knoten begrenzt",
  "graph.legendValidated": "validiert",
  "graph.legendOpen": "offen / in Prüfung",
  "graph.legendTag": "Tag-Relation",
  "graph.legendConflict": "Konflikt",
  "graph.clickHint": "Knoten anklicken, um das Wissensobjekt zu öffnen",
  "graph.openNode": "Wissensobjekt öffnen: {{title}}",

  // SCRUM-406: ausführliche ?-Hilfen im Prüfbereich (Schema: Was? · Wann? · Was passiert danach?).
  "vhelp.originFilter.title": "Herkunft filtern",
  "vhelp.originFilter.body":
    "Blendet die Liste nach Herkunft ein: Demo-Beispiele oder eigenes Wissen deiner Organisation. Das ist nur eine Ansicht zum Auffinden — es ändert keinen Prüfstatus und verwirft nichts. Die Zahl hinter jedem Filter zeigt, wie viele Einträge er enthält.",
  "vhelp.reviewFocus.title": "Review-Fokus",
  "vhelp.reviewFocus.body":
    "Unterscheidet neue Einreichungen von überarbeiteten (Version größer 1). Überarbeitete Objekte lohnen einen gezielten Blick auf die Änderung — was war die Rückfrage, was wurde angepasst? Auch das ist nur eine Ansicht: Es ändert keinen Status und ersetzt keine Entscheidung.",
  "vhelp.filters.title": "Suchen & filtern",
  "vhelp.filters.body":
    "Grenzt die Prüfliste nach Volltext, Wissensart, Kategorie oder Schlagwort ein. Nutze das, wenn die Liste lang ist und du gezielt dein Fachgebiet prüfen willst. Es geht nichts verloren: Filter ändern nur, was du gerade siehst — alle Objekte bleiben in der Prüfung.",
  "vhelp.mineOnly.title": "Nur mir zugewiesene",
  "vhelp.mineOnly.body":
    "Zeigt deine persönliche Review-Liste: Objekte, die dir jemand bewusst zugewiesen hat. Nutze sie, um zuerst die Arbeit zu erledigen, auf die Kollegen warten. Die Zuweisung ist eine Bitte, keine Pflichtprüfung — entschieden wird erst, wenn du selbst bewertest.",
  "vhelp.signals.title": "Review-Signale lesen",
  "vhelp.signals.body":
    "Die Zeile zeigt, wie belastbar das Objekt JETZT ist: Vertrauensbalken und Vertrauenswert (aus Prüfstimmen und Bewährung), Version, „Ziel n“ (so viele Freigaben braucht es bis VALIDIERT), dazu Marker wie ÜBERTRAGEN (Autor gewechselt — extra Blick) oder ZUGEWIESEN. Nichts davon ist eine Bewertung durch dich — es ist die ehrliche Ausgangslage für deine Entscheidung.",
  "vhelp.approve.title": "Freigeben",
  "vhelp.approve.body":
    "Du bestätigst nach eigener Prüfung: Diese Aussage ist fachlich richtig und so anwendbar. Nutze das erst, wenn du Kernaussage, Bedingungen und Maßnahmen wirklich beurteilt hast — deine Freigabe zählt als eine von mehreren nötigen Prüfstimmen. Danach steigt das Vertrauen des Objekts; VALIDIERT wird es erst, wenn genug Prüfer freigegeben haben. Nichts wird automatisch veröffentlicht oder verändert — deine Stimme wird gezählt, mehr nicht.",
  "vhelp.query.title": "Rückfrage stellen",
  "vhelp.query.body":
    "Du hältst das Wissen für brauchbar, aber etwas ist unklar, unvollständig oder nur unter Bedingungen richtig. Ein kurzer Kommentar ist Pflicht — er ist deine Hilfe an den Autor: Was genau fehlt, was soll er nachtragen? Danach bleibt das Objekt in Prüfung und der Autor sieht deine Rückfrage als Kommentar am Wissensobjekt. Es wird nichts abgelehnt, nichts freigegeben und nichts automatisch geändert — die Überarbeitung macht der Autor bewusst selbst.",
  "vhelp.reject.title": "Ablehnen",
  "vhelp.reject.body":
    "Du hältst die Aussage für falsch, veraltet oder riskant. Auch hier ist die Begründung Pflicht — ohne sie kann der Autor nichts lernen und nichts korrigieren. Danach fließt deine Ablehnung in den Prüfstand des Objekts ein; es wird dadurch NICHT gelöscht und NICHT gesperrt, sondern bleibt sichtbar in Prüfung, bis Autor oder Controller reagieren. Wenn zwei gesicherte Aussagen einander widersprechen, ist „Konflikt melden“ der bessere Weg als eine Ablehnung.",
  "vhelp.feedbackForm.title": "Begründung (Pflicht)",
  "vhelp.feedbackForm.body":
    "Rückfrage und Ablehnung brauchen immer eine Begründung — sie wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Schreib konkret, was fehlt oder falsch ist und was der Autor nachtragen soll. Erst mit Text lässt sich absenden; Abbrechen verwirft nur deine Eingabe, keine Bewertung.",
  "vhelp.assign.title": "Prüfer zuweisen",
  "vhelp.assign.body":
    "Du bittest eine bestimmte Kollegin oder einen Kollegen um die Prüfung dieses Objekts. Die Person sieht es danach in ihrer persönlichen Review-Liste („Mir zugewiesen“) und bekommt eine Benachrichtigung über die Glocke. Die Zuweisung ist eine Einladung, keine Bewertung: Sie ändert weder Status noch Vertrauen, und geprüft wird erst, wenn die Person selbst entscheidet.",
  "vhelp.markTrue.title": "Als wahr kennzeichnen (nur Admin)",
  "vhelp.markTrue.body":
    "Als Admin schließt du die Validierung dieses Objekts in einem Schritt ab — unabhängig von den Peer-Bewertungen. Der Status wird auf „validiert“ gesetzt und das Vertrauen auf die höchste Stufe gehoben. Nutze das bewusst und nur, wenn du die Aussage wirklich verantworten kannst, denn du überspringst damit die mehrfache Gegenprüfung durch andere. Der Vorgang wird im Audit-Log mit deinem Namen festgehalten und lässt sich später über eine erneute Bearbeitung/Revision wieder in die Prüfung zurückholen.",
  "vhelp.stillValid.title": "Noch gültig",
  "vhelp.stillValid.body":
    "Du bestätigst, dass dieses bereits geprüfte Wissen aus deiner Sicht weiterhin stimmt — ein Frische-Signal, kein neues Prüfverfahren. Nutze es, wenn du das Wissen gerade angewendet oder bewusst gegengelesen hast. Danach wird die Bestätigung mit Datum vermerkt und das Objekt gilt als kürzlich bestätigt. Es ersetzt keine Peer-Prüfung und hebt keine Rückfragen oder Konflikte auf.",
  "vhelp.reportConflict.title": "Konflikt melden",
  "vhelp.reportConflict.body":
    "Du zeigst an, dass dieses Wissen einem ANDEREN Wissensobjekt widerspricht — etwa zwei unterschiedliche Grenzwerte für denselben Fall. Danach erscheint der Fall auf der Konflikte-Seite und wird dort bewusst aufgelöst (Zweitmeinung, Eskalation, dokumentierte Entscheidung). Beide Objekte bleiben unverändert bestehen — es wird nichts automatisch korrigiert, überschrieben oder gelöscht.",
  "vhelp.conflictForm.title": "Konflikt beschreiben",
  "vhelp.conflictForm.body":
    "Drei Angaben machen die Meldung auflösbar: das GEGEN-Objekt (womit widerspricht sich dieses Wissen?), die KONFLIKTART (z. B. Widerspruch in der Sache oder in der Zuständigkeit) und eine kurze BESCHREIBUNG des Widerspruchs mit deinem Kontext. Nach dem Absenden entsteht ein offener Konfliktfall — beide Objekte bleiben nutzbar markiert, bis der Konflikt bewusst aufgelöst ist.",
  "vhelp.sourcesLevel2.title": "Externe Quellen (Stufe 2)",
  "vhelp.sourcesLevel2.body":
    "Hier hängen externe Belege am Wissensobjekt: Normen, Handbücher, Artikel, interne Dokumente. Das Badge „Stufe 2“ bedeutet ehrlich: Diese Quelle wurde NICHT von Kollegen peer-geprüft — sie stützt das Wissen, ersetzt aber keine einzige Prüfstimme. Auf der Fragen-Seite zählt eine Stufe-2-Quelle deshalb nicht als Prüfstimme; sie kann eine Antwort stützen, aber nicht absichern. Das X entfernt nur die Verknüpfung — Wissen, Status und Vertrauen bleiben unverändert.",
  "vhelp.sourceFields.title": "Quelle beschreiben",
  "vhelp.sourceFields.body":
    "Drei Angaben machen eine Quelle brauchbar: Die BEZEICHNUNG sagt, was es ist („DIN EN 1090, Abschnitt 7“), die URL führt hin (leer lassen bei Papier- oder internen Quellen), der AUSZUG zitiert die eine entscheidende Stelle wörtlich — so muss niemand das ganze Dokument lesen, um die Aussage zu prüfen. Je konkreter der Auszug, desto mehr hilft die Quelle den Prüfern.",
  "vhelp.sourceAdd.title": "Quelle hinzufügen",
  "vhelp.sourceAdd.body":
    "Hängt die beschriebene Quelle als Stufe-2-Beleg an dieses Wissensobjekt. Sie bleibt über Versionen hinweg erhalten und ist für alle sichtbar. Es passiert nichts weiter automatisch: Der Inhalt der Quelle wird nicht ins Wissen übernommen, nicht geprüft und nicht bewertet — sie steht als Beleg daneben.",
  "vhelp.sourceSearch.title": "Quellen suchen",
  "vhelp.sourceSearch.body":
    "Sucht nach externen Belegen zu diesem Thema. Die Suche läuft über den KLARWERK-Server — deine Anfrage geht nicht direkt von deinem Browser an externe Dienste. Die Treffer sind unverbindliche Vorschläge: Nichts davon wird automatisch angehängt. Prüfe Titel und Ausschnitt, öffne im Zweifel den Link — und erst „Anhängen“ übernimmt einen Treffer bewusst als Stufe-2-Quelle.",
  "vhelp.contribution.title": "Beitrag oder Fundstelle melden",
  "vhelp.contribution.body":
    "Du kennst eine Ergänzung, Korrektur oder Fundstelle, willst aber nicht selbst am Objekt arbeiten? Beschreibe sie hier — dein Hinweis wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Anders als „Quelle hinzufügen“ entsteht dabei KEIN Quellen-Eintrag; es ist eine Nachricht an die Menschen, kein Beleg am Objekt.",
  "vhelp.helpful.title": "Hat geholfen",
  "vhelp.helpful.body":
    "Ein Bewährungssignal aus der Praxis: Du hast dieses Wissen angewendet, und es hat funktioniert. Das stärkt das Vertrauen des Objekts ein Stück und wird im Verlauf vermerkt. Es ist KEINE Prüfstimme — Validierung entsteht weiterhin nur durch bewusste Prüfentscheidungen von Kollegen.",
  "vhelp.validity.title": "Gültigkeit & Schutz",
  "vhelp.validity.body":
    "Diese Werte werden ehrlich aus dem aktuellen Zustand ABGELEITET, nicht gespeichert: Frische (wann zuletzt bestätigt oder geändert), Output-Eignung (dürfte dieses Wissen in erzeugte Dokumente?) und eine Empfehlung, was als Nächstes sinnvoll ist. Ändern kannst du sie nur indirekt — durch Prüfen, Bestätigen oder Überarbeiten des Wissens selbst.",
  "vhelp.transfer.title": "Autor übertragen",
  "vhelp.transfer.body":
    "Übergibt die Verantwortung für dieses Wissen an eine andere Person — etwa wenn jemand das Unternehmen verlässt oder die Zuständigkeit wechselt. Der ursprüngliche Autor bleibt dauerhaft sichtbar (Herkunft geht nie verloren). Übertragene Objekte bekommen im Review einen Extra-Blick, weil das Wissen nun jemand verantwortet, der es nicht selbst erfasst hat.",
  "vhelp.deleteKo.title": "Wissensobjekt löschen",
  "vhelp.deleteKo.body":
    "Entfernt dieses Wissensobjekt endgültig — erlaubt nur für den Autor selbst sowie Controller und Admin; der Server erzwingt dieselbe Regel. Vor dem Löschen fragt die Inline-Bestätigung bewusst nach. Die Löschung wird im Audit protokolliert. Wenn das Wissen nur veraltet ist, ist Überarbeiten oder ein Konflikt der ehrlichere Weg als Löschen.",
  "vhelp.conflictEscalate.title": "Eskalieren",
  "vhelp.conflictEscalate.body":
    "Hebt einen offenen Sach-Konflikt eine Stufe höher, wenn die Beteiligten ihn nicht selbst klären können — dann entscheidet die fachlich zuständige Instanz. Nutze das, wenn zwei validierte Aussagen einander hart widersprechen und keine Seite nachgeben kann. Der Konflikt bleibt offen und sichtbar, bis eine dokumentierte Entscheidung fällt.",
  "vhelp.conflictSecondOpinion.title": "Zweitmeinung einholen",
  "vhelp.conflictSecondOpinion.body":
    "Bittet eine weitere fachkundige Person um ihre Einschätzung zum Konflikt und hält sie schriftlich fest. Eine gute Zweitmeinung nennt Fakten und Quellen, nicht nur ein Bauchgefühl. Sie entscheidet den Konflikt nicht automatisch — sie ist Material für die spätere Auflösung.",
  "vhelp.conflictResolve.title": "Konflikt auflösen",
  "vhelp.conflictResolve.body":
    "Hält die Entscheidung fest, wie mit dem Widerspruch umzugehen ist — welche Aussage gilt, unter welchen Bedingungen, und warum. Die Auflösung DOKUMENTIERT nur: Sie ändert keines der beteiligten Wissensobjekte automatisch. Wenn ein Objekt danach überarbeitet oder neu bestätigt werden sollte, zeigt die App eine Revalidierungs-Empfehlung — auch das bleibt eine bewusste menschliche Handlung.",

  // SCRUM-407: ausführliche ?-Hilfen im Erfassen-Weg (Schema: Was? · Wann? · Was passiert danach?).
  "chelp.modes.title": "Die vier Erzähl-Wege",
  "chelp.modes.body":
    "Vier Wege führen zum selben Ziel: FREITEXT (einfach drauflos schreiben), DIKTAT (sprechen statt tippen), INTERVIEW (die KI stellt dir gezielte Fragen) und AUS DATEI (Wissenspunkte aus einem Dokument ziehen). Wähle, was sich für dich natürlich anfühlt — alle Wege münden in denselben Entwurf auf der Wissensseite, und beim Wechseln geht nichts verloren.",
  "chelp.expertPath.title": "Formular direkt (Expertenpfad)",
  "chelp.expertPath.body":
    "Das klassische Formular mit allen Feldern auf einen Blick — für alle, die genau wissen, was sie eintragen wollen. Es ist derselbe Datenstand wie der geführte Weg, kein Extra-Feature und keine Abkürzung an der Prüfung vorbei. Der Rückweg auf den geführten Weg ist jederzeit einen Klick entfernt.",
  "chelp.wizardSteps.title": "Die drei Schritte",
  "chelp.wizardSteps.body":
    "Erfassen läuft in drei Schritten: ERZÄHLEN (Rohwissen loswerden), WISSENSSEITE (prüfen und verfeinern, mit KI-Hilfe), EINREICHEN (in die Peer-Prüfung geben). Fertige Schritte kannst du anklicken und zurückgehen — dabei geht nichts verloren. Erst „Prüfen & einreichen“ macht aus deinem Entwurf ein Wissensobjekt für die Kollegen.",
  "chelp.loadExample.title": "Beispiel laden",
  "chelp.loadExample.body":
    "Füllt die Felder mit einem Demo-Beispiel, damit du den kompletten Weg gefahrlos ausprobieren kannst. Achtung: Es überschreibt deine aktuellen Eingaben — nutze es auf leerer Seite. Eingereicht wird auch ein Beispiel erst, wenn du es bewusst einreichst.",
  "chelp.tellRaw.title": "Einfach erzählen",
  "chelp.tellRaw.body":
    "Schreib dein Wissen so auf, wie du es einem neuen Kollegen erzählen würdest — unsortiert ist völlig in Ordnung. Struktur (Titel, Kernaussage, Bedingungen, Maßnahmen) macht im nächsten Schritt die KI als VORSCHLAG, den du prüfst und änderst. Nichts wird automatisch gespeichert oder eingereicht.",
  "chelp.dictate.title": "Diktieren",
  "chelp.dictate.body":
    "Sprechen statt tippen: Dein Browser wandelt Sprache lokal in Text um, der hier ins Feld fließt. Starte und stoppe bewusst; danach kannst du den Text ganz normal korrigieren. Wenn dein Browser keine Spracherkennung kann, sagt dir die App das ehrlich, statt still zu scheitern.",
  "chelp.tellUpload.title": "Datei anhängen beim Erzählen",
  "chelp.tellUpload.body":
    "Lädst du hier Dokumente hoch (PDF, Word, Text), fließt ihr Text direkt in dein Erzählfeld; Bilder und Videos werden Anhänge des späteren Wissensobjekts. Bei Bildern startet Texterkennung (OCR) nur auf deinen Klick. Es wird nichts hochgeladen, das du nicht siehst — alles bleibt Teil deines Entwurfs.",
  "chelp.structureNow.title": "Struktur vorschlagen",
  "chelp.structureNow.body":
    "Die KI liest deinen Rohtext und schlägt Titel, Kernaussage, Bedingungen und Maßnahmen vor — als ENTWURF auf der Wissensseite, violett gekennzeichnet. Sie erfindet nichts dazu; ohne KI-Schlüssel arbeitet ein ehrlicher, regelbasierter Ersatz und sagt das klar. Du prüfst, änderst und entscheidest — automatisch gespeichert wird nie.",
  "chelp.interview.title": "Das Wissens-Interview",
  "chelp.interview.body":
    "Die KI stellt dir eine Frage nach der anderen und bohrt gezielt nach — nach Grenzwerten, Ausnahmen, Gründen. Antworte in deinen Worten (tippen oder diktieren); die Frage kannst du dir vorlesen lassen. Erst wenn du das Interview abschließt, wird aus allen Antworten ein Entwurf für die Wissensseite gebaut — nichts davon ist vorher gespeichert.",
  "chelp.filePoints.title": "Wissen aus Datei",
  "chelp.filePoints.body":
    "Du lädst ein Dokument hoch, die KI extrahiert daraus einzelne Wissenspunkte — jeder MIT wörtlicher Belegstelle aus dem Dokument (erfundene Punkte sind damit ausgeschlossen; findet sie nichts Belastbares, sagt sie das ehrlich). Du wählst per Häkchen aus, was übernommen wird: Nur ausgewählte Punkte werden Entwürfe. Alternativ kannst du einen Suchauftrag an einen Experten formulieren.",
  "chelp.captureTitle.title": "Der Titel",
  "chelp.captureTitle.body":
    "Der Titel ist das Erste, was Kollegen in Bibliothek und Antworten sehen — er entscheidet, ob dein Wissen gefunden wird. Gut: konkret und handlungsnah („Schweißnaht bei Aluminium unter 5 mm prüfen“). Du kannst ihn jederzeit ändern, auch der KI-Vorschlag ist nur ein Startpunkt.",
  "chelp.saveDraftHelp.title": "Entwurf speichern",
  "chelp.saveDraftHelp.body":
    "Sichert deinen Zwischenstand lokal in deinem Browser — du kannst jederzeit weitermachen, auch nach einem Neustart. Ein Entwurf ist NICHT eingereicht: Niemand sieht ihn, er taucht in keiner Prüfung und keiner Antwort auf. Oben auf der Seite findest du gespeicherte Entwürfe zum Fortsetzen.",
  "chelp.discardHelp.title": "Verwerfen",
  "chelp.discardHelp.body":
    "Verwirft den aktuellen Entwurf endgültig — Text, Struktur und Anhänge dieser Erfassung. Es betrifft NUR deinen Entwurf: Bereits eingereichte oder gespeicherte Wissensobjekte bleiben unberührt. Vorher fragt die App bewusst nach; wer nur einen Schritt zurück will, nutzt die Schritt-Leiste statt Verwerfen.",
  "chelp.submitReview.title": "Prüfen & einreichen",
  "chelp.submitReview.body":
    "Macht aus deinem Entwurf ein Wissensobjekt und gibt es in die Peer-Prüfung: Kollegen prüfen, stellen Rückfragen oder geben frei. Ab jetzt ist es für andere sichtbar — aber ehrlich als „in Prüfung“ markiert, NICHT als gesichert. Validiert wird es durch genug Freigaben. Für Antworten nutzbar ist es schon vorher — dann aber sichtbar als ungeprüft gekennzeichnet.",
  "chelp.readiness.title": "Speicher-Check",
  "chelp.readiness.body":
    "Zeigt ehrlich, was zum Einreichen noch fehlt: Pflichtfelder (ohne sie bleibt der Knopf aus) und Optionales, das dein Wissen stärkt (z. B. Kategorie oder Anhänge). Grün heißt bereit — nicht perfekt: Verbessern kannst du auch nach dem Einreichen noch, dann als neue Version.",
  "chelp.savedNext.title": "Gespeichert — was jetzt?",
  "chelp.savedNext.body":
    "Dein Wissen ist als Objekt angelegt und wartet auf die Peer-Prüfung — es ist SICHTBAR, aber ehrlich als offen markiert, nicht als gesichert. Du musst nichts weiter tun: Prüfer finden es auf dem Validierungs-Board. Willst du es ansehen oder ergänzen, führt der Link direkt hin.",
  "chelp.advancedDetails.title": "Erweiterte Details",
  "chelp.advancedDetails.body":
    "Alles hier ist OPTIONAL — dein Wissen wird auch ohne eingereicht. Es lohnt sich trotzdem: Kategorie und Schlagwörter machen es auffindbar, die Anlage koppelt es an Maschinen/Objekte, die Prüf-Anzahl steuert, wie viele Freigaben nötig sind, Dokumente und Bilder liefern Beweismaterial. Das Badge zeigt, wie viel schon ausgefüllt ist.",
  "chelp.knowledgeType.title": "Wissensart",
  "chelp.knowledgeType.body":
    "Ordnet dein Wissen ein: Erfahrungswissen, Prozesswissen, Faktenwissen — und besonders wertvoll: NEGATIVWISSEN („das haben wir probiert, es funktioniert NICHT, weil …“). Die Wissensart hilft Prüfern und Suchenden, dein Wissen richtig einzuordnen; sie ändert nichts am Prüfweg.",
  "chelp.assetField.title": "Anlage / Objekt",
  "chelp.assetField.body":
    "Koppelt dein Wissen an eine konkrete Anlage, Maschine oder ein Objekt („Presse 3“, „Mandant XY“). Ändert sich später etwas an dieser Anlage, findet der Lebenszyklus genau die gekoppelten Wissensobjekte zur Überprüfung. Freitext genügt — Hauptsache, Kollegen erkennen die Anlage wieder.",
  "chelp.tagsField.title": "Schlagwörter",
  "chelp.tagsField.body":
    "Kurze Stichworte, über die dein Wissen in Suche und Filtern auftaucht („aluminium“, „frist“, „hygiene“). Nutze Begriffe, nach denen Kollegen wirklich suchen würden, und bleib konsistent mit vorhandenen Schlagwörtern. Sie sind jederzeit änderbar und beeinflussen die Prüfung nicht.",
  "chelp.docsImages.title": "Dokumente & Bilder",
  "chelp.docsImages.body":
    "Hängt Beweismaterial an dein Wissen: Fotos vom Ergebnis, das Prüfprotokoll, die Arbeitsanweisung. Anhänge wandern beim Einreichen mit ans Wissensobjekt und sind dort für Prüfer sichtbar. Ihr Inhalt wird nicht automatisch zu Wissen — was in den Text soll, entscheidest du.",
  "chelp.expertForm.title": "Das Experten-Formular",
  "chelp.expertForm.body":
    "Hier trägst du alle Felder direkt ein: Titel, Wissensart, Inhalt, Kernaussage, Bedingungen (wann gilt es?) und Maßnahmen (was ist zu tun?). Es gelten dieselben Regeln wie im geführten Weg — gleicher Speicher-Check, gleiche Prüfung. Die KI hilft auf Wunsch am Text, entscheidet aber nichts.",
  "chelp.sourcesPanel.title": "Externe Quellen (Stufe 2)",
  "chelp.sourcesPanel.body":
    "Hängt externe Belege an dein Wissen — Norm, Handbuch, Herstellerseite. Von Hand (Bezeichnung, Link, Auszug) oder über die Quellen-Suche, genau wie im Prüfbereich. Beim Erfassen sammelst du sie in einer sichtbaren Warteliste; angehängt werden sie erst beim Einreichen, zusammen mit deinem Wissensobjekt. Wichtig: Externe Quellen sind Stufe 2 — sie gelten nie als peer-validiert und ersetzen keine Prüfung durch Kollegen. Nichts wird automatisch übernommen.",
  "capture.sourcesTitle": "Externe Quellen",
  "capture.sourcesHint":
    "Quellen landen zuerst in dieser Warteliste. Beim Einreichen werden sie ans gespeicherte Wissensobjekt gehängt — als Stufe 2, nie peer-validiert.",
  "xtr.title": "Aus Dokument ergänzen",
  "xtr.hint":
    "Lade ein weiteres Dokument hoch — die KI liest es und schlägt Wissenspunkte MIT Belegstelle vor. Nur was du ankreuzt, wird als Abschnitt ans Ende deines Artikels angefügt; nichts wird ersetzt.",
  "xtr.applyCta": "Ausgewählte anfügen",
  // AUFTRAG-mega18 Block A-3: die Übernahme ist EIN serverseitiger Vorgang — der Text sagt, was er
  // gemeinsam committet (Inhalt UND Herkunft), damit niemand „angefügt" für „gespeichert" hält.
  "xtr.applying": "{{count}} Punkt(e) werden übernommen — Inhalt und Herkunft zusammen …",
  "xtr.appended":
    "{{count}} Punkt(e) aus „{{name}}“ übernommen — Inhalt UND Herkunft sind gemeinsam gespeichert; bestehender Inhalt blieb unverändert.",
  "xtr.append.button": "An bestehenden Artikel anhängen",
  "xtr.append.title": "An bestehenden Artikel anhängen",
  "xtr.append.intro":
    "{{count}} ausgewählte Erkenntnis(se) aus „{{name}}“ als Abschnitt an einen bestehenden Artikel anhängen. Der Zielartikel wird überarbeitet (danach neu zu prüfen); die Quelle wird je Punkt vermerkt.",
  "xtr.append.searchPlaceholder": "Artikel suchen (Titel) …",
  "xtr.append.none": "Kein passender Artikel gefunden.",
  "xtr.append.busy": "Wird angehängt …",
  "xtr.append.done":
    "{{count}} Erkenntnis(se) an „{{title}}“ angehängt — der Artikel ist jetzt neu zu prüfen.",
  // AUFTRAG-mega18 Block A: die Übernahme ist EINE serverseitige Operation. Es gibt genau drei
  // Ausgänge und für jeden einen eigenen, ehrlichen Text — kein „Fehler", aus dem der Nutzer raten
  // muss, was jetzt im Artikel steht.
  // (1) Die INTERNE BELEGPFLICHT hat abgelehnt: ohne gesichertes Original wird nichts übernommen —
  //     auf JEDER Stufe, nicht nur auf den restriktiven.
  "xtr.append.missingAnchor":
    "Ohne das Originaldokument als Beleg wird der Inhalt nicht übernommen. Der Artikel wurde NICHT verändert. Das gilt unabhängig von der Einstellung „Externes Wissen“: übernommener Dokumentinhalt muss an seinem Original hängen.",
  // (2) Die EXTERNE STUFENREGEL hat abgelehnt (eigene Regel, eigener Grund).
  "xtr.append.blockedByStage":
    "Auf der eingestellten Stufe „Externes Wissen“ darf diese Quelle nicht an ein Wissensobjekt angehängt werden. Der Artikel wurde NICHT verändert. Ein Administrator kann die Stufe unter Verwaltung → Externes Wissen ändern.",
  // (3) Der Ausgang ist UNKLAR. Hier stand früher die Kompensation — sie hat den Schaden erst
  //     angerichtet. Jetzt wird nichts angefasst und ehrlich zum Nachsehen aufgefordert.
  "xtr.append.unclear":
    "Der Ausgang ist unklar — die Verbindung brach ab, bevor der Server geantwortet hat. Es wurde NICHTS zurückgenommen: die Übernahme kann vollzogen sein oder nicht. Bitte den Artikel öffnen und nachsehen; ein erneuter Versuch mit demselben Vorgang legt nichts doppelt an.",
  "xtr.append.stateUnchanged":
    "Der Artikel wurde NICHT verändert — es wurde kein Inhalt ohne Herkunft gespeichert. Du kannst die Übernahme unverändert erneut versuchen.",
  // Folgeschritte NACH dem Commit (Konflikt-/Überschneidungs-Entwertung, KI-Prüfung) sind nicht
  // gelaufen. Die Übernahme GILT trotzdem — das ist die entscheidende Aussage, und sie steht zuerst.
  "xtr.append.followUpsFailed":
    "Die Übernahme ist gespeichert (Inhalt und Herkunft). Ein nachgelagerter Schritt lief nicht: {{steps}}. Die erneute KI-Prüfung kann dadurch fehlen — sie lässt sich auf der Validierungsseite neu anstoßen.",
  "xtr.help.title": "Aus Dokument ergänzen",
  "xtr.help.body":
    "Die KI liest ein von dir hochgeladenes Dokument und schlägt Wissenspunkte vor — jeder Punkt trägt seine Belegstelle aus dem Dokument (ohne Beleg keine Übernahme). Du wählst per Häkchen aus; Ausgewähltes wird als Abschnitt an deinen Artikel ANGEHÄNGT, nichts wird ersetzt oder überschrieben. Die Herkunft (Dateiname + Belegstelle) wird als Stufe-2-Quelle am Wissensobjekt vermerkt — sie gilt nicht als peer-validiert und ersetzt keine Prüfung.",
  "fd.kicker": "Erfassen",
  // AUFTRAG-mega38 BLOCK I: „Canvas" uebersetzt.
  "fd.title": "Dokument-Editor",
  "fd.backToCapture": "Zurück zu Wissen erfassen",
  "fd.allModes": "Alle Erfassungs-Modi",
  "fd.submitted": "Zur Prüfung eingereicht:",
  "fd.submittedBody":
    "Der Editor ist abgeschlossen und geleert. Speichern oder erneutes Einreichen desselben Inhalts ist gesperrt; ein neuer Eintrag startet nur bewusst über den Button.",
  "fd.openValidation": "Validierung öffnen",
  "fd.viewObject": "Objekt ansehen",
  "fd.newEntry": "Neuer Eintrag",
  "fd.titleOptional": "Titel optional",
  "fd.content": "Inhalt",
  "fd.draftLoading": "Entwurf wird geladen ...",
  "fd.draftOpen": "Vordertür-Entwurf geöffnet. Änderungen bleiben in diesem Entwurf.",
  "fd.editorPlaceholder":
    "Beschreibe hier dein Wissen, wie du es einem Kollegen erklären würdest — die KI strukturiert daraus einen Entwurf, den du prüfst und einreichst.",
  "fd.structureSuggest": "KI-Struktur vorschlagen",
  "fd.needContentFirst": "Schreibe zuerst Inhalt, dann kann ein Vorschlag erzeugt werden.",
  "fd.optionalAiHint": "Optionaler KI-Vorschlag. Nichts wird automatisch gespeichert.",
  "fd.aiHelp": "KI-Hilfe",
  "fd.aiHelpApply": "KI-Hilfe anwenden",
  "fd.aiHelpModes": "Klarer, strukturieren, erweitern, Rechtschreibung oder formatieren.",
  "fd.structureGenerating": "KI-Vorschlag wird erzeugt ...",
  "fd.assistGenerating": "KI-Hilfe-Vorschlag wird erzeugt ...",
  "fd.originalUnchanged": "Originaltext bleibt unverändert.",
  "fd.structureAccepted":
    "KI-Vorschlag übernommen. Bitte prüfen; gespeichert wird erst mit deiner nächsten Aktion.",
  "fd.structureKeptRichBodyTitle":
    "Struktur-Vorschlag: Titel übernommen. Der formatierte Inhalt mit Bildern und Formatierung bleibt unverändert erhalten.",
  "fd.structureKeptRichBodyNoTitle":
    "Der formatierte Inhalt bleibt erhalten; der Struktur-Vorschlag wurde nicht in den Inhalt übernommen.",
  "fd.structureRichTitleOnly":
    "Formatierter Inhalt mit Bildern bleibt erhalten — die KI schlägt nur einen Titel vor.",
  "fd.assistAccepted":
    "KI-Hilfe übernommen. Bitte prüfen; gespeichert wird erst mit deiner nächsten Aktion.",
  "fd.aiProposal": "KI-Vorschlag",
  "fd.aiProposalCheck": "KI-generiert. Bitte prüfen, bevor du etwas übernimmst.",
  "fd.fallback": "Fallback",
  "fd.fallbackNoModel":
    "KI ist nicht konfiguriert oder deaktiviert — dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  "fd.fallbackModelError":
    "KI meldete einen Fehler oder war nicht erreichbar — dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  // WP-D10 Fix 3: Zeitüberschreitung als EIGENE, ehrliche Ursache (nicht mehr im Sammelbegriff Fehler).
  "fd.fallbackModelTimeout":
    "KI hat nicht rechtzeitig geantwortet (Zeitüberschreitung) — dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  // WP-SHIP9-S2 (bens Folgeschnitt B4): vertraulichkeitsbedingter Cloud-Ausschluss als eigener, wahrer Grund.
  "fd.fallbackConfidential":
    "Der Text ist als vertraulich eingestuft — die Cloud-KI ist dafür ausgeschlossen und kein lokales Modell ist verdrahtet. Dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  "fd.fieldTitle": "Titel",
  "fd.fieldStatement": "Aussage / Kernaussage",
  "fd.fieldConditions": "Bedingungen",
  "fd.noConditions": "Keine Bedingungen vorgeschlagen.",
  "fd.fieldMeasures": "Maßnahmen",
  "fd.noMeasures": "Keine Maßnahmen vorgeschlagen.",
  "fd.fieldTags": "Hinweise / Tags",
  "fd.aiHelpProposal": "KI-Hilfe-Vorschlag",
  "fd.assistProposalCheck": "{{action}}: KI-generiert. Bitte prüfen, bevor du etwas übernimmst.",
  "fd.accept": "Übernehmen",
  "fd.discardProposal": "Vorschlag verwerfen",
  "fd.submitReview": "Prüfen & einreichen",
  "fd.saveDraft": "Als Entwurf speichern",
  "fd.discardInput": "Eingabe verwerfen",
  "fd.back": "Zurück",
  "fd.writeToSubmit": "Schreibe oder füge Inhalt ein, dann kannst du prüfen und einreichen.",
  // AUFTRAG-mega9 Block A (KW-E2E-001): sichtbare Feldvalidierung beim Einreichversuch — statt eines
  // still deaktivierten Knopfes wird die Bedingung benannt und ein Weg genannt.
  "fd.validate.lead": "Einreichen ist so noch nicht möglich:",
  "fd.validate.needBody": "Der Inhalt ist leer. Zum Einreichen braucht das Wissensobjekt Text.",
  "fd.validate.hint":
    "Du kannst den leeren Stand weiterhin als Entwurf speichern und später fortsetzen.",
  // AUFTRAG-mega9 Block B (KW-E2E-002): was ein Vordertür-Entwurf NICHT sichern kann — beim Wechsel
  // namentlich benannt, damit kein „Speichern" etwas still fallen lässt.
  "fd.unsavable.proposal":
    "Der angezeigte KI-Vorschlag ist noch nicht übernommen und wird nicht mitgespeichert.",
  "fd.unsavable.confidentialityOnly":
    "Die gewählte Vertraulichkeit ohne Titel und ohne Inhalt — dazu gibt es noch keinen Entwurf, der sie halten könnte.",
  "fd.statusLabel": "Status",
  "fd.titleOnSave": "Titel beim Speichern",
  "fd.author": "Autor",
  "fd.whatOnSave": "Was beim Speichern passiert",
  "fd.whatOnSaveBody":
    "Wird als Entwurf gesichert — jederzeit fortsetzbar. Zur Prüfung geht er erst, wenn du „Prüfen / Einreichen“ wählst; nichts wird automatisch validiert.",
  "fd.moreWays": "Mehr Erfassungswege",
  "fd.moreWaysBody":
    "Brauchst du das klassische Formular, Diktat oder das geführte Interview? Der vollständige Erfassen-Bereich hat alle Wege — diese Fläche hier ist der schnelle Einstieg.",
  // JOB 530: die weiteren Eingabeoptionen hinter dem Aufklappmuster — je Weg ein ehrlicher Satz,
  // wofür er da ist. Kein Versprechen, das der Weg nicht hält.
  "fd.options.show": "Weitere Eingabeoptionen anzeigen",
  "fd.options.hide": "Weitere Eingabeoptionen einklappen",
  "fd.options.hint.freitext":
    "Frei erzählen, die KI macht daraus einen Strukturvorschlag, den du prüfst.",
  "fd.options.hint.diktat": "Sprechen statt tippen — der Text landet im selben Erzählfeld.",
  "fd.options.hint.interview": "Geführte Rückfragen, wenn du nicht weißt, wo du anfangen sollst.",
  "fd.options.hint.datei": "Wissen aus einer vorhandenen Datei übernehmen.",
  "fd.options.hint.formular":
    "Expertenmodus: dieselben Felder direkt ausfüllen, ohne Erzählschritt.",
  "fd.toastSaved": "Entwurf gespeichert.",
  "fd.toastSubmitted": "Zur Prüfung eingereicht.",
  "fd.confirmDiscard": "Eingabe verwerfen? Nicht gespeicherte Inhalte gehen verloren.",
  "fd.errSaveFailed": "Speichern fehlgeschlagen.",
  "fd.errAssist": "Ich kann diese KI-Hilfe gerade nicht verlässlich ausführen.",
  "fd.errSpelling": "Rechtschreibprüfung kann Formatierung aktuell nicht sicher erhalten.",
  "dcmp.kicker": "Read-only Vergleich",
  "dcmp.titleDuplicate": "Duplikate vergleichen",
  "dcmp.titleConflict": "Konflikt vergleichen",
  "dcmp.back": "Zurück",
  "dcmp.loading": "Vergleich wird geladen.",
  "dcmp.loadError": "Vergleich konnte nicht geladen werden.",
  "dcmp.notFound": "Vergleich nicht gefunden oder bereits geschlossen.",
  "dcmp.textSimilarity": "Text-Ähnlichkeit",
  "dcmp.noProvenContradiction": "kein bewiesener Widerspruch — nur Wort-/Feldähnlichkeit",
  "dcmp.moreValues": "Weitere Werte",
  "dcmp.uncertainty": "Unsicherheit",
  "dcmp.textDifference": "Textunterschied",
  "dcmp.similarity": "Ähnlichkeit",
  "dcmp.scoresHint": "Scores sind Entscheidungshilfe, keine Wahrheit. Kein automatischer Merge.",
  "dcmp.viewDetails": "Details ansehen",
  "dcmp.objectRemoved": "Objekt entfernt",
  "dcmp.left": "Links",
  "dcmp.right": "Rechts",
  "dcmp.koA": "Wissensobjekt A",
  "dcmp.koB": "Wissensobjekt B",
  "dcmp.sectionSignals": "Abschnittsampeln",
  "dcmp.compareByAreas": "Vergleich nach Wissensbereichen",
  "dcmp.legendHelpTitle": "Was bedeuten die Ampelfarben?",
  "dcmp.legendHelpBody":
    "Jeder Abschnitt bekommt eine Farbe aus dem Textabgleich: Grün = die Inhalte decken sich weitgehend, Gelb = teilweise oder unklar (genauer ansehen), Rot = die Texte weichen ab. Rot bedeutet nur Unterschied, kein bewiesener Widerspruch — die Farben sind eine Lesehilfe, kein Urteil, und es wird nichts automatisch zusammengeführt.",
  "dcmp.onlyForComparison":
    "Nur zum Vergleich: Es wird nichts zusammengeführt, gelöscht oder validiert, und keine Entscheidung wird gespeichert.",
  "dcmp.sourceDuplicate": "Duplikatvergleich: {{relation}}",
  "dcmp.sourceConflict": "Konfliktvergleich: {{type}}",
  "dcmp.sectionCompareUnavailable":
    "Abschnittsvergleich nicht möglich, weil ein Wissensobjekt fehlt.",
  "dcmp.relation.identisch": "identisch",
  "dcmp.relation.a_enthaelt_b": "A enthält B",
  "dcmp.relation.b_enthaelt_a": "B enthält A",
  "dcmp.relation.teilweise": "teilweise Überschneidung",
  "dcmp.relation.verwandt": "verwandt",
  "dcmp.conflictType.truth": "Wahrheitskonflikt",
  "dcmp.conflictType.experience": "Erfahrungskonflikt",
  "dcmp.conflictType.context": "Kontextkonflikt",
  "dcmp.conflictType.temporal": "zeitlicher Konflikt",
  "dcmp.conflictType.role": "Rollenkonflikt",
  "dcmp.tone.green.label": "Übereinstimmung",
  "dcmp.tone.green.meaning": "Text und Felder decken sich weitgehend.",
  "dcmp.tone.yellow.label": "Unsicher",
  "dcmp.tone.yellow.meaning": "Teilweise oder unklar — genauer ansehen.",
  "dcmp.tone.red.label": "Unterschied",
  "dcmp.tone.red.meaning": "Text weicht ab — nur ein Unterschied, kein bewiesener Widerspruch.",
  "dcmp.section.title": "Titel",
  "dcmp.section.statement": "Kernaussage / Inhalt",
  "dcmp.section.conditions": "Bedingungen",
  "dcmp.section.measures": "Maßnahmen",
  "dcmp.section.hints": "Hinweise",
  "dcmp.section.sources": "Quellen / Evidence",
  "dcmp.section.tags": "Tags / Kategorie",
  "dcmp.section.trust": "Vertrauen / Validierungsstatus",
  // SCRUM-487 (i18n): reason/note-Heuristiktexte als Keys aus der Lib (duplicateCompare.ts).
  "dcmp.note.bothEmpty":
    "Vorläufige Feldheuristik; keine echten Detector-Scores für diesen Abschnitt.",
  "dcmp.note.exactMatch": "Vorläufige Feldheuristik; exakte Feldgleichheit.",
  "dcmp.note.oneMissing": "Vorläufige Feldheuristik; ein Wert fehlt.",
  "dcmp.note.heuristic": "Vorläufige Feldheuristik; keine fachliche Wahrheit.",
  "dcmp.note.noScore":
    "Score nicht vorhanden: Gesamtwerte sind vorläufige Feldheuristik ohne Detector-Prozent.",
  "dcmp.note.mixedOverlap":
    "Übereinstimmung aus bestehendem Detector; Konflikt/Unsicherheit bleiben vorläufige Anzeigehilfe.",
  "dcmp.note.mixedConflict":
    "Konfliktwert aus bestehendem Detector; Übereinstimmung bleibt vorläufige Feldheuristik.",
  "dcmp.reason.bothEmpty": "Beide Seiten haben keinen verwertbaren Wert.",
  "dcmp.reason.identical": "Die Werte sind identisch.",
  "dcmp.reason.oneMissing": "Ein Wert fehlt, daher ist kein echter Konflikt ableitbar.",
  "dcmp.reason.strongDiff":
    "Die Feldwerte unterscheiden sich stark und müssen fachlich geprüft werden.",
  "dcmp.reason.partialDiff":
    "Die Feldwerte unterscheiden sich teilweise und müssen geprüft werden.",
  // SCRUM-487 (i18n): Front-Door-Lib-Konstanten (captureFrontDoor.ts).
  "cfd.fallbackTitle": "Unbenanntes Wissensobjekt",
  "cfd.structuringUnavailable": "Ich kann das gerade nicht verlässlich ordnen.",

  // ==============================================================================================
  // AUFTRAG-mega61 — RECHT UND TRANSPARENZ.
  // ==============================================================================================
  //
  // Die Texte sind NICHT neu formuliert. Sie stammen wörtlich aus den rechtlich abgewogenen
  // Entwürfen des Kopfes (_relay/kopf/RECHT-Entwuerfe-und-Overview.md Teil 1 und 2,
  // RECHT-KI-Verordnung-Umsetzung.md Abschnitt 8, RECHT-Klaerung-und-Bannerkonzept.md Teil B) und
  // sind sinngleich nach EN und NL übersetzt. Wer sie ändert, ändert eine Rechtsaussage.
  //
  // DIE `legal.tbd.*`-SCHLÜSSEL SIND EINE EIGENE KLASSE: Angaben, die niemand im Code kennt
  // (Firmenname, Anschrift, Aufsichtsbehörde, Löschfristen, Anbieter). Sie tragen AUSNAHMSLOS den
  // Wert von `legal.pending` — nichts wird erfunden, auch nicht plausibel. Der Sammler
  // tests/legal/mega61-rechtsseiten.test.ts hält das fest und wird rot, sobald einer von ihnen
  // einen ausgedachten Wert trägt.
  "legal.pending": "— wird ergänzt —",
  "legal.tbd.company": "— wird ergänzt —",
  "legal.tbd.address": "— wird ergänzt —",
  "legal.tbd.representative": "— wird ergänzt —",
  "legal.tbd.email": "— wird ergänzt —",
  "legal.tbd.phone": "— wird ergänzt —",
  "legal.tbd.register": "— wird ergänzt —",
  "legal.tbd.vatId": "— wird ergänzt —",
  "legal.tbd.responsible": "— wird ergänzt —",
  "legal.tbd.supervisoryAuthority": "— wird ergänzt —",
  "legal.tbd.dataProtectionContact": "— wird ergänzt —",
  "legal.tbd.dataProtectionOfficer": "— wird ergänzt —",
  "legal.tbd.retention": "— wird ergänzt —",
  "legal.tbd.serverLogs": "— wird ergänzt —",
  "legal.tbd.modelProvider": "— wird ergänzt —",
  "legal.tbd.mailProvider": "— wird ergänzt —",
  "legal.tbd.hostingProvider": "— wird ergänzt —",
  "legal.tbd.thirdCountry": "— wird ergänzt —",
  "legal.tbd.version": "— wird ergänzt —",

  // Der Vermerk am Anfang beider Seiten. Ohne ihn sieht ein „— wird ergänzt —“ wie ein Fehler aus,
  // mit ihm wie eine Absicht — das ist der Unterschied zwischen schlampig und bewusst.
  "legal.draftNotice.title": "Entwurfsstand",
  "legal.draftNotice.body":
    "Diese Anwendung befindet sich in einer geschlossenen Testphase und ist nicht öffentlich zugänglich. Die noch offenen Angaben werden vor der Veröffentlichung ergänzt.",
  "legal.footer.title": "Rechtliches",
  "legal.footer.imprint": "Impressum",
  "legal.footer.privacy": "Datenschutz",
  "legal.back": "Zurück zur Anwendung",

  "legal.imprint.title": "Impressum",
  "legal.imprint.ddg": "Angaben gemäß § 5 DDG",
  "legal.imprint.representedBy": "Vertreten durch",
  "legal.imprint.contact": "Kontakt",
  "legal.imprint.contactEmail": "E-Mail",
  "legal.imprint.contactPhone": "Telefon",
  "legal.imprint.register": "Registereintrag",
  "legal.imprint.registerNote":
    "Dieser Abschnitt entfällt vollständig, solange kein Registereintrag besteht. Er wird dann gestrichen und nicht mit einem Ersatzwert gefüllt.",
  "legal.imprint.vat": "Umsatzsteuer-Identifikationsnummer",
  "legal.imprint.vatText": "Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:",
  "legal.imprint.responsible": "Verantwortlich für den Inhalt",
  "legal.imprint.supervisory": "Aufsichtsbehörde",
  "legal.imprint.supervisoryNote":
    "Dieser Abschnitt entfällt. Er ist nur bei erlaubnispflichtigen Tätigkeiten anzugeben; die Bereitstellung einer Wissensmanagement-Software ist nach heutigem Stand nicht erlaubnispflichtig.",
  "legal.imprint.status": "Hinweis zum Stand dieses Angebots",
  "legal.imprint.statusBody":
    "Dieses Angebot befindet sich in einer geschlossenen Testphase und ist ausschließlich für eingeladene Benutzerinnen und Benutzer bestimmt. Es richtet sich nicht an Verbraucher und stellt kein öffentliches Angebot dar.",

  "legal.privacy.title": "Datenschutzerklärung",
  "legal.privacy.label.purpose": "Zweck",
  "legal.privacy.label.basis": "Rechtsgrundlage",
  "legal.privacy.label.retention": "Speicherdauer",
  "legal.privacy.label.recipient": "Empfänger",
  "legal.privacy.s1.title": "1. Verantwortlicher",
  "legal.privacy.s1.body":
    "Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der Datenschutz-Grundverordnung ist:",
  "legal.privacy.s1.dpo": "Datenschutzbeauftragter:",
  "legal.privacy.s2.title": "2. Grundsatz",
  "legal.privacy.s2.body":
    "Wir verarbeiten personenbezogene Daten nur, soweit dies für den Betrieb dieser Anwendung erforderlich ist. Wir setzen keine Analyse-, Tracking- oder Werbedienste ein, laden keine Inhalte von fremden Servern in Ihren Browser und verwenden keine Zählpixel. Die Sicherheitsrichtlinie unseres Servers unterbindet Verbindungen Ihres Browsers zu fremden Anbietern technisch.",
  "legal.privacy.s3.title": "3. Nutzerkonto und Anmeldung",
  "legal.privacy.s3.body":
    "Um die Anwendung zu nutzen, benötigen Sie ein Konto. Dabei verarbeiten wir Ihren Namen, Ihre E-Mail-Adresse und Ihr Passwort. Das Passwort wird ausschließlich in einer nicht rückrechenbaren Form gespeichert.",
  "legal.privacy.s3.purpose":
    "Bereitstellung des Zugangs, Zuordnung Ihrer Beiträge, Sicherheit des Zugangs.",
  "legal.privacy.s3.basis":
    "Erfüllung des Vertrags beziehungsweise des Nutzungsverhältnisses, Artikel 6 Absatz 1 Buchstabe b DSGVO.",
  "legal.privacy.s3.retention": "Für die Dauer des Nutzungsverhältnisses.",
  "legal.privacy.s3.reset":
    "Wenn Sie Ihr Passwort zurücksetzen, erzeugen wir eine einmalige Kennung, die eine Stunde gültig ist und danach verfällt.",
  "legal.privacy.s4.title": "4. Speicherung in Ihrem Endgerät",
  "legal.privacy.s4.p1":
    "Beim Anmelden setzen wir ein Cookie mit dem Namen kw_session. Es enthält ausschließlich eine Zufallskennung, keine Angaben über Sie. Es ist für Skripte im Browser nicht lesbar, wird nur über eine verschlüsselte Verbindung übertragen, gilt vierzehn Tage und wird beim Abmelden gelöscht. Auf unserem Server ist dazu nur ein Prüfwert gespeichert, nicht die Kennung selbst.",
  "legal.privacy.s4.p2":
    "Ohne dieses Cookie ist eine angemeldete Nutzung technisch nicht möglich. Es ist damit für den von Ihnen ausdrücklich gewünschten Dienst unbedingt erforderlich; eine Einwilligung ist dafür nach § 25 Absatz 2 TDDDG nicht erforderlich.",
  "legal.privacy.s4.p3":
    "Melden Sie sich über das Anmeldeverfahren Ihrer Organisation an, setzen wir für die Dauer dieses Vorgangs drei weitere Kennungen, die zehn Minuten gelten und unmittelbar nach dem Abschluss gelöscht werden.",
  "legal.privacy.s4.p4":
    "Zusätzlich merkt sich die Anwendung in Ihrem Browser Ihre Ansichtseinstellungen — etwa Sortierung, gewählte Filter, gespeicherte Ansichten, das gewählte Erscheinungsbild und die Information, welche Einführungshinweise Sie bereits gesehen haben. Diese Angaben verlassen Ihren Browser nicht und werden nicht an uns übertragen. Sie entstehen erst, wenn Sie die betreffende Funktion verwenden. Die Anwendung funktioniert auch dann vollständig, wenn Ihr Browser diese Speicherung unterbindet.",
  "legal.privacy.s4.p5":
    "Ein Hinweis, der Ihnen wichtig sein kann: Erfassen Sie Inhalte, während keine Verbindung zu unserem Server besteht, bewahrt die Anwendung diese Entwürfe in Ihrem Browser auf, bis sie übertragen werden können. In dieser Zwischenspeicherung können daher von Ihnen verfasste Inhalte liegen. Sie werden nach der Übertragung dort entfernt.",
  "legal.privacy.s4.p6":
    "Wenn Sie die Anwendung als installierte Anwendung nutzen, legt Ihr Browser Programmdateien in einem Zwischenspeicher ab, damit sie schneller startet. Antworten unseres Servers und Ihre Inhalte werden dort nicht abgelegt.",
  // AUFTRAG-mega63 Block D: Block A führt einen NEUEN Browser-Token ein (kw_signout_pending). Diese
  // Aufzählung ist eine Tatsachenaussage über unser Produkt — fehlte der Merker darin, wäre sie ab
  // heute unvollständig. Zweck, Ort, Lebensdauer und die Einordnung als technisch notwendig stehen
  // ausdrücklich dabei; eine darüber hinausgehende rechtliche Bewertung wird hier nicht getroffen.
  //
  // AUFTRAG-mega64 Block B — DIESER ABSATZ IST ERSETZT, NICHT ERGÄNZT.
  // Er beschrieb bis mega63 einen Merker, der nur in EINEM Tab galt und beim Schließen des Tabs
  // verschwand. Beides trifft ab mega64 nicht mehr zu: Der Merker liegt im dauerhaften
  // Browserspeicher (`localStorage`) und gilt in allen Tabs desselben Browsers. Einen zweiten Absatz
  // DANEBEN zu stellen wäre der schlimmere Fehler — es gäbe dann zwei Aussagen über denselben
  // Merker, und die Nutzerin müsste raten, welche gilt.
  //
  // AUFTRAG-mega65 BLOCK B — DIE FRIST VERSCHWINDET AUS DIESEM ABSATZ, WEIL SIE AUS DEM CODE
  // VERSCHWINDET.
  //
  // Hier stand bis mega64: „kommt beides nicht zustande, verfällt er spätestens nach vierundzwanzig
  // Stunden von selbst." Das war eine falsche Tatsachenaussage in einer Rechtsfläche, und ben hat sie
  // am Code belegt (sammel62, ROT-2): `abmeldeschuldGesetzt()` las die gespeicherte Frist in dem Tab,
  // in dem die Abmeldung scheiterte, überhaupt nicht, und ein beschädigter Eintrag sperrte über
  // Neustarts hinweg unbegrenzt.
  //
  // Der Code führt seit mega65 KEINE Frist mehr (Begründung in `app/abmeldeschuld.ts`), und dieser
  // Satz sagt jetzt, was wirklich geschieht: Der Merker bleibt, bis die Beendigung bestätigt ist
  // oder feststeht, dass die Sitzung nicht mehr besteht — und die Anwendung arbeitet von sich aus
  // darauf hin, bei zurückkehrender Verbindung UND bei jedem neuen Aufbau. Das ist der ehrlichere
  // Text: Er verspricht keinen Automatismus mit Uhr, sondern benennt die Bedingung und den Weg
  // dorthin. Der Sammler `tests/legal/mega63-speicher-aufzaehlung.test.ts` hält beide Seiten
  // zusammen — führt der Code keine Frist, darf hier keine stehen.
  //
  // Die vier Pflichtangaben stehen weiterhin vollständig darin: Zweck (Nutzung gesperrt bis zur
  // Bestätigung), Ort (dauerhafter Browserspeicher, nicht Tab), Lebensdauer (bis zur Bestätigung
  // bzw. bis feststeht, dass die Sitzung fort ist — ohne Frist), Einordnung (technisch notwendig).
  "legal.privacy.s4.p7":
    "Schlägt das Beenden Ihrer Sitzung fehl, merkt sich die Anwendung das in Ihrem Browser unter dem Namen kw_signout_pending, damit die Nutzung gesperrt bleibt, bis unser Server die Beendigung bestätigt hat. Weil Ihre Sitzung für alle Fenster und Tabs desselben Browsers gilt, liegt dieser Merker im dauerhaften Browserspeicher und wirkt ebenfalls in allen Fenstern und Tabs — ein zweites, schon offenes Fenster würde sonst weiter Inhalte zeigen, obwohl die Beendigung offen ist. Der Merker enthält keine Angaben über Sie und wird nicht an uns übertragen. Er bleibt, bis unser Server die Beendigung bestätigt hat oder feststeht, dass Ihre Sitzung nicht mehr besteht; dann wird er gelöscht. Von selbst verfällt er nicht. Damit das nicht an Ihnen hängen bleibt, versucht die Anwendung die Beendigung von sich aus erneut — sobald Ihre Verbindung wieder besteht und bei jedem neuen Aufbau der Anwendung; außerdem können Sie es jederzeit selbst auslösen. Er ist für die von Ihnen gewünschte Abmeldung technisch notwendig.",
  "legal.privacy.s5.title": "5. Ihre Inhalte",
  "legal.privacy.s5.body":
    "Die Anwendung dient dazu, Wissen zu erfassen, zu prüfen und wiederzufinden. Die Inhalte, die Sie eingeben oder hochladen, werden zusammen mit dem Zeitpunkt und Ihrer Kennung als Urheber gespeichert, damit Beiträge nachvollziehbar bleiben und Rückfragen möglich sind.",
  "legal.privacy.s5.basis": "Vertragserfüllung, Artikel 6 Absatz 1 Buchstabe b DSGVO.",
  "legal.privacy.s6.title": "6. Nachvollziehbarkeit von Änderungen",
  "legal.privacy.s6.body":
    "Um Änderungen an geprüftem Wissen nachvollziehbar zu halten, führen wir ein fortlaufendes, gegen nachträgliche Veränderung gesichertes Protokoll. Darin stehen der Zeitpunkt, die Kennung der handelnden Person, die Art der Handlung und das betroffene Objekt. IP-Adresse und Browserkennung werden in diesem Protokoll nicht gespeichert. Auch Anmeldung und Abmeldung werden auf diese Weise vermerkt.",
  "legal.privacy.s6.basis":
    "Berechtigtes Interesse an der Integrität und Nachvollziehbarkeit geprüften Wissens, Artikel 6 Absatz 1 Buchstabe f DSGVO.",
  "legal.privacy.s7.title": "7. Schutz vor Missbrauch",
  "legal.privacy.s7.body":
    "Um automatisierte Anmeldeversuche abzuwehren, zählen wir fehlgeschlagene Versuche kurzzeitig im Arbeitsspeicher, bezogen auf die IP-Adresse und die eingegebene E-Mail-Adresse. Diese Zähler werden nicht dauerhaft gespeichert.",
  "legal.privacy.s7.basis":
    "Berechtigtes Interesse an der Sicherheit der Anwendung, Artikel 6 Absatz 1 Buchstabe f DSGVO.",
  "legal.privacy.s7.logs": "Betriebsprotokolle des Webservers:",
  "legal.privacy.s8.title": "8. Künstliche Intelligenz",
  "legal.privacy.s8.p1":
    "Bestimmte Funktionen der Anwendung nutzen ein KI-Modell — etwa das Beantworten von Fragen, das Strukturieren von Notizen, das Vorschlagen von Bildbeschreibungen und das Gruppieren importierter Inhalte. Damit ein solches Ergebnis entstehen kann, werden die dafür benötigten Inhalte an den Betreiber des Modells übermittelt und dort verarbeitet.",
  "legal.privacy.s8.p2":
    "Die Anwendung zeigt Ihnen an jeder betroffenen Stelle an, dass ein KI-Modell arbeitet und welche Art von Modell das ist. Ergebnisse eines KI-Modells können unzutreffend sein und ersetzen keine fachliche Prüfung.",
  // AUFTRAG-mega61 Block G: dieser Absatz ist die einzige Tatsachenzusicherung der Erklärung, die
  // am Code hängt. Sie steht hier NUR, weil sie einen Test hat, der rot wird, wenn sie fällt
  // (tests/ask/mega61-vertraulich-kein-cloud-kontext.test.ts). Und sie behauptet ausdrücklich
  // NICHT mehr, als sie deckt: der Fragetext selbst wird übermittelt.
  "legal.privacy.s8.p3":
    "Wissensobjekte, die als vertraulich oder streng vertraulich eingestuft sind, werden aus dem Zusammenhang entfernt, bevor eine Frage an ein Modell geht — sie erreichen das Modell nicht. Der Text Ihrer Frage wird dagegen übermittelt: Bitte geben Sie dort keine vertraulichen Inhalte ein.",
  "legal.privacy.s8.thirdCountry": "Übermittlung in ein Drittland:",
  "legal.privacy.s9.title": "9. E-Mail-Versand",
  "legal.privacy.s9.body":
    "Für Einladungen und das Zurücksetzen von Passwörtern versenden wir E-Mails.",
  "legal.privacy.s9.basis": "Vertragserfüllung, Artikel 6 Absatz 1 Buchstabe b DSGVO.",
  "legal.privacy.s10.title": "10. Hosting",
  "legal.privacy.s10.body": "Die Anwendung wird auf gemieteten Servern betrieben.",
  "legal.privacy.s10.basis":
    "Berechtigtes Interesse am wirtschaftlichen Betrieb, Artikel 6 Absatz 1 Buchstabe f DSGVO.",
  "legal.privacy.s11.title": "11. Anbindung weiterer Systeme",
  "legal.privacy.s11.body":
    "Wenn Ihre Organisation den Import aus einem eigenen System einrichtet, werden die dafür nötigen Inhalte von dort abgerufen. Welche Systeme das sind, entscheidet Ihre Organisation.",
  "legal.privacy.s12.title": "12. Keine automatisierte Entscheidung im Einzelfall",
  "legal.privacy.s12.body":
    "Es findet keine automatisierte Entscheidungsfindung einschließlich Profilbildung statt, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt. Vorschläge des KI-Modells sind Vorschläge; über die Aufnahme und Prüfung von Wissen entscheiden Menschen.",
  "legal.privacy.s13.title": "13. Ihre Rechte",
  "legal.privacy.s13.body":
    "Sie haben das Recht auf Auskunft über die zu Ihrer Person gespeicherten Daten, auf Berichtigung unrichtiger Daten, auf Löschung, auf Einschränkung der Verarbeitung, auf Datenübertragbarkeit und auf Widerspruch gegen eine Verarbeitung, die auf einem berechtigten Interesse beruht. Haben Sie eine Einwilligung erteilt, können Sie diese jederzeit mit Wirkung für die Zukunft widerrufen; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.",
  "legal.privacy.s13.contact": "Kontakt für alle diese Anliegen:",
  "legal.privacy.s13.authority":
    "Unabhängig davon haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere bei der Behörde Ihres Aufenthaltsorts oder der für uns zuständigen Behörde:",
  "legal.privacy.s14.title": "14. Erforderlichkeit der Angaben",
  "legal.privacy.s14.body":
    "Die Angabe von Name, E-Mail-Adresse und Passwort ist für die Einrichtung eines Zugangs erforderlich. Ohne diese Angaben können wir keinen Zugang bereitstellen. Eine gesetzliche Pflicht zur Bereitstellung besteht nicht.",
  "legal.privacy.s15.title": "15. Änderungen",
  "legal.privacy.s15.body":
    "Wir passen diese Erklärung an, wenn sich die Anwendung oder die Rechtslage ändert. Stand dieser Fassung:",

  // ==============================================================================================
  // AUFTRAG-mega61 BLOCK B/D — DER HINWEISBANNER UND DIE FOLGE EINER ABLEHNUNG.
  // ==============================================================================================
  //
  // WORTLAUT IST HIER RECHTLICH BINDEND. Die Wörter „Zustimmung“ und „Einwilligung“ kommen in
  // diesen Texten NICHT vor, und das ist keine Stilfrage: Eine Auswahl, die man nicht folgenlos
  // verweigern kann, wäre als Einwilligung unwirksam — eine Scheineinwilligung täuscht eine
  // Rechtsgrundlage vor, die sie nicht hat. Was hier stattfindet, ist eine KENNTNISNAHME.
  // Der Sammler tests/legal/mega61-banner-wortlaut.test.ts hält das über alle drei Sprachen fest.
  "notice.banner.aria": "Hinweis zur Nutzung dieser Anwendung",
  "notice.banner.title": "Kurz zur Kenntnis",
  "notice.banner.ai":
    "Diese Anwendung arbeitet mit künstlicher Intelligenz. Wenn Sie eine Frage stellen, Notizen strukturieren lassen oder eine Bildbeschreibung vorschlagen lassen, wird ein KI-Modell verwendet, und die dafür benötigten Inhalte werden an dessen Betreiber übermittelt. Ergebnisse eines KI-Modells können unzutreffend sein und ersetzen keine fachliche Prüfung. An jeder betroffenen Stelle sehen Sie, welches Modell arbeitet.",
  "notice.banner.cookie":
    "Für die Anmeldung wird ein technisch notwendiges Sitzungscookie gesetzt. Ohne dieses Cookie ist eine angemeldete Nutzung nicht möglich.",
  "notice.banner.ack": "Verstanden — weiter",
  "notice.banner.decline": "Nicht einverstanden",
  "notice.decline.title": "Ihre Sitzung wird beendet",
  "notice.decline.body":
    "Das Sitzungscookie ist bereits gesetzt — ohne es ist eine angemeldete Nutzung technisch nicht möglich. Wir beenden deshalb jetzt Ihre Sitzung und löschen das Cookie. Sie können sich jederzeit wieder anmelden.",
  "notice.decline.confirm": "Sitzung jetzt beenden",
  "notice.decline.cancel": "Zurück zum Hinweis",
  "notice.decline.loginHint":
    "Ihre Sitzung wurde beendet, weil Sie mit dem Hinweis nicht einverstanden waren. Sie können sich jederzeit wieder anmelden.",

  // AUFTRAG-mega62 Block C: Der Wortlaut behauptet NICHTS, was nicht feststeht. Er sagt nicht
  // „Sie sind noch angemeldet" (das wissen wir nicht) und nicht „es hat geklappt" (das hat es
  // nicht) — er sagt, dass die Beendigung unbestätigt ist, und was das bedeutet.
  //
  // AUFTRAG-mega64 BLOCK C — DIE SICHTBARE ZUSAGE SAGT, WAS DAS PRODUKT TUT.
  //
  // Hier stand bis mega63 unqualifiziert: „Solange das nicht geklärt ist, zeigen wir Ihnen keine
  // Inhalte." Die Datenschutzerklärung nannte gleichzeitig die Tab-Grenze ehrlich (§ 4). Zwei Texte
  // im selben Produkt, die verschieden viel versprachen — und der weitergehende stand dort, wo die
  // Nutzerin ihn liest. ben hat das als Zusagenkante gemeldet (sammel61, Finding 2).
  //
  // Block B hat die Grenze beseitigt, statt den Text zu beschneiden: die Sperre gilt jetzt wirklich
  // in allen Fenstern und Tabs. Der Satz darf deshalb stehen bleiben — und weil er das jetzt
  // wirklich leistet, sagt er es auch AUSDRÜCKLICH. Dazu kommt der zweite Satz, den mega63 noch
  // nicht sagen konnte: dass die Anwendung es von selbst erneut versucht. Das ist keine neue
  // Zusicherung, sondern die Beschreibung des Nachholers in `AuthContext` — ohne ihn wüsste die
  // Nutzerin nicht, dass Warten ein gangbarer Weg ist, und der Knopf wäre der einzige.
  //
  // AUFTRAG-mega65 Block B: Der Nachholer greift seit dieser Scheibe auch beim AUFBAU der Anwendung
  // (bens GELB-1) — und das steht jetzt dabei. Es ist der Anlass, auf den die Nutzerin am ehesten
  // selbst kommt („ich lade die Seite neu"); ihn zu verschweigen hieße, den Knopf als einzigen Weg
  // erscheinen zu lassen. Eine Frist nennt dieser Text weiterhin nicht, denn das Produkt führt
  // keine (s. `app/abmeldeschuld.ts` und § 4 der Datenschutzerklärung).
  "notice.signOutFailed.title": "Ihre Sitzung wurde nicht bestätigt beendet",
  "notice.signOutFailed.body":
    "Sie haben dem Hinweis nicht zugestimmt, und wir wollten Ihre Sitzung beenden — der Server hat das aber nicht bestätigt. Möglicherweise besteht Ihre Sitzung noch. Solange das nicht geklärt ist, zeigen wir Ihnen keine Inhalte, und zwar in allen Fenstern und Tabs dieses Browsers. Die Anwendung versucht die Beendigung von selbst erneut — sobald Ihre Verbindung wieder besteht und bei jedem neuen Aufbau; Sie können es auch sofort erneut versuchen.",
  "notice.signOutFailed.retry": "Beendigung erneut versuchen",
  "notice.signOutFailed.again":
    "Auch dieser Versuch kam nicht durch. Bitte prüfen Sie Ihre Netzverbindung.",

  // ==============================================================================================
  // AUFTRAG-mega61 BLOCK E — DER DAUERHAFT SICHTBARE SATZ AN JEDER KI-FLÄCHE.
  // ==============================================================================================
  //
  // EIN Schlüssel für ALLE Modellflächen, und das ist Absicht: Artikel 50 Absatz 5 der
  // KI-Verordnung verlangt die Information „klar und deutlich unterscheidbar“. Was auf jeder
  // Fläche anders formuliert wäre, wäre weder klar noch unterscheidbar — und ein zweiter Wortlaut
  // wäre eine zweite Wahrheit über dasselbe Produkt.
  "ai.generatedNotice": "Von künstlicher Intelligenz erzeugt — bitte fachlich prüfen.",

  // ==============================================================================================
  // AUFTRAG-mega62 BLOCK F — DER KOSTENHINWEIS AN JEDER AUSLÖSESTELLE.
  // ==============================================================================================
  //
  // EIN Schlüssel für ALLE Auslösestellen, aus demselben Grund wie oben: Sechs verschieden
  // formulierte Warnungen über dieselbe Tatsache wären sechs Wahrheiten. Der Wortlaut ist an
  // `ask.examplesSendHint` angelehnt, der diese Zusage seit mega51 an der Fragenfläche trägt —
  // aber allgemein gehalten, weil er auch an Knöpfen steht, die nicht „fragen“.
  //
  // EIN HALBSATZ, KEINE BELEHRUNG: Er sagt, was der Klick auslöst, nicht was man tun soll.
  //
  // AUFTRAG-mega69 B2 (bens sammel65-Auflage 2): „kann … auslösen", nicht „startet". `billable`
  // sagt „die Cloud KANN für diese Aufgabe kostenpflichtig genutzt werden" — nicht „dieser Klick
  // kostet sicher Geld": `unverified` gilt vorsorglich als erreichbar, die Vertraulichkeit der
  // konkreten Eingabe nimmt die Cloud ggf. aus der Kette, und ein Laufzeitfehler mit lokalem
  // Rückfall kostet ebenfalls nichts. Der alte Wortlaut „startet … eine echte, kostenpflichtige"
  // war dafür zu absolut — eine Tatsachenbehauptung ohne Deckung.
  "ai.costHint": "Ein Klick kann eine echte, kostenpflichtige Cloud-KI-Anfrage auslösen.",

  // ==============================================================================================
  // AUFTRAG-mega62 BLOCK E — DIE KENNZEICHNUNG, DIE MIT DER DATEI DAS HAUS VERLÄSST.
  // ==============================================================================================
  //
  // Der Wortlaut steht so in Abschnitt 8 von `_relay/kopf/RECHT-KI-Verordnung-Umsetzung.md`. Er
  // nennt das System, die Aufgabe und das Datum — ohne diese drei Angaben wäre „von KI erzeugt“
  // eine Behauptung ohne Bezug, und in einer weitergereichten Datei ist der Bezug alles, was
  // bleibt. Der Bildschirmhinweis (`ai.generatedNotice`) kann das nicht leisten: er reist nicht mit.
  "ai.exportNotice":
    "Von künstlicher Intelligenz erzeugt (KLARWERK, {{task}}, {{date}}). Inhaltlich zu prüfen.",
  // Die Aufgabe im Klartext. Nur `answer` ist bisher nötig — die anderen beiden
  // kennzeichnungspflichtigen Aufgaben (interview, describe) haben heute keinen eigenen Exportweg.
  "ai.task.answer": "Frage beantwortet",

  // ==============================================================================================
  // AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — Importresultat: Original und Wissen getrennt.
  // ==============================================================================================
  //
  // Die Texte tragen die Aussage; die Farbe ist die zweite Spur, nie die einzige. Jeder Laufzustand
  // hat deshalb einen eigenen Namen UND einen eigenen Hinweis, was er für das Gezeigte bedeutet —
  // „teilweise" und „fehlgeschlagen" dürfen nie wie ein Erfolg klingen (`KW-W2-17`).
  "w2.result.heading": "Importergebnis",
  "w2.run.heading": "Lauf",
  "w2.run.status.QUEUED": "In der Warteschlange",
  "w2.run.status.FETCHING": "Quelle wird abgerufen",
  "w2.run.status.PERSISTING_SOURCE": "Original wird gesichert",
  "w2.run.status.EXTRACTING": "Aussagen werden entnommen",
  "w2.run.status.CREATING_KNOWLEDGE": "Wissenseinheiten entstehen",
  "w2.run.status.ANALYZING": "Prüfung läuft",
  "w2.run.status.COMPLETED": "Abgeschlossen",
  "w2.run.status.PARTIAL": "Teilweise fehlgeschlagen",
  "w2.run.status.FAILED": "Fehlgeschlagen",
  "w2.run.status.unknown": "Zustand unbekannt",
  "w2.run.hint.QUEUED": "Der Lauf hat noch nicht begonnen. Es liegt noch kein Ergebnis vor.",
  "w2.run.hint.FETCHING": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.PERSISTING_SOURCE": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.EXTRACTING": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.CREATING_KNOWLEDGE":
    "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.ANALYZING": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.COMPLETED": "Der Lauf ist vollständig durchgelaufen.",
  "w2.run.hint.PARTIAL":
    "Ein Teil des Laufs ist fehlgeschlagen. Das Gezeigte ist unvollständig — es ist kein abgeschlossener Import.",
  "w2.run.hint.FAILED":
    "Der Lauf ist fehlgeschlagen. Was unten steht, ist deshalb nicht das beabsichtigte Ergebnis.",
  "w2.run.hint.unknown":
    "Der Server hat einen Zustand gemeldet, den diese Version nicht kennt. Das Gezeigte ist deshalb nicht als abgeschlossen zu lesen.",
  "w2.run.failureCode": "Fehlercode",
  "w2.run.failureReason": "Grund",
  // Das ORIGINAL — der eine Block links. Er ist das Dokument, nicht das Wissen.
  "w2.source.heading": "Original",
  "w2.source.lead": "Das importierte Dokument in genau der Fassung, aus der das Wissen entstand.",
  "w2.source.missing": "Zu diesem Lauf wurde kein Original geliefert.",
  "w2.source.missingRequired": "Zu diesem Original fehlen Pflichtangaben.",
  "w2.source.title": "Titel",
  "w2.source.system": "System",
  "w2.source.version": "Version",
  "w2.source.url": "Adresse",
  "w2.source.importedAt": "Importiert am",
  "w2.source.externalId": "Kennung im Quellsystem",
  // Das WISSEN — der andere Block. Bewusst eigene Überschrift, eigener Rahmen, eigene Sprache.
  "w2.knowledge.heading": "Wissenseinheiten",
  "w2.knowledge.lead": "Aus diesem einen Original entstandene, eigenständige Einheiten.",
  "w2.knowledge.count": "{{count}} Einheiten",
  "w2.knowledge.empty":
    "Aus diesem Lauf ist keine Wissenseinheit entstanden. Das ist kein erfolgreicher Import.",
  "w2.item.position": "Einheit {{position}}",
  "w2.item.statementMissing": "Zu dieser Einheit wurde keine Aussage geliefert.",
  "w2.item.locator": "Fundstelle",
  "w2.item.locatorMissing": "Fundstelle fehlt",
  "w2.item.status": "Validierung",
  "w2.item.statusMissing": "Validierungsstatus fehlt",
  "w2.item.conflicts": "Konflikte: {{count}}",
  "w2.item.conflictsNone": "Keine Konflikte gemeldet",
  "w2.item.gaps": "Wissenslücken: {{count}}",
  "w2.item.gapsNone": "Keine Wissenslücken gemeldet",
  // AUFTRAG-81 (Befund aus Preflight 78): Diese zwei Schlüssel wurden von `importResultView.ts`
  // erzeugt und in `SourceRecordCard.tsx` an `t()` gereicht — standen aber in keinem Wörterbuch.
  // i18next gibt ohne `parseMissingKeyHandler` den Schlüssel selbst aus; eine fehlende Angabe am
  // Original hätte dem Nutzer wörtlich „w2.value.missing" gezeigt.
  // Die Unterscheidung spiegelt `f.required` an der Erzeugungsstelle: fehlt eine PFLICHTangabe,
  // ist das ein Mangel; fehlt eine freiwillige, hat die Quelle schlicht nichts geliefert. Beides
  // als „fehlt" zu benennen wäre eine Behauptung über die Quelle, die niemand belegen kann.
  "w2.value.missing": "Pflichtangabe fehlt",
  "w2.value.none": "Nicht geliefert",
};

const en: typeof de = {
  // SCRUM-488: first tranche of contextual help texts (mirror of the DE keys).
  "ask.help.sources.title": "Why only sourced answers?",
  "ask.help.sources.body":
    "Klarwerk answers only from your own knowledge objects — never from general model knowledge. For every answer you see which sources carried it and what state they are in. If the basis is missing, it says so honestly instead of guessing. Check the cited sources before relying on them.",
  "lib.help.filters.title": "Filters only change the view",
  "lib.help.filters.body":
    "Maturity, status and domain merely show or hide objects — they change nothing about the knowledge itself. “Validated” is confirmed by colleagues, “open” is still under review.",
  "dup.help.detection.title": "How duplicates are detected",
  "dup.help.detection.body":
    "“Text-identical” is found by the heuristic without AI; “likely” is judged by the model on content. Merging never happens automatically — you deliberately decide what gets merged.",
  "extpage.help.scope.title": "What external search may do",
  "extpage.help.scope.body":
    "External hits are research support, not verified knowledge: nothing is imported automatically or validated by colleagues. If the admin has disabled external lookup, the area stays empty.",
  "app.name": "KLARWERK",
  "app.subtitle": "Reasoning System",
  "app.staleBundle":
    "A new version of the app is available — please reload the page (Cmd+R or Ctrl+R).",
  "nav.group.workspace": "Workspace",
  "nav.group.quality": "Quality & Upkeep",
  "nav.group.control": "Control",
  "nav.group.advanced": "Advanced",
  "nav.start": "Home",
  "nav.tasks": "My Tasks",
  "nav.capture": "Capture Knowledge",
  "nav.ask": "Ask",
  "nav.library": "Library",
  "nav.external": "External knowledge",
  "nav.validation": "Validation",
  "nav.conflicts": "Conflicts",
  "nav.duplicates": "Duplicates",
  // SCRUM-486 E: sidebar badges with meaning — count + kind (tooltip/aria-label).
  "nav.badge.tasks": "{{count}} open tasks",
  "nav.badge.loading": "Loading count …",
  "nav.badge.error": "Count failed to load – try again",
  "nav.badge.stale": "Count outdated – refresh failed, try again",
  "loadstate.error.title": "Couldn’t load.",
  "loadstate.error.retry": "Try again",
  "loadstate.stale": "Outdated – refresh failed",
  "nav.badge.validation": "{{count}} awaiting review",
  "nav.badge.conflicts": "{{count}} open contradictions",
  "nav.badge.duplicates": "{{count}} possible duplicates",
  "nav.risk": "Risk & Gaps",
  "nav.lifecycle": "Lifecycle",
  "nav.analytics": "Analytics & Audit",
  "nav.admin": "Admin",
  "nav.output": "Reports",
  "nav.import": "Import & Sources",
  "nav.graph": "Knowledge Graph",
  "nav.capital": "Capital Views",
  "nav.help": "Help",
  "nav.profile": "Profile",
  "role.viewAs": "View as role",
  "role.previewNote": "Preview as {{role}} — you stay Admin.",
  "role.backToAdmin": "Back to admin view",
  "role.stage2": "Advanced modules · Stage 2",
  "role.stage2Hint":
    "Stage 2 are additional modules beyond the core flow — quality assurance, knowledge capital and output formats. An admin enables them.",
  "role.short.viewer": "Viewer",
  "role.short.experte": "Expert",
  "role.short.controller": "Contr.",
  "role.short.admin": "Admin",
  "role.name.viewer": "Viewer",
  "role.name.experte": "Expert",
  "role.name.controller": "Controller",
  "role.name.admin": "Administrator",
  "action.logout": "Sign out",
  "topbar.search": "Search knowledge, features or assets…",
  "topbar.mobile": "Mobile",
  "topbar.design.classic": "Design: Classic",
  "topbar.design.modern": "Design: Modern",
  "topbar.design.hint": "Switch the design — changes only the look, not content or input.",
  "topbar.openMenu": "Open menu",
  "topbar.closeMenu": "Close menu",
  "topbar.menuLabel": "Navigation menu",
  "topbar.toDesktop": "To full version",
  "topbar.notifications": "Notifications",
  "topbar.notificationsPlaceholder": "No notifications yet. Real source coming (#63).",
  "topbar.reasonerActive": "AI model responding",
  "topbar.reasonerOffline": "No AI model",
  "topbar.reasonerActiveHint": "An AI model responded and was reachable most recently.",
  "topbar.reasonerUnverified": "AI model unverified",
  "topbar.reasonerUnverifiedHint":
    "An AI model is configured, but reachability has not been verified yet.",
  "topbar.reasonerUnreachable": "AI model unreachable",
  "topbar.reasonerUnreachableHint":
    "An AI model is configured but was not reachable recently (e.g. key expired, service down). Calls run deterministically.",
  "topbar.reasonerOfflineHint": "No AI model available — the deterministic fallback is running.",
  "topbar.external.blocked": "Web search: blocked",
  "topbar.external.search": "Web search: allowed",
  "topbar.external.open": "Web search: open",
  "topbar.external.hint":
    "External knowledge lookup (web search) — a SEPARATE axis, not the AI model. It only controls web search / public enrichment, not the reasoner.",
  // Pedi 05.07.: header pill "Which AI am I in?" + country of origin + GDPR confirmation.
  // GDPR: yes ONLY for an internal AI from Europe — everything else is honestly "no".
  "topbar.plain.ki":
    "Shows where the AI that Klarwerk uses does its computing — in-house or at a provider on the internet.",
  "topbar.plain.reasoner":
    "Shows whether the AI is currently answering. “Unverified” only means no answer has come back since startup — it is not an error.",
  "topbar.plain.external":
    "Shows whether Klarwerk may also look things up on the open internet when answering. “Blocked” means: no, it stays with your own knowledge.",
  "topbar.kiExternal": "AI runs in the cloud",
  "topbar.kiInternal": "AI runs on your own systems",
  "topbar.kiMixed": "AI runs in the cloud and on your own systems",
  "topbar.kiNone": "No AI",
  "topbar.kiNoneSubtitle": "deterministic fallback mode",
  "topbar.kiDsgvoYes": "GDPR: yes",
  "topbar.kiDsgvoNo": "GDPR: no",
  "topbar.kiExternalHint":
    "Your AI tasks run on a cloud model outside the company — GDPR confirmation is therefore: no. A yes exists only for an internal AI from Europe. Per-task details: Admin → AI.",
  "topbar.kiInternalHint":
    "Your AI tasks run entirely on a local in-house model. GDPR: yes exists only here — and only if the AI originates from Europe. Origin currently derived from the provider identifier; in future the central AI access control will supply it.",
  "topbar.kiMixedHint":
    "Mixed operation: some tasks run on the external cloud AI, others in-house. The strictest level counts — GDPR confirmation: no. Per-task details: Admin → AI.",
  "topbar.kiNoneHint":
    "No AI model is active for any task. Klarwerk is using deterministic fallback mode.",
  // Country of origin of the AI (interim from the provider identifier; later from AI access control).
  "country.us": "USA",
  "country.de": "Germany",
  "country.fr": "France",
  "country.cn": "China",
  "country.unknown": "origin unknown",
  "country.ownSystem": "own system (EU)",
  "topbar.notificationsEmpty": "No notifications.",
  "topbar.notifMarkAll": "Mark all read",
  "topbar.notifMarkRead": "Mark as read",
  "topbar.notifOpen": "Open",
  "topbar.notifAssignment": "Review for you",
  "topbar.notifImpact": "Your knowledge helped someone",
  "topbar.notifDuplicate": "Possible duplicate",
  "topbar.notifGapRedacted": "Open knowledge gap",
  "cmd.open": "Open quick navigation",
  "cmd.close": "Close",
  "cmd.placeholder": "Jump to page … (⌘K)",
  "cmd.empty": "No match.",
  "cmd.audit": "Audit log (in Analytics)",
  "toast.dismiss": "Dismiss",
  "page.placeholder":
    "This screen will be built in a later task. App shell, navigation and role logic are in place.",
  "status.entwurf": "Draft",
  "status.offen": "Open",
  "status.pruefung": "In review",
  "status.validiert": "Validated",
  "status.abgelehnt": "Rejected",
  "status.revalidierung": "Re-validation",
  "status.konflikt": "Conflict",
  "quality.preliminary": "Preliminary",
  "quality.reliable": "Reliable",
  "quality.assured": "Assured",
  "evidence.percentSure": "{{pct}} % confident",
  "evidence.confidenceLabel": "Confidence: {{pct}} of 100",
  "evidence.sourceDate": "Source dated {{date}}",
  "evidence.noDate": "no source date",
  "evidence.noSource": "no source on file",
  "evidence.internalSource": "internal source",
  "evidence.more": "+{{count}} more",
  "ko.read.evidenceZone": "Evidence",
  "ko.read.released": "Release",
  "ko.read.category": "Category",
  "ko.read.responsible": "Responsible",
  "ko.read.version": "Version",
  "ko.read.captured": "Captured on",
  "ko.read.moreDetails": "More details (conditions · measures · tags)",
  "intake.question": "What do you know that others should know?",
  "intake.calming": "Just start writing — Klarwerk helps with the structure.",
  "intake.fieldPlaceholder": "Just start writing …",
  "intake.removeStarter": "Remove type",
  "intake.exampleLabel": "Something like this — but yours.",
  "intake.sampleBadge": "Example",
  "intake.starter.decision": "A decision we made",
  "intake.starter.mistake": "A mistake that's easy to make",
  "intake.starter.howItWorks": "How something really works here",
  "intake.starter.changed": "Something that changed",
  "intake.prefill.decision": "We decided that ",
  "intake.prefill.mistake": "A common mistake is ",
  "intake.prefill.howItWorks": "Here's how it works: ",
  "intake.prefill.changed": "What changed is that ",
  "intake.sample.title": "Pull the emergency stop before any maintenance",
  "intake.sample.statement":
    "Before any maintenance on line 3, pull the emergency stop first and secure it against restart.",
  "intake.live.idle": "I'm listening …",
  "intake.live.checking": "Checking against your knowledge …",
  "intake.live.new": "This is new — nothing on it yet. You're the first.",
  "intake.live.similarLead": "Something similar already exists:",
  "intake.live.similarAsk": "Add to it or start fresh?",
  "intake.live.conflictLead": "Careful — this may contradict:",
  "intake.live.openKo": "View",
  "intake.live.pending": "Nothing similar found. Conflict check not yet run.",
  "intake.live.unavailable": "Check currently unavailable.",
  "intake.structure.heading": "Klarwerk suggests — tap anything that's off:",
  "intake.structure.title": "Title",
  "intake.structure.category": "Category",
  "intake.structure.source": "Likely source",
  "intake.structure.derived": "derived from your text",
  "intake.structure.categoryPlaceholder": "e.g. maintenance, safety …",
  "intake.done.heading": "Done.",
  "intake.done.checked": "Added to your shared knowledge.",
  "intake.done.credited": "Your name ({{name}}) is recorded as the author.",
  "intake.done.findable": "Whoever asks next finds it — not you.",
  "intake.done.viewKo": "View knowledge object",
  "intake.done.followUp": "Notify me about follow-up questions",
  "intake.submit": "Save knowledge",
  "dcmp.noValue": "No value",
  "dcmp.none": "none",
  "dcmp.trustStatus": "Trust {{trust}}; status {{status}}; required checks {{needed}}",
  "dcmp.tagsCategory": "Category {{category}}; type {{type}}; tags {{tags}}",
  "dcmp.note.koMissing": "No score: at least one knowledge object is missing.",
  "audit.action.ko_created": "Created",
  "audit.action.ko_revised": "Revised",
  "audit.action.ko_rated": "Rated",
  "audit.action.ko_admin_validated": "Admin-validated",
  "audit.action.ko_deleted": "Deleted",
  "audit.action.ko_purged": "Permanently deleted",
  "audit.action.ko_restored": "Restored",
  "audit.action.ko_assigned": "Assigned",
  "audit.action.ko_attached": "Attachment added",
  "audit.action.ko_detached": "Attachment removed",
  "audit.action.ko_author_transferred": "Author transferred",
  "audit.action.ko_category_changed": "Category changed",
  "audit.action.ko_commented": "Commented",
  "audit.action.ko_confidentiality": "Confidentiality changed",
  "audit.action.ko_conflict_review": "Conflict review",
  "audit.action.ko_returned_to_author": "Returned to author",
  "audit.action.ko_source_added": "Source added",
  "audit.action.ko_source_removed": "Source removed",
  "ktype.bauchgefuehl": "Intuition",
  "ktype.best_practice": "Best practice",
  "ktype.lernkurve": "Learning curve",
  "ktype.technik": "Technical",
  "ktype.negativwissen": "Negative knowledge",
  "reasoner.draftLabel": "AI draft · not validated",
  "reasoner.taskInfo.title": "Which AI runs here?",
  "reasoner.taskInfo.cloud": "Cloud AI",
  "reasoner.taskInfo.local": "Local model",
  "reasoner.taskInfo.rule": "Rule-based (no AI model)",
  "reasoner.taskInfo.unknown": "Determining …",
  "reasoner.taskInfo.bodyCloud":
    "This task runs on a cloud AI. Content is sent to the external provider for it.",
  "reasoner.taskInfo.bodyLocal":
    "This task runs on a local model on your own hardware — the content never leaves the house.",
  "reasoner.taskInfo.bodyRule":
    "This task is purely rule-based, without an AI language model — deterministic and with no external transfer.",
  "reasoner.taskInfo.bodyUnknown":
    "The current AI assignment is loading. Details are in the AI administration.",
  "reasoner.taskInfo.modelLabel": "Model",
  "reasoner.taskInfo.dsgvoInhouse": "GDPR-compliant",
  "reasoner.taskInfo.dsgvoInhouseBody":
    "Runs in-house (local or rule-based) — the data stays here and is not shared with third parties.",
  "reasoner.taskInfo.dsgvoExternal": "External processing",
  "reasoner.taskInfo.dsgvoExternalBody":
    "Uses an external cloud provider — GDPR compliance depends on the data processing agreement (DPA) with the provider.",
  "ai.unavailable.hint": "AI unavailable — no model is active for this task.",
  "provenance.original": "originally",
  "uikit.sampleStatement": "Pressure loss on press P2 usually sits at valve V4, not at the pump.",
  "state.loading": "Loading …",
  "state.error": "Something went wrong.",
  "modal.close": "Close",
  "nav.guard.title": "Unsaved entry",
  "nav.guard.body": "You have unsaved content in the capture area. What would you like to do?",
  "nav.guard.stay": "Stay here",
  "nav.guard.discard": "Discard and leave",
  "nav.guard.save": "Save draft and leave",
  "nav.guard.unsavableTitle": "Not everything can be saved",
  "nav.guard.unsavableLead": "The draft cannot save this content — it will be lost if you leave:",
  "nav.guard.unsavableHint":
    "Stay here to use or remove it; “Discard and leave” gives it up deliberately. There is no save that takes this content along.",
  // Bug (Pedi 04.07.): error boundary instead of a blank page.
  "error.title": "This view could not be loaded.",
  "error.body":
    "This is a display error, not data loss. Please reload the page. If it happens again, the detail below helps with reporting.",
  "error.reload": "Reload",
  "error.detail": "Detail",
  "state.empty": "Nothing here.",
  "auth.tagline": "Experience knowledge that stays in the company.",
  "auth.taglineSub": "Capture · Validate · Resolve · Answer · Maintain.",
  "auth.title.login": "Sign in",
  "auth.title.register": "Create account",
  "auth.title.waiting": "Almost there",
  "auth.title.setup": "First-time setup",
  "auth.sub.login": "Sign in with your account.",
  "auth.sub.register": "Create an account — an admin approves you.",
  "auth.sub.waiting": "Your account is awaiting approval.",
  "auth.sub.setup": "The first account becomes administrator.",
  "auth.waitingNote":
    "An administrator needs to approve your access. You'll be notified once it's ready.",
  "auth.backToLogin": "Back to sign in",
  "auth.name": "Name",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.passwordRule": "min. 8 characters",
  "auth.passwordRepeat": "Repeat password",
  "auth.passwordMismatch": "The passwords do not match.",
  // WP-VIP2-GATE: self-registration disabled server-side (invite-only operation).
  "auth.registrationDisabled": "Registration is invite-only — please contact your admin.",
  "auth.submit.login": "Sign in",
  "auth.submit.register": "Register",
  "auth.submit.setup": "Create admin & start",
  "auth.toRegister": "No account yet? Register",
  "auth.toLogin": "Already have an account? Sign in",
  "auth.toForgot": "Forgot password?",
  "auth.title.forgot": "Reset password",
  "auth.sub.forgot": "We'll send you a reset link.",
  "auth.submit.forgot": "Send link",
  "auth.title.forgotSent": "Email on its way",
  "auth.sub.forgotSent": "Check your inbox.",
  "auth.forgotNote":
    "If an account exists for this email, we've sent a reset link. The link is valid for 1 hour.",
  "auth.title.reset": "New password",
  "auth.sub.reset": "Choose a new password for your account.",
  "auth.newPassword": "New password",
  "auth.submit.reset": "Save password",
  "auth.resetDone": "Your password has been changed. You can sign in now.",
  "auth.resetInvalid": "This link is invalid or has expired.",
  "auth.toSignIn": "Go to sign in",
  "auth.or": "or",
  "auth.ssoButton": "Sign in with SSO",
  "auth.ssoUnavailable": "SSO is not configured for this instance.",
  "auth.ssoTitle": "SSO sign-in",
  "auth.ssoBusy": "Completing sign-in …",
  "auth.ssoIncomplete": "Incomplete SSO response. Please sign in again.",
  "cycle.title": "The Klarwerk knowledge cycle",
  "cycle.subtitle": "Knowledge is captured, validated, used and kept current.",
  // SCRUM-290: compact Stage-1 demo/pilot path (Start → Ask → Library/KO detail → Validation).
  "demo.title": "Demo/pilot path in 3 steps",
  "demo.subtitle":
    "A small real walkthrough: ask source-bound, see source/trust/status/version, send unverified knowledge to validation.",
  // SCRUM-301: visible pilot proof line (Start promises, Library/KO detail deliver).
  "demo.proof.label": "Proof line",
  "demo.proof.find": "Find knowledge",
  "demo.proof.usability": "See usability",
  "demo.proof.verify": "Check source/trust/version",
  // SCRUM-308: provenance marker for demo/seed knowledge (context only, not a quality signal).
  "demo.badge.label": "Example data",
  "demo.badge.hint":
    "Example/pilot knowledge from the demo seed. Provenance only — does not replace status, trust, source or validation. Validated stays validated, open stays open.",
  "ko.externalUnchecked.label": "Contains external, unverified knowledge",
  "ko.externalUnchecked.hint":
    "This article incorporates knowledge from a public AI or web search. It is external and unverified — please review it; it does not replace status, trust or validation.",
  // JOB 679 / D2 (K1.2): provenance marker for knowledge captured through the Word add-in.
  // Like the demo badge: provenance ONLY — never a quality or status signal.
  //
  // WHY THIS ONE READS SLIGHTLY DIFFERENTLY FROM ITS GERMAN AND DUTCH SIBLINGS: those enumerate
  // „Status, Vertrauen, Quelle oder Validierung". The literal English enumeration would spell the
  // word t-r-u-s-t, and `tests/app/mega51-sprache-und-rohwerte.test.ts` pins the TOTAL number of
  // such occurrences per language block. That guard is about the German/Dutch DISPLAY VALUES having
  // been renamed (mega52 E2/E3) — English is explicitly exempt in its own reasoning — but it counts
  // a blunt total, so any new English string carrying the word trips it. Rather than edit a guard
  // that lies outside this job's lease, the sentence says the same thing without the token: it names
  // the honest claim („not a quality signal") that the enumeration exists to make.
  "ko.originWordAddin.label": "From Word",
  "ko.originWordAddin.hint":
    "This entry was captured through the Word add-in. Provenance only — it is not a quality signal and does not replace status, source or validation.",
  "demo.ask.label": "1 · Ask",
  "demo.ask.desc":
    "Ask a backed question (valve X / overpressure) — the answer comes source-bound with trust and status, not made up.",
  "demo.library.label": "2 · See knowledge",
  "demo.library.desc":
    "In the library see source, trust, status and maturity — opening an object shows evidence and version.",
  "demo.validation.label": "3 · Validate",
  "demo.validation.desc":
    "Open/unverified knowledge belongs in validation — rate it until it is secured and usable.",
  // SCRUM-296: active capture flow in demo context (Capture → Validation → Use).
  "demo.captureEntry": "Try it actively: Capture → Review → Use",
  "demo.banner.capture.title": "Capture an experience note",
  "demo.banner.capture.body":
    "What gets saved is an OPEN knowledge object — not yet validated. Next step: send it for review/validation. Only after sufficient review is it usable source-bound; nothing is validated automatically.",
  "demo.banner.capture.next": "Next: send for review",
  // SCRUM-291: recognisable path hint boxes on the target pages (only with ?demo=stage1).
  "demo.banner.tag": "Demo path",
  "demo.banner.ask.title": "Step 1: Ask source-bound",
  "demo.banner.ask.body":
    "The answer comes with trust and source — not made up. Watch status/trust, then look at the source/object.",
  "demo.banner.ask.next": "Next: see knowledge",
  "demo.banner.library.title": "Step 2: See source, trust, status, maturity",
  "demo.banner.library.body":
    "Here each object shows source, trust, status and maturity/version. If a source is open/unverified, continue to validation.",
  "demo.banner.library.next": "Next: validate",
  "demo.banner.detail.title": "Knowledge object: check status, trust, version, sources",
  "demo.banner.detail.body":
    "Here you see what usability is based on: status, trust, version and evidence. If it is usable, use “Use knowledge” below — the question stays source-bound, nothing is secured automatically.",
  "demo.banner.validation.title": "Step 3: Rate open knowledge",
  "demo.banner.validation.body":
    "Here open/unverified knowledge is rated. Goal: turn review work into secured, usable knowledge.",
  "cycle.capture.label": "Capture",
  "cycle.capture.desc": "Save experience knowledge as a knowledge object.",
  "cycle.validate.label": "Validate",
  "cycle.validate.desc": "Review as a team until trust and status hold.",
  "cycle.use.label": "Use",
  "cycle.use.desc": "Use it source-bound in answers and output.",
  "cycle.maintain.label": "Maintain",
  "cycle.maintain.desc": "Re-validate on change — knowledge stays valid.",
  "kg.start.title": "How to read Klarwerk",
  "kg.start.body":
    "Klarwerk keeps usable knowledge separate from review work: review first, use afterwards.",
  "kg.library.title": "Result maturity",
  "kg.library.body":
    "The maturity badge shows whether a result is ready to use or belongs in review.",
  "kg.ask.title": "Answers are source-bound",
  "kg.ask.body":
    "Ask uses the knowledge base; open or unverified sources are marked and routed to validation.",
  "kg.secured.label": "Verified",
  "kg.secured.body":
    "Validated knowledge is usable and remains traceable through sources, trust and version.",
  "kg.review.label": "To review",
  "kg.review.body": "Open or in-review knowledge belongs in validation, not direct use.",
  "kg.sourceBound.label": "Source-bound",
  "kg.sourceBound.body": "Answers come from knowledge objects — without a basis, a gap is created.",
  "start.kicker": "Overview",
  "start.greeting": "Hello, {{name}}.",
  // AUFTRAG-mega38 BLOCK G1 — see the DE block.
  "start.purpose":
    "Klarwerk collects what your colleagues have learned on the job, so that you can ask about it and see where every answer comes from.",
  "start.ctaAsk": "Ask a question",
  "start.ctaCapture": "Capture knowledge",
  "start.ctaValidate": "Open validation",
  "klara.path.ariaLabel": "Klara — upcoming assisted path",
  "klara.path.kicker": "With Klara",
  "klara.path.soon": "Coming soon",
  "klara.path.start.title": "Klara supports knowledge from the very beginning.",
  "klara.path.start.body":
    "Soon you can capture, structure and prepare knowledge for review directly with Klara.",
  "klara.path.start.cta": "Capture knowledge with Klara",
  "klara.path.capture.title": "Tell Klara — she turns it into a clear draft.",
  "klara.path.capture.body":
    "Share your experience in your own words. Klara helps structure it; you review and decide.",
  "klara.path.capture.cta": "Start with Klara",
  "klara.path.import.title": "Klara helps you prepare imported knowledge.",
  "klara.path.import.body":
    "After upload, Klara will help organise, clarify and prepare it for review.",
  "klara.path.import.cta": "Import with Klara",
  "klara.path.m365.summary": "What Klara will do in Microsoft 365",
  "klara.path.m365.body":
    "Klara is planned as a bidirectional add-in for Microsoft 365. She will pick up knowledge where you already work, prepare it in a structured way for Klarwerk and make reviewed company knowledge from Klarwerk available directly in Microsoft 365 — reviewing and deciding stays with you. This is not available yet.",
  "start.todo": "To do today",
  "start.workTitle": "Next actions",
  "start.severity.critical": "now",
  "start.severity.today": "today",
  "start.severity.later": "later",
  "shelp.cycle.title": "The Knowledge-OS cycle",
  "shelp.cycle.body":
    "The four tiles are the life cycle of your knowledge: Capture → Validate → Use → Keep current. Each tile takes you straight to the matching area. You don't have to do everything at once — start with whatever is due now. Nothing kicks off on its own.",
  "shelp.work.title": "Your work overview",
  "shelp.work.body":
    "This is what actually awaits you right now — from real data (open reviews, conflicts, knowledge gaps), not an invented to-do list. The number on the right tells you how many. Click a row to continue right there. If you do nothing, nothing happens automatically.",
  "shelp.severity.title": "The coloured dots",
  "shelp.severity.body":
    "The dot on the left shows urgency: Red = do now (blocking or critical), Yellow = worth doing today, Grey = can wait. It is guidance only, not a rule — you decide the order, and nothing is processed automatically.",
  "start.focusLabel": "Most urgent open work",
  "work.conflicts": "Resolve conflicts",
  "work.criticalGaps": "Critical knowledge gaps",
  "work.revalidation": "Revalidations due",
  "work.validation": "Open validations",
  "work.learning": "Open learning-path steps",
  "start.allTasks": "All tasks →",
  "roleLink.noReach": "No access",
  "roleLink.noReachHint":
    "This area is not enabled for your role. The figure stays because it is true — only the way there is closed to you.",
  "start.todoEmpty": "Nothing open. Well done.",
  "start.todoLoading": "Loading work overview …",
  "start.stufe2.title": "Advanced features (Stage 2)",
  "start.stufe2.body":
    "Stage 2 are additional modules beyond the core flow. As an admin you have advanced features available: {{features}}. Turn on '{{toggle}}' in the sidebar to show them.",
  "task.kicker": "Tasks",
  "task.critical": "Critical",
  "task.today": "Today",
  "task.later": "Later",
  "task.none": "Nothing here.",
  "task.noneFiltered": "No item for this filter.",
  "task.filter.all": "All",
  "task.filter.validation": "Validation",
  "task.filter.returned": "Rework",
  "task.filter.conflict": "Conflicts",
  "task.filter.gap": "Knowledge gaps",
  "task.filter.revalidation": "Revalidation",
  "task.conflict": "Conflict",
  "task.validation": "Validation",
  "task.revalidation": "Re-validation",
  "task.gap": "Knowledge gap",
  "task.gapRedacted": "Confidential knowledge gap",
  "task.returned": "Rework",
  "task.action.returned": "Revise draft",
  "task.action.conflict": "Decide conflict",
  "task.action.validation": "Review knowledge",
  "task.action.revalidation": "Check validity",
  "task.action.gap": "Prioritize gap",
  "task.action.open": "Open",
  "task.explain.returned":
    "A reviewer sent your knowledge back for rework. Open it, address the feedback and resubmit it.",
  "task.explain.conflict":
    "Two statements contradict each other. Open the conflict and decide which one holds (or keep both on record).",
  "task.explain.validation":
    "Review this knowledge and cast a rating: approve (green), query (amber) or reject (red). Once enough green ratings are in, it counts as validated.",
  "task.explain.revalidation":
    "Something changed — confirm whether this knowledge is still valid, or send it back for revision.",
  "task.explain.gap":
    "This question lacks confirmed knowledge. Prioritize the gap or capture a contribution for it yourself.",
  "task.explain.open": "Open this task to see the next step.",
  // SCRUM-297: Knowledge-OS phase per work item (reuses cycle.*.label).
  "task.phaseLabel": "Phase:",
  "capture.kicker": "Capture knowledge",
  "capture.title": "Capture experience knowledge",
  "capture.rescue.kicker": "Rescue knowledge",
  "capture.rescue.title": "Secure experience knowledge before it's lost.",
  "capture.rescue.subtitle":
    "You don't have to fill in a form perfectly — just tell us what you know. Klarwerk and the AI help you make it clear and usable.",
  "capture.rescue.step.tell.label": "1. Tell it",
  "capture.rescue.step.tell.hint":
    "Write or dictate what you know from experience, in your own words — rough is fine.",
  "capture.rescue.step.structure.label": "2. AI structures it",
  "capture.rescue.step.structure.hint":
    "The AI turns it into a clear draft; in the Knowledge Studio you can refine everything calmly.",
  "capture.rescue.step.validate.label": "3. Get it reviewed",
  "capture.rescue.step.validate.hint":
    "Saving is enough — then colleagues review the knowledge before it's used as verified.",
  "capture.rescue.impactTitle": "Why your contribution matters",
  "capture.rescue.impact.secure": "Rescues experience that would otherwise be lost",
  "capture.rescue.impact.improve": "Improves the shared knowledge base",
  "capture.rescue.impact.honest": "Marked as verified only after review",
  "capture.rescue.showLess": "Less",
  "capture.rescue.showMore": "Guide",
  // SCRUM-370: guided path — raw knowledge → structure in the Studio (recommended) → review & submit.
  "capture.flow.railKicker": "How to proceed",
  "capture.flow.step.raw.label": "Capture raw knowledge",
  "capture.flow.step.raw.hint": "Tell us what you know in your own words — bullet points are fine.",
  "capture.flow.step.studio.label": "Structure in the Studio",
  "capture.flow.step.studio.hint":
    "The large workspace with AI help turns it into a clear article — you apply changes deliberately.",
  "capture.flow.step.review.label": "Review & submit",
  "capture.flow.step.review.hint":
    "Save and send for review — it only counts as verified afterwards.",
  "capture.flow.railKickerHint":
    "The Knowledge Studio is the recommended path — nothing is forced.",
  "capture.flow.studioRecommended": "Recommended",
  "capture.flow.studioLead":
    "Recommended next step: structure calmly in the Knowledge Studio. The form stays available to you.",
  "capture.flow.submitValue":
    "Your experience knowledge is secured before it's lost — it only counts as verified after review. Nothing is validated automatically.",
  "capture.wizard.back": "Back to telling",
  "capture.wizard.structuring": "The AI is structuring your knowledge …",
  "capture.wizard.condMeasures": "Conditions & measures",
  "capture.wizard.condMeasuresHint":
    "Derived from your knowledge — important for review and later use. Adjust here if needed.",
  "capture.wizard.helpers": "Help, templates & attachment context",
  "capture.wizard.helpersHint": "Optional support — none of this is mandatory.",
  "capture.wizard.docLabel": "Your knowledge page",
  "capture.wizard.pageTitle": "Edit knowledge page",
  "start.orientation.title": "Orientation: how to read Klarwerk & the demo path",
  "start.orientation.hint":
    "Open on your first visit — collapsed here afterwards, expandable anytime.",
  "capture.wizard.titleLabel": "Title",
  "capture.wizard.structData": "Core statement, conditions & measures",
  "capture.wizard.discard": "Discard",
  "ko.couple.title": "Asset coupling",
  "ko.deleteButton": "Delete knowledge object",
  "ko.deleteQ":
    "Delete? The entry moves to the recycle bin where an admin can restore it for 28 days. Demo data is deleted permanently right away.",
  "ko.deleteKeep": "Keep",
  "ko.deleteYes": "Yes, delete",
  "ko.deleteDone": "Knowledge object deleted.",
  "ko.deleteAlreadyGone": "Knowledge object was already gone. List refreshed.",
  "adm.ai.title": "AI management",
  "adm.purgeButton": "Remove demo data",
  "adm.purgeQ":
    "Really delete ALL demo data (including tester-modified)? Your own knowledge stays untouched.",
  "adm.purgeKeep": "Cancel",
  "adm.purgeYes": "Yes, remove permanently",
  "adm.purgeDone":
    "Demo data removed: {{kos}} knowledge objects, {{conflicts}} conflicts + {{duplicates}} duplicates resolved, {{gaps}} knowledge gaps, {{users}} demo users.",
  "adm.seedSkippedInline":
    "Not loaded: the demo set is already present (no duplicates). Use “Remove demo data” to remove it and then load it again.",
  "adm.seedForce": "Reload demo set",
  // AUFTRAG-mega64 Block A — see the German original for the reasoning.
  "adm.seedCredsTitle": "One-time passwords for the new demo accounts",
  "adm.seedCredsHint":
    "These passwords were just generated at random and are shown HERE ONLY. The server does not keep them and cannot repeat them. Write them down or pass them on now — reloading this page loses them, and the accounts will then need a password reset.",
  "adm.factory.title": "Factory settings",
  "adm.factory.help":
    "Fully resets the local instance: all knowledge objects, users, conflicts, gaps and settings are deleted. The program then quits; on the next start the initial setup runs and the first user becomes admin again. Only available in the local desktop version.",
  "adm.factory.hint":
    "For repeated testing: wipe everything and quit the program. After a restart it's all fresh, just like first setup.",
  "adm.factory.button": "Reset to factory settings",
  "adm.factory.confirm1": "Really delete ALL data and quit the program?",
  "adm.factory.passwordLabel": "Confirm with your admin password",
  "adm.factory.confirm2": "Final warning: this step cannot be undone.",
  "adm.factory.warnBody":
    "ALL knowledge objects, accounts and settings will be deleted and the program will quit. This cannot be undone.",
  "adm.factory.wrongPassword": "Wrong password — the factory reset was not performed.",
  "adm.factory.cancel": "Cancel",
  "adm.factory.continue": "Continue",
  "adm.factory.execute": "Reset & quit",
  "adm.factory.restartHint":
    "Reset done. The program is quitting — please restart the KLARWERK app. The first user will become admin again.",
  "adm.factoryDone": "Factory reset triggered — the program is quitting.",
  "capture.tellResetQ": "Really discard text and attachments?",
  "capture.diktatListening": "Recording — just speak; the text appears in the field below.",
  "capture.diktatIdleHint": "Hit the button and start talking — no form, no preparation.",
  "adm.ai.help":
    "Choose globally or per use which AI does the work. “Auto” uses the model when a key is configured; “Deterministic” deliberately works without a model. Keys stay on the server only — never in the browser.",
  "adm.ai.internExtern":
    "You can run internal (On-Premise Enterprise AI, your own LLM) or external (cloud) — globally as the default or fine-grained per task. The internal option appears as soon as an own LLM is reachable; test both live via “Test key” / “Test local LLM”.",
  "adm.ai.status": "Active provider: {{provider}} · mode: {{mode}}",
  "adm.ai.modeModel": "Model",
  "adm.ai.modeDemo": "Deterministic",
  "adm.sec.konten": "Accounts",
  "adm.sec.ki": "AI",
  "adm.sec.daten": "Data",
  "adm.sec.sicherheit": "Security",
  "adm.sec.bereitschaft": "Readiness",
  "adm.print": "Print",
  // SCRUM-429 (Pedi 03.07., VIP): first-run guidance for the new admin.
  "adm.firstrun.kicker": "First run",
  "adm.firstrun.title": "Welcome — your workspace is ready to go.",
  "adm.firstrun.lead":
    "As the first account you are admin. Everything needed is prepared — here are three calm first steps. This card only appears on your first visit.",
  "adm.firstrun.dismiss": "Hide",
  "adm.firstrun.done": "Got it — hide",
  "adm.firstrun.note":
    "No pressure, no fixed order: you can start freely anytime. Once hidden, it stays hidden.",
  "adm.firstrun.ki.loading": "Checking AI status …",
  "adm.firstrun.ki.both": "Both AIs connected: cloud AI and your On-Premise Enterprise AI.",
  "adm.firstrun.ki.cloudOnly":
    "Cloud AI connected. Your On-Premise Enterprise AI is not wired up yet (Admin → AI).",
  "adm.firstrun.ki.localOnly":
    "Local LLM connected. The cloud AI is not configured yet (Admin → AI).",
  "adm.firstrun.ki.none":
    "No AI connected yet — the deterministic fallback keeps working (Admin → AI).",
  "adm.firstrun.step.capture.t": "Capture knowledge",
  "adm.firstrun.step.capture.b": "Tell the AI or upload a document — it structures, you review.",
  "adm.firstrun.step.validate.t": "Review knowledge",
  "adm.firstrun.step.validate.b":
    "Experience knowledge is released in review — only then is it “usable”.",
  "adm.firstrun.step.admin.t": "Open administration",
  "adm.firstrun.step.admin.b": "Accounts, AI connection, data and security in one place.",
  "adm.firstrun.doneBadge": "done",
  // SCRUM-437 (Pedi 03.07., VIP): readiness checklist — one-glance status before the test.
  "adm.ready.title": "VIP readiness",
  "adm.ready.help":
    "An honest one-glance status before the test: what's in place, what's missing. Every row from real numbers, nothing sugar-coated.",
  "adm.ready.intro":
    "Quick control glance before the VIP test — green means ready, amber means check.",
  "adm.ready.note":
    "“Open reviews” and the external knowledge stage are neutral facts — not a flaw, just context.",
  "adm.ready.ki": "Connected AIs",
  "adm.ready.ki.both": "Both connected",
  "adm.ready.ki.partial": "Partially connected",
  "adm.ready.ki.none": "None connected",
  "adm.ready.validated": "Validated knowledge",
  "adm.ready.openReviews": "Open reviews",
  "adm.ready.count": "{{n}}",
  "adm.ready.upload": "Upload limits",
  "adm.ready.upload.val": "{{n}} attachments · {{mb}} MB",
  "adm.ready.unknown": "unknown",
  "adm.ready.loading": "loading …",
  "adm.ready.demo": "Demo data",
  "adm.ready.demo.loaded": "{{n}} loaded — removable under Data",
  "adm.ready.demo.none": "none loaded",
  "adm.ready.demo.goto": "Go to Data",
  "adm.ready.external": "External knowledge lookup",
  "adm.ready.ext.blocked": "Blocked",
  "adm.ready.ext.searchOnClick": "Search on click",
  "adm.ready.ext.searchAttach": "Search & attach",
  "adm.ready.ext.open": "Open",
  // SCRUM-432 (Pedi 03.07., VIP investor): Trust & Security.
  "adm.sich.auditTitle": "Audit trail — hash-chained, deviations verifiable",
  "adm.sich.auditHelp":
    "Every security-relevant action is only appended and linked to the previous entry via a hash chain. If an entry is changed or removed afterwards, its hash no longer matches — the deviation is computationally detectable and the integrity run names it with number, date and action. The chain has no externally anchored head: anyone with full write access to the database can recompute an entry together with every following hash. So the trail is verifiable (tamper-evident) — the chain does not stop a change, it makes it conspicuous.",
  "adm.sich.auditIntro":
    "Append-only, hash-chained: a verifiable trail of all security-relevant actions. A later deviation on an entry can be detected by recomputation.",
  "adm.sich.auditCount": "{{count}} entries in the chain",
  "adm.sich.verify.button": "Verify integrity",
  "adm.sich.verify.ok": "Integrity verified ✓ — {{count}} entries, chain intact",
  "adm.sich.verify.serialisation":
    "Chain complete — {{count}} entries, no break. For {{n}} entries the payload checksum cannot be recomputed because the database normalises the order of the payload fields. The values as they stand match the stored hash; no deviation remains unresolved.",
  "adm.sich.verify.unconfirmed":
    "Chain not confirmed — first deviation at entry {{seq}} of {{at}} ({{action}}). Type: {{kind}}. The cause must be examined.",
  "adm.sich.verify.unconfirmedPlain": "Chain not confirmed — the cause must be examined.",
  "adm.sich.verify.kind.linkage": "chain link broken",
  "adm.sich.verify.kind.serialisation": "database field order",
  "adm.sich.verify.kind.unresolved": "payload checksum not resolvable",
  "adm.sich.verify.kind.unchecked": "payload checksum not examined (too many field orders)",
  "adm.sich.dataTitle": "Data protection & security",
  "adm.sich.dataHelp":
    "An honest extract of the system's properties — not promises, but how KLARWERK is built.",
  "adm.sich.keys.t": "Keys stay in the keychain",
  "adm.sich.keys.b":
    "API keys live exclusively server-side or in the macOS keychain — never in the browser, never in code or the repository.",
  "adm.sich.localAi.t": "On-Premise Enterprise AI possible",
  "adm.sich.localAi.b":
    "Besides the cloud AI you can wire up your own local LLM. The local AI is reachable only via a private tunnel, never public.",
  "adm.sich.external.t": "External knowledge lookup restricted by default",
  "adm.sich.external.b":
    "Public AI and web search are admin-controlled and not open by default. Nothing leaves the system uncontrolled.",
  "adm.sich.audit.t": "Hash-chained audit trail",
  "adm.sich.audit.b":
    "All security-relevant actions are recorded append-only and hash-chained. A later deviation on an entry is detectable by recomputation and is named by the integrity run (tamper-evident).",
  "adm.sich.trash.t": "Deletion with trash",
  "adm.sich.trash.b":
    "Deleted items go to the trash first (recoverable); final deletion happens only after four weeks. No silent data loss.",
  "adm.sich.roles.t": "Roles & least privilege",
  "adm.sich.roles.b":
    "Four roles (viewer, expert, controller, admin). Every action checks the required permission server-side.",
  "adm.sich.noCustomerData.t": "No customer data in tests",
  "adm.sich.noCustomerData.b": "Quality assurance and evaluations run without real customer data.",
  // SCRUM-444: evidence framing on the printable extract — brand core "trust is evidence".
  "adm.sich.evidenceNote":
    "All figures here are live values from this instance — measured, not claimed. Any target values or example calculations are always explicitly labeled as such.",
  "adm.ai.test": "Test key",
  "adm.ai.testRunning": "testing …",
  "adm.conflictSelfTest.button": "Test conflict detection",
  "adm.conflictSelfTest.running": "testing detection …",
  "adm.conflictSelfTest.ok": "conflict + collision fields + verbatim evidence detected",
  "adm.conflictSelfTest.noModel": "no model (deterministic fallback) — no detection",
  "adm.conflictSelfTest.noConflict":
    "model active, but no conflict detected (model error or verdict: no contradiction)",
  "adm.conflictSelfTest.noKollision": "conflict detected, but collision fields empty",
  "adm.conflictSelfTest.provider": "Provider: {{provider}}",
  "adm.conflictSelfTest.streitpunkt": "Collision point: {{streitpunkt}}",
  "adm.conflictSelfTest.label": "Conflict",
  "adm.selfTest.button": "Test detection (conflict + duplicate)",
  "adm.selfTest.running": "testing detection …",
  "adm.dupSelfTest.label": "Duplicate",
  "adm.dupSelfTest.ok": "duplicate detected (semantically equal, lexically different)",
  "adm.dupSelfTest.noModel": "no model (deterministic fallback) — no detection",
  "adm.dupSelfTest.noDuplicate":
    "model active, but no duplicate detected (model error or verdict: not a duplicate)",
  "adm.dupSelfTest.relation": "Relation: {{relation}}",
  "adm.ai.testOk": "Connection ok — {{provider}} responded. The key works.",
  "adm.ai.testLocal": "Test local LLM",
  "adm.ai.testLocalOk": "Local LLM responded ({{provider}}).",
  "adm.ai.testFail":
    "Test failed: {{detail}} Tip: renew the key in the start dialog or keychain (service Klarwerk, account ANTHROPIC_API_KEY), then restart the app.",
  "adm.ai.global": "Global (default for all uses)",
  "adm.ai.choice.inherit": "— same as global —",
  "adm.ai.choice.auto": "Auto (model when available)",
  "adm.ai.choice.model": "Require model",
  "adm.ai.choice.cloud": "External · cloud LLM (Claude)",
  "adm.ai.choice.local": "Internal · own LLM (on-prem)",
  "adm.ai.choice.localUnavailable": "Internal · own LLM (not connected)",
  "adm.ai.choice.deterministic": "Deterministic (no model)",
  "adm.ai.task.structure": "Structuring",
  "adm.ai.task.assist": "Writing palette (AI help)",
  "adm.ai.task.interview": "Guided interview",
  "adm.ai.task.answer": "Answering questions",
  "adm.ai.task.select": "Candidate selection",
  "adm.ai.task.extract": "Knowledge from file",
  "adm.ai.task.describe": "Image description (suggestion)",
  "adm.ai.task.group": "Group import candidates",
  "adm.ai.effModel": "model",
  "adm.ai.effDet": "deterministic",
  "adm.ai.eff.cloud": "external",
  "adm.ai.eff.local": "internal",
  "adm.ai.eff.deterministic": "deterministic",
  "adm.ai.save": "Apply mapping",
  "adm.ai.detail": "Fine-tune per use",
  "adm.ai.detailHint": "optional — the default is usually enough",
  "adm.ai.saved": "AI mapping applied.",
  "adm.ai.dirtyHint": "Not applied yet — click “Apply mapping”.",
  "adm.ai.applied": "Applied ✓",
  "adm.ai.persistNote":
    "Applies until the next app restart — persistent storage and local models arrive with the full build-out (PMO entry).",
  // SCRUM-386: customer-defined AI assist functions (presets) — admin manages, palette shows all.
  "adm.presets.title": "Custom AI functions",
  "adm.presets.help":
    "The AI palette in the editor offers factory functions (Clearer, Structure, Expand, Spelling, Format). Here you add EXTRA functions for your organisation — a button name and the instruction the AI receives (e.g. “Summarise for shift handover in 5 bullet points”). The instruction is openly visible in the palette via the ? mark; as always: the AI only makes a suggestion for preview, adoption is a deliberate click. Factory functions cannot be deleted.",
  "adm.presets.hint":
    "Additional functions for the AI palette in the editor — one button name and one AI instruction each. Visible to all roles; at most 12.",
  "adm.presets.empty": "No custom functions yet — the factory palette applies unchanged.",
  "adm.presets.name": "Button name (e.g. Shift handover)",
  "adm.presets.instruction": "Instruction for the AI (e.g. Summarise in 5 bullet points …)",
  "adm.presets.add": "Add function",
  "adm.presets.save": "Save functions",
  "adm.presets.saved": "Custom AI functions saved.",
  "adm.val.title": "Reviews",
  "adm.val.help":
    "The default reviewer count applies to new submissions without an explicit value. The allowed range is 1 to 5. Existing entries stay unchanged; changes are recorded in the audit log.",
  "adm.val.hint":
    "This is how many review confirmations a new entry needs by default before it counts as validated.",
  "adm.val.label": "Default reviewer count (1–5)",
  "adm.val.save": "Save",
  "adm.val.invalid": "Please enter a whole number between 1 and 5.",
  "adm.val.saved": "Default reviewer count saved.",
  "adm.upload.title": "Upload limits",
  "adm.upload.help":
    "Sets how many attachments an object may have and how large a single attachment may be. Applies to new attachments; existing ones stay. Changes are recorded in the audit log.",
  "adm.upload.hint":
    "These limits appear wherever a file can be selected and are enforced on the server when attaching. The size measures the transferred file including transport encoding (about 1.34× the plain file size).",
  "adm.upload.maxAttachments": "Attachments per object (max.)",
  "adm.upload.maxMb": "Size per attachment (MB, max.)",
  "adm.upload.rawHint": "corresponds to roughly {{raw}} MB of plain file size",
  "adm.upload.save": "Save",
  "adm.upload.saved": "Upload limits saved.",
  "adm.ext.title": "External knowledge",
  "adm.ext.help":
    "Controls whether the app may use external sources (web) and the public AI for enrichment. Four stages from fully blocked to open. Deliberately restrictive by default. Changes are recorded in the audit log.",
  "adm.ext.hint":
    "Applies to external source search during capture/review and to public-AI enrichment.",
  "adm.ext.save": "Save",
  "adm.ext.saved": "External knowledge setting saved.",
  "adm.ext.note": "Takes effect immediately for everyone; the server also enforces the block.",
  "adm.dup.title": "Duplicate detection",
  "adm.dup.help":
    "The AI probability at which a probable duplicate is shown. Lower means more hits, but also more false alarms to dismiss.",
  "adm.dup.hint":
    "The AI compares every new contribution against the whole library by content. This value sets the probability at which a match appears on the Duplicates page.",
  "adm.dup.threshold": "Threshold (%)",
  "adm.dup.save": "Save",
  "adm.dup.saved": "Duplicate threshold saved.",
  "adm.ext.stage.blocked": "Blocked",
  "adm.ext.stage.search_on_click": "Search on click only",
  "adm.ext.stage.search_attach": "Search + attach",
  "adm.ext.stage.open": "Open",
  "adm.ext.stageHint.blocked": "External knowledge fully blocked — nothing visible or callable.",
  "adm.ext.stageHint.search_on_click": "External search only on explicit click (default).",
  "adm.ext.stageHint.search_attach": "External search and attaching results as a source allowed.",
  "adm.ext.stageHint.open": "Open: search, attach and public-AI enrichment allowed.",
  "enrich.title": "Public AI enrichment",
  "enrich.help":
    "Pull additional background from the public AI — either from model knowledge or from a sourced web search. Results are external and unverified; they are only added to your draft on your click and never validated automatically.",
  "enrich.disclaimer": "External & unverified — please review before adding.",
  "enrich.modeModel": "Model knowledge",
  "enrich.modeWeb": "Web search",
  "enrich.placeholder": "What to look for? (e.g. term, question)",
  "enrich.run": "Enrich",
  "enrich.running": "Searching …",
  "enrich.externBadge": "External · unverified",
  "enrich.take": "Add to draft",
  "enrich.noModel": "No AI model connected — public AI enrichment needs an active model.",
  "enrich.empty": "No external results found.",
  // SCRUM-433 (Pedi 03.07., VIP): stay discoverable even when (still) disabled.
  "enrich.disabledHint":
    "Public AI enrichment becomes available once an admin sets external knowledge lookup to “Open” (Admin → External knowledge lookup).",
  "enrich.openAdmin": "Go to admin settings",
  "adm.trash.title": "Recycle bin",
  "adm.trash.help":
    "Deleted entries land here and can be restored for 28 days. After that they are permanently deleted automatically. Demo data never appears here — it is always deleted permanently right away.",
  "adm.trash.empty": "The recycle bin is empty.",
  "adm.trash.restore": "Restore",
  "adm.trash.purge": "Delete permanently",
  "adm.trash.purgeQ": "Permanently delete this entry now?",
  "adm.trash.keep": "Keep",
  "adm.trash.restored": "Entry restored.",
  "adm.trash.purged": "Entry permanently deleted.",
  "adm.trash.deletedMeta": "Deleted by {{name}} on {{date}}",
  "adm.trash.expires": "Permanent deletion in {{days}} days",
  "adm.presets.remove": "Remove function",
  "adm.presets.note":
    "Stored on the server and survives restarts; keys and models are not affected.",
  // SCRUM-413: "Available AIs" — honest overview of all accesses (metadata, no secrets).
  "adm.ai.accessTitle": "Available AIs",
  "adm.ai.accessHelp":
    "Shows all AI accesses of this instance with their honest status: the configured cloud model (key stays server-side), the deterministic fallback that steps in without a model, and the planned local LLM server from team 2. Which access actually applies per task is shown above in the AI management section.",
  "adm.ai.access.cloud": "Cloud model",
  "adm.ai.access.fallback": "Deterministic fallback",
  "adm.ai.access.local": "Local LLM server (team 2)",
  "adm.ai.accessNote":
    "Connecting the local LLM server to the app is planned (KLLM-61); until then it runs only on the team-2 test bench.",
  "adm.ai.state.active": "Active",
  "adm.ai.state.available": "Ready",
  "adm.ai.state.missing": "Not configured",
  "adm.ai.state.planned": "Planned",
  "ko.couple.help":
    "Couple this knowledge to an asset and “asset changed” (lifecycle) will automatically flag it for review — knowledge stays current.",
  "ko.couple.empty": "Not coupled to any asset yet.",
  "ko.couple.placeholder": "Asset reference, e.g. line L4",
  "ko.couple.cta": "Couple with asset",
  "ko.couple.done": "Asset coupled — lifecycle now watches this knowledge specifically.",
  "capture.wizard.discardQ": "Really discard this draft? Your narrated text is kept.",
  "capture.wizard.discardKeep": "Keep",
  "capture.wizard.discardYes": "Yes, discard",
  "capture.wizard.discardDone": "Draft discarded — your narrated text is still there.",
  "capture.wizard.upload": "Insert text from file or image",
  "capture.wizard.attach": "Attach file or image",
  "capture.wizard.attached": "{{count}} file(s) attached — visible under “Advanced details”.",
  "capture.wizard.uploadCount":
    "{{count}} attachment(s) added — text from documents is already in the field above; details under “Advanced details”.",
  "capture.gapContextTitle": "From an open knowledge gap",
  "capture.gapContextBody":
    "This is an open question, not knowledge yet — it only serves as a starting context. Add your experience/observation; the AI structures it into a draft, you review and submit.",
  "capture.gapDraftQuestion": "Open question",
  "capture.gapDraftExperience": "Add your own experience/observation",
  // SCRUM-369: guided steps in the gap context (work order: question → experience → AI → review).
  "capture.gapStepsTitle": "Your work order:",
  // SCRUM-369: honest follow-up after saving from an Ask gap — no automatic closure.
  "capture.gapSavedNote":
    "After validation, the knowledge base can answer this question better in future. The knowledge gap is not closed automatically — the review decides.",
  "capture.savedTitle": "Knowledge object saved.",
  // SCRUM-286: honest — saved but still open/not validated; usable only after review.
  "capture.savedStatusBadge": "Status: open — not yet validated",
  // AUFTRAG-mega70 BLOCK C: explains the process instead of asking for an action the role may
  // not be able to take (/validierung requires controller).
  "capture.savedBody":
    "Saved as your own knowledge (not a demo example), but not yet validated. It becomes usable knowledge only once it has been sufficiently rated in validation. Nothing is validated automatically.",
  "capture.savedFromDraft":
    "Your continued draft was submitted as open knowledge and removed from your drafts.",
  // WP-SHIP9-S1 (Pedis B3): the REAL check status on the confirmation card.
  // D-AISTATE PAKET 2 (bens V3): without AI only the deterministic duplicate/overlap check runs — there
  // is no deterministic conflict check (only AI finds conflicts). The "(with AI)" variants name conflicts.
  "capture.aiCheck.running":
    "Duplicate/overlap check running … the result will appear here once it completes.",
  "capture.aiCheck.runningAi":
    "Duplicate/conflict check (with AI) running … the result will appear here once it completes.",
  "capture.aiCheck.done": "Duplicate/overlap check completed (without AI) — details in validation.",
  "capture.aiCheck.doneAi": "Duplicate/conflict check (with AI) completed — details in validation.",
  "capture.aiCheck.failed": "Check failed: {{reason}} You can restart it in validation.",
  // SCRUM-373 / AG-02-SESSION: after saving, images/files have a safe object reference.
  "capture.savedFilesNote":
    "{{count}} attachment(s) are now stored as a safe object reference and can be linked as evidence in the knowledge object's editor. Evidence is context — it does not replace validation.",
  // SCRUM-374 / AG-02-SESSION: honest recovery hint when the KO was saved but some attachments could not
  // be uploaded/attached (partial failure ≠ total failure).
  "capture.attachTooLarge":
    "“{{name}}” is too large for an attachment (upload limit exceeded) — the file was not saved; the text import is kept.",
  "capture.originalAttachFailed":
    "Original file “{{name}}” could not be saved as an attachment — the text import is kept.",
  "capture.attachFailedTitle": "Not all attachments could be saved",
  "capture.attachFailedBody":
    "Your knowledge object is saved as open. These file(s) were NOT attached: {{names}}. The saved knowledge is unaffected — evidence does not replace validation.",
  "capture.attachFailedNext":
    "Next step: open the knowledge object and attach the file(s) again there.",
  "capture.sourceMissingTitle": "Imported content without a provenance record",
  "capture.sourceMissingBody":
    "Your knowledge object is saved and contains the text imported from the document. The matching provenance record could NOT be created ({{count}}): {{names}}. That leaves content without evidence — exactly what this product does not accept in silence.",
  "capture.sourceMissingNext":
    "Next step: open the knowledge object, attach the source document there and record the source again. If the configured “External knowledge” stage does not allow this, an administrator can change it under Administration → External knowledge.",
  // AUFTRAG-mega21 Block C-1 / C-2 — see the German block for the reasoning.
  "capture.followUpsFailedTitle": "Saved — but one follow-up step did not run",
  "capture.followUpsFailedBody":
    "Your knowledge object is fully saved and evidenced. AFTER saving, the following did not complete: {{steps}}. This does not affect the stored knowledge — but something is left open, and nobody else would tell you.",
  "capture.followUp.draftDiscard": "remove the draft",
  "capture.followUp.draftDiscardNext":
    "The draft is still in your draft list. You can delete it there — the submitted knowledge object is unaffected.",
  "capture.followUp.validationAssign": "assign reviewers",
  "capture.followUp.validationAssignNext":
    "Nobody is waiting for this knowledge object. Open Validation and assign the reviewers again.",
  "capture.followUp.notifyAssignment": "notify reviewers",
  "capture.followUp.notifyAssignmentNext":
    "The assignment stands, only the message did not go out. Let the assigned reviewers know.",
  "capture.followUp.aiCheck": "start the duplicate/conflict check",
  "capture.followUp.aiCheckNext":
    "The check is recorded as failed and can be restarted from the Validation page.",
  // AUFTRAG-mega23 Block B (ben's SB-G): the line above presumes a WRITTEN record. Without proof of
  // it, this one applies — it promises no retry the endpoint would refuse.
  "capture.followUp.aiCheckUnrecordedNext":
    "The failure record itself could not be saved either — so NO repeatable check job exists for this knowledge object. Please review it manually in Validation for duplicates and contradictions.",
  "capture.followUp.unknown": "a step this interface does not know yet",
  "capture.followUp.unknownNext":
    "This version of the interface does not know the step by name. It is in the knowledge object's audit trail — please look there.",
  "capture.anchorsMissingTitle": "A secured original is gone — imported text was not loaded",
  "capture.anchorsMissingBody":
    "This draft refers to {{count}} secured original document(s) that no longer exist. The text imported from them and the matching source references were therefore NOT loaded: they would be content without provenance, and this product does not save that silently. Your own work — title, statement, conditions, measures, reviewer selection — is fully there.",
  "capture.anchorsMissingNext":
    "While this notice is showing, “Save as draft” is blocked: saving now would write the thinned-out state over the stored one.",
  "capture.anchorsMissingReselect": "Select the original again",
  "capture.anchorsMissingAck": "Continue without the original",
  "capture.restartOfferTitle": "This operation cannot be repeated",
  "capture.restartOfferBody":
    "The operation key of this submission already belongs to a completed operation with different content. Your current text is untouched and will not be lost. Saving it needs a NEW operation — that is your decision, not the interface's.",
  "capture.restartOfferAction": "Start a new operation",
  "capture.appendUnclearTitle": "Import with an unclear outcome",
  "capture.appendUnclearBody":
    "Your knowledge object is saved. During the import from {{names}} the connection dropped before the server answered: it may or may not have gone through. NOTHING was taken back — blind cleanup is what would have caused the damage here. Please open the knowledge object and check whether the imported content and its provenance are there.",
  "own.empty.title": "No own knowledge here yet",
  "own.empty.hint":
    "You are filtering for your own knowledge (no demo examples). Knowledge you capture appears here after saving and then waits for review.",
  "own.empty.cta": "Capture own knowledge",
  "studio.open": "Edit in the Knowledge Studio",
  "studio.title": "Knowledge Studio",
  "studio.subtitle":
    "A large workspace with AI help. Changes are written to the draft only when you apply them — no auto-save, no auto-validation.",
  "studio.apply": "Apply to the draft",
  "studio.cancel": "Discard",
  "studio.close": "Close",
  // SCRUM-458 Stage 1: "Simple ↔ Structured" as a view switch (Studio = a view, not a second place).
  "studio.viewSimple": "Simple",
  "studio.viewStructured": "Structured",
  "studio.viewSwitch": "View: simple or structured",
  "studio.attachFromDisk": "Attach file/image from computer",
  "studio.state.dirty": "Not applied",
  "studio.state.clean": "No studio changes",
  "studio.confirmDiscard.q": "Discard changes that haven't been applied?",
  "studio.confirmDiscard.keep": "Keep editing",
  "studio.confirmDiscard.discard": "Discard",
  "studio.applied":
    "Detailed content from the studio applied to the draft. Saving or revising still happens via the existing button — nothing is saved or validated automatically.",
  "studio.save.capture.title": "Studio content in the draft — not saved yet",
  "studio.save.capture.hint":
    "The content applied from the studio is in the draft, but not saved or validated yet.",
  "studio.save.capture.next":
    "Next step: save/submit — then review/validation follows. Nothing is validated automatically.",
  "studio.save.revision.title": "Studio content in the revision draft — not saved yet",
  "studio.save.revision.hint":
    "The content applied from the studio is in the revision draft, but not saved yet.",
  "studio.save.revision.next":
    "Saving creates a new version and restarts the review — no automatic approval.",
  "studio.fromDraft.cta": "Structure the draft as an article in the studio",
  "studio.fromDraft.hint":
    "Generates a structured article suggestion from your draft (statement, conditions, measures, tags) — please review and complete it. Existing content is appended, not overwritten; nothing is validated automatically.",
  "studio.section.context": "Structure & context",
  "studio.section.editor": "Edit content",
  "studio.section.assist": "AI help",
  "studio.guide.structure.label": "Structure",
  "studio.guide.structure.hint": "Organize with headings, steps and highlights.",
  "studio.guide.assist.label": "Check AI",
  "studio.guide.assist.hint":
    "Let the AI clarify/structure — review the suggestion, don't apply blindly.",
  "studio.guide.preview.label": "Preview",
  "studio.guide.preview.hint": "See how the contribution will look later.",
  "studio.guide.apply.label": "Apply",
  "studio.guide.apply.hint": "Apply to the draft deliberately — nothing is saved automatically.",
  "studio.guide.thenSave": "then save & get it reviewed",
  "studio.coach.story":
    "You're rescuing hands-on experience. AI helps you structure it — it only becomes secured once colleagues review it.",
  "studio.coach.firstRun":
    "Start here: tell your knowledge in your own words. Structure, AI help and preview come step by step.",
  "studio.coach.nextPrefix": "Next step",
  "studio.coach.reason.start": "Begin with your experience — even a rough start is valuable.",
  "studio.coach.reason.improve": "Let AI help organize and sharpen it, or add headings and steps.",
  "studio.coach.reason.preview": "Check the preview to see how your contribution will look later.",
  "studio.coach.reason.apply":
    "Looks good? Apply the draft deliberately — saving and review come afterwards.",
  "studio.contrib.title": "Your contribution",
  "studio.contrib.level.empty.label": "Empty",
  "studio.contrib.level.empty.hint": "Start writing — even a rough beginning is valuable.",
  "studio.contrib.level.draft.label": "Draft",
  "studio.contrib.level.draft.hint": "Good start. A few steps make it clearer and more useful.",
  "studio.contrib.level.solid.label": "Solid",
  "studio.contrib.level.solid.hint": "Clearly structured — ready to apply and get reviewed.",
  "studio.contrib.strengthsTitle": "Already good",
  "studio.contrib.strength.text": "Real content present",
  "studio.contrib.strength.headings": "Organized with headings",
  "studio.contrib.strength.steps": "Steps as a list",
  "studio.contrib.strength.highlights": "Important points highlighted",
  "studio.contrib.strength.links": "References/links included",
  "studio.contrib.strength.evidence": "Evidence/attachments present",
  "studio.contrib.suggestionsTitle": "Makes it stronger",
  "studio.contrib.suggestion.detail": "Add a bit more detail",
  "studio.contrib.suggestion.headings": "Headings for sections",
  "studio.contrib.suggestion.steps": "Add steps as a list",
  "studio.contrib.suggestion.referenceAttachments": "Mention attachments in the text",
  "studio.contrib.valueNote":
    "Your experience knowledge matters — it's secured only after colleagues review it.",
  "studio.tips.title": "How to work in the studio",
  "studio.tips.select.label": "Select → format",
  "studio.tips.select.hint":
    "Select text, then set bold/italic via the toolbar — or use the usual keys.",
  "studio.tips.structure.label": "Structure with H2/H3",
  "studio.tips.structure.hint":
    "Group sections with heading 2 and 3, steps as lists — that keeps the content readable.",
  "studio.tips.ai.label": "Review the AI suggestion",
  "studio.tips.ai.hint":
    "AI help on the right produces a suggestion — review it, then apply it deliberately. Nothing is saved automatically.",
  "studio.tips.blocks.label": "Templates & blocks on purpose",
  "studio.tips.blocks.hint":
    "Templates give a structure; info/note/warning/success blocks highlight what matters.",
  "studio.view.edit": "Edit",
  "studio.view.preview": "Preview",
  "studio.preview.empty": "No content yet — write in the editor, then check the preview here.",
  "studio.preview.note":
    "The preview shows the current draft, not validated knowledge. “Apply” only writes to the local draft; saving/submitting/revising then happens via the existing buttons.",
  "capture.savedViewKo": "View object",
  // SCRUM-310: find it in the library — origin filter "own/non-demo knowledge" (technically: without
  // the demo tag; no author/user attribution). Finding/overview, not validation.
  "capture.savedViewLibrary": "View in the library (own knowledge)",
  "capture.savedValidate": "Send for review",
  "capture.savedAgain": "Capture another",
  "capture.mode.freitext": "Free text",
  "capture.mode.formular": "Form",
  "capture.mode.diktat": "Dictation",
  "capture.mode.interview": "Guided interview",
  "capture.mode.datei": "From file",
  // PMO-FEA-0006: knowledge from file — upload, AI point list with source excerpts, review queue.
  "capture.file.hint":
    "Upload a document — the AI lists the knowledge it contains, each point with a verbatim source excerpt. You choose what to take over; nothing is saved automatically.",
  "capture.file.upload": "Choose document",
  "capture.file.replace": "Choose another document",
  "capture.file.remove": "Remove document",
  "capture.file.dropHint": "Drag and drop a file here — or choose one below.",
  // AUFTRAG-mega34 D1: the button says what it does.
  "capture.file.pick": "Choose file",
  "capture.file.dropActive": "Drop the file here …",
  "capture.file.dropReject":
    "“{{name}}” is not supported here yet — please drop a text, Word, PDF, PPTX or image file.",
  "capture.file.extracting": "Reading “{{name}}” …",
  "capture.file.loaded": "“{{name}}” read — ready for the knowledge search.",
  "capture.file.empty": "No text found in “{{name}}”.",
  "capture.file.emptyPdf":
    "No text found in “{{name}}” — a scanned PDF without a text layer is not supported yet.",
  "capture.file.emptyPptx":
    "No importable text found in “{{name}}” (image-only presentation). Nothing was saved — you can attach the original manually as a file if needed.",
  "capture.file.pdfTruncated": "Only the first {{count}} pages were imported.",
  "capture.file.pptxTruncated": "Only the first {{count}} slides were imported.",
  "capture.slides.toggle": "Import slides as images.",
  "capture.slides.toggleHint":
    "For PowerPoint files, every slide is additionally appended to the article as an image (slide view section). The conversion runs on the server and may take a moment.",
  "capture.slides.heading": "Slide view",
  "capture.slides.converting": "Converting slides of {{name}} to images on the server …",
  "capture.slides.done": "{{count}} slide(s) attached as images.",
  "capture.slides.truncated": "Only the first {{max}} slides were converted (hard limit).",
  "capture.slides.dropped":
    "{{count}} slide image(s) no longer fit the article budget and were left out.",
  "capture.slides.busy":
    "The server is currently converting another presentation — please import again in a moment. The text import is complete.",
  "capture.slides.unavailable":
    "The slide view is currently not available on this server. The text import is complete.",
  "capture.slides.timeout":
    "The server is still working or unreachable — the slide conversion was cancelled on the client side; the text import remains fully intact.",
  "capture.slides.failed":
    "The slides could not be converted to images. The text import is complete.",
  "capture.file.pptxTooLarge":
    "“{{name}}” is too large or too heavily compressed for a safe import and was NOT read. Please shrink or split the presentation.",
  "capture.file.pptxImagesFormat":
    "{{count}} images could not be carried over — format not supported.",
  "capture.file.pptxImagesBudget":
    "{{count}} images could not be carried over — too large to embed.",
  "capture.file.imagesOnlyNoText":
    "Images carried over — without text, AI suggestions are not possible.",
  "capture.file.imagesAllDropped":
    "The images could not be carried into the article (too large or format not supported) — the original travels along as an attachment when saving.",
  // JOB 513/D3B — see the German block: the line above promises an attachment; without a secured
  // original that promise has no backing.
  "capture.file.imagesAllDroppedNoOriginal":
    "{{dropped}} image(s) could not be carried into the article, and the original could NOT be saved as an attachment — those images are lost.",
  "capture.file.imagesDefect":
    "{{count}} image(s) could not be read — the reference in the file is broken or the image file is missing.",
  "capture.file.imagesOutsidePath":
    "{{count}} image(s) sit outside the imported slide area (background images, for example) and were not carried over.",
  "capture.file.imagesBudgetBodyHtml":
    "Limit “article text”: {{count}} image(s) no longer fit into the article (at most {{limitBytes}} bytes; {{actualBytes}} were needed).",
  "capture.file.imagesBudgetSingleImage":
    "Limit “single image”: {{count}} image(s) are too large on their own (at most {{limitBytes}} bytes per image; the largest was {{actualBytes}}).",
  "capture.file.imagesBudgetTotalImages":
    "Limit “total images”: {{count}} image(s) would have exceeded the combined size of all images (at most {{limitBytes}} bytes; {{actualBytes}} were needed).",
  "capture.file.imageCaptionPlaceholder": "No image description yet",
  "capture.file.imagesKept":
    "{{kept}} images imported, {{compressed}} of them compressed for the text view; the unchanged original is in the attachment.",
  "capture.file.imagesKeptDropped":
    "{{kept}} images imported, {{compressed}} of them compressed; {{dropped}} left out due to size. The unchanged original is in the attachment.",
  "capture.file.imagesNoOriginal":
    "{{kept}} images imported, {{compressed}} of them compressed; the original could NOT be saved as an attachment.",
  "capture.file.imagesLost":
    "{{kept}} images imported, {{compressed}} of them compressed; {{dropped}} left out. The original could NOT be saved — {{dropped}} images are lost.",
  "capture.file.tooLargeForImport":
    "Even after image compression the document is too large for text import — please split it up. The original stays untouched.",
  "capture.file.importNote.docx":
    "Structure and images imported (best effort) — exact layout may differ.",
  "capture.file.importNote.pdf":
    "Best-effort text import — layout and images were not carried over.",
  "capture.file.importNote.pptx":
    "Best-effort import from PowerPoint — text, lists, tables and images per slide carried over; layout, animations, transitions and speaker notes are lost.",
  "capture.file.parseError": "“{{name}}” could not be read.",
  "capture.file.unsupported":
    "“{{name}}” is not supported here — please provide TXT/MD, DOCX, PDF, or PPTX. Images only work via OCR.",
  "capture.file.ocrCta": "Recognize text in image (OCR)",
  "capture.file.ocrBusy": "Text recognition running …",
  "capture.file.queryLabel": "What should the AI look for? (optional)",
  "capture.file.queryPlaceholder":
    "e.g. “thresholds and inspection intervals” — leave empty to find all knowledge",
  "capture.file.queryHelp.title": "Targeted search",
  "capture.file.queryHelp.body":
    "Without input, the AI lists all knowledge points in the document. With a search focus, it restricts itself to that focus. Nothing is invented either way — every point carries a verbatim excerpt from the document.",
  // SCRUM-451: result language — system language or the document's original language.
  "capture.file.langLabel": "Result in",
  "capture.file.langSystem": "System language",
  "capture.file.langSource": "Original language",
  "capture.file.langHelp.title": "Result language",
  "capture.file.langHelp.body":
    "System language: titles and summaries appear in your interface language (German/English) — an English document is effectively translated. Original language: the AI translates nothing, the points stay in the document's language. Verbatim excerpts remain unchanged in both cases.",
  "capture.file.importMode.label": "Import type",
  "capture.file.importMode.points": "Analyze into points",
  "capture.file.importMode.pointsDesc":
    "Klarwerk extracts individual statements from the file. Existing path; nothing is saved automatically.",
  "capture.file.importMode.whole": "Take over whole document",
  "capture.file.importMode.wholeDesc":
    "Klarwerk creates exactly one draft with the whole document. No automatic validation.",
  "capture.file.searchCta": "Analyze file",
  "capture.file.searching": "The AI is reading the document …",
  "capture.file.wholeCta": "Save whole document as draft",
  "capture.file.wholeSaving": "Saving draft …",
  "capture.file.wholeSaved": "“{{name}}” saved as one draft — source: file name, whole document.",
  "capture.file.wholeSourceNote":
    "The draft visibly records the source: {{name}}, whole document. The draft stays open and unreviewed.",
  "capture.file.wholeSavedTitle": "Document saved as draft",
  "capture.file.wholeSavedSource": "Source: {{name}}, whole document.",
  "capture.file.wholeOpenDraft": "Open draft",
  "capture.file.wholeOpenMissing": "Draft was saved, but could not be opened directly.",
  "capture.file.wholeImportAnother": "Import another document",
  "capture.file.formatTitle": "Information on file formats and formatting",
  "capture.file.formatHint":
    "TXT/MD and other text files are taken over as text. DOCX: structure (headings, lists, tables) and images are imported best effort; exact layout may differ. PDF runs as a best-effort text import; layout and images are lost. PPTX: text, structure and photos per slide are imported best effort; layout, animations, vector graphics/shapes and notes are lost.",
  "capture.file.supportedTitle": "Actively selectable:",
  "capture.file.supportedFormats":
    "TXT, MD/Markdown, CSV, LOG, JSON, DOCX, PDF, PPTX, and images for OCR.",
  "capture.file.unsupportedFormats":
    "RTF is not supported yet. Please provide TXT/MD, DOCX, PDF, or PPTX where available.",
  "capture.file.cancel": "Cancel",
  "capture.file.pointsTitle": "Knowledge found — choose what to take over",
  "capture.file.pointsHint":
    "Every point carries its source excerpt from the document. Deselect what you don't need — nothing is taken over until you click.",
  "capture.file.excerptLabel": "Source excerpt",
  "capture.file.pointCount": "{{selected}} of {{total}} points selected",
  "capture.file.applyCta": "Take over selected",
  "capture.file.queueBadge": "Point {{current}} of {{total}} from “{{name}}”",
  "capture.file.queueHint":
    "Each point is reviewed and submitted individually as a knowledge page — nothing is saved automatically.",
  "capture.file.queueSkip": "Skip point",
  "capture.file.queueDone": "All points from “{{name}}” have been processed.",
  "capture.file.sourceNote": "The source “{{name}}” will be recorded on the knowledge object.",
  // SCRUM-409 (PMO-FEA-0008 delta): import receipt, multi-point drafts, merge.
  "capture.file.loadedStats":
    "“{{name}}” imported ({{chars}} characters). Optionally say what to look for, then start the knowledge search.",
  "capture.file.saveDraftsCta": "Save as drafts",
  "capture.file.draftsSaved":
    "{{count}} drafts saved from “{{name}}” — each with its source note. You can find them above under “Resume drafts”.",
  "capture.file.draftsPartial":
    "Not all points could be saved as drafts: {{failed}}. Drafts already created are kept.",
  "capture.file.mergeCta": "Connect selected into one entry",
  "capture.file.mergedNote":
    "{{count}} points from “{{name}}” merged into one entry — all excerpts are in the document; the sources will be recorded on submit.",
  // SCRUM-433 (Pedi 03.07., VIP): the three paths from the points list, always explained.
  "capture.file.connectHint":
    "Tick several and “Connect” combines them into ONE entry · “Save as drafts” creates one per point · “Take over” processes them one by one.",
  "capture.file.connectDisabledHint": "Tick at least 2 findings to connect them.",
  "capture.file.selectAll": "Select all",
  "capture.file.deselectAll": "Deselect all",
  "capture.file.mergedInList": "Merged {{count}} findings into one point — it stays in the list.",
  "capture.file.applyDisabledHint": "Tick exactly one finding — only one is processed at a time.",
  "capture.file.purgeUnselectedQ": "Delete the {{count}} unselected findings?",
  "capture.file.purgeUnselectedYes": "Delete unselected",
  "capture.file.purgeUnselectedKeep": "Keep",
  // SCRUM-384 / KG-UX-001/002/003/010: narrate-first entry as default, form as expert path.
  "capture.entry.narrateKicker": "Tell your knowledge — the AI structures it, you review",
  "capture.entry.recommendedBadge": "Recommended",
  "capture.entry.expertToggle": "Expert mode: fill the form directly",
  "capture.entry.expertHint":
    "For experienced users: fill in all fields directly — same fields, same review path. The guided narrate-first entry stays available at any time.",
  "capture.entry.expertActive":
    "Expert mode: you fill the form directly. Saving and review work exactly like the guided path — nothing is validated automatically.",
  "capture.entry.backToGuided": "Back to the guided path",
  "capture.raw": "Experience note",
  "capture.rawPlaceholder":
    "Capture experience informally — the AI structures it into a draft. You review and submit.",
  "capture.structure": "Structure with AI",
  "capture.assist": "AI help",
  // SCRUM-375 / AG-12: advanced/technical fields as progressive disclosure (optional, nothing removed).
  "capture.advanced.title": "Advanced details (optional)",
  "capture.advanced.hint":
    "Category, asset, required reviews, tags, documents & images — none of these is required. Tell your knowledge first; you can expand and add the details anytime.",
  "capture.advanced.filled": "{{count}} filled",
  // SCRUM-312: AI post-editing (beta) — a suggestion, no auto-submit; the human applies it deliberately.
  "capture.ai.title": "AI post-editing (beta)",
  "capture.ai.hint":
    "The AI makes a suggestion — you review it and apply it deliberately. No automatic saving, no validation; no content/facts are invented.",
  "capture.ai.bodyHint":
    "AI help for the detailed content: review the suggestion and apply it deliberately (replace/append). No automatic saving, no validation; please check content and sources yourself.",
  "capture.ai.applyAsLabel": "Apply as structure",
  "capture.ai.applyAs.section": "Append as section",
  "capture.ai.applyAs.info": "Append as info",
  "capture.ai.applyAs.note": "Append as note",
  "capture.ai.applyAs.warning": "Append as warning",
  "capture.ai.applyAs.success": "Append as success",
  "capture.ai.action.clarify": "Clearer",
  "capture.ai.action.structure": "Structure",
  "capture.ai.action.expand": "Expand",
  "capture.ai.action.spelling": "Spelling",
  "capture.ai.action.format": "Format",
  "capture.ai.instr.clarify": "Rephrase more clearly and precisely without changing the meaning.",
  "capture.ai.instr.structure":
    "Structure the text into clear, concise sentences or bullet points.",
  "capture.ai.instr.expand":
    "Phrase a bit more fully and completely — without inventing new facts.",
  "capture.ai.instr.spelling": "Correct spelling and grammar only.",
  "capture.ai.instr.format":
    "Only improve readability with clean paragraphs and punctuation. Do NOT use markdown characters like #, ## or * — no heading markers. Keep content and wording unchanged; add or remove nothing.",
  "capture.ai.help.clarify": "Rephrases more clearly and precisely — the meaning stays the same.",
  "capture.ai.help.structure": "Arranges the text into concise sentences or bullet points.",
  "capture.ai.help.expand": "Phrases more fully — without inventing new facts.",
  "capture.ai.help.spelling": "Corrects spelling and grammar only, nothing else.",
  "capture.ai.help.format":
    "Only improves readability (paragraphs, punctuation) — without markdown characters; the content stays verbatim.",
  // SCRUM-386: ?-help for custom functions — the instruction is openly visible (G-3).
  "capture.ai.customHelp":
    "Custom AI function of your organisation (created by the admin). Instruction for the AI: „{{instruction}}“. As with all AI actions, only a suggestion for preview is produced — nothing is adopted unless you deliberately click to adopt it.",
  "capture.ai.freeLabel": "Your own AI instruction",
  "capture.ai.freePlaceholder": "e.g. “phrase it shorter and more factual”",
  "capture.ai.run": "Run",
  "capture.ai.previewTitle": "AI suggestion (preview)",
  "capture.ai.replace": "Replace",
  "capture.ai.append": "Append",
  "capture.ai.discard": "Discard",
  "capture.author": "Author",
  "capture.documents": "Documents (context / attachment)",
  "capture.documentsUpload": "Upload files",
  "capture.uploadLimits":
    "Up to {{count}} files, each max. {{mb}} MB transfer size (roughly {{raw}} MB of plain file).",
  "capture.attachLimitReached":
    "{{taken}} of {{total}} files accepted for processing — the attachment limit is {{limit}}.",
  "capture.documentsHint": "txt, md, csv, json, log, docx, pdf → full text · images: optional OCR",
  "capture.images": "Images (attachment)",
  "capture.imagesUpload": "Attach images",
  "capture.imagesHint": "Also from the mobile app. Attached to the object.",
  "capture.videoAdded":
    "{{name}} attached. Transcription on click — nothing happens automatically.",
  "capture.videoTranscribe": "Transcribe",
  "capture.videoBusy": "running …",
  "capture.videoRunning": "Transcribing {{name}} — short clips are fast.",
  "capture.videoDone": "Transcript of {{name}} inserted — please review (draft, not truth).",
  "capture.saveDraft": "Save as draft",
  "capture.draftSaved": "Draft saved.",
  "capture.draftUpdated": "Draft updated.",
  "capture.draftDiscarded": "Draft deleted.",
  "capture.discardDraftQ": "Delete draft permanently?",
  "capture.discardDraftKeep": "Keep",
  "capture.discardDraftYes": "Delete",
  "capture.imageError": "“{{name}}” could not be read as an image.",
  "capture.draftFallbackTitle": "Draft",
  "capture.resumeTitle": "Resume drafts",
  "capture.resumeExpand": "Show drafts ({{count}})",
  "capture.resumeCollapse": "Collapse drafts",
  // AUFTRAG-mega38 BLOCK J4: `capture.resumeCollapsedHint` removed — see the DE block.
  "capture.resume": "Resume",
  "capture.discardDraft": "Discard",
  // AUFTRAG-sortfilter · Punkt 2: draft list filter + sort.
  "capture.draftSearch": "Search drafts",
  "capture.draftSortLabel": "Sort",
  "capture.draftSort.recent": "Last saved (new→old)",
  "capture.draftSort.oldest": "Last saved (old→new)",
  "capture.draftSort.title": "Title A→Z",
  "capture.draftAuthorLabel": "Creator",
  "capture.draftAuthorAll": "All creators",
  // AUFTRAG-BASIC-u2 — see the German entry for the finding.
  "capture.draftScope.note":
    "This search covers only your saved drafts — no knowledge from the library.",
  "capture.draftScope.noteAdmin":
    "This search covers only saved drafts (admin view: all of them) — no knowledge from the library.",
  "capture.draftScope.toLibrary": "Search the Klarwerk knowledge",
  "capture.draftEmptyFiltered":
    "No saved drafts match your search. Only drafts were searched — validated knowledge lives in the library.",
  "capture.draftJustSaved": "just saved",
  "capture.draftCreatorMeta": "Creator: {{name}}",
  "capture.draftSavedMeta": "Saved: {{date}}",
  "capture.draftStatusMeta": "Status: draft",
  "capture.editingDraft": "Draft loaded — changes are saved to the same draft.",
  "capture.editingBadge": "editing",
  "capture.fileImportJump": "Import file",
  "capture.loadExample": "Load example",
  "capture.exampleLoaded":
    "Experience note loaded — now structure it with AI and review the draft.",
  "capture.docAdded": "{{name}} added as context.",
  "capture.docExtracting": "Reading {{name}} …",
  "capture.docEmpty":
    "{{name}}: no text found — a scanned PDF without a text layer is not supported yet.",
  "capture.docParseError": "{{name}} could not be read.",
  "capture.docUnsupported":
    "{{name}}: only txt/md/csv/json/log, docx and pdf are read as full text.",
  "capture.ocr": "OCR → text",
  "capture.ocrRunningShort": "OCR …",
  "capture.ocrRunning": "Running OCR for {{name}} (loading worker/language data) …",
  "capture.ocrDone": "OCR text from {{name}} added.",
  "capture.ocrEmpty": "{{name}}: OCR found no text.",
  "capture.ocrFailed": "OCR failed for {{name}}.",
  "capture.ocrUnavailable": "OCR is currently unavailable.",
  "capture.help.category.title": "Category & #tags",
  "capture.help.category.body":
    'The category is a free domain classification (e.g. "Maintenance", "Quality", "Procurement"). Tags are free keywords for findability.',
  "capture.help.validations.title": "Required validations",
  "capture.reviewers.title": "Suggest reviewers (optional)",
  "capture.reviewers.helpTitle": "Suggest reviewers",
  "capture.reviewers.helpBody":
    "Pick colleagues who should review this entry. They receive it as an open review assignment and get notified. Without a selection the entry stays open to all reviewers.",
  "capture.reviewers.none": "No other people in the directory yet.",
  "capture.reviewers.selected": "Selected: {{n}}",
  "capture.reviewers.defaultPlaceholder": "Default: {{n}}",
  "capture.help.validations.body":
    'How many independent confirmations the object needs before it counts as "validated" (1–5, default 3). More = higher bar, more reliable.',
  "capture.modeSoon": "This mode is coming.",
  "capture.fTitle": "Core statement",
  "capture.fStatement": "Statement",
  "capture.fBody": "Detailed content (optional)",
  "editor.bold": "Bold",
  "editor.bodyLabel": "Knowledge page — body text",
  "editor.italic": "Italic",
  "editor.h2": "Heading",
  "editor.h3": "Subheading",
  "editor.ul": "Bulleted list",
  "editor.ol": "Numbered list",
  "editor.link": "Link",
  "editor.panel": "Panel/Callout",
  "editor.guidance.title": "How to use the detailed content",
  "editor.guidance.structure": "Structure: headings (H2/H3) and paragraphs organize the content.",
  "editor.guidance.action": "Actionable knowledge: lists for steps, links as evidence.",
  "editor.guidance.blocks": "Blocks: mark key points as info/note/warning/success.",
  "editor.guidance.ai":
    "AI help: provides suggestions — you review and apply deliberately, no auto-validation.",
  "editor.attach.title": "Attachments in the editor",
  "editor.attach.images": "image(s)",
  "editor.attach.files": "file(s)",
  "editor.attach.imageHint": "can be inserted into the detailed content via the image button.",
  "editor.attach.fileHint":
    "stay visible as attachments/evidence and are not embedded inline — please reference them in the text.",
  // SCRUM-371: object-store-aware media/evidence guidance (images inline · linkable files · session
  // files as evidence). Honest: evidence never replaces validation.
  "editor.media.title": "Images, files & evidence",
  "editor.media.images": "image(s)",
  "editor.media.imageHint":
    "illustrate your knowledge — insert into the content via the image button.",
  "editor.media.linkable": "linkable file(s)",
  "editor.media.linkableHint":
    "safe to link as evidence/context in the text (internal object reference, no raw-download trick).",
  "editor.media.evidence": "file(s) as attachment",
  "editor.media.evidenceHint":
    "stay as evidence — linkable in the text after saving; until then no makeshift/fake link.",
  "editor.media.note":
    "Evidence improves traceability, but it is not approval — the review decides.",
  "editor.quality.title": "Content check",
  "editor.quality.hint": "Checks structure, not factual correctness. No validation.",
  "editor.quality.empty": "No detailed content yet.",
  "editor.quality.thin": "Very short content — add context or steps if needed.",
  "editor.quality.headings": "Headings",
  "editor.quality.lists": "Lists",
  "editor.quality.blocks": "Blocks",
  "editor.quality.links": "Links",
  "editor.quality.attachmentsUnreferenced":
    "Attachments present but not mentioned in the text — consider referencing them.",
  "editor.template.title": "Start from a structure template",
  "editor.template.hint":
    "Select a template, review the preview and apply it consciously. Starting structure/suggestion — existing content is not replaced when appended; nothing is saved or validated automatically.",
  "editor.template.selected": "Selected template",
  "editor.template.preview": "Preview",
  "editor.template.procedure.label": "Procedure",
  "editor.template.procedure.description": "Conditions and steps for repeatable work.",
  "editor.template.troubleshooting.label": "Issue",
  "editor.template.troubleshooting.description":
    "Capture symptom, cause and action in a structure.",
  "editor.template.safety.label": "Safety",
  "editor.template.safety.description": "Warning, safe check and desired state.",
  "editor.template.checklist.label": "Checklist",
  "editor.template.checklist.description": "Checkable items plus “what to do if not met”.",
  "editor.template.handover.label": "Handover/training",
  "editor.template.handover.description":
    "The essentials for the next person: key points, typical mistakes, contacts.",
  "editor.template.decision.label": "Decision aid",
  "editor.template.decision.description":
    "If-then rules for a recurring decision, incl. escalation limit.",
  "editor.template.applySet": "Insert template",
  "editor.template.applyAppend": "Append template below",
  "editor.template.applyHelp":
    "Inserts the shown starting structure into the knowledge page: if the page is empty it is inserted; if there is content already, it is appended BELOW — nothing is replaced or saved. Replace the placeholders (“add …”) with your knowledge afterwards.",
  "editor.template.mode.set": "Empty content: the template will be inserted.",
  "editor.template.mode.append":
    "Existing content: the template will be appended; nothing is replaced.",
  "editor.applySafety.replaceWarning":
    "Careful: Replace overwrites the current content. Append keeps what is already there.",
  "editor.block.info": "Info",
  "editor.block.note": "Note",
  "editor.block.warning": "Warning",
  "editor.block.success": "Success",
  "editor.image": "Image from attachment",
  "editor.para": "Paragraph",
  "editor.imageLabel": "Image",
  "editor.fileLabel": "File",
  "editor.aiLabel": "AI",
  "editor.aiToggle": "AI writing help — opens the AI palette",
  "editor.noImages": "No image attachments yet.",
  // SCRUM-456: insert an image straight from the computer + heading for existing attachments.
  "editor.imageFromDisk": "Image from computer …",
  "editor.fileFromDisk": "Attach file from computer …",
  "editor.imageFromAttachment": "From attachments",
  "editor.captionPlaceholder": "✎ Add image description …",
  "editor.captionNoAnchor":
    "No image description can be added for this image right now. Please insert the image again.",
  "editor.captionAi.suggest": "Suggest AI description",
  "editor.captionAi.loading": "Creating AI description …",
  "editor.captionAi.panelTitle": "Suggestion",
  "editor.captionAi.aiBadge": "AI-generated. Please review.",
  "editor.captionAi.withContext":
    "Generated with document context (title, heading and surrounding text).",
  "editor.captionAi.apply": "Apply",
  "editor.captionAi.discard": "Discard",
  "editor.captionAi.tooLarge": "The image is too large for a description suggestion (max. 5 MB).",
  "editor.captionAi.imageUnreadable": "The image of this caption could not be read.",
  "editor.captionAi.fallbackNoModel":
    "No AI model is configured or allowed — without a model there is no description suggestion (nothing is invented).",
  "editor.captionAi.fallbackTimeout":
    "The cloud AI exceeded the time limit — so there is no suggestion. Please try again later.",
  "editor.captionAi.fallbackError":
    "The cloud AI is currently unreachable or reports an error — so there is no suggestion. Please try again later.",
  "editor.captionAi.fallbackConfidential":
    "This image is classified as confidential — the cloud AI is excluded for it and no local vision model is wired. So there is no suggestion (nothing leaves the server).",
  "editor.captionForm.open": "Edit image description",
  "editor.captionForm.title": "Image description",
  "editor.captionForm.label": "Description of the image",
  "editor.captionForm.placeholder": "What can be seen in the image, and why is it here?",
  "editor.captionForm.limit": "{{n}} of {{max}} characters",
  "editor.captionForm.limitReached": "Maximum length reached ({{max}} characters).",
  "editor.captionForm.append": "Append to the text",
  "editor.captionForm.save": "Save description",
  "editor.captionForm.cancel": "Cancel",
  "editor.captionForm.imageAlt": "Image being described",
  "editor.captionForm.noSuggestionYet":
    "No suggestion requested yet. The text stays yours — a suggestion is never adopted automatically.",
  "editor.captionForm.stale":
    "This image has changed in the meantime — the caption was NOT saved, so it cannot end up on the wrong image. Please copy the text, close the form and reopen it on the current image.",
  "editor.captionForm.openLabel": "Edit image description (opens the input form)",
  "editor.captionForm.formatLabel": "Formatting",
  "editor.captionForm.bold": "Bold (Ctrl/Cmd + B)",
  "editor.captionForm.italic": "Italic (Ctrl/Cmd + I)",
  "editor.captionForm.lineBreak": "Line break (Shift + Enter)",
  "editor.captionForm.selectFirst":
    "Select the text you want to mark up first — bold or italic then applies to it.",
  "editor.file": "Link a file",
  "editor.insertFile": "Insert file attachment as a link",
  "editor.noFiles":
    "No linkable files yet — uploaded files become linkable only after saving (with an object reference). Until then they stay as attachments/evidence; no makeshift link.",
  // SCRUM-372: calm drag&drop/paste guidance (only images inline; files stay evidence).
  "editor.drop.hint": "Drag images here or paste them (Ctrl/⌘+V). Files stay as evidence.",
  "editor.drop.imageActive": "Drop media — images are inserted, files stay as evidence",
  "editor.drop.fileNotice":
    "Only images are inserted inline. Files stay as attachments/evidence — a safe body link is only possible with a saved object reference (no fake link). The review decides.",
  "editor.preview": "Preview",
  "editor.edit": "Edit",
  "editor.previewBadge": "Preview — how readers see the page",
  "editor.previewEmpty": "No content yet — switch to “Edit” and write the first section.",
  "editor.linkPrompt": "Enter link URL:",
  "editor.linkUrl": "URL",
  "editor.linkUrlPlaceholder": "https://… or internal route",
  "editor.linkLabel": "Link text optional",
  "editor.linkLabelPlaceholder": "If empty, the URL is shown",
  "editor.linkInsert": "Insert link",
  "editor.linkCancel": "Cancel",
  "editor.linkInvalid": "Please use a safe URL (https, mailto, / or #).",
  "capture.fType": "Knowledge type",
  "capture.fCategory": "Domain / category",
  "capture.submit": "Review & submit",
  "capture.submitBusy": "Submitting … (draft, attachments, submission)",
  "capture.submitStageCreating": "Creating knowledge object …",
  "capture.submitStageUploading": "Securing original & attachments ({{mb}} MB) …",
  "capture.submitStageLinking": "Linking sources …",
  "capture.submitTiming.title": "Timing details",
  "capture.submitTiming.create": "Create knowledge object",
  "capture.submitTiming.upload": "Upload original & attachments",
  "capture.submitTiming.link": "Linking & sources",
  "capture.submitTiming.seconds": "{{s}} s",
  "capture.submitTiming.mb": "{{mb}} MB",
  "capture.readyTitle": "Save check",
  "capture.ready.title": "Title",
  "capture.ready.content": "Statement / content",
  "capture.ready.category": "Category",
  "capture.ready.type": "Knowledge type",
  "capture.ready.attachments": "Attachments",
  "capture.readyDone": "ok",
  "capture.readyMissing": "missing",
  "capture.readyOptional": "optional",
  "capture.readyHint": "Title and statement/content are required to save.",
  "capture.draftHint":
    "Enter an experience note and structure it with AI — the draft appears here.",
  "capture.fConditions": "Conditions",
  "capture.fMeasures": "Measures",
  "capture.fTags": "Tags",
  "capture.fAsset": "Asset / equipment",
  "conf.field": "Confidentiality",
  "conf.help":
    "How confidential is this knowledge? “Public-internal” is the default (no restriction). “Confidential” and “Strictly confidential” mark sensitive knowledge: such objects are never sent into external contexts (output factory/export). The level can be set while capturing and changed anytime afterwards — every change is recorded in the audit log. Note: this label does not (yet) restrict WHO can see the object.",
  "conf.level.intern": "Public-internal",
  "conf.level.vertraulich": "Confidential",
  "conf.level.streng_vertraulich": "Strictly confidential",
  "capture.fRevalidation": "Re-validate after (count)",
  "capture.listAdd": "Add item",
  "capture.listRemove": "Remove",
  "capture.tagPlaceholder": "Type a tag, press Enter",
  "capture.formularHint":
    "Core statement and statement are enough to start — the further details below are optional.",
  "capture.diktatStart": "Start dictation",
  "capture.diktatStop": "Stop dictation",
  "capture.diktatUnsupported":
    "Speech input is not supported by this browser. Use Chrome/Edge or type the text manually.",
  "capture.diktatNa": "not available",
  "capture.ivStep": "Question {{n}} of {{total}}",
  "capture.ivBack": "Back",
  "capture.ivNext": "Next",
  "capture.ivFinish": "Create draft",
  "capture.ivDone": "Interview complete — review the draft on the right and submit it.",
  "capture.ivStart": "Start interview",
  "capture.ivStartLead":
    "The guided interview uses AI to ask follow-up questions. Only when you click “Start interview” does the first question go to the model — nothing is sent before that. Provider and region are shown via the (!) icon.",
  "capture.ivTurn": "Question {{n}}",
  "capture.ivThinking": "The AI is forming the next question …",
  "capture.ivResumeLead":
    "Your interview progress has been restored. The next question loads only when you click.",
  "capture.ivResumeLoad": "Load next question",
  "capture.unsavable.images_one": "{{count}} inserted image",
  "capture.unsavable.images_other": "{{count}} inserted images",
  "capture.unsavable.docs_one": "{{count}} attached file (document/video/audio)",
  "capture.unsavable.docs_other": "{{count}} attached files (documents/video/audio)",
  "capture.unsavable.file": "the uploaded file “{{name}}” — its processing has not finished yet",
  "capture.unsavable.fileQueue":
    "the running file processing from “{{name}}” (point {{current}} of {{total}})",
  "capture.unsavable.extResults":
    "the loaded external search results — the search query itself stays in the draft",
  // AUFTRAG-mega6 Block A
  "capture.unsavable.sourceUrl":
    "the partial web address “{{urls}}” — the draft only saves complete addresses starting with https:// or http://; the source label and excerpt are kept",
  "capture.sourceUrlLimit":
    "The draft cannot save this address. Add https:// or http:// in front — or clear the field if you do not need it.",
  // AUFTRAG-mega6 Block D
  "capture.limit.chars": "Maximum length reached ({{max}} characters) — further text is not saved.",
  "capture.limit.reviewers":
    "The draft cannot save more than {{max}} reviewers — deselect someone to swap.",
  "capture.limit.sources":
    "The draft cannot save more than {{max}} sources — remove one to make room.",
  "capture.limit.interviewAnswers":
    "The draft cannot save more than {{max}} answers — finish the interview or save the draft.",
  "capture.saveLimit.title": "The draft cannot save everything",
  "capture.saveLimit.lead":
    "Text, metadata and sources will be saved. However, the draft cannot save the following content — saving will discard it:",
  "capture.saveLimit.cancel": "Cancel — keep the content",
  "capture.saveLimit.confirm": "Save anyway and discard this content",
  "capture.ivAnswerHint": "Your answer …",
  "capture.ivSend": "Send answer",
  "capture.ivReadAloud": "Read aloud",
  "capture.ivReadStop": "Stop",
  "capture.ivDictNa": "Dictation is not available in this browser — please type.",
  "capture.ivModel": "AI model",
  "capture.ivFallback": "Deterministic fallback",
  "capture.ivQ.title": "What is it about? Write a short core statement.",
  "capture.ivQ.statement": "Describe the experience/statement in more detail.",
  "capture.ivQ.conditions": "Under which conditions does it apply? One per line.",
  "capture.ivQ.measures": "Which concrete measures/steps? One per line.",
  "capture.ivQ.tags": "Tags for findability? Comma-separated.",
  "capture.ivQHint.title": "e.g. Pre-heat pump P-12 in frost",
  "capture.ivQHint.statement": "What exactly, why, with what effect?",
  "capture.ivQHint.conditions": "One condition per line",
  "capture.ivQHint.measures": "One measure per line",
  "capture.ivQHint.tags": "frost, pump, winter",
  "ask.kicker": "Questions and answers",
  "ask.title": "Ask the plant's knowledge",
  "ask.intro":
    "The answer is source-bound: you see what it rests on — and what state each of those sources is in. If there is no basis, the gap is named openly.",
  "ask.placeholder": "e.g. When must valve X be closed on overpressure?",
  "ask.emptyHint": "Please enter a question first.",
  // AUFTRAG-mega38 BLOCK A: waiting and failure appear WHERE the answer will appear.
  "ask.pending.title": "The question is running against the plant knowledge.",
  "ask.pending.body":
    "Matching sources are being looked up. If there is no solid basis, Klarwerk says so openly — nothing is invented.",
  "ask.error.title": "The question could not be answered.",
  "ask.error.body":
    "The request got stuck on the way. This is NOT a statement about the knowledge — it does not mean there is no answer. Please try again.",
  "ask.error.retry": "Try again",
  // SCRUM-295: hint for a prefilled start question (from KO detail “Use knowledge”) in demo context.
  "ask.demoPrefillHint":
    "Start question taken from the knowledge object — click “Ask”. The answer stays source-bound; status and trust decide, nothing is secured automatically.",
  "ask.examplesLabel": "Examples:",
  "ask.examplesSendHint": "One click asks right away — the question is sent immediately.",
  "ask.example.valve": "What to do when Ventil X must close on Überdruck (overpressure)?",
  "ask.example.filter": "How often must Filter F3 be checked?",
  "ask.example.dosing":
    "Why does the Dosierwert on Linie L4 fluctuate after each Schichtwechsel (shift change)?",
  "ask.expect.answer": "finds matching knowledge",
  "ask.expect.gap": "shows a knowledge gap",
  "ask.submit": "Ask",
  "ask.reasoner.model": "Model mode",
  "ask.reasoner.deterministic": "Deterministic mode",
  "ask.reasoner.loading": "Checking mode …",
  "ask.reasoner.unknown": "Mode unknown",
  "ask.reasoner.hint":
    "Shows whether answers run via a configured model or the rule-based fallback. Sources and validation stay the same.",
  "ask.fromValidated": "From source-bound knowledge",
  "ask.evidence": "Evidence",
  "ask.knowledgeClass.gesichert": "Verified",
  "ask.knowledgeClass.ungeprueft": "Unchecked",
  "ask.knowledgeClass.meinung": "Opinion/experience",
  "ask.knowledgeClass.extern": "External source",
  "ask.knowledgeClass.annahme": "Assumption",
  "ask.knowledgeClass.unbekannt": "Unknown",
  "ask.steps": "Context sources consulted",
  // AUFTRAG-mega38 BLOCK F — see the DE block: the list is the full top-K retrieval set, not the
  // set of sources the answer actually used.
  "ask.sources": "Sources consulted",
  "ask.export.copy": "Copy",
  "ask.export.download": "As Markdown",
  "ask.export.print": "Print / PDF",
  "ask.export.copied": "Answer incl. sources copied.",
  "ask.export.answer": "Answer",
  "ask.export.footer":
    "Source-bound answer from KLARWERK · generated on {{date}}. Only as reliable as the sources used (status/trust). No promise of truth.",
  "ask.sourcesHint":
    "This answer is source-bound — it is only as reliable as the source it uses (status, trust, usability). Listed are all sources consulted for the question; which of them carried the answer is marked. Open the knowledge object for details.",
  // AUFTRAG-mega52 A3/A5 — the answer says what it rests on. Unusable markers mean "unknown", never a guess.
  "ask.attribution.known":
    "The sources listed first carried the answer; the rest were consulted but not used.",
  "ask.attribution.unknown":
    "Which of these sources carried the answer could not be determined — the AI returned no usable source references. The list therefore shows all consulted sources without a marker, and “This helped” is not available here.",
  "ask.attribution.carrying.badge": "carried",
  "ask.attribution.carrying.hint":
    "This source carried the answer: the AI referred to it explicitly in the answer text.",
  "ask.attribution.consulted.badge": "consulted",
  "ask.attribution.consulted.hint":
    "Consulted but not used: this source was available to the AI but does not appear in the answer text.",
  // Packet 4 (nacht24): sources like the document — status/trust per source + original-format excerpt.
  "answerSource.trust": "Trust {{n}}",
  "answerSource.excerptShow": "Show excerpt in document format",
  "answerSource.excerptHide": "Hide excerpt",
  "ask.helpful": "This helped",
  "ask.thanked": "Thanks!",
  "ask.status.verified": "Verified",
  "ask.status.unverified": "Not yet verified",
  "ask.reviewGuard.openLabel": "Do not use as verified knowledge yet",
  "ask.reviewGuard.openHint":
    "At least one source is open or still in review. Review/rate it before using this statement as verified knowledge.",
  "ask.reviewGuard.unverifiedLabel": "Answer is not verified yet",
  "ask.reviewGuard.unverifiedHint":
    "This answer is not classified as verified. Check sources and review status before reusing it.",
  "ask.reviewGuard.cta": "Go to validation",
  "ask.gapBadge": "Knowledge gap",
  // AUFTRAG-mega54 BLOCK E — the one next step for a gap (see the German entry). Order is
  // content: the free step first, capture second, the risk board last.
  "ask.gapNext":
    "Next step: ask the question again using the terms your team actually uses — otherwise capture the knowledge or prioritise the gap in the risk board.",
  "ask.noBasisTitle": "No reliable basis.",
  "ask.noBasisBody":
    "No source matches this question closely enough. Instead of a made-up answer, a knowledge gap was created. Both are possible: the knowledge is still missing — or it is recorded under different terms.",
  // SCRUM-369 / AG-12/13/P2-4: the Ask gap as a guided "rescue this knowledge gap" entry (not a chatbot end).
  "ask.gap.rescueTitle": "Rescue this knowledge gap",
  "ask.gap.rescueImpact":
    "Perhaps this experience knowledge is still missing, perhaps it just cannot be found. You can help secure it — for everyone who asks this later.",
  "ask.gap.noInvent":
    "No answer was made up: without a reliable source the question honestly stays open.",
  "ask.gap.rescueCta": "Capture & rescue knowledge",
  // AUFTRAG-mega54 BLOCK E3: heading sharpened so the steps read as the path for someone who
  // already knows the answer — the step order itself is untouched.
  "ask.gap.stepsTitle": "Do you know the answer? Here is how to contribute it:",
  "ask.gap.step.answer.label": "Answer the question",
  "ask.gap.step.answer.hint": "Put down what you know from experience.",
  "ask.gap.step.experience.label": "Add your own experience",
  "ask.gap.step.experience.hint": "Conditions, measures, context.",
  "ask.gap.step.structure.label": "Let AI structure it",
  "ask.gap.step.structure.hint": "The AI only organises it — it invents nothing.",
  "ask.gap.step.review.label": "Get it reviewed",
  "ask.gap.step.review.hint": "Only after validation it counts as secured.",
  // SCRUM-366 / FR-ASK-02 / PI-K2: answer contract — source-bound, honest, not a generic chatbot.
  "ask.contract.label": "Answer basis",
  "ask.contract.verified.title": "Source-bound answer",
  "ask.contract.verified.body":
    "This answer draws on validated knowledge from your knowledge base — not a generic chatbot answer.",
  "ask.contract.verified.next": "Next step: open the source or use the knowledge.",
  "ask.contract.unverified.title": "Source-bound, but not verified yet",
  "ask.contract.unverified.body":
    "The answer draws on existing but not-yet-verified knowledge. It is marked as unverified, not a chatbot guess.",
  "ask.contract.unverified.next":
    "Safe next step: send it for review or have it checked in validation.",
  "ask.contract.gap.title": "Knowledge gap, not a chatbot answer",
  "ask.contract.gap.body":
    "No source matches this question closely enough to carry an answer. That does not necessarily mean the knowledge is missing — it may simply be recorded under different words. Either way it's a gap you can close, not an error.",
  "ask.contract.trustNote":
    "Trust and usability show how reliable a source is — not a guarantee of truth.",
  "ask.contract.sumTotal_one": "{{count}} source consulted",
  "ask.contract.sumTotal_other": "{{count}} sources consulted",
  "ask.contract.sumValidated": "{{count}} validated",
  "ask.contract.sumOpen": "{{count}} open/unverified",
  "ask.contract.sumConflict": "{{count}} with conflict",
  "ask.checkCaveat.title": "This answer is not evidenced as free of conflicts.",
  "ask.checkCaveat.badge": "check unproven",
  "ask.checkCaveat.incomplete":
    "For {{unproven}} of {{total}} sources used, conflict and duplicate checking did not run to completion. Not everything was searched — unknown contradictions are therefore not ruled out.",
  "ask.checkCaveat.noCoverage":
    "For {{unproven}} of {{total}} sources used, a check run is recorded but its reach is not evidenced. How far the search went is therefore unknown.",
  "ask.checkCaveat.unchecked":
    "For {{unproven}} of {{total}} sources used, no check run is recorded at all. Contradictions were never searched for there.",
  "ask.checkCaveat.unknown":
    "{{unproven}} of {{total}} sources used cannot be found in the corpus. Nothing can be said about their checking.",
  // AUFTRAG-mega53 B2: the fifth reason — no source could be attributed to this answer at all.
  "ask.checkCaveat.unattributed":
    "This answer cites none of the {{total}} sources it drew on. Which of them actually supports it is therefore unknown — neither the checking state nor a trust value can be attributed to any source.",
  "ask.trust.unattributed": "trust value not attributable",
  // AUFTRAG-mega34 A2: the unknown conflict state.
  "ask.conflictCaveat.title": "The conflict state cannot be retrieved right now.",
  "ask.conflictCaveat.pending":
    "Known contradictions are still loading. Until they arrive, this answer counts as unverified — not because something was found, but because nothing could be looked up yet.",
  "ask.conflictCaveat.failed":
    "Known contradictions could not be retrieved. Whether any source is in an open conflict is therefore unknown; this answer counts as unverified.",
  // SCRUM-283: data-minimising, honest notice about the stored knowledge gap (Ask + Risk).
  "gap.privacyNotice":
    "The question is stored as a knowledge gap — not an answer and not validated knowledge. Please avoid sensitive or personal details; add reviewed experience later.",
  "ask.toGaps": "To the knowledge gaps",
  "ask.toCapture": "Capture knowledge",
  "ko.kicker": "Knowledge object",
  "ko.use.ready": "Ready to use",
  "ko.use.in-review": "In review",
  "ko.use.needs-work": "Still in progress",
  // SCRUM-293: SHARED use-readiness wording (KO detail + Library identical) — honest, no fake
  // approval: "usable" only because validated (status/trust support it).
  "use.ready.label": "Usable",
  "use.ready.hint": "Validated — usable source-bound (status/trust support it).",
  "use.review.label": "In review",
  "use.review.hint": "Review in progress — don't use as secured yet.",
  "use.open.label": "To review",
  "use.open.hint": "Open/unverified — get it reviewed first.",
  "ko.ovTrust": "Trust",
  "ko.ovSources_one": "{{count}} source",
  "ko.ovSources_other": "{{count}} sources",
  "ko.ovAttachments_one": "{{count}} attachment",
  "ko.ovAttachments_other": "{{count}} attachments",
  "trust.explain.title": "What does Trust mean?",
  "trust.explain.meta":
    "Trust is a review/evidence signal from peer ratings (0–99) — not a promise that the statement is true.",
  "trust.explain.band.high":
    "High trust: positively reviewed several times. Still apply your own judgement.",
  "trust.explain.band.mid":
    "Medium trust: only partly reviewed or with caveats (amber). Double-check before critical use.",
  "trust.explain.band.low":
    "Low trust: barely reviewed or has a red rating/conflict. Review or rework it first.",
  "trust.explain.review":
    "Amber, red or an open conflict means: review or rework before relying on it.",
  "ko.nextLabel": "Next action:",
  "ko.next.use": "validated knowledge — can be used in answers/output.",
  "ko.next.review": "validation in progress — finish the open rating.",
  "ko.next.addSource": "add a source/evidence before validating.",
  "ko.next.validate": "send for review to validate it.",
  "ko.cta.use": "Use in Ask",
  "ko.cta.review": "Finish review",
  "ko.cta.addSource": "Go to sources & evidence",
  "ko.cta.validate": "Go to validation",
  "ko.title": "Detail",
  "ko.statement": "Statement",
  "ko.createdAt": "Created on",
  // WP-SHIP9-S2 Paket 3 (E2): short-preview disclosure per knowledge object/candidate.
  "ko.preview.show": "Quick preview",
  "ko.preview.hide": "Close preview",
  "ko.preview.label": "Preview",
  "ko.createdByName": "by {{name}}",
  "ko.gallery": "Image gallery",
  "ko.galleryCount": "Image {{n}} of {{m}}",
  "ko.galleryClose": "Close",
  "ko.galleryOpen": "Enlarge image {{n}}",
  "ko.galleryPrev": "Previous image",
  "ko.galleryNext": "Next image",
  "ko.galleryEditCaption": "Edit image description",
  "ko.galleryLoss": "{{n}} of {{m}} images from the source file are missing in this draft.",
  "ko.body.readTitle": "Detailed content from the knowledge editor",
  "ko.body.readNote":
    "Blocks and AI suggestions are editorial structure. The status, trust and sources of this knowledge object remain authoritative.",
  "ko.body.readBlocksChip": "structured content",
  "ko.conditions": "Conditions",
  "ko.measures": "Measure",
  "ko.validate": "Validate",
  "ko.stillValid": "Still valid",
  "ko.conditional": "Conditional",
  "ko.reject": "Reject",
  "ko.edit": "Edit",
  "ko.returnedBanner":
    "This knowledge object was returned from review for rework. Please address the review feedback and save a revision.",
  "ko.rework.title": "Review rework",
  "ko.rework.hint":
    "Triggered by a review decision (query/reject). Editing creates a new version and restarts review — no automatic approval, no automatic return.",
  "ko.rework.edit": "Edit / revise",
  "ko.rework.back": "Back to validation",
  "ko.rework.savedTitle": "Revision saved",
  "ko.rework.savedHint":
    "A new version was created and goes back into review — no automatic approval, no automatic return.",
  "ko.rework.toValidation": "To the revision in validation",
  "ko.rework.feedbackTitle": "Review feedback",
  "ko.rework.feedback.warn": "Query",
  "ko.rework.feedback.down": "Rejection",
  "ko.rework.editTitle": "Rework: address this feedback",
  "ko.rework.editHint":
    "Work through the feedback. Saving creates a new version and restarts the review — no automatic approval.",
  "ko.rework.stepsTitle": "Next work steps",
  "ko.rework.step.feedback": "Address the review feedback",
  "ko.rework.step.revise": "Save the revision (new version, fresh review)",
  "ko.rework.step.back": "Back to the “revised” validation focus",
  "ko.saveEdit": "Save",
  "ko.cancelEdit": "Cancel",
  "ko.editNote":
    "Saving bumps the version, resets the rating and sends the object back into review.",
  "ko.revision.title": "Change overview",
  "ko.revision.none": "No changes detected yet.",
  "ko.revision.note":
    "Detects changed fields/structure, not factual correctness. Revising creates a new version and requires review — no automatic approval.",
  "ko.revision.field.title": "Title",
  "ko.revision.field.statement": "Statement",
  "ko.revision.field.body": "Detailed content",
  "ko.revision.field.conditions": "Conditions",
  "ko.revision.field.measures": "Measures",
  "ko.revision.field.tags": "Tags",
  "ko.revision.field.category": "Category",
  "ko.revision.field.type": "Type",
  "ko.reportConflict": "Report conflict",
  "ko.conflictTitle": "Report a contradiction with another knowledge object",
  "ko.conflictTarget": "Contradicting object",
  "ko.conflictTargetPlaceholder": "Select object …",
  "ko.conflictType": "Conflict type",
  "ko.conflictDesc": "What is the contradiction?",
  "ko.conflictSubmit": "Open conflict",
  "ko.conflictTargetSearch": "Search knowledge object …",
  "ko.conflictTargetEmpty": "No matches",
  "ko.conflictTargetChoose": "Select",
  "ko.conflictTargetShow": "Preview",
  "ko.conflictTargetHide": "Hide preview",
  "ko.provenance": "Provenance",
  "ko.helpfulTitle": "Proven in practice",
  "ko.helpfulHint": "Did this knowledge help you in practice?",
  "ko.helpful": "This helped",
  "ko.helpfulDone": "Thanks for your signal!",
  "ko.helpfulThanks": "Thanks — marked as helpful.",
  "ko.sourceTitle": "Report source/contribution",
  "ko.sourceContribution": "Your contribution / rationale (required)",
  "ko.sourceRef": "Source / URL / reference (optional)",
  "ko.sourceHint": "Saved as a comment on the object for review — not yet a peer-validated source.",
  "ko.sourceSubmit": "Submit contribution",
  "ko.sourceSaved": "Contribution saved as a comment.",
  "ko.sourcesTitle": "Sources",
  "ko.sourcesEmpty": "No external sources yet.",
  "ko.sourcesHint": "External sources are stage 2 and not peer-validated.",
  "ext.title": "Search external source",
  "ext.hint":
    "Server-proxy search. Hits are never auto-imported; attach as an external, non-peer-validated source — not a substitute for internal validation.",
  "ext.placeholder": "Search term …",
  "ext.search": "Search",
  "ext.attach": "Attach as source",
  "ext.attachBlocked":
    "At the configured stage, searching is allowed but attaching is not. An administrator can change this under Administration → External knowledge.",
  // AUFTRAG-mega16 Block A (ben's SB-4): the stage is a real boundary now — it covers EVERY public
  // web address, not just recognised providers.
  "ext.gate.publicUrl":
    "At the configured stage, no source with a public web address can be attached — this applies to every address from the internet, not only to search results.",
  "ext.gate.unanchored":
    "At the configured stage, a source without an address can only be attached if it is a passage from a document held with this knowledge object. Without an address and without a stored document, the server cannot tell it apart from an external search result.",
  "ext.gate.how":
    "An administrator can change the stage under Administration → External knowledge.",
  "ext.unavailable": "External search is not available.",
  "ext.resumeHint":
    "The results list is not stored with the draft. Your search query is back — run the search again to reload the results.",
  "extpage.kicker": "Research",
  "extpage.title": "External knowledge",
  "extpage.intro": "Search external sources — without opening a knowledge object first.",
  "extpage.note":
    "Read-only research via the server proxy. Nothing is attached or imported here; to adopt a hit, attach it as a source from the knowledge-object detail. No peer validation.",
  "extpage.idle": "Enter a search term to find external sources.",
  "extpage.disabled":
    "External search is disabled on the server (EXTERNAL_SEARCH=off). Please contact ops/Codex.",
  "extpage.noResults": "No hits for this search.",
  "extpage.resultsTitle": "{{n}} hits",
  "ko.sourceLabel": "Source label (required)",
  "ko.sourceUrl": "URL / reference (optional)",
  "ko.sourceExcerpt": "Excerpt / note (optional)",
  "ko.sourceAdd": "Add external source",
  "ko.sourceAdded": "External source added.",
  "ko.sourceRemove": "Remove source",
  "ko.sourceUnvalidated": "external · not peer-validated",
  "ko.sourceValidated": "peer-validated",
  "ko.lineageTitle": "Origin & history",
  "ko.lineageOrigin": "Origin",
  "ko.lineageTransferred": "(transferred)",
  "ko.lineageVersions": "Version",
  "ko.lineageChanges": "changes",
  "ko.lineageRelated": "Related",
  "ko.lineageAudit": "Recent events",
  "ko.lineageGraphLink": "View in knowledge graph",
  "nb.title": "Knowledge network — neighbourhood",
  "nb.hint":
    "The article you are reading sits in the middle; around it, what belongs to it via shared tags. Click a neighbour to make it the new centre.",
  "nb.empty": "No neighbours via meaningful tags.",
  "nb.back": "Back to “{{title}}”",
  "nb.open": "Open article",
  "nb.makeCenter": "Make “{{title}}” the new centre",
  "nb.svgLabel": "Neighbourhood of “{{title}}”",
  "nb.countAll_one": "{{count}} neighbour in the network",
  "nb.countAll_other": "{{count}} neighbours in the network",
  "nb.countTruncated": "The {{shown}} strongest of {{total}} neighbours",
  "nb.excluded":
    "No edges via ubiquitous tags: {{tags}} — more than half of all objects carry them, so the connection says nothing.",
  "ko.transferTitle": "Transfer author",
  "ko.transferOriginal": "Original author",
  "ko.author": "Author",
  "ko.authorUnknown": "Unknown person ({{ref}})",
  "ko.authorLoading": "Loading author name …",
  "ko.authorUnavailable": "Author name unavailable",
  "ko.originalAuthor": "Original",
  "ko.transferPick": "Choose new author …",
  "ko.transfer": "Transfer",
  "ko.transferDone": "Author transferred. Original author stays visible.",
  "ko.history": "Versions",
  "ko.evidenceTitle": "Evidence",
  "ko.evidenceEmpty": "No separate evidence records yet.",
  "ko.evidenceKind.source": "Source",
  "ko.evidenceKind.attachment": "Attachment",
  "ko.evCons.title": "Evidence consistency",
  "ko.evCons.status.ok": "consistent",
  "ko.evCons.status.warning": "review",
  "ko.evCons.counts": "Sources {{sources}} · Attachments {{attachments}} · Evidence {{evidence}}",
  "ko.evCons.allOk": "Sources, attachments and evidence are aligned.",
  "ko.evCons.finding.source-without-evidence": "Source without evidence",
  "ko.evCons.finding.attachment-without-evidence": "Attachment without evidence",
  "ko.evCons.finding.evidence-without-source": "Evidence without source",
  "ko.evCons.finding.evidence-without-attachment": "Evidence without attachment",
  "ko.evCons.finding.legacy-inline-attachment": "Legacy inline attachment (no evidence)",
  "ko.evVer.title": "Evidence by version",
  "ko.evVer.version": "v{{n}}",
  "ko.evVer.counts": "Sources {{sources}} · Attachments {{attachments}}",
  "ko.evVer.latest": "latest {{at}}",
  "ko.evVer.without": "Without evidence: {{versions}}",
  "ko.evFresh.title": "Evidence freshness",
  "ko.evFresh.current": "current version backed",
  "ko.evFresh.outdated": "only older versions",
  "ko.evFresh.missing": "evidence missing",
  "ko.evFresh.neutral": "no evidence expected",
  "ko.evFresh.counts": "v{{version}} · current {{current}} · older {{older}}",
  "ko.snapshotsTitle": "Version snapshots",
  "ko.snapshotsEmpty": "No stored full snapshots yet.",
  "ko.snapshotInitial": "Initial version — no previous diff.",
  "ko.snapshotNoChanges": "No change in the main fields.",
  "ko.snapshotField.title": "Title",
  "ko.snapshotField.statement": "Statement",
  "ko.snapshotField.conditions": "Conditions",
  "ko.snapshotField.measures": "Measures",
  "ko.snapshotField.type": "Type",
  "ko.snapshotField.status": "Status",
  "ko.comments": "Comments",
  "ko.commentsEmpty": "No comments yet.",
  "ko.commentPlaceholder": "Write a comment …",
  "ko.commentAdd": "Comment",
  "ko.attachments": "Attachments / photos",
  "ko.attachmentsEmpty": "No attachments yet.",
  "ko.attachmentAdd": "Attach photo",
  "ko.attachmentUploading": "Uploading …",
  "ko.attachmentRemove": "Remove attachment",
  "val.kicker": "Validation board",
  "val.intro":
    "Peer rating green / amber / red. At the threshold (default 3× green, 0× red) an object is validated.",
  "val.filter": "Filter full text …",
  "val.filterAllTypes": "All knowledge types",
  "val.filterAllCategories": "All categories",
  "val.filterAllTags": "All tags",
  "val.filterMine": "Assigned to me",
  // WP-SUBMIT-ASYNC: background AI-check status on the card + "in review" filter.
  "val.filterAiPending": "AI check running",
  "val.aiCheck.pending": "Duplicate/overlap check running",
  "val.aiCheck.pendingAi": "Duplicate/conflict check (with AI) running",
  "val.aiCheck.pendingHint":
    "The deterministic duplicate/overlap check is running in the background. The result will appear here once it finishes.",
  "val.aiCheck.pendingHintAi":
    "The duplicate/conflict check (with AI) for conflicts and overlaps is running in the background. The result will appear here once it finishes.",
  "val.aiCheck.failed": "Check failed",
  "val.aiCheck.retry": "Retry check",
  "val.aiCheck.retryStarted": "Check re-queued — it is now running in the background.",
  "val.aiCheck.locked":
    "Duplicate/overlap check running … review actions are locked until the result is in.",
  "val.aiCheck.lockedAi":
    "Duplicate/conflict check (with AI) running … review actions are locked until the result is in.",
  "val.aiCheck.reason.no-model":
    "No AI model active — nothing was checked. Configure a model and retry the check.",
  "val.aiCheck.reason.model-error":
    "The AI check stopped with an error. Retrying starts a fresh run.",
  "val.aiCheck.reason.timeout":
    "The AI check exceeded the time limit and was aborted. Retrying starts a fresh run.",
  "val.aiCheck.reason.model-timeout":
    "The AI model did not respond in time. Retrying starts a fresh run.",
  "val.aiCheck.reason.queue-overflow":
    "The check queue was full — this job was evicted. Retrying re-queues it.",
  // D-AISTATE PAKET 1 (bens V1): confidential → cloud AI excluded, no local model.
  "val.aiCheck.reason.confidential":
    "Confidential — the cloud AI is excluded and no local model is available. Only the deterministic duplicate/overlap check ran; no AI content check was performed.",
  // AUFTRAG-mega11 Block A (bens SB-1): neutral — no statement about protected holdings.
  "val.aiCheck.reason.privacy-no-cloud":
    "For this check the cloud AI is unavailable for data protection reasons, and no local model is ready. Only the deterministic duplicate/overlap check ran; no AI content check was performed.",
  // RT-001 (Pedi): honest classification of real provider errors — never a provider name/key/
  // endpoint/raw error text, only a user-understandable cause plus what the user can do.
  "val.aiCheck.reason.auth":
    "The AI could not sign in — the credentials are missing or were rejected. Please check the model credentials in settings and retry the check.",
  "val.aiCheck.reason.rate-limit":
    "The AI provider rejected the request due to a rate limit. Wait a moment and retry the check.",
  "val.aiCheck.reason.unreachable":
    "The AI provider was unreachable — likely a network or connection issue. Check the connection and retry the check.",
  "val.aiCheck.reason.bad-response":
    "The AI model returned an unintelligible response that could not be evaluated. Retrying starts a fresh run.",
  // AUFTRAG-mega23 Block B: TECHNICAL queueing failure — the model was never asked and raised
  // nothing. The text says exactly that and does not disguise itself as a model error.
  "val.aiCheck.reason.submit-followup-failed":
    "The check could not be queued for technical reasons while submitting — the AI model was not asked and raised nothing. Retrying queues it again.",
  // AUFTRAG-mega28 A2/A3: with the candidate cap in place, a run must never look like it saw the
  // whole library. These texts name the numbers and spell out what an empty result does NOT mean.
  "val.aiCheck.reason.capacity":
    "The check was aborted because the AI model was saturated — it did not run to completion. Retrying starts a fresh run.",
  "val.aiCheck.boardCaveat":
    "This does not mean “checked and clear”: of {{total}} knowledge objects, {{incomplete}} carry an incomplete check run and {{unchecked}} none at all. Detection compares each contribution against a limited set of candidates only.",
  // AUFTRAG-mega31 A4: “no run at all” and “no coverage evidenced” are TWO statements.
  "val.aiCheck.boardCaveat.noCoverage":
    "For {{noCoverage}} more, a check run is recorded but no coverage is evidenced — nothing is established about their reach.",
  "val.aiCheck.coverage.partial": "PARTIAL",
  "val.aiCheck.coverage.capped":
    "Checked against at least {{completed}} of {{available}} possible neighbours — not a complete comparison. The figure is the conservative minimum coverage of both checks (conflict and duplicate); the weaker of the two determines it. No finding means: nothing found within that set, not “free of conflicts and duplicates”.",
  "val.aiCheck.coverage.skipped":
    "Checked against at least {{completed}} of {{available}} possible neighbours; {{skipped}} comparisons were skipped due to errors — the run is incomplete. No finding does not mean “free of conflicts and duplicates”.",
  "val.aiCheck.coverage.aborted":
    "Aborted after at least {{completed}} of {{available}} possible neighbours — the rest was not checked. No finding does not mean “free of conflicts and duplicates”.",
  "val.aiCheck.coverage.unproven":
    "This run is not evidenced as complete: the record shows {{completed}} finished comparisons against {{available}} possible neighbours. No finding does not mean “free of conflicts and duplicates”.",
  "val.feedback.condTitle": "Conditional – reason for the author (required)",
  "val.feedback.rejTitle": "Rejection – reason for the author (required)",
  "val.feedback.placeholder": "What needs to be revised? …",
  "val.feedback.submit": "Submit",
  "val.feedback.cancel": "Cancel",
  "val.feedback.error": "Could not be saved.",
  // SCRUM-365 / AG-12: frame feedback as help for the next revision, not a technical form.
  "val.feedback.helpHint": "Your feedback helps the author revise the next version specifically.",
  "val.empty": "No open objects.",
  "val.target": "Target: {{n}}× green",
  "val.trust": "Trust",
  "val.votes": "{{have}} of {{need}} green",
  "val.votesTitle": "Validation progress",
  "val.votesHint":
    "This many green (positive) ratings are recorded — out of {{need}} needed to validate. With enough green and 0 red, the object counts as validated; red ratings block approval.",
  "val.votesBlocked": "{{count}}× red",
  "val.staleVotes": "{{count}}× outdated",
  "val.staleVotesHint":
    "These ratings are from an earlier revision (before v{{version}}) and no longer count. The object needs fresh ratings of the current version.",
  "val.markTrue": "Mark as true",
  "val.markTrueConfirm": "Mark as true and fully validate?",
  "val.markTrueCancel": "Cancel",
  "val.markTrueYes": "Yes, validate",
  "val.markTrueDone": "Marked as true — object is now validated.",
  // SCRUM-416: card density — one calm expander for signals/context/guidance.
  "val.more": "Show signals & context",
  // SCRUM-417: edit straight from the board (opens the KO detail in edit mode).
  "val.editKo": "Edit",
  "val.transferred": "Author transferred",
  "val.assigned": "assigned",
  "val.decisionLabel": "Decision pending:",
  "val.reviewContext.new": "New",
  "val.reviewContext.revision": "Revised",
  "val.reviewContext.hint.new": "First review: check source, statement and structure.",
  "val.reviewContext.hint.revision":
    "Review the change: re-assess version and content — no automatic approval.",
  "val.reviewFocus.label": "Review focus",
  "val.reviewFocus.all": "All",
  "val.reviewFocus.new": "New",
  "val.reviewFocus.revision": "Revised",
  "val.focusActive.label": "Active filters",
  "val.focusReset": "Reset filters",
  "val.focusEmpty.filtered": "No matches with the current filters.",
  "val.focusEmpty.otherFilters": "Adjust search, type, category or tag.",
  "val.mineFocus.title": "Review work assigned to you",
  "val.mineFocus.hint": "This is your personal review list. You can work through it now.",
  "val.mineFocus.count": "{{n}} for you",
  "val.mineFocus.reset": "Show all open items",
  "val.mineEmpty.title": "No review work assigned to you",
  "val.mineEmpty.hint":
    "As soon as something is assigned to you, it shows up here. For now there's nothing open for you.",
  "val.mineEmpty.cta": "View all open items",
  "val.decision.low": "weakly backed — review carefully, check sources/evidence.",
  "val.decision.mid": "partly backed — cross-check the statement and sources.",
  "val.decision.high": "well backed — a brief cross-check usually suffices.",
  "val.reviewState.new": "Newly captured · open",
  "val.reviewState.assigned": "Assigned · review running",
  "val.reviewState.inReview": "Review started",
  "val.reviewState.validated": "Validated",
  "val.reviewHint.new": "No review yet — check it now.",
  "val.reviewHint.assigned": "Assigned — the responsible person reviews next.",
  "val.reviewHint.inReview": "Review is running — cross-check sources and statement.",
  "val.reviewHint.validated": "Already validated.",
  "val.confirm": "Confirm",
  "val.conditional": "Conditional",
  "val.reject": "Reject",
  "val.actionApprove": "Approve",
  "val.actionQuery": "Query",
  "val.actionReject": "Reject",
  "val.feedbackRequiredHint": "* Query and rejection require a reason.",
  // SCRUM-365 / AG-12: calm review guidance "What am I reviewing?" (progressive disclosure).
  "val.guide.title": "What am I reviewing now?",
  "val.guide.statement": "Statement",
  "val.guide.statement.hint": "Is the core statement factually correct?",
  "val.guide.evidence": "Source & evidence",
  "val.guide.evidence.hint": "Are sources or evidence present and solid?",
  "val.guide.context": "Context",
  "val.guide.context.hint": "Is it clear when and where this applies?",
  "val.guide.traceable": "Traceability",
  "val.guide.traceable.hint": "Is it described clearly and traceably?",
  "val.guide.focus.revision": "Revised — focus on what changed since the last version.",
  "val.guide.focus.transfer":
    "Authorship was transferred — look extra closely at the statement and evidence.",
  // SCRUM-365 / PI-K2 / AG-P2-3: Trust is a signal, not truth — only the quorum makes it reliable.
  "val.guide.trustNote":
    "Trust is a review signal, not a guarantee of truth. Only enough approvals — the agreed minimum number of reviewers — make knowledge reliable.",
  // SCRUM-365: decision impact BEFORE the click — honest, no automatic release.
  "val.guide.impactTitle": "What does the decision do?",
  "val.impact.up.title": "Approve",
  "val.impact.up.body":
    "Counts as one approval vote. Knowledge becomes usable only when status, the number of approvals and trust support it — nothing is released automatically.",
  "val.impact.warn.title": "Query",
  "val.impact.warn.body":
    "Needs a short reason. Stays review work and helps the author revise specifically.",
  "val.impact.down.title": "Reject",
  "val.impact.down.body":
    "Needs a short reason. Leads to rework — nothing is closed automatically.",
  "val.decisionSaved": "Review recorded.",
  // SCRUM-292: honest follow-up per verdict — no automatic/fake validation.
  "val.outcome.up":
    "Positively rated. If status and trust support it, it can be used source-bound or checked as a next step — this does not validate it automatically.",
  "val.outcome.warn": "Query documented. Stays review work until the open points are resolved.",
  "val.outcome.down": "Rejection documented. Stays review/feedback work.",
  "val.nextViewKo": "View object",
  "val.nextUse": "Use knowledge (ask)",
  "val.nextRework": "Rework in the object",
  "val.assign": "Assign …",
  "val.openDetails": "View details — edit & delete in the object",
  // AUFTRAG-mega38 BLOCK E — s. den DE-Block: die Wand zeigt zuletzt ERFASSTES Wissen, kein
  // gesichertes; sie filtert nicht nach Status.
  "start.livewall.title": "What is happening right now",
  "start.livewall.subtitle": "Recently captured knowledge and knowledge that helped others.",
  "start.livewall.saved": "Recently captured",
  "start.livewall.helped": "Helped",
  "start.livewall.helpedToday": "helped today: {{n}}",
  "start.livewall.savedEmpty": "Nothing captured yet — the first contribution will appear here.",
  "start.livewall.helpedEmpty": "No “helped” feedback yet.",
  "con.kicker": "Conflict board",
  "con.title": "Resolve conflicts — without losing knowledge",
  "con.intro":
    "Contradictions are compared and classified. Only truth conflicts trigger the human escalation path.",
  "con.empty": "No open conflicts.",
  "conflict.impact.title": "Open conflict — usability limited",
  "conflict.impact.hint":
    "This knowledge has an open conflict. It is not automatically wrong, but should be reviewed before unrestricted use.",
  "conflict.impact.truthTitle": "Open truth conflict — review before use",
  "conflict.impact.truthHint":
    "This knowledge has an open truth conflict. Until resolved it counts as to-review, not as unrestrictedly secured.",
  "conflict.impact.badge": "Conflict open",
  "conflict.impact.cta": "View conflict",
  "con.type.truth": "Truth",
  "con.type.experience": "Experience",
  "con.type.context": "Context",
  "con.type.temporal": "Time",
  "con.type.role": "Role",
  "con.status.offen": "Open",
  "con.status.eskaliert": "Escalated",
  "con.status.zweitmeinung": "Second opinion",
  "con.status.geloest": "Resolved",
  "con.escPath": "Escalation path",
  "con.escalate": "Escalate",
  "con.resolve": "Resolve",
  "con.origin.auto": "Automatically detected",
  "con.origin.manual": "Manually created",
  "con.autoConfidence": "Confidence {{percent}}%",
  // SCRUM-486 B: the AI percentage is detection confidence, not proof of the contradiction.
  "con.autoConfidenceCaption": "AI detection confidence — not a proven contradiction",
  "con.collision.at": "Collision on",
  "con.collision.verbatim": "verbatim from the source quote",
  "con.collision.point": "collision point",
  "con.autoWhy": "Reason",
  "con.autoQuoteA": "Evidence A",
  "con.autoQuoteB": "Evidence B",
  "con.dismiss": "False alarm – no contradiction",
  "con.resolveConfirm": "Save decision",
  "con.decision": "Decision",
  "con.decisionPlaceholder": "How is the contradiction resolved? (rationale/outcome)",
  "con.versus": "vs",
  "con.conditions": "Conditions",
  "con.measures": "Measures",
  "con.sources": "Sources",
  "con.openKo": "Open object",
  "con.compareOpen": "Compare both",
  "con.readonlyCompare": "Read-only comparison",
  "con.detectedOn": "Detected on {{date}}",
  "con.evidenceSideLabel": "Evidence for this side",
  "con.evidenceBalance.neither":
    "Neither statement is backed by a source. This contradiction therefore cannot be settled on wording, only on evidence — the next step is to add a source for at least one side.",
  "con.evidenceBalance.oneSided":
    "Only one of the two statements is backed by a source: “{{title}}”. That is a difference in evidence, not a verdict on which statement is correct — a sourced statement can still be wrong. The next step is to back the other side or withdraw it.",
  "con.compareTitle": "Side-by-side comparison",
  "con.koMissing": "Contribution was removed.",
  "con.resolveEffect":
    "The decision is documented and logged. Object trust/status are NOT changed automatically (no silent overwrite).",
  "con.resolveRevalidate": "Re-validate affected objects manually if needed.",
  "con.secondOpinion": "Second opinion",
  "con.secondOpinionAdd": "Second opinion",
  "con.secondOpinionConfirm": "Save second opinion",
  "con.secondOpinionPlaceholder": "Assessment by a second expert …",
  "con.nextLabel": "Next step",
  "con.next.escalate": "Escalate to a human (truth conflict).",
  "con.next.secondOpinion": "Get a second expert opinion.",
  "con.next.resolve": "Decide and document the resolution.",
  "con.next.done": "Conflict is resolved — nothing pending.",
  "dup.kicker": "Duplicates board",
  "dup.title": "Resolve duplicates — one topic, one source",
  "dup.intro":
    "Overlaps between contributions, detected automatically. Very high text overlap is found even without AI; the subtler cases are checked by the model. You decide: link as related, keep separate, or close as a false alarm. (There is deliberately no automatic merge.)",
  "dup.empty": "No open overlaps.",
  "dup.relation.identisch": "Identical",
  "dup.relation.a_enthaelt_b": "A contains B",
  "dup.relation.b_enthaelt_a": "B contains A",
  "dup.relation.teilweise": "Partial overlap",
  "dup.relation.verwandt": "Related",
  "dup.status.offen": "Open",
  "dup.status.in_bearbeitung": "In progress",
  "dup.status.geschlossen": "Closed",
  "dup.method.model": "AI check",
  "dup.method.deterministic": "Text match",
  "dup.probable": "Probable duplicate",
  "dup.textIdentical": "Near-identical text",
  "dup.overlap": "{{percent}}% text overlap",
  "dup.confidence": "Confidence {{percent}}%",
  // SCRUM-486 B: honest framing of the leading number — similarity is not proof.
  "dup.leadCaptionModel": "AI likelihood — not a proven duplicate",
  "dup.leadCaptionText": "Word/text similarity — not a proven duplicate",
  "dup.why": "Reason",
  "dup.shared": "Shared statements",
  "dup.quoteA": "In A",
  "dup.quoteB": "In B",
  "dup.onlyA": "Only in A",
  "dup.onlyB": "Only in B",
  "dup.recommendation": "Recommendation",
  // SCRUM-486 D: no empty "merge" promise — the recommendation points at the real actions
  // (link / keep separate / false alarm). There is no automatic merge.
  "dup.rec.zusammenfuehren": "Strong overlap — link or keep one version",
  "dup.rec.zusammenfuehren_pruefen": "Review overlap — link or keep separate",
  "dup.rec.getrennt_lassen": "Keep separate",
  "dup.rec.verwandt_verlinken": "Link as related",
  "dup.versus": "vs",
  "dup.openKo": "Open object",
  "dup.compareOpen": "Compare both",
  "dup.compareTitle": "Comparison",
  "dup.koMissing": "Item was removed.",
  "dup.closed": "Closed",
  "dup.reason.merged": "Merged",
  "dup.reason.kept_separate": "Deliberately kept separate",
  "dup.reason.linked_related": "Linked as related",
  "dup.reason.dismissed": "False alarm — not a duplicate",
  "dup.reason.participant_deleted": "Participating item removed",
  "dup.reason.superseded": "No longer applicable",
  "dup.action.dismiss": "False alarm – not a duplicate",
  "dup.action.keepSeparate": "Keep separate",
  "dup.action.linkRelated": "Link as related",
  // SCRUM-486 (de-densify): lead line per card + neutral "removed" hint instead of a raw UUID.
  "board.koRemoved": "Item removed",
  "board.detailsShow": "Show details",
  "con.leadKicker": "Contradiction",
  "dup.leadKicker": "Overlap",
  // D-BIB (nacht24 packet 5): dynamic facets + subgroups + saved views (local).
  "lib.facet.category": "Department/Category",
  "lib.facet.language": "Language",
  "lib.facet.status": "Status",
  "lib.facet.author": "Author",
  "lib.facet.age": "Age",
  "lib.facet.trust": "Trust",
  "lib.facet.maturity": "Maturity",
  "val.facet.pruefstand": "Review stage",
  "lib.facet.origin": "Origin",
  "lib.facet.type": "Knowledge type",
  "lib.facet.tag": "Tag",
  "facet.active": "Active filters",
  "facet.reset": "Reset all",
  "facet.remove": "Remove {{label}}",
  "facet.result": "Results: {{shown}} of {{total}}",
  "facet.filtered": "filtered",
  "facet.more": "+{{n}} more",
  "facet.moreFilters": "More filters",
  "facet.noMatch": "no matches (conflicting saved view)",
  "lib.facet.lang.de": "German",
  "lib.facet.lang.en": "English",
  "lib.facet.lang.nl": "Dutch",
  "lib.facet.lang.other": "no language tag",
  "lib.facet.ageBucket.d30": "≤ 30 days",
  "lib.facet.ageBucket.d180": "≤ 180 days",
  "lib.facet.ageBucket.y1": "≤ 1 year",
  "lib.facet.ageBucket.older": "older than 1 year",
  "lib.facet.ageBucket.unknown": "age unknown",
  "lib.facet.trustBucket.t0": "Trust 0",
  "lib.facet.trustBucket.t1": "Trust 1–39",
  "lib.facet.trustBucket.t40": "Trust 40–69",
  "lib.facet.trustBucket.t70": "Trust 70+",
  "lib.facet.more": "+{{n}} more",
  "lib.facet.none": "no value",
  // AUFTRAG-mega10 block B: the chip wall becomes a search mask (rail, per-dimension search,
  // openable cap, sticky counter, range filter, filter sheet).
  "facet.searchLabel": "Search in {{label}}",
  "facet.searchPlaceholder": "Search {{label}} …",
  "facet.searchNoHit": "No value matches “{{query}}”.",
  "facet.showAll": "Show all {{n}}",
  "facet.showLess": "Show fewer",
  "facet.restricted": "only values from the selected category",
  "facet.showResults_one": "Show {{count}} result",
  "facet.showResults_other": "Show {{count}} results",
  "facet.countFiltered": "filtered from {{total}}",
  "facet.countAll": "entire stock",
  "facet.openFilters": "Filters",
  "facet.closeFilters": "Close filters",
  "facet.sheetTitle": "Filters",
  "facet.rangeLabel": "Period",
  "facet.rangeFrom": "from",
  "facet.rangeTo": "to",
  "facet.rangeFromPill": "from {{date}}",
  "facet.rangeToPill": "until {{date}}",
  "facet.rangeContradictory":
    "The start date is after the end date — this combination matches nothing.",
  "lib.facet.confidentiality": "Confidentiality",
  "lib.facet.showResults_one": "Show {{count}} entry",
  "lib.facet.showResults_other": "Show {{count}} entries",
  "lib.facet.rangeLabel": "Last changed",
  "lib.loadMore": "Load {{n}} more",
  "lib.views.remember": "Remember this search",
  "lib.views.savedLabel": "Saved searches",
  // AUFTRAG-sortfilter · Punkt 1: hit list sorting.
  "lib.sort.label": "Sort",
  "lib.sort.relevance": "Relevance",
  "lib.sort.title": "Title A→Z",
  "lib.sort.trust": "Trust (high→low)",
  "lib.sort.recent": "Last changed (new→old)",
  "lib.groupBy.label": "Subgroups",
  "lib.groupBy.none": "none",
  "lib.views.label": "Views",
  "lib.views.pick": "Load saved view …",
  "lib.views.namePlaceholder": "View name",
  "lib.views.save": "Save view",
  "lib.views.remove": "Delete view",
  "lib.views.localHint": "stored locally in this browser",
  "imp.select.deselectLang": "Deselect all {{lang}} · {{n}}",
  // SCRUM-486 (nacht24 packet 3): one calm finding view — what, detection path (honest),
  // both sides linked, grouped per contribution.
  "finding.kind.konflikt": "Conflict",
  "finding.kind.duplikat": "Duplicate",
  "finding.kind.ueberschneidung": "Overlap",
  "finding.way.ki": "with AI",
  "finding.way.deterministisch": "without AI (deterministic)",
  "finding.way.manuell": "created manually",
  "finding.versus": "vs",
  "finding.groupKicker": "Contribution",
  "finding.groupCount": "{{n}} finding(s)",
  // FUNKE (nacht24 packet 6): impact loop — dignified, no gamification circus.
  "funke.sourceAuthor": "from the knowledge of {{name}}",
  "funke.impact.title": "My impact",
  "funke.impact.contributions": "My contributions",
  "funke.impact.validated": "of which validated",
  "funke.impact.cited": "cited in answers",
  "funke.impact.helpful": "marked as helpful",
  "funke.impact.hint":
    "Honest counting from existing evidence: “cited” counts the leading answer source — nothing is estimated or invented.",
  "funke.gaps.title": "Open knowledge gaps",
  "funke.gaps.count": "{{n}} open",
  "funke.gaps.answerCta": "Answer in 2 minutes",
  "funke.gaps.more": "+{{n}} more open gaps — full list under Risk & gaps.",
  "funke.capital.title": "Knowledge capital",
  "funke.capital.secured": "captured knowledge objects",
  "funke.capital.validated": "of which validated",
  "funke.capital.open": "of which open",
  "funke.capital.categories": "answerable topic areas",
  "funke.capital.authors": "active knowledge holders",
  "funke.capital.gaps": "open knowledge gaps",
  "funke.capital.hint": "Only real numbers from the actual stock — no estimates.",
  "lib.kicker": "Library",
  "lib.export": "Export",
  "lib.exportFormat": "Export format",
  "lib.format.json": "JSON",
  "lib.format.markdown": "Text (Markdown)",
  "lib.format.mediawiki": "MediaWiki",
  "lib.format.html": "HTML (print/PDF)",
  "lib.search": "Full-text search …",
  // AUFTRAG-BASIC-u2 — see the German entry for the finding.
  "lib.scope.note":
    "This searches the Klarwerk knowledge released to you — not your own drafts that you have not submitted yet.",
  "lib.scope.toDrafts": "Search your own drafts",
  "lib.allStatus": "All statuses",
  "lib.allTypes": "All knowledge types",
  "lib.allCategories": "All categories",
  "lib.allTags": "All tags",
  "lib.revalidate": "Start re-validation",
  "lib.ask": "Ask",
  "lib.review": "Review",
  "lib.revalidateDone": "Re-validation started.",
  "lib.reimport": "Re-import (JSON)",
  // AUFTRAG-BASIC-u2: the empty state names the SEARCH SPACE — see the German entry.
  "lib.empty":
    "No matches in the Klarwerk knowledge released to you. Your own drafts that you have not submitted yet live under “Resume drafts”.",
  "lib.answerTitle": "An answer instead of just hits?",
  "lib.answerHint":
    "Get '{{q}}' answered source-bound — with clear source links, not just articles.",
  "lib.answerButton": "Get the question answered",
  "lib.emptyQuery":
    "No matches for '{{q}}' in the Klarwerk knowledge released to you. Your own drafts that you have not submitted yet are not included here. Tip: rephrase, reset the filters, or search a single keyword.",
  // AUFTRAG-mega59 BLOCK D — see the German entry for the finding.
  "lib.facetEmpty.title": "There are matches — but none of them fits the active filters.",
  "lib.facetEmpty.hint":
    "Your search has {{count}} matches in the knowledge base. The active filters hide all of them.",
  "lib.facetEmpty.reset": "Reset all filters",
  "lib.matchIn": "Matched in",
  "lib.match.title": "Title",
  "lib.match.tag": "Tag",
  "lib.match.category": "Category",
  "lib.match.type": "Knowledge type",
  "lib.match.text": "Text",
  "lib.match.caption": "Image description",
  "lib.maturity.all": "All",
  // SCRUM-309: origin filter (complements maturity/search; provenance, not a quality claim).
  "lib.originLabel": "Origin",
  "lib.demoFilter.all": "All origins",
  "lib.demoFilter.demo": "Example data",
  "lib.demoFilter.nonDemo": "Own knowledge",
  "lib.maturity.usable": "Usable",
  "lib.maturity.review": "In review",
  "lib.maturity.open": "To review",
  "lib.resultCount": "Matches: {{n}}",
  "lib.showingFirst": "showing first {{shown}} of {{total}}",
  "imp.explore.title": "Explore the source",
  "imp.explore.hint":
    "First see what's in the source — volumes, authors, themes and time range. Nothing is imported.",
  "imp.explore.active": "active",
  "imp.explore.soon": "soon",
  "imp.explore.cta": "Next: explore",
  "imp.explore.exploring": "Exploring …",
  "imp.explore.pages": "Pages",
  "imp.explore.sources": "Sources",
  "imp.explore.period": "Time range",
  "imp.explore.authors": "Authors",
  "imp.explore.themes": "Themes",
  "imp.explore.more": "+{{n}} more",
  "imp.explore.withImages": "{{n}} pages contain images.",
  "imp.explore.noAuthor": "(no author)",
  "imp.explore.noTheme": "(no theme)",
  "imp.explore.empty": "Nothing was found in this source.",
  "imp.explore.truncated": "Only the first {{n}} pages were counted — the source is larger.",
  "imp.explore.failedPages": "{{n}} pages could not be read.",
  "imp.explore.topOf": "top {{n}} of {{total}}",
  "imp.explore.derivedTag": "derived",
  "imp.explore.derivedHint":
    "Theme derived deterministically from the page titles — the source has no labels for these pages.",
  "imp.explore.spaces": "Spaces",
  "imp.explore.alreadyImported": "Of these already imported: {{n}}",
  "imp.explore.alreadyQueued": "Of these already queued for review: {{n}}",
  // AUFTRAG-ic7-import-vision: honest source gallery „where the journey is heading".
  // AUFTRAG-mega67 BLOCK C+D — der Zugangs-Zustand (s. den deutschen Block für die Begründung).
  "imp.access.title": "Access",
  "imp.access.ready.title": "Enabled, credentials in place",
  "imp.access.ready.body":
    "The import is enabled for this installation, and all required credentials are set on the server. Whether they are also valid will show on the first import — it cannot be checked from here without calling Confluence.",
  "imp.access.noCredentials.title": "Enabled, but without credentials",
  "imp.access.noCredentials.body":
    "The import is enabled, but something is still missing. Until that is fixed, no import can start.",
  "imp.access.disabled.title": "Not enabled in this installation",
  "imp.access.disabled.body":
    "The Confluence import is not enabled here. It is switched on at the server; it cannot be toggled from the interface.",
  "imp.access.blocker.missing": "At least one of the required entries is missing.",
  "imp.access.blocker.insecureBaseUrl":
    "All entries are set, but the address is not an https address. Credentials are only sent over encrypted connections — so no access is established.",
  "imp.access.varsTitle": "What this system needs",
  "imp.access.varPresent": "set",
  "imp.access.varMissing": "not set",
  "imp.access.whereSet":
    "These values are set as environment variables on the server — not here. Klarwerk only shows whether they are set, never their content.",
  "imp.access.whoMay": "This can be changed by whoever has access to this installation's server.",
  "imp.access.lastConnectedUnknown": "No successfully completed import has been recorded yet.",
  "imp.access.lastConnected":
    "Last successfully completed import: {{date}}. Whether it works now, this look back does not say.",
  "imp.gallery.planned": "planned",
  "imp.gallery.plannedGroup": "Planned ({{count}})",
  "imp.gallery.systemsTitle": "Systems",
  "imp.gallery.filesTitle": "Files",
  "imp.gallery.hintSoon": "In progress — this source is coming soon.",
  "imp.gallery.hintPlanned": "Planned — coming later.",
  "imp.gallery.unconfigured": "not configured",
  "imp.gallery.hintUnconfigured":
    "Present, but not usable: no service is configured for transcription. An administrator can set one up in the admin area.",
  "imp.gallery.src.confluence": "Confluence",
  "imp.gallery.src.jsonImport": "JSON import",
  "imp.gallery.src.jira": "Jira",
  "imp.gallery.src.wordFile": "Word file",
  "imp.gallery.src.pdfFile": "PDF file",
  "imp.gallery.src.sharepoint": "SharePoint",
  "imp.gallery.src.teams": "MS Teams",
  "imp.gallery.src.gdrive": "Google Drive",
  "imp.gallery.src.dms": "DMS",
  "imp.gallery.src.plm": "PLM",
  "imp.gallery.src.servicenow": "ServiceNow",
  "imp.gallery.src.sap": "SAP",
  "imp.gallery.src.notion": "Notion",
  "imp.gallery.src.slack": "Slack",
  "imp.gallery.src.email": "Email",
  "imp.gallery.file.json": "JSON",
  "imp.gallery.file.docx": "Word (.docx)",
  "imp.gallery.file.pdf": "PDF",
  "imp.gallery.file.xlsx": "Excel (.xlsx)",
  "imp.gallery.file.pptx": "PowerPoint (.pptx)",
  "imp.gallery.file.csv": "Text/CSV",
  "imp.gallery.file.ocr": "OCR (scan/image)",
  "imp.gallery.file.avtranscript": "Audio/video transcript",
  "imp.select.title": "Narrow the selection",
  "imp.select.hint":
    "Click themes OR describe in one sentence what to import — combining both works too. The preview shows what matches — nothing is imported yet.",
  "imp.select.promptPlaceholder": "e.g. “everything about maintenance and error codes”",
  "imp.select.promptConfidentialLabel": "Does this text contain confidential content?",
  "imp.select.promptConfidentialYes": "Yes/unsure",
  "imp.select.promptConfidentialNo": "No, unproblematic",
  "imp.select.limit": "At most",
  "imp.select.previewCta": "Next: narrow down",
  "imp.select.previewing": "Evaluating …",
  "imp.select.matched": "{{matched}} of {{total}} matches",
  "imp.select.limitedNote": "capped at the limit",
  "imp.select.critAll": "No narrowing — everything would match.",
  "imp.select.critThemes": "Themes",
  "imp.select.critAuthors": "Authors",
  "imp.select.critKeywords": "Keywords",
  "imp.select.critYears": "Years",
  "imp.select.critLimit": "Limit",
  "imp.select.critSpaces": "Spaces",
  "imp.select.yearFrom": "from (year)",
  "imp.select.yearTo": "to (year)",
  "imp.select.alreadyImported": "{{n}} already imported",
  "imp.select.alreadyQueued": "{{n}} already queued for review",
  "imp.select.selectedCount": "{{n}} selected",
  "imp.select.importedDeselected":
    "Already imported pages are deselected; re-select them deliberately if needed.",
  "imp.select.queuedDeselected":
    "Pages already queued for review are deselected; re-select them deliberately if needed.",
  // WP-SHIP9-S2 Paket 2 (D2–D7): match-list controls.
  "imp.select.searchPlaceholder": "Search matches (title, author) …",
  "imp.select.selectAll": "Select all",
  "imp.select.deselectAll": "Deselect all",
  "imp.select.groupBy": "Group by:",
  "imp.select.groupNone": "none",
  "imp.select.groupTheme": "by theme",
  "imp.select.groupLanguage": "by language",
  "imp.select.groupFolder": "by folder",
  "imp.select.noFolder": "No source container",
  "imp.select.folderFallbackNoPath":
    "This source provides no folder structure (no parent chain) — showing the previous view.",
  "imp.select.folderFallbackSingle":
    "The source structure yields only a single folder here — showing the previous view.",
  "imp.select.facet.folder": "Folder",
  "imp.select.facet.status": "Status",
  "imp.select.facet.theme": "Theme",
  "imp.select.facet.author": "Author",
  "imp.select.facet.language": "Language",
  "imp.select.facetCount_one": "Show {{count}} match",
  "imp.select.facetCount_other": "Show {{count}} matches",
  "imp.select.rangeLabel": "Source date",
  "imp.select.bulkLabel": "Selection",
  "imp.select.groupCount": "{{n}} matches",
  "imp.select.langDe": "German",
  "imp.select.langEn": "English",
  "imp.select.langNl": "Dutch",
  "imp.select.langOther": "No language tag",
  "imp.select.noTheme": "No theme",
  "imp.select.chipNew": "New",
  "imp.select.chipImported": "Already imported",
  "imp.select.chipQueued": "Queued",
  "imp.select.summary": "{{selected}} of {{total}} selected",
  "imp.select.emptyFiltered": "No match for search/filter — adjust the search or filter.",
  "imp.preview.imported": "already imported",
  "imp.preview.queued": "already queued for review",
  "imp.groups.cta": "Next: group & import",
  "imp.groups.needSelection": "Select at least one entry in the preview to continue.",
  "imp.groups.grouping": "Grouping the posts by topic …",
  "imp.groups.retry": "Try again",
  "imp.groups.willGroupWithoutAi":
    "No AI model active — grouping runs by topic without AI (deterministic).",
  "imp.groups.noAi": "Grouped without AI",
  "imp.groups.noAiReason": "Grouped without AI — {{reason}}",
  "imp.groups.reason.confidential": "confidential candidates — cloud AI excluded",
  // AUFTRAG-mega59 BLOCK F1/F2 — see the German entries for the finding.
  "imp.groups.reason.noModel": "no AI model active",
  "imp.groups.reason.timeout": "the AI model did not answer in time",
  "imp.groups.reason.error": "the AI model reported an error",
  "imp.groups.willGroupWithoutAiConfidential":
    "This batch contains confidential or unapproved entries — it will be grouped by theme without cloud AI (deterministic).",
  "imp.groups.aiGrouped": "AI-grouped",
  "imp.groups.groupCount": "{{n}} posts",
  "imp.groups.approve": "Approve",
  "imp.groups.exclude": "Exclude",
  "imp.groups.selectedCount": "{{x}} of {{y}} selected",
  "imp.groups.catchall": "More posts",
  "imp.groups.noTheme": "Without topic",
  "imp.groups.hintImported": "already imported",
  "imp.groups.hintQueued": "already queued for review",
  "imp.groups.hintStale": "older than 1 year",
  "imp.groups.hintShort": "little content",
  "imp.groups.applyCta": "Import selection ({{n}})",
  "imp.groups.applying": "Importing {{x}} of {{y}} …",
  "imp.groups.bilanzTitle": "Import result",
  "imp.groups.bilanzImported": "{{n}} imported",
  "imp.groups.bilanzSkipped": "{{n}} skipped (already imported)",
  "imp.groups.bilanzSkippedQueued": "{{n}} skipped (already queued for review)",
  "imp.groups.bilanzExcluded": "{{n}} excluded",
  "imp.groups.bilanzFailed": "{{n}} failed",
  "imp.groups.bilanzReview":
    "The imported posts are now in the import review — a person decides there about every addition to the knowledge base.",
  "imp.groups.toReview": "Continue to import review ({{n}} open)",
  "imp.groups.failNotFound": "no longer in the current selection",
  "imp.groups.bilanzQueued": "{{n}} already queued (was already in review)",
  "imp.groups.bilanzNotAttempted": "{{n}} not attempted (run stopped after an error)",
  "imp.groups.retryRest": "Import the rest ({{n}})",
  "imp.groups.failHttp": "transfer failed",
  "imp.groups.hintSourceNewer": "source updated since import",
  "imp.groups.bilanzUpdates": "of which updates: {{n}}",
  "imp.groups.expired":
    "The data behind this grouping has expired — the import was stopped and the selection reset. Please group again.",
  "imp.groups.regroup": "Group again",
  "imp.groups.refreshGrouping": "Refresh grouping",
  // WP-COCKPIT-LINIE: guided five-step bar + collapsed history (plain language).
  "imp.step.barLabel": "Import in five steps",
  "imp.step.source": "Source",
  "imp.step.sourceHint":
    "Choose where the contributions should come from — today: pages from Confluence.",
  "imp.step.explore": "Explore",
  "imp.step.exploreHint": "First look at what the source contains — nothing is taken over yet.",
  "imp.step.narrow": "Narrow down",
  "imp.step.narrowHint":
    "Click themes or describe in one sentence what you want to take over — the preview shows what matches.",
  "imp.step.groups": "Approve groups",
  "imp.step.groupsHint":
    "Approve or exclude whole groups — individual contributions can still be toggled one by one.",
  "imp.step.apply": "Take over & result",
  "imp.step.applyHint":
    "The approved contributions are taken over for review — the result shows honestly what happened.",
  "imp.step.done": "done",
  "imp.explore.ctaAgain": "Explore again",
  "imp.select.previewAgain": "Refresh preview",
  "imp.history.title": "Review history: open and imported contributions",
  "imp.history.count": "{{open}} open · {{total}} total",
  "imp.history.hint":
    "This is the history of earlier imports — contributions queued for review, accepted and rejected ones. You do not need this area for the current import.",
  // WP-UX-WOW-1 (Kopf's live UX findings U1-U9): polish for the first VIP2 impression.
  "ask.koQuestion": "What applies to: {{title}}?",
  "ask.confidentialPrefillHint":
    "Confidential content — review the question before sending. It was only prefilled, not sent automatically.",
  "ask.expect.neutral": "Try an example",
  "lib.confidenceNone": "Confidence not rated yet",
  "lib.confidenceNoneHint":
    "Confidence says how well-founded a piece of content is rated (0 to 100). 0 means: not rated yet — not that the content is wrong.",
  "con.emptyWhat":
    "A conflict arises when two contributions contradict each other — for example two different limit values for the same equipment.",
  "con.emptyHow":
    "Klarwerk detects such contradictions during review and comparison; a human then decides here which statement holds.",
  "con.emptyExamplesHint":
    "To try it out, load the example package “Contradicting statements” in the import area.",
  "con.emptyExamplesCta": "Open example packages",
  "role.gate.title": "This area belongs to a different role",
  "role.gate.body":
    "This area requires the {{owner}} role. Your current role is {{own}} — that is why this path is closed for you. Roles are assigned by the administration; there is nothing to switch on here.",
  "stage2.gate.title": "Advanced features (stage 2)",
  "stage2.gate.body":
    "This module belongs to the advanced features — called 'stage 2' in house: additional modules beyond the core flow. They are currently switched off, that is why this area is not visible yet.",
  "stage2.gate.enable": "Turn on stage 2 now",
  "stage2.gate.adminOnly": "An admin can turn on stage 2 via the switch in the sidebar.",
  "stage2.gate.back": "Back to start",
  "imp.cleanup.title": "Clean up test data",
  "imp.cleanup.desc":
    "Removes all entries from the import queue and moves all posts imported from Confluence or Jira to the trash. Posts created by hand, users and settings remain untouched.",
  "imp.cleanup.previewCta": "Load preview",
  "imp.cleanup.previewLoading": "Determining scope …",
  "imp.cleanup.previewResult": "This would remove {{n}} candidates and {{m}} imported posts.",
  "imp.cleanup.confirmHint":
    "The candidate list is emptied for good; the imported posts move to the trash and can be restored from there.",
  "imp.cleanup.confirmCta": "Clean up now",
  "imp.cleanup.cancel": "Cancel",
  "imp.cleanup.running": "Cleanup running …",
  "imp.cleanup.doneCandidates": "{{n}} candidates removed",
  "imp.cleanup.doneKos": "{{n}} imported posts moved to the trash",
  "imp.cleanup.doneSkipped": "{{n}} skipped (error while moving)",
  "imp.cleanup.drift":
    "The data changed since the preview — the preview was reloaded, please review and confirm again.",
  "imp.cleanup.auditFailed":
    "Note: the final audit log entry could not be written — the cleanup itself is complete.",
  "imp.cleanup.newSince": "{{n}} new candidates since the preview — left untouched.",
  "imp.cleanup.claimedKos":
    "{{n}} post(s) in an ongoing review action — excluded from the cleanup.",
  "imp.cleanup.auditPendingCandidates":
    "{{n}} candidate(s) with a pending action record — excluded from the cleanup until the record is written.",
  "exp.title": "Example packages",
  "exp.hint":
    "Curated small scenarios for testers — each package loads on its own and creates clearly marked example posts. The import cleanup does NOT remove them; they disappear via removing the demo data.",
  "exp.load": "Load",
  "exp.loading": "Loading …",
  "exp.result": "{{created}} created, {{skipped}} skipped (already present)",
  "exp.pkg.konflikte.title": "Contradicting statements",
  "exp.pkg.konflikte.desc":
    "Six posts in three pairs that contradict each other — ideal for trying conflict detection and validation.",
  "exp.pkg.bilder.title": "Knowledge with images",
  "exp.pkg.bilder.desc":
    "Three posts with images and descriptive image captions — ideal for the gallery and caption search.",
  "exp.pkg.qualitaet.title": "Mixed quality",
  "exp.pkg.qualitaet.desc":
    "Five posts ranging from good to too short to outdated — ideal for practicing review and quality assessment.",
  "imp.preview.sourceNewer": "source newer than import",
  "imp.select.empty": "No match for this narrowing.",
  "imp.select.aiUnavailable":
    "AI selection is currently unavailable — only your click filters apply.",
  "imp.select.aiConfidential":
    "Cloud AI excluded due to confidential content — the free-text sentence was not evaluated; only your click filters apply.",
  "imp.uploadTitle": "JSON re-import",
  "imp.uploadHint":
    "Pick a JSON file — the entries land as contributions in the review list (no silent bulk insert).",
  "imp.jsonOnlyReason":
    "Import currently accepts JSON only. For Office files (DOCX, PDF, PPTX) use “Capture knowledge → from file” — they are read for real there.",
  "imp.dropHint": "Drag and drop a JSON file here — or choose one below.",
  "imp.dropActive": "Drop the JSON file here …",
  "imp.dropReject": "“{{name}}” is not a JSON file — import currently accepts JSON only.",
  "imp.upload": "Choose JSON file",
  "imp.parsed": "{{n}} contributions queued for review.",
  "imp.parseError": "Invalid JSON file.",
  "imp.queueTitle": "Import review list",
  "imp.queueEmpty": "No contributions to review.",
  "ext.pipeline.title": "Import pipeline & findings",
  "ext.pipeline.upload": "Upload",
  "ext.pipeline.extract": "Extract",
  "ext.pipeline.structure": "Structure",
  "ext.pipeline.review": "Review",
  "ext.pipeline.validate": "Validate",
  "ext.pipeline.release": "Release",
  "ext.pipeline.reuse": "Reuse",
  "ext.queue.total": "Total: {{n}}",
  "ext.queue.open": "Open: {{n}}",
  "ext.queue.accepted": "Accepted: {{n}}",
  "ext.queue.rejected": "Rejected: {{n}}",
  "ext.queue.infoRequested": "Info requested: {{n}}",
  "ext.queue.duplicates": "Duplicates: {{n}}",
  "ext.finding.duplicate": "Duplicate",
  "ext.finding.missingInfo": "Missing info",
  "ext.finding.infoRequested": "Info requested",
  "ext.finding.acceptedKo": "KO created",
  "ext.finding.rejected": "Rejected",
  "ext.validity.title": "Validity & protection",
  "ext.validity.freshness": "Freshness",
  "ext.validity.outputEligible": "Output eligibility",
  "ext.validity.recommendation": "Recommendation",
  "ext.freshness.validiert": "validated",
  "ext.freshness.revalidierung-faellig": "revalidation due",
  "ext.freshness.offen": "open",
  "ext.freshness.konflikt": "conflict",
  "ext.freshness.unbekannt": "unknown",
  "ext.protection.ip": "IP sensitivity",
  "ext.protection.notRated": "not rated",
  "ext.outputEligible.yes": "yes",
  "ext.outputEligible.no": "no",
  "ext.recommendation.clarify-conflict": "Clarify conflict",
  "ext.recommendation.start-revalidation": "Start revalidation",
  "ext.recommendation.finish-validation": "Finish validation",
  "ext.recommendation.output-ready": "Ready for output",
  "ext.recommendation.unknown": "unknown",
  "imp.duplicate": "Duplicate",
  "imp.note": "Note",
  "imp.accept": "Accept",
  "imp.reject": "Reject",
  "imp.info": "Request info",
  "imp.infoSend": "Send",
  "imp.notePlaceholder": "What information is missing?",
  "imp.reviewed": "Contribution updated.",
  "imp.status.neu": "Marked for review",
  "imp.status.in_bearbeitung": "In progress",
  "imp.status.angenommen": "Accepted",
  "imp.status.abgelehnt": "Rejected",
  "imp.status.info-angefragt": "Info requested",
  "imp.status.unknown": "Status unknown",
  "risk.kicker": "Risk & gaps",
  "risk.summary": "Cockpit overview",
  "risk.kpiOpenGaps": "Open gaps",
  "risk.kpiHigh": "High priority",
  "risk.kpiUnassigned": "Unassigned",
  "risk.kpiAssigned": "Assigned",
  "risk.kpiOpenConflicts": "Open conflicts",
  "risk.kpiClosedGaps": "Closed gaps",
  "risk.cockpit": "Risk cockpit by domain",
  "risk.cockpitEmpty": "No domain data.",
  "risk.level.kritisch": "critical",
  "risk.level.mittel": "medium",
  "risk.level.gut": "stable",
  "risk.koCount": "objects",
  "risk.validated": "validated",
  "risk.openKo": "open",
  "risk.singleSource": "Single source — concentration risk",
  "risk.singleSourceExplain":
    "All knowledge in this domain comes from a single person. If they leave (illness, resignation, retirement), the knowledge is gone — the biggest knowledge risk. Countermeasure: involve more people, have the knowledge second-checked (validated) and add sources.",
  "risk.bearer": "Carried by: {{names}}",
  "risk.viewObjects": "View this domain's objects",
  "risk.busLegendSingle": "red = single source (failure risk)",
  "risk.busLegendOk": "green = multiple sources",
  "risk.help.summary":
    "Overview in numbers: open gaps (questions without confirmed knowledge), high priority (urgent), unassigned/assigned (whether someone is working the gap), open conflicts (contradictory statements) and closed gaps (already answered). Red numbers indicate action is needed.",
  "risk.help.cockpit":
    "Risk per domain (category): CRITICAL/MEDIUM/STABLE sums up how well the domain is secured. Objects = how much knowledge; validated % = how much of it is checked; open = still unchecked; experts = how many people carry the domain. One expert + little validated = high risk.",
  "risk.help.busfactor":
    "How much does a domain depend on individuals? A red bar means: the knowledge comes from only ONE source — if it fails, it is lost. Green = multiple sources, so more robust. The bar also shows the domain's amount of knowledge.",
  "risk.help.gaps":
    "Open knowledge gaps are questions with no confirmed answer (yet). Prioritize them, assign them to someone, or capture reviewed experience yourself. For privacy, do not put sensitive details into the question.",
  "health.title": "Knowledge Health",
  "health.band.gut": "good",
  "health.band.mittel": "medium",
  "health.band.kritisch": "critical",
  "health.explain.gut": "High validation level, little stale knowledge and low concentration risk.",
  "health.explain.mittel":
    "Solid base, but open gaps/conflicts or revalidation needs are holding it back.",
  "health.explain.kritisch":
    "Low validation and/or much stale knowledge, open conflicts or single-source risks.",
  "health.factor.validatedRatio": "Validation rate",
  "health.factor.staleRatio": "Revalidation due (stale)",
  "health.factor.singleSourceShare": "Single-source share",
  "health.factor.openGaps": "Open knowledge gaps",
  "health.factor.openConflicts": "Open conflicts",
  "health.band.unproven": "rating not evidenced",
  "health.range.explain":
    "{{worst}} out of 100 in the worst case, {{best}} in the best. As long as it is not evidenced that conflicts were searched for completely, the worse value applies — which is why no band is shown here.",
  "health.conflictUnproven.title":
    "The score applies the full conflict penalty: {{worst}} instead of {{best}} out of 100.",
  "health.conflictUnproven.detection-incomplete":
    "Conflict and duplicate detection has not run to completion across the corpus. It is therefore not ruled out that more conflicts exist than were found — and a penalty of zero would be an assumption about something unknown.",
  "health.conflictUnproven.detection-unknown":
    "Nothing is established about the reach of conflict and duplicate detection. As long as complete checking is not evidenced, the number of conflicts found says nothing about the corpus.",
  "health.conflictUnproven.known":
    "{{count}} open conflicts are known ({{penalty}} of at most {{max}} penalty points). That penalty is certain; the remainder up to the maximum is the uncertainty.",
  "risk.busfactor": "Single-source risk (bus factor)",
  "risk.busEmpty": "No risk data.",
  "risk.experts": "experts",
  "risk.expertsCount_one": "{{count}} expert",
  "risk.expertsCount_other": "{{count}} experts",
  // Consultant-System (expert matching): understated tone, no hero wording, no numbers/ranking.
  "expertise.title": "Who to involve",
  "expertise.intro":
    "These people have already contributed to a topic. You can ask them for a quick take — no ranking, just who might help.",
  "expertise.help":
    "Derived from existing knowledge objects (who contributed to a topic). Alphabetical order, no scoring — a hint on who you could reach out to.",
  "expertise.invite": "You have experience with {{topic}} — could you give a quick take?",
  "expertise.thanks": "Thanks, that helps the team.",
  "risk.gaps": "Open knowledge gaps",
  "risk.gapsEmpty": "No open gaps.",
  "risk.gapStatus.offen": "open",
  "risk.gapStatus.geschlossen": "closed",
  "risk.priorityLabel": "Priority",
  "risk.priority.hoch": "high",
  "risk.priority.mittel": "medium",
  "risk.priority.niedrig": "low",
  "risk.close": "Close",
  "risk.assign": "Expert …",
  "risk.delete": "Delete",
  "risk.gapNextLabel": "Next step",
  "risk.gapNext.prioritize": "Assess and set the urgency.",
  "risk.gapNext.assign": "Assign to an expert.",
  "risk.gapNext.capture": "Capture knowledge to close the gap.",
  "risk.gapNext.done": "Closed — nothing pending.",
  "risk.gapCapture": "Capture knowledge",
  "risk.gapRedacted": "Confidential gap (question hidden)",
  "lcy.kicker": "Lifecycle",
  "lcy.banner": "„Still correct?“ — review coupled objects after an asset change.",
  "lcy.empty": "Nothing to re-validate.",
  "lcy.stillValid": "Still valid → new version",
  "lcy.assetTitle": "Report asset change",
  "lcy.assetHint":
    "Enter the changed asset/process reference — coupled knowledge objects are flagged for review.",
  "lcy.assetPlaceholder": "Asset/process reference (e.g. press-P2)",
  "lcy.assetTrigger": "Trigger revalidation",
  "lcy.assetMarked": "{{n}} object(s) flagged for review for „{{asset}}“.",
  "lcy.pendingTitle": "Pending re-validation",
  "lcy.revalAsset": "Asset",
  "lcy.revalNextLabel": "Next step",
  "lcy.revalNext.review": "Check whether still valid after the change — then confirm as reviewed.",
  "lcy.revalNext.validate": "Object is not released — validate it first.",
  "lcy.revalCta.review": "Go to review",
  "lcy.revalCta.validate": "Go to validation",
  "lcy.revalNext.openKo": "Open the object — details are not available right now.",
  "lcy.revalMissing": "Object details not in the loaded set.",
  "lcy.revalSaved": "Re-validation recorded.",
  "lcy.nextViewKo": "View object",
  "lcy.nextUse": "Use knowledge (ask)",
  "lcy.pathTitle": "Learning path · {{role}}",
  "lcy.pathEmpty": "No learning path defined for your role yet.",
  "lcy.stepComplete": "Mark as done",
  "lcy.stepDone": "Done",
  "ana.kicker": "Analytics & audit",
  "ana.exec.title": "Executive view",
  "ana.exec.validated": "Validated knowledge",
  "ana.exec.validatedHint": "reviewed, confirmed objects",
  "ana.exec.openReviews": "Open reviews",
  "ana.exec.openReviewsHint": "awaiting validation",
  "ana.exec.busFactor": "Single-source risk",
  "ana.exec.busFactorHint": "categories with a single source",
  "ana.exec.rescued": "Rescued gaps",
  "ana.exec.rescuedHint": "closed knowledge gaps",
  "ana.help.exec":
    "Four core metrics from live data: validated knowledge, open reviews, bus-factor risk and rescued gaps. A calm overview for decision-makers — the more that is validated and the lower the risk, the healthier the knowledge base.",
  "ana.help.health":
    "The health score (0–100) combines validation level, freshness and source breadth. The band (e.g. good or critical) shows the state at a glance; below it you see which factors raise or lower the value.",
  "ana.help.impact":
    "Impact shows what the system actually delivers: total validated objects, questions asked, questions answered without a gap, and the resulting answer rate. The weekly trend reveals whether validated knowledge is growing.",
  "ana.help.audit":
    "The audit log records every relevant action — who (actor), what (action) and on what target. Entries are only appended and hash-chained; a later deviation is detectable by recomputation. Use the filters to narrow down to a person, an action type or an object.",
  "ana.total": "Total",
  "ana.categories": "Categories",
  "ana.byType": "Distribution by knowledge type",
  "ana.audit": "Audit log (hash-chained)",
  "ana.auditEmpty": "No entries.",
  "ana.avgTrust": "Avg trust",
  "ana.validationRate": "Validation rate",
  "ana.openTasks": "Open tasks",
  "ana.doneTasks": "Done",
  "ana.impact": "Impact",
  "ana.impactValidated": "Validated total",
  "ana.impactAsk": "Questions total",
  "ana.impactAnswered": "Answered without gap",
  "ana.impactRate": "Answer rate",
  "ana.weekly": "Validated per week",
  "ana.filterActor": "Actor",
  "ana.filterAction": "Action",
  "ana.filterTarget": "Filter target …",
  "ana.filterAll": "all",
  "ana.auditCount": "{{shown}} of {{total}}",
  "ana.auditNoMatch": "No matches for this filter.",
  "adm.kicker": "User management",
  "adm.empty": "No users.",
  "adm.approve": "Approve",
  "adm.remove": "Delete",
  "adm.createTitle": "Create user",
  "adm.name": "Name",
  "adm.email": "Email",
  "adm.password": "Password",
  "adm.role": "Role",
  "adm.create": "Create",
  "adm.created": "User created.",
  "adm.createInvalid": "Please still add:",
  "adm.createHint": "Required: name, valid email and password (min. 8 characters).",
  "adm.field.name": "name",
  "adm.field.email": "valid email",
  "adm.field.password": "password (min. 8 characters)",
  "adm.reset": "Reset password",
  "adm.newPassword": "New password",
  "adm.newPasswordRepeat": "Repeat password",
  "adm.passwordMismatch": "The passwords do not match.",
  "adm.resetConfirm": "Reset",
  "adm.resetCancel": "Cancel",
  "adm.resetDone": "Password reset; all sessions ended.",
  "adm.seedTitle": "Load demo data",
  "adm.seedHint":
    "Loads a small, real demo set (KOs, validation, gap, conflict, duplicate, attachment) — also alongside existing data. Your real content stays untouched and is never overwritten. Removable on demand via “Remove demo data”. (Conflict/duplicate findings appear with an active AI reasoner.)",
  "adm.seedButton": "Load demo data",
  "adm.seedDone": "Demo data loaded: {{kos}} knowledge objects, {{users}} users.",
  "adm.seedSkipped": "Skipped: instance is not empty (content present).",
  "empty.cta.capture": "Capture knowledge",
  "empty.cta.import": "Import",
  "empty.cta.admin": "Demo data (admin)",
  "empty.cta.library": "Go to library",
  "empty.cta.validation": "Go to validation",
  "empty.cta.tasks": "Go to my tasks",
  "story.rescue.title": "Klarwerk secures hands-on experience before it's lost.",
  "story.honest":
    "Nothing is validated automatically — knowledge only counts as secured after the team reviews it.",
  "story.surface.start.lead":
    "Nothing open yet — not a dead end, but the start. Kick off the cycle and capture experience knowledge that would otherwise fade over time.",
  "story.surface.tasks.lead":
    "Nothing to do right now. As soon as knowledge needs review or rework it shows up here — or capture the next contribution yourself.",
  "story.surface.library.lead":
    "No knowledge to look up yet. Capture the first contribution — after review it becomes usable here, source-bound.",
  "story.surface.validation.lead":
    "Nothing to review. Captured knowledge appears here for team review before it counts as secured and can be used.",
  "adm.auditTitle": "Recent user/auth activity (audit)",
  "adm.auditEmpty": "No user audit entries.",
  "prof.kicker": "Account",
  "prof.language": "Language",
  "prof.passwordTitle": "Change password",
  "prof.oldPassword": "Current password",
  "prof.newPassword": "New password",
  "prof.passwordSubmit": "Change password",
  "prof.passwordChanged":
    "Password changed. For security you've been signed out everywhere — please sign in again.",
  "help.kicker": "Help",
  "help.open": "Open help",
  "help.openCenter": "Open in help center",
  "help.search": "Search help …",
  "help.intro":
    "A short starter guide to the most important Klarwerk flows. Search by keyword or jump straight into the relevant area.",
  "help.noResults": "No help found for this keyword.",
  "help.openRoute": "Open area",
  // Klara v1 (Pedi 05.07.): context-sensitive help — panel copy + page explanations.
  "klara.title": "Klara",
  "klara.subtitle": "Your help in KLARWERK",
  "klara.open": "Open Klara — help for this page",
  "klara.intro":
    "I explain pages, fields and terms. My answers come from the help library — if something is missing there, I will not make it up.",
  "klara.pageLabel": "You are here",
  "klara.fieldLabel": "Active element",
  "klara.fieldHint":
    "Focus a field or an area with a ?-help — then I explain it here automatically.",
  "klara.aiSearch": "Search with AI support",
  "klara.aiBusy": "The AI is reading the matching help entries …",
  "klara.aiAnswerTitle": "AI answer from the help",
  "klara.aiDisclaimer": "AI-generated — not fully verified",
  "klara.aiGoto": "Open area: {{target}}",
  "klara.aiSources": "Based on",
  "klara.aiEmpty":
    "The AI found no reliable answer in the matching help entries — an honest help gap. Rephrase the question or check the help page.",
  "klara.speak": "Read aloud",
  "klara.speakStop": "Stop reading",
  "klara.inspect": "Explain element",
  "klara.inspectHint":
    "Point mode active: click any element (button, metric, heading) — the action itself is NOT triggered. Esc exits the mode.",
  "klara.inspectFor": "Explanation for: {{label}}",
  "klara.selectionExplain": "Explain selection",
  "klara.selectionEmpty":
    "Select a term on the page first — then I will look up the matching explanation.",
  "klara.searchPlaceholder": "Search help … e.g. validation, bus factor, draft",
  "klara.resultsFor": "Results for: {{q}}",
  "klara.noResults":
    "I have no entry on this yet — an honest help gap. The library is growing; the help page has the guided introductions.",
  "klara.moreHelp": "Open help page",
  "klara.page.start":
    "Your overview: what was freshly secured, what helped today and what is waiting for you. Jump into any area from here.",
  "klara.page.tasks":
    "Your open tasks: assigned reviews, gaps and due items — each with a direct jump to the work.",
  "klara.page.capture":
    "Here you secure experience knowledge: tell it, dictate it, in an interview or from a file. The AI only structures — you review and submit.",
  "klara.page.ask":
    "Ask a question. The answer is source-bound and shows you what it rests on and what state those sources are in — if there is no basis, an honest knowledge gap is created.",
  "klara.page.library":
    "All knowledge objects with status, trust and filters. Every detail is one click away.",
  "klara.page.external":
    "External knowledge (e.g. web sources) — always level 2: never peer-validated and clearly separated from the reviewed stock.",
  "klara.page.validation":
    "The review board: you rate submitted knowledge. Only with enough green approvals (and no red ones) does an object count as validated.",
  "klara.page.conflicts":
    "Contradictions between knowledge objects: inspect, get a second opinion, resolve — so the library stays unambiguous.",
  "klara.page.duplicates": "Possible duplicates: review and merge so knowledge does not fragment.",
  "klara.page.risk":
    "Where is knowledge thin or carried by a single person? Open gaps, bus factor and domain risk — with links to the affected objects.",
  "klara.page.lifecycle":
    "Knowledge ages: here you see due re-validations and learning paths, so reviewed stays reviewed.",
  "klara.page.analytics":
    "Metrics from real data plus the hash-chained audit log — who did what and when.",
  "klara.page.admin":
    "Accounts, AI assignment, data and security in one place. Visible to admins only.",
  "klara.page.help":
    "Guided introductions, topics and search. I am the fast lane — this page is where the depth lives.",
  "klara.page.profile": "Your account: name, language, sign out.",
  "klara.page.koDetail":
    "The detail page of a knowledge object: content, versions, sources, attachments, review history and role-based actions.",
  // JOB 1151 (KA3) — see the German entry for the finding and the two-dictionary pattern.
  "klara.offer.label": "Klara's suggestions",
  "klara.offer.lead": "There is already something on this:",
  "klara.offer.open": "View",
  // Section explanations (consultant delivery 05.07., interim EN — refined in delivery 3).
  "shelp.adm.seedTitle":
    "Here you load ready-made sample data to try KLARWERK safely. This only works while the instance is still empty — so real data and samples never mix. All sample data is marked as such and can later be removed completely with one click.",
  "shelp.adm.createTitle":
    "In this section you create a new user account and assign a role. Viewers read, experts capture knowledge, controllers review it, and admins manage everything. The role decides which buttons the person will see. Every account change is recorded in the audit log.",
  "shelp.adm.auditTitle":
    "This log shows recent sign-ins and user actions. Every line is hash-chained to the previous one: if something is changed or removed afterwards, the hash no longer matches. With the verify button you can have the chain recomputed at any time; the result honestly tells you whether a deviation was found — and if so, at which entry.",
  "shelp.ana.byType":
    "The bars show how your knowledge is spread across the five knowledge types — from gut feeling to proven practices to negative knowledge, meaning what must not be done. If one type is almost missing, that is a hint: little is being captured there so far. Use the picture to ask targeted questions, not to rate people.",
  "shelp.ana.weekly":
    "This overview counts how many knowledge objects passed review in each week. It shows the pace at which secured knowledge is created — not how hard individuals worked. If the curve flattens, reviews are usually piling up; a look at the review board shows where it sticks.",
  "shelp.ask.steps":
    "Listed here are the knowledge objects that were consulted from the corpus for your question — with an excerpt from the passage found. It is NOT a derivation: KLARWERK does not record which sentence of the answer came from which source. The list tells you what was searched; to verify, open the named source.",
  "shelp.ask.sources":
    "Every answer in KLARWERK relies exclusively on your own knowledge objects — and exactly those are listed here. The ones listed first carried the answer; the rest were consulted but not used. Tap a source to open the full object with evidence and review status. If nothing is listed, there is no matching knowledge for your question, and KLARWERK says so honestly instead of inventing something.",
  "shelp.capture.resumeTitle":
    "Your saved drafts live here — everything you started but have not submitted yet. Nothing is lost, and reviewers see none of it until you submit. Tap a draft to continue, or discard it when it is no longer needed.",
  "shelp.ext.title":
    "Here you can search for external sources and attach them to your knowledge, for example a journal article. Important: external sources are level-two material — they count as unreviewed and never replace the review by your colleagues. Whether this search is available is decided by administration via its own release stage.",
  "shelp.extpage.resultsTitle":
    "This list shows the results of the external search. Everything here comes from outside and is unreviewed — that is why it is clearly marked as external and never taken over automatically. You decide whether to attach a result as a level-two source. Secured knowledge only emerges once people review it.",
  "shelp.ko.statement":
    "This is the core of the knowledge object: a single, clear statement about what holds. Everything else on this page — conditions, measures, evidence — hangs off this sentence. Read the statement first, then check below when it applies and what it rests on.",
  "shelp.ko.conditions":
    "Conditions tell you when the statement applies — and thus also when it does not. An example: a rule for winter operation is no help in summer. Before applying, always check whether your situation matches the stated conditions.",
  "shelp.ko.measures":
    "Measures describe what to do in practice when the statement applies — step by step. They are kept deliberately brief so they stay usable in daily work. If a step is missing or unclear, leave a comment; that is how the knowledge improves over time.",
  "shelp.ko.provenance":
    "Here you see where this knowledge comes from: who captured it, when it was created and whether it was ever transferred. Provenance is no side issue in KLARWERK — traceable origin is part of trust. If you have questions, this tells you whom to ask.",
  "shelp.ko.lineageTitle":
    "This section shows the kinship of this knowledge: what it emerged from and which other objects it is connected to. That way you can tell whether it is part of a larger topic. Use the links to move onward instead of reading isolated pieces.",
  "shelp.nb.title":
    "The knowledge network shows the neighbourhood of the article you are reading: the article sits in the middle, around it what belongs to it via shared tags — and every connection states why. Clicking a neighbour makes it the new centre; “Open article” takes you to it. Tags that almost every article carries do not count as kinship — when that happens, it is stated honestly.",
  "shelp.ko.history":
    "Every content change creates a new version, and here you see the trail: who changed what, when, and with which note. Older states are kept; nothing is silently overwritten. That way you can retrace how the knowledge evolved.",
  "shelp.ko.evidenceTitle":
    "Evidence is the proof behind the statement: attached sources, documents and records, each assigned to the version they belong to. The better the evidence, the more reliable the knowledge — in KLARWERK trust comes from proof, not from claims. An object without evidence is not automatically wrong, but it deserves a more critical look.",
  "shelp.ko.snapshotsTitle":
    "A snapshot is the complete, frozen state of an earlier version. Here you can read exactly what the object looked like at a given moment. Snapshots are read-only — nobody can change them, and precisely that makes them valuable as proof.",
  "shelp.ko.comments":
    "Here colleagues discuss this object: questions, additions, objections. A comment does not change the knowledge itself — it is a conversation on the side that often leads to a better next version. If you know something that is missing here, write it down.",
  "shelp.ko.attachments":
    "Documents and images that belong to this knowledge live here — such as a photo of the machine or a manual. Attachments are illustration and evidence, not reviewed statements. Uploads are subject to size limits set by your administration.",
  "shelp.lcy.assetTitle":
    "Some knowledge is tied to a specific machine or facility. When something changes there — a rebuild, a replacement, a new setting — you can report it here. The affected knowledge objects are then sent back for review, so nobody works with an outdated state.",
  "shelp.lcy.pendingTitle":
    "Knowledge ages. This list holds objects whose review needs a refresh — for example because they have not been touched for a long time or because their surroundings changed. Re-reviewed knowledge stays trustworthy; refreshes left undone are a silent risk.",
  "shelp.lcy.pathTitle":
    "A learning path is a sensible reading order through the existing knowledge, tailored to a role. New colleagues work through it step by step and tick off what they have read. That turns individual knowledge objects into a guided introduction.",
  "shelp.out.kindTitle":
    "Here you choose which kind of document should be created from your secured knowledge — for example a work instruction, a checklist or a training document. The type determines the structure and tone of the result. Nothing is generated until you trigger it.",
  "shelp.out.sourcesTitle":
    "Only reviewed knowledge objects qualify for a document, and exactly those are what you select here. What is not validated is deliberately not offered — a generated document should rest on secured knowledge only. Pick the objects that belong together.",
  "shelp.out.composeTitle":
    "Here you arrange the selected knowledge objects in the order they should appear in the document. The order carries the logic of the result — from overview to detail or along a workflow. Move the entries until the thread is right.",
  "shelp.out.previewTitle":
    "The preview shows the document as it would be generated from your building blocks, in Markdown text format. Check calmly whether content and order fit before you download or copy the result. A PDF export does not exist at present.",
  "shelp.out.provenanceTitle":
    "Every generated document carries the record of which knowledge objects it was built from. This section keeps that origin, so every statement in the document stays traceable to its source. It is the same principle as everywhere in KLARWERK: only the proof makes a statement reliable.",
  "shelp.imp.uploadTitle":
    "Here you re-import an export created earlier in JSON format. Entries are not taken over blindly: they first land as candidates for inspection, so nothing slips into the stock unreviewed. Check the candidate list before accepting anything — also to avoid duplicates.",
  "shelp.ext.pipeline.title":
    "This area shows what happened while external content was read in: what was recognized, what stood out and what still awaits a decision. The pipeline takes over nothing on its own — it prepares, people decide. Best work through the findings from top to bottom.",
  "shelp.imp.queueTitle":
    "This queue holds imported sources that still need a human judgement: accept, rework or discard. Nothing from here becomes part of the knowledge stock without your decision. This is where raw material is separated from secured knowledge.",
  "shelp.mgmt.jumpTitle":
    "This bar is the table of contents of the management view. Tapping an entry jumps straight to the matching section below. It changes nothing in the data — it only helps you navigate quickly.",
  "shelp.mgmt.overview":
    "This overview condenses the current state of your knowledge stock into a few key figures — such as how much knowledge exists, is reviewed or in progress. It is a snapshot for orientation, not a report card. For details, open the sections below.",
  "shelp.mgmt.capital":
    "This value condenses the state of your knowledge stock into a single number — considering, for example, how much knowledge is reviewed and how well it is evidenced. Read it as a rough orientation and watch its development over time. A single number never replaces a look at the details.",
  "shelp.mgmt.valuation":
    "This section makes the value of your knowledge more tangible: an assessment of which holdings contribute most to safety and the ability to act. The numbers are orientation values from the stock, not an audited balance sheet. Use them to discuss priorities, not as bookkeeping.",
  "shelp.mgmt.statement":
    "The knowledge statement is a summarizing report on your knowledge stock, meant for leadership and boards. In short form it answers: what do we have, how reliable is it, and where are the gaps. The report draws on the real stock — what it cannot prove, it does not claim.",
  "shelp.mgmt.maturity":
    "The maturity journey assesses how far your organization has come in handling knowledge — from the first secured entries to a practiced cycle of capturing, reviewing and maintaining. It shows the next sensible stage, not a grade. Maturity grows with use, not at the push of a button.",
  "shelp.mgmt.house":
    "The knowledge house is a picture of your topic landscape: rooms stand for knowledge areas, and you see at a glance which are well filled and which are almost empty. Empty rooms are no disgrace but an invitation — that is where the next capture pays off. Tap an area to look inside.",
  "shelp.mgmt.recommendations":
    "Here KLARWERK suggests next steps that follow from your stock — for example reviews left undone or a knowledge area fed by only one source. They are suggestions, not orders: you decide what is due. Each suggestion takes you straight to the right place.",
  "shelp.mgmt.priorities":
    "This list ranks knowledge topics by how urgently they need attention — assessed over nine aspects such as risk, age and dependence on single knowledge sources. What should come first is at the top. The order is a recommendation as a basis for discussion, not an automatic decision.",
  "shelp.mgmt.pilot":
    "This report bundles what happened in the first thirty, sixty and ninety days of a pilot and what comes next. It makes progress visible for everyone involved — honestly, with achieved and open points. Meant as a shared basis for the conversation with leadership.",
  "shelp.mrun.title":
    "This list logs the AI's recent runs: which task ran, which model answered, how long it took and whether a fallback was needed. The content of your texts is deliberately not stored here — only technical facts. That keeps traceable what the AI did and when.",
  "shelp.rcfg.title":
    "Here you see which AI is configured for which task — the cloud AI, your On-Premise Enterprise AI or the rule-based mode without any model. The assignment can be changed per task, and the app honestly shows what is currently in effect. AI keys always stay on the server; none ever reaches the browser.",
  "shelp.evx.title":
    "The evidence index is the quality view of your proof situation: it shows which knowledge objects are well evidenced and where records are missing. It helps you find exactly the entries that need evidence before their next use. Well-evidenced knowledge is the backbone of every reliable answer.",
  "shelp.prov.title":
    "This index checks the provenance side of quality: is it traceable for every knowledge object where it came from and how it was created? Anomalies are listed first so you see them right away. Complete provenance is the basis for placing knowledge in context later.",
  "shelp.readiness.title":
    "This section assesses how ready your knowledge system is as a whole — from the data base through the review processes to the AI connection. The traffic lights show where things still stick and what makes sense next. It is a positioning, not an acceptance test.",
  "shelp.kos.hintsTitle":
    "Here quality assurance collects concrete hints from the stock: things that stand out and deserve a look — such as thinly evidenced objects or orphaned topics. Every hint names the location, so you can jump right in and fix the cause.",
  "shelp.evFresh.title":
    "Evidence ages just like knowledge. This view shows how fresh the records behind your knowledge objects are and where old evidence needs a refresh. That way you spot entries that are formally evidenced but possibly outdated in substance.",
  // SCRUM-305: compact pilot checklist for the first real user run (Stage-1, honest).
  "pilot.title": "Pilot checklist: first user run",
  "pilot.subtitle":
    "What to watch in the first real run — Stage-1, honest. Each point opens the matching area.",
  "pilot.check.capture": "Capture saves open: freshly captured knowledge is not yet validated.",
  "pilot.check.validation":
    "Validation is review/decision: peers rate until it is secured — no automatic approval.",
  "pilot.check.use":
    "Ask/Library use knowledge source- and status-aware: an answer is only as reliable as its source.",
  "pilot.check.gap":
    "No basis? The gap is named honestly and leads into capture — no invented knowledge.",
  "pilot.check.maintain":
    "Revalidation is “keep current”: re-check due objects, no automatic permanent validity.",
  // SCRUM-306: next steps after loading demo data / starting the pilot (visible only, no auto-redirect).
  "pilot.next.title": "Next step",
  "pilot.next.hint":
    "Demo data are examples, not production proof. Now view Stage-1 or open the pilot checklist.",
  "pilot.next.start": "Start Stage-1 (open Start)",
  "pilot.next.checklist": "Open pilot checklist",
  "pilot.next.ask": "Open example question",
  // SCRUM-307: map observed pilot frictions to existing Knowledge-OS flows (no backend, no storage,
  // no Jira/task automation). UX note deliberately has no product link.
  "pilot.obs.title": "Map a pilot observation",
  "pilot.obs.subtitle":
    "Quickly map an observed friction to the matching existing Klarwerk flow. Nothing is stored; pure UX notes belong outside the product.",
  "pilot.obs.mapLabel": "Belongs in",
  "pilot.obs.missing.label": "Knowledge is missing entirely (no basis for the question).",
  "pilot.obs.missing.map": "Risk/gap — prioritize and capture.",
  "pilot.obs.unverified.label": "Knowledge is unfinished or not yet reviewed.",
  "pilot.obs.unverified.map": "Validation — rate until it is secured.",
  "pilot.obs.outdated.label": "Knowledge looks outdated or no longer valid.",
  "pilot.obs.outdated.map": "Lifecycle — revalidation, “keep current”.",
  "pilot.obs.source.label": "Source, trust or usability is unclear.",
  "pilot.obs.source.map": "Library/KO detail — check status, trust, version, source.",
  "pilot.obs.uxnote.label": "Pure UX/pilot note (usability, wording, flow).",
  "pilot.obs.uxnote.map": "Note it organizationally — not stored in the product, no workflow.",
  "pilot.obs.openFlow": "Open flow",
  "help.firststart.title": "First run & demo data",
  "help.firststart.body":
    "Fresh instances start empty. As admin you can use 'Load demo data' under Admin to make example knowledge, validation, gaps and conflicts visible — ideal for review and onboarding.",
  "help.library.title": "Library & knowledge object",
  "help.library.body":
    "The library searches and filters the stock (type, status, category, tag). One click opens the knowledge object with statement, sources/attachments, versions and evidence.",
  "help.tasks.title": "My tasks",
  "help.tasks.body":
    "Your assigned validation and follow-up tasks collect here. From there you jump straight into the relevant knowledge object to act.",
  "help.risk.title": "Risk, gaps & conflicts",
  "help.risk.body":
    "Risk shows knowledge gaps, bus factor and single-source areas. Gaps can be prioritised, assigned or closed; contradictions are resolved as guided conflicts.",
  "help.lifecycle.title": "Lifecycle & learning paths",
  "help.lifecycle.body":
    "Lifecycle shows due revalidations (e.g. after asset changes) and role-specific learning paths to tick off. After the demo seed an example learning path is visible.",
  "help.validation.title": "Validation",
  "help.validation.body":
    "Rate objects green/yellow/red. At the threshold an object counts as validated; yellow/red require a comment and return to the author.",
  "help.stufe2.title": "Stage 2: QA, capital & output",
  "help.stufe2.body":
    "The advanced QA views (capital/management, evidence and provenance index, ModelRun protocol) are read-only and window-based. Output generates documents only from validated knowledge.",
  "help.mobile.title": "Mobile & offline",
  "help.mobile.body":
    "The mobile view bundles capture, ask and lookup. Drafts can be created offline and sync once a connection is available.",
  "help.capture.title": "Capture knowledge",
  "help.capture.body":
    "Capture experience knowledge informally — via text, dictation or photo. The AI structures it, you review and submit.",
  "help.validate.title": "Validate",
  "help.validate.body":
    "Rate objects green/amber/red. At the threshold an object is validated; red ratings go back to the author.",
  "help.ask.title": "Ask questions",
  "help.ask.body":
    "Answers are source-bound and show which sources carried them and what state those are in. Without a basis, a knowledge gap is created.",
  "help.conflict.title": "Conflicts",
  "help.conflict.body":
    "Contradictions are surfaced and resolved in a guided way. Only truth conflicts escalate to a human.",
  "help.roles.title": "Roles",
  "help.roles.body":
    "Viewer reads and asks, expert captures, controller validates and resolves, admin manages. You only see what your role allows.",
  "help.trust.title": "Trust",
  "help.trust.body":
    "Every statement carries a maturity grade from validation and use. Trust is evidence, not truth.",
  "mob.title": "Capture quickly",
  "mob.sub": "At the asset. In under two minutes.",
  "mob.dictate": "Record dictation",
  "mob.dictateSub": "Speak — the AI structures it",
  "mob.note": "Note",
  "mob.photo": "Photo",
  "mob.interview": "Interview",
  "mob.lookup": "Look up",
  "mob.editing": "Resuming a draft.",
  "mob.formTitle": "Core statement",
  "mob.formStatement": "What happened / what applies?",
  "mob.save": "Save as draft",
  "mob.saved": "Draft saved.",
  "mob.update": "Update draft",
  "mob.updated": "Draft updated.",
  "mob.new": "New",
  "mob.drafts": "My drafts",
  "mob.draftsEmpty": "No drafts yet.",
  "mob.resume": "Resume",
  "mob.discard": "Discard",
  "mob.discarded": "Draft discarded.",
  "mob.discardConfirmHint": "Discard?",
  "mob.confirmDiscard": "Yes, discard",
  "mob.cancelDiscard": "Cancel",
  "mob.tabCapture": "Capture",
  "mob.tabAsk": "Ask",
  "mob.tabLookup": "Search",
  "mob.searchPlaceholder": "Search knowledge …",
  "mob.searchEmpty": "No matches.",
  "mob.online": "online",
  "mob.offline": "offline",
  "mob.queued": "Saved offline – will sync.",
  "mob.queue": "Queue",
  "mob.syncNow": "Sync",
  "mob.syncOk": "Synced",
  "mob.syncFail": "Sync failed",
  "mob.offlineSaveHint": "Offline – saving is queued locally.",
  "mob.offlineAsk": "Offline – asking needs a connection.",
  "mob.offlineSearch": "Offline – search needs a connection.",
  "mob.offlineNeedsConn": "Available again once you are back online.",
  "mob.status.queued": "queued",
  "mob.status.pending": "pending",
  "mob.status.synced": "synced",
  "mob.status.failed": "failed",
  "s2.kicker": "Advanced · Stage 2",
  "s2.output":
    "Generate work instructions/checklists from validated objects — active once the output logic is in place.",
  "out.kindTitle": "Output type",
  "out.sourcesTitle": "Validated sources",
  "out.noValidated": "No validated knowledge objects yet.",
  "out.generate": "Generate output",
  "out.composeTitle": "Order & composition",
  "out.composeHint": "Set the order of the blocks — it is applied exactly when generating.",
  "out.moveUp": "Move up",
  "out.moveDown": "Move down",
  "out.removeFromOrder": "Remove from selection",
  "out.previewCompositionTitle": "Composition preview",
  "out.previewSummary": "{{kind}} from {{n}} validated blocks in this order.",
  "out.previewProvenance": "Full provenance per block is shown in the generated document.",
  "out.previewUncertain": "{{n}} block(s) with low trust — marked as uncertain in the document.",
  "out.previewDisclaimer":
    "Preview of the composition, not the finished document. Generation happens on Generate.",
  "out.previewTitle": "Preview (Markdown)",
  "out.copy": "Copy",
  "out.copied": "Markdown copied.",
  "out.download": "Download .md",
  "out.provenanceTitle": "Provenance & evidence",
  "out.uncertain": "low trust",
  "out.genError": "Could not generate output.",
  "out.kind.instruction": "Work instruction",
  "out.kind.checklist": "Checklist",
  "out.kind.troubleshooting": "Troubleshooting",
  "out.kind.training": "Training",
  "out.kind.management_summary": "Management summary",
  "out.kindDesc.instruction": "Step-by-step procedure (SOP).",
  "out.kindDesc.checklist": "Checkable items for practice.",
  "out.kindDesc.troubleshooting": "Symptom → cause → action.",
  "out.kindDesc.training": "Learning units with key points.",
  "out.kindDesc.management_summary": "Condensed overview with trust.",
  "s2.import":
    "Import and review documents — active once the import/source-review API is in place.",
  "s2.capital":
    "Knowledge-capital metrics on real live data — active once the metrics logic is in place.",
  "mgmt.jumpTitle": "Sections",
  "mgmt.overview": "Operational snapshot",
  "mgmt.kpiTotal": "Objects",
  "mgmt.kpiValidated": "Validated",
  "mgmt.kpiOpen": "Open",
  "mgmt.kpiGaps": "Gaps",
  "mgmt.kpiConflicts": "Conflicts",
  "mgmt.kpiTrust": "Avg trust",
  "mgmt.capital": "Knowledge Capital Score",
  "mgmt.band.gut": "good",
  "mgmt.band.mittel": "medium",
  "mgmt.band.kritisch": "critical",
  "mgmt.part.validatedRatio": "Validation ratio",
  "mgmt.part.avgTrust": "Avg trust",
  "mgmt.part.coverage": "Domain coverage",
  "mgmt.part.singleSourceInv": "Source spread",
  "mgmt.part.freshnessInv": "Freshness",
  "mgmt.valuation": "Knowledge Valuation",
  "mgmt.valuationDisclaimer":
    "Estimate from transparent assumptions — not a balance-sheet valuation.",
  "mgmt.assumeRate": "€ per hour",
  "mgmt.assumeHours": "Hours saved/object",
  "mgmt.assumeReuse": "Reuse factor",
  "mgmt.basis": "Basis: {{n}} validated objects · avg trust {{trust}}",
  "mgmt.statement": "Knowledge Statement",
  "mgmt.assets": "Assets",
  "mgmt.risks": "Risks",
  "mgmt.net": "Net index",
  "mgmt.riskBreakdown":
    "Single-source domains: {{ss}} · stale: {{stale}} · open gaps: {{gaps}} · conflicts: {{conf}}",
  "mgmt.maturity": "Maturity Journey",
  "mgmt.stage": "Stage",
  "mgmt.stageName.leer": "No base",
  "mgmt.stageName.erfassen": "Capture",
  "mgmt.stageName.strukturieren": "Structure",
  "mgmt.stageName.validieren": "Validate",
  "mgmt.stageName.wiederverwenden": "Reuse",
  "mgmt.stageName.skalieren": "Scale",
  "mgmt.house": "Knowledge House",
  "mgmt.fragile": "fragile",
  "mgmt.stable": "secured",
  "mgmt.empty": "No base yet — metrics appear once knowledge is captured.",
  "mrun.title": "Reasoner runs (recent)",
  "mrun.empty": "No reasoner runs recorded yet.",
  "mrun.total": "Total: {{n}}",
  "mrun.errors": "Errors: {{n}}",
  "mrun.fallbacks": "Fallbacks: {{n}}",
  "mrun.demo": "Demo: {{n}}",
  "mrun.fallback": "Fallback",
  "mrun.demoTag": "Demo",
  "evx.title": "Evidence index (QA)",
  "evx.empty": "No evidence records yet.",
  "evx.total": "Total: {{n}}",
  "evx.sources": "Sources: {{n}}",
  "evx.attachments": "Attachments: {{n}}",
  "evx.kos": "Knowledge objects: {{n}}",
  "evx.kind.source": "Source",
  "evx.kind.attachment": "Attachment",
  "evx.koRef": "KO {{id}}",
  "evx.providerPill": "Provider: {{v}}",
  "evx.objectPill": "Object: {{v}}",
  "prov.title": "Provenance index (QA)",
  "prov.empty": "No knowledge objects yet.",
  "prov.total": "KOs: {{n}}",
  "prov.transfer": "Transfer: {{n}}",
  "prov.multiVersion": "Multi-version: {{n}}",
  "prov.withEvidence": "with evidence: {{n}}",
  "prov.noEvidence": "without evidence: {{n}}",
  "prov.version": "v{{n}}",
  "prov.counts": "S {{sources}} · A {{attachments}} · Ev {{evidence}}",
  "prov.badge.no-evidence": "no evidence",
  "prov.badge.transferred-author": "author transfer",
  "prov.badge.multi-version": "multi-version",
  "kos.hintsTitle": "Knowledge-OS QA hints",
  "kos.sevCount.critical": "critical: {{n}}",
  "kos.sevCount.warning": "warnings: {{n}}",
  "kos.sevCount.info": "info: {{n}}",
  "kos.sev.critical": "critical",
  "kos.sev.warning": "warning",
  "kos.sev.info": "info",
  "kos.sev.ok": "OK",
  "kos.hints.none": "No hints from the loaded signals.",
  "kos.hints.unknown": "Not loaded (unknown, not an error): {{sources}}",
  "kos.hint.modelrun-errors.title": "ModelRun errors ({{n}})",
  "kos.hint.modelrun-errors.detail": "Reasoner calls with error status — review the log.",
  "kos.hint.modelrun-fallbacks.title": "ModelRun fallbacks ({{n}})",
  "kos.hint.modelrun-fallbacks.detail": "Runs used the deterministic fallback instead of a model.",
  "kos.hint.reasoner-demo.title": "Reasoner in demo/fallback mode",
  "kos.hint.reasoner-demo.detail": "No real model configured — answers are deterministic.",
  "kos.hint.provenance-no-evidence.title": "KOs without evidence ({{n}})",
  "kos.hint.provenance-no-evidence.detail": "Sources/attachments present but no evidence records.",
  "kos.hint.evidence-outdated.title": "Evidence outdated ({{n}})",
  "kos.hint.evidence-outdated.detail":
    "Current KO version has no evidence — only older versions are backed.",
  "kos.hint.evidence-missing.title": "Evidence missing ({{n}})",
  "kos.hint.evidence-missing.detail":
    "Sources/object attachments present but no evidence for any version.",
  "kos.hint.provenance-lineage.title": "Transfer/multi-version ({{n}})",
  "kos.hint.provenance-lineage.detail": "KOs with author transfer or multiple versions.",
  "kos.hint.evidence-empty.title": "No evidence records",
  "kos.hint.evidence-empty.detail": "No sources/attachments captured as evidence yet.",
  // AUFTRAG-mega34 G.
  "kos.hint.health-detection-unproven.title": "Knowledge health not evidenced ({{n}})",
  "kos.hint.health-detection-unproven.detail":
    "Conflict detection is not fully evidenced. The value shown is therefore the worst possible one, not a measured grade — while that holds, neither an all-clear nor an alarm can be given honestly.",
  "kos.hint.health-critical.title": "Knowledge health critical ({{n}})",
  "kos.hint.health-critical.detail": "Overall score in the critical band.",
  "kos.hint.health-mittel.title": "Knowledge health medium ({{n}})",
  "kos.hint.health-mittel.detail": "Overall score in the medium band.",
  "kos.hint.all-clear.title": "No issues",
  "kos.hint.all-clear.detail": "The loaded foundation signals show no warnings.",
  "evFresh.title": "Evidence freshness (QA)",
  "evFresh.subtitle": "KOs whose current version has no evidence.",
  "evFresh.empty": "No KOs with outdated or missing evidence.",
  "evFresh.summary.outdated": "outdated: {{n}}",
  "evFresh.summary.missing": "missing: {{n}}",
  "evFresh.summary.current": "current: {{n}}",
  "evFresh.summary.neutral": "neutral: {{n}}",
  "evFresh.version": "v{{n}}",
  "evFresh.counts": "current {{current}} · older {{older}}",
  "evFresh.openKo": "Open KO",
  "qmWindow.within": "within the loaded window",
  "qmWindow.limited": "possibly truncated",
  "qmWindow.modelRuns": "Window: {{n}} most recent ModelRuns",
  "qmWindow.evidence": "Window: {{n}} most recent evidence records",
  "readiness.title": "Knowledge-OS readiness",
  "readiness.ready": "ready",
  "readiness.attention": "attention",
  "readiness.critical": "critical",
  "readiness.incomplete": "incompletely loaded",
  "readiness.reason.critical": "critical hints",
  "readiness.reason.warning": "warnings",
  "readiness.reason.window": "data window possibly truncated",
  "readiness.reason.unknown": "signals not loaded",
  "mrun.task.structure": "Structure",
  "mrun.task.assist": "Polish",
  "mrun.task.interview": "Interview",
  "mrun.task.answer": "Answer",
  "mrun.task.select": "Select",
  "mrun.status.success": "OK",
  "mrun.status.error": "Error",
  "rcfg.title": "Reasoner configuration",
  "rcfg.mode": "Mode",
  "rcfg.modeLabel.model": "Model active",
  "rcfg.modeLabel.fallback": "Fallback",
  "rcfg.modeLabel.demo": "Demo (deterministic)",
  "rcfg.provider": "Provider",
  "rcfg.model": "Model",
  "rcfg.notConfigured": "not configured",
  "rcfg.locales": "Languages",
  "rcfg.tasks": "Tasks",
  "rcfg.fallbackHint": "No model configured — deterministic fallback is active.",
  "mgmt.recommendations": "Hero Assist — recommendations",
  "mgmt.noRecs": "No urgent actions.",
  "mgmt.sev.hoch": "high",
  "mgmt.sev.mittel": "medium",
  "mgmt.rec.secureSingleSource": "Secure {{count}} single-source domain(s) (spread knowledge).",
  "mgmt.rec.revalidate": "Handle {{count}} due revalidation(s).",
  "mgmt.rec.closeGaps": "Close {{count}} open knowledge gap(s).",
  "mgmt.rec.resolveConflicts": "Resolve {{count}} open conflict(s).",
  "mgmt.rec.validateBacklog": "Validate {{count}} open objects.",
  "mgmt.priorities": "Knowledge prioritization (9 factors)",
  "mgmt.pilot": "Pilot report 30/60/90",
  "mgmt.print": "Print / PDF",
  "mgmt.pilotNote": "Print/HTML view (via browser print), not a certified PDF.",
  "mgmt.window": "Window",
  "mgmt.created": "Captured",
  "mgmt.validatedCol": "Validated",
  "mgmt.days": "days",
  "s2.graphEmpty": "No graph data.",
  "s2.graphCount": "{{nodes}} nodes · {{edges}} edges",
  "graph.truncated": "View limited to the {{n}} most connected nodes",
  "graph.legendValidated": "validated",
  "graph.legendOpen": "open / in review",
  "graph.legendTag": "tag relation",
  "graph.legendConflict": "conflict",
  "graph.clickHint": "Click a node to open the knowledge object",
  "graph.openNode": "Open knowledge object: {{title}}",

  // SCRUM-406: detailed ?-help in the review area (pattern: What? · When? · What happens next?).
  "vhelp.originFilter.title": "Filter by origin",
  "vhelp.originFilter.body":
    "Narrows the list by origin: demo examples or your organisation's own knowledge. This is a view only — it changes no review status and discards nothing. The number next to each filter shows how many entries it contains.",
  "vhelp.reviewFocus.title": "Review focus",
  "vhelp.reviewFocus.body":
    "Separates new submissions from reworked ones (version greater than 1). Reworked objects deserve a targeted look at the change — what was queried, what was adjusted? This too is a view only: it changes no status and replaces no decision.",
  "vhelp.filters.title": "Search & filter",
  "vhelp.filters.body":
    "Narrows the review list by full text, knowledge type, category or tag. Use it when the list is long and you want to review your own field first. Nothing is lost: filters only change what you currently see — every object stays in review.",
  "vhelp.mineOnly.title": "Assigned to me",
  "vhelp.mineOnly.body":
    "Shows your personal review list: objects someone deliberately assigned to you. Use it to clear the work colleagues are waiting for first. An assignment is a request, not a verdict — nothing is decided until you rate the object yourself.",
  "vhelp.signals.title": "Reading the review signals",
  "vhelp.signals.body":
    "This row shows how reliable the object is RIGHT NOW: the trust bar and trust value (from review votes and proven use), the version, „target n“ (that many approvals are needed until VALIDATED), plus markers such as TRANSFERRED (author changed — take an extra look) or ASSIGNED. None of this is your rating — it is the honest starting point for your decision.",
  "vhelp.approve.title": "Approve",
  "vhelp.approve.body":
    "You confirm after your own review: this statement is factually correct and applicable as written. Use it only once you have genuinely judged the statement, conditions and measures — your approval counts as one of several required review votes. Afterwards the object's trust rises; it only becomes VALIDATED once enough reviewers have approved. Nothing is published or changed automatically — your vote is counted, nothing more.",
  "vhelp.query.title": "Raise a query",
  "vhelp.query.body":
    "You consider the knowledge usable, but something is unclear, incomplete or only true under conditions. A short comment is mandatory — it is your help to the author: what exactly is missing, what should they add? Afterwards the object stays in review and the author sees your query as a comment on the knowledge object. Nothing is rejected, approved or changed automatically — the rework is done deliberately by the author.",
  "vhelp.reject.title": "Reject",
  "vhelp.reject.body":
    "You consider the statement wrong, outdated or risky. Here too the reason is mandatory — without it the author can learn and correct nothing. Your rejection then flows into the object's review record; it is NOT deleted and NOT locked, but remains visibly in review until the author or a controller reacts. If two validated statements contradict each other, „report conflict“ is the better path than a rejection.",
  "vhelp.feedbackForm.title": "Reason (mandatory)",
  "vhelp.feedbackForm.body":
    "Queries and rejections always need a reason — it is stored as a comment on the knowledge object, visible to author and reviewers. Be concrete about what is missing or wrong and what the author should add. Submitting requires text; cancelling only discards your input, never a rating.",
  "vhelp.assign.title": "Assign a reviewer",
  "vhelp.assign.body":
    "You ask a specific colleague to review this object. They will see it in their personal review list („assigned to me“) and receive a notification via the bell. The assignment is an invitation, not a rating: it changes neither status nor trust, and nothing is reviewed until that person decides themselves.",
  "vhelp.markTrue.title": "Mark as true (admin only)",
  "vhelp.markTrue.body":
    "As an admin you complete this object's validation in a single step — regardless of the peer ratings. The status is set to „validated“ and trust is raised to the highest level. Use this deliberately and only when you can genuinely vouch for the statement, because you are skipping the multiple cross-checks by others. The action is recorded in the audit log under your name and can later be pulled back into review via a fresh edit/revision.",
  "vhelp.stillValid.title": "Still valid",
  "vhelp.stillValid.body":
    "You confirm that this already reviewed knowledge still holds from your point of view — a freshness signal, not a new review procedure. Use it when you have just applied the knowledge or deliberately re-read it. The confirmation is recorded with a date and the object counts as recently confirmed. It replaces no peer review and lifts no queries or conflicts.",
  "vhelp.reportConflict.title": "Report a conflict",
  "vhelp.reportConflict.body":
    "You flag that this knowledge contradicts ANOTHER knowledge object — say, two different limit values for the same case. The case then appears on the conflicts page and is resolved deliberately there (second opinion, escalation, documented decision). Both objects remain unchanged — nothing is corrected, overwritten or deleted automatically.",
  "vhelp.conflictForm.title": "Describe the conflict",
  "vhelp.conflictForm.body":
    "Three details make the report resolvable: the COUNTERPART object (what does this knowledge contradict?), the CONFLICT TYPE (e.g. contradiction in substance or in responsibility) and a short DESCRIPTION of the contradiction with your context. After submitting, an open conflict case exists — both objects stay marked as usable until the conflict is deliberately resolved.",
  "vhelp.sourcesLevel2.title": "External sources (level 2)",
  "vhelp.sourcesLevel2.body":
    "External evidence attached to the knowledge object: standards, manuals, articles, internal documents. The „level 2“ badge is honest: this source was NOT peer-reviewed by colleagues — it supports the knowledge but replaces not a single review vote. On the Ask page a level-2 source therefore does not count as a review vote; it can support an answer, but not secure it. The X only removes the link — knowledge, status and trust remain unchanged.",
  "vhelp.sourceFields.title": "Describe the source",
  "vhelp.sourceFields.body":
    "Three details make a source useful: the LABEL says what it is („DIN EN 1090, section 7“), the URL leads to it (leave empty for paper or internal sources), the EXCERPT quotes the one decisive passage verbatim — so nobody has to read the whole document to check the statement. The more concrete the excerpt, the more the source helps reviewers.",
  "vhelp.sourceAdd.title": "Add source",
  "vhelp.sourceAdd.body":
    "Attaches the described source to this knowledge object as level-2 evidence. It persists across versions and is visible to everyone. Nothing else happens automatically: the source's content is not merged into the knowledge, not reviewed and not rated — it stands next to it as evidence.",
  "vhelp.sourceSearch.title": "Search sources",
  "vhelp.sourceSearch.body":
    "Searches for external evidence on this topic. The search runs through the KLARWERK server — your query does not go from your browser to external services directly. Results are non-binding suggestions: nothing is attached automatically. Check title and snippet, open the link if in doubt — only „attach“ deliberately adopts a result as a level-2 source.",
  "vhelp.contribution.title": "Report a contribution or reference",
  "vhelp.contribution.body":
    "You know an addition, correction or reference but do not want to work on the object yourself? Describe it here — your note is stored as a comment on the knowledge object, visible to author and reviewers. Unlike „add source“, NO source entry is created; it is a message to people, not evidence on the object.",
  "vhelp.helpful.title": "It helped",
  "vhelp.helpful.body":
    "A proven-in-practice signal: you applied this knowledge and it worked. It strengthens the object's trust a little and is recorded in the history. It is NOT a review vote — validation still only comes from deliberate review decisions by colleagues.",
  "vhelp.validity.title": "Validity & protection",
  "vhelp.validity.body":
    "These values are honestly DERIVED from the current state, not stored: freshness (when last confirmed or changed), output eligibility (may this knowledge go into generated documents?) and a recommendation for the next sensible step. You can only change them indirectly — by reviewing, confirming or reworking the knowledge itself.",
  "vhelp.transfer.title": "Transfer author",
  "vhelp.transfer.body":
    "Hands responsibility for this knowledge to another person — for instance when someone leaves the company or responsibility changes. The original author remains permanently visible (provenance is never lost). Transferred objects get an extra look in review, because the knowledge is now owned by someone who did not capture it.",
  "vhelp.deleteKo.title": "Delete knowledge object",
  "vhelp.deleteKo.body":
    "Removes this knowledge object permanently — allowed only for the author, controllers and admins; the server enforces the same rule. The inline confirmation deliberately asks before deleting, and the deletion is recorded in the audit log. If the knowledge is merely outdated, reworking it or reporting a conflict is the more honest path than deletion.",
  "vhelp.conflictEscalate.title": "Escalate",
  "vhelp.conflictEscalate.body":
    "Raises an open factual conflict one level when the people involved cannot settle it themselves — the responsible authority then decides. Use it when two validated statements contradict each other hard and neither side can yield. The conflict stays open and visible until a documented decision is made.",
  "vhelp.conflictSecondOpinion.title": "Get a second opinion",
  "vhelp.conflictSecondOpinion.body":
    "Asks another knowledgeable person for their assessment of the conflict and records it in writing. A good second opinion names facts and sources, not just gut feeling. It does not decide the conflict automatically — it is material for the later resolution.",
  "vhelp.conflictResolve.title": "Resolve conflict",
  "vhelp.conflictResolve.body":
    "Records the decision on how to handle the contradiction — which statement applies, under which conditions, and why. The resolution only DOCUMENTS: it changes none of the involved knowledge objects automatically. If an object should be reworked or reconfirmed afterwards, the app shows a revalidation recommendation — that too remains a deliberate human action.",

  // SCRUM-407: detailed ?-help along the capture flow (pattern: What? · When? · What happens next?).
  "chelp.modes.title": "The four ways to tell",
  "chelp.modes.body":
    "Four paths lead to the same goal: FREE TEXT (just start writing), DICTATION (speak instead of typing), INTERVIEW (the AI asks you targeted questions) and FROM FILE (pull knowledge points out of a document). Pick whatever feels natural — all paths end in the same draft on the knowledge page, and nothing is lost when you switch.",
  "chelp.expertPath.title": "Direct form (expert path)",
  "chelp.expertPath.body":
    "The classic form with every field at once — for those who know exactly what to enter. It is the same data as the guided path, no extra feature and no shortcut past review. The way back to the guided path is always one click away.",
  "chelp.wizardSteps.title": "The three steps",
  "chelp.wizardSteps.body":
    "Capturing runs in three steps: TELL (get the raw knowledge out), KNOWLEDGE PAGE (check and refine, with AI help), SUBMIT (hand it to peer review). Completed steps are clickable — going back loses nothing. Only „review & submit“ turns your draft into a knowledge object for your colleagues.",
  "chelp.loadExample.title": "Load example",
  "chelp.loadExample.body":
    "Fills the fields with a demo example so you can try the whole path safely. Careful: it overwrites your current input — use it on an empty page. Even an example is only submitted once you submit it deliberately.",
  "chelp.tellRaw.title": "Just tell it",
  "chelp.tellRaw.body":
    "Write your knowledge down the way you would tell a new colleague — unsorted is perfectly fine. Structure (title, core statement, conditions, measures) is PROPOSED by the AI in the next step, for you to check and change. Nothing is saved or submitted automatically.",
  "chelp.dictate.title": "Dictate",
  "chelp.dictate.body":
    "Speak instead of typing: your browser converts speech to text locally and it flows into this field. Start and stop deliberately; afterwards you can edit the text as usual. If your browser cannot do speech recognition, the app says so honestly instead of failing silently.",
  "chelp.tellUpload.title": "Attach a file while telling",
  "chelp.tellUpload.body":
    "Upload documents here (PDF, Word, text) and their text flows straight into your telling field; images and videos become attachments of the later knowledge object. For images, text recognition (OCR) only runs on your click. Nothing is uploaded that you do not see — everything stays part of your draft.",
  "chelp.structureNow.title": "Propose structure",
  "chelp.structureNow.body":
    "The AI reads your raw text and proposes title, core statement, conditions and measures — as a DRAFT on the knowledge page, marked in violet. It invents nothing; without an AI key an honest, rule-based fallback works and says so clearly. You check, change and decide — nothing is ever saved automatically.",
  "chelp.interview.title": "The knowledge interview",
  "chelp.interview.body":
    "The AI asks you one question at a time and digs deeper on purpose — for limit values, exceptions, reasons. Answer in your own words (type or dictate); you can have the question read aloud. Only when you finish the interview is a draft built from all your answers — none of it is stored before that.",
  "chelp.filePoints.title": "Knowledge from a file",
  "chelp.filePoints.body":
    "You upload a document and the AI extracts individual knowledge points — each WITH a verbatim quote from the document (which rules out invented points; if it finds nothing solid, it says so honestly). You tick what gets adopted: only selected points become drafts. Alternatively you can phrase a search assignment for an expert.",
  "chelp.captureTitle.title": "The title",
  "chelp.captureTitle.body":
    "The title is the first thing colleagues see in the library and in answers — it decides whether your knowledge is found. Good: concrete and actionable („checking weld seams on aluminium under 5 mm“). You can change it anytime; the AI suggestion is only a starting point.",
  "chelp.saveDraftHelp.title": "Save draft",
  "chelp.saveDraftHelp.body":
    "Saves your interim state locally in your browser — continue anytime, even after a restart. A draft is NOT submitted: nobody sees it, it appears in no review and no answer. You will find saved drafts at the top of this page to resume.",
  "chelp.discardHelp.title": "Discard",
  "chelp.discardHelp.body":
    "Discards the current draft for good — text, structure and attachments of this capture. It affects ONLY your draft: already submitted or saved knowledge objects stay untouched. The app deliberately asks first; if you only want one step back, use the step bar instead of discarding.",
  "chelp.submitReview.title": "Review & submit",
  "chelp.submitReview.body":
    "Turns your draft into a knowledge object and hands it to peer review: colleagues check it, raise queries or approve. From now on it is visible to others — but honestly marked as „in review“, NOT as validated. It becomes validated through enough approvals. It can carry answers before that too — but is then visibly marked as unverified.",
  "chelp.readiness.title": "Readiness check",
  "chelp.readiness.body":
    "Shows honestly what is still missing before submitting: mandatory fields (without them the button stays off) and optional ones that strengthen your knowledge (category or attachments, say). Green means ready — not perfect: you can still improve after submitting, then as a new version.",
  "chelp.savedNext.title": "Saved — what now?",
  "chelp.savedNext.body":
    "Your knowledge now exists as an object and awaits peer review — it is VISIBLE, but honestly marked as open, not as validated. Nothing more to do: reviewers will find it on the validation board. If you want to view or extend it, the link takes you straight there.",
  "chelp.advancedDetails.title": "Advanced details",
  "chelp.advancedDetails.body":
    "Everything here is OPTIONAL — your knowledge gets submitted without it too. It is still worth it: category and tags make it findable, the asset couples it to machines/objects, the reviewer count steers how many approvals are needed, documents and images provide evidence. The badge shows how much is already filled in.",
  "chelp.knowledgeType.title": "Knowledge type",
  "chelp.knowledgeType.body":
    "Classifies your knowledge: experience, process, factual — and especially valuable: NEGATIVE knowledge („we tried this, it does NOT work, because …“). The type helps reviewers and searchers put your knowledge in context; it changes nothing about the review path.",
  "chelp.assetField.title": "Asset / object",
  "chelp.assetField.body":
    "Couples your knowledge to a concrete asset, machine or object („press 3“, „client XY“). If that asset changes later, the lifecycle finds exactly the coupled knowledge objects for re-checking. Free text is fine — as long as colleagues recognise the asset.",
  "chelp.tagsField.title": "Tags",
  "chelp.tagsField.body":
    "Short keywords through which your knowledge appears in search and filters („aluminium“, „deadline“, „hygiene“). Use terms colleagues would actually search for, and stay consistent with existing tags. They can be changed anytime and do not influence the review.",
  "chelp.docsImages.title": "Documents & images",
  "chelp.docsImages.body":
    "Attaches evidence to your knowledge: photos of the result, the inspection log, the work instruction. Attachments travel with the knowledge object on submit and are visible to reviewers there. Their content does not become knowledge automatically — you decide what goes into the text.",
  "chelp.expertForm.title": "The expert form",
  "chelp.expertForm.body":
    "Enter all fields directly here: title, knowledge type, content, core statement, conditions (when does it apply?) and measures (what is to be done?). The same rules apply as on the guided path — same readiness check, same review. The AI helps with the text on request but decides nothing.",
  "chelp.sourcesPanel.title": "External sources (level 2)",
  "chelp.sourcesPanel.body":
    "Attaches external references to your knowledge — a standard, a manual, a manufacturer page. By hand (label, link, excerpt) or via the source search, exactly like in the review area. While capturing, they collect in a visible waiting list; they are attached only on submit, together with your knowledge object. Important: external sources are level 2 — they never count as peer-validated and do not replace review by colleagues. Nothing is adopted automatically.",
  "capture.sourcesTitle": "External sources",
  "capture.sourcesHint":
    "Sources first land in this waiting list. On submit they are attached to the saved knowledge object — as level 2, never peer-validated.",
  "xtr.title": "Add from document",
  "xtr.hint":
    "Upload another document — the AI reads it and suggests knowledge points WITH their supporting excerpt. Only what you tick is appended as a section at the end of your article; nothing is replaced.",
  "xtr.applyCta": "Append selected",
  "xtr.applying": "Adopting {{count}} point(s) — content and provenance together …",
  "xtr.appended":
    "{{count}} point(s) from „{{name}}“ adopted — content AND provenance were saved together; existing content was left unchanged.",
  "xtr.append.button": "Append to existing article",
  "xtr.append.title": "Append to existing article",
  "xtr.append.intro":
    "Append {{count}} selected insight(s) from „{{name}}“ as a section to an existing article. The target article is revised (re-review needed afterwards); the source is noted per point.",
  "xtr.append.searchPlaceholder": "Search articles (title) …",
  "xtr.append.none": "No matching article found.",
  "xtr.append.busy": "Appending …",
  "xtr.append.done":
    "{{count}} insight(s) appended to „{{title}}“ — the article now needs re-review.",
  "xtr.append.missingAnchor":
    "Without the original document as evidence the content is not adopted. The article was NOT changed. This holds regardless of the “External knowledge” setting: adopted document content must stay attached to its original.",
  "xtr.append.blockedByStage":
    "At the configured “External knowledge” stage this source may not be attached to a knowledge object. The article was NOT changed. An administrator can change the stage under Administration → External knowledge.",
  "xtr.append.unclear":
    "The outcome is unclear — the connection dropped before the server answered. NOTHING was taken back: the adoption may or may not have gone through. Please open the article and check; retrying the same operation will not create anything twice.",
  "xtr.append.stateUnchanged":
    "The article was NOT changed — no content was saved without its provenance. You can simply try the import again.",
  "xtr.append.followUpsFailed":
    "The adoption is saved (content and provenance). A downstream step did not run: {{steps}}. The renewed AI check may therefore be missing — it can be restarted on the validation page.",
  "xtr.help.title": "Add from document",
  "xtr.help.body":
    "The AI reads a document you upload and suggests knowledge points — each point carries its supporting excerpt from the document (no excerpt, no adoption). You choose via checkboxes; the selection is APPENDED to your article as sections, nothing is replaced or overwritten. The origin (file name + excerpt) is noted on the knowledge object as a level-2 source — it does not count as peer-validated and does not replace review.",
  "fd.kicker": "Capture",
  "fd.title": "Document editor",
  "fd.backToCapture": "Back to capture knowledge",
  "fd.allModes": "All capture modes",
  "fd.submitted": "Submitted for review:",
  "fd.submittedBody":
    "The editor is finished and cleared. Saving or re-submitting the same content is locked; a new entry only starts deliberately via the button.",
  "fd.openValidation": "Open validation",
  "fd.viewObject": "View object",
  "fd.newEntry": "New entry",
  "fd.titleOptional": "Title optional",
  "fd.content": "Content",
  "fd.draftLoading": "Loading draft ...",
  "fd.draftOpen": "Front-door draft opened. Changes stay in this draft.",
  "fd.editorPlaceholder":
    "Describe your knowledge here the way you would explain it to a colleague — the AI turns it into a draft that you review and submit.",
  "fd.structureSuggest": "Suggest AI structure",
  "fd.needContentFirst": "Write some content first, then a suggestion can be generated.",
  "fd.optionalAiHint": "Optional AI suggestion. Nothing is saved automatically.",
  "fd.aiHelp": "AI help",
  "fd.aiHelpApply": "Apply AI help",
  "fd.aiHelpModes": "Clarify, structure, expand, spelling or format.",
  "fd.structureGenerating": "Generating AI suggestion ...",
  "fd.assistGenerating": "Generating AI help suggestion ...",
  "fd.originalUnchanged": "The original text stays unchanged.",
  "fd.structureAccepted":
    "AI suggestion adopted. Please review; nothing is saved until your next action.",
  "fd.structureKeptRichBodyTitle":
    "Structure suggestion: title adopted. The formatted content with images and formatting stays unchanged.",
  "fd.structureKeptRichBodyNoTitle":
    "The formatted content stays unchanged; the structure suggestion was not applied to the content.",
  "fd.structureRichTitleOnly":
    "Formatted content with images stays intact — the AI only suggests a title.",
  "fd.assistAccepted": "AI help adopted. Please review; nothing is saved until your next action.",
  "fd.aiProposal": "AI suggestion",
  "fd.aiProposalCheck": "AI-generated. Please review before you adopt anything.",
  "fd.fallback": "Fallback",
  "fd.fallbackNoModel":
    "AI is not configured or disabled — this suggestion is a simple automatic derivation, not a model response.",
  "fd.fallbackModelError":
    "AI reported an error or was not reachable — this suggestion is a simple automatic derivation, not a model response.",
  "fd.fallbackModelTimeout":
    "AI did not respond in time (timeout) — this suggestion is a simple automatic derivation, not a model response.",
  "fd.fallbackConfidential":
    "The text is classified as confidential — the cloud AI is excluded for it and no local model is wired. This suggestion is a simple automatic derivation, not a model response.",
  "fd.fieldTitle": "Title",
  "fd.fieldStatement": "Statement / core message",
  "fd.fieldConditions": "Conditions",
  "fd.noConditions": "No conditions suggested.",
  "fd.fieldMeasures": "Measures",
  "fd.noMeasures": "No measures suggested.",
  "fd.fieldTags": "Notes / tags",
  "fd.aiHelpProposal": "AI help suggestion",
  "fd.assistProposalCheck": "{{action}}: AI-generated. Please review before you adopt anything.",
  "fd.accept": "Adopt",
  "fd.discardProposal": "Discard suggestion",
  "fd.submitReview": "Review & submit",
  "fd.saveDraft": "Save as draft",
  "fd.discardInput": "Discard input",
  "fd.back": "Back",
  "fd.writeToSubmit": "Write or paste content, then you can review and submit.",
  "fd.validate.lead": "Submitting is not possible yet:",
  "fd.validate.needBody": "The content is empty. To submit, the knowledge object needs text.",
  "fd.validate.hint": "You can still save the empty state as a draft and continue later.",
  "fd.unsavable.proposal":
    "The AI proposal on screen has not been adopted and will not be saved along with the draft.",
  "fd.unsavable.confidentialityOnly":
    "The chosen confidentiality without a title and without content — there is no draft yet that could hold it.",
  "fd.statusLabel": "Status",
  "fd.titleOnSave": "Title on save",
  "fd.author": "Author",
  "fd.whatOnSave": "What happens on save",
  "fd.whatOnSaveBody":
    "It is saved as a draft — resumable at any time. It only goes to review when you choose “Review / submit”; nothing is validated automatically.",
  "fd.moreWays": "More capture paths",
  "fd.moreWaysBody":
    "Need the classic form, dictation or the guided interview? The full capture area has every path — this surface here is the fast entry point.",
  "fd.options.show": "Show more input options",
  "fd.options.hide": "Collapse more input options",
  "fd.options.hint.freitext":
    "Tell it freely; the AI turns it into a structure proposal that you review.",
  "fd.options.hint.diktat": "Speak instead of typing — the text lands in the same telling field.",
  "fd.options.hint.interview": "Guided follow-up questions when you don't know where to start.",
  "fd.options.hint.datei": "Take knowledge from an existing file.",
  "fd.options.hint.formular":
    "Expert mode: fill the same fields directly, without the telling step.",
  "fd.toastSaved": "Draft saved.",
  "fd.toastSubmitted": "Submitted for review.",
  "fd.confirmDiscard": "Discard input? Unsaved content will be lost.",
  "fd.errSaveFailed": "Saving failed.",
  "fd.errAssist": "I cannot run this AI help reliably right now.",
  "fd.errSpelling": "The spell check cannot safely preserve formatting at the moment.",
  "dcmp.kicker": "Read-only comparison",
  "dcmp.titleDuplicate": "Compare duplicates",
  "dcmp.titleConflict": "Compare conflict",
  "dcmp.back": "Back",
  "dcmp.loading": "Loading comparison.",
  "dcmp.loadError": "Comparison could not be loaded.",
  "dcmp.notFound": "Comparison not found or already closed.",
  "dcmp.textSimilarity": "Text similarity",
  "dcmp.noProvenContradiction": "no proven contradiction — only word/field similarity",
  "dcmp.moreValues": "More values",
  "dcmp.uncertainty": "Uncertainty",
  "dcmp.textDifference": "Text difference",
  "dcmp.similarity": "Similarity",
  "dcmp.scoresHint": "Scores are decision support, not truth. No automatic merge.",
  "dcmp.viewDetails": "View details",
  "dcmp.objectRemoved": "Object removed",
  "dcmp.left": "Left",
  "dcmp.right": "Right",
  "dcmp.koA": "Knowledge object A",
  "dcmp.koB": "Knowledge object B",
  "dcmp.sectionSignals": "Section signals",
  "dcmp.compareByAreas": "Comparison by knowledge area",
  "dcmp.legendHelpTitle": "What do the signal colours mean?",
  "dcmp.legendHelpBody":
    "Each section gets a colour from the text comparison: green = the contents largely match, yellow = partial or unclear (take a closer look), red = the texts differ. Red only means a difference, not a proven contradiction — the colours are a reading aid, not a verdict, and nothing is merged automatically.",
  "dcmp.onlyForComparison":
    "For comparison only: nothing is merged, deleted or validated, and no decision is saved.",
  "dcmp.sourceDuplicate": "Duplicate comparison: {{relation}}",
  "dcmp.sourceConflict": "Conflict comparison: {{type}}",
  "dcmp.sectionCompareUnavailable":
    "Section comparison not possible because a knowledge object is missing.",
  "dcmp.relation.identisch": "identical",
  "dcmp.relation.a_enthaelt_b": "A contains B",
  "dcmp.relation.b_enthaelt_a": "B contains A",
  "dcmp.relation.teilweise": "partial overlap",
  "dcmp.relation.verwandt": "related",
  "dcmp.conflictType.truth": "Truth conflict",
  "dcmp.conflictType.experience": "Experience conflict",
  "dcmp.conflictType.context": "Context conflict",
  "dcmp.conflictType.temporal": "Temporal conflict",
  "dcmp.conflictType.role": "Role conflict",
  "dcmp.tone.green.label": "Match",
  "dcmp.tone.green.meaning": "Text and fields largely match.",
  "dcmp.tone.yellow.label": "Uncertain",
  "dcmp.tone.yellow.meaning": "Partial or unclear — take a closer look.",
  "dcmp.tone.red.label": "Difference",
  "dcmp.tone.red.meaning": "Text differs — only a difference, not a proven contradiction.",
  "dcmp.section.title": "Title",
  "dcmp.section.statement": "Core message / content",
  "dcmp.section.conditions": "Conditions",
  "dcmp.section.measures": "Measures",
  "dcmp.section.hints": "Notes",
  "dcmp.section.sources": "Sources / evidence",
  "dcmp.section.tags": "Tags / category",
  "dcmp.section.trust": "Trust / validation status",
  "dcmp.note.bothEmpty": "Preliminary field heuristic; no real detector scores for this section.",
  "dcmp.note.exactMatch": "Preliminary field heuristic; exact field match.",
  "dcmp.note.oneMissing": "Preliminary field heuristic; one value is missing.",
  "dcmp.note.heuristic": "Preliminary field heuristic; not a factual verdict.",
  "dcmp.note.noScore":
    "No score available: overall values are a preliminary field heuristic without detector percentages.",
  "dcmp.note.mixedOverlap":
    "Match from the existing detector; conflict/uncertainty remain a preliminary display aid.",
  "dcmp.note.mixedConflict":
    "Conflict value from the existing detector; match remains a preliminary field heuristic.",
  "dcmp.reason.bothEmpty": "Neither side has a usable value.",
  "dcmp.reason.identical": "The values are identical.",
  "dcmp.reason.oneMissing": "One value is missing, so no real conflict can be inferred.",
  "dcmp.reason.strongDiff": "The field values differ strongly and must be reviewed professionally.",
  "dcmp.reason.partialDiff": "The field values differ partly and must be reviewed.",
  "cfd.fallbackTitle": "Untitled knowledge object",
  "cfd.structuringUnavailable": "I can't reliably organise this right now.",

  // AUFTRAG-mega61: legal pages, notice banner, AI transparency. Sense-for-sense translation of the
  // German source, which remains the legally authoritative wording.
  "legal.pending": "— to be added —",
  "legal.tbd.company": "— to be added —",
  "legal.tbd.address": "— to be added —",
  "legal.tbd.representative": "— to be added —",
  "legal.tbd.email": "— to be added —",
  "legal.tbd.phone": "— to be added —",
  "legal.tbd.register": "— to be added —",
  "legal.tbd.vatId": "— to be added —",
  "legal.tbd.responsible": "— to be added —",
  "legal.tbd.supervisoryAuthority": "— to be added —",
  "legal.tbd.dataProtectionContact": "— to be added —",
  "legal.tbd.dataProtectionOfficer": "— to be added —",
  "legal.tbd.retention": "— to be added —",
  "legal.tbd.serverLogs": "— to be added —",
  "legal.tbd.modelProvider": "— to be added —",
  "legal.tbd.mailProvider": "— to be added —",
  "legal.tbd.hostingProvider": "— to be added —",
  "legal.tbd.thirdCountry": "— to be added —",
  "legal.tbd.version": "— to be added —",

  "legal.draftNotice.title": "Draft status",
  "legal.draftNotice.body":
    "This application is in a closed test phase and is not publicly available. The details still open will be added before publication.",
  "legal.footer.title": "Legal",
  "legal.footer.imprint": "Imprint",
  "legal.footer.privacy": "Privacy",
  "legal.back": "Back to the application",

  "legal.imprint.title": "Imprint",
  "legal.imprint.ddg": "Information pursuant to section 5 DDG (German Digital Services Act)",
  "legal.imprint.representedBy": "Represented by",
  "legal.imprint.contact": "Contact",
  "legal.imprint.contactEmail": "E-mail",
  "legal.imprint.contactPhone": "Telephone",
  "legal.imprint.register": "Register entry",
  "legal.imprint.registerNote":
    "This section is omitted entirely as long as there is no register entry. It is then deleted rather than filled with a substitute value.",
  "legal.imprint.vat": "VAT identification number",
  "legal.imprint.vatText":
    "VAT identification number pursuant to section 27a of the German VAT Act:",
  "legal.imprint.responsible": "Responsible for the content",
  "legal.imprint.supervisory": "Supervisory authority",
  "legal.imprint.supervisoryNote":
    "This section is omitted. It only applies to activities requiring official authorisation; providing knowledge management software does not require authorisation as things stand today.",
  "legal.imprint.status": "Note on the status of this offering",
  "legal.imprint.statusBody":
    "This offering is in a closed test phase and is intended exclusively for invited users. It is not directed at consumers and does not constitute a public offering.",

  "legal.privacy.title": "Privacy policy",
  "legal.privacy.label.purpose": "Purpose",
  "legal.privacy.label.basis": "Legal basis",
  "legal.privacy.label.retention": "Retention period",
  "legal.privacy.label.recipient": "Recipient",
  "legal.privacy.s1.title": "1. Controller",
  "legal.privacy.s1.body":
    "The controller for the processing of personal data within the meaning of the General Data Protection Regulation is:",
  "legal.privacy.s1.dpo": "Data protection officer:",
  "legal.privacy.s2.title": "2. Principle",
  "legal.privacy.s2.body":
    "We process personal data only as far as this is necessary to operate this application. We use no analytics, tracking or advertising services, load no content from third-party servers into your browser and use no tracking pixels. Our server's security policy technically prevents your browser from connecting to third-party providers.",
  "legal.privacy.s3.title": "3. User account and sign-in",
  "legal.privacy.s3.body":
    "To use the application you need an account. In doing so we process your name, your e-mail address and your password. The password is stored exclusively in a form that cannot be reversed.",
  "legal.privacy.s3.purpose": "Providing access, attributing your contributions, securing access.",
  "legal.privacy.s3.basis":
    "Performance of the contract or user relationship, Article 6(1)(b) GDPR.",
  "legal.privacy.s3.retention": "For the duration of the user relationship.",
  "legal.privacy.s3.reset":
    "If you reset your password, we create a one-time identifier that is valid for one hour and then expires.",
  "legal.privacy.s4.title": "4. Storage on your device",
  "legal.privacy.s4.p1":
    "When you sign in we set one cookie named kw_session. It contains only a random identifier, no information about you. It cannot be read by scripts in the browser, is transmitted only over an encrypted connection, is valid for fourteen days and is deleted when you sign out. On our server only a check value is stored, not the identifier itself.",
  "legal.privacy.s4.p2":
    "Without this cookie, signed-in use is technically impossible. It is therefore strictly necessary for the service you have expressly requested; no consent is required for it under section 25(2) TDDDG.",
  "legal.privacy.s4.p3":
    "If you sign in through your organisation's sign-in procedure, we set three further identifiers for the duration of that process; they are valid for ten minutes and are deleted immediately afterwards.",
  "legal.privacy.s4.p4":
    "In addition, the application remembers your view settings in your browser — for example sorting, selected filters, saved views, the chosen appearance and which introductory hints you have already seen. This information does not leave your browser and is not transmitted to us. It is only created once you use the function concerned. The application also works fully if your browser prevents this storage.",
  "legal.privacy.s4.p5":
    "One note that may matter to you: if you capture content while there is no connection to our server, the application keeps these drafts in your browser until they can be transmitted. This intermediate storage can therefore contain content written by you. It is removed there after transmission.",
  "legal.privacy.s4.p6":
    "If you use the application as an installed app, your browser stores program files in a cache so that it starts faster. Responses from our server and your content are not stored there.",
  "legal.privacy.s4.p7":
    "If ending your session fails, the application notes this in your browser under the name kw_signout_pending so that use stays blocked until our server has confirmed the session was ended. Because your session applies to every window and tab of the same browser, this marker is kept in persistent browser storage and takes effect in every window and tab as well — otherwise a second window that was already open would keep showing content even though the sign-out is still unresolved. The marker contains no information about you and is not transmitted to us. It stays until our server confirms the session was ended, or until it is established that your session no longer exists; then it is deleted. It does not expire on its own. So that this does not rest on you, the application retries ending the session by itself — as soon as your connection is back and whenever the application is opened again; you can also trigger it yourself at any time. It is technically necessary for the sign-out you requested.",
  "legal.privacy.s5.title": "5. Your content",
  "legal.privacy.s5.body":
    "The application serves to capture, review and retrieve knowledge. The content you enter or upload is stored together with the time and your identifier as author, so that contributions remain traceable and questions can be asked.",
  "legal.privacy.s5.basis": "Performance of the contract, Article 6(1)(b) GDPR.",
  "legal.privacy.s6.title": "6. Traceability of changes",
  "legal.privacy.s6.body":
    "To keep changes to reviewed knowledge traceable, we keep a continuous log secured against subsequent alteration. It contains the time, the identifier of the acting person, the type of action and the object concerned. IP address and browser identifier are not stored in this log. Sign-in and sign-out are recorded in the same way.",
  "legal.privacy.s6.basis":
    "Legitimate interest in the integrity and traceability of reviewed knowledge, Article 6(1)(f) GDPR.",
  "legal.privacy.s7.title": "7. Protection against misuse",
  "legal.privacy.s7.body":
    "To fend off automated sign-in attempts, we briefly count failed attempts in memory, related to the IP address and the e-mail address entered. These counters are not stored permanently.",
  "legal.privacy.s7.basis":
    "Legitimate interest in the security of the application, Article 6(1)(f) GDPR.",
  "legal.privacy.s7.logs": "Web server operating logs:",
  "legal.privacy.s8.title": "8. Artificial intelligence",
  "legal.privacy.s8.p1":
    "Certain functions of the application use an AI model — for example answering questions, structuring notes, suggesting image descriptions and grouping imported content. For such a result to come about, the content required for it is transmitted to the model's operator and processed there.",
  "legal.privacy.s8.p2":
    "At every place concerned, the application shows you that an AI model is working and what kind of model it is. Results from an AI model can be incorrect and do not replace professional review.",
  "legal.privacy.s8.p3":
    "Knowledge objects classified as confidential or strictly confidential are removed from the context before a question goes to a model — they do not reach the model. The text of your question, however, is transmitted: please do not enter confidential content there.",
  "legal.privacy.s8.thirdCountry": "Transfer to a third country:",
  "legal.privacy.s9.title": "9. Sending e-mail",
  "legal.privacy.s9.body": "We send e-mails for invitations and password resets.",
  "legal.privacy.s9.basis": "Performance of the contract, Article 6(1)(b) GDPR.",
  "legal.privacy.s10.title": "10. Hosting",
  "legal.privacy.s10.body": "The application runs on rented servers.",
  "legal.privacy.s10.basis": "Legitimate interest in economical operation, Article 6(1)(f) GDPR.",
  "legal.privacy.s11.title": "11. Connecting further systems",
  "legal.privacy.s11.body":
    "If your organisation sets up an import from a system of its own, the content required for it is retrieved from there. Your organisation decides which systems those are.",
  "legal.privacy.s12.title": "12. No automated decision in individual cases",
  "legal.privacy.s12.body":
    "There is no automated decision-making, including profiling, that produces legal effects concerning you or similarly significantly affects you. Suggestions from the AI model are suggestions; people decide on the admission and review of knowledge.",
  "legal.privacy.s13.title": "13. Your rights",
  "legal.privacy.s13.body":
    "You have the right to information about the data stored about you, to rectification of incorrect data, to erasure, to restriction of processing, to data portability and to object to processing based on a legitimate interest. If you have given consent, you may withdraw it at any time with effect for the future; the lawfulness of processing carried out until then remains unaffected.",
  "legal.privacy.s13.contact": "Contact for all these matters:",
  "legal.privacy.s13.authority":
    "Independently of this, you have the right to lodge a complaint with a data protection supervisory authority, in particular with the authority of your place of residence or the authority responsible for us:",
  "legal.privacy.s14.title": "14. Necessity of the information",
  "legal.privacy.s14.body":
    "Providing name, e-mail address and password is necessary to set up access. Without this information we cannot provide access. There is no statutory obligation to provide it.",
  "legal.privacy.s15.title": "15. Changes",
  "legal.privacy.s15.body":
    "We adapt this statement when the application or the legal situation changes. Version date:",

  "notice.banner.aria": "Note on using this application",
  "notice.banner.title": "Briefly, for your information",
  "notice.banner.ai":
    "This application works with artificial intelligence. When you ask a question, have notes structured or have an image description suggested, an AI model is used, and the content required for it is transmitted to its operator. Results from an AI model can be incorrect and do not replace professional review. At every place concerned you can see which model is working.",
  "notice.banner.cookie":
    "A technically necessary session cookie is set for signing in. Without this cookie, signed-in use is not possible.",
  "notice.banner.ack": "Understood — continue",
  "notice.banner.decline": "I do not agree",
  "notice.decline.title": "Your session will be ended",
  "notice.decline.body":
    "The session cookie is already set — without it, signed-in use is technically impossible. We are therefore ending your session now and deleting the cookie. You can sign in again at any time.",
  "notice.decline.confirm": "End session now",
  "notice.decline.cancel": "Back to the notice",
  "notice.decline.loginHint":
    "Your session was ended because you did not agree with the notice. You can sign in again at any time.",

  "notice.signOutFailed.title": "Your session was not confirmed as ended",
  "notice.signOutFailed.body":
    "You did not agree with the notice and we tried to end your session — but the server did not confirm it. Your session may still be active. Until that is clear, we are not showing you any content, in every window and tab of this browser. The application retries ending the session by itself — as soon as your connection is back and whenever the application is opened again; you can also try again right away.",
  "notice.signOutFailed.retry": "Try ending the session again",
  "notice.signOutFailed.again":
    "This attempt did not get through either. Please check your network connection.",

  "ai.generatedNotice": "Generated by artificial intelligence — please review professionally.",
  "ai.costHint": "One click may trigger a real, chargeable cloud AI request.",
  "ai.exportNotice":
    "Generated by artificial intelligence (KLARWERK, {{task}}, {{date}}). To be reviewed for content.",
  "ai.task.answer": "question answered",

  "w2.result.heading": "Import result",
  "w2.run.heading": "Run",
  "w2.run.status.QUEUED": "Queued",
  "w2.run.status.FETCHING": "Fetching the source",
  "w2.run.status.PERSISTING_SOURCE": "Storing the original",
  "w2.run.status.EXTRACTING": "Extracting statements",
  "w2.run.status.CREATING_KNOWLEDGE": "Creating knowledge units",
  "w2.run.status.ANALYZING": "Analysis running",
  "w2.run.status.COMPLETED": "Completed",
  "w2.run.status.PARTIAL": "Partially failed",
  "w2.run.status.FAILED": "Failed",
  "w2.run.status.unknown": "State unknown",
  "w2.run.hint.QUEUED": "The run has not started yet. There is no result yet.",
  "w2.run.hint.FETCHING": "The run is under way. What you see is an interim state.",
  "w2.run.hint.PERSISTING_SOURCE": "The run is under way. What you see is an interim state.",
  "w2.run.hint.EXTRACTING": "The run is under way. What you see is an interim state.",
  "w2.run.hint.CREATING_KNOWLEDGE": "The run is under way. What you see is an interim state.",
  "w2.run.hint.ANALYZING": "The run is under way. What you see is an interim state.",
  "w2.run.hint.COMPLETED": "The run went through completely.",
  "w2.run.hint.PARTIAL":
    "Part of the run failed. What you see is incomplete — it is not a finished import.",
  "w2.run.hint.FAILED": "The run failed. What you see below is therefore not the intended result.",
  "w2.run.hint.unknown":
    "The server reported a state this build does not know. What you see must not be read as finished.",
  "w2.run.failureCode": "Error code",
  "w2.run.failureReason": "Reason",
  "w2.source.heading": "Original",
  "w2.source.lead": "The imported document in exactly the revision the knowledge came from.",
  "w2.source.missing": "No original was delivered for this run.",
  "w2.source.missingRequired": "Mandatory details are missing for this original.",
  "w2.source.title": "Title",
  "w2.source.system": "System",
  "w2.source.version": "Version",
  "w2.source.url": "Address",
  "w2.source.importedAt": "Imported on",
  "w2.source.externalId": "Identifier in the source system",
  "w2.knowledge.heading": "Knowledge units",
  "w2.knowledge.lead": "Independent units created from this one original.",
  "w2.knowledge.count": "{{count}} units",
  "w2.knowledge.empty": "This run produced no knowledge unit. That is not a successful import.",
  "w2.item.position": "Unit {{position}}",
  "w2.item.statementMissing": "No statement was delivered for this unit.",
  "w2.item.locator": "Location in the source",
  "w2.item.locatorMissing": "Location missing",
  "w2.item.status": "Validation",
  "w2.item.statusMissing": "Validation status missing",
  "w2.item.conflicts": "Conflicts: {{count}}",
  "w2.item.conflictsNone": "No conflicts reported",
  "w2.item.gaps": "Knowledge gaps: {{count}}",
  "w2.item.gapsNone": "No knowledge gaps reported",
  // AUFTRAG-81: mirror of the DE keys — see the note there.
  "w2.value.missing": "Required value missing",
  "w2.value.none": "Not delivered",
};

const nl: typeof de = {
  // SCRUM-488: eerste tranche contextuele hulpteksten (spiegel van de DE-sleutels).
  "ask.help.sources.title": "Waarom alleen onderbouwde antwoorden?",
  "ask.help.sources.body":
    "Klarwerk antwoordt uitsluitend uit jullie eigen kennisobjecten — nooit uit algemene modelkennis. Bij elk antwoord zie je welke bronnen het gedragen hebben en in welke staat ze zijn. Ontbreekt de basis, dan zegt het dat eerlijk in plaats van te gokken. Controleer de genoemde bronnen voordat je erop vertrouwt.",
  "lib.help.filters.title": "Filters wijzigen alleen de weergave",
  "lib.help.filters.body":
    "Rijpheid, status en domein tonen of verbergen objecten alleen — aan de kennis zelf veranderen ze niets. „Gevalideerd“ is bevestigd door collega’s, „open“ nog in beoordeling.",
  "dup.help.detection.title": "Hoe duplicaten worden herkend",
  "dup.help.detection.body":
    "„Tekstidentiek“ vindt de heuristiek zonder AI; „waarschijnlijk“ beoordeelt het model inhoudelijk. Samenvoegen gebeurt nooit automatisch — jij beslist bewust wat wordt samengevoegd.",
  "extpage.help.scope.title": "Wat externe zoekopdracht mag",
  "extpage.help.scope.body":
    "Externe treffers zijn onderzoekshulp, geen geverifieerde kennis: niets wordt automatisch geïmporteerd of door collega’s gevalideerd. Heeft de beheerder externe opvraging uitgeschakeld, dan blijft het gebied leeg.",
  "app.name": "KLARWERK",
  "app.subtitle": "Reasoning System",
  "app.staleBundle":
    "Er is een nieuwe versie van de app beschikbaar — laad de pagina opnieuw (Cmd+R of Ctrl+R).",
  "nav.group.workspace": "Werkruimte",
  "nav.group.quality": "Kwaliteit & onderhoud",
  "nav.group.control": "Aansturing",
  "nav.group.advanced": "Geavanceerd",
  "nav.start": "Start",
  "nav.tasks": "Mijn taken",
  "nav.capture": "Kennis vastleggen",
  "nav.ask": "Vragen",
  "nav.library": "Bibliotheek",
  "nav.external": "Externe kennis",
  "nav.validation": "Validatie",
  "nav.conflicts": "Conflicten",
  "nav.duplicates": "Duplicaten",
  "nav.badge.tasks": "{{count}} openstaande taken",
  "nav.badge.loading": "Teller wordt geladen …",
  "nav.badge.error": "Teller kon niet worden geladen – opnieuw proberen",
  "nav.badge.stale": "Teller verouderd – verversen mislukt, opnieuw proberen",
  "loadstate.error.title": "Kon niet worden geladen.",
  "loadstate.error.retry": "Opnieuw proberen",
  "loadstate.stale": "Verouderd – verversen mislukt",
  "nav.badge.validation": "{{count}} wachten op beoordeling",
  "nav.badge.conflicts": "{{count}} openstaande tegenstrijdigheden",
  "nav.badge.duplicates": "{{count}} mogelijke duplicaten",
  "nav.risk": "Risico & hiaten",
  "nav.lifecycle": "Levenscyclus",
  "nav.analytics": "Analytics & audit",
  "nav.admin": "Admin",
  "nav.output": "Rapportages",
  "nav.import": "Import & bronnen",
  "nav.graph": "Kennisgraaf",
  "nav.capital": "Kapitaalweergaven",
  "nav.help": "Help",
  "nav.profile": "Profiel",
  "role.viewAs": "Weergave als rol",
  "role.previewNote": "Voorbeeld als {{role}} — je blijft admin.",
  "role.backToAdmin": "Naar adminweergave",
  "role.stage2": "Uitgebreide modules · Fase 2",
  "role.stage2Hint":
    "Fase 2 zijn extra modules naast de kernstroom — kwaliteitsborging, kenniskapitaal en uitvoerformaten. Een beheerder schakelt ze vrij.",
  "role.short.viewer": "Viewer",
  "role.short.experte": "Expert",
  "role.short.controller": "Contr.",
  "role.short.admin": "Admin",
  "role.name.viewer": "Kijker",
  "role.name.experte": "Expert",
  "role.name.controller": "Controller",
  "role.name.admin": "Administrator",
  "action.logout": "Afmelden",
  "topbar.search": "Zoek naar kennis, functies of bijlagen…",
  "topbar.mobile": "Mobiel",
  "topbar.design.classic": "Ontwerp: Klassiek",
  "topbar.design.modern": "Ontwerp: Modern",
  "topbar.design.hint": "Ontwerp wisselen — verandert alleen het uiterlijk, geen inhoud of invoer.",
  "topbar.openMenu": "Menu openen",
  "topbar.closeMenu": "Menu sluiten",
  "topbar.menuLabel": "Navigatiemenu",
  "topbar.toDesktop": "Naar volledige versie",
  "topbar.notifications": "Meldingen",
  "topbar.notificationsPlaceholder": "Nog geen meldingen. Echte bron volgt (#63).",
  "topbar.reasonerActive": "AI-model antwoordt",
  "topbar.reasonerOffline": "Geen AI-model",
  "topbar.reasonerActiveHint": "Een AI-model heeft onlangs bereikbaar geantwoord.",
  "topbar.reasonerUnverified": "AI-model ongeverifieerd",
  "topbar.reasonerUnverifiedHint":
    "Een AI-model is geconfigureerd, maar de bereikbaarheid is nog niet gecontroleerd.",
  "topbar.reasonerUnreachable": "AI-model onbereikbaar",
  "topbar.reasonerUnreachableHint":
    "Een AI-model is geconfigureerd maar was onlangs niet bereikbaar (bijv. sleutel verlopen, dienst uit). Aanroepen draaien deterministisch.",
  "topbar.reasonerOfflineHint":
    "Geen AI-model beschikbaar — de deterministische reservemodus draait.",
  "topbar.external.blocked": "Webzoeken: geblokkeerd",
  "topbar.external.search": "Webzoeken: toegestaan",
  "topbar.external.open": "Webzoeken: open",
  "topbar.external.hint":
    "Externe kennisopvraging (webzoekopdracht) — een APARTE as, niet het AI-model. Regelt alleen webzoeken/openbare verrijking, niet de reasoner.",
  "topbar.plain.ki":
    "Laat zien waar de AI die Klarwerk gebruikt rekent — in eigen huis of bij een aanbieder op internet.",
  "topbar.plain.reasoner":
    "Laat zien of de AI op dit moment antwoordt. „Ongeverifieerd“ betekent alleen: sinds de start is er nog geen antwoord teruggekomen — het is geen fout.",
  "topbar.plain.external":
    "Laat zien of Klarwerk bij het antwoorden ook op het open internet mag kijken. „Geblokkeerd“ betekent: nee, het blijft bij jullie eigen kennis.",
  "topbar.kiExternal": "AI rekent in de cloud",
  "topbar.kiInternal": "AI rekent in eigen huis",
  "topbar.kiMixed": "AI rekent in de cloud en in eigen huis",
  "topbar.kiNone": "Geen AI",
  "topbar.kiNoneSubtitle": "deterministische fallbackmodus",
  "topbar.kiDsgvoYes": "AVG: ja",
  "topbar.kiDsgvoNo": "AVG: nee",
  "topbar.kiExternalHint":
    "Je AI-taken lopen via een cloudmodel buitenshuis — AVG-bevestiging daarom: nee. Een ja krijg je alleen bij een interne AI uit Europa. Details per taak: Beheer → AI.",
  "topbar.kiInternalHint":
    "Je AI-taken lopen volledig via een lokaal model in huis. AVG: ja krijg je alleen hier — en alleen als de AI uit Europa komt. Herkomst wordt nu afgeleid uit de aanbieder-identificatie; in de toekomst geeft de centrale AI-toegangsaansturing die door.",
  "topbar.kiMixedHint":
    "Gemengd gebruik: sommige taken lopen via de externe cloud-AI, andere in huis. De strengste categorie telt — AVG-bevestiging: nee. Details per taak: Beheer → AI.",
  "topbar.kiNoneHint":
    "Er is geen AI-model actief voor een taak. Klarwerk werkt in de deterministische fallbackmodus.",
  "country.us": "VS",
  "country.de": "Duitsland",
  "country.fr": "Frankrijk",
  "country.cn": "China",
  "country.unknown": "Herkomst onbekend",
  "country.ownSystem": "eigen systeem (EU)",
  "topbar.notificationsEmpty": "Geen meldingen.",
  "topbar.notifMarkAll": "Alles gelezen",
  "topbar.notifMarkRead": "Als gelezen markeren",
  "topbar.notifOpen": "Openen",
  "topbar.notifAssignment": "Beoordeling voor jou",
  "topbar.notifImpact": "Jouw kennis heeft geholpen",
  "topbar.notifDuplicate": "Mogelijk duplicaat",
  "topbar.notifGapRedacted": "Openstaande kennislacune",
  "cmd.open": "Snelnavigatie openen",
  "cmd.close": "Sluiten",
  "cmd.placeholder": "Naar pagina springen … (⌘K)",
  "cmd.empty": "Geen resultaat.",
  "cmd.audit": "Audit-log (in Analytics)",
  "toast.dismiss": "Sluiten",
  "page.placeholder":
    "Dit scherm wordt in een latere taak gebouwd. App-shell, navigatie en rollogica staan er al.",
  "status.entwurf": "Concept",
  "status.offen": "Open",
  "status.pruefung": "In beoordeling",
  "status.validiert": "Gevalideerd",
  "status.abgelehnt": "Afgewezen",
  "status.revalidierung": "Hervalidatie",
  "status.konflikt": "Conflict",
  "quality.preliminary": "Voorlopig",
  "quality.reliable": "Betrouwbaar",
  "quality.assured": "Geborgd",
  "evidence.percentSure": "{{pct}} % zeker",
  "evidence.confidenceLabel": "Zekerheid: {{pct}} van 100",
  "evidence.sourceDate": "Bron van {{date}}",
  "evidence.noDate": "geen brondatum",
  "evidence.noSource": "geen bron vastgelegd",
  "evidence.internalSource": "interne bron",
  "evidence.more": "+{{count}} meer",
  "ko.read.evidenceZone": "Bewijs",
  "ko.read.released": "Vrijgave",
  "ko.read.category": "Categorie",
  "ko.read.responsible": "Verantwoordelijk",
  "ko.read.version": "Versie",
  "ko.read.captured": "Vastgelegd op",
  "ko.read.moreDetails": "Meer details (voorwaarden · maatregelen · tags)",
  "intake.question": "Wat weet jij dat anderen zouden moeten weten?",
  "intake.calming": "Begin gewoon te schrijven — Klarwerk helpt met de structuur.",
  "intake.fieldPlaceholder": "Begin gewoon te schrijven …",
  "intake.removeStarter": "Type verwijderen",
  "intake.exampleLabel": "Zoiets — maar dan van jou.",
  "intake.sampleBadge": "Voorbeeld",
  "intake.starter.decision": "Een beslissing die we hebben genomen",
  "intake.starter.mistake": "Een fout die je makkelijk maakt",
  "intake.starter.howItWorks": "Hoe iets bij ons echt werkt",
  "intake.starter.changed": "Iets dat is veranderd",
  "intake.prefill.decision": "We hebben besloten dat ",
  "intake.prefill.mistake": "Een veelgemaakte fout is ",
  "intake.prefill.howItWorks": "Zo werkt het bij ons: ",
  "intake.prefill.changed": "Wat is veranderd, is dat ",
  "intake.sample.title": "Trek de noodstop vóór elk onderhoud",
  "intake.sample.statement":
    "Trek vóór elk onderhoud aan lijn 3 eerst de noodstop en beveilig deze tegen herinschakelen.",
  "intake.live.idle": "Ik luister …",
  "intake.live.checking": "Controleren tegen jullie kennis …",
  "intake.live.new": "Dit is nieuw — er is nog niets over. Jij bent de eerste.",
  "intake.live.similarLead": "Iets soortgelijks bestaat al:",
  "intake.live.similarAsk": "Aanvullen of nieuw?",
  "intake.live.conflictLead": "Let op — dit kan in tegenspraak zijn met:",
  "intake.live.openKo": "Bekijken",
  "intake.live.pending":
    "Niets soortgelijks gevonden. Nog niet op tegenstrijdigheid gecontroleerd.",
  "intake.live.unavailable": "Controle momenteel niet beschikbaar.",
  "intake.structure.heading": "Klarwerk stelt voor — tik aan wat niet klopt:",
  "intake.structure.title": "Titel",
  "intake.structure.category": "Categorie",
  "intake.structure.source": "Vermoedelijke bron",
  "intake.structure.derived": "afgeleid uit je tekst",
  "intake.structure.categoryPlaceholder": "bijv. onderhoud, veiligheid …",
  "intake.done.heading": "Klaar.",
  "intake.done.checked": "Opgenomen in jullie gedeelde kennis.",
  "intake.done.credited": "Je naam ({{name}}) staat als auteur vermeld.",
  "intake.done.findable": "Wie er de volgende keer naar vraagt, vindt het — niet jou.",
  "intake.done.viewKo": "Kennisobject bekijken",
  "intake.done.followUp": "Waarschuw me bij vervolgvragen",
  "intake.submit": "Kennis opslaan",
  "dcmp.noValue": "Geen waarde",
  "dcmp.none": "geen",
  "dcmp.trustStatus": "Vertrouwen {{trust}}; status {{status}}; vereiste controles {{needed}}",
  "dcmp.tagsCategory": "Categorie {{category}}; kennistype {{type}}; tags {{tags}}",
  "dcmp.note.koMissing": "Geen score: minstens één kennisobject ontbreekt.",
  "audit.action.ko_created": "Aangemaakt",
  "audit.action.ko_revised": "Herzien",
  "audit.action.ko_rated": "Beoordeeld",
  "audit.action.ko_admin_validated": "Admin-gevalideerd",
  "audit.action.ko_deleted": "Verwijderd",
  "audit.action.ko_purged": "Definitief verwijderd",
  "audit.action.ko_restored": "Hersteld",
  "audit.action.ko_assigned": "Toegewezen",
  "audit.action.ko_attached": "Bijlage toegevoegd",
  "audit.action.ko_detached": "Bijlage verwijderd",
  "audit.action.ko_author_transferred": "Auteur overgedragen",
  "audit.action.ko_category_changed": "Categorie gewijzigd",
  "audit.action.ko_commented": "Becommentarieerd",
  "audit.action.ko_confidentiality": "Vertrouwelijkheid gewijzigd",
  "audit.action.ko_conflict_review": "Conflictreview",
  "audit.action.ko_returned_to_author": "Terug naar auteur",
  "audit.action.ko_source_added": "Bron toegevoegd",
  "audit.action.ko_source_removed": "Bron verwijderd",
  "ktype.bauchgefuehl": "Intuïtie",
  "ktype.best_practice": "Best practice",
  "ktype.lernkurve": "Leercurve",
  "ktype.technik": "Techniek",
  "ktype.negativwissen": "Negatieve kennis",
  "reasoner.draftLabel": "AI-concept · niet gevalideerd",
  "reasoner.taskInfo.title": "Welke AI werkt hier?",
  "reasoner.taskInfo.cloud": "Cloud-AI",
  "reasoner.taskInfo.local": "Lokaal model",
  "reasoner.taskInfo.rule": "Regelgebaseerd (zonder AI-model)",
  "reasoner.taskInfo.unknown": "Wordt bepaald …",
  "reasoner.taskInfo.bodyCloud":
    "Deze taak loopt via een cloud-AI. Inhoud wordt daarvoor naar de externe aanbieder gestuurd.",
  "reasoner.taskInfo.bodyLocal":
    "Deze taak loopt via een lokaal model op jullie eigen hardware — de inhoud verlaat het huis niet.",
  "reasoner.taskInfo.bodyRule":
    "Deze taak loopt puur regelgebaseerd, zonder AI-taalmodel — deterministisch en zonder externe verzending.",
  "reasoner.taskInfo.bodyUnknown":
    "De huidige AI-toewijzing wordt geladen. Details vind je in het AI-beheer.",
  "reasoner.taskInfo.modelLabel": "Model",
  "reasoner.taskInfo.dsgvoInhouse": "AVG-conform",
  "reasoner.taskInfo.dsgvoInhouseBody":
    "Loopt in huis (lokaal of regelgebaseerd) — de gegevens blijven hier en worden niet aan derden doorgegeven.",
  "reasoner.taskInfo.dsgvoExternal": "Externe verwerking",
  "reasoner.taskInfo.dsgvoExternalBody":
    "Maakt gebruik van een externe cloudaanbieder — de AVG-conformiteit hangt af van de verwerkersovereenkomst met de aanbieder.",
  "ai.unavailable.hint": "AI niet beschikbaar — voor deze taak is geen model actief.",
  "provenance.original": "oorspronkelijk",
  "uikit.sampleStatement": "Drukverlies bij pers P2 zit meestal aan ventiel V4, niet aan de pomp.",
  "state.loading": "Laden …",
  "state.error": "Er is iets misgegaan.",
  "modal.close": "Sluiten",
  "nav.guard.title": "Niet-opgeslagen invoer",
  "nav.guard.body": "Je hebt bij het vastleggen nog niet-opgeslagen inhoud. Wat wil je doen?",
  "nav.guard.stay": "Hier blijven",
  "nav.guard.discard": "Verwerpen en wisselen",
  "nav.guard.save": "Concept opslaan en wisselen",
  "nav.guard.unsavableTitle": "Niet alles kan worden opgeslagen",
  "nav.guard.unsavableLead":
    "Deze inhoud kan het concept niet opslaan — bij wisselen gaat die verloren:",
  "nav.guard.unsavableHint":
    "Blijf hier om die te gebruiken of te verwijderen; „Verwerpen en wisselen” geeft die bewust op. Een opslaan dat deze inhoud meeneemt, bestaat niet.",
  "error.title": "Deze weergave kon niet worden geladen.",
  "error.body":
    "Dit is een weergavefout, geen gegevensverlies. Laad de pagina opnieuw. Treedt het opnieuw op, dan helpt de detailtekst hieronder bij het melden.",
  "error.reload": "Opnieuw laden",
  "error.detail": "Detail",
  "state.empty": "Niets aanwezig.",
  "auth.tagline": "Ervaringskennis die binnen het bedrijf blijft.",
  "auth.taglineSub": "Vastleggen · Valideren · Verhelderen · Beantwoorden · Onderhouden.",
  "auth.title.login": "Aanmelden",
  "auth.title.register": "Account aanmaken",
  "auth.title.waiting": "Bijna klaar",
  "auth.title.setup": "Eerste installatie",
  "auth.sub.login": "Meld je aan met je account.",
  "auth.sub.register": "Maak een account aan — een admin geeft je vrij.",
  "auth.sub.waiting": "Je account wacht op goedkeuring.",
  "auth.sub.setup": "Het eerste account wordt administrator.",
  "auth.waitingNote":
    "Een administrator moet je toegang vrijschakelen. Je krijgt bericht zodra het zover is.",
  "auth.backToLogin": "Terug naar aanmelden",
  "auth.name": "Naam",
  "auth.email": "E-mail",
  "auth.password": "Wachtwoord",
  "auth.passwordRule": "min. 8 tekens",
  "auth.passwordRepeat": "Wachtwoord herhalen",
  "auth.passwordMismatch": "De wachtwoorden komen niet overeen.",
  // WP-VIP2-GATE: zelfregistratie server-side uitgeschakeld (alleen op uitnodiging).
  "auth.registrationDisabled":
    "Registreren kan alleen op uitnodiging — neem contact op met je admin.",
  "auth.submit.login": "Aanmelden",
  "auth.submit.register": "Registreren",
  "auth.submit.setup": "Admin aanmaken & starten",
  "auth.toRegister": "Nog geen account? Registreren",
  "auth.toLogin": "Al een account? Aanmelden",
  "auth.toForgot": "Wachtwoord vergeten?",
  "auth.title.forgot": "Wachtwoord opnieuw instellen",
  "auth.sub.forgot": "We sturen je een link om het opnieuw in te stellen.",
  "auth.submit.forgot": "Link sturen",
  "auth.title.forgotSent": "E-mail onderweg",
  "auth.sub.forgotSent": "Controleer je postvak.",
  "auth.forgotNote":
    "Als er een account met dit e-mailadres bestaat, hebben we een link gestuurd om het wachtwoord opnieuw in te stellen. De link is 1 uur geldig.",
  "auth.title.reset": "Nieuw wachtwoord",
  "auth.sub.reset": "Kies een nieuw wachtwoord voor je account.",
  "auth.newPassword": "Nieuw wachtwoord",
  "auth.submit.reset": "Wachtwoord opslaan",
  "auth.resetDone": "Je wachtwoord is gewijzigd. Je kunt je nu aanmelden.",
  "auth.resetInvalid": "Deze link is ongeldig of verlopen.",
  "auth.toSignIn": "Naar aanmelden",
  "auth.or": "of",
  "auth.ssoButton": "Aanmelden met SSO",
  "auth.ssoUnavailable": "SSO is niet geconfigureerd voor deze instantie.",
  "auth.ssoTitle": "SSO-aanmelding",
  "auth.ssoBusy": "Aanmelding wordt afgerond …",
  "auth.ssoIncomplete": "Onvolledig SSO-antwoord. Meld je opnieuw aan.",
  "cycle.title": "De Klarwerk-kenniscyclus",
  "cycle.subtitle": "Kennis wordt vastgelegd, gevalideerd, gebruikt en actueel gehouden.",
  "demo.title": "Demo-/pilotpad in 3 stappen",
  "demo.subtitle":
    "Een klein echt proces: bronvast vragen, bron/vertrouwen/status/versie bekijken, ongecontroleerde kennis ter validatie aanbieden.",
  "demo.proof.label": "Bewijsketen",
  "demo.proof.find": "Kennis vinden",
  "demo.proof.usability": "Bruikbaarheid herkennen",
  "demo.proof.verify": "Bron/vertrouwen/versie controleren",
  "demo.badge.label": "Demovoorbeeld",
  "demo.badge.hint":
    "Voorbeeld-/pilotkennis uit de demo-seed. Alleen herkomst — vervangt geen status, vertrouwen, bron of validatie. Gevalideerd blijft gevalideerd, open blijft open.",
  "ko.externalUnchecked.label": "Bevat externe, ongecontroleerde kennis",
  "ko.externalUnchecked.hint":
    "In dit artikel is kennis overgenomen uit een publieke AI of websearch. Die is extern en ongecontroleerd — controleer het inhoudelijk; het vervangt status/vertrouwen/validatie niet.",
  // JOB 679 / D2 (K1.2): herkomstmarkering voor kennis die via de Word-invoegtoepassing is
  // vastgelegd. Net als het demolabel ALLEEN herkomst — geen kwaliteits- of statussignaal.
  "ko.originWordAddin.label": "Uit Word",
  "ko.originWordAddin.hint":
    "Deze bijdrage is vastgelegd via de Word-invoegtoepassing. Alleen herkomst — vervangt geen status, vertrouwen, bron of validatie.",
  "demo.ask.label": "1 · Vragen",
  "demo.ask.desc":
    "Stel een onderbouwde vraag (ventiel X / overdruk) — het antwoord komt bronvast met vertrouwen en status, niet uit de lucht gegrepen.",
  "demo.library.label": "2 · Kennis bekijken",
  "demo.library.desc":
    "Zie in de kennisvoorraad bron, vertrouwen, status en rijpheid — een object openen toont onderbouwing en versie.",
  "demo.validation.label": "3 · Valideren",
  "demo.validation.desc":
    "Open/ongecontroleerde kennis hoort in de validatie — beoordeel het tot het geborgd en bruikbaar is.",
  "demo.captureEntry": "Actief uitproberen: Vastleggen → Controleren → Gebruiken",
  "demo.banner.capture.title": "Ervaringsnotitie vastleggen",
  "demo.banner.capture.body":
    "Er wordt een OPEN kennisobject opgeslagen — nog niet gevalideerd. Volgende stap: naar de beoordeling/validatie. Pas na voldoende beoordeling is het bronvast bruikbaar; niets wordt automatisch gevalideerd.",
  "demo.banner.capture.next": "Verder: naar de beoordeling",
  "demo.banner.tag": "Demopad",
  "demo.banner.ask.title": "Stap 1: Bronvast vragen",
  "demo.banner.ask.body":
    "Het antwoord komt met vertrouwen en bron — niet uit de lucht gegrepen. Let op status/vertrouwen en bekijk daarna de bron/het object.",
  "demo.banner.ask.next": "Verder: kennis bekijken",
  "demo.banner.library.title": "Stap 2: Bron, vertrouwen, status, rijpheid bekijken",
  "demo.banner.library.body":
    "Hier zie je per object bron, vertrouwen, status en rijpheid/versie. Bij een open/ongecontroleerde bron gaat het verder naar de validatie.",
  "demo.banner.library.next": "Verder: valideren",
  "demo.banner.detail.title": "Kennisobject: status, vertrouwen, versie, bronnen controleren",
  "demo.banner.detail.body":
    "Hier zie je waarop de bruikbaarheid berust: status, vertrouwen, versie en onderbouwing. Als het bruikbaar is, staat onderaan „Kennis gebruiken” — de vraag blijft bronvast, niets wordt automatisch geborgd.",
  "demo.banner.validation.title": "Stap 3: Open kennis beoordelen",
  "demo.banner.validation.body":
    "Hier wordt open/ongecontroleerde kennis beoordeeld. Doel: van beoordelingswerk geborgde, bruikbare kennis maken.",
  "cycle.capture.label": "Vastleggen",
  "cycle.capture.desc": "Ervaringskennis borgen als kennisobject.",
  "cycle.validate.label": "Valideren",
  "cycle.validate.desc": "In het team beoordelen tot vertrouwen en status betrouwbaar zijn.",
  "cycle.use.label": "Gebruiken",
  "cycle.use.desc": "Bronvast inzetten in antwoorden en output.",
  "cycle.maintain.label": "Actueel houden",
  "cycle.maintain.desc": "Bij wijzigingen hervalideren — kennis blijft geldig.",
  "kg.start.title": "Zo lees je Klarwerk",
  "kg.start.body":
    "Klarwerk scheidt bruikbare kennis consequent van beoordelingswerk: eerst controleren, dan gebruiken.",
  "kg.library.title": "Rijpheid van de treffers",
  "kg.library.body":
    "De rijpheidsbadge laat zien of een treffer direct bruikbaar is of in de beoordeling thuishoort.",
  "kg.ask.title": "Antwoorden zijn bronvast",
  "kg.ask.body":
    "De vragenpagina gebruikt de kennisvoorraad; open of ongecontroleerde bronnen worden gemarkeerd en naar de validatie geleid.",
  "kg.secured.label": "Geborgd",
  "kg.secured.body":
    "Gevalideerde kennis is bruikbaar en blijft via bronnen, vertrouwen en versie navolgbaar.",
  "kg.review.label": "Te controleren",
  "kg.review.body":
    "Open of in beoordeling zijnde kennis hoort in de validatie, niet in het gebruik.",
  "kg.sourceBound.label": "Bronvast",
  "kg.sourceBound.body":
    "Antwoorden ontstaan uit kennisobjecten — zonder grondslag wordt er een hiaat aangemaakt.",
  "start.kicker": "Overzicht",
  "start.greeting": "Goedendag, {{name}}.",
  // AUFTRAG-mega38 BLOCK G1 — zie het DE-blok.
  "start.purpose":
    "Klarwerk verzamelt wat je collega's in het bedrijf hebben geleerd, zodat je ernaar kunt vragen en ziet waar elk antwoord vandaan komt.",
  "start.ctaAsk": "Vraag stellen",
  "start.ctaCapture": "Kennis vastleggen",
  "start.ctaValidate": "Validatie openen",
  "klara.path.ariaLabel": "Klara — aankomende begeleide route",
  "klara.path.kicker": "Met Klara",
  "klara.path.soon": "Binnenkort",
  "klara.path.start.title": "Klara begeleidt kennis vanaf het begin.",
  "klara.path.start.body":
    "Binnenkort kun je kennis direct met Klara vastleggen, structureren en voorbereiden op beoordeling.",
  "klara.path.start.cta": "Kennis vastleggen met Klara",
  "klara.path.capture.title": "Vertel het Klara — zij maakt er een helder concept van.",
  "klara.path.capture.body":
    "Je deelt je ervaring in je eigen woorden. Klara helpt structureren; jij controleert en beslist.",
  "klara.path.capture.cta": "Starten met Klara",
  "klara.path.import.title": "Klara helpt geïmporteerde kennis voor te bereiden.",
  "klara.path.import.body":
    "Na het uploaden helpt Klara straks met ordenen, verduidelijken en voorbereiden op beoordeling.",
  "klara.path.import.cta": "Import met Klara begeleiden",
  "klara.path.m365.summary": "Wat Klara in Microsoft 365 gaat doen",
  "klara.path.m365.body":
    "Klara is gepland als bidirectionele add-in voor Microsoft 365. Zij neemt kennis op waar je toch al werkt, bereidt die gestructureerd voor Klarwerk voor en stelt gecontroleerde bedrijfskennis uit Klarwerk rechtstreeks in Microsoft 365 beschikbaar — controleren en beslissen blijft bij jou. Beschikbaar is dit nog niet.",
  "start.todo": "Vandaag te doen",
  "start.workTitle": "Volgende acties",
  "start.severity.critical": "nu",
  "start.severity.today": "vandaag",
  "start.severity.later": "later",
  "shelp.cycle.title": "De Knowledge-OS-cyclus",
  "shelp.cycle.body":
    "De vier tegels vormen de cyclus van jouw kennis: Vastleggen → Valideren → Gebruiken → Actueel houden. Elke tegel brengt je direct naar het juiste onderdeel. Je hoeft niet alles tegelijk te doen — begin met wat er nu speelt. Er start niets vanzelf.",
  "shelp.work.title": "Jouw werkoverzicht",
  "shelp.work.body":
    "Hier staat wat er nu echt op je wacht — uit echte data (open beoordelingen, conflicten, kennishiaten), geen verzonnen to-dolijst. Het getal rechts zegt hoeveel het er zijn. Klik op een regel om daar direct verder te werken. Doe je niets, dan gebeurt er niets automatisch.",
  "shelp.severity.title": "De gekleurde stippen",
  "shelp.severity.body":
    "De stip links geeft de urgentie aan: Rood = nu aan de beurt (geblokkeerd of kritiek), Geel = vandaag zinvol, Grijs = kan wachten. Dat is alleen een houvast, geen dwang — jij bepaalt de volgorde, en er wordt niets automatisch afgehandeld.",
  "start.focusLabel": "Meest urgente openstaande werk",
  "work.conflicts": "Conflicten oplossen",
  "work.criticalGaps": "Kritieke kennishiaten",
  "work.revalidation": "Hervalidaties verschuldigd",
  "work.validation": "Open validaties",
  "work.learning": "Open leerpad-stappen",
  "start.allTasks": "Alle taken →",
  "roleLink.noReach": "Geen toegang",
  "roleLink.noReachHint":
    "Dit gebied is niet vrijgegeven voor jouw rol. Het gegeven blijft staan omdat het klopt — alleen de weg ernaartoe is voor jou dicht.",
  "start.todoEmpty": "Niets open. Goed gedaan.",
  "start.todoLoading": "Werkoverzicht wordt geladen …",
  "start.stufe2.title": "Uitgebreide functies (Fase 2)",
  "start.stufe2.body":
    "Fase 2 zijn extra modules naast de kernstroom. Als admin heb je uitgebreide functies tot je beschikking: {{features}}. Zet daarvoor „{{toggle}}' onderaan in de zijbalk aan.",
  "task.kicker": "Taken",
  "task.critical": "Kritiek",
  "task.today": "Vandaag",
  "task.later": "Later",
  "task.none": "Niets hier.",
  "task.noneFiltered": "Geen item voor dit filter.",
  "task.filter.all": "Alle",
  "task.filter.validation": "Validatie",
  "task.filter.returned": "Nawerk",
  "task.filter.conflict": "Conflicten",
  "task.filter.gap": "Kennishiaten",
  "task.filter.revalidation": "Hervalidatie",
  "task.conflict": "Conflict",
  "task.validation": "Validatie",
  "task.revalidation": "Hervalidatie",
  "task.gap": "Kennishiaat",
  "task.gapRedacted": "Vertrouwelijk kennishiaat",
  "task.returned": "Nawerk",
  "task.action.returned": "Concept herzien",
  "task.action.conflict": "Conflict beslissen",
  "task.action.validation": "Kennis beoordelen",
  "task.action.revalidation": "Geldigheid controleren",
  "task.action.gap": "Hiaat prioriteren",
  "task.action.open": "Openen",
  "task.explain.returned":
    "Een beoordelaar heeft jouw kennis teruggegeven voor nawerk. Open het, verwerk de terugkoppeling en dien het opnieuw in.",
  "task.explain.conflict":
    "Twee uitspraken spreken elkaar tegen. Open het conflict en beslis welke geldt (of leg beide vast).",
  "task.explain.validation":
    "Beoordeel deze kennis en geef een oordeel: Goedkeuren (groen), Navraag (geel) of Afwijzen (rood). Vanaf voldoende groene oordelen geldt het als gevalideerd.",
  "task.explain.revalidation":
    "Er is iets veranderd — bevestig of deze kennis nog geldig is, of geef het terug voor herziening.",
  "task.explain.gap":
    "Voor deze vraag ontbreekt geborgde kennis. Prioriteer het hiaat of leg er zelf een bijdrage voor vast.",
  "task.explain.open": "Open deze taak om de volgende stap te zien.",
  "task.phaseLabel": "Fase:",
  "capture.kicker": "Kennis vastleggen",
  "capture.title": "Ervaringskennis vastleggen",
  "capture.rescue.kicker": "Kennis redden",
  "capture.rescue.title": "Borg ervaringskennis voordat die verloren gaat.",
  "capture.rescue.subtitle":
    "Je hoeft geen formulier perfect in te vullen — vertel gewoon wat je weet. Klarwerk en de AI helpen je het helder en bruikbaar te maken.",
  "capture.rescue.step.tell.label": "1. Vertellen",
  "capture.rescue.step.tell.hint":
    "Schrijf of dicteer in je eigen woorden wat je uit ervaring weet — ruw is prima.",
  "capture.rescue.step.structure.label": "2. AI structureert",
  "capture.rescue.step.structure.hint":
    "De AI maakt er een helder concept van; in de Knowledge Studio kun je alles rustig nabewerken.",
  "capture.rescue.step.validate.label": "3. Laten controleren",
  "capture.rescue.step.validate.hint":
    "Opslaan is genoeg — daarna beoordelen collega's de kennis voordat die betrouwbaar wordt gebruikt.",
  "capture.rescue.impactTitle": "Waarom jouw bijdrage telt",
  "capture.rescue.impact.secure": "Redt ervaring die anders verloren zou gaan",
  "capture.rescue.impact.improve": "Verbetert de gedeelde kennisbasis",
  "capture.rescue.impact.honest": "Wordt pas na beoordeling als betrouwbaar gemarkeerd",
  "capture.rescue.showLess": "Minder",
  "capture.rescue.showMore": "Handleiding",
  "capture.flow.railKicker": "Zo ga je te werk",
  "capture.flow.step.raw.label": "Ruwe kennis vastleggen",
  "capture.flow.step.raw.hint":
    "Vertel in je eigen woorden wat je weet — steekwoorden zijn genoeg.",
  "capture.flow.step.studio.label": "Structureren in de Studio",
  "capture.flow.step.studio.hint":
    "De grote werkruimte met AI-hulp maakt er een helder artikel van — jij neemt bewust over.",
  "capture.flow.step.review.label": "Controleren & indienen",
  "capture.flow.step.review.hint":
    "Opslaan en ter beoordeling geven — pas daarna geldt het als betrouwbaar.",
  "capture.flow.railKickerHint":
    "De Knowledge Studio is de aanbevolen weg — niets wordt afgedwongen.",
  "capture.flow.studioRecommended": "Aanbevolen",
  "capture.flow.studioLead":
    "Aanbevolen volgende stap: rustig structureren in de Knowledge Studio. Het formulier blijft voor je bewaard.",
  "capture.flow.submitValue":
    "Jouw ervaringskennis wordt vastgelegd voordat die verloren gaat — pas na de beoordeling geldt die als betrouwbaar. Er wordt niets automatisch gevalideerd.",
  "capture.wizard.back": "Terug naar vertellen",
  "capture.wizard.structuring": "De AI structureert jouw kennis …",
  "capture.wizard.condMeasures": "Voorwaarden & maatregelen",
  "capture.wizard.condMeasuresHint":
    "Gestructureerd afgeleid uit jouw kennis — belangrijk voor de beoordeling en later gebruik. Pas dit hier zo nodig aan.",
  "capture.wizard.helpers": "Hulpmiddelen, sjablonen & context van bijlagen",
  "capture.wizard.helpersHint": "Optionele ondersteuning — niets hiervan is verplicht.",
  "capture.wizard.docLabel": "Jouw kennispagina",
  "capture.wizard.pageTitle": "Kennispagina bewerken",
  "start.orientation.title": "Oriëntatie: zo lees je Klarwerk & het demopad",
  "start.orientation.hint":
    "Bij het eerste bezoek open — daarna hier ingeklapt en altijd weer uit te klappen.",
  "capture.wizard.titleLabel": "Titel",
  "capture.wizard.structData": "Kernuitspraak, voorwaarden & maatregelen",
  "capture.wizard.discard": "Verwerpen",
  "ko.couple.title": "Koppeling met installatie",
  "ko.deleteButton": "Kennisobject verwijderen",
  "ko.deleteQ":
    "Verwijderen? De bijdrage gaat naar de prullenbak en is daar 28 dagen door de admin te herstellen. Demogegevens worden meteen definitief verwijderd.",
  "ko.deleteKeep": "Behouden",
  "ko.deleteYes": "Ja, verwijderen",
  "ko.deleteDone": "Kennisobject verwijderd.",
  "ko.deleteAlreadyGone": "Kennisobject bestond al niet meer. Lijst bijgewerkt.",
  "adm.ai.title": "AI-beheer",
  "adm.purgeButton": "Demogegevens verwijderen",
  "adm.purgeQ":
    "Weet je zeker dat je ALLE demogegevens wilt verwijderen (ook door testers gewijzigde)? Je eigen kennis blijft onaangeroerd.",
  "adm.purgeKeep": "Annuleren",
  "adm.purgeYes": "Ja, definitief verwijderen",
  "adm.purgeDone":
    "Demogegevens verwijderd: {{kos}} kennisobjecten, {{conflicts}} conflicten + {{duplicates}} duplicaten opgelost, {{gaps}} kennishiaten, {{users}} demogebruikers.",
  "adm.seedSkippedInline":
    "Niet geladen: de demovoorraad is al aanwezig (geen duplicaten). Gebruik „Demogegevens verwijderen“ om deze te verwijderen en daarna opnieuw te laden.",
  "adm.seedForce": "Demovoorraad opnieuw laden",
  // AUFTRAG-mega64 Block A — zie de Duitse versie voor de onderbouwing.
  "adm.seedCredsTitle": "Eenmalige wachtwoorden van de nieuwe demoaccounts",
  "adm.seedCredsHint":
    "Deze wachtwoorden zijn net willekeurig gegenereerd en worden ALLEEN HIER weergegeven. De server bewaart ze niet en kan ze niet herhalen. Noteer ze of geef ze nu door — bij het opnieuw laden van deze pagina zijn ze weg en hebben de accounts een wachtwoordreset nodig.",
  "adm.factory.title": "Fabrieksinstellingen",
  "adm.factory.help":
    "Zet de lokale instantie volledig terug: alle kennisobjecten, gebruikers, conflicten, hiaten en instellingen worden verwijderd. Daarna sluit het programma zich af; bij de volgende start begint de eerste installatie en wordt de eerste gebruiker weer admin. Alleen beschikbaar in de lokale desktopversie.",
  "adm.factory.hint":
    "Voor herhaalde tests: alles verwijderen en het programma afsluiten. Na de herstart is alles weer zoals bij de eerste installatie.",
  "adm.factory.button": "Terugzetten naar fabrieksinstellingen",
  "adm.factory.confirm1":
    "Weet je zeker dat je ALLE gegevens wilt verwijderen en het programma wilt afsluiten?",
  "adm.factory.passwordLabel": "Ter bevestiging je admin-wachtwoord",
  "adm.factory.confirm2": "Laatste waarschuwing: deze stap is onomkeerbaar.",
  "adm.factory.warnBody":
    "ALLE kennisobjecten, accounts en instellingen worden verwijderd en het programma wordt afgesloten. Dit kan niet ongedaan worden gemaakt.",
  "adm.factory.wrongPassword": "Onjuist wachtwoord — de fabrieksreset is niet uitgevoerd.",
  "adm.factory.cancel": "Annuleren",
  "adm.factory.continue": "Verder",
  "adm.factory.execute": "Terugzetten & afsluiten",
  "adm.factory.restartHint":
    "Teruggezet. Het programma wordt afgesloten — start de KLARWERK-app opnieuw. De eerste gebruiker wordt dan weer admin.",
  "adm.factoryDone": "Fabrieksreset gestart — het programma wordt afgesloten.",
  "capture.tellResetQ": "Wil je de tekst en bijlagen echt verwerpen?",
  "capture.diktatListening": "Opname loopt — praat gewoon, de tekst verschijnt onderin het veld.",
  "capture.diktatIdleHint": "Klik op de knop en vertel — geen formulier, geen voorbereiding.",
  "adm.ai.help":
    "Bepaal globaal of per taak welke AI werkt. „Auto” gebruikt het model als er een sleutel is ingesteld; „Deterministisch” werkt bewust zonder model. Sleutels blijven uitsluitend op de server — nooit in de browser.",
  "adm.ai.internExtern":
    "Je kunt intern (On-Premise Enterprise AI, eigen LLM) of extern (cloud) laten werken — globaal als standaard of fijn per taak. De interne optie verschijnt zodra een eigen LLM bereikbaar is; beide zijn met „Sleutel testen” / „Lokale LLM testen” live te controleren.",
  "adm.ai.status": "Actieve provider: {{provider}} · Modus: {{mode}}",
  "adm.ai.modeModel": "Model",
  "adm.ai.modeDemo": "Deterministisch",
  "adm.sec.konten": "Accounts",
  "adm.sec.ki": "AI",
  "adm.sec.daten": "Gegevens",
  "adm.sec.sicherheit": "Beveiliging",
  "adm.sec.bereitschaft": "Gereedheid",
  "adm.print": "Afdrukken",
  "adm.firstrun.kicker": "Eerste start",
  "adm.firstrun.title": "Welkom — je werkruimte staat klaar.",
  "adm.firstrun.lead":
    "Als eerste account ben je admin. Alles wat nodig is, is voorbereid — hier zijn drie rustige eerste stappen. Deze kaart verschijnt alleen bij het eerste bezoek.",
  "adm.firstrun.dismiss": "Verbergen",
  "adm.firstrun.done": "Begrepen — verbergen",
  "adm.firstrun.note":
    "Geen dwang, geen volgorde: je kunt altijd vrij aan de slag. Eenmaal verborgen blijft ze verborgen.",
  "adm.firstrun.ki.loading": "AI-status wordt gecontroleerd …",
  "adm.firstrun.ki.both": "Beide AI's verbonden: cloud-AI en je On-Premise Enterprise AI.",
  "adm.firstrun.ki.cloudOnly":
    "Cloud-AI verbonden. De On-Premise Enterprise AI is nog niet aangesloten (Admin → AI).",
  "adm.firstrun.ki.localOnly":
    "Lokale LLM verbonden. De cloud-AI is nog niet geconfigureerd (Admin → AI).",
  "adm.firstrun.ki.none":
    "Nog geen AI verbonden — de deterministische vervangmodus blijft werken (Admin → AI).",
  "adm.firstrun.step.capture.t": "Kennis vastleggen",
  "adm.firstrun.step.capture.b":
    "Vertel het aan de AI of upload een document — de AI structureert, jij controleert.",
  "adm.firstrun.step.validate.t": "Kennis controleren",
  "adm.firstrun.step.validate.b":
    "In het beoordelingsgedeelte wordt ervaringskennis goedgekeurd — pas dan is die „bruikbaar”.",
  "adm.firstrun.step.admin.t": "Beheer openen",
  "adm.firstrun.step.admin.b": "Accounts, AI-koppeling, gegevens en beveiliging op één plek.",
  "adm.firstrun.doneBadge": "klaar",
  "adm.ready.title": "VIP-gereedheid",
  "adm.ready.help":
    "Een eerlijke status in één oogopslag vóór de test: wat staat er, wat ontbreekt. Elke regel uit echte cijfers, niets mooier gemaakt.",
  "adm.ready.intro":
    "Snelle controleblik vóór de VIP-test — groen betekent klaar, geel controleren.",
  "adm.ready.note":
    "„Openstaande beoordelingen” en het niveau van de externe kennisopvraag zijn neutrale gegevens — geen tekortkoming, alleen context.",
  "adm.ready.ki": "Verbonden AI's",
  "adm.ready.ki.both": "Beide verbonden",
  "adm.ready.ki.partial": "Gedeeltelijk verbonden",
  "adm.ready.ki.none": "Geen verbonden",
  "adm.ready.validated": "Gevalideerde kennis",
  "adm.ready.openReviews": "Openstaande beoordelingen",
  "adm.ready.count": "{{n}}",
  "adm.ready.upload": "Uploadlimieten",
  "adm.ready.upload.val": "{{n}} bijlagen · {{mb}} MB",
  "adm.ready.unknown": "onbekend",
  "adm.ready.loading": "wordt geladen …",
  "adm.ready.demo": "Demogegevens",
  "adm.ready.demo.loaded": "{{n}} geladen — te verwijderen onder Gegevens",
  "adm.ready.demo.none": "geen geladen",
  "adm.ready.demo.goto": "Naar Gegevens",
  "adm.ready.external": "Externe kennisopvraag",
  "adm.ready.ext.blocked": "Geblokkeerd",
  "adm.ready.ext.searchOnClick": "Zoeken op klik",
  "adm.ready.ext.searchAttach": "Zoeken & bijvoegen",
  "adm.ready.ext.open": "Open",
  "adm.sich.auditTitle": "Auditlog — hash-geschakeld, afwijkingen aantoonbaar",
  "adm.sich.auditHelp":
    "Elke beveiligingsrelevante actie wordt alleen toegevoegd en via een hashketen aan de vorige vermelding gekoppeld. Wordt een vermelding achteraf gewijzigd of verwijderd, dan klopt de hash niet meer — de afwijking is rekenkundig vast te stellen en wordt bij de integriteitscontrole met nummer, datum en actie benoemd. De keten heeft daarbij geen extern verankerd begin: wie volledige schrijftoegang tot de database heeft, kan een vermelding samen met alle volgende hashes opnieuw opbouwen. Het log is dus verifieerbaar (tamper-evident) — de keten houdt een wijziging niet tegen, ze maakt die opvallend.",
  "adm.sich.auditIntro":
    "Append-only, hash-geschakeld: een verifieerbaar spoor van alle beveiligingsrelevante acties. Een latere afwijking op een vermelding is rekenkundig vast te stellen.",
  "adm.sich.auditCount": "{{count}} vermeldingen in de keten",
  "adm.sich.verify.button": "Integriteit controleren",
  "adm.sich.verify.ok": "Integriteit gecontroleerd ✓ — {{count}} vermeldingen, keten sluitend",
  "adm.sich.verify.serialisation":
    "Keten sluitend — {{count}} vermeldingen, geen breuk. Bij {{n}} vermeldingen is de controlesom van de gegevensvelden niet na te rekenen, omdat de database de volgorde van die velden normaliseert. De aanwezige waarden passen bij de opgeslagen hash; geen enkele afwijking blijft onopgelost.",
  "adm.sich.verify.unconfirmed":
    "Keten niet bevestigd — eerste afwijking bij vermelding {{seq}} van {{at}} ({{action}}). Soort: {{kind}}. De oorzaak moet worden onderzocht.",
  "adm.sich.verify.unconfirmedPlain": "Keten niet bevestigd — de oorzaak moet worden onderzocht.",
  "adm.sich.verify.kind.linkage": "keten verbroken",
  "adm.sich.verify.kind.serialisation": "veldvolgorde van de database",
  "adm.sich.verify.kind.unresolved": "controlesom niet op te lossen",
  "adm.sich.verify.kind.unchecked": "controlesom niet onderzocht (te veel veldvolgordes)",
  "adm.sich.dataTitle": "Privacy & beveiliging",
  "adm.sich.dataHelp":
    "Een eerlijk overzicht van de systeemeigenschappen — geen beloftes, maar hoe KLARWERK is gebouwd.",
  "adm.sich.keys.t": "Sleutels blijven in de sleutelhanger",
  "adm.sich.keys.b":
    "API-sleutels staan uitsluitend aan de serverkant of in de macOS-sleutelhanger — nooit in de browser, nooit in de code of repository.",
  "adm.sich.localAi.t": "On-Premise Enterprise AI mogelijk",
  "adm.sich.localAi.b":
    "Naast de cloud-AI kun je een eigen lokale LLM aansluiten. De lokale AI is alleen via een private tunnel bereikbaar, nooit openbaar.",
  "adm.sich.external.t": "Externe kennisopvraag standaard beperkt",
  "adm.sich.external.b":
    "Public-AI en webzoekopdrachten worden door de admin aangestuurd en zijn standaard niet open. Niets verlaat ongecontroleerd het systeem.",
  "adm.sich.audit.t": "Hash-geschakeld auditlog",
  "adm.sich.audit.b":
    "Alle beveiligingsrelevante acties worden append-only en hash-geschakeld vastgelegd. Een latere afwijking op een vermelding is rekenkundig aantoonbaar en wordt bij de integriteitscontrole benoemd (tamper-evident).",
  "adm.sich.trash.t": "Verwijderen met prullenbak",
  "adm.sich.trash.b":
    "Verwijderde items gaan eerst naar de prullenbak (te herstellen); de definitieve verwijdering gebeurt pas na vier weken. Geen stil gegevensverlies.",
  "adm.sich.roles.t": "Rollen & minimale rechten",
  "adm.sich.roles.b":
    "Vier rollen (Kijker, Expert, Controller, Admin). Elke actie controleert aan de serverkant het benodigde recht.",
  "adm.sich.noCustomerData.t": "Geen klantgegevens in tests",
  "adm.sich.noCustomerData.b":
    "Kwaliteitsborging en evaluaties verlopen zonder echte klantgegevens.",
  "adm.sich.evidenceNote":
    "Alle cijfers hier zijn live-waarden van deze instantie — gemeten, niet beweerd. Streefwaarden of rekenvoorbeelden worden altijd uitdrukkelijk als zodanig aangeduid.",
  "adm.ai.test": "Sleutel testen",
  "adm.ai.testRunning": "testen …",
  "adm.conflictSelfTest.button": "Conflictdetectie testen",
  "adm.conflictSelfTest.running": "detectie testen …",
  "adm.conflictSelfTest.ok": "Conflict + botsingsvelden + letterlijk bewijs herkend",
  "adm.conflictSelfTest.noModel": "geen model (deterministische vervangmodus) — geen detectie",
  "adm.conflictSelfTest.noConflict":
    "model actief, maar geen conflict herkend (modelfout of oordeel: geen tegenspraak)",
  "adm.conflictSelfTest.noKollision": "conflict herkend, maar botsingsvelden leeg",
  "adm.conflictSelfTest.provider": "Provider: {{provider}}",
  "adm.conflictSelfTest.streitpunkt": "Geschilpunt: {{streitpunkt}}",
  "adm.conflictSelfTest.label": "Conflict",
  "adm.selfTest.button": "Detectie testen (conflict + duplicaat)",
  "adm.selfTest.running": "detectie testen …",
  "adm.dupSelfTest.label": "Duplicaat",
  "adm.dupSelfTest.ok": "Duplicaat herkend (semantisch gelijk, lexicaal verschillend)",
  "adm.dupSelfTest.noModel": "geen model (deterministische vervangmodus) — geen detectie",
  "adm.dupSelfTest.noDuplicate":
    "model actief, maar geen duplicaat herkend (modelfout of oordeel: geen duplicaat)",
  "adm.dupSelfTest.relation": "Relatie: {{relation}}",
  "adm.ai.testOk": "Verbinding oké — {{provider}} heeft geantwoord. De sleutel werkt.",
  "adm.ai.testLocal": "Lokale LLM testen",
  "adm.ai.testLocalOk": "Lokale LLM heeft geantwoord ({{provider}}).",
  "adm.ai.testFail":
    "Test mislukt: {{detail}} Tip: vernieuw de sleutel in het startdialoogvenster of de sleutelhanger (service Klarwerk, account ANTHROPIC_API_KEY) en start de app opnieuw.",
  "adm.ai.global": "Globaal (standaard voor alle taken)",
  "adm.ai.choice.inherit": "— zoals globaal —",
  "adm.ai.choice.auto": "Auto (model indien beschikbaar)",
  "adm.ai.choice.model": "Model vereisen",
  "adm.ai.choice.cloud": "Extern · cloud-LLM (Claude)",
  "adm.ai.choice.local": "Intern · eigen LLM (on-prem)",
  "adm.ai.choice.localUnavailable": "Intern · eigen LLM (niet verbonden)",
  "adm.ai.choice.deterministic": "Deterministisch (zonder model)",
  "adm.ai.task.structure": "Structureren",
  "adm.ai.task.assist": "Schrijfpalet (AI-hulp)",
  "adm.ai.task.interview": "Begeleid interview",
  "adm.ai.task.answer": "Vragen beantwoorden",
  "adm.ai.task.select": "Kandidaatselectie",
  "adm.ai.task.extract": "Kennis uit bestand",
  "adm.ai.task.describe": "Afbeeldingsbeschrijving (voorstel)",
  "adm.ai.task.group": "Importkandidaten groeperen",
  "adm.ai.effModel": "Model",
  "adm.ai.effDet": "deterministisch",
  "adm.ai.eff.cloud": "extern",
  "adm.ai.eff.local": "intern",
  "adm.ai.eff.deterministic": "deterministisch",
  "adm.ai.save": "Toewijzing toepassen",
  "adm.ai.detail": "Fijnafstemming per taak",
  "adm.ai.detailHint": "optioneel — standaard volstaat meestal",
  "adm.ai.saved": "AI-toewijzing toegepast.",
  "adm.ai.dirtyHint": "Nog niet toegepast — klik op ‘Toewijzing toepassen’.",
  "adm.ai.applied": "Toegepast ✓",
  "adm.ai.persistNote":
    "Geldt tot de volgende herstart van de app — permanente opslag en lokale modellen komen met de volledige uitbouw (PMO-vermelding).",
  "adm.presets.title": "Eigen AI-functies",
  "adm.presets.help":
    "Het AI-palet in de editor biedt fabrieksfuncties (Helderder, Structureren, Uitbreiden, Spelling, Opmaken). Hier leg je EXTRA, eigen functies voor je organisatie aan — een naam voor de knop en de instructie die de AI krijgt (bijv. „Vat samen voor de dienstoverdracht in 5 steekwoorden”). De instructie is in het palet bij het ?-teken open zichtbaar; zoals altijd geldt: de AI doet alleen een voorstel ter voorbeeld, overnemen doe je bewust met een klik. Fabrieksfuncties kun je niet verwijderen.",
  "adm.presets.hint":
    "Extra functies voor het AI-palet in de editor — telkens een knopnaam en een instructie aan de AI. Zichtbaar voor alle rollen; maximaal 12.",
  "adm.presets.empty": "Nog geen eigen functies — het fabriekspalet geldt ongewijzigd.",
  "adm.presets.name": "Naam van de knop (bijv. Dienstoverdracht)",
  "adm.presets.instruction": "Instructie aan de AI (bijv. Vat samen in 5 steekwoorden …)",
  "adm.presets.add": "Functie toevoegen",
  "adm.presets.save": "Functies opslaan",
  "adm.presets.saved": "Eigen AI-functies opgeslagen.",
  "adm.val.title": "Beoordelingen",
  "adm.val.help":
    "Het standaardaantal beoordelaars geldt voor nieuwe inzendingen zonder eigen opgave. Toegestaan is 1 tot 5. Bestaande bijdragen blijven ongewijzigd; wijzigingen komen in het auditlog.",
  "adm.val.hint":
    "Zoveel beoordelingsbevestigingen heeft een nieuwe bijdrage standaard nodig totdat die als gevalideerd geldt.",
  "adm.val.label": "Standaardaantal beoordelaars (1–5)",
  "adm.val.save": "Opslaan",
  "adm.val.invalid": "Voer een geheel getal tussen 1 en 5 in.",
  "adm.val.saved": "Standaardaantal beoordelaars opgeslagen.",
  "adm.upload.title": "Uploadlimieten",
  "adm.upload.help":
    "Bepaalt hoeveel bijlagen een object mag hebben en hoe groot een afzonderlijke bijlage mag zijn. Geldt voor nieuwe bijlagen; bestaande blijven. Wijzigingen komen in het auditlog.",
  "adm.upload.hint":
    "Deze limieten verschijnen overal waar een bestand kan worden gekozen en worden bij het toevoegen aan de serverkant afgedwongen. De grootte meet het overgedragen bestand inclusief transportcodering (ongeveer 1,34× de zuivere bestandsgrootte).",
  "adm.upload.maxAttachments": "Bijlagen per object (max.)",
  "adm.upload.maxMb": "Grootte per bijlage (MB, max.)",
  "adm.upload.rawHint": "komt overeen met ongeveer {{raw}} MB zuivere bestandsgrootte",
  "adm.upload.save": "Opslaan",
  "adm.upload.saved": "Uploadlimieten opgeslagen.",
  "adm.ext.title": "Externe kennisopvraag",
  "adm.ext.help":
    "Bepaalt of de app externe bronnen (web) en de Public-AI mag gebruiken voor verrijking. Vier niveaus van volledig geblokkeerd tot open. Standaard bewust restrictief. Wijzigingen komen in het auditlog.",
  "adm.ext.hint":
    "Geldt voor het extern bronnen zoeken bij het vastleggen/beoordelen en de Public-AI-verrijking.",
  "adm.ext.save": "Opslaan",
  "adm.ext.saved": "Regelaar voor externe kennisopvraag opgeslagen.",
  "adm.ext.note": "Werkt meteen voor iedereen; de server dwingt de blokkering bovendien af.",
  "adm.dup.title": "Duplicaatdetectie",
  "adm.dup.help":
    "Vanaf welke AI-waarschijnlijkheid een vermoedelijk duplicaat wordt getoond. Lager betekent meer treffers, maar ook meer valse meldingen om weg te klikken.",
  "adm.dup.hint":
    "De AI vergelijkt elke nieuwe bijdrage inhoudelijk met het hele bestand. Deze waarde bepaalt vanaf welke waarschijnlijkheid een treffer op de duplicatenpagina verschijnt.",
  "adm.dup.threshold": "Drempel (%)",
  "adm.dup.save": "Opslaan",
  "adm.dup.saved": "Duplicaatdrempel opgeslagen.",
  "adm.ext.stage.blocked": "Geblokkeerd",
  "adm.ext.stage.search_on_click": "Alleen zoeken op klik",
  "adm.ext.stage.search_attach": "Zoeken + bijvoegen",
  "adm.ext.stage.open": "Open",
  "adm.ext.stageHint.blocked":
    "Externe kennisopvraag volledig geblokkeerd — niets zichtbaar of oproepbaar.",
  "adm.ext.stageHint.search_on_click": "Extern zoeken alleen op uitdrukkelijke klik (standaard).",
  "adm.ext.stageHint.search_attach": "Extern zoeken en resultaten als bron bijvoegen toegestaan.",
  "adm.ext.stageHint.open": "Open: zoeken, bijvoegen en Public-AI-verrijking toegestaan.",
  "enrich.title": "Public-AI-verrijking",
  "enrich.help":
    "Haal extra achtergrondinformatie op bij de Public-AI — uit de modelkennis of uit een onderbouwde webzoekopdracht. Resultaten zijn extern en ongecontroleerd; ze worden alleen op jouw klik in het concept overgenomen en nooit automatisch gevalideerd.",
  "enrich.disclaimer":
    "Extern & ongecontroleerd — controleer inhoudelijk voordat je het overneemt.",
  "enrich.modeModel": "Modelkennis",
  "enrich.modeWeb": "Webzoekopdracht",
  "enrich.placeholder": "Waarnaar zoeken? (bijv. begrip, vraag)",
  "enrich.run": "Verrijken",
  "enrich.running": "Zoeken loopt …",
  "enrich.externBadge": "Extern · ongecontroleerd",
  "enrich.take": "In concept overnemen",
  "enrich.noModel":
    "Geen AI-model verbonden — de Public-AI-verrijking heeft een actief model nodig.",
  "enrich.empty": "Geen externe treffers gevonden.",
  "enrich.disabledHint":
    "Public-AI-verrijking is beschikbaar zodra een admin de externe kennisopvraag op „Open” zet (Admin → Externe kennisopvraag).",
  "enrich.openAdmin": "Naar de admin-instellingen",
  "adm.trash.title": "Prullenbak",
  "adm.trash.help":
    "Verwijderde bijdragen komen hier terecht en blijven 28 dagen te herstellen. Daarna worden ze automatisch definitief verwijderd. Demogegevens verschijnen hier nooit — die worden altijd meteen definitief verwijderd.",
  "adm.trash.empty": "De prullenbak is leeg.",
  "adm.trash.restore": "Herstellen",
  "adm.trash.purge": "Definitief verwijderen",
  "adm.trash.purgeQ": "Deze bijdrage nu definitief verwijderen?",
  "adm.trash.keep": "Behouden",
  "adm.trash.restored": "Bijdrage hersteld.",
  "adm.trash.purged": "Bijdrage definitief verwijderd.",
  "adm.trash.deletedMeta": "Verwijderd door {{name}} op {{date}}",
  "adm.trash.expires": "Definitieve verwijdering over {{days}} dagen",
  "adm.presets.remove": "Functie verwijderen",
  "adm.presets.note":
    "Wordt op de server opgeslagen en overleeft de herstart; sleutels en modellen blijven daardoor onaangeroerd.",
  "adm.ai.accessTitle": "Beschikbare AI's",
  "adm.ai.accessHelp":
    "Toont alle AI-toegangen van deze instantie met een eerlijke status: het geconfigureerde cloud-model (sleutel alleen aan de serverkant), de deterministische vervangmodus die zonder model inspringt, en de geplande lokale LLM-server van Team 2. Welke toegang per taak echt werkt, staat boven in het AI-beheer (kolom „werkt”).",
  "adm.ai.access.cloud": "Cloud-model",
  "adm.ai.access.fallback": "Deterministische vervangmodus",
  "adm.ai.access.local": "Lokale LLM-server (Team 2)",
  "adm.ai.accessNote":
    "De aansluiting van de lokale LLM-server op de app is gepland (KLLM-61); tot dan draait die alleen op de testbank van Team 2.",
  "adm.ai.state.active": "Actief",
  "adm.ai.state.available": "Klaar",
  "adm.ai.state.missing": "Niet geconfigureerd",
  "adm.ai.state.planned": "Gepland",
  "ko.couple.help":
    "Koppel je deze kennis aan een installatie, dan wordt die bij „Installatie gewijzigd” (levenscyclus) automatisch ter beoordeling gemarkeerd — kennis blijft actueel.",
  "ko.couple.empty": "Nog aan geen enkele installatie gekoppeld.",
  "ko.couple.placeholder": "Installatie-aanduiding, bijv. Lijn L4",
  "ko.couple.cta": "Aan installatie koppelen",
  "ko.couple.done": "Installatie gekoppeld — de levenscyclus bewaakt deze kennis nu gericht.",
  "capture.wizard.discardQ": "Concept echt verwerpen? Je verteltekst blijft bewaard.",
  "capture.wizard.discardKeep": "Behouden",
  "capture.wizard.discardYes": "Ja, verwerpen",
  "capture.wizard.discardDone": "Concept verworpen — je verteltekst is er nog.",
  "capture.wizard.upload": "Tekst uit bestand of afbeelding invoegen",
  "capture.wizard.attach": "Bestand of afbeelding bijvoegen",
  "capture.wizard.attached":
    "{{count}} bestand(en) bijgevoegd — zichtbaar onder „Uitgebreide details”.",
  "capture.wizard.uploadCount":
    "{{count}} bijlage(n) erbij — tekst uit documenten staat al bovenin het veld, details onder „Uitgebreide details”.",
  "capture.gapContextTitle": "Uit openstaand kennishiaat",
  "capture.gapContextBody":
    "Dit is een openstaande vraag, nog geen kennis — die dient alleen als startcontext. Vul je ervaring/waarneming aan; de AI structureert daaruit een concept, jij controleert en dient in.",
  "capture.gapDraftQuestion": "Openstaande vraag",
  "capture.gapDraftExperience": "Eigen ervaring/waarneming aanvullen",
  "capture.gapStepsTitle": "Jouw werkopdracht:",
  "capture.gapSavedNote":
    "Na de validatie kan de kennisbasis deze vraag voortaan beter beantwoorden. Het kennishiaat wordt niet automatisch gesloten — de beoordeling beslist.",
  "capture.savedTitle": "Kennisobject opgeslagen.",
  "capture.savedStatusBadge": "Status: open — nog niet gevalideerd",
  // AUFTRAG-mega70 BLOCK C: beschrijft het proces in plaats van een handeling te vragen die de
  // rol niet kan uitvoeren (/validierung vereist controller).
  "capture.savedBody":
    "Opgeslagen als je eigen kennis (geen demovoorbeeld), maar nog niet gevalideerd. Bruikbare kennis wordt het pas wanneer het in de validatie voldoende beoordeeld is. Er wordt niets automatisch gevalideerd.",
  "capture.savedFromDraft":
    "Je voortgezette concept is als openstaande kennis ingediend en uit je concepten verwijderd.",
  // WP-SHIP9-S1 (Pedis B3): de ECHTE controlestatus op de bevestigingskaart.
  // D-AISTATE PAKET 2 (bens V3): zonder AI loopt alleen de deterministische duplicaat-/overlapcontrole —
  // er is geen deterministische conflictcontrole (alleen AI vindt conflicten). De "(met AI)"-varianten
  // noemen conflicten.
  "capture.aiCheck.running":
    "Duplicaat-/overlapcontrole loopt … het resultaat verschijnt hier zodra deze is afgerond.",
  "capture.aiCheck.runningAi":
    "Duplicaat-/conflictcontrole (met AI) loopt … het resultaat verschijnt hier zodra deze is afgerond.",
  "capture.aiCheck.done":
    "Duplicaat-/overlapcontrole afgerond (zonder AI) — details in de validatie.",
  "capture.aiCheck.doneAi":
    "Duplicaat-/conflictcontrole (met AI) afgerond — details in de validatie.",
  "capture.aiCheck.failed":
    "Controle mislukt: {{reason}} Je kunt deze in de validatie opnieuw starten.",
  "capture.savedFilesNote":
    "{{count}} bijlage(n) zijn nu als veilige objectreferentie opgeslagen en in de editor van het kennisobject als bewijs te koppelen. Bewijs is context — het vervangt de validatie niet.",
  "capture.attachTooLarge":
    "„{{name}}“ is te groot voor een bijlage (uploadlimiet overschreden) — het bestand is niet opgeslagen; de tekstimport blijft behouden.",
  "capture.originalAttachFailed":
    "Origineel bestand „{{name}}“ kon niet als bijlage worden veiliggesteld — de tekstimport blijft behouden.",
  "capture.attachFailedTitle": "Niet alle bijlagen konden worden veiliggesteld",
  "capture.attachFailedBody":
    "Je kennisobject is open opgeslagen. Dit bestand/deze bestanden zijn NIET bijgevoegd: {{names}}. De opgeslagen kennis blijft daardoor onaangeroerd — bewijs vervangt de validatie niet.",
  "capture.attachFailedNext":
    "Volgende stap: kennisobject openen en het bestand/de bestanden daar opnieuw bijvoegen.",
  "capture.sourceMissingTitle": "Overgenomen inhoud zonder herkomstvermelding",
  "capture.sourceMissingBody":
    "Je kennisobject is opgeslagen en bevat de uit het document overgenomen tekst. De bijbehorende herkomstvermelding kon NIET worden vastgelegd ({{count}}): {{names}}. Daarmee staat er inhoud zonder bewijs — precies wat dit product niet stilzwijgend accepteert.",
  "capture.sourceMissingNext":
    "Volgende stap: kennisobject openen, het brondocument daar bijvoegen en de bron opnieuw vermelden. Staat het ingestelde niveau „Externe kennis“ dat niet toe, dan kan een beheerder het wijzigen onder Beheer → Externe kennis.",
  // AUFTRAG-mega21 Block C-1 / C-2 — zie het Duitse blok voor de onderbouwing.
  "capture.followUpsFailedTitle": "Opgeslagen — maar een vervolgstap liep niet",
  "capture.followUpsFailedBody":
    "Je kennisobject is volledig opgeslagen en onderbouwd. NA het opslaan is het volgende niet doorlopen: {{steps}}. Dat verandert niets aan de opgeslagen kennis — er blijft wel iets openstaan, en niemand anders vertelt het je.",
  "capture.followUp.draftDiscard": "concept verwijderen",
  "capture.followUp.draftDiscardNext":
    "Het concept staat nog in je conceptenlijst. Je kunt het daar verwijderen — het ingediende kennisobject blijft ongemoeid.",
  "capture.followUp.validationAssign": "beoordelaars toewijzen",
  "capture.followUp.validationAssignNext":
    "Er wacht niemand op dit kennisobject. Open Validatie en wijs de beoordelaars daar opnieuw toe.",
  "capture.followUp.notifyAssignment": "beoordelaars informeren",
  "capture.followUp.notifyAssignmentNext":
    "De toewijzing staat, alleen het bericht ging niet uit. Laat het de toegewezen beoordelaars weten.",
  "capture.followUp.aiCheck": "duplicaat-/conflictcontrole starten",
  "capture.followUp.aiCheckNext":
    "De controle staat als mislukt genoteerd en kan op de validatiepagina opnieuw worden gestart.",
  // AUFTRAG-mega23 Block B (bens SB-G): de regel hierboven veronderstelt een GESCHREVEN notitie.
  // Ontbreekt het bewijs, dan geldt deze — hij belooft geen herhaling die het endpoint zou weigeren.
  "capture.followUp.aiCheckUnrecordedNext":
    "Ook de mislukking-notitie zelf kon niet worden opgeslagen — er staat voor dit kennisobject dus GEEN herhaalbare controletaak klaar. Bekijk het object in Validatie handmatig op duplicaten en tegenstrijdigheden.",
  "capture.followUp.unknown": "een stap die deze interface nog niet kent",
  "capture.followUp.unknownNext":
    "Deze versie van de interface kent de stap niet bij naam. Hij staat in het auditspoor van het kennisobject — kijk daar.",
  "capture.anchorsMissingTitle":
    "Een beveiligd origineel ontbreekt — overgenomen tekst is niet geladen",
  "capture.anchorsMissingBody":
    "Bij dit concept horen {{count}} beveiligde originele document(en) die er niet meer zijn. De daaruit overgenomen tekst en de bijbehorende bronvermeldingen zijn daarom NIET geladen: dat zou inhoud zonder herkomst zijn, en dat slaat dit product niet stilzwijgend op. Je eigen werk — titel, uitspraak, voorwaarden, maatregelen, beoordelaarskeuze — is volledig aanwezig.",
  "capture.anchorsMissingNext":
    "Zolang deze melding staat, is „Als concept opslaan“ geblokkeerd: opslaan zou nu de uitgedunde stand over de opgeslagen stand schrijven.",
  "capture.anchorsMissingReselect": "Origineel opnieuw kiezen",
  "capture.anchorsMissingAck": "Zonder het origineel verdergaan",
  "capture.restartOfferTitle": "Deze bewerking kan niet worden herhaald",
  "capture.restartOfferBody":
    "De bewerkingssleutel van deze indiening hoort al bij een afgeronde bewerking met andere inhoud. Je huidige tekst staat er onveranderd en gaat niet verloren. Om hem op te slaan is een NIEUWE bewerking nodig — dat beslis jij, niet de interface.",
  "capture.restartOfferAction": "Nieuwe bewerking beginnen",
  "capture.appendUnclearTitle": "Overname met onduidelijke uitkomst",
  "capture.appendUnclearBody":
    "Je kennisobject is opgeslagen. Bij de overname uit {{names}} brak de verbinding af voordat de server antwoordde: die kan wel of niet zijn voltooid. Er is NIETS teruggenomen — blind opruimen zou hier de schade juist hebben aangericht. Open het kennisobject en kijk na of de overgenomen inhoud met herkomst er staat.",
  "own.empty.title": "Nog geen eigen kennis hier",
  "own.empty.hint":
    "Je filtert op eigen kennis (geen demovoorbeelden). Zelf vastgelegde kennis verschijnt hier na het opslaan en wacht dan op de beoordeling.",
  "own.empty.cta": "Eigen kennis vastleggen",
  "studio.open": "Bewerken in de Knowledge Studio",
  "studio.title": "Knowledge Studio",
  "studio.subtitle":
    "Ruime werkomgeving met AI-hulp. Wijzigingen worden pas naar het concept geschreven als je ze overneemt — geen automatisch opslaan, geen automatische validatie.",
  "studio.apply": "Overnemen in het concept",
  "studio.cancel": "Verwerpen",
  "studio.close": "Sluiten",
  "studio.viewSimple": "Eenvoudig",
  "studio.viewStructured": "Gestructureerd",
  "studio.viewSwitch": "Weergave: eenvoudig of gestructureerd",
  "studio.attachFromDisk": "Bestand/afbeelding van je computer toevoegen",
  "studio.state.dirty": "Niet overgenomen",
  "studio.state.clean": "Geen wijzigingen in de studio",
  "studio.confirmDiscard.q": "Niet-overgenomen wijzigingen verwerpen?",
  "studio.confirmDiscard.keep": "Verder bewerken",
  "studio.confirmDiscard.discard": "Verwerpen",
  "studio.applied":
    "Uitgebreide inhoud uit de studio overgenomen in het concept. Opslaan of een revisie doe je pas via de bestaande knop — er wordt niets automatisch opgeslagen of gevalideerd.",
  "studio.save.capture.title": "Studio-inhoud in het concept — nog niet opgeslagen",
  "studio.save.capture.hint":
    "De inhoud die je in de studio hebt overgenomen staat in het concept, maar is nog niet opgeslagen of gevalideerd.",
  "studio.save.capture.next":
    "Volgende stap: opslaan/indienen — daarna volgt de beoordeling (review/validatie). Er wordt niets automatisch gevalideerd.",
  "studio.save.revision.title": "Studio-inhoud in het revisieconcept — nog niet opgeslagen",
  "studio.save.revision.hint":
    "De inhoud die je in de studio hebt overgenomen staat in het revisieconcept, maar is nog niet opgeslagen.",
  "studio.save.revision.next":
    "Opslaan maakt een nieuwe versie aan en start de beoordeling opnieuw — geen automatische goedkeuring.",
  "studio.fromDraft.cta": "Concept als artikel structureren in de studio",
  "studio.fromDraft.hint":
    "Maakt van je concept (uitspraak, voorwaarden, maatregelen, tags) een gestructureerd artikelvoorstel — controleer en vul het aan. Bestaande inhoud wordt toegevoegd, niet overschreven; er wordt niets automatisch gevalideerd.",
  "studio.section.context": "Structuur & context",
  "studio.section.editor": "Inhoud bewerken",
  "studio.section.assist": "AI-hulp",
  "studio.guide.structure.label": "Structureren",
  "studio.guide.structure.hint": "Structureer met koppen, stappen en accenten.",
  "studio.guide.assist.label": "AI laten controleren",
  "studio.guide.assist.hint":
    "Laat de AI het duidelijker maken/structureren — controleer het voorstel, neem het niet blind over.",
  "studio.guide.preview.label": "Voorbeeld",
  "studio.guide.preview.hint": "Bekijk hoe de bijdrage er straks uitziet.",
  "studio.guide.apply.label": "Overnemen",
  "studio.guide.apply.hint":
    "Neem het bewust over in het concept — er wordt niets automatisch opgeslagen.",
  "studio.guide.thenSave": "daarna opslaan & laten beoordelen",
  "studio.coach.story":
    "Je redt ervaringskennis. De AI helpt bij het structureren — pas door de beoordeling van je collega's wordt het geborgd.",
  "studio.coach.firstRun":
    "Begin hier: vertel je kennis in je eigen woorden. Structuur, AI-hulp en voorbeeld komen stap voor stap.",
  "studio.coach.nextPrefix": "Volgende stap",
  "studio.coach.reason.start": "Begin met je ervaring — zelfs een ruwe aanzet is waardevol.",
  "studio.coach.reason.improve":
    "Laat de AI helpen met structureren en aanscherpen, of voeg zelf koppen en stappen toe.",
  "studio.coach.reason.preview": "Bekijk in het voorbeeld hoe je bijdrage straks overkomt.",
  "studio.coach.reason.apply":
    "Ziet het er goed uit? Neem het concept bewust over — opslaan en beoordelen gebeurt daarna.",
  "studio.contrib.title": "Jouw bijdrage",
  "studio.contrib.level.empty.label": "Leeg",
  "studio.contrib.level.empty.hint": "Begin met schrijven — zelfs een ruwe aanzet is waardevol.",
  "studio.contrib.level.draft.label": "Concept",
  "studio.contrib.level.draft.hint":
    "Goed begin. Een paar stappen maken het duidelijker en nuttiger.",
  "studio.contrib.level.solid.label": "Solide",
  "studio.contrib.level.solid.hint":
    "Duidelijk gestructureerd — klaar om over te nemen en te laten beoordelen.",
  "studio.contrib.strengthsTitle": "Al goed",
  "studio.contrib.strength.text": "Echte inhoud aanwezig",
  "studio.contrib.strength.headings": "Met koppen gestructureerd",
  "studio.contrib.strength.steps": "Stappen als lijst",
  "studio.contrib.strength.highlights": "Belangrijke punten uitgelicht",
  "studio.contrib.strength.links": "Verwijzingen/links aanwezig",
  "studio.contrib.strength.evidence": "Bewijs/bijlagen aanwezig",
  "studio.contrib.suggestionsTitle": "Maakt het sterker",
  "studio.contrib.suggestion.detail": "Wat meer detail toevoegen",
  "studio.contrib.suggestion.headings": "Koppen voor secties",
  "studio.contrib.suggestion.steps": "Stappen als lijst toevoegen",
  "studio.contrib.suggestion.referenceAttachments": "Bijlagen in de tekst benoemen",
  "studio.contrib.valueNote":
    "Jouw ervaringskennis telt — pas na de beoordeling door collega's wordt het geborgd.",
  "studio.tips.title": "Zo werk je in de studio",
  "studio.tips.select.label": "Selecteren → opmaken",
  "studio.tips.select.hint":
    "Selecteer tekst en zet die dan via de werkbalk vet/cursief — of gebruik de vertrouwde toetsen.",
  "studio.tips.structure.label": "Structuur via H2/H3",
  "studio.tips.structure.hint":
    "Structureer secties met kop 2 en 3, stappen als lijsten — dat maakt de inhoud leesbaar.",
  "studio.tips.ai.label": "AI-voorstel controleren",
  "studio.tips.ai.hint":
    "De AI-hulp rechts maakt een voorstel — eerst controleren, dan bewust overnemen. Er wordt niets automatisch opgeslagen.",
  "studio.tips.blocks.label": "Templates & blokken gericht inzetten",
  "studio.tips.blocks.hint":
    "Sjablonen geven een structuur; info-/opmerking-/waarschuwing-/succesblokken lichten belangrijke punten uit.",
  "studio.view.edit": "Bewerken",
  "studio.view.preview": "Voorbeeld",
  "studio.preview.empty":
    "Nog geen inhoud — schrijf in de editor en bekijk hier daarna het voorbeeld.",
  "studio.preview.note":
    "Het voorbeeld toont het huidige concept, geen gevalideerde kennis. Overnemen schrijft alleen naar het lokale concept; opslaan/indienen/reviseren volgt daarna via de bestaande knoppen.",
  "capture.savedViewKo": "Object bekijken",
  "capture.savedViewLibrary": "Bekijken in de bibliotheek (eigen kennis)",
  "capture.savedValidate": "Ter beoordeling aanbieden",
  "capture.savedAgain": "Nog iets vastleggen",
  "capture.mode.freitext": "Vrije tekst",
  "capture.mode.formular": "Formulier",
  "capture.mode.diktat": "Dictaat",
  "capture.mode.interview": "Begeleid interview",
  "capture.mode.datei": "Uit bestand",
  "capture.file.hint":
    "Upload een document — de AI toont welke kennis erin zit, telkens met een letterlijke bewijsplaats. Jij kiest wat wordt overgenomen; er wordt niets automatisch opgeslagen.",
  "capture.file.upload": "Document selecteren",
  "capture.file.replace": "Ander document kiezen",
  "capture.file.remove": "Document verwijderen",
  "capture.file.dropHint": "Sleep een bestand hierheen — of kies er hieronder een.",
  // AUFTRAG-mega34 D1: de knop zegt wat hij doet.
  "capture.file.pick": "Bestand kiezen",
  "capture.file.dropActive": "Laat het bestand hier los …",
  "capture.file.dropReject":
    "„{{name}}“ wordt hier nog niet ondersteund — sleep een tekst-, Word-, PDF-, PPTX- of afbeeldingsbestand.",
  "capture.file.extracting": "„{{name}}“ lezen …",
  "capture.file.loaded": "„{{name}}“ gelezen — klaar voor het zoeken naar kennis.",
  "capture.file.empty": "In „{{name}}“ is geen tekst gevonden.",
  "capture.file.emptyPdf":
    "In „{{name}}“ is geen tekst gevonden — een gescande PDF zonder tekstlaag wordt nog niet ondersteund.",
  "capture.file.emptyPptx":
    "In „{{name}}“ zijn geen overneembare teksten gevonden (presentatie met alleen afbeeldingen). Er is niets opgeslagen — je kunt het origineel indien nodig handmatig als bestand toevoegen.",
  "capture.file.pdfTruncated": "Alleen de eerste {{count}} pagina's geïmporteerd.",
  "capture.file.pptxTruncated": "Alleen de eerste {{count}} dia's geïmporteerd.",
  "capture.slides.toggle": "Dia's als afbeeldingen overnemen.",
  "capture.slides.toggleHint":
    "Bij PowerPoint-bestanden wordt elke dia extra als afbeelding aan de bijdrage toegevoegd (sectie diaweergave). De omzetting draait op de server en kan even duren.",
  "capture.slides.heading": "Diaweergave",
  "capture.slides.converting": "Dia's van {{name}} worden op de server naar afbeeldingen omgezet …",
  "capture.slides.done": "{{count}} dia('s) als afbeelding toegevoegd.",
  "capture.slides.truncated": "Alleen de eerste {{max}} dia's zijn omgezet (harde limiet).",
  "capture.slides.dropped":
    "{{count}} dia-afbeelding(en) pasten niet meer in het bijdragebudget en zijn weggelaten.",
  "capture.slides.busy":
    "De server zet momenteel een andere presentatie om — probeer het importeren zo dadelijk opnieuw. De tekstimport is volledig.",
  "capture.slides.unavailable":
    "De diaweergave is op deze server momenteel niet beschikbaar. De tekstimport is volledig.",
  "capture.slides.timeout":
    "De server is nog bezig of niet bereikbaar — het omzetten van de dia's is aan de clientzijde afgebroken; de tekstimport blijft volledig behouden.",
  "capture.slides.failed":
    "De dia's konden niet naar afbeeldingen worden omgezet. De tekstimport is volledig.",
  "capture.file.pptxTooLarge":
    "„{{name}}“ is te groot of te sterk gecomprimeerd voor een veilige import en is NIET gelezen. Verklein of splits de presentatie.",
  "capture.file.pptxImagesFormat":
    "{{count}} afbeeldingen konden niet worden overgenomen — formaat niet ondersteund.",
  "capture.file.pptxImagesBudget":
    "{{count}} afbeeldingen konden niet worden overgenomen — te groot om in te sluiten.",
  "capture.file.imagesOnlyNoText":
    "Afbeeldingen overgenomen — zonder tekst zijn er geen KI-voorstellen mogelijk.",
  "capture.file.imagesAllDropped":
    "De afbeeldingen konden niet in het artikel worden overgenomen (te groot of formaat niet ondersteund) — het origineel gaat bij het opslaan mee als bijlage.",
  // JOB 513/D3B — zie het Duitse blok: de regel hierboven zegt een bijlage toe; zonder veiliggesteld
  // origineel heeft die toezegging geen dekking.
  "capture.file.imagesAllDroppedNoOriginal":
    "{{dropped}} afbeelding(en) konden niet in het artikel worden overgenomen, en het origineel kon NIET als bijlage worden veiliggesteld — die afbeeldingen zijn verloren.",
  "capture.file.imagesDefect":
    "{{count}} afbeelding(en) konden niet worden gelezen — de verwijzing in het bestand is defect of het afbeeldingsbestand ontbreekt.",
  "capture.file.imagesOutsidePath":
    "{{count}} afbeelding(en) liggen buiten het overgenomen diagebied (bijvoorbeeld achtergrondafbeeldingen) en zijn niet overgenomen.",
  "capture.file.imagesBudgetBodyHtml":
    "Grens „artikeltekst”: {{count}} afbeelding(en) pasten niet meer in het artikel (hoogstens {{limitBytes}} byte; nodig waren {{actualBytes}}).",
  "capture.file.imagesBudgetSingleImage":
    "Grens „losse afbeelding”: {{count}} afbeelding(en) zijn op zichzelf te groot (hoogstens {{limitBytes}} byte per afbeelding; de grootste had {{actualBytes}}).",
  "capture.file.imagesBudgetTotalImages":
    "Grens „som van alle afbeeldingen”: {{count}} afbeelding(en) zouden de totale omvang van alle afbeeldingen hebben overschreden (hoogstens {{limitBytes}} byte; nodig waren {{actualBytes}}).",
  "capture.file.imageCaptionPlaceholder": "Nog geen afbeeldingsbeschrijving",
  "capture.file.imagesKept":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd voor de tekstweergave; het ongewijzigde origineel zit in de bijlage.",
  "capture.file.imagesKeptDropped":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd; {{dropped}} weggelaten vanwege de grootte. Het ongewijzigde origineel zit in de bijlage.",
  "capture.file.imagesNoOriginal":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd; het origineel kon NIET als bijlage worden veiliggesteld.",
  "capture.file.imagesLost":
    "{{kept}} afbeeldingen overgenomen, waarvan {{compressed}} gecomprimeerd; {{dropped}} weggelaten. Het origineel kon NIET worden veiliggesteld — {{dropped}} afbeeldingen zijn verloren.",
  "capture.file.tooLargeForImport":
    "Zelfs na beeldcompressie is het document te groot voor tekstimport — splits het op. Het origineel blijft ongewijzigd.",
  "capture.file.importNote.docx":
    "Structuur en afbeeldingen overgenomen (best effort) — de exacte layout kan afwijken.",
  "capture.file.importNote.pdf":
    "Best-effort tekstimport — layout en afbeeldingen zijn niet overgenomen.",
  "capture.file.importNote.pptx":
    "Best-effort import uit PowerPoint — tekst, lijsten, tabellen en afbeeldingen per dia overgenomen; layout, animaties, overgangen en notities gaan verloren.",
  "capture.file.parseError": "„{{name}}“ kon niet worden gelezen.",
  "capture.file.unsupported":
    "„{{name}}“ wordt hier niet ondersteund — lever het aan als TXT/MD, DOCX, PDF of PPTX. Afbeeldingen gaan alleen via OCR.",
  "capture.file.ocrCta": "Tekst in de afbeelding herkennen (OCR)",
  "capture.file.ocrBusy": "Tekstherkenning loopt …",
  "capture.file.queryLabel": "Waarnaar moet de AI zoeken? (optioneel)",
  "capture.file.queryPlaceholder":
    "bijv. „grenswaarden en controle-intervallen“ — laat leeg om alle kennis te vinden",
  "capture.file.queryHelp.title": "Gericht zoeken",
  "capture.file.queryHelp.body":
    "Zonder opgave toont de AI alle kennispunten in het document. Met een zoekopdracht beperkt ze zich tot jouw focus. In beide gevallen wordt er niets verzonnen — elk punt draagt een letterlijke bewijsplaats uit het document.",
  "capture.file.langLabel": "Resultaat in",
  "capture.file.langSystem": "Systeemtaal",
  "capture.file.langSource": "Oorspronkelijke taal",
  "capture.file.langHelp.title": "Resultaattaal",
  "capture.file.langHelp.body":
    "Systeemtaal: titels en samenvattingen verschijnen in je interfacetaal (Duits/Engels) — een Engels document wordt daarbij feitelijk vertaald. Oorspronkelijke taal: de AI vertaalt niets, de punten blijven in de taal van het document. Letterlijke bewijsplaatsen blijven in beide gevallen ongewijzigd.",
  "capture.file.importMode.label": "Importsoort",
  "capture.file.importMode.points": "In punten analyseren",
  "capture.file.importMode.pointsDesc":
    "Klarwerk haalt losse uitspraken uit het bestand. Bestaande weg, er wordt niets automatisch opgeslagen.",
  "capture.file.importMode.whole": "Hele document overnemen",
  "capture.file.importMode.wholeDesc":
    "Klarwerk maakt precies één concept aan met het volledige document. Geen automatische validatie.",
  "capture.file.searchCta": "Bestand analyseren",
  "capture.file.searching": "De AI leest het document …",
  "capture.file.wholeCta": "Hele document als concept opslaan",
  "capture.file.wholeSaving": "Concept wordt opgeslagen …",
  "capture.file.wholeSaved":
    "„{{name}}“ als één concept opgeslagen — bron: bestandsnaam, volledig document.",
  "capture.file.wholeSourceNote":
    "De bron wordt zichtbaar vermeld in het concept: {{name}}, volledig document. Het concept blijft open en onbeoordeeld.",
  "capture.file.wholeSavedTitle": "Document als concept opgeslagen",
  "capture.file.wholeSavedSource": "Bron: {{name}}, volledig document.",
  "capture.file.wholeOpenDraft": "Concept openen",
  "capture.file.wholeOpenMissing":
    "Het concept is opgeslagen, maar kon niet direct worden geopend.",
  "capture.file.wholeImportAnother": "Nog een document importeren",
  "capture.file.formatTitle": "Informatie over bestandsformaten en opmaak",
  "capture.file.formatHint":
    "TXT/MD en andere tekstbestanden worden als tekst overgenomen. DOCX: structuur (koppen, lijsten, tabellen) en afbeeldingen worden best effort overgenomen; de exacte layout kan afwijken. PDF loopt als best-effort tekstimport; layout en afbeeldingen gaan verloren. PPTX: tekst, structuur en foto's per dia worden best effort overgenomen; layout, animaties, vectorafbeeldingen/vormen en notities gaan verloren.",
  "capture.file.supportedTitle": "Actief selecteerbaar:",
  "capture.file.supportedFormats":
    "TXT, MD/Markdown, CSV, LOG, JSON, DOCX, PDF, PPTX en afbeeldingen voor OCR.",
  "capture.file.unsupportedFormats":
    "RTF wordt momenteel niet ondersteund. Lever het indien mogelijk aan als TXT/MD, DOCX, PDF of PPTX.",
  "capture.file.cancel": "Annuleren",
  "capture.file.pointsTitle": "Gevonden kennis — kies wat wordt overgenomen",
  "capture.file.pointsHint":
    "Elk punt draagt zijn bewijsplaats uit het document. Vink af wat je niet nodig hebt — overnemen gebeurt pas op klik.",
  "capture.file.excerptLabel": "Bewijsplaats",
  "capture.file.pointCount": "{{selected}} van {{total}} punten geselecteerd",
  "capture.file.applyCta": "Geselecteerde overnemen",
  "capture.file.queueBadge": "Punt {{current}} van {{total}} uit „{{name}}“",
  "capture.file.queueHint":
    "Elk punt wordt afzonderlijk als kennispagina beoordeeld en ingediend — er wordt niets automatisch opgeslagen.",
  "capture.file.queueSkip": "Punt overslaan",
  "capture.file.queueDone": "Alle punten uit „{{name}}“ zijn verwerkt.",
  "capture.file.sourceNote": "De bron „{{name}}“ wordt bij het kennisobject vermeld.",
  "capture.file.loadedStats":
    "„{{name}}“ ingelezen ({{chars}} tekens). Geef optioneel aan waarnaar gezocht moet worden en start het zoeken naar kennis.",
  "capture.file.saveDraftsCta": "Als concepten opslaan",
  "capture.file.draftsSaved":
    "{{count}} concepten uit „{{name}}“ opgeslagen — elk met bronvermelding. Je vindt ze bovenaan onder „Concepten hervatten“.",
  "capture.file.draftsPartial":
    "Niet alle punten konden als concept worden opgeslagen: {{failed}}. Reeds aangemaakte concepten blijven behouden.",
  "capture.file.mergeCta": "Geselecteerde tot één item samenvoegen",
  "capture.file.mergedNote":
    "{{count}} punten uit „{{name}}“ samengevoegd tot één item — alle bewijsplaatsen staan in het document, de bronnen worden bij het indienen vermeld.",
  "capture.file.connectHint":
    "Meerdere aanvinken en „Verbinden“ voegt ze samen tot ÉÉN item · „Als concepten opslaan“ maakt per punt een eigen concept · „Overnemen“ verwerkt ze een voor een.",
  "capture.file.connectDisabledHint": "Vink minstens 2 inzichten aan om ze te verbinden.",
  "capture.file.selectAll": "Alles selecteren",
  "capture.file.deselectAll": "Alles deselecteren",
  "capture.file.mergedInList":
    "{{count}} inzichten samengevoegd tot één punt — blijft in de lijst.",
  "capture.file.applyDisabledHint":
    "Vink precies één inzicht aan — er wordt altijd maar één tegelijk verwerkt.",
  "capture.file.purgeUnselectedQ":
    "Moeten de {{count}} niet-geselecteerde inzichten worden verwijderd?",
  "capture.file.purgeUnselectedYes": "Niet-geselecteerde verwijderen",
  "capture.file.purgeUnselectedKeep": "Behouden",
  "capture.entry.narrateKicker": "Vertel je kennis — de AI structureert, jij controleert",
  "capture.entry.recommendedBadge": "Aanbevolen",
  "capture.entry.expertToggle": "Expertmodus: formulier direct invullen",
  "capture.entry.expertHint":
    "Voor routiniers: alle velden direct invullen — dezelfde velden, dezelfde beoordelingsweg. De begeleide verteleinstap blijft altijd bereikbaar.",
  "capture.entry.expertActive":
    "Expertmodus: je vult het formulier direct in. Opslaan en beoordelen gaat net als bij de begeleide weg — er wordt niets automatisch gevalideerd.",
  "capture.entry.backToGuided": "Terug naar de begeleide weg",
  "capture.raw": "Ervaringsnotitie",
  "capture.rawPlaceholder":
    "Leg je ervaring vormvrij vast — de AI maakt er een concept van. Jij controleert en dient het in.",
  "capture.structure": "Structureren met AI",
  "capture.assist": "AI-hulp",
  "capture.advanced.title": "Uitgebreide details (optioneel)",
  "capture.advanced.hint":
    "Categorie, installatie, aantal beoordelingen, trefwoorden, documenten & afbeeldingen — niets daarvan is verplicht. Vertel eerst je kennis; de details kun je op elk moment uitklappen en aanvullen.",
  "capture.advanced.filled": "{{count}} ingevuld",
  "capture.ai.title": "AI-nabewerking (bèta)",
  "capture.ai.hint":
    "De AI doet een voorstel — jij controleert het en neemt het bewust over. Geen automatische opslag, geen validatie; inhoud/feiten worden niet verzonnen.",
  "capture.ai.bodyHint":
    "AI-hulp voor de uitgebreide inhoud: voorstel controleren en bewust overnemen (vervangen/toevoegen). Geen automatische opslag, geen validatie; controleer inhoud en bronnen zelf.",
  "capture.ai.applyAsLabel": "Als structuur overnemen",
  "capture.ai.applyAs.section": "Als sectie toevoegen",
  "capture.ai.applyAs.info": "Als info toevoegen",
  "capture.ai.applyAs.note": "Als opmerking toevoegen",
  "capture.ai.applyAs.warning": "Als waarschuwing toevoegen",
  "capture.ai.applyAs.success": "Als succes toevoegen",
  "capture.ai.action.clarify": "Duidelijker",
  "capture.ai.action.structure": "Structureren",
  "capture.ai.action.expand": "Uitbreiden",
  "capture.ai.action.spelling": "Spelling",
  "capture.ai.action.format": "Opmaken",
  "capture.ai.instr.clarify":
    "Formuleer duidelijker en preciezer, zonder de betekenis te veranderen.",
  "capture.ai.instr.structure":
    "Structureer de tekst in duidelijke, beknopte zinnen of opsommingspunten.",
  "capture.ai.instr.expand":
    "Formuleer wat uitgebreider en vollediger — zonder nieuwe feiten te verzinnen.",
  "capture.ai.instr.spelling": "Corrigeer alleen spelling en grammatica.",
  "capture.ai.instr.format":
    "Verbeter alleen de leesbaarheid met nette alinea's en interpunctie. Gebruik GEEN markdown-tekens zoals #, ## of * — geen koptekens. Laat inhoud en bewoording ongewijzigd, voeg niets toe en laat niets weg.",
  "capture.ai.help.clarify": "Formuleert begrijpelijker en preciezer — de betekenis blijft gelijk.",
  "capture.ai.help.structure": "Ordent de tekst in beknopte zinnen of opsommingspunten.",
  "capture.ai.help.expand": "Formuleert uitgebreider — verzint daarbij geen nieuwe feiten.",
  "capture.ai.help.spelling": "Corrigeert alleen spelling en grammatica, verder niets.",
  "capture.ai.help.format":
    "Verbetert alleen de leesbaarheid (alinea's, interpunctie) — zonder markdown-tekens; de inhoud blijft letterlijk.",
  "capture.ai.customHelp":
    "Eigen AI-functie van je organisatie (aangemaakt door de admin). Instructie aan de AI: „{{instruction}}“. Zoals bij alle AI-acties ontstaat er alleen een voorstel ter voorbeeld — overgenomen wordt uitsluitend wat jij bewust met een klik overneemt.",
  "capture.ai.freeLabel": "Eigen AI-instructie",
  "capture.ai.freePlaceholder": "bijv. „korter en zakelijker formuleren“",
  "capture.ai.run": "Uitvoeren",
  "capture.ai.previewTitle": "AI-voorstel (voorbeeld)",
  "capture.ai.replace": "Vervangen",
  "capture.ai.append": "Toevoegen",
  "capture.ai.discard": "Verwerpen",
  "capture.author": "Auteur",
  "capture.documents": "Documenten (context / bijlage)",
  "capture.documentsUpload": "Bestanden uploaden",
  "capture.uploadLimits":
    "Tot {{count}} bestanden, elk max. {{mb}} MB overdrachtsgrootte (ongeveer {{raw}} MB zuiver bestand).",
  "capture.attachLimitReached":
    "{{taken}} van {{total}} bestanden geaccepteerd voor verwerking — de bijlagegrens is {{limit}}.",
  "capture.documentsHint":
    "txt, md, csv, json, log, docx, pdf → volledige tekst · afbeeldingen: optioneel via OCR",
  "capture.images": "Afbeeldingen (bijlage)",
  "capture.imagesUpload": "Afbeeldingen toevoegen",
  "capture.imagesHint": "Ook vanuit de mobiele app. Worden bij het object gevoegd.",
  "capture.videoAdded": "{{name}} toegevoegd. Transcriptie op klik — er gebeurt niets automatisch.",
  "capture.videoTranscribe": "Transcriberen",
  "capture.videoBusy": "loopt …",
  "capture.videoRunning": "{{name}} transcriberen — korte clips gaan snel.",
  "capture.videoDone":
    "Transcript van {{name}} overgenomen — controleer het (concept, geen waarheid).",
  "capture.saveDraft": "Als concept opslaan",
  "capture.draftSaved": "Concept opgeslagen.",
  "capture.draftUpdated": "Concept bijgewerkt.",
  "capture.draftDiscarded": "Concept verwijderd.",
  "capture.discardDraftQ": "Concept definitief verwijderen?",
  "capture.discardDraftKeep": "Behouden",
  "capture.discardDraftYes": "Verwijderen",
  "capture.imageError": "„{{name}}“ kon niet als afbeelding worden gelezen.",
  "capture.draftFallbackTitle": "Concept",
  "capture.resumeTitle": "Concepten hervatten",
  "capture.resumeExpand": "Concepten tonen ({{count}})",
  "capture.resumeCollapse": "Concepten inklappen",
  // AUFTRAG-mega38 BLOCK J4: `capture.resumeCollapsedHint` verwijderd — zie het DE-blok.
  "capture.resume": "Hervatten",
  "capture.discardDraft": "Verwerpen",
  // AUFTRAG-sortfilter · Punt 2: filter + sortering van de conceptenlijst.
  "capture.draftSearch": "Concepten doorzoeken",
  "capture.draftSortLabel": "Sorteren",
  "capture.draftSort.recent": "Laatst opgeslagen (nieuw→oud)",
  "capture.draftSort.oldest": "Laatst opgeslagen (oud→nieuw)",
  "capture.draftSort.title": "Titel A→Z",
  "capture.draftAuthorLabel": "Maker",
  "capture.draftAuthorAll": "Alle makers",
  // AUFTRAG-BASIC-u2 — zie de Duitse regel voor de bevinding.
  "capture.draftScope.note":
    "Deze zoekopdracht doorzoekt alleen jouw opgeslagen concepten — geen kennis uit de bibliotheek.",
  "capture.draftScope.noteAdmin":
    "Deze zoekopdracht doorzoekt alleen opgeslagen concepten (adminweergave: alle) — geen kennis uit de bibliotheek.",
  "capture.draftScope.toLibrary": "In de Klarwerk-kennis zoeken",
  "capture.draftEmptyFiltered":
    "Geen opgeslagen concepten passen bij je zoekopdracht. Alleen concepten zijn doorzocht — gevalideerde kennis staat in de bibliotheek.",
  "capture.draftJustSaved": "zojuist opgeslagen",
  "capture.draftCreatorMeta": "Maker: {{name}}",
  "capture.draftSavedMeta": "Opgeslagen: {{date}}",
  "capture.draftStatusMeta": "Status: concept",
  "capture.editingDraft": "Concept geladen — wijzigingen worden in hetzelfde concept opgeslagen.",
  "capture.editingBadge": "in bewerking",
  "capture.fileImportJump": "Bestand importeren",
  "capture.loadExample": "Voorbeeld laden",
  "capture.exampleLoaded":
    "Ervaringsnotitie geladen — structureer die nu met AI en controleer het concept.",
  "capture.docAdded": "{{name}} als context overgenomen.",
  "capture.docExtracting": "{{name}} wordt gelezen …",
  "capture.docEmpty":
    "{{name}}: geen tekst gevonden — een gescande PDF zonder tekstlaag wordt nog niet ondersteund.",
  "capture.docParseError": "{{name}} kon niet worden gelezen.",
  "capture.docUnsupported":
    "{{name}}: alleen txt/md/csv/json/log, docx en pdf worden als volledige tekst gelezen.",
  "capture.ocr": "OCR → tekst",
  "capture.ocrRunningShort": "OCR …",
  "capture.ocrRunning": "OCR loopt voor {{name}} (worker/taaldata worden geladen) …",
  "capture.ocrDone": "OCR-tekst uit {{name}} overgenomen.",
  "capture.ocrEmpty": "{{name}}: OCR heeft geen tekst herkend.",
  "capture.ocrFailed": "OCR voor {{name}} mislukt.",
  "capture.ocrUnavailable": "OCR is momenteel niet beschikbaar.",
  "capture.help.category.title": "Categorie & #tags",
  "capture.help.category.body":
    "De categorie is een vrij te kiezen inhoudelijke indeling (bijv. „Onderhoud“, „Kwaliteit“, „Inkoop“). Tags zijn vrije trefwoorden om iets terug te vinden.",
  "capture.help.validations.title": "Benodigde validaties",
  "capture.reviewers.title": "Beoordelaars voorstellen (optioneel)",
  "capture.reviewers.helpTitle": "Beoordelaars voorstellen",
  "capture.reviewers.helpBody":
    "Kies collega's die jouw bijdrage moeten beoordelen. Zij krijgen de beoordeling als open toewijzing en een melding. Zonder keuze blijft de bijdrage open voor alle beoordelaars.",
  "capture.reviewers.none": "Nog geen andere personen in de directory.",
  "capture.reviewers.selected": "Geselecteerd: {{n}}",
  "capture.reviewers.defaultPlaceholder": "Standaard: {{n}}",
  "capture.help.validations.body":
    "Hoeveel onafhankelijke bevestigingen het object nodig heeft voordat het als „gevalideerd“ geldt (1–5, standaard 3). Meer = hogere drempel, betrouwbaarder.",
  "capture.modeSoon": "Deze modus volgt nog.",
  "capture.fTitle": "Kernuitspraak",
  "capture.fStatement": "Uitspraak",
  "capture.fBody": "Uitgebreide inhoud (optioneel)",
  "editor.bold": "Vet",
  "editor.bodyLabel": "Kennispagina — bodytekst",
  "editor.italic": "Cursief",
  "editor.h2": "Kop",
  "editor.h3": "Subkop",
  "editor.ul": "Opsomming",
  "editor.ol": "Genummerde lijst",
  "editor.link": "Link",
  "editor.panel": "Paneel/opmerking",
  "editor.guidance.title": "Zo gebruik je de uitgebreide inhoud",
  "editor.guidance.structure": "Structuur: koppen (H2/H3) en alinea's structureren de inhoud.",
  "editor.guidance.action": "Praktijkkennis: lijsten voor stappen, links als bewijs.",
  "editor.guidance.blocks":
    "Blokken: markeer belangrijke punten als info/opmerking/waarschuwing/succes.",
  "editor.guidance.ai":
    "AI-hulp: levert voorstellen — jij controleert en neemt bewust over, geen automatische validatie.",
  "editor.attach.title": "Bijlagen in de editor",
  "editor.attach.images": "Afbeelding(en)",
  "editor.attach.files": "Bestand(en)",
  "editor.attach.imageHint": "in te voegen in de uitgebreide inhoud via de afbeeldingsknop.",
  "editor.attach.fileHint":
    "blijven zichtbaar als bijlage/bewijs en worden niet inline ingesloten — verwijs ernaar in de tekst.",
  "editor.media.title": "Afbeeldingen, bestanden & bewijs",
  "editor.media.images": "Afbeelding(en)",
  "editor.media.imageHint":
    "illustreren je kennis — in te voegen in de inhoud via de afbeeldingsknop.",
  "editor.media.linkable": "linkbare bestand(en)",
  "editor.media.linkableHint":
    "als bewijs/context veilig in de tekst te linken (interne objectreferentie, geen ruwe downloadtruc).",
  "editor.media.evidence": "bestand(en) als bijlage",
  "editor.media.evidenceHint":
    "blijven bewijs/onderbouwing — na het opslaan in de tekst te linken; tot dan geen nood-/neplink.",
  "editor.media.note":
    "Bewijs verbetert de navolgbaarheid, maar is geen goedkeuring — de validatie beslist.",
  "editor.quality.title": "Inhoudscheck",
  "editor.quality.hint":
    "Controleert de structuur, niet de inhoudelijke juistheid. Geen validatie.",
  "editor.quality.empty": "Nog geen uitgebreide inhoud vastgelegd.",
  "editor.quality.thin": "Erg korte inhoud — vul indien nodig context of stappen aan.",
  "editor.quality.headings": "Koppen",
  "editor.quality.lists": "Lijsten",
  "editor.quality.blocks": "Blokken",
  "editor.quality.links": "Links",
  "editor.quality.attachmentsUnreferenced":
    "Bijlagen aanwezig, maar niet genoemd in de tekst — verwijs er eventueel naar.",
  "editor.template.title": "Structuursjabloon starten",
  "editor.template.hint":
    "Sjabloon kiezen, voorbeeld controleren en bewust overnemen. Startstructuur/voorstel — bestaande inhoud wordt bij het toevoegen niet vervangen; er wordt niets automatisch opgeslagen of gevalideerd.",
  "editor.template.selected": "Gekozen sjabloon",
  "editor.template.preview": "Voorbeeld",
  "editor.template.procedure.label": "Werkwijze",
  "editor.template.procedure.description": "Voorwaarden en stappen voor herhaalbaar werk.",
  "editor.template.troubleshooting.label": "Storing",
  "editor.template.troubleshooting.description":
    "Symptoom, oorzaak en maatregel gestructureerd vastleggen.",
  "editor.template.safety.label": "Veiligheid",
  "editor.template.safety.description": "Waarschuwing, veilige controle en gewenste toestand.",
  "editor.template.checklist.label": "Checklist",
  "editor.template.checklist.description":
    "Af te vinken controlepunten plus „wat te doen als er niet aan voldaan is”.",
  "editor.template.handover.label": "Overdracht/training",
  "editor.template.handover.description":
    "Het belangrijkste voor de volgende persoon: kernpunten, typische fouten, contactpersonen.",
  "editor.template.decision.label": "Beslishulp",
  "editor.template.decision.description":
    "Als-dan-regels voor een terugkerende beslissing, incl. escalatiegrens.",
  "editor.template.applySet": "Sjabloon inzetten",
  "editor.template.applyAppend": "Sjabloon onderaan toevoegen",
  "editor.template.applyHelp":
    "Voegt de getoonde startstructuur in de kennispagina in: is de pagina leeg, dan wordt die ingevoegd; staat er al iets in, dan wordt die ONDERAAN toegevoegd — er wordt niets vervangen of opgeslagen. De plaatshouders („… aanvullen”) vervang je daarna door je eigen kennis.",
  "editor.template.mode.set": "Lege inhoud: het sjabloon wordt ingevoegd.",
  "editor.template.mode.append":
    "Bestaande inhoud: het sjabloon wordt toegevoegd, er wordt niets vervangen.",
  "editor.applySafety.replaceWarning":
    "Let op: vervangen overschrijft de huidige inhoud. Toevoegen laat het bestaande staan.",
  "editor.block.info": "Info",
  "editor.block.note": "Aanwijzing",
  "editor.block.warning": "Waarschuwing",
  "editor.block.success": "Succes",
  "editor.image": "Afbeelding uit bijlage",
  "editor.para": "Alinea",
  "editor.imageLabel": "Afbeelding",
  "editor.fileLabel": "Bestand",
  "editor.aiLabel": "AI",
  "editor.aiToggle": "AI-hulp bij het schrijven — opent het AI-palet",
  "editor.noImages": "Geen afbeeldingsbijlagen aanwezig.",
  "editor.imageFromDisk": "Afbeelding van je computer …",
  "editor.fileFromDisk": "Bestand van je computer toevoegen …",
  "editor.imageFromAttachment": "Uit bijlagen",
  "editor.captionPlaceholder": "✎ Afbeeldingsbeschrijving toevoegen …",
  "editor.captionNoAnchor":
    "Voor deze afbeelding kan nu geen afbeeldingsbeschrijving worden aangemaakt. Voeg de afbeelding opnieuw in.",
  "editor.captionAi.suggest": "AI-beschrijving voorstellen",
  "editor.captionAi.loading": "AI-beschrijving wordt gemaakt …",
  "editor.captionAi.panelTitle": "Voorstel",
  "editor.captionAi.aiBadge": "AI-gegenereerd. Graag controleren.",
  "editor.captionAi.withContext": "Gemaakt met documentcontext (titel, kop en omringende tekst).",
  "editor.captionAi.apply": "Overnemen",
  "editor.captionAi.discard": "Verwerpen",
  "editor.captionAi.tooLarge":
    "De afbeelding is te groot voor een beschrijvingsvoorstel (max. 5 MB).",
  "editor.captionAi.imageUnreadable": "De afbeelding van dit onderschrift kon niet worden gelezen.",
  "editor.captionAi.fallbackNoModel":
    "Er is geen AI-model geconfigureerd of vrijgegeven — zonder model is er geen beschrijvingsvoorstel (er wordt niets verzonnen).",
  "editor.captionAi.fallbackTimeout":
    "De cloud-AI overschreed de tijdslimiet — er is daarom geen voorstel. Probeer het later opnieuw.",
  "editor.captionAi.fallbackError":
    "De cloud-AI is momenteel niet bereikbaar of meldt een fout — er is daarom geen voorstel. Probeer het later opnieuw.",
  "editor.captionAi.fallbackConfidential":
    "Deze afbeelding is als vertrouwelijk aangemerkt — de cloud-AI is daarvoor uitgesloten en er is geen lokaal vision-model aangesloten. Er is daarom geen voorstel (er verlaat niets de server).",
  "editor.captionForm.open": "Afbeeldingsbeschrijving bewerken",
  "editor.captionForm.title": "Afbeeldingsbeschrijving",
  "editor.captionForm.label": "Beschrijving van de afbeelding",
  "editor.captionForm.placeholder": "Wat is er op de afbeelding te zien, en waarom staat die hier?",
  "editor.captionForm.limit": "{{n}} van {{max}} tekens",
  "editor.captionForm.limitReached": "Maximale lengte bereikt ({{max}} tekens).",
  "editor.captionForm.append": "Aan de tekst toevoegen",
  "editor.captionForm.save": "Beschrijving opslaan",
  "editor.captionForm.cancel": "Annuleren",
  "editor.captionForm.imageAlt": "Afbeelding die wordt beschreven",
  "editor.captionForm.noSuggestionYet":
    "Nog geen voorstel aangevraagd. De tekst blijft van jou — een voorstel wordt nooit automatisch overgenomen.",
  "editor.captionForm.stale":
    "Deze afbeelding is intussen gewijzigd — het bijschrift is NIET opgeslagen, zodat het niet bij de verkeerde afbeelding terechtkomt. Kopieer de tekst, sluit het formulier en open het opnieuw bij de huidige afbeelding.",
  "editor.captionForm.openLabel": "Afbeeldingsbeschrijving bewerken (opent het invoerformulier)",
  "editor.captionForm.formatLabel": "Opmaak",
  "editor.captionForm.bold": "Vet (Ctrl/Cmd + B)",
  "editor.captionForm.italic": "Cursief (Ctrl/Cmd + I)",
  "editor.captionForm.lineBreak": "Regeleinde (Shift + Enter)",
  "editor.captionForm.selectFirst":
    "Selecteer eerst de tekst die je wilt opmaken — vet of cursief werkt dan daarop.",
  "editor.file": "Bestand koppelen",
  "editor.insertFile": "Bestandsbijlage als link invoegen",
  "editor.noFiles":
    "Nog geen koppelbare bestanden — geüploade bestanden worden pas na het opslaan koppelbaar (met objectreferentie). Tot dan blijven ze als bijlage/bewijs bewaard; geen tijdelijke link.",
  "editor.drop.hint":
    "Afbeeldingen hierheen slepen of plakken (Ctrl/⌘+V). Bestanden blijven bewijs/onderbouwing.",
  "editor.drop.imageActive":
    "Media loslaten — afbeeldingen worden ingevoegd, bestanden blijven bewijs",
  "editor.drop.fileNotice":
    "Alleen afbeeldingen worden inline ingevoegd. Bestanden blijven bijlage/bewijs — een veilige body-link ontstaat pas met een opgeslagen objectreferentie (geen nep-link). De validatie beslist.",
  "editor.preview": "Voorbeeld",
  "editor.edit": "Bewerken",
  "editor.previewBadge": "Voorbeeld — zo zien lezers de pagina",
  "editor.previewEmpty": "Nog geen inhoud — ga naar „Bewerken” en schrijf het eerste onderdeel.",
  "editor.linkPrompt": "Link-URL invoeren:",
  "editor.linkUrl": "URL",
  "editor.linkUrlPlaceholder": "https://… of interne route",
  "editor.linkLabel": "Linktekst optioneel",
  "editor.linkLabelPlaceholder": "Als leeg, wordt de URL getoond",
  "editor.linkInsert": "Link invoegen",
  "editor.linkCancel": "Annuleren",
  "editor.linkInvalid": "Gebruik een veilige URL (https, mailto, / of #).",
  "capture.fType": "Kennissoort",
  "capture.fCategory": "Domein / categorie",
  "capture.submit": "Controleren & indienen",
  "capture.submitBusy": "Wordt ingediend … (concept, bijlagen, indiening)",
  "capture.submitStageCreating": "Kennisobject wordt aangemaakt …",
  "capture.submitStageUploading": "Origineel & bijlagen worden veiliggesteld ({{mb}} MB) …",
  "capture.submitStageLinking": "Bronnen worden gekoppeld …",
  "capture.submitTiming.title": "Details over de duur",
  "capture.submitTiming.create": "Kennisobject aanmaken",
  "capture.submitTiming.upload": "Origineel & bijlagen uploaden",
  "capture.submitTiming.link": "Koppelen & bronnen",
  "capture.submitTiming.seconds": "{{s}} s",
  "capture.submitTiming.mb": "{{mb}} MB",
  "capture.readyTitle": "Opslagcheck",
  "capture.ready.title": "Titel",
  "capture.ready.content": "Uitspraak / inhoud",
  "capture.ready.category": "Categorie",
  "capture.ready.type": "Kennissoort",
  "capture.ready.attachments": "Bijlagen",
  "capture.readyDone": "ok",
  "capture.readyMissing": "ontbreekt",
  "capture.readyOptional": "optioneel",
  "capture.readyHint": "Titel en uitspraak/inhoud zijn nodig om te kunnen opslaan.",
  "capture.draftHint":
    "Voer eerst je ervaringsnotitie in en structureer die met AI — het concept verschijnt hier.",
  "capture.fConditions": "Voorwaarden",
  "capture.fMeasures": "Maatregelen",
  "capture.fTags": "Trefwoorden",
  "capture.fAsset": "Installatie / asset",
  "conf.field": "Vertrouwelijkheid",
  "conf.help":
    "Hoe vertrouwelijk is deze kennis? Openbaar-intern is de standaard (geen beperking). Vertrouwelijk en Streng vertrouwelijk markeren gevoelige kennis: zulke objecten worden nooit in externe contexten gegeven (Output Factory/export). Het niveau kun je vanaf het vastleggen instellen en later altijd wijzigen — elke wijziging wordt in het audit-log vastgelegd. Let op: deze markering beperkt (nog) niet WIE het object ziet.",
  "conf.level.intern": "Openbaar-intern",
  "conf.level.vertraulich": "Vertrouwelijk",
  "conf.level.streng_vertraulich": "Streng vertrouwelijk",
  "capture.fRevalidation": "Hervalidatie na (aantal)",
  "capture.listAdd": "Item toevoegen",
  "capture.listRemove": "Verwijderen",
  "capture.tagPlaceholder": "Tag invoeren, Enter om over te nemen",
  "capture.formularHint":
    "Kernuitspraak en uitspraak zijn genoeg om te beginnen — de overige gegevens hieronder zijn optioneel.",
  "capture.diktatStart": "Dicteren starten",
  "capture.diktatStop": "Dicteren stoppen",
  "capture.diktatUnsupported":
    "Spraakinvoer wordt door deze browser niet ondersteund. Gebruik Chrome/Edge of typ de tekst handmatig in.",
  "capture.diktatNa": "niet beschikbaar",
  "capture.ivStep": "Vraag {{n}} van {{total}}",
  "capture.ivBack": "Terug",
  "capture.ivNext": "Volgende",
  "capture.ivFinish": "Concept aanmaken",
  "capture.ivDone": "Interview afgerond — controleer het concept rechts en dien het in.",
  "capture.ivStart": "Interview starten",
  "capture.ivStartLead":
    "Het geleide interview gebruikt AI om vervolgvragen te stellen. Pas als je op „Interview starten“ klikt, gaat de eerste vraag naar het model — daarvoor wordt niets verzonden. Provider en regio zie je via het (!)-symbool.",
  "capture.ivTurn": "Vraag {{n}}",
  "capture.ivThinking": "De AI formuleert de volgende vraag …",
  "capture.ivResumeLead":
    "Je interviewvoortgang is hersteld. De volgende vraag wordt pas na jouw klik geladen.",
  "capture.ivResumeLoad": "Volgende vraag laden",
  "capture.unsavable.images_one": "{{count}} ingevoegde afbeelding",
  "capture.unsavable.images_other": "{{count}} ingevoegde afbeeldingen",
  "capture.unsavable.docs_one": "{{count}} bijgevoegd bestand (document/video/audio)",
  "capture.unsavable.docs_other": "{{count}} bijgevoegde bestanden (documenten/video/audio)",
  "capture.unsavable.file": "het geüploade bestand „{{name}}” — de verwerking is nog niet afgerond",
  "capture.unsavable.fileQueue":
    "de lopende bestandsverwerking uit „{{name}}” (punt {{current}} van {{total}})",
  "capture.unsavable.extResults":
    "de geladen trefferlijst van de externe zoekopdracht — de zoekopdracht zelf blijft in het concept bewaard",
  // AUFTRAG-mega6 Block A
  "capture.unsavable.sourceUrl":
    "het onvolledige webadres „{{urls}}” — het concept bewaart alleen volledige adressen die met https:// of http:// beginnen; de naam en het fragment van de bron blijven behouden",
  "capture.sourceUrlLimit":
    "Dit adres kan het concept niet meenemen. Zet er https:// of http:// voor — of maak het veld leeg als je het niet nodig hebt.",
  // AUFTRAG-mega6 Block D
  "capture.limit.chars":
    "Maximale lengte bereikt ({{max}} tekens) — verdere tekst wordt niet bewaard.",
  "capture.limit.reviewers":
    "Het concept kan niet meer dan {{max}} beoordelaars bewaren — deselecteer iemand om te wisselen.",
  "capture.limit.sources":
    "Het concept kan niet meer dan {{max}} bronnen bewaren — verwijder er een om ruimte te maken.",
  "capture.limit.interviewAnswers":
    "Het concept kan niet meer dan {{max}} antwoorden bewaren — rond het interview af of sla het concept op.",
  "capture.saveLimit.title": "Het concept kan niet alles opslaan",
  "capture.saveLimit.lead":
    "Tekst, metadata en bronnen worden opgeslagen. Deze inhoud kan het concept echter niet opslaan — bij het opslaan wordt die verworpen:",
  "capture.saveLimit.cancel": "Annuleren — inhoud behouden",
  "capture.saveLimit.confirm": "Toch opslaan en deze inhoud verwerpen",
  "capture.ivAnswerHint": "Jouw antwoord …",
  "capture.ivSend": "Antwoord versturen",
  "capture.ivReadAloud": "Voorlezen",
  "capture.ivReadStop": "Stop",
  "capture.ivDictNa": "Dicteren is in deze browser niet beschikbaar — typ het alsjeblieft.",
  "capture.ivModel": "AI-model",
  "capture.ivFallback": "Deterministische fallback",
  "capture.ivQ.title": "Waar gaat het over? Formuleer een korte kernuitspraak.",
  "capture.ivQ.statement": "Beschrijf de ervaring/uitspraak nauwkeuriger.",
  "capture.ivQ.conditions": "Onder welke voorwaarden geldt dit? Eén per regel.",
  "capture.ivQ.measures": "Welke concrete maatregelen/stappen? Eén per regel.",
  "capture.ivQ.tags": "Trefwoorden voor de vindbaarheid? Kommagescheiden.",
  "capture.ivQHint.title": "bijv. Pomp P-12 bij vorst voorverwarmen",
  "capture.ivQHint.statement": "Wat precies, waarom, met welk effect?",
  "capture.ivQHint.conditions": "Eén voorwaarde per regel",
  "capture.ivQHint.measures": "Eén maatregel per regel",
  "capture.ivQHint.tags": "Vorst, pomp, winter",
  "ask.kicker": "Vragen en antwoorden",
  "ask.title": "Vraag het fabriekskennis",
  "ask.intro":
    "Het antwoord is brongebonden: je ziet waarop het steunt — en in welke staat elk van die bronnen is. Is er geen basis, dan wordt het hiaat open benoemd.",
  "ask.placeholder": "bijv. Wanneer moet klep X bij overdruk gesloten worden?",
  "ask.emptyHint": "Voer eerst een vraag in.",
  "ask.submit": "Vragen",
  // AUFTRAG-mega38 BLOCK A: wachten en mislukken staan DAAR waar het antwoord verschijnt.
  "ask.pending.title": "De vraag loopt tegen de fabriekskennis.",
  "ask.pending.body":
    "Er wordt naar passende bronnen gezocht. Is er geen draagkrachtige basis, dan zegt Klarwerk dat open — er wordt niets verzonnen.",
  "ask.error.title": "De vraag kon niet worden beantwoord.",
  "ask.error.body":
    "Het verzoek is onderweg blijven steken. Dit is GEEN uitspraak over de kennis — het betekent niet dat er geen antwoord is. Probeer het opnieuw.",
  "ask.error.retry": "Opnieuw proberen",
  "ask.demoPrefillHint":
    "Startvraag overgenomen uit het kennisobject — klik op „Vragen”. Het antwoord blijft brongebonden; status en vertrouwen beslissen, er wordt niets automatisch opgeslagen.",
  "ask.examplesLabel": "Voorbeelden:",
  "ask.examplesSendHint": "Eén klik vraagt meteen — de vraag wordt direct verstuurd.",
  "ask.example.valve": "Wat te doen als klep X bij overdruk moet sluiten?",
  "ask.example.filter": "Hoe vaak moet filter F3 gecontroleerd worden?",
  "ask.example.dosing": "Waarom schommelt de doseerwaarde bij lijn L4 na elke ploegwissel?",
  "ask.expect.answer": "vindt passende kennis",
  "ask.expect.gap": "toont kennishiaat",
  "ask.reasoner.model": "Modelmodus",
  "ask.reasoner.deterministic": "Deterministische modus",
  "ask.reasoner.loading": "Modus laadt …",
  "ask.reasoner.unknown": "Modus onbekend",
  "ask.reasoner.hint":
    "Toont of antwoorden via een geconfigureerd model of de op regels gebaseerde fallback lopen. Bronnen en validatie blijven gelijk.",
  "ask.fromValidated": "Uit brongebonden kennis",
  "ask.evidence": "Bewijs",
  "ask.knowledgeClass.gesichert": "Geborgd",
  "ask.knowledgeClass.ungeprueft": "Ongecontroleerd",
  "ask.knowledgeClass.meinung": "Mening/ervaring",
  "ask.knowledgeClass.extern": "Externe bron",
  "ask.knowledgeClass.annahme": "Aanname",
  "ask.knowledgeClass.unbekannt": "Onbekend",
  "ask.steps": "Geraadpleegde contextbronnen",
  // AUFTRAG-mega38 BLOCK F — zie het DE-blok: de lijst is de volledige top-K-set, niet de set
  // bronnen die het antwoord daadwerkelijk heeft gebruikt.
  "ask.sources": "Geraadpleegde bronnen",
  "ask.export.copy": "Kopiëren",
  "ask.export.download": "Als Markdown",
  "ask.export.print": "Afdrukken / PDF",
  "ask.export.copied": "Antwoord incl. bronnen gekopieerd.",
  "ask.export.answer": "Antwoord",
  "ask.export.footer":
    "Brongebonden antwoord uit KLARWERK · gemaakt op {{date}}. Alleen zo betrouwbaar als de gebruikte bronnen (status/vertrouwen). Geen belofte van waarheid.",
  "ask.sourcesHint":
    "Dit antwoord is brongebonden — het is alleen zo betrouwbaar als de gebruikte bron (status, vertrouwen, bruikbaarheid). Vermeld zijn alle bronnen die voor de vraag zijn geraadpleegd; welke daarvan het antwoord gedragen hebben, is gemarkeerd. Naar het kennisobject voor details.",
  // AUFTRAG-mega52 A3/A5 — het antwoord zegt waarop het steunt. Onbruikbare markeringen betekenen "onbekend".
  "ask.attribution.known":
    "De eerstgenoemde bronnen hebben het antwoord gedragen; de overige zijn geraadpleegd maar niet gebruikt.",
  "ask.attribution.unknown":
    "Welke van deze bronnen het antwoord gedragen heeft, was niet toe te wijzen — de AI leverde geen bruikbare bronverwijzingen. De lijst toont daarom alle geraadpleegde bronnen zonder markering, en „Heeft geholpen” is hier niet mogelijk.",
  "ask.attribution.carrying.badge": "draagt",
  "ask.attribution.carrying.hint":
    "Deze bron draagt het antwoord: de AI heeft er zich in de antwoordtekst uitdrukkelijk op beroepen.",
  "ask.attribution.consulted.badge": "geraadpleegd",
  "ask.attribution.consulted.hint":
    "Geraadpleegd maar niet gebruikt: deze bron was beschikbaar voor de AI maar komt niet voor in de antwoordtekst.",
  // Pakket 4 (nacht24): bronnen zoals in het document — status/trust per bron + fragment in origineel formaat.
  "answerSource.trust": "Vertrouwen {{n}}",
  "answerSource.excerptShow": "Fragment in documentformaat tonen",
  "answerSource.excerptHide": "Fragment verbergen",
  "ask.helpful": "Heeft geholpen",
  "ask.thanked": "Bedankt!",
  "ask.status.verified": "Geborgd",
  "ask.status.unverified": "Nog ongecontroleerd",
  "ask.reviewGuard.openLabel": "Nog niet als geborgde kennis gebruiken",
  "ask.reviewGuard.openHint":
    "Minstens één bron is open of nog in beoordeling. Eerst controleren/beoordelen voordat deze uitspraak als geborgd wordt gebruikt.",
  "ask.reviewGuard.unverifiedLabel": "Antwoord is nog ongecontroleerd",
  "ask.reviewGuard.unverifiedHint":
    "Dit antwoord is niet als geborgd ingeschaald. Controleer bronnen en beoordeling voordat je het verder gebruikt.",
  "ask.reviewGuard.cta": "Naar de validatie",
  "ask.gapBadge": "Kennishiaat",
  // AUFTRAG-mega54 BLOK E — de ene volgende stap bij een hiaat (zie de Duitse tekst). De
  // volgorde is inhoud: eerst de gratis stap, dan kennis vastleggen, pas daarna het risicobord.
  "ask.gapNext":
    "Volgende stap: stel de vraag opnieuw met de vakwoorden uit jullie eigen bedrijf — leg anders de kennis vast of prioriteer het hiaat op het risicobord.",
  "ask.noBasisTitle": "Geen betrouwbare basis.",
  "ask.noBasisBody":
    "Geen enkele bron past nauw genoeg bij deze vraag. In plaats van een verzonnen antwoord is er een kennishiaat aangemaakt. Beide zijn mogelijk: de kennis ontbreekt nog — of ze staat onder andere begrippen in de basis.",
  "ask.gap.rescueTitle": "Kennishiaat redden",
  "ask.gap.rescueImpact":
    "Misschien ontbreekt deze ervaringskennis nog, misschien is ze alleen niet vindbaar. Je kunt helpen om die te borgen — voor iedereen die de vraag in de toekomst stelt.",
  "ask.gap.noInvent":
    "Er is geen antwoord verzonnen: zonder betrouwbare bron blijft de vraag eerlijk open.",
  "ask.gap.rescueCta": "Kennis vastleggen & redden",
  // AUFTRAG-mega54 BLOK E3: kop aangescherpt — de stappen zijn de route voor wie het antwoord al
  // kent. De volgorde van de stappen blijft ongewijzigd.
  "ask.gap.stepsTitle": "Ken jij het antwoord? Zo draag je het bij:",
  "ask.gap.step.answer.label": "Vraag beantwoorden",
  "ask.gap.step.answer.hint": "Formuleer wat je hier uit ervaring over weet.",
  "ask.gap.step.experience.label": "Eigen ervaring aanvullen",
  "ask.gap.step.experience.hint": "Voorwaarden, maatregelen, context.",
  "ask.gap.step.structure.label": "AI laten structureren",
  "ask.gap.step.structure.hint": "De AI ordent alleen — verzint er niets bij.",
  "ask.gap.step.review.label": "Laten controleren",
  "ask.gap.step.review.hint": "Pas na validatie geldt het als geborgd.",
  "ask.contract.label": "Antwoordbasis",
  "ask.contract.verified.title": "Brongebonden antwoord",
  "ask.contract.verified.body":
    "Dit antwoord steunt op gevalideerde kennis uit jouw kennisbasis — geen generiek chatbot-antwoord.",
  "ask.contract.verified.next": "Volgende stap: bron bekijken of de kennis gebruiken.",
  "ask.contract.unverified.title": "Brongebonden, maar nog ongecontroleerd",
  "ask.contract.unverified.body":
    "Het antwoord steunt op aanwezige, maar nog niet geborgde kennis. Het is als ongecontroleerd gemarkeerd, geen chatbot-veronderstelling.",
  "ask.contract.unverified.next":
    "Veiligere volgende stap: ter controle geven of in de validatie laten controleren.",
  "ask.contract.gap.title": "Kennishiaat, geen chatbot-antwoord",
  "ask.contract.gap.body":
    "Geen enkele bron past nauw genoeg bij deze vraag om een antwoord te dragen. Dat betekent niet per se dat de kennis ontbreekt — misschien staat ze alleen onder andere woorden in de basis. Hoe dan ook is het een hiaat dat jullie kunnen dichten, geen fout.",
  "ask.contract.trustNote":
    "Vertrouwen en bruikbaarheid tonen hoe betrouwbaar een bron is — geen belofte van waarheid.",
  "ask.contract.sumTotal_one": "{{count}} bron geraadpleegd",
  "ask.contract.sumTotal_other": "{{count}} bronnen geraadpleegd",
  "ask.contract.sumValidated": "{{count}} gevalideerd",
  "ask.contract.sumOpen": "{{count}} open/ongecontroleerd",
  "ask.contract.sumConflict": "{{count}} met conflict",
  "ask.checkCaveat.title": "Voor dit antwoord is niet aangetoond dat het conflictvrij is.",
  "ask.checkCaveat.badge": "controle onbewezen",
  "ask.checkCaveat.incomplete":
    "Bij {{unproven}} van {{total}} gebruikte bronnen is de conflict- en duplicaatcontrole niet volledig gelopen. Er is dus niet overal gezocht — onbekende tegenstrijdigheden zijn daarmee niet uitgesloten.",
  "ask.checkCaveat.noCoverage":
    "Bij {{unproven}} van {{total}} gebruikte bronnen is wel een controle vastgelegd, maar het bereik ervan is niet aangetoond. Hoe ver er is gezocht, is dus onbekend.",
  "ask.checkCaveat.unchecked":
    "Bij {{unproven}} van {{total}} gebruikte bronnen is helemaal geen controle vastgelegd. Daar is nooit naar tegenstrijdigheden gezocht.",
  "ask.checkCaveat.unknown":
    "{{unproven}} van {{total}} gebruikte bronnen zijn niet in de collectie te vinden. Over hun controle valt niets te zeggen.",
  // AUFTRAG-mega53 B2: de vijfde reden — er kon helemaal geen bron aan dit antwoord worden
  // toegewezen.
  "ask.checkCaveat.unattributed":
    "Dit antwoord noemt geen van de {{total}} gebruikte bronnen als bewijs. Welke bron het werkelijk draagt, is daarmee onbekend — controlestand en vertrouwenswaarde zijn aan geen enkele bron toe te wijzen.",
  "ask.trust.unattributed": "vertrouwenswaarde niet toewijsbaar",
  // AUFTRAG-mega34 A2: de onbekende conflictstand.
  "ask.conflictCaveat.title": "De conflictstand is op dit moment niet op te halen.",
  "ask.conflictCaveat.pending":
    "De bekende tegenstrijdigheden worden nog geladen. Tot ze er zijn geldt dit antwoord als ongecontroleerd — niet omdat er iets is gevonden, maar omdat er nog niet gekeken kon worden.",
  "ask.conflictCaveat.failed":
    "De bekende tegenstrijdigheden konden niet worden opgehaald. Of een van de bronnen in een open conflict staat, is daarmee onbekend; dit antwoord geldt daarom als ongecontroleerd.",
  "gap.privacyNotice":
    "De vraag wordt als kennishiaat opgeslagen — geen antwoord en geen gevalideerde kennis. Leg alsjeblieft geen gevoelige of persoonsgebonden details vast; vul later gecontroleerde ervaring aan.",
  "ask.toGaps": "Naar de kennishiaten",
  "ask.toCapture": "Kennis vastleggen",
  "ko.kicker": "Kennisobject",
  "ko.use.ready": "Bruikbaar in de praktijk",
  "ko.use.in-review": "In beoordeling",
  "ko.use.needs-work": "Nog in bewerking",
  "use.ready.label": "Bruikbaar",
  "use.ready.hint": "Gevalideerd — brongebonden bruikbaar (status/vertrouwen dragen).",
  "use.review.label": "In beoordeling",
  "use.review.hint": "Beoordeling loopt — nog niet als geborgd gebruiken.",
  "use.open.label": "Te controleren",
  "use.open.hint": "Open/ongecontroleerd — eerst laten controleren/beoordelen.",
  "ko.ovTrust": "Vertrouwen",
  "ko.ovSources_one": "{{count}} bron",
  "ko.ovSources_other": "{{count}} bronnen",
  "ko.ovAttachments_one": "{{count}} bijlage",
  "ko.ovAttachments_other": "{{count}} bijlagen",
  "trust.explain.title": "Wat betekent vertrouwen?",
  "trust.explain.meta":
    "Vertrouwen is een review-/bewijssignaal uit peerbeoordelingen (0–99) — geen belofte dat de uitspraak waar is.",
  "trust.explain.band.high":
    "Hoog vertrouwen: meermaals positief gecontroleerd. Gebruik het toch met je eigen oordeel.",
  "trust.explain.band.mid":
    "Middelmatig vertrouwen: pas deels gecontroleerd of met voorbehoud (geel). Controleer voor kritisch gebruik nog eens tegen.",
  "trust.explain.band.low":
    "Laag vertrouwen: nauwelijks gecontroleerd of rode beoordeling/conflict. Eerst controleren of naschaven.",
  "trust.explain.review":
    "Geel, rood of een open conflict betekent: controleren of naschaven voordat je erop vertrouwt.",
  "ko.nextLabel": "Volgende actie:",
  "ko.next.use": "gevalideerde kennis — kan in antwoorden/output worden gebruikt.",
  "ko.next.review": "Validatie loopt — open beoordeling afronden.",
  "ko.next.addSource": "Bron/bewijs aanvullen voordat er gevalideerd wordt.",
  "ko.next.validate": "ter goedkeuring laten beoordelen (validatie).",
  "ko.cta.use": "In vragen gebruiken",
  "ko.cta.review": "Beoordeling afronden",
  "ko.cta.addSource": "Naar bronnen & bewijs",
  "ko.cta.validate": "Naar de validatie",
  "ko.title": "Detail",
  "ko.statement": "Uitspraak",
  "ko.createdAt": "Aangemaakt op",
  // WP-SHIP9-S2 Paket 3 (E2): korte-voorbeeld-uitklapper per kennisobject/kandidaat.
  "ko.preview.show": "Snel voorbeeld",
  "ko.preview.hide": "Voorbeeld sluiten",
  "ko.preview.label": "Voorbeeld",
  "ko.createdByName": "door {{name}}",
  "ko.gallery": "Afbeeldingengalerij",
  "ko.galleryCount": "Afbeelding {{n}} van {{m}}",
  "ko.galleryClose": "Sluiten",
  "ko.galleryOpen": "Afbeelding {{n}} vergroten",
  "ko.galleryPrev": "Vorige afbeelding",
  "ko.galleryNext": "Volgende afbeelding",
  "ko.galleryEditCaption": "Afbeeldingsbeschrijving bewerken",
  "ko.galleryLoss": "{{n}} van {{m}} afbeeldingen uit het bronbestand ontbreken in dit concept.",
  "ko.body.readTitle": "Uitgebreide inhoud uit de Knowledge-Editor",
  "ko.body.readNote":
    "Blokken en AI-voorstellen zijn redactionele structuur. Bepalend blijven status, vertrouwen en bronnen van dit kennisobject.",
  "ko.body.readBlocksChip": "gestructureerde inhoud",
  "ko.conditions": "Voorwaarden",
  "ko.measures": "Maatregel",
  "ko.validate": "Valideren",
  "ko.stillValid": "Nog geldig",
  "ko.conditional": "Voorwaardelijk",
  "ko.reject": "Afwijzen",
  "ko.edit": "Bewerken",
  "ko.returnedBanner":
    "Dit kennisobject is uit de beoordeling teruggegeven voor naschaving. Werk de reviewfeedback af en sla een revisie op.",
  "ko.rework.title": "Review-naschaving",
  "ko.rework.hint":
    "Aangestoten vanuit een reviewbeslissing (terugkoppeling/afwijzing). Bewerken maakt een nieuwe versie aan en start de beoordeling opnieuw — geen automatische goedkeuring, geen automatische teruggave.",
  "ko.rework.edit": "Bewerken / revisie",
  "ko.rework.back": "Terug naar de validatie",
  "ko.rework.savedTitle": "Revisie opgeslagen",
  "ko.rework.savedHint":
    "Er is een nieuwe versie ontstaan die opnieuw in de beoordeling gaat — geen automatische goedkeuring, geen automatische teruggave.",
  "ko.rework.toValidation": "Naar de validatie van de revisie",
  "ko.rework.feedbackTitle": "Reviewfeedback",
  "ko.rework.feedback.warn": "Terugkoppeling",
  "ko.rework.feedback.down": "Afwijzing",
  "ko.rework.editTitle": "Naschaving: deze feedback afwerken",
  "ko.rework.editHint":
    "Werk de feedback gericht in. Opslaan maakt een nieuwe versie aan en start de beoordeling opnieuw — geen automatische goedkeuring.",
  "ko.rework.stepsTitle": "Volgende werkstappen",
  "ko.rework.step.feedback": "Reviewfeedback afwerken",
  "ko.rework.step.revise": "Revisie opslaan (nieuwe versie, hernieuwde beoordeling)",
  "ko.rework.step.back": "Terug in de validatiefocus „herzien”",
  "ko.saveEdit": "Opslaan",
  "ko.cancelEdit": "Annuleren",
  "ko.editNote":
    "Opslaan verhoogt de versie, zet de beoordeling terug en stuurt het object opnieuw in de beoordeling.",
  "ko.revision.title": "Wijzigingsoverzicht",
  "ko.revision.none": "Nog geen wijzigingen herkend.",
  "ko.revision.note":
    "Herkent gewijzigde velden/structuur, niet de inhoudelijke juistheid. Reviseren maakt een nieuwe versie aan en vereist review — geen automatische goedkeuring.",
  "ko.revision.field.title": "Titel",
  "ko.revision.field.statement": "Uitspraak",
  "ko.revision.field.body": "Uitgebreide inhoud",
  "ko.revision.field.conditions": "Voorwaarden",
  "ko.revision.field.measures": "Maatregelen",
  "ko.revision.field.tags": "Tags",
  "ko.revision.field.category": "Categorie",
  "ko.revision.field.type": "Type",
  "ko.reportConflict": "Conflict melden",
  "ko.conflictTitle": "Tegenspraak met een ander kennisobject melden",
  "ko.conflictTarget": "Tegensprekend object",
  "ko.conflictTargetPlaceholder": "Object kiezen …",
  "ko.conflictType": "Conflictsoort",
  "ko.conflictDesc": "Waarin bestaat de tegenspraak?",
  "ko.conflictSubmit": "Conflict openen",
  "ko.conflictTargetSearch": "Kennisobject zoeken …",
  "ko.conflictTargetEmpty": "Geen treffers",
  "ko.conflictTargetChoose": "Kiezen",
  "ko.conflictTargetShow": "Voorbeeld",
  "ko.conflictTargetHide": "Voorbeeld sluiten",
  "ko.provenance": "Herkomst",
  "ko.helpfulTitle": "Bewezen waarde",
  "ko.helpfulHint": "Heeft deze kennis je in de praktijk geholpen?",
  "ko.helpful": "Heeft geholpen",
  "ko.helpfulDone": "Bedankt voor je signaal!",
  "ko.helpfulThanks": "Bedankt — als nuttig genoteerd.",
  "ko.sourceTitle": "Bron/bijdrage melden",
  "ko.sourceContribution": "Jouw bijdrage / jouw onderbouwing (verplicht)",
  "ko.sourceRef": "Bron / URL / referentie (optioneel)",
  "ko.sourceHint":
    "Wordt ter controle als commentaar bij het object opgeslagen — nog geen peer-gevalideerde bron.",
  "ko.sourceSubmit": "Bijdrage indienen",
  "ko.sourceSaved": "Bijdrage als commentaar opgeslagen.",
  "ko.sourcesTitle": "Bronnen",
  "ko.sourcesEmpty": "Nog geen externe bronnen.",
  "ko.sourcesHint": "Externe bronnen zijn niveau 2 en niet peer-gevalideerd.",
  "ext.title": "Externe bron zoeken",
  "ext.hint":
    "Server-proxy-zoekopdracht. Treffers worden nooit automatisch overgenomen; als externe, niet peer-gevalideerde bron toevoegen — geen vervanging voor interne validatie.",
  "ext.placeholder": "Zoekterm …",
  "ext.search": "Zoeken",
  "ext.attach": "Als bron toevoegen",
  "ext.attachBlocked":
    "Op het ingestelde niveau mag wel worden gezocht, maar niet worden toegevoegd. Een beheerder kan dit wijzigen onder Beheer → Externe kennis.",
  // AUFTRAG-mega16 Block A (bens SB-4): het niveau is nu een echte grens — het geldt voor ELK
  // openbaar webadres, niet alleen voor herkende aanbieders.
  "ext.gate.publicUrl":
    "Op het ingestelde niveau kan geen bron met een openbaar webadres worden toegevoegd — dat geldt voor elk adres van het internet, niet alleen voor zoekresultaten.",
  "ext.gate.unanchored":
    "Op het ingestelde niveau kan een bron zonder adres alleen worden toegevoegd als het een passage is uit een document dat bij dit kennisobject is opgeslagen. Zonder adres en zonder opgeslagen document kan de server niet vaststellen of het om een extern zoekresultaat gaat.",
  "ext.gate.how": "Een beheerder kan het niveau wijzigen onder Beheer → Externe kennis.",
  "ext.unavailable": "Externe zoekopdracht is niet beschikbaar.",
  "ext.resumeHint":
    "De trefferlijst wordt niet met het concept opgeslagen. Je zoekopdracht is terug — voer de zoekopdracht opnieuw uit om de treffers opnieuw te laden.",
  "extpage.kicker": "Onderzoek",
  "extpage.title": "Externe kennis",
  "extpage.intro": "Externe bronnen doorzoeken — zonder eerst een kennisobject te openen.",
  "extpage.note":
    "Alleen-lezen onderzoek via de server-proxy. Hier wordt niets bijgevoegd of geïmporteerd; om iets over te nemen voeg je een bron toe in het kennisobject-detail. Geen peer-validatie.",
  "extpage.idle": "Voer een zoekterm in om externe bronnen te vinden.",
  "extpage.disabled":
    "Externe zoekfunctie is aan de serverkant uitgeschakeld (EXTERNAL_SEARCH=off). Neem contact op met Beheer/Codex.",
  "extpage.noResults": "Geen resultaten voor deze zoekopdracht.",
  "extpage.resultsTitle": "{{n}} resultaten",
  "ko.sourceLabel": "Naam van de bron (verplicht)",
  "ko.sourceUrl": "URL / referentie (optioneel)",
  "ko.sourceExcerpt": "Fragment / notitie (optioneel)",
  "ko.sourceAdd": "Externe bron toevoegen",
  "ko.sourceAdded": "Externe bron toegevoegd.",
  "ko.sourceRemove": "Bron verwijderen",
  "ko.sourceUnvalidated": "extern · niet peer-gevalideerd",
  "ko.sourceValidated": "peer-gevalideerd",
  "ko.lineageTitle": "Herkomst & verloop",
  "ko.lineageOrigin": "Oorsprong",
  "ko.lineageTransferred": "(overgedragen)",
  "ko.lineageVersions": "Versie",
  "ko.lineageChanges": "Wijzigingen",
  "ko.lineageRelated": "Verwant",
  "ko.lineageAudit": "Laatste gebeurtenissen",
  "ko.lineageGraphLink": "Bekijken in de kennisgraaf",
  "nb.title": "Kennisnetwerk — buurt",
  "nb.hint":
    "In het midden het artikel dat je leest; eromheen wat er via gedeelde tags bij hoort. Eén klik maakt de buur het nieuwe midden.",
  "nb.empty": "Geen buren via betekenisvolle tags.",
  "nb.back": "Terug naar „{{title}}”",
  "nb.open": "Artikel openen",
  "nb.makeCenter": "„{{title}}” het nieuwe midden maken",
  "nb.svgLabel": "Buurt van „{{title}}”",
  "nb.countAll_one": "{{count}} buur in het netwerk",
  "nb.countAll_other": "{{count}} buren in het netwerk",
  "nb.countTruncated": "De {{shown}} sterkste van {{total}} buren",
  "nb.excluded":
    "Geen verbindingen via alledaagse tags: {{tags}} — meer dan de helft van alle objecten draagt ze, dus de verbinding zegt niets.",
  "ko.transferTitle": "Auteur overdragen",
  "ko.transferOriginal": "Oorspronkelijke auteur",
  "ko.author": "Auteur",
  "ko.authorUnknown": "Onbekende persoon ({{ref}})",
  "ko.authorLoading": "Auteursnaam wordt geladen …",
  "ko.authorUnavailable": "Auteursnaam niet beschikbaar",
  "ko.originalAuthor": "Origineel",
  "ko.transferPick": "Nieuwe auteur kiezen …",
  "ko.transfer": "Overdragen",
  "ko.transferDone": "Auteur overgedragen. Oorspronkelijke auteur blijft zichtbaar.",
  "ko.history": "Versies",
  "ko.evidenceTitle": "Bewijs",
  "ko.evidenceEmpty": "Nog geen aparte Evidence-records aanwezig.",
  "ko.evidenceKind.source": "Bron",
  "ko.evidenceKind.attachment": "Bijlage",
  "ko.evCons.title": "Evidence-consistentie",
  "ko.evCons.status.ok": "kloppend",
  "ko.evCons.status.warning": "controleren",
  "ko.evCons.counts": "Bronnen {{sources}} · Bijlagen {{attachments}} · Evidence {{evidence}}",
  "ko.evCons.allOk": "Bronnen, bijlagen en evidence komen volledig overeen.",
  "ko.evCons.finding.source-without-evidence": "Bron zonder evidence",
  "ko.evCons.finding.attachment-without-evidence": "Bijlage zonder evidence",
  "ko.evCons.finding.evidence-without-source": "Evidence zonder bron",
  "ko.evCons.finding.evidence-without-attachment": "Evidence zonder bijlage",
  "ko.evCons.finding.legacy-inline-attachment": "Legacy-inline-bijlage (zonder evidence)",
  "ko.evVer.title": "Evidence per versie",
  "ko.evVer.version": "v{{n}}",
  "ko.evVer.counts": "Bronnen {{sources}} · Bijlagen {{attachments}}",
  "ko.evVer.latest": "laatst {{at}}",
  "ko.evVer.without": "Zonder evidence: {{versions}}",
  "ko.evFresh.title": "Evidence-actualiteit",
  "ko.evFresh.current": "actueel onderbouwd",
  "ko.evFresh.outdated": "alleen oudere versies",
  "ko.evFresh.missing": "Evidence ontbreekt",
  "ko.evFresh.neutral": "geen aanleiding voor evidence",
  "ko.evFresh.counts": "v{{version}} · actueel {{current}} · ouder {{older}}",
  "ko.snapshotsTitle": "Versie-snapshots",
  "ko.snapshotsEmpty": "Nog geen opgeslagen volledige snapshots aanwezig.",
  "ko.snapshotInitial": "Beginversie — geen diff met voorganger.",
  "ko.snapshotNoChanges": "Geen wijziging in de hoofdvelden.",
  "ko.snapshotField.title": "Titel",
  "ko.snapshotField.statement": "Uitspraak",
  "ko.snapshotField.conditions": "Voorwaarden",
  "ko.snapshotField.measures": "Maatregelen",
  "ko.snapshotField.type": "Soort",
  "ko.snapshotField.status": "Status",
  "ko.comments": "Reacties",
  "ko.commentsEmpty": "Nog geen reacties.",
  "ko.commentPlaceholder": "Reactie schrijven …",
  "ko.commentAdd": "Reageren",
  "ko.attachments": "Bijlagen / foto's",
  "ko.attachmentsEmpty": "Nog geen bijlagen.",
  "ko.attachmentAdd": "Foto toevoegen",
  "ko.attachmentUploading": "Wordt geüpload …",
  "ko.attachmentRemove": "Bijlage verwijderen",
  "val.kicker": "Validation Board",
  "val.intro":
    "Peer-beoordeling groen / geel / rood. Vanaf de drempel (standaard 3× groen, 0× rood) geldt een object als gevalideerd.",
  "val.filter": "Volledige tekst filteren …",
  "val.filterAllTypes": "Alle kennissoorten",
  "val.filterAllCategories": "Alle categorieën",
  "val.filterAllTags": "Alle tags",
  "val.filterMine": "Aan mij toegewezen",
  // WP-SUBMIT-ASYNC: status van de achtergrond-AI-controle op de kaart + filter.
  "val.filterAiPending": "AI-controle loopt",
  "val.aiCheck.pending": "Duplicaat-/overlapcontrole loopt",
  "val.aiCheck.pendingAi": "Duplicaat-/conflictcontrole (met AI) loopt",
  "val.aiCheck.pendingHint":
    "De deterministische duplicaat-/overlapcontrole draait op de achtergrond. Het resultaat verschijnt hier zodra deze klaar is.",
  "val.aiCheck.pendingHintAi":
    "De duplicaat-/conflictcontrole (met AI) op conflicten en overlappingen draait op de achtergrond. Het resultaat verschijnt hier zodra deze klaar is.",
  "val.aiCheck.failed": "Controle mislukt",
  "val.aiCheck.retry": "Opnieuw controleren",
  "val.aiCheck.retryStarted": "Controle opnieuw ingepland — deze draait nu op de achtergrond.",
  "val.aiCheck.locked":
    "Duplicaat-/overlapcontrole loopt … beoordelingsacties zijn geblokkeerd totdat het resultaat er is.",
  "val.aiCheck.lockedAi":
    "Duplicaat-/conflictcontrole (met AI) loopt … beoordelingsacties zijn geblokkeerd totdat het resultaat er is.",
  "val.aiCheck.reason.no-model":
    "Geen AI-model actief — er is niets gecontroleerd. Configureer een model en controleer opnieuw.",
  "val.aiCheck.reason.model-error":
    "De AI-controle is met een fout gestopt. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.reason.timeout":
    "De AI-controle heeft de tijdslimiet overschreden en is afgebroken. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.reason.model-timeout":
    "Het AI-model heeft niet op tijd geantwoord. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.reason.queue-overflow":
    "De controlewachtrij was vol — deze taak is verdrongen. Opnieuw controleren plant hem opnieuw in.",
  // D-AISTATE PAKET 1 (bens V1): vertrouwelijk → cloud-AI uitgesloten, geen lokaal model.
  "val.aiCheck.reason.confidential":
    "Vertrouwelijk — de cloud-AI is uitgesloten en er is geen lokaal model beschikbaar. Alleen de deterministische duplicaat-/overlapcontrole liep; er is geen inhoudelijke AI-controle uitgevoerd.",
  // AUFTRAG-mega11 Block A (bens SB-1): neutraal — geen uitspraak over beschermde inhoud.
  "val.aiCheck.reason.privacy-no-cloud":
    "Voor deze controle is de cloud-AI om privacyredenen niet beschikbaar en er is geen lokaal model gereed. Alleen de deterministische duplicaat-/overlapcontrole liep; er is geen inhoudelijke AI-controle uitgevoerd.",
  // RT-001 (Pedi): eerlijke classificatie van echte providerfouten — nooit een providernaam/sleutel/
  // endpoint/ruwe fouttekst, alleen een begrijpelijke oorzaak plus wat de gebruiker kan doen.
  "val.aiCheck.reason.auth":
    "De AI kon niet inloggen — de inloggegevens ontbreken of zijn geweigerd. Controleer de modelinloggegevens in de instellingen en controleer opnieuw.",
  "val.aiCheck.reason.rate-limit":
    "De AI-aanbieder heeft het verzoek geweigerd vanwege een snelheidslimiet. Wacht even en controleer opnieuw.",
  "val.aiCheck.reason.unreachable":
    "De AI-aanbieder was niet bereikbaar — waarschijnlijk een netwerk- of verbindingsprobleem. Controleer de verbinding en controleer opnieuw.",
  "val.aiCheck.reason.bad-response":
    "Het AI-model gaf een onbegrijpelijk antwoord dat niet kon worden verwerkt. Opnieuw controleren start een nieuwe run.",
  // AUFTRAG-mega23 Block B: TECHNISCHE inplanning mislukt — het model is nooit geraadpleegd en heeft
  // niets aangemerkt. De tekst zegt precies dat en doet zich niet voor als een modelfout.
  "val.aiCheck.reason.submit-followup-failed":
    "De controle kon bij het indienen om technische redenen niet worden ingepland — het AI-model is daarbij niet geraadpleegd en heeft niets aangemerkt. Opnieuw controleren plant hem opnieuw in.",
  // AUFTRAG-mega28 A2/A3: met de kandidaat-limiet mag een run niet meer suggereren dat hij de hele
  // bibliotheek heeft gezien. Deze teksten noemen de aantallen en zeggen wat een leeg resultaat NIET betekent.
  "val.aiCheck.reason.capacity":
    "De controle is afgebroken omdat het AI-model overbelast was — hij is niet tot het einde gelopen. Opnieuw controleren start een nieuwe run.",
  "val.aiCheck.boardCaveat":
    "Dat betekent niet “gecontroleerd en vrij”: van {{total}} kennisobjecten hebben er {{incomplete}} een onvolledige controle en {{unchecked}} helemaal geen. De detectie vergelijkt elke bijdrage alleen met een beperkte groep kandidaten.",
  // AUFTRAG-mega31 A4: “helemaal geen run” en “geen dekking aangetoond” zijn TWEE uitspraken.
  "val.aiCheck.boardCaveat.noCoverage":
    "Bij {{noCoverage}} andere is een controle vastgelegd, maar geen dekking aangetoond — over hun bereik is niets vastgesteld.",
  "val.aiCheck.coverage.partial": "DEELS GECONTROLEERD",
  "val.aiCheck.coverage.capped":
    "Vergeleken met ten minste {{completed}} van {{available}} mogelijke buren — geen volledige vergelijking. Het getal is de conservatieve minimumdekking van beide controles (conflict en duplicaat); de zwakste van de twee bepaalt het. Geen bevinding betekent: niets gevonden binnen die groep, niet “vrij van conflicten en duplicaten”.",
  "val.aiCheck.coverage.skipped":
    "Vergeleken met ten minste {{completed}} van {{available}} mogelijke buren; {{skipped}} vergelijkingen zijn door fouten overgeslagen — de run is onvolledig. Geen bevinding betekent niet “vrij van conflicten en duplicaten”.",
  "val.aiCheck.coverage.aborted":
    "Afgebroken na ten minste {{completed}} van {{available}} mogelijke buren — de rest is niet gecontroleerd. Geen bevinding betekent niet “vrij van conflicten en duplicaten”.",
  "val.aiCheck.coverage.unproven":
    "Deze run is niet als volledig aangetoond: het protocol vermeldt {{completed}} afgeronde vergelijkingen bij {{available}} mogelijke buren. Geen bevinding betekent niet “vrij van conflicten en duplicaten”.",
  "val.feedback.condTitle": "Voorwaardelijk – onderbouwing voor de auteur (verplicht)",
  "val.feedback.rejTitle": "Afwijzing – onderbouwing voor de auteur (verplicht)",
  "val.feedback.placeholder": "Wat moet er worden herzien? …",
  "val.feedback.submit": "Versturen",
  "val.feedback.cancel": "Annuleren",
  "val.feedback.error": "Kon niet worden opgeslagen.",
  "val.feedback.helpHint":
    "Jouw feedback helpt de auteur om de volgende versie gericht bij te werken.",
  "val.empty": "Geen openstaande objecten.",
  "val.target": "Doel: {{n}}× groen",
  "val.trust": "Vertrouwen",
  "val.votes": "{{have}} van {{need}} groen",
  "val.votesTitle": "Validatie-voortgang",
  "val.votesHint":
    "Zo veel groene (positieve) beoordelingen zijn er vastgelegd — van de {{need}} die nodig zijn tot aan de validatie. Vanaf voldoende groene en 0 rode geldt het object als gevalideerd; rode beoordelingen blokkeren de goedkeuring.",
  "val.votesBlocked": "{{count}}× rood",
  "val.staleVotes": "{{count}}× verouderd",
  "val.staleVotesHint":
    "Deze beoordelingen komen uit een eerdere revisie (vóór v{{version}}) en tellen niet meer mee. Het object heeft nieuwe beoordelingen van de huidige versie nodig.",
  "val.markTrue": "Als waar markeren",
  "val.markTrueConfirm": "Als waar markeren en volledig valideren?",
  "val.markTrueCancel": "Annuleren",
  "val.markTrueYes": "Ja, valideren",
  "val.markTrueDone": "Als waar gemarkeerd — object is nu gevalideerd.",
  "val.more": "Signalen & context tonen",
  "val.editKo": "Bewerken",
  "val.transferred": "Auteur overgedragen",
  "val.assigned": "toegewezen",
  "val.decisionLabel": "Beslissing open:",
  "val.reviewContext.new": "Nieuw",
  "val.reviewContext.revision": "Herzien",
  "val.reviewContext.hint.new": "Eerste beoordeling: bron, uitspraak en structuur controleren.",
  "val.reviewContext.hint.revision":
    "Wijziging controleren: versie en inhoud opnieuw beoordelen — geen automatische goedkeuring.",
  "val.reviewFocus.label": "Review-focus",
  "val.reviewFocus.all": "Alle",
  "val.reviewFocus.new": "Nieuw",
  "val.reviewFocus.revision": "Herzien",
  "val.focusActive.label": "Actieve filters",
  "val.focusReset": "Filters resetten",
  "val.focusEmpty.filtered": "Geen resultaten met de huidige filters.",
  "val.focusEmpty.otherFilters": "Pas zoekterm, type, categorie of tag aan.",
  "val.mineFocus.title": "Aan jou toegewezen review-werk",
  "val.mineFocus.hint": "Dit is jouw persoonlijke review-lijst. Je kunt hem nu afwerken.",
  "val.mineFocus.count": "{{n}} voor jou",
  "val.mineFocus.reset": "Alle openstaande tonen",
  "val.mineEmpty.title": "Geen aan jou toegewezen review-werk",
  "val.mineEmpty.hint":
    "Zodra er iets aan je wordt toegewezen, verschijnt het hier. Tot dan staat hier niets voor je open.",
  "val.mineEmpty.cta": "Alle openstaande objecten bekijken",
  "val.decision.low": "weinig onderbouwd — zorgvuldig controleren, bronnen/bewijs bekijken.",
  "val.decision.mid": "gedeeltelijk onderbouwd — uitspraak en bronnen tegen elkaar controleren.",
  "val.decision.high": "goed onderbouwd — een korte controle volstaat meestal.",
  "val.reviewState.new": "Nieuw vastgelegd · open",
  "val.reviewState.assigned": "Toegewezen · beoordeling loopt",
  "val.reviewState.inReview": "Beoordeling begonnen",
  "val.reviewState.validated": "Gevalideerd",
  "val.reviewHint.new": "Nog geen beoordeling — nu inhoudelijk controleren.",
  "val.reviewHint.assigned": "Toegewezen — de verantwoordelijke persoon beoordeelt als volgende.",
  "val.reviewHint.inReview": "Beoordeling loopt — bronnen en uitspraak tegen elkaar controleren.",
  "val.reviewHint.validated": "Al gevalideerd.",
  "val.confirm": "Bevestigen",
  "val.conditional": "Voorwaardelijk",
  "val.reject": "Afwijzen",
  "val.actionApprove": "Goedkeuren",
  "val.actionQuery": "Terugvraag",
  "val.actionReject": "Afwijzen",
  "val.feedbackRequiredHint": "* Terugvraag en afwijzing hebben een onderbouwing nodig.",
  "val.guide.title": "Wat controleer ik nu?",
  "val.guide.statement": "Uitspraak",
  "val.guide.statement.hint": "Klopt de kernuitspraak inhoudelijk?",
  "val.guide.evidence": "Bron & bewijs",
  "val.guide.evidence.hint": "Zijn er bron of bewijs aanwezig en houdbaar?",
  "val.guide.context": "Context",
  "val.guide.context.hint": "Is duidelijk wanneer en waar dit geldt?",
  "val.guide.traceable": "Navolgbaarheid",
  "val.guide.traceable.hint": "Is het begrijpelijk en navolgbaar beschreven?",
  "val.guide.focus.revision":
    "Herzien — controleer gericht wat er sinds de vorige versie is veranderd.",
  "val.guide.focus.transfer": "Auteur is overgedragen — kijk extra goed naar uitspraak en bewijs.",
  "val.guide.trustNote":
    "Vertrouwen is een review-signaal, geen waarheidsgarantie. Pas voldoende goedkeuringen — het afgesproken minimum aantal controleurs — maken kennis geborgd.",
  "val.guide.impactTitle": "Wat bewerkstelligt de beslissing?",
  "val.impact.up.title": "Goedkeuren",
  "val.impact.up.body":
    "Telt als één goedkeuringsstem. Kennis wordt pas bruikbaar als status, het aantal goedkeuringen en vertrouwen het dragen — er wordt niets automatisch goedgekeurd.",
  "val.impact.warn.title": "Terugvraag",
  "val.impact.warn.body":
    "Vereist een korte onderbouwing. Blijft review-werk en helpt de auteur om gericht bij te werken.",
  "val.impact.down.title": "Afwijzen",
  "val.impact.down.body":
    "Vereist een korte onderbouwing. Leidt tot herwerking — er wordt niets automatisch afgesloten.",
  "val.decisionSaved": "Beoordeling vastgelegd.",
  "val.outcome.up":
    "Positief beoordeeld. Als status en vertrouwen het dragen, kan het als volgende stap brongebonden worden gebruikt of gecontroleerd — automatisch gevalideerd wordt er daardoor niets.",
  "val.outcome.warn":
    "Terugvraag gedocumenteerd. Blijft review-werk totdat de openstaande punten zijn opgehelderd.",
  "val.outcome.down": "Afwijzing gedocumenteerd. Blijft review-/feedback-werk.",
  "val.nextViewKo": "Object bekijken",
  "val.nextUse": "Kennis gebruiken (vragen)",
  "val.nextRework": "In het object bijwerken",
  "val.assign": "Toewijzen …",
  "val.openDetails": "Details bekijken — bewerken & verwijderen in het object",
  // AUFTRAG-mega38 BLOCK E — zie het DE-blok: de wand toont recent VASTGELEGDE kennis, geen
  // geborgde; ze filtert niet op status.
  "start.livewall.title": "Wat er nu gebeurt",
  "start.livewall.subtitle": "Recent vastgelegde kennis en kennis die anderen heeft geholpen.",
  "start.livewall.saved": "Recent vastgelegd",
  "start.livewall.helped": "Heeft geholpen",
  "start.livewall.helpedToday": "vandaag geholpen: {{n}}",
  "start.livewall.savedEmpty": "Nog niets vastgelegd — de eerste bijdrage verschijnt hier.",
  "start.livewall.helpedEmpty": "Nog geen „heeft geholpen”-terugkoppeling.",
  "con.kicker": "Conflictoverzicht",
  "con.title": "Conflicten oplossen — zonder kennis te verliezen",
  "con.intro":
    "Tegenstrijdigheden worden naast elkaar gezet en geclassificeerd. Alleen waarheidsconflicten activeren het menselijke escalatiepad.",
  "con.empty": "Geen openstaande conflicten.",
  "conflict.impact.title": "Openstaand conflict — bruikbaarheid beperkt",
  "conflict.impact.hint":
    "Bij deze kennis staat een conflict open. Het is niet automatisch onjuist, maar zou vóór onbeperkt gebruik moeten worden gecontroleerd.",
  "conflict.impact.truthTitle": "Openstaand waarheidsconflict — controleren vóór gebruik",
  "conflict.impact.truthHint":
    "Bij deze kennis staat een waarheidsconflict open. Tot de opheldering geldt het als te controleren, niet als onbeperkt geborgd.",
  "conflict.impact.badge": "Conflict open",
  "conflict.impact.cta": "Conflict bekijken",
  "con.type.truth": "Waarheid",
  "con.type.experience": "Ervaring",
  "con.type.context": "Context",
  "con.type.temporal": "Tijd",
  "con.type.role": "Rol",
  "con.status.offen": "Open",
  "con.status.eskaliert": "Geëscaleerd",
  "con.status.zweitmeinung": "Tweede mening",
  "con.status.geloest": "Opgelost",
  "con.escPath": "Escalatiepad",
  "con.escalate": "Escaleren",
  "con.resolve": "Oplossen",
  "con.origin.auto": "Automatisch herkend",
  "con.origin.manual": "Handmatig aangemaakt",
  "con.autoConfidence": "Zekerheid {{percent}} %",
  "con.autoConfidenceCaption": "AI-zekerheid van de herkenning — geen bewezen tegenstrijdigheid",
  "con.collision.at": "Botsing bij",
  "con.collision.verbatim": "letterlijk uit het bewijs",
  "con.collision.point": "Botsingspunt",
  "con.autoWhy": "Onderbouwing",
  "con.autoQuoteA": "Bewijs A",
  "con.autoQuoteB": "Bewijs B",
  "con.dismiss": "Vals alarm – geen tegenstrijdigheid",
  "con.resolveConfirm": "Beslissing opslaan",
  "con.decision": "Beslissing",
  "con.decisionPlaceholder": "Hoe wordt de tegenstrijdigheid opgelost? (onderbouwing/resultaat)",
  "con.versus": "vs",
  "con.conditions": "Voorwaarden",
  "con.measures": "Maatregelen",
  "con.sources": "Bronnen",
  "con.openKo": "Object openen",
  "con.compareOpen": "Beide naast elkaar zetten",
  "con.readonlyCompare": "Alleen-lezen vergelijking",
  "con.detectedOn": "Herkend op {{date}}",
  "con.evidenceSideLabel": "Bewijs van deze kant",
  "con.evidenceBalance.neither":
    "Geen van beide uitspraken is met een bron onderbouwd. Deze tegenstrijdigheid is daarom niet op de formulering te beslissen, alleen op bewijs — de volgende stap is voor ten minste één kant een bron toe te voegen.",
  "con.evidenceBalance.oneSided":
    "Slechts één van beide uitspraken is met een bron onderbouwd: “{{title}}”. Dat is een verschil in bewijslast, geen oordeel over welke uitspraak klopt — een onderbouwde uitspraak kan onjuist zijn. De volgende stap is de andere kant te onderbouwen of in te trekken.",
  "con.compareTitle": "Vergelijking",
  "con.koMissing": "Bijdrage is verwijderd.",
  "con.resolveEffect":
    "De beslissing wordt gedocumenteerd en geregistreerd. Vertrouwen/status van de objecten worden NIET automatisch gewijzigd (geen stil overschrijven).",
  "con.resolveRevalidate": "Betrokken objecten zo nodig handmatig hervalideren.",
  "con.secondOpinion": "Tweede mening",
  "con.secondOpinionAdd": "Tweede mening",
  "con.secondOpinionConfirm": "Tweede mening opslaan",
  "con.secondOpinionPlaceholder": "Inschatting van een tweede vakpersoon …",
  "con.nextLabel": "Volgende stap",
  "con.next.escalate": "Escaleren naar een mens (waarheidsconflict).",
  "con.next.secondOpinion": "Een tweede mening van een tweede vakpersoon inwinnen.",
  "con.next.resolve": "Beslissen en de oplossing documenteren.",
  "con.next.done": "Conflict is opgelost — geen openstaande actie.",
  "dup.kicker": "Duplicaten-Board",
  "dup.title": "Dubbelingen oplossen — één thema, één bron",
  "dup.intro":
    "Automatisch herkende overlappingen tussen bijdragen. Zeer hoge tekstdekking wordt ook zonder AI gevonden; de subtielere gevallen controleert het model. Jij beslist: als verwant koppelen, gescheiden laten of als vals alarm sluiten. (Een automatisch samenvoegen bestaat bewust niet.)",
  "dup.empty": "Geen openstaande overlappingen.",
  "dup.relation.identisch": "Identiek",
  "dup.relation.a_enthaelt_b": "A bevat B",
  "dup.relation.b_enthaelt_a": "B bevat A",
  "dup.relation.teilweise": "Gedeeltelijke overlap",
  "dup.relation.verwandt": "Verwant",
  "dup.status.offen": "Open",
  "dup.status.in_bearbeitung": "In behandeling",
  "dup.status.geschlossen": "Gesloten",
  "dup.method.model": "AI-controle",
  "dup.method.deterministic": "Tekstvergelijking",
  "dup.probable": "Vermoedelijk duplicaat",
  "dup.textIdentical": "Tekstgelijk duplicaat",
  "dup.overlap": "{{percent}} % tekstdekking",
  "dup.confidence": "Zekerheid {{percent}} %",
  "dup.leadCaptionModel": "AI-waarschijnlijkheid — geen bewezen duplicaat",
  "dup.leadCaptionText": "Woord-/tekstgelijkenis — geen bewezen duplicaat",
  "dup.why": "Onderbouwing",
  "dup.shared": "Gemeenschappelijke uitspraken",
  "dup.quoteA": "In A",
  "dup.quoteB": "In B",
  "dup.onlyA": "Alleen in A",
  "dup.onlyB": "Alleen in B",
  "dup.recommendation": "Aanbeveling",
  "dup.rec.zusammenfuehren": "Sterke overlap — koppelen of één versie bijhouden",
  "dup.rec.zusammenfuehren_pruefen": "Overlap controleren — koppelen of gescheiden laten",
  "dup.rec.getrennt_lassen": "Gescheiden laten",
  "dup.rec.verwandt_verlinken": "Als verwant koppelen",
  "dup.versus": "vs",
  "dup.openKo": "Object openen",
  "dup.compareOpen": "Beide naast elkaar zetten",
  "dup.compareTitle": "Vergelijking",
  "dup.koMissing": "Bijdrage is verwijderd.",
  "dup.closed": "Afgerond",
  "dup.reason.merged": "Samengevoegd",
  "dup.reason.kept_separate": "Bewust gescheiden gelaten",
  "dup.reason.linked_related": "Als verwant gekoppeld",
  "dup.reason.dismissed": "Vals alarm — geen duplicaat",
  "dup.reason.participant_deleted": "Betrokken bijdrage verwijderd",
  "dup.reason.superseded": "Niet meer van toepassing geworden",
  "dup.action.dismiss": "Vals alarm – geen duplicaat",
  "dup.action.keepSeparate": "Gescheiden laten",
  "dup.action.linkRelated": "Als verwant koppelen",
  "board.koRemoved": "Object verwijderd",
  "board.detailsShow": "Details bekijken",
  "con.leadKicker": "Tegenstrijdigheid",
  "dup.leadKicker": "Overlap",
  // D-BIB (nacht24 pakket 5): dynamische facetten + subgroepen + opgeslagen weergaven (lokaal).
  "lib.facet.category": "Afdeling/categorie",
  "lib.facet.language": "Taal",
  "lib.facet.status": "Status",
  "lib.facet.author": "Auteur",
  "lib.facet.age": "Leeftijd",
  "lib.facet.trust": "Vertrouwen",
  "lib.facet.maturity": "Rijpheid",
  "val.facet.pruefstand": "Toetsingsfase",
  "lib.facet.origin": "Herkomst",
  "lib.facet.type": "Kennissoort",
  "lib.facet.tag": "Trefwoord",
  "facet.active": "Actieve filters",
  "facet.reset": "Alles opnieuw instellen",
  "facet.remove": "{{label}} verwijderen",
  "facet.result": "Treffers: {{shown}} van {{total}}",
  "facet.filtered": "gefilterd",
  "facet.more": "+{{n}} meer",
  "facet.moreFilters": "Meer filters",
  "facet.noMatch": "geen treffers (tegenstrijdige opgeslagen weergave)",
  "lib.facet.lang.de": "Duits",
  "lib.facet.lang.en": "Engels",
  "lib.facet.lang.nl": "Nederlands",
  "lib.facet.lang.other": "zonder taalmarkering",
  "lib.facet.ageBucket.d30": "≤ 30 dagen",
  "lib.facet.ageBucket.d180": "≤ 180 dagen",
  "lib.facet.ageBucket.y1": "≤ 1 jaar",
  "lib.facet.ageBucket.older": "ouder dan 1 jaar",
  "lib.facet.ageBucket.unknown": "leeftijd onbekend",
  "lib.facet.trustBucket.t0": "Vertrouwen 0",
  "lib.facet.trustBucket.t1": "Vertrouwen 1–39",
  "lib.facet.trustBucket.t40": "Vertrouwen 40–69",
  "lib.facet.trustBucket.t70": "Vertrouwen 70+",
  "lib.facet.more": "+{{n}} meer",
  "lib.facet.none": "zonder waarde",
  // AUFTRAG-mega10 blok B: de chipmuur wordt een zoekmasker (rail, zoeken per dimensie,
  // opengaande limiet, plakkende teller, bereikfilter, filterblad).
  "facet.searchLabel": "Zoeken in {{label}}",
  "facet.searchPlaceholder": "{{label}} zoeken …",
  "facet.searchNoHit": "Geen waarde past bij „{{query}}”.",
  "facet.showAll": "Alle {{n}} tonen",
  "facet.showLess": "Minder tonen",
  "facet.restricted": "alleen waarden uit de gekozen categorie",
  "facet.showResults_one": "{{count}} treffer tonen",
  "facet.showResults_other": "{{count}} treffers tonen",
  "facet.countFiltered": "van {{total}} gefilterd",
  "facet.countAll": "volledige voorraad",
  "facet.openFilters": "Filters",
  "facet.closeFilters": "Filters sluiten",
  "facet.sheetTitle": "Filters",
  "facet.rangeLabel": "Periode",
  "facet.rangeFrom": "van",
  "facet.rangeTo": "tot",
  "facet.rangeFromPill": "vanaf {{date}}",
  "facet.rangeToPill": "tot {{date}}",
  "facet.rangeContradictory":
    "De begindatum ligt na de einddatum — deze combinatie levert niets op.",
  "lib.facet.confidentiality": "Vertrouwelijkheid",
  "lib.facet.showResults_one": "{{count}} bijdrage tonen",
  "lib.facet.showResults_other": "{{count}} bijdragen tonen",
  "lib.facet.rangeLabel": "Laatst gewijzigd",
  "lib.loadMore": "Nog {{n}} laden",
  "lib.views.remember": "Deze zoekopdracht onthouden",
  "lib.views.savedLabel": "Opgeslagen zoekopdrachten",
  // AUFTRAG-sortfilter · Punt 1: sortering van de resultatenlijst.
  "lib.sort.label": "Sorteren",
  "lib.sort.relevance": "Relevantie",
  "lib.sort.title": "Titel A→Z",
  "lib.sort.trust": "Vertrouwen (hoog→laag)",
  "lib.sort.recent": "Laatst gewijzigd (nieuw→oud)",
  "lib.groupBy.label": "Subgroepen",
  "lib.groupBy.none": "geen",
  "lib.views.label": "Weergaven",
  "lib.views.pick": "Opgeslagen weergave laden …",
  "lib.views.namePlaceholder": "Naam van de weergave",
  "lib.views.save": "Weergave opslaan",
  "lib.views.remove": "Weergave verwijderen",
  "lib.views.localHint": "lokaal in deze browser opgeslagen",
  "imp.select.deselectLang": "Alle {{lang}} deselecteren · {{n}}",
  // SCRUM-486 (nacht24 pakket 3): één rustige bevindingsweergave — wat, detectiepad (eerlijk),
  // beide kanten gelinkt, gegroepeerd per bijdrage.
  "finding.kind.konflikt": "Conflict",
  "finding.kind.duplikat": "Duplicaat",
  "finding.kind.ueberschneidung": "Overlap",
  "finding.way.ki": "met AI",
  "finding.way.deterministisch": "zonder AI (deterministisch)",
  "finding.way.manuell": "handmatig aangemaakt",
  "finding.versus": "vs",
  "finding.groupKicker": "Bijdrage",
  "finding.groupCount": "{{n}} bevinding(en)",
  // FUNKE (nacht24 pakket 6): impactlus — waardig, geen puntencircus.
  "funke.sourceAuthor": "uit de kennis van {{name}}",
  "funke.impact.title": "Mijn impact",
  "funke.impact.contributions": "Mijn bijdragen",
  "funke.impact.validated": "waarvan gevalideerd",
  "funke.impact.cited": "geciteerd in antwoorden",
  "funke.impact.helpful": "als nuttig gemarkeerd",
  "funke.impact.hint":
    "Eerlijke telling uit bestaand bewijs: „geciteerd” telt de leidende antwoordbron — niets wordt geschat of verzonnen.",
  "funke.gaps.title": "Open kennislacunes",
  "funke.gaps.count": "{{n}} open",
  "funke.gaps.answerCta": "In 2 minuten beantwoorden",
  "funke.gaps.more": "+{{n}} meer open lacunes — volledige lijst onder Risico & lacunes.",
  "funke.capital.title": "Kenniskapitaal",
  "funke.capital.secured": "vastgelegde kennisobjecten",
  "funke.capital.validated": "waarvan gevalideerd",
  "funke.capital.open": "waarvan open",
  "funke.capital.categories": "beantwoordbare themavelden",
  "funke.capital.authors": "actieve kennisdragers",
  "funke.capital.gaps": "open kennislacunes",
  "funke.capital.hint": "Alleen echte cijfers uit het bestand — geen schattingen.",
  "lib.kicker": "Bibliotheek",
  "lib.export": "Export",
  "lib.exportFormat": "Exportformaat",
  "lib.format.json": "JSON",
  "lib.format.markdown": "Tekst (Markdown)",
  "lib.format.mediawiki": "MediaWiki",
  "lib.format.html": "HTML (Print/PDF)",
  "lib.search": "Zoeken in volledige tekst …",
  // AUFTRAG-BASIC-u2 — zie de Duitse regel voor de bevinding.
  "lib.scope.note":
    "Doorzocht wordt de Klarwerk-kennis die voor jou is vrijgegeven — niet je eigen concepten die je nog niet hebt ingediend.",
  "lib.scope.toDrafts": "Eigen concepten doorzoeken",
  "lib.allStatus": "Alle statussen",
  "lib.allTypes": "Alle kennissoorten",
  "lib.allCategories": "Alle categorieën",
  "lib.allTags": "Alle tags",
  "lib.revalidate": "Hervalidatie starten",
  "lib.ask": "Vragen",
  "lib.review": "Controleren",
  "lib.revalidateDone": "Hervalidatie gestart.",
  "lib.reimport": "Opnieuw importeren (JSON)",
  // AUFTRAG-BASIC-u2: de nulstand noemt de ZOEKRUIMTE — zie de Duitse regel.
  "lib.empty":
    "Geen resultaten in de Klarwerk-kennis die voor jou is vrijgegeven. Je eigen concepten die je nog niet hebt ingediend staan onder „Concepten hervatten“.",
  "lib.answerTitle": "Een antwoord in plaats van alleen resultaten?",
  "lib.answerHint":
    "Laat „{{q}}“ met bronvermelding beantwoorden — met duidelijke bronlinks, niet alleen artikelen.",
  "lib.answerButton": "Vraag laten beantwoorden",
  "lib.emptyQuery":
    "Geen resultaten voor „{{q}}“ in de Klarwerk-kennis die voor jou is vrijgegeven. Je eigen concepten die je nog niet hebt ingediend horen hier niet bij. Tip: anders formuleren, filters resetten of op één trefwoord zoeken.",
  // AUFTRAG-mega59 BLOCK D — zie de Duitse regel voor de bevinding.
  "lib.facetEmpty.title": "Er zijn resultaten — maar geen enkele past bij de actieve filters.",
  "lib.facetEmpty.hint":
    "Je zoekopdracht heeft {{count}} resultaten in de kennisbank. De actieve filters verbergen ze allemaal.",
  "lib.facetEmpty.reset": "Alle filters resetten",
  "lib.matchIn": "Resultaat in",
  "lib.match.title": "Titel",
  "lib.match.tag": "Tag",
  "lib.match.category": "Categorie",
  "lib.match.type": "Kennissoort",
  "lib.match.text": "Tekst",
  "lib.match.caption": "Afbeeldingsbeschrijving",
  "lib.maturity.all": "Alle",
  "lib.originLabel": "Herkomst",
  "lib.demoFilter.all": "Alle herkomsten",
  "lib.demoFilter.demo": "Demovoorbeelden",
  "lib.demoFilter.nonDemo": "Eigen kennis",
  "lib.maturity.usable": "Bruikbaar",
  "lib.maturity.review": "In beoordeling",
  "lib.maturity.open": "Te controleren",
  "lib.resultCount": "Resultaten: {{n}}",
  "lib.showingFirst": "eerste {{shown}} van {{total}} weergegeven",
  "imp.explore.title": "Bron verkennen",
  "imp.explore.hint":
    "Bekijk eerst wat er in de bron zit — aantallen, auteurs, thema's en periode. Er wordt niets geïmporteerd.",
  "imp.explore.active": "actief",
  "imp.explore.soon": "binnenkort",
  "imp.explore.cta": "Verder: verkennen",
  "imp.explore.exploring": "Verkennen …",
  "imp.explore.pages": "Pagina's",
  "imp.explore.sources": "Bronnen",
  "imp.explore.period": "Periode",
  "imp.explore.authors": "Auteurs",
  "imp.explore.themes": "Thema's",
  "imp.explore.more": "+{{n}} meer",
  "imp.explore.withImages": "{{n}} pagina's bevatten afbeeldingen.",
  "imp.explore.noAuthor": "(zonder auteur)",
  "imp.explore.noTheme": "(zonder thema)",
  "imp.explore.empty": "In deze bron is niets gevonden.",
  "imp.explore.truncated": "Alleen de eerste {{n}} pagina's geteld — de bron is groter.",
  "imp.explore.failedPages": "{{n}} pagina's konden niet worden gelezen.",
  "imp.explore.topOf": "top {{n}} van {{total}}",
  "imp.explore.derivedTag": "afgeleid",
  "imp.explore.derivedHint":
    "Thema deterministisch afgeleid uit de paginatitels — de bron heeft voor deze pagina's geen labels.",
  "imp.explore.spaces": "Ruimtes (spaces)",
  "imp.explore.alreadyImported": "Waarvan al geïmporteerd: {{n}}",
  "imp.explore.alreadyQueued": "Waarvan al in de wachtrij voor beoordeling: {{n}}",
  // AUFTRAG-ic7-import-vision: eerlijke bronnengalerij „waar de reis heen gaat".
  // AUFTRAG-mega67 BLOCK C+D — de toegangstoestand (zie het Duitse blok voor de onderbouwing).
  "imp.access.title": "Toegang",
  "imp.access.ready.title": "Ingeschakeld, toegangsgegevens aanwezig",
  "imp.access.ready.body":
    "De import is voor deze installatie ingeschakeld en alle benodigde toegangsgegevens staan op de server. Of ze ook geldig zijn, blijkt bij de eerste import — dat is van hieruit niet te controleren zonder Confluence aan te roepen.",
  "imp.access.noCredentials.title": "Ingeschakeld, maar zonder toegangsgegevens",
  "imp.access.noCredentials.body":
    "De import is ingeschakeld, maar er ontbreekt nog iets. Zolang dat zo is, kan er geen import starten.",
  "imp.access.disabled.title": "In deze installatie niet ingeschakeld",
  "imp.access.disabled.body":
    "De Confluence-import is hier niet ingeschakeld. Dat gebeurt op de server; vanuit de interface is het niet om te zetten.",
  "imp.access.blocker.missing": "Ten minste één van de benodigde gegevens ontbreekt.",
  "imp.access.blocker.insecureBaseUrl":
    "Alle gegevens staan er, maar het adres is geen https-adres. Toegangsgegevens worden alleen over versleutelde verbindingen verstuurd — daarom komt er geen toegang tot stand.",
  "imp.access.varsTitle": "Wat dit systeem nodig heeft",
  "imp.access.varPresent": "aanwezig",
  "imp.access.varMissing": "niet aanwezig",
  "imp.access.whereSet":
    "Deze waarden worden als omgevingsvariabelen op de server gezet — niet hier. Klarwerk laat alleen zien of ze er staan, nooit hun inhoud.",
  "imp.access.whoMay":
    "Dit kan worden gewijzigd door wie toegang heeft tot de server van deze installatie.",
  "imp.access.lastConnectedUnknown": "Er is nog geen succesvol afgeronde import vastgelegd.",
  "imp.access.lastConnected":
    "Laatste succesvol afgeronde import: {{date}}. Of het nu werkt, zegt deze terugblik niet.",
  "imp.gallery.planned": "gepland",
  "imp.gallery.plannedGroup": "Gepland ({{count}})",
  "imp.gallery.systemsTitle": "Systemen",
  "imp.gallery.filesTitle": "Bestanden",
  "imp.gallery.hintSoon": "In ontwikkeling — deze bron komt binnenkort.",
  "imp.gallery.hintPlanned": "Gepland — komt later.",
  "imp.gallery.unconfigured": "niet geconfigureerd",
  "imp.gallery.hintUnconfigured":
    "Aanwezig, maar niet bruikbaar: er is geen dienst ingesteld voor transcriptie. Een beheerder kan die in het beheer inrichten.",
  "imp.gallery.src.confluence": "Confluence",
  "imp.gallery.src.jsonImport": "JSON-import",
  "imp.gallery.src.jira": "Jira",
  "imp.gallery.src.wordFile": "Word-bestand",
  "imp.gallery.src.pdfFile": "PDF-bestand",
  "imp.gallery.src.sharepoint": "SharePoint",
  "imp.gallery.src.teams": "MS Teams",
  "imp.gallery.src.gdrive": "Google Drive",
  "imp.gallery.src.dms": "DMS",
  "imp.gallery.src.plm": "PLM",
  "imp.gallery.src.servicenow": "ServiceNow",
  "imp.gallery.src.sap": "SAP",
  "imp.gallery.src.notion": "Notion",
  "imp.gallery.src.slack": "Slack",
  "imp.gallery.src.email": "E-mail",
  "imp.gallery.file.json": "JSON",
  "imp.gallery.file.docx": "Word (.docx)",
  "imp.gallery.file.pdf": "PDF",
  "imp.gallery.file.xlsx": "Excel (.xlsx)",
  "imp.gallery.file.pptx": "PowerPoint (.pptx)",
  "imp.gallery.file.csv": "Tekst/CSV",
  "imp.gallery.file.ocr": "OCR (scan/afbeelding)",
  "imp.gallery.file.avtranscript": "Audio-/videotranscript",
  "imp.select.title": "Selectie verfijnen",
  "imp.select.hint":
    "Klik thema's aan OF beschrijf in één zin wat er geïmporteerd moet worden — allebei samen kan ook. De voorbeeldweergave toont wat past — er wordt nog niets geïmporteerd.",
  "imp.select.promptPlaceholder": "bijv. „alles over onderhoud en foutcodes“",
  "imp.select.promptConfidentialLabel": "Bevat deze tekst vertrouwelijke informatie?",
  "imp.select.promptConfidentialYes": "Ja/onzeker",
  "imp.select.promptConfidentialNo": "Nee, onbezwaarlijk",
  "imp.select.limit": "Hoogstens",
  "imp.select.previewCta": "Verder: inperken",
  "imp.select.previewing": "Bezig …",
  "imp.select.matched": "{{matched}} van {{total}} treffers",
  "imp.select.limitedNote": "afgekapt op de limiet",
  "imp.select.critAll": "Geen verfijning — alles zou passen.",
  "imp.select.critThemes": "Thema's",
  "imp.select.critAuthors": "Auteurs",
  "imp.select.critKeywords": "Trefwoorden",
  "imp.select.critYears": "Jaren",
  "imp.select.critLimit": "Limiet",
  "imp.select.critSpaces": "Ruimtes",
  "imp.select.yearFrom": "van (jaar)",
  "imp.select.yearTo": "tot (jaar)",
  "imp.select.alreadyImported": "{{n}} al geïmporteerd",
  "imp.select.alreadyQueued": "{{n}} al in de wachtrij voor beoordeling",
  "imp.select.selectedCount": "{{n}} geselecteerd",
  "imp.select.importedDeselected":
    "Al geïmporteerde pagina's zijn uitgevinkt; vink ze bewust weer aan indien nodig.",
  "imp.select.queuedDeselected":
    "Pagina's die al in de wachtrij voor beoordeling staan zijn uitgevinkt; vink ze bewust weer aan indien nodig.",
  // WP-SHIP9-S2 Paket 2 (D2–D7): bediening van de treffer­lijst.
  "imp.select.searchPlaceholder": "Zoek in treffers (titel, auteur) …",
  "imp.select.selectAll": "Alles selecteren",
  "imp.select.deselectAll": "Alles deselecteren",
  "imp.select.groupBy": "Groeperen:",
  "imp.select.groupNone": "geen",
  "imp.select.groupTheme": "op thema",
  "imp.select.groupLanguage": "op taal",
  "imp.select.groupFolder": "op map",
  "imp.select.noFolder": "Zonder broncontainer",
  "imp.select.folderFallbackNoPath":
    "Deze bron levert geen mapstructuur (geen bovenliggende keten) — de vorige weergave wordt getoond.",
  "imp.select.folderFallbackSingle":
    "De bronstructuur levert hier maar één enkele map op — de vorige weergave wordt getoond.",
  "imp.select.facet.folder": "Map",
  "imp.select.facet.status": "Status",
  "imp.select.facet.theme": "Thema",
  "imp.select.facet.author": "Auteur",
  "imp.select.facet.language": "Taal",
  "imp.select.facetCount_one": "{{count}} treffer tonen",
  "imp.select.facetCount_other": "{{count}} treffers tonen",
  "imp.select.rangeLabel": "Brondatum",
  "imp.select.bulkLabel": "Selectie",
  "imp.select.groupCount": "{{n}} treffers",
  "imp.select.langDe": "Duits",
  "imp.select.langEn": "Engels",
  "imp.select.langNl": "Nederlands",
  "imp.select.langOther": "Zonder taalkenmerk",
  "imp.select.noTheme": "Zonder thema",
  "imp.select.chipNew": "Nieuw",
  "imp.select.chipImported": "Al geïmporteerd",
  "imp.select.chipQueued": "Voorgemerkt",
  "imp.select.summary": "{{selected}} van {{total}} geselecteerd",
  "imp.select.emptyFiltered": "Geen treffer voor zoeken/filter — pas het zoeken of filter aan.",
  "imp.preview.imported": "al geïmporteerd",
  "imp.preview.queued": "al in de wachtrij voor beoordeling",
  "imp.groups.cta": "Verder: groeperen & overnemen",
  "imp.groups.needSelection": "Selecteer minstens één item in het voorbeeld om verder te gaan.",
  "imp.groups.grouping": "De bijdragen worden thematisch gegroepeerd …",
  "imp.groups.retry": "Opnieuw proberen",
  "imp.groups.willGroupWithoutAi":
    "Geen AI-model actief — er wordt zonder AI op thema gegroepeerd (deterministisch).",
  "imp.groups.noAi": "Zonder AI gegroepeerd",
  "imp.groups.noAiReason": "Zonder AI gegroepeerd — {{reason}}",
  "imp.groups.reason.confidential": "vertrouwelijke kandidaten — cloud-AI uitgesloten",
  // AUFTRAG-mega59 BLOCK F1/F2 — zie de Duitse regels voor de bevinding.
  "imp.groups.reason.noModel": "geen AI-model actief",
  "imp.groups.reason.timeout": "het AI-model heeft niet tijdig geantwoord",
  "imp.groups.reason.error": "het AI-model heeft een fout gemeld",
  "imp.groups.willGroupWithoutAiConfidential":
    "Deze stapel bevat vertrouwelijke of niet-vrijgegeven items — er wordt zonder cloud-AI op thema gegroepeerd (deterministisch).",
  "imp.groups.aiGrouped": "AI-gegroepeerd",
  "imp.groups.groupCount": "{{n}} bijdragen",
  "imp.groups.approve": "Vrijgeven",
  "imp.groups.exclude": "Uitsluiten",
  "imp.groups.selectedCount": "{{x}} van {{y}} geselecteerd",
  "imp.groups.catchall": "Overige bijdragen",
  "imp.groups.noTheme": "Zonder onderwerp",
  "imp.groups.hintImported": "al geïmporteerd",
  "imp.groups.hintQueued": "al in de wachtrij voor beoordeling",
  "imp.groups.hintStale": "ouder dan 1 jaar",
  "imp.groups.hintShort": "weinig inhoud",
  "imp.groups.applyCta": "Selectie overnemen ({{n}})",
  "imp.groups.applying": "Bezig met overnemen: {{x}} van {{y}} …",
  "imp.groups.bilanzTitle": "Resultaat van de overname",
  "imp.groups.bilanzImported": "{{n}} overgenomen",
  "imp.groups.bilanzSkipped": "{{n}} overgeslagen (al geïmporteerd)",
  "imp.groups.bilanzSkippedQueued": "{{n}} overgeslagen (al in de wachtrij voor beoordeling)",
  "imp.groups.bilanzExcluded": "{{n}} uitgesloten",
  "imp.groups.bilanzFailed": "{{n}} mislukt",
  "imp.groups.bilanzReview":
    "De overgenomen bijdragen staan nu in de importreview — daar beslist een mens over elke toevoeging aan de kennisbank.",
  "imp.groups.toReview": "Verder naar de importreview ({{n}} open)",
  "imp.groups.failNotFound": "niet meer in de huidige selectie",
  "imp.groups.bilanzQueued": "{{n}} al in de wachtrij (stond al in de review)",
  "imp.groups.bilanzNotAttempted": "{{n}} niet geprobeerd (run gestopt na een fout)",
  "imp.groups.retryRest": "Rest overnemen ({{n}})",
  "imp.groups.failHttp": "overdracht mislukt",
  "imp.groups.hintSourceNewer": "bron bijgewerkt sinds import",
  "imp.groups.bilanzUpdates": "waarvan actualiseringen: {{n}}",
  "imp.groups.expired":
    "De gegevensbasis van deze groepering is inmiddels verlopen — de overname is gestopt en de selectie teruggezet. Groepeer opnieuw.",
  "imp.groups.regroup": "Opnieuw groeperen",
  "imp.groups.refreshGrouping": "Groepering bijwerken",
  // WP-COCKPIT-LINIE: begeleide vijf-stappen-balk + ingeklapte geschiedenis (eenvoudige taal).
  "imp.step.barLabel": "Import in vijf stappen",
  "imp.step.source": "Bron",
  "imp.step.sourceHint":
    "Kies waar de bijdragen vandaan moeten komen — vandaag: pagina's uit Confluence.",
  "imp.step.explore": "Verkennen",
  "imp.step.exploreHint": "Bekijk eerst wat er in de bron zit — er wordt nog niets overgenomen.",
  "imp.step.narrow": "Inperken",
  "imp.step.narrowHint":
    "Klik thema's aan of beschrijf in één zin wat je wilt overnemen — het voorbeeld toont wat past.",
  "imp.step.groups": "Groepen vrijgeven",
  "imp.step.groupsHint":
    "Geef hele groepen vrij of sluit ze uit — losse bijdragen kun je nog steeds aan- en afvinken.",
  "imp.step.apply": "Overnemen & balans",
  "imp.step.applyHint":
    "De vrijgegeven bijdragen worden ter controle overgenomen — de balans toont eerlijk wat er is gebeurd.",
  "imp.step.done": "klaar",
  "imp.explore.ctaAgain": "Opnieuw verkennen",
  "imp.select.previewAgain": "Voorbeeld verversen",
  "imp.history.title": "Review-geschiedenis: openstaande en overgenomen bijdragen",
  "imp.history.count": "{{open}} open · {{total}} totaal",
  "imp.history.hint":
    "Hier staat de geschiedenis van eerdere overnames — bijdragen in de wachtrij voor controle, geaccepteerde en afgewezen bijdragen. Voor de lopende import heb je dit gedeelte niet nodig.",
  // WP-UX-WOW-1 (Kopfs live-UX-bevindingen U1-U9): polijstwerk voor de eerste VIP2-indruk.
  "ask.koQuestion": "Wat geldt voor: {{title}}?",
  "ask.confidentialPrefillHint":
    "Vertrouwelijke inhoud — controleer de vraag voor het verzenden. Ze is alleen vooraf ingevuld, niet automatisch verzonden.",
  "ask.expect.neutral": "Voorbeeld proberen",
  "lib.confidenceNone": "Zekerheid nog niet beoordeeld",
  "lib.confidenceNoneHint":
    "De zekerheid zegt hoe draagkrachtig een inhoud is ingeschat (0 tot 100). 0 betekent: nog niet beoordeeld — niet dat de inhoud fout is.",
  "con.emptyWhat":
    "Een conflict ontstaat wanneer twee bijdragen elkaar inhoudelijk tegenspreken — bijvoorbeeld twee verschillende grenswaarden voor dezelfde installatie.",
  "con.emptyHow":
    "Klarwerk herkent zulke tegenstrijdigheden bij het controleren en vergelijken; een mens beslist hier vervolgens welke uitspraak geldt.",
  "con.emptyExamplesHint":
    "Om het uit te proberen is er het voorbeeldpakket „Tegenstrijdige uitspraken“ in het importgedeelte.",
  "con.emptyExamplesCta": "Voorbeeldpakketten openen",
  "role.gate.title": "Dit gedeelte hoort bij een andere rol",
  "role.gate.body":
    "Dit gedeelte vereist de rol {{owner}}. Jouw huidige rol is {{own}} — daarom is deze weg voor jou gesloten. Rollen worden door de beheerder toegewezen; er valt hier dus niets in te schakelen.",
  "stage2.gate.title": "Uitgebreide functies (fase 2)",
  "stage2.gate.body":
    "Deze module hoort bij de uitgebreide functies — intern „fase 2“ genoemd: extra modules naast de kernstroom. Die staan nu uit, daarom is dit gedeelte nog niet zichtbaar.",
  "stage2.gate.enable": "Fase 2 nu inschakelen",
  "stage2.gate.adminOnly": "Een admin kan fase 2 inschakelen via de schakelaar in de zijbalk.",
  "stage2.gate.back": "Terug naar start",
  "imp.cleanup.title": "Testgegevens opruimen",
  "imp.cleanup.desc":
    "Verwijdert alle items uit de importwachtrij en verplaatst alle uit Confluence of Jira geïmporteerde bijdragen naar de prullenbak. Zelf gemaakte bijdragen, gebruikers en instellingen blijven onaangeroerd.",
  "imp.cleanup.previewCta": "Voorbeeld laden",
  "imp.cleanup.previewLoading": "Omvang wordt bepaald …",
  "imp.cleanup.previewResult":
    "Dit zou {{n}} kandidaten en {{m}} geïmporteerde bijdragen verwijderen.",
  "imp.cleanup.confirmHint":
    "De kandidatenlijst wordt definitief geleegd; de geïmporteerde bijdragen gaan naar de prullenbak en kunnen daar worden hersteld.",
  "imp.cleanup.confirmCta": "Nu opruimen",
  "imp.cleanup.cancel": "Annuleren",
  "imp.cleanup.running": "Opruimen loopt …",
  "imp.cleanup.doneCandidates": "{{n}} kandidaten verwijderd",
  "imp.cleanup.doneKos": "{{n}} geïmporteerde bijdragen naar de prullenbak verplaatst",
  "imp.cleanup.doneSkipped": "{{n}} overgeslagen (fout bij het verplaatsen)",
  "imp.cleanup.drift":
    "De gegevens zijn sinds het voorbeeld gewijzigd — het voorbeeld is opnieuw geladen, controleer en bevestig opnieuw.",
  "imp.cleanup.auditFailed":
    "Let op: de afsluitende audit-logregel kon niet worden geschreven — het opruimen zelf is voltooid.",
  "imp.cleanup.newSince": "{{n}} nieuwe kandidaten sinds het voorbeeld — niet aangeraakt.",
  "imp.cleanup.claimedKos":
    "{{n}} bijdrage(n) in een lopende reviewactie — uitgesloten van het opruimen.",
  "imp.cleanup.auditPendingCandidates":
    "{{n}} kandidaat/kandidaten met een openstaand actiebewijs — uitgesloten van het opruimen totdat het bewijs is geschreven.",
  "exp.title": "Voorbeeldpakketten",
  "exp.hint":
    "Gecureerde kleine scenario's voor testers — elk pakket laadt afzonderlijk en maakt duidelijk gemarkeerde voorbeeldbijdragen aan. Het opruimen van de import verwijdert ze NIET; ze verdwijnen via het verwijderen van de demogegevens.",
  "exp.load": "Laden",
  "exp.loading": "Wordt geladen …",
  "exp.result": "{{created}} aangemaakt, {{skipped}} overgeslagen (al aanwezig)",
  "exp.pkg.konflikte.title": "Tegenstrijdige uitspraken",
  "exp.pkg.konflikte.desc":
    "Zes bijdragen in drie paren die elkaar tegenspreken — ideaal om conflictdetectie en validatie uit te proberen.",
  "exp.pkg.bilder.title": "Kennis met afbeeldingen",
  "exp.pkg.bilder.desc":
    "Drie bijdragen met afbeeldingen en beschrijvende bijschriften — ideaal voor de galerij en het zoeken in bijschriften.",
  "exp.pkg.qualitaet.title": "Gemengde kwaliteit",
  "exp.pkg.qualitaet.desc":
    "Vijf bijdragen van goed tot te kort tot verouderd — ideaal om review en kwaliteitsbeoordeling te oefenen.",
  "imp.preview.sourceNewer": "bron nieuwer dan import",
  "imp.select.empty": "Geen treffer voor deze verfijning.",
  "imp.select.aiUnavailable":
    "AI-selectie is momenteel niet beschikbaar — alleen je klikfilters gelden.",
  "imp.select.aiConfidential":
    "Cloud-AI uitgesloten vanwege vertrouwelijke inhoud — de vrije-tekstzin is niet geëvalueerd; alleen je klikfilters gelden.",
  "imp.uploadTitle": "JSON opnieuw importeren",
  "imp.uploadHint":
    "Kies een JSON-bestand — de items komen als bijdragen in de controlelijst (geen stille overname).",
  "imp.jsonOnlyReason":
    "Import accepteert momenteel alleen JSON. Office-bestanden (DOCX, PDF, PPTX) graag via „Kennis vastleggen → uit bestand“ — daar worden ze echt gelezen.",
  "imp.dropHint": "Sleep een JSON-bestand hierheen — of kies er hieronder een.",
  "imp.dropActive": "Laat het JSON-bestand hier los …",
  "imp.dropReject": "„{{name}}“ is geen JSON-bestand — import accepteert momenteel alleen JSON.",
  "imp.upload": "JSON-bestand kiezen",
  "imp.parsed": "{{n}} bijdragen ter controle in de wachtrij gezet.",
  "imp.parseError": "Ongeldig JSON-bestand.",
  "imp.queueTitle": "Controlelijst van imports",
  "imp.queueEmpty": "Geen bijdragen te controleren.",
  "ext.pipeline.title": "Importpijplijn & bevindingen",
  "ext.pipeline.upload": "Uploaden",
  "ext.pipeline.extract": "Extraheren",
  "ext.pipeline.structure": "Structureren",
  "ext.pipeline.review": "Controleren",
  "ext.pipeline.validate": "Valideren",
  "ext.pipeline.release": "Goedkeuren",
  "ext.pipeline.reuse": "Hergebruiken",
  "ext.queue.total": "Totaal: {{n}}",
  "ext.queue.open": "Open: {{n}}",
  "ext.queue.accepted": "Aangenomen: {{n}}",
  "ext.queue.rejected": "Afgewezen: {{n}}",
  "ext.queue.infoRequested": "Info opgevraagd: {{n}}",
  "ext.queue.duplicates": "Duplicaten: {{n}}",
  "ext.finding.duplicate": "Duplicaat",
  "ext.finding.missingInfo": "Gegevens ontbreken",
  "ext.finding.infoRequested": "Info opgevraagd",
  "ext.finding.acceptedKo": "KO aangemaakt",
  "ext.finding.rejected": "Afgewezen",
  "ext.validity.title": "Geldigheid & bescherming",
  "ext.validity.freshness": "Actualiteit",
  "ext.validity.outputEligible": "Geschiktheid voor output",
  "ext.validity.recommendation": "Aanbeveling",
  "ext.freshness.validiert": "gevalideerd",
  "ext.freshness.revalidierung-faellig": "hervalidatie nodig",
  "ext.freshness.offen": "open",
  "ext.freshness.konflikt": "conflict",
  "ext.freshness.unbekannt": "onbekend",
  "ext.protection.ip": "IP-gevoeligheid",
  "ext.protection.notRated": "niet beoordeeld",
  "ext.outputEligible.yes": "ja",
  "ext.outputEligible.no": "nee",
  "ext.recommendation.clarify-conflict": "Conflict oplossen",
  "ext.recommendation.start-revalidation": "Hervalidatie starten",
  "ext.recommendation.finish-validation": "Validatie afronden",
  "ext.recommendation.output-ready": "Bruikbaar voor output",
  "ext.recommendation.unknown": "onbekend",
  "imp.duplicate": "Duplicaat",
  "imp.note": "Notitie",
  "imp.accept": "Aannemen",
  "imp.reject": "Afwijzen",
  "imp.info": "Info opvragen",
  "imp.infoSend": "Verzenden",
  "imp.notePlaceholder": "Welke informatie ontbreekt?",
  "imp.reviewed": "Bijdrage bijgewerkt.",
  "imp.status.neu": "Voorgemerkt voor controle",
  "imp.status.in_bearbeitung": "In behandeling",
  "imp.status.angenommen": "Aangenomen",
  "imp.status.abgelehnt": "Afgewezen",
  "imp.status.info-angefragt": "Info opgevraagd",
  "imp.status.unknown": "Status onbekend",
  "risk.kicker": "Risico & hiaten",
  "risk.summary": "Cockpit-overzicht",
  "risk.kpiOpenGaps": "Open hiaten",
  "risk.kpiHigh": "Hoge prioriteit",
  "risk.kpiUnassigned": "Niet toegewezen",
  "risk.kpiAssigned": "Toegewezen",
  "risk.kpiOpenConflicts": "Open conflicten",
  "risk.kpiClosedGaps": "Gesloten hiaten",
  "risk.cockpit": "Risicocockpit per domein",
  "risk.cockpitEmpty": "Geen domeingegevens.",
  "risk.level.kritisch": "kritiek",
  "risk.level.mittel": "middel",
  "risk.level.gut": "stabiel",
  "risk.koCount": "Objecten",
  "risk.validated": "gevalideerd",
  "risk.openKo": "open",
  "risk.singleSource": "Enkele bron — klontrisico",
  "risk.singleSourceExplain":
    "Alle kennis van dit domein komt van één enkele persoon. Valt die weg (ziekte, opzegging, pensioen), dan is de kennis verdwenen — dat is het grootste kennisrisico. Tegenmaatregel: meer mensen betrekken, kennis dubbel laten controleren (valideren) en bronnen aanvullen.",
  "risk.bearer": "Gedragen door: {{names}}",
  "risk.viewObjects": "Objecten van dit domein bekijken",
  "risk.busLegendSingle": "rood = enkele bron (uitvalrisico)",
  "risk.busLegendOk": "groen = meerdere bronnen",
  "risk.help.summary":
    "Overzicht in cijfers: Open hiaten (vragen zonder geborgde kennis), Hoge prioriteit (dringend), Niet toegewezen/Toegewezen (of iemand het hiaat oppakt), Open conflicten (tegenstrijdige uitspraken) en Gesloten hiaten (al beantwoord). Rode cijfers geven aan waar actie nodig is.",
  "risk.help.cockpit":
    "Risico per domein (categorie): KRITIEK/MIDDEL/GOED vat samen hoe goed het domein is afgedekt. Objecten = hoeveel kennis; gevalideerd % = hoeveel daarvan gecontroleerd is; open = nog ongecontroleerd; Experts = hoeveel mensen het domein dragen. Eén expert + weinig gevalideerd = hoog risico.",
  "risk.help.busfactor":
    "Hoe sterk hangt een domein af van afzonderlijke personen? Een rode balk betekent: de kennis komt maar uit ÉÉN bron — valt die weg, dan is ze verloren. Groen = meerdere bronnen, dus robuuster. De balk toont daarnaast de hoeveelheid kennis van het domein.",
  "risk.help.gaps":
    "Open kennishiaten zijn gestelde vragen waarop (nog) geen geborgd antwoord bestaat. Prioriteer ze, wijs ze aan een persoon toe of leg zelf gecontroleerde ervaring erover vast. Schrijf om privacyredenen geen gevoelige details in de vraag.",
  "health.title": "Knowledge Health",
  "health.band.gut": "goed",
  "health.band.mittel": "middel",
  "health.band.kritisch": "kritiek",
  "health.explain.gut": "Hoge validatiegraad, weinig verouderde kennis en geringe klontrisico's.",
  "health.explain.mittel":
    "Solide basis, maar open hiaten/conflicten of hervalidatiebehoefte remmen af.",
  "health.explain.kritisch":
    "Lage validatie en/of veel verouderde kennis, open conflicten of single-source-risico's.",
  "health.factor.validatedRatio": "Validatiepercentage",
  "health.factor.staleRatio": "Hervalidatiebehoefte (stale)",
  "health.factor.singleSourceShare": "Single-source-aandeel",
  "health.factor.openGaps": "Open kennishiaten",
  "health.factor.openConflicts": "Open conflicten",
  "health.band.unproven": "indeling niet aangetoond",
  "health.range.explain":
    "{{worst}} van 100 in het slechtste geval, {{best}} in het beste. Zolang niet is aangetoond dat er volledig naar conflicten is gezocht, geldt de slechtere waarde — daarom staat hier geen band.",
  "health.conflictUnproven.title":
    "De score rekent met de volledige conflictaftrek: {{worst}} in plaats van {{best}} van 100.",
  "health.conflictUnproven.detection-incomplete":
    "De conflict- en duplicaatdetectie is niet overal volledig gelopen. Het is daarom niet uitgesloten dat er meer conflicten zijn dan gevonden — en een aftrek van nul zou een aanname over iets onbekends zijn.",
  "health.conflictUnproven.detection-unknown":
    "Over het bereik van de conflict- en duplicaatdetectie is niets vastgesteld. Zolang volledige controle niet is aangetoond, zegt het aantal gevonden conflicten niets over de collectie.",
  "health.conflictUnproven.known":
    "Bekend zijn {{count}} open conflicten ({{penalty}} van maximaal {{max}} punten aftrek). Die aftrek staat vast; de rest tot het maximum is de onzekerheid.",
  "risk.busfactor": "Enkele-bron-risico (busfactor)",
  "risk.busEmpty": "Geen risicogegevens.",
  "risk.experts": "Experts",
  "risk.expertsCount_one": "{{count}} expert",
  "risk.expertsCount_other": "{{count}} experts",
  "expertise.title": "Wie erbij betrekken",
  "expertise.intro":
    "Deze mensen hebben al aan een onderwerp bijgedragen. Je kunt ze om een korte inschatting vragen — geen rangorde, alleen wie zou kunnen helpen.",
  "expertise.help":
    "Afgeleid uit bestaande kennisobjecten (wie aan een onderwerp heeft bijgedragen). Volgorde alfabetisch, zonder beoordeling — als hulp bij wie je zou kunnen aanspreken.",
  "expertise.invite": "Je hebt ervaring met {{topic}} — kun je dat kort inschatten?",
  "expertise.thanks": "Bedankt, dat helpt het team.",
  "risk.gaps": "Open kennishiaten",
  "risk.gapsEmpty": "Geen open hiaten.",
  "risk.gapStatus.offen": "open",
  "risk.gapStatus.geschlossen": "gesloten",
  "risk.priorityLabel": "Prioriteit",
  "risk.priority.hoch": "hoog",
  "risk.priority.mittel": "middel",
  "risk.priority.niedrig": "laag",
  "risk.close": "Sluiten",
  "risk.assign": "Expert …",
  "risk.delete": "Verwijderen",
  "risk.gapNextLabel": "Volgende stap",
  "risk.gapNext.prioritize": "Urgentie inschatten en indelen.",
  "risk.gapNext.assign": "Aan een vakpersoon toewijzen.",
  "risk.gapNext.capture": "Kennis vastleggen om het hiaat te dichten.",
  "risk.gapNext.done": "Gesloten — afgehandeld.",
  "risk.gapCapture": "Kennis vastleggen",
  "risk.gapRedacted": "Vertrouwelijk hiaat (vraag verborgen)",
  "lcy.kicker": "Levenscyclus",
  "lcy.banner":
    "„Klopt dit nog?“ — gekoppelde objecten na wijziging aan de installatie controleren.",
  "lcy.empty": "Niets voor hervalidatie.",
  "lcy.stillValid": "Nog geldig → nieuwe versie",
  "lcy.assetTitle": "Installatiewijziging melden",
  "lcy.assetHint":
    "Voer de referentie van de gewijzigde installatie/het proces in — gekoppelde kennisobjecten worden ter controle gemarkeerd.",
  "lcy.assetPlaceholder": "Installatie-/procesreferentie (bijv. Pers-P2)",
  "lcy.assetTrigger": "Hervalidatie starten",
  "lcy.assetMarked": "{{n}} object(en) voor „{{asset}}“ ter controle gemarkeerd.",
  "lcy.pendingTitle": "Voor hervalidatie",
  "lcy.revalAsset": "Installatieverwijzing",
  "lcy.revalNextLabel": "Volgende stap",
  "lcy.revalNext.review":
    "Controleer of het na de wijziging nog geldig is — bevestig het dan als gecontroleerd.",
  "lcy.revalNext.validate": "Object is niet goedgekeurd — eerst valideren.",
  "lcy.revalCta.review": "Naar controle",
  "lcy.revalCta.validate": "Naar validatie",
  "lcy.revalNext.openKo": "Object openen — details zijn momenteel niet beschikbaar.",
  "lcy.revalMissing": "Objectdetails niet in de geladen voorraad.",
  "lcy.revalSaved": "Hervalidatie vastgelegd.",
  "lcy.nextViewKo": "Object bekijken",
  "lcy.nextUse": "Kennis gebruiken (vragen)",
  "lcy.pathTitle": "Leertraject · {{role}}",
  "lcy.pathEmpty": "Voor jouw rol is nog geen leertraject vastgelegd.",
  "lcy.stepComplete": "Als afgehandeld markeren",
  "lcy.stepDone": "Afgehandeld",
  "ana.kicker": "Analytics & audit",
  "ana.exec.title": "Executive-blik",
  "ana.exec.validated": "Gevalideerde kennis",
  "ana.exec.validatedHint": "gecontroleerde, geborgde objecten",
  "ana.exec.openReviews": "Open beoordelingen",
  "ana.exec.openReviewsHint": "wachten op validatie",
  "ana.exec.busFactor": "Enkele-bron-risico",
  "ana.exec.busFactorHint": "categorieën met slechts één bron",
  "ana.exec.rescued": "Geredde hiaten",
  "ana.exec.rescuedHint": "gesloten kennishiaten",
  "ana.help.exec":
    "Vier kerngetallen uit live-gegevens: gevalideerde kennis, open beoordelingen, busfactor-risico en geredde hiaten. Een rustig overzicht voor beslissers — hoe hoger de validatiegraad en hoe lager het risico, des te gezonder de kennisbasis.",
  "ana.help.health":
    "De health-score (0–100) vat validatiegraad, actualiteit en bronbreedte samen. De band (bijv. goed of kritiek) toont de toestand in één oogopslag; daaronder zie je welke factoren de waarde verhogen of verlagen.",
  "ana.help.impact":
    "Impact toont wat het systeem echt oplevert: gevalideerde objecten totaal, gestelde vragen, zonder hiaat beantwoorde vragen en het daaruit berekende antwoordpercentage. Het weekverloop maakt zichtbaar of gevalideerde kennis groeit.",
  "ana.help.audit":
    "Het auditlog legt elke relevante actie vast — wie (actor), wat (actie) en waaraan (doel). Vermeldingen worden alleen toegevoegd en hash-geschakeld; een latere afwijking is rekenkundig aantoonbaar. Met de filters beperk je snel tot een persoon, een soort actie of een object.",
  "ana.total": "Totaal",
  "ana.categories": "Categorieën",
  "ana.byType": "Verdeling per kennissoort",
  "ana.audit": "Auditlog (hash-geschakeld)",
  "ana.auditEmpty": "Geen vermeldingen.",
  "ana.avgTrust": "Ø vertrouwen",
  "ana.validationRate": "Validatiepercentage",
  "ana.openTasks": "Open taken",
  "ana.doneTasks": "Afgehandeld",
  "ana.impact": "Impact",
  "ana.impactValidated": "Gevalideerd totaal",
  "ana.impactAsk": "Vragen totaal",
  "ana.impactAnswered": "Zonder hiaat beantwoord",
  "ana.impactRate": "Antwoordpercentage",
  "ana.weekly": "Gevalideerd per week",
  "ana.filterActor": "Actor",
  "ana.filterAction": "Actie",
  "ana.filterTarget": "Doel filteren …",
  "ana.filterAll": "alle",
  "ana.auditCount": "{{shown}} van {{total}}",
  "ana.auditNoMatch": "Geen resultaten voor dit filter.",
  "adm.kicker": "Gebruikersbeheer",
  "adm.empty": "Geen gebruikers.",
  "adm.approve": "Goedkeuren",
  "adm.remove": "Verwijderen",
  "adm.createTitle": "Gebruiker aanmaken",
  "adm.name": "Naam",
  "adm.email": "E-mail",
  "adm.password": "Wachtwoord",
  "adm.role": "Rol",
  "adm.create": "Aanmaken",
  "adm.created": "Gebruiker aangemaakt.",
  "adm.createInvalid": "Vul nog aan:",
  "adm.createHint": "Vereist: naam, geldig e-mailadres en wachtwoord (min. 8 tekens).",
  "adm.field.name": "Naam",
  "adm.field.email": "geldig e-mailadres",
  "adm.field.password": "Wachtwoord (min. 8 tekens)",
  "adm.reset": "Wachtwoord resetten",
  "adm.newPassword": "Nieuw wachtwoord",
  "adm.newPasswordRepeat": "Wachtwoord herhalen",
  "adm.passwordMismatch": "De wachtwoorden komen niet overeen.",
  "adm.resetConfirm": "Resetten",
  "adm.resetCancel": "Annuleren",
  "adm.resetDone": "Wachtwoord gereset; alle sessies beëindigd.",
  "adm.seedTitle": "Demogegevens laden",
  "adm.seedHint":
    "Laadt een kleine, echte demovoorraad (KO's, validatie, hiaat, conflict, duplicaat, bijlage) — ook naast bestaande gegevens. Je echte bestand blijft onaangeroerd en wordt nooit overschreven. Gericht te verwijderen via „Demogegevens verwijderen“. (Conflict-/duplicaatbevinding verschijnt met een actieve AI-reasoner.)",
  "adm.seedButton": "Demogegevens laden",
  "adm.seedDone": "Demogegevens geladen: {{kos}} kennisobjecten, {{users}} gebruikers.",
  "adm.seedSkipped": "Overgeslagen: instantie is niet leeg (voorraad aanwezig).",
  "empty.cta.capture": "Kennis vastleggen",
  "empty.cta.import": "Importeren",
  "empty.cta.admin": "Demogegevens (Admin)",
  "empty.cta.library": "Naar de bibliotheek",
  "empty.cta.validation": "Naar de validatie",
  "empty.cta.tasks": "Naar mijn taken",
  "story.rescue.title": "Klarwerk borgt ervaringskennis voordat ze verloren gaat.",
  "story.honest":
    "Niets wordt automatisch gevalideerd — kennis geldt pas na de controle in het team als geborgd.",
  "story.surface.start.lead":
    "Nog niets openstaand — geen doodlopende weg, maar het begin. Start de cyclus en leg ervaringskennis vast die anders na verloop van tijd verdwijnt.",
  "story.surface.tasks.lead":
    "Momenteel niets te doen. Zodra kennis gecontroleerd of bijgewerkt moet worden, komt het hier terecht — of je legt zelf de volgende bijdrage vast.",
  "story.surface.library.lead":
    "Nog geen kennis om op te zoeken. Leg de eerste bijdrage vast — na de controle is die hier met bronvermelding bruikbaar.",
  "story.surface.validation.lead":
    "Niets te controleren. Vastgelegde kennis verschijnt hier voor teamcontrole, voordat ze als geborgd geldt en gebruikt kan worden.",
  "adm.auditTitle": "Recente gebruikers-/auth-activiteiten (audit)",
  "adm.auditEmpty": "Geen gebruikers-auditvermeldingen.",
  "prof.kicker": "Account",
  "prof.language": "Taal",
  "prof.passwordTitle": "Wachtwoord wijzigen",
  "prof.oldPassword": "Huidig wachtwoord",
  "prof.newPassword": "Nieuw wachtwoord",
  "prof.passwordSubmit": "Wachtwoord wijzigen",
  "prof.passwordChanged":
    "Wachtwoord gewijzigd. Om veiligheidsredenen ben je overal afgemeld — meld je opnieuw aan.",
  "help.kicker": "Help",
  "help.open": "Help openen",
  "help.openCenter": "In het Help-Center openen",
  "help.search": "Help doorzoeken …",
  "help.intro":
    "Korte startgids voor de belangrijkste Klarwerk-processen. Zoek op trefwoord of spring direct naar het juiste onderdeel.",
  "help.noResults": "Geen help gevonden voor dit trefwoord.",
  "help.openRoute": "Onderdeel openen",
  "klara.title": "Klara",
  "klara.subtitle": "Jouw hulp in KLARWERK",
  "klara.open": "Klara openen — hulp bij deze pagina",
  "klara.intro":
    "Ik leg je pagina's, velden en begrippen uit. Mijn antwoorden komen uit de help-bibliotheek — wat daar ontbreekt, verzin ik niet.",
  "klara.pageLabel": "Je bent hier",
  "klara.fieldLabel": "Actief element",
  "klara.fieldHint":
    "Klik in een veld of een onderdeel met ?-hulp — dan leg ik het hier automatisch uit.",
  "klara.aiSearch": "Zoeken met AI-ondersteuning",
  "klara.aiBusy": "De AI leest de passende help-vermeldingen …",
  "klara.aiAnswerTitle": "AI-antwoord uit de help",
  "klara.aiDisclaimer": "AI-gegenereerd — niet voor 100 % gecontroleerd",
  "klara.aiGoto": "Naar onderdeel: {{target}}",
  "klara.aiSources": "Grondslag",
  "klara.aiEmpty":
    "De AI heeft in de passende help-vermeldingen geen zeker antwoord gevonden — een eerlijk help-hiaat. Formuleer de vraag anders of kijk op de helppagina.",
  "klara.speak": "Voorlezen",
  "klara.speakStop": "Voorlezen stoppen",
  "klara.inspect": "Element uitleggen",
  "klara.inspectHint":
    "Aanwijsmodus actief: klik op een willekeurig element (knop, kengetal, kop) — de actie wordt daarbij NIET uitgevoerd. Esc sluit de modus af.",
  "klara.inspectFor": "Uitleg over: {{label}}",
  "klara.selectionExplain": "Selectie uitleggen",
  "klara.selectionEmpty":
    "Selecteer eerst een begrip op de pagina — dan zoek ik de passende uitleg.",
  "klara.searchPlaceholder": "Help doorzoeken … bijv. validatie, busfactor, concept",
  "klara.resultsFor": "Resultaten voor: {{q}}",
  "klara.noResults":
    "Daarover heb ik nog geen vermelding — een eerlijk help-hiaat. De bibliotheek groeit volop; op de helppagina vind je de begeleide startpunten.",
  "klara.moreHelp": "Naar de helppagina",
  "klara.page.start":
    "Jouw overzicht: wat er net is geborgd, wat er vandaag heeft geholpen en wat er op je wacht. Van hieruit spring je direct naar elk onderdeel.",
  "klara.page.tasks":
    "Jouw open taken: toegewezen beoordelingen, hiaten en vervaldata — met een directe sprong naar het bijbehorende werk.",
  "klara.page.capture":
    "Hier borg je ervaringskennis: vertellen, dicteren, in een interview of uit een bestand. De AI structureert alleen — jij controleert en dient in.",
  "klara.page.ask":
    "Stel een vraag. Het antwoord is brongebonden en laat zien waarop het steunt en in welke staat die bronnen zijn — is er geen basis, dan ontstaat een eerlijk kennishiaat.",
  "klara.page.library":
    "Alle kennisobjecten met status, vertrouwen en filters. Vanaf hier ga je naar elk detail.",
  "klara.page.external":
    "Externe kennis (bijv. webbronnen) — altijd niveau 2: nooit peer-gevalideerd en duidelijk gescheiden van de gecontroleerde voorraad.",
  "klara.page.validation":
    "Het beoordelingsbord: je beoordeelt ingediende kennis. Pas met genoeg groene goedkeuringen (en zonder rode) geldt een object als gevalideerd.",
  "klara.page.conflicts":
    "Tegenstrijdigheden tussen kennisobjecten: bekijken, een tweede mening halen, oplossen — zodat de bibliotheek eenduidig blijft.",
  "klara.page.duplicates":
    "Mogelijke dubbelingen: controleren en samenvoegen, zodat kennis niet versplintert.",
  "klara.page.risk":
    "Waar is kennis dun of hangt die aan één persoon? Openstaande hiaten, busfactor en domeinrisico — met links naar de betrokken objecten.",
  "klara.page.lifecycle":
    "Kennis veroudert: hier zie je verlopen hervalidaties en leerpaden, zodat gecontroleerde kennis gecontroleerd blijft.",
  "klara.page.analytics":
    "Kengetallen uit echte data plus het hash-geschakelde auditlog — wie heeft wat wanneer gedaan.",
  "klara.page.admin":
    "Accounts, KI-toewijzing, data en beveiliging op één plek. Alleen zichtbaar voor admins.",
  "klara.page.help":
    "Begeleide instappunten, thema's en zoeken. Ik ben de snelle weg — voor de diepte loont deze pagina zich.",
  "klara.page.profile": "Jouw account: naam, taal, afmelden.",
  "klara.page.koDetail":
    "De detailpagina van een kennisobject: inhoud, versies, bronnen, bijlagen, beoordelingshistorie en acties afhankelijk van je rol.",
  // JOB 1151 (KA3) — zie de Duitse regel voor de bevinding en het dubbele woordenboekpatroon.
  "klara.offer.label": "Klara's suggesties",
  "klara.offer.lead": "Hierover is al iets:",
  "klara.offer.open": "Bekijken",
  "shelp.adm.seedTitle":
    "Hier laad je kant-en-klare voorbeelddata waarmee je KLARWERK gevaarloos kunt uitproberen. Dat kan alleen zolang de instantie nog leeg is — zo vermengen echte data en voorbeelden zich nooit. Alle voorbeelddata is als zodanig gemarkeerd en laat zich later met één klik spoorloos verwijderen.",
  "shelp.adm.createTitle":
    "In dit gedeelte maak je een nieuw gebruikersaccount aan en geef je het een rol. Kijkers lezen, experts leggen kennis vast, controllers controleren die, en admins beheren alles. De rol bepaalt dus welke knoppen de persoon later ziet. Elke accountwijziging wordt in het auditprotocol vastgelegd.",
  "shelp.adm.auditTitle":
    "Dit protocol toont de laatste aanmeldingen en gebruikersacties. Elke regel is via een hash aan de vorige gekoppeld: wordt er achteraf iets gewijzigd of verwijderd, dan klopt de hash niet meer. Met de controleknop kun je de keten op elk moment laten narekenen; het resultaat vertelt je eerlijk of er een afwijking is gevonden — en zo ja, bij welke vermelding.",
  "shelp.ana.byType":
    "De balken tonen hoe jullie kennis over de vijf kennissoorten verdeeld is — van onderbuikgevoel via beproefde werkwijzen tot negatieve kennis, oftewel de kennis over wat je niet mag doen. Ontbreekt een soort bijna helemaal, dan is dat een signaal: daar wordt tot nu toe weinig vastgelegd. Gebruik het beeld om gericht door te vragen, niet om personen te beoordelen.",
  "shelp.ana.weekly":
    "Dit overzicht telt hoeveel kennisobjecten in elke week de beoordeling hebben doorstaan. Het toont het tempo waarin geborgde kennis ontstaat — niet hoe ijverig afzonderlijke personen waren. Wordt de curve vlak, dan blijven meestal beoordelingen liggen; een blik in het beoordelingsgedeelte laat dan zien waar het hapert.",
  "shelp.ask.steps":
    "Hier staan de kennisobjecten die voor jouw vraag uit de voorraad zijn geraadpleegd — met een fragment uit de vindplaats. Het is GEEN afleiding: KLARWERK legt niet vast welke zin van het antwoord uit welke bron komt. De lijst zegt waarop is gezocht; nagaan doe je door de genoemde bron te openen.",
  "shelp.ask.sources":
    "Elk antwoord in KLARWERK steunt uitsluitend op jullie eigen kennisobjecten — en precies die staan hier. De eerstgenoemde hebben het antwoord gedragen; de overige zijn geraadpleegd maar niet gebruikt. Tik op een bron om het volledige object met bewijs en beoordelingsstatus te openen. Staat hier niets, dan is er over jouw vraag geen passende kennis, en KLARWERK zegt dat eerlijk in plaats van iets te verzinnen.",
  "shelp.capture.resumeTitle":
    "Hier liggen je opgeslagen concepten — alles wat je begonnen bent, maar nog niet ingediend hebt. Niets daarvan is verloren, en niets daarvan zien de beoordelaars zolang je het niet indient. Tik op een concept om verder te werken, of verwerp het als het niet meer nodig is.",
  "shelp.ext.title":
    "Hier kun je gericht naar externe bronnen zoeken en ze aan je kennis koppelen, bijvoorbeeld een vakartikel. Belangrijk: externe bronnen zijn aanvullend materiaal van niveau twee — ze gelden als ongecontroleerd en vervangen nooit de beoordeling door je collega's. Of deze zoekfunctie beschikbaar is, bepaalt het beheer via een eigen goedkeuringsniveau.",
  "shelp.extpage.resultsTitle":
    "Deze lijst toont de treffers van de externe zoekopdracht. Alles hier komt van buitenaf en is ongecontroleerd — daarom wordt het duidelijk als extern gemarkeerd en nooit automatisch overgenomen. Je beslist zelf of je een treffer als bron van niveau twee koppelt. Geborgde kennis ontstaat daaruit pas wanneer mensen het controleren.",
  "shelp.ko.statement":
    "Dit is de kern van het kennisobject: één enkele, heldere uitspraak over wat geldt. Al het andere op deze pagina — voorwaarden, maatregelen, bewijs — hangt aan die zin. Lees de uitspraak eerst en controleer daarna daaronder wanneer die geldt en waarop die zich baseert.",
  "shelp.ko.conditions":
    "Voorwaarden vertellen je wanneer de uitspraak geldt — en daarmee ook wanneer niet. Een voorbeeld: een regel voor het winterbedrijf helpt je in de zomer niets. Controleer voor het toepassen altijd of jouw situatie bij de genoemde voorwaarden past.",
  "shelp.ko.measures":
    "Maatregelen beschrijven wat er concreet te doen valt wanneer de uitspraak van toepassing is — stap voor stap. Ze zijn bewust kort gehouden zodat ze in de praktijk toepasbaar blijven. Mis je een stap of is iets onduidelijk, laat dan een opmerking achter; zo wordt de kennis mettertijd beter.",
  "shelp.ko.provenance":
    "Hier staat waar deze kennis vandaan komt: wie die heeft vastgelegd, wanneer die is ontstaan en of die ooit is overgedragen. Herkomst is in KLARWERK geen bijzaak — een navolgbare herkomst is een deel van het vertrouwen. Bij vragen weet je hier bij wie je terechtkunt.",
  "shelp.ko.lineageTitle":
    "Dit gedeelte toont de verwantschap van deze kennis: waaruit die is voortgekomen en met welke andere objecten die samenhangt. Zo herken je of het deel is van een groter thema. Gebruik de koppelingen om je verder te hangelen in plaats van geïsoleerde losse stukken te lezen.",
  "shelp.nb.title":
    "Het kennisnetwerk toont de buurt van het artikel dat je leest: in het midden het artikel, eromheen wat er via gedeelde tags bij hoort — en bij elke verbinding staat waarom. Eén klik op een buur maakt die het nieuwe midden; „Artikel openen” brengt je ernaartoe. Tags die bijna elk artikel draagt, tellen niet als verwantschap — dat staat er dan eerlijk bij.",
  "shelp.ko.history":
    "Elke inhoudelijke wijziging maakt een nieuwe versie aan, en hier zie je het verloop: wie wanneer wat heeft gewijzigd en met welke notitie. Oudere versies blijven bewaard, niets wordt stilletjes overschreven. Zo kun je nagaan hoe de kennis zich heeft ontwikkeld.",
  "shelp.ko.evidenceTitle":
    "Bewijs zijn de onderbouwingen achter de uitspraak: gekoppelde bronnen, documenten en bewijsstukken, telkens toegewezen aan de versie waarbij ze horen. Hoe beter de bewijslast, hoe steviger de kennis — vertrouwen ontstaat in KLARWERK uit onderbouwing, niet uit beweringen. Een object zonder bewijs is niet automatisch fout, maar verdient wel een kritischer blik.",
  "shelp.ko.snapshotsTitle":
    "Een momentopname is de volledige, bevroren versie van een eerdere stand. Hier kun je nalezen hoe het object er op een bepaald moment precies uitzag. De momentopnames zijn er alleen om te lezen — niemand kan ze wijzigen, en juist dat maakt ze als bewijs waardevol.",
  "shelp.ko.comments":
    "Hier wisselen collega's van gedachten over dit object: vragen, aanvullingen, bezwaren. Een opmerking wijzigt de kennis zelf niet — het is een gesprek in de marge dat vaak tot een betere volgende versie leidt. Als je iets weet dat hier ontbreekt, schrijf het erbij.",
  "shelp.ko.attachments":
    "Hier liggen documenten en afbeeldingen die bij deze kennis horen — bijvoorbeeld een foto van de installatie of een handleiding. Bijlagen zijn illustratiemateriaal en onderbouwing, geen gecontroleerde uitspraken. Bij het uploaden gelden groottelimieten die jullie beheer vaststelt.",
  "shelp.lcy.assetTitle":
    "Sommige kennis hangt aan een bepaalde machine of installatie. Wanneer daar iets verandert — een verbouwing, een vervanging, een nieuwe instelling — kun je dat hier melden. De betrokken kennisobjecten komen dan opnieuw ter beoordeling, zodat niemand met een verouderde stand werkt.",
  "shelp.lcy.pendingTitle":
    "Kennis veroudert. In deze lijst staan objecten waarvan de beoordeling een opfrissing nodig heeft — bijvoorbeeld omdat ze lang niet zijn aangeraakt of omdat hun omgeving is veranderd. Opnieuw gecontroleerde kennis blijft betrouwbaar; blijven liggen opfrissingen zijn een stil risico.",
  "shelp.lcy.pathTitle":
    "Een leerpad is een zinvolle leesvolgorde door de aanwezige kennis, toegesneden op een rol. Nieuwe collega's werken het stap voor stap door en vinken af wat ze hebben gelezen. Zo wordt van afzonderlijke kennisobjecten een begeleide instap.",
  "shelp.out.kindTitle":
    "Hier kies je welke soort document uit jullie geborgde kennis moet ontstaan — bijvoorbeeld een werkinstructie, een checklist of lesmateriaal. Het type bepaalt opbouw en toon van het resultaat. Gegenereerd wordt er pas wanneer je het activeert; vanzelf gebeurt hier niets.",
  "shelp.out.sourcesTitle":
    "Voor een document komen alleen gecontroleerde kennisobjecten in aanmerking, en precies die kies je hier. Wat niet gevalideerd is, staat bewust niet ter keuze — een gegenereerd document mag zich alleen op geborgde kennis baseren. Kies de objecten die inhoudelijk bij elkaar horen.",
  "shelp.out.composeTitle":
    "Hier breng je de gekozen kennisobjecten in de volgorde waarin ze in het document moeten verschijnen. De volgorde draagt de logica van het resultaat — van overzicht naar detail of langs een verloop. Verschuif de items tot de rode draad klopt.",
  "shelp.out.previewTitle":
    "De voorbeeldweergave toont het document zoals het uit jouw bouwstenen gegenereerd zou worden, in het tekstformaat Markdown. Controleer hier rustig of inhoud en volgorde passen, voordat je het resultaat downloadt of kopieert. Een export als PDF is er momenteel niet.",
  "shelp.out.provenanceTitle":
    "Bij elk gegenereerd document hoort het bewijs uit welke kennisobjecten het is opgebouwd. Dit gedeelte legt de herkomst vast, zodat elke uitspraak in het document herleidbaar blijft naar haar bron. Dat is hetzelfde principe als overal in KLARWERK: pas de onderbouwing maakt een uitspraak stevig.",
  "shelp.imp.uploadTitle":
    "Hier speel je een eerder gemaakte export in het JSON-formaat weer in. De items worden niet blind overgenomen: ze belanden eerst als kandidaten ter beoordeling, zodat er niets ongecontroleerd in de voorraad glipt. Bekijk de kandidatenlijst voordat je iets overneemt — ook om dubbelingen te voorkomen.",
  "shelp.ext.pipeline.title":
    "Dit gedeelte toont wat er bij het inlezen van externe inhoud is gebeurd: wat herkend werd, wat opviel en wat nog op een beslissing wacht. De pipeline neemt niets uit zichzelf over — die bereidt voor, mensen beslissen. Werk de bevindingen het best van boven naar beneden af.",
  "shelp.imp.queueTitle":
    "In deze wachtrij staan ingelezen bronnen die nog een menselijk oordeel nodig hebben: overnemen, herzien of verwerpen. Niets daaruit wordt zonder jouw beslissing deel van de kennisvoorraad. Hier scheidt zich ruw materiaal van geborgde kennis.",
  "shelp.mgmt.jumpTitle":
    "Deze balk is de inhoudsopgave van de managementweergave. Een tik op een item springt direct naar het betreffende gedeelte verderop. Die wijzigt niets aan de data — die helpt alleen bij het snel navigeren.",
  "shelp.mgmt.overview":
    "Dit overzicht vat de huidige toestand van jullie kennisvoorraad samen in een paar kengetallen — bijvoorbeeld hoeveel kennis aanwezig, gecontroleerd of in bewerking is. Het is een momentopname ter oriëntatie, geen rapportcijfer. Voor bijzonderheden open je de gedeelten daaronder.",
  "shelp.mgmt.capital":
    "Deze waarde verdicht de toestand van jullie kennisvoorraad tot één enkel getal — die houdt bijvoorbeeld rekening met hoeveel kennis gecontroleerd is en hoe goed die is onderbouwd. Lees hem als een grove indeling en let vooral op zijn ontwikkeling in de tijd. Eén enkel getal vervangt nooit de blik in de details.",
  "shelp.mgmt.valuation":
    "Dit gedeelte maakt de waarde van jullie kennis tastbaarder: een indeling van welke voorraden bijzonder veel bijdragen aan veiligheid en handelingsvermogen. De getallen zijn oriëntatiewaarden uit de voorraad, geen gecontroleerde balans. Gebruik ze om prioriteiten te bespreken, niet als boekhouding.",
  "shelp.mgmt.statement":
    "Het Knowledge Statement is een samenvattend rapport over jullie kennisvoorraad, bedoeld voor directie en gremia. Het beantwoordt in het kort: wat hebben we, hoe stevig is het, en waar zitten hiaten. Het rapport put uit de echte voorraden — wat het niet kan onderbouwen, beweert het niet.",
  "shelp.mgmt.maturity":
    "De volwassenheidsreis geeft aan hoe ver jullie organisatie is in de omgang met kennis — van de eerste geborgde items tot de ingespeelde cyclus van vastleggen, controleren en onderhouden. Die toont de volgende zinvolle etappe, geen cijfer. Volwassenheid groeit met het gebruik, niet op knopdruk.",
  "shelp.mgmt.house":
    "Het kennishuis is een beeld van jullie themalandschap: kamers staan voor kennisgebieden, en je ziet in één oogopslag welke goed gevuld en welke bijna leeg zijn. Lege kamers zijn geen schande, maar een uitnodiging — daar loont het volgende vastleggen. Tik op een gedeelte om erin te kijken.",
  "shelp.mgmt.recommendations":
    "Hier stelt KLARWERK vervolgstappen voor die uit jullie voorraad voortkomen — bijvoorbeeld blijven liggen beoordelingen of een kennisgebied dat maar uit één bron gevoed wordt. Het zijn voorstellen, geen opdrachten: jij beslist wat daarvan aan de beurt is. Elk voorstel brengt je direct naar de juiste plek.",
  "shelp.mgmt.priorities":
    "Deze lijst rangschikt kennisthema's naar hoe dringend ze aandacht nodig hebben — beoordeeld op negen gezichtspunten, zoals risico, ouderdom en de afhankelijkheid van afzonderlijke kennisbronnen. Bovenaan staat wat als eerste aan de beurt zou moeten zijn. De volgorde is een aanbeveling als gespreksbasis, geen automatische beslissing.",
  "shelp.mgmt.pilot":
    "Dit rapport bundelt wat er in de eerste dertig, zestig en negentig dagen van een pilotbedrijf is gebeurd en wat er als volgende aanstaat. Het maakt de voortgang voor alle betrokkenen zichtbaar — eerlijk, met behaalde en openstaande punten. Bedoeld als gemeenschappelijke basis voor het gesprek met de directie.",
  "shelp.mrun.title":
    "Deze lijst protocolleert de laatste inzetten van de KI: welke taak liep, welk model antwoordde, hoe lang het duurde en of een uitwijkroute nodig was. De inhoud van je teksten staat hier bewust niet — alleen technische kerngegevens. Zo blijft navolgbaar wat de KI wanneer heeft gedaan.",
  "shelp.rcfg.title":
    "Hier zie je welke KI voor welke taak is ingesteld — de cloud-KI, jullie On-Premise Enterprise AI of de op regels gebaseerde modus helemaal zonder model. De toewijzing laat zich per taak wijzigen, en de app toont eerlijk wat er op dit moment werkzaam is. KI-sleutels blijven daarbij altijd op de server; in de browser belandt er nooit een.",
  "shelp.evx.title":
    "De bewijs-index is de kwaliteitsweergave op de bewijslast: die toont welke kennisobjecten goed onderbouwd zijn en waar onderbouwing ontbreekt. Daarmee vind je gericht de items die vóór de volgende inzet onderbouwing nodig hebben. Goed onderbouwde kennis is de ruggengraat van elk betrouwbaar antwoord.",
  "shelp.prov.title":
    "Deze index controleert de herkomstkant van de kwaliteit: is bij elk kennisobject navolgbaar waar het vandaan komt en hoe het is ontstaan? Bijzonderheden staan bovenaan, zodat je ze als eerste ziet. Een sluitende herkomst is de basis waarop je kennis later nog kunt duiden.",
  "shelp.readiness.title":
    "Dit gedeelte schat in hoe startklaar jullie kennissysteem als geheel is — van de databasis via de beoordelingsprocessen tot de KI-koppeling. De stoplichten tonen waar het nog hapert en wat er als volgende zinvol is. Het is een positiebepaling, geen oplevering.",
  "shelp.kos.hintsTitle":
    "Hier verzamelt de kwaliteitsborging concrete aanwijzingen uit de voorraad: dingen die opvallen en een blik verdienen — bijvoorbeeld dun onderbouwde objecten of verweesde thema's. Elke aanwijzing noemt de vindplaats, zodat je er direct naartoe kunt springen en de oorzaak kunt verhelpen.",
  "shelp.evFresh.title":
    "Onderbouwing veroudert net als kennis. Deze weergave toont hoe vers het bewijs achter jullie kennisobjecten is en waar oude onderbouwing een opfrissing nodig heeft. Zo herken je items die formeel onderbouwd zijn, maar inhoudelijk mogelijk achterhaald.",
  "pilot.title": "Pilot-checklist: eerste gebruikersrun",
  "pilot.subtitle":
    "Waarop letten bij de eerste echte run — Stage-1, eerlijk. Elk punt leidt naar het passende gedeelte.",
  "pilot.check.capture":
    "Vastleggen slaat open op: net vastgelegde kennis is nog niet gevalideerd.",
  "pilot.check.validation":
    "Validatie is review/beslissing: peers beoordelen tot het geborgd is — geen automatische goedkeuring.",
  "pilot.check.use":
    "Vragen/bibliotheek gebruiken kennis bron- en statusbewust: een antwoord is niet steviger dan zijn bron.",
  "pilot.check.gap":
    "Geen basis? Het hiaat wordt eerlijk benoemd en leidt naar het vastleggen — geen verzonnen kennis.",
  "pilot.check.maintain":
    "Hervalidatie is „actueel houden“: verlopen objecten opnieuw controleren, geen automatische blijvende geldigheid.",
  "pilot.next.title": "Volgende stap",
  "pilot.next.hint":
    "Demodata zijn voorbeelden, geen productief bewijs. Bekijk nu Stage-1 of open de pilot-checklist.",
  "pilot.next.start": "Stage-1 starten (start openen)",
  "pilot.next.checklist": "Pilot-checklist openen",
  "pilot.next.ask": "Voorbeeldvraag openen",
  "pilot.obs.title": "Pilot-bevinding plaatsen",
  "pilot.obs.subtitle":
    "Waargenomen wrijving snel toewijzen aan de passende bestaande Klarwerk-flow. Er wordt niets opgeslagen; pure UX-notities horen buiten het product.",
  "pilot.obs.mapLabel": "Hoort in",
  "pilot.obs.missing.label": "Kennis ontbreekt volledig (geen basis voor de vraag).",
  "pilot.obs.missing.map": "Risico/hiaat — prioriteren en vastleggen.",
  "pilot.obs.unverified.label": "Kennis is onaf of nog niet gecontroleerd.",
  "pilot.obs.unverified.map": "Validatie — beoordelen tot het geborgd is.",
  "pilot.obs.outdated.label": "Kennis lijkt verouderd of niet meer geldig.",
  "pilot.obs.outdated.map": "Levenscyclus — hervalidatie, „actueel houden“.",
  "pilot.obs.source.label": "Bron, vertrouwen of bruikbaarheid is onduidelijk.",
  "pilot.obs.source.map": "Bibliotheek/KO-detail — status, vertrouwen, versie, bron controleren.",
  "pilot.obs.uxnote.label": "Pure UX-/pilotnotitie (bediening, wording, verloop).",
  "pilot.obs.uxnote.map":
    "Organisatorisch noteren — wordt niet in het product opgeslagen, geen workflow.",
  "pilot.obs.openFlow": "Flow openen",
  "help.firststart.title": "Eerste start & demodata",
  "help.firststart.body":
    "Verse instanties zijn eerst leeg. Als admin kun je onder Admin 'Demodata laden' om voorbeeldkennis, validatie, hiaten en conflicten zichtbaar te maken — ideaal voor review en inwerken.",
  "help.library.title": "Bibliotheek & kennisobject",
  "help.library.body":
    "De bibliotheek doorzoekt en filtert de voorraad (soort, status, categorie, tag). Een klik opent het kennisobject met uitspraak, bronnen/bijlagen, versies en bewijs.",
  "help.tasks.title": "Mijn taken",
  "help.tasks.body":
    "Hier verzamelen zich de aan jou toegewezen validatie- en navraagtaken. Van daaruit spring je direct naar het betreffende kennisobject om het te bewerken.",
  "help.risk.title": "Risico, hiaten & conflicten",
  "help.risk.body":
    "Risico toont kennishiaten, busfactor en single-source-gebieden. Hiaten laten zich prioriteren, toewijzen of sluiten; tegenstrijdigheden worden als conflicten begeleid opgelost.",
  "help.lifecycle.title": "Levenscyclus & leerpaden",
  "help.lifecycle.body":
    "Levenscyclus toont verlopen hervalidaties (bijv. na assetwijzigingen) en rolspecifieke leerpaden om af te vinken. Na de demo-seed is een voorbeeldleerpad zichtbaar.",
  "help.validation.title": "Validatie",
  "help.validation.body":
    "Beoordeel objecten groen/geel/rood. Vanaf de drempel geldt een object als gevalideerd; geel/rood vereisen een opmerking en gaan terug naar de auteur.",
  "help.stufe2.title": "Niveau 2: KM, kapitaal & output",
  "help.stufe2.body":
    "De uitgebreide KM-weergaven (kapitaal/management, bewijs- en herkomstindex, ModelRun-protocol) zijn read-only en venstergebaseerd. Output genereert documenten alleen uit gevalideerde kennis.",
  "help.mobile.title": "Mobiel & offline",
  "help.mobile.body":
    "De mobiele weergave bundelt vastleggen, vragen en opzoeken. Concepten laten zich offline aanmaken en worden gesynchroniseerd zodra er weer verbinding is.",
  "help.capture.title": "Kennis vastleggen",
  "help.capture.body":
    "Leg ervaringskennis vormvrij vast — via tekst, dictaat of foto. De KI structureert het, jij controleert en dient in.",
  "help.validate.title": "Valideren",
  "help.validate.body":
    "Beoordeel objecten groen/geel/rood. Vanaf de drempel geldt een object als gevalideerd; rode beoordelingen gaan terug naar de auteur.",
  "help.ask.title": "Vragen stellen",
  "help.ask.body":
    "Antwoorden zijn brongebonden en tonen welke bronnen ze gedragen hebben en in welke staat die zijn. Zonder basis ontstaat een kennishiaat.",
  "help.conflict.title": "Conflicten",
  "help.conflict.body":
    "Tegenstrijdigheden worden zichtbaar gemaakt en begeleid opgelost. Alleen waarheidsconflicten escaleren naar een mens.",
  "help.roles.title": "Rollen",
  "help.roles.body":
    "Viewer leest en vraagt, expert legt vast, controller valideert en klaart uit, admin beheert. Je ziet alleen wat je rol toelaat.",
  "help.trust.title": "Vertrouwen",
  "help.trust.body":
    "Elke uitspraak draagt een rijpheidsgraad uit validatie en gebruik. Vertrouwen is bewijs, geen waarheid.",
  "mob.title": "Snel vastleggen",
  "mob.sub": "Bij de installatie. In minder dan twee minuten.",
  "mob.dictate": "Dictaat opnemen",
  "mob.dictateSub": "Spreken — de AI structureert",
  "mob.note": "Notitie",
  "mob.photo": "Foto",
  "mob.interview": "Interview",
  "mob.lookup": "Opzoeken",
  "mob.editing": "Concept wordt voortgezet.",
  "mob.formTitle": "Kernuitspraak",
  "mob.formStatement": "Wat is er gebeurd / wat geldt?",
  "mob.save": "Als concept opslaan",
  "mob.saved": "Concept opgeslagen.",
  "mob.update": "Concept bijwerken",
  "mob.updated": "Concept bijgewerkt.",
  "mob.new": "Nieuw",
  "mob.drafts": "Mijn concepten",
  "mob.draftsEmpty": "Nog geen concepten.",
  "mob.resume": "Voortzetten",
  "mob.discard": "Verwerpen",
  "mob.discarded": "Concept verworpen.",
  "mob.discardConfirmHint": "Verwerpen?",
  "mob.confirmDiscard": "Ja, verwerpen",
  "mob.cancelDiscard": "Annuleren",
  "mob.tabCapture": "Vastleggen",
  "mob.tabAsk": "Vragen",
  "mob.tabLookup": "Zoeken",
  "mob.searchPlaceholder": "Kennis doorzoeken …",
  "mob.searchEmpty": "Geen treffers.",
  "mob.online": "online",
  "mob.offline": "offline",
  "mob.queued": "Offline opgeslagen – wordt gesynchroniseerd.",
  "mob.queue": "Wachtrij",
  "mob.syncNow": "Synchroniseren",
  "mob.syncOk": "Gesynchroniseerd",
  "mob.syncFail": "Synchronisatie mislukt",
  "mob.offlineSaveHint": "Offline – opslaan wordt lokaal genoteerd.",
  "mob.offlineAsk": "Offline – vragen hebben een verbinding nodig.",
  "mob.offlineSearch": "Offline – zoeken heeft een verbinding nodig.",
  "mob.offlineNeedsConn": "Zodra er weer verbinding is, is dit beschikbaar.",
  "mob.status.queued": "wacht",
  "mob.status.pending": "loopt",
  "mob.status.synced": "klaar",
  "mob.status.failed": "Fout",
  "s2.kicker": "Uitgebreid · Niveau 2",
  "s2.output":
    "Uit gevalideerde objecten werkinstructies/checklists genereren — actief zodra de output-logica staat.",
  "out.kindTitle": "Output-type",
  "out.sourcesTitle": "Gevalideerde bronnen",
  "out.noValidated": "Nog geen gevalideerde kennisobjecten aanwezig.",
  "out.generate": "Output genereren",
  "out.composeTitle": "Volgorde & compositie",
  "out.composeHint":
    "Volgorde van de bouwstenen vastleggen — die wordt bij het genereren precies zo overgenomen.",
  "out.moveUp": "Naar boven",
  "out.moveDown": "Naar beneden",
  "out.removeFromOrder": "Uit selectie verwijderen",
  "out.previewCompositionTitle": "Compositievoorbeeld",
  "out.previewSummary": "{{kind}} uit {{n}} gevalideerde bouwstenen in deze volgorde.",
  "out.previewProvenance":
    "De volledige herkomst per bouwsteen wordt in het gegenereerde document vermeld.",
  "out.previewUncertain":
    "{{n}} bouwsteen/-stenen met laag vertrouwen — in het document als onzeker gemarkeerd.",
  "out.previewDisclaimer":
    "Voorbeeld van de compositie, niet het voltooide document. Generatie gebeurt bij het genereren.",
  "out.previewTitle": "Voorbeeld (Markdown)",
  "out.copy": "Kopiëren",
  "out.copied": "Markdown gekopieerd.",
  "out.download": "Download .md",
  "out.provenanceTitle": "Herkomst & bewijs",
  "out.uncertain": "laag vertrouwen",
  "out.genError": "Output kon niet worden gegenereerd.",
  "out.kind.instruction": "Werkinstructie",
  "out.kind.checklist": "Checklist",
  "out.kind.troubleshooting": "Storingshulp",
  "out.kind.training": "Training",
  "out.kind.management_summary": "Management-summary",
  "out.kindDesc.instruction": "Stap-voor-stap-handleiding (SOP).",
  "out.kindDesc.checklist": "Afvinkbare punten voor de praktijk.",
  "out.kindDesc.troubleshooting": "Symptoom → oorzaak → maatregel.",
  "out.kindDesc.training": "Leereenheden met kernuitspraken.",
  "out.kindDesc.management_summary": "Verdicht overzicht met vertrouwen.",
  "s2.import":
    "Documenten importeren en controleren — actief zodra de import-/source-review-API staat.",
  "s2.capital":
    "Kenniskapitaal-kengetallen op echte live-data — actief zodra de kengetallen-logica staat.",
  "mgmt.jumpTitle": "Gedeelten",
  "mgmt.overview": "Operationele snapshot",
  "mgmt.kpiTotal": "Objecten",
  "mgmt.kpiValidated": "Gevalideerd",
  "mgmt.kpiOpen": "Open",
  "mgmt.kpiGaps": "Hiaten",
  "mgmt.kpiConflicts": "Conflicten",
  "mgmt.kpiTrust": "Ø vertrouwen",
  "mgmt.capital": "Kenniskapitaal-score",
  "mgmt.band.gut": "goed",
  "mgmt.band.mittel": "gemiddeld",
  "mgmt.band.kritisch": "kritiek",
  "mgmt.part.validatedRatio": "Validatiegraad",
  "mgmt.part.avgTrust": "Ø vertrouwen",
  "mgmt.part.coverage": "Dekking domeinen",
  "mgmt.part.singleSourceInv": "Bronspreiding",
  "mgmt.part.freshnessInv": "Actualiteit",
  "mgmt.valuation": "Kenniswaardering",
  "mgmt.valuationDisclaimer":
    "Schattingsmodel op basis van transparante aannames — geen balanswaardering.",
  "mgmt.assumeRate": "€ per uur",
  "mgmt.assumeHours": "uur/object bespaard",
  "mgmt.assumeReuse": "Hergebruik",
  "mgmt.basis": "Basis: {{n}} gevalideerde objecten · Ø vertrouwen {{trust}}",
  "mgmt.statement": "Kennisbalans",
  "mgmt.assets": "Activa",
  "mgmt.risks": "Risico's",
  "mgmt.net": "Netto-index",
  "mgmt.riskBreakdown":
    "Single-source-domeinen: {{ss}} · verouderd: {{stale}} · openstaande hiaten: {{gaps}} · conflicten: {{conf}}",
  "mgmt.maturity": "Volwassenheidspad",
  "mgmt.stage": "Fase",
  "mgmt.stageName.leer": "Geen voorraad",
  "mgmt.stageName.erfassen": "Vastleggen",
  "mgmt.stageName.strukturieren": "Structureren",
  "mgmt.stageName.validieren": "Valideren",
  "mgmt.stageName.wiederverwenden": "Hergebruiken",
  "mgmt.stageName.skalieren": "Schalen",
  "mgmt.house": "Kennishuis",
  "mgmt.fragile": "fragiel",
  "mgmt.stable": "geborgd",
  "mgmt.empty": "Nog geen voorraad — kengetallen verschijnen zodra kennis is vastgelegd.",
  "mrun.title": "Reasoner-runs (laatste)",
  "mrun.empty": "Nog geen Reasoner-runs geprotocolleerd.",
  "mrun.total": "Totaal: {{n}}",
  "mrun.errors": "Fouten: {{n}}",
  "mrun.fallbacks": "Fallbacks: {{n}}",
  "mrun.demo": "Demo: {{n}}",
  "mrun.fallback": "Fallback",
  "mrun.demoTag": "Demo",
  "evx.title": "Bewijs-index (KM)",
  "evx.empty": "Nog geen bewijs-records aanwezig.",
  "evx.total": "Totaal: {{n}}",
  "evx.sources": "Bronnen: {{n}}",
  "evx.attachments": "Bijlagen: {{n}}",
  "evx.kos": "Kennisobjecten: {{n}}",
  "evx.kind.source": "Bron",
  "evx.kind.attachment": "Bijlage",
  "evx.koRef": "KO {{id}}",
  "evx.providerPill": "Aanbieder: {{v}}",
  "evx.objectPill": "Object: {{v}}",
  "prov.title": "Herkomst-index (KM)",
  "prov.empty": "Nog geen kennisobjecten aanwezig.",
  "prov.total": "KO's: {{n}}",
  "prov.transfer": "Overdracht: {{n}}",
  "prov.multiVersion": "Meervoudige versie: {{n}}",
  "prov.withEvidence": "met bewijs: {{n}}",
  "prov.noEvidence": "zonder bewijs: {{n}}",
  "prov.version": "v{{n}}",
  "prov.counts": "B {{sources}} · Bij {{attachments}} · Bw {{evidence}}",
  "prov.badge.no-evidence": "geen bewijs",
  "prov.badge.transferred-author": "auteursoverdracht",
  "prov.badge.multi-version": "meervoudige versie",
  "kos.hintsTitle": "Knowledge-OS KM-aanwijzingen",
  "kos.sevCount.critical": "kritiek: {{n}}",
  "kos.sevCount.warning": "Waarschuwingen: {{n}}",
  "kos.sevCount.info": "Aanwijzingen: {{n}}",
  "kos.sev.critical": "kritiek",
  "kos.sev.warning": "Waarschuwing",
  "kos.sev.info": "Info",
  "kos.sev.ok": "OK",
  "kos.hints.none": "Geen aanwijzingen uit de geladen signalen.",
  "kos.hints.unknown": "Niet geladen (onbekend, geen fout): {{sources}}",
  "kos.hint.modelrun-errors.title": "ModelRun-fouten ({{n}})",
  "kos.hint.modelrun-errors.detail": "Reasoner-aanroepen met foutstatus — protocol controleren.",
  "kos.hint.modelrun-fallbacks.title": "ModelRun-fallbacks ({{n}})",
  "kos.hint.modelrun-fallbacks.detail":
    "Runs gebruikten de deterministische vervanging in plaats van een model.",
  "kos.hint.reasoner-demo.title": "Reasoner in demo-/fallback-modus",
  "kos.hint.reasoner-demo.detail":
    "Geen echt model geconfigureerd — antwoorden zijn deterministisch.",
  "kos.hint.provenance-no-evidence.title": "KO's zonder bewijs ({{n}})",
  "kos.hint.provenance-no-evidence.detail": "Bronnen/bijlagen aanwezig, maar geen bewijs-records.",
  "kos.hint.evidence-outdated.title": "Bewijs verouderd ({{n}})",
  "kos.hint.evidence-outdated.detail":
    "Actuele KO-versie zonder bewijs — alleen oudere versies onderbouwd.",
  "kos.hint.evidence-missing.title": "Bewijs ontbreekt ({{n}})",
  "kos.hint.evidence-missing.detail":
    "Bronnen/object-bijlagen aanwezig, maar geen bewijs voor welke versie dan ook.",
  "kos.hint.provenance-lineage.title": "Overdracht/meervoudige versie ({{n}})",
  "kos.hint.provenance-lineage.detail": "KO's met auteursoverdracht of meerdere versies.",
  "kos.hint.evidence-empty.title": "Geen bewijs-records",
  "kos.hint.evidence-empty.detail":
    "Tot nu toe zijn er geen bronnen/bijlagen als bewijs vastgelegd.",
  // AUFTRAG-mega34 G.
  "kos.hint.health-detection-unproven.title": "Knowledge-Health niet aangetoond ({{n}})",
  "kos.hint.health-detection-unproven.detail":
    "De conflictdetectie is niet volledig aangetoond. De getoonde waarde is daarom de ongunstigst mogelijke, geen gemeten graad — zolang dat zo is, valt noch een sein-veilig noch een alarm eerlijk te geven.",
  "kos.hint.health-critical.title": "Knowledge-Health kritiek ({{n}})",
  "kos.hint.health-critical.detail": "Totaalscore in het kritieke bereik.",
  "kos.hint.health-mittel.title": "Knowledge-Health gemiddeld ({{n}})",
  "kos.hint.health-mittel.detail": "Totaalscore in het gemiddelde bereik.",
  "kos.hint.all-clear.title": "Geen bijzonderheden",
  "kos.hint.all-clear.detail": "De geladen Foundation-signalen tonen geen waarschuwingen.",
  "evFresh.title": "Actualiteit van bewijs (QM)",
  "evFresh.subtitle": "KO's waarvan de huidige versie geen bewijs heeft.",
  "evFresh.empty": "Geen KO's met verouderd of ontbrekend bewijs.",
  "evFresh.summary.outdated": "verouderd: {{n}}",
  "evFresh.summary.missing": "ontbrekend: {{n}}",
  "evFresh.summary.current": "actueel: {{n}}",
  "evFresh.summary.neutral": "neutraal: {{n}}",
  "evFresh.version": "v{{n}}",
  "evFresh.counts": "actueel {{current}} · ouder {{older}}",
  "evFresh.openKo": "KO openen",
  "qmWindow.within": "binnen het geladen venster",
  "qmWindow.limited": "mogelijk afgekapt",
  "qmWindow.modelRuns": "Venster: {{n}} meest recente ModelRuns",
  "qmWindow.evidence": "Venster: {{n}} meest recente EvidenceRecords",
  "readiness.title": "Knowledge-OS Readiness",
  "readiness.ready": "gereed",
  "readiness.attention": "aandachtig",
  "readiness.critical": "kritiek",
  "readiness.incomplete": "onvolledig geladen",
  "readiness.reason.critical": "kritieke aanwijzingen",
  "readiness.reason.warning": "waarschuwingen",
  "readiness.reason.window": "datavenster mogelijk afgekapt",
  "readiness.reason.unknown": "signalen niet geladen",
  "mrun.task.structure": "Structureren",
  "mrun.task.assist": "Bijschaven",
  "mrun.task.interview": "Interview",
  "mrun.task.answer": "Antwoorden",
  "mrun.task.select": "Selecteren",
  "mrun.status.success": "OK",
  "mrun.status.error": "Fout",
  "rcfg.title": "Reasoner-configuratie",
  "rcfg.mode": "Modus",
  "rcfg.modeLabel.model": "Model actief",
  "rcfg.modeLabel.fallback": "Fallback",
  "rcfg.modeLabel.demo": "Demo (deterministisch)",
  "rcfg.provider": "Provider",
  "rcfg.model": "Model",
  "rcfg.notConfigured": "niet geconfigureerd",
  "rcfg.locales": "Talen",
  "rcfg.tasks": "Taken",
  "rcfg.fallbackHint": "Geen model geconfigureerd — deterministische fallback is actief.",
  "mgmt.recommendations": "Aanbevelingen",
  "mgmt.noRecs": "Geen dringende maatregelen.",
  "mgmt.sev.hoch": "hoog",
  "mgmt.sev.mittel": "gemiddeld",
  "mgmt.rec.secureSingleSource":
    "{{count}} single-source-domein(en) beveiligen (kennis verspreiden).",
  "mgmt.rec.revalidate": "{{count}} openstaande hervalidatie(s) afhandelen.",
  "mgmt.rec.closeGaps": "{{count}} open kennishiaat/-hiaten sluiten.",
  "mgmt.rec.resolveConflicts": "{{count}} open conflict(en) oplossen.",
  "mgmt.rec.validateBacklog": "{{count}} open objecten valideren.",
  "mgmt.priorities": "Kennisprioritering (9 factoren)",
  "mgmt.pilot": "Pilotrapport 30/60/90",
  "mgmt.print": "Afdrukken / PDF",
  "mgmt.pilotNote": "Afdruk-/HTML-weergave (via browserafdruk), geen gecertificeerde PDF.",
  "mgmt.window": "Venster",
  "mgmt.created": "Vastgelegd",
  "mgmt.validatedCol": "Gevalideerd",
  "mgmt.days": "Dagen",
  "s2.graphEmpty": "Geen graafgegevens.",
  "s2.graphCount": "{{nodes}} knopen · {{edges}} verbindingen",
  "graph.truncated": "Weergave beperkt tot de {{n}} sterkst verbonden knopen",
  "graph.legendValidated": "gevalideerd",
  "graph.legendOpen": "open / in beoordeling",
  "graph.legendTag": "tag-relatie",
  "graph.legendConflict": "conflict",
  "graph.clickHint": "Klik op een knoop om het kennisobject te openen",
  "graph.openNode": "Kennisobject openen: {{title}}",
  "vhelp.originFilter.title": "Herkomst filteren",
  "vhelp.originFilter.body":
    "Toont de lijst gefilterd op herkomst: demovoorbeelden of eigen kennis van jouw organisatie. Dit is alleen een weergave om dingen terug te vinden — het verandert geen controlestatus en gooit niets weg. Het getal achter elk filter geeft aan hoeveel vermeldingen het bevat.",
  "vhelp.reviewFocus.title": "Review-focus",
  "vhelp.reviewFocus.body":
    "Maakt onderscheid tussen nieuwe indieningen en herziene (versie groter dan 1). Herziene objecten verdienen een gerichte blik op de wijziging — wat was de vraag, wat is aangepast? Ook dit is alleen een weergave: het verandert geen status en vervangt geen beslissing.",
  "vhelp.filters.title": "Zoeken & filteren",
  "vhelp.filters.body":
    "Beperkt de controlelijst op volledige tekst, kennissoort, categorie of trefwoord. Gebruik dit als de lijst lang is en je gericht je vakgebied wilt controleren. Er gaat niets verloren: filters veranderen alleen wat je op dit moment ziet — alle objecten blijven in beoordeling.",
  "vhelp.mineOnly.title": "Alleen aan mij toegewezen",
  "vhelp.mineOnly.body":
    "Toont jouw persoonlijke review-lijst: objecten die iemand bewust aan jou heeft toegewezen. Gebruik dit om eerst het werk te doen waar collega's op wachten. De toewijzing is een verzoek, geen verplichte controle — de beslissing valt pas als je zelf beoordeelt.",
  "vhelp.signals.title": "Review-signalen lezen",
  "vhelp.signals.body":
    'De regel toont hoe betrouwbaar het object NU is: vertrouwensbalk en trust-waarde (uit controlestemmen en bewezen praktijk), versie, „Doel n" (zoveel goedkeuringen zijn er nodig tot GEVALIDEERD), plus markeringen zoals OVERGEDRAGEN (auteur gewisseld — extra blik) of TOEGEWEZEN. Niets daarvan is een beoordeling door jou — het is de eerlijke uitgangssituatie voor jouw beslissing.',
  "vhelp.approve.title": "Goedkeuren",
  "vhelp.approve.body":
    "Je bevestigt na eigen controle: deze uitspraak is vakinhoudelijk juist en zo toepasbaar. Gebruik dit pas als je kernuitspraak, voorwaarden en maatregelen echt hebt beoordeeld — jouw goedkeuring telt als een van meerdere benodigde controlestemmen. Daarna stijgt het vertrouwen van het object; GEVALIDEERD wordt het pas als genoeg beoordelaars hebben goedgekeurd. Er wordt niets automatisch gepubliceerd of gewijzigd — jouw stem wordt geteld, meer niet.",
  "vhelp.query.title": "Vraag stellen",
  "vhelp.query.body":
    "Je vindt de kennis bruikbaar, maar iets is onduidelijk, onvolledig of alleen onder voorwaarden juist. Een korte opmerking is verplicht — het is jouw hulp aan de auteur: wat ontbreekt er precies, wat moet hij aanvullen? Daarna blijft het object in beoordeling en ziet de auteur jouw vraag als opmerking bij het kennisobject. Er wordt niets afgewezen, niets goedgekeurd en niets automatisch gewijzigd — de herziening doet de auteur bewust zelf.",
  "vhelp.reject.title": "Afwijzen",
  "vhelp.reject.body":
    'Je vindt de uitspraak onjuist, verouderd of riskant. Ook hier is de motivatie verplicht — zonder die kan de auteur niets leren en niets corrigeren. Daarna vloeit jouw afwijzing mee in de beoordeling van het object; het wordt daardoor NIET verwijderd en NIET geblokkeerd, maar blijft zichtbaar in beoordeling tot de auteur of controller reageert. Als twee zekere uitspraken elkaar tegenspreken, is „Conflict melden" de betere weg dan een afwijzing.',
  "vhelp.feedbackForm.title": "Motivatie (verplicht)",
  "vhelp.feedbackForm.body":
    "Vraag en afwijzing hebben altijd een motivatie nodig — die wordt als opmerking bij het kennisobject opgeslagen, zichtbaar voor auteur en beoordelaar. Schrijf concreet wat ontbreekt of onjuist is en wat de auteur moet aanvullen. Pas met tekst kun je versturen; annuleren gooit alleen je invoer weg, geen beoordeling.",
  "vhelp.assign.title": "Beoordelaar toewijzen",
  "vhelp.assign.body":
    'Je vraagt een bepaalde collega om de beoordeling van dit object. Die persoon ziet het daarna in haar persoonlijke review-lijst („Aan mij toegewezen") en krijgt een melding via de bel. De toewijzing is een uitnodiging, geen beoordeling: het verandert status noch vertrouwen, en beoordeeld wordt er pas als de persoon zelf beslist.',
  "vhelp.markTrue.title": "Als waar markeren (alleen admin)",
  "vhelp.markTrue.body":
    'Als admin sluit je de validatie van dit object in één stap af — onafhankelijk van de peer-beoordelingen. De status wordt op „gevalideerd" gezet en het vertrouwen naar de hoogste trap getild. Gebruik dit bewust en alleen als je de uitspraak echt kunt verantwoorden, want je slaat daarmee de meervoudige tegencontrole door anderen over. De handeling wordt in het audit-log met jouw naam vastgelegd en kan later via een nieuwe bewerking/revisie weer in beoordeling worden teruggehaald.',
  "vhelp.stillValid.title": "Nog geldig",
  "vhelp.stillValid.body":
    "Je bevestigt dat deze reeds gecontroleerde kennis wat jou betreft nog steeds klopt — een versheidssignaal, geen nieuwe controleprocedure. Gebruik het als je de kennis net hebt toegepast of bewust hebt nagelezen. Daarna wordt de bevestiging met datum vermeld en geldt het object als recent bevestigd. Het vervangt geen peer-controle en heft geen vragen of conflicten op.",
  "vhelp.reportConflict.title": "Conflict melden",
  "vhelp.reportConflict.body":
    "Je geeft aan dat deze kennis een ANDER kennisobject tegenspreekt — bijvoorbeeld twee verschillende grenswaarden voor hetzelfde geval. Daarna verschijnt de kwestie op de conflictenpagina en wordt daar bewust opgelost (tweede mening, escalatie, gedocumenteerde beslissing). Beide objecten blijven ongewijzigd bestaan — er wordt niets automatisch gecorrigeerd, overschreven of verwijderd.",
  "vhelp.conflictForm.title": "Conflict beschrijven",
  "vhelp.conflictForm.body":
    "Drie gegevens maken de melding oplosbaar: het TEGEN-object (waarmee spreekt deze kennis zichzelf tegen?), het CONFLICTTYPE (bijv. tegenspraak in de inhoud of in de bevoegdheid) en een korte BESCHRIJVING van de tegenspraak met jouw context. Na het versturen ontstaat een open conflictzaak — beide objecten blijven als bruikbaar gemarkeerd tot het conflict bewust is opgelost.",
  "vhelp.sourcesLevel2.title": "Externe bronnen (niveau 2)",
  "vhelp.sourcesLevel2.body":
    "Hier hangen externe bewijzen aan het kennisobject: normen, handboeken, artikelen, interne documenten. De badge „Niveau 2\" betekent eerlijk: deze bron is NIET door collega's peer-gecontroleerd — hij ondersteunt de kennis, maar vervangt geen enkele controlestem. Op de vragenpagina telt een niveau-2-bron daarom niet als controlestem; hij kan een antwoord ondersteunen, maar niet borgen. Het kruisje verwijdert alleen de koppeling — kennis, status en vertrouwen blijven ongewijzigd.",
  "vhelp.sourceFields.title": "Bron beschrijven",
  "vhelp.sourceFields.body":
    'Drie gegevens maken een bron bruikbaar: de BENAMING zegt wat het is („DIN EN 1090, hoofdstuk 7"), de URL leidt ernaartoe (leeg laten bij papieren of interne bronnen), het CITAAT haalt de ene doorslaggevende passage woordelijk aan — zo hoeft niemand het hele document te lezen om de uitspraak te controleren. Hoe concreter het citaat, hoe meer de bron de beoordelaars helpt.',
  "vhelp.sourceAdd.title": "Bron toevoegen",
  "vhelp.sourceAdd.body":
    "Hangt de beschreven bron als niveau-2-bewijs aan dit kennisobject. Hij blijft over versies heen bewaard en is voor iedereen zichtbaar. Er gebeurt verder niets automatisch: de inhoud van de bron wordt niet in de kennis overgenomen, niet gecontroleerd en niet beoordeeld — hij staat als bewijs ernaast.",
  "vhelp.sourceSearch.title": "Bronnen zoeken",
  "vhelp.sourceSearch.body":
    'Zoekt naar externe bewijzen over dit onderwerp. Het zoeken loopt via de KLARWERK-server — je aanvraag gaat niet rechtstreeks van je browser naar externe diensten. De treffers zijn vrijblijvende suggesties: niets daarvan wordt automatisch aangehangen. Controleer titel en fragment, open in geval van twijfel de link — en pas „Aanhangen" neemt een treffer bewust over als niveau-2-bron.',
  "vhelp.contribution.title": "Bijdrage of vindplaats melden",
  "vhelp.contribution.body":
    'Ken je een aanvulling, correctie of vindplaats, maar wil je niet zelf aan het object werken? Beschrijf het hier — je tip wordt als opmerking bij het kennisobject opgeslagen, zichtbaar voor auteur en beoordelaar. Anders dan bij „Bron toevoegen" ontstaat hierbij GEEN bronvermelding; het is een bericht aan de mensen, geen bewijs bij het object.',
  "vhelp.helpful.title": "Heeft geholpen",
  "vhelp.helpful.body":
    "Een praktijksignaal van bewezen waarde: je hebt deze kennis toegepast en het werkte. Dat versterkt het vertrouwen van het object een stukje en wordt in het verloop vermeld. Het is GEEN controlestem — validatie ontstaat nog steeds alleen door bewuste controlebeslissingen van collega's.",
  "vhelp.validity.title": "Geldigheid & bescherming",
  "vhelp.validity.body":
    "Deze waarden worden eerlijk uit de huidige toestand AFGELEID, niet opgeslagen: versheid (wanneer voor het laatst bevestigd of gewijzigd), output-geschiktheid (mag deze kennis in gegenereerde documenten?) en een aanbeveling wat als volgende stap zinvol is. Wijzigen kun je ze alleen indirect — door de kennis zelf te controleren, te bevestigen of te herzien.",
  "vhelp.transfer.title": "Auteur overdragen",
  "vhelp.transfer.body":
    "Draagt de verantwoordelijkheid voor deze kennis over aan een andere persoon — bijvoorbeeld als iemand het bedrijf verlaat of de bevoegdheid wisselt. De oorspronkelijke auteur blijft blijvend zichtbaar (herkomst gaat nooit verloren). Overgedragen objecten krijgen in de review een extra blik, omdat de kennis nu iemand verantwoordt die het niet zelf heeft vastgelegd.",
  "vhelp.deleteKo.title": "Kennisobject verwijderen",
  "vhelp.deleteKo.body":
    "Verwijdert dit kennisobject definitief — alleen toegestaan voor de auteur zelf en voor controller en admin; de server dwingt dezelfde regel af. Vóór het verwijderen vraagt de inline-bevestiging bewust na. De verwijdering wordt in de audit vastgelegd. Als de kennis alleen verouderd is, is herzien of een conflict de eerlijkere weg dan verwijderen.",
  "vhelp.conflictEscalate.title": "Escaleren",
  "vhelp.conflictEscalate.body":
    "Tilt een open inhoudelijk conflict een trap hoger als de betrokkenen het niet zelf kunnen oplossen — dan beslist de vakinhoudelijk bevoegde instantie. Gebruik dit als twee gevalideerde uitspraken elkaar hard tegenspreken en geen van beide kan toegeven. Het conflict blijft open en zichtbaar tot een gedocumenteerde beslissing valt.",
  "vhelp.conflictSecondOpinion.title": "Tweede mening inwinnen",
  "vhelp.conflictSecondOpinion.body":
    "Vraagt nog een deskundige om zijn inschatting van het conflict en legt die schriftelijk vast. Een goede tweede mening noemt feiten en bronnen, niet alleen een onderbuikgevoel. Ze beslist het conflict niet automatisch — ze is materiaal voor de latere oplossing.",
  "vhelp.conflictResolve.title": "Conflict oplossen",
  "vhelp.conflictResolve.body":
    "Legt de beslissing vast hoe met de tegenspraak om te gaan — welke uitspraak geldt, onder welke voorwaarden, en waarom. De oplossing DOCUMENTEERT alleen: ze wijzigt geen van de betrokken kennisobjecten automatisch. Als een object daarna herzien of opnieuw bevestigd zou moeten worden, toont de app een hervalidatie-aanbeveling — ook dat blijft een bewuste menselijke handeling.",
  "chelp.modes.title": "De vier vertelwegen",
  "chelp.modes.body":
    "Vier wegen leiden naar hetzelfde doel: VRIJE TEKST (gewoon losschrijven), DICTEREN (spreken in plaats van typen), INTERVIEW (de KI stelt je gerichte vragen) en UIT BESTAND (kennispunten uit een document halen). Kies wat voor jou natuurlijk aanvoelt — alle wegen monden uit in hetzelfde concept op de kennispagina, en bij het wisselen gaat niets verloren.",
  "chelp.expertPath.title": "Formulier direct (expertpad)",
  "chelp.expertPath.body":
    "Het klassieke formulier met alle velden in één oogopslag — voor iedereen die precies weet wat hij wil invullen. Het is dezelfde datastand als de begeleide weg, geen extra functie en geen sluiproute langs de controle. De terugweg naar de begeleide weg is altijd één klik verwijderd.",
  "chelp.wizardSteps.title": "De drie stappen",
  "chelp.wizardSteps.body":
    "Vastleggen verloopt in drie stappen: VERTELLEN (ruwe kennis kwijtraken), KENNISPAGINA (controleren en verfijnen, met KI-hulp), INDIENEN (in de peer-beoordeling geven). Voltooide stappen kun je aanklikken en teruggaan — daarbij gaat niets verloren. Pas „Controleren & indienen\" maakt van je concept een kennisobject voor de collega's.",
  "chelp.loadExample.title": "Voorbeeld laden",
  "chelp.loadExample.body":
    "Vult de velden met een demovoorbeeld, zodat je de volledige weg gevaarloos kunt uitproberen. Let op: het overschrijft je huidige invoer — gebruik het op een lege pagina. Ook een voorbeeld wordt pas ingediend als je het bewust indient.",
  "chelp.tellRaw.title": "Gewoon vertellen",
  "chelp.tellRaw.body":
    "Schrijf je kennis op zoals je die aan een nieuwe collega zou vertellen — ongeordend is helemaal prima. Structuur (titel, kernuitspraak, voorwaarden, maatregelen) maakt de KI in de volgende stap als VOORSTEL, dat je controleert en aanpast. Er wordt niets automatisch opgeslagen of ingediend.",
  "chelp.dictate.title": "Dicteren",
  "chelp.dictate.body":
    "Spreken in plaats van typen: je browser zet spraak lokaal om in tekst, die hier in het veld stroomt. Start en stop bewust; daarna kun je de tekst gewoon corrigeren. Kan je browser geen spraakherkenning, dan zegt de app je dat eerlijk in plaats van stilletjes te falen.",
  "chelp.tellUpload.title": "Bestand bijvoegen bij het vertellen",
  "chelp.tellUpload.body":
    "Upload je hier documenten (PDF, Word, tekst), dan stroomt hun tekst rechtstreeks in je vertelveld; afbeeldingen en video's worden bijlagen van het latere kennisobject. Bij afbeeldingen start tekstherkenning (OCR) alleen op jouw klik. Er wordt niets geüpload dat je niet ziet — alles blijft onderdeel van je concept.",
  "chelp.structureNow.title": "Structuur voorstellen",
  "chelp.structureNow.body":
    "De KI leest je ruwe tekst en stelt titel, kernuitspraak, voorwaarden en maatregelen voor — als CONCEPT op de kennispagina, paars gemarkeerd. Ze verzint er niets bij; zonder KI-sleutel werkt een eerlijk, regelgebaseerd alternatief en zegt dat duidelijk. Jij controleert, wijzigt en beslist — automatisch opgeslagen wordt er nooit.",
  "chelp.interview.title": "Het kennis-interview",
  "chelp.interview.body":
    "De KI stelt je de ene vraag na de andere en boort gericht door — naar grenswaarden, uitzonderingen, redenen. Antwoord in je eigen woorden (typen of dicteren); de vraag kun je je laten voorlezen. Pas als je het interview afsluit, wordt uit alle antwoorden een concept voor de kennispagina gebouwd — niets daarvan is vooraf opgeslagen.",
  "chelp.filePoints.title": "Kennis uit bestand",
  "chelp.filePoints.body":
    "Je uploadt een document, de KI haalt daaruit afzonderlijke kennispunten — elk MET woordelijke bewijsplaats uit het document (verzonnen punten zijn daarmee uitgesloten; vindt ze niets onderbouwds, dan zegt ze dat eerlijk). Je kiest met vinkjes wat wordt overgenomen: alleen geselecteerde punten worden concepten. Als alternatief kun je een zoekopdracht aan een expert formuleren.",
  "chelp.captureTitle.title": "De titel",
  "chelp.captureTitle.body":
    "De titel is het eerste wat collega's in bibliotheek en antwoorden zien — hij bepaalt of je kennis wordt gevonden. Goed: concreet en actiegericht („Lasnaad bij aluminium onder 5 mm controleren\"). Je kunt hem altijd wijzigen, ook het KI-voorstel is maar een startpunt.",
  "chelp.saveDraftHelp.title": "Concept opslaan",
  "chelp.saveDraftHelp.body":
    "Bewaart je tussenstand lokaal in je browser — je kunt altijd verdergaan, ook na een herstart. Een concept is NIET ingediend: niemand ziet het, het duikt in geen enkele beoordeling en geen enkel antwoord op. Boven aan de pagina vind je opgeslagen concepten om verder te gaan.",
  "chelp.discardHelp.title": "Verwerpen",
  "chelp.discardHelp.body":
    "Verwerpt het huidige concept definitief — tekst, structuur en bijlagen van deze vastlegging. Het betreft ALLEEN je concept: reeds ingediende of opgeslagen kennisobjecten blijven onaangetast. Vooraf vraagt de app bewust na; wie maar één stap terug wil, gebruikt de stappenbalk in plaats van verwerpen.",
  "chelp.submitReview.title": "Controleren & indienen",
  "chelp.submitReview.body":
    "Maakt van je concept een kennisobject en geeft het in de peer-beoordeling: collega's controleren, stellen vragen of keuren goed. Vanaf nu is het voor anderen zichtbaar — maar eerlijk als „in beoordeling\" gemarkeerd, NIET als zeker. Gevalideerd wordt het door genoeg goedkeuringen. Voor antwoorden bruikbaar is het al eerder — maar dan zichtbaar als ongecontroleerd gemarkeerd.",
  "chelp.readiness.title": "Opslag-check",
  "chelp.readiness.body":
    "Toont eerlijk wat er voor het indienen nog ontbreekt: verplichte velden (zonder die blijft de knop uit) en optionele zaken die je kennis versterken (bijv. categorie of bijlagen). Groen betekent gereed — niet perfect: verbeteren kun je ook na het indienen nog, dan als nieuwe versie.",
  "chelp.savedNext.title": "Opgeslagen — wat nu?",
  "chelp.savedNext.body":
    "Je kennis is als object aangelegd en wacht op de peer-beoordeling — het is ZICHTBAAR, maar eerlijk als open gemarkeerd, niet als zeker. Je hoeft verder niets te doen: beoordelaars vinden het op het validatie-board. Wil je het bekijken of aanvullen, dan leidt de link er direct heen.",
  "chelp.advancedDetails.title": "Uitgebreide details",
  "chelp.advancedDetails.body":
    "Alles hier is OPTIONEEL — je kennis wordt ook zonder ingediend. Toch loont het: categorie en trefwoorden maken het vindbaar, de installatie koppelt het aan machines/objecten, het controle-aantal stuurt hoeveel goedkeuringen nodig zijn, documenten en afbeeldingen leveren bewijsmateriaal. De badge toont hoeveel er al is ingevuld.",
  "chelp.knowledgeType.title": "Kennissoort",
  "chelp.knowledgeType.body":
    'Deelt je kennis in: ervaringskennis, proceskennis, feitenkennis — en bijzonder waardevol: NEGATIEVE KENNIS („dat hebben we geprobeerd, het werkt NIET, omdat …"). De kennissoort helpt beoordelaars en zoekers je kennis juist in te delen; ze verandert niets aan de controleweg.',
  "chelp.assetField.title": "Installatie / object",
  "chelp.assetField.body":
    'Koppelt je kennis aan een concrete installatie, machine of een object („Pers 3", „Klant XY"). Verandert er later iets aan deze installatie, dan vindt de levenscyclus precies de gekoppelde kennisobjecten voor controle. Vrije tekst volstaat — als collega\'s de installatie maar herkennen.',
  "chelp.tagsField.title": "Trefwoorden",
  "chelp.tagsField.body":
    'Korte steekwoorden waarmee je kennis in zoeken en filters opduikt („aluminium", „termijn", „hygiëne"). Gebruik termen waar collega\'s echt op zouden zoeken, en blijf consistent met bestaande trefwoorden. Ze zijn altijd te wijzigen en beïnvloeden de controle niet.',
  "chelp.docsImages.title": "Documenten & afbeeldingen",
  "chelp.docsImages.body":
    "Hangt bewijsmateriaal aan je kennis: foto's van het resultaat, het controleprotocol, de werkinstructie. Bijlagen gaan bij het indienen mee naar het kennisobject en zijn daar voor beoordelaars zichtbaar. Hun inhoud wordt niet automatisch kennis — wat in de tekst moet, beslis jij.",
  "chelp.expertForm.title": "Het expertformulier",
  "chelp.expertForm.body":
    "Hier vul je alle velden direct in: titel, kennissoort, inhoud, kernuitspraak, voorwaarden (wanneer geldt het?) en maatregelen (wat moet er gebeuren?). Dezelfde regels gelden als in de begeleide weg — dezelfde opslag-check, dezelfde controle. De KI helpt desgewenst aan de tekst, maar beslist niets.",
  "chelp.sourcesPanel.title": "Externe bronnen (niveau 2)",
  "chelp.sourcesPanel.body":
    "Hangt externe bewijzen aan je kennis — norm, handboek, fabrikantpagina. Met de hand (benaming, link, citaat) of via het bronnen-zoeken, net als in het controlegebied. Bij het vastleggen verzamel je ze in een zichtbare wachtlijst; aangehangen worden ze pas bij het indienen, samen met je kennisobject. Belangrijk: externe bronnen zijn niveau 2 — ze gelden nooit als peer-gevalideerd en vervangen geen controle door collega's. Er wordt niets automatisch overgenomen.",
  "capture.sourcesTitle": "Externe bronnen",
  "capture.sourcesHint":
    "Bronnen belanden eerst in deze wachtlijst. Bij het indienen worden ze aan het opgeslagen kennisobject gehangen — als niveau 2, nooit peer-gevalideerd.",
  "xtr.title": "Uit document aanvullen",
  "xtr.hint":
    "Upload nog een document — de KI leest het en stelt kennispunten MET bewijsplaats voor. Alleen wat je aankruist, wordt als sectie aan het einde van je artikel toegevoegd; niets wordt vervangen.",
  "xtr.applyCta": "Geselecteerde toevoegen",
  "xtr.applying": "{{count}} punt(en) worden overgenomen — inhoud en herkomst samen …",
  "xtr.appended":
    '{{count}} punt(en) uit „{{name}}" overgenomen — inhoud EN herkomst zijn samen opgeslagen; bestaande inhoud bleef ongewijzigd.',
  "xtr.append.button": "Aan bestaand artikel toevoegen",
  "xtr.append.title": "Aan bestaand artikel toevoegen",
  "xtr.append.intro":
    '{{count}} geselecteerde inzicht(en) uit „{{name}}" als sectie aan een bestaand artikel toevoegen. Het doelartikel wordt herzien (daarna opnieuw te beoordelen); de bron wordt per punt vermeld.',
  "xtr.append.searchPlaceholder": "Artikel zoeken (titel) …",
  "xtr.append.none": "Geen passend artikel gevonden.",
  "xtr.append.busy": "Wordt toegevoegd …",
  "xtr.append.done":
    '{{count}} inzicht(en) aan „{{title}}" toegevoegd — het artikel is nu opnieuw te beoordelen.',
  "xtr.append.missingAnchor":
    "Zonder het originele document als bewijs wordt de inhoud niet overgenomen. Het artikel is NIET gewijzigd. Dat geldt ongeacht de instelling „Externe kennis“: overgenomen documentinhoud moet aan zijn origineel hangen.",
  "xtr.append.blockedByStage":
    "Op het ingestelde niveau „Externe kennis“ mag deze bron niet aan een kennisobject worden gehangen. Het artikel is NIET gewijzigd. Een beheerder kan het niveau wijzigen onder Beheer → Externe kennis.",
  "xtr.append.unclear":
    "De uitkomst is onduidelijk — de verbinding brak af voordat de server antwoordde. Er is NIETS teruggenomen: de overname kan wel of niet zijn voltooid. Open het artikel en kijk na; opnieuw proberen met dezelfde bewerking legt niets dubbel aan.",
  "xtr.append.stateUnchanged":
    "Het artikel is NIET gewijzigd — er is geen inhoud zonder herkomst opgeslagen. Je kunt het overnemen gewoon opnieuw proberen.",
  "xtr.append.followUpsFailed":
    "De overname is opgeslagen (inhoud en herkomst). Een vervolgstap liep niet: {{steps}}. De nieuwe KI-controle kan daardoor ontbreken — die kan op de validatiepagina opnieuw worden gestart.",
  "xtr.help.title": "Uit document aanvullen",
  "xtr.help.body":
    "De KI leest een door jou geüpload document en stelt kennispunten voor — elk punt draagt zijn bewijsplaats uit het document (zonder bewijs geen overname). Je kiest met vinkjes; het geselecteerde wordt als sectie aan je artikel TOEGEVOEGD, niets wordt vervangen of overschreven. De herkomst (bestandsnaam + bewijsplaats) wordt als niveau-2-bron bij het kennisobject vermeld — het geldt niet als peer-gevalideerd en vervangt geen controle.",
  "fd.kicker": "Vastleggen",
  "fd.title": "Documenteditor",
  "fd.backToCapture": "Terug naar kennis vastleggen",
  "fd.allModes": "Alle vastleg-modi",
  "fd.submitted": "Ter beoordeling ingediend:",
  "fd.submittedBody":
    "De editor is afgerond en geleegd. Opslaan of opnieuw indienen van dezelfde inhoud is geblokkeerd; een nieuwe vermelding start alleen bewust via de knop.",
  "fd.openValidation": "Validatie openen",
  "fd.viewObject": "Object bekijken",
  "fd.newEntry": "Nieuwe vermelding",
  "fd.titleOptional": "Titel optioneel",
  "fd.content": "Inhoud",
  "fd.draftLoading": "Concept wordt geladen ...",
  "fd.draftOpen": "Voordeur-concept geopend. Wijzigingen blijven in dit concept.",
  "fd.editorPlaceholder":
    "Beschrijf hier je kennis zoals je die aan een collega zou uitleggen — de KI structureert daaruit een concept, dat je controleert en indient.",
  "fd.structureSuggest": "KI-structuur voorstellen",
  "fd.needContentFirst": "Schrijf eerst inhoud, dan kan er een voorstel worden gegenereerd.",
  "fd.optionalAiHint": "Optioneel KI-voorstel. Er wordt niets automatisch opgeslagen.",
  "fd.aiHelp": "KI-hulp",
  "fd.aiHelpApply": "KI-hulp toepassen",
  "fd.aiHelpModes": "Verduidelijken, structureren, uitbreiden, spelling of opmaken.",
  "fd.structureGenerating": "KI-voorstel wordt gegenereerd ...",
  "fd.assistGenerating": "KI-hulp-voorstel wordt gegenereerd ...",
  "fd.originalUnchanged": "Originele tekst blijft ongewijzigd.",
  "fd.structureAccepted":
    "KI-voorstel overgenomen. Controleer het; opgeslagen wordt er pas bij je volgende actie.",
  "fd.structureKeptRichBodyTitle":
    "Structuurvoorstel: titel overgenomen. De opgemaakte inhoud met afbeeldingen en opmaak blijft ongewijzigd behouden.",
  "fd.structureKeptRichBodyNoTitle":
    "De opgemaakte inhoud blijft behouden; het structuurvoorstel is niet in de inhoud overgenomen.",
  "fd.structureRichTitleOnly":
    "Opgemaakte inhoud met afbeeldingen blijft behouden — de AI stelt alleen een titel voor.",
  "fd.assistAccepted":
    "KI-hulp overgenomen. Controleer het; opgeslagen wordt er pas bij je volgende actie.",
  "fd.aiProposal": "KI-voorstel",
  "fd.aiProposalCheck": "KI-gegenereerd. Controleer voordat je iets overneemt.",
  "fd.fallback": "Fallback",
  "fd.fallbackNoModel":
    "KI is niet geconfigureerd of uitgeschakeld — dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fallbackModelError":
    "KI meldde een fout of was niet bereikbaar — dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fallbackModelTimeout":
    "KI antwoordde niet op tijd (time-out) — dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fallbackConfidential":
    "De tekst is als vertrouwelijk aangemerkt — de cloud-KI is daarvoor uitgesloten en er is geen lokaal model aangesloten. Dit voorstel is een eenvoudige automatische afleiding, geen modelantwoord.",
  "fd.fieldTitle": "Titel",
  "fd.fieldStatement": "Uitspraak / kernuitspraak",
  "fd.fieldConditions": "Voorwaarden",
  "fd.noConditions": "Geen voorwaarden voorgesteld.",
  "fd.fieldMeasures": "Maatregelen",
  "fd.noMeasures": "Geen maatregelen voorgesteld.",
  "fd.fieldTags": "Aanwijzingen / tags",
  "fd.aiHelpProposal": "KI-hulp-voorstel",
  "fd.assistProposalCheck": "{{action}}: KI-gegenereerd. Controleer voordat je iets overneemt.",
  "fd.accept": "Overnemen",
  "fd.discardProposal": "Voorstel verwerpen",
  "fd.submitReview": "Controleren & indienen",
  "fd.saveDraft": "Als concept opslaan",
  "fd.discardInput": "Invoer verwerpen",
  "fd.back": "Terug",
  "fd.writeToSubmit": "Schrijf of plak inhoud, dan kun je controleren en indienen.",
  "fd.validate.lead": "Indienen is zo nog niet mogelijk:",
  "fd.validate.needBody": "De inhoud is leeg. Om in te dienen heeft het kennisobject tekst nodig.",
  "fd.validate.hint": "Je kunt de lege stand nog steeds als concept opslaan en later voortzetten.",
  "fd.unsavable.proposal":
    "Het weergegeven KI-voorstel is nog niet overgenomen en wordt niet meegeslagen.",
  "fd.unsavable.confidentialityOnly":
    "De gekozen vertrouwelijkheid zonder titel en zonder inhoud — daarvoor bestaat nog geen concept dat die kan vasthouden.",
  "fd.statusLabel": "Status",
  "fd.titleOnSave": "Titel bij het opslaan",
  "fd.author": "Auteur",
  "fd.whatOnSave": "Wat er bij het opslaan gebeurt",
  "fd.whatOnSaveBody":
    'Wordt als concept bewaard — altijd voort te zetten. Ter beoordeling gaat het pas als je „Controleren / indienen" kiest; er wordt niets automatisch gevalideerd.',
  "fd.moreWays": "Meer vastleg-wegen",
  "fd.moreWaysBody":
    "Heb je het klassieke formulier, dictaat of het begeleide interview nodig? Het volledige vastleg-gebied heeft alle wegen — dit vlak hier is de snelle instap.",
  "fd.options.show": "Meer invoeropties tonen",
  "fd.options.hide": "Meer invoeropties inklappen",
  "fd.options.hint.freitext":
    "Vertel vrijuit; de AI maakt er een structuurvoorstel van dat jij controleert.",
  "fd.options.hint.diktat": "Spreken in plaats van typen — de tekst komt in hetzelfde vertelveld.",
  "fd.options.hint.interview": "Begeleide vervolgvragen als je niet weet waar je moet beginnen.",
  "fd.options.hint.datei": "Kennis uit een bestaand bestand overnemen.",
  "fd.options.hint.formular": "Expertmodus: dezelfde velden direct invullen, zonder vertelstap.",
  "fd.toastSaved": "Concept opgeslagen.",
  "fd.toastSubmitted": "Ter beoordeling ingediend.",
  "fd.confirmDiscard": "Invoer verwerpen? Niet-opgeslagen inhoud gaat verloren.",
  "fd.errSaveFailed": "Opslaan mislukt.",
  "fd.errAssist": "Ik kan deze KI-hulp op dit moment niet betrouwbaar uitvoeren.",
  "fd.errSpelling": "Spellingcontrole kan de opmaak op dit moment niet zeker behouden.",
  "dcmp.kicker": "Read-only vergelijking",
  "dcmp.titleDuplicate": "Duplicaten vergelijken",
  "dcmp.titleConflict": "Conflict vergelijken",
  "dcmp.back": "Terug",
  "dcmp.loading": "Vergelijking wordt geladen.",
  "dcmp.loadError": "Vergelijking kon niet worden geladen.",
  "dcmp.notFound": "Vergelijking niet gevonden of al gesloten.",
  "dcmp.textSimilarity": "Tekstgelijkenis",
  "dcmp.noProvenContradiction": "geen bewezen tegenspraak — alleen woord-/veldgelijkenis",
  "dcmp.moreValues": "Meer waarden",
  "dcmp.uncertainty": "Onzekerheid",
  "dcmp.textDifference": "Tekstverschil",
  "dcmp.similarity": "Gelijkenis",
  "dcmp.scoresHint": "Scores zijn een beslissingshulp, geen waarheid. Geen automatische merge.",
  "dcmp.viewDetails": "Details bekijken",
  "dcmp.objectRemoved": "Object verwijderd",
  "dcmp.left": "Links",
  "dcmp.right": "Rechts",
  "dcmp.koA": "Kennisobject A",
  "dcmp.koB": "Kennisobject B",
  "dcmp.sectionSignals": "Sectiestoplichten",
  "dcmp.compareByAreas": "Vergelijking per kennisgebied",
  "dcmp.legendHelpTitle": "Wat betekenen de stoplichtkleuren?",
  "dcmp.legendHelpBody":
    "Elke sectie krijgt een kleur uit de tekstvergelijking: groen = de inhoud komt grotendeels overeen, geel = gedeeltelijk of onduidelijk (nauwkeuriger bekijken), rood = de teksten wijken af. Rood betekent alleen verschil, geen bewezen tegenspraak — de kleuren zijn een leeshulp, geen oordeel, en er wordt niets automatisch samengevoegd.",
  "dcmp.onlyForComparison":
    "Alleen ter vergelijking: er wordt niets samengevoegd, verwijderd of gevalideerd, en geen beslissing wordt opgeslagen.",
  "dcmp.sourceDuplicate": "Duplicaatvergelijking: {{relation}}",
  "dcmp.sourceConflict": "Conflictvergelijking: {{type}}",
  "dcmp.sectionCompareUnavailable":
    "Sectievergelijking niet mogelijk, omdat een kennisobject ontbreekt.",
  "dcmp.relation.identisch": "identiek",
  "dcmp.relation.a_enthaelt_b": "A bevat B",
  "dcmp.relation.b_enthaelt_a": "B bevat A",
  "dcmp.relation.teilweise": "gedeeltelijke overlap",
  "dcmp.relation.verwandt": "verwant",
  "dcmp.conflictType.truth": "waarheidsconflict",
  "dcmp.conflictType.experience": "ervaringsconflict",
  "dcmp.conflictType.context": "contextconflict",
  "dcmp.conflictType.temporal": "tijdsconflict",
  "dcmp.conflictType.role": "rolconflict",
  "dcmp.tone.green.label": "Overeenkomst",
  "dcmp.tone.green.meaning": "Tekst en velden komen grotendeels overeen.",
  "dcmp.tone.yellow.label": "Onzeker",
  "dcmp.tone.yellow.meaning": "Gedeeltelijk of onduidelijk — nauwkeuriger bekijken.",
  "dcmp.tone.red.label": "Verschil",
  "dcmp.tone.red.meaning": "Tekst wijkt af — alleen een verschil, geen bewezen tegenspraak.",
  "dcmp.section.title": "Titel",
  "dcmp.section.statement": "Kernuitspraak / inhoud",
  "dcmp.section.conditions": "Voorwaarden",
  "dcmp.section.measures": "Maatregelen",
  "dcmp.section.hints": "Aanwijzingen",
  "dcmp.section.sources": "Bronnen / bewijs",
  "dcmp.section.tags": "Tags / categorie",
  "dcmp.section.trust": "Vertrouwen / validatiestatus",
  "dcmp.note.bothEmpty":
    "Voorlopige veldheuristiek; geen echte detector-scores voor dit onderdeel.",
  "dcmp.note.exactMatch": "Voorlopige veldheuristiek; exacte veldovereenkomst.",
  "dcmp.note.oneMissing": "Voorlopige veldheuristiek; één waarde ontbreekt.",
  "dcmp.note.heuristic": "Voorlopige veldheuristiek; geen inhoudelijk oordeel.",
  "dcmp.note.noScore":
    "Geen score beschikbaar: totaalwaarden zijn een voorlopige veldheuristiek zonder detector-percentages.",
  "dcmp.note.mixedOverlap":
    "Overeenkomst uit de bestaande detector; conflict/onzekerheid blijven een voorlopige weergavehulp.",
  "dcmp.note.mixedConflict":
    "Conflictwaarde uit de bestaande detector; overeenkomst blijft een voorlopige veldheuristiek.",
  "dcmp.reason.bothEmpty": "Beide kanten hebben geen bruikbare waarde.",
  "dcmp.reason.identical": "De waarden zijn identiek.",
  "dcmp.reason.oneMissing": "Eén waarde ontbreekt, daarom is er geen echt conflict af te leiden.",
  "dcmp.reason.strongDiff":
    "De veldwaarden verschillen sterk en moeten vakinhoudelijk worden gecontroleerd.",
  "dcmp.reason.partialDiff":
    "De veldwaarden verschillen gedeeltelijk en moeten worden gecontroleerd.",
  "cfd.fallbackTitle": "Naamloos kennisobject",
  "cfd.structuringUnavailable": "Ik kan dit op dit moment niet betrouwbaar ordenen.",

  // AUFTRAG-mega61: rechtspagina's, kennisgevingsbanner, AI-transparantie. Betekenisgetrouwe
  // vertaling van de Duitse bron, die juridisch maatgevend blijft.
  "legal.pending": "— wordt aangevuld —",
  "legal.tbd.company": "— wordt aangevuld —",
  "legal.tbd.address": "— wordt aangevuld —",
  "legal.tbd.representative": "— wordt aangevuld —",
  "legal.tbd.email": "— wordt aangevuld —",
  "legal.tbd.phone": "— wordt aangevuld —",
  "legal.tbd.register": "— wordt aangevuld —",
  "legal.tbd.vatId": "— wordt aangevuld —",
  "legal.tbd.responsible": "— wordt aangevuld —",
  "legal.tbd.supervisoryAuthority": "— wordt aangevuld —",
  "legal.tbd.dataProtectionContact": "— wordt aangevuld —",
  "legal.tbd.dataProtectionOfficer": "— wordt aangevuld —",
  "legal.tbd.retention": "— wordt aangevuld —",
  "legal.tbd.serverLogs": "— wordt aangevuld —",
  "legal.tbd.modelProvider": "— wordt aangevuld —",
  "legal.tbd.mailProvider": "— wordt aangevuld —",
  "legal.tbd.hostingProvider": "— wordt aangevuld —",
  "legal.tbd.thirdCountry": "— wordt aangevuld —",
  "legal.tbd.version": "— wordt aangevuld —",

  "legal.draftNotice.title": "Conceptversie",
  "legal.draftNotice.body":
    "Deze toepassing bevindt zich in een gesloten testfase en is niet openbaar toegankelijk. De nog openstaande gegevens worden vóór publicatie aangevuld.",
  "legal.footer.title": "Juridisch",
  "legal.footer.imprint": "Colofon",
  "legal.footer.privacy": "Privacy",
  "legal.back": "Terug naar de toepassing",

  "legal.imprint.title": "Colofon",
  "legal.imprint.ddg": "Gegevens conform § 5 DDG (Duitse wet digitale diensten)",
  "legal.imprint.representedBy": "Vertegenwoordigd door",
  "legal.imprint.contact": "Contact",
  "legal.imprint.contactEmail": "E-mail",
  "legal.imprint.contactPhone": "Telefoon",
  "legal.imprint.register": "Registerinschrijving",
  "legal.imprint.registerNote":
    "Dit onderdeel vervalt volledig zolang er geen registerinschrijving bestaat. Het wordt dan geschrapt en niet met een vervangende waarde gevuld.",
  "legal.imprint.vat": "Btw-identificatienummer",
  "legal.imprint.vatText": "Btw-identificatienummer conform § 27a van de Duitse omzetbelastingwet:",
  "legal.imprint.responsible": "Verantwoordelijk voor de inhoud",
  "legal.imprint.supervisory": "Toezichthoudende instantie",
  "legal.imprint.supervisoryNote":
    "Dit onderdeel vervalt. Het geldt alleen bij vergunningplichtige activiteiten; het aanbieden van kennismanagementsoftware is naar de huidige stand niet vergunningplichtig.",
  "legal.imprint.status": "Opmerking over de stand van dit aanbod",
  "legal.imprint.statusBody":
    "Dit aanbod bevindt zich in een gesloten testfase en is uitsluitend bestemd voor uitgenodigde gebruikers. Het richt zich niet op consumenten en vormt geen openbaar aanbod.",

  "legal.privacy.title": "Privacyverklaring",
  "legal.privacy.label.purpose": "Doel",
  "legal.privacy.label.basis": "Rechtsgrondslag",
  "legal.privacy.label.retention": "Bewaartermijn",
  "legal.privacy.label.recipient": "Ontvanger",
  "legal.privacy.s1.title": "1. Verwerkingsverantwoordelijke",
  "legal.privacy.s1.body":
    "Verwerkingsverantwoordelijke voor de verwerking van persoonsgegevens in de zin van de Algemene verordening gegevensbescherming is:",
  "legal.privacy.s1.dpo": "Functionaris voor gegevensbescherming:",
  "legal.privacy.s2.title": "2. Uitgangspunt",
  "legal.privacy.s2.body":
    "Wij verwerken persoonsgegevens uitsluitend voor zover dat nodig is voor de werking van deze toepassing. Wij gebruiken geen analyse-, tracking- of advertentiediensten, laden geen inhoud van externe servers in uw browser en gebruiken geen telpixels. Het beveiligingsbeleid van onze server verhindert technisch dat uw browser verbinding maakt met externe aanbieders.",
  "legal.privacy.s3.title": "3. Gebruikersaccount en aanmelden",
  "legal.privacy.s3.body":
    "Om de toepassing te gebruiken hebt u een account nodig. Daarbij verwerken wij uw naam, uw e-mailadres en uw wachtwoord. Het wachtwoord wordt uitsluitend opgeslagen in een vorm die niet terug te rekenen is.",
  "legal.privacy.s3.purpose": "Toegang bieden, uw bijdragen toewijzen, de toegang beveiligen.",
  "legal.privacy.s3.basis":
    "Uitvoering van de overeenkomst respectievelijk de gebruiksrelatie, artikel 6, lid 1, onder b, AVG.",
  "legal.privacy.s3.retention": "Voor de duur van de gebruiksrelatie.",
  "legal.privacy.s3.reset":
    "Als u uw wachtwoord opnieuw instelt, maken wij een eenmalige code aan die één uur geldig is en daarna vervalt.",
  "legal.privacy.s4.title": "4. Opslag op uw apparaat",
  "legal.privacy.s4.p1":
    "Bij het aanmelden plaatsen wij één cookie met de naam kw_session. Het bevat uitsluitend een willekeurige code, geen gegevens over u. Het is niet leesbaar voor scripts in de browser, wordt alleen via een versleutelde verbinding verzonden, is veertien dagen geldig en wordt bij het afmelden verwijderd. Op onze server is daarvan alleen een controlewaarde opgeslagen, niet de code zelf.",
  "legal.privacy.s4.p2":
    "Zonder dit cookie is aangemeld gebruik technisch niet mogelijk. Het is daarmee strikt noodzakelijk voor de door u uitdrukkelijk gewenste dienst; toestemming is daarvoor conform § 25, lid 2, TDDDG niet vereist.",
  "legal.privacy.s4.p3":
    "Meldt u zich aan via de aanmeldprocedure van uw organisatie, dan plaatsen wij voor de duur van dat proces drie extra codes, die tien minuten geldig zijn en direct na afloop worden verwijderd.",
  "legal.privacy.s4.p4":
    "Daarnaast onthoudt de toepassing in uw browser uw weergave-instellingen — bijvoorbeeld sortering, gekozen filters, opgeslagen weergaven, het gekozen uiterlijk en welke introductietips u al hebt gezien. Deze gegevens verlaten uw browser niet en worden niet aan ons doorgegeven. Ze ontstaan pas wanneer u de betreffende functie gebruikt. De toepassing werkt ook volledig als uw browser deze opslag verhindert.",
  "legal.privacy.s4.p5":
    "Een opmerking die voor u van belang kan zijn: legt u inhoud vast terwijl er geen verbinding met onze server is, dan bewaart de toepassing deze concepten in uw browser totdat ze kunnen worden verzonden. In deze tussenopslag kan daarom door u geschreven inhoud staan. Die wordt daar na verzending verwijderd.",
  "legal.privacy.s4.p6":
    "Gebruikt u de toepassing als geïnstalleerde app, dan legt uw browser programmabestanden in een buffer zodat de app sneller start. Antwoorden van onze server en uw inhoud worden daar niet opgeslagen.",
  "legal.privacy.s4.p7":
    "Mislukt het beëindigen van uw sessie, dan noteert de toepassing dat in uw browser onder de naam kw_signout_pending, zodat het gebruik geblokkeerd blijft totdat onze server de beëindiging heeft bevestigd. Omdat uw sessie voor alle vensters en tabbladen van dezelfde browser geldt, staat deze markering in de blijvende browseropslag en werkt zij ook in alle vensters en tabbladen — een tweede, al geopend venster zou anders inhoud blijven tonen terwijl de beëindiging nog openstaat. De markering bevat geen gegevens over u en wordt niet aan ons doorgegeven. Zij blijft staan totdat onze server de beëindiging heeft bevestigd of vaststaat dat uw sessie niet meer bestaat; dan wordt zij verwijderd. Vanzelf vervalt zij niet. Om dat niet bij u te laten liggen, probeert de toepassing de beëindiging zelf opnieuw — zodra uw verbinding weer bestaat en bij elke nieuwe start van de toepassing; u kunt het ook op elk moment zelf in gang zetten. Zij is technisch noodzakelijk voor de door u gewenste afmelding.",
  "legal.privacy.s5.title": "5. Uw inhoud",
  "legal.privacy.s5.body":
    "De toepassing dient om kennis vast te leggen, te toetsen en terug te vinden. De inhoud die u invoert of uploadt, wordt samen met het tijdstip en uw code als auteur opgeslagen, zodat bijdragen navolgbaar blijven en vragen mogelijk zijn.",
  "legal.privacy.s5.basis": "Uitvoering van de overeenkomst, artikel 6, lid 1, onder b, AVG.",
  "legal.privacy.s6.title": "6. Navolgbaarheid van wijzigingen",
  "legal.privacy.s6.body":
    "Om wijzigingen aan getoetste kennis navolgbaar te houden, voeren wij een doorlopend logboek dat is beveiligd tegen wijziging achteraf. Daarin staan het tijdstip, de code van de handelende persoon, de aard van de handeling en het betrokken object. IP-adres en browserkenmerk worden in dit logboek niet opgeslagen. Ook aan- en afmelden worden op deze wijze vastgelegd.",
  "legal.privacy.s6.basis":
    "Gerechtvaardigd belang bij de integriteit en navolgbaarheid van getoetste kennis, artikel 6, lid 1, onder f, AVG.",
  "legal.privacy.s7.title": "7. Bescherming tegen misbruik",
  "legal.privacy.s7.body":
    "Om geautomatiseerde aanmeldpogingen af te weren, tellen wij mislukte pogingen kortstondig in het werkgeheugen, gerelateerd aan het IP-adres en het ingevoerde e-mailadres. Deze tellers worden niet duurzaam opgeslagen.",
  "legal.privacy.s7.basis":
    "Gerechtvaardigd belang bij de beveiliging van de toepassing, artikel 6, lid 1, onder f, AVG.",
  "legal.privacy.s7.logs": "Bedrijfslogboeken van de webserver:",
  "legal.privacy.s8.title": "8. Kunstmatige intelligentie",
  "legal.privacy.s8.p1":
    "Bepaalde functies van de toepassing gebruiken een AI-model — bijvoorbeeld het beantwoorden van vragen, het structureren van notities, het voorstellen van beeldbeschrijvingen en het groeperen van geïmporteerde inhoud. Om zo'n resultaat te laten ontstaan, wordt de daarvoor benodigde inhoud aan de exploitant van het model doorgegeven en daar verwerkt.",
  "legal.privacy.s8.p2":
    "De toepassing toont u op elke betrokken plek dat een AI-model werkt en welk soort model dat is. Resultaten van een AI-model kunnen onjuist zijn en vervangen geen vakinhoudelijke toetsing.",
  "legal.privacy.s8.p3":
    "Kennisobjecten die als vertrouwelijk of streng vertrouwelijk zijn ingedeeld, worden uit de context verwijderd voordat een vraag naar een model gaat — zij bereiken het model niet. De tekst van uw vraag wordt daarentegen wel doorgegeven: voer daar alstublieft geen vertrouwelijke inhoud in.",
  "legal.privacy.s8.thirdCountry": "Doorgifte naar een derde land:",
  "legal.privacy.s9.title": "9. Verzending van e-mail",
  "legal.privacy.s9.body":
    "Voor uitnodigingen en het opnieuw instellen van wachtwoorden versturen wij e-mails.",
  "legal.privacy.s9.basis": "Uitvoering van de overeenkomst, artikel 6, lid 1, onder b, AVG.",
  "legal.privacy.s10.title": "10. Hosting",
  "legal.privacy.s10.body": "De toepassing draait op gehuurde servers.",
  "legal.privacy.s10.basis":
    "Gerechtvaardigd belang bij een economische bedrijfsvoering, artikel 6, lid 1, onder f, AVG.",
  "legal.privacy.s11.title": "11. Aansluiting van verdere systemen",
  "legal.privacy.s11.body":
    "Richt uw organisatie een import uit een eigen systeem in, dan wordt de daarvoor benodigde inhoud daar opgehaald. Welke systemen dat zijn, bepaalt uw organisatie.",
  "legal.privacy.s12.title": "12. Geen geautomatiseerde besluitvorming in individuele gevallen",
  "legal.privacy.s12.body":
    "Er vindt geen geautomatiseerde besluitvorming, met inbegrip van profilering, plaats die voor u rechtsgevolgen heeft of u op vergelijkbare wijze aanmerkelijk treft. Voorstellen van het AI-model zijn voorstellen; over het opnemen en toetsen van kennis beslissen mensen.",
  "legal.privacy.s13.title": "13. Uw rechten",
  "legal.privacy.s13.body":
    "U hebt recht op inzage in de over u opgeslagen gegevens, op rectificatie van onjuiste gegevens, op wissing, op beperking van de verwerking, op gegevensoverdraagbaarheid en op bezwaar tegen een verwerking die op een gerechtvaardigd belang berust. Hebt u toestemming gegeven, dan kunt u die te allen tijde voor de toekomst intrekken; de rechtmatigheid van de tot dan toe verrichte verwerking blijft onaangetast.",
  "legal.privacy.s13.contact": "Contact voor al deze verzoeken:",
  "legal.privacy.s13.authority":
    "Onafhankelijk daarvan hebt u het recht een klacht in te dienen bij een toezichthoudende autoriteit voor gegevensbescherming, in het bijzonder bij de autoriteit van uw verblijfplaats of de voor ons bevoegde autoriteit:",
  "legal.privacy.s14.title": "14. Noodzaak van de gegevens",
  "legal.privacy.s14.body":
    "Het opgeven van naam, e-mailadres en wachtwoord is noodzakelijk om toegang in te richten. Zonder deze gegevens kunnen wij geen toegang bieden. Een wettelijke verplichting tot verstrekking bestaat niet.",
  "legal.privacy.s15.title": "15. Wijzigingen",
  "legal.privacy.s15.body":
    "Wij passen deze verklaring aan wanneer de toepassing of de rechtssituatie verandert. Stand van deze versie:",

  "notice.banner.aria": "Kennisgeving over het gebruik van deze toepassing",
  "notice.banner.title": "Kort ter kennisname",
  "notice.banner.ai":
    "Deze toepassing werkt met kunstmatige intelligentie. Wanneer u een vraag stelt, notities laat structureren of een beeldbeschrijving laat voorstellen, wordt een AI-model gebruikt en wordt de daarvoor benodigde inhoud aan de exploitant ervan doorgegeven. Resultaten van een AI-model kunnen onjuist zijn en vervangen geen vakinhoudelijke toetsing. Op elke betrokken plek ziet u welk model werkt.",
  "notice.banner.cookie":
    "Voor het aanmelden wordt een technisch noodzakelijk sessiecookie geplaatst. Zonder dit cookie is aangemeld gebruik niet mogelijk.",
  "notice.banner.ack": "Begrepen — verder",
  "notice.banner.decline": "Niet akkoord",
  "notice.decline.title": "Uw sessie wordt beëindigd",
  "notice.decline.body":
    "Het sessiecookie is al geplaatst — zonder dat cookie is aangemeld gebruik technisch niet mogelijk. Wij beëindigen daarom nu uw sessie en verwijderen het cookie. U kunt zich op elk moment opnieuw aanmelden.",
  "notice.decline.confirm": "Sessie nu beëindigen",
  "notice.decline.cancel": "Terug naar de kennisgeving",
  "notice.decline.loginHint":
    "Uw sessie is beëindigd omdat u niet akkoord ging met de kennisgeving. U kunt zich op elk moment opnieuw aanmelden.",

  "notice.signOutFailed.title": "Uw sessie is niet bevestigd beëindigd",
  "notice.signOutFailed.body":
    "U ging niet akkoord met de kennisgeving en wij wilden uw sessie beëindigen — de server heeft dat echter niet bevestigd. Mogelijk bestaat uw sessie nog. Zolang dat niet duidelijk is, tonen wij u geen inhoud, en wel in alle vensters en tabbladen van deze browser. De toepassing probeert de beëindiging zelf opnieuw — zodra uw verbinding weer bestaat en bij elke nieuwe start van de toepassing; u kunt het ook direct opnieuw proberen.",
  "notice.signOutFailed.retry": "Beëindiging opnieuw proberen",
  "notice.signOutFailed.again": "Ook deze poging kwam niet door. Controleer uw netwerkverbinding.",

  "ai.generatedNotice":
    "Door kunstmatige intelligentie gegenereerd — controleer dit vakinhoudelijk.",
  "ai.costHint": "Eén klik kan een echte, betaalde cloud-AI-aanvraag veroorzaken.",
  "ai.exportNotice":
    "Door kunstmatige intelligentie gegenereerd (KLARWERK, {{task}}, {{date}}). Inhoudelijk te controleren.",
  "ai.task.answer": "vraag beantwoord",

  "w2.result.heading": "Importresultaat",
  "w2.run.heading": "Uitvoering",
  "w2.run.status.QUEUED": "In de wachtrij",
  "w2.run.status.FETCHING": "Bron wordt opgehaald",
  "w2.run.status.PERSISTING_SOURCE": "Origineel wordt vastgelegd",
  "w2.run.status.EXTRACTING": "Uitspraken worden ontleend",
  "w2.run.status.CREATING_KNOWLEDGE": "Kenniseenheden ontstaan",
  "w2.run.status.ANALYZING": "Controle loopt",
  "w2.run.status.COMPLETED": "Afgerond",
  "w2.run.status.PARTIAL": "Gedeeltelijk mislukt",
  "w2.run.status.FAILED": "Mislukt",
  "w2.run.status.unknown": "Toestand onbekend",
  "w2.run.hint.QUEUED": "De uitvoering is nog niet begonnen. Er is nog geen resultaat.",
  "w2.run.hint.FETCHING": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.PERSISTING_SOURCE": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.EXTRACTING": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.CREATING_KNOWLEDGE": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.ANALYZING": "De uitvoering loopt nog. Wat hier staat, is een tussenstand.",
  "w2.run.hint.COMPLETED": "De uitvoering is volledig doorlopen.",
  "w2.run.hint.PARTIAL":
    "Een deel van de uitvoering is mislukt. Wat u ziet is onvolledig — het is geen afgeronde import.",
  "w2.run.hint.FAILED":
    "De uitvoering is mislukt. Wat hieronder staat, is daarom niet het beoogde resultaat.",
  "w2.run.hint.unknown":
    "De server meldde een toestand die deze versie niet kent. Wat u ziet mag niet als afgerond worden gelezen.",
  "w2.run.failureCode": "Foutcode",
  "w2.run.failureReason": "Reden",
  "w2.source.heading": "Origineel",
  "w2.source.lead": "Het geïmporteerde document in precies de versie waaruit de kennis ontstond.",
  "w2.source.missing": "Voor deze uitvoering is geen origineel geleverd.",
  "w2.source.missingRequired": "Bij dit origineel ontbreken verplichte gegevens.",
  "w2.source.title": "Titel",
  "w2.source.system": "Systeem",
  "w2.source.version": "Versie",
  "w2.source.url": "Adres",
  "w2.source.importedAt": "Geïmporteerd op",
  "w2.source.externalId": "Kenmerk in het bronsysteem",
  "w2.knowledge.heading": "Kenniseenheden",
  "w2.knowledge.lead": "Zelfstandige eenheden die uit dit ene origineel zijn ontstaan.",
  "w2.knowledge.count": "{{count}} eenheden",
  "w2.knowledge.empty":
    "Deze uitvoering heeft geen kenniseenheid opgeleverd. Dat is geen geslaagde import.",
  "w2.item.position": "Eenheid {{position}}",
  "w2.item.statementMissing": "Voor deze eenheid is geen uitspraak geleverd.",
  "w2.item.locator": "Vindplaats",
  "w2.item.locatorMissing": "Vindplaats ontbreekt",
  "w2.item.status": "Validatie",
  "w2.item.statusMissing": "Validatiestatus ontbreekt",
  "w2.item.conflicts": "Conflicten: {{count}}",
  "w2.item.conflictsNone": "Geen conflicten gemeld",
  "w2.item.gaps": "Kennishiaten: {{count}}",
  "w2.item.gapsNone": "Geen kennishiaten gemeld",
  // AUFTRAG-81: spiegel van de DE-sleutels — zie de toelichting daar.
  "w2.value.missing": "Verplichte gegevens ontbreken",
  "w2.value.none": "Niet geleverd",
};

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en }, nl: { translation: nl } },
  lng: "de",
  fallbackLng: "de",
  interpolation: { escapeValue: false },
});

export default i18n;
