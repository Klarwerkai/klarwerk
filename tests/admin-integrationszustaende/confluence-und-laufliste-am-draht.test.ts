// ================================================================================================
// ADMIN-02 · NACHARBEIT 2 — CONFLUENCE AM GEMEINSAMEN MODELL UND DIE IMPORTLISTE, AM ECHTEN WEG.
// ================================================================================================
//
// Echt sind: `buildApp`, `ImportAccessService`, der Confluence-Adapter samt REST-Client, das
// Prüfprotokoll, die auflistbare Laufablage und die Journalablage samt Neustart. Attrappe ist allein
// die Gegenstelle — `globalThis.fetch` antwortet wie Confluence für einen FIKTIVEN Bereich. Kein
// Aufruf verlässt den Prozess.
//
//   C0  ausgeschaltet         Schalter aus                     → kein Abruf
//   C1  fehlende Angaben      Schalter an, Token fehlt         → kein Abruf
//   C2  abgewiesener Zugang   Confluence antwortet 401          → „anmeldung-abgewiesen"
//   C3  Erfolg                Confluence antwortet 200          → „erreichbar"; Neustart behält ihn
//   L1  Importliste           drei fiktive Läufe, jüngster zuerst; Neustart behält sie
//   L2  ohne Anmeldung        401 für Test und Liste
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import { CONFLUENCE_VERBINDUNGSTEST_AKTION } from "../../services/app/src/services/import-access-service";
import type { ImportRun } from "../../services/library-analytics";

const CONF = "https://confluence.fiktiv.test/wiki";
const FIKTIVES_MERKMAL = "fiktiv-confluence-merkmal-admin02-nur-im-test";
const ADMIN = { name: "Admin ADMIN02 N2", email: "admin-n2@example.com", password: "geheim-1234" };

const VARIABLEN = [
  "KLARWERK_SKIP_KEYCHAIN",
  "KLARWERK_CONFLUENCE_IMPORT",
  "KLARWERK_CONFLUENCE_BASE_URL",
  "KLARWERK_CONFLUENCE_USER",
  "KLARWERK_CONFLUENCE_TOKEN",
  "KLARWERK_CONFLUENCE_SPACE",
  "KLARWERK_CONFLUENCE_AUTH",
];
const VORHER: Record<string, string | undefined> = {};

let antwort: { status: number; body: unknown } = { status: 200, body: { results: [] } };
const rufe: string[] = [];
const fremde: string[] = [];
const echtesFetch = globalThis.fetch;

beforeAll(() => {
  for (const v of VARIABLEN) {
    VORHER[v] = process.env[v];
  }
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  globalThis.fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    if (!url.startsWith(`${CONF}/`)) {
      fremde.push(url);
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    rufe.push(url);
    return new Response(JSON.stringify(antwort.body), { status: antwort.status });
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = echtesFetch;
  for (const v of VARIABLEN) {
    if (VORHER[v] === undefined) {
      delete process.env[v];
    } else {
      process.env[v] = VORHER[v];
    }
  }
});

function umgebung(stand: { schalter: boolean; token: boolean }): void {
  process.env.KLARWERK_CONFLUENCE_IMPORT = stand.schalter ? "1" : "";
  process.env.KLARWERK_CONFLUENCE_BASE_URL = CONF;
  process.env.KLARWERK_CONFLUENCE_USER = "fiktiv@example.com";
  process.env.KLARWERK_CONFLUENCE_SPACE = "FIKTIV";
  delete process.env.KLARWERK_CONFLUENCE_AUTH;
  if (stand.token) {
    process.env.KLARWERK_CONFLUENCE_TOKEN = FIKTIVES_MERKMAL;
  } else {
    delete process.env.KLARWERK_CONFLUENCE_TOKEN;
  }
}

async function appAus(journal: string) {
  const services = await buildDevPersistServices(journal);
  const app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, "der Admin muss ein Token bekommen").not.toBe("");
  return { app, services, headers: { authorization: `Bearer ${token}` } };
}

type App = Awaited<ReturnType<typeof appAus>>;

async function zugang(a: App): Promise<Record<string, unknown>> {
  const res = await a.app.inject({
    method: "GET",
    url: "/api/import/confluence/zugang",
    headers: a.headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Record<string, unknown>;
}

async function teste(a: App): Promise<{ body: string; nachweis: Record<string, unknown> }> {
  const res = await a.app.inject({
    method: "POST",
    url: "/api/import/confluence/verbindungstest",
    headers: a.headers,
    payload: {},
  });
  expect(res.statusCode, res.body).toBe(200);
  return { body: res.body, nachweis: res.json() as Record<string, unknown> };
}

const neuesJournal = (): string => join(mkdtempSync(join(tmpdir(), "kw-admin02-n2-")), "j.jsonl");

/** Ein FIKTIVER Lauf in der kanonischen Form. */
function lauf(importId: string, status: string, startedAt: string, extra: Partial<ImportRun> = {}) {
  const run: ImportRun = {
    importId,
    sourceSystem: "confluence",
    externalId: null,
    sourceScope: "space:FIKTIV",
    requestedSourceVersion: null,
    status: status as ImportRun["status"],
    sourceRecordId: null,
    startedAt,
    completedAt: null,
    failureCode: null,
    failureReason: null,
    counters: { itemsTotal: 3, itemsCreated: 0, itemsBound: 0, itemsSkipped: 0, itemsFailed: 0 },
    ...extra,
  };
  return run;
}

describe("ADMIN-02 N2 · Confluence-Verbindungstest am Draht", () => {
  it("C0 · ausgeschaltet: „ausgeschaltet“, Umfang Konfiguration, KEIN Abruf", async () => {
    umgebung({ schalter: false, token: true });
    const a = await appAus(neuesJournal());
    const vorher = rufe.length;
    expect(await zugang(a)).toMatchObject({ enabled: false, letzterVerbindungstest: null });
    const { nachweis } = await teste(a);
    expect(nachweis).toMatchObject({
      umfang: "konfiguration",
      ergebnis: "ausgeschaltet",
      dauerMs: null,
    });
    expect(rufe.length).toBe(vorher);
    await a.app.close();
  });

  it("C1 · fehlende Angaben: „nicht-eingerichtet“, KEIN Abruf", async () => {
    umgebung({ schalter: true, token: false });
    const a = await appAus(neuesJournal());
    const vorher = rufe.length;
    expect(await zugang(a)).toMatchObject({ enabled: true, credentialsUsable: false });
    const { nachweis } = await teste(a);
    expect(nachweis).toMatchObject({ umfang: "konfiguration", ergebnis: "nicht-eingerichtet" });
    expect(rufe.length).toBe(vorher);
    await a.app.close();
  });

  it("C2 · abgewiesener Zugang (401): „anmeldung-abgewiesen“, ein Abruf ohne Inhalt, kein Merkmal", async () => {
    umgebung({ schalter: true, token: true });
    const a = await appAus(neuesJournal());
    antwort = { status: 401, body: { message: "Unauthorized" } };
    const vorher = rufe.length;
    const { body, nachweis } = await teste(a);
    expect(rufe.length - vorher, "genau EIN lesender Abruf").toBe(1);
    const url = rufe[rufe.length - 1] ?? "";
    expect(url).toContain("/rest/api/content?");
    expect(url).toContain("limit=1");
    expect(url, "kein Seiteninhalt angefordert").not.toContain("expand=");
    expect(nachweis).toMatchObject({ umfang: "space-lesen", ergebnis: "anmeldung-abgewiesen" });
    expect(body).not.toContain(FIKTIVES_MERKMAL);
    expect((await zugang(a)).letzterVerbindungstest).toEqual(nachweis);
    const protokoll = await a.services.audit.list({ action: CONFLUENCE_VERBINDUNGSTEST_AKTION });
    expect(protokoll).toHaveLength(1);
    expect(JSON.stringify(protokoll)).not.toContain(FIKTIVES_MERKMAL);
    await a.app.close();
  });

  it("C3 · Erfolg (200): „erreichbar“ — kein Kandidat, kein Importerfolg; Neustart behält den Nachweis", async () => {
    umgebung({ schalter: true, token: true });
    const journal = neuesJournal();
    const a = await appAus(journal);
    const kandidaten = async (x: App) =>
      (
        await x.app.inject({
          method: "GET",
          url: "/api/library/import/candidates",
          headers: x.headers,
        })
      ).json() as unknown[];
    const vorher = await kandidaten(a);
    antwort = { status: 200, body: { results: [{ id: "4711" }], _links: {} } };
    const { nachweis } = await teste(a);
    expect(nachweis).toMatchObject({ umfang: "space-lesen", ergebnis: "erreichbar" });
    expect(await kandidaten(a)).toEqual(vorher);
    const auskunft = await zugang(a);
    expect(auskunft.lastConnectedAt, "ein Test ist kein erfolgreicher Import").toBeNull();
    expect(auskunft.letzterVerbindungstest).toEqual(nachweis);
    await a.app.close();
    const b = await appAus(journal);
    expect((await zugang(b)).letzterVerbindungstest).toEqual(nachweis);
    await b.app.close();
  });

  it("C4 · SharePoint- und Confluence-Nachweis mischen sich nicht", async () => {
    umgebung({ schalter: true, token: true });
    const a = await appAus(neuesJournal());
    antwort = { status: 200, body: { results: [] } };
    await teste(a);
    const sp = await a.app.inject({
      method: "GET",
      url: "/api/import/sharepoint/zugang",
      headers: a.headers,
    });
    expect((sp.json() as { letzterVerbindungstest: unknown }).letzterVerbindungstest).toBeNull();
    await a.app.close();
  });
});

describe("ADMIN-02 N2 · Importliste am Draht", () => {
  it("L1 · jüngster Lauf zuerst, Zonenversatz richtig geordnet, Felder des Einzelwegs; Neustart behält die Liste", async () => {
    umgebung({ schalter: false, token: false });
    const journal = neuesJournal();
    const a = await appAus(journal);
    await a.services.importRuns.insertIfAbsent(
      lauf("lauf-alt", "COMPLETED", "2026-10-08T09:00:00.000Z", {
        completedAt: "2026-10-08T09:05:00.000Z",
        counters: {
          itemsTotal: 3,
          itemsCreated: 3,
          itemsBound: 0,
          itemsSkipped: 0,
          itemsFailed: 0,
        },
      }),
    );
    // 11:30+02:00 = 09:30Z — textuell „größer" als 10:00Z, zeitlich aber früher.
    await a.services.importRuns.insertIfAbsent(
      lauf("lauf-zone", "FAILED", "2026-10-09T11:30:00+02:00", {
        sourceSystem: "sharepoint",
        sourceScope: "drive:b!fiktiv",
        completedAt: "2026-10-09T11:31:00+02:00",
        failureCode: "SHAREPOINT_FORBIDDEN",
        failureReason: "Keine Leseberechtigung für diese SharePoint-Quelle.",
      }),
    );
    await a.services.importRuns.insertIfAbsent(
      lauf("lauf-neu", "QUEUED", "2026-10-09T10:00:00.000Z"),
    );
    const lies = async (x: App, query = "") => {
      const res = await x.app.inject({
        method: "GET",
        url: `/api/admin/import/runs${query}`,
        headers: x.headers,
      });
      expect(res.statusCode, res.body).toBe(200);
      return res.json() as {
        verfuegbar: boolean;
        ausloeserFestgehalten: boolean;
        runs: { importId: string; status: string; failureCode: string | null }[];
      };
    };
    const liste = await lies(a);
    expect(liste.verfuegbar).toBe(true);
    expect(liste.ausloeserFestgehalten, "der Lauf hält keine Person fest — das wird gesagt").toBe(
      false,
    );
    expect(liste.runs.map((r) => r.importId)).toEqual(["lauf-neu", "lauf-zone", "lauf-alt"]);
    const einzeln = await a.app.inject({
      method: "GET",
      url: "/api/admin/import/runs/lauf-zone",
      headers: a.headers,
    });
    expect(liste.runs[1], "dieselbe Laufform wie der Einzelweg").toEqual(einzeln.json());
    expect((await lies(a, "?limit=1")).runs.map((r) => r.importId)).toEqual(["lauf-neu"]);
    await a.app.close();

    const b = await appAus(journal);
    expect((await lies(b)).runs.map((r) => r.importId)).toEqual([
      "lauf-neu",
      "lauf-zone",
      "lauf-alt",
    ]);
    await b.app.close();
  });

  it("L2 · ohne Anmeldung: 401 für Liste und Test — und kein Abruf", async () => {
    umgebung({ schalter: true, token: true });
    const a = await appAus(neuesJournal());
    const vorher = rufe.length;
    const liste = await a.app.inject({ method: "GET", url: "/api/admin/import/runs" });
    const test = await a.app.inject({
      method: "POST",
      url: "/api/import/confluence/verbindungstest",
      payload: {},
    });
    expect([liste.statusCode, test.statusCode]).toEqual([401, 401]);
    expect(rufe.length).toBe(vorher);
    await a.app.close();
  });

  it("L3 · kein Aufruf hat den Prozess verlassen", () => {
    expect(fremde).toEqual([]);
  });
});
