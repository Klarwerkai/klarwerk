// ================================================================================================
// PRÜFSTATUS-ANZEIGE (N-0054, Ben R2 BEN-05) · „NOCH NICHT FACHLICH GEPRÜFT" — DIREKT AM WERT.
// ================================================================================================
//
// Der Prüfwert (`Prüfstand: 0 %`) ist ein Review-/Evidenzsignal. Steht er auf 0, sagt die Zahl
// allein nicht, ob noch niemand geprüft hat oder ob eine Prüfung negativ ausfiel. Die Einordnung
// „Noch nicht fachlich geprüft" macht das am Wert sichtbar — aber NUR, wenn die vorhandenen Daten
// es belegen:
//   · der Kern-Status ist nicht `validiert`,
//   · der Prüfwert ist 0 (jede gewertete Bewertung verschiebt ihn — `validation/src/trust.ts`),
//   · am Objekt hängt kein Verweis auf eine Validierungsentscheidung (`validationDecisionRef`),
//   · es sind keine Stimmen bekannt (`reviewVotes`, nur am Prüfbrett angereichert),
//   · und der Server meldet weder `abgelehnt` noch `validiert`/`revalidierung`.
// Fehlt eine dieser Gewissheiten, steht KEINE Einordnung da — sie wird nicht erfunden. Die
// Berechnung des Werts bleibt unberührt (UX-27).
import type { KnowledgeObject } from "../api/types";

export type Pruefeinordnungsquelle = Pick<
  KnowledgeObject,
  "status" | "trust" | "anzeigestatus" | "reviewVotes" | "validationDecisionRef"
>;

const BEWERTET: ReadonlySet<string> = new Set(["abgelehnt", "validiert", "revalidierung"]);

export function nochNichtFachlichGeprueft(ko: Pruefeinordnungsquelle): boolean {
  if (ko.status === "validiert" || ko.trust !== 0 || ko.validationDecisionRef) {
    return false;
  }
  if (ko.anzeigestatus && BEWERTET.has(ko.anzeigestatus)) {
    return false;
  }
  const stimmen = ko.reviewVotes;
  return !stimmen || stimmen.up + stimmen.warn + stimmen.down === 0;
}
