import { describe, expect, it } from "vitest";
import { DeterministicProvider, INTERVIEW_QUESTIONS, type ReasonerProvider } from "./provider";
import { Reasoner } from "./service";
import type {
  AnswerResult,
  AssistResult,
  InterviewResult,
  KnowledgeRef,
  StructureResult,
} from "./types";

const KOS: KnowledgeRef[] = [
  {
    id: "ko1",
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    status: "validiert",
    trust: 90,
  },
  {
    id: "ko2",
    title: "Pumpe schmieren",
    statement: "Pumpe alle 200h schmieren.",
    status: "offen",
    trust: 10,
  },
];

describe("DeterministicProvider", () => {
  const p = new DeterministicProvider();

  it("FR-RSN-01: Aufgaben verfügbar (structure/answer/select)", async () => {
    expect(await p.structure("Etwas Wissen.")).toBeTruthy();
    expect(p.select("Ventil", KOS)).toBeTruthy();
    expect(await p.answer("Ventil", KOS)).toBeTruthy();
  });

  it("semantische Auswahl findet das passende KO trotz anderer Worte", () => {
    const hits = p.select("Was tun bei Überdruck am Ventil?", KOS);
    expect(hits[0]?.id).toBe("ko1");
  });

  it("FR-RSN-03: ohne belastbares Wissen keine erfundene Antwort", async () => {
    const res = await p.answer("Wie hoch ist der Aktienkurs?", KOS);
    expect(res.answered).toBe(false);
    expect(res.answer).toBeNull();
    expect(res.knowledgeClass).toBe("unbekannt");
  });

  it("FR-RSN-03: assistText glättet deterministisch ohne Inhalt zu erfinden", async () => {
    const res = await p.assistText("  ventil   bei überdruck schliessen  ");
    expect(res.demo).toBe(true);
    expect(res.text).toBe("Ventil bei überdruck schliessen.");
  });

  it("klassifiziert validiertes Wissen als gesichert mit Quellen", async () => {
    const res = await p.answer("Überdruck Ventil", KOS);
    expect(res.knowledgeClass).toBe("gesichert");
    expect(res.sources).toContain("ko1");
    expect(res.steps[0]?.sourceId).toBe("ko1");
    expect(res.steps[0]?.snippet).toBe(KOS[0]?.statement); // FR-ASK-06: Belegstelle
  });
});

describe("Reasoner", () => {
  it("FR-RSN-04/05: ohne Modell deterministischer Fallback, Status offline", async () => {
    const reasoner = new Reasoner(); // kein primärer Provider
    expect(reasoner.status()).toEqual({
      active: false,
      provider: "deterministic",
      mode: "deterministic",
    });
    const res = await reasoner.answer("Überdruck Ventil", KOS);
    expect(res.demo).toBe(true);
    expect(res.answered).toBe(true);
  });

  it("FR-RSN-05: Status spiegelt verfügbares Modell", async () => {
    const fakeModel: ReasonerProvider = {
      name: "fake-model",
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => ({
        title: "t",
        statement: "s",
        conditions: [],
        measures: [],
        tags: [],
        confidence: 1,
        demo: false,
      }),
      answer: async (): Promise<AnswerResult> => ({
        answered: true,
        answer: "Modell-Antwort",
        knowledgeClass: "gesichert",
        trust: 100,
        sources: [],
        steps: [],
        demo: false,
      }),
      assistText: async (): Promise<AssistResult> => ({ text: "Modell-Text", demo: false }),
      interview: async (): Promise<InterviewResult> => ({
        question: "Modell-Frage?",
        done: false,
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
    const reasoner = new Reasoner(fakeModel);
    expect(reasoner.status()).toEqual({ active: true, provider: "fake-model", mode: "model" });
    // FR-RSN-02: Fachlogik unverändert, Verhalten kommt vom getauschten Provider.
    expect((await reasoner.answer("egal", KOS)).answer).toBe("Modell-Antwort");
  });

  it("FR-RSN-04: fällt auf deterministisch zurück, wenn das Modell offline ist", async () => {
    const offlineModel: ReasonerProvider = {
      name: "offline-model",
      isAvailable: () => false,
      structure: () => {
        throw new Error("sollte nicht aufgerufen werden");
      },
      answer: () => {
        throw new Error("sollte nicht aufgerufen werden");
      },
      assistText: () => {
        throw new Error("sollte nicht aufgerufen werden");
      },
      interview: () => {
        throw new Error("sollte nicht aufgerufen werden");
      },
      select: () => {
        throw new Error("sollte nicht aufgerufen werden");
      },
    };
    const reasoner = new Reasoner(offlineModel);
    expect(reasoner.status().active).toBe(false);
    expect((await reasoner.answer("Überdruck Ventil", KOS)).demo).toBe(true);
  });

  it("FR-RSN-04: Laufzeitfehler des Modells → deterministischer Fallback (Betrieb stabil)", async () => {
    const flakyModel: ReasonerProvider = {
      name: "flaky-model",
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => {
        throw new Error("Netzfehler");
      },
      answer: async (): Promise<AnswerResult> => {
        throw new Error("Netzfehler");
      },
      assistText: async (): Promise<AssistResult> => {
        throw new Error("Netzfehler");
      },
      interview: async (): Promise<InterviewResult> => {
        throw new Error("Netzfehler");
      },
      select: () => [],
    };
    const reasoner = new Reasoner(flakyModel);
    // Trotz verfügbarem (aber fehlerhaftem) Modell liefert der Fallback ein Ergebnis.
    const res = await reasoner.answer("Überdruck Ventil", KOS);
    expect(res.answered).toBe(true);
    expect(res.demo).toBe(true);
    const structured = await reasoner.structure("Pumpe alle 200h schmieren.");
    expect(structured.demo).toBe(true);
    const assisted = await reasoner.assistText("pumpe schmieren");
    expect(assisted.demo).toBe(true);
    // SCRUM-132: auch Interview fällt deterministisch zurück, klar als demo markiert.
    const iv = await reasoner.interview(["Kernaussage", "Bedingung", "Maßnahme"]);
    expect(iv.demo).toBe(true);
    expect(iv.done).toBe(true);
  });

  it("SCRUM-132: nutzt das Modell zum Umformulieren der Frage (Verdichtung deterministisch)", async () => {
    const phrasingModel: ReasonerProvider = {
      name: "phrasing-model",
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => {
        throw new Error("ungenutzt");
      },
      answer: async (): Promise<AnswerResult> => {
        throw new Error("ungenutzt");
      },
      assistText: async (): Promise<AssistResult> => {
        throw new Error("ungenutzt");
      },
      interview: async (answers): Promise<InterviewResult> => ({
        question: "Modell-Frage?",
        done: false,
        // Verdichtung bleibt deterministisch nachvollziehbar (hier: erste Antwort = Titel).
        draft: {
          title: answers[0] ?? "",
          statement: answers[0] ?? "",
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
    const reasoner = new Reasoner(phrasingModel);
    const res = await reasoner.interview(["Kernaussage"]);
    expect(res.demo).toBe(false);
    expect(res.question).toBe("Modell-Frage?");
    expect(res.draft.title).toBe("Kernaussage");
  });
});

describe("DeterministicProvider.interview (SCRUM-132)", () => {
  const p = new DeterministicProvider();

  it("eine Frage pro Turn entlang der Fragenfolge", async () => {
    const t0 = await p.interview([]);
    expect(t0.question).toBe(INTERVIEW_QUESTIONS[0]);
    expect(t0.done).toBe(false);
    expect(t0.demo).toBe(true);

    const t1 = await p.interview(["Bei Überdruck Ventil X schließen."]);
    expect(t1.question).toBe(INTERVIEW_QUESTIONS[1]);
    expect(t1.done).toBe(false);

    const t2 = await p.interview(["Aussage", "Bedingung"]);
    expect(t2.question).toBe(INTERVIEW_QUESTIONS[2]);
  });

  it("Abschluss bei ausreichendem Inhalt (Kernaussage + Bedingung + Maßnahme)", async () => {
    const res = await p.interview(["Aussage", "Bedingung", "Maßnahme"]);
    expect(res.done).toBe(true);
    expect(res.question).toBeNull();
  });

  it("verdichtet die Antworten nachvollziehbar zum Entwurf", async () => {
    const res = await p.interview([
      "Ventil schließen",
      "Bei Überdruck",
      "Hand-Ventil zu",
      "ventil, druck",
    ]);
    expect(res.draft.title).toBe("Ventil schließen");
    expect(res.draft.statement).toBe("Ventil schließen");
    expect(res.draft.conditions).toEqual(["Bei Überdruck"]);
    expect(res.draft.measures).toEqual(["Hand-Ventil zu"]);
    expect(res.draft.tags).toEqual(["ventil", "druck"]);
    expect(res.draft.demo).toBe(true);
  });
});
