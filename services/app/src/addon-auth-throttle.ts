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
// SCRUM-490 R4 (B2, Fix 2): auch Catch-all-CIDRs (0.0.0.0/0, ::/0, jede /0-Maske, unspecified-Adressen)
// werden als Blanket abgelehnt — ein „vertraue alle Adressen"-Subnetz ist genauso spoofbar wie true.
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
  // Liste von IPs/Subnetzen — Catch-all-Einträge werden verworfen (nie ein All-umfassendes Subnetz
  // vertrauen). Bleibt danach nichts Explizites übrig → fail-safe KEIN Vertrauen.
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isCatchAllTrustEntry(s));
  return list.length > 0 ? list : false;
}

// Catch-all / All-umfassende Vertrauensangabe? /0-Präfix (0 Maskenbits = ALLES, z. B. 0.0.0.0/0, ::/0,
// 2000::/0; auch mit führenden Nullen) ODER eine unspecified-/Wildcard-Basisadresse (0.0.0.0, ::, *)
// ODER (SCRUM-490 R5) ein IPv4-mapped-Netz, das den GESAMTEN IPv4-Raum überdeckt (::ffff:0:0/N mit
// N<=96 — die IPv4-Bits sind dann komplett Wildcard). Solche Einträge würden JEDE Quell-IP als
// vertrauenswürdigen Proxy behandeln → X-Forwarded-For spoofbar. Fail-safe abgelehnt.
export function isCatchAllTrustEntry(entry: string): boolean {
  const e = entry.trim().toLowerCase();
  if (e === "" || e === "*") {
    return true;
  }
  const slash = e.indexOf("/");
  const base = (slash >= 0 ? e.slice(0, slash) : e).trim();
  const prefixStr = slash >= 0 ? e.slice(slash + 1).trim() : null;
  // /0 (auch führende Nullen: /00, /000) = keine Maskenbits = alles.
  if (prefixStr !== null && /^\d+$/.test(prefixStr) && Number(prefixStr) === 0) {
    return true;
  }
  if (base === "0.0.0.0" || base === "::" || base === "*") {
    return true;
  }
  return isIpv4MappedCatchAll(e);
}

// SCRUM-490 R5: überdeckt der Eintrag den vollen IPv4-Raum via IPv4-mapped IPv6 (::ffff:0:0/N, N<=96)?
// SEMANTISCH geprüft (nicht rein textuell): die Adresse wird zu 16 Bytes expandiert; ihre ersten 96 Bit
// müssen der Mapped-Präfix ::ffff: sein (80 Null-Bits + 0xffff) UND das Präfix <=96 (dann sind die 32
// IPv4-Bits komplett Wildcard → ganzer IPv4-Raum). Enge Mapped-Netze mit N>96 (z. B. ::ffff:10.0.0.0/104
// = ein /8) bleiben gültig. Fängt äquivalente Schreibweisen (führende Nullen im Präfix, dotted-IPv4-Form,
// Whitespace, Case) über die Byte-Expansion mit.
export function isIpv4MappedCatchAll(entry: string): boolean {
  const slash = entry.indexOf("/");
  if (slash < 0) {
    return false; // ohne Präfix kein Netz → kein Catch-all
  }
  const addr = entry.slice(0, slash).trim();
  const prefixStr = entry.slice(slash + 1).trim();
  if (!/^\d+$/.test(prefixStr)) {
    return false;
  }
  const prefix = Number(prefixStr);
  if (prefix > 128) {
    return false;
  }
  const bytes = ipv6ToBytes(addr);
  if (!bytes) {
    return false;
  }
  // Mapped-Präfix ::ffff: = Bytes 0..9 == 0 und Bytes 10,11 == 0xff.
  const isMapped =
    bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  return isMapped && prefix <= 96;
}

// Expandiert eine IPv6-Adresse (mit optionalem "::" und optionaler dotted-IPv4-Endung) zu 16 Bytes.
// Ungültig/kein IPv6 → null. Bewusst schlank (nur für die Catch-all-Erkennung), kein neues Dependency.
function ipv6ToBytes(input: string): number[] | null {
  let a = input.trim().toLowerCase();
  if (a === "" || !a.includes(":")) {
    return null; // reine IPv4/leer → hier nicht als IPv6 behandeln
  }
  // Trailing dotted-IPv4 (z. B. ::ffff:10.0.0.0) → zwei Hextets.
  let v4: string[] = [];
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a);
  if (dotted?.[1]) {
    const parts = dotted[1].split(".").map(Number);
    if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
      return null;
    }
    v4 = [
      (((parts[0] ?? 0) << 8) | (parts[1] ?? 0)).toString(16),
      (((parts[2] ?? 0) << 8) | (parts[3] ?? 0)).toString(16),
    ];
    a = a.slice(0, a.length - dotted[1].length).replace(/:$/, "");
  }
  const halves = a.split("::");
  if (halves.length > 2) {
    return null;
  }
  const head = halves[0] ? halves[0].split(":").filter((s) => s !== "") : [];
  let hextets: string[];
  if (halves.length === 2) {
    const tail = [...(halves[1] ? halves[1].split(":").filter((s) => s !== "") : []), ...v4];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      return null;
    }
    hextets = [...head, ...Array<string>(missing).fill("0"), ...tail];
  } else {
    hextets = [...head, ...v4];
    if (hextets.length !== 8) {
      return null;
    }
  }
  const bytes: number[] = [];
  for (const h of hextets) {
    if (!/^[0-9a-f]{1,4}$/.test(h)) {
      return null;
    }
    const v = Number.parseInt(h, 16);
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  return bytes.length === 16 ? bytes : null;
}
