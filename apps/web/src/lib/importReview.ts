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

const isString = (value: unknown): value is string => typeof value === "string";
// Eine Prüfquelle für Ablehnung, Formatangabe und Mindestvorlage.
const FIELD_CHECKS = {
  title: isString,
  statement: isString,
  category: isString,
  type: (value: unknown) => isString(value) && TYPES.includes(value as KnowledgeType),
};

export const IMPORT_JSON_FORMAT = {
  requiredFields: Object.keys(FIELD_CHECKS),
  types: TYPES,
  example: JSON.stringify(
    [
      Object.fromEntries(
        Object.keys(FIELD_CHECKS).map((field) => [field, field === "type" ? TYPES[0] : "..."]),
      ),
    ],
    null,
    2,
  ),
};

type ImportParseKind = "syntax" | "not-array" | "not-object" | "fields";

export class ImportParseError extends Error {
  constructor(
    message: string,
    readonly kind: ImportParseKind,
    readonly index: number | null = null,
    readonly fields: readonly string[] = [],
  ) {
    super(message);
    this.name = "ImportParseError";
  }
}

// Nur vertrauenswürdige Feldnamen und Zähler, niemals Inhalte der fremden Datei.
export function importParseNotice(error: ImportParseError): {
  key: string;
  params: { n: number | null; fields: string; types: string };
} {
  const keys: Record<ImportParseKind, string> = {
    syntax: "imp.json.syntax",
    "not-array": "imp.json.notArray",
    "not-object": "imp.json.notObject",
    fields: "imp.json.fields",
  };
  return {
    key: keys[error.kind],
    params: {
      n: error.index === null ? null : error.index + 1,
      fields: error.fields.join(", "),
      types: TYPES.join(", "),
    },
  };
}

export function parseImportItems(text: string): ImportItemInput[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportParseError("invalid-json", "syntax");
  }
  if (!Array.isArray(data)) {
    throw new ImportParseError("not-array", "not-array");
  }
  return data.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new ImportParseError(`item-${i}-not-object`, "not-object", i);
    }
    const o = raw as Record<string, unknown>;
    const fields = Object.entries(FIELD_CHECKS)
      .filter(([field, accepts]) => !accepts(o[field]))
      .map(([field]) => field);
    if (fields.length > 0) {
      throw new ImportParseError(`item-${i}-fields`, "fields", i, fields);
    }
    // Die Tabelle oben hat alle Pflichtfelder geprüft.
    const item: ImportItemInput = {
      title: o.title as string,
      statement: o.statement as string,
      type: o.type as KnowledgeType,
      category: o.category as string,
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
