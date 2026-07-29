// SCRUM-366 / AG-04 / AG-P2-2 / AG-P2-3 / PI-K2 / FR-ASK-02: DOM-freier „Antwortvertrag" für Ask.
// Macht aus den bereits vorhandenen Signalen (answered/gap, knowledgeClass, konfliktbewusste Quellen)
// eine ruhige, EHRLICHE Rahmung: Worauf basiert die Antwort? Gesichert vs. ungeprüft? Was ist der
// sichere nächste Schritt? Bei fehlender Basis: Wissenslücke, kein Chatbot-Fehler.
//
// KEINE neue Antwort-/Trust-/Statuslogik, KEIN Scoring, KEIN Backend, KEIN RAG. Reine Funktionen →
// testbar ohne DOM. Trust/Nutzbarkeit bleiben ein Belastbarkeits-Signal, KEIN Wahrheitsversprechen.
import type { AnswerGrade } from "./answerGrade";
import type { AnswerCheckState, ConflictAwareSourceRef } from "./askView";

// AUFTRAG-mega33 A: die Vertragsart IST die effektive Einstufung — kein zweiter Begriff, der neben
// ihr herlaufen und irgendwann von ihr abweichen könnte.
export type AnswerContractKind = AnswerGrade;

export interface AnswerContract {
  kind: AnswerContractKind;
  titleKey: string;
  bodyKey: string;
  nextStepKey: string; // ehrliche, verbale Empfehlung für den sicheren nächsten Schritt
  tone: "pos" | "warn";
  sourceBound: boolean; // true, sobald eine Antwort vorliegt (sie ist an Quellen gebunden)
}

const CONTRACTS: Record<AnswerContractKind, AnswerContract> = {
  verified: {
    kind: "verified",
    titleKey: "ask.contract.verified.title",
    bodyKey: "ask.contract.verified.body",
    nextStepKey: "ask.contract.verified.next",
    tone: "pos",
    sourceBound: true,
  },
  unverified: {
    kind: "unverified",
    titleKey: "ask.contract.unverified.title",
    bodyKey: "ask.contract.unverified.body",
    nextStepKey: "ask.contract.unverified.next",
    tone: "warn",
    sourceBound: true,
  },
  gap: {
    kind: "gap",
    titleKey: "ask.contract.gap.title",
    bodyKey: "ask.contract.gap.body",
    nextStepKey: "ask.contract.gap.next",
    tone: "warn",
    sourceBound: false,
  },
};

// ================================================================================================
// AUFTRAG-mega33 BLOCK A3 (nach bens ROT 3) — DER VERTRAG ENTSCHEIDET NICHTS MEHR SELBST.
// ================================================================================================
//
// Bis mega32 nahm diese Funktion Einzelsignale entgegen, darunter ein OPTIONALES
// `sourcesCheckUnproven`. Ein anderer Aufrufer konnte die Bedingung damit weglassen und für eine
// gesicherte Klasse weiterhin `verified` bekommen — ein Typvertrag, der eine Umgehung erlaubt, wird
// irgendwann umgangen. Und solange jede Anzeige ihre eigenen Signale zusammensetzte, konnten sie
// auseinanderlaufen; genau das war bens Befund.
//
// Jetzt bekommt der Vertrag die BEREITS ABGELEITETE Einstufung (answerGrade.ts, zusammengesetzt in
// effectiveAnswer.ts). Er ist damit nur noch die Beschriftung einer Entscheidung, die genau einmal
// und an genau einer Stelle gefallen ist. Weglassen kann sie niemand mehr — es gibt nichts mehr
// wegzulassen.
export function answerContract(grade: AnswerGrade): AnswerContract {
  return CONTRACTS[grade];
}

// ================================================================================================
// AUFTRAG-mega32 BLOCK E — DER PRÜFVORBEHALT BENENNT, WORAUF ER SICH BEZIEHT.
// ================================================================================================
//
// Eine Stufe herunterzustufen genügt nicht: „ungeprüft" allein sagt dem Leser nicht, DASS und WARUM
// die Konflikterkennung hinter seiner Antwort lückenhaft ist. Diese Ableitung liefert die Bezugnahme
// — wie viele der herangezogenen Quellen betroffen sind, von wie vielen insgesamt, und mit welcher
// Ursache (der SCHWERSTE Zustand regiert den Text; die Zählung bleibt vollständig).
//
// Sie schweigt, wenn alle Quellen belegt sind. Kein Dauerhinweis — dieselbe Regel wie bei der
// Abdeckungskennzeichnung aus mega28 und dem Konfliktsatz aus BLOCK K.
// AUFTRAG-mega53 B2 (Spiegel von services/ask/src/answer-evidence.ts): der fünfte Grund. Er ist
// keine Aussage über EINE Quelle — er sagt, dass die Antwort gar keine zuordenbare tragende Quelle
// hat, weil das Modell keine oder nur unbrauchbare Marken lieferte. Deshalb steht er am Vorbehalt
// und nicht in `AnswerCheckState`, das je Quelle gilt.
export type AnswerCheckCaveatReason = Exclude<AnswerCheckState, "proven"> | "unattributed";

export interface AnswerCheckCaveat {
  // Der schwerste vorliegende Zustand — er bestimmt den Text.
  reason: AnswerCheckCaveatReason;
  // Wie viele Quellen tragen KEINEN belegten Lauf?
  unproven: number;
  // Von wie vielen TRAGENDEN Quellen insgesamt? (mega53 B1: nicht mehr von allen herangezogenen.)
  total: number;
}

// Rangfolge von schwer nach leicht: „gar kein Lauf" wiegt schwerer als „Lauf ohne Protokoll", und
// beides schwerer als „Lauf mit Lücke". Eine unauflösbare Quelle steht ganz oben — über sie ist
// überhaupt nichts belegt.
const CHECK_SEVERITY: Exclude<AnswerCheckState, "proven">[] = [
  "unknown",
  "unchecked",
  "noCoverage",
  "incomplete",
];

export function answerCheckCaveat(
  sources: readonly ConflictAwareSourceRef[],
): AnswerCheckCaveat | null {
  const unprovenStates = sources
    .map((s) => s.checkState)
    .filter((s): s is Exclude<AnswerCheckState, "proven"> => s !== "proven");
  if (unprovenStates.length === 0) {
    return null; // jede Quelle belegt — hier ist Schweigen die Wahrheit.
  }
  const reason =
    CHECK_SEVERITY.find((candidate) => unprovenStates.includes(candidate)) ?? "incomplete";
  return { reason, unproven: unprovenStates.length, total: sources.length };
}

// Kompakte, ehrliche Quellen-Bilanz für die Antwortvertrag-Karte. Reine Zählung über die bereits
// konfliktbewusst aufgelösten Quellen (askView) — keine neue Quellen-Engine, kein Fake-Zustand.
export interface AnswerSourceSummary {
  total: number;
  known: number; // im Bestand auflösbar
  unknown: number; // unbekannte ID (ehrlich als unbekannt)
  validated: number; // bekanntes, validiertes KO
  open: number; // bekanntes, NICHT validiertes KO (offen/ungeprüft)
  ready: number; // effektiv nutzbar (konfliktbegrenzte Nutzbarkeit = "ready")
  conflictLimited: number; // mind. ein ungelöster Konflikt wirkt auf die Quelle
}

export function answerSourceSummary(
  sources: readonly ConflictAwareSourceRef[],
): AnswerSourceSummary {
  const summary: AnswerSourceSummary = {
    total: sources.length,
    known: 0,
    unknown: 0,
    validated: 0,
    open: 0,
    ready: 0,
    conflictLimited: 0,
  };
  for (const s of sources) {
    if (s.known) {
      summary.known += 1;
    } else {
      summary.unknown += 1;
    }
    if (s.validated === true) {
      summary.validated += 1;
    } else if (s.validated === false) {
      summary.open += 1;
    }
    if (s.usability === "ready") {
      summary.ready += 1;
    }
    if (s.conflictLimited) {
      summary.conflictLimited += 1;
    }
  }
  return summary;
}

// PI-K2 / AG-P2-3: ehrliche Trust-/Nutzbarkeits-Notiz (Belastbarkeitssignal, kein Wahrheitsversprechen).
export const ANSWER_CONTRACT_TRUST_NOTE_KEY = "ask.contract.trustNote";
