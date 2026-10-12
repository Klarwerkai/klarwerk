// Teams — der Draht zu `services/app/src/routes/teams-routes.ts` (produkt:20261009:admin-teams).
//
// Die Gestalt ist die des Servers (`services/app/src/teams.ts`); sie steht hier ein zweites Mal,
// weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { ApiError, api } from "./client";
import type { EigenesSpaceRecht, SpaceRecht } from "./spaces";

/** Der Textschlüssel zu einem Fehler der Teamwege. */
export function teamFehlerSchluessel(fehler: unknown): string {
  if (!(fehler instanceof ApiError)) {
    return "teams.fehler.allgemein";
  }
  switch (fehler.code) {
    case "TEAM_UNGUELTIG":
      return "teams.fehler.ungueltig";
    case "TEAM_ARCHIVIERT":
      return "teams.fehler.archiviert";
    case "VERSION_VERALTET":
      return "teams.fehler.veraltet";
    case "VORSCHAU_VERALTET":
      return "teams.fehler.vorschauVeraltet";
    default:
      return fehler.status === 403 ? "teams.fehler.recht" : "teams.fehler.allgemein";
  }
}

export interface TeamEingabe {
  name: string;
  zweck: string;
  verantwortlich: string;
  mitglieder: string[];
}

export interface TeamSicht {
  id: string;
  version: number;
  name: string;
  zweck: string;
  verantwortlich: string;
  verantwortlichName: string | null;
  archiviert: boolean;
  vorgang: "angelegt" | "geaendert" | "archiviert";
  mitglieder: { nutzer: string; name: string | null; role: string | null }[];
  spaces: { id: string; name: string; recht: SpaceRecht }[];
  geaendertVon: string;
  geaendertAm: string;
}

export interface TeamVerlaufEintrag {
  version: number;
  vorgang: "angelegt" | "geaendert" | "archiviert";
  geaendertVon: string;
  geaendertVonName: string | null;
  geaendertAm: string;
  hinzugefuegt: { id: string; name: string | null }[];
  entfernt: { id: string; name: string | null }[];
}

export interface Zugangsweg {
  art: "zustaendig" | "direkt" | "team" | "offen";
  recht: SpaceRecht;
  team?: string;
  teamName?: string;
}

export interface TeamWirkung {
  teamId: string;
  version: number;
  grundlage: string;
  spaces: { id: string; name: string; recht: SpaceRecht; verlieren: number }[];
  personen: {
    nutzer: string;
    name: string;
    role: string;
    aenderung: "hinzu" | "entfernt" | "archiviert";
    spaces: {
      spaceId: string;
      spaceName: string;
      teamRecht: SpaceRecht;
      vorher: EigenesSpaceRecht;
      nachher: EigenesSpaceRecht;
      wegeNachher: Zugangsweg[];
    }[];
  }[];
}

const pfad = (id: string): string => `/teams/${encodeURIComponent(id)}`;

export const teamsApi = {
  liste: () => api.get<{ teams: TeamSicht[] }>("/teams"),
  eintrag: (id: string) => api.get<{ team: TeamSicht; verlauf: TeamVerlaufEintrag[] }>(pfad(id)),
  anlegen: (eingabe: TeamEingabe) => api.post<TeamSicht>("/teams", eingabe),
  vorschauMitglieder: (id: string, mitglieder: string[]) =>
    api.post<TeamWirkung>(`${pfad(id)}/vorschau`, { mitglieder }),
  vorschauArchiv: (id: string) =>
    api.post<TeamWirkung>(`${pfad(id)}/vorschau`, { archivieren: true }),
  /** `grundlage` aus der gezeigten Wirkung — Pflicht, sobald sich die Mitglieder ändern. */
  aendern: (id: string, version: number, eingabe: TeamEingabe, grundlage?: string) =>
    api.put<TeamSicht>(pfad(id), { ...eingabe, version, ...(grundlage ? { grundlage } : {}) }),
  archivieren: (id: string, version: number, grundlage: string) =>
    api.post<TeamSicht>(`${pfad(id)}/archivieren`, { version, grundlage }),
};
