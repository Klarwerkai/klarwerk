// R-0700: woran ein Test eine FRAGE des Word-Seitenfensters erkennt. Mit Sitzung fragt das Fenster
// über Klaras eigenen, sitzungsgebundenen Zugang (`POST /api/klara/sessions/{sessionId}/execute`),
// ohne Sitzung über den allgemeinen Frageweg. Ein Zähler „keine Frage ging hinaus" muss BEIDE Ziele
// sehen, sonst wäre er schon deshalb wahr, weil die Frage anderswohin ginge.
//
// Bewusst ein eigenes, kleines Modul: es liest das Fenster nicht und hängt an keiner Bühne. Wer nur
// die Zählung braucht, bekommt damit keinen neuen Griff auf das Fenster (schnitt-pins A2).

/** Klaras eigener, sitzungsgebundener Ausführungszugang. */
export const KLARA_AUSFUEHRUNG = /^\/api\/klara\/sessions\/[^/?]+\/execute(?:\?|$)/;

/** Ist dieser Aufruf eine Frage des Fensters — am allgemeinen Weg oder an Klaras Zugang? */
export function istFrageAufruf(url: string): boolean {
  return url === "/api/ask" || KLARA_AUSFUEHRUNG.test(url);
}
