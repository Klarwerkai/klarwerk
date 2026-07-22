import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Mailer } from "../../notifications";
import { type OidcProvider, createPkcePair, randomToken } from "./oidc";
import { LoginRateLimiter } from "./rate-limit";
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

// WP-VIP2-GATE (bens P1, Cookie-Härtung): in Produktion (NODE_ENV=production) wird Secure
// ERZWUNGEN — COOKIE_SECURE kann es dort nicht mehr abschalten. Außerhalb von Produktion bleibt
// das bisherige Opt-in (COOKIE_SECURE=true) für HTTPS-Dev-Setups. Zur Laufzeit ausgewertet
// (keine Modul-Konstante), damit Tests beide Betriebsarten prüfen können.
function cookieSecure(): boolean {
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  return process.env.COOKIE_SECURE === "true";
}

// WP-VIP2-GATE (bens P1): fail-closed Start-Wächter. Ein EXPLIZITES COOKIE_SECURE=false in
// Produktion ist ein Konfigurationsfehler (jemand versucht, die Härtung abzuschalten) — der
// Start bricht mit klarer Meldung ab, statt still unsichere Cookies auszuliefern.
export function assertCookieSecurityConfig(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_ENV === "production" && env.COOKIE_SECURE === "false") {
    throw new Error(
      "KLARWERK-Start abgebrochen: COOKIE_SECURE=false ist in Produktion nicht erlaubt — das Secure-Flag der Session-Cookies wird dort erzwungen. Bitte COOKIE_SECURE entfernen.",
    );
  }
}

function sessionCookie(token: string): string {
  const base = `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  return cookieSecure() ? `${base}; Secure` : base;
}

function clearSessionCookie(): string {
  const base = `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
  return cookieSecure() ? `${base}; Secure` : base;
}

// FR-AUTH-07: kurzlebige OIDC-Cookies (state/nonce/PKCE-verifier) für den Code-Flow.
const OIDC_STATE_COOKIE = "kw_oidc_state";
const OIDC_NONCE_COOKIE = "kw_oidc_nonce";
const OIDC_VERIFIER_COOKIE = "kw_oidc_verifier";
const OIDC_FLOW_MAX_AGE = 600; // 10 Minuten

function flowCookie(name: string, value: string): string {
  const base = `${name}=${value}; HttpOnly; Path=/; Max-Age=${OIDC_FLOW_MAX_AGE}; SameSite=Lax`;
  return cookieSecure() ? `${base}; Secure` : base;
}

function clearFlowCookie(name: string): string {
  const base = `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
  return cookieSecure() ? `${base}; Secure` : base;
}

function readCookie(request: FastifyRequest, wanted: string): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) {
    return undefined;
  }
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === wanted) {
      return rest.join("=");
    }
  }
  return undefined;
}

function tokenFromRequest(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  return readCookie(request, SESSION_COOKIE);
}

function sendError(reply: FastifyReply, error: unknown): void {
  if (error instanceof AuthError) {
    reply.code(STATUS_BY_CODE[error.code]).send({ error: error.code, message: error.message });
    return;
  }
  reply.code(500).send({ error: "INTERNAL", message: "Unerwarteter Fehler." });
}

// WP-VIP2-GATE (bens P1): Selbstregistrierung ist ein öffentlicher Schreibpfad und deshalb
// FAIL-CLOSED hinter einem Schalter — Default AUS; nur ein explizites =1/true schaltet frei
// (Dev-/Test-Setups setzen es bewusst, z. B. tests/setup-env.ts). Erst-Einrichtung läuft
// unverändert über /api/auth/setup; Admin-Anlage über POST /api/users.
export function selfRegistrationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const flag = env.KLARWERK_SELF_REGISTRATION;
  return flag === "1" || flag === "true";
}

// WP-VIP2-GATE (bens P1): Registrierungs-Rate-Limit (Konstante) — 5 Versuche je Minute je IP;
// JEDER Versuch zählt (auch erfolgreiche: Konto-Anlage ist der Abuse-Vektor, nicht der Fehlschlag).
export const REGISTER_MAX_ATTEMPTS_PER_MINUTE = 5;
const REGISTER_WINDOW_MS = 60 * 1000;

export function authRoutes(
  service: AuthService,
  options: {
    mailer?: Mailer | undefined;
    resetBaseUrl?: string | undefined;
    oidc?: OidcProvider | undefined;
    // SCRUM-356 / AG-06: injizierbarer Login-Brute-Force-Limiter (Default: kleiner In-Memory-Limiter).
    loginRateLimiter?: LoginRateLimiter | undefined;
    // SCRUM-367 / AG-06-RESET: injizierbarer Recovery-Limiter (forgot/reset). Default: eigener
    // In-Memory-Limiter. Bewusst getrennt vom Login-Limiter (andere Zähler, kein gegenseitiges Sperren).
    recoveryRateLimiter?: LoginRateLimiter | undefined;
    // WP-VIP2-GATE: injizierbarer Registrierungs-Limiter (Tests mit eigener Uhr/Schwelle).
    registerRateLimiter?: LoginRateLimiter | undefined;
  } = {},
): FastifyPluginAsync {
  // WP-VIP2-GATE (bens P1, Cookie-Härtung): fail-closed VOR der Routen-Registrierung — ein
  // explizit abgeschaltetes Secure-Flag in Produktion bricht den Start ab (app.ready() wirft).
  assertCookieSecurityConfig();
  // Pro App-Instanz ein eigener Limiter (Test-Isolation; In-Memory, dep-frei).
  const loginLimiter = options.loginRateLimiter ?? new LoginRateLimiter();
  // SCRUM-367 / AG-06-RESET: Anti-Spam/Anti-Bruteforce für die Recovery-Pfade. Etwas großzügiger als
  // Login (legitime Nutzer fordern selten mehrfach an), aber begrenzt gegen Mail-Spam + Token-Raten.
  const recoveryLimiter = options.recoveryRateLimiter ?? new LoginRateLimiter({ maxAttempts: 10 });
  // WP-VIP2-GATE: Registrierungs-Limiter — Schlüssel = nur IP (das Ziel ist Massen-Konto-Anlage,
  // nicht ein einzelnes Konto).
  const registerLimiter =
    options.registerRateLimiter ??
    new LoginRateLimiter({
      maxAttempts: REGISTER_MAX_ATTEMPTS_PER_MINUTE,
      windowMs: REGISTER_WINDOW_MS,
    });
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

    app.post<{ Body: { name?: unknown; email?: unknown; password?: unknown } }>(
      "/api/auth/register",
      async (request, reply) => {
        // WP-VIP2-GATE (bens P1): Schalter ZUERST — bei AUS entsteht weder Konto noch Zählung,
        // und die Antwort ist eine ehrliche, generische 403 (kein Hinweis auf Kontenbestand).
        if (!selfRegistrationEnabled()) {
          reply.code(403).send({
            error: "REGISTRATION_DISABLED",
            message: "Registrierung nur per Einladung.",
          });
          return;
        }
        // Rate-Limit je IP: JEDER Versuch zählt (Konto-Anlage ist der Abuse-Vektor).
        const limiterKey = registerLimiter.keyFor(request.ip, "register");
        const limit = registerLimiter.check(limiterKey);
        if (limit.limited) {
          reply.header("Retry-After", String(limit.retryAfterSeconds));
          reply.code(429).send({
            error: "RATE_LIMITED",
            message: "Zu viele Registrierungen. Bitte später erneut versuchen.",
          });
          return;
        }
        registerLimiter.registerFailure(limiterKey);
        // Body-Schema VOR dem Service: E-Mail-Form + Passwort-Form + Name — ehrlicher 400
        // statt TypeError/opakem 500 (dasselbe Muster wie die Admin-Anlage POST /api/users).
        const body = (request.body ?? {}) as {
          name?: unknown;
          email?: unknown;
          password?: unknown;
        };
        if (typeof body.name !== "string" || body.name.trim().length === 0) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "Name ist erforderlich." });
          return;
        }
        if (typeof body.email !== "string" || !/.+@.+\..+/.test(body.email.trim())) {
          reply
            .code(400)
            .send({ error: "BAD_REQUEST", message: "Gültige E-Mail ist erforderlich." });
          return;
        }
        if (typeof body.password !== "string" || body.password.length < 8) {
          reply
            .code(400)
            .send({ error: "WEAK_PASSWORD", message: "Passwort muss mindestens 8 Zeichen haben." });
          return;
        }
        try {
          const user = await service.register({
            name: body.name.trim(),
            email: body.email.trim(),
            password: body.password,
          });
          reply.code(201).send(user);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.post<{ Body: { email: string; password: string } }>(
      "/api/auth/login",
      async (request, reply) => {
        // SCRUM-356 / AG-06 / NFR-SEC-04: Brute-Force-Schutz. Schlüssel = IP + normalisierte E-Mail.
        // Bewusst NUR um den Login herum, identisch für bekannte/unbekannte Konten (keine Enumeration).
        const limiterKey = loginLimiter.keyFor(request.ip, request.body?.email);
        const limit = loginLimiter.check(limiterKey);
        if (limit.limited) {
          // Generische Meldung — verrät weder Kontoexistenz noch interne Zählerstände.
          reply.header("Retry-After", String(limit.retryAfterSeconds));
          reply.code(429).send({
            error: "RATE_LIMITED",
            message: "Zu viele Anmeldeversuche. Bitte später erneut versuchen.",
          });
          return;
        }
        try {
          const { token, user } = await service.login(request.body);
          // Erfolg → Fehlversuchszähler für diesen Schlüssel zurücksetzen (risikoarm).
          loginLimiter.reset(limiterKey);
          reply.header("set-cookie", sessionCookie(token));
          // WP-VIP2-GATE (bens P1, Cookie-Härtung — geprüft und BEWUSST belassen): der Web-Client
          // nutzt AUSSCHLIESSLICH das HttpOnly-Cookie (authApi.login typisiert nur {user}, der
          // Body-Token wird im Browser nirgends gespeichert). Der Body-Token ist der DOKUMENTIERTE
          // Vertrag für Nicht-Browser-API-Clients (Bearer-Header: Tests, Skripte, Integrationen)
          // — cookielose Clients haben keinen anderen Weg an die Session. Kein XSS-Mehrwert durch
          // Entfernen: ein XSS-Angreifer könnte den Login-Endpunkt ohnehin selbst aufrufen.
          reply.code(200).send({ user, token });
        } catch (error) {
          // Nur falsche Zugangsdaten zählen als Brute-Force-Versuch. NOT_APPROVED (= korrektes
          // Passwort, Konto nicht freigegeben) und andere Fehler erhöhen den Zähler NICHT.
          if (error instanceof AuthError && error.code === "INVALID_CREDENTIALS") {
            loginLimiter.registerFailure(limiterKey);
          }
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
      // SCRUM-367 / AG-06-RESET: Anti-Mail-Spam. Schlüssel = IP (NICHT die E-Mail → keine Enumeration,
      // identisch für bekannt/unbekannt). Bei Überschreitung: trotzdem 204, aber KEINE Mail versenden —
      // die 204-immer-Semantik bleibt unverändert (kein Leak von Kontoexistenz oder Limit-Zustand).
      const recoveryKey = recoveryLimiter.keyFor(request.ip, "forgot");
      const limited = recoveryLimiter.check(recoveryKey).limited;
      recoveryLimiter.registerFailure(recoveryKey); // jede Anforderung zählt (Abuse-Vektor)
      if (limited) {
        reply.code(204).send();
        return;
      }
      const result = await service.requestPasswordReset(request.body.email);
      if (result && options.mailer) {
        const base = options.resetBaseUrl ?? "http://localhost:5173/reset";
        const link = `${base}?token=${result.token}`;
        // Mailfehler dürfen die Antwort nicht verändern: immer 204, sonst würde
        // die Existenz der E-Mail (und SMTP-Fehlkonfiguration) nach außen sichtbar.
        try {
          await options.mailer.send({
            to: result.user.email,
            subject: "KLARWERK: Passwort zurücksetzen",
            text: `Hallo ${result.user.name},\n\nzum Zurücksetzen deines Passworts öffne diesen Link (1 Stunde gültig):\n${link}\n\nWenn du das nicht warst, ignoriere diese E-Mail.\n\n— KLARWERK`,
          });
        } catch (error) {
          request.log.error({ err: error }, "Passwort-Reset-Mail konnte nicht gesendet werden");
        }
      }
      reply.code(204).send();
    });

    // FR-AUTH-08: Reset einlösen (Token + neues Passwort).
    app.post<{ Body: { token: string; newPassword: string } }>(
      "/api/auth/reset",
      async (request, reply) => {
        // SCRUM-367 / AG-06-RESET: Token-Bruteforce drosseln. Schlüssel = IP (kein Token im Schlüssel →
        // kein Leak, ob ein Token existiert). NUR fehlgeschlagene Einlösungen zählen (wie beim Login);
        // ein legitimer Single-Reset wird nie blockiert. Bei Sperre: 429 + Retry-After, vor der
        // Token-Prüfung (verrät nichts über Token-Existenz).
        const resetKey = recoveryLimiter.keyFor(request.ip, "reset");
        const resetLimit = recoveryLimiter.check(resetKey);
        if (resetLimit.limited) {
          reply.header("Retry-After", String(resetLimit.retryAfterSeconds));
          reply.code(429).send({
            error: "RATE_LIMITED",
            message: "Zu viele Versuche. Bitte später erneut versuchen.",
          });
          return;
        }
        try {
          await service.resetPasswordWithToken(request.body.token, request.body.newPassword);
          recoveryLimiter.reset(resetKey); // Erfolg → Zähler löschen (risikoarm)
          reply.code(204).send();
        } catch (error) {
          recoveryLimiter.registerFailure(resetKey); // ungültiges/abgelaufenes Token zählt als Versuch
          sendError(reply, error);
        }
      },
    );

    // FR-AUTH-07: SSO-Start — Authorization-Code-Flow mit PKCE (S256). Erzeugt
    // state/nonce/code_verifier, legt sie kurzlebig als HttpOnly-Cookies ab und
    // leitet zum IdP weiter. Kein Implicit, kein id_token im Browser-Fragment.
    app.get("/api/auth/oidc/start", async (_request, reply) => {
      if (!options.oidc) {
        reply.code(501).send({ error: "OIDC_DISABLED", message: "SSO ist nicht konfiguriert." });
        return;
      }
      const state = randomToken(16);
      const nonce = randomToken(16);
      const { verifier, challenge } = createPkcePair();
      reply.header("set-cookie", [
        flowCookie(OIDC_STATE_COOKIE, state),
        flowCookie(OIDC_NONCE_COOKIE, nonce),
        flowCookie(OIDC_VERIFIER_COOKIE, verifier),
      ]);
      reply.redirect(options.oidc.authorizeUrl({ state, nonce, codeChallenge: challenge }));
    });

    // FR-AUTH-07: SSO-Callback — FE liefert { code, state }. Backend prüft state gegen
    // Cookie, tauscht den Code (mit PKCE-verifier) am Token-Endpoint, verifiziert das
    // id_token inkl. nonce, mappt die Rolle aus Claims und legt die Sitzung an.
    app.post<{ Body: { code: string; state: string } }>(
      "/api/auth/oidc",
      async (request, reply) => {
        if (!options.oidc) {
          reply.code(501).send({ error: "OIDC_DISABLED", message: "SSO ist nicht konfiguriert." });
          return;
        }
        const stateCookie = readCookie(request, OIDC_STATE_COOKIE);
        const nonceCookie = readCookie(request, OIDC_NONCE_COOKIE);
        const verifierCookie = readCookie(request, OIDC_VERIFIER_COOKIE);
        const clearFlow = [
          clearFlowCookie(OIDC_STATE_COOKIE),
          clearFlowCookie(OIDC_NONCE_COOKIE),
          clearFlowCookie(OIDC_VERIFIER_COOKIE),
        ];
        if (
          !stateCookie ||
          !nonceCookie ||
          !verifierCookie ||
          !request.body.state ||
          request.body.state !== stateCookie
        ) {
          reply.header("set-cookie", clearFlow);
          reply.code(400).send({ error: "OIDC_INVALID", message: "SSO-Status ungültig." });
          return;
        }
        try {
          const idToken = await options.oidc.exchange(request.body.code, verifierCookie);
          const claims = await options.oidc.verify(idToken, nonceCookie);
          const mappedRole = options.oidc.mapRole(claims);
          const { token, user } = await service.loginWithOidc(
            claims,
            options.oidc.autoProvision,
            mappedRole,
          );
          reply.header("set-cookie", [...clearFlow, sessionCookie(token)]);
          reply.code(200).send({ user, token });
        } catch (error) {
          reply.header("set-cookie", clearFlow);
          if (error instanceof AuthError) {
            sendError(reply, error);
            return;
          }
          reply.code(401).send({ error: "OIDC_INVALID", message: "SSO-Anmeldung fehlgeschlagen." });
        }
      },
    );

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

    // FR-AUTH-01: Status der Instanz — Ersteinrichtung nötig? Und ist SSO konfiguriert
    // (FR-AUTH-07: oidcEnabled steuert die ehrliche Sichtbarkeit des SSO-Logins im UI)?
    app.get("/api/auth/status", async (_request, reply) => {
      reply
        .code(200)
        .send({ needsSetup: await service.needsSetup(), oidcEnabled: Boolean(options.oidc) });
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

    // Schlankes Verzeichnis (nur id + Anzeigename) für Anzeige (Autorennamen) und
    // Zuweisung — für ALLE angemeldeten Nutzer, ohne Adminrecht.
    app.get("/api/directory", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) {
        return;
      }
      const users = await service.listUsers();
      reply.code(200).send(users.map((u) => ({ id: u.id, name: u.name })));
    });

    // Admin legt einen Nutzer direkt an (sofort freigegeben), optional mit Rolle.
    app.post<{ Body: { name: string; email: string; password: string; role?: Role } }>(
      "/api/users",
      async (request, reply) => {
        const admin = await requireAdmin(request, reply);
        if (!admin) {
          return;
        }
        // SCRUM-463 (WP4): ehrliche Eingabe-Validierung an der Route, BEVOR register/changeRole laufen.
        // Vorher führte ein fehlendes password zu `input.password.length` auf undefined → TypeError →
        // opakes 500 („Unerwarteter Fehler"); und eine ungültige role wurde still übernommen. Jetzt:
        // klarer 400 mit nutzerlesbarer Meldung (kein Auth-/Rollenmodell-Umbau, nur Route-Guard).
        const body = (request.body ?? {}) as {
          name?: unknown;
          email?: unknown;
          password?: unknown;
          role?: unknown;
        };
        const roles: Role[] = ["viewer", "experte", "controller", "admin"];
        if (typeof body.name !== "string" || body.name.trim().length === 0) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "Name ist erforderlich." });
          return;
        }
        if (typeof body.email !== "string" || !/.+@.+\..+/.test(body.email.trim())) {
          reply
            .code(400)
            .send({ error: "BAD_REQUEST", message: "Gültige E-Mail ist erforderlich." });
          return;
        }
        if (typeof body.password !== "string" || body.password.length < 8) {
          reply
            .code(400)
            .send({ error: "WEAK_PASSWORD", message: "Passwort muss mindestens 8 Zeichen haben." });
          return;
        }
        if (body.role !== undefined && !roles.includes(body.role as Role)) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "Unbekannte Rolle." });
          return;
        }
        try {
          const created = await service.register({
            name: body.name.trim(),
            email: body.email.trim(),
            password: body.password,
          });
          let user = await service.approveUser(created.id, admin.id);
          const role = body.role as Role | undefined;
          if (role && role !== user.role) {
            user = await service.changeRole(created.id, role, admin.id);
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
