// @vitest-environment jsdom
// ================================================================================================
// Aufnahme gesamt-integrations-api · R-0842 — DIE FRAGEN-SEITE ZEIGT DEN WARTESATZ.
// ================================================================================================
//
// „… bei Erreichen der Grenze einen verständlichen Satz mit Wartezeit bekommen statt eines
// allgemeinen Fehlers." Der Satz kommt vom Server (`ki-bremse-angemeldet.test.ts` misst ihn am
// Draht); hier wird gemessen, dass die Seite GENAU ihn zeigt — und nicht den Kasten „Die Anfrage
// ist unterwegs steckengeblieben" samt „Erneut versuchen". Aufbau wie
// `tests/ask/mega39-fehler-ohne-fremde-antwort.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const steuer = vi.hoisted(() => ({
  offen: [] as { aufloesen: (w: unknown) => void; abweisen: (f: unknown) => void }[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    gaps: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(
        () =>
          new Promise((resolve, reject) => {
            steuer.offen.push({ aufloesen: resolve, abweisen: reject });
          }),
      ),
      helpful: vi.fn(async () => ({})),
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
import { ApiError } from "../../apps/web/src/api/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = (): void => {};

const WARTESATZ =
  "Sie haben in kurzer Zeit sehr viele KI-Anfragen gestellt. Bitte warten Sie 42 Sekunden und versuchen Sie es dann erneut.";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
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
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function frageAbsenden(container: HTMLElement, frage: string): Promise<void> {
  const feld = container.querySelector("input");
  expect(feld, "Eingabefeld nicht gefunden").toBeTruthy();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld, frage);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  const form = container.querySelector("form");
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

beforeEach(() => {
  steuer.offen.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R-0842 · die Fragen-Seite bei gebremster KI-Anfrage", () => {
  it("U1 · zeigt den Satz des Servers mit der Wartezeit — nicht den allgemeinen Fehlertext", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, "Wie oft wird Ventil V4 geprüft?");
    await act(async () => {
      steuer.offen[0]?.abweisen(new ApiError(429, "KI_ANFRAGEN_GEBREMST", WARTESATZ));
      await flush();
    });

    const kasten = container.querySelector('[data-testid="ask-ki-gebremst"]');
    expect(kasten, "der Wartesatz-Kasten fehlt").not.toBeNull();
    expect(kasten?.textContent ?? "").toContain(WARTESATZ);
    expect(kasten?.textContent ?? "").toContain(i18n.t("ask.gebremst.titel"));
    const text = container.textContent ?? "";
    expect(text, "der allgemeine Fehlertext steht trotzdem da").not.toContain(
      i18n.t("ask.error.body"),
    );
    unmount();
  });

  it("U2 · Gegenprobe: ein anderer Fehler zeigt weiter den allgemeinen Kasten", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, "Wie oft wird Ventil V4 geprüft?");
    await act(async () => {
      steuer.offen[0]?.abweisen(new Error("network"));
      await flush();
    });
    expect(container.querySelector('[data-testid="ask-ki-gebremst"]')).toBeNull();
    expect(container.textContent ?? "").toContain(i18n.t("ask.error.body"));
    unmount();
  });
});
