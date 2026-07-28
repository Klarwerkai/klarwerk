// ================================================================================================
// AUFTRAG-mega33 BLOCK B (Pedi 27.07., nach bens ROT 1) — DER HEALTH-SCORE ZEIGT DEN SCHLECHTESTEN
// FALL.
// ================================================================================================
//
// DIE VORGABE AUS mega32 WAR FALSCH, und dieser Test hat sie überführt: „Konfliktfaktor bei
// unbelegter Erkennung nicht einrechnen" hieß in Zahlen — belegte Erkennung mit drei gefundenen
// Konflikten ergab 65, lückenhafte ohne gefundene ergab 80. Ein Abzug von NULL ist eine Annahme
// über einen unbekannten negativen Faktor; genau die Annahme, die überall sonst abgeschafft wurde.
//
// PEDIS ENTSCHEIDUNG 27.07. Bei unbelegter Erkennung rechnet die sichtbare Punktzahl mit dem
// VOLLEN Konfliktabzug — als wären alle unbekannten Konflikte vorhanden. Der optimistische Wert aus
// den bereits gefundenen Konflikten steht daneben, benannt als das, was er ist.
//
// B1  Bereits gefundene Konflikte bleiben in JEDEM Fall als sicherer Mindestabzug erhalten.
// B2  Die Spanne ist `Basis − maximaler Abzug` bis `Basis − bekannter Abzug`; groß steht die
//     SCHLECHTERE Zahl.
// B3  Das Band behauptet kein „gut", solange der Konfliktanteil unbelegt ist — es entfällt.
// B4  Die lückenhafte Lage darf NIE besser dastehen als dieselbe Lage mit belegter Erkennung.
import { describe, expect, it } from "vitest";
import type {
  AiCheckCoverageSummary,
  BusFactorEntry,
  Conflict,
  Gap,
} from "../../apps/web/src/api/types";
import {
  MAX_CONFLICT_PENALTY,
  detectionProven,
  knowledgeHealth,
} from "../../apps/web/src/lib/knowledgeHealth";
import type { HealthInput } from "../../apps/web/src/lib/knowledgeHealth";

function ko(id: string, status: "validiert" | "offen") {
  return {
    id,
    title: `KO ${id}`,
    statement: "Aussage",
    type: "best_practice",
    category: "Betrieb",
    status,
    trust: 80,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as HealthInput["kos"][number];
}

function conflict(id: string): Conflict {
  return {
    id,
    koA: "a",
    koB: "b",
    type: "truth",
    description: "Widerspruch",
    status: "offen",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Conflict;
}

function conflicts(n: number): Conflict[] {
  return Array.from({ length: n }, (_, i) => conflict(`c${i}`));
}

const NO_GAPS: readonly Gap[] = [];
const NO_BUS: readonly BusFactorEntry[] = [];

// Vier von fünf Objekten validiert ⇒ Basis 80. Kein stale, kein Single-Source, keine Lücken:
// der EINZIGE Abzug im Spiel ist der Konfliktfaktor. Damit ist jede Score-Differenz eindeutig ihm
// zuzurechnen.
function input(over: Partial<HealthInput> = {}): HealthInput {
  return {
    kos: [
      ko("k1", "validiert"),
      ko("k2", "validiert"),
      ko("k3", "validiert"),
      ko("k4", "validiert"),
      ko("k5", "offen"),
    ],
    gaps: NO_GAPS,
    conflicts: [],
    pendingRevalidation: [],
    busFactor: NO_BUS,
    ...over,
  };
}

const PROVEN: AiCheckCoverageSummary = { total: 5, incomplete: 0, unchecked: 0, noCoverage: 0 };
const LUECKENHAFT: AiCheckCoverageSummary = {
  total: 5,
  incomplete: 4,
  unchecked: 0,
  noCoverage: 0,
};

describe("mega33 B · der Health-Score zeigt den schlechtesten Fall", () => {
  it("belegte Erkennung: gefundene Konflikte kosten Punkte, Spanne fällt zusammen", () => {
    const sauber = knowledgeHealth(input({ detectionCoverage: PROVEN }));
    expect(sauber.score).toBe(80);
    expect(sauber.scoreOptimistic).toBe(80);
    expect(sauber.band).toBe("gut");

    const mitKonflikten = knowledgeHealth(
      input({ conflicts: conflicts(2), detectionCoverage: PROVEN }),
    );
    // Zwei offene Konflikte = 10 Punkte Abzug. So SOLL es sein, solange die Zahl etwas bedeutet …
    expect(mitKonflikten.score).toBe(70);
    // … und weil sie etwas bedeutet, gibt es hier keine Spanne: beide Ränder sind derselbe Wert.
    expect(mitKonflikten.scoreOptimistic).toBe(70);
    expect(mitKonflikten.conflictFactor.proven).toBe(true);
    expect(mitKonflikten.conflictFactor.reason).toBeNull();
    expect(mitKonflikten.conflictFactor.appliedPenalty).toBe(10);
  });

  it("B2 · unbelegte Erkennung: die große Zahl ist die SCHLECHTERE, die optimistische steht daneben", () => {
    const h = knowledgeHealth(input({ conflicts: [], detectionCoverage: LUECKENHAFT }));
    // Basis 80 − maximaler Konfliktabzug 20 = 60. DAS ist die sichtbare Zahl.
    expect(h.score).toBe(80 - MAX_CONFLICT_PENALTY);
    // Basis 80 − Abzug der BEKANNTEN Konflikte (0) = 80. Der optimistische Rand, benannt.
    expect(h.scoreOptimistic).toBe(80);
    expect(h.score).toBeLessThan(h.scoreOptimistic);
    expect(h.conflictFactor.proven).toBe(false);
    expect(h.conflictFactor.reason).toBe("detection-incomplete");
    expect(h.conflictFactor.knownPenalty).toBe(0);
    expect(h.conflictFactor.maxPenalty).toBe(MAX_CONFLICT_PENALTY);
    expect(h.conflictFactor.appliedPenalty).toBe(MAX_CONFLICT_PENALTY);
  });

  it("B1 · bekannte Konflikte bleiben sicherer Mindestabzug — auch im optimistischen Rand", () => {
    const h = knowledgeHealth(input({ conflicts: conflicts(3), detectionCoverage: LUECKENHAFT }));
    // Was wir KENNEN, verschwindet nicht dadurch, dass wir anderes nicht kennen: 3 × 5 = 15.
    expect(h.conflictFactor.knownPenalty).toBe(15);
    expect(h.scoreOptimistic).toBe(65);
    expect(h.score).toBe(60);

    // Und ab dem Deckel fallen beide Ränder zusammen: mehr als 20 Punkte gibt es nicht zu verlieren.
    const viele = knowledgeHealth(
      input({ conflicts: conflicts(5), detectionCoverage: LUECKENHAFT }),
    );
    expect(viele.conflictFactor.knownPenalty).toBe(MAX_CONFLICT_PENALTY);
    expect(viele.score).toBe(60);
    expect(viele.scoreOptimistic).toBe(60);
  });

  it("B4 · DIE ZUSICHERUNG: die lückenhafte Lage steht NIE besser da als die belegte", () => {
    // Der Fall, mit dem ben die alte Vorgabe überführt hat — jetzt herum:
    const gruendlich = knowledgeHealth(
      input({ conflicts: conflicts(3), detectionCoverage: PROVEN }),
    );
    const luechenhaft = knowledgeHealth(input({ conflicts: [], detectionCoverage: LUECKENHAFT }));
    expect(gruendlich.score).toBe(65);
    expect(luechenhaft.score).toBe(60);
    expect(luechenhaft.score).toBeLessThan(gruendlich.score);

    // Und das gilt nicht nur an diesem einen Punkt, sondern über den ganzen Bereich: bei GLEICHEM
    // Bestand und GLEICHEN gefundenen Konflikten kann die unbelegte Seite nie oben liegen.
    for (let n = 0; n <= 6; n++) {
      for (const unbelegt of [
        LUECKENHAFT,
        { total: 5, incomplete: 0, unchecked: 2, noCoverage: 0 },
        { total: 5, incomplete: 0, unchecked: 0, noCoverage: 1 },
        null,
        undefined,
      ] as const) {
        const belegt = knowledgeHealth(
          input({ conflicts: conflicts(n), detectionCoverage: PROVEN }),
        );
        const offen = knowledgeHealth(
          input({ conflicts: conflicts(n), detectionCoverage: unbelegt }),
        );
        expect(offen.score, `n=${n}`).toBeLessThanOrEqual(belegt.score);
        // Und der optimistische Rand der unbelegten Seite ist genau der belegte Wert — mehr
        // Optimismus als „es gibt nur die bekannten" gibt es nicht.
        expect(offen.scoreOptimistic, `n=${n}`).toBe(belegt.score);
      }
    }
  });

  it("B3 · das Band entfällt, solange der Konfliktanteil unbelegt ist", () => {
    const offen = knowledgeHealth(input({ detectionCoverage: LUECKENHAFT }));
    // Kein „gut", kein „mittel", kein „kritisch" — gar keine Einstufung, statt einer mit Fußnote.
    expect(offen.band).toBeNull();
    const belegt = knowledgeHealth(input({ detectionCoverage: PROVEN }));
    expect(belegt.band).toBe("gut");
  });

  it("KEINE AUSSAGE ist auch kein Beleg — ohne Zusammenfassung gilt der schlechteste Fall", () => {
    for (const missing of [undefined, null] as const) {
      const h = knowledgeHealth(input({ conflicts: conflicts(2), detectionCoverage: missing }));
      expect(h.score).toBe(60);
      expect(h.scoreOptimistic).toBe(70);
      expect(h.band).toBeNull();
      // Eigener Grund: „unbekannt" ist etwas anderes als „nachweislich lückenhaft", und der Leser
      // hat Anspruch darauf, das zu unterscheiden.
      expect(h.conflictFactor.reason).toBe("detection-unknown");
    }
  });

  it("die Belegfrage hat EINE Antwort: jeder der drei Lücken-Zähler genügt", () => {
    expect(detectionProven(PROVEN)).toBe(true);
    expect(detectionProven({ total: 0, incomplete: 0, unchecked: 0, noCoverage: 0 })).toBe(true);
    expect(detectionProven({ ...PROVEN, incomplete: 1 })).toBe(false);
    expect(detectionProven({ ...PROVEN, unchecked: 1 })).toBe(false);
    expect(detectionProven({ ...PROVEN, noCoverage: 1 })).toBe(false);
    expect(detectionProven(null)).toBe(false);
    expect(detectionProven(undefined)).toBe(false);
  });

  it("die übrigen Abzüge bleiben unangetastet — sie stehen in BEIDEN Rändern", () => {
    const h = knowledgeHealth(
      input({
        gaps: [
          { id: "g1", status: "offen" },
          { id: "g2", status: "offen" },
        ] as unknown as readonly Gap[],
        conflicts: conflicts(2),
        detectionCoverage: { total: 5, incomplete: 2, unchecked: 0, noCoverage: 0 },
      }),
    );
    // 80 − (2 Lücken × 4) = 72; davon schlechtester Fall −20 = 52, optimistisch −10 = 62.
    expect(h.score).toBe(52);
    expect(h.scoreOptimistic).toBe(62);
    expect(h.openConflicts).toBe(2);
  });

  it("der Konfliktfaktor bleibt in der Faktorenliste — mit der GEFUNDENEN Zahl", () => {
    const h = knowledgeHealth(input({ conflicts: conflicts(1), detectionCoverage: LUECKENHAFT }));
    const row = h.factors.find((f) => f.key === "openConflicts");
    expect(row).toBeDefined();
    expect(row?.value).toBe(1);
  });
});
