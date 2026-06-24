// Anzeigestatus eines Wissensobjekts (BRIEF §5). Sieben Pills; der fachliche
// Kern-Enum im Backend ist offen|validiert — die übrigen werden im Lesepfad
// abgeleitet (Abstimmpunkt 1, #62).
export type DisplayStatus =
  | "entwurf"
  | "offen"
  | "pruefung"
  | "validiert"
  | "abgelehnt"
  | "revalidierung"
  | "konflikt";

// Fünf Wissensarten — Schlüssel identisch zum Backend-Enum (KnowledgeObject.type).
export type KnowledgeType =
  | "bauchgefuehl"
  | "best_practice"
  | "lernkurve"
  | "technik"
  | "negativwissen";

export const DISPLAY_STATUSES: readonly DisplayStatus[] = [
  "entwurf",
  "offen",
  "pruefung",
  "validiert",
  "abgelehnt",
  "revalidierung",
  "konflikt",
];

export const KNOWLEDGE_TYPES: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];
