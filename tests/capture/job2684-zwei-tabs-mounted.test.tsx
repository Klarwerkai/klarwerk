// @vitest-environment jsdom
// ================================================================================================
// JOB 2684 D1 (Review R2-17) — ZWEI TABS, UND EIN ENTWURF IST WEG: die Vordertür, gemountet.
// ================================================================================================
//
// §5 der Arbeitsanweisung: „Zwei Tabs auf demselben Entwurf: der zweite bekommt beim Speichern eine
// sichtbare Meldung, dass sich der Entwurf geändert hat — und überschreibt nichts."
//
// Hier läuft die ECHTE Seite `CaptureFrontDoor` (Harness wie `frontdoor-draft-deeplink-mounted`).
// Ersetzt ist nur der Endpunkt: er antwortet so, wie die Route seit D1 antwortet — 409 DRAFT_STALE
// (an der echten Route gepinnt in `tests/app/job2684-draft-stale-route.test.ts`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gegenstelle = vi.hoisted(() => ({
  update: async (..._args: unknown[]): Promise<unknown> => ({}),
  getCount: 0,
  getUpdatedAt: "2026-08-28T20:00:00.000Z",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pedi", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      get: vi.fn(async () => {
        gegenstelle.getCount += 1;
        return {
          id: "d-1",
          payload: {
            title: "Wartung der Presse",
            bodyHtml: "<p>Anlage freischalten. Mein Text in Tab B.</p>",
            confidentiality: "intern",
          },
          originalAuthor: "u1",
          lastEditor: "u1",
          createdAt: "2026-08-28T19:00:00.000Z",
          updatedAt: gegenstelle.getUpdatedAt,
        };
      }),
      create: vi.fn(async () => ({ id: "d-neu", payload: {} })),
      update: vi.fn((...args: unknown[]) => gegenstelle.update(...args)),
      promote: vi.fn(async () => ({})),
    },
    reasoner: {
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({})),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const updateMock = endpoints.drafts.update as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                ImageDescribeProvider,
                null,
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

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function konfliktKasten(): HTMLElement | null {
  const el = container.querySelector('[data-testid="fd-draft-stale"]');
  return el instanceof HTMLElement ? el : null;
}

function editorHtml(): string {
  return container.querySelector("[contenteditable]")?.innerHTML ?? "";
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gegenstelle.getCount = 0;
  gegenstelle.getUpdatedAt = "2026-08-28T20:00:00.000Z";
  gegenstelle.update = async () => ({});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2684 D1 · zwei Tabs auf demselben Entwurf — der zweite überschreibt nichts", () => {
  it("Tab B speichert, der Server meldet DRAFT_STALE → sichtbare Meldung, Text bleibt stehen, kein „gespeichert“", async () => {
    // Die Gegenstelle spielt Tab A: sie hat seit dem Laden gespeichert, Tab B's Stand ist alt.
    gegenstelle.update = async () => {
      throw new ApiError(
        409,
        "DRAFT_STALE",
        "Der Entwurf wurde inzwischen an anderer Stelle geändert. Dein Stand wurde nicht gespeichert — bitte neu laden.",
      );
    };
    await mount("/capture/frontdoor?draft=d-1");
    expect(gegenstelle.getCount).toBe(1);
    expect(konfliktKasten()).toBeNull(); // vor dem Speichern nichts

    await click(buttonByText(i18n.t("fd.saveDraft")));

    // Der gesehene Stand ist mitgereist — das ist die Grundlage des Vergleichs.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]?.[2]).toEqual({
      expectedUpdatedAt: "2026-08-28T20:00:00.000Z",
    });
    // Die Meldung steht auf der Seite — lesbar, mit Ausweg.
    const kasten = konfliktKasten();
    expect(kasten).not.toBeNull();
    expect(kasten?.textContent).toContain(i18n.t("fd.draftStale"));
    expect(kasten?.textContent).toContain(i18n.t("fd.draftStaleReload"));
    // Nicht „gespeichert" — weder als Toast noch als Fehlerkasten „Speichern fehlgeschlagen".
    expect(pageText()).not.toContain(i18n.t("fd.toastSaved"));
    expect(pageText()).not.toContain(i18n.t("fd.errSaveFailed"));
    // Und der eigene Text steht weiter im Editor — nichts wurde verworfen, nichts überschrieben.
    expect(editorHtml()).toContain("Mein Text in Tab B.");
  });

  it("„Neu laden“ holt die andere Fassung ausdrücklich — und der nächste Speichern-Versuch trägt den neuen Stand", async () => {
    gegenstelle.update = async () => {
      throw new ApiError(409, "DRAFT_STALE", "veraltet");
    };
    await mount("/capture/frontdoor?draft=d-1");
    await click(buttonByText(i18n.t("fd.saveDraft")));
    expect(konfliktKasten()).not.toBeNull();

    // Die Gegenstelle liefert beim Neuladen den jüngeren Stand von Tab A.
    gegenstelle.getUpdatedAt = "2026-08-28T20:05:00.000Z";
    gegenstelle.update = async () => ({
      id: "d-1",
      payload: { title: "Wartung der Presse" },
      updatedAt: "2026-08-28T20:06:00.000Z",
    });
    await click(buttonByText(i18n.t("fd.draftStaleReload")));
    expect(gegenstelle.getCount).toBe(2); // wirklich neu geladen
    expect(konfliktKasten()).toBeNull();

    await click(buttonByText(i18n.t("fd.saveDraft")));
    expect(updateMock.mock.calls[1]?.[2]).toEqual({
      expectedUpdatedAt: "2026-08-28T20:05:00.000Z",
    });
    expect(konfliktKasten()).toBeNull();
  });

  it("GEGENPROBE: ohne fremde Änderung wird gespeichert wie bisher — kein Konfliktkasten, Toast „gespeichert“", async () => {
    gegenstelle.update = async () => ({
      id: "d-1",
      payload: { title: "Wartung der Presse" },
      updatedAt: "2026-08-28T20:06:00.000Z",
    });
    await mount("/capture/frontdoor?draft=d-1");
    await click(buttonByText(i18n.t("fd.saveDraft")));
    expect(updateMock.mock.calls[0]?.[2]).toEqual({
      expectedUpdatedAt: "2026-08-28T20:00:00.000Z",
    });
    expect(konfliktKasten()).toBeNull();
    // Der bisherige Erfolgsweg: nach dem Speichern verlässt die Vordertür die Seite (navigate
    // nach /erfassen, CaptureFrontDoor.tsx `save.onSuccess`) — der Editor ist damit weg. In diesem
    // Gerüst gibt es keine Route /erfassen; die leere Fläche IST der Beleg, dass der Erfolgsweg lief.
    expect(container.querySelector("[contenteditable]")).toBeNull();
    expect(pageText()).not.toContain(i18n.t("fd.draftStale"));
  });

  it("KALIBRIERUNG: ein anderer Fehler zeigt weiter „Speichern fehlgeschlagen“ — der Konfliktkasten ist nur für den Konflikt", async () => {
    gegenstelle.update = async () => {
      throw new ApiError(500, "INTERNAL", "Interner Betriebsfehler.");
    };
    await mount("/capture/frontdoor?draft=d-1");
    await click(buttonByText(i18n.t("fd.saveDraft")));
    expect(konfliktKasten()).toBeNull();
    expect(pageText()).toContain("Interner Betriebsfehler.");
  });
});
