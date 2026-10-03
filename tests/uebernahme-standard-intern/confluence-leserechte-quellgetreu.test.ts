// ==================================================================================================
// AUFNAHME 20260922 · confluence-import-rechte — LESERECHTE UND VERTRAULICHKEIT QUELLGETREU.
// ==================================================================================================
//
// Zielzustand (R-0549): wer eine Seite in Confluence sehen darf, sieht sie in Klara, und sonst niemand.
// Die Nachbardatei `confluence-ohne-beschraenkung-ist-intern.test.ts` hält die Einzelseite fest (offen →
// intern, Benutzer-/Gruppenbeschränkung → vertraulich, leere Listen → intern). Diese Datei misst, was
// dort fehlte:
//
//   V1–V3  die VERERBTE Beschränkung. Confluence liefert `restrictions.read` nur für die eigene Seite;
//          eine Beschränkung an der Elternseite gilt aber auch für das Kind. Bis hierher wurde ein
//          solches Kind „intern" — für jeden mit `ko.read` offen.
//   N1–N3  derselbe Schutz beim Nachladen je ID (`fetchItem`, der Anwendungsweg der Übernahme).
//   Q1–Q2  geänderte Quellversion: eine nachträglich beschränkte Seite hebt das Objekt an.
//   G1     die Gruppierung: ein offener Bestand sperrt sie nicht, ein vererbt beschränkter schon.
//
// Fixture-Fetch, kein Netz, kein Token einer echten Instanz.
import { describe, expect, it } from "vitest";
import { adapterFromConfig } from "../../services/confluence/src/adapter";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService, groupingRequiresConfidential } from "../../services/library-analytics";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

function seite(
  id: string,
  ahnen: { id?: string; title?: string }[],
  lesen?: { user?: unknown[]; group?: unknown[] },
  version = 1,
): ConfluencePage {
  return {
    id,
    title: `Seite ${id}`,
    body: { storage: { value: `<p>Inhalt ${id}.</p>` } },
    version: { number: version },
    _links: { webui: `/spaces/K/pages/${id}` },
    ancestors: ahnen,
    ...(lesen
      ? {
          restrictions: {
            read: {
              restrictions: {
                user: { results: lesen.user ?? [] },
                group: { results: lesen.group ?? [] },
              },
            },
          },
        }
      : {}),
  };
}

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Space-Listing liefert `liste`; `/content/<id>` liefert die Seite aus `einzeln` oder 404. */
function fixture(liste: ConfluencePage[], einzeln: ConfluencePage[] = liste) {
  const abgerufen: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    const treffer = /\/rest\/api\/content\/([^/]+)$/.exec(u.pathname);
    if (treffer) {
      const id = decodeURIComponent(treffer[1] ?? "");
      abgerufen.push(id);
      const s = einzeln.find((p) => p.id === id);
      return s ? antwort(200, s) : antwort(404, {});
    }
    return antwort(200, { results: liste });
  }) as unknown as typeof fetch;
  const adapter = adapterFromConfig({
    baseUrl: OPTS.baseUrl,
    email: "svc@acme.test",
    apiToken: "fixture-token",
    spaceKey: "K",
    fetchFn,
  });
  return { adapter, abgerufen };
}

// Baum: Wurzel (offen) → Personal (Gruppe „hr") → Gehalt (selbst offen) → Detail (selbst offen)
//       Wurzel (offen) → Handbuch (offen) → Kapitel (offen)
const wurzel = seite("1", []);
const personal = seite("2", [{ id: "1", title: "Wurzel" }], { group: [{ name: "hr" }] });
const gehalt = seite("3", [
  { id: "1", title: "Wurzel" },
  { id: "2", title: "Personal" },
]);
const detail = seite("4", [
  { id: "1", title: "Wurzel" },
  { id: "2", title: "Personal" },
  { id: "3", title: "Gehalt" },
]);
const handbuch = seite("5", [{ id: "1", title: "Wurzel" }], { user: [], group: [] });
const kapitel = seite("6", [
  { id: "1", title: "Wurzel" },
  { id: "5", title: "Handbuch" },
]);
const BAUM = [wurzel, personal, gehalt, detail, handbuch, kapitel];

async function stufenAusSammlung(pages: ConfluencePage[]) {
  const { items } = await fixture(pages).adapter.collectAll();
  return Object.fromEntries(items.map((i) => [i.externalId, i.confidentiality]));
}

describe("R-0549 · vererbte Leseeinschränkung beim Einsammeln", () => {
  it("V1 · Kind und Enkel einer gruppenbeschränkten Seite sind vertraulich, offene Zweige intern", async () => {
    expect(await stufenAusSammlung(BAUM)).toEqual({
      "1": "intern",
      "2": "vertraulich", // eigene Gruppenbeschränkung
      "3": "vertraulich", // vererbt vom Elternteil
      "4": "vertraulich", // vererbt vom Großelternteil
      "5": "intern", // leere Listen sind keine Beschränkung
      "6": "intern", // offene Kette
    });
  });

  it("V2 · Benutzerbeschränkung am Vorfahren wirkt genauso wie Gruppenbeschränkung", async () => {
    const chef = seite("2", [{ id: "1", title: "Wurzel" }], { user: [{ accountId: "a" }] });
    expect(await stufenAusSammlung([wurzel, chef, gehalt])).toMatchObject({
      "2": "vertraulich",
      "3": "vertraulich",
    });
  });

  it("V3 · ein Vorfahr, der nicht nachgesehen werden konnte, ist kein „offen“ — fail-closed", async () => {
    // Elternteil 2 fehlt in der Sammlung (abgeschnittener Lauf oder für das Dienstkonto unsichtbar).
    expect(await stufenAusSammlung([wurzel, gehalt])).toMatchObject({ "3": "vertraulich" });
    // Vorfahr ohne ID: keine Aussage über ihn möglich.
    const lueckig = seite("7", [{ title: "ohne Kennung" }]);
    expect(await stufenAusSammlung([wurzel, lueckig])).toMatchObject({ "7": "vertraulich" });
  });

  it("V4 · Anti-Vakuum: die reine Einzelseiten-Sicht hätte das Kind als intern übernommen", () => {
    expect(mapConfluencePageToImportItem(gehalt, OPTS).confidentiality).toBe("intern");
  });
});

describe("R-0549 · derselbe Schutz beim Nachladen je ID (Anwendungsweg)", () => {
  it("N1 · Elternteil beschränkt → das frisch geladene Kind ist vertraulich", async () => {
    const { adapter } = fixture([], BAUM);
    expect((await adapter.fetchItem("3"))?.confidentiality).toBe("vertraulich");
    expect((await adapter.fetchItem("4"))?.confidentiality).toBe("vertraulich");
  });

  it("N2 · offene Kette → intern; jeder Vorfahr wurde dafür wirklich nachgesehen", async () => {
    const { adapter, abgerufen } = fixture([], BAUM);
    expect((await adapter.fetchItem("6"))?.confidentiality).toBe("intern");
    expect(abgerufen).toEqual(["6", "1", "5"]);
  });

  it("N3 · Vorfahr für das Dienstkonto nicht lesbar (404) → vertraulich", async () => {
    const { adapter } = fixture([], [wurzel, gehalt]);
    expect((await adapter.fetchItem("3"))?.confidentiality).toBe("vertraulich");
  });
});

describe("R-0182/R-0649 · geänderte Quellversion", () => {
  it("Q1 · offen übernommen, in v2 an der Quelle beschränkt → das Objekt wird vertraulich", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });

    // v1 enthält die GANZE offene Kette (Wurzel 1, Handbuch 5) — fehlte der Elternteil 5, wäre das
    // Kapitel nach V3 zu Recht fail-closed vertraulich und der Fall mäße nichts.
    const v1 = await fixture([wurzel, handbuch, kapitel]).adapter.collectAll();
    const c1 = (await library.createImportCandidates(v1.items, "importeur")).find(
      (c) => c.item.externalId === "6",
    );
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("intern");

    // v2: das Handbuch (Elternteil) wird auf eine Gruppe beschränkt, das Kapitel bekommt Version 2.
    const handbuchZu = seite("5", [{ id: "1", title: "Wurzel" }], { group: [{ name: "qs" }] }, 2);
    const kapitelV2: ConfluencePage = {
      ...kapitel,
      body: { storage: { value: "<p>Inhalt 6, Stand 2.</p>" } },
      version: { number: 2 },
    };
    const v2 = await fixture([wurzel, handbuchZu, kapitelV2]).adapter.collectAll();
    const c2 = (await library.createImportCandidates(v2.items, "importeur")).find(
      (c) => c.item.externalId === "6",
    );
    await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");

    const kos = (await koService.list()).filter((k) => k.sources.some((s) => s.externalId === "6"));
    expect(kos).toHaveLength(1);
    expect(kos[0]?.confidentiality).toBe("vertraulich");
  });

  it("Q2 · benannte Grenze: eine später AUFGEHOBENE Beschränkung senkt das Objekt nicht von selbst", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const zu = seite("8", [], { user: [{ accountId: "a" }] }, 1);
    const v1 = await fixture([zu]).adapter.collectAll();
    const [c1] = await library.createImportCandidates(v1.items, "importeur");
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("vertraulich");

    const offen: ConfluencePage = {
      ...seite("8", [], undefined, 2),
      body: { storage: { value: "<p>Inhalt 8, Stand 2.</p>" } },
    };
    const v2 = await fixture([offen]).adapter.collectAll();
    const [c2] = await library.createImportCandidates(v2.items, "importeur");
    await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");
    // Re-Sync hebt nur an (library-analytics service.ts, SCRUM-509 R4); Absenken bleibt beim Menschen.
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("vertraulich");
  });
});

describe("R-1601/R-2197 · die Gruppierung läuft für offene Bestände", () => {
  it("G1 · offener Zweig sperrt die externe Gruppierung nicht, ein vererbt beschränkter schon", async () => {
    const { items } = await fixture(BAUM).adapter.collectAll();
    const offen = items.filter((i) => ["1", "5", "6"].includes(i.externalId ?? ""));
    expect(groupingRequiresConfidential(offen)).toBe(false);
    const mitVererbung = items.filter((i) => ["1", "3"].includes(i.externalId ?? ""));
    expect(groupingRequiresConfidential(mitVererbung)).toBe(true);
  });
});
