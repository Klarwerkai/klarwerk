// SCRUM-357 / AG-14 / VC-P1-1 / FR-VAL-01: zentrale, DOM-freie Ableitung der Konflikt-Wirkung auf die
// Nutzbarkeit/Trust-Ehrlichkeit eines KO. Hintergrund: Konflikte sind als Workflow vorhanden, wirken
// aber nicht auf KO-Trust/-Status (ConflictService mutiert bewusst weder Trust noch Status — siehe
// conflictView.resolutionEffect: keine maschinelle Wahrheitsfindung, kein stilles Überschreiben).
//
// Bewusste Entscheidung (begründet im Ticket): KEINE neue Trust-Formel-Architektur und KEINE
// serverseitige Status-Rückführung (validiert→offen) — das würde die Validierungs-/Trust-Logik
// (computeOutcome/setValidationState) und Modulgrenzen berühren (große Architekturänderung, ausgeschlossen).
// Stattdessen leiten wir hier EINE konsistente „conflict-limited usability" ab, die KO-Detail, Library
// und Ask gemeinsam nutzen. So behauptet die App für ein validiertes KO mit offenem (v. a. Truth-)
// Konflikt NICHT mehr „uneingeschränkt nutzbar/gesichert", ohne eine Fake-Wahrheit zu erzeugen.
//
// „Keine Fake-Wahrheit": ein Konflikt macht ein KO nicht falsch. Ein OFFENER/eskalierter Konflikt
// bedeutet aber „Review nötig" → Nutzbarkeit wird ehrlich auf „in Prüfung" begrenzt. GELÖSTE Konflikte
// (Status „geloest") fallen aus der Wirkung heraus → blockieren NICHT dauerhaft (kein Fake-Block).
import type { Conflict, ConflictStatus, KnowledgeObject } from "../api/types";
import { type KoUsability, koOverview } from "./koOverview";

// Ungelöste Status spiegeln conflicts.unresolved() (Server: alles außer „geloest").
const UNRESOLVED_STATUS: ReadonlySet<ConflictStatus> = new Set<ConflictStatus>([
  "offen",
  "eskaliert",
  "zweitmeinung",
]);

// none = kein wirksamer Konflikt · limited = ungelöster Nicht-Wahrheitskonflikt · truth = Wahrheitskonflikt (stärkster).
export type ConflictSeverity = "none" | "limited" | "truth";

export interface ConflictImpact {
  affected: boolean; // mind. ein ungelöster Konflikt referenziert dieses KO
  unresolvedCount: number; // Anzahl ungelöster Konflikte am KO
  hasTruth: boolean; // mind. einer davon ist ein Wahrheitskonflikt (am stärksten)
  severity: ConflictSeverity;
  limited: boolean; // true → Nutzbarkeit/Trust ehrlich eingeschränkt
}

const NO_IMPACT: ConflictImpact = {
  affected: false,
  unresolvedCount: 0,
  hasTruth: false,
  severity: "none",
  limited: false,
};

function referencesKo(conflict: Pick<Conflict, "koA" | "koB">, koId: string): boolean {
  return conflict.koA === koId || conflict.koB === koId;
}

function isUnresolved(conflict: Pick<Conflict, "status">): boolean {
  return UNRESOLVED_STATUS.has(conflict.status);
}

// Alle ungelösten Konflikte, die dieses KO referenzieren (Reihenfolge bleibt erhalten).
export function unresolvedConflictsForKo(koId: string, conflicts: readonly Conflict[]): Conflict[] {
  return conflicts.filter((c) => isUnresolved(c) && referencesKo(c, koId));
}

// Konflikt-Wirkung für ein KO aus der (vom Server gelieferten) Konfliktliste ableiten.
export function conflictImpact(koId: string, conflicts: readonly Conflict[]): ConflictImpact {
  const relevant = unresolvedConflictsForKo(koId, conflicts);
  if (relevant.length === 0) {
    return NO_IMPACT;
  }
  const hasTruth = relevant.some((c) => c.type === "truth");
  return {
    affected: true,
    unresolvedCount: relevant.length,
    hasTruth,
    severity: hasTruth ? "truth" : "limited",
    limited: true,
  };
}

// Zentrale Nutzbarkeits-Begrenzung: „ready" (validiert) → „in-review" (Review nötig), wenn ein
// ungelöster Konflikt wirkt. Offene/in-Prüfung-Zustände sind ohnehin nicht „ready" und bleiben.
// Kein wirksamer Konflikt → unverändert (gelöste Konflikte blockieren also nicht weiter).
export function conflictLimitedUsability(base: KoUsability, impact: ConflictImpact): KoUsability {
  return impact.limited && base === "ready" ? "in-review" : base;
}

// Bequemer Direkthelfer für Konsumenten mit KO + Konfliktliste: liefert die effektive, ehrliche
// Nutzbarkeit (koOverview-Basis ggf. konfliktbegrenzt) — EINE Quelle für KO-Detail/Library/Ask.
export function effectiveUsability(
  ko: KnowledgeObject,
  conflicts: readonly Conflict[],
): KoUsability {
  return conflictLimitedUsability(koOverview(ko).usability, conflictImpact(ko.id, conflicts));
}

export interface ConflictNotice {
  severity: Exclude<ConflictSeverity, "none">;
  titleKey: string;
  hintKey: string;
  tone: "warn";
  to: string; // Link zur Konfliktseite (bestehende Route)
}

// Ehrlicher Hinweis (Banner/Chip) für ein konfliktbetroffenes KO. null, wenn keine Wirkung.
// Truth-Konflikt erhält die deutlichere Copy; beides verweist auf die echte Konfliktseite.
export function conflictNotice(impact: ConflictImpact): ConflictNotice | null {
  if (!impact.limited) {
    return null;
  }
  return {
    severity: impact.hasTruth ? "truth" : "limited",
    titleKey: impact.hasTruth ? "conflict.impact.truthTitle" : "conflict.impact.title",
    hintKey: impact.hasTruth ? "conflict.impact.truthHint" : "conflict.impact.hint",
    tone: "warn",
    to: "/konflikte",
  };
}
