// R-0679 / FR-VAL-07: Geräte-Push für Prüfzuweisungen — die Browserseite.
//
// Ablauf beim Einschalten: Servereinrichtung erfragen (`GET /api/push/config`), Erlaubnis des
// Browsers einholen, beim Service Worker ein Push-Abo mit dem öffentlichen VAPID-Schlüssel anlegen
// und es dem Server melden. Ausschalten kündigt das Abo im Browser und meldet es beim Server ab.
// Alle Browser-Zugriffe laufen über `PushUmgebung`, damit die Abläufe ohne echten Browser
// prüfbar sind.

export type PushLage =
  | "nicht-eingerichtet" // der Betrieb hat keinen Push (keine VAPID-Konfiguration)
  | "nicht-unterstuetzt" // dieser Browser kann keinen Push (oder kein Service Worker aktiv)
  | "verweigert" // der Mensch hat die Benachrichtigungen im Browser abgelehnt
  | "aus"
  | "an";

export interface PushAboJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface BrowserAbo {
  endpoint: string;
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

export interface AboOptionen {
  userVisibleOnly: true;
  applicationServerKey: Uint8Array;
}

export interface BrowserPushManager {
  getSubscription(): Promise<BrowserAbo | null>;
  subscribe(opts: AboOptionen): Promise<BrowserAbo>;
}

export interface PushUmgebung {
  config(): Promise<{ verfuegbar: boolean; publicKey: string | null }>;
  anmelden(abo: PushAboJson): Promise<unknown>;
  abmelden(endpoint: string): Promise<unknown>;
  /** `null`, wenn der Browser Push oder Service Worker nicht kennt. */
  pushManager(): Promise<BrowserPushManager | null>;
  /** `null`, wenn der Browser keine Benachrichtigungen kennt. */
  erlaubnis(): Erlaubnis | null;
  erlaubnisAnfragen(): Promise<Erlaubnis>;
}

/** Dieselben drei Werte wie `NotificationPermission` des Browsers. */
export type Erlaubnis = "default" | "granted" | "denied";

/** base64url → Bytes (der öffentliche VAPID-Schlüssel für `applicationServerKey`). */
export function b64urlZuBytes(wert: string): Uint8Array {
  const b64 = wert.replace(/-/g, "+").replace(/_/g, "/");
  const roh = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(roh, (z) => z.charCodeAt(0));
}

function alsAboJson(abo: BrowserAbo): PushAboJson | null {
  const j = abo.toJSON() as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (
    typeof j.endpoint !== "string" ||
    typeof j.keys?.p256dh !== "string" ||
    typeof j.keys?.auth !== "string"
  ) {
    return null;
  }
  return { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
}

export async function pushLage(u: PushUmgebung): Promise<PushLage> {
  const cfg = await u.config();
  if (!cfg.verfuegbar || !cfg.publicKey) {
    return "nicht-eingerichtet";
  }
  const pm = await u.pushManager();
  const erlaubnis = u.erlaubnis();
  if (!pm || erlaubnis === null) {
    return "nicht-unterstuetzt";
  }
  if (erlaubnis === "denied") {
    return "verweigert";
  }
  return (await pm.getSubscription()) ? "an" : "aus";
}

export async function pushEinschalten(u: PushUmgebung): Promise<PushLage> {
  const cfg = await u.config();
  if (!cfg.verfuegbar || !cfg.publicKey) {
    return "nicht-eingerichtet";
  }
  const pm = await u.pushManager();
  if (!pm || u.erlaubnis() === null) {
    return "nicht-unterstuetzt";
  }
  if ((await u.erlaubnisAnfragen()) !== "granted") {
    return "verweigert";
  }
  const abo =
    (await pm.getSubscription()) ??
    (await pm.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlZuBytes(cfg.publicKey),
    }));
  const json = alsAboJson(abo);
  if (!json) {
    return "nicht-unterstuetzt";
  }
  await u.anmelden(json);
  return "an";
}

export async function pushAusschalten(u: PushUmgebung): Promise<PushLage> {
  const pm = await u.pushManager();
  const abo = await pm?.getSubscription();
  if (abo) {
    await u.abmelden(abo.endpoint);
    await abo.unsubscribe();
  }
  return "aus";
}
