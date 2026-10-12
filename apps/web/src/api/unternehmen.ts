// ADMIN-15 · Unternehmensprofil und interne Richtlinien — der Draht zu
// `services/app/src/routes/unternehmen-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/unternehmensprofil.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import type { Role } from "../app/navigation";
import { api } from "./client";

export type AkzentId = "neutral" | "nachtblau" | "tannengruen" | "aubergine" | "anthrazit";
export type LogoTyp = "image/png" | "image/jpeg";

export interface Akzent {
  id: AkzentId;
  flaeche: string;
  schrift: string;
}

export interface LogoBild {
  typ: LogoTyp;
  daten: string;
  breite: number;
  hoehe: number;
}

export interface ProfilAnzeige {
  name: string;
  logo: LogoBild | null;
  akzent: Akzent;
}

export interface ProfilAuskunft {
  version: number;
  profil: ProfilAnzeige | null;
}

export interface ProfilFassung {
  version: number;
  name: string;
  logo: (LogoBild & { bytes: number }) | null;
  akzent: AkzentId;
  geaendertVon: string;
  geaendertAm: string;
  grund: string | null;
  uebernommenAus: number | null;
}

export interface ProfilVerwaltung {
  fassungen: ProfilFassung[];
  akzente: (Akzent & { kontrast: number })[];
  grenzen: {
    logo: { bytes: number; minKante: number; maxKante: number; maxSeitenverhaeltnis: number };
    name: { min: number; max: number };
    minKontrast: number;
  };
}

export interface ProfilSpeichern {
  version: number;
  name: string;
  logo: { typ: LogoTyp; daten: string } | null;
  akzent: AkzentId;
  grund?: string;
  uebernommenAus?: number;
}

export type Anforderung = "anzeige" | "kenntnisnahme" | "zustimmung";
export type Handlungsart = Exclude<Anforderung, "anzeige">;

export interface RichtlinieEingabe {
  titel: string;
  text: string;
  verantwortlich: string;
  gueltigAb: string;
  rollen: Role[];
  anforderung: Anforderung;
}

export interface RichtlinienFassung extends RichtlinieEingabe {
  id: string;
  fassung: number;
  veroeffentlichtVon: string;
  veroeffentlichtAm: string;
  aenderungsgrund: string | null;
}

export interface Handlung {
  richtlinieId: string;
  fassung: number;
  personId: string;
  handlung: Handlungsart;
  am: string;
}

export interface Wirkung {
  verlangt: Anforderung;
  erneut: boolean;
  betroffen: number;
  bisherigeFassung: number | null;
  bisherigeHandlungen: number;
}

export interface RichtlinieImUeberblick {
  aktuell: RichtlinienFassung;
  fassungen: RichtlinienFassung[];
  stand: { betroffen: number; erledigt: number };
}

export type MeineRichtlinie = RichtlinienFassung & { meineHandlung: Handlung | null };

export const UNTERNEHMEN_PFAD = "/unternehmen";
export const RICHTLINIEN_PFAD = "/richtlinien";

export const unternehmenApi = {
  profil: () => api.get<ProfilAuskunft>("/unternehmensprofil"),
  profilVerwaltung: () => api.get<ProfilVerwaltung>("/admin/unternehmensprofil"),
  profilSpeichern: (eingabe: ProfilSpeichern) =>
    api.put<ProfilFassung>("/admin/unternehmensprofil", eingabe),
  meineRichtlinien: () => api.get<{ richtlinien: MeineRichtlinie[] }>("/richtlinien"),
  handeln: (id: string, fassung: number, handlung: Handlungsart) =>
    api.post<Handlung & { bereits: boolean }>(`/richtlinien/${encodeURIComponent(id)}/handlungen`, {
      fassung,
      handlung,
    }),
  richtlinien: () => api.get<{ richtlinien: RichtlinieImUeberblick[] }>("/admin/richtlinien"),
  protokoll: (id: string) =>
    api.get<{ fassungen: RichtlinienFassung[]; eintraege: (Handlung & { personName: string })[] }>(
      `/admin/richtlinien/${encodeURIComponent(id)}/protokoll`,
    ),
  wirkung: (id: string | null, anforderung: Anforderung, rollen: Role[]) =>
    api.post<Wirkung>("/admin/richtlinien/wirkung", { id, anforderung, rollen }),
  anlegen: (eingabe: RichtlinieEingabe, wirkung: Wirkung) =>
    api.post<{ fassung: RichtlinienFassung; wirkung: Wirkung }>("/admin/richtlinien", {
      ...eingabe,
      wirkung,
    }),
  neueFassung: (
    id: string,
    gesehen: number,
    eingabe: RichtlinieEingabe,
    aenderungsgrund: string,
    wirkung: Wirkung,
  ) =>
    api.post<{ fassung: RichtlinienFassung; wirkung: Wirkung }>(
      `/admin/richtlinien/${encodeURIComponent(id)}/fassungen`,
      { ...eingabe, gesehen, aenderungsgrund, wirkung },
    ),
};

/** `data:`-Adresse eines geprüften Logos — nur PNG/JPEG, wie der Server es zulässt. */
export function logoSrc(logo: { typ: LogoTyp; daten: string }): string {
  return `data:${logo.typ};base64,${logo.daten}`;
}
