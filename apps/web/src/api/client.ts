// Typisierter API-Client gegen die Modul-Endpunkte (gleiche Origin, /api).
// Cookie-Session (kw_session) wird mitgesendet. Fehler werden auf das
// Backend-Schema {error, message} gemappt (siehe services/app/src/http.ts).
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const BASE = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...init, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const raw = await res.text();
  const data: unknown = raw ? JSON.parse(raw) : undefined;

  if (!res.ok) {
    const obj = (data ?? {}) as { error?: unknown; message?: unknown };
    throw new ApiError(
      res.status,
      obj.error ? String(obj.error) : "ERROR",
      obj.message ? String(obj.message) : res.statusText,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> => {
    const init: RequestInit = { method: "POST" };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return apiFetch<T>(path, init);
  },
  put: <T>(path: string, body?: unknown): Promise<T> => {
    const init: RequestInit = { method: "PUT" };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return apiFetch<T>(path, init);
  },
  del: <T>(path: string): Promise<T> => apiFetch<T>(path, { method: "DELETE" }),
};
