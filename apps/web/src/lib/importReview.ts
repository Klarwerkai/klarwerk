// Reiner, DOM-freier JSON-Parser für den Re-Import (SCRUM-108).
// Validiert die Eingabe streng → keine stille Übernahme kaputter Daten.
import type { ImportItemInput, KnowledgeType } from "../api/types";

const TYPES: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportParseError";
  }
}

export function parseImportItems(text: string): ImportItemInput[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportParseError("invalid-json");
  }
  if (!Array.isArray(data)) {
    throw new ImportParseError("not-array");
  }
  return data.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new ImportParseError(`item-${i}-not-object`);
    }
    const o = raw as Record<string, unknown>;
    if (
      typeof o.title !== "string" ||
      typeof o.statement !== "string" ||
      typeof o.category !== "string" ||
      typeof o.type !== "string" ||
      !TYPES.includes(o.type as KnowledgeType)
    ) {
      throw new ImportParseError(`item-${i}-fields`);
    }
    const item: ImportItemInput = {
      title: o.title,
      statement: o.statement,
      type: o.type as KnowledgeType,
      category: o.category,
    };
    if (Array.isArray(o.tags)) {
      item.tags = o.tags.filter((t): t is string => typeof t === "string");
    }
    if (typeof o.author === "string") {
      item.author = o.author;
    }
    return item;
  });
}
