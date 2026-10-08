// ================================================================================================
// R-0338 (Aufnahme gesamt-suchindex-aktualitaet) — DER AUFFRISCHEN-VERTRAG, OHNE BROWSER.
// ================================================================================================
//
// Geprüft wird `apps/web/src/lib/fragenArbeitsstand.ts` gegen die Regeln am Vertrag:
//   F1  Der Quellenstand hält die Fassung jeder Quelle fest — oder nichts, wenn er nicht bürgen kann.
//   F2  Eine Antwort ist ÜBERHOLT, sobald eine Quelle eine andere Fassung trägt, fehlt oder aufging.
//   F3  Ohne Stand oder ohne geladenen Bestand ist sie UNGEPRÜFT — keine Behauptung ohne Grundlage.
//   F4  Der Stand reist mit der gespeicherten Antwort; ein beschädigter Stand verwirft sie nicht.
import { describe, expect, it } from "vitest";
import type { AnswerResult } from "../../apps/web/src/api/types";
import {
  type FragenArbeitsstand,
  antwortFrische,
  arbeitsstandLesen,
  arbeitsstandSchreiben,
  quellenStandAus,
} from "../../apps/web/src/lib/fragenArbeitsstand";

const BESTAND = [
  { id: "ko-1", version: 3 },
  { id: "ko-2", version: 1 },
];

function speicher(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
  inhalt: Map<string, string>;
} {
  const inhalt = new Map<string, string>();
  return {
    inhalt,
    getItem: (k) => inhalt.get(k) ?? null,
    setItem: (k, v) => {
      inhalt.set(k, v);
    },
    removeItem: (k) => {
      inhalt.delete(k);
    },
  };
}

describe("R-0338 · Auffrischen-Vertrag — Regeln", () => {
  it("F1 · der Stand nennt die Fassung jeder Quelle; fehlt eine oder der Bestand, gibt es keinen", () => {
    expect(quellenStandAus(["ko-1", "ko-2"], BESTAND)).toEqual({ "ko-1": 3, "ko-2": 1 });
    expect(quellenStandAus([], BESTAND)).toEqual({});
    expect(quellenStandAus(["ko-1", "ko-9"], BESTAND)).toBeUndefined();
    expect(quellenStandAus(["ko-1"], undefined)).toBeUndefined();
  });

  it("F2 · neue Fassung, fehlende Quelle oder Zusammenführen machen die Antwort überholt", () => {
    const stand = { "ko-1": 3, "ko-2": 1 };
    // Kalibrierung: unverändert ist aktuell.
    expect(antwortFrische(stand, BESTAND)).toBe("aktuell");

    expect(
      antwortFrische(stand, [
        { id: "ko-1", version: 4 },
        { id: "ko-2", version: 1 },
      ]),
    ).toBe("ueberholt");
    expect(antwortFrische(stand, [{ id: "ko-1", version: 3 }])).toBe("ueberholt");
    expect(
      antwortFrische(stand, [
        { id: "ko-1", version: 3, mergedInto: { koId: "ko-7" } },
        { id: "ko-2", version: 1 },
      ]),
    ).toBe("ueberholt");
  });

  it("F3 · ohne Stand oder ohne Bestand ist die Antwort ungeprüft — nie still „aktuell“", () => {
    expect(antwortFrische(undefined, BESTAND)).toBe("ungeprueft");
    expect(antwortFrische({ "ko-1": 3 }, undefined)).toBe("ungeprueft");
  });

  it("F4 · der Stand reist mit der gespeicherten Antwort, ein beschädigter Stand verwirft sie nicht", () => {
    const s = speicher();
    const stand: FragenArbeitsstand = {
      entwurf: "",
      antwort: {
        frage: "Wie oft wird Ventil V4 geprüft?",
        result: { answered: true, sources: ["ko-1"] } as unknown as AnswerResult,
        receipt: "beleg-1",
        verschlossen: [],
        gapId: null,
        angezeigtAm: "2026-10-01T08:00:00.000Z",
        quellenStand: { "ko-1": 3 },
      },
      startadressen: [],
    };
    arbeitsstandSchreiben(s, "u1", stand);
    expect(arbeitsstandLesen(s, "u1")?.antwort?.quellenStand).toEqual({ "ko-1": 3 });

    const [schluessel, roh] = [...s.inhalt.entries()][0] as [string, string];
    const kaputt = JSON.parse(roh);
    kaputt.antwort.quellenStand = { "ko-1": "drei" };
    s.setItem(schluessel, JSON.stringify(kaputt));
    const gelesen = arbeitsstandLesen(s, "u1");
    expect(gelesen?.antwort?.frage).toBe("Wie oft wird Ventil V4 geprüft?");
    expect(gelesen?.antwort?.quellenStand).toBeUndefined();
  });
});
