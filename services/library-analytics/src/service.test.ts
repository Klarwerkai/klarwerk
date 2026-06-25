import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { LibraryService } from "./service";

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
  return { koService, library: new LibraryService({ koService }) };
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
    const json = await ctx.library.exportJson();
    expect(json).toHaveLength(2);
    const wiki = await ctx.library.exportMediaWiki();
    expect(wiki).toContain("== Ventil schließen ==");
    const html = await ctx.library.exportHtml();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<h2>Ventil schließen</h2>");
  });

  it("FR-LIB-02: Export als Text-Markdown", async () => {
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

  it("FR-LIB-03: Bus-Faktor erkennt Einzelquellen", async () => {
    const bf = await ctx.library.busFactor();
    const a1 = bf.find((e) => e.category === "Anlage 1");
    expect(a1?.singleSource).toBe(true);
    expect(a1?.authorCount).toBe(1);
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
