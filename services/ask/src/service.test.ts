import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { Reasoner } from "../../reasoner";
import { InMemoryGapRepo } from "./repo";
import { AskService } from "./service";

async function setup() {
  const koRepo = new InMemoryKoRepo();
  const koService = new KoService({ repo: koRepo });
  await koService.create({
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps: new InMemoryGapRepo(),
    audit,
  });
  return { ask, koService, audit };
}

describe("AskService", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("FR-ASK-01/02: begründete Antwort mit Quelle bei passender Frage", async () => {
    const { result, gap } = await ctx.ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.steps[0]?.sourceId).toBeTruthy();
    expect(gap).toBeNull();
  });

  it("FR-ASK-03: ohne Grundlage keine erfundene Antwort, Wissenslücke entsteht", async () => {
    const { result, gap } = await ctx.ask.ask("Wie hoch ist der Wechselkurs?");
    expect(result.answered).toBe(false);
    expect(gap).not.toBeNull();
    const gaps = await ctx.ask.listGaps();
    expect(gaps).toHaveLength(1);
  });

  it("FR-ASK-04: 'Hat geholfen' erhöht Trust und erzeugt Audit-Eintrag", async () => {
    const list = await ctx.koService.list();
    const ko = list[0];
    if (!ko) {
      throw new Error("KO fehlt.");
    }
    await ctx.ask.markHelpful(ko.id, "viewer-1");
    const after = await ctx.koService.get(ko.id);
    expect(after?.trust).toBeGreaterThan(ko.trust);
    const audit = await ctx.audit.list({ action: "answer.helpful" });
    expect(audit).toHaveLength(1);
  });

  it("FR-ASK-05: Wissenslücke zuweisen, schließen, mit Bestätigung löschen", async () => {
    const { gap } = await ctx.ask.ask("Unbekannte Frage XYZ?");
    if (!gap) {
      throw new Error("Lücke erwartet.");
    }
    const assigned = await ctx.ask.assignGap(gap.id, "experte-1");
    expect(assigned.assignee).toBe("experte-1");
    const closed = await ctx.ask.closeGap(gap.id);
    expect(closed.status).toBe("geschlossen");

    await expect(ctx.ask.deleteGap(gap.id, false)).rejects.toMatchObject({
      code: "CONFIRM_REQUIRED",
    });
    await ctx.ask.deleteGap(gap.id, true);
    expect(await ctx.ask.listGaps()).toHaveLength(0);
  });
});
