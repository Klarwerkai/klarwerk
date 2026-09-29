import { describe, expect, it } from "vitest";
import { CONFLUENCE_AUTH_VAR, confluenceCredentialState } from "./credential-state";
import {
  type ConfluencePage,
  ConfluenceRestClient,
  confluenceAuthModeFrom,
  confluenceClientFromEnv,
} from "./rest-client";

// ================================================================================================
// R-0166 — CONFLUENCE IM EIGENEN HAUS: PERSONAL ACCESS TOKEN STATT E-MAIL + API-TOKEN
// ================================================================================================
//
// Gemessen wird die ganze Kette, die ein Betreiber berührt: welchen Kopf der Client sendet, wann
// aus der Umgebung ein Client entsteht, was die Zugangsauskunft meldet — und dass der PAT so wenig
// in einer Fehlermeldung landet wie bisher der Cloud-Token. Deterministisch, ohne Netz.

const PAT = "PAT-geheim-4711-xyz";

const PAT_ENV = {
  KLARWERK_CONFLUENCE_AUTH: "pat",
  KLARWERK_CONFLUENCE_BASE_URL: "https://confluence.firma.example/confluence",
  KLARWERK_CONFLUENCE_TOKEN: PAT,
  KLARWERK_CONFLUENCE_SPACE: "OPS",
};

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe("R-0166 · Anmeldeart aus der Umgebung", () => {
  it("ungesetzt/leer = cloud (heutiges Verhalten), cloud/pat in jeder Schreibweise, sonst nichts", () => {
    expect(confluenceAuthModeFrom(undefined)).toBe("cloud");
    expect(confluenceAuthModeFrom("")).toBe("cloud");
    expect(confluenceAuthModeFrom(" PAT ")).toBe("pat");
    expect(confluenceAuthModeFrom("Cloud")).toBe("cloud");
    expect(confluenceAuthModeFrom("basic")).toBeUndefined();
    expect(confluenceAuthModeFrom("oauth")).toBeUndefined();
  });
});

describe("R-0166 · der Client sendet je Anmeldeart den passenden Kopf", () => {
  it("pat: Authorization: Bearer <PAT>, keine Kennung nötig, gleiche Lese-URL", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fetchFn = (async (u: string, i: RequestInit) => {
      url = String(u);
      init = i;
      return okJson({ results: [{ id: "1", title: "A" } satisfies ConfluencePage] });
    }) as unknown as typeof fetch;

    const client = new ConfluenceRestClient({
      baseUrl: PAT_ENV.KLARWERK_CONFLUENCE_BASE_URL,
      apiToken: PAT,
      spaceKey: "OPS",
      authMode: "pat",
      fetchFn,
    });
    await client.listPages();

    expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${PAT}`);
    expect(init?.redirect).toBe("error");
    // Server/Data Center: derselbe REST-Pfad unter dem Kontextpfad der Instanz.
    expect(url.startsWith("https://confluence.firma.example/confluence/rest/api/content?")).toBe(
      true,
    );
    expect(url).not.toContain(PAT);
  });

  it("cloud bleibt Basic aus E-Mail + Token", async () => {
    let init: RequestInit | undefined;
    const fetchFn = (async (_u: string, i: RequestInit) => {
      init = i;
      return okJson({ results: [] });
    }) as unknown as typeof fetch;
    await new ConfluenceRestClient({
      baseUrl: "https://acme.atlassian.net/wiki",
      email: "svc@acme.example",
      apiToken: "tok",
      spaceKey: "K",
      fetchFn,
    }).listPages();
    expect((init?.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from("svc@acme.example:tok").toString("base64")}`,
    );
  });

  it("pat: der Token steht in KEINER Fehlermeldung (fetch-Fehler, Parse-Fehler)", async () => {
    const wirft = (async () => {
      throw new Error(`connect failed, header was Bearer ${PAT}`);
    }) as unknown as typeof fetch;
    const client = (fetchFn: typeof fetch) =>
      new ConfluenceRestClient({
        baseUrl: PAT_ENV.KLARWERK_CONFLUENCE_BASE_URL,
        apiToken: PAT,
        spaceKey: "OPS",
        authMode: "pat",
        fetchFn,
      });
    const e1 = await client(wirft)
      .listPages()
      .catch((e: Error) => e);
    expect(String((e1 as Error).message)).not.toContain(PAT);
    expect(String((e1 as Error).stack)).not.toContain(PAT);

    const kaputt = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error(`Unexpected token in ${PAT}`);
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const e2 = await client(kaputt)
      .listPages()
      .catch((e: Error) => e);
    expect(String((e2 as Error).message)).not.toContain(PAT);
  });
});

describe("R-0166 · Client aus der Umgebung", () => {
  it("pat ohne KLARWERK_CONFLUENCE_USER ergibt einen Client", () => {
    expect(confluenceClientFromEnv(PAT_ENV)?.spaceKey).toBe("OPS");
  });

  it("cloud ohne Kennung ergibt weiterhin KEINEN Client", () => {
    const { KLARWERK_CONFLUENCE_AUTH: _weg, ...ohneAuth } = PAT_ENV;
    expect(confluenceClientFromEnv(ohneAuth)).toBeUndefined();
    expect(confluenceClientFromEnv({ ...ohneAuth, KLARWERK_CONFLUENCE_AUTH: "cloud" })).toBe(
      undefined,
    );
  });

  it("unbekannte Anmeldeart ergibt KEINEN Client — auch wenn alle Werte stehen (fail-closed)", () => {
    expect(
      confluenceClientFromEnv({
        ...PAT_ENV,
        KLARWERK_CONFLUENCE_USER: "svc@firma.example",
        KLARWERK_CONFLUENCE_AUTH: "basic",
      }),
    ).toBeUndefined();
  });

  it("pat mit http-Adresse ergibt KEINEN Client (HTTPS-Riegel gilt für beide Wege)", () => {
    expect(
      confluenceClientFromEnv({
        ...PAT_ENV,
        KLARWERK_CONFLUENCE_BASE_URL: "http://confluence.firma.example",
      }),
    ).toBeUndefined();
  });
});

describe("R-0166 · die Zugangsauskunft kennt beide Wege", () => {
  it("pat: die Kennung wird nicht verlangt, drei Werte genügen", () => {
    const s = confluenceCredentialState(PAT_ENV);
    expect(s.authMode).toBe("pat");
    expect(s.vars.map((v) => v.name)).toEqual([
      "KLARWERK_CONFLUENCE_BASE_URL",
      "KLARWERK_CONFLUENCE_TOKEN",
      "KLARWERK_CONFLUENCE_SPACE",
    ]);
    expect(s.usable).toBe(true);
    expect(s.blocker).toBeNull();
    // Kein Wert, keine Länge in der Auskunft.
    expect(JSON.stringify(s)).not.toContain(PAT);
  });

  it("cloud (Vorgabe): alle vier Werte, fehlende Kennung = missing", () => {
    const { KLARWERK_CONFLUENCE_AUTH: _weg, ...ohneAuth } = PAT_ENV;
    const s = confluenceCredentialState(ohneAuth);
    expect(s.authMode).toBe("cloud");
    expect(s.vars.map((v) => v.name)).toContain("KLARWERK_CONFLUENCE_USER");
    expect(s.blocker).toBe("missing");
  });

  it("unbekannte Anmeldeart: eigener Riegel statt „fehlt“", () => {
    const s = confluenceCredentialState({ ...PAT_ENV, [CONFLUENCE_AUTH_VAR]: "kerberos" });
    expect(s.usable).toBe(false);
    expect(s.blocker).toBe("invalid-auth-mode");
    expect(s.authMode).toBeNull();
  });

  it("Auskunft und Client-Bau sind sich einig (keine zweite Wahrheit)", () => {
    const faelle: Record<string, string | undefined>[] = [
      PAT_ENV,
      { ...PAT_ENV, KLARWERK_CONFLUENCE_AUTH: "cloud" },
      { ...PAT_ENV, KLARWERK_CONFLUENCE_AUTH: "cloud", KLARWERK_CONFLUENCE_USER: "u" },
      { ...PAT_ENV, KLARWERK_CONFLUENCE_AUTH: "x" },
      { ...PAT_ENV, KLARWERK_CONFLUENCE_TOKEN: "" },
      { ...PAT_ENV, KLARWERK_CONFLUENCE_BASE_URL: "http://h" },
    ];
    for (const env of faelle) {
      expect(
        confluenceCredentialState(env).usable,
        JSON.stringify(env.KLARWERK_CONFLUENCE_AUTH),
      ).toBe(confluenceClientFromEnv(env) !== undefined);
    }
  });
});
