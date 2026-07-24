// @vitest-environment jsdom
// D-AISTATE PAKET 3 (bens V4, aistate-fix3) — Mounted-Beweis am ECHTEN Ask-Baustein:
//  - OHNE nutzbares Modell löst WEDER Enter (Formular-Submit) NOCH der programmatische Auto-Ask
//    (?ask=1) eine Mutation aus — beide laufen über DENSELBEN zentralen Submit mit Availability-
//    und Pending-Guard (bens Rest-Bypass 6.2 geschlossen).
//  - Ladefall unverändert: solange der Status lädt, graut nichts vorschnell aus.
//  - Gegenprobe: MIT nutzbarem Modell feuert der Auto-Ask GENAU EINMAL (kein Doppel-Send).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn().mockResolvedValue([]) },
    conflicts: { list: vi.fn().mockResolvedValue([]) },
    // FUNKE F1 (nacht24): die Ask-Seite löst Wissensträger-Namen über das Directory auf.
    directory: { list: vi.fn().mockResolvedValue([]) },
    reasoner: { status: vi.fn() },
    ask: {
      ask: vi.fn().mockResolvedValue({
        result: {
          answered: false,
          answer: null,
          knowledgeClass: "unbekannt",
          trust: 0,
          sources: [],
          steps: [],
          demo: true,
        },
      }),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const statusMock = endpoints.reasoner.status as unknown as ReturnType<typeof vi.fn>;
const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;

const NO_MODEL_STATUS = {
  active: false,
  mode: "deterministic",
  reachable: "none",
  tasks: { answer: false },
};
const MODEL_STATUS = {
  active: true,
  mode: "cloud",
  reachable: "active",
  tasks: { answer: true },
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(route: string): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [route] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function submitForm(container: HTMLElement): void {
  const form = container.querySelector("form");
  expect(form).not.toBeNull();
  form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("bens V4: Auto-Ask (?ask=1) läuft über den zentralen Guard", () => {
  it("No-Model + ?ask=1 ⇒ KEINE Mutation (auch nicht programmatisch)", async () => {
    statusMock.mockResolvedValue(NO_MODEL_STATUS);
    const { unmount } = await mountAsk("/fragen?q=Testfrage&ask=1");
    await act(flush);
    expect(askMock).not.toHaveBeenCalled();
    unmount();
  });

  it("Gegenprobe: Modell nutzbar + ?ask=1 ⇒ Auto-Ask feuert GENAU EINMAL", async () => {
    statusMock.mockResolvedValue(MODEL_STATUS);
    const { unmount } = await mountAsk("/fragen?q=Testfrage&ask=1");
    await act(flush);
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]?.[0]).toBe("Testfrage");
    unmount();
  });
});

describe("bens V4: Enter/Formular-Submit bei No-Model", () => {
  it("No-Model + Enter (Submit auf dem echten Formular) ⇒ KEINE Mutation, Knopf ausgegraut", async () => {
    statusMock.mockResolvedValue(NO_MODEL_STATUS);
    // Frage nur vorbefüllt (?q= ohne ask=1) — dann Submit direkt auf dem Formular auslösen.
    const { container, unmount } = await mountAsk("/fragen?q=Testfrage");
    await act(flush);
    // Erst sicherstellen, dass der Status geladen ist (Knopf ausgegraut) …
    const button = container.querySelector("form button[type=submit]") as HTMLButtonElement | null;
    expect(button?.disabled).toBe(true);
    // … dann der programmatische Submit: der zentrale Guard blockt die Mutation.
    await act(async () => {
      submitForm(container);
      await flush();
    });
    expect(askMock).not.toHaveBeenCalled();
    unmount();
  });
});

describe("bens V4: Ladefall bleibt unverändert (kein vorschnelles Ausgrauen)", () => {
  it("Status lädt noch ⇒ Senden-Knopf NICHT deaktiviert, Auto-Ask wartet (keine Mutation)", async () => {
    statusMock.mockReturnValue(new Promise(() => undefined)); // Status kommt nie an → Ladefall
    const { container, unmount } = await mountAsk("/fragen?q=Testfrage&ask=1");
    await act(flush);
    const button = container.querySelector("form button[type=submit]") as HTMLButtonElement | null;
    expect(button?.disabled).toBe(false);
    // Der Ein-Schuss wird im Ladefall NICHT verbraucht und NICHT blind gefeuert.
    expect(askMock).not.toHaveBeenCalled();
    unmount();
  });
});
