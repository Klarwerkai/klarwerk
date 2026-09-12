// Öffentliche API des Moduls auth. Andere Module/der Composition-Root importieren NUR von hier.
export { AuthService } from "./src/service";
export type { AuthServiceDeps, RegisterInput, LoginInput } from "./src/service";
// WP-VIP2-GATE (bens P1, Token-at-Rest): Hash-Format + Einmal-Migration des Klartext-Bestands.
export { TOKEN_HASH_PREFIX, hashTokenAtRest } from "./src/service";
// JOB 2686 (R2-8): die Sitzungsdauer für SSO-Anmeldungen als eigener, prüfbarer Schalter.
// Vorgabe ist das heutige Verhalten (14 Tage); die Zahl ist eine offene Frage bei Pedi.
export { oidcSessionTtlMs } from "./src/service";
export { migrateAuthTokensAtRest } from "./src/repo-pg";
export { authRoutes } from "./src/routes";
// WP-VIP2-GATE (bens P1): Registrierungs-Schalter + Cookie-Start-Wächter (testbar exportiert).
export {
  assertCookieSecurityConfig,
  selfRegistrationEnabled,
  REGISTER_MAX_ATTEMPTS_PER_MINUTE,
} from "./src/routes";
// SCRUM-356 / AG-06 / NFR-SEC-04: Login-Brute-Force-/Rate-Limit-Schutz.
export { LoginRateLimiter } from "./src/rate-limit";
export type { LoginRateLimiterOptions, RateLimitDecision } from "./src/rate-limit";
export {
  InMemoryUserRepo,
  InMemorySessionRepo,
  InMemoryPasswordResetRepo,
  type UserRepo,
  type SessionRepo,
  type PasswordResetRepo,
} from "./src/repo";
export { PgUserRepo, PgSessionRepo, PgPasswordResetRepo, AUTH_SCHEMA } from "./src/repo-pg";
export {
  createOidcVerifier,
  createOidcProvider,
  createOidcProviderFromEnv,
  createTokenExchanger,
  createPkcePair,
  codeChallengeS256,
  mapOidcRole,
  parseRolesClaim,
  randomToken,
  type OidcClaims,
  type OidcConfig,
  type OidcRoleConfig,
  type OidcVerifier,
  type OidcProvider,
  type TokenExchanger,
} from "./src/oidc";
// JOB 3568 (Q9-FREMDE-FLÄCHEN): der Meldungskatalog und der EINE Kopfleser werden über die
// Modulgrenze erreichbar. Grund: `services/app/src/http.ts` und `services/rbac/src/guard.ts` senden
// dieselben drei Sätze (`NOT_SIGNED_IN`, `INTERNAL`) und trugen sie bis hierher als deutsche
// Literale im Code. Sie brauchen den Katalog, keinen eigenen — ein zweiter `accept-language`-Parser
// oder eine Kopie der Texte wäre genau die Doppelquelle, die JOB 3449 beseitigt hat.
// `sprache` bleibt deshalb die eine Lesestelle (`./src/routes:94-95`) und wird exportiert, nicht
// nachgebaut. Die Modulkante ist nicht neu: beide Dateien importieren schon heute `Role` von hier.
export { MELDUNGEN, meldung } from "./src/meldungen";
export type { Meldungsschluessel, Sprache } from "./src/meldungen";
export { sprache } from "./src/routes";
export { AuthError } from "./src/types";
export type { Role, User, PublicUser, Session, AuthErrorCode } from "./src/types";
