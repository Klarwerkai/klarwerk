import { describe, expect, it } from "vitest";
import type { LearningPath } from "../../apps/web/src/api/types";
import {
  completedCount,
  isStepDone,
  nextOpenStep,
  progressPercent,
} from "../../apps/web/src/lib/learningPath";

const path: LearningPath = {
  id: "p1",
  role: "experte",
  steps: [
    { id: "s1", title: "Sicherheitsunterweisung" },
    { id: "s2", title: "Anlage 1 Rundgang" },
    { id: "s3", title: "Erstes KO erfassen" },
  ],
};

describe("SCRUM-145: Lernpfad-Fortschritt", () => {
  it("isStepDone prüft Mitgliedschaft", () => {
    expect(isStepDone(["s1"], "s1")).toBe(true);
    expect(isStepDone(["s1"], "s2")).toBe(false);
  });

  it("progressPercent rundet korrekt, leer = 0", () => {
    expect(progressPercent(path, [])).toBe(0);
    expect(progressPercent(path, ["s1", "s2"])).toBe(67);
    expect(progressPercent(path, ["s1", "s2", "s3"])).toBe(100);
    expect(progressPercent({ ...path, steps: [] }, [])).toBe(0);
  });

  it("completedCount zählt nur gültige Schritte", () => {
    expect(completedCount(path, ["s1", "x9"])).toBe(1);
  });

  it("nextOpenStep liefert den ersten offenen Schritt bzw. null", () => {
    expect(nextOpenStep(path, ["s1"])?.id).toBe("s2");
    expect(nextOpenStep(path, ["s1", "s2", "s3"])).toBeNull();
  });
});
