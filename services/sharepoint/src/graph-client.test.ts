// JOB 4086: der lesende Graph-Client gegen ein DETERMINISTISCHES Vertragsdouble (injizierter
// fetch) — KEIN Live-Token, kein Netz. Dieselbe Bauform wie `services/confluence/src/
// rest-client.test.ts`. Geprüft werden die drei Härtungen (HTTPS-Origin-Pinning,
// `redirect:"error"`, Token nie in der URL) und die Abbildung der Statuszahlen auf die vier Lagen.
import { describe, expect, it } from "vitest";
import {
  SharePointGraphClient,
  pruefeGraphUrl,
  sharepointClientFromEnv,
  sharepointFehlerlage,
} from "./graph-client";

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function status(code: number): Response {
  return { ok: false, status: code, json: async () => ({}) } as unknown as Response;
}

const cfg = (fetchFn: typeof fetch, over: Record<string, unknown> = {}) => ({
  baseUrl: "https://graph.microsoft.test/v1.0",
  accessToken: "nur-fuer-den-vertrag-1234",
  driveId: "b!bibliothek",
  fetchFn,
  ...over,
});

describe("JOB 4086: SharePointGraphClient (read-only, Vertragsdouble)", () => {
  it("listeDateien: lesender GET auf die gescopte Bibliothek, Bearer im Kopf, redirect:error, Token nie in der URL", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = String(u);
      init = i;
      return okJson({ value: [{ id: "1", name: "A.docx", file: {} }] });
    }) as unknown as typeof fetch;

    const ergebnis = await new SharePointGraphClient(cfg(fetchFn)).listeDateien();

    expect(ergebnis.items).toHaveLength(1);
    expect(ergebnis.truncated).toBe(false);
    expect(init?.method).toBe("GET"); // ausschliesslich lesend
    expect(init?.redirect).toBe("error");
    expect(url).toContain("/drives/b!bibliothek/root/children");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer nur-fuer-den-vertrag-1234",
    );
    expect(url).not.toContain("nur-fuer-den-vertrag-1234");
  });

  it("listeDateien(ordnerId): derselbe Weg, nur auf den Ordner gescoped", async () => {
    let url = "";
    const fetchFn = (async (u: string) => {
      url = String(u);
      return okJson({ value: [] });
    }) as unknown as typeof fetch;
    await new SharePointGraphClient(cfg(fetchFn)).listeDateien("01ORDNER");
    expect(url).toContain("/drives/b!bibliothek/items/01ORDNER/children");
  });

  it("listeDateien: folgt dem nextLink und meldet `truncated`, wenn der Deckel greift", async () => {
    let aufrufe = 0;
    const fetchFn = (async () => {
      aufrufe += 1;
      return okJson({
        value: [{ id: `f${aufrufe}`, name: `f${aufrufe}.docx`, file: {} }],
        "@odata.nextLink":
          "https://graph.microsoft.test/v1.0/drives/b!bibliothek/root/children?skip",
      });
    }) as unknown as typeof fetch;

    const ergebnis = await new SharePointGraphClient(cfg(fetchFn, { maxPages: 3 })).listeDateien();

    expect(aufrufe).toBe(3);
    expect(ergebnis.items).toHaveLength(3);
    // Eine gedeckelte Liste sagt, dass sie gedeckelt ist — sie gibt sich nie für „alles" aus.
    expect(ergebnis.truncated).toBe(true);
  });

  it("der nextLink ist FREMDER Text und wird gepinnt: fremde Origin ⇒ Abbruch, kein zweiter Aufruf dorthin", async () => {
    const angefragt: string[] = [];
    const fetchFn = (async (u: string) => {
      angefragt.push(String(u));
      return okJson({
        value: [{ id: "1", name: "A.docx", file: {} }],
        "@odata.nextLink": "https://boese.example/abfluss",
      });
    }) as unknown as typeof fetch;

    await expect(new SharePointGraphClient(cfg(fetchFn)).listeDateien()).rejects.toThrow();
    expect(angefragt).toHaveLength(1);
    expect(angefragt[0]).toContain("graph.microsoft.test");
  });

  it("plain-http Basisadresse ⇒ Abbruch OHNE Netzaufruf (kein Token an einen unverschlüsselten Host)", async () => {
    let gerufen = false;
    const fetchFn = (async () => {
      gerufen = true;
      return okJson({ value: [] });
    }) as unknown as typeof fetch;
    await expect(
      new SharePointGraphClient(
        cfg(fetchFn, { baseUrl: "http://graph.microsoft.test/v1.0" }),
      ).listeDateien(),
    ).rejects.toThrow();
    expect(gerufen).toBe(false);
  });

  it('die drei Statuszahlen bekommen ihre EIGENE Lage, alles Übrige wird „nicht erreichbar"', async () => {
    const faelle = [
      { code: 401, lage: "abgelaufen" },
      { code: 403, lage: "keine-berechtigung" },
      { code: 404, lage: "nicht-gefunden" },
      { code: 500, lage: "nicht-erreichbar" },
      { code: 429, lage: "nicht-erreichbar" },
    ] as const;
    for (const fall of faelle) {
      const fetchFn = (async () => status(fall.code)) as unknown as typeof fetch;
      const fehler = await new SharePointGraphClient(cfg(fetchFn))
        .listeDateien()
        .then(() => null)
        .catch((err: unknown) => err);
      expect(sharepointFehlerlage(fehler), `Status ${fall.code}`).toBe(fall.lage);
    }
  });

  it('holeDatei: gezielter Abruf EINER Datei; ein 404 ist die Lage „nicht gefunden", kein leeres Ergebnis', async () => {
    const treffer = { id: "01A", name: "Wartungsanweisung.docx", file: {} };
    const fetchFn = (async (u: string) =>
      String(u).includes("/items/01A") ? okJson(treffer) : status(404)) as unknown as typeof fetch;
    const client = new SharePointGraphClient(cfg(fetchFn));
    expect((await client.holeDatei("01A")).name).toBe("Wartungsanweisung.docx");
    const fehler = await client
      .holeDatei("weg")
      .then(() => null)
      .catch((err: unknown) => err);
    expect(sharepointFehlerlage(fehler)).toBe("nicht-gefunden");
  });

  it("ein FREMDER Fehler trägt keine Lage — der Aufrufer darf ihn nicht als Diagnose lesen", () => {
    expect(sharepointFehlerlage(new Error("irgendwas"))).toBeNull();
    expect(sharepointFehlerlage(null)).toBeNull();
    expect(sharepointFehlerlage({ lage: "erfunden" })).toBeNull();
  });

  it("pruefeGraphUrl pinnt https UND Origin", () => {
    const origin = "https://graph.microsoft.test";
    expect(() => pruefeGraphUrl("https://graph.microsoft.test/v1.0/drives", origin)).not.toThrow();
    expect(() => pruefeGraphUrl("http://graph.microsoft.test/v1.0", origin)).toThrow();
    expect(() => pruefeGraphUrl("https://boese.example/v1.0", origin)).toThrow();
    expect(() => pruefeGraphUrl("keine-url", origin)).toThrow();
  });

  it("sharepointClientFromEnv: unvollständig oder nicht-https ⇒ KEIN Client", () => {
    const voll = {
      KLARWERK_SHAREPOINT_BASE_URL: "https://graph.microsoft.test/v1.0",
      KLARWERK_SHAREPOINT_TOKEN: "t",
      KLARWERK_SHAREPOINT_DRIVE: "d",
    };
    expect(sharepointClientFromEnv(voll)).toBeDefined();
    for (const fehlt of Object.keys(voll)) {
      expect(sharepointClientFromEnv({ ...voll, [fehlt]: "" }), fehlt).toBeUndefined();
    }
    expect(
      sharepointClientFromEnv({ ...voll, KLARWERK_SHAREPOINT_BASE_URL: "http://graph.test" }),
    ).toBeUndefined();
  });

  it("kein Fehlertext dieses Clients trägt Adresse oder Zugangsmerkmal", async () => {
    // Die Meldungen sind FESTE Sätze je Lage — ein fremder Fetch-Fehler wird nicht übernommen,
    // auch nicht als `cause`. Das ist die strukturelle Fassung der Zusage „kein Leck".
    const fetchFn = (async () => {
      throw new Error(
        "connect ECONNREFUSED https://nur-fuer-den-vertrag-1234@graph.microsoft.test/v1.0/drives",
      );
    }) as unknown as typeof fetch;
    const fehler = await new SharePointGraphClient(cfg(fetchFn))
      .listeDateien()
      .then(() => null)
      .catch((err: unknown) => err);
    const text = `${(fehler as Error).message}${JSON.stringify(fehler)}`;
    expect(text).not.toContain("nur-fuer-den-vertrag-1234");
    expect(text).not.toContain("graph.microsoft.test");
    expect(sharepointFehlerlage(fehler)).toBe("nicht-erreichbar");
  });
});
