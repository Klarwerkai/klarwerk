// WP-IC-4 (Teil 1+3, Routen): /group liefert Gruppen + deterministische Qualitätshinweise je
// Kandidat (Dublette/veraltet/wenig Inhalt) und lehnt über der harten 200er-Kappung ehrlich ab;
// /apply übernimmt die freigegebenen Ids über den BESTEHENDEN Import-Weg (Review-Queue) und
// liefert die ehrliche Teil-Bilanz (imported/failed/notFound). Läuft komplett ohne Modell
// (deterministischer Themen-Fallback, fallbackReason no-model).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import {
  MAX_APPLY_IDS,
  confluenceImportRoutes,
} from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import {
  GROUP_PROMPT_MAX_UTF8_BYTES,
  GROUP_TITLE_MAX_INPUT_CHARS,
  type ImportItem,
  groupPromptUtf8Bytes,
  groupingCandidates,
  groupingRequiresConfidential,
} from "../../services/library-analytics";
import { MAX_GROUP_CANDIDATES, ModelProvider, Reasoner } from "../../services/reasoner";

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

async function importApp(
  items: ImportItem[],
  opts: {
    reasoner?: Reasoner;
    // WP-SHIP7-FIX (Fix 3): schaltet den externalId-Upsert-Strang (idempotente Queue) NUR für
    // buildServices ein — buildApp liest die ENV danach nicht mehr (keine Doppel-Registrierung).
    externalUpsert?: boolean;
    adapter?: ConfluenceSourceAdapter;
  } = {},
) {
  if (opts.externalUpsert) {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  }
  const services = buildServices();
  if (opts.externalUpsert) {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  }
  const app = buildApp(services);
  const adapter = opts.adapter ?? fixtureAdapter(items);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: opts.reasoner ?? services.reasoner,
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
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

// WP-SHIP7-FIX (bens P0, Fix 1): Reasoner mit Cloud-Provider, dessen complete-Aufrufe gezählt
// werden — der einzige Weg, auf dem Kandidatendaten die Maschine verlassen würden.
function cloudSpyReasoner(ids: readonly string[]) {
  let calls = 0;
  const provider = new ModelProvider({
    name: "anthropic:test",
    complete: async () => {
      calls += 1;
      return JSON.stringify({ groups: [{ title: "Alles", ids: [...ids] }] });
    },
  });
  return { reasoner: new Reasoner(provider), cloudCalls: () => calls };
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

describe("WP-SHIP7-FIX P0 (Fix 1): Vertraulichkeit der Gruppierung — Cloud nur bei explizit freigegebenen Stufen", () => {
  const groupRequest = (
    app: Awaited<ReturnType<typeof importApp>>["app"],
    headers: Record<string, string>,
  ) =>
    app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/group",
      headers,
      payload: { criteria: {}, locale: "de" },
    });

  it("restringierte Stufe (vertraulich) → NULL Cloud-Aufrufe; ehrlicher deterministischer Fallback", async () => {
    const spy = cloudSpyReasoner(["p1", "p2"]);
    const { app, headers } = await importApp(
      [
        item({ title: "Offen", externalId: "p1", confidentiality: "intern" }),
        item({ title: "Restringiert", externalId: "p2", confidentiality: "vertraulich" }),
      ],
      { reasoner: spy.reasoner },
    );
    const res = await groupRequest(app, headers);
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0); // KEIN Kandidat verlässt die Maschine
    expect((res.json() as { demo: boolean }).demo).toBe(true); // ehrlich: ohne KI gruppiert
  });

  it("FEHLENDE Stufe (kein Governance-Signal) → fail-safe vertraulich → NULL Cloud-Aufrufe", async () => {
    const spy = cloudSpyReasoner(["p1", "p2"]);
    const { app, headers } = await importApp(
      [
        item({ title: "Offen", externalId: "p1", confidentiality: "intern" }),
        item({ title: "Ohne Signal", externalId: "p2" }), // confidentiality fehlt
      ],
      { reasoner: spy.reasoner },
    );
    const res = await groupRequest(app, headers);
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0);
  });

  it("UNGÜLTIGE Stufe → fail-safe vertraulich → NULL Cloud-Aufrufe", async () => {
    const spy = cloudSpyReasoner(["p1"]);
    const { app, headers } = await importApp(
      [
        item({
          title: "Kaputt klassifiziert",
          externalId: "p1",
          confidentiality: "public" as unknown as NonNullable<ImportItem["confidentiality"]>,
        }),
      ],
      { reasoner: spy.reasoner },
    );
    const res = await groupRequest(app, headers);
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0);
  });

  it("POSITIV: NUR wenn ALLE Kandidaten explizit gültig freigegeben (intern) sind, arbeitet die Cloud", async () => {
    const spy = cloudSpyReasoner(["p1", "p2"]);
    const { app, headers } = await importApp(
      [
        item({ title: "Offen A", externalId: "p1", confidentiality: "intern" }),
        item({ title: "Offen B", externalId: "p2", confidentiality: "intern" }),
      ],
      { reasoner: spy.reasoner },
    );
    const res = await groupRequest(app, headers);
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(1);
    const body = res.json() as { demo: boolean; groups: { ids: string[] }[] };
    expect(body.demo).toBe(false);
    expect(body.groups.flatMap((g) => g.ids).sort()).toEqual(["p1", "p2"]);
  });

  it("Batch-Vertrag als pure Regel: EIN unklarer Kandidat macht den GANZEN Batch vertraulich", () => {
    const intern = item({ title: "A", confidentiality: "intern" });
    expect(groupingRequiresConfidential([intern])).toBe(false);
    expect(groupingRequiresConfidential([intern, item({ title: "B" })])).toBe(true);
    expect(
      groupingRequiresConfidential([intern, item({ title: "C", confidentiality: "vertraulich" })]),
    ).toBe(true);
    expect(
      groupingRequiresConfidential([
        intern,
        item({ title: "D", confidentiality: "streng_vertraulich" }),
      ]),
    ).toBe(true);
  });
});

describe("WP-SHIP7-FIX (GELB): Prompt-Deckel der Gruppierungs-Eingabe", () => {
  it("Titel werden auf 160 Zeichen gekappt; über dem UTF-8-Budget werden die Kurztexte gestuft gekürzt", () => {
    const longTitle = "T".repeat(300);
    const single = groupingCandidates([item({ title: longTitle })]);
    expect(single[0]?.title.length).toBe(GROUP_TITLE_MAX_INPUT_CHARS);
    // 200 Kandidaten mit langen Titeln + langen Texten sprengen das Budget mit 240er-Texten —
    // die Stufung kürzt die Texte deterministisch, bis der Gesamtprompt unter dem Deckel liegt.
    const many = Array.from({ length: 200 }, (_, i) =>
      item({
        title: "T".repeat(160),
        externalId: `p${i + 1}`,
        statement: "Ausführliche Beschreibung der Wartung und Pflege. ".repeat(8),
      }),
    );
    const shaped = groupingCandidates(many);
    expect(groupPromptUtf8Bytes(shaped)).toBeLessThanOrEqual(GROUP_PROMPT_MAX_UTF8_BYTES);
    // Ehrliche Kappung statt stiller Vollübertragung: die Texte sind kürzer als der 240er-Deckel.
    expect(shaped.every((c) => (c.text ?? "").length < 240)).toBe(true);
    expect(shaped.some((c) => (c.text ?? "").length > 0)).toBe(true);
  });
});

describe("WP-SHIP7-FIX (Fix 3): /apply — Dedupe, Deckel, ehrliche No-op-Zählung, Snapshot-Pin", () => {
  it("doppelte Ids werden EINMAL verarbeitet; über MAX_APPLY_IDS → ehrlicher 400", async () => {
    const { app, services, headers } = await importApp([
      item({ title: "Pumpe warten", externalId: "p1" }),
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers,
      payload: { criteria: {}, includeIds: ["p1", "p1", "p1"] },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { imported: number }).imported).toBe(1);
    expect((await services.library.listImportCandidates()).length).toBe(1);

    const tooMany = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers,
      payload: {
        criteria: {},
        includeIds: Array.from({ length: MAX_APPLY_IDS + 1 }, (_, i) => `id-${i}`),
      },
    });
    expect(tooMany.statusCode).toBe(400);
    expect((tooMany.json() as { error: string }).error).toBe("APPLY_TOO_MANY");
  });

  it("Retry/Parallel-No-op: bereits eingereihter Kandidat zählt als alreadyQueued, NICHT als importiert", async () => {
    const { app, headers } = await importApp([item({ title: "Pumpe warten", externalId: "p1" })], {
      externalUpsert: true, // idempotente Queue (externalId@version) wie im echten Import-Betrieb
    });
    const apply = () =>
      app.inject({
        method: "POST",
        url: "/api/admin/import/confluence/apply",
        headers,
        payload: { criteria: {}, includeIds: ["p1"] },
      });
    const first = (await apply()).json() as { imported: number; alreadyQueued: number };
    expect(first).toMatchObject({ imported: 1, alreadyQueued: 0 });
    // Der Retry findet den offenen Kandidaten idempotent vor — EHRLICH nicht noch mal „importiert".
    const second = (await apply()).json() as { imported: number; alreadyQueued: number };
    expect(second).toMatchObject({ imported: 0, alreadyQueued: 1 });
  });

  it("EIN Snapshot je Lauf: alle Batches nutzen die Datenbasis der Gruppierung (kein zweiter Scan); unbekannter Token → 409", async () => {
    const items = [
      item({ title: "Pumpe warten", externalId: "p1" }),
      item({ title: "Ventil tauschen", externalId: "p2" }),
      item({ title: "Fehlercode E5", externalId: "p3" }),
    ];
    let scans = 0;
    const adapter = {
      source: "Confluence",
      collect: async () => items,
      collectAll: async () => {
        scans += 1;
        return { items, failed: [], truncated: false };
      },
    } as unknown as ConfluenceSourceAdapter;
    const { app, headers } = await importApp(items, { adapter });
    const grouped = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/group",
      headers,
      payload: { criteria: {}, locale: "de" },
    });
    expect(grouped.statusCode).toBe(200);
    const token = (grouped.json() as { snapshotToken: number }).snapshotToken;
    expect(typeof token).toBe("number");
    expect(scans).toBe(1);
    // Zwei Batches desselben Laufs — beide werden aus dem FESTGEHALTENEN Snapshot bedient.
    const batchResponses: { imported: number; notFound: string[] }[] = [];
    for (const batch of [
      ["p1", "p2"],
      ["p3", "gibt-es-nicht"],
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence/apply",
        headers,
        payload: { criteria: {}, includeIds: batch, snapshotToken: token },
      });
      expect(res.statusCode).toBe(200);
      batchResponses.push(res.json() as { imported: number; notFound: string[] });
    }
    expect(scans).toBe(1); // kein einziger weiterer Quell-Scan für den Apply-Lauf
    expect(batchResponses[0]).toMatchObject({ imported: 2, notFound: [] });
    // notFound bleibt ehrlich (die unbekannte Id) — und ein UNBEKANNTER/abgelaufener Token wird
    // ehrlich abgelehnt statt still neu zu scannen.
    expect(batchResponses[1]).toMatchObject({ imported: 1, notFound: ["gibt-es-nicht"] });
    const expired = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers,
      payload: { criteria: {}, includeIds: ["p1"], snapshotToken: 99_999 },
    });
    expect(expired.statusCode).toBe(409);
    expect((expired.json() as { error: string }).error).toBe("SNAPSHOT_EXPIRED");
    expect(scans).toBe(1);
  });
});
