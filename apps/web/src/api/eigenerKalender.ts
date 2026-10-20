// produkt:20261010:klara-eigener-kalender (AW-16) · der Draht zu
// `services/app/src/routes/eigener-kalender-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/eigener-kalender.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export type KalenderBereich = "persoenlich" | "team";
export type KalenderArt = "termin" | "frist" | "aufgabe";
export type KalenderStatus = "offen" | "erledigt" | "abgesagt";
export type LaufStatus =
  | "geplant"
  | "laeuft"
  | "abgeschlossen"
  | "fehlgeschlagen"
  | "abgesagt"
  | "abgebrochen";
export type ErgebnisArt =
  | "erinnerung_zugestellt"
  | "bericht_gespeichert"
  | "lauf_abgeschlossen"
  | "lauf_fehlgeschlagen";
export type Sichtmodus = "eigen" | "vorhanden" | "beide";
export type KalenderAktion =
  | "anzeige_entfernen"
  | "anzeige_zeigen"
  | "lauf_absagen"
  | "serie_pausieren"
  | "serie_fortsetzen"
  | "arbeit_abbrechen";

export const KALENDER_ARTEN: readonly KalenderArt[] = ["termin", "frist", "aufgabe"];
export const KALENDER_STATUS: readonly KalenderStatus[] = ["offen", "erledigt", "abgesagt"];
export const SICHTMODI: readonly Sichtmodus[] = ["eigen", "vorhanden", "beide"];

export interface KalenderSicht {
  id: string;
  bereich: KalenderBereich;
  teamId: string | null;
  teamName: string | null;
  verantwortlich: string | null;
  zugeordnet: boolean;
  art: KalenderArt;
  titel: string | null;
  notiz: string | null;
  ganztaegig: boolean;
  beginn: string;
  ende: string | null;
  zeitzone: string;
  herkunft: { art: "eigen" | "wissensobjekt"; koId: string | null };
  geschuetzt: boolean;
  status: KalenderStatus;
  fristId: string | null;
  /** Titel und `aufgeloest` stammen aus dem Ausführungsnachweis, nicht aus dem Kalender. */
  auftrag: { taskId: string; titel: string | null; aufgeloest: boolean } | null;
  /** `pausiert: null` — der Stand ist nicht nachgewiesen. */
  serie: { seriesId: string; pausiert: boolean | null } | null;
  /** `status: null` — der Stand ist nicht nachgewiesen. */
  lauf: { runId: string; status: LaufStatus | null } | null;
  ergebnis: { art: ErgebnisArt; am: string } | null;
  ausgeblendet: boolean;
  eigen: boolean;
  darfSteuern: boolean;
  angelegtAm: string;
  geaendertAm: string;
  fassung: number;
}

/** Ein Termin des vorhandenen Kalenders — nur gelesen. */
export interface ExternerTermin {
  id: string;
  titel: string;
  ganztaegig: boolean;
  beginn: string;
  ende: string | null;
}

export interface KalenderAnsicht {
  bereich: KalenderBereich;
  sichtmodus: Sichtmodus;
  vorhandenerKalender: { verbunden: boolean; termine: ExternerTermin[] };
  ausfuehrungAngebunden: boolean;
  aufgabenAngebunden: boolean;
  teams: { id: string; name: string }[];
  eintraege: KalenderSicht[];
  ausgeblendet: number;
}

export interface KalenderFolgen {
  aktion: KalenderAktion;
  moeglich: boolean;
  hinderung: string | null;
  betroffeneEintraege: number;
  umkehrbar: boolean;
  bleibt: string[];
  /** Die Wirkung tritt beim Ausführungsdienst ein und gilt erst mit seiner Bestätigung. */
  ausfuehrung: boolean;
}

/** Was das Formular schickt. Beim Ändern trägt es zusätzlich die gesehene `fassung`. */
export interface KalenderEingabe {
  bereich?: KalenderBereich;
  teamId?: string;
  verantwortlich?: string | null;
  art: KalenderArt;
  titel: string;
  notiz: string | null;
  ganztaegig: boolean;
  beginn: string;
  ende: string | null;
  zeitzone: string;
  status?: KalenderStatus;
}

export const KALENDER_PFAD = "/kalender";

const eintrag = (id: string): string => `/me/kalender/eintraege/${encodeURIComponent(id)}`;

export const eigenerKalenderApi = {
  ansicht: (bereich: KalenderBereich, ausgeblendete: boolean) =>
    api.get<KalenderAnsicht>(
      `/me/kalender?bereich=${bereich}${ausgeblendete ? "&ausgeblendete=1" : ""}`,
    ),
  sichtWaehlen: (sichtmodus: Sichtmodus) =>
    api.put<{ einstellungen: { sichtmodus: Sichtmodus } }>("/me/kalender/einstellungen", {
      sichtmodus,
    }),
  anlegen: (eingabe: KalenderEingabe) =>
    api.post<{ eintrag: KalenderSicht }>("/me/kalender/eintraege", eingabe),
  oeffnen: (id: string) => api.get<{ eintrag: KalenderSicht }>(eintrag(id)),
  aendern: (id: string, eingabe: KalenderEingabe & { fassung: number }) =>
    api.put<{ eintrag: KalenderSicht }>(eintrag(id), eingabe),
  loeschen: (id: string) => api.del<{ geloescht: number }>(eintrag(id)),
  folgen: (id: string, aktion: KalenderAktion) =>
    api.post<{ folgen: KalenderFolgen }>(`${eintrag(id)}/folgen`, { aktion }),
  handeln: (id: string, aktion: KalenderAktion) =>
    api.post<{ eintrag: KalenderSicht; folgen: KalenderFolgen }>(`${eintrag(id)}/aktionen`, {
      aktion,
      bestaetigt: true,
    }),
};
