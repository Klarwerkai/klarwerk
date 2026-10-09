import type { Role } from "../app/navigation";
import { api } from "./client";

// Auth-/Session-API gegen die vorhandenen Endpunkte (services/auth).
export interface SessionUser {
  id: string;
  name?: string;
  email?: string;
  role: Role;
  // R-0582: verknüpfte SSO-Identität — dann bietet die Kontodatenkarte die SSO-Bestätigung an.
  oidcSubject?: string;
}

export interface AuthStatus {
  needsSetup: boolean;
  // FR-AUTH-07: SSO nur anbieten, wenn der Server OIDC vollständig konfiguriert hat.
  oidcEnabled?: boolean;
  // JOB 4105: Nimmt diese Instanz selbst angelegte Konten an? OPTIONAL, und das ist keine
  // Bequemlichkeit: Ein älterer Server antwortet ohne dieses Feld, und `undefined` heißt dann
  // UNBEKANNT — nicht „aus". Wer es zu `false` verrechnet, lässt die Maske über eine Instanz
  // urteilen, die dazu nichts gesagt hat (s. `AuthContext`).
  selfRegistrationEnabled?: boolean;
}

// AUFTRAG-mega61 Block C: der Vermerk am Konto. `due` entscheidet der SERVER — die Oberfläche
// vergleicht keine Versionen, sie fragt. Eine zweite Auslegung von „alte Fassung" wäre eine zweite
// Wahrheit, und die eine, die auseinanderläuft, wäre immer die im Browser.
export interface NoticeAck {
  acknowledgedAt?: string;
  acknowledgedVersion?: string;
  currentVersion: string;
  due: boolean;
}

export const authApi = {
  status: (): Promise<AuthStatus> => api.get<AuthStatus>("/auth/status"),
  notice: (): Promise<NoticeAck> => api.get<NoticeAck>("/auth/notice"),
  acknowledgeNotice: (): Promise<NoticeAck> => api.post<NoticeAck>("/auth/notice"),
  me: (): Promise<SessionUser> => api.get<SessionUser>("/auth/me"),
  login: (email: string, password: string): Promise<{ user: SessionUser }> =>
    api.post<{ user: SessionUser }>("/auth/login", { email, password }),
  logout: (): Promise<void> => api.post<void>("/auth/logout"),
  // FR-AUTH-07: SSO-Start liegt als GET-Redirect auf dem Server (Full-Page-Navigation).
  ssoStartUrl: "/api/auth/oidc/start",
  // R-0582: dieselbe SSO-Anmeldung als Identitätsbestätigung für eine neue E-Mail aus dem Profil.
  ssoProfilBestaetigungUrl: "/api/auth/oidc/start?ziel=profil",
  // FR-AUTH-07: Callback — Code+State gegen Session tauschen (PKCE serverseitig).
  // Aufnahme m365-anmeldung: `weiter` nennt der Server nur, wenn der Anmeldedialog des Word-Add-ins
  // das SSO gestartet hat — dann geht es zurück auf die Dialogseite (s. `ssoWeiterziel`).
  oidc: (code: string, state: string): Promise<{ user: SessionUser; weiter?: unknown }> =>
    api.post<{ user: SessionUser; weiter?: unknown }>("/auth/oidc", { code, state }),
  // Self-Service: angemeldeter Nutzer ändert sein eigenes Passwort (altes Passwort nötig).
  changePassword: (oldPassword: string, newPassword: string): Promise<void> =>
    api.post<void>("/auth/password", { oldPassword, newPassword }),
  // R-0582: eigene Kontodaten berichtigen. Eine neue E-Mail verlangt das aktuelle Passwort.
  correctAccount: (eingabe: {
    name?: string;
    email?: string;
    currentPassword?: string;
  }): Promise<SessionUser> => api.put<SessionUser>("/auth/me", eingabe),
  // FR-AUTH-08: Reset anfordern (Antwort immer 204) und einlösen (Token + neues Passwort).
  forgot: (email: string): Promise<void> => api.post<void>("/auth/forgot", { email }),
  reset: (token: string, newPassword: string): Promise<void> =>
    api.post<void>("/auth/reset", { token, newPassword }),
  register: (name: string, email: string, password: string): Promise<unknown> =>
    api.post("/auth/register", { name, email, password }),
  // Ersteinrichtung: erstes Konto wird Admin (FR-AUTH-01).
  setup: (name: string, email: string, password: string): Promise<{ user: SessionUser }> =>
    api.post<{ user: SessionUser }>("/auth/setup", { name, email, password }),
};
