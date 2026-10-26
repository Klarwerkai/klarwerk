import { entferneOfflineKonto, offlineExklusiv } from "./offlineQueueStorage";

export const SITZUNGSENDE_KEY = "kw.sitzungsende.v1";
export const SITZUNGSENDE_EVENT = "kw-sitzungsende";
const PRAEFIX = "kw.konto-abgemeldet.v1:";
const freigegeben = new Map<string, string>();
let gesperrt = false;
let fluechtigeEpoche = "";
const beendeteKonten = new Set<string>();
export const lokaleEreignisse = globalThis as unknown as {
  addEventListener?: EventTarget["addEventListener"];
  removeEventListener?: EventTarget["removeEventListener"];
  dispatchEvent?: EventTarget["dispatchEvent"];
};

export function lokaleSitzungEpoche(): string | null {
  try {
    return fluechtigeEpoche + (localStorage.getItem(SITZUNGSENDE_KEY) ?? "");
  } catch {
    return fluechtigeEpoche;
  }
}
export function geschuetzteAnfragenGesperrt(): boolean {
  return gesperrt;
}
export function lokalesKontoErlaubt(konto: string): boolean {
  if (beendeteKonten.has(konto)) return false;
  try {
    if (typeof localStorage === "undefined") return true;
    const ende = localStorage.getItem(PRAEFIX + konto);
    return ende === null || freigegeben.get(konto) === ende;
  } catch {
    return false;
  }
}
export function bestaetigeLokalesKonto(konto: string, bestaetigtAm: number): void {
  try {
    const ende = localStorage.getItem(PRAEFIX + konto);
    if (ende) {
      const zeitpunkt = Number(ende.split(":")[0]);
      if (bestaetigtAm <= zeitpunkt) return;
      freigegeben.set(konto, ende);
    }
    beendeteKonten.delete(konto);
    gesperrt = false;
  } catch {
    gesperrt = true;
  }
}
export function sperreLokaleSitzung(): void {
  gesperrt = true;
}
export async function beendeLokaleSitzung(konto: string): Promise<void> {
  gesperrt = true;
  beendeteKonten.add(konto);
  const nonce = `${Date.now()}:${crypto.randomUUID()}`;
  fluechtigeEpoche = nonce;
  // Auch ein volles Kontingent darf die Sperre, den Abbruch und die Löschung nicht verhindern.
  const markieren = () => {
    localStorage.setItem(PRAEFIX + konto, nonce);
    localStorage.setItem(SITZUNGSENDE_KEY, nonce);
  };
  try {
    markieren();
  } catch {
    /* Nach dem Freigeben eigener Daten erneut versuchen. */
  }
  lokaleEreignisse.dispatchEvent?.(new CustomEvent(SITZUNGSENDE_EVENT, { detail: konto }));
  if (typeof navigator !== "undefined" && typeof navigator.locks !== "undefined") {
    await offlineExklusiv(() => entferneOfflineKonto(konto));
  } else {
    entferneOfflineKonto(konto);
  }
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(`kw.fragen.arbeitsstand.v1:${konto}`);
  }
  markieren();
  lokaleEreignisse.dispatchEvent?.(new CustomEvent(SITZUNGSENDE_EVENT, { detail: konto }));
}
