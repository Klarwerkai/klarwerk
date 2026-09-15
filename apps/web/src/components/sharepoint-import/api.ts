// ================================================================================================
// JOB 4086 — DER DRAHT DIESES BEREICHS. DREI ADRESSEN, SONST NICHTS.
// ================================================================================================
//
// WARUM HIER UND NICHT IN `api/endpoints.ts`: Die zentrale Endpunktliste und der Typkatalog
// (`api/types.ts`) sind Zielpfade eines laufenden Auftrags (JOB 4077). Sie hier anzufassen hiesse,
// zwei Aufträge dieselbe Datei schreiben zu lassen — genau die Lage, aus der Nacht 02./03.09. die
// Regel „nie zwei Bahnen an dieselbe Produktdatei" entstanden ist.
//
// Es entsteht dabei KEIN zweiter Client: gerufen wird `api` aus `api/client.ts` — derselbe
// Fetch-Weg mit Sitzungs-Cookie, Sprachkopf und `ApiError`-Abbildung, den jede andere Fläche
// benutzt. Was hier steht, sind die drei Adressen und ihre Drahtformen.

import { api } from "../../api/client";

/** Der Zugangszustand, wortgleich mit `ImportAccessStatus` des Servers. */
export interface SharePointZugang {
  system: string;
  enabled: boolean;
  credentials: { name: string; present: boolean }[];
  credentialsUsable: boolean;
  blocker: "missing" | "insecure-base-url" | null;
  lastConnectedAt: string | null;
}

/** Eine Zeile der Auswahlliste. `null` heisst „unbekannt" und ist von „0"/leer unterscheidbar. */
export interface SharePointDateiZeile {
  id: string;
  name: string;
  url: string | null;
  geaendertAm: string | null;
  groesseBytes: number | null;
}

export interface SharePointDateiliste {
  dateien: SharePointDateiZeile[];
  /** Es gäbe weitere, ungelesene Einträge — die Liste gibt sich nie für „alles" aus. */
  truncated: boolean;
}

/** Eine wirklich übernommene Datei. Schmaler als die Listenzeile: die Grösse ist hier nicht gemessen. */
export interface SharePointUebernommen {
  id: string;
  name: string;
  url: string | null;
  geaendertAm: string | null;
}

export interface SharePointUebernahme {
  imported: number;
  alreadyQueued: number;
  failed: { id: string; reason: string }[];
  notFound: string[];
  dateien: SharePointUebernommen[];
  importId?: string;
}

export const sharepointApi = {
  zugang: (): Promise<SharePointZugang> => api.get("/import/sharepoint/zugang"),
  dateien: (folderId?: string): Promise<SharePointDateiliste> =>
    api.post("/admin/import/sharepoint/files", folderId ? { folderId } : {}),
  uebernehmen: (ids: string[]): Promise<SharePointUebernahme> =>
    api.post("/admin/import/sharepoint/apply", { ids }),
};
