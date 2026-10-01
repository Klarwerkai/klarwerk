// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll · Bens Befunde R1 B1, B2, B4 — DAS PROTOKOLL, AM REASONER GEMESSEN.
// ================================================================================================
//
// B1 · INHALTSFREI: ein Modell, das unbrauchbaren Text liefert, ließ über die `JSON.parse`-Meldung
//      einen Ausschnitt seiner ANTWORT in `error` stehen. Gemessen wird hier mit einer synthetischen
//      Marke im Antworttext und im Eingabetext: sie darf in keinem Feld des Datensatzes stehen.
// B2 · JEDER MODELLWEG: Anreicherung, Konflikt- und Dublettenurteil und die Anbieterprobe befragten
//      ein Modell, ohne einen Lauf zu schreiben. Je Aufruf entsteht jetzt genau einer — mit Modell,
//      Verbrauch und Ausgang. Ohne Modellversuch entsteht keiner (sonst schriebe die Konfliktprüfung
//      auf einer Installation ohne KI je Paar einen leeren Lauf).
// B4 · ERZEUGT: Art und Anzahl dessen, was ein gelungener Lauf zurückgab — nie der Inhalt.
//
// Der Modellaufruf geht durch den ECHTEN Chokepoint (`cappedModelClient`), damit `model` und
// `verbrauch` genau dann entstehen, wenn wirklich ein Modell gearbeitet hat (JOB 3036 R2 / 3074).
import { describe, expect, it } from "vitest";
import {
  InMemoryModelRunRepo,
  KI_ERZEUGENDE_AUFGABEN,
  type ModelRunRecord,
  ModelRunService,
  ProtokollModelRunRepo,
  lesePreisliste,
} from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { openAiCompatibleClient } from "../../services/reasoner/src/model-client";
import {
  ModelCapacityError,
  cappedModelClient,
  meldeModellVerbrauch,
} from "../../services/reasoner/src/model-concurrency";
import { ModelHttpError } from "../../services/reasoner/src/model-errors";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const ANTWORTMARKE = "BEN_ANTWORTINHALT_7f3";
const EINGABEMARKE = "EINGABE_GEHEIM_9c1";

const KONFLIKT_JSON = JSON.stringify({
  relation: "widerspruch",
  older: "a",
  confidence: 0.8,
  begruendung: "",
  zitat_a: "A",
  zitat_b: "B",
});

// Ein Modell in Produktverdrahtung: gecappt, meldet je Aufruf Verbrauch, antwortet wie vorgegeben.
function modell(
  antwort: () => Promise<string>,
  verbrauch: [number, number] = [23, 5],
): ModelClient {
  return cappedModelClient(
    {
      name: "anthropic:test-modell",
      model: "test-modell",
      complete: async () => {
        meldeModellVerbrauch(verbrauch[0], verbrauch[1]);
        return antwort();
      },
    },
    { rejectsConfidential: true },
  );
}

async function aufbau(
  client: ModelClient | undefined,
): Promise<{ reasoner: Reasoner; repo: InMemoryModelRunRepo }> {
  const repo = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(
    client ? new ModelProvider(client) : undefined,
    new DeterministicProvider(),
    repo,
  );
  await erteileKiFreigabe(reasoner);
  return { reasoner, repo };
}

// Ben R2 B1: der ECHTE OpenAI-kompatible Client mit gestellter Fetch-Antwort — der Anbieter
// zitiert die Anfrage in seiner Fehlermeldung zurück. Kein Netz, kein Schlüssel.
function zitierenderAnbieter(koerper: (anfrage: string) => string): ModelClient {
  const fetchFn = (async (_url: unknown, init?: { body?: unknown }) => {
    const anfrage = String(init?.body ?? "");
    return {
      ok: false,
      status: 400,
      text: async () => koerper(anfrage),
      json: async () => JSON.parse(koerper(anfrage)),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return cappedModelClient(
    openAiCompatibleClient({
      baseUrl: "http://127.0.0.1:9/v1",
      model: "gpt-test",
      name: "anthropic:gpt-test",
      fetchFn,
    }),
    { rejectsConfidential: true },
  );
}

// Ben R2 B3: ein Modell mit eigenem Namen, das Verbrauch meldet und dann antwortet oder scheitert.
function preisModell(name: string, ein: number, antwort: string | Error): ModelClient {
  return cappedModelClient(
    {
      name: `${name.startsWith("lokal") ? "lokal" : "anthropic"}:${name}`,
      model: name,
      complete: async () => {
        meldeModellVerbrauch(ein, 0);
        if (antwort instanceof Error) {
          throw antwort;
        }
        return antwort;
      },
    },
    { rejectsConfidential: !name.startsWith("lokal") },
  );
}

const ZWEI_PREISE = lesePreisliste(
  JSON.stringify({
    waehrung: "EUR",
    preisstand: "r2",
    modelle: {
      teuer: { eingabeJeMillion: 10, ausgabeJeMillion: 0 },
      "lokal-billig": { eingabeJeMillion: 1, ausgabeJeMillion: 0 },
    },
  }),
).preisliste;

async function einzigerLauf(repo: InMemoryModelRunRepo): Promise<ModelRunRecord> {
  const laeufe = await repo.recent(10);
  expect(laeufe).toHaveLength(1);
  return laeufe[0] as ModelRunRecord;
}

describe("Ben R1 B1: kein Anfrage- oder Antwortinhalt im Laufdatensatz", () => {
  it("I1 · unbrauchbare Modellantwort (structure): die Antwort steht nirgends, Anbieter und Klasse schon", async () => {
    const { reasoner, repo } = await aufbau(modell(async () => `${ANTWORTMARKE} ist kein JSON`));

    await reasoner.structure(`${EINGABEMARKE} Pumpe schmieren.`, "de");

    const lauf = await einzigerLauf(repo);
    const roh = JSON.stringify(lauf);
    expect(roh).not.toContain(ANTWORTMARKE);
    expect(roh).not.toContain(EINGABEMARKE);
    expect(lauf.error).toContain("anthropic:test-modell (test-modell)");
    expect(lauf.error).toContain("SyntaxError (parse)");
  });

  it("I2 · ein beliebiger Fehler mit Inhalt in der Meldung: nur Typ und Klasse", async () => {
    const { reasoner, repo } = await aufbau(
      modell(async () => {
        throw new Error(`Fehler beim Verarbeiten von: ${EINGABEMARKE}`);
      }),
    );

    await reasoner.structure("Pumpe schmieren.", "de");

    const lauf = await einzigerLauf(repo);
    expect(JSON.stringify(lauf)).not.toContain(EINGABEMARKE);
    expect(lauf.error).toContain("Error (unknown), Meldung nicht protokolliert");
  });

  it("I3 · HTTP-Fehler: Status und eigener Teil bleiben, die Anbieterbegründung nicht (Ben R2 B1)", async () => {
    const { reasoner, repo } = await aufbau(
      modell(async () => {
        throw new ModelHttpError("Modell-API antwortete mit 429: rate limit", 429, "rate limit");
      }),
    );

    await reasoner.structure("Pumpe schmieren.", "de");

    const lauf = await einzigerLauf(repo);
    expect(lauf.error).toContain(
      "Modell-API antwortete mit 429 (Anbieterbegründung nicht protokolliert)",
    );
    expect(lauf.error).not.toContain("rate limit");
  });
});

describe("Ben R1 B2: Anreicherung, Urteile und Probe schreiben je Aufruf genau einen Lauf", () => {
  it("W1 · enrich: ein Lauf mit Modell, Verbrauch und Erzeugnis — ohne Frage und Antwort", async () => {
    const { reasoner, repo } = await aufbau(modell(async () => `${ANTWORTMARKE} Weltwissen`));

    const ergebnis = await reasoner.enrichPublic(`${EINGABEMARKE} Was ist ein Ventil?`, "de");

    expect(ergebnis.demo).toBe(false);
    const lauf = await einzigerLauf(repo);
    expect(lauf.task).toBe("enrich");
    expect(lauf.status).toBe("success");
    expect(lauf.model).toBe("test-modell");
    expect(lauf.verbrauch).toEqual({ eingabeToken: 23, ausgabeToken: 5, gemeldeteAufrufe: 1 });
    expect(lauf.erzeugt).toEqual({ art: "text", anzahl: 1 });
    expect(JSON.stringify(lauf)).not.toContain(ANTWORTMARKE);
    expect(JSON.stringify(lauf)).not.toContain(EINGABEMARKE);
  });

  it("W1b · Entscheidung Pedi 8398db9e: ein enrich-Ergebnis trägt die KI-Kennzeichnung (KI-VO Art. 50)", async () => {
    const { reasoner } = await aufbau(modell(async () => "Weltwissen"));

    const ergebnis = await reasoner.enrichPublic("Was ist ein Ventil?", "de");

    expect(KI_ERZEUGENDE_AUFGABEN).toContain("enrich");
    expect(ergebnis.aiGenerated?.aiGenerated).toBe(true);
    expect(ergebnis.aiGenerated?.task).toBe("enrich");
    expect(ergebnis.aiGenerated?.mode).toBe("model");
    expect(Number.isNaN(Date.parse(String(ergebnis.aiGenerated?.at)))).toBe(false);
    // Ohne erzeugten Text (leerer Rückfall) gibt es nichts zu kennzeichnen.
    const leer = await (await aufbau(modell(async () => "   "))).reasoner.enrichPublic("x", "de");
    expect(leer.text).toBe("");
    expect(Object.hasOwn(leer, "aiGenerated")).toBe(false);
  });

  it("W2 · conflict: gelungenes Urteil → success, Erzeugnis „urteil“", async () => {
    const { reasoner, repo } = await aufbau(modell(async () => KONFLIKT_JSON));

    const ausgang = await reasoner.judgeConflictOutcome("Kern A", "Kern B", "de", false);

    expect(ausgang.verdict?.relation).toBe("widerspruch");
    const lauf = await einzigerLauf(repo);
    expect(lauf.task).toBe("conflict");
    expect(lauf.status).toBe("success");
    expect(lauf.model).toBe("test-modell");
    expect(lauf.verbrauch?.eingabeToken).toBe(23);
    expect(lauf.erzeugt).toEqual({ art: "urteil", anzahl: 1 });
  });

  it("W3 · duplicate: unverwertbare Antwort → error mit Grund, der Verbrauch bleibt", async () => {
    const { reasoner, repo } = await aufbau(modell(async () => `${ANTWORTMARKE} kein Urteil`));

    const ausgang = await reasoner.judgeDuplicateOutcome("Kern A", "Kern B", "de", false);

    expect(ausgang.verdict).toBeNull();
    const lauf = await einzigerLauf(repo);
    expect(lauf.task).toBe("duplicate");
    expect(lauf.status).toBe("error");
    expect(lauf.error).toContain("Antwort unverwertbar");
    expect(lauf.verbrauch).toEqual({ eingabeToken: 23, ausgabeToken: 5, gemeldeteAufrufe: 1 });
    expect(Object.hasOwn(lauf, "erzeugt")).toBe(false);
    expect(JSON.stringify(lauf)).not.toContain(ANTWORTMARKE);
  });

  it("W4 · probe: die Anbieterprobe ist ein Lauf `probe` mit Modell und Verbrauch", async () => {
    const { reasoner, repo } = await aufbau(modell(async () => "OK"));

    const probe = await reasoner.probe("anthropic");

    expect(probe.ok).toBe(true);
    const lauf = await einzigerLauf(repo);
    expect(lauf.task).toBe("probe");
    expect(lauf.status).toBe("success");
    expect(lauf.model).toBe("test-modell");
    expect(lauf.verbrauch?.ausgabeToken).toBe(5);
  });

  it("W5 · Urteil an der Auslastung: der Fehler bleibt (503), und genau ein error-Lauf steht da", async () => {
    const ausgelastet: ModelClient = {
      name: "anthropic:test-modell",
      model: "test-modell",
      complete: async () => {
        throw new ModelCapacityError("Modell ausgelastet: Warteschlange voll (0).");
      },
    };
    const { reasoner, repo } = await aufbau(ausgelastet);

    await expect(
      reasoner.judgeConflictOutcome("Kern A", "Kern B", "de", false),
    ).rejects.toBeInstanceOf(ModelCapacityError);

    const lauf = await einzigerLauf(repo);
    expect(lauf.task).toBe("conflict");
    expect(lauf.status).toBe("error");
    expect(lauf.error).toContain("Modell ausgelastet");
  });

  it("W6 · ohne Modell kein Modellversuch — und dann auch kein Lauf", async () => {
    const { reasoner, repo } = await aufbau(undefined);

    await reasoner.enrichPublic("Was ist ein Ventil?", "de");
    await reasoner.judgeConflictOutcome("Kern A", "Kern B", "de", false);
    await reasoner.judgeDuplicateOutcome("Kern A", "Kern B", "de", false);

    expect(await repo.recent(10)).toEqual([]);
  });
});

describe("Ben R1 B4: Art und Anzahl des Erzeugten, nie der Inhalt", () => {
  it("E1 · structure (deterministisch): ein Vorschlag", async () => {
    const { reasoner, repo } = await aufbau(undefined);

    await reasoner.structure("Pumpe alle 200 Betriebsstunden schmieren.", "de");

    const lauf = await einzigerLauf(repo);
    expect(lauf.status).toBe("success");
    expect(lauf.erzeugt).toEqual({ art: "vorschlag", anzahl: 1 });
  });

  it("E2 · assist mit Modell: ein Text", async () => {
    const { reasoner, repo } = await aufbau(
      modell(async () => "Ein ganz anderer, geglätteter Satz."),
    );

    await reasoner.assistText("Roher Satz, der geglättet werden soll.", "de");

    const lauf = await einzigerLauf(repo);
    expect(lauf.erzeugt).toEqual({ art: "text", anzahl: 1 });
    expect(JSON.stringify(lauf)).not.toContain("geglätteter Satz");
  });

  it("E3 · gescheiterter Lauf: kein Erzeugnis", async () => {
    const { reasoner, repo } = await aufbau(modell(async () => `${ANTWORTMARKE} kein Urteil`));

    await reasoner.judgeConflictOutcome("Kern A", "Kern B", "de", false);

    const lauf = await einzigerLauf(repo);
    expect(lauf.status).toBe("error");
    expect(Object.hasOwn(lauf, "erzeugt")).toBe(false);
  });
});

describe("Ben R2 B1: kein Anbietertext im Laufdatensatz", () => {
  it("H1 · HTTP 400 zitiert die Anfrage (JSON-Körper): die Marke steht nirgends im Lauf", async () => {
    const MARKE = "BEN_SYNTHETISCHE_ANFRAGE_42";
    const client = zitierenderAnbieter((anfrage) =>
      JSON.stringify({
        error: {
          message: `Invalid request: ${anfrage.includes(MARKE) ? MARKE : "?"}`,
          code: "invalid_request_error",
        },
      }),
    );
    const { reasoner, repo } = await aufbau(client);

    await reasoner.structure(`${MARKE} Pumpe schmieren.`, "de");

    const lauf = await einzigerLauf(repo);
    expect(JSON.stringify(lauf)).not.toContain(MARKE);
    expect(lauf.error).toContain("antwortete mit 400 (Anbieterbegründung nicht protokolliert)");
  });

  it("H2 · HTTP 400 mit rohem Textkörper, der die Anfrage enthält: ebenfalls nicht im Lauf", async () => {
    const MARKE = "BEN_ROHTEXT_ANFRAGE_43";
    const client = zitierenderAnbieter(
      (anfrage) => `bad request near: ${anfrage.includes(MARKE) ? MARKE : "?"}`,
    );
    const { reasoner, repo } = await aufbau(client);

    await reasoner.structure(`${MARKE} Pumpe schmieren.`, "de");

    const lauf = await einzigerLauf(repo);
    expect(JSON.stringify(lauf)).not.toContain(MARKE);
    expect(lauf.error).toContain("antwortete mit 400");
  });
});

describe("Ben R3 B7: eine verworfene Modellantwort ist ein fehlgeschlagener Versuch", () => {
  for (const [art, urteilen] of [
    ["conflict", (r: Reasoner) => r.judgeConflictOutcome("Kern A", "Kern B", "de", false)],
    ["duplicate", (r: Reasoner) => r.judgeDuplicateOutcome("Kern A", "Kern B", "de", false)],
  ] as const) {
    it(`V1 · ${art}: Nicht-JSON-Antwort → Lauf error UND Versuch fehler`, async () => {
      const { reasoner, repo } = await aufbau(modell(async () => `${ANTWORTMARKE} kein Urteil`));

      const ausgang = await urteilen(reasoner);

      expect(ausgang.verdict).toBeNull();
      expect(ausgang.failure).toBe("model-error");
      const lauf = await einzigerLauf(repo);
      expect(lauf.status).toBe("error");
      expect(lauf.error).toContain("Antwort unverwertbar");
      expect(lauf.versuche?.map((v) => [v.model, v.ausgang, v.verbrauch?.eingabeToken])).toEqual([
        ["test-modell", "fehler", 23],
      ]);
    });
  }

  it("V2 · Gegenprobe: ein verwertbares Urteil bleibt ein erfolgreicher Versuch", async () => {
    const { reasoner, repo } = await aufbau(modell(async () => KONFLIKT_JSON));

    await reasoner.judgeConflictOutcome("Kern A", "Kern B", "de", false);

    const lauf = await einzigerLauf(repo);
    expect(lauf.versuche?.map((v) => v.ausgang)).toEqual(["erfolg"]);
  });
});

describe("Ben R2 B3: Kosten je Versuch zum Preis seines Modells", () => {
  it("C1 · teures Modell scheitert nach 1000 Token, billiges antwortet mit 1000: 0,011 EUR, nicht 0,002", async () => {
    const inner = new InMemoryModelRunRepo();
    const protokoll = new ProtokollModelRunRepo(inner, ZWEI_PREISE);
    const reasoner = new Reasoner(
      new ModelProvider(preisModell("teuer", 1000, new Error("Modell-API antwortete mit 500"))),
      new DeterministicProvider(),
      protokoll,
      undefined,
      new ModelProvider(preisModell("lokal-billig", 1000, "Ein ganz anderer, geglätteter Satz.")),
    );
    await erteileKiFreigabe(reasoner);

    await reasoner.assistText("Roher Satz, der geglättet werden soll.", "de");

    const [lauf] = await inner.recent(10);
    expect(lauf?.status).toBe("success");
    expect(lauf?.verbrauch?.eingabeToken).toBe(2000);
    expect(lauf?.versuche?.map((v) => [v.model, v.ausgang, v.verbrauch?.eingabeToken])).toEqual([
      ["teuer", "fehler", 1000],
      ["lokal-billig", "erfolg", 1000],
    ]);
    expect(lauf?.kosten).toEqual({ betrag: 0.011, waehrung: "EUR", preisstand: "r2" });

    const auswertung = await new ModelRunService({ repo: protokoll }).auswertung(
      "2000-01-01T00:00:00.000Z",
      "2100-01-01T00:00:00.000Z",
    );
    expect(auswertung.kosten).toEqual([{ waehrung: "EUR", betrag: 0.011, laeufe: 1 }]);
  });

  it("C2 · Laufbuch-Weg (conflict): der Versuch trägt Modell und Verbrauch, die Kosten folgen daraus", async () => {
    const inner = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(
      new ModelProvider(preisModell("teuer", 1000, KONFLIKT_JSON)),
      new DeterministicProvider(),
      new ProtokollModelRunRepo(inner, ZWEI_PREISE),
    );
    await erteileKiFreigabe(reasoner);

    await reasoner.judgeConflictOutcome("Kern A", "Kern B", "de", false);

    const [lauf] = await inner.recent(10);
    expect(lauf?.versuche).toHaveLength(1);
    expect(lauf?.versuche?.[0]?.model).toBe("teuer");
    expect(lauf?.kosten?.betrag).toBe(0.01);
  });

  it("C3 · Ben R3 B3 (N3): das teure Modell meldet keinen Verbrauch → keine Kosten, als unbelegt gezählt", async () => {
    const ohneMeldung: ModelClient = cappedModelClient(
      {
        name: "anthropic:teuer",
        model: "teuer",
        complete: async () => {
          throw new Error("Modell-API antwortete mit 500");
        },
      },
      { rejectsConfidential: true },
    );
    const inner = new InMemoryModelRunRepo();
    const protokoll = new ProtokollModelRunRepo(inner, ZWEI_PREISE);
    const reasoner = new Reasoner(
      new ModelProvider(ohneMeldung),
      new DeterministicProvider(),
      protokoll,
      undefined,
      new ModelProvider(preisModell("lokal-billig", 1000, "Ein ganz anderer, geglätteter Satz.")),
    );
    await erteileKiFreigabe(reasoner);

    await reasoner.assistText("Roher Satz, der geglättet werden soll.", "de");

    const lauf = await einzigerLauf(inner);
    expect(lauf.versuche?.map((v) => [v.model, v.ausgang, v.verbrauch?.eingabeToken])).toEqual([
      ["teuer", "fehler", undefined],
      ["lokal-billig", "erfolg", 1000],
    ]);
    // Bis Runde 3: kosten.betrag = 0,001 — als wäre der teure Versuch kostenfrei gewesen.
    expect(Object.hasOwn(lauf, "kosten")).toBe(false);
    const auswertung = await new ModelRunService({ repo: protokoll }).auswertung(
      "2000-01-01T00:00:00.000Z",
      "2100-01-01T00:00:00.000Z",
    );
    expect(auswertung.kosten).toEqual([]);
    expect(auswertung.verbrauchOhneKosten).toBe(1);
  });
});
