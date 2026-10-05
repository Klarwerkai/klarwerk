// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG anzeige-kosten (R-0952, R-1797) — DER KOSTENHINWEIS IM BLATT FOLGT DER LAUFENDEN AUFGABE.
// ================================================================================================
//
// DER REST: Das Blatt fragte `useAiBillable(["structure", "assist"])` und band das Ergebnis an
// „IRGENDEINE der beiden läuft". Meldet der Server `billable` nur für `assist`, stand beim
// STRUKTURIEREN (lokal oder deterministisch, also kostenlos) „Ein Klick kann eine echte,
// kostenpflichtige Cloud-KI-Anfrage auslösen" — eine Tatsachenaussage ohne Deckung.
//
// GEMESSEN WIRD am gemounteten Blatt über den echten Klickweg (KI-Menü → Eintrag), während der
// KI-Aufruf hängt: genau in diesem Augenblick zeigt die Lagezeile den Hinweis oder nicht.
// Bauart übernommen von tests/ki-uebernahme-speichern/adopt-then-save.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReasonerStatus } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({
  status: null as unknown,
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      status: vi.fn(async () => lage.status),
      config: vi.fn(async () => null),
      // Beide KI-Aufrufe hängen: der Hinweis wird WÄHREND des Laufs gemessen.
      structure: vi.fn(() => new Promise(() => {})),
      assist: vi.fn(() => new Promise(() => {})),
    },
    drafts: {
      get: vi.fn(async () => {
        throw new Error("kein Entwurf");
      }),
      list: vi.fn(async () => []),
      create: vi.fn(async (payload: Record<string, unknown>) => ({
        id: "d1",
        payload,
        updatedAt: "2026-10-03T00:00:00.000Z",
      })),
      update: vi.fn(async (id: string, payload: Record<string, unknown>) => ({
        id,
        payload,
        updatedAt: "2026-10-03T00:00:01.000Z",
      })),
      remove: vi.fn(async () => {}),
      promote: vi.fn(async () => ({})),
    },
    uploadLimits: {
      get: vi.fn(async () => ({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 })),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Blatt } from "../../apps/web/src/components/erfassen/Blatt";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            AuthProvider,
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
                  createElement(Blatt, {
                    arbeitsraum: () => createElement("div", { "data-testid": "arbeitsraum" }),
                  }),
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

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
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

async function schreibeInsBlatt(html: string): Promise<void> {
  const editor = container.querySelector('[contenteditable="true"]');
  if (!editor) {
    throw new Error("Die Schreibfläche fehlt.");
  }
  await act(async () => {
    editor.innerHTML = html;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function kiWeg(eintrag: string): Promise<void> {
  const werkzeug = container.querySelector<HTMLButtonElement>('[data-testid="blatt-werkzeug-ki"]');
  if (!werkzeug) {
    throw new Error("Das Menü „KI“ ist nicht auf dem Blatt.");
  }
  await click(werkzeug);
  await click(buttonByText(eintrag));
}

// Nur der Hinweis in der Lagezeile des Blatts — andere Flächen im Baum zählen hier nicht.
const kostenhinweisInDerLage = (): boolean =>
  container.querySelector('[data-testid="blatt-lage"] [data-testid="ai-cost-hint"]') !== null;

function status(billable?: NonNullable<ReasonerStatus["billable"]>): ReasonerStatus {
  const basis: ReasonerStatus = {
    active: true,
    mode: "cloud",
    reachable: "active",
    tasks: { structure: true, assist: true },
  };
  return billable ? { ...basis, billable } : basis;
}

beforeEach(() => {
  lage.status = null;
});

afterEach(async () => {
  if (root) {
    const r = root;
    await act(async () => {
      r.unmount();
    });
    root = null;
    container.remove();
  }
  vi.clearAllMocks();
});

describe("Blatt · der Kostenhinweis hängt an der Aufgabe, die WIRKLICH läuft", () => {
  it("Strukturieren läuft lokal, nur Umformulieren wäre kostenpflichtig → KEIN Hinweis", async () => {
    lage.status = status({ structure: false, assist: true });
    await mount();
    await schreibeInsBlatt("<p>ventil entlasten vor wartung</p>");
    await kiWeg(i18n.t("erfassen.ki.struktur"));
    expect(kostenhinweisInDerLage()).toBe(false);
  }, 20000);

  it("Strukturieren ist kostenpflichtig → der Hinweis steht während des Laufs", async () => {
    lage.status = status({ structure: true, assist: false });
    await mount();
    await schreibeInsBlatt("<p>ventil entlasten vor wartung</p>");
    await kiWeg(i18n.t("erfassen.ki.struktur"));
    expect(kostenhinweisInDerLage()).toBe(true);
  }, 20000);

  it("Umformulieren ist kostenpflichtig, Strukturieren nicht → Hinweis beim Umformulieren", async () => {
    lage.status = status({ structure: false, assist: true });
    await mount();
    await schreibeInsBlatt("<p>Wir haben die Lieferung recieved.</p>");
    await kiWeg(i18n.t("capture.ai.action.spelling"));
    expect(kostenhinweisInDerLage()).toBe(true);
  }, 20000);

  it("Umformulieren läuft kostenlos, nur Strukturieren wäre kostenpflichtig → KEIN Hinweis", async () => {
    lage.status = status({ structure: true, assist: false });
    await mount();
    await schreibeInsBlatt("<p>Wir haben die Lieferung recieved.</p>");
    await kiWeg(i18n.t("capture.ai.action.spelling"));
    expect(kostenhinweisInDerLage()).toBe(false);
  }, 20000);

  it("ohne `billable`-Auskunft schweigt der Hinweis — kein Rückfall auf mode=cloud", async () => {
    lage.status = status();
    await mount();
    await schreibeInsBlatt("<p>ventil entlasten vor wartung</p>");
    await kiWeg(i18n.t("erfassen.ki.struktur"));
    expect(kostenhinweisInDerLage()).toBe(false);
  }, 20000);
});
