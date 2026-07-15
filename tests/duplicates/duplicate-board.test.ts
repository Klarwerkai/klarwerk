import { describe, expect, it } from "vitest";
import type { OverlapEntry } from "../../apps/web/src/api/types";
import {
  DUPLICATE_BOARD_TEXT,
  canClose,
  overlapDetectorInfo,
  recommendationLabelKey,
  relationLabelKey,
} from "../../apps/web/src/lib/duplicateBoard";

function entry(overrides: Partial<OverlapEntry> = {}): OverlapEntry {
  return {
    id: "d1",
    koA: "ko-a",
    koB: "ko-b",
    relation: "teilweise",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren_pruefen",
    status: "offen",
    pairKey: "dup|ko-a|ko-b",
    origin: "auto",
    createdAt: "2026-07-04T10:00:00.000Z",
    ...overrides,
  };
}

describe("Berater-Konzept Duplikate 04.07. (Stufe D4): overlapDetectorInfo", () => {
  it("deterministischer Fund: Textdeckung, aber keine Modell-Sicherheit", () => {
    const info = overlapDetectorInfo(
      entry({
        detector: { trigger: "validation", method: "deterministic", lexicalScore: 0.91 },
      }),
    );
    expect(info?.methodLabelKey).toBe(DUPLICATE_BOARD_TEXT.methodDeterministic);
    expect(info?.overlapPercent).toBe(91);
    expect(info?.confidencePercent).toBeUndefined();
    expect(info?.rationale).toBeUndefined();
  });

  it("Modell-Fund: Textdeckung + Sicherheit (%) + Begründung + Modell-Label", () => {
    const info = overlapDetectorInfo(
      entry({
        detector: {
          trigger: "validation",
          method: "model",
          lexicalScore: 0.62,
          confidence: 0.88,
          rationale: "Gleiche Wartungsaussage, anders formuliert.",
          modelLabel: "anthropic:test",
        },
      }),
    );
    expect(info?.methodLabelKey).toBe(DUPLICATE_BOARD_TEXT.methodModel);
    expect(info?.overlapPercent).toBe(62);
    expect(info?.confidencePercent).toBe(88);
    expect(info?.rationale).toBe("Gleiche Wartungsaussage, anders formuliert.");
    expect(info?.modelLabel).toBe("anthropic:test");
  });

  it("ohne detector (Hand-/Altdaten) → null: kein Fake-Prozent", () => {
    expect(overlapDetectorInfo(entry())).toBeNull();
  });

  // SCRUM-486 E: „KI-Fund" NUR bei tatsächlich vorhandener Konfidenz — sonst konsistent Textabgleich.
  it("Modell-Methode OHNE Konfidenz → kein KI-Fund: Textabgleich-Label, keine Sicherheit", () => {
    const info = overlapDetectorInfo(
      entry({
        detector: { trigger: "validation", method: "model", lexicalScore: 0.8 },
      }),
    );
    expect(info?.isModelFinding).toBe(false);
    expect(info?.methodLabelKey).toBe(DUPLICATE_BOARD_TEXT.methodDeterministic);
    expect(info?.confidencePercent).toBeUndefined();
  });

  it("Modell-Methode MIT Konfidenz → KI-Fund: Modell-Label + Sicherheit", () => {
    const info = overlapDetectorInfo(
      entry({
        detector: { trigger: "validation", method: "model", lexicalScore: 0.6, confidence: 0.9 },
      }),
    );
    expect(info?.isModelFinding).toBe(true);
    expect(info?.methodLabelKey).toBe(DUPLICATE_BOARD_TEXT.methodModel);
    expect(info?.confidencePercent).toBe(90);
  });

  it("deterministischer Fund ist nie ein KI-Fund", () => {
    const info = overlapDetectorInfo(
      entry({ detector: { trigger: "validation", method: "deterministic", lexicalScore: 0.5 } }),
    );
    expect(info?.isModelFinding).toBe(false);
  });

  it("Beziehung und Empfehlung werden auf i18n-Schlüssel abgebildet", () => {
    expect(relationLabelKey("identisch")).toBe("dup.relation.identisch");
    expect(relationLabelKey("verwandt")).toBe("dup.relation.verwandt");
    expect(recommendationLabelKey("zusammenfuehren")).toBe("dup.rec.zusammenfuehren");
    expect(recommendationLabelKey("getrennt_lassen")).toBe("dup.rec.getrennt_lassen");
  });

  it("canClose: nur solange der Eintrag nicht geschlossen ist", () => {
    expect(canClose(entry({ status: "offen" }))).toBe(true);
    expect(canClose(entry({ status: "geschlossen" }))).toBe(false);
  });
});
