// SCRUM-118 / FR-EXT-02: optionaler Server-Proxy für externe Quellensuche.
// Stateless, kein KO-Bezug. Ergebnisse werden NIE automatisch übernommen.

export interface ExternalResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string): Promise<ExternalResult[]>;
}

export class ExternalSearchError extends Error {
  readonly code = "EXTERNAL_SEARCH_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "ExternalSearchError";
  }
}

// Minimaler Fetch-Vertrag — injizierbar für Tests (kein Live-Netzwerk).
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;
