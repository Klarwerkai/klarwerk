// ================================================================================================
// R-1349 (Aufnahme gesamt-aufruferwaechter) · DIE AUSWAHLMENGE, GEMESSEN AM PRODUKTWEG.
// ================================================================================================
//
// Bis hierher prüften diese Stände die Auswahl auch über `keywordSelect` aus
// `services/reasoner/src/provider.ts`, einen zweiten Auswahlweg, den kein Provider rief. Er ist
// entfernt. Seine Zusage — dasselbe Tor, dieselbe Substanzschwelle, dieselbe relative Regel wie in
// `rankCandidates` (mega52 B1, mega58 A, mega59 B, JOB 3049) — gilt für die Menge, die
// `rankCandidates` OHNE Deckel ausliefert. Genau diese Menge gibt dieser Zugang heraus.
//
// KEIN NACHBAU: hier wird nichts gerechnet. Der Zugang ruft den Produktweg und lässt nur den Deckel
// `topK` weg, damit „nichts ausgewählt" nicht vom Deckel kommen kann. Die Reihenfolge ist die von
// `rankCandidates`; die Fälle, die diesen Zugang lesen, vergleichen höchstens einen Treffer der
// Reihe nach oder die Menge.
import { type KnowledgeRef, type Relevanztext, rankCandidates } from "../../services/reasoner";

export function keywordSelect(
  question: string,
  candidates: readonly KnowledgeRef[],
  relevanz: Relevanztext = [],
): KnowledgeRef[] {
  const ohneDeckel = rankCandidates(question, candidates, Number.POSITIVE_INFINITY, relevanz);
  return ohneDeckel.map((x) => x.ref);
}
