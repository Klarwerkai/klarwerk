import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { type CreateKoInput, InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";
import { InMemoryValidationSettingsRepo } from "./settings";

// ================================================================================================
// BEN-70 ROT-2 — DER DRITTE ENTSCHEIDUNGSWEG MUSS AUCH ANKOMMEN
// ================================================================================================
//
// `returnToAuthor` erzeugte die Referenz bereits korrekt und gab sie zurueck — aber `rate()` rief
// die Methode auf, VERWARF den Rueckgabewert und lieferte weiter die Referenz des vorherigen
// `ko.rated`-Ereignisses. Die erlaubte Action-Menge enthielt den Namen; das ersetzt keine
// transportierte Referenz.
//
// Der Fehler war eine halbe Zusage: der Weg war gebaut, aber nicht angeschlossen.

function koInput(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Wartung der Spezialpresse",
    statement: "Alle 500 Stunden schmieren.",
    type: "best_practice",
    category: "Technik",
    author: "anna",
    neededValidations: 2,
    ...overrides,
  };
}

async function aufbau() {
  const auditRepo = new InMemoryAuditRepo();
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const dienst = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    settings: new InMemoryValidationSettingsRepo(),
    audit: new AuditService({ repo: auditRepo }),
  });
  const ko = await koService.create(koInput());
  return { dienst, auditRepo, koId: ko.id, version: ko.version };
}

describe("BEN-70/ROT-2 · die Referenz der Rueckgabe an den Autor reist mit", () => {
  it("bei `warn` traegt der oeffentliche Rueckgabewert die ko.returned-to-author-Referenz", async () => {
    const { dienst, auditRepo, koId } = await aufbau();
    const ergebnis = await dienst.rate(koId, "bea", "warn");
    const ref = ergebnis.validationDecisionRef;
    expect(ref).not.toBeNull();
    if (!ref) {
      throw new Error("keine Referenz");
    }
    const eintrag = await auditRepo.findBySeq(ref.auditSeq);
    // BENs Kern: erwartet wird der Eintrag der RUECKGABE, nicht der der Bewertung.
    expect(eintrag?.action).toBe("ko.returned-to-author");
    expect(eintrag?.hash).toBe(ref.auditHash);
  });

  it("bei `down` gilt dasselbe — derselbe Codepfad, dieselbe Zusage", async () => {
    const { dienst, auditRepo, koId } = await aufbau();
    const ergebnis = await dienst.rate(koId, "bea", "down");
    const ref = ergebnis.validationDecisionRef;
    if (!ref) {
      throw new Error("keine Referenz");
    }
    expect((await auditRepo.findBySeq(ref.auditSeq))?.action).toBe("ko.returned-to-author");
  });

  it("GEGENKONTROLLE bei `up`: ohne Rueckgabe an den Autor bleibt es die ko.rated-Referenz", async () => {
    const { dienst, auditRepo, koId } = await aufbau();
    const ergebnis = await dienst.rate(koId, "bea", "up");
    const ref = ergebnis.validationDecisionRef;
    if (!ref) {
      throw new Error("keine Referenz");
    }
    // Ohne diesen Fall koennte die Korrektur einfach IMMER die letzte Referenz liefern — das waere
    // eine andere Zusage und ebenso falsch.
    expect((await auditRepo.findBySeq(ref.auditSeq))?.action).toBe("ko.rated");
  });

  it("beide Eintraege existieren — die Rueckgabe ERSETZT den Bewertungsbeleg nicht", async () => {
    const { dienst, auditRepo, koId } = await aufbau();
    await dienst.rate(koId, "bea", "warn");
    const aktionen = (await auditRepo.all()).map((e) => e.action);
    expect(aktionen).toContain("ko.rated");
    expect(aktionen).toContain("ko.returned-to-author");
  });

  it("die gelieferte Referenz zeigt auf die HOEHERE Sequenz — die spaetere Entscheidung", async () => {
    const { dienst, auditRepo, koId } = await aufbau();
    const ergebnis = await dienst.rate(koId, "bea", "warn");
    const ref = ergebnis.validationDecisionRef;
    if (!ref) {
      throw new Error("keine Referenz");
    }
    const rated = (await auditRepo.all()).find((e) => e.action === "ko.rated");
    expect(rated).toBeDefined();
    expect(ref.auditSeq).toBeGreaterThan(rated?.seq ?? 0);
  });
});
