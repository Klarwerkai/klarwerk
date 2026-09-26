// @vitest-environment jsdom
// ================================================================================================
// Auftrag aufnahme:20260922:gesamt-ansicht-merken (R-0889, package:ansichten) — „Fällt der
// Browserspeicher aus, funktioniert die Anwendung trotzdem vollständig."
// ================================================================================================
// Sortierung, Filter-Auf/Zu und gespeicherte Sichten lesen den Speicher über die fehlertolerante
// Grenze (`lib/persistentToggle.ts` → `safeLocalStorage`; Sichten: A11 in
// `tests/bibliothek-sichten/sichten-mounted.test.tsx`). Die beiden „schon gesehen"-Merker der
// Startseite (`klarwerk.start.orientationSeen`, `klarwerk.admin.firstRunSeen`) griffen dagegen
// ungeschützt auf `window.localStorage` zu: war schon das ERMITTELN des Speichers gesperrt, warf die
// Startseite beim Rendern. Dieser Test hält den Ausfall an der echten Startseite und an der echten
// Erststart-Karte fest.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rolle = vi.hoisted(() => ({ current: "admin" as string }));

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
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: rolle.current })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      analytics: { overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }) },
      validation: { board: ok([{ id: "k1" }]) },
      conflicts: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: { summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }) },
      ko: {
        list: ok([{ id: "ko-1", title: "Ventil V1 prüfen", status: "validiert", author: "u1" }]),
      },
      learningPaths: { byRole: ok(null), progress: ok(null) },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      notifications: { list: ok([]) },
      duplicateSignal: { list: ok([]) },
      reasoner: { config: ok(null), assistPresets: ok([]), status: ok(null) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import type { ReactNode } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { AdminFirstRunCard } from "../../apps/web/src/components/AdminFirstRunCard";
import i18n from "../../apps/web/src/i18n";
import { isAdminFirstRun, markAdminFirstRunSeen } from "../../apps/web/src/lib/adminFirstRun";
import { safeLocalStorage } from "../../apps/web/src/lib/persistentToggle";
import {
  isStartOrientationFirstRun,
  markStartOrientationSeen,
} from "../../apps/web/src/lib/startOrientation";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(inhalt: ReactNode): Promise<void> {
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
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              NavGuardProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/start"] }, inhalt),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

// Schon das Ermitteln des Speichers wirft (Browser-/Origin-Policy) — derselbe Fall wie A11.
function speicherGesperrt(): void {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Zugriff gesperrt", "SecurityError");
  });
}

function werfenderSpeicher(): Storage {
  return {
    getItem: () => {
      throw new DOMException("gesperrt", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("voll", "QuotaExceededError");
    },
  } as unknown as Storage;
}

beforeEach(async () => {
  rolle.current = "admin";
  window.localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    container.remove();
  }
  vi.restoreAllMocks();
});

describe("„schon gesehen“-Merker ohne Browserspeicher", () => {
  it("M1 · fehlender oder werfender Speicher: gilt als gesehen, Schreiben bleibt still", () => {
    expect(isAdminFirstRun(undefined)).toBe(false);
    expect(isAdminFirstRun(werfenderSpeicher())).toBe(false);
    expect(() => markAdminFirstRunSeen(undefined, "2026-09-26T00:00:00.000Z")).not.toThrow();
    expect(() =>
      markAdminFirstRunSeen(werfenderSpeicher(), "2026-09-26T00:00:00.000Z"),
    ).not.toThrow();
    expect(isStartOrientationFirstRun(undefined)).toBe(false);
    expect(() => markStartOrientationSeen(undefined)).not.toThrow();
  });

  it("M2 · die Sperre trifft auch die Grenze, über die die Startseite jetzt liest", () => {
    speicherGesperrt();
    expect(safeLocalStorage()).toBeUndefined();
  });

  it("M3 · Startseite rendert mit gesperrtem Speicher vollständig (Admin, wiederkehrend)", async () => {
    speicherGesperrt();
    await mount(createElement(Start));
    expect(
      container.querySelectorAll('[data-testid="h5-fuerdich-zeile"]').length,
      "die Karte „FÜR DICH“ fehlt — die Startseite ist nicht gerendert",
    ).toBeGreaterThan(0);
  });

  it("M4 · Erststart-Karte: mit Speicher sichtbar und dauerhaft ausblendbar", async () => {
    await mount(createElement(AdminFirstRunCard));
    expect(container.textContent).toContain(i18n.t("adm.firstrun.title"));
    const knopf = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === i18n.t("adm.firstrun.dismiss"),
    );
    expect(knopf).toBeDefined();
    await act(async () => knopf?.click());
    expect(container.textContent).not.toContain(i18n.t("adm.firstrun.title"));
    expect(isAdminFirstRun(window.localStorage)).toBe(false);
  });

  it("M5 · Erststart-Karte: gesperrter Speicher bricht nichts ab", async () => {
    speicherGesperrt();
    await mount(createElement(AdminFirstRunCard));
    expect(container.textContent).not.toContain(i18n.t("adm.firstrun.title"));
  });

  it("M6 · Erststart-Karte: verweigertes Schreiben blendet trotzdem für diese Sitzung aus", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("voll", "QuotaExceededError");
    });
    await mount(createElement(AdminFirstRunCard));
    const knopf = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === i18n.t("adm.firstrun.dismiss"),
    );
    expect(knopf).toBeDefined();
    await act(async () => knopf?.click());
    expect(container.textContent).not.toContain(i18n.t("adm.firstrun.title"));
  });
});
