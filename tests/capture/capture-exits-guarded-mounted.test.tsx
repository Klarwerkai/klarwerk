// @vitest-environment jsdom
// AUFTRAG-mega12 Block A (bens SB-2, Fundstellen Capture.tsx :2608 / :2629 / :2678-2689): die Links
// ZWISCHEN Erfassen und Vordertür waren rohe <Link> — der Wächter greift aber nur, wenn die
// Navigationsquelle ihn ruft. Ein Klick auf „Dokument-Canvas" verlor damit die laufende Eingabe still.
//
// Dieser Test treibt die ECHTEN Links der ECHTEN Capture-Seite über reale Klicks und beweist je Ausgang:
//   (a) bei ungespeicherter Eingabe erscheint der Wächter-Dialog UND die Route bleibt stehen,
//   (b) „Hier bleiben" hält die Route UND den Inhalt,
//   (c) nur bewusstes Verwerfen wechselt wirklich,
//   (d) OHNE ungespeicherte Eingabe navigiert derselbe Link unverändert durch (keine Warnung ohne
//       Verlust — sonst hätten wir den Bug gegen eine Gängelung getauscht).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Zeigt die aktuelle Route an — daran (nicht an einem Spion) wird gemessen, ob wirklich gewechselt wurde.
function PathProbe(): JSX.Element {
  const loc = useLocation();
  return createElement("span", { "data-testid": "path" }, loc.pathname + loc.search);
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
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/erfassen"] },
                  createElement(PathProbe),
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
                    // Zielseite bewusst als Platzhalter: geprüft wird der WECHSEL, nicht die Vordertür.
                    createElement(Route, {
                      path: CAPTURE_FRONT_DOOR_ROUTE,
                      element: createElement("p", null, "VORDERTUER"),
                    }),
                    createElement(Route, {
                      path: "/validierung",
                      element: createElement("p", null, "VALIDIERUNG"),
                    }),
                  ),
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
}

function path(): string {
  return container.querySelector<HTMLElement>("[data-testid=path]")?.textContent ?? "";
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

// Ein echter Anker der Seite, gefunden über seinen sichtbaren Text.
function linkByText(part: string): HTMLAnchorElement {
  const a = [...container.querySelectorAll("a")].find((x) =>
    (x.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(a instanceof HTMLAnchorElement)) {
    throw new Error(`Link „${part}“ nicht gefunden`);
  }
  return a;
}

async function typeFreitext(value: string): Promise<void> {
  const ta = [...container.querySelectorAll("textarea")].find(
    (t) => t.placeholder === i18n.t("capture.rawPlaceholder"),
  );
  if (!(ta instanceof HTMLTextAreaElement)) {
    throw new Error("Freitext-Feld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta) as object, "value")?.set;
  setter?.call(ta, value);
  await act(async () => {
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

async function openWorkspace(): Promise<void> {
  await click(buttonByText("Weitere Wege anzeigen"));
}

function guardDialogOpen(): boolean {
  return pageText().includes(i18n.t("nav.guard.title"));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block A: die Ausgänge von /erfassen zur Vordertür laufen durch den Wächter", () => {
  // bens Fundstelle 1 (:2608) — der Kopfzeilen-Link.
  it("Kopfzeilen-Link Dokument-Canvas blockiert; Hier-bleiben haelt Route UND Inhalt", async () => {
    await mount();
    await openWorkspace();
    await typeFreitext("Der Dosierwert ist nach dem Schichtwechsel zu prüfen.");
    expect(path()).toBe("/erfassen");

    await click(linkByText("Dokument-Canvas"));
    // Der Wächter fragt — und die Route hat sich NICHT bewegt.
    expect(guardDialogOpen()).toBe(true);
    expect(path()).toBe("/erfassen");
    expect(pageText()).not.toContain("VORDERTUER");

    await click(buttonByText(i18n.t("nav.guard.stay")));
    expect(guardDialogOpen()).toBe(false);
    expect(path()).toBe("/erfassen");
    // Der Inhalt ist noch da — genau das, was SB-2 schützen soll.
    const ta = [...container.querySelectorAll("textarea")].find(
      (t) => t.placeholder === i18n.t("capture.rawPlaceholder"),
    );
    expect(ta?.value).toContain("Dosierwert");
  });

  // bens Fundstelle 2 (:2629) — der prominente „Standardweg"-Knopf.
  it("Standardweg-Knopf Dokument-Canvas oeffnen: nur bewusstes Verwerfen wechselt wirklich", async () => {
    await mount();
    await openWorkspace();
    await typeFreitext("Ungespeicherte Zeile.");

    await click(linkByText("Dokument-Canvas öffnen"));
    expect(guardDialogOpen()).toBe(true);
    expect(path()).toBe("/erfassen");

    await click(buttonByText(i18n.t("nav.guard.discard")));
    expect(path()).toBe(CAPTURE_FRONT_DOOR_ROUTE);
    expect(pageText()).toContain("VORDERTUER");
  });

  // Die Gegenprobe: keine Warnung ohne Verlust.
  it("ohne ungespeicherte Eingabe wechselt derselbe Link OHNE Dialog", async () => {
    await mount();
    await click(linkByText("Dokument-Canvas öffnen"));
    expect(guardDialogOpen()).toBe(false);
    expect(path()).toBe(CAPTURE_FRONT_DOOR_ROUTE);
    expect(pageText()).toContain("VORDERTUER");
  });

  // Modifikator-Klicks gehören dem Browser (neuer Tab) — sie verlassen die Seite nicht.
  it("Strg/Meta-Klick wird NICHT abgefangen (neuer Tab verliert nichts)", async () => {
    await mount();
    await openWorkspace();
    await typeFreitext("Ungespeicherte Zeile.");

    const a = linkByText("Dokument-Canvas öffnen");
    await act(async () => {
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
      await flush();
    });
    // Kein Dialog, und die aktuelle Seite bleibt stehen (der Browser würde einen Tab öffnen).
    expect(guardDialogOpen()).toBe(false);
    expect(path()).toBe("/erfassen");
  });
});
