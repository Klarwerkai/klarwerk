import type { Role } from "../../auth";

// Rechtematrix (Pflichtenheft §3.2 / Technischer Anhang §4). rbac baut auf dem
// Rollenmodell des auth-Moduls auf (Import nur über dessen öffentliche index.ts).
export type Permission =
  | "ko.read"
  | "ko.create"
  | "ko.validate"
  | "ko.assign"
  | "conflict.resolve"
  | "users.manage";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ["ko.read"],
  experte: ["ko.read", "ko.create"],
  controller: ["ko.read", "ko.create", "ko.validate", "ko.assign", "conflict.resolve"],
  admin: ["ko.read", "ko.create", "ko.validate", "ko.assign", "conflict.resolve", "users.manage"],
};

// FR-RBAC-01: Aktionen exakt gemäß Matrix.
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// FR-RBAC-02: nur Admin verwaltet Nutzer.
export function canManageUsers(role: Role): boolean {
  return can(role, "users.manage");
}

// FR-RBAC-03: Admin kann sich nicht selbst die Admin-Rolle entziehen.
export function canChangeRole(
  actor: { id: string; role: Role },
  targetUserId: string,
  newRole: Role,
): boolean {
  if (!canManageUsers(actor.role)) {
    return false;
  }
  if (actor.id === targetUserId && newRole !== "admin") {
    return false;
  }
  return true;
}
