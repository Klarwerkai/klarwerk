// ================================================================================================
// AUFNAHME 20260922 · PRÜFBOARD-BEDIENUNG — DIE KONFLIKTLAGE EINER PRÜFKARTE.
// ================================================================================================
//
// Funktionsbeschreibung §8.2 verlangt die „Kennzeichnung von Konflikten" am Prüfboard. Ein
// Wissensobjekt trägt kein Konfliktfeld; die Konflikte kommen aus einem EIGENEN Abruf
// (`useConflicts`, derselbe Eintrag `["conflicts"]`, den der Reiterkopf schon für seinen Zähler
// zieht). Pedis Entscheidung vom 03.10.2026 (entscheidung:ebf707cb): „Markierung an jeder
// betroffenen Karte, mit eigenem Lade- und Fehlerzustand für die Konfliktdaten."
//
// Ob ein Objekt betroffen ist, entscheidet DIESELBE Regel wie in Bibliothek, Detail und Ask
// (`conflictImpact`: ungelöster Konflikt, der das Objekt als A oder B nennt). Keine zweite Lesart.
//
// VIER LAGEN, und die Regel aus dem Zustandsmodell (§9) gilt auch hier:
//   laedt      — nie eine Antwort, der Abruf läuft        → ein Satz „wird geladen"
//   fehler     — nie eine Antwort, der Abruf scheiterte   → ein Satz + „Erneut laden"
//   keiner     — Antwort liegt vor, nichts betrifft es    → NICHTS (keine Entwarnung)
//   betroffen  — Antwort liegt vor, mind. ein Konflikt    → die Markierung
// Scheitert nur die AUFFRISCHUNG, bleibt die letzte Aussage stehen und trägt `nichtFrisch`.
// Ohne Antwort entsteht nie eine Aussage über Konflikte — weder „betroffen" noch „keiner".
import type { Conflict } from "../api/types";
import { type ConflictImpact, conflictImpact } from "./conflictImpact";

export type PruefKonfliktLage =
  | { art: "laedt" }
  | { art: "fehler" }
  | { art: "keiner"; nichtFrisch: boolean }
  | { art: "betroffen"; wirkung: ConflictImpact; nichtFrisch: boolean };

export function pruefKonfliktLage(
  koId: string,
  q: { data?: readonly Conflict[] | undefined; isError: boolean; isLoading: boolean },
): PruefKonfliktLage {
  if (q.data === undefined) {
    return q.isError || !q.isLoading ? { art: "fehler" } : { art: "laedt" };
  }
  const wirkung = conflictImpact(koId, q.data);
  if (!wirkung.affected) {
    return { art: "keiner", nichtFrisch: q.isError };
  }
  return { art: "betroffen", wirkung, nichtFrisch: q.isError };
}
