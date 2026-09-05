// @vitest-environment jsdom
// ================================================================================================
// JOB 3060 · H1 (Codex R5) — DAS KOPFBANDINVENTAR GILT IN JEDEM ZUSTAND, AUCH IN DER ROLLEN-VORSCHAU.
// ================================================================================================
//
// Mit der Seitenleiste verlor die Rollen-Vorschau des Admins ihren alten Rückweg. Runde 3 setzte
// dafür eine Pille ins Kopfband; Codex (R5): „keine Pillen, sonst nichts" gilt in ALLEN Zuständen,
// und der Rückweg steht bereits im Zahnrad-Menü („Zur Admin-Ansicht", RollenVorschau.tsx). Die
// Pille ist wieder weg. Gemountet am ECHTEN Kopfband mit echtem RoleProvider: jede Nicht-Admin-
// Rolle wählen, Menü schließen — das Kopfband trägt nur sein Inventar; Zahnrad → „Zur
// Admin-Ansicht" stellt die echte Admin-Ansicht ohne Reload wieder her. Der Chromium-Beleg an der
// gebauten App steht in tests/design/h1-funktionsinventar.test.ts (Zeile Z-vorschau-rueckweg).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Anna Admin", email: "a@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: {} })) },
    lifecycle: { pending: vi.fn(async () => []) },
    notifications: { list: vi.fn(async () => []), markSeen: vi.fn(async () => ({})) },
    features: { get: vi.fn(async () => ({ features: {} })) },
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "none", reachable: "unknown", tasks: {} })),
      config: vi.fn(async () => null),
    },
    external: { policy: vi.fn(async () => ({ stage: "blocked" })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import type { Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * JOB 3065 H6 R10 — WIE DIE VORSCHAU HIER JETZT ENTSTEHT.
 *
 * Bis Runde 9 wählte dieser Test die Rolle im Zahnrad-Menü. Das Rollenraster wohnt jetzt in den
 * Einstellungen (`/admin` Konten → „Ansicht als Rolle"), im Zahnrad bleibt allein der Rückweg —
 * und diese Montage kennt nur das Kopfband, nicht die Seite. Gesetzt wird die Vorschau deshalb über
 * DENSELBEN Haken, den die Einstellungen benutzen (`useRole().setRole`, `RoleContext`), durch ein
 * winziges Bauteil INNERHALB des echten `RoleProvider`. Der Weg zum Zustand ist ein anderer, der
 * Zustand ist derselbe — und die Zusage dieses Tests betrifft ohnehin nicht die Wahl, sondern das
 * Kopfband und den Rückweg.
 */
function Vorschau({ rolle }: { rolle: Role | null }): null {
  const { setRole, isSessionRole } = useRole();
  // ERST WENN DIE SITZUNG STEHT: `RoleContext.setRole` schreibt nur dann in die Admin-Vorschau
  // (`viewAs`), wenn die Session bereits als Admin bekannt ist — vorher landet der Wert im
  // Dev-Zustand (`previewRole`) und ist wirkungslos, sobald der echte Admin geladen ist. Genau so
  // ist es auch im Produkt: die Vorschau gibt es nur für eine echte Admin-Sitzung.
  //
  // Und GENAU EINMAL: ohne diese Sperre liefe der Effekt bei jeder Änderung der Rolle erneut und
  // setzte die Vorschau sofort wieder — der Rückweg „Zur Admin-Ansicht" wäre wirkungslos und der
  // Test grün, obwohl er nichts mehr misst. Das Bauteil vertritt die EINMALIGE Wahl in den
  // Einstellungen, nicht einen Zwang zur Vorschau.
  const gesetzt = useRef(false);
  useEffect(() => {
    if (rolle !== null && isSessionRole && !gesetzt.current) {
      gesetzt.current = true;
      setRole(rolle);
    }
  }, [rolle, isSessionRole, setRole]);
  return null;
}

async function mount(pfad = "/start", rolle: Role | null = null): Promise<void> {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [pfad] },
                  createElement(Vorschau, { rolle }),
                  createElement(Kopfband),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

async function click(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

const zahnrad = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="kopfband-zahnrad"]');
const menueOffen = (): boolean => container.querySelector('[data-testid="zahnrad-menue"]') !== null;

/** Das Zahnrad öffnen, damit seine Fläche gelesen werden kann. */
async function zahnradOeffnen(): Promise<void> {
  if (!menueOffen()) {
    await click(zahnrad());
  }
}

/** Das Menü schließen (Escape auf der Fläche) — danach zählt allein das Kopfband. */
async function menueSchliessen(): Promise<void> {
  const flaeche = container.querySelector<HTMLElement>('[data-testid="zahnrad-menue"]');
  await act(async () => {
    flaeche?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flush();
  });
}

/** Die Wörter des Kopfbands — jsdom kennt kein innerText; gezählt wird der Text jedes Blatts. */
function kopfbandWoerter(): string[] {
  const band = container.querySelector('header[data-testid="kopfband"]');
  return [...(band?.querySelectorAll("*") ?? [])]
    .filter((e) => e.children.length === 0)
    .map((e) => (e.textContent ?? "").trim())
    .filter(Boolean);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3060 · H1 · Rollen-Vorschau: das Kopfband bleibt bei seinem Inventar, der Rückweg liegt im Zahnrad", () => {
  const INVENTAR = ["KLARWERK", "Start", "Fragen", "Bibliothek", "Erfassen", "Prüfen"];

  it("als Admin ohne Vorschau: genau das Inventar (Zähler und Initialen ausgenommen), keine Pille", async () => {
    await mount();
    expect(container.querySelector('[data-testid="kopfband-vorschau"]')).toBeNull();
    const fremd = kopfbandWoerter().filter((w) => !INVENTAR.includes(w) && w !== "AA");
    expect(fremd).toEqual([]);
  });

  for (const rolle of ["viewer", "experte", "controller"] as const) {
    it(`Vorschau als ${rolle}: bei geschlossenem Menü trägt das Kopfband NICHTS außerhalb des Inventars; Zahnrad → „Zur Admin-Ansicht“ stellt Admin ohne Reload wieder her`, async () => {
      await mount("/start", rolle);
      // Die Vorschau wirkt: die Admin-Zeile „Einstellungen" ist weg.
      await zahnradOeffnen();
      expect(container.querySelector('[data-testid="zahnrad-einstellungen"]')).toBeNull();
      // Und das Rollenraster ist hier NICHT mehr — es wohnt in den Einstellungen (JOB 3065).
      expect(
        container.querySelectorAll('[data-testid="zahnrad-ansicht"] [role="menuitemradio"]'),
      ).toHaveLength(0);
      await menueSchliessen();
      expect(menueOffen()).toBe(false);

      // Kein Element außerhalb des Inventars — insbesondere keine Pille, kein Rollentext.
      expect(container.querySelector('[data-testid="kopfband-vorschau"]')).toBeNull();
      const fremd = kopfbandWoerter().filter((w) => !INVENTAR.includes(w) && w !== "AA");
      expect(fremd, `${rolle}: Text außerhalb des Kopfbandinventars`).toEqual([]);
      const knoepfe = [...container.querySelectorAll("header button")].map(
        (b) => b.getAttribute("data-testid") ?? b.getAttribute("type"),
      );
      expect(knoepfe.sort()).toEqual(["kopfband-konto", "kopfband-zahnrad", "submit"]);

      // Der Rückweg: Zahnrad → „Zur Admin-Ansicht" (RollenVorschau.tsx) — dieselbe Montage,
      // derselbe Router, kein Reload.
      await click(zahnrad());
      const zurueck = [
        ...container.querySelectorAll<HTMLButtonElement>('[data-testid="zahnrad-ansicht"] button'),
      ].find((b) => (b.textContent ?? "").trim() === i18n.t("role.backToAdmin"));
      expect(zurueck, "kein Rückweg „Zur Admin-Ansicht“ im Zahnrad-Menü").toBeTruthy();
      await click(zurueck);
      expect(container.querySelector('[data-testid="zahnrad-einstellungen"]')).not.toBeNull();
    });
  }
});
