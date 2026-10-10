// ================================================================================================
// BETROFFENENRECHTE · DAS DATENINVENTAR UND DAS VERARBEITUNGSVERZEICHNIS AUS DEM SYSTEM SELBST.
// ================================================================================================
//
// R-0583: „Für jede Datenart ist festgehalten, was sie enthält, ob ein Personenbezug möglich ist und
// wo sie liegt — einschliesslich der ehrlichen Befunde, dass KI-Läufe keine Inhalte speichern und
// Wissenslücken den Fragetext enthalten."
// R-0667: „Das Verzeichnis der Verarbeitungstätigkeiten … soll aus dem System selbst entstehen und
// exportierbar sein — statt als gepflegtes Dokument daneben zu liegen."
//
// WARUM DAS HIER IM CODE STEHT UND NICHT (NUR) IN DER DOKU: Die Klassifikation lag bis hierher als
// Tabelle in `docs/compliance/data-protection-requirements.md` §1 — acht Zeilen, während `migrate()`
// über fünfzig Tabellen anlegt. Neue Tabellen kamen dazu, die Tabelle wuchs nicht mit. Dieses
// Inventar ist an die ausgeführte Migration GEBUNDEN: `tests/betroffenenrechte/dateninventar.test.ts`
// verlangt, dass jede Tabelle, die `migrate()` anlegt, genau einer Datenart zugeordnet ist, und
// umgekehrt. Kommt eine Migration dazu und das Inventar nicht, ist das Tor rot.
//
// WAS DIESES INVENTAR NICHT IST: keine Rechtsberatung und keine Festlegung. Rechtsgrundlage (Art. 6),
// Verantwortlicher, Datenschutzbeauftragter und die Fristen, die der Code nicht kennt, trägt der
// Betreiber ein — sie stehen im Verzeichnis ausdrücklich als „vom Betreiber festzulegen", nicht als
// erfundener Wert. Die Angaben zu Löschweg und Frist beschreiben den Stand des CODES, nicht einen
// Sollzustand; die offenen Löschfragen stehen in `docs/entscheidungen/loeschung-aufbewahrung.md`.

export type Personenbezug = "ja" | "moeglich" | "nein";

export type TaetigkeitId =
  | "konten"
  | "wissen"
  | "pruefung"
  | "fragen"
  | "ki"
  | "nachweis"
  | "import"
  | "management"
  | "lernpfade"
  | "betroffenenrechte"
  | "betrieb";

/** Ob die Datenart in der Selbstauskunft („Meine Daten") steht — und wenn nicht, warum nicht. */
export type Selbstauskunft = { enthalten: true } | { enthalten: false; grund: string };

export interface Datenart {
  id: string;
  name: string;
  /** Was die Datenart enthält. */
  inhalt: string;
  personenbezug: Personenbezug;
  /** Worin der Personenbezug besteht bzw. warum keiner besteht. */
  personenbezugGrund: string;
  /** Wo sie liegt: die Tabellen aus `migrate()` (leer bei Daten ausserhalb der Datenbank) und der Ort. */
  ablage: { ort: string; tabellen: readonly string[] };
  taetigkeit: TaetigkeitId;
  /** Der heutige Löschweg laut Code. */
  loeschung: string;
  /** Die heutige Frist laut Code — oder ausdrücklich „vom Betreiber festzulegen". */
  frist: string;
  selbstauskunft: Selbstauskunft;
  /** Ehrliche Befunde, die eine Folgenabschätzung kennen muss. */
  befund?: string;
}

const DATENBANK = "PostgreSQL-Datenbank der Kundeninstanz";
const BETREIBERFRIST = "Keine Frist im Code — vom Betreiber festzulegen.";
const PAPIERKORB =
  "Löschen legt in den Papierkorb; Endlöschung nach 30 Tagen (TRASH_RETENTION_DAYS) oder vorher durch Verwalter.";

export const DATENINVENTAR: readonly Datenart[] = [
  {
    id: "konten",
    name: "Benutzerkonten",
    inhalt:
      "Name, E-Mail-Adresse, Rolle, Freigabestatus, Anlagezeitpunkt, Passwort als Hash mit Salt (kein Klartext), Quittung des Hinweises (Zeitpunkt, Fassung), Verknüpfung mit dem Anmeldeanbieter (Aussteller, Subjekt), Ablauf eines befristeten Zugangs.",
    personenbezug: "ja",
    personenbezugGrund: "Direkt identifizierende Angaben der Person.",
    ablage: { ort: DATENBANK, tabellen: ["users"] },
    taetigkeit: "konten",
    loeschung:
      "Verwalter löscht das Konto (Prüfprotokoll `user.delete`); entfernt Kontozeile und Anmeldesitzungen. Verweise auf die Kennung in anderen Datenarten bleiben stehen (Auftrag Kontolöschung mit Verweisumschreibung, R-0642, offen).",
    frist: "Bis zur Löschung des Kontos; keine automatische Frist.",
    selbstauskunft: { enthalten: true },
    befund: "Die Selbstauskunft gibt Passwort-Hash und Salt bewusst nicht aus.",
  },
  {
    id: "anmeldung",
    name: "Anmeldesitzungen und Rücksetzmarken",
    inhalt:
      "Sitzungs- und Passwort-Rücksetzmarken (nur als Hash gespeichert), Konto-Kennung, Ablaufzeitpunkt.",
    personenbezug: "ja",
    personenbezugGrund: "Jede Marke ist einem Konto zugeordnet.",
    ablage: { ort: DATENBANK, tabellen: ["sessions", "password_resets"] },
    taetigkeit: "konten",
    loeschung:
      "Abgelaufene Sitzungen beim nächsten Zugriff und beim PostgreSQL-Start; Sitzungen mit der Kontolöschung; abgelaufene Rücksetzmarken beim PostgreSQL-Start.",
    frist: "Ablauf der Sitzung bzw. Marke; kein periodischer Aufräumlauf.",
    selbstauskunft: {
      enthalten: false,
      grund:
        "Sicherheitsmarken, nur als Hash gespeichert und ohne Aussage für die Person; Anmeldungen und Abmeldungen stehen als Protokollzeilen in der Auskunft.",
    },
  },
  {
    id: "zweifaktor",
    name: "Zwei-Faktor-Anmeldung (TOTP)",
    inhalt:
      "Je Konto das TOTP-Geheimnis, der Einrichtungszeitpunkt und der zuletzt verbrauchte Zeitschritt.",
    personenbezug: "ja",
    personenbezugGrund: "Einem Konto zugeordnet.",
    ablage: { ort: DATENBANK, tabellen: ["user_second_factors"] },
    taetigkeit: "konten",
    loeschung:
      "Abschalten durch das Konto selbst, Zurücksetzen durch die Verwaltung; mit der Kontolöschung entfernt.",
    frist: "Bis zum Abschalten oder zur Löschung des Kontos.",
    selbstauskunft: {
      enthalten: false,
      grund:
        "Zugangsgeheimnis — eine Ausgabe würde den zweiten Faktor aufheben; ob er eingerichtet ist, zeigt das Profil.",
    },
    befund:
      "Das Geheimnis liegt (wie bei TOTP nötig) lesbar in der Datenbank und ist wie ein Zugangsgeheimnis zu schützen.",
  },
  {
    id: "wissensobjekte",
    name: "Wissensobjekte mit Fassungen, Verlauf und Kommentaren",
    inhalt:
      "Titel, Aussage, Inhalt, Schlagwörter, Autor und Originalautor (Kennung), Verantwortung (Verantwortliche, Prüfer, Validierer), Verlauf je Fassung mit Bearbeiter, Kommentare mit Verfasser und Text, Änderungsvorschläge, Verweise auf Anhänge und Quellen, Vertraulichkeitsstufe.",
    personenbezug: "ja",
    personenbezugGrund:
      "Kennungen von Autoren, Bearbeitern, Verantwortlichen und Kommentatoren; Freitext kann Angaben über Dritte enthalten.",
    ablage: { ort: DATENBANK, tabellen: ["kos", "ko_versions"] },
    taetigkeit: "wissen",
    loeschung: `${PAPIERKORB} Mit Datenbank nimmt die Endlöschung die Fassungen in ko_versions per Fremdschlüssel (ON DELETE CASCADE, R-0846) mit; Altbestand vor der Bereinigung (NOT VALID) kann verwaiste Fassungen tragen.`,
    frist: "Fachlicher Lebenszyklus; nur der Papierkorb hat eine Frist (30 Tage).",
    selbstauskunft: { enthalten: true },
  },
  {
    id: "suchprojektionen",
    name: "Suchprojektionen",
    inhalt:
      "Aus den Wissensobjekten abgeleitete Suchtexte und Metadaten sowie die Steuerzeile der Projektion.",
    personenbezug: "moeglich",
    personenbezugGrund: "Abgeleitet aus Freitext, der Angaben über Personen enthalten kann.",
    ablage: {
      ort: DATENBANK,
      tabellen: ["ko_search_projections", "ko_metadata_projections", "ko_projection_control"],
    },
    taetigkeit: "wissen",
    loeschung: "Folgt der Endlöschung des Wissensobjekts (nach dem Commit, fehlertolerant).",
    frist: "Wie das Wissensobjekt.",
    selbstauskunft: {
      enthalten: false,
      grund: "Reine Ableitung der Wissensobjekte; deren Inhalt steht bereits in der Auskunft.",
    },
  },
  {
    id: "belege",
    name: "Belegkette der Wissensobjekte",
    inhalt: "Zuordnung von Anhängen und Quellen zu Wissensobjekten und Fassungen samt Zeitpunkt.",
    personenbezug: "moeglich",
    personenbezugGrund: "Kann die Kennung der handelnden Person tragen.",
    ablage: { ort: DATENBANK, tabellen: ["ko_evidence"] },
    taetigkeit: "wissen",
    loeschung:
      "Folgt mit Datenbank der Endlöschung des Wissensobjekts per Fremdschlüssel (ON DELETE CASCADE, R-0846); Altbestand vor der Bereinigung (NOT VALID) kann verwaiste Belege tragen.",
    frist: "Wie das Wissensobjekt.",
    selbstauskunft: {
      enthalten: false,
      grund: "Je Wissensobjekt in dessen Herkunftsansicht einsehbar.",
    },
  },
  {
    id: "beziehungen",
    name: "Kuratierte Beziehungen zwischen Wissensobjekten",
    inhalt:
      "Quelle, Ziel, Art und Richtung einer Beziehung, Urheber, Zeitpunkte, Widerruf mit widerrufender Kennung.",
    personenbezug: "ja",
    personenbezugGrund: "Urheber und Widerrufende sind als Kennung gespeichert.",
    ablage: { ort: DATENBANK, tabellen: ["ko_kanten", "ko_kanten_beitrag"] },
    taetigkeit: "wissen",
    loeschung:
      "Bewusst kein Löschweg: eine Beziehung ist eine Urheberaussage und wird widerrufen, nicht gelöscht.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Je Wissensobjekt in der Beziehungsansicht mit Urheber einsehbar.",
    },
  },
  {
    id: "entwuerfe",
    name: "Entwürfe",
    inhalt:
      "Entwurfsinhalt (Freitext, Interviewantworten, Dokumentherkunft), Originalautor, letzter Bearbeiter, Zeitpunkte.",
    personenbezug: "ja",
    personenbezugGrund: "Kennungen von Autor und Bearbeiter; Freitext.",
    ablage: { ort: DATENBANK, tabellen: ["drafts"] },
    taetigkeit: "wissen",
    loeschung: "Durch den Autor löschbar (Entwurfs-Papierkorb); mit dem Einreichen verbraucht.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
  },
  {
    id: "anhaenge",
    name: "Anhänge und hochgeladene Dateien",
    inhalt: "Datei-Inhalt (Bytes) und Metadaten: Name, Typ, Grösse, Zweck, hochladende Kennung.",
    personenbezug: "ja",
    personenbezugGrund:
      "Hochladende Kennung; Fotos und Dokumente können Personen zeigen, auch besondere Kategorien (Art. 9).",
    ablage: { ort: DATENBANK, tabellen: ["objects"] },
    taetigkeit: "wissen",
    loeschung:
      "Kein Löschweg ausserhalb des Speichers; lose, nicht zitierte Uploads bleiben stehen (R-0646, offen).",
    frist:
      "Schutzfrist OBJECT_RETENTION_DAYS = 30 Tage ist definiert, hat aber keinen Verbraucher.",
    selbstauskunft: { enthalten: true },
    befund:
      "Die Auskunft nennt die Metadaten eigener Uploads, nicht die Bytes; die Datei ist am Wissensobjekt abrufbar.",
  },
  {
    id: "wissensluecken",
    name: "Wissenslücken (unbeantwortete Fragen)",
    inhalt:
      "Die gestellte Frage im Wortlaut, Kennung der fragenden Person, Zuständige, Priorität, Status, Häufigkeit, Sprache.",
    personenbezug: "ja",
    personenbezugGrund:
      "Kennung der fragenden Person; der Fragetext ist Freitext und kann personenbezogene oder sensible Angaben enthalten.",
    ablage: { ort: DATENBANK, tabellen: ["gaps"] },
    taetigkeit: "fragen",
    loeschung: "Nur manuell durch Verwalter (`DELETE /api/gaps/:id`); kein Prüfprotokoll.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
    befund: "Wissenslücken speichern den Fragetext im Wortlaut.",
  },
  {
    id: "antwortbelege",
    name: "Antwortbelege",
    inhalt:
      "Antwortkennung, Zeitpunkt, Eigentümer-Kennung, zitierte Quellen, Belegrevisionen mit Prüfstand und Integritäts-Hash.",
    personenbezug: "ja",
    personenbezugGrund: "Eigentümer-Kennung der fragenden Person.",
    ablage: { ort: DATENBANK, tabellen: ["answer_records", "answer_snapshots"] },
    taetigkeit: "fragen",
    loeschung: "Kein Löschweg — Belege sind unveränderlich.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
    befund:
      "Gespeichert werden weder der Fragetext noch der Antworttext einer beantworteten Frage — nur Kennung, Zeit, Eigentum und die zitierten Quellen.",
  },
  {
    id: "bewertungen",
    name: "Bewertungen und Prüfzuweisungen",
    inhalt: "Urteil je Prüferin und Fassung mit Zeitpunkt; Zuweisungen zur Prüfung mit Stand.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung der bewertenden bzw. zugewiesenen Person.",
    ablage: { ort: DATENBANK, tabellen: ["ratings", "assignments"] },
    taetigkeit: "pruefung",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
  },
  {
    id: "befunde",
    name: "Widerspruchs- und Dublettenbefunde",
    inhalt:
      "Befund zu zwei Wissensobjekten mit Begründung, Stand, Entscheidung und entscheidender Kennung; dazu das Prüfgedächtnis der Erkennung je Objektpaar (Paarkennung, Hash des geprüften Textstands, Ausgang, Zeitpunkt — kein Text, keine Personenkennung) und die Paarpflichten je Prüflauf (Objektkennungen, Fassungen, Fingerabdrücke von Quelle und Kontext, Zustand, Modellurteil mit Modellname — kein Text, keine Personenkennung).",
    personenbezug: "moeglich",
    personenbezugGrund: "Kennung der entscheidenden Person; Begründung zitiert Freitext.",
    ablage: {
      ort: DATENBANK,
      tabellen: [
        "conflicts",
        "ko_overlaps",
        "conflict_pair_memory",
        "conflict_pair_obligation_runs",
        "conflict_pair_obligations",
      ],
    },
    taetigkeit: "pruefung",
    loeschung:
      "Offene Befunde werden bei der Endlöschung eines beteiligten Objekts geschlossen; Paarpflichten haben keinen eigenen Löschweg (nur der Bestandsreset).",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund:
        "Befunde betreffen Objektpaare; eigene Entscheidungen stehen als Protokollzeilen in der Auskunft.",
    },
  },
  {
    id: "kenntnisnahmen",
    name: "Kenntnisnahmen",
    inhalt:
      "Wer die Kenntnisnahme welcher Fassung wann angefordert hat, mit Frist; je Empfänger der Zeitpunkt der Bestätigung.",
    personenbezug: "ja",
    personenbezugGrund: "Kennungen von Anforderndem und Empfängern.",
    ablage: {
      ort: DATENBANK,
      tabellen: ["kenntnisnahme_anforderungen", "kenntnisnahme_empfaenger"],
    },
    taetigkeit: "pruefung",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
  },
  {
    // produkt:20261007:veroeffentlichungsoptionen — der beim Veröffentlichen angekündigte
    // Empfängerkreis, je Empfänger eine Zeile (`services/app/src/veroeffentlichung.ts`).
    id: "veroeffentlichungszustellungen",
    name: "Veröffentlichungsmeldungen (Zustellungen)",
    inhalt:
      "Je normal oder hervorgehoben veröffentlichter Fassung und Empfänger: Kennung des Vermerks, des Wissensobjekts und des Empfängers, Zeitpunkt, ob hervorgehoben. Kein Inhalt des Wissensobjekts.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung des Kontos, dem die Meldung zugestellt wurde.",
    ablage: { ort: DATENBANK, tabellen: ["veroeffentlichung_zustellungen"] },
    taetigkeit: "wissen",
    loeschung:
      "Verwaiste Zeilen (Vermerk fehlt am Eintrag) entfernt der Abruf der Glocke; sonst kein Löschweg, auch nicht mit der Kontolöschung.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund:
        "Die Zustellungen sind die Veröffentlichungsmeldungen der eigenen Glocke und dort für die Person sichtbar; ein eigener Abschnitt der Selbstauskunft ist noch nicht gebaut.",
    },
  },
  {
    id: "protokoll",
    name: "Prüfprotokoll (Audit)",
    inhalt: "Wer (Kennung), wann, welche Aktion, welches Ziel und Nutzdaten der Aktion.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung der handelnden Person; Ziel kann ein Konto sein.",
    ablage: { ort: DATENBANK, tabellen: ["audit"] },
    taetigkeit: "nachweis",
    loeschung:
      "Bewusst nicht löschbar (append-only, hash-verkettet); Abwägung Recht auf Löschung gegen Nachweispflicht ist organisatorisch zu dokumentieren.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
    befund: "Fragetexte und Inhalte stehen nicht im Protokoll; `ask.query` trägt nur Zähler.",
  },
  {
    id: "modelllaeufe",
    name: "KI-Läufe (ModelRun-Protokoll)",
    inhalt:
      "Aufgabe, Anbieter, Modell, Status, Zeitpunkte, Rückfall, Tokenverbrauch, Kosten, generische Fehlermeldung; als Laufkontext die Kennung der anfragenden Person (`actor`) und die Kennung des betroffenen Wissensobjekts (`subject`).",
    personenbezug: "ja",
    personenbezugGrund:
      "Der Laufkontext trägt die Kennung der authentifiziert anfragenden Person (`ModelRunContext.actor`), sofern der Aufrufer sie kennt.",
    ablage: { ort: DATENBANK, tabellen: ["model_runs"] },
    taetigkeit: "ki",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
    befund:
      "KI-Läufe speichern keine Inhalte: weder Prompt noch Antwort noch Wissensinhalt — wohl aber die Kennung der anfragenden Person.",
  },
  {
    id: "klara",
    name: "Klara-Sitzungen und Zustimmungen",
    inhalt:
      "Sitzung je Person und Add-in-Instanz mit Dokumentkontext-Kennung, Ablauf und Stand; Zustimmung zur externen KI mit Anbieter, Modell und erlaubtem Umfang.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung der Person; Zustimmungen sind ihr zugeordnet.",
    ablage: { ort: DATENBANK, tabellen: ["klara_sessions", "klara_session_consents"] },
    taetigkeit: "ki",
    loeschung:
      "Abgelaufene Sitzungen löscht ein periodischer Aufräumlauf (`klara-aufraeumen.ts`, Aufbewahrung 30 Tage).",
    frist: "30 Tage nach Ablauf (KLARA_SESSION_AUFBEWAHRUNG_MS).",
    selbstauskunft: { enthalten: true },
  },
  {
    id: "lernpfade",
    name: "Lernpfade und Fortschritt",
    inhalt:
      "Lernpfade je Rolle, Kopplungen von Arbeitsmitteln an Wissensobjekte, Fortschritt je Person, anstehende Nachprüfungen mit ihren Anlässen (Grund, Anlage, Änderungsbeleg, Fassung, Zeitpunkt, meldende Kennung).",
    personenbezug: "ja",
    personenbezugGrund:
      "Der Fortschritt ist je Person gespeichert; der Anlass einer Nachprüfung nennt die meldende Kennung (nur intern, nicht in der Übersicht).",
    ablage: {
      ort: DATENBANK,
      tabellen: [
        "lifecycle_couplings",
        "lifecycle_pending",
        "lifecycle_verlauf",
        "lifecycle_paths",
        "lifecycle_progress",
      ],
    },
    taetigkeit: "lernpfade",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
  },
  {
    id: "management",
    name: "Bereichsverantwortung und Ruhestandshorizonte",
    inhalt:
      "Verantwortliche Person je Bereich mit eingeschätzten Prioritätsfaktoren; Ruhestandshorizont (24/36 Monate) und Fälligkeit je Person; ändernde Kennung.",
    personenbezug: "ja",
    personenbezugGrund:
      "Ruhestandshorizont und Bereichsverantwortung sind Beschäftigtendaten einer benannten Person.",
    ablage: {
      ort: DATENBANK,
      tabellen: ["management_category_profiles", "management_retirement_horizons"],
    },
    taetigkeit: "management",
    loeschung: "Ruhestandshorizont durch Verwalter entfernbar; Bereichsprofile überschreibbar.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
    befund: "Beschäftigtendaten mit Bezug zur Lebensplanung — Teil der Folgenabschätzung.",
  },
  {
    id: "gesamtanweisungen",
    name: "Gesamtanweisungen",
    inhalt:
      "Zusammengesetzte Anweisungen aus gebundenen Fassungen mit Titel, Zweck, Geltungsbereich, Urheber und festgehaltenen Prüfständen.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung des Urhebers.",
    ablage: {
      ort: DATENBANK,
      tabellen: ["gesamtanweisungen", "gesamtanweisung_bausteine", "gesamtanweisung_staende"],
    },
    taetigkeit: "wissen",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Je Anweisung mit Urheber in der Anweisungsansicht einsehbar.",
    },
  },
  {
    id: "dokumentakte",
    name: "Interne Dokumentakte",
    inhalt: "Fassungen übernommener Word-Dokumente und ihre Zuordnung.",
    personenbezug: "moeglich",
    personenbezugGrund: "Dokumentinhalt und Herkunftsangaben können Personen nennen.",
    ablage: { ort: DATENBANK, tabellen: ["dokument_fassungen"] },
    taetigkeit: "wissen",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Dokumentfassungen gehören zu Wissensobjekten, die in der Auskunft stehen.",
    },
  },
  {
    id: "woerterbuch",
    name: "Firmenwörterbuch",
    inhalt:
      "Begriffe mit Definition, Benennungen, Geltungsbereich, verantwortlicher Stelle; je Fassung die ändernde Kennung und der Zeitpunkt.",
    personenbezug: "ja",
    personenbezugGrund: "Ändernde Kennung je Fassung.",
    ablage: { ort: DATENBANK, tabellen: ["begriffe_fassungen"] },
    taetigkeit: "wissen",
    loeschung: "Kein Löschweg — jede Fassung bleibt zuordenbar.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Je Fassung im Firmenwörterbuch einsehbar.",
    },
  },
  {
    id: "bearbeitungshinweise",
    name: "Bearbeitungshinweise",
    inhalt: "Wer gerade welches Wissensobjekt bearbeitet: Kennung, Name, Sitzung, Zeitraum.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung und Name der bearbeitenden Person.",
    ablage: { ort: DATENBANK, tabellen: ["ko_bearbeitungen"] },
    taetigkeit: "wissen",
    loeschung: "Flüchtig; der Hinweis läuft nach seinem Zeitraum ab.",
    frist: "Ende des Bearbeitungszeitraums.",
    selbstauskunft: { enthalten: false, grund: "Flüchtig, nur während einer Bearbeitung." },
  },
  {
    id: "office-ablage",
    name: "Office im Artikel: Editor-Sitzungen und gesicherte Konfliktstände",
    inhalt:
      "Laufende Editor-Sitzung je Anhang (Sperre, Sitzungsbasis, Arbeitsstand, letzter Schreiber) und Arbeitsstände, die wegen eines Konflikts nicht übernommen, sondern gesichert wurden: Artikel-, Anhang- und Objektkennung, Kennung der speichernden Person, Zeitpunkt.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung der Person, die zuletzt gespeichert hat.",
    ablage: { ort: DATENBANK, tabellen: ["office_sitzungen", "office_gesichert"] },
    taetigkeit: "wissen",
    loeschung:
      "Sitzung: endet mit dem Entsperren des Editors. Gesicherter Stand: mit seiner Übernahme als Fassung.",
    frist: "Ende der Editor-Sitzung bzw. Übernahme des gesicherten Stands.",
    selbstauskunft: {
      enthalten: false,
      grund: "Arbeitsstand eines Dokuments, am Artikel als gesicherter Stand sichtbar.",
    },
  },
  {
    id: "lesevarianten",
    name: "Lesevarianten (gekennzeichnete Übersetzungen)",
    inhalt: "Übersetzte Lesefassungen von Wissensobjekten und Import-Kandidaten.",
    personenbezug: "moeglich",
    personenbezugGrund: "Übersetzter Freitext kann Angaben über Personen enthalten.",
    ablage: { ort: DATENBANK, tabellen: ["lesevarianten"] },
    taetigkeit: "wissen",
    loeschung: "Kein Löschweg; werden über die Verwaltung neu geladen.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: false, grund: "Ableitung der Wissensobjekte." },
  },
  {
    id: "importe",
    name: "Importe aus Fremdsystemen",
    inhalt:
      "Import-Kandidaten mit Inhalt und Herkunft aus Fremdsystemen (z. B. Confluence, SharePoint), unveränderliche Quellrevisionen, Importläufe mit auslösender Kennung, Quellabgleich.",
    personenbezug: "ja",
    personenbezugGrund:
      "Auslösende Kennung; übernommene Inhalte tragen Autorenangaben und Freitext aus dem Fremdsystem.",
    ablage: {
      ort: DATENBANK,
      tabellen: [
        "import_candidates",
        "external_source_records",
        "import_runs",
        "import_run_item_refs",
        "import_run_source_sync",
      ],
    },
    taetigkeit: "import",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund:
        "Importvorgänge mit Inhalten Dritter; eigene Importläufe stehen als Protokollzeilen in der Auskunft.",
    },
  },
  {
    id: "benachrichtigungen",
    name: "Gelesen-Marken der Benachrichtigungen",
    inhalt: "Je Person die Kennungen bereits gelesener Benachrichtigungen.",
    personenbezug: "ja",
    personenbezugGrund: "Der Person zugeordnet.",
    ablage: { ort: DATENBANK, tabellen: ["notification_seen"] },
    taetigkeit: "betrieb",
    loeschung: "Kein Löschweg.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: false, grund: "Technische Marken ohne Inhalt." },
  },
  {
    id: "interaktionsgedaechtnis",
    name: "Interaktionsgedächtnis",
    inhalt:
      "Je Konto gemerkte frühere Fragen mit der damaligen Antwort im Wortlaut und Vorlieben; Herkunft (eigene Eingabe oder geprüfte eigene Antwortkennung), Vertraulichkeit, Aufbewahrungsfrist.",
    personenbezug: "ja",
    personenbezugGrund:
      "Gehört genau einem Konto; Frage- und Antworttext sind Freitext und können sensible Angaben enthalten.",
    ablage: { ort: DATENBANK, tabellen: ["interaktions_gedaechtnis"] },
    taetigkeit: "fragen",
    loeschung:
      "Einzeln und vollständig durch das Konto selbst löschbar; abgelaufene Einträge löscht ein Aufräumlauf endgültig.",
    frist: "Je Eintrag gewählt: 30, 90 oder 365 Tage (Vorgabe 90).",
    selbstauskunft: {
      enthalten: false,
      grund:
        "Nur das Konto selbst sieht, lädt und löscht sein Gedächtnis (eigene Fläche); die Verwaltung hat bewusst keinen Zugriff, deshalb steht es nicht in der auch von ihr erstellbaren Auskunftsdatei.",
    },
    befund:
      "Anders als die Antwortbelege speichert das Gedächtnis Frage- UND Antworttext — aber nur, was das Konto selbst ablegt, mit Löschfrist.",
  },
  {
    id: "livewallfotos",
    name: "Fotos der Live-Wand",
    inhalt:
      "Ein freiwillig hochgeladenes Porträt je Konto (Rasterbild als Daten-URL) mit Zeitpunkt.",
    personenbezug: "ja",
    personenbezugGrund: "Bild der Person, ihrem Konto zugeordnet.",
    ablage: { ort: DATENBANK, tabellen: ["livewall_fotos"] },
    taetigkeit: "betrieb",
    loeschung: "Widerruf durch das Konto löscht die Bilddaten (nicht nur ein Merker).",
    frist: "Bis zum Widerruf.",
    selbstauskunft: {
      enthalten: false,
      grund: "Selbst hochgeladen und an der Live-Wand-Einstellung einsehbar und widerrufbar.",
    },
  },
  {
    id: "spaces",
    name: "Arbeitsräume (Spaces)",
    inhalt:
      "Fassungen der Arbeitsräume mit Name, Zweck, zuständiger Person, Mitgliedern samt Recht, Ansichten, anlegender und ändernder Kennung.",
    personenbezug: "ja",
    personenbezugGrund: "Kennungen der zuständigen Person, der Mitglieder und der Bearbeiter.",
    ablage: { ort: DATENBANK, tabellen: ["spaces_fassungen"] },
    taetigkeit: "wissen",
    loeschung: "Kein Löschweg — jede Fassung bleibt zuordenbar.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Je Space mit Zuständigkeit und Mitgliedern in der Space-Ansicht einsehbar.",
    },
  },
  {
    id: "chat",
    name: "Interner Chat",
    inhalt:
      "Gespräche (direkt, Gruppe, Space, Artikel) mit Teilnehmenden, Gruppenname und Bezug; Nachrichten mit Absender, Zeitpunkt, Text, Sendekennung, Erwähnungen, Verweisen auf Artikel und Anhänge (nur Kennungen), markiertem Ausschnitt samt Herkunft und Wissensübernahmen (Kennung des Entwurfs).",
    personenbezug: "ja",
    personenbezugGrund:
      "Kennungen von Absendern, Teilnehmenden und Erwähnten; der Nachrichtentext kann Angaben über Personen enthalten.",
    ablage: { ort: DATENBANK, tabellen: ["chat_gespraeche", "chat_nachrichten"] },
    taetigkeit: "wissen",
    loeschung: "Kein Löschweg im Code — Nachrichten bleiben im Gespräch zuordenbar.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund:
        "Noch nicht in der Selbstauskunft; die eigenen Gespräche und Nachrichten sind im Chat einsehbar.",
    },
  },
  {
    id: "gemeinsame-entwuerfe",
    name: "Gemeinsame Artikelentwürfe",
    inhalt:
      "Je Artikel die gemeinsame Arbeitsfassung (Titel, Text, Basisfassung des Artikels), ihre gespeicherten Arbeitsstände und der Verlauf mit Kennung und Name der speichernden Person und Zeitpunkt.",
    personenbezug: "ja",
    personenbezugGrund:
      "Kennung und Name der speichernden Personen; der Entwurfstext kann Angaben über Personen enthalten.",
    ablage: { ort: DATENBANK, tabellen: ["gemeinsame_entwuerfe"] },
    taetigkeit: "wissen",
    loeschung:
      "Kein Löschweg im Code — ein übernommener oder eingereichter Entwurf bleibt als Verlauf zuordenbar.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Am gemeinsamen Entwurf des Artikels mit Verlauf einsehbar.",
    },
  },
  {
    id: "teams",
    name: "Teams",
    inhalt:
      "Fassungen der Teams mit Name, Zweck, zuständiger Person, Kennungen der Mitglieder, Archivstand, anlegender und ändernder Kennung.",
    personenbezug: "ja",
    personenbezugGrund: "Kennungen der zuständigen Person, der Mitglieder und der Bearbeiter.",
    ablage: { ort: DATENBANK, tabellen: ["teams_fassungen"] },
    taetigkeit: "konten",
    loeschung: "Kein Löschweg — Teams werden archiviert, jede Fassung bleibt zuordenbar.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Teammitgliedschaften stehen am Space als Zugangsweg und in der Teamverwaltung.",
    },
  },
  {
    id: "vorlagen",
    name: "Vorlagen, Standards und Space-Vorgaben",
    inhalt:
      "Fassungen eigener Vorlagen (Name, Felder, Geltung, Eigentümerkennung), je Konto der gewählte persönliche Standard, Space-Vorgaben, je Beitrag die verwendete Vorlagenfassung und gepflegte Begriffe, jeweils mit ändernder Kennung und Zeitpunkt.",
    personenbezug: "ja",
    personenbezugGrund:
      "Kennungen der Eigentümerin, der ändernden Person und des Kontos mit persönlichem Standard.",
    ablage: { ort: DATENBANK, tabellen: ["vorlagen_fassungen"] },
    taetigkeit: "wissen",
    loeschung: "Kein Löschweg — Vorlagen werden ausgemustert, jede Fassung bleibt zuordenbar.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Eigene Vorlagen und der persönliche Standard sind unter „Vorlagen“ einsehbar.",
    },
  },
  {
    id: "verantwortungnachfolge",
    name: "Nachfolge bei Befristung",
    inhalt:
      "Je befristetem Konto die Kennung der Nachfolge, die neue Beiträge verantwortet, mit setzender Kennung und Zeitpunkt.",
    personenbezug: "ja",
    personenbezugGrund: "Kennungen des befristeten Kontos, der Nachfolge und der setzenden Person.",
    ablage: { ort: DATENBANK, tabellen: ["verantwortung_nachfolge"] },
    taetigkeit: "konten",
    loeschung: "Entfällt, sobald das Konto nicht mehr befristet ist.",
    frist: "Bis zum Ende der Befristung.",
    // Ben (Nacharbeit 13): die Zuordnung besteht schon, bevor es Beiträge gibt — sie steht deshalb
    // selbst in der Auskunft, für das befristete Konto, die Nachfolge und die setzende Person.
    selbstauskunft: { enthalten: true },
  },
  {
    id: "halbwertszeiten",
    name: "Gelernte Halbwertszeiten",
    inhalt:
      "Je Wissensobjekt und Fassungsende die beobachtete Haltbarkeit in Tagen mit Kategorie und Erfassungszeitpunkt.",
    personenbezug: "nein",
    personenbezugGrund: "Nur Objektkennung, Kategorie und Dauer — keine Kennung einer Person.",
    ablage: { ort: DATENBANK, tabellen: ["ko_halbwertszeit_beobachtungen"] },
    taetigkeit: "wissen",
    loeschung: "Kein eigener Löschweg; nur mit dem Bestandsreset.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: false, grund: "Ohne Personenbezug." },
  },
  {
    id: "embeddings",
    name: "Vektoren des Textprüfungs-Vorfilters",
    inhalt:
      "Je Wissensobjekt ein Zahlenvektor des Texts mit Modellfassung, Dimension und Prüfsumme des eingebetteten Texts (kein Text).",
    personenbezug: "moeglich",
    personenbezugGrund:
      "Aus dem Freitext der Wissensobjekte abgeleitet; der Text selbst wird nicht gespeichert.",
    ablage: { ort: DATENBANK, tabellen: ["ko_embeddings"] },
    taetigkeit: "wissen",
    loeschung: "Mit der Endlöschung des Wissensobjekts.",
    frist: "Wie das Wissensobjekt.",
    selbstauskunft: { enthalten: false, grund: "Ableitung der Wissensobjekte." },
  },
  {
    id: "loeschantraege",
    name: "Löschanträge",
    inhalt:
      "Antrag auf Kontolöschung mit Antragsteller, Zeitpunkt, Frist, optionaler Begründung, Entscheidung, entscheidender Kennung und Grund.",
    personenbezug: "ja",
    personenbezugGrund: "Kennung des Antragstellers und der entscheidenden Person; Freitext.",
    ablage: { ort: DATENBANK, tabellen: ["loeschantraege"] },
    taetigkeit: "betroffenenrechte",
    loeschung: "Kein Löschweg — der Antrag ist der Nachweis über die Bearbeitung.",
    frist: BETREIBERFRIST,
    selbstauskunft: { enthalten: true },
  },
  {
    id: "einstellungen",
    name: "Betriebseinstellungen",
    inhalt:
      "Schwellen, Prüferanzahl, Upload-Grenzen, KI-Zuordnung, externe Recherche, Markenwahl, Importschalter, KI-Assist-Vorgaben, Schreibstandzähler.",
    personenbezug: "moeglich",
    personenbezugGrund:
      "Keine Angaben über Personen; einzelne Einstellungen können die Kennung der zuletzt ändernden Person tragen.",
    ablage: {
      ort: DATENBANK,
      tabellen: [
        "overlap_settings",
        "validation_settings",
        "external_knowledge_policy",
        "upload_limits",
        "reasoner_policy",
        "branding_settings",
        "confluence_import_schalter",
        "assist_presets",
        "ko_schreibstand",
      ],
    },
    taetigkeit: "betrieb",
    loeschung: "Überschreibbar durch Verwalter.",
    frist: "Solange die Einstellung gilt.",
    selbstauskunft: { enthalten: false, grund: "Keine Angaben über die Person." },
  },
  {
    id: "sicherungen",
    name: "Sicherungskopien",
    inhalt: "Vollständige Datenbanksicherungen mit allen oben genannten Datenarten.",
    personenbezug: "ja",
    personenbezugGrund: "Enthalten alle personenbezogenen Datenarten der Datenbank.",
    ablage: { ort: "Sicherungsverzeichnis des Betreibers (scripts/backup)", tabellen: [] },
    taetigkeit: "betrieb",
    loeschung:
      "Rotation nach Anzahl (BACKUP_KEEP); Löschungen in der Datenbank wirken nicht in vorhandene Sicherungen hinein.",
    frist: "Vom Betreiber über BACKUP_KEEP festzulegen; ohne Wert wird nichts rotiert.",
    selbstauskunft: { enthalten: false, grund: "Kopien des Bestands, kein eigener Inhalt." },
  },
  {
    id: "serverprotokolle",
    name: "Server- und Proxy-Protokolle",
    inhalt:
      "Anfragezeitpunkt, Pfad, Status, ggf. IP-Adresse; die Anwendung protokolliert ohne Inhalte (log-sanitize).",
    personenbezug: "moeglich",
    personenbezugGrund: "IP-Adressen am Reverse-Proxy.",
    ablage: { ort: "Logging des Betreibers (Reverse-Proxy, Hosting)", tabellen: [] },
    taetigkeit: "betrieb",
    loeschung: "Logging-Richtlinie des Betreibers.",
    frist: BETREIBERFRIST,
    selbstauskunft: {
      enthalten: false,
      grund: "Liegt ausserhalb der Anwendung beim Betreiber.",
    },
  },
  {
    id: "endgeraet",
    name: "Speicher im Endgerät",
    inhalt:
      "Sitzungscookie und Browser-Speicher der Anwendung; die Aufzählung steht in der Datenschutzerklärung, Abschnitt 4.",
    personenbezug: "moeglich",
    personenbezugGrund: "Das Sitzungscookie ist einem Konto zugeordnet.",
    ablage: { ort: "Browser der Person", tabellen: [] },
    taetigkeit: "betrieb",
    loeschung: "Abmelden bzw. Browser-Speicher leeren.",
    frist: "Sitzungsablauf.",
    selbstauskunft: { enthalten: false, grund: "Liegt im eigenen Browser." },
  },
];

/** Alle Tabellen, die das Inventar führt — gegen `migrate()` gehalten (s. Kopf). */
export function inventarTabellen(inventar: readonly Datenart[] = DATENINVENTAR): string[] {
  return inventar.flatMap((d) => [...d.ablage.tabellen]);
}

// ================================================================================================
// DAS VERZEICHNIS DER VERARBEITUNGSTÄTIGKEITEN (Art. 30 Abs. 1 DSGVO), ERZEUGT AUS DEM INVENTAR.
// ================================================================================================

interface TaetigkeitStamm {
  id: TaetigkeitId;
  name: string;
  zweck: string;
}

const TAETIGKEITEN: readonly TaetigkeitStamm[] = [
  {
    id: "konten",
    name: "Benutzerverwaltung und Anmeldung",
    zweck: "Zugang zur Anwendung, Rollen und Rechte, Anmeldung und Passwortrücksetzung.",
  },
  {
    id: "wissen",
    name: "Erfassung und Pflege betrieblichen Wissens",
    zweck:
      "Erfassen, Bearbeiten, Belegen, Verknüpfen und Bereitstellen von Fachwissen samt Urheberschaft und Verlauf.",
  },
  {
    id: "pruefung",
    name: "Fachliche Prüfung und Freigabe",
    zweck:
      "Peer-Bewertung, Prüfzuweisung, Widerspruchs- und Dublettenklärung, Kenntnisnahme gültiger Fassungen.",
  },
  {
    id: "fragen",
    name: "Fragen und Antworten",
    zweck: "Beantwortung von Fragen aus geprüftem Wissen; Erfassen offener Wissenslücken.",
  },
  {
    id: "ki",
    name: "KI-gestützte Verarbeitung",
    zweck:
      "Strukturieren, Formulieren und Prüfen mit einem Sprachmodell; Nachweis der Läufe und der Zustimmung zur externen KI.",
  },
  {
    id: "nachweis",
    name: "Nachvollziehbarkeit (Prüfprotokoll)",
    zweck:
      "Manipulationserkennbarer Nachweis fachlich relevanter Handlungen; keine Leistungs- oder Verhaltenskontrolle.",
  },
  {
    id: "import",
    name: "Übernahme aus Fremdsystemen",
    zweck: "Import und Abgleich von Inhalten aus angebundenen Wissensquellen.",
  },
  {
    id: "management",
    name: "Wissenssicherung und Bereichsverantwortung",
    zweck:
      "Priorisierung der Wissenssicherung nach Bereichsverantwortung und geplanten Austritten.",
  },
  {
    id: "lernpfade",
    name: "Lernpfade",
    zweck: "Einarbeitung je Rolle und Nachprüfung gekoppelter Arbeitsmittel.",
  },
  {
    id: "betroffenenrechte",
    name: "Bearbeitung von Betroffenenrechten",
    zweck: "Auskunft, Datenmitnahme und Löschanträge der Konteninhaber.",
  },
  {
    id: "betrieb",
    name: "Betrieb und Sicherung",
    zweck: "Betriebseinstellungen, Benachrichtigungen, Sicherung und Wiederherstellung.",
  },
];

/** Die Betriebslage, aus der die Empfängerangaben entstehen — gelesen zur Erzeugungszeit. */
export interface Betriebslage {
  /** Externe Modellanbieter, an die mindestens eine KI-Aufgabe heute EFFEKTIV geht. */
  modellAnbieter: readonly string[];
  /** Ein eigenes, lokal betriebenes Modell ist effektiv zugeordnet. */
  lokalesModell: boolean;
  /** Die externe Recherche ist verdrahtet. */
  externeSuche: boolean;
  /** Ein echter SMTP-Versand ist eingerichtet (nicht der Entwicklungsersatz). */
  mailVersand: boolean;
}

export interface Verarbeitungstaetigkeit {
  id: TaetigkeitId;
  name: string;
  zweck: string;
  rechtsgrundlage: string;
  betroffene: string;
  datenkategorien: Array<{
    datenart: string;
    name: string;
    inhalt: string;
    personenbezug: Personenbezug;
  }>;
  speicherorte: string[];
  empfaenger: string[];
  drittland: string;
  loeschfristen: Array<{ name: string; loeschung: string; frist: string }>;
  befunde: string[];
}

export interface Verarbeitungsverzeichnis {
  art: "klarwerk.verarbeitungsverzeichnis";
  fassung: 1;
  erzeugtAm: string;
  hinweis: string;
  verantwortlicher: string;
  datenschutzbeauftragter: string;
  betriebslage: Betriebslage;
  taetigkeiten: Verarbeitungstaetigkeit[];
  tom: string[];
  offenBeimBetreiber: string[];
  /** Das vollständige Inventar, auch die Datenarten ohne Personenbezug. */
  datenarten: readonly Datenart[];
}

const VOM_BETREIBER = "Vom Betreiber einzutragen.";

/** Technische Massnahmen, die der Code heute belegt (Art. 32) — keine organisatorischen. */
const TOM: readonly string[] = [
  "Rollen- und Rechteprüfung serverseitig auf jeder Route (RBAC: viewer, experte, controller, admin).",
  "Vertraulichkeitsstufen je Wissensobjekt; vertrauliche Objekte sehen nur Prüfrollen und der Autor.",
  "Passwörter nur als Hash mit Salt; Sitzungs- und Rücksetzmarken nur als Hash gespeichert.",
  "Prüfprotokoll append-only und hash-verkettet; Abweichungen sind rechnerisch prüfbar.",
  "Anwendungsprotokoll ohne Inhalte (log-sanitize); KI-Läufe ohne Prompt- und Antworttext.",
  "Vertrauliche Inhalte werden nicht an Cloud-Modelle gegeben; die Zustimmung zur externen KI wird je Klara-Sitzung gebunden gespeichert.",
  "Sicherung und erprobte Wiederherstellung (Restore-Drill gegen den vollständigen Tabellensatz).",
];

const OFFEN_BEIM_BETREIBER: readonly string[] = [
  "Verantwortlicher und Datenschutzbeauftragter (Name, Kontakt).",
  "Rechtsgrundlage je Tätigkeit (Art. 6, ggf. § 26 BDSG / Betriebsvereinbarung).",
  "Löschfristen der Datenarten ohne Frist im Code (Angabe „Keine Frist im Code“).",
  "Auftragsverarbeitungsverträge mit Hosting und den aufgeführten externen Empfängern.",
  "Prüfung einer Übermittlung in Drittländer bei externen Modellanbietern.",
  "Datenschutz-Folgenabschätzung, insbesondere bei aktiver externer KI und Beschäftigtendaten.",
  "Server- und Proxy-Protokolle sowie Aufbewahrung der Sicherungen.",
];

function empfaengerFuer(id: TaetigkeitId, lage: Betriebslage): string[] {
  const raus: string[] = [
    "Keine Übermittlung an Dritte durch die Anwendung; Betreiber und Hosting als Auftragsverarbeiter.",
  ];
  if (id === "ki" || id === "wissen" || id === "fragen" || id === "pruefung") {
    for (const anbieter of lage.modellAnbieter) {
      raus.push(
        `Externer Modellanbieter „${anbieter}": Texte der jeweiligen KI-Aufgabe (nur nicht vertrauliche Inhalte); dort nicht von der Anwendung gespeichert.`,
      );
    }
    if (lage.lokalesModell) {
      raus.push("Lokal betriebenes Modell im Haus des Betreibers (keine Übermittlung an Dritte).");
    }
  }
  if (lage.externeSuche && (id === "wissen" || id === "fragen")) {
    raus.push("Externer Suchdienst: Suchbegriffe der externen Recherche.");
  }
  if (lage.mailVersand && (id === "konten" || id === "pruefung")) {
    raus.push(
      "E-Mail-Versand über den eingerichteten SMTP-Dienst: Name, E-Mail-Adresse, Benachrichtigungstext.",
    );
  }
  return raus;
}

/**
 * Erzeugt das Verzeichnis. Rein: keine Ablage, keine Uhr, keine Umgebung — alles, was sich ändern
 * kann, kommt als Eingabe. Deshalb ist es ohne Datenbank prüfbar und bei gleicher Eingabe gleich.
 */
export function erzeugeVerarbeitungsverzeichnis(
  lage: Betriebslage,
  erzeugtAm: Date,
  inventar: readonly Datenart[] = DATENINVENTAR,
): Verarbeitungsverzeichnis {
  const taetigkeiten: Verarbeitungstaetigkeit[] = [];
  for (const stamm of TAETIGKEITEN) {
    const arten = inventar.filter((d) => d.taetigkeit === stamm.id && d.personenbezug !== "nein");
    if (arten.length === 0) {
      continue;
    }
    const extern = lage.modellAnbieter.length > 0 && empfaengerFuer(stamm.id, lage).length > 1;
    taetigkeiten.push({
      id: stamm.id,
      name: stamm.name,
      zweck: stamm.zweck,
      rechtsgrundlage: VOM_BETREIBER,
      betroffene:
        "Konteninhaber (Beschäftigte und Beauftragte des Betreibers); in Freitext und Anhängen genannte Dritte.",
      datenkategorien: arten.map((d) => ({
        datenart: d.id,
        name: d.name,
        inhalt: d.inhalt,
        personenbezug: d.personenbezug,
      })),
      speicherorte: [
        ...new Set(
          arten.map((d) =>
            d.ablage.tabellen.length > 0
              ? `${d.ablage.ort}: ${d.ablage.tabellen.join(", ")}`
              : d.ablage.ort,
          ),
        ),
      ],
      empfaenger: empfaengerFuer(stamm.id, lage),
      drittland: extern
        ? "Möglich über den externen Modellanbieter — vom Betreiber anhand des Auftragsverarbeitungsvertrags zu prüfen."
        : "Keine Übermittlung durch die Anwendung.",
      loeschfristen: arten.map((d) => ({ name: d.name, loeschung: d.loeschung, frist: d.frist })),
      befunde: arten.flatMap((d) => (d.befund ? [`${d.name}: ${d.befund}`] : [])),
    });
  }
  return {
    art: "klarwerk.verarbeitungsverzeichnis",
    fassung: 1,
    erzeugtAm: erzeugtAm.toISOString(),
    hinweis:
      "Aus dem System erzeugt (Dateninventar und Betriebslage zum Erzeugungszeitpunkt). Keine Rechtsberatung; Rechtsgrundlage, Verantwortlicher und die nicht im Code festgelegten Fristen ergänzt der Betreiber.",
    verantwortlicher: VOM_BETREIBER,
    datenschutzbeauftragter: VOM_BETREIBER,
    betriebslage: lage,
    taetigkeiten,
    tom: [...TOM],
    offenBeimBetreiber: [...OFFEN_BEIM_BETREIBER],
    datenarten: inventar,
  };
}

function zelle(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

const BEZUG_TEXT: Record<Personenbezug, string> = {
  ja: "ja",
  moeglich: "möglich",
  nein: "nein",
};

/** Dasselbe Verzeichnis als Markdown — für die Ablage beim Datenschutzbeauftragten. */
export function verzeichnisAlsMarkdown(v: Verarbeitungsverzeichnis): string {
  const z: string[] = [];
  z.push("# Verzeichnis der Verarbeitungstätigkeiten (Art. 30 DSGVO) — Klarwerk");
  z.push("");
  z.push(`Erzeugt am ${v.erzeugtAm}. ${v.hinweis}`);
  z.push("");
  z.push(`- Verantwortlicher: ${v.verantwortlicher}`);
  z.push(`- Datenschutzbeauftragter: ${v.datenschutzbeauftragter}`);
  z.push(
    `- Externe Modellanbieter (effektiv): ${v.betriebslage.modellAnbieter.length > 0 ? v.betriebslage.modellAnbieter.join(", ") : "keine"}`,
  );
  z.push(`- Lokales Modell: ${v.betriebslage.lokalesModell ? "ja" : "nein"}`);
  z.push(`- Externe Recherche: ${v.betriebslage.externeSuche ? "ja" : "nein"}`);
  z.push(`- E-Mail-Versand: ${v.betriebslage.mailVersand ? "ja" : "nein"}`);
  for (const t of v.taetigkeiten) {
    z.push("");
    z.push(`## ${t.name}`);
    z.push("");
    z.push(`- Zweck: ${t.zweck}`);
    z.push(`- Rechtsgrundlage: ${t.rechtsgrundlage}`);
    z.push(`- Betroffene: ${t.betroffene}`);
    z.push(`- Drittland: ${t.drittland}`);
    z.push("- Empfänger:");
    for (const e of t.empfaenger) {
      z.push(`  - ${e}`);
    }
    z.push("- Speicherorte:");
    for (const s of t.speicherorte) {
      z.push(`  - ${s}`);
    }
    z.push("");
    z.push("| Datenart | Inhalt | Personenbezug | Löschweg | Frist |");
    z.push("| --- | --- | --- | --- | --- |");
    for (const d of t.datenkategorien) {
      const frist = t.loeschfristen.find((f) => f.name === d.name);
      z.push(
        `| ${zelle(d.name)} | ${zelle(d.inhalt)} | ${BEZUG_TEXT[d.personenbezug]} | ${zelle(frist?.loeschung ?? "")} | ${zelle(frist?.frist ?? "")} |`,
      );
    }
    if (t.befunde.length > 0) {
      z.push("");
      z.push("Befunde:");
      for (const b of t.befunde) {
        z.push(`- ${b}`);
      }
    }
  }
  z.push("");
  z.push("## Technische Massnahmen (Art. 32, im Code belegt)");
  z.push("");
  for (const m of v.tom) {
    z.push(`- ${m}`);
  }
  z.push("");
  z.push("## Offen beim Betreiber");
  z.push("");
  for (const o of v.offenBeimBetreiber) {
    z.push(`- ${o}`);
  }
  z.push("");
  z.push("## Dateninventar (alle Datenarten)");
  z.push("");
  z.push("| Datenart | Personenbezug | Ablage | In der Selbstauskunft |");
  z.push("| --- | --- | --- | --- |");
  for (const d of v.datenarten) {
    const ablage =
      d.ablage.tabellen.length > 0
        ? `${d.ablage.ort}: ${d.ablage.tabellen.join(", ")}`
        : d.ablage.ort;
    const auskunft = d.selbstauskunft.enthalten ? "ja" : `nein — ${d.selbstauskunft.grund}`;
    z.push(
      `| ${zelle(d.name)} | ${BEZUG_TEXT[d.personenbezug]} | ${zelle(ablage)} | ${zelle(auskunft)} |`,
    );
  }
  z.push("");
  return z.join("\n");
}
