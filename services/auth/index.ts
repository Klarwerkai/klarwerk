// Öffentliche API des Moduls auth. Andere Module/der Composition-Root importieren NUR von hier.
export { AuthService } from "./src/service";
export type { AuthServiceDeps, RegisterInput, LoginInput } from "./src/service";
export { authRoutes } from "./src/routes";
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
  createOidcVerifierFromEnv,
  type OidcClaims,
  type OidcConfig,
  type OidcVerifier,
} from "./src/oidc";
export { AuthError } from "./src/types";
export type { Role, User, PublicUser, Session, AuthErrorCode } from "./src/types";
