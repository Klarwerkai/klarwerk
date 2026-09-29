// ================================================================================================
// LAUF 3 · RUNDE 2 — BENS BEFUNDE B2 BIS B6 UND B8, JE ALS NEGATIVFALL NACH SEINER GEGENPROBE.
// ================================================================================================
//
//   B2  201 vorhandene Anhänge: der Deckel der Eingangssäuberung macht die Liste UNVOLLSTÄNDIG,
//       statt a201 als in der Quelle entfernt zu behandeln.
//   B3  Ein Anhangseintrag ohne Titel wird verworfen — die Liste gilt dann nicht als vollständig.
//   B4  Bei gleicher Seitenfassung erreicht eine geänderte Abrufadresse die Angleichung.
//   B5  Bei gleicher Seitenfassung wird eine geänderte Leserestriktion nachgezogen; eine strengere
//       Quelle setzt die Vertraulichkeit herauf, eine offenere setzt sie NICHT automatisch herab.
//   B6  Die Ablage kürzt Listen, nie Zahlen; die Kürzung ist ausgewiesen.
//   B8  Ein gescheiterter Anhangsnachzug macht den Lauf PARTIAL mit SOURCE_SYNC_INCOMPLETE.
//
// B1 (Durchsetzung der Quellrechte) und B7 (abgeleitete Einheiten, Lücken) sind NICHT gebaut —
// Begründung in docs/bestandsaufnahme-confluence-import.md, Abschnitt „Lauf 3 · Runde 2“.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import { makeGuards } from "../../services/app/src/http";
import {
  MAX_SOURCE_SYNC_IDS,
  sourceSyncSnapshot,
} from "../../services/app/src/quellabgleich-ablage";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import { importRunRoutes } from "../../services/app/src/routes/import-run-routes";
import { adapterFromConfig } from "../../services/confluence/src/adapter";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

const BASIS = "https://acme.atlassian.net/wiki";

const anhang = (id: string, download = `/download/${id}.png`) => ({
  id,
  title: `${id}.png`,
  extensions: { mediaType: "image/png", fileSize: 10 },
  _links: { download },
});

function seite(
  id: string,
  version: number,
  anhaenge?: unknown,
  gruppen: string[] = [],
): ConfluencePage {
  return {
    id,
    title: `Seite ${id}`,
    body: { storage: { value: `<p>Inhalt ${id}.</p>` } },
    version: { number: version },
    _links: { webui: `/spaces/K/pages/${id}` },
    restrictions: {
      read: {
        restrictions: {
          user: { results: [] },
          group: { results: gruppen.map((name) => ({ name })) },
        },
      },
    },
    ...(anhaenge === undefined
      ? {}
      : { children: { attachment: anhaenge as { results: never[] } } }),
  } as ConfluencePage;
}

function quelle() {
  const bereich = new Map<string, ConfluencePage>();
  const antwort = (status: number, body: unknown) =>
    ({ ok: status < 300, status, json: async () => body }) as Response;
  const fetchFn = (async (u: string) => {
    const url = new URL(String(u));
    if (/\/child\/attachment$/.test(url.pathname)) {
      return antwort(200, { results: [] });
    }
    const id = /\/rest\/api\/content\/([^/?]+)$/.exec(url.pathname)?.[1];
    if (id) {
      const s = bereich.get(decodeURIComponent(id));
      return s ? antwort(200, s) : antwort(404, {});
    }
    return antwort(200, { results: [...bereich.values()] });
  }) as unknown as typeof fetch;
  const config = { baseUrl: BASIS, email: "svc@acme.example", apiToken: "tok", spaceKey: "K" };
  return { adapter: adapterFromConfig({ ...config, fetchFn }), bereich };
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

const viele = (n: number) => Array.from({ length: n }, (_, i) => anhang(`a${i + 1}`));

describe("B2 · der lokale Deckel entfernt keinen vorhandenen Anhang", () => {
  it("Fassung 2 mit a1…a201: a201 bleibt am Objekt, die Liste ist als unvollständig markiert", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-1", seite("P-1", 1, { results: [anhang("a201")] }));
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-1")).anhangsIds).toEqual(["a201"]);

    q.bereich.set("P-1", seite("P-1", 2, { results: viele(201) }));
    await runConfluenceImport({ ...d, adapter: q.adapter, dryRun: false, actor: "admin" });
    const [kandidat] = (await d.library.listImportCandidates()).filter((k) => k.status === "neu");
    await d.library.reviewImportCandidate(kandidat?.id ?? "", "accept", "admin");
    const nachher = await objekt(d, "P-1");
    expect(nachher.anhangsIds).toContain("a201");
    expect(nachher.anhangsIds).toHaveLength(201);
    const gespeichert = (await d.library.listImportCandidates()).find((k) => k.id === kandidat?.id);
    expect(
      (gespeichert?.item as { sourceAttachmentsIncomplete?: boolean }).sourceAttachmentsIncomplete,
    ).toBe(true);
  });
});

describe("B3 · ein Anhangseintrag ohne Titel macht die Liste unvollständig", () => {
  it("results=[{id:'a201'}]: das Item trägt die Marke, a201 bleibt am Objekt", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-1", seite("P-1", 1, { results: [anhang("a201")] }));
    await laufUndAnnehmen(q, d);

    q.bereich.set("P-1", seite("P-1", 2, { results: [{ id: "a201" }] }));
    const item = await q.adapter.fetchItem("P-1");
    expect(item?.sourceAttachments ?? []).toEqual([]);
    expect(item?.sourceAttachmentsIncomplete).toBe(true);
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-1")).anhangsIds).toEqual(["a201"]);
  });
});

describe("B4 · eine geänderte Abrufadresse bei gleicher Seitenfassung wird übernommen", () => {
  it("/download/a201.png → /download/a201-neu.png steht danach am Objekt", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-1", seite("P-1", 1, { results: [anhang("a201")] }));
    await laufUndAnnehmen(q, d);

    q.bereich.set("P-1", seite("P-1", 1, { results: [anhang("a201", "/download/a201-neu.png")] }));
    const summary = await laufUndAnnehmen(q, d);
    expect(summary.sourceSync?.attachmentsUpdated.map((a) => a.externalId)).toEqual(["P-1"]);
    expect((await objekt(d, "P-1")).anhaenge.map((s) => s.url)).toEqual([
      `${BASIS}/download/a201-neu.png`,
    ]);
    // Ein zweiter Lauf mit derselben Adresse findet nichts mehr anzugleichen.
    expect((await laufUndAnnehmen(q, d)).sourceSync?.attachmentsUpdated).toEqual([]);
  });
});

describe("B5 · eine geänderte Leserestriktion bei gleicher Seitenfassung wird nachgezogen", () => {
  it("offen → hr: Anker trägt hr, Vertraulichkeit steigt auf vertraulich; Probelauf schreibt nichts", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-1", seite("P-1", 1));
    await laufUndAnnehmen(q, d);
    const vorher = await objekt(d, "P-1");
    expect(vorher.ko?.confidentiality).toBe("intern");
    expect(vorher.anker?.readRestriction).toBeUndefined();

    q.bereich.set("P-1", seite("P-1", 1, undefined, ["hr"]));
    const probe = await laufUndAnnehmen(q, d, true);
    expect(probe.sourceSync?.restrictionsUpdated).toEqual([
      {
        externalId: "P-1",
        koId: vorher.ko?.id,
        restrictionChanged: true,
        raisedTo: "vertraulich",
        synced: false,
      },
    ]);
    expect((await objekt(d, "P-1")).ko?.confidentiality).toBe("intern");

    const echt = await laufUndAnnehmen(q, d);
    expect(echt.skipped).toBe(1);
    expect(echt.sourceSync?.restrictionsUpdated.map((r) => r.externalId)).toEqual(["P-1"]);
    const nachher = await objekt(d, "P-1");
    expect(nachher.ko?.confidentiality).toBe("vertraulich");
    expect(nachher.anker?.readRestriction).toEqual({ groups: ["hr"], users: [] });
    expect(nachher.ko?.version).toBe(vorher.ko?.version);
    // Idempotent: ein weiterer Lauf ändert nichts mehr.
    expect((await laufUndAnnehmen(q, d)).sourceSync?.restrictionsUpdated).toEqual([]);
  });

  it("hr → offen: die Angabe am Anker entfällt, die Vertraulichkeit bleibt (keine Herabstufung)", async () => {
    const q = quelle();
    const d = dienste();
    q.bereich.set("P-1", seite("P-1", 1, undefined, ["hr"]));
    await laufUndAnnehmen(q, d);
    expect((await objekt(d, "P-1")).ko?.confidentiality).toBe("vertraulich");

    q.bereich.set("P-1", seite("P-1", 1));
    const summary = await laufUndAnnehmen(q, d);
    expect(summary.sourceSync?.restrictionsUpdated).toMatchObject([
      { externalId: "P-1", restrictionChanged: true, raisedTo: null, synced: true },
    ]);
    const nachher = await objekt(d, "P-1");
    expect(nachher.anker?.readRestriction).toBeUndefined();
    expect(nachher.ko?.confidentiality).toBe("vertraulich");
  });
});

describe("B6 · die Ablage kürzt Listen, nie Zahlen", () => {
  it("201 Wiederherstellungen und Anhangsangleichungen: Zahl 201, Liste 200, Kürzung ausgewiesen", () => {
    const ids = Array.from({ length: MAX_SOURCE_SYNC_IDS + 1 }, (_, i) => `P-${i}`);
    const gespeichert = sourceSyncSnapshot({
      checked: true,
      reason: null,
      restored: ids,
      attachmentsUpdated: ids,
      counts: { restored: ids.length, attachmentsUpdated: ids.length },
    });
    expect(gespeichert.restored).toHaveLength(MAX_SOURCE_SYNC_IDS);
    expect(gespeichert.counts.restored).toBe(MAX_SOURCE_SYNC_IDS + 1);
    expect(gespeichert.counts.attachmentsUpdated).toBe(MAX_SOURCE_SYNC_IDS + 1);
    expect(gespeichert.listsTruncated).toBe(true);
    // Und ohne gemeldete Zahl zählt die ungekürzte Eingabe — die Kürzung ist trotzdem sichtbar.
    const ohneZahl = sourceSyncSnapshot({ checked: true, restored: ids });
    expect(ohneZahl.counts.restored).toBe(MAX_SOURCE_SYNC_IDS + 1);
    expect(ohneZahl.listsTruncated).toBe(true);
    // Eine gemeldete Zahl unter der Listenlänge gilt nicht.
    expect(
      sourceSyncSnapshot({ restored: ["P-1", "P-2"], counts: { restored: 1 } }).counts.restored,
    ).toBe(2);
  });
});

const SAVED: Record<string, string | undefined> = {};
const VARS = ["KLARWERK_CONFLUENCE_IMPORT"];
beforeEach(() => {
  for (const k of VARS) {
    SAVED[k] = process.env[k];
  }
});
afterEach(() => {
  for (const k of VARS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

describe("B8 · ein gescheiterter Anhangsnachzug ist am Lauf sichtbar", () => {
  it("Schreibfehler beim Angleichen: PARTIAL, SOURCE_SYNC_INCOMPLETE, syncFailed; a1 bleibt", async () => {
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
      ).json() as {
        status: string;
        failureCode: string | null;
        failureReason: string | null;
        sourceSync: {
          syncFailed: string[];
          attachmentsUpdated: string[];
          counts: { syncFailed: number };
        } | null;
      };
    };

    await lauf();
    for (const k of await services.library.listImportCandidates()) {
      if (k.status === "neu") {
        await services.library.reviewImportCandidate(k.id, "accept", "admin");
      }
    }
    q.bereich.set("P-9", seite("P-9", 1, { results: [anhang("a2")] }));
    let schreibversuche = 0;
    services.ko.replaceSourceAttachments = async () => {
      schreibversuche += 1;
      throw new Error("Speicher nicht erreichbar");
    };
    const zweiter = await lauf();
    expect(schreibversuche).toBe(1);
    expect(zweiter.status).toBe("PARTIAL");
    expect(zweiter.failureCode).toBe("SOURCE_SYNC_INCOMPLETE");
    expect(zweiter.failureReason).toContain("gescheitert");
    expect(zweiter.sourceSync?.syncFailed).toEqual(["P-9"]);
    expect(zweiter.sourceSync?.counts.syncFailed).toBe(1);
    expect(zweiter.sourceSync?.attachmentsUpdated).toEqual([]);
    const ko = (await services.ko.list()).find((k) =>
      k.sources.some((s) => s.externalId === "P-9"),
    );
    expect(
      ko?.sources.filter((s) => s.attachmentOf === "P-9").map((s) => s.attachment?.externalId),
    ).toEqual(["a1"]);
  });
});
