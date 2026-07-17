import { describe, expect, it } from "vitest";
import { AddonAuthAttemptThrottle, addonAuthThrottleConfigFromEnv } from "./addon-auth-throttle";

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
