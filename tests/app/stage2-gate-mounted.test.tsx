// @vitest-environment jsdom
// WP-UX-WOW-1 U9 (Mounted): /import leitet bei ausgeschalteter Stufe 2 NICHT mehr still auf /start
// um — es erscheint die erklärende Karte („Erweiterte Funktionen (Stufe 2)") mit Einschalt-Knopf.
// Der Knopf setzt den BESTEHENDEN Toggle (RoleContext.setStufe2) und zeigt danach das echte
// Import-Cockpit. Aufbau: echte Provider (Auth/Role) mit gemockter Admin-Session, echte Bausteine
// (roleAllows, Stage2Notice, ImportReview); der Host spiegelt die drei Guard-Zeilen aus routes.tsx
// — deren Original per Quelltext-Pin gesichert ist (routes.tsx importiert ALLE Seiten und bliebe
// im Gate-tsc sonst außen vor).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    library: { importCandidates: { list: vi.fn(async () => []) } },
    admin: { import: {} },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, roleAllows } from "../../apps/web/src/app/navigation";
import { Stage2Notice } from "../../apps/web/src/components/Stage2Notice";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IMPORT_ITEM = ALL_ITEMS.find((item) => item.id === "import");
if (!IMPORT_ITEM) {
  throw new Error("Nav-Item import fehlt");
}

// Spiegel der drei Guard-Zeilen aus routes.tsx (per Quelltext-Pin unten ans Original gebunden).
function GuardedImport(): JSX.Element {
  const { role, stufe2 } = useRole();
  if (!IMPORT_ITEM || !roleAllows(IMPORT_ITEM, role)) {
    return createElement(Navigate, { to: "/start", replace: true });
  }
  if (IMPORT_ITEM.stufe2 && !stufe2) {
    return createElement(Stage2Notice);
  }
  return createElement(ImportReview);
}

// Spiegel des App.tsx-Gates: Routen erst mit aufgelöster Session (sonst leitete die noch leere
// Session mit Preview-Rolle vorschnell um).
function GatedRoutes(): JSX.Element | null {
  const session = useSession();
  if (session.isLoading || !session.user) {
    return null;
  }
  return createElement(
    Routes,
    null,
    createElement(Route, { path: "/import", element: createElement(GuardedImport) }),
    createElement(Route, {
      path: "/start",
      element: createElement("div", null, "START-MARKER"),
    }),
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
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
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/import"] },
                createElement(GatedRoutes),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text ${part} nicht gefunden`);
  }
  return btn;
}

describe("WP-UX-WOW-1 U9: Stufe-2-Karte statt stiller Umleitung", () => {
  it("Stufe 2 aus + /import → erklärende Karte; der Knopf schaltet ein und zeigt das Cockpit", async () => {
    mount();
    // Auth auflösen lassen (status, dann me — zwei Query-Runden), dann rendert der Guard.
    for (let i = 0; i < 5 && !(container.textContent ?? "").includes("Stufe 2"); i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 25));
      });
    }
    // KEINE stille Umleitung: die Karte erklärt die Lage und bietet beide Wege an.
    expect(container.textContent).not.toContain("START-MARKER");
    expect(container.textContent).toContain("Erweiterte Funktionen (Stufe 2)");
    expect(container.textContent).toContain("Stufe 2 jetzt einschalten");
    expect(container.textContent).toContain("Zurück zum Start");
    // Das Cockpit ist noch NICHT da.
    expect(container.textContent).not.toContain("Gruppen freigeben");

    // Einschalten → derselbe bestehende Toggle wie in der Sidebar → das Cockpit erscheint.
    await act(async () => {
      buttonByText("Stufe 2 jetzt einschalten").click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(container.textContent).not.toContain("Stufe 2 jetzt einschalten");
    // Import-Cockpit sichtbar: Fünf-Schritte-Leiste (COCKPIT-LINIE) inkl. Schritt 4.
    expect(container.textContent).toContain("Gruppen freigeben");
    expect(container.textContent).toContain("Quelle");
  });

  it("routes.tsx trägt exakt diese Gate-Logik (Rollen-Gate hart, Stufe-2 → Karte)", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    expect(src).toContain("if (!roleAllows(item, role)) {");
    expect(src).toContain("if (item.stufe2 && !stufe2) {");
    expect(src).toContain("return <Stage2Notice />;");
    // Die alte stille Kombi-Umleitung (canSee) ist aus dem Guard verschwunden.
    expect(src).not.toContain("canSee(item, role, stufe2)");
  });
});
