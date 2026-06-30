// SCRUM-356 / AG-06 / NFR-SEC-04: kleiner, abhängigkeitsfreier In-Memory-Rate-Limiter gegen
// Login-Brute-Force. Bewusst minimal: ein fixes Zeitfenster je Schlüssel (z. B. IP + normalisierte
// Login-ID). KEIN Redis/DB, kein externes Framework — passend zum modularen Monolithen für die Beta.
//
// Designentscheidungen (Sicherheit):
// - Schlüssel = IP + normalisierte Login-ID. So trifft das Limit gezielt das Brute-Forcen EINES
//   Kontos von EINER Quelle; andere Nutzer/IPs werden nicht mitblockiert.
// - Es werden NUR echte Fehlversuche gezählt (der Aufrufer ruft registerFailure nur bei falschen
//   Zugangsdaten auf). Erfolgreiche Logins setzen den Zähler zurück (reset).
// - Das Verhalten ist für bekannte UND unbekannte Login-IDs identisch (der Limiter kennt keine
//   Nutzer) → keine User-Enumeration.
// - Nach Ablauf des Fensters wird der Schlüssel wieder frei (TTL).

export interface RateLimitDecision {
  // true → aktuell gesperrt (Aufrufer soll 429 + Retry-After senden).
  limited: boolean;
  // Verbleibende Sperrzeit in ganzen Sekunden (für den Retry-After-Header). 0, wenn nicht gesperrt.
  retryAfterSeconds: number;
}

export interface LoginRateLimiterOptions {
  // Erlaubte Fehlversuche je Fenster, bevor gesperrt wird (Default 5).
  maxAttempts?: number;
  // Fensterlänge / TTL in Millisekunden (Default 15 Minuten).
  windowMs?: number;
  // Einspritzbare Uhr (Tests). Default: Date.now.
  now?: () => number;
}

interface WindowEntry {
  count: number;
  windowStartedAt: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 Minuten
// Schutz vor unbegrenztem Speicherwachstum (In-Memory): ab dieser Größe werden abgelaufene
// Einträge opportunistisch entfernt. Reicht für eine Beta-Instanz locker aus.
const PRUNE_THRESHOLD = 10_000;

export class LoginRateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, WindowEntry>();

  constructor(options: LoginRateLimiterOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.now = options.now ?? (() => Date.now());
  }

  // Stabiler Schlüssel aus Quelle (IP) + normalisierter Login-ID. Login-ID wird klein geschrieben und
  // getrimmt, damit "A@x.de" und " a@x.de " denselben Bucket treffen. Fehlende Werte sind zulässig.
  keyFor(ip: string | undefined, loginId: string | null | undefined): string {
    const source = (ip ?? "unknown").trim();
    const id = (loginId ?? "").trim().toLowerCase();
    return `${source}|${id}`;
  }

  // Liest (ohne zu zählen), ob der Schlüssel gerade gesperrt ist. Abgelaufene Fenster gelten als frei.
  check(key: string): RateLimitDecision {
    const entry = this.entries.get(key);
    if (!entry) {
      return { limited: false, retryAfterSeconds: 0 };
    }
    const elapsed = this.now() - entry.windowStartedAt;
    if (elapsed >= this.windowMs) {
      // Fenster abgelaufen → frei. Eintrag aufräumen.
      this.entries.delete(key);
      return { limited: false, retryAfterSeconds: 0 };
    }
    if (entry.count >= this.maxAttempts) {
      const remainingMs = this.windowMs - elapsed;
      return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
    }
    return { limited: false, retryAfterSeconds: 0 };
  }

  // Zählt einen Fehlversuch. Startet ein neues Fenster, wenn keines läuft oder das alte abgelaufen ist.
  registerFailure(key: string): void {
    const now = this.now();
    const entry = this.entries.get(key);
    if (!entry || now - entry.windowStartedAt >= this.windowMs) {
      this.entries.set(key, { count: 1, windowStartedAt: now });
    } else {
      entry.count += 1;
    }
    if (this.entries.size > PRUNE_THRESHOLD) {
      this.pruneExpired(now);
    }
  }

  // Erfolgreicher Login (oder bewusster Reset): Fehlversuchszähler für den Schlüssel löschen.
  reset(key: string): void {
    this.entries.delete(key);
  }

  // Entfernt abgelaufene Fenster (nur zur Speicherbegrenzung).
  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStartedAt >= this.windowMs) {
        this.entries.delete(key);
      }
    }
  }
}
