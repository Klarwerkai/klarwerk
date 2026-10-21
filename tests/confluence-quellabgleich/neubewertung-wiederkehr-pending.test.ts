// Genau ein neuer Gegenfall zum unabhängig gefundenen Wiederkehr-/Pending-Fehler auf f862.
// Echte App-Routen und In-Memory-Dienste mit kontrolliertem Confluence-Adapter; kein Provider/PG.
import { afterEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { quellenNeubewertung } from "../../services/app/src/quellen-neubewertung";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import { adapterFromConfig } from "../support/confluence-adapter";

let app: ReturnType<typeof buildApp> | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await app?.close();
  app = undefined;
});

it("W1 · wiedergekehrte Quelle behält den historischen Pending-Nachlauf bis zur tatsächlichen Wiederaufnahme", async () => {
  // Die Fixture registriert ihre kontrollierten Import-Routen selbst; keine echten Adapter.
  vi.stubEnv("KLARWERK_CONFLUENCE_IMPORT", "0");
  vi.stubEnv("KLARWERK_SHAREPOINT_IMPORT", "0");
  vi.stubEnv("KLARWERK_JIRA_IMPORT", "0");
  const services = assembleServices(inMemoryRepos());
  services.aiCheckWorker = {
    enqueue: vi.fn(),
    has: () => false,
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => {},
  };
  app = buildApp(services);
  const adapter = adapterFromConfig({
    baseUrl: "https://fixture.atlassian.net/wiki",
    email: "fixture@example.invalid",
    apiToken: "fixture",
    spaceKey: "K",
    fetchFn: (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const page = {
        id: "P-RETURN",
        title: "Wiedergekehrte Seite",
        version: { number: 1 },
        body: { storage: { value: "<p>Die Quelle ist wieder erreichbar.</p>" } },
        _links: { webui: "/spaces/K/pages/P-RETURN" },
        restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
      };
      const body = /\/child\/attachment$/.test(url.pathname)
        ? { results: [] }
        : /\/rest\/api\/content\/P-RETURN$/.test(url.pathname)
          ? page
          : { results: [page] };
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as typeof fetch,
  });
  const guards = makeGuards(services.auth);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards,
      makeAdapter: () => adapter,
      importRuns: services.importRuns,
      quellabgleich: services.quellabgleich,
      nachQuellwegfall: async (koId, sourceIds, actor) => {
        await quellenNeubewertung(services, koId, actor, "quelle_entfernt", sourceIds);
      },
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
  const identity = {
    name: "Prüfperson",
    email: "wiederkehr@fixture.example",
    password: "fixture-pass-123",
  };
  expect(
    (await app.inject({ method: "POST", url: "/api/auth/register", payload: identity })).statusCode,
  ).toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: identity });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };

  // Herkunftsanker der kontrollierten Fixture; der historische Lösch-/Pending-Zustand wird
  // anschließend über den echten CAS-Dienst geschrieben, nicht rückwirkend erfunden.
  const item = await services.ko.create({
    title: "Gebundene Regel",
    statement: "Die alte Entscheidung bleibt nachvollziehbar.",
    type: "best_practice",
    category: "Anlage",
    author: "fixture",
    sources: [
      {
        id: "anker-return",
        label: "Quellseite",
        url: null,
        excerpt: null,
        kind: "external",
        peerValidated: false,
        author: "fixture",
        at: "2026-10-21T00:00:00.000Z",
        provider: "Confluence",
        externalId: "P-RETURN",
        spaceKey: "K",
        sourceVersion: 1,
      },
    ],
  });
  const other = await services.ko.create({
    title: "Gegenstelle",
    statement: "Andere Anwendungsbedingung.",
    type: "best_practice",
    category: "Anlage",
    author: "fixture",
  });
  const conflict = await services.conflicts.create(
    {
      koA: item.id,
      koB: other.id,
      type: "context",
      description: "Geltungsbedingungen klären.",
    },
    "fixture",
  );
  await services.conflicts.resolve(
    conflict.id,
    "fixture",
    "Die dokumentierte Entscheidung gilt für die damalige Grundlage.",
  );
  const removedAt = "2026-10-21T01:00:00.000Z";
  await services.ko.markSourceRemoved(
    item.id,
    { provider: "Confluence", externalId: "P-RETURN" },
    removedAt,
    "fixture",
    true,
  );
  const run = async () => {
    if (!app) throw new Error("App-Fixture fehlt");
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    expect(start.statusCode, start.body).toBe(202);
    const importId = start.json().importId as string;
    await warteAufOffeneImportLaeufe(services.importRuns);
    const result = await app.inject({
      method: "GET",
      url: `/api/admin/import/runs/${importId}`,
      headers,
    });
    expect(result.statusCode, result.body).toBe(200);
    return result.json();
  };

  const review = vi
    .spyOn(services.conflicts, "vermerkeNeupruefung")
    .mockRejectedValueOnce(new Error("Nachlauf während der Wiederkehr ausgefallen"));
  const partial = await run();
  expect(partial.status).toBe("PARTIAL");
  expect(partial.failureCode).toBe("SOURCE_SYNC_INCOMPLETE");
  expect(partial.sourceSync).toMatchObject({
    removed: [],
    restored: ["P-RETURN"],
    neubewertungOffen: ["P-RETURN"],
    neubewertungOffenAnzahl: 1,
  });
  const returned = (await services.ko.get(item.id))?.sources.find((s) => s.id === "anker-return");
  expect(returned).not.toHaveProperty("sourceRemovedAt");
  expect(returned).toMatchObject({
    neubewertungOffen: true,
    neubewertungQuellwegfallAm: removedAt,
  });
  expect((await services.conflicts.get(conflict.id))?.neupruefung).toBeUndefined();

  // Zweiter Abruf desselben einen Gegenfalls: die Seite ist bereits zurück, ihr früherer
  // Nachlauf muss dennoch über den nächsten normalen Lauf ausführbar bleiben.
  const completed = await run();
  expect(completed.status).toBe("COMPLETED");
  expect(completed.sourceSync.removed).toEqual([]);
  expect(completed.sourceSync.restored).toEqual([]);
  expect(completed.sourceSync).not.toHaveProperty("neubewertungOffen");
  expect(review).toHaveBeenCalledTimes(2);
  const caughtUp = (await services.ko.get(item.id))?.sources.find((s) => s.id === "anker-return");
  expect(caughtUp).not.toHaveProperty("sourceRemovedAt");
  expect(caughtUp).not.toHaveProperty("neubewertungOffen");
  expect(caughtUp).not.toHaveProperty("neubewertungQuellwegfallAm");
  expect(await services.conflicts.get(conflict.id)).toMatchObject({
    status: "geloest",
    decision: "Die dokumentierte Entscheidung gilt für die damalige Grundlage.",
    neupruefung: [expect.objectContaining({ art: "quelle_entfernt", sourceIds: ["anker-return"] })],
  });
});
