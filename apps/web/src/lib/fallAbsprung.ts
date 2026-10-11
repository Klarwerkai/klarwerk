// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUFGABENANSICHT (R-0961) — DER DIREKTE ABSPRUNG ZUM FALL.
// ================================================================================================
//
// Die Aufgabenliste (`pages/MyTasks.tsx`) führte Konflikte, Re-Validierungen und Wissenslücken nur
// auf die nackte Fläche (`/konflikte`, `/lebenszyklus`, `/risiko`); dort stand dann der ERSTE Fall
// der Warteschlange, nicht der angeklickte. Die Kennung reist jetzt in der Adresse mit, und die
// Zielfläche wählt genau diesen Fall vor. Kennt die Fläche ihn nicht (inzwischen erledigt, oder die
// Liste ist gefiltert), bleibt sie bei ihrem gewohnten Verhalten — kein Fehler, kein leerer Zustand.
//
// Reine Funktionen, DOM-frei. Eine Adressform für alle drei Flächen, kein zweiter Parametername.
export const FALL_PARAM = "fall";

/** Adresse einer Fläche mit vorgewähltem Fall, z. B. `/konflikte?fall=c1`. */
export function fallHref(pfad: string, fallId: string): string {
  return `${pfad}?${FALL_PARAM}=${encodeURIComponent(fallId)}`;
}

/** Die Kennung des vorgewählten Falls aus der Adresse, oder `null`, wenn keiner genannt ist. */
export function leseFall(params: URLSearchParams): string | null {
  const wert = (params.get(FALL_PARAM) ?? "").trim();
  return wert === "" ? null : wert;
}
