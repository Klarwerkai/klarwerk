import { describe, expect, it, vi } from "vitest";
import type { OverlapVerdict } from "../../conflicts";
import {
  type DuplicateSelfTestReasoner,
  evaluateDuplicateSelfTest,
  runDuplicateSelfTest,
} from "./duplicate-self-test";

// Zitate müssen wörtlich in den Kerntexten der festen reifen-Subjekte stehen (G-2), sonst verwirft
// decideFromOverlapVerdict das Urteil und es entsteht kein Eintrag. „reifen ausgeliefert" steht
// (normalisiert) in BEIDEN Aussagen. Beziehung „identisch" + confidence ≥ 0,5 → Auto-Eintrag.
const detectedVerdict: OverlapVerdict = {
  beziehung: "identisch",
  aspects: [
    {
      beschreibung: "Beide sagen: jedes Auto wird mit vier Reifen ausgeliefert.",
      zitatA: "reifen ausgeliefert",
      zitatB: "reifen ausgeliefert",
    },
  ],
  nurInA: "",
  nurInB: "",
  empfehlung: "zusammenfuehren",
  confidence: 0.92,
  begruendung: "Semantisch identische Aussage über die Reifenzahl.",
};
// Gültiges Nicht-Treffer-Urteil: das Modell antwortet, sieht aber kein Duplikat.
const differentVerdict: OverlapVerdict = {
  ...detectedVerdict,
  beziehung: "verschieden",
  aspects: [],
};

function fakeReasoner(opts: {
  active: boolean;
  verdict?: OverlapVerdict | null;
  onJudge?: () => void;
}): DuplicateSelfTestReasoner {
  return {
    status: () => ({
      active: opts.active,
      provider: opts.active ? "anthropic:test" : "deterministisch",
      mode: opts.active ? "model" : "deterministic",
    }),
    judgeDuplicate: async () => {
      opts.onJudge?.();
      return opts.verdict ?? null;
    },
  };
}

// SCRUM-494: der Selbsttest läuft die ECHTE Erkennungskette (detectForSubject → judgeDuplicate →
// decideFromOverlapVerdict → createAuto) gegen einen Wegwerf-Repo. Hier mit gemocktem Provider.
describe("SCRUM-494: runDuplicateSelfTest", () => {
  it("OK: Modell erkennt das semantische Duplikat (reifen-Fall)", async () => {
    const res = await runDuplicateSelfTest(
      fakeReasoner({ active: true, verdict: detectedVerdict }),
    );
    expect(res.ok).toBe(true);
    expect(res.code).toBe("ok");
    expect(res.duplicateCreated).toBe(true);
    expect(res.relation).toBe("identisch");
    expect(res.mode).toBe("model");
  });

  it("FAIL: Modell aktiv, urteilt aber 'verschieden' → kein Duplikat", async () => {
    const res = await runDuplicateSelfTest(
      fakeReasoner({ active: true, verdict: differentVerdict }),
    );
    expect(res.ok).toBe(false);
    expect(res.code).toBe("no_duplicate");
    expect(res.duplicateCreated).toBe(false);
    expect(res.relation).toBeNull();
  });

  it("FAIL: Modell aktiv, liefert aber gar kein Urteil (null) → kein Duplikat", async () => {
    const res = await runDuplicateSelfTest(fakeReasoner({ active: true, verdict: null }));
    expect(res.ok).toBe(false);
    expect(res.code).toBe("no_duplicate");
  });

  it("FAIL: kein Modell → Ersatzmodus, judgeDuplicate wird nie aufgerufen", async () => {
    const onJudge = vi.fn();
    const res = await runDuplicateSelfTest(fakeReasoner({ active: false, onJudge }));
    expect(res.ok).toBe(false);
    expect(res.code).toBe("no_model");
    expect(res.mode).toBe("deterministic");
    expect(onJudge).not.toHaveBeenCalled();
  });

  it("FAIL: ein Modellfehler (Wurf) degradiert sauber zu 'kein Duplikat'", async () => {
    const reasoner: DuplicateSelfTestReasoner = {
      status: () => ({ active: true, provider: "anthropic:test", mode: "model" }),
      judgeDuplicate: async () => {
        throw new Error("429 Rate-Limit");
      },
    };
    const res = await runDuplicateSelfTest(reasoner);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("no_duplicate");
  });
});

describe("SCRUM-494: evaluateDuplicateSelfTest (pure)", () => {
  const active = { active: true, provider: "anthropic:test", mode: "model" as const };
  const off = { active: false, provider: "deterministisch", mode: "deterministic" as const };

  it("kein Modell → no_model", () => {
    expect(evaluateDuplicateSelfTest(off, null).code).toBe("no_model");
  });
  it("Modell aktiv, kein Eintrag → no_duplicate", () => {
    expect(evaluateDuplicateSelfTest(active, null).code).toBe("no_duplicate");
  });
  it("Eintrag vorhanden → ok + Beziehung durchgereicht", () => {
    const entry = { relation: "identisch" } as Parameters<typeof evaluateDuplicateSelfTest>[1];
    const res = evaluateDuplicateSelfTest(active, entry);
    expect(res.ok).toBe(true);
    expect(res.code).toBe("ok");
    expect(res.relation).toBe("identisch");
  });
});
