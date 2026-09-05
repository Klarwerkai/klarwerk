import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

// ================================================================================================
// JOB 3060 · H1 — DIE SEITENHILFE: ERKLÄRTEXT AUS DEM SICHTFELD, NICHT AUS DEM PRODUKT.
// ================================================================================================
//
// Pedi (04.09. 06:50): „Text über Text über Text. Die Anwendung selbst macht ungefähr 10 % des
// Ganzen aus." Die 14 Seiten mit `HelpTip` (Erfassen allein 33 Tipps) behalten ihre Texte — aber
// nicht im Bild. Jeder `HelpTip` MELDET sich hier an (Titel + Text) und rendert selbst nichts; das
// Zahnrad-Menü zeigt unter „Seitenhilfe" alle Tipps der aktuellen Seite. Die Texte bleiben damit
// erreichbar (ein Klick), die Seiten selbst werden nicht angefasst (JOB 3061-3065 laufen parallel).
//
// OHNE ANBIETER GESCHIEHT NICHTS: Seiten werden in vielen Tests ohne die Hülle montiert. Ein
// `HelpTip` außerhalb des Anbieters meldet sich bei einem stummen Sammler — kein Fehler, kein
// Text, keine zweite Fläche.
export interface Seitenhilfe {
  id: string;
  title: string;
  body: string;
}

interface SeitenhilfeSammler {
  anmelden(eintrag: Seitenhilfe): void;
  abmelden(id: string): void;
  eintraege: readonly Seitenhilfe[];
}

const STUMM: SeitenhilfeSammler = { anmelden: () => {}, abmelden: () => {}, eintraege: [] };

const SeitenhilfeCtx = createContext<SeitenhilfeSammler>(STUMM);

export function SeitenhilfeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [eintraege, setEintraege] = useState<readonly Seitenhilfe[]>([]);
  const anmelden = useCallback((eintrag: Seitenhilfe): void => {
    setEintraege((alt) => {
      const ohne = alt.filter((e) => e.id !== eintrag.id);
      // Ein Tipp, dessen Text sich nicht geändert hat, löst kein Neuzeichnen aus.
      const vorher = alt.find((e) => e.id === eintrag.id);
      if (vorher && vorher.title === eintrag.title && vorher.body === eintrag.body) {
        return alt;
      }
      return [...ohne, eintrag];
    });
  }, []);
  const abmelden = useCallback((id: string): void => {
    setEintraege((alt) => (alt.some((e) => e.id === id) ? alt.filter((e) => e.id !== id) : alt));
  }, []);
  const value = useMemo<SeitenhilfeSammler>(
    () => ({ anmelden, abmelden, eintraege }),
    [anmelden, abmelden, eintraege],
  );
  return <SeitenhilfeCtx.Provider value={value}>{children}</SeitenhilfeCtx.Provider>;
}

/** Meldet einen Erklärtext für die Dauer der Montage beim Sammler an. Rendert nichts. */
export function useSeitenhilfeAnmeldung(title: string, body: string): void {
  const { anmelden, abmelden } = useContext(SeitenhilfeCtx);
  const id = useId();
  useEffect(() => {
    anmelden({ id, title, body });
    return () => abmelden(id);
  }, [anmelden, abmelden, id, title, body]);
}

/** Die Tipps der aktuellen Seite, in Reihenfolge ihrer Anmeldung. */
export function useSeitenhilfe(): readonly Seitenhilfe[] {
  return useContext(SeitenhilfeCtx).eintraege;
}
