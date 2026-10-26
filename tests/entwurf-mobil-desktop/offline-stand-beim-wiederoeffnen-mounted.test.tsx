// @vitest-environment jsdom
// ================================================================================================
// JOB 4193 · ENTWURF-MOBIL-DESKTOP-R — OFFLINE GESPEICHERT, SERVERSTAND GEÄNDERT, WIEDER GEÖFFNET.
// ================================================================================================
//
// DIE GRENZE, die `Mobile.tsx` seit JOB 3377 selbst benannt hat, war: „die Warteschlange kennt
// keinen Standvergleich … ein offline bearbeiteter Body geht beim Nachsynchronisieren nach dem
// bisherigen Vertrag ‚letzter Schreiber gewinnt' raus". Genau das wird hier gemessen — und zwar an
// DEM Punkt, an dem es weh tut: der Entwurf, den der Desktop inzwischen geändert hat.
//
// GEFAHREN WIRD DIE ECHTE KETTE: echter `CaptureService`, echte Offline-Warteschlange (echtes
// `localStorage`, echte `online`/`offline`-Ereignisse), echter `DraftStaleError`.
//
//   1. offline speichern            → der Vorgang liegt in der Warteschlange, MIT gesehenem Stand;
//   2. der Desktop schreibt         → der Serverstand ist ein anderer;
//   3. Verbindung kommt zurück      → das Nachsenden wird ABGEWIESEN. Der Entwurf trägt weiter die
//                                     Fassung des Desktops (nachgelesen), der Vorgang bleibt liegen;
//   4. Entwurf wieder geöffnet      → beide Fassungen stehen nebeneinander, mit Feldangabe;
//   5. die Wahl ERSETZT den Vorgang → er ist danach noch da, mit der gewählten Nutzlast.
//
// GEGENPROBE im selben Lauf: sind die offline liegende und die Server-Fassung GLEICH, erscheint
// keine Rückfrage. Ein Standvergleich, der nichts findet, schweigt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_payload: Record<string, unknown>): Promise<string> => "",
  lies: async (_id: string): Promise<Record<string, unknown>> => ({}),
  fremdSchreiben: async (_id: string, _payload: Record<string, unknown>): Promise<void> => {},
  /** Das Netz ist weg, ohne dass der Browser es schon gemerkt hat — für die Gegenprobe. */
  netzAus: false,
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
    box.netzAus = false;
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
          if (box.netzAus) {
            throw new TypeError("Failed to fetch");
          }
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
import type { VorgangMitStand } from "../../apps/web/src/app/useOfflineQueue";
import i18n from "../../apps/web/src/i18n";
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

async function mount(): Promise<void> {
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
                  { initialEntries: [{ pathname: "/mobile", state: { from: "/start" } }] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
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

function warteschlange(): VorgangMitStand[] {
  return JSON.parse(localStorage.getItem("kw.offlineQueue.v1") ?? "[]") as VorgangMitStand[];
}

/** Verbindung an oder aus — `navigator.onLine` UND das Ereignis, wie im echten Browser. */
async function netz(an: boolean): Promise<void> {
  Object.defineProperty(navigator, "onLine", { value: an, configurable: true });
  await act(async () => {
    window.dispatchEvent(new Event(an ? "online" : "offline"));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  box.reset();
});

afterEach(async () => {
  await netz(true);
  vi.clearAllMocks();
});

describe("JOB 4193 · offline gespeichert, Serverstand geändert, wieder geöffnet", () => {
  it("das Nachsenden überschreibt nicht — und beim Wiederöffnen stehen beide Fassungen da", async () => {
    const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });

    await mount();
    await click(buttonByTitle(i18n.t("mob.resume")));
    await netz(false);
    await tippe(textfeld(), "Fassung Handy, offline");
    await click(buttonByText(i18n.t("mob.update")));

    // Der Vorgang liegt in der Warteschlange — MIT dem beim Bearbeiten gesehenen Stand.
    const liegend = warteschlange();
    expect(liegend).toHaveLength(1);
    expect(liegend[0]?.draftId).toBe(id);
    expect(liegend[0]?.seenUpdatedAt).toBeTruthy();

    // Der Desktop schreibt, während das Handy ohne Verbindung ist.
    await box.fremdSchreiben(id, { statement: "Fassung Desktop" });

    // Verbindung zurück → das Nachsenden läuft an und wird ABGEWIESEN.
    await netz(true);
    expect((await box.lies(id)).statement).toBe("Fassung Desktop"); // nichts überschrieben
    const nachSync = warteschlange();
    expect(nachSync).toHaveLength(1); // nichts verloren
    expect(nachSync[0]?.status).toBe("failed");

    // Wieder geöffnet: beide Fassungen, mit Feldangabe.
    await click(buttonByTitle(i18n.t("mob.resume")));
    const k = kasten();
    expect(k).not.toBeNull();
    expect(k?.textContent).toContain(i18n.t("mob.stand.titelOffline"));
    expect(container.querySelector('[data-testid="mob-stand-felder"]')?.textContent).toContain(
      i18n.t("mob.stand.feld.statement"),
    );
    expect(container.querySelector('[data-testid="mob-stand-offline"]')?.textContent).toContain(
      "Fassung Handy, offline",
    );
    expect(container.querySelector('[data-testid="mob-stand-server"]')?.textContent).toContain(
      "Fassung Desktop",
    );
    // Der eigene Text steht dabei im Feld — er ist nie weg.
    expect(textfeld().value).toBe("Fassung Handy, offline");

    // Die Wahl ERSETZT den Vorgang; sie löscht ihn nicht.
    await click(buttonByText(i18n.t("mob.stand.behalten")));
    expect(kasten()).toBeNull();
    const gewaehlt = warteschlange();
    expect(gewaehlt).toHaveLength(1);
    expect(gewaehlt[0]?.payload.statement).toBe("Fassung Handy, offline");
    expect(gewaehlt[0]?.status).toBe("queued");

    // Und jetzt geht er raus — gegen den Stand, den der Mensch gesehen hat.
    await click(buttonByText(i18n.t("mob.syncNow")));
    abbauen();
    expect((await box.lies(id)).statement).toBe("Fassung Handy, offline");
  });

  it("„Neuen Stand holen“ ersetzt den liegenden Vorgang durch die Serverfassung — gelöscht wird er nie", async () => {
    const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });
    await mount();
    await click(buttonByTitle(i18n.t("mob.resume")));
    await netz(false);
    await tippe(textfeld(), "Fassung Handy, offline");
    await click(buttonByText(i18n.t("mob.update")));
    await box.fremdSchreiben(id, { statement: "Fassung Desktop" });
    await netz(true);
    await click(buttonByTitle(i18n.t("mob.resume")));
    expect(kasten()).not.toBeNull();

    await click(buttonByText(i18n.t("mob.stand.holen")));
    expect(textfeld().value).toBe("Fassung Desktop");
    expect(
      container.querySelector('[data-testid="mob-stand-meine-fassung"]')?.textContent,
    ).toContain("Fassung Handy, offline");
    const ersetzt = warteschlange();
    expect(ersetzt).toHaveLength(1);
    expect(ersetzt[0]?.payload.statement).toBe("Fassung Desktop");

    await click(buttonByText(i18n.t("mob.syncNow")));
    abbauen();
    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("GEGENPROBE: gleiche Fassung offline und auf dem Server → KEINE Rückfrage", async () => {
    const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });
    await mount();
    await click(buttonByTitle(i18n.t("mob.resume")));
    await netz(false);
    // Offline gespeichert, ohne etwas zu ändern — die Fassungen sind gleich.
    await click(buttonByText(i18n.t("mob.update")));
    expect(warteschlange()).toHaveLength(1);

    // Das Nachsenden scheitert am Netz (nicht am Stand) — der Vorgang bleibt liegen.
    box.netzAus = true;
    await netz(true);
    expect(warteschlange()).toHaveLength(1);

    box.netzAus = false;
    await click(buttonByTitle(i18n.t("mob.resume")));
    expect(kasten()).toBeNull();
    expect(container.querySelector('[data-testid="mob-stand-meine-fassung"]')).toBeNull();
    expect(textfeld().value).toBe("Ursprung");
    abbauen();
    expect((await box.lies(id)).statement).toBe("Ursprung");
  });
});
