// ================================================================================================
// AUFNAHME 20260922 · gesamt-reasoner-vertrag — DIE SECHS AUFGABEN, EINE SCHICHT, DAS MODELL IST
// EINSTELLUNGSSACHE.
// ================================================================================================
//
// Originalwortlaut (R-0687): „Die gesamte KI steckt hinter einer gekapselten Schicht mit sechs
// Aufgaben: Strukturieren, Antworten, Interview, Kandidaten-Auswahl, Zweitmeinung und Schreibhilfe.
// Welches Modell dahinter arbeitet, ist reine Einstellungssache." Dazu FR-RSN-01 („Alle Aufgaben über
// die Reasoner-Schicht verfügbar") und FR-RSN-02 / NFR-MNT-01 („Modellwechsel per Konfiguration;
// Fachlogik unverändert").
//
// WAS DIESE DATEI NEU BELEGT. Jede Aufgabe ist an anderer Stelle einzeln geprüft; der Anbieterwechsel
// per Einstellung am echten Netzweg in `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`. Gefehlt
// hat die eine Aussage über ALLE SECHS zugleich: dieselbe Fachlogik (`sechsAufgaben` unten, ein
// einziger Funktionskörper) erreicht über die eine Schicht genau das Glied, das die Einstellung
// bestimmt — und nichts an ihr ändert sich, wenn das Modell wechselt.
//
// DIE ZUORDNUNG Quelle → Schicht (die Namen im Entwurf `specs/stories/reasoner.md` weichen ab):
//   Strukturieren      → `Reasoner.structure`
//   Antworten          → `Reasoner.answer`
//   Interview          → `Reasoner.interview`
//   Kandidaten-Auswahl → `Reasoner.select`               (Entwurf: `search`)
//   Zweitmeinung       → `Reasoner.judgeConflictOutcome` (Entwurf: `secondOpinion`; die
//                         Konfliktprüfung urteilt unabhängig über zwei Kerntexte)
//   Schreibhilfe       → `Reasoner.assistText`           (Entwurf: `assist`)
//
// WARUM EIN EIGENES LOKALES GLIED UND KEINE CLOUD-ATTRAPPE. Öffentliche KI braucht die ausdrückliche
// Adminfreigabe (JOB 3549), und wer sie im Test setzt, steht namentlich im Register des Freigabe-
// Wächters. Diese Aussage braucht keine öffentliche KI: ein lokal verdrahtetes Modell durchläuft
// dieselbe Kettenbildung (`chainForChoice`) wie jede Cloud. Der Wechsel zwischen ChatGPT und Claude
// selbst ist dort gemessen, wo er hingehört (s. oben).
import { describe, expect, it } from "vitest";
import {
  type AnswerResult,
  type AssistResult,
  type ConflictJudgeResult,
  type ExtractResult,
  type InterviewResult,
  type KnowledgeRef,
  REASONER_TASKS,
  Reasoner,
  type ReasonerProvider,
  type StructureResult,
} from "../../services/reasoner";

/**
 * Ein Modell hinter der Schicht — es zeichnet jeden Aufruf auf und stempelt sein Ergebnis mit dem
 * eigenen Namen, damit ein falsches Glied am ERGEBNIS auffällt und nicht nur an der Aufrufliste.
 */
class ModellAttrappe implements ReasonerProvider {
  readonly name: string;
  readonly aufrufe: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  isAvailable(): boolean {
    return true;
  }

  async structure(rawText: string): Promise<StructureResult> {
    this.aufrufe.push("structure");
    return {
      title: `${this.name}: ${rawText}`,
      statement: rawText,
      conditions: [],
      measures: [],
      tags: [],
      confidence: 0.9,
      demo: false,
    };
  }

  async answer(question: string, context: readonly KnowledgeRef[]): Promise<AnswerResult> {
    this.aufrufe.push("answer");
    const ids = context.map((ref) => ref.id);
    return {
      answered: true,
      answer: `${this.name}: ${question}`,
      knowledgeClass: "gesichert",
      trust: 1,
      sources: ids,
      citedSources: ids,
      steps: [],
      demo: false,
    };
  }

  async assistText(text: string): Promise<AssistResult> {
    this.aufrufe.push("assistText");
    return { text: `${this.name}: ${text}`, demo: false };
  }

  async interview(answers: readonly string[]): Promise<InterviewResult> {
    this.aufrufe.push("interview");
    return {
      question: `${this.name}: Frage ${answers.length + 1}`,
      done: false,
      draft: {
        title: "",
        statement: "",
        conditions: [],
        measures: [],
        tags: [],
        confidence: 0,
        demo: false,
      },
      demo: false,
    };
  }

  async extract(): Promise<ExtractResult> {
    this.aufrufe.push("extract");
    return { points: [], note: null, demo: false };
  }

  select(_question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    this.aufrufe.push("select");
    return [...candidates];
  }

  async judgeConflict(coreA: string, coreB: string): Promise<ConflictJudgeResult> {
    this.aufrufe.push("judgeConflict");
    return {
      relation: "widerspruch",
      older: null,
      confidence: 0.8,
      begruendung: this.name,
      zitat_a: coreA,
      zitat_b: coreB,
    };
  }
}

const BESTAND: KnowledgeRef[] = [
  {
    id: "ko-ventil-v3",
    title: "Ventil V3 prüfen",
    statement: "Das Ventil V3 wird monatlich geprüft.",
    status: "validiert",
    trust: 0.9,
  },
];

/** Die Reihenfolge, in der `sechsAufgaben` die Schicht ruft — Name der Provider-Methode je Aufgabe. */
const ALLE_SECHS = [
  "structure",
  "answer",
  "interview",
  "select",
  "judgeConflict",
  "assistText",
] as const;

/**
 * DIE FACHLOGIK. Ein Funktionskörper für jeden Fall dieser Datei: was sich zwischen den Fällen
 * unterscheidet, ist allein, welches Modell verdrahtet bzw. eingestellt ist — nie diese Zeilen.
 */
async function sechsAufgaben(reasoner: Reasoner) {
  return {
    strukturieren: await reasoner.structure("Ventil V3 monatlich prüfen.", "de"),
    antworten: await reasoner.answer("Wie oft wird das Ventil V3 geprüft?", BESTAND, "de"),
    interview: await reasoner.interview([], "de"),
    kandidatenAuswahl: reasoner.select("Ventil V3 prüfen", BESTAND),
    zweitmeinung: await reasoner.judgeConflictOutcome(
      "Das Ventil V3 wird monatlich geprüft.",
      "Das Ventil V3 wird jährlich geprüft.",
      "de",
    ),
    schreibhilfe: await reasoner.assistText("ventil v3 monatlich prüfen", "de"),
  };
}

/** Ein Reasoner mit genau EINEM Modell hinter der Schicht (lokal verdrahtet, s. Kopf). */
function schichtMit(modell: ModellAttrappe): Reasoner {
  return new Reasoner(undefined, undefined, undefined, undefined, modell);
}

describe("gesamt-reasoner-vertrag: sechs Aufgaben über eine austauschbare Schicht", () => {
  it("V1 · alle sechs Aufgaben der Quelle erreichen über die Schicht das verdrahtete Modell", async () => {
    const modellA = new ModellAttrappe("modell-a");
    const ergebnis = await sechsAufgaben(schichtMit(modellA));

    expect(modellA.aufrufe).toEqual([...ALLE_SECHS]);
    expect(ergebnis.strukturieren.title).toBe("modell-a: Ventil V3 monatlich prüfen.");
    expect(ergebnis.strukturieren.demo).toBe(false);
    expect(ergebnis.antworten.answer).toBe("modell-a: Wie oft wird das Ventil V3 geprüft?");
    expect(ergebnis.antworten.demo).toBe(false);
    expect(ergebnis.interview.question).toBe("modell-a: Frage 1");
    expect(ergebnis.kandidatenAuswahl.map((ref) => ref.id)).toEqual(["ko-ventil-v3"]);
    expect(ergebnis.zweitmeinung.verdict?.begruendung).toBe("modell-a");
    expect(ergebnis.zweitmeinung.failure).toBeUndefined();
    expect(ergebnis.schreibhilfe).toEqual({
      text: "modell-a: ventil v3 monatlich prüfen",
      demo: false,
    });
  });

  it("V2 · ein anderes Modell hinter derselben Schicht: dieselbe Fachlogik, dieselben sechs Wege", async () => {
    const modellA = new ModellAttrappe("modell-a");
    const modellB = new ModellAttrappe("modell-b");
    await sechsAufgaben(schichtMit(modellA));
    const ergebnisB = await sechsAufgaben(schichtMit(modellB));

    // Beide Modelle bekommen exakt dieselbe Aufgabenfolge — die Fachlogik kennt keines von beiden.
    expect(modellB.aufrufe).toEqual(modellA.aufrufe);
    expect(modellA.aufrufe).toHaveLength(ALLE_SECHS.length);
    expect(ergebnisB.strukturieren.title).toBe("modell-b: Ventil V3 monatlich prüfen.");
    expect(ergebnisB.zweitmeinung.verdict?.begruendung).toBe("modell-b");
    expect(ergebnisB.schreibhilfe.text).toBe("modell-b: ventil v3 monatlich prüfen");
  });

  it("V3 · Umstellen per Einstellung: dieselben Aufrufe, anderes Glied — global und je Aufgabe", async () => {
    const modellA = new ModellAttrappe("modell-a");
    const reasoner = schichtMit(modellA);

    // Global ohne Modell, nur die Schreibhilfe bleibt beim Modell. Keine Codezeile ändert sich.
    await reasoner.setTaskConfig({ global: "deterministic", perTask: { assist: "local" } });
    const ohneModell = await sechsAufgaben(reasoner);

    expect(modellA.aufrufe).toEqual(["assistText"]);
    expect(ohneModell.strukturieren.demo).toBe(true);
    expect(ohneModell.strukturieren.fallbackReason).toBe("no-model");
    expect(ohneModell.antworten.demo).toBe(true);
    expect(ohneModell.interview.demo).toBe(true);
    // Die Zweitmeinung folgt der globalen Einstellung und urteilt ohne Modell ehrlich nicht.
    expect(ohneModell.zweitmeinung).toEqual({ verdict: null, failure: "no-model" });
    expect(ohneModell.schreibhilfe.text).toBe("modell-a: ventil v3 monatlich prüfen");
    const status = reasoner.configStatus();
    expect(status.effectiveProvider.structure).toBe("deterministic");
    expect(status.effectiveProvider.select).toBe("deterministic");
    expect(status.effectiveProvider.assist).toBe("local");

    // Zurück auf das Modell — wieder nur die Einstellung.
    await reasoner.setTaskConfig({ global: "local", perTask: {} });
    const mitModell = await sechsAufgaben(reasoner);

    expect(modellA.aufrufe).toEqual(["assistText", ...ALLE_SECHS]);
    expect(mitModell.strukturieren.demo).toBe(false);
    expect(mitModell.zweitmeinung.verdict?.begruendung).toBe("modell-a");
    expect(reasoner.configStatus().effectiveProvider.structure).toBe("local");
  });

  it("V4 · die fünf aufgabenbezogenen Aufgaben der Quelle sind je Aufgabe einstellbar", () => {
    // Die Zweitmeinung (Konfliktprüfung) hat bewusst keinen eigenen Eintrag: sie folgt der
    // globalen Einstellung — V3 belegt das am Ausgang „no-model" unter globalem `deterministic`.
    expect(REASONER_TASKS).toEqual(
      expect.arrayContaining(["structure", "answer", "interview", "select", "assist"]),
    );
  });
});
