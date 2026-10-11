// ================================================================================================
// R-0162 · R-0163 · R-0549 — DER GESAMTWEG: QUELLE → LAUF → ANNAHME → WISSENSOBJEKT → ABGLEICH.
// ================================================================================================
//
// Eine veränderliche Confluence-Attrappe (Bereichsliste UND Einzelabruf, 404 für gelöschte Seiten)
// hinter dem ECHTEN Adapter, dem echten Importlauf und dem echten Annahmeweg. Gemessen wird, was
// am Wissensobjekt ankommt und was ein späterer Abgleich daran tut.
import { describe, expect, it } from "vitest";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import type { ImportItemMitQuellangaben } from "../../services/library-analytics/src/quellangaben";
import { adapterFromConfig } from "../support/confluence-adapter";

const BASIS = "https://acme.atlassian.net/wiki";

function seite(id: string, over: Partial<ConfluencePage> = {}): ConfluencePage {
  return {
    id,
    title: `Seite ${id}`,
    body: { storage: { value: `<p>Inhalt ${id}.</p>` } },
    version: { number: 1 },
    _links: { webui: `/spaces/K/pages/${id}` },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
    ...over,
  };
}

/** Confluence-Attrappe: `bereich` = was die Bereichsliste zeigt, `existiert` = was je Id abrufbar ist. */
function quelle() {
  const bereich = new Map<string, ConfluencePage>();
  const existiert = new Map<string, ConfluencePage>();
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    const einzel = /\/rest\/api\/content\/([^/?]+)$/.exec(url.pathname);
    if (einzel) {
      const p = existiert.get(decodeURIComponent(einzel[1] ?? ""));
      return p
        ? ({ ok: true, status: 200, json: async () => p } as Response)
        : ({ ok: false, status: 404, json: async () => ({}) } as Response);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [...bereich.values()] }),
    } as Response;
  }) as unknown as typeof fetch;
  const adapter = adapterFromConfig({
    baseUrl: BASIS,
    email: "svc@acme.example",
    apiToken: "tok",
    spaceKey: "K",
    fetchFn,
  });
  const setze = (p: ConfluencePage) => {
    bereich.set(p.id, p);
    existiert.set(p.id, p);
  };
  return { adapter, bereich, existiert, setze };
}

function dienste() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const library = new LibraryService({ koService, externalUpsert: true });
  return { koService, library };
}

async function laufUndAnnehmen(
  q: ReturnType<typeof quelle>,
  d: ReturnType<typeof dienste>,
  dryRun = false,
) {
  const summary = await runConfluenceImport({ ...d, adapter: q.adapter, dryRun, actor: "admin" });
  for (const k of await d.library.listImportCandidates()) {
    if (k.status === "neu") {
      await d.library.reviewImportCandidate(k.id, "accept", "admin");
    }
  }
  return summary;
}

async function koZu(d: ReturnType<typeof dienste>, externalId: string) {
  return (await d.koService.list()).find((k) => k.sources.some((s) => s.externalId === externalId));
}

const MIT_ANHAENGEN = {
  children: {
    attachment: {
      results: [
        {
          id: "att1",
          title: "pumpe.png",
          extensions: { mediaType: "image/png", fileSize: 2048 },
          _links: { download: "/download/attachments/P-1/pumpe.png" },
        },
        {
          id: "att2",
          title: "plan.pdf",
          extensions: { mediaType: "application/pdf", fileSize: 99 },
          _links: { download: "/download/attachments/P-1/plan.pdf" },
        },
      ],
    },
  },
};

describe("R-0163 / R-0549 · was am Wissensobjekt ankommt", () => {
  it("Anker mit Quellrestriktion, je Anhang eine eigene Quelle mit Abruf-URL", async () => {
    const q = quelle();
    const d = dienste();
    q.setze(
      seite("P-1", {
        ...MIT_ANHAENGEN,
        restrictions: {
          read: {
            restrictions: {
              user: { results: [{ accountId: "acc-9" }] },
              group: { results: [{ name: "confluence-hr" }] },
            },
          },
        },
      }),
    );
    await laufUndAnnehmen(q, d);

    const ko = await koZu(d, "P-1");
    expect(ko).toBeDefined();
    const anker = ko?.sources.find((s) => s.externalId === "P-1");
    expect(anker?.readRestriction).toEqual({ groups: ["confluence-hr"], users: ["acc-9"] });
    expect(anker?.url).toBe(`${BASIS}/spaces/K/pages/P-1`);
    const anhaenge = ko?.sources.filter((s) => s.attachmentOf === "P-1") ?? [];
    expect(anhaenge.map((a) => [a.label, a.url, a.attachment])).toEqual([
      [
        "pumpe.png",
        `${BASIS}/download/attachments/P-1/pumpe.png`,
        { externalId: "att1", mime: "image/png", size: 2048 },
      ],
      [
        "plan.pdf",
        `${BASIS}/download/attachments/P-1/plan.pdf`,
        { externalId: "att2", mime: "application/pdf", size: 99 },
      ],
    ]);
    // Anhänge tragen keine eigene externalId — der Re-Sync-Anker bleibt eindeutig.
    expect(anhaenge.every((a) => a.externalId === undefined)).toBe(true);
    // Die Stufe folgt weiterhin Entscheidung 23.
    expect(ko?.confidentiality).toBe("vertraulich");
  });

  it("Re-Sync mit neuer Fassung ersetzt die Anhangsquellen der Seite, statt sie zu häufen", async () => {
    const q = quelle();
    const d = dienste();
    q.setze(seite("P-1", MIT_ANHAENGEN));
    await laufUndAnnehmen(q, d);
    q.setze(
      seite("P-1", {
        version: { number: 2 },
        children: {
          attachment: {
            results: [{ id: "att3", title: "neu.png", _links: { download: "/download/n.png" } }],
          },
        },
      }),
    );
    await laufUndAnnehmen(q, d);
    const ko = await koZu(d, "P-1");
    expect(ko?.sources.filter((s) => s.attachmentOf === "P-1").map((s) => s.label)).toEqual([
      "neu.png",
    ]);
    expect(ko?.sources.filter((s) => s.externalId === "P-1")).toHaveLength(1);
  });

  it("der JSON-Eingang begrenzt behauptete Quellangaben auf Form und Menge", async () => {
    const d = dienste();
    const behauptet: ImportItemMitQuellangaben[] = [
      {
        title: "T",
        statement: "S",
        type: "best_practice",
        category: "K",
        externalId: "J-1",
        provider: "Confluence",
        sourceReadRestriction: {
          groups: ["ok", "", 42 as unknown as string, "x".repeat(600)],
          users: [],
        },
        sourceAttachments: [
          { externalId: "a", name: "gut.png", url: "javascript:alert(1)" },
          { externalId: "", name: "ohne-id" },
        ],
      },
    ];
    const [roh] = await d.library.createImportCandidates(behauptet, "admin");
    const k = roh as (typeof roh & { item: ImportItemMitQuellangaben }) | undefined;
    expect(k?.item.sourceReadRestriction).toEqual({ groups: ["ok"], users: [] });
    expect(k?.item.sourceAttachments).toEqual([
      { externalId: "a", name: "gut.png", url: "javascript:alert(1)" },
    ]);
    // Beim Annehmen wird die aktive Adresse verworfen (safeSourceUrl), der Anhang bleibt benannt.
    await d.library.reviewImportCandidate(k?.id ?? "", "accept", "admin");
    const anhang = (await koZu(d, "J-1"))?.sources.find((s) => s.attachmentOf === "J-1");
    expect(anhang?.label).toBe("gut.png");
    expect(anhang?.url).toBeNull();
  });
});

describe("R-0162 · Löschungen in der Quelle werden beim nächsten Abgleich nachgezogen", () => {
  it("gelöschte Seite: Probelauf meldet, echter Lauf vermerkt am Anker — das Wissen bleibt unverändert", async () => {
    const q = quelle();
    const d = dienste();
    q.setze(seite("P-1"));
    q.setze(seite("P-2"));
    await laufUndAnnehmen(q, d);
    const vorher = await koZu(d, "P-2");
    expect(vorher).toBeDefined();

    q.bereich.delete("P-2");
    q.existiert.delete("P-2");

    const probe = await laufUndAnnehmen(q, d, true);
    expect(probe.sourceSync).toEqual({
      checked: true,
      removed: [{ externalId: "P-2", koIds: [vorher?.id], marked: false }],
      outsideScope: [],
      unchecked: [],
      attachmentsUpdated: [],
      restrictionsUpdated: [],
      syncFailed: [],
      // Lauf 3 R3: diese Attrappe beantwortet die Anhangsliste nicht als Liste — P-1 ist gelesen,
      // seine Anhangslage aber unbekannt, und der Lauf sagt das.
      attachmentsIncomplete: ["P-1"],
      restored: [],
    });
    expect(
      (await koZu(d, "P-2"))?.sources.find((s) => s.externalId === "P-2")?.sourceRemovedAt,
    ).toBeUndefined();

    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.sourceSync?.removed).toEqual([
      { externalId: "P-2", koIds: [vorher?.id], marked: true },
    ]);
    const nachher = await koZu(d, "P-2");
    const anker = nachher?.sources.find((s) => s.externalId === "P-2");
    expect(typeof anker?.sourceRemovedAt).toBe("string");
    // Nichts gelöscht, nichts revidiert, nichts herabgestuft.
    expect(nachher?.id).toBe(vorher?.id);
    expect(nachher?.title).toBe(vorher?.title);
    expect(nachher?.statement).toBe(vorher?.statement);
    expect(nachher?.version).toBe(vorher?.version);
    expect(nachher?.confidentiality).toBe(vorher?.confidentiality);
    // Die unveränderte Seite P-1 bleibt unberührt.
    expect(
      (await koZu(d, "P-1"))?.sources.find((s) => s.externalId === "P-1")?.sourceRemovedAt,
    ).toBeUndefined();

    // Ein weiterer Lauf vermerkt nicht erneut.
    const wieder = await laufUndAnnehmen(q, d);
    expect(wieder.sourceSync?.removed).toEqual([]);
  });

  it("nicht mehr im Bereich, aber noch vorhanden (verschoben): gemeldet, NICHT vermerkt", async () => {
    const q = quelle();
    const d = dienste();
    q.setze(seite("P-3"));
    await laufUndAnnehmen(q, d);
    q.bereich.delete("P-3"); // per Einzelabruf weiterhin da
    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.sourceSync?.outsideScope).toEqual(["P-3"]);
    expect(lauf.sourceSync?.removed).toEqual([]);
    expect(
      (await koZu(d, "P-3"))?.sources.find((s) => s.externalId === "P-3")?.sourceRemovedAt,
    ).toBeUndefined();
  });

  it("ein unvollständig gelesener Bereich wird NICHT abgeglichen", async () => {
    const d = dienste();
    const q = quelle();
    q.setze(seite("P-4"));
    await laufUndAnnehmen(q, d);
    const abgeschnitten = {
      source: "Confluence",
      sourceScope: "K",
      collectAll: async () => ({ items: [], failed: [], truncated: true }),
      fetchItem: async () => undefined,
    } as unknown as Parameters<typeof runConfluenceImport>[0]["adapter"];
    const lauf = await runConfluenceImport({
      ...d,
      adapter: abgeschnitten,
      dryRun: false,
      actor: "a",
    });
    expect(lauf.sourceSync).toEqual({
      checked: false,
      reason: "incomplete-read",
      removed: [],
      outsideScope: [],
      unchecked: [],
      attachmentsUpdated: [],
      restrictionsUpdated: [],
      syncFailed: [],
      attachmentsIncomplete: [],
      restored: [],
    });
    expect(
      (await koZu(d, "P-4"))?.sources.find((s) => s.externalId === "P-4")?.sourceRemovedAt,
    ).toBeUndefined();
  });

  it("scheitert die Einzelnachfrage, wird nichts vermerkt (nicht prüfbar)", async () => {
    const d = dienste();
    const q = quelle();
    q.setze(seite("P-5"));
    await laufUndAnnehmen(q, d);
    const stoerung = {
      source: "Confluence",
      sourceScope: "K",
      collectAll: async () => ({ items: [], failed: [], truncated: false }),
      fetchItem: async () => {
        throw new Error("Confluence antwortet nicht");
      },
    } as unknown as Parameters<typeof runConfluenceImport>[0]["adapter"];
    const lauf = await runConfluenceImport({ ...d, adapter: stoerung, dryRun: false, actor: "a" });
    expect(lauf.sourceSync?.unchecked).toEqual(["P-5"]);
    expect(lauf.sourceSync?.removed).toEqual([]);
  });
});
