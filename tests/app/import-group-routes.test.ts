// WP-IC-4 (Teil 1+3, Routen): /group liefert Gruppen + deterministische Qualitätshinweise je
// Kandidat (Dublette/veraltet/wenig Inhalt) und lehnt über der harten 200er-Kappung ehrlich ab;
// /apply übernimmt die freigegebenen Ids über den BESTEHENDEN Import-Weg (Review-Queue) und
// liefert die ehrliche Teil-Bilanz (imported/failed/notFound). Läuft komplett ohne Modell
// (deterministischer Themen-Fallback, fallbackReason no-model).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";
import { MAX_GROUP_CANDIDATES } from "../../services/reasoner";

function fixtureAdapter(items: ImportItem[]): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed: [], truncated: false }),
  } as unknown as ConfluenceSourceAdapter;
}

function item(overrides: Partial<ImportItem> & { title: string }): ImportItem {
  return {
    statement: "kurz",
    type: "best_practice",
    category: "K",
    provider: "Confluence",
    updatedAt: "2026-06-01T00:00:00.000Z",
    textCodec: "decoded",
    ...overrides,
  } as ImportItem;
}

async function importApp(items: ImportItem[]) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: services.reasoner,
      makeAdapter: () => fixtureAdapter(items),
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
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

const LONG_STATEMENT = "Ausführliche Beschreibung der Wartung. ".repeat(8); // > 200 Zeichen

describe("WP-IC-4: POST /api/admin/import/confluence/group", () => {
  it("gruppiert deterministisch nach Themen (ohne Modell: demo + no-model) und liefert Hinweise", async () => {
    const items = [
      item({
        title: "Pumpe warten",
        externalId: "p1",
        tags: ["wartung"],
        statement: LONG_STATEMENT,
      }),
      item({ title: "Ventil tauschen", externalId: "p2", tags: ["wartung"] }), // kurz → short
      item({
        title: "Uralt-Notiz",
        externalId: "p3",
        updatedAt: "2020-01-01T00:00:00.000Z", // > 365 Tage → stale
        statement: LONG_STATEMENT,
      }),
    ];
    const { app, services, headers } = await importApp(items);
    // p2 liegt bereits als offener Kandidat in der Queue → IC-6a meldet „bereits importiert".
    await services.library.createImportCandidates(
      [item({ title: "Ventil tauschen", externalId: "p2" })],
      "tester",
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/group",
      headers,
      payload: { criteria: {}, locale: "de" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      groups: { title: string; ids: string[]; kind?: string }[];
      candidates: { id: string; alreadyImported: boolean; hints: string[] }[];
      demo: boolean;
      fallbackReason?: string;
    };
    // Ohne Modell: ehrliche deterministische Themen-Gruppierung, klar gekennzeichnet.
    expect(body.demo).toBe(true);
    expect(body.fallbackReason).toBe("no-model");
    const wartung = body.groups.find((g) => g.title === "wartung");
    expect(wartung?.ids.sort()).toEqual(["p1", "p2"]);
    // Deterministische Qualitätshinweise je Kandidat.
    const byId = new Map(body.candidates.map((c) => [c.id, c]));
    expect(byId.get("p1")?.hints).toEqual([]);
    expect(byId.get("p2")?.alreadyImported).toBe(true);
    expect(byId.get("p2")?.hints).toEqual(["already-imported", "short"]);
    expect(byId.get("p3")?.hints).toEqual(["stale"]);
  });

  it("harte Kappung: mehr als 200 Kandidaten → ehrliche 400-Meldung (weiter eingrenzen)", async () => {
    const many = Array.from({ length: MAX_GROUP_CANDIDATES + 1 }, (_, i) =>
      item({ title: `Seite ${i + 1}`, externalId: `p${i + 1}` }),
    );
    const { app, headers } = await importApp(many);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/group",
      headers,
      payload: { criteria: {} },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; message: string };
    expect(body.error).toBe("GROUP_TOO_MANY");
    expect(body.message).toContain("201");
  });
});

describe("WP-IC-4: POST /api/admin/import/confluence/apply (bestehender Import-Weg + Bilanz)", () => {
  it("übernimmt freigegebene Ids in die Review-Queue; failed/notFound sind ehrlich beziffert", async () => {
    const items = [
      item({ title: "Pumpe warten", externalId: "p1" }),
      item({ title: "Ventil tauschen", externalId: "p2" }),
      item({ title: "Fehlercode E5", externalId: "p3" }),
    ];
    const { app, services, headers } = await importApp(items);
    // Fehlschlag-Pfad: der zweite Kandidat scheitert beim Anlegen (injizierter Fehler).
    const original = services.library.createImportCandidates.bind(services.library);
    services.library.createImportCandidates = (async (batch, actor) => {
      if (batch[0]?.externalId === "p2") {
        throw new Error("Queue kurzzeitig nicht verfügbar");
      }
      return original(batch, actor);
    }) as typeof services.library.createImportCandidates;

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers,
      payload: { criteria: {}, includeIds: ["p1", "p2", "gibt-es-nicht"] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      imported: number;
      failed: { id: string; reason: string }[];
      notFound: string[];
    };
    expect(body.imported).toBe(1);
    expect(body.failed).toEqual([{ id: "p2", reason: "Error" }]);
    expect(body.notFound).toEqual(["gibt-es-nicht"]);
    // REVIEW-INVARIANTE: der Import landet als Kandidat in der Queue, NICHT als KO.
    const queue = await services.library.listImportCandidates();
    expect(queue.map((c) => c.item.externalId)).toEqual(["p1"]);
    expect(await services.ko.list()).toEqual([]);
  });
});
