// SCRUM-245: DOM-freie, nachvollziehbare Relevanz-Sortierung + Match-Gründe für die Bibliothek.
// KEINE neue Suchmaschine, KEINE Vector-DB, KEINE RAG/semantische Suche — nur transparentes
// Substring-/Token-Scoring über die bereits gelieferten Treffer. Re-RANKT die Kandidaten und
// erklärt sie; verwirft nichts. Bei leerer Query: stabile Default-Ordnung (validiert/Trust/Titel).
import type { KnowledgeObject } from "../api/types";

export type MatchField = "title" | "tag" | "category" | "type" | "text";

// Anzeige-/Prioritätsreihenfolge der Match-Gründe (Titel am stärksten, Text am schwächsten).
export const MATCH_FIELD_ORDER: readonly MatchField[] = [
  "title",
  "tag",
  "category",
  "type",
  "text",
];

export interface ScoredKo {
  ko: KnowledgeObject;
  score: number;
  matches: MatchField[]; // welche Felder die Query getroffen haben (für den Match-Hinweis)
}

// Query in Tokens (>1 Zeichen) zerlegen — Mehrwortsuche unterstützt, ohne Stoppwort-Magie.
function queryTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

interface FieldHit {
  matched: boolean;
  score: number;
}

// Ein Feld bewerten: Volltreffer (ganze Phrase) zählt stark, einzelne Token-Treffer addieren.
function hitField(
  value: string,
  phrase: string,
  tokens: readonly string[],
  phraseScore: number,
  tokenScore: number,
): FieldHit {
  const v = value.toLowerCase();
  let score = 0;
  let matched = false;
  if (phrase.length > 0 && v.includes(phrase)) {
    score += phraseScore;
    matched = true;
  }
  for (const token of tokens) {
    if (v.includes(token)) {
      score += tokenScore;
      matched = true;
    }
  }
  return { matched, score };
}

// Gewichte (nachvollziehbar): Titel > Tag/Kategorie/Typ > Text(Statement).
export function scoreKo(
  ko: KnowledgeObject,
  query: string,
): { score: number; matches: MatchField[] } {
  const phrase = query.trim().toLowerCase();
  if (phrase.length === 0) {
    return { score: 0, matches: [] };
  }
  const tokens = queryTokens(query);
  let score = 0;
  const matched = new Set<MatchField>();

  const title = hitField(ko.title, phrase, tokens, 6, 3);
  if (title.matched) {
    score += title.score;
    matched.add("title");
  }
  const tag = hitField((ko.tags ?? []).join(" "), phrase, tokens, 3, 3);
  if (tag.matched) {
    score += tag.score;
    matched.add("tag");
  }
  const category = hitField(ko.category, phrase, tokens, 2, 2);
  if (category.matched) {
    score += category.score;
    matched.add("category");
  }
  const type = hitField(ko.type, phrase, tokens, 2, 2);
  if (type.matched) {
    score += type.score;
    matched.add("type");
  }
  const text = hitField(ko.statement, phrase, tokens, 2, 1);
  if (text.matched) {
    score += text.score;
    matched.add("text");
  }

  return { score, matches: MATCH_FIELD_ORDER.filter((f) => matched.has(f)) };
}

function validatedRank(ko: KnowledgeObject): number {
  return ko.status === "validiert" ? 1 : 0;
}

// Re-rankt die (bereits gefilterten) Treffer stabil nach Relevanz. Trust/Status sind NUR
// Tie-Breaker. Verwirft nichts — Score-0-Treffer landen hinten in sinnvoller Default-Ordnung.
export function searchLibrary(kos: readonly KnowledgeObject[], query: string): ScoredKo[] {
  return kos
    .map((ko) => ({ ko, ...scoreKo(ko, query) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        validatedRank(b.ko) - validatedRank(a.ko) ||
        (b.ko.trust ?? 0) - (a.ko.trust ?? 0) ||
        a.ko.title.localeCompare(b.ko.title) ||
        a.ko.id.localeCompare(b.ko.id),
    );
}
