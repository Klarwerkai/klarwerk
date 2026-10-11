import { describe, expect, it } from "vitest";
import { ConfluenceRestClient } from "./rest-client";

function response(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function fixture(answer: (url: URL) => Response, authMode: "cloud" | "pat" = "cloud") {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return answer(new URL(url));
  }) as typeof fetch;
  const client = new ConfluenceRestClient({
    baseUrl: "https://acme.atlassian.net/wiki",
    email: "svc@acme.example",
    apiToken: "fixture-token",
    spaceKey: "K",
    authMode,
    fetchFn,
  });
  return { client, calls };
}

describe("CF-REST-01 · unterstützte Cloud-Gruppen und erhaltener PAT-Weg", () => {
  it("exakter Name nach kurzer Katalogseite und zwei kurze Mitgliederseiten werden vollständig gelesen", async () => {
    const { client, calls } = fixture((u) => {
      if (u.pathname.endsWith("/group")) {
        return u.searchParams.get("start") === "0"
          ? response(200, {
              results: [{ name: "team-extra", id: "falsche-gruppe" }],
              _links: { next: "/rest/api/group?start=1&limit=200" },
            })
          : response(200, { results: [{ name: "team", id: "g-team" }], _links: {} });
      }
      if (u.pathname.endsWith("/group/g-team/membersByGroupId")) {
        return u.searchParams.get("start") === "0"
          ? response(200, {
              results: [{ accountId: "lea" }],
              _links: { next: "/rest/api/group/g-team/membersByGroupId?start=1&limit=200" },
            })
          : response(200, { results: [{ accountId: "carl" }], _links: {} });
      }
      return response(404);
    });
    expect(await client.getGruppenmitglieder("team")).toEqual({
      users: [{ accountId: "lea" }, { accountId: "carl" }],
      vollstaendig: true,
    });
    expect(calls).toHaveLength(4);
    expect(
      calls.every(
        ({ url, init }) =>
          new URL(url).origin === "https://acme.atlassian.net" &&
          init?.method === "GET" &&
          init.redirect === "error",
      ),
    ).toBe(true);
    expect(calls.some(({ url }) => url.includes("/group/member?"))).toBe(false);
    expect(calls.every(({ url }) => !url.includes("fixture-token"))).toBe(true);
  });

  it("ähnlicher Name ist keine passende Gruppe und öffnet keinen Mitgliederweg", async () => {
    const { client, calls } = fixture(() =>
      response(200, { results: [{ name: "team-extra", id: "anders" }], _links: {} }),
    );
    expect(await client.getGruppenmitglieder("team")).toEqual({ users: [], vollstaendig: false });
    expect(calls).toHaveLength(1);
  });

  it("unlesbarer Katalog bleibt unbekannt", async () => {
    const { client, calls } = fixture(() => response(403));
    expect(await client.getGruppenmitglieder("team")).toEqual({ users: [], vollstaendig: false });
    expect(calls).toHaveLength(1);
  });

  it("Mitgliederfehler nach kurzer erster Seite behält gelesene Nutzer und meldet unvollständig", async () => {
    const { client } = fixture((u) => {
      if (u.pathname.endsWith("/group"))
        return response(200, { results: [{ name: "team", id: "g-team" }], _links: {} });
      if (u.searchParams.get("start") === "0")
        return response(200, {
          results: [{ accountId: "lea" }],
          _links: { next: "/rest/api/group/g-team/membersByGroupId?start=1&limit=200" },
        });
      return response(500);
    });
    expect(await client.getGruppenmitglieder("team")).toEqual({
      users: [{ accountId: "lea" }],
      vollstaendig: false,
    });
  });

  it("Katalog-Zyklus endet an vorhandener Seitenobergrenze und gibt keine Gruppe frei", async () => {
    const { client, calls } = fixture(() =>
      response(200, { results: [], _links: { next: "/rest/api/group?start=0&limit=200" } }),
    );
    expect(await client.getGruppenmitglieder("team")).toEqual({ users: [], vollstaendig: false });
    expect(calls).toHaveLength(50);
  });

  it("fremder Katalog-Fortsetzungsverweis erhält kein Credential", async () => {
    const { client, calls } = fixture(() =>
      response(200, {
        results: [],
        _links: { next: "https://evil.example/rest/api/group?start=1" },
      }),
    );
    expect(await client.getGruppenmitglieder("team")).toEqual({ users: [], vollstaendig: false });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(50);
    expect(
      calls.every(
        ({ url, init }) =>
          new URL(url).origin === "https://acme.atlassian.net" && init?.redirect === "error",
      ),
    ).toBe(true);
  });

  it("PAT behält Namensendpunkt, Bearer und die vollständige Pagination", async () => {
    const { client, calls } = fixture((u) => {
      expect(u.pathname).toBe("/wiki/rest/api/group/member");
      expect(u.searchParams.get("name")).toBe("team");
      return u.searchParams.get("start") === "0"
        ? response(200, {
            results: [{ accountId: "lea" }],
            _links: { next: "/rest/api/group/member?name=team&start=1&limit=200" },
          })
        : response(200, { results: [{ accountId: "carl" }], _links: {} });
    }, "pat");
    expect(await client.getGruppenmitglieder("team")).toEqual({
      users: [{ accountId: "lea" }, { accountId: "carl" }],
      vollstaendig: true,
    });
    expect(calls).toHaveLength(2);
    expect(
      calls.every(
        ({ init }) =>
          (init?.headers as Record<string, string>).authorization === "Bearer fixture-token",
      ),
    ).toBe(true);
  });
});

describe("CF-REST-02 · tatsächlich gelieferte Kontomail ohne Ersatzidentität", () => {
  it("400 am Spezialendpunkt wird durch die normale Benutzerantwort mit Mail aufgelöst", async () => {
    const { client, calls } = fixture((u) =>
      u.pathname.endsWith("/user/email")
        ? response(400)
        : response(200, { accountId: "acc:lea", email: " LEA@EXAMPLE.COM " }),
    );
    expect(await client.getKontoEmail("acc:lea")).toBe("lea@example.com");
    expect(calls.map(({ url }) => new URL(url).pathname)).toEqual([
      "/wiki/rest/api/user/email",
      "/wiki/rest/api/user",
    ]);
    expect(calls.every(({ url }) => new URL(url).searchParams.get("accountId") === "acc:lea")).toBe(
      true,
    );
  });

  it("nichtleere Spezialendpunkt-Mail behält Vorrang und vermeidet zweiten Abruf", async () => {
    const { client, calls } = fixture(() => response(200, { email: " LEA@EXAMPLE.COM " }));
    expect(await client.getKontoEmail("acc:lea")).toBe("lea@example.com");
    expect(calls).toHaveLength(1);
  });

  it("leere Spezialendpunkt-Mail fragt normalen Benutzer ab", async () => {
    const { client } = fixture((u) =>
      response(200, { email: u.pathname.endsWith("/user/email") ? "  " : "lea@example.com" }),
    );
    expect(await client.getKontoEmail("acc:lea")).toBe("lea@example.com");
  });

  it("App und Benutzer ohne sichtbare Mail bleiben beide ohne Zuordnung", async () => {
    for (const accountType of ["app", "atlassian"]) {
      const { client, calls } = fixture((u) =>
        u.pathname.endsWith("/user/email")
          ? response(400)
          : response(200, { accountType, email: null }),
      );
      expect(await client.getKontoEmail("acc:unbekannt")).toBeUndefined();
      expect(calls).toHaveLength(2);
    }
  });

  it("beide Benutzerwege unlesbar bleiben ohne Zuordnung", async () => {
    const { client, calls } = fixture(() => response(403));
    expect(await client.getKontoEmail("acc:unbekannt")).toBeUndefined();
    expect(calls).toHaveLength(2);
  });

  it("PAT-Fehler bleibt beim vorhandenen Spezialendpunkt ohne neuen Cloud-Abruf", async () => {
    const { client, calls } = fixture(
      (u) =>
        u.pathname.endsWith("/user/email")
          ? response(400)
          : response(200, { email: "lea@example.com" }),
      "pat",
    );
    expect(await client.getKontoEmail("acc:lea")).toBeUndefined();
    expect(calls).toHaveLength(1);
  });
});

// Nacharbeit 16 (Ben, K1): die tatsächliche Quelle (SPACE-RECHTE-V2.json) gibt das Space-Leserecht
// über die Zugangsklassen ALL_LICENSED_USERS und ALL_PRODUCT_ADMINS. V1 liefert diese Lese-Einträge
// ohne `subjects`; V2 nennt den Principal. Antwortformen wie dort.
describe("CF-REST-03 · Space-Leserecht über Zugangsklassen und Leseprüfung je Konto", () => {
  const v1 = {
    id: 655363,
    key: "K",
    permissions: [
      {
        operation: { operation: "read", targetType: "space" },
        anonymousAccess: false,
        subjects: { user: { results: [{ accountId: "acc:peter", email: "peter@acme.example" }] } },
      },
      { operation: { operation: "read", targetType: "space" }, anonymousAccess: false },
    ],
  };
  const v2Seite = (klasse: string, next?: string) => ({
    results: [
      {
        id: "1",
        principal: { type: "access-class", id: klasse },
        operation: { key: "read", targetType: "space" },
      },
      {
        id: "2",
        principal: { type: "access-class", id: "ALL_LICENSED_USERS" },
        operation: { key: "create", targetType: "comment" },
      },
    ],
    _links: next ? { next } : {},
  });

  it("der Lese-Eintrag ohne Subjekt bleibt erhalten: V2 nennt die Zugangsklassen, über zwei Seiten", async () => {
    const weiter = "/wiki/api/v2/spaces/655363/permissions?limit=100&cursor=c2";
    const { client, calls } = fixture((u) => {
      if (u.pathname === "/wiki/rest/api/space/K") return response(200, v1);
      if (u.pathname === "/wiki/api/v2/spaces/655363/permissions") {
        return u.searchParams.get("cursor")
          ? response(200, v2Seite("ALL_PRODUCT_ADMINS"))
          : response(200, v2Seite("ALL_LICENSED_USERS", weiter));
      }
      return response(404);
    });
    const rechte = await client.getSpaceLeserechte();
    expect(rechte).toMatchObject({
      anonym: false,
      users: [{ accountId: "acc:peter" }],
      groups: [],
      principalsUnbekannt: false,
    });
    // Nur Lese-Einträge auf den Space zählen — `create comment` ist kein Leserecht.
    expect([...(rechte?.zugangsklassen ?? [])].sort()).toEqual([
      "ALL_LICENSED_USERS",
      "ALL_PRODUCT_ADMINS",
    ]);
    expect(calls).toHaveLength(3);
    expect(calls.every(({ url }) => new URL(url).origin === "https://acme.atlassian.net")).toBe(
      true,
    );
  });

  it("V2 nicht lesbar: der Principal bleibt unbekannt, nichts wird angenommen", async () => {
    const { client } = fixture((u) =>
      u.pathname === "/wiki/rest/api/space/K" ? response(200, v1) : response(403),
    );
    expect(await client.getSpaceLeserechte()).toMatchObject({
      zugangsklassen: [],
      principalsUnbekannt: true,
    });
  });

  it("Space nur mit genannten Subjekten: kein V2-Abruf, keine Zugangsklasse", async () => {
    const { client, calls } = fixture(() =>
      response(200, { ...v1, permissions: [v1.permissions[0]] }),
    );
    expect(await client.getSpaceLeserechte()).toMatchObject({
      zugangsklassen: [],
      principalsUnbekannt: false,
    });
    expect(calls).toHaveLength(1);
  });

  it("Leseprüfung je Konto: zugangsklassenberechtigte Lea ja, ausgeschlossener Otto nein", async () => {
    const { client, calls } = fixture((u) => {
      expect(u.pathname).toBe("/wiki/rest/api/content/P-1/permission/check");
      // Die Quelle entscheidet je Konto: nur Lea ist (über die Zugangsklasse) berechtigt.
      const body = String(calls[calls.length - 1]?.init?.body ?? "");
      return response(200, { hasPermission: body.includes('"acc:lea"') });
    });
    expect(await client.pruefeLeserecht("P-1", "acc:lea")).toBe(true);
    expect(await client.pruefeLeserecht("P-1", "acc:otto")).toBe(false);
    expect(calls).toHaveLength(2);
    for (const { url, init } of calls) {
      expect(new URL(url).origin).toBe("https://acme.atlassian.net");
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      expect(url).not.toContain("fixture-token");
    }
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      subject: { type: "user", identifier: "acc:lea" },
      operation: "read",
    });
  });

  it("Leseprüfung nicht feststellbar (403, unlesbar, PAT): kein Leserecht", async () => {
    const verweigert = fixture(() => response(403));
    expect(await verweigert.client.pruefeLeserecht("P-1", "acc:lea")).toBeUndefined();
    const unlesbar = fixture(() => response(200, {}));
    expect(await unlesbar.client.pruefeLeserecht("P-1", "acc:lea")).toBeUndefined();
    const pat = fixture(() => response(200, { hasPermission: true }), "pat");
    expect(await pat.client.pruefeLeserecht("P-1", "acc:lea")).toBeUndefined();
    expect(pat.calls).toHaveLength(0);
  });
});
