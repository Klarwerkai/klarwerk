import { api } from "./client";

export interface AussageBezug {
  id: string;
  fassung: number;
}
export interface VortragsNotiz {
  sldId: string;
  text: string;
  uebergang: string;
  sekunden: number;
  aussagen: AussageBezug[];
  detailSldIds: string[];
}
export interface NachbereitungsEintrag {
  sldId: string;
  aussage: AussageBezug;
  art: "rueckfrage" | "erklaerung" | "zusage" | "korrektur";
  text: string;
  quelle: string;
}
export interface VortragsAuftrag {
  basis: string;
  modus: "vorbereiten" | "probe" | "frage" | "nachbereitung";
  zielSekunden: number;
  notizen: VortragsNotiz[];
  nachbereitung: NachbereitungsEintrag[];
  probe?: { ausdruecklichGestartet: true; sldId: string; text: string };
  frage?: { text: string; aussage?: AussageBezug; sldId?: string };
}
export interface VortragsAufgabe {
  schluessel: string;
  titel: string;
  arbeit: string;
  sldId: string;
  aussage?: AussageBezug;
  herkunft: { art: "vorbereitung" | "probe" | "nachbereitung"; text: string; quelle: string };
}
export interface VortragsErgebnis {
  basis: string;
  modus: VortragsAuftrag["modus"];
  notizen: VortragsNotiz[];
  sprechhilfen: VortragsNotiz[];
  zeit: { geplant: number; ziel: number; abweichung: number };
  leitfragen: { sldId: string; aussage: AussageBezug; text: string }[];
  aufgaben: VortragsAufgabe[];
  probe: null | {
    woerter: number;
    schaetzungSekunden: { von: number; bis: number };
    langeSaetze: number;
    grundlage: string;
  };
  antwort: null | {
    stand: "beleg" | "auswahl_noetig" | "kein_beleg";
    kandidaten: AussageBezug[];
    sldIds: string[];
    grund: string;
  };
}
export const praesentationVortrag = {
  auswerten: (koId: string, anhangId: string, auftrag: VortragsAuftrag) =>
    api.post<VortragsErgebnis>(
      `/kos/${encodeURIComponent(koId)}/office/${encodeURIComponent(anhangId)}/vortrag`,
      auftrag,
    ),
};
