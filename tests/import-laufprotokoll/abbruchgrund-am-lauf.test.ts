// ================================================================================================
// R-0144 — REICHT ZEIT ODER DATENVOLUMEN NICHT, NENNT DER GESPEICHERTE LAUF DEN GRUND.
// ================================================================================================
//
// Der Gesamtlauf (`POST /api/admin/import/confluence`) trug den Grund eines Leseabbruchs schon
// (`CONFLUENCE_TIMEOUT` / `_BUDGET` / `_RESPONSE_TOO_LARGE`, R-0159). Die zwei Übernahmewege nicht:
// - Confluence `/apply`: scheiterte der Einzelabruf einer Seite an Frist oder Grösse, endete der
//   Lauf `PARTIAL` mit `failureCode: null` — der Grund stand nur als Fehlerklasse in der Antwort.
// - SharePoint `/apply`: eine Datei über der Inhaltskante machte den Lauf `PARTIAL`, der Grund stand
//   nur in `ohneInhalt` der Antwort.
// Wer den Lauf später las, erfuhr in beiden Fällen nicht, dass Zeit oder Volumen nicht gereicht
// hatten. Gemessen wird deshalb am GESPEICHERTEN Lauf, über den echten Leseweg
// `GET /api/admin/import/runs/:importId` — nicht an der Antwort des Übernahmeaufrufs.
//
// Attrappe sind nur die Quell-Adapter (Netzgrenze). App, Routen, Rechteprüfung, Import-Kern und
// Laufablage sind die echten.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import { sharepointImportRoutes } from "../../services/app/src/routes/sharepoint-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem, ImportRun } from "../../services/library-analytics";
import type { SharePointSourceAdapter } from "../../services/sharepoint";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

/** Ein Fehler, wie ihn der Confluence-Client an einer Grenze wirft: erkannt wird er am Code. */
function grenzfehler(code: string, meldung: string): Error {
  return Object.assign(new Error(meldung), { code });
}

function seite(title: string, externalId: string): ImportItem {
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

function datei(name: string, externalId: string): ImportItem {
  return {
    title: name,
    statement: name,
    type: "best_practice",
    category: "SharePoint",
    provider: "SharePoint",
    externalId,
    textCodec: "decoded",
  } as ImportItem;
}

/** Der Confluence-Adapter: der Snapshot kennt alle Seiten, der Einzelabruf scheitert nach Plan. */
function confluenceAdapter(
  items: ImportItem[],
  fehlerJeSeite: Record<string, Error>,
): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed: [], truncated: false }),
    fetchItem: async (externalId: string) => {
      const fehler = fehlerJeSeite[externalId];
      if (fehler) {
        throw fehler;
      }
      return items.find((i) => i.externalId === externalId);
    },
  } as unknown as ConfluenceSourceAdapter;
}

/** Der SharePoint-Adapter: je Kennung der gemessene Inhaltsbefund. */
function sharepointAdapter(befunde: Record<string, string>): SharePointSourceAdapter {
  return {
    driveId: "b!testbibliothek",
    holeItem: async (externalId: string) => {
      const art = befunde[externalId];
      return art === undefined
        ? undefined
        : { item: datei(`${externalId}.txt`, externalId), inhalt: { art } };
    },
  } as unknown as SharePointSourceAdapter;
}

async function app(opts: {
  confluence?: ConfluenceSourceAdapter;
  sharepoint?: SharePointSourceAdapter;
}) {
  const services = buildServices();
  const a = buildApp(services);
  const guards = makeGuards(services.auth);
  const { confluence, sharepoint } = opts;
  if (confluence) {
    a.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards,
        reasoner: services.reasoner,
        makeAdapter: () => confluence,
        importRuns: services.importRuns,
      }),
    );
  }
  if (sharepoint) {
    a.register(
      sharepointImportRoutes({
        library: services.library,
        guards,
        importRuns: services.importRuns,
        makeAdapter: () => sharepoint,
      }),
    );
  }
  a.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
      guards,
    }),
  );
  await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@r0144.test", password: "secret123" },
  });
  const login = await a.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@r0144.test", password: "secret123" },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  return { app: a, headers: { authorization: `Bearer ${token}` } };
}

type Umgebung = Awaited<ReturnType<typeof app>>;

async function uebernehmen(
  u: Umgebung,
  url: string,
  payload: Record<string, unknown>,
): Promise<{ importId?: string; failed?: { id: string }[] }> {
  const res = await u.app.inject({ method: "POST", url, headers: u.headers, payload });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { importId?: string; failed?: { id: string }[] };
}

async function gespeicherterLauf(u: Umgebung, importId: string | undefined): Promise<ImportRun> {
  expect(importId, "die Übernahme nennt keine Lauf-Kennung").toBeTruthy();
  const res = await u.app.inject({
    method: "GET",
    url: `/api/admin/import/runs/${importId}`,
    headers: u.headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as ImportRun;
}

describe("R-0144 · Confluence-Selektivimport: der Grenzgrund steht am gespeicherten Lauf", () => {
  it("C1 · Zeitüberschreitung und zu große Antwort: PARTIAL, Code der ersten Grenze, Zahlen je Grund", async () => {
    const items = [seite("A", "p1"), seite("B", "p2"), seite("C", "p3")];
    const u = await app({
      confluence: confluenceAdapter(items, {
        p2: grenzfehler("CONFLUENCE_TIMEOUT", "Confluence hat nicht rechtzeitig geantwortet."),
        p3: grenzfehler("CONFLUENCE_RESPONSE_TOO_LARGE", "Antwort von Confluence zu groß."),
      }),
    });
    const bilanz = await uebernehmen(u, "/api/admin/import/confluence/apply", {
      criteria: {},
      includeIds: ["p1", "p2", "p3"],
    });
    const lauf = await gespeicherterLauf(u, bilanz.importId);
    expect({
      status: lauf.status,
      failureCode: lauf.failureCode,
      failureReason: lauf.failureReason,
      itemsFailed: lauf.counters.itemsFailed,
      itemsCreated: lauf.counters.itemsCreated,
      // Die Antwort des Aufrufs bleibt, wie sie war.
      antwortGescheitert: (bilanz.failed ?? []).map((f) => f.id),
    }).toEqual({
      status: "PARTIAL",
      failureCode: "CONFLUENCE_TIMEOUT",
      failureReason:
        "1 Seite(n) wegen Zeitüberschreitung, 1 Seite(n) wegen zu großer Antwort nicht übernommen.",
      itemsFailed: 2,
      itemsCreated: 1,
      antwortGescheitert: ["p2", "p3"],
    });
  });

  it("C2 · ein anderer Fehler ist keine Grenze: PARTIAL bleibt ohne erfundenen Grund", async () => {
    const u = await app({
      confluence: confluenceAdapter([seite("A", "p1"), seite("B", "p2")], {
        p2: new Error("Quelle meldet etwas Unbekanntes"),
      }),
    });
    const bilanz = await uebernehmen(u, "/api/admin/import/confluence/apply", {
      criteria: {},
      includeIds: ["p1", "p2"],
    });
    const lauf = await gespeicherterLauf(u, bilanz.importId);
    expect({
      status: lauf.status,
      failureCode: lauf.failureCode,
      failureReason: lauf.failureReason,
    }).toEqual({ status: "PARTIAL", failureCode: null, failureReason: null });
  });

  it("C3 · ohne Störung: COMPLETED ohne Grund", async () => {
    const u = await app({ confluence: confluenceAdapter([seite("A", "p1")], {}) });
    const bilanz = await uebernehmen(u, "/api/admin/import/confluence/apply", {
      criteria: {},
      includeIds: ["p1"],
    });
    const lauf = await gespeicherterLauf(u, bilanz.importId);
    expect({ status: lauf.status, failureCode: lauf.failureCode }).toEqual({
      status: "COMPLETED",
      failureCode: null,
    });
  });
});

describe("R-0144 · SharePoint-Übernahme: das Datenvolumen reicht nicht — der Lauf sagt es", () => {
  it("S1 · eine Datei über der Inhaltskante: PARTIAL mit Code und Anzahl, ohne Dateikennung", async () => {
    const u = await app({
      sharepoint: sharepointAdapter({ ok1: "nur-merkmale", gross1: "zu-gross", leer1: "leer" }),
    });
    const bilanz = await uebernehmen(u, "/api/admin/import/sharepoint/apply", {
      ids: ["ok1", "gross1", "leer1"],
    });
    const lauf = await gespeicherterLauf(u, bilanz.importId);
    expect({
      quellsystem: lauf.sourceSystem,
      status: lauf.status,
      failureCode: lauf.failureCode,
      failureReason: lauf.failureReason,
      itemsFailed: lauf.counters.itemsFailed,
      nenntKeineKennung: !(lauf.failureReason ?? "").includes("gross1"),
    }).toEqual({
      quellsystem: "sharepoint",
      status: "PARTIAL",
      failureCode: "SHAREPOINT_CONTENT_TOO_LARGE",
      failureReason: "1 Datei(en) über der Inhaltsgrenze nicht übernommen.",
      itemsFailed: 2,
      nenntKeineKennung: true,
    });
  });

  it("S2 · nur eine leere Datei: PARTIAL, aber kein Volumengrund — leer ist keine Grenze", async () => {
    const u = await app({ sharepoint: sharepointAdapter({ ok1: "nur-merkmale", leer1: "leer" }) });
    const bilanz = await uebernehmen(u, "/api/admin/import/sharepoint/apply", {
      ids: ["ok1", "leer1"],
    });
    const lauf = await gespeicherterLauf(u, bilanz.importId);
    expect({
      status: lauf.status,
      failureCode: lauf.failureCode,
      failureReason: lauf.failureReason,
    }).toEqual({ status: "PARTIAL", failureCode: null, failureReason: null });
  });
});
