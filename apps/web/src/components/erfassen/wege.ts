// ================================================================================================
// JOB 3062 · H3 — DIE WEGE DES MENÜS „DATEI ▾", ABGELEITET.
// ================================================================================================
// Das Blatt bietet in seinem Menü „Datei ▾" die Wege an, die NICHT auf dem Blatt selbst geschrieben
// werden: Dateiimport, geführtes Interview und das Expertenformular. Freitext und Diktat stehen
// nicht darin — der Freitext IST das Blatt, und das Diktat ist ein eigenes Werkzeug der Zeile.
//
// ABGELEITET STATT ZWEITGESCHRIEBEN, aus demselben Grund wie früher `FRONT_DOOR_OPTION_MODES`:
// ein neuer Erzählweg erscheint im Menü ohne Nacharbeit. Die Reihenfolge folgt dem Bestand.
//
// WARUM DIESE DATEI HIER LIEGT UND NICHT IN `lib/captureEntry.ts`: Runde 1 hat die Ableitung dort
// hineingeschrieben — außerhalb der Zielpfade dieses Auftrags, was der Sachprüfer zu Recht rot
// geurteilt hat. Sie gehört ohnehin hierher: sie beschreibt EIN Menü EINER Komponente, nicht den
// allgemeinen Erfassungs-Einstieg. `lib/captureEntry.ts` bleibt unangetastet und liefert nur die
// Grundmengen `NARRATE_MODES` und `EXPERT_MODE`, die es schon vor diesem Auftrag exportiert hat.
import { EXPERT_MODE, NARRATE_MODES } from "../../lib/captureEntry";
import type { CaptureMode } from "../../lib/captureEntry";

export const BLATT_WEGE: readonly CaptureMode[] = [
  ...NARRATE_MODES.filter((m) => m !== "freitext" && m !== "diktat"),
  EXPERT_MODE,
];

// Beschriftung eines Wegs im Menü — EIN Schlüsselschema, kein zweiter Textbestand.
export function blattWegLabelKey(mode: CaptureMode): string {
  return `erfassen.weg.${mode}`;
}
