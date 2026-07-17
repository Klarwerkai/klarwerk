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

  // SCRUM-509: ungültige Stufe wird NICHT still auf „intern" normalisiert, sondern abgelehnt (fail-safe).
  it("lehnt eine ungültige Stufe ab (kein stilles Normalisieren auf intern)", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const created = await ko.create(koInput({ confidentiality: "vertraulich" }));
    await expect(ko.setConfidentiality(created.id, "quatsch" as never, "chef")).rejects.toThrow();
    // Die gespeicherte Stufe bleibt unverändert vertraulich (kein fail-open Downgrade).
    expect((await ko.get(created.id))?.confidentiality).toBe("vertraulich");
  });

  // SCRUM-509: eine Herabstufung wird im Audit als downgrade markiert (Vorher/Nachher nachvollziehbar).
  it("markiert eine Herabstufung im Audit (previous + downgrade=true)", async () => {
    const auditRepo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo: auditRepo });
    const ko = new KoService({ repo: new InMemoryKoRepo(), audit });
    const created = await ko.create(koInput({ confidentiality: "vertraulich" }));
    // SCRUM-509 R3: Downgrade braucht explizit mayDowngrade (fehlend → blockiert, fail-safe).
    await ko.setConfidentiality(created.id, "intern", "chef", { mayDowngrade: true });
    const entries = await audit.list({ action: "ko.confidentiality" });
    const last = entries.at(-1) as { payload?: { previous?: string; downgrade?: boolean } };
    expect(last.payload?.previous).toBe("vertraulich");
    expect(last.payload?.downgrade).toBe(true);
  });

  // SCRUM-509 R3: Downgrade OHNE mayDowngrade wird im SERVICE abgelehnt (fail-safe), nicht nur an der
  // Route — ein programmatischer Aufrufer darf nicht aus einem fehlenden Recht herabstufen.
  it("SCRUM-509 R3: Downgrade ohne mayDowngrade → abgelehnt (fail-safe im Service)", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const created = await ko.create(koInput({ confidentiality: "vertraulich" }));
    await expect(ko.setConfidentiality(created.id, "intern", "prog")).rejects.toThrow();
    expect((await ko.get(created.id))?.confidentiality).toBe("vertraulich");
    // Upgrade bleibt ohne Recht frei.
    const created2 = await ko.create(koInput());
    await ko.setConfidentiality(created2.id, "vertraulich", "prog");
    expect((await ko.get(created2.id))?.confidentiality).toBe("vertraulich");
  });

  // SCRUM-509 R3: optimistische Concurrency — ein nebenläufiger Voll-Objekt-Write überschreibt ein
  // Vertraulichkeits-Upgrade NICHT (per-KO serialisiert + rowVersion-CAS; beide Änderungen greifen).
  it("SCRUM-509 R3: paralleler Vollobjekt-Write vs. Upgrade → kein Überschreiben", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const created = await ko.create(koInput()); // intern
    await Promise.all([
      ko.updateCategory(created.id, "Anlage 9", "anna"),
      ko.setConfidentiality(created.id, "vertraulich", "chef"), // Upgrade
    ]);
    const stored = await ko.get(created.id);
    expect(stored?.confidentiality).toBe("vertraulich"); // Upgrade NICHT verloren
    expect(stored?.category).toBe("Anlage 9"); // Kategorie ebenfalls (serialisiert)
  });

  // SCRUM-509 R3: repo.update ist Compare-and-Set auf rowVersion — ein veralteter Write scheitert.
  it("SCRUM-509 R3: repo.update Compare-and-Set (veralteter Voll-Objekt-Write → STALE_WRITE)", async () => {
    const repo = new InMemoryKoRepo();
    const ko = new KoService({ repo });
    const created = await ko.create(koInput());
    const stale = (await ko.get(created.id))!; // rowVersion-Stand „gelesen"
    await repo.update({ ...stale, category: "X" }); // greift → hebt rowVersion
    // Zweiter Write mit dem ALTEN (veralteten) Stand → STALE_WRITE.
    await expect(repo.update({ ...stale, category: "Y" })).rejects.toThrow();
  });

  // SCRUM-509 R2: create mit EXPLIZIT ungültiger Stufe → abgelehnt (kein stilles Intern).
  it("create lehnt eine explizit ungültige Stufe ab (fail-safe, kein Intern-Default)", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    await expect(ko.create(koInput({ confidentiality: "quatsch" as never }))).rejects.toThrow();
    // Fehlt die Stufe ganz, gilt der dokumentierte Standard „intern" (nicht gespeichert).
    const normal = await ko.create(koInput());
    expect(normal.confidentiality).toBeUndefined();
  });

  // SCRUM-509 R2: Audit atomar mit der Änderung — schlägt das Audit fehl, unterbleibt die Änderung.
  it("Audit-Fehler bei setConfidentiality → Rollback (Stufe bleibt unverändert)", async () => {
    // Wirft NUR bei der Vertraulichkeits-Aktion (create/andere Audits bleiben funktionsfähig).
    const throwingAudit = {
      record: async (entry: { action: string }) => {
        if (entry.action === "ko.confidentiality") {
          throw new Error("audit down");
        }
      },
    } as unknown as AuditService;
    const ko = new KoService({ repo: new InMemoryKoRepo(), audit: throwingAudit });
    const created = await ko.create(koInput({ confidentiality: "vertraulich" }));
    await expect(ko.setConfidentiality(created.id, "streng_vertraulich", "chef")).rejects.toThrow(
      "audit down",
    );
    // Die Änderung ist NICHT wirksam geworden (nie „wirksam, aber unbelegt").
    expect((await ko.get(created.id))?.confidentiality).toBe("vertraulich");
  });

  // SCRUM-509 R2: nebenläufiges verbotenes Downgrade + erlaubtes Upgrade — kein unberechtigtes
  // Überschreiben (per-KO serialisiert, Downgrade-Prüfung gegen die gerade gültige Stufe).
  it("parallel: verbotenes Downgrade wird abgelehnt, erlaubtes Upgrade greift (kein Lost-Update)", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const created = await ko.create(koInput({ confidentiality: "vertraulich" }));
    const [downgrade, upgrade] = await Promise.allSettled([
      ko.setConfidentiality(created.id, "intern", "experte", { mayDowngrade: false }),
      ko.setConfidentiality(created.id, "streng_vertraulich", "controller", { mayDowngrade: true }),
    ]);
    expect(downgrade.status).toBe("rejected"); // Herabstufung ohne Recht → immer verweigert
    expect(upgrade.status).toBe("fulfilled");
    // Endzustand ist die berechtigte Höherstufung — NIE das unberechtigte „intern".
    expect((await ko.get(created.id))?.confidentiality).toBe("streng_vertraulich");
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
