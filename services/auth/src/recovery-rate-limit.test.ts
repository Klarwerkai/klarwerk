import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { ConsoleMailer } from "../../notifications";
import { LoginRateLimiter } from "./rate-limit";
import { InMemorySessionRepo, InMemoryUserRepo } from "./repo";
import { authRoutes } from "./routes";
import { AuthService } from "./service";

// SCRUM-367 / AG-06-RESET / NFR-SEC-04: Recovery-Pfade gegen Mail-Spam (forgot) und Token-Bruteforce
// (reset) gedrosselt — OHNE die bestehende Semantik zu brechen: forgot bleibt IMMER 204 (keine
// Enumeration), reset liefert bei Sperre 429 + Retry-After, ohne Token-Existenz zu verraten.
function buildApp(recoveryLimiter: LoginRateLimiter) {
  const users = new InMemoryUserRepo();
  const sessions = new InMemorySessionRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const service = new AuthService({ users, sessions, audit });
  const mailer = new ConsoleMailer();
  const app = Fastify();
  app.register(authRoutes(service, { recoveryRateLimiter: recoveryLimiter, mailer }));
  return { app, service, mailer };
}

const forgot = (app: ReturnType<typeof buildApp>["app"], email: string) =>
  app.inject({ method: "POST", url: "/api/auth/forgot", payload: { email } });

const reset = (app: ReturnType<typeof buildApp>["app"], token: string) =>
  app.inject({
    method: "POST",
    url: "/api/auth/reset",
    payload: { token, newPassword: "neupass123" },
  });

describe("SCRUM-367: Recovery rate-limit (forgot/reset)", () => {
  it("forgot: bleibt IMMER 204; bei Überschreitung wird KEINE weitere Mail versendet (keine Enumeration)", async () => {
    const { app, mailer } = buildApp(new LoginRateLimiter({ maxAttempts: 2 }));
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "U", email: "known@x.de", password: "altpass123" },
    });

    // Erste zwei Anforderungen für ein bekanntes Konto → 204 + je eine Mail.
    for (let i = 0; i < 2; i++) {
      const res = await forgot(app, "known@x.de");
      expect(res.statusCode).toBe(204);
    }
    expect(mailer.sent).toHaveLength(2);

    // Dritte Anforderung ist limitiert → weiterhin 204 (keine Statusänderung), aber KEINE neue Mail.
    const third = await forgot(app, "known@x.de");
    expect(third.statusCode).toBe(204);
    expect(mailer.sent).toHaveLength(2);
  });

  it("reset: wiederholte fehlgeschlagene Einlösungen → 429 + Retry-After (Token-Bruteforce gedrosselt)", async () => {
    const { app } = buildApp(new LoginRateLimiter({ maxAttempts: 2 }));

    // Zwei ungültige Token → Fehler (kein 429 noch).
    const r1 = await reset(app, "ungueltig-1");
    expect(r1.statusCode).toBeGreaterThanOrEqual(400);
    expect(r1.statusCode).not.toBe(429);
    const r2 = await reset(app, "ungueltig-2");
    expect(r2.statusCode).toBeGreaterThanOrEqual(400);

    // Dritter Versuch ist gesperrt → 429 + Retry-After; verrät nichts über Token-Existenz.
    const r3 = await reset(app, "ungueltig-3");
    expect(r3.statusCode).toBe(429);
    expect(Number(r3.headers["retry-after"])).toBeGreaterThan(0);
    expect(r3.json().error).toBe("RATE_LIMITED");
  });

  it("forgot/reset teilen sich nicht den Zähler (getrennte Schlüssel)", async () => {
    const { app } = buildApp(new LoginRateLimiter({ maxAttempts: 1 }));
    // 1 forgot verbraucht das forgot-Budget …
    expect((await forgot(app, "a@x.de")).statusCode).toBe(204);
    // … reset bleibt davon unberührt und darf seinen ersten Versuch noch machen (kein 429).
    const r = await reset(app, "irgendwas");
    expect(r.statusCode).not.toBe(429);
  });
});
