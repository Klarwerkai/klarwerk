import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

let services: ReturnType<typeof buildServices>;
let app: ReturnType<typeof buildApp>;
const konto = { name: "Sprachtest", email: "sprache@example.test", password: "correct-password" };

function sprachvertrag(message: string, volltext: string, kennwort: RegExp) {
  expect.soft(message).toBe(volltext);
  expect.soft(message).not.toMatch(/Passwort|falsch|angemeldet|Versuche/);
  expect.soft(message).toMatch(kennwort);
}

function login(sprache?: string, email = konto.email) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: sprache ? { "accept-language": sprache } : {},
    payload: { email, password: "wrong-password" },
  });
}

beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: konto });
  expect(setup.statusCode).toBe(201);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

describe("Q9 Sprache am echten Auth-Draht", () => {
  it("R1 Anmeldung EN: falsches Passwort und unbekanntes Konto bleiben unspezifisch", async () => {
    for (const email of [konto.email, "unknown@example.test"]) {
      const res = await login("en", email);
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("INVALID_CREDENTIALS");
      sprachvertrag(res.json().message, "Email or password is incorrect.", /incorrect/);
    }
  });
  it("R2 Anmeldung NL", async () => {
    const res = await login("nl");
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
    sprachvertrag(res.json().message, "E-mailadres of wachtwoord is onjuist.", /wachtwoord/);
  });
  it.each([undefined, "fr"])(
    "R3 Rückfall DE: %s (bestehender Regressionsschutz)",
    async (sprache) => {
      const res = await login(sprache);
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        error: "INVALID_CREDENTIALS",
        message: "E-Mail oder Passwort falsch.",
      });
    },
  );
  it("R4 Zurücksetzen EN: tatsächlich ausgestellter und abgelaufener Token", async () => {
    const reset = await services.auth.requestPasswordReset(konto.email);
    expect(reset?.token).toBeTruthy();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61 * 60_000);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      headers: { "accept-language": "en" },
      payload: { token: reset?.token, newPassword: "new-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
    sprachvertrag(
      res.json().message,
      "The password reset link is invalid or has expired.",
      /expired/,
    );
  });
  it("R5 Anmeldung 429 EN: echte Fehlversuche überschreiten das Limit", async () => {
    for (let i = 0; i < 5; i++) expect((await login("en")).statusCode).toBe(401);
    const res = await login("en");
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    sprachvertrag(
      res.json().message,
      "Too many sign-in attempts. Please try again later.",
      /sign-in attempts/,
    );
  });
  it("R5b Zurücksetzen 429 EN: eigener Zähler", async () => {
    const reset = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/reset",
        headers: { "accept-language": "en" },
        payload: { token: "invalid", newPassword: "new-password" },
      });
    for (let i = 0; i < 10; i++) expect((await reset()).statusCode).toBe(401);
    const res = await reset();
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    sprachvertrag(res.json().message, "Too many attempts. Please try again later.", /attempts/);
    expect((await login("en")).statusCode).toBe(401);
  });
  it.each(["en-GB,en;q=0.9", "de;q=0.2,en;q=0.9", "nl;q=0,en;q=0.5"])(
    "R8 zusammengesetzter Kopf %s",
    async (sprache) => {
      const res = await login(sprache);
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("INVALID_CREDENTIALS");
      sprachvertrag(res.json().message, "Email or password is incorrect.", /incorrect/);
    },
  );
  it.each([
    ["en", "Your account has not been approved yet.", /approved/],
    ["nl", "Je account is nog niet goedgekeurd.", /goedgekeurd/],
  ] as const)("R9 gesperrtes Konto %s", async (sprache, text, wort) => {
    const email = "pending@example.test";
    await services.auth.register({ ...konto, email });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "accept-language": sprache },
      payload: { email, password: konto.password },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("NOT_APPROVED");
    sprachvertrag(res.json().message, text, wort);
  });
  it.each([
    ["en", "Password must be at least 8 characters long.", /characters/],
    ["nl", "Het wachtwoord moet minstens 8 tekens lang zijn.", /tekens/],
  ] as const)("R10 kurzes Passwort %s", async (sprache, text, wort) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      headers: { "accept-language": sprache },
      payload: { token: "invalid", newPassword: "short" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("WEAK_PASSWORD");
    sprachvertrag(res.json().message, text, wort);
  });
  it("R11 Auth-Guard EN", async () => {
    const res = await app.inject({ url: "/api/auth/me", headers: { "accept-language": "en" } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("INVALID_CREDENTIALS");
    sprachvertrag(res.json().message, "You are not signed in.", /signed in/);
  });
  it("R12 Auffangfehler EN verbirgt interne Details", async () => {
    vi.spyOn(services.auth, "login").mockRejectedValueOnce(new Error("internal diagnostic"));
    const res = await login("en");
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe("INTERNAL");
    sprachvertrag(res.json().message, "An unexpected error occurred.", /unexpected/);
  });
});
