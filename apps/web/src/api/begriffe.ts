// Firmenwörterbuch — der Draht zu `services/app/src/routes/begriffe-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/firmenwoerterbuch.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export type BegriffSprache = "de" | "en";

export interface Benennungen {
  vorzug: string;
  synonyme: string[];
  unerwuenscht: string[];
}

export interface BegriffEingabe {
  geltungsbereich: string;
  verantwortlich: string;
  definition: Partial<Record<BegriffSprache, string>>;
  bezeichnungen: Partial<Record<BegriffSprache, Benennungen>>;
}

export interface BegriffFassung extends BegriffEingabe {
  id: string;
  version: number;
  geaendertVon: string;
  geaendertAm: string;
}

export interface BegriffsHinweis {
  begriffId: string;
  begriffVersion: number;
  sprache: BegriffSprache;
  geltungsbereich: string;
  segment: number;
  start: number;
  ende: number;
  gefunden: string;
  vorkommen: number;
  vorkommenGesamt: number;
  vorzug: string;
  definition: string | null;
  mehrdeutig: boolean;
}

export interface BegriffsPruefung {
  hinweise: BegriffsHinweis[];
  begriffeGeprueft: number;
  kontext: string | null;
  sachlichGeprueft: false;
}

export const begriffeApi = {
  liste: () => api.get<{ begriffe: BegriffFassung[] }>("/begriffe"),
  eintrag: (id: string) =>
    api.get<{ aktuell: BegriffFassung; fassungen: BegriffFassung[] }>(
      `/begriffe/${encodeURIComponent(id)}`,
    ),
  anlegen: (eingabe: BegriffEingabe) => api.post<BegriffFassung>("/begriffe", eingabe),
  aendern: (id: string, version: number, eingabe: BegriffEingabe) =>
    api.put<BegriffFassung>(`/begriffe/${encodeURIComponent(id)}`, { ...eingabe, version }),
  pruefen: (segmente: string[], kontext: string | null) =>
    api.post<BegriffsPruefung>("/begriffe/pruefen", { segmente, kontext }),
};
