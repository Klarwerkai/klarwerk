/** Bestehende R-0828-Vorleistung: lokales Warten und späte Antworten getrennt vom Serverausgang. */
export class AskAbgebrochen extends Error {
  constructor() {
    super("Warten auf die Antwort abgebrochen.");
    this.name = "AskAbgebrochen";
  }
}

/** Auch wenn ein Transport das Signal ignoriert, darf seine späte Antwort nicht mehr gewinnen. */
export function abbrechbar<T>(lauf: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void lauf.catch(() => undefined);
    return Promise.reject(new AskAbgebrochen());
  }
  return new Promise<T>((resolve, reject) => {
    const abbrechen = () => reject(new AskAbgebrochen());
    signal.addEventListener("abort", abbrechen, { once: true });
    lauf.then(
      (wert) => {
        signal.removeEventListener("abort", abbrechen);
        resolve(wert);
      },
      (fehler: unknown) => {
        signal.removeEventListener("abort", abbrechen);
        reject(fehler);
      },
    );
  });
}

/** Originaler NFR-PERF-02-Zielwert als Hinweisgrenze, keine Frist und keine SLA-Behauptung. */
export function askWartestand(laufzeitMs: number): { sekunden: number; langsam: boolean } {
  const ms = Number.isFinite(laufzeitMs) && laufzeitMs > 0 ? laufzeitMs : 0;
  return { sekunden: Math.floor(ms / 1000), langsam: ms >= 5000 };
}
