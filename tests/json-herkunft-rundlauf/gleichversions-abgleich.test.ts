// WA-1 / AW03-K04: eine bestehende Quellrevision entscheidet über Gleichheit, nicht allein ihre
// Versionsnummer und nicht der möglicherweise inzwischen bearbeitete KO-Inhalt.
// Reale Dienste mit ihren Speicheradaptern; kein Modell-, PG-, Word- oder Hostnachweis.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import {
  type DublettenPruefung,
  type ImportItem,
  InMemoryExternalSourceRepo,
  LibraryService,
} from "../../services/library-analytics";

const AKTEUR = "wa1-fiktiver-importeur";
const QUELL_ID = "WA1-QUELLE";
const OHNE_AEHNLICHKEIT: DublettenPruefung = () => ({ dublette: false });

function quelle(fassung = 1): ImportItem {
  return {
    title: `Fiktiver Wartungsplan ${fassung}`,
    statement: `Fiktive Aussage der Quellfassung ${fassung}.`,
    bodyHtml: `<p>Fiktiver Quellinhalt ${fassung}.</p>`,
    type: "best_practice",
    category: "Wartung",
    provider: "Confluence",
    externalId: QUELL_ID,
    sourceVersion: fassung,
    url: "https://wiki.example.test/wa1",
    confidentiality: "intern",
  };
}

async function instanz() {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const koService = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
    audit,
  });
  await koService.activateSearchProjectionV2();
  const quellen = new InMemoryExternalSourceRepo();
  const library = new LibraryService({ koService, externalSources: quellen });
  return { audit, koService, quellen, library };
}

type Kontext = Awaited<ReturnType<typeof instanz>>;

function importieren(ctx: Kontext, item: ImportItem) {
  return ctx.library.importJson([item], AKTEUR, OHNE_AEHNLICHKEIT, {
    zielDarf: () => true,
  });
}

async function zustand(ctx: Kontext) {
  const kos = await ctx.koService.list();
  return structuredClone({
    kos,
    fassungen: await Promise.all(kos.map((ko) => ctx.koService.versionsOf(ko.id))),
    belege: await Promise.all(kos.map((ko) => ctx.koService.evidenceOf(ko.id))),
    revisionen: await ctx.quellen.listBySource("Confluence", QUELL_ID),
    audit: await ctx.audit.list(),
  });
}

describe("WA-1 · Inhaltsabgleich am bestehenden Gleichversionsanker", () => {
  it.each(["title", "statement", "bodyHtml"] as const)(
    "anderer %s unter gleicher Quellversion ist ein Konflikt vor jeder Metadatenmutation",
    async (feld) => {
      const ctx = await instanz();
      const item = quelle();
      expect((await importieren(ctx, item)).imported).toBe(1);
      const vorher = await zustand(ctx);
      expect(vorher.revisionen).toHaveLength(1);
      expect(vorher.kos[0]?.sources[0]?.sourceRecordId).toBe(
        vorher.revisionen[0]?.sourceRecordId,
      );

      // Der geänderte Inhalt versucht zugleich den Vertraulichkeitsboden anzuheben. Auch diese
      // Mutation darf eine wegen Revisionskonflikts abgelehnte Übernahme nicht hinterlassen.
      const versuch = importieren(ctx, {
        ...item,
        [feld]: "Anderer fiktiver Quellinhalt.",
        confidentiality: "streng_vertraulich",
      });
      await expect(versuch).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await zustand(ctx)).toEqual(vorher);
    },
  );

  it("identischer Quellinhalt bleibt auch nach manueller KO-Überarbeitung idempotent", async () => {
    const ctx = await instanz();
    const item = quelle();
    await importieren(ctx, item);
    const [ko] = await ctx.koService.list();
    if (!ko) throw new Error("Erstimport fehlt");
    await ctx.koService.revise(
      ko.id,
      { statement: "Bewusste spätere Fachüberarbeitung." },
      AKTEUR,
    );
    const vorher = await zustand(ctx);
    expect(vorher.kos[0]?.version).toBe(2);

    const wieder = await importieren(ctx, item);
    expect(wieder.imported).toBe(0);
    expect(wieder.uebersprungen).toEqual([
      { titel: item.title, grund: "identisch", koId: ko.id },
    ]);
    expect(await zustand(ctx)).toEqual(vorher);
  });

  it("ein Altanker ohne gespeicherte Revision bleibt eine ehrliche Lücke, ohne Rückdatierung", async () => {
    const ctx = await instanz();
    // Der historische, unterstützte Aufbau ohne Revisionsablage darf keine erfundene Revision
    // bekommen, sobald derselbe Bestand später mit einer Revisionsablage verbunden wird.
    const ohneRevision = new LibraryService({ koService: ctx.koService });
    const item = quelle();
    expect((await ohneRevision.importJson([item], AKTEUR, OHNE_AEHNLICHKEIT)).imported).toBe(1);
    const vorher = await zustand(ctx);
    expect(vorher.kos[0]?.sources[0]).not.toHaveProperty("sourceRecordId");
    expect(vorher.revisionen).toEqual([]);

    await expect(importieren(ctx, item)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("nicht belegt"),
    });
    expect(await zustand(ctx)).toEqual(vorher);
  });

  it("höhere Quellfassung schreibt dieselbe KO-ID fort; ältere Fassung überschreibt sie nicht", async () => {
    const ctx = await instanz();
    await importieren(ctx, quelle(1));
    const [ko] = await ctx.koService.list();
    if (!ko) throw new Error("Erstimport fehlt");
    expect((await importieren(ctx, quelle(2))).imported).toBe(1);
    const vorher = await zustand(ctx);
    expect(vorher.kos).toHaveLength(1);
    expect(vorher.kos[0]).toMatchObject({
      id: ko.id,
      version: 2,
      statement: quelle(2).statement,
    });
    expect(vorher.revisionen.map((r) => r.sourceVersion)).toEqual([1, 2]);
    expect((await importieren(ctx, quelle(1))).imported).toBe(0);
    expect(await zustand(ctx)).toEqual(vorher);
  });
});
