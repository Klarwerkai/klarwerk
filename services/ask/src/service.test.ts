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

  it("SCRUM-284: speichert eine sehr lange Gap-Frage datensparsam begrenzt", async () => {
    const long = `Bitte beachte folgenden Kontext: ${"lorem ipsum dolor sit amet ".repeat(40)}`;
    const { result, gap } = await ctx.ask.ask(long);
    expect(result.answered).toBe(false);
    expect(gap).not.toBeNull();
    // Persistierte Frage ist begrenzt + endet mit Ellipse (Risk/Capture erben diesen Text).
    expect((gap?.question.length ?? 0) <= 201).toBe(true);
    expect(gap?.question.endsWith("…")).toBe(true);
  });

  // FUNKE-FIX P0 (bens ROT-1): das „Danke" verlangt einen serverseitig ausgestellten Answer-Receipt,
  // der GENAU dieses KO diesem Nutzer als Quelle belegt. Ein echter Antwortvorgang liefert ihn.
  const HELPFUL_QUESTION = "Was tun bei Überdruck am Ventil?";
  async function receiptFor(actor: string): Promise<string> {
    const { result, receipt } = await ctx.ask.ask(HELPFUL_QUESTION, actor);
    // Der Beleg bindet die ausgelieferten Quellen — der Test-Store hat GENAU dieses eine KO.
    expect(result.sources.length).toBeGreaterThan(0);
    return receipt;
  }

  it("FR-ASK-04: 'Hat geholfen' (mit gültigem Beleg) erhöht Trust und erzeugt Audit-Eintrag", async () => {
    const list = await ctx.koService.list();
    const ko = list[0];
    if (!ko) {
      throw new Error("KO fehlt.");
    }
    await ctx.ask.markHelpful(await receiptFor("viewer-1"), ko.id, "viewer-1");
    const after = await ctx.koService.get(ko.id);
    expect(after?.trust).toBeGreaterThan(ko.trust);
    const audit = await ctx.audit.list({ action: "answer.helpful" });
    expect(audit).toHaveLength(1);
  });

  // FUNKE-FIX P0 (bens ROT-1): eine unbelegte/fremd gewählte KO-ID ist NICHT mehr wirksam →
  // FORBIDDEN, kein Trust, kein Audit. Weder ein leerer Beleg, noch ein gültiger Beleg für ein
  // NICHT ausgeliefertes KO, noch der Beleg EINES ANDEREN Nutzers autorisiert das „Danke".
  it("FUNKE-FIX P0: unbelegte/fremde KO-ID → FORBIDDEN (kein Trust, kein Audit)", async () => {
    const ko = (await ctx.koService.list())[0];
    if (!ko) {
      throw new Error("KO fehlt.");
    }
    // (a) gar kein Beleg
    await expect(ctx.ask.markHelpful("", ko.id, "viewer-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const receipt = await receiptFor("viewer-1");
    // (b) gültiger Beleg, aber für eine KO-ID, die dieser Vorgang NICHT auslieferte
    await expect(ctx.ask.markHelpful(receipt, "fremdes-ko", "viewer-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // (c) fremder Nutzer legt den Beleg von viewer-1 vor
    await expect(ctx.ask.markHelpful(receipt, ko.id, "eindringling")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await ctx.audit.list({ action: "answer.helpful" })).toHaveLength(0);
    expect((await ctx.koService.get(ko.id))?.trust).toBe(ko.trust);
  });

  // FUNKE F2 (nacht24 Paket 6): „Danke" ist IDEMPOTENT je Nutzer+Ziel — der zweite Klick derselben
  // Person bewirkt nichts (kein weiterer Trust-Bump, kein Doppel-Audit, keine Doppel-Glocke).
  // Eine ANDERE Person zählt weiterhin (eigener Beleg).
  it("FUNKE F2: markHelpful idempotent je Nutzer+Ziel; andere Nutzer zählen weiter", async () => {
    const ko = (await ctx.koService.list())[0];
    if (!ko) {
      throw new Error("KO fehlt.");
    }
    const r1 = await receiptFor("viewer-1");
    await ctx.ask.markHelpful(r1, ko.id, "viewer-1");
    const afterFirst = await ctx.koService.get(ko.id);
    await ctx.ask.markHelpful(r1, ko.id, "viewer-1"); // zweiter Klick derselben Person → No-op
    const afterSecond = await ctx.koService.get(ko.id);
    expect(afterSecond?.trust).toBe(afterFirst?.trust);
    expect(await ctx.audit.list({ action: "answer.helpful" })).toHaveLength(1);
    // Eine andere Person darf weiterhin danken (eigener, ehrlicher Beleg).
    await ctx.ask.markHelpful(await receiptFor("viewer-2"), ko.id, "viewer-2");
    expect(await ctx.audit.list({ action: "answer.helpful" })).toHaveLength(2);
    const afterOther = await ctx.koService.get(ko.id);
    expect(afterOther?.trust).toBeGreaterThan(afterSecond?.trust ?? 0);
  });

  // FUNKE-FIX P0 (bens ROT-1): zwei GLEICHZEITIGE „Danke" desselben Nutzers auf dasselbe KO ⇒ genau
  // EIN Audit und genau EIN Trust-Schritt (recordOnce-CAS koppelt den Bump atomar an den Schreibsieg;
  // kein Read-then-Write-Fenster). Der In-Memory-Guard ist synchron; der echte Postgres-Paralleltest
  // liegt in service.integration.test.ts.
  it("FUNKE-FIX P0: zwei gleichzeitige Danke → genau EIN Audit, genau EIN Trust-Schritt (Barrier)", async () => {
    const ko = (await ctx.koService.list())[0];
    if (!ko) {
      throw new Error("KO fehlt.");
    }
    const before = ko.trust;
    const receipt = await receiptFor("viewer-1");
    await Promise.all([
      ctx.ask.markHelpful(receipt, ko.id, "viewer-1"),
      ctx.ask.markHelpful(receipt, ko.id, "viewer-1"),
    ]);
    expect(await ctx.audit.list({ action: "answer.helpful", target: ko.id })).toHaveLength(1);
    const after = await ctx.koService.get(ko.id);
    expect(after?.trust).toBe(Math.min(99, before + 2)); // genau EIN Schritt (+2), nie doppelt
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
      extract: async () => ({ points: [], note: null, demo: false }),
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

// SCRUM-502 (Sicherheit): vertrauliche KOs gehen NIE in einen externen Kontext. Für /api/ask heißt das:
// nie ins Modell-Input, nie in die zitierten Quellen, nie in den Antworttext. Ein Upstream-Filter an der
// Kandidatenauswahl deckt alle drei ab. Nicht-vertrauliche KOs bleiben unverändert nutzbar.
describe("SCRUM-502: Ask schließt vertrauliche KOs aus", () => {
  it("vertrauliches KO ist NIE zitierte Quelle / Schritt-Quelle", async () => {
    const { ask, koService } = await setup();
    const secret = await koService.create({
      title: "Xylophon Notfall",
      statement: "Xylophon-Anlage bei Störung sofort abschalten.",
      type: "best_practice",
      category: "Geheim",
      author: "anna",
      confidentiality: "vertraulich",
    });
    const { result } = await ask.ask("Was tun bei Störung der Xylophon-Anlage?");
    expect(result.sources).not.toContain(secret.id);
    expect(result.steps.every((s) => s.sourceId !== secret.id)).toBe(true);
  });

  it("Kontrast: dasselbe KO NICHT-vertraulich wird zitiert (der Filter ist die Ursache)", async () => {
    const { ask, koService } = await setup();
    const open = await koService.create({
      title: "Xylophon Notfall",
      statement: "Xylophon-Anlage bei Störung sofort abschalten.",
      type: "best_practice",
      category: "Betrieb",
      author: "anna",
    });
    const { result } = await ask.ask("Was tun bei Störung der Xylophon-Anlage?");
    expect(result.sources).toContain(open.id);
  });
});

// SCRUM-490 R2 (B1/A2): Add-on-Pfad = RETRIEVAL-ONLY. Der (vertrauliche) Dokumenttext darf NIE ans
// Modell synthetisiert werden; die Antwort entsteht rein aus Retrieval gegen validierte, nicht-
// vertrauliche KOs. Und ein „Treffer" ohne echte Quelle ist kein belegter Treffer (A2).
describe("SCRUM-490 R2: Add-on Retrieval-only + Quellenpflicht", () => {
  const ANSWER = (over: Partial<AnswerResult> = {}): AnswerResult => ({
    answered: true,
    answer: "Aus Retrieval.",
    knowledgeClass: "gesichert",
    trust: 80,
    sources: ["KO-1"],
    steps: [{ description: "Q", sourceId: "KO-1", snippet: "s" }],
    demo: true,
    ...over,
  });

  async function askWith(reasoner: Reasoner) {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.create({
      title: "Ventil bei Überdruck",
      statement: "Bei Überdruck Ventil X schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
    });
    const created = (await koService.list())[0];
    if (created) {
      await koService.setValidationState(created.id, { trust: 80, status: "validiert" });
    }
    return new AskService({ reasoner, koService, gaps: new InMemoryGapRepo() });
  }

  it("B1: retrievalOnly ruft answerRetrievalOnly — der Synthese-/Egress-Pfad (answer) wird NIE betreten", async () => {
    const calls = { synth: 0, retrieval: 0 };
    const fake = {
      answer: async () => {
        calls.synth += 1;
        return ANSWER();
      },
      answerRetrievalOnly: async () => {
        calls.retrieval += 1;
        return ANSWER();
      },
    } as unknown as Reasoner;
    const ask = await askWith(fake);

    await ask.ask("Überdruck Ventil", "addon:klara", "de", {
      retrievalOnly: true,
      validatedOnly: true,
      gapPolicy: "count_only",
    });
    expect(calls.retrieval).toBe(1);
    expect(calls.synth).toBe(0); // KEIN Modell-Synthese-Call des Dokumenttexts

    // Session-Pfad (ohne retrievalOnly) nutzt weiterhin den normalen answer().
    await ask.ask("Überdruck Ventil");
    expect(calls.synth).toBe(1);
    expect(calls.retrieval).toBe(1);
  });

  it("B1: echte Retrieval-Antwort aus validiertem KO (Quelle=KO-ID); kein Treffer → ehrlich leer", async () => {
    const ask = await askWith(new Reasoner()); // Default = deterministischer (lexikalischer) Provider
    const hit = await ask.ask("Was tun bei Überdruck am Ventil?", "addon:klara", "de", {
      retrievalOnly: true,
      validatedOnly: true,
      gapPolicy: "count_only",
    });
    expect(hit.result.answered).toBe(true);
    expect(hit.result.sources.length).toBeGreaterThan(0); // echte Quelle vorhanden (A2)
    expect(hit.gap).toBeNull(); // count_only: keine Wissenslücke

    const miss = await ask.ask("Wie hoch ist der Wechselkurs heute?", "addon:klara", "de", {
      retrievalOnly: true,
      validatedOnly: true,
      gapPolicy: "count_only",
    });
    expect(miss.result.answered).toBe(false);
    expect(miss.result.sources).toEqual([]);
  });

  it("A2: answered=true mit LEEREN sources → als Nicht-Treffer behandelt (nie eine Quelle vortäuschen)", async () => {
    const sourceless = {
      answer: async () => ANSWER({ sources: [] }),
      answerRetrievalOnly: async () => ANSWER({ sources: [] }),
    } as unknown as Reasoner;
    const ask = await askWith(sourceless);
    const { result } = await ask.ask("Überdruck Ventil", "addon:klara", "de", {
      retrievalOnly: true,
      validatedOnly: true,
      gapPolicy: "count_only",
    });
    expect(result.answered).toBe(false);
    expect(result.answer).toBeNull();
    expect(result.sources).toEqual([]);
  });
});
