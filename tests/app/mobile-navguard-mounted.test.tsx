// @vitest-environment jsdom
// WP-SAMMEL20-FIX (bens Fix 4, B1b ROT): der Rückweg aus /mobile läuft durch den REGULÄREN
// NavGuard (dasselbe Muster wie Sidebar/Command-Palette/Capture — konsistent): eine befüllte
// Mobile-Eingabe macht die Navigation dirty, der bestehende Bestätigungsdialog fragt nach
// (Bleiben · Verwerfen · Entwurf speichern) — der getippte Text geht nie mehr still verloren.
// Der Rückweg führt zur VORHERIGEN Route zurück (state.from des Topbar-Hinwegs), nicht hart
// auf /start; nur der Direkteinstieg ohne Absprungpunkt fällt auf die Startseite zurück.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "d1" })),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    library: { search: vi.fn(async () => []) },
    ask: { ask: vi.fn(async () => ({ answered: false })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(initialState: { from?: string } | null): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [{ pathname: "/mobile", state: initialState }] },
              createElement(
                Routes,
                null,
                createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
                createElement(Route, {
                  path: "/bibliothek",
                  element: createElement("div", null, "BIBLIOTHEK-SEITE"),
                }),
                createElement(Route, {
                  path: "/start",
                  element: createElement("div", null, "START-SEITE"),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text ${part} nicht gefunden`);
  }
  return btn;
}

function statementBox(): HTMLTextAreaElement {
  const box = container.querySelector("textarea");
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error("Mobile-Textfeld nicht gefunden");
  }
  return box;
}

// Getippten Text wie ein Nutzer setzen: nativer Value-Setter + input-Event (React-onChange).
function typeInto(box: HTMLTextAreaElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(box, text);
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("WP-SAMMEL20-FIX Fix 4: /mobile-Rückweg mit NavGuard und ohne State-Verlust", () => {
  it("befüllte Eingabe + Rückweg → der Guard fragt nach; Bleiben erhält den Text, Verwerfen führt zur AUSGANGSROUTE", async () => {
    mount({ from: "/bibliothek" });
    await act(async () => {});
    typeInto(statementBox(), "Wichtiger Gedanke, noch nicht gespeichert");
    await act(async () => {});
    expect(statementBox().value).toBe("Wichtiger Gedanke, noch nicht gespeichert");

    // Rückweg klicken → KEIN sofortiger Wechsel: der bestehende NavGuard-Dialog fragt nach.
    await act(async () => {
      buttonByText("Zur Vollversion").click();
    });
    expect(container.textContent).toContain("Ungespeicherte Eingabe");
    // Bleiben → weiterhin /mobile, der getippte Text ist UNVERÄNDERT da (kein State-Verlust).
    await act(async () => {
      buttonByText("Hier bleiben").click();
    });
    expect(container.textContent).not.toContain("BIBLIOTHEK-SEITE");
    expect(statementBox().value).toBe("Wichtiger Gedanke, noch nicht gespeichert");

    // Erneut zurück, diesmal bewusst verwerfen → Rückkehr zur VORHERIGEN Route (state.from),
    // NICHT hart auf /start.
    await act(async () => {
      buttonByText("Zur Vollversion").click();
    });
    await act(async () => {
      buttonByText("Verwerfen und wechseln").click();
    });
    expect(container.textContent).toContain("BIBLIOTHEK-SEITE");
    expect(container.textContent).not.toContain("START-SEITE");
  });

  it("leere Eingabe → der Rückweg wechselt ohne Dialog; ohne Absprungpunkt (Deep-Link) → Startseite als Fallback", async () => {
    mount(null);
    await act(async () => {});
    await act(async () => {
      buttonByText("Zur Vollversion").click();
    });
    // Nichts eingegeben → kein Dialog, direkter Wechsel; ohne state.from ehrlich auf /start.
    expect(container.textContent).not.toContain("Ungespeicherte Eingabe");
    expect(container.textContent).toContain("START-SEITE");
  });

  it("Entwurf speichern und wechseln → der Text landet als Draft (normaler Draft-Weg), dann Rückkehr", async () => {
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    mount({ from: "/bibliothek" });
    await act(async () => {});
    typeInto(statementBox(), "Bitte als Entwurf sichern");
    await act(async () => {});
    await act(async () => {
      buttonByText("Zur Vollversion").click();
    });
    await act(async () => {
      buttonByText("Entwurf speichern und wechseln").click();
    });
    const createMock = endpoints.drafts.create as unknown as ReturnType<typeof vi.fn>;
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      statement: "Bitte als Entwurf sichern",
    });
    expect(container.textContent).toContain("BIBLIOTHEK-SEITE");
    // Nachlaufende Query-Invalidierung (Drafts-Refetch) noch im act-Rahmen ausklingen lassen.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });
});
