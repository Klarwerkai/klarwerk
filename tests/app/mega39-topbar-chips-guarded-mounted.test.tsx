// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega39 BLOCK B — DIE DREI STATUS-CHIPS MÜSSEN DURCH DEN WÄCHTER.
// ================================================================================================
//
// DER BEFUND (ben, sammel37-mega38): mega38 BLOCK H hat die drei Betriebs-Chips der Topbar von
// stummen `div`s zu anklickbaren Zielen gemacht — als ROHE `Link`s nach `/admin`
// (`ReasonerStatusPill`, `ExternalStagePill`, `KiModePill`). Ein roher `Link` ruft `guard()` nicht;
// die Shell-Grenze im selben Produkt (app/NavGuardContext.tsx) verlangt dafür `GuardedLink` bzw.
// `useGuardedNavigate`.
//
// FOLGE: Ein Admin, der gerade auf `/erfassen` schreibt, klickt einen Statuschip — und ist ohne
// Speichern-Frage in der Verwaltung. Das ist ein NEUER Datenverlust-Ausgang, dieselbe Klasse wie
// der Canvas-Drop aus SCRUM-466. Und er trifft ausgerechnet Aufgabe 2 der Testerin.
//
// Dieser Test fährt die ECHTE Topbar mit einem AKTIVEN Dirty-Wächter und verlangt für jeden der
// drei Chips: der Bestätigungsdialog erscheint, und der Ort wechselt NICHT.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    notifications: {
      list: vi.fn(async () => []),
      markSeen: vi.fn(async () => ({})),
    },
    reasoner: {
      // Admin-Sicht: echte Konfiguration (die Pille zeigt den Modus).
      config: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        provider: "anthropic",
        model: "claude-sonnet",
        tasks: ["answer"],
        effectiveProvider: { answer: "cloud" },
      })),
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    external: {
      policy: vi.fn(async () => ({ stage: "blocked" })),
    },
  },
}));

// Die Rolle kommt in diesem Test fest von aussen: geprüft wird der ADMIN-Fall (nur dort sind die
// drei Chips überhaupt gemountet — mega38 BLOCK H).
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({
    role: "admin",
    setRole: () => {},
    stufe2: true,
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: true,
    previewActive: false,
  }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Topbar } from "../../apps/web/src/shell/Topbar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Eine Seite mit ungespeicherter Eingabe — genau das, was eine Erfassungsseite anmeldet.
function SchmutzigeSeite(): null {
  const { setGuard } = useNavGuard();
  useEffect(() => {
    setGuard({ isDirty: () => true, save: async () => {} });
    return () => setGuard(null);
  }, [setGuard]);
  return null;
}

// Der Ortsanzeiger: er belegt, ob der Wechsel tatsächlich stattgefunden hat.
function OrtsAnzeige(): JSX.Element {
  const location = useLocation();
  return createElement("span", { "data-testid": "ort" }, location.pathname);
}

async function mountTopbar(): Promise<{ container: HTMLElement; unmount: () => void }> {
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
        // JOB 2709 D4 (Huelle mitgezogen): Die Glocke in der Topbar meldet einen fehlgeschlagenen
        // Gelesen-Status jetzt sichtbar und braucht dafuer `useToast`. In der echten App ist der
        // Provider IMMER da (`AppShell.tsx`); eine Testhuelle ohne ihn bildete einen Zustand ab,
        // den es im Produkt nicht gibt. Was dieser Test misst, bleibt unveraendert.
        createElement(
          ToastProvider,
          null,
          createElement(
            MemoryRouter,
            { initialEntries: ["/erfassen"] },
            createElement(
              NavGuardProvider,
              null,
              createElement(SchmutzigeSeite),
              createElement(OrtsAnzeige),
              createElement(Topbar),
            ),
          ),
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

const ort = (container: HTMLElement): string =>
  container.querySelector('[data-testid="ort"]')?.textContent ?? "";

// Die drei Chips sind die Anker mit Ziel /admin in der Topbar.
function adminChips(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href="/admin"]'));
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega39 B · die drei Betriebs-Chips der Topbar laufen durch den Ungespeichert-Wächter", () => {
  it("alle drei Chips sind überhaupt gemountet (sonst prüfte der Test unten nichts)", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountTopbar();
    // KI-Modus · Reasoner-Erreichbarkeit · Externe Stufe.
    expect(adminChips(container).length).toBe(3);
    expect(ort(container)).toBe("/erfassen");
    unmount();
  });

  for (const index of [0, 1, 2]) {
    it(`Chip ${index + 1}: Klick bei ungespeicherter Eingabe fragt nach — und wechselt NICHT`, async () => {
      await i18n.changeLanguage("de");
      const { container, unmount } = await mountTopbar();

      const chip = adminChips(container)[index];
      expect(chip, `Chip ${index + 1} nicht gefunden`).toBeTruthy();

      await act(async () => {
        chip?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
        );
        await flush();
      });

      // 1) Der Dialog steht — der Wächter wurde also überhaupt gefragt.
      expect(
        document.body.textContent ?? "",
        `Chip ${index + 1} ging am Wächter vorbei (kein Dialog)`,
      ).toContain(i18n.t("nav.guard.title"));
      // 2) Und der Ort ist derselbe — nichts ist verloren gegangen.
      expect(ort(container), `Chip ${index + 1} hat trotz Dirty-Guard gewechselt`).toBe(
        "/erfassen",
      );

      unmount();
    });
  }
});
