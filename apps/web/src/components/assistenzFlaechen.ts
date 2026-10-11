// ================================================================================================
// ASSISTENZ IM PRODUKT (produkt:20261010:assistenz-produkteinstieg) — NIE ZWEI OFFENE FLÄCHEN.
// ================================================================================================
//
// Im normalen Produkt stehen zwei Einstiege nebeneinander: die persönliche Assistenz (die bewegliche
// Figur, `klara-vorschau/KlaraVorschau.tsx`) und die ältere Seitenhilfe (`KlaraAssistant.tsx`, der
// ?-Knopf). Beide bleiben erreichbar, aber offen ist immer nur EINE: Wer die eine öffnet, schliesst
// die andere. Solange die Seitenhilfe offen ist, tritt die Figur zurück — ihre Fläche liegt unten
// rechts genau dort, wo die Figur steht, und die Figur verdeckte sonst deren Inhalt. Die Meldung
// läuft über ein Fensterereignis, damit keine der beiden Flächen ihren Zustand an die andere abgeben
// muss.
import { useEffect, useRef, useState } from "react";

export type AssistenzFlaeche = "assistenz" | "hilfe";

interface Meldung {
  flaeche: AssistenzFlaeche;
  offen: boolean;
}

const EREIGNIS = "klarwerk:assistenzflaeche";

/** Meldet, ob diese Fläche jetzt offen ist. */
export function meldeFlaeche(flaeche: AssistenzFlaeche, offen: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<Meldung>(EREIGNIS, { detail: { flaeche, offen } }));
}

function useMeldungen(hoeren: (m: Meldung) => void): void {
  const hoerenRef = useRef(hoeren);
  hoerenRef.current = hoeren;
  useEffect(() => {
    const beiMeldung = (e: Event): void => hoerenRef.current((e as CustomEvent<Meldung>).detail);
    window.addEventListener(EREIGNIS, beiMeldung);
    return () => window.removeEventListener(EREIGNIS, beiMeldung);
  }, []);
}

/** Ruft `schliessen` auf, sobald die ANDERE Fläche sich als offen meldet. */
export function useAndereFlaecheSchliesst(eigene: AssistenzFlaeche, schliessen: () => void): void {
  useMeldungen((m) => {
    if (m.flaeche !== eigene && m.offen) {
      schliessen();
    }
  });
}

/** Ist die ANDERE Fläche gerade offen? */
export function useAndereFlaecheOffen(eigene: AssistenzFlaeche): boolean {
  const [offen, setOffen] = useState(false);
  useMeldungen((m) => {
    if (m.flaeche !== eigene) {
      setOffen(m.offen);
    }
  });
  return offen;
}
