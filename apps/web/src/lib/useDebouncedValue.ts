// WP-BILD-1f (bens P4): DEBOUNCE für die live-tippende Bibliotheks-Suche. Vorher feuerte JEDER
// Tastendruck sofort einen Server-Request; jetzt läuft erst nach einer kurzen Tipp-Pause einer.
// Veraltete Antworten können das Ergebnis trotzdem nie überschreiben: react-query schlüsselt die
// Suche über den Query-Key (Parameter inklusive q) — jede Antwort landet unter IHREM Key, die UI
// liest immer nur den AKTUELLEN Key (latest-wins per Konstruktion, dasselbe Prinzip wie der
// IC-Request-ID-Guard). Der Timer wird bei jeder Änderung sauber abgeräumt (kein Leck).
import { useEffect, useState } from "react";

export const LIBRARY_SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
