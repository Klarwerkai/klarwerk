// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — DIE RECHNUNG MIT REALEN WERTEN (LWE-04, LWE-05).
// ================================================================================================
//
//   R1 · Mit vollständigen Werten rechnet die Karte EXAKT die bestehende Formel (`estimateValuation`)
//        — keine zweite Bewertung; Qualitätsfaktor (Ø-Vertrauen) bleibt.
//   R2 · Fehlende Werte oder keine validierten Objekte: kein Geldwert, sondern die Gründe.
//   R3 · Zusatzaufwand bleibt als negative Entlastung stehen.
//   R4 · Eigene Eingabe vs. angegebene Messung werden unterschieden.
//   R5 · Ohne gespeicherten Stand ist das Formular LEER — keine Beispielwerte als Eingabe.
import { describe, expect, it } from "vitest";
import type { LagebildWert, LagebildWerte } from "../../apps/web/src/api/types";
import { estimateValuation } from "../../apps/web/src/lib/knowledgeValuation";
import {
  formAusWerten,
  lagebildRechnung,
  zahlAusText,
} from "../../apps/web/src/lib/lagebildRechnung";

const eigen = (wert: number): LagebildWert => ({ wert, herkunft: "eigene_eingabe", beleg: null });
const gemessen = (wert: number): LagebildWert => ({
  wert,
  herkunft: "gemessen",
  beleg: "Zeiterfassung Q3 (erfunden)",
});

function stand(werte: Partial<LagebildWerte["werte"]>): LagebildWerte {
  return {
    bereich: "gesamt",
    zeitraumVon: "2025-07-01",
    zeitraumBis: "2025-09-30",
    werte: { hourlyRate: null, hoursSavedPerValidatedKo: null, reuseFactor: null, ...werte },
    version: 1,
    anfrageId: "anfrage-0001",
    geaendertAm: "2025-10-01T08:00:00.000Z",
    geaendertVon: "u-1",
  };
}

const fakten = (validatedKos: number, avgTrust = 80) => ({
  validatedKos,
  totalKos: validatedKos + 2,
  avgTrust,
  demoKos: 0,
});

describe("Lagebild-Rechnung", () => {
  it("R1 · vollständige Werte → genau die bestehende Formel samt Qualitätsfaktor", () => {
    const r = lagebildRechnung(
      fakten(12, 75),
      stand({
        hourlyRate: eigen(72.5),
        hoursSavedPerValidatedKo: eigen(1.5),
        reuseFactor: eigen(4),
      }),
    );
    const erwartet = estimateValuation(fakten(12, 75), {
      hourlyRate: 72.5,
      hoursSavedPerValidatedKo: 1.5,
      reuseFactor: 4,
    });
    expect(r).toMatchObject({
      zustand: "berechnet",
      estimateEur: erwartet.estimateEur,
      perKoEur: erwartet.perKoEur,
      formula: erwartet.formula,
    });
    // 12 × (72,5 × 1,5 × 4) × 0,75 = 3915
    expect(erwartet.estimateEur).toBe(3915);
  });

  it("R2 · ohne Stand, mit fehlenden Werten oder ohne validierte Objekte gibt es keinen Geldwert", () => {
    expect(lagebildRechnung(fakten(5), null)).toEqual({
      zustand: "nicht_berechenbar",
      gruende: ["keine_werte"],
    });
    expect(lagebildRechnung(fakten(5), stand({ hourlyRate: eigen(60) }))).toEqual({
      zustand: "nicht_berechenbar",
      gruende: ["fehlt_hoursSavedPerValidatedKo", "fehlt_reuseFactor"],
    });
    const vollstaendig = stand({
      hourlyRate: eigen(60),
      hoursSavedPerValidatedKo: eigen(2),
      reuseFactor: eigen(3),
    });
    // Keine Grundlage: auch kein „0 €", das wie ein Ergebnis aussähe.
    expect(lagebildRechnung(fakten(0), vollstaendig)).toEqual({
      zustand: "nicht_berechenbar",
      gruende: ["keine_validierten_objekte"],
    });
  });

  it("R3 · Zusatzaufwand ergibt eine negative Entlastung — sie wird nicht auf 0 gekappt", () => {
    const r = lagebildRechnung(
      fakten(10, 100),
      stand({
        hourlyRate: eigen(60),
        hoursSavedPerValidatedKo: eigen(-0.5),
        reuseFactor: eigen(2),
      }),
    );
    expect(r).toMatchObject({ zustand: "berechnet", estimateEur: -600, negativ: true });
  });

  it("R4 · eine einzige eigene Eingabe macht die Rechnung zur Annahme", () => {
    const alleGemessen = stand({
      hourlyRate: gemessen(60),
      hoursSavedPerValidatedKo: gemessen(2),
      reuseFactor: gemessen(3),
    });
    expect(lagebildRechnung(fakten(4), alleGemessen)).toMatchObject({ art: "angegebene_messung" });
    const gemischt = stand({ ...alleGemessen.werte, reuseFactor: eigen(3) });
    expect(lagebildRechnung(fakten(4), gemischt)).toMatchObject({ art: "eigene_annahme" });
  });

  it("R5 · ohne Stand ist das Formular leer; mit Stand trägt es die gespeicherten Angaben", () => {
    const leer = formAusWerten(null);
    expect(leer.zeitraumVon).toBe("");
    for (const f of Object.values(leer.felder)) {
      expect(f).toEqual({ wert: "", herkunft: "eigene_eingabe", beleg: "" });
    }
    const voll = formAusWerten(stand({ hourlyRate: eigen(72.5), reuseFactor: gemessen(4) }));
    expect(voll.felder.hourlyRate.wert).toBe("72,5");
    expect(voll.felder.reuseFactor).toEqual({
      wert: "4",
      herkunft: "gemessen",
      beleg: "Zeiterfassung Q3 (erfunden)",
    });
    expect(voll.zeitraumBis).toBe("2025-09-30");
  });

  it("Zahlen aus dem Formular: leer = nicht erfasst, Komma erlaubt, Text ist keine Zahl", () => {
    expect(zahlAusText("")).toBeNull();
    expect(zahlAusText(" 72,5 ")).toBe(72.5);
    expect(zahlAusText("-0.5")).toBe(-0.5);
    expect(zahlAusText("siebzig")).toBeUndefined();
    expect(zahlAusText("1e3")).toBeUndefined();
  });
});
