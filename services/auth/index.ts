// Öffentliche API des Moduls auth. Andere Module/der Composition-Root importieren NUR von hier.
export { AuthService } from "./src/service";
export type { AuthServiceDeps, RegisterInput, LoginInput } from "./src/service";
// WP-VIP2-GATE (bens P1, Token-at-Rest): Hash-Format + Einmal-Migration des Klartext-Bestands.
export { TOKEN_HASH_PREFIX, hashTokenAtRest } from "./src/service";
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
export { AuthError } from "./src/types";
export type { Role, User, PublicUser, Session, AuthErrorCode } from "./src/types";
