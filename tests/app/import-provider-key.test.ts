// WP-SHIP8-FIX (bens F3, ROT): PROVIDER-SICHERER Import-Schlüssel. Eine Jira-externalId, die
// zufällig einer Confluence-pageId gleicht, ist ein ANDERES Quell-Objekt: (a) die Queue führt
// beide als getrennte offene Kandidaten (provider@externalId@version), (b) das Annehmen des einen
// revidiert NIE das KO des anderen (acceptToKo sucht den Anker nach provider+externalId),
// (c) alreadyQueued/insertIfAbsent-Kollision gibt es NUR bei gleichem Provider.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  InMemoryCandidateRepo,
  LibraryService,
  candidateIdOf,
  candidateSourceId,
  importProviderKey,
  importSourceKey,
} from "../../services/library-analytics";
import type { ImportItem } from "../../services/library-analytics";

function item(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: "Pumpe entlüften",
    statement: "Pumpe alle 200h entlüften.",
    type: "best_practice",
    category: "Wartung",
    author: "anna",
    confidentiality: "intern",
    externalId: "4711",
    sourceVersion: 1,
    provider: "Confluence",
    ...over,
  };
}

function setup() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const candidates = new InMemoryCandidateRepo();
  const library = new LibraryService({ koService, candidates, externalUpsert: true });
  return { koService, candidates, library };
}

describe("WP-SHIP8-FIX F3: importProviderKey (kanonischer Schlüsselteil)", () => {
  it("normalisiert (trim + lowercase); fehlend/leer zählt ehrlich als confluence (Pg-Backfill-Semantik)", () => {
    expect(importProviderKey("Confluence")).toBe("confluence");
    expect(importProviderKey(" Jira ")).toBe("jira");
    expect(importProviderKey(undefined)).toBe("confluence");
    expect(importProviderKey(null)).toBe("confluence");
    expect(importProviderKey("   ")).toBe("confluence");
  });
});

describe("WP-SHIP8-FIX F3: Queue — gleiche externalId bei Confluence UND Jira sind ZWEI Einträge", () => {
  it("beide Provider werden eingereiht; Kollision (alreadyQueued) gibt es nur beim GLEICHEN Provider", async () => {
    const { library } = setup();
    const confluence = await library.createImportCandidates([item()], "tester");
    expect(confluence).toHaveLength(1);
    // Jira mit ZUFÄLLIG gleicher externalId + Version → eigener offener Kandidat, KEINE Dublette.
    const jira = await library.createImportCandidates(
      [item({ provider: "Jira", title: "Issue 4711" })],
      "tester",
    );
    expect(jira).toHaveLength(1);
    expect((await library.listImportCandidates()).length).toBe(2);
    // Derselbe Confluence-Schlüssel erneut → idempotenter No-op (das ist das alreadyQueued-Signal
    // der Apply-Route: createImportCandidates persistiert nichts).
    const again = await library.createImportCandidates([item()], "tester");
    expect(again).toHaveLength(0);
    expect((await library.listImportCandidates()).length).toBe(2);
  });

  it("Batch-Dedupe innerhalb EINES Imports ist ebenfalls provider-scoped", async () => {
    const { library } = setup();
    const created = await library.createImportCandidates(
      [item(), item({ provider: "Jira", title: "Issue 4711" })],
      "tester",
    );
    // Früher: zweites Item als batch-Dublette markiert (gleiche externalId). Jetzt: beide echt.
    expect(created.map((c) => c.duplicate)).toEqual([false, false]);
  });
});

describe("WP-SHIP8-FIX F3: Review/Re-Sync — der eine Provider revidiert NIE das KO des anderen", () => {
  it("Jira-Accept mit gleicher externalId erzeugt ein EIGENES KO; Confluence-Re-Sync trifft nur den Confluence-Anker", async () => {
    const { koService, library } = setup();
    // 1) Confluence-Kandidat annehmen → KO mit Confluence-Anker (externalId 4711, v1).
    const [confCand] = await library.createImportCandidates([item()], "tester");
    const accepted = await library.reviewImportCandidate(
      (confCand as { id: string }).id,
      "accept",
      "reviewer",
    );
    const confluenceKoId = accepted.koId;
    expect(confluenceKoId).not.toBeNull();
    // 2) Jira-Kandidat mit GLEICHER externalId, HÖHERER Version annehmen — früher wäre das ein
    // fälschlicher Re-Sync (revise) des Confluence-KOs gewesen.
    const [jiraCand] = await library.createImportCandidates(
      [
        item({
          provider: "Jira",
          title: "Issue 4711",
          statement: "Jira-Inhalt.",
          sourceVersion: 2,
        }),
      ],
      "tester",
    );
    const jiraAccepted = await library.reviewImportCandidate(
      (jiraCand as { id: string }).id,
      "accept",
      "reviewer",
    );
    expect(jiraAccepted.koId).not.toBeNull();
    expect(jiraAccepted.koId).not.toBe(confluenceKoId);
    // Das Confluence-KO blieb UNBERÜHRT (Version 1, Original-Inhalt, nur der eigene Anker).
    const kos = await koService.list();
    expect(kos).toHaveLength(2);
    const confluenceKo = kos.find((k) => k.id === confluenceKoId);
    expect(confluenceKo?.version).toBe(1);
    expect(confluenceKo?.statement).toBe("Pumpe alle 200h entlüften.");
    expect(confluenceKo?.sources.map((s) => s.provider)).toEqual(["Confluence"]);
    // 3) Gegenprobe: ein ECHTER Confluence-Re-Sync (v2) revidiert weiterhin das Confluence-KO.
    const [resync] = await library.createImportCandidates(
      [item({ sourceVersion: 2, statement: "Aktualisierter Confluence-Inhalt." })],
      "tester",
    );
    const resyncAccepted = await library.reviewImportCandidate(
      (resync as { id: string }).id,
      "accept",
      "reviewer",
    );
    expect(resyncAccepted.koId).toBe(confluenceKoId);
    const after = await koService.list();
    expect(after).toHaveLength(2); // kein drittes KO
    const revised = after.find((k) => k.id === confluenceKoId);
    expect(revised?.version).toBe(2);
    expect(revised?.statement).toBe("Aktualisierter Confluence-Inhalt.");
  });

  it("InMemory-Queue-Schlüssel: gleiche (externalId, Version) kollidiert NUR bei gleichem Provider", async () => {
    const { candidates } = setup();
    const cand = (id: string, over: Partial<ImportItem>) => ({
      id,
      item: item(over),
      status: "neu" as const,
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    expect(await candidates.insertIfAbsent(cand("a", {}))).toBe(true);
    expect(await candidates.insertIfAbsent(cand("b", { provider: "Jira" }))).toBe(true);
    expect(await candidates.insertIfAbsent(cand("c", {}))).toBe(false); // gleicher Provider → Kollision
    expect((await candidates.all()).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

// WP-NIGHT-FIX (bens F3-Rest): der zusammengesetzte Schlüssel und die Kandidaten-Wire-Id kommen
// aus EINEM zentralen Modul — Confluence-Verhalten unverändert (nackte externalId, gepinnt),
// Jira-Kollisionen sind in Status, Gruppierung, Auswahl und Bilanz überall getrennt.
describe("WP-NIGHT-FIX F3-Rest: zentraler Quell-Schlüssel + Kandidaten-Id", () => {
  it("importSourceKey: normalisiert den Provider (trim+lowercase); fehlend zählt als confluence", () => {
    expect(importSourceKey("Confluence", "p1")).toBe("confluence::p1");
    expect(importSourceKey(" JIRA ", "p1")).toBe("jira::p1");
    expect(importSourceKey(null, "p1")).toBe(importSourceKey("Confluence", "p1"));
    expect(importSourceKey("Confluence", "p1")).not.toBe(importSourceKey("Jira", "p1"));
  });

  it("candidateSourceId: Confluence (und Altbestand ohne Provider) bleibt die NACKTE externalId; andere Provider prefixen", () => {
    expect(candidateSourceId("Confluence", "p1")).toBe("p1"); // Bestandsverhalten, gepinnt
    expect(candidateSourceId(undefined, "p1")).toBe("p1"); // Backfill-Semantik
    expect(candidateSourceId("Jira", "p1")).toBe("jira::p1");
    expect(candidateSourceId("Jira", "p1")).not.toBe(candidateSourceId("Confluence", "p1"));
  });

  it("candidateIdOf: provider-scoped über die zentrale Id; ankerlos bleibt row-N", () => {
    const conf: ImportItem = item({});
    const jira: ImportItem = item({ provider: "Jira", title: "Issue 4711" });
    expect(candidateIdOf(conf, 0)).toBe("4711");
    expect(candidateIdOf(jira, 1)).toBe("jira::4711");
    const { externalId: _x, ...noAnchor } = item({});
    expect(candidateIdOf(noAnchor as ImportItem, 2)).toBe("row-3");
  });

  it("Gruppierung/Auswahl/Bilanz: gleiche externalId Confluence×Jira → GETRENNTE Kandidaten-Ids, beide übernehmbar", async () => {
    const items: ImportItem[] = [
      item({ title: "Confluence-Seite 4711", confidentiality: "intern", tags: ["wartung"] }),
      item({
        title: "Jira-Issue 4711",
        provider: "Jira",
        confidentiality: "intern",
        tags: ["wartung"],
      }),
    ];
    const adapter = {
      source: "Confluence",
      collect: async () => items,
      collectAll: async () => ({ items, failed: [], truncated: false }),
    } as unknown as ConfluenceSourceAdapter;
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const services = buildServices();
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const app = buildApp(services);
    app.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards: makeGuards(services.auth),
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
    const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };

    const grouped = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/group",
      headers,
      payload: { criteria: {}, locale: "de" },
    });
    expect(grouped.statusCode).toBe(200);
    const body = grouped.json() as {
      candidates: { id: string }[];
      groups: { ids: string[] }[];
      snapshotToken: number;
    };
    // GETRENNTE Kandidaten-Ids (keine Dedupe-Verschmelzung, eindeutige React-Keys) …
    expect(body.candidates.map((c) => c.id).sort()).toEqual(["4711", "jira::4711"]);
    // … auch im deterministischen Fallback-Clustering tauchen BEIDE genau einmal auf.
    const flat = body.groups.flatMap((g) => g.ids).sort();
    expect(flat).toEqual(["4711", "jira::4711"]);

    // Bilanz: BEIDE Ids sind übernehmbar — zwei getrennte Queue-Einträge (provider-scoped).
    const applied = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers,
      payload: {
        criteria: {},
        includeIds: ["4711", "jira::4711"],
        snapshotToken: body.snapshotToken,
      },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json()).toMatchObject({ imported: 2, alreadyQueued: 0, notFound: [] });
    const queue = await services.library.listImportCandidates();
    expect(queue.map((c) => `${c.item.provider}:${c.item.externalId}`).sort()).toEqual([
      "Confluence:4711",
      "Jira:4711",
    ]);
  });
});
