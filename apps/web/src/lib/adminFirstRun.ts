// SCRUM-429 (Pedi 03.07., VIP): Erststart-Führung für den neuen Admin. DOM-freie Logik +
// Persistenz-Muster wie startOrientation.ts (localStorage, injizierbar → testbar). KEIN Backend.

const KEY = "klarwerk.admin.firstRunSeen";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Erststart = der Merker fehlt noch. Nach bewusstem Ausblenden dauerhaft still.
// Auftrag gesamt-ansicht-merken: der Merker ist nicht betriebsnotwendig. Fehlt der Speicher oder
// wirft er (gesperrter Browserspeicher), gilt „schon gesehen" — dieselbe stille Regel wie
// `startOrientation.ts`; die Karte bricht die Startseite dann nicht mehr ab.
export function isAdminFirstRun(storage: StorageLike | undefined): boolean {
  if (!storage) {
    return false;
  }
  try {
    return storage.getItem(KEY) === null;
  } catch {
    return false;
  }
}

export function markAdminFirstRunSeen(storage: StorageLike | undefined, nowIso: string): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(KEY, nowIso);
  } catch {
    // Speicher voll/verweigert → still: das Ausblenden gilt dann nur für diese Sitzung.
  }
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

// SCRUM-441 (Pedi 03.07.): die Erststart-Schritte mit echtem Fortschritt füllen — „erledigt"-Häkchen
// aus den vorhandenen Zählern, nie geraten. Erfasst = es gibt Wissen; geprüft = es ist validiert;
// Verwaltung = beide KIs verbunden (Ersteinrichtung steht).
export type FirstRunStepId = "capture" | "validate" | "admin";

export interface FirstRunProgress {
  total: number;
  validated: number;
  kiBoth: boolean;
}

export function firstRunStepDone(step: FirstRunStepId, p: FirstRunProgress): boolean {
  if (step === "capture") {
    return p.total > 0;
  }
  if (step === "validate") {
    return p.validated > 0;
  }
  return p.kiBoth;
}
