type KlaraAuftragsQuelle = "getippt" | "gesprochen" | "d_routine";

export type BrowserUebergabeGrund =
  | "nicht_unterstuetzt"
  | "captcha"
  | "mfa"
  | "anmeldung"
  | "gesperrte_handlung"
  | "pruefen";

export interface BrowserUebergabe {
  readonly grund: BrowserUebergabeGrund;
  /** Der konkrete nächste Schritt für die Person. */
  readonly schritt: string;
}

export type BrowserSchrittArt = "lesen" | "fuellen" | "speichern" | "nachlesen" | "ausloesen";

export type BrowserSchrittStand =
  | "offen"
  | "erfolgt"
  | "unklar"
  | "fehlgeschlagen"
  | "uebersprungen"
  | "zurueckgenommen";

export interface BrowserSchritt {
  readonly nr: number;
  /** Dieselbe Kennungsform wie die Schritte des Aktionskerns. */
  readonly aktionskennung: string;
  readonly art: BrowserSchrittArt;
  readonly feld: string | null;
  readonly knopf: string | null;
  readonly stand: BrowserSchrittStand;
  /** Was nachgelesen bzw. abgeglichen wurde — Kennungen und Zustände, keine Seiteninhalte. */
  readonly beleg: string | null;
  readonly am: string | null;
}

export type BrowserLaufStand =
  | "bereit"
  | "laeuft"
  | "pausiert"
  | "abgebrochen"
  | "klaerung"
  | "uebergabe"
  | "bestaetigung_noetig"
  | "unklar"
  | "gestoppt_recht"
  | "fertig";

export type BrowserEreignis =
  | "begonnen"
  | "gelesen"
  | "eingetragen"
  | "gespeichert"
  | "nachgelesen"
  | "abgeglichen"
  | "ausgeloest"
  | "ziel_aktualisiert"
  | "klaerung"
  | "uebergabe"
  | "bestaetigung_noetig"
  | "bestaetigt"
  | "unklar"
  | "pausiert"
  | "fortgesetzt"
  | "abgebrochen"
  | "recht_entzogen"
  | "zurueckgenommen";

export interface BrowserVerlaufseintrag {
  readonly ereignis: BrowserEreignis;
  readonly nr: number | null;
  readonly am: string;
}

export interface BrowserErgebnis {
  readonly entwurfId: string;
  readonly nachgelesen: boolean;
  readonly zurueckgenommen: boolean;
}

export type BrowserRuecknahme =
  | { readonly art: "zurueckgenommen"; readonly beleg: string }
  | { readonly art: "nicht_ruecknehmbar"; readonly text: string }
  | { readonly art: "ziel_fehlt" | "unklar" | "nichts" | "laeuft"; readonly text: string };

/** Ein Browserauftrag im Verlauf des Gesprächs — sein Ergebnisbeleg. */
export interface BrowserAuftragEintrag {
  readonly id: string;
  /** Der Vorgangsschlüssel des Klicks in der Leiste — derselbe ist derselbe Auftrag (AC07). */
  readonly vorgang?: string;
  readonly quelle: KlaraAuftragsQuelle;
  readonly wortlaut: string;
  /** Herkunft und Pfad der Seite, ohne Abfrage und Anker. */
  readonly ort: string;
  readonly formular: string | null;
  readonly profil: { readonly id: string; readonly fassung: string } | null;
  readonly host: {
    readonly browser: string;
    readonly version: string;
    readonly erweiterung: string;
    readonly adapter: string;
  };
  /** Die beauftragten Felder (Beschriftungen); die Werte stehen im Wortlaut der Person. */
  readonly felder: readonly string[];
  readonly speichern: boolean;
  readonly ausloesen: string | null;
  readonly stand: BrowserLaufStand | "unterbrochen";
  readonly erfolg: boolean;
  readonly text: string;
  readonly schritte: readonly BrowserSchritt[];
  readonly ergebnis: BrowserErgebnis | null;
  readonly klaerung: string | null;
  readonly uebergabe: BrowserUebergabe | null;
  readonly bestaetigung: { readonly knopf: string; readonly bestaetigtAm: string } | null;
  readonly ruecknahme: {
    readonly art: BrowserRuecknahme["art"];
    readonly text: string;
    readonly am: string;
  } | null;
  readonly verlauf: readonly BrowserVerlaufseintrag[];
  readonly angelegtAm: string;
  readonly geaendertAm: string;
}
