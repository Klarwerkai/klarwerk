// ================================================================================================
// ADMIN-02 · DER VERBINDUNGSTEST AM DIENST — ZEITÜBERSCHREITUNG UND DIE FEHLERLAGEN EINZELN.
// ================================================================================================
//
// Echt sind `ImportAccessService`, der SharePoint-Adapter und sein Graph-Client; die Gegenstelle ist
// ein `fetchFn`-Double je Fall. Die Frist des Tests wird auf 40 ms gesetzt, damit die
// Zeitüberschreitung messbar ist, ohne zehn Sekunden zu warten — die Regel, die gemessen wird
// („Frist des Tests läuft ab, bevor die Gegenstelle antwortet"), ist dieselbe.
//
// Gemessen wird auch, was die Importrouten bewusst ZUSAMMENFASSEN (`SHAREPOINT_UNREACHABLE` für 401
// und Netzfehler): der Test trennt sie, weil der nächste Schritt ein anderer ist.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ImportAccessService,
  type Verbindungsnachweis,
} from "../../services/app/src/services/import-access-service";
import type { AuditService } from "../../services/audit";
import type { ImportRunRepo } from "../../services/library-analytics";
import { SharePointSourceAdapter } from "../../services/sharepoint";
import { SharePointGraphClient } from "../../services/sharepoint/src/graph-client";

const GRAPH = "https://graph.fiktiv.test/v1.0";
const FIKTIVES_MERKMAL = "fiktiv-zugangsmerkmal-admin02-dienst";
const VARIABLEN = [
  "KLARWERK_SHAREPOINT_IMPORT",
  "KLARWERK_SHAREPOINT_BASE_URL",
  "KLARWERK_SHAREPOINT_TOKEN",
  "KLARWERK_SHAREPOINT_DRIVE",
];
const VORHER: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const v of VARIABLEN) {
    VORHER[v] = process.env[v];
  }
  process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
  process.env.KLARWERK_SHAREPOINT_BASE_URL = GRAPH;
  process.env.KLARWERK_SHAREPOINT_TOKEN = FIKTIVES_MERKMAL;
  process.env.KLARWERK_SHAREPOINT_DRIVE = "b!fiktivebibliothek";
});

afterAll(() => {
  for (const v of VARIABLEN) {
    if (VORHER[v] === undefined) {
      delete process.env[v];
    } else {
      process.env[v] = VORHER[v];
    }
  }
});

const keineLaeufe = {
  findLastSuccessAt: async () => null,
} as unknown as ImportRunRepo;

function dienst(
  fetchFn: typeof fetch,
  extra: Partial<ConstructorParameters<typeof ImportAccessService>[0]> = {},
): ImportAccessService {
  return new ImportAccessService({
    importRuns: keineLaeufe,
    verbindungstestFristMs: 40,
    sharepointAdapter: () =>
      new SharePointSourceAdapter(
        new SharePointGraphClient({
          baseUrl: GRAPH,
          accessToken: FIKTIVES_MERKMAL,
          driveId: "b!fiktivebibliothek",
          fetchFn,
          // Die Frist des CLIENTS liegt weit über der des Tests — sonst mässe dieser Fall den Client.
          timeoutMs: 2_000,
        }),
      ),
    ...extra,
  });
}

interface Protokolleintrag {
  seq: number;
  at: string;
  actor: string;
  payload: Record<string, unknown>;
}

const antwortet = (status: number, body: unknown = {}): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("ADMIN-02 · Verbindungstest am Dienst", () => {
  it("Z1 · die Gegenstelle antwortet nicht: „zeitueberschreitung“, und der Aufrufer wartet nicht", async () => {
    const haengt = (() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;
    const start = Date.now();
    const nachweis = await dienst(haengt).sharepointVerbindungstest("admin-fiktiv");
    expect(nachweis.ergebnis).toBe("zeitueberschreitung");
    expect(nachweis.umfang).toBe("bibliothek-lesen");
    expect(Date.now() - start).toBeLessThan(5_000);
    expect(nachweis.dauerMs).toBeGreaterThanOrEqual(30);
  });

  it("Z2 · jede Fehlerlage hat ihr EIGENES Ergebnis", async () => {
    const faelle: [typeof fetch, Verbindungsnachweis["ergebnis"]][] = [
      [antwortet(200, { value: [] }), "erreichbar"],
      [antwortet(401), "anmeldung-abgewiesen"],
      [antwortet(403), "keine-berechtigung"],
      [antwortet(404), "nicht-gefunden"],
      [antwortet(503), "nicht-erreichbar"],
      [
        (async () => {
          throw new TypeError("fetch failed");
        }) as unknown as typeof fetch,
        "nicht-erreichbar",
      ],
    ];
    for (const [fetchFn, erwartet] of faelle) {
      const nachweis = await dienst(fetchFn).sharepointVerbindungstest("admin-fiktiv");
      expect(nachweis.ergebnis, erwartet).toBe(erwartet);
    }
  });

  it("Z3 · ohne Prüfprotokoll hält der Prozess den Nachweis; die Auskunft nennt ihn", async () => {
    const d = dienst(antwortet(401));
    expect((await d.sharepointZugangsstatus()).letzterVerbindungstest).toBeNull();
    const nachweis = await d.sharepointVerbindungstest("admin-fiktiv");
    expect((await d.sharepointZugangsstatus()).letzterVerbindungstest).toEqual(nachweis);
  });

  it("Z4 · das Prüfprotokoll bekommt nur feste Wörter, Zeitpunkt und Dauer — kein Merkmal", async () => {
    const eintraege: Protokolleintrag[] = [];
    const audit = {
      record: async (e: { actor: string; payload?: Record<string, unknown> }) => {
        eintraege.push({
          seq: eintraege.length + 1,
          at: new Date().toISOString(),
          actor: e.actor,
          payload: e.payload ?? {},
        });
      },
      list: async () => eintraege,
    };
    const d = dienst(antwortet(401), {
      audit: audit as unknown as AuditService,
    });
    const nachweis = await d.sharepointVerbindungstest("admin-fiktiv");
    expect(eintraege).toHaveLength(1);
    expect(Object.keys(eintraege[0]?.payload ?? {}).sort()).toEqual([
      "dauerMs",
      "ergebnis",
      "geprueftAm",
      "umfang",
    ]);
    expect(JSON.stringify(eintraege)).not.toContain(FIKTIVES_MERKMAL);
    // Gelesen wird der Nachweis aus dem Protokoll — derselbe Wert.
    expect((await d.sharepointZugangsstatus()).letzterVerbindungstest).toEqual(nachweis);
  });

  it("Z5 · ein Protokolleintrag mit unbekanntem Ergebnis wird nicht geraten", async () => {
    const audit = {
      record: async () => undefined,
      list: async () => [
        {
          seq: 1,
          at: "2026-10-09T07:00:00.000Z",
          payload: { ergebnis: "vielleicht", umfang: "x" },
        },
      ],
    };
    const d = dienst(antwortet(200), {
      audit: audit as unknown as AuditService,
    });
    expect((await d.sharepointZugangsstatus()).letzterVerbindungstest).toBeNull();
  });
});
