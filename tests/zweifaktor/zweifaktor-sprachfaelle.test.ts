// ================================================================================================
// R-0562 · DIE ZWEI-FAKTOR-MELDUNGEN AM DRAHT, AUF ENGLISCH UND NIEDERLÄNDISCH.
// ================================================================================================
//
// `tests/q9-serverfehlertexte/katalogschluessel-herkunft.test.ts` (H4) führt, welche Katalogsätze
// kein aktiver Fall je in EN/NL gegen eine echte Antwort hält. Die Zwei-Faktor-Schlüssel bringen
// ihre Messung mit — wie `ACCESS_EXPIRED`, `SAML_*` und `PASSWORD_LOGIN_DISABLED` vor ihnen: je
// Schlüssel ein Fall, dessen `each`-Tabelle EN und NL wörtlich nennt, und der Satz kommt über
// `MELDUNGEN.<SCHLUESSEL>[sprache]` aus dem Katalog (K5/K5.2). Die Tabellen stehen deshalb
// INNERHALB der `it.each(`-Klammer.
//
// NICHT HIER: `SECOND_FACTOR_REQUIRED`. Ihn wirft nur der alte Dienstweg `AuthService.login`, den
// keine Route mehr für Konten mit zweitem Faktor nimmt (die Anmeldemaske geht über `anmelden`, die
// Ersteinrichtung legt ein frisches Konto ohne zweiten Faktor an). Er bleibt in `OHNE_ROUTENFALL`.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemorySecondFactorRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
  LoginRateLimiter,
  MELDUNGEN,
  authRoutes,
  totpCode,
  totpSchritt,
} from "../../services/auth";

const PW = "secret123";

async function aufbau(limiter?: LoginRateLimiter) {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    secondFactors: new InMemorySecondFactorRepo(),
  });
  const anna = await service.register({ name: "Anna", email: "anna@x.de", password: PW });
  // Die Sitzung entsteht VOR dem Einschalten — danach gäbe `login` keine mehr her.
  const token = (await service.login({ email: "anna@x.de", password: PW })).token;
  const app = Fastify();
  await app.register(authRoutes(service, limiter ? { secondFactorRateLimiter: limiter } : {}));
  const einschalten = async (): Promise<void> => {
    const { secret } = await service.secondFactorSetupStart(anna.id, PW);
    await service.secondFactorSetupConfirm(anna.id, totpCode(secret, totpSchritt(Date.now())));
  };
  return { service, app, anna, token, einschalten };
}

describe("R-0562 · Zwei-Faktor-Meldungen in EN/NL am echten Draht", () => {
  it.each([["en"], ["nl"]] as const)(
    "Z1 SECOND_FACTOR_INVALID · ein falscher Code antwortet 401 auf %s",
    async (sprache) => {
      const k = await aufbau();
      await k.einschalten();
      const erster = await k.app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "anna@x.de", password: PW },
      });
      const challenge = (erster.json() as { challenge: string }).challenge;
      const antwort = await k.app.inject({
        method: "POST",
        url: "/api/auth/login/second-factor",
        headers: { "accept-language": sprache },
        payload: { challenge, code: "kein-code" },
      });
      expect(antwort.statusCode).toBe(401);
      expect(antwort.json().message).toBe(MELDUNGEN.SECOND_FACTOR_INVALID[sprache]);
      await k.app.close();
    },
  );

  it.each([["en"], ["nl"]] as const)(
    "Z2 SECOND_FACTOR_CHALLENGE_INVALID · eine unbekannte Anmeldeanfrage antwortet 401 auf %s",
    async (sprache) => {
      const k = await aufbau();
      const antwort = await k.app.inject({
        method: "POST",
        url: "/api/auth/login/second-factor",
        headers: { "accept-language": sprache },
        payload: { challenge: "unbekannt", code: "123456" },
      });
      expect(antwort.statusCode).toBe(401);
      expect(antwort.json().message).toBe(MELDUNGEN.SECOND_FACTOR_CHALLENGE_INVALID[sprache]);
      await k.app.close();
    },
  );

  it.each([["en"], ["nl"]] as const)(
    "Z3 SECOND_FACTOR_RATE_LIMITED · nach dem Limit antwortet der Codeschritt 429 auf %s",
    async (sprache) => {
      const k = await aufbau(new LoginRateLimiter({ maxAttempts: 1 }));
      const versuch = () =>
        k.app.inject({
          method: "POST",
          url: "/api/auth/login/second-factor",
          headers: { "accept-language": sprache },
          payload: { challenge: "unbekannt", code: "123456" },
        });
      expect((await versuch()).statusCode).toBe(401);
      const antwort = await versuch();
      expect(antwort.statusCode).toBe(429);
      expect(antwort.json().message).toBe(MELDUNGEN.SECOND_FACTOR_RATE_LIMITED[sprache]);
      await k.app.close();
    },
  );

  it.each([["en"], ["nl"]] as const)(
    "Z4 SECOND_FACTOR_ALREADY_ACTIVE · ein zweites Einrichten antwortet 403 auf %s",
    async (sprache) => {
      const k = await aufbau();
      await k.einschalten();
      const antwort = await k.app.inject({
        method: "POST",
        url: "/api/auth/second-factor/setup",
        headers: { "accept-language": sprache, authorization: `Bearer ${k.token}` },
        payload: { password: PW },
      });
      expect(antwort.statusCode).toBe(403);
      expect(antwort.json().message).toBe(MELDUNGEN.SECOND_FACTOR_ALREADY_ACTIVE[sprache]);
      await k.app.close();
    },
  );

  it.each([["en"], ["nl"]] as const)(
    "Z5 SECOND_FACTOR_NOT_ACTIVE · Ausschalten ohne Einrichtung antwortet 403 auf %s",
    async (sprache) => {
      const k = await aufbau();
      const antwort = await k.app.inject({
        method: "POST",
        url: "/api/auth/second-factor/disable",
        headers: { "accept-language": sprache, authorization: `Bearer ${k.token}` },
        payload: { password: PW, code: "123456" },
      });
      expect(antwort.statusCode).toBe(403);
      expect(antwort.json().message).toBe(MELDUNGEN.SECOND_FACTOR_NOT_ACTIVE[sprache]);
      await k.app.close();
    },
  );

  it.each([["en"], ["nl"]] as const)(
    "Z6 SECOND_FACTOR_SETUP_MISSING · Bestätigen ohne begonnene Einrichtung antwortet 403 auf %s",
    async (sprache) => {
      const k = await aufbau();
      const antwort = await k.app.inject({
        method: "POST",
        url: "/api/auth/second-factor/confirm",
        headers: { "accept-language": sprache, authorization: `Bearer ${k.token}` },
        payload: { code: "123456" },
      });
      expect(antwort.statusCode).toBe(403);
      expect(antwort.json().message).toBe(MELDUNGEN.SECOND_FACTOR_SETUP_MISSING[sprache]);
      await k.app.close();
    },
  );

  it.each([["en"], ["nl"]] as const)(
    "Z7 SECOND_FACTOR_PASSWORD_ACCOUNT_ONLY · ein SSO-Konto richtet nichts ein, 403 auf %s",
    async (sprache) => {
      const k = await aufbau();
      const sso = await k.service.loginWithOidc(
        {
          iss: "https://idp.example.test",
          sub: "s-1",
          email: "sso@x.de",
          name: "Sso",
          emailVerified: true,
          rolesClaimPresent: false,
          roles: [],
        } as unknown as Parameters<AuthService["loginWithOidc"]>[0],
        true,
      );
      const antwort = await k.app.inject({
        method: "POST",
        url: "/api/auth/second-factor/setup",
        headers: { "accept-language": sprache, authorization: `Bearer ${sso.token}` },
        payload: { password: "" },
      });
      expect(antwort.statusCode).toBe(403);
      expect(antwort.json().message).toBe(MELDUNGEN.SECOND_FACTOR_PASSWORD_ACCOUNT_ONLY[sprache]);
      await k.app.close();
    },
  );
});
