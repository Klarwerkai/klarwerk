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

// ================================================================================================
// JOB 3113 · H1b — DIE ZWEITE HÄLFTE VON „NICHT MEHR GEDECKT": DIE ZEIT.
// ================================================================================================
//
// `isGroupStale` kennt genau EINEN Grund, warum eine Zahl nicht mehr gilt: ein Neuabruf ist
// GESCHEITERT. Ein Cache, den einfach niemand mehr nachgefragt hat, erfüllt diese Bedingung nie —
// die Zahl blieb stehen und sah aus wie eine Auskunft über JETZT, obwohl sie eine über DAMALS war.
//
// Deshalb kommt hier der zweite Grund dazu: eine Zahl ist nur so lange gedeckt, wie ein
// ERFOLGREICHER Abruf sie deckt und dieser jünger als die Frist ist. Beurteilt wird ATOMAR wie in
// `groupLoadPhase`: die Gruppe ist so frisch wie ihre ÄLTESTE Quelle.
//
// Die Funktionen darüber (`groupLoadPhase`, `isGroupLoaded/Loading/Error`, `isGroupStale`) bleiben
// in Signatur UND Verhalten unangetastet — Start, Analytics und Bereitschaft teilen diese Datei.

/**
 * Die Frist, nach der eine geholte Zahl nicht mehr als Auskunft über JETZT gilt.
 *
 * Sie wohnt an DIESER einen Stelle, weil sie zugleich der `staleTime` des `QueryClient` ist
 * (`main.tsx`): genau dann hört react-query auf, die Antwort für frisch zu halten. Zwei Ausdrücke
 * derselben Zahl wären ein zweites Gehirn (LEHREN.md, JOB 3081 R2).
 */
export const ZAEHLER_FRISCHE_MS = 30_000;

/**
 * Minimal-Sicht auf ein react-query-Ergebnis für die Frischefrage: der Zeitpunkt der letzten
 * BESTÄTIGUNG (`dataUpdatedAt`, v5 an jedem Ergebnis; 0 = nie bestätigt).
 *
 * DIE GRENZE DIESES FELDES, gemessen von Codex an Runde 1 und hier BENANNT statt verschwiegen:
 * react-query setzt `dataUpdatedAt` auch dann auf jetzt, wenn jemand den Cache ÖRTLICH schreibt
 * (`setQueryData`). Wo das geschieht, belegt der Zeitpunkt keine Serverantwort mehr, und eine
 * abgelaufene Zahl kann durch einen blossen Klick zurückkommen. Es gibt im Ergebnis von
 * react-query kein zweites Feld, das nur echte Abrufe zählt — die Stelle ist deshalb nur beim
 * SCHREIBER zu schliessen, nicht hier beim Leser.
 *
 * Seit H1c (1.0.0-beta.1.138) entzieht der örtliche Löschschritt der Prüfen-Seite
 * (`pages/Validation.tsx`, `removeDeletedKoFromCaches`) die Bestätigung ausdrücklich mit
 * `{ updatedAt: 0 }`. Erst ein erfolgreicher neuer Board-Abruf bestätigt die Gesamtzahl wieder.
 * `tests/kopfzaehler-frische/kein-frischer-cache-eingriff.test.ts` erlaubt nur das direkte dritte
 * Argument `{ updatedAt: 0 }` ohne weitere Eigenschaften. Seine Erhebung reicht höchstens acht
 * Zeilen und verlangt die literalen Schlüssel in der Schreibweise seines Schlüsselregisters.
 * Er beurteilt setQueryData/setQueriesData als Bezeichner- und Punktaufruf (auch qc?.Methode),
 * mit optionalen Typargumenten; Name und ( bzw. < müssen auf derselben Zeile stehen.
 * Elementzugriffe, optionale Aufrufe f?.(...), umbenannte Funktionen und .call/.apply/.bind
 * bleiben ausserhalb der Erhebung. Schlüsselaliase werden nicht statisch aufgelöst; der
 * gemountete Löschtest prüft den echten Löschweg unabhängig vom Schlüsselnamen zur Laufzeit.
 */
export interface HatStand {
  readonly dataUpdatedAt: number;
}

/** Ein brauchbarer Zeitstempel — ohne ihn ist nichts bestätigt (vgl. `lib/eigeneKollision.ts:141`). */
function bestaetigtAm(quelle: HatStand): number | null {
  return quelle.dataUpdatedAt > 0 ? quelle.dataUpdatedAt : null;
}

/**
 * Ist die Gruppe nicht mehr durch einen frischen Abruf gedeckt? Wahr, sobald IRGENDEINE Quelle nie
 * erfolgreich geholt wurde (`dataUpdatedAt === 0`) oder ihre Bestätigung die Frist erreicht hat.
 * Die Grenze liegt AUF der Frist (`>=`): genau dort endet die Deckung, sie reicht nicht darüber.
 */
export function gruppeVeraltet(
  sources: readonly HatStand[],
  jetzt: number,
  fristMs: number = ZAEHLER_FRISCHE_MS,
): boolean {
  return sources.some((s) => {
    const stand = bestaetigtAm(s);
    return stand === null || jetzt - stand >= fristMs;
  });
}

/**
 * Der nächste Zeitpunkt, an dem eine dieser Quellen ihre Deckung VERLIERT — oder `null`, wenn keine
 * mehr bevorsteht (nichts bestätigt oder alles schon abgelaufen).
 *
 * Dafür da, dass die Oberfläche GENAU EINMAL neu zeichnet, wenn eine Zahl ungedeckt wird, statt im
 * Sekundentakt zu ticken: die Navigation ist auf jeder Seite gemountet. Bereits abgelaufene Quellen
 * werden übersprungen — sonst bliebe nach dem ersten Ablauf die Zahl einer JÜNGEREN Gruppe stehen,
 * weil kein weiterer Zeitpunkt mehr gefunden würde.
 */
export function naechsterFristablauf(
  sources: readonly HatStand[],
  jetzt: number,
  fristMs: number = ZAEHLER_FRISCHE_MS,
): number | null {
  let frueheste: number | null = null;
  for (const s of sources) {
    const stand = bestaetigtAm(s);
    if (stand === null) {
      continue;
    }
    const ablauf = stand + fristMs;
    if (ablauf > jetzt && (frueheste === null || ablauf < frueheste)) {
      frueheste = ablauf;
    }
  }
  return frueheste;
}
