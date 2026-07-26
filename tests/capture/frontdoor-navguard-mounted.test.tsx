// @vitest-environment jsdom
// AUFTRAG-mega9 Block B (KW-E2E-002): Die Vordertür hatte keine Weggehwarnung — Fließtext ändern
// oder löschen, „Alle Erfassungs-Modi“ wählen, und der Wechsel lief ohne jede Nachfrage. Der
// Wächter auf /erfassen wurde vom Prüfer ausdrücklich als vorbildlich bestätigt; die Vordertür war
// schlicht nie angemeldet.
//
// Dieser Test fährt DENSELBEN Weg: er klickt den echten Kopf-Link und erwartet den echten
// NavGuard-Dialog derselben Vorrichtung (NavGuardProvider) — kein Test-Ersatz, kein zweiter Wächter.
//
// Zwei Feinheiten, die hier bewusst mitgeprüft werden:
//  (a) Ein GEÖFFNETER, unveränderter Entwurf ist NICHT dirty (sonst warnte die Seite ohne Verlust).
//  (b) Ein GELEERTER Body zählt als Änderung — sonst hätte Block A ihn speicherbar gemacht und
//      Block B ihn weiterhin still verlieren lassen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  };
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  return {
    endpoints: {
      drafts: {
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      reasoner: {
        // Vollständiger Struktur-Vorschlag (das Panel liest conditions/measures/tags) — rein lokal,
        // kein Netz, kein Modelllauf.
        structure: vi.fn(async () => ({
          title: "Dichtungswechsel L4",
          statement: "Dichtung vor jedem Anlauf prüfen.",
          conditions: [],
          measures: [],
          tags: [],
          demo: true,
          fallbackReason: "no-model",
        })),
        assist: vi.fn(async () => ({ text: "", demo: true })),
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const CAPTURE_MARKER = "ERFASSEN-SEITE-ERREICHT";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
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
            ToastProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [url] },
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  Routes,
                  null,
                  createElement(Route, {
                    path: "/capture/frontdoor",
                    element: createElement(CaptureFrontDoor),
                  }),
                  // Sichtbarer Beleg dafür, ob der Wechsel WIRKLICH stattgefunden hat.
                  createElement(Route, {
                    path: "/erfassen",
                    element: createElement("div", null, CAPTURE_MARKER),
                  }),
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

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Body-Editor nicht gefunden");
  }
  return el;
}

async function setBody(html: string): Promise<void> {
  const el = editor();
  await act(async () => {
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

// Genau der Weg des Prüfers: der Kopf-Link „Alle Erfassungs-Modi“.
async function clickAllModes(): Promise<void> {
  const link = [...container.querySelectorAll("a")].find((a) =>
    (a.textContent ?? "").includes(i18n.t("fd.allModes")),
  );
  if (!(link instanceof HTMLAnchorElement)) {
    throw new Error("Link „Alle Erfassungs-Modi“ nicht gefunden");
  }
  await act(async () => {
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await flush();
  });
}

function guardDialogText(): string {
  // Der Wächter-Dialog rendert im Provider (außerhalb des Seitenbaums) — deshalb am document lesen.
  return document.body.textContent ?? "";
}

function switched(): boolean {
  return (document.body.textContent ?? "").includes(CAPTURE_MARKER);
}

async function seedDraft(): Promise<string> {
  return box.seed({
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf prüfen.",
    type: "best_practice",
    category: "Allgemein",
    bodyHtml: "<p>Alter Absatz</p>",
    origin: "frontdoor",
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AUFTRAG-mega9 Block B (KW-E2E-002): die Vordertür hat eine Weggehwarnung", () => {
  it("Änderung → „Alle Erfassungs-Modi“ → Warnung erscheint, der Wechsel findet NICHT statt", async () => {
    await mount("/capture/frontdoor");
    await setBody("<p>Frisch getippter Inhalt</p>");

    await clickAllModes();

    // Der Wächter fragt — und benennt, worum es geht.
    expect(guardDialogText()).toContain(i18n.t("nav.guard.title"));
    expect(guardDialogText()).toContain(i18n.t("nav.guard.stay"));
    expect(guardDialogText()).toContain(i18n.t("nav.guard.discard"));
    // Ohne Entscheidung wird NICHT gewechselt — das war der Datenverlust.
    expect(switched()).toBe(false);
    unmount();
  });

  it("ohne Änderung wechselt die Seite sofort — ein nur GEÖFFNETER Entwurf warnt nicht", async () => {
    const id = await seedDraft();
    await mount(`/capture/frontdoor?draft=${id}`);
    // Der Entwurf ist geladen, aber nichts wurde angefasst.
    expect(editor().innerHTML).toContain("Alter Absatz");

    await clickAllModes();

    // Keine Nachfrage, direkter Wechsel: es gibt nichts zu verlieren.
    expect(guardDialogText()).not.toContain(i18n.t("nav.guard.title"));
    expect(switched()).toBe(true);
    unmount();
  });

  it("ein GELEERTER Body zählt als Änderung — genau die Löschung aus Block A wird geschützt", async () => {
    const id = await seedDraft();
    await mount(`/capture/frontdoor?draft=${id}`);
    expect(editor().innerHTML).toContain("Alter Absatz");

    // ⌘A + Rücktaste: der Body ist bewusst leer.
    await setBody("");
    await clickAllModes();

    // Ohne diese Zusicherung hätte Block A die Löschung speicherbar gemacht und Block B sie
    // weiterhin still verloren gehen lassen.
    expect(guardDialogText()).toContain(i18n.t("nav.guard.title"));
    expect(switched()).toBe(false);
    unmount();
  });

  it("nach dem Speichern ist die Seite sauber — kein Warndialog mehr", async () => {
    const id = await seedDraft();
    await mount(`/capture/frontdoor?draft=${id}`);
    await setBody("<p>Geänderter Inhalt</p>");

    // Speichern über den echten Knopf; der Erfolgspfad navigiert selbst nach /erfassen.
    const saveBtn = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(i18n.t("fd.saveDraft")),
    );
    if (!(saveBtn instanceof HTMLButtonElement)) {
      throw new Error("Speichern-Knopf nicht gefunden");
    }
    await act(async () => {
      saveBtn.click();
      await flush();
    });

    // Der Wechsel lief durch, OHNE dass der Wächter dazwischenging.
    expect(guardDialogText()).not.toContain(i18n.t("nav.guard.title"));
    expect(switched()).toBe(true);
    unmount();
  });

  it("offener KI-Vorschlag wird als nicht sicherbar BENANNT (kein stilles „Speichern und wechseln“)", async () => {
    await mount("/capture/frontdoor");
    await setBody("<p>Ein Text, zu dem ein Vorschlag entsteht</p>");

    const suggestBtn = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(i18n.t("fd.structureSuggest")),
    );
    if (!(suggestBtn instanceof HTMLButtonElement)) {
      throw new Error("Struktur-Vorschlag-Knopf nicht gefunden");
    }
    await act(async () => {
      suggestBtn.click();
      await flush();
    });

    await clickAllModes();

    // Der Dialog nennt den nicht sicherbaren Inhalt EINZELN und bietet kein Speichern an —
    // dasselbe Muster wie unsavableDirtyReasons im Erfassen-Weg (mega5).
    expect(guardDialogText()).toContain(i18n.t("nav.guard.unsavableTitle"));
    expect(guardDialogText()).toContain(i18n.t("fd.unsavable.proposal"));
    expect(guardDialogText()).not.toContain(i18n.t("nav.guard.save"));
    expect(switched()).toBe(false);
    unmount();
  });
});
