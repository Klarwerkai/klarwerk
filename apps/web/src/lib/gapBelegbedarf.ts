import type { Gap, GapBelegbedarf } from "../api/types";

// R-0291 — „Zu jeder Lücke soll auch stehen, welcher Beleg für eine tragfähige Antwort fehlen
// würde." Die Regel, die den Bedarf erhebt, steht am Server (services/ask/src/gap-belegbedarf.ts);
// hier steht nur, mit welchen WORTEN er erscheint.
//
// DIE DREI TORE SPRECHEN DIESELBEN WORTE WIE DIE ANTWORTFLÄCHE (R-0303): „Freigabe fehlt",
// „Vertraulichkeitsstufe fehlt", „Kein durchsuchbarer Text" — dieselben Schlüssel
// `ask.verschlossen.*`, kein zweiter Wortlaut für dieselbe Sache.

const SCHLUESSEL: Record<GapBelegbedarf, string> = {
  wissensobjekt: "gap.belegbedarf.wissensobjekt",
  freigabe: "ask.verschlossen.freigabe",
  stufe: "ask.verschlossen.vertraulichkeitsstufe",
  volltext: "ask.verschlossen.volltext",
  unbestimmt: "gap.belegbedarf.unbestimmt",
};

/**
 * Die i18n-Schlüssel des Belegbedarfs einer Lücke, in der Reihenfolge des Servers — oder `null`
 * bei einer redigierten Lücke: der Befund gehört zur Frage und wird mit ihr zurückgehalten.
 * Altbestand ohne Befund ergibt ausdrücklich „unbestimmt" statt Schweigen oder Raten.
 */
export function gapBelegbedarfSchluessel(
  gap: Pick<Gap, "belegbedarf" | "redacted">,
): string[] | null {
  if (gap.redacted) {
    return null;
  }
  const bedarf = gap.belegbedarf ?? [];
  // Ein unbekannter Wert (neuere Serverfassung) wird übergangen, nicht roh angezeigt.
  const bekannt = bedarf.filter((b) => b in SCHLUESSEL);
  return bekannt.length > 0 ? bekannt.map((b) => SCHLUESSEL[b]) : [SCHLUESSEL.unbestimmt];
}
