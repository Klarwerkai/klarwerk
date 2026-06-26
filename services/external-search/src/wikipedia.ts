// Wikipedia-Provider über die öffentliche MediaWiki-Such-API (kein API-Key).
// HTML-Snippets werden zu reinem Text bereinigt; URL wird sauber gebaut.
import {
  type ExternalResult,
  ExternalSearchError,
  type FetchLike,
  type SearchProvider,
} from "./types";

export interface WikipediaConfig {
  lang?: string; // Default "de"
  fetchImpl?: FetchLike;
}

// MediaWiki liefert Snippets mit <span class="searchmatch">…</span> & HTML-Entities.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function articleUrl(lang: string, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

interface MediaWikiSearchResponse {
  query?: { search?: { title?: unknown; snippet?: unknown }[] };
}

export function createWikipediaProvider(config: WikipediaConfig = {}): SearchProvider {
  const lang = config.lang ?? "de";
  const doFetch = (config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)) as FetchLike;
  return {
    name: "Wikipedia",
    async search(query: string): Promise<ExternalResult[]> {
      const url =
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json` +
        `&srlimit=10&srprop=snippet&srsearch=${encodeURIComponent(query)}`;
      let res: Awaited<ReturnType<FetchLike>>;
      try {
        res = await doFetch(url);
      } catch (error) {
        throw new ExternalSearchError(
          error instanceof Error ? error.message : "Netzwerkfehler bei der externen Suche.",
        );
      }
      if (!res.ok) {
        throw new ExternalSearchError(`Externe Suche antwortete mit ${res.status}.`);
      }
      const data = (await res.json()) as MediaWikiSearchResponse;
      const hits = data.query?.search ?? [];
      const results: ExternalResult[] = [];
      for (const hit of hits) {
        const title = typeof hit.title === "string" ? hit.title : "";
        if (!title) {
          continue;
        }
        const snippet = typeof hit.snippet === "string" ? stripHtml(hit.snippet) : "";
        results.push({ title, url: articleUrl(lang, title), snippet, provider: "Wikipedia" });
      }
      return results;
    },
  };
}
