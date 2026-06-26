import { describe, expect, it } from "vitest";
import type { FetchLike } from "./types";
import { articleUrl, createWikipediaProvider, stripHtml } from "./wikipedia";

// Fixture-Antwort der MediaWiki-Such-API (kein Live-Netzwerk).
const fixture = {
  query: {
    search: [
      {
        title: "Druckbehälter",
        snippet: 'Ein <span class="searchmatch">Ventil</span> &amp; Druck.',
      },
      { title: "Sicherheitsventil", snippet: "Schützt vor Überdruck." },
      { title: 12345, snippet: "ungültiger Titel wird übersprungen" },
    ],
  },
};

const okFetch =
  (body: unknown): FetchLike =>
  async () => ({ ok: true, status: 200, json: async () => body });

describe("SCRUM-118: Wikipedia-Provider (injizierter Fetch)", () => {
  it("mappt Suchtreffer auf ExternalResult, bereinigt HTML, baut URL", async () => {
    const provider = createWikipediaProvider({ lang: "de", fetchImpl: okFetch(fixture) });
    const results = await provider.search("Ventil Überdruck");
    expect(provider.name).toBe("Wikipedia");
    expect(results).toHaveLength(2); // ungültiger Titel übersprungen
    expect(results[0]).toEqual({
      title: "Druckbehälter",
      url: "https://de.wikipedia.org/wiki/Druckbeh%C3%A4lter",
      snippet: "Ein Ventil & Druck.",
      provider: "Wikipedia",
    });
  });

  it("nicht-OK-Antwort wirft ExternalSearchError", async () => {
    const provider = createWikipediaProvider({
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    });
    await expect(provider.search("x")).rejects.toMatchObject({ code: "EXTERNAL_SEARCH_FAILED" });
  });

  it("leere Treffermenge → leeres Array", async () => {
    const provider = createWikipediaProvider({ fetchImpl: okFetch({ query: { search: [] } }) });
    expect(await provider.search("xyz")).toEqual([]);
  });

  it("stripHtml entfernt Tags + Entities; articleUrl ersetzt Leerzeichen", () => {
    expect(stripHtml("<b>A</b>&amp;B  C")).toBe("A&B C");
    expect(articleUrl("en", "Pressure vessel")).toBe(
      "https://en.wikipedia.org/wiki/Pressure_vessel",
    );
  });
});
