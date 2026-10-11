// R-0170: der lesende Jira-Client gegen ein DETERMINISTISCHES Vertragsdouble (injizierter fetch) —
// KEIN Live-Token, kein Netz. Dieselbe Bauform wie `services/sharepoint/src/graph-client.test.ts`.
// Geprüft werden die Härtungen (HTTPS-Origin-Pinning, `redirect:"error"`, Token nie in der URL), die
// zwei Suchverträge (Cloud: `nextPageToken`, Data Center: `startAt`), das Lesen der Projektrollen
// und die Abbildung der Statuszahlen auf die Lagen.
import { describe, expect, it } from "vitest";
import {
  JiraRestClient,
  type JiraRestConfig,
  jiraClientFromEnv,
  jiraFehlerlage,
  pruefeJiraUrl,
} from "./rest-client";

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function status(code: number): Response {
  return { ok: false, status: code, json: async () => ({}) } as unknown as Response;
}

const BASIS = "https://jira.example.test";

function cloud(fetchFn: typeof fetch, over: Partial<JiraRestConfig> = {}): JiraRestClient {
  return new JiraRestClient({
    baseUrl: BASIS,
    projectKey: "WART",
    authMode: "cloud",
    user: "importer@example.test",
    token: "nur-fuer-den-vertrag-1234",
    fetchFn,
    ...over,
  });
}

/** Ein Double, das jede Adresse protokolliert und nach Pfad antwortet. */
function double(antworten: (url: URL) => Response): {
  fetchFn: typeof fetch;
  rufe: { url: string; init: RequestInit | undefined }[];
} {
  const rufe: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = (async (u: string, init?: RequestInit) => {
    rufe.push({ url: String(u), init });
    return antworten(new URL(String(u)));
  }) as unknown as typeof fetch;
  return { fetchFn, rufe };
}

describe("R-0170 · JiraRestClient (read-only, Vertragsdouble)", () => {
  it("Cloud: Suche über /search/jql, Basic-Anmeldung im Kopf, redirect:error, Token nie in der URL", async () => {
    const { fetchFn, rufe } = double(() =>
      okJson({ issues: [{ key: "WART-1", fields: { summary: "A" } }], isLast: true }),
    );
    const seite = await cloud(fetchFn).listeVorgangsSeite(null);

    expect(seite.issues).toHaveLength(1);
    expect(seite.weiter).toBeNull();
    const ruf = rufe[0];
    const url = new URL(ruf?.url ?? "");
    expect(url.pathname).toBe("/rest/api/2/search/jql");
    expect(url.searchParams.get("jql")).toBe('project = "WART" ORDER BY key ASC');
    expect(ruf?.init?.method).toBe("GET");
    expect(ruf?.init?.redirect).toBe("error");
    const paar = "importer@example.test:nur-fuer-den-vertrag-1234";
    const erwartet = Buffer.from(paar).toString("base64");
    expect((ruf?.init?.headers as Record<string, string>).authorization).toBe(`Basic ${erwartet}`);
    expect(ruf?.url).not.toContain("nur-fuer-den-vertrag-1234");
  });

  it("Cloud: `nextPageToken` wird zum Cursor und beim nächsten Abruf mitgeschickt", async () => {
    const { fetchFn, rufe } = double((url) =>
      url.searchParams.get("nextPageToken") === "seite-2"
        ? okJson({ issues: [{ key: "WART-2" }], isLast: true })
        : okJson({ issues: [{ key: "WART-1" }], nextPageToken: "seite-2", isLast: false }),
    );
    const client = cloud(fetchFn);
    const erste = await client.listeVorgangsSeite(null);
    expect(erste.weiter).toBe("seite-2");
    const zweite = await client.listeVorgangsSeite(erste.weiter);
    expect(zweite.issues.map((i) => i.key)).toEqual(["WART-2"]);
    expect(zweite.weiter).toBeNull();
    expect(rufe).toHaveLength(2);
  });

  it("Data Center (pat): Suche über /search mit startAt, Bearer-Anmeldung, Cursor = nächste Startposition", async () => {
    const { fetchFn, rufe } = double((url) =>
      okJson({
        startAt: Number(url.searchParams.get("startAt")),
        total: 3,
        issues: url.searchParams.get("startAt") === "0" ? [{ key: "W-1" }, { key: "W-2" }] : [{}],
      }),
    );
    const client = new JiraRestClient({
      baseUrl: `${BASIS}/jira`,
      projectKey: "W",
      authMode: "pat",
      token: "pat-nur-fuer-den-vertrag",
      fetchFn,
    });
    const erste = await client.listeVorgangsSeite(null);
    expect(new URL(rufe[0]?.url ?? "").pathname).toBe("/jira/rest/api/2/search");
    expect((rufe[0]?.init?.headers as Record<string, string>).authorization).toBe(
      "Bearer pat-nur-fuer-den-vertrag",
    );
    expect(erste.weiter).toBe("2");
    const zweite = await client.listeVorgangsSeite("2");
    expect(new URL(rufe[1]?.url ?? "").searchParams.get("startAt")).toBe("2");
    expect(zweite.weiter).toBeNull();
    // Ein Cursor, den dieser Vertrag nicht kennt, geht nicht hinaus.
    expect(client.istGueltigerCursor("abc")).toBe(false);
    await expect(client.listeVorgangsSeite("abc")).rejects.toMatchObject({
      lage: "nicht-erreichbar",
    });
    expect(rufe).toHaveLength(2);
  });

  it("Einzelabruf: ein Vorgang eines ANDEREN Projekts gilt als nicht gefunden", async () => {
    const { fetchFn } = double(() =>
      okJson({ key: "FREMD-1", fields: { summary: "x", project: { key: "FREMD" } } }),
    );
    await expect(cloud(fetchFn).holeVorgang("FREMD-1")).rejects.toMatchObject({
      lage: "nicht-gefunden",
    });
  });

  it("Projektrollen: Rollenliste + Besetzung je Rolle; die Adresse baut der Client selbst", async () => {
    const { fetchFn, rufe } = double((url) => {
      if (url.pathname === "/rest/api/2/project/WART/role") {
        return okJson({
          // Jira nennt absolute Adressen — hier absichtlich auf einem FREMDEN Host. Angesprungen
          // wird er nicht; der Client nimmt nur die Rollenkennung.
          Developers: "https://fremd.example.test/rest/api/2/project/10000/role/10001",
          Administrators: `${BASIS}/rest/api/2/project/10000/role/10002`,
        });
      }
      if (url.pathname === "/rest/api/2/project/WART/role/10001") {
        return okJson({
          actors: [
            { type: "atlassian-user-role-actor", actorUser: { accountId: "acc-1" } },
            { type: "atlassian-group-role-actor", actorGroup: { name: "wartung" } },
            { type: "atlassian-user-role-actor", displayName: "ohne Kennung" },
          ],
        });
      }
      return okJson({
        actors: [
          { type: "atlassian-user-role-actor", name: "jdoe" },
          { type: "atlassian-user-role-actor", actorUser: { accountId: "acc-1" } },
        ],
      });
    });
    const besetzung = await cloud(fetchFn).leseRollenbesetzung();
    expect(besetzung).toEqual({
      users: ["acc-1", "jdoe"],
      groups: ["wartung"],
      rollen: ["Developers", "Administrators"],
    });
    expect(rufe.every((r) => r.url.startsWith(`${BASIS}/`))).toBe(true);
  });

  it("Statuszahlen → Lagen; der Fehler trägt keinen fremden Text", async () => {
    for (const [code, lage] of [
      [401, "abgelaufen"],
      [403, "keine-berechtigung"],
      [404, "nicht-gefunden"],
      [500, "nicht-erreichbar"],
    ] as const) {
      const { fetchFn } = double(() => status(code));
      let fehler: unknown;
      try {
        await cloud(fetchFn).leseRollenbesetzung();
      } catch (err) {
        fehler = err;
      }
      expect(jiraFehlerlage(fehler), String(code)).toBe(lage);
      expect(String((fehler as Error).message)).not.toContain(BASIS);
    }
  });

  it("Origin-Pinning: http oder fremde Origin bricht VOR jedem Netzaufruf ab", async () => {
    expect(() => pruefeJiraUrl("http://jira.example.test/x", BASIS)).toThrow();
    expect(() => pruefeJiraUrl("https://boese.example.test/x", BASIS)).toThrow();
    expect(() => pruefeJiraUrl(`${BASIS}/rest/api/2/search`, BASIS)).not.toThrow();
    const { fetchFn, rufe } = double(() => okJson({}));
    const unverschluesselt = cloud(fetchFn, { baseUrl: "http://jira.example.test" });
    await expect(unverschluesselt.listeVorgangsSeite(null)).rejects.toMatchObject({
      lage: "nicht-erreichbar",
    });
    expect(rufe).toHaveLength(0);
  });

  it("jiraClientFromEnv: nur mit vollständigem, https-gesichertem Zugang und gültigem Projektschlüssel", () => {
    const voll = {
      KLARWERK_JIRA_BASE_URL: BASIS,
      KLARWERK_JIRA_USER: "importer@example.test",
      KLARWERK_JIRA_TOKEN: "t",
      KLARWERK_JIRA_PROJECT: "WART",
    };
    expect(jiraClientFromEnv(voll)?.projectKey).toBe("WART");
    expect(jiraClientFromEnv({ ...voll, KLARWERK_JIRA_USER: "" })).toBeUndefined();
    expect(jiraClientFromEnv({ ...voll, KLARWERK_JIRA_BASE_URL: "http://x" })).toBeUndefined();
    // Ein Projektschlüssel ausserhalb der Jira-Form käme sonst in die JQL.
    expect(jiraClientFromEnv({ ...voll, KLARWERK_JIRA_PROJECT: 'WART" OR 1=1' })).toBeUndefined();
    expect(jiraClientFromEnv({ ...voll, KLARWERK_JIRA_AUTH: "irgendwas" })).toBeUndefined();
    // Data Center: keine Kennung nötig.
    const { KLARWERK_JIRA_USER: _ohne, ...ohneKennung } = voll;
    expect(jiraClientFromEnv({ ...ohneKennung, KLARWERK_JIRA_AUTH: "pat" })).toBeDefined();
  });
});
