// ================================================================================================
// AUFTRAG-mega34 BLOCK G (bens GELB 4) — DER HINWEIS ERWARTET EIN BAND, DAS ES NICHT MEHR GIBT.
// ================================================================================================
//
// mega33 hat `knowledgeHealth.band` bei UNBELEGTER Konflikterkennung bewusst auf `null` gesetzt:
// ohne belegte Erkennung gibt es keinen ehrlichen Gesundheitsgrad, nur eine Spanne.
//
// Die Hinweislogik eine Ebene darüber hat diesen Schritt nicht mitgemacht. Sie erzeugt einen
// Health-Hinweis nur für die Bänder `kritisch` oder `mittel` — und zog aus einem vorhandenen
// `knowledgeHealth`-Objekt zugleich den Schluss, dass das Signal BEKANNT sei. Damit konnte der
// sichtbare Worst-Case-Score kritisch sein, ohne dass irgendein Hinweis entstand, und die
// Zusammenfassung daraus sogar „alles in Ordnung" ableiten.
//
// Das ist derselbe Fehler wie in Block A, nur an dritter Stelle: aus fehlendem Wissen wird eine
// Entwarnung. Der Hinweis kommt jetzt aus `conflictFactor.proven === false` selbst.
import { describe, expect, it } from "vitest";
import type { KnowledgeHealth } from "../../apps/web/src/lib/knowledgeHealth";
import { buildKnowledgeOsHints } from "../../apps/web/src/lib/knowledgeOsHints";

// Der Zustand aus mega33: Erkennung NICHT belegt ⇒ kein Band, und die beiden Ränder der Spanne
// fallen auseinander (sichtbarer Score = Worst Case, optimistischer Rand = bekannter Abzug).
function unbelegt(score: number, scoreOptimistic: number): KnowledgeHealth {
  return {
    score,
    band: null,
    scoreOptimistic,
    conflictFactor: {
      proven: false,
      reason: "detection-incomplete",
      knownPenalty: 0,
      maxPenalty: 20,
      appliedPenalty: 20,
    },
    validatedRatio: 80,
    staleRatio: 0,
    singleSourceShare: 0,
    openKos: 0,
    openGaps: 0,
    openConflicts: 0,
    avgTrust: 70,
    factors: [],
  } as unknown as KnowledgeHealth;
}

describe("mega34 G · unbelegte Konflikterkennung erzeugt ihren eigenen Hinweis", () => {
  it("kein Band, aber kritischer sichtbarer Score ⇒ ein Hinweis entsteht", () => {
    const res = buildKnowledgeOsHints({ knowledgeHealth: unbelegt(20, 40) });
    const health = res.hints.filter((h) => h.source === "health");
    expect(
      health.length,
      "kein einziger Health-Hinweis trotz kritischem Worst Case",
    ).toBeGreaterThan(0);
    expect(health.some((h) => h.id === "health-detection-unproven")).toBe(true);
  });

  it("in diesem Zustand NIEMALS „alles in Ordnung“", () => {
    // Auch wenn sonst gar nichts anliegt: solange die Erkennung unbelegt ist, ist eine Entwarnung
    // eine Behauptung ohne Beleg — genau die Klasse, die mega31 abgeschafft hat.
    const res = buildKnowledgeOsHints({ knowledgeHealth: unbelegt(90, 92) });
    expect(res.hints.some((h) => h.id === "all-clear")).toBe(false);
    expect(res.summary.ok).toBe(0);
  });

  it("der fehlende Null-Band-Fall: das Signal gilt trotzdem als bekannt, nicht als unbekannt", () => {
    const res = buildKnowledgeOsHints({ knowledgeHealth: unbelegt(20, 40) });
    // Das Objekt ist da — es ist nicht „nicht geladen". Es sagt nur ehrlich: kein Grad ableitbar.
    expect(res.unknownSources).not.toContain("health");
  });

  it("Gegenprobe: bei BELEGTER Erkennung entsteht dieser Hinweis nicht", () => {
    const belegt = {
      ...unbelegt(85, 85),
      band: "gut" as const,
      conflictFactor: {
        proven: true,
        reason: null,
        knownPenalty: 0,
        maxPenalty: 20,
        appliedPenalty: 0,
      },
    } as unknown as KnowledgeHealth;
    const res = buildKnowledgeOsHints({ knowledgeHealth: belegt });
    expect(res.hints.some((h) => h.id === "health-detection-unproven")).toBe(false);
  });
});
