import { describe, expect, it } from "vitest";
import { AddonAuthAttemptThrottle } from "../../services/app/src/addon-auth-throttle";
import { LoginRateLimiter } from "../../services/auth/src/rate-limit";

// ================================================================================================
// R-0601 (DS19) — IP-ADRESSEN NUR IM FENSTER DER ZUGRIFFSBREMSE
// ================================================================================================
//
// Zielzustand: „Die Anwendung speichert keine IP-Adressen; sie nutzt sie nur kurzzeitig im
// 15-Minuten-Fenster der Zugriffsbremse."
//
// GEMESSEN WIRD DIE ZAHL DER IM SPEICHER LIEGENDEN SCHLÜSSEL, nicht die Sperrentscheidung. Die
// Entscheidung war schon vorher richtig — eine abgelaufene IP sperrte nicht mehr. Liegen blieb sie
// trotzdem: der Login-Limiter räumte erst ab 10 000 Einträgen, die Add-in-Drossel nie. Jeder Fall
// unten hat deshalb eine Gegenprobe innerhalb des Fensters: wer dort schon räumt, bricht die Bremse.

describe("R-0601 · Login-/Registrier-/Wiederherstellungs-Bremse (LoginRateLimiter)", () => {
  it("eine fremde IP verschwindet nach Ablauf ihres Fensters, sobald die Bremse wieder benutzt wird", () => {
    let uhr = 0;
    const fenster = 15 * 60 * 1000;
    const bremse = new LoginRateLimiter({ maxAttempts: 5, windowMs: fenster, now: () => uhr });
    bremse.registerFailure(bremse.keyFor("203.0.113.7", "a@x.de"));
    expect(bremse.size).toBe(1);

    // Gegenprobe: innerhalb des Fensters bleibt die IP — sonst wäre die Bremse wirkungslos.
    uhr = 14 * 60 * 1000;
    bremse.check(bremse.keyFor("198.51.100.1", "b@x.de"));
    expect(bremse.size).toBe(1);

    // Nach dem Fenster: ein Zugriff unter einem ANDEREN Schlüssel räumt die alte IP mit ab.
    uhr = 15 * 60 * 1000;
    bremse.check(bremse.keyFor("198.51.100.1", "b@x.de"));
    expect(bremse.size).toBe(0);
  });

  it("auch ein Fehlversuch einer anderen IP räumt abgelaufene Schlüssel ab — die neue bleibt", () => {
    let uhr = 0;
    const bremse = new LoginRateLimiter({ maxAttempts: 5, windowMs: 60_000, now: () => uhr });
    bremse.registerFailure(bremse.keyFor("203.0.113.7", "a@x.de"));
    uhr = 60_000;
    bremse.registerFailure(bremse.keyFor("198.51.100.1", "b@x.de"));
    expect(bremse.size).toBe(1);
    expect(bremse.check(bremse.keyFor("198.51.100.1", "b@x.de")).limited).toBe(false);
  });

  it("die Sperre selbst bleibt unverändert: gesperrt im Fenster, frei danach", () => {
    let uhr = 0;
    const bremse = new LoginRateLimiter({ maxAttempts: 2, windowMs: 1000, now: () => uhr });
    const schluessel = bremse.keyFor("203.0.113.7", "a@x.de");
    bremse.registerFailure(schluessel);
    bremse.registerFailure(schluessel);
    uhr = 999;
    expect(bremse.check(schluessel).limited).toBe(true);
    uhr = 1000;
    expect(bremse.check(schluessel).limited).toBe(false);
    expect(bremse.size).toBe(0);
  });
});

describe("R-0601 · Drossel fehlgeschlagener Add-in-Anmeldungen (AddonAuthAttemptThrottle)", () => {
  it("eine IP, deren letzter Versuch außerhalb des Fensters liegt, wird beim nächsten Versuch verworfen", () => {
    const drossel = new AddonAuthAttemptThrottle({ max: 10, windowMs: 60_000 });
    drossel.registerFailure("203.0.113.7", 0);
    expect(drossel.size).toBe(1);

    // Gegenprobe: innerhalb des Fensters bleiben beide IPs erhalten.
    drossel.registerFailure("198.51.100.1", 59_999);
    expect(drossel.size).toBe(2);

    // Nach dem Fenster der ersten IP: sie ist weg, die zweite (noch im Fenster) bleibt.
    drossel.registerFailure("192.0.2.5", 60_000);
    expect(drossel.size).toBe(2);
    drossel.registerFailure("192.0.2.5", 120_000);
    expect(drossel.size).toBe(1);
  });

  it("die Drosselung selbst bleibt unverändert", () => {
    const drossel = new AddonAuthAttemptThrottle({ max: 2, windowMs: 1000 });
    expect(drossel.registerFailure("203.0.113.7", 0)).toBe(true);
    expect(drossel.registerFailure("203.0.113.7", 1)).toBe(true);
    expect(drossel.registerFailure("203.0.113.7", 2)).toBe(false);
    expect(drossel.registerFailure("203.0.113.7", 1500)).toBe(true);
  });
});
