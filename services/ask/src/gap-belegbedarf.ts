import type { GapBelegbedarf } from "./types";

// R-0291 — „Zu jeder Lücke soll auch stehen, welcher Beleg für eine tragfähige Antwort fehlen
// würde." Reine, deterministische Regel: KEIN KI-Aufruf, keine Suche, kein Schreiben. Bedeutung der
// Werte am Typ (`types.ts`, `GapBelegbedarf`).
//
// Die Eingabe ist je Objekt der ZUSTAND seiner drei Tore — gemessen wie in der Torlage
// (`AskService.ask`, `verschlossenFeld`): nicht validiert → Freigabe fehlt, keine Stufe → Stufe
// fehlt, Suchprojektion ohne Dokumenttext → kein durchsuchbarer Text. Übergeben wird nur, was der
// Fragende sehen durfte und was nicht vertraulich ist; vertrauliche Objekte können nie Grundlage
// sein und gehen deshalb weder in die Antwort noch in diesen Befund ein.

export interface BelegbedarfObjekt {
  readonly freigabeFehlt: boolean;
  readonly stufeFehlt: boolean;
  readonly volltextFehlt: boolean;
}

/** Feste Reihenfolge der Torbegriffe — dieselbe wie in der Torlage der Antwortfläche. */
const TORE: readonly ["freigabe", "stufe", "volltext"] = ["freigabe", "stufe", "volltext"];

export function leiteBelegbedarfAb(objekte: readonly BelegbedarfObjekt[]): GapBelegbedarf[] {
  if (objekte.length === 0) {
    return ["wissensobjekt"];
  }
  const zu = new Set<GapBelegbedarf>();
  for (const objekt of objekte) {
    if (objekt.freigabeFehlt) zu.add("freigabe");
    if (objekt.stufeFehlt) zu.add("stufe");
    if (objekt.volltextFehlt) zu.add("volltext");
  }
  const tore = TORE.filter((tor) => zu.has(tor));
  // Alle Tore offen und trotzdem keine Antwort (Relevanz, Modellentscheid): nicht herleitbar.
  return tore.length > 0 ? tore : ["unbestimmt"];
}
