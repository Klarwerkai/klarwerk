// @vitest-environment jsdom
// AUFTRAG-mega6 Block D (bens Ehrlichkeitskante): Die Persistenzgrenze kürzt und kappt — das darf
// nicht still geschehen. Je ein gemounteter Fall AN DER GRENZE für Suchanfrage, Quellenfeld,
// Interviewantwort und Prüferanzahl. Bewiesen wird beides: die Oberfläche zeigt die Grenze an, und
// nichts geht unbemerkt verloren (maxLength am Feld, gesperrte Auswahl über dem Mengenlimit).
// Die Servernormalisierung bleibt unverändert Defense-in-Depth — hier nicht Prüfgegenstand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REVIEWERS = vi.hoisted(() =>
  Array.from({ length: 25 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Pruefer ${String(i + 1).padStart(2, "0")}`,
    email: `p${i + 1}@x.de`,
    role: "editor",
  })),
);

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
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok(REVIEWERS) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async (answers: string[]) => ({
          question: `Frage ${answers.length + 1}?`,
          done: false,
          draft: {
            title: "",
            statement: "",
            conditions: [],
            measures: [],
            tags: [],
            confidence: 0,
            demo: false,
          },
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { DRAFT_LIMITS } from "../../apps/web/src/lib/draftLimits";
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

async function openAdvanced(): Promise<void> {
  await mount();
  // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
  // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
  // des Blattes und startet offen.
  await click(buttonByText(i18n.t("capture.advanced.title")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  h3Modus = undefined;
  h3Zeichnen = null;
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block D: Längengrenzen sind am Feld sichtbar, statt serverseitig still zu kürzen", () => {
  it("Suchanfrage: maxLength am Feld, Hinweis genau an der Grenze", async () => {
    await openAdvanced();
    const field = inputByPlaceholder(i18n.t("ext.placeholder"));
    expect(field.maxLength).toBe(DRAFT_LIMITS.extQuery);

    await change(field, "a".repeat(DRAFT_LIMITS.extQuery - 1));
    expect(pageText()).not.toContain(i18n.t("capture.limit.chars", { max: DRAFT_LIMITS.extQuery }));

    await change(field, "a".repeat(DRAFT_LIMITS.extQuery));
    expect(pageText()).toContain(i18n.t("capture.limit.chars", { max: DRAFT_LIMITS.extQuery }));
  });

  it("Quellenfelder: je eigenes maxLength, Hinweis an der Grenze der Bezeichnung", async () => {
    await openAdvanced();
    expect(inputByPlaceholder(i18n.t("ko.sourceLabel")).maxLength).toBe(DRAFT_LIMITS.sourceLabel);
    expect(inputByPlaceholder(i18n.t("ko.sourceUrl")).maxLength).toBe(DRAFT_LIMITS.sourceUrl);
    expect(inputByPlaceholder(i18n.t("ko.sourceExcerpt")).maxLength).toBe(
      DRAFT_LIMITS.sourceExcerpt,
    );

    await change(
      inputByPlaceholder(i18n.t("ko.sourceLabel")),
      "L".repeat(DRAFT_LIMITS.sourceLabel),
    );
    expect(pageText()).toContain(i18n.t("capture.limit.chars", { max: DRAFT_LIMITS.sourceLabel }));
  });

  it("Interviewantwort: maxLength am Feld, Hinweis an der Grenze", async () => {
    await mount();
    // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
    // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
    // des Blattes und startet offen.
    await waehleModus("interview");
    await click(buttonByText(i18n.t("capture.ivStart")));

    const field = textareaByPlaceholder(i18n.t("capture.ivAnswerHint"));
    expect(field.maxLength).toBe(DRAFT_LIMITS.interviewText);

    await change(field, "x".repeat(DRAFT_LIMITS.interviewText - 1));
    expect(pageText()).not.toContain(
      i18n.t("capture.limit.chars", { max: DRAFT_LIMITS.interviewText }),
    );

    await change(field, "x".repeat(DRAFT_LIMITS.interviewText));
    expect(pageText()).toContain(
      i18n.t("capture.limit.chars", { max: DRAFT_LIMITS.interviewText }),
    );
  });
});

describe("Block D: Mengengrenzen sperren sichtbar, statt serverseitig still zu kappen", () => {
  it("Prüferanzahl: am Limit nimmt die Auswahl nichts Neues mehr an und sagt es", async () => {
    await openAdvanced();
    const pick = (n: number): HTMLButtonElement =>
      buttonByText(`Pruefer ${String(n).padStart(2, "0")}`);

    for (let n = 1; n <= DRAFT_LIMITS.reviewers; n++) {
      await click(pick(n));
    }
    expect(pageText()).toContain(
      i18n.t("capture.reviewers.selected", { n: DRAFT_LIMITS.reviewers }),
    );
    expect(pageText()).toContain(
      i18n.t("capture.limit.reviewers", { max: DRAFT_LIMITS.reviewers }),
    );

    // Der nächste Kandidat ist sichtbar gesperrt — kein stilles Verschlucken beim Speichern.
    const beyond = pick(DRAFT_LIMITS.reviewers + 1);
    expect(beyond.disabled).toBe(true);
    await click(beyond);
    expect(pageText()).toContain(
      i18n.t("capture.reviewers.selected", { n: DRAFT_LIMITS.reviewers }),
    );

    // Abwählen bleibt jederzeit möglich — die Grenze sperrt nur das Hinzufügen.
    await click(pick(1));
    expect(pageText()).toContain(
      i18n.t("capture.reviewers.selected", { n: DRAFT_LIMITS.reviewers - 1 }),
    );
    expect(pageText()).not.toContain(
      i18n.t("capture.limit.reviewers", { max: DRAFT_LIMITS.reviewers }),
    );
    expect(pick(DRAFT_LIMITS.reviewers + 1).disabled).toBe(false);
  });
});
