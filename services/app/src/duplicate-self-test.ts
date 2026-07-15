// SCRUM-494: End-to-End-Selbsttest der Duplikat-Erkennung. Beweist im DEPLOYTEN Stand, dass
// reasoner.judgeDuplicate wirklich antwortet UND ein semantisches Duplikat erkennt — der Fall, den
// der deterministische Ersatzmodus prinzipiell NICHT sehen kann (SCRUM-494-Analyse): zwei Aussagen,
// die dasselbe meinen, aber lexikalisch fast disjunkt sind (Textdeckung ~0,31 < 0,85-Schwelle), gehen
// zwingend ans Modell. Analog zum Konflikt-Selbsttest (conflict-self-test.ts).
//
// Bewusst OHNE echten Bestand: zwei feste „[Selbsttest]"-Subjekte laufen durch die IDENTISCHE
// Erkennungskette (OverlapService.detectForSubject → judgeDuplicate → decideFromOverlapVerdict/G-2 →
// createAuto), aber gegen einen Wegwerf-OverlapService (In-Memory-Repo). Ergebnis: echter Modellaufruf,
// NULL Fußabdruck im echten Überschneidungs-/KO-Bestand, inhärent idempotent, kein Cleanup/Leak-Risiko.
// Nur die Pool-Sammlung aus ko.list() entfällt — sie ist nicht Teil dessen, was geprüft wird.
import {
  DEFAULT_OVERLAP_SETTINGS,
  type DetectSubject,
  InMemoryOverlapRepo,
  type OverlapEntry,
  OverlapService,
  type OverlapVerdict,
} from "../../conflicts";

// Der reifen-Fall aus der SCRUM-494-Analyse: semantisch gleich, lexikalisch verschieden. Textdeckung
// liegt unter der Determinismus-Schwelle (0,85) → das Paar geht zwingend an das Modell (judgeDuplicate).
export const DUP_SELF_TEST_SUBJECT_A: DetectSubject = {
  refId: "selbsttest:reifen-a",
  title: "[Selbsttest] Auslieferungsmenge Reifen",
  statement: "jedes auto wird mit 4 reifen ausgeliefert",
  conditions: [],
  measures: [],
  category: "Selbsttest",
  tags: ["selbsttest", "reifen"],
  asset: null,
};
export const DUP_SELF_TEST_SUBJECT_B: DetectSubject = {
  refId: "selbsttest:reifen-b",
  title: "[Selbsttest] Anzahl Reifen",
  statement: "Alle autos werden mit vier reifen ausgeliefert",
  conditions: [],
  measures: [],
  category: "Selbsttest",
  tags: ["selbsttest", "reifen"],
  asset: null,
};

export type DuplicateSelfTestCode = "ok" | "no_model" | "no_duplicate";

export interface DuplicateSelfTestResult {
  ok: boolean;
  code: DuplicateSelfTestCode;
  provider: string;
  mode: "model" | "deterministic";
  duplicateCreated: boolean;
  // Erkannte Beziehung (z. B. „identisch"), null solange kein Duplikat vorliegt.
  relation: string | null;
  // i18n-Schlüssel der Kopfzeile; die UI ergänzt Provider/Beziehungs-Details.
  messageKey: string;
}

interface ReasonerStatusLike {
  active: boolean;
  provider: string;
  mode: "model" | "deterministic";
}

// PURE: bewertet Status + erkannte Überschneidung zu einem klaren OK/FAIL-Befund. Kein I/O, kein Date.
export function evaluateDuplicateSelfTest(
  status: ReasonerStatusLike,
  entry: OverlapEntry | null,
): DuplicateSelfTestResult {
  const base = { provider: status.provider, mode: status.mode };
  if (!status.active) {
    return {
      ...base,
      ok: false,
      code: "no_model",
      duplicateCreated: false,
      relation: null,
      messageKey: "adm.dupSelfTest.noModel",
    };
  }
  if (!entry) {
    return {
      ...base,
      ok: false,
      code: "no_duplicate",
      duplicateCreated: false,
      relation: null,
      messageKey: "adm.dupSelfTest.noDuplicate",
    };
  }
  return {
    ...base,
    ok: true,
    code: "ok",
    duplicateCreated: true,
    relation: entry.relation,
    messageKey: "adm.dupSelfTest.ok",
  };
}

// Minimaler Reasoner-Ausschnitt für den Selbsttest — die echte Reasoner-Instanz erfüllt ihn; in Tests
// wird er gemockt (Modell-erkennt / Modell-erkennt-nicht / kein-Modell).
export interface DuplicateSelfTestReasoner {
  status(): ReasonerStatusLike;
  judgeDuplicate(coreA: string, coreB: string): Promise<OverlapVerdict | null>;
}

// Orchestrierung: echte Erkennungskette gegen einen Wegwerf-Repo (kein echter Bestand berührt).
export async function runDuplicateSelfTest(
  reasoner: DuplicateSelfTestReasoner,
): Promise<DuplicateSelfTestResult> {
  const status = reasoner.status();
  // Ohne echtes Modell gar nicht erst aufrufen — sofortiger, ehrlicher Befund.
  if (!status.active) {
    return evaluateDuplicateSelfTest(status, null);
  }
  const throwaway = new OverlapService({ repo: new InMemoryOverlapRepo() });
  let created: OverlapEntry[] = [];
  try {
    created = await throwaway.detectForSubject(
      DUP_SELF_TEST_SUBJECT_A,
      [DUP_SELF_TEST_SUBJECT_B],
      (a, b) => reasoner.judgeDuplicate(a, b),
      { minConfidence: DEFAULT_OVERLAP_SETTINGS.minConfidence },
    );
  } catch {
    // Ein Modellfehler zählt als „kein Duplikat erkannt" — kein Absturz, klarer FAIL-Befund.
    created = [];
  }
  return evaluateDuplicateSelfTest(status, created[0] ?? null);
}
