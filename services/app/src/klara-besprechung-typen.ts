import type { BesprechungsFortschritt } from "./klara-besprechung-fortschritt";

export interface BesprechungsSegment {
  id: string;
  text: string;
  startMs: number | null;
  endMs: number | null;
  sprecher: string | null;
  unsicher: boolean;
  ueberlappend: boolean;
}
export interface PrivateBesprechung {
  meetingId: string;
  transkriptFassung: number;
  meetingDatum: string | null;
  zeitzone: string | null;
  quelleNotizId: string | null;
  audioId: string | null;
  weg: "text" | "dateiimport" | "eigene_aufnahme";
  segmente: BesprechungsSegment[];
  asrEngine?: string;
  verarbeitung?: BesprechungsFortschritt;
}
