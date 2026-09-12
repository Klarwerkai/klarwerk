import i18n from "i18next";
import { gespeicherteSprache } from "../lib/sprachwahl";

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
  headers.set("Accept-Language", i18n.language || gespeicherteSprache());
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

// ================================================================================================
// JOB 3782 — EINE FRIST, EINE MECHANIK.
// ================================================================================================
//
// Bis hierher stand die Fristmechanik EINMAL im Haus, im Rumpf von `postWithTimeout`. Dieser
// Auftrag braucht sie ein zweites Mal, für den LADEweg — und ein abgeschriebener zweiter Rumpf wäre
// genau die Bauform, in der zwei Wege auseinanderlaufen (der eine räumt seinen Wecker ab, der
// andere vergisst es; der eine meldet ehrlich 408, der andere reicht einen `AbortError` durch, den
// niemand deuten kann). Der gemeinsame Anteil ist grösser als der unterschiedliche: er ist ALLES
// ausser dem `init`. Also steht er hier EINMAL, und `postWithTimeout` unten ist nur noch sein
// Aufrufer — die alte Kopie ist WEG, nicht danebengestellt.
//
// WP-RETEST7 R8 (Pedis Spinner-Befund) und WP-SAMMEL21-FIX (bens Fix 2) gelten unverändert und
// stehen jetzt an dieser einen Stelle:
//   · `AbortController` + `setTimeout` spannen die Frist auf, `clearTimeout` im `finally` räumt sie
//     ab — auch im Erfolgsfall, sonst schlüge sie einem längst fertigen Vorgang nach.
//   · Im Abbruchfall steht eine EHRLICHE Meldung: der Server kann noch arbeiten, abgebrochen hat
//     der CLIENT. Es wird nicht behauptet, der Server sei ausgefallen.
function mitFrist<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return apiFetch<T>(path, { ...init, signal: controller.signal })
    .catch((err) => {
      if (controller.signal.aborted) {
        throw new ApiError(
          408,
          "TIMEOUT",
          "Der Server arbeitet noch oder ist nicht erreichbar — der Vorgang wurde clientseitig abgebrochen.",
        );
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

export const api = {
  get: <T>(path: string): Promise<T> => apiFetch<T>(path),
  // JOB 3782: derselbe Abruf wie `get`, nur mit Frist. Er steht NEBEN `get` und ersetzt ihn nicht:
  // eine Frist für JEDEN Lesezugriff wäre eine Entscheidung über Wege, die dieser Auftrag nicht
  // gemessen hat. Wer ihn nimmt, muss die Zahl begründen können — s. `DRAFT_LOAD_TIMEOUT_MS`.
  getWithTimeout: <T>(path: string, timeoutMs: number): Promise<T> =>
    mitFrist<T>(path, {}, timeoutMs),
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
  // WP-RETEST7 R8 (Pedis Spinner-Befund): POST mit hartem Client-Timeout (AbortController).
  // Läuft die Frist ab, wird die Anfrage abgebrochen und als EHRLICHER ApiError(408, "TIMEOUT")
  // gemeldet — kein endlos laufender Spinner mehr, egal was Netz/Server tun.
  // JOB 3782: der Rumpf steht jetzt in `mitFrist` (oben) — Zug um Zug derselbe, nur nicht mehr
  // zweimal getippt.
  postWithTimeout: <T>(path: string, body: unknown, timeoutMs: number): Promise<T> =>
    mitFrist<T>(path, { method: "POST", body: JSON.stringify(body) }, timeoutMs),
};
