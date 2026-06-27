import { describe, expect, it } from "vitest";
import type { ExternalResult } from "../../apps/web/src/api/types";
import {
  buildExternalSearchView,
  dedupeResults,
  isSearchDisabled,
} from "../../apps/web/src/lib/externalKnowledge";

function res(overrides: Partial<ExternalResult>): ExternalResult {
  return {
    title: "Titel",
    url: "https://example.org/a",
    snippet: "Auszug",
    provider: "Wikipedia",
    ...overrides,
  };
}

describe("SCRUM-225: externalKnowledge", () => {
  it("isSearchDisabled erkennt 501 und EXTERNAL_SEARCH_DISABLED", () => {
    expect(isSearchDisabled(501)).toBe(true);
    expect(isSearchDisabled(undefined, "EXTERNAL_SEARCH_DISABLED")).toBe(true);
    expect(isSearchDisabled(500)).toBe(false);
    expect(isSearchDisabled(200, "OK")).toBe(false);
  });

  it("dedupeResults entfernt Dubletten und URL-lose Treffer, Reihenfolge bleibt stabil", () => {
    const out = dedupeResults([
      res({ url: "https://a" }),
      res({ url: "https://a" }), // Dublette
      res({ url: "  " }), // ohne URL
      res({ url: "https://b" }),
    ]);
    expect(out.map((r) => r.url)).toEqual(["https://a", "https://b"]);
  });

  it("idle vor der ersten Suche", () => {
    expect(buildExternalSearchView({ pending: false, hasSearched: false }).kind).toBe("idle");
  });

  it("loading während der Anfrage", () => {
    expect(buildExternalSearchView({ pending: true, hasSearched: true }).kind).toBe("loading");
  });

  it("disabled bei 501 (auch wenn pending true wäre)", () => {
    const view = buildExternalSearchView({
      pending: false,
      hasSearched: true,
      error: { status: 501, code: "EXTERNAL_SEARCH_DISABLED", message: "off" },
    });
    expect(view.kind).toBe("disabled");
  });

  it("error mit Nachricht bei sonstigem Fehler", () => {
    const view = buildExternalSearchView({
      pending: false,
      hasSearched: true,
      error: { status: 500, message: "Boom" },
    });
    expect(view).toEqual({ kind: "error", message: "Boom" });
  });

  it("empty wenn gesucht, aber keine Treffer", () => {
    expect(buildExternalSearchView({ pending: false, hasSearched: true, results: [] }).kind).toBe(
      "empty",
    );
  });

  it("results liefert deduplizierte Treffer", () => {
    const view = buildExternalSearchView({
      pending: false,
      hasSearched: true,
      results: [res({ url: "https://a" }), res({ url: "https://a" }), res({ url: "https://b" })],
    });
    expect(view.kind).toBe("results");
    if (view.kind === "results") {
      expect(view.results.map((r) => r.url)).toEqual(["https://a", "https://b"]);
    }
  });
});
