// Freigaberegeln je Space (produkt:20261009:admin-freigaberegeln, ADMIN-09) — der Draht zu
// `services/app/src/routes/freigaberegeln-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/freigaberegel-dienst.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { ApiError, api } from "./client";

export interface FreigabeRegelEingabe {
  zustimmungen: number;
  pruefer: string[];
  prueferTeams: string[];
  fristTage: number | null;
  vertretungen: { fuer: string; durch: string }[];
}

export interface RegelSicht {
  zustimmungen: number;
  fristTage: number | null;
  pruefer: { id: string; name: string | null }[];
  prueferTeams: { id: string; name: string | null; archiviert: boolean }[];
  vertretungen: VertretungSicht[];
}

export interface VertretungSicht {
  fuer: string;
  fuerName: string | null;
  durch: string;
  durchName: string | null;
}

export type PrueferWeg = "alle" | "konto" | "team" | "vertretung";
export type PrueferHindernis = "inaktiv" | "ohne_pruefrecht" | "ohne_spacezugang";

export interface PrueferZeile {
  id: string;
  name: string;
  role: string;
  wege: PrueferWeg[];
  teams: { id: string; name: string }[];
  vertritt: { id: string; name: string | null }[];
  aktiv: boolean;
  berechtigt: boolean;
  hindernis: PrueferHindernis | null;
  /** Jetzt im Space entscheidungsbefugt (eine Vertretung erst, wenn sie eingesetzt ist). */
  entscheidet: boolean;
  /** Berechtigt, aber nur bereitstehende Vertretung — entscheidet erst nach Übergabe. */
  bereitstehendeVertretung: boolean;
}

export type Voraussetzung =
  | { art: "keine_regel" }
  | { art: "space_archiviert" }
  | { art: "zu_wenige_pruefer"; berechtigt: number; erforderlich: number }
  | { art: "pruefer_ohne_wirkung"; personen: { id: string; name: string; hindernis: string }[] }
  | ({ art: "vertretung_ohne_wirkung"; hindernis: string } & VertretungSicht)
  | { art: "team_archiviert"; team: string; name: string | null };

export type Vorgangszustand =
  | "entwurf"
  | "eingereicht"
  | "korrektur_noetig"
  | "freigegeben"
  | "veroeffentlicht";

export type VorgangsLuecke =
  | { art: "zustimmungen_fehlen"; anzahl: number }
  | { art: "ablehnung_offen"; anzahl: number }
  | { art: "zu_wenige_unabhaengige_pruefer"; verfuegbar: number; erforderlich: number }
  | { art: "aufgabe_ueberfaellig"; person: string; name: string | null };

export interface Entscheidung {
  art: "zustimmung" | "rueckfrage" | "ablehnung" | "admin_kennzeichnung" | "eigentuemerfreigabe";
  person: string;
  name: string | null;
  am: string;
  fassung: number | null;
  aktuell: boolean;
  ausnahme: boolean;
  selbst: boolean;
}

export interface Pruefaufgabe {
  person: string;
  name: string | null;
  seit: string;
  faelligAm: string | null;
  ueberfaellig: boolean;
  aktiv: boolean;
  vertretungFuer: string | null;
  vertretungFuerName: string | null;
}

export interface Vorgang {
  id: string;
  title: string;
  version: number;
  status: string;
  zustand: Vorgangszustand;
  autor: { id: string; name: string | null };
  zustimmungen: {
    gruen: number;
    gelb: number;
    rot: number;
    veraltet: number;
    erforderlich: number;
  };
  veroeffentlichteFassung: number | null;
  aufgaben: Pruefaufgabe[];
  entscheidungen: Entscheidung[];
  luecken: VorgangsLuecke[];
}

export interface RegelUebersicht {
  space: {
    id: string;
    name: string;
    version: number;
    archiviert: boolean;
    verantwortlich: string;
    verantwortlichName: string | null;
  };
  regel: RegelSicht | null;
  standardZustimmungen: number;
  gruppe: "gruppe" | "alle";
  schritte: { art: string; anzahl?: number }[];
  selbstpruefung: "ausgeschlossen";
  ausnahmewege: { art: "admin_kennzeichnung" | "eigentuemerfreigabe"; recht: string }[];
  pruefer: PrueferZeile[];
  voraussetzungen: Voraussetzung[];
  vorgaenge: Vorgang[];
  vorgaengeGesamt: number;
  vorgaengeVerborgen: number;
  verlauf: {
    version: number;
    am: string;
    von: string;
    vonName: string | null;
    begruendung: string | null;
    regel: RegelSicht | null;
  }[];
  darfAendern: boolean;
  stand: string;
}

export type RegelAenderung = "neu" | "zustimmungen" | "pruefer" | "teams" | "frist" | "vertretung";

export interface RegelVorschau {
  spaceId: string;
  spaceVersion: number;
  alt: RegelSicht | null;
  neu: RegelSicht | null;
  aenderungen: RegelAenderung[];
  laufend: {
    gesamt: number;
    angehoben: number;
    gesenkt: number;
    unveraendert: number;
    eintraege: {
      id: string;
      title: string;
      version: number;
      bisher: number;
      danach: number;
      gruen: number;
      schwelleErreicht: boolean;
    }[];
    verborgen: number;
  };
  freigegeben: { gesamt: number; verborgen: number };
  pruefer: {
    neu: { id: string; name: string | null }[];
    entfaellt: { id: string; name: string | null; offeneAufgaben: number }[];
    /** Nach der neuen Regel nur bereitstehende Vertretungen (entscheiden erst nach Übergabe). */
    bereit: { id: string; name: string }[];
  };
  voraussetzungenDanach: Voraussetzung[];
  grundlage: string;
}

export interface Fristlauf {
  regel: boolean;
  neu: {
    koId: string;
    durch: string;
    fuer: string;
    title: string | null;
    durchName: string | null;
    fuerName: string | null;
  }[];
  bestehend: number;
  faellig: {
    koId: string;
    person: string;
    grund: "ueberfaellig" | "inaktiv";
    title: string | null;
    name: string | null;
  }[];
  ohneVertretung: { koId: string; fuer: string; title: string | null; fuerName: string | null }[];
}

/** Der Textschlüssel zu einem Fehler der Freigaberegel-Routen. */
export function freigabeFehlerSchluessel(fehler: unknown): string {
  if (!(fehler instanceof ApiError)) {
    return "freigaberegeln.fehler.allgemein";
  }
  switch (fehler.code) {
    case "FREIGABEREGEL_UNGUELTIG":
      return "freigaberegeln.fehler.ungueltig";
    case "VORSCHAU_VERALTET":
      return "freigaberegeln.fehler.vorschauVeraltet";
    case "VERSION_VERALTET":
      return "freigaberegeln.fehler.veraltet";
    case "SPACE_ARCHIVIERT":
      return "freigaberegeln.fehler.archiviert";
    case "KEINE_AENDERUNG":
      return "freigaberegeln.fehler.keineAenderung";
    default:
      return fehler.status === 403
        ? "freigaberegeln.fehler.recht"
        : "freigaberegeln.fehler.allgemein";
  }
}

const pfad = (id: string): string => `/spaces/${encodeURIComponent(id)}/freigaberegel`;

export const freigaberegelnApi = {
  uebersicht: (spaceId: string) => api.get<RegelUebersicht>(pfad(spaceId)),
  vorschau: (spaceId: string, regel: FreigabeRegelEingabe) =>
    api.post<RegelVorschau>(`${pfad(spaceId)}/vorschau`, { regel }),
  // Version und Grundlage kommen aus der GEZEIGTEN Vorschau — nie aus der aktuellen Eingabe allein.
  uebernehmen: (
    spaceId: string,
    regel: FreigabeRegelEingabe,
    vorschau: RegelVorschau,
    begruendung: string,
  ) =>
    api.put<RegelUebersicht & { angehoben: number }>(pfad(spaceId), {
      version: vorschau.spaceVersion,
      regel,
      grundlage: vorschau.grundlage,
      begruendung,
    }),
  fristlauf: (spaceId: string) => api.post<Fristlauf>(`${pfad(spaceId)}/fristlauf`, {}),
};
