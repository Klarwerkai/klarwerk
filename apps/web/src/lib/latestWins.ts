// WP-IC-PAKET-1b (bens ROT-3): Latest-wins-Serialisierung für die Live-Vorschau. Die debounced
// Filter-Änderungen können mehrere select-Requests überlappen lassen; ohne Guard überschreibt die
// ANTWORT eines ÄLTEREN Requests (der später fertig wird) die neuere Vorschau samt Auswahl-Zustand
// (checkedRows). Pure, DOM-freie Logik: jeder Start zieht eine monoton steigende Request-ID; nur die
// Antwort der ZULETZT gestarteten Anfrage darf angewendet werden — alles Ältere wird verworfen.
export interface LatestWins {
  // Startet eine Anfrage und liefert ihre ID (monoton steigend).
  begin(): number;
  // Darf die Antwort mit dieser ID angewendet werden? true NUR für die zuletzt gestartete.
  isCurrent(id: number): boolean;
}

export function createLatestWins(): LatestWins {
  let latest = 0;
  return {
    begin(): number {
      latest += 1;
      return latest;
    },
    isCurrent(id: number): boolean {
      return id === latest;
    },
  };
}
