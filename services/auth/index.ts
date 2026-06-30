// Öffentliche API des Moduls auth. Andere Module/der Composition-Root importieren NUR von hier.
export { AuthService } from "./src/service";
export type { AuthServiceDeps, RegisterInput, LoginInput } from "./src/service";
export { authRoutes } from "./src/routes";
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
