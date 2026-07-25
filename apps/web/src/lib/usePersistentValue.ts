// AUFTRAG-sortfilter: React-Hooks um einen PRO BROWSER (localStorage) überlebenden Wert — dieselbe
// fehlertolerante `safeLocalStorage`-Grenze wie die Auf-/Zu-Zustände (persistentToggle). Zwei Träger:
//  · usePersistentString: freie Zeichenkette (z. B. die Entwurfs-Suche).
//  · usePersistentEnum: eine geschlossene Menge (z. B. die Sortier-Wahl) — ein gespeicherter Wert
//    außerhalb der erlaubten Menge (Alt-/Fremdformat) fällt sicher auf den Standard zurück.
// DOM-frei über safeLocalStorage (globalThis); fehlender/kaputter/verweigerter Speicher → Standard
// bzw. stilles No-op (nie ein Crash der Seite), Zustand lebt dann nur diese Sitzung.
import { useCallback, useState } from "react";
import { readStoredString, safeLocalStorage, writeStoredString } from "./persistentToggle";

export function usePersistentString(
  key: string,
  fallback: string,
  isValid?: (value: string) => boolean,
): [string, (next: string) => void] {
  const storage = safeLocalStorage();
  const [value, setValue] = useState<string>(() => {
    const raw = readStoredString(storage, key);
    if (raw === null) {
      return fallback;
    }
    return isValid && !isValid(raw) ? fallback : raw;
  });

  const set = useCallback(
    (next: string) => {
      setValue(next);
      writeStoredString(storage, key, next);
    },
    [key, storage],
  );

  return [value, set];
}

export function usePersistentEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [value, set] = usePersistentString(key, fallback, (v): boolean =>
    (allowed as readonly string[]).includes(v),
  );
  return [value as T, set as (next: T) => void];
}
