import type { Assignment, Rating } from "./types";

export interface RatingRepo {
  upsert(rating: Rating): Promise<void>; // eine Bewertung je (KO, Nutzer)
  listByKo(koId: string): Promise<Rating[]>;
  // SCRUM-507: bei einer inhaltlichen Revision werden ALLE Bewertungen des KOs verworfen — sie galten
  // dem alten Inhalt und dürfen die neue Version nicht mehr als „validiert" tragen.
  deleteByKo(koId: string): Promise<void>;
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

  deleteByKo(koId: string): Promise<void> {
    for (const [key, r] of this.ratings) {
      if (r.koId === koId) {
        this.ratings.delete(key);
      }
    }
    return Promise.resolve();
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
