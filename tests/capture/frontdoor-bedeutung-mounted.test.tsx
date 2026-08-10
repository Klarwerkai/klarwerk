// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-196 (DEMO-UX-V1 · U1 A2) — DIE VORDERTÜR SAGT, WAS MIT DEM WISSENSOBJEKT GESCHIEHT.
// ==============================================================================================
//
// DER BEFUND (BASIC 169, gemessen): Nach dem Einreichen sprechen die beiden Erfassungsflächen über
// verschiedene Dinge. Der Assistent sagt „Gespeichert als dein eigenes Wissen …, aber noch nicht
// validiert" (`capture.savedBody`, gerendert in `Capture.tsx:3430`). Die Vordertür sagt nur „Der
// Editor ist abgeschlossen und geleert" (`fd.submittedBody`). Die eine Fläche spricht über das
// WISSEN, die andere über den EDITOR — und die Vordertür ist der modellfreie Demo-Weg.
//
// WAS DIESE DATEI PINNT: dass der Bedeutungssatz über das Wissensobjekt im Erfolgsblock der
// Vordertür erscheint, GEMEINSAM mit der Bestätigung, und dass er aus dem VORHANDENEN
// dreisprachigen Schlüssel `capture.savedBody` stammt.
//
// WAS SIE AUSDRÜCKLICH NICHT TUT: sie ersetzt `fd.submittedBody` nicht und verlangt seine
// Entfernung nicht. `capture-front-door.test.ts:376-377` prüft zweimal, dass dieser Schlüssel im
// Quelltext steht; ein Ersetzen färbte einen BESTEHENDEN Test rot. Vertragskonform ist nur:
// zusätzlich rendern. Beide Sätze stehen danach nebeneinander — einer über den Editor, einer über
// das Wissensobjekt.
//
// WARUM `R-A2-3` GETRENNT STEHT — ER IST DER RÜCKMUTATIONSFANG. `R-A2-1` und `R-A2-2` prüfen den
// gerenderten Text. Würde jemand später denselben Satz als eingetipptes Literal oder unter einem
// neuen `fd.*`-Schlüssel hinschreiben, blieben beide grün — die Wiederverwendung wäre still
// verloren, und die zweite Fläche hätte wieder ihre eigene Wahrheit. `R-A2-3` hängt deshalb am
// SCHLÜSSEL, nicht am Text.
//
// `R-A2-4` IST ABDECKUNG, KEIN ROTVERTRAG. Die drei Sprachwerte existieren bereits; der Fall wäre
// auch ohne diese Tranche grün. Das wird hier gesagt statt verschwiegen.
//
// DIE BRÜCKE ist dieselbe wie in `mega23-vordertuer-vorgang-mounted.test.tsx`: echte Oberfläche,
// echter Client, echte Fastify-Anwendung über `fetch → app.inject`. Sie steht als eigene Kopie und
// nicht als Import — die abgenommenen Dateien bleiben unverändert, und dieser Beleg hängt an keiner
// fremden Datei.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Nur die Modellläufe und die Verfügbarkeitsanzeige werden ersetzt. Der Einreichweg selbst —
// `drafts.create`, `drafts.promote` — bleibt das ECHTE Modul und läuft in den echten Server.
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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf nicht gefunden: ${part}. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Body-Editor nicht gefunden");
  }
  return el;
}

/** Der eingereichte Zustand — über den ECHTEN Weg, nicht gesetzt. */
async function einreichenUndWarten(): Promise<void> {
  await act(async () => {
    const el = editor();
    el.innerHTML = "<p>Vor dem Anfahren der Linie L4 den Druck am Ventil V2 pruefen.</p>";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    buttonByText(i18n.t("fd.submitReview")).click();
    await flush();
  });
}

function seitenquelle(): string {
  return readFileSync(resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"), "utf8");
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AUFTRAG-196 U1 A2: die Vordertür sagt, was mit dem Wissensobjekt geschieht", () => {
  // --------------------------------------------------------------------------------------------
  // R-A2-1 — DER BEDEUTUNGSSATZ ÜBER DAS WISSENSOBJEKT STEHT IM ERFOLGSBLOCK.
  // --------------------------------------------------------------------------------------------
  it("R-A2-1: nach dem Einreichen erscheint der Bedeutungssatz über das Wissensobjekt", async () => {
    await mount();
    await einreichenUndWarten();

    // KALIBRIERUNG: erst wenn der Erfolgsblock wirklich steht, sagt die Zusicherung darunter etwas
    // über das Produkt statt über einen Selektor, der ins Leere greift.
    expect(
      pageText(),
      "der eingereichte Zustand ist nicht erreicht — alles Weitere wäre eine Aussage über den Harness",
    ).toContain(i18n.t("fd.submitted"));

    expect(pageText()).toContain(i18n.t("capture.savedBody"));
    unmount();
  });

  // --------------------------------------------------------------------------------------------
  // R-A2-2 — BESTÄTIGUNG UND BEDEUTUNG STEHEN GEMEINSAM. DAS IST DAS EIGENTLICHE VERSPRECHEN.
  // --------------------------------------------------------------------------------------------
  //
  // Getrennt von R-A2-1, weil ein Bedeutungssatz an anderer Stelle der Seite die Lücke nicht
  // schliesst: die Testperson liest ihn im Moment des Abschlusses oder gar nicht.
  it("R-A2-2: Bestätigung und Bedeutungssatz stehen gemeinsam im DOM", async () => {
    await mount();
    await einreichenUndWarten();

    const text = pageText();
    expect(text).toContain(i18n.t("fd.submitted"));
    expect(text).toContain(i18n.t("capture.savedBody"));
    // Und der bestehende Editor-Satz bleibt — A2 ergänzt, es ersetzt nicht.
    expect(text).toContain(i18n.t("fd.submittedBody"));
    unmount();
  });

  // --------------------------------------------------------------------------------------------
  // R-A2-3 — DER RÜCKMUTATIONSFANG: DER SATZ STAMMT AUS DEM VORHANDENEN SCHLÜSSEL.
  // --------------------------------------------------------------------------------------------
  //
  // Ohne diesen Fall bliebe die Wiederverwendung eine Absichtserklärung. Ein später eingetipptes
  // Literal oder ein neuer `fd.*`-Schlüssel mit demselben Wortlaut liesse R-A2-1 und R-A2-2 grün.
  it("R-A2-3: der Satz kommt aus capture.savedBody, nicht aus einem neuen Literal", () => {
    const quelle = seitenquelle();

    expect(quelle).toContain("capture.savedBody");
    // Der bestehende Schlüssel bleibt unangetastet — sonst fiele capture-front-door.test.ts:376-377.
    expect(quelle).toContain("fd.submittedBody");
    // Kein eingetipptes Duplikat des Satzes in der Ansicht.
    expect(quelle).not.toContain("Gespeichert als dein eigenes Wissen");
  });

  // --------------------------------------------------------------------------------------------
  // R-A2-4 — ABDECKUNG, KEIN ROTVERTRAG. Ausdrücklich als solche gekennzeichnet.
  // --------------------------------------------------------------------------------------------
  it("R-A2-4 (Abdeckung): DE/EN/NL tragen je einen eigenen, nicht leeren Text", async () => {
    const gesehen: string[] = [];
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      const wert = i18n.t("capture.savedBody");
      expect(wert.trim().length, `capture.savedBody ist leer in ${sprache}`).toBeGreaterThan(0);
      expect(wert, `capture.savedBody ist in ${sprache} nicht übersetzt`).not.toBe(
        "capture.savedBody",
      );
      gesehen.push(wert);
    }
    expect(new Set(gesehen).size, "die drei Sprachwerte sind nicht verschieden").toBe(3);
    await i18n.changeLanguage("de");
  });
});
