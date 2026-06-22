import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { AuthService } from "./service";
import { AuthError, type AuthErrorCode, type PublicUser } from "./types";

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  NOT_APPROVED: 403,
  WEAK_PASSWORD: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
};

const SESSION_COOKIE = "kw_session";

function tokenFromRequest(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
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

function sendError(reply: FastifyReply, error: unknown): void {
  if (error instanceof AuthError) {
    reply.code(STATUS_BY_CODE[error.code]).send({ error: error.code, message: error.message });
    return;
  }
  reply.code(500).send({ error: "INTERNAL", message: "Unerwarteter Fehler." });
}

export function authRoutes(service: AuthService): FastifyPluginAsync {
  return async (app) => {
    const requireUser = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<PublicUser | undefined> => {
      const token = tokenFromRequest(request);
      const user = token ? await service.authenticate(token) : undefined;
      if (!user) {
        reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Nicht angemeldet." });
        return undefined;
      }
      return user;
    };

    // FR-RBAC-04: serverseitige Rechteprüfung, nicht nur im UI.
    const requireAdmin = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<PublicUser | undefined> => {
      const user = await requireUser(request, reply);
      if (!user) {
        return undefined;
      }
      if (user.role !== "admin") {
        reply.code(403).send({ error: "FORBIDDEN", message: "Adminrecht erforderlich." });
        return undefined;
      }
      return user;
    };

    app.post<{ Body: { name: string; email: string; password: string } }>(
      "/api/auth/register",
      async (request, reply) => {
        try {
          const user = await service.register(request.body);
          reply.code(201).send(user);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.post<{ Body: { email: string; password: string } }>(
      "/api/auth/login",
      async (request, reply) => {
        try {
          const { token, user } = await service.login(request.body);
          reply.header(
            "set-cookie",
            `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${14 * 24 * 60 * 60}; SameSite=Lax`,
          );
          reply.code(200).send({ user, token });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.post("/api/auth/logout", async (request, reply) => {
      const token = tokenFromRequest(request);
      if (token) {
        await service.logout(token);
      }
      reply.header("set-cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
      reply.code(204).send();
    });

    app.get("/api/auth/me", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (user) {
        reply.code(200).send(user);
      }
    });

    app.post<{ Params: { id: string } }>("/api/auth/users/:id/approve", async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      try {
        reply.code(200).send(await service.approveUser(request.params.id, admin.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.post<{ Params: { id: string }; Body: { password: string } }>(
      "/api/auth/users/:id/reset",
      async (request, reply) => {
        const admin = await requireAdmin(request, reply);
        if (!admin) {
          return;
        }
        try {
          await service.resetPassword(request.params.id, request.body.password, admin.id);
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/auth/users/:id", async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      try {
        await service.deleteUser(request.params.id, admin.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}
