// @vitest-environment jsdom
// AUFTRAG-mega9 Block A (KW-E2E-001): der VOLLSTÄNDIGE Weg des externen Prüfers an der Vordertür —
// Entwurf mit Body → fortsetzen → Fließtext vollständig löschen → „Als Entwurf speichern" GELINGT →
// erneut fortsetzen → der Body ist leer.
//
// Der Befund war nicht der Transportweg, sondern der KNOPF: canSave hing an hasBody und sperrte,
// BEVOR buildFrontDoorPayload/draftBodyPatch (mega7) überhaupt erreicht wurden. Der Fix war da, nur
// unerreichbar. Deshalb prüft dieser Test zuerst den Knopfzustand und erst dann die Persistenz.
//
// Beweiskraft wie in mega7: die Draft-Endpunkte laufen gegen den ECHTEN CaptureService
// (InMemoryDraftRepo) — die reale Merge-Semantik (mergeDraftPayload) greift mit. Kein Netz, kein
// Modelllauf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  updates: [] as Record<string, unknown>[],
  creates: [] as Record<string, unknown>[],
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  storedBody: async (_id: string): Promise<unknown> => undefined,
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
    box.creates.length = 0;
  };
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  box.storedBody = async (id: string) => (await svc.getDraft(id))?.payload.bodyHtml;
  return {
    endpoints: {
      drafts: {
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => {
          box.creates.push(p);
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => {
          box.updates.push(p);
          return svc.continueDraft(id, p, "u1");
        }),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      reasoner: { structure: vi.fn(async () => ({})), assist: vi.fn(async () => ({})) },
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
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const OLD_BODY = "<p>Alter Absatz, der bewusst entfernt wird</p>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
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
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
                    // Ziel des Speichern-Erfolgs — ohne diese Route liefe die Navigation ins Leere.
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement("div", null),
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

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Body-Editor nicht gefunden");
  }
  return el;
}

// Der Nutzer markiert alles (⌘A) und löscht (Rücktaste) — im contentEditable bleibt ein leerer Knoten.
async function clearEditor(): Promise<void> {
  const el = editor();
  await act(async () => {
    el.innerHTML = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function typeTitle(value: string): Promise<void> {
  const input = container.querySelector("input");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function seedDraftWithBody(): Promise<string> {
  return box.seed({
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf prüfen.",
    type: "best_practice",
    category: "Allgemein",
    bodyHtml: OLD_BODY,
    origin: "frontdoor",
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AUFTRAG-mega9 Block A (KW-E2E-001): geleerter Vordertür-Text ist speicherbar", () => {
  it("fortsetzen → leeren → Speichern-Knopf ist AKTIV → speichern → erneut fortsetzen: Body ist leer", async () => {
    const id = await seedDraftWithBody();
    await mount(`/capture/frontdoor?draft=${id}`);

    // --- 1. fortsetzen: der gespeicherte Body steht im Editor ----------------------------------
    expect(editor().innerHTML).toContain("Alter Absatz");

    // --- 2. bewusst leeren --------------------------------------------------------------------
    await clearEditor();

    // DAS ist der Befund: vorher war der Knopf hier deaktiviert und der mega7-Fix unerreichbar.
    const saveBtn = buttonByText(i18n.t("erfassen.entwurfSichern"));
    expect(saveBtn.disabled).toBe(false);

    // --- 3. speichern gelingt -----------------------------------------------------------------
    await click(saveBtn);
    expect(box.updates).toHaveLength(1);
    // Der Leerwert reist AUSDRÜCKLICH mit — fehlte der Schlüssel, holte der partielle Merge den
    // alten Body zurück.
    expect(box.updates[0]).toHaveProperty("bodyHtml");
    expect(box.updates[0]?.bodyHtml).toBe("");
    expect(await box.storedBody(id)).toBe("");
    unmount();

    // --- 4. erneut fortsetzen: der Body ist leer -----------------------------------------------
    await mount(`/capture/frontdoor?draft=${id}`);
    expect(editor().innerHTML).not.toContain("Alter Absatz");
    expect(editor().textContent ?? "").toBe("");
    unmount();
  });

  it("neues, vollständig leeres Formular bleibt gesperrt — ein Titel allein macht es speicherbar", async () => {
    await mount("/capture/frontdoor");

    // Leeres Formular ohne alles: die Sperre ist hier RICHTIG und bleibt.
    expect(buttonByText(i18n.t("erfassen.entwurfSichern")).disabled).toBe(true);

    // Titel ohne Body: speicherbar — dieselbe Regel, die der Erfassen-Weg schon fährt
    // (Rohtext ODER Aussage ODER Titel).
    await typeTitle("Nur ein Titel");
    expect(buttonByText(i18n.t("erfassen.entwurfSichern")).disabled).toBe(false);

    await click(buttonByText(i18n.t("erfassen.entwurfSichern")));
    expect(box.creates).toHaveLength(1);
    expect(box.creates[0]?.title).toBe("Nur ein Titel");
    unmount();
  });

  it("Einreichen ohne Inhalt: sichtbare, benannte Begründung am Feld statt still grauem Knopf", async () => {
    await mount("/capture/frontdoor");

    const submitBtn = buttonByText(i18n.t("erfassen.einreichen"));
    // Der Knopf ist ERREICHBAR — ein grauer Knopf ohne Begründung war genau der Befund.
    expect(submitBtn.disabled).toBe(false);
    // Vor dem Versuch steht keine Fehlermeldung im Weg.
    expect(container.querySelector('[data-testid="frontdoor-submit-validation"]')).toBeNull();

    await click(submitBtn);

    // ==========================================================================================
    // JOB 3062 · H3 — DIE BEGRÜNDUNG STEHT WEITER AM FELD, ABER OHNE SATZ.
    // ==========================================================================================
    // Der Auftrag ist ausdrücklich: „ist sie nicht gewählt, bekommt das Menü einen 1 px Rand
    // #A12626 und den Fokus — kein Erklärsatz" (§5.4). Dieselbe Sprache gilt für den fehlenden
    // Inhalt: das Schreibfeld bekommt den Rand. Der Knopf bleibt erreichbar und löst die
    // Markierung aus — das war der Kern von KW-E2E-001 („kein grauer Knopf ohne Begründung") und
    // ist unverändert erfüllt, nur ohne Kasten und ohne Aufzählung.
    const feld = container.querySelector('[data-testid="blatt-text"]');
    expect(feld).not.toBeNull();
    expect(feld?.className ?? "").toContain("ring-trust-crit-fill");
    // Und es ist NICHTS entstanden — der Versuch hat den Server nie erreicht.
    expect(box.creates).toHaveLength(0);
    unmount();
  });
});
