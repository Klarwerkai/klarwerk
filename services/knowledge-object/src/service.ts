import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { TxContext } from "../../db-tx";
// WP-BILD-1h: searchCaptionTexts = Scanner + kanonischer Größendeckel — der EINE Pfad für
// create, revise und Legacy-Backfill (keine ungedeckelten captionTexts in der Persistenz).
import { htmlToPlainText, sanitizeHtml, searchCaptionTexts } from "../../structure";
import {
  isConfidential,
  isConfidentialityDowngrade,
  isValidConfidentiality,
  normalizeConfidentiality,
} from "./confidentiality";
// AUFTRAG-mega32 A1: die EINE Auslegung von „vollständig geprüft" auf dieser Modulseite.
import { isCompleteAiCheckCoverage } from "./coverage-complete";
// AUFTRAG-mega18 Block A: die reine interne Belegpflicht + das Vorgangsgedächtnis der
// Verbund-Operation. Die Trennung „externe Stufenregel vs. interne Belegpflicht" ist dort
// ausgeschrieben — sie ist der eigentliche Befund dieses Auftrags.
import {
  normalizeAppendOperationId,
  rememberAppendOp,
  requireDocumentEvidence,
} from "./document-append";
// AUFTRAG-mega20 Block A: der Vorgangsschlüssel der ERSTANLAGE. Warum er vom Aufrufer kommt, warum
// er trotzdem keine Autorität trägt und warum er DB-weit eindeutig sein muss statt im Objekt zu
// liegen — alles ausgeschrieben in document-create.ts.
import { normalizeCreateOperationId } from "./document-create";
// G27 Welle 1 / S2 + Effective Search Document: die zweite, veränderliche Projektionsart und die
// Zusammensetzung beider zu der einen Sicht, die der Suchkonsument bekommt.
import {
  type EffectiveSearchDocument,
  composeEffectiveSearchDocument,
} from "./effective-search-document";
import {
  type KoMetadataProjection,
  metadataTextsEqual,
  metadataTextsOf,
} from "./metadata-projection";
import type { KoMetadataProjectionResult } from "./metadata-projection-repo";
import type {
  EvidenceRepo,
  KoCandidateQuery,
  KoFilter,
  KoRepo,
  KoSichtbarkeitstrim,
  KoVersionRepo,
} from "./repo";
// G27: die revisionsgebundene Suchprojektion — reine Ableitung (search-projection.ts) und ihre
// Persistenz (search-projection-repo.ts). Warum es sie gibt, steht im Kopf der Ableitungsdatei.
import {
  type ClassificationSnapshot,
  type KoSearchHit,
  type KoSearchProjection,
  type KoSearchQuery,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  classificationFromVersionSnapshot,
  reconstructedClassification,
} from "./search-projection";
import {
  InMemoryKoSearchProjectionRepo,
  type KoSearchProjectionRepo,
  type ProjectionAudit,
  type ProjectionControlState,
  type ProjectionState,
  UNINITIALIZED_CONTROL_STATE,
  controlStateLifecycleGueltig,
  integritaetsMarkerFuer,
} from "./search-projection-repo";
// SCRUM-527 (WP2): Quell-URL-Allowlist an der Persistenzgrenze (nur absolute http/https).
import { safeSourceUrl, sanitizeSources } from "./source-url";
import {
  type AiCheckCoverage,
  type AiCheckCoverageSummary,
  type Confidentiality,
  type EvidenceRecord,
  KNOWLEDGE_TYPES,
  type KnowledgeObject,
  type KnowledgeType,
  type KoAppendOp,
  type KoAttachment,
  type KoComment,
  type KoCreateOperation,
  KoError,
  type KoRepairNote,
  type KoSource,
  type KoStatus,
  type TrashedKo,
} from "./types";

/**
 * AUFTRAG-mega21 Block A — WER FRAGT, UND MIT WELCHEM INHALT.
 *
 * Die zwei Angaben, die der Nachschlag der Erstanlage braucht und die mega20 beide fehlten. Sie
 * stehen zusammen in EINEM Typ, weil sie zusammen geprüft werden und weil zwei lose Parameter
 * (`author`, `fingerprint`) an einer Aufrufstelle vertauschbar wären.
 */
export interface CreateOperationRequester {
  /** Der AUTHENTIFIZIERTE Anfragende — nie `input.author`, s. document-create.ts. */
  actor: string;
  /** Der kanonische Inhaltsabdruck der Anfrage (createOperationFingerprint). */
  fingerprint: string;
}

const DEFAULT_NEEDED_VALIDATIONS = 3; // FR-CAP-08: 1–5, Standard 3.

// SCRUM-422 (Pedi 03.07.): Aufbewahrungsfrist im Papierkorb — danach automatische Endlöschung.
export const TRASH_RETENTION_DAYS = 28;

// SCRUM-358 / AG-05 / AG-14-SERVER-TRUST: konservative, nachvollziehbare Trust-Strafe, wenn ein offener
// Wahrheitskonflikt ein validiertes KO zurück in Review holt. Bewusst KLEIN (kein Reset auf 0): ein
// Konflikt macht ein KO nicht „falsch" — er macht es review-pflichtig. Wert orientiert am Technischen
// Anhang §3 (Truth-Impact ~ −12). Eine vollständige spec-konforme Trust-Formel bleibt Folge-Gap (EK-22).
export const TRUTH_CONFLICT_TRUST_PENALTY = 12;

// G27: wie viele Altbestands-Objekte eine EINZELNE Suchanfrage höchstens nachprojiziert. Dasselbe
// Muster und dieselbe Größenordnung wie der Fußnoten-Backfill der Bibliothek
// (SEARCH_BACKFILL_LIMIT_PER_QUERY = 20): die Suche darf nie zum Bestands-Durchlauf werden, und
// der Rest wird von der nächsten Anfrage bzw. vom ausdrücklichen Lauf abgearbeitet (konvergiert).
// G27 R1 (Entscheidung 04 §5): DER DECKEL BLEIBT, SEIN AUFRUFORT NICHT. Der gedeckelte Nachzug ist
// weiterhin Hintergrundhilfe und Optimierung — aber KEIN Suchweg stößt ihn mehr an. „Der reguläre
// Suchpfad darf funktional nicht von ihm abhängen"; er aktiviert nichts, gibt keine Readiness frei
// und bestätigt keine Konsistenz. Der Wert bleibt die Schwunggröße für ausdrückliche
// Wartungsläufe und ist Teil der öffentlichen Modulfläche.
export const SEARCH_PROJECTION_BACKFILL_PER_QUERY = 20;

// Der Schwung des UNGEDECKELTEN Abgleichs. Groß genug, dass der Bestand in wenigen Runden
// abgearbeitet ist; endlich, damit eine einzelne Abfrage nicht unbegrenzt Zeilen zieht.
const RECONCILE_SCHWUNG = 5000;

/**
 * Das Ergebnis der fünf Gate-Prüfungen. `alle` ist die EINE Zusage, an der die Freigabe hängt;
 * `befunde` sagt PII-frei, woran es sonst liegt — „nicht bereit" ohne Grund wäre keine Auskunft.
 */
export interface SearchProjectionReadiness {
  /** 1 — vollständiger Rebuild dieses Baus. */
  rebuild: boolean;
  /** 2 — Reconcile dieses Baus, ohne verbleibende Differenz. */
  reconcile: boolean;
  /** 3 — jedes lebende Objekt trägt BEIDE Hälften des Suchdokuments. */
  konsistenz: boolean;
  /** 4 — alle aktiven Zeilen in der Zielfassung, keine Mischversionen. */
  projektionsversion: boolean;
  /** 5 — Eindeutigkeit, Zeiger, Vollständigkeit, Pflichtfelder, Hash, Lifecycle. */
  integritaet: boolean;
  alle: boolean;
  befunde: string[];
}

// Was EIN Nachzug eines Objekts herstellt (s. `ensureSearchArtifacts`). `v2Migriert` sagt, ob dabei
// eine Zeile der alten Projektionsfassung ausdrücklich auf Fassung 2 gehoben wurde.
interface SearchArtifacts {
  captionTexts: string[];
  projection: KoSearchProjection | undefined;
  v2Migriert: boolean;
}

// Schlagwörter sind eine FOLGE, keine Menge: die Reihenfolge stammt vom Menschen und geht so in den
// `tag_text` der Metadatenprojektion ein. Eine Umsortierung ist deshalb eine wirksame Änderung —
// und ein Vergleich, der sie nicht sieht, wäre eine falsche Idempotenz-Zusage.
function gleicheTagFolge(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  const links = a ?? [];
  const rechts = b ?? [];
  return links.length === rechts.length && links.every((tag, i) => tag === rechts[i]);
}

// SCRUM-169: defensives Limit für den read-only Evidence-Index (QM/Stufe 2).
export const DEFAULT_EVIDENCE_LIMIT = 100;
export const MAX_EVIDENCE_LIMIT = 500;
export function normalizeEvidenceLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_EVIDENCE_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_EVIDENCE_LIMIT);
}

// SCRUM-523 P.3 (WP-A2): storage-neutrale Transaktions-Fähigkeit für den EINEN Chokepoint, der sie
// wirklich braucht (purgeKo: repo.delete + audit.record ATOMAR, s. dort). Von der Kompositionswurzel
// injiziert (build-app.ts bindet sie über withPgTx an den echten, mit PgKoRepo/PgAuditRepo geteilten
// Pg-Pool); ohne Injektion (Tests, InMemory, Dev-Journal-Persistenz) bleibt purgeKo beim sequentiellen
// Fallback. `fn` bekommt den opaken TxContext (services/db-tx) und reicht ihn an repo.delete/
// audit.record durch — KEIN Pg-Typ in dieser Signatur.
export type WithTx = <T>(fn: (tx: TxContext) => Promise<T>) => Promise<T>;

export interface KoServiceDeps {
  repo: KoRepo;
  audit?: AuditService;
  // SCRUM-159: optionales Versions-Repo. Ist es gesetzt, werden bei create/revise
  // vollständige, unveränderliche Snapshots geschrieben (Knowledge-OS-Foundation).
  versions?: KoVersionRepo;
  // SCRUM-160: optionales Evidence-Repo. Ist es gesetzt, werden Quellen/Objekt-Anhänge
  // als fachliche Evidence-Records zusätzlich zum KO-JSON persistiert.
  evidence?: EvidenceRepo;
  // G27: Persistenz der revisionsgebundenen Suchprojektion. BEWUSST NICHT optional im Verhalten —
  // fehlt die Injektion, baut der Service sich einen In-Memory-Adapter über DASSELBE KO-Repo.
  // Grund: „gemeinsamer Suchvertrag für Bibliothek und Klara" darf nicht davon abhängen, ob eine
  // Kompositionswurzel daran gedacht hat. Die Postgres-Variante wird von build-app injiziert.
  searchProjections?: KoSearchProjectionRepo;
  now?: () => number;
  genId?: () => string;
  // SCRUM-395: optionaler Lieferant der Standard-Prüferanzahl (Admin-Einstellung im
  // Validierungs-Modul). Als injizierte Funktion — KEIN Import über die Modulgrenze.
  // null/undefined → fester Modul-Default (DEFAULT_NEEDED_VALIDATIONS).
  defaultNeededValidations?: () => Promise<number | null | undefined>;
  // SCRUM-523 P.3 (WP2): zentraler Purge-Aufräum-Hook. Wird beim HARTEN Endlöschen eines KO (manuell
  // ODER automatisch abgelaufen) genau EINMAL aufgerufen, damit Folgeartefakte (offene Konflikte/
  // Überschneidungen, Embedding-Vektor) nicht verwaisen. Als injizierte Funktion — KEIN Import über die
  // Modulgrenze; die App (Composition-Root) verdrahtet conflicts/overlaps/Embedding-Cleanup dahinter.
  onPurge?: (koId: string, actor: string) => Promise<void>;
  // SCRUM-523 P.3 (WP-A2): optionale echte DB-Transaktion für purgeKo (repo.delete + audit.record).
  withTx?: WithTx;
}

export interface CreateKoInput {
  title: string;
  statement: string;
  type: KnowledgeType;
  category: string;
  author: string;
  conditions?: string[];
  measures?: string[];
  tags?: string[];
  confidence?: number;
  neededValidations?: number;
  asset?: string | null;
  bodyHtml?: string | null; // KW-STR: WYSIWYG-Body, serverseitig sanitisiert
  demoSeed?: boolean; // Demodaten-Merker (nur der Seed setzt das; nie über die öffentliche Route)
  // SCRUM-415: optionale Vertraulichkeitsstufe ab Erfassen (Standard „intern").
  confidentiality?: Confidentiality;
  // SCRUM-470 (Confluence-Import): optionale Herkunftsquellen ab Erfassen (z. B. Confluence-Seite mit
  // pageId/spaceKey/Version). Additiv — ohne Feld bleibt es wie bisher bei []. Nur der Import-Pfad setzt es.
  sources?: KoSource[];
  // WP-SAMMEL21-FIX (Pedis Autor-Entscheid, Fix 4): optionaler WISSENSTRÄGER abweichend vom
  // System-Autor. Nur der Import-Accept setzt ihn (Quell-Autor aus Confluence/Jira — KEIN
  // KLARWERK-Nutzer, KEIN Fake-User): `author` bleibt der annehmende Reviewer (RBAC/Historie),
  // `originalAuthor` trägt den Quell-Autor — exakt das bestehende Anzeige-/Aggregationsfeld
  // (busFactor/expertise zählen originalAuthor; die UI löst per nameOf mit Roh-Fallback auf).
  // Ohne Feld bleibt es beim Bestandsverhalten (originalAuthor = author).
  originalAuthor?: string;
  // WP-SHIP8-CLOSE-3/4 (bens ROT-1, 1A/1B/1C): STABILER Kandidaten-Anker des Import-Accepts
  // (Id des Review-Kandidaten; DB-unique via kos_import_candidate_uq). Nur der Import-Accept
  // setzt ihn; die öffentlichen Schreibrouten verwerfen das Feld wie `sources` (sonst könnte
  // ein Client die Crash-Recovery eines fremden Review-Claims kapern).
  importCandidateId?: string;
}

export interface ReviseKoInput {
  title?: string;
  statement?: string;
  type?: KnowledgeType;
  conditions?: string[];
  measures?: string[];
  bodyHtml?: string | null; // KW-STR: WYSIWYG-Body, serverseitig sanitisiert
  // SCRUM-470 (Confluence Re-Sync): Herkunfts-Anker fortschreiben (z. B. neue Confluence-Version).
  // Ohne Feld bleiben die Quellen über die Revision erhalten (Alt-Verhalten).
  sources?: KoSource[];
}

// ==============================================================================================
// AUFTRAG-mega18 Block A-1 — DIE VERBUND-OPERATION „DOKUMENTINHALT ÜBERNEHMEN"
// ==============================================================================================
//
// WARUM SIE HIER STEHT UND NICHT IM BROWSER. Dreimal haben wir Aufrufreihenfolgen im Client
// sortiert (mega15, mega16, mega17) und dreimal blieb eine verteilte Fehlerkante übrig, weil die
// Reihenfolge das Problem nicht ist: DREI getrennte Schreibvorgänge sind das Problem. Jede Grenze
// zwischen ihnen ist ein Zustand, in dem etwas gilt und etwas anderes nicht — und ein Client, der
// über das Netz zuschaut, kann nach einem Abbruch nicht wissen, welcher es ist.
//
// WAS SIE UNMÖGLICH MACHT — die vier von ben belegten Ist-Zustände, jeder mit seinem Mechanismus:
//
//  (1) DER UNKLARE REVISIONSAUSGANG. Die Route persistierte `ko.revise` und lief danach weiter
//      (conflicts/overlaps/aiCheck/Antwortzustellung). Wirft dort etwas — oder reißt die
//      Verbindung —, lehnte der Fetch ab, OBWOHL der Body gespeichert war; der Client deutete das
//      als „nicht committed" und nahm die Quellen zurück. Ergebnis: neuer Inhalt, Quellen weg,
//      Nutzer falsch informiert.
//      → GELÖST DURCH IDEMPOTENZ, nicht durch eine bessere Reihenfolge. Der Ausgang darf unklar
//        bleiben; der Aufrufer muss ihn nur GEFAHRLOS ERFRAGEN können. Derselbe Aufruf mit
//        derselben `operationId` liefert dasselbe Ergebnis, ohne ein zweites Mal zu schreiben.
//        Blindes Kompensieren nach unklarem Ausgang ist damit nicht nur verboten, sondern
//        unnötig — es gibt einen ehrlichen Weg, die Wahrheit zu erfahren.
//
//  (2) DER SPEICHERBARE ZWISCHENSTAND. Im KO-Detail wanderte der Dokumentinhalt sofort in den
//      lokalen Edit-Body, während die Punktquellen als nicht abgewartete Einzelmutationen liefen.
//      Ein Quellenfehler setzte nur einen Toast — der Speichern-Knopf wusste davon nichts.
//      → GELÖST DURCH DIE ZUSAGE DIESER OPERATION: sie committet Inhalt UND Herkunft gemeinsam.
//        Damit gibt es keinen „übernommenen, aber unbelegten" Zwischenstand mehr, den ein
//        Speichern-Knopf versehentlich festschreiben könnte (Client-Seite: KnowledgeDetail.tsx).
//
//  (3) DER PARALLELE COMPARE-AND-SET. Mehrere Punktquellen liefen gleichzeitig gegen einen
//      Vollobjekt-CAS; bei gleicher gelesener `rowVersion` verlor einer mit STALE_WRITE.
//      → STRUKTURELL GELÖST: diese Operation macht GENAU EINEN `repo.update`. Nicht „seriell
//        statt parallel" — EINEN. Zwei Punkte, zwanzig Punkte, ein Schreibvorgang. Es gibt keine
//        zweite gelesene rowVersion, gegen die etwas verlieren könnte.
//
//  (4) DIE GESCHLUCKTE ANKERLÜCKE. `composeAppendToArticle` fing jeden Fehler des Anker-Schritts
//      und machte mit `anchor = undefined` weiter; auf zwei von vier Stufen nahm die Policy die
//      ankerlose Quelle an.
//      → GELÖST DURCH DIE EIGENE REGEL (A-2, document-append.ts): `requireDocumentEvidence` WIRFT.
//        Sie liefert kein „false", das jemand ignorieren könnte, und sie kennt die Stufe nicht.
//
// DIE REIHENFOLGE IM INNEREN. Der Auftrag verlangt „Anker sichern, Quellen seriell und
// vollständig, erst danach die Revision". Genau das steht unten — aber als AUFBAU EINES OBJEKTS,
// das dann in einem Zug persistiert wird. Das ist die stärkere Erfüllung derselben Absicht: eine
// Reihenfolge schützt davor, dass ein Teilzustand SCHÄDLICH ist; ein einziger Schreibvorgang
// schützt davor, dass er ENTSTEHT. Der verbotene Zustand „Inhalt ohne aktive Herkunft" ist danach
// nicht mehr unwahrscheinlich, sondern unerreichbar.
//
// WAS ENTFALLEN IST. Die Kompensation per `remove-source`. ben hat sie auseinandergenommen: sie
// kann selbst scheitern, der zuvor angelegte append-only EvidenceRecord bleibt ohnehin stehen
// (unten, `appendEvidence`), die Oberfläche erkennt das als `evidence-without-source`, und bei
// unklarem Revisionsausgang macht sie den Schaden erst. Sie ist restlos ersetzt.
export interface DocumentAppendAnchorInput {
  /** Kennung des Objekts im Objektspeicher. Der Aufrufer hat sie dort NACHGESCHLAGEN. */
  objectId: string;
  name: string;
  mime: string;
  thumbnail?: string;
  /** Die GESPEICHERTE Größe (vom Aufrufer aus dem Objektspeicher gelesen, nie vom Client). */
  size?: number;
}

export interface DocumentAppendSourceInput {
  label: string;
  url?: string | null;
  excerpt?: string | null;
  /** Serverseitig abgeleitet (der Aufrufer nutzt `attributeExternalSource`), nie übernommen. */
  provider?: string | null;
}

/**
 * AUFTRAG-mega19 Block B — EIN ANKERDOKUMENT MIT SEINEN BELEGSTELLEN.
 *
 * Der Baustein der Erstanlage aus Dokumenten (`createWithDocuments`). Bewusst DIESELBEN Feldtypen
 * wie die Verbund-Operation: ein Anker ist ein Anker, eine Belegstelle ist eine Belegstelle — auch
 * wenn das Wissensobjekt in dem einen Fall schon existiert und im anderen gerade entsteht.
 *
 * KEINE `operationId`. Der Grund ist nicht Nachlässigkeit: die Erstanlage hat keinen wiederholbaren
 * Vorgangsschlüssel, weil sie kein bestehendes Objekt hat, an dem sie ihn erinnern könnte. Eine
 * Wiederholung der Erstanlage ist deshalb ein NEUES Wissensobjekt — sichtbar, auffindbar und über
 * die Duplikat-Erkennung behandelbar, statt still verschluckt. Das ist die ehrliche Grenze dieses
 * Blocks; sie steht hier, damit sie niemand für eine Zusage hält.
 */
export interface DocumentBundleInput {
  anchor: DocumentAppendAnchorInput;
  /** Die Belegstellen aus GENAU diesem Dokument. Leer ist ein Fehler, keine leere Übernahme. */
  sources: readonly DocumentAppendSourceInput[];
}

export interface DocumentAppendInput {
  /** Wiederholbarer Vorgangsschlüssel des Aufrufers (Idempotenz, s. document-append.ts). */
  operationId: string;
  /**
   * Das Originaldokument, das zum ANKER wird. `null` ist erlaubt und führt zum ehrlichen Abbruch
   * (MISSING_DOCUMENT_ANCHOR) — bewusst kein Pflichtfeld im Typ, damit der Aufrufer den Fall nicht
   * per `!` wegcastet, sondern die Regel ihn WERFEN sieht.
   */
  anchor: DocumentAppendAnchorInput | null;
  /** Die Belegstellen — eine je übernommenem Punkt. Leer ist ein Fehler, keine leere Übernahme. */
  sources: readonly DocumentAppendSourceInput[];
  /**
   * Der überarbeitete Inhalt. FEHLT das Feld, bindet die Operation NUR Anker + Belege ohne
   * Versions-Bump — der Fall des Erfassens, wo `create` den Inhalt im selben Vorgang schon
   * committet hat (die öffentliche create-Route verwirft Client-`sources` bewusst, SCRUM-470).
   */
  changes?: { bodyHtml: string; statement?: string; title?: string };
}

/**
 * DAS EINDEUTIGE COMMIT-ERGEBNIS. Es sagt, was TATSÄCHLICH gilt — nicht „Fehler", aus dem ein
 * Client raten müsste. `committed` ist absichtlich das Literal `true`: es gibt kein Ergebnis dieser
 * Operation, das „vielleicht" bedeutet. Entweder sie liefert dieses Objekt (dann gilt genau das,
 * was drinsteht), oder sie WIRFT (dann ist nichts geschrieben — der Rollback unten sorgt dafür).
 */
export interface DocumentAppendCommit {
  committed: true;
  operationId: string;
  /** War das die Wiederholung eines bereits abgeschlossenen Vorgangs? Ehrlich ausgewiesen. */
  replayed: boolean;
  /** Die Inhaltsversion, die jetzt gilt. */
  koVersion: number;
  /** Der Anker am Objekt. */
  attachmentId: string;
  /** Die angelegten Belegstellen — vollständig, oder die Operation hätte geworfen. */
  sourceIds: string[];
  ko: KnowledgeObject;
}

// KW-STR / NFR-SEC-04: bodyHtml IMMER serverseitig sanitisieren; statement aus dem
// HTML ableiten, falls leer (statement bleibt führende Plaintext-Kurzfassung).
function cleanBody(bodyHtml: string | null | undefined): string | null {
  if (!bodyHtml || !bodyHtml.trim()) {
    return null;
  }
  return sanitizeHtml(bodyHtml);
}

/**
 * AUFTRAG-mega20 Block A: PII-FREIE Kurzbeschreibung eines Fehlers für Vermerk und Audit.
 *
 * Bewusst OHNE `message`: die Meldung eines Infrastrukturfehlers kann Verbindungsdaten,
 * Tabellennamen oder Nutzereingaben enthalten, und `needsRepair` landet im persistierten Objekt,
 * der Audit-Payload in einem Beleg, den auch Prüfer lesen. Der Fehlerklassenname (bei
 * Domänenfehlern zusätzlich der Code) reicht, um zu sagen, WAS gebrochen ist — mehr braucht der
 * Reparaturpfad nicht, und mehr darf hier nicht stehen (SCRUM-496, log-sanitize).
 */
function describeFailure(err: unknown): string {
  if (err instanceof KoError) {
    return `KoError:${err.code}`;
  }
  if (err instanceof Error) {
    return err.name;
  }
  return "unknown";
}

export class KoService {
  private readonly repo: KoRepo;
  private readonly audit: AuditService | undefined;
  private readonly versions: KoVersionRepo | undefined;
  private readonly evidence: EvidenceRepo | undefined;
  // G27: immer vorhanden (s. KoServiceDeps.searchProjections).
  private readonly searchProjections: KoSearchProjectionRepo;
  private readonly now: () => number;
  private readonly genId: () => string;
  private readonly defaultNeededValidations: (() => Promise<number | null | undefined>) | undefined;
  // SCRUM-523 P.3 (WP2): Purge-Aufräum-Hook. Spät bindbar (setPurgeCleanup), da die Composition-Root
  // conflicts/overlaps/Embedding-Cleanup erst NACH dem KoService erstellt (Reihenfolge in assembleServices).
  private onPurge: ((koId: string, actor: string) => Promise<void>) | undefined;
  // SCRUM-523 P.3 (WP-A2): s. Typ-Kommentar an WithTx oben.
  private readonly withTx: WithTx | undefined;
  // SCRUM-509 R2 / 507 R2: EIN per-KO Schreib-Lock serialisiert die zueinander wettlaufenden KO-
  // Mutationen (Vertraulichkeit setzen, Validierungsstatus setzen, Revision). So gibt es kein Inter-
  // leave zwischen Lesen und Schreiben (kein TOCTOU, kein Lost-Update, keine fälschlich gültige
  // Alt-Bewertung, wenn ein Revise nebenläufig zur Bewertung läuft).
  private readonly koWriteLocks = new Map<string, Promise<unknown>>();

  constructor(deps: KoServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.versions = deps.versions;
    this.evidence = deps.evidence;
    this.searchProjections =
      deps.searchProjections ?? new InMemoryKoSearchProjectionRepo(deps.repo);
    this.defaultNeededValidations = deps.defaultNeededValidations;
    this.onPurge = deps.onPurge;
    this.withTx = deps.withTx;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // SCRUM-523 P.3 (WP2): den Purge-Aufräum-Hook spät verdrahten (die App erstellt conflicts/overlaps/
  // Embedding-Cleanup erst nach dem KoService). Nur EIN Hook — er ist die zentrale Aufräum-Kaskade.
  setPurgeCleanup(hook: (koId: string, actor: string) => Promise<void>): void {
    this.onPurge = hook;
  }

  // SCRUM-509 R2 / 507 R2: serialisiert fn per-KO (Lesen+Schreiben ohne Interleave). Fehler eines
  // Vorgängers blockiert den nächsten nicht (catch); jeder Aufrufer sieht seinen eigenen Fehler.
  private async withKoLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.koWriteLocks.get(id) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(fn);
    this.koWriteLocks.set(id, run);
    try {
      return await run;
    } finally {
      if (this.koWriteLocks.get(id) === run) {
        this.koWriteLocks.delete(id);
      }
    }
  }

  // SCRUM-509 R3: EIN Read-Modify-Write-Pfad für KO-Mutationen. Per-KO serialisiert (withKoLock →
  // kein Interleave IM Prozess) UND optimistisch auf DB-Ebene (repo.update macht Compare-and-Set auf
  // rowVersion → ein veralteter fremder Write kann nichts überschreiben, auch prozessübergreifend).
  // `apply` bekommt das FRISCH gelesene KO und liefert das aktualisierte KO + Rückgabewert + optionalen
  // Audit-Schritt. #4: der Audit läuft ZUERST — schlägt er fehl, unterbleibt der Write (nie „wirksam,
  // aber unbelegt"); im Prozess ist der Write durch den Lock konfliktfrei, sodass kein verwaister Audit
  // entsteht. Ein (seltener) prozessübergreifender STALE_WRITE wird ehrlich geworfen, nicht geraten.
  private async mutateKo<T>(
    id: string,
    apply: (ko: KnowledgeObject) => {
      updated: KnowledgeObject;
      value: T;
      audit?: () => Promise<void>;
    },
  ): Promise<T> {
    return this.withKoLock(id, async () => {
      const ko = await this.require(id);
      const { updated, value, audit } = apply(ko);
      await audit?.();
      await this.repo.update(updated);
      return value;
    });
  }

  // SCRUM-507 R3: transaktionaler MEHRSCHRITT-Mutationspfad (persist + Snapshot + Audit + Status als EINE
  // Einheit). Anders als mutateKo (Single-Step, Audit-vor-Write) braucht die Revision einen Versions-
  // Snapshot NACH der Persistenz — schlägt danach ein Schritt (Snapshot/Audit) fehl, wird die KO-
  // Persistenz KOMPENSIEREND zurückgerollt und ein bereits geschriebener Snapshot entfernt: kein
  // Teilzustand, keine unauditierte Änderung (ben-ROT 507). Per-KO serialisiert (withKoLock) +
  // rowVersion-CAS (repo.update). Für den Single-Instance-/Journal-Betrieb ist das die vollständige
  // Transaktion; die Kompensation deckt die in 509 R3 als Folgearbeit markierte cross-Modul-TX ab.
  private async mutateKoTx<T>(
    id: string,
    build: (ko: KnowledgeObject) => {
      updated: KnowledgeObject;
      value: T;
      snapshot?: { author: string; note: string };
      audit?: () => Promise<void>;
    },
  ): Promise<T> {
    return this.withKoLock(id, async () => {
      const before = await this.require(id);
      const { updated, value, snapshot, audit } = build(before);
      // 1) KO persistieren (Compare-and-Set auf rowVersion).
      await this.repo.update(updated);
      let snapshotWritten = false;
      let projectionWritten = false;
      try {
        // 2) Nachgelagert: erst Snapshot, dann Audit. Ein Fehler in EINEM Schritt rollt ALLES zurück.
        // G27: die Suchprojektion der NEUEN Version entsteht in DIESER Klammer — sie ist damit
        // Teil desselben kontrollierten Schreibvorgangs wie der Versions-Snapshot. Scheitert sie,
        // scheitert die Revision und der KO-Stand wird zurückgerollt; es gibt keinen Augenblick,
        // in dem eine neue Inhaltsversion gilt und die Suche noch die alte Fassung kennt.
        if (snapshot) {
          await this.snapshot(updated, snapshot.author, snapshot.note);
          snapshotWritten = this.versions !== undefined;
          await this.persistSearchProjection(updated, (geschrieben) => {
            projectionWritten = geschrieben;
          });
        }
        await audit?.();
        return value;
      } catch (err) {
        // Kompensation (vollständiger Rollback): Snapshot entfernen (falls geschrieben) + KO auf den
        // Vorzustand zurücksetzen. Kompensationsfehler werden geschluckt — der Ursachen-Fehler wird
        // geworfen; der Zustand ist bestmöglich wiederhergestellt (kein „wirksam, aber unbelegt").
        if (snapshotWritten) {
          await this.versions?.remove(updated.id, updated.version).catch(() => undefined);
        }
        // G27: eine Projektion zu einer zurückgerollten Version wäre eine Karteileiche, die kein
        // Rebuild je anfasst (sie gehört zu keiner aktiven Version) — sie wird mitkompensiert.
        if (projectionWritten) {
          await this.searchProjections
            .remove(updated.id, updated.version, { ruecknahme: true })
            .catch(() => undefined);
        }
        await this.rollbackKo(before).catch(() => undefined);
        throw err;
      }
    });
  }

  // SCRUM-507 R3: setzt den KO-Inhalt auf `before` zurück. Der vorangegangene Persist hat rowVersion um
  // 1 erhöht; um den INHALT wiederherzustellen, wird mit der jetzt gültigen rowVersion (before+1)
  // geschrieben (CAS passt) → Inhalt = before. rowVersion ist nur ein Concurrency-Token (klettert),
  // die semantischen Felder (version/status/trust/…) sind vollständig auf den Vorzustand zurückgesetzt.
  private async rollbackKo(before: KnowledgeObject): Promise<void> {
    await this.repo.update({ ...before, rowVersion: (before.rowVersion ?? 0) + 1 });
  }

  // SCRUM-159: vollständigen, unveränderlichen Voll-Snapshot ablegen (JSON-Deep-Copy, damit
  // spätere Änderungen am Live-KO frühere Versionen nicht berühren). No-op ohne Versions-Repo.
  private async snapshot(ko: KnowledgeObject, author: string, note: string): Promise<void> {
    if (!this.versions) {
      return;
    }
    const at = new Date(this.now()).toISOString();
    await this.versions.append({
      koId: ko.id,
      version: ko.version,
      snapshot: JSON.parse(JSON.stringify(ko)) as KnowledgeObject,
      at,
      author,
      note,
    });
  }

  // ==============================================================================================
  // G27 — DIE SUCHPROJEKTION AM SCHREIBWEG
  // ==============================================================================================
  //
  // Eine Projektion entsteht GENAU DANN, wenn eine neue Inhaltsversion gilt — also an denselben
  // vier Stellen, an denen `snapshot()` läuft (Erstanlage, Erstanlage aus Dokumenten, Revision,
  // Revision durch Dokumentübernahme). DREI davon tragen eine Fehlerklammer MIT Kompensation
  // (`mutateKoTx`, `createWithDocumentsLocked`, `appendDocumentExtract`): scheitert dort ein
  // späterer Schritt, wird eine von DIESEM Vorgang geschriebene Zeile wieder entfernt. Der Auftrag
  // verlangt „neue KO-Version und Projektion im selben kontrollierten Schreibvorgang", und genau
  // diese Klammer IST der kontrollierte Schreibvorgang dieses Moduls (SCRUM-507 R3).
  //
  // ZWEI AUSNAHMEN, ausdrücklich benannt, damit dieser Kommentar nicht mehr behauptet als der Code
  // tut (G27, PLAN-BASIC-Befund D14):
  //   · `finishCreated` (Version 1 über `create`) hat KEINE Fehlerklammer. Der Ablauf bleibt dort
  //     bewusst untransaktional (WP-SHIP8-CLOSE-5); Auffang sind `ensureCreatedSideEffects` und
  //     `backfillSearchProjections`. Das ist offene, benannte Arbeit — kein Versehen.
  //   · In `appendDocumentExtract` steht der Aufruf AUSSERHALB der `if (revises)`-Bedingung und
  //     läuft deshalb auch ohne Snapshot. Ohne Inhaltsrevision bleibt die Version dieselbe; dann
  //     greift die Append-only-Regel und die bestehende Zeile bleibt unangetastet.
  //
  // Append-only: `insert` schreibt nur, wenn (koId, koVersion) noch frei ist. Eine bestehende
  // Projektion wird NIE überschrieben — auch nicht von einem späten Wiederholungsversuch.
  // Meldung: hat DIESER Aufruf geschrieben? NUR dann ist die Zeile kompensierbar — eine bereits
  // vorhandene, gültige Zeile gehört einem anderen Vorgang und darf von diesem nicht entfernt
  // werden.
  // S1/S2: der Schreibweg legt BEIDE Hälften des Suchdokuments an. Die Inhaltszeile append-only an
  // (koId, koVersion), die Metadatenzeile idempotent an `koId`. Die Metadatenprojektion steht
  // bewusst AUSSERHALB der Append-only-Regel: sie ist versionslos, und ein `revise`, das nebenbei
  // die Kategorie ändert, muss sie mitziehen — sonst bliebe der alte Wert suchbar.
  //
  // WARUM GEMELDET UND NICHT ZURÜCKGEGEBEN WIRD (G27 Welle 1, Korrektur der Kopfprüfung). Zwischen
  // den beiden Hälften liegt eine Fehlerstelle: gelingt die Inhaltszeile und scheitert der
  // Metadaten-Write, erreicht ein RÜCKGABEWERT den Aufrufer nie — die Zuweisung
  // `projectionWritten = await …` wird nicht mehr ausgeführt und die Variable bliebe auf `false`
  // stehen. Die Rücknahmeklammer des Aufrufers hielte die soeben geschriebene Zeile daraufhin für
  // eine fremde und ließe sie liegen: eine Karteileiche an einer zurückgerollten Version, die kein
  // Rebuild je anfasst und über die eine spätere, erfolgreiche Wiederholung unter der
  // Append-only-Regel stolpern würde. `meldeGeschrieben` läuft deshalb SOFORT nach dem Insert und
  // vor dem Metadaten-Write — der Aufrufer weiß es dann auch im Fehlerfall.
  //
  // Die Kompensation selbst bleibt bewusst beim AUFRUFER und wandert nicht hier herein: nur er
  // kennt den ganzen Vorgang, und nur dort hängt die ehrliche Meldung eines übrig gebliebenen
  // Restes (`rollbackCreatedKo`) an derselben Entscheidung. Wer keine Klammer hat, meldet auch
  // nicht — s. die benannte Ausnahme `finishCreated`: dort BLEIBT das Wissensobjekt im Bestand,
  // seine Inhaltszeile ist also keine Karteileiche, und zuständig ist der idempotente Nachzug.
  private async persistSearchProjection(
    ko: KnowledgeObject,
    meldeGeschrieben?: (geschrieben: boolean) => void,
  ): Promise<void> {
    const at = new Date(this.now()).toISOString();
    const geschrieben = await this.searchProjections.insert(buildSearchProjection(ko, at));
    meldeGeschrieben?.(geschrieben);
    await this.projectMetadata(ko, at);
  }

  /**
   * Die MUTABLE METADATA PROJECTION eines Objekts auf den aktuellen Stand bringen (S2).
   *
   * Die Idempotenz und die Monotonie der `metadata_revision` liegen im Speicher, nicht hier
   * (metadata-projection-repo.ts): derselbe fachliche Stand ein zweites Mal geschrieben lässt die
   * Revision stehen. Diese Methode ist deshalb überall unbedenklich aufrufbar — im Schreibweg, im
   * Backfill und im Nachzug — ohne dass ein Zähler versehentlich zweimal klettert.
   */
  private async projectMetadata(
    ko: KnowledgeObject,
    at: string,
  ): Promise<KoMetadataProjectionResult> {
    const { categoryText, tagText } = metadataTextsOf(ko);
    return this.searchProjections.metadata.upsert({ koId: ko.id, categoryText, tagText, at });
  }

  /**
   * Die revisionsgebundene Klassifizierungsreferenz für eine NEU ABGELEITETE Zeile
   * (Rebuild/Fassungsnachführung) — Detailentscheidungen B und I, in genau dieser Reihenfolge:
   *
   *   1 Es gibt bereits eine Zeile der geltenden Fassung mit Snapshot ⇒ SIE BLEIBT. Ein Rebuild
   *     darf historische Content-Projections nicht still überschreiben, und ein später geänderter
   *     Vertraulichkeitswert darf die Geschichte nicht umschreiben.
   *   2 Es gibt den unveränderlichen `KoVersionSnapshot` dieser Version ⇒ daraus lesen (`verified`).
   *   3 Sonst ⇒ bestverfügbare Rekonstruktion aus dem heutigen Objektstand, ausdrücklich als
   *     `reconstructed_from_current_ko` / `historical_confidence = unknown` gekennzeichnet.
   *
   * Fall 3 BLOCKIERT DEN REBUILD NICHT (Abschnitt I, No-Go 4): alle übrigen Projektionsdaten sind
   * deterministisch rekonstruierbar, und das Live-Gate hängt ohnehin ausschließlich am aktuellen
   * KO-/Policy-Zustand — nicht an dieser Zeile.
   */
  private async classificationForRebuild(
    ko: KnowledgeObject,
    alt: KoSearchProjection | undefined,
  ): Promise<ClassificationSnapshot> {
    if (alt && alt.projectionVersion === SEARCH_PROJECTION_VERSION) {
      return alt.classificationSnapshot;
    }
    const snapshot = (await this.versions?.listByKo(ko.id))?.find((s) => s.version === ko.version);
    return snapshot ? classificationFromVersionSnapshot(snapshot) : reconstructedClassification(ko);
  }

  /**
   * IDEMPOTENTER Einzel-Backfill: stellt sicher, dass die AKTIVE Version eines Objekts eine
   * Projektion hat. Für Altbestand aus der Zeit vor G27 und für Objekte, die an der Persistenz
   * vorbei entstanden sind (Journal-Replay, direkter Repo-Insert in Tests).
   *
   * Liefert die Projektion — oder `undefined`, wenn es das Objekt nicht (mehr) gibt. Der Aufrufer
   * bekommt damit eine ehrliche Antwort statt einer stillen Leermenge.
   */
  async ensureSearchProjection(id: string): Promise<KoSearchProjection | undefined> {
    return (await this.ensureSearchArtifacts(id)).projection;
  }

  /**
   * ALTBESTANDS-BACKFILL — sicher und idempotent, in gedeckelten Schwüngen.
   *
   * Es gibt bewusst KEINEN Start-Hook, der beim Hochfahren den ganzen Bestand durchpflügt: das
   * wäre bei einem großen Bestand ein Deployment-Risiko ohne Not. Stattdessen arbeitet der
   * Backfill in Schwüngen (`limit`) — aufgerufen von den Suchwegen (kleiner Deckel je Anfrage,
   * konvergiert) und für den ausdrücklichen Lauf mit einem großen Deckel.
   *
   * IDEMPOTENT auf zwei Ebenen: die Arbeitsliste enthält nur Objekte, deren Suchdokument noch
   * nicht auf dem geltenden Stand ist, und die Schreibvorgänge selbst sind append-only (Inhalt)
   * bzw. änderungsbedingt (Metadaten). Ein zweiter Lauf schreibt deshalb nichts mehr und meldet
   * das ehrlich.
   *
   * `v2Migriert` zählt die Zeilen, die aus Projektionsfassung 1 auf Fassung 2 nachgeführt wurden —
   * die Fassungsmigration ist damit eine gemessene Zahl und kein stiller Nebeneffekt.
   */
  async backfillSearchProjections(opts: { limit?: number } = {}): Promise<{
    geprueft: number;
    geschrieben: number;
    v2Migriert: number;
    gescheitert: number;
  }> {
    const limit = Math.max(0, Math.floor(opts.limit ?? 500));
    const offen = await this.searchProjections.missingActive(limit);
    let geschrieben = 0;
    let v2Migriert = 0;
    let gescheitert = 0;
    for (const id of offen) {
      try {
        const ergebnis = await this.ensureSearchArtifacts(id);
        if (ergebnis.projection) {
          geschrieben += 1;
        }
        if (ergebnis.v2Migriert) {
          v2Migriert += 1;
        }
      } catch (error) {
        // NEVER BLOCK, exakt wie der Fußnoten-Backfill: ein Objekt, dessen Vollladung scheitert,
        // bleibt in DIESER Anfrage ohne Projektion und damit ehrlich unauffindbar — die Suche
        // selbst darf daran nie umfallen. PII-frei: nur Id und Fehlerklasse, nie Inhalte.
        gescheitert += 1;
        process.stderr.write(
          `[KLARWERK] Suchprojektion-Backfill fehlgeschlagen (ko=${id}, fehler=${
            error instanceof Error ? error.name : "unknown"
          }).\n`,
        );
      }
    }
    return { geprueft: offen.length, geschrieben, v2Migriert, gescheitert };
  }

  /**
   * V1/V2-MISCHBESTAND, EINDEUTIG BENANNT (Detailentscheidung D).
   *
   * Fassung 2 ist semantisch inkompatibel zu Fassung 1 (andere Feldgrenze, eigenes `body_text`,
   * Kategorie/Schlagwörter ausgelagert). Ein Bestand, der beides führt, darf das nicht verschweigen:
   * diese Zahl sagt, wie viele Zeilen noch welcher Fassung angehören. `offenV1` ist die Arbeit, die
   * der Backfill noch vor sich hat.
   */
  async searchProjectionVersions(): Promise<{
    geltendeFassung: number;
    zeilen: { projectionVersion: number; count: number }[];
    offenV1: number;
    gemischt: boolean;
  }> {
    const zeilen = await this.searchProjections.inventoryByProjectionVersion();
    const veraltet = zeilen.filter((z) => z.projectionVersion !== SEARCH_PROJECTION_VERSION);
    return {
      geltendeFassung: SEARCH_PROJECTION_VERSION,
      zeilen,
      offenV1: veraltet.reduce((summe, z) => summe + z.count, 0),
      gemischt: veraltet.length > 0 && zeilen.length > veraltet.length,
    };
  }

  /**
   * VOLLSTÄNDIGER REBUILD — die einzige Operation, die bestehende Projektionen ersetzen darf.
   *
   * Sie ist kein Widerspruch zur Append-only-Regel, sondern deren Gegenstück: die Regel verhindert
   * STILLES Überschreiben im Normalbetrieb; der Rebuild ist eine benannte, ausdrückliche Handlung.
   * Ihr Prüfstein steht in der Architekturentscheidung und ist hier messbar: bei unverändertem
   * Inhalt UND unveränderter `projection_version` ergibt der Rebuild denselben `content_hash` —
   * `unveraendert` zählt genau das.
   *
   * Der Rebuild berührt AUSSCHLIESSLICH die aktive Version jedes Objekts. Historische Zeilen
   * bleiben, wie sie sind: sie gehören zu Fassungen, deren Inhalt hier gar nicht mehr vorliegt
   * (das KO trägt nur den aktuellen Stand) — sie neu abzuleiten wäre eine Erfindung.
   *
   * DETERMINISTISCH heißt: derselbe Bestand ergibt dasselbe Ergebnis, auf jeder Maschine, in jeder
   * Reihenfolge, beliebig oft. Der einzige Wert von außen ist der Zeitstempel — und der geht weder
   * in den Hash noch (als vermeintlich historischer Zeitpunkt) in den Klassifizierungs-Snapshot ein:
   * `captured_at = now` ist ausdrücklich verboten (Abschnitt I). Die historische Einstufung stammt
   * entweder aus der bestehenden Zeile, aus dem unveränderlichen Versionsstand oder ist eine als
   * solche gekennzeichnete Rekonstruktion (s. `classificationForRebuild`).
   */
  async rebuildSearchProjections(): Promise<{
    geprueft: number;
    geschrieben: number;
    unveraendert: number;
    v2Migriert: number;
  }> {
    const at = new Date(this.now()).toISOString();
    let geprueft = 0;
    let geschrieben = 0;
    let unveraendert = 0;
    let v2Migriert = 0;
    for (const ko of await this.repo.list({})) {
      if (ko.deletedAt) {
        continue;
      }
      geprueft += 1;
      const alt = await this.searchProjections.find(ko.id, ko.version);
      if (alt && alt.projectionVersion !== SEARCH_PROJECTION_VERSION) {
        v2Migriert += 1;
      }
      const frisch = buildSearchProjection(ko, at, {
        classification: await this.classificationForRebuild(ko, alt),
      });
      if (alt?.contentHash === frisch.contentHash) {
        unveraendert += 1;
      }
      // `createdAt` der bestehenden Zeile bleibt erhalten — sie wurde neu abgeleitet, nicht neu
      // geboren; nur `updatedAt` klettert.
      await this.searchProjections.replace(
        alt ? { ...frisch, createdAt: alt.createdAt, updatedAt: at } : frisch,
      );
      geschrieben += 1;
      // Die zweite Hälfte des Suchdokuments gehört zum Rebuild: eine Inhaltszeile ohne
      // Metadatenzeile wäre nach Kategorie oder Schlagwort nicht auffindbar.
      await this.projectMetadata(ko, at);
    }
    return { geprueft, geschrieben, unveraendert, v2Migriert };
  }

  // ==============================================================================================
  // G27 R1 — DER ZUSTANDSAUTOMAT, DAS READINESS GATE UND DIE ATOMARE FREIGABE
  // ==============================================================================================
  //
  // WAS HIER NEU IST UND WARUM. Bis R1 gab es im gesamten Modul KEINE Aktivierungsgrenze: kein
  // Control-State, kein Gate, keinen Zustandsautomaten, keine Reconcile-Operation, keinen Rollback.
  // `findActive` filterte auf die aktive KO-Version — und ließ eine Zeile der Projektionsfassung 1
  // unverändert durch. Genau das hat BEN reproduziert. Diese Grenze wird hier erstmals eingeführt.
  //
  // DIE FOLGE (04 §2, 05 §1), und nichts daneben:
  //     neu:       UNINITIALIZED → V2_BUILDING → V2_READY → V2_ACTIVE
  //     Migration: V1_ACTIVE     → V2_BUILDING → V2_READY → V2_ACTIVE
  //     Fehler:                    V2_BUILDING → FAILED
  //     Rollback:  V2_ACTIVE → V1_ACTIVE (nur bei bewusst erhaltener VOLLSTÄNDIGER V1)
  //                V2_ACTIVE → FAILED    (sonst; danach vollständiger Rebuild)
  //
  // JEDER ÜBERGANG IST BEDINGT UND WIRD ABGELEHNT, WENN DER VORZUSTAND NICHT PASST — nie still
  // korrigiert. Ein „eigentlich war doch klar, was gemeint war" ist an dieser Stelle genau der
  // Mischbetrieb, den die Architektur verbietet.

  /** Der Control-State, read-only. DIE autoritative Auskunft über Fassung und Readiness (04 §1). */
  async searchProjectionControl(): Promise<ProjectionControlState> {
    return this.searchProjections.controlState();
  }

  /** Bestandsaufnahme der aktiven Zeilen — Grundlage des Gates, read-only. */
  async searchProjectionAudit(): Promise<ProjectionAudit> {
    return this.searchProjections.activeProjectionAudit();
  }

  // Ein Übergang, der nicht greift, ist ein Fehler und kein Hinweis: der Aufrufer hat einen
  // Vorzustand angenommen, den die Instanz nicht (mehr) hat.
  private async wechsle(
    erwartet: ProjectionState,
    naechster: ProjectionControlState,
  ): Promise<ProjectionControlState> {
    const geschrieben = await this.searchProjections.compareAndSetControlState(erwartet, naechster);
    if (!geschrieben) {
      const ist = await this.searchProjections.controlState();
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `Zustandswechsel abgelehnt: erwartet ${erwartet}, vorgefunden ${ist.projectionState}.`,
      );
    }
    return naechster;
  }

  /**
   * DIE AUSDRÜCKLICHE ERKLÄRUNG „diese Instanz steht im V1-Betrieb" — der Einstieg des
   * Migrationspfads (04 §2) und zugleich die Bedingung, unter der ein späterer Rollback nach
   * `V1_ACTIVE` überhaupt zulässig ist („nur solange V1 bewusst erhalten wurde").
   *
   * Sie wird NICHT abgeleitet: eine Instanz rutscht nicht deshalb nach `V1_ACTIVE`, weil V1-Zeilen
   * herumliegen (05 §1 verbietet genau das). Sie wird erklärt — und die Erklärung wird geprüft:
   * jede aktive Zeile muss tatsächlich Fassung 1 sein und der Bestand vollständig. Eine Erklärung,
   * die der Bestand nicht trägt, wäre eine Behauptung, kein Zustand.
   */
  async declareSearchProjectionV1Active(): Promise<ProjectionControlState> {
    const control = await this.searchProjections.controlState();
    // (a) NUR aus dem Anfangszustand. `FAILED` ist kein Legacy-Zustand, sondern ein
    // abgebrochener V2-Zyklus; `V2_*` erst recht nicht. Damit ist „nach begonnenem oder aktiviertem
    // V2 ist die Rückkehr nach V1_ACTIVE verboten" (09 §4) nicht mehr eine Frage des Bestands,
    // sondern des Zustands — und BENs ROT-6-Abkürzung „nimm einfach den vorgefundenen Zustand als
    // CAS-Erwartung" gibt es nicht mehr.
    if (control.projectionState !== "UNINITIALIZED") {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `V1_ACTIVE ist aus ${control.projectionState} nicht zulässig.`,
      );
    }
    // (b) NIE nach einem V2-Zyklus. Die Generation ist der einzige Beleg, der einen einmal
    // begonnenen Bau überlebt — auch dann, wenn der Bestand hinterher zufällig wieder wie V1
    // aussieht.
    if (control.buildGeneration !== 0 || control.activeGeneration !== null) {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `V1_ACTIVE ist nach einem V2-Zyklus nicht zulässig (Generation ${control.buildGeneration}).`,
      );
    }
    const audit = await this.searchProjections.activeProjectionAudit();
    // (c) EIN ECHTER BESTAND. Genau BENs ROT-6: `every([])` ist wahr, und deshalb konnte eine
    // fabrikneue, leere Instanz sich zur Legacy-Instanz erklären. Eine Legacy-Instanz IST aber
    // definiert durch das, was sie mitbringt — ohne Bestand gibt es nichts zu bestätigen, und der
    // vorgeschriebene Weg einer neuen Instanz ist `UNINITIALIZED → V2_BUILDING → …` (05 §1).
    if (audit.kos === 0) {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        "V1_ACTIVE ist nicht erklärbar: die Instanz führt keinen Bestand (leere Neuinstanz).",
      );
    }
    if (!this.istVollstaendigInFassung(audit, 1)) {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        "V1_ACTIVE ist nicht erklärbar: der Bestand ist nicht vollständig in Fassung 1.",
      );
    }
    return this.wechsle("UNINITIALIZED", {
      ...UNINITIALIZED_CONTROL_STATE,
      activeProjectionVersion: 1,
      targetProjectionVersion: 1,
      projectionState: "V1_ACTIVE",
    });
  }

  // „Vollständig in Fassung N": jedes nicht gelöschte Objekt hat beide Hälften, und ALLE aktiven
  // Zeilen tragen dieselbe Fassung — UND es gibt überhaupt Zeilen. Der leere Bestand erfüllte das
  // früher trivial (`every([])`); seit 09 §4 ist das ausdrücklich kein Beleg mehr.
  private istVollstaendigInFassung(audit: ProjectionAudit, fassung: number): boolean {
    if (audit.kos !== audit.mitInhalt || audit.kos !== audit.mitMetadaten) {
      return false;
    }
    return (
      audit.aktiveFassungen.length > 0 &&
      audit.aktiveFassungen.every((f) => f.projectionVersion === fassung)
    );
  }

  /**
   * Beginn des Fassungswechsels: `UNINITIALIZED` | `V1_ACTIVE` | `FAILED` → `V2_BUILDING`.
   *
   * AB HIER BEANTWORTET DIE INSTANZ KEINE SUCHE MEHR (`activeProjectionVersion = null`). Das ist
   * gewollt und ausdrücklich entschieden: „Im Zweifel gilt: kurzzeitig keine Suche ist besser als
   * inkonsistente Suche" (03 §3). Ein Bau, der nebenher weiter V1 ausliefert, wäre der verbotene
   * Mischbetrieb.
   *
   * Die Vorbedingungen der Freigabe werden zurückgesetzt: ein neuer Bau muss sie neu verdienen —
   * ein Rebuild von gestern trägt keine Freigabe von heute.
   */
  async beginSearchProjectionBuild(): Promise<ProjectionControlState> {
    const control = await this.searchProjections.controlState();
    const erlaubt: ProjectionState[] = ["UNINITIALIZED", "V1_ACTIVE", "FAILED"];
    if (!erlaubt.includes(control.projectionState)) {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `V2_BUILDING ist aus ${control.projectionState} nicht zulässig.`,
      );
    }
    // DIE NEUE GENERATION (09 §2). Sie ist streng monoton und wird NIE wiederverwendet: genau
    // dadurch ist ein Marker eines abgebrochenen Zyklus für den nächsten wertlos, und genau
    // dadurch kann eine Freigabe erkennen, dass sie einen fremden Bau prüfen würde.
    return this.wechsle(control.projectionState, {
      ...UNINITIALIZED_CONTROL_STATE,
      projectionState: "V2_BUILDING",
      targetProjectionVersion: SEARCH_PROJECTION_VERSION,
      buildStartedAt: new Date(this.now()).toISOString(),
      lastFailure: control.lastFailure,
      buildGeneration: control.buildGeneration + 1,
    });
  }

  /**
   * Der ausdrückliche Fehlerpfad nach `FAILED` (04 §2, erweitert um 09 §2: `V2_BUILDING`,
   * `V2_READY` und `V2_ACTIVE` führen alle über DIESELBE Tür).
   *
   * Die Generation bleibt stehen (sie ist Geschichte, nicht Zustand), Freigabe und Marker fallen:
   * ab hier ist nichts mehr aktiv, und der Weg zurück führt ausschließlich über einen neuen,
   * vollständigen Zyklus.
   */
  async failSearchProjectionBuild(grund: string): Promise<ProjectionControlState> {
    const control = await this.searchProjections.controlState();
    const erlaubt: ProjectionState[] = ["V2_BUILDING", "V2_READY", "V2_ACTIVE"];
    if (!erlaubt.includes(control.projectionState)) {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `FAILED ist aus ${control.projectionState} nicht zulässig.`,
      );
    }
    return this.wechsle(control.projectionState, {
      ...control,
      projectionState: "FAILED",
      activeProjectionVersion: null,
      activeGeneration: null,
      integrityMarker: null,
      lastSuccessfulRebuild: null,
      lastReconcile: null,
      lastFailure: `${new Date(this.now()).toISOString()} ${grund}`,
    });
  }

  /**
   * RECONCILE — die UNGEDECKELTE Gegenprobe „ist der Bestand vollständig nachgezogen?".
   *
   * Der Unterschied zum gedeckelten Backfill ist nicht die Technik, sondern die Zusage: der Backfill
   * ist Optimierung in Schwüngen und darf jederzeit unfertig aufhören; Reconcile arbeitet die
   * Arbeitsliste ab, bis sie leer ist oder kein Fortschritt mehr entsteht, und MELDET die
   * verbleibende Differenz. Bei Differenz ≠ 0 gibt es keine Freigabe und `last_reconcile` bleibt
   * ungesetzt (04 §3.2).
   *
   * HIER — und nur hier — hängt seit 05 §4 auch der FUSSNOTEN-NACHZUG: `ensureSearchArtifacts` ist
   * die eine Vollladung, aus der captionTexts, Inhalts- und Metadatenprojektion gemeinsam
   * entstehen. Sein Auslöser ist damit ausdrücklich die Rebuild-/Reconcile-Aufrufkette und nicht
   * mehr eine Suchanfrage.
   */
  async reconcileSearchProjections(): Promise<{
    offenVorher: number;
    nachgezogen: number;
    differenz: number;
  }> {
    const offenVorher = (await this.searchProjections.missingActive(RECONCILE_SCHWUNG)).length;
    let nachgezogen = 0;
    for (;;) {
      const bilanz = await this.backfillSearchProjections({ limit: RECONCILE_SCHWUNG });
      nachgezogen += bilanz.geschrieben;
      // Nichts mehr offen — oder nichts mehr zu bewegen (ein Objekt, dessen Vollladung dauerhaft
      // scheitert, darf hier nicht zur Endlosschleife werden; es bleibt ehrlich in der Differenz).
      if (bilanz.geprueft === 0 || bilanz.geschrieben + bilanz.v2Migriert === 0) {
        break;
      }
    }
    const differenz = (await this.searchProjections.missingActive(RECONCILE_SCHWUNG)).length;
    if (differenz === 0) {
      const control = await this.searchProjections.controlState();
      if (control.projectionState === "V2_BUILDING") {
        await this.wechsle("V2_BUILDING", {
          ...control,
          lastReconcile: new Date(this.now()).toISOString(),
        });
      }
    }
    return { offenVorher, nachgezogen, differenz };
  }

  /**
   * DIE FÜNF PRÜFUNGEN VOR DER FREIGABE (04 §3, abschließend präzisiert in 05 §3).
   *
   * Rein lesend — diese Methode aktiviert nichts und ändert nichts. Sie beantwortet genau eine
   * Frage: dürfte jetzt freigegeben werden?
   *
   *   1 vollständiger Rebuild   — gelaufen UND jünger als der Beginn dieses Baus,
   *   2 Reconcile abgeschlossen — dito, und ohne verbleibende Differenz,
   *   3 Konsistenzprüfung      — jedes lebende Objekt hat BEIDE Hälften des Suchdokuments,
   *   4 Projektionsversions-   — alle AKTIVEN Zeilen tragen die Zielfassung, keine Mischversionen,
   *     prüfung
   *   5 Integritätsprüfung     — eindeutige aktive Fassung, konsistente Zeiger, vollständige
   *                              Projektion, keine Mischversionen, keine fehlenden Pflichtfelder,
   *                              Hash-Konsistenz und gültiger Lifecycle.
   *
   * Die frühere „Aktivitätsprüfung" ist KEIN sechster Punkt; sie ist in 5 aufgegangen (05 §3).
   */
  async searchProjectionReadiness(): Promise<SearchProjectionReadiness> {
    const control = await this.searchProjections.controlState();
    const audit = await this.searchProjections.activeProjectionAudit();
    const ziel = control.targetProjectionVersion;
    const befunde: string[] = [];

    const juengerAlsBau = (wert: string | null): boolean =>
      wert !== null && (control.buildStartedAt === null || wert >= control.buildStartedAt);

    const rebuild = juengerAlsBau(control.lastSuccessfulRebuild);
    if (!rebuild) {
      befunde.push("kein vollständiger Rebuild für diesen Bau");
    }
    const reconcile = juengerAlsBau(control.lastReconcile);
    if (!reconcile) {
      befunde.push("kein abgeschlossener Reconcile für diesen Bau");
    }
    const konsistenz = audit.kos === audit.mitInhalt && audit.kos === audit.mitMetadaten;
    if (!konsistenz) {
      befunde.push(
        `unvollständige Projektion (${audit.mitInhalt}/${audit.kos} Inhalt, ${audit.mitMetadaten}/${audit.kos} Metadaten)`,
      );
    }
    const eindeutig = audit.aktiveFassungen.length <= 1;
    const projektionsversion =
      ziel !== null &&
      eindeutig &&
      audit.aktiveFassungen.every((f) => f.projectionVersion === ziel);
    if (!projektionsversion) {
      befunde.push(
        `aktive Zeilen nicht durchgängig in Fassung ${ziel ?? "?"} (${audit.aktiveFassungen
          .map((f) => `${f.projectionVersion}:${f.count}`)
          .join(",")})`,
      );
    }
    const lifecycle = controlStateLifecycleGueltig(control);
    if (!lifecycle) {
      befunde.push("Control-State-Zeiger passen nicht zum Zustand");
    }
    const pflichtfelder = audit.pflichtfelderFehlen === 0;
    if (!pflichtfelder) {
      befunde.push(`${audit.pflichtfelderFehlen} aktive Zeilen ohne Pflichtfelder`);
    }
    const hash = konsistenz && projektionsversion ? await this.hashIntegritaet() : false;
    if (!hash) {
      befunde.push("Hash-Konsistenz der aktiven Zeilen nicht belegt");
    }
    // 09 §2.4 — DIE GENERATIONSBINDUNG, als Teil der Integritätsprüfung und nicht als sechster
    // Punkt. Sie beantwortet die eine Frage, die alle anderen Prüfungen offen lassen: gehören die
    // Zeilen, die ich gerade für vollständig und konsistent befunden habe, überhaupt zu DIESEM Bau?
    // Ohne sie wäre „alle aktiven Zeilen sind V2" auch dann wahr, wenn die Hälfte davon aus einem
    // abgebrochenen früheren Zyklus stammt oder nebenher von jemand anderem geschrieben wurde.
    const generation =
      projektionsversion && ziel === SEARCH_PROJECTION_VERSION
        ? await this.searchProjections.activeRowsInGeneration(control.buildGeneration)
        : false;
    if (!generation) {
      befunde.push(`aktive Zeilen nicht durchgängig in Generation ${control.buildGeneration}`);
    }
    const integritaet =
      eindeutig &&
      lifecycle &&
      konsistenz &&
      projektionsversion &&
      pflichtfelder &&
      hash &&
      generation;
    const alle = rebuild && reconcile && konsistenz && projektionsversion && integritaet;
    return {
      rebuild,
      reconcile,
      konsistenz,
      projektionsversion,
      integritaet,
      alle,
      befunde,
    };
  }

  /**
   * Trägt jede aktive Zeile noch den Inhalt, aus dem sie abgeleitet wurde? Der Hash ist die
   * einzige Zusage, die das beantworten kann, ohne den ganzen Text zu vergleichen — und er ist
   * bewusst zeitfrei (der Zeitstempel geht nicht ein), sonst wäre jede Neuableitung ein Unterschied.
   */
  private async hashIntegritaet(): Promise<boolean> {
    for (const ko of await this.repo.list({})) {
      if (ko.deletedAt) {
        continue;
      }
      const alt = await this.searchProjections.find(ko.id, ko.version);
      if (!alt) {
        return false;
      }
      const frisch = buildSearchProjection(ko, alt.updatedAt, {
        classification: alt.classificationSnapshot,
      });
      if (frisch.contentHash !== alt.contentHash) {
        return false;
      }
    }
    return true;
  }

  /**
   * `V2_BUILDING → V2_READY`, aber NUR wenn alle fünf Prüfungen bestehen. Bestehen sie nicht,
   * bleibt die Instanz im Bau (wiederholbar) — sie rutscht weder in `FAILED` noch gar in
   * `V2_READY`. Der Befund reist mit, damit „warum nicht?" beantwortbar bleibt.
   */
  async finishSearchProjectionBuild(): Promise<{
    control: ProjectionControlState;
    readiness: SearchProjectionReadiness;
  }> {
    const readiness = await this.searchProjectionReadiness();
    const control = await this.searchProjections.controlState();
    if (control.projectionState !== "V2_BUILDING") {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `V2_READY ist aus ${control.projectionState} nicht zulässig.`,
      );
    }
    if (!readiness.alle) {
      return { control, readiness };
    }
    const naechster = await this.wechsle("V2_BUILDING", {
      ...control,
      projectionState: "V2_READY",
      buildFinishedAt: new Date(this.now()).toISOString(),
    });
    return { control: naechster, readiness };
  }

  /**
   * DIE FREIGABE — `V2_READY → V2_ACTIVE`, genau EINE atomare Operation (04 §3).
   *
   * Die fünf Prüfungen laufen unmittelbar davor NOCH EINMAL: zwischen `finishSearchProjectionBuild`
   * und hier kann Zeit vergangen sein, und eine Freigabe auf einen veralteten Befund wäre keine
   * Prüfung, sondern eine Erinnerung. Erst danach schreibt EIN bedingter Zustandswechsel
   * `active_projection_version = 2`. Es gibt keinen Zwischenzustand, in dem zwei Fassungen liefern
   * könnten — und ein zweiter, nebenläufiger Versuch scheitert an der Bedingung.
   */
  async releaseSearchProjectionVersion(
    erwarteteGeneration?: number,
  ): Promise<ProjectionControlState> {
    return this.searchProjections.withExclusiveControlLock(async (sitzung) => {
      const control = sitzung.control;
      if (control.projectionState !== "V2_READY") {
        throw new KoError(
          "SEARCH_PROJECTION_NOT_READY",
          `Freigabe ist aus ${control.projectionState} nicht zulässig.`,
        );
      }
      // FREMDGENERATION (09 §5). Wer eine bestimmte Generation geprüft hat, gibt auch nur DIESE
      // frei. Ist inzwischen ein neuer Bau begonnen worden, ist der Befund von vorhin eine
      // Erinnerung und keine Prüfung — die Freigabe wird verweigert, nicht stillschweigend auf den
      // neuen Bau umgedeutet.
      if (erwarteteGeneration !== undefined && erwarteteGeneration !== control.buildGeneration) {
        throw new KoError(
          "SEARCH_PROJECTION_NOT_READY",
          `Freigabe abgelehnt: geprüfte Generation ${erwarteteGeneration}, vorgefunden ${control.buildGeneration}.`,
        );
      }
      // DIE FÜNF PRÜFUNGEN LAUFEN HIER, UNTER DER SPERRE — nicht davor. Das ist der Unterschied
      // zwischen „geprüft und dann freigegeben" und „geprüft UND freigegeben": solange dieser
      // Rahmen steht, kann keine Projektionsmutation committen (09 §2.1-§2.4). Genau das Fenster,
      // in dem BEN eine Zeile zwischen bestandener Readiness und CAS auf Fassung 1 verändert hat,
      // gibt es nicht mehr.
      const readiness = await this.searchProjectionReadiness();
      if (!readiness.alle) {
        throw new KoError(
          "SEARCH_PROJECTION_NOT_READY",
          `Freigabe abgelehnt: ${readiness.befunde.join("; ")}`,
        );
      }
      const at = new Date(this.now()).toISOString();
      const naechster: ProjectionControlState = {
        ...control,
        projectionState: "V2_ACTIVE",
        activeProjectionVersion: SEARCH_PROJECTION_VERSION,
        // Freigegeben wird GENAU die geprüfte Generation — und der Marker sagt für genau sie aus,
        // dass sie geprüft ist. Beides in demselben Schreibvorgang wie der Zustandswechsel.
        activeGeneration: control.buildGeneration,
        integrityMarker: integritaetsMarkerFuer(control.buildGeneration),
        activatedAt: at,
        buildFinishedAt: control.buildFinishedAt ?? at,
      };
      await sitzung.schreibe(naechster);
      return naechster;
    });
  }

  /**
   * DIE GANZE FOLGE als eine benannte Handlung: Bau beginnen, vollständig neu ableiten,
   * abgleichen, prüfen, freigeben. Jeder Schritt bleibt einzeln aufrufbar und beobachtbar — das
   * hier ist die Bequemlichkeit für Betrieb und Gegenprobe, nicht eine zweite Semantik.
   *
   * Sie wird NIE von einem Suchweg aufgerufen. Eine Suche, die den Zustandsautomaten mitfährt,
   * wäre der synchrone Nachzug vor jeder Suche, den 03 §4 ausdrücklich abgelehnt hat.
   */
  async activateSearchProjectionV2(): Promise<{
    control: ProjectionControlState;
    readiness: SearchProjectionReadiness;
  }> {
    await this.beginSearchProjectionBuild();
    return this.continueSearchProjectionBuild();
  }

  /**
   * DER IDEMPOTENTE WIEDERANLAUF EINES LAUFENDEN BAUS (06 §2, `V2_BUILDING`).
   *
   * Er ist der Schwanz von `activateSearchProjectionV2` OHNE den Beginn — und genau das ist die
   * Zusage „kontrolliert idempotent fortsetzen": die Generation des abgebrochenen Baus bleibt
   * stehen, die Zeilen dieses Baus bleiben gültig, und was fehlt, wird nachgezogen. Ein Prozess,
   * der beim Neustart einfach `beginSearchProjectionBuild()` riefe, würde stattdessen eine neue
   * Generation aufmachen und den halbfertigen Bestand des Vorgängers entwerten — bei einem
   * Neustart in einer Absturzschleife käme die Instanz nie an.
   *
   * Der Zustand wird NICHT aus Zeilen abgeleitet (06 §2, letzter Satz): fortgesetzt wird nur, was
   * der persistierte Control-State als laufenden Bau ausweist.
   */
  async continueSearchProjectionBuild(): Promise<{
    control: ProjectionControlState;
    readiness: SearchProjectionReadiness;
  }> {
    const laufend = await this.searchProjections.controlState();
    if (laufend.projectionState !== "V2_BUILDING") {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `Fortsetzung ist aus ${laufend.projectionState} nicht zulässig.`,
      );
    }
    const generation = laufend.buildGeneration;
    const at = new Date(this.now()).toISOString();
    await this.rebuildSearchProjections();
    const nachRebuild = await this.searchProjections.controlState();
    await this.wechsle("V2_BUILDING", { ...nachRebuild, lastSuccessfulRebuild: at });
    await this.reconcileSearchProjections();
    const { readiness } = await this.finishSearchProjectionBuild();
    if (!readiness.alle) {
      return { control: await this.searchProjections.controlState(), readiness };
    }
    // Freigegeben wird ausdrücklich die Generation, die dieser Lauf gebaut hat.
    return { control: await this.releaseSearchProjectionVersion(generation), readiness };
  }

  /**
   * ROLLBACK — und zwar EINDEUTIG: das Ergebnis ist IMMER `FAILED`
   * (KW-ARCH-G27-ROLLBACK-PROJEKTIONSSPEICHERUNG-08 §1).
   *
   * WAS SICH GEÄNDERT HAT UND WARUM. Bis hierher konnte diese Methode auch nach `V1_ACTIVE`
   * zurückführen, „solange V1 bewusst erhalten wurde". BEN hat gezeigt, dass dieser Zweig im
   * Produktbetrieb unerreichbar ist: der Primärschlüssel ist `(ko_id, ko_version)`, und der
   * V2-Rebuild ERSETZT die V1-Zeile derselben aktiven KO-Version. Grün war er nur, weil ein Test
   * die V1-Zeilen vorher über einen direkten Repository-Zugriff zurückgeschrieben hat — ein
   * Backdoor, kein Produktweg. Entscheidung 08 hat daraufhin ausdrücklich entschieden: für G27 R1
   * gibt es KEINEN produktiven Rollback auf V1. Ein Zweig, den kein Produktweg erreichen kann, ist
   * keine Rückfalloption, sondern eine Zusage, die im Ernstfall nicht trägt.
   *
   * Der eine verbindliche Recovery-Pfad lautet deshalb:
   *
   *     V2_ACTIVE → FAILED → V2_BUILDING → V2_READY → V2_ACTIVE
   *
   * Bis der vollständige Rebuild durch ist, bleibt die Suche fail-closed — kurzzeitig keine Suche
   * ist besser als eine Fassung, die es nicht mehr vollständig gibt (03 §3).
   */
  async rollbackSearchProjectionVersion(grund: string): Promise<ProjectionControlState> {
    const control = await this.searchProjections.controlState();
    if (control.projectionState !== "V2_ACTIVE") {
      throw new KoError(
        "SEARCH_PROJECTION_NOT_READY",
        `Rollback ist aus ${control.projectionState} nicht zulässig.`,
      );
    }
    return this.failSearchProjectionBuild(grund);
  }

  /**
   * DIE VOLLSTÄNDIGE V2-RECOVERY als eine benannte Handlung (Entscheidung 08 §1) — der einzige Weg
   * aus `FAILED` und aus einem beschädigten `V2_ACTIVE` zurück in den Betrieb.
   *
   * Aus `V2_ACTIVE` führt sie ZUERST nach `FAILED`: eine Recovery, die den aktiven Zustand
   * überspränge, würde den beschädigten Bestand still weiterbedienen, während sie ihn neu baut.
   */
  async recoverSearchProjectionV2(grund: string): Promise<{
    control: ProjectionControlState;
    readiness: SearchProjectionReadiness;
  }> {
    const control = await this.searchProjections.controlState();
    if (control.projectionState === "V2_ACTIVE" || control.projectionState === "V2_READY") {
      await this.failSearchProjectionBuild(grund);
    }
    return this.activateSearchProjectionV2();
  }

  /** Read-only Einblick in die Projektion einer bestimmten (oder der aktiven) Version. */
  async searchProjectionOf(id: string, version?: number): Promise<KoSearchProjection | undefined> {
    const ko = await this.repo.findById(id);
    if (!ko) {
      return undefined;
    }
    return this.searchProjections.find(ko.id, version ?? ko.version);
  }

  /** Read-only: alle Projektionen eines Objekts (aufsteigend nach Version). */
  async searchProjectionsOf(id: string): Promise<KoSearchProjection[]> {
    return this.searchProjections.listByKo(id);
  }

  /** Read-only Einblick in die veränderliche Metadatenprojektion (S2). */
  async metadataProjectionOf(id: string): Promise<KoMetadataProjection | undefined> {
    return this.searchProjections.metadata.find(id);
  }

  /**
   * Read-only Einblick in DAS zusammengesetzte Suchdokument EINES Objekts.
   *
   * Bewusst KEIN zweiter Suchweg: hier wird nichts gesucht, gefiltert oder gerankt — es gibt nur
   * die eine Frage „was steht für dieses Objekt gerade im Suchdokument?" zurück, und zwar
   * ausschließlich aus den beiden Projektionen. Der einzige Sucheinstieg bleibt `findSearchHits`.
   */
  async effectiveSearchDocumentOf(
    id: string,
    version?: number,
  ): Promise<EffectiveSearchDocument | undefined> {
    const content = await this.searchProjectionOf(id, version);
    if (!content) {
      return undefined;
    }
    return composeEffectiveSearchDocument(content, await this.searchProjections.metadata.find(id));
  }

  /**
   * DER GEMEINSAME SUCHVERTRAG. Bibliothek (`LibraryService.search`) und Ask/Klara
   * (`AskService.ask` über `findCandidates`) laufen BEIDE hierdurch — es gibt keinen zweiten Weg
   * an den durchsuchbaren Text. Geliefert werden ausschließlich Treffer auf der Projektion der
   * AKTIVEN KO-Version; historische Fassungen sind in der Standardsuche unsichtbar.
   *
   * Diese Methode SCHREIBT NICHTS und stößt seit G27 R1 auch NICHTS mehr an: kein Backfill, kein
   * Fußnoten-Nachzug, keine Migration. Der Suchweg liest — mehr nicht (04 §5).
   *
   * SIE WIRFT, wenn keine Projektionsfassung freigegeben ist (04 §4). Das ist eine sichtbare
   * Verhaltensänderung und keine reine Reparatur: eine Instanz im Bau beantwortet keine Suche,
   * statt eine unvollständige Teilmenge zu liefern. Der Fehler ist rein intern; Routen, Statuskarte
   * und äußerer Treffervertrag bleiben unverändert.
   */
  async findSearchHits(query: KoSearchQuery): Promise<KoSearchHit[]> {
    return this.searchProjections.findActive(query);
  }

  // SCRUM-160: Evidence-Records append-only schreiben. No-op ohne Evidence-Repo;
  // bestehende KO-Flows bleiben dadurch rückwärtskompatibel.
  private async appendEvidence(record: Omit<EvidenceRecord, "id">): Promise<void> {
    if (!this.evidence) {
      return;
    }
    await this.evidence.append({ id: this.genId(), ...record });
  }

  /**
   * AUFTRAG-mega19 Block B — DIE GESTALT EINES NEUEN WISSENSOBJEKTS, an EINER Stelle.
   *
   * Herausgezogen aus `create`, weil es jetzt ZWEI Wege in die Erstanlage gibt: den allgemeinen
   * (`create`, ohne Anhänge und ohne Client-Quellen) und die Dokumentübernahme
   * (`createWithDocuments`, mit Anker und Belegstellen im SELBEN Insert). Zwei Kopien dieser
   * Feldliste wären zwei Gelegenheiten, sie auseinanderlaufen zu lassen — und die zweite hätte
   * niemand geprüft.
   *
   * `extras` trägt NUR, was die Dokumentübernahme zusätzlich mitbringt. Es gibt keinen Weg,
   * hierüber eine Regel zu umgehen: Anhänge und Quellen sind Daten, keine Entscheidungen, und der
   * Aufrufer hat beide bereits serverseitig hergestellt.
   */
  private async buildCreatedKo(
    input: CreateKoInput,
    extras?: {
      attachments?: KoAttachment[];
      sources?: KoSource[];
      // AUFTRAG-mega20 Block A: der Erzeugungs-Anker. Er steht bewusst in `extras` und NICHT in
      // `CreateKoInput` — sonst könnte ihn die öffentliche Schreibroute durchreichen, und ein
      // Client könnte sich mit einer erratenen Kennung an einen fremden Vorgang hängen. So kann
      // ihn nur setzen, wer diese Methode aufruft, und das ist genau `createWithDocuments`.
      createOperationId?: string;
      // AUFTRAG-mega21 Block A: der VORGANGS-DATENSATZ, aus demselben Grund hier und nicht in
      // `CreateKoInput`. Er entsteht mit dem Objekt, im SELBEN Insert — es gibt keinen Augenblick,
      // in dem der Schlüssel ohne seinen Eigentümer im Bestand steht.
      createOperation?: KoCreateOperation;
    },
  ): Promise<KnowledgeObject> {
    if (!KNOWLEDGE_TYPES.includes(input.type)) {
      throw new KoError("INVALID_TYPE", "Unbekannte Wissensart.");
    }
    // SCRUM-509 R2: eine EXPLIZIT gelieferte, aber ungültige Vertraulichkeitsstufe wird abgelehnt
    // (kein stilles Normalisieren auf „intern" = fail-open, konsistent mit setConfidentiality). Fehlt
    // die Stufe ganz, gilt der dokumentierte Standard „intern" (bewusster Optional-Feld-Default, keine
    // fail-open-Normalisierung eines ungültigen Werts).
    if (input.confidentiality !== undefined && !isValidConfidentiality(input.confidentiality)) {
      throw new KoError("INVALID_CONFIDENTIALITY", "Ungültige Vertraulichkeitsstufe.");
    }
    // SCRUM-395: ohne explizite Angabe gilt die Admin-Einstellung (Standard-Prüferanzahl),
    // ohne diese der feste Modul-Default. Explizite Angaben gewinnen immer.
    const needed =
      input.neededValidations ??
      (await this.defaultNeededValidations?.()) ??
      DEFAULT_NEEDED_VALIDATIONS;
    if (needed < 1 || needed > 5) {
      throw new KoError("INVALID_NEEDED", "Nötige Validierungen müssen zwischen 1 und 5 liegen.");
    }
    const at = new Date(this.now()).toISOString();
    const bodyHtml = cleanBody(input.bodyHtml);
    // statement bleibt führend; falls leer, aus dem HTML-Body ableiten.
    const statement =
      input.statement.trim() || (bodyHtml ? htmlToPlainText(bodyHtml) : input.statement);
    const ko: KnowledgeObject = {
      id: this.genId(),
      title: input.title,
      statement,
      ...(bodyHtml ? { bodyHtml } : {}),
      // WP-BILD-1g: abgeleitetes Suchfeld der Bild-Fußnoten IMMER an der Schreibgrenze setzen
      // (auch [] bei „keine Fußnoten" — nur Legacy-KOs von VOR dieser Regel haben kein Feld).
      captionTexts: searchCaptionTexts(bodyHtml),
      conditions: input.conditions ?? [],
      measures: input.measures ?? [],
      type: input.type,
      category: input.category,
      tags: input.tags ?? [],
      confidence: input.confidence ?? 0,
      trust: 0,
      status: "offen",
      version: 1,
      // WP-SAMMEL21-FIX (Fix 4): abweichender Wissensträger nur, wenn explizit gesetzt (Import).
      originalAuthor: input.originalAuthor?.trim() ? input.originalAuthor : input.author,
      author: input.author,
      neededValidations: needed,
      assignments: [],
      asset: input.asset ?? null,
      // SCRUM-415: nur speichern, wenn tatsächlich vertraulich — „intern"/ungültig bleibt weg,
      // Alt-Verhalten und bestehende Tests unberührt.
      ...(isConfidential(normalizeConfidentiality(input.confidentiality))
        ? { confidentiality: normalizeConfidentiality(input.confidentiality) }
        : {}),
      ...(input.demoSeed ? { demoSeed: true } : {}),
      // WP-SHIP8-CLOSE-3/4 (bens ROT-1): stabiler Kandidaten-Anker des Import-Accepts (DB-unique
      // erzwungen — der Insert eines zweiten KO desselben Kandidaten scheitert am Index/Guard).
      ...(input.importCandidateId ? { importCandidateId: input.importCandidateId } : {}),
      // AUFTRAG-mega20 Block A: DB-unique erzwungen (kos_create_operation_uq) — der Insert eines
      // zweiten KO desselben Erzeugungs-Vorgangs scheitert am Index/Guard und wird adoptiert.
      ...(extras?.createOperationId ? { createOperationId: extras.createOperationId } : {}),
      // AUFTRAG-mega21 Block A: Eigentümer, Inhaltsabdruck und Zustand — s. document-create.ts.
      ...(extras?.createOperation ? { createOperation: extras.createOperation } : {}),
      createdAt: at,
      history: [{ version: 1, at, author: input.author, note: "erstellt" }],
      comments: [],
      // mega19 Block B: die Ankerdokumente der Übernahme stehen von Anfang an im Objekt — kein
      // späteres `attach`, das scheitern könnte, während der Inhalt schon steht.
      attachments: extras?.attachments ?? [],
      // SCRUM-470: Herkunftsquellen (Import) übernehmen; ohne Eingabe wie bisher leer.
      // SCRUM-527 (WP2): jede übernommene Quell-URL durch die Allowlist (nur absolute http/https).
      sources: sanitizeSources([...(input.sources ?? []), ...(extras?.sources ?? [])]),
    };
    return ko;
  }

  // ============================================================================================
  // AUFTRAG-mega22 Block H — DERSELBE VORGANGSVERTRAG, EINE TÜR WEITER.
  // ============================================================================================
  //
  // `POST /api/drafts/:id/promote` hatte denselben Mangel, den mega21 Block B für den Dokumentweg
  // geschlossen hat: geht die ANTWORT verloren, ist der Entwurf bereits weg und das Wissensobjekt
  // steht — der Nutzer sieht aber 404 für einen GELUNGENEN Vorgang. Kein Duplikat, kein
  // Inhaltsverlust, nur eine Unwahrheit. Für einen manuellen Entwurfs-Promote, der zum VIP-2-
  // Rundgang gehört, ist das die falsche Auskunft.
  //
  // ES WIRD KEIN ZWEITER VERTRAG ERFUNDEN. `operation` trägt dieselben drei Angaben wie bei
  // `createWithDocuments` (Kennung, Eigentümer, Inhaltsabdruck), läuft über DENSELBEN Vorgangs-Lock,
  // DENSELBEN Nachschlag (`adoptCreatedKo` mit seinen drei Toren), DIESELBE Kollisions-Adoption und
  // liefert DIESELBEN Fehlercodes. Was hier NICHT übertragbar war, steht am Aufrufer
  // (capture-routes.ts) und ist dort einzeln benannt statt stillschweigend weggelassen.
  //
  // `operation` ist ein EIGENER Parameter und kein Feld in `CreateKoInput` — aus demselben Grund
  // wie bei `buildCreatedKo`: sonst könnte die öffentliche Schreibroute `POST /api/kos` ihn aus dem
  // Body durchreichen, und ein Client könnte sich an einen fremden Vorgang hängen. Ohne `operation`
  // ist `create` unverändert das, was es war.
  //
  // FR-KO-01: vollständiges Datenmodell; FR-KO-02: Wissensart gesetzt.
  async create(
    input: CreateKoInput,
    operation?: { id: string; actor: string; fingerprint: string },
  ): Promise<KnowledgeObject> {
    if (operation) {
      const createOperationId = normalizeCreateOperationId(operation.id);
      const actor = operation.actor.trim();
      if (!actor) {
        throw new KoError(
          "INVALID_OPERATION_ID",
          "Vorgang ohne Eigentümer — die Erstanlage braucht den authentifizierten Anfragenden.",
        );
      }
      return this.withKoLock(`create-op:${createOperationId}`, () =>
        this.createLocked(input, createOperationId, {
          actor,
          fingerprint: operation.fingerprint,
        }),
      );
    }
    return this.createPlain(input);
  }

  /**
   * AUFTRAG-mega22 Block H — der Vollzug unter dem Vorgangs-Lock. Getrennt aus demselben Grund wie
   * `createWithDocumentsLocked`: alles, was den BESTAND befragt, steht hier drin.
   */
  private async createLocked(
    input: CreateKoInput,
    createOperationId: string,
    requester: CreateOperationRequester,
  ): Promise<KnowledgeObject> {
    // DER NACHSCHLAG VOR ALLEM VERÄNDERLICHEN — er SCHREIBT NICHTS. Eine unbekannte Kennung liefert
    // `undefined`, und der volle, ungekürzte Weg läuft weiter.
    const adopted = await this.adoptCreatedKo(createOperationId, requester);
    if (adopted) {
      return adopted;
    }
    const ko = await this.buildCreatedKo(input, {
      createOperationId,
      createOperation: {
        actor: requester.actor,
        fingerprint: requester.fingerprint,
        state: "committed",
        at: new Date(this.now()).toISOString(),
      },
    });
    try {
      await this.repo.insert(ko);
    } catch (err) {
      // KOLLISIONS-ADOPTION, wortgleich zur Dokumentübernahme: der Nachschlag war leer, der Insert
      // kollidiert trotzdem — zwei Prozesse im Rennen um denselben Vorgang. Die DB entscheidet, der
      // Verlierer übernimmt das materialisierte Objekt statt ein zweites anzulegen.
      if (err instanceof KoError && err.code === "CREATE_ANCHOR_TAKEN") {
        const raced = await this.adoptCreatedKo(createOperationId, requester);
        if (raced) {
          return raced;
        }
      }
      throw err;
    }
    await this.finishCreated(ko, input.author);
    return ko;
  }

  private async createPlain(input: CreateKoInput): Promise<KnowledgeObject> {
    const ko = await this.buildCreatedKo(input);
    await this.repo.insert(ko);
    await this.finishCreated(ko, input.author);
    return ko;
  }

  /**
   * Die BELEGE der Erstanlage, an EINER Stelle — Snapshot und `ko.created`.
   *
   * AUFTRAG-mega22 Block H: herausgezogen, weil es jetzt zwei Wege in `create` gibt (mit und ohne
   * Vorgang). Zwei Kopien dieser Folge wären zwei Gelegenheiten, sie auseinanderlaufen zu lassen —
   * und die zweite hätte niemand geprüft.
   */
  private async finishCreated(ko: KnowledgeObject, author: string): Promise<void> {
    // SCRUM-159: Version-1-Snapshot persistieren (Foundation; aktuelles KO bleibt canonical).
    // WP-SHIP8-CLOSE-5 (bens ROT-1A): wirft Snapshot ODER Audit NACH dem Insert, lehnt create ab,
    // obwohl das KO existiert (Teilpersistenz). Der Adoptions-/Recovery-Pfad des Import-Accepts
    // zieht die fehlenden Belege dann IDEMPOTENT nach (ensureCreatedSideEffects) und ist ohne
    // vollständige Belege fail-closed — hier bleibt der Ablauf bewusst untransaktional schlank.
    await this.snapshot(ko, author, "erstellt");
    // G27: die Suchprojektion der Version 1 entsteht im selben Belegschritt wie der Snapshot —
    // ein frisch angelegtes Objekt ist ab diesem Moment auffindbar, mit seinem VOLLEN Text.
    await this.persistSearchProjection(ko);
    // WP-SHIP8-CLOSE-6 (bens ROT-1): auch die ERSTANLAGE schreibt ihren Beleg exactly-once über
    // dieselbe stabile Event-Id wie der Nachzieh-Pfad — ein Race zwischen create und einem
    // parallelen Nachzug kann nie zwei ko.created-Einträge erzeugen.
    await this.audit?.recordOnce(`ko.created:${ko.id}`, {
      actor: author,
      action: "ko.created",
      target: ko.id,
    });
  }

  /**
   * AUFTRAG-mega19 Block B — DIE ERSTANLAGE AUS DOKUMENTEN. EIN VORGANG, ODER KEINER.
   *
   * ============================================================================================
   * DER BEFUND
   * ============================================================================================
   *
   * Das frische Erfassen committete bisher ZUERST den vollständigen Body (`create`/`promote`) und
   * band die Herkunft ERST DANACH, je Ankerdokument mit einem eigenen `append-document`-Aufruf.
   * Drei reale Brüche:
   *
   *   · lehnt die erste Verbundoperation ab (oder bleibt sie unklar), steht der Dokumentinhalt
   *     bereits im neuen Wissensobjekt — Inhalt ohne Herkunft, genau der verbotene Zustand;
   *   · bei MEHREREN Ankerdokumenten kann Job 1 gelingen und Job 2 scheitern, obwohl der Body
   *     Inhalt aus BEIDEN trägt — derselbe Fehler in klein;
   *   · der Erfolgs-Handler behandelte den Submit weiterhin als gespeichert und zeigte die
   *     fehlende Herkunft nur als Teilfehler.
   *
   * ============================================================================================
   * WARUM NICHT DIE EINFACHERE REPARATUR
   * ============================================================================================
   *
   * Die billige Variante wäre, `POST /api/kos` wieder für Client-`sources` zu öffnen. Das ist die
   * SCRUM-470-Grenze, und sie fällt nicht: über sie könnte jeder mit `ko.create` gefälschte,
   * peer-validierte Herkunftsanker setzen und spätere Import-Upserts kapern. Die Grenze bleibt,
   * WEIL sie richtig ist — aber das Restfenster hinzunehmen war falsch. Deshalb dieser Weg: die
   * allgemeine Route bleibt streng, die FACHOPERATION kommt DANEBEN, nicht hinein. Dieselbe
   * Bewegung wie bei `appendDocumentExtract` in mega18.
   *
   * Der Unterschied zur allgemeinen Route ist kein Vertrauensvorschuss, sondern ein anderer
   * Beweisstand: hier stammt JEDE Quelle aus einem Dokument, das der Server im selben Vorgang als
   * Anhang DIESES Objekts bindet, und der Aufrufer hat dieses Dokument vorher im eigenen
   * Objektspeicher nachgeschlagen. `peerValidated` ist hart `false`, `provider` kommt aus der
   * serverseitigen Ableitung, `importCandidateId`/`externalId` gibt es hier gar nicht.
   *
   * ============================================================================================
   * DIE ZUSAGE
   * ============================================================================================
   *
   * ALLE Ankerdokumente und ALLE Belegstellen entstehen GEMEINSAM mit dem Inhalt — oder es
   * entsteht NICHTS. Ein Body aus zwei Dokumenten, von denen nur eines gebunden ist, ist nicht
   * darstellbar:
   *
   *   1. Erst wird ALLES geprüft (Belegpflicht je Bündel, Belegstellen vorhanden, Labels) —
   *      VOR dem ersten Schreibvorgang. Ein Fehler hier hinterlässt kein Wissensobjekt.
   *   2. Dann GENAU EIN `repo.insert` mit Inhalt, Ankern und Belegstellen im selben Objekt.
   *   3. Was danach kommt (Snapshot, Evidence, Audit), ist BELEG der Anlage. Schlägt einer fehl,
   *      wird das Wissensobjekt KOMPENSIEREND ENTFERNT — nicht „wirksam, aber unbelegt", und
   *      erst recht kein Inhalt ohne Herkunft.
   *
   * Das ist strenger als `create`, das nach dem Insert bewusst untransaktional bleibt
   * (WP-SHIP8-CLOSE-5). Der Unterschied ist gewollt: dort ist der Nachzieh-Pfad des Import-
   * Accepts der Auffang, hier gibt es keinen — ein halb belegtes Übernahme-KO könnte niemand
   * später richtigstellen, weil niemand mehr wüsste, WORAUS der Inhalt stammte.
   */
  async createWithDocuments(
    input: CreateKoInput,
    documents: readonly DocumentBundleInput[],
    // AUFTRAG-mega21 Block A: statt der nackten Kennung reist jetzt DER VORGANG. `actor` ist der
    // AUTHENTIFIZIERTE Anfragende (nicht `input.author` — beim Entwurfsweg sind das zwei
    // verschiedene Menschen), `fingerprint` der kanonische Inhaltsabdruck. Beide sind Pflicht: ein
    // optionaler Eigentümer wäre genau der Zustand, den dieser Block schliesst.
    operation: { id: string; actor: string; fingerprint: string },
  ): Promise<KnowledgeObject> {
    // ---- DER VORGANGSSCHLÜSSEL ZUERST --------------------------------------------------------
    // Vor jeder anderen Prüfung und mit demselben Vertrag wie beim Append: ohne wiederholbaren
    // Schlüssel ist dieser Aufruf nicht sicher ausführbar, weil sein Erfolg nicht wiederholbar
    // ist. Ungültig ⇒ ehrlicher Formfehler, nie ein erfundener Ersatzwert (document-create.ts).
    const createOperationId = normalizeCreateOperationId(operation.id);
    const actor = operation.actor.trim();
    if (!actor) {
      // Ein Vorgang ohne Eigentümer ist kein Vorgang. Das kann nur ein programmatischer Aufrufer
      // auslösen (die Route hat den authentifizierten Nutzer immer), und für den ist ein harter
      // Fehler die richtige Antwort — nicht ein stiller Rückfall auf `input.author`.
      throw new KoError(
        "INVALID_OPERATION_ID",
        "Vorgang ohne Eigentümer — die Erstanlage braucht den authentifizierten Anfragenden.",
      );
    }
    const requester: CreateOperationRequester = { actor, fingerprint: operation.fingerprint };
    // ---- ALLES PRÜFEN, BEVOR IRGENDETWAS ENTSTEHT ------------------------------------------
    if (documents.length === 0) {
      throw new KoError(
        "MISSING_DOCUMENT_ANCHOR",
        "Übernahme ohne Originaldokument — kein Inhalt ohne Herkunft.",
      );
    }
    // Die INTERNE BELEGPFLICHT je Bündel, stufenblind wie überall (document-append.ts). Sie WIRFT;
    // es gibt kein „false", das hier jemand übersehen könnte.
    const anchorIds = documents.map((doc) =>
      requireDocumentEvidence({ anchorObjectId: doc.anchor?.objectId }),
    );
    for (const doc of documents) {
      if (doc.sources.length === 0) {
        throw new KoError(
          "INVALID_SOURCE",
          "Übernahme ohne Belegstelle — kein Inhalt ohne Herkunft.",
        );
      }
      if (doc.sources.some((s) => !(typeof s.label === "string" && s.label.trim()))) {
        throw new KoError("INVALID_SOURCE", "Quellen-Label fehlt.");
      }
    }

    // ---- AB HIER SERIALISIERT: NACHSCHLAG UND VOLLZUG DESSELBEN VORGANGS ---------------------
    // Derselbe Lock-Mechanismus wie bei den KO-Mutationen, nur mit dem VORGANG als Schlüssel (das
    // Objekt hat ja noch keine Kennung). Damit können zwei gleichzeitige Wiederholungen im selben
    // Prozess nicht beide „noch nicht da" lesen und beide inserten. Prozessübergreifend fängt das
    // der Unique-Index — der zweite Insert kollidiert und wird unten ADOPTIERT statt dupliziert;
    // die prozessübergreifende SERIALISIERUNG selbst bleibt Nach-VIP-2 und ist hier nicht nötig.
    return this.withKoLock(`create-op:${createOperationId}`, () =>
      this.createWithDocumentsLocked(input, documents, anchorIds, createOperationId, requester),
    );
  }

  /**
   * Der Vollzug der Erstanlage unter dem Vorgangs-Lock. Getrennt, damit die REIHENFOLGE oben
   * lesbar bleibt: unveränderliche Prüfungen (Formen, Belegpflicht) VOR dem Lock und vor dem
   * Nachschlag — eine Wiederholung trägt denselben Body, fällt dort also entweder beide Male oder
   * keinmal. Alles, was den BESTAND befragt, steht hier drin.
   */
  private async createWithDocumentsLocked(
    input: CreateKoInput,
    documents: readonly DocumentBundleInput[],
    /** Die von `requireDocumentEvidence` bereits BESTÄTIGTEN Anker — je Bündel einer, in Reihenfolge. */
    anchorIds: readonly string[],
    createOperationId: string,
    requester: CreateOperationRequester,
  ): Promise<KnowledgeObject> {
    // ---- DER NACHSCHLAG: LIEFERT EINE WIEDERHOLUNG DAS VORHANDENE OBJEKT? -------------------
    // Er SCHREIBT NICHTS. Findet er nichts, läuft der volle, ungekürzte Weg weiter — es gibt
    // keinen Zustand, in dem etwas NEUES entsteht, ohne dass alle Prüfungen gelaufen sind.
    const adopted = await this.adoptCreatedKo(createOperationId, requester);
    if (adopted) {
      return adopted;
    }

    const at = new Date(this.now()).toISOString();
    // Anker und Belegstellen VOLLSTÄNDIG aufbauen — ein Teilbestand ist nicht darstellbar.
    const attachments: KoAttachment[] = [];
    const sources: KoSource[] = [];
    // Welche Belegstellen zu welchem Anker gehören, wird für die Evidence-Records gebraucht.
    const bySource = new Map<string, string>();
    documents.forEach((doc, index) => {
      const anchorObjectId = anchorIds[index] as string;
      const attachment: KoAttachment = {
        id: this.genId(),
        name: doc.anchor.name,
        mime: doc.anchor.mime,
        author: input.author,
        at,
        objectId: anchorObjectId,
        ...(doc.anchor.thumbnail ? { thumbnail: doc.anchor.thumbnail } : {}),
        ...(doc.anchor.size !== undefined ? { size: doc.anchor.size } : {}),
      };
      attachments.push(attachment);
      for (const source of doc.sources) {
        const provider = source.provider?.trim() ? source.provider.trim() : null;
        const built: KoSource = {
          id: this.genId(),
          label: (source.label as string).trim(),
          url: safeSourceUrl(source.url),
          excerpt: source.excerpt?.trim() ? source.excerpt.trim() : null,
          kind: "external",
          peerValidated: false,
          ...(provider ? { provider } : {}),
          author: input.author,
          at,
        };
        sources.push(built);
        bySource.set(built.id, attachment.id);
      }
    });

    // ---- GENAU EIN SCHREIBVORGANG ------------------------------------------------------------
    // Inhalt, Anker und Belegstellen stehen in DEMSELBEN Objekt. Es gibt keinen Zeitpunkt, zu dem
    // der Body ohne seine Herkunft im Bestand liegt — auch nicht für einen Augenblick.
    const ko = await this.buildCreatedKo(input, {
      attachments,
      sources,
      createOperationId,
      // AUFTRAG-mega21 Block A: der Vorgangs-Datensatz entsteht MIT dem Objekt. `committed` ist der
      // Normalzustand; nur eine gescheiterte Rücknahme setzt ihn später auf `repair_required`.
      createOperation: {
        actor: requester.actor,
        fingerprint: requester.fingerprint,
        state: "committed",
        at,
      },
    });
    try {
      await this.repo.insert(ko);
    } catch (err) {
      // KOLLISIONS-ADOPTION. Der Nachschlag oben war leer, der Insert kollidiert trotzdem: genau
      // das Rennen zweier Prozesse um DENSELBEN Vorgang. Die DB hat entschieden, wer gewinnt; der
      // Verlierer erzeugt kein zweites Objekt, sondern übernimmt das materialisierte.
      if (err instanceof KoError && err.code === "CREATE_ANCHOR_TAKEN") {
        const raced = await this.adoptCreatedKo(createOperationId, requester);
        if (raced) {
          return raced;
        }
      }
      throw err;
    }

    let snapshotWritten = false;
    let projectionWritten = false;
    try {
      await this.snapshot(ko, input.author, "erstellt (Dokumentinhalt übernommen)");
      snapshotWritten = this.versions !== undefined;
      // G27: derselbe Belegschritt wie bei der allgemeinen Erstanlage — hier aber INNERHALB der
      // Rücknahmeklammer. Die Meldung sagt, ob DIESER Vorgang die Zeile geschrieben hat; nur dann
      // darf die Rücknahme sie wieder entfernen (s. `rollbackCreatedKo`). Sie trifft ein, BEVOR
      // die zweite Projektionshälfte geschrieben wird — auch deren Fehler nimmt die Zeile mit.
      await this.persistSearchProjection(ko, (geschrieben) => {
        projectionWritten = geschrieben;
      });
      for (const attachment of attachments) {
        await this.appendEvidence({
          koId: ko.id,
          koVersion: ko.version,
          kind: "attachment",
          attachmentId: attachment.id,
          objectId: attachment.objectId as string,
          label: attachment.name,
          mime: attachment.mime,
          createdBy: input.author,
          createdAt: at,
        });
      }
      for (const source of ko.sources) {
        const attachmentId = bySource.get(source.id);
        await this.appendEvidence({
          koId: ko.id,
          koVersion: ko.version,
          kind: "source",
          sourceId: source.id,
          ...(attachmentId ? { attachmentId } : {}),
          label: source.label,
          ...(source.url ? { url: source.url } : {}),
          // mega26 Block B: der Grund der Verknüpfung — die Belegstelle, die diese Quelle trägt.
          // `source.excerpt` ist hier bereits getrimmt/normalisiert (s. o.).
          ...(source.excerpt ? { excerpt: source.excerpt } : {}),
          createdBy: input.author,
          createdAt: at,
        });
      }
      await this.audit?.recordOnce(`ko.created:${ko.id}`, {
        actor: input.author,
        action: "ko.created",
        target: ko.id,
      });
      await this.audit?.record({
        actor: input.author,
        action: "ko.document-appended",
        target: ko.id,
        payload: {
          created: true,
          version: ko.version,
          documents: documents.length,
          sources: sources.length,
        },
      });
      return ko;
    } catch (err) {
      // VOLLSTÄNDIGE RÜCKNAHME. Anders als bei `revise` gibt es hier keinen Vorzustand, auf den
      // zurückgesetzt werden könnte — es gibt nur „existiert" und „existiert nicht". Also wird das
      // Wissensobjekt ENTFERNT. Damit bleibt bei jedem Fehlschlag KEIN Wissensobjekt mit
      // Dokumentinhalt zurück, was die Zusage dieses Blocks ist.
      //
      // EHRLICHE GRENZE, dieselbe wie in `appendDocumentExtract`: bereits geschriebene
      // EvidenceRecords sind append-only und bleiben stehen. Sie zeigen dann auf ein
      // Wissensobjekt, das es nicht gibt — der HARMLOSE Spiegel, nicht der verbotene Zustand.
      //
      // AUFTRAG-mega20 Block A: die Rücknahme VERSCHLUCKT IHREN EIGENEN FEHLER NICHT MEHR. Bis
      // mega19 stand hier `.catch(() => undefined)` — scheiterte `delete`, blieb ein vollständiges
      // Wissensobjekt im kanonischen Bestand (Body, Anker, Belegstellen), je nach vorherigem
      // Fehler ohne Snapshot, ohne Evidence, ohne Audit, und der Aufrufer erfuhr davon NICHTS.
      await this.rollbackCreatedKo(ko, { snapshotWritten, projectionWritten }, input.author, err);
      throw err;
    }
  }

  /**
   * AUFTRAG-mega20 Block A — DIE ADOPTION. Schreibfrei, und sie gibt nichts Fremdes preis.
   *
   * WARUM DIE AUTORSCHAFT GEPRÜFT WIRD. Die Erzeugungskennung ist DB-weit eindeutig — anders als
   * die Append-Kennung, die nur innerhalb EINES Objekts dedupliziert. Ohne diese Prüfung könnte
   * jemand mit `ko.create` durch Raten einer fremden Kennung ein fremdes Wissensobjekt vollständig
   * ausgeliefert bekommen, ohne je `ko.read` auf ihm gehabt zu haben. Die Kennung soll den EIGENEN
   * Vorgang wiederholbar machen, nicht als Nachschlagewerk für fremde dienen.
   *
   * Ein Treffer mit fremder Autorschaft ist deshalb ein ehrlicher KONFLIKT, kein `null`: `null`
   * hieße „unbekannt", und der Aufrufer liefe daraufhin in einen Insert, der am Unique-Index
   * scheitert — er bekäme also ohnehin einen Fehler, nur einen unverständlichen. Die Kollision
   * bestätigt dabei lediglich, dass die Kennung vergeben ist; sie verrät kein Objekt und keinen
   * Inhalt.
   *
   * GETRASHTE OBJEKTE ZÄHLEN MIT (kein `require`, das sie ausblendet). Der Vorgang IST gelungen —
   * dass jemand das Ergebnis danach in den Papierkorb gelegt hat, ist eine spätere Tatsache und
   * kein Grund, ein zweites Objekt anzulegen.
   *
   * ==========================================================================================
   * AUFTRAG-mega21 Block A — DREI TORE STATT EINEM, in dieser Reihenfolge
   * ==========================================================================================
   *
   *   1. EIGENTÜMER (bens SB-1). Geprüft wird `createOperation.actor` gegen den ANFRAGENDEN, nicht
   *      `author` gegen `author`. Damit funktioniert der rechtmäßige Wiederholversuch eines Admins,
   *      der einen fremden Entwurf eingereicht hat, und ein späteres `setAuthor` verschiebt die
   *      Bindung nicht. Die Begründung beider Punkte steht in document-create.ts.
   *
   *   2. ZUSTAND (bens SB-4). Ein Reparaturrest wird NIE als normaler Erfolg geliefert. Geprüft
   *      werden BEIDE Spuren desselben Zustands — `createOperation.state` und `needsRepair` —,
   *      weil beide best effort geschrieben werden und in derselben Störung einzeln ausfallen
   *      können. Zwei Spuren, ein Urteil: liegt EINE von beiden vor, ist es ein Rest.
   *
   *   3. INHALTSABDRUCK (bens SB-3). Gleicher Schlüssel + abweichender Abdruck ist KEINE
   *      Wiederholung, sondern ein anderer Inhalt unter altem Namen. Der Aufrufer bekommt das
   *      ausdrücklich gesagt statt still den alten Stand.
   *
   * DIE REIHENFOLGE IST EINE ENTSCHEIDUNG. Der Eigentümer zuerst, weil ein Fremder über die
   * folgenden Tore sonst erführe, in welchem Zustand ein fremder Vorgang ist und ob sein eigener
   * Inhalt zufällig passt — beides geht ihn nichts an. Der Zustand vor dem Abdruck, weil „dieses
   * Objekt muss geprüft werden" schwerer wiegt und die richtigere Auskunft ist als „dein Text hat
   * sich geändert".
   *
   * ALTBESTAND (Objekte aus mega20, `createOperationId` ohne Datensatz): Tor 1 fällt auf den alten
   * `author`-Vergleich zurück, Tor 3 entfällt mangels Vergleichswert, Tor 2 greift über
   * `needsRepair` weiterhin. Das ist schlechter als der neue Weg und ausdrücklich so benannt — es
   * ist der beste erreichbare Umgang mit Daten, die vor der Regel entstanden sind.
   */
  private async adoptCreatedKo(
    createOperationId: string,
    requester: CreateOperationRequester,
  ): Promise<KnowledgeObject | undefined> {
    // AUFTRAG-mega22 Block G: der Nachschlag ist actor-gebunden. Ein FREMDER, actor-gebundener
    // Vorgang derselben Kennung wird hier gar nicht mehr gefunden — er geht den Anfragenden nichts
    // an, und sein blosses Vorhandensein darf ihn nicht aus seinem eigenen Vorgang drängen. Was
    // noch gefunden wird, ist der EIGENE Vorgang oder eine Altzeile ohne Eigentümer; für die
    // zweite bleibt Tor 1 unten in Kraft.
    const known = await this.repo.findByCreateOperation(createOperationId, requester.actor);
    if (!known) {
      return undefined;
    }
    const operation = known.createOperation;
    // ---- TOR 1: DER EIGENTÜMER ---------------------------------------------------------------
    // Nach Block G kann dieses Tor nur noch für ALTZEILEN greifen (Vorgangskennung ohne
    // Vorgangs-Datensatz). Es bleibt genau dafür stehen: dort ist der `author`-Vergleich die
    // einzige verfügbare Information, und ein blindes „gehört niemandem" machte jeden Altvorgang
    // entweder zum Konflikt oder zum fremden Objekt.
    const owner = operation?.actor ?? known.author;
    if (owner !== requester.actor) {
      throw new KoError(
        "CREATE_ANCHOR_TAKEN",
        "Diese Operations-Kennung gehört zu einem anderen Vorgang — bitte eine neue verwenden.",
      );
    }
    // ---- TOR 2: DER ZUSTAND ------------------------------------------------------------------
    if (operation?.state === "repair_required" || known.needsRepair) {
      throw new KoError(
        "CREATE_REPAIR_REQUIRED",
        `Dieser Vorgang ist unvollständig abgeschlossen — das Wissensobjekt ${known.id} steht im Bestand, seine Belege können aber fehlen. Es muss geprüft werden; ein Wiederholversuch würde den Zustand nicht heilen.`,
        { koId: known.id },
      );
    }
    // ---- TOR 3: DER INHALTSABDRUCK -----------------------------------------------------------
    if (operation && operation.fingerprint !== requester.fingerprint) {
      throw new KoError(
        "IDEMPOTENCY_PAYLOAD_MISMATCH",
        "Unter diesem Vorgang wurde bereits ein anderer Inhalt gespeichert. Der Vorgangsschlüssel benennt den Vorgang, nicht den Text — geänderter Inhalt braucht einen neuen Vorgang.",
        { koId: known.id },
      );
    }
    return known;
  }

  /**
   * AUFTRAG-mega20 Block A — DIE RÜCKNAHME, DIE IHREN EIGENEN FEHLSCHLAG BENENNT.
   *
   * Zurückzunehmen sind ZWEI Spuren: das Wissensobjekt und — seit G27 — die Suchprojektion, sofern
   * DIESER Vorgang sie geschrieben hat. Jede kann für sich gelingen oder scheitern, deshalb gibt es
   * vier Ausgänge und nicht zwei:
   *
   *   A. NICHTS BLEIBT — Objekt gelöscht, und die neu geschriebene Projektionszeile ist entfernt
   *      (oder es gab keine zu entfernen). Die Methode kehrt still zurück, der Aufrufer sieht nur
   *      den ursprünglichen Fehler.
   *   B. NUR DAS WISSENSOBJEKT BLEIBT (`repo.delete` scheitert) — der bisher allein beschriebene
   *      Fall: `needsRepair` MARKIERT das Objekt (best effort, s. document-create.ts), das AUDIT
   *      hält fest, ob die Markierung durchkam (`marked`), und `CREATE_ROLLBACK_FAILED` benennt
   *      das zurückgebliebene Objekt.
   *   C. NUR DIE PROJEKTIONSZEILE BLEIBT (ihr `remove` scheitert, das Objekt wird gelöscht) — dann
   *      gibt es kein Objekt mehr, an dem ein Vermerk haften könnte; `needsRepair` wird gar nicht
   *      erst versucht (`marked: false` bei `koRemoved: true`). AUDIT und `CREATE_ROLLBACK_FAILED`
   *      sind die einzigen Kanäle, und die Meldung benennt die Zeile, nicht den Bestand.
   *   D. BEIDE RESTE — beide werden im AUDIT getrennt benannt (`koRemoved: false`,
   *      `searchProjectionLeftBehind: true`), Vermerk und `CREATE_ROLLBACK_FAILED` folgen wie in B,
   *      weil sichtbarer Bestand schwerer wiegt als eine liegengebliebene Zeile.
   *
   * In B, C und D geschieht dasselbe in dieser Reihenfolge und unabhängig voneinander: markieren
   * (nur wo es noch ein Objekt gibt) → Audit schreiben → `CREATE_ROLLBACK_FAILED` werfen. Aus einem
   * Fehlschlag der Rücknahme folgt also NICHT, dass das Wissensobjekt im Bestand steht — welcher
   * Rest gemeint ist, sagen Meldung und Payload.
   *
   * Der geworfene Fehler ersetzt den ursprünglichen bewusst NICHT — er trägt ihn als `cause` mit.
   * Für den Aufrufer ist die wichtigere Nachricht die neue: „es ist etwas übrig, und zwar dieses
   * hier".
   *
   * G27: die SUCHPROJEKTION gehört zu dem, was zurückgenommen werden muss, und sie wird VOR dem
   * harten `repo.delete` entfernt. Danach wäre sie nicht mehr erreichbar: die Standardsuche liefert
   * sie nicht (der JOIN auf das Wissensobjekt fällt weg), `missingActive` findet sie nicht, der
   * Rebuild läuft über den Bestand und `removeByKo` wird für ein längst gelöschtes Objekt nie mehr
   * gerufen — eine Karteileiche für immer. Entfernt wird ausschließlich eine Zeile, die DIESER
   * Vorgang geschrieben hat (`written.projectionWritten`).
   */
  private async rollbackCreatedKo(
    ko: KnowledgeObject,
    written: { snapshotWritten: boolean; projectionWritten: boolean },
    author: string,
    failed: unknown,
  ): Promise<void> {
    if (written.snapshotWritten) {
      await this.versions?.remove(ko.id, ko.version).catch(() => undefined);
    }
    // G27: zuerst die Projektion, dann das Objekt — s. Kopfkommentar. Ein Fehlschlag wird NICHT
    // geschluckt: er entscheidet unten mit darüber, ob diese Rücknahme sauber war.
    let projectionFailure: unknown;
    let projectionLeftBehind = false;
    if (written.projectionWritten) {
      try {
        await this.searchProjections.remove(ko.id, ko.version, { ruecknahme: true });
      } catch (err) {
        projectionFailure = err;
        projectionLeftBehind = true;
      }
    }
    // S2: die Metadatenzeile gehört zu DIESER Erstanlage — bei einer Erstanlage gibt es keinen
    // Vorzustand, den sie tragen könnte. Sie wird deshalb mit zurückgenommen; ohne das bliebe die
    // Kategorie eines nie entstandenen Objekts im abgeleiteten Datenraum stehen. Best effort und
    // getrennt vom Inhaltsrest bewertet: sie ist über `removeByKo` später wieder erreichbar.
    if (written.projectionWritten) {
      await this.searchProjections.metadata.remove(ko.id).catch(() => undefined);
    }
    let rollbackFailure: unknown;
    let koRemoved = false;
    try {
      await this.repo.delete(ko.id);
      koRemoved = true;
    } catch (err) {
      rollbackFailure = err;
    }
    if (koRemoved && !projectionLeftBehind) {
      return; // sauber zurückgenommen — es bleibt nichts, der Aufrufer sieht nur den Urfehler.
    }
    const note: KoRepairNote = {
      at: new Date(this.now()).toISOString(),
      failedStep: describeFailure(failed),
      // Der führende Fehlschlag der Rücknahme: das nicht gelöschte Objekt wiegt schwerer als die
      // liegengebliebene Projektionszeile, weil es sichtbarer Bestand ist.
      rollbackFailure: describeFailure(rollbackFailure ?? projectionFailure),
    };
    let marked = false;
    if (!koRemoved) {
      try {
        // AUFTRAG-mega21 Block A: Vermerk UND Vorgangszustand im SELBEN Write. Zwei getrennte
        // Updates wären zwei Gelegenheiten, nur eine Hälfte zu schreiben — und ein Rest mit
        // Vermerk, aber ohne Zustand (oder umgekehrt) wäre genau die halbe Wahrheit, die
        // adoptCreatedKo deshalb aus BEIDEN Spuren liest.
        await this.repo.update({
          ...ko,
          needsRepair: note,
          ...(ko.createOperation
            ? { createOperation: { ...ko.createOperation, state: "repair_required" as const } }
            : {}),
        });
        marked = true;
      } catch {
        // Der Vermerk ist nicht der einzige Kanal (s. document-create.ts) — hier wird deshalb
        // weitergemacht statt abgebrochen. Dass er fehlt, steht unten im Audit.
      }
    }
    // Ist das Objekt weg und nur die Projektionszeile geblieben, gibt es kein Objekt mehr, an dem
    // ein Vermerk haften könnte — dann sind Audit und geworfener Fehler die einzigen Kanäle. Der
    // Payload benennt beide Reste getrennt, damit niemand aus `marked: false` auf ein
    // zurückgebliebenes Wissensobjekt schließt.
    await this.audit
      ?.record({
        actor: author,
        action: "ko.create-rollback-failed",
        target: ko.id,
        payload: {
          ...note,
          marked,
          koRemoved,
          searchProjectionLeftBehind: projectionLeftBehind,
          ...(projectionLeftBehind
            ? { searchProjectionFailure: describeFailure(projectionFailure) }
            : {}),
        },
      })
      .catch(() => undefined);
    throw new KoError(
      "CREATE_ROLLBACK_FAILED",
      koRemoved
        ? `Die Anlage ist gescheitert; das Wissensobjekt ${ko.id} wurde zurückgenommen, seine Suchprojektion (Version ${ko.version}) aber nicht — sie muss entfernt werden.`
        : `Die Anlage ist gescheitert, die Rücknahme ebenfalls — das Wissensobjekt ${ko.id} steht unvollständig belegt im Bestand und muss geprüft werden.`,
      { koId: ko.id, cause: failed },
    );
  }

  /**
   * AUFTRAG-mega20 Block A — SCHREIBFREIER NACHSCHLAG DER ERSTANLAGE, für die Route.
   *
   * Dieselbe Form und derselbe Grund wie `lookupDocumentAppend` (mega19 Block A): der Nachschlag
   * muss VOR den veränderlichen Toren der Route liegen, weil deren Antwort sich zwischen erstem
   * Aufruf und Wiederholung ändert — bei der Erstanlage sogar dramatischer als beim Append, denn
   * der erste Aufruf LÖSCHT den Entwurf, den die Wiederholung dann nicht mehr findet.
   *
   * Sie SCHREIBT NICHTS. Eine unbekannte Kennung ist schlicht `null`, und der Aufrufer läuft
   * daraufhin den vollen, ungekürzten Weg durch ALLE Tore.
   */
  async lookupDocumentCreate(
    operationId: string,
    // AUFTRAG-mega21 Block A: derselbe Vorgang wie beim Vollzug — Eigentümer UND Inhaltsabdruck.
    // Der Abdruck kommt aus dem REQUEST-BODY und ist deshalb hier, VOR jeder Entwurfs-Ladung,
    // bereits berechenbar. Genau darum darf der Nachschlag weiterhin ganz vorne stehen.
    requester: CreateOperationRequester,
  ): Promise<KnowledgeObject | null> {
    const createOperationId = normalizeCreateOperationId(operationId);
    return this.withKoLock(
      `create-op:${createOperationId}`,
      async () => (await this.adoptCreatedKo(createOperationId, requester)) ?? null,
    );
  }

  /**
   * AUFTRAG-mega21 Block C-1 — DIE GESCHEITERTEN NACHARBEITEN, DAUERHAFT AM OBJEKT.
   *
   * Die Route fängt jeden Post-Commit-Schritt einzeln auf und meldet ihn in `followUpsFailed`. Das
   * war bis mega20 die EINZIGE dauerhafte Spur ausserhalb des Audits — und eine Antwort ist keine
   * Spur: sobald der Browser sie gelesen (oder verloren) hat, ist sie weg. Ein Wissensobjekt, dessen
   * Prüferzuweisung fehlschlug, „wartet auf niemanden" und war von einem, das keine Prüfer brauchte,
   * nicht zu unterscheiden.
   *
   * Dieses Feld macht es AUFFINDBAR: es steht am Objekt, jede Abfrage sieht es, ein Neustart
   * überlebt es. Es REPARIERT nichts (die Wiederaufnahme-Warteschlange ist Nach-VIP-2) — es ist die
   * Voraussetzung jeder Wiederaufnahme, genau wie `needsRepair` es für den Reparaturrest ist.
   *
   * BEST EFFORT und bewusst OHNE Version/Audit: der Vorgang ist gelungen, dies ist ein Vermerk über
   * eine Nacharbeit und kein Wissensinhalt. Ein Fehlschlag hier darf die 201 nicht kippen.
   */
  async recordCreateFollowUpFailures(id: string, steps: readonly string[]): Promise<boolean> {
    const clean = [...new Set(steps.map((s) => s.trim()).filter((s) => s.length > 0))].sort();
    if (clean.length === 0) {
      return false;
    }
    const ko = await this.repo.findById(id);
    if (!ko || ko.deletedAt) {
      return false;
    }
    await this.repo.update({ ...ko, createFollowUpsFailed: clean });
    return true;
  }

  /**
   * AUFTRAG-mega21 Block C-1 — DER PRÜF-JOB, DER SICH SELBST ALS GESCHEITERT VERMERKT.
   *
   * bens Fundstelle: scheitert `markAiCheckPending`, gibt es GAR KEINEN Vermerk — und der
   * vorhandene Wiederhol-Endpunkt (`POST /api/kos/:id/ai-check`) lehnt genau dann mit
   * `AI_CHECK_NOT_RETRYABLE` ab, weil er `failed` oder `pending` verlangt. Die Warnung in der
   * Oberfläche wäre eine Sackgasse: sie sagte „nicht gelaufen", und der Knopf daneben antwortete
   * „dafür steht kein wiederholbarer Job an".
   *
   * Der `failed`-Vermerk schliesst den Kreis: er ist der Zustand, den der bestehende
   * Wiederholmechanismus ohnehin kennt und bedient. Kein zweiter Mechanismus, kein neuer Endpunkt.
   */
  async markAiCheckFailed(id: string, fallbackReason: string): Promise<boolean> {
    return this.recordAiCheckOutcome(id, { ok: false, fallbackReason });
  }

  /**
   * AUFTRAG-mega28 A3 — DER LAUF, DER NIE EINEN STATUS BEKAM.
   *
   * bens JR-2 (von Pedi geschärft): der normale AI-Worker meldet `ok:false` und bleibt
   * retry-fähig — das ist in Ordnung. Die IMPORT-ACCEPT-KANTE ist es nicht: dort läuft die
   * Erkennung SYNCHRON in der Route, ohne Prüf-Job, ohne pending-Vermerk. Ein Kapazitätsabbruch
   * erzeugte dort nur eine Log-Warnung, der Accept galt als gelungen, und es entstand GAR KEIN
   * sichtbarer aiCheck-Status. Beim Konfliktlauf, der jeden Kandidatenfehler einzeln schluckt und
   * weiterläuft, war es noch weniger sichtbar.
   *
   * Diese Fläche schreibt den Ausgang eines Laufs UNBEDINGT (kein pending-Vorzustand nötig) —
   * inklusive der Abdeckung (A2). `markAiCheckFailed` ist seitdem ihr Sonderfall; das Verhalten
   * dort ist unverändert (failed + Ursache, Version gebunden, damit der bestehende Wiederhol-Weg
   * greift).
   */
  async recordAiCheckOutcome(
    id: string,
    outcome: { ok: boolean; fallbackReason?: string; coverage?: AiCheckCoverage },
  ): Promise<boolean> {
    const ko = await this.repo.findById(id);
    if (!ko || ko.deletedAt) {
      return false;
    }
    const at = new Date(this.now()).toISOString();
    return this.repo.setAiCheck(id, {
      status: outcome.ok ? "done" : "failed",
      requestedAt: at,
      finishedAt: at,
      ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
      ...(outcome.coverage ? { coverage: outcome.coverage } : {}),
      koVersion: ko.version,
    });
  }

  // WP-SHIP8-CLOSE-5 (bens ROT-1A, gewählter Weg b): IDEMPOTENTER Nachzieh-Pfad der create-
  // Seiteneffekte für ein bereits PERSISTIERTES KO (Adoption/Recovery des Import-Accepts).
  // Prüft und ergänzt fehlende Belege, BEVOR der Aufrufer den Kandidaten abschließt:
  //  - Version-1-Snapshot (nur wenn er fehlt; Pg-Versions-PK + ON CONFLICT bzw. InMemory-„nie
  //    ersetzen" machen auch einen Doppel-Nachzug harmlos). Note „erstellt (nachgezogen)" macht
  //    den Nachzug ehrlich sichtbar; im (praktisch nicht auftretenden) Fall einer Revision vor
  //    dem Nachzug trägt der v1-Snapshot den adoptierten Stand — die Note weist ihn aus.
  //  - ko.created-Audit exactly-once via recordOnce mit stabiler Event-Id (WP-SHIP8-CLOSE-6,
  //    bens ROT-1) — auch zwei parallele Nachzüge nach leerem Read erzeugen genau EINEN Eintrag.
  // Ohne verdrahtetes Versions-/Audit-Repo existiert der jeweilige Seiteneffekt in dieser
  // Konfiguration nicht — dann ist nichts nachzuziehen (kein künstlicher Fehler). WIRFT eine
  // Fläche, wirft die Methode: der Aufrufer bleibt fail-closed (kein Abschluss ohne Belege).
  async ensureCreatedSideEffects(ko: KnowledgeObject): Promise<void> {
    if (this.versions) {
      const existing = await this.versions.listByKo(ko.id);
      if (!existing.some((v) => v.version === 1)) {
        const copy = JSON.parse(JSON.stringify(ko)) as KnowledgeObject;
        await this.versions.append({
          koId: ko.id,
          version: 1,
          snapshot: { ...copy, version: 1 },
          at: new Date(this.now()).toISOString(),
          author: ko.author,
          note: "erstellt (nachgezogen)",
        });
      }
    }
    if (this.audit) {
      // Vorab-Read nur als ABKÜRZUNG (spart den Chain-Aufbau); die Exactly-once-Garantie kommt
      // aus recordOnce (WP-SHIP8-CLOSE-6, bens ROT-1: persistenzgestützter Idempotenzvertrag —
      // zwei parallele Nachzüge nach leerem Read erzeugen exakt EINEN ko.created-Eintrag).
      const created = await this.audit.list({ action: "ko.created", target: ko.id });
      if (created.length === 0) {
        await this.audit.recordOnce(`ko.created:${ko.id}`, {
          actor: ko.author,
          action: "ko.created",
          target: ko.id,
        });
      }
    }
    // G27: die Suchprojektion gehört zu den Belegen, die der Nachzug herstellen muss — sonst wäre
    // ein adoptiertes/wiederhergestelltes Objekt zwar da, aber unauffindbar. Idempotent wie alles
    // an dieser Stelle (append-only; ein zweiter Nachzug schreibt nichts).
    await this.ensureSearchProjection(ko.id);
  }

  // SCRUM-415: Vertraulichkeitsstufe eines KO setzen/ändern. Jede Änderung landet im Audit
  // (nachvollziehbar, wer wann welche Stufe gesetzt hat). Rechte prüft die Route (wie „category").
  // SCRUM-509 R2: `opts.mayDowngrade` (aus der Rolle abgeleitet) wird HIER geprüft — atomar gegen die
  // frisch gelesene aktuelle Stufe, nicht in der Route (kein TOCTOU). Per-KO serialisiert.
  async setConfidentiality(
    id: string,
    // SCRUM-509 R2: `unknown` — der Wert wird HIER defensiv geprüft (isValidConfidentiality), statt
    // sich auf einen Aufrufer-Cast zu verlassen. Ungültig → INVALID_CONFIDENTIALITY (→ 400).
    level: unknown,
    actor: string,
    opts: { mayDowngrade?: boolean } = {},
  ): Promise<KnowledgeObject> {
    // SCRUM-509: ungültige/fehlende Stufe wird NICHT still auf „intern" normalisiert (fail-open) —
    // sie wird abgelehnt. Fail-safe an der Datenschicht (Belt zur Route).
    if (!isValidConfidentiality(level)) {
      throw new KoError("INVALID_CONFIDENTIALITY", "Ungültige Vertraulichkeitsstufe.");
    }
    return this.mutateKo(id, (ko) => {
      const previous = normalizeConfidentiality(ko.confidentiality);
      const downgrade = isConfidentialityDowngrade(previous, level);
      // SCRUM-509 R2/R3: Downgrade-Autorisierung gegen die GERADE gelesene Stufe (atomar). R3 FAIL-SAFE:
      // fehlt `mayDowngrade`, gilt es als NICHT erlaubt (`!opts...`) — ein Downgrade rutscht nie aus einem
      // fehlenden Recht durch, auch bei programmatischen Aufrufern.
      if (downgrade && !opts.mayDowngrade) {
        throw new KoError(
          "DOWNGRADE_FORBIDDEN",
          "Das Herabstufen der Vertraulichkeit erfordert eine Prüfer-/Admin-Rolle.",
        );
      }
      const updated: KnowledgeObject = { ...ko, confidentiality: level };
      return {
        updated,
        value: updated,
        audit: async () => {
          await this.audit?.record({
            actor,
            action: "ko.confidentiality",
            target: id,
            payload: { level, previous, downgrade },
          });
        },
      };
    });
  }

  // FR-KO-06: Kommentar am Objekt anfügen (Diskussion / Revisions-Schleife).
  async addComment(id: string, author: string, text: string): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const comment: KoComment = {
      id: this.genId(),
      author,
      text,
      at: new Date(this.now()).toISOString(),
    };
    const updated: KnowledgeObject = { ...ko, comments: [...(ko.comments ?? []), comment] };
    await this.repo.update(updated);
    await this.audit?.record({ actor: author, action: "ko.commented", target: id });
    return updated;
  }

  // FR-CAP-05: Anhang (Thumbnail-Daten-URL) anfügen. Größen-/Anzahlgrenzen prüft die Route.
  async addAttachment(
    id: string,
    author: string,
    input: {
      name: string;
      mime: string;
      dataUrl?: string;
      objectId?: string;
      thumbnail?: string;
      size?: number;
    },
  ): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    // SCRUM-121: nur gesetzte Felder übernehmen (kein leeres dataUrl bei Objekt-Referenz).
    const attachment: KoAttachment = {
      id: this.genId(),
      name: input.name,
      mime: input.mime,
      author,
      at: new Date(this.now()).toISOString(),
      ...(input.dataUrl ? { dataUrl: input.dataUrl } : {}),
      ...(input.objectId ? { objectId: input.objectId } : {}),
      ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
      ...(input.size !== undefined ? { size: input.size } : {}),
    };
    const updated: KnowledgeObject = {
      ...ko,
      attachments: [...(ko.attachments ?? []), attachment],
    };
    await this.repo.update(updated);
    if (attachment.objectId) {
      await this.appendEvidence({
        koId: id,
        koVersion: ko.version,
        kind: "attachment",
        attachmentId: attachment.id,
        objectId: attachment.objectId,
        label: attachment.name,
        mime: attachment.mime,
        createdBy: author,
        createdAt: attachment.at,
      });
    }
    await this.audit?.record({ actor: author, action: "ko.attached", target: id });
    return updated;
  }

  async removeAttachment(
    id: string,
    attachmentId: string,
    actor: string,
  ): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated: KnowledgeObject = {
      ...ko,
      attachments: (ko.attachments ?? []).filter((a) => a.id !== attachmentId),
    };
    await this.repo.update(updated);
    await this.audit?.record({ actor, action: "ko.detached", target: id });
    return updated;
  }

  // SCRUM-129 / FR-KO-07: externe Quelle anfügen. Externe Quellen sind NIE peer-validiert.
  async addSource(
    id: string,
    author: string,
    input: {
      label: string;
      url?: string | null;
      excerpt?: string | null;
      provider?: string | null;
    },
  ): Promise<KnowledgeObject> {
    const label = input.label?.trim() ?? "";
    if (label.length === 0) {
      throw new KoError("INVALID_SOURCE", "Quellen-Label fehlt.");
    }
    const ko = await this.require(id);
    const provider = input.provider?.trim() ? input.provider.trim() : null;
    const source: KoSource = {
      id: this.genId(),
      label,
      // SCRUM-527 (WP2): nur absolute http/https-URLs speichern; alles andere (javascript:/data:/
      // vbscript:/relativ/…) → null. Schützt den Klick-Pfad (ko.read) vor gespeicherten aktiven URLs.
      url: safeSourceUrl(input.url),
      excerpt: input.excerpt?.trim() ? input.excerpt.trim() : null,
      kind: "external",
      peerValidated: false,
      // SCRUM-118: externe Quelle trägt optional ihren Anbieter; bleibt external/nicht peer-validiert.
      ...(provider ? { provider } : {}),
      author,
      at: new Date(this.now()).toISOString(),
    };
    const updated: KnowledgeObject = { ...ko, sources: [...(ko.sources ?? []), source] };
    await this.repo.update(updated);
    await this.appendEvidence({
      koId: id,
      koVersion: ko.version,
      kind: "source",
      sourceId: source.id,
      label: source.label,
      url: source.url,
      provider: source.provider ?? null,
      // mega26 Block B: der Grund der Verknüpfung, wörtlich aus der eben gebauten Quelle.
      ...(source.excerpt ? { excerpt: source.excerpt } : {}),
      createdBy: author,
      createdAt: source.at,
    });
    await this.audit?.record({ actor: author, action: "ko.source-added", target: id });
    return updated;
  }

  async removeSource(id: string, sourceId: string, actor: string): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated: KnowledgeObject = {
      ...ko,
      sources: (ko.sources ?? []).filter((s) => s.id !== sourceId),
    };
    await this.repo.update(updated);
    await this.audit?.record({ actor, action: "ko.source-removed", target: id });
    return updated;
  }

  // SCRUM-422: getrashte KOs wirken überall gelöscht — get/list/findCandidates blenden sie aus.
  async get(id: string): Promise<KnowledgeObject | undefined> {
    const ko = await this.repo.findById(id);
    return ko && !ko.deletedAt ? ko : undefined;
  }

  // SCRUM-523 P.3 (WP2): Der Read-Pfad löscht/auditiert NICHT mehr. Früher rief list() den Trash-Sweep
  // (Endlöschung + Audit) auf — damit war kein Lesen (und kein Import-Dry-Run) schreibfrei. Die
  // Endlöschung ist jetzt eine EXPLIZITE Operation (runTrashSweep), die reine Leseoperationen nie auslöst.
  // AUFTRAG-BASIC-391 (Plan aus BASIC 385): der optionale Sicherheitstrim reist DURCH bis in die
  // Datenquelle. Ist er gesetzt, hat die Datenbank Papierkorb UND Sichtbarkeit bereits angewandt —
  // vor jeder Zählung und vor jedem Deckel.
  //
  // DER NODE-SEITIGE PAPIERKORBFILTER BLEIBT STEHEN, aus demselben Grund wie bei `listForSearch`:
  // er bedient JEDEN Aufrufer OHNE Trim unverändert (Projektionsnachzug, Hash-Integrität,
  // library-analytics) und ist mit Trim ein No-op. Er ist ab hier die zweite Linie und nicht mehr
  // die einzige.
  //
  // KEIN DEFAULT — siehe KoRepo.list: vier Aufrufer dieses Repos brauchen die getrashten Zeilen
  // zwingend. Nur die normale Listenroute übergibt den Trim.
  async list(filter: KoFilter = {}, trim?: KoSichtbarkeitstrim): Promise<KnowledgeObject[]> {
    return (await this.repo.list(filter, trim)).filter((k) => !k.deletedAt);
  }

  /**
   * AUFTRAG-mega29 C2 (bens M28-3) — DIE ZAHLEN, DIE EIN LEERES BOARD BRAUCHT.
   *
   * „Keine offenen Konflikte" und „Keine offenen Überschneidungen" sind wörtlich richtig und laden
   * trotzdem zu genau dem Schluss ein, gegen den der Deckel-Ehrlichkeitsvertrag gebaut wurde: dass
   * der Bestand geprüft und frei sei. Die Finding-Endpunkte liefern keine Laufabdeckung — ein
   * einzelnes KO trägt sie, das BOARD sieht sie nie. Diese Zusammenfassung schließt die Lücke.
   *
   * BEWUSST SO SCHMAL WIE MÖGLICH (Pedis Reißleine Z galt genau dieser Stelle): drei Zähler, keine
   * Objektdaten, keine Titel, keine IDs, keine Rechteabstufung nötig. Sie tragen die EINE Aussage,
   * die das leere Board braucht — dass hinter dem Bestand unvollständige Läufe stehen und in
   * welchem Umfang. Alles Weitergehende (welche Objekte, welcher Weg, Wiederaufnahme) ist Post-VIP.
   *
   * `unchecked` zählt Objekte GANZ OHNE Protokoll: über sie sagt kein Lauf etwas — das ist eine
   * andere Aussage als „unvollständig geprüft" und darf nicht mit ihr verschmelzen.
   */
  // AUFTRAG-mega76 BLOCK D: `sichtbar` ist PFLICHT. Die vier Zähler hängen algebraisch zusammen
  // (`total` = `incomplete` + `unchecked` + `noCoverage` + Rest) — jedes vertrauliche Nicht-Demo-KO
  // erhöhte `total` und genau einen Zustandszähler. Bei `total: 1` war die Existenz unmittelbar
  // belegt (ben, sammel72). Gefiltert wird die GRUNDMENGE, gemeinsam mit dem Demo-Ausschluss.
  async aiCheckCoverageSummary(opts: {
    sichtbar: (ko: KnowledgeObject) => boolean;
  }): Promise<AiCheckCoverageSummary> {
    const all = (await this.list({})).filter((ko) => !ko.demoSeed && opts.sichtbar(ko));
    let incomplete = 0;
    let unchecked = 0;
    let noCoverage = 0;
    for (const ko of all) {
      const aiCheck = ko.aiCheck;
      // 1. Gar kein Vermerk — über dieses Objekt sagt kein Lauf etwas. Die EINZIGE Lage, in der
      //    „gar kein Lauf" wörtlich stimmt (A4).
      if (!aiCheck) {
        unchecked += 1;
        continue;
      }
      // 2. AUFTRAG-mega31 A2: der LAUFSTATUS wird ausgewertet — er wurde bisher gar nicht gelesen.
      //    `failed` ist immer unvollständig, ohne Ausnahme und unabhängig davon, welche Merker die
      //    Abdeckung trägt (bens ROT-2: ein gescheiterter Lauf mit makellosem Protokoll galt als
      //    vollständig). `pending` ist nicht abgeschlossen und damit erst recht nicht vollständig.
      if (aiCheck.status !== "done") {
        incomplete += 1;
        continue;
      }
      // 3. A4: abgeschlossen gemeldet, aber ohne Abdeckungsprotokoll (Altbestand von vor mega28).
      //    Ein Lauf ist nachweisbar, seine Reichweite nicht — eigener Zähler, eigener Satz.
      if (!aiCheck.coverage) {
        noCoverage += 1;
        continue;
      }
      // 4. AUFTRAG-mega32 A1 (bens GELB-1): ein Protokoll, das die Vollständigkeit nicht POSITIV
      //    belegt. Hier stand bis mega31 eine dritte, eigene Auslegung von „vollständig" — drei
      //    Merker, ausgeschrieben mitten in dieser Schleife. Ein Datensatz mit
      //    `completed < attempted` bei sauberen Merkern lief damit als vollständig durch. Diese
      //    Zusammenfassung entscheidet die Frage jetzt NICHT mehr selbst, sondern fragt die eine
      //    benannte Invariante (coverage-complete.ts, Spiegel von conflicts/src/coverage.ts).
      if (!isCompleteAiCheckCoverage(aiCheck.coverage)) {
        incomplete += 1;
      }
    }
    return { total: all.length, incomplete, unchecked, noCoverage };
  }

  // WP-SHIP8-CLOSE-4 (bens ROT-1A/1C): Anker-Suche des Import-Accepts — BEWUSST INKLUSIVE
  // Papierkorb (einzige Trash-durchlässige Lesefläche neben den Trash-Views): die Claim-Recovery
  // und der Insert-or-Adopt-Pfad müssen ein bereits erzeugtes KO auch dann finden, wenn der
  // D-CLEAN es zwischenzeitlich getrasht hat — sonst entstünde beim Retry ein Doppel-KO.
  async findByImportCandidateId(candidateId: string): Promise<KnowledgeObject | undefined> {
    return (await this.repo.list({})).find((k) => k.importCandidateId === candidateId);
  }

  // WP-BILD-1g (bens sammel14-ROT): Suchpfad-Sicht OHNE bodyHtml — die Bibliotheks-Suche arbeitet
  // über title/statement/captionTexts; die Projektion passiert an der Datenquelle (Repo).
  //
  // AUFTRAG-BASIC-380: der optionale Sicherheitstrim reist DURCH bis in die Datenquelle. Ist er
  // gesetzt, hat die Datenbank Papierkorb UND Sichtbarkeit bereits angewandt — vor jedem Deckel.
  //
  // DER NODE-SEITIGE PAPIERKORBFILTER BLEIBT STEHEN, und das ist kein Versehen. Er bedient
  // weiterhin JEDEN Aufrufer OHNE Trim (Projektionsbau, Analytics, Themen) unverändert; mit Trim
  // ist er ein No-op, weil die Datenbank dieselben Zeilen schon ausgeschlossen hat. Er ist ab hier
  // die zweite Linie und nicht mehr die einzige — genau die Richtung, die BASIC 379 §1.2 verlangt.
  async listForSearch(
    filter: KoFilter = {},
    trim?: KoSichtbarkeitstrim,
  ): Promise<KnowledgeObject[]> {
    return (await this.repo.listForSearch(filter, trim)).filter((k) => !k.deletedAt);
  }

  // WP-BILD-1g/1h: EINMALIGER Legacy-Backfill des abgeleiteten captionTexts-Suchfelds. Lädt das
  // eine KO voll (nur für diesen Rest-Bestand), extrahiert body-sparend + GEDECKELT
  // (searchCaptionTexts) und persistiert über den schmalen Nur-wenn-fehlt-Repo-Write (kein
  // Versions-Bump, kein Audit). WP-BILD-1h (bens sammel15-ROT 2): SINGLE-FLIGHT pro KO-Id
  // prozessweit — parallele Suchen laden denselben Legacy-KO nicht mehrfach; der Eintrag wird
  // IMMER (finally) abgeräumt, damit ein Fehlschlag später erneut versucht werden kann.
  // ==============================================================================================
  // G27 — EIN NACHZUG, EINE VOLLLADUNG.
  // ==============================================================================================
  //
  // Vor G27 gab es EIN abgeleitetes Suchfeld (captionTexts) und einen Backfill dafür. Jetzt gibt es
  // ZWEI abgeleitete Artefakte am selben Objekt (captionTexts + Suchprojektion) — und beide
  // brauchen dieselbe teure Zutat: das VOLLE bodyHtml. Sie getrennt nachzuziehen hieße, ein
  // Legacy-Objekt mit megabyte-großen Bilddaten ZWEIMAL je Suchanfrage zu laden. Deshalb ist dies
  // EIN Nachzug: eine Vollladung, ALLE Ableitungen, ein Single-Flight-Eintrag. Seit S1/S2 sind es
  // drei: captionTexts, Immutable Content Projection (ggf. auf Fassung 2 nachgeführt) und Mutable
  // Metadata Projection.
  private readonly searchBackfillsInFlight = new Map<string, Promise<SearchArtifacts>>();

  private async ensureSearchArtifacts(id: string): Promise<SearchArtifacts> {
    const inFlight = this.searchBackfillsInFlight.get(id);
    if (inFlight) {
      return inFlight;
    }
    const run = (async (): Promise<SearchArtifacts> => {
      const ko = await this.repo.findById(id);
      if (!ko || ko.deletedAt) {
        return { captionTexts: [], projection: undefined, v2Migriert: false };
      }
      const at = new Date(this.now()).toISOString();
      // 1) Die Inhaltsprojektion der AKTIVEN Version — append-only, also ein No-op, wenn sie in der
      //    geltenden Fassung steht.
      let projection = await this.searchProjections.find(ko.id, ko.version);
      let v2Migriert = false;
      if (!projection) {
        // Kein unveränderlicher Versionsstand? Dann ist der Klassifizierungswert eine BESTVERFÜGBARE
        // Rekonstruktion und wird ausdrücklich als solche gekennzeichnet (Abschnitt I) — nie als
        // bestätigte Geschichte, nie als Grundlage einer Freigabe.
        const frisch = buildSearchProjection(ko, at, {
          classification: await this.classificationForRebuild(ko, undefined),
        });
        const geschrieben = await this.searchProjections.insert(frisch);
        // Race mit einem nebenläufigen Schreiber: die andere Zeile gewinnt (append-only), und wir
        // liefern SIE — nicht unsere verworfene Fassung.
        projection = geschrieben
          ? frisch
          : ((await this.searchProjections.find(ko.id, ko.version)) ?? frisch);
      } else if (projection.projectionVersion !== SEARCH_PROJECTION_VERSION) {
        // FASSUNGSNACHFÜHRUNG (Detailentscheidung D): eine Zeile der Fassung 1 ist semantisch
        // inkompatibel — sie führt Kategorie/Schlagwörter im Inhalt, kennt kein `body_text` und
        // keine Klassifizierungsreferenz. Sie wird deshalb AUSDRÜCKLICH ersetzt, nicht still
        // weiterbenutzt. Betroffen ist ausschließlich die AKTIVE Version; historische Zeilen bleiben
        // unangetastet (kein stilles Überschreiben alter Content-Projections).
        const frisch = buildSearchProjection(ko, at, {
          classification: await this.classificationForRebuild(ko, projection),
        });
        await this.searchProjections.replace({ ...frisch, createdAt: projection.createdAt });
        projection = frisch;
        v2Migriert = true;
      }
      // 2) Die veränderliche Metadatenprojektion — idempotent, klettert nur bei echter Änderung.
      await this.projectMetadata(ko, at);
      // 3) WP-BILD-1g/1h: das abgeleitete captionTexts-Feld (unverändertes Verhalten).
      if (ko.captionTexts) {
        return { captionTexts: ko.captionTexts, projection, v2Migriert };
      }
      const captionTexts = searchCaptionTexts(ko.bodyHtml);
      const inserted = await this.repo.setCaptionTexts(id, captionTexts);
      if (!inserted) {
        // WP-D11b (bens patches53-GELB): Race — ein nebenläufiger Voll-Write (revise/create) hat
        // das Feld zwischen unserem Read und dem bedingten Write gesetzt. Die AKTUELLEN Werte
        // nachladen (ein schmaler Einzel-KO-Read) und DIESE an die laufende Suche geben — nie den
        // alten Scan, der die frischeren Fußnoten verfehlen würde.
        const fresh = await this.repo.findById(id);
        return { captionTexts: fresh?.captionTexts ?? captionTexts, projection, v2Migriert };
      }
      return { captionTexts, projection, v2Migriert };
    })().finally(() => {
      this.searchBackfillsInFlight.delete(id);
    });
    this.searchBackfillsInFlight.set(id, run);
    return run;
  }

  async ensureCaptionTexts(id: string): Promise<string[]> {
    return (await this.ensureSearchArtifacts(id)).captionTexts;
  }

  // WP-SUBMIT-ASYNC (Pedis R3 21.07.): Hintergrund-Prüf-Status. markAiCheckPending vermerkt den
  // Job (Submit/Retry/Lazy-Re-Enqueue; requestedAt optional injizierbar — Re-Enqueue-Logik und
  // Tests nutzen das); resolveAiCheck schließt ihn BEDINGT ab (nur solange noch pending —
  // CAS-schonend über den Repo-Feld-Patch, ein nebenläufiger revise verliert nie Daten). Bewusst
  // ohne Versions-/Audit-Pfad: reiner Job-Status, kein Wissensinhalt.
  // WP-SHIP8-FINAL (bens Bedingung 2): der pending-Vermerk trägt die aktuelle INHALTSVERSION —
  // der Hintergrund-Job ist damit hart an sie gebunden (der Abschluss prüft sie bedingt).
  async markAiCheckPending(id: string, requestedAt?: string): Promise<boolean> {
    const ko = await this.repo.findById(id);
    if (!ko || ko.deletedAt) {
      return false;
    }
    return this.repo.setAiCheck(id, {
      status: "pending",
      requestedAt: requestedAt ?? new Date(this.now()).toISOString(),
      koVersion: ko.version,
    });
  }

  // AUFTRAG-mega28 A2: die Abdeckung des Laufs (gedeckelt/übersprungen/abgebrochen) reist mit dem
  // Abschluss mit — additiv, der bedingte Feld-Patch bleibt unverändert schmal.
  async resolveAiCheck(
    id: string,
    outcome: { ok: boolean; fallbackReason?: string; coverage?: AiCheckCoverage },
    expectedKoVersion?: number,
  ): Promise<boolean> {
    return this.repo.resolveAiCheck(
      id,
      {
        status: outcome.ok ? "done" : "failed",
        finishedAt: new Date(this.now()).toISOString(),
        ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
        ...(outcome.coverage ? { coverage: outcome.coverage } : {}),
      },
      expectedKoVersion,
    );
  }

  // SCRUM-361 / AG-03: begrenzte, datenquellennahe Kandidatenabfrage für Ask (kein All-Pool-Load).
  //
  // ==============================================================================================
  // G27 — DIESE ABFRAGE LÄUFT JETZT ÜBER DIE SUCHPROJEKTION.
  // ==============================================================================================
  //
  // Vorher: `repo.findCandidates` — ILIKE über Titel, Aussage, Kategorie, Schlagwörter und
  // Bild-Fußnoten. Der Dokumentinhalt (`bodyHtml`) war KEIN Suchraum, also konnte Klara ihn nicht
  // finden; ein Begriff hinter Zeichen 500 der Aussage existierte für sie nicht.
  //
  // Jetzt: derselbe gemeinsame Suchvertrag, den auch die Bibliothek benutzt (`findSearchHits` →
  // Projektion der AKTIVEN KO-Version). Alles, was vorher auffindbar war, ist es weiterhin — die
  // Projektion enthält Titel, Aussage, Kategorie, Schlagwörter und Fußnoten unverändert — und der
  // sichtbare Dokumenttext kommt hinzu.
  //
  // Zwei Schritte, bewusst getrennt: die Projektion liefert eine schmale, gedeckelte ID-Liste
  // (kein Textinhalt über den Draht), erst danach werden GENAU diese Objekte body-frei geladen.
  // Die Reihenfolge der Trefferliste (validiert zuerst, dann Trust) bleibt erhalten; die feine
  // Relevanz-/Top-K-Auswahl macht weiterhin der Reasoner (`selectCandidates`).
  async findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
    // G27 R1 (04 §5): HIER STAND DER GEDECKELTE NACHZUG — er ist ersatzlos entfallen.
    //
    // Er war der Grund, warum BENs Mischbetrieb überhaupt entstehen konnte: er machte den Bestand
    // in Schwüngen von 20 fertig, ließ alles dahinter in Fassung 1 liegen und die Suche lief
    // unmittelbar danach darüber. Damit hing das Suchergebnis an der Bestandsreihenfolge und an der
    // Zahl vorheriger Kandidaten — genau die funktionale Abhängigkeit, die §5 untersagt.
    //
    // Vollständigkeit ist jetzt Sache des Gates: eine Instanz, die sucht, ist freigegeben, und eine
    // freigegebene Instanz ist vollständig projiziert. Ist sie es nicht, wirft die Suche — sie
    // liefert keine von der Reihenfolge abhängige Teilmenge.
    const hits = await this.findSearchHits({ terms: query.terms, limit: query.limit });
    if (hits.length === 0) {
      return [];
    }
    const rang = new Map(hits.map((hit, index) => [hit.koId, index]));
    const kos = await this.repo.listByIds(hits.map((hit) => hit.koId));
    return kos
      .filter((ko) => !ko.deletedAt)
      .sort((a, b) => (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0));
  }

  // ---- SCRUM-422: Papierkorb -----------------------------------------------------------

  // Ablauf-Zeitpunkt der Endlöschung eines getrashten KO.
  private trashExpiry(deletedAt: string): number {
    return Date.parse(deletedAt) + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  }

  // SCRUM-523 P.3 (WP1-Batch3): DER EINZIGE harte Löschpunkt eines KO. JEDER harte Löschweg —
  // Trash-Sweep (abgelaufen), manueller Papierkorb-Purge, delete({hard}) und der Demo-Purge — läuft
  // AUSSCHLIESSLICH hierüber. `this.repo.delete` wird im ganzen Modul nur an DIESER Stelle gerufen (Grep-
  // Beleg im Bericht) → kein Aufrufer kann die Aufräum-Kaskade mehr umgehen.
  //
  // ZWEI GETRENNTE FENSTER, ZWEI GETRENNTE LÖSUNGEN:
  //   (A) Cleanup (Konflikte/Überschneidungen, Embedding) vs. Delete+Audit — bleibt BEWUSST
  //       sequentiell/best-effort (kein echter Tx-Handle durch conflicts/overlaps/embedding gefädelt).
  //       Das ist UNKRITISCH, weil dieses Fenster SELBSTHEILEND ist: schlägt das Cleanup fehl, wird
  //       NICHT gelöscht (das KO existiert unverändert weiter) — ein erneuter Purge-Versuch (Sweep-
  //       Retry, erneuter manueller Purge) wiederholt einfach den ganzen Ablauf inkl. Cleanup, bis er
  //       vollständig gelingt. Gelingt das Cleanup, aber der DANACH folgende Delete+Audit-Block
  //       scheitert (s. (B)), bleibt ebenfalls nur ein unverändertes, weiterhin existierendes KO mit
  //       bereits geschlossenen Folgeartefakten zurück — kein Geist, erneuter Purge räumt idempotent
  //       auf. Diese Selbstheilung ist NICHT das Integritätsproblem, das dieser WP löst.
  //   (B) repo.delete + audit.record — DAS ist das Integritätsproblem: ein KO, das WIRKLICH weg ist,
  //       darf NIE ohne begleitenden ko.purged-Beleg sein (FR-AUD-02) — UND umgekehrt darf NIE ein
  //       ko.purged-Beleg für ein KO existieren, das in Wahrheit (Delete danach gescheitert) noch da
  //       ist (externe Review, SCRUM-523 P.3 WP-A2: das reine „Audit vor Delete" aus WP-A schloss nur
  //       die ERSTE Richtung — die Umkehr-Lücke blieb ein Log, das eine Löschung behauptet, die nicht
  //       stattfand). Diese zwei Schreiber sitzen in zwei verschiedenen Modulen (knowledge-object,
  //       audit) mit je eigener, storage-agnostischer Schnittstelle (KoRepo, AuditRepo/AuditService)
  //       — die auch eine InMemory-Implementierung erfüllen muss. Die Lösung ist NICHT, Pg-Wissen in
  //       diese Schnittstellen zu tragen, sondern ein eigenes, schmales Kernel-Modul (services/db-tx),
  //       das einen OPAKEN TxContext definiert: beide Interfaces bekommen additiv einen optionalen
  //       `tx?: TxContext`-Parameter, den nur die Pg-Adapter (PgKoRepo, PgAuditRepo) auflösen — der
  //       Vertrag selbst bleibt storage-neutral. `this.withTx` (von der Kompositionswurzel injiziert,
  //       s. WithTx oben) öffnet EINE echte Postgres-Transaktion und reicht denselben tx an BEIDE
  //       Schreiber durch: entweder committen beide, oder (bei einem Fehler in EINEM der beiden) rollen
  //       BEIDE zurück — kein Teilzustand in IRGENDEINE Richtung. Ohne Injektion (Tests, InMemory,
  //       Dev-Journal-Persistenz — kein echter Pg-Pool verdrahtet) bleibt der bisherige sequentielle
  //       Bestpfad aus WP-A (Audit vor Delete): dort ist er kein Kompromiss, sondern angemessen, weil
  //       zwei synchrone In-Process-Schritte ohne echtes I/O-Fenster praktisch nicht so „crashen"
  //       können, dass der eine committet und der andere nicht (anders als bei zwei echten DB-Writes).
  private async purgeKo(
    id: string,
    actor: string,
    reason: "trash-expired" | "manual" | "hard",
    extraPayload: Record<string, unknown> = {},
  ): Promise<void> {
    // 1) Cleanup ZUERST — schlägt es fehl, bleibt das KO bestehen (kein Delete, kein Audit). S. (A) oben.
    await this.onPurge?.(id, actor);
    const auditInput = {
      actor,
      action: "ko.purged" as const,
      target: id,
      payload: { reason, ...extraPayload },
    };
    const audit = this.audit;
    // 2) Delete + Audit — s. (B) oben. MIT withTx: EINE echte DB-Transaktion, beide Schreiber
    // committen/rollbacken gemeinsam. OHNE withTx: sequentieller Fallback (Audit vor Delete, WP-A).
    if (this.withTx && audit) {
      await this.withTx(async (tx) => {
        await this.repo.delete(id, tx);
        await audit.record(auditInput, tx);
      });
      // G27: der abgeleitete Suchindex folgt der Endlöschung. NACH dem Commit und bewusst
      // fehlertolerant: das Objekt ist weg, die Standardsuche kann eine verwaiste Zeile ohnehin
      // nicht mehr zeigen (der JOIN auf `kos` trägt sie nicht) — ein Fehler hier darf einen
      // vollzogenen, belegten Purge nicht nachträglich zum Scheitern bringen.
      await this.searchProjections.removeByKo(id).catch(() => undefined);
      return;
    }
    await audit?.record(auditInput);
    await this.repo.delete(id);
    await this.searchProjections.removeByKo(id).catch(() => undefined);
  }

  // SCRUM-523 P.3 (WP2): Endlöschung abgelaufener Papierkorb-Einträge — jetzt eine EXPLIZITE Operation
  // (kein Lazy-Sweep beim Lesen mehr). Der Aufrufer (Server-Start / Admin / Scheduler) triggert sie;
  // reine Leseoperationen tun das NIE. Läuft über den zentralen purgeKo-Vertrag (inkl. Aufräum-Kaskade).
  // Gibt die Zahl der endgültig gelöschten KOs zurück.
  // SCRUM-523 P.3 (WP1-Batch3): idempotent — verarbeitet NUR wirklich abgelaufene Trash-Einträge, sodass
  // ein (auch periodischer) Lauf keine laufende Anzeige inkonsistent macht. Ein Cleanup-/Purge-Fehler an
  // EINEM KO bricht den Lauf NICHT ab (never block): das KO bleibt bestehen (Rollback), der Rest wird
  // weiter aufgeräumt; der Fehler geht an den optionalen onSweepError-Callback (ehrliches Log statt still).
  async runTrashSweep(
    actor = "system",
    onSweepError?: (id: string, error: unknown) => void,
  ): Promise<number> {
    const nowMs = this.now();
    let purged = 0;
    for (const ko of await this.repo.list({})) {
      if (ko.deletedAt && this.trashExpiry(ko.deletedAt) <= nowMs) {
        try {
          await this.purgeKo(ko.id, actor, "trash-expired", { deletedAt: ko.deletedAt });
          purged++;
        } catch (err) {
          onSweepError?.(ko.id, err);
        }
      }
    }
    return purged;
  }

  // Papierkorb-Ansicht (Admin): nur Metadaten, jüngste Löschung zuerst.
  // SCRUM-523 P.3 (WP2): reine Leseansicht — löst KEINE Endlöschung mehr aus. Abgelaufene Einträge sind
  // an ihrem `expiresAt` (Vergangenheit) ehrlich erkennbar, bis ein expliziter runTrashSweep sie entfernt.
  async trashed(): Promise<TrashedKo[]> {
    const all = await this.repo.list({});
    return all
      .filter((k): k is KnowledgeObject & { deletedAt: string } => Boolean(k.deletedAt))
      .map((k) => ({
        id: k.id,
        title: k.title,
        category: k.category,
        deletedAt: k.deletedAt,
        deletedBy: k.deletedBy ?? "system",
        expiresAt: new Date(this.trashExpiry(k.deletedAt)).toISOString(),
      }))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  // WP-SHIP8-FINAL (bens Bedingung 5): die Provenienz-Anker (provider+externalId) der KOs im
  // PAPIERKORB — schmaler Lesepfad für Idempotenz-Prüfungen (Beispiel-Loader): ein getrashtes
  // Beispiel darf beim erneuten Laden KEIN Duplikat erzeugen, sondern wird ehrlich als
  // „im Papierkorb" ausgewiesen. Bewusst nur Anker-Felder, keine Inhalte.
  async trashedSourceAnchors(): Promise<
    { koId: string; provider: string | null; externalId: string }[]
  > {
    const all = await this.repo.list({});
    const anchors: { koId: string; provider: string | null; externalId: string }[] = [];
    for (const ko of all) {
      if (!ko.deletedAt) {
        continue;
      }
      for (const source of ko.sources ?? []) {
        if (source.externalId) {
          anchors.push({
            koId: ko.id,
            provider: source.provider ?? null,
            externalId: source.externalId,
          });
        }
      }
    }
    return anchors;
  }

  // Wiederherstellen aus dem Papierkorb — Historie/Versionen/Trust bleiben unangetastet.
  async restore(id: string, actor = "system"): Promise<KnowledgeObject> {
    const ko = await this.repo.findById(id);
    if (!ko?.deletedAt) {
      throw new KoError("NOT_FOUND", "Wissensobjekt nicht im Papierkorb.");
    }
    const { deletedAt: _at, deletedBy: _by, ...restored } = ko;
    await this.repo.update(restored as KnowledgeObject);
    await this.audit?.record({ actor, action: "ko.restored", target: id });
    return restored as KnowledgeObject;
  }

  // Sofortige Endlöschung EINES Papierkorb-Eintrags (Admin-Entscheidung).
  // SCRUM-523 P.3 (WP2): läuft über den zentralen purgeKo-Vertrag — dieselbe Aufräum-Kaskade wie der
  // automatische Sweep (keine getrennte Löschmechanik mehr, kein Cleanup-Bypass).
  async purgeTrashed(id: string, actor = "system"): Promise<void> {
    const ko = await this.repo.findById(id);
    if (!ko?.deletedAt) {
      throw new KoError("NOT_FOUND", "Wissensobjekt nicht im Papierkorb.");
    }
    await this.purgeKo(id, actor, "manual", { manual: true });
  }

  // SCRUM-161: read-only Zugriff auf die in SCRUM-159 persistierten Voll-Snapshots.
  // Ohne Versions-Repo liefert der Service einen ehrlichen Leerzustand.
  async versionsOf(id: string) {
    await this.require(id);
    return this.versions?.listByKo(id) ?? [];
  }

  // SCRUM-160: minimaler read-only Zugriff für Service-Vertrag/Tests. UI bleibt außerhalb Scope.
  async evidenceOf(id: string) {
    await this.require(id);
    return this.evidence?.listByKo(id) ?? [];
  }

  // SCRUM-169: KO-übergreifender read-only Evidence-Index (QM/Stufe 2). Nur Metadaten —
  // keine Object-Rohdaten, kein Laden externer Inhalte. Limit defensiv normalisiert.
  async recentEvidence(limit?: number): Promise<EvidenceRecord[]> {
    return this.evidence?.recent(normalizeEvidenceLimit(limit)) ?? [];
  }

  // FR-KO-04: Überarbeiten erhöht Version, setzt Bewertungen zurück, erzeugt History-Eintrag.
  async revise(id: string, changes: ReviseKoInput, author: string): Promise<KnowledgeObject> {
    if (changes.type && !KNOWLEDGE_TYPES.includes(changes.type)) {
      throw new KoError("INVALID_TYPE", "Unbekannte Wissensart.");
    }
    // SCRUM-507 R2/R3: die Revision läuft transaktional über mutateKoTx — per-KO serialisiert
    // (withKoLock, atomar gegen eine nebenläufige Bewertung, die denselben Lock + CAS nutzt) UND mit
    // vollständigem Rollback: schlägt der Versions-Snapshot ODER der Audit NACH der Persistenz fehl, wird
    // der KO (inkl. Versions-Bump/Reset auf „offen"/Trust 0) kompensierend zurückgerollt und ein bereits
    // geschriebener Snapshot entfernt — kein Teilzustand, keine unauditierte Änderung. Die Bewertungen
    // werden NICHT gelöscht: sie tragen ihre koVersion und sind ab der neuen Version implizit „stale".
    return this.mutateKoTx(id, (ko) => {
      const version = ko.version + 1;
      const at = new Date(this.now()).toISOString();
      // KW-STR: neuer Body wird sanitisiert; statement ggf. daraus abgeleitet.
      const nextBody =
        changes.bodyHtml !== undefined ? cleanBody(changes.bodyHtml) : (ko.bodyHtml ?? null);
      const nextStatement =
        changes.statement ??
        (changes.bodyHtml !== undefined && nextBody ? htmlToPlainText(nextBody) : ko.statement);
      const revised: KnowledgeObject = {
        ...ko,
        title: changes.title ?? ko.title,
        statement: nextStatement,
        bodyHtml: nextBody,
        // WP-BILD-1g: Fußnoten-Suchfeld beim Überarbeiten mitführen — eine Caption-Änderung im
        // Editor aktualisiert das Feld; unveränderte Bodies backfillen Legacy-KOs nebenbei.
        captionTexts: searchCaptionTexts(nextBody),
        type: changes.type ?? ko.type,
        conditions: changes.conditions ?? ko.conditions,
        measures: changes.measures ?? ko.measures,
        version,
        trust: 0, // Bewertungen der Vorversion zählen nicht mehr (versionsgebunden, R2)
        status: "offen", // muss neu validiert werden
        history: [...ko.history, { version, at, author, note: "überarbeitet" }],
        // SCRUM-129: Quellen über Revisionen erhalten; SCRUM-470: optional fortschreiben (Re-Sync-Anker).
        // SCRUM-527 (WP2): Allowlist auf jede Quell-URL — säubert auch Altbestand beim nächsten Revise.
        sources: sanitizeSources(changes.sources ?? ko.sources ?? []),
      };
      return {
        updated: revised,
        value: revised,
        // SCRUM-159: neuen Versions-Snapshot persistieren; frühere Versionen bleiben unverändert.
        snapshot: { author, note: "überarbeitet" },
        audit: async () => {
          await this.audit?.record({
            actor: author,
            action: "ko.revised",
            target: id,
            payload: { version },
          });
        },
      };
    });
  }

  /**
   * AUFTRAG-mega19 Block A — DER REPLAY-NACHSCHLAG ALS EIGENE, SCHREIBFREIE ABFRAGE.
   *
   * WARUM ES DIESE METHODE GIBT. `appendDocumentExtract` ist idempotent, aber sein Nachschlag
   * liegt am ENDE einer Kette: die Route prüft davor Kapazität (Anhangzahl, Objektgröße) und die
   * externe Stufe. Beides sind VERÄNDERLICHE Tatsachen. Genau daran ist die Wiederholbarkeit
   * zerbrochen: der erste Aufruf füllt den letzten Anhangplatz und committet, seine Antwort geht
   * verloren, und der identische Retry scheitert an „Maximal N Anhänge" — BEVOR irgendwer die
   * bekannte Kennung gesehen hat. Der Client las den 400 als eindeutige Ablehnung und hielt
   * seinen lokalen Stand für den gültigen; ein anschließendes Speichern überschrieb den bereits
   * committeten Inhalt. Die Idempotenz-Zusage war also nicht falsch, sondern unerreichbar.
   *
   * DIE FORM DER LÖSUNG. Der Nachschlag wird VORGEZOGEN, nicht die Gates gelockert. Diese Methode
   * antwortet auf genau eine Frage — „ist dieser Vorgang an diesem Objekt schon abgeschlossen?" —
   * und sie SCHREIBT NICHTS. Findet sie nichts, liefert sie `null` und der Aufrufer läuft den
   * vollen, ungekürzten Weg durch ALLE Tore. Damit ist keine Ausführung ohne Prüfung erreichbar:
   * es gibt keinen Zustand, in dem ein Aufrufer die Kapazitäts- oder Stufenprüfung überspringt und
   * trotzdem etwas Neues entsteht.
   *
   * WARUM UNTER DEM LOCK. Derselbe per-KO-Lock wie der Vollzug: ein Nachschlag, der neben einem
   * laufenden Commit desselben Vorgangs liest, würde sonst ein „noch nicht da" melden, das im
   * nächsten Moment falsch ist — und der Aufrufer liefe in eine zweite Ausführung. Prozess-
   * übergreifende Gleichzeitigkeit bleibt (wie in mega18 benannt) Nach-VIP-2; innerhalb des
   * Prozesses ist die Antwort hier exakt.
   *
   * WAS SIE NICHT PREISGIBT. Nur das AUFGEZEICHNETE Ergebnis des eigenen Vorgangs plus das Objekt,
   * das der Aufrufer ohnehin gerade gelesen hat. Kein Bestand fremder Vorgänge, keine Liste, keine
   * Existenzaussage über andere Kennungen (eine unbekannte Kennung ist schlicht `null`).
   */
  async lookupDocumentAppend(
    id: string,
    operationId: string,
  ): Promise<DocumentAppendCommit | null> {
    // Formprüfung der Kennung ZUERST und mit demselben Vertrag wie der Vollzug: eine ungültige
    // Kennung ist ein ehrlicher Formfehler, kein „nicht gefunden".
    const key = normalizeAppendOperationId(operationId);
    return this.withKoLock(id, async () => {
      const current = await this.require(id);
      const known = (current.appendOps ?? []).find((op) => op.id === key);
      if (!known) {
        return null;
      }
      return {
        committed: true,
        operationId: key,
        replayed: true,
        koVersion: known.koVersion,
        attachmentId: known.attachmentId,
        sourceIds: [...known.sourceIds],
        ko: current,
      } satisfies DocumentAppendCommit;
    });
  }

  /**
   * AUFTRAG-mega18 Block A-1 — die Verbund-Operation. Vertrag und Begründung stehen oben bei
   * `DocumentAppendInput`; hier ist nur noch der Vollzug.
   *
   * Der Aufrufer (services/app/src/routes/ko-routes.ts) hat VORHER entschieden: Rechte geprüft,
   * die externe Stufe durchgesetzt (attach-policy.ts, unverändert) und das Ankerobjekt im
   * Objektspeicher nachgeschlagen. Diese Methode bekommt GEPRÜFTE FAKTEN und trifft keine
   * Policy-Entscheidung nach — mit der einen Ausnahme, die ihre eigene ist: die interne
   * Belegpflicht (A-2). Genau die Aufteilung, die ben beschrieben hat, und der Grund, warum die
   * Sicherheitsgrenze dafür nicht gelockert werden muss.
   */
  async appendDocumentExtract(
    id: string,
    author: string,
    input: DocumentAppendInput,
  ): Promise<DocumentAppendCommit> {
    // Alle Eingangsprüfungen VOR dem Lock — sie brauchen das Objekt nicht und sollen es nicht
    // blockieren. Reihenfolge mit Absicht: der Vorgangsschlüssel zuerst (ohne ihn ist der Aufruf
    // nicht wiederholbar und damit nicht sicher ausführbar), dann die Belegpflicht.
    const operationId = normalizeAppendOperationId(input.operationId);
    // A-2: WIRFT ohne echten Anker — auf jeder Stufe, ohne die Stufe zu kennen.
    const anchorObjectId = requireDocumentEvidence({ anchorObjectId: input.anchor?.objectId });
    const anchor = input.anchor;
    if (!anchor) {
      // Unerreichbar (requireDocumentEvidence hat schon geworfen); steht hier für die Verengung
      // des Typs, damit unten kein `!` nötig ist.
      throw new KoError("MISSING_DOCUMENT_ANCHOR", "Kein Originaldokument als Beleg.");
    }
    if (input.sources.length === 0) {
      // Eine Übernahme OHNE Belegstelle wäre genau der Zustand, den dieser Auftrag verbietet —
      // Inhalt ohne Herkunft, nur eben mit leerer Liste statt fehlgeschlagener Schreibvorgänge.
      throw new KoError(
        "INVALID_SOURCE",
        "Übernahme ohne Belegstelle — kein Inhalt ohne Herkunft.",
      );
    }
    const labels = input.sources.map((s) => (typeof s.label === "string" ? s.label.trim() : ""));
    if (labels.some((label) => label.length === 0)) {
      throw new KoError("INVALID_SOURCE", "Quellen-Label fehlt.");
    }

    return this.withKoLock(id, async () => {
      const before = await this.require(id);

      // ---- IDEMPOTENZ ----------------------------------------------------------------------
      // Der Nachschlag liegt INNERHALB des Locks und arbeitet auf dem FRISCH gelesenen Objekt:
      // damit kann zwischen „ist dieser Vorgang schon durch?" und dem Vollzug nichts dazwischen
      // geraten. Ein bereits abgeschlossener Vorgang liefert sein AUFGEZEICHNETES Ergebnis
      // zurück — kein zweiter Anhang, keine doppelten Quellen, keine zweite Revision.
      const known = (before.appendOps ?? []).find((op) => op.id === operationId);
      if (known) {
        return {
          committed: true,
          operationId,
          replayed: true,
          koVersion: known.koVersion,
          attachmentId: known.attachmentId,
          sourceIds: [...known.sourceIds],
          ko: before,
        } satisfies DocumentAppendCommit;
      }

      const at = new Date(this.now()).toISOString();

      // ---- 1. ANKER SICHERN ----------------------------------------------------------------
      // Das Originaldokument wird Anhang DIESES Objekts. Ab hier ist der Anker keine Behauptung
      // mehr: dieselbe Operation, die den Inhalt schreibt, bindet auch das Dokument.
      const attachment: KoAttachment = {
        id: this.genId(),
        name: anchor.name,
        mime: anchor.mime,
        author,
        at,
        objectId: anchorObjectId,
        ...(anchor.thumbnail ? { thumbnail: anchor.thumbnail } : {}),
        ...(anchor.size !== undefined ? { size: anchor.size } : {}),
      };

      // ---- 2. BELEGE VOLLSTÄNDIG ------------------------------------------------------------
      // „Seriell und vollständig" heißt hier: alle Belegstellen entstehen gemeinsam, bevor
      // irgendetwas persistiert wird. Ein Teilbestand ist nicht darstellbar. Dieselben Regeln wie
      // `addSource`: Stufe 2, nie peer-validiert, URL durch die Persistenz-Allowlist.
      const sources: KoSource[] = input.sources.map((source, index) => {
        const provider = source.provider?.trim() ? source.provider.trim() : null;
        return {
          id: this.genId(),
          label: labels[index] as string,
          url: safeSourceUrl(source.url),
          excerpt: source.excerpt?.trim() ? source.excerpt.trim() : null,
          kind: "external",
          peerValidated: false,
          ...(provider ? { provider } : {}),
          author,
          at,
        };
      });

      // ---- 3. ERST DANACH DER INHALT --------------------------------------------------------
      // Ohne `changes` (Erfassen): kein Versions-Bump, kein Status-Reset, kein Snapshot — der
      // Inhalt kam mit `create` und ist bereits committet; diese Operation bindet nur die Herkunft.
      const revises = input.changes !== undefined;
      const version = revises ? before.version + 1 : before.version;
      const op: KoAppendOp = {
        id: operationId,
        at,
        koVersion: version,
        attachmentId: attachment.id,
        sourceIds: sources.map((s) => s.id),
      };
      let committed: KnowledgeObject = {
        ...before,
        attachments: [...(before.attachments ?? []), attachment],
        // SCRUM-527: dieselbe Allowlist über die ganze Liste wie in `revise` — säubert nebenbei
        // Altbestand, ohne Label/Auszug/Provider anzutasten.
        sources: sanitizeSources([...(before.sources ?? []), ...sources]),
        appendOps: rememberAppendOp(before.appendOps, op),
      };
      if (input.changes) {
        const nextBody = cleanBody(input.changes.bodyHtml);
        committed = {
          ...committed,
          title: input.changes.title ?? before.title,
          statement:
            input.changes.statement ?? (nextBody ? htmlToPlainText(nextBody) : before.statement),
          bodyHtml: nextBody,
          captionTexts: searchCaptionTexts(nextBody),
          version,
          trust: 0, // Revisions-Semantik unverändert: Bewertungen der Vorversion zählen nicht mehr.
          status: "offen", // muss neu validiert werden
          history: [
            ...before.history,
            // Die Historie benennt den Vorgang, nicht bloß „überarbeitet" — wer später fragt,
            // warum diese Version entstand, findet hier die Antwort statt sie zu rekonstruieren.
            { version, at, author, note: "überarbeitet (Dokumentinhalt übernommen)" },
          ],
        };
      }

      // ---- DER COMMIT: GENAU EIN SCHREIBVORGANG ---------------------------------------------
      // Compare-and-Set auf rowVersion (repo.update). Es gibt keinen zweiten Write in dieser
      // Operation, gegen den ein erster verlieren könnte — das ist die strukturelle Antwort auf
      // den parallelen CAS. Ab der nächsten Zeile GILT das Ergebnis.
      await this.repo.update(committed);

      let snapshotWritten = false;
      let projectionWritten = false;
      try {
        // Nachgelagerte BELEGE der Änderung (Versions-Snapshot, Evidence-Records, Audit) — genau
        // das Muster aus `mutateKoTx`: schlägt einer fehl, wird der Commit KOMPENSIEREND
        // zurückgenommen, damit nie „wirksam, aber unbelegt" entsteht.
        if (revises) {
          await this.snapshot(committed, author, "überarbeitet (Dokumentinhalt übernommen)");
          snapshotWritten = this.versions !== undefined;
        }
        // G27: die Projektion der jetzt gültigen Version entsteht in DERSELBEN
        // Kompensationsklammer. MIT `revises` trägt die Übernahme neuen Inhalt und es entsteht eine
        // neue Version — dann schreibt dieser Aufruf. OHNE `revises` bleibt der Body unberührt (die
        // Operation bindet nur Anker und Belegstellen) und die Version dieselbe; dann greift die
        // Append-only-Regel, `insert` ist ein No-op und die bestehende, gültige Projektion bleibt
        // unangetastet. Genau diese Unterscheidung trägt die Meldung.
        await this.persistSearchProjection(committed, (geschrieben) => {
          projectionWritten = geschrieben;
        });
        // Die Evidence-Records tragen die JETZT gültige Inhaltsversion: Anker und Belegstellen
        // gehören zu der Fassung, die diese Operation hinterlässt — nicht zur Vorversion.
        await this.appendEvidence({
          koId: id,
          koVersion: version,
          kind: "attachment",
          attachmentId: attachment.id,
          objectId: anchorObjectId,
          label: attachment.name,
          mime: attachment.mime,
          createdBy: author,
          createdAt: at,
        });
        for (const source of sources) {
          await this.appendEvidence({
            koId: id,
            koVersion: version,
            kind: "source",
            sourceId: source.id,
            label: source.label,
            url: safeSourceUrl(source.url),
            provider: source.provider ?? null,
            // mega26 Block B: der Grund der Verknüpfung — die Belegstelle der übernommenen
            // Dokumentstelle. Genau sie macht später nachvollziehbar, WARUM dieser Anhang
            // diese Aussage stützt.
            ...(source.excerpt ? { excerpt: source.excerpt } : {}),
            createdBy: author,
            createdAt: at,
          });
        }
        await this.audit?.record({
          actor: author,
          action: "ko.document-appended",
          target: id,
          payload: {
            operationId,
            version,
            revised: revises,
            objectId: anchorObjectId,
            sources: sources.length,
          },
        });
        return {
          committed: true,
          operationId,
          replayed: false,
          koVersion: version,
          attachmentId: attachment.id,
          sourceIds: sources.map((s) => s.id),
          ko: committed,
        } satisfies DocumentAppendCommit;
      } catch (err) {
        // Vollständige Rücknahme: Snapshot entfernen (falls geschrieben) und den Inhalt auf den
        // Vorzustand zurücksetzen — inklusive `appendOps`, sodass eine Wiederholung den Vorgang
        // WIRKLICH neu ausführt und nicht ein Ergebnis quittiert, das es nicht gibt.
        //
        // EHRLICHE GRENZE: bereits geschriebene EvidenceRecords sind append-only und bleiben
        // stehen. Das ist der HARMLOSE Spiegel (`evidence-without-source`, von
        // apps/web/src/lib/evidenceConsistency.ts erkannt und benannt) — nicht der verbotene
        // Zustand. Der verbotene wäre Inhalt ohne aktive Herkunft, und der ist hier nicht
        // erreichbar: Inhalt und Quellen stehen in DEMSELBEN Schreibvorgang, der gerade
        // zurückgenommen wird.
        //
        // G27: die Projektion der VERWORFENEN Version wird neben dem Snapshot entfernt — vor dem
        // Zurücksetzen des Inhalts. Bliebe sie liegen, träfe eine spätere, ERFOLGREICHE
        // Wiederholung auf dieselbe Versionsnummer, und die Append-only-Regel machte den
        // verworfenen Text zur Projektion der dann gültigen Fassung: suchbarer Inhalt, den es in
        // dieser Fassung nie gab. Entfernt wird ausschließlich, was DIESER Vorgang geschrieben hat
        // — ohne Inhaltsrevision bleibt die gültige Zeile der bestehenden Version unberührt.
        //
        // Wie in `mutateKoTx` werden Fehler der Kompensation geschluckt und der Ursachen-Fehler
        // geworfen; der Zustand ist dann bestmöglich, aber nicht garantiert wiederhergestellt.
        if (snapshotWritten) {
          await this.versions?.remove(id, version).catch(() => undefined);
        }
        if (projectionWritten) {
          await this.searchProjections
            .remove(id, version, { ruecknahme: true })
            .catch(() => undefined);
        }
        await this.rollbackKo(before).catch(() => undefined);
        throw err;
      }
    });
  }

  // ==============================================================================================
  // G27 WELLE 1 / S2 — DIE METADATENÄNDERUNG WIRD MIT IHRER PROJEKTION UND IHREM BELEG WIRKSAM
  // ==============================================================================================
  //
  // FR-KO-03: Kategorie/Tags nachträglich änderbar (Metadaten, OHNE Versions-Bump — KW-ARCH-G27,
  // Abschnitt 1). SCRUM-509 R3: über den serialisierten Lock-Pfad (withKoLock + rowVersion-CAS) —
  // ein nebenläufiges Vertraulichkeits-Upgrade kann nicht durch ein veraltetes Voll-Objekt
  // überschrieben werden.
  //
  // DREI DINGE WERDEN GEMEINSAM WIRKSAM (Abschnitt 4): der autoritative Zustand, die
  // `metadata_revision` samt Mutable Metadata Projection und der unveränderliche Audit-Beleg. Ein
  // Erfolg darf nicht gemeldet werden, wenn die Suchmetadaten dauerhaft alt bleiben — genau das war
  // der Befund, der zu dieser Welle geführt hat.
  //
  // WARUM DER AUDIT HIER NACH DEM SCHREIBEN LÄUFT (anders als in `mutateKo`): der Beleg muss die
  // NEUE `metadata_revision` tragen, und die entsteht erst im Speicher — nur er kann idempotent
  // entscheiden, ob überhaupt hochgezählt wird. Ein vorab geratener Wert wäre bei einer
  // Wiederholung schlicht falsch. Dafür trägt der Pfad die volle Kompensation aus `mutateKoTx`:
  // scheitert Projektion oder Beleg, wird der autoritative Stand zurückgerollt UND die Projektion
  // auf diesen Stand zurückgeführt (monoton, also mit erneut kletternder Revision — die Zahl darf
  // nie sinken, auch nicht bei einer Rücknahme).
  private async mutateKoMetadata(
    id: string,
    actor: string,
    beleg: { action: string; grund: string },
    apply: (ko: KnowledgeObject) => KnowledgeObject,
  ): Promise<KnowledgeObject> {
    return this.withKoLock(id, async () => {
      const before = await this.require(id);
      const updated = apply(before);
      const vorher = metadataTextsOf(before);
      const nachher = metadataTextsOf(updated);
      if (
        before.category === updated.category &&
        gleicheTagFolge(before.tags, updated.tags) &&
        metadataTextsEqual(vorher, nachher)
      ) {
        // IDENTISCHE WIEDERHOLUNG: kein Write, kein Beleg, kein Revisions-Bump. Nur die Zusicherung,
        // dass die Projektion überhaupt existiert (Altbestand) — und die ist selbst idempotent.
        await this.projectMetadata(before, new Date(this.now()).toISOString());
        return before;
      }
      await this.repo.update(updated);
      try {
        const ergebnis = await this.projectMetadata(updated, new Date(this.now()).toISOString());
        await this.audit?.record({
          actor,
          action: beleg.action,
          target: id,
          payload: {
            // Der Audit-Mindestinhalt aus Abschnitt 4: KO-Id (= target), vorher/nachher, Actor
            // (= actor), Zeitpunkt (setzt die Audit-Kette selbst), metadata_revision und Ursache.
            grund: beleg.grund,
            vorher: { category: before.category, tags: [...(before.tags ?? [])] },
            nachher: { category: updated.category, tags: [...(updated.tags ?? [])] },
            metadataRevision: ergebnis.projection.metadataRevision,
            metadataChanged: ergebnis.changed,
            // Rückwärtskompatibel: der bisherige Beleg trug genau dieses Feld.
            category: updated.category,
          },
        });
        return updated;
      } catch (err) {
        // Kompensation: der autoritative Stand geht zurück, und die Projektion wird auf DIESEN
        // Stand zurückgeführt — sonst bliebe die Suche auf einem Wert stehen, den es nicht gibt.
        await this.rollbackKo(before).catch(() => undefined);
        await this.projectMetadata(before, new Date(this.now()).toISOString()).catch(
          () => undefined,
        );
        throw err;
      }
    });
  }

  async updateCategory(id: string, category: string, actor = "system"): Promise<KnowledgeObject> {
    return this.mutateKoMetadata(
      id,
      actor,
      { action: "ko.category-changed", grund: "ko.updateCategory" },
      (ko) => ({ ...ko, category }),
    );
  }

  async updateTags(id: string, tags: string[], actor = "system"): Promise<KnowledgeObject> {
    return this.mutateKoMetadata(
      id,
      actor,
      { action: "ko.tags-changed", grund: "ko.updateTags" },
      (ko) => ({ ...ko, tags }),
    );
  }

  // SCRUM-358 / AG-14-SERVER-TRUST / VC-P1-1 / FR-VAL-01: serverseitige Konfliktwirkung.
  // Ein offener WAHRHEITSKONFLIKT gegen ein VALIDIERTES KO darf serverseitig nicht so tun, als sei das
  // KO unverändert voll vertrauenswürdig: Status validiert → offen (review-pflichtig) und Trust
  // konservativ gesenkt (kleine Strafe, KEIN Reset auf 0 → keine maschinelle Aussage „falsch").
  // Nur validierte KOs sind betroffen; bei bereits offenem/fehlendem KO No-op (idempotent, ungefährlich
  // bei Konflikten gegen nicht existierende/offene Bezugs-KOs). Konsistent mit der FE-Ableitung aus
  // SCRUM-357 (ready → in Prüfung). Eine spätere Auto-Erholung bleibt bewusst aus: nach `resolve` bleibt
  // das KO review-pflichtig und wird über die normale Bewertung erneut validiert (kein Fake-Validate).
  async markTruthConflictReview(
    id: string,
    actor = "system",
  ): Promise<KnowledgeObject | undefined> {
    const ko = await this.repo.findById(id);
    if (!ko || ko.status !== "validiert") {
      return ko;
    }
    const previousTrust = ko.trust;
    const trust = Math.max(0, ko.trust - TRUTH_CONFLICT_TRUST_PENALTY);
    const updated: KnowledgeObject = { ...ko, status: "offen", trust };
    await this.repo.update(updated);
    await this.audit?.record({
      actor,
      action: "ko.conflict-review",
      target: id,
      payload: { previousStatus: "validiert", previousTrust, trust, reason: "truth-conflict" },
    });
    return updated;
  }

  // Von der Validierung gesetzt (FR-VAL-01/02): Trust + Status nach Bewertungslage.
  // SCRUM-507 R2: per-KO serialisiert + optionaler Compare-and-Set gegen die Version. `expectedVersion`
  // schützt vor der Wettlaufsituation „Bewertung schreibt den Validierungsstatus, nachdem ein Revise
  // die Version erhöht und auf offen zurückgesetzt hat": stimmt die Version nicht mehr, unterbleibt das
  // Schreiben (No-op) → keine fälschlich gültige Alt-Bewertung.
  async setValidationState(
    id: string,
    state: { trust: number; status: KoStatus },
    opts: { expectedVersion?: number } = {},
  ): Promise<KnowledgeObject> {
    return this.withKoLock(id, async () => {
      const ko = await this.require(id);
      if (opts.expectedVersion !== undefined && ko.version !== opts.expectedVersion) {
        return ko; // Version hat sich geändert (Revise) → Bewertung galt der Vorversion, nicht schreiben.
      }
      const updated = { ...ko, trust: state.trust, status: state.status };
      await this.repo.update(updated);
      return updated;
    });
  }

  // ==============================================================================================
  // W3-C (KW-W3-19, Pedi 03.08.) — DEN VERWEIS AUF DIE ENTSCHEIDUNG FESTHALTEN.
  // ==============================================================================================
  //
  // WARUM DAS EIN EIGENER SCHREIBVORGANG IST UND NICHT EIN FELD AN `setValidationState`. Der
  // Verweis besteht aus `seq` und `hash` eines Auditeintrags, und beide vergibt das Auditrepository
  // ERST BEIM ANHÄNGEN. Zum Zeitpunkt von `setValidationState` existiert er also noch gar nicht —
  // und bei `warn`/`down` entsteht die maßgebliche Entscheidung sogar noch später (die Rückgabe an
  // den Autor). Ein Parameter dort wäre eine Einladung, etwas zu übergeben, das man noch nicht hat.
  //
  // DIESELBE ABSICHERUNG WIE DER STATUS-SCHREIBVORGANG: per-KO serialisiert (`withKoLock`) und mit
  // Compare-and-Set gegen die bewertete Version. Hat ein `revise` zwischenzeitlich die Version
  // erhöht, unterbleibt das Schreiben — sonst hinge der Verweis einer überholten Entscheidung an
  // einer Fassung, für die sie nie galt.
  //
  // DER WERT WIRD DURCHGEREICHT, NICHT GEPRÜFT: dieser Dienst weiß vom Audit nichts und darf nichts
  // wissen. Die Prüfung ist Sache des Lesers (`pruefeValidationDecisionRef` im Audit-Modul).
  async setValidationDecisionRef(
    id: string,
    ref: { auditSeq: number; auditHash: string },
    opts: { expectedVersion?: number } = {},
  ): Promise<KnowledgeObject> {
    return this.withKoLock(id, async () => {
      const ko = await this.require(id);
      if (opts.expectedVersion !== undefined && ko.version !== opts.expectedVersion) {
        return ko; // Version hat sich geändert (Revise) → die Entscheidung galt der Vorversion.
      }
      const updated: KnowledgeObject = {
        ...ko,
        validationDecisionRef: { auditSeq: ref.auditSeq, auditHash: ref.auditHash },
      };
      await this.repo.update(updated);
      return updated;
    });
  }

  // FR-ASK-04 / FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): ATOMARER „Hat geholfen"-Trust-Schritt.
  // Delegiert an den atomaren Repo-Inkrement (LEAST(maxTrust, trust+step)) — KEIN Read-modify-write
  // eines vorab gelesenen Absolutwerts, damit zwei gleichzeitige Danke verschiedener Nutzer BEIDE
  // zählen (kein Lost-Update). MIT tx (vom Aufrufer geöffnet, AskService.markHelpful) läuft der
  // Inkrement auf demselben Pg-Client wie der Audit-CAS → beide committen/rollbacken gemeinsam. Fehlt
  // das KO (zwischenzeitlich getrasht), wirft die Methode NOT_FOUND und der Aufrufer rollt den
  // gekoppelten Audit-Beleg zurück (kein „Beleg ohne Trust"). Bewusst OHNE withKoLock: der Inkrement
  // ist an der Datenquelle atomar (Pg-UPDATE bzw. synchroner InMemory-Write), kein Read-then-Write.
  async bumpTrust(id: string, step: number, maxTrust: number, tx?: TxContext): Promise<number> {
    const trust = await this.repo.bumpTrust(id, step, maxTrust, tx);
    if (trust === undefined) {
      throw new KoError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    return trust;
  }

  // FR-LIF-02: Autor-Übergabe — current author ändert sich, originalAuthor bleibt erhalten.
  async setAuthor(id: string, author: string, actor = "system"): Promise<KnowledgeObject> {
    return this.mutateKo(id, (ko) => {
      const updated = { ...ko, author };
      return {
        updated,
        value: updated,
        audit: async () => {
          await this.audit?.record({
            actor,
            action: "ko.author-transferred",
            target: id,
            payload: { author },
          });
        },
      };
    });
  }

  // FR-RBAC-02: KO löschen (nur Controller/Admin/Autor, serverseitig erzwungen) mit Audit.
  // SCRUM-422: normales Löschen = Papierkorb (Soft-Delete, wiederherstellbar, Auto-Endlöschung
  // nach TRASH_RETENTION_DAYS). HART gelöscht wird nur: Demo-Daten (immer) oder auf
  // ausdrückliche Anweisung interner Aufrufer (opts.hard, z. B. Demodaten-Purge).
  // WP-SHIP8-FIX (bens F2): opts.forceTrash = EXPLIZITER Papierkorb-Zwang für Aufräum-Wege
  // (Import-Cleanup): auch ein demoSeed-KO wandert dann in den Papierkorb statt still in die
  // Endlöschung zu kippen. forceTrash schlägt bewusst BEIDE Hart-Auslöser (demoSeed UND hard) —
  // wer den Papierkorb erzwingt, bekommt nie eine Endlöschung. Für alle Aufrufer ohne die neue
  // Option bleibt die delete-Semantik EXAKT unverändert.
  async delete(
    id: string,
    actor = "system",
    // WP-SHIP8-FINAL (bens Bedingung 3): expectedVersion = optimistische Versions-Erwartung des
    // Aufrufers (Cleanup-Confirm) — ein zwischenzeitlich revidiertes KO wird NICHT geloescht
    // (STALE_WRITE), der Aufrufer weist es ehrlich aus.
    opts?: { hard?: boolean; forceTrash?: boolean; expectedVersion?: number },
  ): Promise<void> {
    const ko = await this.require(id);
    if (opts?.expectedVersion !== undefined && ko.version !== opts.expectedVersion) {
      throw new KoError(
        "STALE_WRITE",
        "Das Wissensobjekt wurde zwischenzeitlich überarbeitet — Löschung abgelehnt.",
      );
    }
    if (!opts?.forceTrash && (opts?.hard || ko.demoSeed)) {
      // SCRUM-523 P.3 (WP1-Batch3): harte Löschung NICHT mehr am Chokepoint vorbei — über purgeKo
      // (inkl. Cleanup-Kaskade, cleanup-first). So räumen delete({hard}) UND der Demo-Purge (demoSeed)
      // die Folgeartefakte zwingend auf; scheitert das Cleanup, bleibt das KO bestehen (Rollback).
      await this.purgeKo(id, actor, "hard", {
        hard: true,
        ...(ko.demoSeed ? { demoSeed: true } : {}),
      });
      return;
    }
    const at = new Date(this.now()).toISOString();
    await this.repo.update({ ...ko, deletedAt: at, deletedBy: actor });
    await this.audit?.record({ actor, action: "ko.deleted", target: id, payload: { trash: true } });
  }

  private async require(id: string): Promise<KnowledgeObject> {
    const ko = await this.repo.findById(id);
    // SCRUM-422: getrashte KOs sind für alle normalen Pfade nicht vorhanden.
    if (!ko || ko.deletedAt) {
      throw new KoError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    return ko;
  }
}
