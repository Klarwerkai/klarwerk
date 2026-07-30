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
  // AUFTRAG-mega61 Block C: die Kenntnisnahme des Hinweises (Endgerätespeicher + KI-Transparenz).
  // BEIDE Felder oder keins — der Zeitstempel allein sagt nicht, WAS gelesen wurde, und die
  // Version allein nicht, WANN. Optional, weil Bestandskonten sie nicht haben: „kein Vermerk“ ist
  // ein gültiger Zustand und bedeutet „Hinweis erscheint“.
  //
  // NICHT hier: IP-Adresse, Browserkennung. Der Vermerk ist eine Quittung, kein Protokoll über die
  // Person — dieselbe Grenze, die das Prüfprotokoll in services/audit ohnehin zieht.
  noticeAckAt?: string;
  noticeAckVersion?: string;
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
