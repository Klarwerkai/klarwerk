import type { FastifyReply, FastifyRequest } from "fastify";
import { type Role, meldung, sprache } from "../../auth";
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
      // JOB 3568 (Q9): der Text kommt aus dem Katalog, der Draht bleibt unangetastet. Der Code
      // heisst weiterhin `INVALID_CREDENTIALS`, obwohl der Katalogschlüssel `NOT_SIGNED_IN` ist —
      // eine Codeänderung wäre eine Vertragsänderung nach aussen und braucht eine eigene Erhebung
      // der Verbraucher (Auftrag §10.2, als Folgezeile gemeldet).
      reply.code(401).send({
        error: "INVALID_CREDENTIALS",
        message: meldung("NOT_SIGNED_IN", sprache(request)),
      });
      return;
    }
    if (!can(role, permission)) {
      // JOB 3956 (Q9): der Text aus dem Katalog, der Draht unverändert — Code `FORBIDDEN` und
      // Status 403 bleiben buchstäblich stehen. Der deutsche Wortlaut ist zeichengleich mit dem
      // früheren Literal; `tests/q9-entwurfsfehler/entwurfsfehler-sprachfaelle.test.ts` misst ihn in
      // allen drei Sprachen am Draht. Der Rechtename geht — anders als beim Rechtetor in
      // `services/app/src/http.ts` — NICHT mit hinaus: diese Stelle hat ihn noch nie genannt, und
      // ihn jetzt hinzuzufügen wäre eine neue Auskunft und nicht eine Übersetzung.
      reply.code(403).send({
        error: "FORBIDDEN",
        message: meldung("PERMISSION_DENIED", sprache(request)),
      });
    }
  };
}
