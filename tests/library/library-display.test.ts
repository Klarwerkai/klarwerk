import { describe, expect, it } from "vitest";
import { LIBRARY_RESULT_LIMIT, windowList } from "../../apps/web/src/lib/libraryDisplay";

const seq = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe("SCRUM-158: windowList", () => {
  it("unter dem Limit → alles sichtbar, nicht begrenzt", () => {
    const w = windowList(seq(5), 200);
    expect(w.total).toBe(5);
    expect(w.shown).toBe(5);
    expect(w.limited).toBe(false);
    expect(w.visible).toHaveLength(5);
  });

  it("über dem Limit → begrenzt, sichtbar = Limit, total = M", () => {
    const w = windowList(seq(250), 200);
    expect(w.total).toBe(250);
    expect(w.shown).toBe(200);
    expect(w.limited).toBe(true);
    expect(w.visible).toHaveLength(200);
    expect(w.visible[0]).toBe(0);
    expect(w.visible[199]).toBe(199);
  });

  it("genau am Limit → nicht begrenzt", () => {
    const w = windowList(seq(200), 200);
    expect(w.limited).toBe(false);
    expect(w.shown).toBe(200);
  });

  it("Default-Limit greift ohne explizites Argument", () => {
    const w = windowList(seq(LIBRARY_RESULT_LIMIT + 10));
    expect(w.shown).toBe(LIBRARY_RESULT_LIMIT);
    expect(w.limited).toBe(true);
  });
});
