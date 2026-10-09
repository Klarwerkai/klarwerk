// Spaces — der Draht zu `services/app/src/routes/spaces-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/spaces.ts`); sie steht hier ein zweites Mal,
// weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { ApiError, api } from "./client";

/** Der Textschlüssel zu einem Fehler der Space-Routen — Seite und Spacezeile teilen ihn. */
export function spaceFehlerSchluessel(fehler: unknown): string {
  if (!(fehler instanceof ApiError)) {
    return "spaces.fehler.allgemein";
  }
  if (fehler.code === "SPACE_UNGUELTIG") {
    return "spaces.fehler.ungueltig";
  }
  if (fehler.code === "VERSION_VERALTET") {
    return "spaces.fehler.veraltet";
  }
  if (fehler.status === 403) {
    return "spaces.fehler.recht";
  }
  return "spaces.fehler.allgemein";
}

export type SpaceZugang = "alle" | "mitglieder";
export type SpaceRecht = "lesen" | "schreiben";
export type EigenesSpaceRecht = "zustaendig" | "schreiben" | "lesen" | "verwalten" | "keins";

export interface SpaceAnsicht {
  id: string;
  name: string;
  tag: string;
}

export interface SpaceEingabe {
  name: string;
  zweck: string;
  verantwortlich: string;
  zugang: SpaceZugang;
  mitglieder: { nutzer: string; recht: SpaceRecht }[];
  ansichten: { id?: string; name: string; tag: string }[];
  /** produkt:20261009:admin-teams — Teams als Mitgliedschaftsweg. */
  teams?: { team: string; recht: SpaceRecht }[];
}

/** Ein für die Spacepflege wählbares (aktives) Team. */
export interface SpaceTeamWahl {
  id: string;
  name: string;
  zweck: string;
  mitglieder: number;
}

export interface SpaceSicht {
  id: string;
  version: number;
  name: string;
  zweck: string;
  verantwortlich: string;
  verantwortlichName: string | null;
  zugang: SpaceZugang;
  mitglieder: { nutzer: string; recht: SpaceRecht; name: string | null }[];
  ansichten: SpaceAnsicht[];
  /** Gebundene Teams; ein archiviertes Team steht als Verlauf da und gewährt nichts mehr. */
  teams?: { team: string; recht: SpaceRecht; name: string | null; archiviert: boolean }[];
  /** Wer über welches aktive Team dabei ist — getrennt von den direkten Mitgliedern. */
  teamMitglieder?: {
    nutzer: string;
    recht: SpaceRecht;
    team: string;
    name: string | null;
    teamName: string | null;
  }[];
  angelegtVon: string;
  angelegtAm: string;
  geaendertVon: string;
  geaendertAm: string;
  eigenesRecht: EigenesSpaceRecht;
  darfBearbeiten: boolean;
  darfInhalteLesen: boolean;
  artikelSichtbar?: number;
}

export interface SpaceKonto {
  id: string;
  name: string;
  role: string;
}

export interface ArtikelZeile {
  id: string;
  version: number;
  title: string;
  statement: string;
  status: string;
  tags: string[];
  spaceId: string | null;
  spaceName: string | null;
}

export interface ArtikelKontext {
  koId: string;
  version: number;
  title: string;
  tags: string[];
  space: {
    id: string;
    name: string;
    zweck: string;
    zugang: SpaceZugang;
    verantwortlich: string;
    verantwortlichName: string | null;
    eigenesRecht: EigenesSpaceRecht;
  } | null;
  artikelVerantwortung: { person: string; name: string | null; art: "owner" | "author-fallback" };
  autor: { person: string; name: string | null };
  darfVerschieben: boolean;
  ziele: { id: string; name: string; zugang: SpaceZugang }[];
}

export interface Rechtevorschau {
  koId: string;
  version: number;
  quelle: { id: string; name: string; version: number } | null;
  ziel: { id: string; name: string; version: number } | null;
  verlieren: { id: string; name: string; role: string }[];
  erhalten: { id: string; name: string; role: string }[];
  unveraendertMitZugang: number;
  autorBehaeltZugang: boolean;
  verantwortlicheBehaeltZugang: boolean;
  bleibt: {
    version: number;
    author: string;
    authorName: string | null;
    originalAuthor: string;
    historyEintraege: number;
    artikelVerantwortung: string;
    artikelVerantwortungName: string | null;
  };
  darfAusfuehren: boolean;
  grund: string | null;
}

const pfad = (id: string): string => `/spaces/${encodeURIComponent(id)}`;

export const spacesApi = {
  liste: () => api.get<{ spaces: SpaceSicht[]; darfAnlegen: boolean }>("/spaces"),
  konten: () => api.get<{ konten: SpaceKonto[] }>("/spaces/konten"),
  teams: () => api.get<{ teams: SpaceTeamWahl[] }>("/spaces/teams"),
  eintrag: (id: string) =>
    api.get<{
      space: SpaceSicht;
      fassungen: {
        version: number;
        geaendertVon: string;
        geaendertVonName: string | null;
        geaendertAm: string;
      }[];
    }>(pfad(id)),
  anlegen: (eingabe: SpaceEingabe) => api.post<SpaceSicht>("/spaces", eingabe),
  aendern: (id: string, version: number, eingabe: SpaceEingabe) =>
    api.put<SpaceSicht>(pfad(id), { ...eingabe, version }),
  artikel: (id: string, ansicht?: string) =>
    api.get<{
      space: { id: string; name: string };
      ansicht: SpaceAnsicht | null;
      artikel: ArtikelZeile[];
    }>(`${pfad(id)}/artikel${ansicht ? `?ansicht=${encodeURIComponent(ansicht)}` : ""}`),
  kontext: (koId: string) =>
    api.get<ArtikelKontext>(`/spaces/kontext/artikel/${encodeURIComponent(koId)}`),
  vorschau: (koId: string, zielSpaceId: string | null) =>
    api.post<Rechtevorschau>("/spaces/verschiebung/vorschau", { koId, zielSpaceId }),
  // Nacharbeit 3: Ziel und Grundlage kommen BEIDE aus der angezeigten Vorschau — nie aus der
  // aktuellen Auswahl. So kann ein späterer Zielwechsel die Übernahme nicht umlenken.
  verschieben: (koId: string, vorschau: Rechtevorschau) =>
    api.post<{ koId: string; version: number; spaceId: string | null }>("/spaces/verschiebung", {
      koId,
      zielSpaceId: vorschau.ziel?.id ?? null,
      basis: {
        quelleId: vorschau.quelle?.id ?? null,
        quelleVersion: vorschau.quelle?.version ?? null,
        zielId: vorschau.ziel?.id ?? null,
        zielVersion: vorschau.ziel?.version ?? null,
      },
    }),
};
