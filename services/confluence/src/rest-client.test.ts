import { describe, expect, it } from "vitest";
import {
  type ConfluencePage,
  ConfluenceRestClient,
  confluenceRestConfigFromEnv,
} from "./rest-client";

// SCRUM-510: read-only REST-Client gegen ein DETERMINISTISCHES Fixture (injizierter fetch) — KEIN
// Live-Token, kein Netz. Echte Credentials nur zur Laufzeit via env.

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const cfg = (fetchFn: typeof fetch) => ({
  baseUrl: "https://acme.atlassian.net/wiki",
  email: "svc@acme.example",
  apiToken: "read-only-tok-123",
  spaceKey: "K",
  fetchFn,
});

describe("SCRUM-510: ConfluenceRestClient (read-only, fixture)", () => {
  it("listPages: read-only GET, auf den Space gescoped, Basic-Auth, liest results", async () => {
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
    expect(url).toContain("/rest/api/content?");
    expect(url).toContain("spaceKey=K"); // gescoped auf Space K
    expect(url).toContain("type=page");
    // Basic-Auth aus Service-Account + read-only Token …
    const auth = (init?.headers as Record<string, string>).authorization;
    expect(auth).toBe(
      `Basic ${Buffer.from("svc@acme.example:read-only-tok-123").toString("base64")}`,
    );
    // … der Token steht NIE im Klartext in der URL.
    expect(url).not.toContain("read-only-tok-123");
  });

  it("listPages: wirft bei Fehlerstatus (kein stilles Leeres)", async () => {
    const fetchFn = (async () =>
      ({ ok: false, status: 403 }) as unknown as Response) as unknown as typeof fetch;
    await expect(new ConfluenceRestClient(cfg(fetchFn)).listPages()).rejects.toThrow("403");
  });

  it("confluenceRestConfigFromEnv: nur mit vollständigen, DEDIZIERTEN env-Variablen (getrennt vom Modell)", () => {
    const full = {
      KLARWERK_CONFLUENCE_BASE_URL: "https://x/wiki",
      KLARWERK_CONFLUENCE_USER: "u",
      KLARWERK_CONFLUENCE_TOKEN: "t",
      KLARWERK_CONFLUENCE_SPACE: "K",
    };
    expect(confluenceRestConfigFromEnv(full)?.spaceKey).toBe("K");
    // fehlt EINE → kein Client.
    expect(
      confluenceRestConfigFromEnv({ ...full, KLARWERK_CONFLUENCE_TOKEN: undefined }),
    ).toBeUndefined();
    // Die Modell-Credentials (ANTHROPIC_API_KEY) allein reichen NICHT (getrennter Namespace).
    expect(confluenceRestConfigFromEnv({ ANTHROPIC_API_KEY: "k" })).toBeUndefined();
  });
});
