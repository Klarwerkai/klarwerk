import { ApiError, api } from "./client";

export type Urteil = "belegt" | "widerspruch" | "offen";
export interface Beispiel {
  frage: string;
  erwartet: Urteil;
}
export interface Teamdefinition {
  name: string;
  aufgabe: string;
  sachfragen?: boolean;
  quellen: string[];
  beispiele: Beispiel[];
}
export interface Teamwahl {
  id: string;
  name: string;
  kannErstellen: boolean;
}
export interface AssistentZeile {
  id: string;
  teamId: string;
  name: string;
  verantwortlich: string;
  bearbeitbar: boolean;
  nutzbar: boolean;
  aktiv: number | null;
  aktivName: string | null;
}
export interface AssistentEntwurf extends AssistentZeile {
  entwurf: number;
  revision: number;
  definition: Teamdefinition;
  pruefung: {
    version: number;
    bestanden: boolean;
    faelle: (Beispiel & { ist: Urteil; bestanden: boolean })[];
  } | null;
  freigegebeneVersionen: number[];
}
export interface TeamLauf {
  assistentId: string;
  version: number;
  antwort: {
    stand: Urteil;
    text: string;
    quellen: { id: string; version: number; titel: string; auszug: string; href: string }[];
  };
}
export function teamSprache(sprache: string) {
  const wert = sprache.split("-")[0]?.toLowerCase();
  return wert === "en" || wert === "nl" ? wert : "de";
}

const basis = "/teamassistenten";
const pfad = (id: string) => `${basis}/${encodeURIComponent(id)}`;
export const teamassistenten = {
  liste: () => api.get<{ teams: Teamwahl[]; assistenten: AssistentZeile[] }>(basis),
  detail: (id: string) => api.get<AssistentZeile | AssistentEntwurf>(pfad(id)),
  erstellen: (teamId: string, definition: Teamdefinition) =>
    api.post<AssistentEntwurf>(basis, { teamId, definition }),
  speichern: (id: string, revision: number, definition: Teamdefinition) =>
    api.put<AssistentEntwurf>(pfad(id), { revision, definition }),
  pruefen: (id: string, revision: number, sprache: string) =>
    api.post<AssistentEntwurf>(`${pfad(id)}/pruefen`, { revision, sprache: teamSprache(sprache) }),
  freigeben: (id: string, revision: number, version: number) =>
    api.post<AssistentEntwurf>(`${pfad(id)}/freigeben`, { revision, version }),
  entfernen: (id: string, revision: number) => api.del<void>(pfad(id), { revision }),
  zurueckziehen: (id: string, revision: number) =>
    api.post<AssistentEntwurf>(`${pfad(id)}/zurueckziehen`, { revision }),
  fragen: (id: string, version: number, frage: string, sprache: string) =>
    api.post<TeamLauf>(`${pfad(id)}/fragen`, { version, frage, sprache: teamSprache(sprache) }),
};

export function teamFehler(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403 || e.status === 404) return "teamassistenten.zugang";
    if (e.code === "QUELLEN_GEAENDERT") return "teamassistenten.quellenGeaendert";
    if (e.code === "PRUEFUNG_FEHLT") return "teamassistenten.pruefungFehlt";
    if (e.status === 409) return "teamassistenten.veraltet";
    if (e.status === 400) return "teamassistenten.eingabefehler";
  }
  return "teamassistenten.fehler";
}
