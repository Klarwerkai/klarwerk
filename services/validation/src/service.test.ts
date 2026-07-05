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

  it("SCRUM-359/PI-K2: validiert deckelt Trust bei 99 — nie 100 (keine 100-%-Wahrheit)", () => {
    const outcome = computeOutcome(["up"], 1);
    expect(outcome.status).toBe("validiert");
    expect(outcome.trust).toBe(99);
  });

  it("SCRUM-359: warn (Amber) senkt den Trust und wirkt nicht wie ein volles OK", () => {
    const allUp = computeOutcome(["up", "up"], 2);
    const withWarn = computeOutcome(["up", "up", "warn"], 2);
    // Beide sind validiert (genug grüne, keine rote) …
    expect(allUp.status).toBe("validiert");
    expect(withWarn.status).toBe("validiert");
    // … aber Amber zieht den Trust messbar nach unten („validiert mit Vorbehalt").
    expect(withWarn.warn).toBe(1);
    expect(withWarn.trust).toBeLessThan(allUp.trust);
  });

  it("SCRUM-359: down hält den Status offen und begrenzt den Trust stark", () => {
    const down = computeOutcome(["down"], 1);
    expect(down.status).toBe("offen");
    expect(down.trust).toBe(0);
    // Eine rote Bewertung kippt auch eine sonst grüne Mehrheit nicht in „validiert".
    const mixed = computeOutcome(["up", "up", "down"], 2);
    expect(mixed.status).toBe("offen");
    expect(mixed.down).toBe(1);
  });

  it("SCRUM-359: Trust bleibt im Band 0..99 geklemmt (untere und obere Grenze)", () => {
    expect(computeOutcome(["down", "down"], 1).trust).toBe(0); // nie negativ
    expect(computeOutcome(["up", "up", "up"], 1).trust).toBe(99); // nie über 99
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
    expect(stored?.trust).toBe(99); // SCRUM-359: Trust-Deckel 99 (PI-K2)
  });

  it("FR-VAL-03: validierte KOs erscheinen nicht mehr im Board", async () => {
    const ko = await koService.create(koInput());
    await service.rate(ko.id, "u1", "up");
    await service.rate(ko.id, "u2", "up");
    const board = await service.board();
    expect(board.find((k) => k.id === ko.id)).toBeUndefined();
  });

  it("Pedi 05.07.: Board liefert je KO die Peer-Stimmen-Zähler (X von Y grün)", async () => {
    const ko = await koService.create(koInput({ neededValidations: 3 }));
    await service.rate(ko.id, "u1", "up");
    await service.rate(ko.id, "u2", "warn");
    const board = await service.board();
    const entry = board.find((k) => k.id === ko.id);
    expect(entry?.reviewVotes).toEqual({ up: 1, warn: 1, down: 0 });
    expect(entry?.neededValidations).toBe(3);
  });

  it("Pedi 05.07.: adminValidate schließt die Validierung in einem Schritt ab", async () => {
    const ko = await koService.create(koInput({ neededValidations: 3 }));
    const outcome = await service.adminValidate(ko.id, "admin-1");
    expect(outcome.status).toBe("validiert");
    expect(outcome.trust).toBe(99);
    const stored = await koService.get(ko.id);
    expect(stored?.status).toBe("validiert");
    expect(stored?.trust).toBe(99);
    // Danach nicht mehr im Board (nur offene KOs).
    const board = await service.board();
    expect(board.find((k) => k.id === ko.id)).toBeUndefined();
  });

  it("Pedi 05.07.: adminValidate schreibt einen eigenen Audit-Eintrag", async () => {
    const auditRepo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo: auditRepo });
    const svc = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      audit,
    });
    const ko = await koService.create(koInput());
    await svc.adminValidate(ko.id, "admin-1");
    const entries = await audit.list({ action: "ko.admin-validated" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.target).toBe(ko.id);
    expect(entries[0]?.actor).toBe("admin-1");
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
    await withAudit.assign(ko.id, ["u1"], "controller");
    await withAudit.rate(ko.id, "u1", "up");

    expect(await audit.list({ action: "ko.assigned" })).toHaveLength(1);
    const rated = await audit.list({ action: "ko.rated" });
    expect(rated).toHaveLength(1);
    expect(rated[0]?.actor).toBe("u1");
  });

  it("SCRUM-124: Rot (down) gibt das Objekt als offene Aufgabe an den Autor zurück + Audit", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const svc = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      audit,
    });
    const ko = await koService.create(koInput({ author: "anna" }));
    await svc.rate(ko.id, "controller", "down");

    // Echte offene Zuweisung an den Autor (sichtbar in der Übersicht).
    const overview = await svc.overview();
    expect(overview).toEqual([{ userId: "anna", open: 1, done: 0 }]);
    // Audit-Event ko.returned-to-author mit Verdict.
    const returned = await audit.list({ action: "ko.returned-to-author" });
    expect(returned).toHaveLength(1);
    expect(returned[0]?.target).toBe(ko.id);
    expect(returned[0]?.payload.verdict).toBe("down");
    // Kern-Status bleibt offen (kein Hard-rejected).
    expect((await koService.get(ko.id))?.status).toBe("offen");
  });

  it("SCRUM-124: Gelb (warn) gibt ebenfalls zurück; Grün (up) erzeugt keine Autor-Rückgabe", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const svc = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      audit,
    });
    const warnKo = await koService.create(koInput({ author: "bob" }));
    await svc.rate(warnKo.id, "controller", "warn");
    expect(await audit.list({ action: "ko.returned-to-author" })).toHaveLength(1);

    const upKo = await koService.create(koInput({ author: "carla" }));
    await svc.rate(upKo.id, "controller", "up");
    // Keine Rückgabe an carla → nur die eine Rückgabe (an bob) existiert.
    const returned = await audit.list({ action: "ko.returned-to-author" });
    expect(returned).toHaveLength(1);
    expect(returned[0]?.payload.author).toBe("bob");
  });

  it("SCRUM-124: doppeltes Gelb/Rot dedupliziert die Autor-Zuweisung (bleibt 1 offen)", async () => {
    const ko = await koService.create(koInput({ author: "anna" }));
    await service.rate(ko.id, "u1", "warn");
    await service.rate(ko.id, "u2", "down");
    const overview = await service.overview();
    expect(overview.find((s) => s.userId === "anna")).toEqual({
      userId: "anna",
      open: 1,
      done: 0,
    });
  });
});
