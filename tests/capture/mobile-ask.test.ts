import { describe, expect, it } from "vitest";
import type { AnswerResult, Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import type { ConflictKnowledge } from "../../apps/web/src/lib/effectiveAnswer";
import { summarizeAnswer } from "../../apps/web/src/lib/mobileAsk";

const answer = (p: Partial<AnswerResult>): AnswerResult =>
  ({
    answered: true,
    answer: "Ventil X schließen.",
    knowledgeClass: "gesichert",
    trust: 80,
    sources: ["ko1", "ko2"],
    // mega53 B1: beide Quellen tragen die Antwort.
    citedSources: ["ko1", "ko2"],
    steps: [{ description: "Quelle: K1", sourceId: "ko1", snippet: "…" }],
    demo: false,
    ...p,
  }) as AnswerResult;

const PROVEN = {
  available: 3,
  selected: 3,
  alreadyOpen: 0,
  attempted: 3,
  completed: 3,
  skipped: 0,
  capped: false,
  aborted: false,
};

const ko = (id: string): KnowledgeObject =>
  ({
    id,
    title: `KO ${id}`,
    statement: "Aussage",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: { status: "done", coverage: PROVEN },
  }) as unknown as KnowledgeObject;

// AUFTRAG-mega34 A1: der Konfliktstand reist mit seiner Herkunft. „Keine Konflikte" heißt hier
// ausdrücklich ERFOLGREICH GELADEN und leer — nicht „wir wissen nichts".
const NO_CONFLICTS: ConflictKnowledge = { state: "loaded", items: [] as readonly Conflict[] };

describe("SCRUM-113 / FE-MOB-03: summarizeAnswer", () => {
  it("verdichtet eine beantwortete Frage inkl. Evidenz/Trust/Quellen", () => {
    // AUFTRAG-mega33 A2: „gesichert" trägt die mobile Plakette nur noch mit belegtem Prüf-Lauf.
    const s = summarizeAnswer(answer({}), [ko("ko1"), ko("ko2")], NO_CONFLICTS);
    expect(s.answered).toBe(true);
    expect(s.text).toBe("Ventil X schließen.");
    expect(s.trust).toBe(80);
    expect(s.grade).toBe("verified");
    expect(s.evidence.tone).toBe("pos"); // gesichert → positiv
    expect(s.evidence.labelKey).toBe("ask.knowledgeClass.gesichert");
    expect(s.caveat).toBeNull();
    expect(s.sources.map((r) => r.id)).toEqual(["ko1", "ko2"]);
    expect(s.sources.map((r) => r.label)).toEqual(["KO ko1", "KO ko2"]);
    expect(s.stepCount).toBe(1);
  });

  it("AUFTRAG-mega33 A2: ohne belegten Lauf zeigt auch Mobile kein „Gesichert“ mehr", () => {
    // Dieselbe Antwort, aber der Bestand kennt die Quellen nicht — fail-safe unbelegt.
    const s = summarizeAnswer(answer({}), [], NO_CONFLICTS);
    expect(s.grade).toBe("unverified");
    expect(s.evidence.labelKey).not.toBe("ask.knowledgeClass.gesichert");
    expect(s.status.key).toBe("unverified");
    // Und der Vorbehalt benennt, worauf er sich bezieht — wie auf dem Desktop.
    expect(s.caveat).toEqual({ reason: "unknown", unproven: 2, total: 2 });
  });

  it("No-Basis: answered=false, kein Text, Evidenz unbekannt → kritisch", () => {
    const s = summarizeAnswer(
      answer({
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
      }),
      [],
      NO_CONFLICTS,
    );
    expect(s.answered).toBe(false);
    expect(s.text).toBeNull();
    expect(s.grade).toBe("gap");
    expect(s.evidence.tone).toBe("crit");
    expect(s.sources).toEqual([]);
    expect(s.stepCount).toBe(0);
  });
});
