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
import {
  CONFLUENCE_VERBINDUNGSTEST_AKTION,
  SHAREPOINT_VERBINDUNGSTEST_AKTION,
} from "../../services/app/src/services/import-access-service";
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
  // Nacharbeit 5 (R1): SharePoint wird für die Rechteprobe vollständig eingerichtet.
  "KLARWERK_SHAREPOINT_IMPORT",
  "KLARWERK_SHAREPOINT_BASE_URL",
  "KLARWERK_SHAREPOINT_TOKEN",
  "KLARWERK_SHAREPOINT_DRIVE",
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

/**
 * Nacharbeit 5: eine weitere FIKTIVE Identität, von der Verwaltenden über den Produktweg angelegt
 * (`POST /api/users`), und ihre eigene Anmeldung — eine getrennte Sitzung derselben Instanz.
 */
async function anmelden(
  a: App,
  rolle: "admin" | "experte",
  email: string,
): Promise<{ authorization: string }> {
  const angelegt = await a.app.inject({
    method: "POST",
    url: "/api/users",
    headers: a.headers,
    payload: { name: `Fiktiv ${rolle}`, email, password: "geheim-1234", role: rolle },
  });
  expect(angelegt.statusCode, angelegt.body).toBeLessThan(300);
  const login = await a.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim-1234" },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, `${rolle} muss sich anmelden können`).not.toBe("");
  return { authorization: `Bearer ${token}` };
}

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
  // Nacharbeit 4: Die Liste ist unbedingt registriert, der Einzelweg aber nur bei eingeschaltetem
  // Importweg (build-app.ts, `importLaeufeLesbar`). Für den Formvergleich mit dem Einzelweg schaltet
  // L1 deshalb Confluence ein — ohne Token, es geht also kein Abruf hinaus. Den Fall „alle Wege aus"
  // misst L0 getrennt.
  it("L0 · alle Importwege aus: die Liste antwortet trotzdem (200, verfügbar, leer)", async () => {
    umgebung({ schalter: false, token: false });
    const a = await appAus(neuesJournal());
    const res = await a.app.inject({
      method: "GET",
      url: "/api/admin/import/runs",
      headers: a.headers,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ verfuegbar: true, ausloeserFestgehalten: false, runs: [] });
    await a.app.close();
  });

  it("L1 · jüngster Lauf zuerst, Zonenversatz richtig geordnet, Felder des Einzelwegs; Neustart behält die Liste", async () => {
    umgebung({ schalter: true, token: false });
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
    expect(einzeln.statusCode, einzeln.body).toBe(200);
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

  // ==============================================================================================
  // NACHARBEIT 5 — BENS BEFUND 1: ANGEMELDET, ABER OHNE `users.manage`.
  // ==============================================================================================
  //
  // Eine fiktive Expertin (Rolle `experte`, ohne `users.manage`) ist angemeldet. Beide
  // Verbindungstests sind so eingerichtet, dass sie für eine Verwaltende WIRKLICH abrufen würden
  // (Confluence mit Token; SharePoint mit Schalter und allen Angaben). Erwartet: 403 an allen drei
  // Türen, KEIN Abruf an eine Gegenstelle (ein SharePoint-Abruf landete in `fremde` und machte L3
  // rot), KEIN Protokolleintrag, und keine Laufdaten in der Antwort.
  it("R1 · Expertin ohne users.manage: 403 für Liste und beide Tests — kein Abruf, kein Protokoll, keine Laufdaten", async () => {
    umgebung({ schalter: true, token: true });
    process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
    process.env.KLARWERK_SHAREPOINT_BASE_URL = "https://graph.fiktiv.test/v1.0";
    process.env.KLARWERK_SHAREPOINT_TOKEN = "fiktiv-sharepoint-merkmal-r1";
    process.env.KLARWERK_SHAREPOINT_DRIVE = "b!fiktivebibliothek";
    try {
      const a = await appAus(neuesJournal());
      await a.services.importRuns.insertIfAbsent(
        lauf("lauf-geheim-r1", "COMPLETED", "2026-10-09T08:00:00.000Z"),
      );
      const expertin = await anmelden(a, "experte", "expertin-r1@example.com");
      const vorherRufe = rufe.length;
      const vorherFremde = fremde.length;
      const liste = await a.app.inject({
        method: "GET",
        url: "/api/admin/import/runs",
        headers: expertin,
      });
      const confluence = await a.app.inject({
        method: "POST",
        url: "/api/import/confluence/verbindungstest",
        headers: expertin,
        payload: {},
      });
      const sharepoint = await a.app.inject({
        method: "POST",
        url: "/api/import/sharepoint/verbindungstest",
        headers: expertin,
        payload: {},
      });
      expect([liste.statusCode, confluence.statusCode, sharepoint.statusCode]).toEqual([
        403, 403, 403,
      ]);
      expect(liste.body, "keine Laufdaten in der Ablehnung").not.toContain("lauf-geheim-r1");
      expect(liste.body).not.toContain("space:FIKTIV");
      expect(rufe.length, "kein Confluence-Abruf").toBe(vorherRufe);
      expect(fremde.length, "kein SharePoint-Abruf").toBe(vorherFremde);
      for (const aktion of [CONFLUENCE_VERBINDUNGSTEST_AKTION, SHAREPOINT_VERBINDUNGSTEST_AKTION]) {
        expect(await a.services.audit.list({ action: aktion }), aktion).toEqual([]);
      }
      // Gegenprobe der Messung: dieselbe Liste antwortet der Verwaltenden mit dem Lauf.
      const admin = await a.app.inject({
        method: "GET",
        url: "/api/admin/import/runs",
        headers: a.headers,
      });
      expect(admin.statusCode).toBe(200);
      expect(admin.body).toContain("lauf-geheim-r1");
      await a.app.close();
    } finally {
      for (const v of [
        "KLARWERK_SHAREPOINT_IMPORT",
        "KLARWERK_SHAREPOINT_BASE_URL",
        "KLARWERK_SHAREPOINT_TOKEN",
        "KLARWERK_SHAREPOINT_DRIVE",
      ]) {
        delete process.env[v];
      }
    }
  });

  // ==============================================================================================
  // NACHARBEIT 5 — BENS BEFUND 2: ZWEI GETRENNTE ADMIN-SITZUNGEN.
  // ==============================================================================================
  //
  // Zwei fiktive Verwaltende mit je eigener Anmeldung an DERSELBEN Instanz. Sitzung A startet einen
  // Verbindungstest und schreibt einen fiktiven Lauf fort; Sitzung B fragt danach neu (das, was die
  // Fläche beim Neuladen, beim Fokus und im 10-s-Takt tut). Erwartet: B sieht genau A's Ergebnis,
  // Status und Bilanz, und der Bestand der Prüf-Warteschlange bleibt in beiden Sitzungen gleich.
  it("M1 · zwei Admin-Sitzungen: Diagnose und Laufänderung von A erscheinen in B; Bestand konsistent", async () => {
    umgebung({ schalter: true, token: true });
    const a = await appAus(neuesJournal());
    const sitzungB = await anmelden(a, "admin", "admin-b-m1@example.com");
    expect(sitzungB.authorization, "zwei getrennte Anmeldungen").not.toBe(a.headers.authorization);
    const kandidaten = async (h: Record<string, string>) =>
      (
        await a.app.inject({ method: "GET", url: "/api/library/import/candidates", headers: h })
      ).json() as unknown[];
    const liesListe = async (h: Record<string, string>) => {
      const res = await a.app.inject({ method: "GET", url: "/api/admin/import/runs", headers: h });
      expect(res.statusCode, res.body).toBe(200);
      return (
        res.json() as {
          runs: { importId: string; status: string; counters: Record<string, number> }[];
        }
      ).runs;
    };
    const bestandVorher = await kandidaten(sitzungB);

    // 1. Lauf von A angelegt — B sieht ihn „in der Warteschlange".
    await a.services.importRuns.insertIfAbsent(
      lauf("lauf-m1", "QUEUED", "2026-10-09T09:00:00.000Z"),
    );
    expect((await liesListe(sitzungB)).find((r) => r.importId === "lauf-m1")?.status).toBe(
      "QUEUED",
    );

    // 2. Der Lauf wird fortgeschrieben (teilweise) — B sieht nach erneutem Abruf Status UND Bilanz.
    await a.services.importRuns.advance("lauf-m1", {
      status: "PARTIAL",
      completedAt: "2026-10-09T09:02:00.000Z",
      counters: { itemsTotal: 3, itemsCreated: 2, itemsBound: 0, itemsSkipped: 0, itemsFailed: 1 },
    });
    const inB = (await liesListe(sitzungB)).find((r) => r.importId === "lauf-m1");
    const inA = (await liesListe(a.headers)).find((r) => r.importId === "lauf-m1");
    expect(inB?.status).toBe("PARTIAL");
    expect(inB?.counters).toMatchObject({ itemsTotal: 3, itemsCreated: 2, itemsFailed: 1 });
    expect(inB, "beide Sitzungen sehen denselben Lauf").toEqual(inA);

    // 3. Verbindungstest in A — B liest dasselbe Ergebnis aus der Auskunft.
    antwort = { status: 401, body: { message: "Unauthorized" } };
    const { nachweis } = await teste(a);
    const zugangB = await a.app.inject({
      method: "GET",
      url: "/api/import/confluence/zugang",
      headers: sitzungB,
    });
    expect((zugangB.json() as { letzterVerbindungstest: unknown }).letzterVerbindungstest).toEqual(
      nachweis,
    );

    // 4. Weder Test noch Laufänderung haben den Bestand der Prüf-Warteschlange verändert.
    expect(await kandidaten(sitzungB)).toEqual(bestandVorher);
    expect(await kandidaten(a.headers)).toEqual(bestandVorher);
    await a.app.close();
  });

  it("L3 · kein Aufruf hat den Prozess verlassen", () => {
    expect(fremde).toEqual([]);
  });
});
