// ================================================================================================
// R-0246 · STAPEL-BEARBEITUNG IM PRÜFBEREICH — die Regel je Objekt.
// ================================================================================================
//
// Originalanforderung: „Pruefer koennen mehrere Objekte auf einmal auswaehlen, gesammelt bestaetigen
// oder zuweisen." UI/UX-Brief Screen 5: Stapel-Leiste ab Controller, Auswahl-Kästchen je Zeile, in
// Prioritätsreihenfolge.
//
// EIN STAPEL IST KEINE ABKÜRZUNG AN DEN SICHERUNGEN DER EINZELFREIGABE. Jedes Objekt durchläuft
// dieselben Prüfungen wie am Knopf „Freigeben" seiner Karte, in derselben Reihenfolge:
//   1. KI-Prüfung läuft      → nichts geschickt (`validationAiGate`)
//   2. offene Dublette       → nichts geschickt; bestätigt wird nur einzeln (R-0247)
//   3. keine Stufe           → nichts geschickt; gefragt wird nur einzeln (JOB 3112 · V3)
//   4. sonst                 → `rate` mit `up`, ohne `duplicateAcknowledged`
// Was nicht geschickt wird, steht im Ergebnis mit seinem Grund und bleibt ausgewählt — der Mensch
// entscheidet es an der Karte. Die Rechte prüft weiterhin der Server (`ko.validate` / `ko.assign`).
//
// Zuweisen läuft über denselben Weg wie das Auswahlfeld der Karte (`assign`), mit derselben Sperre
// während einer laufenden Prüfung.
//
// NACHARBEIT 7: geprüft wird VOR JEDEM einzelnen Aufruf am JETZIGEN Stand des Objekts, nicht am
// Stand beim Start des Stapels. Wird B während des Aufrufs für A als „KI-Prüfung läuft" gemeldet
// oder fällt aus der Liste, wird B nicht geschickt — wie bei der Einzelentscheidung.

export type StapelArt =
  | "bestaetigt"
  | "zugewiesen"
  | "gesperrt"
  | "dubletteOffen"
  | "stufeFehlt"
  | "bereitsZugewiesen"
  /** Nacharbeit 7: der Eintrag ist während des Laufs aus der Warteschlange gefallen. */
  | "entfallen"
  | "fehler";

export interface StapelErgebnis {
  id: string;
  title: string;
  art: StapelArt;
  /** Nur bei `fehler`: der Servertext. */
  meldung?: string;
}

/** Was vor dem Senden je Objekt feststeht — aus denselben Prädikaten wie an der Karte. */
export interface StapelLage {
  gesperrt: boolean;
  dubletteOffen: boolean;
  stufeFehlt: boolean;
}

/** Die Vorprüfung des Bestätigens: `null` heisst „darf geschickt werden". */
export function bestaetigenVorpruefung(lage: StapelLage): StapelArt | null {
  if (lage.gesperrt) {
    return "gesperrt";
  }
  if (lage.dubletteOffen) {
    return "dubletteOffen";
  }
  if (lage.stufeFehlt) {
    return "stufeFehlt";
  }
  return null;
}

/** Die Vorprüfung des Zuweisens: `null` heisst „darf geschickt werden". */
export function zuweisenVorpruefung(
  lage: Pick<StapelLage, "gesperrt">,
  zugewiesen: readonly string[],
  userId: string,
): StapelArt | null {
  if (lage.gesperrt) {
    return "gesperrt";
  }
  if (zugewiesen.includes(userId)) {
    return "bereitsZugewiesen";
  }
  return null;
}

/**
 * Erledigt ist nur, was wirklich am Server ankam — alles andere bleibt in der Auswahl. Ein
 * entfallener Eintrag steht nicht mehr in der Liste; ihn ausgewählt zu lassen hiesse, eine
 * unsichtbare Auswahl zu behalten.
 */
const VERLAESST_AUSWAHL: ReadonlySet<StapelArt> = new Set<StapelArt>([
  "bestaetigt",
  "zugewiesen",
  "bereitsZugewiesen",
  "entfallen",
]);

export function bleibtAusgewaehlt(art: StapelArt): boolean {
  return !VERLAESST_AUSWAHL.has(art);
}
