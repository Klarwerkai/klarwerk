// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · WISSEN-INTERVIEW (R-0091) — DAS BLATT BIETET DAS LÜCKEN-INTERVIEW AN.
// ================================================================================================
//
// „Sagt die Prüfung ‚dazu gibt es nichts', bietet Klara an, das Wissen gleich abzuholen: drei
// Fragen, ein Entwurf, fertig zur Prüfung."
//
// Gemountet ist das echte Blatt (`CaptureFrontDoor`) samt echtem Live-Check-Haken und echtem
// API-Serializer; gestellt sind nur der Entwurfsbestand (echter CaptureService im Speicher), die
// Antwort von `/api/knowledge/check` und der Interview-Endpunkt. Geprüft wird:
//   · Vorschau ohne Treffer → das Angebot steht da; mit Treffer → kein Angebot;
//   · der Klick öffnet das Interview mit dem Thema des Blattes (Titel) — gesendet wird erst mit
//     „Interview starten", und dann als Lücken-Interview im Fragebaum.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  antwort: { status: "done", similar: [], conflicts: [] } as unknown,
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
  const { treeInterview } = await import("../../services/reasoner/src/interview-tree");
  type P = Record<string, unknown>;
  const zeit = Date.parse("2026-09-22T08:00:00.000Z");
  const bauen = (): InstanceType<typeof CaptureService> =>
    new CaptureService({ repo: new InMemoryDraftRepo(), now: () => zeit });
  let svc = bauen();
  box.reset = () => {
    svc = bauen();
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      ko: { list: ok([]) },
      knowledge: (
        await vi.importActual<typeof import("../../apps/web/src/api/endpoints")>(
          "../../apps/web/src/api/endpoints",
        )
      ).endpoints.knowledge,
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      gaps: { list: ok([]) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "unknown" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
        interview: vi.fn(
          async (
            answers: string[],
            _locale: unknown,
            _herkunft: unknown,
            // R-1624 (main): der Bildbefund steht an 4. Stelle; ohne Foto bleibt er leer.
            _bildbefund: string | undefined,
            guide?: { tree?: boolean; topic?: string | null },
          ) =>
            treeInterview(answers, true, "de", {
              tree: guide?.tree === true,
              ...(guide?.topic ? { topic: guide.topic } : {}),
            }),
        ),
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const interviewMock = endpoints.reasoner.interview as unknown as ReturnType<typeof vi.fn>;
const TEXT = "Beim Kaltstart unter fünf Grad die Dosierpumpe dreißig Minuten vorwärmen.";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function blattMitText(): Promise<void> {
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
                MemoryRouter,
                { initialEntries: ["/erfassen"] },
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
      ),
    );
    await flush();
  });
  await act(flush);
  // Der Mensch schreibt aufs Blatt — der echte Live-Check hört auf diesen Text.
  const editor = container.querySelector('[role="textbox"]');
  expect(editor).toBeInstanceOf(HTMLElement);
  await act(async () => {
    if (editor) {
      editor.innerHTML = `<p>${TEXT}</p>`;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush();
  });
  // Der Live-Check entprellt — erst danach steht die Vorschau.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
    await flush();
  });
  expect(fetch).toHaveBeenCalledWith(
    "/api/knowledge/check",
    expect.objectContaining({ method: "POST" }),
  );
}

function teil(testid: string): Element | null {
  return container.querySelector(`[data-testid="${testid}"]`);
}

function knopf(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${text}“ nicht gefunden`);
  }
  return btn;
}

async function klick(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  box.reset();
  box.antwort = { status: "done", similar: [], conflicts: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toBe("/api/knowledge/check");
      return new Response(JSON.stringify(box.antwort));
    }),
  );
});

afterEach(() => {
  if (container?.isConnected) {
    act(() => root.unmount());
    container.remove();
  }
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("R-0091: Vorschau ohne Treffer → Klara bietet das Lücken-Interview an", () => {
  it("Angebot steht da; der Klick öffnet das Interview mit dem Thema, gesendet wird erst beim Start", async () => {
    await blattMitText();
    expect(teil("blatt-live-chip")?.getAttribute("data-lage")).toBe("empty");
    const angebot = teil("luecken-interview-angebot");
    expect(angebot?.textContent).toContain(i18n.t("interview.angebot.text"));
    // Das Angebot behauptet keine bestandweite Neuheit (Vorschau-Reichweite bleibt).
    expect(angebot?.textContent).not.toContain(i18n.t("erfassen.live.neu"));

    await klick(knopf(i18n.t("interview.angebot.knopf")));
    // Ohne Titel ist der Text des Blattes das Thema — der Wissende schreibt ja gerade darüber.
    expect(teil("interview-thema")?.textContent).toContain(TEXT);
    expect(interviewMock).not.toHaveBeenCalled();

    await klick(knopf(i18n.t("capture.ivStart")));
    expect(interviewMock).toHaveBeenCalledTimes(1);
    expect(interviewMock.mock.calls[0]?.[4]).toEqual({ tree: true, topic: TEXT });
    expect(container.textContent).toContain(`Thema: „${TEXT}“`);
  });

  it("auch ohne Konfliktprüfung (ungespeicherter Text): leere Ähnlichkeitsvorschau → Angebot", async () => {
    box.antwort = {
      status: "pending",
      similar: [],
      conflicts: [],
      coverage: { kind: "candidates", checked: 3, limit: 40, limitReached: false },
    };
    await blattMitText();
    expect(teil("blatt-live-vorschau")).not.toBeNull();
    expect(teil("luecken-interview-angebot")).not.toBeNull();
  });

  it("ausgefallene Prüfung: kein Angebot — „nichts gefunden“ ist dann nicht belegt", async () => {
    box.antwort = { status: "failed", similar: [], conflicts: [] };
    await blattMitText();
    expect(teil("blatt-live-ausfall")).not.toBeNull();
    expect(teil("luecken-interview-angebot")).toBeNull();
  });

  it("mit ähnlichem Treffer gibt es kein Angebot — dann ist Ergänzen die Frage, nicht Abholen", async () => {
    box.antwort = {
      status: "done",
      similar: [
        {
          id: "kc",
          title: "Kaltstart Vorwärmung",
          score: 0.8,
          koStatus: "offen",
          koCategory: null,
        },
      ],
      conflicts: [],
    };
    await blattMitText();
    expect(teil("blatt-live-chip")?.getAttribute("data-lage")).toBe("similar");
    expect(teil("luecken-interview-angebot")).toBeNull();
  });
});
