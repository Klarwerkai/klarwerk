// ================================================================================================
// AUFTRAG-mega28 BLOCK A1 (Pedi 26.07.) — EIN WERT, EINE STELLE.
// ================================================================================================
//
// DER BEFUND. Der Bulk-Import umgeht die Modellaufrufe nur für die BELADUNG. Steht der Bestand
// einmal, kostet jedes einzelne neu eingereichte Objekt `n−1` Duplikat-Urteile plus bis zu `n−1`
// Konflikt-Urteile, weil beide Erkennungen gegen den gesamten Bestand liefen. Bei 12.480 Objekten
// sind das 12.479 Aufrufe für EINEN Submit, im schlechtesten Fall knapp 25.000. Nichts brach das
// ab: die Queue-Kappe (MAX_AI_CHECK_QUEUE) verwirft ganze JOBS, nicht Aufrufe eines laufenden
// Jobs, und der Job-Timeout (AI_CHECK_JOB_TIMEOUT_MS) beendet den inneren Erkennungs-Lauf
// ausdrücklich nicht (s. ai-check-worker.ts: „Der innere Erkennungs-Lauf ist nicht abbrechbar").
//
// DER VERGLEICH, DER DEN AUSSCHLAG GAB. Der Trockenlauf checkText deckelt seinen Kandidatenpool
// seit jeher hart auf RETRIEVAL_TOP_K = 20 (check-text-detection.ts). Der Live-Weg hatte kein
// Gegenstück — der Probelauf war benutzbar, der echte Weg nicht.
//
// DIE ENTSCHEIDUNG (Pedi 26.07., kehrt „jeder gegen jeden" vom 04.07. um): der Deckel kommt, und
// er steht GENAU HIER — ein Wert für BEIDE Live-Wege. Konflikt- und Duplikatweg dürfen nicht
// unbemerkt verschieden deckeln; wer den Wert ändert, ändert ihn zwangsläufig für beide.
//
// WARUM 20 (der Ausgangswert des Trockenlaufs, unverändert übernommen):
//  - Er ist im Haus bereits erprobt: derselbe Wert trägt den Live-Check gegen den validierten
//    Bestand. Ein zweiter, abweichender Wert wäre eine zweite Behauptung über „genug Nachbarn",
//    die wir mit nichts belegen könnten.
//  - Die Kandidatenwahl sortiert nach demselben Deckungsmaß, das die Erkennung ohnehin berechnet.
//    Die zwanzig sind damit die textnächsten — und zwar deterministisch, nicht zufällig.
//    AUFTRAG-mega32 BLOCK L: hier stand bis mega31 der Zusatz, Rang 21 sei „lexikalisch bereits
//    deutlich entfernt". Das ist eine MESSAUSSAGE, und gemessen haben wir sie nie — zwei Absätze
//    weiter steht im selben Kommentar ehrlich „erprobt, nicht gemessen". Über den ABSTAND zwischen
//    Rang 20 und Rang 21 sagt dieser Kommentar deshalb nichts mehr; er sagt nur, wonach sortiert
//    wurde. Der Deckelwert bleibt unverändert 20.
//  - Er hält die Kosten eines Submits bei 12.480 Objekten von ~25.000 Urteilen auf höchstens 40.
// Ein größerer Wert wäre nicht falsch, aber er wäre unbegründet. Sollte sich zeigen, dass 20 zu
// eng ist, ist die Antwort ein Wiederaufnahme-/Rescan-Weg (ausdrücklich NICHT Gegenstand dieses
// Auftrags) — nicht ein stillschweigend größerer Deckel.
//
// EHRLICHKEIT (A2/A3): der Deckel allein wäre eine Lüge. Beide Wege protokollieren ihre Abdeckung
// (services/conflicts/src/coverage.ts) und der aiCheck trägt sie bis in die Oberfläche.
export const DETECTION_CANDIDATE_CAP = 20;

// ================================================================================================
// AUFNAHME 20260922 · R-1124 — DER WAHLWEISE VOLLABGLEICH EINES OBJEKTS GEGEN DEN GANZEN BESTAND.
// ================================================================================================
//
// „Für besonders wichtige Wissensbestände soll die Widerspruchs- und Dublettenprüfung wahlweise
// gegen den ganzen Bestand laufen statt nur gegen die zwanzig nächsten Treffer."
//
// `gedeckelt` ist der Normalfall jedes Einreichens und jedes Abrufs (oben, unverändert).
// `vollstaendig` wählt ein Mensch mit `ko.validate` ausdrücklich für EIN Objekt
// (`POST /api/kos/:id/ai-check` mit `{ "umfang": "vollstaendig" }`). Dann fällt im Konflikt- UND im
// Dublettenweg der Deckel weg, und der Konfliktweg verzichtet zusätzlich auf seinen fachlichen
// Vorfilter: jedes aktive Nicht-Demo-Objekt wird verglichen. Das ist EIN Subjekt gegen den Bestand —
// keine Vollpaarprüfung des Bestands; nichts läuft davon automatisch.
//
// Was „besonders wichtig" ist, legt keine Quelle fest. Deshalb gibt es kein Merkmal und keine
// Automatik: die Wahl trifft der Mensch je Objekt. Die Abdeckung meldet das Ergebnis nach derselben
// Regel wie immer (`isCompleteRun`) — vollständig heißt es nur, wenn jeder Vergleich geurteilt hat.
export type PruefUmfang = "gedeckelt" | "vollstaendig";

/** Der Vergleichsdeckel je Umfang: `vollstaendig` hat keinen. */
export function vergleichsDeckel(umfang: PruefUmfang = "gedeckelt"): number {
  return umfang === "vollstaendig" ? Number.POSITIVE_INFINITY : DETECTION_CANDIDATE_CAP;
}
