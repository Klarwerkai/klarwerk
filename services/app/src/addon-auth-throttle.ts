// SCRUM-490 R2 (B2): IP-Drossel für FEHLGESCHLAGENE Add-on-Auth-Versuche (falscher ODER fehlender Key)
// gegen die Add-on-Endpunkte. Schließt die Brute-Force-/Lastfläche für das Erraten des Add-on-Keys.
//
// Abgrenzung: gezählt werden NUR fehlgeschlagene Versuche (ungültiger Key; oder ganz ohne gültige
// Auth = kein gültiger Key UND keine Session). Ein GÜLTIGER Add-on-Key läuft über die eigene
// addonRateLimit-Bremse (D3), eine GÜLTIGE Session ist ganz ausgenommen → der normale Session-Pfad
// wird NICHT gedrosselt. In-Memory Sliding-Window je IP; flag-gegated in build-app (nur bei
// KLARWERK_ADDON_API). `now` ist injizierbar → deterministische Tests.

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
