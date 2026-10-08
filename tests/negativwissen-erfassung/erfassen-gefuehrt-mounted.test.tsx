// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-negativwissen-erfassung — DER GEFÜHRTE LERNEFFEKT IM ECHTEN ARBEITSRAUM.
// ================================================================================================
//
// Bauform wörtlich aus `tests/vertraulichkeit-pflicht/erfassen-arbeitsraum-verlangt-stufe.test.tsx`
// (dort begründet): die echte Seite `pages/Capture.tsx` (`CaptureArbeitsraum`) gemountet, die echten
// Knöpfe, der echte API-Client, die echte Fastify-Anwendung über `app.inject`. Gefälscht ist allein
// der Modelllauf `reasoner.structure`. Der Endzustand wird beim Server erfragt.
//
//   M1 (R-1664, R-2179, R-2180 / K1, K2, K3) Lerneffekt über die erweiterten Details wählen, die
//      geführten Fragen samt Warnsignalen beantworten, Personenbezug angeben: die Auswahl steht auf
//      „vertraulich", „Öffentlich-intern" ist gesperrt, und das eingereichte Wissensobjekt trägt
//      Wissensart, Angaben und Stufe.
//   M2 (R-2179 / K2) Sichern → neu laden → fortsetzen: die Angaben kehren in die Felder zurück und
//      reisen beim Einreichen ins Wissensobjekt.
//   M3 (K1/K2, BEN Nacharbeit 2) Eine Überschreitung steht vor dem Speichern am Feld; Sichern und
//      Einreichen gehen nicht hinaus, die Eingabe bleibt vollständig; an der Grenze geht alles durch.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  requests: [] as { method: string; url: string; body: string }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

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
          active: true,
          mode: "cloud",
          reachable: "ok",
          tasks: { structure: true, extract: true },
        })),
        config: vi.fn(async () => null),
        structure: vi.fn(async () => ({
          title: "Frostschaden an Pumpe P3",
          statement: "Pumpe P3 ist eingefroren, weil die Begleitheizung abgeschaltet war.",
          type: "best_practice",
          category: "Pumpen",
          tags: [],
          conditions: [],
          measures: [],
        })),
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ADVANCED_FIELDS_KEYS } from "../../apps/web/src/lib/captureAdvancedFields";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
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
    bruecke.requests.push({ method: init.method ?? "GET", url, body: init.body ?? "" });
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
  bruecke.requests = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@negativwissen.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@negativwissen.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

interface KoAusBestand {
  type: string;
  confidentiality?: string | null;
  negativwissen?: {
    incidentTrigger?: string;
    avoidanceRule?: string;
    earlyWarningSigns: string[];
    bezug: string[];
  };
}

async function bestand(): Promise<KoAusBestand[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
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

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function knopfMitText(teil: string): HTMLButtonElement {
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}“ nicht gefunden. Sichtbar: ${seitentext().slice(0, 900)}`);
  }
  return knopf;
}

function element<T extends Element>(testid: string): T {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  if (!el) {
    throw new Error(`„${testid}“ nicht gefunden. Sichtbar: ${seitentext().slice(0, 900)}`);
  }
  return el as T;
}

async function klick(knopf: HTMLElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

async function setzen(el: HTMLElement, wert: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function erweiterteFelderOeffnen(): Promise<void> {
  const schalter = [...container.querySelectorAll("button[aria-expanded]")].find((b) =>
    (b.textContent ?? "").includes(i18n.t(ADVANCED_FIELDS_KEYS.title)),
  );
  if (!(schalter instanceof HTMLButtonElement)) {
    throw new Error(`Erweiterte Felder nicht aufklappbar. Sichtbar: ${seitentext().slice(0, 900)}`);
  }
  if (schalter.getAttribute("aria-expanded") !== "true") {
    await klick(schalter);
  }
}

/** Lerneffekt wählen und die geführten Fragen beantworten — der Weg eines Menschen. */
async function lerneffektErfassen(): Promise<void> {
  await erweiterteFelderOeffnen();
  await klick(element<HTMLButtonElement>("negativwissen-einstieg"));
  await setzen(
    element<HTMLTextAreaElement>("negativwissen-incidentTrigger"),
    "Begleitheizung bei Wartung abgeschaltet",
  );
  await setzen(
    element<HTMLTextAreaElement>("negativwissen-avoidanceRule"),
    "Begleitheizung nie ohne Freigabe abschalten.",
  );
  await setzen(
    element<HTMLTextAreaElement>("negativwissen-warnsignale"),
    "Druckabfall am Morgen\nEis an der Leitung",
  );
  await klick(element<HTMLButtonElement>("negativwissen-bezug-personen"));
}

/** Erzählen → Strukturieren: das Erzählfeld ist das Textfeld ohne Prüfkennung. */
async function bisZumEntwurf(): Promise<void> {
  const feld = [...container.querySelectorAll("textarea")].find((t) => !t.dataset.testid);
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Erzähl-Feld nicht gefunden");
  }
  await setzen(feld, "Pumpe P3 ist im Winter eingefroren, die Begleitheizung war abgeschaltet.");
  await klick(knopfMitText(i18n.t("capture.structure")));
}

async function einreichen(): Promise<void> {
  const kandidaten = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const knopf = kandidaten[kandidaten.length - 1];
  if (!(knopf instanceof HTMLButtonElement) || knopf.disabled) {
    throw new Error(`Einreichen nicht möglich. Sichtbar: ${seitentext().slice(-900)}`);
  }
  await klick(knopf);
}

/** Der Klick auf den echten Einreichen-Knopf, ohne vorauszusetzen, dass er offen ist. */
async function einreichenVersuchen(): Promise<void> {
  const kandidaten = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const knopf = kandidaten[kandidaten.length - 1];
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Einreichen-Knopf nicht gefunden. Sichtbar: ${seitentext().slice(-900)}`);
  }
  await klick(knopf);
}

function vertraulichkeitsFeld(): HTMLSelectElement {
  return element<HTMLSelectElement>("capture-vertraulichkeit");
}

/** Die Stufenwahl steht auf der Wissensseite offen, im Schritt „Erzählen" in den Details. */
async function vertraulichkeitsFeldSichtbar(): Promise<HTMLSelectElement> {
  if (!container.querySelector('[data-testid="capture-vertraulichkeit"]')) {
    await erweiterteFelderOeffnen();
  }
  return vertraulichkeitsFeld();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Lerneffekt geführt und vertraulich im Erfassen-Arbeitsraum", () => {
  it("M1 — geführt erfassen mit Warnsignalen und Personenbezug: eingereicht als vertrauliches Negativwissen", async () => {
    await mount();
    await lerneffektErfassen();

    // R-2180: der Personenbezug hat die Stufe gewählt — „Öffentlich-intern" ist gesperrt.
    const stufe = await vertraulichkeitsFeldSichtbar();
    expect(stufe.value).toBe("vertraulich");
    const intern = [...stufe.options].find((o) => o.value === "intern");
    expect(intern?.disabled).toBe(true);
    expect(element("negativwissen-bezug-stufe")).toBeTruthy();

    await bisZumEntwurf();
    // Auf der Wissensseite steht der Lerneffekt weiter vor der Einreich-Entscheidung.
    expect(element<HTMLTextAreaElement>("negativwissen-avoidanceRule").value).toBe(
      "Begleitheizung nie ohne Freigabe abschalten.",
    );
    await einreichen();

    const kos = await bestand();
    expect(kos, `kein Objekt. Sichtbar: ${seitentext().slice(-600)}`).toHaveLength(1);
    expect(kos[0]?.type).toBe("negativwissen");
    expect(kos[0]?.confidentiality).toBe("vertraulich");
    expect(kos[0]?.negativwissen).toMatchObject({
      incidentTrigger: "Begleitheizung bei Wartung abgeschaltet",
      avoidanceRule: "Begleitheizung nie ohne Freigabe abschalten.",
      earlyWarningSigns: ["Druckabfall am Morgen", "Eis an der Leitung"],
      bezug: ["personen"],
    });
  });

  // BEN, Nacharbeit 2: eine Überschreitung wird VOR dem Speichern gezeigt, nichts geht hinaus, und
  // die Eingabe bleibt vollständig stehen — kein stilles Abschneiden.
  it("M3 — zu lange Vermeidungsregel: Hinweis am Feld, weder Sichern noch Einreichen, Eingabe bleibt", async () => {
    await mount();
    await lerneffektErfassen();
    const zuLang = "R".repeat(2001);
    await setzen(element<HTMLTextAreaElement>("negativwissen-avoidanceRule"), zuLang);

    expect(element("negativwissen-avoidanceRule-grenze").textContent).toContain("2001");
    expect(element("negativwissen-avoidanceRule").getAttribute("aria-invalid")).toBe("true");
    expect(element("negativwissen-grenze-gesperrt").textContent).toContain(
      i18n.t("negativwissen.obergrenze.gesperrt"),
    );

    await bisZumEntwurf();
    const vorher = bruecke.requests.length;
    await klick(knopfMitText(i18n.t("capture.saveDraft")));
    await einreichenVersuchen();
    const hinaus = bruecke.requests
      .slice(vorher)
      .filter((r) => r.method !== "GET" && /\/api\/(kos|drafts)/.test(r.url));
    expect(hinaus, JSON.stringify(hinaus.map((r) => r.url))).toEqual([]);
    expect(await bestand()).toHaveLength(0);
    expect(element<HTMLTextAreaElement>("negativwissen-avoidanceRule").value).toBe(zuLang);
    expect(seitentext()).toContain(i18n.t("negativwissen.obergrenze.gesperrt"));

    // Gekürzt auf die Grenze geht derselbe Fall vollständig durch.
    const passt = "R".repeat(2000);
    await setzen(element<HTMLTextAreaElement>("negativwissen-avoidanceRule"), passt);
    await einreichen();
    const kos = await bestand();
    expect(kos, `kein Objekt. Sichtbar: ${seitentext().slice(-600)}`).toHaveLength(1);
    expect(kos[0]?.negativwissen?.avoidanceRule).toBe(passt);
  });

  it("M2 — sichern, neu laden, fortsetzen: die Angaben kehren zurück und reisen ins Wissensobjekt", async () => {
    await mount();
    await lerneffektErfassen();
    await bisZumEntwurf();
    await klick(knopfMitText(i18n.t("capture.saveDraft")));

    act(() => root.unmount());
    container.remove();
    await mount();
    await klick(knopfMitText(i18n.t("capture.resumeExpand", { count: 1 })));
    await klick(knopfMitText(i18n.t("capture.resume")));

    expect(element<HTMLTextAreaElement>("negativwissen-warnsignale").value).toBe(
      "Druckabfall am Morgen\nEis an der Leitung",
    );
    expect(element("negativwissen-bezug-personen").getAttribute("aria-pressed")).toBe("true");
    expect((await vertraulichkeitsFeldSichtbar()).value).toBe("vertraulich");

    await einreichen();
    const kos = await bestand();
    expect(kos, `kein Objekt. Sichtbar: ${seitentext().slice(-600)}`).toHaveLength(1);
    expect(kos[0]?.negativwissen?.earlyWarningSigns).toEqual([
      "Druckabfall am Morgen",
      "Eis an der Leitung",
    ]);
    expect(kos[0]?.confidentiality).toBe("vertraulich");
  });
});
