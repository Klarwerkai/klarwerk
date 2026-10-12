// BPA-16 · Gesprächsaussagen mit Folien verbinden — der Draht zu
// `services/app/src/routes/meeting-dokumentbezug-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/meeting-dokumentbezug.ts`, gefilterte Sichten);
// sie steht hier ein zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird
// beides gemeinsam. Dateien (PPTX, WebVTT) gehen über den vorhandenen Objektweg `POST /api/objects`.
import { api } from "./client";

export const BESPRECHUNGEN_PFAD = "/besprechungen";

export const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const VTT_MIME = "text/vtt";

export type Schutzstufe = "intern" | "vertraulich" | "streng_vertraulich";
export const SCHUTZSTUFEN: readonly Schutzstufe[] = ["intern", "vertraulich", "streng_vertraulich"];

export type RueckmeldungsArt =
  | "beschlossene_korrektur"
  | "vorschlag"
  | "verworfener_vorschlag"
  | "offene_frage"
  | "ki_empfehlung";

/** Was der Nutzer selbst anlegen darf (KI-Empfehlungen entstehen nicht über diesen Weg). */
export const ARTEN_AUS_GESPRAECH = ["beschlossene_korrektur", "vorschlag", "offene_frage"] as const;

export interface Folienziel {
  dateiId: string;
  fassung: string;
  sldId: string;
}

export type FolienSicht =
  | {
      lesbar: true;
      dateiId: string;
      fassung: string;
      quelleId: string;
      sldId: string;
      titel: string;
      position: number;
      notizen: string | null;
    }
  | { lesbar: false };

export interface AenderungsSicht {
  id: string;
  art: "beschlossene_korrektur" | "vorschlag" | "ki_empfehlung";
  status: "offen" | "wartet_auf_klaerung" | "fassung_pruefen" | "ausgefuehrt" | "verworfen";
  bindungVersion: number;
  ziel: Folienziel | null;
  zielQuelleId: string | null;
  zielVerborgen: boolean;
}

export interface BindungsSicht {
  version: number;
  status: "gebunden" | "klaerung_noetig";
  grund: string | null;
  geklaertVon: string | null;
  folie: FolienSicht | null;
  kandidaten: { dateiId: string; sldId: string; titel: string }[];
}

export interface RueckmeldungsSicht extends BindungsSicht {
  id: string;
  art: RueckmeldungsArt;
  herkunft: "gespraech" | "ki";
  text: string;
  stelle: { id: string; startMs: number; endMs: number; sprecher: string | null; text: string };
  aenderung: AenderungsSicht | null;
}

export interface Gespraechsstelle {
  id: string;
  startMs: number;
  endMs: number;
  sprecher: string | null;
  text: string;
}

export interface Praesentation {
  dateiId: string;
  quelleId: string;
  /** Name der hochgeladenen Datei (nur für lesbare Präsentationen; `null`, wenn unbekannt). */
  dateiname: string | null;
  fassung: string;
  abgleich: { status: string; originalZugriff: boolean; originalQuelleId?: string };
  folien: { sldId: string; position: number; titel: string; versteckt: boolean }[];
}

export interface Besprechung {
  meetingId: string;
  titel: string;
  eigen: boolean;
  zeitbasis: string;
  version: number;
  praesentationen: Praesentation[];
  mitschriften: { id: string; zeitbasis: string; stellen: Gespraechsstelle[] }[];
  rueckmeldungen: RueckmeldungsSicht[];
}

/** Die rohen Bytes eines Objekts — dorthin führt „Quelle öffnen" (Rechte prüft der Server). */
export function objektAdresse(objectId: string): string {
  return `/api/objects/${encodeURIComponent(objectId)}/raw`;
}

function pfad(meetingId: string, rest = ""): string {
  return `/meetings/${encodeURIComponent(meetingId)}${rest}`;
}

/** Eine Datei als Daten-URL — so nimmt `POST /api/objects` sie an. */
export function alsDatenUrl(datei: File): Promise<string> {
  return new Promise((aufloesen, ablehnen) => {
    const leser = new FileReader();
    leser.onload = () => aufloesen(String(leser.result));
    leser.onerror = () => ablehnen(leser.error ?? new Error("lesen"));
    leser.readAsDataURL(datei);
  });
}

export const besprechungenApi = {
  liste: () =>
    api.get<{ meetings: { meetingId: string; titel: string; version: number }[] }>("/meetings"),
  anlegen: (titel: string, zeitbasis: string, teilnehmer: string[]) =>
    api.post<{ meetingId: string }>("/meetings", { titel, zeitbasis, teilnehmer }),
  lesen: (meetingId: string) => api.get<Besprechung>(pfad(meetingId)),
  /**
   * Lädt eine Datei über den vorhandenen Objektweg hoch. Die Schutzstufe wählt der Mensch; ohne
   * Wahl bleibt sie unbekannt — dann behandelt der Server die Datei geschützt (nur wer sie
   * hochgeladen hat, liest sie). Es wird hier keine Stufe angenommen.
   */
  hochladen: async (datei: File, mime: string, stufe: Schutzstufe | ""): Promise<string> => {
    const ref = await api.post<{ id: string }>("/objects", {
      name: datei.name,
      mime,
      data: await alsDatenUrl(datei),
      kind: "document",
      purpose: "anchor",
      ...(stufe ? { confidentiality: stufe } : {}),
    });
    return ref.id;
  },
  praesentation: (meetingId: string, objectId: string, originalObjectId?: string) =>
    api.post<{ dateiId: string; fassung: string }>(pfad(meetingId, "/praesentationen"), {
      objectId,
      ...(originalObjectId ? { originalObjectId } : {}),
    }),
  mitschrift: (meetingId: string, objectId: string, zeitbasis: string) =>
    api.post<{ id: string }>(pfad(meetingId, "/mitschriften"), { objectId, zeitbasis }),
  /** Manuelle Zuordnung: ab dieser Zeitstelle war diese Folie zu sehen. */
  folieAb: (meetingId: string, zeitMs: number, zeitbasis: string, ziel: Folienziel) =>
    api.post<{ angenommen: boolean }>(pfad(meetingId, "/folienwechsel"), {
      quelle: "host",
      zeitMs,
      zeitbasis,
      ...ziel,
    }),
  rueckmeldung: (
    meetingId: string,
    eingabe: { mitschriftId: string; stelleId: string; art: RueckmeldungsArt; text: string },
  ) => api.post<RueckmeldungsSicht>(pfad(meetingId, "/rueckmeldungen"), eingabe),
  einzeln: (meetingId: string, rid: string) =>
    api.get<{ rueckmeldung: RueckmeldungsSicht; historie: BindungsSicht[] }>(
      pfad(meetingId, `/rueckmeldungen/${encodeURIComponent(rid)}`),
    ),
  ausFolie: (meetingId: string, dateiId: string, sldId: string) =>
    api.get<{ rueckmeldungen: RueckmeldungsSicht[] }>(
      pfad(meetingId, `/folien/${encodeURIComponent(dateiId)}/${encodeURIComponent(sldId)}`),
    ),
  ausZeitstelle: (meetingId: string, zeitMs: number) =>
    api.get<{ rueckmeldungen: RueckmeldungsSicht[] }>(pfad(meetingId, `/zeitstellen/${zeitMs}`)),
};
