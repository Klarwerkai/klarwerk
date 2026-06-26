import type { ExternalResult, FetchLike, SearchProvider } from "./types";
// SCRUM-118: Externe-Suche-Service. Dünn über den Provider; begrenzt Ergebnisse,
// lehnt leere Query ab. Übernimmt NIE automatisch (nur Suche).
import { createWikipediaProvider } from "./wikipedia";

const MAX_RESULTS = 10;

export interface ExternalSearchDeps {
  provider: SearchProvider;
}

export class ExternalSearchService {
  private readonly provider: SearchProvider;

  constructor(deps: ExternalSearchDeps) {
    this.provider = deps.provider;
  }

  get providerName(): string {
    return this.provider.name;
  }

  async search(query: string): Promise<ExternalResult[]> {
    const q = query.trim();
    if (q.length === 0) {
      return [];
    }
    const results = await this.provider.search(q);
    return results.slice(0, MAX_RESULTS);
  }
}

// Optionaler Proxy: aus Env bauen, außer EXTERNAL_SEARCH=off → undefined (Route 501).
export function createExternalSearchFromEnv(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: FetchLike } = {},
): ExternalSearchService | undefined {
  if (env.EXTERNAL_SEARCH === "off") {
    return undefined;
  }
  const provider = createWikipediaProvider({
    lang: env.EXTERNAL_SEARCH_LANG ?? "de",
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  });
  return new ExternalSearchService({ provider });
}
