// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega70 BLOCK A — EINE UNERREICHBARE ROLLE ERKLÄRT SICH, SIE WIRFT NICHT HINAUS.
// ================================================================================================
// bens Befund (BERICHT-ben-sammel66-vortest, ROT): steuert die Rolle `experte` eine
// `controller`-Route an (Deep-Link, z. B. /validierung), antwortet `Guarded` in routes.tsx mit
// `<Navigate to={HOME_ROUTE} replace />` — kommentarlos zurück auf /start. Für den Stufe-2-Fall
// hat dieses Projekt die Entscheidung längst getroffen (WP-UX-WOW-1 U9: „KEINE stille Umleitung
// mehr"); der Rollenfall blieb die Ausnahme. Dieser Test verlangt dieselbe Behandlung: eine
// erklärende Fläche, die sagt, welcher Rolle der Bereich gehört, und einen Weg zurück bietet —
// ohne Einschalt-Knopf, denn eine Rolle vergibt der Administrator, nicht die Nutzerin.
//
// Hausform wie tests/app/stage2-gate-mounted.test.tsx: der Host spiegelt die Guard-Zeilen aus
// routes.tsx (Quelltext-Pin unten bindet den Spiegel ans Original; routes.tsx selbst importiert
// ALLE Seiten und darf laut mega61-rechtsseiten nicht in tests/** gezogen werden). Rolle kommt
// aus dem gemockten RoleContext (Hausform der rollengetriebenen Mount-Tests, vgl.
// tests/app/mega51-startziele-erreichbar-mounted.test.tsx).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rolle = vi.hoisted(() => ({ current: "experte" as string }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  RoleProvider: ({ children }: { children: unknown }) => children,
  useRole: () => ({
    role: rolle.current,
    stufe2: true,
    setRole: () => {},
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
    previewActive: false,
  }),
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { useRole } from "../../apps/web/src/app/RoleContext";
import { ALL_ITEMS, HOME_ROUTE, type NavItem, roleAllows } from "../../apps/web/src/app/navigation";
import { RoleNotice } from "../../apps/web/src/components/Stage2Notice";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Die vorhandene Rollenquelle, kein nachgebautes Item: /validierung verlangt `controller`.
const ITEM = ALL_ITEMS.find((item) => item.id === "validierung");
if (!ITEM || ITEM.minRole !== "controller") {
  throw new Error("Nav-Item validierung fehlt oder verlangt nicht mehr controller");
}

// Spiegel der Guard-Zeilen aus routes.tsx (per Quelltext-Pin unten ans Original gebunden).
// Der rote Lauf dieses Tests lief gegen den Spiegel des ALTEN Guards
// (`createElement(Navigate, { to: HOME_ROUTE, replace: true })` im Rollenfall) und scheiterte mit
// „expected 'START-MARKER' not to contain 'START-MARKER'" — der wörtliche Beleg des stillen
// Rückwurfs. Seitdem rendert der Rollenfall das ECHTE RoleNotice.
function GuardedZiel({ item }: { item: NavItem }): JSX.Element {
  const { role, stufe2 } = useRole();
  if (!roleAllows(item, role)) {
    return createElement(RoleNotice, { item });
  }
  if (item.stufe2 && !stufe2) {
    return createElement("div", null, "STUFE2-MARKER");
  }
  return createElement("div", null, "SEITEN-MARKER");
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(alsRolle: string): Promise<void> {
  rolle.current = alsRolle;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [ITEM ? ITEM.path : "/validierung"] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: ITEM ? ITEM.path : "/validierung",
            element: createElement(GuardedZiel, { item: ITEM as NavItem }),
          }),
          createElement(Route, {
            path: HOME_ROUTE,
            element: createElement("div", null, "START-MARKER"),
          }),
        ),
      ),
    );
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("mega70 A · die Rolle, die nicht hindarf, bekommt eine Erklärung statt des Rückwurfs", () => {
  it("Experte auf /validierung: KEIN stiller Rückwurf nach /start — die Fläche erklärt sich", async () => {
    await mount("experte");

    // Heute rot: der Router wirft kommentarlos auf die Startseite zurück.
    expect(container.textContent).not.toContain("START-MARKER");

    // Die Erklärung in Alltagssprache: welcher Rolle der Bereich gehört …
    expect(container.textContent).toContain(i18n.t("role.gate.title"));
    expect(container.textContent).toContain(i18n.t("role.name.controller"));
    // … und ein Weg zurück.
    const zurueck = [...container.querySelectorAll("a[href]")].map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(zurueck).toContain(HOME_ROUTE);
    // KEIN Einschalt-Knopf: eine Rolle vergibt der Administrator, nicht die Nutzerin.
    expect(container.textContent).not.toContain(i18n.t("stage2.gate.enable"));
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("Controller auf /validierung: die Seite erscheint unverändert — nichts wurde weggenommen", async () => {
    await mount("controller");
    expect(container.textContent).toContain("SEITEN-MARKER");
    expect(container.textContent).not.toContain(i18n.t("role.gate.title"));
  });

  it("routes.tsx trägt exakt diese Gate-Logik (Rollenfall → RoleNotice, kein Navigate mehr)", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    expect(src).toContain("if (!roleAllows(item, role)) {");
    expect(src).toContain("return <RoleNotice item={item} />;");
    // Die stille Rollen-Umleitung ist aus dem Guard verschwunden (Navigate bleibt als
    // element={…} der Einstiegs-/Fallback-Routen "/" und "*", nie als Guard-Rückgabe).
    expect(src).not.toContain("return <Navigate");
  });
});
