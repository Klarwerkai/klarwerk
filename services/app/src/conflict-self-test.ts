// SCRUM-493: End-to-End-Selbsttest der Konflikterkennung. Beweist im DEPLOYTEN Stand, dass
// reasoner.judgeConflict wirklich antwortet UND die neuen kollision-Felder liefert — der einzige
// verlässliche Check (die Sidebar „aktiv" prüft nur Key-Präsenz, keine Erreichbarkeit).
//
// Bewusst OHNE echten Bestand: zwei feste, widersprüchliche „[Selbsttest]"-Subjekte laufen durch die
// IDENTISCHE Erkennungskette (detectForSubject → judgeConflict → decideFromVerdict/G-2 → createAuto →
// kollision), aber gegen einen Wegwerf-ConflictService (In-Memory-Repo). Ergebnis: echter Modellaufruf
// + echte kollision-Verarbeitung, NULL Fußabdruck im echten Konflikt-/KO-Bestand, inhärent idempotent,
// kein Cleanup/Leak-Risiko. Nur die Pool-Sammlung aus ko.list() entfällt — sie ist nicht Teil dessen,
// was geprüft wird (das Modell sieht denselben coreText).
import {
  type Conflict,
  ConflictService,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictRepo,
} from "../../conflicts";

// Zwei fest definierte, bewusst unvereinbare Aussagen (blau ↔ rot). Die Streitwerte stehen wörtlich in
// den Aussagen → ein echtes Modell soll sie wörtlich übernehmen (streitwertWoertlich=true).
export const SELF_TEST_SUBJECT_A: DetectSubject = {
  refId: "selbsttest:warnschild-blau",
  title: "[Selbsttest] Warnschild-Farbe Blau",
  statement: "Alle Warnschilder in Halle 7 müssen blau lackiert sein.",
  conditions: [],
  measures: [],
  category: "Selbsttest",
  tags: ["selbsttest", "warnschild"],
  asset: null,
};
export const SELF_TEST_SUBJECT_B: DetectSubject = {
  refId: "selbsttest:warnschild-rot",
  title: "[Selbsttest] Warnschild-Farbe Rot",
  statement: "Warnschilder in Halle 7 werden ausschließlich rot lackiert.",
  conditions: [],
  measures: [],
  category: "Selbsttest",
  tags: ["selbsttest", "warnschild"],
  asset: null,
};

export type ConflictSelfTestCode = "ok" | "no_model" | "no_conflict" | "conflict_without_kollision";

export interface ConflictSelfTestResult {
  ok: boolean;
  code: ConflictSelfTestCode;
  provider: string;
  mode: "model" | "deterministic";
  conflictCreated: boolean;
  hasKollision: boolean;
  // null, solange keine kollision vorliegt; sonst je Seite: steht der Streitwert wörtlich im Beleg?
  streitwertAWoertlich: boolean | null;
  streitwertBWoertlich: boolean | null;
  streitpunkt: string | null;
  // i18n-Schlüssel der Kopfzeile; die UI ergänzt Provider/Streitpunkt-Details.
  messageKey: string;
}

interface ReasonerStatusLike {
  active: boolean;
  provider: string;
  mode: "model" | "deterministic";
}

// PURE: bewertet Status + erkannten Konflikt zu einem klaren OK/FAIL-Befund. Kein I/O, kein Date.
export function evaluateConflictSelfTest(
  status: ReasonerStatusLike,
  conflict: Conflict | null,
): ConflictSelfTestResult {
  const base = { provider: status.provider, mode: status.mode };
  if (!status.active) {
    return {
      ...base,
      ok: false,
      code: "no_model",
      conflictCreated: false,
      hasKollision: false,
      streitwertAWoertlich: null,
      streitwertBWoertlich: null,
      streitpunkt: null,
      messageKey: "adm.conflictSelfTest.noModel",
    };
  }
  if (!conflict) {
    return {
      ...base,
      ok: false,
      code: "no_conflict",
      conflictCreated: false,
      hasKollision: false,
      streitwertAWoertlich: null,
      streitwertBWoertlich: null,
      streitpunkt: null,
      messageKey: "adm.conflictSelfTest.noConflict",
    };
  }
  const k = conflict.detector?.kollision;
  if (!k) {
    return {
      ...base,
      ok: false,
      code: "conflict_without_kollision",
      conflictCreated: true,
      hasKollision: false,
      streitwertAWoertlich: null,
      streitwertBWoertlich: null,
      streitpunkt: null,
      messageKey: "adm.conflictSelfTest.noKollision",
    };
  }
  return {
    ...base,
    ok: true,
    code: "ok",
    conflictCreated: true,
    hasKollision: true,
    streitwertAWoertlich: k.seiteA.streitwertWoertlich,
    streitwertBWoertlich: k.seiteB.streitwertWoertlich,
    streitpunkt: k.streitpunkt,
    messageKey: "adm.conflictSelfTest.ok",
  };
}

// Minimaler Reasoner-Ausschnitt für den Selbsttest — die echte Reasoner-Instanz erfüllt ihn; in Tests
// wird er gemockt (Modell-mit-kollision / Modell-ohne-kollision / kein-Modell).
export interface ConflictSelfTestReasoner {
  status(): ReasonerStatusLike;
  judgeConflict(coreA: string, coreB: string): Promise<ConflictVerdict | null>;
}

// Orchestrierung: echte Erkennungskette gegen einen Wegwerf-Repo (kein echter Bestand berührt).
export async function runConflictSelfTest(
  reasoner: ConflictSelfTestReasoner,
): Promise<ConflictSelfTestResult> {
  const status = reasoner.status();
  // Ohne echtes Modell gar nicht erst aufrufen — sofortiger, ehrlicher Befund.
  if (!status.active) {
    return evaluateConflictSelfTest(status, null);
  }
  const throwaway = new ConflictService({ repo: new InMemoryConflictRepo() });
  let created: Conflict[] = [];
  try {
    created = await throwaway.detectForSubject(SELF_TEST_SUBJECT_A, [SELF_TEST_SUBJECT_B], (a, b) =>
      reasoner.judgeConflict(a, b),
    );
  } catch {
    // Ein Modellfehler zählt als „kein Konflikt erkannt" — kein Absturz, klarer FAIL-Befund.
    created = [];
  }
  return evaluateConflictSelfTest(status, created[0] ?? null);
}
