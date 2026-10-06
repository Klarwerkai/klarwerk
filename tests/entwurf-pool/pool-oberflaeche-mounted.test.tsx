// @vitest-environment jsdom
// ==================================================================================================
// AUFNAHME entwurf-in-gemeinsamen-pool-geben (R-2099, SOLL:FR-CAP-06, Pedi `297afc57`) — DIE
// OBERFLÄCHE: die bewusste Handlung, die Autorangabe und was ein anderer Schreibberechtigter NICHT
// sieht. DE und EN, die Handlung NUR mit der Tastatur.
// ==================================================================================================
//
// DIE BRÜCKE ist dieselbe wie in `tests/entwurf-einreichen/zustand-nach-dem-einreichen-mounted.test.tsx`:
// echte Seiten (`MeineEntwuerfe`, `CaptureFrontDoor` → `Blatt`), echter Client, echte
// Fastify-Anwendung über `fetch → app.inject`. Was die Fläche zeigt, wird deshalb AM SERVER
// gegengeprüft — „im Pool" heisst hier: der Server sagt `imPool: true`, nicht die Seite.
//
// TASTATUR wie in `tests/entwuerfe-verwalten/abnahmefolge-gesamt.test.tsx`: der Knopf muss im
// Tabulatorlauf des ganzen Dokuments liegen (`tabBis`), ausgelöst wird mit `keydown Enter` und dem
// einen `click`, den der Browser daraus macht — ohne Zeigerereignisse. GRENZE (dieselbe wie dort):
// jsdom kennt keine echte Tabulatornavigation; geprüft ist, dass das Ziel im Lauf LIEGT und Enter es
// auslöst, nicht die echte Fokusführung im Browser.
//
// UNABHÄNGIGE BEDEUTUNGSMERKMALE (Lehre JOB 3007): die Beschriftung steht hier wörtlich und wird
// nicht nur gegen denselben i18n-Wert verglichen, den die Fläche liest.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Nur die Modellläufe und die Verfügbarkeitsanzeige werden ersetzt (wie im Vorbild). Entwurfs-,
// Pool-, Verzeichnis- und Anmeldewege sind die ECHTEN Module und laufen in den echten Server.
vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => ({
          active: false,
          mode: "off",
          reachable: "unknown",
          tasks: { structure: false, extract: false },
        })),
        config: vi.fn(async () => null),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { MeineEntwuerfe } from "../../apps/web/src/pages/MeineEntwuerfe";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: init.method ?? "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

const konten = { anna: "", otto: "" };
const ids = { annaPool: "", annaPrivat: "", ottoEigen: "" };

async function server(
  methode: string,
  url: string,
  token: string,
  payload?: unknown,
): Promise<{ status: number; json: () => Record<string, unknown> }> {
  const res = await bruecke.app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload !== undefined ? { payload } : {}),
  });
  return { status: res.statusCode, json: () => JSON.parse(res.body) as Record<string, unknown> };
}

async function anmelden(email: string): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return (JSON.parse(res.body) as { token: string }).token;
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: "ada@x.de", password: "secret123" },
  });
  const ada = await anmelden("ada@x.de");
  for (const [name, email] of [
    ["Anna", "anna@x.de"],
    ["Otto", "otto@x.de"],
  ] as const) {
    const res = await server("POST", "/api/users", ada, {
      name,
      email,
      password: "secret123",
      role: "experte",
    });
    expect(res.status).toBeLessThan(300);
  }
  konten.anna = await anmelden("anna@x.de");
  konten.otto = await anmelden("otto@x.de");
  const anlegen = async (token: string, title: string): Promise<string> => {
    const res = await server("POST", "/api/drafts", token, {
      title,
      statement: "Zwischenstand an Linie 4.",
      confidentiality: "intern",
    });
    expect(res.status).toBe(201);
    return res.json().id as string;
  };
  ids.annaPool = await anlegen(konten.anna, "Annas Pumpenentwurf");
  ids.annaPrivat = await anlegen(konten.anna, "Annas Notizen privat");
  ids.ottoEigen = await anlegen(konten.otto, "Ottos eigener Entwurf");
}

async function mount(pfad: string): Promise<void> {
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
            createElement(
              ToastProvider,
              null,
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: [pfad] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/entwuerfe",
                        element: createElement(MeineEntwuerfe),
                      }),
                      createElement(Route, {
                        path: "/capture/frontdoor",
                        element: createElement(CaptureFrontDoor),
                      }),
                      createElement(Route, { path: "/erfassen", element: createElement("div") }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function unmount(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
    container.remove();
  }
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** Auf ein Element WARTEN (Abrufe laufen nach); nach der Frist ist der Fall rot. */
async function warteAuf(selektor: string, frist = 10_000): Promise<HTMLElement> {
  const ende = Date.now() + frist;
  for (;;) {
    const el = container.querySelector(selektor);
    if (el instanceof HTMLElement) {
      return el;
    }
    if (Date.now() > ende) {
      throw new Error(`„${selektor}“ kam nicht. Sichtbar: ${seitentext().slice(0, 700)}`);
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

/** Der Tabulatorlauf des ganzen Dokuments — dieselbe Auswahl wie in der Abnahmefolge. */
function tabulatorlauf(): HTMLElement[] {
  const auswahl =
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  return [...document.querySelectorAll(auswahl)].filter((e): e is HTMLElement => {
    if (!(e instanceof HTMLElement) || e.tabIndex < 0 || e.hidden) {
      return false;
    }
    if ((e as HTMLElement & { disabled?: boolean }).disabled) {
      return false;
    }
    return e.closest("[inert]") === null;
  });
}

/** Per Tabulator hin, dann Enter — und der eine `click`, den der Browser daraus macht. */
async function tastatur(el: HTMLElement): Promise<void> {
  const lauf = tabulatorlauf();
  const stelle = lauf.indexOf(el);
  expect(stelle, "der Knopf liegt nicht im Tabulatorlauf").toBeGreaterThanOrEqual(0);
  for (let i = 0; i <= stelle; i++) {
    lauf[i]?.focus();
  }
  expect(document.activeElement).toBe(el);
  await act(async () => {
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    if (el.dispatchEvent(enter) && el instanceof HTMLButtonElement) {
      el.click();
    }
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  brueckeAufbauen();
  await serverStarten();
});

afterEach(async () => {
  unmount();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe.each([
  ["de", "In den Pool geben", "Aus dem Pool nehmen", "Im gemeinsamen Pool", "Ersteller: Anna"],
  ["en", "Share to pool", "Remove from pool", "In the shared pool", "Creator: Anna"],
] as const)("Sprache %s", (sprache, geben, nehmen, marke, ersteller) => {
  beforeEach(async () => {
    await i18n.changeLanguage(sprache);
  });

  it("K2 · Anna gibt GENAU EINEN eigenen Entwurf mit der Tastatur in den Pool — der Server bestätigt es", async () => {
    bruecke.token = konten.anna;
    await mount("/entwuerfe");
    const knopf = await warteAuf(`[data-entwurf-pool="${ids.annaPool}"]`);
    // Die klar benannte Aktion: ein echter Knopf mit dem Wort, das sagt, was geschieht.
    expect(knopf.tagName).toBe("BUTTON");
    expect(knopf.getAttribute("type")).toBe("button");
    expect((knopf.textContent ?? "").trim()).toBe(geben);
    expect((knopf.textContent ?? "").trim()).toBe(i18n.t("entwurfspool.aktion.geben"));
    // Die Folge steht am Knopf (Hinweis beim Überfahren und für Hilfstechnik über `title`).
    expect(knopf.getAttribute("title")).toBe(i18n.t("entwurfspool.aktion.gebenFolge"));
    // Vorher: privat — am Server, nicht nur auf der Fläche.
    const amServer = async (id: string): Promise<unknown> =>
      (await server("GET", `/api/drafts/${id}`, konten.anna)).json().imPool;
    expect(await amServer(ids.annaPool)).toBe(undefined);

    await tastatur(knopf);

    expect(await amServer(ids.annaPool)).toBe(true);
    // Nur dieser eine Entwurf: der zweite bleibt privat.
    expect(await amServer(ids.annaPrivat)).toBe(undefined);
    // Die Fläche sagt es an der Zeile, und der Knopf bietet jetzt den Rückweg an.
    const zeilenAnker = `[data-entwurfszeile="${ids.annaPool}"]`;
    await warteAuf(`${zeilenAnker} [data-testid="entwurfsliste-eintrag-pool"]`);
    const zeile = await warteAuf(zeilenAnker);
    expect((zeile.textContent ?? "").replace(/\s+/g, " ")).toContain(marke);
    const zurueck = container.querySelector(`[data-entwurf-pool="${ids.annaPool}"]`);
    expect((zurueck?.textContent ?? "").trim()).toBe(nehmen);
    const privatZeile = container.querySelector(`[data-entwurfszeile="${ids.annaPrivat}"]`);
    expect(privatZeile?.querySelector('[data-testid="entwurfsliste-eintrag-pool"]')).toBeNull();

    // Und zurück — ebenfalls mit der Tastatur.
    await tastatur(zurueck as HTMLElement);
    expect(await amServer(ids.annaPool)).toBe(undefined);
  });

  it("K3/K6 · Otto sieht den Pool-Entwurf mit Autorangabe und „Fortsetzen“ — ohne Löschen und ohne Pool-Knopf; den privaten gar nicht", async () => {
    expect(
      (await server("PUT", `/api/drafts/${ids.annaPool}/pool`, konten.anna, { imPool: true }))
        .status,
    ).toBe(200);
    bruecke.token = konten.otto;
    await mount("/entwuerfe");
    const zeile = await warteAuf(`[data-entwurfszeile="${ids.annaPool}"]`);
    const text = (zeile.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toContain("Annas Pumpenentwurf");
    // Die Autorangabe — aufgelöst über das Verzeichnis, nicht die Kennung (es lädt nach).
    const zeilentext = (): string => (zeile.textContent ?? "").replace(/\s+/g, " ");
    for (let i = 0; i < 50 && !zeilentext().includes(ersteller); i++) {
      await act(flush);
    }
    expect(zeilentext()).toContain(ersteller);
    expect(text).toContain(marke);
    expect(zeile.querySelector(`[data-entwurf-fortsetzen="${ids.annaPool}"]`)).not.toBeNull();
    // 297afc57, Oberflächenhälfte: kein Löschen, kein Teilen/Zurücknehmen an einem fremden Entwurf.
    expect(container.querySelector(`[data-loeschen="${ids.annaPool}"]`)).toBeNull();
    expect(container.querySelector(`[data-entwurf-pool="${ids.annaPool}"]`)).toBeNull();
    // Gegenprobe Leseweg: Annas privater Entwurf erscheint nicht.
    expect(container.querySelector(`[data-entwurfszeile="${ids.annaPrivat}"]`)).toBeNull();
    expect(seitentext()).not.toContain("Annas Notizen privat");
    // Gegenrichtung: an Ottos EIGENEM Entwurf stehen Löschen und der Pool-Knopf.
    expect(container.querySelector(`[data-loeschen="${ids.ottoEigen}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-entwurf-pool="${ids.ottoEigen}"]`)).not.toBeNull();
  });

  it("K3/K6 · im Editor: Otto setzt Annas Pool-Entwurf fort und sichert — „Einreichen“ steht für ihn nicht da, für Anna schon", async () => {
    expect(
      (await server("PUT", `/api/drafts/${ids.annaPool}/pool`, konten.anna, { imPool: true }))
        .status,
    ).toBe(200);
    bruecke.token = konten.otto;
    await mount(`/capture/frontdoor?draft=${encodeURIComponent(ids.annaPool)}`);
    const titel = (await warteAuf('[data-testid="blatt-titel"]')) as HTMLInputElement;
    for (let i = 0; i < 50 && titel.value !== "Annas Pumpenentwurf"; i++) {
      await act(flush);
    }
    expect(titel.value).toBe("Annas Pumpenentwurf");
    expect(container.querySelector('[data-testid="blatt-entwurf-sichern"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="blatt-einreichen"]')).toBeNull();
    unmount();

    // Gegenprobe: dieselbe Fläche für die Autorin trägt den Knopf.
    bruecke.token = konten.anna;
    await mount(`/capture/frontdoor?draft=${encodeURIComponent(ids.annaPool)}`);
    const titelAnna = (await warteAuf('[data-testid="blatt-titel"]')) as HTMLInputElement;
    for (let i = 0; i < 50 && titelAnna.value !== "Annas Pumpenentwurf"; i++) {
      await act(flush);
    }
    expect(titelAnna.value).toBe("Annas Pumpenentwurf");
    expect(container.querySelector('[data-testid="blatt-einreichen"]')).not.toBeNull();
  });
});
