import { randomUUID } from "node:crypto";
import type { CreateKoInput } from "../../knowledge-object";
import type { DraftRepo } from "./repo";
import { CaptureError, type Draft, type DraftPayload } from "./types";

export interface CaptureServiceDeps {
  repo: DraftRepo;
  now?: () => number;
  genId?: () => string;
}

function validateMetadata(payload: DraftPayload): void {
  // FR-CAP-08: nötige Validierungen 1–5 (Standard 3 wird erst beim KO gesetzt).
  if (payload.neededValidations !== undefined) {
    const n = payload.neededValidations;
    if (n < 1 || n > 5) {
      throw new CaptureError(
        "INVALID_NEEDED",
        "Nötige Validierungen müssen zwischen 1 und 5 liegen.",
      );
    }
  }
}

export class CaptureService {
  private readonly repo: DraftRepo;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: CaptureServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  async createDraft(payload: DraftPayload, author: string): Promise<Draft> {
    validateMetadata(payload);
    const at = new Date(this.now()).toISOString();
    const draft: Draft = {
      id: this.genId(),
      payload,
      originalAuthor: author,
      lastEditor: author,
      createdAt: at,
      updatedAt: at,
    };
    await this.repo.insert(draft);
    return draft;
  }

  // FR-CAP-06: jeder Schreibberechtigte sieht und nutzt den gemeinsamen Pool.
  listDrafts(): Promise<Draft[]> {
    return this.repo.list();
  }

  getDraft(id: string): Promise<Draft | undefined> {
    return this.repo.findById(id);
  }

  // FR-CAP-07: beim Fortsetzen bleibt der Originalautor erhalten.
  async continueDraft(id: string, changes: DraftPayload, editor: string): Promise<Draft> {
    const draft = await this.require(id);
    const merged: DraftPayload = { ...draft.payload, ...changes };
    validateMetadata(merged);
    const updated: Draft = {
      ...draft,
      payload: merged,
      lastEditor: editor,
      updatedAt: new Date(this.now()).toISOString(),
    };
    await this.repo.update(updated);
    return updated;
  }

  async deleteDraft(id: string): Promise<void> {
    await this.require(id);
    await this.repo.delete(id);
  }

  // Brücke zu knowledge-object: Autor = Originalautor des Entwurfs (FR-CAP-07).
  async toKoInput(id: string): Promise<CreateKoInput> {
    const draft = await this.require(id);
    const p = draft.payload;
    if (!p.title || !p.statement || !p.type || !p.category) {
      throw new CaptureError(
        "INCOMPLETE",
        "Entwurf hat noch keine vollständigen KO-Pflichtfelder.",
      );
    }
    return {
      title: p.title,
      statement: p.statement,
      type: p.type,
      category: p.category,
      author: draft.originalAuthor,
      conditions: p.conditions ?? [],
      measures: p.measures ?? [],
      tags: p.tags ?? [],
      neededValidations: p.neededValidations ?? 3,
      asset: p.asset ?? null,
    };
  }

  private async require(id: string): Promise<Draft> {
    const draft = await this.repo.findById(id);
    if (!draft) {
      throw new CaptureError("NOT_FOUND", "Entwurf nicht gefunden.");
    }
    return draft;
  }
}
