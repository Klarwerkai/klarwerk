// Öffentliche API des Moduls auth. Andere Module/der Composition-Root importieren NUR von hier.
export { AuthService } from "./src/service";
export type { AuthServiceDeps, RegisterInput, LoginInput } from "./src/service";
export { authRoutes } from "./src/routes";
export {
  InMemoryUserRepo,
  InMemorySessionRepo,
  type UserRepo,
  type SessionRepo,
} from "./src/repo";
export { AuthError } from "./src/types";
export type { Role, User, PublicUser, Session, AuthErrorCode } from "./src/types";
