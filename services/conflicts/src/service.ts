import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { ConflictRepo } from "./repo";
import { type Conflict, ConflictError, type ConflictInput } from "./types";

export interface ConflictServiceDeps {
  repo: ConflictRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
}

export class ConflictService {
  private readonly repo: ConflictRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: ConflictServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // FR-CON-01: Widerspruch erzeugt einen klassifizierten Konflikt, kein stilles Überschreiben.
  async create(input: ConflictInput, actor = "system"): Promise<Conflict> {
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
    await this.audit?.record({ actor, action: "conflict.created", target: conflict.id });
    return conflict;
  }

  // FR-CON-02: nur Wahrheitskonflikte eskalieren an einen Menschen.
  async escalate(id: string, actor = "system"): Promise<Conflict> {
    const conflict = await this.require(id);
    if (conflict.type !== "truth") {
      throw new ConflictError(
        "NOT_ESCALATABLE",
        "Nur Wahrheitskonflikte werden an einen Menschen eskaliert.",
      );
    }
    const saved = await this.save({ ...conflict, status: "eskaliert" });
    await this.audit?.record({ actor, action: "conflict.escalated", target: id });
    return saved;
  }

  // FR-CON-03: Zweitmeinung als Zwischenschritt.
  async secondOpinion(id: string, opinion: string, actor = "system"): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({ ...conflict, status: "zweitmeinung", secondOpinion: opinion });
    await this.audit?.record({ actor, action: "conflict.second-opinion", target: id });
    return saved;
  }

  // FR-CON-03: Controller-Entscheidung schließt den Wahrheitskonflikt ab.
  async resolve(id: string, decidedBy: string, decision: string): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({
      ...conflict,
      status: "geloest",
      decidedBy,
      decision,
      resolutionReason: "decided",
    });
    await this.audit?.record({ actor: decidedBy, action: "conflict.resolved", target: id });
    return saved;
  }

  // Konzept 04.07. (Stufe 1) — Geister-Bug: Wird ein beteiligtes Wissensobjekt gelöscht, darf sein
  // Konflikt nicht als „Objekt nicht gefunden" offen hängen bleiben. Alle OFFENEN Konflikte, die
  // dieses KO referenzieren, werden geordnet beendet (participant_deleted) und protokolliert —
  // OHNE Status/Trust des verbleibenden KO automatisch zu ändern (kein stilles Überschreiben).
  // Idempotent: bereits gelöste Konflikte bleiben unberührt. Gibt die Anzahl beendeter Konflikte.
  async onKoRemoved(koId: string, actor = "system"): Promise<number> {
    const affected = (await this.repo.all()).filter(
      (c) => c.status !== "geloest" && (c.koA === koId || c.koB === koId),
    );
    for (const c of affected) {
      await this.save({
        ...c,
        status: "geloest",
        decidedBy: null,
        resolutionReason: "participant_deleted",
      });
      await this.audit?.record({
        actor,
        action: "conflict.participant-removed",
        target: c.id,
        payload: { koId },
      });
      await this.audit?.record({
        actor,
        action: "conflict.auto-resolved",
        target: c.id,
        payload: { reason: "participant_deleted" },
      });
    }
    return affected.length;
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
