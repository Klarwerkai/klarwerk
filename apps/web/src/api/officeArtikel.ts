// Office im Artikel — der Draht zu `services/app/src/routes/office-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/office-artikel.ts`); sie steht hier ein zweites
// Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { ApiError, api } from "./client";

export type OfficeSchreibweg = "direkt" | "vorschlag" | "nur-lesen" | "kein-zugang";

export interface OfficeAnhangFassung {
  version: number;
  at: string;
  author: string;
  objectId: string;
  aktuell: boolean;
  restoredFrom?: number;
}

export interface OfficeBelegstelle {
  quelleId: string;
  label: string;
  excerpt: string | null;
  stand: "aktuell" | "frueher";
  ausFassung?: number;
  // R-0205: Prüfstand der Quelle (services/app/src/office-artikel.ts). Fehlt er in einer Antwort,
  // gilt die Belegstelle als ungeprüft — dieselbe Regel wie `ExterneQuelleKennung`.
  peerValidated?: boolean;
}

export interface OfficeAnhangLage {
  anwendung: "word" | "excel" | "powerpoint";
  endung: string;
  bearbeitbar: boolean;
  schreibweg: OfficeSchreibweg;
  editorEingerichtet: boolean;
  fassung: number;
  status: string;
  verlauf: OfficeAnhangFassung[];
  belegstellen: OfficeBelegstelle[];
  sitzung: { laeuft: false } | { laeuft: true; basisFassung: number; arbeitsstandOffen: boolean };
  gesichert: { objectId: string; at: string; eigen: boolean }[];
}

export interface OfficeSitzung {
  editorUrl: string;
  editorHerkunft: string;
  accessToken: string;
  accessTokenTtl: number;
  schreibweg: OfficeSchreibweg;
  fassung: number;
}

export interface OfficeFassungsErgebnis {
  fassung: number;
  status: string;
  belegOffen?: boolean;
}

const pfad = (koId: string, anhangId: string) =>
  `/kos/${encodeURIComponent(koId)}/office/${encodeURIComponent(anhangId)}`;

export const officeArtikel = {
  lage: (koId: string, anhangId: string) => api.get<OfficeAnhangLage>(pfad(koId, anhangId)),
  sitzung: (koId: string, anhangId: string) =>
    api.post<OfficeSitzung>(`${pfad(koId, anhangId)}/sitzung`),
  uebernahme: (koId: string, anhangId: string) =>
    api.post<OfficeFassungsErgebnis>(`${pfad(koId, anhangId)}/uebernahme`),
  zurueckholen: (koId: string, anhangId: string, ausFassung: number, expectedVersion: number) =>
    api.post<OfficeFassungsErgebnis>(`${pfad(koId, anhangId)}/zurueckholen`, {
      ausFassung,
      expectedVersion,
    }),
  gesichert: (koId: string, anhangId: string, objectId: string, expectedVersion: number) =>
    api.post<OfficeFassungsErgebnis>(`${pfad(koId, anhangId)}/gesichert`, {
      objectId,
      expectedVersion,
    }),
};

/** Office-Endungen wie `OFFICE_FORMATE` am Server; die Entscheidung trifft dort der Server. */
const OFFICE_ENDUNGEN = new Set(["docx", "xlsx", "pptx", "doc", "xls", "ppt"]);

export function istOfficeAnhang(name: string): boolean {
  const punkt = name.lastIndexOf(".");
  return punkt > 0 && OFFICE_ENDUNGEN.has(name.slice(punkt + 1).toLowerCase());
}

/** Der Textschlüssel zu einem Fehler der Office-Routen. Unbekanntes wird nie als Erfolg gelesen. */
export function officeFehlerSchluessel(fehler: unknown): string {
  if (!(fehler instanceof ApiError)) {
    return "officeartikel.fehler.netz";
  }
  switch (fehler.code) {
    case "OFFICE_EDITOR_NICHT_EINGERICHTET":
      return "officeartikel.fehler.nichtEingerichtet";
    case "OFFICE_EDITOR_NICHT_ERREICHBAR":
      return "officeartikel.fehler.nichtErreichbar";
    case "OFFICE_FORMAT_NICHT_ANGEBOTEN":
      return "officeartikel.fehler.formatNichtAngeboten";
    case "KO_STALE":
      return "officeartikel.fehler.konflikt";
    case "OFFICE_KEINE_SITZUNG":
      return "officeartikel.fehler.keineSitzung";
    case "OFFICE_NICHTS_GESPEICHERT":
      return "officeartikel.fehler.nichtsGespeichert";
    case "OFFICE_SITZUNG_LAEUFT":
      return "officeartikel.fehler.sitzungLaeuft";
    case "PROPOSAL_REQUIRED":
      return "officeartikel.fehler.freigegeben";
    default:
      return fehler.status === 403 || fehler.status === 404
        ? "officeartikel.fehler.keinRecht"
        : "officeartikel.fehler.allgemein";
  }
}
