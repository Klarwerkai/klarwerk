// SCRUM-301: DOM-freie, EINE Quelle der Wahrheit für die sichtbare Pilot-Beweiskette
// „Wissen finden → Nutzbarkeit erkennen → Quelle/Trust/Version prüfen". Start zeigt diese Linie als
// Versprechen; Library (Reife/Nutzbarkeit + Status + Trust + Weg ins Detail) und KO-Detail
// (Status/Trust/Version/Quellen) lösen sie ein — dieselbe Sprache wie useReadiness/koOverview.
// NUR i18n-Schlüssel + Reihenfolge: keine Logik, keine Route, keine Suche, keine Engine, kein Backend.

export type ProofBeatId = "find" | "usability" | "verify";

export interface ProofBeat {
  id: ProofBeatId;
  n: number; // 1-basierte Position in der Beweiskette
  labelKey: string; // i18n-Key für die kurze Beweis-Aussage
}

// Drei Beats, die exakt der Pilot-Linie Start → Library → KO-Detail entsprechen:
//  1. find      → auffindbares Wissen (Library-Treffer)
//  2. usability  → Nutzbarkeit erkennen (useReadiness-Plakette in Library/KO-Detail)
//  3. verify     → Quelle/Trust/Version prüfen (KO-Detail-Overview)
export const PROOF_CHAIN: readonly ProofBeat[] = [
  { id: "find", n: 1, labelKey: "demo.proof.find" },
  { id: "usability", n: 2, labelKey: "demo.proof.usability" },
  { id: "verify", n: 3, labelKey: "demo.proof.verify" },
];

export function proofChain(): readonly ProofBeat[] {
  return PROOF_CHAIN;
}
