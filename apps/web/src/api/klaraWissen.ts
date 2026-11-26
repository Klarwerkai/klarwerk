import { api } from "./client";
import type { AussagenBelegKurz, KnowledgeType, ReferenzPruefung } from "./types";
type Modellstufe = NonNullable<ReferenzPruefung["rollen"]["antwort"]>;
export interface NotizModell {
  stufe: Modellstufe;
  anbieter?: string;
  modell?: string | null;
}
export interface NotizQuellenpruefung {
  geprueftAm: string;
  vorheriger: string | null;
  naechster: string | null;
  fassung: number;
  modellherkunft: NotizModell | null;
  beleg: AussagenBelegKurz & { antwortFingerabdruck: string };
  ergebnis: Omit<ReferenzPruefung, "rollen"> & {
    rollen: {
      antwort: NotizModell | Modellstufe | null;
      pruefer: NotizModell | Modellstufe | null;
    };
  };
  quelltitel?: Record<string, string>;
}
export interface WissensZiel {
  art: "artikel" | "space";
  spaceId?: string;
  confidentiality: "intern" | "vertraulich" | "streng_vertraulich";
  type: KnowledgeType;
  category: string;
  conditions: string[];
  vorlage?: { id: string; version: number };
}
export interface WissensVorschau {
  input?: { title: string; type?: KnowledgeType };
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
export type WissensBeitragsstand =
  | { notizFassung: number; stand: "nicht_verfuegbar" }
  | {
      notizFassung: number;
      id: string;
      version: number;
      stand: "offen" | "validiert" | "abgelehnt" | "rueckfrage";
    };

export type Regelstand =
  | { notizFassung: number; stand: "nicht_verfuegbar" }
  | {
      notizFassung: number;
      stand: "offen" | "rueckfrage" | "uebernommen" | "abgelehnt";
      koId: string;
      titel: string;
      basis: number;
      aktuelleVersion: number;
      aktuelleVersionFreigegeben: boolean;
      ergebnisVersion?: number;
      grund?: string;
      entschiedenVon?: string;
    };
export interface RegelEntwurf {
  koId: string;
  basis: number;
  aussage: string;
  auszug: string;
}
export interface RegelVorschau extends RegelEntwurf {
  titel: string;
  bisher: string;
  stufe: string;
  space: string | null;
  stempel: string;
}
const pfad = (id: string) => `/me/klara/notizen/${encodeURIComponent(id)}/wissen`;
export const klaraWissenApi = {
  beitragsstand: (id: string) =>
    api.get<{ beitraege: WissensBeitragsstand[]; regelvorschlaege: Regelstand[] }>(
      `${pfad(id)}/stand`,
    ),
  ziele: () =>
    api.get<{ spaces: { id: string; name: string; zugang: string }[] }>("/me/klara/wissen/ziele"),
  vorschau: (id: string, fassung: number, ziel: WissensZiel) =>
    api.post<WissensVorschau>(`${pfad(id)}/vorschau`, { fassung, ziel }),
  pruefstand: (id: string, lauf?: string) =>
    api.get<{ pruefung: NotizQuellenpruefung | null }>(
      `${pfad(id)}/stand?pruefstand=${encodeURIComponent(lauf ?? "letzter")}`,
    ),
  pruefen: (id: string, fassung: number) =>
    api.post<NotizQuellenpruefung>(`${pfad(id)}/pruefen`, { fassung }),
  uebernehmen: (v: WissensVorschau, ziel: WissensZiel) =>
    api.post<WissensErgebnis>(`${pfad(v.notizId)}/uebernehmen`, {
      fassung: v.fassung,
      ziel,
      stempel: v.stempel,
      bewusst: true,
    }),
  regelVorschau: (id: string, fassung: number, entwurf: RegelEntwurf) =>
    api.post<RegelVorschau>(`${pfad(id)}/vorschau`, {
      ...entwurf,
      fassung,
      modus: "regelvorschlag",
    }),
  regelEinreichen: (id: string, fassung: number, v: RegelVorschau) =>
    api.post<{ koId: string; vorschlagId: string; status: string }>(`${pfad(id)}/uebernehmen`, {
      koId: v.koId,
      basis: v.basis,
      aussage: v.aussage,
      auszug: v.auszug,
      stempel: v.stempel,
      fassung,
      modus: "regelvorschlag",
      bewusst: true,
    }),
  importiere: (x: unknown) => api.post<{ notiz: { id: string } }>("/me/klara/wissen/import", x),
};
