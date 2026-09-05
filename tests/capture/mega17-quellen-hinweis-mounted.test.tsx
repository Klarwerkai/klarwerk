// @vitest-environment jsdom
// AUFTRAG-mega17 Block A — DER HINWEIS STEHT VOR DEM EINREICHEN, NICHT DANACH.
//
// `sourceAttachHint` gab es seit mega16, aber genutzt hat ihn nur der Prüfbereich
// (KnowledgeDetail.tsx:321-325, :1407-1418). Beim ERFASSEN erfuhr der Nutzer erst nach dem
// Einreichen, dass sein Quellenvermerk an der eingestellten Stufe scheitert — ein Formular, das
// erst hinterher „403" sagt, ist keine Erklärung, sondern eine Falle.
//
// Dieser gemountete Test fährt den ECHTEN Klickpfad in CaptureArbeitsraum und belegt beide Fälle der
// Vertragstabelle am manuellen Formular: adresslose Quelle (`unanchored`) und öffentliche Adresse
// (`public-url`) — jeweils SICHTBAR, bevor irgendetwas gespeichert wurde. Und die Gegenprobe: auf
// einer Stufe, die das Anhängen erlaubt, steht kein Hinweis da (kein Daueralarm).
//
// Bewusst DASSELBE Bauteil wie im Prüfbereich (dieselbe reine Funktion, dieselben i18n-Schlüssel):
// kein zweiter Hinweismechanismus, der auseinanderdriften kann.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stufe = vi.hoisted(() => ({ wert: "search_on_click" }));

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
      external: {
        policy: vi.fn(async () => ({ stage: stufe.wert })),
        search: vi.fn(async () => []),
      },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: vi.fn(async () => ({ id: "d1" })),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: false, mode: "cloud", reachable: "inactive" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
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

function inputByPlaceholder(ph: string): HTMLInputElement {
  const el = [...container.querySelectorAll("input")].find((i) => i.placeholder === ph);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Input mit Placeholder „${ph}“ nicht gefunden`);
  }
  return el;
}

async function change(el: HTMLElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

// Der Weg zum manuellen Quellenformular — genau der, den ein Nutzer geht.
async function openSourceForm(): Promise<void> {
  // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
  // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
  // des Blattes und startet offen.
  await click(buttonByText(i18n.t("capture.advanced.title")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  stufe.wert = "search_on_click";
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Erfassen · manuelles Quellenformular: der Hinweis kommt VOR dem Einreichen", () => {
  it("auf der Vorgabestufe search_on_click steht der Grund für eine adresslose Quelle sichtbar am Formular — ohne dass etwas gespeichert wurde", async () => {
    await mount();
    await openSourceForm();

    // Leeres Adressfeld = adresslose Quelle. Genau der Fall, der ohne Anker abgewiesen wird.
    expect(inputByPlaceholder(i18n.t("ko.sourceUrl")).value).toBe("");
    const text = pageText();
    expect(text).toContain(i18n.t("ext.gate.unanchored"));
    expect(text).toContain(i18n.t("ext.gate.how")); // … und der Weg zur Änderung steht dabei.
    // Der Hinweis trägt als <output> implizit role="status" — er wird angesagt, nicht nur gemalt.
    expect(container.querySelector("output")).not.toBeNull();
  });

  it("eine öffentliche Web-Adresse bekommt ihren EIGENEN Grund — die beiden Fälle scheitern an verschiedenen Stellen des Vertrags", async () => {
    await mount();
    await openSourceForm();
    await change(inputByPlaceholder(i18n.t("ko.sourceUrl")), "https://de.wikipedia.org/wiki/Norm");

    const text = pageText();
    expect(text).toContain(i18n.t("ext.gate.publicUrl"));
    expect(text).not.toContain(i18n.t("ext.gate.unanchored"));
  });

  it("GEGENPROBE — auf einer Stufe, die das Anhängen erlaubt, steht KEIN Hinweis da: kein Daueralarm für einen Fall, den es nicht gibt", async () => {
    stufe.wert = "search_attach";
    await mount();
    await openSourceForm();

    const text = pageText();
    expect(text).not.toContain(i18n.t("ext.gate.unanchored"));
    expect(text).not.toContain(i18n.t("ext.gate.publicUrl"));
  });
});
