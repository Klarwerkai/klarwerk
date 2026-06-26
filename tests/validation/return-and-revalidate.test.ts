import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryLifecycleRepo, LifecycleService } from "../../services/lifecycle";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  ValidationService,
} from "../../services/validation";

function wire() {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const koService = new KoService({ repo: new InMemoryKoRepo(), audit });
  const validation = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    audit,
  });
  const lifecycle = new LifecycleService({ koService, repo: new InMemoryLifecycleRepo() });
  return { audit, koService, validation, lifecycle };
}

const koInput = (author = "anna") => ({
  title: "Ventil schließen",
  statement: "Bei Überdruck Ventil X schließen.",
  type: "best_practice" as const,
  category: "Anlage 1",
  author,
  neededValidations: 2,
});

describe("SCRUM-124+126: Rückgabe & Revalidierung end-to-end", () => {
  it("SCRUM-124: Gelb-Feedback gibt das Objekt als offene Aufgabe an den Autor zurück", async () => {
    const { koService, validation, audit } = wire();
    const ko = await koService.create(koInput("anna"));
    await validation.rate(ko.id, "controller", "warn");

    const overview = await validation.overview();
    expect(overview).toEqual([{ userId: "anna", open: 1, done: 0 }]);
    expect(await audit.list({ action: "ko.returned-to-author" })).toHaveLength(1);
  });

  it("SCRUM-126: validiert → erneut in Prüfung (Revalidierung erzeugt neue Version, Status offen)", async () => {
    const { koService, validation, lifecycle } = wire();
    const ko = await koService.create(koInput());

    // Zwei grüne Bewertungen → validiert.
    await validation.rate(ko.id, "u1", "up");
    await validation.rate(ko.id, "u2", "up");
    const validated = await koService.get(ko.id);
    expect(validated?.status).toBe("validiert");
    expect(validated?.version).toBe(1);

    // Revalidierung über den bestehenden confirmStillValid/revise-Pfad.
    const revalidated = await lifecycle.confirmStillValid(ko.id, "controller");
    expect(revalidated.status).toBe("offen"); // sichtbar zurück in Prüfung
    expect(revalidated.version).toBe(2); // neue Version
    expect(revalidated.trust).toBe(0); // Bewertungen zurückgesetzt

    // Erscheint wieder im Validierungs-Board (nur offene KOs).
    const board = await validation.board();
    expect(board.find((k) => k.id === ko.id)).toBeDefined();
  });
});
