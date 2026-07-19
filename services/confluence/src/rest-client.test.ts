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

// SCRUM-510-R3 (WP1, Import-Härtung): Token-Redaction + Tenant-Origin strukturell. Pins, dass der
// read-only API-Token in KEINEM Fehlertext auftaucht und jeder ausgehende Request strukturell nur an
// die EINE konfigurierte Confluence-Origin geht (fremd/plain-http/Redirect → Abbruch).
describe("SCRUM-510-R3 (WP1): Token-Redaction + Tenant-Origin", () => {
  const SECRET = "SUPER-GEHEIM-abcXYZ-987";
  const secretB64 = Buffer.from(`svc@acme.example:${SECRET}`, "utf8").toString("base64");

  function assertNoTokenLeak(text: string): void {
    expect(text).not.toContain(SECRET); // Roh-Token nie im Fehlertext
    expect(text).not.toContain(secretB64); // auch nicht die Basic-Auth-Base64
  }

  it("Token taucht in KEINEM Fehlertext auf (non-ok, fetch-throw, plain-http)", async () => {
    // (a) non-ok Status
    const notOk = (async () =>
      ({ ok: false, status: 500 }) as unknown as Response) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient(cfg(notOk, { apiToken: SECRET })).listPages(),
    ).rejects.toSatisfy((e: unknown) => {
      assertNoTokenLeak(String((e as Error).message));
      return true;
    });
    // (b) SCRUM-510-R3 (WP4): fetch wirft (Netz/TLS) — und der Fetch-Fehler TRÄGT den Token in seiner
    // Message. Der Client muss ihn REDIGIERT propagieren; ohne den zentralen Redaction-Wrapper landete
    // der Roh-Token im propagierten Fehlertext → dieser Test scheitert.
    const boom = (async () => {
      throw new Error(`network down while calling https://acme.atlassian.net?token=${SECRET}`);
    }) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient(cfg(boom, { apiToken: SECRET })).listPages(),
    ).rejects.toSatisfy((e: unknown) => {
      const err = e as Error;
      assertNoTokenLeak(String(err.message));
      assertNoTokenLeak(String(err.stack ?? "")); // auch der Stack ist leck-frei (neuer, eigener Stack)
      return true;
    });
    // (c) plain-http baseUrl → Abbruch VOR fetch; Fehlertext ohne Token
    const spy = (async () => okJson({ results: [] })) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient(
        cfg(spy, { apiToken: SECRET, baseUrl: "http://acme.atlassian.net/wiki" }),
      ).listPages(),
    ).rejects.toSatisfy((e: unknown) => {
      assertNoTokenLeak(String((e as Error).message));
      return true;
    });
  });

  // SCRUM-510-R3 (WP4): Timeout/AbortError beim fetch → der (token-tragende) Fehler wird redigiert
  // propagiert. Der Client bricht nie mit dem Roh-Token in Message/Stack ab.
  it("WP4: fetch-Timeout mit Token im Fehler → redigiert propagiert (Message+Stack leck-frei)", async () => {
    const timeout = (async () => {
      const e = new Error(`fetch timed out for https://acme.atlassian.net/rest?auth=${SECRET}`);
      e.name = "TimeoutError";
      throw e;
    }) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient(cfg(timeout, { apiToken: SECRET })).listPages(),
    ).rejects.toSatisfy((e: unknown) => {
      const err = e as Error;
      assertNoTokenLeak(String(err.message));
      assertNoTokenLeak(String(err.stack ?? ""));
      return true;
    });
  });

  // SCRUM-510-R3 (WP4): auch ein Parse-Fehler (res.json wirft) mit Token im Text wird redigiert.
  it("WP4: Parse-Fehler mit Token → redigiert propagiert", async () => {
    const badJson = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error(`invalid json near token ${SECRET}`);
        },
      }) as unknown as Response) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient(cfg(badJson, { apiToken: SECRET })).listPages(),
    ).rejects.toSatisfy((e: unknown) => {
      assertNoTokenLeak(String((e as Error).message));
      return true;
    });
  });

  // SCRUM-510-R3 (WP4): ein credential-tragender URL-Anteil (user:pass@host) im Fehlertext wird generisch
  // entschärft — auch wenn es nicht der eigene Token ist (defensiv gegen fremde/unerwartete Credentials).
  it("WP4: credentialed URL (user:pass@host) im Fehler → userinfo entfernt", async () => {
    const leak = (async () => {
      throw new Error("connect failed to https://svc:hunter2@acme.atlassian.net/rest/api/content");
    }) as unknown as typeof fetch;
    await expect(new ConfluenceRestClient(cfg(leak)).listPages()).rejects.toSatisfy(
      (e: unknown) => {
        const msg = String((e as Error).message);
        expect(msg).not.toContain("hunter2");
        expect(msg).not.toContain("svc:hunter2");
        return true;
      },
    );
  });

  it("jeder Request geht NUR an die konfigurierte Origin; fremde Origin/Protokoll → Abbruch", () => {
    const origin = "https://acme.atlassian.net";
    expect(() =>
      assertAllowedConfluenceUrl("https://acme.atlassian.net/rest/api/content", origin),
    ).not.toThrow();
    for (const bad of [
      "http://acme.atlassian.net/x", // plain-http
      "https://evil.example/x", // fremder Host
      "https://acme.atlassian.net.evil.example/x", // Suffix-Trick
    ]) {
      expect(() => assertAllowedConfluenceUrl(bad, origin)).toThrow();
    }
  });

  it('listPages nutzt redirect:"error" und schreibt den Token nie in die URL', async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const fetchFn = (async (u: string, i: RequestInit) => {
      seenUrl = String(u);
      seenInit = i;
      return okJson({ results: [] });
    }) as unknown as typeof fetch;
    await new ConfluenceRestClient(cfg(fetchFn, { apiToken: SECRET })).listPages();
    expect(seenInit?.redirect).toBe("error");
    expect(seenUrl).not.toContain(SECRET);
    expect(seenUrl).not.toContain(secretB64);
    // Der Token lebt ausschließlich im Authorization-Header (Basic-Auth).
    expect((seenInit?.headers as Record<string, string>).authorization).toBe(`Basic ${secretB64}`);
  });
});

// SCRUM-510 WP2: Cursor-Pagination — listAllPages folgt _links.next (mit gepinnter Origin), redirect:error.
describe("SCRUM-510 WP2: ConfluenceRestClient.listAllPages (Pagination)", () => {
  it("folgt _links.next über Seitengrenzen; jeder Hop nur an die gepinnte Origin, redirect:error", async () => {
    const urls: string[] = [];
    const inits: RequestInit[] = [];
    const fetchFn = (async (u: string, i: RequestInit) => {
      urls.push(String(u));
      inits.push(i);
      // Erste Antwort: 2 Seiten + next; zweite Antwort: 1 Seite, kein next.
      const body =
        urls.length === 1
          ? {
              results: [
                { id: "1", title: "A" },
                { id: "2", title: "B" },
              ],
              _links: { next: "/wiki/rest/api/content?start=2" },
            }
          : { results: [{ id: "3", title: "C" }], _links: {} };
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }) as unknown as typeof fetch;

    const client = new ConfluenceRestClient({
      baseUrl: "https://acme.atlassian.net/wiki",
      email: "svc@acme.example",
      apiToken: "tok",
      spaceKey: "K",
      fetchFn,
    });
    const { pages, truncated } = await client.listAllPages();
    expect(pages.map((p) => p.id)).toEqual(["1", "2", "3"]); // beide Ergebnisseiten
    expect(truncated).toBe(false); // sauber bis zum letzten Cursor gelesen
    expect(urls).toHaveLength(2);
    // Hop 2 = Origin + relativer next-Pfad; beide auf der gepinnten Origin.
    expect(urls[1]).toBe("https://acme.atlassian.net/wiki/rest/api/content?start=2");
    for (const u of urls) {
      expect(u.startsWith("https://acme.atlassian.net")).toBe(true);
    }
    for (const i of inits) {
      expect(i.redirect).toBe("error");
    }
  });

  // WP-E (19.07.2026): Atlassian Cloud liefert _links.next RELATIV ZUM KONTEXTPFAD (z. B.
  // "/rest/api/content?…" — der "/wiki"-Anteil steckt in _links.base, NICHT in next). Nur mit der
  // Origin präfixiert landete Hop 2 auf <origin>/rest/… (= Jira-Namensraum → 404/Redirect → Abbruch
  // ab der zweiten Ergebnisseite). Der Folge-Hop muss gegen die baseUrl (inkl. Kontextpfad) gehen.
  it("WP-E: next ohne Kontextpfad → Folge-Hop an baseUrl inkl. /wiki", async () => {
    const urls: string[] = [];
    const fetchFn = (async (u: string) => {
      urls.push(String(u));
      const body =
        urls.length === 1
          ? { results: [{ id: "1", title: "A" }], _links: { next: "/rest/api/content?start=1" } }
          : { results: [{ id: "2", title: "B" }], _links: {} };
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }) as unknown as typeof fetch;
    const client = new ConfluenceRestClient({
      baseUrl: "https://acme.atlassian.net/wiki",
      email: "svc@acme.example",
      apiToken: "tok",
      spaceKey: "K",
      fetchFn,
    });
    const { pages, truncated } = await client.listAllPages();
    expect(pages.map((p) => p.id)).toEqual(["1", "2"]);
    expect(truncated).toBe(false);
    expect(urls[1]).toBe("https://acme.atlassian.net/wiki/rest/api/content?start=1");
  });

  it("harte Iterations-Obergrenze bricht einen fehlerhaften next-Zyklus ab (kein Endlos)", async () => {
    const fetchFn = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: "x", title: "x" }],
          _links: { next: "/wiki/rest/api/content?start=0" },
        }),
      }) as unknown as Response) as unknown as typeof fetch;
    const client = new ConfluenceRestClient({
      baseUrl: "https://acme.atlassian.net/wiki",
      email: "e",
      apiToken: "t",
      spaceKey: "K",
      fetchFn,
    });
    // SCRUM-510 (WP3): der Cap greift — UND meldet ehrlich truncated=true (der next-Cursor ist noch offen),
    // damit der Aufrufer den Lauf nie als vollständig liest. Ohne den Fix (nacktes Array) fehlte das Signal.
    const { pages, truncated } = await client.listAllPages(3); // Obergrenze 3
    expect(pages).toHaveLength(3); // genau 3 Hops, dann Stopp
    expect(truncated).toBe(true);
  });
});
