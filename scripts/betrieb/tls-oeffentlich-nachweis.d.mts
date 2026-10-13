// Typen der exportierten Proben aus `tls-oeffentlich-nachweis.mjs` — für den Import aus
// `tests/security/tls-oeffentlich-nachweis.test.ts`.

export type Ergebnis = "bestanden" | "durchgefallen" | "ungeklaert";

export interface ProbenZiel {
  /** Der öffentliche Name — Servername für TLS und `Host`-Kopf. */
  readonly host: string;
  /** Wohin verbunden wird; Vorgabe `host`. */
  readonly adresse?: string | undefined;
  readonly httpsPort?: number | undefined;
  readonly httpPort?: number | undefined;
  /** Nur für Tests: eigener Vertrauensanker statt des Systemspeichers. */
  readonly ca?: string | undefined;
  readonly zeitMs?: number | undefined;
  readonly mindestRestTage?: number | undefined;
  readonly jetzt?: number | undefined;
}

export interface Probe {
  readonly probe: "O1" | "O2" | "O3";
  readonly host: string;
  readonly ergebnis: Ergebnis;
  readonly grund?: string;
  readonly pfad?: string;
  readonly status?: number;
  readonly umleitung?: string | null;
  readonly hsts?: string | null;
  readonly protokoll?: string | null;
  readonly aussteller?: string | null;
  readonly aussteller_cn?: string | null;
  readonly gueltig_ab?: string;
  readonly gueltig_bis?: string;
  readonly laufzeit_tage?: number;
  readonly rest_tage?: number;
}

export interface Beleg {
  readonly anforderung: string;
  readonly zeit: string;
  readonly hosts: readonly string[];
  readonly proben: readonly Probe[];
  readonly bestanden: boolean;
}

export declare const OEFFENTLICHE_HOSTS: readonly string[];
export declare const TASKPANE_PFAD: string;
export declare const KLARTEXT_PFADE: readonly string[];
export declare const MINDEST_RESTTAGE: number;
export declare const HSTS_MINDEST_MAX_AGE: number;

export declare function pruefeZertifikat(optionen: ProbenZiel): Promise<Probe>;
export declare function pruefeKlartext(optionen: ProbenZiel, pfad: string): Promise<Probe>;
export declare function pruefeStartweg(optionen: ProbenZiel): Promise<Probe>;
export declare function pruefeHost(optionen: ProbenZiel): Promise<Probe[]>;
export declare function nachweis(
  hosts?: readonly string[],
  zusatz?: Omit<ProbenZiel, "host">,
): Promise<Beleg>;
