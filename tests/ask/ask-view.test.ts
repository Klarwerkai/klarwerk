import { describe, expect, it } from "vitest";
import type { KnowledgeClass, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerReviewGuard, answerStatus, sourceRefs } from "../../apps/web/src/lib/askView";

const ko = (id: string, title: string, status: KnowledgeObject["status"]): KnowledgeObject =>
  ({ id, title, status }) as unknown as KnowledgeObject;

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
    const refs = sourceRefs(
      ["b", "a"],
      [ko("a", "Ventil X", "validiert"), ko("b", "Pumpe P2", "offen")],
    );
    expect(refs).toEqual([
      { id: "b", label: "Pumpe P2", known: true, validated: false },
      { id: "a", label: "Ventil X", known: true, validated: true },
    ]);
  });

  it("unbekannte ID → Fallback auf die ID, known=false (ehrlich, kein Fake-Titel)", () => {
    const refs = sourceRefs(["ghost"], [ko("a", "Ventil X", "validiert")]);
    expect(refs).toEqual([{ id: "ghost", label: "ghost", known: false, validated: null }]);
  });

  it("leere Quellenliste → leeres Ergebnis", () => {
    expect(sourceRefs([], [ko("a", "A", "validiert")])).toEqual([]);
  });

  it("answerReviewGuard: gesicherte Antworten brauchen keinen Review-Hinweis", () => {
    expect(
      answerReviewGuard("gesichert", [{ id: "a", label: "A", known: true, validated: true }]),
    ).toBeNull();
  });

  it("answerReviewGuard: ungeprüfte Antwort aus offener Quelle führt zur Validierung", () => {
    expect(
      answerReviewGuard("ungeprueft", [{ id: "a", label: "A", known: true, validated: false }]),
    ).toEqual({
      labelKey: "ask.reviewGuard.openLabel",
      hintKey: "ask.reviewGuard.openHint",
      ctaKey: "ask.reviewGuard.cta",
      ctaTo: "/validierung",
    });
  });

  it("answerReviewGuard: unbekannte ungeprüfte Quelle bleibt als ungeprüft markiert", () => {
    expect(
      answerReviewGuard("unbekannt", [
        { id: "ghost", label: "ghost", known: false, validated: null },
      ]),
    ).toMatchObject({
      labelKey: "ask.reviewGuard.unverifiedLabel",
      ctaTo: "/validierung",
    });
  });
});
