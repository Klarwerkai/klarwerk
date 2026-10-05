import { describe, expect, it } from "vitest";
import { makeKo } from "../test/render";
import { classifyIntake, textSimilarity } from "./intakeSimilarity";

// SCRUM-527 (WP2): die reine Ähnlichkeits-Heuristik der Live-Reaktion (neu vs. ähnlich), ehrlich, ohne
// erfundenen Widerspruch.

describe("textSimilarity", () => {
  it("gleiche Texte → 1, disjunkte → 0", () => {
    expect(textSimilarity("Pumpe entlüften Wartung", "Pumpe entlüften Wartung")).toBe(1);
    expect(textSimilarity("Pumpe entlüften", "Aktienkurs Börse")).toBe(0);
  });
});

describe("classifyIntake", () => {
  it("zu kurzer Text → idle", () => {
    expect(classifyIntake("kurz", []).status).toBe("idle");
  });

  // AUFNAHME 20260922 · VORSCHAU-REICHWEITE: hier stand „→ new (du bist die erste Person)". Der
  // Zustand `new` gibt es nicht mehr (keine bestandweite Neuheitsaussage, Kriterium 1); dieser
  // lokale Weg kennt nur den geladenen Bestand und meldet seinen Umfang deshalb als unbekannt.
  it("kein ähnliches KO → empty mit unbekanntem Umfang (keine Neuheitsaussage)", () => {
    const kos = [makeKo({ id: "x", title: "Ganz anderes Thema", statement: "Börse und Aktien." })];
    const v = classifyIntake("Vor der Wartung immer den Not-Aus ziehen und sichern.", kos);
    expect(v).toEqual({ status: "empty", coverage: { kind: "unknown" } });
  });

  it("ähnliches KO über der Schwelle → similar mit Titel + Link-Ziel", () => {
    const kos = [
      makeKo({ id: "k1", title: "Not-Aus vor Wartung", statement: "Vor Wartung Not-Aus ziehen." }),
      makeKo({ id: "k2", title: "Kaffeeküche", statement: "Milch nachfüllen." }),
    ];
    const v = classifyIntake("Vor jeder Wartung zuerst den Not-Aus ziehen und sichern.", kos);
    expect(v.status).toBe("similar");
    if (v.status === "similar") {
      expect(v.match.koId).toBe("k1");
      expect(v.match.title).toBe("Not-Aus vor Wartung");
    }
  });

  it("erfindet NIE einen Widerspruch (kein Fake-Alarm)", () => {
    const kos = [makeKo({ id: "k1", title: "Not-Aus", statement: "Not-Aus ziehen." })];
    const v = classifyIntake("Vor jeder Wartung den Not-Aus ziehen und sichern.", kos);
    expect(v.status).not.toBe("conflict");
  });
});
