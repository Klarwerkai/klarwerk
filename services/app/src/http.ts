import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthService, Role } from "../../auth";
import { type Permission, can } from "../../rbac";

// Gemeinsamer HTTP-Baustein der App: Auth-Guard, RBAC-Guard und einheitliches
// Fehler-Mapping für alle modulübergreifenden Routen (FR-RBAC-04: serverseitig).

const SESSION_COOKIE = "kw_session";

export interface SessionUser {
  id: string;
  role: Role;
}

export interface Guards {
  requireUser(request: FastifyRequest, reply: FastifyReply): Promise<SessionUser | undefined>;
  requirePermission(
    permission: Permission,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SessionUser | undefined>;
}

export function tokenFromRequest(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  const cookie = request.headers.cookie;
  if (!cookie) {
    return undefined;
  }
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      return rest.join("=");
    }
  }
  return undefined;
}

// Domänenfehler (KoError, ValidationError, …) tragen einen string `code`.
const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NOT_APPROVED: 403,
  // SCRUM-509 R2: Herabstufung der Vertraulichkeit ohne Prüfer-/Admin-Rolle → 403.
  DOWNGRADE_FORBIDDEN: 403,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  // WP-SHIP8-FIX (bens F2): Aufräum-Bestätigung passt nicht mehr zur Vorschau-Zielmenge → Konflikt.
  CLEANUP_DRIFT: 409,
  // WP-SHIP8-CLOSE-2 (bens F1): Persistenz-Write traf 0 Zeilen (Objekt zwischenzeitlich weg).
  CONFLICT: 409,
};

export function sendError(reply: FastifyReply, error: unknown): void {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    // SCRUM-496: NUR Domänen-Fehlercodes (KoError/LibraryError/… — GROSSBUCHSTABEN_MIT_UNTERSTRICH,
    // keine Ziffern) tragen ihre nutzerlesbare Meldung nach außen. Infrastruktur-Fehler — insbesondere
    // Postgres-SQLSTATE (z. B. "42P01" relation-not-exists, "42601" syntax-error, enthalten Ziffern) —
    // dürfen ihre ROHE Meldung NIE lecken. Sonst zeigte das Board eine nackte DB-Fehlermeldung.
    if (/^[A-Z_]+$/.test(code)) {
      const message = "message" in error ? String((error as { message: unknown }).message) : code;
      reply.code(STATUS_BY_CODE[code] ?? 400).send({ error: code, message });
      return;
    }
  }
  reply.code(500).send({ error: "INTERNAL", message: "Unerwarteter Fehler." });
}

export function makeGuards(auth: AuthService): Guards {
  const requireUser = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SessionUser | undefined> => {
    const token = tokenFromRequest(request);
    const user = token ? await auth.authenticate(token) : undefined;
    if (!user) {
      reply.code(401).send({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
      return undefined;
    }
    return { id: user.id, role: user.role };
  };

  const requirePermission = async (
    permission: Permission,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SessionUser | undefined> => {
    const user = await requireUser(request, reply);
    if (!user) {
      return undefined;
    }
    if (!can(user.role, permission)) {
      reply.code(403).send({ error: "FORBIDDEN", message: `Recht fehlt: ${permission}` });
      return undefined;
    }
    return user;
  };

  return { requireUser, requirePermission };
}
