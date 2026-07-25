// AUFTRAG-mega2 Block B (bens D4): der reine Parser mirrort den Serververtrag (ganze Zahl 1–5). Deckt
// zusätzlich „1x" ab, das ein <input type=number> gar nicht erzeugen kann, aber ein direkter
// Mutation-Aufruf durchreichen könnte — Number(...) lehnt es ab (parseInt hätte 1 geliefert).
import { describe, expect, it } from "vitest";
import {
  isNeededValidationsValid,
  parseNeededValidations,
} from "../../apps/web/src/lib/reviewerMinimum";

describe("Block B: reviewerMinimum — ganze Zahl 1–5, keine parseInt-Koerzierung", () => {
  it("lehnt 0, 1.5, 1x, leer und 6 ab", () => {
    for (const bad of ["0", "1.5", "1x", "", "   ", "6", "-1", "3.0001", "NaN"]) {
      expect(isNeededValidationsValid(bad)).toBe(false);
    }
    // „1x" wird NICHT zu 1 gebogen (parseInt-Falle).
    expect(Number.isInteger(parseNeededValidations("1x"))).toBe(false);
    expect(parseNeededValidations("1.5")).toBe(1.5);
  });

  it("erlaubt 1 bis 5 (auch ganzzahlig geschrieben)", () => {
    for (const good of ["1", "2", "3", "4", "5", "3.0", " 4 "]) {
      expect(isNeededValidationsValid(good)).toBe(true);
    }
  });
});
