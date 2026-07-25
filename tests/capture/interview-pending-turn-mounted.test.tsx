// @vitest-environment jsdom
// AUFTRAG-mega6 Block C (bens ROT 3): Wird gespeichert, während die NÄCHSTE Interviewfrage noch
// lädt, darf nicht die bereits beantwortete Frage als aktuelle Frage persistiert werden.
//
// Der Test benutzt bewusst ein DEFERRED Promise statt eines sofort auflösenden Mocks — nur so
// existiert das Zeitfenster überhaupt, in dem der Fehler auftrat. Belegt werden alle vier von ben
// verlangten Punkte: Antworten sind da · die alte Frage ist NICHT sichtbar · „Nächste Frage laden"
// ist sichtbar · es läuft kein automatischer Modelllauf. Dazu der zweite Teil seiner Auflage: eine
// SPÄTE Antwort eines vor dem Save gestarteten Requests schreibt den danach geltenden Zustand nicht
// wieder ein.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type IvResult = { question: string | null; done: boolean; draft: unknown; demo: boolean };

const iv = vi.hoisted(() => {
  const pending: { resolve: (v: IvResult) => void }[] = [];
  return {
    pending,
    calls: { n: 0 },
    reset: (): void => {
      pending.length = 0;
      iv.calls.n = 0;
    },
  };
});

const box = vi.hoisted(() => ({
  reset: (): void => {},
  created: [] as Record<string, unknown>[],
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
    box.created.length = 0;
  };
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
        create: vi.fn(async (p: P) => {
          box.created.push(p);
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        // Der Kern: JEDER Turn bleibt offen, bis der Test ihn ausdrücklich auflöst.
        interview: vi.fn(() => {
          iv.calls.n += 1;
          return new Promise<IvResult>((resolve) => {
            iv.pending.push({ resolve });
          });
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_WIZARD_TEXT } from "../../apps/web/src/lib/captureWizard";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const EMPTY_DRAFT = {
  title: "",
  statement: "",
  conditions: [],
  measures: [],
  tags: [],
  confidence: 0,
  demo: false,
};

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

// Den zuletzt gestarteten (oder einen gezielt gewählten) offenen Turn beantworten.
async function answerTurn(index: number, question: string): Promise<void> {
  const turn = iv.pending[index];
  if (!turn) {
    throw new Error(`Turn ${index} ist nicht offen`);
  }
  await act(async () => {
    turn.resolve({ question, done: false, draft: EMPTY_DRAFT, demo: false });
    await flush();
  });
}

async function saveViaNavGuard(): Promise<void> {
  nav.proceeded = false;
  await click(
    container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
  );
  expect(pageText()).toContain(i18n.t("nav.guard.title"));
  await click(buttonByText(i18n.t("nav.guard.save")));
  expect(nav.proceeded).toBe(true);
}

async function resumeDraft(): Promise<void> {
  const expand = maybeButtonByText("Entwürfe anzeigen");
  if (expand) {
    await click(expand);
  }
  await click(buttonByText(i18n.t("capture.resume")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  nav.proceeded = false;
  iv.reset();
  box.reset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C: Save während des nächsten Interview-Turns", () => {
  it("speichert Antworten ohne die überholte Frage; Resume bietet ehrlich das Nachladen an", async () => {
    await mount();
    await click(buttonByText("Weitere Wege anzeigen"));
    await click(buttonByText(i18n.t("capture.mode.interview")));
    await click(buttonByText(i18n.t("capture.ivStart")));
    await answerTurn(0, "Frage 1?");
    expect(pageText()).toContain("Frage 1?");

    // Antwort senden → Turn 2 bleibt AUSSTEHEND (deferred).
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "Antwort 1");
    await click(buttonByText(i18n.t("capture.ivSend")));
    expect(iv.pending).toHaveLength(2);
    // Kern des Fixes: mit dem Start des nächsten Turns ist Frage 1 nicht mehr die aktuelle Frage.
    expect(pageText()).not.toContain("Frage 1?");
    expect(pageText()).toContain(i18n.t("capture.ivThinking"));

    // In genau diesem Fenster speichern.
    await saveViaNavGuard();

    expect(box.created).toHaveLength(1);
    const saved = box.created[0]?.interview as Record<string, unknown>;
    expect(saved.answers).toEqual(["Antwort 1"]);
    // KEINE alte Frage im Pending-Zustand — das war bens ROT 3.
    expect(saved.question).toBeUndefined();
    expect(saved.started).toBe(true);

    const callsAfterSave = iv.calls.n;
    await resumeDraft();

    const text = pageText();
    // 1. Antworten sind da (Turn-Zähler steht auf 2 = eine Antwort gegeben) …
    expect(text).toContain(i18n.t("capture.ivTurn", { n: 2 }));
    // 2. … die alte Frage ist NICHT sichtbar …
    expect(text).not.toContain("Frage 1?");
    // 3. … „Nächste Frage laden" wird angeboten …
    expect(text).toContain(i18n.t("capture.ivResumeLead"));
    expect(maybeButtonByText(i18n.t("capture.ivResumeLoad"))).not.toBeNull();
    // 4. … und es lief KEIN automatischer Modelllauf beim Fortsetzen.
    expect(iv.calls.n).toBe(callsAfterSave);

    // Der bewusste Klick lädt die nächste Frage — der ehrliche Weg funktioniert weiterhin.
    await click(buttonByText(i18n.t("capture.ivResumeLoad")));
    expect(iv.calls.n).toBe(callsAfterSave + 1);
    await answerTurn(2, "Frage 2 frisch?");
    expect(pageText()).toContain("Frage 2 frisch?");
  });

  it("späte Antwort eines vor dem Save gestarteten Turns schreibt nichts zurück", async () => {
    await mount();
    await click(buttonByText("Weitere Wege anzeigen"));
    await click(buttonByText(i18n.t("capture.mode.interview")));
    await click(buttonByText(i18n.t("capture.ivStart")));
    await answerTurn(0, "Frage 1?");
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "Antwort 1");
    await click(buttonByText(i18n.t("capture.ivSend")));

    await saveViaNavGuard();
    // Nach dem Save ist der Interview-Zustand geräumt: der Startknopf steht wieder da.
    expect(maybeButtonByText(i18n.t("capture.ivStart"))).not.toBeNull();

    // JETZT erst trifft die Antwort des vor dem Save gestarteten Turns ein.
    await answerTurn(1, "Verspaetete Frage 2?");

    const text = pageText();
    expect(text).not.toContain("Verspaetete Frage 2?");
    expect(text).not.toContain(i18n.t("capture.ivThinking"));
    // Der geräumte Zustand bleibt geräumt — kein wiederauferstandenes Interview.
    expect(maybeButtonByText(i18n.t("capture.ivStart"))).not.toBeNull();
  });

  it("späte Antwort nach dem Verwerfen schreibt ebenfalls nichts zurück", async () => {
    await mount();
    await click(buttonByText("Weitere Wege anzeigen"));
    await click(buttonByText(i18n.t("capture.mode.interview")));
    await click(buttonByText(i18n.t("capture.ivStart")));
    await answerTurn(0, "Frage 1?");
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "Antwort 1");
    await click(buttonByText(i18n.t("capture.ivSend")));

    // Der Reset-Weg der Seite selbst (resetCaptureForm über „Verwerfen"), nicht der
    // Navigationsweg — die Wache navigiert weg und hängt die Seite ohnehin ab.
    await click(buttonByText(i18n.t(CAPTURE_WIZARD_TEXT.discard)));
    await click(buttonByText(i18n.t(CAPTURE_WIZARD_TEXT.discardYes)));
    expect(maybeButtonByText(i18n.t("capture.ivStart"))).not.toBeNull();

    await answerTurn(1, "Verspaetete Frage 2?");
    expect(pageText()).not.toContain("Verspaetete Frage 2?");
    expect(maybeButtonByText(i18n.t("capture.ivStart"))).not.toBeNull();
  });
});
