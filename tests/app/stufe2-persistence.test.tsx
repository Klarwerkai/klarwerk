// @vitest-environment jsdom
// WP-SHIP9-S2 Paket 4 (W1): der Stufe-2-Umschalter überlebt Reload/Direktaufruf. Persistenz via
// localStorage (SSR-sicher), gelesen im useState-Initializer der RoleProvider — also VOR der ersten
// Routen-Entscheidung (kein Karten-Aufblitzen). Das harte Rollen-Gate (nur Admin) bleibt unberührt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u1", name: "Pedi", role: "admin" })),
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { readStufe2, writeStufe2 } from "../../apps/web/src/lib/stufe2Storage";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = "kw.stufe2.v1";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("W1 · stufe2Storage (pur, SSR-sicher)", () => {
  beforeEach(() => window.localStorage.clear());

  it("Standard aus; schreiben/lesen ist ein sauberer Roundtrip", () => {
    expect(readStufe2()).toBe(false);
    writeStufe2(true);
    expect(window.localStorage.getItem(KEY)).toBe("1");
    expect(readStufe2()).toBe(true);
    writeStufe2(false);
    expect(readStufe2()).toBe(false);
  });
});

describe("W1 · RoleProvider persistiert den Stufe-2-Toggle", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  function Probe(): JSX.Element {
    const { stufe2, setStufe2 } = useRole();
    return createElement(
      "div",
      null,
      createElement("span", null, stufe2 ? "S2:on" : "S2:off"),
      createElement("button", { onClick: () => setStufe2(true) }, "enable"),
      createElement("button", { onClick: () => setStufe2(false) }, "disable"),
    );
  }

  async function mountAndResolveAdmin(): Promise<void> {
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
            AuthProvider,
            null,
            createElement(RoleProvider, null, createElement(Probe)),
          ),
        ),
      );
    });
    // Session auflösen lassen (status → me), damit die effektive Rolle Admin ist.
    for (let i = 0; i < 6 && !(container.textContent ?? "").includes("S2:on"); i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      if ((container.textContent ?? "").match(/S2:(on|off)/)) {
        // Rolle ist da; Schleife bricht ab, sobald ein stabiler Zustand steht.
        if (i >= 1) break;
      }
    }
  }

  function unmount(): void {
    act(() => root.unmount());
    container.remove();
  }

  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("vorbelegter Wert (localStorage=1) ist beim Mount sofort aktiv (kein Aufblitzen)", async () => {
    window.localStorage.setItem(KEY, "1");
    await mountAndResolveAdmin();
    expect(container.textContent).toContain("S2:on");
    unmount();
  });

  it("Einschalten schreibt persistent; ein frischer Remount zeigt Stufe 2 weiter an", async () => {
    await mountAndResolveAdmin();
    expect(container.textContent).toContain("S2:off");
    const enable = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "enable",
    ) as HTMLButtonElement;
    await act(async () => {
      enable.click();
    });
    expect(window.localStorage.getItem(KEY)).toBe("1");
    expect(container.textContent).toContain("S2:on");
    unmount();

    // „Neuladen": frischer Remount — der Toggle bleibt an, ohne erneut zu klicken.
    await mountAndResolveAdmin();
    expect(container.textContent).toContain("S2:on");
    unmount();
  });

  it("Ausschalten persistiert; ein Remount zeigt die Karte (Stufe 2 aus)", async () => {
    window.localStorage.setItem(KEY, "1");
    await mountAndResolveAdmin();
    const disable = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "disable",
    ) as HTMLButtonElement;
    await act(async () => {
      disable.click();
    });
    expect(window.localStorage.getItem(KEY)).toBe("0");
    unmount();

    await mountAndResolveAdmin();
    expect(container.textContent).toContain("S2:off");
    unmount();
  });
});

describe("W1 · Verdrahtung", () => {
  it("RoleContext lädt den Startwert im Initializer und persistiert beim Setzen", () => {
    const src = read("apps/web/src/app/RoleContext.tsx");
    expect(src).toContain("useState<boolean>(() => readStufe2())");
    expect(src).toContain("writeStufe2(on)");
  });
});
