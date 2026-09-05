// ================================================================================================
// JOB 3074 · V3 — WO NICHTS GEMELDET WURDE, STEHT NICHTS. KEINE NULL, KEINE SCHÄTZUNG.
// ================================================================================================
//
// Das Fehlen des Feldes ist eine AUSSAGE, wortgleich zur Regel bei `model`
// (`services/model-runs/src/types.ts:166-169`): es heißt „in diesem Lauf hat keine Modell-API einen
// Verbrauch genannt". Eine `0` an derselben Stelle wäre etwas ganz anderes — nämlich die Behauptung,
// ein Lauf habe messbar nichts verbraucht. Genau diese Verwechslung schließen die vier Fälle hier
// aus; sie sind die Grundlage dafür, dass eine leere Stelle in der KI-Übersicht lesbar bleibt.
//
// V3c IST DER TEUERSTE FALL: der Lauf scheitert, NACHDEM die API einen Verbrauch gemeldet hat.
// Verbraucht ist verbraucht — bezahlt wird der Aufruf, nicht der Erfolg. Gefahren wird er am echten
// lokalen Client: eine 200er-Antwort MIT `usage`, aber OHNE Antwortinhalt, wirft in
// `requireChatContent` (`model-client.ts:296-326`). Der Verbrauch muss davor gemeldet sein.
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryModelRunRepo, type ModelRunRecord } from "../../services/model-runs";
import {
  DeterministicProvider,
  ModelProvider,
  Reasoner,
  type ReasonerProvider,
} from "../../services/reasoner";
import { alsAntwort, cloudClient, cloudKoerper, lokalKoerper, lokalerClient } from "./hilfe";

// Ein Ersatz-Provider, der selbst ausfällt — nur so entsteht ein Datensatz mit `status: "error"`.
function ersatzFaelltAus(): ReasonerProvider {
  const nichtBenutzt = async (): Promise<never> => {
    throw new Error("in diesem Test nicht benutzt");
  };
  return {
    name: "ersatz-faellt-aus",
    isAvailable: () => true,
    structure: nichtBenutzt,
    answer: nichtBenutzt,
    assistText: async () => {
      throw new Error("auch der Ersatz antwortet nicht");
    },
    interview: nichtBenutzt,
    extract: nichtBenutzt,
    select: () => [],
  };
}

function stelleFetch(koerper: () => unknown): void {
  vi.stubGlobal("fetch", (async () => alsAntwort(koerper())) as unknown as typeof fetch);
}

async function laufUndDatensatz(
  primary: ReasonerProvider | undefined,
  fallback: ReasonerProvider = new DeterministicProvider(),
): Promise<ModelRunRecord> {
  const repo = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(primary, fallback, repo);
  try {
    await reasoner.assistText("Roher Satz, der geglättet werden soll.", "de");
  } catch {
    // V3c: die ganze Kette scheitert — der FEHLER-Datensatz ist genau das, was hier geprüft wird.
  }
  const laeufe = await repo.recent(10);
  expect(laeufe).toHaveLength(1);
  return laeufe[0] as ModelRunRecord;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 3074 V3: das Fehlen des Verbrauchs ist eine Aussage", () => {
  it("KALIBRIERUNG · mit `usage` steht der gemeldete Wert da (sonst prüften V3a–V3d nichts)", async () => {
    stelleFetch(() => cloudKoerper("Geglätteter Satz.", { input_tokens: 123, output_tokens: 45 }));
    const datensatz = await laufUndDatensatz(new ModelProvider(cloudClient()));

    expect(datensatz.status).toBe("success");
    expect(datensatz.verbrauch).toEqual({
      eingabeToken: 123,
      ausgabeToken: 45,
      gemeldeteAufrufe: 1,
    });
  });

  it("V3a · die API antwortet OHNE usage-Block: das Feld FEHLT, es steht keine Null", async () => {
    stelleFetch(() => cloudKoerper("Geglätteter Satz."));
    const datensatz = await laufUndDatensatz(new ModelProvider(cloudClient()));

    expect(datensatz.status).toBe("success");
    // Der Lauf HAT ein Modell befragt — nur genannt hat die API nichts.
    expect(datensatz.model).toBe("claude-sonnet-4-6");
    expect(Object.hasOwn(datensatz, "verbrauch")).toBe(false);
    expect(datensatz.verbrauch).toBeUndefined();
  });

  it("V3b · rein deterministischer Lauf: kein Modell, kein Verbrauch, kein Ersatzwert", async () => {
    const datensatz = await laufUndDatensatz(undefined);

    expect(datensatz.status).toBe("success");
    expect(datensatz.demo).toBe(true);
    expect(Object.hasOwn(datensatz, "verbrauch")).toBe(false);
  });

  it("V3c · gescheitert NACH gemeldetem Verbrauch: das Feld ist da, der Status bleibt error", async () => {
    // 200 + usage + KEIN Antwortinhalt → ModelEmptyResponseError, nachdem die API bereits
    // abgerechnet hat. `output_tokens: 0` ist hier ein ECHTER Messwert, keine Ersatznull.
    stelleFetch(() => lokalKoerper(null, { prompt_tokens: 42, completion_tokens: 0 }));
    const datensatz = await laufUndDatensatz(new ModelProvider(lokalerClient()), ersatzFaelltAus());

    expect(datensatz.status).toBe("error");
    expect(datensatz.verbrauch).toEqual({
      eingabeToken: 42,
      ausgabeToken: 0,
      gemeldeteAufrufe: 1,
    });
  });

  it("V3d · unbrauchbare usage-Werte (Text, negativ, gebrochen, fehlende Hälfte): das Feld FEHLT", async () => {
    for (const usage of [
      { input_tokens: "viele", output_tokens: 5 },
      { input_tokens: 5, output_tokens: -1 },
      { input_tokens: -3, output_tokens: -4 },
      { input_tokens: 1.5, output_tokens: 2 },
      { input_tokens: 12 },
      { output_tokens: 12 },
      {},
      null,
    ]) {
      vi.unstubAllGlobals();
      stelleFetch(() => cloudKoerper("Geglätteter Satz.", usage));
      const datensatz = await laufUndDatensatz(new ModelProvider(cloudClient()));

      expect(
        Object.hasOwn(datensatz, "verbrauch"),
        `usage=${JSON.stringify(usage)} darf keinen Verbrauch erzeugen`,
      ).toBe(false);
    }
  });
});
