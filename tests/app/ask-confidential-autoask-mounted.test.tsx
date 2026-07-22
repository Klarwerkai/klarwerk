// @vitest-environment jsdom
// WP-SHIP8-CLOSE-2 (bens GELB, Netz-Spy): der vertraulich-vorbefüllte Bibliothekslink
// (askConfidentialQuestionHref: ?q=… + vertraulich=1, bewusst OHNE ?ask=1) löst beim Öffnen der
// ECHTEN Ask-Seite NULL /api/ask-Aufrufe aus — das Auto-Ask ist nachweislich stumm, die Frage
// steht nur vorbefüllt und der Prüf-Hinweis ist sichtbar. GEGENPROBE (nicht-vakuös): derselbe
// Aufbau über den normalen Antwort-Link (?ask=1) feuert GENAU EINEN Auto-Ask — der Spy ist
// nachweislich scharf, die 0 ist keine tote Zusicherung.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    reasoner: { status: vi.fn(async () => ({ active: false, mode: "deterministic" })) },
    ask: {
      ask: vi.fn(async () => ({
        result: {
          answered: false,
          answer: null,
          knowledgeClass: "unbekannt",
          trust: 0,
          sources: [],
          steps: [],
          demo: true,
        },
        gap: null,
      })),
      helpful: vi.fn(async () => undefined),
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
import { askAnswerHref, askConfidentialQuestionHref } from "../../apps/web/src/lib/askQuestion";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;

const QUESTION = "Was gilt bei der Wartung von Pumpe X?";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function mountAt(href: string): Promise<void> {
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
          createElement(MemoryRouter, { initialEntries: [href] }, createElement(Ask)),
        ),
      ),
    );
  });
  // Queries/Effekte (inkl. eines etwaigen Auto-Ask) vollständig zur Ruhe kommen lassen.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function questionInput(): HTMLInputElement {
  const input = container.querySelector("form input");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Frage-Eingabe nicht gefunden");
  }
  return input;
}

describe("WP-SHIP8-CLOSE-2 (bens GELB): vertraulich vorbefüllter Bibliothekslink → Auto-Ask stumm", () => {
  it("öffnet die Ask-Seite mit 0 /api/ask-Aufrufen; Frage nur vorbefüllt, Prüf-Hinweis sichtbar", async () => {
    await mountAt(askConfidentialQuestionHref(QUESTION));
    // NETZ-SPY: kein einziger Ask-Aufruf — die Frage wurde NICHT automatisch gesendet.
    expect(askMock).not.toHaveBeenCalled();
    expect(questionInput().value).toBe(QUESTION);
    expect(container.textContent).toContain(
      "Vertraulicher Inhalt — prüfe die Frage vor dem Senden.",
    );
  });

  it("GEGENPROBE: der normale Antwort-Link (?ask=1) feuert genau EINEN Auto-Ask — der Spy ist scharf", async () => {
    await mountAt(askAnswerHref(QUESTION));
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock).toHaveBeenCalledWith(QUESTION, "de");
    // Der vertrauliche Prüf-Hinweis gehört NICHT zu diesem Weg.
    expect(container.textContent).not.toContain("Vertraulicher Inhalt — prüfe die Frage");
  });
});
