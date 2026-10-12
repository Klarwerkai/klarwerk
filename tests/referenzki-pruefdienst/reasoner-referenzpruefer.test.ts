// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02) — DER REFERENZ-PRÜFER AM ECHTEN REASONER.
// ================================================================================================
//
// Gemessen am echten `Reasoner`: Kettenbau, Freigaben, Anbieterwahl, Laufbuch und Laufprotokoll
// sind der Bestand. Ersetzt sind nur die Modelle — fiktive Doppelgänger mit fiktiven
// Modellbezeichnern, ohne Netz.
//
//   P1 (K1/K7) · das tatsächliche Antwortmodell wird je Anfrage festgehalten; gewählt wird die erste
//                erlaubte Option mit einem ANDEREN Modell — bei dynamischer Wahl je Anfrage neu
//   P2 (K7)    · nur administrativ erlaubte Optionen; sonst bleibt der Nachweis offen
//   P3 (K6/K7) · nicht eingerichtet, Antwortmodell unbekannt, Freigabe fehlt, vertraulich
//   P4 (K1/K9) · genau EIN Aufruf über den Chokepoint, ein Laufprotokoll `referenz` mit Modell,
//                Verbrauch und Dauer; ein Ausfall wird ebenso protokolliert, ohne zweiten Versuch
//   P5         · die Adminliste: normalisiert, weglassen = unverändert, `null` = aus, Unbekanntes =
//                Fehler, überlebt den Neustart
import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import {
  type AnswerResult,
  DeterministicProvider,
  InMemoryReasonerPolicyRepo,
  type KnowledgeRef,
  type ModelClient,
  ModelProvider,
  Reasoner,
  type ReasonerProvider,
  antwortRolleVon,
  cappedModelClient,
} from "../../services/reasoner";
import { meldeModellVerbrauch } from "../../services/reasoner/src/model-concurrency";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const FRAGE = "Mit welchem Druck fördert die Pumpe P7?";
const KONTEXT: KnowledgeRef[] = [
  {
    id: "ko-fiktiv-pumpe",
    title: "Pumpe P7 Förderdruck",
    statement: "Die Pumpe P7 fördert mit höchstens 3 bar.",
    status: "validiert",
    trust: 90,
  },
];

/** Ein fiktives Modell, das antworten UND prüfen kann — und zählt, wie oft es geprüft hat. */
function modell(name: string, bezeichner: string) {
  const basis = new DeterministicProvider();
  let pruefungen = 0;
  const provider = Object.assign(Object.create(basis) as ReasonerProvider, {
    name,
    isAvailable: () => true,
    modelName: () => bezeichner,
    answer: async (): Promise<AnswerResult> => ({
      ...(await basis.answer(FRAGE, KONTEXT)),
      answered: true,
      answer: "Die Pumpe P7 fördert mit höchstens 3 bar. [1]",
      sources: ["ko-fiktiv-pumpe"],
      citedSources: ["ko-fiktiv-pumpe"],
      demo: false,
    }),
    pruefeQuellenbeleg: async () => {
      pruefungen += 1;
      return '{"richtlinie":"referenzpruefung-v1","ergebnisse":[]}';
    },
  });
  return { provider, pruefungen: () => pruefungen };
}

function aufbau() {
  const openai = modell("cloud:openai:gpt-fiktiv", "gpt-fiktiv-1");
  const anthropic = modell("anthropic:claude-fiktiv", "claude-fiktiv-2");
  const lokal = modell("local:lokal-fiktiv", "lokal-fiktiv-3");
  const runs = new InMemoryModelRunRepo();
  const policy = new InMemoryReasonerPolicyRepo();
  const reasoner = new Reasoner(undefined, undefined, runs, undefined, lokal.provider, policy, {
    anbieter: { openai: openai.provider, anthropic: anthropic.provider },
  });
  return { reasoner, openai, anthropic, lokal, runs, policy };
}

describe("REF-02 · P1 — tatsächliches Antwortmodell je Anfrage, anderes Prüfmodell", () => {
  it("P1 · Antwort von OpenAI ⇒ Prüfer Anthropic; nach Umstellung Antwort von Anthropic ⇒ Prüfer OpenAI", async () => {
    const { reasoner } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, referenzpruefung: ["openai", "anthropic"] }),
    );
    const erste = await reasoner.answer(FRAGE, KONTEXT, "de");
    const rolleA = antwortRolleVon(erste);
    expect(rolleA).toEqual({
      anbieter: "cloud:openai:gpt-fiktiv",
      modell: "gpt-fiktiv-1",
      stufe: "cloud",
    });
    const wahlA = reasoner.referenzPruefer(rolleA, false);
    expect("pruefer" in wahlA && wahlA.pruefer.rolle).toEqual({
      anbieter: "anthropic:claude-fiktiv",
      modell: "claude-fiktiv-2",
      stufe: "cloud",
    });
    expect("pruefer" in wahlA && wahlA.pruefer.extern).toBe(true);

    // Dynamische Wahl: dieselbe Adminliste, aber die Antwort kommt jetzt von Anthropic.
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));
    const zweite = await reasoner.answer(FRAGE, KONTEXT, "de");
    const rolleB = antwortRolleVon(zweite);
    expect(rolleB?.modell).toBe("claude-fiktiv-2");
    const wahlB = reasoner.referenzPruefer(rolleB, false);
    expect("pruefer" in wahlB && wahlB.pruefer.rolle.modell).toBe("gpt-fiktiv-1");
    // Die Rolle hängt am Ergebnisobjekt, nicht im Antwortvertrag.
    expect(Object.keys(zweite)).not.toContain("rolle");
    expect(JSON.stringify(zweite)).not.toContain("claude-fiktiv-2");
  });

  it("P1b · der deterministische Rückfall hat kein Modell — die erste erlaubte Option ist unabhängig", async () => {
    // Ein Reasoner ohne jedes Modell: die Antwort kommt vom deterministischen Rückfall, ohne dass
    // die KI administrativ abgeschaltet wäre (keine gespeicherte Wahl `deterministic`, D5).
    const ohneModell = new Reasoner(undefined, undefined, new InMemoryModelRunRepo());
    const rolle = antwortRolleVon(await ohneModell.answer(FRAGE, KONTEXT, "de"));
    expect(rolle).toMatchObject({ modell: null, stufe: "deterministic" });

    const { reasoner } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, referenzpruefung: ["openai"] }),
    );
    const wahl = reasoner.referenzPruefer(rolle, false);
    expect("pruefer" in wahl && wahl.pruefer.rolle.modell).toBe("gpt-fiktiv-1");
  });

  it("P1c · GEGENPROBE — gespeicherte Wahl `deterministic` ist die KI-Abschaltung (D5): kein Prüfer", async () => {
    const { reasoner, openai } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "deterministic", perTask: {}, referenzpruefung: ["openai"] }),
    );
    expect(reasoner.kiAbschaltung().abgeschaltet).toBe(true);
    const wahl = reasoner.referenzPruefer(
      { anbieter: "deterministic", modell: null, stufe: "deterministic" },
      false,
    );
    expect(wahl).toEqual({ grund: "nicht_freigegeben" });
    expect(openai.pruefungen()).toBe(0);
  });
});

describe("REF-02 · P2 — nur administrativ erlaubte Optionen", () => {
  it("P2 · erlaubt ist nur OpenAI, die Antwort kam von OpenAI ⇒ kein Ersatz außerhalb der Liste", async () => {
    const { reasoner, anthropic } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, referenzpruefung: ["openai"] }),
    );
    const rolle = antwortRolleVon(await reasoner.answer(FRAGE, KONTEXT, "de"));
    expect(reasoner.referenzPruefer(rolle, false)).toEqual({ grund: "nicht_unabhaengig" });
    expect(anthropic.pruefungen()).toBe(0);
  });

  it("P2b · die Reihenfolge der Liste entscheidet: lokal vor Anthropic", async () => {
    const { reasoner } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, referenzpruefung: ["local", "anthropic"] }),
    );
    const rolle = antwortRolleVon(await reasoner.answer(FRAGE, KONTEXT, "de"));
    const wahl = reasoner.referenzPruefer(rolle, false);
    expect("pruefer" in wahl && wahl.pruefer.rolle).toEqual({
      anbieter: "local:lokal-fiktiv",
      modell: "lokal-fiktiv-3",
      stufe: "local",
    });
    expect("pruefer" in wahl && wahl.pruefer.extern).toBe(false);
  });
});

describe("REF-02 · P3 — benannte Gründe statt eines Ersatzes", () => {
  const rolle = {
    anbieter: "cloud:openai:gpt-fiktiv",
    modell: "gpt-fiktiv-1",
    stufe: "cloud" as const,
  };

  it("P3a · ohne Liste: nicht eingerichtet; ohne Antwortrolle: Antwortmodell unbekannt", async () => {
    const { reasoner } = aufbau();
    expect(reasoner.referenzPruefer(rolle, false)).toEqual({ grund: "nicht_eingerichtet" });
    await reasoner.setTaskConfig({
      global: "openai",
      perTask: {},
      referenzpruefung: ["anthropic"],
    });
    expect(reasoner.referenzPruefer(undefined, false)).toEqual({
      grund: "antwortmodell_unbekannt",
    });
  });

  it("P3b · externe Option ohne Adminfreigabe ⇒ nicht freigegeben; vertraulich ohne zweite Freigabe ebenso", async () => {
    const { reasoner } = aufbau();
    await reasoner.setTaskConfig({
      global: "openai",
      perTask: {},
      referenzpruefung: ["anthropic"],
    });
    expect(reasoner.referenzPruefer(rolle, false)).toEqual({ grund: "nicht_freigegeben" });
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    expect("pruefer" in reasoner.referenzPruefer(rolle, false)).toBe(true);
    expect(reasoner.referenzPruefer(rolle, true)).toEqual({ grund: "nicht_freigegeben" });
    expect(reasoner.externeVerarbeitungErlaubt(false)).toBe(true);
    expect(reasoner.externeVerarbeitungErlaubt(true)).toBe(false);
  });

  it("P3c · eine nicht eingerichtete Option ⇒ nicht verfügbar", async () => {
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(undefined, undefined, runs);
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "auto", perTask: {}, referenzpruefung: ["anthropic", "local"] }),
    );
    expect(reasoner.referenzPruefer(rolle, false)).toEqual({ grund: "nicht_verfuegbar" });
  });
});

/** Ein roher fiktiver Client — durch den echten Chokepoint (`cappedModelClient`) gereicht. */
function client(bezeichner: string, verhalten: () => string | Error) {
  let aufrufe = 0;
  const roh: ModelClient = {
    name: `anthropic:${bezeichner}`,
    model: bezeichner,
    complete: async () => {
      aufrufe += 1;
      meldeModellVerbrauch(321, 45);
      const ergebnis = verhalten();
      if (ergebnis instanceof Error) {
        throw ergebnis;
      }
      return ergebnis;
    },
  };
  return {
    provider: new ModelProvider(cappedModelClient(roh, { rejectsConfidential: true })),
    aufrufe: () => aufrufe,
  };
}

describe("REF-02 · P4 — ein Aufruf, ein Laufprotokoll mit Modell, Verbrauch und Dauer", () => {
  it("P4a · Erfolg: Laufart `referenz`, tatsächliches Prüfmodell, gemeldeter Verbrauch", async () => {
    const pruef = client("claude-fiktiv-2", () => '{"ergebnisse":[]}');
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(undefined, undefined, runs, undefined, undefined, undefined, {
      anbieter: { anthropic: pruef.provider },
    });
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "anthropic", perTask: {}, referenzpruefung: ["anthropic"] }),
    );
    const wahl = reasoner.referenzPruefer(
      { anbieter: "local:lokal-fiktiv", modell: "lokal-fiktiv-3", stufe: "local" },
      false,
    );
    if (!("pruefer" in wahl)) {
      throw new Error(`kein Prüfer: ${wahl.grund}`);
    }
    const ergebnis = await wahl.pruefer.pruefe("SYSTEM", "DATEN", false, 1500);
    expect(ergebnis.text).toBe('{"ergebnisse":[]}');
    expect(ergebnis.verbrauch).toEqual({ eingabe: 321, ausgabe: 45 });
    expect(ergebnis.dauerMs).toBeGreaterThanOrEqual(0);
    expect(pruef.aufrufe()).toBe(1);
    const laeufe = await runs.recent();
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]).toMatchObject({
      task: "referenz",
      status: "success",
      provider: "anthropic:claude-fiktiv-2",
      model: "claude-fiktiv-2",
      verbrauch: { eingabeToken: 321, ausgabeToken: 45 },
      erzeugt: { art: "urteil", anzahl: 1 },
    });
    expect(laeufe[0]?.versuche).toHaveLength(1);
  });

  it("P4b · Ausfall: der Fehler geht an den Prüfdienst, protokolliert, und es gibt KEINEN zweiten Versuch", async () => {
    const pruef = client("claude-fiktiv-2", () => new Error("Anbieter antwortete mit 503"));
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(undefined, undefined, runs, undefined, undefined, undefined, {
      anbieter: { anthropic: pruef.provider },
    });
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "anthropic", perTask: {}, referenzpruefung: ["anthropic"] }),
    );
    const wahl = reasoner.referenzPruefer(
      { anbieter: "deterministic", modell: null, stufe: "deterministic" },
      false,
    );
    if (!("pruefer" in wahl)) {
      throw new Error(`kein Prüfer: ${wahl.grund}`);
    }
    await expect(wahl.pruefer.pruefe("SYSTEM", "DATEN", false, 1500)).rejects.toThrow();
    expect(pruef.aufrufe()).toBe(1);
    const laeufe = await runs.recent();
    expect(laeufe.map((l) => [l.task, l.status, l.model])).toEqual([
      ["referenz", "error", "claude-fiktiv-2"],
    ]);
  });

  it("P4c · vertraulicher Inhalt an einen externen Prüfer ohne zweite Freigabe: kein Aufruf am Chokepoint", async () => {
    const pruef = client("claude-fiktiv-2", () => '{"ergebnisse":[]}');
    const runs = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(undefined, undefined, runs, undefined, undefined, undefined, {
      anbieter: { anthropic: pruef.provider },
    });
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "anthropic", perTask: {}, referenzpruefung: ["anthropic"] }),
    );
    const wahl = reasoner.referenzPruefer(
      { anbieter: "deterministic", modell: null, stufe: "deterministic" },
      false,
    );
    if (!("pruefer" in wahl)) {
      throw new Error(`kein Prüfer: ${wahl.grund}`);
    }
    await expect(wahl.pruefer.pruefe("SYSTEM", "DATEN", true, 1500)).rejects.toMatchObject({
      name: "ConfidentialEgressError",
    });
    expect(pruef.aufrufe()).toBe(0);
  });
});

describe("REF-02 · P5 — die Adminliste der Referenz-Prüfer", () => {
  it("P5 · normalisiert, weglassen = unverändert, null = aus, Unbekanntes = Fehler, Neustart überlebt", async () => {
    const { reasoner, policy } = aufbau();
    const gesetzt = await reasoner.setTaskConfig({
      global: "auto",
      perTask: {},
      referenzpruefung: ["anthropic", "local", "anthropic"],
    });
    expect(gesetzt.referenzpruefung).toEqual(["anthropic", "local"]);
    const ohne = await reasoner.setTaskConfig({ global: "auto", perTask: {} });
    expect(ohne.referenzpruefung).toEqual(["anthropic", "local"]);
    await expect(
      reasoner.setTaskConfig({
        global: "auto",
        perTask: {},
        referenzpruefung: ["deterministic" as never],
      }),
    ).rejects.toThrow("Referenzprüfung");
    expect(reasoner.getTaskConfig().referenzpruefung).toEqual(["anthropic", "local"]);

    // Neustart: ein neuer Reasoner auf demselben Policy-Speicher lädt die Liste.
    const neu = new Reasoner(undefined, undefined, undefined, undefined, undefined, policy);
    await neu.loadPersistedPolicy();
    expect(neu.getTaskConfig().referenzpruefung).toEqual(["anthropic", "local"]);

    const aus = await reasoner.setTaskConfig({
      global: "auto",
      perTask: {},
      referenzpruefung: null,
    });
    expect(aus.referenzpruefung).toBeUndefined();
    const leer = await reasoner.setTaskConfig({
      global: "auto",
      perTask: {},
      referenzpruefung: [],
    });
    expect(leer.referenzpruefung).toBeUndefined();
  });
});
