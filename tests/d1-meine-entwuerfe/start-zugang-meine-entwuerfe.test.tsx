// @vitest-environment jsdom
// ================================================================================================
// JOB 3266 · D1 — DIE STARTSEITE NENNT DEN WEG ZU DEN EIGENEN ENTWÜRFEN.
// ================================================================================================
//
// PEDIS BEFUND (Vorführung 07.09.): Beim späteren Besuch — neue Anmeldung, kein `?draft=`-Link in
// der Hand — fand er seinen gesicherten Entwurf nicht wieder. Die Startseite ist der Ort, an dem
// der Besuch beginnt; sie nannte den Weg bis hierher überhaupt nicht.
//
// A1 der Zugang steht sichtbar auf Start, DE und EN, als echter Link (Tabulatorlauf)
// A2 DIE BINDUNG: genau die Adresse, die dieser Link trägt, öffnet in der Erfassung die Titelliste.
//    Das ist der Fall, der die zwei Enden zusammenhält — ohne ihn könnte die Startseite auf eine
//    Adresse zeigen, die das Blatt gar nicht als Öffnungsbefehl liest, und beide Hälften wären für
//    sich grün.
// A3 wer die Erfassung nicht betreten darf, bekommt keinen Weg vorgegaukelt (Regel mega51 A2)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rolle = vi.hoisted(() => ({ current: "admin" as string }));
const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
}));

// Hausform der rollengetriebenen Mount-Tests (vgl. `tests/app/mega51-startziele-erreichbar-
// mounted.test.tsx`): die Rolle kommt aus dem gemockten RoleContext.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  RoleProvider: ({ children }: { children: unknown }) => children,
  useRole: () => ({
    role: rolle.current,
    stufe2: false,
    setRole: () => {},
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
    previewActive: false,
  }),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: rolle.current })),
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
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      // Der Entwurfsbestand ist echt (CaptureService) — A2 misst die geöffnete Liste, nicht eine
      // Attrappe davon.
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      // Die Quellen der Startseite — dieselbe Menge wie in mega51: ohne sie bliebe die Karte
      // „FÜR DICH" im Ladezustand und der Aufbau risse an einem halben `endpoints`-Objekt ab.
      validation: { board: ok([]), settings: ok({ defaultNeededValidations: 3 }) },
      conflicts: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: {
        summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }),
        list: ok([]),
      },
      notifications: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok(null) },
      duplicateSignal: { list: ok([]) },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      ko: { list: ok([]) },
      knowledge: { check: ok({ status: "pending" }) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      analytics: { overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "unknown" }),
        config: ok(null),
        assistPresets: ok([]),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
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
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { markStartOrientationSeen } from "../../apps/web/src/lib/startOrientation";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { Start } from "../../apps/web/src/pages/Start";

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

async function mount(url: string, alsRolle = "admin"): Promise<void> {
  rolle.current = alsRolle;
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
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/start", element: createElement(Start) }),
                    createElement(Route, {
                      path: "/erfassen",
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

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function zugang(): HTMLElement {
  const el = container.querySelector('[data-testid="h5-start-entwuerfe"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error('Der Zugang „Meine Entwürfe" fehlt auf der Startseite');
  }
  return el;
}

const NIT = {
  title: "NIT-Prüfplan Spritzzone",
  bodyHtml: "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>",
  type: "best_practice",
  category: "Anlage 1",
};

beforeEach(async () => {
  window.localStorage.clear();
  // Ohne diesen Vermerk wäre jeder Lauf ein Erstbesuch und die Karte trüge zusätzlich die Zeile
  // „Ersteinrichtung" — gemessen wird die wiederkehrende Nutzerin, um die es im Befund geht.
  markStartOrientationSeen(window.localStorage);
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(async () => {
  unmount();
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

describe('JOB 3266 D1 · „Meine Entwürfe" steht auf der Startseite', () => {
  it("A1: der Zugang ist sichtbar, übersetzt und ein echter Link im Tabulatorlauf", async () => {
    await mount("/start");
    const de = zugang();
    expect(de.tagName, "kein echter Link — Tab und Enter erreichen ihn dann nicht").toBe("A");
    expect((de.textContent ?? "").trim()).toBe(i18n.t("fd.saved.toDrafts"));
    expect(de.getAttribute("href")).toBe("/erfassen?entwuerfe=1");
    de.focus();
    expect(document.activeElement).toBe(de);
    const deutsch = (de.textContent ?? "").trim();

    unmount();
    await i18n.changeLanguage("en");
    await mount("/start");
    const en = zugang();
    expect((en.textContent ?? "").trim()).toBe(i18n.t("fd.saved.toDrafts"));
    expect((en.textContent ?? "").trim()).toBe("My drafts");
    expect((en.textContent ?? "").trim()).not.toBe(deutsch);
    expect(en.getAttribute("href")).toBe("/erfassen?entwuerfe=1");
  });

  it("A2: genau die Adresse dieses Links öffnet in der Erfassung die Titelliste", async () => {
    const kennung = await box.seed(NIT);
    await mount("/start");
    // Die Adresse wird GELESEN, nicht abgeschrieben: was hier weiterverwendet wird, ist der
    // Wortlaut des gerenderten Links.
    const adresse = zugang().getAttribute("href") ?? "";
    expect(adresse.length).toBeGreaterThan(0);
    unmount();

    await mount(adresse);
    const flaeche = container.querySelector('[data-testid="blatt-menue-mehr"]');
    expect(flaeche, "die Adresse der Startseite öffnet die Entwurfsliste nicht").not.toBeNull();
    const zeilen = [...container.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]')];
    expect(zeilen.map((z) => z.getAttribute("data-entwurf"))).toEqual([kennung]);
    expect(flaeche?.textContent ?? "").toContain(NIT.title);
  });

  it("A3: wer die Erfassung nicht betreten darf, bekommt keinen Weg vorgegaukelt", async () => {
    // `/erfassen` verlangt die Rolle „Experte" (app/navigation.ts). Die Regel ist dieselbe, die auf
    // dieser Seite für jede andere Zeile gilt (mega51 A2): die Angabe verschwindet nicht, sie hört
    // auf, ein Weg zu sein — und die Sperre ist benannt.
    await mount("/start", "leser");
    const gesperrt = zugang();
    expect(gesperrt.tagName).not.toBe("A");
    expect(gesperrt.getAttribute("data-role-no-reach")).toBe("true");
    expect(gesperrt.textContent ?? "").toContain(i18n.t("roleLink.noReach"));
    unmount();

    // Und für die Rolle, die erfassen darf, ist es unverändert ein Weg — sonst prüfte der Fall
    // oben nur, dass irgendetwas gesperrt ist.
    await mount("/start", "experte");
    expect(zugang().tagName).toBe("A");
    expect(zugang().getAttribute("href")).toBe("/erfassen?entwuerfe=1");
  });
});
