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
  // WP-SUBMIT-ASYNC: nur Beiträge, deren KI-Pruefung noch laeuft (aiCheck pending).
  aiPending: boolean;
}

export const EMPTY_VALIDATION_FILTER: ValidationFilterState = {
  search: "",
  type: "",
  category: "",
  tag: "",
  mineOnly: false,
  aiPending: false,
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
  // WP-SUBMIT-ASYNC: „in Pruefung" zeigt nur laufende Hintergrund-Pruefungen; Altbestand ohne
  // aiCheck-Feld und abgeschlossene/fehlgeschlagene Pruefungen fallen ehrlich heraus.
  if (f.aiPending && k.aiCheck?.status !== "pending") {
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

// SCRUM-364 / AG-15 follow-up: deep-linkbare „Mir zugewiesen"-Linse. Die Assignment-Benachrichtigung
// (Topbar-Glocke) führt jetzt direkt in die persönliche Review-Liste. Der Query-Param `mine=1` aktiviert
// beim Laden die bereits vorhandene `mineOnly`-Filterung (matchesValidationFilter über
// k.assignments.includes(userId)). Reine Anzeige-/Link-Konvention: kein Backend, kein neues Rollen-/
// Assignee-Modell, keine Persistenz über die Sitzung hinaus.
export const MINE_FILTER_PARAM = "mine";
const MINE_FILTER_ON = "1";

// Liest die persönliche Linse aus der Query. Nur `mine=1` aktiviert; fehlend/anders → aus (neutral).
export function readMineOnlyFilter(params: URLSearchParams): boolean {
  return params.get(MINE_FILTER_PARAM) === MINE_FILTER_ON;
}

// Merge der „Mir zugewiesen"-Linse in die bestehende Query: an → `mine=1`, aus → Parameter entfernen.
// Alle übrigen Query-Parameter (origin/review/demo …) bleiben unangetastet (saubere URL).
export function applyMineOnlyParam(params: URLSearchParams, mineOnly: boolean): URLSearchParams {
  const next = new URLSearchParams(params);
  if (mineOnly) {
    next.set(MINE_FILTER_PARAM, MINE_FILTER_ON);
  } else {
    next.delete(MINE_FILTER_PARAM);
  }
  return next;
}

// Fokussierter Deep-Link in die persönliche Review-Liste — Ziel der Assignment-Benachrichtigung.
export function validationMineHref(): string {
  return `/validierung?${MINE_FILTER_PARAM}=${MINE_FILTER_ON}`;
}

// Ehrlicher Leerzustand der persönlichen Linse: NUR wenn „Mir zugewiesen" aktiv ist UND keine
// persönliche Review-Arbeit (mehr) sichtbar ist — ruhige, motivierende Copy statt stummer Leere.
// Kein Effekt bei inaktiver Linse oder vorhandenen Treffern (dann greift der normale Board-Empty-State).
export interface MineQueueEmptyHint {
  titleKey: string;
  hintKey: string;
  ctaKey: string;
}

export function mineQueueEmptyHint(args: {
  mineOnly: boolean;
  visibleCount: number;
}): MineQueueEmptyHint | null {
  if (!args.mineOnly || args.visibleCount > 0) {
    return null;
  }
  return {
    titleKey: "val.mineEmpty.title",
    hintKey: "val.mineEmpty.hint",
    ctaKey: "val.mineEmpty.cta",
  };
}
