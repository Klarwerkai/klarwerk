// @vitest-environment jsdom
// ================================================================================================
// JOB 4193 · ENTWURF-MOBIL-DESKTOP-R — DIE ZWEI WEGE AUS DER RÜCKFRAGE, BIS ZUM DESKTOP.
// ================================================================================================
//
// Derselbe echte Dienst wie nebenan (`CaptureService`, `InMemoryDraftRepo`, echter
// `DraftStaleError`), diesmal an einem Entwurf MIT Body — also an dem einen Text, den Handy und
// Vollversion seit JOB 3377 teilen. Gemessen werden beide Ausgänge des Kastens:
//
//   „Neuen Stand holen"     · das Feld zeigt den Serverstand, und die eigene Fassung ist weiterhin
//                             erreichbar (sie geht NICHT verloren, nur weil man nachgesehen hat).
//   „Meine Fassung behalten" · das erneute Speichern gelingt gegen den frisch geholten Stand, der
//                             NACHGELESENE Entwurf trägt die mobile Fassung, der Kasten ist weg —
//                             und die DESKTOP-Fläche, danach geöffnet, zeigt denselben Text.
//
// AUF MAIN (`cedd24de`) ist das rot: es gibt keinen Kasten, also auch keine zwei Wege heraus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_payload: Record<string, unknown>): Promise<string> => "",
  lies: async (_id: string): Promise<Record<string, unknown>> => ({}),
  fremdSchreiben: async (_id: string, _payload: Record<string, unknown>): Promise<void> => {},
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
  const { CaptureService, DraftStaleError } = await import("../../services/capture/src/service");
  const { ApiError } = await import("../../apps/web/src/api/client");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  };
  box.seed = async (payload: P) => (await svc.createDraft(payload, "u1")).id;
  box.lies = async (id: string) => {
    const alle = await svc.listDrafts();
    const treffer = alle.find((d) => d.id === id);
    if (!treffer) {
      throw new Error(`Entwurf ${id} nicht gefunden`);
    }
    return treffer.payload as unknown as P;
  };
  box.fremdSchreiben = async (id: string, payload: P) => {
    await svc.continueDraft(id, payload, "u2");
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      ko: { list: ok([]) },
      conflicts: { list: ok([]) },
      library: { search: ok([]) },
      ask: { ask: ok({ answered: false }) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => (await svc.resumeDraft(id))?.draft),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P, opts?: { expectedUpdatedAt?: string }) => {
          try {
            return await svc.continueDraft(
              id,
              p,
              "u1",
              opts?.expectedUpdatedAt ? { expectedUpdatedAt: opts.expectedUpdatedAt } : {},
            );
          } catch (e) {
            if (e instanceof DraftStaleError) {
              throw new ApiError(409, "DRAFT_STALE", e.message);
            }
            throw e;
          }
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
import { Mobile } from "../../apps/web/src/pages/Mobile";

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

async function mount(seite: "mobile" | "desktop"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const pfad = seite === "mobile" ? "/mobile" : "/erfassen";
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
                  { initialEntries: [{ pathname: pfad, state: { from: "/start" } }] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
                    createElement(Route, {
                      path: "/start",
                      element: createElement("div", null, "START-SEITE"),
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

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
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

function buttonByTitle(title: string): HTMLButtonElement {
  const btn = container.querySelector(`button[title="${title}"]`);
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Titel „${title}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function textfeld(): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Mobiles Textfeld nicht gefunden");
  }
  return el;
}

async function tippe(el: HTMLTextAreaElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function kasten(): HTMLElement | null {
  const el = container.querySelector('[data-testid="mob-stand-konflikt"]');
  return el instanceof HTMLElement ? el : null;
}

/** Der Fliesstext-Editor der DESKTOP-Fläche (`RichTextEditor`, contentEditable mit Textbox-Rolle). */
function desktopEditor(): HTMLElement {
  const el = container.querySelector(
    `[role="textbox"][aria-label="${i18n.t("editor.bodyLabel")}"]`,
  );
  if (!(el instanceof HTMLElement)) {
    throw new Error("Desktop-Editor (Fließtext) nicht gefunden");
  }
  return el;
}

/** Handy laden · Desktop schreibt dazwischen · Handy speichert → der Kasten steht. */
async function bisZumKasten(id: string): Promise<void> {
  await mount("mobile");
  await click(buttonByTitle(i18n.t("mob.resume")));
  expect(textfeld().value).toBe("Ursprung");
  await box.fremdSchreiben(id, { bodyHtml: "<p>Fassung Desktop</p>" });
  await tippe(textfeld(), "Fassung Handy");
  await click(buttonByText(i18n.t("mob.update")));
  expect(kasten()).not.toBeNull();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  box.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("JOB 4193 · die zwei Wege aus der Rückfrage", () => {
  it("die Feldangabe am Entwurf MIT Body nennt den Text — nicht die unsichtbare Kernaussage", async () => {
    const id = await box.seed({ title: "Handbuch", bodyHtml: "<p>Ursprung</p>" });
    await bisZumKasten(id);
    const felder = container.querySelector('[data-testid="mob-stand-felder"]');
    expect(felder?.textContent).toContain(i18n.t("mob.stand.feld.body"));
    expect(felder?.textContent).not.toContain(i18n.t("mob.stand.feld.title"));
    abbauen();
  });

  it("„Neuen Stand holen“ → das Feld zeigt den Serverstand, die eigene Fassung bleibt erreichbar", async () => {
    const id = await box.seed({ title: "Handbuch", bodyHtml: "<p>Ursprung</p>" });
    await bisZumKasten(id);

    await click(buttonByText(i18n.t("mob.stand.holen")));

    expect(textfeld().value).toBe("Fassung Desktop");
    expect(kasten()).toBeNull();
    const meine = container.querySelector('[data-testid="mob-stand-meine-fassung"]');
    expect(meine?.textContent).toContain("Fassung Handy");
    expect(meine?.textContent).toContain(i18n.t("mob.stand.meineFassung"));

    // Sie verschwindet erst, wenn der Mensch sie selbst verwirft.
    await click(buttonByText(i18n.t("mob.stand.verwerfen")));
    expect(container.querySelector('[data-testid="mob-stand-meine-fassung"]')).toBeNull();
    abbauen();

    // Und der Entwurf trägt weiterhin die fremde Fassung — geholt heisst nicht gespeichert.
    expect((await box.lies(id)).bodyHtml).toBe("<p>Fassung Desktop</p>");
  });

  it("nach „Neuen Stand holen“ speichert derselbe Knopf gegen den NEUEN Stand — ohne zweite Rückfrage", async () => {
    const id = await box.seed({ title: "Handbuch", bodyHtml: "<p>Ursprung</p>" });
    await bisZumKasten(id);
    await click(buttonByText(i18n.t("mob.stand.holen")));
    await tippe(textfeld(), "Fassung Desktop\n\nNachtrag vom Handy");
    await click(buttonByText(i18n.t("mob.update")));
    expect(kasten()).toBeNull();
    abbauen();

    expect((await box.lies(id)).bodyHtml).toBe("<p>Fassung Desktop</p><p>Nachtrag vom Handy</p>");
  });

  it("„Meine Fassung behalten“ → gespeichert, Kasten weg, und der DESKTOP zeigt denselben Text", async () => {
    const id = await box.seed({ title: "Handbuch", bodyHtml: "<p>Ursprung</p>" });
    await bisZumKasten(id);

    await click(buttonByText(i18n.t("mob.stand.behalten")));
    expect(kasten()).toBeNull();
    abbauen();

    // NACHGELESEN — nicht am Statuscode gemessen.
    expect((await box.lies(id)).bodyHtml).toBe("<p>Fassung Handy</p>");

    // ... und die Desktop-Fläche, geöffnet: derselbe eine Text (JOB 3377, hier nur gemessen).
    await mount("desktop");
    const aufklapper = maybeButtonByText("Entwürfe anzeigen");
    if (aufklapper) {
      await click(aufklapper);
    }
    await click(buttonByText(i18n.t("capture.resume")));
    expect(desktopEditor().textContent).toContain("Fassung Handy");
    expect(desktopEditor().textContent).not.toContain("Fassung Desktop");
    abbauen();
  });
});
