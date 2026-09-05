// @vitest-environment jsdom
// AUFTRAG-mega6 Block B (bens ROT 2): der von ben verlangte VOLLSTÄNDIGE Zyklus am echten Klickpfad —
// Entwurf mit allen Werten anlegen → fortsetzen → ALLE Werte entfernen → aktualisieren → erneut
// fortsetzen. Kein entfernter Wert darf wiederkehren.
//
// Entscheidend für die Beweiskraft: die Draft-Endpunkte laufen hier NICHT gegen einen Attrappen-Store,
// sondern gegen den ECHTEN CaptureService mit InMemoryDraftRepo. Damit greifen die reale
// Merge-Semantik (mergeDraftPayload) und die reale Normalisierung (normalizeDraftPayload) — genau die
// Kombination, an der der stille Rückkehr-Effekt hing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  updates: [] as Record<string, unknown>[],
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
    box.updates.length = 0;
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: {
        list: ok([{ id: "p2", name: "Bob Pruefer", email: "b@x.de", role: "editor" }]),
      },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => {
          box.updates.push(p);
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
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

function maybeButtonByText(part: string): HTMLButtonElement | null {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  return btn instanceof HTMLButtonElement ? btn : null;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function setNativeValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
}

async function change(el: HTMLElement, value: string): Promise<void> {
  setNativeValue(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
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

function textareaByPlaceholder(ph: string): HTMLTextAreaElement {
  const el = [...container.querySelectorAll("textarea")].find((i) => i.placeholder === ph);
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error(`Textarea mit Placeholder „${ph}“ nicht gefunden`);
  }
  return el;
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

async function resumeDraft(): Promise<void> {
  const expand = maybeButtonByText("Entwürfe anzeigen");
  if (expand) {
    await click(expand);
  }
  await click(buttonByText(i18n.t("capture.resume")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block B: entfernte Werte bleiben nach Aktualisieren und Fortsetzen entfernt", () => {
  it("voller Zyklus — Prüfer, Quellen, Quellenformular und Suchanfrage kehren nicht zurück", async () => {
    await mount();
    // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
    // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
    // des Blattes und startet offen.
    await change(textareaByPlaceholder(i18n.t("capture.rawPlaceholder")), "Kernaussage zur Norm");
    await click(buttonByText(i18n.t("capture.advanced.title")));

    // --- 1. anlegen: alle vier Strukturen tragen Inhalt -------------------------------------
    await click(buttonByText("Bob Pruefer"));
    await change(inputByPlaceholder(i18n.t("ko.sourceLabel")), "Handbuch S. 12");
    await change(inputByPlaceholder(i18n.t("ko.sourceUrl")), "https://example.org/handbuch");
    await click(buttonByText(i18n.t("ko.sourceAdd")));
    await change(inputByPlaceholder(i18n.t("ko.sourceLabel")), "Angefangene Notiz");
    await change(inputByPlaceholder(i18n.t("ext.placeholder")), "Dichtung Norm");
    await click(buttonByText(i18n.t("capture.saveDraft")));

    // --- 2. fortsetzen: alles ist wieder da --------------------------------------------------
    await resumeDraft();
    expect(pageText()).toContain("Handbuch S. 12");
    expect(pageText()).toContain(i18n.t("capture.reviewers.selected", { n: 1 }));
    expect(inputByPlaceholder(i18n.t("ko.sourceLabel")).value).toBe("Angefangene Notiz");
    expect(inputByPlaceholder(i18n.t("ext.placeholder")).value).toBe("Dichtung Norm");

    // --- 3. ALLES entfernen ------------------------------------------------------------------
    await click(buttonByText("Bob Pruefer")); // Prüfer abwählen
    const removeSource = container.querySelector<HTMLButtonElement>(
      `button[title="${i18n.t("ko.sourceRemove")}"]`,
    );
    if (!removeSource) {
      throw new Error("Entfernen-Knopf der Quelle nicht gefunden");
    }
    await click(removeSource);
    await change(inputByPlaceholder(i18n.t("ko.sourceLabel")), "");
    await change(inputByPlaceholder(i18n.t("ext.placeholder")), "");

    // --- 4. aktualisieren --------------------------------------------------------------------
    await click(buttonByText(i18n.t("capture.saveDraft")));
    expect(box.updates).toHaveLength(1);
    // Weg zwei: der Client sendet die Leerwerte AUSDRÜCKLICH mit — sonst holte der Merge die
    // Altwerte zurück. Genau das ist der Unterschied zu „Feld nicht mitgeschickt".
    expect(box.updates[0]?.reviewerIds).toEqual([]);
    expect(box.updates[0]?.pendingSources).toEqual([]);
    expect(box.updates[0]?.sourceForm).toEqual({ label: "", url: "", excerpt: "" });
    expect(box.updates[0]?.extQuery).toBe("");

    // --- 5. erneut fortsetzen: nichts kehrt zurück -------------------------------------------
    await resumeDraft();
    const text = pageText();
    expect(text).not.toContain("Handbuch S. 12");
    expect(text).not.toContain("Angefangene Notiz");
    expect(text).not.toContain(i18n.t("capture.reviewers.selected", { n: 1 }));
    expect(inputByPlaceholder(i18n.t("ko.sourceLabel")).value).toBe("");
    expect(inputByPlaceholder(i18n.t("ext.placeholder")).value).toBe("");
    // Datenminimierung: die gelöschte Suchanfrage ist auch der Trefferlisten-Hinweis los.
    expect(text).not.toContain(i18n.t("ext.resumeHint"));
    // Der Entwurf selbst lebt weiter — es wurde gelöscht, nicht kaputtgemacht.
    expect(textareaByPlaceholder(i18n.t("capture.rawPlaceholder")).value).toBe(
      "Kernaussage zur Norm",
    );
  });
});
