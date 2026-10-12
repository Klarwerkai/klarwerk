// produkt:20261009:referenzki-pruefdienst (REF-02, K10, Ben nacharbeit-10) — Kostenauswertung eines
// VORHANDENEN Berichts. Die Verbrauchswerte unten sind das Laufprotokoll der echten Beobachtung vom
// 12.10.2026 (HISTORIE/nacharbeit-9, Anhang beobachtung.json). Die PREISE hier sind FIKTIV (Währung
// „XTS", ISO-4217-Testcode) — sie prüfen die Rechnung, nicht den Tarif.
import { describe, expect, it } from "vitest";
import { type BerichtLauf, werteKostenAus } from "./kostenauswertung";

const M = "claude-sonnet-4-6";
function lauf(startedAt: string, ein: number | null, aus = 0, status = "success"): BerichtLauf {
  const verbrauch = ein === null ? null : { eingabeToken: ein, ausgabeToken: aus };
  return { task: "referenz", status, model: M, startedAt, versuche: [{ model: M, verbrauch }] };
}

const PROTOKOLL_20261012: BerichtLauf[] = [
  lauf("2026-10-12T12:23:55.456Z", null, 0, "error"),
  lauf("2026-10-12T12:23:53.318Z", 821, 110),
  lauf("2026-10-12T12:23:50.732Z", 792, 112),
  lauf("2026-10-12T12:23:48.175Z", 796, 121),
  lauf("2026-10-12T12:23:45.868Z", 779, 112),
  lauf("2026-10-12T12:23:43.696Z", 799, 111),
];

const FIKTIV = {
  quelle: "fiktive Testquelle",
  abgerufenAm: "2026-10-12",
  preisliste: {
    waehrung: "XTS",
    preisstand: "2026-10-12",
    modelle: { [M]: { eingabeJeMillion: 1, ausgabeJeMillion: 2 } },
  },
};

describe("REF-02 · K10 — Kosten des vorhandenen Laufs nach datierter Tarifquelle", () => {
  it("KA1 · summiert nur gemeldeten Verbrauch; der abgebrochene Versuch steht getrennt als unbekannt", () => {
    const a = werteKostenAus(PROTOKOLL_20261012, FIKTIV);
    expect(a.ok).toBe(true);
    if (!a.ok) {
      return;
    }
    expect(a.summeGemeldet.eingabeToken).toBe(3987);
    expect(a.summeGemeldet.ausgabeToken).toBe(566);
    // 3987 × 1 / 10^6 + 566 × 2 / 10^6
    expect(a.summeGemeldet.betrag).toBe(0.005119);
    expect(a.versuche).toHaveLength(5);
    expect(a.unbekannt).toEqual([
      { startedAt: "2026-10-12T12:23:55.456Z", model: M, status: "error" },
    ]);
    expect(a.vollstaendig).toBe(false);
    expect(a.waehrung).toBe("XTS");
  });

  it("KA2 · ohne datierte Herkunft oder ohne Preis für das Modell wird nicht gerechnet", () => {
    expect(werteKostenAus(PROTOKOLL_20261012, { ...FIKTIV, abgerufenAm: "" }).ok).toBe(false);
    expect(werteKostenAus(PROTOKOLL_20261012, { ...FIKTIV, quelle: " " }).ok).toBe(false);
    const ohneModell = {
      ...FIKTIV,
      preisliste: { ...FIKTIV.preisliste, modelle: { anderes: FIKTIV.preisliste.modelle[M] } },
    };
    expect(werteKostenAus(PROTOKOLL_20261012, ohneModell).ok).toBe(false);
  });
});
