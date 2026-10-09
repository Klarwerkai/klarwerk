import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../knowledge-object";
import {
  bandForScore,
  capitalScore,
  computeSnapshot,
  house,
  maturity,
  pilot,
  priorities,
  recommendations,
  statement,
} from "./metrics";
import type { CategoryProfile } from "./profiles";
import type { BusFactorLike, MetricsInput } from "./types";

const NOW = Date.parse("2026-06-26T00:00:00Z");

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-20",
    history: [],
    ...p,
  } as KnowledgeObject;
}

function input(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    kos: [],
    openGaps: 0,
    openConflicts: 0,
    pendingRevalidation: [],
    busFactor: [],
    now: NOW,
    ...over,
  };
}

const bus = (category: string, singleSource: boolean, authorCount = 1): BusFactorLike => ({
  category,
  authorCount,
  koCount: 1,
  singleSource,
});

describe("SCRUM-120: bandForScore", () => {
  it("Schwellen 70/40", () => {
    expect(bandForScore(85)).toBe("gut");
    expect(bandForScore(55)).toBe("mittel");
    expect(bandForScore(20)).toBe("kritisch");
  });
});

describe("SCRUM-120: capitalScore", () => {
  it("leerer Bestand → Score 0, kein NaN, Gewichte summieren auf 1", () => {
    const c = capitalScore(input());
    expect(c.score).toBe(0);
    expect(Number.isNaN(c.score)).toBe(false);
    expect(c.parts.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(1, 5);
  });

  it("gesunder Bestand → hoher Score", () => {
    const c = capitalScore(
      input({
        kos: [ko({ id: "K1", trust: 90 }), ko({ id: "K2", trust: 80 })],
        busFactor: [bus("Anlage 1", false, 3)],
      }),
    );
    expect(c.score).toBeGreaterThan(70);
    expect(c.band).toBe("gut");
  });

  it("Single-Source + offene Objekte senken den Score", () => {
    const weak = capitalScore(
      input({
        kos: [ko({ id: "K1", status: "offen", trust: 30 }), ko({ id: "K2", status: "offen" })],
        busFactor: [bus("Anlage 1", true)],
        pendingRevalidation: ["K1"],
      }),
    );
    expect(weak.score).toBeLessThan(50);
  });
});

describe("SCRUM-120: statement", () => {
  it("Aktiva = validiert, Risiken summiert, Netto = übergebener Score", () => {
    const s = statement(
      input({
        kos: [ko({ id: "K1" }), ko({ id: "K2", status: "offen" })],
        busFactor: [bus("Anlage 1", true)],
        pendingRevalidation: ["K2"],
        openGaps: 2,
        openConflicts: 1,
      }),
      63,
    );
    expect(s.assets).toBe(1);
    expect(s.riskBreakdown).toEqual({
      singleSourceCategories: 1,
      stale: 1,
      openGaps: 2,
      openConflicts: 1,
    });
    expect(s.riskItems).toBe(5);
    expect(s.net).toBe(63);
  });
});

describe("SCRUM-120: maturity", () => {
  it("leerer Bestand → Stufe 0", () => {
    expect(maturity(input(), 0).stage).toBe(0);
  });
  it("hohe Validierungsquote + Mehrautor → hohe Stufe", () => {
    const kos = [ko({ id: "K1" }), ko({ id: "K2" }), ko({ id: "K3" }), ko({ id: "K4" })];
    const m = maturity(input({ kos, busFactor: [bus("Anlage 1", false, 3)] }), 90);
    expect(m.stage).toBe(5);
    expect(m.stageKey).toBe("skalieren");
    expect(m.progressPct).toBe(90);
  });
});

describe("R-0751 / FR-EXT-04: priorities — die neun Faktoren der Quelle (Nacharbeit 1)", () => {
  const QUELLE = [
    "busFactor",
    "criticality",
    "processProximity",
    "age",
    "sourceQuality",
    "conflictDensity",
    "repetition",
    "damagePotential",
    "protection",
  ];
  const mitQuelle = [{}] as KnowledgeObject["sources"];
  type Zeile = ReturnType<typeof priorities>[number];
  const faktor = (row: Zeile | undefined, k: string) =>
    row?.factors.find((f) => f.key === k)?.value;

  // Anlage 1: ein Urheber, 365 Tage alt, Vertrauen 20, ohne Quelle, streng vertraulich, im Konflikt,
  // nach Anlagenänderung zu prüfen. Anlage 2: drei Urheber, heute erfasst, Vertrauen 90, mit Quelle.
  const rows = () =>
    priorities(
      input({
        kos: [
          ko({
            id: "A1",
            category: "Anlage 1",
            trust: 20,
            sources: [],
            createdAt: "2025-06-26",
            confidentiality: "streng_vertraulich",
          }),
          ko({
            id: "B1",
            category: "Anlage 2",
            trust: 90,
            sources: mitQuelle,
            createdAt: "2026-06-26",
          }),
        ],
        busFactor: [bus("Anlage 1", true), bus("Anlage 2", false, 3)],
        pendingRevalidation: ["A1"],
        openConflictKoIds: ["A1"],
      }),
    );

  it("P1 · genau die neun Faktoren der Quelle, in ihrer Reihenfolge — keine Ersatzgrößen", () => {
    for (const row of rows()) {
      expect(row.factors.map((f) => f.key)).toEqual(QUELLE);
    }
  });

  it("P2 · ohne Eingangsdaten bleibt ein Faktor null und zählt nicht in den Score", () => {
    const [a1] = rows();
    for (const k of ["criticality", "processProximity", "repetition", "damagePotential"]) {
      expect(faktor(a1, k), k).toBeNull();
    }
    expect(a1?.knownFactors).toBe(5);
  });

  it("P3 · Werte aus nachvollziehbaren Eingangsdaten; Score = Mittel der bekannten Faktoren; gerankt", () => {
    const [a1, b1] = rows();
    expect(a1?.category).toBe("Anlage 1");
    expect(faktor(a1, "busFactor")).toBe(100);
    expect(faktor(a1, "age")).toBe(50); // 365 von 730 Tagen
    expect(faktor(a1, "sourceQuality")).toBe(90); // (100 − 20 + 100 % ohne Quelle) / 2
    expect(faktor(a1, "conflictDensity")).toBe(100);
    expect(faktor(a1, "protection")).toBe(100);
    expect(a1?.score).toBe(88); // (100 + 50 + 90 + 100 + 100) / 5
    expect(b1?.category).toBe("Anlage 2");
    expect(faktor(b1, "busFactor")).toBe(33);
    expect(faktor(b1, "sourceQuality")).toBe(5);
    expect(b1?.score).toBe(8); // (33 + 0 + 5 + 0 + 0) / 5 = 7,6
  });

  it("P4 · Flags für die Filter der Quelle: Bus-Faktor 1, veraltet, hoher Schutzwert — Gegenprobe ohne", () => {
    const [a1, b1] = rows();
    expect(a1?.flags).toEqual(["busFactorOne", "stale", "highProtection"]);
    expect(b1?.flags).toEqual([]);
  });

  it("P5 · fehlt der Konflikt-Eingang oder der Bus-Faktor der Kategorie, wird nicht geschätzt", () => {
    const [nur] = priorities(input({ kos: [ko({ id: "X1", category: "Ohne Busfaktor" })] }));
    expect(faktor(nur, "conflictDensity")).toBeNull();
    expect(faktor(nur, "busFactor")).toBeNull();
    expect(nur?.flags).not.toContain("busFactorOne");
    expect(nur?.knownFactors).toBe(3); // Alter, Quellenqualität, Schutzwert
  });

  it("P6 (Nacharbeit 3) · gepflegtes Bereichsprofil speist die vier übrigen Faktoren — alle neun zählen", () => {
    const profil = (category: string, stufen: Partial<CategoryProfile>): CategoryProfile => ({
      category,
      managerId: null,
      criticality: null,
      processProximity: null,
      repetition: null,
      damagePotential: null,
      updatedAt: "2026-06-26T00:00:00.000Z",
      updatedBy: "admin",
      ...stufen,
    });
    const [a1, b1] = priorities(
      input({
        kos: [
          ko({
            id: "A1",
            category: "Anlage 1",
            trust: 20,
            sources: [],
            createdAt: "2025-06-26",
            confidentiality: "streng_vertraulich",
          }),
          ko({ id: "B1", category: "Anlage 2", trust: 90, sources: mitQuelle }),
        ],
        busFactor: [bus("Anlage 1", true), bus("Anlage 2", false, 3)],
        openConflictKoIds: ["A1"],
        categoryProfiles: [
          profil("Anlage 1", {
            criticality: "hoch",
            processProximity: "mittel",
            repetition: "hoch",
            damagePotential: "niedrig",
          }),
          // Gegenprobe: nur eine Stufe gesetzt — die übrigen drei bleiben ohne Daten.
          profil("Anlage 2", { criticality: "mittel" }),
        ],
      }),
    );
    expect(faktor(a1, "criticality")).toBe(100);
    expect(faktor(a1, "processProximity")).toBe(50);
    expect(faktor(a1, "repetition")).toBe(100);
    expect(faktor(a1, "damagePotential")).toBe(0); // niedrig ist ein Wert, nicht „keine Daten"
    expect(a1?.knownFactors).toBe(9);
    // (100 + 100 + 50 + 50 + 90 + 100 + 100 + 0 + 100) / 9 = 76,7
    expect(a1?.score).toBe(77);
    expect(faktor(b1, "criticality")).toBe(50);
    expect(faktor(b1, "processProximity")).toBeNull();
    expect(faktor(b1, "repetition")).toBeNull();
    expect(faktor(b1, "damagePotential")).toBeNull();
    // Filter und Flags bleiben unberührt.
    expect(a1?.flags).toEqual(["busFactorOne", "highProtection"]);
  });
});

describe("SCRUM-120: recommendations", () => {
  it("leitet Empfehlungen aus echten Defiziten ab und sortiert nach Anzahl", () => {
    const recs = recommendations(
      input({
        kos: [ko({ id: "K1", status: "offen" }), ko({ id: "K2", status: "offen" })],
        busFactor: [bus("Anlage 1", true), bus("Anlage 2", true)],
        pendingRevalidation: ["K1"],
        openGaps: 4,
        openConflicts: 1,
      }),
    );
    const keys = recs.map((r) => r.key);
    expect(keys).toContain("secureSingleSource");
    expect(keys).toContain("resolveConflicts");
    expect(recs.find((r) => r.key === "secureSingleSource")?.severity).toBe("hoch");
    expect(recs).toEqual([...recs].sort((a, b) => b.count - a.count));
  });

  it("sauberer Bestand → keine Empfehlungen", () => {
    expect(recommendations(input({ kos: [ko({ id: "K1" })] }))).toEqual([]);
  });
});

describe("SCRUM-120: house + pilot", () => {
  it("house markiert fragile Domänen", () => {
    const rows = house(
      input({
        kos: [
          ko({ id: "A1", domain: "Instandhaltung", status: "offen", originalAuthor: "a" }),
          ko({ id: "A2", domain: "Instandhaltung", status: "offen", originalAuthor: "b" }),
          ko({ id: "B1", domain: "Qualität", originalAuthor: "a" }),
          ko({ id: "B2", domain: "Qualität", originalAuthor: "b" }),
        ],
      }),
    );
    expect(rows.find((r) => r.domain === "Instandhaltung")?.fragile).toBe(true);
    expect(rows.find((r) => r.domain === "Qualität")?.fragile).toBe(false);
  });

  it("R-0768 · je Fachgebiet ein Stockwerk mit Füllgrad, Urhebern und Importzahl", () => {
    const rows = house(
      input({
        kos: [
          // Gleiche Kategorie, verschiedene Fachgebiete: das Fachgebiet bestimmt das Stockwerk.
          ko({ id: "M1", domain: "Montage", category: "Anlage 1", originalAuthor: "a" }),
          ko({ id: "M2", domain: "Montage", category: "Anlage 1", originalAuthor: "b" }),
          ko({
            id: "M3",
            domain: "Montage",
            category: "Anlage 2",
            status: "offen",
            originalAuthor: "b",
            importedVia: "library_import",
          }),
          ko({ id: "E1", domain: "Einkauf", category: "Anlage 1", originalAuthor: "c" }),
          // Ohne Fachgebiet: nicht aus der Kategorie abgeleitet, eigenes Stockwerk, immer zuletzt.
          ko({ id: "X1", category: "Anlage 1", originalAuthor: "a", origin: "import" }),
          ko({ id: "X2", category: "Anlage 1", domain: "  ", originalAuthor: "b" }),
          ko({ id: "X3", category: "Anlage 1", originalAuthor: "c" }),
        ],
      }),
    );
    expect(rows.map((r) => r.domain)).toEqual(["Montage", "Einkauf", null]);
    expect(rows[0]).toEqual({
      domain: "Montage",
      koCount: 3,
      validated: 2,
      validatedRatio: 67,
      authorCount: 2,
      singleSource: false,
      fragile: false,
      imported: 1,
    });
    // Ein Urheber allein macht das Stockwerk fragil, auch wenn alles validiert ist.
    expect(rows[1]).toMatchObject({ validatedRatio: 100, singleSource: true, fragile: true });
    expect(rows[2]).toMatchObject({ koCount: 3, imported: 1, fragile: false });
  });

  it("R-0768 · Import → Haus → Ausgabe zählt über demselben Bestand", () => {
    const snap = computeSnapshot(
      input({
        kos: [
          ko({ id: "I1", domain: "Montage", importedVia: "import_candidate" }),
          ko({ id: "I2", domain: "Montage", origin: "import", status: "offen" }),
          ko({ id: "F1", domain: "Montage", originalAuthor: "b" }),
          ko({ id: "F2", domain: "Einkauf", status: "offen" }),
        ],
      }),
    );
    expect(snap.houseFlow).toEqual({
      imported: 2,
      importedValidated: 1,
      inHouse: 4,
      secured: 2,
      floors: 2,
      fragileFloors: 1,
      outputReady: 2,
    });
    // Gegenprobe: leerer Bestand → alles 0, kein NaN.
    expect(computeSnapshot(input()).houseFlow).toEqual({
      imported: 0,
      importedValidated: 0,
      inHouse: 0,
      secured: 0,
      floors: 0,
      fragileFloors: 0,
      outputReady: 0,
    });
  });

  it("pilot zählt nur Objekte innerhalb des Fensters", () => {
    const p = pilot(
      input({
        kos: [
          ko({ id: "neu", createdAt: "2026-06-20" }), // < 30 Tage
          ko({ id: "alt", createdAt: "2026-01-01" }), // > 90 Tage
        ],
      }),
    );
    expect(p.map((w) => w.days)).toEqual([30, 60, 90]);
    expect(p[0]?.created).toBe(1);
    expect(p[2]?.validated).toBe(1);
  });
});

describe("SCRUM-120: computeSnapshot", () => {
  it("baut alle Abschnitte zusammen", () => {
    const snap = computeSnapshot(
      input({ kos: [ko({ id: "K1" })], busFactor: [bus("Anlage 1", false)] }),
    );
    expect(snap.overview.totalKos).toBe(1);
    expect(snap.capital.parts).toHaveLength(5);
    expect(snap.pilot).toHaveLength(3);
    expect(snap.valuationFacts.validatedKos).toBe(1);
  });
});
