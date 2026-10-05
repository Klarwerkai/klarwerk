// ================================================================================================
// AUFNAHME 20260922 · PRÜFBOARD-BEDIENUNG — die Regel der Konfliktlage je Prüfkarte (§8.2).
// ================================================================================================
//
// Pedis Entscheidung vom 03.10.2026 (entscheidung:ebf707cb): „Markierung an jeder betroffenen
// Karte, mit eigenem Lade- und Fehlerzustand für die Konfliktdaten." Diese Datei hält die reine
// Ableitung `pruefKonfliktLage`; die gemountete Fläche misst `konfliktmarkierung-mounted.test.tsx`.
import { describe, expect, it } from "vitest";
import type { Conflict } from "../../apps/web/src/api/types";
import { pruefKonfliktLage } from "../../apps/web/src/lib/pruefKonflikt";

function konflikt(over: Partial<Conflict> = {}): Conflict {
  return {
    id: "c1",
    koA: "k1",
    koB: "k9",
    type: "context",
    description: "",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

describe("pruefKonfliktLage", () => {
  it("ohne Antwort und laufendem Abruf: laedt — keine Aussage über Konflikte", () => {
    expect(pruefKonfliktLage("k1", { isError: false, isLoading: true })).toEqual({ art: "laedt" });
  });

  it("ohne Antwort und gescheitertem Abruf: fehler", () => {
    expect(pruefKonfliktLage("k1", { isError: true, isLoading: false })).toEqual({ art: "fehler" });
  });

  it("betroffen als A oder als B, mit Anzahl und Wahrheitskennzeichen", () => {
    const lage = pruefKonfliktLage("k1", {
      data: [konflikt(), konflikt({ id: "c2", koA: "k7", koB: "k1", type: "truth" })],
      isError: false,
      isLoading: false,
    });
    expect(lage.art).toBe("betroffen");
    if (lage.art !== "betroffen") return;
    expect(lage.wirkung.unresolvedCount).toBe(2);
    expect(lage.wirkung.hasTruth).toBe(true);
    expect(lage.nichtFrisch).toBe(false);
  });

  it("ein gelöster Konflikt markiert nicht — dieselbe Regel wie in der Bibliothek", () => {
    expect(
      pruefKonfliktLage("k1", {
        data: [konflikt({ status: "geloest" })],
        isError: false,
        isLoading: false,
      }),
    ).toEqual({ art: "keiner", nichtFrisch: false });
  });

  it("ein fremder Konflikt markiert nicht", () => {
    expect(
      pruefKonfliktLage("k1", {
        data: [konflikt({ koA: "k5", koB: "k6" })],
        isError: false,
        isLoading: false,
      }).art,
    ).toBe("keiner");
  });

  it("gescheiterte Auffrischung: die letzte Aussage bleibt und ist als nicht frisch markiert", () => {
    const lage = pruefKonfliktLage("k1", { data: [konflikt()], isError: true, isLoading: false });
    expect(lage.art).toBe("betroffen");
    expect(lage.art === "betroffen" && lage.nichtFrisch).toBe(true);
  });
});
