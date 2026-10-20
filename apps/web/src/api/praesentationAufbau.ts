import { api } from "./client";
export interface AufbauAuftrag {
  expectedVersion: number;
  titel: string;
  ziel: string;
  publikum: string;
  dauerMinuten: number;
  datenpunkte: { id: string; fassung: number }[];
  design: "vorlage" | "betont";
  diagramm: boolean;
}
export interface AufbauVorschau {
  planId: string;
  folien?: { sldId: string; titel?: string; rolle: string }[];
  auftrag: AufbauAuftrag;
  fakten: {
    id: string;
    label: string;
    wert: string;
    zeitraum: string;
    zustand: string;
    belege: string[];
  }[];
  diagramm: null | { minimum: number; maximum: number; einheit: string };
  hinweise: string[];
}
export interface AufbauErgebnis {
  fassung: number;
  status: string;
  bindungenOffen: string[];
  hinweis: string;
}
const pfad = (ko: string, anhang: string) =>
  `/kos/${encodeURIComponent(ko)}/office/${encodeURIComponent(anhang)}/folienaufbau`;
export const praesentationAufbau = {
  vorschau: (ko: string, anhang: string, auftrag: AufbauAuftrag) =>
    api.post<AufbauVorschau>(`${pfad(ko, anhang)}/vorschau`, auftrag),
  uebernehmen: (ko: string, anhang: string, vorschau: AufbauVorschau) =>
    api.post<AufbauErgebnis>(`${pfad(ko, anhang)}/uebernehmen`, {
      ...vorschau.auftrag,
      planId: vorschau.planId,
    }),
};
