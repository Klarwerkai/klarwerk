import type { Pool } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryCandidateRepo } from "./repo";
import { PgCandidateRepo } from "./repo-pg";
import { LibraryService } from "./service";
import type { ImportItem } from "./types";

function confItem(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: "Pumpe entlüften",
    statement: "Pumpe alle 200h entlüften.",
    type: "best_practice",
    category: "Wartung",
    author: "anna",
    pageId: "P1",
    spaceKey: "WART",
    sourceVersion: 1,
    provider: "Confluence",
    ...over,
  };
}

async function setup() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.create({
    title: "Ventil schließen",
    statement: "Bei Überdruck Ventil X schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
    tags: ["druck", "ventil"],
  });
  await koService.create({
    title: "Pumpe schmieren",
    statement: "Pumpe alle 200h schmieren.",
    type: "technik",
    category: "Anlage 2",
    author: "bob",
    tags: ["wartung", "ventil"],
  });
  // Der Confluence-Import-Strang (pageId-Dedup/-Upsert) wird für diese Suite aktiviert — sie testet
  // genau dieses Verhalten. Der Flag-AUS-Fall (Bestandsverhalten) hat einen eigenen Test unten.
  return { koService, library: new LibraryService({ koService, confluenceImport: true }) };
}

// SCRUM-506: der Export ist Validiert-only — Test-KOs vor Export-Assertions auf „validiert" heben.
async function validateAll(koService: KoService): Promise<void> {
  for (const ko of await koService.list()) {
    await koService.setValidationState(ko.id, { trust: 80, status: "validiert" });
  }
}

describe("LibraryService", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("FR-LIB-01: Suche findet KO über Text", async () => {
    const hits = await ctx.library.search("überdruck");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe("Ventil schließen");
  });

  it("FR-LIB-02: Export als JSON und MediaWiki", async () => {
    await validateAll(ctx.koService); // SCRUM-506: Export = validiert-only
    const json = await ctx.library.exportJson();
    expect(json).toHaveLength(2);
    const wiki = await ctx.library.exportMediaWiki();
    expect(wiki).toContain("== Ventil schließen ==");
    const html = await ctx.library.exportHtml();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<h2>Ventil schließen</h2>");
  });

  // SCRUM-506: der Export durchsetzt Validiert-only + Vertraulichkeit (Egress-Grenze).
  it("Export enthält KEINE nicht-validierten KOs (regulärer Export = validiert)", async () => {
    await validateAll(ctx.koService); // die zwei Seed-KOs sind validiert …
    // … ein frisches, NICHT validiertes KO (Status „offen") darf im Export nicht auftauchen.
    await ctx.koService.create({
      title: "Roher Entwurf",
      statement: "Noch nicht geprüft.",
      type: "best_practice",
      category: "Anlage 3",
      author: "carla",
      tags: [],
    });
    const json = await ctx.library.exportJson();
    expect(json).toHaveLength(2); // weiterhin nur die zwei validierten
    expect(json.some((ko) => ko.title === "Roher Entwurf")).toBe(false);
  });

  it("Export lässt vertrauliche KOs weg — außer includeConfidential (Berechtigte)", async () => {
    await validateAll(ctx.koService); // die zwei Seed-KOs (nicht vertraulich) sind validiert
    const created = await ctx.koService.create({
      title: "Geheime Prozedur",
      statement: "Vertraulicher Kerntext.",
      type: "best_practice",
      category: "Anlage 3",
      author: "carla",
      tags: [],
    });
    await ctx.koService.setValidationState(created.id, { trust: 80, status: "validiert" });
    await ctx.koService.setConfidentiality(created.id, "vertraulich", "carla");

    // Standard (viewer/experte): validiert, aber NICHT vertraulich.
    const forEveryone = await ctx.library.exportJson();
    expect(forEveryone.some((ko) => ko.title === "Geheime Prozedur")).toBe(false);
    expect(forEveryone).toHaveLength(2);

    // Berechtigt (Controller/Admin): vertrauliche validierte KOs inklusive.
    const forAuthorized = await ctx.library.exportJson({ includeConfidential: true });
    expect(forAuthorized.some((ko) => ko.title === "Geheime Prozedur")).toBe(true);
    expect(forAuthorized).toHaveLength(3);
    // Aber selbst Berechtigte bekommen keine nicht-validierten (Validiert-only bleibt).
    expect(forAuthorized.every((ko) => ko.status === "validiert")).toBe(true);
  });

  it("SCRUM-116: Re-Import erzeugt Review-Kandidaten, markiert Dubletten", async () => {
    const cands = await ctx.library.createImportCandidates([
      { title: "Neu A", statement: "Frischer Inhalt.", type: "technik", category: "X" },
      {
        title: "Ventil schließen",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    ]);
    expect(cands).toHaveLength(2);
    expect(cands[0]?.duplicate).toBe(false);
    expect(cands[1]?.duplicate).toBe(true); // existiert bereits
    expect((await ctx.library.listImportCandidates()).every((c) => c.status === "neu")).toBe(true);
  });

  it("SCRUM-116: annehmen erzeugt KO (Nicht-Dublette), Dublette wird nicht überschrieben", async () => {
    const before = (await ctx.koService.list()).length;
    const [fresh, dup] = await ctx.library.createImportCandidates([
      { title: "Neu B", statement: "Inhalt B.", type: "technik", category: "X" },
      {
        title: "Pumpe schmieren",
        statement: "Pumpe alle 200h schmieren.",
        type: "technik",
        category: "Anlage 2",
      },
    ]);
    if (!fresh || !dup) {
      throw new Error("Kandidaten fehlen.");
    }
    const acceptedFresh = await ctx.library.reviewImportCandidate(fresh.id, "accept", "controller");
    expect(acceptedFresh.status).toBe("angenommen");
    expect(acceptedFresh.koId).not.toBeNull();
    expect((await ctx.koService.list()).length).toBe(before + 1);

    const acceptedDup = await ctx.library.reviewImportCandidate(dup.id, "accept", "controller");
    expect(acceptedDup.status).toBe("angenommen");
    expect(acceptedDup.koId).toBeNull(); // Dublette → übersprungen, kein neues KO
    expect((await ctx.koService.list()).length).toBe(before + 1);
  });

  it("SCRUM-116: ablehnen/Info anfordern + kein Doppel-Review", async () => {
    const [c] = await ctx.library.createImportCandidates([
      { title: "Neu C", statement: "Inhalt C.", type: "technik", category: "X" },
    ]);
    if (!c) {
      throw new Error("Kandidat fehlt.");
    }
    const info = await ctx.library.reviewImportCandidate(c.id, "info", "controller", "Quelle?");
    expect(info.status).toBe("info-angefragt");
    expect(info.note).toBe("Quelle?");
    await expect(
      ctx.library.reviewImportCandidate(c.id, "reject", "controller"),
    ).rejects.toMatchObject({
      code: "ALREADY_REVIEWED",
    });
  });

  it("FR-LIB-02: Export als Text-Markdown", async () => {
    await validateAll(ctx.koService); // SCRUM-506: Export = validiert-only
    const md = await ctx.library.exportMarkdown();
    expect(md).toContain("# Ventil schließen");
    // Trennlinie zwischen Objekten + Herkunfts-Fußzeile.
    expect(md).toContain("\n---\n");
    expect(md).toMatch(/_.*Trust \d+.*Autor:/);
  });

  it("FR-LIB-02: Import ohne Duplikate", async () => {
    const items = [
      {
        title: "Ventil schließen",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice" as const,
        category: "Anlage 1",
      }, // Duplikat
      {
        title: "Neues Wissen",
        statement: "Etwas Neues.",
        type: "lernkurve" as const,
        category: "Anlage 3",
      },
    ];
    const result = await ctx.library.importJson(items);
    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(await ctx.koService.list()).toHaveLength(3);
  });

  // SCRUM-509 R3: Import ist ein Bulk-Pfad → konservativ. Fehlt die Stufe, gilt „vertraulich"
  // (NICHT still intern) — importierter Fremdinhalt bleibt aus Cloud/Export heraus, bis freigegeben.
  it("SCRUM-509 R3: JSON-Import ohne Stufe → vertraulich (nicht intern)", async () => {
    await ctx.library.importJson([
      { title: "Fremd", statement: "Importiert.", type: "best_practice", category: "Anlage 9" },
    ]);
    const imported = (await ctx.koService.list()).find((k) => k.title === "Fremd");
    expect(imported?.confidentiality).toBe("vertraulich");
  });

  it("SCRUM-509 R3: Confluence-Accept ohne Stufe → vertraulich", async () => {
    const [cand] = await ctx.library.createImportCandidates([confItem({ pageId: "PX" })]);
    await ctx.library.reviewImportCandidate(cand!.id, "accept", "controller");
    const imported = (await ctx.koService.list()).find((k) =>
      (k.sources ?? []).some((s) => s.externalId === "PX"),
    );
    expect(imported?.confidentiality).toBe("vertraulich");
  });

  it("SCRUM-470: pageId-Dedup nur innerhalb des Imports (zwei gleiche pageId → eine Dublette)", async () => {
    const cands = await ctx.library.createImportCandidates([
      confItem({ pageId: "P1" }),
      confItem({ pageId: "P1", title: "Pumpe (Kopie)" }),
      confItem({ pageId: "P2", title: "Ventil" }),
    ]);
    expect(cands.map((c) => c.duplicate)).toEqual([false, true, false]);
  });

  it("SCRUM-470: Accept einer pageId legt KO mit Herkunfts-Anker an", async () => {
    const [cand] = await ctx.library.createImportCandidates([
      confItem({ pageId: "P9", sourceVersion: 2 }),
    ]);
    const res = await ctx.library.reviewImportCandidate(cand!.id, "accept");
    const ko = (await ctx.koService.list()).find((k) => k.id === res.koId)!;
    expect(ko.sources[0]?.externalId).toBe("P9");
    expect(ko.sources[0]?.sourceVersion).toBe(2);
    expect(ko.sources[0]?.provider).toBe("Confluence");
    expect(ko.sources[0]?.peerValidated).toBe(false);
  });

  it("SCRUM-470: Re-Sync gleicher pageId mit höherer Version → Update (revise), keine Dublette", async () => {
    const [c1] = await ctx.library.createImportCandidates([
      confItem({ pageId: "P5", sourceVersion: 1, statement: "Alte Anleitung." }),
    ]);
    const r1 = await ctx.library.reviewImportCandidate(c1!.id, "accept");
    const [c2] = await ctx.library.createImportCandidates([
      confItem({ pageId: "P5", sourceVersion: 2, statement: "Neu entlüften." }),
    ]);
    const r2 = await ctx.library.reviewImportCandidate(c2!.id, "accept");

    expect(r2.koId).toBe(r1.koId); // dasselbe KO
    const withAnchor = (await ctx.koService.list()).filter((k) =>
      k.sources.some((s) => s.externalId === "P5"),
    );
    expect(withAnchor).toHaveLength(1); // keine Dublette
    const ko = withAnchor[0]!;
    expect(ko.version).toBe(2); // revidiert
    expect(ko.statement).toBe("Neu entlüften.");
    expect(ko.sources.find((s) => s.externalId === "P5")?.sourceVersion).toBe(2);
  });

  it("SCRUM-470: Re-Sync mit gleicher/niedrigerer Version → No-op (idempotent)", async () => {
    const [c1] = await ctx.library.createImportCandidates([
      confItem({ pageId: "P7", sourceVersion: 3, statement: "Stand V3." }),
    ]);
    const r1 = await ctx.library.reviewImportCandidate(c1!.id, "accept");
    const [c2] = await ctx.library.createImportCandidates([
      confItem({ pageId: "P7", sourceVersion: 3, statement: "nochmal V3." }),
    ]);
    const r2 = await ctx.library.reviewImportCandidate(c2!.id, "accept");

    expect(r2.koId).toBe(r1.koId);
    const ko = (await ctx.koService.list()).find((k) => k.id === r1.koId)!;
    expect(ko.version).toBe(1); // NICHT revidiert
    expect(ko.statement).toBe("Stand V3."); // unverändert
  });

  it("SCRUM-470 (ben #3): Re-Sync OHNE Version bleibt idempotent (kein Dublett, kein Endlos-Revise)", async () => {
    // Item ohne sourceVersion (confItem setzt sonst 1) — der Kern des Befunds.
    const { sourceVersion: _v1, ...noVer1 } = confItem({ pageId: "PNV", statement: "Erststand." });
    const [c1] = await ctx.library.createImportCandidates([noVer1]);
    const r1 = await ctx.library.reviewImportCandidate(c1!.id, "accept");
    const ko1 = (await ctx.koService.list()).find((k) => k.id === r1.koId)!;
    // Effektive Version wird IMMER gespeichert (nie ein versionsloser Anker im Bestand).
    expect(ko1.sources.find((s) => s.externalId === "PNV")?.sourceVersion).toBe(1);
    expect(ko1.version).toBe(1);

    // Zweiter Accept derselben pageId, wieder OHNE Version → selbes KO, KEINE Revision (No-op).
    const { sourceVersion: _v2, ...noVer2 } = confItem({ pageId: "PNV", statement: "nochmal." });
    const [c2] = await ctx.library.createImportCandidates([noVer2]);
    const r2 = await ctx.library.reviewImportCandidate(c2!.id, "accept");
    expect(r2.koId).toBe(r1.koId);
    const withAnchor = (await ctx.koService.list()).filter((k) =>
      k.sources.some((s) => s.externalId === "PNV"),
    );
    expect(withAnchor).toHaveLength(1); // kein Dublett
    const ko2 = withAnchor[0]!;
    expect(ko2.version).toBe(1); // NICHT revidiert → idempotent
    expect(ko2.statement).toBe("Erststand."); // kein Downgrade auf „nochmal."
    expect(ko2.sources.find((s) => s.externalId === "PNV")?.sourceVersion).toBe(1); // kein Bump
  });

  // SCRUM-509 R4: Import-Vertrag auch beim Re-Sync vollständig — nur Anheben, explizit höhere Stufe
  // respektiert, kein Downgrade. Gleiche fail-safe-Klassifikation wie der Create-Import (R3).
  it("SCRUM-509 R4: Re-Sync eines internen KO mit neuem externem Inhalt → mind. vertraulich (nur Anheben)", async () => {
    const [c1] = await ctx.library.createImportCandidates([
      confItem({
        pageId: "R4a",
        sourceVersion: 1,
        statement: "Stand 1.",
        confidentiality: "intern",
      }),
    ]);
    const r1 = await ctx.library.reviewImportCandidate(c1!.id, "accept");
    const ko1 = (await ctx.koService.list()).find((k) => k.id === r1.koId)!;
    // „intern" wird als Default NICHT persistiert (Feld bleibt undefined) — effektive Stufe = intern.
    expect(ko1.confidentiality ?? "intern").toBe("intern");

    // Re-Sync mit NEUEM externem Inhalt, OHNE explizite Stufe → konservativer Boden „vertraulich" hebt an.
    const [c2] = await ctx.library.createImportCandidates([
      confItem({ pageId: "R4a", sourceVersion: 2, statement: "Neuer externer Stand." }),
    ]);
    const r2 = await ctx.library.reviewImportCandidate(c2!.id, "accept");
    expect(r2.koId).toBe(r1.koId);
    const ko2 = (await ctx.koService.list()).find((k) => k.id === r1.koId)!;
    expect(ko2.confidentiality).toBe("vertraulich"); // angehoben, NIE still intern gelassen
    expect(ko2.statement).toBe("Neuer externer Stand.");
  });

  it("SCRUM-509 R4: explizit höhere Importstufe beim Re-Sync wird respektiert (nie ignoriert)", async () => {
    const [c1] = await ctx.library.createImportCandidates([
      confItem({ pageId: "R4b", sourceVersion: 1, confidentiality: "intern" }),
    ]);
    const r1 = await ctx.library.reviewImportCandidate(c1!.id, "accept");
    const [c2] = await ctx.library.createImportCandidates([
      confItem({
        pageId: "R4b",
        sourceVersion: 2,
        confidentiality: "streng_vertraulich",
        statement: "Sensibler Stand.",
      }),
    ]);
    const r2 = await ctx.library.reviewImportCandidate(c2!.id, "accept");
    expect(r2.koId).toBe(r1.koId);
    const ko = (await ctx.koService.list()).find((k) => k.id === r1.koId)!;
    expect(ko.confidentiality).toBe("streng_vertraulich"); // explizite Höherstufung respektiert
  });

  it("SCRUM-509 R4: Re-Sync kann NICHT herabstufen (explizit niedrigere Stufe wird nicht angewandt)", async () => {
    const [c1] = await ctx.library.createImportCandidates([
      confItem({ pageId: "R4c", sourceVersion: 1, confidentiality: "streng_vertraulich" }),
    ]);
    const r1 = await ctx.library.reviewImportCandidate(c1!.id, "accept");
    const ko1 = (await ctx.koService.list()).find((k) => k.id === r1.koId)!;
    expect(ko1.confidentiality).toBe("streng_vertraulich");

    // Re-Sync mit explizit „intern" (Downgrade-Versuch) + neuem Inhalt (V2 > V1): Inhalt aktualisiert,
    // Stufe bleibt streng_vertraulich — kein Downgrade über Re-Sync.
    const [c2] = await ctx.library.createImportCandidates([
      confItem({
        pageId: "R4c",
        sourceVersion: 2,
        confidentiality: "intern",
        statement: "angeblich harmlos.",
      }),
    ]);
    const r2 = await ctx.library.reviewImportCandidate(c2!.id, "accept");
    expect(r2.koId).toBe(r1.koId);
    const ko2 = (await ctx.koService.list()).find((k) => k.id === r1.koId)!;
    expect(ko2.confidentiality).toBe("streng_vertraulich"); // kein Downgrade über Re-Sync
    expect(ko2.statement).toBe("angeblich harmlos."); // Inhalt aktualisiert (V2 > V1), Stufe NICHT
  });

  it("SCRUM-470 (ben #7): Flag AUS → kein pageId-Pfad (kein pageId-Dedup, kein Upsert, kein Anker)", async () => {
    // Eigener Service mit AUSGESCHALTETEM Strang = heutiges Bestandsverhalten.
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, confluenceImport: false });

    // Zwei Items mit GLEICHER pageId, aber unterschiedlichem title|statement. Bei Flag AN wäre das
    // zweite eine (intra-Batch) pageId-Dublette — bei Flag AUS greift NUR title|statement (→ keine Dublette).
    const cands = await library.createImportCandidates([
      confItem({ pageId: "PX", title: "A", statement: "Aussage A." }),
      confItem({ pageId: "PX", title: "B", statement: "Aussage B." }),
    ]);
    expect(cands.map((c) => c.duplicate)).toEqual([false, false]); // pageId-Dedup greift NICHT

    // Accept legt ein KO OHNE Herkunfts-Anker an (kein pageId-Upsert).
    const r = await library.reviewImportCandidate(cands[0]!.id, "accept");
    const ko = (await koService.list()).find((k) => k.id === r.koId)!;
    expect(ko.sources).toEqual([]);

    // Re-Accept desselben pageId-Items → NEUES KO (kein Upsert/Re-Sync), da pageId ignoriert wird.
    const [again] = await library.createImportCandidates([
      confItem({ pageId: "PX", title: "C", statement: "Aussage C." }),
    ]);
    const r2 = await library.reviewImportCandidate(again!.id, "accept");
    expect(r2.koId).not.toBe(r.koId);
  });

  it("FR-LIB-03: Bus-Faktor erkennt Einzelquellen", async () => {
    const bf = await ctx.library.busFactor();
    const a1 = bf.find((e) => e.category === "Anlage 1");
    expect(a1?.singleSource).toBe(true);
    expect(a1?.authorCount).toBe(1);
  });

  it("Consultant Experten-Matching: Thema → Personen (originalAuthor), alphabetisch statt nach Menge", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    // Kategorie "Dach": zoe mit 2 Beiträgen, anna mit 1 — nach Menge käme zoe zuerst.
    await koService.create({
      title: "z1",
      statement: "s",
      type: "best_practice",
      category: "Dach",
      author: "zoe",
      tags: [],
    });
    await koService.create({
      title: "z2",
      statement: "s",
      type: "best_practice",
      category: "Dach",
      author: "zoe",
      tags: [],
    });
    await koService.create({
      title: "a1",
      statement: "s",
      type: "best_practice",
      category: "Dach",
      author: "anna",
      tags: [],
    });
    await koService.create({
      title: "c1",
      statement: "s",
      type: "best_practice",
      category: "Keller",
      author: "cora",
      tags: [],
    });
    const library = new LibraryService({ koService });

    const ex = await library.expertise();
    const dach = ex.find((e) => e.category === "Dach");
    // Alphabetisch (anna < zoe), NICHT nach koCount — sonst wäre zoe (2) vorn. Beweist: keine Rangliste.
    expect(dach?.contributors).toEqual([
      { authorId: "anna", koCount: 1 },
      { authorId: "zoe", koCount: 2 },
    ]);
    const keller = ex.find((e) => e.category === "Keller");
    expect(keller?.contributors).toEqual([{ authorId: "cora", koCount: 1 }]);
  });

  it("FR-LIB-04: Graph verbindet KOs mit gemeinsamem Tag", async () => {
    const graph = await ctx.library.graph();
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.via).toBe("ventil");
  });

  it("FR-ANA-01: Analytics aggregiert nach Status/Art/Kategorie", async () => {
    const a = await ctx.library.analytics();
    expect(a.total).toBe(2);
    expect(a.byStatus.offen).toBe(2);
    expect(a.byType.best_practice).toBe(1);
    expect(a.byCategory["Anlage 1"]).toBe(1);
  });
});

describe("LibraryService — Audit (FR-AUD-01)", () => {
  it("protokolliert den Import", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, audit });
    await library.importJson(
      [{ title: "X", statement: "Y", type: "lernkurve", category: "A" }],
      "importer",
    );
    const entries = await audit.list({ action: "library.import" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actor).toBe("importer");
  });
});

// SCRUM-157: Fake-Pool, der die import_candidates-Tabelle nachbildet (INSERT/UPDATE/SELECT).
function fakePool() {
  const rows = new Map<string, string>(); // id → JSON-String (wie pg jsonb)
  return {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO import_candidates")) {
        const [id, data] = params as [string, string];
        rows.set(id, data);
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE import_candidates")) {
        const [id, data] = params as [string, string];
        rows.set(id, data);
        return { rows: [] };
      }
      if (sql.startsWith("SELECT data FROM import_candidates WHERE id=")) {
        const [id] = params as [string];
        const data = rows.get(id);
        return { rows: data ? [{ data: JSON.parse(data) }] : [] };
      }
      if (sql.startsWith("SELECT data FROM import_candidates ORDER BY")) {
        return { rows: [...rows.values()].map((d) => ({ data: JSON.parse(d) })) };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
}

describe("SCRUM-157: Import-Kandidaten persistent (CandidateRepo)", () => {
  async function koCtx() {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.create({
      title: "Bestehend",
      statement: "Schon da.",
      type: "best_practice",
      category: "A",
      author: "anna",
    });
    return koService;
  }

  it("Kandidaten überleben eine neue Service-Instanz am selben Repo (In-Memory)", async () => {
    const koService = await koCtx();
    const repo = new InMemoryCandidateRepo();
    const lib1 = new LibraryService({ koService, candidates: repo });
    const [created] = await lib1.createImportCandidates([
      { title: "Neu", statement: "Frisch.", type: "lernkurve", category: "B" },
    ]);

    // Frische Service-Instanz über DASSELBE Repo → Queue ist noch da.
    const lib2 = new LibraryService({ koService, candidates: repo });
    const listed = await lib2.listImportCandidates();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created?.id);
    expect(listed[0]?.status).toBe("neu");
  });

  it("Review-Status + koId/Note/Duplicate/createdAt bleiben nach Persistenz erhalten", async () => {
    const koService = await koCtx();
    const repo = new InMemoryCandidateRepo();
    const lib1 = new LibraryService({ koService, candidates: repo });
    const [fresh, dup, info] = await lib1.createImportCandidates([
      { title: "Frisch", statement: "Inhalt A.", type: "lernkurve", category: "B" },
      { title: "Bestehend", statement: "Schon da.", type: "best_practice", category: "A" }, // Dublette
      { title: "Unklar", statement: "Inhalt C.", type: "technik", category: "C" },
    ]);
    await lib1.reviewImportCandidate(fresh?.id ?? "", "accept", "controller");
    await lib1.reviewImportCandidate(dup?.id ?? "", "accept", "controller");
    await lib1.reviewImportCandidate(info?.id ?? "", "info", "controller", "Quelle?");

    // Neue Instanz am selben Repo: alle Review-Stände persistent.
    const lib2 = new LibraryService({ koService, candidates: repo });
    const byId = new Map((await lib2.listImportCandidates()).map((c) => [c.id, c]));
    const freshC = byId.get(fresh?.id ?? "");
    const dupC = byId.get(dup?.id ?? "");
    const infoC = byId.get(info?.id ?? "");
    expect(freshC?.status).toBe("angenommen");
    expect(freshC?.koId).toBeTruthy(); // nicht-Dublette → echtes KO erzeugt
    expect(dupC?.status).toBe("angenommen");
    expect(dupC?.duplicate).toBe(true);
    expect(dupC?.koId).toBeNull(); // Dublette → kein KO
    expect(infoC?.status).toBe("info-angefragt");
    expect(infoC?.note).toBe("Quelle?");
    expect(freshC?.createdAt).toBe(fresh?.createdAt);
  });

  it("PgCandidateRepo: round-trip über denselben Fake-Pool (insert/update/all)", async () => {
    const koService = await koCtx();
    const pool = fakePool();
    const lib1 = new LibraryService({ koService, candidates: new PgCandidateRepo(pool) });
    const [c] = await lib1.createImportCandidates([
      { title: "PG", statement: "Inhalt.", type: "lernkurve", category: "B" },
    ]);
    await lib1.reviewImportCandidate(c?.id ?? "", "reject", "controller");

    // Frische Service- + Repo-Instanz über DENSELBEN Pool → persistenter Reject-Stand.
    const lib2 = new LibraryService({ koService, candidates: new PgCandidateRepo(pool) });
    const listed = await lib2.listImportCandidates();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(c?.id);
    expect(listed[0]?.status).toBe("abgelehnt");
  });
});
