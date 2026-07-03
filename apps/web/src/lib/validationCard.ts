// SCRUM-416 (Pedi 03.07.): Board-Karte intuitiv öffnen — ein Klick auf die FREIE Kartenfläche
// führt ins KO-Detail. Klicks auf Bedienelemente (Entscheiden, Aufklappen, Links, ?-Hilfen,
// Eingaben) navigieren bewusst NICHT mit — kein versehentliches Öffnen beim Bewerten.
// DOM-frei testbar über die schmale closest-Schnittstelle des Klick-Ziels.

export const CARD_INTERACTIVE_SELECTOR = "a,button,summary,details,input,textarea,select,label";

export interface ClickTargetLike {
  closest(selector: string): unknown;
}

// true = der Klick traf freie Fläche → Karte darf öffnen. false = ein Bedienelement
// (oder etwas darin) wurde getroffen → dessen eigene Aktion gilt, keine Navigation.
export function cardClickOpens(target: ClickTargetLike): boolean {
  return !target.closest(CARD_INTERACTIVE_SELECTOR);
}
