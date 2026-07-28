import { describe, expect, it } from "vitest";
import type { KnowledgeClass, KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { answerGrade } from "../../apps/web/src/lib/answerGrade";
import { answerReviewGuard, answerStatus, sourceRefs } from "../../apps/web/src/lib/askView";
import { koOverview } from "../../apps/web/src/lib/koOverview";

const ko = (id: string, title: string, status: KnowledgeObject["status"]): KnowledgeObject =>
  ({ id, title, status }) as unknown as KnowledgeObject;

describe("SCRUM-250: askView", () => {
  // AUFTRAG-mega33 A2: answerStatus liest die EFFEKTIVE Einstufung, nicht mehr die rohe Klasse.
  it("answerStatus: nur die belegte Einstufung → verified/pos, alles andere → unverified/warn", () => {
    expect(answerStatus("verified")).toEqual({ key: "verified", tone: "pos" });
    expect(answerStatus("unverified")).toEqual({ key: "unverified", tone: "warn" });
    expect(answerStatus("gap")).toEqual({ key: "unverified", tone: "warn" });
    // Und die rohe Klasse allein trägt kein „verified" mehr: ohne belegten Lauf wird aus
    // „gesichert" eine unverified-Einstufung — genau bens ROT 3.
    for (const c of [
      "gesichert",
      "ungeprueft",
      "meinung",
      "extern",
      "annahme",
      "unbekannt",
    ] as KnowledgeClass[]) {
      expect(
        answerStatus(
          answerGrade({
            answered: true,
            knowledgeClass: c,
            sourcesConflicted: false,
            sourcesCheckUnproven: true,
            conflictsUnproven: false,
          }),
        ),
      ).toEqual({ key: "unverified", tone: "warn" });
    }
  });

  it("sourceRefs löst IDs auf KO-Titel auf, Reihenfolge bleibt", () => {
    const refs = sourceRefs(
      ["b", "a"],
      [ko("a", "Ventil X", "validiert"), ko("b", "Pumpe P2", "offen")],
    );
    expect(refs).toEqual([
      {
        id: "b",
        label: "Pumpe P2",
        known: true,
        validated: false,
        usability: "needs-work",
        demo: false,
      },
      {
        id: "a",
        label: "Ventil X",
        known: true,
        validated: true,
        usability: "ready",
        demo: false,
      },
    ]);
  });

  it("unbekannte ID → Fallback auf die ID, known=false (ehrlich, kein Fake-Titel)", () => {
    const refs = sourceRefs(["ghost"], [ko("a", "Ventil X", "validiert")]);
    expect(refs).toEqual([
      { id: "ghost", label: "ghost", known: false, validated: null, usability: null, demo: false },
    ]);
  });

  // SCRUM-300: jede Quelle trägt die kanonische Nutzbarkeit (gleiche Ableitung wie KO-Detail/Library),
  // damit die Antwort sichtbar nur so belastbar ist wie ihre Quelle. Keine neue Quellen-Engine.
  it("sourceRefs.usability ist konsistent mit koOverview (validiert/offen/in Prüfung)", () => {
    const validated = ko("a", "Ventil X", "validiert");
    const open = ko("b", "Pumpe P2", "offen");
    const inReview = {
      id: "c",
      title: "Lager L1",
      status: "offen",
      assignments: ["u1"],
    } as unknown as KnowledgeObject;
    const refs = sourceRefs(["a", "b", "c"], [validated, open, inReview]);
    expect(refs.map((r) => r.usability)).toEqual(["ready", "needs-work", "in-review"]);
    // exakt dieselbe Ableitung wie das KO-Detail nutzt (eine Sprache, kein Widerspruch).
    expect(refs[0]?.usability).toBe(koOverview(validated).usability);
    expect(refs[2]?.usability).toBe(koOverview(inReview).usability);
  });

  it("ask.sourcesHint ist DE und EN vorhanden (Quellenbindung ehrlich erklärt)", () => {
    for (const lng of ["de", "en"]) {
      expect(
        String(i18n.getResource(lng, "translation", "ask.sourcesHint") ?? "").length,
      ).toBeGreaterThan(0);
    }
  });

  it("leere Quellenliste → leeres Ergebnis", () => {
    expect(sourceRefs([], [ko("a", "A", "validiert")])).toEqual([]);
  });

  it("answerReviewGuard: eine belegt gesicherte Einstufung braucht keinen Review-Hinweis", () => {
    expect(
      answerReviewGuard("verified", [
        { id: "a", label: "A", known: true, validated: true, usability: "ready", demo: false },
      ]),
    ).toBeNull();
  });

  it("answerReviewGuard: ungeprüfte Antwort aus offener Quelle führt zur Validierung", () => {
    expect(
      answerReviewGuard("unverified", [
        {
          id: "a",
          label: "A",
          known: true,
          validated: false,
          usability: "needs-work",
          demo: false,
        },
      ]),
    ).toEqual({
      labelKey: "ask.reviewGuard.openLabel",
      hintKey: "ask.reviewGuard.openHint",
      ctaKey: "ask.reviewGuard.cta",
      ctaTo: "/validierung",
    });
  });

  it("answerReviewGuard: unbekannte ungeprüfte Quelle bleibt als ungeprüft markiert", () => {
    expect(
      answerReviewGuard("unverified", [
        {
          id: "ghost",
          label: "ghost",
          known: false,
          validated: null,
          usability: null,
          demo: false,
        },
      ]),
    ).toMatchObject({
      labelKey: "ask.reviewGuard.unverifiedLabel",
      ctaTo: "/validierung",
    });
  });
});
