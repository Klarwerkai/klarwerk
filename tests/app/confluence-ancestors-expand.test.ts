// AUFTRAG-mega27 A1: die Elternkette wird MINIMAL mitgeholt — und der Preis ist gemessen, nicht
// geschätzt. Deterministisch gegen ein Fixture (injizierter fetch), KEIN Netz, KEIN Token.
import { describe, expect, it } from "vitest";
import {
  type ConfluencePage,
  ConfluenceRestClient,
} from "../../services/confluence/src/rest-client";

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

async function capturedUrl(): Promise<string> {
  let url = "";
  const fetchFn = (async (u: string) => {
    url = String(u);
    return okJson({ results: [] });
  }) as unknown as typeof fetch;
  await new ConfluenceRestClient(cfg(fetchFn)).listPages();
  return url;
}

describe("A1 · ancestors im Abruf", () => {
  it("der expand enthält ancestors — OHNE Unter-Expand (kein ancestors.body/.version/.metadata)", async () => {
    const expand = new URL(await capturedUrl()).searchParams.get("expand") ?? "";
    const parts = expand.split(",");
    expect(parts).toContain("ancestors");
    // Genau EIN ancestors-Eintrag, und keiner mit Punkt-Unter-Expand.
    expect(parts.filter((p) => p.startsWith("ancestors"))).toEqual(["ancestors"]);
    // Die bisherigen Expands bleiben unverändert bestehen.
    for (const keep of [
      "body.storage",
      "version",
      "metadata.labels",
      "restrictions.read.restrictions.user",
      "restrictions.read.restrictions.group",
    ]) {
      expect(parts).toContain(keep);
    }
  });

  it("Paginierung und der Abbruch-mit-truncated bleiben unberührt", async () => {
    const urls: string[] = [];
    const fetchFn = (async (u: string) => {
      urls.push(String(u));
      // Zwei Seiten, dann Ende — der next-Cursor trägt den expand der ersten Anfrage weiter.
      return okJson(
        urls.length === 1
          ? { results: [{ id: "1", title: "A" }], _links: { next: "/rest/api/content?start=25" } }
          : { results: [{ id: "2", title: "B" }] },
      );
    }) as unknown as typeof fetch;
    const { pages, truncated } = await new ConfluenceRestClient(cfg(fetchFn)).listAllPages();
    expect(pages.map((p) => p.id)).toEqual(["1", "2"]);
    expect(truncated).toBe(false);
    expect(urls).toHaveLength(2);
    // Der Cap meldet weiterhin ehrlich ab, wenn noch ein Cursor offen ist.
    let n = 0;
    const endless = (async () => {
      n++;
      return okJson({
        results: [{ id: String(n) }],
        _links: { next: "/rest/api/content?start=1" },
      });
    }) as unknown as typeof fetch;
    const capped = await new ConfluenceRestClient(cfg(endless)).listAllPages(3);
    expect(capped.truncated).toBe(true);
    expect(capped.pages).toHaveLength(3);
  });

  it("MESSUNG: was die Elternkette an Antwortgröße kostet (repräsentative Seite)", () => {
    // Eine realistische Seite: Storage-Body, Version, zwei Labels, Read-Restriktionen.
    const base: ConfluencePage = {
      id: "123456789",
      title: "Kennzeichnung Halle 7 — Farbvorgabe",
      type: "page",
      status: "current",
      body: { storage: { value: "<p>".concat("Sicherheitsrichtlinie. ".repeat(120), "</p>") } },
      version: { number: 7, by: { displayName: "Anna Berger" }, when: "2026-05-01T10:00:00.000Z" },
      _links: { webui: "/spaces/KWDEMO/pages/123456789/Kennzeichnung" },
      metadata: { labels: { results: [{ name: "arbeitssicherheit" }, { name: "kennzeichnung" }] } },
      restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
    };
    // Was Confluence bei `expand=ancestors` OHNE Unter-Expand je Ahn liefert: Basisfelder.
    const withAncestors: ConfluencePage = {
      ...base,
      ancestors: [
        { id: "111", title: "Betrieb" },
        { id: "222", title: "Arbeitssicherheit" },
        { id: "333", title: "Halle 7" },
      ],
    };
    const before = JSON.stringify(base).length;
    const after = JSON.stringify(withAncestors).length;
    // Die Zahlen stehen im Bericht; hier wird der RAHMEN festgehalten: die Elternkette wächst
    // linear mit ihrer Tiefe und bleibt gegenüber dem Body klein (unter einem Zehntel je Seite).
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThan(before * 0.1);
    // Und sie ist NICHT der Body: der Zuwachs bleibt je Ahn im zweistelligen Byte-Bereich.
    expect((after - before) / 3).toBeLessThan(100);
  });
});
