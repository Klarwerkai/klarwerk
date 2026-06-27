import { describe, expect, it } from "vitest";
import {
  type ExternalResult,
  ExternalSearchError,
  ExternalSearchService,
  type SearchProvider,
} from "../../external-search";
import { type AppServices, buildApp, buildServices } from "./build-app";

// SCRUM-241: External-Search-Route über die ECHTEN HTTP-Routen absichern — OHNE Live-Netzwerk.
// Der Provider wird über die bestehende Injection (buildApp(services) + AppServices.externalSearch)
// durch einen Fake ersetzt; für den Aus-Fall wird externalSearch = undefined gesetzt (Route → 501).
describe("SCRUM-241: External-Search (HTTP end-to-end, kein Live-Netz)", () => {
  // Fake-Provider mit Aufrufzähler — kein Netzwerk, deterministische Treffer.
  function fakeProvider(): SearchProvider & { calls: number } {
    return {
      name: "FakeWiki",
      calls: 0,
      async search(query: string): Promise<ExternalResult[]> {
        this.calls += 1;
        return [
          {
            title: `Treffer: ${query}`,
            url: "https://example.org/wiki/Treffer",
            snippet: `Auszug zu ${query}.`,
            provider: "FakeWiki",
          },
        ];
      },
    };
  }

  // Baut eine App mit injiziertem External-Search-Zustand und registriert einen Admin.
  async function appWith(externalSearch: AppServices["externalSearch"]) {
    const services = buildServices();
    services.externalSearch = externalSearch;
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it("autorisierte Suche liefert strukturierte Treffer (title/url/snippet/provider)", async () => {
    const provider = fakeProvider();
    const { app, headers } = await appWith(new ExternalSearchService({ provider }));

    const res = await app.inject({
      method: "GET",
      url: "/api/external/search?q=ventil",
      headers,
    });
    expect(res.statusCode).toBe(200);
    const hits = res.json();
    expect(Array.isArray(hits)).toBe(true);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      title: "Treffer: ventil",
      url: "https://example.org/wiki/Treffer",
      snippet: "Auszug zu ventil.",
      provider: "FakeWiki",
    });
    expect(provider.calls).toBe(1);
  });

  it("leere Query → 200 mit leerem Array, ohne Provider-Aufruf (ehrlich, kein Fake-Treffer)", async () => {
    const provider = fakeProvider();
    const { app, headers } = await appWith(new ExternalSearchService({ provider }));

    const res = await app.inject({
      method: "GET",
      url: "/api/external/search?q=%20%20",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(provider.calls).toBe(0); // Service trimmt → kein Provider-Call
  });

  it("deaktiviert (EXTERNAL_SEARCH=off → undefined) → 501 EXTERNAL_SEARCH_DISABLED", async () => {
    const { app, headers } = await appWith(undefined);

    const res = await app.inject({
      method: "GET",
      url: "/api/external/search?q=ventil",
      headers,
    });
    expect(res.statusCode).toBe(501);
    expect(res.json().error).toBe("EXTERNAL_SEARCH_DISABLED");
  });

  it("Provider-Fehler → ehrlicher Fehlerstatus (kein 200 mit Müll)", async () => {
    const throwing: SearchProvider = {
      name: "Broken",
      async search(): Promise<ExternalResult[]> {
        throw new ExternalSearchError("Upstream nicht erreichbar.");
      },
    };
    const { app, headers } = await appWith(new ExternalSearchService({ provider: throwing }));

    const res = await app.inject({
      method: "GET",
      url: "/api/external/search?q=ventil",
      headers,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("Guard: anonym wird abgewiesen", async () => {
    const provider = fakeProvider();
    const { app } = await appWith(new ExternalSearchService({ provider }));
    const res = await app.inject({ method: "GET", url: "/api/external/search?q=ventil" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(provider.calls).toBe(0);
  });
});
