import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  AddonAuthAttemptThrottle,
  addonAuthThrottleConfigFromEnv,
  canonicalizeTrustEntry,
  containsMappedIpv4Space,
  isAddonEndpointPath,
  isCatchAllTrustEntry,
  isValidTrustEntry,
  resolveTrustProxy,
} from "./addon-auth-throttle";

// SCRUM-490 R2 (B2): IP-Drossel für fehlgeschlagene Add-on-Auth-Versuche. Reiner Sliding-Window-Kern,
// deterministisch mit injizierter Zeit getestet.
describe("SCRUM-490 R2 (B2): AddonAuthAttemptThrottle", () => {
  it("erlaubt bis `max` Fehlversuche je IP, drosselt den nächsten", () => {
    const t = new AddonAuthAttemptThrottle({ max: 3, windowMs: 60_000 });
    expect(t.registerFailure("1.2.3.4", 0)).toBe(true);
    expect(t.registerFailure("1.2.3.4", 1)).toBe(true);
    expect(t.registerFailure("1.2.3.4", 2)).toBe(true);
    expect(t.registerFailure("1.2.3.4", 3)).toBe(false); // 4. Versuch → gedrosselt
  });

  it("zählt je IP getrennt (ein Angreifer drosselt nicht andere)", () => {
    const t = new AddonAuthAttemptThrottle({ max: 1, windowMs: 60_000 });
    expect(t.registerFailure("10.0.0.1", 0)).toBe(true);
    expect(t.registerFailure("10.0.0.1", 1)).toBe(false); // IP-1 gedrosselt
    expect(t.registerFailure("10.0.0.2", 1)).toBe(true); // IP-2 unberührt
  });

  it("Sliding-Window: alte Versuche außerhalb des Fensters verfallen", () => {
    const t = new AddonAuthAttemptThrottle({ max: 2, windowMs: 1_000 });
    expect(t.registerFailure("9.9.9.9", 0)).toBe(true);
    expect(t.registerFailure("9.9.9.9", 500)).toBe(true);
    expect(t.registerFailure("9.9.9.9", 900)).toBe(false); // 3 im Fenster → gedrosselt
    // Nach Ablauf des Fensters (die ersten beiden sind > 1000ms alt) wieder frei.
    expect(t.registerFailure("9.9.9.9", 1600)).toBe(true);
  });

  it("Env-Config: gültige Overrides, sonst konservative Defaults", () => {
    expect(addonAuthThrottleConfigFromEnv({})).toEqual({ max: 10, windowMs: 60_000 });
    expect(
      addonAuthThrottleConfigFromEnv({
        KLARWERK_ADDON_AUTH_MAX: "5",
        KLARWERK_ADDON_AUTH_WINDOW: "30000",
      }),
    ).toEqual({ max: 5, windowMs: 30_000 });
    // ungültig → Default
    expect(addonAuthThrottleConfigFromEnv({ KLARWERK_ADDON_AUTH_MAX: "0" }).max).toBe(10);
    expect(addonAuthThrottleConfigFromEnv({ KLARWERK_ADDON_AUTH_MAX: "abc" }).max).toBe(10);
  });
});

// SCRUM-490 R3 (B2, Fix 3): Pfad-Normalisierung — kein Trick-Pfad umgeht die Zählung.
describe("SCRUM-490 R3 (B2): isAddonEndpointPath (normalisiert)", () => {
  it("trifft die Add-on-Endpunkte auch bei Trailing-Slash, %-Enkodierung, Case und Dot-Segmenten", () => {
    for (const p of [
      "/api/ask",
      "/api/ask/",
      "/api/ask?x=1",
      "/API/ASK",
      "/api/%61sk", // %61 = 'a'
      "/x/../api/ask",
      "/api/check-text",
      "/api/check-text/",
    ]) {
      expect(isAddonEndpointPath(p)).toBe(true);
    }
  });

  it("trifft NICHT bei anderen/erweiterten Pfaden", () => {
    for (const p of ["/health", "/api/askx", "/api/ask/extra", "/api", "", undefined]) {
      expect(isAddonEndpointPath(p)).toBe(false);
    }
  });
});

// SCRUM-490 R3 (B2, Fix 4): trustProxy nur gezielt — NIE blanket (spoofbar).
describe("SCRUM-490 R3 (B2): resolveTrustProxy", () => {
  it("unset → false (konservativ, Socket-Peer)", () => {
    expect(resolveTrustProxy({})).toBe(false);
  });

  it("Blanket-Werte (true/false/*) → false (kein XFF-Blindvertrauen)", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "true" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "false" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "*" })).toBe(false);
  });

  it("Zahl → Hop-Count", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "1" })).toBe(1);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "2" })).toBe(2);
  });

  it("IP/Subnetz(e) → Liste (nur diese Adressen vertrauen)", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "10.0.0.0/8" })).toEqual(["10.0.0.0/8"]);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "10.0.0.1, 172.16.0.0/12" })).toEqual([
      "10.0.0.1",
      "172.16.0.0/12",
    ]);
  });
});

// SCRUM-490 R4 (B2, Fix 2): Catch-all-CIDRs werden als Blanket abgelehnt (nie „vertraue alle").
describe("SCRUM-490 R4 (B2): resolveTrustProxy lehnt Catch-all ab", () => {
  it("isCatchAllTrustEntry erkennt /0-Masken, unspecified-Adressen und Wildcards", () => {
    for (const e of ["0.0.0.0/0", "::/0", "2000::/0", "0/0", "0.0.0.0", "::", "*", ""]) {
      expect(isCatchAllTrustEntry(e)).toBe(true);
    }
    for (const e of ["10.0.0.0/8", "172.16.0.0/12", "10.0.0.1", "::1", "fd00::/8"]) {
      expect(isCatchAllTrustEntry(e)).toBe(false);
    }
  });

  it("0.0.0.0/0 und ::/0 → KEIN Vertrauen (wie unset)", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "0.0.0.0/0" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::/0" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "2000::/0" })).toBe(false);
  });

  it("gemischt: Catch-all-Anteil verworfen, explizite Subnetze bleiben", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "0.0.0.0/0, 10.0.0.0/8" })).toEqual([
      "10.0.0.0/8",
    ]);
    // NUR Catch-all → nichts Explizites übrig → false (fail-safe).
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "0.0.0.0/0, ::/0" })).toBe(false);
  });

  it("explizites Subnetz + Hop-Count bleiben weiter gültig (kein Regress)", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "172.16.0.0/12" })).toEqual(["172.16.0.0/12"]);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "2" })).toBe(2);
  });
});

// SCRUM-490 R5 (B2, Fix): IPv4-mapped-Catch-all (::ffff:0:0/N mit N<=96) überdeckt den vollen IPv4-Raum
// und wird SEMANTISCH als Blanket abgelehnt; enge Mapped-Netze (N>96) bleiben gültig.
describe("SCRUM-490 R5 (B2): IPv4-mapped-Catch-all im trustProxy", () => {
  it("containsMappedIpv4Space: /N<=96 auf ::ffff:-Basis (inkl. Schreibvarianten) → catch-all", () => {
    for (const e of [
      "::ffff:0:0/96",
      "::ffff:0:0/096", // führende Null
      "::ffff:0:0/95",
      "::ffff:0:0/64",
      "::ffff:0:0/0",
      "::ffff:0.0.0.0/96", // dotted-Form
      "::FFFF:0:0/96", // Case
      "::ffff:10.0.0.0/96", // Host durch /96 maskiert → ganzer IPv4-Raum
    ]) {
      expect(containsMappedIpv4Space(e)).toBe(true);
    }
  });

  it("containsMappedIpv4Space: enge Mapped-Netze (N>96) und Nicht-Mapped → KEIN catch-all", () => {
    for (const e of [
      "::ffff:10.0.0.0/104", // echtes /8
      "::ffff:10.0.0.0/128",
      "fd00::/8",
      "2001:db8::/32",
      "10.0.0.0/8", // kein IPv6
      "::1", // ohne Präfix
    ]) {
      expect(containsMappedIpv4Space(e)).toBe(false);
    }
  });

  it("resolveTrustProxy: mapped-Catch-all → kein Vertrauen; enges mapped-Netz bleibt gültig", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:0:0/96" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:0:0/096" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:0:0/0" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:10.0.0.0/104" })).toEqual([
      "::ffff:10.0.0.0/104",
    ]);
  });

  it("gemischt: mapped-Catch-all-Anteil verworfen, explizites Subnetz bleibt", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:0:0/96, 10.0.0.0/8" })).toEqual([
      "10.0.0.0/8",
    ]);
  });

  it("isCatchAllTrustEntry deckt R4-Fälle weiter ab (kein Regress)", () => {
    for (const e of ["0.0.0.0/0", "::/0", "2000::/0", "0.0.0.0", "::", "*", ""]) {
      expect(isCatchAllTrustEntry(e)).toBe(true);
    }
    for (const e of ["172.16.0.0/12", "10.0.0.1", "::ffff:10.0.0.0/104"]) {
      expect(isCatchAllTrustEntry(e)).toBe(false);
    }
  });
});

// SCRUM-490 R6 (B2): trustProxy STRUKTURELL — Containment gegen ::ffff:0:0/96 statt Basis-Gleichheit,
// plus Validierungs-Gate (node:net.isIP + Zone-ID/Präfix). Kein Spezialfall-Katalog mehr.
describe("SCRUM-490 R6 (B2): trustProxy Containment + Validierung", () => {
  it("ben-Durchrutscher werden per Containment als Catch-all erkannt", () => {
    for (const e of ["::fffe:0:0/95", "::fffc:0:0/94", "0:0:0:0:0:1:0:0/80", "::/1"]) {
      expect(containsMappedIpv4Space(e)).toBe(true);
      expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: e })).toBe(false);
    }
  });

  it("Validierungs-Gate: Zone-IDs (%) werden IMMER verworfen", () => {
    expect(isValidTrustEntry("fd00::1%eth0/64")).toBe(false);
    expect(isValidTrustEntry("::ffff:0:0%eth0/96")).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "fd00::1%eth0/64" })).toBe(false);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:0:0%eth0/96" })).toBe(false);
  });

  it("Validierungs-Gate: Malformed am Rand verworfen → false/gefilterte Liste, KEIN Crashpfad", () => {
    for (const e of ["::ffff:gggg/96", "abc/8", "10.0.0.0/8/x", "10.0.0.0/33", "::1/129"]) {
      expect(isValidTrustEntry(e)).toBe(false);
      expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: e })).toBe(false);
    }
    // Malformed in einer Liste → nur der Eintrag fällt, Gültiges bleibt.
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:gggg/96, 10.0.0.0/8" })).toEqual([
      "10.0.0.0/8",
    ]);
  });

  it("isValidTrustEntry: gültige IPs/CIDRs bestehen", () => {
    for (const e of [
      "10.0.0.0/8",
      "172.16.0.0/12",
      "10.0.0.1",
      "fd00::/8",
      "2001:db8::/32",
      "::1",
    ]) {
      expect(isValidTrustEntry(e)).toBe(true);
    }
  });

  it("enge Netze + Hop-Count bleiben gültig (kein Regress)", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:10.0.0.0/104" })).toEqual([
      "::ffff:10.0.0.0/104",
    ]);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::ffff:10.0.0.0/128" })).toEqual([
      "::ffff:10.0.0.0/128",
    ]);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "fd00::/8" })).toEqual(["fd00::/8"]);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "2001:db8::/32" })).toEqual(["2001:db8::/32"]);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "172.16.0.0/12" })).toEqual(["172.16.0.0/12"]);
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "2" })).toBe(2);
  });

  it("gemischt: ben-Durchrutscher verworfen, explizites Subnetz bleibt", () => {
    expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: "::fffe:0:0/95, 10.0.0.0/8" })).toEqual([
      "10.0.0.0/8",
    ]);
  });

  it("R5/R4-Fälle unverändert (kein Regress)", () => {
    for (const e of ["::ffff:0:0/96", "0.0.0.0/0", "::/0", "2000::/0"]) {
      expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: e })).toBe(false);
    }
    expect(isCatchAllTrustEntry("0.0.0.0")).toBe(true);
    expect(isCatchAllTrustEntry("::")).toBe(true);
    expect(isCatchAllTrustEntry("*")).toBe(true);
  });
});

// SCRUM-490 R7 (B2): whitespace-behaftete / nicht-kanonische Präfixe crashfrei abfangen. Der Test läuft
// DIREKT gegen @fastify/proxy-addr.compile (die Funktion, die Fastify beim trustProxy-Setup aufruft),
// damit der Startcrash real ausgeschlossen ist. Import via createRequire → keine Typ-Deklaration nötig.
const requireCjs = createRequire(import.meta.url);
const proxyAddr = requireCjs("@fastify/proxy-addr") as { compile: (val: string[]) => unknown };

function compilesWithoutThrow(result: boolean | number | string[]): boolean {
  if (!Array.isArray(result)) {
    return true; // false/Hop-Count: Fastify kompiliert keine Adressliste
  }
  try {
    proxyAddr.compile(result);
    return true;
  } catch {
    return false;
  }
}

describe("SCRUM-490 R7 (B2): whitespace/nicht-kanonische Präfixe crashfrei", () => {
  const WS = [
    "10.0.0.0/ 8", // Space vor Präfix
    "10.0.0.0/\t8", // Tab
    "10.0.0.0/ 8", // Unicode-Whitespace (NBSP)
    "fd00::/ 8",
  ];

  it("Beleg: der ROH-String würde proxy-addr.compile zum Werfen bringen", () => {
    for (const w of WS) {
      expect(() => proxyAddr.compile([w])).toThrow();
    }
  });

  it("whitespace-Präfixe werden verworfen; das Ergebnis kompiliert crashfrei", () => {
    for (const w of WS) {
      const result = resolveTrustProxy({ KLARWERK_TRUST_PROXY: w });
      expect(result).toBe(false); // Gürtel: interner Whitespace → ungültig → verworfen
      expect(compilesWithoutThrow(result)).toBe(true);
    }
  });

  it("gemischt: whitespace-Eintrag fällt, gültiger bleibt KANONISCH → compile crashfrei", () => {
    const result = resolveTrustProxy({ KLARWERK_TRUST_PROXY: "10.0.0.0/ 8, 10.0.0.0/8" });
    expect(result).toEqual(["10.0.0.0/8"]);
    expect(compilesWithoutThrow(result)).toBe(true);
    expect(() => proxyAddr.compile(result as string[])).not.toThrow();
  });

  it("führende-Null-Präfix wird kanonisiert (10.0.0.0/08 → 10.0.0.0/8) → compile crashfrei", () => {
    const result = resolveTrustProxy({ KLARWERK_TRUST_PROXY: "10.0.0.0/08" });
    expect(result).toEqual(["10.0.0.0/8"]);
    expect(compilesWithoutThrow(result)).toBe(true);
  });

  it("canonicalizeTrustEntry: Präfix-Whitespace/Nullen weg; reine Adresse unverändert", () => {
    expect(canonicalizeTrustEntry("10.0.0.0/08")).toBe("10.0.0.0/8");
    expect(canonicalizeTrustEntry("172.16.0.0/12")).toBe("172.16.0.0/12");
    expect(canonicalizeTrustEntry("10.0.0.1")).toBe("10.0.0.1");
    expect(canonicalizeTrustEntry("fd00::/8")).toBe("fd00::/8");
  });

  it("isValidTrustEntry lehnt internen Whitespace ab (Space/Tab/Unicode)", () => {
    for (const w of ["10.0.0.0/ 8", "10.0.0.0/\t8", "10.0.0.0/ 8", "fd00::/ 8"]) {
      expect(isValidTrustEntry(w)).toBe(false);
    }
    expect(isValidTrustEntry("10.0.0.0/8")).toBe(true); // ohne Whitespace weiter gültig
  });

  it("kein Regress: R6-gültige Ergebnisse kompilieren crashfrei", () => {
    for (const v of [
      "::ffff:10.0.0.0/104",
      "fd00::/8",
      "2001:db8::/32",
      "172.16.0.0/12",
      "10.0.0.1",
    ]) {
      const result = resolveTrustProxy({ KLARWERK_TRUST_PROXY: v });
      expect(Array.isArray(result)).toBe(true);
      expect(compilesWithoutThrow(result)).toBe(true);
    }
    // Containment-/Catch-all-Ablehnungen bleiben false.
    for (const c of ["::fffe:0:0/95", "0.0.0.0/0", "::/0", "fd00::1%eth0/64"]) {
      expect(resolveTrustProxy({ KLARWERK_TRUST_PROXY: c })).toBe(false);
    }
  });
});
