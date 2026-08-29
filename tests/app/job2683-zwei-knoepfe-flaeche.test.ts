// JOB 2683 D1/D2 — ZWEI KNÖPFE, DIE NIE AUFHÖREN ZU DREHEN: die echten Routen mit einem fetch, das nie
// antwortet. Die Fläche selbst (Renderer) ist in `job2683-d2-erkunden-flaeche.test.tsx` und
// `tests/capture/job2683-d2-suche-flaeche.test.tsx` gemountet; hier wird der WIRETEXT gepinnt, den
// diese Flächen anzeigen.
//
// D2-KORREKTUR (BEN zu D1, Testaussagekraft): D1 pinnte für Confluence den pauschalen Alttext
// „Confluence-Erkundung fehlgeschlagen." — also genau das, was der Auftrag beheben wollte. Seit D2
// antwortet die Route bei einer Frist mit 504 CONFLUENCE_TIMEOUT und dem hostfreien Text des Clients.
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { type Guards, makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import { externalRoutes } from "../../services/app/src/routes/external-routes";
import { adapterFromConfig } from "../../services/confluence/src/adapter";
import { InMemoryExternalKnowledgePolicyRepo } from "../../services/external-search/src/policy";
import { ExternalSearchService } from "../../services/external-search/src/service";
import type { FetchLike } from "../../services/external-search/src/types";
import {
  EXTERNAL_SEARCH_MELDUNG,
  createWikipediaProvider,
} from "../../services/external-search/src/wikipedia";

const HOST_CONFLUENCE = "acme.atlassian.net";
const nieAntwortend = (() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;

function keinHostKeinDns(text: string): void {
  expect(text).not.toContain(HOST_CONFLUENCE);
  expect(text).not.toMatch(/wikipedia\.org|ENOTFOUND|getaddrinfo|ECONNREFUSED|https?:\/\//);
}

// ------------------------------------------------------------------------------------------------
// KNOPF 1 · „Erkunden" — POST /api/admin/import/confluence/explore
// ------------------------------------------------------------------------------------------------

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_ADDON_API"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

async function erkundenApp(fetchFn: typeof fetch, timeoutMs: number) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      // Der ECHTE Adapter über den echten Client — nur das Netz ist ersetzt.
      makeAdapter: () =>
        adapterFromConfig({
          baseUrl: `https://${HOST_CONFLUENCE}/wiki`,
          email: "svc@acme.example",
          apiToken: "read-only-tok-2683",
          spaceKey: "K",
          fetchFn,
          timeoutMs,
        }),
    }),
  );
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

describe("JOB 2683 · Knopf 1 · Erkunden bei hängender Confluence-Instanz", () => {
  it("D2: antwortet nach der Frist mit 504 CONFLUENCE_TIMEOUT und der hostfreien Zeitüberschreitungs-Meldung — statt nie und statt des Alttexts", async () => {
    // JOB 2693 D1 (Befund R2-5): die Warnung der Erkundung geht ueber den Logger der Anfrage,
    // nicht mehr an die Konsole. Ohne konfigurierten Logger ist `request.log` derselbe Logger wie
    // `app.log` — der Spion sitzt deshalb dort; die Aussage (Diagnose im Log, hostfrei) bleibt.
    const { app, headers } = await erkundenApp(nieAntwortend, 100);
    const warn = vi.spyOn(app.log, "warn").mockImplementation(() => undefined);
    try {
      const start = Date.now();
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence/explore",
        headers,
        payload: {},
      });
      expect(Date.now() - start).toBeLessThan(2_000); // Sekundenbruchteile, nicht Minuten
      expect(res.statusCode).toBe(504);
      const body = res.json();
      expect(body.error).toBe("CONFLUENCE_TIMEOUT");
      expect(body.message).toContain("Zeitüberschreitung");
      expect(body.message).not.toContain("fehlgeschlagen"); // der Alttext ist weg
      keinHostKeinDns(res.body);
      // Das Server-Log trägt dieselbe Diagnose, ebenfalls ohne Host.
      const geloggt = warn.mock.calls.map((c) => JSON.stringify(c)).join("\n");
      expect(geloggt).toContain("Zeitüberschreitung");
      keinHostKeinDns(geloggt);
      await app.close();
    } finally {
      warn.mockRestore();
    }
  });

  it("D2: hängt erst die zweite Ergebnisseite, kommen die gelesenen Seiten MIT dem Abbruchgrund an", async () => {
    let n = 0;
    const fetchFn = ((_u: string) => {
      n += 1;
      if (n === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              { id: "1", title: "Notfallplan", body: { storage: { value: "<p>A</p>" } } },
              { id: "2", title: "Wartung", body: { storage: { value: "<p>B</p>" } } },
            ],
            _links: { next: "/rest/api/content?start=2" },
          }),
        } as unknown as Response);
      }
      return new Promise<Response>(() => undefined);
    }) as unknown as typeof fetch;
    const { app, headers } = await erkundenApp(fetchFn, 100);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mappedPages).toBe(2); // eine langsame Seite tötet den Lauf nicht
    expect(body.truncated).toBe(true); // ehrlich unvollständig …
    expect(body.abbruch).toMatchObject({ grund: "timeout", nachSeiten: 2 }); // … mit Grund (D2)
    expect(String(body.abbruch.meldung)).toContain("Zeitüberschreitung");
    keinHostKeinDns(res.body);
    await app.close();
  });

  it("D2: der Probelauf des Imports (dryRun) meldet die Frist ebenso — nicht den pauschalen IMPORT_FAILED", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { app, headers } = await erkundenApp(nieAntwortend, 100);
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence",
        headers,
        payload: { dryRun: true },
      });
      expect(res.statusCode).toBe(504);
      expect(res.json().error).toBe("CONFLUENCE_TIMEOUT");
      expect(res.json().message).toContain("Zeitüberschreitung");
      keinHostKeinDns(res.body);
      await app.close();
    } finally {
      warn.mockRestore();
    }
  });

  it("KALIBRIERUNG: ein gewöhnlicher Fehler bleibt beim pauschalen 502 EXPLORE_FAILED", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const kaputt = (async () =>
        ({ ok: false, status: 500 }) as unknown as Response) as unknown as typeof fetch;
      const { app, headers } = await erkundenApp(kaputt, 1_000);
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence/explore",
        headers,
        payload: {},
      });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({
        error: "EXPLORE_FAILED",
        message: "Confluence-Erkundung fehlgeschlagen.",
      });
      await app.close();
    } finally {
      warn.mockRestore();
    }
  });
});

// ------------------------------------------------------------------------------------------------
// KNOPF 2 · „Externe Suche" — GET /api/external/search
// ------------------------------------------------------------------------------------------------

const angemeldet: Guards = {
  requireUser: async () => ({ id: "u1", role: "experte" }),
  requirePermission: async () => ({ id: "u1", role: "experte" }),
};

async function sucheApp(fetchImpl: FetchLike, timeoutMs: number) {
  const app = Fastify();
  await app.register(
    externalRoutes(
      {
        search: new ExternalSearchService({
          provider: createWikipediaProvider({ fetchImpl, timeoutMs }),
        }),
        policy: new InMemoryExternalKnowledgePolicyRepo(), // Default search_on_click → Suche erlaubt
      },
      angemeldet,
    ),
  );
  await app.ready();
  return app;
}

describe("JOB 2683 · Knopf 2 · Externe Suche bei hängendem oder totem Anbieter", () => {
  it("antwortet nach der Frist mit dem generischen Satz — statt nie", async () => {
    const app = await sucheApp(() => new Promise(() => undefined), 100);
    const start = Date.now();
    const res = await app.inject({ method: "GET", url: "/api/external/search?q=Ventil" });
    expect(Date.now() - start).toBeLessThan(2_000);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json()).toEqual({
      error: "EXTERNAL_SEARCH_FAILED",
      message: EXTERNAL_SEARCH_MELDUNG.timeout,
    });
    keinHostKeinDns(res.body);
    await app.close();
  });

  it("DNS-Fehler: der Nutzer liest keinen Host und keinen DNS-Text mehr", async () => {
    const app = await sucheApp(async () => {
      throw new TypeError("fetch failed: getaddrinfo ENOTFOUND de.wikipedia.org");
    }, 1_000);
    const res = await app.inject({ method: "GET", url: "/api/external/search?q=Ventil" });
    expect(res.json()).toEqual({
      error: "EXTERNAL_SEARCH_FAILED",
      message: EXTERNAL_SEARCH_MELDUNG.unreachable,
    });
    keinHostKeinDns(res.body);
    await app.close();
  });

  it("der Normalfall bleibt: Treffer kommen an", async () => {
    const app = await sucheApp(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({ query: { search: [{ title: "Sicherheitsventil", snippet: "x" }] } }),
      }),
      1_000,
    );
    const res = await app.inject({ method: "GET", url: "/api/external/search?q=Ventil" });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((t: { title: string }) => t.title)).toEqual(["Sicherheitsventil"]);
    await app.close();
  });
});
