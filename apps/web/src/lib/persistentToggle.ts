// AUFTRAG-uxpol5 (Pedis Höhe/Priorisierung + Erklärbox): kleiner, DOM-freier localStorage-Helfer für
// persistente Auf-/Zu-Zustände (Filter-„Weitere Filter", Reife-Erklärbox) PRO BROWSER. Fehlertolerant:
// fehlender/kaputter/verweigerter Speicher → Fallback bzw. stilles No-op (nie ein Crash der Seite).
// Werte: "1" = offen, "0" = zu; ein FEHLENDER Schlüssel (null) ist bewusst vom Wert „zu" unterscheidbar
// (Erststart-Erkennung: die Erklärbox darf beim ersten Besuch offen sein und sich danach merken).
type StorageLike = Pick<Storage, "getItem" | "setItem">;

// AUFTRAG-uxpol6 (bens GELB 2.2): schon das ERMITTELN von localStorage kann werfen (Browser-/
// Origin-Policy, z. B. blockierte Speicher in Sandbox-/Third-Party-Kontexten). Auch diese Grenze ist
// fehlerfähig — und bleibt DOM-frei (globalThis statt window, kompiliert auch ohne DOM-Typen):
// wirft der Getter oder fehlt der Speicher (Node), gilt „kein Speicher“ (undefined) statt eines Crashs.
export function safeLocalStorage(): StorageLike | undefined {
  try {
    const holder = globalThis as unknown as { localStorage?: StorageLike };
    return holder.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

// Gespeicherten Bool lesen; null = Schlüssel nicht vorhanden / nicht lesbar (⇒ „noch nie gesehen").
export function readStoredBool(storage: StorageLike | undefined, key: string): boolean | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

// Bool schreiben (still, wenn kein/verweigerter Speicher — der Zustand lebt dann nur diese Sitzung).
export function writeStoredBool(
  storage: StorageLike | undefined,
  key: string,
  value: boolean,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, value ? "1" : "0");
  } catch {
    // Speicher voll/verweigert → bewusst ignorieren.
  }
}

// AUFTRAG-sortfilter: dieselbe fehlertolerante Speicher-Grenze für freie Zeichenketten-Zustände
// (Sortier-Wahl der Bibliothek, Entwurfs-Suche/-Sortierung). null = Schlüssel nicht vorhanden/nicht
// lesbar; das Lesen wirft nie (Browser-/Origin-Policy, kaputter Speicher) und das Schreiben ist still.
export function readStoredString(storage: StorageLike | undefined, key: string): string | null {
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredString(
  storage: StorageLike | undefined,
  key: string,
  value: string,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, value);
  } catch {
    // Speicher voll/verweigert → bewusst ignorieren.
  }
}
