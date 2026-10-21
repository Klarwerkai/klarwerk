// W2 / AW03-K01: enge Zusammensetzung des erhaltenen 755-Kopienabgleichs mit dem heutigen
// Antwortvertrag. Alte sechs K01-Positiva sind separat erhalten; hier nur diese eine neue Probe.
import { describe, expect, it } from "vitest";
import type { ArgumentStufe as WebArgumentStufe } from "../../apps/web/src/api/types";
import { answerEvidence, antwortBelastbarkeit } from "../../services/ask";
import type { KnowledgeObject } from "../../services/knowledge-object";

const SEITE_V3 = {
  id: "src-seite",
  label: "Wartung Pumpe P3",
  url: "https://wiki.example.invalid/pages/17",
  excerpt: null,
  kind: "external",
  peerValidated: false,
  provider: "Confluence",
  externalId: "page-17",
  sourceVersion: 3,
  sourceRecordId: "rev-17-3",
  sourcePath: ["Werk 1", "Pumpen"],
  author: "import",
  at: "2026-10-01T08:00:00.000Z",
};
describe("W2 · Herkunftsgruppen am heutigen Antwortschluss", () => {
  function ko(id: string, title: string, sources: unknown[]): KnowledgeObject {
    return {
      id,
      title,
      statement: `Aussage ${id}`,
      type: "best_practice",
      category: "Betrieb",
      status: "validiert",
      trust: 80,
      version: 1,
      author: `autor-${id}`,
      createdAt: "2026-01-01T00:00:00.000Z",
      history: [],
      ownership: { owner: `autor-${id}`, reviewers: [], validators: [] },
      sources,
    } as unknown as KnowledgeObject;
  }

  function schluss(kos: KnowledgeObject[]) {
    const map = new Map(kos.map((k): [string, KnowledgeObject] => [k.id, k]));
    const ids = kos.map((k) => k.id);
    const answer = { answered: true, sources: ids, citedSources: ids, answer: "Antwort." };
    const evidence = answerEvidence({
      answer: { ...answer, knowledgeClass: "gesichert" as const },
      sourceKos: map,
      openConflicts: [],
    });
    const b = antwortBelastbarkeit({ answer, evidence, kos: map, openConflicts: [] });
    // Strukturelle Typzuweisung zum bestehenden Web-Vertrag, keine erzwungene Typbehauptung.
    const wire: WebArgumentStufe[] = b.argumentation;
    const s = wire.at(-1);
    if (!s || s.art !== "schluss") throw new Error("Antwortschluss fehlt");
    return s;
  }

  it("zwei Kopien sind eine Herkunft; eine dritte Quelle mit gleichem Titel bleibt unabhängig", () => {
    const titel = "Druck einstellen";
    const a = ko("a", titel, [SEITE_V3]);
    const b = ko("b", titel, [{ ...SEITE_V3, id: "src-kopie" }]);
    const kopien = schluss([a, b]);
    expect(kopien.unabhaengig).toBe(false);
    expect(kopien.gemeinsameHerkunft).toContainEqual({
      herkunft: "revision:rev-17-3",
      koIds: ["a", "b"],
    });
    const andere = { ...SEITE_V3, id: "src-anders", externalId: "page-99", sourceRecordId: "rev-99-1" };
    const mitDritter = schluss([a, b, ko("c", titel, [andere])]);
    expect(mitDritter.unabhaengig).toBe(true);
    expect(mitDritter.gestuetztAuf).toEqual(["a", "b", "c"]);
    expect(mitDritter.gemeinsameHerkunft).toContainEqual({
      herkunft: "quelle:confluence:page-17",
      koIds: ["a", "b"],
    });
    expect(mitDritter.gemeinsameHerkunft?.every((g) => !g.koIds.includes("c"))).toBe(true);
  });
});
