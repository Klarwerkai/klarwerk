// @vitest-environment jsdom
// ================================================================================================
// Aufnahme gesamt-integrations-api · R-0842 — STRUKTURIERUNG UND KI-ASSISTENT IM ERFASSUNGSBLATT.
// ================================================================================================
//
// Bens Befund (Nacharbeit 4): `POST /api/reasoner` steht unter der KI-Bremse
// (`services/app/src/ki-anfragebremse.ts`), aber `kiFehlerMeldung` im Blatt reichte nur
// `CONFIDENTIAL_CLOUD_BLOCKED` durch — der Wartesatz bei `KI_ANFRAGEN_GEBREMST` wurde durch den
// allgemeinen Fehlertext ersetzt. Gefahren wird das ECHTE Blatt (`/erfassen/neu`) über denselben
// Aufbau wie `tests/ask-c02/blatt-ki-schickt-die-entwurfskennung-mounted.test.tsx`; die beiden
// Reasoner-Aufrufe scheitern mit genau dem Fehler, den der Web-Client aus der 429 baut (`ApiError`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  fehler: null as null | (() => unknown),
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
    box.fehler = null;
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const scheitern = (): void => {
    if (box.fehler) {
      throw box.fehler();
    }
  };
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => (await svc.resumeDraft(id))?.draft),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => {
          scheitern();
          return {
            title: "Routerübergabe",
            statement: "Der Router wurde übergeben.",
            conditions: [],
            measures: [],
            tags: [],
            confidence: 0.8,
            demo: false,
          };
        }),
        assist: vi.fn(async () => {
          scheitern();
          return { text: "korrigierter Text" };
        }),
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
import { ApiError } from "../../apps/web/src/api/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeIntake } from "../../apps/web/src/pages/KnowledgeIntake";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const WARTESATZ =
  "Sie haben in kurzer Zeit sehr viele KI-Anfragen gestellt. Bitte warten Sie 42 Sekunden und versuchen Sie es dann erneut.";
const TEXT = "the customer recieved the router and the instalation was completed at the adress.";

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
  const seite = createElement(
    MemoryRouter,
    { initialEntries: ["/erfassen/neu"] },
    createElement(
      Routes,
      null,
      createElement(Route, { path: "/erfassen/neu", element: createElement(KnowledgeIntake) }),
    ),
  );
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
            createElement(ToastProvider, null, createElement(NavGuardProvider, null, seite)),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function schreiben(text: string): Promise<void> {
  const feld = [...container.querySelectorAll<HTMLElement>("[contenteditable]")].find(
    (e) => e.getAttribute("contenteditable") === "true",
  );
  if (!feld) {
    throw new Error("Schreibfläche des Blattes nicht gefunden");
  }
  feld.innerHTML = `<p>${text}</p>`;
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function ki(eintrag: string): Promise<void> {
  const werkzeug = container.querySelector<HTMLButtonElement>('[data-testid="blatt-werkzeug-ki"]');
  if (!werkzeug) {
    throw new Error("KI-Werkzeug nicht gefunden");
  }
  await click(werkzeug);
  const flaeche = container.querySelector<HTMLElement>('[data-testid="blatt-menue-ki"]');
  if (!flaeche) {
    throw new Error("KI-Menü öffnet nicht");
  }
  const treffer = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(eintrag),
  );
  if (!(treffer instanceof HTMLButtonElement) || treffer.disabled) {
    throw new Error(`KI-Eintrag „${eintrag}“ nicht bedienbar`);
  }
  await click(treffer);
}

function kiFehlerText(): string {
  const karte = container.querySelector<HTMLElement>('[data-testid="blatt-ki-fehler"]');
  expect(karte, "die KI-Fehlerkarte fehlt").not.toBeNull();
  return (karte?.textContent ?? "").replace(/\s+/g, " ");
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

describe("R-0842 · Strukturierung und KI-Assistent im Erfassungsblatt bei gebremster Anfrage", () => {
  it("E1 · KI-Assistent: der Wartesatz des Servers steht in der Karte, nicht `fd.errAssist`", async () => {
    box.fehler = () => new ApiError(429, "KI_ANFRAGEN_GEBREMST", WARTESATZ, { wartenSek: 42 });
    await mount();
    await schreiben(TEXT);
    await ki(i18n.t("capture.ai.action.spelling"));
    const text = kiFehlerText();
    expect(text).toContain(WARTESATZ);
    expect(text).not.toContain(i18n.t("fd.errAssist"));
  });

  it("E2 · Strukturierung: der Wartesatz des Servers steht in der Karte", async () => {
    box.fehler = () => new ApiError(429, "KI_ANFRAGEN_GEBREMST", WARTESATZ, { wartenSek: 42 });
    await mount();
    await schreiben(TEXT);
    await ki(i18n.t("erfassen.ki.struktur"));
    expect(kiFehlerText()).toContain(WARTESATZ);
  });

  it("E3 · Gegenprobe: ein fremder Fehler behält den bisherigen Satz", async () => {
    box.fehler = () => new ApiError(500, "ERROR", "Interner Fehler");
    await mount();
    await schreiben(TEXT);
    await ki(i18n.t("capture.ai.action.spelling"));
    const text = kiFehlerText();
    expect(text).toContain(i18n.t("fd.errAssist"));
    expect(text).not.toContain(WARTESATZ);
  });
});
