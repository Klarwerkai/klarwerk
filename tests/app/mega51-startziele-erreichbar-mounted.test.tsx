// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega51 BLOCK A1/A2 — DER VERHALTENSBEWEIS ZUM SAMMLER.
// ================================================================================================
// Der Sammler (mega51-startziele-erreichbar-sammler.test.ts) liest Quelltext. Er kann zeigen, dass
// kein Weg am Tor vorbeiführt — nicht, was eine Expertin tatsächlich vor sich sieht. Das hier ist
// der gemountete Fall an der ECHTEN Startseite, mit ECHTEN Signalen:
//
//   Rolle Experte  → die vier Controller-Ziele stehen mit ihrer wahren Zahl da, aber KEINES davon
//                    ist ein Link (kein <a href>), und die Sperre ist benannt („Kein Zugriff").
//   Rolle Admin    → dieselben Zeilen mit denselben Zahlen sind Links. Nichts ist entfernt.
//
// Das ist die Entscheidung zu A2 im Verhalten: die Zahl verschwindet nicht (sie ist wahr), sie
// hört auf, ein Weg zu sein.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hausform der rollengetriebenen Mount-Tests in diesem Repo (vgl. tests/library/library-rail-
// mounted.test.tsx): die Rolle kommt direkt aus dem gemockten RoleContext, nicht über den Umweg
// einer nachgebauten Sitzung.
const rolle = vi.hoisted(() => ({ current: "experte" as string }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  RoleProvider: ({ children }: { children: unknown }) => children,
  useRole: () => ({
    role: rolle.current,
    stufe2: false,
    setRole: () => {},
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
    previewActive: false,
  }),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Natascha", email: "n@x.de", role: rolle.current })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      analytics: { overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }) },
      // Echte Signale, damit alle vier Arbeitskategorien eine Zahl > 0 tragen.
      validation: { board: ok([{ id: "k1" }, { id: "k2" }]) },
      conflicts: { list: ok([{ id: "c1", status: "offen" }]) },
      lifecycle: { pending: ok(["k9"]) },
      gaps: { summary: ok({ open: 3, byPriority: { hoch: 3, mittel: 0, niedrig: 0 } }) },
      ko: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok(null) },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      reasoner: { config: ok(null), assistPresets: ok([]), status: ok(null) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(alsRolle: string): Promise<void> {
  rolle.current = alsRolle;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              NavGuardProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/start"] }, createElement(Start)),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

// Die Ziele der Arbeitsliste, die eine Expertin nicht öffnen darf.
const CONTROLLER_ZIELE = ["/konflikte", "/risiko", "/lebenszyklus", "/validierung"];

function hrefs(): string[] {
  return [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "");
}

function zielIstWeg(ziel: string): boolean {
  return hrefs().some((h) => (h.split("?")[0] ?? "") === ziel);
}

beforeEach(async () => {
  window.localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("mega51 A · die Startseite bietet einer Expertin keinen Weg an, den der Router zurückweist", () => {
  it("Experte: die vier Controller-Ziele sind KEINE Links mehr — die Zahlen bleiben stehen", async () => {
    await mount("experte");

    // Die Arbeitsliste ist wirklich da (sonst liefe die Prüfung still leer).
    expect(container.textContent).not.toContain(i18n.t("start.todoLoading"));
    expect(container.textContent).not.toContain(i18n.t("start.todoEmpty"));

    // A2: die Lage bleibt sichtbar — die echten Zahlen stehen weiter da, nur ohne Weg.
    const lagen = [...container.querySelectorAll("[data-role-no-reach]")].map(
      (e) => e.textContent ?? "",
    );
    expect(lagen.some((z) => z.includes(i18n.t("work.conflicts")) && z.includes("1"))).toBe(true);
    expect(lagen.some((z) => z.includes(i18n.t("work.validation")) && z.includes("2"))).toBe(true);

    // A1: und keines dieser Ziele ist ein anklickbarer Weg.
    for (const ziel of CONTROLLER_ZIELE) {
      expect(`${ziel} ist Weg: ${zielIstWeg(ziel)}`).toBe(`${ziel} ist Weg: false`);
    }

    // Kein stiller Fallback: die Sperre ist BENANNT, nicht nur ausgegraut.
    expect(container.textContent).toContain(i18n.t("roleLink.noReach"));
  });

  it("Admin: dieselben Zeilen mit denselben Zahlen sind Links — es ist nichts entfernt worden", async () => {
    await mount("admin");

    expect(container.textContent).toContain(i18n.t("work.conflicts"));
    expect(container.textContent).toContain(i18n.t("work.validation"));
    for (const ziel of CONTROLLER_ZIELE) {
      expect(`${ziel} ist Weg: ${zielIstWeg(ziel)}`).toBe(`${ziel} ist Weg: true`);
    }
    expect(container.querySelectorAll("[data-role-no-reach]").length).toBe(0);
    expect(container.textContent).not.toContain(i18n.t("roleLink.noReach"));
  });
});
