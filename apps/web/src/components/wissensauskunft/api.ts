import { ApiError, api } from "../../api/client";

// ================================================================================================
// WISSENSAUSKUNFT ZUM ZEITPUNKT · der Drahtvertrag der einen Tür (`wissensauskunft-routes.ts`).
// ================================================================================================
//
// Die Gestalten sind zeichengleich zur Antwort des Servers (`services/app/src/wissensauskunft.ts`:
// `Wissensauskunft`); dass beide zusammenpassen, messen `tests/wissensauskunft/` an der echten App.

export type Belegart =
  | "angelegt"
  | "ueberarbeitet"
  | "vorgeschlagen"
  | "kommentiert"
  | "geprueft"
  | "freigegeben"
  | "antwortquelle"
  | "kenntnisnahme_verteilt"
  | "kenntnisnahme_angefordert"
  | "kenntnisnahme_bestaetigt"
  | "sonstige_bearbeitung";

export type NichtErfasst = "oeffnen" | "pruefstatus" | "antwortquellen";

export interface Person {
  id: string;
  name: string;
}

export interface Kenntnisbeleg {
  art: Belegart;
  am: string;
  fassung: number | null;
  seq: number | null;
  zurueckgenommen: boolean;
}

export interface Wissensauskunft {
  koId: string;
  zeitpunkt: string;
  vorhanden: boolean;
  imPapierkorb: boolean;
  fassung: { version: number; seit: string; von: Person; titel: string; aussage: string } | null;
  freigabe: { am: string; von: Person } | null;
  aktuelleFassung: number;
  personen: Array<Person & { belege: Kenntnisbeleg[] }>;
  nichtErfasst: NichtErfasst[];
}

export const wissensauskunftApi = {
  abfragen: (koId: string, zeitpunkt: string) =>
    api.get<Wissensauskunft>(
      `/kos/${encodeURIComponent(koId)}/wissensauskunft?zeitpunkt=${encodeURIComponent(zeitpunkt)}`,
    ),
};

/** Die maschinenlesbare Ursache einer Ablehnung (`grund`) — oder `null`. */
export function fehlerGrund(fehler: unknown): string | null {
  if (fehler instanceof ApiError && typeof fehler.details.grund === "string") {
    return fehler.details.grund;
  }
  return null;
}

/** Der Wert eines `datetime-local`-Felds (Ortszeit) als ISO-Zeitpunkt — oder `null`. */
export function zeitpunktAusFeld(wert: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(wert)) {
    return null;
  }
  const zeit = new Date(wert);
  return Number.isNaN(zeit.getTime()) ? null : zeit.toISOString();
}

/** Ein Zeitpunkt in der Schreibweise eines `datetime-local`-Felds, in Ortszeit, minutengenau. */
export function feldwertAus(zeit: Date): string {
  const zwei = (n: number): string => String(n).padStart(2, "0");
  const datum = `${zeit.getFullYear()}-${zwei(zeit.getMonth() + 1)}-${zwei(zeit.getDate())}`;
  return `${datum}T${zwei(zeit.getHours())}:${zwei(zeit.getMinutes())}`;
}
