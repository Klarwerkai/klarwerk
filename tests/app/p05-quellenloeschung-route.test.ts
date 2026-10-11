// ================================================================================================
// P05 (Peters Entscheidung 11.10.2026, B-01) — GEWÖHNLICHE QUELLENLÖSCHUNG ÜBER DIE ECHTE ROUTE.
// ================================================================================================
//
// Gemessen über POST /api/admin/import/confluence (asynchroner Lauf) und die dauerhafte Laufablage
// GET /api/admin/import/runs/:id — derselbe Aufbau wie `tests/confluence-quellabgleich/runde3.test.ts`
// N4, hier mit der P05-Erwartung:
//   R1  bestätigte Löschung (404): Lauf COMPLETED, die Seite steht in sourceSync.removed, das
//       Wissensobjekt bleibt mit Inhalt, Fassung und Herkunft erhalten, der Anker trägt den Vermerk,
//       der Papierkorb bleibt leer.
//   R2  Gegenprobe: unklare Einzelantwort (500) → PARTIAL, nichts vermerkt, nichts gelöscht.
// Synthetische Quelle (fetch-Attrappe an der Netzgrenze), In-Memory-Dienste.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { adapterFromConfig } from "../support/confluence-adapter";

function seite(id: string): ConfluencePage {
  return {
    id,
    title: `Seite ${id}`,
    body: { storage: { value: `<p>Inhalt ${id}.</p>` } },
    version: { number: 1 },
    _links: { webui: `/spaces/K/pages/${id}` },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
  };
}

/** Bereichsliste und Einzelabruf je Id; ohne Vorgabe gilt: im Bereich = Seite, sonst 404. */
function quelle() {
  const bereich = new Map<string, ConfluencePage>();
  const einzel = new Map<string, 404 | 500>();
  const antwort = (status: number, body: unknown) =>
    ({ ok: status < 300, status, json: async () => body }) as Response;
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    if (/\/child\/attachment$/.test(url.pathname)) {
      return antwort(200, { results: [] });
    }
    const id = /\/rest\/api\/content\/([^/?]+)$/.exec(url.pathname)?.[1];
    if (id) {
      const vorgabe = einzel.get(decodeURIComponent(id));
      if (vorgabe === 500) {
        return antwort(500, {});
      }
      const page = vorgabe === 404 ? undefined : bereich.get(id);
      return page ? antwort(200, page) : antwort(404, {});
    }
    return antwort(200, { results: [...bereich.values()] });
  }) as unknown as typeof fetch;
  const adapter = adapterFromConfig({
    baseUrl: "https://acme.atlassian.net/wiki",
    email: "svc@acme.example",
    apiToken: "tok",
    spaceKey: "K",
    fetchFn,
  });
  return { adapter, bereich, einzel };
}

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_CONFLUENCE_SPACE"];
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

async function appMit(q: ReturnType<typeof quelle>) {
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const services = buildServices();
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  const app = buildApp(services);
  const guards = makeGuards(services.auth);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards,
      reasoner: services.reasoner,
      makeAdapter: () => q.adapter,
      importRuns: services.importRuns,
      quellabgleich: services.quellabgleich,
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
      quellabgleich: services.quellabgleich,
      guards,
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
  const headers = { authorization: `Bearer ${login.json().token}` };
  const lauf = async () => {
    const { importId } = (
      await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence",
        headers,
        payload: {},
      })
    ).json() as { importId: string };
    await warteAufOffeneImportLaeufe(services.importRuns);
    return (
      await app.inject({ method: "GET", url: `/api/admin/import/runs/${importId}`, headers })
    ).json() as {
      status: string;
      failureCode: string | null;
      sourceSync: { removed: string[]; unchecked: string[] } | null;
    };
  };
  const annehmen = async () => {
    for (const k of await services.library.listImportCandidates()) {
      if (k.status === "neu") {
        await services.library.reviewImportCandidate(k.id, "accept", "admin");
      }
    }
  };
  const traeger = async (externalId: string) =>
    (await services.ko.list()).filter((ko) =>
      (ko.sources ?? []).some((s) => s.externalId === externalId),
    );
  return { app, services, lauf, annehmen, traeger };
}

describe("P05 · gewöhnliche Quellenlöschung über die echte Importroute", () => {
  it("R1 bestätigte Löschung: Lauf COMPLETED, Seite genannt, Kopie mit Herkunft erhalten und vermerkt", async () => {
    const q = quelle();
    q.bereich.set("P-6", seite("P-6"));
    const a = await appMit(q);
    try {
      await a.lauf();
      await a.annehmen();
      const [vorher] = await a.traeger("P-6");
      expect(vorher).toBeDefined();

      q.bereich.delete("P-6");
      const zweiter = await a.lauf();
      expect(zweiter.status).toBe("COMPLETED");
      expect(zweiter.failureCode).toBeNull();
      expect(zweiter.sourceSync?.removed).toEqual(["P-6"]);

      const [nachher] = await a.traeger("P-6");
      expect(nachher?.id).toBe(vorher?.id);
      expect(nachher?.title).toBe(vorher?.title);
      expect(nachher?.statement).toBe(vorher?.statement);
      expect(nachher?.version).toBe(vorher?.version);
      const anker = nachher?.sources?.find((s) => s.externalId === "P-6");
      expect(anker?.spaceKey).toBe("K");
      expect(anker?.sourceVersion).toBe(1);
      expect(typeof anker?.sourceRemovedAt).toBe("string");
      expect(await a.services.ko.trashed()).toHaveLength(0);
    } finally {
      await a.app.close();
    }
  });

  it("R2 Gegenprobe: unklare Einzelantwort (500) → PARTIAL, nichts vermerkt, nichts gelöscht", async () => {
    const q = quelle();
    q.bereich.set("P-7", seite("P-7"));
    const a = await appMit(q);
    try {
      await a.lauf();
      await a.annehmen();
      q.bereich.delete("P-7");
      q.einzel.set("P-7", 500);
      const zweiter = await a.lauf();
      expect(zweiter.status).toBe("PARTIAL");
      expect(zweiter.sourceSync?.unchecked).toEqual(["P-7"]);
      expect(zweiter.sourceSync?.removed).toEqual([]);
      const [nachher] = await a.traeger("P-7");
      const anker = nachher?.sources?.find((s) => s.externalId === "P-7");
      expect(anker).toBeDefined();
      expect(anker?.sourceRemovedAt).toBeUndefined();
      expect(await a.services.ko.trashed()).toHaveLength(0);
    } finally {
      await a.app.close();
    }
  });
});
