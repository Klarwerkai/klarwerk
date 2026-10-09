// Hauptverantwortung übergeben — der Draht zu `services/app/src/routes/verantwortung-routes.ts`.
//
// Die Gestalt ist die des Servers; sie steht hier ein zweites Mal, weil die Web-App keine
// Servertypen importiert. Geändert wird beides gemeinsam.
import type { Role } from "../app/navigation";
import { api } from "./client";

export type Zugangsstand = "aktiv" | "befristet" | "abgelaufen" | "gesperrt" | "geloescht";

export interface VerantwortungPerson {
  id: string;
  name: string | null;
  role: Role | null;
  zugang: Zugangsstand;
}

export interface KontoKurz {
  id: string;
  name: string;
  role: Role;
}

export interface Bestandszeile {
  koId: string;
  version: number;
  /** `null`, wenn der Handelnde den Beitrag nicht lesen darf. */
  titel: string | null;
  sichtbar: boolean;
  status: string;
  spaceName: string | null;
  verantwortungsart: "owner" | "author-fallback";
  autor: { id: string; name: string | null };
  ursprungsautor: { id: string; name: string | null };
  mitwirkende: number;
  /** Wiederherstellbar im Papierkorb — gehört trotzdem zum zu übergebenden Bestand. */
  imPapierkorb: boolean;
  /** Die Konten, die GENAU DIESEN Beitrag übernehmen dürfen (vom Server geurteilt). */
  zulaessig: string[];
}

export interface Bestand {
  person: VerantwortungPerson;
  anzahl: number;
  nichtEinsehbar: number;
  beitraege: Bestandszeile[];
  ziele: KontoKurz[];
  vertretung: KontoKurz[];
}

export interface Zuteilung {
  koId: string;
  an: string;
}

export interface ErgebnisZeile {
  koId: string;
  titel: string | null;
  an: string;
  anName: string | null;
}

export interface OffeneZeile extends ErgebnisZeile {
  grund: string;
  text: string;
}

export interface Gruppe {
  an: { id: string; name: string | null };
  anzahl: number;
  beitraege: { koId: string; titel: string | null }[];
}

export interface Vorschau {
  von: VerantwortungPerson;
  gesamt: number;
  bereit: number;
  gruppen: Gruppe[];
  abgelehnt: OffeneZeile[];
  bereitsErledigt: ErgebnisZeile[];
  verbleibt: number;
}

export interface Uebergabeergebnis {
  von: VerantwortungPerson;
  uebertragen: ErgebnisZeile[];
  bereitsErledigt: ErgebnisZeile[];
  abgelehnt: OffeneZeile[];
  fehlgeschlagen: OffeneZeile[];
  vollstaendig: boolean;
  verbleibt: number;
  gruppen: Gruppe[];
}

export interface Deaktivierung {
  konto: VerantwortungPerson;
  bereitsInaktiv: boolean;
  uebergabe: Uebergabeergebnis | null;
}

export interface Ungeklaert {
  personen: (VerantwortungPerson & { anzahl: number })[];
  vertretung: KontoKurz[];
}

/** ADMIN-04: je Konto die Zahlen der Kontenliste. `vorgaenge: null` heisst „nicht erhoben". */
export interface KontoVerantwortung {
  id: string;
  zugang: Zugangsstand;
  beitraege: number;
  vorgaenge: { entwuerfe: number; luecken: number; pruefaufgaben: number } | null;
}

export interface Kontenuebersicht {
  erhobenAm: string;
  personen: KontoVerantwortung[];
}

export interface OffeneVorgaenge {
  entwuerfe: { id: string }[];
  luecken: { id: string }[];
  /** `titel: null`, wenn der Handelnde den Beitrag nicht lesen darf. */
  pruefaufgaben: { koId: string; titel: string | null }[];
}

// ADMIN-05 · der gemeinsame Übergabeablauf (`POST /verantwortung/ablauf[/vorschau]`).
export type Umfang = "gezielt" | "ausscheiden";
export type Zugangsentscheidung = "behalten" | "beenden";
export type VorgangArt = "entwurf" | "luecke" | "pruefaufgabe";
export type EintragArt = "beitrag" | VorgangArt;

export interface VorgangZuteilung {
  art: VorgangArt;
  /** Bei einer Prüfaufgabe die Kennung des Wissensobjekts. */
  id: string;
  an: string;
}

export interface AblaufEingabe {
  person: string;
  umfang: Umfang;
  beitraege: Zuteilung[];
  vorgaenge: VorgangZuteilung[];
  zugang: Zugangsentscheidung;
}

export interface AblaufEintrag {
  art: EintragArt;
  id: string;
  /** Nur bei Beiträgen und Prüfaufgaben, und nur, wenn der Handelnde sie lesen darf. */
  titel: string | null;
  an: string;
  anName: string | null;
}

export interface AblaufOffen extends AblaufEintrag {
  grund: string;
  text: string;
}

export interface Bilanz {
  beitraege: number;
  entwuerfe: number;
  luecken: number;
  pruefaufgaben: number;
}

export interface AblaufPaket {
  an: { id: string; name: string | null; role: Role | null };
  anzahl: number;
  eintraege: AblaufEintrag[];
  bereitsErledigt: number;
  wirkung: Record<EintragArt, number>;
}

export interface AblaufVorschau {
  person: VerantwortungPerson;
  umfang: Umfang;
  vorher: Bilanz;
  prognose: Bilanz;
  pakete: AblaufPaket[];
  abgelehnt: AblaufOffen[];
  nichtZugeteilt: { art: EintragArt; id: string; titel: string | null }[];
  ausgeschlossen: {
    entwuerfe: { id: string }[];
    luecken: { id: string }[];
    pruefaufgaben: { koId: string }[];
  };
  zugang: { jetzt: Zugangsstand; entscheidung: Zugangsentscheidung; danach: Zugangsstand };
  vertretung: KontoKurz[];
  hindernisse: string[];
  bestaetigbar: boolean;
  unveraendert: string[];
}

export interface AblaufZugang {
  vorher: Zugangsstand;
  nachher: Zugangsstand;
  entscheidung: Zugangsentscheidung;
  beendet: boolean;
  /** Das Zugangsende ist gespeichert und erreicht — unabhängig von einer (vorübergehenden) Sperre. */
  endeGespeichert?: boolean;
  grund: string | null;
}

/** Ein begonnener Ablauf ohne Abschlussbilanz — seine Vorher-Bilanz gilt beim Nachholen. */
export interface AblaufAusstehend {
  seq: number;
  at: string;
  umfang: Umfang;
  vorher: Bilanz;
}

export interface AblaufNachfolge {
  an: string;
  beitraege: number;
  vorgaenge: number;
}

export interface AblaufErgebnis {
  person: VerantwortungPerson;
  umfang: Umfang;
  vorher: Bilanz;
  /** `null`, wenn der Bestand nach dem Schreiben nicht lesbar war (offener Abschlussschritt). */
  nachher: Bilanz | null;
  nachfolger: AblaufNachfolge[];
  uebertragen: AblaufEintrag[];
  bereitsErledigt: AblaufEintrag[];
  offen: AblaufOffen[];
  zugang: AblaufZugang;
  /** Offene Abschlussschritte: `ZUGANG`, `BILANZ_NACHHER`, `BILANZVERMERK`. */
  abschlussOffen: string[];
  /** Dieser Lauf hat den Abschluss eines früher begonnenen Ablaufs nachgeholt. */
  nachgeholt: boolean;
  vollstaendig: boolean;
  protokolliert: boolean;
}

/** Ein Bilanzvermerk aus dem Prüfprotokoll — Kennungen und Anzahlen, keine Inhalte. */
export interface AblaufVermerk {
  seq: number;
  at: string;
  actor: { id: string; name: string | null };
  umfang: Umfang;
  vorher: Bilanz;
  nachher: Bilanz;
  nachfolger: (AblaufNachfolge & { name: string | null })[];
  uebertragen: number;
  bereitsErledigt: number;
  offen: { art: EintragArt; id: string; an: string; grund: string }[];
  zugang: AblaufZugang;
  vollstaendig: boolean;
}

export const verantwortungApi = {
  uebersicht: () => api.get<Kontenuebersicht>("/verantwortung/uebersicht"),
  vorgaenge: (personId: string) =>
    api.get<OffeneVorgaenge>(`/verantwortung/person/${encodeURIComponent(personId)}/vorgaenge`),
  bestand: (personId: string) =>
    api.get<Bestand>(`/verantwortung/person/${encodeURIComponent(personId)}`),
  ungeklaert: () => api.get<Ungeklaert>("/verantwortung/ungeklaert"),
  vorschau: (von: string, zuteilung: readonly Zuteilung[]) =>
    api.post<Vorschau>("/verantwortung/vorschau", { von, zuteilung }),
  /** 200 = vollständig, 207 = teilweise; beides kommt hier als Ergebnis an (`vollstaendig`). */
  uebergabe: (von: string, zuteilung: readonly Zuteilung[]) =>
    api.post<Uebergabeergebnis>("/verantwortung/uebergabe", { von, zuteilung }),
  /** 409 `BESTAND_OFFEN`, solange danach noch Beiträge bei der Person liegen. */
  deaktivieren: (person: string, zuteilung: readonly Zuteilung[]) =>
    api.post<Deaktivierung>("/verantwortung/deaktivierung", { person, zuteilung }),
  /** ADMIN-05: schreibt nichts. */
  ablaufVorschau: (eingabe: AblaufEingabe) =>
    api.post<AblaufVorschau>("/verantwortung/ablauf/vorschau", eingabe),
  /** 200 = vollständig, 207 = mit offenen Zeilen; 409 = nicht bestätigbar, nichts geschrieben. */
  ablauf: (eingabe: AblaufEingabe) => api.post<AblaufErgebnis>("/verantwortung/ablauf", eingabe),
  ablaeufe: (personId: string) =>
    api.get<{ ausstehend: AblaufAusstehend | null; ablaeufe: AblaufVermerk[] }>(
      `/verantwortung/person/${encodeURIComponent(personId)}/ablaeufe`,
    ),
};
