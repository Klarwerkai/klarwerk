import { randomBytes, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import { hashPassword, verifyPassword } from "./password";
import type { SessionRepo, UserRepo } from "./repo";
import { AuthError, type PublicUser, type Role, type User } from "./types";

const MIN_PASSWORD_LENGTH = 8;
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 Tage

export interface AuthServiceDeps {
  users: UserRepo;
  sessions: SessionRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
  genToken?: () => string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function toPublic(user: User): PublicUser {
  const { passwordSalt: _salt, passwordHash: _hash, ...rest } = user;
  return rest;
}

export class AuthService {
  private readonly users: UserRepo;
  private readonly sessions: SessionRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;
  private readonly genToken: () => string;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.sessions = deps.sessions;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    this.genToken = deps.genToken ?? (() => randomBytes(32).toString("hex"));
  }

  // FR-AUTH-01 (erstes Konto = Admin) + FR-AUTH-02 (Selbstregistrierung, gesperrt bis Freigabe).
  async register(input: RegisterInput): Promise<PublicUser> {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    if (await this.users.findByEmail(input.email)) {
      throw new AuthError("EMAIL_TAKEN", "E-Mail ist bereits vergeben.");
    }
    const isFirstAccount = (await this.users.count()) === 0;
    const { salt, hash } = hashPassword(input.password);
    const user: User = {
      id: this.genId(),
      name: input.name,
      email: input.email,
      passwordSalt: salt,
      passwordHash: hash,
      role: isFirstAccount ? "admin" : "experte",
      approved: isFirstAccount,
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.users.insert(user);
    return toPublic(user);
  }

  // FR-AUTH-03: Login nur mit korrekten, freigegebenen Daten; FR-AUTH-05: Hash-Prüfung.
  async login(input: LoginInput): Promise<{ token: string; user: PublicUser }> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !verifyPassword(input.password, user.passwordSalt, user.passwordHash)) {
      throw new AuthError("INVALID_CREDENTIALS", "E-Mail oder Passwort falsch.");
    }
    if (!user.approved) {
      throw new AuthError("NOT_APPROVED", "Konto ist noch nicht freigegeben.");
    }
    const token = this.genToken();
    await this.sessions.create({
      token,
      userId: user.id,
      expiresAt: this.now() + SESSION_TTL_MS,
    });
    await this.record(user.id, "auth.login", user.id);
    return { token, user: toPublic(user) };
  }

  // FR-AUTH-04: Logout beendet die Sitzung serverseitig.
  async logout(token: string): Promise<void> {
    const session = await this.sessions.find(token);
    await this.sessions.delete(token);
    if (session) {
      await this.record(session.userId, "auth.logout", session.userId);
    }
  }

  async authenticate(token: string): Promise<PublicUser | undefined> {
    const session = await this.sessions.find(token);
    if (!session) {
      return undefined;
    }
    if (session.expiresAt <= this.now()) {
      await this.sessions.delete(token);
      return undefined;
    }
    const user = await this.users.findById(session.userId);
    return user ? toPublic(user) : undefined;
  }

  // FR-AUTH-02 / FR-RBAC-02: Admin gibt Konto frei.
  async approveUser(userId: string, actorId: string): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    user.approved = true;
    await this.users.update(user);
    await this.record(actorId, "user.approve", userId);
    return toPublic(user);
  }

  // FR-RBAC-02: Rolle ändern.
  async changeRole(userId: string, role: Role, actorId: string): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    user.role = role;
    await this.users.update(user);
    await this.record(actorId, "user.role-change", userId, { role });
    return toPublic(user);
  }

  // FR-AUTH-06: Admin-Passwort-Reset; bestehende Sitzungen des Nutzers werden ungültig.
  async resetPassword(userId: string, newPassword: string, actorId: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    const user = await this.requireUser(userId);
    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    await this.users.update(user);
    await this.sessions.deleteByUser(userId);
    await this.record(actorId, "user.password-reset", userId);
  }

  // FR-RBAC-02: Admin löscht Nutzer; Sitzungen verfallen.
  async deleteUser(userId: string, actorId: string): Promise<void> {
    await this.requireUser(userId);
    await this.users.delete(userId);
    await this.sessions.deleteByUser(userId);
    await this.record(actorId, "user.delete", userId);
  }

  // FR-RBAC-02: Audit-Eintrag je Admin-Aktion (sofern Audit verdrahtet).
  private async record(
    actor: string,
    action: string,
    target: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (this.audit) {
      await this.audit.record(
        payload ? { actor, action, target, payload } : { actor, action, target },
      );
    }
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AuthError("NOT_FOUND", "Nutzer nicht gefunden.");
    }
    return user;
  }
}
