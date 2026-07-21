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
import type { EvidenceRepo, KoCandidateQuery, KoFilter, KoRepo, KoVersionRepo } from "./repo";
// SCRUM-527 (WP2): Quell-URL-Allowlist an der Persistenzgrenze (nur absolute http/https).
import { safeSourceUrl, sanitizeSources } from "./source-url";
import {
  type Confidentiality,
  type EvidenceRecord,
  KNOWLEDGE_TYPES,
  type KnowledgeObject,
  type KnowledgeType,
  type KoAttachment,
  type KoComment,
  KoError,
  type KoSource,
  type KoStatus,
  type TrashedKo,
} from "./types";

const DEFAULT_NEEDED_VALIDATIONS = 3; // FR-CAP-08: 1–5, Standard 3.

// SCRUM-422 (Pedi 03.07.): Aufbewahrungsfrist im Papierkorb — danach automatische Endlöschung.
export const TRASH_RETENTION_DAYS = 28;

// SCRUM-358 / AG-05 / AG-14-SERVER-TRUST: konservative, nachvollziehbare Trust-Strafe, wenn ein offener
// Wahrheitskonflikt ein validiertes KO zurück in Review holt. Bewusst KLEIN (kein Reset auf 0): ein
// Konflikt macht ein KO nicht „falsch" — er macht es review-pflichtig. Wert orientiert am Technischen
// Anhang §3 (Truth-Impact ~ −12). Eine vollständige spec-konforme Trust-Formel bleibt Folge-Gap (EK-22).
export const TRUTH_CONFLICT_TRUST_PENALTY = 12;

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

// KW-STR / NFR-SEC-04: bodyHtml IMMER serverseitig sanitisieren; statement aus dem
// HTML ableiten, falls leer (statement bleibt führende Plaintext-Kurzfassung).
function cleanBody(bodyHtml: string | null | undefined): string | null {
  if (!bodyHtml || !bodyHtml.trim()) {
    return null;
  }
  return sanitizeHtml(bodyHtml);
}

export class KoService {
  private readonly repo: KoRepo;
  private readonly audit: AuditService | undefined;
  private readonly versions: KoVersionRepo | undefined;
  private readonly evidence: EvidenceRepo | undefined;
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
      try {
        // 2) Nachgelagert: erst Snapshot, dann Audit. Ein Fehler in EINEM Schritt rollt ALLES zurück.
        if (snapshot) {
          await this.snapshot(updated, snapshot.author, snapshot.note);
          snapshotWritten = this.versions !== undefined;
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

  // SCRUM-160: Evidence-Records append-only schreiben. No-op ohne Evidence-Repo;
  // bestehende KO-Flows bleiben dadurch rückwärtskompatibel.
  private async appendEvidence(record: Omit<EvidenceRecord, "id">): Promise<void> {
    if (!this.evidence) {
      return;
    }
    await this.evidence.append({ id: this.genId(), ...record });
  }

  // FR-KO-01: vollständiges Datenmodell; FR-KO-02: Wissensart gesetzt.
  async create(input: CreateKoInput): Promise<KnowledgeObject> {
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
      originalAuthor: input.author,
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
      createdAt: at,
      history: [{ version: 1, at, author: input.author, note: "erstellt" }],
      comments: [],
      attachments: [],
      // SCRUM-470: Herkunftsquellen (Import) übernehmen; ohne Eingabe wie bisher leer.
      // SCRUM-527 (WP2): jede übernommene Quell-URL durch die Allowlist (nur absolute http/https).
      sources: sanitizeSources(input.sources ?? []),
    };
    await this.repo.insert(ko);
    // SCRUM-159: Version-1-Snapshot persistieren (Foundation; aktuelles KO bleibt canonical).
    await this.snapshot(ko, input.author, "erstellt");
    await this.audit?.record({ actor: input.author, action: "ko.created", target: ko.id });
    return ko;
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
  async list(filter: KoFilter = {}): Promise<KnowledgeObject[]> {
    return (await this.repo.list(filter)).filter((k) => !k.deletedAt);
  }

  // WP-BILD-1g (bens sammel14-ROT): Suchpfad-Sicht OHNE bodyHtml — die Bibliotheks-Suche arbeitet
  // über title/statement/captionTexts; die Projektion passiert an der Datenquelle (Repo).
  async listForSearch(filter: KoFilter = {}): Promise<KnowledgeObject[]> {
    return (await this.repo.listForSearch(filter)).filter((k) => !k.deletedAt);
  }

  // WP-BILD-1g/1h: EINMALIGER Legacy-Backfill des abgeleiteten captionTexts-Suchfelds. Lädt das
  // eine KO voll (nur für diesen Rest-Bestand), extrahiert body-sparend + GEDECKELT
  // (searchCaptionTexts) und persistiert über den schmalen Nur-wenn-fehlt-Repo-Write (kein
  // Versions-Bump, kein Audit). WP-BILD-1h (bens sammel15-ROT 2): SINGLE-FLIGHT pro KO-Id
  // prozessweit — parallele Suchen laden denselben Legacy-KO nicht mehrfach; der Eintrag wird
  // IMMER (finally) abgeräumt, damit ein Fehlschlag später erneut versucht werden kann.
  private readonly captionBackfillsInFlight = new Map<string, Promise<string[]>>();

  async ensureCaptionTexts(id: string): Promise<string[]> {
    const inFlight = this.captionBackfillsInFlight.get(id);
    if (inFlight) {
      return inFlight;
    }
    const run = (async (): Promise<string[]> => {
      const ko = await this.repo.findById(id);
      if (!ko || ko.deletedAt) {
        return [];
      }
      if (ko.captionTexts) {
        return ko.captionTexts;
      }
      const captionTexts = searchCaptionTexts(ko.bodyHtml);
      await this.repo.setCaptionTexts(id, captionTexts);
      return captionTexts;
    })().finally(() => {
      this.captionBackfillsInFlight.delete(id);
    });
    this.captionBackfillsInFlight.set(id, run);
    return run;
  }

  // SCRUM-361 / AG-03: begrenzte, datenquellennahe Kandidatenabfrage für Ask (kein All-Pool-Load).
  // Delegiert an das Repository (InMemory/Pg API-kompatibel); die Endsortierung/Top-K bleibt im Ask-/
  // Reasoner-Pfad (selectCandidates).
  async findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
    return (await this.repo.findCandidates(query)).filter((k) => !k.deletedAt);
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
      return;
    }
    await audit?.record(auditInput);
    await this.repo.delete(id);
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

  // FR-KO-03: Kategorie/Tags nachträglich änderbar (Metadaten, ohne Versions-Bump).
  // SCRUM-509 R3: über den serialisierten mutateKo-Pfad (Lock + rowVersion-CAS) — ein nebenläufiges
  // Vertraulichkeits-Upgrade kann nicht durch ein veraltetes Voll-Objekt überschrieben werden.
  async updateCategory(id: string, category: string, actor = "system"): Promise<KnowledgeObject> {
    return this.mutateKo(id, (ko) => {
      const updated = { ...ko, category };
      return {
        updated,
        value: updated,
        audit: async () => {
          await this.audit?.record({
            actor,
            action: "ko.category-changed",
            target: id,
            payload: { category },
          });
        },
      };
    });
  }

  async updateTags(id: string, tags: string[]): Promise<KnowledgeObject> {
    return this.mutateKo(id, (ko) => {
      const updated = { ...ko, tags };
      return { updated, value: updated };
    });
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
  async delete(id: string, actor = "system", opts?: { hard?: boolean }): Promise<void> {
    const ko = await this.require(id);
    if (opts?.hard || ko.demoSeed) {
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
