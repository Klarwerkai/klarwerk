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
}

export type VeroeffentlichungAuskunft = VeroeffentlichungLeserStand | VeroeffentlichungVorschau;

export interface VeroeffentlichungErgebnis {
  vermerk: VeroeffentlichungVerlauf;
  kenntnisnahmen: { offen: number; ueberholt: number };
}

export const veroeffentlichungApi = {
  stand: (koId: string) =>
    api.get<VeroeffentlichungAuskunft>(`/kos/${encodeURIComponent(koId)}/veroeffentlichung`),
  veroeffentlichen: (koId: string, body: { fassung: number; meldung: Meldungswahl }) =>
    api.post<VeroeffentlichungErgebnis>(`/kos/${encodeURIComponent(koId)}/veroeffentlichung`, body),
};

/** Die maschinenlesbare Ursache einer Ablehnung (`grund`) — oder `null`. */
export function fehlerGrund(fehler: unknown): string | null {
  if (fehler instanceof ApiError && typeof fehler.details.grund === "string") {
    return fehler.details.grund;
  }
  return null;
}
