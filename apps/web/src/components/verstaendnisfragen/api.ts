import { ApiError, api } from "../../api/client";

// ================================================================================================
// VERSTÄNDNISFRAGEN · der Drahtvertrag der neun Türen (`routes/verstaendnisfragen-routes.ts`).
// ================================================================================================
//
// Die Gestalten sind zeichengleich zu den Antworten des Servers (`services/app/src/
// verstaendnisfragen.ts`: `lernSicht`, `rueckmeldung`, `ergebnisKurz`); dass beide zusammenpassen,
// messen `tests/verstaendnisfragen/am-server.test.ts` und `…/flaeche.test.tsx` an der echten App.

export type Rolle = "viewer" | "experte" | "controller" | "admin";
export type Quellenlage = "aktuell" | "geaendert" | "nicht_gueltig" | "fehlt";
export type FragensatzStatus = "entwurf" | "vorgelegt" | "angenommen" | "zurueckgewiesen";
export type Urteil = "richtig" | "falsch" | "unbeantwortet";

export interface Regel {
  mindestRichtig: number | null;
  hoechstVersuche: number | "unbegrenzt" | null;
}

export interface Option {
  id: string;
  text: string;
}

export interface LernSicht {
  id: string;
  version: number;
  koVersion: number;
  titel: string;
  regel: Regel;
  fragen: Array<{ id: string; text: string; optionen: Option[] }>;
}

export interface ErgebnisKurz {
  versuchId: string;
  fragensatzId: string;
  fragensatzVersion: number;
  koId: string;
  koVersion: number;
  nummer: number;
  abgegebenAm: string;
  richtig: number;
  fragen: number;
  unbeantwortet: number;
  mindestRichtig: number;
  bestanden: boolean;
}

export interface Befunde {
  satz: string[];
  fragen: Array<{ frageId: string; befunde: string[] }>;
}

export interface Bearbeitung {
  id: string;
  version: number;
  koVersion: number;
  titel: string;
  rollen: Rolle[];
  regel: Regel;
  status: FragensatzStatus;
  fragen: Array<{
    id: string;
    text: string;
    optionen: Option[];
    richtig: string[];
    erlaeuterung: string;
    beleg: string;
  }>;
  geaendertAm: string;
  vorgelegtAm: string | null;
  entschiedenAm: string | null;
  begruendung: string | null;
  quellenlage: Quellenlage;
  befunde: Befunde;
}

export interface FragensatzSicht {
  id: string;
  titel: string;
  rollen: Rolle[];
  gueltig: LernSicht | null;
  quellenlage: Quellenlage | null;
  verbleibend: number | null;
  eigeneErgebnisse: ErgebnisKurz[];
  bearbeitung: Bearbeitung | null;
}

export interface FragensaetzeAmEintrag {
  koId: string;
  aktuelleFassung: number;
  gueltig: boolean;
  darfBearbeiten: boolean;
  darfEntscheiden: boolean;
  fragensaetze: FragensatzSicht[];
}

export interface Rueckmeldung {
  versuchId: string;
  fragensatzId: string;
  fragensatzVersion: number;
  titel: string | null;
  koId: string;
  koVersion: number;
  nummer: number;
  abgegebenAm: string;
  bewertung: {
    richtig: number;
    fragen: number;
    unbeantwortet: number;
    mindestRichtig: number;
    bestanden: boolean;
    unvollstaendig: boolean;
  };
  fragen: Array<{
    frageId: string;
    urteil: Urteil;
    text: string | null;
    optionen: Option[];
    gewaehlt: string[];
    richtig: string[];
    erlaeuterung: string | null;
    beleg: string | null;
  }>;
  bereits?: boolean;
}

export interface EigenerFragensatz {
  fragensatzId: string;
  titel: string;
  koId: string;
  koTitel: string;
  zugeordnet: boolean;
  gueltigeVersion: number | null;
  quellenlage: Quellenlage | null;
  regel: Regel | null;
  ergebnisse: ErgebnisKurz[];
}

export interface Uebersicht {
  fragensatzId: string;
  koId: string;
  versuche: Array<ErgebnisKurz & { person: { id: string; name: string | null } }>;
}

export interface FragensatzInhalt {
  koVersion: number;
  titel: string;
  rollen: Rolle[];
  regel: Regel;
  fragen: Array<{
    text: string;
    optionen: string[];
    richtig: number[];
    erlaeuterung: string;
    beleg: string;
  }>;
}

export interface Abgabe {
  versuchId: string;
  version: number;
  antworten: Array<{ frageId: string; gewaehlt: string[] }>;
}

const satz = (id: string): string => `/verstaendnisfragen/${encodeURIComponent(id)}`;

export const verstaendnisApi = {
  amEintrag: (koId: string) =>
    api.get<FragensaetzeAmEintrag>(`/kos/${encodeURIComponent(koId)}/verstaendnisfragen`),
  anlegen: (koId: string, inhalt: FragensatzInhalt) =>
    api.post<Bearbeitung>(`/kos/${encodeURIComponent(koId)}/verstaendnisfragen`, inhalt),
  aendern: (id: string, version: number, inhalt: FragensatzInhalt) =>
    api.put<Bearbeitung>(satz(id), { version, inhalt }),
  vorlegen: (id: string, version: number) =>
    api.post<Bearbeitung>(`${satz(id)}/vorlegen`, { version }),
  entscheiden: (
    id: string,
    version: number,
    entscheidung: "annehmen" | "zurueckweisen",
    begruendung: string | null,
  ) =>
    api.post<Bearbeitung>(`${satz(id)}/entscheiden`, {
      version,
      entscheidung,
      ...(begruendung ? { begruendung } : {}),
    }),
  abgeben: (id: string, body: Abgabe) => api.post<Rueckmeldung>(`${satz(id)}/versuche`, body),
  versuch: (versuchId: string) =>
    api.get<Rueckmeldung>(`/verstaendnisfragen/versuche/${encodeURIComponent(versuchId)}`),
  meine: () => api.get<{ fragensaetze: EigenerFragensatz[] }>("/verstaendnisfragen/meine"),
  ergebnisse: (id: string) => api.get<Uebersicht>(`${satz(id)}/ergebnisse`),
};

/** Die maschinenlesbare Ursache einer Ablehnung (`grund`) — oder `null`. */
export function fehlerGrund(fehler: unknown): string | null {
  if (fehler instanceof ApiError && typeof fehler.details.grund === "string") {
    return fehler.details.grund;
  }
  return null;
}

/** Eine neue Versuchskennung — je Formular EINE, damit ein Doppelklick derselbe Versuch bleibt. */
export function neueVersuchId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
