// R-0170: der Adapter hängt die Projektrollen an JEDEN übernommenen Vorgang — und übernimmt NICHTS,
// wenn sie nicht lesbar sind. Vertragsdouble statt Netz, wie im Client-Test.
import { describe, expect, it } from "vitest";
import { JiraSourceAdapter } from "./adapter";
import { JiraRestClient, jiraFehlerlage } from "./rest-client";

const BASIS = "https://jira.example.test";

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const SEITE = {
  issues: [
    { key: "WART-1", fields: { summary: "Wartungsplan", issuetype: { name: "Epic" } } },
    { key: "WART-2", fields: { summary: "Filter", parent: { key: "WART-1" } } },
    { key: "WART-3", fields: {} },
  ],
  isLast: true,
};

function adapter(rollenStatus = 200): { adapter: JiraSourceAdapter; pfade: string[] } {
  const pfade: string[] = [];
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    pfade.push(url.pathname);
    if (url.pathname.endsWith("/project/WART/role")) {
      return rollenStatus === 200
        ? okJson({ Developers: `${BASIS}/rest/api/2/project/1/role/7` })
        : ({ ok: false, status: rollenStatus, json: async () => ({}) } as unknown as Response);
    }
    if (url.pathname.endsWith("/project/WART/role/7")) {
      return okJson({ actors: [{ type: "atlassian-group-role-actor", name: "wartung" }] });
    }
    return okJson(SEITE);
  }) as unknown as typeof fetch;
  const client = new JiraRestClient({
    baseUrl: BASIS,
    projectKey: "WART",
    authMode: "pat",
    token: "nur-fuer-den-vertrag",
    fetchFn,
  });
  return { adapter: new JiraSourceAdapter(client), pfade };
}

describe("R-0170 · JiraSourceAdapter", () => {
  it("die Auswahlliste liest Vorgänge und Epics, aber KEINE Rollen", async () => {
    const { adapter: a, pfade } = adapter();
    const liste = await a.listeVorgaenge(null);
    expect(liste.vorgaenge.map((v) => [v.key, v.epic, v.elternteil])).toEqual([
      ["WART-1", true, null],
      ["WART-2", false, "WART-1"],
    ]);
    expect(pfade.some((p) => p.includes("/role"))).toBe(false);
  });

  it("eine Projektseite trägt an JEDEM Item dieselben Leserechte; die Rollen werden einmal gelesen", async () => {
    const { adapter: a, pfade } = adapter();
    const seite = await a.itemSeite(null);
    expect(seite.items.map((i) => i.externalId)).toEqual(["WART-1", "WART-2"]);
    for (const item of seite.items) {
      expect(item.sourceRestrictions).toEqual({ users: [], groups: ["wartung"] });
    }
    // Ein Vorgang ohne Titel wird nicht still verworfen, sondern benannt.
    expect(seite.unbrauchbar).toEqual(["WART-3"]);
    await a.itemSeite(null);
    expect(pfade.filter((p) => p.endsWith("/project/WART/role"))).toHaveLength(1);
  });

  it("sind die Rollen nicht lesbar (403), wird NICHTS übernommen — mit eigener Lage", async () => {
    const { adapter: a, pfade } = adapter(403);
    let fehler: unknown;
    try {
      await a.itemSeite(null);
    } catch (err) {
      fehler = err;
    }
    expect(jiraFehlerlage(fehler)).toBe("rollen-nicht-lesbar");
    // Die Rollen stehen VOR der Vorgangsseite: es wurde gar keine Seite mehr abgerufen.
    expect(pfade.some((p) => p.endsWith("/search"))).toBe(false);
  });
});
