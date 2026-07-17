// SCRUM-490 R2/R3 (B2): IP-Drossel für FEHLGESCHLAGENE Add-on-Auth-Versuche (falscher ODER fehlender Key)
// gegen die Add-on-Endpunkte. Schließt die Brute-Force-/Lastfläche für das Erraten des Add-on-Keys.
//
// Abgrenzung: gezählt werden NUR fehlgeschlagene Versuche (ungültiger Key auf JEDER Route; oder ganz ohne
// gültige Auth = kein gültiger Key UND keine ECHT authentifizierte Session gegen einen Add-on-Endpunkt).
// Ein GÜLTIGER Add-on-Key läuft über die eigene addonRateLimit-Bremse (D3), eine GÜLTIGE Session ist ganz
// ausgenommen → der normale Session-Pfad wird NICHT gedrosselt. In-Memory Sliding-Window je IP; flag-
// gegated in build-app (nur bei KLARWERK_ADDON_API). `now` ist injizierbar → deterministische Tests.

import { ADDON_ASK_PATH, ADDON_CHECK_TEXT_PATH } from "./addon-api";

export interface AddonAuthThrottleConfig {
  max: number; // max. fehlgeschlagene Versuche je IP im Fenster
  windowMs: number;
}

// Konservativ und strenger als der 30/min-Cap gültiger Add-on-Anfragen: 10 Fehlversuche/Minute je IP.
const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60_000;

function posInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function addonAuthThrottleConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): AddonAuthThrottleConfig {
  return {
    max: posInt(env.KLARWERK_ADDON_AUTH_MAX, DEFAULT_MAX),
    windowMs: posInt(env.KLARWERK_ADDON_AUTH_WINDOW, DEFAULT_WINDOW_MS),
  };
}

export class AddonAuthAttemptThrottle {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly config: AddonAuthThrottleConfig) {}

  // Registriert einen Fehlversuch für `ip` und meldet, ob er noch ERLAUBT ist (unter dem Limit).
  // false → über dem Limit → der Aufrufer antwortet 429. Alte Einträge außerhalb des Fensters werden
  // verworfen (Sliding-Window). Nur fehlgeschlagene Versuche kommen hier an (der Aufrufer filtert).
  registerFailure(ip: string, now: number): boolean {
    const win = this.config.windowMs;
    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < win);
    recent.push(now);
    this.hits.set(ip, recent);
    return recent.length <= this.config.max;
  }

  retryAfterSeconds(): number {
    return Math.ceil(this.config.windowMs / 1000);
  }
}

const ADDON_ENDPOINT_PATHS: readonly string[] = [ADDON_ASK_PATH, ADDON_CHECK_TEXT_PATH];

// SCRUM-490 R3 (B2, Fix 3): normalisiert den ROH-Pfad und meldet, ob er einen Add-on-Endpunkt trifft —
// robust gegen Trailing-Slash (/api/ask/), Prozent-Enkodierung (/api/%61sk), Dot-Segmente (/x/../api/ask)
// und Groß-/Kleinschreibung. So bleibt kein Fremd-/Trick-Pfad ungedrosselt (kein 401/403-Gültigkeitsorakel).
export function isAddonEndpointPath(rawUrl: string | undefined): boolean {
  let path: string;
  try {
    // Basis-URL nur zum Auflösen von Dot-Segmenten; der pathname bleibt ggf. prozent-enkodiert.
    path = new URL(rawUrl ?? "", "http://x").pathname;
  } catch {
    path = (rawUrl ?? "").split("?")[0] ?? "";
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    // ungültige %-Sequenz → Pfad unverändert weiterprüfen (matcht dann i. d. R. keinen Endpunkt)
  }
  path = path.toLowerCase();
  if (path.length > 1) {
    path = path.replace(/\/+$/, ""); // Trailing-Slash(es) entfernen
  }
  return ADDON_ENDPOINT_PATHS.includes(path);
}

// SCRUM-490 R3 (B2, Fix 4): trustProxy GEZIELT — request.ip soll die ECHTE Client-IP sein, aber NIE
// blanket (sonst wird X-Forwarded-For spoofbar → die IP-Drossel wertlos). KLARWERK_TRUST_PROXY:
//  - Zahl N        → vertraue den letzten N Proxy-Hops (nur setzen, wenn die feste Hop-Anzahl bekannt ist).
//  - IP/Subnetz(e) → vertraue NUR diesen Adressen (komma-separiert), z. B. dem Traefik-/Coolify-Hop.
//  - unset / "true"/"false"/"*" → KEIN Vertrauen (konservativ; request.ip = Socket-Peer). Blanket-Werte
//    werden BEWUSST als „kein Vertrauen" behandelt — XFF wird nie blind geglaubt.
export function resolveTrustProxy(
  env: Record<string, string | undefined> = process.env,
): boolean | number | string[] {
  const raw = env.KLARWERK_TRUST_PROXY?.trim();
  if (!raw) {
    return false;
  }
  const lowered = raw.toLowerCase();
  if (lowered === "true" || lowered === "false" || lowered === "*") {
    return false; // Blanket-Vertrauen ist verboten (spoofbar)
  }
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) {
    return n; // fester Hop-Count
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : false;
}
