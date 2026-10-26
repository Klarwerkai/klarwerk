import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  hasExplicitTrustProxy,
  resolveTrustProxy,
} from "../../services/app/src/addon-auth-throttle";
import { fehlendePflichtwerte, pruefeStartvertrag } from "../../services/app/src/start-vertrag";
import { AccountLoginDelay } from "../../services/auth/src/rate-limit";
import {
  InMemoryPasswordResetRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
} from "../../services/auth/src/repo";
import { PgPasswordResetRepo } from "../../services/auth/src/repo-pg";
import {
  AuthService,
  hashTokenAtRest,
  istKontozugangAbgelaufen,
} from "../../services/auth/src/service";

function welt() {
  const users = new InMemoryUserRepo();
  const sessions = new InMemorySessionRepo();
  const resetTokens = new InMemoryPasswordResetRepo();
  const service = new AuthService({ users, sessions, resetTokens });
  return { users, sessions, resetTokens, service };
}
const pass = "synthetisch-alt-123";
const claims = {
  iss: "https://idp.example.invalid",
  sub: "sso-1",
  email: "sso@example.test",
  name: "SSO",
  roles: ["ctrl"],
  rolesClaimPresent: true,
  emailVerified: true,
};

describe("W4.3 Kontobremse ohne Kontosperre", () => {
  it("verzögert normalisierte Identitäten begrenzt, andere Konten bleiben frei und Erfolg setzt zurück", async () => {
    const wait = vi.fn(async (_ms: number) => {});
    const delay = new AccountLoginDelay({ wait, planen: () => {} });
    for (let i = 0; i < 20; i++) {
      await delay.beforeAttempt(" A@example.test ");
      delay.registerFailure("a@EXAMPLE.test");
    }
    expect(wait.mock.calls.map(([ms]) => ms).slice(0, 3)).toEqual([250, 500, 1000]);
    expect(wait).toHaveBeenCalledTimes(17);
    expect(wait.mock.calls.every(([ms]) => ms > 0 && ms <= 1000)).toBe(true);
    await delay.beforeAttempt("b@example.test");
    expect(wait).toHaveBeenCalledTimes(17);
    delay.reset("a@example.test");
    await delay.beforeAttempt("A@example.test");
    expect(wait).toHaveBeenCalledTimes(17);
  });
  it("verfällt ohne Folgeanfrage und hält höchstens10000 Identitäten", async () => {
    let now = 0;
    const planned: (() => void)[] = [];
    const wait = vi.fn(async (_ms: number) => {});
    const delay = new AccountLoginDelay({
      now: () => now,
      wait,
      planen: (fn) => {
        planned.push(fn);
      },
    });
    for (let i = 0; i <= 10_000; i++) delay.registerFailure(`u${i}@example.test`);
    expect(delay.size).toBe(10_000);
    expect(planned).toHaveLength(1);
    now = 15 * 60 * 1000;
    planned[0]?.();
    expect(delay.size).toBe(0);
    await delay.beforeAttempt("u10000@example.test");
    expect(wait).not.toHaveBeenCalled();
  });
});

describe("W4.3 Resetlinks und SSO", () => {
  it.each(["token", "password", "admin"] as const)(
    "%s: alle eigenen Links verfallen, fremde bleiben gültig",
    async (weg) => {
      const { service } = welt();
      const a = await service.register({ name: "A", email: "a@example.test", password: pass });
      const b = await service.register({ name: "B", email: "b@example.test", password: pass });
      const session = await service.login({ email: a.email, password: pass });
      const first = await service.requestPasswordReset(a.email);
      const second = await service.requestPasswordReset(a.email);
      const other = await service.requestPasswordReset(b.email);
      expect(first?.token && second?.token && other?.token).toBeTruthy();
      if (!first || !second || !other) throw new Error("Fixture fehlt");
      if (weg === "token")
        await service.resetPasswordWithToken(second.token, "synthetisch-neu-123");
      if (weg === "password") await service.changePassword(a.id, pass, "synthetisch-neu-123");
      if (weg === "admin") await service.resetPassword(a.id, "synthetisch-neu-123", a.id);
      for (const token of [first.token, second.token]) {
        await expect(
          service.resetPasswordWithToken(token, "angreifer-neu-123"),
        ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
      }
      expect(await service.authenticate(session.token)).toBeUndefined();
      expect(
        (await service.login({ email: a.email, password: "synthetisch-neu-123" })).user.id,
      ).toBe(a.id);
      await expect(
        service.resetPasswordWithToken(other.token, "anderes-neu-123"),
      ).resolves.toBeUndefined();
    },
  );
  it("ein abgelehnter schwacher Reset verbraucht keinen gültigen Link", async () => {
    const { service } = welt();
    await service.register({ name: "A", email: "a@example.test", password: pass });
    const r = await service.requestPasswordReset("a@example.test");
    if (!r) throw new Error("Fixture fehlt");
    await expect(service.resetPasswordWithToken(r.token, "kurz")).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
    await expect(
      service.resetPasswordWithToken(r.token, "richtig-neu-123"),
    ).resolves.toBeUndefined();
  });
  it("SSO erhält keinen Reset; Legacytoken und Admin/Passwortwechsel können keinen Hash setzen", async () => {
    const { service, resetTokens, users } = welt();
    await service.register({ name: "Admin", email: "admin@example.test", password: pass });
    const sso = await service.loginWithOidc(claims, true, "controller");
    expect(await service.requestPasswordReset(claims.email)).toBeUndefined();
    await resetTokens.create({
      token: hashTokenAtRest("legacy"),
      userId: sso.user.id,
      expiresAt: Date.now() + 60_000,
    });
    for (const action of [
      () => service.resetPasswordWithToken("legacy", "sso-neu-123"),
      () => service.resetPassword(sso.user.id, "sso-neu-123", "admin"),
      () => service.changePassword(sso.user.id, pass, "sso-neu-123"),
    ])
      await expect(action()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "PASSWORD_MANAGED_BY_SSO",
      });
    expect((await users.findById(sso.user.id))?.passwordHash).toBe("");
    expect((await service.authenticate(sso.token))?.id).toBe(sso.user.id);
  });
  it("Identitätsbindung bestimmt Rollenentzug auch bei einem historischen Passwort-Hash", async () => {
    const { service, users } = welt();
    const local = await service.register({
      name: "Admin",
      email: "admin@example.test",
      password: pass,
    });
    const sso = await service.loginWithOidc(claims, true, "controller");
    const stored = await users.findById(sso.user.id);
    const passwordUser = await users.findById(local.id);
    if (!stored || !passwordUser) throw new Error("Fixture fehlt");
    await users.update({
      ...stored,
      passwordHash: passwordUser.passwordHash,
      passwordSalt: passwordUser.passwordSalt,
    });
    const next = await service.loginWithOidc({ ...claims, roles: [] }, true, "viewer");
    expect(next.user.role).toBe("viewer");
    expect((await service.authenticate(sso.token))?.role).toBe("viewer");
    expect((await service.login({ email: local.email, password: pass })).user.role).toBe("admin");
  });
  it("bewusste bestehende Mail-Verknüpfung behält den lokalen Passwortzugang und dieselbe Konto-ID", async () => {
    const { service } = welt();
    const local = await service.register({ name: "Local", email: claims.email, password: pass });
    const sso = await service.loginWithOidc({ ...claims, rolesClaimPresent: false }, true);
    expect(sso.user.id).toBe(local.id);
    expect(sso.user.oidcSubject).toBe(claims.sub);
    expect((await service.login({ email: local.email, password: pass })).user.id).toBe(local.id);
  });
  it("PG deleteByUser bindet die Kennung als SQL-Parameter, ohne PG-Lauf", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const repo = new PgPasswordResetRepo({ query } as unknown as Pool);
    await repo.deleteByUser("synthetisch'; DROP TABLE users;--");
    expect(query).toHaveBeenCalledWith("DELETE FROM password_resets WHERE user_id=$1", [
      "synthetisch'; DROP TABLE users;--",
    ]);
  });
});

describe("W4.3 Produktions-Startvertrag mit bestätigter ausdrücklicher Proxy-Liste", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://test.invalid/fixture",
    APP_BASE_URL: "https://app.example.invalid",
  };
  it.each([
    undefined,
    "",
    " ",
    "true",
    "false",
    "*",
    "1",
    "0.0.0.0/0",
    "::/0",
    "proxy.example",
    "192.0.2.10,true",
    "192.0.2.10,",
    "192.0.2.10,::/0",
  ])("verwirft %s ohne Abschwächung", (raw) => {
    const env = { ...base, KLARWERK_TRUST_PROXY: raw };
    expect(hasExplicitTrustProxy(env)).toBe(false);
    expect(fehlendePflichtwerte(env)).toEqual(["KLARWERK_TRUST_PROXY"]);
    expect(() => pruefeStartvertrag(env)).toThrow("KLARWERK_TRUST_PROXY");
  });
  it.each(["192.0.2.10", "198.51.100.0/24,2001:db8::/64", "10.0.1.2/32,fdf7:560b:cd7a::2/128"])(
    "akzeptiert konkrete synthetische Fixture %s",
    (raw) => {
      const env = { ...base, KLARWERK_TRUST_PROXY: raw };
      expect(hasExplicitTrustProxy(env)).toBe(true);
      expect(fehlendePflichtwerte(env)).toEqual([]);
      expect(() => pruefeStartvertrag(env)).not.toThrow();
      expect(resolveTrustProxy(env)).toEqual(raw.split(","));
    },
  );
  it("Test/Entwicklung braucht keine Proxy-Angabe", () => {
    expect(fehlendePflichtwerte({ NODE_ENV: "test" })).toEqual([]);
    expect(resolveTrustProxy({})).toBe(false);
  });
});

it("ein abgelaufener Resetlink wird allein entfernt; ein noch gültiger Link bleibt verwendbar", async () => {
  const { service, resetTokens } = welt();
  const user = await service.register({ name: "A", email: "a@example.test", password: pass });
  await resetTokens.create({
    token: hashTokenAtRest("alt"),
    userId: user.id,
    expiresAt: Date.now() - 1,
  });
  await resetTokens.create({
    token: hashTokenAtRest("frisch"),
    userId: user.id,
    expiresAt: Date.now() + 60_000,
  });
  await expect(service.resetPasswordWithToken("alt", "neu-passwort-123")).rejects.toMatchObject({
    code: "INVALID_CREDENTIALS",
  });
  await expect(
    service.resetPasswordWithToken("frisch", "neu-passwort-123"),
  ).resolves.toBeUndefined();
});

it("Proxy-Pflicht steht wirksam in Compose, Beispiel und Betreiberanleitung ohne erfundene Vorgabe", () => {
  const compose = readFileSync("docker-compose.prod.yml", "utf8");
  expect(compose).toMatch(/^\s+KLARWERK_TRUST_PROXY:\s*\$\{KLARWERK_TRUST_PROXY:\?/m);
  expect(readFileSync("env.demo.beispiel", "utf8")).toMatch(/^KLARWERK_TRUST_PROXY=$/m);
  expect(readFileSync("docs/operations/kundeninstanz-neuinstallation.md", "utf8")).toContain(
    "Bestätigte tatsächliche Proxy-IP",
  );
});
it("Sitzung und WOPI teilen die exakte bestehende Ablaufgrenze, ohne neue Datumsauslegung", () => {
  const now = Date.parse("2026-10-26T00:00:00Z");
  expect(istKontozugangAbgelaufen({ accessExpiresAt: "2026-10-26T00:00:00Z" }, now)).toBe(true);
  expect(istKontozugangAbgelaufen({ accessExpiresAt: "2026-10-26T00:00:01Z" }, now)).toBe(false);
  expect(istKontozugangAbgelaufen({}, now)).toBe(false);
  expect(istKontozugangAbgelaufen({ accessExpiresAt: "unlesbar" }, now)).toBe(false);
});
