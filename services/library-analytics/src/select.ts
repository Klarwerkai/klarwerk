// IC-3 (Import-Cockpit): PURE Auswahl-/Filterlogik. Der Nutzer grenzt per Klick (Label-/Autor-/
// Jahr-Filter) ODER per Freitext (KI leitet Kriterien ab) ein, WAS importiert wird — statt alles roh
// zu bekommen. Diese Datei ist vollständig deterministisch, ohne KI und ohne Confluence-Symbole (kennt
// nur den quell-agnostischen ImportItem-Vertrag). Die KI-Ableitung ist über eine INJIZIERTE Funktion
// eingebunden (kein reasoner-Import hier); fällt sie aus, gelten leere Kriterien → nur der Klick-Filter.

import type { ImportItem } from "./types";

export interface SelectCriteria {
  themes?: string[]; // Label-Filter (mind. ein Label muss passen)
  authors?: string[]; // Autor-Filter (Autor muss einer sein)
  keywords?: string[]; // Stichworte → Substring-Match in Titel/Statement (mind. eines)
  yearFrom?: number; // Jahr-Untergrenze (aus updatedAt)
  yearTo?: number; // Jahr-Obergrenze (aus updatedAt)
  limit?: number; // Deckel auf die Vorschau/Auswahl
}

export interface SelectResult {
  selected: ImportItem[]; // passende Items, auf `limit` gedeckelt
  matched: number; // Anzahl ALLER passenden Items (vor dem Deckel)
  limited: boolean; // true, wenn der Deckel weniger zeigt, als passen
}

// Plausibilitätsgrenzen für die (auch von außen/vom Modell gelieferten) Kriterien.
const MAX_LIST_ENTRIES = 40;
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;
const MAX_LIMIT = 1000;

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length > 0 && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
    if (out.length >= MAX_LIST_ENTRIES) {
      break;
    }
  }
  return out;
}

function cleanYear(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR ? n : undefined;
}

function cleanLimit(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_LIMIT ? n : undefined;
}

// IC-3: JEDE Kriterien-Quelle (Client-Body ODER Modell-JSON) läuft hier durch — nur valide, plausible
// Felder überleben; alles andere fällt weg. „Nie raten, nie erfinden": Unbrauchbares → leeres Feld.
export function sanitizeCriteria(raw: unknown): SelectCriteria {
  if (raw === null || typeof raw !== "object") {
    return {};
  }
  const rec = raw as Record<string, unknown>;
  const themes = cleanStrings(rec.themes);
  const authors = cleanStrings(rec.authors);
  const keywords = cleanStrings(rec.keywords);
  const yearFrom = cleanYear(rec.yearFrom);
  const yearTo = cleanYear(rec.yearTo);
  const limit = cleanLimit(rec.limit);
  return {
    ...(themes.length > 0 ? { themes } : {}),
    ...(authors.length > 0 ? { authors } : {}),
    ...(keywords.length > 0 ? { keywords } : {}),
    ...(yearFrom !== undefined ? { yearFrom } : {}),
    ...(yearTo !== undefined ? { yearTo } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function itemYear(item: ImportItem): number | null {
  const when = item.updatedAt?.trim();
  if (!when) {
    return null;
  }
  const match = /^(\d{4})/.exec(when);
  return match ? Number(match[1]) : null;
}

function matchesThemes(item: ImportItem, themes: Set<string>): boolean {
  if (themes.size === 0) {
    return true;
  }
  return (item.tags ?? []).some((tag) => themes.has(tag.trim().toLowerCase()));
}

function matchesAuthors(item: ImportItem, authors: Set<string>): boolean {
  if (authors.size === 0) {
    return true;
  }
  const author = item.author?.trim().toLowerCase();
  return author !== undefined && author.length > 0 && authors.has(author);
}

function matchesYears(item: ImportItem, from?: number, to?: number): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  const year = itemYear(item);
  if (year === null) {
    return false; // Jahr gefordert, aber keins bekannt → NICHT raten, ausschließen.
  }
  if (from !== undefined && year < from) {
    return false;
  }
  return !(to !== undefined && year > to);
}

function matchesKeywords(item: ImportItem, keywords: readonly string[]): boolean {
  if (keywords.length === 0) {
    return true;
  }
  const haystack = `${item.title} ${item.statement}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

// IC-3: reine, deterministische Filterung + Deckelung. Reihenfolge = Eingabereihenfolge (stabil).
export function filterImportItems(
  items: readonly ImportItem[],
  criteria: SelectCriteria = {},
): SelectResult {
  const themes = new Set((criteria.themes ?? []).map((t) => t.toLowerCase()));
  const authors = new Set((criteria.authors ?? []).map((a) => a.toLowerCase()));
  const keywords = criteria.keywords ?? [];
  const passing = items.filter(
    (item) =>
      matchesThemes(item, themes) &&
      matchesAuthors(item, authors) &&
      matchesYears(item, criteria.yearFrom, criteria.yearTo) &&
      matchesKeywords(item, keywords),
  );
  const limit = criteria.limit;
  const selected = limit !== undefined && limit > 0 ? passing.slice(0, limit) : [...passing];
  return {
    selected,
    matched: passing.length,
    limited: limit !== undefined && limit > 0 && passing.length > limit,
  };
}

// IC-3: kompakter Vorschau-Eintrag (READ-ONLY Anzeige — kein Import). Pure Projektion eines ImportItems.
export interface ImportPreviewEntry {
  title: string;
  author?: string;
  updatedAt?: string;
  hasImage: boolean;
  themes: string[];
}

export function toPreviewEntry(item: ImportItem): ImportPreviewEntry {
  const author = item.author?.trim();
  const updatedAt = item.updatedAt?.trim();
  const themes = (item.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  return {
    title: item.title,
    ...(author ? { author } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    hasImage: typeof item.bodyHtml === "string" && /<img\b/i.test(item.bodyHtml),
    themes,
  };
}

// IC-3: Freitext → Kriterien über eine INJIZIERTE Inferenz (der Aufrufer verdrahtet den Reasoner).
// `infer` liefert das ROH-JSON des Modells (unknown) oder null. JEDER Ausgang — null, Wurf, Unbrauchbar —
// endet in LEEREN Kriterien: nie raten, nie erfinden. Nur der deterministische sanitizeCriteria formt
// das Ergebnis. Ein leerer/whitespace-Prompt ruft die KI gar nicht erst.
export type CriteriaInference = (prompt: string) => Promise<unknown | null>;

export async function deriveCriteriaFromPrompt(
  prompt: string,
  infer: CriteriaInference,
): Promise<SelectCriteria> {
  if (prompt.trim().length === 0) {
    return {};
  }
  try {
    const raw = await infer(prompt);
    return raw === null || raw === undefined ? {} : sanitizeCriteria(raw);
  } catch {
    return {};
  }
}
