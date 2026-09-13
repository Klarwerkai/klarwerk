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
// VIERTE LAGE (JOB 3808): DER RUHENDE ABRUF. Ein gescheiterter Abruf und ein ANGEHALTENER Abruf sind
// nicht dasselbe. Ohne Netz setzt react-query v5 `fetchStatus: "paused"` und KEINEN Fehler — es gibt
// keinen gescheiterten Versuch, den man melden könnte, die Abfrage ruht (`components/start/forYou.ts:198-202`).
// `isGroupStale()` wird deshalb offline nie wahr, und „Auffrischung fehlgeschlagen" wäre dort die
// falsche Auskunft (die Lehre aus JOB 3118). Diese Lage beantwortet `gruppeAngehalten()` ganz unten —
// als EIGENE Frage neben den drei Phasen, nicht als vierter Wert von `LoadPhase`: sie nimmt der
// Anzeige nichts weg (die Daten bleiben stehen, REGELN §7), sie nimmt ihr nur das Recht auf die
// Behauptung, der gezeigte Stand gelte für JETZT.
//
// DOM-frei, im Node-Gate testbar. Start, Navigation, Analytics und Bereitschaft teilen EINE Lösung.
export type LoadPhase = "loading" | "loaded" | "error";

/**
 * Der Abrufstatus eines react-query-Ergebnisses (v5 `fetchStatus`), hier als eigene Aufzählung
 * geschrieben statt aus `@tanstack/react-query` importiert: diese Datei hat bewusst KEINE Importe
 * und läuft im reinen Node-Gate. Die drei Werte sind die vollständige Aufzählung der Bibliothek.
 */
export type Abrufstatus = "fetching" | "paused" | "idle";

// Minimal-Sicht auf ein react-query-Ergebnis: „schon Daten?", „gerade im Fehlerzustand?", „ruht der
// Abruf?".
// `isError` spiegelt react-query `status === "error"` (v5): initial ohne Daten ⇒ harter Fehler; mit
// bereits vorhandenen Daten ⇒ Refetch-Fehler (stale). `fetchStatus` ist die ZWEITE, davon unabhängige
// Achse von v5 und sagt, ob gerade geholt wird, gewartet wird oder nichts läuft. Beide optional, damit
// Bestandsaufrufe {data} gültig bleiben.
export interface HasData {
  readonly data: unknown;
  readonly isError?: boolean;
  readonly fetchStatus?: Abrufstatus;
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

/**
 * RUHT der Abruf dieser Gruppe — ist also gerade gar kein Versuch möglich, den gezeigten Stand
 * nachzuprüfen? Die vierte Lage aus dem Kopfkommentar, und NICHT dasselbe wie `isGroupStale()`.
 *
 * ZWEI GRÜNDE, EIN SATZ — dieselbe Oder-Verknüpfung wie `forYouLage()` sie in ihrem `gestoert` führt
 * (`components/start/forYou.ts:115-116`), und aus demselben Grund an EINER Stelle statt an zweien:
 *
 *   · `!online` — das Gerät hat kein Netz. Dieser Teil MUSS dastehen und ist nicht aus `fetchStatus`
 *     abzuleiten. Genau das war Codex' Befund R-1585 (`lib/netzzustand.ts:5-11`): innerhalb der
 *     `staleTime` von 30 s (`main.tsx`) WILL niemand einen Abruf, die Abfrage steht auf `idle` statt
 *     auf `paused` — und wer nur die Query-Skalare liest, liest daraus „frisch" und schreibt offline
 *     eine Verneinung hin, die er nicht prüfen kann.
 *   · `fetchStatus === "paused"` — an mindestens einer Quelle wartet ein GEWOLLTER Abruf auf das
 *     Netz. Das ist die Lage selbst, unabhängig davon, ob der `onlineManager` sie schon gemeldet hat.
 *
 * `online` steht ausdrücklich im Kopf und hat KEINEN Vorgabewert, wie bei `forYouLage()`
 * (`forYou.ts:108-110`): ein Vorgabewert wäre die Erlaubnis, ihn zu vergessen — und ihn zu vergessen
 * ist genau der Fehler von R-1585.
 *
 * Die Funktionen darüber bleiben unberührt: eine ruhende Gruppe ist weiterhin `loaded`, ihre Werte
 * bleiben sichtbar (REGELN §7), sie wird nur eingeordnet.
 */
export function gruppeAngehalten(sources: readonly HasData[], online: boolean): boolean {
  return !online || sources.some((s) => s.fetchStatus === "paused");
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
