// Reine, DOM-freie Filterlogik für das Validation Board (FE-VAL-02).
// Arbeitet auf den bereits geladenen Board-Items; keine Server-/Statusfilter
// (das Board liefert fachlich bereits die offenen Objekte).
import type { KnowledgeObject } from "../api/types";

export interface ValidationFilterState {
  search: string;
  type: string; // "" = alle
  category: string; // "" = alle
  tag: string; // "" = alle
  mineOnly: boolean;
}

export const EMPTY_VALIDATION_FILTER: ValidationFilterState = {
  search: "",
  type: "",
  category: "",
  tag: "",
  mineOnly: false,
};

// Volltext-Heuhaufen: Titel, Aussage, Bedingungen, Maßnahmen, Kategorie, Tags.
function haystack(k: KnowledgeObject): string {
  return [k.title, k.statement, ...k.conditions, ...k.measures, k.category, ...k.tags]
    .join("\n")
    .toLowerCase();
}

// Alle aktiven Filter wirken gemeinsam als AND. Leerer Filter = keine Einschränkung.
export function matchesValidationFilter(
  k: KnowledgeObject,
  f: ValidationFilterState,
  userId: string | null,
): boolean {
  const search = f.search.trim().toLowerCase();
  if (search && !haystack(k).includes(search)) {
    return false;
  }
  if (f.type && k.type !== f.type) {
    return false;
  }
  if (f.category && k.category !== f.category) {
    return false;
  }
  if (f.tag && !k.tags.includes(f.tag)) {
    return false;
  }
  if (f.mineOnly && (!userId || !k.assignments.includes(userId))) {
    return false;
  }
  return true;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Optionen stabil aus den geladenen Items ableiten.
export function categoryOptions(items: KnowledgeObject[]): string[] {
  return sortedUnique(items.map((k) => k.category));
}

export function tagOptions(items: KnowledgeObject[]): string[] {
  return sortedUnique(items.flatMap((k) => k.tags));
}

export function typeOptions(items: KnowledgeObject[]): string[] {
  return sortedUnique(items.map((k) => k.type));
}
