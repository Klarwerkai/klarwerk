import { describe, expect, it } from "vitest";
import type { Graph } from "../../apps/web/src/api/types";
import { layoutConflicts, layoutGraph, limitGraph } from "../../apps/web/src/lib/graphLayout";

const graph = (nodes: string[], edges: [string, string, string][] = []): Graph => ({
  nodes: nodes.map((id) => ({ id, title: `T-${id}` })),
  edges: edges.map(([a, b, via]) => ({ a, b, via })),
});

describe("SCRUM-119: layoutGraph", () => {
  it("ist deterministisch (gleiche Eingabe → gleiche Koordinaten)", () => {
    const g = graph(["c", "a", "b"]);
    const l1 = layoutGraph(g);
    const l2 = layoutGraph(g);
    expect(l1.nodes).toEqual(l2.nodes);
  });

  it("sortiert Knoten stabil nach id, unabhängig von Eingabereihenfolge", () => {
    expect(layoutGraph(graph(["c", "a", "b"])).nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("platziert alle Knoten innerhalb der Bounds und paarweise verschieden", () => {
    const l = layoutGraph(graph(["a", "b", "c", "d"]), { width: 600, height: 400 });
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(600);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(400);
    }
    const coords = new Set(l.nodes.map((n) => `${n.x},${n.y}`));
    expect(coords.size).toBe(4);
  });

  it("ein einzelner Knoten sitzt mittig", () => {
    const l = layoutGraph(graph(["only"]), { width: 600, height: 400 });
    expect(l.nodes[0]).toMatchObject({ x: 300, y: 200 });
  });

  it("leerer Graph → keine Knoten/Kanten", () => {
    const l = layoutGraph(graph([]));
    expect(l.nodes).toHaveLength(0);
    expect(l.edges).toHaveLength(0);
  });

  it("Kanten erhalten die Endpunkt-Koordinaten der Knoten", () => {
    const l = layoutGraph(graph(["a", "b"], [["a", "b", "ventil"]]));
    const pa = l.positions.a;
    const pb = l.positions.b;
    expect(l.edges[0]).toMatchObject({
      a: "a",
      b: "b",
      via: "ventil",
      x1: pa?.x,
      y1: pa?.y,
      x2: pb?.x,
      y2: pb?.y,
    });
  });

  it("Kanten mit unbekanntem Endpunkt werden verworfen (keine Fake-Kanten)", () => {
    const l = layoutGraph(graph(["a"], [["a", "ghost", "x"]]));
    expect(l.edges).toHaveLength(0);
  });
});

describe("SCRUM-119: layoutConflicts", () => {
  it("bildet nur Paare ab, deren beide Knoten existieren", () => {
    const l = layoutGraph(graph(["a", "b"]));
    const conflicts = layoutConflicts(
      [
        { a: "a", b: "b" },
        { a: "a", b: "missing" },
      ],
      l.positions,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ a: "a", b: "b" });
  });
});

describe("SCRUM-119: limitGraph", () => {
  it("unter dem Limit → unverändert", () => {
    const { graph: g, truncated } = limitGraph(graph(["a", "b"]), 5);
    expect(truncated).toBe(false);
    expect(g.nodes).toHaveLength(2);
  });

  it("über dem Limit → behält die am stärksten verbundenen Knoten", () => {
    const g = graph(
      ["a", "b", "c", "d"],
      [
        ["a", "b", "x"],
        ["a", "c", "y"],
        ["a", "d", "z"],
      ], // a hat Grad 3
    );
    const { graph: limited, truncated } = limitGraph(g, 2);
    expect(truncated).toBe(true);
    expect(limited.nodes.map((n) => n.id)).toContain("a");
    expect(limited.nodes).toHaveLength(2);
    // nur Kanten zwischen behaltenen Knoten bleiben
    for (const e of limited.edges) {
      const ids = limited.nodes.map((n) => n.id);
      expect(ids).toContain(e.a);
      expect(ids).toContain(e.b);
    }
  });
});
