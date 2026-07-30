// @vitest-environment jsdom
// AUFTRAG-mega1 Block D3 (E2E-018): leere/Whitespace-Frage → Absende-Knopf deaktiviert + zugängliche
// Inline-Meldung; kein Request. Erst echter Text macht den Knopf bedienbar. Gemountet an der echten
// Ask-Seite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUFTRAG-mega71 Block E: Ask stellt die Rollenfrage jetzt am RoleLink-Tor (useRole). Diese Datei
// prüft NICHT die Rollen-Lage (das tun der mega70/71-Rohlink-Sammler und mega51-mounted am Tor
// selbst) — sie mountet die Fläche wie mega69-ask-kostenhinweis mit fester Expertinnen-Rolle.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    reasoner: { status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "active" })) },
    ask: {
      ask: vi.fn(async () => ({ answered: false, sources: [] })),
      helpful: vi.fn(async () => ({})),
    },
  };
  // Alle übrigen Namespaces (ko/directory/conflicts …) liefern []-auflösende Funktionen.
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/fragen"] }, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function submitButton(): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(i18n.t("ask.submit")),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Absende-Knopf nicht gefunden");
  }
  return btn;
}

function queryInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>("input[type=search], input");
  if (!input) {
    throw new Error("Eingabefeld nicht gefunden");
  }
  return input;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block D3: leere Frage blockiert Absenden", () => {
  it("leer → Knopf deaktiviert + Inline-Meldung NACH dem Fehlversuch; Text → bedienbar", async () => {
    await mount();
    // Leer: Knopf deaktiviert.
    expect(submitButton().disabled).toBe(true);
    // AUFTRAG-mega38 BLOCK J2: die Meldung steht NOCH NICHT da. Sie stand bis mega37 vom ersten
    // Bildaufbau an — eine Zurechtweisung, bevor die Leserin irgendetwas getan hatte.
    expect(container.textContent).not.toContain(i18n.t("ask.emptyHint"));
    // AUFTRAG-mega39 BLOCK G: und dasselbe gilt für das SIGNAL daneben. Dieser Pin verlangte bis
    // mega38 „true" ab dem ersten Bildaufbau — er hat den Befund damit festgehalten statt behoben:
    // eine Screenreader-Nutzerin bekam das eben erst gefundene, leere Feld als „ungültig" gemeldet,
    // bevor sie irgendetwas getan hatte. Jetzt läuft es im Takt mit dem sichtbaren Tadel.
    expect(queryInput().getAttribute("aria-invalid")).toBe("false");

    // Submit trotz Leere löst KEINEN Request aus.
    await act(async () => {
      submitButton()
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flush();
    });
    expect(askMock).not.toHaveBeenCalled();
    // ERST JETZT — nach dem echten Fehlversuch — erklärt die Seite, was fehlt.
    expect(container.textContent).toContain(i18n.t("ask.emptyHint"));
    // BLOCK G: und erst jetzt meldet das Feld sich auch für Screenreader als ungültig.
    expect(queryInput().getAttribute("aria-invalid")).toBe("true");

    // Echter Text → Knopf bedienbar, Meldung weg.
    const input = queryInput();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "Wann Ventil schließen?");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    expect(submitButton().disabled).toBe(false);
    expect(container.textContent).not.toContain(i18n.t("ask.emptyHint"));
  });
});
