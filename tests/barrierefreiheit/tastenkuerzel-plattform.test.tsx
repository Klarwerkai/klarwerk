// @vitest-environment jsdom
// ================================================================================================
// R-0987 · TASTENKÜRZEL KENNT SEINE PLATTFORM.
// ================================================================================================
//
// ZIELZUSTAND (Auftrag aufnahme:20260922:gesamt-barrierefreiheit): „Angezeigte Tastenkombinationen
// richten sich nach dem Betriebssystem des Anwenders, statt immer dieselbe Taste zu nennen."
//
// VORHER stand an jedem Anzeigeort fest „⌘K" — am Kopfband-Knopf „Seite finden", an der Zeile unter
// „Arbeitsbereiche" und im Platzhalter der Palette. Auf Windows und Linux gibt es keine ⌘-Taste.
//
// GEMESSEN WIRD
//   P1  die Plattformerkennung an echten Agentenangaben — einschliesslich der Falle, dass jeder
//       Chromium-Agent „AppleWebKit" nennt, auch unter Windows und Linux
//   P2  der angezeigte Text je Plattform und Sprache
//   P3  am ECHTEN Kopfband und an der ECHTEN Palette: auf einem Mac „⌘K", auf Windows „Strg+K" —
//       am Knopf UND im Platzhalter; und auf Windows steht nirgends mehr ein „⌘"
//   P4  der Tastaturweg bleibt: Strg+K öffnet die Palette weiterhin (nur die Anzeige ändert sich)
//
// GRENZE: Ob ein Mensch mit Windows-Tastatur das Kürzel wiedererkennt, ist eine Bedienfrage — hier
// ist die angezeigte Zeichenfolge belegt, nicht ihre Wahrnehmung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { board: ok([]) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      gaps: { summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }) },
      lifecycle: { pending: ok([]) },
      notifications: { list: ok([]), markSeen: ok({ unseenCount: 0 }) },
      features: { get: ok({ features: {} }) },
      reasoner: {
        status: ok({ active: false, mode: "none", reachable: "unknown", tasks: {} }),
        config: ok(null),
      },
      external: { policy: ok({ stage: "blocked" }) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { kuerzelText, plattformAus } from "../../apps/web/src/lib/tastenkuerzel";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Echte Agentenangaben, wie Browser sie melden.
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const CHROME_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("R-0987 · P1 · die Plattform wird aus den Angaben des Browsers gelesen", () => {
  it("Mac und iPhone sind Apple — über platform wie über den User-Agent", () => {
    expect(plattformAus({ platform: "MacIntel" })).toBe("apple");
    expect(plattformAus({ platform: "iPhone" })).toBe("apple");
    expect(plattformAus({ userAgent: CHROME_MAC })).toBe("apple");
    expect(plattformAus({ userAgent: SAFARI_IPHONE })).toBe("apple");
    expect(plattformAus({ userAgentData: { platform: "macOS" } })).toBe("apple");
  });

  it("Windows und Linux sind es nicht — obwohl ihr Agent „AppleWebKit“ nennt", () => {
    // Die Falle, an der eine Suche nach „Apple" scheitern würde.
    expect(CHROME_WINDOWS).toContain("AppleWebKit");
    expect(plattformAus({ userAgent: CHROME_WINDOWS })).toBe("andere");
    expect(plattformAus({ userAgent: CHROME_LINUX })).toBe("andere");
    expect(plattformAus({ platform: "Win32" })).toBe("andere");
    expect(plattformAus({ platform: "Linux x86_64" })).toBe("andere");
    expect(plattformAus({ userAgentData: { platform: "Windows" } })).toBe("andere");
  });

  it("die genaueste Angabe gewinnt: userAgentData vor platform vor User-Agent", () => {
    expect(plattformAus({ userAgentData: { platform: "Windows" }, userAgent: CHROME_MAC })).toBe(
      "andere",
    );
    expect(plattformAus({ platform: "MacIntel", userAgent: CHROME_WINDOWS })).toBe("apple");
  });

  it("ohne jede Angabe: keine Apple-Taste behauptet", () => {
    expect(plattformAus(undefined)).toBe("andere");
    expect(plattformAus({})).toBe("andere");
  });
});

describe("R-0987 · P2 · der angezeigte Text je Plattform und Sprache", () => {
  it("Apple: ⌘K in jeder Sprache", () => {
    for (const sprache of ["de", "en", "nl"]) {
      expect(kuerzelText("K", sprache, "apple")).toBe("⌘K");
    }
  });

  it("sonst: Strg+K auf Deutsch, Ctrl+K auf Englisch und Niederländisch", () => {
    expect(kuerzelText("K", "de", "andere")).toBe("Strg+K");
    expect(kuerzelText("K", "en", "andere")).toBe("Ctrl+K");
    expect(kuerzelText("K", "nl", "andere")).toBe("Ctrl+K");
  });
});

// ------------------------------------------------------------------------------------------------
// P3/P4 — am echten Kopfband und an der echten Palette, mit gesetzter Plattform.
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

/** Setzt `navigator.platform` für diesen Fall — jsdom selbst meldet einen leeren Wert. */
function setzePlattform(wert: string): void {
  Object.defineProperty(window.navigator, "platform", { value: wert, configurable: true });
}

async function montiere(): Promise<void> {
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
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/start"] },
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(ModalBoundaryProvider, {
                    hostRef: { current: null },
                    children: [
                      createElement(Kopfband, { key: "band" }),
                      createElement(CommandPalette, { key: "palette" }),
                    ],
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
}

function knopfText(): string {
  const el = container.querySelector('[data-testid="kopfband-gehezu"]');
  if (!el) {
    throw new Error("der Knopf „Seite finden“ fehlt im Kopfband");
  }
  return el.textContent ?? "";
}

function paletteFeld(): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(
    `input[aria-label="${i18n.t("fe002.seiteFinden")}"]`,
  );
}

async function oeffnePerTaste(taste: { metaKey?: boolean; ctrlKey?: boolean }): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ...taste, bubbles: true, cancelable: true }),
    );
  });
  await flush();
}

describe("R-0987 · P3 · am echten Kopfband und in der echten Palette", () => {
  // Auf- und Abbau NUR hier: P1/P2 montieren nichts, ein Abbau dort hätte keinen Baum.
  beforeEach(async () => {
    await i18n.changeLanguage("de");
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    // Die eigene Eigenschaft wieder entfernen — dann gilt wieder der Wert von jsdom.
    Reflect.deleteProperty(window.navigator, "platform");
    vi.clearAllMocks();
  });

  it("auf einem Mac: ⌘K am Knopf und im Platzhalter", async () => {
    setzePlattform("MacIntel");
    await montiere();
    expect(knopfText()).toContain("⌘K");
    expect(knopfText()).not.toContain("Strg");

    await oeffnePerTaste({ metaKey: true });
    expect(paletteFeld(), "⌘K öffnet die Palette nicht").not.toBeNull();
    expect(paletteFeld()?.getAttribute("placeholder")).toBe(
      `${i18n.t("fe002.seiteFindenMenue")} (⌘K)`,
    );
  });

  it("auf Windows: Strg+K am Knopf und im Platzhalter — und nirgends ein ⌘", async () => {
    setzePlattform("Win32");
    await montiere();
    expect(knopfText()).toContain("Strg+K");
    expect(knopfText(), "Windows bekommt die Apple-Taste angezeigt").not.toContain("⌘");

    // P4: Der Tastaturweg ist unverändert — Strg+K öffnet weiterhin.
    await oeffnePerTaste({ ctrlKey: true });
    expect(paletteFeld(), "Strg+K öffnet die Palette nicht mehr").not.toBeNull();
    expect(paletteFeld()?.getAttribute("placeholder")).toBe(
      `${i18n.t("fe002.seiteFindenMenue")} (Strg+K)`,
    );
    const band = container.querySelector('[data-testid="kopfband"]');
    expect(band, "das Kopfband fehlt").not.toBeNull();
    expect(band?.textContent ?? "").not.toContain("⌘");
  });

  it("auf Windows in Englisch: Ctrl+K", async () => {
    await i18n.changeLanguage("en");
    setzePlattform("Win32");
    await montiere();
    expect(knopfText()).toContain("Ctrl+K");
    expect(knopfText()).not.toContain("⌘");
  });
});
