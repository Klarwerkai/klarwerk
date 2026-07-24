// PAKET 1 (D-AISTATE, Pedi 23.07.): EIN zentraler, ehrlicher Ort für die Frage „ist für DIESE
// Aufgabe ein KI-Modell nutzbar?" — die Grundlage, um die echten LLM-Funktionen bei fehlendem
// Modell HART auszugrauen (statt sie still in den deterministischen Fallback laufen zu lassen und
// so „KI läuft" vorzutäuschen). Diese Datei ist die PURE, DOM-freie Kern-Ableitung (im Node-Gate
// testbar); der reaktive Hook `useAiAvailable` lebt getrennt in `useAiAvailable.tsx` (er zieht die
// React-Query-Hooks + Rollen-Kontext — eine .ts-lib darf kein .tsx importieren, Root-Build ohne jsx).
//
// AUSNAHME (NICHT hierüber ausgrauen): die Duplikat-/Konfliktprüfung. Ihre deterministische Ebene
// läuft IMMER (Kernfunktion, Pedi) — nur die echten LLM-Funktionen (Struktur, Assist, Bildbeschreibung,
// Gruppierung, Ask/Klara, Extraktion) werden hier gesteuert.
import type { ReasonerStatus } from "../api/types";

export interface AiAvailability {
  // true = für diese Aufgabe ist ein nutzbares Modell vorhanden (Cloud/Lokal), LLM-Aktion erlaubt.
  available: boolean;
  // Solange noch kein Status vorliegt: NICHT vorschnell ausgrauen (kein Flackern) — die Aktion
  // bleibt bedienbar, bis der echte Zustand da ist.
  isLoading: boolean;
}

// PAKET 3 (D-AISTATE, bens V4): ehrliche per-Aufgabe-Verfügbarkeit AUS dem öffentlichen Status.
// Die per-Task-Karte `tasks` drückt serverseitig (aistate-fix3) bereits die Nutzbarkeit nach der
// TATSÄCHLICH gewählten Providerkette der Aufgabe UND deren Kanten-Erreichbarkeit aus (Cloud
// unerreichbar + Task=cloud ⇒ false, auch wenn ein lokales Modell global erreichbar ist) — dieses
// Boolean ist hier die maßgebliche Bindung. Zusätzlich: (a) ein Modell muss aktiv sein, (b) global
// „zuletzt unerreichbar" graut weiter aus (`unverified` zählt als nutzbar — kein Fake-Grau beim
// Start). Fehlt die per-Task-Karte (alte Antwort), entscheidet der globale Status (aktiv UND nicht
// deterministisch). Kein Provider-/Modellname nötig (vip2-gate).
export function deriveAiAvailable(
  status: Pick<ReasonerStatus, "active" | "mode" | "reachable" | "tasks"> | undefined,
  task: string,
): boolean {
  if (!status) {
    return false;
  }
  // Erreichbarkeit: zuletzt NICHT erreichbar → ausgrauen (der Knopf liefe sonst ins Leere).
  if (status.reachable === "unreachable") {
    return false;
  }
  const taskUsable = status.tasks?.[task];
  if (taskUsable === false) {
    return false; // Aufgabe bewusst deterministisch gestellt
  }
  if (taskUsable === true) {
    return status.active === true;
  }
  // kein Eintrag für die Aufgabe (alte Antwort) → globaler Status entscheidet
  return status.active === true && status.mode !== "deterministic";
}

// PAKET 3.4 (D-AISTATE, bens V4): ist ECHT ein Modell nutzbar (aktiv UND nicht zuletzt unerreichbar)?
// Basis für den „(mit KI)"-Namen — NICHT bloß „konfiguriert" (active). `unverified` zählt als nutzbar
// (kein Fake-Grau beim Start). Ohne Status: nein.
export function aiModelUsable(
  status: Pick<ReasonerStatus, "active" | "reachable"> | undefined,
): boolean {
  return status?.active === true && status.reachable !== "unreachable";
}
