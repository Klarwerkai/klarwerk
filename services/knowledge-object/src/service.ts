import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { TxContext } from "../../db-tx";
// WP-BILD-1h: searchCaptionTexts = Scanner + kanonischer Größendeckel — der EINE Pfad für
// create, revise und Legacy-Backfill (keine ungedeckelten captionTexts in der Persistenz).
// JOB 3111 · B1b: searchImageNames ist derselbe Pfad für die BENENNUNGEN (alt-Texte) — ein
// Scanner, ein Deckel, dieselben drei Schreibränder wie bei den Fußnoten.
import {
  htmlToPlainText,
  sanitizeHtml,
  searchCaptionTexts,
  searchImageNames,
} from "../../structure";
// JOB 593 / Ownerentscheidung Option A: die EINE Normalform der kanonischen Anlagenkennung.
// Sie steht in einer eigenen Datei und nicht hier, weil BEIDE Schreibränder — Anlegen und
// Überarbeiten — sie anwenden müssen. Zwei Kopien wären zwei Wahrheiten.
import { normalizeAsset } from "./asset";
// JOB 3076 (Q1): `isConfidential` steht hier NICHT mehr — der Speicherzweig (`buildCreatedKo`) war
// seine einzige Verwendung in dieser Datei und benutzte es als Speicherbedingung. Die Funktion selbst
// bleibt unverändert und wird von den Egress-Stellen weiter gezogen (confidentiality.ts:40-42).
import {
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
// JOB 557: das kanonische Eigentümer-Aggregat. Regeln, Rückfallentscheidung und Grenzen stehen in
// ownership.ts — hier wird nur angewendet, nichts nachgebaut.
import { normalizeOwnership, ownershipOf, sameOwnership, withRole } from "./ownership";
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
// JOB 4077: „hängt dieser Anker an DIESEM Objekt?" — dieselbe Antwort, die die Stufenentscheidung
// als Tatsache beschafft (`ko-routes.ts`); hier entscheidet sie, ob der Anker gespeichert wird.
import { confirmedSourceAnchor } from "./source-anchor";
// SCRUM-527 (WP2): Quell-URL-Allowlist an der Persistenzgrenze (nur absolute http/https).
import { safeSourceUrl, sanitizeSources } from "./source-url";
import {
  type AiCheckCoverage,
  type AiCheckCoverageSummary,
  type Confidentiality,
  type EvidenceRecord,
  KNOWLEDGE_TYPES,
  type KnowledgeObject,
  type KnowledgeOwnership,
  type KnowledgeType,
  type KoAppendOp,
  type KoAttachment,
  type KoComment,
  // JOB 4146: der Klärungsstand eines Diskussionsfadens (geklärt, nicht freigegeben).
  type KoCommentResolution,
  type KoCreateOperation,
  KoError,
  // JOB 3667 R2: der gebundene Änderungsvorschlag (Fall 2 der Accountregel).
  type KoProposal,
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

/**
 * JOB 4146 R5 — IST DIESER BESTANDSBEITRAG DIESELBE ABSENDUNG WIE DIE GERADE ANKOMMENDE?
 *
 * Der Beitragsschlüssel (Vertrag Fall 5) allein reicht dafür NICHT. Er gehört zum Entwurf im Feld
 * und bleibt derselbe, solange dieser Entwurf offen ist — auch dann, wenn der Mensch seinen Text
 * inzwischen geändert hat. Ein Vergleich nur über den Schlüssel deutete die zweite, ANDERE Absendung
 * als Wiederholung der ersten, gab ein HTTP 200 zurück und schrieb nichts: der geänderte Text war
 * fort, und die Fläche leerte im Vertrauen auf die 200 auch noch das Feld (BEN, Runde 4).
 *
 * DIESELBE ABSENDUNG IST DAHER: gleicher Schlüssel · gleicher Verfasser · gleicher Text · gleicher
 * Antwortbezug. Der Bezug gehört dazu, weil dieselben Worte an einem anderen Faden eine andere
 * Aussage sind. Fehlender und leerer Bezug sind dabei dasselbe — beides heisst „Wurzelbeitrag".
 */
function gleicheAbsendung(
  vorhanden: KoComment,
  author: string,
  text: string,
  replyTo: string | undefined,
  clientKey: string,
): boolean {
  return (
    vorhanden.clientKey === clientKey &&
    vorhanden.author === author &&
    vorhanden.text === text &&
    (vorhanden.replyTo ?? "") === (replyTo ?? "")
  );
}

/**
 * JOB 4146 — DER WURZELBEITRAG DES FADENS, ZU DEM `commentId` GEHÖRT.
 *
 * Sie steigt `replyTo` aufwärts, bis ein Beitrag ohne Bezug kommt. ZWEI ABBRUCHGRÜNDE, und beide
 * sind fachlich und nicht defensiv:
 *
 *  · Der Bezug zeigt ins Leere (der Beitrag wurde nie geschrieben oder gehört einem anderen Objekt).
 *    Dann ist DIESER Beitrag der Anfang seines sichtbaren Fadens — genau so zeigt ihn auch die
 *    Fläche, statt ihn verschwinden zu lassen.
 *  · Ein Ring (`a → b → a`). Der Dienst kann ihn nicht erzeugen (jedes `replyTo` wird beim Anfügen
 *    gegen den BESTAND geprüft, und ein Beitrag kann nicht auf einen späteren zeigen), Altdaten aus
 *    einer anderen Quelle könnten ihn tragen. Eine Endlosschleife im Serverprozess wäre die
 *    schlechtere Antwort als der erste Beitrag des Rings.
 *
 * Ein UNBEKANNTER `commentId` ist etwas anderes als ein ins Leere zeigender Bezug: hier will jemand
 * einen Faden markieren, den es nicht gibt. Das ist ein Fehler und kein stiller Vorgang.
 */
function fadenWurzel(bestand: readonly KoComment[], commentId: string): KoComment {
  const start = bestand.find((c) => c.id === commentId);
  if (!start) {
    throw new KoError("COMMENT_NOT_FOUND", "Dieser Beitrag gehört nicht zu diesem Wissensobjekt.");
  }
  let aktuell = start;
  const gesehen = new Set<string>([aktuell.id]);
  while (aktuell.replyTo) {
    const eltern = bestand.find((c) => c.id === aktuell.replyTo);
    if (!eltern || gesehen.has(eltern.id)) {
      return aktuell;
    }
    gesehen.add(eltern.id);
    aktuell = eltern;
  }
  return aktuell;
}

const DEFAULT_NEEDED_VALIDATIONS = 3; // FR-CAP-08: 1–5, Standard 3.

// SCRUM-422 (Pedi 03.07.): Aufbewahrungsfrist im Papierkorb — danach automatische Endlöschung.
export const TRASH_RETENTION_DAYS = 30; // JOB 4327 (Pedi 17.09.2026): 28 → 30 Tage, eine Quelle.

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
  // JOB 3111 · B1b: die Benennungen der Bilder — dieselbe Vollladung, kein zweiter Nachzug.
  imageNames: string[];
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

// JOB 3071 R3: die vorgegebene Frist der Rücknahme-Vorablesung vor der Endlöschung
// (s. KoServiceDeps.ruecknahmeFrist). Modul-privat, weil sie kein Aufrufer ausserhalb dieses
// Dienstes braucht — wer eine andere will, übergibt sie.
const RUECKNAHME_VORAB_FRIST_MS = 2000;

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
  // ============================================================================================
  // JOB 1104 (Scheibe S0-TX, aus JOB 1045 D4 §2.2) — DER ZWEITE, TRANSAKTIONSGEBUNDENE HAKEN.
  // ============================================================================================
  //
  // WARUM ZWEI HAKEN UND NICHT EIN ERWEITERTER. Die drei heutigen Mitglieder von `onPurge`
  // (`conflicts.onKoRemoved`, `overlaps.onKoRemoved`, `removeKoFromDuplicatePrefilter`) führen
  // KEINEN `tx`-Parameter. Ein einziger erweiterter Haken zwänge entweder ihre Signaturen mit in
  // die Transaktion — genau die Modulgrenzen-Verletzung, die `db-tx` vermeidet — oder gäbe eine
  // Atomaritätszusage, die drei von vier Mitgliedern nicht halten können.
  //
  // Zwei Haken, zwei ehrlich verschiedene Zusagen: `onPurge` bleibt vor der Transaktion und behält
  // seine idempotente Selbstheilung; `onPurgeTx` läuft darin und ist all-or-nothing.
  onPurgeTx?: PurgeTxCleanup;
  // ============================================================================================
  // JOB 3071 R3 (bens Korrekturpflicht 2 zu R2) — FRIST UND FEHLERKANAL DER VORABLESUNG.
  // ============================================================================================
  //
  // R2 hat die Auskunft „hat der Autor selbst zurückgezogen?" vor die Purge-Transaktion gezogen
  // (richtig — s. PurgeTxCleanup) und sie dort ROH abgewartet (falsch): eine Ablehnung riss die
  // Endlöschung mit sich, ein Schweigen hielt sie für immer an. Bens Messung:
  // `BEN_PURGE http=500 imPapierkorb=true befund=offen` und
  // `BEN_PURGE_TIMEOUT ergebnis=blockiert befund=offen`.
  //
  // Die Auskunft ist eine ZUGABE, keine Bedingung der Endlöschung. Sie darf nie ein Grund sein,
  // einen Beitrag NICHT zu löschen. Deshalb hat sie hier dasselbe, was der Rücknahme-Port im
  // Befund-Dienst hat: eine Frist (Millisekunden, ohne Angabe RUECKNAHME_VORAB_FRIST_MS) und einen
  // Fehlerkanal (ohne Angabe console.error). Bei Ablauf, Ablehnung oder synchronem Werfen läuft die
  // Endlöschung mit dem systemischen Grund weiter — genau EINE Meldung, nie eine geratene
  // Autorschaft.
  ruecknahmeFrist?: number;
  onError?: (context: string, error: unknown) => void;
}

/**
 * Transaktionsgebundene Aufräumung der Endlöschung (JOB 1045 D4 §2.2).
 *
 * Läuft als ERSTER Schritt innerhalb von `withTx`, auf DEMSELBEN `TxContext` wie `repo.delete`
 * und `audit.record`. Rückgabe: der Beitrag zum `ko.purged`-Payload (etwa
 * `{ kantenGeloescht: 3 }`).
 *
 * WARUM EIN RÜCKGABEWERT UND NICHT `void`: die Zahl entsteht IM Transaktionskörper. Ohne sie
 * müsste der Aufrufer ein zweites Mal zählen — eine zusätzliche Leseoperation innerhalb der
 * gehaltenen Sperre, und der Beleg wäre nicht mehr aus derselben Sicht geschrieben wie die Wirkung.
 *
 * REGISTRIEREN DARF MAN HIER AUSSCHLIESSLICH Schreiber, deren öffentliche Schnittstelle einen
 * `tx?: TxContext` führt und ihn über `pgQueryable` auf denselben `PoolClient` auflöst, den
 * `withTx` geöffnet hat — heute erfüllen das `KoRepo`, `AuditRepo` und `UserRepo`.
 *
 * AUSGESCHLOSSEN sind Netz, Modellaufruf, HTTP, Dateisystem und Embedding-Dienst: ein Rollback der
 * Transaktion nähme sie nicht zurück. Ebenso ausgeschlossen sind Schleifen über Einzelobjekte —
 * der Körper hält eine Verbindung aus dem Pool, und n Einzelanweisungen halten die Sperre n-mal
 * so lange. Was hier steht, sind mengenbasierte Anweisungen gegen denselben Datenraum.
 *
 * JOB 3071 R2 (bens Korrekturpflicht 2) — DER VIERTE PARAMETER UND WARUM ES IHN GEBEN MUSS.
 * `ruecknahme` trägt die schon gelesene Antwort auf „hat der Autor selbst zurückgezogen?"
 * (`eigeneRuecknahmeVon`) in den Transaktionskörper hinein. Sie wird VOR dem Öffnen der Transaktion
 * gelesen, weil sie eine Punktabfrage am POOL ist und damit unter genau das Verbot oben fällt: hier
 * darf nur fahren, was auf DEMSELBEN Client fährt. Ein Lesegang am Pool wartet bei erschöpftem Pool
 * auf eine Verbindung, die erst der Commit dieser Transaktion freigibt — bei Poolgröße 1 auf sich
 * selbst. Vorab gelesen ist die Antwort dieselbe (das Objekt wird erst IN der Transaktion gelöscht)
 * und kostet die gehaltene Sperre nichts.
 */
export type PurgeTxCleanup = (
  koId: string,
  actor: string,
  tx: TxContext | undefined,
  ruecknahme: { zurueckgezogenVon: string | null },
) => Promise<Record<string, unknown>>;

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
  // JOB 679 / D2 (K1.2, Weg A): der Erfassungsweg des Entwurfs, aus dem dieses KO entsteht.
  // Bewusst ein VERWEIS auf die Wertmenge am Modell statt einer zweiten Aufzaehlung — so koennen
  // Eingabe und Objekt nicht auseinanderlaufen. Die Pruefung ist bereits am Entwurf gefallen
  // (`normalizeOriginIn`, services/capture); hier wird nichts nachgeprueft und nichts erfunden.
  origin?: KnowledgeObject["origin"];
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
  // JOB 557: das Eigentümer-Aggregat ab Erfassen — für SERVERPFADE (Import, Seed, interne Anlage),
  // die die Verantwortung schon kennen.
  //
  // BEWUSST `unknown` UND NICHT `KnowledgeOwnership`: die Eingabe kommt von aussen, und
  // AUSSCHLIESSLICH `normalizeOwnership` entscheidet über ihre Form. Ein getypter Parameter wäre
  // eine Einladung, die Prüfung durch einen Cast am Aufrufer zu ersetzen.
  //
  // DIE ÖFFENTLICHE SCHREIBROUTE VERWIRFT DAS FELD (wie `sources` und `importCandidateId`):
  // `ko.create` hält in diesem System jeder Experte, und wer ein Objekt anlegt, dürfte damit sonst
  // die Nacharbeit eines FREMDEN Menschen erklären. Der autorisierte Weg ist `setOwnership`
  // (Recht `ko.validate`, s. dort).
  ownership?: unknown;
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
  // JOB 593 / D9 (BEN-Auflage 1 zu D8): DER KORREKTURWEG DER KANONISCHEN KENNUNG.
  // Bis hierher führte `ReviseKoInput` die Kennung nicht — sie war nach der Anlage über KEINEN
  // Weg mehr änderbar. Eine kanonische Kennung, die man nach einem Tippfehler nicht korrigieren
  // kann, ist kanonisch falsch: der Fehler wäre unsterblich, und `sameAsset` trennte zwei
  // Objekte derselben Anlage für immer.
  // DREI ZUSTÄNDE, ALLE DREI GEWOLLT: Feld fehlt → Kennung bleibt unangetastet (kein stiller
  // Verlust beim Titeländern). Feld trägt einen Text → neue Kennung, in derselben Normalform
  // wie beim Anlegen. Feld ist `null` → Kennung bewusst entfernt. Deshalb wird unten auf
  // `!== undefined` geprüft und nicht mit `??` gearbeitet: bei `??` wäre „entfernen" nicht
  // ausdrückbar. Dieselbe Bauform wie `bodyHtml` daneben.
  asset?: string | null;
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

// ================================================================================================
// JOB 3667 (WORD-RÜCKWEG, Runde 5) — AUSGELASSEN IST NICHT GELÖSCHT. EINE REGEL, EINE STELLE.
// ================================================================================================
//
// DER FEHLER, DEN DIESE RUNDE BEHEBT: `decideProposal` übergab `bodyHtml: vorschlag.bodyHtml ?? null`
// und `naechsteFassung` las `null` als „leeren". Ein aus Word eingereichter Vorschlag trägt nur Text
// (`taskpane.html`, `rwEinreichen` schickt statement/baseVersion/origin) — seine Übernahme hätte also
// den ganzen Fließtext des Wissensobjekts ENTFERNT. Das ist kein Rückweg, das ist ein Datenverlust.
//
// DIE REGEL, DIE BEIDE STELLEN JETZT SPRECHEN, steht in diesen zwei Funktionen und nirgends sonst:
//   · das Feld kam NICHT mit (`undefined`)          → der bestehende Fließtext BLEIBT,
//   · ein Text kam mit                              → er ERSETZT,
//   · `null` kommt nur aus einer AUSDRÜCKLICHEN Absicht (`clearBody`) → das Feld wird GELEERT.
// `rumpfDerFassung` ist die Schreibseite (was in die neue Fassung geht), `rumpfAusVorschlag` die
// Leseseite (was ein Vorschlag überhaupt verlangt). Zwei Richtungen, ein Satz.

/** Der Fließtext der nächsten Fassung — `undefined` erhält, ein Text ersetzt, `null` leert. */
function rumpfDerFassung(
  gewuenscht: string | null | undefined,
  bestehend: string | null | undefined,
): string | null {
  if (gewuenscht === undefined) {
    return bestehend ?? null;
  }
  return cleanBody(gewuenscht);
}

/**
 * Was ein Vorschlag am Fließtext VERLANGT — als Änderungsfeld, das `rumpfDerFassung` versteht.
 *
 * Ein Vorschlag ohne Rumpf liefert `{}` (das Feld fehlt, also bleibt der bestehende stehen). Nur
 * `clearBody === true` liefert `{ bodyHtml: null }` — die Löschung, die jemand gewollt hat.
 */
function rumpfAusVorschlag(vorschlag: KoProposal): { bodyHtml?: string | null } {
  if (vorschlag.clearBody === true) {
    return { bodyHtml: null };
  }
  return typeof vorschlag.bodyHtml === "string" && vorschlag.bodyHtml.trim().length > 0
    ? { bodyHtml: vorschlag.bodyHtml }
    : {};
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

/**
 * JOB 4137 — WOFÜR eine Zeile der Belegkette der Beleg ist: die Gattung und die Kennung DESSEN, was
 * sie belegt — bei `attachment` der Anhang, bei `source` die Belegstelle.
 *
 * OHNE die Version, und das ist die Aussage: „diese Belegstelle hat schon eine Zeile" gilt
 * unabhängig davon, in welcher Fassung des Objekts sie geschrieben wurde. Nur so unterscheidet der
 * idempotente Nachzug der Erstanlage (`ensureCreatedSideEffects`) eine FEHLENDE Zeile von einer,
 * die ein anderer Vorgang (z. B. `add-source`) längst geschrieben hat.
 *
 * JOB 4137 R3 — UND OHNE DIE ANHANGSZUORDNUNG AN DER `source`-ZEILE, aus demselben Grund. BEN hat
 * in Runde 2 gemessen, was der frühere Schlüssel (`kind:attachmentId:sourceId`) anrichtet: bei zwei
 * Dokumentbündeln DESSELBEN Originals trägt die zweite Belegstelle am Objekt die Zuordnung zum
 * zweiten Anhang, der Nachzug leitet aus dem Anker aber den ersten ab (`anhangJeQuelleAusAnker`) —
 * verschiedener Schlüssel, also hielt er seine eigene, abweichend rekonstruierte Zuordnung für eine
 * FEHLENDE Zeile und schrieb sie: vier Records vor dem Nachzug, fünf danach, in einer append-only
 * Kette, die niemand mehr bereinigt.
 *
 * `attachmentId` ist an einer `source`-Zeile eine EIGENSCHAFT und nicht ihre Identität: die Zeile
 * belegt die Belegstelle, nicht das Paar aus Belegstelle und Anhang. Eine Belegstelle hat genau
 * eine Herkunft — wer schon eine Zeile hat, bekommt keine zweite mit einer anderen Behauptung
 * darüber, woher sie stammt.
 */
function belegSchluessel(record: Omit<EvidenceRecord, "id">): string {
  return record.kind === "source"
    ? `source:${record.sourceId ?? ""}`
    : `attachment:${record.attachmentId ?? ""}`;
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
  // JOB 1104 (S0-TX): der transaktionsgebundene Haken. Ebenfalls spät bindbar, aus demselben Grund.
  private onPurgeTx: PurgeTxCleanup | undefined;
  // SCRUM-523 P.3 (WP-A2): s. Typ-Kommentar an WithTx oben.
  private readonly withTx: WithTx | undefined;
  // JOB 3071 R3: Frist und Fehlerkanal der Rücknahme-Vorablesung (s. KoServiceDeps).
  private readonly ruecknahmeFrist: number;
  private readonly onError: (context: string, error: unknown) => void;
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
    this.onPurgeTx = deps.onPurgeTx;
    this.withTx = deps.withTx;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    // Eine Frist, die keine ist (0, negativ, NaN, Infinity), wäre die stillschweigende Abschaltung
    // der Begrenzung — dort gilt die Vorgabe statt der übergebenen Zahl.
    const frist = deps.ruecknahmeFrist;
    this.ruecknahmeFrist =
      typeof frist === "number" && Number.isFinite(frist) && frist > 0
        ? frist
        : RUECKNAHME_VORAB_FRIST_MS;
    this.onError =
      deps.onError ??
      ((context, error) => {
        console.error(`[kos] ${context}:`, error);
      });
  }

  // SCRUM-523 P.3 (WP2): den Purge-Aufräum-Hook spät verdrahten (die App erstellt conflicts/overlaps/
  // Embedding-Cleanup erst nach dem KoService). Nur EIN Hook — er ist die zentrale Aufräum-Kaskade.
  setPurgeCleanup(hook: (koId: string, actor: string) => Promise<void>): void {
    this.onPurge = hook;
  }

  // JOB 1104 (S0-TX): den transaktionsgebundenen Haken spät verdrahten — exakt analog zu
  // `setPurgeCleanup`, und mit derselben Einschränkung: NUR EIN Hook. Wer etwas hinzufügt, tut es
  // in der Kompositionswurzel sichtbar; es gibt bewusst keinen Registrierungsmechanismus, der
  // Aufräumarbeit unbemerkt in die Transaktion tragen könnte.
  setPurgeTxCleanup(hook: PurgeTxCleanup): void {
    this.onPurgeTx = hook;
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
  // Snapshot NACH der Persistenz. Per-KO serialisiert (withKoLock) + rowVersion-CAS (repo.update).
  //
  // ==============================================================================================
  // JOB 2704 D1 (Review R2-35) — DIE VIER SCHRITTE IN EINER TRANSAKTION, NICHT IN VIER.
  // ==============================================================================================
  //
  // Bis 2704 liefen kos-UPDATE, ko_versions-INSERT, Suchprojektion und Audit in VIER getrennten
  // Pg-Transaktionen; zusammengehalten hat sie nur die Kompensation im `catch` (unten). Die deckt
  // einen FEHLER ab, aber keinen ABBRUCH: stirbt der Prozess (oder die Verbindung, DB-Failover)
  // zwischen Schritt 1 und 2, läuft kein `catch` mehr — Version n+1 steht im Bestand, ohne
  // Snapshot und ohne Projektion, und nichts meldet es je. Das Werkzeug dafür gab es schon:
  // `withTx` (services/db-tx, withPgTx) — bisher nur in `purgeKo` benutzt.
  //
  // JETZT, MIT `withTx` (Pg, von build-app.ts injiziert): EINE echte Transaktion um alle vier
  // Schritte auf EINEM Client — `repo.update(…, tx)`, `versions.append(…, tx)`, Projektion (Inhalt
  // UND Metadaten, `…insert/upsert(…, tx)`) und `audit.record(…, tx)`. Entweder committen alle
  // vier oder keiner; ein Abbruch an jeder Stelle hinterlässt NICHTS (die Datenbank rollt eine
  // nicht committete Transaktion beim Verbindungsende selbst zurück). Die Kompensation läuft in
  // diesem Pfad NICHT — zwei Sicherungen für denselben Fall könnten einander widersprechen (ein
  // kompensierender `rollbackKo` NACH einem DB-Rollback schriebe den Vorzustand ein zweites Mal,
  // mit einer rowVersion, die es nie gab).
  //
  // DAS AUDIT GEHÖRT IN DIE TRANSAKTION — dieselbe Entscheidung wie in `purgeKo` (B), aus
  // demselben Grund in beide Richtungen: ein `ko.revised`-Beleg, der stehen bliebe, obwohl die
  // Revision zurückgerollt wurde, belegte etwas, das nie geschah; ein Beleg, der mit dem
  // Rollback verschwindet, ist kein verlorener Beleg, denn es gab nichts zu belegen. Der
  // Preis: `audit.record` liest `last()` und schreibt `append()` auf demselben Client, die
  // Sequenzlücke bleibt bis zum Commit der ganzen Revision offen — die Sequenzfrage selbst
  // (JOB 2677, PRO) wird hier NICHT entschieden, nur nicht verschlechtert: derselbe Weg, den
  // `purgeKo` seit WP-A2 geht.
  //
  // OHNE `withTx` (InMemory, Dev-Journal — keine echte Datenbank verdrahtet) bleibt der bisherige
  // Weg mit Kompensation. Dort ist er angemessen: zwei synchrone In-Process-Schritte haben kein
  // I/O-Fenster, in dem der eine committet und der andere nicht (dieselbe Begründung wie am
  // sequentiellen Fallback von `purgeKo`). Die Kompensation bleibt also — aber NUR dort, wo es
  // keine Transaktionsgrenze gibt, und behauptet dort auch keine.
  private async mutateKoTx<T>(
    id: string,
    build: (ko: KnowledgeObject) => {
      updated: KnowledgeObject;
      value: T;
      snapshot?: { author: string; note: string };
      // JOB 2704 D1: der Audit-Schritt bekommt den Transaktionskontext, damit `audit.record(…, tx)`
      // auf demselben Client läuft wie die drei Schreiber davor. Ohne withTx ist er undefined.
      audit?: (tx?: TxContext) => Promise<void>;
    },
  ): Promise<T> {
    return this.withKoLock(id, async () => {
      const before = await this.require(id);
      const { updated, value, snapshot, audit } = build(before);
      if (this.withTx) {
        // JOB 2704 D1: die vier Schritte in EINER Transaktion — Reihenfolge wie im Fallback unten,
        // ohne Kompensation (s. o.). Jeder Fehler verlässt den Transaktionskörper; withPgTx rollt
        // zurück und reicht ihn weiter. Ergebnis: nichts geschrieben — kein KO-Stand, kein
        // Snapshot, keine Projektion, kein Beleg.
        return this.withTx(async (tx) => {
          await this.repo.update(updated, tx);
          if (snapshot) {
            await this.snapshot(updated, snapshot.author, snapshot.note, tx);
            await this.persistSearchProjection(updated, undefined, tx);
          }
          await audit?.(tx);
          return value;
        });
      }
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
  // JOB 2704 D1: optionaler TxContext — aus mutateKoTx auf dem Transaktionsclient; sonst wie bisher.
  private async snapshot(
    ko: KnowledgeObject,
    author: string,
    note: string,
    tx?: TxContext,
  ): Promise<void> {
    if (!this.versions) {
      return;
    }
    const at = new Date(this.now()).toISOString();
    await this.versions.append(
      {
        koId: ko.id,
        version: ko.version,
        snapshot: JSON.parse(JSON.stringify(ko)) as KnowledgeObject,
        at,
        author,
        note,
      },
      tx,
    );
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
  //
  // JOB 2704 D1: optionaler TxContext — aus mutateKoTx laufen BEIDE Hälften (Inhaltszeile und
  // Metadatenzeile) auf dem Transaktionsclient; dann braucht es keine Meldung, weil es keine
  // Kompensation gibt. Die übrigen Aufrufer (Erstanlage, Dokumentwege) rufen ohne tx wie bisher.
  private async persistSearchProjection(
    ko: KnowledgeObject,
    meldeGeschrieben?: (geschrieben: boolean) => void,
    tx?: TxContext,
  ): Promise<void> {
    const at = new Date(this.now()).toISOString();
    const geschrieben = await this.searchProjections.insert(buildSearchProjection(ko, at), tx);
    meldeGeschrieben?.(geschrieben);
    await this.projectMetadata(ko, at, tx);
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
    tx?: TxContext,
  ): Promise<KoMetadataProjectionResult> {
    const { categoryText, tagText } = metadataTextsOf(ko);
    return this.searchProjections.metadata.upsert({ koId: ko.id, categoryText, tagText, at }, tx);
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
   * DIE EINE ARBEITSLISTE DES NACHZUGS (JOB 3111 · B1b R2, bens R1-ROT 1).
   *
   * Offen ist ein Objekt, dessen ABGELEITETE SUCHARTEFAKTE noch nicht vollständig sind — und das
   * sind seit B1b zwei unabhängige Quellen, weil die Artefakte unterschiedlich alt sind:
   *
   *   (a) `missingActive` — fehlende/veraltete Inhaltszeile oder fehlende Metadatenzeile. Sie
   *       fasst zugleich den Altbestand der Fußnoten (`captionTexts`): wem dieses Feld fehlt, der
   *       ist ÄLTER als die Projektion und hat deshalb auch keine Projektionszeile.
   *   (b) `repo.missingImageNames` — die BENENNUNGEN. Sie sind JÜNGER als die Projektion: ihr
   *       Altbestand ist genau der Bestand MIT vollständiger Projektion, den (a) per Konstruktion
   *       nie sieht. Ohne (b) bliebe er dauerhaft ohne Feld — und ein fehlendes Feld heißt in der
   *       Bildsuche „unbekannt", macht das Objekt also bei JEDER Bildsuche zum Kandidaten und
   *       kostet dort seinen vollen Rumpf. Genau das hat bens Gegenprobe in Runde 1 gemessen.
   *
   * Beide Quellen sind gedeckelt und liefern nur Kennungen; die Vereinigung ist duplikatfrei und
   * hält denselben Deckel ein, damit ein Schwung nie größer wird als bestellt.
   */
  private async offeneSuchartefakte(limit: number): Promise<string[]> {
    const cap = Math.max(0, Math.floor(limit));
    if (cap === 0) {
      return [];
    }
    const offen = await this.searchProjections.missingActive(cap);
    if (offen.length >= cap) {
      return offen;
    }
    const bekannt = new Set(offen);
    for (const id of await this.repo.missingImageNames(cap)) {
      if (bekannt.has(id)) {
        continue;
      }
      bekannt.add(id);
      offen.push(id);
      if (offen.length >= cap) {
        break;
      }
    }
    return offen;
  }

  /**
   * ALTBESTANDS-BACKFILL — sicher und idempotent, in gedeckelten Schwüngen.
   *
   * Es gibt bewusst KEINEN Start-Hook, der beim Hochfahren den ganzen Bestand durchpflügt: das
   * wäre bei einem großen Bestand ein Deployment-Risiko ohne Not. Stattdessen arbeitet der
   * Backfill in Schwüngen (`limit`) — aufgerufen von den Suchwegen (kleiner Deckel je Anfrage,
   * konvergiert) und für den ausdrücklichen Lauf mit einem großen Deckel.
   *
   * IDEMPOTENT auf zwei Ebenen: die Arbeitsliste (`offeneSuchartefakte`) enthält nur Objekte, deren
   * abgeleitete Suchartefakte noch nicht vollständig sind, und die Schreibvorgänge selbst sind
   * append-only (Inhalt), änderungsbedingt (Metadaten) bzw. nur-wenn-fehlt (captionTexts,
   * imageNames). Ein zweiter Lauf schreibt deshalb nichts mehr und meldet das ehrlich.
   *
   * `geschrieben` zählt die Objekte, an denen DIESER Lauf ein Suchartefakt hergestellt hat — seit
   * B1b also auch das reine Nachziehen der Benennungen an einem Objekt, dessen Projektion längst
   * steht. Das ist dieselbe Aussage wie bisher („hier ist Arbeit getan worden"), nur über die
   * vollständige Menge der Artefakte; der Reconcile misst daran seinen Fortschritt.
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
    const offen = await this.offeneSuchartefakte(limit);
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
   *
   * JOB 3111 · B1b R2: dasselbe gilt ab jetzt für die BENENNUNGEN (`imageNames`) — sie hängen an
   * derselben einen Vollladung. `offenVorher` und `differenz` zählen deshalb die VOLLSTÄNDIGE
   * offene Menge (`offeneSuchartefakte`): ein Objekt mit tadelloser Projektion, dem nur die
   * Benennungen fehlen, IST offene Arbeit und wird hier auch als solche gemeldet. Zählte diese
   * Gegenprobe weiter nur `missingActive`, meldete sie „0 offen" über einem Bestand, den sie gar
   * nicht angesehen hat.
   */
  async reconcileSearchProjections(): Promise<{
    offenVorher: number;
    nachgezogen: number;
    differenz: number;
  }> {
    const offenVorher = (await this.offeneSuchartefakte(RECONCILE_SCHWUNG)).length;
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
    const differenz = (await this.offeneSuchartefakte(RECONCILE_SCHWUNG)).length;
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
   * JOB 4137 — DIE ZEILEN DER BELEGKETTE EINER ERSTANLAGE, an EINER Stelle für BEIDE Türen.
   *
   * DER BEFUND, den dieser Baustein schliesst: `createWithDocumentsLocked` schrieb die Belegkette
   * vollständig, `finishCreated` (und damit `create` und der Entwurfs-Promote) gar nicht. Dasselbe
   * Objekt, durch zwei Türen angelegt, beantwortete die Frage „woher stammt dieser Satz, und wann
   * kam der Beleg dazu?" einmal vollständig und einmal mit einer leeren Liste.
   *
   * HERAUSGEZOGEN UND NICHT KOPIERT, aus demselben Grund wie `buildCreatedKo` und `finishCreated`:
   * zwei Kopien dieser Feldliste wären zwei Gelegenheiten, sie auseinanderlaufen zu lassen — und
   * die zweite hätte niemand geprüft. Der Dokumentweg schreibt seine Zeilen weiterhin SELBST (er
   * ruft `finishCreated` nicht auf, s. dort), aber er BILDET sie hier; es gibt keinen zweiten
   * Record-Bau.
   *
   * SIE SCHREIBT NICHT, sie BILDET nur — das Schreiben bleibt beim Aufrufer, weil die beiden Wege
   * verschiedene Fehlerverträge haben: der Dokumentweg nimmt bei einem Fehler das ganze Objekt
   * zurück, `create` bleibt nach dem Insert bewusst untransaktional (WP-SHIP8-CLOSE-5).
   *
   * GEBILDET WIRD AUSSCHLIESSLICH AUS DEM OBJEKT: je Anhang eine Zeile, je Belegstelle eine Zeile,
   * nicht mehr und nicht weniger. Kein Vorgabewert; leere Optionalfelder werden WEGGELASSEN und nie
   * mit `""` belegt — eine Belegkette, die etwas behauptet, das nicht am Objekt steht, wäre keine.
   *
   * `anhangJeQuelle` ist die ZUORDNUNG Belegstelle → Anhang, und sie kommt vom Aufrufer, weil nur
   * er sie mit Gewissheit kennt: der Dokumentweg hat sie beim Bauen in der Hand (`bySource`, je
   * Bündel), die Erstanlage leitet sie aus dem bestätigten Anker der Belegstelle ab
   * (`anhangJeQuelleAusAnker`). Ein fehlender Eintrag lässt das Feld WEG — kein Ratewert und keine
   * Reihenfolgeannahme.
   */
  private erstanlageBelege(
    ko: KnowledgeObject,
    author: string,
    at: string,
    anhangJeQuelle: ReadonlyMap<string, string>,
  ): Omit<EvidenceRecord, "id">[] {
    const zeilen: Omit<EvidenceRecord, "id">[] = [];
    for (const attachment of ko.attachments) {
      zeilen.push({
        koId: ko.id,
        koVersion: ko.version,
        kind: "attachment",
        attachmentId: attachment.id,
        ...(attachment.objectId ? { objectId: attachment.objectId } : {}),
        label: attachment.name,
        mime: attachment.mime,
        createdBy: author,
        createdAt: at,
      });
    }
    for (const source of ko.sources) {
      const attachmentId = anhangJeQuelle.get(source.id);
      zeilen.push({
        koId: ko.id,
        koVersion: ko.version,
        kind: "source",
        sourceId: source.id,
        ...(attachmentId ? { attachmentId } : {}),
        label: source.label,
        ...(source.url ? { url: source.url } : {}),
        // mega26 Block B: der Grund der Verknüpfung — die Belegstelle, die diese Quelle trägt.
        // `source.excerpt` ist zu diesem Zeitpunkt bereits getrimmt/normalisiert.
        ...(source.excerpt ? { excerpt: source.excerpt } : {}),
        createdBy: author,
        createdAt: at,
      });
    }
    return zeilen;
  }

  /**
   * JOB 4137 — DIE ZUORDNUNG BELEGSTELLE → ANHANG, gelesen und nicht geraten.
   *
   * Trägt eine Belegstelle den ANKER, den JOB 4077 an ihr eingeführt hat (`KoSource.objectId`: die
   * vom Server gegen die eigene Anhangsliste bestätigte Kennung), dann wird der Anhang DESSELBEN
   * Objekts mit dieser Kennung gesucht und seine Id an der `source`-Zeile vermerkt. Findet sich
   * keiner, bleibt das Feld WEG.
   *
   * KEINE REIHENFOLGEANNAHME: es wird über den Anker verbunden, nicht über „der n-te Anhang gehört
   * zur n-ten Quelle". Und keine Rückfallkette über den Dateinamen — ein Name ist kein Anker (s.
   * die Begründung an `KoSource.objectId` in types.ts).
   *
   * JOB 4137 R3 — UND KEIN ERSTER-GEWINNT. Bis Runde 2 stand hier: „der ERSTE Anhang je Anker
   * gewinnt … eine Wahl zwischen ihnen wäre geraten, also wird die stabile getroffen". Das war eine
   * Wahl zwischen zwei Möglichkeiten, von denen genau eine stimmt — also geraten, nur verlässlich
   * gleich geraten. BEN hat den Fall in Runde 2 hergestellt: ZWEI Dokumentbündel mit DERSELBEN
   * Originalkennung ergeben zwei Anhänge mit gleichem `objectId` und verschiedener Id; die
   * Belegstelle des zweiten Bündels gehört zum ZWEITEN Anhang, und der Anker allein sagt nicht,
   * zu welchem.
   *
   * Ist der Anker MEHRDEUTIG (mehr als ein Anhang desselben Objekts trägt ihn), bleibt die
   * Zuordnung deshalb WEG — `erstanlageBelege` lässt das Feld dann aus. Das ist die schwächere und
   * wahre Aussage („diese Belegstelle gehört zu diesem Objekt") statt der starken und womöglich
   * falschen („sie stammt aus genau diesem Anhang"). Der Weg, der es WEISS, ist der Dokumentweg:
   * `createWithDocumentsLocked` bildet die Zuordnung je Bündel (`bySource`) und gibt sie hier
   * hinein, statt sie ableiten zu lassen.
   */
  private anhangJeQuelleAusAnker(ko: KnowledgeObject): Map<string, string> {
    const anhangJeAnker = new Map<string, string>();
    const mehrdeutig = new Set<string>();
    for (const attachment of ko.attachments) {
      if (!attachment.objectId) {
        continue;
      }
      if (anhangJeAnker.has(attachment.objectId)) {
        mehrdeutig.add(attachment.objectId);
        continue;
      }
      anhangJeAnker.set(attachment.objectId, attachment.id);
    }
    const zuordnung = new Map<string, string>();
    for (const source of ko.sources) {
      if (!source.objectId || mehrdeutig.has(source.objectId)) {
        continue;
      }
      const attachmentId = anhangJeAnker.get(source.objectId);
      if (attachmentId) {
        zuordnung.set(source.id, attachmentId);
      }
    }
    return zuordnung;
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
      // JOB 3111 · B1b: dieselbe Zusage für die Benennungen — ein Objekt, das nach dieser Regel
      // gespeichert wird, trägt BEIDE Suchfelder immer (auch [] bei „keine Bilder/keine alt-Texte").
      imageNames: searchImageNames(bodyHtml),
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
      // JOB 593 (Option A, N5): die kanonische Anlagenkennung entsteht HIER in ihrer Normalform.
      // Vorher legte der Dienst sie roh ab; getrimmt hat allein der Browser. Jeder browserfreie
      // Weg (Word-Add-in, Import, Seed, API) erzeugte damit eine zweite Schreibweise derselben
      // Anlage — und `sameAsset` (conflicts/detect.ts:126) vergleicht zeichengenau.
      asset: normalizeAsset(input.asset),
      // JOB 3076 (Q1) — DIE STUFE NUR SPEICHERN, WENN SIE JEMAND MITBRINGT. ABLÖSUNG VON SCRUM-415.
      //
      // BIS HIERHER GALT (SCRUM-415): „nur speichern, wenn tatsächlich vertraulich" — die Bedingung
      // war `isConfidential(normalizeConfidentiality(input.confidentiality))`. Ein AUSDRÜCKLICH
      // übergebenes „intern" fiel damit in den Leerzweig und wurde gar nicht erst geschrieben.
      //
      // WELCHER SCHADEN DARAUS FOLGTE. Ein fehlendes Feld und ein ausdrücklich gesetztes „intern"
      // hatten im Bestand denselben Zustand, und `discloseConfidentiality` (confidentiality.ts:99-102)
      // kann daraus nur `{ null, "unknown" }` machen — „niemand hat hier je eingestuft". Codex-Abnahme
      // R-1613 vom 05.09.2026 gegen https://app.klarwerk.ai (1.0.0-beta.1.89), Prüfschritt 4, Objekt
      // c22c690f-9574-4998-a030-700cb2166476, wörtlich: „HTTP 201, danach confidentiality null und
      // provenance unknown. Beide Flächen zeigen Nicht eingestuft." Wer bewusst eingestuft hatte, bekam
      // sein Objekt als „Nicht eingestuft" zurück. Die Anzeige war unschuldig: die drei Bestandsfälle
      // daneben waren im selben Lauf `bestanden`.
      //
      // WAS JETZT GILT. Gespeichert wird genau dann, wenn der Aufrufer eine Stufe MITBRINGT — dieselbe
      // Bauform wie `origin`, `importCandidateId` und `ownership` darunter, und dieselbe wie im
      // Entwurfs-Promote (capture/src/service.ts:845). Die Gültigkeit ist :1654 bereits geprüft; hier
      // bleibt nur die Unterscheidung „übergeben" gegen „nicht übergeben". KEIN stiller Default in die
      // Gegenrichtung: ein Objekt ohne Angabe bekommt weiterhin KEIN „intern" angeschrieben, sonst
      // gäbe es keinen Weg mehr, „nie eingestuft" auszudrücken (i18n.ts:1991).
      //
      // `isConfidential` bleibt unverändert und richtig — falsch war allein, es als SPEICHERbedingung
      // zu benutzen. Wer das zurückdreht, macht V1 in
      // tests/vertraulichkeit-intern/explizit-intern-ueberlebt.test.ts rot; wer stattdessen einen
      // Default einführt, V2.
      ...(input.confidentiality !== undefined
        ? { confidentiality: normalizeConfidentiality(input.confidentiality) }
        : {}),
      ...(input.demoSeed ? { demoSeed: true } : {}),
      // JOB 679 / D2 (K1.2, Weg A): die Herkunft nur setzen, wenn der Entwurf eine MITBRINGT —
      // dieselbe Bauform wie `confidentiality` und `importCandidateId` daneben. Kein stiller
      // Default: ein KO ohne Herkunft bleibt ein KO ohne Herkunft, und genau das liest die
      // Oberflaeche als „unbekannt" statt als „Vordertuer".
      ...(input.origin ? { origin: input.origin } : {}),
      // WP-SHIP8-CLOSE-3/4 (bens ROT-1): stabiler Kandidaten-Anker des Import-Accepts (DB-unique
      // erzwungen — der Insert eines zweiten KO desselben Kandidaten scheitert am Index/Guard).
      ...(input.importCandidateId ? { importCandidateId: input.importCandidateId } : {}),
      // JOB 557: das Eigentümer-Aggregat nur setzen, wenn der Aufrufer eines MITBRINGT — dieselbe
      // Bauform wie `confidentiality` und `origin` daneben. KEIN stiller Default auf den Autor: ein
      // Objekt ohne benannte Verantwortung bleibt ein Objekt ohne benannte Verantwortung, und genau
      // das liest `responsibleOf` als Rückfall statt als Eigentum.
      ...(normalizeOwnership(input.ownership)
        ? { ownership: normalizeOwnership(input.ownership) as KnowledgeOwnership }
        : {}),
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
   * Die BELEGE der Erstanlage, an EINER Stelle — Snapshot, Projektion, BELEGKETTE und `ko.created`.
   *
   * AUFTRAG-mega22 Block H: herausgezogen, weil es jetzt zwei Wege in `create` gibt (mit und ohne
   * Vorgang). Zwei Kopien dieser Folge wären zwei Gelegenheiten, sie auseinanderlaufen zu lassen —
   * und die zweite hätte niemand geprüft.
   *
   * JOB 4137: DIE BELEGKETTE IST DAZUGEKOMMEN. Bis hierher schrieb diese Stelle drei Dinge und
   * KEINEN `EvidenceRecord` — das tat allein `createWithDocumentsLocked`. Ein über „speichern und
   * einreichen" entstandenes Wissensobjekt trug seine Belegstelle am Objekt (JOB 3934), in der
   * append-only Belegkette aber stand nichts: `GET /api/kos/:id/evidence` antwortete mit `[]`,
   * gemessen in `tests/demo-erster-nutzerweg/befund-promote-verliert-die-herkunft.test.ts`. Damit
   * hing die Antwort auf „woher stammt dieser Satz?" an der Tür, durch die das Objekt gekommen war.
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
    // JOB 4137: DIE BELEGKETTE, an derselben Stelle wie Snapshot und Projektion und aus denselben
    // Tatsachen wie der Dokumentweg (`erstanlageBelege`). `ko.createdAt` und nicht `this.now()`:
    // die Zeile gehört zur ANLAGE dieses Objekts und trägt deren Zeitpunkt — genau wie die Zeilen
    // des Dokumentwegs, die dort denselben `at` bekommen wie das Objekt selbst. Ein zweiter,
    // späterer Zeitstempel wäre eine zweite Auskunft darüber, wann der Beleg dazukam.
    //
    // OHNE EVIDENCE-ABLAGE ist das ein No-op (`appendEvidence`), und ein Objekt ohne Anhänge und
    // ohne Belegstellen erzeugt KEINE Zeile: eine leere Belegkette bleibt die wahre Antwort für ein
    // Objekt, das nichts zu belegen hat, und wird nicht zu einer Ersatzzeile.
    for (const zeile of this.erstanlageBelege(
      ko,
      author,
      ko.createdAt,
      this.anhangJeQuelleAusAnker(ko),
    )) {
      await this.appendEvidence(zeile);
    }
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
          // JOB 4077: derselbe Anker, den der Anhang zwei Zeilen höher bekommt — und zwar aus
          // demselben Grund wie dort. `bySource` hielt die Zuordnung bisher NUR für die
          // Evidence-Records; am Nachweis selbst stand sie nicht, und die Prüfseite liest
          // Evidence-Records nicht. Ein aus Dokumenten ERZEUGTES Objekt ist der häufigste Fall auf
          // `/pruefen` — ohne diese Zeile bliebe genau er ohne Dateinamen.
          objectId: anchorObjectId,
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
      // JOB 4137: DIESELBE BILDUNG WIE DIE ALLGEMEINE ERSTANLAGE. Hier standen bis dahin zwei
      // ausgeschriebene Schleifen; sie sind nach `erstanlageBelege` gewandert, weil `finishCreated`
      // seit diesem Auftrag dieselben Zeilen schreibt und zwei Kopien der Feldliste zwei
      // Gelegenheiten wären, sie auseinanderlaufen zu lassen. GESCHRIEBEN wird weiterhin HIER —
      // innerhalb der Rücknahmeklammer, denn dieser Weg nimmt bei einem Fehler das ganze Objekt
      // zurück. `bySource` bleibt die Zuordnung dieses Weges: sie steht je BÜNDEL fest und ist
      // damit genauer als jede Ableitung aus dem fertigen Objekt (zwei Bündel können dasselbe
      // Original anhängen).
      for (const zeile of this.erstanlageBelege(ko, input.author, at, bySource)) {
        await this.appendEvidence(zeile);
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
      // JOB 2698 D1 (R2-32): hier wird nur gefragt, OB es einen Eintrag gibt — nicht welchen. Bis
      // 2698 lud `list()` dafür das ganze Protokoll und filterte in Node; jetzt ein EXISTS über den
      // Index (action, target). Die Aussage ist dieselbe: „mindestens ein ko.created für dieses KO".
      const created = await this.audit.exists({ action: "ko.created", target: ko.id });
      if (!created) {
        await this.audit.recordOnce(`ko.created:${ko.id}`, {
          actor: ko.author,
          action: "ko.created",
          target: ko.id,
        });
      }
    }
    // JOB 4137: DIE BELEGKETTE GEHÖRT SEIT DIESEM AUFTRAG ZU DEN BELEGEN DER ERSTANLAGE — also auch
    // hierher. `finishCreated` schreibt sie; scheitert etwas NACH dem Insert, fehlt sie genauso wie
    // Snapshot und Audit, und dieser Pfad ist der Auffang (Kopf dieser Methode).
    //
    // IDEMPOTENT ÜBER DEN BESTAND, nicht über einen Merker: gefragt wird, welche Anhänge und
    // Belegstellen des Objekts SCHON eine Zeile haben — geschrieben wird nur, was fehlt. Der
    // Schlüssel ist bewusst die IDENTITÄT des Belegten (Gattung + Anhang- bzw. Quellen-Id, s.
    // `belegSchluessel`), ohne Version und ohne die Anhangszuordnung der `source`-Zeile: eine
    // Belegstelle, die später über `add-source` dazukam, trägt ihre Zeile aus jenem Vorgang, und
    // der Nachzug der ERSTANLAGE darf sie nicht ein zweites Mal schreiben — auch dann nicht, wenn
    // er ihre Herkunft aus dem Anker anders ableiten würde als der Vorgang, der sie geschrieben hat
    // (JOB 4137 R3, BENs Messung an zwei Bündeln desselben Originals: sonst fünf Zeilen statt vier).
    //
    // EHRLICHE GRENZE, gemessen am Mechanismus und nicht behauptet: das ist ein Query-then-Write.
    // Zwei Nachzüge, die BEIDE die leere Kette lesen, bevor einer schreibt, erzeugen zwei Zeilen —
    // dieselbe Lücke, die `recordOnce` für das Audit über eine stabile Ereignis-Id schliesst. Für
    // die Belegkette gäbe es diese Id nur als neue Form der Record-Kennung, und die ist ein
    // Modellanteil (JOB 4137 §10: `types.ts`/`repo.ts`/`repo-pg.ts` bleiben unberührt). Steht als
    // REST. Der praktisch auftretende Fall — Nachzug nach einem gescheiterten `finishCreated`, und
    // ein zweiter Nachzug danach — ist geschlossen und in H10 gemessen.
    if (this.evidence) {
      const vorhanden = await this.evidence.listByKo(ko.id);
      const schonBelegt = new Set(vorhanden.map(belegSchluessel));
      for (const zeile of this.erstanlageBelege(
        ko,
        ko.author,
        ko.createdAt,
        this.anhangJeQuelleAusAnker(ko),
      )) {
        if (!schonBelegt.has(belegSchluessel(zeile))) {
          await this.appendEvidence(zeile);
        }
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

  // ==============================================================================================
  // JOB 557 — DER AUTORISIERTE EIGENTUMSGEBER.
  // ==============================================================================================
  //
  // D6 hat das Aggregat gebaut, aber keinen produktiven Weg, es zu SETZEN: die öffentliche Route
  // verwarf das Feld, und ausserhalb der Tests gab es keinen Erzeuger. Ein Feld, das im Betrieb
  // niemand füllt, ist keine kanonische Wahrheit, sondern eine Empfangsstelle. Das ist dieser Weg.
  //
  // DIE RECHTEPRÜFUNG STEHT AN DER ROUTE (`ko.validate`), wie bei `category` und `confidentiality`.
  // Der Dienst prüft die NUTZLAST — und zwar defensiv (`unknown`), statt sich auf einen Cast des
  // Aufrufers zu verlassen. Beides zusammen ist die Zusage: „Normale Einreichende dürfen keine
  // fremde Verantwortung bestimmen."
  //
  // FAIL-CLOSED BEI UNBRAUCHBARER ANGABE. Eine Eingabe, die zu `null` normalisiert, wird ABGELEHNT
  // statt still übernommen. Sonst wäre ein Tippfehler im Feldnamen ein LÖSCHVORGANG am Eigentum —
  // dieselbe Entscheidung wie bei `INVALID_CONFIDENTIALITY`. Ein ausdrückliches Entfernen des
  // Aggregats gibt es bewusst NICHT: es wäre ein eigener Vorgang mit eigener Ownerfrage (wem darf
  // man die Verantwortung wieder wegnehmen?), und diese Frage ist nicht entschieden.
  async setOwnership(id: string, value: unknown, actor: string): Promise<KnowledgeObject> {
    const next = normalizeOwnership(value);
    if (!next) {
      throw new KoError(
        "INVALID_OWNERSHIP",
        "Ungültige Eigentümerangabe — erwartet werden owner, reviewers oder validators.",
      );
    }
    return this.mutateKo(id, (ko) => {
      const previous = ownershipOf(ko);
      const updated: KnowledgeObject = { ...ko, ownership: next };
      return {
        updated,
        value: updated,
        audit: async () => {
          await this.audit?.record({
            actor,
            action: "ko.ownership",
            target: id,
            // Der Beleg nennt beide Stände. Ohne den vorherigen wäre nicht erkennbar, ob hier
            // Verantwortung ERSTMALS benannt oder einer Person WEGGENOMMEN wurde.
            payload: {
              owner: next.owner ?? null,
              reviewers: next.reviewers,
              validators: next.validators,
              previousOwner: previous?.owner ?? null,
            },
          });
        },
      };
    });
  }

  // ==============================================================================================
  // JOB 557 — DIE FORTSCHREIBUNG AUS TATSÄCHLICHEN EREIGNISSEN.
  // ==============================================================================================
  //
  // `reviewers` und `validators` sind keine Eingabefelder, die jemand von aussen pflegt — sie sind
  // die SPUR dessen, was wirklich passiert ist: eine Prüfzuweisung und eine abgeschlossene
  // Validierung. Genau das war BENs zweiter Mangel an D6 („nur normalisierbare Listen").
  //
  // IDEMPOTENT UND OHNE LEERSCHREIBUNG: ändert sich nichts, wird NICHT geschrieben und KEIN Beleg
  // erzeugt. Ein Audit-Eintrag „nichts hat sich geändert" wäre Rauschen, das echte Änderungen
  // unauffindbar macht — und ein Write wäre ein rowVersion-Sprung ohne Grund, der einem
  // nebenläufigen Vorgang grundlos ein STALE_WRITE beschert.
  //
  // DIESER WEG ERZEUGT NIE EIGENTUM (s. `withRole`): dass jemand geprüft hat, sagt nichts darüber,
  // wem das Objekt gehört.
  async recordOwnershipRole(
    id: string,
    role: "reviewers" | "validators",
    ids: readonly unknown[],
    actor: string,
  ): Promise<KnowledgeObject | undefined> {
    return this.withKoLock(id, async () => {
      // Ein zwischenzeitlich gelöschtes Objekt ist kein Fehler dieses Nebenwegs: die
      // Zuweisung/Validierung hat ihre eigene Antwort schon gegeben. Still übergehen statt werfen.
      const ko = await this.repo.findById(id);
      if (!ko || ko.deletedAt) {
        return undefined;
      }
      const previous = ownershipOf(ko);
      const next = withRole(previous, role, ids);
      if (sameOwnership(previous, next) || next === null) {
        return ko;
      }
      const updated: KnowledgeObject = { ...ko, ownership: next };
      await this.audit?.record({
        actor,
        action: "ko.ownership-role",
        target: id,
        payload: { role, added: next[role].filter((x) => !(previous?.[role] ?? []).includes(x)) },
      });
      await this.repo.update(updated);
      return updated;
    });
  }

  // ==============================================================================================
  // FR-KO-06 / JOB 4146 — DER BEITRAG ZUM FADEN.
  // ==============================================================================================
  //
  // DREI DINGE SIND SEIT JOB 4146 ANDERS, und jedes hat seinen Grund:
  //
  //  1. `replyTo` WIRD GEPRÜFT, NICHT GEGLAUBT. Der Bezug muss auf einen Beitrag DIESES Objekts
  //     zeigen. Ein erfundener oder fremder Wert erzeugt GAR KEINEN Beitrag (`COMMENT_NOT_FOUND`,
  //     an der Route ein 400) — sonst hinge eine Antwort an einem Faden, den es hier nicht gibt,
  //     und die Fläche müsste raten, wohin sie gehört. Vertrag Fall 4: ein Faden eines fremden
  //     Dokuments ist kein gültiger Bezug, auch wenn der Aufrufer seine Kennung kennt.
  //
  //  2. `koVersion` KOMMT AUS DEM GELESENEN OBJEKT. Die Fassung, gegen die dieser Beitrag wirklich
  //     angefügt wurde — nicht die, die der Aufrufer behauptet.
  //
  //  3. EIN `STALE_WRITE` IST KEINE ABSAGE AN DEN MENSCHEN. Der bedingte UPDATE des Repos
  //     (`repo-pg.ts:412-437`, `repo.ts:443-454`) lehnt einen Schreibversuch ab, dessen gelesener
  //     Stand überholt ist — das ist eine ABLEHNUNG, kein Datenverlust. ANFÜGEN ist verträglich:
  //     der Dienst liest deshalb EINMAL frisch und hängt erneut an. Scheitert auch das, kommt die
  //     Ablehnung heraus; sie wird nicht verschluckt und nicht als Erfolg ausgegeben.
  //
  //     EINMAL UND NICHT „BIS ES KLAPPT": eine Schleife ohne Obergrenze wäre unter Last ein
  //     unbegrenzter Schreibversuch gegen dieselbe Zeile. Der zweite Versuch deckt den Fall ab, für
  //     den es ihn gibt (ein zweiter Schreiber im selben Augenblick); ein dritter gleichzeitiger
  //     Schreiber ist ehrlicher abgelehnt als still wiederholt.
  //
  // KENNUNG UND ZEITPUNKT ENTSTEHEN EINMAL, VOR DEM ERSTEN VERSUCH: ein Wiederholversuch mit neuer
  // Kennung könnte denselben Beitrag zweimal in den Bestand legen, wenn der erste Schreibvorgang
  // doch noch durchging.
  async addComment(
    id: string,
    author: string,
    text: string,
    opts: { replyTo?: string; clientKey?: string } = {},
  ): Promise<KnowledgeObject> {
    const replyTo = opts.replyTo?.trim();
    const clientKey = opts.clientKey?.trim();
    const neu: KoComment = {
      id: this.genId(),
      author,
      text,
      at: new Date(this.now()).toISOString(),
      ...(replyTo ? { replyTo } : {}),
      ...(clientKey ? { clientKey } : {}),
    };

    const versuch = async (): Promise<{ ko: KnowledgeObject; geschrieben: boolean }> => {
      const ko = await this.require(id);
      const bestand = ko.comments ?? [];
      // Vertrag Fall 5: dieselbe Wiederholung ergibt denselben einen Beitrag. Der Schlüssel gilt je
      // Objekt UND Verfasser — er ist ein Deduplizierer, keine Sperre gegen andere Menschen.
      //
      // R5: ER GILT AUSSERDEM JE ABSENDUNG, nicht je Entwurf. Vorher sah diese Zeile nur auf
      // `clientKey` und `author` — und bestätigte damit eine Absendung, die sie gar nicht schrieb:
      // wer nach einer verlorenen Antwort seinen Text nachbesserte und erneut sendete, bekam ein
      // HTTP 200 über den ALTEN Beitrag, während der neue nirgends landete (BEN, Runde 4).
      // Dieselbe Absendung heisst: derselbe Verfasser, derselbe Text, derselbe Antwortbezug.
      if (clientKey && bestand.some((c) => gleicheAbsendung(c, author, text, replyTo, clientKey))) {
        return { ko, geschrieben: false };
      }
      if (replyTo && !bestand.some((c) => c.id === replyTo)) {
        throw new KoError(
          "COMMENT_NOT_FOUND",
          "Der Beitrag, auf den geantwortet werden soll, gehört nicht zu diesem Wissensobjekt.",
        );
      }
      const comment: KoComment = { ...neu, koVersion: ko.version };
      const updated: KnowledgeObject = { ...ko, comments: [...bestand, comment] };
      await this.repo.update(updated);
      return { ko: updated, geschrieben: true };
    };

    let ergebnis: { ko: KnowledgeObject; geschrieben: boolean };
    try {
      ergebnis = await versuch();
    } catch (fehler) {
      if (!(fehler instanceof KoError) || fehler.code !== "STALE_WRITE") {
        throw fehler;
      }
      // Frisch lesen und EINMAL erneut anfügen. Der Beitrag des anderen Schreibers steht dabei
      // bereits im Bestand und wird mitgenommen — er verschwindet nicht.
      ergebnis = await versuch();
    }
    if (ergebnis.geschrieben) {
      await this.audit?.record({ actor: author, action: "ko.commented", target: id });
    }
    return ergebnis.ko;
  }

  // ==============================================================================================
  // JOB 4146 — DEN FADEN ALS GEKLÄRT MARKIEREN, UND WIEDER ÖFFNEN.
  // ==============================================================================================
  //
  // ERLEDIGT HEISST GEKLÄRT, NICHT FREIGEGEBEN. Diese Fläche fasst `status`, `ownership`, `version`,
  // `trust` und jeden anderen Freigabeanteil des Wissensobjekts NICHT an — sie setzt genau ein Feld
  // an genau einem Beitrag. Der Vertrag (HINWEIS Runde 1, Punkt 5) sagt es ausdrücklich: ein als
  // wesentlich markierter Einwand sperrt nur nach einer ausdrücklich geltenden Freigaberegel, und
  // dieser Auftrag führt keine ein.
  //
  // DER STAND HÄNGT AM WURZELBEITRAG DES FADENS, auch wenn jemand die ANTWORT erledigt: „geklärt"
  // ist eine Aussage über die SACHE. Zwei Stände in einem Faden wären zwei Wahrheiten über dieselbe
  // Frage — und die Fläche müsste sich für eine entscheiden.
  async setCommentResolution(
    id: string,
    commentId: string,
    actor: string,
    state: KoCommentResolution["state"],
  ): Promise<KnowledgeObject> {
    return this.mutateKo(id, (ko) => {
      const bestand = ko.comments ?? [];
      const wurzel = fadenWurzel(bestand, commentId);
      const at = new Date(this.now()).toISOString();
      const updated: KnowledgeObject = {
        ...ko,
        comments: bestand.map((c) =>
          c.id === wurzel.id ? { ...c, resolution: { state, by: actor, at } } : c,
        ),
      };
      return {
        updated,
        value: updated,
        audit: async () => {
          await this.audit?.record({
            actor,
            action: state === "erledigt" ? "ko.comment-resolved" : "ko.comment-reopened",
            target: id,
            payload: { commentId: wurzel.id },
          });
        },
      };
    });
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
  //
  // JOB 4077 — DER ANKER WIRD NICHT MEHR WEGGEWORFEN. `input.objectId` ist ein KANDIDAT, keine
  // Tatsache: er kommt aus dem Rumpf des Clients. Bestätigt wird er HIER, gegen die Anhangsliste
  // des Objekts, das dieser Aufruf ohnehin schon geladen hat (`this.require(id)`) — also gegen den
  // FRISCHEN Bestand im selben Read-Modify-Write, nicht gegen eine Momentaufnahme des Aufrufers.
  //
  // WARUM DIE BESTÄTIGUNG HIER STEHT UND NICHT BEIM AUFRUFER: der Aufrufer (die Route) beschafft
  // dieselbe Tatsache für die STUFENENTSCHEIDUNG, und zwar nur dort, wo sie etwas entscheiden kann
  // (adresslose Quelle auf restriktiver Stufe). Für das SPEICHERN muss sie immer vorliegen. Sie
  // dort zu verbreitern hiesse, den Eingang der Sicherheitsgrenze anzufassen, um ein Anzeigefeld
  // zu füllen. Hier ist sie eine Eigenschaft des Schreibvorgangs: wer über diese Methode schreibt,
  // kann keinen unbestätigten Anker in den Bestand bringen — auch ein künftiger zweiter Aufrufer
  // nicht. Die Entscheidung selbst (`decideExternalAttach`) sieht davon kein Zeichen.
  //
  // Ein nicht bestätigter Anker ist KEIN Fehler: er war schon bisher folgenlos (die Stufenregel
  // liest ihn als „kein Anker"), und ein neuer 4xx wäre eine Ablehnung, die es vorher nicht gab.
  // Das Feld bleibt dann schlicht weg — dieselbe Form wie bei `provider`.
  async addSource(
    id: string,
    author: string,
    input: {
      label: string;
      url?: string | null;
      excerpt?: string | null;
      provider?: string | null;
      objectId?: string | null;
    },
  ): Promise<KnowledgeObject> {
    const label = input.label?.trim() ?? "";
    if (label.length === 0) {
      throw new KoError("INVALID_SOURCE", "Quellen-Label fehlt.");
    }
    const ko = await this.require(id);
    const provider = input.provider?.trim() ? input.provider.trim() : null;
    const anchor = confirmedSourceAnchor(ko.attachments, input.objectId);
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
      // JOB 4077: der BESTÄTIGTE Anker — oder gar nichts. Kein `null`, kein Leerstring: ein
      // weggelassenes Feld ist dasselbe wie am Altbestand, und die Fläche liest beides als „keine
      // Datei" (`quellennachweis`).
      ...(anchor ? { objectId: anchor } : {}),
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

  // ==============================================================================================
  // JOB 3071 — DIE EINE PAPIERKORBFÄHIGE AUSKUNFT: HAT DER AUTOR SELBST ZURÜCKGEZOGEN?
  // ==============================================================================================
  //
  // Sie beantwortet GENAU eine Frage und gibt GENAU eine Kennung heraus — oder nichts. Kein Titel,
  // kein Inhalt, keine Vertraulichkeitsstufe verlässt sie; sie ist damit auch dann unbedenklich,
  // wenn ein anderes Modul sie über einen Port ruft (services/conflicts kennt den Bestand nicht).
  //
  // WARUM SIE ÜBER `repo.findById` LIEST UND NICHT ÜBER `get` — die ausgeschriebene Begründung der
  // Ausnahme: `get` blendet getrashte Objekte grundsätzlich aus (`:2753-2756`, SCRUM-422), und
  // genau ein getrashtes Objekt ist hier der Normalfall. Der einzige Aufrufer ist der Nachlauf der
  // Löschroute, und der läuft NACH `ko.delete` — zu diesem Zeitpunkt liegt das Objekt bereits im
  // Papierkorb. Eine Auskunft über `get` bekäme `undefined` und antwortete immer „nein". Sie ist
  // damit die dritte Stelle des Dienstes, die den Papierkorb absichtlich sieht (neben `trashed()`
  // und `restore()`), und die einzige, die es für einen fremden Aufrufer tut.
  //
  // SIE SCHREIBT NICHT und sie entscheidet nicht: sie stellt zwei Felder desselben Datensatzes
  // gegenüber, die das weiche Löschen selbst gesetzt hat (`:3930`: `deletedBy`) bzw. die Anlage
  // (`author`). Altbestand ohne `deletedBy` fällt auf `null` — es wird nichts geraten.
  async eigeneRuecknahmeVon(koId: string): Promise<string | null> {
    const ko = await this.repo.findById(koId);
    if (!ko?.deletedAt || !ko.deletedBy) {
      return null;
    }
    return ko.deletedBy === ko.author ? ko.deletedBy : null;
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
  //
  // JOB 2696 (R2-34): Vorher stand hier `(await this.repo.list({})).find(…)` — der GANZE Bestand,
  // mit `bodyHtml`, im Speicher durchsucht, und das bis zu viermal je Import-Annahme. Die Spalte
  // `import_candidate_id` mit ihrem partiellen Unique-Index gibt es seit WP-SHIP8-CLOSE-4; der
  // schnelle Weg war vorhanden und wurde nicht benutzt.
  //
  // Die Zusage darüber bleibt unverändert: Auch ein getrashtes Objekt wird gefunden. `list({})`
  // lief ohne WHERE, die neue Abfrage filtert nur auf die Kennung — Papierkorb inklusive, wie es
  // der Recovery-Vertrag verlangt.
  async findByImportCandidateId(candidateId: string): Promise<KnowledgeObject | undefined> {
    return this.repo.findByImportCandidateId(candidateId);
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
        return { captionTexts: [], imageNames: [], projection: undefined, v2Migriert: false };
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
      // 3) WP-BILD-1g/1h: das abgeleitete captionTexts-Feld — und seit JOB 3111 · B1b in
      //    DEMSELBEN Durchgang das imageNames-Feld (die Benennungen). Beide hängen an derselben
      //    teuren Zutat, dem vollen bodyHtml, das oben EINMAL geladen wurde; ein zweiter
      //    Single-Flight oder ein zweiter Read wäre genau der Fehler, den G27 hier beseitigt hat.
      let captionTexts = ko.captionTexts;
      let imageNames = ko.imageNames;
      // WP-D11b (bens patches53-GELB): Race — ein nebenläufiger Voll-Write (revise/create) hat ein
      // Feld zwischen unserem Read und dem bedingten Write gesetzt. Dann müssen die AKTUELLEN Werte
      // nachgeladen werden, nie der alte Scan, der die frischeren Angaben verfehlen würde. Beide
      // Felder teilen sich dieses eine Nachladen (ein schmaler Einzel-KO-Read, höchstens einer).
      let nachladen = false;
      if (captionTexts === undefined) {
        captionTexts = searchCaptionTexts(ko.bodyHtml);
        nachladen = !(await this.repo.setCaptionTexts(id, captionTexts)) || nachladen;
      }
      if (imageNames === undefined) {
        imageNames = searchImageNames(ko.bodyHtml);
        nachladen = !(await this.repo.setImageNames(id, imageNames)) || nachladen;
      }
      if (nachladen) {
        const fresh = await this.repo.findById(id);
        return {
          captionTexts: fresh?.captionTexts ?? captionTexts,
          imageNames: fresh?.imageNames ?? imageNames,
          projection,
          v2Migriert,
        };
      }
      return { captionTexts, imageNames, projection, v2Migriert };
    })().finally(() => {
      this.searchBackfillsInFlight.delete(id);
    });
    this.searchBackfillsInFlight.set(id, run);
    return run;
  }

  async ensureCaptionTexts(id: string): Promise<string[]> {
    return (await this.ensureSearchArtifacts(id)).captionTexts;
  }

  // JOB 3111 · B1b: der symmetrische Lesezugang zu den Benennungen. Er STÖSST den Nachzug an
  // (dieselbe eine Vollladung) und liefert danach den Stand, der wirklich persistiert ist.
  async ensureImageNames(id: string): Promise<string[]> {
    return (await this.ensureSearchArtifacts(id)).imageNames;
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
  //
  // ==============================================================================================
  // JOB 3053 — WER IM DECKEL ÜBERLEBT: HIER IST DIE FUNDSTELLE DAS MASS, NICHT DIE VERLÄSSLICHKEIT.
  // ==============================================================================================
  //
  // DIE ANGABE, DIE DIESE METHODE MACHT: `deckelauswahl: "trefferguete"` (JOB 3048,
  // `search-projection.ts:945`). Sie wirkt AUSSCHLIESSLICH zusammen mit `limit` und entscheidet
  // allein darüber, WER bei überfülltem Deckel überhaupt in der Menge steht.
  //
  // WARUM. Eine gedeckelte Suche kann zwei verschiedene Fragen meinen. Die Bibliothek fragt „gib
  // mir die 200 Treffer, die ich einer Liste zeigen will" — dort ist die Verlässlichkeit das
  // richtige Maß, und sie fragt deshalb ohne diese Angabe: `LIBRARY_SEARCH_HIT_LIMIT = 200` steht
  // in `services/library-analytics/src/service.ts:208` und wird ebendort in :1334 gesetzt. Ihre
  // Trefferliste bleibt damit Zeichen für Zeichen dieselbe; sie ist neben dieser Methode der
  // einzige Aufrufer von `findSearchHits` (per Grep erhoben, s. unten).
  //
  // Dieser Weg dagegen fragt „gib mir die Objekte, aus denen etwas werden soll". Was hier
  // nicht in der Vorauswahl steht, kann gar nicht erst Antwort, Dublette oder Widerspruch werden —
  // ein hoher Vertrauenswert nützt nichts, wenn das Objekt gar nicht vom Fragebegriff HANDELT.
  // Deshalb überlebt zuerst die stärkere Fundstelle (Titel vor Aussage vor Einordnung vor Fußnote
  // vor Körper), und erst bei Gleichstand wieder validiert ↓, Trust ↓, koId.
  //
  // DIE DREI VERBRAUCHER, vollständig erhoben mit
  // `grep -rn "findCandidates(" --include='*.ts' . | grep -v node_modules | grep -v test` —
  // für alle drei ist die Fundstelle das richtige Maß, und alle drei erben die Angabe, weil sie
  // durch DIESE eine Methode gehen:
  //   · KLARA (`services/ask/src/service.ts:560`, Deckel 50 je Fragebegriff): das Objekt, das den
  //     Fragebegriff im Titel trägt, ist die Quelle, nach der Pedi fragt. Fällt es im Deckel weg,
  //     meldet Klara eine Wissenslücke, obwohl das Wissen im Haus liegt.
  //   · TEXTPRÜFUNG (`services/app/src/check-text-detection.ts:232`, Deckel
  //     `DETECTION_CANDIDATE_CAP` = 20): eine Dublette ist ein Objekt zum SELBEN Thema. Ein
  //     Titeltreffer ist dafür das stärkere Signal als ein hoher Trust; was der Deckel wegwirft,
  //     kann keine Überschneidung mehr melden.
  //   · WISSENSPRÜFUNG (`services/app/src/knowledge-check.ts:134`, Deckel 40): derselbe Grund. Ein
  //     Widerspruch, der nie in den Kandidatenpool kam, wird stillschweigend zu „kein Widerspruch".
  //
  // WAS SICH NICHT ÄNDERT: die AUSGABEREIHENFOLGE. Sie bleibt `validiert ↓, Trust ↓, koId` — das
  // Titel-Objekt kommt HEREIN, es rückt nicht nach vorn. Kein Objekt wird dadurch
  // vertrauenswürdiger dargestellt, als es ist. `findSearchHits` behält seinen Vertrag: ohne
  // Angabe gilt weiter `vertrauen`, ein Aufrufer, der nichts sagt, bekommt nichts Neues. Und ohne
  // greifendes `limit` ist die Angabe wirkungslos — dann deckelt der Aufrufer selbst.
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
    const hits = await this.findSearchHits({
      terms: query.terms,
      limit: query.limit,
      deckelauswahl: "trefferguete",
    });
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
  // ==============================================================================================
  // JOB 3071 R3 — DIE VORABLESUNG DER RÜCKNAHME, BEGRENZT UND FEHLERFEST.
  // ==============================================================================================
  //
  // Sie ruft `eigeneRuecknahmeVon` (:2777) und macht aus JEDEM Ausgang eine Antwort:
  //
  //   Kennung / null   die Auskunft selbst — sie reist über `PurgeTxCleanup` in die Transaktion.
  //   wirft synchron   der RUF steht im try, nicht nur sein Ergebnis: ein Adapter, der schon an der
  //                    Anweisung scheitert, flöge sonst aus `purgeKo` heraus und liesse den Beitrag
  //                    im Papierkorb stehen.
  //   lehnt ab         wie „wirft".
  //   schweigt         nach `ruecknahmeFrist` ms wie „wirft" — sonst hielte eine hängende
  //                    Verbindung die Endlöschung für immer an.
  //
  // In allen drei Fehlerfällen: GENAU EINE Meldung auf `onError` (die Verriegelung `gemeldet` sorgt
  // dafür, dass eine späte Ablehnung nach abgelaufener Frist kein zweiter Fehler wird), Rückgabe
  // `null`, und die Endlöschung läuft weiter. Sie ist bewusst dieselbe Bauart wie
  // `OverlapService.ruecknahmeAutor` und nicht dieselbe Funktion: die beiden wohnen in verschiedenen
  // Modulen, und ein gemeinsames Zuhause dafür wäre eine neue Modulkante — im Haus stehen aus
  // demselben Grund bereits mehrere eigene `Promise.race`-Fristen (capture-routes, wikipedia,
  // rest-client).
  private async ruecknahmeVorab(id: string): Promise<string | null> {
    let gemeldet = false;
    const melden = (grund: string, error: unknown): null => {
      if (!gemeldet) {
        gemeldet = true;
        this.onError(`${grund} (${id})`, error);
      }
      return null;
    };
    let gerufen: Promise<string | null>;
    try {
      gerufen = Promise.resolve(this.eigeneRuecknahmeVon(id));
    } catch (error) {
      return melden("eigene Rücknahme vor der Endlöschung nicht ermittelbar", error);
    }
    let uhr: ReturnType<typeof setTimeout> | undefined;
    const antwort = gerufen.then(
      (kennung) => kennung ?? null,
      (error) => melden("eigene Rücknahme vor der Endlöschung nicht ermittelbar", error),
    );
    const frist = new Promise<string | null>((fertig) => {
      uhr = setTimeout(() => {
        fertig(
          melden(
            "eigene Rücknahme vor der Endlöschung nicht rechtzeitig ermittelbar",
            new Error(`Rücknahme-Auskunft hat ${this.ruecknahmeFrist} ms nicht geantwortet`),
          ),
        );
      }, this.ruecknahmeFrist);
    });
    try {
      return await Promise.race([antwort, frist]);
    } finally {
      clearTimeout(uhr);
    }
  }

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
    // ============================================================================================
    // JOB 1104 (S0-TX) — DER TRANSAKTIONSGEBUNDENE AUFRÄUMSCHRITT, ERSTER SCHRITT IN (B).
    // ============================================================================================
    //
    // WARUM ER VOR `repo.delete` STEHT UND NICHT DANACH — zwei unabhängige, beide zwingende Gründe
    // (JOB 1045 D4 §2.3):
    //
    //   1. REFERENZIELLE INTEGRITÄT. Ein Folgeartefakt referenziert das Objekt. Wird das KO zuerst
    //      gelöscht, verletzt jede noch stehende Zeile die Regel „kein Verweis ohne Ziel" — bei
    //      einem Fremdschlüssel ohne Kaskade schlägt das Delete schlicht fehl.
    //   2. DER PAYLOAD-BEITRAG. Die Zahl entfernter Artefakte muss vorliegen, BEVOR `audit.record`
    //      den `ko.purged`-Beleg schreibt. Sonst belegte das Audit einen Vorgang, dessen Umfang es
    //      nicht kennt.
    //
    // Jeder Fehler hier verlässt den Transaktionskörper; `withPgTx` rollt zurück und reicht ihn
    // weiter. Ergebnis: nichts aufgeräumt, kein KO gelöscht, kein Beleg. Genau das unterscheidet
    // dieses Fenster vom vorgeschalteten `onPurge`, in dem ein nicht idempotenter Schreiber ein
    // Datenverlustfenster wäre.
    //
    // JOB 3071 R2 (bens Korrekturpflicht 2): DIESE eine Lesung steht ABSICHTLICH VOR `withTx` und
    // nicht darin. Sie beantwortet „hat der Autor selbst zurückgezogen?" (`eigeneRuecknahmeVon`,
    // :2777) und ist eine Punktabfrage am POOL — im Transaktionskörper wäre sie genau der
    // Vertragsbruch, den `PurgeTxCleanup` oben ausschliesst: bei erschöpftem Pool wartete sie auf
    // eine Verbindung, die erst der Commit DIESER Transaktion freigibt (bei Poolgröße 1 auf sich
    // selbst — die Endlöschung endete nie). Hier hält der Vorgang noch nichts, und die Antwort ist
    // dieselbe: gelöscht wird das Objekt erst in der Transaktion.
    //
    // JOB 3071 R3 (bens Korrekturpflicht 2 zu R2): sie steht VOR der Transaktion — aber sie ist eine
    // ZUGABE, keine Bedingung. R2 wartete hier roh, und damit riss eine Ablehnung die Endlöschung
    // mit sich (`BEN_PURGE http=500 imPapierkorb=true befund=offen`) und ein Schweigen hielt sie an
    // (`BEN_PURGE_TIMEOUT ergebnis=blockiert befund=offen`). Ein Beitrag darf nicht deshalb stehen
    // bleiben, weil eine Nebenauskunft über IHN nicht zu haben war. `ruecknahmeVorab` fängt beides
    // ab (s. dort) und liefert dann `null` — der systemische Grund, ehrlich: gelesen wurde nichts.
    const zurueckgezogenVon = await this.ruecknahmeVorab(id);
    const beitragAus = async (tx: TxContext | undefined): Promise<Record<string, unknown>> =>
      (await this.onPurgeTx?.(id, actor, tx, { zurueckgezogenVon })) ?? {};
    // 2) Delete + Audit — s. (B) oben. MIT withTx: EINE echte DB-Transaktion, beide Schreiber
    // committen/rollbacken gemeinsam. OHNE withTx: sequentieller Fallback (Audit vor Delete, WP-A).
    if (this.withTx && audit) {
      await this.withTx(async (tx) => {
        const beitrag = await beitragAus(tx);
        await this.repo.delete(id, tx);
        await audit.record({ ...auditInput, payload: { ...auditInput.payload, ...beitrag } }, tx);
      });
      // G27: der abgeleitete Suchindex folgt der Endlöschung. NACH dem Commit und bewusst
      // fehlertolerant: das Objekt ist weg, die Standardsuche kann eine verwaiste Zeile ohnehin
      // nicht mehr zeigen (der JOIN auf `kos` trägt sie nicht) — ein Fehler hier darf einen
      // vollzogenen, belegten Purge nicht nachträglich zum Scheitern bringen.
      await this.searchProjections.removeByKo(id).catch(() => undefined);
      return;
    }
    // Sequentieller Fallback — ausdrücklich OHNE Atomaritätszusage (D4 §2.5). Er ist NUR in
    // Kompositionen ohne echte Datenbank erreichbar (InMemory, Dev-Journal); wo es keine
    // Transaktionsgrenze gibt, behauptet dieser Vertrag auch keine. Der Haken läuft trotzdem —
    // sonst bliebe in genau diesen Kompositionen ein verwaistes Folgeartefakt stehen.
    const beitragOhneTx = await beitragAus(undefined);
    await audit?.record({ ...auditInput, payload: { ...auditInput.payload, ...beitragOhneTx } });
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

  // ==============================================================================================
  // JOB 3667 (WORD-RÜCKWEG, Runde 2) — DER BEDINGTE SCHREIBZUGRIFF, IM DIENST STATT AN DER ROUTE.
  // ==============================================================================================
  //
  // Runde 1 hat die Version an der ROUTE verglichen, vor dem Dienstaufruf. Das war ein Zeitfenster
  // und kein Compare-and-Set: zwischen Lesen und Schreiben konnte ein zweiter Schreiber liegen.
  // HIER ist es ein CAS — die Prüfung läuft IM `build` von `mutateKoTx`, also innerhalb desselben
  // per-KO serialisierten Abschnitts (`withKoLock`), in dem auch geschrieben wird. Wirft sie, ist
  // nichts geschrieben: kein Stand, kein Snapshot, keine Projektion, kein Beleg.
  //
  // OHNE `expectedVersion` ändert sich NICHTS am Altverhalten — jeder heutige Aufrufer (Web-Editor,
  // Import, Dokumentübernahme) ruft weiter unbedingt.
  private pruefeErwarteteVersion(ko: KnowledgeObject, erwartet: number | undefined): void {
    if (erwartet !== undefined && ko.version !== erwartet) {
      throw new KoError(
        "KO_STALE",
        `Das Wissensobjekt wurde inzwischen geändert (jetzt Version ${ko.version}, erwartet ${erwartet}). Es wurde nichts überschrieben.`,
      );
    }
  }

  // ==============================================================================================
  // JOB 4213 (WIKI-NACHVOLLZIEHEN) — DIE HERKUNFTSANGABE EINER ÜBERNAHME, GEPRÜFT STATT GEGLAUBT.
  // ==============================================================================================
  //
  // RUNDE 2 · WARUM DIE ANGABE NICHT IN `ReviseKoInput` OBEN STEHT, sondern hier unten als eigener
  // Typ: über `ReviseKoInput` (`:427`) läge sie 3.500 Zeilen weiter oben, und JEDE Zeile, die dort
  // dazukommt, verschiebt `findSearchHits` (`:1809`) und `findCandidates` (`:3691-3715`). Auf genau
  // diese Zeilen zeigen zwei Wegweiser in `services/knowledge-object/src/repo.ts` und
  // `services/app/src/knowledge-check.ts` — beide NICHT Zielpfad dieses Auftrags, beide am Quelltext
  // nachgeschlagen von `tests/live-check-postgres-prefilter/toter-kandidatenweg.test.ts` und
  // `tests/live-check-suchwoerter/begruendung-nennt-die-gebaute-kette.test.ts`. Runde 1 hat sie
  // verschoben und die beiden fremden Dateien nachgeführt; das war ein Zielpfad-Verstoß. Diese
  // Deklaration steht deshalb UNTERHALB von `:3715` — sie erweitert dasselbe Eingabeobjekt,
  // verschiebt aber keine Zeile, auf die jemand von aussen zeigt.
  //
  // FACHLICH IST SIE KEIN ZWEITER SCHREIBWEG, sondern eine ANGABE ÜBER DIESEN: geschrieben wird über
  // `revise` — dieselbe Transaktion, derselbe Lock, derselbe bedingte Schreibzugriff über
  // `expectedVersion`.
  //
  // RUNDE 3 · DER INHALT KOMMT NICHT MEHR VOM AUFRUFER, SONDERN AUS DER ABGELEGTEN FASSUNG.
  //
  // BENs Befund an Runde 2 (`BEN Herkunft {"http":200,"statement":"ERFUNDENER INHALT","herkunft":1}`):
  // die Zahl wurde gegen den Zahlenbereich geprüft, der INHALT daneben aber geglaubt. Damit liess
  // sich beliebiger neuer Text mit `restoredFromVersion: 1` speichern, und die Fläche schrieb
  // anschliessend „aus Fassung v1 übernommen" darüber — eine Auskunft, die im Datensatz steht und
  // niemand mehr richtigstellen kann.
  //
  // JETZT IST DIE HERKUNFT KEINE BEHAUPTUNG MEHR, SONDERN EINE KONSTRUKTION: eine Übernahme schickt
  // GAR KEINEN Inhalt (`pruefeUebernahmeEingabe` weist einen mitgeschickten ab), und der Dienst holt
  // die sieben Inhaltsfelder aus dem gespeicherten Schnappschuss (`uebernahmeAusFassung`). Was
  // gespeichert wird, IST damit die genannte Fassung — es gibt keinen Weg mehr, an dem beides
  // auseinanderfallen könnte, und keine Ähnlichkeitsheuristik, die man umgehen müsste.
  //
  // WAS SIE NICHT ÜBERTRÄGT: Prüfstand, Vertrauenswert und die tragenden Identitäten der alten
  // Fassung. Die entstehende Fassung ist UNGEPRÜFT — s. `naechsteFassung`.
  //
  // Sie wird IM serialisierten Abschnitt geprüft, gegen den dort gelesenen Stand — genau wie
  // `pruefeErwarteteVersion` daneben und aus demselben Grund: eine Prüfung vor dem Lock wäre ein
  // Zeitfenster. Wirft sie, ist nichts geschrieben.
  //
  // DREI ABWEISUNGEN, jede mit ihrem Grund: keine ganze Zahl, kleiner als 1, oder grösser als die
  // gerade gespeicherte Version. Der dritte Fall ist der wichtige — eine Fassung aus der Zukunft
  // gibt es nicht, und „übernommen aus v9" an einem Objekt mit vier Fassungen wäre eine Auskunft,
  // die niemand mehr richtigstellen kann.
  private pruefeHerkunft(ko: KnowledgeObject, herkunft: number | undefined): void {
    if (herkunft === undefined) {
      return;
    }
    if (!Number.isInteger(herkunft) || herkunft < 1 || herkunft > ko.version) {
      // DER CODE IST DER VORHANDENE ALLGEMEINE EINGABEFEHLER, und das ist eine Entscheidung: ein
      // eigener Code müsste in `ERLAUBTE_FEHLERCODES` (`services/app/src/build-app.ts`) eingetragen
      // werden, und diese Datei liegt ausdrücklich nicht in den Zielpfaden dieses Auftrags. `INVALID`
      // geht über `http.ts` als 400 hinaus — genau die Aussage, die hier gilt: die Anfrage ist
      // falsch, nicht der Zustand. Was falsch ist, steht im Meldungstext.
      throw new KoError(
        "INVALID",
        `restoredFromVersion muss eine gespeicherte Fassung dieses Wissensobjekts sein (1 bis ${ko.version}), nicht ${String(herkunft)}.`,
      );
    }
  }

  /**
   * JOB 4213 R3 · EINE ÜBERNAHME BRINGT KEINEN EIGENEN INHALT MIT.
   *
   * Der Aufrufer sagt NUR, welche Fassung er zurückholen will. Käme daneben ein Inhaltsfeld an,
   * wäre die Absicht doppeldeutig — „nimm v1" und „aber mit diesem Text" —, und genau daraus ist in
   * Runde 2 die falsche Herkunftsauskunft entstanden. Abgewiesen statt still verworfen: ein
   * verworfener Text wäre ein Verlust, von dem der Mensch nichts erführe.
   */
  private pruefeUebernahmeEingabe(changes: ReviseMitHerkunft): void {
    if (changes.restoredFromVersion === undefined) {
      return;
    }
    const mitgeschickt = (
      [
        "title",
        "statement",
        "type",
        "conditions",
        "measures",
        "bodyHtml",
        "asset",
        "sources",
      ] as const
    ).filter((feld) => changes[feld] !== undefined);
    if (mitgeschickt.length > 0) {
      throw new KoError(
        "INVALID",
        `Eine Übernahme holt den Inhalt aus der genannten Fassung; zusätzliche Inhaltsfelder werden nicht angenommen (mitgeschickt: ${mitgeschickt.join(", ")}).`,
      );
    }
  }

  /**
   * JOB 4213 R3 · DER INHALT DER FASSUNG, DIE ZURÜCKGEHOLT WIRD — aus der Ablage gelesen.
   *
   * VOR dem Lock, und das ist hier richtig: die Schnappschuss-Ablage ist append-only (`repo.ts:468`,
   * „von `append` nie ersetzt"), eine abgelegte Fassung ändert sich also nicht mehr. Es gibt kein
   * Zeitfenster, das ein Lock schliessen könnte. Was IM Lock geprüft wird, ist die Beziehung zum
   * AKTUELLEN Stand — Versionsbereich (`pruefeHerkunft`) und Anhangsfundstellen
   * (`pruefeUebernahmeAnhaenge`); beides hängt an `ko` und steht deshalb dort.
   *
   * OHNE ABLAGE KEINE ÜBERNAHME: `this.versions` ist optional. Fehlt sie oder fehlt die Fassung,
   * wird abgewiesen — fail-closed. Eine Übernahme „auf gut Glück" gibt es nicht; sie würde den
   * Inhalt des aktuellen Standes stehen lassen und trotzdem „aus Fassung vN übernommen" behaupten.
   */
  private async uebernahmeAusFassung(
    id: string,
    version: number,
  ): Promise<{ inhalt: ReviseKoInput; bekannteKennungen: string[] }> {
    const abgelegt = (await this.versions?.listByKo(id)) ?? [];
    const fassung = abgelegt.find((eintrag) => eintrag.version === version)?.snapshot;
    if (!fassung) {
      throw new KoError(
        "INVALID",
        `Zu Version ${version} dieses Wissensobjekts ist kein Stand gespeichert; es gibt nichts zu übernehmen.`,
      );
    }
    // GENAU DIE INHALTSFELDER, die auch der Fassungsvergleich kennt (`apps/web/src/lib/koVersionDiff.ts`),
    // ohne `status`: der Prüfstand wird vom Vorgang gesetzt und nie aus einer alten Fassung geerbt.
    // `asset` reist NICHT mit — die kanonische Anlagenkennung ist die Identität des Objekts, nicht
    // der Inhalt einer Fassung; `sources` ebenso wenig (sie bleiben über Revisionen erhalten).
    //
    // JOB 4213 R5 · DIE ANHANGSKENNUNGEN DER ALTEN FASSUNG REISEN MIT — nicht als Inhalt, sondern als
    // WISSEN: sie sind die einzigen Objektkennungen, die dieser Dienst OHNE Formerkennung kennt
    // (`KnowledgeObject.attachments[].objectId`, serverseitig gesetzt). `pruefeUebernahmeAnhaenge`
    // braucht sie, um auch eine Kennung zu finden, die im alten Bericht als blosser Text steht und
    // keiner Form folgt. Übernommen werden die Anhänge selbst NICHT — `naechsteFassung` behält die
    // des aktuellen Standes.
    return {
      inhalt: {
        title: fassung.title,
        statement: fassung.statement,
        type: fassung.type,
        conditions: fassung.conditions ?? [],
        measures: fassung.measures ?? [],
        bodyHtml: fassung.bodyHtml ?? null,
      },
      // `objectId` ist am Anhang optional (`KoAttachment`) — ein Eintrag ohne Kennung ist keine
      // Fundstelle und fällt hier heraus, statt als `undefined` weiterzureisen.
      bekannteKennungen: (fassung.attachments ?? [])
        .map((a) => a.objectId)
        .filter((kennung): kennung is string => typeof kennung === "string" && kennung.length > 0),
    };
  }

  /**
   * JOB 4213 R5 · JEDE OBJEKTKENNUNG IM ZURÜCKZUHOLENDEN BERICHT — in JEDER Form, die autorisiert.
   *
   * BENs Befund an Runde 4 (`BEN Klartextkennung {"uebernahme":200,"rohbytesDanach":200}`): Runde 3
   * suchte nur `/api/objects/<id>/raw`. `services/app/src/sichtbarkeit.ts` fragt aber schlicht
   * `bodyHtml.includes(objectId)` (`zuordnungAmObjekt`) — eine Kennung als blosser Text im Bericht
   * ist damit GENAUSO autorisierungswirksam, und sie lief durch. Die Fundstellenform war zu eng
   * gewählt, nicht die Regel.
   *
   * DREI QUELLEN, und sie ergänzen einander bewusst:
   *   (a) DIE PRODUKTIONSFORM EINER KENNUNG: eine UUID. Jede Objektkennung entsteht aus
   *       `randomUUID()` (`services/object-store/src/service.ts`, `genId`). Dieses Muster fängt die
   *       Kennung an JEDER Stelle des Berichts — in einer URL, in einem Attribut, in reinem Text.
   *       Es ist damit deckungsgleich mit dem `includes` der Sichtbarkeitsregel.
   *   (b) DIE URL-FORM. Sie bleibt, weil sie auch eine Kennung fängt, die KEINE UUID ist — etwa aus
   *       einem Bestand, dessen `genId` überschrieben war.
   *   (c) DIE BEKANNTEN ANHÄNGE DER ALTEN FASSUNG, formunabhängig: steht eine dort geführte Kennung
   *       irgendwo im Bericht, zählt sie. Das ist die einzige Quelle ohne jede Formannahme.
   *
   * DIE VERBLEIBENDE GRENZE, benannt statt weggelassen: eine Kennung, die weder UUID-förmig ist noch
   * in der URL-Form steht noch als Anhang der alten Fassung geführt wird, findet dieser Leser nicht.
   * Über den Produktionsweg kann sie nicht entstehen (`randomUUID`); ein Bestand mit eigenem `genId`
   * könnte sie tragen. Vollständig schlösse das nur eine Liste aller Objektkennungen — die liegt im
   * object-store und damit hinter einer Modulgrenze, die dieser Dienst nicht überschreitet.
   *
   * FAIL-CLOSED IN KAUF GENOMMEN: eine UUID-förmige Zeichenfolge, die gar kein Objekt bezeichnet,
   * blockiert die Übernahme, wenn sie im aktuellen Stand fehlt. Lieber eine Übernahme zu viel
   * abgewiesen als eine Datei zu viel geöffnet.
   */
  private kennungenImBericht(bericht: string, bekannte: readonly string[]): string[] {
    const gefunden = new Set<string>();
    for (const treffer of bericht.matchAll(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    )) {
      gefunden.add(treffer[0]);
    }
    for (const treffer of bericht.matchAll(/\/api\/objects\/([^/"'\s?#]+)\/raw/g)) {
      if (treffer[1]) {
        gefunden.add(treffer[1]);
      }
    }
    for (const kennung of bekannte) {
      if (kennung.length > 0 && bericht.includes(kennung)) {
        gefunden.add(kennung);
      }
    }
    return [...gefunden];
  }

  // ==============================================================================================
  // JOB 4213 R3 — EINE ÜBERNAHME BELEBT KEINE ANHANGSFUNDSTELLE WIEDER.
  // ==============================================================================================
  //
  // BENs Befund an Runde 2 (`BEN Anhang {"vorher":404,"nachher":200,"version":3}`): eine Bildkennung
  // steht in v1, wird in v2 aus dem Bericht entfernt, und der HOCHLADENDE holt v1 als v3 zurück.
  // Danach bekamen Dritte die Rohbytes.
  //
  // WARUM: `services/app/src/sichtbarkeit.ts` (`zuordnungInFassung`) misst die Urheberschaft einer
  // reinen Fliesstext-Fundstelle als DIFFERENZ ZUM UNMITTELBAREN VORGÄNGER — „kannte schon der
  // Vorgänger diese Kennung, ist sie mitkopiert, und Mitkopieren ist keine Urheberschaft". Gegenüber
  // v2 ist die Kennung in v3 aber NEU, obwohl sie in Wahrheit aus v1 mitkopiert ist. Die Regel ist
  // richtig; sie kann diesen Sprung nur nicht sehen.
  //
  // WO DAS BEHOBEN WIRD: HIER, nicht dort. `sichtbarkeit.ts` ist nicht Zielpfad dieses Auftrags —
  // und es ist auch die schwächere Stelle: dort müsste die Regel raten, ob ein Sprung stattfand.
  // Der Dienst WEISS es. Die Zusage lautet deshalb, und sie ist schärfer als die dortige Messung:
  //
  //     NACH EINER ÜBERNAHME NENNT DER BERICHT KEINE OBJEKTKENNUNG, DIE DER AKTUELLE STAND NICHT
  //     SCHON NENNT.
  //
  // Damit ist die Vorgänger-Differenz in `sichtbarkeit.ts` für jede Übernahme LEER — der Fall kann
  // gar nicht mehr entstehen, und zwar unabhängig davon, wie dort künftig gemessen wird.
  //
  // ABGEWIESEN, NICHT STILL BESCHNITTEN: Referenzen aus dem alten Bericht zu löschen wäre ein
  // Inhaltsverlust, von dem niemand erführe. Der Mensch bekommt gesagt, WELCHE Bilder im Weg stehen,
  // und kann sie am aktuellen Stand wieder anhängen, bevor er zurückholt.
  //
  // WELCHE FUNDSTELLEN GESUCHT WERDEN, steht bei `kennungenImBericht` — RUNDE 5 hat das von der
  // URL-Form auf JEDE autorisierungswirksame Form geweitet (BENs `BEN Klartextkennung`).
  //
  // Und „der aktuelle Stand nennt sie" heisst hier dasselbe wie in `zuordnungAmObjekt`: ein
  // `attachments`-Eintrag ODER die Kennung im Bericht — ein Anhangseintrag trägt seinen eigenen,
  // serverseitig gesetzten Urheber und wird von der Vorgänger-Differenz ohnehin nicht angehoben.
  private pruefeUebernahmeAnhaenge(
    ko: KnowledgeObject,
    zurueckgeholt: ReviseKoInput,
    bekannteKennungen: readonly string[],
  ): void {
    const alt = typeof zurueckgeholt.bodyHtml === "string" ? zurueckgeholt.bodyHtml : "";
    const jetzt = typeof ko.bodyHtml === "string" ? ko.bodyHtml : "";
    const anhaenge = new Set((ko.attachments ?? []).map((a) => a.objectId));
    const heimatlos = this.kennungenImBericht(alt, bekannteKennungen).filter(
      (kennung) => !jetzt.includes(kennung) && !anhaenge.has(kennung),
    );
    if (heimatlos.length > 0) {
      throw new KoError(
        "INVALID",
        `Diese Fassung nennt Dateien, die am aktuellen Stand nicht mehr hängen (${heimatlos.join(", ")}). Sie lässt sich so nicht zurückholen — hänge sie zuerst wieder an.`,
      );
    }
  }

  // FR-KO-04: Überarbeiten erhöht Version, setzt Bewertungen zurück, erzeugt History-Eintrag.
  //
  // JOB 3667 R2: `opts.expectedVersion` macht daraus einen BEDINGTEN Schreibzugriff (s. o.).
  //
  // JOB 4213: `changes.restoredFromVersion` macht daraus die ÜBERNAHME eines früheren Standes. Kein
  // zweiter Schreibweg, keine zweite Route — dieselbe Transaktion, derselbe Lock, dasselbe CAS.
  async revise(
    id: string,
    changes: ReviseMitHerkunft,
    author: string,
    opts: { expectedVersion?: number } = {},
  ): Promise<KnowledgeObject> {
    if (changes.type && !KNOWLEDGE_TYPES.includes(changes.type)) {
      throw new KoError("INVALID_TYPE", "Unbekannte Wissensart.");
    }
    // JOB 4213 R3: eine Übernahme bringt keinen eigenen Inhalt mit, und was geschrieben wird, holt
    // der Dienst aus der abgelegten Fassung. Beides steht VOR dem Lock — die Eingabeprüfung braucht
    // keinen Stand, und die Ablage ist append-only (Begründung bei `uebernahmeAusFassung`).
    this.pruefeUebernahmeEingabe(changes);
    const herkunft = changes.restoredFromVersion;
    const zurueckgeholt =
      herkunft === undefined ? undefined : await this.uebernahmeAusFassung(id, herkunft);
    const wirksameAenderung: ReviseMitHerkunft =
      herkunft === undefined || zurueckgeholt === undefined
        ? changes
        : { ...zurueckgeholt.inhalt, restoredFromVersion: herkunft };
    // SCRUM-507 R2/R3: die Revision läuft transaktional über mutateKoTx — per-KO serialisiert
    // (withKoLock, atomar gegen eine nebenläufige Bewertung, die denselben Lock + CAS nutzt) UND mit
    // vollständigem Rollback: schlägt der Versions-Snapshot ODER der Audit NACH der Persistenz fehl, wird
    // der KO (inkl. Versions-Bump/Reset auf „offen"/Trust 0) kompensierend zurückgerollt und ein bereits
    // geschriebener Snapshot entfernt — kein Teilzustand, keine unauditierte Änderung. Die Bewertungen
    // werden NICHT gelöscht: sie tragen ihre koVersion und sind ab der neuen Version implizit „stale".
    return this.mutateKoTx(id, (ko) => {
      // JOB 3667 R2: der bedingte Schreibzugriff, INNERHALB des serialisierten Abschnitts.
      this.pruefeErwarteteVersion(ko, opts.expectedVersion);
      // JOB 4213: und die Herkunftsangabe, im selben Abschnitt und gegen denselben gelesenen Stand.
      this.pruefeHerkunft(ko, herkunft);
      // JOB 4213 R3: und die Anhangsfundstellen — ebenfalls gegen DIESEN gelesenen Stand, weil die
      // Frage „hängt die Datei noch am Objekt?" nur am aktuellen Stand zu beantworten ist.
      if (zurueckgeholt !== undefined) {
        this.pruefeUebernahmeAnhaenge(ko, zurueckgeholt.inhalt, zurueckgeholt.bekannteKennungen);
      }
      const revised = this.naechsteFassung(ko, wirksameAenderung, author);
      const version = revised.version;
      return {
        updated: revised,
        value: revised,
        // SCRUM-159: neuen Versions-Snapshot persistieren; frühere Versionen bleiben unverändert.
        //
        // JOB 4213 · RUNDE 2 — DER VERMERK BLEIBT „überarbeitet", AUCH BEI EINER ÜBERNAHME, und das
        // ist eine Entscheidung wie schon in JOB 3667 R7 („überarbeitet und freigegeben"). Ein
        // SECHSTER fester Dienst-Vermerk ist nur halb geliefert, solange er nicht übersetzt wird:
        // die Anzeige bildet ihn über `apps/web/src/lib/koHistoryNote.ts` auf einen Katalogschlüssel
        // ab, und diese Datei ist NICHT Zielpfad dieses Auftrags (Runde 1 hat sie angefasst — das
        // war der Zielpfad-Verstoß). Ohne Eintrag dort stünde das deutsche Wort mitten im englischen
        // und niederländischen Text, genau der Befund, gegen den JOB 3627 steht.
        //
        // ES GEHT NICHTS VERLOREN: WAS geschah, sagt der Vermerk (überarbeitet); DASS der Inhalt aus
        // einer früheren Fassung stammt, sagt der Datensatz selbst — `history[].restoredFrom` (s.
        // `naechsteFassung`), und die Fläche setzt daraus ihren eigenen, übersetzten Satz
        // (`ko.snapshotRestoredFrom`). Der Vermerk hätte das nur ein zweites Mal behauptet.
        snapshot: { author, note: "überarbeitet" },
        // JOB 2704 D1: der Beleg läuft auf dem Transaktionsclient der Revision (tx aus mutateKoTx,
        // undefined ohne withTx) — er committet und verschwindet mit ihr.
        audit: async (tx) => {
          await this.audit?.record(
            {
              actor: author,
              action: "ko.revised",
              target: id,
              payload: { version },
            },
            tx,
          );
        },
      };
    });
  }

  // ==============================================================================================
  // JOB 3667 (WORD-RÜCKWEG, Runde 2) — DIE NÄCHSTE FASSUNG, AN GENAU EINER STELLE GEBAUT.
  // ==============================================================================================
  //
  // Dieser Block stand bis hierher INLINE in `revise`. Er ist herausgezogen, weil ihn jetzt DREI
  // Wege brauchen — `revise`, `reviseUndFreigeben` und die Übernahme eines Vorschlags — und weil
  // eine zweite Abschrift der Fassungslogik (captionTexts, imageNames, Quellen-Allowlist,
  // Kennungs-Normalform) genau die zweite Wahrheit wäre, die bei der nächsten Änderung auseinander
  // läuft. Gemessen wird das nicht an dieser Methode, sondern an den Wegen, die sie benutzen.
  //
  // `freigabe` IST DER EINZIGE UNTERSCHIED zwischen „überarbeitet" und „überarbeitet und
  // freigegeben": Prüfstand, Vertrauenswert, Historienvermerk und die tragende Identität
  // (`ownership.validators`) — alles andere ist Zeichen für Zeichen dasselbe. Der Vertrauenswert
  // kommt VON AUSSEN (die Route reicht `TRUST_MAX` aus dem validation-Modul durch): dieser Dienst
  // darf die Trust-Skala nicht kennen, und eine 99 an dieser Stelle wäre eine Abschrift.
  private naechsteFassung(
    ko: KnowledgeObject,
    changes: ReviseMitHerkunft,
    author: string,
    freigabe?: { actor: string; trust: number },
  ): KnowledgeObject {
    const version = ko.version + 1;
    const at = new Date(this.now()).toISOString();
    // ============================================================================================
    // JOB 4213 · EINE ZURÜCKGEHOLTE FASSUNG IST UNGEPRÜFT — UND ZWAR SERVERSEITIG.
    // ============================================================================================
    //
    // `uebernahme` ist die Version, aus der der mitgeschickte Inhalt stammt (`undefined` bei jeder
    // gewöhnlichen Überarbeitung). Geprüft wurde sie im aufrufenden `mutateKoTx`-Abschnitt.
    //
    // SIE HEBT EINE GLEICHZEITIGE FREIGABE AUF. Ohne diese Zeile könnte ein Aufruf über
    // `revise-release` einen alten Stand zurückholen und ihn in derselben Bewegung freigeben — die
    // Freigabe gälte dann für einen Inhalt, den in dieser Fassung niemand geprüft hat. Sie wäre
    // nicht einmal eine neue Freigabe, sondern die Wiederauferstehung einer alten. Wer den
    // zurückgeholten Stand freigeben will, tut es danach, sichtbar, als eigenen Schritt.
    //
    // DAMIT IST DIE ZUSAGE EINE SERVERZUSAGE und keine Auslassung im Client: `status` und `trust`
    // werden HIER gesetzt, aus dem Vorgang und nicht aus der Eingabe. `ReviseMitHerkunft` führt
    // weder `status` noch `trust` noch `ownership` — ein Aufruf, der sie mitschickt, erreicht diese
    // Felder gar nicht; und was er nicht erreicht, kann er auch nicht erben.
    const uebernahme = changes.restoredFromVersion;
    const wirkendeFreigabe = uebernahme === undefined ? freigabe : undefined;
    // KW-STR: neuer Body wird sanitisiert; statement ggf. daraus abgeleitet.
    //
    // JOB 3667 R5: die Fallunterscheidung steht in `rumpfDerFassung` (s. dort) — dieselbe Regel,
    // die auch die Übernahme eines Vorschlags spricht. Zwei Abschriften davon wären genau die
    // zweite Wahrheit, an der diese Runde gescheitert ist.
    const nextBody = rumpfDerFassung(changes.bodyHtml, ko.bodyHtml);
    const nextStatement =
      changes.statement ??
      (changes.bodyHtml !== undefined && nextBody ? htmlToPlainText(nextBody) : ko.statement);
    const fassung: KnowledgeObject = {
      ...ko,
      title: changes.title ?? ko.title,
      statement: nextStatement,
      bodyHtml: nextBody,
      // WP-BILD-1g: Fußnoten-Suchfeld beim Überarbeiten mitführen — eine Caption-Änderung im
      // Editor aktualisiert das Feld; unveränderte Bodies backfillen Legacy-KOs nebenbei.
      captionTexts: searchCaptionTexts(nextBody),
      // JOB 3111 · B1b: die Benennungen ziehen beim Überarbeiten mit — ein umbenanntes oder
      // ausgetauschtes Bild ändert das Suchfeld, unveränderte Rümpfe heilen Legacy-KOs nebenbei.
      imageNames: searchImageNames(nextBody),
      type: changes.type ?? ko.type,
      conditions: changes.conditions ?? ko.conditions,
      measures: changes.measures ?? ko.measures,
      version,
      // Ohne Freigabe: Bewertungen der Vorversion zählen nicht mehr (versionsgebunden, R2) und das
      // Objekt muss neu validiert werden. MIT Freigabe entscheidet der freigabeberechtigte Mensch
      // in DEMSELBEN Vorgang — es gibt keinen Augenblick, in dem der neue Text ungeprüft dasteht.
      trust: wirkendeFreigabe ? wirkendeFreigabe.trust : 0,
      status: wirkendeFreigabe ? "validiert" : "offen",
      // JOB 3667 RUNDE 7 · DER VERMERK BLEIBT „überarbeitet", AUCH MIT FREIGABE — und das ist eine
      // Entscheidung, keine Nachlässigkeit. Runde 5/6 schrieb hier und an den beiden Schnappschüssen
      // unten einen SECHSTEN festen Vermerk („überarbeitet und freigegeben"). Ein fester Vermerk des
      // Dienstes ist aber nur halb geliefert, solange er nicht übersetzt wird: die Anzeige bildet ihn
      // über `apps/web/src/lib/koHistoryNote.ts` auf einen Katalogschlüssel ab, und OHNE Eintrag dort
      // stünde das deutsche Wort mitten im englischen und niederländischen Text — genau der Befund,
      // gegen den JOB 3627 steht. Diese Datei liegt nicht in den Zielpfaden dieses Auftrags; sie ist
      // in der Rückgabe namentlich gemeldet.
      //
      // ES GEHT DABEI NICHTS VERLOREN, und das ist der Grund, warum das kein Notbehelf ist: WAS
      // geschah, sagt der Vermerk (überarbeitet); DASS es zugleich freigegeben wurde, sagt der
      // Datensatz selbst — `status: "validiert"`, der Vertrauenswert, die tragende Identität in
      // `ownership.validators` (s. u.) und zwei Belege (`ko.revised` UND `ko.admin-validated`).
      // Der Vermerk war die einzige Stelle, die das ein zweites Mal behauptet hätte.
      //
      // JOB 4213 · AUS DEMSELBEN GRUND TRÄGT AUCH EINE ÜBERNAHME DEN VERMERK „überarbeitet". Was sie
      // von einer gewöhnlichen Revision unterscheidet, steht als ZAHL daneben: `restoredFrom` nennt
      // die Fassung, aus der der Inhalt stammt. Eine Zahl braucht keine Übersetzung — ein Vermerk
      // „übernommen aus v2" lautete für jede Version anders und käme durch den zeichengenauen
      // Katalog (`koHistoryNote.ts`) nicht hindurch. Das Feld steht NUR an einer Übernahme; fehlt
      // es, ist das die ehrliche Aussage „dieser Eintrag entstand nicht aus einer Übernahme" und
      // nicht „aus Version 0".
      history: [
        ...ko.history,
        {
          version,
          at,
          author,
          note: "überarbeitet",
          ...(uebernahme === undefined ? {} : { restoredFrom: uebernahme }),
        },
      ],
      // SCRUM-129: Quellen über Revisionen erhalten; SCRUM-470: optional fortschreiben (Re-Sync-Anker).
      // SCRUM-527 (WP2): Allowlist auf jede Quell-URL — säubert auch Altbestand beim nächsten Revise.
      sources: sanitizeSources(changes.sources ?? ko.sources ?? []),
      // JOB 593 / D9 — DER KORREKTURWEG UND DER ALTBESTANDSVERTRAG IN EINER ZEILE.
      //
      // KORREKTUR (BEN-Auflage 1): eine mitgelieferte Kennung ersetzt die bisherige — durch
      // DIESELBE `normalizeAsset` wie beim Anlegen. Eine zweite Normalform am zweiten
      // Schreibrand wäre genau die zweite Wahrheit zurück, die Option A beseitigt.
      //
      // ALTBESTAND (BEN-Auflage 2): kommt KEINE Kennung mit, wird die bestehende trotzdem durch
      // die Normalform geführt. Damit heilt jedes Objekt bei seiner nächsten Revision, ohne
      // Massenlauf und ohne Datenberührung ohne Anlass. Das ist kein neues Verfahren, sondern
      // das Hausmuster der Zeile direkt darüber: `sanitizeSources` „säubert auch Altbestand
      // beim nächsten Revise" (SCRUM-527/WP2). Zwei Wanderungswege für dieselbe Sorte
      // Altlast wären eine Regel zu viel.
      //
      // VERLUSTSCHUTZ: Die Heilung wirkt nur auf den LEBENDEN Stand und schreibt die Historie
      // nicht um. Die Vorversion hält den rohen Wert fest, wie er geschrieben wurde — ihr
      // Snapshot entsteht beim Anlegen (`snapshot(ko, author, "erstellt")`, s. u.) und wird
      // von `append` nie ersetzt (repo.ts:468). Der einzige Fall, in dem überhaupt Zeichen
      // verschwinden, ist eine Kennung aus reinem Leerraum — sie konnte nie eine Information
      // tragen.
      asset: normalizeAsset(changes.asset !== undefined ? changes.asset : ko.asset),
    };
    if (!wirkendeFreigabe) {
      return fassung;
    }
    // JOB 557: eine abgeschlossene Validierung schreibt fort, WER sie getragen hat. Dieselbe
    // Rollenfolge wie am Bewertungsweg (`recordOwnershipRole`), nur HIER im selben Objekt — ein
    // zweiter Schreibvorgang wäre ein zweiter Zustand und (über `withKoLock`) nicht einmal möglich.
    const ownership = withRole(ownershipOf(fassung), "validators", [wirkendeFreigabe.actor]);
    return ownership === null ? fassung : { ...fassung, ownership };
  }

  // ==============================================================================================
  // JOB 3667 (WORD-RÜCKWEG, Runde 2) — FALL 1: ÜBERARBEITEN UND FREIGEBEN ALS EIN VORGANG.
  // ==============================================================================================
  //
  // PEDIS REGEL (SICHTBARES-GESPRAECH.jsonl:693): wer die Freigabe hat, legt die Änderung „gleich
  // als geprüft" ab. Runde 1 hat das aus ZWEI Aufrufen gebaut — `revise`, dann `admin-validate` —
  // und der Prüfer hat genau die Lücke dazwischen benannt: fremder Text, der in dieser Spanne
  // geschrieben wird, wäre mitfreigegeben worden, weil die Freigabe an keiner Version hing.
  //
  // HIER GIBT ES DIE SPANNE NICHT MEHR. Neue Fassung, Prüfstand, Vertrauenswert und die tragende
  // Identität entstehen in DEMSELBEN `mutateKoTx` — derselbe per-KO serialisierte Abschnitt,
  // dieselbe Transaktion, derselbe Rollback. Freigegeben wird damit ausschliesslich die Fassung,
  // die dieser Aufruf selbst geschrieben hat; eine andere kann es gar nicht sein.
  //
  // ZWEI BELEGE, NICHT EINER: der Vorgang ist eine Überarbeitung UND eine Freigabe, und beide
  // Auswertungen sollen ihn finden. Eine neue, dritte Audit-Vokabel hätte jeden Leser, der nach
  // `ko.admin-validated` sucht, an diesem Vorgang vorbeilaufen lassen.
  //
  // WER DAS DARF, entscheidet die Route (`users.manage`, wie bei `ValidationService.adminValidate`).
  // Dieser Dienst kennt keine Rechte — er bekommt den Akteur und den Vertrauenswert gereicht.
  async reviseUndFreigeben(
    id: string,
    changes: ReviseMitHerkunft,
    actor: string,
    opts: { trust: number; expectedVersion?: number },
  ): Promise<KnowledgeObject> {
    if (changes.type && !KNOWLEDGE_TYPES.includes(changes.type)) {
      throw new KoError("INVALID_TYPE", "Unbekannte Wissensart.");
    }
    // JOB 4213 R3: dieselben drei Zusagen wie an `revise` — dieser Weg ist derselbe Schreibvorgang
    // mit Freigabe, und eine Übernahme darf sich hier nicht an ihnen vorbeimogeln.
    this.pruefeUebernahmeEingabe(changes);
    const herkunft = changes.restoredFromVersion;
    const zurueckgeholt =
      herkunft === undefined ? undefined : await this.uebernahmeAusFassung(id, herkunft);
    const wirksameAenderung: ReviseMitHerkunft =
      herkunft === undefined || zurueckgeholt === undefined
        ? changes
        : { ...zurueckgeholt.inhalt, restoredFromVersion: herkunft };
    return this.mutateKoTx(id, (ko) => {
      this.pruefeErwarteteVersion(ko, opts.expectedVersion);
      // JOB 4213: auch hier geprüft, nicht geglaubt. Eine Übernahme über DIESEN Weg bliebe trotzdem
      // ungeprüft — `naechsteFassung` hebt die gleichzeitige Freigabe auf (s. dort); die Prüfung hier
      // verhindert bloss, dass eine erfundene Herkunftszahl in den Datensatz läuft.
      this.pruefeHerkunft(ko, herkunft);
      if (zurueckgeholt !== undefined) {
        this.pruefeUebernahmeAnhaenge(ko, zurueckgeholt.inhalt, zurueckgeholt.bekannteKennungen);
      }
      const fassung = this.naechsteFassung(ko, wirksameAenderung, actor, {
        actor,
        trust: opts.trust,
      });
      const version = fassung.version;
      return {
        updated: fassung,
        value: fassung,
        // Derselbe Vermerk wie an jeder anderen Überarbeitung — die Begründung steht bei
        // `naechsteFassung` (JOB 3667 Runde 7). Die Freigabe belegen die zwei Einträge unten.
        snapshot: { author: actor, note: "überarbeitet" },
        audit: async (tx) => {
          await this.audit?.record(
            { actor, action: "ko.revised", target: id, payload: { version } },
            tx,
          );
          await this.audit?.record(
            { actor, action: "ko.admin-validated", target: id, payload: { koVersion: version } },
            tx,
          );
        },
      };
    });
  }

  // ==============================================================================================
  // JOB 3667 (WORD-RÜCKWEG, Runde 2) — FALL 2: DEN VORSCHLAG EINREICHEN.
  // ==============================================================================================
  //
  // ER ÄNDERT AM OBJEKT NICHTS ausser seiner eigenen Liste: kein Versionssprung, kein neuer
  // Inhalt, kein Prüfstandswechsel, kein Snapshot. Genau das ist die Zusage „bis dahin liest das
  // Objekt weiterhin den alten geprüften Stand" — sie ist hier kein Versprechen der Oberfläche,
  // sondern die Bauform des Schreibvorgangs.
  //
  // MIT CAS AUF DIE GRUNDLAGE: `baseVersion` ist die Fassung, die der Einreicher gesehen hat. Hat
  // sich das Objekt inzwischen bewegt, wird der Vorschlag ABGEWIESEN (`KO_STALE`) statt an eine
  // Fassung gehängt, die es nicht mehr gibt. Der Mensch lädt neu und entscheidet selbst.
  //
  // JOB 3667 R5 — WAS DER VORSCHLAG AM FLIESSTEXT WILL, STEHT IM VORSCHLAG UND WIRD NICHT GERATEN.
  // Ein mitgeschickter Rumpf wird gesäubert abgelegt. KEIN Rumpf heisst „nicht eingereicht": das
  // Feld fehlt dann, und die Übernahme lässt den bestehenden stehen. Die Löschung ist ein eigenes
  // Feld (`clearBody`) — sie kann nicht als Nebenwirkung eines leeren Rumpfes entstehen.
  async addProposal(
    id: string,
    author: string,
    input: {
      statement: string;
      bodyHtml?: string | null;
      clearBody?: boolean;
      baseVersion: number;
      origin?: string;
    },
  ): Promise<{ ko: KnowledgeObject; proposal: KoProposal }> {
    const statement = input.statement.trim();
    if (statement.length === 0) {
      // Ein leerer Vorschlag ist kein Vorschlag — und als Übernahme wäre er eine Löschung.
      throw new KoError("INVALID_SOURCE", "Ein Änderungsvorschlag braucht einen Text.");
    }
    const rumpf = cleanBody(input.bodyHtml);
    if (input.clearBody === true && rumpf !== null) {
      // Beides zugleich wäre zwei Absichten in einem Vorschlag — welche gölte, wäre geraten.
      throw new KoError(
        "INVALID_SOURCE",
        "Ein Änderungsvorschlag kann den Fließtext ersetzen ODER löschen, nicht beides.",
      );
    }
    return this.mutateKo(id, (ko) => {
      this.pruefeErwarteteVersion(ko, input.baseVersion);
      const proposal: KoProposal = {
        id: this.genId(),
        author,
        at: new Date(this.now()).toISOString(),
        baseVersion: ko.version,
        statement,
        // Kein Rumpf und keine Löschabsicht → das Feld steht gar nicht erst da.
        ...(rumpf !== null ? { bodyHtml: rumpf } : {}),
        ...(input.clearBody === true ? { clearBody: true } : {}),
        status: "offen",
        ...(input.origin ? { origin: input.origin } : {}),
      };
      const updated: KnowledgeObject = { ...ko, proposals: [...(ko.proposals ?? []), proposal] };
      return {
        updated,
        value: { ko: updated, proposal },
        audit: async () => {
          await this.audit?.record({
            actor: author,
            action: "ko.proposed",
            target: id,
            payload: { proposalId: proposal.id, baseVersion: proposal.baseVersion },
          });
        },
      };
    });
  }

  // ==============================================================================================
  // JOB 3667 (WORD-RÜCKWEG, Runde 2) — DIE ENTSCHEIDUNG ÜBER EINEN VORSCHLAG.
  // ==============================================================================================
  //
  // DREI REGELN, UND SIE STEHEN HIER UND NICHT IN DER OBERFLÄCHE:
  //  1. Der Vorschlag muss OFFEN sein. Ein zweites Mal wirkt er nicht (`PROPOSAL_DECIDED`) — die
  //     Wiederholung, die es beim Kommentar-Träger von Runde 1 gar nicht geben konnte.
  //  2. Der Entscheider darf NICHT der Einreicher sein (`PROPOSAL_OWN`). „Dies muss nochmal von
  //     jemand anders überprüft werden" heisst genau das; ein Fenster, das den Knopf ausblendet,
  //     hält diese Regel nicht — die Route ist offen, und sie wird direkt aufgerufen werden.
  //  3. Bei der Übernahme entsteht die neue Fassung MIT der Freigabe in einem Zug (s.
  //     `reviseUndFreigeben`), und der Vorschlag trägt danach, wer wann entschied und welche
  //     Fassung daraus wurde.
  //
  // DIE ABLEHNUNG SCHREIBT KEINEN INHALT: sie setzt den Zustand und hält die Begründung fest. Ohne
  // sie wäre „abgelehnt" eine Tatsache ohne Auskunft.
  async decideProposal(
    id: string,
    proposalId: string,
    actor: string,
    entscheidung: "uebernehmen" | "ablehnen",
    opts: { trust: number; expectedVersion?: number; note?: string },
  ): Promise<{ ko: KnowledgeObject; proposal: KoProposal }> {
    return this.mutateKoTx(id, (ko) => {
      this.pruefeErwarteteVersion(ko, opts.expectedVersion);
      const offen = ko.proposals ?? [];
      const vorschlag = offen.find((p) => p.id === proposalId);
      if (!vorschlag) {
        throw new KoError(
          "PROPOSAL_NOT_FOUND",
          "Dieser Änderungsvorschlag gehört nicht zu diesem Wissensobjekt.",
        );
      }
      if (vorschlag.status !== "offen") {
        throw new KoError(
          "PROPOSAL_DECIDED",
          `Über diesen Änderungsvorschlag ist bereits entschieden (${vorschlag.status}).`,
        );
      }
      if (vorschlag.author === actor) {
        throw new KoError(
          "PROPOSAL_OWN",
          "Den eigenen Änderungsvorschlag gibt niemand selbst frei — er muss von jemand anders geprüft werden.",
        );
      }
      const entschiedenAm = new Date(this.now()).toISOString();
      if (entscheidung === "ablehnen") {
        const abgelehnt: KoProposal = {
          ...vorschlag,
          status: "abgelehnt",
          decidedBy: actor,
          decidedAt: entschiedenAm,
          ...(opts.note ? { note: opts.note } : {}),
        };
        const updated: KnowledgeObject = {
          ...ko,
          proposals: offen.map((p) => (p.id === proposalId ? abgelehnt : p)),
        };
        return {
          updated,
          value: { ko: updated, proposal: abgelehnt },
          // KEIN Snapshot: es ist keine neue Inhaltsfassung entstanden.
          audit: async (tx) => {
            await this.audit?.record(
              {
                actor,
                action: "ko.proposal-rejected",
                target: id,
                payload: { proposalId, baseVersion: vorschlag.baseVersion },
              },
              tx,
            );
          },
        };
      }
      // JOB 3667 R5: `rumpfAusVorschlag` statt `?? null` — ein Vorschlag OHNE Fließtext (so reicht
      // Word ein) lässt den bestehenden stehen; geleert wird nur auf `clearBody`. Die frühere Zeile
      // hätte bei jeder reinen Textänderung aus Word das ganze Dokument des Objekts entfernt.
      const fassung = this.naechsteFassung(
        ko,
        { statement: vorschlag.statement, ...rumpfAusVorschlag(vorschlag) },
        vorschlag.author,
        { actor, trust: opts.trust },
      );
      const uebernommen: KoProposal = {
        ...vorschlag,
        status: "uebernommen",
        decidedBy: actor,
        decidedAt: entschiedenAm,
        resultVersion: fassung.version,
        ...(opts.note ? { note: opts.note } : {}),
      };
      const updated: KnowledgeObject = {
        ...fassung,
        proposals: offen.map((p) => (p.id === proposalId ? uebernommen : p)),
      };
      return {
        updated,
        value: { ko: updated, proposal: uebernommen },
        // Der Snapshot nennt den EINREICHER als Urheber der Fassung (er hat den Text geschrieben);
        // wer sie freigegeben hat, steht im Beleg und in `ownership.validators`.
        // Wie oben: der Vermerk nennt die Überarbeitung, die Freigabe belegen `status`, die
        // Validator-Identität und die zwei Audit-Einträge (JOB 3667 Runde 7).
        snapshot: { author: vorschlag.author, note: "überarbeitet" },
        audit: async (tx) => {
          await this.audit?.record(
            {
              actor: vorschlag.author,
              action: "ko.revised",
              target: id,
              payload: { version: fassung.version, proposalId },
            },
            tx,
          );
          await this.audit?.record(
            {
              actor,
              action: "ko.admin-validated",
              target: id,
              payload: { koVersion: fassung.version, proposalId },
            },
            tx,
          );
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
      //
      // JOB 4077: und jede von ihnen trägt den ANKER des Anhangs, der eine Zeile höher entsteht.
      // Hier braucht es KEINE zusätzliche Bestätigung gegen die Anhangsliste — im Gegenteil, sie
      // wäre falsch: der Anhang liegt in diesem Augenblick noch nicht im Bestand. Er wird von
      // DIESEM Schreibvorgang gebunden, aus einer Kennung, die der Aufrufer im eigenen
      // Objektspeicher nachgeschlagen hat (`objects.metadata`, ko-routes.ts) und die
      // `requireDocumentEvidence` durchlaufen hat. Der Server behauptet also nichts, was er nicht
      // unmittelbar danach selbst herstellt — derselbe Satz, der an der Route steht.
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
          objectId: anchorObjectId,
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
          // JOB 3111 · B1b: der dritte Schreibrand (Dokumentinhalt übernehmen) setzt beide Felder.
          imageNames: searchImageNames(nextBody),
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
  //
  // ==============================================================================================
  // JOB 4251 — UND SEIT DIESEM AUFTRAG KANN DERSELBE PFAD BEDINGT SCHREIBEN.
  // ==============================================================================================
  //
  // DER VERGLEICH STEHT IM LOCK UND VOR JEDEM SCHREIBVORGANG — es ist ein Compare-and-Set, kein
  // Zeitfenster: zwischen dem Lesen des Stempels und `repo.update` kann kein zweiter Schreiber
  // liegen, weil beides in DEMSELBEN per-KO serialisierten Abschnitt läuft. Wirft er, ist nichts
  // geschrieben: kein Stand, keine Projektion, kein Beleg, kein Revisions-Bump.
  //
  // UND ER STEHT VOR DER IDENTISCHEN WIEDERHOLUNG, nicht dahinter. Das ist eine Entscheidung: der
  // Stempel klettert AUSSCHLIESSLICH bei einer fachlich wirksamen Änderung. Stimmt er nicht mehr,
  // hat jemand die Einordnung wirklich bewegt — auch dann, wenn der eigene Wert zufällig derselbe
  // ist. Ein stiller Erfolg wäre hier die Unwahrheit: der Mensch hielte einen Stand für bestätigt,
  // den er nie gesehen hat. Die Zeilen der Wiederholung selbst bleiben unangetastet.
  //
  // EIN FEHLER, KEIN No-op: `setValidationState` darf schweigen (dort entscheidet eine Bewertung
  // über eine überholte Fassung, und es gibt niemanden, dem etwas zu sagen wäre). Hier sitzt ein
  // Mensch davor, dessen Eingabe nicht angekommen ist — er muss es erfahren. Der Code ist
  // `KO_STALE`, derselbe, den der bedingte Inhaltsweg schon benutzt: eine zweite Vokabel für
  // dieselbe Tatsache wäre eine zweite Auslegung.
  private async mutateKoMetadata(
    id: string,
    actor: string,
    beleg: { action: string; grund: string },
    apply: (ko: KnowledgeObject) => KnowledgeObject,
    opts: EinordnungsBedingung = {},
  ): Promise<KnowledgeObject> {
    return this.withKoLock(id, async () => {
      const before = await this.require(id);
      const stand = await this.searchProjections.metadata.find(id);
      // GIBT ES KEINE ZEILE, GIBT ES KEINEN STAND: `undefined` ist dann nie gleich einer erwarteten
      // Zahl, und der Aufruf wird abgewiesen statt stillschweigend durchgelassen. Das ist die
      // strengere und die wahre Auslegung — wer einen Stand erwartet, den es nicht gibt, hat nicht
      // gesehen, was jetzt gilt.
      if (
        opts.expectedMetadataRevision !== undefined &&
        stand?.metadataRevision !== opts.expectedMetadataRevision
      ) {
        throw new KoError(
          "KO_STALE",
          `Die Einordnung dieses Wissensobjekts wurde inzwischen geändert (jetzt Stand ${stand?.metadataRevision ?? "keiner"}, erwartet ${opts.expectedMetadataRevision}). Es wurde nichts überschrieben.`,
        );
      }
      // Die Inhaltsfassung wird NUR betrachtet, wenn der Aufrufer sie mitgibt — über dieselbe eine
      // Stelle, die auch der Inhaltsweg benutzt (`pruefeErwarteteVersion`).
      this.pruefeErwarteteVersion(before, opts.expectedVersion);
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
        const unveraendert = await this.projectMetadata(before, new Date(this.now()).toISOString());
        // JOB 4251: die Quittung gilt auch hier. „Es hat sich nichts geändert" ist ein gültiger
        // Ausgang, und der Aufrufer braucht danach denselben Stempel wie nach jedem anderen — sonst
        // liefe sein nächster Schritt gegen einen Stand, den er nicht kennt.
        opts.meldeMetadatenstand?.(unveraendert.projection.metadataRevision);
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
        // ERST HIER, nach dem Beleg: gemeldet wird nur ein Stand, der auch WIRKLICH gilt. Scheitert
        // die Projektion oder der Beleg, läuft die Kompensation unten — und der Aufrufer hat dann
        // keinen Stempel bekommen, den er für bestätigt halten könnte.
        opts.meldeMetadatenstand?.(ergebnis.projection.metadataRevision);
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

  // ==============================================================================================
  // JOB 4251 R2 — DER LESESTAND DER EINORDNUNG: WERT UND STEMPEL AUS EINER KLAMMER.
  // ==============================================================================================
  //
  // DER FEHLER, DEN DIESE METHODE SCHLIESST (BEN, Korrekturpflicht 1). Runde 1 las an der Route
  // ZWEI Dinge nacheinander und ohne Klammer: erst das Wissensobjekt (mit Kategorie und
  // Schlagwörtern), dann getrennt die `metadata_revision`. Wer im Fenster dazwischen schrieb,
  // schickte dem Leser ALTE Werte mit dem NEUEN Stempel — und damit war der Schutz dieses Auftrags
  // an genau dieser Stelle UMGEDREHT: der Stempel beglaubigte das Überschreiben einer Einordnung,
  // die der Mensch nie gesehen hatte. BENs Messung wörtlich: `expected 200 to be 409`.
  //
  // DIE KLAMMER IST DIESELBE, IN DER AUCH GESCHRIEBEN WIRD (`withKoLock`, per KO serialisiert).
  // Damit ist „Wert und Stempel gehören zusammen" keine Absprache zwischen zwei Aufrufern mehr,
  // sondern eine Eigenschaft dieses einen Lesevorgangs. Ein zweiter Leseweg daneben entsteht nicht:
  // wer den Stempel will, holt ihn hier — und bekommt die Werte, zu denen er gehört, gleich mit.
  //
  // SIE GIBT AUSSCHLIESSLICH DIE EINORDNUNG HERAUS, und das ist eine Entscheidung, keine Sparsamkeit:
  // Kategorie und Schlagwörter sind nach KW-ARCH-G27 ausdrücklich KEINE Sicherheitsmerkmale (die
  // Metadatenprojektion nimmt keine Einstufung auf). Das Sichtbarkeitsurteil der Route fällt
  // weiterhin am Objekt, das sie selbst geladen hat; würde diese Methode ein volles, frischeres
  // Objekt liefern, könnte ein zwischenzeitliches Vertraulichkeits-Upgrade an einem Gate
  // vorbeilaufen, das über den älteren Stand entschieden hat.
  //
  // `undefined` heisst „das Objekt gibt es (nicht mehr)" — nicht „keine Einordnung". Fehlt nur die
  // Projektionszeile (Altbestand), steht `metadataRevision` nicht darin: dieselbe Regel wie überall
  // in diesem Auftrag — fehlt heisst fehlt, geraten wird nichts.
  async einordnungsstandVon(
    id: string,
  ): Promise<{ category: string; tags: string[]; metadataRevision?: number } | undefined> {
    return this.withKoLock(id, async () => {
      const ko = await this.repo.findById(id);
      if (!ko || ko.deletedAt) {
        return undefined;
      }
      const projektion = await this.searchProjections.metadata.find(id);
      return {
        category: ko.category,
        tags: [...(ko.tags ?? [])],
        ...(projektion ? { metadataRevision: projektion.metadataRevision } : {}),
      };
    });
  }

  // JOB 4251: `opts` ist der bedingte Schreibzugriff auf die Einordnung (s. `EinordnungsBedingung`).
  // Er ist optional, und ohne ihn ist dieser Aufruf Zeichen für Zeichen der bisherige.
  async updateCategory(
    id: string,
    category: string,
    actor = "system",
    opts: EinordnungsBedingung = {},
  ): Promise<KnowledgeObject> {
    return this.mutateKoMetadata(
      id,
      actor,
      { action: "ko.category-changed", grund: "ko.updateCategory" },
      (ko) => ({ ...ko, category }),
      opts,
    );
  }

  async updateTags(
    id: string,
    tags: string[],
    actor = "system",
    opts: EinordnungsBedingung = {},
  ): Promise<KnowledgeObject> {
    return this.mutateKoMetadata(
      id,
      actor,
      { action: "ko.tags-changed", grund: "ko.updateTags" },
      (ko) => ({ ...ko, tags }),
      opts,
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

// ==================================================================================================
// JOB 4213 (WIKI-NACHVOLLZIEHEN) — DIE EINGABE EINER REVISION, DIE EINEN FRÜHEREN STAND ZURÜCKHOLT.
// ==================================================================================================
//
// EIN ORT STATT DREIER ANNOTATIONEN: `revise`, `reviseUndFreigeben` und `naechsteFassung` nehmen
// dieselbe Eingabe entgegen; dreimal `ReviseKoInput & { restoredFromVersion?: number }` hinzuschreiben
// wäre dieselbe Aussage dreimal.
//
// WARUM AM DATEIENDE UND NICHT BEI `ReviseKoInput` (`:427`): Typdeklarationen gelten in TypeScript
// unabhängig von ihrer Stelle, und JEDE Zeile, die oben dazukommt, verschiebt `findSearchHits`
// (`:1809`) und `findCandidates` (`:3691-3715`) — die Ziele zweier Wegweiser in
// `services/knowledge-object/src/repo.ts` und `services/app/src/knowledge-check.ts`, die NICHT
// Zielpfad dieses Auftrags sind und von zwei Wächtern am Quelltext nachgeschlagen werden. Die
// ausführliche Begründung steht bei `pruefeHerkunft`.
//
// NICHT EXPORTIERT: ausserhalb dieser Datei braucht ihn niemand. Die Route reicht `body.changes`
// unverändert durch (`ko-routes.ts`), und der Browser-Vertrag steht in
// `apps/web/src/api/endpoints.ts`.
type ReviseMitHerkunft = ReviseKoInput & {
  /** Die Fassung, aus der der mitgeschickte Inhalt stammt. Fehlt sie, ist es eine gewöhnliche Revision. */
  restoredFromVersion?: number;
};

// ==================================================================================================
// JOB 4251 (WIKI-ZUSAMMENARBEIT) — DIE BEDINGUNG, UNTER DER DIE EINORDNUNG GESCHRIEBEN WIRD.
// ==================================================================================================
//
// AM DATEIENDE, UND ZWAR AUS DEMSELBEN GRUND WIE `ReviseMitHerkunft` DARÜBER: jede Zeile weiter oben
// verschiebt `findSearchHits` (`:1809`) und `findCandidates` (`:3691-3715`) — die Ziele zweier
// Wegweiser in `repo.ts` und `services/app/src/knowledge-check.ts` — und die Fundstellen der festen
// Dienst-Vermerke (`:2077`, `:2203` u. a.), die `tests/bibliothek-historie-vermerk/
// vermerk-uebersetzung.test.ts` am Quelltext nachschlägt. Alle Änderungen dieses Auftrags an dieser
// Datei liegen deshalb UNTERHALB von `:3715` (dieselbe Disziplin, die JOB 4213 dort vermerkt hat).
//
// WARUM NICHT `expectedVersion` ALLEIN, obwohl der Name danach klänge: eine Metadatenänderung erhöht
// die Inhaltsversion AUSDRÜCKLICH NICHT (`mutateKoMetadata`, KW-ARCH-G27 Abschnitt 1). Ändert jemand
// nur die Schlagwörter, steht die Version danach unverändert da — ein Vergleich gegen sie ginge an
// genau dem Fall vorbei, um den es geht („zwei Menschen ordnen denselben Eintrag ein").
//
// DER AUTORITATIVE STEMPEL DER EINORDNUNG IST DIE `metadata_revision` der Mutable Metadata
// Projection. Sie klettert monoton und GENAU DANN, wenn sich Kategorie oder Schlagwörter fachlich
// wirklich ändern (`metadata-projection-repo.ts`) — auch bei einer Rücknahme auf den alten Wert.
// Damit heisst „der Stempel steht noch" belegbar: seit deinem Blick hat niemand die Einordnung
// bewegt.
//
// `expectedVersion` STEHT DANEBEN UND NICHT AN SEINER STELLE: wer ZUSÄTZLICH gegen die
// Inhaltsfassung schreiben will, gibt sie mit; ohne sie bleibt der Inhalt unbetrachtet. Beide Felder
// sind optional, und ohne sie verhält sich der Dienst Zeichen für Zeichen wie vor diesem Auftrag —
// die Altaufrufer (Beispielpakete, Importwege, `actor = "system"`) werden NICHT bedingt gemacht.
//
// `meldeMetadatenstand` IST KEINE ZWEITE WAHRHEIT, sondern die Quittung DESSELBEN Schreibvorgangs:
// der Stand, der NACH ihm gilt — gelesen in DEMSELBEN `withKoLock`, in dem geschrieben wurde. Ohne
// ihn müsste der Aufrufer nach dem Schreiben nachlesen, und zwischen Schreiben und Nachlesen läge
// wieder ein Fenster, in dem ein fremder Schreiber unbemerkt in den eigenen Stempel wanderte. Die
// Bauform ist die von `persistSearchProjection` (`meldeGeschrieben`) und aus demselben Grund
// gewählt: der Rückgabewert gehört der Domäne, die Quittung dem Vorgang.
//
// NICHT EXPORTIERT: ausserhalb dieser Datei braucht ihn niemand. Die Route stellt das Aggregat
// selbst zusammen (`ko-routes.ts`, `einordnungsBedingung`), und der Browser-Vertrag steht in
// `apps/web/src/api/endpoints.ts`.
type EinordnungsBedingung = {
  expectedMetadataRevision?: number;
  expectedVersion?: number;
  meldeMetadatenstand?: (revision: number) => void;
};
