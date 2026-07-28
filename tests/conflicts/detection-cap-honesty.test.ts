// ================================================================================================
// AUFTRAG-mega28 BLOCK A — DER DECKEL, UND DIE EHRLICHKEIT DARÜBER.
// ================================================================================================
//
// A1: beide Live-Erkennungswege haben eine Obergrenze für die Kandidatenmenge, aus EINER Stelle,
//     und die Auswahl davor ist deterministisch und begründet.
// A2: ein gedeckelter Lauf sieht NICHT aus wie ein vollständiger — geprüfte Menge, verfügbare
//     Menge und die Tatsache der Deckelung stehen am Ergebnis.
// A3: ein wegen Kapazität abgebrochener oder teilweise übersprungener Lauf ist als unvollständig
//     erkennbar — nach derselben Regel.
import { describe, expect, it } from "vitest";
import { createAiCheckRunner } from "../../services/app/src/ai-check-worker";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import { detectConflictsForKo } from "../../services/app/src/conflict-detection";
import { DETECTION_CANDIDATE_CAP } from "../../services/app/src/detection-cap";
import { detectDuplicatesForKo } from "../../services/app/src/duplicate-detection";
import type { DetectSubject } from "../../services/conflicts";
import { isCompleteRun, mergeCoverage } from "../../services/conflicts";
import { selectCandidates } from "../../services/conflicts/src/detect";
import { selectOverlapCandidates } from "../../services/conflicts/src/duplicate-detect";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";

// AUFTRAG-mega31 A1: gültige Nicht-Treffer-URTEILE. Im Reasoner-Vertrag ist `null` ausnahmslos ein
// Fehlerausgang — „ein echtes `kein_konflikt`/`verschieden` ist ein NICHT-null-verdict". Ein
// `null`-Fixture hieße seit A1 „kein Urteil gefallen" und wäre für einen Test über abgeschlossene
// Vergleiche das falsche Instrument.
const KEIN_KONFLIKT = {
  relation: "kein_konflikt" as const,
  older: null,
  confidence: 0.9,
  begruendung: "Unterschiedlicher Geltungsbereich.",
  zitat_a: "",
  zitat_b: "",
};

const VERSCHIEDEN = {
  beziehung: "verschieden" as const,
  aspects: [],
  nurInA: "",
  nurInB: "",
  empfehlung: "getrennt_lassen" as const,
  confidence: 0.9,
  begruendung: "Andere Sachverhalte.",
};

function subject(over: Partial<DetectSubject> & { refId: string }): DetectSubject {
  return {
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    tags: [],
    category: "K",
    asset: null,
    ...over,
  };
}

// Ein Spy-Client, der gültiges Konflikt- bzw. Duplikat-JSON liefert und jeden Aufruf zählt.
function spyClient(): { client: ModelClient; conflict: () => number; duplicate: () => number } {
  let c = 0;
  let d = 0;
  const client = {
    name: "spy",
    complete: async (system: string) => {
      if (system.includes('"relation"')) {
        c += 1;
        return '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}';
      }
      d += 1;
      return '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.9,"begruendung":"ok"}';
    },
  } as unknown as ModelClient;
  return { client, conflict: () => c, duplicate: () => d };
}

async function makeKo(services: AppServices, title: string, statement: string) {
  return services.ko.create({
    title,
    statement,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    confidentiality: "intern",
  });
}

describe("mega28 A1 · der Deckel wirkt in BEIDEN Live-Wegen, aus EINER Stelle", () => {
  it("EIN Wert: Konflikt- und Duplikatweg deckeln identisch", async () => {
    const services = buildServices();
    const spy = spyClient();
    services.reasoner = new Reasoner(new ModelProvider(spy.client));

    // Deutlich MEHR Bestand als der Deckel — vor mega28 waren das 60 Konflikt- und 60 Duplikat-Urteile.
    const poolSize = DETECTION_CANDIDATE_CAP * 3;
    for (let i = 0; i < poolSize; i++) {
      await makeKo(services, `Kandidat ${i}`, `verschiedene aussage nummer ${i} im betrieb`);
    }
    const subj = await makeKo(services, "Subjekt", "subjekt aussage im betrieb ohne deckung");
    const run = createAiCheckRunner({
      ko: services.ko,
      conflicts: services.conflicts,
      overlaps: services.overlaps,
      overlapSettings: services.overlapSettings,
      reasoner: services.reasoner,
    });
    await run(subj.id);

    // Höchstens der Deckel, in BEIDEN Wegen — und nicht unbemerkt verschieden.
    expect(spy.duplicate()).toBe(DETECTION_CANDIDATE_CAP);
    expect(spy.conflict()).toBeLessThanOrEqual(DETECTION_CANDIDATE_CAP);
    // Der Konfliktweg hat zusätzlich seine fachliche Vorauswahl — er darf WENIGER prüfen, nie mehr.
    expect(spy.conflict()).toBeGreaterThan(0);
  });

  it("die Duplikat-Kandidaten sind DETERMINISTISCH gewählt: Pool-Reihenfolge ändert nichts", () => {
    const subj = subject({ refId: "s", title: "Pumpe P2", statement: "Druckverlust an Ventil V4" });
    const pool = Array.from({ length: 50 }, (_, i) =>
      subject({
        refId: `k${String(i).padStart(2, "0")}`,
        title: `Pumpe P${i}`,
        statement: `Druckverlust an Ventil V${i}`,
      }),
    );
    const forward = selectOverlapCandidates(subj, pool, DETECTION_CANDIDATE_CAP).map(
      (c) => c.refId,
    );
    const backward = selectOverlapCandidates(
      subj,
      [...pool].reverse(),
      DETECTION_CANDIDATE_CAP,
    ).map((c) => c.refId);
    expect(forward).toHaveLength(DETECTION_CANDIDATE_CAP);
    expect(backward).toEqual(forward);
  });

  it("gleicher Score ⇒ die refId entscheidet — kein Rest von Datenbank-Reihenfolge", () => {
    // Drei inhaltlich IDENTISCHE Kandidaten: ohne Stichentscheid entschiede die Pool-Ordnung.
    const subj = subject({ refId: "s", title: "T", statement: "Gleicher Text" });
    const pool = ["c", "a", "b"].map((id) =>
      subject({ refId: id, title: "T", statement: "Gleicher Text" }),
    );
    expect(selectOverlapCandidates(subj, pool, 2).map((c) => c.refId)).toEqual(["a", "b"]);
    expect(selectOverlapCandidates(subj, [...pool].reverse(), 2).map((c) => c.refId)).toEqual([
      "a",
      "b",
    ]);
    // Dieselbe Bestimmtheit im Konfliktweg (gleiche Kategorie ⇒ alle sind Nachbarn).
    expect(selectCandidates(subj, pool, 2).map((c) => c.refId)).toEqual(["a", "b"]);
    expect(selectCandidates(subj, [...pool].reverse(), 2).map((c) => c.refId)).toEqual(["a", "b"]);
  });
});

describe("mega28 A2 · ein gedeckelter Lauf liest sich NICHT wie ein vollständiger", () => {
  it("die Abdeckung nennt geprüfte Menge, verfügbare Menge UND die Deckelung", async () => {
    const services = buildServices();
    const spy = spyClient();
    services.reasoner = new Reasoner(new ModelProvider(spy.client));
    const poolSize = DETECTION_CANDIDATE_CAP + 7;
    for (let i = 0; i < poolSize; i++) {
      await makeKo(services, `Kandidat ${i}`, `verschiedene aussage nummer ${i} im betrieb`);
    }
    const subj = await makeKo(services, "Subjekt", "subjekt aussage im betrieb ohne deckung");

    const coverage = await detectDuplicatesForKo(subj.id, {
      ko: services.ko,
      overlaps: services.overlaps,
      reasoner: services.reasoner,
      settings: services.overlapSettings,
    });

    expect(coverage.available).toBe(poolSize);
    // AUFTRAG-mega29 B1: die Vorab-Auswahl heisst `selected`, die tatsaechlichen Vergleiche
    // `attempted`, die fehlerfrei beendeten `completed`. Bis mega28 musste EINE Zahl das alles sein.
    expect(coverage.selected).toBe(DETECTION_CANDIDATE_CAP);
    expect(coverage.attempted).toBe(DETECTION_CANDIDATE_CAP);
    expect(coverage.completed).toBe(DETECTION_CANDIDATE_CAP);
    expect(coverage.alreadyOpen).toBe(0);
    expect(coverage.capped).toBe(true);
    expect(coverage.aborted).toBe(false);
    expect(coverage.skipped).toBe(0);
    // Und damit ist der Lauf ausdrücklich NICHT als vollständig lesbar.
    expect(isCompleteRun(coverage)).toBe(false);
  });

  it("ein Bestand UNTER dem Deckel meldet ehrlich vollständig (kein falsches „gedeckelt“)", async () => {
    const services = buildServices();
    const spy = spyClient();
    services.reasoner = new Reasoner(new ModelProvider(spy.client));
    for (let i = 0; i < 3; i++) {
      await makeKo(services, `Kandidat ${i}`, `verschiedene aussage nummer ${i} im betrieb`);
    }
    const subj = await makeKo(services, "Subjekt", "subjekt aussage im betrieb ohne deckung");

    const coverage = await detectDuplicatesForKo(subj.id, {
      ko: services.ko,
      overlaps: services.overlaps,
      reasoner: services.reasoner,
      settings: services.overlapSettings,
    });
    expect(coverage).toEqual({
      available: 3,
      selected: 3,
      alreadyOpen: 0,
      attempted: 3,
      completed: 3,
      skipped: 0,
      capped: false,
      aborted: false,
    });
    expect(isCompleteRun(coverage)).toBe(true);
  });

  it("der aiCheck TRÄGT die Abdeckung ans KO — dort liest ein Mensch das Urteil", async () => {
    const services = buildServices();
    const spy = spyClient();
    services.reasoner = new Reasoner(new ModelProvider(spy.client));
    const poolSize = DETECTION_CANDIDATE_CAP + 5;
    for (let i = 0; i < poolSize; i++) {
      await makeKo(services, `Kandidat ${i}`, `verschiedene aussage nummer ${i} im betrieb`);
    }
    const subj = await makeKo(services, "Subjekt", "subjekt aussage im betrieb ohne deckung");
    await services.ko.markAiCheckPending(subj.id);

    const run = createAiCheckRunner({
      ko: services.ko,
      conflicts: services.conflicts,
      overlaps: services.overlaps,
      overlapSettings: services.overlapSettings,
      reasoner: services.reasoner,
    });
    const outcome = await run(subj.id);
    expect(outcome.ok).toBe(true);
    await services.ko.resolveAiCheck(
      subj.id,
      { ok: outcome.ok, ...(outcome.coverage ? { coverage: outcome.coverage } : {}) },
      subj.version,
    );

    const stored = await services.ko.get(subj.id);
    expect(stored?.aiCheck?.status).toBe("done");
    // „done" allein wäre jetzt eine Lüge — die Zahlen stehen daneben.
    expect(stored?.aiCheck?.coverage?.capped).toBe(true);
    expect(stored?.aiCheck?.coverage?.available).toBe(poolSize);
    expect(stored?.aiCheck?.coverage?.completed).toBeLessThanOrEqual(DETECTION_CANDIDATE_CAP);
  });

  it("die Zusammenfassung zweier Läufe nimmt die SCHWÄCHERE Abdeckung", () => {
    const merged = mergeCoverage(
      {
        available: 100,
        selected: 5,
        alreadyOpen: 0,
        attempted: 5,
        completed: 4,
        skipped: 1,
        capped: true,
        aborted: false,
      },
      {
        available: 100,
        selected: 20,
        alreadyOpen: 2,
        attempted: 18,
        completed: 18,
        skipped: 0,
        capped: true,
        aborted: true,
      },
    );
    expect(merged).toEqual({
      available: 100,
      selected: 5,
      alreadyOpen: 2,
      attempted: 5,
      completed: 4,
      skipped: 1,
      capped: true,
      aborted: true,
    });
  });
});

describe("mega28 A3 · Kapazitätsabbruch und übersprungene Kandidaten sind erkennbar", () => {
  it("Duplikatweg: ein Kapazitätsabbruch meldet aborted und den ehrlichen Abbruch-Stand", async () => {
    const services = buildServices();
    const poolSize = 8;
    for (let i = 0; i < poolSize; i++) {
      await makeKo(services, `Kandidat ${i}`, `verschiedene aussage nummer ${i} im betrieb`);
    }
    const subj = await makeKo(services, "Subjekt", "subjekt aussage im betrieb ohne deckung");

    // Der dritte Urteilsversuch läuft in den Rückstau (SCRUM-498 B2: ModelCapacityError wird
    // DURCHGEREICHT). Vor mega28 sah dieser Lauf aus wie ein sauberer.
    let calls = 0;
    const capacityError = Object.assign(new Error("busy"), { name: "ModelCapacityError" });
    const reasoner = {
      status: () => ({ active: true, provider: "spy", mode: "model" }),
      // mega31 A1: ein gültiges Nicht-Treffer-URTEIL (nicht `null` — das ist im Reasoner-Vertrag
      // ausnahmslos ein Fehlerausgang). Nur so belegt der Test, dass ZWEI Vergleiche wirklich zu
      // Ende liefen, bevor der dritte in den Rückstau lief.
      judgeDuplicate: async () => {
        calls += 1;
        if (calls >= 3) {
          throw capacityError;
        }
        return VERSCHIEDEN;
      },
      judgeConflict: async () => KEIN_KONFLIKT,
    } as unknown as AppServices["reasoner"];

    const coverage = await detectDuplicatesForKo(subj.id, {
      ko: services.ko,
      overlaps: services.overlaps,
      reasoner,
      settings: services.overlapSettings,
    });

    expect(coverage.aborted).toBe(true);
    expect(coverage.available).toBe(poolSize);
    // Genau die Kandidaten VOR dem Abbruch gelten als geprüft — nicht die geplante Menge.
    // mega29 B1: der abbrechende Kandidat bleibt als VERSUCHT stehen und fehlt bei „abgeschlossen".
    expect(coverage.completed).toBe(2);
    expect(coverage.attempted).toBe(3);
    expect(coverage.capped).toBe(true);
    expect(isCompleteRun(coverage)).toBe(false);
  });

  it("Konfliktweg: einzeln geschluckte Urteilsfehler erscheinen als skipped (bens JR-2)", async () => {
    const services = buildServices();
    for (let i = 0; i < 5; i++) {
      await makeKo(services, `Kandidat ${i}`, `verschiedene aussage nummer ${i} im betrieb`);
    }
    const subj = await makeKo(services, "Subjekt", "subjekt aussage im betrieb ohne deckung");

    const reasoner = {
      status: () => ({ active: true, provider: "spy", mode: "model" }),
      judgeConflict: async () => {
        throw new Error("Modell antwortete nicht verwertbar");
      },
      judgeDuplicate: async () => null,
    } as unknown as AppServices["reasoner"];

    const coverage = await detectConflictsForKo(subj.id, {
      ko: services.ko,
      conflicts: services.conflicts,
      reasoner,
    });

    // Der Lauf lief zu Ende (kein Throw) — aber JEDER Kandidat wurde ausgelassen.
    expect(coverage.aborted).toBe(false);
    expect(coverage.skipped).toBeGreaterThan(0);
    expect(coverage.skipped).toBe(coverage.attempted);
    expect(coverage.completed).toBe(0);
    expect(isCompleteRun(coverage)).toBe(false);
  });
});
