// @vitest-environment jsdom
// AUFTRAG-mega7 Block A (bens Ship-Blocker): der von ben verlangte VOLLSTÄNDIGE Weg am echten
// Klickpfad — Entwurf MIT Body anlegen → fortsetzen → Body im Studio bewusst leeren →
// aktualisieren → erneut fortsetzen: der Body ist leer. Und weiter: leeren → promoten → das
// entstehende Wissensobjekt trägt KEINEN alten Body.
//
// Beweiskraft wie in mega6: die Draft-Endpunkte laufen NICHT gegen einen Attrappen-Store, sondern
// gegen den ECHTEN CaptureService (InMemoryDraftRepo) — damit greifen die reale Merge-Semantik
// (mergeDraftPayload) und die reale Normalisierung, an denen der stille Rückkehr-Effekt hing. Der
// Promote-Endpunkt bildet die echte Route (capture-routes.ts) nach: toKoInput → KoService.create →
// deleteDraft, mit dem ECHTEN KoService (InMemoryKoRepo). Kein Netz, kein Modelllauf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  updates: [] as Record<string, unknown>[],
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  storedBody: async (_id: string): Promise<unknown> => undefined,
  createdKos: [] as Record<string, unknown>[],
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
  const { InMemoryKoRepo } = await import("../../services/knowledge-object/src/repo");
  const { KoService } = await import("../../services/knowledge-object/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  let koSvc = new KoService({ repo: new InMemoryKoRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    koSvc = new KoService({ repo: new InMemoryKoRepo() });
    box.updates.length = 0;
    box.createdKos.length = 0;
  };
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  box.storedBody = async (id: string) => (await svc.getDraft(id))?.payload.bodyHtml;
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => {
          box.updates.push(p);
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        // Nachbau der echten Promote-Route: Entwurf → KO-Eingabe → KO anlegen → Entwurf entfernen.
        promote: vi.fn(async (id: string) => {
          const input = await svc.toKoInput(id);
          const created = await koSvc.create(input);
          await svc.deleteDraft(id);
          box.createdKos.push(created as unknown as P);
          return created;
        }),
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
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const OLD_BODY = "<p>Alter Absatz, der bewusst entfernt wird</p>";

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
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Body-Editor nicht gefunden");
  }
  return el;
}

// Der Nutzer markiert alles und löscht — im contentEditable bleibt danach ein leerer Knoten.
async function clearEditor(): Promise<void> {
  const el = editor();
  await act(async () => {
    el.innerHTML = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function resumeDraft(): Promise<void> {
  const expand = maybeButtonByText("Entwürfe anzeigen");
  if (expand) {
    await click(expand);
  }
  await click(buttonByText(i18n.t("capture.resume")));
}

// Entwurf MIT Body im geteilten Pool — Herkunft „expert", damit „Fortsetzen" das Formular mit
// Body-Editor, „Als Entwurf speichern" und „Einreichen" öffnet (Capture.tsx loadDraft).
async function seedDraftWithBody(): Promise<string> {
  return box.seed({
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf prüfen.",
    type: "best_practice",
    category: "Instandhaltung",
    bodyHtml: OLD_BODY,
    origin: "expert",
  });
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

describe("Block A: ein bewusst geleerter Body bleibt geleert", () => {
  it("fortsetzen → leeren → aktualisieren → erneut fortsetzen: der alte Body kehrt nicht zurück", async () => {
    const id = await seedDraftWithBody();
    await mount();

    // --- 1. fortsetzen: der gespeicherte Body ist da ------------------------------------------
    await resumeDraft();
    expect(editor().innerHTML).toContain("Alter Absatz");

    // --- 2. bewusst leeren + aktualisieren ----------------------------------------------------
    await clearEditor();
    await click(buttonByText(i18n.t("capture.saveDraft")));

    expect(box.updates).toHaveLength(1);
    // Der Unterschied, um den es geht: der Client sendet den Leerwert AUSDRÜCKLICH mit. Fehlte der
    // Schlüssel, behielte der (richtige) partielle Merge den alten Body.
    expect(box.updates[0]).toHaveProperty("bodyHtml");
    expect(box.updates[0]?.bodyHtml).toBe("");
    expect(await box.storedBody(id)).toBe("");

    // --- 3. erneut fortsetzen: der Body ist leer ----------------------------------------------
    await resumeDraft();
    expect(editor().innerHTML).not.toContain("Alter Absatz");
    expect(editor().textContent ?? "").toBe("");
  });

  it("fortsetzen → leeren → einreichen: das Wissensobjekt trägt keinen alten Body", async () => {
    await seedDraftWithBody();
    await mount();

    await resumeDraft();
    expect(editor().innerHTML).toContain("Alter Absatz");
    await clearEditor();

    // Einreichen aktualisiert den Entwurf und promotet ihn in EINEM Zug (Capture.tsx submit).
    await click(buttonByText(i18n.t("capture.submit")));

    expect(box.createdKos).toHaveLength(1);
    const ko = box.createdKos[0] ?? {};
    // Der Promote-Weg (toKoInput → KO) darf den entfernten Inhalt nicht wiederbeleben — diese
    // Zusicherung zuerst, damit die Gegenprobe ohne Fix genau hier sichtbar bricht.
    expect(JSON.stringify(ko)).not.toContain("Alter Absatz");
    expect(ko.bodyHtml ?? "").toBe("");
    expect(box.updates).toHaveLength(1);
    expect(box.updates[0]?.bodyHtml).toBe("");
    // Titel/Aussage sind unberührt — es wurde gelöscht, nicht kaputtgemacht.
    expect(ko.title).toBe("Dichtungswechsel L4");
  });
});
