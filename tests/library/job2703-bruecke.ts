// ================================================================================================
// JOB 2703 · D2 — DIE TRANSPORTBRUECKE: der echte Client-Code (`apps/web/src/api/client.ts`,
// `fetch` gegen `/api/...`) spricht mit der ECHTEN App (`buildApp(buildServices())`) ueber
// `app.inject`. Kein Fake einer Antwort, kein zweiter Wiretyp — was der Browser bekaeme, bekommt
// hier der Test. Gemeinsam fuer den Datenweg-Test, den Ask-Trefferlisten-Test und die Aufnahme
// der Panel-Antwort.
// ================================================================================================
import { buildApp, buildServices } from "../../services/app/src/build-app";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

export type App = ReturnType<typeof buildApp>;
export type Dienste = ReturnType<typeof buildServices>;

export interface Bruecke {
  a: App;
  dienste: Dienste;
  /** Kopfzeilen fuer direkte `inject`-Aufrufe im Test (Cookie UND Bearer — beide gelten). */
  kopf: Record<string, string>;
  /** Jeder Aufruf, der ueber `fetch` kam — Beleg, dass der Client wirklich ueber die Bruecke ging. */
  aufrufe: Array<{ method: string; url: string }>;
  /** `globalThis.fetch` zurueckstellen. */
  abbauen(): void;
}

export interface BrueckeOptionen {
  /**
   * NUR fuer die Fragen-Seite: `apps/web/src/lib/aiAvailability.ts` sperrt den Absende-Knopf,
   * solange `/api/reasoner/status` die Aufgabe `answer` als deterministisch meldet — die Testapp
   * hat kein Modell. Mit `true` beantwortet die Bruecke GENAU diese eine Statusabfrage mit
   * „Modell nutzbar" (active, reachable unverified, tasks.answer true); `/api/ask` selbst und alles
   * andere gehen unveraendert an die echte App. Der einzige Ersatz, und er steht hier benannt.
   */
  knopfFreigeben?: boolean;
}

export async function bruecke(optionen: BrueckeOptionen = {}): Promise<Bruecke> {
  const dienste = buildServices();
  const a = buildApp(dienste);
  await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job2703.test", password: "geheim12345" },
  });
  const login = await a.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@job2703.test", password: "geheim12345" },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const kopf: Record<string, string> = { authorization: `Bearer ${token}` };
  if (cookie) {
    kopf.cookie = cookie;
  }
  const aufrufe: Array<{ method: string; url: string }> = [];
  const vorher = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const method = (init?.method ?? "GET").toUpperCase();
    aufrufe.push({ method, url });
    if (optionen.knopfFreigeben && method === "GET" && url === "/api/reasoner/status") {
      const status = {
        active: true,
        mode: "local",
        reachable: "unverified",
        tasks: { answer: true },
        billable: {},
      };
      return {
        ok: true,
        status: 200,
        statusText: "200",
        headers: { get: () => null },
        text: async () => JSON.stringify(status),
        json: async () => status,
      };
    }
    const headers: Record<string, string> = { ...kopf };
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    const res = await a.inject({
      method: method as "GET" | "POST" | "PUT" | "DELETE",
      url,
      headers,
      ...(init?.body !== undefined ? { payload: String(init.body) } : {}),
    });
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      statusText: String(res.statusCode),
      headers: { get: (n: string) => (res.headers[n.toLowerCase()] as string | undefined) ?? null },
      text: async () => res.body,
      json: async () => res.json(),
    };
  }) as unknown as typeof globalThis.fetch;
  return {
    a,
    dienste,
    kopf,
    aufrufe,
    abbauen() {
      globalThis.fetch = vorher;
    },
  };
}
