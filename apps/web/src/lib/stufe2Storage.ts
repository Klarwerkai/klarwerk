// WP-SHIP9-S2 Paket 4 (W1): Persistenz des Stufe-2-Umschalters. Es gibt (geprüft) keinen serverseitigen
// Nutzer-Einstellungs-Vertrag dafür — daher localStorage mit sauberem SSR-/Fehler-Guard (Muster
// useOfflineQueue). Der Wert wird im useState-Initializer der RoleProvider gelesen, also VOR der ersten
// Routen-Entscheidung — so blitzt die Stufe-2-Gate-Karte (U9) nach Reload/Direktaufruf nicht mehr auf.
// WICHTIG: Persistenz schaltet NUR die UI-Stufe; das harte Rollen-Gate (effectiveStufe2 → nur Admin)
// bleibt unberührt.
const STORAGE_KEY = "kw.stufe2.v1";

function storage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    // Privater Modus / blockierter Storage — fail-safe zu AUS.
    return null;
  }
}

export function readStufe2(): boolean {
  try {
    return storage()?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStufe2(on: boolean): void {
  try {
    storage()?.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Schreiben fehlgeschlagen (Quota/privat) — der Laufzeit-State gilt trotzdem.
  }
}
