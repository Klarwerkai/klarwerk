// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-BASIC-u2 — DIE ENTWURFSSUCHE SAGT, WORIN SIE SUCHT.
// ================================================================================================
// Die zweite Hälfte des Schnitts (die erste steht in basic-u2-suchraum-bibliothek.test.tsx): auf
// /erfassen trägt „Entwürfe fortsetzen“ ein Suchfeld, das ausschließlich die GESPEICHERTEN
// ENTWÜRFE durchsucht. Wer dort validiertes Klarwerk-Wissen sucht, findet nichts und liest
// „Keine Entwürfe passen zum Filter.“ — eine Auskunft über einen Filter, nicht über einen
// Suchraum, und ohne jeden Weg in die andere Suchwelt.
//
// GEMESSEN WIRD AN DER ECHTEN, GEMOUNTETEN ERFASSUNGSSEITE mit einem echten Klickpfad
// (Liste aufklappen → tippen → Nulltreffer). Die Entwurfsliste selbst (CaptureDraftList) und ihre
// Filterlogik (lib/draftListView.ts) sind in diesem Schnitt NICHT angefasst — geändert sind nur
// die Seite, die die Liste einbindet, und die Texte. Sprach- und Quelltextfragen (AK5/AK7) stehen
// getrennt in basic-u2-suchraum.test.ts; zur Dateiendung `.tsx` siehe dort und im Bibliotheksfall.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

const DRAFTS = vi.hoisted(() => [
  {
    id: "d1",
    payload: { title: "Ventilwechsel an Pumpe 4" },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
  },
]);

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok(DRAFTS),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({})),
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
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

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
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
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

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function suchfeld(): HTMLInputElement {
  const el = container.querySelector(`input[aria-label="${de("capture.draftSearch")}"]`);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Entwurfs-Suchfeld fehlt; DOM: ${text().slice(0, 400)}`);
  }
  return el;
}

function gegenweg(): HTMLAnchorElement | undefined {
  const label = de("capture.draftScope.toLibrary");
  return [...container.querySelectorAll("a")].find((a) =>
    (a.textContent ?? "").replace(/\s+/g, " ").includes(label),
  ) as HTMLAnchorElement | undefined;
}

async function aufklappen(): Promise<void> {
  const label = de("capture.resumeExpand").replace("{{count}}", String(DRAFTS.length));
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(label),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Aufklapp-Knopf „${label}“ fehlt`);
  }
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function tippe(wert: string): Promise<void> {
  const el = suchfeld();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("BASIC-u2 · AK2 — die Entwurfssuche benennt sichtbar ihren Suchraum", () => {
  it("die Angabe steht sichtbar, sobald das Suchfeld steht", async () => {
    await mount();
    // Zugeklappt gibt es keine Suche — dann behauptet die Seite auch keine.
    expect(text()).not.toContain(de("capture.draftScope.note"));
    await aufklappen();
    expect(suchfeld()).toBeTruthy();
    expect(text()).toContain(de("capture.draftScope.note"));
  });
});

describe("BASIC-u2 · AK3 — der benannte Weg in die andere Suchwelt", () => {
  it("neben der Entwurfssuche steht ein echter Link in die Bibliothek", async () => {
    await mount();
    await aufklappen();
    const a = gegenweg();
    expect(a, "der Weg in die Bibliothek fehlt oder trägt keinen Namen").toBeTruthy();
    expect(a?.getAttribute("href")).toBe("/bibliothek");
  });

  it("AK6 — er ist mit der Tastatur erreichbar und nimmt den Fokus", async () => {
    await mount();
    await aufklappen();
    const a = gegenweg();
    expect(a?.tagName).toBe("A");
    a?.focus();
    expect(document.activeElement).toBe(a);
  });
});

describe("BASIC-u2 · AK4 — der Nulltreffer nennt den Suchraum", () => {
  it("eine Suche ohne Treffer sagt, WORIN nichts gefunden wurde", async () => {
    await mount();
    await aufklappen();
    await tippe("Sicherheitsunterweisung");
    expect(text()).not.toContain("Ventilwechsel an Pumpe 4");
    expect(text()).toContain(de("capture.draftEmptyFiltered"));
  });

  it("AK6 — die bestehende Suchfunktion filtert unverändert weiter", async () => {
    await mount();
    await aufklappen();
    await tippe("Ventil");
    expect(text()).toContain("Ventilwechsel an Pumpe 4");
    expect(text()).not.toContain(de("capture.draftEmptyFiltered"));
    // Und das Feld behält Wert und Fokus-Fähigkeit.
    expect(suchfeld().value).toBe("Ventil");
    suchfeld().focus();
    expect(document.activeElement).toBe(suchfeld());
  });
});
