// @vitest-environment jsdom
// AUFTRAG-mega5 Block A + C (bens Ship-Gate 1+2): „Entwurf speichern" sichert jetzt AUCH den
// Interviewfortschritt (bens Verlustpfade 1+2) und behandelt die externe Suche datenminimiert
// (Block C): die Suchanfrage und die AUSGEWÄHLTEN Quellen (mit `sourceProvider`) reisen im Entwurf,
// die volle Trefferliste bewusst nicht — nach dem Fortsetzen steht das ehrlich dran und EIN Klick
// lädt sie neu. Gemountete Tests über den ECHTEN Klickpfad (Navigationswache bzw. manueller
// Save-Knopf mit namentlicher Bestätigung), Beweis jeweils: Payload + vollständige Wiederherstellung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  const emptyDraft = {
    title: "",
    statement: "",
    conditions: [],
    measures: [],
    tags: [],
    confidence: 0,
    demo: false,
  };
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: {
        // AUFTRAG-mega14 Block D (SCRUM-414): auf der VORGABE-Stufe „search_on_click" ist das
        // Anhängen externer Treffer jetzt gesperrt (Knopf inaktiv, Server 403). Dieser Test prüft
        // den DRAFT-Vertrag, nicht die Stufe — er läuft deshalb auf einer Stufe, die Anhängen
        // erlaubt. Die Sperre selbst ist in tests/app/external-attach-gate-e2e.test.ts belegt.
        policy: ok({ stage: "search_attach" }),
        search: vi.fn(async () => [
          {
            title: "Dichtungsnorm 4711",
            url: "https://example.org/norm",
            snippet: "Auszug zur Norm",
            provider: "FakeWiki",
          },
        ]),
      },
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
        // Deterministische Fragefolge: die Frage trägt die Turn-Nummer — der Test pinnt so,
        // dass NACH dem Resume KEIN weiterer Interview-Aufruf nötig ist, um sie zu sehen.
        interview: vi.fn(async (answers: string[]) => ({
          question: `Frage ${answers.length + 1}?`,
          done: false,
          draft: emptyDraft,
          demo: false,
        })),
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

function inputByPlaceholder(ph: string): HTMLInputElement {
  const el = [...container.querySelectorAll("input")].find((i) => i.placeholder === ph);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Input mit Placeholder „${ph}“ nicht gefunden`);
  }
  return el;
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

async function openWorkspace(): Promise<void> {
  await click(buttonByText("Weitere Wege anzeigen"));
}

async function openInterviewTab(): Promise<void> {
  await click(buttonByText(i18n.t("capture.mode.interview")));
}

// „Entwurf speichern" über die ECHTE Navigationswache (Dialog MIT Speichern-Knopf — alles sicherbar).
async function saveViaNavGuard(): Promise<void> {
  nav.proceeded = false;
  await click(
    container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
  );
  expect(pageText()).toContain(i18n.t("nav.guard.title"));
  await click(buttonByText(i18n.t("nav.guard.save")));
  expect(nav.proceeded).toBe(true);
}

async function resumeSavedDraft(): Promise<void> {
  const expand = maybeButtonByText("Entwürfe anzeigen");
  if (expand) {
    await click(expand);
  }
  await click(buttonByText(i18n.t("capture.resume")));
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

describe("Block A: Interviewfortschritt wird vollständig gesichert und wiederhergestellt", () => {
  it("gestartetes Interview OHNE Antwort: Wache speichert wirklich; Resume zeigt dieselbe Frage — ohne neuen Modelllauf", async () => {
    await mount();
    await openWorkspace();
    await openInterviewTab();
    await click(buttonByText(i18n.t("capture.ivStart")));
    expect(pageText()).toContain("Frage 1?");
    const interviewCallsBeforeSave = vi.mocked(endpoints.reasoner.interview).mock.calls.length;

    await saveViaNavGuard();

    // bens Verlustpfad 1: der Save-Zweig lief bei NUR-ivStarted früher leer durch. Jetzt: echte Persistenz.
    expect(db.created).toHaveLength(1);
    expect(db.created[0]?.interview).toEqual({
      started: true,
      answers: [],
      question: "Frage 1?",
      done: false,
      demo: false,
    });

    await resumeSavedDraft();
    // Vollständige Wiederherstellung: Interview-Tab offen, dieselbe Frage steht da …
    expect(pageText()).toContain("Frage 1?");
    expect(pageText()).toContain(i18n.t("capture.ivTurn", { n: 1 }));
    // … und zwar aus dem Entwurf, NICHT aus einem erneuten Modelllauf (kein Auto-Fetch beim Resume).
    expect(vi.mocked(endpoints.reasoner.interview).mock.calls.length).toBe(
      interviewCallsBeforeSave,
    );
  });

  it("gesendete + gerade getippte Antwort: beide überleben Save und Resume", async () => {
    await mount();
    await openWorkspace();
    await openInterviewTab();
    await click(buttonByText(i18n.t("capture.ivStart")));
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "Erste Antwort");
    await click(buttonByText(i18n.t("capture.ivSend")));
    expect(pageText()).toContain("Frage 2?");
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "halb getippte Antwort");

    await saveViaNavGuard();

    expect(db.created).toHaveLength(1);
    expect(db.created[0]?.interview).toEqual({
      started: true,
      answers: ["Erste Antwort"],
      answer: "halb getippte Antwort",
      question: "Frage 2?",
      done: false,
      demo: false,
    });

    await resumeSavedDraft();
    expect(pageText()).toContain("Frage 2?");
    expect(pageText()).toContain(i18n.t("capture.ivTurn", { n: 2 }));
    expect(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")).value).toBe(
      "halb getippte Antwort",
    );
  });
});

describe("Block A: Roundtrip der ausgewählten Quellen (pendingSources)", () => {
  it("manuell erfasste Quelle: Payload trägt sie, Resume zeigt Label, URL und Auszug wieder", async () => {
    await mount();
    await openWorkspace();
    await click(buttonByText(i18n.t("capture.advanced.title")));
    await change(inputByPlaceholder(i18n.t("ko.sourceLabel")), "Handbuch S. 12");
    await change(inputByPlaceholder(i18n.t("ko.sourceUrl")), "https://example.org/handbuch");
    await change(inputByPlaceholder(i18n.t("ko.sourceExcerpt")), "Dichtung alle 6 Monate");
    await click(buttonByText(i18n.t("ko.sourceAdd")));

    await saveViaNavGuard();

    expect(db.created).toHaveLength(1);
    expect(db.created[0]?.pendingSources).toEqual([
      {
        label: "Handbuch S. 12",
        url: "https://example.org/handbuch",
        excerpt: "Dichtung alle 6 Monate",
      },
    ]);

    await resumeSavedDraft();
    const text = pageText();
    expect(text).toContain("Handbuch S. 12");
    expect(text).toContain("https://example.org/handbuch");
    expect(text).toContain("Dichtung alle 6 Monate");
  });
});

describe("Block C: externe Suche — Anfrage und ausgewählte Treffer bleiben, die Trefferliste ehrlich nicht", () => {
  it("Save benennt die Trefferliste, persistiert extQuery + sourceProvider-Quelle, KEIN extResults; Resume zeigt den Hinweis", async () => {
    await mount();
    await openWorkspace();
    await change(textareaByPlaceholder(i18n.t("capture.rawPlaceholder")), "Kernaussage zur Norm");
    await click(buttonByText(i18n.t("capture.advanced.title")));
    await change(inputByPlaceholder(i18n.t("ext.placeholder")), "Dichtung Norm");
    await click(buttonByText(i18n.t("ext.search")));
    expect(pageText()).toContain("Dichtungsnorm 4711");
    await click(buttonByText(i18n.t("ext.attach")));

    // Manueller Save: die geladene Trefferliste ist nicht sicherbar → namentliche Bestätigung nötig.
    await click(buttonByText(i18n.t("capture.saveDraft")));
    expect(pageText()).toContain(i18n.t("capture.saveLimit.title"));
    expect(pageText()).toContain(i18n.t("capture.unsavable.extResults"));
    await click(buttonByText(i18n.t("capture.saveLimit.confirm")));

    expect(db.created).toHaveLength(1);
    const payload = db.created[0] as {
      extQuery?: string;
      extResults?: unknown;
      pendingSources?: { label: string; sourceProvider?: string }[];
    };
    expect(payload.extQuery).toBe("Dichtung Norm");
    // Block C: der volle Treffer-Cache verlässt den Draft-Vertrag (Datenminimierung).
    expect(payload.extResults).toBeUndefined();
    // Die AUSGEWÄHLTE Quelle reist vollständig mit — die Suchquelle heißt jetzt sourceProvider.
    expect(payload.pendingSources).toEqual([
      {
        label: "Dichtungsnorm 4711",
        url: "https://example.org/norm",
        excerpt: "Auszug zur Norm",
        sourceProvider: "FakeWiki",
      },
    ]);

    await resumeSavedDraft();
    // Suchanfrage ist wieder da, die ausgewählte Quelle vollständig (inkl. Provider-Badge) …
    expect(inputByPlaceholder(i18n.t("ext.placeholder")).value).toBe("Dichtung Norm");
    const text = pageText();
    expect(text).toContain("Dichtungsnorm 4711");
    expect(text).toContain("FakeWiki");
    // … die Trefferliste ist leer (der Auszug eines Treffers stünde sonst doppelt da) und der
    // Hinweis erklärt das ehrlich; ein erneuter Klick auf „Suchen" lädt sie neu.
    expect(text).toContain(i18n.t("ext.resumeHint"));
    await click(buttonByText(i18n.t("ext.search")));
    expect(pageText()).not.toContain(i18n.t("ext.resumeHint"));
    expect(pageText()).toContain("Auszug zur Norm");
  });
});
