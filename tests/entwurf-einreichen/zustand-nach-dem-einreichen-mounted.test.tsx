// @vitest-environment jsdom
// ==================================================================================================
// AUFNAHME gesamt-entwurf-einreichen · R-0102 / R-0111 / R-1014 / R-0036 — WAS NACH DEM EINREICHEN GILT.
// ==================================================================================================
//
// DER REST (R-0102): „Nach dem Anlegen sieht der Nutzer, in welchem Zustand sein Wissensobjekt ist
// … statt raten zu müssen." R-0111 verlangt dazu ein Statusabzeichen neben Titel und Links, R-1014
// „was jetzt gilt". Am Basisstand `c04ec239` sagte die Erfolgszeile des Blattes nur „Eingereicht:
// <Titel>" — der Zustand des neuen Objekts stand nirgends auf der Fläche.
//
// DIE GRENZE, die hier gilt und gepinnt wird: die Zeile bleibt EINE Zeile (JOB 3062, Zustandsmodell
// §9; Pedi 04.09.: kein Erklärtext im Sichtfeld). Es kommt das vorhandene Abzeichen `StatusPill`
// dazu — kein neuer Satz, kein neuer Schlüssel.
//
// ZUSÄTZLICH AM ECHTEN WEG (R-0036 / FR-STR-06): ein gesicherter Entwurf, der eingereicht wird, ist
// danach aus dem Entwurfs-Pool verschwunden — gemessen am echten Server, nicht am Zustand der Seite.
//
// DIE BRÜCKE ist dieselbe wie in `tests/capture/frontdoor-bedeutung-mounted.test.tsx`: echte
// Oberfläche, echter Client, echte Fastify-Anwendung über `fetch → app.inject`. Eigene Kopie, damit
// dieser Beleg an keiner fremden Datei hängt.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Nur die Modellläufe und die Verfügbarkeitsanzeige werden ersetzt. Der Einreichweg selbst bleibt
// das ECHTE Modul und läuft in den echten Server.
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
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

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

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Der Bestand am SERVER — nicht, was die Seite glaubt. */
async function serverListe(pfad: "/api/drafts" | "/api/kos"): Promise<{ title?: string }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: pfad,
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body) as { title?: string }[];
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
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
                    { initialEntries: ["/capture/frontdoor"] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/capture/frontdoor",
                        element: createElement(CaptureFrontDoor),
                      }),
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement("div", null),
                      }),
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
  act(() => root.unmount());
  container.remove();
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function testId(id: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${id}"]`);
  return el instanceof HTMLElement ? el : null;
}

function buttonByText(part: string, innerhalb: ParentNode = container): HTMLButtonElement {
  const btn = [...innerhalb.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf nicht gefunden: ${part}. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

async function schreiben(html: string): Promise<void> {
  await act(async () => {
    const el = container.querySelector('[role="textbox"]');
    if (!(el instanceof HTMLElement)) {
      throw new Error("Body-Editor nicht gefunden");
    }
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Ein frisches Blatt hat noch keine Stufe — ohne sie sperrt das Einreichen (JOB 3082). */
async function vertraulichkeitWaehlen(): Promise<void> {
  const werkzeug = testId("blatt-werkzeug-vertraulichkeit");
  if (!werkzeug) {
    throw new Error("Das Menü Vertraulichkeit ist nicht auf dem Blatt.");
  }
  await klick(werkzeug);
  const flaeche = testId("blatt-menue-vertraulichkeit");
  if (!flaeche) {
    throw new Error("Das Menü Vertraulichkeit hat sich nicht geöffnet.");
  }
  await klick(buttonByText(i18n.t("conf.level.intern"), flaeche));
}

const TEXT = "<p>Vor dem Anfahren der Linie L4 den Druck am Ventil V2 pruefen.</p>";

beforeEach(async () => {
  brueckeAufbauen();
  await serverStarten();
});

afterEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe.each([
  ["de", "Offen"],
  ["en", "Open"],
] as const)(
  "Sprache %s — die Erfolgszeile nennt den Zustand des neuen Objekts",
  (sprache, wort) => {
    beforeEach(async () => {
      await i18n.changeLanguage(sprache);
    });

    it("frisch eingereicht: Titel-Link, Abzeichen „offen“, Validierung und Neuer Eintrag — in EINER Zeile", async () => {
      await mount();
      await schreiben(TEXT);
      await vertraulichkeitWaehlen();
      await klick(buttonByText(i18n.t("erfassen.einreichen")));

      const lage = testId("blatt-lage");
      expect(lage, `keine Erfolgszeile. Sichtbar: ${pageText().slice(0, 600)}`).not.toBeNull();
      const zeile = (lage?.textContent ?? "").replace(/\s+/g, " ");
      expect(zeile).toContain(i18n.t("erfassen.eingereicht"));

      // DER ZUSTAND — aus der Serverantwort, nicht angenommen: das Objekt steht am Server „offen".
      const zustand = testId("blatt-lage-zustand");
      expect(zustand, "kein Statusabzeichen an der Erfolgszeile").not.toBeNull();
      expect(zustand?.getAttribute("data-zustand")).toBe("offen");
      expect((zustand?.textContent ?? "").trim()).toBe(wort);
      expect(lage?.contains(zustand as Node)).toBe(true);
      const amServer = await serverListe("/api/kos");
      expect(amServer).toHaveLength(1);

      // DIE DREI WEGE bleiben (R-0111): Objekt (Titel-Link), Validierung, Neuer Eintrag.
      const objektLink = lage?.querySelector('a[href^="/wissen/"]');
      expect((objektLink?.textContent ?? "").trim()).toBe(amServer[0]?.title);
      expect(zeile).toContain(i18n.t("fd.openValidation"));
      expect(zeile).toContain(i18n.t("fd.newEntry"));

      // DIE GRENZE (§9): kein Erklärabsatz im Sichtfeld — der Bedeutungssatz bleibt im Menü „Status".
      expect(pageText()).not.toContain(i18n.t("capture.savedBody"));
      unmount();
    });

    it("erst gesichert, dann eingereicht: der Entwurf ist am Server fort, genau ein Objekt „offen“", async () => {
      await mount();
      await schreiben(TEXT);
      await vertraulichkeitWaehlen();

      await klick(testId("blatt-entwurf-sichern") as HTMLElement);
      expect(
        testId("blatt-entwurf-gespeichert"),
        `keine Speicherbestätigung. Sichtbar: ${pageText().slice(0, 600)}`,
      ).not.toBeNull();
      expect(await serverListe("/api/drafts")).toHaveLength(1);

      await klick(buttonByText(i18n.t("erfassen.einreichen")));

      expect(testId("blatt-lage-zustand")?.getAttribute("data-zustand")).toBe("offen");
      expect((testId("blatt-lage-zustand")?.textContent ?? "").trim()).toBe(wort);
      // R-0036 / FR-STR-06: kein Geister-Entwurf, keine Dublette.
      expect(await serverListe("/api/drafts")).toEqual([]);
      expect(await serverListe("/api/kos")).toHaveLength(1);
      // Die Speicherbestätigung spricht nicht mehr über einen Entwurf, den es nicht mehr gibt.
      expect(testId("blatt-entwurf-gespeichert")).toBeNull();
      unmount();
    });
  },
);
