import type { DetectionCoverage } from "../../services/conflicts";

// AUFTRAG-mega32 BLOCK B — DIE BUCHHALTUNG EINES EINZELLAUFS, GEPRÜFT STATT BEHAUPTET.
//
// R-1349: Diese Prüfung stand bis hierher als `singleRunBalances` in
// `services/conflicts/src/coverage.ts`. Kein Produktweg hat sie gerufen — sie ist das Orakel, mit
// dem die Tests die Zählung eines Laufs nachrechnen. Sie liegt deshalb hier, unverändert im Inhalt.
//
// Die Gleichung gilt AUSSCHLIESSLICH je EINZELLAUF; nach `mergeCoverage` ist sie bedeutungslos (dort
// mischen sich Minima und Summen aus zwei Läufen). Beim Kapazitätsabbruch zählt der abbrechende
// Kandidat als `attempted` — er wurde vorgelegt —, aber weder als `completed` (er hat nicht geurteilt)
// noch als `skipped`. Er ist die EINE Fehlstelle, die ein abgebrochener Lauf haben darf. Zwei wären
// ein Zählfehler.
export function singleRunBalances(coverage: DetectionCoverage): boolean {
  const accountedFor = coverage.completed + coverage.skipped + (coverage.aborted ? 1 : 0);
  return coverage.attempted === accountedFor;
}
