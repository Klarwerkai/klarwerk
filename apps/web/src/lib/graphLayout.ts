// Reines, DOM-freies, deterministisches Graph-Layout (SCRUM-119 / FR-ANA-03).
// Kreis-Layout (keine Force-Simulation, keine schwere Lib). Gleiche Eingabe →
// gleiche Koordinaten (testbar ohne DOM). Knoten/Kanten kommen aus echten Daten.
import type { Graph, GraphEdge, GraphNode } from "../api/types";

export interface LaidOutNode {
  id: string;
  title: string;
  x: number;
  y: number;
}

export interface LaidOutEdge {
  a: string;
  b: string;
  via: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ConflictPair {
  a: string;
  b: string;
}

export interface LaidOutConflict {
  a: string;
  b: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  radius: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  positions: Record<string, { x: number; y: number }>;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
}

const DEFAULTS = { width: 640, height: 440, padding: 70 };

// Deterministische Knotenreihenfolge: stabil nach id sortiert.
function sortedNodes(nodes: readonly GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

export function layoutGraph(graph: Graph, opts: LayoutOptions = {}): GraphLayout {
  const width = opts.width ?? DEFAULTS.width;
  const height = opts.height ?? DEFAULTS.height;
  const padding = opts.padding ?? DEFAULTS.padding;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(0, Math.min(width, height) / 2 - padding);

  const ordered = sortedNodes(graph.nodes);
  const n = ordered.length;
  const positions: Record<string, { x: number; y: number }> = {};
  const nodes: LaidOutNode[] = ordered.map((node, i) => {
    // Ein einzelner Knoten sitzt mittig; sonst gleichmäßig auf dem Kreis (Start oben).
    const angle = n <= 1 ? 0 : -Math.PI / 2 + (i / n) * 2 * Math.PI;
    const x = n <= 1 ? cx : Math.round((cx + radius * Math.cos(angle)) * 100) / 100;
    const y = n <= 1 ? cy : Math.round((cy + radius * Math.sin(angle)) * 100) / 100;
    positions[node.id] = { x, y };
    return { id: node.id, title: node.title, x, y };
  });

  const edges: LaidOutEdge[] = [];
  for (const e of graph.edges) {
    const pa = positions[e.a];
    const pb = positions[e.b];
    if (pa && pb) {
      edges.push({ a: e.a, b: e.b, via: e.via, x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
    }
  }

  return { width, height, radius, nodes, edges, positions };
}

// Konfliktkanten auf das Layout abbilden — nur Paare, deren beide Knoten existieren.
export function layoutConflicts(
  pairs: readonly ConflictPair[],
  positions: Record<string, { x: number; y: number }>,
): LaidOutConflict[] {
  const out: LaidOutConflict[] = [];
  for (const p of pairs) {
    const pa = positions[p.a];
    const pb = positions[p.b];
    if (pa && pb) {
      out.push({ a: p.a, b: p.b, x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
    }
  }
  return out;
}

// Grad je Knoten (Tag-Kanten), für die ehrliche Anzeige-Begrenzung großer Graphen.
function degrees(graph: Graph): Map<string, number> {
  const deg = new Map<string, number>();
  for (const e of graph.edges) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }
  return deg;
}

// Ehrliche Begrenzung: bei zu vielen Knoten nur die am stärksten verbundenen zeigen
// (keine Fake-Daten — nur Anzeige-Ausschnitt). Kanten zwischen behaltenen Knoten bleiben.
export function limitGraph(graph: Graph, max: number): { graph: Graph; truncated: boolean } {
  if (graph.nodes.length <= max) {
    return { graph, truncated: false };
  }
  const deg = degrees(graph);
  const kept = [...graph.nodes]
    .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || a.id.localeCompare(b.id))
    .slice(0, max);
  const keptIds = new Set(kept.map((nd) => nd.id));
  const edges: GraphEdge[] = graph.edges.filter((e) => keptIds.has(e.a) && keptIds.has(e.b));
  return { graph: { nodes: kept, edges }, truncated: true };
}
