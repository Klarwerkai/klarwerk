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
  // JOB 2686 (Review-Befund R2-7): DIE IDENTITAET AUS DEM ANBIETER, nicht die Mailadresse.
  //
  // `sub` ist der einzige Wert, den ein OIDC-Anbieter als stabil und nie wiederverwendet zusagt.
  // Die E-Mail ist es ausdruecklich NICHT: sie kann unverifiziert sein, sie kann umziehen, und ein
  // Nachfolger auf demselben Postfach bekommt sie neu. Wer allein ihr glaubt, laesst genau das zu.
  //
  // BEIDE FELDER ODER KEINS, und der Grund ist nicht Symmetrie: `sub` ist nur INNERHALB eines
  // Ausstellers eindeutig. Zwei Anbieter duerfen dieselbe `sub` vergeben; erst das Paar
  // (Aussteller, Subjekt) ist eine Identitaet.
  //
  // Optional, weil Bestandskonten sie nicht haben — „noch nicht verknuepft" ist ein gueltiger
  // Zustand und heisst „darf sich beim naechsten Mal verknuepfen, aber nur mit verifizierter
  // Adresse" (der Uebergangsweg in AuthService.loginWithOidc).
  oidcIssuer?: string;
  oidcSubject?: string;
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
