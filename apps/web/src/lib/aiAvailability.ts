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
import type { ReasonerStatus, ReasonerTask } from "../api/types";

// JOB 3220: Ein Statusfehler ohne Daten wird durch einen erfolgreichen Refetch aufgelöst.
// `statusUnknown` erklärt nur die bestehende Sperre; der Zustand lockert sie NICHT.
export interface AiAvailability {
  // true = für diese Aufgabe ist ein nutzbares Modell vorhanden (Cloud/Lokal), LLM-Aktion erlaubt.
  available: boolean;
  // Solange noch kein Status vorliegt: NICHT vorschnell ausgrauen (kein Flackern) — die Aktion
  // bleibt bedienbar, bis der echte Zustand da ist.
  isLoading: boolean;
  statusUnknown: boolean;
}

// PAKET 3 (D-AISTATE, bens V4): ehrliche per-Aufgabe-Verfügbarkeit AUS dem öffentlichen Status.
// Die per-Task-Karte `tasks` drückt serverseitig (aistate-fix3) bereits die Nutzbarkeit nach der
// TATSÄCHLICH gewählten Providerkette der Aufgabe UND deren Kanten-Erreichbarkeit aus (Cloud
// unerreichbar + Task=cloud ⇒ false, auch wenn ein lokales Modell global erreichbar ist) — dieses
// Boolean ist hier die maßgebliche Bindung. Zusätzlich: (a) ein Modell muss aktiv sein, (b) global
// „zuletzt unerreichbar" graut weiter aus (`unverified` zählt als nutzbar — kein Fake-Grau beim
// Start). Fehlt die per-Task-Karte (alte Antwort), entscheidet der globale Status (aktiv UND nicht
// deterministisch). Kein Provider-/Modellname nötig (vip2-gate).
// JOB 615 D7: `task` ist der geschlossene Aufgabentyp, nicht mehr ein freier String. Ein
// verschriebener Name erreicht diese Funktion damit gar nicht erst — vorher wurde er zu einem
// `undefined`-Kartenwert und graute still einen Knopf aus (BEN-PRUEFUNG-JOB-615-D6.md §4).
export function deriveAiAvailable(
  status: Pick<ReasonerStatus, "active" | "mode" | "reachable" | "tasks"> | undefined,
  task: ReasonerTask,
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

// ================================================================================================
// AUFTRAG-mega67 BLOCK G (Pedi 30.07.) — KOSTET DIESER KLICK WIRKLICH ETWAS?
// ================================================================================================
//
// Die PURE Ableitung hinter dem Kostenhinweis. Sie ist bewusst STRENG: sie sagt nur dann „ja", wenn
// der Server für GENAU DIESE Aufgabe ausdrücklich `billable: true` meldet.
//
// WARUM KEIN RÜCKFALL AUF `mode === "cloud"`, wenn die Karte fehlt: `mode` ist die HAUSWEITE Stufe
// und sagt nichts über die Kette DIESER Aufgabe (eine cloud-verdrahtete Installation kann
// `structure` lokal stellen). Ein Rückfall darauf wäre wieder eine Behauptung ohne Deckung —
// genau die, die dieser Block beseitigt. Fehlt die Auskunft, SCHWEIGT der Satz. Schweigen ist
// keine falsche Aussage; „kostenpflichtig" wäre eine.
//
// MEHRERE AUFGABEN: manche Flächen tragen EINEN Hinweis für zwei Auslöser in derselben Umrandung
// (CaptureFrontDoor: „Vorschlag strukturieren" + „KI-Hilfe anwenden"). Kostet EINER von beiden,
// muss der Satz stehen — sonst klickt jemand den teuren, ohne gewarnt zu sein.
// JOB 615 D7: dieselbe Verengung wie oben — auch in der Mehrfachform, die AiCostHint benutzt.
export function deriveAiBillable(
  status: Pick<ReasonerStatus, "billable"> | undefined,
  task: ReasonerTask | readonly ReasonerTask[],
): boolean {
  if (!status?.billable) {
    return false;
  }
  const tasks = typeof task === "string" ? [task] : task;
  return tasks.some((t) => status.billable?.[t] === true);
}

// PAKET 3.4 (D-AISTATE, bens V4): ist ECHT ein Modell nutzbar (aktiv UND nicht zuletzt unerreichbar)?
// Basis für den „(mit KI)"-Namen — NICHT bloß „konfiguriert" (active). `unverified` zählt als nutzbar
// (kein Fake-Grau beim Start). Ohne Status: nein.
export function aiModelUsable(
  status: Pick<ReasonerStatus, "active" | "reachable"> | undefined,
): boolean {
  return status?.active === true && status.reachable !== "unreachable";
}

// ================================================================================================
// R-1040 — EIN SATZ FÜR DEN GESPERRTEN KI-KNOPF, ÜBERALL DIESELBE REGEL.
// ================================================================================================
//
// Ein gesperrter KI-Knopf hat drei mögliche Gründe, und sie lesen sich verschieden:
//   · Der Administrator hat die KI ABGESCHALTET (`kiAbgeschaltet`, D5) — eine Entscheidung.
//   · Der Status ist UNBEKANNT (Abfrage gescheitert, keine Daten, JOB 3220) — eine Störung der Auskunft.
//   · Für die Aufgabe ist KEIN MODELL nutzbar — eine Störung oder fehlende Einrichtung.
// `/fragen` (`Ask.tsx`) und das Fragen-Tutorial (`FragenDemo.tsx`) unterschieden das schon; das
// Klara-Panel sagte in allen drei Lagen „kein Modell aktiv" — auch dann, wenn der Administrator die
// KI bewusst abgeschaltet hatte. Diese Funktion ist die EINE Regel dafür.
//
// WARUM DIE ABSCHALTUNG NUR FÜR `answer` GILT: der Server meldet `kiAbgeschaltet` aus der
// gespeicherten Adminwahl für genau diese Aufgabe (`services/reasoner/src/service.ts`,
// `kiAbschaltung()`), und nur der Antwortweg sperrt am Chokepoint (`kiSperre = task === "answer"`).
// Für eine andere Aufgabe hiesse „abgeschaltet" etwas, was der Server nicht gesagt hat.
export type AiSperrHinweisKey = "d5kiaus.hinweis" | "ai.statusUnknown.hint" | "ai.unavailable.hint";

export function aiSperrHinweisKey(
  status: Pick<ReasonerStatus, "kiAbgeschaltet"> | undefined,
  task: ReasonerTask,
  statusUnknown: boolean,
): AiSperrHinweisKey {
  if (task === "answer" && status?.kiAbgeschaltet === true) {
    return "d5kiaus.hinweis";
  }
  return statusUnknown ? "ai.statusUnknown.hint" : "ai.unavailable.hint";
}
