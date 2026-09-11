// ================================================================================================
// JOB 3469 · REVIEW26 — DIESELBE DOPPELUNG, ZWEI PROZENTZAHLEN, EIN NAME JE ZAHL.
// ================================================================================================
//
// DER GEMELDETE BEFUND (NUTZERBEFUNDE-AN-CLAUDE-20260908.md:133-141):
//
//     Brett „Duplikate"      95 % gleich
//     Read-only Vergleich    26 % gleich          ← dasselbe Paar, dieselbe Beschriftung
//
// Beide Zahlen waren RICHTIG. Das Brett führte bei einem echten Modellfund die Modell-Sicherheit
// (`detector.confidence` = 0,95), die Vergleichsseite führt immer die deterministische Textdeckung
// (`detector.lexicalScore` = 0,26). Was fehlte, war der NAME der Zahl — unter derselben
// Beschriftung „gleich" lesen sich zwei Messungen wie ein Widerspruch.
//
// DIESE DATEI IST DER WÄCHTER DAGEGEN (Lieferung 6). Sie erhebt für DASSELBE Paar die führende
// Zahl BEIDER Flächen samt ihrem Metrik-Schlüssel und wird rot, sobald zwei verschiedene Zahlen
// denselben Schlüssel tragen. Geprüft wird der i18n-SCHLÜSSEL, nicht der deutsche Wortlaut: eine
// Übersetzung darf sich ändern, die Zuordnung Zahl → Metrik nicht.
//
// WAS SIE AUSDRÜCKLICH NICHT PRÜFT: dass die Zahlen gleich werden. Sie bleiben verschieden — das
// ist keine Panne, sondern zwei Messungen. Fall G nagelt deshalb fest, dass sich KEINE Zahl
// geändert hat (vollständiger `toEqual`-Vergleich statt Aufzählung einzelner Felder, Lehre aus
// JOB 3450 vom 10.09.).
import { describe, expect, it } from "vitest";
import type { OverlapEntry } from "../../apps/web/src/api/types";
import { LEAD_METRIC_TEXT, overlapDetectorInfo } from "../../apps/web/src/lib/duplicateBoard";
import {
  COMPARE_OVERALL_KO_MISSING,
  compareHeadline,
  overallFromOverlap,
  overlapLeadBridge,
} from "../../apps/web/src/lib/duplicateCompare";
import { alleSprachbestaende } from "../support/i18nBestand";

function eintrag(overrides: Partial<OverlapEntry> = {}): OverlapEntry {
  return {
    id: "review26-1",
    koA: "ko-a",
    koB: "ko-b",
    relation: "identisch",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren_pruefen",
    status: "offen",
    pairKey: "dup|ko-a|ko-b",
    origin: "auto",
    createdAt: "2026-09-08T09:00:00.000Z",
    ...overrides,
  };
}

/** Der gemeldete Fall: Modellfund mit Sicherheit 0,95 auf einem Text mit Deckung 0,26. */
const REIFEN_PAAR = eintrag({
  detector: {
    trigger: "validation",
    method: "model",
    lexicalScore: 0.26,
    confidence: 0.95,
    rationale: "Gleiche Reifenaussage, anders formuliert.",
    modelLabel: "anthropic:test",
  },
});

/**
 * Was ein Mensch nacheinander liest: die führende Zahl des Bretts und die der Vergleichsseite,
 * jede mit dem Schlüssel ihrer Beschriftung. Bewusst EINE Erhebung für beide Flächen — der Befund
 * entsteht ja erst aus dem Nebeneinander.
 */
function beideFlaechen(entry: OverlapEntry): {
  brett: { zahl: number; schluessel: string } | null;
  vergleich: { zahl: number; schluessel: string | null };
} {
  const info = overlapDetectorInfo(entry);
  // Sections bewusst leer: mit vorhandenem `detector` speist sich die führende Zahl allein aus ihm,
  // und die Erhebung bleibt frei von Heuristik-Rauschen (Fall C prüft den Weg OHNE detector).
  const kopf = compareHeadline(overallFromOverlap(entry, []));
  return {
    brett: info ? { zahl: info.leadPercent, schluessel: info.leadTextKey } : null,
    vergleich: { zahl: kopf.leadPercent, schluessel: kopf.leadTextKey },
  };
}

describe("JOB 3469 · REVIEW26 · A — der gemeldete Fall: zwei Zahlen, zwei Namen", () => {
  it("Brett führt 95 % Modell-Sicherheit, Vergleich 26 % Textdeckung", () => {
    const { brett, vergleich } = beideFlaechen(REIFEN_PAAR);
    expect(brett).toEqual({ zahl: 95, schluessel: LEAD_METRIC_TEXT.modelConfidence });
    expect(vergleich).toEqual({ zahl: 26, schluessel: LEAD_METRIC_TEXT.textOverlap });
  });

  // DER EIGENTLICHE WÄCHTER: verschiedene Zahlen dürfen nie denselben Namen tragen.
  it("verschiedene Zahlen tragen nie denselben Metrik-Schlüssel", () => {
    const { brett, vergleich } = beideFlaechen(REIFEN_PAAR);
    expect(brett).not.toBeNull();
    if (brett && brett.zahl !== vergleich.zahl) {
      expect(brett.schluessel).not.toBe(vergleich.schluessel);
    }
    // …und die Gegenrichtung: gleiche Namen verlangen gleiche Zahlen (Fall B belegt sie).
    if (brett && brett.schluessel === vergleich.schluessel) {
      expect(brett.zahl).toBe(vergleich.zahl);
    }
  });

  it("der Brückensatz nennt beide Zahlen mit ihrer jeweiligen Metrik", () => {
    const gesamt = overallFromOverlap(REIFEN_PAAR, []);
    expect(overlapLeadBridge(REIFEN_PAAR, gesamt)).toEqual({
      messageKey: "dcmp.metricBridge",
      boardMetric: "modelConfidence",
      boardPercent: 95,
      boardLeadKey: LEAD_METRIC_TEXT.modelConfidence,
      compareMetric: "textOverlap",
      comparePercent: 26,
      compareLeadKey: LEAD_METRIC_TEXT.textOverlap,
    });
  });
});

describe("JOB 3469 · REVIEW26 · B — Modellfund OHNE Sicherheit: eine Zahl, ein Name", () => {
  const ohneKonfidenz = eintrag({
    detector: { trigger: "validation", method: "model", lexicalScore: 0.26 },
  });

  it("beide Flächen führen dieselbe Zahl und denselben Metrik-Schlüssel", () => {
    const { brett, vergleich } = beideFlaechen(ohneKonfidenz);
    expect(brett).toEqual({ zahl: 26, schluessel: LEAD_METRIC_TEXT.textOverlap });
    expect(vergleich).toEqual({ zahl: 26, schluessel: LEAD_METRIC_TEXT.textOverlap });
  });

  // SCRUM-486 E bleibt gültig: ohne `confidence` wird keine Modell-Sicherheit behauptet — und
  // deshalb gibt es auch nichts zu überbrücken.
  it("kein Brückensatz, weil es keinen Sprung gibt", () => {
    expect(overlapLeadBridge(ohneKonfidenz, overallFromOverlap(ohneKonfidenz, []))).toBeNull();
  });
});

describe("JOB 3469 · REVIEW26 · C — ohne detector wird keine Zahl und keine Metrik behauptet", () => {
  const handdaten = eintrag();

  it("das Brett zeigt weiterhin nichts (kein Fake-Prozent, keine Metrik)", () => {
    expect(overlapDetectorInfo(handdaten)).toBeNull();
  });

  it("die Vergleichsseite führt den Abschnittsdurchschnitt mit seinem eigenen Namen", () => {
    const gesamt = overallFromOverlap(handdaten, []);
    expect(gesamt.matchMetric).toBe("sectionAverage");
    expect(gesamt.matchLeadKey).toBe(LEAD_METRIC_TEXT.sectionAverage);
    // Der ehrliche Hinweis bleibt unangetastet: die Zahl ist keine Detektormessung.
    expect(gesamt.note).toBe("dcmp.note.noScore");
    expect(gesamt.source).toBe("heuristic");
  });

  it("kein Brückensatz ohne Brettwert", () => {
    expect(overlapLeadBridge(handdaten, overallFromOverlap(handdaten, []))).toBeNull();
  });

  // Fehlt ein Wissensobjekt, gibt es überhaupt keine Grundlage — dann wird auch keine Metrik
  // benannt, statt eine zu erfinden.
  it("fehlendes Wissensobjekt: keine Metrik, kein Name", () => {
    expect(COMPARE_OVERALL_KO_MISSING.matchMetric).toBeNull();
    expect(COMPARE_OVERALL_KO_MISSING.matchLeadKey).toBeNull();
    expect(compareHeadline(COMPARE_OVERALL_KO_MISSING).leadTextKey).toBeNull();
  });
});

describe("JOB 3469 · REVIEW26 · F — DE, EN und NL sind vorhanden und verschieden", () => {
  const bestaende = alleSprachbestaende();
  const NEUE_SCHLUESSEL = [
    LEAD_METRIC_TEXT.modelConfidence,
    LEAD_METRIC_TEXT.textOverlap,
    LEAD_METRIC_TEXT.sectionAverage,
    "dcmp.metricBridge",
  ];

  for (const schluessel of NEUE_SCHLUESSEL) {
    it(`„${schluessel}“ steht in allen drei Sprachen und ist paarweise verschieden`, () => {
      const werte = ["de", "en", "nl"].map((sprache) => bestaende[sprache]?.[schluessel] ?? "");
      for (const wert of werte) {
        expect(wert.length).toBeGreaterThan(0);
      }
      expect(
        new Set(werte).size,
        `DE/EN/NL sind nicht paarweise verschieden: ${werte.join(" | ")}`,
      ).toBe(3);
    });
  }

  // Die Metriknamen müssen sich auch UNTEREINANDER unterscheiden — drei Schlüssel mit demselben
  // Wort wären derselbe Befund in neuem Gewand.
  it("die drei Metriknamen unterscheiden sich je Sprache voneinander", () => {
    for (const sprache of ["de", "en", "nl"]) {
      const werte = [
        LEAD_METRIC_TEXT.modelConfidence,
        LEAD_METRIC_TEXT.textOverlap,
        LEAD_METRIC_TEXT.sectionAverage,
      ].map((schluessel) => bestaende[sprache]?.[schluessel] ?? "");
      expect(new Set(werte).size, `${sprache}: ${werte.join(" | ")}`).toBe(3);
    }
  });

  // Die abgelöste Beschriftung ist WEG, nicht danebengelegt (Regel „Ehrlichkeit vor Optik").
  it("die alte Sammelbeschriftung „NN % gleich“ existiert in keiner Sprache mehr", () => {
    for (const sprache of ["de", "en", "nl"]) {
      expect(bestaende[sprache]?.["dup.samePercent"]).toBeUndefined();
    }
  });

  // Die übrigen Fälle vergleichen SYMBOLISCH gegen `LEAD_METRIC_TEXT.*`; ein vertippter Wert bliebe
  // dort unbemerkt, weil Erwartung und Wirklichkeit aus derselben Quelle stammen. Deshalb hier
  // einmal die Zuordnung wörtlich, vollständig — sie ist der Vertrag zwischen Lib und i18n.
  it("LEAD_METRIC_TEXT bildet jede Metrik auf ihren Schlüssel ab", () => {
    expect(LEAD_METRIC_TEXT).toEqual({
      modelConfidence: "dup.lead.modelConfidence",
      textOverlap: "dup.lead.textOverlap",
      sectionAverage: "dup.lead.sectionAverage",
    });
  });
});

describe("JOB 3469 · REVIEW26 · G — es wurde benannt, nicht gerechnet", () => {
  // VOLLSTÄNDIGER Vergleich statt Aufzählung einzelner Felder: ein still hinzugefügtes Feld oder
  // eine geänderte Zahl wird sofort rot (Lehre JOB 3450 vom 10.09.).
  it("overlapDetectorInfo liefert für das feste Paar genau diese Werte", () => {
    expect(overlapDetectorInfo(REIFEN_PAAR)).toEqual({
      methodLabelKey: "dup.method.model",
      overlapPercent: 26,
      isModelFinding: true,
      leadMetric: "modelConfidence",
      leadPercent: 95,
      leadTextKey: "dup.lead.modelConfidence",
      confidencePercent: 95,
      rationale: "Gleiche Reifenaussage, anders formuliert.",
      modelLabel: "anthropic:test",
    });
  });

  it("overallFromOverlap liefert für das feste Paar genau diese Werte", () => {
    expect(overallFromOverlap(REIFEN_PAAR, [])).toEqual({
      match: 26,
      conflict: 0,
      // 1 − 0,95: die Modell-Sicherheit fliesst wie bisher NUR in die Unsicherheit ein.
      uncertainty: 5,
      source: "mixed",
      note: "dcmp.note.mixedOverlap",
      matchMetric: "textOverlap",
      matchLeadKey: "dup.lead.textOverlap",
    });
  });

  it("compareHeadline liefert für das feste Paar genau diese Werte", () => {
    expect(compareHeadline(overallFromOverlap(REIFEN_PAAR, []))).toEqual({
      leadPercent: 26,
      differencePercent: 0,
      uncertaintyPercent: 5,
      leadMetric: "textOverlap",
      leadTextKey: "dup.lead.textOverlap",
    });
  });

  // Die Abschnittswerte speisen weiterhin `conflict`; die führende Zahl und die Unsicherheit
  // kommen unverändert aus dem Detektor. Belegt, dass die Benennung nichts umgeleitet hat.
  it("mit Abschnitten bleiben führende Zahl und Unsicherheit dieselben", () => {
    const abschnitte = [
      {
        key: "k",
        label: "Titel",
        leftValue: "a",
        rightValue: "b",
        metrics: {
          match: 10,
          conflict: 60,
          uncertainty: 30,
          source: "heuristic" as const,
          note: "dcmp.note.heuristic",
        },
        tone: "red" as const,
        reason: "dcmp.reason.strongDiff",
      },
    ];
    const gesamt = overallFromOverlap(REIFEN_PAAR, abschnitte);
    expect(gesamt.match).toBe(26);
    expect(gesamt.uncertainty).toBe(5);
    expect(gesamt.conflict).toBe(60);
    expect(gesamt.matchLeadKey).toBe("dup.lead.textOverlap");
  });
});
