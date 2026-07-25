// AUFTRAG-mega2 Block C / mega3 Block B (bens D9): EIN gemeinsamer, ehrlicher Vertrag für den
// Ladezustand zusammengehöriger Kennzahlen. Vor `loaded` darf KEINE echte 0, keine Warnung und keine
// Negativaussage aus fehlenden Daten abgeleitet werden — sonst ist „lädt" von „echtem Nullergebnis"
// nicht unterscheidbar.
//
// Drei Phasen (mega3 Block B): `loading | loaded | error`. Die frühere Zwei-Phasen-Sicht stellte eine
// DAUERHAFT gescheiterte Query unbegrenzt als „lädt" dar (data blieb undefined) — das behauptet
// fortgesetzte Arbeit, obwohl der Abruf gescheitert ist (die zweite Unwahrheit statt der ersten).
//
// Zusammengehörige Kennzahlen werden ATOMAR behandelt:
//   - loaded : JEDE Quelle hat mindestens einmal Daten geliefert (data !== undefined).
//   - error  : mindestens eine Quelle ist gescheitert (isError) UND hat KEINE nutzbaren Daten —
//              die Gruppe kann als Ganzes nicht ehrlich „laden".
//   - loading: sonst (noch kein Erfolg, aber auch kein harter Fehlerzustand).
//
// Sonderfall Stale: liegen bereits brauchbare Daten vor UND scheitert ein Refetch, bleibt die Gruppe
// `loaded` (die Daten dürfen weiter angezeigt werden), ist aber über isGroupStale() als veraltet/
// gestört ERKENNBAR — sie fällt NICHT in den Initialfehlerzustand zurück.
//
// DOM-frei, im Node-Gate testbar. Start, Navigation, Analytics und Bereitschaft teilen EINE Lösung.
export type LoadPhase = "loading" | "loaded" | "error";

// Minimal-Sicht auf ein react-query-Ergebnis: „schon Daten?" und „gerade im Fehlerzustand?".
// `isError` spiegelt react-query `status === "error"` (v5): initial ohne Daten ⇒ harter Fehler; mit
// bereits vorhandenen Daten ⇒ Refetch-Fehler (stale). Optional, damit Bestandsaufrufe {data} gültig bleiben.
export interface HasData {
  readonly data: unknown;
  readonly isError?: boolean;
}

// Geladen erst, wenn ausnahmslos jede Quelle Daten (auch leere Arrays/Objekte) hat.
export function groupLoadPhase(sources: readonly HasData[]): LoadPhase {
  if (sources.every((s) => s.data !== undefined)) {
    return "loaded";
  }
  // Nicht alle Daten da: eine gescheiterte Quelle OHNE eigene Daten ⇒ ehrlicher Fehlerzustand
  // (kein unbegrenztes „lädt" auf einer dauerhaft gescheiterten Query).
  if (sources.some((s) => s.data === undefined && s.isError === true)) {
    return "error";
  }
  return "loading";
}

export function isGroupLoaded(sources: readonly HasData[]): boolean {
  return groupLoadPhase(sources) === "loaded";
}

export function isGroupLoading(sources: readonly HasData[]): boolean {
  return groupLoadPhase(sources) === "loading";
}

export function isGroupError(sources: readonly HasData[]): boolean {
  return groupLoadPhase(sources) === "error";
}

// Stale/gestört: die Gruppe hat VOLLSTÄNDIGE Daten (loaded), aber mindestens eine Quelle steht im
// Fehlerzustand (ein Refetch scheiterte). Die Daten bleiben sichtbar, sind aber als veraltet zu markieren.
export function isGroupStale(sources: readonly HasData[]): boolean {
  return groupLoadPhase(sources) === "loaded" && sources.some((s) => s.isError === true);
}
