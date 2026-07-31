// ================================================================================================
// AUFTRAG-mega31 BLOCK A — WAS DIE UMKEHR EINEN BESTAND VON 39 OBJEKTEN KOSTET.
// ================================================================================================
//
// Pedi wollte die Zahl sehen, BEVOR sie jemand im Browser sieht: wie viele der 39 Objekte gelten
// nach der Umkehr als unvollständig, und warum. Der Live-Bestand ist von hier aus nicht lesbar
// (kein Produktionszugriff, kein Egress — beides ausdrücklich untersagt). Diese Fläche rechnet die
// Frage deshalb am ECHTEN Pfad nach: 39 Objekte, der reale aiCheck-Runner, die reale
// Zusammenfassung. Die Zahl ist damit reproduzierbar statt behauptet.
//
// DAS ERGEBNIS IST UNBEQUEM UND WICHTIG: die Umkehr ist NICHT der Grund, aus dem dieser Bestand
// vollständig als unvollständig gilt — der DECKEL ist es. Bei 39 Objekten legt der Duplikatweg den
// vollen Bestand vor (`available` = 38), geprüft werden höchstens 20 (DETECTION_CANDIDATE_CAP).
// `capped = selected < available` ist damit strukturell wahr, für jedes einzelne Objekt, unabhängig
// vom Modell. Schon vor mega31 war jedes Objekt mit echtem Protokoll `incomplete`.
//
// Was die Umkehr WIRKLICH ändert, steht in den letzten beiden Fällen: Läufe OHNE Protokoll. Genau
// dort war die Entwarnung still, und genau dort ist sie jetzt weg.
import { describe, expect, it } from "vitest";
import { createAiCheckRunner } from "../../services/app/src/ai-check-worker";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import { DETECTION_CANDIDATE_CAP } from "../../services/app/src/detection-cap";

const BESTAND = 39;

const KEIN_KONFLIKT = {
  relation: "kein_konflikt",
  older: null,
  confidence: 0.9,
  begruendung: "Unterschiedlicher Geltungsbereich.",
  zitat_a: "",
  zitat_b: "",
};

const VERSCHIEDEN = {
  beziehung: "verschieden",
  aspects: [],
  nurInA: "",
  nurInB: "",
  empfehlung: "getrennt_lassen",
  confidence: 0.9,
  begruendung: "Andere Sachverhalte.",
};

// Jede Judge-Fläche bekommt IHR eigenes Urteil — ein Duplikat-Profil am Konfliktweg wäre ein Fake,
// der zufällig durchginge (nicht-null), aber nichts belegt.
function reasonerThat(
  conflict: () => Promise<unknown>,
  duplicate: () => Promise<unknown>,
  active = true,
): AppServices["reasoner"] {
  return {
    status: () => ({ active, provider: "spy", mode: "model" }),
    judgeConflictOutcome: conflict,
    judgeDuplicateOutcome: duplicate,
    judgeConflict: async () => (await conflict()) as never,
    judgeDuplicate: async () => (await duplicate()) as never,
  } as unknown as AppServices["reasoner"];
}

// 39 inhaltlich klar getrennte Objekte — kein deterministischer Duplikat-Treffer, der die Zahlen
// mit Befunden überlagert. Es geht um die ABDECKUNG, nicht um Funde.
async function seed(services: AppServices): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < BESTAND; i++) {
    const ko = await services.ko.create({
      title: `Regelwerk ${i}`,
      statement: `Sachverhalt ${i}: eigenstaendige Aussage ueber Vorgang ${i} im Bereich ${i}.`,
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
    ids.push(ko.id);
  }
  return ids;
}

async function runAll(services: AppServices, ids: readonly string[]): Promise<void> {
  const runner = createAiCheckRunner({
    ko: services.ko,
    conflicts: services.conflicts,
    overlaps: services.overlaps,
    overlapSettings: services.overlapSettings,
    reasoner: services.reasoner,
  });
  for (const id of ids) {
    await services.ko.recordAiCheckOutcome(id, await runner(id));
  }
}

describe("mega31 A · der Preis der Umkehr an einem Bestand von 39 Objekten", () => {
  it("ein FEHLERFREIER Modelllauf: alle 39 gelten als unvollständig — der Deckel, nicht die Umkehr", async () => {
    const services = buildServices();
    // Beide Flächen liefern gültige Nicht-Treffer-Urteile — ein tadellos laufendes Modell.
    services.reasoner = reasonerThat(
      async () => ({ verdict: KEIN_KONFLIKT }),
      async () => ({ verdict: VERSCHIEDEN }),
    );
    const ids = await seed(services);
    await runAll(services, ids);

    const summary = await services.ko.aiCheckCoverageSummary({ sichtbar: () => true });
    expect(summary.total).toBe(BESTAND);
    // Jeder Lauf schließt sauber ab — `done`, kein Übersprung, kein Abbruch.
    const first = await services.ko.get(ids[0] as string);
    expect(first?.aiCheck?.status).toBe("done");
    expect(first?.aiCheck?.coverage?.skipped).toBe(0);
    // Und ist trotzdem unvollständig: 38 mögliche Nachbarn, 20 geprüft.
    expect(first?.aiCheck?.coverage?.available).toBe(BESTAND - 1);
    expect(first?.aiCheck?.coverage?.attempted).toBe(DETECTION_CANDIDATE_CAP);
    expect(first?.aiCheck?.coverage?.capped).toBe(true);
    expect(summary.incomplete).toBe(BESTAND);
    expect(summary.unchecked).toBe(0);
    expect(summary.noCoverage).toBe(0);
  });

  it("ein 429 auf beiden Wegen: weiterhin 39 unvollständig, jetzt aber mit ehrlichem `skipped`", async () => {
    const services = buildServices();
    const rateLimited = async () => ({
      verdict: null,
      failure: "model-error",
      providerFailure: { failureClass: "http", status: 429 },
    });
    services.reasoner = reasonerThat(rateLimited, rateLimited);
    const ids = await seed(services);
    await runAll(services, ids);

    const summary = await services.ko.aiCheckCoverageSummary({ sichtbar: () => true });
    const first = await services.ko.get(ids[0] as string);
    expect(first?.aiCheck?.status).toBe("failed");
    // AUFTRAG-mega31 A1: VOR der Umkehr stand hier completed=20, skipped=0 — zwanzig Kandidaten
    // galten als fehlerfrei verglichen, obwohl kein einziges Urteil fiel.
    expect(first?.aiCheck?.coverage?.completed).toBe(0);
    expect(first?.aiCheck?.coverage?.skipped).toBe(2 * DETECTION_CANDIDATE_CAP);
    expect(summary.incomplete).toBe(BESTAND);
  });

  // ============================================================================================
  // HIER war die Entwarnung wirklich still — und hier wirkt die Umkehr.
  // ============================================================================================
  it("A2: 39 gescheiterte Läufe OHNE Merker in der Abdeckung — vorher `incomplete=0`", async () => {
    const services = buildServices();
    const ids = await seed(services);
    // Genau bens ROT-2: Status `failed`, Protokoll makellos (so entsteht es z. B., wenn der Deckel
    // gar nicht greift, weil weniger Kandidaten als Deckelplätze da sind).
    for (const id of ids) {
      await services.ko.recordAiCheckOutcome(id, {
        ok: false,
        fallbackReason: "no-model",
        coverage: {
          available: 3,
          selected: 3,
          alreadyOpen: 0,
          attempted: 3,
          completed: 3,
          skipped: 0,
          capped: false,
          aborted: false,
        },
      });
    }

    const summary = await services.ko.aiCheckCoverageSummary({ sichtbar: () => true });
    // Vor der Umkehr: incomplete=0, unchecked=0 → die Fußnote auf den leeren Boards rendert NICHTS.
    expect(summary).toEqual({
      total: BESTAND,
      incomplete: BESTAND,
      unchecked: 0,
      noCoverage: 0,
    });
  });

  it("A4: 39 Altbestands-Läufe ohne Abdeckung — nicht mehr „gar kein Lauf“", async () => {
    const services = buildServices();
    const ids = await seed(services);
    for (const id of ids) {
      await services.ko.recordAiCheckOutcome(id, { ok: true }); // Abschluss ohne Protokoll
    }

    const summary = await services.ko.aiCheckCoverageSummary({ sichtbar: () => true });
    // Vor der Umkehr standen diese 39 unter `unchecked` und wurden als „gar keinen Lauf" betextet.
    expect(summary).toEqual({
      total: BESTAND,
      incomplete: 0,
      unchecked: 0,
      noCoverage: BESTAND,
    });
  });
});
