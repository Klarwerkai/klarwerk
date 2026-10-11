// ==================================================================================================
// R-0163 · BEN, NACHARBEIT 7 — DER UNVOLLSTÄNDIGE ANHANGSABGLEICH, DAUERHAFT IN POSTGRESQL.
// ==================================================================================================
//
// N3 (`confluence-anhaenge-uebernahme.test.ts`) prüft PARTIAL, SOURCE_SYNC_INCOMPLETE und den
// Fehlerzähler an der Speicherablage der Läufe. Dieser Fall führt DENSELBEN regulären Ablauf gegen
// die echte Laufablage aus: erster Import und Annahme, dann ein zweiter Lauf über die Importroute,
// in dem die neue Anhangsversion an einem injizierten Speicherfehler scheitert. Gelesen wird der Lauf
// danach über eine FRISCHE `PgImportRunRepo`-Instanz — sie hält keinen Zustand; was sie sieht, steht
// wirklich in der Datenbank (dieselbe Neustart-Aussage wie P5 in repo-pg.integration.test.ts).
//
// WARUM HIER UND NICHT IN `services/library-analytics/src/repo-pg.integration.test.ts`: der Fall
// braucht Importroute (`services/app`) und Confluence-Adapter (`services/confluence/src/adapter`).
// Aus `services/library-analytics` heraus wäre beides ein Griff über die Modulgrenze
// (.dependency-cruiser.cjs, `module-boundaries`) und — weil `services/app` von library-analytics
// abhängt — ein Zyklus (`no-circular`). `tests/` liegt außerhalb dieser Regeln; Pool-Aufbau und
// Sicherung sind wörtlich dieselben wie dort (guardedLocalPgTestUrl, sonst Testcontainers, sonst
// ehrlich übersprungen — nie gefälscht).
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { confluenceAnhangsUebernahme } from "../../services/app/src/confluence-anhaenge";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import { makeGuards } from "../../services/app/src/http";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  InMemoryKoRepo,
  InMemoryUploadLimitsRepo,
  KoService,
} from "../../services/knowledge-object";
import {
  IMPORT_RUN_SCHEMA,
  LibraryService,
  PgImportRunRepo,
} from "../../services/library-analytics";
import { InMemoryObjectRepo, ObjectStore } from "../../services/object-store";
import { adapterFromConfig } from "../support/confluence-adapter";

const BASIS = "https://acme.atlassian.net/wiki";
const PNG_V1 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_V2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b]);

const SEITE: ConfluencePage = {
  id: "3001",
  title: "Pumpenwartung",
  body: { storage: { value: "<p>Siehe Plan.</p>" } },
  version: { number: 1 },
  _links: { webui: "/spaces/K/pages/3001/Pumpenwartung" },
};

const A1 = (version: number, datei: string) => ({
  id: "a1",
  title: "plan.png",
  extensions: { mediaType: "image/png", fileSize: 8 },
  version: { number: version },
  _links: { download: `/download/attachments/3001/${datei}?version=${version}&api=v2` },
});

function antwort(status: number, body: unknown, bytes?: Buffer): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    arrayBuffer: async () => {
      const b = bytes ?? Buffer.alloc(0);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
  } as unknown as Response;
}

describe("R-0163 · unvollständiger Anhangsabgleich, gespeichert in PostgreSQL (Nacharbeit 7)", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
      } catch {
        process.stderr.write(
          "[KLARWERK] Anhangs-Laufstatus-Pg ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
      }
      return;
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      return; // URL abgelehnt (Grund auf stderr) → kein Testcontainers-Fallback
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        // Testname nach `tests/app/job2354-drei-datenbanknamen.test.ts` (E7), nicht frei gewählt.
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
    } catch {
      available = false; // kein Docker/PG → ehrlich übersprungen, nicht gefälscht
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it("PG-N3 · Speicherfehler beim geänderten Anhang → frisch gelesener Lauf: PARTIAL, SOURCE_SYNC_INCOMPLETE, Grund, itemsFailed", async (ctx) => {
    if (!available || !pool) {
      ctx.skip();
      return;
    }
    await pool.query("DROP TABLE IF EXISTS import_run_item_refs");
    await pool.query("DROP TABLE IF EXISTS import_runs");
    await pool.query(IMPORT_RUN_SCHEMA);

    // Die Quelle: eine Seite mit einem Bild, das gleich eine neue Version bekommt.
    const zustand: { anhaenge: unknown[] } = { anhaenge: [A1(1, "plan.png")] };
    const fetchFn = async (eingabe: string | URL | Request): Promise<Response> => {
      const url = new URL(String(eingabe));
      if (url.pathname === "/wiki/rest/api/content/3001/child/attachment") {
        return antwort(200, { results: zustand.anhaenge });
      }
      if (url.pathname === "/wiki/download/attachments/3001/plan.png") {
        return antwort(200, null, PNG_V1);
      }
      if (url.pathname === "/wiki/download/attachments/3001/plan-v2.png") {
        return antwort(200, null, PNG_V2);
      }
      if (url.pathname === "/wiki/rest/api/content" && url.searchParams.get("spaceKey") === "K") {
        return antwort(200, { results: [SEITE] });
      }
      return antwort(404, null);
    };
    const adapter = adapterFromConfig({
      baseUrl: BASIS,
      email: "svc@acme.example",
      apiToken: "read-only-tok-123",
      spaceKey: "K",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const objects = new ObjectStore({ repo: new InMemoryObjectRepo() });
    const stoerung = { an: false };
    const library = new LibraryService({
      koService,
      externalUpsert: true,
      anhaenge: confluenceAnhangsUebernahme({
        ko: koService,
        objects: {
          put: async (eingabe) => {
            if (stoerung.an) {
              throw new Error("BEN_INJECTED_STORAGE_FAILURE");
            }
            return objects.put(eingabe);
          },
        },
        uploadLimits: new InMemoryUploadLimitsRepo(),
        makeAdapter: () => adapter,
      }),
    });

    // Erster regulärer Import samt Annahme.
    await runConfluenceImport({ adapter, library, koService, dryRun: false, actor: "admin" });
    const [kandidat] = await library.listImportCandidates();
    const ergebnis = await library.reviewImportCandidate(kandidat!.id, "accept", "reviewerin");
    const ko = await koService.get(ergebnis.koId!);
    expect(ko?.attachments).toHaveLength(1);
    const objektVorher = ko!.attachments[0]!.objectId;

    // Neue Anhangsversion + Speicherfehler; der Lauf geht über die echte Route mit PG-Laufablage.
    zustand.anhaenge = [A1(2, "plan-v2.png")];
    stoerung.an = true;
    const gesichert = process.env.KLARWERK_CONFLUENCE_IMPORT;
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const services = buildServices();
    const app = buildApp(services);
    if (gesichert !== undefined) {
      process.env.KLARWERK_CONFLUENCE_IMPORT = gesichert;
    }
    const schreibendeAblage = new PgImportRunRepo(pool);
    app.register(
      confluenceImportRoutes({
        library,
        koService,
        guards: makeGuards(services.auth),
        reasoner: services.reasoner,
        makeAdapter: () => adapter,
        importRuns: schreibendeAblage,
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
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers: { authorization: `Bearer ${login.json().token}` },
      payload: { dryRun: false },
    });
    expect(start.statusCode).toBe(202);
    await warteAufOffeneImportLaeufe(schreibendeAblage);
    await app.close();

    // Frische Instanz auf derselben Datenbank — kein Zustand aus dem Lauf.
    const nachNeustart = new PgImportRunRepo(pool);
    const lauf = await nachNeustart.findById(start.json().importId);
    expect(lauf?.status).toBe("PARTIAL");
    expect(lauf?.failureCode).toBe("SOURCE_SYNC_INCOMPLETE");
    expect(lauf?.failureReason).toContain("Anhangsabgleich unvollständig für 1 Seite(n)");
    expect(lauf?.failureReason).toContain("vorhandene Anhänge bleiben erhalten");
    expect(lauf?.counters.itemsFailed).toBe(1);
    expect(lauf?.completedAt).toBeTruthy();

    // Und der Altbestand ist tatsächlich erhalten.
    const danach = await koService.get(ko!.id);
    expect(danach?.attachments[0]?.objectId).toBe(objektVorher);
    expect(danach?.attachments[0]?.quelle?.sourceVersion).toBe(1);
  });
});
