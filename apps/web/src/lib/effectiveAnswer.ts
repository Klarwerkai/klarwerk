// ================================================================================================
// AUFTRAG-mega33 BLOCK A2 — EINE EINSTUFUNG, VIELE ANZEIGEN. NICHT UMGEKEHRT.
// ================================================================================================
//
// Hier wird die effektive Antwort-Einstufung EINMAL gebildet — aus den Quellen, die tatsächlich
// herangezogen wurden, ihrer Konfliktlage und der Beweislage ihrer Prüf-Läufe. Alles, was ein
// Leser danach zu sehen bekommt, speist sich ausschließlich aus diesem Ergebnis:
//
//   1 Vertragskasten (Ask)                → answerContract(effective.grade)
//   2 Statusplakette (Ask)                → effective.status
//   3 Evidenzplakette (Ask)               → effective.evidence
//   4 Review-Wächter (Ask)                → answerReviewGuard(effective.grade, effective.sources)
//   5 Kopieren / Markdown-Download (Ask)  → effective.status + effective.evidence
//   6 mobile Antwort                      → summarizeAnswer() ruft genau diese Funktion auf
//   7 Word/Klara                          → askEvidence() im Server-Vertrag (mega34 B), s. u.
//
// Kein Ort liest danach noch die rohe Klasse für eine Einstufung. `rawKnowledgeClass` reist zwar
// mit, aber ausdrücklich als Herkunftsangabe — nicht als Anzeigewert.
//
// KEIN NEUER EGRESS, KEINE NEUE ROUTE, KEIN MODELLAUFRUF. Bestand und Konflikte hat jede
// aufrufende Seite ohnehin geladen; hier wird nur gelesen, was schon da ist.
import type { AnswerResult, Conflict, KnowledgeClass, KnowledgeObject } from "../api/types";
import { type AnswerGrade, answerGrade, effectiveKnowledgeClass } from "./answerGrade";
import { type AnswerCheckCaveat, answerCheckCaveat } from "./askAnswerContract";
// AUFTRAG-mega53 B1: dieselbe eine Auslegung von „unbekannte Zuordnung" wie in der Quellenliste
// (mega52 A3) — `undefined` (alter Server) und `[]` (Modell ohne Marken) sind DERSELBE Zustand.
import { citationState } from "./askCitedSources";
import {
  type AnswerStatus,
  type ConflictAwareSourceRef,
  answerStatus,
  conflictAwareSourceRefs,
} from "./askView";
import { type EvidenceMeta, knowledgeClassMeta } from "./knowledgeClass";

// ================================================================================================
// AUFTRAG-mega34 BLOCK A1 (bens schwerster Befund) — DER KONFLIKTSTAND REIST MIT SEINER HERKUNFT.
// ================================================================================================
//
// Bis mega33 nahm `effectiveAnswer()` ein nacktes `readonly Conflict[]` entgegen. Ein leeres Array
// bedeutete dort drei völlig verschiedene Dinge, und die Funktion konnte sie nicht auseinander-
// halten: erfolgreich geladen und leer · noch nicht geladen · Abruf fehlgeschlagen.
//
// Der Typ trennt sie jetzt. Er ist bewusst EIN Objekt und nicht zwei Parameter: so kann niemand
// eine Liste aus einem früheren Lauf mit einem frischen „loaded" paaren. Und er hat KEINEN
// Vorgabewert — jede aufrufende Fläche muss sagen, woher ihr Wissen kommt.
export type ConflictKnowledgeState =
  // Der Abruf ist durch: die Liste ist vollständig und aussagekräftig, auch wenn sie leer ist.
  | "loaded"
  // Noch unterwegs. Über Konflikte ist NICHTS bekannt — nicht „es gibt keine".
  | "pending"
  // Abgerissen. Ebenfalls nichts bekannt, nur dauerhaft statt vorübergehend.
  | "failed";

export interface ConflictKnowledge {
  state: ConflictKnowledgeState;
  // Nur bei `loaded` gefüllt und nur dort aussagekräftig.
  items: readonly Conflict[];
}

// Der EINE Ableiter aus dem react-query-Ergebnis. Desktop und Mobil rufen ihn beide auf, damit die
// beiden Flächen an dieser Frage nicht getrennt driften können — genau der Fehler, den mega33 auf
// der Ebene darunter beseitigt hat.
export function conflictKnowledge(query: {
  data?: readonly Conflict[] | undefined;
  isSuccess: boolean;
  isError: boolean;
}): ConflictKnowledge {
  // Reihenfolge ist Absicht: ein abgerissener Abruf schlägt vorhandene Altdaten. react-query hält
  // bei einem Refetch-Fehler die vorherigen `data` weiter vor; die dürfen einen Fehlerzustand nicht
  // beschönigen.
  if (query.isError) {
    return { state: "failed", items: [] };
  }
  if (!query.isSuccess || !query.data) {
    return { state: "pending", items: [] };
  }
  return { state: "loaded", items: query.data };
}

// Der benannte Hinweis für den unbelegten Konfliktstand — dieselbe Bauart wie der Prüfvorbehalt
// aus mega32 E: er sagt, WORAUF er sich bezieht, und schweigt, sobald der Abruf durch ist.
export interface ConflictCaveat {
  reason: Exclude<ConflictKnowledgeState, "loaded">;
}

export interface EffectiveAnswer {
  // Die EINE Einstufung. Alles andere in diesem Objekt ist ihre Ausprägung.
  grade: AnswerGrade;
  // Die Klasse, wie sie angezeigt/exportiert werden darf.
  knowledgeClass: KnowledgeClass;
  // Die Klasse, wie sie im Datensatz steht — Herkunft, KEIN Anzeigewert.
  rawKnowledgeClass: KnowledgeClass;
  evidence: EvidenceMeta;
  status: AnswerStatus;
  // Der benannte Prüfvorbehalt (worauf er sich bezieht) — null, wenn jede Quelle belegt ist.
  caveat: AnswerCheckCaveat | null;
  // AUFTRAG-mega34 A2: der benannte Hinweis auf den unbelegten Konfliktstand — null, sobald der
  // Abruf erfolgreich durch ist.
  conflictCaveat: ConflictCaveat | null;
  // Die konfliktbewusst aufgelösten Quellen, in Reihenfolge — VOLLSTÄNDIG, also alle
  // herangezogenen. Das ist die Transparenzliste (mega53 B3), nicht die Grundlage des Urteils.
  sources: ConflictAwareSourceRef[];
  // AUFTRAG-mega53 B1 — DIE TRAGENDE TEILMENGE. Genau die Quellen, deren Marke im Antworttext
  // stand. Jede Aussage ÜBER DIE ANTWORT oben in diesem Objekt ist aus IHNEN abgeleitet. Leer,
  // wenn die Zuordnung unbekannt ist; dann wird nichts behauptet, statt zu raten.
  carryingSources: ConflictAwareSourceRef[];
  // Mindestens eine TRAGENDE Quelle ist konfliktbegrenzt.
  sourcesConflicted: boolean;
}

export function effectiveAnswer(
  answer: AnswerResult,
  kos: readonly KnowledgeObject[],
  conflicts: ConflictKnowledge,
): EffectiveAnswer {
  // ==============================================================================================
  // AUFTRAG-mega34 A2 — SOFORT VORSICHTIG EINSTUFEN, NICHT ZURÜCKHALTEN. BEGRÜNDUNG:
  // ==============================================================================================
  //
  // Der Auftrag lässt beides zu. Gewählt ist die vorsichtige Sofort-Einstufung, aus zwei Gründen:
  //
  //   1 Die Richtung des Irrtums. Sofort-vorsichtig irrt sich höchstens zu SCHWACH — der Leser
  //     sieht vorübergehend „ungeprüft" für eine Antwort, die sich Sekunden später als belegt
  //     erweist. Zurückhalten hieße, während des Ladens gar keine Einstufung zu haben; jede der
  //     sieben Anzeigen bräuchte dann einen eigenen dritten Zustand — und genau dort entstehen die
  //     Abweichungen, die mega33 gerade beseitigt hat.
  //
  //   2 Ein Pfad statt zwei. `grade` bleibt immer gesetzt. Kein Aufrufer kann einen Null-Zustand
  //     vergessen, weil es keinen gibt.
  //
  // Was der Leser NIE sieht, ist eine zu starke Aussage. Das ist die einzige harte Zusage.
  const conflictsUnproven = conflicts.state !== "loaded";
  const conflictCaveat: ConflictCaveat | null = conflictsUnproven
    ? { reason: conflicts.state as Exclude<ConflictKnowledgeState, "loaded"> }
    : null;
  const sources = answer.answered
    ? conflictAwareSourceRefs(answer.sources, kos, conflicts.items)
    : [];
  // ==============================================================================================
  // AUFTRAG-mega53 BLOCK B1/B2 (Spiegel von services/ask/src/answer-evidence.ts) — DAS URTEIL
  // RECHNET AUF DEN TRAGENDEN QUELLEN.
  // ==============================================================================================
  //
  // Bis mega53 gingen `caveat`, `sourcesConflicted` und damit `grade` und die angezeigte Klasse aus
  // `sources` hervor — aus ALLEN herangezogenen. Eine Quelle, die die Antwort nie getragen hat,
  // konnte die Einstufung damit heben oder senken. Der Server hat denselben Fehler an derselben
  // Stelle gemacht; der Paritätswächter (tests/app/mega34-word-einstufung.test.ts) hält beide
  // Kodierungen weiterhin über die volle Wahrheitstafel aneinander.
  const cited = new Set(answer.citedSources ?? []);
  const carryingSources =
    citationState(answer.citedSources) === "attributed"
      ? sources.filter((s) => cited.has(s.id))
      : [];
  // B2: ohne Zuordnung wird KEINE Quelle geraten. Der Vorbehalt schweigt dann NICHT (das wäre
  // fail-open — „alle Quellen belegt"), sondern benennt genau diesen Zustand.
  const caveat: AnswerCheckCaveat | null = !answer.answered
    ? null
    : carryingSources.length === 0
      ? { reason: "unattributed", unproven: sources.length, total: sources.length }
      : answerCheckCaveat(carryingSources);
  const sourcesConflicted = carryingSources.some((s) => s.conflictLimited);
  const grade = answerGrade({
    answered: answer.answered,
    knowledgeClass: answer.knowledgeClass,
    sourcesConflicted,
    sourcesCheckUnproven: caveat !== null,
    conflictsUnproven,
  });
  const knowledgeClass = effectiveKnowledgeClass(grade, answer.knowledgeClass);
  return {
    grade,
    knowledgeClass,
    rawKnowledgeClass: answer.knowledgeClass,
    evidence: knowledgeClassMeta(knowledgeClass),
    status: answerStatus(grade),
    caveat,
    // Eine Wissenslücke bekommt gar keine Antwortkarte — dort wäre der Hinweis Lärm.
    conflictCaveat: answer.answered ? conflictCaveat : null,
    sources,
    carryingSources,
    sourcesConflicted,
  };
}
