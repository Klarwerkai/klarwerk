// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega39 BLOCK B → JOB 3060 · H1 — DIE STATUS-ZEILEN MÜSSEN DURCH DEN WÄCHTER.
// ================================================================================================
//
// DER BEFUND (ben, sammel37-mega38): mega38 BLOCK H hat die drei Betriebs-Chips der Topbar von
// stummen `div`s zu anklickbaren Zielen gemacht — als ROHE `Link`s nach `/admin`. Ein roher `Link`
// ruft `guard()` nicht; die Shell-Grenze im selben Produkt (app/NavGuardContext.tsx) verlangt dafür
// `GuardedLink` bzw. `useGuardedNavigate`.
//
// FOLGE: Ein Admin, der gerade auf `/erfassen` schreibt, klickt einen Statuschip — und ist ohne
// Speichern-Frage in der Verwaltung. Das ist ein Datenverlust-Ausgang, dieselbe Klasse wie der
// Canvas-Drop aus SCRUM-466.
//
// JOB 3060 · H1: die drei Chips sind Zeilen im Zahnrad-Menü (shell/StatusZeilen.tsx: KI, Reasoner,
// Extern), dazu die Zeile „Einstellungen“ — VIER Wege nach /admin, alle über `GuardedLink`. Dieser
// Test fährt das ECHTE Kopfband mit einem AKTIVEN Dirty-Wächter und verlangt für jeden der vier:
// der Bestätigungsdialog erscheint, und der Ort wechselt NICHT.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Anna Admin", email: "a@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    notifications: {
      list: vi.fn(async () => []),
      markSeen: vi.fn(async () => ({})),
    },
    reasoner: {
      // Admin-Sicht: echte Konfiguration (die Zeile zeigt den Modus).
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
    validation: { board: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: {} })) },
    lifecycle: { pending: vi.fn(async () => []) },
    features: { get: vi.fn(async () => ({ features: {} })) },
  },
}));

// Die Rolle kommt in diesem Test fest von aussen: geprüft wird der ADMIN-Fall (nur dort sind die
// Status-Zeilen überhaupt gemountet — mega38 BLOCK H).
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

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

async function mountKopfband(): Promise<{ container: HTMLElement; unmount: () => void }> {
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
          AuthProvider,
          null,
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
                createElement(Kopfband),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  // Das Zahnrad-Menü öffnen — dort stehen Einstellungen und die drei Status-Zeilen.
  const zahnrad = container.querySelector<HTMLButtonElement>('[data-testid="kopfband-zahnrad"]');
  if (!zahnrad) {
    throw new Error("Zahnrad nicht gefunden");
  }
  await act(async () => {
    zahnrad.click();
    await flush();
  });
  // Die Status-Zeilen fragen ihre Quellen erst beim Öffnen — einmal zur Ruhe kommen lassen.
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

// Die vier Wege nach /admin im Zahnrad-Menü: Einstellungen · KI · Reasoner · Extern.
function adminZeilen(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>('[data-testid="zahnrad-menue"] a[href="/admin"]'),
  );
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega39 B → H1 · die Zeilen nach /admin im Zahnrad-Menü laufen durch den Ungespeichert-Wächter", () => {
  it("alle vier Zeilen sind gemountet (sonst prüfte der Test unten nichts) — Einstellungen, KI, Reasoner, Extern", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountKopfband();
    expect(adminZeilen(container).length).toBe(4);
    expect(container.querySelector('[data-testid="status-ki"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="status-reasoner"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="status-extern"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="zahnrad-einstellungen"]')).not.toBeNull();
    // Und die Zeilen tragen weiter den Klartext-Tooltip, der VORN mit dem einfachen Satz beginnt.
    expect(container.querySelector('[data-testid="status-ki"]')?.getAttribute("title")).toContain(
      i18n.t("topbar.plain.ki"),
    );
    expect(ort(container)).toBe("/erfassen");
    unmount();
  });

  for (const index of [0, 1, 2, 3]) {
    it(`Zeile ${index + 1}: Klick bei ungespeicherter Eingabe fragt nach — und wechselt NICHT`, async () => {
      await i18n.changeLanguage("de");
      const { container, unmount } = await mountKopfband();

      const zeile = adminZeilen(container)[index];
      expect(zeile, `Zeile ${index + 1} nicht gefunden`).toBeTruthy();

      await act(async () => {
        zeile?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
        );
        await flush();
      });

      // 1) Der Dialog steht — der Wächter wurde also überhaupt gefragt.
      expect(
        document.body.textContent ?? "",
        `Zeile ${index + 1} ging am Wächter vorbei (kein Dialog)`,
      ).toContain(i18n.t("nav.guard.title"));
      // 2) Und der Ort ist derselbe — nichts ist verloren gegangen.
      expect(ort(container), `Zeile ${index + 1} hat trotz Dirty-Guard gewechselt`).toBe(
        "/erfassen",
      );

      unmount();
    });
  }
});
