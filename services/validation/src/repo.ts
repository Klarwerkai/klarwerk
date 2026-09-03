import type { Assignment, Rating } from "./types";

export interface RatingRepo {
  upsert(rating: Rating): Promise<void>; // eine Bewertung je (KO, Nutzer)
  listByKo(koId: string): Promise<Rating[]>;
  /**
   * JOB 3043: die Bewertungen MEHRERER Objekte in EINER Abfrage.
   *
   * WARUM NEBEN `listByKo` UND NICHT AN SEINER STELLE. Beide Formen haben einen echten Aufrufer,
   * und keiner ist der billigere Fall des anderen: der Detailabruf kennt genau ein Objekt und
   * bezahlt dafuer genau eine Abfrage (gepinnt in `ko-routes-anzeigestatus.test.ts`, Fall K); der
   * Listen-Lesepfad kennt N Objekte und darf dafuer nicht N Abfragen bezahlen. Ein `listByKo`, das
   * ueber `listByKos` liefe, wuerde die Zusage von Fall K nicht brechen, aber auch nichts sparen —
   * eine Umschreibung ohne Gewinn, dafuer mit einem Feld statt eines Skalars im SQL.
   *
   * EINE LEERE KENNUNGSLISTE MACHT KEINE ABFRAGE und gibt `[]` zurueck. Das ist nicht nur
   * Sparsamkeit: `= ANY($1)` mit leerem Feld ist eine Anweisung, die nie eine Zeile treffen kann.
   */
  listByKos(koIds: readonly string[]): Promise<Rating[]>;
}

export interface AssignmentRepo {
  create(assignment: Assignment): Promise<void>;
  find(koId: string, userId: string): Promise<Assignment | undefined>;
  update(assignment: Assignment): Promise<void>;
  all(): Promise<Assignment[]>;
}

export class InMemoryRatingRepo implements RatingRepo {
  private readonly ratings = new Map<string, Rating>();

  upsert(rating: Rating): Promise<void> {
    this.ratings.set(`${rating.koId}:${rating.userId}`, rating);
    return Promise.resolve();
  }

  listByKo(koId: string): Promise<Rating[]> {
    return Promise.resolve([...this.ratings.values()].filter((r) => r.koId === koId));
  }

  listByKos(koIds: readonly string[]): Promise<Rating[]> {
    if (koIds.length === 0) {
      return Promise.resolve([]);
    }
    const gesucht = new Set(koIds);
    return Promise.resolve([...this.ratings.values()].filter((r) => gesucht.has(r.koId)));
  }
}

export class InMemoryAssignmentRepo implements AssignmentRepo {
  private readonly assignments = new Map<string, Assignment>();

  create(assignment: Assignment): Promise<void> {
    this.assignments.set(`${assignment.koId}:${assignment.userId}`, assignment);
    return Promise.resolve();
  }

  find(koId: string, userId: string): Promise<Assignment | undefined> {
    return Promise.resolve(this.assignments.get(`${koId}:${userId}`));
  }

  update(assignment: Assignment): Promise<void> {
    this.assignments.set(`${assignment.koId}:${assignment.userId}`, assignment);
    return Promise.resolve();
  }

  all(): Promise<Assignment[]> {
    return Promise.resolve([...this.assignments.values()]);
  }
}
