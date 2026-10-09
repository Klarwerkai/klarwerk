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
};
