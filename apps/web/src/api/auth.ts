import type { Role } from "../app/navigation";
import { api } from "./client";

// Auth-/Session-API gegen die vorhandenen Endpunkte (services/auth).
export interface SessionUser {
  id: string;
  name?: string;
  email?: string;
  role: Role;
}

export interface AuthStatus {
  needsSetup: boolean;
}

export const authApi = {
  status: (): Promise<AuthStatus> => api.get<AuthStatus>("/auth/status"),
  me: (): Promise<SessionUser> => api.get<SessionUser>("/auth/me"),
  login: (email: string, password: string): Promise<{ user: SessionUser }> =>
    api.post<{ user: SessionUser }>("/auth/login", { email, password }),
  logout: (): Promise<void> => api.post<void>("/auth/logout"),
  register: (name: string, email: string, password: string): Promise<unknown> =>
    api.post("/auth/register", { name, email, password }),
  // Ersteinrichtung: erstes Konto wird Admin (FR-AUTH-01).
  setup: (name: string, email: string, password: string): Promise<{ user: SessionUser }> =>
    api.post<{ user: SessionUser }>("/auth/setup", { name, email, password }),
};
