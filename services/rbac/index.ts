// Öffentliche API des Moduls rbac.
export { ROLE_PERMISSIONS, can, canManageUsers, canChangeRole } from "./src/policy";
export type { Permission } from "./src/policy";
// R-1349: Der preHandler `requirePermission` (src/guard.ts) ist entfernt. Kein Produktweg rief ihn;
// jede Route prüft über `makeGuards().requirePermission` in `services/app/src/http.ts`, das `can`
// von hier liest.
