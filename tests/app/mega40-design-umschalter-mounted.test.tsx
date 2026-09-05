// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega40 BLOCK B + H4 → JOB 3060 · H1 — DER DESIGN-UMSCHALTER IM KONTO-MENÜ.
// ================================================================================================
//
// Pedi (28.07.): Die Web-Oberfläche bekommt ein zweites, umschaltbares Design („Modern“, die
// Werkbank-Sprache). Pedi (04.09., JOB 3060): Modern ist die VORGABE für alle; Klassisch bleibt
// wählbar. Der Schalter verlässt die Kopfzeile (dort steht nur noch das Kopfband) und wohnt als
// Zeile „Darstellung“ im Konto-Menü — für ALLE Rollen; dieser Test fährt deshalb bewusst die Rolle
// „viewer“, die kleinste. (Endort /profil liegt bei JOB 3065, das auf diesen Auftrag wartet.)
//
// Was hier gepinnt wird:
//  · B: Der Button existiert, trägt `aria-pressed`, sein Klick setzt/entfernt `data-theme="modern"`
//    am <html>-Element — und NUR dort. OHNE Klick trägt <html> data-theme="modern" (die Vorgabe,
//    Lieferung 4); Klassisch heißt weiterhin „kein Attribut“.
//  · B: Die Wahl überlebt einen Remount (localStorage), und ein kaputter/verweigerter Speicher
//    stürzt nichts ab — die Wahl lebt dann in der Sitzung (In-Memory-Rückfall).
//  · B: Der Umschalter läuft NICHT durch den NavGuard — bei ungespeicherter Eingabe erscheint
//    KEIN Bestätigungsdialog, der Ort wechselt nicht, und das Theme wechselt trotzdem.
//  · H4: echter Tab-Stopp, native Button-Semantik (Tagname BUTTON, type="button", kein tabIndex=-1).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Vera Viewer", email: "v@x.de", role: "viewer" })),
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
      config: vi.fn(async () => ({})),
      status: vi.fn(async () => ({
        active: false,
        mode: "none",
        reachable: "unknown",
        tasks: {},
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

// Die KLEINSTE Rolle: der Umschalter ist Anwender-Komfort, kein Admin-Werkzeug.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({
    role: "viewer",
    setRole: () => {},
    stufe2: false,
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
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
import { DESIGN_THEME_STORAGE_KEY } from "../../apps/web/src/lib/designTheme";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Eine Seite mit ungespeicherter Eingabe — der schärfste Fall für „kein NavGuard, kein Dirty“.
function SchmutzigeSeite(): null {
  const { setGuard } = useNavGuard();
  useEffect(() => {
    setGuard({ isDirty: () => true, save: async () => {} });
    return () => setGuard(null);
  }, [setGuard]);
  return null;
}

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
  // Das Konto-Menü öffnen — dort wohnt die Zeile „Darstellung“.
  const konto = container.querySelector<HTMLButtonElement>('[data-testid="kopfband-konto"]');
  if (!konto) {
    throw new Error("Konto-Kreis nicht gefunden");
  }
  await act(async () => {
    konto.click();
    await flush();
  });
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

// Der Umschalter ist der EINE Button des Konto-Menüs mit aria-pressed — ein Toggle, kein Link.
function designButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(
    '[data-testid="konto-menue"] button[aria-pressed]',
  );
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await flush();
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

describe("mega40 B → H1 · der Design-Umschalter im Konto-Menü", () => {
  it("existiert als echter Button mit aria-pressed — sichtbar auch für die kleinste Rolle, in der Zeile „Darstellung“", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountKopfband();
    const btn = designButton(container);
    expect(btn, "Kein Umschalt-Button (button[aria-pressed]) im Konto-Menü").toBeTruthy();
    // Native Button-Semantik statt role-Nachbau: Enter/Leertaste aktivieren per HTML-Spezifikation.
    expect(btn?.tagName).toBe("BUTTON");
    expect(btn?.getAttribute("type")).toBe("button");
    // H4: echter Tab-Stopp (Fokusreihenfolge), nicht aus der Reihe genommen.
    expect(btn?.tabIndex).toBe(0);
    // Die Zeile heißt „Darstellung“ — der Endort /profil trägt dieselbe Überschrift.
    expect(btn?.parentElement?.textContent).toContain(i18n.t("menue.darstellung"));
    // VORGABE (JOB 3060, Lieferung 4): Modern — gedrückt, data-theme="modern" am <html>.
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
    expect(btn?.textContent).toContain(i18n.t("topbar.design.modern"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("modern");
    // Und der Umschalter ist NICHT im Kopfband selbst — er steht im Menü.
    expect(container.querySelector("header > * > button[aria-pressed]")).toBeNull();
    unmount();
  });

  it("Klick schaltet um: Klassisch = KEIN data-theme am <html>, aria-pressed wechselt, Beschriftung folgt", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountKopfband();
    const btn = designButton(container);
    expect(btn).toBeTruthy();
    if (!btn) {
      return;
    }
    await click(btn);
    // Klassisch heißt weiterhin: das Attribut verschwindet VOLLSTÄNDIG.
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.textContent).toContain(i18n.t("topbar.design.classic"));
    // Und zurück auf Modern.
    await click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("modern");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    unmount();
  });

  it("die Wahl übersteht einen Remount (Persistenz je Browser) — Klassisch bleibt gespeichert", async () => {
    await i18n.changeLanguage("de");
    const erste = await mountKopfband();
    const btn = designButton(erste.container);
    expect(btn).toBeTruthy();
    if (!btn) {
      return;
    }
    await click(btn);
    expect(localStorage.getItem(DESIGN_THEME_STORAGE_KEY)).toBe("classic");
    erste.unmount();
    document.documentElement.setAttribute("data-theme", "modern");

    const zweite = await mountKopfband();
    const btn2 = designButton(zweite.container);
    expect(btn2?.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    zweite.unmount();
  });

  it("läuft NICHT durch den NavGuard: kein Dialog trotz Dirty, Ort bleibt, Theme wechselt trotzdem", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountKopfband();
    const btn = designButton(container);
    expect(btn).toBeTruthy();
    if (!btn) {
      return;
    }
    await click(btn);
    expect(
      document.body.textContent ?? "",
      "Der Design-Umschalter hat den Ungespeichert-Dialog ausgelöst — er ist keine Navigation",
    ).not.toContain(i18n.t("nav.guard.title"));
    expect(ort(container)).toBe("/erfassen");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    unmount();
  });

  it("H4: per Tastatur fokussierbar und auf dem fokussierten Element aktivierbar", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountKopfband();
    const btn = designButton(container);
    expect(btn).toBeTruthy();
    if (!btn) {
      return;
    }
    btn.focus();
    expect(document.activeElement).toBe(btn);
    // Aktivierung auf dem FOKUSSIERTEN Element (Enter/Leertaste feuern bei nativen Buttons click;
    // jsdom synthetisiert das nicht — die native Semantik ist oben gepinnt).
    await click(btn);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    unmount();
  });

  it("kaputter Speicher: Umschalten stürzt nicht ab, die Wahl lebt in der Sitzung weiter", async () => {
    await i18n.changeLanguage("de");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded (Probe)");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError (Probe)");
    });
    const { container, unmount } = await mountKopfband();
    const btn = designButton(container);
    // Ohne lesbaren Speicher gilt die Vorgabe: Modern.
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
    if (!btn) {
      return;
    }
    await click(btn);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    unmount();
  });
});
