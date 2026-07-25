// @vitest-environment jsdom
// AUFTRAG-mega6 Block A (bens ROT 1): Eine nicht speicherbare Quellen-URL darf nicht still
// verschwinden. Bewiesen wird am ECHTEN Klickpfad, für jede der vier von ben verlangten Eingaben:
//   1. halb getippte Adresse (`www.beispiel…`)  → Grenze VOR dem Save namentlich sichtbar
//   2. `javascript:`-Eingabe                    → dieselbe Grenze
//   3. leeres URL-Feld                          → keine Grenze, normaler Save
//   4. gültige `https`-URL                      → keine Grenze, wird vollständig gesichert
// Die serverseitige Allowlist bleibt unverändert; geändert hat sich nur, dass die Oberfläche sie
// benennt — vor der Navigation (Wache ohne Speichern-Knopf) und vor dem manuellen Save
// (ausdrückliche Bestätigung). Kein erfolgreicher Save leert das Fragment mehr stillschweigend.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const created: Record<string, unknown>[] = [];
  return {
    created,
    create: (payload: Record<string, unknown>) => {
      created.push(payload);
      return {
        id: `d${created.length}`,
        payload,
        originalAuthor: "u1",
        lastEditor: "u1",
        createdAt: "2026-07-25T10:00:00.000Z",
        updatedAt: "2026-07-25T10:00:00.000Z",
      };
    },
    reset: () => {
      created.length = 0;
    },
  };
});

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
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: vi.fn(async (p: Record<string, unknown>) => db.create(p)),
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const nav = { proceeded: false };

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function NavProbe(): JSX.Element {
  const { guard } = useNavGuard();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "navprobe",
      onClick: () =>
        guard(() => {
          nav.proceeded = true;
        }),
    },
    "navprobe",
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
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
                  ),
                  createElement(NavProbe),
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

// Ausgangslage aller vier Fälle: etwas Speicherbares im Rohtext + geöffnetes Quellenformular.
async function openFormWithText(url: string): Promise<void> {
  await mount();
  await click(buttonByText("Weitere Wege anzeigen"));
  await change(textareaByPlaceholder(i18n.t("capture.rawPlaceholder")), "Kernaussage zur Norm");
  await click(buttonByText(i18n.t("capture.advanced.title")));
  await change(inputByPlaceholder(i18n.t("ko.sourceLabel")), "Handbuch S. 12");
  if (url) {
    await change(inputByPlaceholder(i18n.t("ko.sourceUrl")), url);
  }
}

const reasonFor = (urls: string): string => i18n.t("capture.unsavable.sourceUrl", { urls });

beforeEach(async () => {
  await i18n.changeLanguage("de");
  nav.proceeded = false;
  db.reset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block A: nicht speicherbare Quellen-URL — Grenze steht VOR dem Save", () => {
  for (const url of ["www.beispiel.de/seite", "javascript:alert(1)"]) {
    it(`„${url}": Navigationswache benennt die Adresse und bietet KEIN Speichern an`, async () => {
      await openFormWithText(url);

      // Schon am Feld selbst steht die Grenze — nicht erst im Dialog.
      expect(pageText()).toContain(i18n.t("capture.sourceUrlLimit"));

      nav.proceeded = false;
      await click(
        container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
      );
      const text = pageText();
      expect(text).toContain(i18n.t("nav.guard.unsavableTitle"));
      // NAMENTLICH: die konkrete Adresse steht im Grund, nicht nur „irgendeine Warnung".
      expect(text).toContain(reasonFor(url));
      expect(maybeButtonByText(i18n.t("nav.guard.save"))).toBeNull();
      expect(nav.proceeded).toBe(false);
      // Nichts wurde gespeichert, nichts geleert.
      expect(db.created).toHaveLength(0);
      expect(inputByPlaceholder(i18n.t("ko.sourceUrl")).value).toBe(url);
    });

    it(`„${url}": manueller Save verlangt die ausdrückliche Bestätigung der Grenze`, async () => {
      await openFormWithText(url);

      await click(buttonByText(i18n.t("capture.saveDraft")));
      // Kein stiller Erfolg: erst der Grenzen-Dialog, der die Adresse nennt.
      expect(db.created).toHaveLength(0);
      expect(pageText()).toContain(i18n.t("capture.saveLimit.title"));
      expect(pageText()).toContain(reasonFor(url));

      await click(buttonByText(i18n.t("capture.saveLimit.confirm")));
      expect(db.created).toHaveLength(1);
      // Bewusst bestätigt: Bezeichnung bleibt gesichert, die Adresse ist es nachweislich nicht —
      // aber der Nutzer hat genau das gerade gelesen und bestätigt.
      expect(db.created[0]?.sourceForm).toEqual({
        label: "Handbuch S. 12",
        url,
        excerpt: "",
      });
    });
  }

  it("leeres URL-Feld: keine Grenze — die Wache speichert ganz normal", async () => {
    await openFormWithText("");

    expect(pageText()).not.toContain(i18n.t("capture.sourceUrlLimit"));
    nav.proceeded = false;
    await click(
      container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
    );
    expect(pageText()).toContain(i18n.t("nav.guard.title"));
    await click(buttonByText(i18n.t("nav.guard.save")));
    expect(nav.proceeded).toBe(true);
    expect(db.created).toHaveLength(1);
    expect(db.created[0]?.sourceForm).toEqual({ label: "Handbuch S. 12", url: "", excerpt: "" });
  });

  it("gültige https-URL: keine Grenze — sie wird vollständig gesichert", async () => {
    await openFormWithText("https://example.org/norm");

    expect(pageText()).not.toContain(i18n.t("capture.sourceUrlLimit"));
    nav.proceeded = false;
    await click(
      container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
    );
    expect(pageText()).toContain(i18n.t("nav.guard.title"));
    expect(pageText()).not.toContain(i18n.t("nav.guard.unsavableTitle"));
    await click(buttonByText(i18n.t("nav.guard.save")));
    expect(nav.proceeded).toBe(true);
    expect(db.created[0]?.sourceForm).toEqual({
      label: "Handbuch S. 12",
      url: "https://example.org/norm",
      excerpt: "",
    });
  });

  it("auch eine bereits WARTENDE Quelle mit unspeicherbarer Adresse wird benannt", async () => {
    await openFormWithText("www.beispiel.de/seite");
    // Die halb getippte Adresse wandert in die Warteliste — der Grund wandert mit.
    await click(buttonByText(i18n.t("ko.sourceAdd")));
    expect(inputByPlaceholder(i18n.t("ko.sourceUrl")).value).toBe("");

    await click(buttonByText(i18n.t("capture.saveDraft")));
    expect(pageText()).toContain(reasonFor("www.beispiel.de/seite"));
  });
});
