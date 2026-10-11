import { describe, expect, it } from "vitest";
import { adapterFromConfig } from "../../../tests/support/confluence-adapter";
import {
  type ConfluenceMapOptions,
  confluenceAttachments,
  confluenceReadRestriction,
  mapConfluencePageToImportItem,
} from "./mapper";
import type { ConfluencePage } from "./rest-client";

// ================================================================================================
// R-0549 (Quellleserechte) und R-0163 (Anhänge) — was der Mapper aus einer Seite mitnimmt.
// ================================================================================================

const OPTS: ConfluenceMapOptions = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

const basis = (over: Partial<ConfluencePage> = {}): ConfluencePage => ({
  id: "P-1",
  title: "Wartungsplan",
  body: { storage: { value: "<p>Text.</p>" } },
  version: { number: 3 },
  ...over,
});

const mitGruppe = (name: string): ConfluencePage =>
  basis({
    restrictions: {
      read: { restrictions: { user: { results: [] }, group: { results: [{ name }] } } },
    },
  });

describe("R-0549 · die Identität der Quellberechtigung geht nicht verloren", () => {
  it("zwei sonst gleiche Seiten mit verschiedenen erlaubten Gruppen ergeben verschiedene Items", () => {
    const hr = mapConfluencePageToImportItem(mitGruppe("confluence-hr"), OPTS);
    const qs = mapConfluencePageToImportItem(mitGruppe("confluence-qs"), OPTS);
    expect(hr.sourceReadRestriction).toEqual({ groups: ["confluence-hr"], users: [] });
    expect(qs.sourceReadRestriction).toEqual({ groups: ["confluence-qs"], users: [] });
    expect(hr).not.toEqual(qs);
    // Die Stufe bleibt, wie Entscheidung 23 sie festlegt.
    expect(hr.confidentiality).toBe("vertraulich");
  });

  it("Benutzer über ihre stabile Kennung (Cloud accountId, Server username/userKey), nie den Anzeigenamen", () => {
    const seite = basis({
      restrictions: {
        read: {
          restrictions: {
            user: {
              results: [
                { accountId: "5b10-a", displayName: "Anna Muster" },
                { username: "jdoe" },
                { userKey: "ff80-1" },
                { displayName: "ohne Kennung" },
              ],
            },
            group: { results: [{ name: "b" }, { name: "a" }, { name: "a" }, {}] },
          },
        },
      },
    });
    const r = confluenceReadRestriction(seite);
    expect(r).toEqual({ groups: ["a", "b"], users: ["5b10-a", "ff80-1", "jdoe"] });
    expect(JSON.stringify(r)).not.toContain("Anna");
  });

  it("offene und ausdrücklich leere Seiten tragen keine Restriktionsangabe", () => {
    expect(mapConfluencePageToImportItem(basis(), OPTS).sourceReadRestriction).toBeUndefined();
    const leer = basis({
      restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
    });
    expect(mapConfluencePageToImportItem(leer, OPTS).sourceReadRestriction).toBeUndefined();
  });
});

describe("R-0163 · Anhänge und Bilder gehören zur Seite", () => {
  const anhaenge = {
    results: [
      {
        id: "att100",
        title: "pumpe.png",
        extensions: { mediaType: "image/png", fileSize: 20480 },
        _links: { download: "/download/attachments/P-1/pumpe.png?version=1" },
      },
      {
        id: "att101",
        title: "Pr&uuml;fprotokoll.pdf",
        metadata: { mediaType: "application/pdf" },
        _links: { download: "/download/attachments/P-1/pruef.pdf" },
      },
      { id: "", title: "ohne-id.txt" },
      { id: "att102", title: "" },
    ],
  };

  it("der Mapper übernimmt Name, Typ, Größe und die absolute Abruf-URL je Anhang", () => {
    const item = mapConfluencePageToImportItem(basis({ children: { attachment: anhaenge } }), OPTS);
    expect(item.sourceAttachments).toEqual([
      {
        externalId: "att100",
        name: "pumpe.png",
        mime: "image/png",
        size: 20480,
        url: "https://acme.atlassian.net/wiki/download/attachments/P-1/pumpe.png?version=1",
      },
      {
        externalId: "att101",
        name: "Prüfprotokoll.pdf",
        mime: "application/pdf",
        url: "https://acme.atlassian.net/wiki/download/attachments/P-1/pruef.pdf",
      },
    ]);
    // Lauf 2: ein Eintrag OHNE Kennung macht die Liste unbrauchbar — die Anhangslage gilt als
    // unbekannt (nie als vollständig), damit die Annahme keine bestehende Anhangsquelle entfernt.
    expect(item.sourceAttachmentsIncomplete).toBe(true);
    const sauber = mapConfluencePageToImportItem(
      basis({ children: { attachment: { results: anhaenge.results.slice(0, 2) } } }),
      OPTS,
    );
    expect(sauber.sourceAttachments).toHaveLength(2);
    expect(sauber.sourceAttachmentsIncomplete).toBeUndefined();
  });

  it("meldet ehrlich, wenn die Quelle mehr Anhänge hat, als die Antwort trug", () => {
    const item = mapConfluencePageToImportItem(
      basis({ children: { attachment: { ...anhaenge, _links: { next: "/rest/api/…" } } } }),
      OPTS,
    );
    expect(item.sourceAttachmentsIncomplete).toBe(true);
  });

  it("eine Abruf-URL wird nur relativ zur gepinnten Adresse gebildet — fremde Hosts fallen weg", () => {
    const [a] = confluenceAttachments(
      [{ id: "x", title: "f.png", _links: { download: "https://evil.example/f.png" } }],
      OPTS.baseUrl,
    );
    expect(a).toEqual({ externalId: "x", name: "f.png" });
  });

  it("der Lese-Expand fordert die Anhänge an; fetchItem blättert unvollständige Listen nach", async () => {
    const urls: string[] = [];
    const fetchFn = (async (u: string) => {
      const url = String(u);
      urls.push(url);
      const antwort = url.includes("/child/attachment")
        ? url.includes("start=1")
          ? { results: [{ id: "att2", title: "b.png" }] }
          : {
              results: [{ id: "att1", title: "a.png" }],
              _links: { next: "/rest/api/content/P-1/child/attachment?limit=50&start=1" },
            }
        : {
            ...basis(),
            children: {
              attachment: {
                results: [{ id: "att1", title: "a.png" }],
                _links: { next: "/rest/api/content/P-1/child/attachment?start=1" },
              },
            },
          };
      return { ok: true, status: 200, json: async () => antwort } as Response;
    }) as unknown as typeof fetch;

    const adapter = adapterFromConfig({
      baseUrl: OPTS.baseUrl,
      email: "svc@acme.example",
      apiToken: "tok",
      spaceKey: "K",
      fetchFn,
    });
    const item = await adapter.fetchItem("P-1");
    expect(decodeURIComponent(urls[0] ?? "")).toContain("children.attachment");
    expect(item?.sourceAttachments?.map((a) => a.externalId)).toEqual(["att1", "att2"]);
    expect(item?.sourceAttachmentsIncomplete).toBeUndefined();
    expect(urls.every((u) => u.startsWith("https://acme.atlassian.net/wiki/"))).toBe(true);
  });
});
