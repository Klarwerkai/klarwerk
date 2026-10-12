// ================================================================================================
// R-0562 (Aufnahme 20260922 · gesamt-zweifaktor) — EIGENE ZWEI-FAKTOR-ANMELDUNG, OHNE FIRMEN-
// ANMELDEDIENST.
// ================================================================================================
//
// Gemessen am echten Dienst und an den echten Routen (Fastify `inject`), mit steuerbarer Uhr:
//   Z1  das TOTP-Verfahren trifft die Prüfvektoren aus RFC 6238 (Anhang B, SHA-1)
//   Z2  Einrichten: Passwort nötig, Geheimnis wirkt erst nach bestätigtem Code
//   Z3  Danach: Passwort allein ergibt KEINE Sitzung — auch nicht über den alten `login`-Weg
//   Z4  Passwort + gültiger Code ⇒ Sitzung; falscher, wiederverwendeter oder abgelaufener ⇒ keine
//   Z5  Fünf falsche Codes beenden die Anmeldeanfrage
//   Z6  Abschalten (Passwort + Code) und Admin-Rücksetzung (verlorenes Gerät)
//   Z7  SSO-Konten richten keinen eigenen zweiten Faktor ein; Löschen räumt das Geheimnis ab
//   Z8  HTTP: Passwortschritt ohne Cookie/Token, Codeschritt setzt die Sitzung, Rechte der Routen
//   Z9  Das Geheimnis steht in keinem Prüfprotokolleintrag
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  AuthService,
  InMemorySecondFactorRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
  authRoutes,
  totpCode,
  totpSchritt,
} from "../../services/auth";

const PW = "secret123";

function aufbau() {
  let jetzt = Date.UTC(2026, 9, 9, 8, 0, 0);
  const users = new InMemoryUserRepo();
  const sessions = new InMemorySessionRepo();
  const secondFactors = new InMemorySecondFactorRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo(), now: () => jetzt });
  const service = new AuthService({
    users,
    sessions,
    secondFactors,
    audit,
    now: () => jetzt,
  });
  return {
    users,
    sessions,
    secondFactors,
    audit,
    service,
    uhr: {
      jetzt: () => jetzt,
      weiter: (ms: number) => {
        jetzt += ms;
      },
    },
  };
}

/** Der Code, den das zweite Gerät zur Uhrzeit des Aufbaus zeigt (Versatz in Zeitschritten). */
function code(secret: string, jetzt: number, versatz = 0): string {
  return totpCode(secret, totpSchritt(jetzt) + versatz);
}

async function kontoMitZweitemFaktor() {
  const k = aufbau();
  const admin = await k.service.register({ name: "Admin", email: "admin@x.de", password: PW });
  const anna = await k.service.register({ name: "Anna", email: "anna@x.de", password: PW });
  await k.service.approveUser(anna.id, admin.id);
  const { secret } = await k.service.secondFactorSetupStart(anna.id, PW);
  await k.service.secondFactorSetupConfirm(anna.id, code(secret, k.uhr.jetzt()));
  // Der Code der Einrichtung ist verbraucht; die Anmeldung kommt einen Zeitschritt später.
  k.uhr.weiter(30_000);
  return { ...k, admin, anna, secret };
}

describe("Z1 · TOTP nach RFC 6238 (Prüfvektoren Anhang B, SHA-1, 6 Stellen)", () => {
  // Geheimnis "12345678901234567890" (ASCII) als Base32.
  const RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("T=%i s ⇒ %s", (sekunden, erwartet) => {
    expect(totpCode(RFC, totpSchritt(sekunden * 1000))).toBe(erwartet);
  });
});

describe("Z2 · Einrichten", () => {
  it("verlangt das Passwort und gibt Schlüssel + otpauth-Adresse heraus", async () => {
    const k = aufbau();
    const anna = await k.service.register({ name: "Anna", email: "anna@x.de", password: PW });
    await expect(k.service.secondFactorSetupStart(anna.id, "falsch")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    const { secret, otpauthUri } = await k.service.secondFactorSetupStart(anna.id, PW);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUri).toMatch(/^otpauth:\/\/totp\/KLARWERK:anna%40x\.de\?/);
    expect(otpauthUri).toContain(`secret=${secret}`);
  });

  it("wirkt erst nach bestätigtem Code — ein falscher Code schaltet nichts ein", async () => {
    const k = aufbau();
    const anna = await k.service.register({ name: "Anna", email: "anna@x.de", password: PW });
    const { secret } = await k.service.secondFactorSetupStart(anna.id, PW);
    const falsch = code(secret, k.uhr.jetzt()) === "000000" ? "111111" : "000000";
    await expect(k.service.secondFactorSetupConfirm(anna.id, falsch)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(await k.service.secondFactorStatus(anna.id)).toEqual({ active: false });
    // Bis zur Bestätigung meldet sich Anna weiter nur mit dem Passwort an.
    expect((await k.service.login({ email: "anna@x.de", password: PW })).token).toBeTruthy();
    await k.service.secondFactorSetupConfirm(anna.id, code(secret, k.uhr.jetzt()));
    expect(await k.service.secondFactorStatus(anna.id)).toEqual({ active: true });
  });

  it("eine begonnene Einrichtung verfällt nach zehn Minuten", async () => {
    const k = aufbau();
    const anna = await k.service.register({ name: "Anna", email: "anna@x.de", password: PW });
    const { secret } = await k.service.secondFactorSetupStart(anna.id, PW);
    k.uhr.weiter(10 * 60 * 1000 + 1);
    await expect(
      k.service.secondFactorSetupConfirm(anna.id, code(secret, k.uhr.jetzt())),
    ).rejects.toMatchObject({ message: "SECOND_FACTOR_SETUP_MISSING" });
    expect(await k.service.secondFactorStatus(anna.id)).toEqual({ active: false });
  });
});

describe("Z3/Z4 · Anmelden mit eigenem zweiten Faktor", () => {
  it("Passwort allein ergibt keine Sitzung — weder über `anmelden` noch über `login`", async () => {
    const k = await kontoMitZweitemFaktor();
    const erster = await k.service.anmelden({ email: "anna@x.de", password: PW });
    expect("secondFactor" in erster).toBe(true);
    expect("token" in erster).toBe(false);
    await expect(k.service.login({ email: "anna@x.de", password: PW })).rejects.toMatchObject({
      message: "SECOND_FACTOR_REQUIRED",
    });
    // Falsches Passwort bleibt falsches Passwort — der zweite Schritt wird gar nicht erreicht.
    await expect(
      k.service.anmelden({ email: "anna@x.de", password: "falsch" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", message: "INVALID_CREDENTIALS" });
  });

  it("Passwort + gültiger Code ⇒ Sitzung; derselbe Code trägt keine zweite Anmeldung", async () => {
    const k = await kontoMitZweitemFaktor();
    const erster = await k.service.anmelden({ email: "anna@x.de", password: PW });
    if (!("secondFactor" in erster)) {
      throw new Error("Anmeldeanfrage erwartet");
    }
    const gueltig = code(k.secret, k.uhr.jetzt());
    const { token, user } = await k.service.anmeldenMitZweitemFaktor(
      erster.secondFactor.challenge,
      gueltig,
    );
    expect(user.email).toBe("anna@x.de");
    expect((await k.service.authenticate(token))?.id).toBe(k.anna.id);

    const zweiter = await k.service.anmelden({ email: "anna@x.de", password: PW });
    if (!("secondFactor" in zweiter)) {
      throw new Error("Anmeldeanfrage erwartet");
    }
    await expect(
      k.service.anmeldenMitZweitemFaktor(zweiter.secondFactor.challenge, gueltig),
    ).rejects.toMatchObject({ message: "SECOND_FACTOR_INVALID" });
  });

  it("die Anmeldeanfrage ist einmalig und verfällt nach fünf Minuten", async () => {
    const k = await kontoMitZweitemFaktor();
    const erster = await k.service.anmelden({ email: "anna@x.de", password: PW });
    if (!("secondFactor" in erster)) {
      throw new Error("Anmeldeanfrage erwartet");
    }
    k.uhr.weiter(5 * 60 * 1000 + 1);
    await expect(
      k.service.anmeldenMitZweitemFaktor(
        erster.secondFactor.challenge,
        code(k.secret, k.uhr.jetzt()),
      ),
    ).rejects.toMatchObject({ message: "SECOND_FACTOR_CHALLENGE_INVALID" });
    await expect(
      k.service.anmeldenMitZweitemFaktor("erfunden", code(k.secret, k.uhr.jetzt())),
    ).rejects.toMatchObject({ message: "SECOND_FACTOR_CHALLENGE_INVALID" });
  });

  it("ein in der Zwischenzeit abgelaufener Zugang kommt auch mit Code nicht herein", async () => {
    const k = await kontoMitZweitemFaktor();
    const erster = await k.service.anmelden({ email: "anna@x.de", password: PW });
    if (!("secondFactor" in erster)) {
      throw new Error("Anmeldeanfrage erwartet");
    }
    await k.service.setAccessExpiry(
      k.anna.id,
      new Date(k.uhr.jetzt() + 1000).toISOString(),
      k.admin.id,
    );
    k.uhr.weiter(2000);
    await expect(
      k.service.anmeldenMitZweitemFaktor(
        erster.secondFactor.challenge,
        code(k.secret, k.uhr.jetzt()),
      ),
    ).rejects.toMatchObject({ code: "NOT_APPROVED", message: "ACCESS_EXPIRED" });
  });
});

describe("Z5 · Raten am Code", () => {
  it("nach fünf falschen Codes ist die Anmeldeanfrage verbraucht — auch der richtige hilft nicht", async () => {
    const k = await kontoMitZweitemFaktor();
    const erster = await k.service.anmelden({ email: "anna@x.de", password: PW });
    if (!("secondFactor" in erster)) {
      throw new Error("Anmeldeanfrage erwartet");
    }
    const richtig = code(k.secret, k.uhr.jetzt());
    const falsch = richtig === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) {
      await expect(
        k.service.anmeldenMitZweitemFaktor(erster.secondFactor.challenge, falsch),
      ).rejects.toMatchObject({ message: "SECOND_FACTOR_INVALID" });
    }
    await expect(
      k.service.anmeldenMitZweitemFaktor(erster.secondFactor.challenge, richtig),
    ).rejects.toMatchObject({ message: "SECOND_FACTOR_CHALLENGE_INVALID" });
  });
});

describe("Z6 · Abschalten und Admin-Rücksetzung", () => {
  it("Abschalten verlangt Passwort UND gültigen Code; danach reicht wieder das Passwort", async () => {
    const k = await kontoMitZweitemFaktor();
    await expect(
      k.service.secondFactorDisable(k.anna.id, "falsch", code(k.secret, k.uhr.jetzt())),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const falsch = code(k.secret, k.uhr.jetzt()) === "000000" ? "111111" : "000000";
    await expect(k.service.secondFactorDisable(k.anna.id, PW, falsch)).rejects.toMatchObject({
      message: "SECOND_FACTOR_INVALID",
    });
    expect(await k.service.secondFactorStatus(k.anna.id)).toEqual({ active: true });
    await k.service.secondFactorDisable(k.anna.id, PW, code(k.secret, k.uhr.jetzt()));
    expect(await k.service.secondFactorStatus(k.anna.id)).toEqual({ active: false });
    expect((await k.service.login({ email: "anna@x.de", password: PW })).token).toBeTruthy();
  });

  it("verlorenes Gerät: der Admin entfernt den zweiten Faktor, die Person kommt mit Passwort herein", async () => {
    const k = await kontoMitZweitemFaktor();
    await k.service.secondFactorReset(k.anna.id, k.admin.id);
    expect(await k.service.secondFactorStatus(k.anna.id)).toEqual({ active: false });
    expect((await k.service.login({ email: "anna@x.de", password: PW })).token).toBeTruthy();
    await expect(k.service.secondFactorReset(k.anna.id, k.admin.id)).rejects.toMatchObject({
      message: "SECOND_FACTOR_NOT_ACTIVE",
    });
  });
});

describe("Z7 · SSO-Konten und Löschen", () => {
  it("ein SSO-Konto (ohne Passwort) richtet keinen eigenen zweiten Faktor ein", async () => {
    const k = aufbau();
    const sso = await k.service.loginWithOidc(
      {
        iss: "https://idp.example",
        sub: "s-1",
        email: "sso@x.de",
        name: "Sso",
        emailVerified: true,
        rolesClaimPresent: false,
        roles: [],
      } as unknown as Parameters<AuthService["loginWithOidc"]>[0],
      true,
    );
    await expect(k.service.secondFactorSetupStart(sso.user.id, "")).rejects.toMatchObject({
      message: "SECOND_FACTOR_PASSWORD_ACCOUNT_ONLY",
    });
  });

  it("das Löschen eines Kontos entfernt sein Geheimnis aus der Ablage", async () => {
    const k = await kontoMitZweitemFaktor();
    expect(await k.secondFactors.find(k.anna.id)).toBeDefined();
    await k.service.deleteUser(k.anna.id, k.admin.id);
    expect(await k.secondFactors.find(k.anna.id)).toBeUndefined();
  });
});

describe("Z8 · HTTP-Wege", () => {
  async function app() {
    const k = await kontoMitZweitemFaktor();
    const server = Fastify();
    await server.register(authRoutes(k.service));
    return { ...k, server };
  }

  it("Passwortschritt: 200 mit Anmeldeanfrage, OHNE Cookie und OHNE Token; Codeschritt setzt die Sitzung", async () => {
    const k = await app();
    const erster = await k.server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@x.de", password: PW },
    });
    expect(erster.statusCode).toBe(200);
    const rumpf = erster.json() as Record<string, unknown>;
    expect(rumpf.secondFactorRequired).toBe(true);
    expect(rumpf.token).toBeUndefined();
    expect(rumpf.user).toBeUndefined();
    expect(erster.headers["set-cookie"]).toBeUndefined();

    const falsch = await k.server.inject({
      method: "POST",
      url: "/api/auth/login/second-factor",
      payload: { challenge: rumpf.challenge, code: "12" },
    });
    expect(falsch.statusCode).toBe(401);
    expect(falsch.headers["set-cookie"]).toBeUndefined();

    const zweiter = await k.server.inject({
      method: "POST",
      url: "/api/auth/login/second-factor",
      payload: { challenge: rumpf.challenge, code: code(k.secret, k.uhr.jetzt()) },
    });
    expect(zweiter.statusCode).toBe(200);
    expect(String(zweiter.headers["set-cookie"])).toContain("kw_session=");
    const token = (zweiter.json() as { token: string }).token;
    const ich = await k.server.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ich.statusCode).toBe(200);
    await k.server.close();
  });

  it("R-0541 × R-0562: ist die Passwortanmeldung abgeschaltet, stellt auch der Codeschritt keine Sitzung aus", async () => {
    const k = await app();
    const erster = await k.server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@x.de", password: PW },
    });
    const challenge = (erster.json() as { challenge: string }).challenge;
    const vorher = process.env.KLARWERK_SSO_ONLY;
    process.env.KLARWERK_SSO_ONLY = "1";
    try {
      const zweiter = await k.server.inject({
        method: "POST",
        url: "/api/auth/login/second-factor",
        payload: { challenge, code: code(k.secret, k.uhr.jetzt()) },
      });
      expect(zweiter.statusCode).toBe(403);
      expect((zweiter.json() as { error: string }).error).toBe("PASSWORD_LOGIN_DISABLED");
      expect(zweiter.headers["set-cookie"]).toBeUndefined();
    } finally {
      if (vorher === undefined) {
        delete process.env.KLARWERK_SSO_ONLY;
      } else {
        process.env.KLARWERK_SSO_ONLY = vorher;
      }
    }
    // Kalibrierung: mit Passwortanmeldung trägt dieselbe Anfrage mit demselben Code.
    const danach = await k.server.inject({
      method: "POST",
      url: "/api/auth/login/second-factor",
      payload: { challenge, code: code(k.secret, k.uhr.jetzt()) },
    });
    expect(danach.statusCode).toBe(200);
    await k.server.close();
  });

  it("Einrichten/Abschalten nur angemeldet; Rücksetzen nur als Admin", async () => {
    const k = await app();
    for (const [method, url] of [
      ["GET", "/api/auth/second-factor"],
      ["POST", "/api/auth/second-factor/setup"],
      ["POST", "/api/auth/second-factor/confirm"],
      ["POST", "/api/auth/second-factor/disable"],
    ] as const) {
      const antwort = await k.server.inject({
        method,
        url,
        ...(method === "POST" ? { payload: {} } : {}),
      });
      expect(antwort.statusCode).toBe(401);
    }
    // Ein Konto ohne zweiten Faktor, aber ohne Adminrecht.
    const bob = await k.service.register({ name: "Bob", email: "bob@x.de", password: PW });
    await k.service.approveUser(bob.id, k.admin.id);
    const bobToken = (await k.service.login({ email: "bob@x.de", password: PW })).token;
    const verboten = await k.server.inject({
      method: "DELETE",
      url: `/api/users/${k.anna.id}/second-factor`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    expect(verboten.statusCode).toBe(403);
    expect(await k.service.secondFactorStatus(k.anna.id)).toEqual({ active: true });

    const status = await k.server.inject({
      method: "GET",
      url: "/api/auth/second-factor",
      headers: { authorization: `Bearer ${bobToken}` },
    });
    expect(status.json()).toEqual({ active: false });
    await k.server.close();
  });
});

describe("Z9 · das Geheimnis bleibt aus dem Prüfprotokoll", () => {
  it("Einrichten, Fehlversuch und Anmelden sind vermerkt — ohne Geheimnis und ohne Code", async () => {
    const k = await kontoMitZweitemFaktor();
    const erster = await k.service.anmelden({ email: "anna@x.de", password: PW });
    if (!("secondFactor" in erster)) {
      throw new Error("Anmeldeanfrage erwartet");
    }
    const richtig = code(k.secret, k.uhr.jetzt());
    const falsch = richtig === "000000" ? "111111" : "000000";
    await expect(
      k.service.anmeldenMitZweitemFaktor(erster.secondFactor.challenge, falsch),
    ).rejects.toBeDefined();
    await k.service.anmeldenMitZweitemFaktor(erster.secondFactor.challenge, richtig);

    const eintraege = await k.audit.list();
    const aktionen = eintraege.map((e) => e.action);
    expect(aktionen).toContain("user.second-factor-enabled");
    expect(aktionen).toContain("auth.second-factor-failed");
    expect(
      eintraege.some(
        (e) =>
          e.action === "auth.login" &&
          (e.payload as { method?: string } | undefined)?.method === "password+totp",
      ),
    ).toBe(true);
    const alles = JSON.stringify(eintraege);
    expect(alles).not.toContain(k.secret);
    expect(alles).not.toContain(richtig);
  });
});
