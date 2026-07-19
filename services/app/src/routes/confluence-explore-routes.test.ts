import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfluenceSourceAdapter } from "../../../confluence";
import type { ImportItem } from "../../../library-analytics";
import { buildApp, buildServices } from "../build-app";
import { makeGuards } from "../http";
import { registerNoindexHook } from "../noindex-hook";
import { confluenceImportRoutes } from "./confluence-import-routes";

// IC-1 (Import-Cockpit): READ-ONLY Erkundungs-Route. Prüft: 200 mit Summary-Struktur, KEIN Kandidat
// erzeugt (library.listImportCandidates bleibt leer), Flag-aus → 503, Adapter-Reject → 502 mit genau
// EINER Antwort (WP-E-Regel: `return reply`, kein Doppel-Send/Crash).

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

// Fixture-Adapter über den öffentlichen Vertrag (source/collect/collectAll). Cast nötig, weil
// ConfluenceSourceAdapter eine Klasse mit privaten Feldern ist — die Route liest nur collectAll.
function fixtureAdapter(items: ImportItem[], truncated = false): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed: [], truncated }),
  } as unknown as ConfluenceSourceAdapter;
}

function failingAdapter(err: Error): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => [],
    collectAll: async () => {
      throw err;
    },
  } as unknown as ConfluenceSourceAdapter;
}

async function exploreApp(makeAdapter: () => ConfluenceSourceAdapter | undefined) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      makeAdapter,
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
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

async function withRejectionSpy(run: () => Promise<void>): Promise<unknown[]> {
  const rejections: unknown[] = [];
  const spy = (reason: unknown) => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", spy);
  try {
    await run();
    await new Promise<void>((r) => setImmediate(() => r()));
    await new Promise<void>((r) => setImmediate(() => r()));
  } finally {
    process.removeListener("unhandledRejection", spy);
  }
  return rejections;
}

const ITEMS: ImportItem[] = [
  {
    title: "Notfallplan",
    statement: "…",
    type: "best_practice",
    category: "K",
    author: "anna",
    tags: ["sicherheit"],
    sourceScope: "SPACE-K",
    updatedAt: "2026-02-01T09:00:00.000Z",
    bodyHtml: '<p><img src="/api/objects/x/raw"></p>',
  },
  {
    title: "Wartung",
    statement: "…",
    type: "best_practice",
    category: "K",
    author: "anna",
    tags: ["wartung", "sicherheit"],
    sourceScope: "SPACE-K",
    updatedAt: "2026-05-10T12:00:00.000Z",
  },
];

describe("IC-1: POST /api/admin/import/confluence/explore", () => {
  it("200 mit Summary-Struktur; erzeugt KEINE Kandidaten (read-only)", async () => {
    const { app, services, headers } = await exploreApp(() => fixtureAdapter(ITEMS, false));
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.truncated).toBe(false);
    expect(body.summary.totalCount).toBe(2);
    expect(body.summary.distinctSources).toBe(1);
    expect(body.summary.authors).toEqual([{ name: "anna", count: 2 }]);
    expect(body.summary.themes).toEqual([
      { label: "sicherheit", count: 2 },
      { label: "wartung", count: 1 },
    ]);
    expect(body.summary.dateRange).toEqual({
      earliest: "2026-02-01T09:00:00.000Z",
      latest: "2026-05-10T12:00:00.000Z",
    });
    expect(body.summary.withImagesHint).toBe(1);
    // READ-ONLY: nichts geschrieben — die Review-Queue bleibt leer.
    expect(await services.library.listImportCandidates()).toEqual([]);
  });

  it("reicht truncated aus collectAll durch", async () => {
    const { app, headers } = await exploreApp(() => fixtureAdapter(ITEMS, true));
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().truncated).toBe(true);
  });

  it("ohne Adapter (Flag aus / nicht konfiguriert) → 503 IMPORT_UNAVAILABLE", async () => {
    const { app, headers } = await exploreApp(() => undefined);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("IMPORT_UNAVAILABLE");
  });

  it("ohne Admin-Session → 401 (Auth erzwungen), keine Kandidaten", async () => {
    const { app, services } = await exploreApp(() => fixtureAdapter(ITEMS));
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(await services.library.listImportCandidates()).toEqual([]);
  });

  it("Adapter-Reject → 502 EXPLORE_FAILED, genau EINE Antwort, keine unhandled rejection", async () => {
    // Reproduktions-Setup wie WP-E: Add-on-Flag AN + globaler Noindex-onSend-Hook (Prod-Parität).
    process.env.KLARWERK_ADDON_API = "1";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rejections = await withRejectionSpy(async () => {
        const services = buildServices();
        const app = buildApp(services);
        registerNoindexHook(app);
        app.register(
          confluenceImportRoutes({
            library: services.library,
            koService: services.ko,
            guards: makeGuards(services.auth),
            makeAdapter: () => failingAdapter(new Error("Confluence-API antwortete mit 500")),
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
        const res = await app.inject({
          method: "POST",
          url: "/api/admin/import/confluence/explore",
          headers: { authorization: `Bearer ${login.json().token}` },
          payload: {},
        });
        expect(res.statusCode).toBe(502);
        expect(res.json()).toEqual({
          error: "EXPLORE_FAILED",
          message: "Confluence-Erkundung fehlgeschlagen.",
        });
      });
      expect(rejections).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
