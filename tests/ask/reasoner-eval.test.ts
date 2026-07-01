import { describe, expect, it, vi } from "vitest";
import type { Conflict, KnowledgeClass, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerContract } from "../../apps/web/src/lib/askAnswerContract";
import { conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import {
  EVAL_KOS,
  HALLUCINATION_MARKERS,
  KO,
  MODEL_EVAL_SCENARIOS,
  capturingModel,
  hallucinatingModel,
} from "./reasoner-eval";

// SCRUM-368 / AG-04 / FR-RSN-03 / FR-ASK-02 / EK-23: dauerhaftes, repo-lokales Reasoner-/Ask-Eval-Set.
// Belegt (ohne echtes Modell/API-Key, ohne RAG): quellengebundene Antworten, ehrliche Lücke ohne Basis,
// keine Übernahme halluzinierter Inhalte in Quellen/Trust, und ehrliche Contract-Ableitung (offen/
// ungeprüft/konfliktbegrenzt bleibt sichtbar nicht-gesichert).

const titleById = (id: string) => EVAL_KOS.find((k) => k.id === id)?.title ?? id;

describe("SCRUM-368: Reasoner-Eval-Set (Modellmodus, Fake-Client)", () => {
  for (const scenario of MODEL_EVAL_SCENARIOS) {
    it(`Szenario: ${scenario.name}`, async () => {
      const model = capturingModel("Antwort auf Basis der Quellen.");
      const res = await new ModelProvider(model.client).answer(scenario.question, EVAL_KOS);

      if (scenario.expectedClass === "gap") {
        // FR-RSN-03: ohne belastbare Basis wird das Modell GAR NICHT befragt → keine Rateantwort.
        expect(res.answered).toBe(false);
        expect(res.sources).toEqual([]);
        expect(model.calls).toHaveLength(0);
        return;
      }

      expect(res.answered).toBe(true);
      expect(res.knowledgeClass).toBe(scenario.expectedClass);
      // FR-ASK-02: die führende Quelle ist genau das relevante KO.
      for (const id of scenario.mustCite) {
        expect(res.sources).toContain(id);
      }
      // Quellenüberdehnung: irrelevante/offtopic KOs erscheinen NICHT als Antwortquelle …
      for (const id of scenario.mustNotCite) {
        expect(res.sources).not.toContain(id);
      }
      // … und werden NICHT einmal in den Modell-Prompt eingebettet (Kontext bleibt begrenzt, NFR-PERF-03).
      const user = model.calls[0]?.user ?? "";
      for (const id of scenario.mustNotInPrompt) {
        expect(user).not.toContain(titleById(id));
      }
      // Die zitierten Quellen stehen sehr wohl im Prompt (Quellenbindung).
      for (const id of scenario.mustCite) {
        expect(user).toContain(titleById(id));
      }
    });
  }
});

describe("SCRUM-368: Anti-Halluzination — erfundene Inhalte werden NICHT zu Quellen/Trust", () => {
  it("böswilliges Modell halluziniert Freitext, aber Quellen/Trust/Class kommen aus den Daten", async () => {
    const res = await new ModelProvider(hallucinatingModel()).answer(
      "Was tun bei Überdruck am Ventil?",
      EVAL_KOS,
    );
    // Der Modell-Freitext geht durch (die Prosa zu policen ist Aufgabe des System-Prompts, nicht des
    // Providers) …
    expect(res.answer).toContain(HALLUCINATION_MARKERS.fakeNorm);
    // … ABER der Provider übernimmt NICHTS Erfundenes als Quelle: sources = nur das echte KO.
    expect(res.sources).toEqual([KO.ventil]);
    // Kein Step verweist auf eine erfundene Quelle — jede sourceId ist ein echtes Eval-KO.
    const realIds = new Set(EVAL_KOS.map((k) => k.id));
    expect(res.steps.every((s) => s.sourceId !== null && realIds.has(s.sourceId))).toBe(true);
    // knowledgeClass/trust stammen aus dem Datenbestand (validiertes KO), nicht aus dem Modelltext.
    expect(res.knowledgeClass).toBe("gesichert");
    expect(res.trust).toBe(92);
  });

  it("FR-RSN-03: ohne passende Quelle wird der Modell-Client nie aufgerufen", async () => {
    const complete = vi.fn(async () => "darf nicht aufgerufen werden");
    const res = await new ModelProvider({ name: "eval-guard", complete }).answer(
      "Wie hoch ist der Wechselkurs heute?",
      EVAL_KOS,
    );
    expect(res.answered).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });

  it("Anti-Halluzinations-Leitplanken stehen im System-Prompt (DE + EN)", async () => {
    const de = capturingModel();
    await new ModelProvider(de.client).answer("Überdruck Ventil", EVAL_KOS);
    const sysDe = de.calls[0]?.system ?? "";
    expect(sysDe).toContain("nummerierten Quellen");
    expect(sysDe).toContain("Ursachen oder Maßnahmen");
    expect(sysDe).toContain("kein allgemeines Weltwissen");
    expect(sysDe).toContain("erfinde keine Zitate");

    const en = capturingModel();
    // locale steuert nur die Prompt-Sprache; die Frage muss thematisch matchen, damit das Modell
    // überhaupt befragt wird (die Eval-KOs sind deutsch → Frage mit passenden Inhaltstoken).
    await new ModelProvider(en.client).answer("Ventil Überdruck", EVAL_KOS, "en");
    const sysEn = en.calls[0]?.system ?? "";
    expect(sysEn).toContain("numbered sources");
    expect(sysEn).toContain("causes or measures");
    expect(sysEn).toContain("never fabricate quotes");
  });
});

// Echte Integrationskette: KoService (InMemory) → AskService → deterministischer Reasoner. Kein Fake-
// Reasoner — belegt die Quellen-/Status-Ehrlichkeit über den realen Ask-Pfad (Prefilter + Top-K + Gap).
describe("SCRUM-368: Ask-Vollkette (deterministischer Reasoner, echte Services)", () => {
  async function seeded() {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const ventil = await koService.create({
      title: "Ventil bei Überdruck schließen",
      statement: "Bei Überdruck das Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
    });
    // Validieren (Status + Trust) — nur dieses KO ist gesichert.
    await koService.setValidationState(ventil.id, { trust: 92, status: "validiert" });
    const filter = await koService.create({
      title: "Filter F3 bei Verstopfung wechseln",
      statement: "Filter F3 bei Verstopfung tauschen, sonst Druckabfall.",
      type: "best_practice",
      category: "Anlage 2",
      author: "erik",
    });
    const ask = new AskService({
      reasoner: new Reasoner(),
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
    return { ask, ventil, filter };
  }

  it("validierte Quelle → gesicherte, quellengebundene Antwort", async () => {
    const { ask, ventil } = await seeded();
    const { result, gap } = await ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(true);
    expect(result.knowledgeClass).toBe("gesichert");
    expect(result.sources).toContain(ventil.id);
    expect(gap).toBeNull();
  });

  it("offenes KO → ehrlich ungeprüfte Antwort (nicht als gesichert verkauft)", async () => {
    const { ask, filter } = await seeded();
    const { result } = await ask.ask("Wie wechsle ich den verstopften Filter?");
    expect(result.answered).toBe(true);
    expect(result.knowledgeClass).toBe("ungeprueft");
    expect(result.sources).toContain(filter.id);
  });

  it("fehlende Basis → ehrliche Wissenslücke (kein Raten, Gap wird angelegt)", async () => {
    const { ask } = await seeded();
    const { result, gap } = await ask.ask("Wie hoch ist der aktuelle Wechselkurs heute?");
    expect(result.answered).toBe(false);
    expect(result.sources).toEqual([]);
    expect(gap).not.toBeNull();
    expect(await ask.listGaps()).toHaveLength(1);
  });

  it("Quellenüberdehnung: Frage ohne thematischen Treffer nutzt KEINE fremde Quelle → Lücke", async () => {
    const { ask } = await seeded();
    // Beide KOs (Ventil/Filter) sind vorhanden, aber die Frage passt zu keinem → keine Antwort.
    const { result, gap } = await ask.ask("Welche Versicherung zahlt bei Blitzschlag im Büro?");
    expect(result.answered).toBe(false);
    expect(gap).not.toBeNull();
  });
});

// Cross-Layer-Ehrlichkeit: reale AnswerResult-Signale → FE-Contract. Belegt, dass offen/ungeprüft/
// konfliktbegrenzt NICHT als gesichert/ready überdehnt werden.
describe("SCRUM-368: Contract-Ehrlichkeit (Quellen/Konflikt/Trust)", () => {
  const ko = (id: string, title: string, status: KnowledgeObject["status"]): KnowledgeObject =>
    ({ id, title, status }) as unknown as KnowledgeObject;
  const truthConflict = (koId: string): Conflict =>
    ({
      id: `c-${koId}`,
      koA: koId,
      koB: "other",
      type: "truth",
      status: "offen",
    }) as unknown as Conflict;

  it("validierte Quelle ohne Konflikt → verified", () => {
    const refs = conflictAwareSourceRefs(["a"], [ko("a", "Ventil", "validiert")], []);
    expect(refs[0]?.usability).toBe("ready");
    expect(
      answerContract({ answered: true, knowledgeClass: "gesichert", sourcesConflicted: false })
        .kind,
    ).toBe("verified");
  });

  it("offene Quelle → unverified + Quelle NICHT ready", () => {
    const refs = conflictAwareSourceRefs(["b"], [ko("b", "Filter", "offen")], []);
    expect(refs[0]?.usability).toBe("needs-work");
    const cls: KnowledgeClass = "ungeprueft";
    expect(
      answerContract({ answered: true, knowledgeClass: cls, sourcesConflicted: false }).kind,
    ).toBe("unverified");
  });

  it("validierte, ABER konfliktbetroffene Quelle → nicht ready + Contract herabgestuft (nicht gesichert)", () => {
    const refs = conflictAwareSourceRefs(
      ["a"],
      [ko("a", "Ventil", "validiert")],
      [truthConflict("a")],
    );
    // Effektive Nutzbarkeit ist trotz „validiert" NICHT ready (Konflikt begrenzt).
    expect(refs[0]?.usability).toBe("in-review");
    expect(refs[0]?.conflictLimited).toBe(true);
    const sourcesConflicted = refs.some((r) => r.conflictLimited);
    expect(
      answerContract({ answered: true, knowledgeClass: "gesichert", sourcesConflicted }).kind,
    ).toBe("unverified");
  });
});
