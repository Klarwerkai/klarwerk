import { api } from "./client";
export interface WissensZiel {
  art: "artikel" | "space";
  spaceId?: string;
  confidentiality: "intern" | "vertraulich" | "streng_vertraulich";
  type: "technik";
  category: string;
  conditions: string[];
  vorlage?: { id: string; version: number };
}
export interface WissensVorschau {
  notizId: string;
  fassung: number;
  original: string;
  offeneFragen: string[];
  stempel: string;
  verantwortlich: string;
  kontoregel: string;
  space: { id: string; name: string; zugang: string } | null;
}
export interface WissensErgebnis {
  beitrag: {
    id: string;
    version: number;
    status: string;
    spaceId: string | null;
    verantwortlich: string;
    ruecklink: string;
  };
  wiederholt: boolean;
}
const pfad = (id: string) => `/me/klara/notizen/${encodeURIComponent(id)}/wissen`;
export const klaraWissenApi = {
  ziele: () =>
    api.get<{ spaces: { id: string; name: string; zugang: string }[] }>("/me/klara/wissen/ziele"),
  vorschau: (id: string, fassung: number, ziel: WissensZiel) =>
    api.post<WissensVorschau>(`${pfad(id)}/vorschau`, { fassung, ziel }),
  pruefen: (id: string) =>
    api.post<{
      fassung: number;
      ergebnis: { status: string; grund?: string; aussagen: { zustand: string }[] };
      herkunftUnveraendert: boolean;
    }>(`${pfad(id)}/pruefen`, {}),
  uebernehmen: (v: WissensVorschau, ziel: WissensZiel) =>
    api.post<WissensErgebnis>(`${pfad(v.notizId)}/uebernehmen`, {
      fassung: v.fassung,
      ziel,
      stempel: v.stempel,
      bewusst: true,
    }),
  importiere: (x: unknown) => api.post<{ notiz: { id: string } }>("/me/klara/wissen/import", x),
};
