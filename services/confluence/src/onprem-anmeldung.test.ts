import { afterEach, describe, expect, it, vi } from "vitest";
import { confluenceCredentialState } from "./credential-state";
import { ConfluenceRestClient, confluenceClientFromEnv } from "./rest-client";

// R-0166 — Confluence im eigenen Haus (Data Center / Server). Neben der Cloud-Anmeldung (E-Mail +
// API-Token, Basic) gibt es den Weg mit persönlichem Zugriffstoken (PAT) als Bearer, ohne Kennung.
// Gewählt über KLARWERK_CONFLUENCE_AUTH=pat; das Token liegt weiter nur in KLARWERK_CONFLUENCE_TOKEN.
// Geprüft gegen einen ersetzten fetch — kein Netz, kein echtes Token, keine echte Instanz.

const PAT = "pat-nur-fuer-den-test-R0166-xyz";

const ONPREM = {
  KLARWERK_CONFLUENCE_AUTH: "pat",
  KLARWERK_CONFLUENCE_BASE_URL: "https://wiki.intern.example/confluence",
  KLARWERK_CONFLUENCE_TOKEN: PAT,
  KLARWERK_CONFLUENCE_SPACE: "HAUS",
};

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R-0166 · Anmeldeweg für selbst betriebenes Confluence", () => {
  it("aus der Umgebung: PAT geht als Bearer, ohne Kennung, an die eigene https-Instanz", async () => {
    const gesehen: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (u: string, i: RequestInit) => {
      gesehen.push({ url: String(u), init: i });
      return okJson({ results: [{ id: "1", title: "Hausseite" }] });
    });

    const client = confluenceClientFromEnv(ONPREM);
    expect(client).toBeDefined();
    const seiten = await client?.listPages();

    expect(seiten?.map((s) => s.id)).toEqual(["1"]);
    expect(gesehen).toHaveLength(1);
    const erster = gesehen[0];
    if (!erster) {
      throw new Error("kein Request gesehen");
    }
    const { url, init } = erster;
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${PAT}`);
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("error");
    // Kontextpfad der Hausinstanz bleibt erhalten; das Token steht nie in der URL.
    expect(url.startsWith("https://wiki.intern.example/confluence/rest/api/content?")).toBe(true);
    expect(url).toContain("spaceKey=HAUS");
    expect(url).not.toContain(PAT);
  });

  it("Cloud bleibt unverändert: ohne Auswahl Basic aus E-Mail und Token", async () => {
    let auth = "";
    vi.stubGlobal("fetch", async (_u: string, i: RequestInit) => {
      auth = (i.headers as Record<string, string>).authorization ?? "";
      return okJson({ results: [] });
    });
    const cloud = {
      KLARWERK_CONFLUENCE_BASE_URL: "https://acme.atlassian.net/wiki",
      KLARWERK_CONFLUENCE_USER: "svc@acme.example",
      KLARWERK_CONFLUENCE_TOKEN: "cloud-tok",
      KLARWERK_CONFLUENCE_SPACE: "K",
    };
    await confluenceClientFromEnv(cloud)?.listPages();
    expect(auth).toBe(`Basic ${Buffer.from("svc@acme.example:cloud-tok").toString("base64")}`);
    // `cloud` ausdrücklich gesetzt ist dasselbe.
    await confluenceClientFromEnv({ ...cloud, KLARWERK_CONFLUENCE_AUTH: "cloud" })?.listPages();
    expect(auth.startsWith("Basic ")).toBe(true);
    // Cloud ohne Kennung bleibt ohne Client.
    expect(
      confluenceClientFromEnv({ ...cloud, KLARWERK_CONFLUENCE_USER: undefined }),
    ).toBeUndefined();
  });

  it("PAT-Weg: fehlendes Token/Space, http-Adresse oder unbekannter Weg ⇒ kein Client", () => {
    expect(confluenceClientFromEnv({ ...ONPREM, KLARWERK_CONFLUENCE_TOKEN: "" })).toBeUndefined();
    expect(
      confluenceClientFromEnv({ ...ONPREM, KLARWERK_CONFLUENCE_SPACE: undefined }),
    ).toBeUndefined();
    expect(
      confluenceClientFromEnv({
        ...ONPREM,
        KLARWERK_CONFLUENCE_BASE_URL: "http://wiki.intern.example/confluence",
      }),
    ).toBeUndefined();
    // Kein stiller Rückfall auf Cloud bei einem Tippfehler.
    expect(
      confluenceClientFromEnv({
        ...ONPREM,
        KLARWERK_CONFLUENCE_AUTH: "bearer-irgendwas",
        KLARWERK_CONFLUENCE_USER: "svc",
      }),
    ).toBeUndefined();
  });

  it("PAT-Weg: das Token erscheint in keinem Fehlertext", async () => {
    const boom = (async () => {
      throw new Error(`connect failed, header Bearer ${PAT}`);
    }) as unknown as typeof fetch;
    await expect(
      new ConfluenceRestClient({
        baseUrl: ONPREM.KLARWERK_CONFLUENCE_BASE_URL,
        authMode: "pat",
        apiToken: PAT,
        spaceKey: "HAUS",
        fetchFn: boom,
      }).listPages(),
    ).rejects.toSatisfy((e: unknown) => {
      const err = e as Error;
      expect(err.message).not.toContain(PAT);
      expect(String(err.stack ?? "")).not.toContain(PAT);
      return true;
    });
  });

  it("Zustandsauskunft: PAT-Weg verlangt keine Kennung, nennt den Weg, nie den Wert", () => {
    const s = confluenceCredentialState(ONPREM);
    expect(s.usable).toBe(true);
    expect(s.blocker).toBeNull();
    expect(s.authMode).toBe("pat");
    expect(s.vars.map((v) => v.name)).toEqual([
      "KLARWERK_CONFLUENCE_BASE_URL",
      "KLARWERK_CONFLUENCE_TOKEN",
      "KLARWERK_CONFLUENCE_SPACE",
      "KLARWERK_CONFLUENCE_AUTH",
    ]);
    const roh = JSON.stringify(s);
    expect(roh).not.toContain(PAT);
    expect(roh).not.toContain("intern.example");
    expect(roh).not.toContain(String(PAT.length));

    const ohneToken = confluenceCredentialState({ ...ONPREM, KLARWERK_CONFLUENCE_TOKEN: "" });
    expect(ohneToken.usable).toBe(false);
    expect(ohneToken.blocker).toBe("missing");
    expect(ohneToken.vars.filter((v) => !v.present).map((v) => v.name)).toEqual([
      "KLARWERK_CONFLUENCE_TOKEN",
    ]);
  });

  it("Zustandsauskunft: unbekannter Weg ist nicht nutzbar; Cloud ohne Auswahl bleibt bei vier Namen", () => {
    const falsch = confluenceCredentialState({
      ...ONPREM,
      KLARWERK_CONFLUENCE_AUTH: "kerberos",
      KLARWERK_CONFLUENCE_USER: "svc",
    });
    expect(falsch.usable).toBe(false);
    expect(falsch.blocker).toBe("missing");
    expect(falsch.authMode).toBeNull();
    expect(falsch.vars.find((v) => v.name === "KLARWERK_CONFLUENCE_AUTH")?.present).toBe(false);
    expect(JSON.stringify(falsch)).not.toContain("kerberos");

    const cloud = confluenceCredentialState({});
    expect(cloud.authMode).toBe("cloud");
    expect(cloud.vars.map((v) => v.name)).toEqual([
      "KLARWERK_CONFLUENCE_BASE_URL",
      "KLARWERK_CONFLUENCE_USER",
      "KLARWERK_CONFLUENCE_TOKEN",
      "KLARWERK_CONFLUENCE_SPACE",
    ]);
  });
});
