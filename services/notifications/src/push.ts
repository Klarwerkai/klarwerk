import { createPrivateKey, sign } from "node:crypto";
import type { Pool } from "pg";

// ================================================================================================
// R-0679 / R-2156 / FR-VAL-07 — GERÄTE-PUSH ALS ZWEITER VERSANDWEG NEBEN DER E-MAIL.
// ================================================================================================
//
// WAS GESENDET WIRD: NICHTS AUSSER DEM ANSTOSS. Die Push-Nachricht trägt keine Nutzlast — kein
// Titel, keine Kennung, kein Name. Der Push-Dienst des Browserherstellers (Google, Mozilla, Apple,
// Microsoft) sieht damit nur, DASS etwas anliegt. Der Service Worker zeigt daraufhin einen festen
// Hinweis und führt beim Antippen in die eigene Prüfliste; was genau anliegt, liest die angemeldete
// Anwendung selbst. Das erspart die Nutzlast-Verschlüsselung (RFC 8291) und hält Inhalte von
// fremden Diensten fern.
//
// WAS SIGNIERT WIRD: der VAPID-Ausweis des Servers (RFC 8292), ES256 über `node:crypto` — keine
// Zusatzbibliothek. Ohne die drei Umgebungswerte (`createPushFromEnv`) gibt es keinen Push; die
// E-Mail bleibt dann der einzige Weg außerhalb der Anwendung.
//
// WOHIN GESENDET WIRD: nur an die bekannten Push-Dienste (`PUSH_DIENSTE`). Der Abo-Endpunkt kommt
// vom Browser des Nutzers; ohne diese Liste wäre er ein beliebiges Ziel, an das der Server
// Anfragen schickt.

/** Ein Geräteabo: wohin der Push-Dienst zustellt. `p256dh`/`auth` werden für spätere Nutzlast gehalten. */
export interface PushAbo {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  angelegtAm: string;
}

export interface PushAboRepo {
  /** Legt das Abo an oder ordnet ein vorhandenes Gerät (gleicher Endpunkt) der Person neu zu. */
  speichern(abo: PushAbo): Promise<void>;
  entfernen(userId: string, endpoint: string): Promise<void>;
  fuer(userId: string): Promise<PushAbo[]>;
}

export class InMemoryPushAboRepo implements PushAboRepo {
  private readonly abos = new Map<string, PushAbo>();

  async speichern(abo: PushAbo): Promise<void> {
    this.abos.set(abo.endpoint, abo);
  }

  async entfernen(userId: string, endpoint: string): Promise<void> {
    if (this.abos.get(endpoint)?.userId === userId) {
      this.abos.delete(endpoint);
    }
  }

  async fuer(userId: string): Promise<PushAbo[]> {
    return [...this.abos.values()].filter((a) => a.userId === userId);
  }
}

export const PUSH_ABO_SCHEMA = `
CREATE TABLE IF NOT EXISTS push_abos (
  endpoint text PRIMARY KEY,
  user_id text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS push_abos_user_id ON push_abos(user_id);
`;

export class PgPushAboRepo implements PushAboRepo {
  constructor(private readonly pool: Pool) {}

  async speichern(abo: PushAbo): Promise<void> {
    await this.pool.query(
      "INSERT INTO push_abos(endpoint,user_id,data) VALUES($1,$2,$3) ON CONFLICT (endpoint) DO UPDATE SET user_id=excluded.user_id, data=excluded.data",
      [abo.endpoint, abo.userId, JSON.stringify(abo)],
    );
  }

  async entfernen(userId: string, endpoint: string): Promise<void> {
    await this.pool.query("DELETE FROM push_abos WHERE endpoint=$1 AND user_id=$2", [
      endpoint,
      userId,
    ]);
  }

  async fuer(userId: string): Promise<PushAbo[]> {
    const res = await this.pool.query<{ data: PushAbo }>(
      "SELECT data FROM push_abos WHERE user_id=$1",
      [userId],
    );
    return res.rows.map((row) => row.data);
  }
}

/** Die Push-Dienste der Browserhersteller. Genau diese Hosts (oder ihre Unterdomänen bei `*.`). */
export const PUSH_DIENSTE: readonly string[] = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "*.push.apple.com",
  "*.notify.windows.com",
];

/** Ob ein Abo-Endpunkt an einen bekannten Push-Dienst geht (https, bekannter Host). */
export function pushEndpunktErlaubt(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return PUSH_DIENSTE.some((d) =>
    d.startsWith("*.") ? host.endsWith(d.slice(1)) && host.length > d.length - 1 : host === d,
  );
}

export interface PushConfig {
  /** Öffentlicher VAPID-Schlüssel, base64url, unkomprimierter P-256-Punkt (65 Byte). */
  publicKey: string;
  /** Privater VAPID-Schlüssel, base64url, Skalar `d` (32 Byte). */
  privateKey: string;
  /** Kontakt des Betreibers für den Push-Dienst: `mailto:` oder `https:`. */
  subject: string;
}

export type PushErgebnis = "zugestellt" | "abgelaufen" | "abgelehnt";

export interface PushSender {
  readonly publicKey: string;
  send(abo: PushAbo): Promise<PushErgebnis>;
}

function b64url(daten: Buffer | string): string {
  return Buffer.from(daten).toString("base64url");
}

/** Der VAPID-Ausweis (JWT, ES256) für einen Push-Dienst. `jetztSek` ist Unix-Zeit in Sekunden. */
export function vapidJwt(config: PushConfig, audience: string, jetztSek: number): string {
  const punkt = Buffer.from(config.publicKey, "base64url");
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: config.privateKey,
      x: b64url(punkt.subarray(1, 33)),
      y: b64url(punkt.subarray(33, 65)),
    },
    format: "jwk",
  });
  const kopf = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  // 12 Stunden: RFC 8292 erlaubt höchstens 24.
  const inhalt = b64url(
    JSON.stringify({ aud: audience, exp: jetztSek + 12 * 60 * 60, sub: config.subject }),
  );
  const signatur = sign("sha256", Buffer.from(`${kopf}.${inhalt}`), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${kopf}.${inhalt}.${b64url(signatur)}`;
}

export type PushFetch = (
  url: string,
  // Leerer Rumpf als leere Zeichenkette: kein Inhalt, `Content-Length: 0`, und als `BodyInit`
  // unter jeder TypeScript-Fassung zulässig (ein `Uint8Array<ArrayBufferLike>` ist es nicht).
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number }>;

export function vapidPushSender(
  config: PushConfig,
  fetchFn: PushFetch = (url, init) => fetch(url, init),
  jetzt: () => number = () => Date.now(),
): PushSender {
  return {
    publicKey: config.publicKey,
    async send(abo: PushAbo): Promise<PushErgebnis> {
      if (!pushEndpunktErlaubt(abo.endpoint)) {
        return "abgelehnt";
      }
      const audience = new URL(abo.endpoint).origin;
      const jwt = vapidJwt(config, audience, Math.floor(jetzt() / 1000));
      const antwort = await fetchFn(abo.endpoint, {
        method: "POST",
        headers: {
          Authorization: `vapid t=${jwt}, k=${config.publicKey}`,
          TTL: "86400",
          Urgency: "normal",
        },
        body: "",
      });
      if (antwort.status === 404 || antwort.status === 410) {
        return "abgelaufen";
      }
      return antwort.status >= 200 && antwort.status < 300 ? "zugestellt" : "abgelehnt";
    },
  };
}

/** Ein ungültiger Push-Wert in der Umgebung. Nennt den Variablennamen, nie den Wert. */
export class PushKonfigurationError extends Error {
  constructor(variable: string) {
    super(`Push-Konfiguration ungültig: ${variable}`);
    this.name = "PushKonfigurationError";
  }
}

/**
 * Baut den Push-Versand aus der Umgebung. Ohne alle drei Werte → `undefined` (kein Push, E-Mail
 * bleibt). Ein gesetzter, aber unbrauchbarer Wert ist ein Konfigurationsfehler und wird gemeldet,
 * statt still keinen Push zu senden.
 */
export function createPushFromEnv(
  env: Record<string, string | undefined> = process.env,
): PushSender | undefined {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  if (!publicKey && !privateKey && !subject) {
    return undefined;
  }
  if (!publicKey) {
    throw new PushKonfigurationError("VAPID_PUBLIC_KEY");
  }
  const punkt = Buffer.from(publicKey, "base64url");
  if (punkt.length !== 65 || punkt[0] !== 0x04) {
    throw new PushKonfigurationError("VAPID_PUBLIC_KEY");
  }
  if (!privateKey || Buffer.from(privateKey, "base64url").length !== 32) {
    throw new PushKonfigurationError("VAPID_PRIVATE_KEY");
  }
  if (!subject || !(subject.startsWith("mailto:") || subject.startsWith("https:"))) {
    throw new PushKonfigurationError("VAPID_SUBJECT");
  }
  return vapidPushSender({ publicKey, privateKey, subject });
}
