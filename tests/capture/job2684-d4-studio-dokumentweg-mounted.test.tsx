// @vitest-environment jsdom
// ================================================================================================
// JOB 2684 D4 (R2-17) — DER DOKUMENTWEG IM STUDIO, GEMOUNTET: fremde Änderung, Einreichen aus dem
// Dokument, sichtbarer Konflikt, Text bleibt, nichts angelegt — als EINE Kette.
// ================================================================================================
//
// BEN an D3: „Der Quellpin für den Capture.tsx-Aufruf zusammen mit einem Routentest ist kein Beleg
// am Ort der Nutzerhandlung; er prüft weder das Auslösen von `createFromDocument` in der gemounteten
// Oberfläche noch sichtbaren Fehler, Texterhalt und ausbleibende Schreibwirkung als eine Kette."
//
// Hier läuft die ECHTE Seite `Capture` (Harness wie job2684-d2-studio-mounted). Der Weg des
// Menschen: ein gespeicherter Entwurf trägt ein gesichertes Ankerdokument samt verankerter
// Belegstelle (`anchorDocuments` + `pendingSources` mit `anchorKey`/`objectId` — so speichert
// mega20/mega22 sie) → „Fortsetzen" → „Einreichen". Weil Anker da sind, nimmt die Seite den
// Dokumentweg (`endpoints.ko.createFromDocument` mit `draftId`), nicht den Promote. Der Endpunkt
// antwortet wie die echte Route seit D3/D4 (409 `DRAFT_STALE`, gepinnt in
// tests/app/job2684-d3-dokumentweg-route.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gegenstelle = vi.hoisted(() => ({
  createFromDocument: async (..._args: unknown[]): Promise<unknown> => ({ id: "ko-1" }),
  entwurf: {
    id: "d-1",
    payload: {
      title: "Wartung der Presse",
      statement: "Anlage freischalten. Mein Text aus dem Dokument.",
      type: "best_practice",
      category: "Allgemein",
      origin: "expert",
      // Das gesicherte Original und seine Belegstelle — wie mega20 Block D sie speichert.
      anchorDocuments: [
        {
          key: "doc-1",
          objectId: "obj-original-1",
          name: "pruefplan.docx",
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      ],
      pendingSources: [
        {
          label: "pruefplan.docx · Seite 1",
          excerpt: "Anlage freischalten.",
          anchorKey: "doc-1",
          objectId: "obj-original-1",
        },
      ],
    },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-08-28T19:00:00.000Z",
    updatedAt: "2026-08-28T20:00:00.000Z",
  },
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
        get: vi.fn(async () => gegenstelle.entwurf),
        create: vi.fn(async () => ({ id: "d-neu" })),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({ id: "ko-promote" })),
      },
      ko: {
        create: vi.fn(async () => ({ id: "ko-create" })),
        createFromDocument: vi.fn((...args: unknown[]) => gegenstelle.createFromDocument(...args)),
      },
      objects: { upload: vi.fn(async () => ({ id: "obj-x", size: 1 })) },
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

const createFromDocumentMock = endpoints.ko.createFromDocument as unknown as ReturnType<
  typeof vi.fn
>;
const promoteMock = endpoints.drafts.promote as unknown as ReturnType<typeof vi.fn>;
const updateMock = endpoints.drafts.update as unknown as ReturnType<typeof vi.fn>;
const removeMock = endpoints.drafts.remove as unknown as ReturnType<typeof vi.fn>;
const createMock = endpoints.ko.create as unknown as ReturnType<typeof vi.fn>;

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

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function konfliktKasten(): HTMLElement | null {
  const el = container.querySelector('[data-testid="capture-draft-stale"]');
  return el instanceof HTMLElement ? el : null;
}

/** Der Weg des Menschen: Entwurfsliste aufklappen, „Fortsetzen" drücken. */
async function entwurfFortsetzen(): Promise<void> {
  await click(buttonByText(i18n.t("capture.resumeExpand", { count: 1 })));
  await click(buttonByText(i18n.t("capture.resume")));
}

function textfeldWerte(): string[] {
  return [...container.querySelectorAll("textarea, input[type='text']")].map((el) =>
    el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement ? el.value : "",
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gegenstelle.createFromDocument = async () => ({ id: "ko-1" });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2684 D4 · der Dokumentweg im Studio als EINE Kette", () => {
  it("Fortsetzen (Entwurf mit Ankerdokument) → Einreichen nimmt den Dokumentweg MIT dem gesehenen Stand; der Server meldet DRAFT_STALE → Kasten sichtbar, Text bleibt, kein Wissensobjekt, kein Entwurf angefasst", async () => {
    gegenstelle.createFromDocument = async () => {
      throw new ApiError(409, "DRAFT_STALE", "veraltet");
    };
    await mount();
    await entwurfFortsetzen();
    expect(pageText()).toContain("Mein Text aus dem Dokument");

    const einreichen = buttonByText(i18n.t("capture.submit"));
    expect(einreichen.disabled, "Einreichen ist im geladenen Experten-Entwurf frei").toBe(false);
    await click(einreichen);

    // (1) DER AUFRUF: der Dokumentweg, mit Entwurf, Anker und dem gesehenen Stand — nicht der Promote.
    expect(createFromDocumentMock).toHaveBeenCalledTimes(1);
    const body = createFromDocumentMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).toMatchObject({
      draftId: "d-1",
      expectedUpdatedAt: "2026-08-28T20:00:00.000Z",
    });
    expect(Array.isArray(body.documents) && body.documents.length).toBe(1);
    expect(promoteMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    // (2) SICHTBAR: derselbe Kasten wie beim Speichern und beim Promote, kein Fehler-, kein Neustart-Text.
    expect(konfliktKasten()).not.toBeNull();
    expect(konfliktKasten()?.textContent).toContain(i18n.t("fd.draftStale"));
    expect(pageText()).not.toContain(i18n.t("capture.restartOfferTitle"));
    expect(pageText()).not.toContain(i18n.t("state.error"));
    // (3) DER TEXT BLEIBT: die Eingabe steht noch im Formular.
    expect(textfeldWerte().some((v) => v.includes("Mein Text aus dem Dokument"))).toBe(true);
    // (4) KEINE SCHREIBWIRKUNG: kein Speichern, kein Verwerfen des Entwurfs.
    expect(updateMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("GEGENPROBE: ohne fremde Änderung geht der Dokumentweg durch — derselbe Aufruf, derselbe Stand, kein Kasten", async () => {
    await mount();
    await entwurfFortsetzen();
    await click(buttonByText(i18n.t("capture.submit")));
    expect(createFromDocumentMock).toHaveBeenCalledTimes(1);
    expect(createFromDocumentMock.mock.calls[0]?.[0]).toMatchObject({
      draftId: "d-1",
      expectedUpdatedAt: "2026-08-28T20:00:00.000Z",
    });
    expect(konfliktKasten()).toBeNull();
    expect(pageText()).not.toContain(i18n.t("state.error"));
  });

  it("„Neu laden“ im Kasten holt die fremde Fassung und der nächste Versuch trägt den neuen Stand", async () => {
    let erster = true;
    gegenstelle.createFromDocument = async () => {
      if (erster) {
        erster = false;
        throw new ApiError(409, "DRAFT_STALE", "veraltet");
      }
      return { id: "ko-1" };
    };
    await mount();
    await entwurfFortsetzen();
    await click(buttonByText(i18n.t("capture.submit")));
    expect(konfliktKasten()).not.toBeNull();
    // Die fremde Fassung liegt jetzt auf dem Server.
    gegenstelle.entwurf = {
      ...gegenstelle.entwurf,
      payload: { ...gegenstelle.entwurf.payload, statement: "Fremde Fassung aus dem anderen Tab." },
      updatedAt: "2026-08-28T20:05:00.000Z",
    };
    await click(buttonByText(i18n.t("fd.draftStaleReload")));
    expect(konfliktKasten()).toBeNull();
    expect(pageText()).toContain("Fremde Fassung aus dem anderen Tab");
    await click(buttonByText(i18n.t("capture.submit")));
    expect(createFromDocumentMock).toHaveBeenCalledTimes(2);
    expect(createFromDocumentMock.mock.calls[1]?.[0]).toMatchObject({
      draftId: "d-1",
      expectedUpdatedAt: "2026-08-28T20:05:00.000Z",
    });
  });
});
