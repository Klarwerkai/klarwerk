import type { ModelRunRepo } from "./repo";
import type { ModelRunRecord } from "./types";

// SCRUM-165: read-only Service über das ModelRun-Protokoll. Nur Lesen (recent) — kein
// Write/Delete/Replay. Limit defensiv normalisiert.
export const DEFAULT_MODEL_RUN_LIMIT = 50;
export const MAX_MODEL_RUN_LIMIT = 200;

export function normalizeModelRunLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_MODEL_RUN_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_MODEL_RUN_LIMIT);
}

export interface ModelRunServiceDeps {
  repo: ModelRunRepo;
}

export class ModelRunService {
  private readonly repo: ModelRunRepo;

  constructor(deps: ModelRunServiceDeps) {
    this.repo = deps.repo;
  }

  // Jüngste ModelRuns (nur Metadaten). Limit defensiv: Default 50, Max 200, ungültig → Default.
  recent(limit?: number): Promise<ModelRunRecord[]> {
    return this.repo.recent(normalizeModelRunLimit(limit));
  }
}
