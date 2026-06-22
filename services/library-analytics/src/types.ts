import type { KnowledgeType } from "../../knowledge-object";

export interface ImportItem {
  title: string;
  statement: string;
  type: KnowledgeType;
  category: string;
  author?: string;
  tags?: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

// FR-LIB-03: Bus-Faktor — Domänen/Kategorien mit Einzelquelle.
export interface BusFactorEntry {
  category: string;
  authorCount: number;
  koCount: number;
  singleSource: boolean;
}

// FR-LIB-04: Wissensgraph.
export interface GraphNode {
  id: string;
  title: string;
}

export interface GraphEdge {
  a: string;
  b: string;
  via: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// FR-ANA-01: Kennzahlen.
export interface Analytics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}
