import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "../../auth";
import { type Permission, can } from "./policy";

// Liefert die Rolle des aktuellen Requests (vom Composition-Root mit auth verdrahtet).
export type RoleResolver = (
  request: FastifyRequest,
) => Promise<Role | undefined> | Role | undefined;

// FR-RBAC-04: serverseitige Rechteprüfung bei JEDER schützenswerten Operation.
// Als Fastify-preHandler einsetzbar; sendet 401/403 und bricht die Verarbeitung ab.
export function requirePermission(permission: Permission, resolveRole: RoleResolver) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const role = await resolveRole(request);
    if (!role) {
      reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Nicht angemeldet." });
      return;
    }
    if (!can(role, permission)) {
      reply.code(403).send({ error: "FORBIDDEN", message: "Keine Berechtigung." });
    }
  };
}
