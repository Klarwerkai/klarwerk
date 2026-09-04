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
  /**
   * JOB 3054: die Merkerlage EINER BEKANNTEN MENGE von Objekten — schreibfrei und in EINER Abfrage.
   *
   * WARUM NEBEN `pending()` UND NICHT AN SEINER STELLE. Beide Formen haben einen echten Aufrufer,
   * und keiner ist der billigere Fall des anderen: der Arbeitsbereich fragt „welche Objekte stehen
   * ueberhaupt an?" und braucht dafuer den ganzen Bestand (`LifecycleService.pendingRevalidation`,
   * samt Selbstheilung nach SCRUM-420); die zwei Leserouten fragen „steht DIESES Objekt an?" fuer
   * Kennungen, die sie schon in der Hand haben. Ueber `pending()` gefuehrt hiesse das, fuer eine
   * Teilmenge den ganzen Bestand zu laden — im Betrieb genau die Last, die der Deckel der Liste
   * begrenzen soll.
   *
   * EINE LEERE KENNUNGSLISTE MACHT KEINE ABFRAGE und gibt `[]` zurueck: `= ANY('{}')` ist eine
   * Anweisung, die nie eine Zeile treffen kann (dieselbe Zusage wie `RatingRepo.listByKos`).
   *
   * Die Antwort ist die TEILMENGE der uebergebenen Kennungen mit gesetztem Merker — nie mehr.
   */
  pendingFor(koIds: readonly string[]): Promise<string[]>;
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

  pendingFor(koIds: readonly string[]): Promise<string[]> {
    if (koIds.length === 0) {
      return Promise.resolve([]);
    }
    return Promise.resolve([...new Set(koIds)].filter((koId) => this.pendingSet.has(koId)));
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
