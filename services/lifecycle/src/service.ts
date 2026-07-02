import { randomUUID } from "node:crypto";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { LifecycleRepo } from "./repo";
import type { LearningPath, LearningStep } from "./types";

export interface LifecycleServiceDeps {
  koService: KoService;
  repo: LifecycleRepo;
  genId?: () => string;
}

export class LifecycleService {
  private readonly koService: KoService;
  private readonly repo: LifecycleRepo;
  private readonly genId: () => string;

  constructor(deps: LifecycleServiceDeps) {
    this.koService = deps.koService;
    this.repo = deps.repo;
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // FR-LIF-01: Anlagen-/Prozesskopplung.
  async couple(assetRef: string, koId: string): Promise<void> {
    await this.repo.addCoupling(assetRef, koId);
  }

  // FR-LIF-01 / Audit B1: gekoppelte Anlagen eines KOs (fürs KO-Detail sichtbar machen).
  couplingsForKo(koId: string): Promise<string[]> {
    return this.repo.couplingsForKo(koId);
  }

  // FR-LIF-01: Anlagenänderung markiert gekoppelte KOs „Stimmt das noch?".
  async assetChanged(assetRef: string): Promise<string[]> {
    const koIds = await this.repo.couplingsFor(assetRef);
    for (const koId of koIds) {
      await this.repo.markPending(koId);
    }
    return koIds;
  }

  pendingRevalidation(): Promise<string[]> {
    return this.repo.pending();
  }

  // FR-LIF-01: Bestätigung erzeugt eine neue Version.
  async confirmStillValid(koId: string, author: string): Promise<KnowledgeObject> {
    const ko = await this.koService.revise(koId, {}, author);
    await this.repo.clearPending(koId);
    return ko;
  }

  // FR-LIF-02: Admin-Autor-Übergabe; Originalautor bleibt sichtbar.
  async transferAuthor(koId: string, newAuthor: string, actor = "admin"): Promise<KnowledgeObject> {
    return this.koService.setAuthor(koId, newAuthor, actor);
  }

  // FR-LIF-03: Lernpfade — rollenspezifische Einarbeitung.
  async createPath(role: string, steps: readonly { title: string }[]): Promise<LearningPath> {
    const path: LearningPath = {
      id: this.genId(),
      role,
      steps: steps.map<LearningStep>((s) => ({ id: this.genId(), title: s.title })),
    };
    await this.repo.savePath(path);
    return path;
  }

  getPath(role: string): Promise<LearningPath | undefined> {
    return this.repo.getPathByRole(role);
  }

  // FR-LIF-03: Abhaken mit Fortschrittsspeicherung.
  async completeStep(pathId: string, userId: string, stepId: string): Promise<string[]> {
    const done = await this.repo.getProgress(pathId, userId);
    if (!done.includes(stepId)) {
      done.push(stepId);
      await this.repo.setProgress(pathId, userId, done);
    }
    return done;
  }

  progress(pathId: string, userId: string): Promise<string[]> {
    return this.repo.getProgress(pathId, userId);
  }
}
