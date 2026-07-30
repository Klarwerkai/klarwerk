// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega69 BLOCK B1 (bens sammel65-Auflage 1) — DIE FRAGENFLÄCHE, GEMOUNTET.
// ================================================================================================
//
// bens Befund: `AiCostHint` rendert richtig nur bei `billable === true`, aber Ask zeigte seinen
// eigenen Kostenwortlaut UNBEDINGT (Beschriftung + `title` je Chip) — die Kernzusage „Kostenhinweis
// nur bei kostenpflichtiger KI" war an einer prominenten Auslösestelle nicht erfüllt.
//
// Hier die drei verlangten Fälle, an der ECHTEN Seite gemountet:
//   1. Cloud-Kette für „answer" → der Kostensatz steht (und der Sofort-Satz auch),
//   2. „answer" lokal/deterministisch → KEIN Kostensatz — aber der Sofort-Satz bleibt
//      (Kalibrierung: die Fläche rendert, es fehlt nur die Kostenbehauptung),
//   3. Status noch nicht geladen → KEIN Kostensatz (keine unbelegte Behauptung beim Laden).
//
// Der `title` an den Beispiel-Chips trägt seit mega69 B1 nur den Sofort-Satz — in KEINEM Fall
// einen Kostenwortlaut; auch das wird je Fall am gerenderten DOM geprüft.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));

vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => {} }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      status: vi.fn(),
      config: vi.fn(),
    },
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
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
import type { ReasonerStatus } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const statusMock = endpoints.reasoner.status as unknown as ReturnType<typeof vi.fn>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<{ container: HTMLElement; unmount: () => void }> {
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
        createElement(MemoryRouter, null, createElement(Ask)),
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

const kostensatz = (c: HTMLElement): boolean =>
  c.querySelector("[data-testid=ai-cost-hint]") !== null;
const sofortSatz = (): string => i18n.t("ask.examplesSendHint");
const kostenwort = (): string => i18n.t("ai.costHint");

function chipTitlesOhneKosten(c: HTMLElement): void {
  const titles = Array.from(c.querySelectorAll("button[title]")).map(
    (b) => b.getAttribute("title") ?? "",
  );
  expect(titles.length).toBeGreaterThan(0); // Kalibrierung: die Chips sind wirklich gerendert
  for (const title of titles) {
    expect(title).not.toContain(kostenwort());
    expect(title.toLowerCase()).not.toContain("kostenpflichtig");
  }
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega69 B1 · der Kostenhinweis der Fragenfläche folgt der Bedingung", () => {
  it("Cloud-Kette für „answer“ → Kostensatz UND Sofort-Satz stehen", async () => {
    const status: ReasonerStatus = {
      active: true,
      mode: "cloud",
      reachable: "active",
      tasks: { answer: true },
      billable: { answer: true },
    };
    statusMock.mockResolvedValue(status);
    const { container, unmount } = await mount();
    expect(kostensatz(container)).toBe(true);
    expect(container.textContent).toContain(kostenwort());
    expect(container.textContent).toContain(sofortSatz());
    chipTitlesOhneKosten(container);
    unmount();
  });

  it("„answer“ läuft lokal/deterministisch → KEIN Kostensatz, der Sofort-Satz bleibt", async () => {
    const status: ReasonerStatus = {
      active: true,
      mode: "cloud", // hausweit Cloud verdrahtet — aber DIESE Aufgabe kostet nichts
      reachable: "active",
      tasks: { answer: true },
      billable: { answer: false },
    };
    statusMock.mockResolvedValue(status);
    const { container, unmount } = await mount();
    expect(kostensatz(container)).toBe(false);
    expect(container.textContent).not.toContain(kostenwort());
    // Kalibrierung im selben Fall: die Fläche ist DA (Sofort-Satz gerendert) — es fehlt gezielt
    // nur die Kostenbehauptung, nicht die ganze Beispielzeile.
    expect(container.textContent).toContain(sofortSatz());
    chipTitlesOhneKosten(container);
    unmount();
  });

  it("Status noch nicht geladen → KEIN Kostensatz (keine unbelegte Behauptung)", async () => {
    statusMock.mockImplementation(() => new Promise(() => {})); // antwortet nie
    const { container, unmount } = await mount();
    expect(kostensatz(container)).toBe(false);
    expect(container.textContent).not.toContain(kostenwort());
    expect(container.textContent).toContain(sofortSatz());
    chipTitlesOhneKosten(container);
    unmount();
  });
});
