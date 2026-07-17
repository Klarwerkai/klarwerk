import { describe, expect, it } from "vitest";
import {
  type ConfluencePage,
  ConfluenceRestClient,
  assertAllowedConfluenceUrl,
  confluenceClientFromEnv,
} from "./rest-client";

// SCRUM-510/R2a: read-only REST-Client gegen ein DETERMINISTISCHES Fixture (injizierter fetch) — KEIN
// Live-Token, kein Netz. Echte Credentials nur zur Laufzeit via env. Zusätzlich Credential-Egress-
// Härtung: HTTPS-Origin-Pinning, redirect:"error", Token nie in URL/als Rückgabewert.

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const cfg = (fetchFn: typeof fetch, over: Record<string, unknown> = {}) => ({
  baseUrl: "https://acme.atlassian.net/wiki",
  email: "svc@acme.example",
  apiToken: "read-only-tok-123",
  spaceKey: "K",
  fetchFn,
  ...over,
});

describe("SCRUM-510: ConfluenceRestClient (read-only, fixture)", () => {
  it("listPages: read-only GET, auf den Space gescoped, Basic-Auth, redirect:error, Token nie in URL", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = String(u);
      init = i;
      return okJson({ results: [{ id: "1", title: "A" } satisfies ConfluencePage] });
    }) as unknown as typeof fetch;

    const pages = await new ConfluenceRestClient(cfg(fetchFn)).listPages();

    expect(pages).toHaveLength(1);
    expect(init?.method).toBe("GET"); // ausschließlich lesend
    expect(init?.redirect).toBe("error"); // R2a: kein Folgen auf fremde Hosts
    expect(url).toContain("/rest/api/content?");
    expect(url).toContain("spaceKey=K"); // gescoped auf Space K
    expect(url).toContain("type=page");
    const auth = (init?.headers as Record<string, string>).authorization;
    expect(auth).toBe(
      `Basic ${Buffer.from("svc@acme.example:read-only-tok-123").toString("base64")}`,
    );
    // R2a: der Token steht NIE im Klartext in der URL.
    expect(url).not.toContain("read-only-tok-123");
  });

  it("listPages: wirft bei Fehlerstatus (kein stilles Leeres)", async () => {
    const fetchFn = (async () =>
      ({ ok: false, status: 403 }) as unknown as Response) as unknown as typeof fetch;
    await expect(new ConfluenceRestClient(cfg(fetchFn)).listPages()).rejects.toThrow("403");
  });

  it("R2a: plain-http baseUrl → Abbruch OHNE Netzcall (kein Token an unverschlüsselten Host)", async () => {
    let called = false;
    const fetchFn = (async () => {
      called = true;
      return okJson({ results: [] });
    }) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient(
        cfg(fetchFn, { baseUrl: "http://acme.atlassian.net/wiki" }),
      ).listPages(),
    ).rejects.toThrow();
    expect(called).toBe(false); // kein Request abgesetzt
  });

  it("R2a: Redirect → Fehler, KEIN zweiter Request (fetch mit redirect:error wirft, Client folgt nie)", async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      // wie native fetch mit redirect:"error" auf eine 3xx-Antwort: es wirft, statt zu folgen.
      throw new TypeError("Failed to fetch: redirect not allowed");
    }) as unknown as typeof fetch;
    await expect(new ConfluenceRestClient(cfg(fetchFn)).listPages()).rejects.toThrow();
    expect(calls).toBe(1); // genau ein Versuch, kein Folge-Request auf den fremden Host
  });

  it("R2a: assertAllowedConfluenceUrl pinnt https + Origin", () => {
    const origin = "https://acme.atlassian.net";
    expect(() =>
      assertAllowedConfluenceUrl("https://acme.atlassian.net/rest/api/content", origin),
    ).not.toThrow();
    expect(() => assertAllowedConfluenceUrl("http://acme.atlassian.net/x", origin)).toThrow(); // plain-http
    expect(() => assertAllowedConfluenceUrl("https://evil.example/x", origin)).toThrow(); // fremde Origin
  });

  it("confluenceClientFromEnv: nur mit vollständigen, DEDIZIERTEN https-env-Variablen (getrennt vom Modell)", () => {
    const full = {
      KLARWERK_CONFLUENCE_BASE_URL: "https://acme.atlassian.net/wiki",
      KLARWERK_CONFLUENCE_USER: "u",
      KLARWERK_CONFLUENCE_TOKEN: "t",
      KLARWERK_CONFLUENCE_SPACE: "K",
    };
    expect(confluenceClientFromEnv(full)?.spaceKey).toBe("K"); // liefert einen CLIENT (kein Token-Wert)
    // fehlt EINE → kein Client.
    expect(
      confluenceClientFromEnv({ ...full, KLARWERK_CONFLUENCE_TOKEN: undefined }),
    ).toBeUndefined();
    // R2a: plain-http baseUrl → kein Client.
    expect(
      confluenceClientFromEnv({
        ...full,
        KLARWERK_CONFLUENCE_BASE_URL: "http://acme.atlassian.net/wiki",
      }),
    ).toBeUndefined();
    // Die Modell-Credentials (ANTHROPIC_API_KEY) allein reichen NICHT (getrennter Namespace).
    expect(confluenceClientFromEnv({ ANTHROPIC_API_KEY: "k" })).toBeUndefined();
  });
});
