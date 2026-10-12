// ================================================================================================
// ADMIN-02 · DIE SERVERHÄLFTE DER STATUSFALL-MATRIX — AM ECHTEN WEG.
// ================================================================================================
//
// Echt sind: die Kompositionswurzel (`buildApp`), `ImportAccessService`, der SharePoint-Adapter mit
// seinem Graph-Client, das Prüfprotokoll und die Journalablage samt Neustart. Attrappe ist allein die
// Gegenstelle — `globalThis.fetch` antwortet wie Microsoft Graph für eine FIKTIVE Bibliothek. Kein
// Aufruf verlässt den Prozess; jeder andere Host lässt den Fall rot werden.
//
// Die fiktiven Verbindungen der Lieferbelege:
//   V0  ausgeschaltet           Schalter aus                    → kein Abruf
//   V1  fehlende Angaben        Schalter an, Token fehlt        → kein Abruf
//   V2  abgewiesener Zugang     Graph antwortet 401             → „anmeldung-abgewiesen"
//   V3  Erfolg                  Graph antwortet 200             → „erreichbar"
// (Die Zeitüberschreitung misst `verbindungstest-zeitueberschreitung.test.ts` am Dienst mit kurzer
// Frist — zehn Sekunden Wartezeit hier wären ein Test, der niemandem etwas sagt, was der andere nicht
// schon sagt.)
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import { SHAREPOINT_VERBINDUNGSTEST_AKTION } from "../../services/app/src/services/import-access-service";

const GRAPH = "https://graph.fiktiv.test/v1.0";
/** Ein FIKTIVES Zugangsmerkmal. Es darf in keiner Antwort und keinem Protokolleintrag auftauchen. */
const FIKTIVES_MERKMAL = "fiktiv-zugangsmerkmal-admin02-nur-im-test";
const ADMIN = {
  name: "Admin ADMIN02",
  email: "admin-admin02@example.com",
  password: "geheim-1234",
};

const VORHER: Record<string, string | undefined> = {};
const VARIABLEN = [
  "KLARWERK_SKIP_KEYCHAIN",
  "KLARWERK_SHAREPOINT_IMPORT",
  "KLARWERK_SHAREPOINT_BASE_URL",
  "KLARWERK_SHAREPOINT_TOKEN",
  "KLARWERK_SHAREPOINT_DRIVE",
];

/** Wie die Gegenstelle gerade antwortet — je Fall gesetzt. */
let graphAntwort: { status: number; body: unknown } = { status: 200, body: { value: [] } };
const graphRufe: string[] = [];
const fremdeRufe: string[] = [];
const echtesFetch = globalThis.fetch;

beforeAll(() => {
  for (const v of VARIABLEN) {
    VORHER[v] = process.env[v];
  }
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  globalThis.fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    if (!url.startsWith(`${GRAPH}/`)) {
      fremdeRufe.push(url);
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    graphRufe.push(url);
    return new Response(JSON.stringify(graphAntwort.body), { status: graphAntwort.status });
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

function setzeUmgebung(stand: { schalter: boolean; token: boolean }): void {
  process.env.KLARWERK_SHAREPOINT_IMPORT = stand.schalter ? "1" : "";
  process.env.KLARWERK_SHAREPOINT_BASE_URL = GRAPH;
  process.env.KLARWERK_SHAREPOINT_DRIVE = "b!fiktivebibliothek";
  if (stand.token) {
    process.env.KLARWERK_SHAREPOINT_TOKEN = FIKTIVES_MERKMAL;
  } else {
    delete process.env.KLARWERK_SHAREPOINT_TOKEN;
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
    url: "/api/import/sharepoint/zugang",
    headers: a.headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Record<string, unknown>;
}

async function teste(a: App): Promise<{ body: string; nachweis: Record<string, unknown> }> {
  const res = await a.app.inject({
    method: "POST",
    url: "/api/import/sharepoint/verbindungstest",
    headers: a.headers,
    payload: {},
  });
  expect(res.statusCode, res.body).toBe(200);
  return { body: res.body, nachweis: res.json() as Record<string, unknown> };
}

async function kandidaten(a: App): Promise<unknown[]> {
  const res = await a.app.inject({
    method: "GET",
    url: "/api/library/import/candidates",
    headers: a.headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as unknown[];
}

const neuesJournal = (): string => join(mkdtempSync(join(tmpdir(), "kw-admin02-")), "state.jsonl");

describe("ADMIN-02 · Verbindungstest am Draht — Statusfälle mit Serverantwort", () => {
  it("V0 · ausgeschaltet: Ergebnis „ausgeschaltet“, Umfang Konfiguration, KEIN Abruf", async () => {
    setzeUmgebung({ schalter: false, token: false });
    const a = await appAus(neuesJournal());
    const vorher = graphRufe.length;
    const auskunft = await zugang(a);
    expect(auskunft).toMatchObject({ enabled: false, letzterVerbindungstest: null });
    const { nachweis } = await teste(a);
    expect(nachweis).toMatchObject({
      umfang: "konfiguration",
      ergebnis: "ausgeschaltet",
      dauerMs: null,
    });
    expect(Number.isNaN(Date.parse(String(nachweis.geprueftAm)))).toBe(false);
    expect(graphRufe.length, "ausgeschaltet geht kein Abruf hinaus").toBe(vorher);
    await a.app.close();
  });

  it("V1 · fehlende Angaben: „nicht-eingerichtet“, KEIN Abruf; hinterlegt ≠ erreichbar", async () => {
    setzeUmgebung({ schalter: true, token: false });
    const a = await appAus(neuesJournal());
    const vorher = graphRufe.length;
    const auskunft = await zugang(a);
    expect(auskunft).toMatchObject({
      enabled: true,
      credentialsUsable: false,
      blocker: "missing",
      lastConnectedAt: null,
      letzterVerbindungstest: null,
    });
    const { nachweis } = await teste(a);
    expect(nachweis).toMatchObject({ umfang: "konfiguration", ergebnis: "nicht-eingerichtet" });
    expect(graphRufe.length).toBe(vorher);
    await a.app.close();
  });

  it("V2 · abgewiesener Zugang (401): „anmeldung-abgewiesen“ — ohne Merkmal in Antwort und Protokoll", async () => {
    setzeUmgebung({ schalter: true, token: true });
    const a = await appAus(neuesJournal());
    // Angaben stehen — die Auskunft sagt das, aber sie behauptet KEINE Erreichbarkeit.
    expect(await zugang(a)).toMatchObject({
      credentialsUsable: true,
      lastConnectedAt: null,
      letzterVerbindungstest: null,
    });
    graphAntwort = { status: 401, body: { error: { code: "InvalidAuthenticationToken" } } };
    const vorher = graphRufe.length;
    const { body, nachweis } = await teste(a);
    expect(graphRufe.length - vorher, "genau EIN lesender Abruf").toBe(1);
    expect(graphRufe[graphRufe.length - 1]).toContain("/root/children");
    expect(nachweis).toMatchObject({
      umfang: "bibliothek-lesen",
      ergebnis: "anmeldung-abgewiesen",
    });
    expect(typeof nachweis.dauerMs).toBe("number");
    expect(body).not.toContain(FIKTIVES_MERKMAL);
    expect(body).not.toContain("InvalidAuthenticationToken");
    // Nach dem „Neuladen" (neue Auskunft) steht derselbe Nachweis da.
    const nachher = await zugang(a);
    expect(nachher.letzterVerbindungstest).toEqual(nachweis);
    expect(JSON.stringify(nachher)).not.toContain(FIKTIVES_MERKMAL);
    const eintraege = await a.services.audit.list({ action: SHAREPOINT_VERBINDUNGSTEST_AKTION });
    expect(eintraege.length).toBe(1);
    expect(JSON.stringify(eintraege)).not.toContain(FIKTIVES_MERKMAL);
    await a.app.close();
  });

  it("V3 · Erfolg (200): „erreichbar“ — kein Kandidat, kein Lauf, kein historischer Import; Neustart behält den Nachweis", async () => {
    setzeUmgebung({ schalter: true, token: true });
    const journal = neuesJournal();
    const a = await appAus(journal);
    const kandidatenVorher = await kandidaten(a);
    graphAntwort = {
      status: 200,
      body: {
        value: [
          {
            id: "01FIKTIV",
            name: "Fiktive-Anleitung.docx",
            size: 100,
            file: { mimeType: "application/octet-stream" },
          },
        ],
      },
    };
    const { nachweis } = await teste(a);
    expect(nachweis).toMatchObject({ umfang: "bibliothek-lesen", ergebnis: "erreichbar" });
    // Die Diagnose verändert keine Beiträge und legt keinen Import an.
    expect(await kandidaten(a)).toEqual(kandidatenVorher);
    const auskunft = await zugang(a);
    expect(auskunft.lastConnectedAt, "ein Test ist kein erfolgreicher Import").toBeNull();
    expect(auskunft.letzterVerbindungstest).toEqual(nachweis);
    // Die Antwort nennt keine Dateinamen — nur feste Wörter, Zeitpunkt und Dauer.
    expect(Object.keys(nachweis).sort()).toEqual(["dauerMs", "ergebnis", "geprueftAm", "umfang"]);
    await a.app.close();

    // NEUSTART aus derselben Journaldatei: der Nachweis ist dauerhaft.
    const b = await appAus(journal);
    expect((await zugang(b)).letzterVerbindungstest).toEqual(nachweis);
    await b.app.close();
  });

  it("V4 · ohne Anmeldung kein Test (401) — und kein Abruf", async () => {
    setzeUmgebung({ schalter: true, token: true });
    const a = await appAus(neuesJournal());
    const vorher = graphRufe.length;
    const res = await a.app.inject({
      method: "POST",
      url: "/api/import/sharepoint/verbindungstest",
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(graphRufe.length).toBe(vorher);
    await a.app.close();
  });

  it("V5 · kein Aufruf hat den Prozess verlassen", () => {
    expect(fremdeRufe).toEqual([]);
  });
});
