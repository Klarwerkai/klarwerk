// ================================================================================================
// AUFTRAG-mega29 BLOCK B (bens M28-2) — DIE ZAHL IM EHRLICHEN SATZ WAR SELBST NICHT EHRLICH.
// ================================================================================================
//
// DER VERTRAG sagte: `examined` seien die Kandidaten, die dem Urteil TATSÄCHLICH vorgelegt wurden.
// Die Oberfläche sagte „geprüft gegen X von Y". GESETZT wurde die Zahl aber VOR der Schleife auf die
// gesamte Auswahl — während in der Schleife bereits offene Paare ohne neuen Vergleich übersprungen
// wurden. Zwanzig Ausgewählte mit fünf offenen Befunden ergaben `examined=20` bei fünfzehn Vergleichen.
//
// UND DARAN HING DER SCHWERERE FEHLER: ein bereits offenes Paar VERBRAUCHTE einen der zwanzig Plätze.
// Der Deckel war damit enger als zwanzig, und weggeschnitten wurde ausgerechnet der noch ungeprüfte
// Rang 21. Das ist kein Zählfehler, das ist eine Verengung der tatsächlichen Prüfung.
//
// Diese Datei nagelt die getrennten Begriffe fest (B1) und beweist, dass ein offenes Paar KEINEN
// Deckelplatz mehr verbraucht (B2) — in BEIDEN Erkennungswegen.
import { describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import type { AppServices } from "../../services/app/src/build-app";
import { detectConflictsForKo } from "../../services/app/src/conflict-detection";
import { detectDuplicatesForKo } from "../../services/app/src/duplicate-detection";
import type { DetectSubject } from "../../services/conflicts";
import { emptyCoverage, isCompleteRun, mergeCoverage } from "../../services/conflicts";

const CAP = 3;

// ================================================================================================
// AUFTRAG-mega31 A1 — WARUM DIESE FIXTURES KEIN `null` MEHR ZURÜCKGEBEN.
// ================================================================================================
// Diese Tests belegen die DECKEL-Mechanik (was verbraucht einen Prüfplatz?). Dafür brauchen sie ein
// Modell, das URTEILT — sie gaben aber `null` zurück. Im echten Reasoner gibt es das nicht: „verdict
// null OHNE failure gibt es nicht (ein echtes `kein_konflikt`/`verschieden` ist ein NICHT-null-
// verdict)", services/reasoner/src/types.ts. `null` ist ausnahmslos ein Fehlerausgang.
//
// Seit A1 zählt nur ein gültiges Urteil als abgeschlossener Vergleich. Ein `null`-Fixture hieße
// jetzt „kein Modell" — und die Aussagen dieser Tests über `completed` wären Aussagen über einen
// Ausfall statt über den Deckel. Die Fixtures liefern deshalb echte Nicht-Treffer-URTEILE; die
// Erwartungen der Tests bleiben damit unverändert richtig.
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
    title: "Pumpe P2",
    statement: "Druckverlust an Ventil V4",
    conditions: [],
    measures: [],
    tags: [],
    category: "Betrieb",
    asset: null,
    ...over,
  };
}

// Sechs INHALTSGLEICHE Kandidaten: gleicher Score in beiden Wegen ⇒ die Reihenfolge entsteht allein
// aus dem refId-Stichentscheid (k0 … k5). Damit ist exakt vorhersagbar, WER unter den Deckel fällt —
// und die Aussage über den Deckelplatz hängt an keiner Textheuristik.
function twins(n: number): DetectSubject[] {
  return Array.from({ length: n }, (_, i) => subject({ refId: `k${i}` }));
}

describe("mega29 B2 · ein bereits offenes Paar verbraucht KEINEN Platz unter dem Deckel", () => {
  it("Duplikatweg: der Deckel begrenzt, was GEPRÜFT wird — nicht, was übersprungen wird", async () => {
    const services = buildServices();
    const subj = subject({ refId: "s" });
    const pool = twins(6);

    // Zu den beiden ranghöchsten Paaren steht bereits ein OFFENER Befund. Vor mega29 haben genau
    // diese beiden zwei der drei Deckelplätze verbraucht — geprüft wurde am Ende ein einziger.
    for (const refId of ["k0", "k1"]) {
      await services.overlaps.createAuto(
        {
          koA: "s",
          koB: refId,
          relation: "identisch",
          aspects: [],
          eigenanteilA: "",
          eigenanteilB: "",
          recommendation: "zusammenfuehren",
        },
        { trigger: "validation", method: "deterministic", lexicalScore: 1 },
      );
    }

    const judged: string[] = [];
    const coverage = emptyCoverage();
    await services.overlaps.detectForSubject(
      subj,
      pool,
      async (_a, b) => {
        // Der Kerntext trägt den Titel — daraus lässt sich der Kandidat nicht ableiten (alle gleich).
        // Deshalb zählt der Test die Aufrufe und liest die Zuordnung aus der Abdeckung.
        judged.push(b);
        return VERSCHIEDEN;
      },
      { cap: CAP, coverage },
    );

    // DREI Vergleiche — der Deckel ist voll ausgeschöpft, obwohl zwei Paare übersprungen wurden.
    expect(judged).toHaveLength(CAP);
    expect(coverage.attempted).toBe(CAP);
    expect(coverage.completed).toBe(CAP);
    expect(coverage.alreadyOpen).toBe(2);
    // Angesehen wurden fünf Ränge (zwei übersprungen + drei geprüft); k5 blieb ungeprüft.
    expect(coverage.selected).toBe(5);
    expect(coverage.available).toBe(6);
    expect(coverage.capped).toBe(true);
    expect(coverage.skipped).toBe(0);
    expect(coverage.aborted).toBe(false);
    expect(isCompleteRun(coverage)).toBe(false);
  });

  it("Konfliktweg: dieselbe Regel, derselbe Beleg", async () => {
    const services = buildServices();
    const subj = subject({ refId: "s" });
    const pool = twins(6);

    for (const refId of ["k0", "k1"]) {
      await services.conflicts.create({
        koA: "s",
        koB: refId,
        type: "truth",
        description: "Bestehender offener Befund",
      });
    }

    let judged = 0;
    const coverage = emptyCoverage();
    await services.conflicts.detectForSubject(
      subj,
      pool,
      async () => {
        judged += 1;
        return KEIN_KONFLIKT;
      },
      { cap: CAP, coverage },
    );

    expect(judged).toBe(CAP);
    expect(coverage.attempted).toBe(CAP);
    expect(coverage.completed).toBe(CAP);
    expect(coverage.alreadyOpen).toBe(2);
    expect(coverage.selected).toBe(5);
    expect(coverage.available).toBe(6);
    expect(coverage.capped).toBe(true);
  });

  it("ohne offene Paare bleibt alles wie gehabt — kein neuer Deckel-Effekt", async () => {
    const services = buildServices();
    const coverage = emptyCoverage();
    await services.overlaps.detectForSubject(
      subject({ refId: "s" }),
      twins(6),
      async () => VERSCHIEDEN,
      { cap: CAP, coverage },
    );
    expect(coverage).toEqual({
      available: 6,
      selected: CAP,
      alreadyOpen: 0,
      attempted: CAP,
      completed: CAP,
      skipped: 0,
      capped: true,
      aborted: false,
    });
  });
});

describe("mega29 B1 · versucht, abgeschlossen und übersprungen sind DREI verschiedene Zahlen", () => {
  it("Konfliktweg: jeder Urteilsfehler wird versucht, keiner abgeschlossen", async () => {
    const services = buildServices();
    const coverage = emptyCoverage();
    await services.conflicts.detectForSubject(
      subject({ refId: "s" }),
      twins(3),
      async () => {
        throw new Error("Modell antwortete nicht verwertbar");
      },
      { cap: CAP, coverage },
    );

    expect(coverage.attempted).toBe(3);
    expect(coverage.skipped).toBe(3);
    expect(coverage.completed).toBe(0);
    expect(coverage.aborted).toBe(false);
    expect(isCompleteRun(coverage)).toBe(false);
  });

  it("Duplikatweg: der abbrechende Kandidat gilt als VERSUCHT, nicht als abgeschlossen", async () => {
    const services = buildServices();
    const coverage = emptyCoverage();
    let calls = 0;
    const capacityError = Object.assign(new Error("busy"), { name: "ModelCapacityError" });

    await expect(
      services.overlaps.detectForSubject(
        subject({ refId: "s" }),
        twins(6),
        async () => {
          calls += 1;
          if (calls >= 3) {
            throw capacityError;
          }
          return VERSCHIEDEN;
        },
        { cap: CAP, coverage },
      ),
    ).rejects.toBe(capacityError);

    // Zwei Vergleiche liefen zu Ende, der dritte wurde versucht und brach ab. Vor mega29 musste die
    // EINE Zahl `examined` beides zugleich behaupten und wurde deshalb künstlich heruntergerechnet.
    expect(coverage.attempted).toBe(3);
    expect(coverage.completed).toBe(2);
    expect(coverage.aborted).toBe(true);
    expect(coverage.capped).toBe(true);
  });
});

describe("mega29 B3 · die zusammengefasste Zahl ist eine konservative MINDEST-Abdeckung", () => {
  it("die schwächere Seite regiert jede Reichweiten-Zahl; Ausfälle summieren sich", () => {
    const conflictRun = {
      available: 100,
      selected: 5,
      alreadyOpen: 1,
      attempted: 4,
      completed: 3,
      skipped: 1,
      capped: true,
      aborted: false,
    };
    const duplicateRun = {
      available: 100,
      selected: 20,
      alreadyOpen: 0,
      attempted: 20,
      completed: 19,
      skipped: 0,
      capped: true,
      aborted: true,
    };
    expect(mergeCoverage(conflictRun, duplicateRun)).toEqual({
      available: 100,
      selected: 5,
      // „übersprungen, weil schon bekannt" ist eine AUSLASSUNG — konservativ zählt die größere.
      alreadyOpen: 1,
      attempted: 4,
      completed: 3,
      skipped: 1,
      capped: true,
      aborted: true,
    });
  });

  it("zwei vollständige Läufe bleiben vollständig", () => {
    const run = {
      available: 3,
      selected: 3,
      alreadyOpen: 0,
      attempted: 3,
      completed: 3,
      skipped: 0,
      capped: false,
      aborted: false,
    };
    expect(isCompleteRun(mergeCoverage(run, run))).toBe(true);
  });
});

describe("mega29 B5 · unterschiedlich große Vorfiltermengen auf beiden Wegen", () => {
  it("der fachliche Vorfilter des Konfliktwegs verengt stärker — die Zusammenfassung nennt SEINE Reichweite", async () => {
    const services = buildServices();
    // Zwei Nachbarn (gleiche Kategorie) und drei fachlich Fremde ohne Textnähe: der Konfliktweg
    // sieht nur die Nachbarn, der Duplikatweg sieht alle fünf.
    for (const [title, statement, category] of [
      ["Pumpe P2 Nachbar A", "Druckverlust an Ventil V4 im Betrieb", "Betrieb"],
      ["Pumpe P2 Nachbar B", "Druckverlust an Ventil V4 beim Anfahren", "Betrieb"],
      ["Urlaubsantrag", "Zwoelf Wochen Frist fuer Antraege", "Personal"],
      ["Reisekosten", "Belege binnen dreissig Tagen einreichen", "Personal"],
      ["Schulungsplan", "Jaehrliche Unterweisung der Belegschaft", "Personal"],
    ] as const) {
      await services.ko.create({
        title,
        statement,
        type: "best_practice",
        category,
        author: "u1",
        confidentiality: "intern",
      });
    }
    const subj = await services.ko.create({
      title: "Pumpe P2 Druckverlust",
      statement: "Druckverlust an Ventil V4 im Betrieb",
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
    // AUFTRAG-mega32 BLOCK D (bens GELB-4) — DER LETZTE null-FAKE.
    // Hier stand bis mega31 durchgehend `null` als vermeintlich sauberer Nicht-Treffer. Seit
    // mega31 A1 ist `null` im Reasoner-Vertrag AUSNAHMSLOS ein Fehlerausgang: „ein echtes
    // `kein_konflikt`/`verschieden` ist ein NICHT-null-verdict" (services/reasoner/src/types.ts).
    // Der Test misst nur relative Vorauswahl- und Zusammenführungswerte und war deshalb kein
    // Blocker — aber die Begriffsverwechslung gehört restlos raus, sonst kommt sie über eine
    // Kopie zurück. Die Fixtures liefern jetzt echte Nicht-Treffer-URTEILE; die Erwartungen des
    // Tests bleiben davon unberührt (nichts wird angelegt, nur `completed` statt `skipped`).
    const reasoner = {
      status: () => ({ active: true, provider: "spy", mode: "model" }),
      judgeConflict: async () => KEIN_KONFLIKT,
      judgeDuplicate: async () => VERSCHIEDEN,
      judgeConflictOutcome: async () => ({ verdict: KEIN_KONFLIKT }),
      judgeDuplicateOutcome: async () => ({ verdict: VERSCHIEDEN }),
    } as unknown as AppServices["reasoner"];

    const conflictCoverage = await detectConflictsForKo(subj.id, {
      ko: services.ko,
      conflicts: services.conflicts,
      reasoner,
    });
    const duplicateCoverage = await detectDuplicatesForKo(subj.id, {
      ko: services.ko,
      overlaps: services.overlaps,
      reasoner,
      settings: services.overlapSettings,
    });

    expect(conflictCoverage.available).toBe(5);
    expect(duplicateCoverage.available).toBe(5);
    // Der Konfliktweg legt WENIGER vor — genau das war bisher hinter EINER Zahl verschwunden.
    expect(conflictCoverage.selected).toBeLessThan(duplicateCoverage.selected);
    expect(duplicateCoverage.selected).toBe(5);

    const merged = mergeCoverage(conflictCoverage, duplicateCoverage);
    expect(merged.completed).toBe(conflictCoverage.completed);
    expect(merged.capped).toBe(true);
    expect(isCompleteRun(merged)).toBe(false);
  });
});
