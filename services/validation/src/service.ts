import type { KnowledgeObject, KoFilter, KoService } from "../../knowledge-object";
import type { AssignmentRepo, RatingRepo } from "./repo";
import { type ValidationOutcome, computeOutcome } from "./trust";
import { ValidationError, type Verdict } from "./types";

export type BoardFilter = Omit<KoFilter, "status">;

export interface AssignmentSummary {
  userId: string;
  open: number;
  done: number;
}

export interface ValidationServiceDeps {
  koService: KoService;
  ratings: RatingRepo;
  assignments: AssignmentRepo;
  now?: () => number;
}

export class ValidationService {
  private readonly koService: KoService;
  private readonly ratings: RatingRepo;
  private readonly assignments: AssignmentRepo;
  private readonly now: () => number;

  constructor(deps: ValidationServiceDeps) {
    this.koService = deps.koService;
    this.ratings = deps.ratings;
    this.assignments = deps.assignments;
    this.now = deps.now ?? (() => Date.now());
  }

  // FR-VAL-01/02: Bewertung verbuchen, Trust/Status neu berechnen, am KO setzen.
  async rate(koId: string, userId: string, verdict: Verdict): Promise<ValidationOutcome> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    await this.ratings.upsert({
      koId,
      userId,
      verdict,
      createdAt: new Date(this.now()).toISOString(),
    });
    const all = await this.ratings.listByKo(koId);
    const outcome = computeOutcome(
      all.map((r) => r.verdict),
      ko.neededValidations,
    );
    await this.koService.setValidationState(koId, {
      trust: outcome.trust,
      status: outcome.status,
    });
    // FR-VAL-05: Bewertung erledigt eine offene Zuweisung des Nutzers.
    const assignment = await this.assignments.find(koId, userId);
    if (assignment && assignment.status === "open") {
      await this.assignments.update({ ...assignment, status: "done" });
    }
    return outcome;
  }

  // FR-VAL-03/04: Board zeigt nur offene KOs, Filter kombinierbar.
  board(filter: BoardFilter = {}): Promise<KnowledgeObject[]> {
    return this.koService.list({ ...filter, status: "offen" });
  }

  // FR-VAL-05: KO an ≥1 Person zuweisen.
  async assign(koId: string, userIds: string[]): Promise<void> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    for (const userId of userIds) {
      await this.assignments.create({ koId, userId, status: "open" });
    }
  }

  // FR-VAL-06: Übersicht offen/erledigt pro Person.
  async overview(): Promise<AssignmentSummary[]> {
    const all = await this.assignments.all();
    const byUser = new Map<string, AssignmentSummary>();
    for (const a of all) {
      const summary = byUser.get(a.userId) ?? { userId: a.userId, open: 0, done: 0 };
      if (a.status === "open") {
        summary.open += 1;
      } else {
        summary.done += 1;
      }
      byUser.set(a.userId, summary);
    }
    return [...byUser.values()];
  }
}
