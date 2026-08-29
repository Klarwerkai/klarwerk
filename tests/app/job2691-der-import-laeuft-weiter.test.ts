import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";

// ================================================================================================
// JOB 2691 D1 — DER IMPORT LAEUFT WEITER, UND DER MENSCH SIEHT EINEN FEHLER (Befund R2-2)
// ================================================================================================
//
// Der Nachweis aus dem Befund, woertlich: „Route mit Fake-Adapter, dessen collectAll 2 s braucht →
// heute antwortet die Route nach 2 s mit COMPLETED; nach dem Fix sofort mit QUEUED und runs/:id
// nach 2 s COMPLETED." Genau das misst Teil A. Teil B misst den zweiten Klick, Teil C den Snapshot
// ohne Volltext und das Nachladen je Id beim Anwenden.

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

const SEK = 1000;
const LANGSAM_MS = 2 * SEK;

function seite(over: Partial<ImportItem>): ImportItem {
  return {
    title: over.title ?? "Seite",
    statement: over.statement ?? "Aussage der Seite.",
    type: "best_practice",
    category: "K",
    provider: "Confluence",
    ...over,
  };
}

const SEITEN: ImportItem[] = [
  seite({ title: "Wartung Pumpe", externalId: "p1", sourceVersion: 1, bodyHtml: "<p>Pumpe voll</p>" }),
  seite({ title: "Wartung Ventil", externalId: "p2", sourceVersion: 1, bodyHtml: "<p>Ventil voll</p>" }),
  seite({
    title: "Wartung Filter",
    externalId: "p3",
    sourceVersion: 1,
    bodyHtml: '<p>Filter voll</p><img src="/api/objects/f/raw">',
  }),
];

interface AdapterOptionen {
  dauerMs?: number;
  mitFetchItem?: boolean;
  fehlendeIds?: string[];
}

function fakeAdapter(opts: AdapterOptionen = {}) {
  const zaehler = { collectAll: 0, fetchItem: [] as string[] };
  const adapter = {
    source: "Confluence",
    collect: async () => SEITEN,
    collectAll: async () => {
      zaehler.collectAll += 1;
      if (opts.dauerMs) {
        await new Promise((r) => setTimeout(r, opts.dauerMs));
      }
      return { items: SEITEN, failed: [], truncated: false };
    },
    ...(opts.mitFetchItem
      ? {
          fetchItem: async (externalId: string) => {
            zaehler.fetchItem.push(externalId);
            if (opts.fehlendeIds?.includes(externalId)) {
              return undefined;
            }
            const s = SEITEN.find((x) => x.externalId === externalId);
            return s ? { ...s, bodyHtml: `<p>${s.title} — frisch nachgeladen</p>` } : undefined;
          },
        }
      : {}),
  } as unknown as ConfluenceSourceAdapter;
  return { adapter, zaehler };
}

async function appMit(opts: AdapterOptionen = {}) {
  const { adapter, zaehler } = fakeAdapter(opts);
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
      makeAdapter: () => adapter,
      importRuns: services.importRuns,
    }),
  );
  app.register(
    importRunRoutes({
      importRuns: services.importRuns,
      externalSources: services.externalSources,
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
  const starte = () =>
    app.inject({ method: "POST", url: "/api/admin/import/confluence", headers, payload: {} });
  const lauf = async (id: string) =>
    (
      await app.inject({ method: "GET", url: `/api/admin/import/runs/${id}`, headers })
    ).json() as { importId: string; status: string; counters?: Record<string, number> };
  return { app, services, headers, zaehler, starte, lauf };
}

describe("JOB 2691 D1 · A · sofort QUEUED, spaeter COMPLETED", () => {
  it("A1 · collectAll braucht 2 s: die Route antwortet SOFORT mit 202 QUEUED, nicht nach 2 s mit COMPLETED", async () => {
    const { services, starte, lauf } = await appMit({ dauerMs: LANGSAM_MS });
    const t0 = Date.now();
    const antwort = await starte();
    const dauer = Date.now() - t0;

    expect(antwort.statusCode).toBe(202);
    const koerper = antwort.json() as { importId: string; status: string };
    expect(koerper.status).toBe("QUEUED");
    expect(koerper.importId).toMatch(/[0-9a-f-]{36}/);
    // „Sofort": deutlich unter der Dauer des Scans — bis 2691 lag dieser Wert bei rund 2000 ms.
    expect(dauer).toBeLessThan(LANGSAM_MS / 2);

    // Waehrend des Scans: der Lauf ist lesbar und laeuft (FETCHING, bereits nach QUEUED).
    const unterwegs = await lauf(koerper.importId);
    expect(["QUEUED", "FETCHING"]).toContain(unterwegs.status);

    await warteAufOffeneImportLaeufe(services.importRuns);
    const ende = await lauf(koerper.importId);
    expect(ende.status).toBe("COMPLETED");
    expect(ende.counters?.itemsTotal).toBe(3);
    expect(ende.counters?.itemsCreated).toBe(3);
  }, 15 * SEK);

  it("A2 · runs/:id zeigt nach etwa 2 s COMPLETED — gemessen mit der Uhr, nicht mit dem Warte-Helfer", async () => {
    const { starte, lauf } = await appMit({ dauerMs: LANGSAM_MS });
    const t0 = Date.now();
    const { importId } = (await starte()).json() as { importId: string };
    let status = "";
    let beiMs = 0;
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 100));
      status = (await lauf(importId)).status;
      if (status === "COMPLETED") {
        beiMs = Date.now() - t0;
        break;
      }
    }
    expect(status).toBe("COMPLETED");
    expect(beiMs).toBeGreaterThanOrEqual(LANGSAM_MS);
    expect(beiMs).toBeLessThan(LANGSAM_MS + 3 * SEK);
  }, 15 * SEK);

  it("A3 · ohne Adapter: 202 QUEUED, und der Lauf endet sichtbar auf FAILED IMPORT_UNAVAILABLE", async () => {
    const { app, services, headers, lauf } = await appMit();
    // Eine zweite Registrierung derselben Routen OHNE Adapter, unter eigenem Praefix waere ein
    // Umbau — stattdessen: ein Adapter-Fabrik-Doppel, das nichts liefert.
    const ohne = buildApp(services);
    const guards = makeGuards(services.auth);
    ohne.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards,
        makeAdapter: () => undefined,
        importRuns: services.importRuns,
      }),
    );
    const antwort = await ohne.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    expect(antwort.statusCode).toBe(202);
    const { importId } = antwort.json() as { importId: string };
    await warteAufOffeneImportLaeufe(services.importRuns);
    const ende = await lauf(importId);
    expect(ende.status).toBe("FAILED");
    expect((ende as { failureCode?: string }).failureCode).toBe("IMPORT_UNAVAILABLE");
    void app;
  });
});

describe("JOB 2691 D1 · B · der zweite Klick", () => {
  it("B1 · waehrend ein Lauf laeuft, bekommt der zweite Start 409 mit der Kennung des laufenden — kein zweiter Scan", async () => {
    const { services, starte, zaehler } = await appMit({ dauerMs: LANGSAM_MS });
    const erster = (await starte()).json() as { importId: string };
    const zweiter = await starte();
    expect(zweiter.statusCode).toBe(409);
    const koerper = zweiter.json() as { error: string; importId: string };
    expect(koerper.error).toBe("IMPORT_ALREADY_RUNNING");
    expect(koerper.importId).toBe(erster.importId);
    await warteAufOffeneImportLaeufe(services.importRuns);
    // Bis 2691: kein Tor — der zweite Aufruf startete einen zweiten Lauf mit eigenem Scan.
    expect(zaehler.collectAll).toBe(1);
  }, 15 * SEK);

  it("B2 · nach dem Ende ist ein neuer Start wieder moeglich — die Sperre ist kein Dauerzustand", async () => {
    const { services, starte, lauf } = await appMit();
    const a = (await starte()).json() as { importId: string };
    await warteAufOffeneImportLaeufe(services.importRuns);
    const b = await starte();
    expect(b.statusCode).toBe(202);
    const bId = (b.json() as { importId: string }).importId;
    expect(bId).not.toBe(a.importId);
    await warteAufOffeneImportLaeufe(services.importRuns);
    // Der zweite Lauf findet alles bereits vorgemerkt: 3 uebersprungen, 0 neu — idempotent.
    const ende = await lauf(bId);
    expect(ende.status).toBe("COMPLETED");
    expect(ende.counters?.itemsSkipped).toBe(3);
    expect(ende.counters?.itemsCreated).toBe(0);
  });
});

describe("JOB 2691 D1 · C · der Snapshot haelt keinen Volltext, das Anwenden laedt je Id nach", () => {
  async function kandidaten(app: Awaited<ReturnType<typeof appMit>>["app"], headers: Record<string, string>) {
    const res = await app.inject({ method: "GET", url: "/api/library/import/candidates", headers });
    expect(res.statusCode).toBe(200);
    return res.json() as Array<{ item: ImportItem }>;
  }

  async function anwenden(ctx: Awaited<ReturnType<typeof appMit>>) {
    const gruppe = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/group",
      headers: ctx.headers,
      payload: { criteria: {}, locale: "de" },
    });
    expect(gruppe.statusCode).toBe(200);
    const { candidates, snapshotToken } = gruppe.json() as {
      candidates: Array<{ id: string; title: string }>;
      snapshotToken: number;
    };
    const ids = candidates.map((c) => c.id);
    const apply = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers: ctx.headers,
      payload: { criteria: {}, includeIds: ids, snapshotToken },
    });
    expect(apply.statusCode).toBe(200);
    return { ids, bilanz: apply.json() as { imported: number; notFound: string[] } };
  }

  it("C1 · mit fetchItem: jeder Kandidat traegt den FRISCH nachgeladenen Volltext, je Id genau ein Nachladen", async () => {
    const ctx = await appMit({ mitFetchItem: true });
    const { bilanz } = await anwenden(ctx);
    expect(bilanz.imported).toBe(3);
    expect([...ctx.zaehler.fetchItem].sort()).toEqual(["p1", "p2", "p3"]);
    const liste = await kandidaten(ctx.app, ctx.headers);
    expect(liste).toHaveLength(3);
    for (const k of liste) {
      expect(k.item.bodyHtml).toContain("frisch nachgeladen");
    }
  });

  it("C2 · ohne fetchItem (Fixture-Adapter): der Snapshot-Stand traegt KEIN bodyHtml — der Beleg, dass der Snapshot keinen Volltext haelt", async () => {
    const ctx = await appMit({ mitFetchItem: false });
    // Der Bildhinweis der Erkundung ueberlebt den Volltext: genau eine Seite traegt ein Bild.
    const erkundung = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers: ctx.headers,
      payload: {},
    });
    expect(erkundung.statusCode).toBe(200);
    expect((erkundung.json() as { summary: { withImagesHint: number } }).summary.withImagesHint).toBe(1);
    const { bilanz } = await anwenden(ctx);
    expect(bilanz.imported).toBe(3);
    const liste = await kandidaten(ctx.app, ctx.headers);
    expect(liste).toHaveLength(3);
    for (const k of liste) {
      expect(k.item.bodyHtml).toBeUndefined();
      // Metadaten und Klartext sind da — das reicht fuers Erkunden, Auswaehlen, Gruppieren.
      expect(k.item.title).toMatch(/^Wartung /);
      expect(k.item.statement).toBe("Aussage der Seite.");
    }
  });

  it("C3 · eine inzwischen geloeschte Seite (fetchItem liefert nichts) wird ehrlich als notFound gefuehrt", async () => {
    const ctx = await appMit({ mitFetchItem: true, fehlendeIds: ["p2"] });
    const { ids, bilanz } = await anwenden(ctx);
    expect(bilanz.imported).toBe(2);
    expect(bilanz.notFound).toHaveLength(1);
    expect(ids).toContain(bilanz.notFound[0]);
  });

  it("C4 · Messung zum Erkunden: zwei gleichzeitige Erkundungen teilen EINEN Scan (das Tor gab es schon)", async () => {
    const ctx = await appMit({ dauerMs: 300 });
    const [a, b] = await Promise.all([
      ctx.app.inject({ method: "POST", url: "/api/admin/import/confluence/explore", headers: ctx.headers }),
      ctx.app.inject({ method: "POST", url: "/api/admin/import/confluence/explore", headers: ctx.headers }),
    ]);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(ctx.zaehler.collectAll).toBe(1);
  });
});
