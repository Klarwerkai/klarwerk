import Fastify from "fastify";
import {
  SignJWT,
  type createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  errors as joseErrors,
} from "jose";
import { describe, expect, it } from "vitest";
import {
  OIDC_JWKS_COOLDOWN_MS,
  OIDC_JWKS_TIMEOUT_MS,
  OIDC_TOKEN_TIMEOUT_MS,
  OIDC_UNREACHABLE_MESSAGE,
  type OidcConfig,
  OidcUnreachableError,
  createOidcProvider,
  createOidcVerifier,
  createTokenExchanger,
  istAnmeldedienstStumm,
} from "../../services/auth/src/oidc";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";

// ================================================================================================
// JOB 2693 D1 — EIN ANMELDEDIENST, DER NICHT ANTWORTET (Befund R2-9)
// ================================================================================================
//
// „Mit einem fetch, das nie aufloest" (Abnahme §5): der Token-Tausch endet nach der Zeitgrenze
// mit „Anmeldedienst antwortet nicht." — nach Sekunden, nicht nach zehn Minuten. Teil C misst es
// an der echten Auth-Route: Flow-Cookies aus /oidc/start, dann der Callback gegen einen Provider,
// dessen fetch haengt. Die Meldung reist als AuthError durch routes.ts (unveraendert, PROs Datei).

const ISSUER = "https://idp.example.com";
const AUDIENCE = "klarwerk-client";

function config(over: Partial<OidcConfig> = {}): OidcConfig {
  return {
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUri: "https://idp.example.com/jwks",
    authorizeUrl: "https://idp.example.com/authorize",
    tokenUrl: "https://idp.example.com/token",
    clientId: "klarwerk-client",
    redirectUri: "https://app.klarwerk.ai/sso/callback",
    roles: { roleClaim: "roles", adminGroup: "kw-admin" },
    ...over,
  };
}

/** Ein fetch, das nie aufloest — es reagiert NUR auf das Abbruchsignal. */
function haengendesFetch() {
  const signale: Array<AbortSignal | undefined> = [];
  const fetchImpl = (_url: string, init: { signal?: AbortSignal }) =>
    new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((_, reject) => {
      signale.push(init.signal);
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  return { fetchImpl, signale };
}

describe("JOB 2693 D1 · A · die Zeitgrenzen", () => {
  it("A1 · die Werte aus der Skizze: 10 s Token-Tausch, 5 s JWKS, 30 s JWKS-Cooldown", () => {
    expect(OIDC_TOKEN_TIMEOUT_MS).toBe(10_000);
    expect(OIDC_JWKS_TIMEOUT_MS).toBe(5_000);
    expect(OIDC_JWKS_COOLDOWN_MS).toBe(30_000);
  });

  it("A2 · der Token-Tausch traegt ein Abbruchsignal und endet nach der Grenze mit der Meldung", async () => {
    const { fetchImpl, signale } = haengendesFetch();
    const tausch = createTokenExchanger(config(), fetchImpl, { tokenMs: 100 });
    const t0 = Date.now();
    await expect(tausch({ code: "c", codeVerifier: "v" })).rejects.toBeInstanceOf(
      OidcUnreachableError,
    );
    const dauer = Date.now() - t0;
    expect(dauer).toBeGreaterThanOrEqual(80);
    expect(dauer).toBeLessThan(2_000);
    expect(signale[0]).toBeInstanceOf(AbortSignal);
  });

  it("A3 · die Meldung ist ein AuthError mit bestehendem Code — nur so kommt sie durch routes.ts", async () => {
    const { fetchImpl } = haengendesFetch();
    const tausch = createTokenExchanger(config(), fetchImpl, { tokenMs: 50 });
    const fehler = await tausch({ code: "c", codeVerifier: "v" }).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(OidcUnreachableError);
    const e = fehler as OidcUnreachableError;
    expect(e.message).toBe("Anmeldedienst antwortet nicht.");
    expect(e.message).toBe(OIDC_UNREACHABLE_MESSAGE);
    // OIDC_INVALID ist kein AuthErrorCode (types.ts) — der Code bleibt der bestehende 401-Code.
    expect(e.code).toBe("INVALID_CREDENTIALS");
  });

  it("A4 · ein antwortender Dienst ist davon unberuehrt: ohne Zeitgrenze kein Fehler", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id_token: "tok" }),
    });
    const tausch = createTokenExchanger(config(), fetchImpl, { tokenMs: 50 });
    await expect(tausch({ code: "c", codeVerifier: "v" })).resolves.toBe("tok");
  });

  it("A5 · andere Fehler bleiben, was sie sind: ein 500 vom Token-Endpoint ist kein „antwortet nicht“", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const tausch = createTokenExchanger(config(), fetchImpl, { tokenMs: 50 });
    const fehler = await tausch({ code: "c", codeVerifier: "v" }).catch((e: unknown) => e);
    expect(fehler).not.toBeInstanceOf(OidcUnreachableError);
    expect((fehler as Error).message).toContain("500");
  });

  it("A6 · JWKS: die Fabrik bekommt timeoutDuration 5000 und cooldownDuration 30000", async () => {
    const gesehen: unknown[] = [];
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "k";
    jwk.alg = "RS256";
    const token = await new SignJWT({ email: "a@b.de" })
      .setProtectedHeader({ alg: "RS256", kid: "k" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(privateKey);
    const verifier = createOidcVerifier(
      { issuer: ISSUER, audience: AUDIENCE, jwksUri: "https://idp.example.com/jwks" },
      undefined,
      {
        createRemoteJwks: ((url: URL, opts: unknown) => {
          gesehen.push({ url: String(url), opts });
          return async () => publicKey;
        }) as unknown as typeof createRemoteJWKSet,
      },
    );
    await expect(verifier.verify(token)).resolves.toMatchObject({ email: "a@b.de" });
    expect(gesehen).toEqual([
      {
        url: "https://idp.example.com/jwks",
        opts: { timeoutDuration: 5_000, cooldownDuration: 30_000 },
      },
    ]);
  });

  it("A7 · ein JWKS-Timeout von jose wird zur selben Meldung", async () => {
    // Ein FORMGUELTIGES Token — jose verwirft ein unlesbares schon vor dem Schluesselabruf.
    const { privateKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ email: "a@b.de" })
      .setProtectedHeader({ alg: "RS256", kid: "k" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(privateKey);
    const verifier = createOidcVerifier(
      { issuer: ISSUER, audience: AUDIENCE, jwksUri: "https://idp.example.com/jwks" },
      async () => {
        throw new joseErrors.JWKSTimeout();
      },
    );
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(OidcUnreachableError);
  });

  it("A8 · die Erkennung: Timeout, Abbruch, JWKS-Timeout und „fetch failed“ ja — alles andere nein", () => {
    expect(istAnmeldedienstStumm(new DOMException("t", "TimeoutError"))).toBe(true);
    expect(istAnmeldedienstStumm(new DOMException("a", "AbortError"))).toBe(true);
    expect(istAnmeldedienstStumm(new joseErrors.JWKSTimeout())).toBe(true);
    expect(istAnmeldedienstStumm(new TypeError("fetch failed"))).toBe(true);
    expect(istAnmeldedienstStumm(new Error("Token-Endpoint antwortete mit 500."))).toBe(false);
    expect(istAnmeldedienstStumm(new joseErrors.JWTExpired("abgelaufen", {}))).toBe(false);
    expect(istAnmeldedienstStumm("kein Fehlerobjekt")).toBe(false);
  });
});

// ================================================================================================
// TEIL C — AN DER ECHTEN AUTH-ROUTE, MIT FLOW-COOKIES
// ================================================================================================

async function authApp(tokenMs: number) {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  const { fetchImpl } = haengendesFetch();
  const provider = createOidcProvider(config(), { fetchImpl, zeitgrenzen: { tokenMs } });
  const app = Fastify();
  app.register(authRoutes(service, { oidc: provider }));
  return app;
}

function cookiesAus(setCookie: string | string[] | undefined): { header: string; state: string } {
  const liste = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const paare = liste.map((c) => c.split(";")[0] ?? "");
  const state = paare.find((p) => p.toLowerCase().includes("state"))?.split("=")[1] ?? "";
  return { header: paare.join("; "), state };
}

describe("JOB 2693 D1 · C · der Callback gegen einen haengenden Anmeldedienst", () => {
  it("C1 · der Mensch liest „Anmeldedienst antwortet nicht.“ — nach Sekunden, mit gueltigen Flow-Cookies", async () => {
    const app = await authApp(200);
    const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start" });
    expect(start.statusCode).toBe(302);
    const { header, state } = cookiesAus(start.headers["set-cookie"]);
    expect(state).not.toBe("");

    const t0 = Date.now();
    const antwort = await app.inject({
      method: "POST",
      url: "/api/auth/oidc",
      headers: { cookie: header },
      payload: { code: "code-vom-idp", state },
    });
    const dauer = Date.now() - t0;

    expect(antwort.statusCode).toBe(401);
    expect(antwort.json()).toEqual({
      error: "INVALID_CREDENTIALS",
      message: "Anmeldedienst antwortet nicht.",
    });
    // Nicht „SSO-Status ungueltig" (400) — die Cookies waren gueltig, der Dienst war stumm.
    expect((antwort.json() as { message: string }).message).not.toContain("SSO-Status");
    expect(dauer).toBeGreaterThanOrEqual(150);
    expect(dauer).toBeLessThan(3_000);
  });

  it("C2 · Gegenprobe: mit verfallenen Flow-Cookies bleibt es „SSO-Status ungueltig“ — das ist ein anderer Fehler", async () => {
    const app = await authApp(200);
    const antwort = await app.inject({
      method: "POST",
      url: "/api/auth/oidc",
      payload: { code: "code-vom-idp", state: "irgendein-state" },
    });
    expect(antwort.statusCode).toBe(400);
    expect((antwort.json() as { message: string }).message).toBe("SSO-Status ungültig.");
  });
});
