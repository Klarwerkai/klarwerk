// ================================================================================================
// AUFTRAG-mega32 BLOCK A + BLOCK B (bens GELB-1 und GELB-2)
// ================================================================================================
//
// A1 — Vollständigkeit wird POSITIV bewiesen, an EINER Stelle. Bis mega31 fragten drei Orte je drei
//      MERKER ab (`!capped && !aborted && skipped === 0`). Geprüft wurde NICHT, ob `selected ===
//      available` und `attempted === completed`. Ein Datensatz mit widersprüchlichen Zahlen und
//      sauberen Merkern galt damit überall als vollständig — schweigend.
//
// A2 — der Negativtest dazu: Merker sauber, Zahlen nicht ⇒ die Aussage lautet unvollständig.
//
// B  — die Buchhaltungs-Gleichung, die der `completed`-Kommentar behauptete, wird geprüft statt
//      behauptet: sie gilt nur für nicht abgebrochene Läufe; der abgebrochene hat GENAU EINE
//      Fehlstelle (den terminal abbrechenden Versuch).
//
// WARUM DIESE DATEI DREI MODULE ZUGLEICH IMPORTIERT: die Regel MUSS an drei Orten stehen, weil
// knowledge-object das Modul conflicts nicht kennen darf und apps/web keine Services importieren
// darf (Commit 1881211: genau dieser Import brach einmal den Deploy). Ein Test darf beide Grenzen
// überqueren — und nur so lässt sich beweisen, dass keiner der drei Orte SELBST entscheidet.
// Dasselbe Wächter-Muster wie beim Paritätstest der elf Entwurfs-Grenzwerte.
import { describe, expect, it } from "vitest";
import {
  aiCheckCoverageComplete,
  aiCheckCoverageNote,
} from "../../apps/web/src/lib/aiCheckStatusCard";
import { buildServices } from "../../services/app/src/build-app";
import { detectDuplicatesForKo } from "../../services/app/src/duplicate-detection";
import type { DetectionCoverage } from "../../services/conflicts";
import { isCompleteRun, mergeCoverage, singleRunBalances } from "../../services/conflicts";
import { isCompleteAiCheckCoverage } from "../../services/knowledge-object/src/coverage-complete";

// Ein VOLLSTÄNDIGER Lauf: jeder verfügbare Kandidat angesehen, jeder vorgelegte Vergleich geurteilt.
const COMPLETE: DetectionCoverage = {
  available: 4,
  selected: 4,
  alreadyOpen: 1,
  attempted: 3,
  completed: 3,
  skipped: 0,
  capped: false,
  aborted: false,
};

// ================================================================================================
// AUFTRAG-mega33 BLOCK C (nach bens ROT 2) — DER PARITÄTSWÄCHTER MUSS WIRKEN.
// ================================================================================================
//
// DER BEFUND. Die alte Fallmatrix hatte neun Zeilen, aber nur SIEBEN verschiedene Wahrheitsvektoren
// — und die Zeile `skipped > 0` senkte gleichzeitig `completed`, brach also ZWEI Bedingungen. Wäre
// `skipped === 0` an einem Spiegel weggefallen, hätte diese Zeile über `attempted !== completed`
// weiter „unvollständig" gesagt: der ganze Test bleibt grün, während die Spiegel auseinanderliegen.
// Dazu: eine künftige SECHSTE Bedingung, nur an einem Ort ergänzt, hätte keine der neun festen
// Zeilen gekippt.
//
// DIE ANTWORT. Nichts wird mehr per Hand aufgeschrieben. Die Fälle ENTSTEHEN aus der Bedingungs-
// liste (C1), und darüber hinaus läuft ein vollständiges Gitter über den Wertebereich gegen eine
// unabhängige Referenz aus derselben Liste (C2). Das Wort „erschöpfend" steht hier nicht ohne
// Zahl daneben — die Zahlen prüft der Test selbst mit.
//
// C1 — je Bedingung ein Fall, in dem GENAU DIESE EINE falsch ist und alle anderen wahr.
// C2 — kommt eine sechste Bedingung dazu und wird nur auf einer Seite ergänzt, wird der Test rot.
// C3 — die Zahlen stehen unten im „abgezählt"-Fall und im Bericht.
//
// DIE BEDINGUNGSLISTE ist die einzige Stelle, an der dieser Test die Invariante kennt. `break`
// macht GENAU EINE Bedingung falsch und lässt die anderen in Ruhe — deshalb sind die Brecher
// paarweise unabhängig (verschiedene Felder bzw. Feldpaare).
const CONDITIONS: ReadonlyArray<{
  name: string;
  holds: (c: DetectionCoverage) => boolean;
  break: (c: DetectionCoverage) => DetectionCoverage;
}> = [
  {
    name: "selected === available",
    holds: (c) => c.selected === c.available,
    break: (c) => ({ ...c, selected: c.available - 1 }),
  },
  {
    name: "attempted === completed",
    holds: (c) => c.attempted === c.completed,
    break: (c) => ({ ...c, completed: c.attempted - 1 }),
  },
  {
    // BENS ISOLIERTER VEKTOR: `skipped > 0`, während `attempted === completed` GILT. Fachlich
    // möglich, weil isCompleteRun die ZUSAMMENGEFÜHRTE Abdeckung bewertet (mergeCoverage summiert
    // skipped, nimmt bei attempted/completed das Minimum) — genau die Kombination, die die alte
    // Matrix nicht kannte.
    name: "skipped === 0",
    holds: (c) => c.skipped === 0,
    break: (c) => ({ ...c, skipped: 1 }),
  },
  { name: "!capped", holds: (c) => !c.capped, break: (c) => ({ ...c, capped: true }) },
  { name: "!aborted", holds: (c) => !c.aborted, break: (c) => ({ ...c, aborted: true }) },
];

// Die Referenz-Auslegung — ausschließlich aus der Bedingungsliste, ohne einen der drei Orte zu
// kennen. Sie ist der vierte, unabhängige Zeuge.
const referenceComplete = (c: DetectionCoverage): boolean => CONDITIONS.every((x) => x.holds(c));

// Der Wahrheitsvektor eines Datensatzes über die fünf Bedingungen — für die Abzählung.
const vectorOf = (c: DetectionCoverage): string =>
  CONDITIONS.map((x) => (x.holds(c) ? "1" : "0")).join("");

// C1/C3 — ALLE 2^5 = 32 Kombinationen, aus der Liste ERZEUGT statt geschrieben.
const GENERATED: Array<{ mask: number; coverage: DetectionCoverage; broken: string[] }> = [];
for (let mask = 0; mask < 1 << CONDITIONS.length; mask++) {
  let coverage = COMPLETE;
  const broken: string[] = [];
  CONDITIONS.forEach((cond, i) => {
    if ((mask >> i) & 1) {
      coverage = cond.break(coverage);
      broken.push(cond.name);
    }
  });
  GENERATED.push({ mask, coverage, broken });
}

// C2 — das Gitter über den Wertebereich. Jede Bedingung kann darin unabhängig kippen; eine sechste
// Bedingung über DIESELBEN acht Feldern kippt darin ebenfalls (siehe Mutationsnachweis unten).
const GRID: DetectionCoverage[] = [];
for (const available of [0, 1, 2]) {
  for (const selected of [0, 1, 2]) {
    for (const alreadyOpen of [0, 1]) {
      for (const attempted of [0, 1, 2]) {
        for (const completed of [0, 1, 2]) {
          for (const skipped of [0, 1]) {
            for (const capped of [false, true]) {
              for (const aborted of [false, true]) {
                GRID.push({
                  available,
                  selected,
                  alreadyOpen,
                  attempted,
                  completed,
                  skipped,
                  capped,
                  aborted,
                });
              }
            }
          }
        }
      }
    }
  }
}

describe("mega33 C1 · eine Invariante, drei Spiegel — jede Bedingung einzeln gebrochen", () => {
  for (const row of GENERATED) {
    const label =
      row.broken.length === 0 ? "belegt vollständig" : `gebrochen: ${row.broken.join(" + ")}`;
    it(`${label} ⇒ ${row.mask === 0 ? "vollständig" : "unvollständig"}, an ALLEN drei Orten`, () => {
      // Der Vektor ist GENAU der beabsichtigte — kein Brecher greift nebenbei in eine andere
      // Bedingung hinein (das war der Fehler der alten `skipped`-Zeile).
      CONDITIONS.forEach((cond, i) => {
        expect(cond.holds(row.coverage), cond.name).toBe(((row.mask >> i) & 1) === 0);
      });

      const complete = row.mask === 0;
      // conflicts (kanonisch)
      expect(isCompleteRun(row.coverage)).toBe(complete);
      // knowledge-object (Spiegel — trägt die Zusammenfassung des Boards)
      expect(isCompleteAiCheckCoverage(row.coverage)).toBe(complete);
      // apps/web (Spiegel — trägt Badge, Bestätigungs-Karte und KO-Detail)
      expect(aiCheckCoverageComplete(row.coverage)).toBe(complete);
      // Und die Oberfläche SCHWEIGT genau dann, wenn die Invariante hält — nie sonst.
      expect(aiCheckCoverageNote(row.coverage) === null).toBe(complete);
    });
  }

  it("ABGEZÄHLT: 5 Bedingungen, 32 erzeugte Fälle, 32 verschiedene Wahrheitsvektoren", () => {
    expect(CONDITIONS).toHaveLength(5);
    expect(GENERATED).toHaveLength(32);
    expect(new Set(GENERATED.map((g) => vectorOf(g.coverage))).size).toBe(32);
    // Fünf davon brechen GENAU EINE Bedingung — das ist die Zusage aus C1.
    expect(GENERATED.filter((g) => g.broken.length === 1)).toHaveLength(5);
  });

  it("die drei Orte stimmen auf dem GANZEN Gitter mit der Referenz überein", () => {
    expect(GRID).toHaveLength(1296);
    // Auch das Gitter realisiert alle 32 Vektoren — es ist kein Ausschnitt.
    expect(new Set(GRID.map(vectorOf)).size).toBe(32);
    for (const c of GRID) {
      const expected = referenceComplete(c);
      expect(isCompleteRun(c), JSON.stringify(c)).toBe(expected);
      expect(isCompleteAiCheckCoverage(c), JSON.stringify(c)).toBe(expected);
      expect(aiCheckCoverageComplete(c), JSON.stringify(c)).toBe(expected);
      expect(aiCheckCoverageNote(c) === null, JSON.stringify(c)).toBe(expected);
    }
  });

  // ==============================================================================================
  // DER WÄCHTER MUSS WIRKEN — und das wird hier nicht behauptet, sondern vorgeführt.
  // ==============================================================================================
  it("C1 · Verlust JEDER EINZELNEN Bedingung wird bemerkt — mit Zeugen aus dem Gitter", () => {
    CONDITIONS.forEach((cond, i) => {
      const ohne = (c: DetectionCoverage): boolean =>
        CONDITIONS.filter((_, j) => j !== i).every((x) => x.holds(c));
      const zeugen = GRID.filter((c) => ohne(c) !== referenceComplete(c));
      // Fiele diese Bedingung an einem der drei Orte weg, widerspräche dieser Ort der Referenz an
      // jedem dieser Punkte — der Test würde rot.
      expect(zeugen.length, `Verlust von „${cond.name}" bliebe unbemerkt`).toBeGreaterThan(0);
      // Und der isolierte Fall aus GENERATED ist einer dieser Zeugen.
      const isoliert = GENERATED.find((g) => g.broken.length === 1 && g.broken[0] === cond.name);
      expect(isoliert).toBeDefined();
      if (isoliert) {
        expect(ohne(isoliert.coverage), cond.name).not.toBe(referenceComplete(isoliert.coverage));
      }
    });
  });

  it("C2 · eine künftige SECHSTE Bedingung wird bemerkt, auch wenn niemand sie hier einträgt", () => {
    // Beispielhafte sechste Bedingung über denselben Feldern. Würde sie nur kanonisch ergänzt,
    // wichen kanonische Funktion und Referenz/Spiegel auf dem Gitter voneinander ab.
    for (const sechste of [
      (c: DetectionCoverage) => c.alreadyOpen === 0,
      (c: DetectionCoverage) => c.attempted + c.alreadyOpen === c.selected,
      (c: DetectionCoverage) => c.completed <= c.available,
    ]) {
      const mitSechster = (c: DetectionCoverage): boolean => referenceComplete(c) && sechste(c);
      const zeugen = GRID.filter((c) => mitSechster(c) !== referenceComplete(c));
      expect(zeugen.length).toBeGreaterThan(0);
    }
  });

  it("die Zusammenfassung leitet ausschließlich aus der Invariante ab (kein zweiter Ort)", async () => {
    const services = buildServices();
    // Ein Bestand UNTER dem Deckel: der Lauf ist echt vollständig und wird auch so gezählt.
    for (let i = 0; i < 2; i++) {
      await services.ko.create({
        title: `Kandidat ${i}`,
        statement: `verschiedene aussage nummer ${i} im betrieb`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        confidentiality: "intern",
      });
    }
    const subj = await services.ko.create({
      title: "Subjekt",
      statement: "subjekt aussage im betrieb ohne deckung",
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
    const reasoner = {
      status: () => ({ active: true, provider: "spy", mode: "model" }),
      judgeDuplicate: async () => ({
        beziehung: "verschieden" as const,
        aspects: [],
        nurInA: "",
        nurInB: "",
        empfehlung: "getrennt_lassen" as const,
        confidence: 0.9,
        begruendung: "Andere Sachverhalte.",
      }),
      judgeConflict: async () => null,
    } as unknown as ReturnType<typeof buildServices>["reasoner"];

    const coverage = await detectDuplicatesForKo(subj.id, {
      ko: services.ko,
      overlaps: services.overlaps,
      reasoner,
      settings: services.overlapSettings,
    });
    expect(isCompleteRun(coverage)).toBe(true);
    await services.ko.markAiCheckPending(subj.id);
    await services.ko.resolveAiCheck(subj.id, { ok: true, coverage }, subj.version);

    const clean = await services.ko.aiCheckCoverageSummary();
    expect(clean.incomplete).toBe(0);

    // ============================================================================================
    // A2 — DER NEGATIVTEST: MERKER SAUBER, ZAHLEN WIDERSPRÜCHLICH.
    // ============================================================================================
    // Genau der Datensatz, über den bis mega31 alle drei Orte geschwiegen haben: kein Merker steht,
    // aber ein Vergleich hat nie geurteilt (`completed < attempted`) und ein Kandidat wurde nie
    // angesehen (`selected < available`). Es ist KEIN heute erzeugbarer Zustand — und genau darum
    // geht es: der Vertrag darf nicht davon abhängen, dass ein Erzeuger den Merker setzt.
    const contradictory: DetectionCoverage = {
      ...coverage,
      available: coverage.available + 1,
      completed: Math.max(0, coverage.completed - 1),
      capped: false,
      aborted: false,
      skipped: 0,
    };
    expect(contradictory.capped).toBe(false);
    expect(contradictory.aborted).toBe(false);
    expect(contradictory.skipped).toBe(0);

    await services.ko.markAiCheckPending(subj.id);
    await services.ko.resolveAiCheck(
      subj.id,
      { ok: true, coverage: contradictory },
      (await services.ko.get(subj.id))?.version ?? subj.version,
    );
    const stored = await services.ko.get(subj.id);
    // Der Lauf meldet weiterhin „done" mit makellosen Merkern — daran ändert der Block nichts.
    expect(stored?.aiCheck?.status).toBe("done");
    expect(stored?.aiCheck?.coverage?.capped).toBe(false);

    const dirty = await services.ko.aiCheckCoverageSummary();
    // Die Zusammenfassung zählt das Objekt jetzt als unvollständig — allein wegen der Zahlen.
    expect(dirty.incomplete).toBe(1);
    expect(dirty.noCoverage).toBe(0);

    // Und die Oberfläche schweigt nicht mehr: sie benennt die Lage, ohne eine Ursache zu erfinden.
    const note = aiCheckCoverageNote(contradictory);
    expect(note).not.toBeNull();
    expect(note?.limits).toEqual(["unproven"]);
  });
});

// ================================================================================================
// B — DIE GLEICHUNG WIRD GEPRÜFT, NICHT BEHAUPTET.
// ================================================================================================
describe("mega32 B · attempted = completed + skipped gilt nur ohne Abbruch", () => {
  it("nicht abgebrochener Einzellauf: die Gleichung geht auf", () => {
    expect(singleRunBalances(COMPLETE)).toBe(true);
    expect(singleRunBalances({ ...COMPLETE, completed: 1, skipped: 2 })).toBe(true);
  });

  it("abgebrochener Einzellauf: GENAU EINE Fehlstelle — der terminal abbrechende Versuch", async () => {
    const services = buildServices();
    for (let i = 0; i < 6; i++) {
      await services.ko.create({
        title: `Kandidat ${i}`,
        statement: `verschiedene aussage nummer ${i} im betrieb`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        confidentiality: "intern",
      });
    }
    const subj = await services.ko.create({
      title: "Subjekt",
      statement: "subjekt aussage im betrieb ohne deckung",
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
    let calls = 0;
    const capacityError = Object.assign(new Error("busy"), { name: "ModelCapacityError" });
    const reasoner = {
      status: () => ({ active: true, provider: "spy", mode: "model" }),
      judgeDuplicate: async () => {
        calls += 1;
        if (calls >= 3) {
          throw capacityError;
        }
        return {
          beziehung: "verschieden" as const,
          aspects: [],
          nurInA: "",
          nurInB: "",
          empfehlung: "getrennt_lassen" as const,
          confidence: 0.9,
          begruendung: "Andere Sachverhalte.",
        };
      },
      judgeConflict: async () => null,
    } as unknown as ReturnType<typeof buildServices>["reasoner"];

    const coverage = await detectDuplicatesForKo(subj.id, {
      ko: services.ko,
      overlaps: services.overlaps,
      reasoner,
      settings: services.overlapSettings,
    });

    expect(coverage.aborted).toBe(true);
    // DER BEFUND AUS BLOCK B, an echten Zahlen: die naive Gleichung geht NICHT auf …
    expect(coverage.attempted).not.toBe(coverage.completed + coverage.skipped);
    expect(coverage.attempted).toBe(coverage.completed + coverage.skipped + 1);
    // … die eingeschränkte schon.
    expect(singleRunBalances(coverage)).toBe(true);
  });

  it("zwei Fehlstellen wären ein Zählfehler — die Gleichung merkt es", () => {
    const twoMissing: DetectionCoverage = { ...COMPLETE, attempted: 5, aborted: true };
    expect(singleRunBalances(twoMissing)).toBe(false);
  });

  it("nach mergeCoverage ist die Gleichung bedeutungslos — deshalb steht sie NICHT in isCompleteRun", () => {
    const a: DetectionCoverage = { ...COMPLETE, attempted: 3, completed: 3, skipped: 0 };
    const b: DetectionCoverage = { ...COMPLETE, attempted: 3, completed: 1, skipped: 2 };
    const merged = mergeCoverage(a, b);
    // attempted 3, completed 1, skipped 2 — hier zufällig aufgehend, aber ohne Aussagekraft:
    // die Zahlen stammen aus zwei verschiedenen Läufen. Die VOLLSTÄNDIGKEIT bleibt trotzdem
    // korrekt ableitbar, weil isCompleteRun die Gleichung gar nicht erst benutzt.
    expect(isCompleteRun(merged)).toBe(false);
    expect(isCompleteAiCheckCoverage(merged)).toBe(false);
    expect(aiCheckCoverageComplete(merged)).toBe(false);
  });
});
