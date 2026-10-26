import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemorySessionRepo,
  InMemoryUserRepo,
  LoginRateLimiter,
  authRoutes,
  totpCode,
  totpSchritt,
} from "../../services/auth";

async function aufbau(maxAttempts = 10) {
  let now = Date.UTC(2026, 9, 26, 8, 0);
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    now: () => now,
  });
  const app = Fastify();
  await app.register(
    authRoutes(service, {
      secondFactorRateLimiter: new LoginRateLimiter({
        maxAttempts,
        windowMs: 60_000,
        now: () => now,
      }),
    }),
  );
  const credentials = { email: "tara@beleg.test", password: "beleg-passwort-9" };
  const setup = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { name: "Tara", ...credentials },
  });
  expect(setup.statusCode).toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: credentials });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  const factor = await app.inject({
    method: "POST",
    url: "/api/auth/second-factor/setup",
    headers,
    payload: { password: credentials.password },
  });
  expect(factor.statusCode).toBe(200);
  const secret = factor.json().secret as string;
  const code = () => totpCode(secret, totpSchritt(now));
  const confirmed = await app.inject({
    method: "POST",
    url: "/api/auth/second-factor/confirm",
    headers,
    payload: { code: code() },
  });
  expect(confirmed.statusCode).toBe(200);
  now += 30_000;
  const password = async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "10.0.0.1",
      payload: credentials,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().secondFactorRequired).toBe(true);
    expect(res.json().token).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
    return res.json().challenge as string;
  };
  const second = (challenge: string, value: string, ip = "10.0.0.1") =>
    app.inject({
      method: "POST",
      url: "/api/auth/login/second-factor",
      remoteAddress: ip,
      payload: { challenge, code: value },
    });
  return {
    app,
    password,
    second,
    code,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("P7 · Zweitfaktordrossel gehört zur konkreten Anmeldeanfrage", () => {
  it("erfundene und andere Anfragen am selben Proxy sperren die richtige nicht; fünf echte Fehler bleiben endgültig", async () => {
    const k = await aufbau();
    try {
      const target = await k.password();
      const other = await k.password();
      for (let i = 0; i < 10; i += 1) {
        expect((await k.second(`erfunden-${i}`, "kein-code")).statusCode).toBe(401);
      }
      for (let i = 0; i < 5; i += 1) {
        const failed = await k.second(other, "kein-code", `10.0.1.${i + 1}`);
        expect(failed.statusCode).toBe(401);
        expect(failed.headers["set-cookie"]).toBeUndefined();
      }
      const consumed = await k.second(other, k.code(), "10.0.2.1");
      expect(consumed.statusCode).toBe(401);
      expect(consumed.headers["set-cookie"]).toBeUndefined();
      const success = await k.second(target, k.code());
      expect(success.statusCode).toBe(200);
      expect(String(success.headers["set-cookie"])).toContain("kw_session=");
      const me = await k.app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${success.json().token}` },
      });
      expect(me.statusCode).toBe(200);
      const replay = await k.second(target, k.code(), "10.0.2.2");
      expect(replay.statusCode).toBe(401);
      const fresh = await k.password();
      expect((await k.second(fresh, k.code())).statusCode).toBe(401);
      k.advance(30_000);
      expect((await k.second(fresh, k.code())).statusCode).toBe(200);
    } finally {
      await k.app.close();
    }
  });

  it("IP-Wechsel setzt dieselbe Drossel nicht zurück; ihr Zeitfenster und die Anfrage-TTL bleiben wirksam", async () => {
    const k = await aufbau(1);
    try {
      const challenge = await k.password();
      expect((await k.second(challenge, "kein-code")).statusCode).toBe(401);
      const blocked = await k.second(challenge, k.code(), "10.0.2.1");
      expect(blocked.statusCode).toBe(429);
      expect(blocked.headers["retry-after"]).toBe("60");
      expect(blocked.headers["set-cookie"]).toBeUndefined();
      const independent = await k.password();
      expect((await k.second(independent, k.code())).statusCode).toBe(200);
      k.advance(60_000);
      expect((await k.second(challenge, k.code(), "10.0.2.2")).statusCode).toBe(200);
      const expired = await k.password();
      k.advance(5 * 60_000 + 1);
      const invalid = await k.second(expired, k.code());
      expect(invalid.statusCode).toBe(401);
      expect(invalid.headers["set-cookie"]).toBeUndefined();
    } finally {
      await k.app.close();
    }
  });
});
