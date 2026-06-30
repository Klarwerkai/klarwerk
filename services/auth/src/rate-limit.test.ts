import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { LoginRateLimiter } from "./rate-limit";
import { InMemorySessionRepo, InMemoryUserRepo } from "./repo";
import { authRoutes } from "./routes";
import { AuthService } from "./service";

// SCRUM-356 / AG-06 / NFR-SEC-04: serverseitiger Login-Brute-Force-/Rate-Limit-Schutz.
// Belegt: erfolgreicher Login bleibt möglich; wiederholte Fehlversuche → 429 + Retry-After;
// nach Fenster/Reset wieder möglich; keine User-Enumeration.

function buildApp(limiter: LoginRateLimiter) {
  const users = new InMemoryUserRepo();
  const sessions = new InMemorySessionRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const service = new AuthService({ users, sessions, audit });
  const app = Fastify();
  app.register(authRoutes(service, { loginRateLimiter: limiter }));
  return { app, service };
}

async function login(app: ReturnType<typeof buildApp>["app"], email: string, password: string) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
}

describe("SCRUM-356: LoginRateLimiter (Einheit)", () => {
  it("normalisiert den Schlüssel (IP + getrimmte, kleingeschriebene Login-ID)", () => {
    const limiter = new LoginRateLimiter();
    expect(limiter.keyFor("1.2.3.4", "  A@x.de ")).toBe("1.2.3.4|a@x.de");
    expect(limiter.keyFor(undefined, null)).toBe("unknown|");
  });

  it("sperrt erst ab maxAttempts und gibt eine positive Retry-After-Zeit", () => {
    const clock = 0;
    const limiter = new LoginRateLimiter({ maxAttempts: 3, windowMs: 1000, now: () => clock });
    const key = limiter.keyFor("9.9.9.9", "a@x.de");
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.check(key).limited).toBe(false);
      limiter.registerFailure(key);
    }
    const decision = limiter.check(key);
    expect(decision.limited).toBe(true);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    // Erfolg/Reset macht den Schlüssel sofort wieder frei.
    limiter.reset(key);
    expect(limiter.check(key).limited).toBe(false);
  });

  it("gibt den Schlüssel nach Ablauf des Fensters wieder frei (TTL)", () => {
    let clock = 0;
    const limiter = new LoginRateLimiter({ maxAttempts: 2, windowMs: 1000, now: () => clock });
    const key = limiter.keyFor("9.9.9.9", "a@x.de");
    limiter.registerFailure(key);
    limiter.registerFailure(key);
    expect(limiter.check(key).limited).toBe(true);
    clock += 1000; // Fenster abgelaufen
    expect(limiter.check(key).limited).toBe(false);
  });
});

describe("SCRUM-356: Login-Rate-Limit über die HTTP-Route", () => {
  it("erfolgreicher Login bleibt möglich (kein unnötiges Blockieren)", async () => {
    const { app, service } = buildApp(new LoginRateLimiter({ maxAttempts: 3, windowMs: 1000 }));
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    const ok = await login(app, "admin@x.de", "secret123");
    expect(ok.statusCode).toBe(200);
    expect(ok.json().token).toBeTruthy();
    await app.close();
  });

  it("wiederholte falsche Logins → 429 + Retry-After, korrekte Semantik bis dahin (401)", async () => {
    const { app, service } = buildApp(new LoginRateLimiter({ maxAttempts: 3, windowMs: 60_000 }));
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });

    // Erste drei Fehlversuche: normale Login-Fehlersemantik (401), kein Block.
    for (let i = 0; i < 3; i += 1) {
      const res = await login(app, "admin@x.de", "falsch");
      expect(res.statusCode).toBe(401);
    }
    // Vierter Versuch: gesperrt.
    const blocked = await login(app, "admin@x.de", "falsch");
    expect(blocked.statusCode).toBe(429);
    const retryAfter = Number(blocked.headers["retry-after"]);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    // Meldung bleibt generisch (keine Detail-/Existenzpreisgabe).
    expect(blocked.json().error).toBe("RATE_LIMITED");
    expect(blocked.body).not.toContain("admin@x.de");
    await app.close();
  });

  it("erfolgreicher Login setzt den Fehlversuchszähler zurück", async () => {
    const { app, service } = buildApp(new LoginRateLimiter({ maxAttempts: 3, windowMs: 60_000 }));
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });

    await login(app, "admin@x.de", "falsch");
    await login(app, "admin@x.de", "falsch"); // Zähler = 2
    const ok = await login(app, "admin@x.de", "secret123"); // Erfolg → Reset
    expect(ok.statusCode).toBe(200);

    // Nach dem Reset sind erneut volle drei Fehlversuche möglich, ohne sofort zu sperren.
    for (let i = 0; i < 3; i += 1) {
      const res = await login(app, "admin@x.de", "falsch");
      expect(res.statusCode).toBe(401);
    }
    await app.close();
  });

  it("nach Ablauf des Fensters ist der Login wieder möglich", async () => {
    let clock = 0;
    const limiter = new LoginRateLimiter({ maxAttempts: 2, windowMs: 1000, now: () => clock });
    const { app, service } = buildApp(limiter);
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });

    await login(app, "admin@x.de", "falsch");
    await login(app, "admin@x.de", "falsch");
    expect((await login(app, "admin@x.de", "falsch")).statusCode).toBe(429);

    clock += 1000; // Fenster abgelaufen
    const ok = await login(app, "admin@x.de", "secret123");
    expect(ok.statusCode).toBe(200);
    await app.close();
  });

  it("keine User-Enumeration: bekannte und unbekannte E-Mail liefern identische Statusfolge", async () => {
    const known = buildApp(new LoginRateLimiter({ maxAttempts: 3, windowMs: 60_000 }));
    const unknown = buildApp(new LoginRateLimiter({ maxAttempts: 3, windowMs: 60_000 }));
    await known.service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    await unknown.service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });

    const knownSeq: number[] = [];
    const unknownSeq: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      knownSeq.push((await login(known.app, "admin@x.de", "falsch")).statusCode); // existiert, falsches PW
      unknownSeq.push((await login(unknown.app, "niemand@x.de", "falsch")).statusCode); // existiert nicht
    }
    // Beide: 401, 401, 401, 429 — kein unterscheidbares Signal über die Kontoexistenz.
    expect(knownSeq).toEqual([401, 401, 401, 429]);
    expect(unknownSeq).toEqual(knownSeq);
    await known.app.close();
    await unknown.app.close();
  });

  it("NOT_APPROVED (korrektes Passwort, Konto nicht freigegeben) zählt NICHT als Brute-Force", async () => {
    const { app, service } = buildApp(new LoginRateLimiter({ maxAttempts: 3, windowMs: 60_000 }));
    // Erstes Konto ist Admin/approved; zweites ist bis zur Freigabe gesperrt.
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    await service.register({ name: "Bob", email: "bob@x.de", password: "secret123" });

    // Mehr Versuche als maxAttempts, aber mit KORREKTEM Passwort → immer 403, nie 429.
    for (let i = 0; i < 5; i += 1) {
      const res = await login(app, "bob@x.de", "secret123");
      expect(res.statusCode).toBe(403);
    }
    await app.close();
  });
});
