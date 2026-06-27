import { describe, expect, it } from "vitest";
import type { KnowledgeClass, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerStatus, sourceRefs } from "../../apps/web/src/lib/askView";

const ko = (id: string, title: string): KnowledgeObject =>
  ({ id, title }) as unknown as KnowledgeObject;

describe("SCRUM-250: askView", () => {
  it("answerStatus: nur 'gesichert' → verified/pos, alles andere → unverified/warn", () => {
    expect(answerStatus("gesichert")).toEqual({ key: "verified", tone: "pos" });
    for (const c of [
      "ungeprueft",
      "meinung",
      "extern",
      "annahme",
      "unbekannt",
    ] as KnowledgeClass[]) {
      expect(answerStatus(c)).toEqual({ key: "unverified", tone: "warn" });
    }
  });

  it("sourceRefs löst IDs auf KO-Titel auf, Reihenfolge bleibt", () => {
    const refs = sourceRefs(["b", "a"], [ko("a", "Ventil X"), ko("b", "Pumpe P2")]);
    expect(refs).toEqual([
      { id: "b", label: "Pumpe P2", known: true },
      { id: "a", label: "Ventil X", known: true },
    ]);
  });

  it("unbekannte ID → Fallback auf die ID, known=false (ehrlich, kein Fake-Titel)", () => {
    const refs = sourceRefs(["ghost"], [ko("a", "Ventil X")]);
    expect(refs).toEqual([{ id: "ghost", label: "ghost", known: false }]);
  });

  it("leere Quellenliste → leeres Ergebnis", () => {
    expect(sourceRefs([], [ko("a", "A")])).toEqual([]);
  });
});
