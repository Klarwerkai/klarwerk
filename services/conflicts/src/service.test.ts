import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryConflictRepo } from "./repo";
import { ConflictService } from "./service";
import type { ConflictInput } from "./types";

function input(overrides: Partial<ConflictInput> = {}): ConflictInput {
  return {
    koA: "ko1",
    koB: "ko2",
    type: "truth",
    description: "Widerspruch zur Schließreihenfolge.",
    ...overrides,
  };
}

describe("ConflictService", () => {
  let service: ConflictService;

  beforeEach(() => {
    service = new ConflictService({ repo: new InMemoryConflictRepo() });
  });

  it("FR-CON-01: Widerspruch erzeugt klassifizierten Konflikt (kein stilles Überschreiben)", async () => {
    const c = await service.create(input({ type: "context" }));
    expect(c.status).toBe("offen");
    expect(c.type).toBe("context");
    expect(c.description).toBeTruthy();
  });

  it("Konzept 04.07. (Stufe 1): gelöschtes KO beendet seine offenen Konflikte (kein Geist)", async () => {
    const a = await service.create(input({ koA: "ko1", koB: "ko2" }));
    const b = await service.create(input({ koA: "ko2", koB: "ko3" }));
    const unrelated = await service.create(input({ koA: "ko4", koB: "ko5" }));

    const closed = await service.onKoRemoved("ko2");
    expect(closed).toBe(2);

    const stillA = await service.get(a.id);
    expect(stillA?.status).toBe("geloest");
    expect(stillA?.resolutionReason).toBe("participant_deleted");
    expect(stillA?.decidedBy).toBeNull();
    expect((await service.get(b.id))?.status).toBe("geloest");

    const open = await service.unresolved();
    expect(open.map((c) => c.id)).toEqual([unrelated.id]);
  });

  it("FR-CON-02: nur Wahrheitskonflikte eskalieren", async () => {
    const truth = await service.create(input({ type: "truth" }));
    const escalated = await service.escalate(truth.id);
    expect(escalated.status).toBe("eskaliert");

    const ctx = await service.create(input({ type: "context" }));
    await expect(service.escalate(ctx.id)).rejects.toMatchObject({ code: "NOT_ESCALATABLE" });
  });

  it("FR-CON-03: vollständiger Ablauf Eskalation → Zweitmeinung → Entscheidung", async () => {
    const c = await service.create(input({ type: "truth" }));
    await service.escalate(c.id);
    const withOpinion = await service.secondOpinion(c.id, "Quelle B ist aktueller.");
    expect(withOpinion.status).toBe("zweitmeinung");
    expect(withOpinion.secondOpinion).toBe("Quelle B ist aktueller.");

    const resolved = await service.resolve(c.id, "controller-1", "Quelle B gilt.");
    expect(resolved.status).toBe("geloest");
    expect(resolved.decidedBy).toBe("controller-1");
  });

  it("FR-CON-03: gelöster Konflikt kann nicht erneut verändert werden", async () => {
    const c = await service.create(input());
    await service.resolve(c.id, "controller-1", "Entschieden.");
    await expect(service.secondOpinion(c.id, "x")).rejects.toMatchObject({
      code: "ALREADY_RESOLVED",
    });
  });

  it("FR-CON-04: ungelöste Konflikte werden gelistet, Badge zählt korrekt", async () => {
    const a = await service.create(input());
    await service.create(input({ koA: "ko3" }));
    expect(await service.badgeCount()).toBe(2);

    await service.resolve(a.id, "c1", "ok");
    const open = await service.unresolved();
    expect(open).toHaveLength(1);
    expect(await service.badgeCount()).toBe(1);
  });
});

describe("ConflictService — Audit (FR-AUD-01)", () => {
  it("protokolliert Konflikt-Lebenszyklus", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const service = new ConflictService({ repo: new InMemoryConflictRepo(), audit });
    const c = await service.create(
      { koA: "a", koB: "b", type: "truth", description: "x" },
      "system",
    );
    await service.escalate(c.id, "controller");
    await service.secondOpinion(c.id, "Meinung", "controller");
    await service.resolve(c.id, "controller", "Entschieden");

    expect((await audit.list()).map((e) => e.action)).toEqual([
      "conflict.created",
      "conflict.escalated",
      "conflict.second-opinion",
      "conflict.resolved",
    ]);
  });
});
