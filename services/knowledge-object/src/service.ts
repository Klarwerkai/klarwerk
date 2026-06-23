import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { KoFilter, KoRepo } from "./repo";
import {
  KNOWLEDGE_TYPES,
  type KnowledgeObject,
  type KnowledgeType,
  KoError,
  type KoStatus,
} from "./types";

const DEFAULT_NEEDED_VALIDATIONS = 3; // FR-CAP-08: 1–5, Standard 3.

export interface KoServiceDeps {
  repo: KoRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
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
}

export interface ReviseKoInput {
  title?: string;
  statement?: string;
  type?: KnowledgeType;
  conditions?: string[];
  measures?: string[];
}

export class KoService {
  private readonly repo: KoRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: KoServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // FR-KO-01: vollständiges Datenmodell; FR-KO-02: Wissensart gesetzt.
  async create(input: CreateKoInput): Promise<KnowledgeObject> {
    if (!KNOWLEDGE_TYPES.includes(input.type)) {
      throw new KoError("INVALID_TYPE", "Unbekannte Wissensart.");
    }
    const needed = input.neededValidations ?? DEFAULT_NEEDED_VALIDATIONS;
    if (needed < 1 || needed > 5) {
      throw new KoError("INVALID_NEEDED", "Nötige Validierungen müssen zwischen 1 und 5 liegen.");
    }
    const at = new Date(this.now()).toISOString();
    const ko: KnowledgeObject = {
      id: this.genId(),
      title: input.title,
      statement: input.statement,
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
      createdAt: at,
      history: [{ version: 1, at, author: input.author, note: "erstellt" }],
    };
    await this.repo.insert(ko);
    await this.audit?.record({ actor: input.author, action: "ko.created", target: ko.id });
    return ko;
  }

  get(id: string): Promise<KnowledgeObject | undefined> {
    return this.repo.findById(id);
  }

  list(filter: KoFilter = {}): Promise<KnowledgeObject[]> {
    return this.repo.list(filter);
  }

  // FR-KO-04: Überarbeiten erhöht Version, setzt Bewertungen zurück, erzeugt History-Eintrag.
  async revise(id: string, changes: ReviseKoInput, author: string): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    if (changes.type && !KNOWLEDGE_TYPES.includes(changes.type)) {
      throw new KoError("INVALID_TYPE", "Unbekannte Wissensart.");
    }
    const version = ko.version + 1;
    const at = new Date(this.now()).toISOString();
    const revised: KnowledgeObject = {
      ...ko,
      title: changes.title ?? ko.title,
      statement: changes.statement ?? ko.statement,
      type: changes.type ?? ko.type,
      conditions: changes.conditions ?? ko.conditions,
      measures: changes.measures ?? ko.measures,
      version,
      trust: 0, // Bewertungen zurückgesetzt
      status: "offen", // muss neu validiert werden
      history: [...ko.history, { version, at, author, note: "überarbeitet" }],
    };
    await this.repo.update(revised);
    await this.audit?.record({
      actor: author,
      action: "ko.revised",
      target: id,
      payload: { version },
    });
    return revised;
  }

  // FR-KO-03: Kategorie/Tags nachträglich änderbar (Metadaten, ohne Versions-Bump).
  async updateCategory(id: string, category: string): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated = { ...ko, category };
    await this.repo.update(updated);
    return updated;
  }

  async updateTags(id: string, tags: string[]): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated = { ...ko, tags };
    await this.repo.update(updated);
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
  async setAuthor(id: string, author: string): Promise<KnowledgeObject> {
    const ko = await this.require(id);
    const updated = { ...ko, author };
    await this.repo.update(updated);
    return updated;
  }

  private async require(id: string): Promise<KnowledgeObject> {
    const ko = await this.repo.findById(id);
    if (!ko) {
      throw new KoError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    return ko;
  }
}
