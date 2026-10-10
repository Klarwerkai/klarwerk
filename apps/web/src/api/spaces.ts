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
  // ADMIN-07
  if (fehler.code === "SPACE_ARCHIVIERT") {
    return "spaces.fehler.archiviert";
  }
  if (fehler.code === "BEGRUENDUNG_FEHLT") {
    return "spaces.fehler.begruendung";
  }
  if (fehler.code === "OFFENE_VERANTWORTUNG") {
    return "spaces.fehler.offeneVerantwortung";
  }
  if (fehler.code === "VORSCHAU_VERALTET") {
    return "spaces.fehler.vorschauVeraltet";
  }
  if (fehler.code === "REGELN_UNGUELTIG") {
    return "spaces.fehler.regelnUngueltig";
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
  /** ADMIN-07: flaches Etikett für die Übersicht — kein Ordner. */
  gruppe?: string;
  /** ADMIN-07: Spaceregeln in Worten. */
  regeln?: string;
}

export type SpaceVorgang = "angelegt" | "geaendert" | "archiviert" | "wiederaufgenommen";

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
  gruppe?: string;
  regeln?: string;
  archiviert: boolean;
  vorgang: SpaceVorgang;
  begruendung?: string;
  /** Personen mit direkter ODER Team-Mitgliedschaft, je Person einmal. */
  mitgliederZahl: number;
}

export interface SpaceZugangsweg {
  art: "zustaendig" | "direkt" | "team" | "offen";
  recht: SpaceRecht;
  team?: string;
  teamName?: string;
}

export interface Zugriffsuebersicht {
  spaceId: string;
  version: number;
  archiviert: boolean;
  zugang: SpaceZugang;
  personen: {
    nutzer: string;
    name: string;
    role: string;
    wege: SpaceZugangsweg[];
    wirksam: EigenesSpaceRecht;
  }[];
  offenWeitere: number;
}

export type Verantwortungsfrage =
  | "zustaendig_ohne_konto"
  | "verantwortung_ohne_konto"
  | "verantwortung_ohne_zugang";

export interface ArchivFolgen {
  spaceId: string;
  name: string;
  version: number;
  archiviert: boolean;
  leserBleiben: number;
  schreibenEntfaellt: { id: string; name: string }[];
  artikel: {
    gesamt: number;
    offen: number;
    offenSichtbar: { id: string; title: string; version: number }[];
  };
  verantwortungsfragen: {
    art: Verantwortungsfrage;
    anzahl: number;
    artikel: { id: string; title: string }[];
  }[];
  darfArchivieren: boolean;
  grund: string | null;
  grundlage: string;
}

export type BestandsAusnahme =
  | "mehrdeutig"
  | "erweitert"
  | "autor_verliert"
  | "verantwortung_verliert"
  | "verwaist";

export interface BestandsRegel {
  tag: string;
  zielSpaceId: string;
}

export interface BestandsPlan {
  regeln: { tag: string; zielSpaceId: string; zielName: string; zielVersion: number }[];
  bilanz: {
    gesamt: number;
    bereitsZugeordnet: number;
    ohneSpace: number;
    zuordenbar: number;
    ausnahmen: number;
    ohneRegel: number;
  };
  zuordnungen: {
    koId: string;
    version: number;
    title: string | null;
    zielSpaceId: string;
    zielName: string;
    verlieren: number;
  }[];
  ausnahmen: { koId: string; title: string | null; art: BestandsAusnahme; ziele: string[] }[];
  grundlage: string;
}

export interface BestandsErgebnis {
  bilanz: BestandsPlan["bilanz"] & { zugeordnet: number; fehlgeschlagen: number };
  zugeordnet: { koId: string; zielSpaceId: string }[];
  ausnahmen: BestandsPlan["ausnahmen"];
  fehlgeschlagen: { koId: string; grund: string }[];
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
  /** ADMIN-07 (K4): die Regeln vorher und nachher. */
  regeln?: { quelle: RegelSicht | null; ziel: RegelSicht | null };
  darfAusfuehren: boolean;
  grund: string | null;
  /** ADMIN-07 Nacharbeit 3 (K4): bindet die Bestätigung an die wirksame Rechtelage. */
  grundlage: string;
}

export interface RegelSicht {
  zugang: SpaceZugang;
  regeln: string | null;
  verantwortlich: string;
  verantwortlichName: string | null;
}

const pfad = (id: string): string => `/spaces/${encodeURIComponent(id)}`;

export const spacesApi = {
  liste: () =>
    api.get<{ spaces: SpaceSicht[]; darfAnlegen: boolean; darfBestandZuordnen?: boolean }>(
      "/spaces",
    ),
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
        vorgang: SpaceVorgang;
        begruendung: string | null;
      }[];
    }>(pfad(id)),
  // ADMIN-07
  zugriff: (id: string) => api.get<Zugriffsuebersicht>(`${pfad(id)}/zugriff`),
  archivVorschau: (id: string) => api.post<ArchivFolgen>(`${pfad(id)}/archivierung/vorschau`, {}),
  archivieren: (id: string, folgen: ArchivFolgen, begruendung: string) =>
    api.post<SpaceSicht>(`${pfad(id)}/archivieren`, {
      version: folgen.version,
      grundlage: folgen.grundlage,
      begruendung,
    }),
  wiederaufnehmen: (id: string, version: number, begruendung: string) =>
    api.post<SpaceSicht>(`${pfad(id)}/wiederaufnehmen`, { version, begruendung }),
  bestandVorschau: (regeln: BestandsRegel[]) =>
    api.post<BestandsPlan>("/spaces/bestand/vorschau", { regeln }),
  bestandZuordnen: (regeln: BestandsRegel[], plan: BestandsPlan) =>
    api.post<BestandsErgebnis>("/spaces/bestand/zuordnung", {
      regeln,
      grundlage: plan.grundlage,
    }),
  bestandProtokoll: () =>
    api.get<{
      laeufe: {
        wer: string;
        am: string;
        bilanz: BestandsErgebnis["bilanz"];
        zugeordnet: { koId: string; zielSpaceId: string }[];
        ausnahmen: { koId: string; art: BestandsAusnahme }[];
      }[];
    }>("/spaces/bestand/protokoll"),
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
        grundlage: vorschau.grundlage,
      },
    }),
};
