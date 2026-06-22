import { randomUUID } from "node:crypto";
import type { ConflictRepo } from "./repo";
import { type Conflict, ConflictError, type ConflictInput } from "./types";

export interface ConflictServiceDeps {
  repo: ConflictRepo;
  now?: () => number;
  genId?: () => string;
}

export class ConflictService {
  private readonly repo: ConflictRepo;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: ConflictServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // FR-CON-01: Widerspruch erzeugt einen klassifizierten Konflikt, kein stilles Überschreiben.
  async create(input: ConflictInput): Promise<Conflict> {
    const conflict: Conflict = {
      id: this.genId(),
      koA: input.koA,
      koB: input.koB,
      type: input.type,
      description: input.description,
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.repo.insert(conflict);
    return conflict;
  }

  // FR-CON-02: nur Wahrheitskonflikte eskalieren an einen Menschen.
  async escalate(id: string): Promise<Conflict> {
    const conflict = await this.require(id);
    if (conflict.type !== "truth") {
      throw new ConflictError(
        "NOT_ESCALATABLE",
        "Nur Wahrheitskonflikte werden an einen Menschen eskaliert.",
      );
    }
    return this.save({ ...conflict, status: "eskaliert" });
  }

  // FR-CON-03: Zweitmeinung als Zwischenschritt.
  async secondOpinion(id: string, opinion: string): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    return this.save({ ...conflict, status: "zweitmeinung", secondOpinion: opinion });
  }

  // FR-CON-03: Controller-Entscheidung schließt den Wahrheitskonflikt ab.
  async resolve(id: string, decidedBy: string, decision: string): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    return this.save({ ...conflict, status: "geloest", decidedBy, decision });
  }

  // FR-CON-04: alle ungelösten Konflikte (jeder Status außer gelöst).
  async unresolved(): Promise<Conflict[]> {
    const all = await this.repo.all();
    return all.filter((c) => c.status !== "geloest");
  }

  // FR-CON-04: Zähler für das Sidebar-Badge.
  async badgeCount(): Promise<number> {
    return (await this.unresolved()).length;
  }

  get(id: string): Promise<Conflict | undefined> {
    return this.repo.findById(id);
  }

  private async save(conflict: Conflict): Promise<Conflict> {
    await this.repo.update(conflict);
    return conflict;
  }

  private async require(id: string): Promise<Conflict> {
    const conflict = await this.repo.findById(id);
    if (!conflict) {
      throw new ConflictError("NOT_FOUND", "Konflikt nicht gefunden.");
    }
    return conflict;
  }

  private async requireOpen(id: string): Promise<Conflict> {
    const conflict = await this.require(id);
    if (conflict.status === "geloest") {
      throw new ConflictError("ALREADY_RESOLVED", "Konflikt ist bereits gelöst.");
    }
    return conflict;
  }
}
