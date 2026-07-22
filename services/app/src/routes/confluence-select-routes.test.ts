import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfluenceSourceAdapter } from "../../../confluence";
import type { ImportItem } from "../../../library-analytics";
import { buildApp, buildServices } from "../build-app";
import { makeGuards } from "../http";
import { registerNoindexHook } from "../noindex-hook";
import { confluenceImportRoutes } from "./confluence-import-routes";

// IC-3 (Import-Cockpit): READ-ONLY Auswahl-Vorschau. Prüft: 200 mit Vorschau + effektiven Kriterien,
// KEIN Kandidat erzeugt; Flag-aus → 503; Adapter-Reject → 502 mit genau EINER Antwort (WP-E).

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

async function selectApp(makeAdapter: () => ConfluenceSourceAdapter | undefined) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: services.reasoner,
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
    title: "Wartung Pumpe",
    statement: "…",
    type: "best_practice",
    category: "K",
    author: "Anna",
    tags: ["wartung"],
    sourceScope: "SPACE-K",
    updatedAt: "2020-01-01T00:00:00.000Z",
    bodyHtml: '<p><img src="/api/objects/x/raw"></p>',
  },
  {
    title: "Fehlercode E5",
    statement: "…",
    type: "best_practice",
    category: "K",
    author: "Bob",
    tags: ["fehler"],
    sourceScope: "SPACE-K",
    updatedAt: "2024-06-01T00:00:00.000Z",
  },
];

describe("IC-3: POST /api/admin/import/confluence/select", () => {
  it("Klick-Kriterien → gefilterte Vorschau; erzeugt KEINE Kandidaten (read-only)", async () => {
    const { app, services, headers } = await selectApp(() => fixtureAdapter(ITEMS));
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: { criteria: { themes: ["wartung"] } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matched).toBe(1);
    expect(body.limited).toBe(false);
    expect(body.criteria).toEqual({ themes: ["wartung"] });
    expect(body.preview).toHaveLength(1);
    expect(body.preview[0]).toMatchObject({
      title: "Wartung Pumpe",
      author: "Anna",
      hasImage: true,
    });
    // READ-ONLY: keine Kandidaten geschrieben.
    expect(await services.library.listImportCandidates()).toEqual([]);
  });

  it("ohne Prompt/Kriterien → alles, mit truncated-Durchreichung", async () => {
    const { app, headers } = await selectApp(() => fixtureAdapter(ITEMS, true));
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().matched).toBe(2);
    expect(res.json().truncated).toBe(true);
    expect(res.json().criteria).toEqual({});
  });

  it("Prompt ohne aktives Modell (deterministisch) → leere KI-Kriterien, nur Klick greift", async () => {
    const { app, headers } = await selectApp(() => fixtureAdapter(ITEMS));
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {
        prompt: "alles zu Wartung",
        // WP-VIP2-GATE-2 (bens Fix 1): die Pflicht-Einstufung reist immer mit.
        promptConfidential: false,
        criteria: { limit: 5 },
      },
    });
    expect(res.statusCode).toBe(200);
    // Kein Modell → prompt liefert nichts; nur die (sanitisierte) Klick-Limit-Kriterie zählt.
    expect(res.json().criteria).toEqual({ limit: 5 });
    expect(res.json().matched).toBe(2);
  });

  it("Flag aus / kein Adapter → 503 IMPORT_UNAVAILABLE", async () => {
    const { app, headers } = await selectApp(() => undefined);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("IMPORT_UNAVAILABLE");
  });

  it("ohne Admin-Session → 401, keine Kandidaten", async () => {
    const { app, services } = await selectApp(() => fixtureAdapter(ITEMS));
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(await services.library.listImportCandidates()).toEqual([]);
  });

  it("Adapter-Reject → 502 SELECT_FAILED, genau EINE Antwort, keine unhandled rejection", async () => {
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
            reasoner: services.reasoner,
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
          url: "/api/admin/import/confluence/select",
          headers: { authorization: `Bearer ${login.json().token}` },
          payload: { criteria: { themes: ["x"] } },
        });
        expect(res.statusCode).toBe(502);
        expect(res.json()).toEqual({
          error: "SELECT_FAILED",
          message: "Confluence-Auswahl fehlgeschlagen.",
        });
      });
      expect(rejections).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
