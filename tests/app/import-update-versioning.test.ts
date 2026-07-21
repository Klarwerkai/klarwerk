// WP-IC-6b (Pedis Entscheid: VERSIONIERUNG): Quell-Änderungen erkennen + Update-Weg über die
// bestehende Versionierungs-Mechanik. (1) ERKENNEN: bereits importierte Seiten mit NEUERER
// Quell-Version tragen sourceNewer (Badge im Cockpit); gleiche/ältere Version → kein Signal.
// (2) UPDATE-WEG: die Übernahme erzeugt einen Kandidaten, dessen menschliches Review-OK das
// BESTEHENDE KO als NEUE VERSION fortschreibt (acceptToKo-Re-Sync via revise — alte Fassung
// bleibt als Version erhalten, KEIN Duplikat-KO, kein Überschreiben ohne Review). (3) Bilanz
// zählt Aktualisierungen separat; danach ist der Import-Status wieder aktuell.
import { describe, expect, it } from "vitest";
import { initialSelection } from "../../apps/web/src/lib/importGroups";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";

function item(overrides: Partial<ImportItem> & { title: string }): ImportItem {
  return {
    statement: "Ausführliche Beschreibung der Wartung und Pflege der Anlage im Detail.",
    type: "best_practice",
    category: "K",
    provider: "Confluence",
    updatedAt: "2026-06-01T00:00:00.000Z",
    textCodec: "decoded",
    ...overrides,
  } as ImportItem;
}

// App mit aktivem externalId-Upsert-Strang (idempotente Queue + Re-Sync beim Annehmen) und
// MUTIERBARER Quell-Itemliste (der Test schiebt eine neuere Version nach).
async function versioningApp() {
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const services = buildServices();
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  const app = buildApp(services);
  const source: { items: ImportItem[] } = { items: [] };
  const adapter = {
    source: "Confluence",
    collect: async () => source.items,
    collectAll: async () => ({ items: source.items, failed: [], truncated: false }),
  } as unknown as ConfluenceSourceAdapter;
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: services.reasoner,
      makeAdapter: () => adapter,
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
  return {
    app,
    services,
    source,
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
  };
}

// Seite p1 in Version 1 importieren und im Review annehmen → bestehendes KO mit Anker v1.
async function seedImportedV1(services: Awaited<ReturnType<typeof versioningApp>>["services"]) {
  await services.library.createImportCandidates(
    [item({ title: "Pumpe warten", externalId: "p1", sourceVersion: 1 })],
    "tester",
  );
  const [candidate] = await services.library.listImportCandidates();
  await services.library.reviewImportCandidate((candidate as { id: string }).id, "accept", "pedi");
}

type GroupBody = {
  candidates: {
    id: string;
    title: string;
    alreadyImported: boolean;
    sourceNewer: boolean;
    hints: string[];
  }[];
  snapshotToken: number;
};

const groupRequest = (
  app: Awaited<ReturnType<typeof versioningApp>>["app"],
  headers: Record<string, string>,
) =>
  app.inject({
    method: "POST",
    url: "/api/admin/import/confluence/group",
    headers,
    payload: { criteria: {}, locale: "de" },
  });

describe("WP-IC-6b: Quell-Änderungen erkennen (sourceNewer im Cockpit)", () => {
  it("NEUERE Quell-Version → sourceNewer + wählbar; gleiche Version → kein Signal + vorab abgewählt", async () => {
    const { app, services, source, headers } = await versioningApp();
    await seedImportedV1(services);
    // Quelle liefert jetzt p1 in Version 2 (geändert) und eine neue Seite p2.
    source.items = [
      item({ title: "Pumpe warten (überarbeitet)", externalId: "p1", sourceVersion: 2 }),
      item({ title: "Neue Seite", externalId: "p2", sourceVersion: 1 }),
    ];
    const res = await groupRequest(app, headers);
    expect(res.statusCode).toBe(200);
    const body = res.json() as GroupBody;
    const byId = new Map(body.candidates.map((c) => [c.id, c]));
    expect(byId.get("p1")).toMatchObject({ alreadyImported: true, sourceNewer: true });
    expect(byId.get("p2")).toMatchObject({ alreadyImported: false, sourceNewer: false });
    // Auswahl-Vorgabe (Client-Lib): die Aktualisierung ist WÄHLBAR und startet ausgewählt.
    expect(initialSelection(body.candidates)).toEqual({ p1: true, p2: true });

    // Gegenprobe: GLEICHE Version → kein sourceNewer, unveränderte Dublette bleibt abgewählt.
    source.items = [item({ title: "Pumpe warten", externalId: "p1", sourceVersion: 1 })];
    // Frischer Scan (der 60-s-Snapshot-Cache ist je Routen-Registrierung — neue App bauen wäre
    // teurer; stattdessen zweite Registrierung vermeiden und den Cache über die Zeit hinweg
    // NICHT abwarten: eine NEUE App-Instanz liest die geänderte Quelle sicher frisch).
    const fresh = await versioningApp();
    await seedImportedV1(fresh.services);
    fresh.source.items = [item({ title: "Pumpe warten", externalId: "p1", sourceVersion: 1 })];
    const same = await groupRequest(fresh.app, fresh.headers);
    const sameBody = same.json() as GroupBody;
    expect(sameBody.candidates[0]).toMatchObject({ alreadyImported: true, sourceNewer: false });
    expect(initialSelection(sameBody.candidates)).toEqual({ p1: false });
  });
});

describe("WP-IC-6b: Update-Weg als VERSIONIERUNG (Review-Invariante bleibt)", () => {
  it("Übernahme + Review-OK schreiben das BESTEHENDE KO als neue Version fort; Bilanz zählt die Aktualisierung; Status kippt auf aktuell", async () => {
    const { app, services, source, headers } = await versioningApp();
    await seedImportedV1(services);
    const [koBefore] = await services.ko.list();
    expect(koBefore?.version).toBe(1);

    // Quelle: p1 wurde überarbeitet (v2), p2 ist neu.
    source.items = [
      item({
        title: "Pumpe warten (überarbeitet)",
        externalId: "p1",
        sourceVersion: 2,
        statement: "Neue, überarbeitete Beschreibung der Wartung mit aktualisierten Schritten.",
      }),
      item({ title: "Neue Seite", externalId: "p2", sourceVersion: 1 }),
    ];
    const grouped = (await groupRequest(app, headers)).json() as GroupBody;
    const apply = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers,
      payload: { criteria: {}, includeIds: ["p1", "p2"], snapshotToken: grouped.snapshotToken },
    });
    expect(apply.statusCode).toBe(200);
    // BILANZ: 2 übernommen, davon 1 Aktualisierung (p1) — separat gezählt.
    expect(apply.json()).toMatchObject({ imported: 2, updates: 1, alreadyQueued: 0 });

    // REVIEW-INVARIANTE: noch ist NICHTS am KO passiert — erst das menschliche OK übernimmt.
    expect((await services.ko.list()).length).toBe(1);
    expect((await services.ko.list())[0]?.version).toBe(1);

    // Menschliches Review-OK für die Aktualisierung → NEUE VERSION des BESTEHENDEN KOs
    // (revise: alte Fassung bleibt in der History, kein Duplikat-KO, CAS-Schreibpfad).
    const updateCandidate = (await services.library.listImportCandidates()).find(
      (c) => c.status === "neu" && c.item.sourceVersion === 2,
    );
    await services.library.reviewImportCandidate(
      (updateCandidate as { id: string }).id,
      "accept",
      "pedi",
    );
    const kos = await services.ko.list();
    // KEIN Duplikat-KO: weiterhin genau EIN KO (p2 wartet noch unangenommen in der Queue).
    expect(kos.length).toBe(1);
    const updated = kos.find((k) =>
      (k.sources ?? []).some((s) => s.externalId === "p1"),
    ) as (typeof kos)[number];
    expect(updated.id).toBe((koBefore as { id: string }).id); // KEIN neues KO — dasselbe Objekt
    expect(updated.version).toBe(2); // neue Version
    expect(updated.title).toBe("Pumpe warten (überarbeitet)");
    expect(updated.history.length).toBeGreaterThanOrEqual(2); // alte Fassung bleibt als Version
    expect((updated.sources ?? []).find((s) => s.externalId === "p1")?.sourceVersion).toBe(2);

    // STATUS: die Seite ist wieder AKTUELL — sourceNewer verschwindet.
    const after = (await groupRequest(app, headers)).json() as GroupBody;
    const p1After = after.candidates.find((c) => c.id === "p1");
    expect(p1After).toMatchObject({ alreadyImported: true, sourceNewer: false });
  });
});
