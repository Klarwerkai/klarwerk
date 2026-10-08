// Betroffenenrechte — der Draht zu `services/app/src/routes/datenschutz-routes.ts`.
//
// Die Gestalt ist die des Servers (`selbstauskunft.ts`, `loeschantraege.ts`, `dateninventar.ts`);
// sie steht hier ein zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides
// gemeinsam. Die Auskunft wird als Ganzes durchgereicht — die Fläche zählt nur und lädt herunter.
import { ApiError, api } from "./client";

export type LoeschantragStatus =
  | "offen"
  | "in_bearbeitung"
  | "erledigt"
  | "abgelehnt"
  | "zurueckgezogen";

export interface Loeschantrag {
  id: string;
  nutzerId: string;
  gestelltAm: string;
  fristBis: string;
  begruendung: string | null;
  status: LoeschantragStatus;
  entschiedenVon: string | null;
  entschiedenAm: string | null;
  entscheidungsgrund: string | null;
  ueberfaellig: boolean;
}

export interface LoeschantragVerwaltung extends Loeschantrag {
  nutzer: { name: string; email: string } | null;
}

/** Die Selbstauskunft — nur die Felder, die die Fläche liest; der Rest reist in der Datei mit. */
export interface Selbstauskunft {
  art: "klarwerk.selbstauskunft";
  erzeugtAm: string;
  nutzerId: string;
  zaehlung: Record<string, number>;
  nichtEnthalten: Array<{ datenart: string; name: string; grund: string }>;
  uebergabe: {
    verantwortlichFuer: number;
    autorVon: number;
    offenePruefzuweisungen: number;
    zugewieseneOffeneFragen: number;
  };
}

export interface DatenartInventar {
  id: string;
  name: string;
  personenbezug: "ja" | "moeglich" | "nein";
  ablage: { ort: string; tabellen: string[] };
  selbstauskunft: { enthalten: true } | { enthalten: false; grund: string };
}

export interface Verarbeitungsverzeichnis {
  art: "klarwerk.verarbeitungsverzeichnis";
  erzeugtAm: string;
  taetigkeiten: Array<{ id: string; name: string; empfaenger: string[] }>;
  datenarten: DatenartInventar[];
}

/** Die Datenmitnahme als Datei — dieselbe Bauart wie der Export des Prüfprotokolls. */
export function alsDateiSpeichern(inhalt: string, dateiname: string, typ: string): void {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ein Zeitstempel, der in einem Dateinamen steht (ohne `:` und `.`). */
export function dateistempel(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

async function textAbrufen(pfad: string): Promise<string> {
  const res = await fetch(`/api${pfad}`, { credentials: "include" });
  const text = await res.text();
  if (!res.ok) {
    let code = "ERROR";
    let message = res.statusText;
    try {
      const daten = JSON.parse(text) as { error?: unknown; message?: unknown };
      code = daten.error ? String(daten.error) : code;
      message = daten.message ? String(daten.message) : message;
    } catch {
      // Kein JSON — dann bleibt die Statuszeile die Auskunft.
    }
    throw new ApiError(res.status, code, message);
  }
  return text;
}

export const datenschutzApi = {
  meineDaten: () => api.get<Selbstauskunft>("/me/daten"),
  meineAntraege: () => api.get<{ antraege: Loeschantrag[] }>("/me/loeschantrag"),
  antragStellen: (begruendung: string | null) =>
    api.post<Loeschantrag>("/me/loeschantrag", { begruendung }),
  antragZurueckziehen: (id: string) =>
    api.post<Loeschantrag>(`/me/loeschantrag/${encodeURIComponent(id)}/zurueckziehen`),
  alleAntraege: () =>
    api.get<{ antraege: LoeschantragVerwaltung[] }>("/datenschutz/loeschantraege"),
  erledigen: (id: string) =>
    api.post<LoeschantragVerwaltung>(
      `/datenschutz/loeschantraege/${encodeURIComponent(id)}/erledigen`,
    ),
  ablehnen: (id: string, grund: string) =>
    api.post<LoeschantragVerwaltung>(
      `/datenschutz/loeschantraege/${encodeURIComponent(id)}/ablehnen`,
      { grund },
    ),
  auskunftFuer: (nutzerId: string) =>
    api.get<Selbstauskunft>(`/datenschutz/auskunft/${encodeURIComponent(nutzerId)}`),
  verzeichnis: () => api.get<Verarbeitungsverzeichnis>("/datenschutz/verarbeitungsverzeichnis"),
  verzeichnisMarkdown: () => textAbrufen("/datenschutz/verarbeitungsverzeichnis?format=markdown"),
};
