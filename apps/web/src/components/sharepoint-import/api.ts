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

// ================================================================================================
// JOB 4232 — DIE BEFUNDE ÜBER DEN INHALT, AUF DER LEITUNG.
// ================================================================================================
//
// Sie stehen HIER und nicht als Import aus `services/sharepoint`: Die Oberfläche darf aus
// `services/` nichts holen (Wächter `tests/capture/draft-limits-shared.test.ts`), und die Drahtform
// ist ohnehin eine eigene Zusage — sie beschreibt, was über die Leitung kommt, nicht, wie der Server
// es intern nennt. Dass beide Seiten dieselben Wörter führen, hält `tests/sharepoint-inhalt/` fest.
//
// „nur-merkmale" ist der Regelfall und nicht der Ausnahmefall: Er gilt für jeden Dateityp ausser
// `text/plain`.

/** Was die MERKMALE einer Datei über ihren Inhalt hergeben — die Auskunft VOR der Annahme. */
export type SharePointInhaltsvorschau = "text" | "leer" | "nur-merkmale" | "zu-gross";

/** Was aus dem Inhalt WIRKLICH geworden ist. `unlesbar` zeigt sich erst am gelesenen Byte. */
export type SharePointInhaltsbefund = SharePointInhaltsvorschau | "unlesbar";

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
  /**
   * JOB 4232 — was diese Zeile bei einer Übernahme bringt. Sie ruht auf dem Medientyp und der Grösse
   * aus DIESEM Abruf; scheitert die Auffrischung, verschwindet die ganze Liste und mit ihr diese
   * Zusage (`SharePointImportBereich.tsx`, Fehler VOR Daten).
   */
  inhaltstyp: SharePointInhaltsvorschau;
}

/**
 * JOB 4232 R2 — DER GEMESSENE BEFUND EINER EINZELNEN DATEI.
 *
 * Er entsteht erst, wenn der Inhalt WIRKLICH geholt wurde. Das ist der Unterschied zu
 * `SharePointDateiZeile.inhaltstyp`: der ist eine Ankündigung aus den Merkmalen, dieser hier ist
 * ein Messwert. Verspricht die Ankündigung Text und scheitert der Abruf, gilt DIESER.
 */
export interface SharePointInhaltsprobe {
  id: string;
  befund: SharePointInhaltsbefund;
}

export interface SharePointDateiliste {
  dateien: SharePointDateiZeile[];
  /** Es gäbe weitere, ungelesene Einträge — die Liste gibt sich nie für „alles" aus. */
  truncated: boolean;
  /** `true`, wenn nach BEFUNDEN gefragt wurde: dann ist `dateien: []` keine Aussage über den Bestand. */
  nurBefunde: boolean;
  /** Immer geführt — leer heisst „danach war nicht gefragt", nicht „Feld fehlt". */
  befunde: SharePointInhaltsprobe[];
}

/** Eine wirklich übernommene Datei. Schmaler als die Listenzeile: die Grösse ist hier nicht gemessen. */
export interface SharePointUebernommen {
  id: string;
  name: string;
  url: string | null;
  geaendertAm: string | null;
  /**
   * JOB 4232 — was WIRKLICH übernommen wurde, gemessen an diesem Abruf. Nur zwei Werte kommen hier
   * an: `text` (der Inhalt ist mitgekommen) und `nur-merkmale`. Die drei übrigen Befunde führen zu
   * gar keiner Übernahme und stehen deshalb in `ohneInhalt`.
   */
  inhalt: Extract<SharePointInhaltsbefund, "text" | "nur-merkmale">;
}

/** Eine Datei, deren Inhalt gemessen wurde und nicht trägt — sie ist NICHT übernommen worden. */
export interface SharePointOhneInhalt {
  id: string;
  befund: Extract<SharePointInhaltsbefund, "leer" | "zu-gross" | "unlesbar">;
}

export interface SharePointUebernahme {
  imported: number;
  alreadyQueued: number;
  /**
   * JOB 4125 — die Teilmenge von `imported`, die einen NEUEREN Stand einer bereits wartenden Quelle
   * gebracht hat. JOB 4232 holt das Feld aus `SharePointImportBereich.tsx` hierher, wo es hingehört:
   * dort stand es als lokale Typerweiterung, weil `api.ts` damals ausserhalb der Zielpfade lag
   * (Begründung dort, REST der Runde 4125). Jetzt gibt es dafür EINE Stelle statt zwei.
   */
  neuerStand: string[];
  failed: { id: string; reason: string }[];
  notFound: string[];
  /** JOB 4232: immer geführt — eine leere Liste heisst „kein solcher Fall", nicht „Feld fehlt". */
  ohneInhalt: SharePointOhneInhalt[];
  dateien: SharePointUebernommen[];
  importId?: string;
}

export const sharepointApi = {
  zugang: (): Promise<SharePointZugang> => api.get("/import/sharepoint/zugang"),
  dateien: (folderId?: string): Promise<SharePointDateiliste> =>
    api.post("/admin/import/sharepoint/files", folderId ? { folderId } : {}),
  /**
   * JOB 4232 R2: der GEMESSENE Inhaltsbefund für genau diese Dateien — dieselbe lesende Adresse,
   * andere Frage (Begründung in `sharepoint-import-routes.ts`). Sie schreibt nichts.
   */
  inhalte: (ids: string[]): Promise<SharePointDateiliste> =>
    api.post("/admin/import/sharepoint/files", { ids }),
  uebernehmen: (ids: string[]): Promise<SharePointUebernahme> =>
    api.post("/admin/import/sharepoint/apply", { ids }),
};
