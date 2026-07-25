// E2E-017 (Mobile/iPad): JS-gesteuerte Breakpoint-Erkennung, damit die Shell unter einer klaren
// Breite die Sidebar aus dem Fluss nimmt (Drawer statt fester 252px-Spalte). Bewusst über
// window.matchMedia (nicht nur CSS): so ist der Zustand real testbar (jsdom kann kein Layout messen,
// aber matchMedia lässt sich deterministisch stubben). Fehlt matchMedia (SSR/alte Umgebung), gilt
// „nicht schmal" (Desktop-Verhalten unverändert).
import { useEffect, useState } from "react";

type MatchMedia = (query: string) => MediaQueryList;

function readMatchMedia(): MatchMedia | undefined {
  return (globalThis as unknown as { matchMedia?: MatchMedia }).matchMedia;
}

export function useMediaQuery(query: string): boolean {
  const evaluate = (): boolean => {
    const mm = readMatchMedia();
    return mm ? mm(query).matches : false;
  };
  const [matches, setMatches] = useState<boolean>(evaluate);
  useEffect(() => {
    const mm = readMatchMedia();
    if (!mm) {
      return;
    }
    const mql = mm(query);
    const onChange = (): void => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

// Zentrale Schwelle: ≤899px (iPad-Hochkant 768 und Handy 390 fallen darunter, Desktop 1280 nicht).
export const NARROW_QUERY = "(max-width: 899px)";
