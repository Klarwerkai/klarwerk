// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega39 BLOCK C — NACH EINEM FEHLER DARF KEINE FREMDE ANTWORT STEHEN BLEIBEN.
// ================================================================================================
//
// DER BEFUND (ben, sammel37-mega38): `onSuccess` ersetzt `result`; ein `onMutate`/`onError`, das
// leert oder bindet, gab es nicht. `submitAsk` setzt `asked` sofort auf die NEUE Frage. Während des
// Ladens wird die alte Antwort korrekt ausgeblendet (`!ask.isPending && result`) — nach einem
// FEHLER aber nicht: `result` trägt noch die vorige Antwort, und Fehlerkasten und alte Antwort
// stehen gleichzeitig da.
//
// Auf dem Bildschirm heisst das: die NEUE Frage steht über der ALTEN Antwort, dazwischen ein roter
// Fehlerkasten. bens Satz dazu: „Das ist für Vertrauen schlimmer als eine reine Fehlermeldung."
// Und der Export (Kopieren/Markdown/Druck) hätte dieselbe Verwechslung mitgenommen.
//
// Der vorhandene mega38-Test prüft nur den LEEREN Erstzustand (erste Frage → Fehler → nichts stand
// vorher da). Dieser hier fährt die echte Folge:
//     Antwort 1 erfolgreich  →  Frage 2  →  Fehler
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Jeder Ask-Aufruf bekommt seinen EIGENEN offenen Vertrag — so lässt sich der erste auflösen und
// der zweite gezielt abweisen.
const steuer = vi.hoisted(() => ({
  offen: [] as { aufloesen: (w: unknown) => void; abweisen: (f: unknown) => void }[],
}));

// AUFTRAG-mega71 Block E: Ask stellt die Rollenfrage jetzt am RoleLink-Tor (useRole). Diese Datei
// prüft NICHT die Rollen-Lage (das tun der mega70/71-Rohlink-Sammler und mega51-mounted am Tor
// selbst) — sie mountet die Fläche wie mega69-ask-kostenhinweis mit fester Expertinnen-Rolle.
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt `scrollIntoView` nicht — hier nur Platzhalter (der Messpunkt liegt in mega38 A).
Element.prototype.scrollIntoView = (): void => {};

const ANTWORT_1 = {
  result: {
    answered: true,
    answer: "Ventil V4 wird jährlich geprüft.",
    knowledgeClass: "gesichert",
    trust: 90,
    sources: [],
    steps: [],
    demo: false,
    captionSources: [],
  },
  gap: null,
  receipt: "r1",
};

const FRAGE_1 = "Wie oft wird Ventil V4 geprüft?";
const FRAGE_2 = "Welcher Druck gilt für Leitung L7?";

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

describe("mega39 C · nach einem Fehler steht keine Antwort zu einer anderen Frage mehr da", () => {
  it("Antwort 1 erfolgreich → Frage 2 → Fehler: die alte Antwort ist WEG, nur die Meldung steht", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();

    // ── Frage 1, erfolgreich beantwortet ─────────────────────────────────────────────────────────
    await frageAbsenden(container, FRAGE_1);
    await act(async () => {
      steuer.offen[0]?.aufloesen(ANTWORT_1);
      await flush();
    });
    expect(container.textContent ?? "", "Antwort 1 ist gar nicht erst angekommen").toContain(
      ANTWORT_1.result.answer,
    );

    // ── Frage 2, abgewiesen ──────────────────────────────────────────────────────────────────────
    await frageAbsenden(container, FRAGE_2);
    await act(async () => {
      steuer.offen[1]?.abweisen(new Error("network"));
      await flush();
    });

    const text = container.textContent ?? "";
    // Die Fehlermeldung steht — das ist der richtige Teil aus mega38 A3.
    expect(container.querySelector('[data-testid="ask-error"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.error.title"));
    // UND: die Antwort auf Frage 1 steht NICHT mehr unter der neuen Frage.
    expect(
      text,
      "die alte Antwort steht unter der NEUEN Frage — schlimmer als eine reine Fehlermeldung",
    ).not.toContain(ANTWORT_1.result.answer);
    // Auch der Antwortvertrag („Gesichert"/Quellenbilanz) darf nicht stehen bleiben: er ist die
    // Einstufung DIESER alten Antwort und behauptete sonst etwas über die gescheiterte Frage.
    expect(text).not.toContain(i18n.t("ask.contract.label"));

    unmount();
  });

  it("beim START der zweiten Frage ist die erste Antwort schon weg — nicht erst nach dem Ausgang", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();

    await frageAbsenden(container, FRAGE_1);
    await act(async () => {
      steuer.offen[0]?.aufloesen(ANTWORT_1);
      await flush();
    });
    expect(container.textContent ?? "").toContain(ANTWORT_1.result.answer);

    // Frage 2 läuft noch (Vertrag offen) — hier darf die alte Antwort schon nicht mehr im DOM sein.
    await frageAbsenden(container, FRAGE_2);
    expect(container.querySelector('[data-testid="ask-pending"]')).not.toBeNull();
    expect(container.textContent ?? "").not.toContain(ANTWORT_1.result.answer);

    unmount();
  });

  it("der Export kann nach dem Fehler gar nichts Fremdes mehr mitnehmen (keine Export-Knöpfe)", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();

    await frageAbsenden(container, FRAGE_1);
    await act(async () => {
      steuer.offen[0]?.aufloesen(ANTWORT_1);
      await flush();
    });
    const knoepfeVorher = Array.from(container.querySelectorAll("button")).filter((b) =>
      (b.textContent ?? "").includes(i18n.t("ask.export.copy")),
    );
    expect(knoepfeVorher.length, "Export-Knöpfe fehlen schon vor dem Fehler").toBeGreaterThan(0);

    await frageAbsenden(container, FRAGE_2);
    await act(async () => {
      steuer.offen[1]?.abweisen(new Error("network"));
      await flush();
    });

    const knoepfeNachher = Array.from(container.querySelectorAll("button")).filter((b) =>
      (b.textContent ?? "").includes(i18n.t("ask.export.copy")),
    );
    expect(
      knoepfeNachher.length,
      "nach dem Fehler ist die alte Antwort noch exportierbar — als Antwort auf die neue Frage",
    ).toBe(0);

    unmount();
  });
});
