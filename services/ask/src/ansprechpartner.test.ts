import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../knowledge-object";
import {
  ANSPRECHPARTNER_OBJEKTE_JE_PERSON,
  aehnlicheFrage,
  leiteAnsprechpartnerAb,
} from "./ansprechpartner";

// R-1663 / R-2178 — die reine Ableitung der Ansprechpartner aus Wissensspuren. Gemessen wird, was
// die Quelle verlangt: jede Person kommt MIT Begründung (Spurenart, Zahl, Objekte), es gibt keine
// Rangfolge, und Personen ohne Spur oder der Systemkontext erscheinen nicht.

function ko(teil: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: `Titel ${teil.id}`,
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "validiert",
    version: 1,
    originalAuthor: "",
    author: "",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...teil,
  } as KnowledgeObject;
}

describe("leiteAnsprechpartnerAb — begründete Vorschläge aus Wissensspuren", () => {
  it("A1: jede Spurenart wird je Person gezählt und mit den Objekten belegt", () => {
    const auskunft = leiteAnsprechpartnerAb({
      frageterme: ["pumpe"],
      objekte: [
        ko({
          id: "k1",
          originalAuthor: "anna",
          author: "bert",
          ownership: { owner: "carla", reviewers: ["dora"], validators: ["erik"] },
        }),
        ko({ id: "k2", originalAuthor: "anna", author: "anna" }),
      ],
      geschlosseneLuecken: [],
    });
    const nach = new Map(auskunft.vorschlaege.map((v) => [v.personId, v]));
    expect(nach.get("anna")?.spuren.originalautor).toBe(2);
    expect(nach.get("anna")?.spuren.erfasst, "Autor = Originalautor zählt nicht doppelt").toBe(0);
    expect(nach.get("anna")?.objekte.map((o) => o.id)).toEqual(["k1", "k2"]);
    expect(nach.get("bert")?.spuren.erfasst).toBe(1);
    expect(nach.get("carla")?.spuren.verantwortlich).toBe(1);
    expect(nach.get("dora")?.spuren.pruefung).toBe(1);
    expect(nach.get("erik")?.spuren.validiert).toBe(1);
    expect(nach.get("erik")?.objekte).toEqual([{ id: "k1", title: "Titel k1" }]);
    expect(auskunft.grundlage).toEqual({ objekte: 2, aehnlicheLuecken: 0 });
  });

  it("A2: keine Person ohne Spur — leere Kennung und Systemkontext erscheinen nie", () => {
    const auskunft = leiteAnsprechpartnerAb({
      frageterme: ["pumpe"],
      objekte: [
        ko({
          id: "k1",
          originalAuthor: "system",
          author: "",
          ownership: { reviewers: ["", "system"], validators: [] },
        }),
      ],
      geschlosseneLuecken: [{ assignee: "system", terme: ["pumpe"] }],
    });
    expect(auskunft.vorschlaege).toEqual([]);
    expect(auskunft.grundlage.objekte).toBe(1);
  });

  it("A3: keine Rangliste — Reihenfolge alphabetisch nach Kennung, nicht nach Spurenmenge", () => {
    const zora = { originalAuthor: "zora", author: "zora" };
    const viele = ["k1", "k2", "k3"].map((id) => ko({ id, ...zora }));
    const auskunft = leiteAnsprechpartnerAb({
      frageterme: ["pumpe"],
      objekte: [...viele, ko({ id: "k4", originalAuthor: "adam", author: "adam" })],
      geschlosseneLuecken: [],
    });
    expect(auskunft.vorschlaege.map((v) => v.personId)).toEqual(["adam", "zora"]);
    // Kein Punktwert im Vertrag: nur Kennung, Spuren und Objekte.
    for (const v of auskunft.vorschlaege) {
      expect(Object.keys(v).sort()).toEqual(["objekte", "personId", "spuren"]);
    }
  });

  it("A4: eine doppelt geführte Validierung zählt je Objekt einmal", () => {
    const auskunft = leiteAnsprechpartnerAb({
      frageterme: ["pumpe"],
      objekte: [ko({ id: "k1", ownership: { reviewers: [], validators: ["erik", "erik"] } })],
      geschlosseneLuecken: [],
    });
    expect(auskunft.vorschlaege[0]?.spuren.validiert).toBe(1);
  });

  it("A5: ähnliche geschlossene Lücken sind eine eigene Spur; unähnliche zählen nicht", () => {
    const auskunft = leiteAnsprechpartnerAb({
      frageterme: ["pumpe", "entlüften", "druck"],
      objekte: [],
      geschlosseneLuecken: [
        { assignee: "erik", terme: ["pumpe", "entlüften"] },
        { assignee: "erik", terme: ["urlaub", "antrag"] },
      ],
    });
    expect(auskunft.vorschlaege).toEqual([
      {
        personId: "erik",
        spuren: {
          originalautor: 0,
          erfasst: 0,
          validiert: 0,
          pruefung: 0,
          verantwortlich: 0,
          aehnlicheLuecken: 1,
        },
        objekte: [],
      },
    ]);
    expect(auskunft.grundlage).toEqual({ objekte: 0, aehnlicheLuecken: 1 });
  });

  it("A6: die Belegobjekte je Person sind gekürzt, die Zählung bleibt vollständig", () => {
    const anna = { originalAuthor: "anna", author: "anna" };
    const objekte = ["k1", "k2", "k3", "k4", "k5"].map((id) => ko({ id, ...anna }));
    const auskunft = leiteAnsprechpartnerAb({
      frageterme: ["x"],
      objekte,
      geschlosseneLuecken: [],
    });
    expect(auskunft.vorschlaege[0]?.spuren.originalautor).toBe(5);
    expect(auskunft.vorschlaege[0]?.objekte).toHaveLength(ANSPRECHPARTNER_OBJEKTE_JE_PERSON);
  });
});

describe("aehnlicheFrage — dieselben Token wie die Vorauswahl, schlicht und deterministisch", () => {
  it("B1: mindestens die Hälfte der kürzeren Frage muss in der anderen stehen", () => {
    const frage = ["pumpe", "entlüften", "druck"];
    expect(aehnlicheFrage(["pumpe", "entlüften"], ["pumpe", "druck", "ventil"])).toBe(true);
    expect(aehnlicheFrage(frage, ["ventil", "pumpe", "leck"])).toBe(false);
    expect(aehnlicheFrage([], ["pumpe"])).toBe(false);
  });
});
