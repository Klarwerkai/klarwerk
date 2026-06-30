import { beforeEach, describe, expect, it } from "vitest";
import { type CreateKoInput, InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";

// SCRUM-363 / AG-15 / FR-VAL-05/06: persönliche offene Review-Zuweisungen als Feed-Quelle.
// Nur die eigenen offenen Zuweisungen; erledigte und fremde erscheinen NICHT; Zuweisungen auf
// fehlende KOs werden übersprungen (keine Geister-Hinweise).
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

describe("SCRUM-363: ValidationService.openAssignmentsFor", () => {
  let koService: KoService;
  let assignments: InMemoryAssignmentRepo;
  let service: ValidationService;

  beforeEach(() => {
    koService = new KoService({ repo: new InMemoryKoRepo() });
    assignments = new InMemoryAssignmentRepo();
    service = new ValidationService({ koService, ratings: new InMemoryRatingRepo(), assignments });
  });

  it("liefert die eigenen offenen Zuweisungen mit KO-Titel + Zeit", async () => {
    const ko = await koService.create(koInput({ title: "Presse P2 entlüften" }));
    await service.assign(ko.id, ["u1", "u2"]);

    const mine = await service.openAssignmentsFor("u1");
    expect(mine).toEqual([{ koId: ko.id, title: "Presse P2 entlüften", at: ko.createdAt }]);
    expect(await service.openAssignmentsFor("u2")).toHaveLength(1);
    // Wer keine Zuweisung hat, bekommt nichts (kein Fake-Eintrag).
    expect(await service.openAssignmentsFor("niemand")).toEqual([]);
  });

  it("zeigt KEINE fremden Zuweisungen (keine erfundene Ownership)", async () => {
    const a = await koService.create(koInput({ title: "KO A" }));
    const b = await koService.create(koInput({ title: "KO B" }));
    await service.assign(a.id, ["u1"]);
    await service.assign(b.id, ["u2"]);

    expect((await service.openAssignmentsFor("u1")).map((n) => n.koId)).toEqual([a.id]);
    expect((await service.openAssignmentsFor("u2")).map((n) => n.koId)).toEqual([b.id]);
  });

  it("erledigte Zuweisungen verschwinden aus dem Feed (nach Bewertung)", async () => {
    const ko = await koService.create(koInput());
    await service.assign(ko.id, ["u1", "u2"]);
    // u1 bewertet → seine Zuweisung wird „done".
    await service.rate(ko.id, "u1", "up");

    expect(await service.openAssignmentsFor("u1")).toEqual([]); // erledigt → weg
    expect((await service.openAssignmentsFor("u2")).map((n) => n.koId)).toEqual([ko.id]); // u2 offen
  });

  it("überspringt Zuweisungen auf nicht (mehr) vorhandene KOs", async () => {
    await assignments.create({ koId: "ghost-ko", userId: "u1", status: "open" });
    expect(await service.openAssignmentsFor("u1")).toEqual([]);
  });
});
