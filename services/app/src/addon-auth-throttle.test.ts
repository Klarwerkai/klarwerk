import { describe, expect, it } from "vitest";
import {
  AddonAuthAttemptThrottle,
  addonAuthThrottleConfigFromEnv,
  isAddonEndpointPath,
  isCatchAllTrustEntry,
  isIpv4MappedCatchAll,
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
  it("isIpv4MappedCatchAll: /N<=96 auf ::ffff:-Basis (inkl. Schreibvarianten) → catch-all", () => {
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
      expect(isIpv4MappedCatchAll(e)).toBe(true);
    }
  });

  it("isIpv4MappedCatchAll: enge Mapped-Netze (N>96) und Nicht-Mapped → KEIN catch-all", () => {
    for (const e of [
      "::ffff:10.0.0.0/104", // echtes /8
      "::ffff:10.0.0.0/128",
      "fd00::/8",
      "2001:db8::/32",
      "10.0.0.0/8", // kein IPv6
      "::1", // ohne Präfix
    ]) {
      expect(isIpv4MappedCatchAll(e)).toBe(false);
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
