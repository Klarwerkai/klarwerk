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

// JOB 3335 · UX-21 — DAS LESE-TABLET: das Band ZWISCHEN Telefon und Desktop.
// Die Schwelle darüber teilt in zwei: schmal (≤899, Schubfach) und breit. Die Bibliothek braucht
// darunter eine dritte Lage, weil ein 768er-Tablet weder Telefon ist (dort trägt EINE Fläche die
// Breite, `BibliothekFlaeche.tsx`, `SCHMAL_ABFRAGE` < 760 px) noch Desktop (dort stehen 380 px
// Liste und 720 px Bericht nebeneinander — bei 768 blieben dem Text 356 px, Befund N-0044).
//   · UNTEN 760 px: die Telefonschwelle der Bibliothek, exakt anschliessend — keine Breite fällt
//     zwischen die Bänder (759 ist Telefon, 760 ist Tablet). Handy 390 fällt NICHT hinein.
//   · OBEN 899 px: dieselbe Grenze wie `NARROW_QUERY`, damit Schubfach und Lesemodus gemeinsam
//     enden. Desktop 1280 fällt NICHT hinein; ab 900 gilt die Zweispaltigkeit von heute.
// Gelesen wird auch diese Abfrage NUR über `useMediaQuery` — kein zweiter `matchMedia`-Griff.
export const TABLET_LESE_QUERY = "(min-width: 760px) and (max-width: 899px)";
