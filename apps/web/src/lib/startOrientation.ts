// Aufräum-Pass 02.07. (Pedi: „sieht noch etwas unordentlich aus"): Die Erklär-Blöcke der
// Startseite („So liest du Klarwerk" + Demo-/Pilotpfad) sind für Erstnutzer wertvoll, für
// Wiederkehrende eine Info-Wand. Erstbesuch: aufgeklappt; danach eingeklappt, jederzeit
// per Klick öffenbar. DOM-frei (Storage wird injiziert) → ohne Browser testbar.

const KEY = "klarwerk.start.orientationSeen";

export function isStartOrientationFirstRun(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(KEY) === null;
  } catch {
    return false;
  }
}

export function markStartOrientationSeen(storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(KEY, new Date().toISOString());
  } catch {
    // Storage nicht verfügbar (z. B. Privatmodus) → still: dann bleibt es beim Default.
  }
}

export const START_ORIENTATION_TEXT = {
  title: "start.orientation.title",
  hint: "start.orientation.hint",
} as const;
