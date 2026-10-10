// Vorlagen — der Draht zu `services/app/src/routes/vorlagen-routes.ts`
// (produkt:20261007:templates-default · ADMIN-08).
//
// Die Gestalt ist die des Servers (`services/app/src/vorlagen.ts`); sie steht hier ein zweites Mal,
// weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam. Die Feldstruktur
// selbst (`StrukturFeld`) teilen beide Seiten über `lib/vorlagenStruktur.ts`.
import type { StrukturFeld } from "../lib/vorlagenStruktur";
import { ApiError, api } from "./client";

export type VorlagenGeltung = "standard" | "persoenlich" | "space" | "unternehmen";
export type EigeneGeltung = Exclude<VorlagenGeltung, "standard">;

export interface VorlageSicht {
  id: string;
  version: number;
  name: string;
  beschreibung: string;
  sprachen?: Partial<Record<"en" | "nl", { name: string; beschreibung?: string }>>;
  geltung: VorlagenGeltung;
  spaceId?: string;
  spaceName: string | null;
  felder: StrukturFeld[];
  eigentuemer: string;
  eigentuemerName: string | null;
  geaendertVon: string;
  geaendertAm: string;
  vorgang: "angelegt" | "geaendert" | "geteilt" | "ausgemustert";
  ausgemustert: boolean;
  begruendung?: string;
  darfBearbeiten: boolean;
  darfAnwenden: boolean;
  istStandard: boolean;
}

export interface VorlagenListe {
  vorlagen: VorlageSicht[];
  standardId: string | null;
  spaces: { id: string; name: string }[];
  darf: { anlegen: boolean; unternehmen: boolean; verwalten: boolean };
  vorgabenSpaces: { id: string; name: string; archiviert: boolean }[];
}

export interface SpaceVorgabe {
  spaceId: string;
  version: number;
  verbindlicheVorlageId: string | null;
  kategorien: string[];
  pflichtKategorie: boolean;
  mindestensTags: number;
  tags: string[];
  hinweis: string;
  geaendertVon: string;
  geaendertAm: string;
}

export type SpaceVorgabeEingabe = Pick<
  SpaceVorgabe,
  | "verbindlicheVorlageId"
  | "kategorien"
  | "pflichtKategorie"
  | "mindestensTags"
  | "tags"
  | "hinweis"
>;

export interface StartWahl {
  vorlage: VorlageSicht | null;
  quelle: "space" | "persoenlich" | "frei";
  grund: string;
  ersatzFuer: {
    id: string;
    name: string | null;
    grund: "ausgemustert" | "nicht_verfuegbar";
  } | null;
  verdraengt: { id: string; name: string } | null;
  space: { id: string; name: string } | null;
  vorgabe: SpaceVorgabe | null;
  verbindlichNichtVerfuegbar: boolean;
}

export interface PflichtBefund {
  art:
    | "vorlagenfeld"
    | "kategorie_fehlt"
    | "kategorie_nicht_erlaubt"
    | "tags_fehlen"
    | "begriff_ersetzt"
    | "begriff_ausgemustert";
  wert: string;
  meldung: string;
}

export interface VorlagenBezug {
  id: string;
  version: number;
  spaceId?: string | null;
}

export interface VorlageEingabe {
  name: string;
  beschreibung: string;
  geltung: EigeneGeltung;
  spaceId?: string;
  felder: StrukturFeld[];
}

export interface NutzungsUmfang {
  gesamt: number;
  jeVersion: { version: number; anzahl: number }[];
  jeSpace: { spaceId: string | null; name: string | null; anzahl: number }[];
}

export interface Aenderungswirkung {
  vorlageId: string;
  version: number;
  felder: {
    neu: string[];
    entfernt: string[];
    umbenannt: { vorher: string; nachher: string }[];
    pflichtNeu: string[];
    pflichtEntfallen: string[];
  };
  geltung: {
    vorher: VorlagenGeltung;
    nachher: VorlagenGeltung;
    spaceVorher: string | null;
    spaceNachher: string | null;
  };
  nutzung: NutzungsUmfang;
  standardBei: number;
  verbindlichIn: { spaceId: string; name: string }[];
  bestand: string;
}

export interface VorlagenFassung
  extends Omit<
    VorlageSicht,
    "darfBearbeiten" | "darfAnwenden" | "istStandard" | "eigentuemerName"
  > {
  geaendertVonName: string | null;
}

export interface NutzungAuskunft {
  koId: string;
  nutzung: {
    vorlageId: string;
    version: number;
    name: string;
    am: string;
    aktuelleVersion: number | null;
    ausgemustert: boolean;
    felder: StrukturFeld[] | null;
  } | null;
}

export interface BegriffZeile {
  name: string;
  gesamt: number;
  jeSpace: { spaceId: string | null; name: string | null; anzahl: number }[];
  vorgegebenIn: { spaceId: string; name: string | null }[];
}

export interface BegriffEintrag {
  schluessel: string;
  version: number;
  art: "tag" | "kategorie";
  name: string;
  status: "ersetzt" | "ausgemustert";
  ersatz: string | null;
  spaceId: string | null;
  vorgang: "umbenennen" | "zusammenfuehren" | "ausmustern";
  begruendung: string;
  geaendertVon: string;
  geaendertAm: string;
}

export interface Verwaltung {
  vorlagen: {
    id: string;
    name: string;
    geltung: VorlagenGeltung;
    spaceId: string | null;
    spaceName: string | null;
    version: number;
    ausgemustert: boolean;
    pflichtfelder: string[];
    nutzung: NutzungsUmfang;
    standardBei: number;
    verbindlichIn: { spaceId: string; name: string | null }[];
  }[];
  persoenlich: { vorlagen: number; beitraege: number };
  kategorien: BegriffZeile[];
  tags: BegriffZeile[];
  nichtEinsehbar: number;
  spaceVorgaben: {
    spaceId: string;
    name: string;
    archiviert: boolean;
    vorgabe: SpaceVorgabe | null;
  }[];
  begriffe: BegriffEintrag[];
}

export interface BegriffsAuftrag {
  art: "tag" | "kategorie";
  vorgang: "umbenennen" | "zusammenfuehren" | "ausmustern";
  name: string;
  ziel?: string;
  spaceId?: string | null;
  begruendung: string;
}

export interface BegriffsPlan {
  auftrag: BegriffsAuftrag & { ziel: string | null; spaceId: string | null };
  zielVorhanden: boolean;
  betroffen: {
    koId: string;
    version: number;
    title: string | null;
    spaceId: string | null;
    vorher: string[];
    nachher: string[];
  }[];
  jeSpace: { spaceId: string | null; name: string | null; betroffen: number; ausserhalb: number }[];
  unberuehrt: number;
  ansichten: { spaceId: string; spaceName: string; ansicht: string; archiviert: boolean }[];
  wirkung: string;
  grundlage: string;
}

/** Der Textschlüssel zu einem Fehler der Vorlagenwege. */
export function vorlagenFehlerSchluessel(fehler: unknown): string {
  if (!(fehler instanceof ApiError)) {
    return "vorlagen.fehler.allgemein";
  }
  switch (fehler.code) {
    case "VORLAGE_UNGUELTIG":
    case "VORGABE_UNGUELTIG":
    case "BEGRIFF_UNGUELTIG":
      return "vorlagen.fehler.ungueltig";
    case "VERSION_VERALTET":
      return "vorlagen.fehler.veraltet";
    case "VORSCHAU_VERALTET":
      return "vorlagen.fehler.vorschauVeraltet";
    case "BEGRUENDUNG_FEHLT":
      return "vorlagen.fehler.begruendung";
    case "VORLAGE_AUSGEMUSTERT":
    case "VORLAGE_NICHT_ANWENDBAR":
      return "vorlagen.fehler.ausgemustert";
    case "SPACE_ARCHIVIERT":
      return "vorlagen.fehler.archiviert";
    default:
      return fehler.status === 403 ? "vorlagen.fehler.recht" : "vorlagen.fehler.allgemein";
  }
}

/** Die Befunde einer abgelehnten Einreichung (400 `PFLICHTANGABEN_FEHLEN`) — sonst `null`. */
export function befundeAus(fehler: unknown): PflichtBefund[] | null {
  if (fehler instanceof ApiError && fehler.code === "PFLICHTANGABEN_FEHLEN") {
    const b = fehler.details.befunde;
    return Array.isArray(b) ? (b as PflichtBefund[]) : [];
  }
  return null;
}

const pfad = (id: string): string => `/vorlagen/${encodeURIComponent(id)}`;

export const vorlagenApi = {
  liste: () => api.get<VorlagenListe>("/vorlagen"),
  eintrag: (id: string) =>
    api.get<{ vorlage: VorlageSicht; fassungen: VorlagenFassung[] }>(pfad(id)),
  start: (spaceId: string | null) =>
    api.get<StartWahl>(
      spaceId ? `/vorlagen/start?spaceId=${encodeURIComponent(spaceId)}` : "/vorlagen/start",
    ),
  standardSetzen: (vorlageId: string | null) =>
    api.put<{ standardId: string | null }>("/vorlagen/standard", { vorlageId }),
  anlegen: (eingabe: VorlageEingabe) => api.post<VorlageSicht>("/vorlagen", eingabe),
  vorschau: (id: string, eingabe: VorlageEingabe) =>
    api.post<Aenderungswirkung>(`${pfad(id)}/vorschau`, eingabe),
  aendern: (id: string, version: number, eingabe: VorlageEingabe) =>
    api.put<{ vorlage: VorlageSicht; wirkung: Aenderungswirkung }>(pfad(id), {
      ...eingabe,
      version,
    }),
  ausmustern: (id: string, version: number, begruendung: string) =>
    api.post<VorlageSicht>(`${pfad(id)}/ausmustern`, { version, begruendung }),
  pruefung: (body: {
    vorlage: VorlagenBezug | null;
    bodyHtml: string;
    category: string;
    tags: string[];
  }) => api.post<{ ok: boolean; befunde: PflichtBefund[] }>("/vorlagen/pruefung", body),
  nutzung: (koId: string) =>
    api.get<NutzungAuskunft>(`/vorlagen/nutzung/${encodeURIComponent(koId)}`),
  spaceVorgaben: (spaceId: string) =>
    api.get<{
      space: { id: string; name: string };
      darfBearbeiten: boolean;
      fassungen: SpaceVorgabe[];
    }>(`/vorlagen/space-vorgaben/${encodeURIComponent(spaceId)}`),
  spaceVorgabenSetzen: (spaceId: string, version: number, eingabe: SpaceVorgabeEingabe) =>
    api.put<SpaceVorgabe>(`/vorlagen/space-vorgaben/${encodeURIComponent(spaceId)}`, {
      ...eingabe,
      version,
    }),
  verwaltung: () => api.get<Verwaltung>("/vorlagen/verwaltung"),
  begriffVorschau: (auftrag: BegriffsAuftrag) =>
    api.post<BegriffsPlan>("/vorlagen/begriffe/vorschau", auftrag),
  begriffAusfuehren: (auftrag: BegriffsAuftrag, grundlage: string) =>
    api.post<{ geaendert: number; fehlgeschlagen: number; unberuehrt: number }>(
      "/vorlagen/begriffe/ausfuehren",
      { ...auftrag, grundlage },
    ),
};
