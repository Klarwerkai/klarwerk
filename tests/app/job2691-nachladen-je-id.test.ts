import { describe, expect, it } from "vitest";
import { adapterFromConfig } from "../../services/confluence/src/adapter";
import { ConfluenceRestClient } from "../../services/confluence/src/rest-client";

// ================================================================================================
// JOB 2691 D1 — DAS NACHLADEN JE ID GEHT DENSELBEN NETZWEG WIE DAS SPACE-LISTING
// ================================================================================================
//
// `getPageById` teilt sich mit `listAllPages` den einen Request-Bauer (`getJson`): Origin-Pin,
// `redirect:error`, Basic-Auth, Redaction. Diese Faelle halten fest, dass das Nachladen keinen
// zweiten, abweichenden Weg bekommen hat — und dass 404 „gibt es nicht mehr" heisst, kein Fehler.

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function clientMit(fetchFn: typeof fetch, baseUrl = "https://acme.atlassian.net/wiki") {
  return new ConfluenceRestClient({
    baseUrl,
    email: "svc@acme.test",
    apiToken: "GEHEIM-TOKEN",
    spaceKey: "K",
    fetchFn,
  });
}

describe("JOB 2691 D1 · Nachladen je Id", () => {
  it("N1 · fragt GENAU eine Seite mit vollem Expand an, an der gepinnten Origin, ohne Redirect", async () => {
    const rufe: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      rufe.push({ url: String(url), init });
      return antwort(200, { id: "p1", title: "Wartung Pumpe", body: { storage: { value: "<p>voll</p>" } } });
    }) as unknown as typeof fetch;
    const seite = await clientMit(fetchFn).getPageById("p1");
    expect(seite?.id).toBe("p1");
    expect(rufe).toHaveLength(1);
    const u = new URL(rufe[0]?.url ?? "");
    expect(u.origin).toBe("https://acme.atlassian.net");
    expect(u.pathname).toBe("/wiki/rest/api/content/p1");
    expect(u.searchParams.get("expand")).toContain("body.storage");
    expect(rufe[0]?.init?.redirect).toBe("error");
    expect(String((rufe[0]?.init?.headers as Record<string, string>).authorization)).toMatch(/^Basic /);
  });

  it("N2 · 404 heisst „gibt es nicht mehr“ — undefined, kein Fehler", async () => {
    const fetchFn = (async () => antwort(404, { message: "not found" })) as unknown as typeof fetch;
    await expect(clientMit(fetchFn).getPageById("weg")).resolves.toBeUndefined();
  });

  it("N3 · jeder andere Nicht-2xx bleibt ein Fehler mit nur der Statuszahl", async () => {
    const fetchFn = (async () => antwort(500, {})) as unknown as typeof fetch;
    await expect(clientMit(fetchFn).getPageById("p1")).rejects.toThrow("antwortete mit 500");
  });

  it("N4 · plain-http baseUrl: Abbruch VOR dem Netzcall — der Token verlaesst den Prozess nicht", async () => {
    let gerufen = 0;
    const fetchFn = (async () => {
      gerufen += 1;
      return antwort(200, { id: "p1" });
    }) as unknown as typeof fetch;
    await expect(clientMit(fetchFn, "http://acme.atlassian.net/wiki").getPageById("p1")).rejects.toThrow();
    expect(gerufen).toBe(0);
  });

  it("N5 · die Id wird URL-kodiert — eine Id mit Sonderzeichen kann den Pfad nicht verlassen", async () => {
    const rufe: string[] = [];
    const fetchFn = (async (url: string | URL | Request) => {
      rufe.push(String(url));
      return antwort(404, {});
    }) as unknown as typeof fetch;
    await clientMit(fetchFn).getPageById("../admin?x=1");
    expect(new URL(rufe[0] ?? "").pathname).toBe("/wiki/rest/api/content/..%2Fadmin%3Fx%3D1");
  });

  it("N6 · der Adapter liefert das gemappte Item MIT Volltext, und undefined fuer eine verschwundene Seite", async () => {
    const fetchFn = (async (url: string | URL | Request) =>
      String(url).includes("/content/p1")
        ? antwort(200, {
            id: "p1",
            title: "Wartung &amp; Pflege",
            version: { number: 3 },
            body: { storage: { value: "<p>Der volle Text</p>" } },
          })
        : antwort(404, {})) as unknown as typeof fetch;
    const adapter = adapterFromConfig({
      baseUrl: "https://acme.atlassian.net/wiki",
      email: "svc@acme.test",
      apiToken: "GEHEIM-TOKEN",
      spaceKey: "K",
      fetchFn,
    });
    const item = await adapter.fetchItem("p1");
    expect(item?.externalId).toBe("p1");
    expect(item?.sourceVersion).toBe(3);
    expect(item?.title).toBe("Wartung & Pflege");
    expect(item?.bodyHtml).toContain("Der volle Text");
    await expect(adapter.fetchItem("p2")).resolves.toBeUndefined();
  });
});
