// ================================================================================================
// R-0162 · R-0163 — DIE VIER IN RUNDE 2 REPRODUZIERTEN FEHLER, JE ALS NEGATIVFALL.
// ================================================================================================
//
//   N1  Einzelabruf 200 OHNE Seiten-Id → Zustand unbekannt, KEIN Löschvermerk.
//   N2  Vermerkte Seite taucht mit DERSELBEN Version wieder auf → Vermerk aufgehoben.
//   N3  Bereichsimport mit Teilliste der Anhänge → nachgeblättert; misslingt das, bleiben die
//       bestehenden Anhangsquellen stehen.
//   N4  Über die ECHTE asynchrone Route: unbekannter Zustand → PARTIAL mit benanntem Grund, und
//       das Abgleichsergebnis steht am Lauf (GET /api/admin/import/runs/:id).
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
  ConfluenceUnusableResponseError,
} from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
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

type Einzel = "seite" | "404" | "ohne-id" | "500";

/** Attrappe: Bereichsliste, Einzelabruf je Id (steuerbar), Anhangsliste je Id (steuerbar). */
function quelle() {
  const bereich = new Map<string, ConfluencePage>();
  const einzel = new Map<string, Einzel>();
  const anhaenge = new Map<string, { results: unknown[] } | "500">();
  const antwort = (status: number, body: unknown) =>
    ({ ok: status < 300, status, json: async () => body }) as Response;
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    const anhang = /\/rest\/api\/content\/([^/?]+)\/child\/attachment$/.exec(url.pathname);
    if (anhang) {
      const a = anhaenge.get(decodeURIComponent(anhang[1] ?? ""));
      return a === "500" ? antwort(500, {}) : antwort(200, a ?? { results: [] });
    }
    const id = /\/rest\/api\/content\/([^/?]+)$/.exec(url.pathname)?.[1];
    if (id) {
      const art = einzel.get(decodeURIComponent(id)) ?? (bereich.has(id) ? "seite" : "404");
      if (art === "404") {
        return antwort(404, {});
      }
      if (art === "500") {
        return antwort(500, {});
      }
      return art === "ohne-id"
        ? antwort(200, { title: "irgendwas", status: "current" })
        : antwort(200, bereich.get(id) ?? seite(id));
    }
    return antwort(200, { results: [...bereich.values()] });
  }) as unknown as typeof fetch;
  const adapter = adapterFromConfig({
    baseUrl: BASIS,
    email: "svc@acme.example",
    apiToken: "tok",
    spaceKey: "K",
    fetchFn,
  });
  return { adapter, bereich, einzel, anhaenge };
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

async function anker(d: ReturnType<typeof dienste>, externalId: string) {
  const ko = (await d.koService.list()).find((k) =>
    k.sources.some((s) => s.externalId === externalId),
  );
  return { ko, anker: ko?.sources.find((s) => s.externalId === externalId) };
}

describe("N1 · eine Erfolgsantwort ohne Seite ist kein Löschbeleg", () => {
  it("200 ohne id: der Client wirft, der Abgleich meldet „unbekannt“ und vermerkt nichts", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-1", seite("P-1"));
    await laufUndAnnehmen(q, d);

    q.bereich.delete("P-1");
    q.einzel.set("P-1", "ohne-id");
    await expect(q.adapter.fetchItem("P-1")).rejects.toBeInstanceOf(
      ConfluenceUnusableResponseError,
    );
    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.sourceSync?.unchecked).toEqual(["P-1"]);
    expect(lauf.sourceSync?.removed).toEqual([]);
    expect((await anker(d, "P-1")).anker?.sourceRemovedAt).toBeUndefined();
  });

  it("Gegenprobe: nur die 404 vermerkt", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-1", seite("P-1"));
    await laufUndAnnehmen(q, d);
    q.bereich.delete("P-1");
    q.einzel.set("P-1", "404");
    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.sourceSync?.removed.map((r) => r.externalId)).toEqual(["P-1"]);
    expect(typeof (await anker(d, "P-1")).anker?.sourceRemovedAt).toBe("string");
  });
});

describe("N2 · eine wieder vorhandene Seite hebt den Vermerk auf — auch ohne höhere Version", () => {
  it("Probelauf meldet, echter Lauf hebt auf; der nächste Lauf ist ruhig", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-2", seite("P-2"));
    await laufUndAnnehmen(q, d);
    q.bereich.delete("P-2");
    await laufUndAnnehmen(q, d);
    expect(typeof (await anker(d, "P-2")).anker?.sourceRemovedAt).toBe("string");

    // Dieselbe Seite, DIESELBE Version, wieder im Bereich.
    q.bereich.set("P-2", seite("P-2"));
    const probe = await laufUndAnnehmen(q, d, true);
    expect(probe.sourceSync?.restored).toEqual([
      expect.objectContaining({ externalId: "P-2", cleared: false }),
    ]);
    expect(typeof (await anker(d, "P-2")).anker?.sourceRemovedAt).toBe("string");

    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.skipped).toBe(1); // keine neue Fassung — trotzdem wird nachgezogen
    expect(lauf.sourceSync?.restored).toEqual([
      expect.objectContaining({ externalId: "P-2", cleared: true }),
    ]);
    expect((await anker(d, "P-2")).anker?.sourceRemovedAt).toBeUndefined();

    const ruhig = await laufUndAnnehmen(q, d);
    expect(ruhig.sourceSync?.restored).toEqual([]);
    expect(ruhig.sourceSync?.removed).toEqual([]);
  });
});

describe("N3 · Anhänge im Bereichsimport: vervollständigen oder bestehende Quellen behalten", () => {
  const zwei = {
    results: [
      { id: "att1", title: "a.png", _links: { download: "/download/a.png" } },
      { id: "att2", title: "b.png", _links: { download: "/download/b.png" } },
    ],
  };
  const teil = (version: number) =>
    seite("P-3", {
      version: { number: version },
      children: {
        attachment: {
          results: [{ id: "att1", title: "a.png", _links: { download: "/download/a.png" } }],
          _links: { next: "/rest/api/content/P-3/child/attachment?start=1" },
        },
      },
    });

  it("der Bereichsimport blättert die Teilliste nach — beide Anhänge kommen an", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-3", teil(1));
    q.anhaenge.set("P-3", zwei);
    await laufUndAnnehmen(q, d);
    const { ko } = await anker(d, "P-3");
    expect(ko?.sources.filter((s) => s.attachmentOf === "P-3").map((s) => s.label)).toEqual([
      "a.png",
      "b.png",
    ]);
  });

  it("misslingt das Nachblättern, entfernt die Teilantwort keine bestehende Anhangsquelle", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-3", seite("P-3", { children: { attachment: zwei } }));
    await laufUndAnnehmen(q, d);

    q.bereich.set("P-3", teil(2));
    q.anhaenge.set("P-3", "500");
    const lauf = await laufUndAnnehmen(q, d);
    expect(lauf.imported).toBe(1);
    const { ko } = await anker(d, "P-3");
    expect(
      ko?.sources
        .filter((s) => s.attachmentOf === "P-3")
        .map((s) => s.label)
        .sort(),
    ).toEqual(["a.png", "b.png"]);
    expect(ko?.sources.find((s) => s.externalId === "P-3")?.sourceVersion).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------
// N4 — über die ECHTE Route und die ECHTE Laufablage
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

async function appMit(q: ReturnType<typeof quelle>) {
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
    ).json() as {
      status: string;
      failureCode: string | null;
      failureReason: string | null;
      counters: Record<string, number>;
      sourceSync: {
        checked: boolean;
        removed: string[];
        restored: string[];
        unchecked: string[];
      } | null;
    };
  };
  const annehmen = async () => {
    for (const k of await services.library.listImportCandidates()) {
      if (k.status === "neu") {
        await services.library.reviewImportCandidate(k.id, "accept", "admin");
      }
    }
  };
  return { lauf, annehmen };
}

describe("N4 · das Abgleichsergebnis steht am dauerhaften Lauf", () => {
  it("unbekannter Zustand → PARTIAL mit SOURCE_SYNC_INCOMPLETE, Liste am Lauf", async () => {
    const q = quelle();
    q.bereich.set("P-4", seite("P-4"));
    q.bereich.set("P-5", seite("P-5"));
    const { lauf, annehmen } = await appMit(q);
    const erster = await lauf();
    expect(erster.status).toBe("COMPLETED");
    expect(erster.sourceSync).toEqual(
      expect.objectContaining({ checked: true, removed: [], unchecked: [] }),
    );
    await annehmen();

    q.bereich.delete("P-4");
    q.einzel.set("P-4", "500");
    const zweiter = await lauf();
    expect(zweiter.status).toBe("PARTIAL");
    expect(zweiter.failureCode).toBe("SOURCE_SYNC_INCOMPLETE");
    expect(zweiter.failureReason).toContain("unbekanntem Zustand");
    expect(zweiter.counters.itemsFailed).toBe(0);
    expect(zweiter.sourceSync?.unchecked).toEqual(["P-4"]);
  });

  it("bestätigte Löschung → COMPLETED, und der Lauf nennt die gelöschte Seite", async () => {
    const q = quelle();
    q.bereich.set("P-6", seite("P-6"));
    const { lauf, annehmen } = await appMit(q);
    await lauf();
    await annehmen();
    q.bereich.delete("P-6");
    const zweiter = await lauf();
    expect(zweiter.status).toBe("COMPLETED");
    expect(zweiter.failureCode).toBeNull();
    expect(zweiter.sourceSync?.removed).toEqual(["P-6"]);
  });
});
