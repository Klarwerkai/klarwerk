import { beforeEach, describe, expect, it } from "vitest";
import { InterviewSession } from "./interview";
import { InMemoryDraftRepo } from "./repo";
import { CaptureService } from "./service";

describe("CaptureService", () => {
  let service: CaptureService;

  beforeEach(() => {
    service = new CaptureService({ repo: new InMemoryDraftRepo() });
  });

  it("FR-CAP-06: Entwurf landet im gemeinsamen Pool", async () => {
    await service.createDraft({ title: "Idee A" }, "anna");
    await service.createDraft({ title: "Idee B" }, "bob");
    const pool = await service.listDrafts();
    expect(pool).toHaveLength(2);
  });

  it("FR-CAP-07: beim Fortsetzen bleibt der Originalautor erhalten", async () => {
    const draft = await service.createDraft({ title: "Roh" }, "anna");
    const continued = await service.continueDraft(draft.id, { statement: "ausgearbeitet" }, "bob");
    expect(continued.originalAuthor).toBe("anna");
    expect(continued.lastEditor).toBe("bob");
    expect(continued.payload.statement).toBe("ausgearbeitet");
  });

  it("FR-CAP-07: KO-Eingabe trägt den Entwurfs-Autor, nicht den Bearbeiter", async () => {
    const draft = await service.createDraft(
      {
        title: "Ventil schließen",
        statement: "Bei Überdruck schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
      "anna",
    );
    await service.continueDraft(draft.id, { tags: ["druck"] }, "bob");
    const koInput = await service.toKoInput(draft.id);
    expect(koInput.author).toBe("anna");
    // SCRUM-395: KEIN hartes 3 mehr im Capture-Modul — ohne Angabe bleibt das Feld leer,
    // knowledge-object löst den Default zentral auf (Admin-Standard, sonst Modul-Default).
    expect(koInput.neededValidations).toBeUndefined();
  });

  // SCRUM-509 R2: die im Entwurf gewählte Vertraulichkeit übersteht das Promote (kein Verlust →
  // sonst würde ein vertraulicher Entwurf als intern zum KO = fail-open).
  it("SCRUM-509 R2: die Vertraulichkeitsstufe des Entwurfs wandert in die KO-Eingabe (kein Verlust)", async () => {
    const draft = await service.createDraft(
      {
        title: "Geheim",
        statement: "Vertraulicher Kerntext.",
        type: "best_practice",
        category: "Anlage 1",
        confidentiality: "vertraulich",
      },
      "anna",
    );
    const koInput = await service.toKoInput(draft.id);
    expect(koInput.confidentiality).toBe("vertraulich");
  });

  it("SCRUM-395: eine im Entwurf gesetzte Prüferanzahl wandert unverändert in die KO-Eingabe", async () => {
    const draft = await service.createDraft(
      {
        title: "Ventil schließen",
        statement: "Bei Überdruck schließen.",
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 4,
      },
      "anna",
    );
    const koInput = await service.toKoInput(draft.id);
    expect(koInput.neededValidations).toBe(4);
  });

  it("FR-CAP-08: ungültige Validierungsanzahl wird abgewiesen", async () => {
    await expect(service.createDraft({ neededValidations: 0 }, "anna")).rejects.toMatchObject({
      code: "INVALID_NEEDED",
    });
  });

  it("toKoInput verlangt vollständige Pflichtfelder", async () => {
    const draft = await service.createDraft({ title: "nur Titel" }, "anna");
    await expect(service.toKoInput(draft.id)).rejects.toMatchObject({ code: "INCOMPLETE" });
  });
});

describe("InterviewSession (FR-CAP-02)", () => {
  it("stellt eine Frage pro Schritt und schließt nach genügend Antworten ab", () => {
    const session = new InterviewSession();
    let steps = 0;
    while (!session.isComplete()) {
      const q = session.currentQuestion();
      expect(q).toBeTruthy();
      session.answer(`Antwort ${steps}`);
      steps += 1;
    }
    expect(steps).toBeGreaterThanOrEqual(4);
    expect(session.currentQuestion()).toBeUndefined();
    const result = session.result();
    expect(result.title).toBe("Antwort 0");
    expect(result.conditions).toEqual(["Antwort 1"]);
  });
});
