// SCRUM-250: DOM-freie Sicht-Ableitung für die Ask-Antwort. Macht ehrlich sichtbar, ob die Antwort
// gesichert ist (aus der Knowledge-Class abgeleitet — KEINE neue Antwortlogik) und löst Quellen-IDs
// in lesbare KO-Titel auf. Keine RAG/Vector-DB, keine neuen Backend-Felder. Reine Funktionen.
import type { Conflict, KnowledgeObject } from "../api/types";
// AUFTRAG-mega32 E: dieselbe Vollständigkeits-Invariante, die Badge und Karte tragen — der
// Antwortvertrag legt sie NICHT neu aus (s. aiCheckStatusCard.ts, Spiegel von conflicts/coverage.ts).
import { aiCheckCoverageComplete } from "./aiCheckStatusCard";
// AUFTRAG-mega33 A: Statusplakette und Review-Wächter lesen die EINE effektive Einstufung.
import type { AnswerGrade } from "./answerGrade";
import { type ConflictImpact, conflictImpact, conflictLimitedUsability } from "./conflictImpact";
import { isDemoKnowledge } from "./demoKnowledge";
import { type KoUsability, koOverview } from "./koOverview";

export type AnswerStatusKey = "verified" | "unverified";

export interface AnswerStatus {
  key: AnswerStatusKey;
  tone: "pos" | "warn";
}

// AUFTRAG-mega33 A2: die Statusplakette liest die EFFEKTIVE Einstufung, nicht mehr die rohe Klasse.
// Vorher stand hier „gesichert ⇒ verified" — und genau dieses zweite, eigenständige Urteil ließ
// die Plakette „Gesichert" behaupten, während der Vertragskasten direkt darüber bereits einen
// Prüfvorbehalt trug (bens ROT 3). Eine Antwort ohne belegte Einstufung ist ehrlich „noch
// ungeprüft"; eine Wissenslücke bekommt gar keine Antwortkarte, wird hier aber nie als gesichert
// ausgegeben.
export function answerStatus(grade: AnswerGrade): AnswerStatus {
  return grade === "verified"
    ? { key: "verified", tone: "pos" }
    : { key: "unverified", tone: "warn" };
}

export interface SourceRef {
  id: string;
  label: string; // KO-Titel, sonst die ID als Fallback
  known: boolean; // true, wenn ein KO mit der ID im Bestand gefunden wurde
  validated: boolean | null; // true/false bei bekanntem KO, null bei unbekannter Quelle
  // SCRUM-300: kanonische Use-Readiness des Quell-KO (identisch zu KO-Detail/Library über
  // koOverview → useReadiness). Macht je Quelle sichtbar, wie belastbar sie ist
  // (nutzbar/in Prüfung/zu prüfen). null bei unbekannter Quelle (kein Fake-Zustand).
  usability: KoUsability | null;
  // SCRUM-308: Herkunft Demo-/Seed-Wissen (nur Kontext, kein Qualitätssignal). false bei unbekannter Quelle.
  demo: boolean;
}

// Quellen-IDs in handlungsnahe Referenzen (Titel + Link-ID + Nutzbarkeit) auflösen; Reihenfolge
// bleibt erhalten. Die Nutzbarkeit wird AUSSCHLIESSLICH aus dem vorhandenen KO über koOverview
// abgeleitet (kein neues Statusmodell, keine Mutation) → KO-Detail/Library/Ask sagen dasselbe.
export function sourceRefs(
  sourceIds: readonly string[],
  kos: readonly KnowledgeObject[],
): SourceRef[] {
  const byId = new Map(kos.map((k) => [k.id, k]));
  return sourceIds.map((id) => {
    const ko = byId.get(id);
    return {
      id,
      label: ko?.title ?? id,
      known: ko !== undefined,
      validated: ko ? ko.status === "validiert" : null,
      usability: ko ? koOverview(ko).usability : null,
      demo: ko ? isDemoKnowledge(ko) : false,
    };
  });
}

// SCRUM-357: konfliktbewusste Quellen-Sicht für Ask. Erweitert SourceRef um die Konflikt-Wirkung,
// damit ein konfliktbetroffenes Quell-KO NICHT als uneingeschränkt nutzbar/gesichert erscheint.
// `usability` wird hier auf die EFFEKTIVE (konfliktbegrenzte) Nutzbarkeit gesetzt — identisch zur
// zentralen Ableitung in conflictImpact, die auch KO-Detail/Library nutzen.
export interface ConflictAwareSourceRef extends SourceRef {
  conflictLimited: boolean; // ungelöster Konflikt wirkt auf dieses Quell-KO
  conflictTruth: boolean; // mind. ein Wahrheitskonflikt (stärkstes Signal)
  // AUFTRAG-mega32 BLOCK E: die Beweislage der Erkennung FÜR DIESE QUELLE — s. answerCheckState.
  checkState: AnswerCheckState;
}

// ================================================================================================
// AUFTRAG-mega32 BLOCK E (bens neunter Fund, Pedis Entscheidung 27.07.) — „GESICHERT" DARF NICHT
// AUS UNWISSEN ENTSTEHEN.
// ================================================================================================
//
// DER BEFUND. `sourcesConflicted` leitete sich allein aus BEREITS BEKANNTEN Konflikten ab, und
// dieser Wert steuerte den Antwortvertrag. Bei gedeckelter oder unvollständiger Erkennung konnte
// eine Antwort damit als gesichert erscheinen, obwohl UNBEKANNTE Konflikte nicht ausgeschlossen
// sind. Es ist die Kernausgabe des Produkts — genau hier muss „Beweispflicht statt Plausibilität"
// sich beweisen.
//
// PEDIS ENTSCHEIDUNG. Sicherheit darf nur behauptet werden, wenn JEDE herangezogene Quelle einen
// vollständig belegten Lauf hat — vollständig im Sinne der Invariante aus BLOCK A. Sonst eine Stufe
// darunter, mit sichtbarem Prüfvorbehalt, der benennt, worauf er sich bezieht.
//
// KEIN NEUER EGRESS, KEINE NEUE ROUTE, KEIN MODELLAUFRUF. Die Abdeckung hängt am Wissensobjekt
// (`ko.aiCheck.coverage`) und reist über `GET /api/kos` mit — den Bestand hat die Ask-Seite ohnehin
// geladen, um die Quellentitel aufzulösen. Es wird NICHTS nachgeprüft, nur gelesen, was schon da ist.
//
// DIE VIER ZUSTÄNDE sind bewusst dieselben und in derselben Rangfolge wie in der serverseitigen
// Zusammenfassung (knowledge-object/src/service.ts, aiCheckCoverageSummary) — „gar kein Lauf" ist
// eine andere Aussage als „Lauf ohne Protokoll" und beide sind etwas anderes als „unvollständig".
export type AnswerCheckState =
  // Die Quelle ist im Bestand nicht auflösbar — über ihren Prüf-Lauf lässt sich nichts sagen.
  | "unknown"
  // Es ist gar kein Prüf-Lauf vermerkt.
  | "unchecked"
  // Ein Lauf ist vermerkt, aber ohne Abdeckungsprotokoll (Altbestand von vor mega28).
  | "noCoverage"
  // Ein Lauf mit Protokoll, das die Vollständigkeit nicht belegt (oder ein nicht abgeschlossener Lauf).
  | "incomplete"
  // BELEGT vollständig: der einzige Zustand, der ein „gesichert" tragen darf.
  | "proven";

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
  return aiCheckCoverageComplete(aiCheck.coverage) ? "proven" : "incomplete";
}

export function conflictAwareSourceRefs(
  sourceIds: readonly string[],
  kos: readonly KnowledgeObject[],
  conflicts: readonly Conflict[],
): ConflictAwareSourceRef[] {
  const byId = new Map(kos.map((k) => [k.id, k]));
  return sourceRefs(sourceIds, kos).map((ref) => {
    const impact: ConflictImpact = ref.known
      ? conflictImpact(ref.id, conflicts)
      : { affected: false, unresolvedCount: 0, hasTruth: false, severity: "none", limited: false };
    const usability =
      ref.usability === null ? null : conflictLimitedUsability(ref.usability, impact);
    return {
      ...ref,
      usability, // effektive, konfliktbegrenzte Nutzbarkeit (kein „ready" trotz offenem Konflikt)
      conflictLimited: impact.limited,
      conflictTruth: impact.hasTruth,
      checkState: answerCheckState(byId.get(ref.id)),
    };
  });
}

export interface AnswerReviewGuard {
  labelKey: string;
  hintKey: string;
  ctaKey: string;
  ctaTo: string;
}

// SCRUM-288: Zusätzliche Nutzungs-Leitplanke für ungeprüfte Antworten. Die Antwortlogik bleibt
// unverändert; diese Sicht macht nur klar, dass ungeprüfte/offene Quellen in Review gehören.
//
// AUFTRAG-mega33 A2: der Wächter hing an der rohen Klasse und SCHWIEG deshalb bei „gesichert" —
// auch dann, wenn die Prüfung der Quellen gar nicht belegt war (bens ROT 3). Jetzt schweigt er
// genau dann, wenn die effektive Einstufung das trägt. Bei einer Wissenslücke gibt es keine
// Antwort, die in Review gehören könnte — dort schweigt er ebenfalls.
export function answerReviewGuard(
  grade: AnswerGrade,
  sources: readonly SourceRef[],
): AnswerReviewGuard | null {
  if (grade !== "unverified") {
    return null;
  }
  const hasOpenSource = sources.some((s) => s.validated === false);
  return {
    labelKey: hasOpenSource ? "ask.reviewGuard.openLabel" : "ask.reviewGuard.unverifiedLabel",
    hintKey: hasOpenSource ? "ask.reviewGuard.openHint" : "ask.reviewGuard.unverifiedHint",
    ctaKey: "ask.reviewGuard.cta",
    ctaTo: "/validierung",
  };
}
