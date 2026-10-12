// ================================================================================================
// R-0144 / R-0701 — DIE SHAREPOINT-ÜBERNAHME HINTERLÄSST QUELLREVISION, LAUFBINDUNG UND AUSGANG.
// ================================================================================================
//
// DER BEFUND (Ben, Nacharbeit 3): die SharePoint-Übernahme band ihre Kandidaten nicht an den Lauf.
// Es entstand keine Quellrevision, und `GET /api/admin/import/runs/:importId/result` blieb ohne
// Elemente. Ursache war die Fassung: der Mapper zählte Sekunden seit 1970 (heute rund 1,79 Mrd.),
// die Revisionsidentität trägt höchstens 999_999_999. Seit der Quellstand in Sekunden seit
// 2025-01-01 zählt (`services/sharepoint/src/mapper.ts`; Nacharbeit 4, statt der Minuten aus
// Nacharbeit 3), bindet die Übernahme wie Confluence `/apply` — und zwei Fassungen derselben
// Minute bleiben zwei Stände (SP2).
//
// GEMESSEN AM ECHTEN WEG: echter SharePoint-Adapter und echter Mapper (Graph-Antwort als Attrappe,
// realistischer Änderungszeitpunkt), echte Route, echte menschliche Annahme über die
// Prüf-Warteschlange, echte Lesewege — und ein echter Neustart aus derselben Journaldatei
// (`buildDevPersistServices`, dasselbe Muster wie `tests/sharepoint-inhalt/weg-am-draht-und-neustart.test.ts`).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import { makeGuards } from "../../services/app/src/http";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import { sharepointImportRoutes } from "../../services/app/src/routes/sharepoint-import-routes";
import { importProviderKey } from "../../services/library-analytics";
import { SharePointSourceAdapter } from "../../services/sharepoint";
import { SharePointGraphClient } from "../../services/sharepoint/src/graph-client";

const GRAPH = "https://graph.microsoft.test/v1.0";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
process.env.KLARWERK_SHAREPOINT_BASE_URL = GRAPH;
process.env.KLARWERK_SHAREPOINT_TOKEN = "vertragsdouble-nur-fuer-den-test-r0144";
process.env.KLARWERK_SHAREPOINT_DRIVE = "b!testbibliothek";

const ADMIN = { name: "Admin R0144", email: "admin-r0144@example.com", password: "geheim-1234" };

/** Der Quellstand, wie der Mapper ihn rechnet: Sekunden seit 2025-01-01 (`sharepointQuellstand`). */
const standVon = (iso: string): number =>
  Math.max(1, Math.floor((Date.parse(iso) - Date.UTC(2025, 0, 1)) / 1000));

/** Ein heutiger Änderungszeitpunkt — in Sekunden seit 1970 läge er über der Revisionsgrenze. */
const GEAENDERT_AM = "2026-09-12T09:15:00Z";
const STAND = standVon(GEAENDERT_AM);

/** Eine Datei ohne Inhaltsweg (nur Merkmale) — es geht kein Download hinaus. */
const DATEI = {
  id: "01ANWEISUNGDOCX",
  name: "Wartungsanweisung.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx",
  lastModifiedDateTime: GEAENDERT_AM,
  size: 24_576,
  description: "Wartung der Abfüllanlage, Stand September.",
  file: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

/**
 * Der Stand, den die Graph-Attrappe gerade ausliefert — SP2 ändert ihn wie ein Mensch, der die
 * Datei in SharePoint überarbeitet. Jeder Fall setzt ihn zu Beginn selbst.
 */
let aktuell: { lastModifiedDateTime: string; description: string } = {
  lastModifiedDateTime: DATEI.lastModifiedDateTime,
  description: DATEI.description,
};

const echtesFetch = globalThis.fetch;
const fremdeAufrufe: string[] = [];

beforeAll(() => {
  globalThis.fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    if (!url.startsWith(`${GRAPH}/`)) {
      fremdeAufrufe.push(url);
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    const treffer = /\/items\/([^/?]+)/.exec(url);
    if (treffer && decodeURIComponent(treffer[1] ?? "") === DATEI.id) {
      return new Response(JSON.stringify({ ...DATEI, ...aktuell }), { status: 200 });
    }
    if (treffer) {
      return new Response(JSON.stringify({ error: { code: "itemNotFound" } }), { status: 404 });
    }
    return new Response(JSON.stringify({ value: [{ ...DATEI, ...aktuell }] }), { status: 200 });
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = echtesFetch;
});

/** Dienste MIT Anker-Strang (Schalter beim Dienstbau), App OHNE eigene SharePoint-Route. */
async function appAus(journal: string) {
  process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
  const services = await buildDevPersistServices(journal);
  process.env.KLARWERK_SHAREPOINT_IMPORT = "";
  const app = buildApp(services);
  const guards = makeGuards(services.auth);
  app.register(
    sharepointImportRoutes({
      library: services.library,
      guards,
      importRuns: services.importRuns,
      makeAdapter: () =>
        new SharePointSourceAdapter(
          new SharePointGraphClient({
            baseUrl: GRAPH,
            accessToken: "vertragsdouble-nur-fuer-den-test-r0144",
            driveId: "b!testbibliothek",
            inhaltsTransport: async () => {
              throw new Error("kein Inhaltsabruf erwartet");
            },
            aufloeseFn: async () => ["93.184.216.34"],
          }),
        ),
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
      koService: services.ko,
      guards,
    }),
  );
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, "der Admin muss ein Token bekommen").not.toBe("");
  return { app, headers: { authorization: `Bearer ${token}` } };
}

interface Ergebnis {
  run: { importId: string; sourceSystem: string; status: string };
  items: {
    ordinal: number;
    candidateItemId: string;
    knowledgeObjectId: string | null;
    itemOutcome: string;
    sourceRecordId: string | null;
  }[];
}

describe("R-0144 / R-0701 · SharePoint-Übernahme: Quellrevision, Laufbindung, Ausgang — auch nach Neustart", () => {
  it("SP1 · Übernahme → Annahme → /result nennt das Element; die Revision ist dauerhaft lesbar", async () => {
    aktuell = { lastModifiedDateTime: DATEI.lastModifiedDateTime, description: DATEI.description };
    const journal = join(mkdtempSync(join(tmpdir(), "kw-r0144-")), "state.jsonl");
    const { app, headers } = await appAus(journal);

    // 1. Übernahme — die Datei wird WIRKLICH eingereiht (vorher: `failed` mit LibraryError).
    const uebernahme = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/apply",
      headers,
      payload: { ids: [DATEI.id] },
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(200);
    const bilanz = uebernahme.json() as {
      imported: number;
      failed: unknown[];
      importId?: string;
    };
    expect({ eingereiht: bilanz.imported, gescheitert: bilanz.failed }).toEqual({
      eingereiht: 1,
      gescheitert: [],
    });
    const importId = bilanz.importId;
    expect(importId, "die Übernahme nennt keine Lauf-Kennung").toBeTruthy();

    // 2. Vor der Entscheidung steht kein Ausgang fest — und es wird keiner behauptet.
    const vorher = await app.inject({
      method: "GET",
      url: `/api/admin/import/runs/${importId}/result`,
      headers,
    });
    expect((vorher.json() as Ergebnis).items).toEqual([]);

    // 3. Die menschliche Annahme über die echte Prüf-Warteschlange.
    const warteschlange = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    const kandidat = (
      warteschlange.json() as {
        id: string;
        item: { externalId?: string; sourceVersion?: number };
      }[]
    ).find((k) => k.item.externalId === DATEI.id);
    expect(kandidat?.item.sourceVersion, "der Kandidat trägt den Quellstand").toBe(STAND);
    const angenommen = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat?.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(angenommen.statusCode, angenommen.body).toBe(200);
    const koId = (angenommen.json() as { koId?: string }).koId;
    expect(koId, "die Annahme muss ein Wissensobjekt erzeugen").toBeTruthy();

    // 4. Der gemeinsame Ergebnisweg nennt Element, Objekt, Ausgang und Revision.
    const lesen = async (a: typeof app, h: typeof headers) => {
      const res = await a.inject({
        method: "GET",
        url: `/api/admin/import/runs/${importId}/result`,
        headers: h,
      });
      expect(res.statusCode, res.body).toBe(200);
      const e = res.json() as Ergebnis;
      const quelle = await a.inject({
        method: "GET",
        url: `/api/admin/import/source-records/${e.items[0]?.sourceRecordId}`,
        headers: h,
      });
      const objekt = await a.inject({
        method: "GET",
        url: `/api/admin/import/knowledge/${koId}`,
        headers: h,
      });
      return {
        lauf: {
          importId: e.run.importId,
          quellsystem: e.run.sourceSystem,
          status: e.run.status,
        },
        elemente: e.items.map((i) => ({
          ordinal: i.ordinal,
          kandidat: i.candidateItemId,
          objekt: i.knowledgeObjectId,
          ausgang: i.itemOutcome,
          mitRevision: i.sourceRecordId !== null,
        })),
        revision: { status: quelle.statusCode, ...(quelle.json() as Record<string, unknown>) },
        amObjekt: {
          status: objekt.statusCode,
          lauf: (objekt.json() as { run?: { importId?: string } | null }).run?.importId ?? null,
          fassung:
            (objekt.json() as { source?: { sourceVersion?: number } | null }).source
              ?.sourceVersion ?? null,
        },
      };
    };
    const soll = {
      lauf: { importId, quellsystem: "sharepoint", status: "COMPLETED" },
      elemente: [
        { ordinal: 0, kandidat: kandidat?.id, objekt: koId, ausgang: "CREATED", mitRevision: true },
      ],
      revision: expect.objectContaining({
        status: 200,
        sourceSystem: importProviderKey("SharePoint"),
        externalId: DATEI.id,
        sourceVersion: STAND,
        url: DATEI.webUrl,
        contentReferenceState: "NOT_CAPTURED",
      }),
      amObjekt: { status: 200, lauf: importId, fassung: STAND },
    };
    expect(await lesen(app, headers)).toEqual(soll);
    await app.close();

    // 5. NEUSTART aus derselben Journaldatei — Lauf, Elementreferenz und Revision sind dauerhaft.
    const neu = await appAus(journal);
    expect(await lesen(neu.app, neu.headers)).toEqual(soll);
    await neu.app.close();
  });

  // ==============================================================================================
  // SP2 — BENS BEFUND (Nacharbeit 4): zwei Fassungen in DERSELBEN MINUTE.
  // ==============================================================================================
  //
  // Mit der Minutenzählung aus Nacharbeit 3 trugen 09:15:01 und 09:15:59 denselben Stand. War die
  // erste angenommen, meldete die Übernahme die zweite als „schon vorhanden"
  // (`sharepoint-import-routes.ts`, `angenommenerStand`), der neue Inhalt kam nie an, und es entstand
  // keine eigene Quellrevision. Gemessen wird hier genau dieser Weg — Übernahme, Annahme, Anker am
  // Objekt, Laufergebnis, Revision — und danach derselbe Stand nach einem Neustart.
  it("SP2 · zweite Fassung 58 s später, gleiche Minute: eingereiht, angenommen, eigene Revision, Anker zieht nach", async () => {
    const ERSTE = "2026-09-12T09:15:01Z";
    const ZWEITE = "2026-09-12T09:15:59Z";
    aktuell = { lastModifiedDateTime: ERSTE, description: "Wartung der Abfüllanlage, Fassung A." };
    const journal = join(mkdtempSync(join(tmpdir(), "kw-r0144-sp2-")), "state.jsonl");
    const { app, headers } = await appAus(journal);

    const uebernehmen = async (): Promise<{
      imported: number;
      alreadyQueued: number;
      importId?: string;
    }> => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/sharepoint/apply",
        headers,
        payload: { ids: [DATEI.id] },
      });
      expect(res.statusCode, res.body).toBe(200);
      return res.json() as { imported: number; alreadyQueued: number; importId?: string };
    };
    const offenenKandidatAnnehmen = async (stand: number): Promise<string | undefined> => {
      const liste = await app.inject({
        method: "GET",
        url: "/api/library/import/candidates",
        headers,
      });
      const kandidat = (
        liste.json() as {
          id: string;
          status: string;
          item: { externalId?: string; sourceVersion?: number };
        }[]
      ).find(
        (k) =>
          k.item.externalId === DATEI.id && k.status === "neu" && k.item.sourceVersion === stand,
      );
      expect(kandidat, `kein offener Kandidat mit Stand ${stand}`).toBeDefined();
      const res = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${kandidat?.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(res.statusCode, res.body).toBe(200);
      return (res.json() as { koId?: string }).koId;
    };

    // Erste Fassung: übernehmen und annehmen.
    const erste = await uebernehmen();
    expect(erste.imported).toBe(1);
    const koId = await offenenKandidatAnnehmen(standVon(ERSTE));
    expect(koId, "die erste Annahme muss ein Wissensobjekt erzeugen").toBeTruthy();

    // Zweite Fassung in DERSELBEN Minute — der Kern des Befunds.
    aktuell = { lastModifiedDateTime: ZWEITE, description: "Wartung der Abfüllanlage, Fassung B." };
    const zweite = await uebernehmen();
    expect(
      { eingereiht: zweite.imported, schonVorhanden: zweite.alreadyQueued },
      "die zweite Fassung derselben Minute ist ein neuer Stand, nicht „schon vorhanden“",
    ).toEqual({ eingereiht: 1, schonVorhanden: 0 });
    const koIdZwei = await offenenKandidatAnnehmen(standVon(ZWEITE));
    expect(koIdZwei, "die zweite Fassung schreibt dasselbe Objekt fort").toBe(koId);

    const lesen = async (a: typeof app, h: typeof headers) => {
      const ergebnis = async (importId: string | undefined) =>
        (
          await a.inject({
            method: "GET",
            url: `/api/admin/import/runs/${importId}/result`,
            headers: h,
          })
        ).json() as Ergebnis;
      const e1 = await ergebnis(erste.importId);
      const e2 = await ergebnis(zweite.importId);
      const revision = async (id: string | null | undefined) =>
        (
          await a.inject({
            method: "GET",
            url: `/api/admin/import/source-records/${id}`,
            headers: h,
          })
        ).json() as { sourceVersion?: number; externalId?: string };
      const objekt = (
        await a.inject({ method: "GET", url: `/api/admin/import/knowledge/${koId}`, headers: h })
      ).json() as {
        run?: { importId?: string } | null;
        source?: { sourceVersion?: number; sourceRecordId?: string } | null;
      };
      const r1 = e1.items[0]?.sourceRecordId ?? null;
      const r2 = e2.items[0]?.sourceRecordId ?? null;
      return {
        ausgaenge: [e1.items.map((i) => i.itemOutcome), e2.items.map((i) => i.itemOutcome)],
        objekte: [e1.items[0]?.knowledgeObjectId, e2.items[0]?.knowledgeObjectId],
        zweiRevisionen: r1 !== null && r2 !== null && r1 !== r2,
        revisionsStaende: [(await revision(r1)).sourceVersion, (await revision(r2)).sourceVersion],
        ankerAmObjekt: {
          lauf: objekt.run?.importId ?? null,
          fassung: objekt.source?.sourceVersion ?? null,
          revision: objekt.source?.sourceRecordId ?? null,
        },
        r2,
      };
    };
    const vorNeustart = await lesen(app, headers);
    expect(vorNeustart).toEqual({
      ausgaenge: [["CREATED"], ["BOUND"]],
      objekte: [koId, koId],
      zweiRevisionen: true,
      revisionsStaende: [standVon(ERSTE), standVon(ZWEITE)],
      ankerAmObjekt: { lauf: zweite.importId, fassung: standVon(ZWEITE), revision: vorNeustart.r2 },
      r2: vorNeustart.r2,
    });
    await app.close();

    // NEUSTART aus derselben Journaldatei — beide Revisionen, beide Ausgänge, der Anker.
    const neu = await appAus(journal);
    expect(await lesen(neu.app, neu.headers)).toEqual(vorNeustart);
    await neu.app.close();
  });

  it("NETZPROBE: kein Aufruf ging an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
  });
});
