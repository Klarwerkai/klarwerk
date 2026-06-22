import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { Role } from "../../auth";
import { can, canChangeRole, canManageUsers, requirePermission } from "../index";

describe("rbac policy", () => {
  it("FR-RBAC-01: Rechtematrix wirkt je Rolle", () => {
    expect(can("viewer", "ko.read")).toBe(true);
    expect(can("viewer", "ko.create")).toBe(false);
    expect(can("experte", "ko.create")).toBe(true);
    expect(can("experte", "ko.validate")).toBe(false);
    expect(can("controller", "ko.validate")).toBe(true);
    expect(can("controller", "users.manage")).toBe(false);
    expect(can("admin", "users.manage")).toBe(true);
  });

  it("FR-RBAC-02: nur Admin verwaltet Nutzer", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("controller")).toBe(false);
    expect(canManageUsers("experte")).toBe(false);
  });

  it("FR-RBAC-03: Admin kann sich nicht selbst die Admin-Rolle entziehen", () => {
    const admin = { id: "a1", role: "admin" as Role };
    expect(canChangeRole(admin, "a1", "viewer")).toBe(false);
    expect(canChangeRole(admin, "a1", "admin")).toBe(true);
    expect(canChangeRole(admin, "other", "controller")).toBe(true);
    expect(canChangeRole({ id: "c1", role: "controller" }, "x", "viewer")).toBe(false);
  });
});

describe("FR-RBAC-04: requirePermission als serverseitiger Guard", () => {
  function appFor(role: Role | undefined) {
    const app = Fastify();
    app.post(
      "/admin/users",
      { preHandler: requirePermission("users.manage", () => role) },
      async () => ({ ok: true }),
    );
    return app;
  }

  it("Admin → 200", async () => {
    const app = appFor("admin");
    const res = await app.inject({ method: "POST", url: "/admin/users" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("Experte ohne Recht → 403", async () => {
    const app = appFor("experte");
    const res = await app.inject({ method: "POST", url: "/admin/users" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("nicht angemeldet → 401", async () => {
    const app = appFor(undefined);
    const res = await app.inject({ method: "POST", url: "/admin/users" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
