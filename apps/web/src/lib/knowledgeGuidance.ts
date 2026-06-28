export type KnowledgeGuidanceSurface = "start" | "library" | "ask";
export type KnowledgeGuidanceTone = "pos" | "warn" | "neutral";
export type KnowledgeGuidanceItemId = "secured" | "review" | "sourceBound";

export interface KnowledgeGuidanceItem {
  id: KnowledgeGuidanceItemId;
  labelKey: string;
  bodyKey: string;
  to: "/bibliothek" | "/validierung" | "/fragen";
  tone: KnowledgeGuidanceTone;
}

export interface KnowledgeGuidance {
  titleKey: string;
  bodyKey: string;
  items: KnowledgeGuidanceItem[];
}

const ITEMS: Record<KnowledgeGuidanceItemId, KnowledgeGuidanceItem> = {
  secured: {
    id: "secured",
    labelKey: "kg.secured.label",
    bodyKey: "kg.secured.body",
    to: "/bibliothek",
    tone: "pos",
  },
  review: {
    id: "review",
    labelKey: "kg.review.label",
    bodyKey: "kg.review.body",
    to: "/validierung",
    tone: "warn",
  },
  sourceBound: {
    id: "sourceBound",
    labelKey: "kg.sourceBound.label",
    bodyKey: "kg.sourceBound.body",
    to: "/fragen",
    tone: "neutral",
  },
};

const SURFACES: Record<
  KnowledgeGuidanceSurface,
  { titleKey: string; bodyKey: string; itemIds: KnowledgeGuidanceItemId[] }
> = {
  start: {
    titleKey: "kg.start.title",
    bodyKey: "kg.start.body",
    itemIds: ["secured", "review", "sourceBound"],
  },
  library: {
    titleKey: "kg.library.title",
    bodyKey: "kg.library.body",
    itemIds: ["secured", "review"],
  },
  ask: {
    titleKey: "kg.ask.title",
    bodyKey: "kg.ask.body",
    itemIds: ["sourceBound", "review"],
  },
};

export function knowledgeGuidance(surface: KnowledgeGuidanceSurface): KnowledgeGuidance {
  const s = SURFACES[surface];
  return {
    titleKey: s.titleKey,
    bodyKey: s.bodyKey,
    items: s.itemIds.map((id) => ITEMS[id]),
  };
}
