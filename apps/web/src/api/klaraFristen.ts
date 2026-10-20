import { api } from "./client";

export const FRIST_ARTEN = [
  "ablauf",
  "kuendigungsfenster",
  "vertragsende",
  "automatische_verlaengerung",
  "erneuerung",
  "pruefung",
  "normankuendigung",
  "wartung",
  "anleitungspflege",
  "einarbeitung",
  "expertenuebergabe",
] as const;
export type FristArt = (typeof FRIST_ARTEN)[number];
export type FristQuellart = "wissensobjekt" | "notiz" | "gespraech" | "anhang";
export interface FristQuelle {
  art: FristQuellart;
  id: string;
}
export interface FristenRegel {
  aktiv: boolean;
  quellen: FristQuelle[];
  arten: FristArt[];
  bereich: "persoenlich";
  zeitzone: string;
  aenderung: "aktualisieren" | "klaeren";
  widerruf: "unzuverlaessig_ohne_vorlauf";
  wiederpruefung: "relevante_aenderung_klaeren";
  pruefstand: "aw19-sollbestand-1";
}
export type FristDatum =
  | { art: "datum"; datum: string }
  | { art: "zeitpunkt"; datum: string; uhrzeit: string; zeitzone: string; utc: string };
export interface ErkannteFrist {
  id: string;
  fassung: number;
  objekt: { art: string; kennung: string };
  art: FristArt;
  stand: "erkannt" | "klaerung" | "verworfen" | "nicht_verlaesslich" | "historisch" | "erledigt";
  datum: FristDatum | null;
  verantwortlich: string | null;
  klaerung: string[];
  manuell: boolean;
  herkunft: {
    aktuell: boolean;
    beleg: {
      quelle: FristQuelle & { fassung: string; belegId: string };
      abschnitt: { von: number; bis: number; wortlaut: string };
    };
  }[];
  verlauf: { am: string; grund: string; stand: string; datum: FristDatum | null }[];
}
export interface FristenStand {
  fassung: number;
  regel: FristenRegel | null;
  fristen: ErkannteFrist[];
}
const BASIS = "/me/klara/fristen";
export const klaraFristenApi = {
  lesen: () => api.get<FristenStand>(BASIS),
  vorschau: (regel: FristenRegel) => api.post<FristenStand>(`${BASIS}/vorschau`, { regel }),
  speichern: (regel: FristenRegel, fassung: number) =>
    api.put<FristenStand>(`${BASIS}/regel`, { regel, fassung }),
  aktualisieren: () => api.post<FristenStand>(`${BASIS}/aktualisieren`, {}),
  aendere: (
    f: ErkannteFrist,
    aktion: "verwerfen" | "korrigieren" | "erledigen",
    datum?: FristDatum,
  ) =>
    api.post<{ id: string; fassung: number; stand: string }>(
      `${BASIS}/${encodeURIComponent(f.id)}/aktion`,
      { fassung: f.fassung, aktion, ...(datum ? { datum } : {}) },
    ),
};
