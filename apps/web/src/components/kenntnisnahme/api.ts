import { ApiError, api } from "../../api/client";

// ================================================================================================
// KENNTNISNAHME · der Drahtvertrag der fünf Türen (`routes/kenntnisnahme-routes.ts`).
// ================================================================================================
//
// Die Gestalten sind zeichengleich zu den Antworten des Servers (`services/app/src/
// kenntnisnahme.ts`: `AnforderungsStand`, `EmpfaengerStand`); dass beide zusammenpassen, messen
// `tests/kenntnisnahme/kenntnisnahme-am-server.test.ts` und `…-flaeche.test.tsx` an der echten App.

export type KenntnisnahmeStatus = "ausstehend" | "bestaetigt" | "ueberfaellig" | "ueberholt";

export interface KenntnisnahmeEmpfaenger {
  id: string;
  name: string;
  status: KenntnisnahmeStatus;
  bestaetigtAm: string | null;
  nachFrist: boolean;
  zugriff: boolean;
}

export interface KenntnisnahmeAnforderung {
  id: string;
  fassung: number;
  angefordertVon: { id: string; name: string };
  angefordertAm: string;
  frist: string | null;
  erinnertAm: string | null;
  zaehlung: Record<KenntnisnahmeStatus, number>;
  empfaenger: KenntnisnahmeEmpfaenger[];
}

export interface KenntnisnahmeUebersicht {
  koId: string;
  aktuelleFassung: number;
  gueltig: boolean;
  moeglicheEmpfaenger: Array<{ id: string; name: string }>;
  anforderungen: KenntnisnahmeAnforderung[];
}

export interface EigeneKenntnisnahme {
  anforderungId: string;
  koId: string;
  titel: string;
  fassung: number;
  aktuelleFassung: number;
  angefordertVon: string;
  angefordertAm: string;
  frist: string | null;
  erinnertAm: string | null;
  status: KenntnisnahmeStatus;
  bestaetigtAm: string | null;
}

export interface AnforderungsEingabe {
  fassung: number;
  empfaenger: string[];
  frist: string | null;
}

export interface AnforderungsErgebnis {
  angelegt: boolean;
  anforderungId: string | null;
  neu: string[];
  bereits: string[];
}

export const kenntnisnahmeApi = {
  uebersicht: (koId: string) =>
    api.get<KenntnisnahmeUebersicht>(`/kos/${encodeURIComponent(koId)}/kenntnisnahmen`),
  anfordern: (koId: string, body: AnforderungsEingabe) =>
    api.post<AnforderungsErgebnis>(`/kos/${encodeURIComponent(koId)}/kenntnisnahmen`, body),
  erinnern: (anforderungId: string) =>
    api.post<{ erinnert: number }>(`/kenntnisnahmen/${encodeURIComponent(anforderungId)}/erinnern`),
  meine: () => api.get<{ eintraege: EigeneKenntnisnahme[] }>("/kenntnisnahmen/meine"),
  bestaetigen: (anforderungId: string, fassung: number) =>
    api.post<{ status: "bestaetigt"; bestaetigtAm: string; fassung: number; bereits: boolean }>(
      `/kenntnisnahmen/${encodeURIComponent(anforderungId)}/bestaetigen`,
      { fassung },
    ),
};

/** Die maschinenlesbare Ursache einer Ablehnung (`grund`) — oder `null`. */
export function fehlerGrund(fehler: unknown): string | null {
  if (fehler instanceof ApiError && typeof fehler.details.grund === "string") {
    return fehler.details.grund;
  }
  return null;
}

/**
 * Das Datum einer Frist aus dem Datumsfeld (`JJJJ-MM-TT`): das Ende dieses Tages in der Ortszeit
 * des Anfordernden — eine Frist „bis zum 10." heisst „der 10. zählt noch".
 */
export function fristAusDatum(datum: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return null;
  }
  const ende = new Date(`${datum}T23:59:59`);
  return Number.isNaN(ende.getTime()) ? null : ende.toISOString();
}
