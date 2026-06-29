import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { PROOF_CHAIN, type ProofBeatId, proofChain } from "../../apps/web/src/lib/proofChain";

// SCRUM-301: die sichtbare Pilot-Beweiskette Start → Library → KO-Detail ist EINE Quelle der Wahrheit
// („Wissen finden → Nutzbarkeit erkennen → Quelle/Trust/Version prüfen"). Reine i18n-Datenbeschreibung.
describe("SCRUM-301: proofChain", () => {
  it("liefert genau drei Beats in fester Reihenfolge (find → usability → verify)", () => {
    expect(proofChain().map((b) => b.id)).toEqual<ProofBeatId[]>(["find", "usability", "verify"]);
    expect(proofChain()).toBe(PROOF_CHAIN);
  });

  it("nummeriert 1..3 aufsteigend und nutzt stabile i18n-Keys", () => {
    expect(PROOF_CHAIN.map((b) => b.n)).toEqual([1, 2, 3]);
    expect(PROOF_CHAIN.map((b) => b.labelKey)).toEqual([
      "demo.proof.find",
      "demo.proof.usability",
      "demo.proof.verify",
    ]);
  });

  it("alle Beweis-Texte + Label sind DE und EN vorhanden", () => {
    const keys = ["demo.proof.label", ...PROOF_CHAIN.map((b) => b.labelKey)];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});
