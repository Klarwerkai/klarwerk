import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import { themenVon } from "../../services/wissensnetz";

function ko(i: number, tags: string[]): KnowledgeObject {
  return {
    id: `ko-${String(i).padStart(5, "0")}`,
    title: `Titel ${i}`,
    tags,
    statement: "S",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "c",
    confidence: 3,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u",
    author: "u",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-10-01T00:00:00Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  };
}

async function graph(bestand: KnowledgeObject[], sichtbar: (k: KnowledgeObject) => boolean) {
  const repo = new InMemoryKoRepo();
  for (const k of bestand) await repo.insert(k);
  return new LibraryService({ koService: new KoService({ repo }) }).graph({ sichtbar });
}

// Unabhängige alte exakte Paarschleife nur für kleine Bestände, inklusive Mehrfachthemen und Sicht.
function exakt(bestand: KnowledgeObject[]) {
  const sortiert = [...bestand].sort((a, b) => a.id.localeCompare(b.id));
  const tags = sortiert.map(themenVon);
  const haeufig = new Map<string, number>();
  for (const liste of tags) for (const t of liste) haeufig.set(t, (haeufig.get(t) ?? 0) + 1);
  const excluded = [...haeufig]
    .filter(([, n]) => n >= 5 && n / bestand.length > 0.5)
    .map(([tag]) => tag)
    .sort((a, b) => a.localeCompare(b));
  const edges = [];
  for (let i = 0; i < sortiert.length; i += 1) {
    for (let j = i + 1; j < sortiert.length; j += 1) {
      const via = tags[i]!.find((tag) => !excluded.includes(tag) && tags[j]!.includes(tag));
      if (via !== undefined) edges.push({ a: sortiert[i]!.id, b: sortiert[j]!.id, via });
    }
  }
  return {
    nodes: sortiert.map(({ id, title }) => ({ id, title })),
    edges,
    totalEdges: edges.length,
    truncated: false,
    edgeLimit: 5000,
    excludedTags: excluded,
  };
}

describe("P8 · eindeutige Graphpaare ohne Paarmaterialisierung", () => {
  it.each([0, 4, 33, 65, 129])("exakte alte Kleinmenge und Wortgrenzen bei n=%i", async (n) => {
    const bestand = Array.from({ length: n }, (_, i) =>
      ko(i, [
        "alle",
        ...(i % 3 === 0 ? ["a", "z", "a"] : []),
        ...(i % 4 === 0 ? ["a", "b"] : []),
        ...(i % 5 === 0 ? ["b", "z"] : []),
        " ",
      ]),
    );
    const sichtbar = (k: KnowledgeObject) => Number(k.id.slice(3)) % 7 !== 0;
    const erwartet = exakt(bestand.filter(sichtbar));
    expect(await graph(bestand, sichtbar)).toEqual(erwartet);
    expect(await graph([...bestand].reverse(), sichtbar)).toEqual(erwartet);
  });

  it("12000 Knoten, zwei überlappende breite Themen: exakt zählen und nur5000 geordnete Kanten bilden", async () => {
    const bestand: KnowledgeObject[] = [];
    const inThema = new Map<number, number>();
    let breit = 0;
    for (let i = 0; i < 12000; i += 1) {
      const traegt = i % 100 < 49;
      if (traegt) {
        breit += 1;
        inThema.set(i % 800, (inThema.get(i % 800) ?? 0) + 1);
      }
      bestand.push(ko(i, [`thema-${i % 800}`, ...(traegt ? ["wartung", "z-wartung"] : [])]));
    }
    const paarzahl = (n: number) => (n * (n - 1)) / 2;
    const erwartet =
      paarzahl(breit) +
      800 * paarzahl(15) -
      [...inThema.values()].reduce((sum, n) => sum + paarzahl(n), 0);
    const repo = new InMemoryKoRepo();
    for (const k of bestand) await repo.insert(k);
    const service = new LibraryService({ koService: new KoService({ repo }) });
    const heap = process.memoryUsage().heapUsed;
    const start = performance.now();
    const g = await service.graph({ sichtbar: () => true });
    expect(performance.now() - start).toBeLessThan(300);
    expect(process.memoryUsage().heapUsed - heap).toBeLessThan(200_000_000);
    expect(g.totalEdges).toBe(erwartet);
    expect(g.edges).toHaveLength(5000);
    expect(g.nodes).toHaveLength(12000);
    expect(g.truncated).toBe(true);
    expect(new Set(g.edges.map((e) => `${e.a}|${e.b}`)).size).toBe(5000);
    expect([...g.edges].sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b))).toEqual(
      g.edges,
    );
    expect(g.edges.every((e) => e.via !== "z-wartung")).toBe(true);
  });
});
