import type { Role } from "../../app/navigation";
import { stufe2HintKind } from "../../lib/stufe2Hint";

// ================================================================================================
// JOB 3064 H5 — DIE PUNKTE DES „…"-MENÜS: WELCHE ES GIBT UND WER SIE SIEHT.
// ================================================================================================
// Bewusst eine eigene, DOM-FREIE Datei neben `StartPanel.tsx`: die Tabelle ist die Erwartung des
// Funktionsinventars (`tests/design/h5-funktionsinventar.test.ts`), und dieser Test läuft im
// Wurzel-Typprüfer, der ohne `jsx` fährt und deshalb keine `.tsx` importieren darf (dieselbe
// Grenze, die schon `lib/speechDictation.ts` von `lib/useAiAvailable.tsx` trennt). Die Erwartung
// kommt damit aus der PRODUKTIVEN Tabelle statt aus einer Abschrift.
export const START_PANEL_IDS = [
  "ueber",
  "klara",
  "kreis",
  "demo",
  "erst",
  "gerade",
  "kapital",
  "kollision",
  "stufe2",
  "hilfe",
] as const;
export type StartPanelId = (typeof START_PANEL_IDS)[number];

/** Menü-Beschriftung je Punkt. */
export function startPanelLabelKey(id: StartPanelId): string {
  return `start.menu.${id}`;
}

/**
 * Welche Punkte diese Rolle sieht — „Ersteinrichtung" und „Stufe 2" sind Admin-Flächen.
 *
 * Die Stufe-2-Frage beantwortet DIESELBE Funktion wie bisher (`stufe2HintKind`, SCRUM-235) und
 * nicht eine zweite, hier abgeschriebene Bedingung: eine Kopie „role === admin && !stufe2" wäre
 * genau die driftfähige Doppelwahrheit, gegen die dieses Haus mehrfach angetreten ist.
 */
export function startPanelSichtbar(id: StartPanelId, role: Role, stufe2: boolean): boolean {
  if (id === "erst") {
    return role === "admin";
  }
  if (id === "stufe2") {
    return stufe2HintKind(role, stufe2) === "enable";
  }
  return true;
}
