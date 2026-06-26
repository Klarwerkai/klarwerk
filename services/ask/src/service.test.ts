import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import {
  type AnswerResult,
  type KnowledgeRef,
  Reasoner,
  type ReasonerLocale,
  type ReasonerProvider,
  type StructureResult,
} from "../../reasoner";
import { InMemoryGapRepo } from "./repo";
import { AskService } from "./service";
import type { Gap } from "./types";

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
  const gaps = new InMemoryGapRepo();
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps,
    audit,
  });
  return { ask, koService, audit, gaps };
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

  it("SCRUM-115: neue Lücke hat Default-Priorität 'mittel'", async () => {
    const { gap } = await ctx.ask.ask("Noch eine unbekannte Frage?");
    expect(gap?.priority).toBe("mittel");
    expect((await ctx.ask.listGaps())[0]?.priority).toBe("mittel");
  });

  it("SCRUM-115: setGapPriority ändert die Priorität + Audit-Eintrag", async () => {
    const { gap } = await ctx.ask.ask("Frage ohne Antwort?");
    if (!gap) {
      throw new Error("Lücke erwartet.");
    }
    const updated = await ctx.ask.setGapPriority(gap.id, "hoch");
    expect(updated.priority).toBe("hoch");
    expect((await ctx.ask.listGaps())[0]?.priority).toBe("hoch");
    expect(await ctx.audit.list({ action: "gap.priority-changed" })).toHaveLength(1);
  });

  it("SCRUM-115: ungültige Priorität wird abgewiesen", async () => {
    const { gap } = await ctx.ask.ask("Wieder eine offene Frage?");
    if (!gap) {
      throw new Error("Lücke erwartet.");
    }
    await expect(
      // @ts-expect-error: ungültiger Wert wird zur Laufzeit abgewiesen
      ctx.ask.setGapPriority(gap.id, "dringend"),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // SCRUM-88 / FR-I18N-01: AskService reicht die UI-Sprache an den Reasoner durch.
  it("FR-I18N-01: ask(..., 'en') übergibt locale an den Reasoner", async () => {
    const seen: (ReasonerLocale | undefined)[] = [];
    const capturing: ReasonerProvider = {
      name: "capture",
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => {
        throw new Error("ungenutzt");
      },
      answer: async (
        _q: string,
        _ctx: readonly KnowledgeRef[],
        locale?: ReasonerLocale,
      ): Promise<AnswerResult> => {
        seen.push(locale);
        return {
          answered: true,
          answer: "ok",
          knowledgeClass: "gesichert",
          trust: 50,
          sources: ["x"],
          steps: [],
          demo: false,
        };
      },
      assistText: async () => ({ text: "", demo: false }),
      interview: async () => ({
        question: null,
        done: true,
        draft: {
          title: "",
          statement: "",
          conditions: [],
          measures: [],
          tags: [],
          confidence: 0,
          demo: false,
        },
        demo: false,
      }),
      select: () => [],
    };
    const ask = new AskService({
      reasoner: new Reasoner(capturing),
      koService: ctx.koService,
      gaps: ctx.gaps,
      audit: ctx.audit,
    });
    await ask.ask("Frage", "tester", "en");
    await ask.ask("Frage");
    expect(seen).toEqual(["en", "de"]);
  });

  it("SCRUM-115: Legacy-Lücke ohne priority wird beim Lesen auf 'mittel' normalisiert", async () => {
    // Direkt ins Repo geschrieben, ohne priority (Altdaten).
    const legacy = {
      id: "legacy-1",
      question: "Alte Lücke",
      status: "offen",
      assignee: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    } as unknown as Gap;
    await ctx.gaps.insert(legacy);
    const listed = (await ctx.ask.listGaps()).find((g) => g.id === "legacy-1");
    expect(listed?.priority).toBe("mittel");
    const assigned = await ctx.ask.assignGap("legacy-1", "experte-1");
    expect(assigned.priority).toBe("mittel");
  });
});
