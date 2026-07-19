import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "../../model-runs";
import { DeterministicProvider, INTERVIEW_QUESTIONS, type ReasonerProvider } from "./provider";
import { InMemoryReasonerPolicyRepo, type ReasonerPolicyRepo } from "./reasoner-policy";
import {
  DEFAULT_REASONER_POLICY,
  LOAD_FAILURE_FALLBACK_POLICY,
  Reasoner,
  ReasonerPolicyLockedError,
} from "./service";
import type { ReasonerTaskConfig } from "./types";
import type {
  AnswerResult,
  AssistResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerLocale,
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

  it("SCRUM-282: langer/offtopic Kontext erzeugt KEINE Scheinquelle (answered=false)", async () => {
    // Lange, fachfremde Frage: überschneidet sich höchstens über Funktionswörter (ist/die/von …)
    // mit den KOs. Diese dürfen NICHT als belegte Antwort durchkommen → ehrliche Wissenslücke.
    const offtopic = `Bitte beachte folgenden langen irrelevanten Kontext: ${"lorem ipsum dolor sit amet ".repeat(
      20,
    )} Was ist die Hauptstadt von Australien?`;
    const res = await p.answer(offtopic, KOS);
    expect(res.answered).toBe(false);
    expect(res.answer).toBeNull();
    expect(res.knowledgeClass).toBe("unbekannt");
    expect(res.sources).toEqual([]);
  });

  it("SCRUM-282: seed-sichere Fachfragen bleiben quellengebunden beantwortbar", async () => {
    const ventil = await p.answer("Wann muss Ventil X bei Überdruck geschlossen werden?", KOS);
    expect(ventil.answered).toBe(true);
    expect(ventil.knowledgeClass).toBe("gesichert");
    expect(ventil.sources).toEqual(["ko1"]); // nur tatsächlich genutztes KO (SCRUM-256)
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

  // SCRUM-256: Die deterministische Antwort stammt aus genau EINEM KO (best). Auch wenn weitere
  // KOs lose mitmatchen, dürfen sie NICHT als gleichwertige Antwortquellen erscheinen.
  it("SCRUM-256: meldet nur die tatsächlich genutzte Quelle, nicht lose Treffer", async () => {
    const kos: KnowledgeRef[] = [
      {
        id: "ko-strong",
        title: "Ventil bei Überdruck schließen",
        statement: "Bei Überdruck Ventil X manuell schließen, bis die Anlage entlastet ist.",
        status: "validiert",
        trust: 90,
      },
      {
        id: "ko-weak",
        title: "Ventil reinigen",
        statement: "Ventil regelmäßig reinigen.", // teilt nur das schwache Token „ventil"
        status: "offen",
        trust: 20,
      },
    ];
    // Beide KOs matchen (Token „ventil"); ko-strong hat die höhere Überschneidung → best.
    expect(p.select("Überdruck Ventil schließen", kos).map((k) => k.id)).toEqual([
      "ko-strong",
      "ko-weak",
    ]);

    const res = await p.answer("Überdruck Ventil schließen", kos);
    expect(res.answered).toBe(true);
    expect(res.answer).toBe(kos[0]?.statement); // Antwort kommt aus ko-strong
    expect(res.sources).toEqual(["ko-strong"]); // nur die genutzte Quelle
    expect(res.sources).not.toContain("ko-weak"); // loser Treffer ist KEINE Antwortquelle
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0]?.sourceId).toBe("ko-strong");
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
      extract: async () => ({ points: [], note: null, demo: false }),
      select: () => [],
    };
    const reasoner = new Reasoner(fakeModel);
    expect(reasoner.status()).toEqual({ active: true, provider: "fake-model", mode: "model" });
    // FR-RSN-02: Fachlogik unverändert, Verhalten kommt vom getauschten Provider.
    expect((await reasoner.answer("egal", KOS)).answer).toBe("Modell-Antwort");
  });

  it("SCRUM-312: reicht die optionale assist-Instruction an den (Modell-)Provider durch", async () => {
    let seen: string | undefined = "UNSET";
    const recordingModel: ReasonerProvider = {
      name: "recording-model",
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => ({
        title: "",
        statement: "",
        conditions: [],
        measures: [],
        tags: [],
        confidence: 0,
        demo: false,
      }),
      answer: async (): Promise<AnswerResult> => ({
        answered: false,
        answer: "",
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
        demo: false,
      }),
      assistText: async (
        _text: string,
        _locale?: ReasonerLocale,
        instruction?: string,
      ): Promise<AssistResult> => {
        seen = instruction;
        return { text: "ok", demo: false };
      },
      interview: async (): Promise<InterviewResult> => ({
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
    const reasoner = new Reasoner(recordingModel);
    await reasoner.assistText("text", "de", "Formuliere klarer");
    expect(seen).toBe("Formuliere klarer");
    // Ohne Instruction wird auch keine durchgereicht (undefined).
    await reasoner.assistText("text", "de");
    expect(seen).toBeUndefined();
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
      extract: () => {
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
      extract: async () => ({ points: [], note: null, demo: false }),
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
    // SCRUM-88 / FR-I18N-01: der Fallback behält die geforderte Sprache.
    const enFb = await reasoner.answer("Überdruck Ventil", KOS, "en");
    expect(enFb.demo).toBe(true);
    expect(enFb.steps[0]?.description.startsWith("Source:")).toBe(true);
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
      extract: async () => ({ points: [], note: null, demo: false }),
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
    expect(t0.question).toBe(INTERVIEW_QUESTIONS.de[0]);
    expect(t0.done).toBe(false);
    expect(t0.demo).toBe(true);

    const t1 = await p.interview(["Bei Überdruck Ventil X schließen."]);
    expect(t1.question).toBe(INTERVIEW_QUESTIONS.de[1]);
    expect(t1.done).toBe(false);

    const t2 = await p.interview(["Aussage", "Bedingung"]);
    expect(t2.question).toBe(INTERVIEW_QUESTIONS.de[2]);
  });

  // SCRUM-88 / FR-I18N-01: deterministisches Interview folgt der Sprache.
  it("liefert die nächste Frage auf Englisch bei locale 'en'", async () => {
    const t0 = await p.interview([], "en");
    expect(t0.question).toBe(INTERVIEW_QUESTIONS.en[0]);
    const t1 = await p.interview(["Close valve X on overpressure."], "en");
    expect(t1.question).toBe(INTERVIEW_QUESTIONS.en[1]);
  });

  it("Answer-Steps nutzen 'Source:' bei locale 'en', 'Quelle:' sonst", async () => {
    const de = await p.answer("Überdruck Ventil", KOS);
    expect(de.steps[0]?.description.startsWith("Quelle:")).toBe(true);
    const en = await p.answer("Überdruck Ventil", KOS, "en");
    expect(en.steps[0]?.description.startsWith("Source:")).toBe(true);
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

// SCRUM-164: ModelRun-Protokoll für structure/assist/interview.
function okModel(): ReasonerProvider {
  return {
    name: "anthropic:test-model",
    isAvailable: () => true,
    structure: async (): Promise<StructureResult> => ({
      title: "T",
      statement: "S",
      conditions: [],
      measures: [],
      tags: [],
      confidence: 0,
      demo: false,
    }),
    answer: async (): Promise<AnswerResult> => ({
      answered: false,
      answer: null,
      knowledgeClass: "unbekannt",
      trust: 0,
      sources: [],
      steps: [],
      demo: false,
    }),
    assistText: async (): Promise<AssistResult> => ({ text: "x", demo: false }),
    interview: async (): Promise<InterviewResult> => ({
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
}

function throwingProvider(name: string): ReasonerProvider {
  const boom = async (): Promise<never> => {
    throw new Error("Netzfehler");
  };
  return {
    name,
    isAvailable: () => true,
    structure: boom,
    answer: boom,
    assistText: boom,
    interview: boom,
    extract: async () => ({ points: [], note: null, demo: false }),
    select: () => [],
  };
}

describe("SCRUM-164: ModelRun-Protokoll", () => {
  it("erfolgreicher structure-Run erzeugt einen Record (success, kein Fallback, kein Demo)", async () => {
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(okModel(), undefined, runs);
    await reasoner.structure("Rohtext.", "de");
    const recent = await runs.recent();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      task: "structure",
      status: "success",
      fallback: false,
      demo: false,
      provider: "anthropic:test-model",
      model: "anthropic:test-model",
      locale: "de",
    });
  });

  it("Fallback-Pfad: primary scheitert → Record mit fallback:true, demo:true", async () => {
    const runs = new InMemoryModelRunRepo();
    // Default-Fallback = DeterministicProvider (liefert demo:true).
    const reasoner = new Reasoner(throwingProvider("flaky-model"), undefined, runs);
    await reasoner.structure("Rohtext.", "de");
    const recent = await runs.recent();
    expect(recent[0]).toMatchObject({
      task: "structure",
      status: "success",
      fallback: true,
      demo: true,
      provider: "deterministic",
    });
    expect(recent[0]?.model).toBeUndefined();
  });

  it("interview mit Locale schreibt die Locale in den Record", async () => {
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(okModel(), undefined, runs);
    await reasoner.interview([], "en");
    const recent = await runs.recent();
    expect(recent[0]).toMatchObject({ task: "interview", locale: "en", status: "success" });
  });

  it("Fehlerpfad: primary UND fallback scheitern → status error, KEIN Prompttext", async () => {
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(
      throwingProvider("flaky-model"),
      throwingProvider("broken-fallback"),
      runs,
    );
    const secret = "GEHEIMER ROHTEXT 4711";
    await expect(reasoner.structure(secret, "de")).rejects.toThrow();
    const recent = await runs.recent();
    expect(recent[0]).toMatchObject({ task: "structure", status: "error", fallback: true });
    // Niemals Prompt-/Antwortinhalt im Record.
    expect(JSON.stringify(recent[0])).not.toContain(secret);
  });

  it("ohne ModelRun-Repo bleibt der Reasoner funktionsfähig (No-op)", async () => {
    const reasoner = new Reasoner(okModel());
    const res = await reasoner.structure("Rohtext.", "de");
    expect(res.title).toBe("T");
  });
});

describe("KI-Verwaltung v1: Task-Zuordnung (02.07.2026)", () => {
  it("deterministic je Aufgabe erzwingt den Fallback trotz verfügbarem Modell", async () => {
    const r = new Reasoner(okModel());
    await r.setTaskConfig({ global: "auto", perTask: { structure: "deterministic" } });
    const cfg = r.configStatus();
    expect(cfg.effective.structure).toBe("deterministic");
    expect(cfg.effective.assist).toBe("model");
    const draft = await r.structure("Ventil X schließt bei Überdruck nach 3 Sekunden.");
    expect(draft.demo).toBe(true); // deterministischer Entwurf, ehrlich gekennzeichnet
  });

  it("global deterministic gilt für alle Aufgaben ohne Override", async () => {
    const r = new Reasoner(okModel());
    await r.setTaskConfig({ global: "deterministic", perTask: {} });
    for (const v of Object.values(r.configStatus().effective)) {
      expect(v).toBe("deterministic");
    }
  });

  it("'model' verlangt ohne verfügbares Modell bleibt ehrlich deterministisch", async () => {
    const r = new Reasoner(); // kein Primary
    await r.setTaskConfig({ global: "model", perTask: {} });
    expect(r.configStatus().effective.structure).toBe("deterministic");
  });

  it("weist ungültige Zuordnungen ab und behält den alten Stand", async () => {
    const r = new Reasoner();
    // SCRUM-525 P.5 (WP6): setTaskConfig ist jetzt async (persistiert) → ungültige Werte werden zu einer
    // Rejection (die Validierung läuft vor dem Persist; der alte In-Memory-Stand bleibt unverändert).
    await expect(r.setTaskConfig({ global: "quantum" as never, perTask: {} })).rejects.toThrow();
    await expect(
      r.setTaskConfig({ global: "auto", perTask: { structure: "magie" as never } }),
    ).rejects.toThrow();
    expect(r.getTaskConfig()).toEqual({ global: "auto", perTask: {} });
  });
});

// SCRUM-525 P.5 (WP6): die KI-Zuordnung (Policy) ist PERSISTENT — sie überlebt Neustart/Deploy und fällt
// nicht mehr still auf "auto" zurück. Fehlt eine Policy, greift ein DEFINIERTER Default (ehrlich meldbar).
describe("SCRUM-525 P.5 (WP6): persistente Reasoner-Policy", () => {
  it("gesetzte Policy überlebt einen simulierten Neustart (gemeinsames Repo, neue Instanz)", async () => {
    const policyRepo = new InMemoryReasonerPolicyRepo();
    // Instanz 1: Admin setzt eine Nicht-Default-Policy.
    const before = new Reasoner(
      undefined,
      new DeterministicProvider(),
      undefined,
      undefined,
      undefined,
      policyRepo,
    );
    await before.setTaskConfig({ global: "deterministic", perTask: { structure: "cloud" } });

    // Instanz 2 = „nach dem Neustart": frische Reasoner-Instanz, DASSELBE persistente Repo.
    const after = new Reasoner(
      undefined,
      new DeterministicProvider(),
      undefined,
      undefined,
      undefined,
      policyRepo,
    );
    // Vor dem Laden steht der Default; erst loadPersistedPolicy holt die gespeicherte Wahl zurück.
    const loaded = await after.loadPersistedPolicy();
    expect(loaded.source).toBe("persisted");
    expect(after.getTaskConfig()).toEqual({
      global: "deterministic",
      perTask: { structure: "cloud" },
    });
  });

  it("ohne konfigurierte Policy → DEFINIERTER Default + source 'default' (kein stiller Auto-Fallback)", async () => {
    const r = new Reasoner(
      undefined,
      new DeterministicProvider(),
      undefined,
      undefined,
      undefined,
      new InMemoryReasonerPolicyRepo(),
    );
    const loaded = await r.loadPersistedPolicy();
    expect(loaded.source).toBe("default");
    expect(loaded.config).toEqual(DEFAULT_REASONER_POLICY);
    expect(r.getTaskConfig()).toEqual(DEFAULT_REASONER_POLICY);
  });

  it("setTaskConfig persistiert wirklich (Repo hält die Wahl)", async () => {
    const policyRepo = new InMemoryReasonerPolicyRepo();
    const r = new Reasoner(
      undefined,
      new DeterministicProvider(),
      undefined,
      undefined,
      undefined,
      policyRepo,
    );
    expect(await policyRepo.get()).toBeNull(); // vorher nie konfiguriert
    await r.setTaskConfig({ global: "local", perTask: {} });
    expect(await policyRepo.get()).toEqual({ global: "local", perTask: {} });
  });
});

// SCRUM-525 P.5 (WP3-Batch3): korrektes Wiring — write-then-runtime, fail-closed bei Ladefehler, ENV-
// Präzedenz. Ein steuerbares Fake-Repo simuliert DB-Lese-/Schreibfehler.
describe("SCRUM-525 P.5 (WP3): Policy-Wiring (write-then-runtime, fail-closed, ENV)", () => {
  class ControllableRepo implements ReasonerPolicyRepo {
    stored: ReasonerTaskConfig | null = null;
    failGet = false;
    failSet = false;
    async get(): Promise<ReasonerTaskConfig | null> {
      if (this.failGet) {
        throw new Error("db read down");
      }
      return this.stored;
    }
    async set(config: ReasonerTaskConfig): Promise<void> {
      if (this.failSet) {
        throw new Error("db write down");
      }
      this.stored = { global: config.global, perTask: { ...config.perTask } };
    }
  }

  function makeReasoner(repo: ReasonerPolicyRepo): Reasoner {
    return new Reasoner(
      undefined,
      new DeterministicProvider(),
      undefined,
      undefined,
      undefined,
      repo,
    );
  }

  // (b) WRITE-THEN-RUNTIME: schlägt der DB-Write fehl, bleibt die Laufzeit-Policy UNVERÄNDERT (kein Drift).
  it("setTaskConfig: DB-Write-Fehler → Laufzeit unverändert, Fehler propagiert", async () => {
    const repo = new ControllableRepo();
    const r = makeReasoner(repo);
    await r.setTaskConfig({ global: "local", perTask: {} }); // etabliert einen bekannten Stand
    repo.failSet = true;
    await expect(r.setTaskConfig({ global: "cloud", perTask: {} })).rejects.toThrow(
      "db write down",
    );
    expect(r.getTaskConfig().global).toBe("local"); // NICHT auf cloud gedriftet
  });

  // (c) LOAD-FEHLER EHRLICH: DB-Lesefehler → NICHT still auto, sondern fail-closed deterministic.
  it("loadPersistedPolicy: DB-Lesefehler → fail-closed deterministic, source 'load-error'", async () => {
    const repo = new ControllableRepo();
    repo.failGet = true;
    const r = makeReasoner(repo);
    const res = await r.loadPersistedPolicy();
    expect(res.source).toBe("load-error");
    expect(res.config).toEqual(LOAD_FAILURE_FALLBACK_POLICY);
    expect(res.config.global).toBe("deterministic"); // NICHT auto
    expect(r.getTaskConfig().global).toBe("deterministic");
    expect(res.detail).toContain("db read down"); // laut meldbar
  });

  // (d) ENV-Präzedenz: ENV-Override gewinnt über die persistierte Wahl, wird aber NICHT persistiert.
  it("loadPersistedPolicy: ENV-Override > persistierte Wahl (transient, nicht persistiert)", async () => {
    const repo = new ControllableRepo();
    repo.stored = { global: "cloud", perTask: {} }; // Admin hatte cloud gewählt
    const r = makeReasoner(repo);
    const res = await r.loadPersistedPolicy({ envGlobal: "deterministic" });
    expect(res.source).toBe("env");
    expect(r.getTaskConfig().global).toBe("deterministic"); // ENV gewinnt zur Laufzeit
    expect(repo.stored).toEqual({ global: "cloud", perTask: {} }); // Persistenz UNVERÄNDERT
  });

  it("loadPersistedPolicy: ohne ENV → persistierte Wahl gilt", async () => {
    const repo = new ControllableRepo();
    repo.stored = { global: "local", perTask: {} };
    const r = makeReasoner(repo);
    const res = await r.loadPersistedPolicy({ envGlobal: undefined });
    expect(res.source).toBe("persisted");
    expect(r.getTaskConfig().global).toBe("local");
  });

  it("loadPersistedPolicy: ungültiger ENV-Wert → ignoriert, fällt auf persistiert zurück (mit Hinweis)", async () => {
    const repo = new ControllableRepo();
    repo.stored = { global: "cloud", perTask: {} };
    const r = makeReasoner(repo);
    const res = await r.loadPersistedPolicy({ envGlobal: "quatsch" });
    expect(res.source).toBe("persisted");
    expect(r.getTaskConfig().global).toBe("cloud");
    expect(res.detail).toContain("quatsch"); // ehrlich gemeldet
  });

  // (a) STARTREIHENFOLGE (Reasoner-Anteil): nach dem await von loadPersistedPolicy steht die wirksame
  // Policy fest — kein Auto-Fenster. Der Server ruft dieses await VOR app.listen (siehe server.ts).
  it("nach await loadPersistedPolicy steht die Policy fest (kein Default-Fenster)", async () => {
    const repo = new ControllableRepo();
    repo.stored = { global: "deterministic", perTask: {} };
    const r = makeReasoner(repo);
    expect(r.getTaskConfig().global).toBe("auto"); // vor dem Laden noch Default
    await r.loadPersistedPolicy();
    expect(r.getTaskConfig().global).toBe("deterministic"); // danach steht die Wahl
  });
});

// SCRUM-525 P.5 (WP-C): Befund 3(a) — ein per Deploy-ENV gesetzter Wert (KLARWERK_REASONER_POLICY)
// wurde bisher SOFORT von einem Admin-Write überschrieben (Laufzeit + DB), obwohl die ENV als bewusste
// Deploy-Vorgabe gedacht ist. Der Service merkt sich jetzt die Herkunft der aktiven Policy
// (policySource: "env" | "db" | "default") und lehnt setTaskConfig ab, solange ein ENV-Override aktiv
// ist — mit einem eigenen Fehlertyp (ReasonerPolicyLockedError), den die Route auf 409 mappt.
describe("SCRUM-525 P.5 (WP-C): ENV-Sperre für den Admin-Schreibpfad", () => {
  function makeReasoner(repo: ReasonerPolicyRepo): Reasoner {
    return new Reasoner(
      undefined,
      new DeterministicProvider(),
      undefined,
      undefined,
      undefined,
      repo,
    );
  }

  it("ENV-gebootet: setTaskConfig wirft ReasonerPolicyLockedError, Policy bleibt unverändert", async () => {
    const repo = new InMemoryReasonerPolicyRepo();
    const r = makeReasoner(repo);
    const loaded = await r.loadPersistedPolicy({ envGlobal: "deterministic" });
    expect(loaded.source).toBe("env");
    expect(r.configStatus().policySource).toBe("env");

    await expect(r.setTaskConfig({ global: "cloud", perTask: {} })).rejects.toBeInstanceOf(
      ReasonerPolicyLockedError,
    );
    await expect(r.setTaskConfig({ global: "cloud", perTask: {} })).rejects.toThrow(
      /Deploy-Konfiguration/,
    );

    // Weder Laufzeit noch DB haben sich verändert — die ENV-Vorgabe bleibt bestehen.
    expect(r.getTaskConfig().global).toBe("deterministic");
    expect(await repo.get()).toBeNull(); // nie in die DB geschrieben (der Write wurde gar nicht versucht)
    expect(r.configStatus().policySource).toBe("env"); // weiterhin gesperrt
  });

  it("ohne ENV: setTaskConfig funktioniert wie bisher, policySource wechselt danach auf 'db'", async () => {
    const repo = new InMemoryReasonerPolicyRepo();
    const r = makeReasoner(repo);
    const loaded = await r.loadPersistedPolicy();
    expect(loaded.source).toBe("default");
    expect(r.configStatus().policySource).toBe("default"); // noch nichts persistiert/env-gesperrt

    const result = await r.setTaskConfig({ global: "cloud", perTask: {} });
    expect(result.global).toBe("cloud"); // unverändertes Verhalten: der Write greift
    expect(await repo.get()).toEqual({ global: "cloud", perTask: {} }); // wirklich persistiert
    expect(r.configStatus().policySource).toBe("db"); // Quelle jetzt die gerade gesetzte Admin-Wahl
  });

  it("Ladefehler (DB nicht erreichbar): policySource bleibt 'default', der Schreibpfad ist NICHT gesperrt", async () => {
    let stored: ReasonerTaskConfig | null = null;
    const failingRepo: ReasonerPolicyRepo = {
      get: () => Promise.reject(new Error("db read down")),
      set: async (config) => {
        stored = { global: config.global, perTask: { ...config.perTask } };
      },
    };
    const r = makeReasoner(failingRepo);
    const loaded = await r.loadPersistedPolicy();
    expect(loaded.source).toBe("load-error");
    expect(r.configStatus().policySource).toBe("default"); // KEIN ENV-Override → Schreibpfad bleibt offen

    // Ein Admin kann die Zuordnung setzen, OBWOHL der Boot-Read fehlschlug (kein ENV-Lock).
    const result = await r.setTaskConfig({ global: "local", perTask: {} });
    expect(result.global).toBe("local");
    expect(stored).toEqual({ global: "local", perTask: {} });
    expect(r.configStatus().policySource).toBe("db");
  });
});

describe("SCRUM-166: Reasoner configStatus", () => {
  it("ohne Modell → configured false, mode demo, Fallback verfügbar", () => {
    const cfg = new Reasoner().configStatus();
    expect(cfg.configured).toBe(false);
    expect(cfg.cloudConfigured).toBe(false);
    expect(cfg.localConfigured).toBe(false);
    expect(cfg.mode).toBe("demo");
    expect(cfg.fallbackAvailable).toBe(true);
    expect(cfg.provider).toBe("deterministic");
    expect(cfg.model).toBeUndefined();
    expect(cfg.supportsLocales).toEqual(["de", "en"]);
    expect(cfg.tasks).toContain("structure");
    expect(cfg.tasks).toContain("answer");
  });

  it("mit Modell → configured true, mode model, provider/model gesetzt", () => {
    const cfg = new Reasoner(okModel()).configStatus();
    expect(cfg.configured).toBe(true);
    expect(cfg.cloudConfigured).toBe(true);
    expect(cfg.localConfigured).toBe(false);
    expect(cfg.mode).toBe("model");
    expect(cfg.provider).toBe("anthropic:test-model");
    expect(cfg.model).toBe("anthropic:test-model");
  });

  it("liefert keinerlei Secret-/Key-/Prompt-Felder", () => {
    const cfg = new Reasoner(okModel()).configStatus();
    const json = JSON.stringify(cfg).toLowerCase();
    expect(json).not.toContain("key");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("token");
    expect(json).not.toContain("prompt");
    expect("apiKey" in cfg).toBe(false);
  });
});

describe("SCRUM-167: ModelRun-Protokoll für answer/select", () => {
  it("answer erzeugt einen Record (success, kein Demo bei Modell) ohne Frage-/Antworttext", async () => {
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(okModel(), undefined, runs);
    await reasoner.answer("Was tun bei Überdruck am Ventil?", KOS, "de");
    const recent = await runs.recent();
    const rec = recent.find((r) => r.task === "answer");
    expect(rec).toMatchObject({
      task: "answer",
      status: "success",
      fallback: false,
      demo: false,
      provider: "anthropic:test-model",
      locale: "de",
    });
    // Niemals Frage-/Antwort-/Kandidatentext im Record.
    const json = JSON.stringify(rec);
    expect(json).not.toContain("Überdruck");
    expect(json).not.toContain("Ventil");
  });

  it("answer-Fallback: primary scheitert → fallback:true, demo:true", async () => {
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(throwingProvider("flaky-model"), undefined, runs);
    await reasoner.answer("Frage?", KOS, "de");
    const rec = (await runs.recent()).find((r) => r.task === "answer");
    expect(rec).toMatchObject({ status: "success", fallback: true, demo: true });
  });

  it("select erzeugt einen Record (demo:true, kein Fallback) ohne Kandidaten-/Inhaltstext", async () => {
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(okModel(), undefined, runs);
    reasoner.select("Ventil Überdruck", KOS);
    const recent = await runs.recent();
    const rec = recent.find((r) => r.task === "select");
    expect(rec).toMatchObject({
      task: "select",
      status: "success",
      fallback: false,
      demo: true,
    });
    expect(rec?.locale).toBeUndefined(); // select ist sprach-agnostisch
    const json = JSON.stringify(rec);
    expect(json).not.toContain("Überdruck");
    expect(json).not.toContain("Ventil");
    expect(json).not.toContain("Pumpe");
  });

  it("select bleibt funktionsfähig ohne ModelRun-Repo (No-op)", () => {
    const reasoner = new Reasoner(new DeterministicProvider());
    const hits = reasoner.select("Ventil", KOS);
    expect(hits[0]?.id).toBe("ko1");
  });
});

// SCRUM-502 Schicht 2: vertraulicher Eingabetext verlässt den Server nie über die Cloud.
// Der Reasoner routet vertrauliche Aufgaben an this.primary (Cloud) VORBEI — nur der lokale LLM
// (falls verdrahtet) und/oder der deterministische Fallback dürfen ran. Getestet wird auf der
// Routing-Ebene (welcher Provider wird tatsächlich aufgerufen), nicht am Prompt-Text.
describe("SCRUM-502 Schicht 2: Vertraulichkeit routet an der Cloud vorbei", () => {
  // Provider, der bei jedem Methodenaufruf seinen Namen protokolliert (echtes Modell → demo:false).
  function recordingProvider(name: string, calls: string[]): ReasonerProvider {
    return {
      name,
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => {
        calls.push(`${name}:structure`);
        return {
          title: "T",
          statement: "S",
          conditions: [],
          measures: [],
          tags: [],
          confidence: 1,
          demo: false,
        };
      },
      answer: async (): Promise<AnswerResult> => {
        calls.push(`${name}:answer`);
        return {
          answered: false,
          answer: null,
          knowledgeClass: "unbekannt",
          trust: 0,
          sources: [],
          steps: [],
          demo: false,
        };
      },
      assistText: async (): Promise<AssistResult> => {
        calls.push(`${name}:assist`);
        return { text: "modelltext", demo: false };
      },
      interview: async (): Promise<InterviewResult> => {
        calls.push(`${name}:interview`);
        return {
          question: "nächste Frage?",
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
        };
      },
      extract: async () => {
        calls.push(`${name}:extract`);
        return { points: [], note: null, demo: false };
      },
      select: () => [],
    };
  }

  it("vertraulich + Cloud+lokal: Cloud NICHT aufgerufen, lokaler LLM übernimmt (structure)", async () => {
    const calls: string[] = [];
    const cloud = recordingProvider("cloud", calls);
    const local = recordingProvider("local", calls);
    const reasoner = new Reasoner(cloud, new DeterministicProvider(), undefined, undefined, local);

    const res = await reasoner.structure("Geheimer Rohtext.", "de", true);

    expect(calls).toEqual(["local:structure"]); // Cloud übersprungen, lokal genutzt
    expect(res.demo).toBe(false); // der lokale LLM hat geantwortet
  });

  it("vertraulich + nur Cloud (kein lokaler LLM): Cloud NICHT aufgerufen, deterministisch (structure)", async () => {
    const calls: string[] = [];
    const cloud = recordingProvider("cloud", calls);
    const reasoner = new Reasoner(cloud, new DeterministicProvider());

    const res = await reasoner.structure("Geheimer Rohtext.", "de", true);

    expect(calls).toEqual([]); // Cloud NIE aufgerufen
    expect(res.demo).toBe(true); // ehrlicher deterministischer Ersatzmodus
  });

  it("nicht vertraulich: Cloud wird wie bisher genutzt (structure)", async () => {
    const calls: string[] = [];
    const cloud = recordingProvider("cloud", calls);
    const reasoner = new Reasoner(cloud, new DeterministicProvider());

    const res = await reasoner.structure("Normaler Rohtext.", "de", false);

    expect(calls).toEqual(["cloud:structure"]);
    expect(res.demo).toBe(false);
  });

  it("vertraulich hält assist/interview/extract von der Cloud fern (nur Cloud verdrahtet)", async () => {
    const calls: string[] = [];
    const cloud = recordingProvider("cloud", calls);
    const reasoner = new Reasoner(cloud, new DeterministicProvider());

    const assist = await reasoner.assistText("Geheimer Text.", "de", undefined, true);
    const interview = await reasoner.interview(["Geheime Antwort."], "de", true);
    const extract = await reasoner.extract("Geheimes Dokument.", "de", undefined, false, true);

    expect(calls).toEqual([]); // KEIN Cloud-Aufruf über alle drei Aktionen
    expect(assist.demo).toBe(true);
    expect(interview.demo).toBe(true);
    expect(extract.demo).toBe(true);
  });

  it("nicht vertraulich: assist/interview/extract nutzen die Cloud (Positiv-Kontrolle)", async () => {
    const calls: string[] = [];
    const cloud = recordingProvider("cloud", calls);
    const reasoner = new Reasoner(cloud, new DeterministicProvider());

    await reasoner.assistText("Text.", "de", undefined, false);
    await reasoner.interview(["Antwort."], "de", false);
    await reasoner.extract("Dokument.", "de", undefined, false, false);

    expect(calls).toEqual(["cloud:assist", "cloud:interview", "cloud:extract"]);
  });

  // SCRUM-502 Round 4 (P1): vertraulich + EXPLIZITE cloud/model-Wahl → der lokale LLM springt ein,
  // statt unnötig auf „deterministisch" zu degradieren (nur die Cloud ist gesperrt, nicht on-prem).
  it("vertraulich + explizite cloud-Wahl + lokal verdrahtet → lokal statt deterministisch", async () => {
    const calls: string[] = [];
    const cloud = recordingProvider("cloud", calls);
    const local = recordingProvider("local", calls);
    const reasoner = new Reasoner(cloud, new DeterministicProvider(), undefined, undefined, local);
    await reasoner.setTaskConfig({ global: "cloud", perTask: {} }); // explizit NICHT auto

    const res = await reasoner.structure("Geheimer Rohtext.", "de", true);

    expect(calls).toEqual(["local:structure"]); // Cloud gesperrt, lokal übernimmt (kein deterministisch)
    expect(res.demo).toBe(false);
  });
});
