import Fastify from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { verifyPassword } from "./password";
import { InMemorySessionRepo, InMemoryUserRepo } from "./repo";
import { authRoutes } from "./routes";
import { AuthService } from "./service";

function build(now?: () => number) {
  const users = new InMemoryUserRepo();
  const sessions = new InMemorySessionRepo();
  const service = new AuthService(now ? { users, sessions, now } : { users, sessions });
  return { users, sessions, service };
}

describe("AuthService", () => {
  let users: InMemoryUserRepo;
  let service: AuthService;

  beforeEach(() => {
    ({ users, service } = build());
  });

  it("FR-AUTH-01: erstes Konto einer leeren Instanz wird Admin", async () => {
    const user = await service.register({ name: "Pedi", email: "a@x.de", password: "secret123" });
    expect(user.role).toBe("admin");
    expect(user.approved).toBe(true);
  });

  it("FR-AUTH-02: weitere Konten sind Experte und bis zur Freigabe gesperrt", async () => {
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    const second = await service.register({
      name: "Bob",
      email: "bob@x.de",
      password: "secret123",
    });
    expect(second.role).toBe("experte");
    expect(second.approved).toBe(false);

    await expect(service.login({ email: "bob@x.de", password: "secret123" })).rejects.toMatchObject(
      {
        code: "NOT_APPROVED",
      },
    );

    await service.approveUser(second.id, "admin");
    const ok = await service.login({ email: "bob@x.de", password: "secret123" });
    expect(ok.token).toBeTruthy();
  });

  it("FR-AUTH-03: falsche Daten werden klar abgewiesen", async () => {
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    await expect(service.login({ email: "admin@x.de", password: "wrong" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("FR-AUTH-04: Logout beendet die Sitzung serverseitig", async () => {
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    const { token } = await service.login({ email: "admin@x.de", password: "secret123" });
    expect(await service.authenticate(token)).toBeDefined();
    await service.logout(token);
    expect(await service.authenticate(token)).toBeUndefined();
  });

  it("FR-AUTH-05: Passwort nur als Salt+Hash gespeichert", async () => {
    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    const stored = await users.findByEmail("admin@x.de");
    if (!stored) {
      throw new Error("Nutzer wurde nicht gespeichert.");
    }
    expect(stored.passwordHash).not.toContain("secret123");
    expect(stored.passwordSalt).toBeTruthy();
    expect(verifyPassword("secret123", stored.passwordSalt, stored.passwordHash)).toBe(true);
  });

  it("FR-AUTH-06: Admin-Reset macht alte Sitzungen ungültig, neues Passwort gilt", async () => {
    const admin = await service.register({
      name: "Admin",
      email: "admin@x.de",
      password: "secret123",
    });
    const { token } = await service.login({ email: "admin@x.de", password: "secret123" });

    await service.resetPassword(admin.id, "neuespass1", admin.id);

    expect(await service.authenticate(token)).toBeUndefined();
    await expect(
      service.login({ email: "admin@x.de", password: "secret123" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    const ok = await service.login({ email: "admin@x.de", password: "neuespass1" });
    expect(ok.token).toBeTruthy();
  });

  it("weist zu kurze Passwörter ab (NFR/FR-AUTH-02)", async () => {
    await expect(
      service.register({ name: "X", email: "x@x.de", password: "short" }),
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
  });

  it("verhindert doppelte E-Mail", async () => {
    await service.register({ name: "A", email: "dup@x.de", password: "secret123" });
    await expect(
      service.register({ name: "B", email: "dup@x.de", password: "secret123" }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("abgelaufene Sitzung gilt nicht mehr", async () => {
    let clock = 1_000;
    const ctx = build(() => clock);
    await ctx.service.register({ name: "A", email: "a@x.de", password: "secret123" });
    const { token } = await ctx.service.login({ email: "a@x.de", password: "secret123" });
    clock += 15 * 24 * 60 * 60 * 1000; // > 14 Tage
    expect(await ctx.service.authenticate(token)).toBeUndefined();
  });
});

describe("authRoutes (HTTP)", () => {
  it("register → login → me happy path; me ohne Token → 401", async () => {
    const { service } = build();
    const app = Fastify();
    await app.register(authRoutes(service));

    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
    });
    expect(reg.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "p@x.de", password: "secret123" },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().token as string;

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("p@x.de");

    const noAuth = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(noAuth.statusCode).toBe(401);

    await app.close();
  });

  it("FR-RBAC-04: Approve-Route ohne Adminrecht → 403", async () => {
    const { service } = build();
    const app = Fastify();
    await app.register(authRoutes(service));

    await service.register({ name: "Admin", email: "admin@x.de", password: "secret123" });
    const bob = await service.register({ name: "Bob", email: "bob@x.de", password: "secret123" });
    await service.approveUser(bob.id, "admin");
    const bobLogin = await service.login({ email: "bob@x.de", password: "secret123" });

    const res = await app.inject({
      method: "POST",
      url: `/api/auth/users/${bob.id}/approve`,
      headers: { authorization: `Bearer ${bobLogin.token}` },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

describe("FR-RBAC-02: Admin-Aktionen mit Audit", () => {
  it("löscht Nutzer und schreibt je Aktion einen Audit-Eintrag", async () => {
    const users = new InMemoryUserRepo();
    const sessions = new InMemorySessionRepo();
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const service = new AuthService({ users, sessions, audit });

    const admin = await service.register({ name: "Admin", email: "a@x.de", password: "secret123" });
    const bob = await service.register({ name: "Bob", email: "bob@x.de", password: "secret123" });

    await service.approveUser(bob.id, admin.id);
    await service.changeRole(bob.id, "controller", admin.id);
    await service.resetPassword(bob.id, "neuespass1", admin.id);
    await service.deleteUser(bob.id, admin.id);

    // Nutzer ist gelöscht.
    await expect(service.approveUser(bob.id, admin.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // Vier Admin-Aktionen → vier Audit-Einträge; Kette intakt.
    const entries = await audit.list();
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.action)).toEqual([
      "user.approve",
      "user.role-change",
      "user.password-reset",
      "user.delete",
    ]);
    expect(await audit.verify()).toBe(true);
  });

  it("FR-AUD-01: Login und Logout werden protokolliert", async () => {
    const users = new InMemoryUserRepo();
    const sessions = new InMemorySessionRepo();
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const service = new AuthService({ users, sessions, audit });

    const admin = await service.register({ name: "A", email: "a@x.de", password: "secret123" });
    const { token } = await service.login({ email: "a@x.de", password: "secret123" });
    await service.logout(token);

    expect(await audit.list({ action: "auth.login" })).toHaveLength(1);
    const logout = await audit.list({ action: "auth.logout" });
    expect(logout).toHaveLength(1);
    expect(logout[0]?.actor).toBe(admin.id);
  });
});
