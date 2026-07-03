import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import { htmlToPlainText, sanitizeHtml } from "../../structure";
import type { EvidenceRepo, KoCandidateQuery, KoFilter, KoRepo, KoVersionRepo } from "./repo";
import {
  type EvidenceRecord,
  KNOWLEDGE_TYPES,
  type KnowledgeObject,
  type KnowledgeType,
  type KoAttachment,
  type KoComment,
  KoError,
  type KoSource,
  type KoStatus,
} from "./types";

const DEFAULT_NEEDED_VALIDATIONS = 3; // FR-CAP-08: 1–5, Standard 3.

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
}

export interface ReviseKoInput {
  title?: string;
  statement?: string;
  type?: KnowledgeType;
  conditions?: string[];
  measures?: string[];
  bodyHtml?: string | null; // KW-STR: WYSIWYG-Body, serverseitig sanitisiert
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

  constructor(deps: KoServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.versions = deps.versions;
    this.evidence = deps.evidence;
    this.defaultNeededValidations = deps.defaultNeededValidations;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
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
      ...(input.demoSeed ? { demoSeed: true } : {}),
      createdAt: at,
      history: [{ version: 1, at, author: input.author, note: "erstellt" }],
      comments: [],
      attachments: [],
      sources: [],
    };
    await this.repo.insert(ko);
    // SCRUM-159: Version-1-Snapshot persistieren (Foundation; aktuelles KO bleibt canonical).
    await this.snapshot(ko, input.author, "erstellt");
    await this.audit?.record({ actor: input.author, action: "ko.created", target: ko.id });
    return ko;
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
      url: input.url?.trim() ? input.url.trim() : null,
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

  get(id: string): Promise<KnowledgeObject | undefined> {
    return this.repo.findById(id);
  }

  list(filter: KoFilter = {}): Promise<KnowledgeObject[]> {
    return this.repo.list(filter);
  }

  // SCRUM-361 / AG-03: begrenzte, datenquellennahe Kandidatenabfrage für Ask (kein All-Pool-Load).
  // Delegiert an das Repository (InMemory/Pg API-kompatibel); die Endsortierung/Top-K bleibt im Ask-/
  // Reasoner-Pfad (selectCandidates).
  findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
    return this.repo.findCandidates(query);
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
    const ko = await this.require(id);
    if (changes.type && !KNOWLEDGE_TYPES.includes(changes.type)) {
      throw new KoError("INVALID_TYPE", "Unbekannte Wissensart.");
    }
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
      type: changes.type ?? ko.type,
      conditions: changes.conditions ?? ko.conditions,
      measures: changes.measures ?? ko.measures,
      version,
      trust: 0, // Bewertungen zurückgesetzt
      status: "offen", // muss neu validiert werden
      history: [...ko.history, { version, at, author, note: "überarbeitet" }],
      sources: ko.sources ?? [], // SCRUM-129: Quellen über Revisionen erhalten
    };
    await this.repo.update(revised);
    // SCRUM-159: neuen Versions-Snapshot persistieren; frühere Versionen bleiben unverändert.
    await this.snapshot(revised, author, "überarbeitet");
    await this.audit?.record({
      actor: author,
      action: "ko.revised",
      target: id,
      payload: { version },
    });
    return revised;
  }

  // FR-KO-03: Kategorie/Tags nachträglich änderbar (Metadaten, ohne Versions-Bump).
  async updateCategory(id: string, category: string, actor = "system"): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated = { ...ko, category };
    await this.repo.update(updated);
    await this.audit?.record({
      actor,
      action: "ko.category-changed",
      target: id,
      payload: { category },
    });
    return updated;
  }

  async updateTags(id: string, tags: string[]): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated = { ...ko, tags };
    await this.repo.update(updated);
    return updated;
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
  async setValidationState(
    id: string,
    state: { trust: number; status: KoStatus },
  ): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated = { ...ko, trust: state.trust, status: state.status };
    await this.repo.update(updated);
    return updated;
  }

  // FR-LIF-02: Autor-Übergabe — current author ändert sich, originalAuthor bleibt erhalten.
  async setAuthor(id: string, author: string, actor = "system"): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated = { ...ko, author };
    await this.repo.update(updated);
    await this.audit?.record({
      actor,
      action: "ko.author-transferred",
      target: id,
      payload: { author },
    });
    return updated;
  }

  // FR-RBAC-02: KO löschen (nur Controller/Admin, serverseitig erzwungen) mit Audit-Eintrag.
  async delete(id: string, actor = "system"): Promise<void> {
    await this.require(id);
    await this.repo.delete(id);
    await this.audit?.record({ actor, action: "ko.deleted", target: id });
  }

  private async require(id: string): Promise<KnowledgeObject> {
    const ko = await this.repo.findById(id);
    if (!ko) {
      throw new KoError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    return ko;
  }
}
