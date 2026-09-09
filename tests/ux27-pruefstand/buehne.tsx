// Echte Route /wissen/:id; nur HTTP-Grenzen ersetzt. React Query, Ableitungen und i18n laufen echt.
import { afterEach, beforeEach, expect, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Welche Belege der Server liefert — je Fall gesetzt. */
  belege: [] as unknown[],
  belegAufrufe: 0,
  belegAbruf: undefined as undefined | (() => Promise<unknown[]>),
  /** Welche Audit-Ereignisse `GET /api/audit` liefert — je Fall gesetzt. */
  ereignisse: [] as unknown[],
  /** Der Audit-Abruf scheitert (Zustandsmodell: kein Leersatz aus einem Fehler). */
  ereignisseFehler: false,
  /** Die Rolle der angemeldeten Person — entscheidet über `canEdit` (`MehrAbschnitte.tsx:210`). */
  rolle: "experte" as string,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3394Ko),
        list: vi.fn(async () => [globalThis.__job3394Ko]),
        versions: leer,
        evidence: vi.fn(async () => {
          box.belegAufrufe++;
          return box.belegAbruf ? box.belegAbruf() : box.belege;
        }),
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3394Ko),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: {
        list: vi.fn(async () => {
          if (box.ereignisseFehler) {
            throw new Error("Audit-Abruf gescheitert");
          }
          return box.ereignisse;
        }),
      },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand reist über den globalen Namensraum: `vi.mock` wird hochgezogen und darf nichts aus
  // dem Modulrumpf schließen (dieselbe Bauform wie JOB 3272).
  // eslint-disable-next-line no-var
  var __job3394Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** `scrollIntoView` fehlt in jsdom — mitgeschrieben statt stillgelegt (wie JOB 3108/3272). */
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView = () =>
  undefined;

function beleg(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "attachment",
    label: "Beleg zum Prüfprotokoll",
    createdBy: "u1",
    createdAt: "2026-08-31T10:00:00.000Z",
    ...overrides,
  } as EvidenceRecord;
}

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: "<p>Reinigung und Prüfung.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "offen",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [
      {
        id: "att-1",
        name: "pruefprotokoll.png",
        mime: "image/png",
        objectId: "obj-1",
        thumbnail: "data:image/png;base64,iVBORw0KGgo=",
        author: "u1",
        at: "2026-08-01T00:00:00.000Z",
      },
    ],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(overrides: Partial<KnowledgeObject> = {}): Promise<void> {
  globalThis.__job3394Ko = { ...ko(), ...overrides };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
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
  await act(flush);
  await act(flush);
}

function el(testId: string): HTMLElement {
  const treffer = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!treffer) {
    throw new Error(`„${testId}" fehlt auf der Lesefläche`);
  }
  return treffer;
}

const abschnitt = (schluessel: string): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Einen Abschnitt VON HAND auf- oder zuklappen — der Weg, den ein Mensch am `<summary>` geht. */
async function vonHand(schluessel: string, offen: boolean): Promise<void> {
  const d = abschnitt(schluessel);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt`);
  }
  await act(async () => {
    d.open = offen;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

/** „Mehr" aufklappen und einen der dreizehn Abschnitte öffnen. */
async function oeffne(schluessel: string): Promise<HTMLDetailsElement> {
  await klick(el("bib-mehr"));
  await vonHand(schluessel, true);
  const d = abschnitt(schluessel);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt nach dem Aufklappen`);
  }
  return d;
}

/**
 * „Sichtbar" heißt messbar sichtbar (Lehre JOB 3179): weder `hidden`, `aria-hidden`, `sr-only`
 * noch eine Clip-/0-Pixel-Regel — an keinem Element im Pfad bis zum Abschnitt.
 */
function pruefeSichtbar(knoten: HTMLElement, bis: HTMLElement): void {
  for (let e: HTMLElement | null = knoten; e && e !== bis.parentElement; e = e.parentElement) {
    if (e instanceof HTMLDetailsElement && !e.open) {
      const summary = e.querySelector(":scope > summary");
      expect(summary?.contains(knoten), "Einordnung liegt im zugeklappten details").toBe(true);
    }
    const style = getComputedStyle(e);
    expect(style.display).not.toBe("none");
    expect(style.visibility).not.toBe("hidden");
    expect(e.hasAttribute("hidden"), `hidden an ${e.tagName}`).toBe(false);
    expect(e.getAttribute("aria-hidden"), `aria-hidden an ${e.tagName}`).not.toBe("true");
    const klassen = e.className.toString();
    expect(klassen, `sr-only an ${e.tagName}`).not.toContain("sr-only");
    expect(klassen, `Clip-Regel an ${e.tagName}`).not.toContain("clip");
    expect(klassen, `Null-Höhe an ${e.tagName}`).not.toMatch(/\bh-0\b|\bw-0\b/);
  }
}

/** Das innerste Element, dessen Text GENAU dem Satz entspricht. */
function satzKnoten(wurzel: HTMLElement, satz: string): HTMLElement | null {
  const kandidaten = Array.from(wurzel.querySelectorAll<HTMLElement>("*")).filter(
    (e) => text(e) === satz,
  );
  return kandidaten.length > 0 ? (kandidaten[kandidaten.length - 1] as HTMLElement) : null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.belege = [];
  box.belegAufrufe = 0;
  box.belegAbruf = undefined;
  onlineManager.setOnline(true);
  box.ereignisse = [];
  box.ereignisseFehler = false;
  box.rolle = "experte";
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

export { box, beleg, ko, mount, oeffne, text, pruefeSichtbar, satzKnoten, qc, container, flush };
