// Qualitätsaufgaben — der Draht zu `services/app/src/routes/qualitaetsaufgaben-routes.ts`
// (produkt:20261009:admin-qualitaetsaufgaben, ADMIN-10).
//
// Die Gestalt ist die des Servers (`services/app/src/qualitaetsaufgaben.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export const VORGANG_TYPEN = [
  "pruefung",
  "revalidierung",
  "konflikt",
  "duplikat",
  "luecke",
  "rueckmeldung",
] as const;
export type VorgangTyp = (typeof VORGANG_TYPEN)[number];

export const VORGANG_ZUSTAENDE = ["offen", "in_arbeit", "eskaliert", "erledigt", "unklar"] as const;
export type VorgangZustand = (typeof VORGANG_ZUSTAENDE)[number];

export interface Person {
  id: string;
  name: string | null;
}

export interface Zustaendig extends Person {
  art: "pruefer" | "verantwortlich" | "autor-ersatz" | "zugewiesen";
}

export interface QualitaetsVorgang {
  schluessel: string;
  typ: VorgangTyp;
  zustand: VorgangZustand;
  ursprung: { art: "ko" | "konflikt" | "duplikat" | "luecke" | "meldung"; id: string };
  arbeitsweg: string;
  titel: string | null;
  inhalt: { koId: string; titel: string }[];
  spaces: string[];
  zustaendig: Zustaendig[];
  frist: string | null;
  ueberfaellig: boolean;
  seit: string | null;
  einstiege: string[];
  grund?: "antwort-falsch" | "quelle-passt-nicht";
  rueckmeldungen?: { meldungId: string; grund: string; at: string }[];
  uebernahme?: { am: string; durch: Person; vorgang: string };
  ergebnis?: { art: "bestaetigt"; am: string; fassung: number | null; durch: Person };
}

export interface QualitaetsUebersicht {
  stand: string;
  vorgaenge: QualitaetsVorgang[];
  quellen: Record<VorgangTyp, "ok" | "fehler">;
  spaces: { id: string; name: string }[];
}

export interface UebernahmeErgebnis {
  art: "angelegt" | "angehaengt" | "bereits";
  vorgang: string;
  am: string;
  durch: Person;
}

/** Der Abfrageschlüssel — Liste und Zähler lesen DENSELBEN Zwischenspeicher. */
export const QUALITAETSAUFGABEN_KEY = ["qualitaetsaufgaben"] as const;

export const qualitaetsaufgabenApi = {
  liste: () => api.get<QualitaetsUebersicht>("/qualitaetsaufgaben"),
  uebernehmen: (meldungId: string) =>
    api.post<UebernahmeErgebnis>(
      `/qualitaetsaufgaben/rueckmeldungen/${encodeURIComponent(meldungId)}/uebernehmen`,
    ),
};
