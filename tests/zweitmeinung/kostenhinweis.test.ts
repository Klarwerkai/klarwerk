// ================================================================================================
// R-0305/R-1099 · Ben, Nacharbeit 2 — DER KOSTENHINWEIS AM ZWEITMEINUNGSKNOPF KENNT BEIDE WEGE.
// ================================================================================================
//
// Befund: der Knopf bekam nur `billable.answer`. Bei lokaler Erstantwort und freigegebenem
// externem Zweitmodell fehlte der Hinweis, obwohl der Klick kostenpflichtig werden kann.
// `deriveZweitmeinungBillable` leitet ihn jetzt aus beiden Modellwegen ab; die Seite reicht genau
// diesen Wert an `AiCostHint` (pages/Ask.tsx).
import { describe, expect, it } from "vitest";
import { deriveZweitmeinungBillable } from "../../apps/web/src/lib/aiAvailability";

describe("R-0305/R-1099 · deriveZweitmeinungBillable", () => {
  it("K1 · lokale Erstantwort + kostenpflichtiges Zweitmodell ⇒ Hinweis (der Befund)", () => {
    const status = { billable: { answer: false }, zweitmeinungBillable: true };
    expect(deriveZweitmeinungBillable(status)).toBe(true);
  });

  it("K2 · kostenpflichtiger Antwortweg allein genügt weiterhin", () => {
    const status = { billable: { answer: true }, zweitmeinungBillable: false };
    expect(deriveZweitmeinungBillable(status)).toBe(true);
  });

  it("K3 · beide Wege kostenlos ⇒ kein Hinweis", () => {
    const status = { billable: { answer: false }, zweitmeinungBillable: false };
    expect(deriveZweitmeinungBillable(status)).toBe(false);
  });

  it("K4 · ohne Auskunft schweigt der Satz (kein Status, alter Server ohne Feld)", () => {
    expect(deriveZweitmeinungBillable(undefined)).toBe(false);
    expect(deriveZweitmeinungBillable({ billable: { answer: false } })).toBe(false);
  });

  it("K5 · auch ohne Aufgabenkarte zählt ein kostenpflichtiges Zweitmodell", () => {
    expect(deriveZweitmeinungBillable({ zweitmeinungBillable: true })).toBe(true);
  });
});
