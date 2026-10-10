// ================================================================================================
// ASSISTENZ IM PRODUKT · DIE ANGEFANGENE EINGABE — übersteht Schliessen, Verkleinern, Breitenwechsel
// und Neuladen.
// ================================================================================================
//
// Die Hülle montiert die Assistenz beim Wechsel über 900 px neu (`shell/AppShell.tsx`), und ein
// Neuladen beginnt ohnehin von vorn. Eine halb getippte Frage lag bisher in einem `useState` der
// Figur und ging dabei verloren. Sie liegt jetzt in der Browser-Sitzung — gebunden an das Konto, unter
// dem sie getippt wurde: Abmelden oder ein anderes Konto findet sie nicht vor. An den Server geht
// davon nichts; gesendet wird erst mit „Senden“.
import { useSyncExternalStore } from "react";

const SITZUNG = "klarwerk.assistenz.eingabe";

interface Gespeichert {
  kontoId: string | null;
  text: string;
}

function laden(): Gespeichert {
  try {
    const roh = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(SITZUNG);
    if (!roh) {
      return { kontoId: null, text: "" };
    }
    const g = JSON.parse(roh) as Partial<Gespeichert>;
    return {
      kontoId: typeof g.kontoId === "string" ? g.kontoId : null,
      text: typeof g.text === "string" ? g.text : "",
    };
  } catch {
    return { kontoId: null, text: "" };
  }
}

let stand: Gespeichert = laden();
const hoerer = new Set<() => void>();

function sichern(): void {
  try {
    if (stand.text) {
      sessionStorage.setItem(SITZUNG, JSON.stringify(stand));
    } else {
      sessionStorage.removeItem(SITZUNG);
    }
  } catch {
    // ohne Sitzungsspeicher gilt die Eingabe nur bis zum Neuladen
  }
  for (const h of hoerer) {
    h();
  }
}

/** Setzt die angefangene Eingabe des angegebenen Kontos. */
export function setzeEingabe(kontoId: string | null, text: string): void {
  if (stand.kontoId === kontoId && stand.text === text) {
    return;
  }
  stand = { kontoId, text };
  sichern();
}

/** Ein anderes Konto (oder Abmelden) verwirft die angefangene Eingabe. */
export function eingabeAnKontoBinden(kontoId: string | null): void {
  if (stand.kontoId === kontoId) {
    return;
  }
  // Noch keinem Konto zugeordnet (getippt, während die Sitzung noch geladen wurde): nur zuordnen.
  stand = { kontoId, text: stand.kontoId === null && kontoId !== null ? stand.text : "" };
  sichern();
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

export const leseEingabe = (): string => stand.text;

export function useEingabe(): string {
  return useSyncExternalStore(abonnieren, leseEingabe, leseEingabe);
}

/** Für Tests und „Vorschau beenden“ (`zuruecksetzenGanz`): alles auf Anfang. */
export function eingabeZuruecksetzen(): void {
  stand = { kontoId: null, text: "" };
  sichern();
}
