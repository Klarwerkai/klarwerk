import { describe, expect, it } from "vitest";
import { ExternalSearchService, createExternalSearchFromEnv } from "./service";
import type { ExternalResult, SearchProvider } from "./types";

function stubProvider(results: ExternalResult[]): SearchProvider {
  return { name: "Stub", search: async () => results };
}

const result = (title: string): ExternalResult => ({
  title,
  url: `https://x/${title}`,
  snippet: "s",
  provider: "Stub",
});

describe("SCRUM-118: ExternalSearchService", () => {
  it("leere/Whitespace-Query → keine externe Abfrage, []", async () => {
    let called = false;
    const svc = new ExternalSearchService({
      provider: {
        name: "Stub",
        search: async () => {
          called = true;
          return [];
        },
      },
    });
    expect(await svc.search("   ")).toEqual([]);
    expect(called).toBe(false);
  });

  it("reicht echte Provider-Ergebnisse durch und begrenzt auf 10", async () => {
    const many = Array.from({ length: 15 }, (_, i) => result(`T${i}`));
    const svc = new ExternalSearchService({ provider: stubProvider(many) });
    const out = await svc.search("ventil");
    expect(out).toHaveLength(10);
    expect(out[0]?.title).toBe("T0");
    expect(svc.providerName).toBe("Stub");
  });

  it("createExternalSearchFromEnv: EXTERNAL_SEARCH=off → undefined (deaktiviert)", () => {
    expect(createExternalSearchFromEnv({ EXTERNAL_SEARCH: "off" })).toBeUndefined();
    expect(createExternalSearchFromEnv({})).toBeInstanceOf(ExternalSearchService);
  });
});
