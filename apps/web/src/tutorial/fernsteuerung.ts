// ================================================================================================
// KLARA-VORSCHAU · DIE FERNSTEUERUNG DES SEITENTUTORIALS — was Klara vom laufenden Tutorial sieht.
// ================================================================================================
//
// Klara begleitet das vorhandene Tutorial „Fragen“, sie baut kein zweites. Dafür braucht sie zwei
// Dinge vom Rahmen: die LAGE (welcher Schritt, welcher Teil, auf welches Bedienelement gezeigt wird,
// ob die Vorführung läuft) und die BEFEHLE, die es im Bereich ohnehin gibt (Pause, Fortsetzen,
// Zurück, Weiter). Beides meldet `TutorialBereich` über diesen Kontext; es gibt keine zweite Uhr und
// keinen zweiten Schrittzähler.
//
// Eigene Datei, weil `TutorialRahmen` den Bereich importiert und der Bereich diesen Kontext — ein
// Kontext in `TutorialRahmen` wäre ein Importkreis (dependency-cruiser `no-circular`).
import { createContext } from "react";

export interface TutorialFernLage {
  definitionId: string;
  schrittIndex: number;
  schrittAnzahl: number;
  schrittId: string;
  schrittTitel: string;
  schrittText: string;
  /** Der Satz „Gerade gezeigt: …“ des aktuellen Teils, mit eingesetzten Beschriftungen. */
  teilText: string | null;
  /** Das Bedienelement des aktuellen Teils (`data-tutorial-ziel`), `null` = die Fläche als Ganzes. */
  zielName: string | null;
  /** Gesetzt, wenn die Demo das Ziel nicht findet. */
  zielFehlt: string | null;
  spielt: boolean;
  interaktiv: boolean;
  pause: () => void;
  fortsetzen: () => void;
  zurueck: () => void;
  weiter: () => void;
}

/** Meldeweg vom Bereich an den Rahmen. `null` = kein Bereich offen. */
export const TutorialMeldungCtx = createContext<((lage: TutorialFernLage | null) => void) | null>(
  null,
);
