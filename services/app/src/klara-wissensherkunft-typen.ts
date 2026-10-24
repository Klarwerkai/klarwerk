import type { PrivateBesprechung } from "./klara-besprechung-typen";

/** Serverseitige Herkunft am privaten Original. Keine Übernahme eines fremden Chatverlaufs. */
export interface KlaraWissensHerkunft {
  besprechung?: PrivateBesprechung;
  projekt: string;
  abschnitt: string;
  antwortFassung: string;
  anbieter: string | null;
  modell: string | null;
  vorherigeNotiz: string | null;
  textAbdruck: string;
  aussagen: {
    text: string;
    art: "behauptung" | "empfehlung" | "kreativ" | "nutzerentscheidung";
    quellen: { id: string; fassung: number }[];
  }[];
}
