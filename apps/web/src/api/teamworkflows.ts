import { ApiError, api } from "./client";
import type { TeamLauf, Teamwahl, Urteil } from "./teamassistenten";
import { teamSprache } from "./teamassistenten";

export type Schritt =
  | {
      typ: "assistent";
      titel: string;
      assistentId: string;
      version: number;
      frage: string;
      erwartet: Urteil;
    }
  | { typ: "entscheidung"; titel: string; rolle: "mitglied" | "verantwortlich" }
  | { typ: "aktion"; titel: string; aktion: "ergebnis_festhalten" };
export interface Definition {
  name: string;
  ausloeser: string;
  beispielfall?: string;
  schritte: Schritt[];
}
export interface Workflow {
  id: string;
  teamId: string;
  name: string;
  verantwortlich: string;
  bearbeitbar: boolean;
  nutzbar: boolean;
  aktiv: number | null;
  aktivName: string | null;
  veroeffentlicht?: {
    ausloeser: string;
    schritte: { typ: Schritt["typ"]; titel: string }[];
    brauchtFall?: boolean;
  } | null;
}
export interface Entwurf extends Workflow {
  entwurf: number;
  revision: number;
  definition: Definition;
  freigegebeneVersionen: number[];
  pruefung: {
    version: number;
    bestanden: boolean;
    schritte: {
      index: number;
      typ: Schritt["typ"];
      bestanden: boolean;
      erwartet?: Urteil;
      ist?: Urteil;
      code?: string;
    }[];
  } | null;
}
export type Aktion = "weiter" | "annehmen" | "rueckfrage" | "antworten" | "ablehnen";
export interface Laufzeile {
  id: string;
  workflowId: string;
  version: number;
  revision: number;
  stand: "laeuft" | "rueckfrage" | "abgelehnt" | "abgeschlossen" | "angehalten";
  index: number;
  gesamt?: number;
  gestartetVon: string;
  aktualisiertAm: string;
}
export interface Ereignis {
  index: number;
  schrittTitel?: string;
  typ: "start" | "assistent" | "annehmen" | "rueckfrage" | "antworten" | "ablehnen" | "aktion";
  akteur: string;
  am: string;
  notiz?: string;
  assistentId?: string;
  version?: number;
  antwort?: TeamLauf["antwort"];
  ergebnisId?: string;
}
export interface Lauf extends Laufzeile {
  schritt: Schritt | null;
  zustaendig?: string | null;
  workflowName?: string;
  ausloeser?: string;
  namen?: Record<string, string>;
  naechsteWirkung?: { index: number; titel: string } | null;
  fall?: string;
  ergebnisse: {
    id: string;
    index: number;
    titel: string;
    erstelltAm: string;
    erstelltVon: string;
    workflowVersion: number;
    schritte: number[];
  }[];
  aktionen: Aktion[];
  verlauf: Ereignis[];
  grund?: string;
}

const basis = "/teamworkflows";
const pfad = (id: string) => `${basis}/${encodeURIComponent(id)}`;
const laeufe = (id: string) => `${pfad(id)}/laeufe`;
const laufpfad = (id: string, laufId: string) => `${laeufe(id)}/${encodeURIComponent(laufId)}`;

export const workflows = {
  liste: () => api.get<{ teams: Teamwahl[]; workflows: Workflow[] }>(basis),
  detail: (id: string) => api.get<Entwurf | Workflow>(pfad(id)),
  erstellen: (teamId: string, definition: Definition) =>
    api.post<Entwurf>(basis, { teamId, definition }),
  speichern: (id: string, revision: number, definition: Definition) =>
    api.put<Entwurf>(pfad(id), { revision, definition }),
  pruefen: (id: string, revision: number, sprache: string) =>
    api.post<Entwurf>(`${pfad(id)}/pruefen`, { revision, sprache: teamSprache(sprache) }),
  freigeben: (id: string, revision: number, version: number) =>
    api.post<Entwurf>(`${pfad(id)}/freigeben`, { revision, version }),
  zurueckziehen: (id: string, revision: number) =>
    api.post<Entwurf>(`${pfad(id)}/zurueckziehen`, { revision }),
  entfernen: (id: string, revision: number) => api.del<void>(pfad(id), { revision }),
  laeufe: (id: string) => api.get<{ laeufe: Laufzeile[] }>(laeufe(id)),
  starten: (id: string, version: number, vorgang: string, sprache: string, fall: string) =>
    api.post<Lauf>(laeufe(id), { version, vorgang, fall, sprache: teamSprache(sprache) }),
  lauf: (id: string, laufId: string) => api.get<Lauf>(laufpfad(id, laufId)),
  weiter: (id: string, laufId: string, revision: number, aktion: Aktion, notiz: string) =>
    api.post<Lauf>(`${laufpfad(id, laufId)}/weiter`, {
      revision,
      aktion,
      notiz: notiz.trim() || undefined,
    }),
};

export function workflowFehler(e: unknown) {
  if (e instanceof ApiError) {
    if ([401, 403, 404].includes(e.status)) return "workflows.keinZugang";
    if (e.code === "PRUEFUNG_FEHLT") return "workflows.testFehlt";
    if (
      e.code === "ASSISTENT_NICHT_VERFUEGBAR" ||
      e.code === "GRUNDLAGE_GEAENDERT" ||
      e.code === "QUELLEN_GEAENDERT"
    )
      return "workflows.grundlage";
    if (e.status === 409) return "workflows.veraltet";
    if (e.status === 400 || e.status === 422) return "workflows.eingabe";
  }
  return "workflows.fehler";
}
