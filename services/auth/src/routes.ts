import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Mailer } from "../../notifications";
import type { OidcVerifier } from "./oidc";
import type { AuthService } from "./service";
import { AuthError, type AuthErrorCode, type PublicUser, type Role } from "./types";

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  NOT_APPROVED: 403,
  WEAK_PASSWORD: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
};

const SESSION_COOKIE = "kw_session";
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60; // 14 Tage
// Härtung: Secure-Flag in Produktion (HTTPS) via COOKIE_SECURE=true. Lokal aus (HTTP).
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

function sessionCookie(token: string): string {
  const base = `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  return COOKIE_SECURE ? `${base}; Secure` : base;
}

function clearSessionCookie(): string {
  const base = `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
  return COOKIE_SECURE ? `${base}; Secure` : base;
}

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

export function authRoutes(
  service: AuthService,
  options: {
    mailer?: Mailer | undefined;
    resetBaseUrl?: string | undefined;
    oidc?: OidcVerifier | undefined;
  } = {},
): FastifyPluginAsync {
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
          reply.header("set-cookie", sessionCookie(token));
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
      reply.header("set-cookie", clearSessionCookie());
      reply.code(204).send();
    });

    app.get("/api/auth/me", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (user) {
        reply.code(200).send(user);
      }
    });

    // Self-Service: eigenes Passwort ändern. Alte Sitzungen verfallen → danach neu anmelden.
    app.post<{ Body: { oldPassword: string; newPassword: string } }>(
      "/api/auth/password",
      async (request, reply) => {
        const user = await requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          await service.changePassword(user.id, request.body.oldPassword, request.body.newPassword);
          reply.header("set-cookie", clearSessionCookie());
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // FR-AUTH-08: Reset anfordern. Antwort immer 204 — die Existenz der E-Mail wird nicht verraten.
    app.post<{ Body: { email: string } }>("/api/auth/forgot", async (request, reply) => {
      const result = await service.requestPasswordReset(request.body.email);
      if (result && options.mailer) {
        const base = options.resetBaseUrl ?? "http://localhost:5173/reset";
        const link = `${base}?token=${result.token}`;
        await options.mailer.send({
          to: result.user.email,
          subject: "KLARWERK: Passwort zurücksetzen",
          text: `Hallo ${result.user.name},\n\nzum Zurücksetzen deines Passworts öffne diesen Link (1 Stunde gültig):\n${link}\n\nWenn du das nicht warst, ignoriere diese E-Mail.\n\n— KLARWERK`,
        });
      }
      reply.code(204).send();
    });

    // FR-AUTH-08: Reset einlösen (Token + neues Passwort).
    app.post<{ Body: { token: string; newPassword: string } }>(
      "/api/auth/reset",
      async (request, reply) => {
        try {
          await service.resetPasswordWithToken(request.body.token, request.body.newPassword);
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // FR-AUTH-07: SSO — verifiziertes ID-Token gegen den IdP, dann KLARWERK-Sitzung.
    app.post<{ Body: { idToken: string } }>("/api/auth/oidc", async (request, reply) => {
      if (!options.oidc) {
        reply.code(501).send({ error: "OIDC_DISABLED", message: "SSO ist nicht konfiguriert." });
        return;
      }
      try {
        const claims = await options.oidc.verify(request.body.idToken);
        const { token, user } = await service.loginWithOidc(claims, options.oidc.autoProvision);
        reply.header("set-cookie", sessionCookie(token));
        reply.code(200).send({ user, token });
      } catch (error) {
        if (error instanceof AuthError) {
          sendError(reply, error);
          return;
        }
        reply.code(401).send({ error: "OIDC_INVALID", message: "ID-Token ungültig." });
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

    // FR-AUTH-01: Status der Instanz — ist die Ersteinrichtung (erstes Admin-Konto) nötig?
    app.get("/api/auth/status", async (_request, reply) => {
      reply.code(200).send({ needsSetup: await service.needsSetup() });
    });

    // FR-AUTH-01: Ersteinrichtung — legt das erste Konto (Admin) an und startet die Sitzung.
    app.post<{ Body: { name: string; email: string; password: string } }>(
      "/api/auth/setup",
      async (request, reply) => {
        if (!(await service.needsSetup())) {
          reply
            .code(409)
            .send({ error: "ALREADY_SETUP", message: "Instanz ist bereits eingerichtet." });
          return;
        }
        try {
          await service.register(request.body);
          const { token, user } = await service.login({
            email: request.body.email,
            password: request.body.password,
          });
          reply.header("set-cookie", sessionCookie(token));
          reply.code(201).send({ user, token });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // FR-RBAC-01: Nutzerverwaltung (Admin). Liste ohne Passwort-Hashes.
    app.get("/api/users", async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      reply.code(200).send(await service.listUsers());
    });

    // Admin legt einen Nutzer direkt an (sofort freigegeben), optional mit Rolle.
    app.post<{ Body: { name: string; email: string; password: string; role?: Role } }>(
      "/api/users",
      async (request, reply) => {
        const admin = await requireAdmin(request, reply);
        if (!admin) {
          return;
        }
        try {
          const created = await service.register(request.body);
          let user = await service.approveUser(created.id, admin.id);
          if (request.body.role && request.body.role !== user.role) {
            user = await service.changeRole(created.id, request.body.role, admin.id);
          }
          reply.code(201).send(user);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // Admin ändert Rolle / gibt frei / setzt Passwort zurück — ein Endpunkt (§2.2).
    app.put<{
      Params: { id: string };
      Body: { role?: Role; approve?: boolean; password?: string };
    }>("/api/users/:id", async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      const { id } = request.params;
      const { role, approve, password } = request.body;
      try {
        let user: PublicUser | undefined;
        if (approve === true) {
          user = await service.approveUser(id, admin.id);
        }
        if (role) {
          user = await service.changeRole(id, role, admin.id);
        }
        if (password) {
          await service.resetPassword(id, password, admin.id);
        }
        if (user) {
          reply.code(200).send(user);
        } else {
          reply.code(204).send();
        }
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.delete<{ Params: { id: string } }>("/api/users/:id", async (request, reply) => {
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
