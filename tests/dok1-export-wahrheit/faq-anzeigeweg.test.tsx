// @vitest-environment jsdom
// FAQ_CONTENT -> allFaqEntries -> KlaraAssistant: echte Suche und sichtbare Antwort.
// Nur die für statische FAQ irrelevante Modellverfügbarkeit wird ersetzt.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";
import { FAQ_CONTENT } from "../../apps/web/src/lib/faqContent";
import { allFaqEntries } from "../../apps/web/src/lib/klaraRegistry";

vi.mock("../../apps/web/src/lib/useAiAvailable", () => ({
  useAiAvailable: () => ({ available: false, isLoading: false }),
}));
vi.mock("../../apps/web/src/components/AiModelInfo", () => ({ AiModelInfo: () => null }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

describe("DOK1-R: Exportantworten erreichen den Menschen über Klara", () => {
  it("FAQ-Liste enthält jede Originalantwort; Suche zeigt die vier korrigierten Antworten", async () => {
    await i18n.changeLanguage("de");
    const entries = allFaqEntries("de");
    expect(entries.map((entry) => ({ id: entry.id, answer: entry.body }))).toEqual(
      FAQ_CONTENT.map((item) => ({ id: `faq:${item.id}`, answer: item.answer })),
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client },
            createElement(
              MemoryRouter,
              {
                initialEntries: ["/bibliothek"],
                future: { v7_startTransition: true, v7_relativeSplatPath: true },
              },
              createElement(KlaraAssistant),
            ),
          ),
        );
      });
      const open = host.querySelector<HTMLButtonElement>(
        `button[aria-label="${i18n.t("klara.open")}"]`,
      );
      expect(open).not.toBeNull();
      await act(async () => open?.click());
      const input = host.querySelector<HTMLInputElement>("input");
      expect(input).not.toBeNull();
      for (const id of ["faq.vertrauen.4", "faq.vertrauen.5", "faq.bibliothek.6", "faq.ki.3"]) {
        const item = FAQ_CONTENT.find((entry) => entry.id === id);
        if (!item || !input) throw new Error(`FAQ oder Suchfeld fehlt: ${id}`);
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
            input,
            item.question,
          );
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(
          [...host.querySelectorAll("p")].some(
            (paragraph) => paragraph.textContent === item.answer,
          ),
          `${id}: vollständige Antwort im geöffneten Panel`,
        ).toBe(true);
      }
    } finally {
      await act(async () => root.unmount());
      client.clear();
      host.remove();
    }
  });
});
