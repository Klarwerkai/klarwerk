// Öffentliche API des Moduls rbac.
export { ROLE_PERMISSIONS, can, canManageUsers, canChangeRole } from "./src/policy";
export type { Permission } from "./src/policy";
export { requirePermission } from "./src/guard";
export type { RoleResolver } from "./src/guard";
