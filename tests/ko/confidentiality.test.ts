import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  type CreateKoInput,
  InMemoryKoRepo,
  KoService,
  isConfidential,
  normalizeConfidentiality,
} from "../../services/knowledge-object";
import { OutputError, OutputService } from "../../services/output";

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

describe("SCRUM-415: Vertraulichkeit — Helfer", () => {
  it("normalisiert defensiv auf 'intern' und erkennt vertrauliche Stufen", () => {
    expect(normalizeConfidentiality(undefined)).toBe("intern");
    expect(normalizeConfidentiality("quatsch")).toBe("intern");
    expect(normalizeConfidentiality("vertraulich")).toBe("vertraulich");
    expect(isConfidential(undefined)).toBe(false);
    expect(isConfidential("intern")).toBe(false);
    expect(isConfidential("vertraulich")).toBe(true);
    expect(isConfidential("streng_vertraulich")).toBe(true);
  });
});

describe("SCRUM-415: KoService", () => {
  it("übernimmt die Vertraulichkeitsstufe beim Erfassen (nur wenn vertraulich)", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const vertraulich = await ko.create(koInput({ confidentiality: "vertraulich" }));
    expect(vertraulich.confidentiality).toBe("vertraulich");
    // Standard „intern" wird NICHT gespeichert (Alt-Verhalten/Tests unberührt).
    const normal = await ko.create(koInput());
    expect(normal.confidentiality).toBeUndefined();
    const explizitIntern = await ko.create(koInput({ confidentiality: "intern" }));
    expect(explizitIntern.confidentiality).toBeUndefined();
  });

  it("ändert die Stufe mit Audit-Eintrag", async () => {
    const auditRepo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo: auditRepo });
    const ko = new KoService({ repo: new InMemoryKoRepo(), audit });
    const created = await ko.create(koInput());
    const updated = await ko.setConfidentiality(created.id, "streng_vertraulich", "chef");
    expect(updated.confidentiality).toBe("streng_vertraulich");
    const entries = await audit.list({ action: "ko.confidentiality" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actor).toBe("chef");
    expect(entries[0]?.target).toBe(created.id);
  });
});

describe("SCRUM-415: Output Factory schließt vertrauliche KOs aus (nie in externe Kontexte)", () => {
  async function validatedKo(ko: KoService, overrides: Partial<CreateKoInput> = {}) {
    const created = await ko.create(koInput(overrides));
    await ko.setValidationState(created.id, { trust: 99, status: "validiert" });
    return created;
  }

  it("listet vertrauliche KOs NICHT als Output-Quelle", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const output = new OutputService({ koService: ko });
    const offen = await validatedKo(ko, { title: "Öffentlich" });
    const geheim = await validatedKo(ko, { title: "Geheim", confidentiality: "vertraulich" });

    const eligible = await output.listEligible();
    const ids = eligible.map((s) => s.id);
    expect(ids).toContain(offen.id);
    expect(ids).not.toContain(geheim.id);
  });

  it("verweigert das Erzeugen eines Outputs aus einem vertraulichen KO", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const output = new OutputService({ koService: ko });
    const geheim = await validatedKo(ko, { confidentiality: "streng_vertraulich" });

    await expect(output.generate({ kind: "instruction", koIds: [geheim.id] })).rejects.toThrow(
      OutputError,
    );
  });
});
