// ================================================================================================
// produkt:20261011:peter-p06 — OB FÜR DIESES KONTO IN DIESEM BROWSER EINE LERNSITZUNG OFFEN IST.
// ================================================================================================
//
// Ein Merker je Konto im BROWSERSPEICHER (`localStorage`), keine zweite Ablage: der Stand der
// Lernsitzung steht nur am Server (`/api/me/vormachen`). Der Merker gilt für JEDEN Tab dieses
// Browsers und übersteht das Schließen des Starttabs (Ben zu Nacharbeit 4: ein tablokaler Merker
// ließ andere Tabs ohne Anzeige). Ein anderer Tab erfährt eine Änderung über das `storage`-Ereignis.
//
// Was ein Browser OHNE Merker tut, regelt der Server: er schreibt nur mit, solange genau der
// beobachtete Client den Lernzustand sichtbar meldet (`meldeSichtbar`). Ohne Anzeige also keine
// Beobachtung — nirgends unsichtbar.
import { useSyncExternalStore } from "react";

const PRAEFIX = "kw-vormachen-aktiv:";

export interface VormachenStand {
  readonly aktiv: boolean;
  /** Zählt jede gemeldete Änderung — wer ihn beobachtet, liest den Server neu. */
  readonly fassung: number;
}

let zaehler = 0;
const hoerer = new Set<() => void>();
let horchtAufSpeicher = false;

function benachrichtige(): void {
  zaehler += 1;
  for (const h of hoerer) {
    h();
  }
}

function abonniere(h: () => void): () => void {
  if (!horchtAufSpeicher && typeof window !== "undefined") {
    horchtAufSpeicher = true;
    window.addEventListener("storage", (e) => {
      if (e.key === null || e.key.startsWith(PRAEFIX)) {
        benachrichtige();
      }
    });
  }
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

function liesAktiv(kontoId: string): boolean {
  try {
    return window.localStorage.getItem(`${PRAEFIX}${kontoId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Meldet eine Änderung; `aktiv` sagt, ob danach für das Konto noch eine Lernsitzung offen ist.
 * Ohne Kontokennung und mit `aktiv = false` werden alle Merker dieses Browsers verworfen.
 */
export function meldeVormachen(aktiv: boolean, kontoId?: string | null): void {
  try {
    if (kontoId) {
      if (aktiv) {
        window.localStorage.setItem(`${PRAEFIX}${kontoId}`, "1");
      } else {
        window.localStorage.removeItem(`${PRAEFIX}${kontoId}`);
      }
    } else if (!aktiv) {
      for (const schluessel of Object.keys(window.localStorage)) {
        if (schluessel.startsWith(PRAEFIX)) {
          window.localStorage.removeItem(schluessel);
        }
      }
    }
  } catch {
    // Ohne Browserspeicher gilt der Merker nur bis zum Neuladen dieser Seite.
  }
  benachrichtige();
}

export function useVormachenStand(kontoId: string | null | undefined): VormachenStand {
  const fassung = useSyncExternalStore(
    abonniere,
    () => zaehler,
    () => zaehler,
  );
  return { aktiv: kontoId ? liesAktiv(kontoId) : false, fassung };
}
