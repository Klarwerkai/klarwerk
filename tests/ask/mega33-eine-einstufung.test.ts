// ================================================================================================
// AUFTRAG-mega33 BLOCK A (Pedi 27.07., nach bens ROT 3 und ROT 4) — EINE EINSTUFUNG, VIELE ANZEIGEN.
// ================================================================================================
//
// DER BAU-FEHLER, den mega32 nicht behoben hat: die Absenkung griff NUR im Vertragskasten. Direkt
// darunter lasen Statusplakette, Evidenzplakette, Review-Wächter, Kopieren/Markdown-Download und
// die mobile Antwort WEITER aus der rohen Knowledge-Class. Eine Seite, die oben einen Prüfvorbehalt
// zeigt und darunter „Gesichert" — das ist keine Absenkung, das ist ein Selbstwiderspruch.
//
// DIESER TEST IST DIE AUSFÜHRBARE LISTE DER LESEFLÄCHEN. Jede Fläche wird gefragt, ob sie für
// dieselbe Antwort Sicherheit behauptet. Alle müssen dieselbe Antwort geben wie die EINE effektive
// Einstufung. Kommt eine Fläche dazu, die sich ihre Einstufung selbst bildet, fällt sie hier auf.
import { describe, expect, it } from "vitest";
import type { AnswerResult, Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { buildAnswerMarkdown } from "../../apps/web/src/lib/answerExport";
import { type AnswerGrade, answerGrade } from "../../apps/web/src/lib/answerGrade";
import { answerContract } from "../../apps/web/src/lib/askAnswerContract";
import { answerReviewGuard, answerStatus } from "../../apps/web/src/lib/askView";
// AUFTRAG-mega34 A1: die Fälle hier reichen ihren Konfliktstand jetzt MIT seiner Herkunft durch —
// alle als `loaded`, denn dieser Test prüft die Regeln DAHINTER. Die drei Abrufzustände selbst
// stehen in mega34-konfliktstand-pflichtsignal.test.tsx.
import { type ConflictKnowledge, effectiveAnswer } from "../../apps/web/src/lib/effectiveAnswer";
import { summarizeAnswer } from "../../apps/web/src/lib/mobileAsk";

const PROVEN = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};
// Bens Fall: der Lauf meldet „done", nichts übersprungen, nichts abgebrochen — nur gedeckelt.
const CAPPED = {
  ...PROVEN,
  available: 12479,
  selected: 20,
  attempted: 20,
  completed: 20,
  capped: true,
};

function ko(id: string, aiCheck: unknown): KnowledgeObject {
  return {
    id,
    title: `Wissen ${id}`,
    statement: "Ventil V4 wird jährlich geprüft.",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck,
  } as unknown as KnowledgeObject;
}

function answer(over: Partial<AnswerResult> = {}): AnswerResult {
  return {
    answered: true,
    answer: "Ventil V4 wird jährlich geprüft.",
    knowledgeClass: "gesichert",
    trust: 90,
    sources: ["k1"],
    // mega53 B1: die Antwort steht auf dieser Quelle. Ohne Zuordnung waere sie seit
    // mega53 nie mehr "gesichert" — dieser Fall liegt in mega53-zwei-faelle.test.ts.
    citedSources: ["k1"],
    steps: [],
    demo: false,
    ...over,
  };
}

function truthConflict(koId: string): Conflict {
  return {
    id: "c1",
    koA: koId,
    koB: "k9",
    type: "truth",
    description: "Widerspruch",
    status: "offen",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Conflict;
}

// Die vollständige Liste der Leseflächen — ABGEZÄHLT: SECHS (Kopieren und Markdown-Download sind
// EIN Aufbauweg, buildExport, und stehen deshalb als eine Fläche). Jede liefert genau eine Antwort
// auf dieselbe Frage: „Behauptest du für diese Antwort Sicherheit?"
const SURFACES: ReadonlyArray<{
  name: string;
  claimsVerified: (
    a: AnswerResult,
    kos: KnowledgeObject[],
    conflicts: ConflictKnowledge,
  ) => boolean;
}> = [
  {
    name: "1 · Vertragskasten (Ask)",
    claimsVerified: (a, kos, conflicts) =>
      answerContract(effectiveAnswer(a, kos, conflicts).grade).kind === "verified",
  },
  {
    name: "2 · Statusplakette (Ask)",
    claimsVerified: (a, kos, conflicts) =>
      answerStatus(effectiveAnswer(a, kos, conflicts).grade).key === "verified",
  },
  {
    name: "3 · Evidenzplakette (Ask)",
    claimsVerified: (a, kos, conflicts) =>
      effectiveAnswer(a, kos, conflicts).evidence.labelKey === "ask.knowledgeClass.gesichert",
  },
  {
    name: "4 · Review-Wächter (Ask)",
    claimsVerified: (a, kos, conflicts) => {
      const eff = effectiveAnswer(a, kos, conflicts);
      // Kein Review-Hinweis bei beantworteter Frage = die Seite hält die Antwort für tragfähig.
      return eff.grade !== "gap" && answerReviewGuard(eff.grade, eff.sources) === null;
    },
  },
  {
    name: "5 · Kopieren / Markdown-Download (Ask)",
    claimsVerified: (a, kos, conflicts) => {
      const eff = effectiveAnswer(a, kos, conflicts);
      const md = buildAnswerMarkdown({
        question: "Wie oft wird V4 geprüft?",
        answer: a.answer ?? "",
        statusLabel: `status:${eff.status.key}`,
        evidenceLabel: `evidence:${eff.evidence.labelKey}`,
        trust: a.trust,
        steps: [],
        sources: [],
        generatedAt: "2026-07-27T00:00:00.000Z",
        labels: {
          answer: "Antwort",
          evidence: "Evidenz",
          trust: "Trust",
          steps: "Schritte",
          sources: "Quellen",
          footer: "{{date}}",
          // AUFTRAG-mega62 Block E: Pflichtfeld (s. answerExport.ts).
          aiNotice: "KI-erzeugt",
        },
      });
      return md.includes("status:verified") || md.includes("evidence:ask.knowledgeClass.gesichert");
    },
  },
  {
    name: "6 · mobile Antwort (Evidenzplakette)",
    claimsVerified: (a, kos, conflicts) =>
      summarizeAnswer(a, kos, conflicts).evidence.labelKey === "ask.knowledgeClass.gesichert",
  },
];

const CASES: ReadonlyArray<{
  name: string;
  answer: AnswerResult;
  kos: KnowledgeObject[];
  conflicts: ConflictKnowledge;
  grade: AnswerGrade;
}> = [
  {
    name: "gesichert + belegt vollständiger Lauf ⇒ und NUR das trägt ein „Gesichert“",
    answer: answer(),
    kos: [ko("k1", { status: "done", coverage: PROVEN })],
    conflicts: { state: "loaded", items: [] },
    grade: "verified",
  },
  {
    name: "gesichert, aber gedeckelter Lauf (bens Fall)",
    answer: answer(),
    kos: [ko("k1", { status: "done", coverage: CAPPED })],
    conflicts: { state: "loaded", items: [] },
    grade: "unverified",
  },
  {
    name: "gesichert, aber gar kein Prüf-Lauf",
    answer: answer(),
    kos: [ko("k1", undefined)],
    conflicts: { state: "loaded", items: [] },
    grade: "unverified",
  },
  {
    name: "gesichert, aber Quelle im Bestand unauffindbar (fail-safe)",
    answer: answer(),
    kos: [],
    conflicts: { state: "loaded", items: [] },
    grade: "unverified",
  },
  {
    name: "gesichert + belegt, aber offener Wahrheitskonflikt auf der Quelle",
    answer: answer(),
    kos: [ko("k1", { status: "done", coverage: PROVEN })],
    conflicts: { state: "loaded", items: [truthConflict("k1")] },
    grade: "unverified",
  },
  {
    name: "belegter Lauf, aber die Klasse selbst ist nicht gesichert",
    answer: answer({ knowledgeClass: "meinung" }),
    kos: [ko("k1", { status: "done", coverage: PROVEN })],
    conflicts: { state: "loaded", items: [] },
    grade: "unverified",
  },
  {
    name: "keine Antwort ⇒ Wissenslücke, keine Einstufung",
    answer: answer({ answered: false, answer: null, sources: [] }),
    kos: [],
    conflicts: { state: "loaded", items: [] },
    grade: "gap",
  },
];

describe("mega33 A · eine effektive Antwort-Einstufung, sechs Leseflächen", () => {
  for (const c of CASES) {
    it(`${c.name} ⇒ ${c.grade}`, () => {
      const eff = effectiveAnswer(c.answer, c.kos, c.conflicts);
      expect(eff.grade).toBe(c.grade);

      // A2 — KEINE Fläche liest danach noch die rohe Klasse. Alle sieben sagen dasselbe.
      for (const surface of SURFACES) {
        expect(surface.claimsVerified(c.answer, c.kos, c.conflicts), surface.name).toBe(
          c.grade === "verified",
        );
      }
    });
  }

  it("die Liste ist ABGEZÄHLT: sechs Leseflächen, keine doppelt", () => {
    expect(SURFACES).toHaveLength(6);
    expect(new Set(SURFACES.map((s) => s.name)).size).toBe(6);
  });

  // A3 — der Typvertrag lässt die Umgehung nicht mehr zu: `answerContract` bekommt die bereits
  // abgeleitete Einstufung, keine einzelnen Wahrheitswerte mehr. Ein Aufrufer KANN die
  // Abdeckungsbedingung nicht weglassen, weil er sie gar nicht mehr in der Hand hat.
  it("A3 · der Vertrag nimmt die Einstufung entgegen, nicht die Einzelsignale", () => {
    expect(answerContract("verified").kind).toBe("verified");
    expect(answerContract("unverified").kind).toBe("unverified");
    expect(answerContract("gap").kind).toBe("gap");
    // Und die Einstufung selbst verlangt ALLE vier Eingaben — keine ist optional.
    expect(
      answerGrade({
        answered: true,
        knowledgeClass: "gesichert",
        sourcesConflicted: false,
        sourcesCheckUnproven: true,
        conflictsUnproven: false,
      }),
    ).toBe("unverified");
  });

  it("die effektive Klasse behauptet im gedeckelten Fall kein „gesichert“ mehr", () => {
    const eff = effectiveAnswer(answer(), [ko("k1", { status: "done", coverage: CAPPED })], {
      state: "loaded",
      items: [],
    });
    expect(eff.knowledgeClass).not.toBe("gesichert");
    expect(eff.evidence.labelKey).not.toBe("ask.knowledgeClass.gesichert");
    // Die ROHE Klasse bleibt unangetastet — abgesenkt wird die ANZEIGE, nicht der Datensatz.
    expect(eff.rawKnowledgeClass).toBe("gesichert");
  });

  it("Mobile und Desktop leiten NICHT getrennt ab — dieselbe Einstufung, dieselben Quellen", () => {
    for (const c of CASES) {
      const eff = effectiveAnswer(c.answer, c.kos, c.conflicts);
      const mob = summarizeAnswer(c.answer, c.kos, c.conflicts);
      expect(mob.grade, c.name).toBe(eff.grade);
      expect(mob.evidence, c.name).toEqual(eff.evidence);
      expect(mob.caveat, c.name).toEqual(eff.caveat);
    }
  });
});
