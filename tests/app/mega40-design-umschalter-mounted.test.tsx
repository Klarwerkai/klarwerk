// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega40 BLOCK B + H4 — DER DESIGN-UMSCHALTER IN DER KOPFZEILE.
// ================================================================================================
//
// Pedi (28.07.): Die Web-Oberfläche bekommt ein zweites, umschaltbares Design („Modern", die
// Werkbank-Sprache). Der Schalter sitzt in der Topbar, ist ein ECHTER Button (keine Navigation),
// sichtbar für ALLE Rollen — dieser Test fährt deshalb bewusst die Rolle „viewer", die kleinste.
//
// Was hier gepinnt wird:
//  · B: Der Button existiert, trägt `aria-pressed`, sein Klick setzt/entfernt `data-theme="modern"`
//    am <html>-Element — und NUR dort. Ohne Klick trägt <html> KEIN data-theme (der Standard darf
//    sich nicht ändern; am Freitag sitzt eine Testerin vor dem Produkt).
//  · B: Die Wahl überlebt einen Remount (localStorage), und ein kaputter/verweigerter Speicher
//    stürzt nichts ab — die Wahl lebt dann in der Sitzung (In-Memory-Rückfall der bestehenden
//    persistentToggle-Grenze).
//  · B: Der Umschalter läuft NICHT durch den NavGuard — bei ungespeicherter Eingabe erscheint
//    KEIN Bestätigungsdialog, der Ort wechselt nicht, und das Theme wechselt trotzdem.
//  · H4: Fokusreihenfolge (echter Tab-Stopp), Bedienung mit Enter/Leertaste. jsdom synthetisiert
//    für native Buttons keinen Klick aus Tastendrücken — deshalb pinnt der Test die NATIVE
//    Button-Semantik (Tagname BUTTON, type="button", kein role-Nachbau, kein tabIndex=-1), die
//    Enter/Leertaste per HTML-Spezifikation aktiviert, und löst die Aktivierung auf dem per
//    Tastatur FOKUSSIERTEN Element aus.
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import i18n from "../../apps/web/src/i18n";
import { DESIGN_THEME_STORAGE_KEY } from "../../apps/web/src/lib/designTheme";
import { Topbar } from "../../apps/web/src/shell/Topbar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Eine Seite mit ungespeicherter Eingabe — der schärfste Fall für „kein NavGuard, kein Dirty".
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

// Der Umschalter ist der EINE Button der Leiste mit aria-pressed — ein Toggle, kein Link.
function designButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>("button[aria-pressed]");
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

describe("mega40 B · der Design-Umschalter in der Kopfzeile", () => {
  it("existiert als echter Button mit aria-pressed — sichtbar auch für die kleinste Rolle", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountTopbar();
    const btn = designButton(container);
    expect(btn, "Kein Umschalt-Button (button[aria-pressed]) in der Topbar").toBeTruthy();
    // Native Button-Semantik statt role-Nachbau: Enter/Leertaste aktivieren per HTML-Spezifikation.
    expect(btn?.tagName).toBe("BUTTON");
    expect(btn?.getAttribute("type")).toBe("button");
    // H4: echter Tab-Stopp (Fokusreihenfolge), nicht aus der Reihe genommen.
    expect(btn?.tabIndex).toBe(0);
    // Standard: Klassisch — nicht gedrückt, KEIN data-theme am <html>.
    expect(btn?.getAttribute("aria-pressed")).toBe("false");
    expect(btn?.textContent).toContain(i18n.t("topbar.design.classic"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    unmount();
  });

  it("Klick schaltet um: data-theme=modern am <html>, aria-pressed wechselt, Beschriftung folgt", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountTopbar();
    const btn = designButton(container);
    expect(btn).toBeTruthy();
    if (!btn) {
      return;
    }
    await click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("modern");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.textContent).toContain(i18n.t("topbar.design.modern"));
    // Und zurück: das Attribut verschwindet VOLLSTÄNDIG (Standard = kein Attribut).
    await click(btn);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    unmount();
  });

  it("die Wahl übersteht einen Remount (Persistenz je Browser)", async () => {
    await i18n.changeLanguage("de");
    const erste = await mountTopbar();
    const btn = designButton(erste.container);
    expect(btn).toBeTruthy();
    if (!btn) {
      return;
    }
    await click(btn);
    expect(localStorage.getItem(DESIGN_THEME_STORAGE_KEY)).toBe("modern");
    erste.unmount();
    document.documentElement.removeAttribute("data-theme");

    const zweite = await mountTopbar();
    const btn2 = designButton(zweite.container);
    expect(btn2?.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("modern");
    zweite.unmount();
  });

  it("läuft NICHT durch den NavGuard: kein Dialog trotz Dirty, Ort bleibt, Theme wechselt trotzdem", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountTopbar();
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
    expect(document.documentElement.getAttribute("data-theme")).toBe("modern");
    unmount();
  });

  it("H4: per Tastatur fokussierbar und auf dem fokussierten Element aktivierbar", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountTopbar();
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
    expect(document.documentElement.getAttribute("data-theme")).toBe("modern");
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
    const { container, unmount } = await mountTopbar();
    const btn = designButton(container);
    expect(btn?.getAttribute("aria-pressed")).toBe("false");
    if (!btn) {
      return;
    }
    await click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("modern");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    unmount();
  });
});
