// @vitest-environment jsdom
// ================================================================================================
// R-0604 (Ben Nacharbeit 4) — DIE KLARA-HILFE BEHAUPTET „KI-GENERIERT" NUR, WENN EIN MODELL SCHRIEB.
// ================================================================================================
//
// DER BEFUND: Das Klara-Panel zeigte „KI-Antwort aus der Hilfe" und „KI-generiert — nicht zu 100 %
// geprüft" auch beim regelbasierten Rückfall (`demo: true`) — daneben stand seit Nacharbeit 2 die
// Stufe „Empfehlung" für genau diese modellfreie Antwort. Zwei Aussagen, die sich widersprechen.
//
// WAS HIER ECHT IST — Bauform aus tests/app/f0304-klara-assistenzflaeche.test.tsx: die echte
// Komponente, der echte Clientabruf, die echte App mit echter Route und echtem Reasoner; ein
// lokales Modell, dessen Kante In-Process beantwortet wird. Zwei Zellen:
//   MODELL     die Generierung liefert einen Text → der Reasoner meldet `demo: false`
//   RÜCKFALL   die Generierung liefert nichts Verwertbares → deterministischer Rückfall, `demo: true`
// Die `demo`-Angabe wird am Draht GELESEN, nicht angenommen — sonst prüfte die Zelle die falsche Lage.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-in-process.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-r0604-in-process";
process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "1000";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { authApi } from "../../apps/web/src/api/auth";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FRAGE = "Wie funktioniert die Validierung von Wissen?";
const MODELLTEXT = "Die Validierung prüft ein Wissensobjekt durch Fachleute, bevor es gilt.";

let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;
/** Liefert die Generierungskante einen verwertbaren Modelltext? */
let modellAntwortet = false;
const erklaerAbrufe: string[] = [];

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      // Die In-Process-Modellgrenze (Heuristik der Vorrichtung wie in f0304: langer Rumpf =
      // Generierung, sonst Erreichbarkeits-Ping).
      const rumpf = init?.body === undefined || init.body === null ? "" : String(init.body);
      const istGenerierung = rumpf.includes("snippet") || rumpf.length > 400;
      const inhalt = istGenerierung ? (modellAntwortet ? MODELLTEXT : null) : "bereit";
      const nutzlast = inhalt === null ? {} : { choices: [{ message: { content: inhalt } }] };
      return {
        status: 200,
        statusText: "200",
        ok: true,
        text: async () => JSON.stringify(nutzlast),
        json: async () => nutzlast,
      };
    }
    if (!drahtApp) {
      throw new Error(`Draht ohne App: ${url}`);
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await drahtApp.inject({
      method: (init?.method ?? "GET") as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    const gesetzt = antwort.headers["set-cookie"];
    const roh = Array.isArray(gesetzt) ? gesetzt[0] : gesetzt;
    if (typeof roh === "string") {
      cookie = roh.split(";")[0] ?? cookie;
    }
    if (url.startsWith("/api/help/explain")) {
      erklaerAbrufe.push(antwort.body);
    }
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const panel = (): HTMLElement | null =>
  container.querySelector<HTMLElement>("section[data-klara='1']");

async function aufbauenUndFragen(): Promise<{ demo: unknown; karte: HTMLElement }> {
  const app = buildApp(buildServices());
  await app.ready();
  drahtApp = app;
  await authApi.register("Pedi", "pedi@r0604.test", "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@r0604.test", password: "geheim12345" },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(KlaraAssistant)),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>("button[data-klara='1']")?.click();
    await durchlaufen();
  });
  const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
  expect(feld, "Suchfeld im Klara-Panel nicht gefunden").not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, FRAGE);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
  const knopf = [
    ...container.querySelectorAll<HTMLButtonElement>("section[data-klara='1'] button"),
  ].find((b) => (b.textContent ?? "").includes(i18n.t("klara.aiSearch")));
  expect(knopf?.disabled, "der KI-Knopf ist ausgegraut — die Frage wurde nie gestellt").toBe(false);
  await act(async () => {
    knopf?.click();
    await durchlaufen();
  });
  await act(durchlaufen);
  expect(erklaerAbrufe.length, "kein Abruf von /api/help/explain").toBeGreaterThan(0);
  const geliefert = JSON.parse(erklaerAbrufe.at(-1) ?? "{}") as { demo?: unknown };
  const herkunft = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-herkunft]");
  const karte = herkunft?.parentElement?.parentElement;
  expect(karte, "keine Antwortkarte im Klara-Panel").toBeTruthy();
  return { demo: geliefert.demo, karte: karte as HTMLElement };
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  drahtApp = null;
  cookie = null;
  erklaerAbrufe.length = 0;
  modellAntwortet = false;
});

describe("R-0604 · die Klara-Hilfe sagt nur dann „KI-generiert“, wenn ein Modell schrieb", () => {
  it("MODELL (`demo: false`): KI-Antwort, „KI-generiert“, Stufe Entwurf", async () => {
    modellAntwortet = true;
    const { demo, karte } = await aufbauenUndFragen();
    expect(demo, "die Zelle prüft nicht den Modellweg").toBe(false);
    const text = karte.textContent ?? "";
    expect(text).toContain(MODELLTEXT);
    expect(text).toContain(i18n.t("klara.aiAnswerTitle"));
    expect(karte.querySelector("[data-testid=klara-ai-disclaimer]")).not.toBeNull();
    expect(karte.querySelector("[data-testid=klara-ohne-modell]")).toBeNull();
    expect(karte.querySelector("[data-testid=ergebnis-stufe]")?.getAttribute("data-stufe")).toBe(
      "entwurf",
    );
  });

  it("RÜCKFALL (`demo: true`): keine Erzeugungsbehauptung — Herkunft regelbasiert, Stufe Empfehlung", async () => {
    modellAntwortet = false;
    const { demo, karte } = await aufbauenUndFragen();
    expect(demo, "die Zelle prüft nicht den Rückfall").toBe(true);
    const text = karte.textContent ?? "";
    expect(karte.querySelector("[data-testid=klara-ai-disclaimer]")).toBeNull();
    expect(text, "„KI-generiert“ beim regelbasierten Rückfall").not.toContain(
      i18n.t("klara.aiDisclaimer"),
    );
    expect(text, "„KI-Antwort“ beim regelbasierten Rückfall").not.toContain(
      i18n.t("klara.aiAnswerTitle"),
    );
    expect(karte.querySelector("[data-testid=klara-ohne-modell]")?.textContent).toBe(
      i18n.t("klara.ohneModell"),
    );
    expect(karte.querySelector("[data-testid=klara-ai-herkunft]")?.textContent).toBe(
      i18n.t("klara.helpAnswerTitle"),
    );
    expect(karte.querySelector("[data-testid=ergebnis-stufe]")?.getAttribute("data-stufe")).toBe(
      "empfehlung",
    );
  });
});
