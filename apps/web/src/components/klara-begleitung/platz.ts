// ================================================================================================
// AKTIVE BEGLEITUNG · PLATZ NEBEN DER FIGUR (Nacharbeit 9, Ben G10).
// ================================================================================================
//
// Im Bildbeleg bei 390 × 700 lag die Assistenzfigur samt Namensschild über dem Einheitenhinweis
// und der Tastaturzeile der Leiste. Die Figur steht eine Ebene höher (`z-[60]`) und ist
// verschiebbar — ein fester Abstand reicht deshalb nicht. Die Leiste misst die Figur und weicht ihr
// aus: Überschneiden sich beide an der Grundposition (unten links), rückt die Leiste über die Figur.
// Reicht der Platz darüber nicht, wird sie in der Höhe begrenzt und scrollt — lesbar bleibt sie so
// in jedem Fall, überdeckt wird sie nie.

/** Grundabstand zum unteren Rand (Tailwind `bottom-4`). */
export const GRUND_UNTEN = 16;
/** Luft zwischen Figur und Leiste. */
const LUFT = 8;

export interface Rechteck {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface Platz {
  /** Abstand der Leiste zum unteren Fensterrand in px. */
  readonly unten: number;
  /** Höchste Höhe der Leiste in px — darüber scrollt sie. */
  readonly maxHoehe: number;
}

/**
 * Wo die Leiste stehen darf. `leiste` liefert nur die WAAGERECHTE Lage (links/rechts), `inhaltHoehe`
 * die UNGEKÜRZTE Höhe ihres Inhalts, `figur` das Rechteck der Figurhülle (Figur + Namensschild)
 * oder `null`, wenn keine sichtbar ist.
 *
 * Nacharbeit 10 (Ben): hier stand die GEMESSENE Höhe der Leiste. Die ist nach einer eigenen
 * Begrenzung schon gekürzt — die Grundposition galt dann als frei, die Begrenzung fiel weg, die
 * volle Höhe kollidierte wieder, und so fort: ein Pendel, das über die Messung nach jedem Rendern
 * zur Renderschleife werden konnte. Die Entscheidung hängt jetzt nur noch an Größen, die das
 * eigene Ergebnis nicht verändert (Inhaltshöhe, Breite, Figur, Fenster) — dieselbe Eingabe ergibt
 * nach Anwendung des Ergebnisses wieder dasselbe Ergebnis.
 */
export function platzNebenFigur(
  leiste: Pick<Rechteck, "left" | "right">,
  inhaltHoehe: number,
  figur: Rechteck | null,
  fensterHoehe: number,
): Platz {
  const grund: Platz = { unten: GRUND_UNTEN, maxHoehe: fensterHoehe - GRUND_UNTEN - LUFT };
  if (!figur || figur.right - figur.left <= 0 || figur.bottom - figur.top <= 0) {
    return grund;
  }
  const hoehe = inhaltHoehe;
  // Die Leiste an ihrer Grundposition — so, wie sie ohne Ausweichen stünde.
  const grundUnten = fensterHoehe - GRUND_UNTEN;
  const grundOben = grundUnten - hoehe;
  const waagerecht = leiste.left < figur.right && leiste.right > figur.left;
  const senkrecht = figur.top < grundUnten && figur.bottom > grundOben;
  if (!waagerecht || !senkrecht) {
    return grund;
  }
  const unten = Math.max(GRUND_UNTEN, Math.ceil(fensterHoehe - figur.top + LUFT));
  return { unten, maxHoehe: Math.max(0, fensterHoehe - unten - LUFT) };
}
