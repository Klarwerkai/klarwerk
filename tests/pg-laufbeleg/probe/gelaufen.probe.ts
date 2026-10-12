// R-1327 · Probe: eine Datei, deren einziger Fall wirklich läuft. Gegenpol zu
// `nur-uebersprungen.probe.ts` — an ihr darf der Melder nichts als übersprungen melden.
import { describe, expect, it } from "vitest";

describe("Probe-gelaufen", () => {
  it("läuft wirklich", () => {
    expect(1 + 1).toBe(2);
  });
});
