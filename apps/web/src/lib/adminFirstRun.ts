// SCRUM-429 (Pedi 03.07., VIP): Erststart-Führung für den neuen Admin. DOM-freie Logik +
// Persistenz-Muster wie startOrientation.ts (localStorage, injizierbar → testbar). KEIN Backend.

const KEY = "klarwerk.admin.firstRunSeen";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Erststart = der Merker fehlt noch. Nach bewusstem Ausblenden dauerhaft still.
export function isAdminFirstRun(storage: StorageLike): boolean {
  return storage.getItem(KEY) === null;
}

export function markAdminFirstRunSeen(storage: StorageLike, nowIso: string): void {
  storage.setItem(KEY, nowIso);
}

// Ehrlicher KI-Verbindungszustand für die Begrüßung — nie geraten, aus der echten Config.
export type KiConnectionState = "both" | "cloudOnly" | "localOnly" | "none";

export function kiConnectionState(
  cloudConfigured: boolean,
  localConfigured: boolean,
): KiConnectionState {
  if (cloudConfigured && localConfigured) {
    return "both";
  }
  if (cloudConfigured) {
    return "cloudOnly";
  }
  if (localConfigured) {
    return "localOnly";
  }
  return "none";
}

// i18n-Schlüssel je Zustand (eine Quelle für Komponente + Test).
export const KI_STATE_KEY: Record<KiConnectionState, string> = {
  both: "adm.firstrun.ki.both",
  cloudOnly: "adm.firstrun.ki.cloudOnly",
  localOnly: "adm.firstrun.ki.localOnly",
  none: "adm.firstrun.ki.none",
};

// Ehrliche Ampel: „both" ist gut (grün), Teilzustände sind Hinweise (warn), „none" kritisch.
export type KiStateTone = "ok" | "warn" | "crit";
export function kiStateTone(state: KiConnectionState): KiStateTone {
  if (state === "both") {
    return "ok";
  }
  if (state === "none") {
    return "crit";
  }
  return "warn";
}
