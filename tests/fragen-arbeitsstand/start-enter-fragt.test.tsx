// @vitest-environment jsdom
// ================================================================================================
// N-0007 (Ben R1, F9) — ENTER AUF START STELLT DIE FRAGE, NICHT NUR DAS FELD AUF /fragen.
// ================================================================================================
//
// Die echte Startseite im echten Router: Eingabe plus Absenden führt auf eine Adresse, die die
// Fragenseite als Antwortwunsch liest (`shouldAutoAskFromSearch` → `?ask=1`). Dass /fragen diesen
// Wunsch über den zentralen Submit einlöst — und ohne nutzbares Modell NICHT —, pinnen
// `tests/app/ask-ai-guard-mounted.test.tsx` und `ben-r1-gegenproben-mounted.test.tsx` F3.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      analytics: { overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }) },
      validation: { board: ok({ columns: [] }) },
      conflicts: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: { summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }) },
      ko: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok(null) },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      notifications: { list: ok([]) },
      duplicateSignal: { list: ok([]) },
      reasoner: { config: ok(null), assistPresets: ok([]), status: ok(null) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { shouldAutoAskFromSearch } from "../../apps/web/src/lib/askQuestion";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Ziel(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-testid": "ziel" }, `${ort.pathname}${ort.search}`);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(async () => {
  await i18n.changeLanguage("de");
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
                  { initialEntries: ["/"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/", element: createElement(Start) }),
                    createElement(Route, { path: "/fragen", element: createElement(Ziel) }),
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("N-0007 · Enter auf Start", () => {
  it("führt auf /fragen MIT Antwortwunsch — die Frage wird dort gestellt, nicht nur vorbefüllt", async () => {
    const feld = container.querySelector<HTMLInputElement>("form input");
    expect(feld, "Startfeld nicht gefunden").toBeTruthy();
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
      v: string,
    ) => void;
    await act(async () => {
      setzer.call(feld, "Ventil");
      feld?.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await act(async () => {
      feld?.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flush();
    });
    const ziel = container.querySelector('[data-testid="ziel"]')?.textContent ?? "";
    expect(ziel.startsWith("/fragen?")).toBe(true);
    const params = new URLSearchParams(ziel.slice("/fragen".length));
    expect(params.get("q")).toBe("Ventil");
    expect(shouldAutoAskFromSearch(params)).toBe(true);
  });
});
