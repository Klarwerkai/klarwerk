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

  // JOB 1022 D5: die Sonde zeigt zusätzlich die effektive ROLLE. Sie ist die Bedingung, auf die
  // `mountAndResolveAdmin` unten wirklich warten muss — `stufe2` ist `effectiveStufe2(role, toggle)`
  // und bleibt `false`, solange die Session nicht als Admin aufgelöst ist. Ohne diese Anzeige gab es
  // im DOM kein Merkmal, an dem „aufgelöst" von „noch nicht aufgelöst" zu unterscheiden war.
  function Probe(): JSX.Element {
    const { role, stufe2, setStufe2 } = useRole();
    return createElement(
      "div",
      null,
      createElement("span", null, `R:${role}`),
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
    // ── JOB 1022 D5 — DIE SCHLEIFE WARTET JETZT AUF DIE BEDINGUNG, DIE SIE BEHAUPTET ────────────
    //
    // Hier stand: höchstens sechs Runden à 20 ms, mit `break`, sobald `S2:(on|off)` im DOM steht —
    // und `S2:off` steht SOFORT beim ersten Render. Faktisch wartete die Schleife damit zwei Runden,
    // also ~40 ms, und fuhr dann weiter, egal ob die Session aufgelöst war. Die Session braucht aber
    // ZWEI aufeinanderfolgende Abrufe (`status` → `me`); erst danach ist die Rolle Admin und
    // `effectiveStufe2(role, toggle)` kann überhaupt `true` werden.
    //
    // FOLGE, und sie ist gemessen: Auf einer unbelasteten Maschine reichen die 40 ms; unter Last
    // nicht. Der unabhängige Prüfer von JOB 1022 D4 hat genau deshalb `S2:off` gesehen und diese
    // Datei als neu rot gemeldet, während derselbe Stand hier grün lief — in dieser Umgebung
    // brechen drei Socket-Testdateien sofort mit `listen EPERM` ab und erzeugen die Last nicht.
    // Nachgewiesen mit einer Sonde: 30 ms künstliche Verzögerung in `status` genügen, damit die
    // ALTE Schleife mit `expected 'S2:off' to contain 'S2:on'` fehlschlägt.
    //
    // KEINE ZUSAGE IST GELOCKERT — im Gegenteil: gewartet wird jetzt auf `R:admin`, also auf die
    // Vorbedingung, die der Funktionsname behauptet, und ihr Ausbleiben ist ein eigener,
    // sprechender Fehlschlag statt einer stillen Weiterfahrt. Jede `expect`-Zeile der Fälle
    // darunter steht unverändert.
    for (let i = 0; i < 50 && !(container.textContent ?? "").includes("R:admin"); i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
    }
    expect(
      container.textContent,
      "die Admin-Session wurde nicht aufgelöst — ohne sie prüft kein Fall dieser Datei etwas",
    ).toContain("R:admin");
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
