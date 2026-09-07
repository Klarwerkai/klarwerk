import { afterEach, expect, vi } from "vitest";
// JOB 3220: echte Ask-Seite, Endpoints, API-Client und Query-Haken; ausschließlich Fetch wird
// an der Netzgrenze beantwortet. Kein Socket/Chromium und kein Mitschnitt des Hintergrundtabs.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export const UNBEKANNT = {
  de: "KI-Status unbekannt — der Statusabruf ist fehlgeschlagen. Deshalb bleibt die KI-Antwort vorsorglich gesperrt.",
  en: "AI status unknown — the status request failed. The AI answer remains blocked as a precaution.",
};

export const MODELL = {
  active: true,
  mode: "cloud",
  reachable: "active",
  tasks: { answer: true },
};

export const OHNE_MODELL = {
  active: false,
  mode: "deterministic",
  reachable: "none",
  tasks: { answer: false },
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const aufraeumen: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of aufraeumen.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

export async function fragenSeite(
  statusAntwort: () => Promise<Response> | Response,
  sprache: "de" | "en" = "de",
) {
  await i18n.changeLanguage(sprache);
  const anfragen: Array<{ url: string; method: string }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    anfragen.push({ url, method });
    if (url === "/api/reasoner/status" && method === "GET") return statusAntwort();
    if (["/api/kos", "/api/conflicts", "/api/directory"].includes(url) && method === "GET") {
      return json([]);
    }
    throw new Error(`Unerwartete Anfrage: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  aufraeumen.push(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen?q=Wie%20arbeite%20ich%20im%20Homeoffice"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
  });
  const knopf = container.querySelector<HTMLButtonElement>('form button[type="submit"]');
  expect(knopf).not.toBeNull();
  if (!knopf) throw new Error("Antwortknopf fehlt");
  expect(container.querySelector<HTMLInputElement>("form input")?.value).not.toBe("");
  const warten = async (pruefen: () => void): Promise<void> => {
    await vi.waitFor(async () => {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
      pruefen();
    });
  };
  const fertig = async () => {
    await warten(() => {
      const status = client.getQueryState(["reasoner", "status"]);
      expect(status?.fetchStatus).toBe("idle");
      expect(status?.status).not.toBe("pending");
    });
    expect(anfragen.filter((a) => a.url === "/api/reasoner/status")).toEqual([
      { url: "/api/reasoner/status", method: "GET" },
    ]);
  };
  return { container, knopf, client, anfragen, fertig, warten };
}
