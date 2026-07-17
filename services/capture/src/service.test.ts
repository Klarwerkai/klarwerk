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

  // SCRUM-524 P.1 (WP5): bodyHtml wird an der PERSISTENZ-Grenze serverseitig sanitisiert. Entwürfe sind
  // ein geteilter Pool und werden beim Fortsetzen im Editor gerendert → aktives Markup darf NIE persistiert
  // werden. Ohne die Sanitisierung in createDraft/continueDraft landete der Roh-Payload im Bestand.
  it("WP5: <script>/onerror/javascript:/<iframe> werden beim createDraft entfernt", async () => {
    const draft = await service.createDraft(
      {
        title: "XSS",
        bodyHtml:
          "<p>ok <b>fett</b></p><script>alert(1)</script>" +
          '<img src=x onerror="alert(2)">' +
          '<a href="javascript:alert(3)">klick</a>' +
          '<iframe src="https://evil.example"></iframe>',
      },
      "anna",
    );
    const stored = (await service.getDraft(draft.id))!.payload.bodyHtml ?? "";
    // Aktives Markup weg:
    expect(stored).not.toContain("<script");
    expect(stored).not.toContain("onerror");
    expect(stored).not.toContain("javascript:");
    expect(stored).not.toContain("<iframe");
    // Harmlose Formatierung überlebt (der Sanitizer normalisiert <b> → <strong>):
    expect(stored).toContain("<strong>fett</strong>");
    expect(stored).toContain("ok");
  });

  it("WP5: auch continueDraft sanitisiert einen neu gesetzten bodyHtml", async () => {
    const draft = await service.createDraft({ title: "Roh" }, "anna");
    const continued = await service.continueDraft(
      draft.id,
      { bodyHtml: "<p>hallo</p><script>steal()</script>" },
      "bob",
    );
    expect(continued.payload.bodyHtml ?? "").not.toContain("<script");
    expect(continued.payload.bodyHtml ?? "").toContain("hallo");
    // Und wirklich SO persistiert (nicht nur im Rückgabewert):
    const stored = (await service.getDraft(draft.id))!.payload.bodyHtml ?? "";
    expect(stored).not.toContain("<script");
  });

  it("WP5: leerer/kein bodyHtml bleibt unverändert (kein Zwang)", async () => {
    const a = await service.createDraft({ title: "A" }, "anna");
    expect((await service.getDraft(a.id))!.payload.bodyHtml).toBeUndefined();
    const b = await service.createDraft({ title: "B", bodyHtml: "" }, "anna");
    expect((await service.getDraft(b.id))!.payload.bodyHtml).toBe("");
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
