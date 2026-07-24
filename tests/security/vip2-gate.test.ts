// WP-VIP2-GATE (bens Gesamtreview 21.07., Teil B — live-relevanter P1-Sicherheits-Slice):
// 1. Selbstregistrierung fail-closed hinter KLARWERK_SELF_REGISTRATION (Default AUS) + Body-Schema
//    + Rate-Limit 5/Minute/IP + asynchrones pbkdf2 (GLEICHE Parameter — alte Hashes bleiben gültig).
// 2. Token-at-Rest: Session-/Reset-Tokens liegen NUR als sha256:-Hash im Repo; Klartext-Bestand
//    wird beim Start idempotent in-place migriert (Format-Erkennung über das Präfix).
// 3. Cookie-Härtung: NODE_ENV=production erzwingt Secure; explizites COOKIE_SECURE=false in
//    Produktion bricht den Start fail-closed ab.
// 4. /api/ai-status + /api/reasoner/status sind abstrahiert: nur {active, mode} — Provider-/
//    Modellnamen NUR in der ECHTEN Admin-Sicht (/api/reasoner/config, users.manage — Fix 3/4 in
//    WP-VIP2-GATE-2 zog den Guard nach; vorher galt dort nur Authentifizierung).
import { pbkdf2Sync } from "node:crypto";
import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  AuthService,
  InMemoryPasswordResetRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
  REGISTER_MAX_ATTEMPTS_PER_MINUTE,
  TOKEN_HASH_PREFIX,
  assertCookieSecurityConfig,
  hashTokenAtRest,
  migrateAuthTokensAtRest,
  selfRegistrationEnabled,
} from "../../services/auth";
import { verifyPassword } from "../../services/auth/src/password";
import { ModelProvider, Reasoner } from "../../services/reasoner";

const REGISTER = {
  method: "POST" as const,
  url: "/api/auth/register",
};

function payload(overrides: Record<string, unknown> = {}) {
  return { name: "Pedi", email: "p@x.de", password: "secret123", ...overrides };
}

// Env-Werte je Test sichern/wiederherstellen (die Suite setzt KLARWERK_SELF_REGISTRATION=1 global
// in tests/setup-env.ts — Tests des AUS-Verhaltens löschen sie LOKAL).
function withEnv(key: string, value: string | undefined, run: () => Promise<void>): Promise<void> {
  const saved = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  return run().finally(() => {
    if (saved === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved;
    }
  });
}

describe("WP-VIP2-GATE B1: Selbstregistrierung fail-closed + Schema + Rate-Limit + pbkdf2 async", () => {
  it("Schalter AUS (Default) → 403 REGISTRATION_DISABLED und es entsteht KEIN Konto", async () => {
    await withEnv("KLARWERK_SELF_REGISTRATION", undefined, async () => {
      expect(selfRegistrationEnabled()).toBe(false);
      const services = buildServices();
      const app = buildApp(services);
      const res = await app.inject({ ...REGISTER, payload: payload() });
      expect(res.statusCode).toBe(403);
      expect((res.json() as { error: string }).error).toBe("REGISTRATION_DISABLED");
      expect((res.json() as { message: string }).message).toContain("Einladung");
      // Kein Konto entstanden: die Instanz gilt weiter als uneingerichtet.
      expect(await services.auth.needsSetup()).toBe(true);
      // Ersteinrichtung (/api/auth/setup) bleibt vom Schalter unberührt.
      const setup = await app.inject({
        method: "POST",
        url: "/api/auth/setup",
        payload: payload(),
      });
      expect(setup.statusCode).toBe(201);
    });
  });

  it("nur explizites =1/true schaltet frei; alles andere bleibt AUS", () => {
    expect(selfRegistrationEnabled({ KLARWERK_SELF_REGISTRATION: "1" })).toBe(true);
    expect(selfRegistrationEnabled({ KLARWERK_SELF_REGISTRATION: "true" })).toBe(true);
    expect(selfRegistrationEnabled({ KLARWERK_SELF_REGISTRATION: "0" })).toBe(false);
    expect(selfRegistrationEnabled({ KLARWERK_SELF_REGISTRATION: "yes" })).toBe(false);
    expect(selfRegistrationEnabled({})).toBe(false);
  });

  it("Body-Schema: fehlender Name / kaputte E-Mail / kurzes Passwort → ehrlicher 400", async () => {
    const app = buildApp(buildServices());
    const noName = await app.inject({ ...REGISTER, payload: payload({ name: "  " }) });
    expect(noName.statusCode).toBe(400);
    const badMail = await app.inject({ ...REGISTER, payload: payload({ email: "keine-mail" }) });
    expect(badMail.statusCode).toBe(400);
    expect((badMail.json() as { message: string }).message).toContain("E-Mail");
    const shortPw = await app.inject({ ...REGISTER, payload: payload({ password: "kurz" }) });
    expect(shortPw.statusCode).toBe(400);
    expect((shortPw.json() as { error: string }).error).toBe("WEAK_PASSWORD");
  });

  it("Rate-Limit: ab dem 6. Versuch je IP/Minute → 429 + Retry-After (Konstante 5 gepinnt)", async () => {
    expect(REGISTER_MAX_ATTEMPTS_PER_MINUTE).toBe(5);
    const app = buildApp(buildServices());
    for (let i = 0; i < REGISTER_MAX_ATTEMPTS_PER_MINUTE; i += 1) {
      const res = await app.inject({
        ...REGISTER,
        payload: payload({ email: `n${i}@x.de`, name: `N${i}` }),
      });
      expect(res.statusCode).toBe(201);
    }
    const blocked = await app.inject({ ...REGISTER, payload: payload({ email: "n6@x.de" }) });
    expect(blocked.statusCode).toBe(429);
    expect((blocked.json() as { error: string }).error).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("Hash-Kompatibilität: ein mit pbkdf2Sync erzeugter BESTANDS-Hash verifiziert über die neue async-Variante", async () => {
    // Exakt die historischen Parameter (100k Iterationen, 32 Byte, sha256) — kein Algorithmuswechsel.
    const salt = "00ff00ff00ff00ff00ff00ff00ff00ff";
    const legacyHash = pbkdf2Sync("secret123", salt, 100_000, 32, "sha256").toString("hex");
    expect(await verifyPassword("secret123", salt, legacyHash)).toBe(true);
    expect(await verifyPassword("falsch123", salt, legacyHash)).toBe(false);
  });
});

describe("WP-VIP2-GATE B2: Token-at-Rest — nur Hashes im Repo, Migration idempotent", () => {
  function freshAuth() {
    const sessions = new InMemorySessionRepo();
    const resets = new InMemoryPasswordResetRepo();
    const service = new AuthService({
      users: new InMemoryUserRepo(),
      sessions,
      resetTokens: resets,
    });
    return { service, sessions, resets };
  }

  it("Login: das Repo enthält NUR den sha256:-Hash; Klartext-Lookup findet nichts, authenticate funktioniert", async () => {
    const { service, sessions } = freshAuth();
    await service.register(payload());
    const { token } = await service.login({ email: "p@x.de", password: "secret123" });
    // Klartext ist NICHT der Speicher-Schlüssel …
    expect(await sessions.find(token)).toBeUndefined();
    // … der Hash schon; Format-Erkennung über das Präfix.
    const stored = await sessions.find(hashTokenAtRest(token));
    expect(stored).toBeDefined();
    expect(stored?.token.startsWith(TOKEN_HASH_PREFIX)).toBe(true);
    // Der Client-Klartext authentifiziert unverändert (Service hasht beim Lookup).
    expect((await service.authenticate(token))?.email).toBe("p@x.de");
    // Logout löscht über denselben Hash-Weg.
    await service.logout(token);
    expect(await service.authenticate(token)).toBeUndefined();
  });

  it("Reset-Flow unverändert: Mail-Link trägt Klartext, Repo nur den Hash, Einlösen funktioniert", async () => {
    const { service, resets } = freshAuth();
    await service.register(payload());
    const requested = await service.requestPasswordReset("p@x.de");
    expect(requested).toBeDefined();
    const plain = (requested as { token: string }).token;
    expect(plain.startsWith(TOKEN_HASH_PREFIX)).toBe(false); // der Link bleibt Klartext
    expect(await resets.find(plain)).toBeUndefined(); // at rest liegt NUR der Hash
    expect(await resets.find(hashTokenAtRest(plain))).toBeDefined();
    await service.resetPasswordWithToken(plain, "ganzNeu123");
    const { token } = await service.login({ email: "p@x.de", password: "ganzNeu123" });
    expect((await service.authenticate(token))?.email).toBe("p@x.de");
    // Eingelöster Token ist weg.
    expect(await resets.find(hashTokenAtRest(plain))).toBeUndefined();
  });

  // Schlanker Fake-Pool für die Node-seitige Migrationsschleife (die vier Query-Formen der
  // Funktion). Kein Docker — der echte Pg-Weg nutzt exakt dieselben SQL-Formen.
  function fakePool(initial: {
    sessions: { token: string; expires_at: number }[];
    password_resets: { token: string; expires_at: number }[];
  }) {
    const tables = initial;
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        const table = sql.includes("password_resets") ? "password_resets" : "sessions";
        if (sql.startsWith("DELETE FROM")) {
          const now = params[0] as number;
          tables[table] = tables[table].filter((r) => r.expires_at > now);
          return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith("SELECT token FROM")) {
          const prefix = (params[0] as string).replace("%", "");
          return {
            rows: tables[table]
              .filter((r) => !r.token.startsWith(prefix))
              .map((r) => ({ token: r.token })),
            rowCount: 0,
          };
        }
        if (sql.startsWith("UPDATE")) {
          const [oldToken, newToken] = params as [string, string];
          for (const row of tables[table]) {
            if (row.token === oldToken) {
              row.token = newToken;
            }
          }
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`Unerwartetes SQL im Fake-Pool: ${sql}`);
      },
    };
    return { pool: pool as unknown as Pool, tables };
  }

  it("Migration: Klartext-Zeilen werden in-place gehasht, Gehashtes bleibt, Abgelaufenes fliegt — idempotent", async () => {
    const nowMs = 1_000_000;
    const plainSession = "a".repeat(64); // Klartext-Token sind praefixlose 64-Hex
    const alreadyHashed = hashTokenAtRest("b".repeat(64));
    const { pool, tables } = fakePool({
      sessions: [
        { token: plainSession, expires_at: nowMs + 1000 },
        { token: alreadyHashed, expires_at: nowMs + 1000 },
        { token: "c".repeat(64), expires_at: nowMs - 1 }, // abgelaufen → aufräumen statt hashen
      ],
      password_resets: [{ token: "d".repeat(64), expires_at: nowMs + 1000 }],
    });
    const first = await migrateAuthTokensAtRest(pool, nowMs);
    expect(first).toEqual({ hashedSessions: 1, hashedResets: 1 });
    expect(tables.sessions.map((r) => r.token).sort()).toEqual(
      [hashTokenAtRest(plainSession), alreadyHashed].sort(),
    );
    expect(tables.password_resets[0]?.token).toBe(hashTokenAtRest("d".repeat(64)));
    // Alter Klartext-Bestand funktioniert weiter: der Service sucht per hashTokenAtRest(clientToken)
    // — genau der Wert, der jetzt in der Zeile steht.
    expect(tables.sessions).toContainEqual({
      token: hashTokenAtRest(plainSession),
      expires_at: nowMs + 1000,
    });
    // Idempotent: der zweite Lauf findet nichts mehr (Format-Erkennung via Präfix).
    const second = await migrateAuthTokensAtRest(pool, nowMs);
    expect(second).toEqual({ hashedSessions: 0, hashedResets: 0 });
  });

  it("abgelaufene Sitzung wird beim Zugriff aufgeräumt (nicht nur verweigert)", async () => {
    let clock = 1_000_000;
    const sessions = new InMemorySessionRepo();
    const service = new AuthService({
      users: new InMemoryUserRepo(),
      sessions,
      now: () => clock,
    });
    await service.register(payload());
    const { token } = await service.login({ email: "p@x.de", password: "secret123" });
    clock += 15 * 24 * 60 * 60 * 1000; // über die 14-Tage-TTL
    expect(await service.authenticate(token)).toBeUndefined();
    expect(await sessions.find(hashTokenAtRest(token))).toBeUndefined();
  });
});

describe("WP-VIP2-GATE B3: Cookie-Härtung — Secure in Produktion erzwungen", () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedCookieSecure = process.env.COOKIE_SECURE;

  afterEach(() => {
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
    if (savedCookieSecure === undefined) {
      delete process.env.COOKIE_SECURE;
    } else {
      process.env.COOKIE_SECURE = savedCookieSecure;
    }
  });

  async function loginCookie(): Promise<string> {
    const app = buildApp(buildServices());
    await app.inject({ ...REGISTER, payload: payload() });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "p@x.de", password: "secret123" },
    });
    expect(login.statusCode).toBe(200);
    return String(login.headers["set-cookie"] ?? "");
  }

  it("NODE_ENV=production → Set-Cookie trägt Secure, auch OHNE COOKIE_SECURE", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.COOKIE_SECURE;
    expect(await loginCookie()).toContain("Secure");
  });

  it("Produktion + COOKIE_SECURE=false → Start bricht fail-closed mit klarer Meldung ab", () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";
    expect(() => buildApp(buildServices())).toThrow(/COOKIE_SECURE=false.*nicht erlaubt/);
    // Pure Variante für gezielte Konfig-Prüfungen:
    expect(() =>
      assertCookieSecurityConfig({ NODE_ENV: "production", COOKIE_SECURE: "false" }),
    ).toThrow();
    expect(() =>
      assertCookieSecurityConfig({ NODE_ENV: "production", COOKIE_SECURE: undefined }),
    ).not.toThrow();
    expect(() =>
      assertCookieSecurityConfig({ NODE_ENV: "test", COOKIE_SECURE: "false" }),
    ).not.toThrow();
  });

  it("außerhalb von Produktion: Bestandsverhalten (Opt-in via COOKIE_SECURE=true, sonst ohne Secure)", async () => {
    delete process.env.COOKIE_SECURE;
    expect(await loginCookie()).not.toContain("Secure");
    process.env.COOKIE_SECURE = "true";
    expect(await loginCookie()).toContain("Secure");
  });
});

describe("WP-VIP2-GATE B4: /api/ai-status + /api/reasoner/status sind abstrahiert", () => {
  function modelServices(): AppServices {
    const services = buildServices();
    services.reasoner = new Reasoner(
      new ModelProvider({
        name: "anthropic:claude-geheim-modellname",
        complete: async () => "{}",
      }),
    );
    return services;
  }

  it("anonym: nur {active, mode} — KEIN Provider-/Modellname im Body", async () => {
    const app = buildApp(modelServices());
    const status = await app.inject({ method: "GET", url: "/api/reasoner/status" });
    expect(status.statusCode).toBe(200);
    // PAKET 2 (D-AISTATE): zusätzlich der ehrliche Erreichbarkeits-Zustand — eine STUFE (kein Provider-/
    // Modellname). Der genaue Wert hängt vom (feuern-und-vergessen) Probe-Timing ab; sicherheitsrelevant
    // ist NUR, dass keine Infrastruktur-Kennung durchsickert — die Stufe ist ein Aufzählungswert.
    const statusBody = status.json() as {
      active: boolean;
      mode: string;
      reachable: string;
      tasks: Record<string, boolean>;
    };
    expect(statusBody.active).toBe(true);
    expect(statusBody.mode).toBe("cloud");
    expect(["none", "unverified", "active", "unreachable"]).toContain(statusBody.reachable);
    // PAKET 3 (D-AISTATE, bens V4): abstrakte per-Task-Karte — NUR Booleans, KEIN Provider-/Modellname.
    expect(typeof statusBody.tasks).toBe("object");
    expect(Object.values(statusBody.tasks).every((v) => typeof v === "boolean")).toBe(true);
    expect(statusBody.tasks.answer).toBe(true); // Modell konfiguriert → Aufgaben cloud-fähig
    expect(status.body).not.toContain("anthropic");
    expect(status.body).not.toContain("claude-geheim-modellname");
    const ai = await app.inject({ method: "GET", url: "/api/ai-status" });
    expect(ai.statusCode).toBe(200);
    const aiBody = (ai.json() as { ai: { active: boolean; mode: string; reachable: string } }).ai;
    expect(aiBody.active).toBe(true);
    expect(aiBody.mode).toBe("cloud");
    expect(["none", "unverified", "active", "unreachable"]).toContain(aiBody.reachable);
    expect(ai.body).not.toContain("anthropic");
  });

  it("ohne Modell: {active:false, mode:deterministic} + alle Aufgaben deterministisch (false)", async () => {
    // Explizit OHNE Modell (unabhängig davon, ob die Dev-Umgebung einen Cloud-Key im Schlüsselbund hat).
    const services = buildServices();
    services.reasoner = new Reasoner();
    const app = buildApp(services);
    const status = await app.inject({ method: "GET", url: "/api/reasoner/status" });
    const body = status.json() as {
      active: boolean;
      mode: string;
      reachable: string;
      tasks: Record<string, boolean>;
    };
    expect(body.active).toBe(false);
    expect(body.mode).toBe("deterministic");
    expect(body.reachable).toBe("none");
    // PAKET 3 (bens V4): ohne Modell ist JEDE Aufgabe deterministisch (false) — kein Fake-„KI nutzbar".
    expect(Object.values(body.tasks).length).toBeGreaterThan(0);
    expect(Object.values(body.tasks).every((v) => v === false)).toBe(true);
  });

  // WP-VIP2-GATE-2 (bens Fix 3): /api/reasoner/config ist jetzt ECHTE Admin-Sicht (users.manage) —
  // ein normaler Leseberechtigter (experte, ko.read) bekommt 403; die KI-Pille normaler Nutzer
  // laeuft ueber den abstrahierten oeffentlichen Status (oben getestet).
  it("ECHTE Admin-Sicht: /api/reasoner/config nennt den Provider — 401 anonym, 403 fuer ko.read-Rollen, 200 fuer Admin", async () => {
    const app = buildApp(modelServices());
    const anonymous = await app.inject({ method: "GET", url: "/api/reasoner/config" });
    expect(anonymous.statusCode).toBe(401);
    // Erster Registrierter = Bootstrap-Admin.
    await app.inject({ ...REGISTER, payload: payload() });
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "p@x.de", password: "secret123" },
    });
    const adminHeaders = {
      authorization: `Bearer ${(adminLogin.json() as { token: string }).token}`,
    };
    const config = await app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: adminHeaders,
    });
    expect(config.statusCode).toBe(200);
    expect((config.json() as { provider: string }).provider).toContain("anthropic");
    // Zweiter Nutzer (experte, vom Admin freigegeben — hat ko.read, aber NICHT users.manage).
    const expert = await app.inject({
      ...REGISTER,
      payload: payload({ email: "e@x.de", name: "Erik" }),
    });
    await app.inject({
      method: "POST",
      url: `/api/auth/users/${(expert.json() as { id: string }).id}/approve`,
      headers: adminHeaders,
    });
    const expertLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "e@x.de", password: "secret123" },
    });
    const expertConfig = await app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: { authorization: `Bearer ${(expertLogin.json() as { token: string }).token}` },
    });
    expect(expertConfig.statusCode).toBe(403);
    // Der oeffentliche abstrahierte Status (die Quelle der KI-Pille) bleibt fuer alle nutzbar.
    const publicStatus = await app.inject({
      method: "GET",
      url: "/api/reasoner/status",
      headers: { authorization: `Bearer ${(expertLogin.json() as { token: string }).token}` },
    });
    const pub = publicStatus.json() as { active: boolean; mode: string; reachable: string };
    expect(pub.active).toBe(true);
    expect(pub.mode).toBe("cloud");
    expect(["none", "unverified", "active", "unreachable"]).toContain(pub.reachable);
  });
});

// WP-VIP2-GATE-2 (bens Fix 2): UEBERGANGSWEISER Dual-Read der Token-Suche — ein paralleler
// Altprozess (Rolling-Deploy) darf Klartext-Zeilen schreiben, ohne dass Nutzer ausgesperrt werden.
describe("WP-VIP2-GATE-2 Fix 2: Dual-Read mit In-Place-Rehashing (Deploy-Uebergang)", () => {
  it("Session: Klartext-Alt-Zeile wird via Dual-Read gefunden und SOFORT auf den Hash umgezogen", async () => {
    const sessions = new InMemorySessionRepo();
    const users = new InMemoryUserRepo();
    const service = new AuthService({ users, sessions });
    const created = await service.register(payload());
    // Altprozess-Simulation: eine KLARTEXT-Session-Zeile (wie vor der Token-at-Rest-Umstellung).
    const plainToken = "a".repeat(64);
    await sessions.create({
      token: plainToken,
      userId: created.id,
      expiresAt: Date.now() + 60_000,
    });
    // Dual-Read: der Klartext-Client-Token authentifiziert …
    expect((await service.authenticate(plainToken))?.email).toBe("p@x.de");
    // … und die Zeile liegt danach NUR noch unter dem Hash (kein Klartext-Neuschreiben).
    expect(await sessions.find(plainToken)).toBeUndefined();
    expect(await sessions.find(hashTokenAtRest(plainToken))).toBeDefined();
    // Wiederholter Zugriff laeuft jetzt den normalen Hash-Weg.
    expect((await service.authenticate(plainToken))?.email).toBe("p@x.de");
  });

  it("Hash-Zeile normal; ein Wert MIT sha256:-Praefix loest KEINEN Alt-Lookup aus", async () => {
    const finds: string[] = [];
    const inner = new InMemorySessionRepo();
    const sessions = {
      create: (s: Parameters<InMemorySessionRepo["create"]>[0]) => inner.create(s),
      find: (token: string) => {
        finds.push(token);
        return inner.find(token);
      },
      delete: (token: string) => inner.delete(token),
      deleteByUser: (userId: string) => inner.deleteByUser(userId),
    };
    const service = new AuthService({ users: new InMemoryUserRepo(), sessions });
    await service.register(payload());
    const { token } = await service.login({ email: "p@x.de", password: "secret123" });
    // Normale (Hash-)Zeile: genau EIN Lookup, kein Legacy-Zweig.
    finds.length = 0;
    expect((await service.authenticate(token))?.email).toBe("p@x.de");
    expect(finds).toEqual([hashTokenAtRest(token)]);
    // Ein Client-Wert, der selbst wie ein Hash aussieht: Miss → KEIN zweiter (Klartext-)Lookup.
    finds.length = 0;
    expect(await service.authenticate(`${TOKEN_HASH_PREFIX}deadbeef`)).toBeUndefined();
    expect(finds).toEqual([hashTokenAtRest(`${TOKEN_HASH_PREFIX}deadbeef`)]);
  });

  it("Reset-Token: Klartext-Alt-Zeile wird via Dual-Read eingeloest (mit Rehash), Fluss unveraendert", async () => {
    const resets = new InMemoryPasswordResetRepo();
    const users = new InMemoryUserRepo();
    const service = new AuthService({
      users,
      sessions: new InMemorySessionRepo(),
      resetTokens: resets,
    });
    const created = await service.register(payload());
    // Admin-Freigabe simulieren, damit der Login nach dem Reset prueffaehig ist.
    await service.approveUser(created.id, created.id);
    const plainReset = "b".repeat(64);
    await resets.create({ token: plainReset, userId: created.id, expiresAt: Date.now() + 60_000 });
    await service.resetPasswordWithToken(plainReset, "ganzNeu123");
    // Eingeloest und weg — weder unter Klartext noch unter Hash.
    expect(await resets.find(plainReset)).toBeUndefined();
    expect(await resets.find(hashTokenAtRest(plainReset))).toBeUndefined();
    const { token } = await service.login({ email: "p@x.de", password: "ganzNeu123" });
    expect((await service.authenticate(token))?.email).toBe("p@x.de");
  });
});
