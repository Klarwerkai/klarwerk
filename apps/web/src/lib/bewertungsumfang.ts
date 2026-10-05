// ================================================================================================
// PRÜFSTATUS-ANZEIGE (N-0078) · WIE VIEL FEHLT NOCH BIS ZUR VALIDIERUNG?
// ================================================================================================
//
// Auf der Prüfkarte heißt die positive Entscheidung „Freigeben". Sie ist aber EINE Bewertung —
// validiert ist ein Objekt erst bei genug positiven und keiner roten (`validation/src/trust.ts`,
// `computeOutcome`). Bisher stand der Umfang nur als Punkte mit Tooltip da. Diese Ableitung liefert
// den Satz, der unmittelbar neben dem Knopf steht. Dieselben Zahlen wie die Punkte (`ReviewSignals`)
// — keine zweite Zählung.
import type { ReviewSignals } from "./reviewSignals";

export interface Bewertungsumfang {
  readonly art: "blockiert" | "offen" | "genug";
  readonly schluessel: string;
  readonly werte: Record<string, number>;
}

export function bewertungsumfang(
  sig: Pick<ReviewSignals, "greenVotes" | "redVotes" | "needed">,
): Bewertungsumfang {
  const need = Math.max(sig.needed, 1);
  if (sig.redVotes > 0) {
    return {
      art: "blockiert",
      schluessel: "pruefstatus.bewertung.blockiert",
      werte: { count: sig.redVotes },
    };
  }
  const rest = Math.max(0, need - sig.greenVotes);
  if (rest > 0) {
    return {
      art: "offen",
      schluessel: "pruefstatus.bewertung.rest",
      werte: { count: rest, have: sig.greenVotes, need },
    };
  }
  return {
    art: "genug",
    schluessel: "pruefstatus.bewertung.genug",
    werte: { have: sig.greenVotes, need },
  };
}
