import { api } from "./client";

export interface GedaechtnisEintrag {
  aufbewahrungAusnahme?: { bis: string; begruendung: string; verantwortlich: string } | null;
  regulaerVerfallAm?: string;
  id: string;
  fassung: number;
  art: "vorliebe" | "frage_antwort";
  inhalt: string;
  antwort: string | null;
  darstellung: "kurz" | "ausfuehrlich" | null;
  herkunft: {
    art: "eigene_eingabe" | "antwort";
    antwortId: string | null;
    antwortAm: string | null;
  };
  vertraulichkeit: string;
  aufbewahrungTage: number;
  angelegtAm: string;
  geaendertAm: string;
  verfallAm: string;
}
export interface GedaechtnisAntwort {
  eintraege: GedaechtnisEintrag[];
  fristenTage: number[];
  restoreJournalKonfiguriert: boolean;
  restkopien: string;
}
export const gedaechtnisApi = {
  lesen: () => api.get<GedaechtnisAntwort>("/me/gedaechtnis"),
  merken: (eingabe: {
    art: "vorliebe";
    inhalt: string;
    darstellung?: "kurz" | "ausfuehrlich";
    aufbewahrungTage: number;
  }) => api.post<{ eintrag: GedaechtnisEintrag }>("/me/gedaechtnis", eingabe),
  aendern: (
    e: GedaechtnisEintrag,
    inhalt: string,
    aufbewahrungTage: number,
    darstellung: GedaechtnisEintrag["darstellung"],
    aufbewahrungAusnahme?: { bis: string; begruendung: string } | null,
  ) =>
    api.put<{ eintrag: GedaechtnisEintrag }>(`/me/gedaechtnis/${encodeURIComponent(e.id)}`, {
      fassung: e.fassung,
      inhalt,
      aufbewahrungTage,
      darstellung,
      ...(aufbewahrungAusnahme !== undefined ? { aufbewahrungAusnahme } : {}),
    }),
  loeschen: (id: string) => api.del(`/me/gedaechtnis/${encodeURIComponent(id)}`),
  allesLoeschen: () => api.del("/me/gedaechtnis"),
};
