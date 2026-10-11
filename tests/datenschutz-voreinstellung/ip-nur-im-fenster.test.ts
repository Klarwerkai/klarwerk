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
//
// Nacharbeit 2 (Bens Befund): das Aufräumen hing an weiteren Zugriffen — ohne Folgeanfrage blieb
// eine abgelaufene IP beliebig lange liegen. Die Fälle „OHNE Folgezugriff" unten messen den
// Zeitgeber: er wird mitgeschrieben statt ausgeführt, und genau EIN geplanter Lauf wird von Hand
// ausgelöst, ohne dass die Bremse dazwischen noch einmal angefragt wird.

/** Ein mitschreibender Zeitgeber: hält geplante Läufe fest, statt sie auszuführen. */
function zeitgeberAttrappe() {
  const geplant: Array<{ lauf: () => void; verzoegerungMs: number }> = [];
  return {
    geplant,
    planen: (lauf: () => void, verzoegerungMs: number) => {
      geplant.push({ lauf, verzoegerungMs });
    },
    /** Führt den ältesten geplanten Lauf aus (und nur ihn). */
    loeseAus: () => {
      const naechster = geplant.shift();
      if (!naechster) {
        throw new Error("kein Aufräumlauf geplant — dann räumt ohne Folgezugriff niemand ab");
      }
      naechster.lauf();
    },
  };
}

describe("R-0601 · Aufräumen OHNE Folgezugriff (Zeitgeber)", () => {
  it("Login-Bremse: der Zeitgeber steht auf dem Fensterende und verwirft die IP ohne weitere Anfrage", () => {
    let uhr = 0;
    const zeit = zeitgeberAttrappe();
    const fenster = 15 * 60 * 1000;
    const bremse = new LoginRateLimiter({
      maxAttempts: 5,
      windowMs: fenster,
      now: () => uhr,
      planen: zeit.planen,
    });
    bremse.registerFailure(bremse.keyFor("203.0.113.7", "a@x.de"));
    expect(bremse.size).toBe(1);
    expect(zeit.geplant).toHaveLength(1);
    expect(zeit.geplant[0]?.verzoegerungMs).toBe(fenster);

    // KEIN weiterer Aufruf an die Bremse — nur die Zeit vergeht, dann läuft der Zeitgeber.
    uhr = fenster;
    zeit.loeseAus();
    expect(bremse.size).toBe(0);
    // Leer heißt: kein weiterer Lauf geplant (kein Dauerläufer ohne Bestand).
    expect(zeit.geplant).toHaveLength(0);
  });

  it("Login-Bremse: ein zu früh laufender Zeitgeber löscht nichts im Fenster und plant sich neu", () => {
    let uhr = 0;
    const zeit = zeitgeberAttrappe();
    const bremse = new LoginRateLimiter({
      maxAttempts: 2,
      windowMs: 1000,
      now: () => uhr,
      planen: zeit.planen,
    });
    const schluessel = bremse.keyFor("203.0.113.7", "a@x.de");
    bremse.registerFailure(schluessel);
    bremse.registerFailure(schluessel);
    // Nur EIN Lauf geplant, obwohl zweimal gezählt wurde.
    expect(zeit.geplant).toHaveLength(1);

    uhr = 400;
    zeit.loeseAus();
    expect(bremse.size).toBe(1);
    expect(zeit.geplant).toHaveLength(1);
    expect(zeit.geplant[0]?.verzoegerungMs).toBe(600);
    // Die Sperre wirkt im Fenster unverändert.
    expect(bremse.check(schluessel).limited).toBe(true);

    uhr = 1000;
    zeit.loeseAus();
    expect(bremse.size).toBe(0);
  });

  it("Add-in-Drossel: ohne weiteren Fehlversuch verschwindet die IP am Fensterende", () => {
    let uhr = 0;
    const zeit = zeitgeberAttrappe();
    const drossel = new AddonAuthAttemptThrottle(
      { max: 10, windowMs: 60_000 },
      { jetzt: () => uhr, planen: zeit.planen },
    );
    drossel.registerFailure("203.0.113.7", 0);
    expect(drossel.size).toBe(1);
    expect(zeit.geplant[0]?.verzoegerungMs).toBe(60_000);

    // Zu früh: im Fenster bleibt die IP, der Lauf plant sich auf den Rest neu.
    uhr = 30_000;
    zeit.loeseAus();
    expect(drossel.size).toBe(1);
    expect(zeit.geplant[0]?.verzoegerungMs).toBe(30_000);

    uhr = 60_000;
    zeit.loeseAus();
    expect(drossel.size).toBe(0);
    expect(zeit.geplant).toHaveLength(0);
  });

  it("Add-in-Drossel: die Sperre wirkt im Fenster weiter, auch wenn der Zeitgeber dazwischen läuft", () => {
    let uhr = 0;
    const zeit = zeitgeberAttrappe();
    const drossel = new AddonAuthAttemptThrottle(
      { max: 2, windowMs: 1000 },
      { jetzt: () => uhr, planen: zeit.planen },
    );
    expect(drossel.registerFailure("203.0.113.7", 0)).toBe(true);
    expect(drossel.registerFailure("203.0.113.7", 1)).toBe(true);
    uhr = 500;
    zeit.loeseAus();
    expect(drossel.registerFailure("203.0.113.7", 500)).toBe(false);
  });
});

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
