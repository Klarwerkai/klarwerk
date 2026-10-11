import { describe, expect, it } from "vitest";
import type { Role } from "../../auth";
import { can, canChangeRole, canManageUsers } from "../index";

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

// R-1349: Der Block „FR-RBAC-04: requirePermission als serverseitiger Guard" prüfte den preHandler
// aus `src/guard.ts`, den kein Produktweg rief. FR-RBAC-04 trägt der Rechteweg in
// `services/app/src/http.ts` (`makeGuards().requirePermission`), am Draht geprüft unter anderem in
// `tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts` und den Routentests.
