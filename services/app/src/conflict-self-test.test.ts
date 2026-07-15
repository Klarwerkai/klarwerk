import { describe, expect, it, vi } from "vitest";
import type { ConflictVerdict } from "../../conflicts";
import {
  type ConflictSelfTestReasoner,
  evaluateConflictSelfTest,
  runConflictSelfTest,
} from "./conflict-self-test";

// Zitate müssen wörtlich in den Kerntexten der festen Selbsttest-Subjekte stehen (G-2), sonst
// verwirft decideFromVerdict das Urteil als Halluzination und es entsteht kein Konflikt.
const verdictWithoutKollision: ConflictVerdict = {
  relation: "widerspruch",
  older: null,
  confidence: 0.95,
  begruendung: "Blau und Rot als Pflichtfarbe sind unvereinbar.",
  zitat_a: "Alle Warnschilder in Halle 7 müssen blau lackiert sein.",
  zitat_b: "Warnschilder in Halle 7 werden ausschließlich rot lackiert.",
};
const verdictWithKollision: ConflictVerdict = {
  ...verdictWithoutKollision,
  kollision: {
    streitpunkt: "Warnschildfarbe",
    seiteA: { kernaussage: "Warnschilder blau", streitwert: "blau", streitwertWoertlich: true },
    seiteB: { kernaussage: "Warnschilder rot", streitwert: "rot", streitwertWoertlich: true },
  },
};

function fakeReasoner(opts: {
  active: boolean;
  verdict?: ConflictVerdict | null;
  onJudge?: () => void;
}): ConflictSelfTestReasoner {
  return {
    status: () => ({
      active: opts.active,
      provider: opts.active ? "anthropic:test" : "deterministisch",
      mode: opts.active ? "model" : "deterministic",
    }),
    judgeConflict: async () => {
      opts.onJudge?.();
      return opts.verdict ?? null;
    },
  };
}

// SCRUM-493: der Selbsttest läuft die ECHTE Erkennungskette (detectForSubject → judgeConflict →
// decideFromVerdict → createAuto → kollision) gegen einen Wegwerf-Repo. Hier mit gemocktem Provider.
describe("SCRUM-493: runConflictSelfTest", () => {
  it("OK: Modell liefert Konflikt + kollision + wörtlich belegte Streitwerte", async () => {
    const res = await runConflictSelfTest(
      fakeReasoner({ active: true, verdict: verdictWithKollision }),
    );
    expect(res.ok).toBe(true);
    expect(res.code).toBe("ok");
    expect(res.conflictCreated).toBe(true);
    expect(res.hasKollision).toBe(true);
    expect(res.streitwertAWoertlich).toBe(true);
    expect(res.streitwertBWoertlich).toBe(true);
    expect(res.streitpunkt).toBe("Warnschildfarbe");
    expect(res.mode).toBe("model");
  });

  it("FAIL: Modell liefert Konflikt, aber ohne kollision", async () => {
    const res = await runConflictSelfTest(
      fakeReasoner({ active: true, verdict: verdictWithoutKollision }),
    );
    expect(res.ok).toBe(false);
    expect(res.code).toBe("conflict_without_kollision");
    expect(res.conflictCreated).toBe(true);
    expect(res.hasKollision).toBe(false);
  });

  it("FAIL: Modell aktiv, urteilt aber kein Widerspruch → kein Konflikt", async () => {
    const res = await runConflictSelfTest(
      fakeReasoner({
        active: true,
        verdict: { ...verdictWithKollision, relation: "kein_konflikt" },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.code).toBe("no_conflict");
    expect(res.conflictCreated).toBe(false);
  });

  it("FAIL: kein Modell → deterministischer Ersatzmodus, judgeConflict wird nie aufgerufen", async () => {
    const onJudge = vi.fn();
    const res = await runConflictSelfTest(fakeReasoner({ active: false, onJudge }));
    expect(res.ok).toBe(false);
    expect(res.code).toBe("no_model");
    expect(res.mode).toBe("deterministic");
    expect(onJudge).not.toHaveBeenCalled();
  });

  it("FAIL: ein Modellfehler (Wurf) degradiert sauber zu 'kein Konflikt'", async () => {
    const reasoner: ConflictSelfTestReasoner = {
      status: () => ({ active: true, provider: "anthropic:test", mode: "model" }),
      judgeConflict: async () => {
        throw new Error("429 Rate-Limit");
      },
    };
    const res = await runConflictSelfTest(reasoner);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("no_conflict");
  });
});

describe("SCRUM-493: evaluateConflictSelfTest (pure)", () => {
  const active = { active: true, provider: "anthropic:test", mode: "model" as const };
  const off = { active: false, provider: "deterministisch", mode: "deterministic" as const };

  it("kein Modell → no_model", () => {
    expect(evaluateConflictSelfTest(off, null).code).toBe("no_model");
  });
  it("Modell aktiv, kein Konflikt → no_conflict", () => {
    expect(evaluateConflictSelfTest(active, null).code).toBe("no_conflict");
  });
  it("Konflikt ohne detector.kollision → conflict_without_kollision", () => {
    const conflict = {
      detector: { trigger: "validation", method: "model" },
    } as Parameters<typeof evaluateConflictSelfTest>[1];
    expect(evaluateConflictSelfTest(active, conflict).code).toBe("conflict_without_kollision");
  });
  it("Konflikt mit kollision → ok + Streitwert-Flags durchgereicht", () => {
    const conflict = {
      detector: {
        trigger: "validation",
        method: "model",
        kollision: {
          streitpunkt: "Warnschildfarbe",
          seiteA: { kernaussage: "a", streitwert: "blau", streitwertWoertlich: true },
          seiteB: { kernaussage: "b", streitwert: "rot", streitwertWoertlich: false },
        },
      },
    } as Parameters<typeof evaluateConflictSelfTest>[1];
    const res = evaluateConflictSelfTest(active, conflict);
    expect(res.ok).toBe(true);
    expect(res.streitwertAWoertlich).toBe(true);
    expect(res.streitwertBWoertlich).toBe(false);
  });
});
