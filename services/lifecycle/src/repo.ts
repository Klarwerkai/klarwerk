import type { LearningPath } from "./types";

// Modul-interner Speicher für Anlagenkopplungen, Re-Validierungs-Marker, Lernpfade & Fortschritt.
export interface LifecycleRepo {
  addCoupling(assetRef: string, koId: string): Promise<void>;
  couplingsFor(assetRef: string): Promise<string[]>;
  // FR-LIF-01 / Audit B1 (02.07.2026): Rück-Richtung fürs KO-Detail — welche Anlagen sind gekoppelt?
  couplingsForKo(koId: string): Promise<string[]>;
  markPending(koId: string): Promise<void>;
  clearPending(koId: string): Promise<void>;
  pending(): Promise<string[]>;
  savePath(path: LearningPath): Promise<void>;
  getPathByRole(role: string): Promise<LearningPath | undefined>;
  setProgress(pathId: string, userId: string, completed: string[]): Promise<void>;
  getProgress(pathId: string, userId: string): Promise<string[]>;
}

export class InMemoryLifecycleRepo implements LifecycleRepo {
  private readonly couplings = new Map<string, Set<string>>();
  private readonly pendingSet = new Set<string>();
  private readonly paths = new Map<string, LearningPath>();
  private readonly progress = new Map<string, string[]>();

  addCoupling(assetRef: string, koId: string): Promise<void> {
    const set = this.couplings.get(assetRef) ?? new Set<string>();
    set.add(koId);
    this.couplings.set(assetRef, set);
    return Promise.resolve();
  }

  couplingsFor(assetRef: string): Promise<string[]> {
    return Promise.resolve([...(this.couplings.get(assetRef) ?? [])]);
  }

  couplingsForKo(koId: string): Promise<string[]> {
    const assets: string[] = [];
    for (const [assetRef, koIds] of this.couplings) {
      if (koIds.has(koId)) {
        assets.push(assetRef);
      }
    }
    return Promise.resolve(assets);
  }

  markPending(koId: string): Promise<void> {
    this.pendingSet.add(koId);
    return Promise.resolve();
  }

  clearPending(koId: string): Promise<void> {
    this.pendingSet.delete(koId);
    return Promise.resolve();
  }

  pending(): Promise<string[]> {
    return Promise.resolve([...this.pendingSet]);
  }

  savePath(path: LearningPath): Promise<void> {
    this.paths.set(path.id, path);
    return Promise.resolve();
  }

  getPathByRole(role: string): Promise<LearningPath | undefined> {
    for (const path of this.paths.values()) {
      if (path.role === role) {
        return Promise.resolve(path);
      }
    }
    return Promise.resolve(undefined);
  }

  setProgress(pathId: string, userId: string, completed: string[]): Promise<void> {
    this.progress.set(`${pathId}:${userId}`, completed);
    return Promise.resolve();
  }

  getProgress(pathId: string, userId: string): Promise<string[]> {
    return Promise.resolve(this.progress.get(`${pathId}:${userId}`) ?? []);
  }
}
