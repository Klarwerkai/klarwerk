// ================================================================================================
// R-0163 — DIE ZWEI IN LAUF 1 / RUNDE 3 REPRODUZIERTEN ANHANGSFEHLER, JE ALS NEGATIVFALL.
// ================================================================================================
//
//   A1  Eine unbrauchbare Anhangsantwort (HTTP 200 ohne Liste, Einträge ohne Kennung, 404, oder
//       gar keine Liste am Expand) ist KEIN Beleg für „keine Anhänge": die bestehenden
//       Anhangsquellen bleiben, das Item trägt die Unvollständig-Marke.
//   A2  Ändern sich NUR die Anhänge (gleiche Seitenfassung), zieht der Bereichsimport sie am
//       Wissensobjekt nach — ohne neuen Kandidaten und ohne Inhaltsrevision; der Probelauf meldet
//       nur, und das Ergebnis steht am dauerhaften Lauf.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import { makeGuards } from "../../services/app/src/http";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import {
  type ConfluencePage,
  ConfluenceRestClient,
  ConfluenceUnusableResponseError,
} from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import { adapterFromConfig } from "../support/confluence-adapter";

const BASIS = "https://acme.atlassian.net/wiki";

const anhang = (id: string) => ({
  id,
  title: `${id}.png`,
  extensions: { mediaType: "image/png", fileSize: 10 },
  _links: { download: `/download/${id}.png` },
});

function seite(id: string, version: number, anhaenge?: unknown): ConfluencePage {
  return {
    id,
    title: `Seite ${id}`,
    body: { storage: { value: `<p>Inhalt ${id}.</p>` } },
    version: { number: version },
    _links: { webui: `/spaces/K/pages/${id}` },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
    ...(anhaenge === undefined
      ? {}
      : { children: { attachment: anhaenge as { results: never[] } } }),
  };
}

/** Teilliste am Expand: ein Anhang geliefert, `next` sagt „es gibt mehr". */
const teilliste = (id: string) => ({
  results: [anhang("a1")],
  _links: { next: `/rest/api/content/${id}/child/attachment?start=1` },
});

/** Attrappe: Bereichsliste, Einzelabruf, Anhangsliste je Seite als beliebige Antwort. */
function quelle() {
  const bereich = new Map<string, ConfluencePage>();
  const anhangsAntwort = new Map<string, { status: number; body: unknown }>();
  const antwort = (status: number, body: unknown) =>
    ({ ok: status < 300, status, json: async () => body }) as Response;
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    const a = /\/rest\/api\/content\/([^/?]+)\/child\/attachment$/.exec(url.pathname);
    if (a) {
      const r = anhangsAntwort.get(decodeURIComponent(a[1] ?? ""));
      return r ? antwort(r.status, r.body) : antwort(200, { results: [] });
    }
    const id = /\/rest\/api\/content\/([^/?]+)$/.exec(url.pathname)?.[1];
    if (id) {
      const s = bereich.get(decodeURIComponent(id));
      return s ? antwort(200, s) : antwort(404, {});
    }
    return antwort(200, { results: [...bereich.values()] });
  }) as unknown as typeof fetch;
  const config = { baseUrl: BASIS, email: "svc@acme.example", apiToken: "tok", spaceKey: "K" };
  return {
    adapter: adapterFromConfig({ ...config, fetchFn }),
    client: new ConfluenceRestClient({ ...config, fetchFn }),
    bereich,
    anhangsAntwort,
  };
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

async function objekt(d: ReturnType<typeof dienste>, externalId: string) {
  const ko = (await d.koService.list()).find((k) =>
    k.sources.some((s) => s.externalId === externalId),
  );
  const anhaenge = (ko?.sources ?? []).filter((s) => s.attachmentOf === externalId);
  return {
    ko,
    anker: ko?.sources.find((s) => s.externalId === externalId),
    anhangsIds: anhaenge.map((s) => s.attachment?.externalId ?? "").sort(),
    anhaenge,
  };
}

describe("A1 · eine unbrauchbare Anhangsantwort entfernt keine bestehende Anhangsquelle", () => {
  const unbrauchbar: [string, { status: number; body: unknown }][] = [
    [
      "200 ohne Liste (Bens Probe)",
      { status: 200, body: { unexpected: "not an attachment listing" } },
    ],
    ["200 mit null", { status: 200, body: null }],
    ["200, results ist keine Liste", { status: 200, body: { results: "a1" } }],
    ["200, Eintrag ohne Kennung", { status: 200, body: { results: [{ title: "x.png" }] } }],
    ["404 für eine gerade gelesene Seite", { status: 404, body: {} }],
  ];

  for (const [name, r] of unbrauchbar) {
    it(`${name}: der Client wirft ConfluenceUnusableResponseError oder einen Fehler`, async () => {
      const q = quelle();
      q.anhangsAntwort.set("P-1", r);
      // Nacharbeit 5: die strenge Liste dieser Lieferung heißt seit der Zusammenführung mit mains
      // R-0163 (`listAttachments`, Dateiinhalte) `listAttachmentsStreng` — Prüfung unverändert.
      const aufruf = q.client.listAttachmentsStreng("P-1");
      if (r.status === 200) {
        await expect(aufruf).rejects.toBeInstanceOf(ConfluenceUnusableResponseError);
      } else {
        await expect(aufruf).rejects.toThrow();
      }
    });

    it(`${name}: a1/a2 bleiben nach Annahme von Fassung 2, das Item ist als unvollständig markiert`, async () => {
      const q = quelle();
      const d = dienste();
      q.bereich.set("P-1", seite("P-1", 1, { results: [anhang("a1"), anhang("a2")] }));
      await laufUndAnnehmen(q, d);
      expect((await objekt(d, "P-1")).anhangsIds).toEqual(["a1", "a2"]);

      q.bereich.set("P-1", seite("P-1", 2, teilliste("P-1")));
      q.anhangsAntwort.set("P-1", r);
      const item = await q.adapter.fetchItem("P-1");
      expect(item?.sourceAttachmentsIncomplete).toBe(true);

      const lauf = await laufUndAnnehmen(q, d);
      expect(lauf.imported).toBe(1);
      expect(lauf.failed).toBe(0);
      const nachher = await objekt(d, "P-1");
      expect(nachher.anker?.sourceVersion).toBe(2);
      expect(nachher.anhangsIds).toEqual(["a1", "a2"]);
    });
  }

  it("unbrauchbare Liste schon am Expand (ohne next): wird nachgefragt; scheitert das, bleibt alles", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-2", seite("P-2", 1, { results: [anhang("a1"), anhang("a2")] }));
    await laufUndAnnehmen(q, d);

    q.bereich.set("P-2", seite("P-2", 2, { unexpected: true }));
    q.anhangsAntwort.set("P-2", { status: 200, body: { unexpected: true } });
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-2")).anhangsIds).toEqual(["a1", "a2"]);
  });

  it("unbrauchbare Liste am Expand, Nachfrage gelingt: die nachgefragte Liste gilt", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-2", seite("P-2", 1, { results: [anhang("a1"), anhang("a2")] }));
    await laufUndAnnehmen(q, d);

    q.bereich.set("P-2", seite("P-2", 2, { unexpected: true }));
    q.anhangsAntwort.set("P-2", { status: 200, body: { results: [anhang("a3")] } });
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-2")).anhangsIds).toEqual(["a3"]);
  });

  it("gar keine Anhangsliste am Expand: unbekannt, nicht „keine“ — a1/a2 bleiben", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-3", seite("P-3", 1, { results: [anhang("a1"), anhang("a2")] }));
    await laufUndAnnehmen(q, d);

    q.bereich.set("P-3", seite("P-3", 2));
    const item = await q.adapter.fetchItem("P-3");
    expect(item?.sourceAttachmentsIncomplete).toBe(true);
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-3")).anhangsIds).toEqual(["a1", "a2"]);
  });

  it("Gegenprobe: eine brauchbare, vollständige leere Liste entfernt die Anhänge", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-4", seite("P-4", 1, { results: [anhang("a1")] }));
    await laufUndAnnehmen(q, d);
    q.bereich.set("P-4", seite("P-4", 2, { results: [] }));
    const item = await q.adapter.fetchItem("P-4");
    expect(item?.sourceAttachmentsIncomplete).toBeUndefined();
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-4")).anhangsIds).toEqual([]);
  });
});

describe("A2 · Anhangsänderung ohne neue Seitenfassung wird nachgezogen", () => {
  it("Bens Probe: Fassung 1 bleibt, a1/a2 → a3 — Probelauf meldet, echter Lauf gleicht an", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-5", seite("P-5", 1, { results: [anhang("a1"), anhang("a2")] }));
    await laufUndAnnehmen(q, d);
    const vorher = await objekt(d, "P-5");
    expect(vorher.anhangsIds).toEqual(["a1", "a2"]);

    q.bereich.set("P-5", seite("P-5", 1, { results: [anhang("a3")] }));
    const probe = await laufUndAnnehmen(q, d, true);
    expect(probe.sourceSync?.attachmentsUpdated).toEqual([
      {
        externalId: "P-5",
        koId: vorher.ko?.id,
        added: ["a3"],
        removed: ["a1", "a2"],
        synced: false,
      },
    ]);
    expect((await objekt(d, "P-5")).anhangsIds).toEqual(["a1", "a2"]);

    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.skipped).toBe(1);
    expect(lauf.imported).toBe(0);
    expect(await d.library.listImportCandidates()).toHaveLength(1); // kein neuer Kandidat
    expect(lauf.sourceSync?.attachmentsUpdated).toEqual([
      expect.objectContaining({
        externalId: "P-5",
        added: ["a3"],
        removed: ["a1", "a2"],
        synced: true,
      }),
    ]);
    const nachher = await objekt(d, "P-5");
    expect(nachher.anhangsIds).toEqual(["a3"]);
    expect(nachher.anhaenge[0]?.url).toBe(`${BASIS}/download/a3.png`);
    // Inhalt, Fassung und Anker bleiben unberührt.
    expect(nachher.ko?.statement).toBe(vorher.ko?.statement);
    expect(nachher.ko?.version).toBe(vorher.ko?.version);
    expect(nachher.anker).toEqual(vorher.anker);

    const ruhig = await laufUndAnnehmen(q, d);
    expect(ruhig.sourceSync?.attachmentsUpdated).toEqual([]);
  });

  it("geänderte Metadaten eines Anhangs (Größe) werden nachgezogen, Unverändertes behält seine Kennung", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-6", seite("P-6", 1, { results: [anhang("a1"), anhang("a2")] }));
    await laufUndAnnehmen(q, d);
    const vorher = await objekt(d, "P-6");
    const a1Quelle = vorher.anhaenge.find((s) => s.attachment?.externalId === "a1");

    q.bereich.set(
      "P-6",
      seite("P-6", 1, {
        results: [
          anhang("a1"),
          { ...anhang("a2"), extensions: { mediaType: "image/png", fileSize: 99 } },
        ],
      }),
    );
    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.sourceSync?.attachmentsUpdated).toEqual([
      expect.objectContaining({ externalId: "P-6", added: [], removed: [], synced: true }),
    ]);
    const nachher = await objekt(d, "P-6");
    expect(nachher.anhaenge.find((s) => s.attachment?.externalId === "a2")?.attachment?.size).toBe(
      99,
    );
    expect(nachher.anhaenge.find((s) => s.attachment?.externalId === "a1")).toEqual(a1Quelle);
  });

  it("Teilliste bei gleicher Fassung: neuer Anhang kommt dazu, nichts wird entfernt", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-7", seite("P-7", 1, { results: [anhang("a1"), anhang("a2")] }));
    await laufUndAnnehmen(q, d);

    q.bereich.set("P-7", seite("P-7", 1, { results: [anhang("a3")], _links: { next: "/x" } }));
    q.anhangsAntwort.set("P-7", { status: 500, body: {} });
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-7")).anhangsIds).toEqual(["a1", "a2", "a3"]);
  });

  it("ein Objekt im Papierkorb wird nicht angefasst", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-8", seite("P-8", 1, { results: [anhang("a1")] }));
    await laufUndAnnehmen(q, d);
    const { ko } = await objekt(d, "P-8");
    await d.koService.delete(ko?.id ?? "", "admin");

    q.bereich.set("P-8", seite("P-8", 1, { results: [anhang("a9")] }));
    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.sourceSync?.attachmentsUpdated).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// A2 über die ECHTE asynchrone Route: das Ergebnis steht am dauerhaften Lauf.
// ------------------------------------------------------------------------------------------------
const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_CONFLUENCE_SPACE"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

describe("A2 · Route: der Lauf nennt die Seiten mit angeglichenen Anhängen", () => {
  it("GET /api/admin/import/runs/:id liefert sourceSync.attachmentsUpdated", async () => {
    const q = quelle();
    q.bereich.set("P-9", seite("P-9", 1, { results: [anhang("a1")] }));
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const services = buildServices();
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const app = buildApp(services);
    const guards = makeGuards(services.auth);
    app.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards,
        reasoner: services.reasoner,
        makeAdapter: () => q.adapter,
        importRuns: services.importRuns,
        quellabgleich: services.quellabgleich,
      }),
    );
    app.register(
      importRunRoutes({
        importRuns: services.importRuns,
        externalSources: services.externalSources,
        quellabgleich: services.quellabgleich,
        guards,
      }),
    );
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    const lauf = async () => {
      const { importId } = (
        await app.inject({
          method: "POST",
          url: "/api/admin/import/confluence",
          headers,
          payload: {},
        })
      ).json() as { importId: string };
      await warteAufOffeneImportLaeufe(services.importRuns);
      return (
        await app.inject({ method: "GET", url: `/api/admin/import/runs/${importId}`, headers })
      ).json() as { status: string; sourceSync: { attachmentsUpdated?: string[] } | null };
    };

    await lauf();
    for (const k of await services.library.listImportCandidates()) {
      if (k.status === "neu") {
        await services.library.reviewImportCandidate(k.id, "accept", "admin");
      }
    }
    q.bereich.set("P-9", seite("P-9", 1, { results: [anhang("a2")] }));
    const zweiter = await lauf();
    expect(zweiter.status).toBe("COMPLETED");
    expect(zweiter.sourceSync?.attachmentsUpdated).toEqual(["P-9"]);
    const ko = (await services.ko.list()).find((k) =>
      k.sources.some((s) => s.externalId === "P-9"),
    );
    expect(
      ko?.sources.filter((s) => s.attachmentOf === "P-9").map((s) => s.attachment?.externalId),
    ).toEqual(["a2"]);
  });
});
