// ADMIN-12 · Kommunikationsregeln — der Draht zu `services/app/src/routes/kommunikation-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/kommunikationsregeln.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export type KanalId = "glocke" | "mail" | "push";
export type KanalZustand = "aktiv" | "aus" | "nicht_eingerichtet" | "nicht_angeschlossen";
export type Haeufigkeit = "sofort" | "taeglich";

export type EreignisId =
  | "veroeffentlichung"
  | "veroeffentlichung_hervorgehoben"
  | "kenntnisnahme"
  | "zuweisung"
  | "frische"
  | "reklamation"
  | "wirkung"
  | "loeschantrag"
  | "qualitaet";

export type Zielgruppe =
  | "leser_ohne_veroeffentlicher"
  | "ausgewaehlte_empfaenger"
  | "zugewiesene_pruefer"
  | "verantwortliche_person"
  | "autor"
  | "verwaltung"
  | "leser_mit_sicht";

export interface EreignisUebersicht {
  id: EreignisId;
  zielgruppe: Zielgruppe;
  verbindlich: boolean;
  erinnerung: boolean;
  kanaele: Array<{ kanal: KanalId; zustand: KanalZustand; einstellbar: boolean }>;
  haeufigkeit: Haeufigkeit;
  abwaehlbar: boolean;
  einstellbar: { abwahl: boolean; zusammenfassung: boolean; mail: boolean };
  vorgabe: Vorgabe;
}

export interface RegelUebersicht {
  darfAendern: boolean;
  version: number;
  geaendertVon: { id: string; name: string } | null;
  geaendertAm: string | null;
  mailEingerichtet: boolean;
  ereignisse: EreignisUebersicht[];
}

export interface Vorgabe {
  abwaehlbar: boolean;
  haeufigkeit: Haeufigkeit;
  mail: boolean;
}

export interface RegelFassung {
  version: number;
  vorgaben: Record<EreignisId, Vorgabe>;
  geaendertVon: string | null;
  geaendertAm: string | null;
  name: string;
}

export interface PersoenlicheZeile {
  ereignis: EreignisId;
  abwaehlbar: boolean;
  abgewaehlt: boolean;
  wirksam: boolean;
  verbindlich: boolean;
}

export const KOMMUNIKATION_PFAD = "/kommunikation";

export const kommunikationApi = {
  regeln: () => api.get<RegelUebersicht>("/kommunikation/regeln"),
  speichern: (version: number, vorgaben: Partial<Record<EreignisId, Partial<Vorgabe>>>) =>
    api.put<RegelUebersicht & { geaendert: boolean }>("/admin/kommunikation/regeln", {
      version,
      vorgaben,
    }),
  fassungen: () => api.get<{ fassungen: RegelFassung[] }>("/admin/kommunikation/fassungen"),
  meine: () => api.get<{ zeilen: PersoenlicheZeile[] }>("/meldungsregeln/meine"),
  meineSetzen: (ereignis: EreignisId, abgewaehlt: boolean) =>
    api.put<{ zeilen: PersoenlicheZeile[] }>("/meldungsregeln/meine", { ereignis, abgewaehlt }),
};
