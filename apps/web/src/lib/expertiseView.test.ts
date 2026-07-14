import { describe, expect, it } from "vitest";
import type { ExpertiseEntry } from "../api/types";
import { canSeeExpertise, contributorNamesFor, expertiseVisible } from "./expertiseView";

// Consultant-System (Experten-Matching): das UI-Gating deterministisch absichern — genau die drei Fälle
// aus dem Auftrag. DOM-frei (reine Logik), deckt Flag- UND Rechte-Gate ab.
const DATA: ExpertiseEntry[] = [
  {
    category: "Wartung",
    // Backend liefert alphabetisch — die Reihenfolge bleibt bewusst unverändert (kein Ranking).
    contributors: [
      { authorId: "u-anna", koCount: 3 },
      { authorId: "u-bora", koCount: 1 },
    ],
  },
];
const NAMES: Record<string, string> = { "u-anna": "Anna", "u-bora": "Bora" };
const nameOf = (id: string): string => NAMES[id] ?? id;

describe("expertiseView — UI-Gating (Flag + ko.assign)", () => {
  it("Flag AUS (keine/leere Daten) → nicht gerendert, auch für controller/admin", () => {
    expect(expertiseVisible("admin", undefined)).toBe(false);
    expect(expertiseVisible("controller", undefined)).toBe(false);
    expect(expertiseVisible("admin", [])).toBe(false);
  });

  it("Flag AN, aber ohne ko.assign (viewer/experte) → nicht gerendert trotz Daten", () => {
    expect(canSeeExpertise("viewer")).toBe(false);
    expect(canSeeExpertise("experte")).toBe(false);
    expect(expertiseVisible("experte", DATA)).toBe(false);
    expect(expertiseVisible("viewer", DATA)).toBe(false);
  });

  it("Flag AN mit ko.assign → Personen je Thema sichtbar, Backend-Reihenfolge erhalten", () => {
    expect(canSeeExpertise("controller")).toBe(true);
    expect(canSeeExpertise("admin")).toBe(true);
    expect(expertiseVisible("controller", DATA)).toBe(true);
    expect(expertiseVisible("admin", DATA)).toBe(true);
    // Namen in genau der (alphabetischen) Reihenfolge des Backends — nicht nach koCount umsortiert.
    expect(contributorNamesFor(DATA, "Wartung", nameOf)).toEqual(["Anna", "Bora"]);
    expect(contributorNamesFor(DATA, "Unbekannt", nameOf)).toEqual([]);
  });
});
