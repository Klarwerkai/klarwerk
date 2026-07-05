import { describe, expect, it } from "vitest";
import type { Conflict } from "../../apps/web/src/api/types";
import {
  CONFLICT_BOARD_TEXT,
  canDismiss,
  conflictOriginInfo,
} from "../../apps/web/src/lib/conflictBoard";

function conflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    id: "c1",
    koA: "ko-a",
    koB: "ko-b",
    type: "truth",
    description: "…",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-07-04T10:00:00.000Z",
    ...overrides,
  };
}

describe("Berater-Konzept 04.07. (Stufe 4b): conflictOriginInfo", () => {
  it("automatisch erkannt: Sicherheit (%), Begründung und beide Zitate", () => {
    const info = conflictOriginInfo(
      conflict({
        origin: "auto",
        detector: {
          trigger: "validation",
          method: "model",
          confidence: 0.82,
          rationale: "Andere verbindliche Farbe.",
          quotes: { a: "Farbe blau", b: "Farbe rot" },
        },
      }),
    );
    expect(info.isAuto).toBe(true);
    expect(info.labelKey).toBe(CONFLICT_BOARD_TEXT.originAuto);
    expect(info.confidencePercent).toBe(82);
    expect(info.rationale).toBe("Andere verbindliche Farbe.");
    expect(info.quoteA).toBe("Farbe blau");
    expect(info.quoteB).toBe("Farbe rot");
  });

  it("manuell angelegt: kein Prozent, keine Zitate", () => {
    const info = conflictOriginInfo(conflict({ origin: "manual" }));
    expect(info.isAuto).toBe(false);
    expect(info.labelKey).toBe(CONFLICT_BOARD_TEXT.originManual);
    expect(info.confidencePercent).toBeUndefined();
    expect(info.quoteA).toBeUndefined();
  });

  it("Alt-Daten ohne origin gelten als manuell", () => {
    expect(conflictOriginInfo(conflict()).isAuto).toBe(false);
  });

  it("canDismiss: nur bei offenem, automatisch erkanntem Konflikt", () => {
    expect(canDismiss(conflict({ origin: "auto", status: "offen" }))).toBe(true);
    expect(canDismiss(conflict({ origin: "auto", status: "geloest" }))).toBe(false);
    expect(canDismiss(conflict({ origin: "manual", status: "offen" }))).toBe(false);
  });
});
