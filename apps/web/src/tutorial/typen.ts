// ================================================================================================
// FE-003 · DIE TYPEN DES TUTORIAL-RAHMENS — eigene Datei, damit Register und Lektionen einander
// nicht im Kreis importieren (dependency-cruiser `no-circular` zählt auch Typimporte).
// ================================================================================================
import type { ComponentType, ReactNode } from "react";

/** Ein Teil der Vorführung eines Schritts: WAS gezeigt wird und WORAUF gezeigt wird. */
export interface TutorialTeil {
  id: string;
  /** i18n-Schlüssel des Satzes „Gerade gezeigt: …“. */
  textKey: string;
  /**
   * Das erklärte Bedienelement als stabiler Zielname (`data-tutorial-ziel`), nie als Koordinate.
   * `null` = dieser Teil erklärt die Fläche als Ganzes und hebt nichts hervor.
   */
  ziel: string | null;
  /** Wie lange die Vorführung bei diesem Teil verweilt (ms), bevor sie zum nächsten Teil geht. */
  dauerMs: number;
}

export interface TutorialSchritt {
  id: string;
  titelKey: string;
  /** Kurzname für die Kapitelwahl. */
  kurzKey: string;
  /** Die Erklärung — vollständig, auch ohne Vorführung und ohne Vorlesen nutzbar. */
  textKey: string;
  /** Aufklappbare Vertiefung. */
  vertiefungKey: string;
  teile: readonly TutorialTeil[];
  /**
   * Übungsschritt: die Vorführung läuft NICHT von selbst an — der Nutzer handelt, die Demo meldet
   * über `zuTeil`, wie weit er ist.
   */
  interaktiv?: boolean;
}

/** Was die Demo einer Seite vom Rahmen bekommt. */
export interface TutorialDemoProps {
  schrittId: string;
  teilIndex: number;
  /** Verstrichene Zeit im aktuellen Teil (ms) — steht still, solange pausiert ist. */
  teilZeit: number;
  /** Zählt bei „Schritt wiederholen“ hoch, damit die Demo ihren Zustand neu aufsetzt. */
  lauf: number;
  /** `prefers-reduced-motion: reduce` — dann ohne Tippanimation, Endzustand sofort. */
  reduziert: boolean;
  /** Die Demo darf zu einem Teil springen, z. B. wenn der Nutzer in der Demo selbst absendet. */
  zuTeil: (index: number) => void;
  /** Die Demo darf die Vorführung anhalten, wenn der Nutzer sie selbst unterbricht. */
  anhalten: () => void;
  /**
   * Zählt hoch, sobald der Nutzer selbst einen Teil wählt — auch denselben noch einmal. Die Demo
   * schliesst dann eine modale Fläche, hinter deren Grenze das gewählte Ziel läge.
   */
  teilWahl: number;
  /**
   * Die Tutorial-Steuerung zum Mitnehmen: Erklärung, Vorführen/Pause und die Teile des Schritts.
   * Öffnet die Demo eine MODALE Fläche der echten Seite (das Blatt „Mehr“), sperrt deren
   * Modalgrenze den Rahmen samt Pause-Knopf. Die Demo stellt diese Begleitung deshalb IN die
   * modale Fläche — die Grenze der echten Seite bleibt unangetastet, die Steuerung bedienbar.
   */
  begleitung: ReactNode;
}

/** Die Übergabe an die echte Seite am Ende des Tutorials. */
export interface TutorialUebergangProps {
  /** Schliesst das Tutorial und setzt den Fokus auf das echte Ziel — ohne etwas auszulösen. */
  zurEchtenSeite: () => void;
  /** `false`, wenn das echte Ziel auf der Seite nicht zu finden war. */
  zielGefunden: boolean;
}

export interface TutorialModul {
  Demo: ComponentType<TutorialDemoProps>;
  Uebergang: ComponentType<TutorialUebergangProps>;
}

export interface TutorialDefinition {
  id: string;
  /** Genau die Route, auf der das Tutorial angeboten wird. */
  pfad: string;
  titelKey: string;
  lernzielKey: string;
  schritte: readonly TutorialSchritt[];
  /**
   * Werte für Platzhalter in den Texten (`{{mehr}}` …) — die Beschriftungen der ECHTEN Seite, aus
   * ihren eigenen Schlüsseln gelesen. So nennt die Erklärung einen Knopf immer so, wie er heisst.
   */
  textWerte: (t: (schluessel: string) => string) => Record<string, string>;
  /** Das echte Bedienelement, zu dem „Eigene Frage stellen“ o. ä. führt. */
  uebergabeZiel: string;
  /** Die Demo wird erst beim Öffnen geladen — die Hülle trägt sie nicht auf jeder Seite mit. */
  laden: () => Promise<TutorialModul>;
}
