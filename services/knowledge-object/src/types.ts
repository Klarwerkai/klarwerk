// FR-KO-02: fünf Wissensarten (Pflichtenheft §3.5).
export type KnowledgeType =
  | "bauchgefuehl"
  | "best_practice"
  | "lernkurve"
  | "technik"
  | "negativwissen";

export const KNOWLEDGE_TYPES: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];

export type KoStatus = "offen" | "validiert";

// SCRUM-415: Vertraulichkeitsstufe je Wissensobjekt. „intern" = Öffentlich-intern (Standard, keine
// Einschränkung); „vertraulich"/„streng_vertraulich" = vertraulich → gehen NIE in externe Kontexte
// (Output Factory/Export). Fehlt das Feld (Alt-KOs), gilt „intern".
// WP-SUBMIT-ASYNC: Zustand des Hintergrund-Prüf-Jobs. pending = eingereiht/laufend; done = die
// Erkennung lief (Ergebnis-Signale liegen in conflicts/overlaps); failed = EHRLICH gescheitert
// (fallbackReason: no-model/model-error) — nie stiller Verlust, nie erfundenes Ergebnis.
export type AiCheckStatus = "pending" | "done" | "failed";

// AUFTRAG-mega28 A2 (Pedi 26.07.) — WIE WEIT DER PRÜF-LAUF TATSÄCHLICH REICHTE.
// Seit mega28 deckeln beide Erkennungswege ihre Kandidatenmenge (App-Root: DETECTION_CANDIDATE_CAP).
// Ein gedeckelter Lauf darf nicht aussehen wie ein vollständiger: „done" heißt sonst still „gegen 20
// von 12.479 geprüft" und ein leeres Ergebnis läse sich als „konfliktfrei". Diese Zahlen reisen
// deshalb MIT dem Job-Status bis in die Anzeige.
// STRUKTURGLEICH zu conflicts/src/coverage.ts DetectionCoverage — bewusst EIGENSTÄNDIG deklariert:
// knowledge-object kennt conflicts nicht (Modulgrenze). Der App-Root bildet ab.
// AUFTRAG-mega29 B1: aus EINER Zahl (`examined`) sind sieben getrennte Begriffe geworden — eine
// Zahl, die vier Fragen zugleich beantworten musste, log bei jeder (bens M28-2). Bedeutung je Feld
// s. conflicts/src/coverage.ts; diese Deklaration bleibt bewusst eigenständig (Modulgrenze).
export interface AiCheckCoverage {
  available: number;
  selected: number;
  alreadyOpen: number;
  attempted: number;
  completed: number;
  skipped: number;
  capped: boolean;
  aborted: boolean;
}

// AUFTRAG-mega29 C2 (bens M28-3): die schmalste Aussage, die ein LEERES Konflikt-/Duplikat-Board
// braucht, um nicht als „geprüft und frei" gelesen zu werden. Drei Zähler über den Bestand — keine
// Objektdaten, keine IDs. `unchecked` (gar kein Protokoll) ist bewusst von `incomplete` getrennt:
// „über dieses Objekt sagt kein Lauf etwas" ist eine andere Aussage als „der Lauf war unvollständig".
//
// AUFTRAG-mega31 BLOCK A (bens ROT-2, Pedis Umkehr vom 26.07.) — DIE BEWEISLAST WECHSELT DIE SEITE.
// Bis mega29 galt ein Objekt als vollständig geprüft, SOLANGE KEIN MERKER DAS GEGENTEIL SAGTE. Ein
// fehlender Merker erzeugte damit eine Entwarnung — und genau ein fehlender Merker war ROT-1. Jetzt
// gilt: vollständig ist nur, was BELEGT vollständig ist. Jeder unbelegte Zustand ist unvollständig.
//
// VIER SICH AUSSCHLIESSENDE ZÄHLER, in dieser Rangfolge ausgewertet (s. aiCheckCoverageSummary):
//   unchecked   — gar kein Vermerk: über dieses Objekt sagt kein Lauf etwas.
//   incomplete  — ein Lauf, der nicht als vollständig belegt ist (failed/pending ODER ein
//                 Protokoll mit capped/aborted/skipped).
//   noCoverage  — ein abgeschlossen gemeldeter Lauf OHNE Abdeckungsprotokoll (Altbestand von vor
//                 mega28). A4: das ist NICHT „gar kein Lauf" — ein Lauf ist nachweisbar, nur seine
//                 REICHWEITE nicht. Die beiden Aussagen dürfen nicht in einen Zähler fallen.
// Was in keinen der drei fällt, ist belegt vollständig — und nur DAS darf schweigen.
export interface AiCheckCoverageSummary {
  total: number;
  incomplete: number;
  unchecked: number;
  noCoverage: number;
}

export interface AiCheck {
  status: AiCheckStatus;
  requestedAt: string;
  finishedAt?: string;
  fallbackReason?: string;
  // mega28 A2/A3: additiv — Altbestand ohne Feld sagt schlicht nichts über die Abdeckung (und die
  // Anzeige behauptet dann auch nichts).
  coverage?: AiCheckCoverage;
  // WP-SHIP8-FINAL (bens Bedingung 2): der Prüf-Job ist an die INHALTSVERSION gebunden — der
  // pending-Vermerk trägt die KO-Version zum Einreih-Zeitpunkt; der Abschluss schreibt nur, wenn
  // sie noch stimmt (bedingter Write). Additiv: Altbestand ohne Feld = versionsungebundener Job.
  koVersion?: number;
}

export type Confidentiality = "intern" | "vertraulich" | "streng_vertraulich";

export interface HistoryEntry {
  version: number;
  at: string;
  author: string;
  note: string;
}

// FR-KO-06: Diskussion/Kommentare am Objekt (Peer-Austausch, Revisions-Schleife).
export interface KoComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

// FR-CAP-05: Anhang/Foto am Objekt. Pilot: client-seitig verkleinertes Thumbnail
// als Daten-URL (keine Objektspeicher-Infrastruktur nötig, größenbegrenzt).
// SCRUM-121: Anhang rückwärtskompatibel. Alt-Anhänge tragen `dataUrl` (Inline-Original);
// neue Anhänge tragen `objectId` (Referenz auf den Object-Store) + kleine `thumbnail`-Vorschau.
export interface KoAttachment {
  id: string;
  name: string;
  mime: string;
  dataUrl?: string; // Alt-Anhänge (Inline)
  objectId?: string; // neue Anhänge: Referenz ins object-store
  thumbnail?: string; // kleine Vorschau (Daten-URL)
  size?: number; // Originalgröße im Object-Store
  author: string;
  at: string;
}

// Obergrenzen für den Pilot (kleine Thumbnails, JSONB bleibt handhabbar).
// WP-D2: konsistent zur Werksvorgabe DEFAULT_UPLOAD_LIMITS (upload-limits.ts) — dokumententauglich.
export const MAX_ATTACHMENT_BYTES = 20_000_000; // ~20 MB Daten-URL
export const MAX_ATTACHMENTS = 8;

// SCRUM-129 / FR-KO-07: echte Quelle am Objekt. Externe Quellen sind NIE peer-validiert
// (klare Stufe-2-Markierung); kein automatisches Peer-Validation-Verfahren.
export type KoSourceKind = "external";

export interface KoSource {
  id: string;
  label: string;
  url: string | null;
  excerpt: string | null;
  kind: KoSourceKind;
  peerValidated: boolean;
  // SCRUM-118: optionaler Anbieter externer Quellen (z. B. "Wikipedia"). Additiv,
  // JSON-persistiert → keine Migration; Altquellen ohne provider bleiben gültig.
  provider?: string | null;
  // SCRUM-470 (Confluence-Import): strukturierte Herkunfts-Anker für Rückverfolgbarkeit UND
  // idempotenten Re-Sync. externalId = Confluence pageId (Idempotenz-Schlüssel). Additiv,
  // JSON-persistiert → keine Migration; Altquellen ohne diese Felder bleiben gültig.
  externalId?: string;
  spaceKey?: string;
  sourceVersion?: number;
  author: string;
  at: string;
}

// AUFTRAG-mega18 Block A-1: Vermerk eines ABGESCHLOSSENEN Übernahme-Vorgangs (Verbund-Operation
// „Dokumentinhalt übernehmen"). Er trägt das Commit-Ergebnis, nicht nur die Kennung: eine
// Wiederholung desselben Vorgangs kann damit EXAKT dieselbe Antwort liefern, ohne ein zweites Mal
// zu schreiben. Die Begründung (warum der Aufrufer die Kennung bildet, warum sie am Objekt liegt,
// warum sie gedeckelt ist) steht in document-append.ts.
export interface KoAppendOp {
  /** Die Operations-Kennung des Aufrufers — reiner Deduplizierungs-Schlüssel, ohne Autorität. */
  id: string;
  at: string;
  /** Die Inhaltsversion, die dieser Vorgang hinterlassen hat. */
  koVersion: number;
  /** Der Anhang, der als Anker entstand (das Originaldokument am Objekt). */
  attachmentId: string;
  /** Die Belegstellen, die dieser Vorgang angelegt hat. */
  sourceIds: string[];
}

// FR-KO-01: Datenmodell inkl. version/history/originalAuthor/needed/assignments/asset
// (Pflichtenheft §3.5, Technischer Anhang §1).
export interface KnowledgeObject {
  id: string;
  title: string; // Titel als Aussage
  statement: string; // bleibt Plaintext-Kurzfassung (Output/Ask/Suche)
  // KW-STR / SCRUM-45/46/48: optionaler WYSIWYG-Body als sanitisiertes HTML (additiv).
  bodyHtml?: string | null;
  // WP-BILD-1g (bens sammel14-ROT): ABGELEITETES Suchfeld — die Bild-Fußnoten (figcaption-Texte)
  // des bodyHtml, beim SCHREIBEN mit dem body-sparenden Scanner extrahiert (create/revise). Die
  // Bibliotheks-Suche liest NUR dieses kleine Feld; bodyHtml wird für die Suche nicht mehr geladen.
  // Optional/additiv im JSONB-Dokument (keine Migration): FEHLT das Feld, ist es ein Legacy-KO von
  // vor dieser Regel → einmaliger Backfill beim ersten Such-Kandidaten (danach immer gesetzt, auch
  // als [] für „keine Fußnoten").
  captionTexts?: string[];
  conditions: string[];
  measures: string[];
  type: KnowledgeType;
  category: string;
  tags: string[];
  confidence: number;
  trust: number;
  status: KoStatus;
  version: number;
  // SCRUM-509 R3: monoton wachsender Nebenläufigkeits-Token für optimistische Concurrency auf DB-Ebene.
  // Jeder Write vergleicht ihn (Compare-and-Set): ein veralteter Voll-Objekt-Write scheitert (StaleWrite)
  // statt eine zwischenzeitliche Änderung (z. B. Vertraulichkeits-Upgrade) zu überschreiben. Fehlt das
  // Feld (Alt-Daten), gilt 0.
  rowVersion?: number;
  originalAuthor: string;
  author: string;
  neededValidations: number;
  assignments: string[];
  // SCRUM-415: Vertraulichkeitsstufe (fehlt = „intern"). Vertrauliche KOs gehen nie in externe Kontexte.
  confidentiality?: Confidentiality;
  // Pedi 05.07.: read-only Board-Anreicherung — Peer-Stimmen-Zähler (grün/gelb/rot) für die Anzeige
  // „X von Y grün" auf der Validierungsseite. Nur die Board-Sicht setzt es; sonst undefined.
  reviewVotes?: { up: number; warn: number; down: number };
  // ============================================================================================
  // W3-C (KW-W3-19, Pedi 03.08.) — DER VERWEIS AUF DIE VALIDIERUNGSENTSCHEIDUNG.
  // ============================================================================================
  //
  // Pedis Entscheidung: AUSSCHLIESSLICH das Knowledge Object trägt sie. Ein Rating als Träger
  // wurde verworfen — `adminValidate()` schreibt gar kein Rating und bräuchte einen zweiten Ort.
  //
  // ES IST EIN VERWEIS, KEIN ZWEITER WAHRHEITSORT. Der Auditeintrag bleibt die Wahrheit; wer den
  // Verweis benutzt, löst ihn über `findBySeq` ein und prüft ihn (Audit-Modul:
  // `pruefeValidationDecisionRef`) — er glaubt ihn nicht. Der Wert stammt ausschließlich aus dem
  // Rückgabewert von `AuditService.record()`; eine spätere Suche oder Rekonstruktion über
  // Zeitpunkt, Actor, KO-Version oder aktuellen Status ist ausdrücklicher No-Go von KW-W3-19.
  //
  // OPTIONAL UND OHNE MIGRATION: das KO liegt als Voll-JSONB (`kos.data`). Fehlt das Feld, ist es
  // ein KO ohne festgehaltene Entscheidung — Altbestand oder nie validiert. Das ist EHRLICH
  // `MISSING`, nicht „ungeprüft" und schon gar nicht „gültig". Kein Backfill.
  //
  // WARUM HIER KEINE VERSION DANEBEN STEHT: die geprüfte KO-Fassung reist im Auditpayload mit, und
  // das Subject der Prüfung kommt aus der HEUTIGEN `version` des KO. Würde die Version hier
  // mitgespeichert, meldete eine durch `revise()` überholte Entscheidung dauerhaft `OK` — genau
  // der schlechte Kompromiss, den die Entscheidung ausschließt. Nach einer Revision bleibt der
  // Verweis stehen und wird folgerichtig `WRONG_SUBJECT`.
  validationDecisionRef?: { auditSeq: number; auditHash: string };
  asset: string | null;
  createdAt: string;
  history: HistoryEntry[];
  comments: KoComment[];
  attachments: KoAttachment[];
  sources: KoSource[];
  // Demodaten-Merker (Pedi 02.07.): vom Seed gesetzt, überlebt Bearbeitungen/Versionen —
  // damit Demo-Bestand sichtbar bleibt und komplett entfernt werden kann.
  demoSeed?: boolean;
  // WP-SHIP8-CLOSE-3/4 (bens ROT-1, 1A/1B/1C): STABILER Idempotenzanker des Import-Accepts — die
  // Id des Review-KANDIDATEN, aus dem dieses KO entstand. Bewusst der Kandidat (stabil über alle
  // Claim-Vorgänge/Retries hinweg), NICHT die je Claim wechselnde opId: nur so erzwingt der
  // partielle Unique-Index (kos_import_candidate_uq, inkl. Papierkorb) „höchstens EIN KO je
  // Kandidat" — späte Writes eines abgelösten Laufs kollidieren und werden adoptiert statt
  // dupliziert. NUR der Import-Accept-Pfad setzt das Feld (die öffentliche Schreibroute verwirft
  // es wie `sources`); die Claim-Recovery findet darüber ein bereits erzeugtes KO — auch im
  // Papierkorb.
  importCandidateId?: string;
  // WP-SUBMIT-ASYNC (Pedis R3 21.07.): Status der HINTERGRUND-KI-Prüfung nach dem Einreichen —
  // additiv im JSONB, keine Migration; Altbestand ohne Feld = kein Prüf-Job. Die Ergebnis-Signale
  // (Konflikte/Überschneidungen) entstehen unverändert in ihren Services — aiCheck trägt nur den
  // ehrlichen Job-Status für die Validierungs-Anzeige.
  aiCheck?: AiCheck;
  // AUFTRAG-mega18 Block A-1: Vorgangsgedächtnis der VERBUND-OPERATION „Dokumentinhalt übernehmen"
  // (KoService.appendDocumentExtract). Additiv im JSONB, keine Migration; Altbestand ohne Feld hat
  // schlicht noch keinen Vorgang erinnert. Es liegt AM OBJEKT und nicht in einem Prozessspeicher,
  // damit die Idempotenz-Prüfung Teil desselben Read-Modify-Write ist wie der Vollzug (kein TOCTOU),
  // einen Neustart übersteht und prozessübergreifend gilt. Gedeckelt (DOCUMENT_APPEND_OP_MEMORY) —
  // die Grenze und ihr Preis stehen ausgeschrieben in document-append.ts.
  appendOps?: KoAppendOp[];
  // AUFTRAG-mega20 Block A: STABILER Idempotenzanker der ERSTANLAGE aus Dokumenten
  // (KoService.createWithDocuments). Anders als `appendOps` kann er nicht im Vorgangsgedächtnis
  // eines bestehenden Objekts liegen — das Objekt entsteht ja gerade erst. Er liegt deshalb AM
  // Objekt und ist DB-weit eindeutig (partieller Unique-Index kos_create_operation_uq, inkl.
  // Papierkorb): ein zweiter Insert desselben Vorgangs kollidiert hart und wird ADOPTIERT statt
  // dupliziert. Additiv im JSONB; Altbestand ohne Feld ist vor dieser Regel entstanden.
  // NUR die Dokumentübernahme setzt das Feld — die öffentliche Schreibroute verwirft es wie
  // `sources` und `importCandidateId`. Die Begründung steht in document-create.ts.
  createOperationId?: string;
  // AUFTRAG-mega20 Block A: REPARATURVERMERK. Gesetzt, wenn die kompensierende Rücknahme einer
  // gescheiterten Erstanlage selbst gescheitert ist — dann steht dieses Objekt im Bestand, obwohl
  // seine Belege (Snapshot/Evidence/Audit) unvollständig sein können. Bis mega19 wurde der
  // Rollback-Fehler verschluckt und dieser Zustand war unsichtbar. Der Vermerk repariert nichts;
  // er macht das Objekt AUFFINDBAR und den Grund BENENNBAR (s. document-create.ts, KoRepairNote).
  needsRepair?: KoRepairNote;
  // AUFTRAG-mega21 Block A: DER VORGANGS-DATENSATZ. `createOperationId` allein ist nur ein
  // SCHLÜSSEL — er weiß nicht, WEM der Vorgang gehört, WAS er war und WIE er ausging. Genau diese
  // drei Lücken waren bens SB-1, SB-3 und SB-4. Der Datensatz liegt AM Objekt (wie der Schlüssel
  // selbst) und wird im SELBEN `repo.insert` geschrieben — es gibt keinen Augenblick, in dem der
  // Schlüssel ohne seinen Eigentümer im Bestand steht. Additiv im JSONB, keine Migration; Altbestand
  // ohne Datensatz ist vor dieser Regel entstanden und wird in adoptCreatedKo eigens behandelt.
  createOperation?: KoCreateOperation;
  // AUFTRAG-mega21 Block C-1: die nach dem Commit GESCHEITERTEN Nacharbeiten, DAUERHAFT am Objekt.
  // Bis mega20 standen sie nur in der Antwort (`followUpsFailed`) und im Audit — die Antwort ist
  // weg, sobald der Browser sie gelesen hat, und im Audit sucht niemand. Ein Wissensobjekt, dessen
  // Prüferzuweisung fehlschlug, war damit ununterscheidbar von einem, das gar keine brauchte. Hier
  // ist es AUFFINDBAR: ein Feld am Objekt, das jede Abfrage sieht und das einen Neustart übersteht.
  createFollowUpsFailed?: string[];
  // SCRUM-422 (Papierkorb): gesetzt beim Soft-Delete. Getrashte KOs sind aus ALLEN
  // Lese-/Mutations-Pfaden ausgeblendet (wirken gelöscht) und werden nach Ablauf der
  // Frist automatisch endgültig entfernt. Demo-Daten landen NIE hier (immer hart).
  deletedAt?: string;
  deletedBy?: string;
}

// SCRUM-422: Papierkorb-Zeile für den Admin — nur Metadaten, keine Inhalte.
export interface TrashedKo {
  id: string;
  title: string;
  category: string;
  deletedAt: string;
  deletedBy: string;
  // Wann die automatische Endlöschung greift (deletedAt + TRASH_RETENTION_DAYS).
  expiresAt: string;
}

// SCRUM-159 (Knowledge-OS-Foundation): unveränderlicher Voll-Snapshot eines KO je Version.
// Hält den kompletten Stand bei Versions-Erstellung (create/revise) fest. Aktuelles KO bleibt
// canonical current state; Snapshots sind reine Foundation-Infrastruktur (kein UI-Feature).
export interface KoVersionSnapshot {
  koId: string;
  version: number;
  snapshot: KnowledgeObject; // vollständiger Stand dieser Version
  at: string;
  author: string;
  note: string;
}

// SCRUM-160 (Knowledge-OS-Foundation): separate Evidence-Records für externe Quellen
// und Objekt-Anhänge. Additiv zur bestehenden KO-Struktur; keine UI-/API-Änderung.
export type EvidenceKind = "source" | "attachment";

export interface EvidenceRecord {
  id: string;
  koId: string;
  koVersion: number;
  kind: EvidenceKind;
  sourceId?: string;
  attachmentId?: string;
  objectId?: string;
  label: string;
  mime?: string;
  url?: string | null;
  provider?: string | null;
  // AUFTRAG-mega26 Block B: DER GRUND DER VERKNÜPFUNG (additiv, optional).
  //
  // Bis mega25 sagte ein EvidenceRecord, DASS eine Quelle an einem KO hängt, aber nicht, WARUM.
  // Der Grund stand ausschliesslich mittelbar im `excerpt` der zugehörigen `KoSource` — also in
  // einem Datensatz, den die Evidence nicht kopiert und der beim Rollback einer Version verschwindet,
  // während die append-only Evidence bleibt (s. `evidence-without-source` weiter unten). Genau dann
  // war der Beleg vorhanden und seine Begründung weg.
  //
  // Der Erzeuger KENNT den Grund zum Schreibzeitpunkt: an allen drei quellenschreibenden Stellen
  // liegt die fertige `KoSource` samt getrimmtem `excerpt` im selben Scope. Er wird deshalb
  // mitgeschrieben — wörtlich, nicht umformuliert.
  //
  // NUR bei `kind:"source"`. Ein Anhang (`kind:"attachment"`) hat keinen solchen Grund: dort gibt
  // es zum Schreibzeitpunkt keinen Text ausser dem Dateinamen (der bereits in `label` steht).
  // Leerer/fehlender excerpt → Feld weggelassen, nie ein leeres Feld.
  excerpt?: string;
  createdBy: string;
  createdAt: string;
}

/**
 * AUFTRAG-mega20 Block A — der Reparaturvermerk am Wissensobjekt. Die ausgeschriebene Begründung
 * (warum ein verschluckter Rollback-Fehler der teurere Zustand ist, und warum dieser Vermerk best
 * effort bleiben MUSS) steht in document-create.ts.
 */
export interface KoRepairNote {
  /** Zeitpunkt des gescheiterten Rollbacks (ISO). */
  at: string;
  /** Der Beleg-Schritt, der die Anlage zu Fall gebracht hat (Fehlername, PII-frei). */
  failedStep: string;
  /** Warum die Rücknahme selbst nicht ging (Fehlername, PII-frei). */
  rollbackFailure: string;
}

/**
 * AUFTRAG-mega21 Block A — DAS GEDÄCHTNIS DES VORGANGS.
 *
 * Drei Felder, drei Fragen, die `createOperationId` allein nicht beantworten konnte. Die
 * ausgeschriebene Begründung je Feld steht in document-create.ts; hier nur die Kurzform:
 *
 *   · `actor`       — WEM gehört der Vorgang? Der AUTHENTIFIZIERTE Anfragende der Erstanlage,
 *                     unveränderlich. NICHT `author`: der stammt beim Entwurfsweg vom ursprünglichen
 *                     Verfasser (FR-CAP-07) und ist über `setAuthor` später änderbar. Ein
 *                     veränderliches Feld taugt nicht als Eigentümerbindung.
 *   · `fingerprint` — WAS war der Vorgang? Der kanonische Abdruck der Anfrage. Ohne ihn liefert
 *                     derselbe Schlüssel nach einer Inhaltsänderung still das alte Objekt.
 *   · `state`       — WIE ging er aus? `committed` = normal gelungen. `repair_required` = die
 *                     Anlage scheiterte NACH dem Insert und die Rücknahme ebenfalls; das Objekt
 *                     steht mit möglicherweise unvollständigen Belegen im Bestand und darf NIE als
 *                     normaler Erfolg adoptiert werden.
 */
export interface KoCreateOperation {
  /** Der unveränderliche Eigentümer: die Kennung des authentifizierten Anfragenden. */
  actor: string;
  /** Kanonischer Inhaltsabdruck der Anfrage (SHA-256, hex) — s. createOperationFingerprint. */
  fingerprint: string;
  /** Der Zustand des Vorgangs. Ein Reparaturrest wird nie als Erfolg ausgeliefert. */
  state: KoCreateOperationState;
  /** Zeitpunkt der Anlage (ISO). */
  at: string;
}

export type KoCreateOperationState = "committed" | "repair_required";

export type KoErrorCode =
  | "NOT_FOUND"
  | "INVALID_TYPE"
  | "INVALID_NEEDED"
  | "INVALID_SOURCE"
  // SCRUM-421: ungültige Upload-Grenzen (Admin-Einstellung).
  | "INVALID_UPLOAD_LIMITS"
  // SCRUM-509: ungültige Vertraulichkeitsstufe (kein stilles Normalisieren auf „intern").
  | "INVALID_CONFIDENTIALITY"
  // SCRUM-509 R2: Herabstufung ohne Prüfer-/Admin-Rolle (atomar an der Datenschicht geprüft).
  | "DOWNGRADE_FORBIDDEN"
  // SCRUM-509 R3: optimistische Concurrency — der Voll-Objekt-Write war veraltet (rowVersion-Konflikt).
  | "STALE_WRITE"
  // WP-SHIP8-CLOSE-4 (bens ROT-1B): der Kandidaten-Anker (importCandidateId) ist bereits vergeben —
  // ein zweites KO desselben Import-Kandidaten wird DB-seitig abgelehnt (Pg: partieller Unique-Index,
  // InMemory: Insert-Guard). Der Import-Accept adoptiert dann das bestehende KO statt zu duplizieren.
  | "IMPORT_ANCHOR_TAKEN"
  // AUFTRAG-mega18 Block A-2: die INTERNE BELEGPFLICHT hat gegriffen — übernommener Dokumentinhalt
  // ohne echten Original-Anker. Eine eigene Regel, unabhängig von der externen Stufe; die
  // Begründung der Trennung steht in document-append.ts.
  | "MISSING_DOCUMENT_ANCHOR"
  // AUFTRAG-mega18 Block A-1: die Verbund-Operation braucht einen wiederholbaren Vorgangsschlüssel
  // (Idempotenz). Fehlt er oder ist er unbrauchbar, wird ehrlich abgelehnt statt einer erfundenen
  // Kennung — die würde die Wiederholbarkeit lautlos aufheben.
  | "INVALID_OPERATION_ID"
  // AUFTRAG-mega20 Block A: die Erzeugungs-Kennung der Dokumentübernahme ist bereits vergeben —
  // ein zweites Wissensobjekt DESSELBEN Vorgangs wird DB-seitig abgelehnt (Pg: partieller
  // Unique-Index kos_create_operation_uq, InMemory: Insert-Guard). Der Service adoptiert daraufhin
  // das bestehende Objekt statt zu duplizieren; nach außen wird dieser Code nur sichtbar, wenn die
  // Adoption NICHT zulässig ist (fremde Autorschaft) — dann ehrlich als Konflikt.
  | "CREATE_ANCHOR_TAKEN"
  // AUFTRAG-mega20 Block A: die kompensierende RÜCKNAHME einer gescheiterten Erstanlage ist selbst
  // gescheitert. Das Wissensobjekt steht im Bestand und ist möglicherweise unvollständig belegt.
  // Bis mega19 wurde dieser Fall verschluckt (`.catch(() => undefined)`) und der Aufrufer sah nur
  // den ursprünglichen Fehler. Jetzt ist er ein EIGENER Fehler mit der Kennung des Objekts.
  | "CREATE_ROLLBACK_FAILED"
  // AUFTRAG-mega21 Block A: DERSELBE Vorgangsschlüssel, ABWEICHENDER Inhalt. Bis mega20 wurde in
  // diesem Fall still das alte Objekt geliefert — der Nutzer hatte gerade Text geändert und bekam
  // den vorherigen Stand zurück, ohne es zu erfahren. Jetzt ist es ein ausdrücklicher Fehler mit
  // einem Weg zurück (die Oberfläche bietet an, den Vorgang neu zu beginnen).
  | "IDEMPOTENCY_PAYLOAD_MISMATCH"
  // AUFTRAG-mega21 Block A: der Vorgang steht auf `repair_required` — Anlage UND Rücknahme sind
  // gescheitert, das Objekt ist möglicherweise unvollständig belegt. Ein Wiederholversuch bekommt
  // diesen Rest NIE als Erfolg (das war bens SB-4), sondern eine ehrliche Auskunft.
  | "CREATE_REPAIR_REQUIRED"
  // G27 R1 (KW-ARCH-G27-RESTFRAGEN-05 §2): die Standardsuche ist NICHT verfügbar, weil keine
  // Projektionsfassung freigegeben ist (`UNINITIALIZED`, `V2_BUILDING`, `V2_READY`, `FAILED`) oder
  // der Control-State beschädigt/inkonsistent ist. REIN ADDITIV und rein INTERN: technische
  // Betriebslogik der Suchinfrastruktur, keine Änderung am KO-Fachmodell, keine Routen- und keine
  // Vertragsänderung nach außen. Er existiert, weil die Alternative — `[]` — gelogen hätte: eine
  // leere Treffermenge bedeutet fachlich „nichts gefunden" und darf „Suche nicht verfügbar" nicht
  // verschleiern (Entscheidung 04 §4).
  | "SEARCH_PROJECTION_NOT_READY";

export class KoError extends Error {
  readonly code: KoErrorCode;
  /**
   * AUFTRAG-mega20 Block A: ADDITIVE Zusatzangaben für Fehler, bei denen der Aufrufer mehr braucht
   * als eine Meldung. Konkret `CREATE_ROLLBACK_FAILED`: ohne die Kennung des zurückgebliebenen
   * Objekts ist „es ist etwas übrig" keine reparierbare Aussage, sondern nur eine beunruhigende.
   * Optional und rein informativ — keine bestehende Fehlerstelle ändert ihr Verhalten dadurch.
   * `cause` trägt den URSPRÜNGLICHEN Fehler; er wird bewusst NICHT in `message` gespiegelt, damit
   * nichts über sendError nach außen leckt, was dort nicht hingehört (SCRUM-496).
   */
  readonly details?: { readonly koId?: string; readonly cause?: unknown };

  constructor(code: KoErrorCode, message: string, details?: { koId?: string; cause?: unknown }) {
    super(message);
    this.code = code;
    this.name = "KoError";
    if (details) {
      this.details = details;
    }
  }
}
