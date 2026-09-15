import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Mailer } from "../../notifications";
import { type Meldungsschluessel, type Sprache, meldung } from "./meldungen";
import { HINWEIS_TEXT_VERSION, hinweisFaellig } from "./notice";
import { type OidcProvider, OidcUnreachableError, createPkcePair, randomToken } from "./oidc";
import { LoginRateLimiter } from "./rate-limit";
import { type AuthService, istLesbaresAblaufdatum } from "./service";
import { AuthError, type AuthErrorCode, type PublicUser, type Role } from "./types";

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  NOT_APPROVED: 403,
  WEAK_PASSWORD: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
};

/**
 * JOB 4011 · WAS DER MENSCH GETAN HAT, NICHT WAS DER CODE HEISST.
 *
 * `AuthErrorCode` (`types.ts:62`) ist eine kurze, alte Liste; sie kennt kein `BAD_REQUEST`. Ein
 * unlesbares Ablaufdatum ist aber weder verboten noch ein Serverfehler — es ist ein Tippfehler, und
 * die Antwort darauf ist dieselbe 400 `BAD_REQUEST`, die jede andere Eingabe bekommt, die ein
 * Mensch tippen kann (`:720-744`). Diese Tabelle bildet den KATALOGSCHLÜSSEL auf die Antwort ab.
 *
 * WARUM DIE ABBILDUNG HIER STEHT UND NICHT AM WURF: `types.ts` ist kein Zielpfad dieses Auftrags,
 * und eine zweite AuthError-KLASSE wäre der teurere Weg — `sendError` wählt für Klassen per
 * `instanceof` (`OidcUnreachableError`), und der Wächter D in
 * `tests/q9-oidc-literalquelle/jeder-fehler-traegt-einen-katalogschluessel.test.ts` lässt bewusst
 * genau EINE solche Klasse zu. Die Bauart ist dieselbe, die dort seit jeher gilt: der FEHLERCODE
 * trägt den Status, der SCHLÜSSEL die Bedeutung, und wo beide auseinandergehen, steht es
 * geschrieben. Als offener Punkt benannt: der saubere Zielzustand wäre ein `BAD_REQUEST` in
 * `AuthErrorCode`.
 *
 * EINE STELLE FÜR BEIDE WEGE. Anlegen und Ändern werfen denselben Schlüssel und laufen durch
 * dasselbe `sendError` — deshalb sind ihre Antworten nicht bloss ähnlich, sondern dieselben Bytes
 * (gehalten von G6 in `tests/gast-befristung/`).
 */
const ANTWORT_JE_SCHLUESSEL: ReadonlyMap<string, { status: number; error: string }> = new Map([
  ["ACCESS_EXPIRY_UNREADABLE", { status: 400, error: "BAD_REQUEST" }],
]);

// JOB 3780: DIE VIER ROLLENNAMEN STEHEN GENAU EINMAL IN DIESER DATEI.
//
// Bis hierher führte der Anlege-Handler seine eigene Liste (`const roles: Role[]` im Rumpf von
// POST /api/users), und der Änderungsweg hatte gar keine. Eine zweite Abschrift wären zwei
// Auslegungen desselben Begriffs — sie liefen beim nächsten Rollenzuwachs auseinander, und der
// stillere der beiden Wege ließe den neuen Namen dann nicht durch (oder, schlimmer, den alten
// weiter hinein). Kein Export: außerhalb dieser Datei urteilt niemand über Rollennamen.
const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];

/**
 * Formwächter für einen Rollennamen aus fremder Eingabe.
 *
 * Typwächter und nicht nur `boolean`: nach dieser Prüfung DARF der Wert als `Role` weitergereicht
 * werden, weil er einer ist — ohne die Behauptung `as Role`, die dem Typprüfer etwas zusagt, was
 * ein HTTP-Rumpf nie garantiert.
 */
function istBekannteRolle(wert: unknown): wert is Role {
  return ROLLEN.includes(wert as Role);
}

/**
 * JOB 4011 R4: WAS VON EINEM HALB ANGELEGTEN KONTO WIRKLICH IM BESTAND STEHT.
 *
 * Gelesen, nicht geschlossen. Der Anlageweg protokolliert nach einer gescheiterten Rücknahme, was
 * er zurücklässt; bis Runde 3 leitete er das aus seinem eigenen Ablauf ab und lag damit falsch,
 * sobald der Bestand etwas anderes hergab (BEN-Befund 5). Diese Stelle sieht nach.
 *
 * `"unbekannt"` IST EIN EIGENER ZUSTAND und kein Ersatz für „nein": antwortet die Ablage auch beim
 * Lesen nicht mehr, weiss dieser Aufruf nichts über den Rest — und dann darf die Zeile weder
 * Entwarnung geben noch Alarm schlagen. Dasselbe Zustandsmodell wie auf der Fläche: „unbekannt"
 * unterscheidet sich von „0"/„leer".
 */
type RestBefund = {
  restVorhanden: boolean | "unbekannt";
  restFreigegeben: boolean | "unbekannt";
};

async function restBefund(service: AuthService, konto: string): Promise<RestBefund> {
  try {
    const rest = (await service.listUsers()).find((u) => u.id === konto);
    return { restVorhanden: rest !== undefined, restFreigegeben: rest?.approved ?? false };
  } catch {
    return { restVorhanden: "unbekannt", restFreigegeben: "unbekannt" };
  }
}

/** Der Satz zum Befund — drei Befunde, drei Sätze, keiner beschönigt. */
function restSatz(befund: RestBefund): string {
  if (befund.restFreigegeben === "unbekannt") {
    return "ob und in welchem Zustand ein Konto zurückbleibt, war nicht mehr messbar.";
  }
  if (befund.restFreigegeben) {
    return "im Bestand steht ein FREIGEGEBENES Konto, mit dem man sich anmelden kann.";
  }
  if (befund.restVorhanden) {
    return "der Rest ist nicht freigegeben — mit ihm kommt niemand herein.";
  }
  return "im Bestand steht kein Konto aus diesem Aufruf.";
}

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

// Genau eine Lesestelle für den Kopf; jeder Fehlerpfad löst erst beim Senden auf.
// Regionalvarianten, Prioritäten und ausgeschlossene Sprachen (q=0) werden beachtet.
export function sprache(request: FastifyRequest): Sprache {
  const kopf = request.headers["accept-language"] ?? "";
  let gewaehlt: Sprache = "de";
  let prioritaet = 0;
  for (const eintrag of kopf.split(",")) {
    const treffer = /^([a-z]+)(?:-[a-z0-9]+)*(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i.exec(
      eintrag.trim(),
    );
    const code = treffer?.[1]?.toLowerCase();
    const gewicht = Number(treffer?.[2] ?? 1);
    if ((code === "de" || code === "en" || code === "nl") && gewicht > prioritaet) {
      gewaehlt = code;
      prioritaet = gewicht;
    }
  }
  return gewaehlt;
}

function sendError(reply: FastifyReply, error: unknown, sprache: Sprache): void {
  if (error instanceof AuthError) {
    const schluessel = error instanceof OidcUnreachableError ? "OIDC_UNREACHABLE" : error.message;
    // JOB 4011: kennt der Schlüssel eine eigene Antwort, gilt sie — sonst der Fehlercode wie bisher.
    const eigene = ANTWORT_JE_SCHLUESSEL.get(schluessel);
    reply.code(eigene?.status ?? STATUS_BY_CODE[error.code]).send({
      error: eigene?.error ?? error.code,
      message: meldung(schluessel, sprache),
    });
    return;
  }
  reply.code(500).send({ error: "INTERNAL", message: meldung("INTERNAL", sprache) });
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
        reply.code(401).send({
          error: "INVALID_CREDENTIALS",
          message: meldung("NOT_SIGNED_IN", sprache(request)),
        });
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
        reply
          .code(403)
          .send({ error: "FORBIDDEN", message: meldung("ADMIN_REQUIRED", sprache(request)) });
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
            message: meldung("REGISTRATION_DISABLED", sprache(request)),
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
            message: meldung("REGISTRATION_RATE_LIMITED", sprache(request)),
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
          reply
            .code(400)
            .send({ error: "BAD_REQUEST", message: meldung("NAME_REQUIRED", sprache(request)) });
          return;
        }
        if (typeof body.email !== "string" || !/.+@.+\..+/.test(body.email.trim())) {
          reply
            .code(400)
            .send({ error: "BAD_REQUEST", message: meldung("EMAIL_REQUIRED", sprache(request)) });
          return;
        }
        if (typeof body.password !== "string" || body.password.length < 8) {
          reply
            .code(400)
            .send({ error: "WEAK_PASSWORD", message: meldung("WEAK_PASSWORD", sprache(request)) });
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
          sendError(reply, error, sprache(request));
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
            message: meldung("LOGIN_RATE_LIMITED", sprache(request)),
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
          sendError(reply, error, sprache(request));
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

    // ============================================================================================
    // AUFTRAG-mega61 BLOCK C — LESEN UND SETZEN DER KENNTNISNAHME.
    // ============================================================================================
    //
    // Zwei Endpunkte, beide auf das EIGENE Konto und nur darauf: Es gibt keinen Weg, eine fremde
    // Kenntnisnahme zu lesen oder zu setzen — der Nutzer kommt aus der Sitzung, nicht aus dem Pfad.
    //
    // Die AKTUELLE Textfassung kommt aus der Antwort und nicht aus der Oberfläche. Sonst müsste die
    // Oberfläche die Version kennen, könnte sie mitschicken, und dann quittierte der Client eine
    // Fassung, die der Server gar nicht kennt. Der Server sagt, was gilt; der Client vergleicht.
    app.get("/api/auth/notice", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const vermerk = await service.noticeAck(user.id);
        reply.code(200).send({
          ...vermerk,
          currentVersion: HINWEIS_TEXT_VERSION,
          // Die Entscheidung fällt HIER, nicht in der Oberfläche — sonst gäbe es zwei Stellen, an
          // denen „alte Fassung" ausgelegt wird, und die zweite läuft irgendwann auseinander.
          due: hinweisFaellig(vermerk.acknowledgedVersion),
        });
      } catch (error) {
        sendError(reply, error, sprache(request));
      }
    });

    app.post("/api/auth/notice", async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        await service.acknowledgeNotice(user.id, HINWEIS_TEXT_VERSION);
        reply.code(200).send({
          acknowledgedVersion: HINWEIS_TEXT_VERSION,
          currentVersion: HINWEIS_TEXT_VERSION,
          due: false,
        });
      } catch (error) {
        sendError(reply, error, sprache(request));
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
          sendError(reply, error, sprache(request));
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
            message: meldung("RESET_RATE_LIMITED", sprache(request)),
          });
          return;
        }
        try {
          await service.resetPasswordWithToken(request.body.token, request.body.newPassword);
          recoveryLimiter.reset(resetKey); // Erfolg → Zähler löschen (risikoarm)
          reply.code(204).send();
        } catch (error) {
          recoveryLimiter.registerFailure(resetKey); // ungültiges/abgelaufenes Token zählt als Versuch
          sendError(reply, error, sprache(request));
        }
      },
    );

    // FR-AUTH-07: SSO-Start — Authorization-Code-Flow mit PKCE (S256). Erzeugt
    // state/nonce/code_verifier, legt sie kurzlebig als HttpOnly-Cookies ab und
    // leitet zum IdP weiter. Kein Implicit, kein id_token im Browser-Fragment.
    app.get("/api/auth/oidc/start", async (request, reply) => {
      if (!options.oidc) {
        reply
          .code(501)
          .send({ error: "OIDC_DISABLED", message: meldung("OIDC_DISABLED", sprache(request)) });
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
          reply
            .code(501)
            .send({ error: "OIDC_DISABLED", message: meldung("OIDC_DISABLED", sprache(request)) });
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
          reply.code(400).send({
            error: "OIDC_INVALID",
            message: meldung("OIDC_STATE_INVALID", sprache(request)),
          });
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
            sendError(reply, error, sprache(request));
            return;
          }
          reply.code(401).send({
            error: "OIDC_INVALID",
            message: meldung("OIDC_LOGIN_FAILED", sprache(request)),
          });
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
        sendError(reply, error, sprache(request));
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
          sendError(reply, error, sprache(request));
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
        sendError(reply, error, sprache(request));
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
            .send({ error: "ALREADY_SETUP", message: meldung("ALREADY_SETUP", sprache(request)) });
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
          sendError(reply, error, sprache(request));
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

    // Admin legt einen Nutzer direkt an (sofort freigegeben), optional mit Rolle — und seit
    // JOB 4011 optional BEFRISTET.
    //
    // JOB 4011 (ERSTEINRICHTUNG-GAST T1): EIN GAST ENTSTEHT BEFRISTET ODER GAR NICHT.
    //
    // Bis hierher war „einen Gastzugang anlegen, der von selbst endet" ein ZWEISTUFIGER Vorgang mit
    // einer Lücke dazwischen: erst `POST /api/users` (Konto ohne Ende), dann `PUT /api/users/:id`
    // mit `accessExpiresAt`. Scheiterte der zweite Aufruf oder unterblieb er, blieb ein
    // UNBEFRISTETER Zugang im Bestand — anmeldbar, unbegrenzt, und nichts wies ihn als unfertig
    // aus. Der Weg blieb erhalten (bestehende Konten brauchen ihn), er ist nur nicht mehr der
    // einzige.
    //
    // DREI EINGABEN, ZWEI AUSSAGEN — und der Unterschied zum Änderungsweg ist Absicht:
    //   · ein String  ⇒ „befriste auf diesen Zeitpunkt"
    //   · `null`      ⇒ „unbefristet"
    //   · FEHLEND     ⇒ „unbefristet"
    // Am Änderungsweg sind die letzten beiden VERSCHIEDEN (`null` = „NIMM die Befristung",
    // fehlend = „ich sage dazu nichts"), weil es dort eine Vorgeschichte gibt, die man
    // versehentlich löschen könnte. Beim Anlegen gibt es nichts zu nehmen: ein Konto, das gerade
    // erst entsteht, trägt keine Befristung, die ein Schweigen bewahren müsste.
    //
    // GEPRÜFT WIRD, BEVOR ETWAS ENTSTEHT — und das ist die Kernzusage dieses Auftrags, nicht eine
    // Feinheit der Reihenfolge. Die naheliegende Halbheit wäre, nach `register` einfach
    // `setAccessExpiry` hinterherzurufen; bei unlesbarer Eingabe bliebe dann genau das unbefristete
    // Konto zurück, das dieser Weg verhindern soll. Gehalten von G3 in `tests/gast-befristung/`,
    // das die NICHTENTSTEHUNG an der Nutzerliste misst und nicht den Statuscode.
    app.post<{
      // `unknown` für die Befristung und nicht `string | null`: was hier hereinkommt, bestimmt der
      // Client. EINE TYPANGABE IST KEINE PRÜFUNG (JOB 3755 R2, BEN) — sie wird unten durchgesetzt.
      Body: {
        name: string;
        email: string;
        password: string;
        role?: Role;
        accessExpiresAt?: unknown;
      };
    }>("/api/users", async (request, reply) => {
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
        accessExpiresAt?: unknown;
      };
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: meldung("NAME_REQUIRED", sprache(request)) });
        return;
      }
      if (typeof body.email !== "string" || !/.+@.+\..+/.test(body.email.trim())) {
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: meldung("EMAIL_REQUIRED", sprache(request)) });
        return;
      }
      if (typeof body.password !== "string" || body.password.length < 8) {
        reply
          .code(400)
          .send({ error: "WEAK_PASSWORD", message: meldung("WEAK_PASSWORD", sprache(request)) });
        return;
      }
      if (body.role !== undefined && !istBekannteRolle(body.role)) {
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: meldung("UNKNOWN_ROLE", sprache(request)) });
        return;
      }
      try {
        // ────────────────────────────────────────────────────────────────────────────────────
        // DIE BEIDEN WACHEN ÜBER DER BEFRISTUNG — VOR `register`, NICHT ZWISCHEN DEN SCHRITTEN.
        //
        // Sie stehen im `try`, damit ihre Antwort durch DASSELBE `sendError` läuft wie die des
        // Änderungswegs. Zwei Stellen, die denselben Rumpf selbst zusammensetzen, wären zwei
        // Antworten, die nur heute gleich aussehen (Prinzip F1b, gemessen von G6/G6b).
        // ────────────────────────────────────────────────────────────────────────────────────
        //
        // Wache 1 · DIE FORM. Byte-gleich zum Änderungsweg (`:911-917`): alles ausser String,
        // `null` und „fehlt" ist ein Rumpf, den keine Oberfläche erzeugen kann — 403 `INTERNAL`.
        const ablaufEingabe = body.accessExpiresAt;
        if (
          ablaufEingabe !== undefined &&
          ablaufEingabe !== null &&
          typeof ablaufEingabe !== "string"
        ) {
          throw new AuthError("FORBIDDEN", "INTERNAL" satisfies Meldungsschluessel);
        }
        // Wache 2 · DIE LESBARKEIT, und sie ist der Grund, warum dieser Auftrag existiert. Sie
        // urteilt NICHT selbst: `istLesbaresAblaufdatum` ist dieselbe Regel, die
        // `service.setAccessExpiry` unten anwendet (`service.ts`). Gefragt werden MUSS sie aber
        // hier, denn der Setzer braucht eine Kennung, die es vor `register` noch nicht gibt —
        // und nach `register` wäre das Konto schon da.
        if (typeof ablaufEingabe === "string" && !istLesbaresAblaufdatum(ablaufEingabe)) {
          throw new AuthError("FORBIDDEN", "ACCESS_EXPIRY_UNREADABLE" satisfies Meldungsschluessel);
        }
        // ────────────────────────────────────────────────────────────────────────────────────
        // DIE REIHENFOLGE IST DIE ZUSAGE — UND SIE STEHT SEIT RUNDE 2 AUF DEM KOPF.
        //
        // Runde 1 legte an, GAB FREI, setzte die Rolle und befristete ZULETZT. Die beiden Wachen
        // darüber schliessen den Tippfehler aus, nicht aber den SCHREIBFEHLER. BEN hat in Runde 1
        // mit gestörtem Ablagenschreiben gemessen, was dann zurückblieb:
        //
        //     F1: POST 500 · Konto vorhanden · approved: true · ohne Befristung · ANMELDUNG 200
        //     F2: POST 201 · Anmeldung MITTEN im Vorgang 200, erst danach 403
        //
        // Also genau das unbefristete, anmeldbare Konto, gegen das dieser Auftrag gebaut ist — nur
        // diesmal innerhalb EINES Aufrufs entstanden. Eine Eingabeprüfung allein erfüllt die Zusage
        // „befristet oder gar nicht" nicht; sie deckt nur den Fall, in dem der Mensch sich vertippt.
        //
        // ZWEI MITTEL, UND BEIDE ZUSAMMEN, NICHT EINS STATT DES ANDEREN — dieselbe Bauart wie
        // `acknowledgeNotice` (`service.ts`), wo die Schreibreihenfolge trägt, was ohne
        // Transaktion niemand zurückrollen kann:
        //
        //   1. DIE FREIGABE KOMMT ZULETZT. `register` legt UNFREIGEGEBEN an (der Bootstrap-Zweig
        //      darüber greift an diesem Endpunkt nie: es steht immer mindestens der aufrufende
        //      Admin im Bestand). Ein unfreigegebenes Konto kommt nicht herein — `login` wirft
        //      `NOT_APPROVED`, bevor es überhaupt nach einer Befristung fragt. Damit ist JEDER
        //      Zwischenzustand dieses Aufrufs gesperrt, und der einzige Schritt, der aufsperrt,
        //      ist der letzte: dann stehen Rolle und Ende bereits am Konto. Gemessen von G8, das
        //      MITTEN im Befristungsschreiben eine echte Anmeldung versucht.
        //   2. WAS DIESER AUFRUF ANGELEGT HAT, NIMMT ER BEI SCHEITERN ZURÜCK. Scheitert ein
        //      Schritt nach `register`, wird das eben entstandene Konto wieder gelöscht und der
        //      URSPRÜNGLICHE Fehler weitergereicht. Gemessen von G7.
        //
        // WAS HIER AUSDRÜCKLICH NICHT BEHAUPTET WIRD: eine Datenbanktransaktion über alle vier
        // Schreibschritte. Die gäbe es nur über `UserRepo` (`insert` nimmt keinen `TxContext`),
        // und `repo.ts` ist kein Zielpfad dieses Auftrags. Scheitert die Rücknahme SELBST, bleibt
        // deshalb ein Konto stehen — dann aber ein UNFREIGEGEBENES, mit dem niemand hereinkommt
        // (Mittel 1 trägt weiter). Gemessen wird das für JEDEN der drei Schritte einzeln, jeweils
        // mit ebenfalls scheiternder Rücknahme: G7b (Befristung), G7d (Freigabe), G7f (Rolle).
        //
        // JOB 4011 R3 (BEN-Befund 4): MITTEL 1 WAR IN RUNDE 2 NUR FAST WAHR, UND DIE LÜCKE LAG
        // NICHT HIER, SONDERN IM DIENST. `approveUser` setzte `approved` am GEHALTENEN Konto,
        // bevor es schrieb; scheiterte danach das Schreiben UND die Rücknahme, stand genau der
        // freigegebene, anmeldbare Rest da, den der Satz darüber ausschliesst:
        //
        //     BEN R2 REST {"post":500,"vorhanden":true,"approved":true,"login":200}
        //
        // Behoben ist das an seiner Ursache (`service.approveUser` schreibt eine Kopie), nicht
        // durch eine zweite Aufräumstelle hier — die hätte denselben Fehler nur später gemacht.
        // ────────────────────────────────────────────────────────────────────────────────────
        const created = await service.register({
          name: body.name.trim(),
          email: body.email.trim(),
          password: body.password,
        });
        let user: PublicUser = created;
        try {
          // `null` und „fehlt" laufen hier gemeinsam vorbei: beide heissen „unbefristet", und für
          // „unbefristet" gibt es beim Anlegen nichts zu tun — kein Schreibvorgang, und deshalb
          // auch KEIN `user.access-expiry-set` im Prüfprotokoll (G5/G5b). Ein Vermerk über eine
          // Entscheidung, die niemand getroffen hat, wäre eine Unwahrheit im Prüfpfad.
          if (typeof ablaufEingabe === "string") {
            user = await service.setAccessExpiry(created.id, ablaufEingabe, admin.id);
          }
          // Die Rolle wird gegen den Stand VON `register` verglichen (`created.role`), nicht gegen
          // den einer Freigabe, die es an dieser Stelle noch nicht gibt.
          const role = body.role as Role | undefined;
          if (role && role !== created.role) {
            user = await service.changeRole(created.id, role, admin.id);
          }
          // ZULETZT — und `approveUser` liest das Konto frisch. Die 201 trägt deshalb Rolle UND
          // Ende, die die beiden Schritte davor gesetzt haben (G1/G1b). Käme die Antwort aus einem
          // früheren Schritt, meldete sie „angelegt" und zeigte ein Konto ohne das, was derselbe
          // Aufruf gerade daran geschrieben hat.
          user = await service.approveUser(created.id, admin.id);
        } catch (fehler) {
          // Die Rücknahme geht über `service.deleteUser` und nicht an ihm vorbei: dort liegt der
          // Aussperrschutz, und eine zweite Löschstelle wäre eine zweite Auslegung derselben
          // Regel. Sie hinterlässt ihren eigenen Vermerk (`user.delete`) — ein Konto, das es kurz
          // gab, verschwindet nicht lautlos aus dem Prüfpfad.
          //
          // IHR SCHEITERN DARF DEN URSPRÜNGLICHEN FEHLER NICHT VERDECKEN: was der Admin liest, ist
          // der Grund, aus dem das ANLEGEN scheiterte, nicht der Grund, aus dem das Aufräumen
          // scheiterte. Deshalb wird er protokolliert und nicht geworfen.
          //
          // JOB 4011 R4 (BEN-Befund 5 der Runde 3): DIE PROTOKOLLZEILE WIRD GEMESSEN, NICHT
          // HERGELEITET.
          //
          // Runde 2 schrieb hier „es bleibt UNFREIGEGEBEN stehen", Runde 3
          // `freigabeDurchgelaufen: false`. Beides waren Schlüsse aus dem Kontrollfluss, keine
          // Blicke in den Bestand — und beide Male waren sie falsch, sobald der Bestand etwas
          // anderes hergab: BEN mass einen Rest mit `approved: true`, während diese Zeile das
          // Gegenteil behauptete. Ein Satz über einen Zustand, den der Aufruf nicht nachgesehen
          // hat, ist eine Vermutung, auch wenn die Herleitung heute stimmt.
          //
          // GELESEN WIRD DESHALB DER BESTAND SELBST, und die Zeile sagt genau, was dort steht —
          // einschliesslich des Falls, in dem auch das Lesen nicht mehr geht („unbekannt"). Der
          // Satz richtet sich nach dem Befund: ein freigegebener Rest ist ein offener Zugang und
          // wird als solcher benannt, statt in einer beruhigenden Formel zu verschwinden. Gemessen
          // von G7j in `tests/gast-befristung/`, das die Zeile selbst liest — auch gegen einen
          // Rest, der freigegeben ist.
          try {
            await service.deleteUser(created.id, admin.id);
          } catch (aufraeumfehler) {
            const befund = await restBefund(service, created.id);
            request.log.error(
              { err: aufraeumfehler, konto: created.id, ...befund },
              `JOB 4011: Rücknahme eines halb angelegten Kontos gescheitert — ${restSatz(befund)}`,
            );
          }
          throw fehler;
        }
        reply.code(201).send(user);
      } catch (error) {
        sendError(reply, error, sprache(request));
      }
    });

    // Admin ändert Rolle / gibt frei / setzt Passwort zurück / befristet den Zugang — ein
    // Endpunkt (§2.2).
    //
    // JOB 3755 (DEMO-ZUGANG-GAESTE T2): DER SCHREIBWEG ZUR BEFRISTUNG.
    //
    // JOB 3665 hat alles gebaut, was unter dieser Route liegt — das Feld am Konto (`types.ts:51`),
    // den Setzer samt Aussperrschutz und Datumsprüfung (`service.ts:401`) und die Sperre beim
    // Anmelden. Nur der Weg von außen fehlte: der Body kannte `role`, `approve`, `password`, und
    // damit war die Zusage „sein Zugang läuft ab" im Produkt vorhanden und unerreichbar. Gelesen
    // wurde das Feld schon immer mit (`PublicUser`, `GET /api/users`) — es fehlte genau diese Hälfte.
    //
    // DREI EINGABEN, DREI VERSCHIEDENE AUSSAGEN, und die Unterscheidung ist keine Feinheit:
    //   · ein String  ⇒ „befriste auf diesen Zeitpunkt"
    //   · `null`      ⇒ „NIMM die Befristung" (der Weg zurück; ohne ihn wäre jede Befristung eine
    //                   Falle, aus der nur Löschen und Neuanlegen des Kontos herausführte)
    //   · FEHLEND     ⇒ „ich sage dazu nichts". Ein Aufruf, der nur die Rolle ändert, darf eine
    //                   bestehende Befristung nicht löschen — sonst verschwände sie still, und
    //                   niemand wüsste, wann.
    //
    // KEINE ZWEITE REGEL AN DIESER STELLE: ob eine Zeichenkette ein lesbares Ablaufdatum ist und ob
    // sie den letzten unbefristeten Admin aussperren würde, entscheidet ALLEIN der Dienst. Die
    // Route reicht durch und übersetzt den Wurf über `sendError` (403). Läge das Urteil auch hier,
    // liefen zwei Auslegungen desselben Begriffs auseinander.
    //
    // JOB 3755 R2 (BEN-Befund): EINE TYPANGABE IST KEINE PRÜFUNG — deshalb steht `unknown` da.
    //
    // Runde 1 schrieb hier `accessExpiresAt?: string | null`. Das ist eine BEHAUPTUNG über fremde
    // Eingabe: der Typprüfer sieht von einem HTTP-Rumpf nichts, und gemessen kam beides durch:
    //   · `["2026-09-11T13:00:00.000Z"]` ⇒ 200, und im Konto stand danach ein ARRAY. Die
    //     Datumsprüfung des Dienstes wandelt ihr Argument still in eine Zeichenkette um
    //     (`ISO_ZEITSTEMPEL.exec`), und ein einelementiges Array wird dabei zu genau seinem Inhalt.
    //     Entstanden wäre ein Bestand, den `types.ts:51` (`accessExpiresAt?: string`) ausschließt.
    //   · `{"toString": "kein Datum"}` ⇒ 500. Die Umwandlung wirft, der Wurf ist kein `AuthError`,
    //     und der Mensch bekommt einen Serverfehler statt einer Ablehnung.
    // GEPRÜFT WIRD DESHALB DIE FORM — String, `null`, nichts —, und zwar VOR jedem Schreiben: ein
    // Aufruf, der zur Hälfte ausgeführt wird (Rolle geändert, Befristung abgelehnt), wäre die
    // schlechtere Hälfte der beiden.
    //
    // JOB 3780 (DEMO-ZUGANG-GAESTE REST c): DIESELBE REGEL WIE BEIM ANLEGEN — FÜR ALLE VIER FELDER.
    //
    // JOB 3755 hat `accessExpiresAt` die Behauptung `string | null` weggenommen und eine Prüfung
    // hingestellt. Seine eigene Rückgabe nannte, was dabei liegen blieb: `role`, `approve` und
    // `password` standen weiter als Typangabe da, und der Typprüfer sieht von einem HTTP-Rumpf
    // nichts. Gemessen am Stand `be5c09b`, an DERSELBEN Anwendung, mit DEMSELBEN Wert:
    //
    //     POST /api/users   {"role":"chef"}  →  400 „Unbekannte Rolle."   (:641-664 prüft)
    //     PUT  /api/users/:id {"role":"chef"} →  200, und im Konto stand danach `role: "chef"` —
    //                                            ein Wert, den `types.ts:1` nicht kennt.
    //
    // Dazu zwei stille Nachbarn: `{"password": 12345678}` ergab 500 (eine Zahl hat kein `.length`,
    // die Längenprüfung des Dienstes ließ sie durch, `pbkdf2` warf), und `{"approve":"true"}` ergab
    // 204 — der Aufrufer hielt die Freigabe für erteilt, das Konto war unverändert.
    //
    // DIE GRENZE BLEIBT, WO JOB 3755 SIE GEZOGEN HAT: hier urteilt die FORM (bekannter Rollenname ·
    // Zeichenkette · Boolean), im Dienst die BEDEUTUNG (Passwortstärke, Aussperrschutz,
    // Selbst-Herabstufung, Lesbarkeit des Datums). Zwei Fragen, zwei Stellen — sonst liefen zwei
    // Auslegungen desselben Begriffs auseinander.
    app.put<{
      Params: { id: string };
      // `unknown` und nicht `Role`/`boolean`/`string`: was hier hereinkommt, bestimmt der Client.
      // Der Vertrag nach außen bleibt derselbe — er wird eine Zeile weiter unten DURCHGESETZT statt
      // nur aufgeschrieben. Eine Typangabe ist keine Prüfung (JOB 3755 R2, BEN).
      Body: {
        role?: unknown;
        approve?: unknown;
        password?: unknown;
        accessExpiresAt?: unknown;
      };
    }>("/api/users/:id", async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) {
        return;
      }
      const { id } = request.params;
      const { role, approve, password, accessExpiresAt } = request.body;
      try {
        // ────────────────────────────────────────────────────────────────────────────────────────
        // DIE FORMWACHE — SIE STEHT VOR JEDEM SCHREIBVORGANG, ALLE VIER FELDER IN EINEM BLOCK.
        //
        // Nicht zwischen den Schreibaufrufen und nicht je Feld kurz davor: ein Aufruf, der zur
        // Hälfte ausgeführt wird (freigegeben, Rolle abgelehnt), wäre die schlechtere Hälfte der
        // beiden — der Admin sähe einen Fehler, obwohl sein Aufruf das Konto verändert hat.
        // ────────────────────────────────────────────────────────────────────────────────────────
        //
        // Byte-gleich zur Antwort beim Anlegen (:659-663) und aus derselben Liste geurteilt.
        // Auch `""` und `null` fallen hier heraus: sie liefen bisher durch `if (role)` und wurden
        // STILL verschluckt — 204 auf einen Aufruf, der nichts getan hat.
        if (role !== undefined && !istBekannteRolle(role)) {
          reply
            .code(400)
            .send({ error: "BAD_REQUEST", message: meldung("UNKNOWN_ROLE", sprache(request)) });
          return;
        }
        // Dieselbe 400 „Passwort muss mindestens 8 Zeichen haben.", die das Anlegen gibt (:653-657)
        // und die der Dienst für eine zu KURZE Zeichenkette liefert (`service.ts:840`). Die LÄNGE
        // wird hier NICHT geprüft: über die Stärke urteilt allein der Dienst, sonst gäbe es zwei
        // Stellen, an denen „zu schwach" ausgelegt wird.
        if (password !== undefined && typeof password !== "string") {
          reply
            .code(400)
            .send({ error: "WEAK_PASSWORD", message: meldung("WEAK_PASSWORD", sprache(request)) });
          return;
        }
        // Derselbe Fehlervertrag wie ein unlesbares Datum (403, „Unerwarteter Fehler.") — ein
        // eigener Satz für „falscher Typ" wäre ein neuer Katalogschlüssel, und `meldungen.ts`
        // gehört in diesem Takt JOB 3756. Beides ist dieselbe Sorte Eingabe: eine, die eine
        // Oberfläche nie erzeugen dürfte. Der schwächere Satz ist bewusst gewählt und bleibt ein
        // offener Punkt, kein Zielzustand.
        if (approve !== undefined && typeof approve !== "boolean") {
          throw new AuthError("FORBIDDEN", "INTERNAL" satisfies Meldungsschluessel);
        }
        if (
          accessExpiresAt !== undefined &&
          accessExpiresAt !== null &&
          typeof accessExpiresAt !== "string"
        ) {
          throw new AuthError("FORBIDDEN", "INTERNAL" satisfies Meldungsschluessel);
        }
        let user: PublicUser | undefined;
        if (approve === true) {
          user = await service.approveUser(id, admin.id);
        }
        if (role !== undefined) {
          user = await service.changeRole(id, role, admin.id);
        }
        // `!== undefined` statt `if (password)`: ein leerer String ist eine gültige FORM und ein
        // ungültiges Passwort — er gehört dem Dienst vorgelegt und mit „zu schwach" abgelehnt,
        // nicht stillschweigend übergangen.
        if (password !== undefined) {
          await service.resetPassword(id, password, admin.id);
        }
        // ZULETZT, und die Reihenfolge ist die Aussage: `user` trägt danach den Stand MIT der
        // soeben geschriebenen Befristung. Käme die Antwort aus dem Ergebnis von `approveUser`
        // oder `changeRole`, meldete die Oberfläche „gespeichert" und zeigte den Stand von davor.
        if (accessExpiresAt !== undefined) {
          user = await service.setAccessExpiry(
            id,
            accessExpiresAt === null ? undefined : accessExpiresAt,
            admin.id,
          );
        }
        if (user) {
          reply.code(200).send(user);
        } else {
          reply.code(204).send();
        }
      } catch (error) {
        sendError(reply, error, sprache(request));
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
        sendError(reply, error, sprache(request));
      }
    });
  };
}
