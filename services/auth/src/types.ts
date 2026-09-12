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
  // JOB 3665 (DEMO-ZUGANG-GAESTE T1): DER ZUGANG, DER VON SELBST ENDET.
  //
  // Pedis vierte Zusage zum Demo-Zugang — „sein Zugang laeuft ab" — trug die Anmeldung bis hierher
  // nicht: ein einmal freigegebenes Konto blieb fuer immer freigegeben. ISO-8601, dieselbe Form wie
  // `createdAt` und `noticeAckAt`.
  //
  // OPTIONAL UND OHNE VORGABEWERT, und das ist keine Bequemlichkeit: „kein Ablauf" ist der gueltige
  // NORMALZUSTAND jedes regulaeren Kontos. Ein Vorgabewert wuerde jedem Bestandskonto eine
  // Befristung andichten, die niemand beschlossen hat — dieselbe Begruendung, mit der
  // `notice_ack_at` NULL-bar bleibt.
  //
  // DIES IST KEIN ZWEITER FREIGABEWEG neben `approved`. Es ist eine ZUSAETZLICHE Bedingung, die an
  // genau einer Stelle ausgewertet wird (`AuthService.zugangAbgelaufen`). Und es ist NICHT der
  // Ablauf einer Sitzung: `Session.expiresAt` hat seine eigene, unberuehrte Bedeutung — zwei
  // Ablaufbegriffe, die sich vermischen, waeren der eigentliche Fehler.
  accessExpiresAt?: string;
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
