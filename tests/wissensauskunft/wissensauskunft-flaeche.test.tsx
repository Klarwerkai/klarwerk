// @vitest-environment jsdom
// ================================================================================================
// WISSENSAUSKUNFT ZUM ZEITPUNKT · DIE FLÄCHE, GEGEN DIE ECHTE ANWENDUNG (R-1644).
// ================================================================================================
//
// Die Fläche (`WissensauskunftBereich`) wird in jsdom montiert; ihr `fetch` geht über `app.inject`
// an die echte App (In-Memory-Ablage, gestellte Uhr nur für `Date`). Jeder Aufruf wird
// mitgeschrieben — damit ist messbar, dass Anzeigen nichts abfragt und Abfragen nichts schreibt.
//
//   W1  Anzeigen fragt nichts ab; erst der Klick holt die Auskunft (ein GET, kein Schreibaufruf).
//   W2  Die Antwort ist lesbar: damalige Fassung samt Verfasser, Titel und Aussage, die Personen
//       mit ihren Belegen in Worten, die heutige Fassung und die Grenzen der Auskunft.
//   W3  Ein Zeitpunkt in der Zukunft wird verständlich abgewiesen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { WissensauskunftBereich } from "../../apps/web/src/components/wissensauskunft/WissensauskunftBereich";
import i18n from "../../apps/web/src/i18n";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type App = ReturnType<typeof buildApp>;

const MINUTE = 60_000;
const T0 = Date.parse("2026-03-02T08:00:00.000Z");

let services: AppServices;
let app: App;
let adminToken = "";
let adminId = "";
let flaechenToken = "";
let koId = "";
/** Jeder Aufruf der Fläche: Methode und Pfad. */
let aufrufe: Array<{ methode: string; url: string }> = [];

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    aufrufe.push({ methode, url });
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${flaechenToken}`;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function montieren(): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wurzel = root;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(WissensauskunftBereich, { koId }),
      ),
    );
  });
  await act(flush);
  return container;
}

async function abbauen(): Promise<void> {
  if (root) {
    const wurzel = root;
    await act(async () => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
}

/** Ein Zeitpunkt so, wie ein Mensch ihn ins Feld tippt: Ortszeit, minutengenau. */
function getippt(zeit: Date): string {
  const zwei = (n: number): string => String(n).padStart(2, "0");
  const tag = `${zeit.getFullYear()}-${zwei(zeit.getMonth() + 1)}-${zwei(zeit.getDate())}`;
  return `${tag}T${zwei(zeit.getHours())}:${zwei(zeit.getMinutes())}`;
}

const element = <T extends Element>(wo: HTMLElement, testId: string): T | null =>
  wo.querySelector<T>(`[data-testid="${testId}"]`);

/** Setzt das Zeitfeld wie eine Eingabe und klickt „Auskunft abrufen". */
async function abfragen(flaeche: HTMLElement, zeit: Date): Promise<void> {
  const feld = element<HTMLInputElement>(flaeche, "wissensauskunft-zeitpunkt");
  expect(feld).not.toBeNull();
  const setzen = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzen?.call(feld, getippt(zeit));
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const knopf = element<HTMLButtonElement>(flaeche, "wissensauskunft-abfragen");
  await act(async () => {
    knopf?.click();
  });
  await act(flush);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0 - 60 * MINUTE);
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "Ada Admin",
      email: "ada@wissensauskunft-flaeche.test",
      password: "secret123",
    },
  });
  adminToken = await anmelden("ada@wissensauskunft-flaeche.test");
  adminId = (await services.auth.listUsers())[0]?.id ?? "";
  const clara = await konto("controller", "clara@wissensauskunft-flaeche.test", "Clara Controller");
  const erik = await konto("experte", "erik@wissensauskunft-flaeche.test", "Erik Experte");

  vi.setSystemTime(T0);
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Absperrschieber vor Wartung schließen",
      statement: "Vor jeder Wartung den Absperrschieber schließen und sichern.",
      type: "best_practice",
      category: "Anlage Beispiel",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  koId = (angelegt.json() as { id: string }).id;

  vi.setSystemTime(T0 + 20 * MINUTE);
  await services.ko.revise(koId, { statement: "Fassung 2: zusätzlich Schild anbringen." }, erik.id);

  vi.setSystemTime(T0 + 60 * MINUTE);
  flaechenToken = clara.token;
  aufrufe = [];
  transportEinhaengen();
});

afterEach(async () => {
  await abbauen();
  vi.useRealTimers();
});

describe("W1/W2 · erst der Klick fragt ab; die Antwort ist lesbar und nennt ihre Grenzen", () => {
  it("zeigt Fassung V1 von Ada zum Zeitpunkt vor Eriks Überarbeitung", async () => {
    const flaeche = await montieren();
    expect(aufrufe.filter((a) => a.url.includes("/wissensauskunft"))).toEqual([]);
    expect(flaeche.textContent).toContain("Auskunft abrufen");
    expect(flaeche.querySelector('[data-testid="wissensauskunft-antwort"]')).toBeNull();

    await abfragen(flaeche, new Date(T0 + 10 * MINUTE));
    const abfragenAufrufe = aufrufe.filter((a) => a.url.includes("/wissensauskunft"));
    expect(abfragenAufrufe).toHaveLength(1);
    expect(abfragenAufrufe[0]?.methode).toBe("GET");
    expect(aufrufe.every((a) => a.methode === "GET")).toBe(true);

    const antwort = flaeche.querySelector('[data-testid="wissensauskunft-antwort"]');
    expect(antwort).not.toBeNull();
    const text = antwort?.textContent ?? "";
    expect(text).toContain("Damals galt Fassung V1");
    expect(text).toContain("von Ada Admin");
    expect(text).toContain("Absperrschieber vor Wartung schließen");
    expect(text).toContain("Vor jeder Wartung den Absperrschieber schließen und sichern.");
    expect(text).toContain("Für diese Fassung ist bis dahin keine Freigabe belegt.");
    expect(text).toContain("Heute gilt Fassung V2.");
    const personen = [
      ...flaeche.querySelectorAll<HTMLElement>('[data-testid="wissensauskunft-person"]'),
    ];
    expect(personen.map((p) => p.dataset.person)).toEqual([adminId]);
    expect(personen[0]?.textContent).toContain("angelegt · V1");
    // Erik hat erst danach überarbeitet — er steht nicht drin.
    expect(text).not.toContain("Erik Experte");
    const grenzen = flaeche.querySelector('[data-testid="wissensauskunft-grenzen"]');
    expect(grenzen?.textContent).toContain("Bloßes Öffnen oder Lesen wird nicht protokolliert.");
    expect(grenzen?.textContent).toContain("Der Prüfstatus wird nicht je Zeitpunkt gespeichert");
  });

  it("nach Eriks Überarbeitung: Fassung V2 von Erik, Erik mit „überarbeitet · V2“", async () => {
    const flaeche = await montieren();
    await abfragen(flaeche, new Date(T0 + 30 * MINUTE));
    const text =
      flaeche.querySelector('[data-testid="wissensauskunft-antwort"]')?.textContent ?? "";
    expect(text).toContain("Damals galt Fassung V2");
    expect(text).toContain("von Erik Experte");
    expect(text).not.toContain("Heute gilt Fassung");
    expect(text).toContain("überarbeitet · V2");
  });
});

describe("W3 · ein Zeitpunkt in der Zukunft wird verständlich abgewiesen", () => {
  it("zeigt den Grund statt einer Antwort", async () => {
    const flaeche = await montieren();
    await abfragen(flaeche, new Date(T0 + 24 * 60 * MINUTE));
    const meldung = flaeche.querySelector('[role="alert"]');
    expect(meldung?.textContent).toBe("Der Zeitpunkt darf nicht in der Zukunft liegen.");
    expect(flaeche.querySelector('[data-testid="wissensauskunft-antwort"]')).toBeNull();
  });
});
