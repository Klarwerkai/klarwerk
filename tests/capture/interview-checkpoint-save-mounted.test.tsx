// @vitest-environment jsdom
// AUFTRAG-mega9 Block C (KW-E2E-003): Nach der ersten gesendeten Antwort war „Als Entwurf speichern"
// im Interviewweg WEITERHIN deaktiviert — der sichere Abbruch mitten im Interview war unmöglich, wer
// das Fenster schloss, verlor seine Antworten.
//
// Ursache (bestätigt): canSaveDraft verlangte Rohtext ODER Aussage ODER Titel. Im Interviewweg
// entsteht nichts davon — der Nutzer beantwortet Fragen. Die Antworten kamen in der Bedingung
// schlicht nicht vor.
//
// WARUM DAS DURCHRUTSCHEN KONNTE, und was dieser Test anders macht: die bestehenden
// Interview-Speichertests (draft-save-interview-sources-mounted) speichern über den
// NAVIGATIONSWÄCHTER — dessen save()-Zweig ruft saveDraft direkt und fragt canSaveDraft NIE. Der
// graue Knopf war damit von keinem Test berührt. Dieser Test klickt deshalb bewusst den ECHTEN
// manuellen Knopf und prüft ZUERST seinen disabled-Zustand.
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

// Steuert, ob der nächste Interview-Aufruf hängen bleibt (nextQuestionPending) — für die
// Zusicherung, dass ein laufender Turn den bereits gesicherten Stand nicht blockiert.
const gate = vi.hoisted(() => ({ hold: false, release: (): void => {} }));

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
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
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
        interview: vi.fn(async (answers: string[]) => {
          if (gate.hold) {
            // Turn bleibt offen, bis der Test ihn freigibt — genau der „nächste Frage lädt"-Zustand.
            await new Promise<void>((resolve) => {
              gate.release = resolve;
            });
          }
          return {
            question: `Frage ${answers.length + 1}?`,
            done: false,
            draft: emptyDraft,
            demo: false,
          };
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

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

// ==================================================================================================
// JOB 3062 · H3 — DER MODUS KOMMT ALS PROP, WEIL DIE MODUS-LEISTE GELÖSCHT IST.
// ==================================================================================================
// Bis hierher wählte dieser Test den Erzähl-Modus über die Knopfreihe auf `/erfassen`. Die Leiste
// ist mit dem Standardweg-Kasten gelöscht (Auftrag §5); im Produkt wählt der Mensch den Weg im
// Menü „Datei ▾" der Blatt-Werkzeugzeile, und das Blatt reicht ihn als `modus` an den Arbeitsraum.
// Der Test fährt GENAU DIESEN Weg: dieselbe Montage, neuer Prop — React behält den Zustand des
// Arbeitsraums, und `CaptureArbeitsraum` gleicht den Modus über `switchMode` ab (dieselbe Funktion,
// die vorher am Knopf hing).
let h3Modus: "freitext" | "diktat" | "interview" | "datei" | "formular" | undefined;
let h3Zeichnen: (() => Promise<void>) | null = null;

async function waehleModus(
  m: "freitext" | "diktat" | "interview" | "datei" | "formular",
): Promise<void> {
  h3Modus = m;
  if (!h3Zeichnen) {
    throw new Error("waehleModus vor mount() gerufen");
  }
  await h3Zeichnen();
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const zeichne = async (): Promise<void> => {
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
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(CaptureArbeitsraum, { modus: h3Modus }),
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
  };
  h3Zeichnen = zeichne;
  await zeichne();
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

// Der SICHTBARE manuelle Speichern-Knopf — der, den der Prüfer grau vorgefunden hat.
function saveButton(): HTMLButtonElement {
  return buttonByText(i18n.t("capture.saveDraft"));
}

async function openInterviewWithFirstAnswer(): Promise<void> {
  // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
  // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
  // des Blattes und startet offen.
  await waehleModus("interview");
  await click(buttonByText(i18n.t("capture.ivStart")));
  expect(pageText()).toContain("Frage 1?");
  await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "Die Dichtung war spröde.");
  await click(buttonByText(i18n.t("capture.ivSend")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gate.hold = false;
  db.reset();
});

afterEach(() => {
  h3Modus = undefined;
  h3Zeichnen = null;
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("AUFTRAG-mega9 Block C (KW-E2E-003): das Interview ist nach jeder Antwort speicherbar", () => {
  it("erste Antwort senden → Speichern ist AKTIV → speichern → fortsetzen: die Antwort ist da, ohne neuen Modelllauf", async () => {
    await mount();

    // Vor dem Start: nichts erzählt, nichts zu sichern — die Sperre ist hier richtig.
    // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
    // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
    // des Blattes und startet offen.
    await waehleModus("interview");
    expect(saveButton().disabled).toBe(true);

    await click(buttonByText(i18n.t("capture.ivStart")));
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "Die Dichtung war spröde.");
    await click(buttonByText(i18n.t("capture.ivSend")));

    // Frage 2 steht sichtbar — und DAS ist der Befund: hier war der Knopf weiterhin grau.
    expect(pageText()).toContain("Frage 2?");
    expect(saveButton().disabled).toBe(false);

    const callsBeforeSave = vi.mocked(endpoints.reasoner.interview).mock.calls.length;
    await click(saveButton());

    // Der Checkpoint ist echt: die bestätigte Antwort liegt im Entwurf.
    expect(db.created).toHaveLength(1);
    const iv = db.created[0]?.interview as { answers?: string[]; question?: string };
    expect(iv.answers).toEqual(["Die Dichtung war spröde."]);
    expect(iv.question).toBe("Frage 2?");

    // Fortsetzen: die Antwort ist da …
    const expand = maybeButtonByText("Entwürfe anzeigen");
    if (expand) {
      await click(expand);
    }
    await click(buttonByText(i18n.t("capture.resume")));
    expect(pageText()).toContain(i18n.t("capture.ivTurn", { n: 2 }));
    expect(pageText()).toContain("Frage 2?");
    // … und zwar OHNE automatischen KI-Lauf beim Fortsetzen (mega5-Zusicherung hält).
    expect(vi.mocked(endpoints.reasoner.interview).mock.calls.length).toBe(callsBeforeSave);
  });

  it("während die nächste Frage lädt, bleibt der bereits gesicherte Stand speicherbar", async () => {
    await mount();
    await openInterviewWithFirstAnswer();
    expect(saveButton().disabled).toBe(false);

    // Nächsten Turn anstoßen und HÄNGEN lassen: nextQuestionPending ist aktiv …
    gate.hold = true;
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "Zweite Antwort");
    await click(buttonByText(i18n.t("capture.ivSend")));
    expect(pageText()).toContain(i18n.t("capture.ivThinking"));

    // … der bereits GESICHERTE Stand bleibt trotzdem speicherbar. Der laufende Turn ist ein
    // Zustand der nächsten Frage, nicht des vorhandenen Fortschritts.
    expect(saveButton().disabled).toBe(false);
    await click(saveButton());
    expect(db.created).toHaveLength(1);
    const iv = db.created[0]?.interview as { answers?: string[] };
    expect(iv.answers).toEqual(["Die Dichtung war spröde.", "Zweite Antwort"]);

    await act(async () => {
      gate.release();
      await flush();
    });
  });

  it("eine nur getippte, noch nicht gesendete Antwort macht den Entwurf ebenfalls speicherbar", async () => {
    await mount();
    // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
    // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
    // des Blattes und startet offen.
    await waehleModus("interview");
    await click(buttonByText(i18n.t("capture.ivStart")));
    expect(saveButton().disabled).toBe(true);

    // Getippt, aber nicht gesendet: hasUnsavedEntry hält das längst für „dirty" — dann muss es
    // auch speicherbar sein, sonst widersprechen sich Dirty- und Speicher-Vertrag.
    await change(textareaByPlaceholder(i18n.t("capture.ivAnswerHint")), "halb getippt");
    expect(saveButton().disabled).toBe(false);
  });
});
