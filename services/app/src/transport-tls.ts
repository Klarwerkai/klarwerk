// ================================================================================================
// R-2057 / NFR-SEC-02 — TLS BIS ZUR ANWENDUNG, NICHT NUR BIS ZUM PROXY.
// ================================================================================================
//
// DER BEFUND (Betriebsbefund 08.10.2026, HILFE/…/TLS-BETRIEBSBEFUND.json): öffentlich endet TLS am
// Traefik-Proxy; vom Proxy zur Anwendung lief der Verkehr im gemeinsamen Docker-Netz als
// Klartext-HTTP auf den App-Port. HTTPS an diesem Port scheiterte im Handshake — die Anwendung
// konnte gar kein TLS. R-2057 verlangt „Transport durchgängig TLS", der interne Abschnitt gehört dazu.
//
// WAS DIESE DATEI TUT: Sind `KLARWERK_TLS_CERT_FILE` und `KLARWERK_TLS_KEY_FILE` gesetzt, nimmt die
// Anwendung auf ihrem Port NUR TLS an (mindestens TLS 1.2); Klartext-HTTP an denselben Port scheitert.
// Der Proxy prüft das Zertifikat gegen die interne CA (Betriebsanleitung:
// docs/operations/tls-bis-zur-anwendung.md).
//
// FAIL-CLOSED, WO ES OHNE BETRIEBSUMSTELLUNG GEHT:
//   · nur EINE der beiden Variablen gesetzt → Startabbruch mit beiden Namen (halbe Konfiguration
//     liefe sonst still im Klartext);
//   · Datei nicht lesbar → Startabbruch mit Variablenname (nie mit Inhalt);
//   · `KLARWERK_TLS_PFLICHT=1` ohne Zertifikat → Startabbruch. Diese Sperre setzt der Betreiber,
//     sobald der Proxy umgestellt ist; danach kann ein Neustart nicht mehr still auf Klartext fallen.
// Ohne Zertifikat und ohne Pflicht startet die Anwendung wie bisher im Klartext — in Produktion mit
// einer lauten Warnung (`klartextWarnung`). Die harte Pflicht ohne vorherige Proxy-Umstellung würde
// die laufende Installation beim nächsten Ausrollen abschalten; die Reihenfolge steht in der Anleitung.
import { readFileSync } from "node:fs";
import type { Server as HttpServer, IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:https";

export const TLS_CERT_ENV = "KLARWERK_TLS_CERT_FILE";
export const TLS_KEY_ENV = "KLARWERK_TLS_KEY_FILE";
export const TLS_PFLICHT_ENV = "KLARWERK_TLS_PFLICHT";

/** Unterste angenommene Protokollfassung am App-Port. */
export const TLS_MINDESTFASSUNG = "TLSv1.2";

export interface TransportTls {
  cert: Buffer;
  key: Buffer;
}

export class TransportTlsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportTlsError";
  }
}

function gesetzt(wert: string | undefined): string | undefined {
  const t = wert?.trim();
  return t ? t : undefined;
}

/**
 * Liest die TLS-Konfiguration des App-Ports aus der Umgebung. `undefined` = Klartext (bisheriges
 * Verhalten). Wirft `TransportTlsError` bei halber Konfiguration, unlesbarer Datei oder gesetzter
 * Pflicht ohne Zertifikat.
 */
export function leseTransportTls(
  env: NodeJS.ProcessEnv = process.env,
  lesen: (pfad: string) => Buffer = (pfad) => readFileSync(pfad),
): TransportTls | undefined {
  const certPfad = gesetzt(env[TLS_CERT_ENV]);
  const keyPfad = gesetzt(env[TLS_KEY_ENV]);
  if (!certPfad && !keyPfad) {
    if (env[TLS_PFLICHT_ENV]?.trim() === "1") {
      throw new TransportTlsError(
        `${TLS_PFLICHT_ENV}=1 verlangt TLS am App-Port, aber ${TLS_CERT_ENV} und ${TLS_KEY_ENV} sind nicht gesetzt.`,
      );
    }
    return undefined;
  }
  if (!certPfad || !keyPfad) {
    throw new TransportTlsError(
      `TLS am App-Port braucht ${TLS_CERT_ENV} UND ${TLS_KEY_ENV}; gesetzt ist nur ${certPfad ? TLS_CERT_ENV : TLS_KEY_ENV}.`,
    );
  }
  const lies = (name: string, pfad: string): Buffer => {
    try {
      return lesen(pfad);
    } catch {
      throw new TransportTlsError(`${name} zeigt auf eine nicht lesbare Datei.`);
    }
  };
  return { cert: lies(TLS_CERT_ENV, certPfad), key: lies(TLS_KEY_ENV, keyPfad) };
}

/** Warnzeile für den Klartextbetrieb in Produktion; sonst `undefined`. */
export function klartextWarnung(
  tls: TransportTls | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (tls || env.NODE_ENV !== "production") {
    return undefined;
  }
  return `App-Port nimmt Klartext-HTTP an — R-2057 verlangt TLS bis zur Anwendung. ${TLS_CERT_ENV} und ${TLS_KEY_ENV} setzen und den Proxy auf https umstellen (docs/operations/tls-bis-zur-anwendung.md).`;
}

type Anfragebehandlung = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Fastify-`serverFactory` für den App-Port mit TLS. Der Rückgabetyp ist der des Fastify-Standards;
 * zur Laufzeit ist es ein `https.Server` (gleiche Ereignis- und `listen`-Schnittstelle).
 */
export function tlsServerFabrik(tls: TransportTls): (handler: Anfragebehandlung) => HttpServer {
  return (handler) =>
    createServer(
      { cert: tls.cert, key: tls.key, minVersion: TLS_MINDESTFASSUNG },
      handler,
    ) as unknown as HttpServer;
}
