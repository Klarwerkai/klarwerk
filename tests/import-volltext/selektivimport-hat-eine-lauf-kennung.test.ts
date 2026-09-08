// ================================================================================================
// JOB 3288 · LIEFERUNG 3 — DER SELEKTIVIMPORT HINTERLAESST EINE SPUR.
// ================================================================================================
//
// DER BEFUND (Codex, 1.188): 36 Seiten ausgewaehlt, 36 eingereiht — und der Kopf der Importseite
// sagte weiter „Ein erfolgreich abgeschlossener Import ist bisher nicht festgehalten." Das war
// keine Anzeigeschwaeche: `/apply` legte NIE einen `ImportRun` an, nur der Gesamtlauf tat das. Ein
// Import ohne Spur ist spaeter nicht nachweisbar (KW-S4-26 §133).
//
// GEPRUEFT WIRD AN DER ECHTEN ABLAGE UND UEBER DIE ECHTEN LESEWEGE:
// `POST /apply` → `GET /api/admin/import/runs/:importId` (Laufdomaene) und
// `GET /api/import/confluence/zugang` (die Zeile im Kopf der Importseite).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem, ImportRun } from "../../services/library-analytics";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

function fixtureAdapter(items: ImportItem[]): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed: [], truncated: false }),
  } as unknown as ConfluenceSourceAdapter;
}

function item(title: string, externalId: string): ImportItem {
  return {
    title,
    statement: "Kernaussage der Seite.",
    type: "best_practice",
    category: "ADV",
    provider: "Confluence",
    externalId,
    bodyHtml: `<p>Kernaussage der Seite.</p><p>Fachtext zu ${title}.</p>`,
    textCodec: "decoded",
  } as ImportItem;
}

async function importApp(items: ImportItem[], opts: { externalUpsert?: boolean } = {}) {
  // WP-SHIP7-FIX (Fix 3), uebernommen aus tests/app/import-group-routes.test.ts: der idempotente
  // Queue-Strang (externalId-Upsert) haengt an dieser ENV und wird NUR von `buildServices` gelesen.
  if (opts.externalUpsert) {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  }
  const services = buildServices();
  if (opts.externalUpsert) {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  }
  const app = buildApp(services);
  const guards = makeGuards(services.auth);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards,
      reasoner: services.reasoner,
      makeAdapter: () => fixtureAdapter(items),
      // Genau die Verdrahtung der Kompositionswurzel (build-app.ts:2190).
      importRuns: services.importRuns,
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
      guards,
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@job3288.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@job3288.test", password: "secret123" },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (cookie) {
    headers.cookie = cookie;
  }
  return { app, services, headers };
}

type ApplyAntwort = {
  imported: number;
  alreadyQueued: number;
  failed: { id: string; reason: string }[];
  notFound: string[];
  importId?: string;
};

async function uebernehmen(
  app: Awaited<ReturnType<typeof importApp>>["app"],
  headers: Record<string, string>,
  includeIds: string[],
): Promise<ApplyAntwort> {
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/import/confluence/apply",
    headers,
    payload: { criteria: {}, includeIds },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as ApplyAntwort;
}

async function lauf(
  app: Awaited<ReturnType<typeof importApp>>["app"],
  headers: Record<string, string>,
  importId: string,
): Promise<ImportRun> {
  const res = await app.inject({
    method: "GET",
    url: `/api/admin/import/runs/${importId}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as ImportRun;
}

describe("JOB 3288 · der Selektivimport erzeugt einen lesbaren Lauf", () => {
  it("L1 · die Übernahme antwortet mit einer Lauf-Kennung, und der Lauf ist unter ihr lesbar", async () => {
    const { app, headers } = await importApp([item("Netzentgelte", "p1"), item("Messung", "p2")]);
    const vorher = new Date().toISOString();
    const bilanz = await uebernehmen(app, headers, ["p1", "p2"]);
    expect(bilanz.importId, "die Übernahme nennt keine Lauf-Kennung").toBeTruthy();
    const l = await lauf(app, headers, bilanz.importId as string);
    expect({
      quellsystem: l.sourceSystem,
      status: l.status,
      zaehler: l.counters,
      startetVorAbschluss: l.startedAt >= vorher && (l.completedAt ?? "") >= l.startedAt,
    }).toEqual({
      quellsystem: "confluence",
      status: "COMPLETED",
      zaehler: {
        itemsTotal: 2,
        itemsCreated: 2,
        itemsBound: 0,
        itemsSkipped: 0,
        itemsFailed: 0,
      },
      startetVorAbschluss: true,
    });
  });

  it("L2 · gescheiterte und nicht gefundene Ids machen den Lauf PARTIAL — und die Summe der Zähler bleibt der Auftrag", async () => {
    const { app, services, headers } = await importApp([item("A", "p1"), item("B", "p2")]);
    const original = services.library.createImportCandidates.bind(services.library);
    services.library.createImportCandidates = (async (batch, actor) => {
      if (batch[0]?.externalId === "p2") {
        throw new Error("Queue kurzzeitig nicht verfügbar");
      }
      return original(batch, actor);
    }) as typeof services.library.createImportCandidates;

    const bilanz = await uebernehmen(app, headers, ["p1", "p2", "gibt-es-nicht"]);
    const l = await lauf(app, headers, bilanz.importId as string);
    const z = l.counters;
    expect({
      status: l.status,
      zaehler: z,
      // Die vier Ausgaenge sind disjunkt und decken jede beauftragte Id genau einmal ab.
      summeGehtAuf: z.itemsCreated + z.itemsBound + z.itemsSkipped + z.itemsFailed === z.itemsTotal,
      // Der GRUND bleibt in der Antwort unterscheidbar, obwohl der Lauf beides als „failed" zaehlt.
      gruendeGetrennt: { failed: bilanz.failed.map((f) => f.id), notFound: bilanz.notFound },
    }).toEqual({
      status: "PARTIAL",
      zaehler: {
        itemsTotal: 3,
        itemsCreated: 1,
        itemsBound: 0,
        itemsSkipped: 0,
        itemsFailed: 2,
      },
      summeGehtAuf: true,
      gruendeGetrennt: { failed: ["p2"], notFound: ["gibt-es-nicht"] },
    });
  });

  it("L3 · ein zweiter Lauf derselben Auswahl zählt die schon eingereihten Kandidaten als SKIPPED, nicht als neu", async () => {
    const { app, headers } = await importApp([item("A", "p1")], { externalUpsert: true });
    const erste = await uebernehmen(app, headers, ["p1"]);
    const zweite = await uebernehmen(app, headers, ["p1"]);
    const l1 = await lauf(app, headers, erste.importId as string);
    const l2 = await lauf(app, headers, zweite.importId as string);
    expect({
      zweiVerschiedeneLaeufe: l1.importId !== l2.importId,
      ersterAngelegt: l1.counters.itemsCreated,
      zweiterAngelegt: l2.counters.itemsCreated,
      zweiterUebersprungen: l2.counters.itemsSkipped,
      zweiterStatus: l2.status,
    }).toEqual({
      zweiVerschiedeneLaeufe: true,
      ersterAngelegt: 1,
      zweiterAngelegt: 0,
      zweiterUebersprungen: 1,
      zweiterStatus: "COMPLETED",
    });
  });

  it("L4 · DER KOPF DER IMPORTSEITE: nach dem Selektivimport ist der letzte erfolgreiche Import belegt", async () => {
    const { app, headers } = await importApp([item("A", "p1")]);
    const vorher = await app.inject({
      method: "GET",
      url: "/api/import/confluence/zugang",
      headers,
    });
    const bilanz = await uebernehmen(app, headers, ["p1"]);
    const nachher = await app.inject({
      method: "GET",
      url: "/api/import/confluence/zugang",
      headers,
    });
    const l = await lauf(app, headers, bilanz.importId as string);
    expect({
      vorher: (vorher.json() as { lastConnectedAt: string | null }).lastConnectedAt,
      nachher: (nachher.json() as { lastConnectedAt: string | null }).lastConnectedAt,
    }).toEqual({ vorher: null, nachher: l.completedAt });
  });

  it("L5 · ohne Laufablage bleibt alles wie vor 3288 — die Übernahme läuft, nennt aber keine erfundene Kennung", async () => {
    // Bestandstests bauen diese Routen ohne `importRuns`; dieser Zweig darf nichts kaputt machen
    // und vor allem keine Kennung behaupten, hinter der kein Lauf steht.
    const services = buildServices();
    const app = buildApp(services);
    app.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards: makeGuards(services.auth),
        reasoner: services.reasoner,
        makeAdapter: () => fixtureAdapter([item("A", "p1")]),
      }),
    );
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "b@job3288.test", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "b@job3288.test", password: "secret123" },
    });
    const token = (login.json() as { token?: string }).token ?? "";
    const bilanz = await uebernehmen(app, { authorization: `Bearer ${token}` }, ["p1"]);
    expect({
      eingereiht: bilanz.imported,
      kennung: "importId" in bilanz,
      queue: (await services.library.listImportCandidates()).length,
    }).toEqual({ eingereiht: 1, kennung: false, queue: 1 });
  });
});
