// JOB 3065 H6 — DER WERT EINER EINSTELLUNGSZEILE, EHRLICH ABGELEITET.
//
// Eine Zeile der Einstellungen trägt rechts EINEN Wert. Genau dort entscheidet sich, ob die Fläche
// die Wahrheit sagt: „an", „3 Objekte" oder „aktiv" sind Tatsachenaussagen und dürfen NUR aus einem
// erfolgreichen Abruf entstehen. Diese Datei bildet dafür das Zustandsmodell aus REGELN §7 und dem
// Auftrag §9 ab — DOM-frei und ohne i18n, damit die Zuordnung im Node-Gate prüfbar bleibt.
//
//   laden ......................... "–"           (art: "laedt")
//   offline ohne Daten ............ "–"           (art: "offline")
//   Fehler ohne Daten ............. nicht abrufbar (art: "fehler")
//   erfolgreich, aber leer ........ „keine"       (art: "leer")
//   erfolgreich mit Wert .......... der Wert      (art: "wert")
//
// Liegen bereits Daten vor, bleiben sie SICHTBAR (nie leeren!) und tragen einen Zusatz:
//   laufende Auffrischung ......... Stand von <Zeit>
//   gescheiterte Auffrischung ..... Stand von <Zeit> + „nicht aktualisiert"
//   offline mit Cache ............. Stand von <Zeit> + „nicht aktualisiert"
//
// Der Offline-Zustand wird REAKTIV aus dem `onlineManager` gelesen (LEHREN JOB 3037 R5/3044 R2:
// `fetchStatus === "paused"` allein ist zu wenig — ein Verbindungsabbruch ohne laufende Abfrage
// bliebe sonst unbemerkt; und ein wegen `focusManager` pausierter Wiederholungsversuch ist NICHT
// offline).
import { onlineManager } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

/** Die Minimalsicht auf ein react-query-Ergebnis, die für den Zeilenwert nötig ist. */
export interface Abfragelage {
  readonly hatDaten: boolean;
  readonly fehler: boolean;
  readonly laeuft: boolean;
  /** Abruf ruht (offline oder `fetchStatus === "paused"`). */
  readonly pausiert: boolean;
  /** Zeitpunkt des letzten erfolgreichen Abrufs (react-query `dataUpdatedAt`, 0 = nie). */
  readonly standMs: number;
}

export type WertArt = "laedt" | "offline" | "fehler" | "leer" | "wert";

export interface WertBefund {
  readonly art: WertArt;
  /** Nur bei art === "wert": der fachliche Wert. */
  readonly wert: string | null;
  /** Sichtbarer Bestand aus einem älteren Abruf → Stand nennen. 0 = kein Zusatz. */
  readonly standMs: number;
  /** Die Auffrischung ist gescheitert oder ruht — der Bestand ist nicht aktuell. */
  readonly nichtAktualisiert: boolean;
}

/** Die Lage einer Abfrage; `online` kommt aus `useIstOnline()`. */
export function abfragelage(
  q: {
    data: unknown;
    isError: boolean;
    isFetching: boolean;
    fetchStatus: string;
    dataUpdatedAt: number;
  },
  online: boolean,
): Abfragelage {
  return {
    hatDaten: q.data !== undefined,
    fehler: q.isError,
    laeuft: q.isFetching,
    pausiert: !online || q.fetchStatus === "paused",
    standMs: q.dataUpdatedAt,
  };
}

/**
 * Der Befund für eine Zeile.
 *
 * `wert` ist der fachliche Wert AUS den Daten (null, wenn die Daten fehlen); `leer` sagt, ob die
 * erfolgreiche Antwort inhaltlich leer war. Eine positive Aussage entsteht ausschließlich aus
 * `hatDaten` — nie aus einem Vorgabewert.
 */
export function wertBefund(lage: Abfragelage, wert: string | null, leer = false): WertBefund {
  if (!lage.hatDaten) {
    if (lage.pausiert) {
      return { art: "offline", wert: null, standMs: 0, nichtAktualisiert: false };
    }
    if (lage.fehler) {
      return { art: "fehler", wert: null, standMs: 0, nichtAktualisiert: false };
    }
    return { art: "laedt", wert: null, standMs: 0, nichtAktualisiert: false };
  }
  // Daten sind da: sie bleiben sichtbar, auch wenn die Auffrischung scheitert oder ruht.
  const gestoert = lage.fehler || lage.pausiert;
  const standMs = gestoert || lage.laeuft ? lage.standMs : 0;
  return {
    art: leer ? "leer" : "wert",
    wert: leer ? null : wert,
    standMs,
    nichtAktualisiert: gestoert,
  };
}

/**
 * JOB 3065 R5 (BENs Korrekturpflicht 1) — EINE GRUPPE, DERSELBE VERTRAG.
 *
 * Die Bereitschaft ist der einzige Wert der Einstellungen, der aus SECHS Quellen zugleich entsteht.
 * Ihre Zusammenfassung lief bis hierher über `lib/loadingState.ts` — und das kennt ausschließlich
 * `isError`. Ein Verbindungsabbruch NACH erfolgreichem Laden blieb dort unsichtbar: die Zeile trug
 * weiter „4 von 6 ohne Warnung", die Karte ihre Zahlen, beides ohne jeden Hinweis, dass seither
 * nichts mehr nachgeholt wird (BENs Messung an Runde 4: „Teilweise verbunden", „2", „10 Anhänge ·
 * 20 MB" nach `onlineManager.setOnline(false)`).
 *
 * Die Gruppe wird deshalb auf EINE Lage gefaltet und läuft danach durch denselben `wertBefund` wie
 * jede einzelne Zeile — Offline, Fehler, Stand und „nicht aktualisiert" inbegriffen. Was für eine
 * Quelle gilt, gilt damit für sechs.
 */
export function gruppenlage(lagen: readonly Abfragelage[]): Abfragelage {
  // Atomar (mega2/mega3): geladen erst, wenn ausnahmslos JEDE Quelle Daten hat.
  const hatDaten = lagen.length > 0 && lagen.every((l) => l.hatDaten);
  // Solange die Gruppe unvollständig ist, entscheiden allein die FEHLENDEN Quellen über Fehler und
  // Offline — eine Quelle, die ihren Bestand längst hat, macht die Gruppe nicht „nicht abrufbar".
  const massgeblich = hatDaten ? lagen : lagen.filter((l) => !l.hatDaten);
  return {
    hatDaten,
    fehler: massgeblich.some((l) => l.fehler),
    laeuft: lagen.some((l) => l.laeuft),
    pausiert: massgeblich.some((l) => l.pausiert),
    // Der Stand der Gruppe ist der ÄLTESTE ihrer Quellen — sie darf nie frischer aussehen, als
    // ihre älteste Zahl ist.
    standMs: hatDaten ? Math.min(...lagen.map((l) => l.standMs)) : 0,
  };
}

/**
 * Der echte Online-Zustand, reaktiv. `onlineManager` ist dieselbe Quelle, die react-query selbst
 * für `fetchStatus: "paused"` verwendet — hier direkt beobachtet, damit ein Verbindungsabbruch OHNE
 * laufende Abfrage die Zeile ebenfalls erreicht.
 */
export function useIstOnline(): boolean {
  const abonnieren = useCallback(
    (melden: () => void) => onlineManager.subscribe(() => melden()),
    [],
  );
  return useSyncExternalStore(
    abonnieren,
    () => onlineManager.isOnline(),
    () => true,
  );
}
