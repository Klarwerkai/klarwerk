// @vitest-environment jsdom
// ================================================================================================
// JOB 4193 · ENTWURF-MOBIL-DESKTOP-R — DAS HANDY FRAGT NACH, STATT STILL ZU ÜBERSCHREIBEN.
// ================================================================================================
//
// GEFAHREN WIRD DIE GANZE KETTE, an DEMSELBEN echten Dienst, den auch der Desktop benutzt
// (`CaptureService` mit `InMemoryDraftRepo`, echte `mergeDraftPayload`- und
// `sanitizeDraftPayload`-Grenze, echter `DraftStaleError`): Handy lädt den Entwurf → ein zweiter
// Schreiber (Desktop) ändert ihn → Handy speichert → die Route antwortet 409 `DRAFT_STALE`.
//
// DER BEWEIS IST NICHT DER KASTEN, SONDERN DAS NACHLESEN (Lehre JOB 4141 R2: eine HTTP-Antwort
// allein belegt keine Wirkung). Nach dem abgewiesenen Speichern wird der Entwurf im Dienst GELESEN
// und trägt unverändert die Fassung des zweiten Schreibers.
//
// AUF MAIN (`cedd24de`) IST DAS ROT, und zwar doppelt: es gibt keinen Kasten, und der Stand reiste
// gar nicht erst mit — das Überschreiben ging mit 200 durch (`formToPayload` kannte keinen Stand,
// `Mobile.tsx` warf jeden Fehler in denselben roten Toast).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_payload: Record<string, unknown>): Promise<string> => "",
  lies: async (_id: string): Promise<Record<string, unknown>> => ({}),
  fremdSchreiben: async (_id: string, _payload: Record<string, unknown>): Promise<void> => {},
  updates: [] as { id: string; opts: { expectedUpdatedAt?: string } | undefined }[],
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
    box.updates.length = 0;
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
  // Der ZWEITE Schreiber — der Desktop. Er schreibt mit dem Stand, den er selbst gesehen hat.
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
          box.updates.push({ id, opts });
          try {
            return await svc.continueDraft(
              id,
              p,
              "u1",
              opts?.expectedUpdatedAt ? { expectedUpdatedAt: opts.expectedUpdatedAt } : {},
            );
          } catch (e) {
            // Genau die Übersetzung, die `services/app/src/routes/capture-routes.ts` fährt.
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
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
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

/**
 * Der Toast-Anbieter ZEICHNET NICHTS (`app/ToastContext.tsx`) — die Meldungen hängen in seinem
 * Zustand. Ohne diesen Zuhörer wäre „kein ‚gespeichert'-Toast" eine Behauptung über einen Ort, an
 * dem ohnehin nie etwas steht, also gar keine Prüfung.
 */
function ToastSpion(): JSX.Element {
  const { toasts } = useToast();
  return createElement(
    "ul",
    { "data-testid": "toasts" },
    toasts.map((toast) => createElement("li", { key: toast.id }, toast.message)),
  );
}

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
                createElement(ToastSpion),
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

function titelfeld(): HTMLInputElement {
  const el = container.querySelector("input");
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Mobiles Titelfeld nicht gefunden");
  }
  return el;
}

async function tippe(el: HTMLTextAreaElement | HTMLInputElement, wert: string): Promise<void> {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
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

function toasts(): string {
  return (container.querySelector('[data-testid="toasts"]')?.textContent ?? "").replace(
    /\s+/g,
    " ",
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  box.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("JOB 4193 · veralteter Stand am Handy — Rückfrage statt stillem Überschreiben", () => {
  it("Desktop schreibt dazwischen → Kasten mit Feldangabe, Text bleibt, kein „gespeichert“, und der Entwurf trägt weiter die fremde Fassung", async () => {
    const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });

    await mount();
    await click(buttonByTitle(i18n.t("mob.resume")));
    expect(kasten()).toBeNull(); // vor dem Speichern nichts

    // Der zweite Schreiber — NACH dem Laden am Handy.
    await box.fremdSchreiben(id, { statement: "Fassung Desktop" });

    await tippe(textfeld(), "Fassung Handy");
    await click(buttonByText(i18n.t("mob.update")));

    // Der gesehene Stand IST mitgereist — das ist die Grundlage des Vergleichs.
    expect(box.updates).toHaveLength(1);
    expect(box.updates[0]?.opts?.expectedUpdatedAt).toBeTruthy();

    // Der Kasten steht da und nennt GENAU das abweichende Feld.
    const k = kasten();
    expect(k).not.toBeNull();
    expect(k?.textContent).toContain(i18n.t("mob.stand.titelSpeichern"));
    const felder = container.querySelector('[data-testid="mob-stand-felder"]');
    expect(felder?.textContent).toContain(i18n.t("mob.stand.feld.statement"));
    expect(felder?.textContent).not.toContain(i18n.t("mob.stand.feld.title"));

    // Der eingetippte Text steht unverändert im Feld, das Formular ist NICHT zurückgesetzt.
    expect(textfeld().value).toBe("Fassung Handy");
    expect(titelfeld().value).toBe("Wartung der Presse");
    expect(buttonByText(i18n.t("mob.update"))).toBeDefined();

    // Kein „gespeichert", kein roter Sammelfehler.
    expect(toasts()).not.toContain(i18n.t("mob.updated"));
    expect(toasts()).not.toContain(i18n.t("mob.saved"));
    expect(toasts()).not.toContain(i18n.t("state.error"));
    abbauen();

    // DER EIGENTLICHE BEWEIS: nachgelesen. Nichts wurde überschrieben.
    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("die Feldangabe nennt BEIDE Felder, wenn beide auseinanderlaufen", async () => {
    const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });
    await mount();
    await click(buttonByTitle(i18n.t("mob.resume")));
    await box.fremdSchreiben(id, { title: "Presse, neu betitelt", statement: "Fassung Desktop" });
    await tippe(titelfeld(), "Titel vom Handy");
    await tippe(textfeld(), "Fassung Handy");
    await click(buttonByText(i18n.t("mob.update")));

    const felder = container.querySelector('[data-testid="mob-stand-felder"]');
    expect(felder?.textContent).toContain(i18n.t("mob.stand.feld.title"));
    expect(felder?.textContent).toContain(i18n.t("mob.stand.feld.statement"));
    abbauen();
    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("GEGENPROBE: ohne fremde Änderung wird gespeichert wie bisher — kein Kasten, Toast „aktualisiert“", async () => {
    const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });
    await mount();
    await click(buttonByTitle(i18n.t("mob.resume")));
    await tippe(textfeld(), "Fassung Handy");
    await click(buttonByText(i18n.t("mob.update")));

    expect(kasten()).toBeNull();
    expect(toasts()).toContain(i18n.t("mob.updated"));
    expect(textfeld().value).toBe(""); // Formular zurückgesetzt wie bisher
    abbauen();
    expect((await box.lies(id)).statement).toBe("Fassung Handy");
  });

  it("KALIBRIERUNG: ein anderer Fehler öffnet KEINEN Kasten — und behauptet auch kein „nicht gespeichert“", async () => {
    await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });
    await mount();
    await click(buttonByTitle(i18n.t("mob.resume")));
    await tippe(textfeld(), "Fassung Handy");
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    vi.mocked(endpoints.drafts.update).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await click(buttonByText(i18n.t("mob.update")));

    expect(kasten()).toBeNull();
    // Lieferung 4: die Antwort fehlt — also weder „gespeichert" noch „nicht gespeichert".
    expect(toasts()).toContain(i18n.t("mob.ausgangUnklar"));
    expect(toasts()).not.toContain(i18n.t("mob.updated"));
    expect(textfeld().value).toBe("Fassung Handy");
    abbauen();
  });
});
