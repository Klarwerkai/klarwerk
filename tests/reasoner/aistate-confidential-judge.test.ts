// D-AISTATE PAKET 1 (bens V1, 23.07.) — vertraulichkeitsbewusste Judge-Kette im ECHTEN Reasoner.
// Belegt bens Kern-Auflage 3.3: die Judge-Methoden laufen NICHT mehr gate-los über [primary, secondary],
// sondern über judgeProviders(confidential) — vertraulich ⇒ die Cloud (primary) ist RAUS (Egress 0),
// der lokale LLM (secondary) darf weiter urteilen. Ohne zulässiges Modell endet der Ausgang ehrlich
// als "confidential" (Cloud-only vertraulich) bzw. "no-model" (gar kein Modell) — NIE als stilles Urteil.
import { describe, expect, it } from "vitest";
import { Reasoner } from "../../services/reasoner";

// Spy-Provider (Cloud ODER lokal) mit getrennten Zählern auf beiden Judge-Flächen. `isAvailable`=true
// und ein eigener Name (≠ deterministischer Fallback) → der Reasoner zählt ihn als verdrahtetes Modell.
type Provider = ConstructorParameters<typeof Reasoner>[0];
function spyProvider(name: string): {
  provider: Provider;
  conflictCalls: () => number;
  duplicateCalls: () => number;
} {
  let conflict = 0;
  let duplicate = 0;
  const provider = {
    name,
    isAvailable: () => true,
    select: (_q: unknown, cands: unknown[]) => [...cands],
    judgeConflict: async () => {
      conflict += 1;
      return {
        relation: "kein_konflikt",
        older: null,
        confidence: 0.9,
        begruendung: "ok",
        zitat_a: "a",
        zitat_b: "b",
      };
    },
    judgeDuplicate: async () => {
      duplicate += 1;
      return {
        beziehung: "verschieden",
        aspects: [],
        nurInA: "",
        nurInB: "",
        empfehlung: "getrennt_lassen",
        confidence: 0.9,
        begruendung: "ok",
      };
    },
  } as unknown as Provider;
  return { provider, conflictCalls: () => conflict, duplicateCalls: () => duplicate };
}

describe("D-AISTATE V1: judge-Kette vertraulichkeitsbewusst (Cloud-Egress 0 bei vertraulich)", () => {
  it("vertraulich + nur Cloud ⇒ Cloud-Judge EXAKT 0, Ausgang ehrlich 'confidential' (kein Urteil)", async () => {
    const cloud = spyProvider("cloud");
    const reasoner = new Reasoner(cloud.provider); // nur Cloud, kein lokales Modell
    const conflict = await reasoner.judgeConflictOutcome("A", "B", "de", true);
    const duplicate = await reasoner.judgeDuplicateOutcome("A", "B", "de", true);
    // Cloud hat den vertraulichen Text NIE gesehen …
    expect(cloud.conflictCalls()).toBe(0);
    expect(cloud.duplicateCalls()).toBe(0);
    // … und der Ausgang ist ehrlich unterscheidbar (nicht "no-model" — ein Cloud-Modell IST da).
    expect(conflict).toEqual({ verdict: null, failure: "confidential" });
    expect(duplicate).toEqual({ verdict: null, failure: "confidential" });
  });

  it("NICHT vertraulich + Cloud ⇒ die Cloud urteilt normal (Gegenprobe: kein Fehl-Ausschluss)", async () => {
    const cloud = spyProvider("cloud");
    const reasoner = new Reasoner(cloud.provider);
    const conflict = await reasoner.judgeConflictOutcome("A", "B", "de", false);
    expect(cloud.conflictCalls()).toBe(1);
    expect(conflict.verdict).not.toBeNull();
    expect(conflict.failure).toBeUndefined();
  });

  it("vertraulich + lokales Modell ⇒ Cloud 0, der LOKALE Judge läuft und liefert das Urteil", async () => {
    const cloud = spyProvider("cloud");
    const local = spyProvider("local");
    // Konstruktor: (primary/cloud, fallback?, modelRuns?, presets?, secondary/local).
    const reasoner = new Reasoner(cloud.provider, undefined, undefined, undefined, local.provider);
    const conflict = await reasoner.judgeConflictOutcome("A", "B", "de", true);
    const duplicate = await reasoner.judgeDuplicateOutcome("A", "B", "de", true);
    // Cloud bleibt außen vor …
    expect(cloud.conflictCalls()).toBe(0);
    expect(cloud.duplicateCalls()).toBe(0);
    // … der lokale (on-prem, egress-freie) Judge übernimmt und urteilt.
    expect(local.conflictCalls()).toBe(1);
    expect(local.duplicateCalls()).toBe(1);
    expect(conflict.verdict).not.toBeNull();
    expect(duplicate.verdict).not.toBeNull();
  });

  it("kein Modell ⇒ beide Ausgänge ehrlich 'no-model' (kein Provideraufruf möglich)", async () => {
    const reasoner = new Reasoner(); // deterministischer Ersatzmodus, kein echtes Modell
    expect(await reasoner.judgeConflictOutcome("A", "B")).toEqual({
      verdict: null,
      failure: "no-model",
    });
    expect(await reasoner.judgeDuplicateOutcome("A", "B")).toEqual({
      verdict: null,
      failure: "no-model",
    });
  });
});
