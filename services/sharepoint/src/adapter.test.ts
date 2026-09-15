// JOB 4086: der Adapter gegen dasselbe Vertragsdouble — kein Netz, kein Live-Token.
import { describe, expect, it } from "vitest";
import { SharePointSourceAdapter, createSharePointAdapterFromEnv } from "./adapter";
import { SharePointGraphClient, type SharePointGraphConfig } from "./graph-client";

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

/**
 * Der Adapter mit einem Vertragsdouble — ZUSAMMENGESETZT, nicht über eine exportierte Fabrik.
 *
 * Beide Teile sind modul-intern erreichbar, und genau deshalb braucht es dafür keinen Export: Ein
 * `adapterFromConfig`, das nur Tests rufen, wäre Produktoberfläche ohne Produktaufrufer — der Fall,
 * den `tests/capture/aufrufer-waechter.test.ts` fängt (das Confluence-Gegenstück steht dort im
 * ALTBESTAND). Begründung in voller Länge in `adapter.ts`.
 */
function adapterMitDouble(config: SharePointGraphConfig): SharePointSourceAdapter {
  return new SharePointSourceAdapter(new SharePointGraphClient(config));
}

const DATEI = {
  id: "01WARTUNG",
  name: "Wartungsanweisung.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Wartungsanweisung.docx",
  lastModifiedDateTime: "2026-09-10T08:30:00Z",
  size: 24_576,
  file: {},
};
const ORDNER = { id: "01ARCHIV", name: "Archiv", folder: { childCount: 3 } };

const cfg = (fetchFn: typeof fetch) => ({
  baseUrl: "https://graph.microsoft.test/v1.0",
  accessToken: "nur-fuer-den-vertrag",
  driveId: "b!bibliothek",
  fetchFn,
});

describe("JOB 4086: SharePointSourceAdapter", () => {
  it("listeDateien liefert NUR Dateien — ein Ordner ist kein wählbarer Eintrag", async () => {
    const fetchFn = (async () => okJson({ value: [DATEI, ORDNER] })) as unknown as typeof fetch;
    const { dateien, truncated } = await adapterMitDouble(cfg(fetchFn)).listeDateien();
    expect(dateien).toEqual([
      {
        id: "01WARTUNG",
        name: "Wartungsanweisung.docx",
        url: "https://contoso.sharepoint.test/sites/technik/Wartungsanweisung.docx",
        geaendertAm: "2026-09-10T08:30:00Z",
        groesseBytes: 24_576,
      },
    ]);
    expect(truncated).toBe(false);
  });

  it('„unbekannt" ist von „0" unterscheidbar: fehlende Angaben werden null, nicht 0 oder ""', async () => {
    const fetchFn = (async () =>
      okJson({ value: [{ id: "01X", name: "X.docx", file: {} }] })) as unknown as typeof fetch;
    const { dateien } = await adapterMitDouble(cfg(fetchFn)).listeDateien();
    expect(dateien[0]).toEqual({
      id: "01X",
      name: "X.docx",
      url: null,
      geaendertAm: null,
      groesseBytes: null,
    });
  });

  it("eine leere Bibliothek ist eine leere Liste — keine Behauptung über Rechte", async () => {
    const fetchFn = (async () => okJson({ value: [] })) as unknown as typeof fetch;
    const { dateien, truncated } = await adapterMitDouble(cfg(fetchFn)).listeDateien();
    expect(dateien).toEqual([]);
    expect(truncated).toBe(false);
  });

  it("holeItem liefert das normalisierte ImportItem der gewählten Datei", async () => {
    const fetchFn = (async (u: string) => {
      expect(String(u)).toContain("/items/01WARTUNG");
      return okJson(DATEI);
    }) as unknown as typeof fetch;
    const item = await adapterMitDouble(cfg(fetchFn)).holeItem("01WARTUNG");
    expect(item?.externalId).toBe("01WARTUNG");
    expect(item?.provider).toBe("SharePoint");
    expect(item?.url).toBe(DATEI.webUrl);
  });

  it('holeItem auf einen ORDNER ergibt kein Item — das ist etwas anderes als „nicht gefunden"', async () => {
    const fetchFn = (async () => okJson(ORDNER)) as unknown as typeof fetch;
    expect(await adapterMitDouble(cfg(fetchFn)).holeItem("01ARCHIV")).toBeUndefined();
  });

  it("createSharePointAdapterFromEnv: ohne vollständige, https-Zugangsdaten gibt es KEINEN Adapter", () => {
    expect(createSharePointAdapterFromEnv({})).toBeUndefined();
    expect(
      createSharePointAdapterFromEnv({
        KLARWERK_SHAREPOINT_BASE_URL: "https://graph.microsoft.test/v1.0",
        KLARWERK_SHAREPOINT_TOKEN: "t",
        KLARWERK_SHAREPOINT_DRIVE: "d",
      }),
    ).toBeDefined();
  });

  it("der Adapter kennt den Import-SCHALTER nicht — darüber entscheidet die Kompositionswurzel", () => {
    // Gegenprobe zur Bauform: OHNE gesetzten Schalter, aber MIT Zugangsdaten entsteht sehr wohl ein
    // Adapter. Läse dieses Modul den Schalter selbst, gäbe es zwei Leser derselben Regel — genau
    // die Bauform, die AUFTRAG-mega46 Block F beseitigt hat.
    expect(
      createSharePointAdapterFromEnv({
        KLARWERK_SHAREPOINT_BASE_URL: "https://graph.microsoft.test/v1.0",
        KLARWERK_SHAREPOINT_TOKEN: "t",
        KLARWERK_SHAREPOINT_DRIVE: "d",
        KLARWERK_SHAREPOINT_IMPORT: "0",
      }),
    ).toBeDefined();
  });
});
