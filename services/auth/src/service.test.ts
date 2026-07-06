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

  // SCRUM-450: reine Passwort-Prüfung (Re-Auth vor Werksreset) — korrekt true, sonst false.
  it("SCRUM-450: verifyUserPassword prüft das Passwort ohne Nebenwirkung", async () => {
    const admin = await service.register({
      name: "Admin",
      email: "admin@x.de",
      password: "secret123",
    });
    expect(await service.verifyUserPassword(admin.id, "secret123")).toBe(true);
    expect(await service.verifyUserPassword(admin.id, "falsch")).toBe(false);
    expect(await service.verifyUserPassword("gibt-es-nicht", "secret123")).toBe(false);
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

  it("Self-Service: eigenes Passwort ändern (altes nötig), alte Sitzung verfällt", async () => {
    const user = await service.register({ name: "A", email: "a@x.de", password: "secret123" });
    const { token } = await service.login({ email: "a@x.de", password: "secret123" });

    await expect(service.changePassword(user.id, "falsch", "neuespass1")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    await service.changePassword(user.id, "secret123", "neuespass1");
    expect(await service.authenticate(token)).toBeUndefined();
    const ok = await service.login({ email: "a@x.de", password: "neuespass1" });
    expect(ok.token).toBeTruthy();
  });

  it("FR-AUTH-08: Reset per Token; unbekannte E-Mail verschwiegen, Token einmalig", async () => {
    await service.register({ name: "A", email: "a@x.de", password: "secret123" });
    const { token } = await service.login({ email: "a@x.de", password: "secret123" });

    // Unbekannte E-Mail → undefined (Existenz wird nicht verraten).
    expect(await service.requestPasswordReset("nope@x.de")).toBeUndefined();

    const req = await service.requestPasswordReset("a@x.de");
    if (!req) {
      throw new Error("Reset-Token erwartet");
    }
    await service.resetPasswordWithToken(req.token, "neuespass1");

    // Alte Sitzung verfällt, neues Passwort gilt.
    expect(await service.authenticate(token)).toBeUndefined();
    const ok = await service.login({ email: "a@x.de", password: "neuespass1" });
    expect(ok.token).toBeTruthy();

    // Token ist verbraucht.
    await expect(service.resetPasswordWithToken(req.token, "nochmal12")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
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

  // SCRUM-443 (Berater-Audit): RBAC-Härtung — Selbst-Entzug + Last-Admin-Schutz.
  it("SCRUM-443: der letzte aktive Admin kann sich nicht selbst herabstufen (FR-RBAC-03)", async () => {
    const { service } = build();
    const admin = await service.register({ name: "Admin", email: "a@x.de", password: "secret123" });
    await expect(service.changeRole(admin.id, "viewer", admin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const list = await service.listUsers();
    expect(list.find((u) => u.id === admin.id)?.role).toBe("admin");
  });

  it("SCRUM-443: der letzte aktive Admin kann nicht gelöscht werden", async () => {
    const { service } = build();
    const admin = await service.register({ name: "Admin", email: "a@x.de", password: "secret123" });
    await expect(service.deleteUser(admin.id, admin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("SCRUM-443: normale Rollenwechsel bleiben möglich", async () => {
    const { service } = build();
    const admin = await service.register({ name: "Admin", email: "a@x.de", password: "secret123" });
    const bob = await service.register({ name: "Bob", email: "b@x.de", password: "secret123" });
    await service.approveUser(bob.id, admin.id);
    const updated = await service.changeRole(bob.id, "controller", admin.id);
    expect(updated.role).toBe("controller");
  });

  it("SCRUM-443: mit zweitem Admin ist die Herabstufung eines (nicht letzten) Admins möglich", async () => {
    const { service } = build();
    const admin = await service.register({ name: "Admin", email: "a@x.de", password: "secret123" });
    const two = await service.register({ name: "Zwei", email: "z@x.de", password: "secret123" });
    await service.approveUser(two.id, admin.id);
    await service.changeRole(two.id, "admin", admin.id); // jetzt zwei aktive Admins
    const demoted = await service.changeRole(two.id, "controller", admin.id);
    expect(demoted.role).toBe("controller");
  });

  it("SCRUM-443: Selbst-Entzug bleibt blockiert, auch wenn ein zweiter Admin existiert", async () => {
    const { service } = build();
    const admin = await service.register({ name: "Admin", email: "a@x.de", password: "secret123" });
    const two = await service.register({ name: "Zwei", email: "z@x.de", password: "secret123" });
    await service.approveUser(two.id, admin.id);
    await service.changeRole(two.id, "admin", admin.id);
    await expect(service.changeRole(admin.id, "viewer", admin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
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

describe("authRoutes — Setup, Status & Users (§2.1/2.2)", () => {
  async function freshApp() {
    const { service } = build();
    const app = Fastify();
    await app.register(authRoutes(service));
    return app;
  }

  it("Status zeigt needsSetup; Setup legt Admin an und sperrt erneutes Setup", async () => {
    const app = await freshApp();

    const before = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(before.json().needsSetup).toBe(true);

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "Pedi", email: "a@x.de", password: "secret123" },
    });
    expect(setup.statusCode).toBe(201);
    expect(setup.json().user.role).toBe("admin");
    expect(setup.json().token).toBeTruthy();

    const after = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(after.json().needsSetup).toBe(false);

    const again = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "X", email: "b@x.de", password: "secret123" },
    });
    expect(again.statusCode).toBe(409);

    await app.close();
  });

  it("Admin verwaltet Nutzer: anlegen (freigegeben), listen, Rolle ändern, löschen", async () => {
    const app = await freshApp();
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${setup.json().token}` };

    const created = await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Bob", email: "bob@x.de", password: "secret123", role: "controller" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().role).toBe("controller");
    expect(created.json().approved).toBe(true);
    const bobId = created.json().id as string;

    const list = await app.inject({ method: "GET", url: "/api/users", headers });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(2);

    const put = await app.inject({
      method: "PUT",
      url: `/api/users/${bobId}`,
      headers,
      payload: { role: "experte" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().role).toBe("experte");

    const del = await app.inject({ method: "DELETE", url: `/api/users/${bobId}`, headers });
    expect(del.statusCode).toBe(204);

    const list2 = await app.inject({ method: "GET", url: "/api/users", headers });
    expect(list2.json()).toHaveLength(1);

    // Ohne Anmeldung kein Zugriff auf die Nutzerverwaltung.
    const anon = await app.inject({ method: "GET", url: "/api/users" });
    expect(anon.statusCode).toBe(401);

    await app.close();
  });
});
