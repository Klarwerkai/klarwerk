// Reines, DOM-freies Mobile-Ask-View-Model (SCRUM-113 / FE-MOB-03).
//
// ================================================================================================
// AUFTRAG-mega33 BLOCK A2 (bens ROT 4) — DIE ZEHNTE LESEFLÄCHE LEITET NICHT MEHR SELBST AB.
// ================================================================================================
//
// Bis mega32 bildete diese Datei die Evidenz allein aus `answer.knowledgeClass` — eine zweite,
// eigenständige Ableitung neben der Desktop-Ask-Seite. Sie zeigte deshalb weiter „Evidenz:
// Gesichert", während dieselbe Antwort auf dem Desktop bereits einen Prüfvorbehalt trug.
//
// Jetzt ruft sie dieselbe eine Ableitung auf wie Ask (effectiveAnswer). Dafür braucht sie Bestand
// UND Konflikte — beides holt die mobile Seite über die vorhandenen Hooks, KEIN neuer Egress und
// keine neue Route.
import type { AnswerResult, KnowledgeObject } from "../api/types";
import type { AnswerGrade } from "./answerGrade";
import type { AnswerCheckCaveat } from "./askAnswerContract";
import type { AnswerStatus, ConflictAwareSourceRef } from "./askView";
import { type ConflictCaveat, type ConflictKnowledge, effectiveAnswer } from "./effectiveAnswer";
import type { EvidenceMeta } from "./knowledgeClass";

export interface MobileAnswerSummary {
  answered: boolean;
  text: string | null;
  trust: number;
  // Die EINE effektive Einstufung — dieselbe, die der Desktop anzeigt.
  grade: AnswerGrade;
  evidence: EvidenceMeta; // labelKey + tone (für Badge), aus der EFFEKTIVEN Klasse
  status: AnswerStatus;
  // Der benannte Prüfvorbehalt; null, wenn jede herangezogene Quelle belegt ist.
  caveat: AnswerCheckCaveat | null;
  // AUFTRAG-mega34 A3: der benannte Hinweis auf den unbelegten Konfliktstand — Wort für Wort
  // derselbe wie auf dem Desktop, weil er aus derselben Ableitung kommt.
  conflictCaveat: ConflictCaveat | null;
  // Aufgelöste Quellen inkl. Konflikt- und Beweislage (Titel statt roher ID).
  sources: ConflictAwareSourceRef[];
  stepCount: number;
}

export function summarizeAnswer(
  answer: AnswerResult,
  kos: readonly KnowledgeObject[],
  // AUFTRAG-mega34 A1: der Konfliktstand reist mit seiner Herkunft. Ein nacktes Array käme hier
  // wieder als „keine Konflikte" an, egal ob der Abruf lief, hing oder abriss.
  conflicts: ConflictKnowledge,
): MobileAnswerSummary {
  const effective = effectiveAnswer(answer, kos, conflicts);
  return {
    answered: answer.answered,
    text: answer.answer,
    trust: answer.trust,
    grade: effective.grade,
    evidence: effective.evidence,
    status: effective.status,
    caveat: effective.caveat,
    conflictCaveat: effective.conflictCaveat,
    sources: effective.sources,
    stepCount: answer.steps.length,
  };
}
