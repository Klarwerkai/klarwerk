// ================================================================================================
// JOB 3127 · MR-SELECT-1 — DIE IMPORT-AUSWAHL HINTERLÄSST EINE SPUR.
// ================================================================================================
//
// DER BEFUND (Codex, Lauf R-1567 auf 1.125): die Route `POST /api/admin/import/confluence/select`
// antwortete 200 mit `inferenceStatus: "unavailable"` / `fallbackReason: "model-error"` — ein
// Modell war also befragt worden und gescheitert —, und die im selben Lauf frisch abgerufene
// Laufliste war `[]`. Der teuerste Fall (Modellaufruf, bezahlt, ohne Ergebnis) stand nirgends.
//
// URSACHE: `Reasoner.deriveImportCriteria` (services/reasoner/src/service.ts) ruft `completeRaw`
// an einem echten Modell, kehrt aber in JEDEM Zweig zurück, ohne `recordRun` zu rufen. Der normale
// Weg `runTask` protokolliert im Erfolg wie im Fehler.
//
// WAS HIER GEMESSEN WIRD: der geschriebene Datensatz — je Anfrage genau einer, mit der Ursache,
// die auch die Rückgabe nennt. Der Modellaufruf geht durch den ECHTEN Chokepoint
// (`cappedModelClient`), damit `model` und `verbrauch` genau dann entstehen, wenn wirklich ein
// Modell gearbeitet hat (die Regel aus JOB 3036 R2 / JOB 3074).
//
// NICHT GEMESSEN: der produktive Einstieg über die Route — das tut `route-einstieg.test.ts`
// daneben; und die Anzeige der Laufkarte — das tut `laufkarte-kette.test.ts`.
import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo, type ModelRunRecord } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import {
  cappedModelClient,
  meldeModellVerbrauch,
} from "../../services/reasoner/src/model-concurrency";
import { ModelTimeoutError } from "../../services/reasoner/src/model-errors";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const SATZ = "alles zum Thema Wartung";

// Ein Modell-Client in der Produktverdrahtung: der rohe Client steckt IMMER im gecappten Wrapper
// (`model-client.ts:411-425`, `:465-482`) — nur dort wird der Modellaufruf vermerkt. Ein Test am
// rohen Client würde die Regel „model nur bei echtem Aufruf" umgehen statt sie zu messen.
function modellClient(
  antwort: () => Promise<string>,
  opts: { ohneModellnamen?: boolean; rejectsConfidential?: boolean } = {},
): { client: ModelClient; aufrufe: () => number } {
  let aufrufe = 0;
  const inner: ModelClient = {
    name: "anthropic:auswahl-modell",
    // Die Bestandsform ohne Modellangabe (`ohneModellnamen`) beweist, dass das Feld dann FEHLT.
    ...(opts.ohneModellnamen === true ? {} : { model: "auswahl-modell" }),
    complete: async () => {
      aufrufe += 1;
      return antwort();
    },
  };
  return {
    client: cappedModelClient(inner, { rejectsConfidential: opts.rejectsConfidential === true }),
    aufrufe: () => aufrufe,
  };
}

// JOB 3588: die GRUNDFREIGABE gehört in DIESEN Aufbau.
//
// Die Datei protokolliert Auswahlläufe an einem ECHTEN Modell: Modellname, Verbrauch, Fehlerursache.
// Ohne die Adminfreigabe des Kerns von JOB 3549 stünde der Client in keiner Kette, jeder Lauf endete
// „no-model", und acht Fälle prüften eine Ursache, die sie gar nicht herbeigeführt haben.
//
// KEIN `vertraulicheInhalte` — und das ist hier keine Formsache: R4b („Cloud wegen Vertraulichkeit
// ausgeschlossen") benutzt denselben Aufbau und verlangt `aufrufe() === 0`. Mit der Grundfreigabe
// ALLEIN bleibt genau das so (`oeffentlicheKiErlaubt` verlangt für vertraulichen Text zusätzlich den
// zweiten Schalter), und die gemessene Null gehört damit der EINSTUFUNG — nicht einer fehlenden
// Adminfreigabe, die mit R4b nichts zu tun hat. Der zweite Schalter würde den Fall zerstören.
async function reasonerMitModell(
  antwort: () => Promise<string>,
  opts: { ohneModellnamen?: boolean; rejectsConfidential?: boolean } = {},
): Promise<{ reasoner: Reasoner; repo: InMemoryModelRunRepo; aufrufe: () => number }> {
  const repo = new InMemoryModelRunRepo();
  const { client, aufrufe } = modellClient(antwort, opts);
  const reasoner = new Reasoner(new ModelProvider(client), new DeterministicProvider(), repo);
  await erteileKiFreigabe(reasoner);
  return { reasoner, repo, aufrufe };
}

async function genauEinDatensatz(repo: InMemoryModelRunRepo): Promise<ModelRunRecord> {
  const laeufe = await repo.recent(10);
  expect(laeufe).toHaveLength(1);
  return laeufe[0] as ModelRunRecord;
}

describe("JOB 3127: jede echte Auswahl-Anfrage schreibt genau einen select-Lauf", () => {
  it("R1 Erfolg: ein Datensatz task=select/status=success mit Modellnamen — Kriterien unverändert", async () => {
    const { reasoner, repo, aufrufe } = await reasonerMitModell(
      async () => '{"themes":["Wartung"]}',
    );

    const ergebnis = await reasoner.deriveImportCriteria(SATZ, "de", false);

    expect(ergebnis).toEqual({ criteria: { themes: ["Wartung"] }, fallbackReason: null });
    expect(aufrufe()).toBe(1);
    const lauf = await genauEinDatensatz(repo);
    expect(lauf.task).toBe("select");
    expect(lauf.status).toBe("success");
    expect(lauf.locale).toBe("de");
    expect(lauf.demo).toBe(false);
    expect(lauf.fallback).toBe(false);
    expect(lauf.provider).toBe("anthropic:auswahl-modell");
    // JOB 3036: der reine Modellbezeichner, nicht ein zweites Mal der Anbieter.
    expect(lauf.model).toBe("auswahl-modell");
    expect(lauf.model).not.toBe(lauf.provider);
    expect(Object.hasOwn(lauf, "error")).toBe(false);
  });

  it("R1b der Anbieter nennt kein Modell: das Feld FEHLT, der Lauf steht trotzdem da", async () => {
    const { reasoner, repo } = await reasonerMitModell(async () => '{"themes":["Wartung"]}', {
      ohneModellnamen: true,
    });

    await reasoner.deriveImportCriteria(SATZ, "de", false);

    const lauf = await genauEinDatensatz(repo);
    expect(lauf.status).toBe("success");
    expect(Object.hasOwn(lauf, "model")).toBe(false);
  });

  it("R2 Modellfehler: ein Datensatz status=error/error=model-error, Rückgabe unverändert", async () => {
    const { reasoner, repo } = await reasonerMitModell(async () => {
      throw new Error("Modell-API antwortete mit 500");
    });

    const ergebnis = await reasoner.deriveImportCriteria(SATZ, "de", false);

    expect(ergebnis).toEqual({ criteria: null, fallbackReason: "model-error" });
    const lauf = await genauEinDatensatz(repo);
    expect(lauf.task).toBe("select");
    expect(lauf.status).toBe("error");
    expect(lauf.error).toBe("model-error");
    // Ein Modell HAT gearbeitet — der Datensatz sagt, welches (JOB 3036).
    expect(lauf.model).toBe("auswahl-modell");
    expect(lauf.demo).toBe(false);
  });

  it("R2b Zeitlimit: die Ursache heißt model-timeout, im Datensatz wie in der Rückgabe", async () => {
    const { reasoner, repo } = await reasonerMitModell(async () => {
      throw new ModelTimeoutError("Zeitlimit überschritten", 30_000);
    });

    const ergebnis = await reasoner.deriveImportCriteria(SATZ, "de", false);

    expect(ergebnis).toEqual({ criteria: null, fallbackReason: "model-timeout" });
    const lauf = await genauEinDatensatz(repo);
    expect(lauf.status).toBe("error");
    expect(lauf.error).toBe("model-timeout");
  });

  it("R2c der bezahlte, ergebnislose Aufruf verliert seinen Verbrauch nicht", async () => {
    const { reasoner, repo } = await reasonerMitModell(async () => {
      // Die API hat Eingabe gelesen und abgerechnet, BEVOR sie scheiterte.
      meldeModellVerbrauch(3000, 12);
      throw new Error("Modell-API antwortete mit 500");
    });

    await reasoner.deriveImportCriteria(SATZ, "de", false);

    const lauf = await genauEinDatensatz(repo);
    expect(lauf.status).toBe("error");
    expect(lauf.verbrauch).toEqual({ eingabeToken: 3000, ausgabeToken: 12, gemeldeteAufrufe: 1 });
  });

  it("R3 Antwort ohne verwertbares JSON: ein Datensatz status=error, Rückgabe model-error", async () => {
    const { reasoner, repo } = await reasonerMitModell(
      async () => "Gerne! Ich helfe dir bei der Auswahl.",
    );

    const ergebnis = await reasoner.deriveImportCriteria(SATZ, "de", false);

    expect(ergebnis).toEqual({ criteria: null, fallbackReason: "model-error" });
    const lauf = await genauEinDatensatz(repo);
    expect(lauf.status).toBe("error");
    expect(lauf.error).toBe("model-error");
    // Das Modell hat geantwortet — nur unbrauchbar. Der Lauf nennt es.
    expect(lauf.model).toBe("auswahl-modell");
  });

  it("R4 kein benutzbares Modell: ein Datensatz demo=true/error=no-model OHNE model-Feld", async () => {
    const repo = new InMemoryModelRunRepo();
    const fallback = new DeterministicProvider();
    const reasoner = new Reasoner(undefined, fallback, repo);

    const ergebnis = await reasoner.deriveImportCriteria(SATZ, "de", false);

    expect(ergebnis).toEqual({ criteria: null, fallbackReason: "no-model" });
    const lauf = await genauEinDatensatz(repo);
    expect(lauf.task).toBe("select");
    expect(lauf.status).toBe("error");
    expect(lauf.error).toBe("no-model");
    expect(lauf.demo).toBe(true);
    expect(lauf.provider).toBe(fallback.name);
    // Es hat KEINES gearbeitet — also steht auch keines da.
    expect(Object.hasOwn(lauf, "model")).toBe(false);
    expect(Object.hasOwn(lauf, "verbrauch")).toBe(false);
  });

  it("R4b Cloud wegen Vertraulichkeit ausgeschlossen: die Ursache heißt confidential", async () => {
    const { reasoner, repo, aufrufe } = await reasonerMitModell(async () => '{"themes":["x"]}', {
      rejectsConfidential: true,
    });

    const ergebnis = await reasoner.deriveImportCriteria(SATZ, "de", true);

    expect(ergebnis).toEqual({ criteria: null, fallbackReason: "confidential" });
    // Kein Egress: das Modell wurde nie befragt.
    expect(aufrufe()).toBe(0);
    const lauf = await genauEinDatensatz(repo);
    expect(lauf.status).toBe("error");
    expect(lauf.error).toBe("confidential");
    expect(lauf.demo).toBe(true);
    expect(Object.hasOwn(lauf, "model")).toBe(false);
  });

  it("R5 leerer Prompt: nichts gefragt, nichts protokolliert", async () => {
    const { reasoner, repo, aufrufe } = await reasonerMitModell(async () => '{"themes":["x"]}');

    const ergebnis = await reasoner.deriveImportCriteria("  ", "de", false);

    expect(ergebnis).toEqual({ criteria: null, fallbackReason: null });
    expect(aufrufe()).toBe(0);
    expect(await repo.recent(10)).toEqual([]);
  });

  it("R5b ohne Protokoll-Repo (Tests/CLI) bleibt die Auswahl unverändert und wirft nicht", async () => {
    const { client } = modellClient(async () => '{"themes":["Wartung"]}');
    const reasoner = new Reasoner(new ModelProvider(client), new DeterministicProvider());
    await erteileKiFreigabe(reasoner); // JOB 3588, Grundfreigabe (s. `reasonerMitModell`)

    await expect(reasoner.deriveImportCriteria(SATZ, "de", false)).resolves.toEqual({
      criteria: { themes: ["Wartung"] },
      fallbackReason: null,
    });
  });

  it("R6 zwei Aufrufe → exakt zwei Datensätze (kein Pfad schreibt doppelt)", async () => {
    const { reasoner, repo } = await reasonerMitModell(async () => '{"themes":["Wartung"]}');

    await reasoner.deriveImportCriteria(SATZ, "de", false);
    await reasoner.deriveImportCriteria("alles von Anna", "en", false);

    const laeufe = await repo.recent(10);
    expect(laeufe).toHaveLength(2);
    expect(laeufe.every((l) => l.task === "select")).toBe(true);
    expect(new Set(laeufe.map((l) => l.locale))).toEqual(new Set(["de", "en"]));
  });

  it("R6b auch der gescheiterte Aufruf schreibt genau EINEN Datensatz", async () => {
    const { reasoner, repo } = await reasonerMitModell(async () => {
      throw new Error("Modell-API antwortete mit 500");
    });

    await reasoner.deriveImportCriteria(SATZ, "de", false);

    expect(await repo.recent(10)).toHaveLength(1);
  });

  it("R7 ein kaputtes Protokoll darf die Auswahl nicht kippen: Ergebnis steht, nichts wirft", async () => {
    const { client } = modellClient(async () => '{"themes":["Wartung"]}');
    const kaputtesRepo = {
      append: async () => {
        throw new Error("Journal nicht schreibbar");
      },
      recent: async () => [],
    };
    const reasoner = new Reasoner(
      new ModelProvider(client),
      new DeterministicProvider(),
      kaputtesRepo,
    );
    await erteileKiFreigabe(reasoner); // JOB 3588, Grundfreigabe (s. `reasonerMitModell`)

    await expect(reasoner.deriveImportCriteria(SATZ, "de", false)).resolves.toEqual({
      criteria: { themes: ["Wartung"] },
      fallbackReason: null,
    });
  });
});
