// AUFTRAG-mega6 Block D: bens Auflage lautet „abgeleitet aus EINER gemeinsamen Quelle, damit Server
// und Oberfläche nicht auseinanderlaufen können". Dieser Test pinnt genau diese Struktur: die
// Konstante, die die Oberfläche benutzt, IST dieselbe, aus der die Servernormalisierung ihre Caps
// zieht — keine zweite Zahlenkopie, die driften könnte.
import { describe, expect, it } from "vitest";
import { DRAFT_LIMITS as UI_LIMITS } from "../../apps/web/src/lib/draftLimits";
import { DRAFT_LIMITS as SERVER_LIMITS } from "../../services/capture/src/draft-limits";

describe("Block D: Oberfläche und Persistenzgrenze teilen sich EINE Quelle", () => {
  it("die Oberfläche reicht die Serverkonstante durch — identische Referenz", () => {
    expect(UI_LIMITS).toBe(SERVER_LIMITS);
  });

  it("die Werte entsprechen den von ben aufgezählten Caps", () => {
    expect(SERVER_LIMITS).toEqual({
      reviewers: 20,
      reviewerId: 128,
      sources: 25,
      sourceLabel: 300,
      sourceUrl: 2048,
      sourceExcerpt: 500,
      sourceProvider: 100,
      extQuery: 300,
      interviewAnswers: 50,
      interviewText: 4000,
      interviewQuestion: 2000,
    });
  });
});
