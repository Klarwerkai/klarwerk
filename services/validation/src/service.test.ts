import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { type CreateKoInput, InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";
import { computeOutcome } from "./trust";

function koInput(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Aussage",
    statement: "Inhalt.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
    neededValidations: 2,
    ...overrides,
  };
}

describe("computeOutcome", () => {
  it("FR-VAL-02: n grüne, 0 rote → validiert", () => {
    expect(computeOutcome(["up", "up"], 2).status).toBe("validiert");
  });

  it("FR-VAL-01: eine rote Bewertung hält Status offen und senkt Trust", () => {
    const outcome = computeOutcome(["up", "up", "down"], 2);
    expect(outcome.status).toBe("offen");
    expect(outcome.trust).toBeLessThan(100);
  });
});

describe("ValidationService", () => {
  let koService: KoService;
  let service: ValidationService;

  beforeEach(() => {
    koService = new KoService({ repo: new InMemoryKoRepo() });
    service = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
    });
  });

  it("FR-VAL-01/02: zwei grüne Bewertungen validieren das KO", async () => {
    const ko = await koService.create(koInput());
    await service.rate(ko.id, "u1", "up");
    const outcome = await service.rate(ko.id, "u2", "up");
    expect(outcome.status).toBe("validiert");
    const stored = await koService.get(ko.id);
    expect(stored?.status).toBe("validiert");
    expect(stored?.trust).toBe(100);
  });

  it("FR-VAL-03: validierte KOs erscheinen nicht mehr im Board", async () => {
    const ko = await koService.create(koInput());
    await service.rate(ko.id, "u1", "up");
    await service.rate(ko.id, "u2", "up");
    const board = await service.board();
    expect(board.find((k) => k.id === ko.id)).toBeUndefined();
  });

  it("FR-VAL-04: Board filtert nach Kategorie (nur offene)", async () => {
    await koService.create(koInput({ category: "Anlage 1" }));
    await koService.create(koInput({ category: "Anlage 2" }));
    const board = await service.board({ category: "Anlage 2" });
    expect(board).toHaveLength(1);
    expect(board[0]?.category).toBe("Anlage 2");
  });

  it("FR-VAL-05: Zuweisung wird durch Bewertung erledigt", async () => {
    const ko = await koService.create(koInput());
    await service.assign(ko.id, ["u1"]);
    let overview = await service.overview();
    expect(overview).toEqual([{ userId: "u1", open: 1, done: 0 }]);

    await service.rate(ko.id, "u1", "up");
    overview = await service.overview();
    expect(overview).toEqual([{ userId: "u1", open: 0, done: 1 }]);
  });

  it("FR-VAL-06: Übersicht zählt offen/erledigt pro Person", async () => {
    const a = await koService.create(koInput());
    const b = await koService.create(koInput());
    await service.assign(a.id, ["u1", "u2"]);
    await service.assign(b.id, ["u1"]);
    await service.rate(a.id, "u1", "up");

    const overview = await service.overview();
    const u1 = overview.find((s) => s.userId === "u1");
    expect(u1).toEqual({ userId: "u1", open: 1, done: 1 });
  });

  it("FR-AUD-01: Bewertung erzeugt einen Audit-Eintrag", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const withAudit = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      audit,
    });
    const ko = await koService.create(koInput());
    await withAudit.rate(ko.id, "u1", "up");
    const entries = await audit.list({ action: "ko.rated" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actor).toBe("u1");
  });
});
