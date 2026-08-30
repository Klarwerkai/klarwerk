// @vitest-environment jsdom
// ================================================================================================
// JOB 2693 D2 — DIE MELDUNG MUSS BIS ZUR SEITE KOMMEN (Befund R2-9, Korrekturdurchgang)
// ================================================================================================
//
// BENs Auflage: „der produktive Clientabruf zwischen der echten 401-Antwort und SsoCallback ist
// nicht geprueft." Hier ist EINE Kette statt zweier Haelften: die echte Auth-Route (authRoutes mit
// einem OIDC-Provider, dessen Token-Tausch haengt und nach der Zeitgrenze abbricht), der echte
// API-Client (`authApi.oidc` → `api.post` → `fetch`), die echte Seite `SsoCallback`. Gemockt ist
// NUR `globalThis.fetch` — es reicht jede Anfrage an `app.inject` weiter und traegt die Flow-
// Cookies mit, die der echte /oidc/start gesetzt hat. KEIN von Hand injizierter ApiError.
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type OidcConfig, createOidcProvider } from "../../services/auth/src/oidc";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { SsoCallback } from "../../apps/web/src/auth/SsoCallback";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function config(): OidcConfig {
  return {
    issuer: "https://idp.example.com",
    audience: "klarwerk-client",
    jwksUri: "https://idp.example.com/jwks",
    authorizeUrl: "https://idp.example.com/authorize",
    tokenUrl: "https://idp.example.com/token",
    clientId: "klarwerk-client",
    redirectUri: "https://app.klarwerk.ai/sso/callback",
    roles: { roleClaim: "roles", adminGroup: "kw-admin" },
  };
}

/** Ein fetch zum Identitaetsanbieter, das nie aufloest — es reagiert NUR auf das Abbruchsignal. */
const haengendesFetch = (_url: string, init: { signal?: AbortSignal }) =>
  new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((_, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });

/** Die echte Auth-App mit dem haengenden Provider; die Zeitgrenze ist klein, damit der Test kurz ist. */
async function server(tokenMs: number) {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  const provider = createOidcProvider(config(), {
    fetchImpl: haengendesFetch,
    zeitgrenzen: { tokenMs },
  });
  const app = Fastify();
  app.register(authRoutes(service, { oidc: provider }));
  // Die Flow-Cookies kommen vom ECHTEN Start — so, wie der Browser sie vom Server bekaeme.
  const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start" });
  const gesetzt = start.headers["set-cookie"];
  const liste = Array.isArray(gesetzt) ? gesetzt : gesetzt ? [gesetzt] : [];
  const paare = liste.map((c) => c.split(";")[0] ?? "");
  const cookie = paare.join("; ");
  const state = paare.find((p) => p.toLowerCase().includes("state"))?.split("=")[1] ?? "";
  const anfragen: Array<{ method: string; url: string; body: string | undefined }> = [];
  const fetchShim = async (url: string | URL | Request, init?: RequestInit) => {
    const pfad = String(url);
    anfragen.push({
      method: init?.method ?? "GET",
      url: pfad,
      body: init?.body as string | undefined,
    });
    const res = await app.inject({
      method: (init?.method ?? "GET") as "GET" | "POST",
      url: pfad,
      headers: { cookie, "content-type": "application/json" },
      ...(init?.body ? { payload: String(init.body) } : {}),
    });
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    } as unknown as Response;
  };
  return { app, state, anfragen, fetchShim, startStatus: start.statusCode };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let fetchVorher: typeof fetch;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  fetchVorher = globalThis.fetch;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  globalThis.fetch = fetchVorher;
  act(() => {
    root.unmount();
  });
  container.remove();
});

async function warte(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe("JOB 2693 D2 · vom echten Serverfehler ueber den echten Clientabruf bis zur Seite", () => {
  it("K1 · der Mensch liest „Anmeldedienst antwortet nicht.“ — die Meldung kommt aus der 401-Antwort, nicht aus dem Test", async () => {
    const s = await server(200);
    expect(s.startStatus).toBe(302);
    expect(s.state).not.toBe("");
    globalThis.fetch = s.fetchShim as typeof fetch;
    // Der Rueckruf des Identitaetsanbieters: ?code=&state= in der URL, wie im Browser.
    window.history.replaceState({}, "", `/sso/callback?code=code-vom-idp&state=${s.state}`);

    const t0 = Date.now();
    await act(async () => {
      root.render(createElement(SsoCallback));
    });
    // Waehrend der Token-Tausch haengt: die Seite sagt „Anmeldung laeuft", kein Fehler.
    await warte(50);
    expect(container.textContent).toContain(i18n.t("auth.ssoBusy"));
    expect(container.textContent).not.toContain("Anmeldedienst antwortet nicht.");

    // Nach der Zeitgrenze: die echte 401-Antwort ist durch den echten Client bis zur Seite gereist.
    for (let i = 0; i < 40 && !(container.textContent ?? "").includes("Anmeldedienst"); i++) {
      await warte(50);
    }
    const dauer = Date.now() - t0;
    const text = container.textContent ?? "";
    expect(text).toContain("Anmeldedienst antwortet nicht.");
    expect(text).not.toContain("SSO-Status");
    expect(text).not.toContain(i18n.t("state.error"));
    expect(container.querySelector("button")?.textContent).toBe(i18n.t("auth.toSignIn"));
    expect(dauer).toBeGreaterThanOrEqual(150);
    expect(dauer).toBeLessThan(5_000);

    // Der Clientabruf war der produktive: POST /api/auth/oidc mit code und state aus der URL.
    expect(s.anfragen).toHaveLength(1);
    expect(s.anfragen[0]?.method).toBe("POST");
    expect(s.anfragen[0]?.url).toBe("/api/auth/oidc");
    expect(JSON.parse(s.anfragen[0]?.body ?? "{}")).toEqual({
      code: "code-vom-idp",
      state: s.state,
    });
  }, 15_000);

  it("K2 · Gegenprobe ueber dieselbe Kette: passt der state nicht zu den Cookies, liest der Mensch „SSO-Status ungültig.“ — ein anderer Fehler", async () => {
    const s = await server(200);
    globalThis.fetch = s.fetchShim as typeof fetch;
    window.history.replaceState({}, "", "/sso/callback?code=code-vom-idp&state=falscher-state");
    await act(async () => {
      root.render(createElement(SsoCallback));
    });
    for (let i = 0; i < 40 && !(container.textContent ?? "").includes("SSO-Status"); i++) {
      await warte(50);
    }
    expect(container.textContent).toContain("SSO-Status ungültig.");
    expect(container.textContent).not.toContain("Anmeldedienst antwortet nicht.");
  }, 15_000);
});
