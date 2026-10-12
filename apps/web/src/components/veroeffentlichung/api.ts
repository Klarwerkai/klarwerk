import { ApiError, api } from "../../api/client";

// ================================================================================================
// VERÖFFENTLICHUNG · der Drahtvertrag der zwei Türen (`routes/veroeffentlichung-routes.ts`).
// ================================================================================================
//
// Die Gestalten sind zeichengleich zu den Antworten des Servers (`services/app/src/
// veroeffentlichung.ts`: `VeroeffentlichungsStand`, `Veroeffentlichungsvorschau`); dass beide
// zusammenpassen, messen `tests/veroeffentlichungsoptionen/*` an der echten App.

export type Meldungswahl = "still" | "normal" | "hervorgehoben";

export const MELDUNGSWAHLEN: readonly Meldungswahl[] = ["still", "normal", "hervorgehoben"];

export interface VeroeffentlichungVerlauf {
  id: string;
  fassung: number;
  art: "neu" | "aktualisierung";
  meldung: Meldungswahl;
  von: { id: string; name: string };
  am: string;
  empfaenger: number;
}

interface StandBasis {
  koId: string;
  aktuelleFassung: number;
  gueltig: boolean;
  veroeffentlichteFassung: number | null;
  aktuelleIstVeroeffentlicht: boolean;
  verlauf: VeroeffentlichungVerlauf[];
}

export interface VeroeffentlichungLeserStand extends StandBasis {
  darfVeroeffentlichen: false;
}

export interface VeroeffentlichungVorschau extends StandBasis {
  darfVeroeffentlichen: true;
  art: "neu" | "aktualisierung";
  hinderungsgrund: "keine_gueltige_fassung" | "bereits_veroeffentlicht" | null;
  sichtbarkeit: { stufe: string | null; spaceId: string | null; leser: number };
  empfaenger: Array<{ id: string; name: string }>;
  kenntnisnahmen: { offen: number; ueberholt: number };
  // ADMIN-12: die Wirkung jeder Wahl nach den geltenden Kommunikationsregeln.
  meldungswirkung: Record<Meldungswahl, Meldungswirkung>;
  mailEingerichtet: boolean;
}

export interface Meldungswirkung {
  glocke: number;
  sofort: number;
  zusammenfassung: number;
  abgewaehlt: number;
  mail: number;
}

export type ZustellStatus = "angelegt" | "zugestellt" | "fehlgeschlagen" | "entfallen";

export interface ZustellEmpfaenger {
  id: string;
  name: string;
  glocke: "angelegt" | "zugestellt" | "gelesen" | null;
  hinweis: "abgewaehlt" | "zusammenfassung" | null;
  mail: {
    status: ZustellStatus;
    grund: "kein_zugriff" | "abgewaehlt" | "mailserver_abgelehnt" | null;
  } | null;
  kenntnisnahme: "ausstehend" | "bestaetigt" | "ueberfaellig" | "ueberholt" | null;
}

export interface ZustellAuskunft {
  vermerkId: string;
  fassung: number;
  meldung: Meldungswahl;
  am: string;
  mailEingerichtet: boolean;
  erfasst: boolean;
  zaehlung: {
    glocke: { angelegt: number; zugestellt: number; gelesen: number };
    mail: { angelegt: number; zugestellt: number; fehlgeschlagen: number; entfallen: number };
    kenntnisnahme: { offen: number; bestaetigt: number };
  };
  empfaenger: ZustellEmpfaenger[];
}

export type VeroeffentlichungAuskunft = VeroeffentlichungLeserStand | VeroeffentlichungVorschau;

export interface VeroeffentlichungErgebnis {
  vermerk: VeroeffentlichungVerlauf;
  kenntnisnahmen: { offen: number; ueberholt: number };
  zustellung: ZustellAuskunft | null;
}

const pfad = (koId: string): string => `/kos/${encodeURIComponent(koId)}/veroeffentlichung`;

export const veroeffentlichungApi = {
  stand: (koId: string) => api.get<VeroeffentlichungAuskunft>(pfad(koId)),
  veroeffentlichen: (koId: string, body: { fassung: number; meldung: Meldungswahl }) =>
    api.post<VeroeffentlichungErgebnis>(pfad(koId), body),
  zustellung: (koId: string, vermerkId: string) =>
    api.get<ZustellAuskunft>(`${pfad(koId)}/zustellung/${encodeURIComponent(vermerkId)}`),
  fortsetzen: (koId: string, vermerkId: string) =>
    api.post<ZustellAuskunft>(
      `${pfad(koId)}/zustellung/${encodeURIComponent(vermerkId)}/fortsetzen`,
    ),
};

/** Die maschinenlesbare Ursache einer Ablehnung (`grund`) — oder `null`. */
export function fehlerGrund(fehler: unknown): string | null {
  if (fehler instanceof ApiError && typeof fehler.details.grund === "string") {
    return fehler.details.grund;
  }
  return null;
}
