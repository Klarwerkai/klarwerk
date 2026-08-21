// @vitest-environment jsdom
// JOB 1850 (A-1265-NAVGUARD): Der Dialog für ungespeicherte Änderungen gehört in die Modalgrenze.
//
// Der Befund aus 1780 D1: Der Dialog rendert außerhalb der Modalgrenze, weil sein Anbieter über der
// Shell sitzt und die Grenze in der Shell entsteht — er trägt deshalb weder Hintergrundsperre noch
// Fokusführung. Beide Zusicherungen mussten dabei stehen bleiben: der Anbieter bleibt oberhalb der
// Fehlergrenze (App.tsx:96-98), die Grenze entsteht weiter in der Shell (AppShell.tsx:4-6).
//
// Diese Datei misst am ECHTEN Baum (NavGuardProvider über MemoryRouter/AppShell, genau wie App.tsx),
// nicht an einer nachgebauten Attrappe.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const WURZEL = join(__dirname, "..", "..");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Sonde: meldet einen ungespeicherten Stand an und löst über `guard()` einen Seitenwechsel aus —
// derselbe Weg, den Sidebar und Command-Palette nehmen.
function GuardProbe(): JSX.Element {
  const { setGuard, guard } = useNavGuard();
  useEffect(() => {
    setGuard({ isDirty: () => true, save: async () => {} });
    return () => setGuard(null);
  }, [setGuard]);
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "navprobe",
      onClick: () => guard(() => {}),
    },
    "wechseln",
  );
}

async function mount(): Promise<void> {
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
              // Genau die Schachtelung aus App.tsx: der Wächter liegt ÜBER der Shell.
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/"] },
                  createElement(AppShell, null, createElement(GuardProbe)),
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

async function oeffneDialog(): Promise<HTMLButtonElement> {
  const knopf = container.querySelector<HTMLButtonElement>('[data-testid="navprobe"]');
  if (!knopf) {
    throw new Error("Sonde nicht gefunden");
  }
  knopf.focus();
  await act(async () => {
    knopf.click();
  });
  await flush();
  return knopf;
}

const dialogFlaeche = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-navguard-dialog]");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 1850 · der Navigations-Dialog liegt in der Modalgrenze", () => {
  it("hängt im Portal-Anker der Shell (`<main>`), nicht mehr beim Anbieter darüber", async () => {
    await mount();
    // Vor dem Öffnen gibt es die Fläche gar nicht.
    expect(dialogFlaeche()).toBeNull();

    await oeffneDialog();

    const flaeche = dialogFlaeche();
    expect(flaeche).not.toBeNull();
    // DER Kernbeleg: Die Fläche liegt INNERHALB von `<main>` — dem Anker, den AppShell:31 benennt.
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.contains(flaeche as Node)).toBe(true);
    // Und sie trägt den Dialogtext, ist also die echte Fläche und nicht eine leere Hülle.
    expect(flaeche?.textContent ?? "").toContain(i18n.t("nav.guard.stay"));
  });

  it("sperrt den Hintergrund: die auslösende Fläche liegt im inerten Bereich", async () => {
    await mount();
    const knopf = await oeffneDialog();

    // Die Grenze setzt `inert` auf die angemeldeten Bereiche, sobald eine Fläche sich anmeldet.
    const gesperrt = container.querySelector<HTMLElement>("[inert]");
    expect(gesperrt).not.toBeNull();
    // Der Auslöser liegt im gesperrten Bereich …
    expect(knopf.closest("[inert]")).not.toBeNull();
    // … der Dialog selbst NICHT.
    expect(dialogFlaeche()?.closest("[inert]") ?? null).toBeNull();
  });

  it("führt den Fokus: erst in den Dialog, beim Schließen zurück auf den Auslöser", async () => {
    await mount();
    const knopf = await oeffneDialog();

    // Anfangsfokus liegt im Dialog (sonst stünde er im gesperrten Hintergrund).
    const flaeche = dialogFlaeche();
    expect(flaeche?.contains(document.activeElement)).toBe(true);

    // „Hier bleiben" schließt den Dialog.
    const bleiben = Array.from(flaeche?.querySelectorAll("button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === i18n.t("nav.guard.stay"),
    );
    expect(bleiben).toBeDefined();
    await act(async () => {
      bleiben?.click();
    });
    await flush();

    expect(dialogFlaeche()).toBeNull();
    // Die Grenze gibt den Fokus an den Auslöser zurück (ModalBoundaryContext:163) …
    expect(document.activeElement).toBe(knopf);
    // … und hebt die Sperre wieder auf.
    expect(container.querySelector("[inert]")).toBeNull();
  });
});

describe("JOB 1850 · die Absturzsicherheit bleibt unverändert", () => {
  it("der Anbieter steht weiterhin OBERHALB der Fehlergrenze", () => {
    const quelle = readFileSync(join(WURZEL, "apps", "web", "src", "App.tsx"), "utf8");
    const anbieter = quelle.indexOf("<NavGuardProvider>");
    const fehlergrenze = quelle.indexOf("<ErrorBoundary>");
    expect(anbieter).toBeGreaterThan(-1);
    expect(fehlergrenze).toBeGreaterThan(-1);
    // Nur der RENDERORT des Dialogs ist gewandert, nicht der Anbieter.
    expect(anbieter).toBeLessThan(fehlergrenze);
    // Die begründende Zusicherung steht unverändert im Quelltext.
    expect(quelle).toContain("Seiten-Absturz noch trägt");
  });
});
