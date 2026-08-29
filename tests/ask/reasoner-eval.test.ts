import { describe, expect, it, vi } from "vitest";
import type { Conflict, KnowledgeClass, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerGrade } from "../../apps/web/src/lib/answerGrade";
import { answerContract } from "../../apps/web/src/lib/askAnswerContract";
import { conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";
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
      // AUFTRAG-mega53 B1: ein Modell, das sich an den System-Prompt hält, MARKIERT seine Quelle
      // (mega52 A1 hat aus der Erlaubnis eine Pflicht gemacht). Das Fake-Modell tat das nie —
      // damit maß dieses Eval-Set die Klasse eines Modells, das gegen den Vertrag verstößt, und
      // bekam sie trotzdem aus dem bestgerankten Kandidaten geliefert. Der vertragsWIDRIGE Fall
      // steht jetzt als eigener Fall darunter, statt hier stillschweigend der Normalfall zu sein.
      const model = capturingModel("Antwort auf Basis der Quellen [1].");
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
      // mega53 B1: die markierte Quelle ist auch die, die die Antwort trägt.
      for (const id of scenario.mustCite) {
        expect(res.citedSources).toContain(id);
      }
    });
  }

  // AUFTRAG-mega53 B2 — DER VERTRAGSWIDRIGE FALL, ausdrücklich und einzeln.
  it("ein Modell OHNE Fußnotenmarke bekommt keine Einstufung geschenkt", async () => {
    const model = capturingModel("Antwort ganz ohne Quellenverweis.");
    const res = await new ModelProvider(model.client).answer(
      "Was tun bei Überdruck am Ventil?",
      EVAL_KOS,
    );
    // JOB 2659 D1 (Review EXT1, Befund 6) — HIER STAND `answered = true` und `sources ∋ ventil`:
    // ein Text ohne jede Marke ging als Antwort hinaus, mit bis zu acht Quellen im Gepäck. Die
    // Marke ist nach dem Prompt Pflicht; ohne sie ist der Text keine Quellaussage — keine Antwort.
    expect(res.answered).toBe(false);
    expect(res.answer).toBeNull();
    expect(res.sources).toEqual([]);
    expect(res.citedSources).toEqual([]);
    expect(res.knowledgeClass).toBe("unbekannt");
    expect(res.trust).toBe(0);
  });
});

describe("SCRUM-368: Anti-Halluzination — erfundene Inhalte werden NICHT zu Quellen/Trust", () => {
  it("böswilliges Modell halluziniert Freitext, aber Quellen/Trust/Class kommen aus den Daten", async () => {
    const res = await new ModelProvider(hallucinatingModel()).answer(
      "Was tun bei Überdruck am Ventil?",
      EVAL_KOS,
    );
    // JOB 2659 D1 (Review EXT1, Befund 6) — HIER STAND „Der Modell-Freitext geht durch (die Prosa
    // zu policen ist Aufgabe des System-Prompts, nicht des Providers)" mit `answer ∋ DIN 99999`.
    // Genau das war der Befund: erfundene Norm, Zahl und Zitat gingen als Antwort hinaus. Ohne
    // Marke ist der Text keine Quellaussage — keine Antwort, und der Freitext verlässt den
    // Provider nicht.
    expect(res.answered).toBe(false);
    expect(res.answer).toBeNull();
    expect(res.sources).toEqual([]);
    // Kein Step verweist auf eine erfundene Quelle — jede sourceId ist ein echtes Eval-KO.
    const realIds = new Set(EVAL_KOS.map((k) => k.id));
    expect(res.steps.every((s) => s.sourceId !== null && realIds.has(s.sourceId))).toBe(true);
    // AUFTRAG-mega53 B1/B2 — HIER STAND `knowledgeClass = "gesichert"` UND `trust = 92`, UND DAS
    // WAR DIE SCHWÄCHERE ZUSICHERUNG.
    //
    // Der Gedanke war richtig: die Werte dürfen nicht aus dem Modelltext stammen. Der Test hat aber
    // gepinnt, dass sie stattdessen aus dem bestgerankten Kandidaten kommen — auch dann, wenn das
    // Modell ihn gar nicht benutzt hat. Genau daraus konnte ein halluzinierender Freitext eine
    // Antwort mit Vertrauenswert 92 und dem Grad „gesichert" tragen. Das Fake-Modell hier zitiert
    // nichts; die ehrliche Antwort ist deshalb, dass keine Einstufung behauptet wird.
    expect(res.citedSources).toEqual([]);
    // JOB 2659: eine Nicht-Antwort trägt die Klasse „unbekannt" — wie der Weg ohne Kandidaten.
    expect(res.knowledgeClass).toBe("unbekannt");
    expect(res.trust).toBe(0);
  });

  it("… und selbst MIT Marke kommen Klasse/Trust aus den Daten, nie aus dem Modelltext", async () => {
    // Die eigentliche Anti-Halluzinations-Zusicherung, jetzt am schärferen Fall: das Modell
    // markiert brav [1] und erfindet trotzdem Norm, Zahl und Zitat. Die Prosa geht durch, die
    // EINSTUFUNG kommt aus dem Datensatz der markierten Quelle.
    const marking: ModelClient = {
      name: "eval-hallucinate-cited",
      complete: async () => `${await hallucinatingModel().complete("", "", false)} [1]`,
    };
    const res = await new ModelProvider(marking).answer(
      "Was tun bei Überdruck am Ventil?",
      EVAL_KOS,
    );
    // JOB 2659 D1 (Review EXT1, Befund 4) — HIER STAND `answer ∋ DIN 99999`: „Die Prosa geht
    // durch." Das ist die echte halluzinierte Aussage der Abnahme (§5): erfundene Norm, erfundene
    // Zahl, erfundenes Zitat, mit Marke [1]. Vor dem Bau ging sie durch — gemessen an diesem Pin.
    // Jetzt fällt sie an der Deckungsprüfung (0 von 8 Inhaltstoken in der Quelle, Zahlen 99999 und
    // 1234 fehlen), und hinaus geht der Wortlaut der markierten Quelle. Klasse und Wert kommen
    // weiterhin aus genau dieser Quelle.
    expect(res.answered).toBe(true);
    expect(res.answer).not.toContain(HALLUCINATION_MARKERS.fakeNorm);
    expect(res.answer).not.toContain(HALLUCINATION_MARKERS.fakeNumber);
    expect(res.answer).toBe(EVAL_KOS.find((k) => k.id === KO.ventil)?.statement);
    expect(res.citedSources).toEqual([KO.ventil]);
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
    // mega52 A1: aus der Erlaubnis zu verweisen ist die PFLICHT zur Fußnotenmarke geworden.
    expect(sysDe).toContain("Erfinde keine Zitate");

    const en = capturingModel();
    // locale steuert nur die Prompt-Sprache; die Frage muss thematisch matchen, damit das Modell
    // überhaupt befragt wird (die Eval-KOs sind deutsch → Frage mit passenden Inhaltstoken).
    await new ModelProvider(en.client).answer("Ventil Überdruck", EVAL_KOS, "en");
    const sysEn = en.calls[0]?.system ?? "";
    expect(sysEn).toContain("numbered sources");
    expect(sysEn).toContain("causes or measures");
    // mega52 A1: s. DE.
    expect(sysEn).toContain("Never fabricate quotes");
  });
});

// Echte Integrationskette: KoService (InMemory) → AskService → deterministischer Reasoner. Kein Fake-
// Reasoner — belegt die Quellen-/Status-Ehrlichkeit über den realen Ask-Pfad (Prefilter + Top-K + Gap).
describe("SCRUM-368: Ask-Vollkette (deterministischer Reasoner, echte Services)", () => {
  async function seeded() {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    // G27 R1 / Entscheidung 06 §4: mechanische Initialisierung über den PRODUKTPFAD. Die Suche ist
    // seit R1 fail-closed; ein direkter Testaufbau ist eine nicht in Betrieb genommene Instanz.
    // In der echten App tut das die Startorchestrierung in build-app.ts.
    await koService.activateSearchProjectionV2();
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
    // mega53 A1: „Wie wechsle ich den verstopften Filter?" teilte mit dem KO nur „Filter" —
    // „wechsle"/„wechseln" und „verstopften"/„Verstopfung" trennt die literale Tokenisierung. Seit
    // der Mindestsubstanz ist das eine Wissenslücke; s. Bericht mega53 A5.
    const { result } = await ask.ask("Was tun mit dem Filter F3 bei Verstopfung?");
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
      answerContract(
        answerGrade({
          answered: true,
          knowledgeClass: "gesichert",
          sourcesConflicted: false,
          sourcesCheckUnproven: false,
          conflictsUnproven: false,
        }),
      ).kind,
    ).toBe("verified");
  });

  it("offene Quelle → unverified + Quelle NICHT ready", () => {
    const refs = conflictAwareSourceRefs(["b"], [ko("b", "Filter", "offen")], []);
    expect(refs[0]?.usability).toBe("needs-work");
    const cls: KnowledgeClass = "ungeprueft";
    expect(
      answerContract(
        answerGrade({
          answered: true,
          knowledgeClass: cls,
          sourcesConflicted: false,
          sourcesCheckUnproven: false,
          conflictsUnproven: false,
        }),
      ).kind,
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
      answerContract(
        answerGrade({
          answered: true,
          knowledgeClass: "gesichert",
          sourcesConflicted,
          sourcesCheckUnproven: false,
          conflictsUnproven: false,
        }),
      ).kind,
    ).toBe("unverified");
  });
});
