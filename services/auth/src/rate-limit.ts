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
// - R-0601 (DS19): der Schlüssel trägt die IP. Sie bleibt nur im Fenster im Speicher. Zwei Wege
//   räumen ab: (1) ein Zeitgeber, geplant auf den frühesten Ablauf eines gespeicherten Fensters —
//   er wirkt OHNE jede weitere Anfrage; (2) bei Zugriffen, sobald seit dem letzten Aufräumen ein
//   Fenster (gedeckelt auf eine Minute) vergangen ist. Vorher räumte erst die Speichergrenze ab
//   10 000 Einträgen; bis dahin blieb jede IP für die Laufzeit des Prozesses liegen. Der Zeitgeber
//   ist abgekoppelt (`unref`): er hält keinen Prozess am Leben.

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
  // R-0601: einspritzbarer Zeitgeber für das Aufräumen ohne Folgezugriff (Tests). Default:
  // `setTimeout`, abgekoppelt per `unref`.
  planen?: (lauf: () => void, verzoegerungMs: number) => void;
}

// R-0601: der Standard-Zeitgeber. `unref`, damit ein geplanter Aufräumlauf weder einen Server beim
// Herunterfahren noch einen Testprozess am Ende festhält.
function planeAbgekoppelt(lauf: () => void, verzoegerungMs: number): void {
  const zeitgeber = setTimeout(lauf, verzoegerungMs) as unknown as { unref?: () => void };
  zeitgeber.unref?.();
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
// R-0601: höchster Abstand zwischen zwei zeitgesteuerten Aufräumläufen. Ein Lauf ist linear in der
// Zahl der Einträge; je Zugriff liefe er unter Last quadratisch.
const PRUNE_INTERVAL_CAP_MS = 60 * 1000;

export class LoginRateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, WindowEntry>();
  private readonly pruneIntervalMs: number;
  private lastPruneAt: number;
  private readonly planen: (lauf: () => void, verzoegerungMs: number) => void;
  // R-0601: höchstens EIN geplanter Aufräumlauf je Limiter; er plant sich nach Bedarf neu.
  private ablaufGeplant = false;

  constructor(options: LoginRateLimiterOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.now = options.now ?? (() => Date.now());
    this.planen = options.planen ?? planeAbgekoppelt;
    this.pruneIntervalMs = Math.min(this.windowMs, PRUNE_INTERVAL_CAP_MS);
    this.lastPruneAt = this.now();
  }

  // R-0601: wie viele Schlüssel (und damit IP-Adressen) gerade im Speicher liegen. Nur Auskunft.
  get size(): number {
    return this.entries.size;
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
    this.pruneDue(this.now());
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
    } else {
      this.pruneDue(now);
    }
    this.planeAblauf(now);
  }

  // Erfolgreicher Login (oder bewusster Reset): Fehlversuchszähler für den Schlüssel löschen.
  reset(key: string): void {
    this.entries.delete(key);
  }

  // R-0601: plant den Aufräumlauf auf den frühesten Ablauf eines gespeicherten Fensters. Läuft er,
  // verwirft er das Abgelaufene und plant sich auf den nächsten Ablauf neu — bis nichts mehr liegt.
  // Ein zu früher Lauf (Uhr und Zeitgeber laufen auseinander) löscht nichts im Fenster: er prüft
  // dieselbe Bedingung wie jeder andere Aufräumweg.
  private planeAblauf(now: number): void {
    if (this.ablaufGeplant || this.entries.size === 0) {
      return;
    }
    let fruehesterAblauf = Number.POSITIVE_INFINITY;
    for (const entry of this.entries.values()) {
      fruehesterAblauf = Math.min(fruehesterAblauf, entry.windowStartedAt + this.windowMs);
    }
    this.ablaufGeplant = true;
    this.planen(
      () => {
        this.ablaufGeplant = false;
        const jetzt = this.now();
        this.pruneExpired(jetzt);
        this.planeAblauf(jetzt);
      },
      Math.max(0, fruehesterAblauf - now),
    );
  }

  // R-0601: räumt ab, wenn seit dem letzten Lauf das Aufräumintervall vergangen ist.
  private pruneDue(now: number): void {
    if (now - this.lastPruneAt >= this.pruneIntervalMs) {
      this.pruneExpired(now);
    }
  }

  // Entfernt abgelaufene Fenster (Speicherbegrenzung und R-0601: keine IP über ihr Fenster hinaus).
  private pruneExpired(now: number): void {
    this.lastPruneAt = now;
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStartedAt >= this.windowMs) {
        this.entries.delete(key);
      }
    }
  }
}
