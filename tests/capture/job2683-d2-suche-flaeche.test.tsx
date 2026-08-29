// @vitest-environment jsdom
// ================================================================================================
// JOB 2683 D2 — DER SPINNER ENDET UND SAGT WARUM: „Externe Suche" im Erfassen, gemountet.
// ================================================================================================
//
// BENs Prüflücke 2 zu D1, wörtlich: „UI-Test der externen Suche in mindestens einer realen
// Nutzerfläche (Capture oder KnowledgeDetail). Fall: Timeout und DNS-Fehler. Erwartung: Pending endet,
// die jeweiligen generischen Texte werden sichtbar, und Host-, URL- sowie DNS-Details fehlen."
//
// Hier läuft die ECHTE Seite `Capture` im echten Provider-Gerüst (Harness wie
// `mega17-quellen-hinweis-mounted`). Ersetzt ist nur der Endpunkt: er antwortet so, wie die Route
// seit D1 antwortet — mit dem generischen Satz aus `EXTERNAL_SEARCH_MELDUNG`, den
// `tests/app/job2683-zwei-knoepfe-flaeche.test.ts` an der echten Route pinnt. Der Fehlertext erreicht
// die Seite über `fail` (Capture.tsx: `setErr(e instanceof ApiError ? e.message : …)`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const suche = vi.hoisted(() => ({
  fn: async (): Promise<unknown> => [],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: {
        policy: vi.fn(async () => ({ stage: "search_on_click" })),
        search: vi.fn(() => suche.fn()),
      },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: vi.fn(async () => ({ id: "d1" })),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: false, mode: "cloud", reachable: "inactive" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
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
import { ApiError } from "../../apps/web/src/api/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { EXTERNAL_SEARCH_MELDUNG } from "../../services/external-search/src/wikipedia";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

// JOB 2706 D3 (BENs Prüflücke 1 zu 2706 D2): ZUSTANDSBEZOGEN WARTEN STATT FESTER FRIST. Bis D3
// wartete der Fehlerpfad `warte(300)` auf einen 100-ms-Timer und las danach den Knopf — unter Last
// (Prüfer-Suite, 2706 D1) kam der Timer plus Rendern später dran als 300 ms real, und der Test kippte
// ohne jede Fachaussage. Jetzt wird bis zum ZUSTAND gewartet (Knopf entsperrt), mit einer Obergrenze,
// die nur noch ein Hängen abfängt. Die Zusicherungen dahinter sind unverändert.
async function warteAufZustand(zustand: () => boolean, obergrenzeMs = 5_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    await act(flush);
    if (zustand()) return;
    if (Date.now() - start > obergrenzeMs) {
      throw new Error(`Zustand nicht innerhalb von ${obergrenzeMs} ms erreicht`);
    }
    await warte(10);
  }
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function inputByPlaceholder(ph: string): HTMLInputElement {
  const el = [...container.querySelectorAll("input")].find((i) => i.placeholder === ph);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Input mit Placeholder „${ph}“ nicht gefunden`);
  }
  return el;
}

async function change(el: HTMLElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

// Der Weg zur externen Suche — genau der, den ein Nutzer geht (wie mega17 zum Quellenformular).
async function suchfeldOeffnen(): Promise<void> {
  await click(buttonByText("Weitere Wege anzeigen"));
  await click(buttonByText(i18n.t("capture.advanced.title")));
}

function suchKnopf(): HTMLButtonElement {
  return buttonByText(i18n.t("ext.search"));
}

async function suchen(begriff: string): Promise<void> {
  await change(inputByPlaceholder(i18n.t("ext.placeholder")), begriff);
  await click(suchKnopf());
}

function keinHostKeinDns(text: string): void {
  expect(text).not.toMatch(/wikipedia\.org|https?:\/\/|ENOTFOUND|getaddrinfo|ECONNREFUSED/);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2683 D2 · Externe Suche im Erfassen, gemountet", () => {
  it("GEGENPROBE: solange die Route nicht antwortet, bleibt der Suchknopf gesperrt (Pending) — die Fläche kann das Warten nicht selbst beenden", async () => {
    suche.fn = () => new Promise(() => undefined); // nie
    await mount();
    await suchfeldOeffnen();
    await suchen("Ventil");
    await warte(300);
    await act(flush);
    expect(suchKnopf().disabled).toBe(true);
    expect(pageText()).not.toContain(EXTERNAL_SEARCH_MELDUNG.timeout);
  });

  it("Zeitüberschreitung: die Route antwortet nach ihrer Frist → Pending endet, der generische Satz steht auf der Seite, kein Host", async () => {
    suche.fn = () =>
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(new ApiError(400, "EXTERNAL_SEARCH_FAILED", EXTERNAL_SEARCH_MELDUNG.timeout)),
          100,
        ),
      );
    await mount();
    await suchfeldOeffnen();
    await suchen("Ventil");
    expect(suchKnopf().disabled).toBe(true); // erst dreht es …
    await warteAufZustand(() => !suchKnopf().disabled);
    expect(suchKnopf().disabled).toBe(false); // … dann endet es
    const text = pageText();
    expect(text).toContain(EXTERNAL_SEARCH_MELDUNG.timeout);
    expect(text).toContain("Zeitüberschreitung");
    keinHostKeinDns(text);
  });

  it("DNS-Fehler: der generische Satz nicht erreichbar — kein ENOTFOUND, kein Host", async () => {
    suche.fn = () =>
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new ApiError(400, "EXTERNAL_SEARCH_FAILED", EXTERNAL_SEARCH_MELDUNG.unreachable),
            ),
          50,
        ),
      );
    await mount();
    await suchfeldOeffnen();
    await suchen("Ventil");
    await warteAufZustand(() => !suchKnopf().disabled);
    expect(suchKnopf().disabled).toBe(false);
    const text = pageText();
    expect(text).toContain(EXTERNAL_SEARCH_MELDUNG.unreachable);
    keinHostKeinDns(text);
  });

  it("KALIBRIERUNG: Treffer kommen weiter an — der Weg ist derselbe, nur der Ausgang ist ein anderer", async () => {
    suche.fn = async () => [
      {
        title: "Sicherheitsventil",
        url: "https://de.wikipedia.org/wiki/Sicherheitsventil",
        snippet: "Schützt vor Überdruck.",
        provider: "Wikipedia",
      },
    ];
    await mount();
    await suchfeldOeffnen();
    await suchen("Ventil");
    await act(flush);
    expect(pageText()).toContain("Sicherheitsventil");
    expect(pageText()).not.toContain(EXTERNAL_SEARCH_MELDUNG.unreachable);
  });
});
