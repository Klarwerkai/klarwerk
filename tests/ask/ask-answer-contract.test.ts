import { describe, expect, it } from "vitest";
import type { KnowledgeClass } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  ANSWER_CONTRACT_TRUST_NOTE_KEY,
  answerContract,
  answerSourceSummary,
} from "../../apps/web/src/lib/askAnswerContract";
import type { ConflictAwareSourceRef } from "../../apps/web/src/lib/askView";

const text = (lng: string, key: string) =>
  String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();
const present = (key: string) => ["de", "en"].every((lng) => text(lng, key).length > 0);

function ref(p: Partial<ConflictAwareSourceRef>): ConflictAwareSourceRef {
  return {
    id: "id",
    label: "L",
    known: true,
    validated: true,
    usability: "ready",
    demo: false,
    conflictLimited: false,
    conflictTruth: false,
    ...p,
  };
}

// SCRUM-366 / AG-04 / AG-P2-2 / AG-P2-3 / FR-ASK-02 / PI-K2: ehrlicher Antwortvertrag aus vorhandenen
// Signalen. Quellengebunden, gesichert ≠ Wahrheit, Gap = Wissenslücke statt Chatbot-Fehler.
describe("SCRUM-366: answerContract", () => {
  it("keine Antwort → Wissenslücke (kein Fehler)", () => {
    const c = answerContract({
      answered: false,
      knowledgeClass: "unbekannt",
      sourcesConflicted: false,
    });
    expect(c.kind).toBe("gap");
    expect(c.sourceBound).toBe(false);
    expect(c.tone).toBe("warn");
  });

  it("gesichert + kein Konflikt → verified (pos, quellengebunden)", () => {
    const c = answerContract({
      answered: true,
      knowledgeClass: "gesichert",
      sourcesConflicted: false,
    });
    expect(c.kind).toBe("verified");
    expect(c.tone).toBe("pos");
    expect(c.sourceBound).toBe(true);
  });

  it("gesichert ABER konfliktbetroffen → ehrlich auf ungeprüft herabgestuft (AG-14)", () => {
    const c = answerContract({
      answered: true,
      knowledgeClass: "gesichert",
      sourcesConflicted: true,
    });
    expect(c.kind).toBe("unverified");
    expect(c.tone).toBe("warn");
  });

  it("jede nicht-gesicherte Klasse beantwortet → unverified (markiert, keine Vermutung)", () => {
    for (const k of [
      "ungeprueft",
      "meinung",
      "extern",
      "annahme",
      "unbekannt",
    ] as KnowledgeClass[]) {
      expect(
        answerContract({ answered: true, knowledgeClass: k, sourcesConflicted: false }).kind,
      ).toBe("unverified");
    }
  });

  it("Titel/Body/Next-Step jeder Vertragsart sind DE/EN vorhanden", () => {
    for (const k of ["verified", "unverified", "gap"] as const) {
      const c = answerContract({
        answered: k !== "gap",
        knowledgeClass: k === "verified" ? "gesichert" : "ungeprueft",
        sourcesConflicted: false,
      });
      expect(present(c.titleKey)).toBe(true);
      expect(present(c.bodyKey)).toBe(true);
      expect(present(c.nextStepKey)).toBe(true);
    }
  });

  it("Quellengebunden-Rahmung + Ehrlichkeit der Copy", () => {
    // verified rahmt explizit „keine generische Chatbot-Antwort".
    expect(text("de", "ask.contract.verified.body")).toContain("keine generische chatbot");
    expect(text("en", "ask.contract.verified.body")).toContain("not a generic chatbot");
    // ungeprüft ist als ungeprüft markiert, keine Chatbot-Vermutung.
    expect(text("de", "ask.contract.unverified.body")).toContain("ungeprüft");
    expect(text("en", "ask.contract.unverified.body")).toContain("not a chatbot guess");
    // unverified-Next-Step führt zur Prüfung/Validierung.
    expect(text("de", "ask.contract.unverified.next")).toContain("prüfung");
    expect(text("en", "ask.contract.unverified.next")).toContain("review");
    // Gap ist „kein Fehler".
    expect(text("de", "ask.contract.gap.body")).toContain("kein fehler");
    expect(text("en", "ask.contract.gap.body")).toContain("not an error");
  });

  it("PI-K2 Trust-Notiz: Belastbarkeit, kein Wahrheitsversprechen (DE/EN)", () => {
    expect(ANSWER_CONTRACT_TRUST_NOTE_KEY).toBe("ask.contract.trustNote");
    expect(present(ANSWER_CONTRACT_TRUST_NOTE_KEY)).toBe(true);
    expect(text("de", ANSWER_CONTRACT_TRUST_NOTE_KEY)).toContain("kein wahrheitsversprechen");
    expect(text("en", ANSWER_CONTRACT_TRUST_NOTE_KEY)).toContain("not a guarantee of truth");
  });
});

describe("SCRUM-366: answerSourceSummary", () => {
  it("zählt bekannt/unbekannt, validiert/offen, nutzbar, konfliktbegrenzt", () => {
    const s = answerSourceSummary([
      ref({ id: "a", validated: true, usability: "ready" }),
      ref({ id: "b", validated: false, usability: "needs-work" }),
      ref({ id: "c", validated: true, usability: "in-review", conflictLimited: true }),
      ref({ id: "g", known: false, validated: null, usability: null }),
    ]);
    expect(s).toEqual({
      total: 4,
      known: 3,
      unknown: 1,
      validated: 2,
      open: 1,
      ready: 1,
      conflictLimited: 1,
    });
  });

  it("leere Quellen → alles 0", () => {
    expect(answerSourceSummary([])).toEqual({
      total: 0,
      known: 0,
      unknown: 0,
      validated: 0,
      open: 0,
      ready: 0,
      conflictLimited: 0,
    });
  });

  it("Summen-Labels (Pluralisierung) sind DE/EN vorhanden", () => {
    for (const key of [
      "ask.contract.sumTotal",
      "ask.contract.sumValidated",
      "ask.contract.sumOpen",
      "ask.contract.sumConflict",
    ]) {
      // sumTotal nutzt Plural-Suffixe; i18next-Key-Präsenz über die _other-Variante prüfen.
      const probe = key === "ask.contract.sumTotal" ? `${key}_other` : key;
      expect(present(probe)).toBe(true);
    }
  });
});
