// @vitest-environment jsdom
// AUFTRAG-mega4 Block A (bens Sammel-Review 4, Auflage A): „Entwurf speichern" darf keinen Teil des
// kanonischen Dirty-States still verlieren. bens Blocker: die Navigationswache bot „Entwurf speichern"
// für JEDEN Dirty-Zustand an, rief saveDraft aber nur bei manuellem Text auf; Prüferauswahl, teilweise
// Quelle und externe Suche liefen ohne Sicherung durch, und selbst mit Inhalt persistierte die Payload
// diese Felder nicht. Weg eins (vollständig): der Entwurf trägt jetzt alle inhaltlichen Dirty-Felder und
// der Resume stellt sie wieder her. Diese gemounteten Tests treiben den ECHTEN Klickpfad:
//   je Feld (nur Prüferauswahl / nur Teilquelle / nur externe Suchanfrage): dirty → „Entwurf speichern"
//   in der Navigationswache → der Entwurf wird MIT dem Feld gesichert → nach „Fortsetzen" ist es wieder da.
// Plus ein Pin für den metadata-only-Save (Wissensart, Vertraulichkeit, Prüferminimum).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ein In-Memory-Entwurfs-Pool: create legt ab (und merkt sich die Payload), list liest — so belegt der
// Test die echte Runde Speichern → Liste → Fortsetzen ohne echten Server.
const db = vi.hoisted(() => {
  const store: { id: string; payload: unknown; [k: string]: unknown }[] = [];
  const created: Record<string, unknown>[] = [];
  return {
    store,
    created,
    create: (payload: Record<string, unknown>) => {
      created.push(payload);
      const draft = {
        id: `d${store.length + 1}`,
        payload,
        originalAuthor: "u1",
        lastEditor: "u1",
        createdAt: "2026-07-25T10:00:00.000Z",
        updatedAt: "2026-07-25T10:00:00.000Z",
      };
      store.push(draft);
      return draft;
    },
    reset: () => {
      store.length = 0;
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
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([{ id: "p2", name: "Bob Pruefer", email: "b@x.de", role: "editor" }]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => [...db.store]),
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

// Sonde: löst über die ECHTE Navigationswache einen Seitenwechsel aus. Dirty ⇒ Dialog statt Wechsel.
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

async function change(el: HTMLInputElement | HTMLSelectElement, value: string): Promise<void> {
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

function maybeInputByPlaceholder(ph: string): HTMLInputElement | null {
  const el = [...container.querySelectorAll("input")].find((i) => i.placeholder === ph);
  return el instanceof HTMLInputElement ? el : null;
}

function selectByValue(value: string): HTMLSelectElement {
  const el = [...container.querySelectorAll("select")].find((s) => s.value === value);
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error(`Select mit Wert „${value}“ nicht gefunden`);
  }
  return el;
}

async function openWorkspaceAndAdvanced(): Promise<void> {
  await click(buttonByText("Weitere Wege anzeigen"));
  await click(buttonByText(i18n.t("capture.advanced.title")));
}

// „Entwurf speichern" über die ECHTE Navigationswache klicken (nicht direkt saveDraft).
async function saveViaNavGuard(): Promise<void> {
  nav.proceeded = false;
  await click(
    container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
  );
  // Dirty ⇒ die Wache fragt, statt zu wechseln.
  expect((container.textContent ?? "").includes(i18n.t("nav.guard.title"))).toBe(true);
  await click(buttonByText(i18n.t("nav.guard.save")));
  // Nach erfolgreichem Speichern wechselt die Wache durch (Dialog zu).
  expect(nav.proceeded).toBe(true);
}

// Den gerade gesicherten Entwurf über die Liste „Entwürfe fortsetzen" wieder öffnen.
async function resumeSavedDraft(): Promise<void> {
  // Liste ist standardmäßig eingeklappt → zuerst aufklappen, dann „Fortsetzen".
  const expand = maybeButtonByText("Entwürfe anzeigen");
  if (expand) {
    await click(expand);
  }
  await click(buttonByText(i18n.t("capture.resume")));
  // Erweiterte Details öffnen, falls der Resume sie nicht schon aufgeklappt hat.
  if (!maybeInputByPlaceholder(i18n.t("ko.sourceLabel")) && !maybeButtonByText("Bob Pruefer")) {
    const adv = maybeButtonByText(i18n.t("capture.advanced.title"));
    if (adv) {
      await click(adv);
    }
  }
}

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

describe("Block A: Entwurf speichern sichert den vollständigen Dirty-State und stellt ihn wieder her", () => {
  it("NUR Prüferauswahl: wird gesichert und nach Fortsetzen wiederhergestellt", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    await click(buttonByText("Bob Pruefer"));
    expect(buttonByText("Bob Pruefer").getAttribute("aria-pressed")).toBe("true");

    await saveViaNavGuard();

    // Persistiert: die Payload trägt die Prüferauswahl (kein stiller Verlust).
    expect(db.created).toHaveLength(1);
    expect((db.created[0] as { reviewerIds?: string[] }).reviewerIds).toEqual(["p2"]);

    await resumeSavedDraft();
    // Wiederhergestellt: der Prüfer ist wieder ausgewählt.
    expect(buttonByText("Bob Pruefer").getAttribute("aria-pressed")).toBe("true");
  });

  it("NUR teilweise Quelle: wird gesichert und nach Fortsetzen wiederhergestellt", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    await change(inputByPlaceholder(i18n.t("ko.sourceLabel")), "Handbuch S. 12");

    await saveViaNavGuard();

    expect(db.created).toHaveLength(1);
    expect((db.created[0] as { sourceForm?: { label?: string } }).sourceForm?.label).toBe(
      "Handbuch S. 12",
    );

    await resumeSavedDraft();
    expect(inputByPlaceholder(i18n.t("ko.sourceLabel")).value).toBe("Handbuch S. 12");
  });

  it("NUR externe Suchanfrage: wird gesichert und nach Fortsetzen wiederhergestellt", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    await change(inputByPlaceholder(i18n.t("ext.placeholder")), "Dichtung Norm");

    await saveViaNavGuard();

    expect(db.created).toHaveLength(1);
    expect((db.created[0] as { extQuery?: string }).extQuery).toBe("Dichtung Norm");

    await resumeSavedDraft();
    expect(inputByPlaceholder(i18n.t("ext.placeholder")).value).toBe("Dichtung Norm");
  });

  it("metadata-only-Save: Wissensart, Vertraulichkeit und Prüferminimum wandern in den Entwurf", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const typeSel = selectByValue("best_practice");
    const otherType = [...typeSel.options].map((o) => o.value).find((v) => v !== "best_practice");
    const confSel = selectByValue("intern");
    const otherConf = [...confSel.options].map((o) => o.value).find((v) => v !== "intern");
    const numberInput = [...container.querySelectorAll("input")].find(
      (i) => i.type === "number",
    ) as HTMLInputElement;

    await change(typeSel, otherType as string);
    await change(confSel, otherConf as string);
    await change(numberInput, "2");

    await saveViaNavGuard();

    expect(db.created).toHaveLength(1);
    const payload = db.created[0] as {
      type?: string;
      confidentiality?: string;
      neededValidations?: number;
    };
    expect(payload.type).toBe(otherType);
    expect(payload.confidentiality).toBe(otherConf);
    expect(payload.neededValidations).toBe(2);
  });
});
