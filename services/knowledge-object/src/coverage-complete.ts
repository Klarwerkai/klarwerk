// ================================================================================================
// AUFTRAG-mega32 BLOCK A1 (bens GELB-1) — DIE VOLLSTÄNDIGKEITS-INVARIANTE, GESPIEGELT.
// ================================================================================================
//
// KANONISCH IST services/conflicts/src/coverage.ts, isCompleteRun(). Diese Datei leitet NICHTS
// eigenständig ab — sie trägt dieselbe Regel ein zweites Mal, weil knowledge-object das Modul
// conflicts nicht kennen darf (Modulgrenze, s. types.ts zu AiCheckCoverage: die Struktur ist aus
// demselben Grund eigenständig deklariert).
//
// DAS IST BEWUSST EIN SPIEGEL UND KEIN ZWEITER ENTSCHEIDER. Vor mega32 stand die Regel gar nicht
// als Funktion da, sondern ausgeschrieben mitten in aiCheckCoverageSummary — und sie lautete dort
// anders als in conflicts (drei Merker statt der Zahlen). Genau so laufen zwei Auslegungen
// auseinander. Jetzt gibt es je Modulseite EINEN benannten Ort, und ein WIRKSAMER Paritätswächter
// (tests/conflicts/coverage-invariant-parity.test.ts) hält alle drei aneinander: 32 erzeugte Fälle
// plus ein Gitter aus 1296 Datensätzen gegen eine unabhängige Referenz (AUFTRAG-mega33 C).
// Dasselbe Wächter-Muster wie bei den elf Entwurfs-Grenzwerten in Commit 1881211.
//
// DIE REGEL (Begründung je Bedingung s. conflicts/src/coverage.ts):
//   selected === available && attempted === completed && skipped === 0 && !capped && !aborted
import type { AiCheckCoverage } from "./types";

export function isCompleteAiCheckCoverage(coverage: AiCheckCoverage): boolean {
  return (
    coverage.selected === coverage.available &&
    coverage.attempted === coverage.completed &&
    coverage.skipped === 0 &&
    !coverage.capped &&
    !coverage.aborted
  );
}
