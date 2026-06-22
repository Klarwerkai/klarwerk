export type Role = "viewer" | "experte" | "controller" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  role: Role;
  approved: boolean;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

export type PublicUser = Omit<User, "passwordSalt" | "passwordHash">;

export type AuthErrorCode =
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "NOT_APPROVED"
  | "WEAK_PASSWORD"
  | "FORBIDDEN"
  | "NOT_FOUND";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}
