// Wissenskennzahlen — der Draht zu `services/app/src/routes/wissenskennzahlen-routes.ts`
// (produkt:20261009:admin-wissenskennzahlen, ADMIN-11).
//
// Die Gestalt ist die des Servers (`services/app/src/wissenskennzahlen.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";
import type { VorgangTyp, VorgangZustand } from "./qualitaetsaufgaben";

export const ZEITRAEUME = [7, 30, 90] as const;
export type Zeitraum = (typeof ZEITRAEUME)[number];
export const STANDARD_ZEITRAUM: Zeitraum = 30;

export type Messlage = "gemessen" | "unvollstaendig" | "nicht_erhoben" | "unbekannt";

export type TrendGrund =
  | "verglichen"
  | "momentaufnahme"
  | "vorperiode_unvollstaendig"
  | "nenner_null"
  | "nicht_erhoben"
  | "unbekannt";

export interface KennzahlAnfrage {
  tage: Zeitraum;
  space: string | null;
  team: string | null;
}

export interface KennzahlEintrag {
  schluessel: string;
  typ: VorgangTyp;
  zustand: VorgangZustand;
  titel: string | null;
  arbeitsweg: string;
  spaces: string[];
  seit: string | null;
  ueberfaellig: boolean;
}

export interface Kennzahl {
  schluessel: string;
  art: "momentaufnahme" | "zeitraum";
  einheit: "anzahl" | "prozent";
  wert: number | null;
  zaehler: number | null;
  nenner: number | null;
  lage: Messlage;
  erhobenSeit: string | null;
  trend: { vorher: number; differenz: number } | null;
  trendGrund: TrendGrund;
  arbeitsliste: string | null;
  eintraege?: KennzahlEintrag[];
}

export interface BedarfEintrag {
  lueckeId: string;
  frage: string | null;
  haeufigkeit: number | null;
  zugeordnet: boolean;
  seit: string;
  arbeitsweg: string;
  vorgang: string;
}

export interface SuchEintrag {
  begriff: string;
  anzahl: number;
  zuletzt: string;
  eingrenzung: Record<string, string>;
  vorgang: { schluessel: string; arbeitsweg: string } | null;
}

export interface Wissenskennzahlen {
  stand: string;
  anfrage: KennzahlAnfrage;
  zeitraum: { von: string; bis: string };
  vorperiode: { von: string; bis: string };
  handlungsbedarf: Kennzahl[];
  nutzung: Kennzahl[];
  bedarf: {
    lage: Messlage;
    offen: number | null;
    ohneZaehlung: number | null;
    eintraege: BedarfEintrag[];
  };
  /** Die EIGENEN erfolglosen Suchen des Betrachters — kumuliert, ohne Zeitraum. */
  suche: {
    lage: Messlage;
    deckel: number;
    /** `unbekannt`: die Lückenquelle fiel aus — ein fehlender Vorgang ist dann kein Nichttreffer. */
    zuordnung: "bekannt" | "unbekannt";
    eintraege: SuchEintrag[];
  };
  filterwerte: {
    spaces: { id: string; name: string }[];
    teams: { id: string; name: string; spaces: string[] }[];
  };
  quellen: {
    vorgaenge: "ok" | "teilweise" | "fehler";
    fragen: "ok" | "fehler";
    luecken: "ok" | "fehler";
  };
}

/** Der Abfrageschlüssel je Auswahl — Zahl, Details und Export lesen DIESELBE Antwort. */
export function wissenskennzahlenKey(a: KennzahlAnfrage) {
  return ["wissenskennzahlen", a.tage, a.space ?? "", a.team ?? ""] as const;
}

export const wissenskennzahlenApi = {
  laden: (a: KennzahlAnfrage) => {
    const p = new URLSearchParams({ tage: String(a.tage) });
    if (a.space !== null) {
      p.set("space", a.space);
    }
    if (a.team !== null) {
      p.set("team", a.team);
    }
    return api.get<Wissenskennzahlen>(`/wissenskennzahlen?${p.toString()}`);
  },
};
