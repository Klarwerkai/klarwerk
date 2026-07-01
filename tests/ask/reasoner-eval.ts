// SCRUM-368 / AG-04 / FR-RSN-03 / FR-ASK-02: repo-lokales Reasoner-/Ask-Eval-Set (Fixtures + Harness).
//
// Ziel: die Anti-Halluzinations-/Quellenbindungs-Garantien des Modellmodus NICHT nur per Prompt
// behaupten, sondern als dauerhafte Regression absichern — ohne echtes externes Modell, ohne API-Key,
// ohne RAG/Embeddings. Ein deterministischer bzw. „böswilliger" Fake-Modell-Client fährt die kanonischen
// Ask-Szenarien; die Tests (reasoner-eval.test.ts) prüfen die echten Contracts der ModelProvider-/
// Ask-/Contract-Kette. Reine Daten + Helfer, DOM-/serverfrei.
import type { KnowledgeRef, ModelClient } from "../../services/reasoner";

// Kanonische Wissensbasis für die Eval. Bewusst klein, mit klar getrennten Themen, damit Relevanz-Gate
// (Keyword-Überschneidung) eindeutig greift und irrelevante Quellen sichtbar draußen bleiben.
export const EVAL_KOS: readonly KnowledgeRef[] = [
  {
    id: "ko-ventil",
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck das Ventil X manuell schließen.",
    status: "validiert",
    trust: 92,
  },
  {
    id: "ko-filter",
    title: "Filter F3 bei Verstopfung wechseln",
    statement: "Filter F3 bei Verstopfung tauschen, sonst Druckabfall.",
    status: "offen", // ungeprüft
    trust: 10,
  },
  {
    id: "ko-kantine",
    title: "Kantine Speiseplan",
    statement: "Dienstags gibt es Suppe.",
    status: "validiert", // validiert, aber thematisch irrelevant für Anlagenfragen
    trust: 80,
  },
];

export const KO = {
  ventil: "ko-ventil",
  filter: "ko-filter",
  kantine: "ko-kantine",
} as const;

// Erwartete Knowledge-Class der ANTWORT (aus dem Status des besten Treffers) — oder "gap" ohne Basis.
export type EvalExpectedClass = "gesichert" | "ungeprueft" | "gap";

export interface EvalScenario {
  name: string;
  question: string;
  expectedClass: EvalExpectedClass;
  // Quellen, die die Antwort führen MUSS (nur echte KOs). Bei "gap" leer.
  mustCite: string[];
  // KOs, die NIEMALS als Antwortquelle erscheinen dürfen (irrelevant/offtopic).
  mustNotCite: string[];
  // KOs, deren Titel NIEMALS in den Modell-User-Prompt eingebettet werden dürfen (Kontext bleibt begrenzt).
  mustNotInPrompt: string[];
}

// Die kanonischen Ask-Szenarien der Eval (AG-04 / FR-RSN-03 / FR-ASK-02).
export const MODEL_EVAL_SCENARIOS: readonly EvalScenario[] = [
  {
    name: "gesicherte Antwort aus validierter Quelle",
    question: "Was tun bei Überdruck am Ventil?",
    expectedClass: "gesichert",
    mustCite: [KO.ventil],
    mustNotCite: [KO.kantine, KO.filter],
    mustNotInPrompt: [KO.kantine, KO.filter],
  },
  {
    name: "ungeprüfte Antwort aus offenem KO",
    question: "Wie gehe ich mit einem verstopften Filter F3 um?",
    expectedClass: "ungeprueft",
    mustCite: [KO.filter],
    mustNotCite: [KO.kantine, KO.ventil],
    mustNotInPrompt: [KO.kantine, KO.ventil],
  },
  {
    name: "ehrliche Lücke bei fehlender Wissensbasis",
    question: "Wie hoch ist der aktuelle Wechselkurs heute?",
    expectedClass: "gap",
    mustCite: [],
    mustNotCite: [KO.ventil, KO.filter, KO.kantine],
    mustNotInPrompt: [KO.ventil, KO.filter, KO.kantine],
  },
];

// Fake-Modell-Client, der System-/User-Prompts mitschneidet und eine feste Antwort liefert.
// Belegt, was das Modell TATSÄCHLICH bekommt (Leitplanken + begrenzte Quellen).
export function capturingModel(reply = "Modellantwort."): {
  client: ModelClient;
  calls: { system: string; user: string }[];
} {
  const calls: { system: string; user: string }[] = [];
  return {
    calls,
    client: {
      name: "eval-capture",
      complete: async (system, user) => {
        calls.push({ system, user });
        return reply;
      },
    },
  };
}

// „Böswilliges" Fake-Modell: es HALLUZINIERT im Freitext (erfundene Norm, erfundene Zahl, Fake-Zitat).
// Damit lässt sich beweisen, dass der Provider die erfundenen Inhalte NICHT in Quellen/Steps/Trust
// übernimmt — Quellenbindung kommt aus den Daten, nicht aus dem Modelltext.
export const HALLUCINATION_MARKERS = {
  fakeNorm: "DIN 99999",
  fakeNumber: "1234 bar",
  fakeCitation: '"Zitat aus Quelle 7"',
} as const;

export function hallucinatingModel(): ModelClient {
  return {
    name: "eval-hallucinate",
    complete: async () =>
      `Laut ${HALLUCINATION_MARKERS.fakeNorm} liegt der Grenzwert bei ${HALLUCINATION_MARKERS.fakeNumber}. ${HALLUCINATION_MARKERS.fakeCitation}. Zusätzliche erfundene Ursache: Materialermüdung durch kosmische Strahlung.`,
  };
}
