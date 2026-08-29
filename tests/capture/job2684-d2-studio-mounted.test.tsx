// @vitest-environment jsdom
// ================================================================================================
// JOB 2684 D2 (R2-17) — AUCH DAS STUDIO MUSS ES MERKEN: die Erfassen-Seite, gemountet.
// ================================================================================================
//
// §5: „Ein Mensch hat denselben Entwurf im Studio und in der Vordertür offen. Wer als zweiter
// speichert, sieht in BEIDEN Flächen dieselbe Meldung und überschreibt nichts."
//
// Die Vordertür ist seit D1 belegt (`job2684-zwei-tabs-mounted.test.tsx`). Hier läuft die ECHTE
// Seite `Capture` (Harness wie `job2683-d2-suche-flaeche`): ein Entwurf wird über „Fortsetzen"
// geladen, verändert, gespeichert — und der Endpunkt antwortet so, wie die Route seit D1 antwortet
// (409 `DRAFT_STALE`, an der echten Route gepinnt in `tests/app/job2684-draft-stale-route.test.ts`).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gegenstelle = vi.hoisted(() => ({
  update: async (..._args: unknown[]): Promise<unknown> => ({}),
  promote: async (..._args: unknown[]): Promise<unknown> => ({}),
  entwurf: {
    id: "d-1",
    payload: {
      title: "Wartung der Presse",
      statement: "Anlage freischalten. Mein Text im Studio.",
      type: "best_practice",
      category: "Allgemein",
      origin: "tell",
    },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-08-28T19:00:00.000Z",
    updatedAt: "2026-08-28T20:00:00.000Z",
  },
  getCount: 0,
}));

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
      external: {
        policy: vi.fn(async () => ({ stage: "search_on_click" })),
        search: vi.fn(async () => []),
      },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => [gegenstelle.entwurf]),
        get: vi.fn(async () => {
          gegenstelle.getCount += 1;
          return gegenstelle.entwurf;
        }),
        create: vi.fn(async () => ({ id: "d-neu" })),
        update: vi.fn((...args: unknown[]) => gegenstelle.update(...args)),
        remove: vi.fn(async () => {}),
        promote: vi.fn((...args: unknown[]) => gegenstelle.promote(...args)),
      },
      ko: {
        create: vi.fn(async () => ({ id: "ko-1" })),
        createFromDocument: vi.fn(async () => ({ id: "ko-1" })),
      },
      reasoner: {
        status: ok({ active: false, mode: "cloud", reachable: "inactive" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const updateMock = endpoints.drafts.update as unknown as ReturnType<typeof vi.fn>;

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
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function tippen(el: HTMLElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function konfliktKasten(): HTMLElement | null {
  const el = container.querySelector('[data-testid="capture-draft-stale"]');
  return el instanceof HTMLElement ? el : null;
}

function erzaehlfeld(): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Erzählfeld (textarea) nicht gefunden");
  }
  return el;
}

/** Der Weg des Menschen: Entwurfsliste aufklappen, „Fortsetzen" drücken. */
async function entwurfFortsetzen(): Promise<void> {
  await click(buttonByText(i18n.t("capture.resumeExpand", { count: 1 })));
  await click(buttonByText(i18n.t("capture.resume")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gegenstelle.getCount = 0;
  gegenstelle.update = async () => ({});
  gegenstelle.promote = async () => ({ id: "ko-1" });
  gegenstelle.entwurf = {
    ...gegenstelle.entwurf,
    payload: {
      ...gegenstelle.entwurf.payload,
      statement: "Anlage freischalten. Mein Text im Studio.",
    },
    updatedAt: "2026-08-28T20:00:00.000Z",
  };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2684 D2 · das Studio merkt den Standkonflikt — derselbe Satz wie die Vordertür", () => {
  it("Fortsetzen → Speichern mit dem gesehenen Stand; der Server meldet DRAFT_STALE → Kasten sichtbar, Text bleibt, kein Fehler-Toast", async () => {
    gegenstelle.update = async () => {
      throw new ApiError(
        409,
        "DRAFT_STALE",
        "Der Entwurf wurde inzwischen an anderer Stelle geändert. Dein Stand wurde nicht gespeichert — bitte neu laden.",
      );
    };
    await mount();
    await entwurfFortsetzen();
    expect(pageText()).toContain(i18n.t("capture.editingDraft"));
    expect(erzaehlfeld().value).toContain("Mein Text im Studio.");
    expect(konfliktKasten()).toBeNull();

    await tippen(erzaehlfeld(), "Anlage freischalten. Mein Text im Studio. Und mein Zusatz.");
    await click(buttonByText(i18n.t("capture.saveDraft")));

    // Der gesehene Stand ist mitgereist — die Grundlage des Vergleichs auf dem Server.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]?.[0]).toBe("d-1");
    expect(updateMock.mock.calls[0]?.[2]).toEqual({
      expectedUpdatedAt: "2026-08-28T20:00:00.000Z",
    });
    // Der Kasten — mit demselben Satz wie in der Vordertür.
    const kasten = konfliktKasten();
    expect(kasten).not.toBeNull();
    expect(kasten?.textContent).toContain(i18n.t("fd.draftStale"));
    expect(kasten?.textContent).toContain(i18n.t("fd.draftStaleReload"));
    // Nicht „Etwas ist schiefgelaufen", nicht „Entwurf aktualisiert".
    expect(pageText()).not.toContain(i18n.t("state.error"));
    expect(pageText()).not.toContain(i18n.t("capture.draftUpdated"));
    // Und der eigene Text steht weiter im Feld — nichts verworfen, nichts überschrieben.
    expect(erzaehlfeld().value).toContain("Und mein Zusatz.");
  });

  it("„Neu laden“ holt die andere Fassung ausdrücklich in das Studio — und der nächste Speichern-Versuch trägt den neuen Stand", async () => {
    gegenstelle.update = async () => {
      throw new ApiError(409, "DRAFT_STALE", "veraltet");
    };
    await mount();
    await entwurfFortsetzen();
    await tippen(erzaehlfeld(), "Mein Zusatz im Studio.");
    await click(buttonByText(i18n.t("capture.saveDraft")));
    expect(konfliktKasten()).not.toBeNull();

    // Die Gegenstelle liefert beim Neuladen die jüngere Fassung aus der Vordertür.
    gegenstelle.entwurf = {
      ...gegenstelle.entwurf,
      payload: { ...gegenstelle.entwurf.payload, statement: "Fassung aus der Vordertür." },
      updatedAt: "2026-08-28T20:05:00.000Z",
    };
    gegenstelle.update = async () => ({ id: "d-1", updatedAt: "2026-08-28T20:06:00.000Z" });
    await click(buttonByText(i18n.t("fd.draftStaleReload")));
    expect(gegenstelle.getCount).toBe(1); // wirklich neu geladen
    expect(konfliktKasten()).toBeNull();
    expect(erzaehlfeld().value).toContain("Fassung aus der Vordertür.");
    expect(erzaehlfeld().value).not.toContain("Mein Zusatz im Studio.");

    await tippen(erzaehlfeld(), "Fassung aus der Vordertür. Ergänzt.");
    await click(buttonByText(i18n.t("capture.saveDraft")));
    expect(updateMock.mock.calls[1]?.[2]).toEqual({
      expectedUpdatedAt: "2026-08-28T20:05:00.000Z",
    });
    expect(konfliktKasten()).toBeNull();
    expect(pageText()).toContain(i18n.t("capture.draftUpdated"));
  });

  it("GEGENPROBE: ohne fremde Änderung speichert das Studio wie bisher — Stand reist mit, kein Kasten, „Entwurf aktualisiert“", async () => {
    gegenstelle.update = async () => ({ id: "d-1", updatedAt: "2026-08-28T20:06:00.000Z" });
    await mount();
    await entwurfFortsetzen();
    await tippen(erzaehlfeld(), "Mein Text im Studio, ergänzt.");
    await click(buttonByText(i18n.t("capture.saveDraft")));
    expect(updateMock.mock.calls[0]?.[2]).toEqual({
      expectedUpdatedAt: "2026-08-28T20:00:00.000Z",
    });
    expect(konfliktKasten()).toBeNull();
    expect(pageText()).toContain(i18n.t("capture.draftUpdated"));
  });

  it("KALIBRIERUNG: ein anderer Fehler zeigt weiter den Fehlerweg — der Kasten ist nur für den Konflikt", async () => {
    gegenstelle.update = async () => {
      throw new ApiError(500, "INTERNAL", "Interner Betriebsfehler.");
    };
    await mount();
    await entwurfFortsetzen();
    await tippen(erzaehlfeld(), "Mein Text im Studio, ergänzt.");
    await click(buttonByText(i18n.t("capture.saveDraft")));
    expect(konfliktKasten()).toBeNull();
    expect(pageText()).toContain("Interner Betriebsfehler.");
  });

  it("ein NEUER Entwurf (nichts fortgesetzt) speichert ohne Stand — der Altweg bleibt für ihn unverändert", async () => {
    await mount();
    await tippen(erzaehlfeld(), "Ein ganz neuer Text.");
    await click(buttonByText(i18n.t("capture.saveDraft")));
    const create = endpoints.drafts.create as unknown as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(konfliktKasten()).toBeNull();
  });
});

describe("JOB 2684 D2 · auch das EINREICHEN aus dem Studio trägt den Stand", () => {
  it("Fortsetzen (Experten-Formular) → Einreichen; der Server meldet DRAFT_STALE → Kasten, kein Neustart-Angebot, nichts befördert", async () => {
    gegenstelle.entwurf = {
      ...gegenstelle.entwurf,
      payload: { ...gegenstelle.entwurf.payload, origin: "expert" },
    };
    gegenstelle.promote = async () => {
      throw new ApiError(409, "DRAFT_STALE", "veraltet");
    };
    await mount();
    await entwurfFortsetzen();
    const einreichen = buttonByText(i18n.t("capture.submit"));
    expect(einreichen.disabled, "Einreichen ist im geladenen Experten-Entwurf gesperrt").toBe(
      false,
    );
    await click(einreichen);

    const promote = endpoints.drafts.promote as unknown as ReturnType<typeof vi.fn>;
    expect(promote).toHaveBeenCalledTimes(1);
    expect(promote.mock.calls[0]?.[0]).toBe("d-1");
    expect(promote.mock.calls[0]?.[1]).toMatchObject({
      expectedUpdatedAt: "2026-08-28T20:00:00.000Z",
    });
    expect(konfliktKasten()).not.toBeNull();
    expect(konfliktKasten()?.textContent).toContain(i18n.t("fd.draftStale"));
    expect(pageText()).not.toContain(i18n.t("capture.restartOfferTitle"));
    expect(pageText()).not.toContain(i18n.t("state.error"));
  });
});

describe("JOB 2684 D2 · DERSELBE SATZ an beiden Türen", () => {
  it("Studio und Vordertür rendern den Konflikt aus DEMSELBEN Schlüssel `fd.draftStale` — keine zwei Formulierungen für dieselbe Lage", () => {
    // Pfade relativ zur Projektwurzel — vitest läuft dort; `import.meta.url` ist in jsdom keine
    // `file:`-Adresse.
    const studio = readFileSync("apps/web/src/pages/Capture.tsx", "utf8");
    const vordertuer = readFileSync("apps/web/src/pages/CaptureFrontDoor.tsx", "utf8");
    for (const quelle of [studio, vordertuer]) {
      expect(quelle).toContain('t("fd.draftStale")');
      expect(quelle).toContain('t("fd.draftStaleReload")');
    }
    // Und der Schlüssel ist in allen drei Sprachen belegt — kein leerer Satz in einer Sprache.
    for (const lng of ["de", "en", "nl"]) {
      expect(i18n.t("fd.draftStale", { lng })).not.toBe("fd.draftStale");
      expect(i18n.t("fd.draftStale", { lng }).length).toBeGreaterThan(40);
    }
  });
});
