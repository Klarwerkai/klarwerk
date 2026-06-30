// SCRUM-340: DOM-freier Helfer „Draft → Artikel" für den Knowledge Input Studio. Erzeugt aus einem
// vorhandenen Capture-/Reasoner-Entwurf (Statement/Bedingungen/Maßnahmen/Tags) sicheres Body-HTML
// als VORSCHLAG (kein validiertes Wissen, keine KI-Architektur). Alle Nutzereingaben werden escaped
// und das Ergebnis läuft defensiv durch sanitizeHtml; leere Felder werden ausgelassen. Nutzt H2/H3,
// Listen und die vorhandene Info-Blockklasse (editorBlockClass) — kein Cursor-Insert, kein Auto-Fill.

import { editorBlockClass } from "./editorBlocks";
import { isEmptyHtml, sanitizeHtml } from "./richText";

export type DraftArticleLocale = "de" | "en";

// Bewusst eine schmale Eingabe — StructureResult (title/statement/conditions/measures/tags/…) erfüllt
// sie strukturell. Der Titel ist das separate KO-Feld und wird NICHT in den Body dupliziert.
export interface DraftArticleInput {
  statement?: string | null;
  conditions?: readonly string[] | null;
  measures?: readonly string[] | null;
  tags?: readonly string[] | null;
}

const HEADINGS: Record<
  DraftArticleLocale,
  Record<"statement" | "conditions" | "measures" | "context", string>
> = {
  de: {
    statement: "Kernaussage",
    conditions: "Bedingungen",
    measures: "Maßnahmen",
    context: "Kontext",
  },
  en: {
    statement: "Key statement",
    conditions: "Conditions",
    measures: "Measures",
    context: "Context",
  },
};

export function normalizeDraftArticleLocale(locale: string | null | undefined): DraftArticleLocale {
  return locale?.toLowerCase().startsWith("en") ? "en" : "de";
}

function listHtml(items: readonly string[] | null | undefined): string {
  const safe = (items ?? []).map((i) => i.trim()).filter((i) => i.length > 0);
  if (safe.length === 0) {
    return "";
  }
  // Rohtext in vertrauenswürdige <li> einbetten; die Reinigung erfolgt EINMAL am Ende via sanitizeHtml
  // (escapt Sonderzeichen, entfernt Tags/Attribute) — kein Vor-Escaping, um Doppel-Escaping zu vermeiden.
  return `<ul>${safe.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

// Erzeugt das Artikel-HTML aus dem Entwurf. Leere Felder werden ausgelassen; ist nichts vorhanden,
// liefert die Funktion einen leeren String (kein leeres Gerüst). Nutzereingaben werden NICHT roh
// übernommen: das vollständige Fragment läuft am Ende durch sanitizeHtml (Allowlist H2/H3, Listen,
// Info-Panel; entfernt Skripte/Eventhandler, escapt Sonderzeichen) — kein User-HTML, kein Cursor-Insert.
export function draftArticleHtml(
  input: DraftArticleInput,
  locale: DraftArticleLocale = "de",
): string {
  const h = HEADINGS[locale];
  const parts: string[] = [];

  const statement = (input.statement ?? "").trim();
  if (statement) {
    // Aussage klar sichtbar: Überschrift + hervorgehobener Info-Block.
    parts.push(
      `<h2>${h.statement}</h2><div class="${editorBlockClass("info")}"><p>${statement}</p></div>`,
    );
  }

  const conditions = listHtml(input.conditions);
  if (conditions) {
    parts.push(`<h3>${h.conditions}</h3>${conditions}`);
  }

  const measures = listHtml(input.measures);
  if (measures) {
    parts.push(`<h3>${h.measures}</h3>${measures}`);
  }

  const tags = (input.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0);
  if (tags.length > 0) {
    parts.push(`<h3>${h.context}</h3><p>${tags.join(", ")}</p>`);
  }

  if (parts.length === 0) {
    return "";
  }
  // Eine defensive Reinigung des gesamten Fragments (kein doppeltes Escaping).
  return sanitizeHtml(parts.join(""));
}

// Übernahme in den vorhandenen Body: leer → setzen, sonst NICHT-destruktiv anhängen (kein stilles
// Überschreiben). Spiegelt das Set/Append-Verhalten von applyBodyTemplate (SCRUM-319).
export function applyDraftArticle(
  currentHtml: string | null | undefined,
  input: DraftArticleInput,
  locale: DraftArticleLocale = "de",
): string {
  const base = currentHtml ?? "";
  const next = draftArticleHtml(input, locale);
  if (next.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? next : base + next;
}
