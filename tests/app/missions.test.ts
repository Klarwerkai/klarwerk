import { describe, expect, it } from "vitest";
import { missionsForRole } from "../../apps/web/src/lib/missions";

describe("FE-FND-09: missionsForRole", () => {
  it("viewer sieht nur die für viewer sichtbaren Flows (fragen, bibliothek)", () => {
    const ids = missionsForRole("viewer", false).map((m) => m.id);
    expect(ids).toEqual(["fragen", "bibliothek"]);
  });

  it("experte sieht zusätzlich Erfassen", () => {
    const ids = missionsForRole("experte", false).map((m) => m.id);
    expect(ids).toEqual(["erfassen", "fragen", "bibliothek"]);
  });

  it("controller/admin sehen aufgaben-orientierte Auswahl, max. 4", () => {
    const ids = missionsForRole("controller", false).map((m) => m.id);
    expect(ids).toEqual(["erfassen", "validierung", "risiko", "fragen"]);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(missionsForRole("admin", false).map((m) => m.id)).toEqual(ids);
  });

  it("jede Mission verweist auf einen echten Flow-Pfad + Beschreibungs-Key", () => {
    for (const m of missionsForRole("admin", false)) {
      expect(m.path.startsWith("/")).toBe(true);
      expect(m.descKey).toBe(`missions.${m.id}.desc`);
      expect(m.labelKey).toBeTruthy();
    }
  });

  it("liefert für jede Rolle zwischen 2 und 4 Missionen", () => {
    for (const role of ["viewer", "experte", "controller", "admin"] as const) {
      const n = missionsForRole(role, false).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});
