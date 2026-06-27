// SCRUM-225: DOM-freie Sicht-Ableitung für den eigenständigen External-Knowledge-Einstieg.
// Bildet den Zustand der externen Suche (Server-Proxy, SCRUM-118) auf eine renderbare
// View-Variante ab. Kein KO-Bezug, kein Anhängen, kein Auto-Import — reine Lesesicht.
import type { ExternalResult } from "../api/types";

export type ExternalSearchView =
  | { kind: "idle" } // noch nicht gesucht
  | { kind: "loading" } // Anfrage läuft
  | { kind: "disabled" } // EXTERNAL_SEARCH=off → 501, ehrlich angezeigt
  | { kind: "error"; message: string } // sonstiger Fehler
  | { kind: "empty" } // gesucht, keine Treffer
  | { kind: "results"; results: ExternalResult[] };

// EXTERNAL_SEARCH=off liefert serverseitig 501 mit code EXTERNAL_SEARCH_DISABLED
// (services/app/src/routes/external-routes.ts). Beides wird als "deaktiviert" gewertet.
export function isSearchDisabled(status?: number, code?: string): boolean {
  return status === 501 || code === "EXTERNAL_SEARCH_DISABLED";
}

// Treffer ohne URL verwerfen, Dubletten (gleiche URL) entfernen — stabile Reihenfolge.
export function dedupeResults(results: readonly ExternalResult[]): ExternalResult[] {
  const seen = new Set<string>();
  const out: ExternalResult[] = [];
  for (const r of results) {
    const key = r.url.trim();
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(r);
  }
  return out;
}

export interface ExternalSearchInput {
  pending: boolean;
  hasSearched: boolean;
  error?: { status?: number; code?: string; message: string } | null;
  results?: readonly ExternalResult[];
}

export function buildExternalSearchView(input: ExternalSearchInput): ExternalSearchView {
  if (input.error) {
    if (isSearchDisabled(input.error.status, input.error.code)) {
      return { kind: "disabled" };
    }
    return { kind: "error", message: input.error.message };
  }
  if (input.pending) {
    return { kind: "loading" };
  }
  if (!input.hasSearched) {
    return { kind: "idle" };
  }
  const results = dedupeResults(input.results ?? []);
  return results.length === 0 ? { kind: "empty" } : { kind: "results", results };
}
