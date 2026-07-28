// ================================================================================================
// AUFTRAG-mega34 BLOCK B1 (bens zweiter ROT-Befund) — DIE EINSTUFUNG, SERVERSEITIG UND KANONISCH.
// ================================================================================================
//
// DER BEFUND. Die Word-/Klara-Fläche (`apps/web/public/word-addin/taskpane.html`) rief `/api/ask`
// auf und reduzierte die Antwort auf zwei Zustände: `answered` oder `gap`. Weder Wissensklasse noch
// Prüfabdeckung noch Konfliktstand kamen darin vor. Sie versprach in allen drei Sprachen
// unbedingt „verified knowledge" — und der Nutzer KOPIERTE dieses Ergebnis in ein echtes Dokument.
// Von allen Leseflächen ist das die folgenreichste, weil das Ergebnis das Haus verlässt.
//
// WARUM DER SERVER UND NICHT DIE WORD-LAUFZEIT. Der Auftrag bevorzugt einen kanonischen,
// quellengebundenen Evidenzzustand vom Server, weil sonst eine DRITTE Auslegung derselben Regel
// entsteht. Genau das ist hier der Fall — und es kommt eine harte Randbedingung dazu:
//
//   `apps/web` DARF NICHT aus `services/` importieren. Der webbuild-Stage im Dockerfile kopiert
//   nur `apps/web`; ein Import über die Modulgrenze löst lokal auf und bricht die Produktion. Das
//   Verbot ist als Wächter gepinnt (tests/capture/draft-limits-shared.test.ts).
//
// Gemeinsamer Code zwischen Oberfläche und Server ist also baulich ausgeschlossen. Der Server ist
// deshalb der einzige Ort, der die Regel für ALLE Verbraucher zugleich beantworten kann: die
// Word-Fläche bekommt sie fertig über JSON und legt gar nichts mehr selbst aus.
//
// Die Fassung in `apps/web/src/lib/answerGrade.ts` bleibt bestehen — die Web-Oberfläche kennt
// zusätzlich den ABRUFZUSTAND ihrer Konfliktliste (mega34 A), den der Server nicht hat. Sie ist
// damit ein bewusster SPIEGEL, kein zweiter Entscheider, und ein Paritätswächter hält beide
// Kodierungen über die vollständige Wahrheitstafel aneinander
// (tests/app/mega34-answer-grade-parity.test.ts). Dasselbe Muster wie bei der
// Vollständigkeits-Invariante (coverage-complete.ts) und den elf Entwurfs-Grenzwerten.
//
// KEIN NEUER EGRESS, KEINE NEUE ROUTE, KEIN MODELLAUFRUF. Die Bestandteile liegen serverseitig
// ohnehin vor: die Wissensklasse im Antwortergebnis, die Abdeckung am Wissensobjekt, die offenen
// Konflikte im Konfliktdienst. Hier wird nur zusammengeführt, was schon da ist.
import { type Conflict, isCompleteRun } from "../../conflicts";
import type { KnowledgeObject } from "../../knowledge-object";
import type { AnswerResult, KnowledgeClass } from "../../reasoner";

export type AnswerGrade =
  // Sicherheit ist BELEGT: gesicherte Klasse, keine konfliktbegrenzte Quelle, jede herangezogene
  // Quelle mit vollständig belegtem Prüf-Lauf, und die Konfliktlage selbst ist bekannt.
  | "verified"
  // Beantwortet und quellengebunden, aber ohne Beleg für Sicherheit — ehrlich markiert.
  | "unverified"
  // Keine Antwort: Wissenslücke, kein Fehler.
  | "gap";

// Die Beweislage der Erkennung FÜR EINE QUELLE. Dieselben vier Zustände in derselben Rangfolge wie
// in `apps/web/src/lib/askView.ts` (answerCheckState) und in der serverseitigen Zusammenfassung
// (knowledge-object/src/service.ts, aiCheckCoverageSummary).
export type AnswerCheckState = "unknown" | "unchecked" | "noCoverage" | "incomplete" | "proven";

// Rangfolge von schwer nach leicht — der SCHWERSTE vorliegende Zustand bestimmt den Text.
const CHECK_SEVERITY: readonly Exclude<AnswerCheckState, "proven">[] = [
  "unknown",
  "unchecked",
  "noCoverage",
  "incomplete",
];

export function answerCheckState(ko: KnowledgeObject | undefined): AnswerCheckState {
  if (!ko) {
    return "unknown";
  }
  const aiCheck = ko.aiCheck;
  if (!aiCheck) {
    return "unchecked";
  }
  if (aiCheck.status !== "done") {
    return "incomplete";
  }
  if (!aiCheck.coverage) {
    return "noCoverage";
  }
  // KANONISCH: isCompleteRun aus services/conflicts — nicht noch einmal ausgeschrieben.
  return isCompleteRun(aiCheck.coverage) ? "proven" : "incomplete";
}

export interface AnswerCheckCaveat {
  reason: Exclude<AnswerCheckState, "proven">;
  unproven: number;
  total: number;
}

// Der Evidenzzustand, wie ihn `/api/ask` ausliefert. Bewusst FLACH und selbsterklärend: die
// Word-Laufzeit ist buildlos und soll nichts ableiten müssen.
export interface AnswerEvidence {
  grade: AnswerGrade;
  // Die Klasse, wie sie ANGEZEIGT werden darf — abgesenkt, wenn die Einstufung nicht belegt ist.
  knowledgeClass: KnowledgeClass;
  // Die Klasse, wie sie im Datensatz steht — Herkunft, KEIN Anzeigewert.
  rawKnowledgeClass: KnowledgeClass;
  // Der benannte Prüfvorbehalt; null, wenn jede herangezogene Quelle belegt ist.
  checkCaveat: AnswerCheckCaveat | null;
  // Mindestens eine herangezogene Quelle steht in einem offenen Konflikt.
  sourcesConflicted: boolean;
  // AUFTRAG-mega34 A/B: die Konfliktlage selbst ist unbekannt (der Abruf im Server ist gescheitert).
  // Dieselbe Beweislast-Umkehr wie in der Oberfläche: „nichts da" ist nicht „nichts vorhanden".
  conflictsUnproven: boolean;
}

export interface AnswerEvidenceInput {
  answer: Pick<AnswerResult, "answered" | "knowledgeClass" | "sources">;
  // Die aufgelösten Quell-KOs. Eine Quelle OHNE Eintrag hier gilt als unauflösbar (`unknown`).
  sourceKos: ReadonlyMap<string, KnowledgeObject>;
  // Die offenen Konflikte — oder null, wenn ihr Abruf nicht gelang. `null` heißt ausdrücklich
  // „unbekannt", NICHT „keine".
  openConflicts: readonly Conflict[] | null;
}

// ================================================================================================
// DIE REGEL. Sie steht hier EINMAL. Beide Fassungen — diese und der Spiegel in apps/web — geben für
// dieselben Eingaben dasselbe Ergebnis; der Paritätswächter prüft das über die volle Wahrheitstafel.
// ================================================================================================
export function answerEvidence(input: AnswerEvidenceInput): AnswerEvidence {
  const { answer, sourceKos, openConflicts } = input;
  const conflictsUnproven = openConflicts === null;

  if (!answer.answered) {
    // Eine Wissenslücke hat keine Quellen und behauptet nichts — kein Vorbehalt, kein Konflikt.
    return {
      grade: "gap",
      knowledgeClass: answer.knowledgeClass,
      rawKnowledgeClass: answer.knowledgeClass,
      checkCaveat: null,
      sourcesConflicted: false,
      conflictsUnproven,
    };
  }

  const states = answer.sources.map((id) => answerCheckState(sourceKos.get(id)));
  const unprovenStates = states.filter(
    (s): s is Exclude<AnswerCheckState, "proven"> => s !== "proven",
  );
  const checkCaveat: AnswerCheckCaveat | null =
    unprovenStates.length === 0
      ? null
      : {
          reason: CHECK_SEVERITY.find((c) => unprovenStates.includes(c)) ?? "incomplete",
          unproven: unprovenStates.length,
          total: answer.sources.length,
        };

  // Konfliktbegrenzt heißt: mindestens ein OFFENER Konflikt referenziert eine herangezogene Quelle.
  // Der Konfliktdienst liefert mit `unresolved()` bereits nur die offenen und versionsgebundenen —
  // hier wird deshalb nicht noch einmal nach Status gefiltert.
  const sourcesConflicted =
    openConflicts?.some((c) => answer.sources.includes(c.koA) || answer.sources.includes(c.koB)) ===
    true;

  const grade: AnswerGrade =
    answer.knowledgeClass === "gesichert" &&
    !sourcesConflicted &&
    checkCaveat === null &&
    !conflictsUnproven
      ? "verified"
      : "unverified";

  return {
    grade,
    // Ohne belegte Einstufung darf „gesichert" nirgends erscheinen — auch nicht in Word, auch nicht
    // im eingefügten Text. Alle anderen Klassen sind bereits ehrlich und bleiben stehen.
    knowledgeClass:
      grade === "verified" || answer.knowledgeClass !== "gesichert"
        ? answer.knowledgeClass
        : "ungeprueft",
    rawKnowledgeClass: answer.knowledgeClass,
    checkCaveat,
    sourcesConflicted,
    conflictsUnproven,
  };
}
