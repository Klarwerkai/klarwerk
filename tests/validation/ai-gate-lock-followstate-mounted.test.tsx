// @vitest-environment jsdom
// WP-SHIP9-B3FIX2 (bens F1 ROT, 23.07.): Der pending-Lock sperrt die EINSTIEGE korrekt, aber zwei
// bereits GEÖFFNETE Folgezustände überlebten bisher den Wechsel des KO auf aiCheck.status ===
// "pending" und konnten weiter mutieren:
//   1. das offene Rückfrage-/Ablehnen-Formular (Absenden prüfte nur isPending + Textgültigkeit),
//   2. die offene Admin-Bestätigung (Ja prüfte nur adminValidate.isPending).
// Real erreichbar: Eintrag failed/done → Folgezustand geöffnet → per Retry erneut auf pending;
// React behält feedback bzw. confirmTrueId, der neue Query-Stand schließt die lokalen Zustände nicht.
// Dieser ECHTE Interaktionstest mountet die Validierungs-Seite, öffnet je Folgezustand, aktualisiert
// die Query-Daten der Karte auf pending und belegt: Absenden- und Admin-Ja-Knopf sind dann DISABLED
// und die jeweilige Mutation (endpoints.ko.act) läuft NICHT (Spy = 0). Beide Folgezustände, je einer
// aus failed und aus done.
import { afterEach, describe, expect, it, vi } from "vitest";

// Kontext-Hooks deterministisch: kein AuthProvider-/RoleProvider-Async, Admin-Rolle für den Ja-Knopf.
vi.mock("../../apps/web/src/app/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/AuthContext")>()),
  useSession: () => ({ user: { id: "u1", name: "Prüfer" }, isLoading: false }) as never,
}));
vi.mock("../../apps/web/src/app/RoleContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/RoleContext")>()),
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }) as never,
}));
vi.mock("../../apps/web/src/app/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/ToastContext")>()),
  useToast: () => ({ push: () => {} }) as never,
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
// i18n VOR der Seite: initialisiert react-i18next global (useTranslation ohne eigenen Provider).
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

const REQUESTED = "2026-07-23T07:00:00.000Z";
const FINISHED = "2026-07-23T07:02:00.000Z";
const AI_FAILED = {
  status: "failed" as const,
  requestedAt: REQUESTED,
  finishedAt: FINISHED,
  fallbackReason: "no-model" as const,
};
const AI_DONE = { status: "done" as const, requestedAt: REQUESTED, finishedAt: FINISHED };
const AI_PENDING = { status: "pending" as const, requestedAt: REQUESTED };

// Minimales, aber vollständiges Board-KO — nur aiCheck wechselt im Testverlauf.
function ko(aiCheck: KnowledgeObject["aiCheck"]): KnowledgeObject {
  return {
    id: "k1",
    title: "PROBE-KO Ventilwartung",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    reviewVotes: { up: 0, warn: 0, down: 0 },
    staleVotes: 0,
    asset: null,
    createdAt: REQUESTED,
    history: [],
    aiCheck,
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/pruefen"] }, createElement(Validation)),
      ),
    );
  });
}

// Board-Daten (reaktiv über die echte react-query-Cache) setzen — das ist der „Query-Daten der
// Karte auf pending aktualisieren"-Schritt aus bens Auflage 3.
function setBoard(items: KnowledgeObject[]): void {
  act(() => {
    qc.setQueriesData({ queryKey: ["validation", "board"] }, items);
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function mountWith(aiCheck: KnowledgeObject["aiCheck"]): Promise<void> {
  const actSpy = endpoints.ko.act as unknown as ReturnType<typeof vi.fn>;
  actSpy.mockResolvedValue(ko(aiCheck) as never);
  (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    ko(aiCheck),
  ] as never);
  (endpoints.directory.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: "u1", name: "Prüfer" },
  ] as never);
  mount();
  for (let i = 0; i < 6 && !(container.textContent ?? "").includes("PROBE-KO"); i += 1) {
    await flush();
  }
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text „${part}" nicht gefunden`);
  }
  return btn;
}

function typeInto(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// endpoints als Spies verdrahten: die Board-/Directory-Queries liefern kontrolliert, und die
// Mutation endpoints.ko.act (Feedback: comment+rate, Admin: admin-validate) wird NIE echt gefeuert.
vi.spyOn(endpoints.ko, "act").mockResolvedValue({} as never);
vi.spyOn(endpoints.validation, "board").mockResolvedValue([] as never);
vi.spyOn(endpoints.directory, "list").mockResolvedValue([] as never);
vi.spyOn(endpoints.ko, "aiCheckRetry").mockResolvedValue({ status: "pending" } as never);

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("WP-SHIP9-B3FIX2: offene Folgezustände überleben den pending-Lock NICHT", () => {
  it("Feedback-Formular (failed → pending): Absenden ist gesperrt und feuert die Mutation nicht", async () => {
    await mountWith(AI_FAILED);
    const actSpy = endpoints.ko.act as unknown as ReturnType<typeof vi.fn>;

    // 1) Folgezustand öffnen: Rückfrage → Pflicht-Feedback-Formular; gültigen Text eintragen.
    act(() => {
      buttonByText(de("val.actionQuery")).click();
    });
    await flush();
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    typeInto(textarea as HTMLTextAreaElement, "Bitte Quelle ergänzen.");
    // Vorbedingung: im failed-Zustand ist Absenden bedienbar (kein Lock).
    expect(buttonByText(de("val.feedback.submit")).disabled).toBe(false);

    // 2) Query-Daten der Karte auf pending aktualisieren (Retry hat neu eingereiht).
    setBoard([ko(AI_PENDING)]);
    await flush();

    // 3) Absenden muss jetzt gesperrt sein UND darf die Mutation nicht auslösen.
    const submit = buttonByText(de("val.feedback.submit"));
    expect(submit.disabled).toBe(true);
    actSpy.mockClear();
    act(() => {
      submit.click();
    });
    await flush();
    expect(actSpy).toHaveBeenCalledTimes(0);
  });

  it("Admin-Bestätigung (done → pending): Ja ist gesperrt und feuert die Mutation nicht", async () => {
    await mountWith(AI_DONE);
    const actSpy = endpoints.ko.act as unknown as ReturnType<typeof vi.fn>;

    // 1) Folgezustand öffnen: „Als wahr kennzeichnen" → Zwei-Klick-Bestätigung erscheint.
    act(() => {
      buttonByText(de("val.markTrue")).click();
    });
    await flush();
    // Vorbedingung: im done-Zustand ist der Ja-Knopf bedienbar (kein Lock).
    expect(buttonByText(de("val.markTrueYes")).disabled).toBe(false);

    // 2) Query-Daten der Karte auf pending aktualisieren.
    setBoard([ko(AI_PENDING)]);
    await flush();

    // 3) Admin-Ja muss jetzt gesperrt sein UND darf die Mutation nicht auslösen.
    const yes = buttonByText(de("val.markTrueYes"));
    expect(yes.disabled).toBe(true);
    actSpy.mockClear();
    act(() => {
      yes.click();
    });
    await flush();
    expect(actSpy).toHaveBeenCalledTimes(0);
  });
});
