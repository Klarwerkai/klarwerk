// AUFTRAG-mega68: Stern-Layout der Nachbarschaft — DOM-frei, deterministisch, Mitte in der Mitte.
// Bewusst NEBEN layoutGraph (graph-layout.test.ts): das Kreis-Layout kennt keine Mitte, das
// Stern-Layout sortiert nicht um (die Server-Rangfolge IST die Zeichenreihenfolge).
import { describe, expect, it } from "vitest";
import { layoutNeighborhood } from "../../apps/web/src/lib/graphLayout";

describe("mega68: layoutNeighborhood", () => {
  it("ist deterministisch (gleiche Eingabe → gleiche Koordinaten)", () => {
    const ids = ["n3", "n1", "n2"];
    expect(layoutNeighborhood(ids)).toEqual(layoutNeighborhood(ids));
  });

  it("sortiert NICHT um: die gegebene (Server-)Reihenfolge beginnt oben und läuft im Uhrzeigersinn", () => {
    const l = layoutNeighborhood(["erst", "zweit", "dritt", "viert"], {
      width: 600,
      height: 400,
    });
    expect(l.spots.map((s) => s.id)).toEqual(["erst", "zweit", "dritt", "viert"]);
    // Platz 1 sitzt oben (12 Uhr): x = Mitte, y minimal.
    const first = l.spots[0];
    expect(first?.x).toBeCloseTo(300, 1);
    expect(first?.y).toBeLessThan(200);
    // Platz 2 liegt rechts von der Mitte (Uhrzeigersinn).
    expect(l.spots[1]?.x ?? 0).toBeGreaterThan(300);
  });

  it("alle Plätze liegen in den Bounds, paarweise verschieden, um die Mitte", () => {
    const l = layoutNeighborhood(["a", "b", "c", "d", "e"], { width: 600, height: 400 });
    expect(l.cx).toBe(300);
    expect(l.cy).toBe(200);
    const coords = new Set<string>();
    for (const s of l.spots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(600);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(400);
      coords.add(`${s.x},${s.y}`);
      // Kein Platz fällt auf die Mitte — dort sitzt das Zentrum.
      expect(Math.abs(s.x - 300) + Math.abs(s.y - 200)).toBeGreaterThan(1);
      // Kantenbeschriftung sitzt zwischen Mitte und Platz.
      expect(s.labelX).toBeCloseTo((300 + s.x) / 2, 1);
    }
    expect(coords.size).toBe(5);
  });

  it("leere Nachbarschaft → keine Plätze, Mitte bleibt definiert", () => {
    const l = layoutNeighborhood([]);
    expect(l.spots).toEqual([]);
    expect(l.cx).toBeGreaterThan(0);
  });

  it("ein einzelner Nachbar sitzt oben auf dem Ring", () => {
    const l = layoutNeighborhood(["solo"], { width: 600, height: 400, padding: 70 });
    expect(l.spots[0]).toMatchObject({ id: "solo", x: 300, y: 70 });
  });
});
