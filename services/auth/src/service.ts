import { randomBytes, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { OidcClaims } from "./oidc";
import { hashPassword, verifyPassword } from "./password";
import {
  InMemoryPasswordResetRepo,
  type PasswordResetRepo,
  type SessionRepo,
  type UserRepo,
} from "./repo";
import { AuthError, type PublicUser, type Role, type User } from "./types";

const MIN_PASSWORD_LENGTH = 8;
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 Tage
const RESET_TTL_MS = 60 * 60 * 1000; // FR-AUTH-08: Reset-Token 1 Stunde gültig

export interface AuthServiceDeps {
  users: UserRepo;
  sessions: SessionRepo;
  resetTokens?: PasswordResetRepo;
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
  private readonly resetTokens: PasswordResetRepo;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.sessions = deps.sessions;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    this.genToken = deps.genToken ?? (() => randomBytes(32).toString("hex"));
    this.resetTokens = deps.resetTokens ?? new InMemoryPasswordResetRepo();
  }

  // FR-AUTH-01: Ist noch kein Konto vorhanden? Dann ist Ersteinrichtung nötig (Setup-Screen).
  async needsSetup(): Promise<boolean> {
    return (await this.users.count()) === 0;
  }

  // FR-RBAC-01: Nutzerliste (ohne Passwort-Hash) für die Admin-Verwaltung.
  async listUsers(): Promise<PublicUser[]> {
    const users = await this.users.list();
    return users.map(toPublic);
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

  // FR-AUTH-07: SSO-Login. Bereits verifizierte OIDC-Claims → Sitzung. Optional
  // Auto-Provisionierung neuer Nutzer (sonst muss der Admin das Konto anlegen).
  async loginWithOidc(
    claims: OidcClaims,
    autoProvision: boolean,
  ): Promise<{ token: string; user: PublicUser }> {
    let account = await this.users.findByEmail(claims.email);
    if (!account) {
      if (!autoProvision) {
        throw new AuthError(
          "NOT_APPROVED",
          "Kein Konto für diese E-Mail. Bitte vom Admin anlegen lassen.",
        );
      }
      const isFirstAccount = (await this.users.count()) === 0;
      account = {
        id: this.genId(),
        name: claims.name,
        email: claims.email,
        passwordSalt: "", // SSO-Konto: kein Passwort-Login möglich.
        passwordHash: "",
        role: isFirstAccount ? "admin" : "experte",
        approved: true,
        createdAt: new Date(this.now()).toISOString(),
      };
      await this.users.insert(account);
      await this.record(account.id, "user.oidc-provisioned", account.id);
    }
    if (!account.approved) {
      throw new AuthError("NOT_APPROVED", "Konto ist noch nicht freigegeben.");
    }
    const token = this.genToken();
    await this.sessions.create({
      token,
      userId: account.id,
      expiresAt: this.now() + SESSION_TTL_MS,
    });
    await this.record(account.id, "auth.login", account.id, { method: "oidc" });
    return { token, user: toPublic(account) };
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

  // Self-Service: angemeldeter Nutzer ändert sein eigenes Passwort (altes Passwort nötig).
  // Andere Sitzungen werden ungültig; die aktuelle bleibt erhalten (Caller setzt sie neu, falls nötig).
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    const user = await this.requireUser(userId);
    if (!verifyPassword(oldPassword, user.passwordSalt, user.passwordHash)) {
      throw new AuthError("INVALID_CREDENTIALS", "Aktuelles Passwort ist falsch.");
    }
    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    await this.users.update(user);
    await this.sessions.deleteByUser(userId);
    await this.record(userId, "user.password-changed", userId);
  }

  // FR-AUTH-08: Reset anfordern — erzeugt einen kurzlebigen Token. Unbekannte E-Mail → undefined
  // (Existenz wird nicht verraten). Der Versand der E-Mail erfolgt in der Route über den Mailer.
  async requestPasswordReset(
    email: string,
  ): Promise<{ token: string; user: PublicUser } | undefined> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      return undefined;
    }
    const token = this.genToken();
    await this.resetTokens.create({ token, userId: user.id, expiresAt: this.now() + RESET_TTL_MS });
    return { token, user: toPublic(user) };
  }

  // FR-AUTH-08: Reset einlösen — Token muss gültig (nicht abgelaufen) sein.
  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError("WEAK_PASSWORD", "Passwort muss mindestens 8 Zeichen haben.");
    }
    const entry = await this.resetTokens.find(token);
    if (!entry || entry.expiresAt <= this.now()) {
      throw new AuthError("INVALID_CREDENTIALS", "Reset-Token ungültig oder abgelaufen.");
    }
    const user = await this.requireUser(entry.userId);
    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    await this.users.update(user);
    await this.sessions.deleteByUser(user.id);
    await this.resetTokens.delete(token);
    await this.record(user.id, "user.password-reset-email", user.id);
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
